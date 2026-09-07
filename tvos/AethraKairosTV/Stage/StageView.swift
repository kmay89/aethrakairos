import SwiftUI
import MetalKit
import UIKit

/* ================================================================
   THE STAGE SCREEN — an Apple TV joins a booth's wire.

   Four letters and a JOIN: the design's whole "wire" ceremony, made
   Siri-Remote-native. A focusable A–Z grid fills four slots, JOIN opens
   the socket, and once frames arrive the field runs full-bleed and
   chrome-less — "the same page, told to be a screen" (DESIGN §1.2m). A
   quiet booth is spoken, not frozen: on the held state the field cools
   and settles under a plain "THE BOOTH STOPPED SPEAKING" card. Menu
   leaves the wire; Menu again on the entry screen closes the door. No
   audio ever plays here — a stage screen is a screen, not a player.
   ================================================================ */

struct StageView: View {
    @Binding var isPresented: Bool

    @StateObject private var client = StageClient()
    @State private var letters: [Character] = []

    private static let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

    var body: some View {
        ZStack {
            Color.akVoid.ignoresSafeArea()

            switch client.state {
            case .idle:
                codeEntry
            case .joining:
                joiningView
            case .live, .held:
                StageMetalView(client: client)
                    .ignoresSafeArea()
                if client.state == .held {
                    heldOverlay
                } else {
                    liveWhisper
                }
            case .error:
                errorView
            }
        }
        .onExitCommand { back() }
        .onDisappear { client.leave() }
    }

    // MARK: - the door

    private func back() {
        switch client.state {
        case .idle, .error:
            isPresented = false
        default:
            client.leave()          // live / held / joining → drop to the entry
        }
    }

    // MARK: - code entry

    private var codeEntry: some View {
        VStack(spacing: 46) {
            VStack(alignment: .center, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text("STAGE")
                        .font(.system(size: 40, weight: .semibold))
                        .tracking(8)
                        .foregroundStyle(Color.akInk)
                    Text("∞")
                        .font(.system(size: 40, weight: .regular, design: .serif))
                        .foregroundStyle(Color.akIce)
                }
                Text("BECOME A SCREEN FOR A BOOTH")
                    .font(.system(size: 16, weight: .semibold))
                    .tracking(5)
                    .foregroundStyle(Color.akDim)
                Text("Enter the booth's four-letter code. The field renders here on this TV — the booth carries the sound.")
                    .font(.system(size: 19))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 720)
            }

            slotsRow
            letterGrid

