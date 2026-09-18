import Foundation
import simd

/* ================================================================
   THE WIRE PACKET — the booth's feature frame, told to a screen.

   The design's whole stage argument (DESIGN §1.2o) is that a screen
   should render the FIELD from numbers, never from streamed pixels:
   "rendering locally beats streaming pixels on every axis the room
   can see." So the booth broadcasts ~40 floats at ~30 Hz — the same
   `stageApplyFeat` frame the web screen reads — and this Apple TV
   draws exactly what a laptop screen would draw from the same booth,
   on its own GPU. This struct is that frame: flat, Codable, and above
   all TOLERANT. A packet is a snapshot, not a command; the far side
   does no arithmetic it can avoid (the camera crosses whole as a pose,
   the colours cross as finished OKLCH stops).

   The law of arrival (§1.2m‴): a half-arrived packet HOLDS LAST GOOD —
   it degrades to held, never to zero. `decode(_:over:)` enforces that
   field by field, so a dropped `energy` keeps the last energy rather
   than snapping the field dark. Silence is the CLIENT's business (four
   seconds with no packet → the held state); a present-but-partial
   packet is this decoder's.
   ================================================================ */

struct StagePacket: Codable, Equatable {

    // -- the clock: the booth's own stamp in seconds. Not a wall clock and
    //    not consumed by the geometry; the client subtracts it from local
    //    time for a smoothed skew estimate (`stageOffset`), the seed of any
    //    future cut-accurate wall. --
    var clock: Double

    // -- the scene: which room the booth is in, an index into Rooms.all
    //    (clamped where it is used). The booth deals the room; the screen
    //    never self-directs mid-show (§1.2m: "screens never self-update"). --
    var scene: Int

    // -- the ears --
    var bands: [Float]        // spectrum bands, 0..1 (the renderer reads up to 64)
    var beat: Float           // onset envelope, 0..1 (snap-and-decay)
    var beatPhase: Float      // 0..1 within the beat
    var barPhase: Float       // 0..1 within the bar (4 beats)
    var phrasePhase: Float    // 0..1 within the 32-beat phrase
    var bpm: Float
    var energy: Float
    var bass: Float
    var mid: Float
    var treble: Float
    var calm: Float

    // -- the story: the five-act arc, eased upstream, and the INK white
    //    budget the booth's grade opened. --
    var act: Float            // 0..4
    var white: Float          // 0.05..0.92

    // -- the dancer: anticipation and precognition, read by rooms that lean
    //    into a coming drop. --
    var pulse: Float
    var brace: Float

    // -- the light: three finished OKLCH stops. The booth already resolved
    //    the chord (key → hue, scheme by energy × entropy); the screen only
    //    converts to RGB, so the palette agrees everywhere by construction. --
    var colors: [OKLCH]

    // -- the lens the booth chose (-1 none / 0 mirrors / 1 wave / 2 prism /
    //    3 iris / 4 tile / 5 moire) and its amount. The stage renderer draws
    //    rooms only (no lens pass), so these ride for completeness and for a
    //    later pass, harmless in the room uniforms. --
    var lens: Float
    var lensAmt: Float

    // -- the hand on the booth's glass. The screen bends its field toward it
    //    exactly as a room leans toward the phantom hand — the booth's touch
    //    reaches across the wire and warps the TV's picture. --
    var hand: Hand

    // -- the camera pose the booth crossed, carried WHOLE (position +
    //    quaternion + FOV, eight numbers) so the far side does no arithmetic
    //    on it. The room fragment fields are 2D and do not consume a pose
    //    today; it rides for the wall and for rooms that later read one. --
    var camera: Camera

    struct OKLCH: Codable, Equatable {
        var l: Double
        var c: Double
        var h: Double
    }

    struct Hand: Codable, Equatable {
        var x: Float          // -1..1-ish, centered field space
        var y: Float
        var presence: Float   // 0..1
        var mode: Float       // interaction personality index (informational)
        var synthetic: Bool   // the booth's own ghost, not a real hand
    }

    struct Camera: Codable, Equatable {
        var position: SIMD3<Float>
        var quaternion: SIMD4<Float>
        var fov: Float
    }

