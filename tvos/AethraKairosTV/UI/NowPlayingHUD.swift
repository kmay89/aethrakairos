import SwiftUI
import Combine

/// The zen card: everything the room needs to know, nothing it doesn't.
/// Visibility is handed down by the remote's activity ladder; the deep-zen
/// whisper keeps its own 20-second vigil here, because deep stillness is
/// measured from the moment the card dissolved, not from the last press.
struct NowPlayingHUD: View {
    @ObservedObject var player: Player
    var roomName: String
    var visible: Bool

    @State private var hiddenAt: Date?
    @State private var deepWhisper = false

    // Static so re-renders never restart the vigil clock.
    private static let vigil = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    init(player: Player, roomName: String, visible: Bool) {
        _player = ObservedObject(wrappedValue: player)
        self.roomName = roomName
        self.visible = visible
    }

    var body: some View {
        Color.clear
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
                } else {
                    hiddenAt = Date()
                }
            }
            .onReceive(Self.vigil) { now in
                // Deep zen: whisperDelay seconds of stillness past the card's
                // dissolve leaves only the corner whisper.
                if let start = hiddenAt, !deepWhisper,
                   now.timeIntervalSince(start) >= ZenLaw.whisperDelay {
                    deepWhisper = true
                }
            }
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
                Text(track.title)
                    .font(.system(.title2, design: .serif))
                    .foregroundStyle(Color.akInk)
                    .lineLimit(1)
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

// Identity tokens (DESIGN §2) — the ink, the dim, and the amber axis.
private extension Color {
    static let akInk = Color(red: 233 / 255, green: 237 / 255, blue: 246 / 255)
    static let akDim = Color(red: 154 / 255, green: 165 / 255, blue: 188 / 255)
    static let akAmber = Color(red: 255 / 255, green: 180 / 255, blue: 84 / 255)
}
