import Foundation
import Accelerate
import AVFoundation
import os

/// The ears. Fed PCM buffers from DeckEngine's tap; produces the feature frame
/// the visualizer and HUD read at 60 fps. FFT 2048 via vDSP, per-frame
/// exponential smoothing 0.72 on magnitudes; band edges computed from the REAL
/// sample rate (the 44.1-vs-48 kHz bug is a named scar): bass 21-180 Hz,
/// mid 190-2000, treble 2020-9000, flux 21-2740. energy =
/// clamp(bass*1.25 + mid + treble*0.8, 0, 2)/2; calm tau 2.5 s; spectral-flux
/// onset (mean + 1.5 sigma over 90-frame history, 160 ms refractory) drives a
/// snap-and-decay beat envelope.
final class Analyzer {

    struct Frame {
        var bass: Float; var mid: Float; var treble: Float
        var energy: Float; var calm: Float
        var onsetEnv: Float          // 1 at onset, exp decay ~0.25 s
        var beatPhase: Float         // 0..1 from the grid clock (authoritative when mix present)
        var barPhase: Float          // beatPhase/4 space
        var phrasePhase: Float
        var bpm: Float
        var spectrum: [Float]        // 64 log-spaced bands, 0..1
        var waveform: [Float]        // 256 recent mono samples, -1..1 (for SCOPE)
    }

    // FFT geometry: fixed at 2048 (log2 = 11), half-spectrum 1024 bins.
    private static let log2n: vDSP_Length = 11
    private static let fftN = 2048
    private static let halfN = 1024
    private static let specBands = 64
    private static let waveN = 256
    private static let monoRingN = 8192          // power of two, so & masks
    private static let fluxRingN = 90
    // WebAudio AnalyserNode's dB window: [-100, -30] mapped onto 0..255.
    private static let minDB: Float = -100
    private static let dbSpan: Float = 70

    // MARK: - Preallocated storage (the audio thread allocates NOTHING)

    private let window: UnsafeMutablePointer<Float>
    private let fftIn: UnsafeMutablePointer<Float>
    private let windowed: UnsafeMutablePointer<Float>
    private let realp: UnsafeMutablePointer<Float>
    private let imagp: UnsafeMutablePointer<Float>
    private let mag: UnsafeMutablePointer<Float>
    private let smooth: UnsafeMutablePointer<Float>       // 0.72-smoothed magnitudes
    private let scratch: UnsafeMutablePointer<Float>
    private let normByte: UnsafeMutablePointer<Float>     // dB-normalized 0..255
    private let prevByte: UnsafeMutablePointer<Float>
    private let monoRing: UnsafeMutablePointer<Float>
    private let workWave: UnsafeMutablePointer<Float>
    private let workSpec: UnsafeMutablePointer<Float>
    private let fluxRing: UnsafeMutablePointer<Float>
    private let ioiRing: UnsafeMutablePointer<Double>     // inter-onset intervals (8)
    private let ioiScratch: UnsafeMutablePointer<Double>
    private let pubSpec: UnsafeMutablePointer<Float>      // published under lock
    private let pubWave: UnsafeMutablePointer<Float>
    private let fftSetup: FFTSetup?

    // Band-edge bins, recomputed whenever the tap's real sample rate changes.
    private var sampleRate: Double = 0
    private var bassLo = 1, bassHi = 1
    private var midLo = 1, midHi = 1
    private var trebLo = 1, trebHi = 1
    private var fluxLo = 1, fluxHi = 1
    private var specLo = [Int](repeating: 1, count: Analyzer.specBands)
    private var specHi = [Int](repeating: 1, count: Analyzer.specBands)

    // Ingest-thread state (never touched off the audio thread).
    private var monoIdx = 0
    private var waveIdx = 0
    private var fluxIdx = 0
    private var fluxCount = 0
    private var ioiCount = 0
    private var lastIngestT: Double = 0
    private var bassS: Float = 0
    private var midS: Float = 0
    private var trebS: Float = 0
    private var energyS: Float = 0
    private var calmS: Float = 1
    private var bpmEst: Float = 120
    private var lastOnsetT: Double = 0
    private var fluxBeatBase: Double = 0

    // MARK: - Published snapshot (guarded by the unfair lock; hold times are
    // a handful of scalar copies plus 320 floats — never a vDSP call)

