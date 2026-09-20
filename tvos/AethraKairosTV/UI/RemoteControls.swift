import SwiftUI
import Combine

/// The zen ladder's timings, in one place. The HUD lives for 3.8 s past the
/// last touch while music plays; a further 20 s of stillness leaves only the
/// corner whisper. Paused music never sleeps the HUD — silence needs a face.
enum ZenLaw {
    static let hudDissolve: TimeInterval = 3.8
    static let whisperDelay: TimeInterval = 20.0

    static func hudVisible(idle: TimeInterval, playing: Bool) -> Bool {
        !playing || idle < hudDissolve
    }
}

/// The Siri Remote grammar, one law per key — and one law above all the
/// others: this layer EXISTS only while the field owns the screen. Every
/// gesture here becomes a UIKit recognizer on the hosting view, and a
/// recognizer observes the remote's touch stream BEFORE SwiftUI consults
/// guards or gesture masks — its mere presence starves the focus engine and
/// cancels presses to any Button beneath. Builds 23–29 proved it on
/// hardware: with these attached at the root, the shelves and even a lone
/// BEGIN button never received focus. So HomeView mounts this layer only
/// when no shelves and no welcome are up, and removes it — recognizers and
/// all — the moment browsing begins.
///
/// The keys, in field mode: play/pause toggles; select wakes the HUD first
/// and only an already-lit HUD treats a press as transport; select HELD
/// toggles the heart on the playing track; left/right nudge the playhead
/// ∓/±10 s; up/down step rooms; Menu raises the shelves.
struct FieldRemoteLayer: View {
    @ObservedObject var player: Player
    // The heart hold is a no-op without a library; the layer only writes
    // hearts, it never renders one.
    let library: Library?
    @Binding var roomStep: Int
    @Binding var shelvesShown: Bool
    @Binding var activity: Int

    // The layer's own clock of the last press, so the select rule can ask
    // "was the HUD lit?" with the same law the ladder applies.
    @State private var lastBump = Date()

    var body: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            // The field holds focus itself or move commands never arrive.
            .focusable()
            .onPlayPauseCommand {
                bump()
                player.toggle()
            }
            .onMoveCommand { direction in
                bump()
                switch direction {
                case .left: player.nudge(-10)
                case .right: player.nudge(10)
                case .up: roomStep += 1
                case .down: roomStep -= 1
                default: break
                }
            }
            .onExitCommand {
                bump()
                shelvesShown = true
            }
            .onTapGesture {
                // Wake shows info first; the second press is the command.
                let hudWasLit = ZenLaw.hudVisible(
                    idle: Date().timeIntervalSince(lastBump),
                    playing: player.isPlaying
                )
                bump()
                if hudWasLit {
                    player.toggle()
                }
            }
            // Select HELD is the heart: it favourites the playing track without
            // ever opening the shelves. A hold is not a tap, so transport is
            // left alone; only the activity counter is stirred.
            .onLongPressGesture(minimumDuration: 0.6) {
                guard let key = player.current?.id else { return }
                bump()
                library?.toggleHeart(key)
            }
            // VoiceOver on the field: this transport surface names itself and
            // its state. It only exists in field mode, so it can never mask a
            // shelf row.
            .accessibilityElement(children: .contain)
            .accessibilityLabel(fieldLabel)
            .accessibilityValue(Text(player.isPlaying ? "Playing" : "Paused"))
            .accessibilityHint(Text("Play or pause with the play button. Swipe left or right to move ten seconds. Swipe up or down to change rooms. Press and hold to save the track to hearts. Press Menu for the shelves."))
    }

    private var fieldLabel: Text {
        if let title = player.current?.title, !title.isEmpty {
            return Text("Now playing, \(title)")
        }
        return Text("Aethra Kairos player")
    }

    private func bump() {
        lastBump = Date()
        activity += 1
    }
}

/// The countdown itself: a quarter-second heartbeat measures stillness since
/// the last activity and dissolves or wakes the HUD. Playback state changes
/// and track seams count as activity — a new title deserves 3.8 s of light.
struct ZenLadderModifier: ViewModifier {
    @ObservedObject var player: Player
    var activity: Int
    @Binding var hudVisible: Bool

    @State private var lastActivity = Date()

    // Static so re-renders never restart the timer — a ticking clock that
    // resets on every position update would never reach 3.8 s.
    private static let heartbeat = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    init(player: Player, activity: Int, hudVisible: Binding<Bool>) {
        _player = ObservedObject(wrappedValue: player)
        self.activity = activity
        _hudVisible = hudVisible
    }

    func body(content: Content) -> some View {
        content
            .onChange(of: activity) { _, _ in wake() }
            .onChange(of: player.isPlaying) { _, _ in wake() }
            .onChange(of: player.current) { _, _ in wake() }
            .onReceive(Self.heartbeat) { now in
                let lit = ZenLaw.hudVisible(
                    idle: now.timeIntervalSince(lastActivity),
                    playing: player.isPlaying
                )
                if lit != hudVisible {
                    hudVisible = lit
                }
            }
    }

    private func wake() {
        lastActivity = Date()
        hudVisible = true
    }
}

extension View {
    /// The zen idle countdown; HomeView feeds it the counter the remote bumps
    /// and receives the HUD's visibility verdict.
    func zenLadder(player: Player, activity: Int, hudVisible: Binding<Bool>) -> some View {
        modifier(ZenLadderModifier(player: player, activity: activity, hudVisible: hudVisible))
    }
}
