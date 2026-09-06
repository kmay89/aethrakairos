import AVFoundation

/// The two-deck graph: per deck AVAudioPlayerNode -> AVAudioUnitTimePitch (key-
/// locked tempo) -> AVAudioUnitEQ (band 0: lowShelf 200 Hz for the one-bass
/// rule; band 1: lowPass sweepable 20k->300 for filtered fades) -> deck mixer
/// -> mainMixer. All gain moves are RAMPED (>= 5 ms; equal-power curves for
/// seams), never stepped. Ramps run on a 90 Hz timer stepping mixer volume.
final class DeckEngine {

    let engine: AVAudioEngine

    // The floor of every ramp: a gain move shorter than 5 ms is a click with
    // aspirations. Stepping at 90 Hz keeps zipper noise below audibility.
    private static let minRampSeconds = 0.005
    private static let filterOpenHz: Float = 20_000
    private static let filterFloorHz: Float = 40 // absolute floor; the fade law stops at 300

    private let decks: [AKDeck]
    private let rampQueue = DispatchQueue(label: "aethra.deck.ramps", qos: .userInteractive)
    private var tapInstalled = false

    private enum DeckError: Error { case badIndex, badFile }

    init() {
        engine = AVAudioEngine()
        decks = [AKDeck(rampQueue: rampQueue), AKDeck(rampQueue: rampQueue)]
        let defaultFormat = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 2)
        for d in decks {
            engine.attach(d.player)
            engine.attach(d.timePitch)
            engine.attach(d.eq)
            engine.attach(d.mixer)

            // Band 0 is the bass-swap shelf (one bassline at a time).
            let shelf = d.eq.bands[0]
            shelf.filterType = .lowShelf
            shelf.frequency = 200
            shelf.gain = 0
            shelf.bypass = false
            // Band 1 is the fade filter: wide open until a seam borrows it.
            let lp = d.eq.bands[1]
            lp.filterType = .resonantLowPass
            lp.frequency = Self.filterOpenHz
            lp.bandwidth = 1.9 // ~Q 0.7, the web player's fade-filter slope
            lp.bypass = false
            d.eq.globalGain = 0

            engine.connect(d.player, to: d.timePitch, format: defaultFormat)
            engine.connect(d.timePitch, to: d.eq, format: defaultFormat)
            engine.connect(d.eq, to: d.mixer, format: defaultFormat)
            engine.connect(d.mixer, to: engine.mainMixerNode, format: nil)
            d.connectedFormat = defaultFormat
            d.mixer.outputVolume = 1
        }
        engine.prepare()
    }

    func startEngineIfNeeded() throws {
        if !engine.isRunning {
            try engine.start()
        }
    }

    // MARK: - Transport (deck indices 0/1)

    /// Opens the file and rewires the deck chain to its native format so the
    /// player never resamples behind our back. Returns the duration in seconds.
    func load(deck i: Int, fileURL: URL) throws -> Double {
        guard let d = deck(i) else { throw DeckError.badIndex }
        let file = try AVAudioFile(forReading: fileURL)
        let fmt = file.processingFormat
        guard fmt.sampleRate > 0, file.length > 0 else { throw DeckError.badFile }

        d.player.stop()
        let matches = d.connectedFormat.map {
            $0.sampleRate == fmt.sampleRate && $0.channelCount == fmt.channelCount
        } ?? false
        if !matches {
            engine.disconnectNodeOutput(d.player)
            engine.disconnectNodeOutput(d.timePitch)
            engine.disconnectNodeOutput(d.eq)
            engine.connect(d.player, to: d.timePitch, format: fmt)
            engine.connect(d.timePitch, to: d.eq, format: fmt)
            engine.connect(d.eq, to: d.mixer, format: fmt)
            d.connectedFormat = fmt
        }
        d.file = file
        d.segmentBase = 0
        d.lastKnownPosition = nil
        return Double(file.length) / fmt.sampleRate
    }

    /// Start playback at `offset` seconds, `when` seconds from now on the
    /// engine render clock (0 = now). A fresh segment is always scheduled —
    /// the player node's own clock then makes the start sample-accurate,
    /// which is why the seam machinery upstream can be so much simpler than
    /// the web's.
    func play(deck i: Int, atOffset offset: Double, in when: Double) {
        guard let d = deck(i), let file = d.file else { return }
        try? startEngineIfNeeded()
        let sr = file.processingFormat.sampleRate
        guard sr > 0 else { return }
        let startFrame = AVAudioFramePosition(max(0, offset) * sr)
        guard startFrame < file.length else { return }
        let count = AVAudioFrameCount(file.length - startFrame)

        d.player.stop()
        d.player.scheduleSegment(file, startingFrame: startFrame, frameCount: count, at: nil,
                                 completionHandler: nil)
        d.segmentBase = Double(startFrame) / sr
        d.lastKnownPosition = d.segmentBase

        if when > 0 {
            // Delayed starts live on the render clock so both decks share one
            // origin; host time is the fallback before the first render.
            if let rt = d.player.lastRenderTime, rt.isSampleTimeValid {
                let rsr = rt.sampleRate > 0 ? rt.sampleRate : sr
                let at = AVAudioTime(sampleTime: rt.sampleTime + AVAudioFramePosition(when * rsr), atRate: rsr)
                d.player.play(at: at)
            } else {
                let at = AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: when))
                d.player.play(at: at)
            }
        } else {
            d.player.play()
        }
    }

    func pause(deck i: Int) {
        guard let d = deck(i) else { return }
        // Player time freezes under pause, so the position is captured NOW —
        // it is the only truth a resume or a transport save can use.
        if let pos = livePosition(of: d) {
            d.lastKnownPosition = pos
        }
        d.player.pause()
    }

    func stop(deck i: Int) {
        guard let d = deck(i) else { return }
        d.player.stop()
        d.lastKnownPosition = nil
        d.segmentBase = 0
    }

    func isPlaying(deck i: Int) -> Bool {
        guard let d = deck(i) else { return false }
        return d.player.isPlaying
    }

    /// Playhead in seconds within the loaded file, nil before first play.
    /// playerTime counts samples the player has rendered since its last start,
    /// so the scheduled segment offset is ours to carry.
    func position(deck i: Int) -> Double? {
        guard let d = deck(i) else { return nil }
        if let pos = livePosition(of: d) { return pos }
        return d.lastKnownPosition
    }

    private func livePosition(of d: AKDeck) -> Double? {
        guard let file = d.file,
              d.player.isPlaying,
              let nodeTime = d.player.lastRenderTime,
              let pt = d.player.playerTime(forNodeTime: nodeTime),
              pt.sampleRate > 0 else { return nil }
        // Before a delayed start lands, player time reads negative: clamp —
        // the deck is sitting at its scheduled offset, not before it.
        let elapsed = max(0, Double(pt.sampleTime) / pt.sampleRate)
        let duration = Double(file.length) / file.processingFormat.sampleRate
        return min(d.segmentBase + elapsed, duration)
    }

    // MARK: - DSP

    func setRate(deck i: Int, rate: Float) {
        guard let d = deck(i) else { return }
        d.timePitch.rate = max(0.03125, min(32, rate))
    }

    /// Loudness factor toward -14 LUFS. It sits UNDER every ramp: the curve
    /// is in v-space, norm scales the result, so changing norm never bends a
    /// seam's shape.
    func setNorm(deck i: Int, _ norm: Float) {
        guard let d = deck(i) else { return }
        let n = max(0, norm)
        rampQueue.async {
            d.norm = n
            d.mixer.outputVolume = sinf(d.volumeRamp.value * .pi / 2) * n
        }
    }

    /// v in 0...1 on the equal-power law: gain = sin(v * .pi/2) * norm.
    /// Two decks running complementary v ramps sum to constant power — the
    /// law everywhere two signals meet.
    func rampVolume(deck i: Int, to v: Float, over seconds: Double) {
        guard let d = deck(i) else { return }
        let target = max(0, min(1, v))
        rampQueue.async {
            d.volumeRamp.ramp(to: target, over: max(seconds, Self.minRampSeconds), curve: .linear) { [weak d] val in
                guard let d else { return }
                d.mixer.outputVolume = sinf(val * .pi / 2) * d.norm
            }
        }
    }

    /// The one-bass rule's lever: -14 dB duck during a beatmix, -22 dB on a
    /// filtered fade, 0 dB at rest.
    func setLowShelfGain(deck i: Int, dB: Float, over seconds: Double) {
        guard let d = deck(i) else { return }
        let target = max(-96, min(24, dB))
        rampQueue.async {
            d.shelfRamp.ramp(to: target, over: max(seconds, Self.minRampSeconds), curve: .linear) { [weak d] val in
                d?.eq.bands[0].gain = val
            }
        }
    }

    /// Filter sweeps are exponential in Hz — a linear sweep spends almost all
    /// its time sounding closed. 20k open, 300 floor per the fade law.
    func sweepLowPass(deck i: Int, toHz hz: Float, over seconds: Double) {
        guard let d = deck(i) else { return }
        let target = max(Self.filterFloorHz, min(Self.filterOpenHz, hz))
        rampQueue.async {
            d.filterRamp.ramp(to: target, over: max(seconds, Self.minRampSeconds), curve: .exponential) { [weak d] val in
                d?.eq.bands[1].frequency = val
            }
        }
    }

    /// A seam hands back exactly what it borrowed: rate 1, shelf flat,
    /// filter wide open. Short ramps, because even restitution is ramped.
    func resetDeckDSP(deck i: Int) {
        guard let d = deck(i) else { return }
        d.timePitch.rate = 1
        rampQueue.async {
            d.shelfRamp.ramp(to: 0, over: 0.05, curve: .linear) { [weak d] val in
                d?.eq.bands[0].gain = val
            }
            d.filterRamp.ramp(to: Self.filterOpenHz, over: 0.05, curve: .exponential) { [weak d] val in
                d?.eq.bands[1].frequency = val
            }
        }
    }

    // MARK: - Analysis tap

    /// Installs the analysis tap on mainMixerNode (4096-frame buffers) —
    /// exactly one consumer, so a re-install evicts the previous tap.
    func installTap(_ handler: @escaping (AVAudioPCMBuffer, AVAudioTime) -> Void) {
        let main = engine.mainMixerNode
        if tapInstalled {
            main.removeTap(onBus: 0)
        }
        main.installTap(onBus: 0, bufferSize: 4096, format: nil, block: handler)
        tapInstalled = true
    }

    var outputLatency: TimeInterval {
        AVAudioSession.sharedInstance().outputLatency
    }

    private func deck(_ i: Int) -> AKDeck? {
        guard i >= 0 && i < decks.count else { return nil }
        return decks[i]
    }
}

