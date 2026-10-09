import Foundation
import simd

/* ================================================================
   THE DANCE BUS — twelve floats, one pure stepper, both stages.
   The rooms were copying raw bands and the governed beat straight into
   exposure, size and position, frame by frame: the picture JITTERED.
   The bus is the body between the music and the drawing — each voice
   of the music moves a different part of it, with weight and inertia,
   anticipation and follow-through, phrasing, and stillness when the
   music is still. Stepped ONCE per frame on the CPU (VisualizerView's
   draw(), after the ears) and delivered as the twelve floats appended
   to VizUniforms at bytes 144..191 — the same numbers the web's
   danceBusStep (docs/index.html, the @dance block) puts in uDance0/1/2,
   because this file is that function retold line for line: the same
   constants, the same order of operations, Float throughout, nothing
   allocated per frame. tests/player.test.mjs freezes a 480-frame trace
   of the web stepper; the port reproduces it (the hand trace lives in
   the stage-2 report). Every time constant is in BEATS (P = seconds per
   beat, clamped 0.3..1.0) so the body moves the same way at 90 and at
   174 BPM. Every value is finite, clamped, and defined in silence.
     0 dHit     0..1.5      the strike as LIGHT: kick/snare; a bare hat <= 0.25
     1 dAge     0..4        beats since the last real strike — a travel axis
     2 dKick   -0.35..1.25  the heavy body: a force-driven, signed spring
     3 dMass    0..1        the passage's weight (bass, slow)
     4 dArtic   0..1        articulation (the moving mid/treble contour)
     5 dSpark   0..1        the treble flick — light only
     6 dSway   -1..1        the bar (breath folded in at rest)
     7 dLift    0..1        the phrase
     8 dBrace   0..1        the coil before a drop (precognition)
     9 dImpact  0..8        beats since the landing; 8 when none
    10 dStill   0..1        the stillness gate
    11 dPeriod  0 | 0.3..1  seconds per beat; 0 when freewheeling
   Nothing an existing room reads changes meaning: the first 144 bytes
   of VizUniforms, onsetEnv, the bands and the phases keep their values.
   No room reads the twelve yet — the bus is live but invisible until
   the engine edits behind the web's DANCE.v2 land on both stages.
   ================================================================ */

/// The flash governor's tuning for dHit — the web's SAFE_TUNING and its
/// calm variant (SAFE.tuning()). Only the three fields the beat step reads.
struct DanceTuning {
    var pulseGap: Float        // s — full-amplitude pulses may not come faster
    var pulseAttack: Float     // s — a hit SNAPS (one frame at 60 fps)
    var softAmp: Float         // amplitude granted to pulses that arrive too soon
    static let standard = DanceTuning(pulseGap: 0.34, pulseAttack: 0.012, softAmp: 0.45)
    static let calm = DanceTuning(pulseGap: 0.42, pulseAttack: 0.03, softAmp: 0.4)
}

/// makeSafeBeatState / safeBeatStep, verbatim: rises are attack-limited, a
/// pulse that arrives faster than the gap passes at soft amplitude, and the
/// hit's full height is LATCHED (goal) so a high frame rate cannot soften a
/// downbeat by chasing the decayed source. Follows the source down.
struct DanceSafeBeat {
    var v: Float = 0
    var since: Float = 9
    var cap: Float = 1
    var prevRaw: Float = 0
    var goal: Float = 0

    mutating func step(_ raw: Float, dt: Float, tuning T: DanceTuning) -> Float {
        since += dt
        if raw > prevRaw + 0.25 {                     // rising edge: a new pulse
            cap = since >= T.pulseGap ? 1.5 : T.softAmp
            if cap > 1 { since = 0 }
            goal = min(raw, cap)
        }
        prevRaw = raw
        let target = min(raw, cap)
        let g = max(target, min(goal, cap))
        if g > v {
            v = min(g, v + dt / T.pulseAttack)
            if v >= goal { goal = 0 }                 // reached: follow the source again
        } else {
            goal = 0
            v = target                                // decay follows the source
        }
        return v
    }
}

