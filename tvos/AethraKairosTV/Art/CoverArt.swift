import UIKit
import simd

/* ================================================================
   GENERATIVE COVER ART — the label's records dress themselves.
   The make_art.mjs algorithm, natively: a record's face is an honest
   portrait of what it sounds like. Hue from the first track's detected
   key on the Camelot wheel; density and amplitude from the analysed
   energy; the motif from the album's name; all of it stepped through a
   seeded PRNG so the same record always renders the same face. The RNG
   CALL ORDER below is load-bearing — every rng() is sequenced exactly
   as the JS consumes it. All geometry lives in the 1024-space of the
   original sleeve and scales to any square size through the CTM.
   ================================================================ */
enum CoverArt {

    /// The JS seed hash: a = (a*31 + charCode) | 0 over the seed string —
    /// int32 wraparound, negative intermediates are normal. Hashed over
    /// UTF-16 code units, exactly what charCodeAt walks; the seeds are the
    /// sha256 hex STRING (ASCII) or the album tag.
    static func hash31(_ s: String) -> UInt32 {
        var a: Int32 = 0
        for unit in s.utf16 {
            a = a &* 31 &+ Int32(unit)
        }
        return UInt32(bitPattern: a)
    }

    /// Deterministic sleeve for an album: seeded by the FIRST track's sha256
    /// hex string (fallback: the tag), motif by the tag, hue by the key,
    /// amplitude by the energy. Same album, same face — at any size.
    static func draw(album: Album, artist: String, label: String, size: CGFloat) -> UIImage {
        let S = 1024.0
        let side = max(size, 1)
        let first = album.tracks.first
        let seed = (first?.sha256).flatMap { $0.isEmpty ? nil : $0 } ?? album.tag
        let rng = JourneyEngine.mulberry32(hash31(seed))

        let key = first?.mix?.key
        // energy passes through as analysed — a 0-energy track keeps e = 0
        // and the motifs degrade gracefully (amplitudes just shrink);
        // only a MISSING analysis takes the 0.5 default.
        let e = first?.features?.energy ?? 0.5
        let bpm = first?.mix?.bpm ?? 120

        // key → hue, the colour engine's wheel. An unparseable key spends
        // exactly one rng call on a random hue — the sequence must not drift.
        let H: Double
        let minor: Bool
        if let hue = Palette.camelotHue(key) {
            H = hue
            minor = key?.hasSuffix("A") ?? false
        } else {
            H = rng() * 360
            minor = false
        }
        let L = minor ? 0.55 : 0.63                      // minor sits darker, major higher

        let tag = album.tag.lowercased()
        enum Motif { case rings, ribbon, burst }
        let motif: Motif = tag.contains("breath") ? .rings
            : (tag.contains("walk") || tag.contains("mobius")) ? .ribbon
            : .burst

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
        return renderer.image { rctx in
            let g = rctx.cgContext
            g.scaleBy(x: side / S, y: side / S)          // everything below is 1024-space
            let space = CGColorSpaceCreateDeviceRGB()

            // ground: deep vertical wash of the key colour
            let bgColors = [oklch(0.13, 0.02, H).cgColor,
                            oklch(0.16, 0.035, H + 10).cgColor,
                            oklch(0.10, 0.02, H - 15).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: space, colors: bgColors, locations: [0, 0.55, 1]) {
                g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: S),
                                     options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            }

            // motif strokes are ADDITIVE — light sums, exactly canvas 'lighter'
            g.setBlendMode(.plusLighter)
            switch motif {
            case .ribbon:
                // a Möbius band walking across the frame: layered sine strands
                // that twist once — width collapses through the crossing
                let strands = 110
                for i in 0..<strands {
                    let t0 = Double(i) / Double(strands)
                    let drift = (rng() - 0.5) * 90       // rng #1, before the walk
                    var pts: [CGPoint] = []
                    pts.reserveCapacity(139)
                    var x = -40.0
                    while x <= S + 40 {                  // −40…1064 inclusive, step 8
                        let u = x / S
                        let twist = cos(u * .pi * 2 + t0 * .pi)   // the fold
                        let y = S * 0.52
                              + sin(u * .pi * 2.2 + t0 * 6.4) * (120 + e * 160) * twist
                              + (t0 - 0.5) * 300 * abs(twist)
                              + drift * (1 - abs(twist))
                        pts.append(CGPoint(x: x, y: y))
                        x += 8
                    }
                    g.beginPath()
                    g.addLines(between: pts)
                    let alpha = 0.10 + rng() * 0.08      // rng #2
                    g.setStrokeColor(oklch(L + t0 * 0.25, 0.11 + e * 0.06, H + t0 * 34 - 10, alpha).cgColor)
                    g.setLineWidth(CGFloat(1 + rng() * 2.2))   // rng #3
                    g.strokePath()
                }

            case .rings:
                // breath: concentric rings that wobble like slow lungs
                let rings = 46
                for i in 0..<rings {
                    let t0 = Double(i) / Double(rings)
                    let R = 60 + t0 * 430
                    let wob = 6 + t0 * 26 + e * 20
                    let ph = rng() * .pi * 2             // rng #1
                    let lobes = Double(3 + Int(rng() * 4))     // rng #2, floored
                    var pts: [CGPoint] = []
                    pts.reserveCapacity(221)
                    for k in 0...220 {
                        let th = Double(k) / 220 * .pi * 2
                        let r = R + sin(th * lobes + ph) * wob
                        pts.append(CGPoint(x: S * 0.5 + cos(th) * r,
                                           y: S * 0.46 + sin(th) * r * 0.96))
                    }
                    g.beginPath()
                    g.addLines(between: pts)
                    g.closePath()
                    g.setStrokeColor(oklch(L + (1 - t0) * 0.3, 0.10 + (1 - t0) * 0.06,
                                           H + t0 * 26 - 8, 0.16 * (1 - t0 * 0.7)).cgColor)
                    g.setLineWidth(CGFloat(1.2 + (1 - t0) * 1.6))
                    g.strokePath()
                }
                // a soft radial glow at the lungs' centre, still additive
                let center = CGPoint(x: S * 0.5, y: S * 0.46)
                let glowColors = [oklch(0.85, 0.06, H, 0.25).cgColor,
                                  oklch(0.85, 0.06, H, 0).cgColor] as CFArray
                if let grad = CGGradient(colorsSpace: space, colors: glowColors, locations: [0, 1]) {
                    g.drawRadialGradient(grad, startCenter: center, startRadius: 0,
                                         endCenter: center, endRadius: 240, options: [])
                }

            case .burst:
                // a pressed master — a spectral fan of rays from the low centre
                let rays = 190
                let x0 = S * 0.5
                let y0 = S * 0.66
                for i in 0..<rays {
                    let t0 = Double(i) / Double(rays)
                    let th = t0 * .pi * 1.15 + .pi * 0.925    // upward fan
                    let len = 180 + pow(rng(), 1.6) * (420 + e * 220)   // rng #1
                    g.beginPath()
                    g.move(to: CGPoint(x: x0 + cos(th) * 40, y: y0 + sin(th) * 40))
                    g.addLine(to: CGPoint(x: x0 + cos(th) * len, y: y0 + sin(th) * len))
                    let sl = L + rng() * 0.3             // rng #2
                    let sc = 0.10 + rng() * 0.08         // rng #3
                    let sa = 0.12 + rng() * 0.14         // rng #4
                    g.setStrokeColor(oklch(sl, sc, H + (t0 - 0.5) * 44, sa).cgColor)
                    g.setLineWidth(CGFloat(1 + rng() * 3))    // rng #5
                    g.strokePath()
                }
                let coreR = 34 + e * 22
                g.setFillColor(oklch(0.9, 0.05, H, 0.85).cgColor)
                g.fillEllipse(in: CGRect(x: x0 - coreR, y: y0 - coreR,
                                         width: coreR * 2, height: coreR * 2))
            }
            g.setBlendMode(.normal)

            // grain — record-sleeve tooth. Three rng calls per dot: alpha, x, y.
            for _ in 0..<5200 {
                let alpha = 0.015 + rng() * 0.035
                let gx = rng() * S
                let gy = rng() * S
                g.setFillColor(UIColor(red: 1, green: 1, blue: 1, alpha: CGFloat(alpha)).cgColor)
                g.fill(CGRect(x: gx, y: gy, width: 1, height: 1))
            }

            // vignette: transparent to 0.42*S, black 0.42 by 0.75*S and held beyond
            let vColors = [UIColor(red: 0, green: 0, blue: 0, alpha: 0).cgColor,
                           UIColor(red: 0, green: 0, blue: 0, alpha: 0.42).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: space, colors: vColors, locations: [0, 1]) {
                let c = CGPoint(x: S / 2, y: S / 2)
                g.drawRadialGradient(grad, startCenter: c, startRadius: S * 0.42,
                                     endCenter: c, endRadius: S * 0.75,
                                     options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            }

            // the sleeve type — alphabetic baselines at the web's coordinates
            drawText(album.title,
                     font: serifItalicFont(size: 68),
                     color: oklch(0.93, 0.03, H, 0.95),
                     baseline: CGPoint(x: 64, y: S - 132))
            let sub = "\(artist)  ·  \(Int(bpm.rounded())) BPM  ·  \(key ?? "")".uppercased()
            drawText(sub,
                     font: monoFont(size: 26),
                     color: oklch(0.8, 0.05, H, 0.8),
                     baseline: CGPoint(x: 66, y: S - 84))
            drawText("∞⁸ " + label.uppercased(),
                     font: monoFont(size: 22),
                     color: oklch(0.75, 0.04, H, 0.6),
                     baseline: CGPoint(x: S - 56, y: S - 56),
                     rightAligned: true)
        }
    }