// MARK: - Deck internals

/// One deck's nodes plus the state its ramps and position math need.
/// Transport fields (file/segmentBase/lastKnownPosition) belong to the caller's
/// thread; ramp fields (norm + the three ramps) are confined to the ramp queue.
private final class AKDeck {
    let player = AVAudioPlayerNode()
    let timePitch = AVAudioUnitTimePitch()
    let eq = AVAudioUnitEQ(numberOfBands: 2)
    let mixer = AVAudioMixerNode()

    var file: AVAudioFile?
    var connectedFormat: AVAudioFormat?
    var segmentBase: Double = 0
    var lastKnownPosition: Double?

    // Ramp-queue-confined.
    var norm: Float = 1
    let volumeRamp: AKParamRamp
    let shelfRamp: AKParamRamp
    let filterRamp: AKParamRamp

    init(rampQueue: DispatchQueue) {
        volumeRamp = AKParamRamp(initial: 1, queue: rampQueue)
        shelfRamp = AKParamRamp(initial: 0, queue: rampQueue)
        filterRamp = AKParamRamp(initial: 20_000, queue: rampQueue)
    }
}

/// One ramped parameter: a 90 Hz DispatchSourceTimer walks the value from
/// where it is to where it is told, linear or exponential, and a new ramp
/// cancels the old one mid-flight — the value never jumps, only the target
/// does. All methods run on the owning queue.
private final class AKParamRamp {
    enum Curve { case linear, exponential }

