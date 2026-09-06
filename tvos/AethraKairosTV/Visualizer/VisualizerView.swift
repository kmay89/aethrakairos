import SwiftUI
import MetalKit
import UIKit

/* ================================================================
   THE FIELD — the SwiftUI face of the Metal renderer.
   One pipeline, deliberately boring: the current room renders into
   an offscreen texture every frame; during a handover the outgoing
   room renders into a second texture and xform_luma composites the
   pair into the drawable; at rest the same composite runs with
   transition pinned at 1 (a fullscreen copy — one pipeline, no
   format-juggling blit). The renderer polls the analyzer's frame,
   asks the Palette for the track's chord, and ticks the Director.
   Reduce Motion is honoured at three points: open in PULSE, plain
   0.9 s crossfades, and nothing else changes — calm is a feature
   tier, not a punishment.
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

/// EXACT mirror of the Metal-side VizUniforms: 12 packed floats, then
/// three SIMD4<Float> at offsets 48/64/80 — 96 bytes. Field order is
/// contract; a drifted layout is a silently wrong picture.
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
    var pad0: Float = 0                       // xform mode: 1 = plain crossfade (Reduce Motion)
    var colA = SIMD4<Float>(0, 0, 0, 1)
    var colB = SIMD4<Float>(0, 0, 0, 1)
    var colC = SIMD4<Float>(0, 0, 0, 1)
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
    private var xformPipeline: MTLRenderPipelineState?

    // offscreen pair: A = the live room, B = the departing room mid-handover
    private var texA: MTLTexture?
    private var texB: MTLTexture?
    // the ears on the GPU: 256x1 r32Float each (first 64 texels = bands)
    private var spectrumTex: MTLTexture?
    private var waveformTex: MTLTexture?

    private var director = Director()
    private var lastDrawTime: CFTimeInterval = 0
    /// One musical clock for every room: dt scaled by energy (the rubato),
    /// so motion breathes with the track and speed changes never teleport
    /// time-driven geometry.
    private var musicalTime: Double = 0

    private var transitionProgress: Double = 1.0     // >= 1 means at rest
    private var transitionDuration: Double = 1.2
    private var outgoingIndex: Int = 0
    private var lastRoomStep: Int?

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

        // the compositor targets the drawable's own format
        let xdesc = MTLRenderPipelineDescriptor()
        xdesc.vertexFunction = vertexFn
        xdesc.fragmentFunction = library.makeFunction(name: "xform_luma")
        xdesc.colorAttachments[0].pixelFormat = view.colorPixelFormat
        xformPipeline = try? device.makeRenderPipelineState(descriptor: xdesc)

        spectrumTex = makeDataTexture(device: device)
        waveformTex = makeDataTexture(device: device)

        rebuildTargets(size: view.drawableSize)
        publishRoomName()
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
    }

    // MARK: remote steps

    /// `roomStep` is a counter, not an index: the first sighting is the
    /// baseline, every later change applies its delta as a manual step.
    func roomStepChanged(to value: Int) {
        guard let last = lastRoomStep else {
            lastRoomStep = value
            return
        }
        lastRoomStep = value
        let delta = value - last
        guard delta != 0 else { return }
        let before = director.currentIndex
        director.step(delta)
        if director.currentIndex != before {
            beginTransition(from: before)
            publishRoomName()
        }
    }

    private func beginTransition(from oldIndex: Int) {
        outgoingIndex = oldIndex
        transitionProgress = 0
        // Reduce Motion: always a plain 0.9 s dissolve; otherwise the
        // 1.2 s luma handover
        transitionDuration = reduceMotion ? 0.9 : 1.2
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

    // MARK: MTKViewDelegate

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        rebuildTargets(size: size)
    }

    func draw(in view: MTKView) {
        guard let queue,
              let xformPipeline,
              roomPipelines.count == Rooms.all.count,
              !roomPipelines.isEmpty
        else { return }

        let size = view.drawableSize
        guard size.width >= 1, size.height >= 1 else { return }
        if texA == nil || texA?.width != Int(size.width) || texA?.height != Int(size.height) {
            rebuildTargets(size: size)
        }
        guard let liveTex = texA else { return }

        // -- the clock --
        let now = CACurrentMediaTime()
        var dt = lastDrawTime == 0 ? 1.0 / 60.0 : now - lastDrawTime
        lastDrawTime = now
        dt = min(max(dt, 0), 0.25)                     // a resumed app is not a time machine

        // -- the ears and the chord --
        let frame = player.analyzer.currentFrame()
        let chord = Palette.chord(for: player.current)

        // the rubato: rooms run in musical time, clamped to the dance floor
        let rate = min(max(0.45 + 1.05 * Double(frame.energy), 0.4), 1.9)
        musicalTime += dt * rate

        // -- the director --
        let before = director.currentIndex
        if director.tick(dt: dt, frame: frame) != nil {
            beginTransition(from: before)
            publishRoomName()
        }
        if transitionProgress < 1 {
            transitionProgress = min(1, transitionProgress + dt / max(transitionDuration, 0.05))
        }

        uploadAudioTextures(frame: frame)

        // -- uniforms --
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
        u.pad0 = reduceMotion ? 1 : 0
        u.colA = SIMD4<Float>(chord.a.x, chord.a.y, chord.a.z, 1)
        u.colB = SIMD4<Float>(chord.b.x, chord.b.y, chord.b.z, 1)
        u.colC = SIMD4<Float>(chord.c.x, chord.c.y, chord.c.z, 1)

        guard let commandBuffer = queue.makeCommandBuffer() else { return }

        // -- pass 1: the live room into texA --
        let current = director.currentIndex
        guard roomPipelines.indices.contains(current) else { return }
        encodeRoom(index: current, into: liveTex, commandBuffer: commandBuffer, uniforms: &u)

        // -- pass 2 (handover only): the departing room into texB --
        var ghostTex: MTLTexture = liveTex
        if transitionProgress < 1,
           let tb = texB,
           outgoingIndex != current,
           roomPipelines.indices.contains(outgoingIndex) {
            encodeRoom(index: outgoingIndex, into: tb, commandBuffer: commandBuffer, uniforms: &u)
            ghostTex = tb
        }

        // -- pass 3: composite to the drawable --
        guard let passDesc = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: passDesc)
        else {
            commandBuffer.commit()
            return
        }
        encoder.setRenderPipelineState(xformPipeline)
        encoder.setFragmentBytes(&u, length: MemoryLayout<VizUniforms>.stride, index: 0)
        var res = SIMD2<Float>(Float(size.width), Float(size.height))
        encoder.setFragmentBytes(&res, length: MemoryLayout<SIMD2<Float>>.stride, index: 1)
        encoder.setFragmentTexture(liveTex, index: 0)
        encoder.setFragmentTexture(ghostTex, index: 1)
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
