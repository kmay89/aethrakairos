import Foundation

/* ================================================================
   THE SCRIPT AND THE STEMS — what the pipeline already knows about a
   song before a note plays, ported law-for-law from the web player.

   `mix.structure` is the song's script: energy-hysteresis sections
   (intro / build / peak / drive / break / outro), the APEX (the middle
   of the loudest block — where the climax really is), and the mix-in /
   mix-out points a DJ would pick. The web centres its five acts on the
   real apex and caps every room's intensity at the section's CEILING,
   so a quiet intro or a breakdown can never reach full chaos just
   because the clock thinks it is time. Until this file the TV faked an
   apex at 0.62; now it reads the script.

   `mix.stems` are four per-source envelopes (drums / bass / vocals /
   other) at 12 Hz, digit strings exactly like `env`. They colour a
   waveform by SOURCE, let the seam see two voices about to collide,
   and give the field a fourth ear that the FFT alone cannot grow.

   Every function here is pure and mirrors a named web function; the
   constants are verbatim so a TV and a browser read the same song the
   same way.
   ================================================================ */

// MARK: - the script

/// One block of the song: fractional bounds [s, e), its mean energy on the
/// track's own 0–1 scale, and whether the hysteresis called it loud.
struct StructureSection: Codable, Equatable {
    var s: Double
    var e: Double
    var energy: Double
    var loud: Bool
}

/// The precomputed structure (`mix.structure`, `ok: true`, schema v1).
struct Structure: Codable, Equatable {
    var sections: [StructureSection]
    var apex: Double        // 0..1 — the middle of the highest-energy section
    var mixIn: Double       // 0..1 — the first strong block (skip a slow intro)
    var mixOut: Double      // 0..1 — the end of the last loud block in the back half

    /// The intensity floor: a room is never dead, even in the quietest block.
    static let ceilingFloor = 0.30

    /// The web's `structureCeiling`: the intensity the music actually earns at
    /// this point. The section containing `frac` sets it — floor + (1 − floor)
    /// × the section's energy; past the last block the last block holds.
    func ceiling(at frac: Double, floor fl: Double = Structure.ceilingFloor) -> Double {
        guard !sections.isEmpty else { return 1 }
        let p = Structure.clamp01(frac)
        for sec in sections where p >= sec.s && p < sec.e {
            return fl + (1 - fl) * Structure.clamp01(sec.energy)
        }
        return fl + (1 - fl) * Structure.clamp01(sections[sections.count - 1].energy)
    }

    /// Index of the section under `frac` (the last one when past the end).
    func sectionIndex(at frac: Double) -> Int? {
        guard !sections.isEmpty else { return nil }
        let f = max(0, min(0.99999, frac))
        if let i = sections.firstIndex(where: { f >= $0.s && f < $0.e }) { return i }
        return sections.count - 1
    }

    /// The web's `sectionLabel`: where the playhead sits, structurally and
    /// honestly — the first quiet block is the INTRO and the last the OUTRO; a
    /// quiet block between louder ones is a BREAK; the loudest loud block is the
    /// PEAK; a loud block before it is the BUILD, after it the DRIVE.
    func sectionLabel(at frac: Double) -> String {
        guard let idx = sectionIndex(at: frac) else { return "" }
        var peakIdx = -1
        var peakE = -Double.infinity
        for (i, s) in sections.enumerated() where s.loud && s.energy > peakE {
            peakE = s.energy
            peakIdx = i
        }
        let sec = sections[idx]
        if !sec.loud {
            return idx == 0 ? "intro" : (idx == sections.count - 1 ? "outro" : "break")
        }
        if idx == peakIdx { return "peak" }
        return idx < peakIdx ? "build" : "drive"
    }

    /// The web's `dropPoints`: the boundaries where a quieter block gives way
    /// to a decisively louder one (rise > 0.28 into a loud block), biggest first.
    func dropPoints() -> [(at: Double, strength: Double)] {
        guard sections.count >= 2 else { return [] }
        var out: [(at: Double, strength: Double)] = []
        for i in 1..<sections.count {
            let rise = sections[i].energy - sections[i - 1].energy
            if rise > 0.28 && sections[i].loud {
                out.append((at: sections[i].s, strength: min(1, rise)))
            }
        }
        return out.sorted { $0.strength > $1.strength }
    }

    /// The web's `nextDropAfter`: the first drop strictly ahead of `frac`, or
    /// nil when none remain. Powers "take me to the good part".
    func nextDrop(after frac: Double) -> Double? {
        let ahead = dropPoints().map { $0.at }.filter { $0 > frac + 0.001 }
        return ahead.min()
    }

