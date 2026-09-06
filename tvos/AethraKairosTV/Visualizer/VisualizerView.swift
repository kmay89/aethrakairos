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

    private var specScratch = [Float](repeating: 0, count: 256)
    private var waveScratch = [Float](repeating: 0, count: 256)

    init(player: Player, roomName: Binding<String>) {
        self.player = player
        self.roomName = roomName
        self.reduceMotion = UIAccessibility.isReduceMotionEnabled
        super.init()
        if reduceMotion {
            // Reduce Motion opens in PULSE — the calm meter, found by key
            director = Director(startAt: Rooms.pulseIndex)
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

        // the GRADE — the final composite, into the drawable's own format
        let gdesc = MTLRenderPipelineDescriptor()
        gdesc.vertexFunction = vertexFn
        gdesc.fragmentFunction = library.makeFunction(name: "grade_pass")
        gdesc.colorAttachments[0].pixelFormat = view.colorPixelFormat
        gradePipeline = try? device.makeRenderPipelineState(descriptor: gdesc)

        spectrumTex = makeDataTexture(device: device)
        waveformTex = makeDataTexture(device: device)

        rebuildTargets(size: view.drawableSize)
        publishRoomName()
    }

    private static func freshRolls() -> SIMD3<Float> {
        SIMD3<Float>(Float.random(in: 0..<1), Float.random(in: 0..<1), Float.random(in: 0..<1))
    }

    private func makeDataTexture(device: MTLDevice) -> MTLTexture? {
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r32Float,
                                                            width: 256, height: 1,
                                                            mipmapped: false)
        desc.usage = .shaderRead
        desc.storageMode = .shared
        return device.makeTexture(descriptor: desc)
    }

    private func rebuildTargets(size: CGSize) {
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

    /// Act boundaries centered on the apex (0.62 when there is no structure
    /// to read). OVERTURE / RISING / APEX / TURN / RESOLVE.
    private func actIndex(prog: Double) -> Int {
        let apex = 0.62
        if prog < apex - 0.28 { return 0 }
        if prog < apex - 0.05 { return 1 }
        if prog < apex + 0.12 { return 2 }
        if prog < apex + 0.30 { return 3 }
        return 4
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

    /// The pure lens rule (the web's pickLens, act + energy driven): clean
    /// glass at the ends of the arc (OVERTURE / RESOLVE) or when there is too
    /// little energy to bend meaningfully (the structure-ceiling stand-in). At
    /// the APEX it is mirrors, or prism when the energy is at its loudest, or
    /// moire on a tense minor peak; a driving RISING build gets wave, and the
    /// TURN / comedown gets iris. Returns -1 (none), 0 mirrors, 1 wave, 2 prism,
    /// 3 iris, 4 tile, 5 moire.
    private func pickLens(act: Int, energy: Double, minor: Bool) -> Int {
        if act == 0 || act == 4 { return -1 }        // OVERTURE / RESOLVE: clean glass
        if energy < 0.30 { return -1 }               // too little to bend
        if act == 2 {                                // APEX
            if minor && energy > 0.66 { return 5 }   // moire — a tense minor peak
            if energy > 0.93 { return 2 }            // prism — the loudest apex
            return 0                                  // mirrors — the major apex
        }
        if act == 1 && energy > 0.72 { return 1 }    // wave — a driving RISING build
        return 3                                      // iris — the TURN / comedown
    }

    /// The auto-picker over the pure rule: it holds a chosen lens ~9 s and
    /// `none` ~3 s so the look never flickers, and returns -1 ALWAYS under
    /// Reduce Motion (calm is clean glass). The engage ramp lives in draw().
    private func autoLens(dt: Double, act: Int, energy: Double, minor: Bool) -> Int {
        if reduceMotion {
            lensChoice = -1
            lensHold = 0
            return -1
        }
        lensHold -= max(dt, 0)
        if lensHold <= 0 {
            lensChoice = pickLens(act: act, energy: energy, minor: minor)
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
        if texA == nil || texA?.width != Int(size.width) || texA?.height != Int(size.height) {
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

        // -- the ears and the chord --
        let frame = player.analyzer.currentFrame()
        let chord = Palette.chord(for: player.current)

        // the rubato: rooms run in musical time, clamped to the dance floor
        let rate = min(max(0.45 + 1.05 * Double(frame.energy), 0.4), 1.9)
        musicalTime += dt * rate

        // -- the story: acts eased (tau 3 s), white budget eased (tau 2.5 s) --
        let dur = player.current?.duration ?? 0
        let prog = dur > 1 ? min(max(player.position / dur, 0), 1) : 0
        let actTarget = actIndex(prog: prog)
        actEased += (Double(actTarget) - actEased) * (1 - exp(-dt / 3.0))
        var whiteTarget = 0.05 + actHeat(actEased) * 0.87
        if calmNow { whiteTarget = min(whiteTarget, 0.42) }     // the calm tier tightens the ceiling
        whiteEased += (whiteTarget - whiteEased) * (1 - exp(-dt / 2.5))
        whiteEased = min(max(whiteEased, 0.05), 0.92)

        // -- the director --
        let before = director.currentIndex
        if director.tick(dt: dt, frame: frame, act: actTarget) != nil {
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

        // -- the lens: auto-picked by act + energy, held so it never flickers.
        // The chosen TYPE snaps at hold boundaries; the AMOUNT eases (tau 0.6 s)
        // so engaging and disengaging dissolve. When the pick drops to none the
        // last real type sticks (lensRenderMode) while the amount fades, so the
        // pass runs until it truly reaches clean glass — no pop. Under Reduce
        // Motion autoLens() returns -1, the amount decays to 0, and the lens is
        // bypassed to the exact wave-2 tail. --
        let minorNow = (player.current?.mix?.key?.uppercased().hasSuffix("A")) ?? false
        let pickedLens = autoLens(dt: dt, act: actTarget, energy: Double(frame.energy), minor: minorNow)
        let lensAmtTarget: Double = pickedLens >= 0 ? (0.45 + 0.50 * Double(frame.energy)) : 0.0
        lensAmt += (lensAmtTarget - lensAmt) * (1 - exp(-dt / 0.6))
        lensAmt = min(max(lensAmt, 0), 1)
        if pickedLens >= 0 { lensRenderMode = pickedLens }
        let lensEngage = lensPipeline != nil && lensTex != nil
                       && lensRenderMode >= 0 && lensAmt > 0.01

        uploadAudioTextures(frame: frame)

        // -- uniforms (the live room's block) --
        var u = VizUniforms()
        u.time = Float(musicalTime)
        u.beatPhase = frame.beatPhase
        u.barPhase = frame.barPhase
        u.energy = frame.energy
        u.bass = frame.bass
        u.mid = frame.mid
        u.treble = frame.treble
        u.calm = frame.calm
        u.onsetEnv = frame.onsetEnv
        // height is guarded above — the aspect never divides by zero
        u.aspect = Float(size.width / size.height)
        u.transition = transitionProgress >= 1 ? 1 : Float(transitionProgress)
        u.xformMode = Float(currentXformMode)
        u.colA = SIMD4<Float>(chord.a.x, chord.a.y, chord.a.z, 1)
        u.colB = SIMD4<Float>(chord.b.x, chord.b.y, chord.b.z, 1)
        u.colC = SIMD4<Float>(chord.c.x, chord.c.y, chord.c.z, 1)
        u.act = Float(actEased)
        u.phrasePhase = frame.phrasePhase
        u.white = Float(whiteEased)
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

        // -- pass 2 (handover only): the departing room into texB, wearing
        //    its OWN (outgoing) dice so it keeps the face it entered with --
        var ghostTex: MTLTexture = liveTex
        if transitionProgress < 1,
           let tb = texB,
           outgoingIndex != current,
           roomPipelines.indices.contains(outgoingIndex) {
            var ug = u
            ug.roll0 = outgoingRolls.x
            ug.roll1 = outgoingRolls.y
            ug.roll2 = outgoingRolls.z
            encodeRoom(index: outgoingIndex, into: tb, commandBuffer: commandBuffer, uniforms: &ug)
            ghostTex = tb
        }

        // -- pass 3: the XFORM composite (live + ghost) into texC --
        let mode = min(max(currentXformMode, 0), xformPipelines.count - 1)
        encodeComposite(pipeline: xformPipelines[mode], into: compTex,
                        commandBuffer: commandBuffer, uniforms: &u,
                        tex0: liveTex, tex1: ghostTex)

        // -- pass 3.5 (lens only): bend the composite through lens_pass into
        //    lensTex. Skipped entirely when the lens is off, so the GRADE reads
        //    the composite directly — the exact proven wave-2 flow. lens_pass
        //    reads only texture(0); tex1 is bound to the same source, ignored. --
        var sceneForGrade: MTLTexture = compTex
        if lensEngage, let lensPipeline, let lt = lensTex {
            encodeComposite(pipeline: lensPipeline, into: lt,
                            commandBuffer: commandBuffer, uniforms: &u,
                            tex0: compTex, tex1: compTex)
            sceneForGrade = lt
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

    /// The bands ride in the first 64 texels of a 256-wide r32Float strip;
    /// the waveform fills its own strip end to end. Counts are guarded —
    /// a short frame uploads zeros, never stale garbage or a crash.
    private func uploadAudioTextures(frame: Analyzer.Frame) {
        for i in 0..<256 { specScratch[i] = 0 }
        let bandCount = min(64, frame.spectrum.count)
        for i in 0..<bandCount { specScratch[i] = frame.spectrum[i] }

        for i in 0..<256 { waveScratch[i] = 0 }
        let waveCount = min(256, frame.waveform.count)
        for i in 0..<waveCount { waveScratch[i] = frame.waveform[i] }

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
}
