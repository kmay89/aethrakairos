import Foundation

/* ================================================================
   THE WIRE — a stage screen's one connection to a booth.

   The web joins the wire with WebRTC data channels brokered by a
   four-letter code at a mailbox (DESIGN §1.2l). An Apple TV "has no
   browser to knock on the wire with" (§1.2o), and — the ground rule of
   this whole app — it must stay App-Store-clean: Apple frameworks
   only, no WebRTC, no third-party package. So the transport here is
   the tvOS-native equivalent: a single URLSessionWebSocketTask to a
   thin relay that the booth also joins, forwarding the booth's ~30 Hz
   feature frames to every screen on the code. STAGE.md documents the
   relay contract the booth must provide; this class is the screen half.

   The state machine is the design's, verbatim: idle → joining → live,
   and — the law that a screen never freezes — four seconds of silence
   drops it to HELD ("the booth stopped speaking"), never to a frozen
   frame or a black one. `leave()` returns it to idle. A smoothed clock
   offset is kept from each packet's stamp: unused by a single screen's
   geometry, it is the seed of the cut-accurate wall the design wants.
   No audio is ever touched — a stage screen is a screen, not a player.
   ================================================================ */

@MainActor
final class StageClient: ObservableObject {

    enum State: Equatable {
        case idle       // nothing joined
        case joining    // socket opening, no frame yet
        case live       // frames arriving
        case held       // 4 s of silence — the booth stopped speaking
        case error      // the wire refused or dropped; see errorMessage
    }

    /// The relay host. A stage screen and a booth meet here under a shared
    /// four-letter code. Documented (with the URL shape and JSON schema) in
    /// tvos/STAGE.md; the booth must run the small relay bridge described there.
    static let relayHost = "stage.aethrakairos.com"

    /// Seconds of silence before the field is declared held. The design's law:
    /// a screen degrades to a spoken "held" state, never to a frozen picture.
    static let silenceHold: TimeInterval = 4.0

    @Published private(set) var state: State = .idle
    @Published private(set) var errorMessage: String?
    /// The last good frame. Deliberately NOT @Published: the renderer polls it
    /// every frame, so publishing at ~30 Hz would only churn SwiftUI for a value
    /// the view never displays. State changes (idle/joining/live/held/error) are
    /// what the view watches.
    private(set) var latest: StagePacket = .idle
    /// The joined code, kept for the header and for a rejoin.
    @Published private(set) var code: String = ""

    /// Smoothed (local − booth) clock skew in seconds. Informational for one
    /// screen; the shared clock a wall would cut against starts here.
    private(set) var clockOffset: Double = 0
    private var offsetSeeded = false

    private var session: URLSession?
    private var task: URLSessionWebSocketTask?
    private var watchdog: Timer?
    private var lastPacketAt: TimeInterval = 0
    private var tick: Int = 0
    /// Bumped on every join/leave so a stale receive/ping callback from a torn-
    /// down socket is recognised and dropped.
    private var epoch: Int = 0

    // MARK: - joining and leaving

    /// Join a booth by its four-letter code. Anything that is not exactly four
    /// A–Z letters is refused before a socket is opened.
    func join(code raw: String) {
        let cleaned = raw.uppercased().filter { $0.isLetter && $0.isASCII }
        guard cleaned.count == 4 else {
            fail("A stage code is four letters.")
            return
        }
        guard
            let url = URL(string: "wss://\(StageClient.relayHost)/stage/\(cleaned)")
        else {
            fail("That code could not be turned into an address.")
            return
        }

        // fresh connection — retire any prior socket and its callbacks
        teardownSocket()
        epoch &+= 1
        let myEpoch = epoch

        code = cleaned
        errorMessage = nil
        latest = .idle
        offsetSeeded = false
        state = .joining

        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForRequest = 30
        let session = URLSession(configuration: config)
        let task = session.webSocketTask(with: url)
        self.session = session
        self.task = task
        task.resume()

        // announce ourselves as a screen; a relay is free to ignore it
        send("{\"hello\":\"screen\",\"code\":\"\(cleaned)\"}")

        lastPacketAt = now()
        startWatchdog()
        listen(epoch: myEpoch)
    }

    /// Tear the wire down and return to idle. Sends a courteous goodbye first;
    /// the relay may drop us regardless.
    func leave() {
        send("{\"bye\":true}")
        teardownSocket()
        epoch &+= 1
        state = .idle
        errorMessage = nil
        latest = .idle
    }

    // MARK: - the receive loop

    private func listen(epoch myEpoch: Int) {
        guard let task else { return }
        task.receive { [weak self] result in
            // hop to the main actor — every @Published mutation lives there
            Task { @MainActor in
                guard let self, self.epoch == myEpoch else { return }
                switch result {
                case .success(let message):
                    self.handle(message)
                    self.listen(epoch: myEpoch)          // re-arm, one outstanding
                case .failure(let err):
                    self.fail("The wire dropped: \(err.localizedDescription)")
                }
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        let data: Data
        switch message {
        case .string(let s): data = Data(s.utf8)
        case .data(let d):   data = d
        @unknown default:    return
        }
        guard let packet = StagePacket.decode(data, over: latest) else { return }

        updateOffset(boothClock: packet.clock)
        latest = packet
        lastPacketAt = now()
        if state != .live { state = .live }
    }

    // MARK: - the silence watchdog + keepalive

    private func startWatchdog() {
        watchdog?.invalidate()
        tick = 0
        let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.watch() }
        }
        RunLoop.main.add(timer, forMode: .common)
        watchdog = timer
    }

    private func watch() {
        tick &+= 1
        // silence → held; a later packet flips it back to live in handle()
        if state == .live, now() - lastPacketAt > StageClient.silenceHold {
            state = .held
        }
        // a light keepalive so a quiet booth's socket is not reaped by a NAT
        if tick % 20 == 0, state == .live || state == .joining || state == .held {
            task?.sendPing { _ in }
        }
    }

    // MARK: - the smoothed clock offset

    private func updateOffset(boothClock: Double) {
        guard boothClock > 0 else { return }
        let sample = now() - boothClock
        if offsetSeeded {
            clockOffset += (sample - clockOffset) * 0.1      // EMA, tau ~10 frames
        } else {
            clockOffset = sample
            offsetSeeded = true
        }
    }

    // MARK: - plumbing

    private func send(_ text: String) {
        task?.send(.string(text)) { _ in }
    }

    private func fail(_ message: String) {
        teardownSocket()
        epoch &+= 1
        errorMessage = message
        state = .error
    }

    private func teardownSocket() {
        watchdog?.invalidate()
        watchdog = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        session?.invalidateAndCancel()
        session = nil
    }

    private func now() -> TimeInterval { Date().timeIntervalSince1970 }
}
