import AVFoundation
import CoreGraphics
import CoreImage

/* ================================================================
   THE DETAIL WAVEFORM — the web's 'wave8' read (docs/index.html,
   @wave-start), ported for the TV's song-change bloom.

   The shipped 12 Hz env draws a whole song honestly and cannot draw a
   kick. So the song is read from its own file, off the main thread, the
   moment a deck loads it (the seam's preload is ~90 s before the change,
   so the read is ready long before the bloom asks): folded to mono,
   decimated to ~16 kHz, split the way an ear splits it — below 200 Hz the
   kick and the bass, 200 Hz to 2 kHz the body, above 2 kHz the hats and
   the air — through Linkwitz-Riley crossovers (24 dB an octave), and read
   at 150 columns a second: the whole signal's peak, each band's PEAK (the
   hit) and RMS (the body under it), and the TILT, where the column's energy
   sits between the lows and the highs, which is what colours it, the way
   Serato's three-band read does. Normalised exactly as the web does, so a
   song looks the same on both stages.
   ================================================================ */
struct WaveDetail {
    let hz: Double
    let n: Int
    let dur: Double
    let pk: [Float]
    let loPk: [Float], miPk: [Float], hiPk: [Float]
    let lo: [Float], mi: [Float], hi: [Float]
    let tilt: [Float]

    static let columnsPerSecond: Double = 150
    private static let crossLo: Double = 200, crossHi: Double = 2000
    /// The display lift per band: a hat a tenth of the kick's power still reads.
    private static let bandTilt: [Float] = [1, 1.6, 3]
    /// The body's trailing window and the peak's hold, per band, in ms.
    private static let bodyMs: [Double] = [16, 6, 0]
    private static let holdMs: [Double] = [16, 8, 0]

    struct Column {
        var pk: Float = 0, loPk: Float = 0, miPk: Float = 0, hiPk: Float = 0
        var lo: Float = 0, mi: Float = 0, hi: Float = 0, tilt: Float = 0.5
    }

    /// The song over [t0, t1): peaks by max, bodies by mean, the tilt by the
    /// body-weighted mean (the web's waveRange).
    func range(_ t0: Double, _ t1: Double) -> Column {
        var c = Column()
        guard n > 0, t1 > 0, t0 < dur else { return c }
        var i0 = Int((t0 * hz).rounded(.down)), i1 = Int((t1 * hz).rounded(.up))
        i0 = max(0, i0); i1 = min(n, i1)
        if i1 <= i0 { i1 = min(n, i0 + 1) }
        guard i0 < i1 else { return c }
        var ls: Float = 0, ms: Float = 0, hs: Float = 0, ts: Float = 0, tw: Float = 0
        for i in i0..<i1 {
            c.pk = max(c.pk, pk[i])
            c.loPk = max(c.loPk, loPk[i]); c.miPk = max(c.miPk, miPk[i]); c.hiPk = max(c.hiPk, hiPk[i])
            let w = lo[i] + mi[i] + hi[i]
            ls += lo[i]; ms += mi[i]; hs += hi[i]; ts += tilt[i] * w; tw += w
        }
        let cnt = Float(i1 - i0)
        c.lo = ls / cnt; c.mi = ms / cnt; c.hi = hs / cnt
        c.tilt = tw > 0 ? ts / tw : 0.5
        return c
    }

    // MARK: the read

    /// Reads a whole file. Pure CPU work for a background queue; nil when the
    /// file will not decode.
    static func read(url: URL) -> WaveDetail? {
        guard let file = try? AVAudioFile(forReading: url) else { return nil }
        let format = file.processingFormat
        let sr = format.sampleRate
        let channels = Int(format.channelCount)
        guard sr > 0, channels > 0, file.length > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 65_536) else { return nil }

        let decim = max(1, Int((sr / 16_000).rounded()))
        let sr2 = sr / Double(decim)
        let hz = columnsPerSecond
        let total = Int(file.length) / decim
        let n = max(1, Int((Double(total) * hz / sr2).rounded(.up)))
        guard n < 600_000 else { return nil }                    // ~66 min at 150 Hz: bounded

        var pk = [Float](repeating: 0, count: n)
        var bp = [[Float]](repeating: [Float](repeating: 0, count: n), count: 3)
        var bs = [[Float]](repeating: [Float](repeating: 0, count: n), count: 3)

