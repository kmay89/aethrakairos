import Foundation

/* ================================================================
   THE ROOMS AND THE DIRECTOR — taste, not shuffle.
   A room is not a filter preset; it has an appetite. The director
   deals the next room by scoring each appetite against the moment
   (energy, calm, onset, treble), taxing the recently seen (a ring
   of the last five — the freshest pays the most to return), and
   lifting the never-shown by 1.55x so a night eventually tours the
   whole house. Dwell is 16–46 s, leaning long as the music calms,
   and a switch only ever LANDS ON A BEAT — a cut off the grid is a
   flinch, not a decision.
   ================================================================ */

struct Room: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var name: String                 // ALL CAPS in the UI — names are canon
    var fragmentFunction: String     // metal function name, e.g. "room_spiral"
    // the appetite: positive = wants the feature, negative = wants its absence
    var tasteEnergy: Float
    var tasteCalm: Float
    var tasteBeat: Float
    var tasteTreble: Float
}

enum Rooms {
    /// Build order is the index space the director and renderer share.
    static let all: [Room] = [
        Room(key: "spiral", name: "MÖBIUS SPIRAL", fragmentFunction: "room_spiral",
             tasteEnergy: 0.9, tasteCalm: 0.2, tasteBeat: 0.7, tasteTreble: 0.3),
        Room(key: "pulse", name: "PULSE", fragmentFunction: "room_pulse",
             tasteEnergy: 0.3, tasteCalm: 1.1, tasteBeat: 1.4, tasteTreble: 0.2),
        Room(key: "nebula", name: "NEBULA", fragmentFunction: "room_nebula",
             tasteEnergy: -0.9, tasteCalm: 1.6, tasteBeat: -0.4, tasteTreble: 0.3),
        Room(key: "tunnel", name: "TUNNEL", fragmentFunction: "room_tunnel",
             tasteEnergy: 1.7, tasteCalm: -0.5, tasteBeat: 0.8, tasteTreble: 0.2),
        Room(key: "opart", name: "OP-ART", fragmentFunction: "room_opart",
             tasteEnergy: 0.8, tasteCalm: 0.1, tasteBeat: 1.0, tasteTreble: 0.9),
        Room(key: "scope", name: "SCOPE", fragmentFunction: "room_scope",
             tasteEnergy: 0.2, tasteCalm: 1.0, tasteBeat: 0.4, tasteTreble: 0.7),
    ]

    /// The calm room the reduced-motion door opens into — found by key,
    /// never by index, so reordering the roster cannot break the law.
    static var pulseIndex: Int {
        all.firstIndex(where: { $0.key == "pulse" }) ?? 0
    }
}

/// The auto-director-lite: pure state, ticked by the renderer.
/// It decides WHICH room and WHEN; the renderer owns HOW the change
/// looks (the luma dissolve is the renderer's business).
struct Director {

    private(set) var currentIndex: Int
    /// Auto-deal switch. Off = the director holds still; manual step()
    /// keeps working either way.
    var autoOn: Bool = true

    // memory ring of the last five rooms shown, oldest first —
    // the recency tax reads from the newest end
    private var recent: [Int] = []
    private var seen: Set<Int>
    private var dwellRemaining: Double

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

    /// Advance the clock. Returns the NEW index into Rooms.all when a
    /// switch fires, nil otherwise. A switch requires the dwell to have
    /// expired AND the beat clock to be near a boundary (beatPhase < 0.1);
    /// four seconds of patience past expiry is the most a stalled clock
    /// gets before the cut fires anyway.
    mutating func tick(dt: Double, frame: Analyzer.Frame) -> Int? {
        guard autoOn, Rooms.all.count > 1 else { return nil }
        dwellRemaining -= max(dt, 0)
        guard dwellRemaining <= 0 else { return nil }
        let overdue = -dwellRemaining
        guard frame.beatPhase < 0.1 || overdue > 4.0 else { return nil }
        let next = deal(frame: frame)
        move(to: next, calm: Double(frame.calm))
        return next
    }

    /// Manual swipe: force the switch now, resetting the dwell. The person
    /// in the room outranks the director — no beat gating, no taste math.
    mutating func step(_ delta: Int) {
        let n = Rooms.all.count
        guard n > 0, delta != 0 else { return }
        var next = (currentIndex + delta) % n
        if next < 0 { next += n }
        move(to: next, calm: 0.5)
    }

    // MARK: - internals

    private mutating func move(to next: Int, calm: Double) {
        recent.append(currentIndex)
        if recent.count > 5 { recent.removeFirst(recent.count - 5) }
        seen.insert(currentIndex)
        seen.insert(next)
        currentIndex = next
        dwellRemaining = Director.dealDwell(calm: calm)
    }

    /// Dwell 16–46 s. The draw leans toward the long end as the music
    /// calms — a calm room deserves to be lived in, not toured.
    private static func dealDwell(calm: Double) -> Double {
        let c = min(max(calm, 0), 1)
        let u = Double.random(in: 0...1)
        let leaned = pow(u, max(0.35, 1.0 - 0.65 * c))
        return 16.0 + 30.0 * leaned
    }

    /// The taste deal: appetite dot the moment, recency tax, novelty lift,
    /// the current room excluded, then one weighted draw.
    private func deal(frame: Analyzer.Frame) -> Int {
        let rooms = Rooms.all
        var weights = [Double](repeating: 0, count: rooms.count)
        var total = 0.0
        for (i, room) in rooms.enumerated() {
            let w = score(room: room, index: i, frame: frame)
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

    private func score(room: Room, index: Int, frame: Analyzer.Frame) -> Double {
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
        s = max(s, 0.02)                    // taste never zeroes a room outright

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
