import SwiftUI
import UIKit

/// The 10-foot flow: the field is the app. The visualizer runs full-bleed at
/// the root, the zen HUD floats over it, and the shelves are a frosted overlay
/// that appears on Menu and retreats the moment a choice is made — browsing is
/// an interruption of the field, never the other way around.
struct HomeView: View {
    @EnvironmentObject var catalogStore: CatalogStore
    @EnvironmentObject var library: Library
    @EnvironmentObject var player: Player

    // The renderer's settings, observed so the SETTINGS toggles both write and
    // reflect the live state — the shared instance the field reads each frame.
    @ObservedObject private var viz = VizSettings.shared

    // Shelves open at boot: nothing plays until a ritual or album is chosen.
    @State private var shelvesShown = true
    // The welcome speaks exactly once — four lines on why this exists — and
    // then never again, unless SETTINGS asks it to. It survives relaunches.
    @AppStorage("introSeen") private var introSeen = false
    // The Journey Console, reached from the shelves' JOURNEY entry.
    @State private var showConsole = false
    // The Stage screen, reached from the shelves' STAGE entry — the TV joins a
    // booth's wire and renders the field from its packet, playing no audio.
    @State private var showStage = false
    @State private var roomStep = 0
    @State private var roomName = ""
    @State private var activity = 0
    @State private var hudVisible = true
    // The boot grace: while the catalog is still arriving the shelves show a
    // quiet loading line instead of the catalog-less STAGE/SETTINGS pair —
    // otherwise those two flash for a beat, the library shelves insert above
    // them, and the focus engine strands the viewer on the first button it
    // can find. After the grace, a genuinely catalog-less session (offline
    // first launch) still gets its shelves: a room can be tuned in silence.
    @State private var bootGraceOver = false

    // Generative sleeves drawn once per album tag, kept for the app's life so
    // the grid scrolls without redrawing 5200 grain dots per tile.
    @State private var covers: [String: UIImage] = [:]

    // CI's camera: `--field` boots straight onto the field (no shelves), so
    // the simulator smoke job can photograph a live room. Combined with
    // `-introSeen YES` (read natively by @AppStorage) and `--start-room` in
    // the renderer. Never set by the app itself.
    init() {
        _shelvesShown = State(initialValue: !ProcessInfo.processInfo.arguments.contains("--field"))
    }