        // the crossovers: low LP·LP, mid HP·HP·LP·LP, high HP·HP
        let lpLo = Biquad(lowpass: true, f: crossLo, sr: sr2), hpLo = Biquad(lowpass: false, f: crossLo, sr: sr2)
        let lpHi = Biquad(lowpass: true, f: crossHi, sr: sr2), hpHi = Biquad(lowpass: false, f: crossHi, sr: sr2)
        var low = [lpLo, lpLo], mid = [hpLo, hpLo, lpHi, lpHi], high = [hpHi, hpHi]

        var col = 0
        var end = min(total, Int((sr2 / hz).rounded()))
        var count = 0, sampleIndex = 0
        var mx: Float = 0, p0: Float = 0, p1: Float = 0, p2: Float = 0
        var s0: Float = 0, s1: Float = 0, s2: Float = 0
        var acc: Float = 0, accN = 0

        reading: while true {
            buffer.frameLength = 0
            var readError: Error?
            let ok = AKCatchException {
                do { try file.read(into: buffer) } catch { readError = error }
            } == nil
            guard ok, readError == nil else { break }
            let frames = Int(buffer.frameLength)
            if frames == 0 { break }
            guard let data = buffer.floatChannelData else { break }
            let l = data[0], r = channels > 1 ? data[1] : data[0]
            for f in 0..<frames {
                var x = (l[f] + r[f]) * 0.5
                if !x.isFinite { x = 0 }
                acc += x; accN += 1
                if accN < decim { continue }
                let s = acc / Float(accN)
                acc = 0; accN = 0
                let a = run(&low, s), b = run(&mid, s), c = run(&high, s)
                mx = max(mx, abs(s))
                p0 = max(p0, abs(a)); p1 = max(p1, abs(b)); p2 = max(p2, abs(c))
                s0 += a * a; s1 += b * b; s2 += c * c
                count += 1; sampleIndex += 1
                if sampleIndex >= end {
                    if col < n {
                        pk[col] = mx
                        bp[0][col] = p0; bp[1][col] = p1; bp[2][col] = p2
                        let k = Float(max(count, 1))
                        bs[0][col] = s0 / k; bs[1][col] = s1 / k; bs[2][col] = s2 / k
                    }
                    col += 1
                    if col >= n { break reading }
                    end = min(total, Int((Double(col + 1) * sr2 / hz).rounded()))
                    count = 0; mx = 0; p0 = 0; p1 = 0; p2 = 0; s0 = 0; s1 = 0; s2 = 0
                }
            }
        }
        guard col > 0 else { return nil }

        // the bodies through their windows (then the root: power to RMS), the
        // peaks held — so a cap is a line and not a saw
        trailMax(&pk, win: Int((holdMs[0] * hz / 1000).rounded()))
        for b in 0..<3 {
            trailMean(&bs[b], win: Int((bodyMs[b] * hz / 1000).rounded()))
            trailMax(&bp[b], win: Int((holdMs[b] * hz / 1000).rounded()))
            for i in 0..<n { bs[b][i] = bs[b][i] > 0 ? bs[b][i].squareRoot() : 0 }
        }
        // one reference for the three bands, so they stay comparable; the caps
        // against that bar times √2, so a held tone's cap meets its body and a
        // hit's stands clear of it by its crest
        let ref = max(pct(bs[0]) * bandTilt[0], pct(bs[1]) * bandTilt[1], pct(bs[2]) * bandTilt[2], 1e-6)
        let refC = ref * Float(2).squareRoot()
        let refPk = max(pct(pk), 1e-6)
        let lo = norm(bs[0], ref / bandTilt[0], 0.8)
        let mi = norm(bs[1], ref / bandTilt[1], 0.8)
        let hi = norm(bs[2], ref / bandTilt[2], 0.8)
        var tilt = [Float](repeating: 0.5, count: n)
        for i in 0..<n {
            let s = lo[i] + mi[i] + hi[i]
            tilt[i] = s > 1e-6 ? (2 * hi[i] + mi[i]) / s * 0.5 : 0.5
        }
        return WaveDetail(hz: hz, n: n, dur: Double(total) / sr2,
                          pk: norm(pk, refPk, 1),
                          loPk: norm(bp[0], refC / bandTilt[0], 0.8),
                          miPk: norm(bp[1], refC / bandTilt[1], 0.8),
                          hiPk: norm(bp[2], refC / bandTilt[2], 0.8),
                          lo: lo, mi: mi, hi: hi, tilt: tilt)
    }

    /// A second-order Butterworth section (RBJ), with its own state.
    private struct Biquad {
        var b0: Float, b1: Float, b2: Float, a1: Float, a2: Float
        var x1: Float = 0, x2: Float = 0, y1: Float = 0, y2: Float = 0

        init(lowpass: Bool, f: Double, sr: Double) {
            let w = 2 * Double.pi * f / sr, c = cos(w), al = sin(w) / 2.0.squareRoot(), a0 = 1 + al
            let b0d = (lowpass ? (1 - c) / 2 : (1 + c) / 2) / a0
            b0 = Float(b0d); b2 = Float(b0d)
            b1 = Float((lowpass ? 1 - c : -(1 + c)) / a0)
            a1 = Float(-2 * c / a0); a2 = Float((1 - al) / a0)
        }

        mutating func step(_ x: Float) -> Float {
            let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1; x1 = x; y2 = y1; y1 = y.isFinite ? y : 0
            return y1
        }
    }

    private static func run(_ chain: inout [Biquad], _ x: Float) -> Float {
        var y = x
        for k in chain.indices { y = chain[k].step(y) }
        return y
    }

    private static func trailMean(_ v: inout [Float], win: Int) {
        guard win > 1, v.count > 1 else { return }
        var ring = [Float](repeating: 0, count: win)
        var sum: Float = 0, cnt = 0
        for i in v.indices {
            let j = i % win
            if cnt < win { cnt += 1 } else { sum -= ring[j] }
            ring[j] = v[i]; sum += v[i]
            v[i] = sum > 0 ? sum / Float(cnt) : 0
        }
    }

    private static func trailMax(_ v: inout [Float], win: Int) {
        guard win > 1, v.count > 1 else { return }
        let o = v
        for i in o.indices {
            var m = o[i]
            for j in max(0, i - win + 1)..<i where o[j] > m { m = o[j] }
            v[i] = m
        }
    }

    /// The 99.5th percentile: one stray spike must not flatten the song.
    private static func pct(_ v: [Float]) -> Float {
        guard !v.isEmpty else { return 0 }
        let s = v.sorted()
        return s[min(s.count - 1, Int(Double(s.count) * 0.995))]
    }

    private static func norm(_ v: [Float], _ ref: Float, _ gamma: Float) -> [Float] {
        let r = max(1e-6, ref)
        return v.map { x in
            let y = x / r
            return y > 1 ? 1 : (y > 0 ? (gamma == 1 ? y : pow(y, gamma)) : 0)
        }
    }
}

