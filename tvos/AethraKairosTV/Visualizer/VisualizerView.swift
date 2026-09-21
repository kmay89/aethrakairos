import SwiftUI
import MetalKit
import UIKit

/* ================================================================
   THE FIELD — the SwiftUI face of the Metal renderer.
   The pipeline is a tail of composites: the current room renders
   into an offscreen texture every frame; during a handover the
   outgoing room renders into a second texture and one of five XFORM
   composites (luma / scatter / defocus / prism / ember, chosen per
   segue, never the same twice) blends the pair into a third. Wave 3
   splices ONE optional pass here: the artistic LENS. When autoLens()
   picks a lens (act + energy driven) the composite is bent through
   lens_pass into a fourth texture; otherwise the pass is skipped
   entirely. Either way grade_pass — the INK GRADE — writes the result
   to the drawable with the hue-preserving rolloff, a vignette, and the
   starfield floor. At rest the XFORM runs with transition pinned at 1
   (it collapses to the live image), the lens bypasses (lens < 0), and
   the GRADE still runs — one pipeline shape, degrading to the exact
   proven wave-2 picture whenever the lens is off.

   Above the pixels sit clocks the renderer drives each frame: the
   STORY (five acts eased off the playhead → the `act` uniform and the
   `white` INK budget), the DIRECTOR (which room, when), the GHOST (a
   phantom hand after 22 s of stillness), and the LENS auto-picker
   (holds a look ~9 s, none ~3 s). Reduce Motion (or the calm setting)
   collapses the XFORM to luma, tightens the white budget, silences the
   ghost, and returns the lens to clean glass — calm is a feature tier,
   not a punishment.
   ================================================================ */

struct VisualizerView: View {
    @ObservedObject var player: Player
    var roomStep: Int                    // bumped ±1 by remote swipes upstream
    @Binding var roomName: String        // published back for the HUD label

    init(player: Player, roomStep: Int, roomName: Binding<String>) {
        self.player = player
        self.roomStep = roomStep
        self._roomName = roomName
    }

    var body: some View {
        MetalSurface(player: player, roomStep: roomStep, roomName: $roomName)
            .ignoresSafeArea()
    }
}

// MARK: - the MTKView bridge

private struct MetalSurface: UIViewRepresentable {
    let player: Player
    let roomStep: Int
    @Binding var roomName: String

    func makeCoordinator() -> VizRenderer {
        VizRenderer(player: player, roomName: $roomName)
    }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = MTLCreateSystemDefaultDevice()
        view.preferredFramesPerSecond = 60
        view.colorPixelFormat = .bgra8Unorm
        // even a dropped frame shows the void, never a flash of anything else
        view.clearColor = MTLClearColor(red: 5.0 / 255.0, green: 6.0 / 255.0,
                                        blue: 14.0 / 255.0, alpha: 1.0)
        view.framebufferOnly = true
        view.delegate = context.coordinator
        context.coordinator.configure(view: view)
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {
        // SwiftUI may rebuild this struct; keep the renderer's binding fresh
        context.coordinator.roomName = $roomName
        context.coordinator.roomStepChanged(to: roomStep)
    }
}

// MARK: - the uniforms mirror

/// EXACT mirror of the Metal-side VizUniforms. The layout is FIXED at
/// 144 bytes and never moves a byte across waves: 12 packed floats,
/// three SIMD4<Float> at offsets 48/64/80, then twelve floats to a
/// 16-aligned 144-byte stride. Wave 2 named slot 11 `xformMode` (was
/// `_pad0`). Wave 3 gives two trailing pads meaning WITHOUT resizing:
/// offset 128 `lens` (-1 none / 0 mirrors / 1 wave / 2 prism / 3 iris /
/// 4 tile / 5 moire) and offset 132 `lensAmt` (0..1). Offset 140 stays
/// reserved. Field order is contract; a drifted layout is a silently
/// wrong picture.
private struct VizUniforms {
    var time: Float = 0
    var beatPhase: Float = 0
    var barPhase: Float = 0
    var energy: Float = 0
    var bass: Float = 0
    var mid: Float = 0
    var treble: Float = 0
    var calm: Float = 0
    var onsetEnv: Float = 0
    var aspect: Float = 1
    var transition: Float = 1
    var xformMode: Float = 0                  // 0 luma · 1 scatter · 2 defocus · 3 prism · 4 ember
    var colA = SIMD4<Float>(0, 0, 0, 1)
    var colB = SIMD4<Float>(0, 0, 0, 1)
    var colC = SIMD4<Float>(0, 0, 0, 1)
    var act: Float = 0                        // 0..4 eased story arc
    var phrasePhase: Float = 0
    var white: Float = 0.05                   // INK budget 0.05..0.92
    var ghostX: Float = 0
    var ghostY: Float = 0
    var ghostStrength: Float = 0
    var roll0: Float = 0                      // per-room dice, re-dealt on entry
    var roll1: Float = 0
    var roll2: Float = 0
    var lens: Float = -1                      // offset 128 — -1 bypasses the lens pass
    var lensAmt: Float = 0                    // offset 132 — 0..1 lens intensity
    var pad3: Float = 0                       // offset 140 — reserved
}

// MARK: - the renderer

@MainActor
final class VizRenderer: NSObject, MTKViewDelegate {

    private let player: Player
    var roomName: Binding<String>
    private let reduceMotion: Bool

    private var device: MTLDevice?
    private var queue: MTLCommandQueue?
    private var roomPipelines: [MTLRenderPipelineState] = []
    // [luma, scatter, defocus, prism, ember] — indexed by xformMode
    private var xformPipelines: [MTLRenderPipelineState] = []
    private var gradePipeline: MTLRenderPipelineState?

    // offscreen chain: A = the live room, B = the departing room mid-handover,
    // C = the XFORM blend the GRADE reads on its way to the drawable
    private var texA: MTLTexture?
    private var texB: MTLTexture?
    private var texC: MTLTexture?
    // the ears on the GPU: 256x1 r32Float each (first 64 texels = bands)
    private var spectrumTex: MTLTexture?
    private var waveformTex: MTLTexture?
    // the VERSE text mask: a 256x64 r8Unorm strip of white glyphs on black,
    // rasterised from the track's title on every track change. Bound at
    // texture(2) on EVERY room pass; rooms that ignore it are unaffected, and
    // a nil texture (device gone) simply leaves VERSE in its nebula fallback.
    private var wordTex: MTLTexture?
    private var lastWordKey: String?

    private var director = Director()
    private var lastDrawTime: CFTimeInterval = 0
    /// One musical clock for every room: dt scaled by energy (the rubato),
    /// so motion breathes with the track and speed changes never teleport
    /// time-driven geometry.
    private var musicalTime: Double = 0

    // the story arc, eased
    private var actEased: Double = 0
    private var whiteEased: Double = 0.05
    private static let actHeatTable: [Double] = [0.15, 0.45, 1.0, 0.65, 0.25]