/// THE HEAVY BODY — a spring at rest 0 struck by a FORCE PULSE, not a
/// velocity step: a raised cosine of width 0.12 P, so displacement rises
/// over 4-5 frames at 60 Hz and the eye infers a struck mass. omega_n = 8.4/P,
/// zeta 0.42 (0.55 calm), gain G so a unit strike peaks at 1.0. Signed:
/// below rest is the squash. The drive is integrated EXACTLY over the frame
/// (its mean force), so the impulse does not depend on the frame rate.
/// u is the drive's progress (0..1 live, 9 idle). makeDanceKick / danceKickStrike /
/// danceKickStep on the web.
struct DanceKick {
    var x: Float = 0
    var v: Float = 0
    var u: Float = 9
    var amp: Float = 0

    /// A strike on an idle body restarts the drive; one landing on a drive
    /// still in flight only raises it (a gradual rise counts once).
    mutating func strike(_ s: Float) {
        if u >= 1 { u = 0; amp = s } else { amp = max(amp, s) }
    }

    mutating func step(dt: Float, P: Float, calm: Bool) -> Float {
        let wn = DanceBus.omega / P
        let zeta = calm ? DanceBus.zetaCalm : DanceBus.zeta
        let G = calm ? DanceBus.gainCalm : DanceBus.gain
        let du = dt / (DanceBus.driveW * P)
        var drive: Float = 0
        if du > 0 && u < 1 {
            let lo = max(0, u)
            let hi = min(1, u + du)
            if hi > lo {
                // the integral of (1 - cos 2*pi*u) / 2 over the frame, as a mean force
                let twoPi = DanceBus.twoPi
                let area = 0.5 * ((hi - lo) - (sin(twoPi * hi) - sin(twoPi * lo)) / twoPi)
                drive = G * amp * area / du
            }
        }
        u = min(9, u + du)
        let r = DanceBus.springStep(x: x, v: v, drive: drive, dt: dt, k: wn * wn, c: 2 * zeta * wn)
        let vMax = 4 * wn                             // the rails: nothing here can run away
        x = r.x < -2 ? -2 : (r.x > 2 ? 2 : r.x)
        v = r.v < -vMax ? -vMax : (r.v > vMax ? vMax : r.v)
        return x
    }
}

/// THE LANDING, as a latch with a timeout (danceLandingStep). The moment
/// precognition first says a louder passage is coming (coming > 0.42) we
/// record WHEN (landAt = pos + lookahead) and HOW LOUD (the promised level);
/// we land when the playhead is within a quarter beat of that moment and the
/// present has reached 60 % of the promise — or at landAt + P/2 regardless,
/// so the latch can never hang. A seek backwards disarms it; no playhead, no
/// landing. The playhead is kept in Double because it is a clock in seconds
/// (a Float loses the quarter-beat an hour into a set); everything else is
/// Float. Levels are bass + 0.8 * punch.
struct DanceLanding {
    var armed = false
    var landAt: Double = 0
    var landLevel: Float = 0

    mutating func step(pos: Double?, coming: Float, here: Float, soon: Float,
                       P: Float, lookahead: Float) -> Bool {
        guard let pos, pos.isFinite else { armed = false; return false }
        let la = Double(lookahead)
        let p = Double(P)
        if armed && pos < landAt - la - 0.5 { armed = false }
        if !armed && coming > DanceBus.comingThreshold {
            armed = true
            landAt = pos + la
            landLevel = max(DanceBus.fin(soon, 0), DanceBus.fin(coming, 0))
        }
        if !armed { return false }
        let arrived = pos >= landAt - p / 4 && DanceBus.fin(here, 0) >= 0.6 * landLevel
        if arrived || pos >= landAt + p / 2 { armed = false; return true }
        return false
    }
}

/// The classifier's reading of one frame: onsets become VOICES.
struct DanceVoices {
    var kick: Float = 0
    var snare: Float = 0
    var hat: Float = 0
    var gate: Float = 1
}

/// A level the precognition reads from the score: env.sample's bass and punch.
struct DanceLevel {
    var bass: Float
    var punch: Float
}

