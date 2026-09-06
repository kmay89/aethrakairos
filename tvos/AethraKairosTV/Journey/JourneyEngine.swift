import Foundation

/* ================================================================
   THE SOLVER — one solver, three faces, ported bit-for-bit from the
   web player's §6c. The law of this file: same seed + same catalog
   order ⇒ same journey, on any platform. Every rng() call below is
   sequenced exactly as the JS runs it — the jitter draws one number
   PER CANDIDATE in catalog order, so iteration order is part of the
   seed contract, not an implementation detail.
   ================================================================ */

/// A point in the catalog-normalized feature space. Dimensions missing on
/// either side (a map tap fixes only brightness × energy) are SKIPPED by the
/// distance, never zero-filled. bpm 0 is the ambient WILDCARD: it contributes
/// no tempo term, so unpitched tracks are eligible anywhere, never forced
/// onto a grid they do not have.
struct FeaturePoint: Equatable {
    var energy: Double?
    var brightness: Double?
    var entropy: Double?
    var onsets: Double?
    var bpm: Double

    init(energy: Double? = nil, brightness: Double? = nil, entropy: Double? = nil,
         onsets: Double? = nil, bpm: Double = 0) {
        self.energy = energy
        self.brightness = brightness
        self.entropy = entropy
        self.onsets = onsets
        self.bpm = bpm
    }

    init(_ f: Features) {
        self.init(energy: f.energy, brightness: f.brightness, entropy: f.entropy,
                  onsets: f.onsets, bpm: f.bpm)
    }
}

/// A ritual is nothing clever hiding behind a curtain: it is dials,
/// pre-turned. A FROM→TO pair of feature-space points, a HEAT, and a time
/// target, dealt by the same journey solver as everything else. Coordinates
/// are in the catalog-normalized 0–1 space, so "quiet" means the quietest
/// music YOU own.
struct Ritual: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var label: String
    var desc: String
    var heat: Double
    var targetSec: Double
    var from: FeaturePoint
    var to: FeaturePoint
}

enum JourneyEngine {

    // MARK: - deterministic seeded RNG

    /// Bit-exact mulberry32. A saved journey stores dials + seed, so replaying
    /// re-deals the same intent. The JS semantics carried over literally:
    /// `|0` is two's-complement 32-bit wrap (identical bit pattern unsigned),
    /// `Math.imul` is the low 32-bit word of the product (`&*` on UInt32),
    /// `>>>` is a logical shift on the unsigned reinterpretation, and the
    /// final `/ 4294967296` yields a Double in [0, 1).
    static func mulberry32(_ seed: UInt32) -> () -> Double {
        var a: UInt32 = seed
        return {
            a = a &+ 0x6D2B79F5
            var t: UInt32 = (a ^ (a >> 15)) &* (1 | a)
            t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
            return Double(t ^ (t >> 14)) / 4294967296.0
        }
    }

    // MARK: - feature geometry

    /// Feature distance in the normalized space: RMS over the dims present on
    /// BOTH sides, plus an octave-folded tempo term only when both bpm > 0.
    /// BPM 0 never pays tempo cost — the wildcard rule.
    static func solverDist(_ a: FeaturePoint, _ b: FeaturePoint) -> Double {
        var d2 = 0.0
        var n = 0
        let pairs: [(Double?, Double?)] = [
            (a.energy, b.energy),
            (a.brightness, b.brightness),
            (a.entropy, b.entropy),
            (a.onsets, b.onsets),
        ]
        for (x, y) in pairs {
            guard let x = x, let y = y, x.isFinite, y.isFinite else { continue }
            let d = x - y
            d2 += d * d
            n += 1
        }
        var dist = n > 0 ? (d2 / Double(n)).squareRoot() : 0
        if a.bpm > 0 && b.bpm > 0 {
            var r = a.bpm / b.bpm
            if r < 1 { r = 1 / r }
            while r >= 1.45 { r /= 2 }              // octave-tolerant
            dist += min(abs(r - 1), 0.5) * 0.6
        }
        return dist
    }

    /// Per-dim linear blend; a dim missing on one side passes the finite side
    /// through. bpm interpolates only when both ends are pitched, else the
    /// waypoint itself is a wildcard.
    static func lerpFeat(_ a: FeaturePoint, _ b: FeaturePoint, _ t: Double) -> FeaturePoint {
        func mix(_ x: Double?, _ y: Double?) -> Double? {
            let xf = x.flatMap { $0.isFinite ? $0 : nil }
            let yf = y.flatMap { $0.isFinite ? $0 : nil }
            if let xv = xf, let yv = yf { return xv + (yv - xv) * t }
            return xf ?? yf
        }
        let bpm = (a.bpm > 0 && b.bpm > 0) ? a.bpm + (b.bpm - a.bpm) * t : 0
        return FeaturePoint(energy: mix(a.energy, b.energy),
                            brightness: mix(a.brightness, b.brightness),
                            entropy: mix(a.entropy, b.entropy),
                            onsets: mix(a.onsets, b.onsets),
                            bpm: bpm)
    }

