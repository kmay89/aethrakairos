import SwiftUI
import UIKit

/* ================================================================
   STAGECRAFT — the pieces the front of the house is built from.

   The hero button (one press, music), the entrance (the welcome
   arrives in a sequence, not all at once), the billboard that opens
   the shelves, the player dials, and the sleeves.

   Two performance laws live here as well:
   - Nothing on the home screen observes the Player except the small
     views that show live transport state (the billboard, the dials).
     The position publishes at 4 Hz, and HomeView observing it used to
     re-diff every shelf, all 267 sleeves included, four times a second.
   - Sleeves are drawn OFF the main thread, once, into a bounded cache.
     A generative sleeve is thousands of strokes and grain dots; drawing
     it on the main thread as a tile scrolled into view was the hitch,
     and keeping every one drawn forever was ~170 MB.
   ================================================================ */

// MARK: - the hero button

/// THE button: a glass capsule whose ring of light turns while it holds
/// focus, lifted and glowing so it reads from the far end of the room.
/// The ring only animates while focused, so an unfocused hero costs nothing.
struct HeroButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        HeroBody(configuration: configuration)
    }

    private struct HeroBody: View {
        let configuration: Configuration
        @Environment(\.isFocused) private var focused

        var body: some View {
            configuration.label
                .padding(.horizontal, 46)
                .padding(.vertical, 26)
                .background(
                    Capsule(style: .continuous)
                        .fill(LinearGradient(
                            colors: focused
                                ? [Color.scIce.opacity(0.34), Color.scAmber.opacity(0.20)]
                                : [Color.white.opacity(0.12), Color.white.opacity(0.06)],
                            startPoint: .leading, endPoint: .trailing))
                )
                .overlay(HeroRing(active: focused))
                .shadow(color: Color.scIce.opacity(focused ? 0.55 : 0), radius: focused ? 40 : 0)
                .shadow(color: .black.opacity(focused ? 0.5 : 0.2), radius: 24, y: 14)
                .scaleEffect(configuration.isPressed ? 0.96 : (focused ? 1.08 : 1.0))
                .animation(.spring(response: 0.38, dampingFraction: 0.78), value: focused)
                .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
        }
    }
}

/// The turning ring: an angular sweep of the house colours, ice through
/// amber and the beat's rose, one revolution every five seconds.
private struct HeroRing: View {
    let active: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !active)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let angle = Angle.degrees((t * 72).truncatingRemainder(dividingBy: 360))
            Capsule(style: .continuous)
                .strokeBorder(
                    AngularGradient(colors: [.scIce, .scAmber, .scBeat, .scIce],
                                    center: .center, angle: angle),
                    lineWidth: active ? 4 : 1.5)
                .opacity(active ? 1 : 0.4)
        }
    }
}

/// The hero's face: a big glyph, the word, and one line under it.
struct HeroLabel: View {
    let symbol: String
    let title: String
    let line: String

    var body: some View {
        HStack(spacing: 24) {
            Image(systemName: symbol)
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(Color.scInk)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 42, weight: .heavy))
                    .tracking(7)
                    .foregroundStyle(Color.scInk)
                    .lineLimit(1)
                Text(line)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.scInk.opacity(0.72))
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - the entrance

/// Rise and fade in, after `delay`, once `shown` turns true — the welcome
/// arrives as a sequence: the name, then the promise, then the button.
private struct Entrance: ViewModifier {
    let shown: Bool
    let delay: Double

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 30)
            .animation(.easeOut(duration: 1.0).delay(delay), value: shown)
    }
}

extension View {
    func entrance(_ shown: Bool, delay: Double) -> some View {
        modifier(Entrance(shown: shown, delay: delay))
    }
}

// MARK: - the billboard

/// The first row of the shelves, and so the one focus lands on. The sleeve
/// of what is playing (or the house emblem when nothing is), what state the
/// music is in, its title large, where the field is, and the one button:
/// PLAY when nothing is on the deck (the nonstop mix), RESUME when a session
/// is paused or was restored, BACK TO THE FIELD while music plays. NEW MIX
/// beside it re-deals the whole library at any time.
///
/// This view observes the Player so HomeView doesn't have to.
struct FrontDoorRow: View {
    @ObservedObject var player: Player
    let catalog: Catalog
    let roomName: String
    let onPrimary: () -> Void
    let onNewMix: () -> Void

