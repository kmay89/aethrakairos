import SwiftUI
import Combine

/// The zen card: everything the room needs to know, nothing it doesn't.
/// Visibility is handed down by the remote's activity ladder; the deep-zen
/// whisper keeps its own 20-second vigil here, because deep stillness is
/// measured from the moment the card dissolved, not from the last press.
///
/// The card is joined by the cinematic waveform BLOOM (DESIGN zen choreography):
/// on wake and on every track change the waveform blooms FIRST — 5.2 s, then
/// dissolves — with the card's controls arriving a good beat behind (the 0.64 s
/// card fade). The bloom reads the playing track's env so the room is, once
/// more, lit by the music and not merely themed by it.
struct NowPlayingHUD: View {
    @ObservedObject var player: Player
    // The library is observed for the heart's LIT STATE only — the toggle lives
    // on the remote's long-press (RemoteControls); the HUD takes no press.
    @ObservedObject var library: Library
    var roomName: String
    var visible: Bool

    @State private var hiddenAt: Date?
    @State private var deepWhisper = false

    // The bloom is a transient: a start stamp and a live gate. The gate is torn
    // down by the vigil once the bloom's window (plus a little slack) has passed,
    // so the animation loop never outlives the bloom it drives.
    @State private var bloomStartedAt: Date?
    @State private var bloomActive = false

    // Static so re-renders never restart the vigil clock.
    private static let vigil = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    init(player: Player, library: Library, roomName: String, visible: Bool) {
        _player = ObservedObject(wrappedValue: player)
        _library = ObservedObject(wrappedValue: library)
        self.roomName = roomName
        self.visible = visible
    }

    var body: some View {
        Color.clear
            .overlay { waveformLayer }
            .overlay(alignment: .bottomLeading) {
                card.opacity(visible ? 1 : 0)
                    // Don't let VoiceOver announce a card that has dissolved.
                    .accessibilityHidden(!visible)
            }
            .overlay(alignment: .topTrailing) {
                whisper.opacity(whisperShown ? 1 : 0)
                    .accessibilityHidden(!whisperShown)
            }
            .animation(.easeInOut(duration: 0.64), value: visible)
            .animation(.easeInOut(duration: 0.64), value: deepWhisper)
            // The HUD is light on glass — it never takes a press.
            .allowsHitTesting(false)
            .onChange(of: visible) { _, nowVisible in
                if nowVisible {
                    hiddenAt = nil
                    deepWhisper = false
                    // Wake blooms the waveform first; the card follows behind.
                    startBloom()
                } else {
                    hiddenAt = Date()
                }
            }
            .onChange(of: player.current) { _, _ in
                // A new title deserves the bloom whether or not the ladder has
                // caught up — the two triggers only ever reset the same clock.
                startBloom()
            }
            .onReceive(Self.vigil) { now in
                // Deep zen: whisperDelay seconds of stillness past the card's
                // dissolve leaves only the corner whisper.
                if let start = hiddenAt, !deepWhisper,
                   now.timeIntervalSince(start) >= ZenLaw.whisperDelay {
                    deepWhisper = true
                }
                // Retire the bloom once its window has fully closed, so the
                // TimelineView driving it stops ticking.
                if bloomActive, let start = bloomStartedAt, !ZenWaveform.holdForCamera,
                   now.timeIntervalSince(start) > ZenWaveform.window + 0.25 {
                    bloomActive = false
                    bloomStartedAt = nil
                }
            }
    }

    private func startBloom() {
        guard player.current != nil else { return }
        bloomStartedAt = Date()
        bloomActive = true
    }

    // MARK: - the waveform bloom