// MARK: - the store

/// The reads, one per song, a few songs deep. A deck load asks for one
/// (prepare); the bloom waits for it (detail).
actor WaveDetailStore {
    static let shared = WaveDetailStore()

    private var done: [String: WaveDetail] = [:]
    private var order: [String] = []
    private var running: [String: Task<WaveDetail?, Never>] = [:]
    private static let keep = 6

    nonisolated func prepare(id: String, url: URL) {
        Task { await self.start(id: id, url: url) }
    }

    private func start(id: String, url: URL) {
        guard done[id] == nil, running[id] == nil else { return }
        running[id] = Task.detached(priority: .utility) {
            let t0 = Date()
            let d = WaveDetail.read(url: url)
            NSLog("AethraKairos: wave detail %@ — %d columns in %.0f ms",
                  d == nil ? "FAILED" : "read", d?.n ?? 0, Date().timeIntervalSince(t0) * 1000)
            return d
        }
    }

    /// The song's read, waiting for one under way; nil when none was asked for
    /// or the file would not decode.
    func detail(for id: String) async -> WaveDetail? {
        if let d = done[id] { return d }
        guard let task = running[id] else { return nil }
        let d = await task.value
        running[id] = nil
        if let d {
            done[id] = d
            order.removeAll { $0 == id }
            order.append(id)
            while order.count > Self.keep { done[order.removeFirst()] = nil }
        }
        return d
    }
}

// MARK: - the painting

/* THE PAINTING, the web's deck tile ported (DECKWAVE._tile): per pixel
   column, the whole signal's outline in the colour of the column's tilt (the
   aura everything sits in), the three bands' BODIES (lows full, mids at 0.82,
   highs at 0.62 — the lows in front of the mids, so a kick stays readable
   under a wall of pad), each band's PEAK as a one-pixel cap over its body (a
   hit is a spike, a tone a plateau), and a HALO where a band's peak jumps
   clear of its body. The bodies are each one vertical gradient (the band's
   colour at the centre line, a shade darker at the edges). Over that, the
   bar lines of the song's own grid, and under it all the same picture
   blurred into a neon glow. Painted ONCE per bloom, off the main thread. */
enum WaveArt {
    struct Palette3 {
        let lut: [SIMD3<Float>]                 // 33 steps of tilt
        let lo, mi, hi, loE, miE, hiE, loC, miC, hiC: SIMD3<Float>
    }