    // MARK: - JOURNEY: A to B, greedily

    /// One pass, no annealing, no backtracking. Waypoints slide along the
    /// FROM→TO line as target TIME accrues; each step scores every unused
    /// eligible track and takes the argmin of: distance to the waypoint,
    /// a retreat penalty back*(1−heat)*2.2 for moving away from the goal,
    /// a soft duration correction 0.18*|dur−idealDur|/max(idealDur,60), and
    /// the quantum jitter heat*rng()*1.4 — drawn once per candidate, in
    /// catalog order. Below heat 0.5 only forward hops (within eps =
    /// heat*0.25) are even eligible, falling back to the full pool when
    /// nothing can advance. At heat ≥ 1 the pick is a uniform draw,
    /// statistically indistinguishable from the permutation bag.
    static func dealJourney(tracks: [Track], fromFeat: FeaturePoint?, toFeat: FeaturePoint?,
                            targetSec: Double, heat: Double, rng: () -> Double)
        -> (order: [String], totalSec: Double)
    {
        let h = clamp01(heat)
        // The pool keeps CATALOG ORDER — arrays, never sets: the jitter's
        // rng sequence rides on iteration order.
        let pool: [(id: String, feat: FeaturePoint, dur: Double?)] = tracks.compactMap { t in
            guard let f = t.features else { return nil }   // features-less = journey-ineligible
            return (id: t.id, feat: FeaturePoint(f), dur: positiveDuration(t.duration))
        }
        guard !pool.isEmpty else { return ([], 0) }

        let meanDur = pool.reduce(0.0) { $0 + ($1.dur ?? 240) } / Double(pool.count)
        let target = (targetSec.isFinite && targetSec > 0) ? targetSec : 3600

        // A missing FROM costs exactly one rng call — the web draws a random
        // pool track's features, and the sequence must not drift.
        let A: FeaturePoint
        if let f = fromFeat { A = f } else { A = pool[boundedIndex(rng(), pool.count)].feat }
        let B = toFeat
        let goal = B

        var used = Set<String>()
        var order: [String] = []
        var acc = 0.0
        var prevFeat = A
        let maxTracks = pool.count

        while order.count < maxTracks {
            let remainAfterTo = target - acc
            if remainAfterTo < meanDur * 0.5 { break }      // the time-mode stop
            let cands = pool.filter { !used.contains($0.id) }
            guard !cands.isEmpty else { break }

            // progression parameter = fraction of TARGET TIME already dealt,
            // not track index — long tracks advance the waypoint faster.
            let t01 = clamp01((acc + meanDur * 0.5) / max(target, 1))
            let way: FeaturePoint
            if let B = B { way = lerpFeat(A, B, t01) } else { way = A }
            let slotsLeft = max(1.0, (remainAfterTo / meanDur).rounded())
            let idealDur = max(30.0, remainAfterTo / slotsLeft)

            var picked = cands[0]                            // always overwritten below
            if h >= 1 {
                picked = cands[boundedIndex(rng(), cands.count)]
            } else {
                let dPrevGoal = goal.map { solverDist(prevFeat, $0) } ?? 0
                // at low heat, only hops that make progress toward TO are
                // even eligible (fall back to the full pool when nothing can)
                var candSet = cands
                if let g = goal, h < 0.5 {
                    let eps = h * 0.25
                    let forward = cands.filter { solverDist($0.feat, g) <= dPrevGoal + eps }
                    if !forward.isEmpty { candSet = forward }
                }
                var best = Double.infinity
                for c in candSet {
                    var score = solverDist(c.feat, way)
                    // the path must READ as a progression: a hop that moves
                    // away from the destination costs in proportion to the retreat
                    if let g = goal {
                        let back = solverDist(c.feat, g) - dPrevGoal
                        if back > 0 { score += back * (1 - h) * 2.2 }
                    }
                    score += 0.18 * abs((c.dur ?? meanDur) - idealDur) / max(idealDur, 60)
                    score += h * rng() * 1.4                 // the quantum jitter
                    if score < best { best = score; picked = c }
                }
            }
            used.insert(picked.id)
            order.append(picked.id)
            prevFeat = picked.feat
            acc += picked.dur ?? meanDur
        }
        return (order, acc)
    }

    // MARK: - QUANTUM: the memoryless randomness machine