    /// The cinematic bloom, full-bleed and centered — band-coloured ribbons
    /// around a still midline. Present only while blooming, so it costs
    /// nothing when the room is at rest.
    @ViewBuilder private var waveformLayer: some View {
        if bloomActive, let track = player.current, let start = bloomStartedAt {
            ZenWaveform(
                track: track,
                position: player.position,
                playing: player.isPlaying,
                startedAt: start,
                accent: accentColor(for: track)
            )
            .id(start)                       // every bloom anchors afresh
            .frame(maxWidth: .infinity)
            .frame(height: 320)
            .frame(maxHeight: .infinity, alignment: .center)
            .allowsHitTesting(false)
        }
    }

    /// The mid band wears the track's key colour — the same accent that lights
    /// every focused control — from the shared colour engine.
    private func accentColor(for track: Track) -> Color {
        let c = Palette.chord(for: track).a
        return Color(red: Double(c.x), green: Double(c.y), blue: Double(c.z))
    }

    // MARK: - the card

    private var card: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Transient status — "materializing…", seam notices — in the
            // technical voice, tinted amber.
            if !player.statusLine.isEmpty {
                Text(player.statusLine)
                    .font(.system(size: 20, design: .monospaced))
                    .foregroundStyle(Color.akAmber.opacity(0.92))
                    .lineLimit(1)
            }
            if let track = player.current {
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text(track.title)
                        .font(.system(.title2, design: .serif))
                        .foregroundStyle(Color.akInk)
                        .lineLimit(1)
                    // The heart shows the current track's standing; a long-press
                    // on the remote is what actually flips it.
                    Image(systemName: library.isHearted(track.id) ? "heart.fill" : "heart")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(library.isHearted(track.id) ? Color.akBeat : Color.akDim)
                        // VoiceOver: the heart is status here (the toggle is a
                        // remote long-press), so it reads as a labelled value.
                        .accessibilityLabel(Text("Favorite"))
                        .accessibilityValue(Text(library.isHearted(track.id) ? "Loved" : "Not loved"))
                }
                Text(track.albumTitle)
                    .font(.footnote)
                    .foregroundStyle(Color.akDim)
                    .lineLimit(1)
                progressSliver(for: track)
            }
        }
        .padding(.leading, 60)
        .padding(.bottom, 48)
        .shadow(color: Color.black.opacity(0.55), radius: 14, y: 2)
    }

    /// A 132 pt sliver, not a scrubber: enough to feel where the ritual is.
    private func progressSliver(for track: Track) -> some View {
        let duration = track.duration ?? 0
        let ratio = duration > 0 ? player.position / duration : 0
        // min/max let a NaN through, and Int() of one (the percent below) traps
        let fraction = ratio.isFinite ? min(max(ratio, 0), 1) : 0
        return ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.white.opacity(0.16))
                .frame(width: 132, height: 3)
            Capsule()
                .fill(Color.akAmber)
                .frame(width: max(3, 132 * CGFloat(fraction)), height: 3)
        }
        .padding(.top, 6)
        // The two capsules are one idea to VoiceOver: how far into the track.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Progress"))
        .accessibilityValue(Text("\(Int((fraction * 100).rounded())) percent"))
    }

    // MARK: - the whisper

    /// The only visible element in deep zen: room name · track title, half-lit.
    private var whisper: some View {
        Text(whisperText)
            .font(.caption2)
            .foregroundStyle(Color.white.opacity(0.5))
            .lineLimit(1)
            .padding(.top, 24)
            .padding(.trailing, 40)
            // In deep zen this is the only thing left on screen; give VoiceOver
            // a natural sentence rather than the dot-joined glyph.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(whisperA11yLabel))
    }

    /// The whisper spoken in full: "Now playing in ROOM: Title".
    private var whisperA11yLabel: String {
        let title = player.current?.title ?? ""
        if !roomName.isEmpty, !title.isEmpty { return "Now playing in \(roomName): \(title)" }
        if !roomName.isEmpty { return "Room \(roomName)" }
        return title
    }

    private var whisperShown: Bool {
        (visible || deepWhisper) && !whisperText.isEmpty
    }

    private var whisperText: String {
        var parts: [String] = []
        if !roomName.isEmpty { parts.append(roomName) }
        if let title = player.current?.title, !title.isEmpty { parts.append(title) }
        return parts.joined(separator: " · ")
    }
}

