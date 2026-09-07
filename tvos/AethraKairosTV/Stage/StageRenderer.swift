import MetalKit
import QuartzCore
import simd

/* ================================================================
   THE STAGE FIELD — a small renderer that draws a booth's frame.

   This is NOT VisualizerView. It has no analyzer, no director, no
   audio; it is fed by the wire (StageClient.latest) and does one job:
   turn the booth's ~40 floats into the SAME picture a laptop screen
   would draw from the same frame, on this TV's own GPU. It reuses the
   shipped metallib whole — the one `fullscreen_vertex`, every room
   fragment function in Rooms.all, and `grade_pass` (the hue-preserving
   INK grade + starfield floor + vignette) — so the roster and the look
   never drift from the standalone player. The uniform block is the same
   FIXED 144-byte VizUniforms, re-declared here privately by contract
   (a stage screen owns its own mirror, identical to the byte).

   Two rules the design pins on a screen:
   • The booth deals the room. `packet.scene` chooses which room; the
     screen never self-directs (§1.2m). A scene change re-deals the
     room's three dice so a re-entered room wears a fresh face.
   • A quiet booth is HELD, never frozen. When the client reports held,
     the field eases toward a dim cool breath — energy, onset and the
     phantom hand fall away, the white budget closes, the chord cools
     toward ice — so the picture visibly settles rather than locking on
     a stale frame. StageView writes the words over it.
   ================================================================ */

// MARK: - the uniforms mirror

/// EXACT mirror of the Metal-side VizUniforms — the same FIXED 144-byte
/// layout the standalone renderer uses (VisualizerView.swift), re-declared
/// privately so the stage screen depends on no other file's private struct.
/// A drifted layout is a silently wrong picture, so every field stays.
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
    var xformMode: Float = 0
    var colA = SIMD4<Float>(0, 0, 0, 1)
    var colB = SIMD4<Float>(0, 0, 0, 1)
    var colC = SIMD4<Float>(0, 0, 0, 1)
    var act: Float = 0
    var phrasePhase: Float = 0
    var white: Float = 0.05
    var ghostX: Float = 0
    var ghostY: Float = 0
    var ghostStrength: Float = 0
    var roll0: Float = 0
    var roll1: Float = 0
    var roll2: Float = 0
    var lens: Float = -1
    var lensAmt: Float = 0
    var pad3: Float = 0
}

// MARK: - the renderer

@MainActor
final class StageRenderer: NSObject, MTKViewDelegate {

    private let client: StageClient

    private var device: MTLDevice?
    private var queue: MTLCommandQueue?
    private var roomPipelines: [MTLRenderPipelineState] = []
    private var gradePipeline: MTLRenderPipelineState?

    // one offscreen the room paints into (rgba16Float so the GRADE reads it
    // filterable, exactly as the standalone renderer feeds grade_pass)
    private var sceneTex: MTLTexture?
    // the ears on the GPU: bands ride the first 64 texels of the spectrum strip
    private var spectrumTex: MTLTexture?
    private var waveformTex: MTLTexture?
    // a blank word mask at texture(2): rooms that read it (VERSE) fall back to
    // their nebula on an empty mask, and rooms that ignore it are unaffected.
    private var wordTex: MTLTexture?

    private var lastDrawTime: CFTimeInterval = 0
    private var musicalTime: Double = 0
    private var actEased: Double = 0
    private var whiteEased: Double = 0.10
    private var heldFade: Double = 0            // 0 live … 1 fully held

    // the booth's room and its dealt face; re-dealt when the scene changes
    private var currentScene: Int = -1
    private var rolls = SIMD3<Float>(0.5, 0.5, 0.5)

    private var specScratch = [Float](repeating: 0, count: 256)
    private var waveScratch = [Float](repeating: 0, count: 256)

    init(client: StageClient) {
        self.client = client
        super.init()
    }

    // MARK: setup

