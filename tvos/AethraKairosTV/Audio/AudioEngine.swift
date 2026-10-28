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
    /// The one tap consumer's handler, kept so a restart after an output
    /// change can put the tap back without the Player re-supplying it.
    private var tapHandler: ((AVAudioPCMBuffer, AVAudioTime) -> Void)?

    /// A verdict about the TRACK (no such deck, a file that will not open or
    /// has no frames) — the Player counts these toward its three strikes;
    /// an engine that will not start is never one of these.
    enum DeckError: Error { case badIndex, badFile }

    /// Called on the main queue when the engine stopped itself because the
    /// output hardware changed under it (see init).
    var onConfigurationChange: (() -> Void)?
    private var configObserver: NSObjectProtocol?

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
            shelf.bypass = true          // flat is bypassed, not processed (see setRate)
            // Band 1 is the fade filter: wide open until a seam borrows it.
            let lp = d.eq.bands[1]
            lp.filterType = .resonantLowPass
            lp.frequency = Self.filterOpenHz
            lp.bandwidth = 1.9 // ~Q 0.7, the web player's fade-filter slope
            lp.bypass = true             // wide open is bypassed, not processed
            d.eq.globalGain = 0
            d.timePitch.bypass = true    // unity speed is bypassed, not processed

            engine.connect(d.player, to: d.timePitch, format: defaultFormat)
            engine.connect(d.timePitch, to: d.eq, format: defaultFormat)
            engine.connect(d.eq, to: d.mixer, format: defaultFormat)
            engine.connect(d.mixer, to: engine.mainMixerNode, format: nil)
            d.connectedFormat = defaultFormat
            d.mixer.outputVolume = 1
        }
        engine.prepare()

        // THE OUTPUT CHANGED, SO THE ENGINE STOPPED. When the hardware under
        // AVAudioEngine renegotiates — the TV or soundbar re-handshaking HDMI,
        // an eARC/CEC wake, AirPods or an AirPlay speaker taking the route,
        // a sample-rate or channel-count change — the engine stops itself and
        // every player node with it. Nothing errors and nothing else says so:
        // the transport still reads "playing", the clock freezes, the room
        // goes quiet. That is the Apple TV's "it pauses at random". The nodes
        // stay attached and connected, so the cure is to start the engine and
        // reschedule from where the music was — which the Player owns.
        configObserver = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
        ) { [weak self] _ in
            self?.onConfigurationChange?()
        }
    }

    deinit {
        if let o = configObserver { NotificationCenter.default.removeObserver(o) }
    }

    /// True while the engine runs AND the deck's player node is playing (a
    /// delayed start counts: it is committed to the render clock).
    func isLive(deck i: Int) -> Bool {
        guard let d = deck(i) else { return false }
        return engine.isRunning && d.player.isPlaying
    }

    /// The engine's own word: false before the first start, after a failed
    /// start, and after an output change stopped it.
    var isEngineRunning: Bool { engine.isRunning }

    /// Starts the engine when it is not running — every cold start first makes
    /// the graph honest (reconfigureAfterOutputChange: a stopped engine may
    /// have been stopped by an output change nobody acted on, e.g. while the
    /// transport was paused) — and, on any start, puts the analysis tap back
    /// if that evicted it. Main thread only — every start, stop and connect
    /// in this class is.
    func startEngineIfNeeded() throws {
        if !engine.isRunning {
            reconfigureAfterOutputChange()
            try engine.start()
        }
        if !tapInstalled, let handler = tapHandler {
            // Installed AFTER the start, so format:nil binds to the mixer's
            // freshly negotiated output format and never to a stale one.
            engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: nil, block: handler)
            tapInstalled = true
        }
    }

    /// THE OUTPUT CHANGED; MAKE THE GRAPH HONEST BEFORE THE RESTART. After an
    /// AVAudioEngineConfigurationChange the main mixer's output format may
    /// have moved (44.1 <-> 48 kHz, 2 <-> 6/8 channels on an HDMI receiver,
    /// an AirPlay speaker), and a tap bound to the OLD format is one of the
    /// documented ways to hit AVFAudio's uncatchable "required condition is
    /// false" abort on the next start — the living-room crash. So: drop the
    /// tap (startEngineIfNeeded re-installs it after the start), re-assert
    /// any deck -> main mixer connection the change dissolved, and prepare()
    /// again. A running engine has a valid graph by definition and is left
    /// alone.
    func reconfigureAfterOutputChange() {
        guard !engine.isRunning else { return }
        let main = engine.mainMixerNode
        if tapInstalled {
            main.removeTap(onBus: 0)
            tapInstalled = false
        }
        for d in decks where engine.outputConnectionPoints(for: d.mixer, outputBus: 0).isEmpty {
            engine.connect(d.mixer, to: main, format: nil)
        }
        engine.prepare()
    }

    /// For a media-services reset: every AVFAudio object is dead and the
    /// owner is about to build a fresh DeckEngine. Let go of the tap and the
    /// callback and stop what can still be stopped, so the old graph is never
    /// touched again.
    func teardown() {
        onConfigurationChange = nil
        if tapInstalled {
            engine.mainMixerNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        tapHandler = nil
        engine.stop()
    }

    // MARK: - Transport (deck indices 0/1)

    /// Opens a file for a deck and forces its frame count. Static and free of
    /// engine state on purpose: the Player calls it from a detached task, so
    /// an MP3 header/VBR scan (`length` on a file without a Xing frame walks
    /// every packet) never stalls the main thread. A file that will not open
    /// or has no frames is a bad TRACK and says so.
    static func openFile(_ url: URL) throws -> AVAudioFile {
        let file: AVAudioFile
        do {
            file = try AVAudioFile(forReading: url)
        } catch {
            NSLog("AethraKairos: cannot open %@ — %@", url.lastPathComponent, String(describing: error))
            throw DeckError.badFile
        }
        guard file.processingFormat.sampleRate > 0, file.length > 0 else { throw DeckError.badFile }
        return file
    }

    /// Opens the file and rewires the deck chain to its native format so the
    /// player never resamples behind our back. Returns the duration in seconds.
    /// (The synchronous form; the Player opens off-main and uses load(deck:file:).)
    func load(deck i: Int, fileURL: URL) throws -> Double {
        let file = try Self.openFile(fileURL)
        return try load(deck: i, file: file)
    }

    /// Takes an already-open file (see openFile) and rewires the deck chain to
    /// its native format. Main thread only — the connects are graph updates.
    /// The caller has ramped a still-audible deck to silence first (the
    /// Player's quiesce); the stop here claims a new play, so a completion
    /// the stop fires is stale by the time anyone reads it.
    func load(deck i: Int, file: AVAudioFile) throws -> Double {
        guard let d = deck(i) else { throw DeckError.badIndex }
        let fmt = file.processingFormat
        guard fmt.sampleRate > 0, file.length > 0 else { throw DeckError.badFile }

        d.playClaim &+= 1
        d.player.stop()
        let matches = d.connectedFormat.map {
            $0.sampleRate == fmt.sampleRate && $0.channelCount == fmt.channelCount
        } ?? false
        NSLog("AethraKairos: deck %d loads %.0f Hz / %u ch%@", i, fmt.sampleRate, fmt.channelCount,
              matches ? "" : (engine.isRunning ? " — REWIRING LIVE" : " — rewiring (engine stopped)"))
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
        do {
            try startEngineIfNeeded()
        } catch {
            // Not swallowed: a start that keeps failing is the story the
            // crash log needs, and the guard below declines on its behalf.
            NSLog("AethraKairos: engine start failed before play on deck %d — %@", i, String(describing: error))
        }
        /* A PLAYER NEVER STARTS ON A STOPPED ENGINE. AVAudioPlayerNode.play()
           on an engine that is not running raises an Objective-C exception — a
           hard crash no Swift code can catch — and the engine can be stopped
           out from under us at any moment (an output renegotiating, Siri, a
           route change). This used to try the start, ignore the failure and
           call play() anyway. Now it declines: nothing plays for a beat, and
           the Player's liveness guard asks again twice a second until the
           engine is back, then resumes at the spot. */
        guard engine.isRunning else {
            NSLog("AethraKairos: engine not running — deferring play on deck %d", i)
            return
        }
        let sr = file.processingFormat.sampleRate
        guard sr > 0 else { return }
        let length = file.length
        // A NaN or infinite offset is a bug upstream, never a frame number:
        // it plays from the top rather than trapping in the conversion.
        let seconds = offset.isFinite ? max(0, offset) : 0
        let frames = seconds * sr
        let startFrame: AVAudioFramePosition
        if frames < Double(length) {
            startFrame = AVAudioFramePosition(frames)
        } else {
            // Past the end of the decoded file (a republished, shorter encode
            // under a catalog in-point): play from the top, audibly, instead
            // of scheduling nothing and leaving the seam a silent deck.
            NSLog("AethraKairos: offset %.2f s is past the end of deck %d (%.2f s) — playing from 0",
                  seconds, i, Double(length) / sr)
            startFrame = 0
        }
        let remaining = length - startFrame
        guard remaining > 0 else { return }
        let count = AVAudioFrameCount(clamping: remaining)

        // EVERY SCHEDULED PLAY CARRIES A CLAIM. The completion below hands it
        // back once the data has PLAYED (not merely been consumed), and
        // didFinish believes a claim only while it is still the current one —
        // a completion fired by this stop, or by a later re-schedule, is
        // stale by construction and never advances the transport.
        d.playClaim &+= 1
        let claim = d.playClaim
        d.finishedClaim = 0
        d.player.stop()
        // The engine can stop itself on the audio thread at any moment; the
        // window between the guard above and the calls that would raise is
        // narrowed by asking again right before each one. Only an Objective-C
        // @try could close it entirely.
        guard engine.isRunning else {
            NSLog("AethraKairos: engine stopped before schedule on deck %d — deferring", i)
            return
        }
        d.player.scheduleSegment(file, startingFrame: startFrame, frameCount: count, at: nil,
                                 completionCallbackType: .dataPlayedBack) { [weak d] _ in
            d?.finishedClaim = claim
        }
        d.segmentBase = Double(startFrame) / sr
        d.lastKnownPosition = d.segmentBase

        guard engine.isRunning else {
            NSLog("AethraKairos: engine stopped before play on deck %d — deferring", i)
            return
        }
        // A delay that is not a number, or longer than any seam, starts now.
        let delay = when.isFinite ? min(max(0, when), 3600) : 0
        if delay > 0 {
            // Delayed starts live on the render clock so both decks share one
            // origin; host time is the fallback before the first render.
            if let rt = d.player.lastRenderTime, rt.isSampleTimeValid {
                let rsr = rt.sampleRate > 0 ? rt.sampleRate : sr
                let at = AVAudioTime(sampleTime: rt.sampleTime + AVAudioFramePosition(delay * rsr), atRate: rsr)
                d.player.play(at: at)
            } else {
                let at = AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: delay))
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
        d.playClaim &+= 1            // a completion this stop fires is stale
        d.player.stop()
        d.lastKnownPosition = nil
        d.segmentBase = 0
    }

    /// True once the deck's CURRENT scheduled segment has been played back to
    /// its last frame — the deck's own word that the track is over, which the
    /// transport advances on instead of waiting for a clock to reach a
    /// catalog figure the file may never contain. A stopped or re-scheduled
    /// segment never reports: its claim is old.
    func didFinish(deck i: Int) -> Bool {
        guard let d = deck(i) else { return false }
        let claim = d.playClaim
        return claim > 0 && d.finishedClaim == claim
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
        if let pos = livePosition(of: d) {
            // Remembered on every read: when the engine is stopped out from
            // under a deck (see init) the player time is gone, and this is the
            // last honest word on where the music was — a poll old at most.
            d.lastKnownPosition = pos
            return pos
        }
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

    /// Tempo, and the choice that rides with it. Key lock ON (the default) is
    /// the time-stretcher: the tempo bends, the pitch holds. Key lock OFF is
    /// vinyl — the pitch rides the tempo, 1200·log2(rate) cents, exactly what
    /// a turntable does at +3% (a third of a semitone sharp) and free of the
    /// stretcher's artefacts over a small trim. A DJ's call, so it is a setting.
    func setRate(deck i: Int, rate: Float, keyLock: Bool = true) {
        guard let d = deck(i) else { return }
        let r = max(0.03125, min(32, rate))
        d.timePitch.rate = r
        d.timePitch.pitch = keyLock ? 0 : 1200 * log2(r)
        /* AT UNITY THE STRETCHER IS BYPASSED. AVAudioUnitTimePitch is a phase
           vocoder, and it does NOT pass audio through untouched at rate 1: it
           still chops the signal into overlapping frames and resynthesises it,
           which smears transients and hollows the mids — "like hearing it
           through a shoebox". It sat in every deck's path permanently, so
           every track was played through it. Now it engages only while a
           blend is actually bending the tempo (or the SPEED dial is off 1×),
           and the rest of the time the deck plays the file untouched. */
        d.timePitch.bypass = abs(r - 1) < 1e-4
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
                d?.eq.bands[0].bypass = abs(val) < 0.05     // flat shelf: out of the path
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
                d?.eq.bands[1].bypass = val >= Self.filterOpenHz - 1  // wide open: out of the path
            }
        }
    }

    /// A seam hands back exactly what it borrowed: rate 1, shelf flat,
    /// filter wide open. Short ramps, because even restitution is ramped.
    func resetDeckDSP(deck i: Int) {
        guard let d = deck(i) else { return }
        d.timePitch.rate = 1
        d.timePitch.pitch = 0
        d.timePitch.bypass = true
        rampQueue.async {
            d.shelfRamp.ramp(to: 0, over: 0.05, curve: .linear) { [weak d] val in
                d?.eq.bands[0].gain = val
                d?.eq.bands[0].bypass = abs(val) < 0.05
            }
            d.filterRamp.ramp(to: Self.filterOpenHz, over: 0.05, curve: .exponential) { [weak d] val in
                d?.eq.bands[1].frequency = val
                d?.eq.bands[1].bypass = val >= Self.filterOpenHz - 1
            }
        }
    }

    // MARK: - Analysis tap

    /// Installs the analysis tap on mainMixerNode (4096-frame buffers) —
    /// exactly one consumer, so a re-install evicts the previous tap.
    func installTap(_ handler: @escaping (AVAudioPCMBuffer, AVAudioTime) -> Void) {
        tapHandler = handler
        let main = engine.mainMixerNode
        if tapInstalled {
            main.removeTap(onBus: 0)
        }
        // Ask small: the OS may still deliver ~100 ms buffers, but when it
        // honours the request the analyzer's publishes get 4x fresher. The
        // hop pipeline inside the analyzer handles either granularity.
        main.installTap(onBus: 0, bufferSize: 1024, format: nil, block: handler)
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

    /// The claim of the most recent schedule or stop (caller's thread), and
    /// the claim the player's completion handed back — lock-guarded, because
    /// the completion fires on an AVFAudio internal queue, never ours.
    var playClaim: Int = 0
    private let finishLock = NSLock()
    private var finishedClaimStorage = 0
    var finishedClaim: Int {
        get {
            finishLock.lock()
            defer { finishLock.unlock() }
            return finishedClaimStorage
        }
        set {
            finishLock.lock()
            finishedClaimStorage = newValue
            finishLock.unlock()
        }
    }

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
