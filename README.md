# Aethra Kairos · powered by the Möbius⁸ engine

**The artist's own player — free, in your browser, no login, ever.** Real
music dressed in generative cover art, a beat-mixing engine that DJs the
catalog, and an abstract-art visualizer that *dances* to it — all in one
static HTML file.

One HTML file that is an artist's own distribution channel: the Aethra Kairos
catalog (ERRERlabs), streamed same-origin from GitHub Pages at
**aethrakairos.com**, discoverable through a journey engine, installable on a
phone's home screen, playing correctly through Bluetooth / AirPlay / CarPlay /
the lock screen, and remembering everything — locally, never on a server.
The repo ships a real starter catalog — three Aethra Kairos singles (Möbius
Walking, Breathing, Finished Master), each analysed by the same pipeline as
any master and given a cover drawn from its own key. Hosting setup lives in
`HOSTING.md`; the researched roadmap in `DESIGN.md`. The Möbius⁸ engine is
developed in [kmay89/quantum_jukebox-](https://github.com/kmay89/quantum_jukebox-)
and ported here — this repo is the artist's own distribution.

```
docs/index.html            the player — one file
docs/manifest.webmanifest  + docs/sw.js + docs/icons/     the PWA shell
docs/catalog.json          the manifest the player fetches (schema v2)
docs/audio/<album-tag>/…mp3  wizard-produced web MP3s, served same-origin (masters never enter this repo)
dna/…fp                    Haitsma–Kalker fingerprint index (never fetched by the player)
make_catalog.py            catalog builder · dedupe · fingerprint gate · features · doctor
features.py                Python feature extractor (wizard-matching definitions)
fingerprint.py             the perceptual identity matrix (index / check / verify)
publish.sh                 the whole maintenance loop, one command
LICENSE-CODE               MIT (the code)
LICENSE-AUDIO              all rights reserved (the recordings)
```

## catalog.json v2

One schema, one parser. The player **refuses a v1 flat catalog with a toast
naming the problem** — it never guesses.

```json
{
  "version": 2,
  "label": "ERRERlabs",
  "artist": "Aethra Kairos",
  "license": { "code": "…/LICENSE-CODE", "audio": "…/LICENSE-AUDIO" },
  "base": "audio",
  "albums": [{
    "title": "Spiral Transmission", "tag": "spiral-transmission",
    "year": 2025, "genre": "Ambient Techno", "art": "cover.png", "info": "…",
    "tracks": [{
      "title": "Amber Axis", "file": "01-amber-axis.mp3", "duration": 274.3,
      "sha256": "…", "published": "2026-07-18",
      "features": { "bpm": 122.0, "energy": 0.62, "brightness": 0.41,
                    "entropy": 0.55, "onsets": 0.30 }
    }]
  }]
}
```

`duration`, `sha256`, `published` and `features` are **mandatory at publish
time** — `make_catalog.py` fails the build without them. The player degrades
gracefully on a hand-edited catalog: no features → the track is
journey-ineligible and the Console says how many tracks it can see; no duration
→ probed over the wire as before. Feature normalization (the 0–1 scaling) is
recomputed over the whole catalog every build, so the space stays calibrated as
the library grows. `bpm: 0` means unpitched/ambient — the solver treats it as a
wildcard, eligible anywhere, never forced to match a tempo.

A `catalog.sig` (minisign) may sit next to the JSON. Present and valid → a
small "signed · ERRERlabs" mark in the library header. Absent → fine. Invalid →
a warning toast, never a block. (Verification needs the minisign public key
pasted into `MB8_SIGNING_PUBKEY` in the player and Ed25519 WebCrypto support.)

## The maintenance loop — add music forever without thinking

```bash
./publish.sh                      # masters/ → catalog → doctor → commit → push
./publish.sh masters album40.zip  # wizard ZIPs unpack first
python3 make_catalog.py doctor    # the monthly once-over
```

Duplicate-proof at three levels:

1. **Ingest** — the wizard's SHA-256 IndexedDB ledger catches exact re-drops.
2. **Catalog** — `make_catalog.py` hashes every file. A known hash at a new
   path is a **move** (path updates, `published` survives, DNA references stay
   intact); a known hash at the same path is a no-op; two entries with one
   hash cannot be emitted.
3. **Perceptual** — the Haitsma–Kalker gate runs on every *new* hash. A CLONE
   verdict (best-10-second-window bit-error rate < 0.14) refuses the add **by
   name**; `--force` overrides and stamps the override into the catalog entry
   so honesty survives.

Features come from the wizard's JSON report when present, else from
`features.py` (BS.1770-4 K-weighted loudness with the wizard's exact 48 kHz
biquads, power-weighted spectral centroid and entropy, SuperFlux-lite onset
density, autocorrelation tempo with octave folding). Both cache raw measures
into `features-cache.json` keyed by SHA-256 — re-running the build recomputes
nothing, and any machine reuses the cache. WAV decodes natively; MP3 needs
`ffmpeg` on PATH; both need `numpy`.

`make_catalog.py doctor` validates: schema v2, every mandatory field, art per
album, no duplicate hashes, fingerprint-index currency, catalog size against
the 500 KB gzip budget, and N sampled track URLs probed for
`access-control-allow-origin: *` + HTTP 206 (skippable with `--no-net`). Exit
is nonzero on any failure, and `publish.sh` is gated on it.

**Masters never enter the public repo.** Any `.wav` under `docs/audio/` fails
the build loudly; `publish.sh` refuses wizard ZIPs containing one.

## The Journey Console (key `J`)

One solver, three faces. Set the dials, press **ENGAGE**, receive a dealt
playlist that plays through the normal queue — a journey *is* an ordering, so
shuffle disengages with a note rather than silently fighting it.

- **FROM / TO** — the current track, any track, or a point tapped on the Map.
- **LENGTH** — 30 min · 1 hr · 2 hr · 12 tracks · 24 tracks; time targets land
  within ±10 %.
- **HEAT** — 0 = coherent drift between neighbors, 1 = pure Fisher–Yates chaos;
  the label under the knob names the regime in plain words.
- **ERA** — the time-machine dial (MEMORIES only): left arc sweeps the
  catalog's release years; right arc sweeps *your own listening past*, and
  stays honestly grey until enough history exists ("the machine is still
  recording — come back in a season").

**JOURNEY** interpolates FROM→TO through the normalized feature space and picks
the nearest unused track at each step, jittered by HEAT, with a running
duration correction. **QUANTUM** is the randomness machine: each *next* draws
from a HEAT-radius neighborhood, crypto-seeded, composed with the unique-cycle
bag; the Console renders the superposition as a probability cloud and pressing
next collapses it. Deliberately memoryless — skips teach nothing and store
nothing. Hearts weigh the dice, slightly. **MEMORIES** replays an era —
release-year windows from day one, listening-history windows once the player
has watched you listen for a while (what mattered then leads).

**The Map** plots the whole library on brightness × energy — the amber→ice
axis made spatial, every point colored through a constant-lightness OKLCH
sweep, the current track pulsing. Tap to set FROM, tap again for TO; **drag a
curve and the curve is the playlist**. One canvas, brute-force math — at 1,000
points a 1-hour journey deals in ~15 ms.

Any dealt playlist can be **saved**: the save stores the *dial settings and
seed*, not just the track list, so a saved journey offers both "replay exactly"
and "re-deal with today's library."

**Rituals — quick entry for a moment.** One tap deals a playlist for what
you're doing: *Going for a run* (steady warm-up building into full drive,
tempo pulled toward 160), *Relaxing dinner*, *Deep work*, *Bedtime* (a slow
descent to the quietest thing you own), *Wake up slowly*, *Party*. A ritual is
nothing clever hiding behind a curtain — it is **dials, pre-turned**: a
FROM→TO pair of feature-space points, a HEAT, and a length, dealt by the same
solver as everything else, in the catalog-normalized space (so "quiet" means
the quietest music *you* own). They live as chips at the top of the Console,
as shareable `?ritual=run` links, and as **home-screen shortcuts** — long-press
the installed app icon and "Bedtime" is right there (where the platform shows
manifest shortcuts; iOS doesn't, so the Console chips carry it there). Dealt
rituals can be saved like any journey and re-dealt against a grown library.

## The mix engine — a mobile DJ that knows when not to

Toggle **MIX** in the transport HUD and transitions stop being seams. The
architecture is MixMeister's, reborn: every decision is made *ahead of
playback* from publish-time metadata, and the runtime only executes.

**At publish time** every track gets a `mix` block: a beat grid (an Ellis
dynamic-programming beat tracker over the same SuperFlux onset envelope the
features use, peak-snapped and latency-calibrated against synthetic ground
truth), a downbeat, a **Camelot key** (chromagram → Krumhansl–Schmuckler),
16-bar mixable in/out regions, and a `mixable` confidence score.

**The planner** decides each pair once, as data: **beatmix 8/16/32 beats**
(longer blends for cleaner harmony) when both grids are stable, the
octave-folded tempo delta is ≤ 8 %, and the keys sit within reach on the
wheel; a plain **equal-power fade** when anything fails — *the piano rule:
rubato, ambient, and broken-grid material is never forced onto a grid*; and
**gapless** for sequential tracks of the same album, because the artist
sequenced those. Half-time is family: 70 against 140 BPM mixes, it doesn't
clash.

**The runtime** preloads the next deck, starts it on a bar line of the
outgoing track's grid, and stretches both onto a **master tempo curve** that
glides from A's tempo to B's across the overlap (`playbackRate` +
`preservesPitch` — the browser's own pitch-preserving stretch, so playback
authority never leaves the element, even on iOS). A per-beat **drift lock**
compares grid phases and trims the incoming deck within ±0.4 % — measured at
~10 ms of beat-phase error in the acceptance run. Where the WebAudio graph
exists, the **one-bass rule** is enforced with low-shelf filters: the
incoming bass is ducked and swapped in one move at the midpoint. On iOS the
mix is volume-envelope-only (the locked-pocket invariant outranks EQ), and
with the screen off, plans degrade to crossfades on coarse timers — the
music never stops, it just mixes less bravely.

**Fix it once, fixed forever.** The Console's **mix tuner** shows the
planned transition for the current pair: override the type (beatmix 8/16/32,
fade, gapless), nudge where the next track enters in ¼-beat steps, and nudge
a track's beat grid in 10 ms steps. Fixes are keyed by content hash — a pair
fix applies every time those two tracks ever meet, a grid fix follows the
track through every republish — and **Export fixes** writes `mixfix.json`,
which `make_catalog.py` merges at the next publish so corrections become
canon on every device.

A seamless hour is one tap: a ritual picks the arc, the solver deals the
order, MIX compiles the transitions.

## The Crate (key `C`) — the whole label on one table

An iTunes-density table of every track — title, album, time, BPM, key, energy
— with one column no player on the market has: **Match**. Every row is scored
against the track that's playing by the *same planner that performs the
transition*, so a green "mix 32" is a promise, not a guess. Key chips are
colored around the Camelot wheel; sort by any column (Match puts the safest
next tracks on top, Serato-style); filter by anything. Per row: play now,
**mix next** (commits it as the next track — the mixer plans the seam), and a
heart. The footer holds the showcase button: **Chart a set from here** —
30 min / 1 hr / 2 hr — which arranges the crate into one continuous line by
walking best-matches (energy kept to an arc), deals it as the queue, switches
MIX on, and tells you honestly how many seams will beatmix. For a catalog of
hundreds of largely instrumental tracks, that is the whole thesis in one tap:
the library *is* a set.

## The dance engine — motion that acts out the music

The field does not snap to the beat and decay; it *dances through* it. Because
the catalog carries a measured beat grid, the room knows where the beat **is**,
not just that it happened — so a pure, unit-tested motion module shapes designed
movement the way an animator or a dancer would:

- **`dancePulse`** — one beat of motion with **anticipation** (a pull-back that
  dips below rest just before the hit), **impact**, and **follow-through** (a
  damped rebound after). Staccato material (high onset density) moves sharp;
  legato moves long. Downbeats hit harder.
- **`danceSway`** — where the body leans inside the bar and rises across the
  32-beat phrase; energy widens the lean, the loop closes seamlessly at the
  barline.
- **`danceTimeWarp`** — musical time itself: the clock surges gently through
  each hit and breathes between, bounded to ±45 ms and provably monotone (time
  never runs backwards), continuous at the beat wrap so the surge is felt, never
  seen as a jump.

The runtime feeds the danced pulse into every scene's beat uniform (so all 13
scenes inherit anticipation/impact/rebound instead of snap-decay), warps the
clock, and leans the whole room — tilt into the bar, plié into the hit, rise
with the phrase, a breath that never quite sits still, and a camera that leans
with the music. Paused, everything settles to breathing — a dancer at rest is
still breathing. When there is no grid (mic, unanalysed local files) it
freewheels on the tempo guess and resyncs softly to onsets.

## The colour engine — light that reads the music

The palette is not a mood-board on shuffle; it is derived from the music by
a pure, deterministic module (`colorPlan` — extracted and unit-tested like
the solver, portable to any surface that takes RGB):

- **Key → hue.** The track's detected key maps around the Camelot wheel to
  a root hue, using the *same mapping the Crate's key chips use* — the
  circle of fifths is a colour wheel (Scriabin's idea, wired to real
  analysis). Mix harmonically and the room glides to a neighbouring hue;
  the table and the lights always agree.
- **Mode → temperature.** Minor keys sit darker, cooler, quieter; major
  keys warmer and higher.
- **Character → harmony scheme.** Consonant calm reads *analogous*;
  driving energy earns a *complementary* accent; dense, entropic material
  opens to a *triad*.
- **Arousal → chroma; acts → heat.** Energy drives saturation
  monotonically, the five-act arc breathes chroma and lightness live, and
  energy-phase peaks/breaks push and pull the accent.
- **OKLCH throughout.** All colour math happens in a perceptually uniform
  space, gamut-mapped by chroma reduction (never channel clipping), and
  every change glides over **eight beats of the measured grid** through
  OKLCH's shortest hue arc — a lighting cue, not a crossfade through mud.

Three dots in the HUD show the live palette next to the key and scheme.
Unkeyed material (local files, the mic) plans from live brightness and
entropy and re-deals itself periodically. This is the contract a
Sphere-class surface wants: features in, palette out, deterministic,
testable, 60 fps cheap.

## The storyteller field — abstract art that answers back

The visualizer is one engine now (the best of the retired quantum/π-e pages
folded into Möbius⁸, see `legacy/`): **thirteen scenes** — spiral, helix,
Möbius band, starburst, nebula, tunnel, **RIBBONS** (six spectral ribbons
that dissolve into particle mist as the music's entropy rises), the
raymarched fractal field, and the new wing: **COMETS** (neon meteor rain,
every streak its own colour), **FERN** (an iterated-function fractal drawn
dot-by-dot as the track plays — a different species every visit), **ROSETTE**
(spirograph rings drawn three times in offset palette channels, the
chromatic fringe blooming on hits), **SLINKY** (a chalk-grain coil whose
ambiguous spin you can argue with by dragging), and **OP-ART** (a flat
pattern machine rolling between an isometric cube tessellation, a circular
labyrinth around a black hole, and an infinity-mirror dance floor lit on
the grid). Keys `1`–`9` and `0` reach the first ten; the scene dots reach
them all. Three things keep it feeling like a storytelling machine
rather than a screensaver:

- **Acts.** Every track runs a five-act arc — OVERTURE · RISING · APEX ·
  TURN · RESOLVE — read from track progress and bent by the live energy ratio
  (an early drop reads as APEX sooner). The act leans the whole room: shader
  heat (`uAct`), camera distance, world-spin speed, scene-cut pace, palette
  warmth, and which scenes the auto director favors. The current act shows in
  the HUD next to the scene name.
- **Variation rolls.** Every scene re-rolls its proportions each time it
  appears — spiral turn count and spin direction, helix coil count and span,
  the band's number of half-twists (always odd — it stays a Möbius band),
  starburst reach, nebula swirl, tunnel radius and speed. The same scene
  never plays the same way twice.
- **Touch.** Drag steers the camera (the auto rig waits ~9 s while you hold
  it), scroll walks in and out, double-tap fires a shockwave impulse through
  the scene, and particles near the pointer bend away from your hand
  (`uPtr` view-space warp in every point shader). All of it is optional —
  the director plays the whole show hands-free.

## The player remembers

All local (IndexedDB), never a server, never sync:

- **Transport** — queue, cycle state, position, shuffle/repeat, volume, active
  journey. Kill the app mid-track, relaunch: it restores **paused at position**
  (phones require a gesture to start audio) — one tap resumes. Tracks that
  left the catalog drop from the restored queue with one toast naming how many.
- **Play history** — append-only events keyed by content hash, so republishing
  never orphans them. A play counts at ≥ 50 % or 60 s; skips are their own
  event type. This is the MEMORIES substrate and it never leaves the device;
  "Forget play history" lives in the help panel behind a typed RESET.
- **Favorites** — hash-keyed hearts, a favorites filter in the library, and a
  slight bias on the QUANTUM draw.

## Everywhere-audio — the honest contract

Install from the browser menu or the Install button (appears only when the
browser offers it — never a nag). The service worker caches the app shell
cache-first and catalog.json stale-while-revalidate — a new album shows on
second load at worst, and second boot is faster than first. **Audio requests
pass through to the network untouched**: the Cache API does not speak Range,
and intercepting audio breaks seeking on iOS. Offline with a warm cache boots
to the library with honest "streaming unavailable" states. Pinning albums
offline is out of scope this build — a 1,000-track library is multiple GB, and
we don't fake it.

A web app gets **no CarPlay grid icon**. What it gets — and what this build
drives completely — is the system **Now Playing** surface everywhere: title,
artist, album, artwork, play/pause, next/prev and seek via MediaSession (all
handlers including `seekto`/`seekforward`/`seekbackward`, `setPositionState`
kept current through seeks and rate changes, artwork in multiple sizes). That
covers the lock screen, control center, Bluetooth AVRCP (steering wheels,
headphone buttons), the CarPlay Now Playing screen, and watch controls.
AirPlay: `x-webkit-airplay="allow"` plus a route button that calls the WebKit
target picker where it exists and the Remote Playback API elsewhere — hidden
when neither does.

**Self-updating, seamlessly.** Every player release carries a build id
(stamped into `index.html` and `sw.js` by `tools/stamp_version.py`, which
`publish.sh` runs automatically — a changed player is a changed service
worker by construction). An installed home-screen copy checks for releases
whenever it comes to the foreground and every 30 minutes while open; when one
is waiting, an **Update** button appears in the top bar — never a forced
reload, never a nag. Tapping it saves your place first, swaps workers,
refreshes, and the normal restore path brings everything back: queue,
position (paused, one tap resumes), hearts, history, saved journeys. All of
that lives in IndexedDB, which updates never touch — there is nothing to
lose. The current build id shows at the bottom of the help panel. The catalog
updates independently of the app (stale-while-revalidate), so new albums
never wait for a player release.

**The iOS backgrounding invariant: playback never depends on the WebAudio
graph.** On iOS the `<audio>` elements stay direct-to-output —
`createMediaElementSource` is a one-way door, and a suspended context would
silence anything routed through it the moment the screen locks. The visualizer
is allowed to go dark in the pocket; the music is not allowed to stop.
Everywhere else the graph carries the analyser exactly as before, with
`context.resume()` re-armed on every gesture, play event, and visibilitychange,
and audio-session interruptions (a phone call) reflected in the UI and
recovered cleanly.

## The starter catalog & generative cover art

`docs/catalog.json` ships three real Aethra Kairos singles — **Möbius Walking**
(7B · 126 BPM), **Breathing** (7B · 126 BPM), **Finished Master** (7B · 129 BPM)
— one harmonic family, all inside the 8 % tempo gate, so they beatmix into each
other out of the box. Each was decoded and run through `features.py` exactly like
a catalog master (grid, key, mixable, energy). `tests/test_pipeline.py` re-hashes
the audio on disk against the manifest, so the label's word is checked, not
assumed.

Their covers are generated, not stock: `tools/make_art.mjs` renders a 1024×1024
sleeve per record whose **hue comes from the track's detected key** (the same
Camelot→colour-wheel mapping the colour engine and the Crate use), whose density
and amplitude come from the analysed energy, and whose motif comes from the
album — a Möbius ribbon walking across the frame, breathing concentric rings, a
spectral burst from a pressed master. Deterministic from the track hash (a record
always renders the same face) and rendered in a headless browser, so a new record
dresses itself:

```bash
node tools/make_art.mjs            # covers for any album missing one
node tools/make_art.mjs --force    # regenerate all
```

The library shows them as art-forward record cards — large covers that lift on
hover and glow in their own key.

## Streaming hosts

The primary host is **GitHub Pages, same origin** — the audio tree lives in
`docs/audio/` beside the player, so CORS never arises and `Accept-Ranges`
(seeking) just works. Do **not** use `raw.githubusercontent.com`: since May
2025 it is limited to 60 unauthenticated requests/hour per IP, and every seek
is a request — real listeners hit 429s. Cloudflare R2 is the growth path once
Pages bandwidth (~100 GB/month) is outgrown (see HOSTING.md); any cross-origin
host must answer `Access-Control-Allow-Origin` (without it the analyser reads
silence) and `Accept-Ranges`. GitHub release assets fail the CORS check — do
not use them. Probe any new host before trusting it:

```bash
curl -s -D - -o /dev/null -H "Origin: https://example.com" -r 0-1 "$TRACK_URL" \
  | grep -iE '^(HTTP|access-control-allow-origin|accept-ranges)'
```

You want `access-control-allow-origin: *` and a `206` — which is exactly what
`make_catalog.py doctor` samples for you.

## Shuffle

Unchanged and inviolable: a permutation bag, not a dice roll. Every track plays
exactly once per pass before anything repeats; repeat-all deals a fresh
permutation at the seam that never opens with the track that just closed;
tracks added mid-cycle splice into the unplayed remainder. The journey engine
composes with this contract — journey mode is itself an ordering, QUANTUM
carries its own unique-cycle pass, and engaging either disengages shuffle with
a note.

## Local files still work

With no catalog.json present the app is the old local-files experience: drop
audio anywhere; mic input drives the field. The shipped demo is **Möbius
Walking** (`docs/audio/mobius-walking.mp3`) — a real ERRERlabs track
analysed by the same pipeline as the catalog (126.05 BPM measured grid,
key 7B, mixable 0.66), so the beat clock, the colour engine and the mixer
all engage from the very first tap. Offline with a cold cache, a
synthesized loop stands in.
Catalog chrome (Library, Console, Install) hides when irrelevant.

## Tests

```bash
python3 tests/test_pipeline.py      # 29 tests: build, dedupe, gate, doctor, features, mix,
                                    #   + the shipped catalog's hashes match the audio on disk
node tests/player.test.mjs          # 38 tests: solver, quantum, history, restore, planner,
                                    #   colour, dance (extracted from the shipped HTML, not a copy)
python3 tools/make_synthetic_deploy.py /tmp/mb8 1000
node tools/acceptance.mjs /tmp/mb8  # 30 browser checks: boot < 2 s warm, deal < 100 ms,
                                    #   restore-paused, v1 rejection, SW audio bypass, crate,
                                    #   13-scene sweep, acts, touch, colour, dance, real demo
python3 tools/make_mix_fixture.py /tmp/mb8m
node tools/mix_acceptance.mjs /tmp/mb8m      # 22 checks: grids, keys, live beatmix,
                                    #   phase lock < 40 ms, gates, crate, mixfix
node tools/update_acceptance.mjs /tmp/mb8u   # 9 checks: publish → Update button →
                                    #   one tap → new build live, state intact
```

Physical-device acceptance (iPhone lock screen ≥ 10 min, Bluetooth
next/prev, CarPlay Now Playing, AirPlay routing, interruption recovery) needs
hardware — see HANDOFF.md for the checklist and current status.
