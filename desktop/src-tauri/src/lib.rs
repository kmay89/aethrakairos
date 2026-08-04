// Aethra Kairos — native Mac shell.
//
// A thin, fast native process that hosts the player. Being its own process (not
// a browser tab) is the whole point: it gets the machine's full memory budget
// and is never tab-evicted, which is exactly the stability/memory win over the
// mobile-Safari path. The heavy audio DSP moving into this Rust backend is a
// later stage — see desktop/README.md.
//
// The shell also does the handful of things the web cannot do for itself, and
// nothing else. Each is a command the player calls through NATIVE.call(), and
// each is a no-op on the web — so every feature ships in the browser first and
// simply gets better here:
//
//   native_info           who is hosting the player, and what version
//   native_update_*       the NATIVE update, offered rather than imposed
//   open_mic_settings     macOS privacy pane — the one place the app can't reach
//   list_displays         what screens exist, so the room can choose one
//   open_stage / close    the visualizer, fullscreen, on the screen the audience sees
//   stage_pip             …or the same stage small, above every app, on one screen
//   set_mini              the booth folded into a corner, above everything

use std::sync::Mutex;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, Position, Runtime, Size};

/// Where the player lives. The shell always hosts the live site, so the content
/// is the newest deploy and the native binary only updates for native changes.
const LIVE: &str = "https://aethrakairos.com";
const UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 AethraKairosNative/1.0";
/// Stage windows are labelled by the screen they are: a wall is several
/// windows, not one, so the label cannot be a constant.
fn stage_label(screen: u32) -> String {
    format!("stage-{}", screen)
}

/// The corner stage, in logical points. Sixteen by nine plus nothing: the
/// window has a real title bar, so the room can drag and resize it by hand.
const PIP_W: f64 = 480.0;
const PIP_H: f64 = 270.0;

/// The booth's own bounds before it folded into a corner, so leaving mini mode
/// puts the window back exactly where the listener had it.
#[derive(Default)]
struct MiniState(Mutex<Option<(f64, f64, f64, f64)>>);

#[derive(serde::Serialize)]
struct NativeInfo {
    version: String,
    os: String,
    stage_open: bool,
    /// What THIS build can do, by name. The player deploys in a minute and this
    /// binary takes a day, so the web side asks for a native trick rather than
    /// assuming one from the mere presence of a shell — an older app answers
    /// with a shorter list and the web path underneath simply carries on.
    caps: Vec<&'static str>,
}

#[derive(serde::Serialize)]
struct Display {
    index: usize,
    name: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    scale: f64,
    primary: bool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // One window, always. A second launch (dock click, reopen) focuses the
        // running app instead of spawning a duplicate. Registered first.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        // Remember the window's size + position across launches.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // Self-update from the signed GitHub Releases feed.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MiniState::default())
        .invoke_handler(tauri::generate_handler![
            native_info,
            native_update_check,
            native_update_apply,
            open_mic_settings,
            list_displays,
            open_stage,
            stage_pip,
            close_stage,
            set_mini,
            reload_shell,
            net_fetch,
        ])
        .menu(|handle| build_menu(handle))
        .on_menu_event(|app, event| match event.id().as_ref() {
            "check-updates" => {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    match check_native_update(handle.clone()).await {
                        Ok(Some(v)) => {
                            let _ = handle.emit("native-update", v);
                        }
                        // a manual check that finds nothing should SAY nothing is
                        // there — silence is the answer people read as "broken"
                        Ok(None) => {
                            let _ = handle.emit("native-update-none", ());
                        }
                        Err(_) => {}
                    }
                });
            }
            "reload" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.eval("window.location.reload()");
                }
            }
            "stage" => {
                if let Some(w) = app.get_webview_window("main") {
                    /* The player owns the choice of screen and the sync — the menu
                    only asks, so the menu, the Stage chip and Shift-F all run
                    one code path. Note the `typeof` guard rather than
                    `window.stageChooser`: the player is one classic script, so
                    its top-level bindings are lexical globals and are NOT
                    properties of `window` — reaching for one that way finds
                    undefined even while the function is perfectly available. */
                    let _ = w.eval("typeof stageChooser === 'function' ? stageChooser() : null");
                }
            }
            _ => {}
        })
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                /* THE UPDATE IS OFFERED, NOT IMPOSED. This used to download and
                install on launch and then call restart() — which can take the
                app down in the middle of a set, and which no amount of care in
                the player's own update policy (SHOW mode is never yanked, the
                place is saved first, music resumes paused) could prevent,
                because the player was never asked. Now the shell reports, the
                player decides, and native_update_apply does the deed after the
                page has saved its state. */
                if let Ok(Some(v)) = check_native_update(handle.clone()).await {
                    let _ = handle.emit("native-update", v);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Aethra Kairos");
}

