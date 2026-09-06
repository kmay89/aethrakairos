import Foundation

/* ================================================================
   CATALOG — the ERRERlabs / Aethra Kairos manifest, schema v2 only.

   This is the tvOS twin of the web player's catalog loader
   (docs/index.html §6a, ~9285-9432). One schema, one parser, no
   guessing: a v1 flat catalog is refused with the same words the web
   uses, and everything below the version gate degrades per-field —
   a track missing features is journey-ineligible, not broken; a mix
   without a positive bpm is no mix at all; an env without a bass
   string is no score. The only per-track requirement is a place the
   audio lives (file / src / absolute url) — anything without one is
   skipped silently, exactly like the web.
   ================================================================ */

struct Features: Codable, Equatable {
    var bpm: Double        // 0 = unpitched wildcard
    var energy: Double
    var brightness: Double
    var entropy: Double
    var onsets: Double
}

struct MixRegion: Codable, Equatable { var start: Double; var beats: Double }

struct MixInfo: Codable, Equatable {
    var bpm: Double            // > 0 guaranteed by parser
    var grid: Double           // seconds of first downbeat
    var key: String?           // Camelot "7B"
    var keyConf: Double
    var phrases: Double        // beats per phrase (default 32)
    var inRegion: MixRegion
    var outRegion: MixRegion
    var mixable: Double        // beatmix gate at >= 0.5
}

/* The precomputed SCORE: per-track band envelopes sampled at env.hz.
   Digit characters '0'-'9' become value/9. The tonal voices (b/m/t)
   interpolate linearly; the punch voice (o) is step-held — a hit must
   stay a hit, not smear. Outside the scored span everything is 0. */
struct Env: Equatable {
    var hz: Double
    var b: [Double]; var m: [Double]; var t: [Double]; var o: [Double]
    // envSample: linear interp for b/m/t, step-hold for o. Returns 0 outside.
    func sample(at seconds: Double) -> (bass: Double, mid: Double, treble: Double, punch: Double) {
        guard hz > 0, seconds.isFinite, !b.isEmpty else { return (0, 0, 0, 0) }
        let x = max(0, seconds * hz)
        guard x < Double(Int.max) else { return (0, 0, 0, 0) }
        let i = Int(x)
        let fr = x - Double(i)
        func lin(_ a: [Double]) -> Double {
            guard i < a.count else { return 0 }                 // past the score → silence
            let c0 = a[i]
            let c1 = (i + 1 < a.count) ? a[i + 1] : c0          // hold the last sample at the seam
            return c0 + (c1 - c0) * fr
        }
        func hold(_ a: [Double]) -> Double {
            guard i < a.count else { return 0 }
            return a[i]
        }
        return (lin(b), lin(m), lin(t), hold(o))
    }
}

struct Track: Identifiable, Equatable {
    var id: String          // trackKey: sha256 ?? url.absoluteString
    var title: String
    var albumTag: String
    var albumTitle: String
    var url: URL
    var duration: Double?
    var sha256: String?
    var gainDB: Double?     // dB toward -14 LUFS
    var features: Features? // nil = journey-ineligible
    var env: Env?
    var mix: MixInfo?
    var artURL: URL?
    var year: Int?
    /* The BS.1770 loudness law: gain dB becomes a linear factor clamped
       to [0.06, 2] — normalization may never mute a track nor blow one
       out. No gain = unity; the track is taken at its word. */
    var normLin: Float {
        guard let g = gainDB, g.isFinite else { return 1 }
        let lin = pow(10.0, g / 20.0)
        return Float(min(2.0, max(0.06, lin)))
    }
}

struct Album: Identifiable, Equatable {
    var id: String          // tag
    var title: String
    var tag: String
    var year: Int?
    var genre: String?
    var info: String?
    var artURL: URL?
    var tracks: [Track]
}

struct Catalog: Equatable {
    var label: String
    var artist: String
    var albums: [Album]
    var tracks: [Track]       // flattened, catalog order (this order is load-bearing for the solver rng)

    /* sha256-first key lookups happen on every journey engage and every
       resume reconcile; the index is built once so a 400-key restore
       does not walk the whole library 400 times. */
    private var byKey: [String: Int]

