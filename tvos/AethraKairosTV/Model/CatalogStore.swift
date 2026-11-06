import Foundation
import Combine

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
        statusLine = "Tuning the library…"
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

        /* THE PARSE IS NOT MAIN-THREAD WORK. catalog.json is ~5 MB — 267
           tracks, each with mix + env + stems digit strings decoded one
           Double per character — and this class is main-actor. Parsed here
           it froze the whole UI (focus engine included) for up to a second
           and a half at launch and again when the network copy landed, on
           top of the first Metal pipeline compile. CatalogParser is a pure
           enum and Catalog a value type, so both bodies parse on a detached
           task and only the result crosses back. */
        let url = Self.defaultURL
        let fileURL = cacheFileURL

        // 1) the cached copy is the instant boot — parsed with the same strict
        //    rules as a fresh one (a corrupt cache is a missing cache)
        if catalog == nil {
            let cached: Catalog? = await Task.detached(priority: .userInitiated) { () -> Catalog? in
                guard let data = try? Data(contentsOf: fileURL) else { return nil }
                return try? CatalogParser.parse(data, catalogURL: url)
            }.value
            if let cached {
                catalog = cached
                statusLine = "\(cached.tracks.count) songs — checking for new music…"
            } else {
                statusLine = "Tuning the library…"
            }
        }

        // 2) revalidate — conditionally, as the web's fetch(url, { cache:
        //    'no-cache' }) does: the cached copy's ETag rides along, and an
        //    unchanged catalog comes back as a 304 with no body instead of the
        //    whole ~5 MB on every launch. The ETag is only sent while a cached
        //    copy actually parsed (it describes that file).
        let etagKey = "catalog.etag"
        do {
            var request = URLRequest(url: url)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.timeoutInterval = 30
            if catalog != nil, let etag = UserDefaults.standard.string(forKey: etagKey) {
                request.setValue(etag, forHTTPHeaderField: "If-None-Match")
            }
            let (data, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode == 304, let current = catalog {
                let label = current.label.isEmpty ? "catalog" : current.label
                statusLine = "\(current.tracks.count) songs · up to date with \(label)"
                return
            }
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                throw CatalogError.malformed("HTTP \(http.statusCode)")
            }
            let freshETag = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "ETag")
            let fresh: Catalog = try await Task.detached(priority: .userInitiated) { () throws -> Catalog in
                let parsed = try CatalogParser.parse(data, catalogURL: url)
                // only a catalog that PARSED may touch the cache — a bad deploy
                // must not poison the next offline boot
                try? data.write(to: fileURL, options: .atomic)
                return parsed
            }.value
            catalog = fresh
            if let freshETag { UserDefaults.standard.set(freshETag, forKey: etagKey) }
            else { UserDefaults.standard.removeObject(forKey: etagKey) }
            let label = fresh.label.isEmpty ? "catalog" : fresh.label
            statusLine = fresh.albums.count == 1
                ? "Loaded \(fresh.tracks.count) tracks · 1 album from \(label)"
                : "Loaded \(fresh.tracks.count) tracks · \(fresh.albums.count) albums from \(label)"
        } catch {
            // the technical reason is for the log; the room gets plain words
            let message = (error as? CatalogError)?.errorDescription
                ?? (error as NSError).localizedDescription
            NSLog("AethraKairos: catalog refresh failed — %@", message)
            if let current = catalog {
                // the iron rule: stale beats blank
                statusLine = "\(current.tracks.count) songs — couldn't check for new music right now"
            } else {
                statusLine = "Couldn't reach the music library. Check the Apple TV's internet connection and try again."
            }
        }
    }
}
