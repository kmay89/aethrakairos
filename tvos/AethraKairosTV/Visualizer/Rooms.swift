import Foundation
import UIKit

/* ================================================================
   THE ROOMS AND THE DIRECTOR — taste, not shuffle.
   A room is not a filter preset; it has an appetite. The director
   deals the next room by scoring each appetite against the moment
   (energy, calm, onset, treble, mid, bass, entropy), taxing the
   recently seen (a ring of the last five — the freshest pays the
   most to return), lifting the never-shown by 1.55x so a night
   eventually tours the whole house, and biasing by the MOOD of the
   moment (heavy rooms at the apex, calm rooms adrift).

   Above the deal sits the STORY: five acts read off the track's
   position — OVERTURE, RISING, APEX, TURN, RESOLVE — centered on the
   apex. The act sets a dwell multiplier (linger in an overture, cut
   fast at the apex) and, through the renderer, the white budget and
   the eased `act` uniform. Dwell is 16–46 s scaled by calm, then by
   mood and act, floored at 7 s. A switch only ever LANDS ON A
   BOUNDARY — a big change (a mood turn) waits for a phrase wrap, a
   small one for a bar wrap, and neither waits longer than 4 s. A cut
   off the grid is a flinch, not a decision.
   ================================================================ */

struct Room: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var name: String                 // ALL CAPS in the UI — names are canon
    var fragmentFunction: String     // metal function name, e.g. "room_spiral"
    // the appetite: positive = wants the feature, negative = wants its absence.
    // The wave-1 four stay the public contract; wave 2 appends three more and
    // two mood flags, all defaulted so a wave-1 Room(...) still compiles.
    var tasteEnergy: Float
    var tasteCalm: Float
    var tasteBeat: Float
    var tasteTreble: Float
    var tasteMid: Float = 0
    var tasteBass: Float = 0
    var tasteEntropy: Float = 0
    var heavy: Bool = false           // raymarched / fluid — favoured at the apex
    var calm: Bool = false            // a room to be lived in — favoured adrift
}