/// One frame of inputs — the web stepper's `inp`, field for field. Missing
/// (non-finite) numbers are defaulted inside the step; the bus never emits a
/// NaN. `pos` nil means no playhead (the latch disarms); `here`/`soon` nil mean
/// no score (coming 0, the brace decays).
struct DanceInputs {
    var bass: Float = 0, mid: Float = 0, treble: Float = 0, energy: Float = 0
    var centroid: Float = 0                      // 0..1, optional on the web (the TV has none: 0)
    var rb: Float = 0, rm: Float = 0, rt: Float = 0, punch: Float = 0   // this step's rises, the onset's strength
    var period: Float = 0                        // s per beat, raw (the bus clamps)
    var haveGrid: Bool = false
    var beatIdx: Int = -1                        // beat in the bar 0..3, -1 none
    var barPhase: Float = 0, phrasePhase: Float = 0
    var ear: Float = 1                           // DANCE.ear 0..1
    var playing: Bool = false                    // the deck (or the mic) is live
    var breath: Float = 0                        // DANCE.breath -1..1
    var calm: Bool = false                       // IS_IOS || SAFE.calm -> zeta 0.55, the calm gain
    var pos: Double? = nil                       // the playhead, seconds
    var here: DanceLevel? = nil                  // env at pos + 0.08
    var soon: DanceLevel? = nil                  // env at pos + lookahead(P)
    var structure: Float = 0                     // a section turn's strength (stage 3; 0 today)
    var tuning: DanceTuning = .standard
}

/// The twelve, as three float4s — exactly the web's uDance0/1/2 — so the copy
/// into VizUniforms is twelve plain reads and nothing is allocated.
struct DanceBusOutput {
    var d0 = SIMD4<Float>(0, 4, 0, 0)            // hit, age, kick, mass
    var d1 = SIMD4<Float>(repeating: 0)          // artic, spark, sway, lift
    var d2 = SIMD4<Float>(0, 8, 0, 0)            // brace, impact, still, period

    static let count = 12
    /// DANCE_BUS.NAMES — the order of the twelve on every stage.
    static let names = ["dHit", "dAge", "dKick", "dMass", "dArtic", "dSpark",
                        "dSway", "dLift", "dBrace", "dImpact", "dStill", "dPeriod"]

    var hit: Float { d0.x }
    var age: Float { d0.y }
    var kick: Float { d0.z }
    var mass: Float { d0.w }
    var artic: Float { d1.x }
    var spark: Float { d1.y }
    var sway: Float { d1.z }
    var lift: Float { d1.w }
    var brace: Float { d2.x }
    var impact: Float { d2.y }
    var still: Float { d2.z }
    var period: Float { d2.w }

    subscript(_ i: Int) -> Float {
        switch i {
        case 0: return d0.x
        case 1: return d0.y
        case 2: return d0.z
        case 3: return d0.w
        case 4: return d1.x
        case 5: return d1.y
        case 6: return d1.z
        case 7: return d1.w
        case 8: return d2.x
        case 9: return d2.y
        case 10: return d2.z
        case 11: return d2.w
        default: return 0
        }
    }
}

/// The bus: everything the stepper remembers between frames (the web's
/// makeDanceBusState) plus the frame's voices as telemetry for the HUD.
/// `step(_:dt:)` is the pure core — danceBusStep line for line, checked
/// against the frozen trace; `step(frame:...)` is the TV's feed into it: the
/// ear and the breath (DANCE.update's own laws), the onset's strength from
/// onsetEnv's rising edge, the score read through Env.sample.
struct DanceBus {

    // MARK: DANCE_BUS — the constants, one set on both stages

    static let pMin: Float = 0.30, pMax: Float = 1.00        // s per beat
    static let omega: Float = 8.4                             // omega_n * P = 2*pi/0.75
    static let zeta: Float = 0.42, zetaCalm: Float = 0.55     // one rebound of ~23 %; calmer under CALM
    static let driveW: Float = 0.12                           // the force pulse's width in beats
    static let gain: Float = 3.41, gainCalm: Float = 3.86     // G: a unit strike peaks at 1.0 (pinned by the web test)
    static let strikeMin: Float = 0.35                        // a strike at least this strong resets dAge
    static let comingThreshold: Float = 0.42                  // precognition: "a louder passage is coming"
    static let twoPi: Float = 6.283185307179586

    // MARK: the state (makeDanceBusState)