/// The bloom itself: the track's sound as three mirrored ribbons about a still
/// midline — warm lows in amber nearest the line, key-coloured mids, ice highs
/// at the edge — gliding right to left under a fixed now-line at 42 %, the road
/// ahead dimmer than what has played, both ends fading into the room. With no
/// env the figure is one ribbon hashed from the track key — band-less, but
/// honest and still beautiful.
private struct ZenWaveform: View {
    let track: Track
    let position: Double
    /// Paused music holds the figure still under the now-line.
    let playing: Bool
    let startedAt: Date
    let accent: Color

    // The bloom's whole life, in seconds: a slow rise, a hold, a long dissolve.
    static let window: Double = 5.2
    /// CI camera hook: `--bloom-hold` keeps the bloom at full strength once
    /// risen, so a screenshot of it never races the dissolve.
    static let holdForCamera = ProcessInfo.processInfo.arguments.contains("--bloom-hold")
    private static let fadeIn: Double = 1.0
    private static let fadeOut: Double = 1.9
    /// How much music the strip shows across the screen. Wider is calmer:
    /// the figure glides at (screen width / span) points a second.
    private static let span: Double = 26
    /// The now-line, as a fraction of the width.
    private static let nowAt: CGFloat = 0.42

    /* ONE FIGURE PER BLOOM, GLIDING AT THE SCREEN'S PACE. The strip used to be
       rebuilt from the playhead each time it published (4 Hz), so it jumped a
       quarter-second of music at a time — the jitter at every song change —
       and its 2.4 s life rushed in and out. Now the figure is drawn ONCE,
       covering everything this bloom can show, and only slides: the playhead is
       extrapolated from the moment the bloom anchored, so it moves every frame
       at exactly the music's speed. The published position is only listened to
       for a real jump (a new song, a seek), which re-anchors the figure. */
    @State private var anchorPos: Double?
    @State private var anchorAt = Date()
    /// The detail painting (WaveArt) and the song second its left edge shows.
    /// Until it lands (or for a song whose file never decoded) the env's
    /// ribbons stand in.
    @State private var art: (image: CGImage, from: Double)?
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let ptPerSec = w / CGFloat(Self.span)
            let before = Double(Self.nowAt) * Self.span + 0.5
            // (the camera hook holds the bloom for a long while: it paints more road)
            let after = (1 - Double(Self.nowAt)) * Self.span + Self.window + 0.5 + (Self.holdForCamera ? 60 : 0)
            let anchor = anchorPos ?? position
            TimelineView(.animation) { timeline in
                let now = timeline.date
                let t = now.timeIntervalSince(startedAt)
                let playhead = anchor + (playing ? max(0, now.timeIntervalSince(anchorAt)) : 0)
                // where the figure's first second sits on screen
                let x = w * Self.nowAt - CGFloat(playhead - (anchor - before)) * ptPerSec
                Group {
                    // the painting only while it is the painting of THIS anchor:
                    // after a jump the ribbons stand in until the new one lands
                    if let art, abs(art.from - (anchor - before)) < 0.001 {
                        Image(decorative: art.image, scale: displayScale)
                            .resizable()
                            .frame(width: CGFloat(before + after) * ptPerSec, height: h)
                            .offset(x: w * Self.nowAt - CGFloat(playhead - art.from) * ptPerSec)
                    } else {
                        WaveFigure(track: track, from: anchor - before, to: anchor + after,
                                   ptPerSec: ptPerSec, height: h, accent: accent)
                            .equatable()
                            .frame(width: CGFloat(before + after) * ptPerSec, height: h, alignment: .leading)
                            .offset(x: x)
                    }
                }
                .frame(width: w, height: h, alignment: .leading)
                // fixed to the screen, not the figure: the edges fade into the
                // room, and the road ahead of the now-line is dimmer
                .mask(LinearGradient(stops: [
                    .init(color: .white.opacity(0), location: 0),
                    .init(color: .white.opacity(0.9), location: 0.16),
                    .init(color: .white, location: Self.nowAt - 0.004),
                    .init(color: .white.opacity(0.5), location: Self.nowAt + 0.004),
                    .init(color: .white.opacity(0.42), location: 0.82),
                    .init(color: .white.opacity(0), location: 1),
                ], startPoint: .leading, endPoint: .trailing))
                .overlay(alignment: .leading) { nowLine(height: h).offset(x: w * Self.nowAt - 1) }
                .scaleEffect(x: 1, y: CGFloat(grow(t)), anchor: .center)
                .opacity(envelope(t))
            }
            .task(id: "\(track.id)|\(anchor)|\(Int(w))x\(Int(h))") {
                // the song's detail, read when its deck loaded it: wait for a
                // read still under way, then paint it once, off the main thread
                guard w > 8, h > 8 else { return }
                var detail: WaveDetail?
                // through the bloom's rise and hold (a late painting still
                // glides in before the dissolve); the camera hook waits longer
                let tries = Self.holdForCamera ? 600 : 40
                for _ in 0..<tries {
                    detail = await WaveDetailStore.shared.detail(for: track.id)
                    if detail != nil || Task.isCancelled { break }
                    try? await Task.sleep(nanoseconds: 100_000_000)
                }
                guard let detail, !Task.isCancelled else { return }
                let from = anchor - before
                let image = await WaveArt.render(
                    detail: detail, track: track, from: from, to: anchor + after,
                    width: Int((CGFloat(before + after) * ptPerSec * displayScale).rounded()),
                    height: Int((h * displayScale).rounded()))
                if let image, !Task.isCancelled { art = (image, from) }
            }
        }
        .onAppear {
            anchorPos = position
            anchorAt = Date()
        }
        .onChange(of: position) { _, now in
            // A drift under a second is the clock's own jitter and is ignored;
            // a jump (the new song landing, a seek) re-anchors the figure.
            guard let a = anchorPos else { return }
            let expected = a + (playing ? Date().timeIntervalSince(anchorAt) : 0)
            if abs(now - expected) > 1.0 {
                anchorPos = now
                anchorAt = Date()
            }
        }
        .onChange(of: playing) { _, nowPlaying in
            // a pause or a resume mid-bloom: carry on from where the figure is
            // (it moved until a pause; it stood still until a resume)
            if let a = anchorPos {
                anchorPos = a + (nowPlaying ? 0 : max(0, Date().timeIntervalSince(anchorAt)))
            }
            anchorAt = Date()
        }
    }

    /// The now-line: a hairline of light the music slides under.
    private func nowLine(height: CGFloat) -> some View {
        LinearGradient(colors: [.clear, Color.akInk.opacity(0.7), .clear],
                       startPoint: .top, endPoint: .bottom)
            .frame(width: 2, height: height * 0.9)
            .shadow(color: Color.akIce.opacity(0.8), radius: 8)
    }

    // MARK: bloom envelope

    /// Rise, hold, dissolve — the life of the bloom as an opacity in [0, 1];
    /// zero outside the window so nothing lingers.
    private func envelope(_ t: Double) -> Double {
        if Self.holdForCamera { return t <= 0 ? 0 : smooth(t / Self.fadeIn) }
        if t <= 0 || t >= Self.window { return 0 }
        if t < Self.fadeIn { return smooth(t / Self.fadeIn) }
        if t > Self.window - Self.fadeOut { return smooth((Self.window - t) / Self.fadeOut) }
        return 1
    }

    /// The figure breathes up from a hush to full height, easing out, and
    /// sinks a little as it dissolves.
    private func grow(_ t: Double) -> Double {
        let rise = 1 - pow(1 - min(max(t / 1.4, 0), 1), 3)
        let sink = Self.holdForCamera ? 0 : smooth(max(0, t - (Self.window - Self.fadeOut)) / Self.fadeOut)
        return 0.25 + 0.75 * rise - 0.15 * sink
    }

    private func smooth(_ x: Double) -> Double {
        let c = min(max(x, 0), 1)
        return c * c * (3 - 2 * c)
    }
}