enum Rooms {
    /// Build order is the index space the director and renderer share.
    /// The first six are wave 1; the next eight are wave 2 (Shaders2/Shaders3);
    /// the last eight are wave 3 (Shaders4/Shaders5). Every fragment function is
    /// trusted to exist at link time — one target, one default library, so a
    /// room registered here whose function is missing simply parks the renderer
    /// in the void (configure() bails), never a half-built roster.
    static let all: [Room] = [
        Room(key: "spiral", name: "MÖBIUS SPIRAL", fragmentFunction: "room_spiral",
             tasteEnergy: 0.9, tasteCalm: 0.2, tasteBeat: 0.7, tasteTreble: 0.3),
        Room(key: "pulse", name: "PULSE", fragmentFunction: "room_pulse",
             tasteEnergy: 0.3, tasteCalm: 1.1, tasteBeat: 1.4, tasteTreble: 0.2, calm: true),
        Room(key: "nebula", name: "NEBULA", fragmentFunction: "room_nebula",
             tasteEnergy: -0.9, tasteCalm: 1.6, tasteBeat: -0.4, tasteTreble: 0.3, calm: true),
        Room(key: "tunnel", name: "TUNNEL", fragmentFunction: "room_tunnel",
             tasteEnergy: 1.7, tasteCalm: -0.5, tasteBeat: 0.8, tasteTreble: 0.2),
        Room(key: "opart", name: "OP-ART", fragmentFunction: "room_opart",
             tasteEnergy: 0.8, tasteCalm: 0.1, tasteBeat: 1.0, tasteTreble: 0.9),
        Room(key: "scope", name: "SCOPE", fragmentFunction: "room_scope",
             tasteEnergy: 0.2, tasteCalm: 1.0, tasteBeat: 0.4, tasteTreble: 0.7, calm: true),

        // ---- wave 2 ----
        Room(key: "fractal", name: "FRACTAL FIELD", fragmentFunction: "room_fractal",
             tasteEnergy: 1.2, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 1.0, heavy: true),
        Room(key: "pyro", name: "FIREWORKS", fragmentFunction: "room_pyro",
             tasteEnergy: 1.5, tasteCalm: 0, tasteBeat: 2.0, tasteTreble: 0),
        Room(key: "oilfilm", name: "OIL FILM", fragmentFunction: "room_oilfilm",
             tasteEnergy: 0, tasteCalm: 1.2, tasteBeat: 0, tasteTreble: 0,
             tasteEntropy: 0.8, calm: true),
        Room(key: "mandala", name: "MANDALA", fragmentFunction: "room_mandala",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0, tasteTreble: 0, tasteMid: 1.2),
        Room(key: "halo", name: "HALO", fragmentFunction: "room_halo",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.8, tasteTreble: 0, tasteBass: 1.4),
        Room(key: "terrain", name: "TERRAIN", fragmentFunction: "room_terrain",
             tasteEnergy: -0.6, tasteCalm: 1.4, tasteBeat: 0, tasteTreble: 0,
             heavy: true, calm: true),
        Room(key: "starburst", name: "STARBURST", fragmentFunction: "room_starburst",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 2.0, tasteTreble: 1.2),
        Room(key: "lava", name: "LAVA LAMP", fragmentFunction: "room_lava",
             tasteEnergy: -1.0, tasteCalm: 1.6, tasteBeat: 0, tasteTreble: 0, calm: true),

        // ---- wave 3 ----
        // Taste is the four canonical appetites only (WAVE3.md §A pins the
        // vectors onto tasteEnergy/tasteCalm/tasteBeat/tasteTreble); the fragment
        // bodies live in Shaders4.metal (eigen/aurea/mandel/rosette) and
        // Shaders5.metal (parlor/disperse/creature/slinky).
        Room(key: "eigen", name: "EIGENSTATE", fragmentFunction: "room_eigen",
             tasteEnergy: 0.3, tasteCalm: 0.4, tasteBeat: 0, tasteTreble: 0),
        Room(key: "aurea", name: "AUREA", fragmentFunction: "room_aurea",
             tasteEnergy: 0, tasteCalm: 1.0, tasteBeat: 0, tasteTreble: 0.6),
        Room(key: "mandel", name: "FILIGREE", fragmentFunction: "room_mandel",
             tasteEnergy: -0.4, tasteCalm: 1.2, tasteBeat: 0, tasteTreble: 0),
        Room(key: "rosette", name: "ROSETTE", fragmentFunction: "room_rosette",
             tasteEnergy: 0, tasteCalm: 0, tasteBeat: 0.7, tasteTreble: 1.0),
        Room(key: "parlor", name: "PARLOR", fragmentFunction: "room_parlor",
             tasteEnergy: 0, tasteCalm: 1.3, tasteBeat: -0.3, tasteTreble: 0),
        Room(key: "disperse", name: "DISPERSION", fragmentFunction: "room_disperse",
             tasteEnergy: 0.4, tasteCalm: 0, tasteBeat: 0, tasteTreble: 1.2),
        Room(key: "creature", name: "CREATURE", fragmentFunction: "room_creature",
             tasteEnergy: 0.8, tasteCalm: 0, tasteBeat: 0.8, tasteTreble: 0),
        Room(key: "slinky", name: "SLINKY", fragmentFunction: "room_slinky",
             tasteEnergy: -0.6, tasteCalm: 1.4, tasteBeat: 0, tasteTreble: 0),
    ]

    /// The calm room the reduced-motion door opens into — found by key,
    /// never by index, so reordering the roster cannot break the law.
    static var pulseIndex: Int {
        all.firstIndex(where: { $0.key == "pulse" }) ?? 0
    }
}

/// The auto-director: pure state, ticked by the renderer.
/// It decides WHICH room and WHEN; the renderer owns HOW the change
/// looks (the xform composite is the renderer's business).
struct Director {

    /// The six words the moment collapses into — each biases the deal and
    /// scales the dwell. Nested so it cannot collide in the module namespace.
    private enum Mood {
        case adrift, ascend, drive, apex, swarm, dissolve
    }

    private(set) var currentIndex: Int
    /// Auto-deal switch. Off = the director holds still; manual step()
    /// keeps working either way. The renderer wires this to VizSettings.
    var autoOn: Bool = true

    // memory ring of the last five rooms shown, oldest first —
    // the recency tax reads from the newest end
    private var recent: [Int] = []
    private var seen: Set<Int>
    private var dwellRemaining: Double

    // the pending switch: once dwell expires the next room is chosen and
    // queued, then fired on the next boundary (phrase for a mood change,
    // bar otherwise), never later than 4 s
    private var pending: Int? = nil
    private var pendingBig: Bool = false
    private var waited: Double = 0

    // mood bookkeeping — a switch is "big" when the mood has turned since
    // the current room was entered
    private var moodNow: Mood = .drive
    private var moodAtEntry: Mood = .drive