/// The macOS menu bar — standard, expected controls plus a manual update check.
fn build_menu<R: Runtime>(handle: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let check_updates = MenuItem::with_id(
        handle,
        "check-updates",
        "Check for Updates…",
        true,
        None::<&str>,
    )?;
    let reload = MenuItem::with_id(handle, "reload", "Reload", true, Some("CmdOrCtrl+R"))?;
    let stage = MenuItem::with_id(
        handle,
        "stage",
        "Stage Screen…",
        true,
        Some("CmdOrCtrl+Shift+F"),
    )?;

    let app_menu = Submenu::with_items(
        handle,
        "Aethra Kairos",
        true,
        &[
            &PredefinedMenuItem::about(
                handle,
                Some("Aethra Kairos"),
                Some(AboutMetadata::default()),
            )?,
            &check_updates,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &reload,
            &PredefinedMenuItem::separator(handle)?,
            &stage,
            &PredefinedMenuItem::fullscreen(handle, None)?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    Menu::with_items(handle, &[&app_menu, &edit_menu, &view_menu, &window_menu])
}

// ---------------------------------------------------------------- who we are

#[tauri::command]
fn native_info<R: Runtime>(app: tauri::AppHandle<R>) -> NativeInfo {
    NativeInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        stage_open: app
            .webview_windows()
            .keys()
            .any(|l| l.starts_with("stage-")),
        caps: vec!["stage_pip", "net_fetch"],
    }
}

// ------------------------------------------------------- the local network

/// IS THIS ADDRESS ON THIS MACHINE'S OWN NETWORK.
///
/// The fence around `net_fetch`, and the most important function in this file.
/// A native fetch is a hole straight through the browser's security model —
/// no CORS, no mixed-content rule, no same-origin policy — so the only thing
/// standing between it and a confused deputy is this predicate.
///
/// The player checks the same thing before it calls, and this checks it again,
/// because one check is a single bug away from no check, and the two live in
/// codebases that ship on completely different clocks.
///
/// Strict on purpose: the four private ranges, loopback, link-local, and the
/// `.local` names mDNS hands out. A leading zero in a quad is refused outright
/// rather than parsed — `0177.0.0.1` is loopback to a resolver reading octal
/// and something else entirely to a decimal parser, and a disagreement about
/// what an address means is exactly the bug this exists to prevent.
fn is_lan_host(host: &str) -> bool {
    let h = host.trim().to_ascii_lowercase();
    if h.is_empty() || h.len() > 253 {
        return false;
    }
    if h.contains(['@', '/', '\\', '?', '#', ' ', '[', ']']) {
        return false;
    }
    let parts: Vec<&str> = h.split('.').collect();
    if parts.len() == 4 && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())) {
        for p in &parts {
            if p.is_empty() || p.len() > 3 || (p.len() > 1 && p.starts_with('0')) {
                return false;
            }
        }
        let q: Vec<u16> = parts.iter().filter_map(|p| p.parse::<u16>().ok()).collect();
        if q.len() != 4 || q.iter().any(|v| *v > 255) {
            return false;
        }
        return q[0] == 10
            || (q[0] == 172 && (16..=31).contains(&q[1]))
            || (q[0] == 192 && q[1] == 168)
            || q[0] == 127
            || (q[0] == 169 && q[1] == 254);
    }
    // one label, then .local — "philips-hue.local" and nothing deeper
    if parts.len() == 2 && parts[1] == "local" {
        let n = parts[0];
        return !n.is_empty()
            && n.len() <= 63
            && n.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
            && !n.starts_with('-');
    }
    false
}

#[derive(serde::Serialize)]
pub struct NetReply {
    status: u16,
    ok: bool,
    body: String,
}

