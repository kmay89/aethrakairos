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
/// engine's render-clock scheduling, not to these timers.
private func sleepSeconds(_ s: Double) async {
    guard s > 0 else { return }
    try? await Task.sleep(nanoseconds: UInt64(s * 1_000_000_000))
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
    /// Key-lock preserves pitch under tempo glide (default). See applyDeckRate
    /// for what key-lock-off can and cannot honestly do on the wave-1 engine.
    @Published var keyLock: Bool = true { didSet { persistSettings() } }

    let analyzer = Analyzer()

    /// Catalog context for key lookups and cover metadata (internal — the
    /// NowPlayingCenter reads artist/label/albums from here).
    private(set) var catalog: Catalog?

    private let engine = DeckEngine()
    private let loader = TrackLoader()
    private let library: Library

    private var activeDeck = 0
    private var activeRate: Double = 1
    private var deckReady = false
    private var deckDuration: [Double] = [0, 0]
    private var deckClaim = [0, 0]          // stale deferred stops must not kill a re-used deck
    private var shuffle = false
    private var generation = 0              // one materialization wins; stale loads drop out
    private var playedSecondsThisTrack: Double = 0
    private var failureStreak = 0
    private var suppressPositionUntil = Date.distantPast

    private var pollTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?
    private var pendingOpTask: Task<Void, Never>?

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
        // One .playback declaration for the app's lifetime — the session is
        // configured here and nowhere else.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
        // Exactly one tap consumer: the analyzer is the ears; nothing else listens.
        let analyzer = self.analyzer
        engine.installTap { buffer, when in
            analyzer.ingest(buffer: buffer, when: when)
        }
        startPollLoop()
    }

    // MARK: transport

    func setQueue(_ tracks: [Track], startAt index: Int, autoplay: Bool) {
        recordHistoryForCurrent()
        cancelSeam()
        stopActiveDeckDeferred()
        isPlaying = false
        queue = tracks
        guard !tracks.isEmpty else {
            currentIndex = -1
            position = 0
            deckReady = false
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

    func toggle() {
        if isPlaying { pause() } else { play() }
    }

    func play() {
        if currentIndex < 0 {
            if !queue.isEmpty { materialize(index: 0, startAt: 0, autoplay: true) }
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
        try? engine.startEngineIfNeeded()
        // A paused deck is inaudible, so re-scheduling from the held position is
        // not a seek of an audible deck.
        engine.stop(deck: activeDeck)
        engine.rampVolume(deck: activeDeck, to: 1, over: 0.06)
        engine.play(deck: activeDeck, atOffset: offset, in: 0)
        isPlaying = true
        statusLine = ""
        analyzer.setClock(playhead: offset, mix: current?.mix, rate: 1)
    }

    func pause() {
        guard isPlaying else { return }
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
        hardSwitch(to: currentIndex + 1, startAt: 0, autoplay: true, fade: mixStyle.quickFade)
    }

    func prev() {
        guard currentIndex >= 0 else { return }
        let target = currentIndex > 0 ? currentIndex - 1 : 0
        hardSwitch(to: target, startAt: 0, autoplay: true, fade: mixStyle.quickFade)
    }

    func seek(to seconds: Double) {
        guard currentIndex >= 0 else { return }
        cancelSeam()   // the playhead moved; any armed plan is stale
        var s = max(0, seconds)
        if let dur = currentDuration { s = min(s, max(0, dur - 0.25)) }
        position = s
        guard deckReady else { return }   // restored-but-unmaterialized: the offset waits for play()
        if isPlaying {
            let deck = activeDeck
            let gen = generation
            suppressPositionUntil = Date().addingTimeInterval(0.4)
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
        analyzer.setClock(playhead: s, mix: current?.mix, rate: isPlaying ? activeRate : 0)
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

    private var currentDuration: Double? {
        if let d = current?.duration, d > 0 { return d }
        let d = deckDuration[activeDeck]
        return d > 0 ? d : nil
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

    /// Mixing preferences are small and non-secret — UserDefaults is the right
    /// size. Written on every change via the properties' didSet.
    private func persistSettings() {
        UserDefaults.standard.set(mixStyle.rawValue, forKey: Self.mixStyleKey)
        UserDefaults.standard.set(keyLock, forKey: Self.keyLockKey)
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
        position = max(0, offset)
        deckReady = false
        playedSecondsThisTrack = 0
        let track = queue[index]
        statusLine = "materializing…"
        loadTask?.cancel()
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let url = try await self.loader.localFile(for: track)
                guard gen == self.generation, !Task.isCancelled else { return }
                try self.engine.startEngineIfNeeded()
                let dur = try self.engine.load(deck: deck, fileURL: url)
                guard gen == self.generation else { return }
                self.deckDuration[deck] = dur
                self.engine.resetDeckDSP(deck: deck)
                self.engine.setNorm(deck: deck, track.normLin)
                self.deckReady = true
                self.failureStreak = 0
                self.statusLine = ""
                if autoplay {
                    try? AVAudioSession.sharedInstance().setActive(true)
                    self.engine.rampVolume(deck: deck, to: 1, over: 0.06)
                    self.engine.play(deck: deck, atOffset: self.position, in: 0)
                    self.isPlaying = true
                } else {
                    self.engine.rampVolume(deck: deck, to: 1, over: 0.005)
                    self.isPlaying = false
                }
                self.activeRate = 1
                self.analyzer.setClock(playhead: self.position, mix: track.mix,
                                       rate: self.isPlaying ? 1 : 0)
                if let nxt = self.peekNext() { self.loader.prefetch(nxt) }
                self.library.saveTransport(self.snapshot())
            } catch {
                guard gen == self.generation, !Task.isCancelled else { return }
                self.isPlaying = false
                self.statusLine = "couldn't load — \(track.title)"
                // Three strikes then stop honestly, instead of marching silently
                // through the whole catalog.
                if autoplay, self.failureStreak < 3, self.hasNext() {
                    self.failureStreak += 1
                    self.hardSwitch(to: self.currentIndex + 1, startAt: 0, autoplay: true)
                }
            }
        }
    }

    private func hardSwitch(to index: Int, startAt: Double, autoplay: Bool, fade: Double = 0.25) {
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
        let old = activeDeck
        let claim = deckClaim[old]
        if engine.isPlaying(deck: old) {
            let f = max(0.05, fade)
            engine.rampVolume(deck: old, to: 0, over: f)
            Task { [weak self] in
                await sleepSeconds(f + 0.05)
                guard let self, self.deckClaim[old] == claim else { return }
                self.engine.stop(deck: old)
                self.engine.resetDeckDSP(deck: old)
            }
        } else {
            engine.stop(deck: old)
            engine.resetDeckDSP(deck: old)
        }
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
        if isPlaying {
            if Date() >= suppressPositionUntil, let p = engine.position(deck: activeDeck) {
                position = p
            }
            playedSecondsThisTrack += 0.25
        }
        // The clock truth flows one way: latency-compensated playhead into the
        // analyzer, every poll — the beat grid is authoritative when mix exists.
        let compensated = position - engine.outputLatency * (isPlaying ? activeRate : 0)
        analyzer.setClock(playhead: max(0, compensated), mix: current?.mix,
                          rate: isPlaying ? activeRate : 0)
        library.saveTransport(snapshot())   // Library throttles internally (>= 1 s)

        guard isPlaying, let dur = currentDuration, dur > 0 else { return }

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
            if hasNext(), seamPlan == nil || !seamNextReady, position >= dur - 0.30 {
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
                try self.engine.startEngineIfNeeded()
                let durB = try self.engine.load(deck: other, fileURL: url)
                self.deckDuration[other] = durB
                self.engine.resetDeckDSP(deck: other)
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
        let delta = max(0, seamTriggerAt - position)

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

        case .fade(let seconds, let why):
            statusLine = "fade — \(why)"
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

        case .beatmix(let beats, _, let startB, let bpmA, let bpmB, let fold, let seconds):
            statusLine = "beatmix — \(Int(beats)) beats"
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

    /// Apply a deck's tempo rate, honoring keyLock.
    ///
    /// keyLock == true (the default) is the pitch-preserving time-stretch that
    /// DeckEngine.setRate already performs (AVAudioUnitTimePitch.rate). keyLock
    /// == false would ride pitch like vinyl — pitch = 1200*log2(rate) cents —
    /// but the wave-1 DeckEngine exposes only setRate, no lever on the time-
    /// pitch unit's pitch. Reaching AVAudioUnitTimePitch.pitch means editing
    /// AudioEngine.swift, which is not this file's to touch, so key-lock-off
    /// honestly degrades to key-lock-on rather than faking a pitch ride.
    private func applyDeckRate(deck: Int, rate: Double) {
        _ = keyLock   // key-lock-off pitch ride is a no-op — no pitch lever here.
        engine.setRate(deck: deck, rate: Float(rate))
    }

    /// One master tempo line, stepped at 10 Hz across the overlap. The outgoing
    /// deck is "current" until the flip, so its rate is what the analyzer hears.
    private func runGlide(bpmA: Double, bpmB: Double, seconds: Double,
                          outDeck: Int, inDeck: Int) -> Task<Void, Never> {
        Task { [weak self] in
            let t0 = Date()
            while !Task.isCancelled {
                guard let self else { return }
                let f = Date().timeIntervalSince(t0) / max(0.05, seconds)
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
        engine.resetDeckDSP(deck: outDeck)
        engine.resetDeckDSP(deck: inDeck)
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
        analyzer.setClock(playhead: position, mix: current?.mix, rate: 1)
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
        engine.stop(deck: other)
        engine.resetDeckDSP(deck: other)
        if wasRunning {
            // Torn down early, the seam still hands back what it borrowed.
            engine.resetDeckDSP(deck: activeDeck)
            engine.rampVolume(deck: activeDeck, to: 1, over: 0.2)
            activeRate = 1
        }
    }
}