    func configure(view: MTKView) {
        guard
            let device = view.device,
            let queue = device.makeCommandQueue(),
            let library = device.makeDefaultLibrary(),
            let vertexFn = library.makeFunction(name: "fullscreen_vertex")
        else { return }                          // no Metal: the view rests in the void

        self.device = device
        self.queue = queue

        // one pipeline per room — the whole shipped roster, rendered into the
        // rgba16Float offscreen. A missing function parks the screen in the void
        // (same guard as the standalone renderer), never a half-built roster.
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

        // the GRADE — the shared final composite to the drawable's own format
        if let gradeFn = library.makeFunction(name: "grade_pass") {
            let gdesc = MTLRenderPipelineDescriptor()
            gdesc.vertexFunction = vertexFn
            gdesc.fragmentFunction = gradeFn
            gdesc.colorAttachments[0].pixelFormat = view.colorPixelFormat
            gradePipeline = try? device.makeRenderPipelineState(descriptor: gdesc)
        }

        spectrumTex = makeStrip(device: device)
        waveformTex = makeStrip(device: device)
        wordTex = makeWordTex(device: device)
        rebuildTargets(size: view.drawableSize)
    }

    private func makeStrip(device: MTLDevice) -> MTLTexture? {
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r32Float,
                                                            width: 256, height: 1,
                                                            mipmapped: false)
        desc.usage = .shaderRead
        desc.storageMode = .shared
        return device.makeTexture(descriptor: desc)
    }

    /// A 256×64 r8Unorm mask, left all-zero — the VERSE room reads it and, on an
    /// empty mask, draws its drifting nebula, so the stage never shows a blank
    /// word room even though a booth sends no glyph bitmap over the wire.
    private func makeWordTex(device: MTLDevice) -> MTLTexture? {
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r8Unorm,
                                                            width: 256, height: 64,
                                                            mipmapped: false)
        desc.usage = .shaderRead
        desc.storageMode = .shared
        guard let tex = device.makeTexture(descriptor: desc) else { return nil }
        let zeros = [UInt8](repeating: 0, count: 256 * 64)
        zeros.withUnsafeBytes { buf in
            if let base = buf.baseAddress {
                tex.replace(region: MTLRegionMake2D(0, 0, 256, 64),
                            mipmapLevel: 0, withBytes: base, bytesPerRow: 256)
            }
        }
        return tex
    }

    private func rebuildTargets(size: CGSize) {
        guard let device, size.width >= 1, size.height >= 1 else { return }
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float,
                                                            width: Int(size.width),
                                                            height: Int(size.height),
                                                            mipmapped: false)
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .private
        sceneTex = device.makeTexture(descriptor: desc)
    }

    // MARK: MTKViewDelegate

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        rebuildTargets(size: size)
    }

    func draw(in view: MTKView) {
        guard
            let queue,
            !roomPipelines.isEmpty,
            roomPipelines.count == Rooms.all.count
        else { return }

        let size = view.drawableSize
        guard size.width >= 1, size.height >= 1 else { return }
        if sceneTex == nil || sceneTex?.width != Int(size.width) || sceneTex?.height != Int(size.height) {
            rebuildTargets(size: size)
        }
        guard let scene = sceneTex else { return }

        // -- the clock --
        let nowT = CACurrentMediaTime()
        var dt = lastDrawTime == 0 ? 1.0 / 60.0 : nowT - lastDrawTime
        lastDrawTime = nowT
        dt = min(max(dt, 0), 0.25)

        // -- the frame the booth last spoke (held last good in the client) --
        let packet = client.latest

        // held eases in over ~0.8 s: energy, onset and the hand fall away, the
        // white budget closes, the chord cools — the field settles, never freezes
        let heldTarget: Double = (client.state == .held) ? 1.0 : 0.0
        heldFade += (heldTarget - heldFade) * (1 - exp(-dt / 0.8))
        heldFade = min(max(heldFade, 0), 1)
        let live = Float(1 - heldFade)

        // the rubato: rooms run in musical time, clamped to the dance floor
        let energy = packet.energy * live
        let rate = min(max(0.45 + 1.05 * Double(energy), 0.4), 1.9)
        musicalTime += dt * rate

        // the story arc, eased for smoothness across a lossy wire
        actEased += (Double(packet.act) - actEased) * (1 - exp(-dt / 2.0))
        let whiteFromBooth = Double(packet.white)
        let whiteTarget = whiteFromBooth * (1 - heldFade) + 0.10 * heldFade
        whiteEased += (whiteTarget - whiteEased) * (1 - exp(-dt / 2.0))
        whiteEased = min(max(whiteEased, 0.05), 0.92)

        // the booth deals the room; a scene change re-deals the three dice
        let n = roomPipelines.count
        let idx = ((packet.scene % n) + n) % n
        if idx != currentScene {
            currentScene = idx
            rolls = SIMD3<Float>(Float.random(in: 0..<1),
                                 Float.random(in: 0..<1),
                                 Float.random(in: 0..<1))
        }

        // the light: finished OKLCH → sRGB, cooled toward ice while held
        let chord = packet.chordRGB
        let ice = SIMD3<Float>(0.43, 0.90, 1.0)
        func cooled(_ c: SIMD3<Float>) -> SIMD4<Float> {
            let dim = 0.35 + 0.65 * live                    // held dims to ~0.35
            let t = Float(heldFade) * 0.6
            let m = (c + (ice - c) * t) * dim               // toward ice, then dimmed
            return SIMD4<Float>(m.x, m.y, m.z, 1)
        }

        uploadEars(packet: packet, live: live)

        var u = VizUniforms()
        u.time = Float(musicalTime)
        u.beatPhase = packet.beatPhase
        u.barPhase = packet.barPhase
        u.energy = energy
        u.bass = packet.bass * live
        u.mid = packet.mid * live
        u.treble = packet.treble * live
        u.calm = max(packet.calm, live < 0.5 ? 0.9 : packet.calm)   // held reads calm
        u.onsetEnv = packet.beat * live
        u.aspect = Float(size.width / size.height)
        u.transition = 1                                    // one live room, no handover
        u.xformMode = 0
        u.colA = cooled(chord.a)
        u.colB = cooled(chord.b)
        u.colC = cooled(chord.c)
        u.act = Float(actEased)
        u.phrasePhase = packet.phrasePhase
        u.white = Float(whiteEased)
        // the booth's hand reaches across the wire as the phantom hand
        u.ghostX = packet.hand.x
        u.ghostY = packet.hand.y
        u.ghostStrength = packet.hand.presence * live
        u.roll0 = rolls.x
        u.roll1 = rolls.y
        u.roll2 = rolls.z
        u.lens = packet.lens                                // rooms ignore it; rides for a later pass
        u.lensAmt = packet.lensAmt

        guard let commandBuffer = queue.makeCommandBuffer() else { return }

        // -- the room into the offscreen --
        encodeRoom(index: idx, into: scene, commandBuffer: commandBuffer, uniforms: &u)

        // -- the GRADE to the drawable; if grade_pass is absent, park in void --
        guard
            let gradePipeline,
            let passDesc = view.currentRenderPassDescriptor,
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
        encoder.setFragmentTexture(scene, index: 0)
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
        encoder.setFragmentTexture(wordTex, index: 2)     // VERSE reads it; others ignore it
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
    }

    /// The booth sends bands, not a waveform. The bands ride the first 64 texels
    /// of the spectrum strip (the room shaders' contract); the waveform strip is
    /// synthesized from the bands as a bounded scope line, so SCOPE-family rooms
    /// still draw a living trace rather than a flat one. Held decays both.
    private func uploadEars(packet: StagePacket, live: Float) {
        for i in 0..<256 { specScratch[i] = 0 }
        let bandCount = min(64, packet.bands.count)
        for i in 0..<bandCount { specScratch[i] = min(max(packet.bands[i] * live, 0), 4) }

        // a plausible waveform: a few bands beating together, bounded to -1..1
        let e = Double(packet.energy * live)
        let t = musicalTime
        for i in 0..<256 {
            let x = Double(i) / 255.0
            let b0 = Double(bandCount > 2 ? specScratch[2] : 0)
            let b1 = Double(bandCount > 8 ? specScratch[8] : 0)
            let s = sin(x * 34.0 + t * 6.0) * (0.15 + 0.5 * e)
                  + sin(x * 90.0 + t * 3.1) * 0.30 * b1
                  + sin(x * 14.0 - t * 2.0) * 0.35 * b0
            waveScratch[i] = Float(min(max(s, -1), 1))
        }

        let region = MTLRegionMake2D(0, 0, 256, 1)
        let rowBytes = 256 * MemoryLayout<Float>.stride
        specScratch.withUnsafeBytes { buffer in
            if let base = buffer.baseAddress {
                spectrumTex?.replace(region: region, mipmapLevel: 0, withBytes: base, bytesPerRow: rowBytes)
            }
        }
        waveScratch.withUnsafeBytes { buffer in
            if let base = buffer.baseAddress {
                waveformTex?.replace(region: region, mipmapLevel: 0, withBytes: base, bytesPerRow: rowBytes)
            }
        }
    }
}
