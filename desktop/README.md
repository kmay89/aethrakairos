# Aethra Kairos — native Mac app

A thin, fast **Tauri** shell that hosts the player as its own macOS process.

## Why a native shell (the point)

The web app is already a GPU pipeline — the visualizer is WebGL/GLSL running on
Metal in any webview — so there's nothing to gain from a native C++/Metal render
port (same GPU, same shaders, a total rewrite for zero speedup). The wins are
elsewhere, and they're real:

- **Stability & memory.** A Tauri app is its own process with the machine's full
  RAM budget. It is *never* tab-evicted the way a mobile-Safari tab is — that
  eviction was the CarPlay auto-reload. This is the headline reliability win.
- **Never rot.** The shell boots straight into the live player, so the content
  is always the latest deploy. The app itself only self-updates for *native*
  changes, via a signed GitHub Releases feed.
- **Magic.** A real Dock app that installs from a `.dmg` and updates itself.

**Staged plan** — Phase 2 moves the heavy audio DSP (decode / FFT / peak &
feature extraction — the CPU/RAM-heavy work) into native Rust commands, plus
native Now Playing + media keys. That's where "native performance" actually
lands: as *compute*, not rendering.

## Layout

```
desktop/
  dist/index.html         # offline-graceful splash → redirects to the live app
  src-tauri/
    tauri.conf.json       # window, bundle (dmg), updater feed + public key
    Cargo.toml            # rust deps: tauri, updater, single-instance
    src/lib.rs            # single-instance + startup self-update check
    src/main.rs           # thin entry point
    capabilities/         # v2 permissions (core + updater)
    icons/                # generated from docs/icons/icon-512.png
```

## Build locally (on a Mac)

```bash
cd desktop
npm install
npm run tauri build      # → src-tauri/target/release/bundle/dmg/*.dmg
```

Linux/CI note: the real macOS build happens in
[`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml) on a
`macos-latest` runner — a manual run produces a `.dmg` artifact; a `desktop-v*`
tag publishes a Release.

## Cut a release

```bash
# bump desktop/src-tauri/tauri.conf.json "version", then:
git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
```

CI builds a universal (`aarch64` + `x86_64`) `.dmg`, creates the GitHub Release,
and — once updater signing is on — uploads `latest.json` + signature so installed
apps update themselves.

## Turn on auto-update (one time)

The updater verifies every update against a public key baked into the app. A
placeholder public key is already in `tauri.conf.json`; to own the signing:

```bash
cd desktop
npx tauri signer generate -w aethra-updater.key      # keep the private key SECRET
```

1. Copy the printed **public key** into `tauri.conf.json` → `plugins.updater.pubkey`.
2. Add the **private key** as the repo secret `TAURI_SIGNING_PRIVATE_KEY`
   (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if you set one).

The private key is git-ignored (`.keys/`) and must never be committed.

## Later: Apple code-signing + notarization (zero-warning install)

Currently the app is **unsigned** — first launch is a one-time right-click →
**Open** (Gatekeeper). To make it install with no warnings, add an Apple
Developer ID cert and notarization creds as CI secrets
(`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) — `tauri-action` picks them up
automatically, no code change needed.