    var beatPeriod: Float = 0.5                  // P, the clamped period this frame
    var voices = DanceVoices()                   // kick snare hat gate — this frame's voices
    var w: Float = 0                             // the light strike
    var s: Float = 0                             // the body's strike
    var coming: Float = 0                        // precognition's reading
    var landed = false                           // true on the one frame the landing fires
    var hit = DanceSafeBeat()                    // 0 dHit — the governor
    var strikeEnv: Float = 0                     //          the latched strike (release 0.3 P)
    var age: Float = 4                           // 1 dAge
    var ks = DanceKick()                         // 2 dKick — the spring
    var sPrev: Float = 0                         //           and the strike's edge detector
    var mass: Float = 0                          // 3
    var artic: Float = 0                         // 4
    var spark: Float = 0                         // 5
    var sway: Float = 0                          // 6
    var lift: Float = 0                          // 7
    var brace: Float = 0                         // 8
    var impactAge: Float = 8                     // 9 — and the landing latch
    var landing = DanceLanding()
    var still: Float = 0                         // 10
    var bassFloor: Float? = nil                  // the detectors' memories (tau 2.5 s, tau 0.9 s)
    var cenSlow: Float? = nil
    var out = DanceBusOutput()                   // the twelve, reused

    // the TV's ear and breath (DANCE.update's laws; the web passes them in)
    var ear: Float = 1
    var breath: Float = 0
    private var earHits: Float = 0               // onset heat: real hits charge it, ~1.2 s of quiet drains it
    private var prevOnsetEnv: Float = 0          // onsetEnv's rising edge is the TV's onset flag
    private var wallT: Double = 0                // the breath's clock

    // MARK: the pure helpers (the web's, verbatim)

    /// A finite number or its default — the bus never lets a NaN in.
    @inline(__always) static func fin(_ v: Float, _ d: Float) -> Float { v.isFinite ? v : d }
    @inline(__always) static func clamp01(_ v: Float) -> Float { v < 0 ? 0 : (v > 1 ? 1 : v) }

    /// dancePeriod: the beat period the bus thinks in, clamped; 120 BPM when nothing is known.
    static func clampPeriod(_ period: Float) -> Float {
        let p = fin(period, 0)
        return p > 0 ? min(pMax, max(pMin, p)) : 0.5
    }

    /// danceLookahead: seconds the brace reads ahead.
    static func lookahead(_ P: Float) -> Float { 2 * P + 0.2 }

    /// danceSmooth — smoothstep.
    static func smooth(_ a: Float, _ b: Float, _ x: Float) -> Float {
        let t = clamp01((x - a) / (b - a))
        return t * t * (3 - 2 * t)
    }

    /// envFollow — an asymmetric one-pole: fast up, slow down.
    static func follow(_ a: Float, _ b: Float, dt: Float, tauUp: Float, tauDown: Float) -> Float {
        let tau = b > a ? tauUp : tauDown
        return a + (b - a) * (1 - exp(-dt / max(1e-4, tau)))
    }

    /// danceSway — where the body is inside the bar and the phrase (amp 1).
    static func swayLift(barPhi: Float, phrasePhi: Float, energy: Float) -> (sway: Float, lift: Float) {
        let e = clamp01(energy)
        let sw = sin(barPhi * twoPi) * (0.55 + e * 0.45) + 0.35 * sin(phrasePhi * twoPi + 1.2)
        let lf = (0.5 - 0.5 * cos(phrasePhi * twoPi)) * (0.3 + e * 0.4)
        return (sw, lf)
    }

    /// beatSpringStep — symplectic Euler, sub-stepped (<= 1/240 s, <= 8 steps)
    /// so a long frame gap can never make it diverge. Velocity, then position.
    static func springStep(x x0: Float, v v0: Float, drive: Float, dt: Float,
                           k: Float, c: Float) -> (x: Float, v: Float) {
        let steps = max(1, min(8, Int((dt * 240).rounded(.up))))
        let h = dt / Float(steps)
        var x = x0
        var v = v0
        for _ in 0..<steps {
            v += (k * (drive - x) - c * v) * h
            x += v * h
        }
        return (x, v)
    }