    init(label: String, artist: String, albums: [Album], tracks: [Track]) {
        self.label = label
        self.artist = artist
        self.albums = albums
        self.tracks = tracks
        var idx: [String: Int] = [:]
        idx.reserveCapacity(tracks.count)
        for (i, t) in tracks.enumerated() where idx[t.id] == nil { idx[t.id] = i }
        self.byKey = idx
    }

    func track(forKey key: String) -> Track? {
        if let i = byKey[key], i < tracks.count, tracks[i].id == key { return tracks[i] }
        // correctness beats the index: fall back to the honest walk
        return tracks.first { $0.id == key }
    }

    // the index is derived state; equality is the content, not the cache
    static func == (lhs: Catalog, rhs: Catalog) -> Bool {
        lhs.label == rhs.label && lhs.artist == rhs.artist
            && lhs.albums == rhs.albums && lhs.tracks == rhs.tracks
    }
}

enum CatalogError: LocalizedError, Equatable {
    case v1FlatCatalog        // top-level "tracks" with no "albums"
    case wrongVersion(Int)    // anything != 2
    case noAlbums
    case noPlayableTracks
    case malformed(String)

    // errorDescription mirrors the web player's refusal copy — one voice
    var errorDescription: String? {
        switch self {
        case .v1FlatCatalog:
            return "this is a v1 flat catalog (top-level \"tracks\") — the player needs album-schema v2; rebuild with make_catalog.py"
        case .wrongVersion(let v):
            return "catalog version is \(v) — this player reads v2 only"
        case .noAlbums:
            return "v2 catalog has no \"albums\" array"
        case .noPlayableTracks:
            return "no playable tracks in any album"
        case .malformed(let msg):
            return msg
        }
    }
}

enum CatalogParser {