    var body: some View {
        ZStack {
            Color.akVoid.ignoresSafeArea()
            VisualizerView(player: player, roomStep: roomStep, roomName: $roomName)
                .ignoresSafeArea()
            // The field's remote grammar is a LAYER, not a wrapper: it is in
            // the hierarchy only while the field owns the screen. While the
            // welcome or the shelves are up there are no gesture recognizers
            // and no focusable wrappers anywhere — the buttons get every
            // press and the focus engine gets every swipe. (Wrapping the
            // whole ZStack, even with guards or gesture masks, provably
            // killed all focus on hardware — see FieldRemoteLayer's header.)
            if introSeen && !shelvesShown {
                FieldRemoteLayer(player: player, library: library,
                                 roomStep: $roomStep, shelvesShown: $shelvesShown,
                                 activity: $activity)
            }
            NowPlayingHUD(player: player, library: library, roomName: roomName, visible: hudVisible && !shelvesShown)
            if !introSeen {
                // First light: the welcome owns the screen alone; its one
                // button is the only focusable in the app.
                introOverlay
                    .transition(.opacity)
                    .zIndex(2)
            } else if shelvesShown {
                shelvesOverlay
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: shelvesShown)
        .animation(.easeInOut(duration: 0.35), value: introSeen)
        .zenLadder(player: player, activity: activity, hudVisible: $hudVisible)
        .fullScreenCover(isPresented: $showConsole) {
            if let catalog = catalogStore.catalog {
                JourneyConsole(player: player, catalog: catalog, isPresented: $showConsole)
            }
        }
        .fullScreenCover(isPresented: $showStage) {
            StageView(isPresented: $showStage)
        }
    }

    // MARK: - shelves

    private var shelvesOverlay: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 52) {
                wordmarkHeader
                nowRow
                if let catalog = catalogStore.catalog {
                    journeyShelf
                    ritualsShelf(catalog)
                    albumsShelf(catalog)
                    heartsShelf(catalog)
                    recentShelf(catalog)
                    stageShelf
                    settingsShelf
                } else if bootGraceOver {
                    // the library never came — the room can still be tuned
                    stageShelf
                    settingsShelf
                } else {
                    loadingRow
                }
            }
            .padding(.horizontal, 80)
            .padding(.vertical, 60)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        // One clean rebuild when the library lands: the shelf set changes
        // exactly once, and the focus engine starts fresh at the top instead
        // of stranding on whatever survived the layout shift.
        .id(catalogStore.catalog == nil)
        // Frosted glass over the dimmed field — the field never stops, it only
        // steps back while a choice is made.
        .background(.ultraThinMaterial)
        .background(Color.akVoid.opacity(0.55).ignoresSafeArea())
        .onExitCommand { dismissShelves() }
        // The transport key works everywhere: with the field's layer out of
        // the hierarchy while browsing, play/pause is answered here instead.
        .onPlayPauseCommand {
            activity += 1
            player.toggle()
        }
        .task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            bootGraceOver = true
        }
    }

    /// The boot beat: the catalog is usually here within a blink (cached
    /// copies boot instantly), so this line is rarely seen — but it is what
    /// keeps SETTINGS from flashing and fleeing on a cold start.
    private var loadingRow: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TUNING THE LIBRARY…")
                .font(.system(size: 24, weight: .semibold))
                .tracking(2)
                .foregroundStyle(Color.akDim)
            Text(catalogStore.statusLine)
                .font(.system(size: 17, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .padding(.top, 8)
    }

    private func dismissShelves() {
        shelvesShown = false
        activity += 1
    }

    // MARK: - the welcome

    /// The thirty-second introduction, in the house voice: what this is, what
    /// it's for, and the two facts that make it unlike anything else on the
    /// shelf. Four rows, one button, no scroll — Menu skips it, SETTINGS can
    /// replay it, and it never interrupts twice.
    private var introOverlay: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                Text("Aethra Kairos")
                    .font(.system(size: 72, weight: .medium, design: .serif))
                    .italic()
                    .foregroundStyle(Color.akInk)
                Text("∞")
                    .font(.system(size: 58, weight: .regular, design: .serif))
                    .foregroundStyle(Color.akIce)
            }
            Text("Music and moving art for your TV.")
                .font(.system(size: 29, design: .serif))
                .italic()
                .foregroundStyle(Color.akDim)
                .padding(.top, 10)

            VStack(alignment: .leading, spacing: 30) {
                introRow("∞", "NONSTOP MUSIC",
                         "Original songs that blend into each other — like a DJ who never takes a break.")
                introRow("✦", "80 LIGHT SHOWS",
                         "Oceans, lightning, fireflies, and more — the picture dances along with the music.")
                introRow("◈", "PICK A MOOD",
                         "Working out, dinner, focus, or bedtime — one click plays music that fits.")
                introRow("♥", "FREE FOR EVERYONE",
                         "No account, no ads, no cost — and nothing you do is tracked or shared.")
            }
            .padding(.top, 56)

            Button {
                withAnimation { introSeen = true }
            } label: {
                Text("BEGIN")
                    .font(.system(size: 27, weight: .semibold))
                    .tracking(5)
                    .foregroundStyle(Color.akInk)
                    .padding(.horizontal, 26)
                    .padding(.vertical, 2)
            }
            .buttonStyle(ShelfChipStyle())
            .padding(.top, 56)

            Text("MENU = BROWSE      CLICK = PLAY / PAUSE      SWIPE ↑ ↓ = CHANGE THE PICTURE")
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .tracking(3)
                .foregroundStyle(Color.akDim)
                .padding(.top, 44)
            Spacer()
        }
        .padding(.horizontal, 120)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(.ultraThinMaterial)
        .background(Color.akVoid.opacity(0.55).ignoresSafeArea())
        .onExitCommand { withAnimation { introSeen = true } }
    }

    private func introRow(_ glyph: String, _ title: String, _ line: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 26) {
            Text(glyph)
                .font(.system(size: 34, weight: .regular))
                .foregroundStyle(Color.akIce)
                .frame(width: 54, alignment: .center)
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.system(size: 25, weight: .semibold))
                    .tracking(3)
                    .foregroundStyle(Color.akInk)
                Text(line)
                    .font(.system(size: 21))
                    .foregroundStyle(Color.akDim)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: 1100, alignment: .leading)
    }

    // MARK: - wordmark

    /// The dual identity, verbatim: artist on the marquee, engine credited
    /// beneath in 9pt-equivalent tracked caps.
    private var wordmarkHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("Aethra Kairos")
                    .font(.system(size: 56, weight: .medium, design: .serif))
                    .italic()
                    .foregroundStyle(Color.akInk)
                Text("∞")
                    .font(.system(size: 46, weight: .regular, design: .serif))
                    .foregroundStyle(Color.akIce)
            }
            Text("POWERED BY MÖBIUS⁸")
                .font(.system(size: 18, weight: .semibold))
                .tracking(6)
                .foregroundStyle(Color.akDim)
            if catalogStore.catalog == nil {
                // Loading / refusal state speaks in the technical voice.
                Text(catalogStore.statusLine)
                    .font(.system(size: 23, design: .monospaced))
                    .foregroundStyle(Color.akDim)
                    .padding(.top, 14)
                    .focusable()
            }
        }
    }

    // MARK: - now playing header

    /// The whisper's big sibling: the live room and the act word in mono caps,
    /// the playing title trailing in the editorial serif. Present only when
    /// something is on the deck — the position and duration are observed, so
    /// the act word turns over as the track runs.
    @ViewBuilder private var nowRow: some View {
        if let track = player.current {
            HStack(alignment: .firstTextBaseline, spacing: 22) {
                Text("NOW")
                    .font(.system(size: 19, weight: .semibold, design: .monospaced))
                    .tracking(5)
                    .foregroundStyle(Color.akDim)
                Text(roomName.isEmpty ? "THE FIELD" : roomName)
                    .font(.system(size: 19, weight: .semibold, design: .monospaced))
                    .tracking(5)
                    .foregroundStyle(Color.akIce)
                    .lineLimit(1)
                Text(actWord)
                    .font(.system(size: 19, weight: .semibold, design: .monospaced))
                    .tracking(5)
                    .foregroundStyle(Color.akAmber)
                Spacer(minLength: 32)
                Text(track.title)
                    .font(.system(size: 24, design: .serif))
                    .italic()
                    .foregroundStyle(Color.akInk)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The five-act arc, derived exactly as the director does: prog against
    /// the song's real apex when its script shipped, the progress template
    /// otherwise. Without a duration the track is still in its OVERTURE.
    private var actWord: String {
        let duration = player.current?.duration ?? 0
        guard duration > 0 else { return Story.actNames[0] }
        let prog = min(max(player.position / duration, 0), 1)
        let index = Story.act(prog: prog, structure: player.current?.mix?.structure)
        return Story.actNames[min(max(index, 0), Story.actNames.count - 1)]
    }

    // MARK: - settings

    /// The four dials, always reachable from the shelves. The mix style writes
    /// to the player; the two flags write to the shared visual settings the
    /// renderer reads. Nothing here needs a catalog — a room can be tuned in
    /// silence.
    private var settingsShelf: some View {
        VStack(alignment: .leading, spacing: 26) {
            shelfTitle("SETTINGS")
            mixStyleSetting
            VStack(alignment: .leading, spacing: 22) {
                Toggle(isOn: $player.keyLock) {
                    settingLabel("KEY LOCK", "Hold pitch steady when a seam bends the tempo to match.")
                }
                Toggle(isOn: $viz.calm) {
                    settingLabel("REDUCE FLASHING", "Tighten the luminance governor and open every set in PULSE.")
                }
                Toggle(isOn: $viz.autoRooms) {
                    settingLabel("AUTO ROOMS", "Let the director deal the field; off holds the room you last chose.")
                }
            }
            .frame(maxWidth: 860)
            Button {
                withAnimation { introSeen = false }
            } label: {
                settingLabel("WELCOME", "See the intro again.")
                    .frame(width: 500, alignment: .leading)
            }
            .buttonStyle(ShelfChipStyle())
        }
        .focusSection()
    }

    /// Auto-mix style as a row of three: name in mono, one plain line on how
    /// each seam behaves, an amber underline on the chosen voice.
    private var mixStyleSetting: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("AUTO-MIX STYLE")
                .font(.system(size: 24, weight: .semibold))
                .tracking(2)
                .foregroundStyle(Color.akInk)
            HStack(alignment: .top, spacing: 24) {
                ForEach(MixStyle.allCases, id: \.self) { style in
                    Button {
                        player.mixStyle = style
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(style.rawValue.uppercased())
                                .font(.system(size: 22, weight: .semibold, design: .monospaced))
                                .tracking(2)
                                .foregroundStyle(player.mixStyle == style ? Color.akAmber : Color.akInk)
                            Text(mixStyleDesc(style))
                                .font(.system(size: 17))
                                .foregroundStyle(.secondary)
                                .lineLimit(3)
                                .fixedSize(horizontal: false, vertical: true)
                            Capsule()
                                .fill(player.mixStyle == style ? Color.akAmber : Color.clear)
                                .frame(width: 64, height: 3)
                        }
                        .frame(width: 320, alignment: .leading)
                    }
                    .buttonStyle(ShelfChipStyle())
                }
            }
        }
    }

    private func mixStyleDesc(_ style: MixStyle) -> String {
        switch style {
        case .adaptive: return "Reads each seam — 8-beat blends with 3.0 s fades."
        case .musical:  return "Lets the song play out — no beatmix, 2.6 s fades."
        case .club:     return "Tight and relentless — 16-beat blends, 2.2 s fades."
        }
    }

    private func settingLabel(_ title: String, _ subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 24, weight: .semibold))
                .tracking(2)
                .foregroundStyle(Color.akInk)
            Text(subtitle)
                .font(.system(size: 17))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - journey

    /// The doorway to the Journey Console: one entry that opens the full-screen
    /// cartographer where FROM/TO, heat, length, faces and rituals are all turned
    /// against the same shipped solver. The button only raises the console; the
    /// console owns the deal and its own dismissal.
    private var journeyShelf: some View {
        VStack(alignment: .leading, spacing: 20) {
            shelfTitle("JOURNEY")
            Button {
                showConsole = true
            } label: {
                HStack(spacing: 22) {
                    Text("∞")
                        .font(.system(size: 46, weight: .regular, design: .serif))
                        .foregroundStyle(Color.akIce)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("OPEN THE CONSOLE")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(Color.akInk)
                        Text("Chart a path across the library — Journey, Quantum, or Memories.")
                            .font(.system(size: 19))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .frame(width: 560, alignment: .leading)
                .padding(.vertical, 8)
            }
            .buttonStyle(ShelfChipStyle())
        }
        .focusSection()
    }

    // MARK: - stage

    /// The wire, made a doorway: the TV joins a booth's four-letter code and
    /// becomes a screen for it — rendering the field locally from the booth's
    /// feature packet, on this GPU, playing no sound. Independent of the
    /// catalog, so it stands even before a library has loaded.
    private var stageShelf: some View {
        VStack(alignment: .leading, spacing: 20) {
            shelfTitle("STAGE")
            Button {
                showStage = true
            } label: {
                HStack(spacing: 22) {
                    Text("▣")
                        .font(.system(size: 42, weight: .regular))
                        .foregroundStyle(Color.akIce)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("JOIN A BOOTH")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(Color.akInk)
                        Text("Become a screen — enter a four-letter code and render the booth's field here.")
                            .font(.system(size: 19))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .frame(width: 560, alignment: .leading)
                .padding(.vertical, 8)
            }
            .buttonStyle(ShelfChipStyle())
        }
        .focusSection()
    }

    // MARK: - rituals

    private func ritualsShelf(_ catalog: Catalog) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            shelfTitle("RITUALS")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 28) {
                    ForEach(JourneyEngine.rituals) { ritual in
                        ritualChip(ritual, catalog: catalog)
                    }
                }
                .padding(.vertical, 14)
            }
        }
        .focusSection()
    }

    private func ritualChip(_ ritual: Ritual, catalog: Catalog) -> some View {
        Button {
            engageRitual(ritual, in: catalog)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(ritual.label.uppercased())
                    .font(.system(size: 28, weight: .semibold))
                    .lineLimit(1)
                Text(ritual.desc)
                    .font(.system(size: 19))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                HStack(spacing: 10) {
                    // The heat dial made visible: hotter ritual, longer ember.
                    Capsule()
                        .fill(Color.akAmber)
                        .frame(width: CGFloat(18 + ritual.heat * 64), height: 3)
                    Text("\(Int((ritual.targetSec / 60).rounded())) MIN")
                        .font(.system(size: 16, weight: .medium, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 2)
            }
            .frame(width: 330, alignment: .leading)
        }
        .buttonStyle(ShelfChipStyle())
    }

    /// A ritual is dials, pre-turned: same solver, one tap. Journey-ineligible
    /// tracks (no features) never enter the deal.
    private func engageRitual(_ ritual: Ritual, in catalog: Catalog) {
        let elig = catalog.tracks.filter { $0.features != nil }
        guard elig.count >= 2 else { return }
        let seed = UInt32.random(in: UInt32.min ... UInt32.max)
        let deal = JourneyEngine.dealJourney(
            tracks: elig,
            fromFeat: ritual.from,
            toFeat: ritual.to,
            targetSec: ritual.targetSec,
            heat: ritual.heat,
            rng: JourneyEngine.mulberry32(seed)
        )
        player.engageJourney(order: deal.order, in: catalog)
        dismissShelves()
    }

    // MARK: - albums

    private func albumsShelf(_ catalog: Catalog) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            shelfTitle("ALBUMS")
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 300, maximum: 380), spacing: 48)],
                alignment: .leading,
                spacing: 48
            ) {
                ForEach(catalog.albums) { album in
                    albumTile(album, catalog: catalog)
                }
            }
            .padding(.vertical, 14)
        }
        .focusSection()
    }

    private func albumTile(_ album: Album, catalog: Catalog) -> some View {
        Button {
            player.setQueue(album.tracks, startAt: 0, autoplay: true)
            dismissShelves()
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HomeAlbumCover(album: album, artist: catalog.artist, label: catalog.label, covers: $covers)
                Text(album.title)
                    .font(.system(size: 23, weight: .medium))
                    .lineLimit(1)
                if let year = album.year {
                    Text(String(year))
                        .font(.system(size: 17, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(.card)
    }

    // MARK: - hearts & recent

    private func heartsShelf(_ catalog: Catalog) -> some View {
        let hearted = catalog.tracks.filter { library.isHearted($0.id) }
        return Group {
            if !hearted.isEmpty {
                trackShelf(title: "HEARTS", tracks: hearted)
            }
        }
    }

    private func recentShelf(_ catalog: Catalog) -> some View {
        let recent = recentTracks(in: catalog)
        return Group {
            if !recent.isEmpty {
                trackShelf(title: "RECENT", tracks: recent)
            }
        }
    }

    private func trackShelf(title: String, tracks: [Track]) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            shelfTitle(title)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 28) {
                    ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                        trackChip(track) {
                            player.setQueue(tracks, startAt: index, autoplay: true)
                            dismissShelves()
                        }
                    }
                }
                .padding(.vertical, 14)
            }
        }
        .focusSection()
    }

    private func trackChip(_ track: Track, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    if library.isHearted(track.id) {
                        Text("♥")
                            .font(.system(size: 18))
                            .foregroundStyle(Color.akBeat)
                    }
                    Text(track.title)
                        .font(.system(size: 24, weight: .medium))
                        .lineLimit(1)
                }
                Text(track.albumTitle)
                    .font(.system(size: 18))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(width: 330, alignment: .leading)
        }
        .buttonStyle(ShelfChipStyle())
    }

    /// Newest first, one entry per track, resolved against the living catalog —
    /// history keys are hash-first so a republished file keeps its past, and
    /// keys the catalog no longer knows vanish quietly.
    private func recentTracks(in catalog: Catalog) -> [Track] {
        var seen = Set<String>()
        var out: [Track] = []
        for event in library.history.reversed() {
            guard !seen.contains(event.key) else { continue }
            seen.insert(event.key)
            guard let track = catalog.track(forKey: event.key) else { continue }
            out.append(track)
            if out.count >= 12 { break }
        }
        return out
    }

    // MARK: - shared bits

    private func shelfTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 21, weight: .semibold))
            .tracking(5)
            .foregroundStyle(Color.akDim)
    }
}