    var body: some View {
        let track = player.current
        let album = track.flatMap { t in catalog.albums.first { $0.tag == t.albumTag } }
        return HStack(alignment: .center, spacing: 60) {
            sleeve(album)
                .frame(width: 330, height: 330)
                .shadow(color: Color.scIce.opacity(0.28), radius: 46)
                .shadow(color: .black.opacity(0.55), radius: 30, y: 18)
            VStack(alignment: .leading, spacing: 0) {
                Text(eyebrow(track))
                    .font(.system(size: 20, weight: .bold, design: .monospaced))
                    .tracking(7)
                    .foregroundStyle(track == nil ? Color.scIce : Color.scAmber)
                Text(track?.title ?? "The nonstop mix")
                    .font(.system(size: 66, weight: .medium, design: .serif))
                    .italic()
                    .foregroundStyle(Color.scInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .shadow(color: Color.scIce.opacity(0.25), radius: 18)
                    .padding(.top, 12)
                Text(subtitle(track, album))
                    .font(.system(size: 23, weight: .medium))
                    .foregroundStyle(Color.scDim)
                    .lineLimit(1)
                    .padding(.top, 10)
                HStack(spacing: 30) {
                    Button(action: onPrimary) {
                        HeroLabel(symbol: primarySymbol(track), title: primaryTitle(track),
                                  line: primaryLine(track))
                    }
                    .buttonStyle(HeroButtonStyle())
                    if track != nil {
                        Button(action: onNewMix) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("NEW MIX")
                                    .font(.system(size: 26, weight: .semibold))
                                    .tracking(4)
                                    .foregroundStyle(Color.scInk)
                                Text("Shuffle everything, nonstop.")
                                    .font(.system(size: 18))
                                    .foregroundStyle(Color.scDim)
                            }
                        }
                        .buttonStyle(ShelfChipStyle())
                    }
                }
                .padding(.top, 40)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
        .focusSection()
    }

    @ViewBuilder private func sleeve(_ album: Album?) -> some View {
        if let album {
            AlbumSleeve(album: album, artist: catalog.artist, label: catalog.label, size: 660, corner: 18)
        } else {
            HouseEmblem()
        }
    }

    private func eyebrow(_ track: Track?) -> String {
        guard track != nil else { return "READY WHEN YOU ARE" }
        return player.isPlaying ? "NOW PLAYING" : "PAUSED"
    }

    private func subtitle(_ track: Track?, _ album: Album?) -> String {
        guard let track else {
            return "\(catalog.tracks.count) original songs · \(Rooms.all.count) light shows · blended live"
        }
        let albumTitle = album?.title ?? track.albumTitle
        let room = roomName.isEmpty ? "THE FIELD" : roomName
        return "\(albumTitle)  ·  \(room)  ·  \(actWord(track))"
    }

    /// The five-act arc, derived exactly as the director does.
    private func actWord(_ track: Track) -> String {
        let duration = track.duration ?? 0
        guard duration > 0 else { return Story.actNames[0] }
        let ratio = player.position / duration
        let prog = ratio.isFinite ? min(max(ratio, 0), 1) : 0
        let index = Story.act(prog: prog, structure: track.mix?.structure)
        return Story.actNames[min(max(index, 0), Story.actNames.count - 1)]
    }

    private func primarySymbol(_ track: Track?) -> String {
        guard track != nil else { return "play.fill" }
        return player.isPlaying ? "sparkles" : "play.fill"
    }

    private func primaryTitle(_ track: Track?) -> String {
        guard track != nil else { return "PLAY" }
        return player.isPlaying ? "BACK TO THE FIELD" : "RESUME"
    }

    private func primaryLine(_ track: Track?) -> String {
        guard track != nil else { return "Music and light, nonstop." }
        return player.isPlaying ? "The light show is waiting." : "Pick up where it stopped."
    }
}

/// The sleeve for "nothing on the deck yet": the house's infinity, lit by
/// the three colours of the light — a promise rather than a placeholder.
struct HouseEmblem: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.scVoid)
            Circle()
                .fill(AngularGradient(colors: [.scIce, .scAmber, .scBeat, .scIce], center: .center))
                .blur(radius: 60)
                .opacity(0.55)
                .padding(40)
            Text("∞")
                .font(.system(size: 190, weight: .regular, design: .serif))
                .foregroundStyle(Color.scInk)
                .shadow(color: Color.scIce.opacity(0.8), radius: 28)
                .offset(y: -8)
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        )
    }
}

// MARK: - the player dials