/// ONE HTTP REQUEST TO A MACHINE ON THIS NETWORK — the whole of what the shell
/// does for Hue, and deliberately the whole of it.
///
/// Every line of Hue logic lives in the player: discovery, pairing, the colour
/// maths, the rate limiting. The player deploys in a minute and the signed app
/// takes a week, and Hue's API is the part of all this most likely to move —
/// so the shell gets a capability that never needs to change rather than a
/// feature that will.
///
/// `insecure` exists for exactly one reason: a Hue bridge presents a
/// certificate signed by Signify's private CA, which no system trust store
/// carries. It is not a general escape hatch — it only reaches addresses that
/// already passed `is_lan_host`, so the worst it can do is fail to authenticate
/// a machine on the operator's own network.
#[tauri::command]
async fn net_fetch(
    url: String,
    method: Option<String>,
    body: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    insecure: Option<bool>,
) -> Result<NetReply, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "bad url".to_string())?;
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err("only http(s)".into()),
    }
    let host = parsed.host_str().ok_or("no host")?;
    if !is_lan_host(host) {
        return Err(format!("{} is not on this network", host));
    }
    // a request that hangs must not hold a lamp frame open forever
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(insecure.unwrap_or(false))
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;
    let m = method.unwrap_or_else(|| "GET".into()).to_uppercase();
    let mut req = match m.as_str() {
        "GET" => client.get(parsed),
        "POST" => client.post(parsed),
        "PUT" => client.put(parsed),
        "DELETE" => client.delete(parsed),
        _ => return Err("unsupported method".into()),
    };
    if let Some(hs) = headers {
        for (k, v) in hs {
            req = req.header(k, v);
        }
    }
    if let Some(b) = body {
        req = req.header("content-type", "application/json").body(b);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let ok = res.status().is_success();
    let text = res.text().await.unwrap_or_default();
    Ok(NetReply {
        status,
        ok,
        body: text,
    })
}

#[cfg(test)]
mod lan_tests {
    use super::is_lan_host;

    #[test]
    fn private_space_is_allowed() {
        for h in [
            "192.168.1.2",
            "10.0.0.1",
            "172.16.0.1",
            "172.31.255.255",
            "127.0.0.1",
            "169.254.1.1",
            "philips-hue.local",
        ] {
            assert!(is_lan_host(h), "{h} should be reachable");
        }
    }

    #[test]
    fn everything_else_is_refused() {
        for h in [
            "8.8.8.8",
            "example.com",
            "172.32.0.1",
            "172.15.0.1",
            "192.169.1.1",
            "11.0.0.1",
            "",
            "192.168.1.2:80",
            // the shapes that exist to fool a careless parser
            "127.0.0.1@evil.com",
            "0177.0.0.1",
            "010.0.0.1",
            "192.168.1.256",
            "evil.com/192.168.1.1",
            "a.b.local",
            "-bad.local",
            "192.168.1",
        ] {
            assert!(!is_lan_host(h), "{h} must be refused");
        }
    }
}

// ------------------------------------------------------------- native update

/// Ask the signed release feed once. Returns the new version, or None when the
/// app is current (or updates aren't signed yet). Never installs anything.
async fn check_native_update<R: Runtime>(
    app: tauri::AppHandle<R>,
) -> tauri_plugin_updater::Result<Option<String>> {
    use tauri_plugin_updater::UpdaterExt;
    Ok(app.updater()?.check().await?.map(|u| u.version.clone()))
}

#[tauri::command]
async fn native_update_check<R: Runtime>(app: tauri::AppHandle<R>) -> Option<String> {
    check_native_update(app).await.ok().flatten()
}

/// Download, verify and install — then relaunch. Called only after the player
/// has saved its place, and only when a person asked for it.
#[tauri::command]
async fn native_update_apply<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    match update {
        Some(u) => {
            u.download_and_install(|_chunk, _total| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            app.restart() // -> ! : the process is replaced, nothing returns
        }
        // nothing to do is a success, and the player is told so it can withdraw
        // an offer that turned out to be for the build already running
        None => Ok(()),
    }
}

// ------------------------------------------------------------------ the mic

/// Open the macOS Microphone privacy pane. The one answer the app cannot give
/// itself: once a person has denied the mic, only System Settings can undo it,
/// and an app that says "blocked" without saying where has told them nothing.
/// Two whole functions rather than two `#[cfg]` blocks inside one: cfg stripping
/// happens after parsing, so a cfg'd-out TRAILING block leaves the surviving one
/// sitting in statement position, and the function quietly stops returning what
/// it says it returns. Not worth being clever about.
#[cfg(target_os = "macos")]
#[tauri::command]
fn open_mic_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn open_mic_settings() -> Result<(), String> {
    Ok(())
}

// --------------------------------------------------------------- the screens