    // THE COLOUR ENGINE's live state — the web's COLOR object, retold.
    // The plan is dealt per track; the glide walks the OLD stops to the new
    // ones through OKLCH over eight beats (a lighting cue, not a fade); the
    // arc's warmth rotates the whole chord as ONE angle so the intervals
    // survive; and the flash governor rate-limits each swatch's luminance
    // at the very end (WCAG 2.3.1, enforced not reviewed).
    private var palPlan: Palette.Plan?
    private var palFrom: [Palette.Stop] = []
    private var palTarget: [Palette.Stop] = []
    private var palNow: [Palette.Stop] = []
    private var palGlideT: Double = 1
    private var palGlideDur: Double = 6
    private var lastPalId: String = "\u{0}unset"
    private var palReplanT: Double = 0
    private var palSeedBump: Int = 0
    private var warmEased: Double = 0
    private var safeLuma: [Double?] = [nil, nil, nil]
    private static let safeRate = 0.9, safeRedRate = 0.5           // rel-luma per second
    private static let safeCalmRate = 0.45, safeCalmRedRate = 0.3

    // the handover
    private var transitionProgress: Double = 1.0     // >= 1 means at rest
    private var transitionDuration: Double = 0.9
    private var outgoingIndex: Int = 0
    private var lastRoomStep: Int?
    private var currentXformMode: Int = 0
    private var lastXformMode: Int = -1
    private static let xformMinDur: [Double] = [0.55, 0.9, 0.8, 0.7, 1.4]

    // the per-entry dice — the live room's face and the room it is leaving
    private var currentRolls = SIMD3<Float>(0.5, 0.5, 0.5)
    private var outgoingRolls = SIMD3<Float>(0.5, 0.5, 0.5)

    // the ghost — a phantom hand after 22 s of stillness
    private var idleTime: Double = 0
    private var ghostStrength: Double = 0
    private var ghostTime: Double = 0
    private var ghostCycle: Double = 0
    private var ghostChoreo: Int = 0
    private var ghostEngagedPrev: Bool = false
    private var lastPosition: Double = 0

    // the LENS — the artistic post-lens over the whole scene, picked by
    // autoLens() and held ~9 s (none ~3 s) so it never flickers. `lensChoice`
    // is the current held pick (-1 = clean glass); `lensRenderMode` is the
    // type actually uploaded — it sticks to the last real lens while `lensAmt`
    // fades out, so dropping to none dissolves instead of popping. lensAmt
    // eases the engage. Missing lens_pass ⇒ lensPipeline nil ⇒ never engages.
    private var lensPipeline: MTLRenderPipelineState?
    private var lensTex: MTLTexture?
    private var lensChoice: Int = -1
    private var lensRenderMode: Int = -1
    private var lensHold: Double = 0
    private var lensAmt: Double = 0

    // the FIELD — the ghost's hand on the light itself (field_pass in
    // Field.metal, the web's LENS_FIELD_LEAN for one hand). Runs only
    // while the ghost is present; a missing field_pass just leaves the
    // pipeline nil and the frame flows exactly as before.
    private var fieldPipeline: MTLRenderPipelineState?
    private var fieldPhase: Double = 0

    /// Each room's native answer to a hand — the web's touchAffinity MAP,
    /// keyed (the two stages order their rosters differently): 0 blackhole,
    /// 1 grows, 2 gathers, 3 flows. The ghost drives the field pass with the
    /// room's own personality, so the SET pulls light in on both stages and
    /// the SCOPE's glass ripples on both. An unmapped room falls back to the
    /// accretion well, the web's own default.
    private static let ghostTouchMode: [String: Float] = [
        "spiral": 1, "helix": 1, "band": 2, "starburst": 0, "nebula": 3, "tunnel": 0,
        "ribbons": 3, "fractal": 0, "comets": 2, "fern": 3, "rosette": 1, "slinky": 1,
        "opart": 0, "pulse": 2, "parlor": 3, "aurea": 1, "halo": 1, "lava": 1,
        "flame": 3, "sheets": 3, "mandala": 1, "oilslick": 3, "bubbles": 2, "sky": 1,
        "pyro": 2, "mandel": 0, "drift": 0, "disperse": 2, "filament": 1, "soapfilm": 3,
        "terrain": 1, "eigen": 2, "creature": 3, "barkley": 1, "verse": 2, "arcade": 2,
        "scope": 3, "weave": 1, "ocean": 3, "bolt": 2, "circuit": 0, "bifurc": 1,
        "cymatic": 3, "rule": 2, "hole": 0, "ferro": 2, "plinko": 3, "pendula": 3,
        "lorenz": 2, "sync": 2, "nbody": 0, "dla": 2, "boids": 0, "fourier": 2,
        "fringe": 0, "julia": 0, "escher": 2, "penrose": 3, "sunflower": 1, "sandpile": 1,
        "lsystem": 1, "hilbert": 3, "koch": 2, "dragon": 3, "cantor": 0, "tonnetz": 2,
        "harmonograph": 3, "overtones": 3, "euclid": 1, "phase": 3, "ulam": 2, "cardioid": 1,
        "collatz": 3, "mediant": 2, "zeta": 0, "karman": 3, "caustics": 3, "hopf": 2,
        "knots": 1, "benard": 3, "orrery": 2, "lensing": 0, "pulsar": 1,
        "analemma": 3, "eclipse": 0, "telegraph": 2, "semaphore": 3,
        "scribe": 3, "cipher": 1, "babel": 0,
    ]

    private var specScratch = [Float](repeating: 0, count: 256)
    private var waveScratch = [Float](repeating: 0, count: 256)

    // The 60 fps display ease: the analyzer publishes at the tap's cadence
    // (~10 Hz callbacks carrying ~43 Hz hops); these carry each level between
    // publishes so nothing on screen ever steps. Attack 30 ms — a kick lands
    // the same frame; release 120 ms — the fall is grace, not a cliff.
    private var dispBass: Float = 0
    private var dispMid: Float = 0
    private var dispTreble: Float = 0
    private var dispEnergy: Float = 0

    // CI's synthetic drive: `--drive-demo` replaces the ears with a pumping
    // 126 BPM signal so the simulator can photograph rooms UNDER music
    // without playing any. Never on for a listener.
    private static let driveDemo = ProcessInfo.processInfo.arguments.contains("--drive-demo")

    /// The drive demo's KEYED track: the sim shots should photograph the
    /// colour engine's work (an 8B plan, vivid and keyed), not the boot ice.
    /// Never non-nil for a listener.
    private static let demoTrack: Track? = {
        guard driveDemo else { return nil }
        return Track(
            id: "drive-demo", title: "DRIVE DEMO", albumTag: "demo",
            albumTitle: "demo", url: URL(string: "https://demo.invalid/d.mp3")!,
            duration: 240, sha256: "drive-demo", gainDB: nil,
            features: Features(bpm: 126, energy: 0.72, brightness: 0.55,
                               entropy: 0.48, onsets: 0.6),
            env: nil,
            mix: MixInfo(bpm: 126, grid: 0, key: "8B", keyConf: 1, phrases: 32,
                         inRegion: MixRegion(start: 0, beats: 32),
                         outRegion: MixRegion(start: 200, beats: 32),
                         mixable: 1),
            artURL: nil, year: nil, published: nil)
    }()

