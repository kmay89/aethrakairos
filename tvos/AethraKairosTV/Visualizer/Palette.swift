import Foundation
import simd

/* ================================================================
   THE COLOUR ENGINE'S WHEEL — meaning, not mood-boards.
   The room is not themed, it is LIT BY THE MUSIC: the playing track's
   detected key maps around the Camelot wheel to a root hue (the circle
   of fifths IS a colour wheel — Scriabin's old idea, wired to real
   analysis), and every blend happens in OKLCH, gamut-mapped by walking
   chroma down — never by channel clipping. Features in, palette out,
   deterministic, portable to any surface that takes RGB.
   ================================================================ */
enum Palette {

    // MARK: - key → hue

    /// H = ((n−1)/12·300 + 40) mod 360 — 25° per Camelot step, the same
    /// mapping the Crate's key chips and the generated cover art use, so any
    /// track list and the light always agree. Strict parse: /^\d{1,2}(A|B)$/,
    /// n in 1…12, uppercase only — an invented key would be a lie told in light.
    static func camelotHue(_ key: String?) -> Double? {
        guard let parsed = camelotParse(key) else { return nil }
        return (Double(parsed.n - 1) / 12 * 300 + 40).truncatingRemainder(dividingBy: 360)
    }

    // MARK: - OKLCH → sRGB

    /// OKLab (Björn Ottosson's matrices): hue/chroma → a,b; LMS' from M1;
    /// cube; linear sRGB from M2; gamma-encode on the 2.4 curve. Out-of-gamut
    /// colours walk chroma down in 0.008 steps until every channel sits
    /// within [−0.0005, 1.0005] — hue and lightness survive, saturation pays.
    static func oklchToRGB(l: Double, c: Double, h: Double) -> SIMD3<Float> {
        let hr = h * Double.pi / 180
        var chroma = max(0, c)
        while true {
            let a = chroma * cos(hr)
            let b = chroma * sin(hr)
            let l_ = l + 0.3963377774 * a + 0.2158037573 * b
            let m_ = l - 0.1055613458 * a - 0.0638541728 * b
            let s_ = l - 0.0894841775 * a - 1.2914855480 * b
            let l3 = l_ * l_ * l_
            let m3 = m_ * m_ * m_
            let s3 = s_ * s_ * s_
            let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
            let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
            let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
            let inGamut = r >= -0.0005 && r <= 1.0005
                       && g >= -0.0005 && g <= 1.0005
                       && bl >= -0.0005 && bl <= 1.0005
            if chroma <= 0 || inGamut {
                return SIMD3<Float>(gammaEncode(r), gammaEncode(g), gammaEncode(bl))
            }
            chroma -= 0.008
        }
    }

    // MARK: - the plan (the web's colorPlan, ported whole)

    /// One OKLCH stop — the space every blend happens in.
    struct Stop: Equatable {
        var l: Double
        var c: Double
        var h: Double
    }

    /// The designer's decision for a track, pure: scheme, keyed-ness and the
    /// three stops (identity / harmony / accent), still in OKLCH so the
    /// renderer can GLIDE between plans through colour instead of mud.
    struct Plan: Equatable {
        var scheme: String
        var keyed: Bool
        var minor: Bool
        var stops: [Stop]      // [a, b, c]
    }

    static func lClamp(_ l: Double) -> Double { return min(0.95, max(0.22, l)) }

    /// MOZART's angles: a pitch ratio lands on the wheel at 360·frac(log2 r) —
    /// the log-map that makes octaves identities makes intervals ANGLES.
    static func intervalHue(_ num: Double, _ den: Double) -> Double {
        let f = log2(num / den)
        return norm360((f - floor(f)) * 360)
    }

    /// The golden gate: a swell peaking at φ of the phrase, so the light's
    /// biggest breath lands on the golden section.
    static func goldenGate(_ frac: Double) -> Double {
        let d = (frac.truncatingRemainder(dividingBy: 1) + 1)
            .truncatingRemainder(dividingBy: 1) - 0.618033988749895
        return exp(-(d * d) / (2 * 0.055 * 0.055))
    }

    /// CHARACTER → CHORD, six readings ordered from the rarest inward.
    /// SPECTRUM stays deliberately the rarest — it takes material that has
    /// genuinely come apart, high entropy AND high energy together.
    static func colorScheme(e: Double, ent: Double) -> String {
        if ent > 0.80 && e > 0.62 { return "spectrum" }   // come apart: the whole wheel
        if ent > 0.62 { return "triad" }                  // dense: three points of order
        if ent > 0.45 && e > 0.75 { return "seventh" }    // hot AND arguing with itself
        if e > 0.55 { return ent <= 0.20 ? "sixth" : "complement" }
        if ent > 0.35 { return "suspended" }              // quiet, but not settled
        return "analogous"                                // calm and tonal: neighbours
    }