/// The shelves' one focus voice: a glass chip that answers focus the way the
/// rooms answer a beat — it lifts, an ice ring lights, and the platter warms.
/// Custom because the default tvOS platter is a near-invisible grey shift on
/// a projector wall; here focus is legible from the sofa across the room.
/// (The albums keep `.card` — a lifted sleeve is already unmistakable.)
struct ShelfChipStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        ChipBody(configuration: configuration)
    }

    private struct ChipBody: View {
        let configuration: Configuration
        @Environment(\.isFocused) private var focused

        var body: some View {
            configuration.label
                .padding(.horizontal, 30)
                .padding(.vertical, 24)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(focused ? Color.white.opacity(0.22) : Color.white.opacity(0.07))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(focused ? Color.akIce.opacity(0.9) : Color.white.opacity(0.10), lineWidth: focused ? 3 : 1)
                )
                .shadow(color: .black.opacity(focused ? 0.45 : 0), radius: 22, y: 12)
                .scaleEffect(configuration.isPressed ? 0.97 : (focused ? 1.05 : 1.0))
                .animation(.spring(response: 0.32, dampingFraction: 0.82), value: focused)
                .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
        }
    }
}

/// One sleeve per tile: the generative cover is drawn on first appearance and
/// cached by album tag in HomeView's state, so scrolling never redraws.
private struct HomeAlbumCover: View {
    let album: Album
    let artist: String
    let label: String
    @Binding var covers: [String: UIImage]

