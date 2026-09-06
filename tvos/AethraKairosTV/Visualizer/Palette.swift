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

    // MARK: - the chord

    /// The three-stop colour chord for a track. Root hue from its key — the
    /// ice axis (~197°) when keyless, so the room boots in brand colour, not
    /// gray. The scheme follows the music's character: SPECTRUM only when
    /// entropy > 0.80 AND energy > 0.62 — rainbows must be earned; a rainbow
    /// over a calm track says nothing about the track. Driving energy earns
    /// the complement — the TRITONE at 177.1°, not 180: diabolus in musica,
    /// and the eye cannot say why it is uneasy. Everything else reads as
    /// analogous neighbours ±26°. Minor keys sit darker (L 0.55) than major
    /// (0.63); arousal buys chroma, 0.11–0.14.
    static func chord(for track: Track?) -> (a: SIMD3<Float>, b: SIMD3<Float>, c: SIMD3<Float>) {
        let key = track?.mix?.key
        let root: Double
        let minor: Bool
        if let h = camelotHue(key) {
            root = h
            minor = camelotParse(key)?.major == false
        } else {
            root = 197                                   // the ice axis — #6ee7ff's neighbourhood
            minor = false
        }
        let e = clamp01(track?.features?.energy ?? 0)
        let ent = clamp01(track?.features?.entropy ?? 0)
        let l0 = minor ? 0.55 : 0.63
        let c0 = 0.11 + 0.03 * e

        let hues: (Double, Double, Double)
        if ent > 0.80 && e > 0.62 {
            hues = (root, root + 120, root + 240)        // spectrum — earned, the whole wheel
        } else if e > 0.62 {
            hues = (root, root + 177.1, root + 26)       // complement — the tritone drives
        } else {
            hues = (root - 26, root, root + 26)          // analogous — calm and tonal
        }
        // the harmony sits a touch higher and the accent higher still, so the
        // chord reads as depth on screen instead of three flat swatches
        let a = oklchToRGB(l: l0, c: c0, h: norm360(hues.0))
        let b = oklchToRGB(l: min(0.95, l0 + 0.04), c: c0 * 0.9, h: norm360(hues.1))
        let c = oklchToRGB(l: min(0.95, l0 + 0.12), c: c0 * 0.85, h: norm360(hues.2))
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
