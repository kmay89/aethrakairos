// Native Now Playing + media keys — the staged-plan item that lands here.
//
// WKWebView implements the Media Session API as an object wired to nothing:
// the player sets its metadata, registers its handlers, and macOS never hears
// about any of it. In Safari the same code lights up the Now Playing widget
// and the keyboard's play/pause key; in the shell it was a card that never
// appeared and keys that did nothing — the one place the Mac app was WORSE
// than the browser it replaced. So the shell owns the surface the webview
// cannot reach: the player pushes what is playing through `media_update`, and
// the hardware — ⏯ on the keyboard, AirPods, the Control Center card, a
// Bluetooth steering wheel — comes back as `media-key` / `media-seek` events.
//
// The division of labour is the same as everywhere else in this shell: every
// decision (what to show, what a key MEANS mid-mix, whether play resumes or
// starts) lives in the player, which deploys in a minute; the shell only
// carries bytes across the process boundary, which never needs to change.

#[cfg(target_os = "macos")]
pub mod native {
    use std::sync::Mutex;
    use std::time::Duration;

    use souvlaki::{
        MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition,
        PlatformConfig,
    };
    use tauri::{AppHandle, Emitter, Manager, Runtime};

    /// The one handle to macOS's Now Playing surface. On macOS souvlaki's
    /// `MediaControls` is stateless — it talks to the MPNowPlayingInfoCenter /
    /// MPRemoteCommandCenter singletons — but DROPPING it detaches the command
    /// handlers, so exactly one lives here for the life of the app and is
    /// never reconstructed on the side.
    pub struct MediaState(Mutex<Option<MediaControls>>);

    /// Register with the system's command center. Called once from setup, on
    /// the main thread, before any window exists — the handlers it installs
    /// fire for the whole life of the process.
    pub fn init<R: Runtime>(app: &AppHandle<R>) {
        let Ok(mut controls) = MediaControls::new(PlatformConfig {
            display_name: "Aethra Kairos",
            dbus_name: "com.aethrakairos.player",
            hwnd: None,
        }) else {
            return;
        };
        let handle = app.clone();
        // Every key becomes an event the player interprets: the shell does not
        // know whether "play" means resume, restart, or begin a journey — and
        // must never learn, because that answer changes with the player.
        let attached = controls
            .attach(move |ev| {
                let _ = match ev {
                    MediaControlEvent::Play => handle.emit("media-key", "play"),
                    MediaControlEvent::Pause => handle.emit("media-key", "pause"),
                    MediaControlEvent::Toggle => handle.emit("media-key", "toggle"),
                    MediaControlEvent::Next => handle.emit("media-key", "next"),
                    MediaControlEvent::Previous => handle.emit("media-key", "previous"),
                    MediaControlEvent::Stop => handle.emit("media-key", "stop"),
                    MediaControlEvent::SetPosition(MediaPosition(d)) => {
                        handle.emit("media-seek", d.as_secs_f64())
                    }
                    // Seek-by, volume, raise, quit, open-uri: shapes the macOS
                    // command center is never asked to send. Listed as a wildcard
                    // so a souvlaki upgrade cannot break the build over an event
                    // this platform will not produce.
                    _ => Ok(()),
                };
            })
            .is_ok();
        if attached {
            app.manage(MediaState(Mutex::new(Some(controls))));
        }
    }

    /// Whether init actually attached — what `native_info.caps` reports, so
    /// the player never pushes state at a surface that is not listening.
    pub fn available<R: Runtime>(app: &AppHandle<R>) -> bool {
        app.try_state::<MediaState>().is_some()
    }

    /// One state push from the player. `meta` says whether the track itself
    /// changed: metadata carries the artwork URL, and the shell fetches art
    /// once per track (souvlaki loads it on a background queue), not once per
    /// heartbeat. Playback state + position ride on every call — macOS's
    /// scrubber is only as honest as the last position it was pinned to.
    #[allow(clippy::too_many_arguments)]
    pub fn update<R: Runtime>(
        app: &AppHandle<R>,
        playing: bool,
        meta: bool,
        title: Option<String>,
        artist: Option<String>,
        album: Option<String>,
        art: Option<String>,
        duration: Option<f64>,
        position: Option<f64>,
    ) -> Result<(), String> {
        let state = app
            .try_state::<MediaState>()
            .ok_or("media controls never attached")?;
        let mut guard = state.0.lock().map_err(|_| "state")?;
        let controls = guard.as_mut().ok_or("media controls gone")?;
        // Duration::from_secs_f64 PANICS on a negative or non-finite input,
        // and both cross this boundary as ordinary JS numbers — an <audio>
        // element mid-load reports NaN durations as a matter of course.
        let secs = |v: Option<f64>| {
            v.filter(|s| s.is_finite() && *s >= 0.0)
                .map(Duration::from_secs_f64)
        };
        if meta {
            controls
                .set_metadata(MediaMetadata {
                    title: title.as_deref(),
                    artist: artist.as_deref(),
                    album: album.as_deref(),
                    cover_url: art.as_deref(),
                    duration: secs(duration),
                })
                .map_err(|e| e.to_string())?;
        }
        let progress = secs(position).map(MediaPosition);
        controls
            .set_playback(if playing {
                MediaPlayback::Playing { progress }
            } else {
                MediaPlayback::Paused { progress }
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