    /// Monogram fallback — the web's styled first letter, for an album with
    /// zero tracks to seed from: serif italic over the faint fixed
    /// amber→ice 135° wash, on the void ground.
    static func monogram(title: String, size: CGFloat) -> UIImage {
        let side = max(size, 1)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
        return renderer.image { rctx in
            let g = rctx.cgContext
            // the void — #05060e
            g.setFillColor(UIColor(red: 5.0 / 255.0, green: 6.0 / 255.0, blue: 14.0 / 255.0, alpha: 1).cgColor)
            g.fill(CGRect(x: 0, y: 0, width: side, height: side))
            // faint amber → ice, the 135° two-tone the web tiles carry
            let cols = [UIColor(red: 255.0 / 255.0, green: 180.0 / 255.0, blue: 84.0 / 255.0, alpha: 0.10).cgColor,
                        UIColor(red: 110.0 / 255.0, green: 231.0 / 255.0, blue: 255.0 / 255.0, alpha: 0.10).cgColor] as CFArray
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: cols, locations: [0, 1]) {
                g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: side, y: side),
                                     options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            }
            // the letter, in --faint ink (#5c657c)
            let letter = title.first.map { String($0).uppercased() } ?? "?"
            let font = serifItalicFont(size: side * 0.36)
            let ink = UIColor(red: 92.0 / 255.0, green: 101.0 / 255.0, blue: 124.0 / 255.0, alpha: 1)
            let str = NSAttributedString(string: letter,
                                         attributes: [.font: font, .foregroundColor: ink])
            let sz = str.size()
            str.draw(at: CGPoint(x: (side - sz.width) / 2, y: (side - sz.height) / 2))
        }
    }

    // MARK: - internals

    /// oklch() the way the canvas parsed it: normalize hue mod 360, convert
    /// through the colour engine's own gamut-mapped OKLab path, carry alpha.
    private static func oklch(_ l: Double, _ c: Double, _ h: Double, _ alpha: Double = 1) -> UIColor {
        var hue = h.truncatingRemainder(dividingBy: 360)
        if hue < 0 { hue += 360 }
        let rgb = Palette.oklchToRGB(l: l, c: c, h: hue)
        return UIColor(red: CGFloat(rgb.x), green: CGFloat(rgb.y), blue: CGFloat(rgb.z),
                       alpha: CGFloat(alpha))
    }

    /// Web asks 'italic 600 Georgia'; Georgia ships on Apple platforms with
    /// regular/bold italics only, so Georgia-Italic stands in for the 600,
    /// then a serif-italic system descriptor, then plain italic system.
    private static func serifItalicFont(size: CGFloat) -> UIFont {
        if let georgia = UIFont(name: "Georgia-Italic", size: size) { return georgia }
        let base = UIFont.systemFont(ofSize: size, weight: .semibold)
        if let desc = base.fontDescriptor.withDesign(.serif)?.withSymbolicTraits(.traitItalic) {
            return UIFont(descriptor: desc, size: size)
        }
        return UIFont.italicSystemFont(ofSize: size)
    }

    /// Courier New at weight 500 → the Courier family where present, else
    /// the system mono at medium.
    private static func monoFont(size: CGFloat) -> UIFont {
        if let courierNew = UIFont(name: "CourierNewPSMT", size: size) { return courierNew }
        if let courier = UIFont(name: "Courier", size: size) { return courier }
        return UIFont.monospacedSystemFont(ofSize: size, weight: .medium)
    }

    /// Canvas fillText draws at an alphabetic BASELINE; UIKit string drawing
    /// draws from the line top. The ascender is the bridge.
    private static func drawText(_ text: String, font: UIFont, color: UIColor,
                                 baseline: CGPoint, rightAligned: Bool = false) {
        let str = NSAttributedString(string: text,
                                     attributes: [.font: font, .foregroundColor: color])
        let sz = str.size()
        let origin = CGPoint(x: rightAligned ? baseline.x - sz.width : baseline.x,
                             y: baseline.y - font.ascender)
        str.draw(at: origin)
    }
}