    /// Strict v2 rules from the web player (docs/index.html ~9285-9432):
    /// refuse v1/flat; refuse version != 2; refuse empty. Per track: file|src|url
    /// required (else skip silently); features kept only when energy/brightness/
    /// entropy/onsets ALL finite (bpm -> 0 default); mix kept only when bpm > 0;
    /// env kept only when b non-empty (digit chars '0'-'9' -> value/9).
    /// URL ladder: absolute http(s):// passes through; else base joined against
    /// catalogURL; track = albumBase + "/" + encode(tag) + "/" + encode(file);
    /// per-album base overrides catalog base; album art -> artURL stamped on tracks.
    static func parse(_ data: Data, catalogURL: URL) throws -> Catalog {
        let obj: Any
        do { obj = try JSONSerialization.jsonObject(with: data) }
        catch { throw CatalogError.malformed("not a catalog object") }
        guard let dict = obj as? [String: Any] else {
            throw CatalogError.malformed("not a catalog object")
        }

        // v1 diagnosis first — the most likely mistake gets the most helpful refusal
        if dict["tracks"] is [Any], !(dict["albums"] is [Any]) {
            throw CatalogError.v1FlatCatalog
        }
        let versionNumber = dict["version"] as? NSNumber
        guard let versionNumber, versionNumber.doubleValue == 2 else {
            throw CatalogError.wrongVersion(versionNumber?.intValue ?? 0)
        }
        guard let albumsRaw = dict["albums"] as? [Any], !albumsRaw.isEmpty else {
            throw CatalogError.noAlbums
        }

        let root = catalogURL
        // catalog base: absolute passes through, relative joins against the
        // catalog URL itself — a self-hosted catalog may ship base:"audio"
        let catBase = resolveURL(str(dict["base"]), base: "", root: root)?.absoluteString
            ?? root.absoluteString
        let defaultGenre = str(dict["genre"])

        var albums: [Album] = []
        var flat: [Track] = []

        for anyAlbum in albumsRaw {
            guard let al = anyAlbum as? [String: Any],
                  let rawTracks = al["tracks"] as? [Any] else { continue }   // no tracks array = no album

            let tag = str(al["tag"]) ?? slugify(str(al["title"]) ?? "album")
            let albase = resolveURL(str(al["base"]), base: "", root: root)?.absoluteString ?? catBase
            let albumFolder = ensureTrailingSlash(albase) + encodeComponent(tag) + "/"
            let artURL = resolveURL(str(al["art"]), base: albumFolder, root: root)
            let albumTitle = str(al["title"]) ?? tag
            let albumYear = positiveInt(num(al["year"]))
            let albumGenre = str(al["genre"]) ?? defaultGenre

            var tracks: [Track] = []
            for anyTrack in rawTracks {
                guard let t = anyTrack as? [String: Any] else { continue }
                let file = str(t["file"]) ?? str(t["src"])       // legacy alias honoured
                let abs = str(t["url"])
                guard file != nil || abs != nil else { continue } // nowhere to point = silently skipped

                // URL ladder: explicit absolute url wins; else album folder + encoded file
                let url: URL?
                if let abs {
                    url = resolveURL(abs, base: "", root: root)
                } else if let file {
                    url = URL(string: albumFolder + encodeComponent(file))
                } else {
                    url = nil
                }
                guard let url else { continue }                   // unbuildable URL = same silent skip

                // features live or die together: all four non-bpm axes finite, or nothing
                var features: Features?
                if let f = t["features"] as? [String: Any],
                   let energy = num(f["energy"]), let brightness = num(f["brightness"]),
                   let entropy = num(f["entropy"]), let onsets = num(f["onsets"]) {
                    features = Features(bpm: num(f["bpm"]) ?? 0, energy: energy,
                                        brightness: brightness, entropy: entropy, onsets: onsets)
                }

                // env kept only when the bass string exists — no bass, no score
                var env: Env?
                if let e = t["env"] as? [String: Any], let bStr = str(e["b"]) {
                    env = Env(hz: num(e["hz"]) ?? 0,
                              b: digits(bStr),
                              m: digits(str(e["m"]) ?? ""),
                              t: digits(str(e["t"]) ?? ""),
                              o: digits(str(e["o"]) ?? ""))
                }

                // mix kept only when bpm > 0 — a beatgrid without tempo is noise
                var mix: MixInfo?
                if let m = t["mix"] as? [String: Any], let bpm = num(m["bpm"]), bpm > 0 {
                    let phrasesRaw = num(m["phrases"]) ?? 0
                    mix = MixInfo(bpm: bpm,
                                  grid: num(m["grid"]) ?? 0,
                                  key: str(m["key"]),
                                  keyConf: num(m["keyConf"]) ?? 0,
                                  phrases: phrasesRaw > 0 ? phrasesRaw : 32,
                                  inRegion: region(m["in"]),
                                  outRegion: region(m["out"]),
                                  // absent mixable never triggered the piano rule on
                                  // the web (undefined < 0.5 is false) — default open
                                  mixable: num(m["mixable"]) ?? 1)
                }

                let sha = str(t["sha256"])
                let durNum = num(t["duration"])
                let rawName = (file ?? abs ?? "")
                let baseName = rawName.split(separator: "/").last.map(String.init) ?? rawName

                let track = Track(
                    id: sha ?? url.absoluteString,               // trackKey: sha-first, url-fallback
                    title: str(t["title"]) ?? cleanName(baseName),
                    albumTag: tag,
                    albumTitle: albumTitle,
                    url: url,
                    duration: (durNum ?? 0) > 0 ? durNum : nil,
                    sha256: sha,
                    gainDB: num(t["gain"]),
                    features: features,
                    env: env,
                    mix: mix,
                    artURL: artURL,                              // album art stamped on tracks
                    year: positiveInt(num(t["year"])) ?? albumYear)
                tracks.append(track)
                flat.append(track)
            }

            if !tracks.isEmpty {
                albums.append(Album(id: tag, title: albumTitle, tag: tag,
                                    year: albumYear, genre: albumGenre,
                                    info: str(al["info"]), artURL: artURL, tracks: tracks))
            }
        }

        guard !flat.isEmpty else { throw CatalogError.noPlayableTracks }

        return Catalog(label: str(dict["label"]) ?? "",
                       artist: str(dict["artist"]) ?? "",
                       albums: albums,
                       tracks: flat)
    }

    // MARK: - the URL ladder

