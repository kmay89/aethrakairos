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

**Staged plan** — a later phase moves the heavy audio DSP (decode / FFT / peak &
feature extraction — the CPU/RAM-heavy work) into native Rust commands, plus
native Now Playing + media keys. That's where "native performance" actually
lands: as *compute*, not rendering.

## Parity — how the web app and the Mac app stay in sync

Two sides, two mechanisms, both automatic:

- **Web edits → the Mac app: instant, no build.** The shell loads the *live*
  site, so anything you ship to `aethrakairos.com` (every merge to `main` that
  Netlify deploys) is in the Mac app the next time it launches. The player, the
  visualizer, playlists, Unheard — all of it — updates with zero app release.
- **Native edits → users: automatic nightly.** A push to `main` that touches the
  **native** app (`desktop/src-tauri/**`, `desktop/dist/**`) auto-builds and
  publishes the **Dev** channel via [`desktop-nightly.yml`](../.github/workflows/desktop-nightly.yml),
  which calls the reusable [`desktop.yml`](../.github/workflows/desktop.yml) with
  `channel: dev`. Dev users ride `main`.
- **Stable stays deliberate.** You don't auto-ship a stable release on every
  commit — cut one with a `desktop-vX.Y.Z` tag when you mean it.

So: the thing you edit most (the web app) needs *nothing*, and the thing you edit
rarely (the native shell) ships itself to the nightly channel.

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
`macos-latest` runner.

## Release channels

Two channels, the standard split — like a Stable app and its Insiders/nightly:

| Channel | How to release | Identity | Update feed |
|---|---|---|---|
| **Stable** | push a `desktop-vX.Y.Z` tag | `Aethra Kairos` · `com.aethrakairos.player` | `releases/latest` |
| **Dev** (nightly) | Actions → *Run workflow* → channel **dev** | `Aethra Kairos Dev` · `…player.dev` (installs side-by-side) | rolling `desktop-nightly` pre-release |

- **Cut a stable release:**
  ```bash
  # bump desktop/src-tauri/tauri.conf.json "version" to match, then:
  git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
  ```
- **Cut a nightly:** GitHub → **Actions → desktop → Run workflow → channel: dev**.
  It publishes/overwrites the rolling `desktop-nightly` pre-release; the Dev app
  auto-updates from it. Stable users never see it (it's a pre-release, so
  `releases/latest` skips it).
- **PRs** touching `desktop/**` build a `.dmg` artifact only — the compile check.

Each build is universal (`aarch64` + `x86_64`). With updater signing on, every
release also carries `latest.json` + signature so installed apps update themselves.

The public **install page** users land on is
[`docs/mac.html`](../docs/mac.html) → **aethrakairos.com/mac** (Gatekeeper help +
an honest "what it is / does / never does"). The web player's footer links to it.

## Turn on auto-update (one time)

The updater verifies every update against the public key baked into the app. The
`pubkey` in `tauri.conf.json` is the project's **real** updater public key — its
matching private key was generated locally and never leaves the owner's machine.

To finish turning auto-update on, add that **private** key as a repo secret:

> GitHub → repo → **Settings → Secrets and variables → Actions → New repository
> secret** → name `TAURI_SIGNING_PRIVATE_KEY`, value = the whole private-key file.

The key was generated with no password, so no `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
is needed. Until that secret is set, releases still build a working `.dmg` —
installs work, auto-update simply stays dormant.

To regenerate/rotate later: `npx @tauri-apps/cli@latest signer generate -w aethra-updater.key`
(needs Node — `brew install node` if `npx` is missing), then update the `pubkey`
here and the secret together. The private key must never be committed.

## Later: Apple code-signing + notarization (zero-warning install)

Currently the app is **unsigned** — first launch is a one-time right-click →
**Open** (Gatekeeper). To make it install with no warnings, add an Apple
Developer ID cert and notarization creds as CI secrets
(`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) — `tauri-action` picks them up
automatically, no code change needed.
