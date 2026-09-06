import Foundation
import Combine

/* ================================================================
   LIBRARY — everything the listener owns about their listening.

   The web player keeps seven IndexedDB stores; the TV keeps the ones
   that matter here as small JSON files under Application Support.
   Everything durable is keyed by trackKey (sha256-first, url-fallback)
   so a republished file keeps its hearts and history. tvOS persistent
   quota is tiny, so state stays compact: history capped at 400 events
   (oldest dropped), atomic writes only, transport saves throttled to
   one per second. Nothing ever transmits off-device.
   ================================================================ */

struct PlayEvent: Codable, Equatable {
    var key: String; var startedAt: Date; var playedSeconds: Double; var completed: Bool
}

struct TransportSnapshot: Codable, Equatable {
    var queueKeys: [String]
    var currentKey: String?
    var position: Double
    var shuffle: Bool
}

struct SavedJourney: Codable, Equatable, Identifiable {
    var id: String { name }
    var name: String
    var savedAt: Date
    var ritualKey: String?
    var heat: Double
    var targetSec: Double
    var seed: UInt32
    var orderKeys: [String]
}

/// Everything durable is keyed by trackKey (sha256-first, url-fallback) so a
/// republished file keeps its history. tvOS persistent quota is tiny, so state
/// stays compact: JSON files in Application Support, mirrored nowhere else.
/// History capped at 400 events (oldest dropped).
@MainActor final class Library: ObservableObject {
    @Published private(set) var hearts: Set<String> = []
    @Published private(set) var history: [PlayEvent] = []
    @Published private(set) var journeys: [SavedJourney] = []

    private static let historyCap = 400
    private static let transportThrottle: TimeInterval = 1.0

    private let dirURL: URL
    private var heartsURL: URL { dirURL.appendingPathComponent("hearts.json") }
    private var historyURL: URL { dirURL.appendingPathComponent("history.json") }
    private var journeysURL: URL { dirURL.appendingPathComponent("journeys.json") }
    private var transportURL: URL { dirURL.appendingPathComponent("transport.json") }

    // transport throttle state: the LAST snapshot always lands, just not
    // more than once a second
    private var pendingTransport: TransportSnapshot?
    private var lastTransportWrite: Date = .distantPast
    private var transportFlushScheduled = false

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .secondsSince1970
        return e
    }()
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .secondsSince1970
        return d
    }()

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        dirURL = base.appendingPathComponent("AethraKairos", isDirectory: true)
        try? FileManager.default.createDirectory(at: dirURL, withIntermediateDirectories: true)
        // a missing or corrupt file is an empty file — the library never
        // refuses to boot over its own bookkeeping
        hearts = Self.read(Set<String>.self, from: heartsURL) ?? []
        history = Self.read([PlayEvent].self, from: historyURL) ?? []
        journeys = Self.read([SavedJourney].self, from: journeysURL) ?? []
        if history.count > Self.historyCap {
            history.removeFirst(history.count - Self.historyCap)
        }
    }

    // MARK: - hearts

    func toggleHeart(_ key: String) {
        guard !key.isEmpty else { return }
        if hearts.contains(key) { hearts.remove(key) } else { hearts.insert(key) }
        write(hearts, to: heartsURL)
    }

    func isHearted(_ key: String) -> Bool { hearts.contains(key) }

    // MARK: - history

    /// The web verdict verbatim: counts when playedSeconds >= 60 or >= 50% of a
    /// known duration; < 2 s touches are discarded entirely.
    func recordPlay(key: String, playedSeconds: Double, duration: Double?, completed: Bool) {
        guard !key.isEmpty else { return }
        guard playedSeconds >= 2 else { return }     // sub-2 s touches are noise, not listens
        let d = duration ?? 0
        // the caller's "it finished" can only confirm — when duration is known
        // the 50% rule already covers a natural end
        let verdict = playedSeconds >= 60 || (d > 0 && playedSeconds >= d * 0.5) || completed
        let event = PlayEvent(key: key,
                              startedAt: Date(timeIntervalSinceNow: -playedSeconds),
                              playedSeconds: playedSeconds.rounded(),
                              completed: verdict)
        history.append(event)
        if history.count > Self.historyCap {         // oldest events pay for the quota
            history.removeFirst(history.count - Self.historyCap)
        }
        write(history, to: historyURL)
    }

    func playCount(forKey key: String) -> Int {
        // only completed verdicts count as listens — same as the web's
        // type === 'play' filter
        history.reduce(0) { $0 + (($1.key == key && $1.completed) ? 1 : 0) }
    }

    // MARK: - journeys

    func saveJourney(_ j: SavedJourney) {
        if let i = journeys.firstIndex(where: { $0.name == j.name }) {
            journeys[i] = j                          // name is identity — saving again replaces
        } else {
            journeys.append(j)
        }
        write(journeys, to: journeysURL)
    }

    func deleteJourney(named name: String) {
        journeys.removeAll { $0.name == name }
        write(journeys, to: journeysURL)
    }

    // MARK: - transport (resume-where-you-left-off)

    /// Throttled internally: writes land at most once per second, but the
    /// latest snapshot is never dropped — a trailing flush catches it.
    func saveTransport(_ s: TransportSnapshot) {
        pendingTransport = s
        let elapsed = Date().timeIntervalSince(lastTransportWrite)
        if elapsed >= Self.transportThrottle {
            flushTransport()
            return
        }
        guard !transportFlushScheduled else { return }
        transportFlushScheduled = true
        let wait = max(0.05, Self.transportThrottle - elapsed)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            guard let self else { return }
            self.transportFlushScheduled = false
            self.flushTransport()
        }
    }

    func loadTransport() -> TransportSnapshot? {
        // an unflushed snapshot is fresher than anything on disk
        if let pending = pendingTransport { return pending }
        return Self.read(TransportSnapshot.self, from: transportURL)
    }

    private func flushTransport() {
        guard let snapshot = pendingTransport else { return }
        pendingTransport = nil
        lastTransportWrite = Date()
        write(snapshot, to: transportURL)
    }

    // MARK: - disk

    private static func read<T: Decodable>(_ type: T.Type, from url: URL) -> T? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    private func write<T: Encodable>(_ value: T, to url: URL) {
        // atomic or nothing: a torn file would be worse than a stale one
        guard let data = try? Self.encoder.encode(value) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