    /// The next track is drawn from a gaussian neighborhood whose radius is
    /// HEAT (sigma = 0.07 + heat*0.85), composed with the unique-cycle bag
    /// (usedKeys) so nothing repeats within a pass. Hearts weigh the dice —
    /// slightly, ×1.3 — below full chaos. Skips teach nothing and store
    /// nothing. Exactly one rng call per step: the roulette draw.
    static func quantumStep(tracks: [Track], currentFeat: FeaturePoint?, heat: Double,
                            usedKeys: Set<String>, heartKeys: Set<String>, rng: () -> Double)
        -> (pickKey: String?, exhausted: Bool)
    {
        let h = clamp01(heat)
        let pool: [(id: String, feat: FeaturePoint)] = tracks.compactMap { t in
            guard let f = t.features, !usedKeys.contains(t.id) else { return nil }
            return (id: t.id, feat: FeaturePoint(f))
        }
        guard !pool.isEmpty else { return (nil, true) }

        let sigma = 0.07 + h * 0.85
        var weights: [Double]
        if h < 1, let cur = currentFeat {
            weights = pool.map { c in
                let d = solverDist(c.feat, cur)
                var w = exp(-(d * d) / (2 * sigma * sigma))
                if heartKeys.contains(c.id) { w *= 1.3 }     // hearts weigh the dice
                return w
            }
        } else {
            weights = Array(repeating: 1, count: pool.count) // full chaos / no anchor: uniform
        }
        var sum = weights.reduce(0, +)
        if sum <= 0 {                                        // gaussian underflow: back to uniform
            weights = Array(repeating: 1, count: pool.count)
            sum = Double(pool.count)
        }
        var r = rng() * sum
        var pick = pool[pool.count - 1].id
        for i in 0..<pool.count {
            r -= weights[i]
            if r <= 0 { pick = pool[i].id; break }
        }
        return (pick, false)
    }

    // MARK: - RITUALS

    /// The six, coordinates verbatim from the web RITUALS table. Rituals set
    /// energy/brightness/onsets/bpm but never entropy — solverDist simply
    /// skips the missing dim. bpm 0 keeps the ambient-wildcard rule.
    static let rituals: [Ritual] = [
        Ritual(key: "run", label: "Going for a run",
               desc: "steady warm-up building into full drive, tempo up around 160",
               heat: 0.25, targetSec: 3600,
               from: FeaturePoint(energy: 0.55, brightness: 0.50, onsets: 0.55, bpm: 150),
               to:   FeaturePoint(energy: 0.95, brightness: 0.65, onsets: 0.85, bpm: 170)),
        Ritual(key: "dinner", label: "Relaxing dinner",
               desc: "warm, low-key, unhurried — two hours of background glow",
               heat: 0.35, targetSec: 7200,
               from: FeaturePoint(energy: 0.30, brightness: 0.35, onsets: 0.18, bpm: 0),
               to:   FeaturePoint(energy: 0.42, brightness: 0.45, onsets: 0.28, bpm: 0)),
        Ritual(key: "work", label: "Deep work",
               desc: "steady mid-energy, nothing startling, a long horizon",
               heat: 0.12, targetSec: 7200,
               from: FeaturePoint(energy: 0.50, brightness: 0.50, onsets: 0.32, bpm: 0),
               to:   FeaturePoint(energy: 0.50, brightness: 0.56, onsets: 0.32, bpm: 0)),
        Ritual(key: "bedtime", label: "Bedtime",
               desc: "a slow descent to the quietest thing you own",
               heat: 0.10, targetSec: 1800,
               from: FeaturePoint(energy: 0.45, brightness: 0.40, onsets: 0.30, bpm: 0),
               to:   FeaturePoint(energy: 0.03, brightness: 0.08, onsets: 0.04, bpm: 0)),
        Ritual(key: "sunrise", label: "Wake up slowly",
               desc: "the bedtime curve, climbed",
               heat: 0.15, targetSec: 1800,
               from: FeaturePoint(energy: 0.05, brightness: 0.12, onsets: 0.05, bpm: 0),
               to:   FeaturePoint(energy: 0.70, brightness: 0.70, onsets: 0.60, bpm: 0)),
        Ritual(key: "party", label: "Party",
               desc: "hot and bright, dice mostly loose",
               heat: 0.55, targetSec: 10800,
               from: FeaturePoint(energy: 0.85, brightness: 0.58, onsets: 0.80, bpm: 125),
               to:   FeaturePoint(energy: 0.95, brightness: 0.75, onsets: 0.90, bpm: 128)),
    ]

    // MARK: - internals

    private static func clamp01(_ v: Double) -> Double {
        return v < 0 ? 0 : (v > 1 ? 1 : v)
    }

    /// JS `(rng()*n)|0` — truncation toward zero. The clamp guards a caller-
    /// supplied rng that returns exactly 1.0; mulberry32 never does, so the
    /// deterministic path is untouched.
    private static func boundedIndex(_ r: Double, _ count: Int) -> Int {
        let i = Int(r * Double(count))
        return min(max(i, 0), count - 1)
    }

    /// JS `t.duration || 240` treats 0/NaN/missing alike as absent.
    private static func positiveDuration(_ d: Double?) -> Double? {
        guard let d = d, d.isFinite, d > 0 else { return nil }
        return d
    }
}