    private let stateLock = AKUnfairLock()
    private var pBass: Float = 0
    private var pMid: Float = 0
    private var pTreble: Float = 0
    private var pEnergy: Float = 0
    private var pCalm: Float = 1
    private var pBpm: Float = 120
    private var pLastOnsetT: Double = 0
    private var pFluxBeatBase: Double = 0
    // Clock truth, written by setClock (main), read by currentFrame (render).
    private var clockValid = false
    private var clockBpm: Double = 0
    private var clockGrid: Double = 0
    private var clockPhrases: Double = 32
    private var clockPlayhead: Double = 0
    private var clockRate: Double = 1
    private var clockSetAt: Double = 0

    init() {
        window = Self.alloc(Self.fftN)
        fftIn = Self.alloc(Self.fftN)
        windowed = Self.alloc(Self.fftN)
        realp = Self.alloc(Self.halfN)
        imagp = Self.alloc(Self.halfN)
        mag = Self.alloc(Self.halfN)
        smooth = Self.alloc(Self.halfN)
        scratch = Self.alloc(Self.halfN)
        normByte = Self.alloc(Self.halfN)
        prevByte = Self.alloc(Self.halfN)
        monoRing = Self.alloc(Self.monoRingN)
        workWave = Self.alloc(Self.waveN)
        workSpec = Self.alloc(Self.specBands)
        fluxRing = Self.alloc(Self.fluxRingN)
        pubSpec = Self.alloc(Self.specBands)
        pubWave = Self.alloc(Self.waveN)
        ioiRing = UnsafeMutablePointer<Double>.allocate(capacity: 8)
        ioiRing.initialize(repeating: 0, count: 8)
        ioiScratch = UnsafeMutablePointer<Double>.allocate(capacity: 8)
        ioiScratch.initialize(repeating: 0, count: 8)
        fftSetup = vDSP_create_fftsetup(Self.log2n, FFTRadix(kFFTRadix2))
        vDSP_hann_window(window, vDSP_Length(Self.fftN), Int32(vDSP_HANN_DENORM))
    }

    deinit {
        window.deallocate(); fftIn.deallocate(); windowed.deallocate()
        realp.deallocate(); imagp.deallocate(); mag.deallocate()
        smooth.deallocate(); scratch.deallocate()
        normByte.deallocate(); prevByte.deallocate()
        monoRing.deallocate(); workWave.deallocate(); workSpec.deallocate()
        fluxRing.deallocate(); pubSpec.deallocate(); pubWave.deallocate()
        ioiRing.deallocate(); ioiScratch.deallocate()
        if let setup = fftSetup { vDSP_destroy_fftsetup(setup) }
    }

    // MARK: - Ingest (audio thread)

