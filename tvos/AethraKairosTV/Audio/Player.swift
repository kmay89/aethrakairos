import Foundation
import AVFoundation
import Combine

// MARK: - The pure planner, ported verbatim from the web player (node-tested there).
// The planner refuses rather than performing a bad blend — every refusal degrades
// to a plain fade. The gates run in a fixed order; the order IS the law.

enum TransitionPlan: Equatable {
    case gapless
    case beatmix(beats: Double, startA: Double, startB: Double, bpmA: Double, bpmB: Double, fold: Double, seconds: Double)
    case fade(seconds: Double, why: String)
}

enum MixPlanner {

    /// Camelot code parser: ^(\d{1,2})(A|B)$ with 1 <= n <= 12. "7B" -> (7, major: true).
    /// A = minor, B = major. Anything else is nil — unknown, never guessed at.
    static func camelotParse(_ key: String?) -> (n: Int, major: Bool)? {
        guard let key, key.count >= 2, key.count <= 3 else { return nil }
        guard let letter = key.last, letter == "A" || letter == "B" else { return nil }
        let digits = key.dropLast()
        guard digits.allSatisfy({ $0.isASCII && $0.isNumber }),
              let n = Int(digits), n >= 1, n <= 12 else { return nil }
        return (n: n, major: letter == "B")
    }

    /// Wheel distance as a mixing cost: 0 same key · 0.5 relative major/minor ·
    /// 1 adjacent same letter · 2 stretch (diagonal or two steps) · 3 clash.
    /// Unknown key = 1.5: cautious, not a clash. Beatmix is allowed iff <= 2.
    static func camelotCompat(_ a: String?, _ b: String?) -> Double {
        guard let ka = camelotParse(a), let kb = camelotParse(b) else { return 1.5 }
        if ka.n == kb.n { return ka.major == kb.major ? 0 : 0.5 }
        let d = min((ka.n - kb.n + 12) % 12, (kb.n - ka.n + 12) % 12)
        if d == 1 { return ka.major == kb.major ? 1 : 2 }
        if d == 2 && ka.major == kb.major { return 2 }
        return 3
    }

    /// Octave-fold a tempo ratio into [1/√2, √2): 70 vs 140 BPM is half-time,
    /// not a clash. Constants match the web source bit-for-bit.
    static func tempoFoldRatio(_ a: Double, _ b: Double) -> Double {
        guard a > 0, b > 0 else { return 1 }
        var r = a / b
        while r < 0.7071 { r *= 2 }
        while r >= 1.4142 { r /= 2 }
        return r
    }

    /// Gate order (the laws): albumSequential -> gapless; missing grid -> fade
    /// "no beat grid"; either side's mixable < 0.5 -> fade "piano rule";
    /// |fold - 1| > 0.08 -> fade "tempo gap"; compat > 2 -> fade "key clash";
    /// else beatmix. Eight beats is the default — a reliability decision before
    /// a taste one: short enough that phase error has no room to grow into a flam.
    /// `forceBeats` lets a style ask for a longer blend (club runs 16); it is
    /// still clamped by [4, min(out.beats, in.beats)] — the gates never move.
    static func plan(a: Track, b: Track, albumSequential: Bool,
                     forceBeats: Double? = nil) -> TransitionPlan {
        // Album order is the artist's sequencing; the player only removes the silence.
        if albumSequential { return .gapless }
        guard let mA = a.mix, let mB = b.mix, mA.bpm > 0, mB.bpm > 0 else {
            return .fade(seconds: 4, why: "no beat grid")
        }
        if mA.mixable < 0.5 || mB.mixable < 0.5 {
            return .fade(seconds: 4, why: "piano rule")
        }
        let r = tempoFoldRatio(mA.bpm, mB.bpm)
        if abs(r - 1) > 0.08 {
            return .fade(seconds: 4, why: "tempo gap")
        }
        let kc = camelotCompat(mA.key, mB.key)
        if kc > 2 {
            return .fade(seconds: 4, why: "key clash")
        }

        // The style's request (or the 8-beat default) is only a ceiling: the
        // region lengths clamp it, and 4 beats is the floor.
        var beats = forceBeats ?? 8.0
        let outBeats = mA.outRegion.beats > 0 ? mA.outRegion.beats : 8
        let inBeats = mB.inRegion.beats > 0 ? mB.inRegion.beats : 8
        beats = max(4, min(beats, outBeats, inBeats))
        let spbA = 60 / mA.bpm
        let spbB = 60 / mB.bpm
        let durA = a.duration ?? 0
        let barA = 4 * spbA
        // Start on the LAST bar line of A's grid that leaves room for the overlap.
        // Quantize against the REGION bound (a lattice-anchored time), then step
        // back whole bars only when the duration cliff truly demands it.
        let regionEnd = mA.outRegion.start + (outBeats - beats) * spbA
        let durEnd = durA - beats * spbA - 0.30
        if min(regionEnd, durEnd) < mA.grid + barA {
            return .fade(seconds: 4, why: "no room to mix")
        }
        var startA = mA.grid + ((regionEnd - mA.grid) / barA + 1e-9).rounded(.down) * barA
        if startA > durEnd + 1e-9 {
            startA -= (((startA - durEnd - 1e-9) / barA).rounded(.up)) * barA
        }
        if startA < mA.grid + barA {
            return .fade(seconds: 4, why: "no room to mix")
        }
        let startB = max(0, mB.inRegion.start)
        return .beatmix(beats: beats,
                        startA: startA,
                        startB: startB,
                        bpmA: mA.bpm,
                        bpmB: mB.bpm,
                        fold: (r * 10000).rounded() / 10000,
                        seconds: (beats * (spbA + spbB) / 2 * 100).rounded() / 100)
    }

    /// One master tempo line walks from bpmA to B's tempo in A's octave; both
    /// decks ride it. At f=0 the incoming deck is tempo-matched to A; at f=1 the
    /// outgoing carries the stretch and the incoming plays native.
    static func glideRates(bpmA: Double, bpmB: Double, f: Double) -> (rateA: Double, rateB: Double) {
        let fold = tempoFoldRatio(bpmA, bpmB)
        let target = bpmA / fold
        let cf = min(1, max(0, f))
        let master = bpmA + (target - bpmA) * cf
        return (rateA: master / bpmA, rateB: master / target)
    }
}

/// Seam choreography sleeps on wall clock; sub-frame precision belongs to the
/// engine's render-clock scheduling, not to these timers. A request that is
/// not a number, or longer than an hour, is clamped rather than converted:
/// UInt64(inf) is a trap, and nothing here legitimately sleeps that long.
private func sleepSeconds(_ s: Double) async {
    guard s.isFinite, s > 0 else { return }
    let clamped = min(s, 3600)
    try? await Task.sleep(nanoseconds: UInt64(clamped * 1_000_000_000))
}

// MARK: - Mix style

/// The three auto-mix voicings, constants verbatim from the web MIX_STYLES
/// table. A style tunes *taste* — beat count, fade length, whether beatmixes
/// are allowed at all — but it NEVER touches the quality gates; a refusal
/// stays a refusal in every style.
enum MixStyle: String, CaseIterable {
    case adaptive, musical, club

    /// The beat count the style asks the planner for. Club runs long (16);
    /// adaptive and musical keep the reliable 8. Still clamped to the regions.
    var beats: Double { self == .club ? 16 : 8 }

    /// Manual-skip crossfade length. Adaptive is the most generous (3.0 s),
    /// club the tightest (2.2 s) — a club skip should feel decisive.
    var quickFade: Double {
        switch self {
        case .adaptive: return 3.0
        case .musical:  return 2.6
        case .club:     return 2.2
        }
    }

