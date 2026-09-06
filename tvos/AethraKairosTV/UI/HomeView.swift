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

    // Shelves open at boot: nothing plays until a ritual or album is chosen.
    @State private var shelvesShown = true
    @State private var roomStep = 0
    @State private var roomName = ""
    @State private var activity = 0
    @State private var hudVisible = true

    // Generative sleeves drawn once per album tag, kept for the app's life so
    // the grid scrolls without redrawing 5200 grain dots per tile.
    @State private var covers: [String: UIImage] = [:]

    var body: some View {
        ZStack {
            Color.akVoid.ignoresSafeArea()
            VisualizerView(player: player, roomStep: roomStep, roomName: $roomName)
                .ignoresSafeArea()
            NowPlayingHUD(player: player, roomName: roomName, visible: hudVisible && !shelvesShown)
            if shelvesShown {
                shelvesOverlay
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: shelvesShown)
        .remoteControls(player: player, roomStep: $roomStep, shelvesShown: $shelvesShown, activity: $activity)
        .zenLadder(player: player, activity: activity, hudVisible: $hudVisible)
    }

    // MARK: - shelves

    private var shelvesOverlay: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 52) {
                wordmarkHeader
                if let catalog = catalogStore.catalog {
                    ritualsShelf(catalog)
                    albumsShelf(catalog)
                    heartsShelf(catalog)
                    recentShelf(catalog)
                }
            }
            .padding(.horizontal, 80)
            .padding(.vertical, 60)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        // Frosted glass over the dimmed field — the field never stops, it only
        // steps back while a choice is made.
        .background(.ultraThinMaterial)
        .background(Color.akVoid.opacity(0.55).ignoresSafeArea())
        .onExitCommand { dismissShelves() }
    }

    private func dismissShelves() {
        shelvesShown = false
        activity += 1
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