    /// Runs on the tap thread. Everything it touches was allocated at init;
    /// the only lock is the brief snapshot publish at the end.
    func ingest(buffer: AVAudioPCMBuffer, when: AVAudioTime) {
        guard let setup = fftSetup, let chans = buffer.floatChannelData else { return }
        let n = Int(buffer.frameLength)
        guard n > 0 else { return }
        let sr = buffer.format.sampleRate
        guard sr > 0 else { return }
        if sr != sampleRate {
            // The named scar: band edges are Hz, bins are sampleRate-relative.
            // Recompute on the REAL rate, never assume 44.1 or 48.
            reconfigure(for: sr)
        }

        let t = when.isHostTimeValid
            ? AVAudioTime.seconds(forHostTime: when.hostTime)
            : AVAudioTime.seconds(forHostTime: mach_absolute_time())
        let dt = lastIngestT > 0 ? min(max(t - lastIngestT, 0.001), 0.5) : Double(n) / sr
        lastIngestT = t

        // Mono fold into the FFT ring; decimated copies feed the SCOPE ring.
        let c0 = chans[0]
        let c1 = buffer.format.channelCount > 1 ? chans[1] : chans[0]
        let stride = max(1, n / Self.waveN)
        var wi = waveIdx
        var mi = monoIdx
        for i in 0..<n {
            let m = (c0[i] + c1[i]) * 0.5
            monoRing[mi & (Self.monoRingN - 1)] = m
            mi += 1
            if i % stride == 0 {
                workWave[wi & (Self.waveN - 1)] = max(-1, min(1, m))
                wi += 1
            }
        }
        monoIdx = mi
        waveIdx = wi
        guard monoIdx >= Self.fftN else { return }

        // Latest 2048 samples out of the ring, Hann-windowed, real FFT.
        let start = monoIdx - Self.fftN
        for i in 0..<Self.fftN {
            fftIn[i] = monoRing[(start + i) & (Self.monoRingN - 1)]
        }
        vDSP_vmul(fftIn, 1, window, 1, windowed, 1, vDSP_Length(Self.fftN))
        var split = DSPSplitComplex(realp: realp, imagp: imagp)
        windowed.withMemoryRebound(to: DSPComplex.self, capacity: Self.halfN) { cp in
            vDSP_ctoz(cp, 2, &split, 1, vDSP_Length(Self.halfN))
        }
        vDSP_fft_zrip(setup, &split, 1, Self.log2n, FFTDirection(FFT_FORWARD))
        imagp[0] = 0 // Nyquist rides in imag[0]; keep it out of bin 0's magnitude
        vDSP_zvabs(&split, 1, mag, 1, vDSP_Length(Self.halfN))
        // zrip doubles the mathematical DFT and WebAudio divides by fftSize;
        // Hann loss roughly stands in for the web's uncompensated Blackman.
        var scale = Float(1.0 / 4096.0)
        vDSP_vsmul(mag, 1, &scale, mag, 1, vDSP_Length(Self.halfN))

        // The 0.72 smoothing lives on LINEAR magnitudes, exactly like the
        // AnalyserNode it impersonates.
        var kOld: Float = 0.72
        var kNew: Float = 0.28
        vDSP_vsmul(smooth, 1, &kOld, smooth, 1, vDSP_Length(Self.halfN))
        vDSP_vsma(mag, 1, &kNew, smooth, 1, smooth, 1, vDSP_Length(Self.halfN))

        // dB-normalize into the byte domain the web's thresholds were tuned in.
        var eps: Float = 1e-9
        vDSP_vsadd(smooth, 1, &eps, scratch, 1, vDSP_Length(Self.halfN))
        var ref: Float = 1
        vDSP_vdbcon(scratch, 1, &ref, scratch, 1, vDSP_Length(Self.halfN), 1)
        var slope = Float(255) / Self.dbSpan
        var offset = -Self.minDB * Float(255) / Self.dbSpan
        vDSP_vsmsa(scratch, 1, &slope, &offset, scratch, 1, vDSP_Length(Self.halfN))
        var lo: Float = 0
        var hi: Float = 255
        vDSP_vclip(scratch, 1, &lo, &hi, normByte, 1, vDSP_Length(Self.halfN))

        // Band means (0..1) with their per-band time constants.
        let bass = bandMean(bassLo, bassHi)
        let mid = bandMean(midLo, midHi)
        let treb = bandMean(trebLo, trebHi)
        let kBM = Float(1 - exp(-dt / 0.06))
        let kT = Float(1 - exp(-dt / 0.08))
        bassS += (bass - bassS) * kBM
        midS += (mid - midS) * kBM
        trebS += (treb - trebS) * kT
        energyS = min(max(bassS * 1.25 + midS + trebS * 0.8, 0), 2) / 2
        calmS += ((1 - energyS) - calmS) * Float(1 - exp(-dt / 2.5))

        // Spectral flux over its band, tapered toward the top, in byte units
        // so the absolute floor (flux > 60) means what it meant on the web.
        var flux: Float = 0
        let taper = Float(0.7056) / Float(fluxHi)
        for i in fluxLo...fluxHi {
            let d = normByte[i] - prevByte[i]
            if d > 0 { flux += d * (1 - Float(i) * taper) }
        }
        for i in 0..<Self.halfN { prevByte[i] = normByte[i] }

        // Onset: flux above mean + 1.5 sigma of its 90-frame history, past the
        // absolute floor, outside the 160 ms refractory.
        var onset = false
        if fluxCount >= 16 {
            var mean: Float = 0
            for i in 0..<fluxCount { mean += fluxRing[i] }
            mean /= Float(fluxCount)
            var varAcc: Float = 0
            for i in 0..<fluxCount {
                let d = fluxRing[i] - mean
                varAcc += d * d
            }
            let sigma = sqrtf(varAcc / Float(fluxCount))
            if flux > mean + 1.5 * sigma && flux > 60 && (t - lastOnsetT) >= 0.16 {
                onset = true
            }
        }
        fluxRing[fluxIdx % Self.fluxRingN] = flux
        fluxIdx += 1
        fluxCount = min(Self.fluxRingN, fluxCount + 1)

        if onset {
            if lastOnsetT > 0 {
                let ioi = t - lastOnsetT
                if ioi >= 0.25 && ioi <= 2.0 {
                    ioiRing[ioiCount % 8] = ioi
                    ioiCount += 1
                    updateBPMFromIOIs()
                }
                // Fallback phase snaps onsets to integer beats so the beat
                // counter stays coherent between them.
                let spb = 60.0 / Double(max(bpmEst, 30))
                fluxBeatBase = (fluxBeatBase + (t - lastOnsetT) / spb).rounded()
            }
            lastOnsetT = t
        }

        // Spectrum bands computed OUTSIDE the lock (vDSP under a lock is a
        // law violation on the audio thread), then published with the scalars.
        for b in 0..<Self.specBands {
            workSpec[b] = bandMean(specLo[b], specHi[b])
        }

        stateLock.lock()
        pBass = bassS
        pMid = midS
        pTreble = trebS
        pEnergy = energyS
        pCalm = calmS
        pBpm = bpmEst
        pLastOnsetT = lastOnsetT
        pFluxBeatBase = fluxBeatBase
        for b in 0..<Self.specBands { pubSpec[b] = workSpec[b] }
        for i in 0..<Self.waveN {
            // Unrolled oldest-to-newest so readers get a plain array.
            pubWave[i] = workWave[(waveIdx + i) & (Self.waveN - 1)]
        }
        stateLock.unlock()
    }

