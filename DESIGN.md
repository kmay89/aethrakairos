# Aethra Kairos — the artist's own instrument
## Design & research document · v1

*One artist. One repo. One page that plays, paints, and remembers — hosted at
**aethrakairos.com**, powered by the Möbius⁸ engine.*

This document is the plan the user asked for before any code is written: what
exists, what the research says, what we will build, in what order, and why.
Nothing here is aspirational hand-waving — every phase names the files it
touches and the way it will be verified.

---

## 0 · The one-paragraph vision

Take the Möbius⁸ distribution build — already a single-file PWA that streams a
catalog from GitHub, deals journeys through a feature-space solver, and renders
thirteen WebGL scenes through a musically-keyed OKLCH color engine — and turn
it into **Aethra Kairos's own instrument**: the artist on the marquee, the
engine credited beneath; a library that borrows the best habits of iTunes,
Spotify, Apple Music and YouTube Music without borrowing their servers; and a
visual engine promoted from *decoration* to *first-class way of experiencing
the music* — precise enough, expressive enough, and safe enough that someone
who cannot dance with their body can genuinely dance with their eyes.

---

## 1 · What already exists (the inventory)

The repo is much further along than "port a capability" suggests. The current
build (`docs/index.html`, 7,189 lines, one file) already contains:

### 1.1 The player & distribution layer
- **Catalog v2** parser (`§6a`, ~line 1658): albums → tracks with mandatory
  `duration/sha256/published/features`, base-URL streaming from
  `raw.githubusercontent.com`, graceful degradation, optional minisign
  signature mark.
- **Dual-deck audio engine** (`AE`, ~1268): two `<audio>` elements for
  crossfading; on iOS decks bypass the WebAudio graph entirely so a suspended
  context can never silence lock-screen playback.
- **Full MediaSession** (~3141): lock screen, CarPlay, Bluetooth, AirPlay
  route button, `seekto`/`setPositionState`.
- **Library drawer** (~3242): album cards, liner notes, favorites, filter,
  license footer. Plus **the Crate** (~3377): every track on one mix-scored
  table.
- **Journey engine** (`@solver`, 2628–3042): a pure, node-tested playlist
  solver over a 5-feature space (energy/brightness/entropy/onsets/bpm) — a
  drawn curve on the brightness×energy map *is* the playlist; HEAT dials
  coherence vs. surprise; QUANTUM mode is a memoryless neighborhood walk;
  MEMORIES replays eras of the listener's own history; six RITUALS
  (run/dinner/work/bedtime/sunrise/party) ship as PWA shortcuts.
- **Persistence** (IndexedDB, ~2396): hash-keyed play history (republishing a
  file under a new path keeps its history), favorites, transport
  restore-paused, saved journeys with seeds.
- **PWA shell**: manifest, service worker (cache-first shell,
  stale-while-revalidate catalog, audio never intercepted), icons, install
  affordance.

### 1.2 The visual engine (§8, ~2,300 lines)
- **Three.js/WebGL**, 13 registered scenes, each a hand-written GLSL
  factory: MÖBIUS SPIRAL, π–e HELIX, MÖBIUS BAND, STARBURST, NEBULA, TUNNEL,
  RIBBONS, FRACTAL FIELD (raymarched, 1,000 dice-rolled variants), COMETS,
  FERN (IFS fractal that grows with track progress), ROSETTE, SLINKY, OP-ART.
- **A director** (~6787): weights scenes by the music's live features, runs a
  five-act story arc across each track, cuts on energy peaks/breaks, drives a
  camera rig (bass→FOV, onset→dolly).
- **A real color engine** (~3044): root hue from the track's detected key
  mapped around the Camelot wheel; all blending in **OKLCH** (perceptually
  uniform, gamut-mapped by walking chroma down); harmony scheme chosen from
  musical character (high entropy → triad, high energy → complement, else
  analogous); glides take **eight beats of the measured grid**, not wall-clock
  seconds.
- **Audio analysis** (~1270): live FFT with spectral-flux onset detection and
  BPM folding, or — preferred when the catalog provides it — a **grid-locked
  beat clock** from precomputed per-track analysis, so visuals land on the
  beat rather than guessing at it.
- **Adaptive resolution governor**: the heavy raymarched scene lowers its
  render scale instead of dropping frames.

### 1.3 The pipeline (Python, repo root)
- `make_catalog.py` — masters → `docs/catalog.json`; move-vs-add by SHA-256;
  Haitsma–Kalker perceptual-clone gate; features cache; catalog-wide feature
  normalization; `doctor` subcommand.