    // MARK: - the default: a calm, cool field, never black

    /// The frame a screen holds before the booth has said anything — a quiet
    /// ice field on the void, so joining shows the instrument breathing rather
    /// than a dead rectangle. Missing scalars in a real packet fall back to
    /// THESE, not to zero.
    static let idle = StagePacket(
        clock: 0,
        scene: 0,
        bands: [Float](repeating: 0, count: 64),
        beat: 0, beatPhase: 0, barPhase: 0, phrasePhase: 0,
        bpm: 0,
        energy: 0.06, bass: 0.04, mid: 0.04, treble: 0.03, calm: 1.0,
        act: 0, white: 0.10,
        pulse: 0, brace: 0,
        colors: [
            OKLCH(l: 0.72, c: 0.11, h: 225),   // ice, the keyless default
            OKLCH(l: 0.63, c: 0.13, h: 45),    // amber
            OKLCH(l: 0.80, c: 0.04, h: 90)     // cream
        ],
        lens: -1, lensAmt: 0,
        hand: Hand(x: 0, y: 0, presence: 0, mode: 0, synthetic: false),
        camera: Camera(position: SIMD3<Float>(0, 0, 6),
                       quaternion: SIMD4<Float>(0, 0, 0, 1),
                       fov: 55)
    )

    // MARK: - the light, resolved

    /// The chord as RGB, ready for colA/colB/colC. The OKLCH → sRGB map is the
    /// shipped one (Palette.oklchToRGB, the web's gamut-mapped conversion), so
    /// a stage screen and the standalone player speak the same colour. Fewer
    /// than three stops are back-filled from the idle chord.
    var chordRGB: (a: SIMD3<Float>, b: SIMD3<Float>, c: SIMD3<Float>) {
        func rgb(_ i: Int) -> SIMD3<Float> {
            let stop = i < colors.count ? colors[i] : StagePacket.idle.colors[i]
            return Palette.oklchToRGB(l: stop.l, c: stop.c, h: stop.h)
        }
        return (rgb(0), rgb(1), rgb(2))
    }

    // MARK: - decoding, tolerant

    /// JSON → packet, clamped and defaulted. Total garbage (unparseable, or a
    /// top-level that is not an object) is refused with nil so the client can
    /// keep whatever it already had; anything object-shaped yields a packet.
    static func decode(_ data: Data) -> StagePacket? {
        decode(data, over: nil)
    }

    /// The law of arrival: parse, and for every field take the incoming value
    /// if present, else the value the screen already held (`previous`), else
    /// the idle default. A packet that omits half its fields therefore keeps
    /// the last good half instead of dropping the field to silence.
    static func decode(_ data: Data, over previous: StagePacket?) -> StagePacket? {
        guard
            let obj = try? JSONSerialization.jsonObject(with: data),
            let dict = obj as? [String: Any]
        else { return nil }

        let base = previous ?? .idle

        func f(_ key: String, _ fallback: Float, _ lo: Float, _ hi: Float) -> Float {
            guard let d = number(dict[key]) else { return fallback }
            return min(max(Float(d), lo), hi)
        }
        func d(_ key: String, _ fallback: Double) -> Double {
            number(dict[key]) ?? fallback
        }

        // bands: present (even empty) wins; absent holds last good, clamped 0..1
        let bands: [Float]
        if let raw = dict["bands"] as? [Any] {
            bands = raw.map { min(max(Float(number($0) ?? 0), 0), 1) }
        } else {
            bands = base.bands
        }

        // colours: an array of {l,c,h} objects or [l,c,h] triples; absent or
        // empty holds last good so the field never loses its chord mid-drop
        let colors: [OKLCH]
        if let raw = dict["colors"] as? [Any], !raw.isEmpty {
            colors = raw.map { parseStop($0) }
        } else {
            colors = base.colors
        }

        let hand = parseHand(dict["hand"], base: base.hand)
        let camera = parseCamera(dict["camera"], base: base.camera)

        // scene: a non-negative room index; absent holds last good
        let scene: Int
        if let n = number(dict["scene"]) {
            scene = max(0, Int(n.rounded()))
        } else {
            scene = base.scene
        }

        return StagePacket(
            clock: d("clock", base.clock),
            scene: scene,
            bands: bands,
            beat: f("beat", base.beat, 0, 1),
            beatPhase: f("beatPhase", base.beatPhase, 0, 1),
            barPhase: f("barPhase", base.barPhase, 0, 1),
            phrasePhase: f("phrasePhase", base.phrasePhase, 0, 1),
            bpm: f("bpm", base.bpm, 0, 300),
            energy: f("energy", base.energy, 0, 1),
            bass: f("bass", base.bass, 0, 1),
            mid: f("mid", base.mid, 0, 1),
            treble: f("treble", base.treble, 0, 1),
            calm: f("calm", base.calm, 0, 1),
            act: f("act", base.act, 0, 4),
            white: f("white", base.white, 0.05, 0.92),
            pulse: f("pulse", base.pulse, 0, 2),
            brace: f("brace", base.brace, 0, 1),
            colors: colors,
            lens: f("lens", base.lens, -1, 5),
            lensAmt: f("lensAmt", base.lensAmt, 0, 1),
            hand: hand,
            camera: camera
        )
    }