            HStack(spacing: 28) {
                Button { if !letters.isEmpty { letters.removeLast() } } label: {
                    Text("DELETE")
                        .font(.system(size: 22, weight: .semibold, design: .monospaced))
                        .tracking(2)
                        .frame(width: 200)
                        .padding(.vertical, 8)
                }
                Button { join() } label: {
                    Text("JOIN")
                        .font(.system(size: 24, weight: .bold, design: .monospaced))
                        .tracking(3)
                        .foregroundStyle(letters.count == 4 ? Color.akAmber : Color.akDim)
                        .frame(width: 240)
                        .padding(.vertical, 8)
                }
                .disabled(letters.count != 4)
            }
        }
        .padding(60)
        .focusSection()
    }

    /// Four boxes; the next box to fill wears the amber cursor.
    private var slotsRow: some View {
        HStack(spacing: 24) {
            ForEach(0..<4, id: \.self) { i in
                let filled = i < letters.count
                let isNext = (i == letters.count)
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isNext ? Color.akAmber : Color.akLine, lineWidth: isNext ? 3 : 2)
                    .background(
                        RoundedRectangle(cornerRadius: 12).fill(Color.akGlassHard)
                    )
                    .frame(width: 92, height: 116)
                    .overlay(
                        Text(filled ? String(letters[i]) : "")
                            .font(.system(size: 64, weight: .semibold, design: .monospaced))
                            .foregroundStyle(Color.akInk)
                    )
            }
        }
    }

    private var letterGrid: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.fixed(96), spacing: 16), count: 9),
            spacing: 16
        ) {
            ForEach(StageView.alphabet, id: \.self) { letter in
                Button { append(letter) } label: {
                    Text(String(letter))
                        .font(.system(size: 30, weight: .semibold, design: .monospaced))
                        .frame(width: 96, height: 76)
                }
                .disabled(letters.count >= 4)
            }
        }
        .frame(maxWidth: 1000)
        .focusSection()
    }

    private func append(_ letter: Character) {
        guard letters.count < 4 else { return }
        letters.append(letter)
    }

    private func join() {
        guard letters.count == 4 else { return }
        client.join(code: String(letters))
    }

    // MARK: - joining

    private var joiningView: some View {
        VStack(spacing: 26) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(Color.akIce)
                .scaleEffect(1.6)
            Text("REACHING THE BOOTH")
                .font(.system(size: 22, weight: .semibold, design: .monospaced))
                .tracking(4)
                .foregroundStyle(Color.akInk)
            Text(client.code)
                .font(.system(size: 44, weight: .bold, design: .monospaced))
                .tracking(10)
                .foregroundStyle(Color.akIce)
            Text("Menu to cancel")
                .font(.system(size: 16))
                .foregroundStyle(Color.akDim)
        }
    }

    // MARK: - live (chrome-less) + held

    /// A single faint corner whisper — the code, and how to leave. The field is
    /// otherwise unadorned, as a stage screen is meant to be.
    private var liveWhisper: some View {
        VStack {
            Spacer()
            HStack {
                Text("STAGE \(client.code)  ·  MENU TO LEAVE")
                    .font(.system(size: 15, weight: .medium, design: .monospaced))
                    .tracking(3)
                    .foregroundStyle(Color.akInk.opacity(0.5))
                    .padding(.horizontal, 40)
                    .padding(.bottom, 34)
                Spacer()
            }
        }
        .allowsHitTesting(false)
    }

    private var heldOverlay: some View {
        VStack(spacing: 18) {
            Text("THE BOOTH STOPPED SPEAKING")
                .font(.system(size: 30, weight: .semibold))
                .tracking(3)
                .foregroundStyle(Color.akInk)
            Text("The wire went quiet. The field is holding the last frame it heard — it will pick straight back up when the booth speaks again.")
                .font(.system(size: 19))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 640)
            Text("STAGE \(client.code)  ·  MENU TO LEAVE")
                .font(.system(size: 15, weight: .medium, design: .monospaced))
                .tracking(3)
                .foregroundStyle(Color.akDim)
                .padding(.top, 6)
        }
        .padding(48)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24))
        .background(RoundedRectangle(cornerRadius: 24).fill(Color.akVoid.opacity(0.4)))
    }

    // MARK: - error

    private var errorView: some View {
        VStack(spacing: 22) {
            Text("THE WIRE REFUSED")
                .font(.system(size: 28, weight: .semibold))
                .tracking(3)
                .foregroundStyle(Color.akBeat)
            Text(client.errorMessage ?? "The stage connection could not be made.")
                .font(.system(size: 20))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 640)
            Button { client.leave() } label: {
                Text("BACK")
                    .font(.system(size: 22, weight: .semibold, design: .monospaced))
                    .tracking(3)
                    .frame(width: 220)
                    .padding(.vertical, 8)
            }
        }
        .padding(48)
        .focusSection()
    }
}

// MARK: - the MTKView bridge

/// Wraps the stage MTKView. The coordinator is the StageRenderer, fed by the
/// same StageClient the view observes — one renderer for the life of the field.
private struct StageMetalView: UIViewRepresentable {
    let client: StageClient

    func makeCoordinator() -> StageRenderer {
        StageRenderer(client: client)
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

    func updateUIView(_ uiView: MTKView, context: Context) { }
}

// Identity tokens (DESIGN §2) — the same void / ink / axis palette the shelves
// use, kept private to this file so the stage speaks the app's own voice.
private extension Color {
    static let akVoid = Color(red: 5 / 255, green: 6 / 255, blue: 14 / 255)
    static let akInk = Color(red: 233 / 255, green: 237 / 255, blue: 246 / 255)
    static let akDim = Color(red: 154 / 255, green: 165 / 255, blue: 188 / 255)
    static let akAmber = Color(red: 255 / 255, green: 180 / 255, blue: 84 / 255)
    static let akIce = Color(red: 110 / 255, green: 231 / 255, blue: 255 / 255)
    static let akBeat = Color(red: 255 / 255, green: 92 / 255, blue: 135 / 255)
    static let akGlassHard = Color(red: 10 / 255, green: 13 / 255, blue: 24 / 255).opacity(0.72)
    static let akLine = Color(red: 150 / 255, green: 170 / 255, blue: 210 / 255).opacity(0.16)
}