/// AUTO-MIX STYLE and KEY LOCK: the two settings that write to the Player.
/// Their own view, observing the Player, so the settings shelf does not make
/// the whole home screen follow the transport.
struct PlayerDials: View {
    @ObservedObject var player: Player

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            VStack(alignment: .leading, spacing: 14) {
                Text("AUTO-MIX STYLE")
                    .font(.system(size: 24, weight: .semibold))
                    .tracking(2)
                    .foregroundStyle(Color.scInk)
                HStack(alignment: .top, spacing: 24) {
                    ForEach(MixStyle.allCases, id: \.self) { style in
                        Button {
                            player.mixStyle = style
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(style.rawValue.uppercased())
                                    .font(.system(size: 22, weight: .semibold, design: .monospaced))
                                    .tracking(2)
                                    .foregroundStyle(player.mixStyle == style ? Color.scAmber : Color.scInk)
                                Text(Self.describe(style))
                                    .font(.system(size: 17))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(3)
                                    .fixedSize(horizontal: false, vertical: true)
                                Capsule()
                                    .fill(player.mixStyle == style ? Color.scAmber : Color.clear)
                                    .frame(width: 64, height: 3)
                            }
                            .frame(width: 320, alignment: .leading)
                        }
                        .buttonStyle(ShelfChipStyle())
                    }
                }
            }
            Toggle(isOn: $player.keyLock) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("KEY LOCK")
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(Color.scInk)
                    Text("Hold pitch steady when a seam bends the tempo to match.")
                        .font(.system(size: 17))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: 860)
        }
    }

    private static func describe(_ style: MixStyle) -> String {
        switch style {
        case .adaptive: return "Reads each seam — 8-beat blends with 3.0 s fades."
        case .musical:  return "Lets the song play out — no beatmix, 2.6 s fades."
        case .club:     return "Tight and relentless — 16-beat blends, 2.2 s fades."
        }
    }
}

// MARK: - the sleeves

/// Generative sleeves, drawn off the main thread and kept in a bounded
/// cache. A request for a sleeve already being drawn waits for that draw
/// instead of starting a second one.
@MainActor final class CoverCache {
    static let shared = CoverCache()

    private let cache = NSCache<NSString, UIImage>()
    private var inflight: [String: Task<UIImage, Never>] = [:]

    private init() {
        // ~60 sleeves at 400 px is ~38 MB; the old unbounded table held every
        // sleeve ever scrolled past for the app's whole life.
        cache.countLimit = 60
    }

    nonisolated static func key(_ album: Album, _ size: CGFloat) -> String {
        "\(album.tag)#\(Int(size))"
    }

    func cached(_ album: Album, size: CGFloat) -> UIImage? {
        cache.object(forKey: Self.key(album, size) as NSString)
    }

    func image(for album: Album, artist: String, label: String, size: CGFloat) async -> UIImage {
        let key = Self.key(album, size)
        if let hit = cache.object(forKey: key as NSString) { return hit }
        if let running = inflight[key] { return await running.value }
        // CoverArt is pure and thread-safe (the Now Playing artwork already
        // draws it from the system's own queue).
        let task = Task.detached(priority: .utility) { () -> UIImage in
            album.tracks.isEmpty
                ? CoverArt.monogram(title: album.title, size: size)
                : CoverArt.draw(album: album, artist: artist, label: label, size: size)
        }
        inflight[key] = task
        let image = await task.value
        inflight[key] = nil
        cache.setObject(image, forKey: key as NSString)
        return image
    }
}

/// One sleeve: the cached image at once if there is one, else a quiet
/// monogram that the drawn sleeve fades over the moment it is ready.
struct AlbumSleeve: View {
    let album: Album
    let artist: String
    let label: String
    let size: CGFloat
    let corner: CGFloat

    @State private var image: UIImage?

    init(album: Album, artist: String, label: String, size: CGFloat = 400, corner: CGFloat = 10) {
        self.album = album
        self.artist = artist
        self.label = label
        self.size = size
        self.corner = corner
    }

    var body: some View {
        ZStack {
            Rectangle().fill(Color.scGlassHard)
            Text(String(album.title.prefix(1)))
                .font(.system(size: 96, weight: .medium, design: .serif))
                .italic()
                .foregroundStyle(Color.scDim)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .transition(.opacity)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        // keyed by album AND size: the grid reuses tiles by position, so a
        // catalog refresh can hand this tile a different album
        .task(id: CoverCache.key(album, size)) {
            if let hit = await CoverCache.shared.cached(album, size: size) {
                image = hit
                return
            }
            image = nil
            let drawn = await CoverCache.shared.image(for: album, artist: artist, label: label, size: size)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.35)) { image = drawn }
        }
    }
}

// Identity tokens (DESIGN §2), this file's copy — the same values as every
// other UI file's private set.
extension Color {
    static let scVoid = Color(red: 5 / 255, green: 6 / 255, blue: 14 / 255)
    static let scInk = Color(red: 233 / 255, green: 237 / 255, blue: 246 / 255)
    static let scDim = Color(red: 154 / 255, green: 165 / 255, blue: 188 / 255)
    static let scAmber = Color(red: 255 / 255, green: 180 / 255, blue: 84 / 255)
    static let scIce = Color(red: 110 / 255, green: 231 / 255, blue: 255 / 255)
    static let scBeat = Color(red: 255 / 255, green: 92 / 255, blue: 135 / 255)
    static let scGlassHard = Color(red: 10 / 255, green: 13 / 255, blue: 24 / 255).opacity(0.72)
}
