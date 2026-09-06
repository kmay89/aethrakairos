import Foundation
import MediaPlayer
import UIKit
import Combine

/// The TV's twin of the web MediaSession block: MPNowPlayingInfoCenter truth
/// pushed DECIMATED — metadata only on track change; position only on
/// play/pause/seek. AVFoundation does not rot the scrubber between pushes, so
/// there is no heartbeat; a page that re-asserts what the system already knows
/// is just noise on the wire. Artwork is the generative sleeve, drawn lazily at
/// whatever size the system asks for.
@MainActor final class NowPlayingCenter {

    private weak var player: Player?
    private var cancellable: AnyCancellable?
    private var commandTargets: [Any] = []

    // Decimation bookkeeping: what the info center already believes.
    private var lastTrackKey: String?
    private var lastPlaying = false
    private var lastRate: Double = 0
    private var lastElapsed: Double = 0
    private var lastPushDate = Date()
    private var syncQueued = false

    init(player: Player) {
        self.player = player
        wireCommands()
        // Safety-net self-wiring: observe the player and push only what changed.
        // The App may also call the public methods directly; the decimation
        // bookkeeping makes double delivery harmless.
        cancellable = player.objectWillChange.sink { [weak self] _ in
            self?.scheduleSync()
        }
    }

    // MARK: - public pushes

    /// Full metadata push — called on track change only.
    func trackDidChange(_ track: Track?, album: Album?) {
        lastTrackKey = track?.id
        guard let track else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            lastPlaying = false
            lastRate = 0
            lastElapsed = 0
            lastPushDate = Date()
            return
        }
        let artist = player?.catalog?.artist ?? "Aethra Kairos"
        let label = player?.catalog?.label ?? "Aethra Kairos"
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: track.albumTitle,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if let d = track.duration, d > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = d
        }
        info[MPMediaItemPropertyArtwork] = Self.artwork(track: track, album: album,
                                                        artist: artist, label: label)
        // Seed elapsed/rate so the scrubber lands right on the new track.
        let playing = player?.isPlaying ?? false
        let pos = player?.position ?? 0
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = pos
        info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        lastPlaying = playing
        lastRate = playing ? 1 : 0
        lastElapsed = pos
        lastPushDate = Date()
    }

    /// Position/rate push — called on play, pause, and seek; never on a poll.
    func playbackStateDidChange(playing: Bool, position: Double, duration: Double?, rate: Double) {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
        info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? rate : 0.0
        if let duration, duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        lastPlaying = playing
        lastRate = playing ? rate : 0
        lastElapsed = position
        lastPushDate = Date()
    }

    // MARK: - remote commands

    private func wireCommands() {
        let c = MPRemoteCommandCenter.shared()

        c.playCommand.isEnabled = true
        commandTargets.append(c.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                guard let p = self?.player else { return }
                // Resume-or-toggle: play if paused; a play press while playing
                // behaves like the toggle it physically is.
                if p.isPlaying { p.toggle() } else { p.play() }
            }
            return .success
        })

        c.pauseCommand.isEnabled = true
        commandTargets.append(c.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.player?.pause() }
            return .success
        })

        c.togglePlayPauseCommand.isEnabled = true
        commandTargets.append(c.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.player?.toggle() }
            return .success
        })

        c.nextTrackCommand.isEnabled = true
        commandTargets.append(c.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.player?.next() }
            return .success
        })

        c.previousTrackCommand.isEnabled = true
        commandTargets.append(c.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.player?.prev() }
            return .success
        })

        c.skipForwardCommand.isEnabled = true
        c.skipForwardCommand.preferredIntervals = [10]
        commandTargets.append(c.skipForwardCommand.addTarget { [weak self] event in
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 10
            Task { @MainActor in self?.player?.nudge(interval) }
            return .success
        })

        c.skipBackwardCommand.isEnabled = true
        c.skipBackwardCommand.preferredIntervals = [10]
        commandTargets.append(c.skipBackwardCommand.addTarget { [weak self] event in
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 10
            Task { @MainActor in self?.player?.nudge(-interval) }
            return .success
        })

        c.changePlaybackPositionCommand.isEnabled = true
        commandTargets.append(c.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let t = e.positionTime
            Task { @MainActor in self?.player?.seek(to: t) }
            return .success
        })
    }

    // MARK: - decimated self-sync

    /// objectWillChange fires before values land; a hop through the main actor
    /// queue reads the settled state, and the queued flag collapses the 4 Hz
    /// position churn into at most one pending pass.
    private func scheduleSync() {
        guard !syncQueued else { return }
        syncQueued = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.syncQueued = false
            self.syncFromPlayer()
        }
    }

    private func syncFromPlayer() {
        guard let player else { return }
        let track = player.current
        if track?.id != lastTrackKey {
            // Track change: the one moment metadata is pushed.
            let album = track.flatMap { t in
                player.catalog?.albums.first(where: { $0.tag == t.albumTag })
            }
            trackDidChange(track, album: album)
            return
        }
        guard track != nil else { return }
        let playing = player.isPlaying
        let pos = player.position
        // Seek detection: the scrubber only lies when the playhead jumps away
        // from what the last push implied. Anything within tolerance is the
        // system's own extrapolation working as designed — no push.
        let predicted = lastElapsed
            + (lastPlaying ? Date().timeIntervalSince(lastPushDate) * max(lastRate, 0) : 0)
        if playing != lastPlaying || abs(pos - predicted) > 2.0 {
            playbackStateDidChange(playing: playing, position: pos,
                                   duration: track?.duration, rate: 1.0)
        }
    }

    /// Draws the generative sleeve at request time, off whatever thread the
    /// system asks from — CoverArt is pure and thread-safe. A known album gets
    /// its deterministic face; an unknown one gets the monogram.
    private nonisolated static func artwork(track: Track, album: Album?,
                                            artist: String, label: String) -> MPMediaItemArtwork {
        let fallbackTitle = track.albumTitle.isEmpty ? track.title : track.albumTitle
        return MPMediaItemArtwork(boundsSize: CGSize(width: 1024, height: 1024)) { size in
            let side = max(64, min(2048, max(size.width, size.height)))
            if let album {
                return CoverArt.draw(album: album, artist: artist, label: label, size: side)
            }
            return CoverArt.monogram(title: fallbackTitle, size: side)
        }
    }
}