    // MARK: - Clock

    /// The beat CLOCK truth: playhead + track mix metadata, set by the Player
    /// on every state change. When mix is nil the flux onsets stand in.
    func setClock(playhead: Double, mix: MixInfo?, rate: Double) {
        let now = AVAudioTime.seconds(forHostTime: mach_absolute_time())
        stateLock.lock()
        if let m = mix, m.bpm > 0 {
            clockValid = true
            clockBpm = m.bpm
            clockGrid = m.grid
            clockPhrases = m.phrases > 0 ? m.phrases : 32
        } else {
            clockValid = false
        }
        clockPlayhead = playhead
        clockRate = max(rate, 0)
        clockSetAt = now
        stateLock.unlock()
    }

    // MARK: - Snapshot (render thread)

    /// Thread-safe snapshot for the render loop. Phases and the onset envelope
    /// are extrapolated to NOW so 60 fps readers see motion between the ~10 Hz
    /// ingest frames.
    func currentFrame() -> Frame {
        let now = AVAudioTime.seconds(forHostTime: mach_absolute_time())
        var spectrum = [Float](repeating: 0, count: Self.specBands)
        var waveform = [Float](repeating: 0, count: Self.waveN)

        stateLock.lock()
        let bass = pBass, mid = pMid, treble = pTreble
        let energy = pEnergy, calm = pCalm
        let fluxBpm = pBpm
        let onsetAt = pLastOnsetT
        let beatBase = pFluxBeatBase
        let cValid = clockValid
        let cBpm = clockBpm, cGrid = clockGrid, cPhrases = clockPhrases
        let cPlayhead = clockPlayhead, cRate = clockRate, cSetAt = clockSetAt
        for b in 0..<Self.specBands { spectrum[b] = pubSpec[b] }
        for i in 0..<Self.waveN { waveform[i] = pubWave[i] }
        stateLock.unlock()

        // Snap-and-decay: 1 at the onset instant, e-fold 0.25 s.
        let onsetEnv: Float = onsetAt > 0
            ? Float(exp(-max(0, now - onsetAt) / 0.25))
            : 0

        var beats = 0.0
        var haveBeats = false
        var phrases = 32.0
        var bpmOut = fluxBpm
        if cValid && cBpm > 0 {
            // Grid clock is authoritative: playhead is track time, so the
            // rate cancels out of spb and only extrapolation needs it.
            let playheadNow = cPlayhead + (now - cSetAt) * cRate
            let spb = 60.0 / cBpm
            beats = (playheadNow - cGrid) / spb
            phrases = cPhrases
            haveBeats = true
            bpmOut = Float(cBpm * cRate)
        } else if onsetAt > 0 {
            let spb = 60.0 / Double(max(fluxBpm, 30))
            beats = beatBase + (now - onsetAt) / spb
            haveBeats = true
        }

        let beatPhase: Float = haveBeats ? Float(Self.frac(beats)) : 0
        let barPhase: Float = haveBeats ? Float(Self.frac(beats / 4)) : 0
        let phrasePhase: Float = haveBeats ? Float(Self.frac(beats / max(phrases, 1))) : 0

        return Frame(bass: bass, mid: mid, treble: treble,
                     energy: energy, calm: calm,
                     onsetEnv: onsetEnv,
                     beatPhase: beatPhase, barPhase: barPhase, phrasePhase: phrasePhase,
                     bpm: bpmOut,
                     spectrum: spectrum, waveform: waveform)
    }