    /// Musical demotes every beatmix to a fade and lets the song play out;
    /// adaptive and club will beatmix when the gates allow it.
    var demotesBeatmix: Bool { self == .musical }
}

// MARK: - Player

@MainActor final class Player: ObservableObject {
    @Published private(set) var queue: [Track] = []
    @Published private(set) var currentIndex: Int = -1     // -1 = nothing
    @Published private(set) var isPlaying: Bool = false
    @Published private(set) var position: Double = 0       // seconds, ~4 Hz
    @Published private(set) var statusLine: String = ""
    var current: Track? { queue.indices.contains(currentIndex) ? queue[currentIndex] : nil }
    var autoMix: Bool = true

    /// Auto-mix voicing (adaptive default). A change lands on the NEXT armed
    /// seam, never on one already planned or running — armSeam snapshots it.
    @Published var mixStyle: MixStyle = .adaptive { didSet { persistSettings() } }
    /// Key-lock preserves pitch under tempo glide (default); off, the pitch
    /// rides the tempo like vinyl. Applied live to whatever is bent right now.
    @Published var keyLock: Bool = true {
        didSet {
            persistSettings()
            reapplyRates()
        }
    }

    /// The web SPEED dial: playback rate with pitch preserved, composed with
    /// the beatmixer — its glide rates multiply by this, so a 1.25× listen
    /// still beat-matches. The grid clock reads the real deck rate, so the
    /// visuals stay honest at any speed. Steps cycle 1 → 1.25 → 1.5 → 0.75.
    static let speedSteps: [Double] = [1, 1.25, 1.5, 0.75]
    @Published private(set) var speedIndex: Int = 0 {
        didSet {
            persistSettings()
            reapplyRates()
        }
    }
    var speed: Double {
        Self.speedSteps[min(max(speedIndex, 0), Self.speedSteps.count - 1)]
    }

    func cycleSpeed() {
        speedIndex = (speedIndex + 1) % Self.speedSteps.count
    }

    func setSpeed(index: Int) {
        speedIndex = min(max(index, 0), Self.speedSteps.count - 1)
    }

    let analyzer = Analyzer()

    /// Catalog context for key lookups and cover metadata (internal — the
    /// NowPlayingCenter reads artist/label/albums from here).
    private(set) var catalog: Catalog?

    /// A var, not a let: a media-services reset kills every AVFAudio object,
    /// and the only cure Apple offers is a new engine (see
    /// rebuildAudioAfterMediaServicesReset). Touched on the main actor only.
    private var engine = DeckEngine()
    private let loader = TrackLoader()
    private let library: Library

    private var activeDeck = 0
    /// The seam's glide rate on the audible deck (1 at rest). The rate the
    /// analyzer and the transport actually see is this × `speed`.
    private var activeRate: Double = 1
    /// The last glide rate applied per deck, so a key-lock or speed change can
    /// re-apply the composed rate to a deck mid-flight.
    private var deckGlide: [Double] = [1, 1]
    private var deckReady = false
    private var deckDuration: [Double] = [0, 0]
    private var deckClaim = [0, 0]          // stale deferred stops must not kill a re-used deck
    private var shuffle = false
    /// The queue is the NONSTOP MIX (playEverything): when it runs low a fresh
    /// shuffle of the whole library is dealt onto its end, so the music never
    /// stops on its own. Any other choice of what to play turns it off.
    private(set) var endless = false
    private var generation = 0              // one materialization wins; stale loads drop out
    private var playedSecondsThisTrack: Double = 0
    private var failureStreak = 0
    /// systemUptime seconds (monotonic — a wall-clock step must never freeze
    /// the position readout) before which the poll leaves `position` alone.
    private var suppressPositionUntil: TimeInterval = 0

    /// THE LISTENER'S INTENT, kept apart from the fact. True from play() until
    /// pause() — through a download still on its way, an engine that will
    /// not start, a media-services reset. The fact (isPlaying) follows the
    /// engine; the intent decides what happens when the load lands or the
    /// engine comes back.
    private var wantsPlayback = false
    /// A materialize is in flight: the download or decode has not landed.
    private var materializing = false
    /// recoverAudio attempts in a row that could not start the engine, and
    /// the count at which the transport stops claiming to play (~10 s at the
    /// liveness guard's 0.5 s cadence) — the HUD and the idle timer stop
    /// lying, the intent stays, and the poll keeps asking every ~2 s.
    private var recoveryFailures = 0
    private static let maxRecoveryFailures = 20
    private var retryPolls = 0
    /// Recoveries in a row whose engine STARTED but whose deck still would not
    /// play (AVFAudio raised; see AKCatch.h). Three of them and the engine is
    /// thrown away and built fresh, as after a media-services reset — at most
    /// once every 30 s, so a device that refuses every engine is not churned.
    private var playRefusals = 0
    private var lastRebuildAt: TimeInterval = -1_000

    /// Polls in a row the transport has believed "playing" while the active
    /// deck was not actually rendering — the liveness guard's evidence.
    private var deadPolls = 0
    /// A system interruption (Siri, another app) took the audio while we were
    /// playing; if the system says so when it ends, the music comes back.
    private var resumeAfterInterruption = false
    private var interruptionObserver: NSObjectProtocol?
    private var mediaResetObserver: NSObjectProtocol?

    private var pollTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    private var pendingOpTask: Task<Void, Never>?
    /// A SKIP IN FLIGHT: the deck still sounding while the track the listener
    /// skipped to loads on the other one. It keeps playing until the new
    /// track is decoded, then the two cross over on the equal-power law — a
    /// skip is never a fade into silence followed by a wait. Any other change
    /// of what plays hands it back first (releaseSkipHold).
    private var skipHoldDeck: Int?

    // Seam state: one plan at a time, computed once, executed on the other deck.
    private var seamPlan: TransitionPlan?
    private var seamTriggerAt: Double = 0
    private var seamNextReady = false
    private var seamRunning = false
    private var seamLoadTask: Task<Void, Never>?
    private var seamTasks: [Task<Void, Never>] = []
    private var glideTask: Task<Void, Never>?