    private(set) var value: Float
    private let queue: DispatchQueue
    private var timer: DispatchSourceTimer?

    init(initial: Float, queue: DispatchQueue) {
        self.value = initial
        self.queue = queue
    }

    func ramp(to target: Float, over seconds: Double, curve: Curve, apply: @escaping (Float) -> Void) {
        timer?.cancel()
        timer = nil
        let start = value
        let duration = max(seconds, 0.005)
        if abs(target - start) < 1e-6 {
            value = target
            apply(target)
            return
        }
        let t0 = ProcessInfo.processInfo.systemUptime
        let t = DispatchSource.makeTimerSource(queue: queue)
        t.schedule(deadline: .now(), repeating: .nanoseconds(11_111_111), leeway: .milliseconds(2))
        t.setEventHandler { [weak self] in
            guard let self else { return }
            let f = Float(min(1.0, (ProcessInfo.processInfo.systemUptime - t0) / duration))
            let v: Float
            switch curve {
            case .linear:
                v = start + (target - start) * f
            case .exponential:
                // Exponential interpolation needs strictly positive endpoints;
                // gains near zero fall back to the linear floor.
                let s = max(start, 1e-3)
                let g = max(target, 1e-3)
                v = s * powf(g / s, f)
            }
            self.value = v
            apply(v)
            if f >= 1 {
                self.timer?.cancel()
                self.timer = nil
            }
        }
        timer = t
        t.resume()
    }

    deinit {
        timer?.cancel()
    }
}
