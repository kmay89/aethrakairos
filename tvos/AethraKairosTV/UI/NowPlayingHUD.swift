import SwiftUI
import Combine

/// The zen card: everything the room needs to know, nothing it doesn't.
/// Visibility is handed down by the remote's activity ladder; the deep-zen
/// whisper keeps its own 20-second vigil here, because deep stillness is
/// measured from the moment the card dissolved, not from the last press.
///
/// The card is joined by the cinematic waveform BLOOM (DESIGN zen choreography):
/// on wake and on every track change the waveform blooms FIRST — 2.4 s, then
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
    // down by the vigil once the 2.4 s window (plus a little slack) has passed,
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
            }
            .overlay(alignment: .topTrailing) {
                whisper.opacity(whisperShown ? 1 : 0)
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
                if bloomActive, let start = bloomStartedAt,
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

    /// The cinematic bloom, full-bleed and centered — a strip of band-coloured
    /// bars around a still midline. Present only while blooming, so it costs
    /// nothing when the room is at rest.
    @ViewBuilder private var waveformLayer: some View {
        if bloomActive, let track = player.current, let start = bloomStartedAt {
            ZenWaveform(
                track: track,
                position: player.position,
                startedAt: start,
                accent: accentColor(for: track)
            )
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
        let fraction = duration > 0 ? min(max(player.position / duration, 0), 1) : 0
        return ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.white.opacity(0.16))
                .frame(width: 132, height: 3)
            Capsule()
                .fill(Color.akAmber)
                .frame(width: max(3, 132 * CGFloat(fraction)), height: 3)
        }
        .padding(.top, 6)
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

/// The bloom itself. A SwiftUI Canvas: an 18 s window of the track's env laid
/// out one bar per 2 pt, the playhead pinned at x = 42 % so a little more of
/// what is coming shows than of what is gone. Warm lows in amber, key-coloured
/// mids, ice highs; the played side lit 0.95, the road ahead 0.55. With no env
/// the bars fall back to a single-colour figure hashed from the track key —
/// band-less, but honest and still beautiful.
private struct ZenWaveform: View {
    let track: Track
    let position: Double
    let startedAt: Date
    let accent: Color

    // The bloom's whole life, in seconds.
    static let window: Double = 2.4
    private static let fadeIn: Double = 0.45
    private static let fadeOut: Double = 0.85

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSince(startedAt)
            let op = envelope(t)
            // The bloom grows into place: bars rise from a hush to full height
            // across the fade-in, then hold.
            let grow = 0.55 + 0.45 * smooth(min(max(t, 0) / Self.fadeIn, 1))
            Canvas { context, size in
                guard op > 0.001 else { return }
                draw(&context, size: size, grow: CGFloat(grow))
            }
            .opacity(op)
        }
    }

    // MARK: bloom envelope

    /// Rise, hold, dissolve — the 2.4 s life of the bloom as an opacity in
    /// [0, 1]; zero outside the window so nothing lingers.
    private func envelope(_ t: Double) -> Double {
        if t <= 0 || t >= Self.window { return 0 }
        if t < Self.fadeIn { return smooth(t / Self.fadeIn) }
        if t > Self.window - Self.fadeOut { return smooth((Self.window - t) / Self.fadeOut) }
        return 1
    }

    private func smooth(_ x: Double) -> Double {
        let c = min(max(x, 0), 1)
        return c * c * (3 - 2 * c)
    }

    // MARK: drawing

    private func draw(_ ctx: inout GraphicsContext, size: CGSize, grow: CGFloat) {
        let w = size.width
        let h = size.height
        guard w > 8, h > 12 else { return }

        let midY = h * 0.5
        let step: CGFloat = 2                     // one bar per 2 pt
        let barW: CGFloat = 1.6
        let count = min(Int(w / step), 2048)      // bounded — never an open loop
        guard count > 1 else { return }

        let playheadX = w * 0.42                  // the now-line at 42 %
        let secPerPt = 18.0 / Double(w)           // an 18 s window across the strip
        let maxHalf = h * 0.5 * 0.9
        let duration = track.duration ?? 0

        if let env = track.env {
            // Six figures: three bands × two sides, each filled once.
            var amberPlayed = Path(), midPlayed = Path(), icePlayed = Path()
            var amberAhead = Path(), midAhead = Path(), iceAhead = Path()

            for i in 0..<count {
                let x = (CGFloat(i) + 0.5) * step
                let t = position + Double(x - playheadX) * secPerPt
                if t < 0 { continue }
                if duration > 0, t > duration { continue }

                let s = env.sample(at: t)
                var bassH = CGFloat(min(max(s.bass, 0), 1)) * maxHalf * 0.55
                var midH = CGFloat(min(max(s.mid, 0), 1)) * maxHalf * 0.55
                var trebH = CGFloat(min(max(s.treble, 0), 1)) * maxHalf * 0.55
                // Keep the stack inside the strip — a loud bar saturates, it
                // never overruns the frame (the luminance-governed reflex).
                let total = bassH + midH + trebH
                if total > maxHalf, total > 0 {
                    let k = maxHalf / total
                    bassH *= k; midH *= k; trebH *= k
                }
                bassH *= grow; midH *= grow; trebH *= grow

                let x0 = x - barW / 2
                let d1 = bassH
                let d2 = bassH + midH
                let d3 = bassH + midH + trebH
                if t <= position {
                    addBand(&amberPlayed, x0: x0, barW: barW, midY: midY, inner: 0, outer: d1)
                    addBand(&midPlayed, x0: x0, barW: barW, midY: midY, inner: d1, outer: d2)
                    addBand(&icePlayed, x0: x0, barW: barW, midY: midY, inner: d2, outer: d3)
                } else {
                    addBand(&amberAhead, x0: x0, barW: barW, midY: midY, inner: 0, outer: d1)
                    addBand(&midAhead, x0: x0, barW: barW, midY: midY, inner: d1, outer: d2)
                    addBand(&iceAhead, x0: x0, barW: barW, midY: midY, inner: d2, outer: d3)
                }
            }

            ctx.fill(amberPlayed, with: .color(Color.akAmber.opacity(0.95)))
            ctx.fill(midPlayed, with: .color(accent.opacity(0.95)))
            ctx.fill(icePlayed, with: .color(Color.akIce.opacity(0.95)))
            ctx.fill(amberAhead, with: .color(Color.akAmber.opacity(0.55)))
            ctx.fill(midAhead, with: .color(accent.opacity(0.55)))
            ctx.fill(iceAhead, with: .color(Color.akIce.opacity(0.55)))
        } else {
            // No env: a single-colour figure hashed from the track key.
            let seed = Self.hashSeed(track.id)
            var played = Path()
            var ahead = Path()
            for i in 0..<count {
                let x = (CGFloat(i) + 0.5) * step
                let t = position + Double(x - playheadX) * secPerPt
                if t < 0 { continue }
                if duration > 0, t > duration { continue }
                let amp = CGFloat(Self.pseudoAmp(t, seed))
                let height = amp * maxHalf * grow
                let x0 = x - barW / 2
                if t <= position {
                    addBand(&played, x0: x0, barW: barW, midY: midY, inner: 0, outer: height)
                } else {
                    addBand(&ahead, x0: x0, barW: barW, midY: midY, inner: 0, outer: height)
                }
            }
            ctx.fill(played, with: .color(accent.opacity(0.95)))
            ctx.fill(ahead, with: .color(accent.opacity(0.55)))
        }
    }

    /// One band, mirrored above and below the midline: [inner, outer] are
    /// distances from the centre.
    private func addBand(_ p: inout Path, x0: CGFloat, barW: CGFloat, midY: CGFloat, inner: CGFloat, outer: CGFloat) {
        let height = outer - inner
        guard height > 0.2 else { return }
        p.addRect(CGRect(x: x0, y: midY - outer, width: barW, height: height))
        p.addRect(CGRect(x: x0, y: midY + inner, width: barW, height: height))
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