- `features.py` — BS.1770-4 loudness, centroid/entropy, SuperFlux-lite
  onsets, autocorrelation tempo.
- `fingerprint.py` — the perceptual identity index under `dna/`.
- `publish.sh` — unpack → build → doctor → commit → push, one command.
- Tests: 19 pipeline + 14 solver + 14 headless-browser acceptance +
  integration; a 1,000-track synthetic deploy fixture.

**Implication:** the task is not to port a capability *into* something — it is
to **rebrand, re-aim, and extend** a working system. Everything below builds
on this inventory; nothing throws it away.

---

## 2 · Identity: Aethra Kairos over the Möbius⁸ engine

Decision (made by the artist): **dual identity — artist on top, engine
credited beneath.**

> **AETHRA KAIROS**
> *powered by the Möbius⁸ engine*

### 2.1 What changes
| Surface | Now | Becomes |
|---|---|---|
| `<title>` / meta / OG | "Möbius⁸ — Spiral Sound Engine" | "Aethra Kairos — official player" (engine in description) |
| Top-bar wordmark (682) | Möbius**8** / "Spiral Sound Engine" | **AETHRA KAIROS** / "powered by Möbius⁸" |
| PWA manifest name | Möbius⁸ | Aethra Kairos |
| Hero copy (741) | "Drop sound into the *field*." | Artist-first invitation; the field stays as the second line |
| About panel (994) | Engine essay | Artist bio first, engine essay preserved beneath |
| `document.title` while playing (2387) | "▶ track — Möbius⁸" | "▶ track — Aethra Kairos" |
| Icons | Möbius monogram | AK monogram (regenerate via `tools/make_icons.mjs`) |
| README / HANDOFF headers | Möbius⁸ · Distribution Build | Aethra Kairos · powered by Möbius⁸ |

### 2.2 What deliberately does *not* change
- **Internal identifiers stay:** `MB8_` prefixes, the `mobius8-player`
  IndexedDB name (renaming it would orphan every listener's history and
  hearts), `mb8-` service-worker cache prefixes, `MB8FP` fingerprint magic.
  These are engine-level names, and the engine keeps its name.
- **The math copy stays.** The Möbius-field voice ("the 8 wants to be an ∞")
  is part of the art. It moves down a level; it does not get deleted.
- **`catalog.json` fields** `artist: "Aethra Kairos"` / `label: "ERRERlabs"`
  already carry the right data — the rebrand is chrome, not data.

---

## 3 · Research: what the streaming giants got right
*(Grounded in a July 2026 web-research pass; sources in §9.)*

### 3.1 The ranked adoption list
Features ranked by value-to-a-single-artist-static-player ÷ cost, with
client-side feasibility (no backend exists, and none will):