    var body: some View {
        Group {
            if let image = covers[album.tag] {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(1, contentMode: .fit)
            } else {
                ZStack {
                    Rectangle().fill(Color.akGlassHard)
                    Text(String(album.title.prefix(1)))
                        .font(.system(size: 96, weight: .medium, design: .serif))
                        .italic()
                        .foregroundStyle(Color.akDim)
                }
                .aspectRatio(1, contentMode: .fit)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .onAppear {
            guard covers[album.tag] == nil else { return }
            // Deterministic sleeve: same album, same face — draw once, keep.
            let image = album.tracks.isEmpty
                ? CoverArt.monogram(title: album.title, size: 400)
                : CoverArt.draw(album: album, artist: artist, label: label, size: 400)
            covers[album.tag] = image
        }
    }
}

// Identity tokens (DESIGN §2) — void ground, ink, dim, the two axes, the beat.
private extension Color {
    static let akVoid = Color(red: 5 / 255, green: 6 / 255, blue: 14 / 255)
    static let akInk = Color(red: 233 / 255, green: 237 / 255, blue: 246 / 255)
    static let akDim = Color(red: 154 / 255, green: 165 / 255, blue: 188 / 255)
    static let akAmber = Color(red: 255 / 255, green: 180 / 255, blue: 84 / 255)
    static let akIce = Color(red: 110 / 255, green: 231 / 255, blue: 255 / 255)
    static let akBeat = Color(red: 255 / 255, green: 92 / 255, blue: 135 / 255)
    static let akGlassHard = Color(red: 10 / 255, green: 13 / 255, blue: 24 / 255).opacity(0.72)
}