    /// danceClassify — onsets become VOICES. rb/rm/rt are this step's positive
    /// band rises, punch the onset strength, bass/mid the levels. A kick
    /// additionally needs the bass ABOVE ITS OWN FLOOR so a sustained bassline
    /// is weight, not a strike; nil floor skips the gate. Hats are treble-class
    /// only when alone.
    static func classify(rb rbIn: Float, rm rmIn: Float, rt rtIn: Float, punch punchIn: Float,
                         bass bassIn: Float, mid midIn: Float, bassFloor: Float?) -> DanceVoices {
        let rb = fin(rbIn, 0), rm = fin(rmIn, 0), rt = fin(rtIn, 0)
        let punch = fin(punchIn, 0), bass = fin(bassIn, 0), mid = fin(midIn, 0)
        let gate: Float
        if let f = bassFloor, f.isFinite { gate = clamp01((bass - f) * 6) } else { gate = 1 }
        let kick = clamp01(punch * 0.6 * clamp01(bass * 1.4 + 0.1) + rb * 1.6) * gate
        let snare = clamp01(rm * 1.4 + punch * 0.5 * clamp01(mid * 1.2))
        let hat = clamp01(rt * 1.3) * (1 - 0.7 * clamp01(kick + snare))
        return DanceVoices(kick: kick, snare: snare, hat: hat, gate: gate)
    }

    // MARK: the pure core — danceBusStep