    // MARK: - parse helpers (JSONSerialization is NSNumber-shaped)

    private static func number(_ v: Any?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let dd = v as? Double { return dd }
        if let ii = v as? Int { return Double(ii) }
        if let s = v as? String { return Double(s) }
        return nil
    }

    private static func parseStop(_ v: Any) -> OKLCH {
        if let o = v as? [String: Any] {
            return OKLCH(l: number(o["l"]) ?? 0.7,
                         c: number(o["c"]) ?? 0.1,
                         h: number(o["h"]) ?? 225)
        }
        if let arr = v as? [Any], arr.count >= 3 {
            return OKLCH(l: number(arr[0]) ?? 0.7,
                         c: number(arr[1]) ?? 0.1,
                         h: number(arr[2]) ?? 225)
        }
        return OKLCH(l: 0.72, c: 0.11, h: 225)
    }

    private static func parseHand(_ v: Any?, base: Hand) -> Hand {
        guard let o = v as? [String: Any] else { return base }
        func g(_ k: String, _ fb: Float, _ lo: Float, _ hi: Float) -> Float {
            guard let d = number(o[k]) else { return fb }
            return min(max(Float(d), lo), hi)
        }
        let synth: Bool
        if let b = o["synthetic"] as? Bool { synth = b }
        else if let n = number(o["synthetic"]) { synth = n != 0 }
        else { synth = base.synthetic }
        return Hand(x: g("x", base.x, -1.5, 1.5),
                    y: g("y", base.y, -1.5, 1.5),
                    presence: g("presence", base.presence, 0, 1),
                    mode: g("mode", base.mode, 0, 8),
                    synthetic: synth)
    }

    private static func parseCamera(_ v: Any?, base: Camera) -> Camera {
        guard let o = v as? [String: Any] else { return base }
        func vec3(_ key: String, _ fb: SIMD3<Float>) -> SIMD3<Float> {
            guard let a = o[key] as? [Any], a.count >= 3 else { return fb }
            return SIMD3<Float>(Float(number(a[0]) ?? Double(fb.x)),
                                Float(number(a[1]) ?? Double(fb.y)),
                                Float(number(a[2]) ?? Double(fb.z)))
        }
        func vec4(_ key: String, _ fb: SIMD4<Float>) -> SIMD4<Float> {
            guard let a = o[key] as? [Any], a.count >= 4 else { return fb }
            return SIMD4<Float>(Float(number(a[0]) ?? Double(fb.x)),
                                Float(number(a[1]) ?? Double(fb.y)),
                                Float(number(a[2]) ?? Double(fb.z)),
                                Float(number(a[3]) ?? Double(fb.w)))
        }
        let fov: Float
        if let n = number(o["fov"]) { fov = min(max(Float(n), 10), 170) }
        else { fov = base.fov }
        return Camera(position: vec3("position", base.position),
                      quaternion: vec4("quaternion", base.quaternion),
                      fov: fov)
    }
}