    // wrap detection: a phase that drops by most of a cycle just wrapped
    private var prevPhrasePhase: Float = 0
    private var prevBarPhase: Float = 0

    private static let actDwell: [Double] = [1.35, 1.00, 0.62, 0.85, 1.45]

    init() {
        self.init(startAt: 0)
    }

    /// Internal doorway for a chosen opener (Reduce Motion opens in PULSE).
    init(startAt index: Int) {
        let n = Rooms.all.count
        currentIndex = n > 0 ? min(max(index, 0), n - 1) : 0
        seen = [currentIndex]
        dwellRemaining = Director.dealDwell(calm: 0.5)
    }

    /// Advance the clock. `act` is the story act (0…4) the renderer read off
    /// the playhead; the director uses it for the mood and the act dwell
    /// multiplier. Returns the NEW index into Rooms.all when a switch fires
    /// (this frame), nil otherwise.
    ///
    /// The wave-1 two-argument form still resolves (act defaults to RISING),
    /// so the public contract holds; the renderer always passes the real act.
    mutating func tick(dt: Double, frame: Analyzer.Frame, act: Int = 1) -> Int? {
        guard autoOn, Rooms.all.count > 1 else {
            prevPhrasePhase = frame.phrasePhase
            prevBarPhase = frame.barPhase
            return nil
        }

        let entropy = Director.entropyProxy(frame)
        moodNow = Director.mood(act: act, energy: frame.energy, entropy: entropy)

        // boundary detection before we overwrite the previous phase
        let phraseWrapped = frame.phrasePhase < prevPhrasePhase - 0.30
        let barWrapped = frame.barPhase < prevBarPhase - 0.30
        prevPhrasePhase = frame.phrasePhase
        prevBarPhase = frame.barPhase

        // no switch queued yet — count the dwell down
        if pending == nil {
            dwellRemaining -= max(dt, 0)
            guard dwellRemaining <= 0 else { return nil }
            let next = deal(frame: frame, mood: moodNow, entropy: entropy)
            pending = next
            pendingBig = (moodNow != moodAtEntry)
            waited = 0
            // fall through — a boundary already here fires immediately
        }

        // a switch is queued — fire it on the right boundary, or when patience runs out
        waited += max(dt, 0)
        let boundary = pendingBig ? phraseWrapped : barWrapped
        guard boundary || waited >= 4.0, let next = pending else { return nil }

        move(to: next, calm: Double(frame.calm), mood: moodNow, act: act)
        pending = nil
        return next
    }

    /// Manual swipe: force the switch now, resetting the dwell. The person
    /// in the room outranks the director — no boundary gating, no taste math.
    mutating func step(_ delta: Int) {
        let n = Rooms.all.count
        guard n > 0, delta != 0 else { return }
        var next = (currentIndex + delta) % n
        if next < 0 { next += n }
        pending = nil
        move(to: next, calm: 0.5, mood: moodNow, act: 1)
    }

    // MARK: - internals

    private mutating func move(to next: Int, calm: Double, mood: Mood, act: Int) {
        recent.append(currentIndex)
        if recent.count > 5 { recent.removeFirst(recent.count - 5) }
        seen.insert(currentIndex)
        seen.insert(next)
        currentIndex = next
        moodAtEntry = mood

        let base = Director.dealDwell(calm: calm)
        let ai = min(max(act, 0), Director.actDwell.count - 1)
        let dwell = base * Director.moodDwellMult(mood) * Director.actDwell[ai]
        dwellRemaining = min(max(dwell, 7.0), 90.0)
    }

    /// Dwell 16–46 s. The draw leans toward the long end as the music
    /// calms — a calm room deserves to be lived in, not toured. Mood and
    /// act multipliers are applied by the caller.
    private static func dealDwell(calm: Double) -> Double {
        let c = min(max(calm, 0), 1)
        let u = Double.random(in: 0...1)
        let leaned = pow(u, max(0.35, 1.0 - 0.65 * c))
        return 16.0 + 30.0 * leaned
    }

    private static func moodDwellMult(_ mood: Mood) -> Double {
        switch mood {
        case .adrift:   return 1.45
        case .ascend:   return 1.00
        case .drive:    return 0.90
        case .apex:     return 0.62
        case .swarm:    return 0.75
        case .dissolve: return 1.30
        }
    }

    /// A cheap stand-in for spectral entropy: treble energy plus onset churn.
    /// The analyzer frame carries no entropy field, so the moment's "busy-ness"
    /// is read from the high band and the beat envelope.
    private static func entropyProxy(_ frame: Analyzer.Frame) -> Float {
        return min(max(0.55 * frame.treble + 0.60 * frame.onsetEnv, 0), 1)
    }