    /// The web's `analyzeStructure`, for a track the catalog shipped without a
    /// script but with a score: `peaks` is any 0..1 envelope across the whole
    /// track (the TV sums the env bands). Returns nil below 8 samples — the
    /// web's `ok: false`.
    static func analyze(peaks: [Double], minFrac: Double = 0.06) -> Structure? {
        let n = peaks.count
        guard n >= 8 else { return nil }
        let win = max(4, Int((Double(n) / 24).rounded()))
        // box-smoothed envelope
        var env = [Double](repeating: 0, count: n)
        for i in 0..<n {
            let lo = max(0, i - win)
            let hi = min(n - 1, i + win)
            var sum = 0.0
            for j in lo...hi { sum += peaks[j] }
            env[i] = sum / Double(hi - lo + 1)
        }
        var lo = Double.infinity
        var hi = -Double.infinity
        for v in env { lo = min(lo, v); hi = max(hi, v) }
        let span = max(1e-4, hi - lo)
        // loud/quiet with hysteresis so a wobble never splits a block
        let thrHi = lo + span * 0.55
        let thrLo = lo + span * 0.42
        var loudArr = [Bool](repeating: false, count: n)
        var loud = env[0] > lo + span * 0.5
        for i in 0..<n {
            if loud && env[i] < thrLo { loud = false }
            else if !loud && env[i] > thrHi { loud = true }
            loudArr[i] = loud
        }
        let minLen = max(4, Int((Double(n) * minFrac).rounded()))
        var runs: [(s: Int, e: Int, loud: Bool)] = []
        var start = 0
        for i in 1...n {
            if i == n || loudArr[i] != loudArr[start] {
                runs.append((s: start, e: i, loud: loudArr[start]))
                start = i
            }
        }
        var merged: [(s: Int, e: Int, loud: Bool)] = []
        for r in runs {
            if !merged.isEmpty && (r.e - r.s) < minLen {
                merged[merged.count - 1].e = r.e          // absorb a too-short run
            } else {
                merged.append(r)
            }
        }
        let sections: [StructureSection] = merged.map { r in
            var sum = 0.0
            for i in r.s..<r.e { sum += env[i] }
            return StructureSection(s: Double(r.s) / Double(n),
                                    e: Double(r.e) / Double(n),
                                    energy: ((sum / Double(r.e - r.s)) - lo) / span,
                                    loud: r.loud)
        }
        return Structure(sections: sections,
                         apex: derivedApex(sections),
                         mixIn: derivedMixIn(sections),
                         mixOut: derivedMixOut(sections))
    }

    // MARK: derivations (the web's own laws, used when a shipped block omits a field)

    static func derivedApex(_ sections: [StructureSection]) -> Double {
        var apex = 0.6
        var best = -Double.infinity
        for sec in sections where sec.energy > best {
            best = sec.energy
            apex = (sec.s + sec.e) / 2
        }
        return apex
    }

    static func derivedMixIn(_ sections: [StructureSection]) -> Double {
        for sec in sections where sec.loud && sec.s < 0.5 { return sec.s }
        return 0
    }

    static func derivedMixOut(_ sections: [StructureSection]) -> Double {
        var mixOut = 0.9
        for sec in sections where sec.loud && sec.e > 0.45 {
            mixOut = sec.e < 0.97 ? sec.e : 0.97
        }
        return mixOut
    }

    static func clamp01(_ v: Double) -> Double {
        return v < 0 ? 0 : (v > 1 ? 1 : v)
    }
}

// MARK: - the stems

/// Per-source envelopes (`mix.stems`, `sv >= 1`): drums, bass, vocals, other,
/// each a 0..1 series spanning the whole track. Digit strings decoded exactly
/// like `env` — '0'…'9' → value / 9.
struct Stems: Codable, Equatable {
    var hz: Double
    var d: [Double]
    var b: [Double]
    var v: [Double]
    var o: [Double]

    struct Weights: Equatable {
        var drums: Double
        var bass: Double
        var vocals: Double
        var other: Double
        var total: Double { drums + bass + vocals + other }
    }

    /// The web's `stemsAt`: each envelope sampled at a fraction 0..1 of the
    /// track, linearly interpolated. A missing envelope reads 0.
    func sample(at frac: Double) -> Weights {
        let f = Structure.clamp01(frac)
        func pick(_ arr: [Double]) -> Double {
            guard !arr.isEmpty else { return 0 }
            let x = f * Double(arr.count - 1)
            let i = Int(x.rounded(.down))
            let fr = x - Double(i)
            let a0 = arr[min(i, arr.count - 1)]
            let a1 = arr[min(i + 1, arr.count - 1)]
            return a0 + (a1 - a0) * fr
        }
        return Weights(drums: pick(d), bass: pick(b), vocals: pick(v), other: pick(o))
    }

    /// The web's `stemWindow`: the mean of one envelope over the fractional
    /// span [f0, f1] of the track.
    static func window(_ arr: [Double], _ f0: Double, _ f1: Double) -> Double {
        let n = arr.count
        guard n > 0 else { return 0 }
        var a = max(0, Int((f0 * Double(n - 1)).rounded(.down)))
        let b = min(n - 1, Int((f1 * Double(n - 1)).rounded(.up)))
        if b < a { a = b }
        var s = 0.0
        var c = 0
        for i in a...b { s += arr[i]; c += 1 }
        return c > 0 ? s / Double(c) : 0
    }