    /// The chord a scheme spells, as hue offsets from the root — every one an
    /// interval the ear already knows. Unkeyed material keeps the classic
    /// art-school spreads: the intervals have to be earned by knowing the key.
    /// `lift` marks the accent as the pale bright stop rather than a chromatic
    /// one; the two-note chords need somewhere to rise to, the wide ones don't.
    static func schemeChord(scheme: String, minor: Bool, keyed: Bool, r: Double)
        -> (b: Double, c: Double, lift: Bool) {
        let third = keyed ? intervalHue(minor ? 6 : 5, minor ? 5 : 4) : 120
        let fifth = keyed ? intervalHue(3, 2) : 240
        switch scheme {
        case "suspended":      // the perfect fourth — hanging, refusing to resolve
            let s = keyed ? intervalHue(4, 3) : 150
            return (s, s / 2, true)
        case "complement":     // the TRITONE, 177.1° and not 180
            let s = keyed ? intervalHue(45, 32) : 180
            return (s, s, true)
        case "sixth":          // open and warm: the sixth, resting on the fifth
            return (keyed ? intervalHue(minor ? 8 : 5, minor ? 5 : 3) : 210, fifth, false)
        case "triad", "spectrum":
            return (third, fifth, false)
        case "seventh":        // third and minor seventh (the fifth is the web
                               // gradient's fourth note; three swatches carry three)
            return (third, keyed ? intervalHue(9, 5) : 300, false)
        default:               // analogous — the semitone leans
            let s = keyed ? intervalHue(16, 15) : 24 + r * 12
            return (s, -s, true)
        }
    }

    /// THE ARC'S TEMPERATURE — an overture is cold light, an apex hot, a
    /// resolve cools again — as a pull toward a pole, scaled by the ceiling.
    static let actWarmthTable: [Double] = [-0.22, 0.0, 0.30, 0.14, -0.30]
    static func actWarmth(act: Double, heat: Double) -> Double {
        let i = min(max(Int(act.rounded(.down)), 0), actWarmthTable.count - 1)
        return actWarmthTable[i] * clamp01(heat)
    }

    /// How a pull becomes a hue: a partial walk along the SHORTER arc toward
    /// the amber pole or the cold blue one, capped in DEGREES too — past a
    /// quarter-turn it stops being a temperature and starts being a key
    /// change, and the key is not the light's to change.
    static let warmMaxDeg: Double = 26
    static func warmTilt(h: Double, pull: Double) -> Double {
        let w = min(max(pull, -1), 1)
        let H = norm360(h)
        if w == 0 { return H }
        let pole: Double = w > 0 ? 45 : 225
        let d = ((pole - H + 540).truncatingRemainder(dividingBy: 360)) - 180
        let move = d * min(0.45, abs(w))
        return norm360(H + max(-warmMaxDeg, min(warmMaxDeg, move)))
    }

    /// Shortest signed arc between two hues, for chord rotation and glides.
    static func shortestArc(from a: Double, to b: Double) -> Double {
        return ((b - a + 540).truncatingRemainder(dividingBy: 360)) - 180
    }

    /// Hue-aware lerp: the shortest arc around the wheel, so a glide from
    /// 350° to 10° passes through red, not the entire rainbow.
    static func lerp(_ a: Stop, _ b: Stop, _ t: Double) -> Stop {
        return Stop(l: a.l + (b.l - a.l) * t,
                    c: a.c + (b.c - a.c) * t,
                    h: norm360(a.h + shortestArc(from: a.h, to: b.h) * t))
    }

    /// mulberry32, exactly the web's — the plan's dice must roll the same.
    static func mulberry(_ seed: UInt32) -> () -> Double {
        var a = seed
        return {
            a = a &+ 0x6D2B79F5
            var t = (a ^ (a >> 15)) &* (1 | a)
            t = t &+ ((t ^ (t >> 7)) &* (61 | t)) ^ t
            return Double((t ^ (t >> 14))) / 4294967296.0
        }
    }

    /// A track-stable seed, so the same song always deals the same room.
    static func seed(for track: Track?, bump: Int) -> UInt32 {
        let s = track.map { $0.sha256 ?? $0.url.absoluteString } ?? "live"
        var h: UInt32 = 2166136261
        for b in s.utf8 { h = (h ^ UInt32(b)) &* 16777619 }
        return h &+ UInt32(truncatingIfNeeded: bump)
    }