/// Every display, in logical points — the same units the window builder takes,
/// so the player can name a screen and the shell can land a window on it.
#[tauri::command]
fn list_displays<R: Runtime>(app: tauri::AppHandle<R>) -> Vec<Display> {
    let Some(w) = app.get_webview_window("main") else {
        return Vec::new();
    };
    let primary = w
        .primary_monitor()
        .ok()
        .flatten()
        .and_then(|m| m.name().cloned());
    let monitors = w.available_monitors().unwrap_or_default();
    monitors
        .into_iter()
        .enumerate()
        .map(|(index, m)| {
            let scale = m.scale_factor();
            let pos = m.position();
            let size = m.size();
            let name = m
                .name()
                .cloned()
                .unwrap_or_else(|| format!("Display {}", index + 1));
            Display {
                index,
                primary: primary.as_ref() == Some(&name),
                x: pos.x as f64 / scale,
                y: pos.y as f64 / scale,
                width: size.width as f64 / scale,
                height: size.height as f64 / scale,
                scale,
                name,
            }
        })
        .collect()
}

/// Where a corner stage sits on a given display: top-right, clear of the menu
/// bar, and never wider than the screen it is on.
fn pip_bounds(d: &Display) -> (f64, f64, f64, f64) {
    let w = PIP_W.min(d.width - 48.0).max(240.0);
    let h = PIP_H.min(d.height - 96.0).max(150.0);
    (d.x + (d.width - w - 24.0).max(0.0), d.y + 48.0, w, h)
}

/// Put the visualizer on a screen of its own, fullscreen, with no chrome — the
/// window the audience sees. `screen`/`of` travel in the URL so the page knows
/// which slice of one continuous field it is drawing.
///
/// With `pip`, the same stage instead opens SMALL: a real window with a title
/// bar, above every other app, on the display the booth is already on. That is
/// the only shape of this a one-screen laptop can actually work with — a
/// fullscreen stage there would bury the booth that drives it — and it is how
/// anyone tries the thing before they own a second screen.
#[tauri::command]
async fn open_stage<R: Runtime>(
    app: tauri::AppHandle<R>,
    display: Option<usize>,
    screen: Option<u32>,
    of: Option<u32>,
    pip: Option<bool>,
) -> Result<bool, String> {
    let n = screen.unwrap_or(1);
    let pip = pip.unwrap_or(false);
    let label = stage_label(n);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(true);
    }
    let displays = list_displays(app.clone());
    if displays.is_empty() {
        return Err("no displays".into());
    }
    // default to a screen that is NOT the one the booth is on: the whole point
    // is that the audience sees the field and not the controls. A corner stage
    // is the opposite — it belongs on the screen the operator is looking at.
    let idx = display.unwrap_or_else(|| if displays.len() > 1 && !pip { 1 } else { 0 });
    let d = displays
        .get(idx)
        .or_else(|| displays.first())
        .ok_or("no such display")?;

    let url = format!(
        "{}/?stage=screen&screen={}&of={}{}",
        LIVE,
        n,
        of.unwrap_or(1),
        if pip { "&pip=1" } else { "" }
    );
    let base = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(url.parse().map_err(|_| "bad stage url")?),
    )
    .title(format!("Aethra Kairos — Stage {}", n))
    .user_agent(UA)
    .background_color(tauri::window::Color(5, 6, 12, 255));

    let win = if pip {
        let (x, y, w, h) = pip_bounds(d);
        base.decorations(true) // the title bar IS the handle to drag it by
            .resizable(true)
            .always_on_top(true)
            .min_inner_size(240.0, 150.0)
            .inner_size(w, h)
            .position(x, y)
            .build()
            .map_err(|e| e.to_string())?
    } else {
        base.decorations(false)
            .position(d.x, d.y)
            .inner_size(d.width, d.height)
            .build()
            .map_err(|e| e.to_string())?
    };

    // fullscreen AFTER placing it: macOS fullscreens onto whichever display the
    // window is currently on, so the position is what chooses the screen
    if !pip {
        let _ = win.set_fullscreen(true);
    }

    // the booth must always learn when its screen goes away — by a close box, a
    // yanked HDMI cable, or a person hitting Escape on the wrong window
    let handle = app.clone();
    win.on_window_event(move |ev| {
        if let tauri::WindowEvent::Destroyed = ev {
            let _ = handle.emit("stage-closed", ());
        }
    });
    let _ = app.emit("stage-opened", idx);
    Ok(true)
}