1. **Time-synced lyrics** (Apple Music's most-loved daily feature) —
   precompute LRC/Enhanced-LRC per track at publish time; render with line +
   word highlight. *Medium; pipeline addition.*
2. **Canvas-style motion art** (Spotify Canvas: 3–8 s looping silent video on
   now-playing; Spotify reports large share/save lifts) — for Aethra Kairos
   the **visual engine itself is the Canvas**, but per-album motion loops are
   also a supported catalog field. *Easy.*
3. **Gapless playback** — Web Audio buffer scheduling for album-continuous
   material. *Medium; the dual-deck engine is already halfway there.*
4. **Loudness normalization** — `features.py` already computes BS.1770-4
   loudness; emit a per-track gain into the catalog and apply via GainNode
   (non-iOS) / element volume (iOS). *Precompute exists — cheap win.*
5. **Editable Up-Next queue** — drag-reorder, play-next, add-to-queue. *Easy.*
6. **Smart shuffle with fewer-repeats weighting** — the play-history store
   already exists; weight the existing shuffle bag by recency. *Easy.*
7. **Full-screen now-playing with art-derived color** — already stronger here
   than the incumbents: the color engine derives from the *music*, not the
   JPEG. Add the immersive now-playing layout. *Easy.*
8. **Crossfade / sleep timer / playback speed** — crossfade exists; add the
   other two. *Easy.*
9. **Playlists, folders, smart playlists** — the missing iTunes layer; see
   §5. *Medium.*
10. **Offline albums** (PWA download) — opt-in per-album caching. *Medium;
    the SW's audio-never-intercepted invariant needs a deliberate carve-out.*
11. **Share kit** — deep links (`?t=track-slug`), QR codes, canvas-rendered
    story cards ("share this journey"). *Easy.*
12. **A local "Replay/Wrapped"** — per-device year-in-review from the
    existing hash-keyed history, rendered as shareable cards. *Medium.*

### 3.2 Explicitly rejected (and why)
Spotify DJ / Blend / Jam, YouTube hum-to-search, AI conversational radio,
Dolby Atmos, collaborative playlists — all require servers, licensed models,
or multichannel masters. A static artist instrument does not apologize for
not being a data center. (Group listening *lite* — a shared journey seed via
URL — delivers 80 % of Jam's joy at 0 % of its infrastructure.)

### 3.3 What iTunes specifically got right (the library layer)
Column-browsable library, smart playlists as *saved rules*, star ratings,
play counts as first-class sortable data, and the sense that the library is
**yours**. The Crate is already the column browser; §5 adds the rest.

---

## 4 · Research: the visual engine — "dancing with your eyes"

The brief: visuals precise and expressive enough that watching *is* the
dance. The research validates much of what the engine already does and names
exactly where the next generation lives.

### 4.1 What the research validates (already built, keep with pride)
- **Circle-of-fifths → hue is the load-bearing insight.** Scriabin's key-color
  system looks arbitrary until the notes are reordered by the circle of
  fifths — then it forms a clean spectrum. The engine's `camelotHue` already
  maps detected key around the Camelot wheel. This is the research-backed
  core; the color engine was right.
- **OKLCH as the substrate** — perceptually uniform blending (already done),
  and two properties not yet exploited: because L *is* perceptual luminance,
  a **per-frame luminance-delta cap becomes a seizure-safety guarantee**, and
  fixed L-differences become a **contrast guarantee** for UI over moving
  backgrounds.
- **Harmony scheme from musical character** (entropy→triad, energy→
  complement, else analogous) matches the valence/arousal research — arousal
  drives chroma/warmth, valence drives lightness.
- **Precomputed choreography over blind reaction** — the grid-locked beat
  clock (measured BPM/beatgrid preferred over live onset guessing) is the
  right architecture; the research says push it further into per-track
  **choreography timelines** (section boundaries, energy curves, drops) so
  the director becomes art-directed, not merely reactive.

### 4.2 The rendering platform decision
- **WebGPU reached critical mass** (Chrome 113+, Safari default in iOS 26,
  Firefox 147 in Jan 2026, ~70 %+ coverage) — its payoff here is *battery*
  (~50 % longer for equal particle workloads), which matters for an art piece
  someone leaves running.
- **Three.js r171+ `three/webgpu` + TSL** compiles one shader source to both
  WGSL and GLSL with automatic WebGL2 fallback — the migration is nearly
  free when we choose to take it.
- **Decision for this plan: stay on WebGL now.** The 13 scenes are
  hand-written GLSL against r128; a TSL port is a rewrite, not a patch. The
  plan treats WebGPU/TSL as **Phase V** (the engine's own next generation),
  after the artist-facing phases ship. The adaptive-resolution governor stays
  the floor either way — iPads and mid-range phones are the audience.
- Mobile guardrails the engine already honors, now stated as rules: heavy
  raymarch at reduced internal resolution, one bloom-class pass max,
  thermal-aware frame-time governor.

### 4.3 "Dancing with your eyes" — the new capability tier
This is the heart of the request, and the research turned up a genuinely
exciting frame: **the same design that serves Deaf audiences and
limited-mobility listeners is the more compelling visualizer for everyone.**
Deaf raves and Music: Not Impossible's haptic silent discos choreograph
*texture and location*, not just intensity — that principle translates
directly to screen:

1. **The visual instrument (multi-band separation).** Bass, melody, and
   percussion each get a distinct, *nameable* visual voice (ground swell /
   flowing ribbons / spark bursts) so individual instruments are legible by
   eye. The music becomes readable, not just decorated. The engine's
   per-scene band mapping (π strand = bass, e strand = treble…) is the seed;
   this promotes it to a design contract every scene must honor.
2. **Visible meter.** Beat pulses, bar/phrase structure, and downbeat markers
   so a listener who cannot hear the track can *see* the meter and
   anticipate the drop. The grid-locked beat clock makes this nearly free.
3. **PULSE mode — a first-class scene, not a degraded fallback.** A designed
   calm/high-legibility aesthetic: large forms, strong edges, hue-rotation
   instead of brightness-flashing, auto-selected by `prefers-reduced-motion`
   / `prefers-contrast` and offered as a visible toggle. Reduced-motion
   users currently get damped versions of existing scenes; they should get
   something *made for them*.
4. **Gaze-and-dwell steering.** A fully passive "just watch" mode that runs
   itself, plus optional low-effort steering — dwell on a region 2–4 s (with
   a visible progress ring) to nudge color or intensity; single-switch and
   keyboard equivalents. Someone using eye-tracking hardware (which
   presents as a pointer) can *participate in* the dance. The engine's
   pointer-warp (`ptrWarp`) and INTERACT swirl already answer touch — the
   same channels answer gaze.
5. **Feel-the-beat haptics.** `navigator.vibrate` beat patterns where
   supported (Android/Chrome), Gamepad API rumble as the wider-support path,
   graceful absence on iOS Safari. Enhancement, never dependency.

### 4.4 Safety as an invariant (WCAG 2.3.1)
- **≤ 3 flashes in any 1-second window**, enforced in code, not by review:
  clamp per-frame OKLCH lightness delta for large regions; low-pass
  beat-driven brightness so onsets *ramp*; cap saturated-red flash amplitude
  hardest; prefer movement and hue-rotation over global luminance flashing.
- A visible **"reduce flashing"** toggle in addition to OS settings.
- Validate representative scenes with PEAT before launch.
- These become *tested* invariants: the acceptance harness renders scene
  frames and asserts the luminance-delta cap holds under a worst-case
  synthetic onset train.

---

## 5 · The build plan (phased, each phase shippable)

Each phase is one PR: shippable, verified, reversible. Order chosen so the
artist-visible wins land first and nothing blocks on anything later.

> **Status (2026-07-19):** Phases I–IV shipped on this branch (III's
> gapless/lyrics/offline/Wrapped items remain future work, as does all of
> Phase V). Verified: 39/39 node tests (incl. 6 new flash-safety
> invariants), 27/27 pipeline tests, 28/28 browser acceptance.

### Phase I — Identity & ground truth *(small, fast)*
The site becomes Aethra Kairos's.
- Rebrand per §2: title/meta/OG, wordmark + "powered by Möbius⁸" sub-brand,
  manifest, hero and about copy (artist bio first), `document.title`, AK
  monogram icons via `tools/make_icons.mjs`, README/HANDOFF headers.
- **Hosting cutover** per §6: GitHub Pages from `docs/`, `CNAME` file,
  catalog `base` becomes same-origin `audio/` (kill the
  raw.githubusercontent dependency *before* it hurts a real listener),
  `make_catalog.py` default flips from `--repo` to relative base, headers
  from `netlify.toml` translated (Pages needs none: same-origin).
- Doctor learns two new checks: warn at 90 MB per file; warn as the audio
  tree approaches the 1 GB published-site soft limit.
- *Verify:* acceptance harness green; Lighthouse PWA pass; manual
  DNS/HTTPS checklist for the artist (documented, since only they can touch
  the registrar).

### Phase II — The library layer (the iTunes debt) *(medium)*
- **Playlists**: create/rename/delete, drag-reorder, add-from-anywhere;
  IndexedDB store keyed like everything else (hash-keyed tracks, so
  playlists survive republishing). Export/import as a small JSON file —
  shareable playlists with zero server.
- **Up-Next queue**: play-next vs add-to-queue, drag-reorder, visible queue
  panel distinct from the library.
- **Smart playlists** as saved rules over catalog + local data ("unheard",
  "most played", "under 120 BPM", "new this month") — the solver's feature
  space makes the rule vocabulary rich.
- **Smart shuffle**: weight the existing unique-cycle bag by play-history
  recency (fewer repeats).
- Sleep timer + playback speed (trivial, bundled here).
- *Verify:* solver/queue logic added to `tests/player.test.mjs` via the
  marker-extraction pattern; acceptance run.

### Phase III — Dancing with your eyes *(the headline)*
Everything in §4.3–4.4:
- The multi-band visual-instrument contract applied across scenes; visible
  meter layer; **PULSE mode** as a designed scene; gaze-dwell steering +
  passive watch mode; haptics where supported.
- The flash-safety governor (OKLCH luminance-delta cap) wired between the
  color conductor and the uniforms — one choke point, every scene covered.
- Full-screen now-playing view (immersive layout, engine-derived color,
  motion-art field per album honored when present).
- *Verify:* new acceptance checks — luminance-delta cap under synthetic
  onset train; reduced-motion snapshot renders; keyboard/switch reachability
  sweep; PEAT pass on captured scene video.

### Phase IV — Polish from the giants *(medium, incremental)*
In research-ranked order (§3.1): loudness normalization (features.py already
measures it — emit gain, apply per-deck), gapless for album-continuous
material, synced-lyrics format + renderer (corpus grows album by album),
share kit (track/journey deep links, QR, story cards), offline albums
(deliberate SW carve-out), local Replay/Wrapped from the existing history
store.

### Phase V — The engine's next generation *(the trailblazing)*
- TSL/WebGPU migration (`three/webgpu`, one shader source, automatic WebGL2
  fallback, ~50 % battery win) — scene by scene, governor intact.
- Per-track **choreography timelines** in the catalog (sections, energy
  curve, drops) — the director graduates from reactive to art-directed.
- GPGPU particle voices for the visual instrument (compute where available).
- This phase is deliberately last: it multiplies what exists and rides on
  data (Phase IV analysis fields) and contracts (Phase III) already landed.

---

## 6 · Hosting: aethrakairos.com

**Recommendation: GitHub Pages serves both the site and the audio, same
origin, under aethrakairos.com. Music stays committed to the repo as plain
Git files. No Netlify, no raw.githubusercontent, no Git LFS.**

### Why
- **Same-origin kills every distribution problem at once** — no CORS, HTTP
  Range works (Pages sits on Fastly: `Accept-Ranges`/206 + correct
  `audio/mpeg` type, which Safari requires for seeking), custom domain,
  free HTTPS, edge caching, $0, one repo to manage.
- **The current `raw.githubusercontent.com` base is a trap**: since May 2025
  it is rate-limited to **60 requests/hour per IP, unauthenticated** — and
  every seek is a fresh Range request, so one listener skipping around can
  hit 429s, and everyone behind a shared NAT shares the budget. This must go
  regardless of any other decision.
- **Git LFS actively breaks this design**: Pages serves LFS *pointer files*,
  not audio. MP3s are ~3–4 MB — ordinary Git objects, far under the 100 MB
  hard cap. LFS is banned from this repo.
- **Netlify vs Pages**: both would work, but Pages is GitHub-native (push =
  deploy, zero third-party account) and matches the "upload music to GitHub
  and see it on the page" goal exactly. `netlify.toml`'s two headers become
  unnecessary (CORS not needed same-origin; SW freshness handled by Pages'
  default `max-age=600` — acceptable, and the in-app Update button already
  handles the update dance).

### Capacity (researched numbers)
- Published-site soft limit ~1 GB → **~250–330 web MP3s**; a < 200-track
  catalog fits with headroom.
- Bandwidth soft limit ~100 GB/month → **~28,000 full-track streams/month**
  (more in practice; Range + edge cache mean partial pulls).
- Per-file hard cap 100 MiB → only long-form mixes are at risk; doctor warns
  at 90 MB.

### Setup (Phase I; DNS steps are the artist's, documented)
1. Repo → Settings → Pages → deploy from `main` `/docs`.
2. Custom domain `aethrakairos.com` (GitHub writes the `CNAME` file);
   registrar gets the four A records (185.199.108–111.153), four AAAA
   records (2606:50c0:8000–8003::153), and `www` CNAME → `USER.github.io`;
   then **Enforce HTTPS** (cert takes up to ~1 h).
3. Audio moves under the published tree (`docs/audio/<album-tag>/…`);
   `catalog.json` `base` becomes relative `audio/`.

### The graduation path (when success demands it)
The catalog's `base` field was designed for exactly this. When bandwidth
emails start arriving (~100 GB/month = real traction):
1. Create a **Cloudflare R2** bucket ($0 egress, forever) at
   `media.aethrakairos.com`; upload the `audio/` tree.
2. Flip one line — `"base": "https://media.aethrakairos.com/audio"` (R2 must
   send `Access-Control-Allow-Origin` once cross-origin; it can).
3. The site stays on Pages; only the heavy bytes move. Nothing else changes.
Alternatives at that tier: Backblaze B2 + Cloudflare (free egress via
partnership), Bunny CDN (~$0.01/GB). R2 is the default pick.

---

## 7 · Architecture principles

1. **One file is the product; the pipeline is the factory.** The single-file
   player stays a single file — it is the distribution guarantee (open it
   anywhere, it works). Growth happens by *sections* (`§n`) with pure,
   marker-extracted, node-testable cores (`@solver`, `@color` already work
   this way; new subsystems follow the same pattern).
2. **Precompute at publish, glide at runtime.** Anything expensive (loudness,
   beatgrids, key detection, lyric timing) happens in Python at publish time
   and ships in `catalog.json`; the browser only interpolates.
3. **The catalog is the API.** Every new feature that needs data gets a
   catalog field with a graceful-absence rule, and `doctor` learns to check
   it. Hand-edited catalogs must degrade, never break.
4. **iOS is load-bearing.** The audio-element-never-enters-the-graph
   invariant is non-negotiable; every audio feature is designed twice (graph
   path, element path).
5. **Persistence is sacred.** Hash-keyed stores survive republishing;
   schema migrations are additive; the IndexedDB name never changes.
6. **Accessibility is a feature tier, not a compliance pass.** Reduced-motion
   is already respected; §4 promotes safety (flash-gating) and access
   (Pulse mode, contrast) to tested invariants.
7. **Verify like the repo verifies.** Every phase lands with its section of
   `tests/` extended and the acceptance harness green.

---

## 8 · Risks & honest unknowns

- **Bandwidth ceiling** — a static host's free tier has a monthly transfer
  budget; a viral moment could exceed it. Mitigation: the catalog `base` URL
  makes audio relocatable to a free-egress CDN in one line (§6).
- **The 100 MB file limit** — long-form mixes may exceed GitHub's hard
  per-file cap; the pipeline should warn at 90 MB (doctor check).
- **WebGPU temptation** — the research says the TSL/WebGPU migration is
  nearly free *when we take it*, but a 13-scene GLSL port is still a rewrite;
  it is deliberately Phase V, and the floor remains WebGL + the existing
  governor, because iPads and mid-range Androids are the audience, not RTX
  rigs.
- **Lyrics timing labor** — synced lyrics are precompute-heavy per track;
  the format ships first, the corpus grows album by album.
- **A merged-history caveat**: `HANDOFF.md` records that the album-schema
  base build named in an earlier epic never existed in this repo; this
  document plans from **what is actually here**, verified by reading it.

---

## 9 · Sources

Curated from the July 2026 research pass (three parallel streams: streaming
features, visual/accessibility state of the art, hosting).

**Streaming-service features**
- https://newsroom.spotify.com/2025-11-13/shuffle-update-fewer-repeats/
- https://newsroom.spotify.com/2025-12-29/year-in-features/
- https://support.spotify.com/us/artists/article/canvas-guidelines/
- https://routenote.com/blog/apple-music-drops-fresh-features-at-wwdc25-animated-lock-screen-album-art-lyric-translation-lyric-pronunciation-and-more/
- https://www.macrumors.com/2025/06/11/ios-26-animated-lock-screen-album-art/
- https://www.techradar.com/audio/audio-streaming/the-youtube-music-recap-for-2025-is-rolling-out-now-with-new-ai-tricks-heres-how-to-get-it
- https://github.com/regosen/Gapless-5 · https://github.com/mcanam/liricle
- https://wiki.hydrogenaudio.org/index.php/ReplayGain

**Visual engine & color**
- https://web.dev/blog/webgpu-supported-major-browsers
- https://appdevelopermagazine.com/webgpu-in-ios-26/ · https://caniuse.com/webgpu
- https://www.utsubo.com/blog/threejs-2026-what-changed
- https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- https://blog.maximeheckel.com/posts/painting-with-math-a-gentle-study-of-raymarching/
- https://mtosmt.org/issues/mto.12.18.2/mto.12.18.2.gawboy_townsend.php (Scriabin ↔ circle of fifths)
- https://en.wikipedia.org/wiki/Chromesthesia
- https://css-tricks.com/almanac/functions/o/oklch/
- https://arxiv.org/pdf/2507.04758 (Music2Palette, emotion-aligned palettes)
- https://github.com/willianjusten/awesome-audio-visualization
- https://en.wikipedia.org/wiki/Patatap

**Accessibility & multi-sensory**
- https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- https://www.npr.org/2023/07/17/1186173942/vibrating-haptic-suits-give-deaf-people-a-new-way-to-feel-live-music
- https://caniuse.com/vibration
- https://arxiv.org/html/2508.19544v1 (browser eye-tracking)
- https://www.apple.com/newsroom/2025/05/apple-unveils-powerful-accessibility-features-coming-later-this-year/

**Hosting**
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/
- https://github.com/orgs/community/discussions/50337 (Pages ✗ LFS)
- https://docs.github.com/en/billing/concepts/product-billing/git-lfs
- https://developers.cloudflare.com/r2/pricing/
- https://smoores.dev/post/http_range_requests/
