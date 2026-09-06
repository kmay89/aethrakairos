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

/// The Siri Remote grammar, one law per key: play/pause toggles; select wakes
/// the HUD first and only an already-lit HUD treats a press as transport;
/// left/right nudge the playhead ∓/±10 s; up/down step rooms; Menu from the
/// field raises the shelves. Every press feeds the activity counter the zen
/// ladder counts from.
struct RemoteCommandModifier: ViewModifier {
    @ObservedObject var player: Player
    @Binding var roomStep: Int
    @Binding var shelvesShown: Bool
    @Binding var activity: Int

    // The modifier's own clock of the last press, so the select rule can ask
    // "was the HUD lit?" with the same law the ladder applies.
    @State private var lastBump = Date()

    init(player: Player, roomStep: Binding<Int>, shelvesShown: Binding<Bool>, activity: Binding<Int>) {
        _player = ObservedObject(wrappedValue: player)
        _roomStep = roomStep
        _shelvesShown = shelvesShown
        _activity = activity
    }

    func body(content: Content) -> some View {
        content
            // The field must hold focus itself or move commands never arrive;
            // it yields focus entirely while the shelves are up.
            .focusable(!shelvesShown)
            .onPlayPauseCommand {
                bump()
                player.toggle()
            }
            .onMoveCommand { direction in
                // With shelves up, arrows belong to the focus engine.
                guard !shelvesShown else { return }
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
                guard !shelvesShown else { return }
                bump()
                shelvesShown = true
            }
            .onTapGesture {
                guard !shelvesShown else { return }
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
    func remoteControls(player: Player, roomStep: Binding<Int>, shelvesShown: Binding<Bool>, activity: Binding<Int>) -> some View {
        modifier(RemoteCommandModifier(player: player, roomStep: roomStep, shelvesShown: shelvesShown, activity: activity))
    }

    /// The zen idle countdown; HomeView feeds it the counter the remote bumps
    /// and receives the HUD's visibility verdict.
    func zenLadder(player: Player, activity: Int, hudVisible: Binding<Bool>) -> some View {
        modifier(ZenLadderModifier(player: player, activity: activity, hudVisible: hudVisible))
    }
}