    /// colorPlan, the web's designer's decision, pure. Root hue from the key;
    /// unkeyed material derives one from its own brightness and entropy (and
    /// the seed) instead of being handed gray; timbre tilts the root a little
    /// (bright material leans warm); arousal buys chroma in OKLCH's vivid
    /// range 0.14–0.46 — RADIANT, not pastel, the gamut mapper walks it down
    /// safely where sRGB can't follow. A track with no features at all still
    /// boots in the ice axis, brand colour and not gray.
    static func plan(for track: Track?, seedBump: Int = 0) -> Plan {
        let rng = mulberry(seed(for: track, bump: seedBump))
        let key = track?.mix?.key
        let e = clamp01(track?.features?.energy ?? 0)
        let ent = clamp01(track?.features?.entropy ?? 0)
        let br = clamp01(track?.features?.brightness ?? 0.4)
        let act = 0.5                                    // the live arc breathes later
        var rootH: Double
        let keyed: Bool
        var minor = false
        if let h = camelotHue(key) {
            rootH = h
            keyed = true
            minor = camelotParse(key)?.major == false
        } else if track?.features != nil {
            rootH = (br * 320 + ent * 160 + rng() * 40).truncatingRemainder(dividingBy: 360)
            keyed = false
        } else {
            rootH = 197                                  // the ice axis — boot in brand colour
            keyed = false
        }
        // timbre tilts the root a little: bright material leans warm
        rootH = norm360(rootH + (br - 0.35) * 26)
        let scheme = colorScheme(e: e, ent: ent)
        let base = scheme == "spectrum" ? "triad" : scheme
        // arousal → chroma; mode → lightness + temperature
        let c0 = 0.14 + e * 0.20 + act * 0.12
        let l0 = lClamp((minor ? 0.50 : 0.56) + e * 0.08 + act * 0.05 - ent * 0.05)
        let H = norm360(rootH + (minor ? 14 : -6))
        let ch = schemeChord(scheme: base, minor: minor, keyed: keyed, r: rng())
        let a = Stop(l: l0, c: c0, h: H)
        let b = Stop(l: lClamp(l0 + (base == "analogous" ? 0.06 : 0.04)),
                     c: c0 * 0.9, h: norm360(H + ch.b))
        // even the bright accent carries real hue — a near-white accent is
        // what reads as "washed out" the moment particles stack additively
        let c = ch.lift
            ? Stop(l: 0.85, c: 0.08 + e * 0.06, h: norm360(H + ch.c))
            : Stop(l: lClamp(l0 + 0.16), c: c0 * 0.85, h: norm360(H + ch.c))
        return Plan(scheme: scheme, keyed: keyed, minor: minor, stops: [a, b, c])
    }

    // MARK: - the chord (compatibility: the plan, converted once)

    /// The three-swatch RGB chord — the HUD and the stage packet read this;
    /// the renderer glides the plan's OKLCH stops itself.
    static func chord(for track: Track?) -> (a: SIMD3<Float>, b: SIMD3<Float>, c: SIMD3<Float>) {
        let p = plan(for: track)
        let a = oklchToRGB(l: p.stops[0].l, c: p.stops[0].c, h: p.stops[0].h)
        let b = oklchToRGB(l: p.stops[1].l, c: p.stops[1].c, h: p.stops[1].h)
        let c = oklchToRGB(l: p.stops[2].l, c: p.stops[2].c, h: p.stops[2].h)
        return (a, b, c)
    }

    // MARK: - brand constants

    /// The near-black void ground — everything is lit against this.
    static let voidColor = SIMD3<Float>(5.0 / 255.0, 6.0 / 255.0, 14.0 / 255.0)      // #05060e
    /// π's axis — warm amber.
    static let amber = SIMD3<Float>(255.0 / 255.0, 180.0 / 255.0, 84.0 / 255.0)      // #ffb454
    /// e's axis — cold ice, the default accent before any audio.
    static let ice = SIMD3<Float>(110.0 / 255.0, 231.0 / 255.0, 255.0 / 255.0)       // #6ee7ff
    /// The beat's colour.
    static let beatPink = SIMD3<Float>(255.0 / 255.0, 92.0 / 255.0, 135.0 / 255.0)   // #ff5c87

    // MARK: - internals

    /// Strict Camelot parse: 1–2 digits then an uppercase A (minor) or B
    /// (major); n must land in 1…12. Anything else is unkeyed, never guessed.
    private static func camelotParse(_ key: String?) -> (n: Int, major: Bool)? {
        guard let key = key, key.count == 2 || key.count == 3 else { return nil }
        guard let letter = key.last, letter == "A" || letter == "B" else { return nil }
        let digits = key.dropLast()
        guard !digits.isEmpty,
              digits.allSatisfy({ $0.isASCII && $0.isNumber }),
              let n = Int(digits), n >= 1, n <= 12 else { return nil }
        return (n, letter == "B")
    }

    private static func gammaEncode(_ v: Double) -> Float {
        let x = min(1, max(0, v))
        return Float(x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055)
    }

    private static func clamp01(_ v: Double) -> Double {
        return v < 0 ? 0 : (v > 1 ? 1 : v)
    }

    private static func norm360(_ h: Double) -> Double {
        let m = h.truncatingRemainder(dividingBy: 360)
        return m < 0 ? m + 360 : m
    }
}