    /// Absolute http(s):// and protocol-relative pass through untouched;
    /// everything else is joined base-then-root — exactly catalog.resolve.
    private static func resolveURL(_ u: String?, base: String, root: URL) -> URL? {
        guard let u, !u.isEmpty else { return nil }
        let lower = u.lowercased()
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") { return URL(string: u) }
        if u.hasPrefix("//") { return URL(string: "https:" + u) }
        if lower.hasPrefix("data:") || lower.hasPrefix("blob:") { return URL(string: u) }
        let prefixed = base.isEmpty ? u : ensureTrailingSlash(base) + u
        if let url = URL(string: prefixed, relativeTo: root) { return url.absoluteURL }
        // a malformed-but-salvageable path gets one percent-encoding attempt
        if let enc = prefixed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: enc, relativeTo: root) { return url.absoluteURL }
        return nil
    }

    private static func ensureTrailingSlash(_ s: String) -> String {
        s.hasSuffix("/") ? s : s + "/"
    }

    /// encodeURIComponent's exact unreserved set — path segments must match
    /// what make_catalog.py published, byte for byte.
    private static let componentAllowed: CharacterSet = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")

    private static func encodeComponent(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: componentAllowed) ?? s
    }

    // MARK: - loose-schema helpers (the catalog is machine-made but the parser trusts nothing)

    /// JS-truthiness string: empty is as good as absent.
    private static func str(_ v: Any?) -> String? {
        guard let s = v as? String, !s.isEmpty else { return nil }
        return s
    }

    /// JS Number() semantics where they matter: numbers pass finite,
    /// numeric strings coerce, anything else is nil (absent/NaN alike).
    private static func num(_ v: Any?) -> Double? {
        if let n = v as? NSNumber {
            let d = n.doubleValue
            return d.isFinite ? d : nil
        }
        if let s = v as? String {
            let t = s.trimmingCharacters(in: .whitespaces)
            if t.isEmpty { return 0 }                    // Number('') === 0
            if let d = Double(t), d.isFinite { return d }
            return nil
        }
        return nil
    }

    /// Number(x) || null — zero and NaN both fall back.
    private static func positiveInt(_ v: Double?) -> Int? {
        guard let v, v != 0, let i = Int(exactly: v.rounded()) else { return nil }
        return i
    }

    private static func region(_ v: Any?) -> MixRegion {
        guard let d = v as? [String: Any] else { return MixRegion(start: 0, beats: 0) }
        return MixRegion(start: num(d["start"]) ?? 0, beats: num(d["beats"]) ?? 0)
    }

    /// env digit strings: chars '0'-'9' map to value/9; anything else is 0.
    private static func digits(_ s: String) -> [Double] {
        s.unicodeScalars.map { u in
            let c = Int(u.value) - 48
            return (0...9).contains(c) ? Double(c) / 9.0 : 0
        }
    }

    /// The web's slugify: NFKD, strip non-word, whitespace/underscore runs
    /// become single hyphens, lowercase, 'untitled' when nothing survives.
    private static func slugify(_ s: String) -> String {
        var kept = ""
        for u in s.decomposedStringWithCompatibilityMapping.unicodeScalars {
            let v = u.value
            let isWord = (v >= 48 && v <= 57) || (v >= 65 && v <= 90)
                || (v >= 97 && v <= 122) || u == "_"
            if isWord || u == "-" || CharacterSet.whitespacesAndNewlines.contains(u) {
                kept.unicodeScalars.append(u)
            }
        }
        let trimmed = kept.trimmingCharacters(in: .whitespacesAndNewlines)
        var slug = ""
        var inRun = false
        for ch in trimmed {
            if ch.isWhitespace || ch == "_" {
                inRun = true
            } else {
                if inRun { slug.append("-"); inRun = false }
                slug.append(ch)
            }
        }
        let lower = slug.lowercased()
        return lower.isEmpty ? "untitled" : lower
    }

    /// The web's cleanName: drop a 2-5 char extension, underscores to
    /// spaces, collapse runs, 'Untitled' when nothing remains.
    private static func cleanName(_ name: String) -> String {
        var n = name
        if let dot = n.lastIndex(of: ".") {
            let ext = n[n.index(after: dot)...]
            if (2...5).contains(ext.count),
               ext.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }) {
                n = String(n[..<dot])
            }
        }
        var out = ""
        var inSpace = false
        for ch in n {
            if ch == "_" || ch == " " {
                inSpace = true
            } else {
                if inSpace && !out.isEmpty { out.append(" ") }
                inSpace = false
                out.append(ch)
            }
        }
        let trimmed = out.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "Untitled" : trimmed
    }
}
