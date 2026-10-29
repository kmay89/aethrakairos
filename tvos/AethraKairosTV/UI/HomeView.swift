import SwiftUI
import UIKit

/// The 10-foot flow: the field is the app. The visualizer runs full-bleed at
/// the root, the zen HUD floats over it, and the shelves are a frosted overlay
/// that appears on Menu and retreats the moment a choice is made — browsing is
/// an interruption of the field, never the other way around.
struct HomeView: View {
    @EnvironmentObject var catalogStore: CatalogStore
    @EnvironmentObject var library: Library
    /// Held, NOT observed. The Player publishes its position four times a
    /// second, and a HomeView that observed it re-diffed every shelf (all
    /// 267 sleeves) on every tick. The few views that show live transport
    /// state observe it themselves: the billboard, the dials, the HUD, the
    /// field.
    let player: Player

    // The renderer's settings, observed so the SETTINGS toggles both write and
    // reflect the live state — the shared instance the field reads each frame.
    @ObservedObject private var viz = VizSettings.shared

    // The scene's own word on whether anyone is looking: the field pauses
    // outside .active, and coming back asks again for a library that never came.
    @Environment(\.scenePhase) private var scenePhase

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
    // PLAY was pressed before the library arrived: the nonstop mix starts the
    // moment the catalog lands, instead of the press being lost.
    @State private var playWhenReady = false

    // The welcome's entrance: false until it first appears, then each line
    // rises in on its own beat (see Stagecraft's entrance).
    @State private var entered = false

    // CI's camera: `--field` boots straight onto the field (no shelves), so
    // the simulator smoke job can photograph a live room. Combined with
    // `-introSeen YES` (read natively by @AppStorage) and `--start-room` in
    // the renderer. Never set by the app itself.
    init(player: Player) {
        self.player = player
        _shelvesShown = State(initialValue: !ProcessInfo.processInfo.arguments.contains("--field"))
    }