    /// The web's `vocalClashBias`: a real DJ never lets two voices sing over
    /// each other. A's voice as it leaves (0.82–0.97) against B's as it enters
    /// (0.03–0.18) — overlap past 0.35 is penalised, a drum-led entry (B's drums
    /// > 0.5 at the head) is rewarded a little. Zero when either side is
    /// unseparated. Bounded to [−0.20, +0.05].
    static func vocalClashBias(_ a: Stems?, _ b: Stems?) -> Double {
        guard let a, let b else { return 0 }
        let aVoxOut = window(a.v, 0.82, 0.97)
        let bVoxIn = window(b.v, 0.03, 0.18)
        let bDrumIn = window(b.d, 0.03, 0.18)
        var bias = 0.0
        let clash = min(aVoxOut, bVoxIn)
        if clash > 0.35 { bias -= (clash - 0.35) * 0.6 }
        if bDrumIn > 0.5 { bias += (bDrumIn - 0.5) * 0.1 }
        return max(-0.20, min(0.05, bias))
    }

    /// The web's STEM_PAL: drums warm-red (the transient hit), bass amber (the
    /// body), vocals cyan (the voice sits up and bright), other violet. Blended
    /// by the weights so a drum-driven moment reads red, a vocal passage cyan,
    /// a bass drop amber. Returns nil when every weight is zero.
    static func rgb(_ w: Weights) -> (r: Double, g: Double, b: Double)? {
        let tot = w.total
        guard tot > 1e-6 else { return nil }
        let pd = (255.0, 96.0, 72.0)
        let pb = (255.0, 158.0, 64.0)
        let pv = (120.0, 222.0, 255.0)
        let po = (176.0, 132.0, 255.0)
        let r = (pd.0 * w.drums + pb.0 * w.bass + pv.0 * w.vocals + po.0 * w.other) / tot / 255
        let g = (pd.1 * w.drums + pb.1 * w.bass + pv.1 * w.vocals + po.1 * w.other) / tot / 255
        let b = (pd.2 * w.drums + pb.2 * w.bass + pv.2 * w.vocals + po.2 * w.other) / tot / 255
        return (r, g, b)
    }
}

// MARK: - the story

/// The five-act arc and the moods, as the web reads them. `act` centres the
/// arc on the script's real apex when there is one; without a script it falls
/// back to the progress template (0.10 / 0.42 / 0.70 / 0.88).
enum Story {
    static let actNames = ["OVERTURE", "RISING", "APEX", "TURN", "RESOLVE"]
    /// The web ACTS table: how hot the shaders run per act.
    static let actHeat: [Double] = [0.15, 0.45, 1.00, 0.65, 0.25]
    /// …how long a room dwells per act.
    static let actDwell: [Double] = [1.35, 1.00, 0.62, 0.85, 1.45]
    /// …and the palette's temperature pull per act (ACT_WARMTH).
    static let actWarmth: [Double] = [-0.22, 0.0, 0.30, 0.14, -0.30]

    /// The act at `prog` (0..1). With a script the boundaries are apex − 0.28,
    /// apex − 0.05, apex + 0.12, apex + 0.30; without one the template applies,
    /// nudged by `push` (the web's short/long energy ratio lean, ±0.08).
    static func act(prog: Double, structure: Structure?, push: Double = 0) -> Int {
        if let st = structure {
            let a = st.apex
            if prog < a - 0.28 { return 0 }
            if prog < a - 0.05 { return 1 }
            if prog < a + 0.12 { return 2 }
            if prog < a + 0.30 { return 3 }
            return 4
        }
        let p = Structure.clamp01(prog + max(-0.08, min(0.08, push)))
        if p < 0.10 { return 0 }
        if p < 0.42 { return 1 }
        if p < 0.70 { return 2 }
        if p < 0.88 { return 3 }
        return 4
    }

    /// The web's `actWarmth`: the arc's temperature, scaled by the ceiling so
    /// an apex the music holds back is a warm room and not a furnace.
    static func warmth(act: Int, ceil: Double) -> Double {
        let i = (act >= 0 && act < actWarmth.count) ? act : 1
        return actWarmth[i] * Structure.clamp01(ceil)
    }

    /// The web's `moodOf`: a listener-facing mood bucket from features the
    /// catalog already measures. Two honest axes — arousal (energy + onsets)
    /// and valence (major/minor + brightness − entropy) — six buckets phrased
    /// the way a listener asks ("something calm for the morning").
    static func moodOf(features: Features?, key: String?) -> String {
        let energy = features?.energy ?? 0.5
        let onsets = features?.onsets ?? 0.5
        let bright = features?.brightness ?? 0.5
        let entropy = features?.entropy ?? 0.5
        // unknown key → open/bright; a strict Camelot parse decides otherwise
        let major: Bool = MixPlanner.camelotParse(key).map { $0.major } ?? true
        let arousal = Structure.clamp01(energy * 0.65 + onsets * 0.35)
        let valence = Structure.clamp01(0.5 + (major ? 0.18 : -0.18) + (bright - 0.5) * 0.4 - (entropy - 0.5) * 0.25)
        if arousal < 0.35 { return valence >= 0.5 ? "calm" : "moody" }
        if arousal < 0.62 { return valence >= 0.5 ? "warm" : "tense" }
        return valence >= 0.5 ? "driving" : "dark"
    }
}
