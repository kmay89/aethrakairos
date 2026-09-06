import Foundation
import CryptoKit

/// Downloads a track's MP3 into Caches/audio, verifies against the catalog
/// sha256 when present (CryptoKit; mismatch = .integrity error and the file is
/// deleted), keeps an LRU cap of 600 MB. Progressive start is not attempted —
/// tracks are a few MB on living-room ethernet; the Player prefetches next.
final class TrackLoader {

    enum LoaderError: Error { case http(Int), integrity, cancelled, network(Error) }

    // The cache is keyed by trackKey material: the catalog sha256 when the
    // publisher committed to one, else a hash of the URL — a republished file
    // with the same bytes keeps its cache slot.
    private static let capBytes = 600 * 1024 * 1024

    private let directory: URL
    private let lock = NSLock()
    private var inflight: [String: Entry] = [:]
    private var prefetchTasks: [String: Task<Void, Never>] = [:]

    private struct Entry {
        var task: Task<URL, Error>
        // How many foreground callers are waiting. A download with zero
        // foreground interest is a pure warm and may be cancelled wholesale.
        var foreground: Int
    }

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        directory = caches.appendingPathComponent("audio", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    /// Every critical section is synchronous and never spans an await; this
    /// helper is the proof the compiler can read (NSLock.lock is refused
    /// directly inside async contexts).
    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock()
        defer { lock.unlock() }
        return body()
    }

    /// Returns the local file URL, downloading if needed. Safe to call
    /// concurrently for the same track (in-flight requests are coalesced).
    func localFile(for track: Track) async throws -> URL {
        let key = Self.cacheKey(for: track)
        let task = obtainTask(for: track, key: key, foreground: true)
        defer {
            withLock {
                if var e = inflight[key], e.foreground > 0 {
                    e.foreground -= 1
                    inflight[key] = e
                }
            }
        }
        do {
            return try await task.value
        } catch let e as LoaderError {
            throw e
        } catch is CancellationError {
            throw LoaderError.cancelled
        } catch let e as URLError where e.code == .cancelled {
            throw LoaderError.cancelled
        } catch {
            throw LoaderError.network(error)
        }
    }

    /// Fire-and-forget warm. Errors are swallowed: a failed prefetch just
    /// means the foreground path pays full price later.
    func prefetch(_ track: Track) {
        let key = Self.cacheKey(for: track)
        lock.lock()
        let alreadyWarming = prefetchTasks[key] != nil
        lock.unlock()
        if alreadyWarming { return }

        let task = obtainTask(for: track, key: key, foreground: false)
        let wrapper = Task { [weak self] in
            _ = try? await task.value
            guard let self else { return }
            self.withLock { self.prefetchTasks[key] = nil }
        }
        lock.lock()
        prefetchTasks[key] = wrapper
        lock.unlock()
    }

    /// Cancels every warm that no foreground caller is waiting on. A download
    /// a listener actually needs is never killed by housekeeping.
    func cancelPrefetches() {
        lock.lock()
        let wrappers = prefetchTasks
        prefetchTasks.removeAll()
        for (key, _) in wrappers {
            if let e = inflight[key], e.foreground == 0 {
                e.task.cancel()
                inflight[key] = nil
            }
        }
        lock.unlock()
        for (_, w) in wrappers { w.cancel() }
    }

    // MARK: - Coalescing

    private func obtainTask(for track: Track, key: String, foreground: Bool) -> Task<URL, Error> {
        lock.lock()
        if var e = inflight[key] {
            if foreground {
                e.foreground += 1
                inflight[key] = e
            }
            lock.unlock()
            return e.task
        }
        let task = Task<URL, Error>(priority: foreground ? .userInitiated : .utility) { [weak self] in
            guard let self else { throw LoaderError.cancelled }
            defer {
                self.withLock { self.inflight[key] = nil }
            }
            return try await self.fetch(track: track, key: key)
        }
        inflight[key] = Entry(task: task, foreground: foreground ? 1 : 0)
        lock.unlock()
        return task
    }

    // MARK: - Fetch + verify + evict

    private func fetch(track: Track, key: String) async throws -> URL {
        let dest = directory.appendingPathComponent(key + ".mp3")
        let fm = FileManager.default

        if fm.fileExists(atPath: dest.path) {
            // LRU is by access: a cache hit renews the file's lease.
            touch(dest)
            return dest
        }

        try Task.checkCancellation()
        let (tmp, response) = try await URLSession.shared.download(from: track.url)

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            try? fm.removeItem(at: tmp)
            throw LoaderError.http(http.statusCode)
        }

        // The catalog's sha256 is a promise about bytes, not a suggestion:
        // a mismatch deletes the download and refuses to serve it.
        if let expected = track.sha256, !expected.isEmpty {
            let data = try Data(contentsOf: tmp, options: .mappedIfSafe)
            let actual = Self.hex(SHA256.hash(data: data))
            guard actual.caseInsensitiveCompare(expected) == .orderedSame else {
                try? fm.removeItem(at: tmp)
                throw LoaderError.integrity
            }
        }

        try? fm.removeItem(at: dest)
        do {
            try fm.moveItem(at: tmp, to: dest)
        } catch {
            try? fm.removeItem(at: tmp)
            throw LoaderError.network(error)
        }
        touch(dest)
        evictIfNeeded(keeping: dest)
        return dest
    }

    /// LRU over the whole audio cache: oldest access date goes first, the file
    /// just delivered is never evicted by its own arrival.
    private func evictIfNeeded(keeping: URL) {
        let fm = FileManager.default
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey]
        guard let items = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: keys,
                                                      options: [.skipsHiddenFiles]) else { return }
        var entries: [(url: URL, date: Date, size: Int)] = []
        var total = 0
        for url in items {
            guard let values = try? url.resourceValues(forKeys: Set(keys)),
                  values.isRegularFile == true else { continue }
            let size = values.fileSize ?? 0
            let date = values.contentModificationDate ?? .distantPast
            entries.append((url, date, size))
            total += size
        }
        guard total > Self.capBytes else { return }
        entries.sort { $0.date < $1.date }
        for entry in entries {
            if total <= Self.capBytes { break }
            if entry.url.lastPathComponent == keeping.lastPathComponent { continue }
            if (try? fm.removeItem(at: entry.url)) != nil {
                total -= entry.size
            }
        }
    }

    private func touch(_ url: URL) {
        try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
    }

    private static func cacheKey(for track: Track) -> String {
        if let sha = track.sha256, !sha.isEmpty {
            return sha.lowercased()
        }
        return hex(SHA256.hash(data: Data(track.url.absoluteString.utf8)))
    }

    private static func hex(_ digest: SHA256.Digest) -> String {
        digest.map { String(format: "%02x", $0) }.joined()
    }
}