    /// The band colours off the key's hue (the web's waveBandColours): the
    /// lows dark and warm fifty degrees down the wheel, the body the key
    /// itself, the highs airy and near-white forty degrees up.
    static func palette(for track: Track) -> Palette3 {
        let h = Palette.camelotHue(track.mix?.key) ?? 200
        let lo = Palette.Stop(l: 0.56, c: 0.17, h: (h + 310).truncatingRemainder(dividingBy: 360))
        let mi = Palette.Stop(l: 0.72, c: 0.13, h: h)
        let hi = Palette.Stop(l: 0.93, c: 0.04, h: (h + 40).truncatingRemainder(dividingBy: 360))
        func rgb(_ s: Palette.Stop, _ dl: Double = 0) -> SIMD3<Float> {
            Palette.oklchToRGB(l: Palette.lClamp(s.l + dl), c: s.c, h: s.h)
        }
        var lut: [SIMD3<Float>] = []
        for i in 0..<33 {
            let t = Double(i) / 32
            let s = t < 0.5 ? Palette.lerp(lo, mi, t * 2) : Palette.lerp(mi, hi, (t - 0.5) * 2)
            lut.append(rgb(s))
        }
        return Palette3(lut: lut, lo: rgb(lo), mi: rgb(mi), hi: rgb(hi),
                        loE: rgb(lo, -0.15), miE: rgb(mi, -0.15), hiE: rgb(hi, -0.15),
                        loC: rgb(lo, 0.14), miC: rgb(mi, 0.12), hiC: rgb(hi, 0.03))
    }

    private static let ci = CIContext(options: [.cacheIntermediates: false])

    /// The song over [from, to] seconds as an image `width` x `height` pixels.
    static func render(detail d: WaveDetail, track: Track, from: Double, to: Double,
                       width: Int, height: Int) async -> CGImage? {
        await Task.detached(priority: .userInitiated) {
            let t0 = Date()
            let image = WaveArt.paint(detail: d, track: track, from: from, to: to, width: width, height: height)
            NSLog("AethraKairos: bloom painted %dx%d in %.0f ms", width, height, Date().timeIntervalSince(t0) * 1000)
            return image
        }.value
    }

    private static func paint(detail d: WaveDetail, track: Track, from: Double, to: Double,
                              width W: Int, height H: Int) -> CGImage? {
        guard W > 8, H > 8, W <= 16_384, H <= 4_096, to > from else { return nil }
        let space = CGColorSpaceCreateDeviceRGB()
        guard let c = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                                space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return nil }
        let pal = palette(for: track)
        func color(_ v: SIMD3<Float>, _ a: CGFloat) -> CGColor {
            CGColor(red: CGFloat(v.x), green: CGFloat(v.y), blue: CGFloat(v.z), alpha: a)
        }
        let mid = CGFloat(H) / 2, amp = CGFloat(H) * 0.46
        let dt = (to - from) / Double(W)
        let N = pal.lut.count
        var aura = [CGMutablePath](repeating: CGMutablePath(), count: N)
        for j in 0..<N { aura[j] = CGMutablePath() }
        let lo = CGMutablePath(), mi = CGMutablePath(), hi = CGMutablePath()
        let loC = CGMutablePath(), miC = CGMutablePath(), hiC = CGMutablePath()
        let halo = CGMutablePath()
        var prev = (Float(0), Float(0), Float(0))
        let scale: [CGFloat] = [1, 0.82, 0.62]
        for x in 0..<W {
            let t = from + Double(x) * dt
            guard t >= 0, t < d.dur else { prev = (0, 0, 0); continue }
            let r = d.range(t, t + dt)
            let xf = CGFloat(x)
            let hp = CGFloat(r.pk) * amp
            if hp > 0.4 {
                let j = min(N - 1, max(0, Int((r.tilt * Float(N - 1)).rounded())))
                aura[j].addRect(CGRect(x: xf, y: mid - hp, width: 1, height: hp * 2))
            }
            let hl = CGFloat(r.lo) * amp, hm = CGFloat(r.mi) * amp * scale[1], hh = CGFloat(r.hi) * amp * scale[2]
            if hl > 0.4 { lo.addRect(CGRect(x: xf, y: mid - hl, width: 1, height: hl * 2)) }
            if hm > 0.4 { mi.addRect(CGRect(x: xf, y: mid - hm, width: 1, height: hm * 2)) }
            if hh > 0.4 { hi.addRect(CGRect(x: xf, y: mid - hh, width: 1, height: hh * 2)) }
            let cl = CGFloat(r.loPk) * amp, cm = CGFloat(r.miPk) * amp * scale[1], ch = CGFloat(r.hiPk) * amp * scale[2]
            for (cap, bodyH, path) in [(cl, hl, loC), (cm, hm, miC), (ch, hh, hiC)] where cap > bodyH + 0.6 {
                path.addRect(CGRect(x: xf, y: mid - cap, width: 1, height: 1.5))
                path.addRect(CGRect(x: xf, y: mid + cap - 1.5, width: 1, height: 1.5))
            }
            // an onset: a band's peak clear of its body and rising (the web's waveOnsets)
            let peaks = (r.loPk, r.miPk, r.hiPk), bodies = (r.lo, r.mi, r.hi)
            for (p, b, q, cap) in [(peaks.0, bodies.0, prev.0, cl), (peaks.1, bodies.1, prev.1, cm),
                                   (peaks.2, bodies.2, prev.2, ch)]
            where p > 0.06 && p > 1.35 * b && p > q + Float(8.0 / 255.0) && cap > 1 {
                halo.addRect(CGRect(x: xf - 1, y: mid - cap, width: 3, height: cap * 2))
            }
            prev = (r.loPk, r.miPk, r.hiPk)
        }