    init(library: Library) {
        self.library = library
        // Restore the listener's mixing preferences. These are tiny and non-
        // secret, so UserDefaults is the right size of persistence. Assigning
        // inside init does not fire didSet, so no redundant write-back here.
        if let raw = UserDefaults.standard.string(forKey: Self.mixStyleKey),
           let saved = MixStyle(rawValue: raw) {
            mixStyle = saved
        }
        if UserDefaults.standard.object(forKey: Self.keyLockKey) != nil {
            keyLock = UserDefaults.standard.bool(forKey: Self.keyLockKey)
        }
        let savedSpeed = UserDefaults.standard.integer(forKey: Self.speedKey)
        if Self.speedSteps.indices.contains(savedSpeed) {
            speedIndex = savedSpeed
        }
        // One .playback declaration for the app's lifetime — the session is
        // configured here and nowhere else.
        /* PLAYBACK ONLY, AND NOTHING ELSE. The app never records and never asks
           for the microphone — no record category, no input node — so the Siri
           Remote's mic stays Siri's, and Siri interrupts playback cleanly
           (handled below) and hands it back.
           Build 92 tried the `.longFormAudio` routing policy here; it changes
           how tvOS routes and re-routes the app's output, and that build was
           the one that sounded wrong and fell over after a minute. The plain
           `.playback` category every earlier working build shipped with is
           back — the system's default output is what it plays to. */
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
        wireEngine()
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(), queue: .main
        ) { [weak self] note in
            let info = note.userInfo ?? [:]
            let type = (info[AVAudioSessionInterruptionTypeKey] as? UInt)
                .flatMap(AVAudioSession.InterruptionType.init(rawValue:))
            let opts = AVAudioSession.InterruptionOptions(
                rawValue: (info[AVAudioSessionInterruptionOptionKey] as? UInt) ?? 0)
            Task { @MainActor in self?.handleInterruption(type, shouldResume: opts.contains(.shouldResume)) }
        }
        // mediaserverd can die (memory pressure, a failed AirPlay handshake);
        // when it does every AVFAudio object is an orphan and the engine will
        // never start again. The only cure is a fresh one.
        mediaResetObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.mediaServicesWereResetNotification,
            object: AVAudioSession.sharedInstance(), queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.rebuildAudioAfterMediaServicesReset() }
        }
        startPollLoop()
    }

    /// Exactly one tap consumer (the analyzer is the ears; nothing else
    /// listens) and the engine's one word back (the output changed). Run once
    /// at birth and again for every engine a media-services reset rebuilds.
    private func wireEngine() {
        let analyzer = self.analyzer
        engine.installTap { buffer, when in
            analyzer.ingest(buffer: buffer, when: when)
        }
        engine.onConfigurationChange = { [weak self] in
            // One run-loop turn later, never inside the notification: AVFAudio
            // is still unwinding its own graph state when it posts, and a
            // start or play from inside that window is the abort this whole
            // path exists to avoid. All engine work stays on the main thread.
            DispatchQueue.main.async {
                Task { @MainActor in self?.recoverAudio() }
            }
        }
    }

    // MARK: transport

    func setQueue(_ tracks: [Track], startAt index: Int, autoplay: Bool) {
        endless = false
        releaseSkipHold(fade: 0.25)
        recordHistoryForCurrent()
        cancelSeam()
        stopActiveDeckDeferred()
        isPlaying = false
        failureStreak = 0            // a new queue is a fresh verdict
        queue = tracks
        guard !tracks.isEmpty else {
            currentIndex = -1
            position = 0
            deckReady = false
            wantsPlayback = false
            statusLine = ""
            return
        }
        let i = min(max(0, index), tracks.count - 1)
        activeDeck = 1 - activeDeck
        activeRate = 1
        materialize(index: i, startAt: 0, autoplay: autoplay)
    }

    /// A journey is an ordering: it replaces the QUEUE only, never the library,
    /// and shuffle is disengaged because shuffle would unmake the ordering.
    func engageJourney(order keys: [String], in catalog: Catalog) {
        let tracks = keys.compactMap { catalog.track(forKey: $0) }
        guard !tracks.isEmpty else { return }
        shuffle = false
        endless = false
        if let cur = current, let slot = tracks.firstIndex(where: { $0.id == cur.id }) {
            cancelSeam()               // next-up changed; the old plan is void
            queue = tracks
            currentIndex = slot        // the playing deck is never touched
            if let nxt = peekNext() { loader.prefetch(nxt) }
            library.saveTransport(snapshot())
        } else {
            setQueue(tracks, startAt: 0, autoplay: true)
        }
    }

    /// ONE PRESS, MUSIC: the whole library, shuffled, played nonstop — the
    /// welcome's PLAY and the shelves' PLAY land here. The auto-mixer blends
    /// each seam as it always does; the queue re-deals itself at its end.
    func playEverything(in catalog: Catalog) {
        let deck = catalog.tracks.shuffled()
        guard !deck.isEmpty else { return }
        setQueue(deck, startAt: 0, autoplay: true)
        endless = true
    }

    /// The nonstop mix never reaches its end: two tracks out, another pass of
    /// the library is dealt on. Appending never moves the current or the next
    /// track, so an armed seam stays valid.
    private func extendEndlessIfNeeded() {
        guard endless, let catalog, currentIndex >= 0, currentIndex >= queue.count - 2 else { return }
        var more = catalog.tracks.shuffled()
        guard !more.isEmpty else { return }
        // never the same song twice in a row across the pass boundary
        if more.count > 1, let last = queue.last, more[0].id == last.id {
            more.swapAt(0, more.count - 1)
        }
        queue.append(contentsOf: more)
    }

    func toggle() {
        // A press while the track is still on its way flips the INTENT; it
        // never starts a second download of the same track.
        if materializing, currentIndex >= 0 {
            wantsPlayback.toggle()
            // a pause while a skip loads silences the track it was holding
            if !wantsPlayback { releaseSkipHold(fade: 0.3) }
            // the FACT follows a pause: a skip leaves isPlaying true from the
            // track it left, and a HUD, Now Playing and the idle lock that
            // still say "playing" invite a second press that undoes the pause.
            // Nothing that needs a deck reads it mid-download (deckReady is
            // false), and the landing sets it from the intent either way.
            if !wantsPlayback { isPlaying = false }
            statusLine = wantsPlayback ? "materializing…" : "paused"
            return
        }
        if isPlaying { pause() } else { play() }
    }

    func play() {
        wantsPlayback = true
        recoveryFailures = 0
        retryPolls = 0
        if currentIndex < 0 {
            if !queue.isEmpty { materialize(index: 0, startAt: 0, autoplay: true) }
            return
        }
        if materializing {
            // The download is already on its way; the intent above is enough.
            statusLine = "materializing…"
            return
        }
        if !deckReady {
            // Restored-paused state materializes lazily: the download waits for intent.
            materialize(index: currentIndex, startAt: position, autoplay: true)
            return
        }
        guard !isPlaying else { return }
        var offset = position
        if let dur = currentDuration, offset >= dur - 0.5 { offset = 0; position = 0 }
        try? AVAudioSession.sharedInstance().setActive(true)
        do {
            try engine.startEngineIfNeeded()
        } catch {
            NSLog("AethraKairos: engine start failed in play() — %@", String(describing: error))
        }
        // A paused deck is inaudible, so re-scheduling from the held position is
        // not a seek of an audible deck.
        engine.stop(deck: activeDeck)
        engine.rampVolume(deck: activeDeck, to: 1, over: 0.06)
        engine.play(deck: activeDeck, atOffset: offset, in: 0)
        isPlaying = true
        // An engine that would not start declined the play above; the
        // liveness guard picks it up and recoverAudio keeps asking.
        statusLine = engine.isEngineRunning ? "" : "audio output unavailable — retrying"
        analyzer.setClock(playhead: offset, mix: current?.mix, rate: speed)
    }

    func pause() {
        wantsPlayback = false
        releaseSkipHold(fade: 0.3)
        guard isPlaying else {
            // Pressed while the track is still on its way: the load lands
            // PARKED at the position, not playing at full volume.
            if materializing { statusLine = "paused" }
            return
        }
        cancelSeam()   // seam timers run on wall clock; a paused seam would fire wrongly
        if let p = engine.position(deck: activeDeck) { position = p }
        engine.pause(deck: activeDeck)
        isPlaying = false
        analyzer.setClock(playhead: position, mix: current?.mix, rate: 0)
        library.saveTransport(snapshot())
    }

    /// A skip cancels any armed seam and hard-switches under the style's quick-
    /// fade (adaptive 3.0 / musical 2.6 / club 2.2 s) — never a click, never a
    /// half-executed blend.
    func next() {
        guard hasNext() else { return }
        skip(to: currentIndex + 1)
    }

    /// Back, the way every player does it: more than three seconds in, back
    /// to the top of this track; otherwise the track before.
    func prev() {
        guard currentIndex >= 0 else { return }
        if deckReady, !materializing, position > 3 {
            seek(to: 0)
            return
        }
        skip(to: currentIndex > 0 ? currentIndex - 1 : 0)
    }

    /// THE LISTENER'S SKIP. The track that is playing keeps playing while the
    /// one skipped to loads on the other deck; when it lands they cross over
    /// over the style's quick-fade (equal power, the incoming rising in the
    /// first 60 %). Pressed again while it is still loading, the same incoming
    /// deck is retargeted and the held track simply plays on — rapid skipping
    /// never cuts the audible deck. Paused, or with nothing audible, it is
    /// the plain hard switch.
    private func skip(to index: Int) {
        guard queue.indices.contains(index) else { return }
        recordHistoryForCurrent()
        cancelSeam()
        if skipHoldDeck == nil {
            if isPlaying, deckReady, engine.isLive(deck: activeDeck) {
                skipHoldDeck = activeDeck      // it keeps sounding until the next lands
            } else {
                stopActiveDeckDeferred(fade: 0.25)
            }
            activeDeck = 1 - activeDeck
        }
        // else: a skip is already loading on activeDeck — retarget it
        activeRate = 1
        materialize(index: index, startAt: 0, autoplay: true)
    }

    /// Hands the held deck back: a skip in flight was overtaken (a pause, a new
    /// queue, an automatic advance, an engine rebuild). It fades and stops.
    private func releaseSkipHold(fade: Double) {
        guard let hold = skipHoldDeck else { return }
        skipHoldDeck = nil
        fadeOutAndStop(deck: hold, over: fade)
    }

    func seek(to seconds: Double) {
        guard currentIndex >= 0, seconds.isFinite else { return }
        cancelSeam()   // the playhead moved; any armed plan is stale
        var s = max(0, seconds)
        if let dur = currentDuration { s = min(s, max(0, dur - 0.25)) }
        position = s
        guard deckReady else { return }   // restored-but-unmaterialized: the offset waits for play()
        if isPlaying {
            let deck = activeDeck
            let gen = generation
            suppressPositionUntil = ProcessInfo.processInfo.systemUptime + 0.4
            pendingOpTask?.cancel()
            // The law: a deck must be inaudible before its playhead moves.
            engine.rampVolume(deck: deck, to: 0, over: 0.04)
            pendingOpTask = Task { [weak self] in
                await sleepSeconds(0.05)
                guard let self, !Task.isCancelled, gen == self.generation else { return }
                self.engine.stop(deck: deck)
                self.engine.play(deck: deck, atOffset: s, in: 0)
                self.engine.rampVolume(deck: deck, to: 1, over: 0.04)
            }
        }
        analyzer.setClock(playhead: s, mix: current?.mix, rate: clockRate)
        library.saveTransport(snapshot())
    }

    func nudge(_ delta: Double) {
        seek(to: position + delta)
    }

    func hasNext() -> Bool {
        currentIndex >= 0 && currentIndex + 1 < queue.count
    }

    /// Wire-up called once from the App: catalog context for key lookups, then
    /// the resume flow. Restore reconciles saved keys against the catalog, drops
    /// the vanished (honestly counted), and always lands PAUSED at position.
    func attach(catalog: Catalog) {
        self.catalog = catalog
        // A catalog refresh mid-session only updates context; restore happens once, cold.
        guard currentIndex < 0, queue.isEmpty else { return }
        guard let snap = library.loadTransport() else { return }
        let survivors = snap.queueKeys.compactMap { catalog.track(forKey: $0) }
        guard !survivors.isEmpty else { return }
        queue = survivors
        shuffle = snap.shuffle
        var idx = 0
        var pos = 0.0
        if let key = snap.currentKey, let i = survivors.firstIndex(where: { $0.id == key }) {
            idx = i
            pos = max(0, snap.position)
        }
        currentIndex = idx
        position = pos
        isPlaying = false
        deckReady = false
        let dropped = snap.queueKeys.count - survivors.count
        statusLine = dropped > 0
            ? "restored — \(dropped) vanished from the catalog"
            : "restored — play to resume"
        loader.prefetch(survivors[idx])
        analyzer.setClock(playhead: pos, mix: current?.mix, rate: 0)
    }

    // MARK: - internals

    /// THE TRANSPORT'S TRUTH ABOUT LENGTH. The catalog figure is display
    /// metadata rounded to one decimal; the decoded file is sample-exact, and
    /// CoreAudio's gapless trim can leave it tens of milliseconds SHORTER than
    /// the catalog says. The position clamps to the decoded length, so an
    /// advance that waits for the catalog figure can wait forever — silence,
    /// the HUD saying playing, the screen never sleeping: the end-of-track
    /// hang. The shorter of the two is the authority; the deck's own
    /// finished signal (pollTick) is the other half of the cure.
    private var currentDuration: Double? {
        let decoded = deckDuration.indices.contains(activeDeck) ? deckDuration[activeDeck] : 0
        let catalog = current?.duration ?? 0
        if catalog > 0, decoded > 0 { return min(catalog, decoded) }
        if decoded > 0 { return decoded }
        return catalog > 0 ? catalog : nil
    }

    private func peekNext() -> Track? {
        hasNext() ? queue[currentIndex + 1] : nil
    }

    private func snapshot() -> TransportSnapshot {
        TransportSnapshot(queueKeys: queue.map { $0.id },
                          currentKey: current?.id,
                          position: position,
                          shuffle: shuffle)
    }

    private static let mixStyleKey = "aethra.mixStyle"
    private static let keyLockKey = "aethra.keyLock"
    private static let speedKey = "aethra.speed"

    /// Mixing preferences are small and non-secret — UserDefaults is the right
    /// size. Written on every change via the properties' didSet.
    private func persistSettings() {
        UserDefaults.standard.set(mixStyle.rawValue, forKey: Self.mixStyleKey)
        UserDefaults.standard.set(keyLock, forKey: Self.keyLockKey)
        UserDefaults.standard.set(speedIndex, forKey: Self.speedKey)
    }

    /// A seam hands back exactly what it borrowed — and the SPEED dial is
    /// re-applied on top, because a deck at rest still runs at the listener's
    /// chosen speed, not at 1.
    private func restDeck(_ deck: Int) {
        engine.resetDeckDSP(deck: deck)
        applyDeckRate(deck: deck, rate: 1)
    }

    /// The rate the analyzer's clock runs at: the audible deck's glide × the
    /// SPEED dial while playing, 0 when paused.
    private var clockRate: Double {
        isPlaying ? activeRate * speed : 0
    }

    /// A key-lock or speed change lands on both decks at once, composed with
    /// whatever glide each is carrying, and the analyzer's clock follows.
    private func reapplyRates() {
        for deck in 0..<2 {
            engine.setRate(deck: deck, rate: Float(deckGlide[deck] * speed), keyLock: keyLock)
        }
        analyzer.setClock(playhead: position, mix: current?.mix, rate: clockRate)
    }

    /// The web verdict feeds from seconds actually played, not final position.
    private func recordHistoryForCurrent() {
        guard let t = current else { return }
        let dur = currentDuration
        let completed = dur.map { position >= $0 - 1.5 } ?? false
        library.recordPlay(key: t.id, playedSeconds: playedSecondsThisTrack, duration: dur, completed: completed)
        playedSecondsThisTrack = 0
    }

    private func isAlbumSequential(_ a: Track, _ b: Track) -> Bool {
        guard a.albumTag == b.albumTag,
              let cat = catalog,
              let album = cat.albums.first(where: { $0.tag == a.albumTag }),
              let ia = album.tracks.firstIndex(where: { $0.id == a.id }),
              let ib = album.tracks.firstIndex(where: { $0.id == b.id })
        else { return false }
        return ib == ia + 1
    }

    // MARK: materialization (download-then-play)

    private func materialize(index: Int, startAt offset: Double, autoplay: Bool) {
        guard queue.indices.contains(index) else { return }
        generation += 1
        let gen = generation
        let deck = activeDeck
        deckClaim[deck] += 1
        currentIndex = index
        position = (offset.isFinite && offset > 0) ? offset : 0
        deckReady = false
        deckDuration[deck] = 0       // the catalog figure stands in until the decode lands
        playedSecondsThisTrack = 0
        wantsPlayback = autoplay
        materializing = true
        let track = queue[index]
        statusLine = "materializing…"
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let url = try await self.loader.localFile(for: track)
                guard gen == self.generation, !Task.isCancelled else { return }
                // THE DECODE IS NOT MAIN-THREAD WORK. Opening the file and
                // forcing its frame count (an MP3 without a Xing frame is a
                // walk over every packet) runs on a detached task; only the
                // rewire below — a graph update — runs here on the main actor.
                let file = try await Task.detached(priority: .userInitiated) {
                    try DeckEngine.openFile(url)
                }.value
                guard gen == self.generation, !Task.isCancelled else { return }
                await self.quiesce(deck: deck)
                guard gen == self.generation, !Task.isCancelled else { return }
                let dur = try self.engine.load(deck: deck, file: file)
                self.materializing = false
                self.deckDuration[deck] = dur
                self.restDeck(deck)
                self.engine.setNorm(deck: deck, track.normLin)
                self.deckReady = true
                self.failureStreak = 0
                self.statusLine = ""
                // The INTENT decides, not the argument: a pause during the
                // download parks an autoplay; a play press during a parked
                // load (toggle flips the intent) starts it.
                if self.wantsPlayback {
                    try? AVAudioSession.sharedInstance().setActive(true)
                    // AN ENGINE THAT WILL NOT START IS NOT A BAD TRACK. It used
                    // to share the load's catch and burn three tracks in two
                    // seconds whenever the session was not yet ours (waking the
                    // Apple TV, Siri just finished, HDMI mid-handshake). Now the
                    // track stays loaded and ready, the transport says playing,
                    // and the liveness guard's recoverAudio keeps asking.
                    var engineUp = true
                    do {
                        try self.engine.startEngineIfNeeded()
                    } catch {
                        engineUp = false
                        NSLog("AethraKairos: engine start failed after load — %@", String(describing: error))
                    }
                    if let hold = self.skipHoldDeck, hold != deck {
                        // the skip's cross: the held track out over the
                        // quick-fade, the new one up from silence over 60 %
                        self.skipHoldDeck = nil
                        let fade = self.mixStyle.quickFade
                        NSLog("AethraKairos: skip crossfade, deck %d out over %.1f s, deck %d in", hold, fade, deck)
                        self.engine.setVolume(deck: deck, to: 0)
                        self.engine.play(deck: deck, atOffset: self.position, in: 0)
                        self.engine.rampVolume(deck: deck, to: 1, over: fade * 0.6)
                        self.fadeOutAndStop(deck: hold, over: fade)
                    } else {
                        self.skipHoldDeck = nil
                        self.engine.rampVolume(deck: deck, to: 1, over: 0.06)
                        self.engine.play(deck: deck, atOffset: self.position, in: 0)
                    }
                    self.isPlaying = true
                    self.statusLine = engineUp ? "" : "audio output unavailable — retrying"
                } else {
                    // Parked: restored-paused, or paused while the download ran.
                    self.releaseSkipHold(fade: 0.3)
                    self.engine.rampVolume(deck: deck, to: 1, over: 0.005)
                    self.isPlaying = false
                    if autoplay { self.statusLine = "paused" }   // the pause overtook the play
                }
                self.activeRate = 1
                self.analyzer.setClock(playhead: self.position, mix: track.mix,
                                       rate: self.clockRate)
                if let nxt = self.peekNext() { self.loader.prefetch(nxt) }
                self.library.saveTransport(self.snapshot())
            } catch {
                guard gen == self.generation, !Task.isCancelled else { return }
                self.materializing = false
                // A cancelled download is not a bad track: a newer intent
                // simply overtook this one.
                if let le = error as? TrackLoader.LoaderError, case .cancelled = le { return }
                // the skipped-to track will not come: the held one bows out
                self.releaseSkipHold(fade: 0.6)
                self.isPlaying = false
                self.statusLine = "couldn't load — \(track.title)"
                // Only a verdict about the TRACK (unreachable, corrupt, will
                // not open) counts toward the three strikes; anything else
                // keeps the track for the next play(). Three strikes then stop
                // honestly, instead of marching silently through the catalog.
                let badTrack = error is TrackLoader.LoaderError || error is DeckEngine.DeckError
                if badTrack, autoplay, self.failureStreak < 3, self.hasNext() {
                    self.failureStreak += 1
                    self.hardSwitch(to: self.currentIndex + 1, startAt: 0, autoplay: true)
                } else {
                    self.wantsPlayback = false
                }
            }
        }
    }

    /// The law: a deck must be inaudible before its transport is touched. A
    /// deck still fading out (a skip inside a skip; a seam preload landing on
    /// a deck whose deferred stop was overtaken by a newer claim) is ramped to
    /// silence over the minimum ramp before load() stops it — never a click.
    private func quiesce(deck: Int) async {
        guard engine.isPlaying(deck: deck) else { return }
        engine.rampVolume(deck: deck, to: 0, over: 0.03)
        await sleepSeconds(0.04)
    }

    private func hardSwitch(to index: Int, startAt: Double, autoplay: Bool, fade: Double = 0.25) {
        releaseSkipHold(fade: 0.25)
        recordHistoryForCurrent()
        cancelSeam()
        stopActiveDeckDeferred(fade: fade)
        activeDeck = 1 - activeDeck
        activeRate = 1
        materialize(index: index, startAt: startAt, autoplay: autoplay)
    }

    /// A fade before the stop — a hard switch is still never a click. Manual
    /// skips pass the style's quick-fade; automatic and failure advances keep
    /// the tight 0.25 s default. The claim counter keeps a stale deferred stop
    /// from killing a re-used deck.
    private func stopActiveDeckDeferred(fade: Double = 0.25) {
        fadeOutAndStop(deck: activeDeck, over: fade)
    }

    /// Fade a deck out and stop it once it is silent — unless it has been
    /// re-purposed in the meantime (its claim moved on), in which case the
    /// stop is stale and the new owner keeps it.
    private func fadeOutAndStop(deck: Int, over fade: Double) {
        guard deckClaim.indices.contains(deck) else { return }
        let claim = deckClaim[deck]
        if engine.isPlaying(deck: deck) {
            let f = max(0.05, fade)
            engine.rampVolume(deck: deck, to: 0, over: f)
            Task { [weak self] in
                await sleepSeconds(f + 0.05)
                guard let self, self.deckClaim[deck] == claim else { return }
                self.engine.stop(deck: deck)
                self.restDeck(deck)
            }
        } else {
            engine.stop(deck: deck)
            restDeck(deck)
        }
    }

    // MARK: keeping the music going

    /// An interruption is the system's pause, so it is honoured as one — the
    /// transport says "paused", the position is kept — and undone the moment
    /// the system says the audio is ours again. Without this the engine was
    /// stopped under a transport that still read "playing", and stayed silent.
    private func handleInterruption(_ type: AVAudioSession.InterruptionType?, shouldResume: Bool) {
        switch type {
        case .began?:
            // The intent counts too: a track still downloading, or an engine
            // we are still trying to start, comes back when the system says so.
            resumeAfterInterruption = isPlaying || wantsPlayback
            if isPlaying { pause() } else { wantsPlayback = false }
        case .ended?:
            let resume = resumeAfterInterruption && shouldResume
            resumeAfterInterruption = false
            if resume, !isPlaying { play() }
        default:
            break
        }
    }

    /// The engine or the active deck stopped without anybody asking — the
    /// output renegotiated under it (DeckEngine's configuration-change note)
    /// or the liveness guard caught a deck that went quiet. Start the engine
    /// and reschedule the deck at the spot it was playing. A seam caught in
    /// the middle is abandoned for a plain continuation of the audible track;
    /// the end-of-track logic then advances as it always does.
    private func recoverAudio() {
        deadPolls = 0
        // The output may have renegotiated under the engine: drop the stale
        // tap, re-assert the graph and prepare() now — BEFORE any start, and
        // whatever the transport wants, so a paused player's next play() never
        // starts a stale graph either. A running engine makes this a no-op;
        // the start below re-installs the tap against the new format.
        engine.reconfigureAfterOutputChange()
        // Wanted: the transport says playing, or it gave up saying so (below)
        // while the listener's intent still stands.
        let wanted = isPlaying || (wantsPlayback && recoveryFailures > 0)
        guard wanted, deckReady, currentIndex >= 0 else { return }
        let deck = activeDeck
        let at = engine.position(deck: deck) ?? position
        // At the very end, the next poll's end-of-track advance is the cure —
        // when there IS a next track (the poll hard-advances or begins the
        // armed seam from dur - 0.30). The LAST track has no such cure: the
        // poll ends the queue only at dur - 0.05, and the deck's finished
        // word is believed only while the engine runs, so an engine that
        // stopped in a last track's final 0.3 s left the transport "playing"
        // silence forever (the HUD lit, the idle timer held off), this guard
        // returning every half second. There is nothing left to resume: the
        // queue ends here, honestly.
        if isPlaying, let dur = currentDuration, at >= dur - 0.30 {
            if !hasNext() { endOfQueue(duration: dur) }
            return
        }
        cancelSeam()
        try? AVAudioSession.sharedInstance().setActive(true)
        do {
            try engine.startEngineIfNeeded()
        } catch {
            recoveryFailures += 1
            NSLog("AethraKairos: audio recovery %d failed — %@", recoveryFailures, String(describing: error))
            if recoveryFailures >= Self.maxRecoveryFailures, isPlaying {
                // ~10 s of silence: stop telling the HUD, Now Playing and the
                // idle timer that music plays. The position and the intent
                // stay; the poll asks again every ~2 s, a press asks at once.
                isPlaying = false
                position = at
                analyzer.setClock(playhead: at, mix: current?.mix, rate: 0)
            }
            statusLine = recoveryFailures > 1
                ? "audio output unavailable — retrying (\(recoveryFailures))"
                : "audio output unavailable — retrying"
            return   // the liveness guard asks again on the next polls
        }
        recoveryFailures = 0
        retryPolls = 0
        engine.stop(deck: deck)
        engine.rampVolume(deck: deck, to: 1, over: 0.06)
        let started = engine.play(deck: deck, atOffset: at, in: 0)
        isPlaying = true
        position = at
        statusLine = ""
        analyzer.setClock(playhead: at, mix: current?.mix, rate: clockRate)
        guard !started else {
            playRefusals = 0
            return
        }
        // The engine runs but the deck refused: AVFAudio raised (now caught)
        // or the engine fell over between the start and the play. The guard
        // asks again in half a second; a third refusal replaces the engine.
        playRefusals += 1
        let now = ProcessInfo.processInfo.systemUptime
        if playRefusals >= 3, now - lastRebuildAt >= 30 {
            playRefusals = 0
            lastRebuildAt = now
            NSLog("AethraKairos: the deck keeps refusing to play — building a fresh audio engine")
            rebuildAudioAfterMediaServicesReset()
        }
    }

    /// mediaserverd died and took every AVFAudio object with it. Apple's law
    /// for AVAudioSessionMediaServicesWereReset is to throw the orphans away
    /// and build new ones, which this does: a fresh DeckEngine, the tap and
    /// the session category re-asserted, and the deck re-materialized from
    /// the same cached file at the same spot with the same intent. Without
    /// this the recovery loop retried a dead engine forever — silent, with
    /// "retrying" on screen until a force-quit.
    private func rebuildAudioAfterMediaServicesReset() {
        NSLog("AethraKairos: media services were reset — rebuilding the audio engine")
        let wanted = isPlaying || wantsPlayback
        // The polled position is the last honest word; the dead engine is not asked.
        let at = position
        loadTask?.cancel()
        loadTask = nil
        pendingOpTask?.cancel()
        pendingOpTask = nil
        engine.teardown()
        skipHoldDeck = nil                // the old engine's decks are gone
        engine = DeckEngine()
        wireEngine()
        // Seam bookkeeping is reset against the NEW engine — its decks are idle,
        // so the stops and rests inside are harmless no-ops.
        cancelSeam()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
        isPlaying = false
        deckReady = false
        materializing = false
        deadPolls = 0
        recoveryFailures = 0
        retryPolls = 0
        playRefusals = 0
        deckDuration = [0, 0]
        deckGlide = [1, 1]
        activeRate = 1
        position = (at.isFinite && at > 0) ? at : 0
        analyzer.setClock(playhead: position, mix: current?.mix, rate: 0)
        guard currentIndex >= 0 else { return }
        materialize(index: currentIndex, startAt: position, autoplay: wanted)
    }

    // MARK: the 4 Hz poll — position, clock truth, transport save, seam lifecycle

    private func startPollLoop() {
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 250_000_000)
                guard let self else { return }
                self.pollTick()
            }
        }
    }

    private func pollTick() {
        guard currentIndex >= 0, deckReady else { return }
        // Gave up saying "playing" (recoverAudio) while the intent stands:
        // ask again every ~2 s, honestly paused in between.
        if !isPlaying, wantsPlayback, recoveryFailures > 0 {
            retryPolls += 1
            if retryPolls >= 8 {
                retryPolls = 0
                recoverAudio()
            }
        }
        // THE LIVENESS GUARD: "playing" must mean the active deck is rendering.
        // Every transport path starts the deck in the same step it sets
        // isPlaying, so two polls (~0.5 s) of disagreement is a deck the
        // system stopped — whatever stopped it, notification or not.
        if isPlaying, !engine.isLive(deck: activeDeck) {
            deadPolls += 1
            if deadPolls >= 2 { recoverAudio() }
        } else {
            deadPolls = 0
        }
        if isPlaying {
            if ProcessInfo.processInfo.systemUptime >= suppressPositionUntil,
               let p = engine.position(deck: activeDeck) {
                position = p
            }
            playedSecondsThisTrack += 0.25
        }
        extendEndlessIfNeeded()
        if Self.soak { soakTick() }
        // The clock truth flows one way: latency-compensated playhead into the
        // analyzer, every poll — the beat grid is authoritative when mix exists.
        // The same latency is handed over for onset visuals: a detected hit is
        // shown when it is HEARD, not when it was rendered.
        let outLat = engine.outputLatency
        let compensated = position - outLat * clockRate
        analyzer.setOutputLatency(outLat)
        analyzer.setClock(playhead: max(0, compensated), mix: current?.mix,
                          rate: clockRate)
        library.saveTransport(snapshot())   // Library throttles internally (>= 1 s)

        guard isPlaying, let dur = currentDuration, dur > 0 else { return }

        // THE DECK'S OWN WORD THAT IT FINISHED: the scheduled data played to
        // its last frame. Believed only while the engine runs — an engine the
        // output change stopped is the liveness guard's case, not this one.
        let finished = engine.didFinish(deck: activeDeck) && engine.isEngineRunning

        // Arm the planned transition once, 90 s out. The plan is computed once
        // and never re-litigated.
        if autoMix, !seamRunning, seamPlan == nil, hasNext(), dur - position <= 90 {
            armSeam(duration: dur)
        }
        // Fire with ~1 s of lookahead: the audio start is scheduled on the render
        // clock, so the poll's coarseness never becomes phase error.
        if let plan = seamPlan, !seamRunning, seamNextReady, position >= seamTriggerAt - 1.0 {
            beginSeam(plan, duration: dur)
        }
        if !seamRunning {
            if finished {
                // The music is over whatever the clocks say; a seam that never
                // fired (its cue past the real end) is abandoned honestly.
                if hasNext() {
                    hardSwitch(to: currentIndex + 1, startAt: 0, autoplay: true)
                } else {
                    endOfQueue(duration: dur)
                }
            } else if hasNext(), seamPlan == nil || !seamNextReady, position >= dur - 0.30 {
                // No seam became ready (auto-mix off, or a slow download):
                // an honest hard advance at the end.
                hardSwitch(to: currentIndex + 1, startAt: 0, autoplay: true)
            } else if !hasNext(), position >= dur - 0.05 {
                endOfQueue(duration: dur)
            }
        }
    }

    private func endOfQueue(duration dur: Double) {
        recordHistoryForCurrent()
        cancelSeam()
        engine.stop(deck: activeDeck)
        isPlaying = false
        wantsPlayback = false
        position = dur
        statusLine = ""
        analyzer.setClock(playhead: dur, mix: current?.mix, rate: 0)
        library.saveTransport(snapshot())
    }

    // MARK: seams

    private func armSeam(duration dur: Double) {
        guard let a = current, let b = peekNext() else { return }
        // Snapshot the style HERE: a preference change takes effect on the next
        // armed seam, never on one already planned or mid-flight.
        let style = mixStyle
        // Club forces a 16-beat plan; the planner still clamps it to the
        // regions. Adaptive/musical leave the 8-beat default in place.
        let forceBeats: Double? = style == .club ? style.beats : nil
        var plan = MixPlanner.plan(a: a, b: b, albumSequential: isAlbumSequential(a, b),
                                   forceBeats: forceBeats)
        // Musical never beatmixes: it lets the song play out and slips into a
        // gentle 2.6 s fade. The .fade trigger below lands at dur - 2.6, so the
        // outgoing track reaches its natural end before the fade begins.
        if style.demotesBeatmix, case .beatmix = plan {
            plan = .fade(seconds: 2.6, why: "let the song play out")
        }
        var trigger: Double
        switch plan {
        case .gapless:
            trigger = max(position + 0.25, dur - 0.06)
        case .fade(let s, _):
            trigger = max(position + 0.25, dur - s)
        case .beatmix(_, let startA, _, _, _, _, _):
            if startA <= position + 1.5 {
                // The planned moment already passed (early out-region, late arm):
                // degrade honestly to a fade at the natural end.
                plan = .fade(seconds: 4, why: "missed the window")
                trigger = max(position + 0.25, dur - 4)
            } else {
                trigger = startA
            }
        }
        seamPlan = plan
        seamTriggerAt = trigger
        seamNextReady = false

        // Preload B on the idle deck: decoded and silent, waiting for its cue.
        let other = 1 - activeDeck
        let gen = generation
        seamLoadTask?.cancel()
        seamLoadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let url = try await self.loader.localFile(for: b)
                guard !Task.isCancelled, gen == self.generation, self.seamPlan != nil else { return }
                // Decoded off the main actor, like materialize: the seam's
                // preload was the other visible hitch, ~90 s before every end.
                let file = try await Task.detached(priority: .userInitiated) {
                    try DeckEngine.openFile(url)
                }.value
                guard !Task.isCancelled, gen == self.generation, self.seamPlan != nil else { return }
                // The idle deck is re-purposed here: a deferred stop still
                // aimed at it (a skip's fade on a short track) is now stale,
                // and the quiesce + load below are its honest replacement.
                self.deckClaim[other] += 1
                await self.quiesce(deck: other)
                guard !Task.isCancelled, gen == self.generation, self.seamPlan != nil else { return }
                let durB = try self.engine.load(deck: other, file: file)
                self.deckDuration[other] = durB
                // The catalog's in-point against the decoded file: a start at
                // or past the real end would be a silent B, so it is held at
                // least a second inside the file.
                if case .beatmix(let beats, let startA, let startB, let bpmA, let bpmB, let fold, let secs)? = self.seamPlan,
                   durB > 0 {
                    let clamped = min(startB, max(0, durB - 1.0))
                    if clamped < startB {
                        self.seamPlan = .beatmix(beats: beats, startA: startA, startB: clamped,
                                                 bpmA: bpmA, bpmB: bpmB, fold: fold, seconds: secs)
                    }
                }
                self.restDeck(other)
                self.engine.setNorm(deck: other, b.normLin)
                self.engine.rampVolume(deck: other, to: 0, over: 0.005)
                self.seamNextReady = true
            } catch {
                // Stays unready; the end-of-track fallback hard-advances instead.
            }
        }
    }

    private func beginSeam(_ plan: TransitionPlan, duration dur: Double) {
        guard !seamRunning else { return }
        seamRunning = true
        let outDeck = activeDeck
        let inDeck = 1 - activeDeck
        let nextIdx = currentIndex + 1
        // The plan speaks in TRACK seconds; the render clock and the sleeps
        // run in WALL seconds. At 1.25x a 4 s fade is 3.2 s of listening.
        let spd = max(speed, 0.05)
        let delta = max(0, seamTriggerAt - position) / spd

        switch plan {
        case .gapless:
            // 0.06 s butt join at full volume: the artist sequenced this;
            // the player only removes the silence.
            engine.rampVolume(deck: inDeck, to: 1, over: 0.005)
            engine.play(deck: inDeck, atOffset: 0, in: delta)
            let t = Task { [weak self] in
                await sleepSeconds(delta + 0.25)
                guard let self, !Task.isCancelled else { return }
                self.finishSeam(nextIndex: nextIdx, from: outDeck, to: inDeck)
            }
            seamTasks.append(t)

        case .fade(let trackSeconds, let why):
            statusLine = "fade — \(why)"
            let seconds = trackSeconds / spd
            engine.play(deck: inDeck, atOffset: 0, in: delta)
            let t = Task { [weak self] in
                await sleepSeconds(delta)
                guard let self, !Task.isCancelled else { return }
                // Outgoing dives through a closing filter and gives up its bass;
                // incoming rises clean and open. Equal power both ways.
                self.engine.rampVolume(deck: inDeck, to: 1, over: seconds)
                self.engine.rampVolume(deck: outDeck, to: 0, over: seconds)
                self.engine.sweepLowPass(deck: outDeck, toHz: 300, over: seconds)
                self.engine.setLowShelfGain(deck: outDeck, dB: -22, over: seconds)
                await sleepSeconds(seconds)
                guard !Task.isCancelled else { return }
                self.finishSeam(nextIndex: nextIdx, from: outDeck, to: inDeck)
            }
            seamTasks.append(t)

        case .beatmix(let beats, _, let startB, let bpmA, let bpmB, let fold, let trackSeconds):
            statusLine = "beatmix — \(Int(beats)) beats"
            let seconds = trackSeconds / spd
            // B enters tempo-matched to A and bass-ducked: one bassline at a time.
            applyDeckRate(deck: inDeck, rate: fold)
            engine.setLowShelfGain(deck: inDeck, dB: -14, over: 0.005)
            engine.rampVolume(deck: inDeck, to: 0, over: 0.005)
            // The start is scheduled on the render clock: when A's playhead
            // reaches startA, B's reaches startB — phase correct by construction.
            engine.play(deck: inDeck, atOffset: startB, in: delta)
            let t = Task { [weak self] in
                await sleepSeconds(delta)
                guard let self, !Task.isCancelled else { return }
                self.engine.rampVolume(deck: inDeck, to: 1, over: seconds)
                self.engine.rampVolume(deck: outDeck, to: 0, over: seconds)
                self.glideTask = self.runGlide(bpmA: bpmA, bpmB: bpmB, seconds: seconds,
                                               outDeck: outDeck, inDeck: inDeck)
                // Bass hand-off across ~2 beats centered on the seam midpoint.
                let win = max(0.05, (2.0 / max(4.0, beats)) * seconds)
                let untilSwap = max(0, seconds * 0.5 - win * 0.5)
                await sleepSeconds(untilSwap)
                guard !Task.isCancelled else { return }
                self.engine.setLowShelfGain(deck: inDeck, dB: 0, over: win)
                self.engine.setLowShelfGain(deck: outDeck, dB: -14, over: win)
                await sleepSeconds(max(0, seconds - untilSwap))
                guard !Task.isCancelled else { return }
                self.finishSeam(nextIndex: nextIdx, from: outDeck, to: inDeck)
            }
            seamTasks.append(t)
        }
    }

    /// Apply a deck's glide rate, composed with the SPEED dial and honouring
    /// key lock: on, the time-stretcher holds the pitch; off, the pitch rides
    /// the tempo like vinyl (DeckEngine turns the rate into cents).
    private func applyDeckRate(deck: Int, rate: Double) {
        guard deckGlide.indices.contains(deck) else { return }
        deckGlide[deck] = rate
        engine.setRate(deck: deck, rate: Float(rate * speed), keyLock: keyLock)
    }

    /// One master tempo line, stepped at 10 Hz across the overlap. The outgoing
    /// deck is "current" until the flip, so its rate is what the analyzer hears.
    private func runGlide(bpmA: Double, bpmB: Double, seconds: Double,
                          outDeck: Int, inDeck: Int) -> Task<Void, Never> {
        Task { [weak self] in
            // Monotonic: a wall-clock step mid-blend must never stall or snap the glide.
            let t0 = ProcessInfo.processInfo.systemUptime
            while !Task.isCancelled {
                guard let self else { return }
                let f = (ProcessInfo.processInfo.systemUptime - t0) / max(0.05, seconds)
                let r = MixPlanner.glideRates(bpmA: bpmA, bpmB: bpmB, f: f)
                self.applyDeckRate(deck: outDeck, rate: r.rateA)
                self.applyDeckRate(deck: inDeck, rate: r.rateB)
                self.activeRate = r.rateA
                if f >= 1 { return }
                await sleepSeconds(0.1)
            }
        }
    }

    private func finishSeam(nextIndex: Int, from outDeck: Int, to inDeck: Int) {
        guard seamRunning else { return }
        let posA = engine.position(deck: outDeck) ?? position
        if let a = current {
            let durA = a.duration ?? (deckDuration[outDeck] > 0 ? deckDuration[outDeck] : nil)
            let completed = durA.map { posA >= $0 - 1.5 } ?? true
            library.recordPlay(key: a.id, playedSeconds: playedSecondsThisTrack,
                               duration: durA, completed: completed)
        }
        playedSecondsThisTrack = 0
        engine.stop(deck: outDeck)
        // A seam hands back exactly what it borrowed: rate 1, shelf 0, filter open.
        restDeck(outDeck)
        restDeck(inDeck)
        glideTask?.cancel()
        glideTask = nil
        seamTasks.removeAll()
        seamPlan = nil
        seamNextReady = false
        seamRunning = false
        activeDeck = inDeck
        activeRate = 1
        failureStreak = 0
        if queue.indices.contains(nextIndex) { currentIndex = nextIndex }
        position = engine.position(deck: inDeck) ?? 0
        deckReady = true
        statusLine = ""
        if let nxt = peekNext() { loader.prefetch(nxt) }
        analyzer.setClock(playhead: position, mix: current?.mix, rate: speed)
        library.saveTransport(snapshot())
    }

    private func cancelSeam() {
        seamLoadTask?.cancel()
        seamLoadTask = nil
        for t in seamTasks { t.cancel() }
        seamTasks.removeAll()
        glideTask?.cancel()
        glideTask = nil
        let hadSeam = seamPlan != nil || seamRunning
        let wasRunning = seamRunning
        let other = 1 - activeDeck
        seamPlan = nil
        seamNextReady = false
        seamRunning = false
        guard hadSeam else { return }
        deckClaim[other] += 1        // this stop is the authority; a deferred one is stale
        engine.stop(deck: other)
        restDeck(other)
        if wasRunning {
            // Torn down early, the seam still hands back what it borrowed.
            restDeck(activeDeck)
            engine.rampVolume(deck: activeDeck, to: 1, over: 0.2)
            activeRate = 1
        }
    }

    // MARK: - the soak (CI only)

    /// CI's endurance run: `--soak` starts the nonstop mix as soon as the
    /// library lands and then hurries the transport — four seconds into each
    /// track it jumps to 28 s before the end (every fourth track it skips
    /// instead), so a seam or a hard switch fires every ~30 s and an hour of
    /// track changes fits in a CI job. Never on for a listener.
    static let soak = ProcessInfo.processInfo.arguments.contains("--soak")
    private var soakStarted = false
    private var soakTracks = 0
    private var soakKey: String?
    private var soakEnteredAt: TimeInterval = 0
    private var soakJumped = false
    private var soakReportAt: TimeInterval = 0

    func startSoakIfAsked(catalog: Catalog) {
        guard Self.soak, !soakStarted else { return }
        soakStarted = true
        NSLog("AethraKairos soak: starting the nonstop mix over %d tracks", catalog.tracks.count)
        playEverything(in: catalog)
    }

    private func soakTick() {
        let now = ProcessInfo.processInfo.systemUptime
        if now - soakReportAt >= 30 {
            soakReportAt = now
            NSLog("AethraKairos soak: footprint %.0f MB, engine %@, playing %@, track %d, status '%@'",
                  Self.footprintMB(), engine.isEngineRunning ? "running" : "stopped",
                  isPlaying ? "yes" : "no", soakTracks, statusLine)
        }
        guard isPlaying, !seamRunning, let t = current, let dur = currentDuration else { return }
        if t.id != soakKey {
            soakKey = t.id
            soakTracks += 1
            soakEnteredAt = now
            soakJumped = false
            NSLog("AethraKairos soak: track %d - %@ (%.0f s)", soakTracks, t.title, dur)
            return
        }
        guard !soakJumped, now - soakEnteredAt >= 4, position < dur - 32 else { return }
        soakJumped = true
        if soakTracks % 4 == 0, hasNext() {
            next()
        } else {
            seek(to: dur - 28)
        }
    }

    /// The process's physical footprint — the number jetsam judges an app by.
    static func footprintMB() -> Double {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let kr = withUnsafeMutablePointer(to: &info) { p in
            p.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        return kr == KERN_SUCCESS ? Double(info.phys_footprint) / 1_048_576 : -1
    }
}