    /// ONE frame of the bus. Reads `inp`, advances the state, returns the
    /// twelve (also kept in `out`). The landing's engine side effects (the
    /// web's INTERACT.impulse, f.beat, the ear's hits) are the caller's: read
    /// `landed` after the step.
    @discardableResult
    mutating func step(_ inp: DanceInputs, dt dtIn: Float) -> DanceBusOutput {
        let dt = min(0.25, max(0, Self.fin(dtIn, 0)))      // time never runs backward, a hop is bounded
        let P = Self.clampPeriod(inp.period)
        beatPeriod = P
        let bass = Self.clamp01(Self.fin(inp.bass, 0))
        let mid = Self.clamp01(Self.fin(inp.mid, 0))
        let treble = Self.clamp01(Self.fin(inp.treble, 0))
        let energy = Self.clamp01(Self.fin(inp.energy, 0))
        let ear = Self.clamp01(Self.fin(inp.ear, 1))
        let playing = inp.playing
        let downbeat = inp.beatIdx == 0
        let calm = inp.calm

        // the bass's own floor (tau 2.5 s) — a sustained bassline is weight, not a strike
        if let f0 = bassFloor {
            bassFloor = f0 + (bass - f0) * (1 - exp(-dt / 2.5))
        } else {
            bassFloor = bass
        }
        voices = Self.classify(rb: inp.rb, rm: inp.rm, rt: inp.rt, punch: inp.punch,
                               bass: inp.bass, mid: inp.mid, bassFloor: bassFloor)

        // the strike as light (w) and the body's strike (s). A bare hat can
        // never lift w above 0.25 — the downbeat weight belongs to the voices.
        let down: Float = downbeat ? 1.25 : 1
        let voice = max(voices.kick, 0.85 * voices.snare) * down
        var w = min(voice + 0.25 * voices.hat, down)
        var s = Self.clamp01(voices.kick + 0.45 * voices.snare) * down * (0.5 + 0.5 * ear)

        // precognition — the coil, and the landing
        let la = Self.lookahead(P)
        let hereL: Float = inp.here.map { Self.fin($0.bass, 0) + 0.8 * Self.fin($0.punch, 0) } ?? 0
        let soonL: Float = inp.soon.map { Self.fin($0.bass, 0) + 0.8 * Self.fin($0.punch, 0) } ?? 0
        var coming: Float = (inp.here != nil && inp.soon != nil) ? Self.clamp01(soonL - hereL) : 0
        let structure = Self.clamp01(Self.fin(inp.structure, 0))
        if structure > coming { coming = structure }
        self.coming = coming
        let landedNow = landing.step(pos: inp.pos, coming: coming, here: hereL, soon: soonL,
                                     P: P, lookahead: la)
        landed = landedNow
        if landedNow {
            w = max(w, 1.25); s = max(s, 1.25); brace = 0
        } else {
            brace = Self.follow(brace, coming > Self.comingThreshold ? 1 : 0, dt: dt,
                                tauUp: 0.7 * P, tauDown: 1.2 * P)
        }
        self.w = w
        self.s = s

        // 0 dHit — latch the strike, release over 0.3 beat, the governor last
        strikeEnv = max(strikeEnv * exp(-dt / (0.30 * P)), w)
        let hitV = hit.step(strikeEnv, dt: dt, tuning: inp.tuning)
        // 1 dAge — beats since the last real strike (a hat never resets it)
        age = w >= Self.strikeMin ? 0 : min(4, age + dt / P)
        // 2 dKick — the rising edge of the body's strike drives the spring
        if s > 0.05 && s > sPrev + 0.02 { ks.strike(s) }
        sPrev = s
        let kx = ks.step(dt: dt, P: P, calm: calm)
        // 3 dMass — the passage's weight: up a third of a beat, down two
        mass = Self.follow(mass, bass, dt: dt, tauUp: P / 3, tauDown: 2 * P)
        // 4 dArtic — the melody's motion (DANCE.flow's law), up P/8, down P/2
        let cen = Self.clamp01(Self.fin(inp.centroid, 0))
        let cs = cenSlow ?? cen
        let melodic = Self.clamp01(mid * 0.55 + treble * 0.85 + abs(cen - cs) * 3.5)
        cenSlow = cs + (cen - cs) * (1 - exp(-dt / 0.9))
        artic = Self.follow(artic, melodic, dt: dt, tauUp: P / 8, tauDown: P / 2)
        // 5 dSpark — attack one frame (a flick has no mass), release a quarter beat
        spark = max(spark * exp(-dt / (P / 4)), Self.clamp01(max(treble, 0.8 * voices.hat)))
        // 10 dStill — a SLEW, not a time constant: it arrives. Up in P/8; down in
        // 1.5 beats, or in half a beat when the music has truly stopped
        let stillT: Float = playing ? Self.smooth(0.30, 0.55, ear) : 0
        let rate: Float = stillT > still ? 8 / P : (energy < 0.05 ? 2 / P : 1 / (1.5 * P))
        let dStill = stillT - still
        let slew = rate * dt
        still += dStill < -slew ? -slew : (dStill > slew ? slew : dStill)
        // 6 dSway, 7 dLift — the bar and the phrase, breath folded in at rest
        let sw = Self.swayLift(barPhi: Self.fin(inp.barPhase, 0), phrasePhi: Self.fin(inp.phrasePhase, 0),
                               energy: Self.clamp01(energy + artic * 0.45))
        let breathIn = max(-1, min(1, Self.fin(inp.breath, 0)))
        let swayT = max(-1, min(1, still * sw.sway + (1 - still) * 0.3 * breathIn))
        sway += (swayT - sway) * (1 - exp(-dt / (0.45 * P)))
        let liftT = Self.clamp01(still * sw.lift + (1 - still) * 0.15 * (0.5 + 0.5 * breathIn))
        lift += (liftT - lift) * (1 - exp(-dt / (0.8 * P)))
        // 9 dImpact — beats since the landing
        impactAge = landedNow ? 0 : min(8, impactAge + dt / P)

        let hitOut: Float = hitV < 0 ? 0 : (hitV > 1.5 ? 1.5 : hitV)
        let kickOut: Float = kx < -0.35 ? -0.35 : (kx > 1.25 ? 1.25 : kx)
        out.d0 = SIMD4<Float>(hitOut, age, kickOut, mass)
        out.d1 = SIMD4<Float>(artic, spark, sway, lift)
        out.d2 = SIMD4<Float>(brace, impactAge, still, inp.haveGrid ? P : 0)
        return out
    }

    // MARK: the TV's feed — one Analyzer frame into the pure core

