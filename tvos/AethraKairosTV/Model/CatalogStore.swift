import Foundation

/* ================================================================
   CATALOG STORE — stale-while-revalidate, the native way.

   The web shell keeps catalog.json in an unversioned service-worker
   cache that survives updates; here the same law is a file in
   Caches/catalog.json. Boot serves the cached copy instantly, then
   refreshes from the network in the same breath. The one iron rule:
   a failed refresh NEVER blanks a loaded library — a living room
   with no internet still has its music on screen.
   ================================================================ */

@MainActor final class CatalogStore: ObservableObject {
    @Published private(set) var catalog: Catalog?
    @Published private(set) var statusLine: String

    static let defaultURL = URL(string: "https://aethrakairos.com/catalog.json")!

    private let cacheFileURL: URL
    private var loading = false

    init() {
        statusLine = "catalog · not yet loaded"
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        cacheFileURL = caches.appendingPathComponent("catalog.json")
    }

    /// Boot from the cached copy instantly if present, then refresh from network
    /// (stale-while-revalidate: a failed refresh NEVER blanks a loaded library).
    /// Cache lives in Caches/catalog.json.
    func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }

        // 1) the cached copy is the instant boot — parsed with the same strict
        //    rules as a fresh one (a corrupt cache is a missing cache)
        if catalog == nil, let cachedData = try? Data(contentsOf: cacheFileURL),
           let cached = try? CatalogParser.parse(cachedData, catalogURL: Self.defaultURL) {
            catalog = cached
            statusLine = "\(cached.tracks.count) tracks (cached) — refreshing…"
        } else if catalog == nil {
            statusLine = "loading catalog…"
        }

        // 2) revalidate — bypass every intermediate cache, same as the web's
        //    fetch(url, { cache: 'no-cache' })
        do {
            var request = URLRequest(url: Self.defaultURL)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.timeoutInterval = 30
            let (data, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                throw CatalogError.malformed("HTTP \(http.statusCode)")
            }
            let fresh = try CatalogParser.parse(data, catalogURL: Self.defaultURL)

            // only a catalog that PARSED may touch the cache — a bad deploy
            // must not poison the next offline boot
            try? data.write(to: cacheFileURL, options: .atomic)
            catalog = fresh
            let label = fresh.label.isEmpty ? "catalog" : fresh.label
            statusLine = fresh.albums.count == 1
                ? "Loaded \(fresh.tracks.count) tracks · 1 album from \(label)"
                : "Loaded \(fresh.tracks.count) tracks · \(fresh.albums.count) albums from \(label)"
        } catch {
            let message = (error as? CatalogError)?.errorDescription
                ?? (error as NSError).localizedDescription
            if catalog != nil {
                // the iron rule: stale beats blank
                statusLine = "refresh failed: \(message) — keeping the cached catalog"
            } else {
                statusLine = "Catalog failed: \(message)"
            }
        }
    }
}