/// The drawn figure for one stretch of a track, from `from` to `to` seconds.
/// Equatable on what it shows, so the glide (an offset per frame) never asks
/// SwiftUI to draw it again.
private struct WaveFigure: View, Equatable {
    let track: Track
    let from: Double
    let to: Double
    let ptPerSec: CGFloat
    let height: CGFloat
    let accent: Color

    static func == (a: WaveFigure, b: WaveFigure) -> Bool {
        a.track.id == b.track.id && a.from == b.from && a.to == b.to
            && a.ptPerSec == b.ptPerSec && a.height == b.height && a.accent == b.accent
    }

    var body: some View {
        Canvas { context, size in
            let figure = layers(size: size)
            // the glow first, drawn once with the figure (the glide only moves
            // the finished picture, so no blur is ever paid per frame)
            context.drawLayer { glow in
                glow.addFilter(.blur(radius: 14))
                glow.opacity = 0.7
                for layer in figure { glow.fill(layer.path, with: .color(layer.color)) }
            }
            for layer in figure { context.fill(layer.path, with: .color(layer.color)) }
        }
        .frame(width: CGFloat(to - from) * ptPerSec, height: height)
    }

    private struct Layer {
        let path: Path
        let color: Color
    }

    /// One sample every 5 pt, joined by curves: the ribbons are smooth at any
    /// distance from the screen.
    private func layers(size: CGSize) -> [Layer] {
        let w = size.width, h = size.height
        guard w > 8, h > 12, ptPerSec > 0 else { return [] }
        let step: CGFloat = 5
        let count = min(Int(w / step) + 1, 2048)          // bounded — never an open loop
        guard count > 2 else { return [] }
        let midY = h * 0.5
        let maxHalf = h * 0.5 * 0.86
        let duration = track.duration ?? 0

        var xs = [CGFloat](), lows = [CGFloat](), mids = [CGFloat](), highs = [CGFloat]()
        xs.reserveCapacity(count); lows.reserveCapacity(count)
        mids.reserveCapacity(count); highs.reserveCapacity(count)
        let seed = Self.hashSeed(track.id)
        for i in 0..<count {
            let x = CGFloat(i) * step
            let t = from + Double(x / ptPerSec)
            var b = 0.0, m = 0.0, tr = 0.0
            if t >= 0, duration <= 0 || t <= duration {
                if let env = track.env {
                    let s = env.sample(at: t)
                    b = s.bass; m = s.mid; tr = s.treble
                } else {
                    let a = Self.pseudoAmp(t, seed)
                    b = a * 0.5; m = a * 0.3; tr = a * 0.2
                }
            }
            func clean(_ v: Double) -> CGFloat { v.isFinite ? CGFloat(min(max(v, 0), 1)) : 0 }
            var lo = clean(b) * maxHalf * 0.5
            var mi = clean(m) * maxHalf * 0.5
            var hi = clean(tr) * maxHalf * 0.5
            // a loud moment saturates inside the strip, never overruns it
            let total = lo + mi + hi
            if total > maxHalf, total > 0 {
                let k = maxHalf / total
                lo *= k; mi *= k; hi *= k
            }
            xs.append(x)
            lows.append(lo)
            mids.append(lo + mi)
            highs.append(lo + mi + hi)
        }
        let zero = [CGFloat](repeating: 0, count: xs.count)
        guard track.env != nil else {
            // no bands measured: one ribbon in the key's colour
            return [Layer(path: ribbon(xs, inner: zero, outer: highs, midY: midY),
                          color: accent.opacity(0.92))]
        }
        return [
            Layer(path: ribbon(xs, inner: mids, outer: highs, midY: midY), color: Color.akIce.opacity(0.85)),
            Layer(path: ribbon(xs, inner: lows, outer: mids, midY: midY), color: accent.opacity(0.92)),
            Layer(path: ribbon(xs, inner: zero, outer: lows, midY: midY), color: Color.akAmber.opacity(0.95)),
        ]
    }