    /// Step the bus from the ears. `period` is seconds per beat (the frame's
    /// bpm, grid or flux; 0 unknown), `haveGrid` whether a measured grid is
    /// under it (dPeriod carries P only then), `downbeat` the count (floor of
    /// the frame's beats mod 4 == 0), `playing` the deck (or the demo drive) is
    /// live, `calm` Reduce Motion or the calm setting (zeta 0.55, the calm
    /// governor). `playhead` is the clock's own extrapolation (Frame.playhead)
    /// and `env` the track's score: the brace reads it 0.08 s and 2P + 0.2 s
    /// ahead exactly as the web does; with no score the coil decays.
    /// The ear and the breath are DANCE.update's laws, kept here because the
    /// TV has no DANCE object: the ear hears transients only (onset heat and
    /// the bass rising above its own floor), the breath is the slow
    /// two-sine swell scaled by calm. The onset's strength (punch) is
    /// onsetEnv's rising edge (the web's f.onsetStr / f.onset); the rises are
    /// the Analyzer's snap-and-decay envelopes, which the stepper treats as
    /// EDGES for the body and a latched level for the light.
    @discardableResult
    mutating func step(frame f: Analyzer.Frame, dt dtIn: Float, playhead: Double, env: Env?,
                       period: Float, haveGrid: Bool, downbeat: Bool,
                       playing: Bool, calm: Bool) -> DanceBusOutput {
        let dt = min(0.25, max(0, Self.fin(dtIn, 0)))
        // THE EAR (v2): the grid says where the beat IS; the music says how hard
        // it lands. Onset heat charges on real hits and drains over ~1.2 s;
        // kick presence is the bass RISING above its own recent floor. A pad
        // holds the room to a breath; a drop slams it.
        let onsetEnv = Self.fin(f.onsetEnv, 0)
        let onsetEdge = onsetEnv > prevOnsetEnv + 0.25
        prevOnsetEnv = onsetEnv
        earHits = earHits * exp(-dt / 1.2) + (onsetEdge ? 1 : 0)
        let bass = Self.clamp01(Self.fin(f.bass, 0))
        let floorNow: Float = bassFloor.map { $0 + (bass - $0) * (1 - exp(-dt / 2.5)) } ?? bass
        let kickPresence = Self.clamp01((bass - floorNow) * 6)
        ear = 0.30 + 0.70 * Self.clamp01(min(1, earHits * 0.7) * 0.8 + kickPresence * 0.6)
        // THE BREATH: the whole organism swells slowly, more so when calm
        wallT += Double(dt)
        if wallT > 1.0e6 { wallT -= 1.0e6 }           // a long night never loses sin() precision
        let calmLevel = Self.clamp01(Self.fin(f.calm, 0))
        breath = Float(sin(wallT * 0.88 + sin(wallT * 0.213) * 1.7)) * (0.35 + calmLevel * 0.65)
        // the onset's strength: the edge of the audible-aligned envelope
        let punch: Float = onsetEdge ? Self.clamp01(onsetEnv) : 0
        // precognition's two readings of the score
        let P = Self.clampPeriod(period)
        let la = Self.lookahead(P)
        var pos: Double? = nil
        var here: DanceLevel? = nil
        var soon: DanceLevel? = nil
        if playing && playhead.isFinite {
            pos = playhead
            if let env {
                let h = env.sample(at: playhead + 0.08)
                let sn = env.sample(at: playhead + Double(la))
                here = DanceLevel(bass: Float(h.bass), punch: Float(h.punch))
                soon = DanceLevel(bass: Float(sn.bass), punch: Float(sn.punch))
            }
        }
        var inp = DanceInputs()
        inp.bass = f.bass
        inp.mid = f.mid
        inp.treble = f.treble
        inp.energy = f.energy
        inp.centroid = 0                             // the Analyzer has no centroid: the contour alone
        inp.rb = f.riseBass
        inp.rm = f.riseMid
        inp.rt = f.riseTreble
        inp.punch = punch
        inp.period = period
        inp.haveGrid = haveGrid
        inp.beatIdx = downbeat ? 0 : 1
        inp.barPhase = f.barPhase
        inp.phrasePhase = f.phrasePhase
        inp.ear = ear
        inp.playing = playing
        inp.breath = breath
        inp.calm = calm
        inp.pos = pos
        inp.here = here
        inp.soon = soon
        inp.structure = 0                            // the structure map's section turns: stage 3
        inp.tuning = calm ? .calm : .standard
        return step(inp, dt: dt)
    }
}