    var body: some View {
        ZStack {
            Color.akVoid.ignoresSafeArea()
            // Paused while the app is not the active scene (no GPU work from
            // the background) and under the console and the stage, which are
            // opaque covers — the stage would otherwise share the GPU with a
            // hidden field drawing the same rooms.
            // Under the welcome and the shelves the field runs at 30 fps: it is
            // dimmed backdrop there, and the GPU it frees keeps the glass and
            // every focus animation over it at a full 60.
            VisualizerView(player: player, roomStep: roomStep, roomName: $roomName,
                           paused: scenePhase != .active || showConsole || showStage,
                           lowPower: !introSeen || shelvesShown)
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
        .onChange(of: catalogStore.catalog) { _, catalog in
            // a PLAY that was waiting on the library plays now
            guard playWhenReady, let catalog else { return }
            playWhenReady = false
            startNonstop(in: catalog)
        }
        .onChange(of: scenePhase) { _, phase in
            // tvOS keeps a suspended app for days, so an offline first launch
            // stayed "Catalog failed" until a force-quit: the boot .task never
            // runs again. Coming back to the app asks again (load() refuses
            // to overlap itself, and never blanks a library it already has).
            if phase == .active, catalogStore.catalog == nil {
                Task { await catalogStore.load() }
            }
        }
    }

    // MARK: - shelves

    private var shelvesOverlay: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 52) {
                wordmarkHeader
                if let catalog = catalogStore.catalog {
                    FrontDoorRow(player: player, catalog: catalog, roomName: roomName,
                                 onPrimary: { frontDoorPrimary(catalog) },
                                 onNewMix: {
                                     player.playEverything(in: catalog)
                                     dismissShelves()
                                 })
                    journeyShelf
                    ritualsShelf(catalog)
                    albumsShelf(catalog)
                    heartsShelf(catalog)
                    recentShelf(catalog)
                    stageShelf
                    settingsShelf
                } else if bootGraceOver {
                    // the library never came — it can be asked for again
                    // without leaving the app, and the room can still be tuned
                    retryShelf
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
        /* NO MENU HANDLER HERE, ON PURPOSE. The shelves are the app's root, and
           Menu at an app's root belongs to tvOS: it goes to the Home Screen
           (App Review requires exactly that). It used to return to the field
           instead, and the field's Menu raised the shelves — a loop with no
           exit, so the only way out of the app was the TV button. The way back
           to the field is now a real control: BACK TO THE FIELD, in the NOW
           row, and choosing anything to play retreats the shelves as before. */
        // The transport key works everywhere: with the field's layer out of
        // the hierarchy while browsing, play/pause is answered here instead.
        .onPlayPauseCommand {
            activity += 1
            if player.current == nil, let catalog = catalogStore.catalog {
                startNonstop(in: catalog)      // nothing queued yet: the key means PLAY
            } else {
                player.toggle()
            }
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

    /// The welcome, built around ONE press, and staged like a title card: the
    /// live light show glows through on the right, the words sit on the dark
    /// side of the scrim, and each line rises in on its own beat. PLAY is the
    /// first control and so the one focus lands on: click it (or the remote's
    /// play/pause key) and the whole library starts as a nonstop mix, straight
    /// onto the field. BROWSE opens the shelves. Menu skips to the shelves,
    /// SETTINGS can replay it, and it never interrupts twice.
    private var introOverlay: some View {
        ZStack(alignment: .leading) {
            // light on the open side before a note has played
            AuroraGlow()
            // the scrim: dark where the words are, open where the light is
            LinearGradient(stops: [
                .init(color: Color.akVoid.opacity(0.96), location: 0),
                .init(color: Color.akVoid.opacity(0.82), location: 0.34),
                .init(color: Color.akVoid.opacity(0.18), location: 0.70),
                .init(color: Color.akVoid.opacity(0), location: 1),
            ], startPoint: .leading, endPoint: .trailing)
            .ignoresSafeArea()
            LinearGradient(colors: [.clear, Color.akVoid.opacity(0.88)],
                           startPoint: .center, endPoint: .bottom)
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)
                Text("∞   NONSTOP MUSIC  ·  MOVING LIGHT")
                    .font(.system(size: 21, weight: .bold, design: .monospaced))
                    .tracking(7)
                    .foregroundStyle(Color.akIce)
                    .entrance(entered, delay: 0.1)
                Text("Aethra Kairos")
                    .font(.system(size: 128, weight: .medium, design: .serif))
                    .italic()
                    .foregroundStyle(Color.akInk)
                    .shadow(color: Color.akIce.opacity(0.35), radius: 34)
                    .padding(.top, 8)
                    .entrance(entered, delay: 0.25)
                Text("Music and moving art for your TV.")
                    .font(.system(size: 36, design: .serif))
                    .italic()
                    .foregroundStyle(Color.akDim)
                    .entrance(entered, delay: 0.45)

                HStack(alignment: .center, spacing: 36) {
                    Button {
                        startFromWelcome()
                    } label: {
                        HeroLabel(symbol: "play.fill", title: "PLAY",
                                  line: "One click. Music and light, nonstop.")
                    }
                    .buttonStyle(HeroButtonStyle())

                    Button {
                        withAnimation { introSeen = true }
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("BROWSE")
                                .font(.system(size: 26, weight: .semibold))
                                .tracking(4)
                                .foregroundStyle(Color.akInk)
                            Text("Albums, moods, journeys.")
                                .font(.system(size: 18))
                                .foregroundStyle(Color.akDim)
                        }
                    }
                    .buttonStyle(ShelfChipStyle())
                }
                .padding(.top, 64)
                .entrance(entered, delay: 0.7)

                if playWhenReady {
                    // the press was heard; the library is still on its way
                    Text(catalogStore.statusLine.isEmpty ? "Tuning the library…" : catalogStore.statusLine)
                        .font(.system(size: 19, design: .monospaced))
                        .foregroundStyle(Color.akDim)
                        .padding(.top, 22)
                }

                Spacer(minLength: 40)

                HStack(alignment: .top, spacing: 52) {
                    introFact("∞", "NONSTOP MUSIC",
                              "Original songs, blended like a DJ who never takes a break.")
                    introFact("✦", "125 LIGHT SHOWS",
                              "Oceans, lightning, galaxies — every one dances to the beat.")
                    introFact("◈", "A MIX FOR EVERY MOOD",
                              "Working out, dinner, focus or bedtime — all in BROWSE.")
                    introFact("♥", "FREE FOR EVERYONE",
                              "No account, no ads, no cost. Nothing is tracked or shared.")
                }
                .entrance(entered, delay: 1.0)

                Text("CLICK = PLAY / PAUSE      SWIPE ↑ ↓ = CHANGE THE PICTURE      MENU = BROWSE")
                    .font(.system(size: 16, weight: .semibold, design: .monospaced))
                    .tracking(3)
                    .foregroundStyle(Color.akDim.opacity(0.8))
                    .padding(.top, 36)
                    .entrance(entered, delay: 1.2)
            }
            .padding(.horizontal, 100)
            .padding(.vertical, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .onAppear { entered = true }
        // the remote's play/pause key is PLAY here too
        .onPlayPauseCommand { startFromWelcome() }
        .onExitCommand { withAnimation { introSeen = true } }
    }

    private func introFact(_ glyph: String, _ title: String, _ line: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(glyph)
                .font(.system(size: 30))
                .foregroundStyle(Color.akIce)
            Text(title)
                .font(.system(size: 20, weight: .semibold))
                .tracking(3)
                .foregroundStyle(Color.akInk)
            Text(line)
                .font(.system(size: 18))
                .foregroundStyle(Color.akDim)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(width: 330, alignment: .leading)
    }

    /// The welcome's PLAY: the nonstop mix (or the session already on the
    /// deck), straight onto the field. Before the library has landed the
    /// press is held, not dropped — see playWhenReady.
    private func startFromWelcome() {
        guard let catalog = catalogStore.catalog else {
            playWhenReady = true
            return
        }
        startNonstop(in: catalog)
    }

    /// One press, music: resume what is on the deck if something is, else
    /// deal the whole library as the nonstop mix — then give the screen to
    /// the field.
    private func startNonstop(in catalog: Catalog) {
        withAnimation { introSeen = true }
        if player.current == nil {
            player.playEverything(in: catalog)
        } else if !player.isPlaying {
            player.play()
        }
        dismissShelves()
    }

    /// The billboard's one button: PLAY (the nonstop mix), RESUME, or back to
    /// the field — whichever the moment calls for.
    private func frontDoorPrimary(_ catalog: Catalog) {
        if player.current == nil {
            startNonstop(in: catalog)
        } else {
            if !player.isPlaying { player.play() }
            dismissShelves()
        }
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

    // MARK: - settings

    /// The four dials, always reachable from the shelves. The mix style writes
    /// to the player; the two flags write to the shared visual settings the
    /// renderer reads. Nothing here needs a catalog — a room can be tuned in
    /// silence.
    private var settingsShelf: some View {
        VStack(alignment: .leading, spacing: 26) {
            shelfTitle("SETTINGS")
            PlayerDials(player: player)
            VStack(alignment: .leading, spacing: 22) {
                Toggle(isOn: $viz.calm) {
                    settingLabel("REDUCE FLASHING", "Tighten the luminance governor and open every set in PULSE.")
                }
                Toggle(isOn: $viz.autoRooms) {
                    settingLabel("AUTO ROOMS", "Let the director deal the field; off holds the room you last chose.")
                }
                Toggle(isOn: $viz.lensAuto) {
                    settingLabel("LENS", "Let the song put glass over the field at its peaks; off keeps the glass always clean.")
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

    // MARK: - the library, asked for again

    /// The way out of an offline first launch: one press asks for the catalog
    /// again (the wordmark's status line reports how it went). Shown only
    /// while there is no library at all.
    private var retryShelf: some View {
        VStack(alignment: .leading, spacing: 20) {
            shelfTitle("LIBRARY")
            Button {
                Task { await catalogStore.load() }
            } label: {
                settingLabel("TRY AGAIN", "The library hasn't arrived — check the connection, then ask for it once more.")
                    .frame(width: 560, alignment: .leading)
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
                // identity by position: the parser keeps whatever the catalog
                // ships, and two albums under one tag would be two views with
                // one id — undefined results on tvOS, not a warning
                ForEach(Array(catalog.albums.enumerated()), id: \.offset) { _, album in
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
                AlbumSleeve(album: album, artist: catalog.artist, label: catalog.label)
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
                    // identity by position, as the albums: a track listed twice
                    // (one file, two shelves) is two chips, never one id twice
                    ForEach(Array(tracks.enumerated()), id: \.offset) { index, track in
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
        var shown = Set<String>()
        var out: [Track] = []
        for event in library.history.reversed() {
            guard !seen.contains(event.key) else { continue }
            seen.insert(event.key)
            guard let track = catalog.track(forKey: event.key) else { continue }
            // one track, one tile — counted in its OWN set: `seen` already
            // holds event.key, and track(forKey:) only answers a track whose
            // id IS that key, so asking `seen` would refuse every track and
            // empty the shelf
            guard shown.insert(track.id).inserted else { continue }
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