    /// A band between two curves, mirrored above and below the midline.
    private func ribbon(_ xs: [CGFloat], inner: [CGFloat], outer: [CGFloat], midY: CGFloat) -> Path {
        var p = Path()
        for sign in [CGFloat(-1), CGFloat(1)] {
            p.move(to: CGPoint(x: xs[0], y: midY + sign * outer[0]))
            curve(&p, xs, outer, midY: midY, sign: sign, forward: true)
            p.addLine(to: CGPoint(x: xs[xs.count - 1], y: midY + sign * inner[xs.count - 1]))
            curve(&p, xs, inner, midY: midY, sign: sign, forward: false)
            p.closeSubpath()
        }
        return p
    }

    /// Smooth through the samples: a quadratic to each midpoint, with the
    /// sample itself as the control point.
    private func curve(_ p: inout Path, _ xs: [CGFloat], _ ys: [CGFloat],
                       midY: CGFloat, sign: CGFloat, forward: Bool) {
        let n = xs.count
        let idx = forward ? Array(0..<n) : Array((0..<n).reversed())
        for k in 1..<n {
            let a = idx[k - 1], b = idx[k]
            let ctrl = CGPoint(x: xs[a], y: midY + sign * ys[a])
            let mid = CGPoint(x: (xs[a] + xs[b]) / 2, y: midY + sign * (ys[a] + ys[b]) / 2)
            p.addQuadCurve(to: mid, control: ctrl)
        }
        p.addLine(to: CGPoint(x: xs[idx[n - 1]], y: midY + sign * ys[idx[n - 1]]))
    }