    /// The moment collapsed into one word. Precedence is the law: apex,
    /// dissolve, swarm, adrift, ascend, else drive.
    private static func mood(act: Int, energy: Float, entropy: Float) -> Mood {
        let e = Double(energy)
        if act == 2 && e > 0.45 { return .apex }
        if act == 4 || (act == 3 && e < 0.42) { return .dissolve }
        if Double(entropy) > 0.55 && e > 0.35 { return .swarm }
        if act == 0 || e < 0.30 { return .adrift }
        if act == 1 && e > 0.48 { return .ascend }
        return .drive
    }

    /// The mood's appetite over a room — heavy rooms rise at the apex, calm
    /// rooms adrift; swarm favours the percussive, ascend the energetic.
    private static func moodBias(_ room: Room, _ mood: Mood) -> Double {
        switch mood {
        case .apex:
            return room.heavy ? 1.7 : (room.calm ? 0.5 : 1.2)
        case .adrift:
            return room.calm ? 1.7 : (room.heavy ? 0.5 : 0.8)
        case .dissolve:
            return room.calm ? 1.4 : 0.8
        case .swarm:
            return 1.0 + 0.5 * Double(max(room.tasteBeat, room.tasteTreble))
        case .ascend:
            return 1.0 + 0.4 * Double(max(room.tasteEnergy, 0))
        case .drive:
            return 1.0
        }
    }

    /// The taste deal: appetite dot the moment, mood bias, recency tax,
    /// novelty lift, the current room excluded, then one weighted draw.
    private func deal(frame: Analyzer.Frame, mood: Mood, entropy: Float) -> Int {
        let rooms = Rooms.all
        var weights = [Double](repeating: 0, count: rooms.count)
        var total = 0.0
        for (i, room) in rooms.enumerated() {
            let w = score(room: room, index: i, frame: frame, mood: mood, entropy: entropy)
            weights[i] = w
            total += w
        }
        guard total > 0 else { return (currentIndex + 1) % rooms.count }
        var draw = Double.random(in: 0..<total)
        for (i, w) in weights.enumerated() {
            draw -= w
            if draw < 0 { return i }
        }
        // floating-point residue: hand back the last room that held weight
        return weights.lastIndex(where: { $0 > 0 }) ?? ((currentIndex + 1) % rooms.count)
    }

    private func score(room: Room, index: Int, frame: Analyzer.Frame,
                       mood: Mood, entropy: Float) -> Double {
        // the current room never re-deals itself
        if index == currentIndex { return 0 }

        // a negative weight is an appetite for ABSENCE — it earns its full
        // points when the feature is silent
        func term(_ w: Float, _ v: Float) -> Double {
            let value = Double(min(max(v, 0), 1))
            return w >= 0 ? Double(w) * value : Double(-w) * (1 - value)
        }

        var s = 1.0
        s += term(room.tasteEnergy, frame.energy)
        s += term(room.tasteCalm, frame.calm)
        s += term(room.tasteBeat, frame.onsetEnv)
        s += term(room.tasteTreble, frame.treble)
        s += term(room.tasteMid, frame.mid)
        s += term(room.tasteBass, frame.bass)
        s += term(room.tasteEntropy, entropy)
        s = max(s, 0.02)                    // taste never zeroes a room outright

        // the mood's appetite for this kind of room
        s *= max(Director.moodBias(room, mood), 0.02)

        // recency tax: ring of the last five, 0.10 (just left) … 1.0 (aged out)
        if let pos = recent.lastIndex(of: index) {
            let fromNewest = Double(recent.count - 1 - pos)
            s *= 0.10 + 0.90 * (fromNewest / 5.0)
        }

        // never-shown rooms get the novelty lift — the house gets toured
        if !seen.contains(index) { s *= 1.55 }

        return s
    }
}

/// The visual settings the shelves write and the renderer reads. Main-actor,
/// ObservableObject (no @Observable macro, by decree). The renderer reads
/// `.shared` each frame on the main actor — no snapshot, no crash.
@MainActor final class VizSettings: ObservableObject {
    static let shared = VizSettings()
    @Published var autoRooms: Bool = true       // the director deals on its own
    @Published var calm: Bool = false           // Reduce flashing — forces the calm tier

    private init() {
        calm = UIAccessibility.isReduceMotionEnabled
    }
}