/// Fold a running stage into the corner, or throw it back onto the whole
/// screen. The same window either way — a stage tried small and then wanted big
/// should not have to be closed and reopened, because the packet it is being
/// fed would stop and the picture would blink.
#[tauri::command]
async fn stage_pip<R: Runtime>(app: tauri::AppHandle<R>, on: bool) -> Result<u32, String> {
    let displays = list_displays(app.clone());
    let mut touched = 0;
    for (label, w) in app.webview_windows() {
        if !label.starts_with("stage-") {
            continue;
        }
        if on {
            let _ = w.set_fullscreen(false);
            let _ = w.set_decorations(true);
            let _ = w.set_resizable(true);
            let _ = w.set_always_on_top(true);
            if let Some(d) = displays.first() {
                let (x, y, ww, hh) = pip_bounds(d);
                let _ = w.set_size(Size::Logical(LogicalSize::new(ww, hh)));
                let _ = w.set_position(Position::Logical(LogicalPosition::new(x, y)));
            }
        } else {
            let _ = w.set_always_on_top(false);
            let _ = w.set_decorations(false);
            // a stage that is going back to the room takes a screen of its own
            // where there is one to take
            if let Some(d) = displays.get(1).or_else(|| displays.first()) {
                let _ = w.set_position(Position::Logical(LogicalPosition::new(d.x, d.y)));
                let _ = w.set_size(Size::Logical(LogicalSize::new(d.width, d.height)));
            }
            let _ = w.set_fullscreen(true);
        }
        let _ = w.set_focus();
        touched += 1;
    }
    Ok(touched)
}

/// Close every stage window there is. A wall is several windows and leaving one
/// of them lit is worse than leaving none — the audience sees the odd one out.
#[tauri::command]
async fn close_stage<R: Runtime>(app: tauri::AppHandle<R>) -> Result<u32, String> {
    let mut closed = 0;
    for (label, w) in app.webview_windows() {
        if label.starts_with("stage-") {
            let _ = w.close();
            closed += 1;
        }
    }
    Ok(closed)
}

/// Fold the booth into a corner, above everything, so the laptop can be worked
/// while the stage screen carries the room — and put it back exactly as it was.
#[tauri::command]
async fn set_mini<R: Runtime>(
    app: tauri::AppHandle<R>,
    on: bool,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("no main window")?;
    let state = app.state::<MiniState>();
    if on {
        let scale = w.scale_factor().unwrap_or(1.0);
        // remember the bounds ONCE: a second call while already mini must not
        // record the mini bounds as the ones to go back to
        {
            let mut prev = state.0.lock().map_err(|_| "state")?;
            if prev.is_none() {
                if let (Ok(p), Ok(s)) = (w.outer_position(), w.outer_size()) {
                    *prev = Some((
                        p.x as f64 / scale,
                        p.y as f64 / scale,
                        s.width as f64 / scale,
                        s.height as f64 / scale,
                    ));
                }
            }
        }
        let mw = width.unwrap_or(360.0);
        let mh = height.unwrap_or(148.0);
        let displays = list_displays(app.clone());
        // the booth's own display, bottom-right, a thumb's width from the edge
        let (dx, dy, dw, dh) = displays
            .first()
            .map(|d| (d.x, d.y, d.width, d.height))
            .unwrap_or((0.0, 0.0, 1440.0, 900.0));
        let _ = w.set_resizable(true);
        w.set_size(Size::Logical(LogicalSize::new(mw, mh)))
            .map_err(|e| e.to_string())?;
        w.set_position(Position::Logical(LogicalPosition::new(
            dx + dw - mw - 24.0,
            dy + dh - mh - 24.0,
        )))
        .map_err(|e| e.to_string())?;
        let _ = w.set_always_on_top(true);
    } else {
        let prev = { state.0.lock().map_err(|_| "state")?.take() };
        let _ = w.set_always_on_top(false);
        if let Some((x, y, ww, hh)) = prev {
            let _ = w.set_size(Size::Logical(LogicalSize::new(ww, hh)));
            let _ = w.set_position(Position::Logical(LogicalPosition::new(x, y)));
        }
    }
    Ok(())
}

/// Reload the player from the server. The menu's Reload is an ordinary one (the
/// service worker answers it, which is right); this is the escape hatch for a
/// shell that has somehow got stuck on a page it cannot leave.
#[tauri::command]
fn reload_shell<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("no main window")?;
    w.eval(&format!(
        "window.location.replace('{}/?fresh=' + Date.now())",
        LIVE
    ))
    .map_err(|e| e.to_string())
}