    // MARK: env-less fallback

    /// FNV-1a over the track key — a stable seed so the same track always wears
    /// the same figure.
    private static func hashSeed(_ s: String) -> UInt64 {
        var h: UInt64 = 1469598103934665603
        for b in s.utf8 { h = (h ^ UInt64(b)) &* 1099511628211 }
        return h
    }

    /// A calm layered-sine amplitude in [0.12, 1], its frequencies and phases
    /// dealt from the seed — flowing, never flat.
    private static func pseudoAmp(_ t: Double, _ seed: UInt64) -> Double {
        let f1 = 0.55 + Double(seed & 0x3F) / 63.0 * 1.1
        let f2 = 1.30 + Double((seed >> 6) & 0x3F) / 63.0 * 1.8
        let f3 = 2.70 + Double((seed >> 12) & 0x3F) / 63.0 * 3.0
        let p1 = Double((seed >> 18) & 0xFF) / 255.0 * 2 * .pi
        let p2 = Double((seed >> 26) & 0xFF) / 255.0 * 2 * .pi
        let p3 = Double((seed >> 34) & 0xFF) / 255.0 * 2 * .pi
        let a = sin(t * f1 + p1)
        let b = sin(t * f2 + p2)
        let c = sin(t * f3 + p3)
        let raw = a * 0.5 + b * 0.32 + c * 0.18   // in [-1, 1]
        return 0.12 + 0.88 * pow(abs(raw), 0.75)
    }
}

// Identity tokens (DESIGN §2) — the ink, the dim, the two axes, and the beat.
private extension Color {
    static let akInk = Color(red: 233 / 255, green: 237 / 255, blue: 246 / 255)
    static let akDim = Color(red: 154 / 255, green: 165 / 255, blue: 188 / 255)
    static let akAmber = Color(red: 255 / 255, green: 180 / 255, blue: 84 / 255)
    static let akIce = Color(red: 110 / 255, green: 231 / 255, blue: 255 / 255)
    static let akBeat = Color(red: 255 / 255, green: 92 / 255, blue: 135 / 255)
}