    init(player: Player, roomName: Binding<String>) {
        self.player = player
        self.roomName = roomName
        self.reduceMotion = UIAccessibility.isReduceMotionEnabled
        super.init()
        if reduceMotion {
            // Reduce Motion opens in PULSE — the calm meter, found by key
            director = Director(startAt: Rooms.pulseIndex)
        }
        // CI's camera: `--start-room <key>` opens on a named room, so the
        // simulator smoke job can photograph any of the 42 without a remote
        // in hand. It wins over every other opening choice, on purpose —
        // the camera must see the room it asked for.
        let args = ProcessInfo.processInfo.arguments
        if let flag = args.firstIndex(of: "--start-room"), flag + 1 < args.count,
           let idx = Rooms.all.firstIndex(where: { $0.key == args[flag + 1] }) {
            director = Director(startAt: idx)
        }
        outgoingIndex = director.currentIndex
        currentRolls = Self.freshRolls()
        outgoingRolls = currentRolls
        ghostChoreo = Int.random(in: 0...3)
    }

    // MARK: setup

    func configure(view: MTKView) {
        guard let device = view.device,
              let queue = device.makeCommandQueue(),
              let library = device.makeDefaultLibrary(),
              let vertexFn = library.makeFunction(name: "fullscreen_vertex")
        else { return }                              // no Metal: the view rests in the void

        self.device = device
        self.queue = queue

        // one pipeline per room, all rendering into the rgba16Float offscreen
        var pipelines: [MTLRenderPipelineState] = []
        for room in Rooms.all {
            guard let frag = library.makeFunction(name: room.fragmentFunction) else { return }
            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction = vertexFn
            desc.fragmentFunction = frag
            desc.colorAttachments[0].pixelFormat = .rgba16Float
            guard let state = try? device.makeRenderPipelineState(descriptor: desc) else { return }
            pipelines.append(state)
        }
        roomPipelines = pipelines

        // the five XFORM composites, blending the two rgba16Float rooms into
        // texC (also rgba16Float, so the GRADE reads it filterable)
        let xformNames = ["xform_luma", "xform_scatter", "xform_defocus", "xform_prism", "xform_ember"]
        var xf: [MTLRenderPipelineState] = []
        for name in xformNames {
            guard let frag = library.makeFunction(name: name) else { return }
            let desc = MTLRenderPipelineDescriptor()
            desc.vertexFunction = vertexFn
            desc.fragmentFunction = frag
            desc.colorAttachments[0].pixelFormat = .rgba16Float
            guard let state = try? device.makeRenderPipelineState(descriptor: desc) else { return }
            xf.append(state)
        }
        xformPipelines = xf

        // the LENS — one artistic pass between the XFORM composite and the
        // GRADE, into an rgba16Float target (the GRADE reads it filterable).
        // Guarded: a missing lens_pass just leaves lensPipeline nil, so the
        // lens never engages and the pipeline is exactly the proven wave-2 tail.
        if let lensFn = library.makeFunction(name: "lens_pass") {
            let ldesc = MTLRenderPipelineDescriptor()
            ldesc.vertexFunction = vertexFn
            ldesc.fragmentFunction = lensFn
            ldesc.colorAttachments[0].pixelFormat = .rgba16Float
            lensPipeline = try? device.makeRenderPipelineState(descriptor: ldesc)
        }

        // the FIELD — the ghost's light-bending pass, guarded the same way:
        // a missing field_pass leaves fieldPipeline nil and the pass never runs.
        if let fieldFn = library.makeFunction(name: "field_pass") {
            let fdesc = MTLRenderPipelineDescriptor()
            fdesc.vertexFunction = vertexFn
            fdesc.fragmentFunction = fieldFn
            fdesc.colorAttachments[0].pixelFormat = .rgba16Float
            fieldPipeline = try? device.makeRenderPipelineState(descriptor: fdesc)
        }

        // the GRADE — the final composite, into the drawable's own format
        let gdesc = MTLRenderPipelineDescriptor()
        gdesc.vertexFunction = vertexFn
        gdesc.fragmentFunction = library.makeFunction(name: "grade_pass")
        gdesc.colorAttachments[0].pixelFormat = view.colorPixelFormat
        gradePipeline = try? device.makeRenderPipelineState(descriptor: gdesc)

        spectrumTex = makeDataTexture(device: device)
        waveformTex = makeDataTexture(device: device)
        wordTex = makeWordTexture(device: device)

        rebuildTargets(size: view.drawableSize)
        publishRoomName()
    }

    private static func freshRolls() -> SIMD3<Float> {
        SIMD3<Float>(Float.random(in: 0..<1), Float.random(in: 0..<1), Float.random(in: 0..<1))
    }

    /// Punch up (30 ms), grace down (120 ms).
    private static func ease(_ level: inout Float, toward target: Float, dt: Double) {
        let tau = target > level ? 0.03 : 0.12
        level += (target - level) * Float(1 - exp(-dt / tau))
    }

    /// The synthetic drive behind `--drive-demo`: a four-on-the-floor pump at
    /// 126 BPM with breathing mids, glittering highs, a decaying spectrum and
    /// a living waveform — enough music-shaped signal for a photograph.
    private static func synthesizeDrive(_ f: inout Analyzer.Frame, t: Double) {
        let beat = t * (126.0 / 60.0)
        let ph = Float(beat - floor(beat))
        let onset = exp(-ph * 3.2)
        f.onsetEnv = onset
        f.beatPhase = ph
        f.barPhase = Float((beat / 4).truncatingRemainder(dividingBy: 1))
        f.phrasePhase = Float((beat / 32).truncatingRemainder(dividingBy: 1))
        f.bpm = 126
        f.bass = min(1, 0.35 + 0.55 * onset)
        f.mid = 0.38 + 0.20 * Float(0.5 + 0.5 * sin(t * 2.1))
        f.treble = 0.30 + 0.22 * Float(0.5 + 0.5 * sin(t * 3.7 + 1.3))
        f.energy = min(1, f.bass * 0.625 + f.mid * 0.5 + f.treble * 0.4)
        f.eShort = f.energy
        f.eLong = 0.55
        f.calm = 1 - f.energy
        for b in 0..<f.spectrum.count {
            let fall = exp(-Float(b) * 0.045)
            let shimmer = Float(0.5 + 0.5 * sin(t * 3.0 + Double(b) * 0.37))
            f.spectrum[b] = min(1, fall * (0.30 + 0.55 * onset) + 0.10 * shimmer * (1 - fall))
        }
        for i in 0..<f.waveform.count {
            let x = Double(i) / Double(f.waveform.count)
            let w = sin(x * 6.28318 * 3 + t * 4.0) * (0.30 + 0.35 * Double(onset))
                  + sin(x * 6.28318 * 11 + t * 9.0) * 0.10
            f.waveform[i] = Float(max(-1.0, min(1.0, w)))
        }
    }

