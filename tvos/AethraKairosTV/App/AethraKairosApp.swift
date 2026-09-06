import SwiftUI
import UIKit

/// The boot order is law: the Library remembers before anything plays, the
/// Player is born holding the Library, and the NowPlayingCenter is created
/// exactly once — remote-command targets must never be registered twice.
@main
struct AethraKairosApp: App {
    @StateObject private var library: Library
    @StateObject private var player: Player
    @StateObject private var catalogStore: CatalogStore

    /// The TV's twin of the shell's media_update bridge. Created once with the
    /// app and retained for its whole life.
    private let nowPlaying: NowPlayingCenter

    init() {
        let library = Library()
        let player = Player(library: library)
        _library = StateObject(wrappedValue: library)
        _player = StateObject(wrappedValue: player)
        _catalogStore = StateObject(wrappedValue: CatalogStore())
        nowPlaying = NowPlayingCenter(player: player)
    }

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(catalogStore)
                .environmentObject(library)
                .environmentObject(player)
                // Dark by decree — the void ground is the product, not a theme.
                .preferredColorScheme(.dark)
                .task {
                    await catalogStore.load()
                }
                .onChange(of: catalogStore.catalog) { _, newCatalog in
                    // The catalog is the API: the moment it lands (or refreshes)
                    // the player gets its context and the resume flow begins.
                    if let catalog = newCatalog {
                        player.attach(catalog: catalog)
                    }
                }
                .onChange(of: player.current) { _, track in
                    // Metadata pushes only on track change — decimated by design;
                    // the album resolves through the living catalog by tag.
                    nowPlaying.trackDidChange(track, album: album(for: track))
                }
                .onChange(of: player.isPlaying) { _, playing in
                    nowPlaying.playbackStateDidChange(
                        playing: playing,
                        position: player.position,
                        duration: player.current?.duration,
                        rate: playing ? 1.0 : 0.0
                    )
                    // The keep_awake twin: while music plays the screen belongs
                    // to the field; the idle timer gets it back on pause.
                    UIApplication.shared.isIdleTimerDisabled = playing
                }
        }
    }

    /// Album lookup by tag — the track only carries the tag, the catalog owns
    /// the album truth (art, year, info).
    private func album(for track: Track?) -> Album? {
        guard let track, let catalog = catalogStore.catalog else { return nil }
        return catalog.albums.first { $0.tag == track.albumTag }
    }
}
