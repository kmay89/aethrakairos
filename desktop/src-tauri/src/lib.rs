// Aethra Kairos — native Mac shell.
//
// A thin, fast native process that hosts the player. Being its own process (not
// a browser tab) is the whole point: it gets the machine's full memory budget
// and is never tab-evicted, which is exactly the stability/memory win over the
// mobile-Safari path. The heavy audio DSP moving into this Rust backend is the
// next stage — see desktop/README.md.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // One window, always. A second launch (dock click, reopen) focuses the
        // running app instead of spawning a duplicate. Registered first, per the
        // plugin's contract.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        // Self-update: the app checks the GitHub Releases feed and applies signed
        // updates in place — "never rot" without the user lifting a finger.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // a quiet background check on launch; failures are non-fatal
                let _ = check_for_updates(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Aethra Kairos");
}

/// Check the release feed once at startup; download + apply if there's a newer,
/// signature-verified build, then relaunch. No-op (Ok) when already current or
/// when updates aren't signed yet.
async fn check_for_updates(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_updater::UpdaterExt;
    if let Some(update) = app.updater()?.check().await? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await?;
        app.restart();
    }
    Ok(())
}