        // the aura, one fill per tilt step
        for j in 0..<N where !aura[j].isEmpty {
            c.setFillColor(color(pal.lut[j], 0.16))
            c.addPath(aura[j]); c.fillPath()
        }
        // the bodies: the band's colour at the centre line, darker at the edges;
        // the body behind, the kick in front of it, the hats brightest on top
        func paintBody(_ path: CGPath, _ core: SIMD3<Float>, _ edge: SIMD3<Float>, _ a: CGFloat) {
            guard !path.isEmpty,
                  let g = CGGradient(colorsSpace: space,
                                     colors: [color(edge, a), color(core, a), color(edge, a)] as CFArray,
                                     locations: [0, 0.5, 1]) else { return }
            c.saveGState()
            c.addPath(path); c.clip()
            c.drawLinearGradient(g, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 0, y: CGFloat(H)), options: [])
            c.restoreGState()
        }
        paintBody(mi, pal.mi, pal.miE, 0.82)
        paintBody(lo, pal.lo, pal.loE, 0.95)
        paintBody(hi, pal.hi, pal.hiE, 0.95)
        c.setAlpha(0.6)
        for (path, col) in [(miC, pal.miC), (loC, pal.loC), (hiC, pal.hiC)] where !path.isEmpty {
            c.setFillColor(color(col, 1)); c.addPath(path); c.fillPath()
        }
        if !halo.isEmpty {
            c.setAlpha(0.22)
            c.setFillColor(color(pal.hi, 1)); c.addPath(halo); c.fillPath()
        }
        c.setAlpha(1)

        // the song's own grid: a faint line at every bar, a tick at every beat
        if let m = track.mix, m.bpm > 0, m.grid.isFinite {
            let spb = 60 / m.bpm
            var k = Int(((from - m.grid) / spb).rounded(.up))
            for _ in 0..<2048 {
                let t = m.grid + Double(k) * spb
                if t > to { break }
                let x = CGFloat((t - from) / dt)
                if t >= 0, t < d.dur {
                    let bar = ((k % 4) + 4) % 4 == 0
                    c.setFillColor(color(pal.hi, bar ? 0.10 : 0.0))
                    if bar { c.fill(CGRect(x: x, y: 0, width: 1, height: CGFloat(H))) }
                    c.setFillColor(color(pal.hi, bar ? 0.55 : 0.28))
                    let tick = CGFloat(bar ? 9 : 5)
                    c.fill(CGRect(x: x, y: 0, width: 1, height: tick))
                    c.fill(CGRect(x: x, y: CGFloat(H) - tick, width: 1, height: tick))
                }
                k += 1
            }
        }
        guard let sharp = c.makeImage() else { return nil }

        // the glow: the same picture blurred and laid underneath, once
        let src = CIImage(cgImage: sharp)
        let blurred = src.clampedToExtent()
            .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 14])
            .cropped(to: src.extent)
        guard let glow = ci.createCGImage(blurred, from: src.extent),
              let out = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return sharp }
        let rect = CGRect(x: 0, y: 0, width: W, height: H)
        out.setAlpha(0.85)
        out.setBlendMode(.plusLighter)
        out.draw(glow, in: rect)
        out.setBlendMode(.normal)
        out.setAlpha(1)
        out.draw(sharp, in: rect)
        return out.makeImage() ?? sharp
    }
}