    private func makeDataTexture(device: MTLDevice) -> MTLTexture? {
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r32Float,
                                                            width: 256, height: 1,
                                                            mipmapped: false)
        desc.usage = .shaderRead
        desc.storageMode = .shared
        return device.makeTexture(descriptor: desc)
    }

    /// The VERSE mask: 256x64 single-channel, born black so an empty mask (no
    /// track yet) reads as zero coverage in room_verse and the room keeps its
    /// drifting nebula. Filled by rasterizeWord() on track change.
    private func makeWordTexture(device: MTLDevice) -> MTLTexture? {
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r8Unorm,
                                                            width: 256, height: 64,
                                                            mipmapped: false)
        desc.usage = .shaderRead
        desc.storageMode = .shared
        guard let tex = device.makeTexture(descriptor: desc) else { return nil }
        let zeros = [UInt8](repeating: 0, count: 256 * 64)
        zeros.withUnsafeBytes { buffer in
            if let base = buffer.baseAddress {
                tex.replace(region: MTLRegionMake2D(0, 0, 256, 64), mipmapLevel: 0,
                            withBytes: base, bytesPerRow: 256)
            }
        }
        return tex
    }

    /// The ART resolution. Native 4K is 8.3M fragments per pass and the
    /// heavy raymarchers (ocean, ferrofluid, the black hole) cannot hold
    /// 60 fps there on the TV's chip — late frames read as tearing. The
    /// rooms are procedural fields watched from a couch: rendered at 1440p
    /// (1080p while a heavy room is on stage) and upscaled by the GRADE's
    /// linear sampler under bloom and grain, the difference is invisible
    /// and the frame time drops 2-4x. A 1080p TV renders native.
    private func internalSize(for drawable: CGSize) -> CGSize {
        let cap: CGFloat = heavyOnStage ? 1080 : 1440
        guard drawable.height > cap, drawable.height > 0 else { return drawable }
        let sc = cap / drawable.height
        return CGSize(width: (drawable.width * sc).rounded(), height: cap)
    }

    private var heavyOnStage = false

    private func rebuildTargets(size drawable: CGSize) {
        let size = internalSize(for: drawable)
        guard let device, size.width >= 1, size.height >= 1 else { return }
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float,
                                                            width: Int(size.width),
                                                            height: Int(size.height),
                                                            mipmapped: false)
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .private
        texA = device.makeTexture(descriptor: desc)
        texB = device.makeTexture(descriptor: desc)
        texC = device.makeTexture(descriptor: desc)
        lensTex = device.makeTexture(descriptor: desc)   // the LENS output, same size
    }

    // MARK: remote steps

    /// `roomStep` is a counter, not an index: the first sighting is the
    /// baseline, every later change applies its delta as a manual step —
    /// and counts as remote activity, which reclaims the field from the ghost.
    func roomStepChanged(to value: Int) {
        guard let last = lastRoomStep else {
            lastRoomStep = value
            return
        }
        lastRoomStep = value
        let delta = value - last
        guard delta != 0 else { return }
        // a hand is on the remote — the ghost yields at once
        idleTime = 0
        let before = director.currentIndex
        director.step(delta)
        if director.currentIndex != before {
            beginTransition(from: before)
            publishRoomName()
        }
    }

    /// Open a handover: freeze the room being left, pick the composite form
    /// (never the same twice; always luma under the calm tier), set its min
    /// duration, and re-deal the arriving room's face plus a fresh ghost
    /// choreography — a room never wears the same face on re-entry.
    private func beginTransition(from oldIndex: Int) {
        outgoingIndex = oldIndex
        transitionProgress = 0

        let calmNow = reduceMotion || VizSettings.shared.calm
        if calmNow {
            currentXformMode = 0
        } else {
            var m = Int.random(in: 0...4)
            if m == lastXformMode { m = (m + 1) % 5 }
            currentXformMode = m
        }
        lastXformMode = currentXformMode
        let mode = min(max(currentXformMode, 0), Self.xformMinDur.count - 1)
        transitionDuration = calmNow ? 0.9 : Self.xformMinDur[mode]

        outgoingRolls = currentRolls
        currentRolls = Self.freshRolls()
        ghostChoreo = Int.random(in: 0...3)
    }

    private func publishRoomName() {
        let index = director.currentIndex
        guard Rooms.all.indices.contains(index) else { return }
        let name = Rooms.all[index].name
        let binding = roomName
        // deferred past the current view update — SwiftUI's law, not ours
        DispatchQueue.main.async {
            if binding.wrappedValue != name { binding.wrappedValue = name }
        }
    }

    // MARK: the story arc

    /// The act at this playhead: centred on the song's REAL apex when the
    /// catalog shipped its script (mix.structure), the web's progress template
    /// otherwise. OVERTURE / RISING / APEX / TURN / RESOLVE.
    private func actIndex(prog: Double, structure: Structure?) -> Int {
        Story.act(prog: prog, structure: structure)
    }

    /// The act-heat curve sampled at the eased (fractional) act.
    private func actHeat(_ a: Double) -> Double {
        let t = Self.actHeatTable
        let x = min(max(a, 0), Double(t.count - 1))
        let i0 = Int(floor(x))
        let i1 = min(i0 + 1, t.count - 1)
        let f = x - Double(i0)
        return t[i0] + (t[i1] - t[i0]) * f
    }

    // MARK: the colour engine's moving parts

    /// Deal the plan for a track and aim the glide at it: eight beats on the
    /// measured grid reads as a lighting cue, not a fade. The first plan of a
    /// session snaps — there is nothing on stage yet to glide from.
    private func retargetPalette(_ track: Track?) {
        let plan = Palette.plan(for: track, seedBump: palSeedBump)
        palPlan = plan
        palTarget = plan.stops
        if palNow.count == plan.stops.count {
            palFrom = palNow
            palGlideT = 0
            let bpm = track?.mix?.bpm ?? 0
            palGlideDur = bpm > 0 ? (60 / bpm) * 8 : 6
        } else {
            palFrom = plan.stops
            palNow = plan.stops
            palGlideT = 1
        }
    }

    /// The flash governor's last hand: each swatch's LUMINANCE may move no
    /// faster than the rate (saturated red at nearly half speed — the worst
    /// hazard); the hue always arrives instantly. WCAG 2.3.1 enforced at the
    /// one choke point every room's colour passes through.
    private func safeColorStep(_ rgbs: [SIMD3<Float>], dt: Double, calm: Bool) -> [SIMD3<Float>] {
        let rate = calm ? Self.safeCalmRate : Self.safeRate
        let redRate = calm ? Self.safeCalmRedRate : Self.safeRedRate
        return rgbs.enumerated().map { (i, rgb) in
            let target = Double(0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * rgb.z)
            let prev = (i < safeLuma.count ? safeLuma[i] : nil) ?? target
            let gb = Double(max(rgb.y, rgb.z))
            let redFrac = min(max((Double(rgb.x) - gb) / max(Double(rgb.x), 1e-4), 0), 1)
            let r = rate + (redRate - rate) * redFrac
            let d = target - prev
            let allowed = abs(d) <= r * dt ? target : prev + (d < 0 ? -r * dt : r * dt)
            if i < safeLuma.count { safeLuma[i] = allowed }
            if target < 1e-5 { return SIMD3<Float>(0, 0, 0) }
            return rgb * Float(allowed / target)
        }
    }

    // MARK: the ghost

    /// One of four choreographies, dealt per room entry, in the same centered
    /// aspect-space the rooms shape in (roughly -1…1). The clock advances
    /// every frame so the walk is continuous whether or not it is showing.
    private func ghostPoint(choreo: Int, t: Double) -> (Float, Float) {
        func tri(_ x: Double) -> Double { let f = x - floor(x); return 2 * abs(2 * f - 1) - 1 }
        var x = 0.0
        var y = 0.0
        switch choreo {
        case 1:  // bounce — box billiards
            x = tri(t * 0.09)
            y = tri(t * 0.07 + 0.3)
        case 2:  // lissa — a slow lissajous figure
            x = 0.72 * sin(t * 0.31)
            y = 0.72 * sin(t * 0.19 + .pi / 2)
        case 3:  // snake — a horizontal sweep stepping in height
            x = tri(t * 0.11)
            y = 0.6 * sin(floor(t * 0.11) * 1.7)
        default: // drift — a wandering ramble
            x = 0.55 * sin(t * 0.13) + 0.20 * sin(t * 0.07 + 1.0)
            y = 0.50 * sin(t * 0.11 + 2.0) + 0.20 * cos(t * 0.05)
        }
        x = min(max(x, -0.92), 0.92)
        y = min(max(y, -0.92), 0.92)
        return (Float(x), Float(y))
    }

    // MARK: the lens

    /// The pure lens rule — the web's pickLens, verbatim. The structure CEILING
    /// is the hard gate: below 0.55 (a quiet intro, a breakdown) and at the
    /// arc's edges (OVERTURE / RESOLVE) the glass stays clean, so a lens can
    /// never punch in where the music has not earned the intensity. At an APEX
    /// with real headroom (ceil > 0.72): moire on a tense minor peak at real
    /// energy, prism when the energy is at its loudest, mirrors otherwise; an
    /// apex the section holds back gets tile (order without full blast). A
    /// RISING or TURN with ceil > 0.60: wave for a driving build, iris for the
    /// gentler build or the comedown. Returns -1 (none), 0 mirrors, 1 wave,
    /// 2 prism, 3 iris, 4 tile, 5 moire.
    private func pickLens(act: Int, energy: Double, minor: Bool, ceil: Double) -> Int {
        if ceil < 0.55 || act == 0 || act == 4 { return -1 }   // the hard gate + the arc's edges
        if act == 2 {                                          // APEX
            // THE SUMMIT: near-no ceiling at real heat deals a STACK — two
            // lenses run in sequence (6 = wave then mirrors, 7 = mirrors
            // then moire), the web's taste verbatim
            if ceil > 0.92 && energy > 0.85 { return minor ? 7 : 6 }
            if ceil > 0.72 {                                   // …with real headroom
                if minor && energy > 0.66 { return 5 }         // moire — tense + truly intense
                if energy > 0.93 { return 2 }                  // prism — the hottest bright peak
                return 0                                        // mirrors — hypnotic symmetry
            }
            return 4                                            // tile — an apex the section holds back
        }
        if (act == 1 || act == 3) && ceil > 0.60 {
            if act == 1 && energy > 0.72 { return 1 }          // wave — a driving build
            return 3                                            // iris — a focusing aperture
        }
        return -1
    }

    /// The auto-picker over the pure rule: it holds a chosen lens ~9 s and
    /// `none` ~3 s so the look never flickers, and returns -1 ALWAYS under
    /// Reduce Motion (calm is clean glass). The engage ramp lives in draw().
    /// A stack code names its members in playing order; a single names itself.
    private func lensStackKinds(_ code: Int) -> [Int] {
        switch code {
        case 6: return [1, 0]          // wave, folded into mirrors
        case 7: return [0, 5]          // mirrors, strained by moire
        default: return [code]
        }
    }

    private func autoLens(dt: Double, act: Int, energy: Double, minor: Bool, ceil: Double, enabled: Bool) -> Int {
        if reduceMotion || !enabled {
            lensChoice = -1
            lensHold = 0
            return -1
        }
        lensHold -= max(dt, 0)
        if lensHold <= 0 {
            lensChoice = pickLens(act: act, energy: energy, minor: minor, ceil: ceil)
            lensHold = lensChoice >= 0 ? 9.0 : 3.0
        }
        return lensChoice
    }

    // MARK: MTKViewDelegate

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        rebuildTargets(size: size)
    }

    func draw(in view: MTKView) {
        guard let queue,
              let gradePipeline,
              xformPipelines.count == 5,
              roomPipelines.count == Rooms.all.count,
              !roomPipelines.isEmpty
        else { return }

        let size = view.drawableSize
        guard size.width >= 1, size.height >= 1 else { return }
        // Heavy rooms drop the art resolution a step; the switch happens on
        // room entry (rare), so the reallocation never runs per-frame.
        let liveHeavy = Rooms.all.indices.contains(director.currentIndex)
            && Rooms.all[director.currentIndex].heavy
        let ghostHeavy = transitionProgress < 1
            && Rooms.all.indices.contains(outgoingIndex)
            && Rooms.all[outgoingIndex].heavy
        heavyOnStage = liveHeavy || ghostHeavy
        let want = internalSize(for: size)
        if texA == nil || texA?.width != Int(want.width) || texA?.height != Int(want.height) {
            rebuildTargets(size: size)
        }
        guard let liveTex = texA, let compTex = texC else { return }

        // -- the clock --
        let now = CACurrentMediaTime()
        var dt = lastDrawTime == 0 ? 1.0 / 60.0 : now - lastDrawTime
        lastDrawTime = now
        dt = min(max(dt, 0), 0.25)                     // a resumed app is not a time machine

        // -- settings, read live on the main actor --
        director.autoOn = VizSettings.shared.autoRooms
        let calmNow = reduceMotion || VizSettings.shared.calm

        // -- the ears --
        var frame = player.analyzer.currentFrame()
        if Self.driveDemo { Self.synthesizeDrive(&frame, t: now) }

        // -- the 60 fps ease (see the disp* fields): punch up, grace down --
        Self.ease(&dispBass, toward: frame.bass, dt: dt)
        Self.ease(&dispMid, toward: frame.mid, dt: dt)
        Self.ease(&dispTreble, toward: frame.treble, dt: dt)
        Self.ease(&dispEnergy, toward: frame.energy, dt: dt)

        // the rubato: rooms run in musical time, clamped to the dance floor
        let rate = min(max(0.45 + 1.05 * Double(dispEnergy), 0.4), 1.9)
        musicalTime += dt * rate

        // -- the story: acts centred on the script's real apex, eased (tau 3 s);
        //    the white budget eased (tau 2.5 s) and never taller than the
        //    section's CEILING — the anti-mistimed-drop rule: a quiet intro or
        //    a breakdown cannot reach full bloom because the clock says so --
        let dur = player.current?.duration ?? 0
        let prog = dur > 1 ? min(max(player.position / dur, 0), 1) : 0
        let structure = player.current?.mix?.structure
        let actTarget = actIndex(prog: prog, structure: structure)
        let ceil = structure?.ceiling(at: prog) ?? 1.0
        actEased += (Double(actTarget) - actEased) * (1 - exp(-dt / 3.0))
        let heatGoal = min(actHeat(actEased), ceil + 0.05)

        /* THE WHITE BUDGET, the web's law verbatim: it takes BOTH a hot
           section and a hot moment (heat times energy, then squared, so the
           top of the range stays narrow — full white stays rare enough that
           it still means something), CALM never bleaches the field, it opens
           slowly and closes slower, and the beat channel rides the result. */
        let wHeat = min(max(heatGoal, 0), 1) * min(max(ceil, 0), 1)
        var wWant = min(max(wHeat * (0.30 + 0.70 * Double(frame.energy)), 0), 1)
        wWant *= wWant
        if calmNow { wWant *= 0.45 }
        let whiteTarget = 0.05 + (0.92 - 0.05) * wWant
        let wTau = whiteTarget > whiteEased ? 0.9 : 1.8
        whiteEased += (whiteTarget - whiteEased) * (1 - exp(-dt / wTau))
        whiteEased = min(max(whiteEased, 0.05), 0.92)
        let whiteLive = min(max(whiteEased * (0.8 + 0.35 * Double(frame.onsetEnv)), 0.05), 0.92)

        /* THE COLOUR ENGINE, live. Deal a plan per track and GLIDE to it
           through OKLCH over eight beats on the measured grid; unkeyed
           material drifts to a fresh plan every 24 s. Then the breath: the
           act's heat buys chroma, the golden gate swells it at φ of every
           phrase, the arc's temperature turns the WHOLE chord by one angle
           (so the intervals — the entire design — survive), and the flash
           governor is the last hand on the light. */
        let palTrack = Self.demoTrack ?? player.current
        let palId = palTrack?.id ?? "none"
        if palId != lastPalId {
            lastPalId = palId
            palSeedBump = 0
            palReplanT = 0
            retargetPalette(palTrack)
        }
        palReplanT += dt
        if let p = palPlan, !p.keyed, palReplanT > 24 {
            palReplanT = 0
            palSeedBump += 1
            retargetPalette(palTrack)
        }
        if palGlideT < 1 {
            palGlideT = min(1, palGlideT + dt / max(0.5, palGlideDur))
            let k = palGlideT * palGlideT * (3 - 2 * palGlideT)
            palNow = zip(palFrom, palTarget).map { Palette.lerp($0, $1, k) }
        }
        let golden = player.isPlaying ? Palette.goldenGate(Double(frame.phrasePhase)) : 0
        let mulC = 0.88 + heatGoal * 0.45 + golden * 0.22
        let mulL = 0.97 + heatGoal * 0.05
        let goalWarm = Palette.actWarmth(act: actEased, heat: ceil)
        warmEased += (goalWarm - warmEased) * (1 - exp(-dt / 3.0))
        var lit = palNow
        if abs(warmEased) > 0.005, let root = lit.first {
            let d = Palette.shortestArc(from: root.h, to: Palette.warmTilt(h: root.h, pull: warmEased))
            if abs(d) > 0.05 {
                lit = lit.map { Palette.Stop(l: $0.l, c: $0.c, h: ($0.h + d + 360).truncatingRemainder(dividingBy: 360)) }
            }
        }
        var chordRGB = lit.map {
            Palette.oklchToRGB(l: Palette.lClamp($0.l * mulL), c: max(0, $0.c * mulC), h: $0.h)
        }
        while chordRGB.count < 3 { chordRGB.append(Palette.ice) }
        chordRGB = safeColorStep(chordRGB, dt: dt, calm: calmNow)

        // -- the director --
        let before = director.currentIndex
        if director.tick(dt: dt, frame: frame, act: actTarget, ceil: ceil) != nil {
            beginTransition(from: before)
            publishRoomName()
        }
        if transitionProgress < 1 {
            transitionProgress = min(1, transitionProgress + dt / max(transitionDuration, 0.05))
        }

        // -- the ghost state machine --
        // Remote activity also arrives as a playback jump (a seek or a ±10 s
        // nudge): a hop larger than a frame's worth of playback reclaims the
        // field. The ~4 Hz position stepping (~0.25 s hops) stays well under
        // the gate, so ordinary playback never false-triggers.
        let posNow = player.position
        if player.isPlaying, abs(posNow - lastPosition - dt) > 1.5 { idleTime = 0 }
        lastPosition = posNow

        idleTime += dt
        let ghostAllowed = !calmNow && player.isPlaying && idleTime >= 22.0
        if ghostAllowed && !ghostEngagedPrev { ghostCycle = 0 }   // engage on a fresh on-window
        ghostEngagedPrev = ghostAllowed
        if ghostAllowed { ghostCycle += dt }
        ghostTime += dt
        // duty ~30%: 8 s on, 18 s off within a 26 s period (phrases on, longer off)
        let onWindow = ghostAllowed && (ghostCycle.truncatingRemainder(dividingBy: 26.0) < 8.0)
        let ghostTarget: Double = onWindow ? 0.5 : 0.0
        if ghostTarget > ghostStrength {
            ghostStrength = min(ghostTarget, ghostStrength + 0.25 * dt)   // 0 -> 0.5 over 2 s
        } else {
            let down = idleTime < 0.6 ? 1.0 : 0.25                        // reclaim: 0.5 -> 0 over 0.5 s
            ghostStrength = max(ghostTarget, ghostStrength - down * dt)
        }
        let ghost = ghostPoint(choreo: ghostChoreo, t: ghostTime)
        // the FIELD's ripple clock (the flows personality travels on it) —
        // wrapped by whole turns so a long night never loses sin() precision
        fieldPhase += dt * (2.2 + 1.4 * Double(dispEnergy))
        if fieldPhase > 512.0 * .pi { fieldPhase -= 512.0 * .pi }

        // -- the lens: auto-picked by act + energy, held so it never flickers.
        // The chosen TYPE snaps at hold boundaries; the AMOUNT eases (tau 0.6 s)
        // so engaging and disengaging dissolve. When the pick drops to none the
        // last real type sticks (lensRenderMode) while the amount fades, so the
        // pass runs until it truly reaches clean glass — no pop. Under Reduce
        // Motion autoLens() returns -1, the amount decays to 0, and the lens is
        // bypassed to the exact wave-2 tail. --
        let minorNow = (player.current?.mix?.key?.uppercased().hasSuffix("A")) ?? false
        let pickedLens = autoLens(dt: dt, act: actTarget, energy: Double(dispEnergy),
                                  minor: minorNow, ceil: ceil,
                                  enabled: VizSettings.shared.lensAuto)
        let lensAmtTarget: Double = pickedLens >= 0 ? (0.45 + 0.50 * Double(dispEnergy)) : 0.0
        lensAmt += (lensAmtTarget - lensAmt) * (1 - exp(-dt / 0.6))
        lensAmt = min(max(lensAmt, 0), 1)
        if pickedLens >= 0 { lensRenderMode = pickedLens }
        let lensEngage = lensPipeline != nil && lensTex != nil
                       && lensRenderMode >= 0 && lensAmt > 0.01

        // -- the VERSE mask follows the track. Rasterise the title once when
        //    the current track changes; VERSE reads it, every other room lets
        //    it pass by. --
        let wordKey = player.current?.id
        if wordKey != lastWordKey {
            lastWordKey = wordKey
            rasterizeWord(for: player.current)
        }

        uploadAudioTextures(frame: frame, dt: dt)

        // -- uniforms (the live room's block) --
        var u = VizUniforms()
        u.time = Float(musicalTime)
        u.beatPhase = frame.beatPhase
        u.barPhase = frame.barPhase
        u.energy = dispEnergy
        u.bass = dispBass
        u.mid = dispMid
        u.treble = dispTreble
        u.calm = frame.calm
        u.onsetEnv = frame.onsetEnv
        // height is guarded above — the aspect never divides by zero
        u.aspect = Float(size.width / size.height)
        u.transition = transitionProgress >= 1 ? 1 : Float(transitionProgress)
        u.xformMode = Float(currentXformMode)
        u.colA = SIMD4<Float>(chordRGB[0].x, chordRGB[0].y, chordRGB[0].z, 1)
        u.colB = SIMD4<Float>(chordRGB[1].x, chordRGB[1].y, chordRGB[1].z, 1)
        u.colC = SIMD4<Float>(chordRGB[2].x, chordRGB[2].y, chordRGB[2].z, 1)
        u.act = Float(actEased)
        u.phrasePhase = frame.phrasePhase
        u.white = Float(whiteLive)
        u.ghostX = ghost.0
        u.ghostY = ghost.1
        u.ghostStrength = Float(ghostStrength)
        u.roll0 = currentRolls.x
        u.roll1 = currentRolls.y
        u.roll2 = currentRolls.z
        u.lens = lensEngage ? Float(lensRenderMode) : -1     // < 0 bypasses the lens pass
        u.lensAmt = Float(lensAmt)

        guard let commandBuffer = queue.makeCommandBuffer() else { return }

        // -- pass 1: the live room into texA --
        let current = director.currentIndex
        guard roomPipelines.indices.contains(current) else { return }
        encodeRoom(index: current, into: liveTex, commandBuffer: commandBuffer, uniforms: &u)

        // -- pass 2 + 3 (handover only): the departing room into texB, then
        //    the XFORM composite (live + ghost) into texC. At rest both are
        //    SKIPPED — every composite form is the live frame at t = 1, so
        //    the GRADE reads the room directly and a full-screen pass per
        //    frame is simply not spent. --
        var sceneForGrade: MTLTexture = liveTex
        if transitionProgress < 1,
           let tb = texB,
           outgoingIndex != current,
           roomPipelines.indices.contains(outgoingIndex) {
            var ug = u
            ug.roll0 = outgoingRolls.x
            ug.roll1 = outgoingRolls.y
            ug.roll2 = outgoingRolls.z
            encodeRoom(index: outgoingIndex, into: tb, commandBuffer: commandBuffer, uniforms: &ug)
            let mode = min(max(currentXformMode, 0), xformPipelines.count - 1)
            encodeComposite(pipeline: xformPipelines[mode], into: compTex,
                            commandBuffer: commandBuffer, uniforms: &u,
                            tex0: liveTex, tex1: tb)
            sceneForGrade = compTex
        }

        // -- pass 3.25 (ghost only): the phantom hand bends the LIGHT — the
        //    web's field pass for one hand. The whole frame curves around the
        //    ghost with the room's own touch personality, not only the rooms
        //    that individually lean toward it. texB is free here in both
        //    flows (at rest it is untouched; in a handover the composite has
        //    already been cut from it), and a still room skips the pass. --
        if ghostStrength > 0.05, let fieldPipeline, let fb = texB {
            let key = Rooms.all.indices.contains(current) ? Rooms.all[current].key : ""
            var fp = SIMD4<Float>(Self.ghostTouchMode[key] ?? 2,
                                  min(max(frame.onsetEnv, 0), 1),
                                  0.35 + 0.55 * dispEnergy,
                                  Float(fieldPhase))
            encodeField(pipeline: fieldPipeline, into: fb,
                        commandBuffer: commandBuffer, uniforms: &u,
                        params: &fp, scene: sceneForGrade)
            sceneForGrade = fb
        }

        // -- pass 3.5 (lens only): bend the scene through lens_pass into
        //    lensTex. Skipped entirely when the lens is off, so the GRADE reads
        //    the scene directly — the exact proven wave-2 flow. lens_pass
        //    reads only texture(0); tex1 is bound to the same source, ignored. --
        if lensEngage, let lensPipeline, let lt = lensTex {
            // a stack runs the same pass twice, each leg with its own kind;
            // texB is free here (the composite has already been cut from it)
            let kinds = lensStackKinds(lensRenderMode)
            var src = sceneForGrade
            for (leg, kind) in kinds.enumerated() {
                // never alias src and dst — if texB is somehow gone, the
                // first leg alone is the whole look
                guard let dst: MTLTexture = (leg % 2 == 0) ? lt : texB else { break }
                u.lens = Float(kind)
                encodeComposite(pipeline: lensPipeline, into: dst,
                                commandBuffer: commandBuffer, uniforms: &u,
                                tex0: src, tex1: src)
                src = dst
                sceneForGrade = dst
            }
        }

        // -- pass 4: the GRADE — the (optionally lensed) scene to the drawable --
        guard let passDesc = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: passDesc)
        else {
            commandBuffer.commit()
            return
        }
        encoder.setRenderPipelineState(gradePipeline)
        encoder.setFragmentBytes(&u, length: MemoryLayout<VizUniforms>.stride, index: 0)
        var res = SIMD2<Float>(Float(size.width), Float(size.height))
        encoder.setFragmentBytes(&res, length: MemoryLayout<SIMD2<Float>>.stride, index: 1)
        encoder.setFragmentTexture(sceneForGrade, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()

        commandBuffer.present(drawable)
        commandBuffer.commit()
    }

    // MARK: encoding

    private func encodeRoom(index: Int, into target: MTLTexture,
                            commandBuffer: MTLCommandBuffer,
                            uniforms: inout VizUniforms) {
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 5.0 / 255.0,
                                                            green: 6.0 / 255.0,
                                                            blue: 14.0 / 255.0,
                                                            alpha: 1.0)
        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        encoder.setRenderPipelineState(roomPipelines[index])
        encoder.setFragmentBytes(&uniforms, length: MemoryLayout<VizUniforms>.stride, index: 0)
        var res = SIMD2<Float>(Float(target.width), Float(target.height))
        encoder.setFragmentBytes(&res, length: MemoryLayout<SIMD2<Float>>.stride, index: 1)
        encoder.setFragmentTexture(spectrumTex, index: 0)
        encoder.setFragmentTexture(waveformTex, index: 1)
        // the VERSE text mask rides along on every room pass; only room_verse
        // declares texture(2) and reads it, the rest ignore the extra binding.
        encoder.setFragmentTexture(wordTex, index: 2)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
    }

    /// A two-texture composite (an XFORM form) into an offscreen target.
    private func encodeComposite(pipeline: MTLRenderPipelineState, into target: MTLTexture,
                                 commandBuffer: MTLCommandBuffer,
                                 uniforms: inout VizUniforms,
                                 tex0: MTLTexture, tex1: MTLTexture) {
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 5.0 / 255.0,
                                                            green: 6.0 / 255.0,
                                                            blue: 14.0 / 255.0,
                                                            alpha: 1.0)
        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        encoder.setRenderPipelineState(pipeline)
        encoder.setFragmentBytes(&uniforms, length: MemoryLayout<VizUniforms>.stride, index: 0)
        var res = SIMD2<Float>(Float(target.width), Float(target.height))
        encoder.setFragmentBytes(&res, length: MemoryLayout<SIMD2<Float>>.stride, index: 1)
        encoder.setFragmentTexture(tex0, index: 0)
        encoder.setFragmentTexture(tex1, index: 1)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
    }

    /// The ghost's light-bending pass (field_pass): one texture in, the
    /// deflected frame out, the hand's parameters riding buffer(2) —
    /// float4(mode, charge, spin, phase).
    private func encodeField(pipeline: MTLRenderPipelineState, into target: MTLTexture,
                             commandBuffer: MTLCommandBuffer,
                             uniforms: inout VizUniforms,
                             params: inout SIMD4<Float>, scene: MTLTexture) {
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = target
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 5.0 / 255.0,
                                                            green: 6.0 / 255.0,
                                                            blue: 14.0 / 255.0,
                                                            alpha: 1.0)
        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        encoder.setRenderPipelineState(pipeline)
        encoder.setFragmentBytes(&uniforms, length: MemoryLayout<VizUniforms>.stride, index: 0)
        var res = SIMD2<Float>(Float(target.width), Float(target.height))
        encoder.setFragmentBytes(&res, length: MemoryLayout<SIMD2<Float>>.stride, index: 1)
        encoder.setFragmentBytes(&params, length: MemoryLayout<SIMD4<Float>>.stride, index: 2)
        encoder.setFragmentTexture(scene, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
    }

    /// The bands ride in the first 64 texels of a 256-wide r32Float strip;
    /// the waveform fills its own strip end to end. Counts are guarded —
    /// a short frame uploads zeros, never stale garbage or a crash.
    private func uploadAudioTextures(frame: Analyzer.Frame, dt: Double) {
        // The bands ride the same punch-up / grace-down ease as the levels,
        // so bars and buses move continuously between analyzer publishes.
        let bandCount = min(64, frame.spectrum.count)
        let kUp = Float(1 - exp(-dt / 0.03))
        let kDn = Float(1 - exp(-dt / 0.15))
        for i in 0..<bandCount {
            let target = frame.spectrum[i]
            specScratch[i] += (target - specScratch[i]) * (target > specScratch[i] ? kUp : kDn)
        }

        for i in 0..<256 { waveScratch[i] = 0 }
        let waveCount = min(256, frame.waveform.count)
        if waveCount > 4 {
            // A real scope smooths for DISPLAY: 6 ms of raw samples is full of
            // audio-rate staircase no phosphor would ever show. A 5-tap Hann
            // window takes the jaggies out of every room's trace at zero GPU
            // cost while a true transient still lands as a spike.
            for i in 0..<waveCount {
                let a = frame.waveform[max(i - 2, 0)]
                let b = frame.waveform[max(i - 1, 0)]
                let c = frame.waveform[i]
                let d = frame.waveform[min(i + 1, waveCount - 1)]
                let e = frame.waveform[min(i + 2, waveCount - 1)]
                waveScratch[i] = a * 0.10 + b * 0.24 + c * 0.32 + d * 0.24 + e * 0.10
            }
        } else {
            for i in 0..<waveCount { waveScratch[i] = frame.waveform[i] }
        }

        let region = MTLRegionMake2D(0, 0, 256, 1)
        let rowBytes = 256 * MemoryLayout<Float>.stride
        specScratch.withUnsafeBytes { buffer in
            if let base = buffer.baseAddress {
                spectrumTex?.replace(region: region, mipmapLevel: 0,
                                     withBytes: base, bytesPerRow: rowBytes)
            }
        }
        waveScratch.withUnsafeBytes { buffer in
            if let base = buffer.baseAddress {
                waveformTex?.replace(region: region, mipmapLevel: 0,
                                     withBytes: base, bytesPerRow: rowBytes)
            }
        }
    }

    // MARK: the VERSE text mask

    /// Rasterise the track's title (the album line as fallback — the Track
    /// model carries no artist string) into the 256x64 mask: white glyphs,
    /// centred, on black, clipped to fit. An empty or absent title leaves the
    /// mask black, which room_verse reads as "no word" and answers with its
    /// drifting nebula. All guards are soft — a failure just skips the upload
    /// and the last mask (or black) stays, so the room always draws.
    private func rasterizeWord(for track: Track?) {
        guard let tex = wordTex else { return }
        let W = 256, H = 64

        var text = track?.title ?? ""
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            text = track?.albumTitle ?? ""
        }
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)

        let space = CGColorSpaceCreateDeviceGray()
        guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8,
                                  bytesPerRow: W, space: space,
                                  bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return }
        ctx.setFillColor(gray: 0, alpha: 1)
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))

        if !text.isEmpty {
            // flip to UIKit's top-left origin so the glyphs draw upright AND
            // land row-0-at-top in memory, matching room_verse's texel reads.
            ctx.translateBy(x: 0, y: CGFloat(H))
            ctx.scaleBy(x: 1, y: -1)
            UIGraphicsPushContext(ctx)
            drawCenteredWhite(text, in: CGSize(width: W, height: H))
            UIGraphicsPopContext()
        }

        if let data = ctx.data {
            // CoreGraphics may pad rows; hand the texture the context's own
            // stride so the upload never skews.
            tex.replace(region: MTLRegionMake2D(0, 0, W, H), mipmapLevel: 0,
                        withBytes: data, bytesPerRow: ctx.bytesPerRow)
        }
    }

    /// Draw `text` centred and white, shrinking the font so a long title still
    /// fits the strip. Heavy weight reads best once the glyphs are stippled
    /// into dots.
    private func drawCenteredWhite(_ text: String, in size: CGSize) {
        let maxW = size.width - 12
        func attributed(_ pt: CGFloat) -> NSAttributedString {
            let font = UIFont.systemFont(ofSize: pt, weight: .heavy)
            let para = NSMutableParagraphStyle()
            para.alignment = .center
            para.lineBreakMode = .byClipping
            return NSAttributedString(string: text, attributes: [
                .font: font,
                .foregroundColor: UIColor.white,
                .paragraphStyle: para
            ])
        }

        var pt: CGFloat = 40
        var str = attributed(pt)
        var bounds = str.size()
        if bounds.width > maxW, bounds.width > 0 {
            pt = max(9, pt * maxW / bounds.width)
            str = attributed(pt)
            bounds = str.size()
        }
        if bounds.height > size.height, bounds.height > 0 {
            pt = max(8, pt * size.height / bounds.height)
            str = attributed(pt)
            bounds = str.size()
        }

        let x = (size.width - bounds.width) / 2
        let y = (size.height - bounds.height) / 2
        str.draw(in: CGRect(x: x, y: y, width: bounds.width + 2, height: bounds.height + 2))
    }
}