    // MARK: - Internals

    private func bandMean(_ lo: Int, _ hi: Int) -> Float {
        var m: Float = 0
        vDSP_meanv(normByte + lo, 1, &m, vDSP_Length(hi - lo + 1))
        return m / 255
    }

    /// Median inter-onset interval -> BPM, octave-folded into [70, 180),
    /// lerped 0.25 toward the running estimate.
    private func updateBPMFromIOIs() {
        let count = min(ioiCount, 8)
        guard count >= 3 else { return }
        for i in 0..<count { ioiScratch[i] = ioiRing[i] }
        // Insertion sort: 8 elements, zero allocation.
        for i in 1..<count {
            let v = ioiScratch[i]
            var j = i - 1
            while j >= 0 && ioiScratch[j] > v {
                ioiScratch[j + 1] = ioiScratch[j]
                j -= 1
            }
            ioiScratch[j + 1] = v
        }
        let median = count % 2 == 1
            ? ioiScratch[count / 2]
            : (ioiScratch[count / 2 - 1] + ioiScratch[count / 2]) * 0.5
        guard median > 0.01 else { return }
        var bpm = 60.0 / median
        while bpm < 70 { bpm *= 2 }
        while bpm >= 180 { bpm /= 2 }
        bpmEst += (Float(bpm) - bpmEst) * 0.25
    }

    /// Fills band-edge bins for the new sample rate and clears everything the
    /// old rate's bins had smoothed into. Writes only preallocated storage.
    private func reconfigure(for sr: Double) {
        sampleRate = sr
        (bassLo, bassHi) = Self.binRange(21, 180, sr: sr)
        (midLo, midHi) = Self.binRange(190, 2000, sr: sr)
        (trebLo, trebHi) = Self.binRange(2020, 9000, sr: sr)
        (fluxLo, fluxHi) = Self.binRange(21, 2740, sr: sr)
        let fLo = 30.0
        let fHi = max(fLo * 2, min(14_000, sr * 0.45))
        for b in 0..<Self.specBands {
            let e0 = fLo * pow(fHi / fLo, Double(b) / Double(Self.specBands))
            let e1 = fLo * pow(fHi / fLo, Double(b + 1) / Double(Self.specBands))
            let (l, h) = Self.binRange(e0, e1, sr: sr)
            specLo[b] = l
            specHi[b] = max(l, h)
        }
        for i in 0..<Self.halfN {
            smooth[i] = 0
            prevByte[i] = 0
        }
        fluxCount = 0
        fluxIdx = 0
    }

    private static func binRange(_ lo: Double, _ hi: Double, sr: Double) -> (Int, Int) {
        let hzPerBin = sr / Double(fftN)
        var l = Int((lo / hzPerBin).rounded(.down))
        var h = Int((hi / hzPerBin).rounded(.up))
        l = max(1, min(l, halfN - 1))
        h = max(l, min(h, halfN - 1))
        return (l, h)
    }

    private static func frac(_ x: Double) -> Double {
        let f = x - floor(x)
        return f < 0 ? f + 1 : f
    }

    private static func alloc(_ n: Int) -> UnsafeMutablePointer<Float> {
        let p = UnsafeMutablePointer<Float>.allocate(capacity: n)
        p.initialize(repeating: 0, count: n)
        return p
    }
}

/// os_unfair_lock behind a stable heap allocation — the struct-copy footgun
/// (a moved lock is undefined behavior) is fenced off here once.
private final class AKUnfairLock {
    private let p: UnsafeMutablePointer<os_unfair_lock_s>
    init() {
        p = UnsafeMutablePointer<os_unfair_lock_s>.allocate(capacity: 1)
        p.initialize(to: os_unfair_lock_s())
    }
    deinit {
        p.deinitialize(count: 1)
        p.deallocate()
    }
    func lock() { os_unfair_lock_lock(p) }
    func unlock() { os_unfair_lock_unlock(p) }
}
