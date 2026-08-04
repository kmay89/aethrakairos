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
- **Three.js/WebGL**, 18 registered scenes, each a hand-written GLSL
  factory: MÖBIUS SPIRAL, π–e HELIX, MÖBIUS BAND, STARBURST, NEBULA, TUNNEL,
  RIBBONS, FRACTAL FIELD (raymarched, 1,000 dice-rolled variants), COMETS,
  FERN (IFS fractal that grows with track progress), ROSETTE, SLINKY, OP-ART,
  PULSE, PARLOR, AUREA, HALO, and the LAVA LAMP.
- **The lamp's wax is a fluid** (`@lava` pure block): a position-based fluid
  (Macklin & Müller) of ~190 particles — density as a *constraint* solved in
  two Jacobi sweeps, Akinci cohesion as the surface tension, XSPH viscosity,
  a counting-sort neighbour grid, and one neighbour list a step reused by
  every pass. The constraint only ever pushes: letting it pull is what made
  the first version hum, because a position correction becomes a velocity
  when divided by h. Drag and heat both ride the density deficit the solver
  already computes, so "on the surface" costs nothing to know. Thermodynamics
  as before (Boussinesq lift, Arrhenius viscosity, a divergence-free
  Rayleigh–Bénard stream function). Rendered by SPLATTING the field into a
  small target — cost becomes O(N·sprite) + O(pixels) instead of
  O(pixels·N) — then shaded from four taps: screen-exact AA from
  (F−iso)/|∇F|, real normals, Beer–Lambert thickness, three-wavelength
  refraction, and temperature carried in its own channel. The solver caps
  its own step, so it is step-size independent; headless, seeded, and
  unit-tested for not leaking, not compressing, and going *quiet* when
  nothing is touching it.
- **A director** (~6787): weights scenes by the music's live features, runs a
  five-act story arc across each track, cuts on energy peaks/breaks, drives a
  camera rig (bass→FOV, onset→dolly).
- **A real color engine** (~3044): root hue from the track's detected key
  mapped around the Camelot wheel; all blending in **OKLCH** (perceptually
  uniform, gamut-mapped by walking chroma down); harmony scheme chosen from
  musical character (high entropy → triad, high energy → complement, else
  analogous, and material that has genuinely come apart → **spectrum**, a full
  wheel anchored on the key's own hue); glides take **eight beats of the
  measured grid**, not wall-clock seconds. The three plan colours are stretched
  into a **128-texel cyclic gradient** every scene samples, interpolated in
  OKLCH so the middle of a sweep does not go grey the way a straight RGB blend
  always does.
- **A highlight rolloff and a white budget** (`INK`): additive light is
  unbounded and a framebuffer is not, so a stack of glowing sprites used to
  clip channel-by-channel and lose its *hue* before it lost its brightness —
  the white blob with a coloured rim. The field now accumulates in a
  half-float target (probed, never assumed; devices without one — and ECO power
  mode, which pays for no extra passes — fall back to a tighter additive trim),
  and a final GRADE pass compresses the max channel along a soft knee,
  rescaling the triple by the same factor so chromaticity survives any drive.
  The curve approaches 1 from below without arriving: **light alone can no
  longer make white**. Bleaching is spent from a budget that the act and the
  structure ceiling open, so it belongs to the drop rather than to the volume.
- **Audio analysis** (~1270): live FFT with spectral-flux onset detection and
  BPM folding, or — preferred when the catalog provides it — a **grid-locked
  beat clock** from precomputed per-track analysis, so visuals land on the
  beat rather than guessing at it.
- **Adaptive resolution governor**: the heavy raymarched scene lowers its
  render scale instead of dropping frames.

### 1.2a·5 The native Mac shell
- A thin Tauri process that hosts the LIVE site, so the player is always the
  newest deploy and the app binary only updates for native changes. One window,
  window state remembered, a signed update feed.
- It does exactly what the web cannot do for itself and nothing else — report
  who is hosting the player, offer the native update rather than impose it, open
  the macOS privacy pane, enumerate displays, put a stage window fullscreen on a
  chosen one — or small and above every other app where there is only one screen
  — and fold the booth into a corner above everything. Each is a command that
  resolves `null` in a browser, so the player never branches on which shell it is
  in (§1.2n). The shell also *names* what it can do (`native_info.caps`), so a
  player that is always newer than the binary around it asks for a native trick
  by name and falls back on its own where the answer is no.

### 1.2b Self-update, and the app's account of itself
- **Two paths, one policy.** A stamped deploy installs a new worker that
  *waits*; applying hands over (`SKIP_WAITING` → `controllerchange` → reload).
  An unstamped deploy still lands, because the live worker byte-compares
  `index.html` on every boot and check. The decision of *when* an update may
  apply itself lives in one pure, tested map (`updateGate`).
- **A tap is never a no-op.** The failure that motivated this: a second client
  applies first, its `SKIP_WAITING` activates the new worker, and every other
  client's `registration.waiting` becomes null — so `applyUpdate()` refused and
  silently hid the button, stranding a page on old code while the new shell sat
  in the cache beside it. A reload is always a way forward, and now it takes it.
  A `controllerchange` nobody asked for is likewise read as "the shell running
  here is stale" — except the first claim of an uncontrolled page, which is a
  first visit and not an update.
- **"Later" is stored, counted, and answered once.** The snooze used to be a
  variable, so the next reload forgot it. The button carries the deferral count
  as a badge, holds quiet through the snooze, reminds once on expiry, and stops
  talking past five deferrals.
- **A loop brake.** Three automatic swaps per session, then automatic
  application stands down — a host whose shell never compares equal cannot turn
  self-update into a reload loop. A deliberate tap is never rate-limited.
- **An offer is falsifiable, and applying is remembered.** Nothing is shown until
  the deployed stamp has been read from the origin past every cache — including
  our own worker's, which is where the first attempt at this quietly failed
  (§1.2j). An offer has an identity, applying stores it, and meeting the same one
  again is proof the swap changed nothing: it is answered in the log, not with
  another card.
- **The activity log** (`ACTIVITY`): a bounded, device-local ring of what the
  app actually did — updates, plays, library loads, connectivity — with
  consecutive repeats coalesced into counts, shown at the foot of the Console.
- Verified by `tools/update_probe.mjs` on a real origin with real service
  workers: stamped and unstamped deploys, the two-client handover, and the whole
  "Later" lifecycle. The pure parts (`updateGate`, `updateReminder`,
  `activityPush`, `activityAgo`, the progress/estimate/watchdog trio) are in the
  unit suite. Neither alone would have caught the dead button; together they do.

### 1.2c The seam is a relationship between two grids, not a wall-clock event
- **Eight beats is the default blend**, and the match score no longer reads blend
  length — harmonic distance and tempo proximity are properties of the pair, and
  conflating them with plan length marked every well-matched pair as mediocre once
  the default shortened.
- **The glitch, found and fixed.** `tools/mix_probe.mjs` measured a real seam on a
  real graph and separated the two conditions: main thread free, beat-phase error
  **0.3 ms**; visualizer running, **114–119 ms** — a quarter beat at 124 bpm, and a
  failure of the engine's own 40 ms contract. It now reads **1.9–8.0 ms under
  render load**, and both `mix_acceptance` phase checks pass (0.9 / 0.4 ms).
- The cause was not the servo's cadence but the seam's *placement*. The incoming
  deck was dropped at the absolute `plan.startB` at whatever instant the animation
  loop noticed A had crossed `plan.startA`, so the grid offset was exactly the
  frame's lateness. `seamEntry()` places B at `startB + (A's actual position −
  startA)` instead: the grids agree however late the call arrives, which makes the
  lock a fact about the two tracks rather than about the frame rate. Pure and
  unit-tested, including the case of a call a whole beat late.
- **`SEAM_LEAD` (450 ms).** Every seam is now scheduled that far ahead on the audio
  clock — one origin for the gain curves, the bass swap, the filter sweep and the
  echo send — and a beatmix is *triggered* that early so the fader still opens on
  A's bar line. A media element takes 200–700 ms to resume under load; the lead-in
  is a window it cannot be heard through. `seamLeadFor()` never asks a deck to roll
  from before the start of its own file, so a track cued near its top gets a
  shorter lead and an honest degradation. `_preload` pre-seeks to the same point,
  so a punctual seam costs no second decoder flush.
- **The latch.** The once-a-beat check is the right cadence for *holding* a lock
  and the wrong one for *taking* it: by the time it first ran, B was already
  audible and the hard align was no longer permitted. The servo now measures the
  moment B is genuinely rolling — its media time has moved; a stalled deck is not
  evidence — takes the align inside the lead-in, and latches. Bounded to three
  attempts so a deck that keeps re-stalling is trimmed rather than seek-thrashed.
- **What is still open**, printed with its measurement on every probe run: the
  element's resume runs 210–680 ms, so the lead does not always cover it. It no
  longer costs the lock (the latch measures the grids rather than trusting the
  placement); the worst observed case is an onset near −20 dB a half-beat into the
  fade — a soft entry, not a hole, which is why the level envelope cannot see it.
  Closing it means rolling B silently through the armed window so the seam never
  calls `play()`, which needs its own cancel/replan bookkeeping and a servo willing
  to trim a residual rather than seek it.
- **A rot bug the widened probe found on its own.** The settle check now asserts
  the *whole* servo is handed back, and it immediately failed: `finish()` cleared
  `trim` but not `trimI`, the integrator that learns a residual tempo error, so one
  seam's learned bias was the next seam's starting offset — cumulative drift across
  a long set, invisible to every check that only looked at `trim`. The latch is the
  same hazard in a newer form (left set, the next seam skips the align it needs).
  Both are reset now, and the check covers them.
- Two earlier attempts were reverted rather than shipped, and both were reverted
  for the same reason: they were restructurings justified by a theory instead of a
  measurement. A pre-rolled cue with a silent rate servo engaged about a third of
  the time; moving the trigger to a 20 ms `setInterval` supervisor did not help at
  all, because **a saturated main thread throttles `setInterval` exactly as it
  throttles `requestAnimationFrame`** — a 20 ms timer measured median 45 ms, max
  91 ms under load. No JS clock decouples from main-thread saturation. That is what
  pointed at placement rather than cadence as the thing to fix.

### 1.2d The hand is in the world, not on top of it
- **What was wrong was an architecture, not a number.** The touch was answered on
  a full-screen 2D canvas at `z-index: 4` (`#touchCanvas`) plus two DOM divs
  (`#voidFx` with `mix-blend-mode: multiply`, `#voidRing` with an accent
  `box-shadow`). Each personality drew itself there in the live palette: a photon
  ring, three wound spiral arms, a disk of infalling motes, expanding rings, a
  charge arc, a release wavefront. Roughly 220 lines of correct code that read as a
  heads-up display, because a screen-space stroke at a fixed pixel width sits in
  front of the world — no depth, no camera, no scene — and it required a dark radial
  veil painted underneath so its glow would read over a busy field. The visuals
  were being dimmed so the decoration could be seen. All of it is deleted; nothing
  replaced it in that layer.
- **One metric, two consumers.** `WARP` / `warpReach` / `warpSoft` / `warpDeflect`
  / `warpRho` / `warpHorizon` / `warpBudget` are pure and unit-tested; `GLSL_WARP`
  is generated from the same constants. The point shaders displace matter through
  it (view space *and* depth, so a well has volume and matter pushed away shrinks
  through the ordinary perspective divide), and `LENS_FIELD` refracts the
  composited frame through it. `tools/touch_probe.mjs` evaluates the shipped GLSL
  on the GPU against the JS across 750 samples and gates on drift — worst observed
  2 × 10⁻⁵. The light and the matter cannot be bent by different physics.
- **`LENS_FIELD` is the piece that ends the overlay**, and it earns its place by
  doing three things a stroke cannot: it bends *everything* (the eleven raymarched
  scenes have no particles and previously answered a touch with only a camera
  nudge — now 22% of such a frame moves); the void's darkness is real, because
  light inside the capture radius is not sampled; and the bright ring is
  *emergent*, because a lens makes two images and at the Einstein radius they
  converge and the light doubles. It runs before the artistic lenses, so a
  kaleidoscope repeats the distortion into every sector.
- **Bounded, deliberately.** 1/*b* deflection diverges at the centre. The first
  build displaced samples 1.6 screen radii under the finger and destroyed the
  frame — measured, then fixed with `warpSoft(x, max) = x/(1+|x|/max)`: exact for
  small *x* so the far field keeps the true 1/*r* tail (that long reach is most of
  why this reads as space), asymptotic under the hand where the horizon has taken
  over. Radial and angular ceilings are separate, because rotation preserves radius
  and therefore cannot smear the near field the way a radial term does — so the
  vortex is allowed a freer hand than the void.
- **Accessibility is a ceiling, not a switch.** `warpBudget()` returns 0.6 under the
  safety governor's calm state and 0.34 under `prefers-reduced-motion`, where the
  ripple's phase clock also freezes. It shrinks and never closes: a hand that
  touches the world and feels nothing is its own defect. Both halves are asserted,
  because the failure modes are opposite and both are real.
- **Cost.** The pass exists only while `LENS.handLive()` — presence, or a
  still-travelling release wavefront. On ECO and on a device the governor has found
  to be struggling it is skipped and the matter warp answers alone, which is what
  the touch did before any of this.
- **Three probe bugs worth remembering**, all of them the instrument measuring
  itself rather than the app. (1) Comparing two frames separated in time reported
  92% of a raymarched frame as "bent" when almost all of it was the scene
  animating; both frames are now rendered inside one tick with only the pointer
  uniforms toggled. (2) Rendering three times per tick made SwiftShader look like a
  struggling device, the governor correctly switched the pass off, and the run's
  later checks read 0.0% with every annulus exactly zero — so the probe pins the
  governor and asserts the strained path separately. (3) Asking "which force
  darkens the most pixels" elected the *vortex*, because rotating an image moves
  bright things off where they were; the claim was about the core, so the core is
  what gets measured.

### 1.2e The iOS hand-off, the weak-device touch, and one idea that failed again
- **The iOS gap was never the swap — it was the network.** On iOS the graph is not
  live, so the mixer stands down and every track change is the same-element advance
  in `playIndex`. Nothing warmed the next track: the deck preload that covers this
  on desktop lives in `MIXER.arm()`, which never runs when `AE.graphLive` is false.
  Measured on a 900 kbps pipe with an iPhone user-agent (so the shipping iOS branch
  is the branch under test): **2148 ms of silence between tracks**.
- **`PREFETCH`** fetches the next track into memory while the current one plays and
  hands the element an object URL at swap time. One element, still blessed, no extra
  decoder — the bytes arrive from RAM. Network requests for a hand-off fell from
  **61 to 3**, bytes served from **120 MB to 5 MB**, and the gap to ~1550 ms, all of
  which is now inside the media element. Metered connections are declined
  (`saveData`, 2g/3g), the draw is committed the way `MIXER.arm()` already commits
  it, and a mixset's draw is never advanced early because that carries the set's own
  bookkeeping. A prefetch that fails is silent: playback falls back to the URL.
- **Two bugs the probe found, both mine.** (1) `want()` guarded re-entry on `id`,
  which is only assigned when a fetch *completes* — so every 2 s tick decided nothing
  was in flight, aborted the download that was halfway there, and started again. That
  is the 61 requests and 120 MB for a warm that never landed; fixed by separating
  `id` (what we hold) from `_want` (what we are fetching). (2) A fixed 25 s lead
  sounds generous and is not — at 900 kbps it buys under 3 MB, so the fetch was still
  in flight at the hand-off and the gap was unchanged. The warm now starts once the
  *current* track is under way and has the rest of the song to land in.
- **What is left is the element's own.** With the warm on, the app reaches
  `playIndex` 0 ms after `ended` and there is no network in the path; the remaining
  time is Chromium tearing down one decoder and building another (emptied 267,
  loadstart 520, metadata-through-playing 1586). On ONE element that is not ours to
  remove, and the second element that would remove it is precisely what costs iOS
  the blessing. So `handover_probe` gates the parts this code owns — no app latency,
  no network in the path, playback never leaving the blessed element — and tracks the
  total as OPEN with its measurement.
- **A redundant seek, removed.** `playIndex` wrote `currentTime = 0` immediately
  after assigning `src`. A fresh src is already at zero, and the write queued a seek
  the element could not act on until metadata arrived — directly inside the gap.
- **The touch degrades now instead of disappearing.** The light-bending pass used to
  be switched off entirely on a device the governor had found to be struggling, which
  meant the phones most likely to be holding this app had a touch that moved
  particles and left the light alone — and every raymarched scene answered a hand
  with silence. `LENS_FIELD_LEAN` is one texture tap through the same
  `warpDeflect()`, same capture radius, same ceilings; what is dropped is the
  ornament (the second image, the channel split, the area dimming). Measured at 20.8%
  of the frame moved with the correct near-field falloff. ECO remains the one place
  the pass does not run at all — that mode exists to give the battery to the music.
- **The pre-roll, done properly the fourth time — and still not shipped.** The three
  casual attempts all rolled the deck early and then seeked it at `fire()` anyway:
  two decoder flushes instead of one, measured worse (908 ms) than doing nothing.
  The missing piece was arithmetic, not effort. A is playing at a known rate and the
  seam fires when it reaches `startA − lead`, so the wall time until then is known —
  and the incoming deck, running at that same rate, must begin exactly that much of
  its own time short of its entry. `seamCuePoint()` computes it; `fire()` then has no
  placement to make, and a late call costs nothing because both decks advance
  together (the same time-invariance `seamEntry()` uses, from the other side).
  It was written, unit-tested, and **reverted anyway** — because it cannot be
  exercised. The mix fixture's incoming track mixes in at **0.00 s**, so it has
  negative runway before its entry and the cue correctly declines on every seam.
  Merging cue/uncue, re-cue-on-a-deferred-bar, and a skip branch in `fire()` that no
  test can drive end to end is how a path rots. The finding is recorded at the top of
  `mix_probe`, with what would make it measurable: a fixture pair whose incoming
  track has several seconds before its mix-in point, plus the two `mix_acceptance`
  assertions that count the crate's six rows.
- **The three casual attempts before it, for the record.** Rolling the
  incoming deck silently a couple of seconds before the exit should have removed the
  210-680 ms resume: it made it **worse, 908 ms**, because `warm()` seeks away from
  the point `_preload` had already warmed and then `fire()` seeks again, so the seam
  pays for two flushes instead of one. Making it work needs `fire()` to stop seeking
  and the servo to absorb the residual by tempo alone — the same servo change the
  first attempt needed. Three failures for one idea is enough signal to stop
  attempting it in passing: the lead-in covers the common case, and the residue is a
  soft entry the level envelope cannot see (first fifth 116%, second 108%).

### 1.2f The update that would not stop offering itself
- **The report:** a card reading `05d9b7a1af → new`, on a listener already running
  `05d9b7a1af`. Applying it changed nothing; the next check raised it again.
- **Three defects, and none of them was the byte-compare being wrong.** The
  compare was doing its job — reporting a DIFFERENCE. What was missing was anyone
  turning a difference into evidence of a newer build.
  1. `offerUpdate()`'s "already current" guard read
     `build === MB8_BUILD && UPDATE.source` — it only rejected a matching build
     when a card was *already* on screen. The first claim of every check therefore
     sailed past it, which is every claim that matters.
  2. The same guard needs a build id, and the `controllerchange` sibling-handover
     path calls `offerUpdate('shell', '')` with none — so the check was skipped
     entirely and the card rendered its target as the word "new". That is the
     exact string in the screenshot.
  3. The service worker announced `SHELL_FRESH` whenever the fetched shell
     differed from its cache — including when its cache was **empty**. `SHELL_CACHE`
     is versioned, so every activation starts cold, the compare fired against
     nothing, and the page it told about a "fresh shell" was running that very
     shell.
- **The loop brake was already there and was not enough.** `updateGate`'s
  `UP_APPLY_CAP` (added with the deferral work) rate-limits the AUTOMATIC apply
  only. It is why the app kept working; it is also why the card kept coming back
  by hand. Braking the apply treats the symptom — the offer itself was never
  gated.
- **The rule that was missing, now pure and tested:** `updateOffer()` returns
  `show` | `ignore` | `verify`, and judges by PROVENANCE rather than by comparing
  build ids. A waiting `worker` is a versioned release the browser installed and
  stands on its own. A `shell` claim is the worker's own byte-compare reporting
  that the deployed shell differs from the one this page was served — a fact about
  content, so it stands whether or not the stamp moved. A `claim` (a
  `controllerchange` nobody asked for) is evidence that a worker took over and
  nothing more: `verifyShell()` fetches the deployed shell past every cache and
  reads its stamp, and only a different one earns a card, which then arrives named
  instead of as "new".
- **The trap on the other side, walked into and caught.** The first version of this
  rule rejected every claim whose build id matched the running one — which is
  correct for the reported loop and **fatal for the un-stamped deploy**, whose whole
  signature is *same id, different content*. `echoes_power_smoke`'s "a fresh deploy
  raises the update badge by itself" went red immediately: a false positive had been
  traded for a false negative, which is the worse of the two. Provenance is what
  separates them — the worker measured content, a controllerchange measured
  nothing — and `update_probe`'s unstamped scenario did NOT catch it, because it
  changes the build id too. Both checks are needed and neither is redundant.
- **A card raised in error can now leave.** `withdrawOffer()` hides the button,
  clears the source and target, and settles any deferral owed to a phantom. Without
  it the wrong offer stayed up until a reload, which is the shape the loop wore.
- **The worker end stops making claims it cannot support:** no verdict from a cold
  cache (no reference means no evidence), and never the same shell announced twice
  — whatever makes two fetches of one deploy differ, saying so again on the next
  check is how a card returns forever. That second guard is keyed on a fingerprint
  of the shell's **content**, and the first version keyed it on the build id, which
  is wrong in exactly the case that matters: an un-stamped deploy is the same id
  with different bytes, so a worker that had already mentioned that id once would
  swallow the real announcement. It showed up as a one-in-two flake on "a fresh
  deploy raises the update badge by itself" — passing often enough to look like
  environment noise, which is the most expensive kind of bug to leave in.
- **`update_probe` gained the scenario nothing was watching:** boot, then check
  four times with **no deploy at all**, and again after a reload (when a fresh
  worker's cache is cold). A correct app is silent throughout. It then forces the
  exact claim from the report — a shell offer with no build id — and requires the
  button to be withdrawn rather than shown. Also switched from Playwright's
  viewport-aware click to dispatching on the element: the clicks had begun timing
  out with "element is outside of the viewport" as the HUD grew, which says
  something about layout in a headless window and nothing about update machinery.

### 1.2g The booth grew hands — and the instrument had to be built first

- **The ask:** loops, rolls, scratch FX, banks and pads, "serato level", following
  the best logic of real hardware. The arithmetic went into the `@fx` pure block
  (`loopBounds`, `loopWrap`, `loopResize`, `rollReturn`, `fxFilter`, `fxGateHold`,
  `brakeRate`, `fxAutoPick`) and the graph work into an FX rack inserted between
  the bus and the master. The unit tests passed on the first run, which is exactly
  the problem: **the arithmetic was never the hard part.** A booth is the easiest
  thing in an app to fake — pads light, knobs move, labels update, and none of it
  reaches the sound.
- **So the check had to measure output, and the first three attempts at that
  measured something else.** `booth_probe` is now roughly half instrument-design
  commentary, because every wrong reading it produced was a lesson about
  measurement rather than about the booth:
  1. **Comparing two moments of music and calling the difference an effect.**
     Bypassed, the fixture's own >4 kHz band read 0 → 31554 → 1168 across three
     consecutive takes. Nothing survives that. The rack is now characterised on a
     **bench**: its input is swapped off the bus onto a seeded generated signal —
     pink noise for the filters and the gate, a 900 Hz sine for the saturation,
     whose odd harmonics land in a band that is empty when clean. Real nodes, real
     params, real `apply()`; only the signal holds still.
  2. **A dB scale read as if it were energy.** `getByteFrequencyData` clamps at
     −100 dB, so a band the filter had cut by 46 dB still came back as a
     respectable byte value; summed over 800 bins, an annihilated low end reported
     as *"101% of dry"*. In linear power it reads 1%.
  3. **An FFT asked an envelope question.** A 2048-sample window with smoothing on
     cannot see a 45 ms hole, so the gate measured as bypass. Gates are a
     time-domain question: 256 samples, no smoothing, quiet percentile over loud —
     and against the 95th percentile, not the *mean*, because at full depth this
     gate is open for only 18% of each slice and that pulls the mean down into the
     hole it is supposed to be detecting.
  4. **Resolution mistaken for noise.** A bypassed filter differed from a bypassed
     filter by 5% — identical parameters, both `fxFilter(0)`. Below ~60 Hz a 46 ms
     window cannot resolve a cycle, and on a pink signal in linear power those bins
     are also the *largest*. A 16384-sample window took it to 0.3%.
- **Two real defects the instrument then found, both of which unit tests could
  not have.**
  - **The gate stopped when a frame was slow.** Slices were queued 250 ms ahead
    on the audio clock, and the thing refilling that queue is the animation frame —
    measured on the probe's software renderer at 63 ms median one run and 197 ms
    the next. One slow frame left a hole, and a hole here does not sound like a
    glitch: gain is parked at 1 by the last event, so the gate silently **stops**.
    `GATE_AHEAD` is a second now, which is free (it is all sample-accurate
    scheduling) and survives a stall four times the worst frame seen. A knob moved
    while it runs still lands at the *next slice*, by cancelling from there rather
    than from now — the phase is kept and the change arrives on a beat, which is
    what hardware does.
  - **`FX.release()` was stealing a rate it did not own.** It reset
    `playbackRate` unconditionally, to undo a brake. But `commitMix()` calls it —
    and the mixer sets both decks' rates to tempo-match a few lines earlier, so
    the incoming deck's match was wiped at the exact instant the blend began.
    Worse, the seam's PLL only rewrites the rate when its own target *moves* by
    more than 0.0004, so the wrong rate then stood until the trim drifted that
    far. It surfaced as an 83.6 ms beat lock against a 40 ms contract on about one
    seam in three — intermittency being the whole reason it was worth chasing
    rather than shrugging at. `release()` now touches the rate only if a brake was
    running, and the rule is pinned in `booth_probe` as a direct check so it fails
    every time instead of sometimes.
- **A design change the probe argued into existence.** `hand()` originally handed
  control back to AUTO a few seconds after the last touch. It reads as
  considerate and it is a footgun: a performer who sets a filter and holds it
  would watch the room undo it, and the fight is unwinnable because the room never
  tires. It was found the hard way — a gate measurement that kept coming back
  bypassed, because AUTO had reclaimed the unit mid-reading. A hand now takes the
  booth and **keeps** it until AUTO is armed again.
- **What is deliberately tracked open rather than asserted.** `loopWrap` carries
  the overshoot across a wrap instead of discarding it, so cycles cannot compound
  — seeking to `start` every time makes each cycle *len + however late the tick
  was*, which puts an 8-bar loop a third of a beat behind after eight passes. That
  arithmetic is exact and unit-tested. What cannot be fixed from here is the
  **seek**: re-pointing a streaming media element flushes its buffer and restarts
  its decoder, costing 0–450 ms of real time depending on how hard the machine is
  breathing. Buying it back would mean decoding loops through an
  `AudioBufferSource`, which the rest of the app deliberately does not do because
  streaming elements are what keep iOS's decoder budget and background-audio
  blessing intact. So the probe reports the number and does not pretend it is a
  contract; asserting it would be asserting the host's seek latency.
- **And one lesson that was pure probe hygiene.** The fixture's tracks are 20–30 s
  and the run is minutes, so playback walked off the end mid-measurement — and a
  track change calls `FX.release()`, which parks the rack. Readings were being
  taken with the effect switched off *by the app*, on a different song; a filter
  reported at "47% of dry kept" was a filter that had been turned off half way
  through. Fixed by `repeat:'one'` (which is what disables the auto-crossfade),
  holding **both** decks back from their ends (the idle one is still rolling, and
  its `ended` is what advances the crate), and a `deckHeld()` guard that fails
  loudly rather than quietly reporting the wrong number.

### 1.2h The field plays itself, and it can be touched in two places

- **The engine was idle for most of its life.** §1.2d built one metric that bends
  light and matter together, four personalities, a charge, a release, a capture
  radius — all of it reachable only by a finger on the glass. For a phone in a
  pocket or a laptop across the room that is an engine doing nothing for the whole
  set. `GHOST` closes that: after ~22 s of stillness a hand that is not there
  starts playing the same fabric. It is not a second implementation of the touch —
  it writes `INTERACT.px/py` and a presence ceiling and lets the shipping spring,
  charge, chirality, release, metric and shaders answer exactly as they do for a
  finger. Anything ever added to the touch is added to this for free, and deleting
  the object leaves the touch untouched.
- **Five choreographies, dealt by the scenes manager.** `ghostPattern()` is
  `touchAffinity()` one layer up: each room picks how the ghost moves through it —
  `bounce` (a ball folded off the walls), `snake` (a lattice walk, right angles
  only, reflecting off the edges), `lissa` (a Lissajous curve whose amplitude
  breathes), `paint` (short dabs with real lifts between them) and `drift` (the
  resting hand). A wildcard keeps a memorised map able to surprise; the apex has
  the last word and always rests. All pure, all bounded to `edge`, all unit-tested
  for staying in the room, for continuity, and for being *different motions* rather
  than one wander renamed.
- **Restraint is the feature, and it is arithmetic.** `ghostPhrase()` plays one
  stroke of 2.2–5.8 s per 14 s slot — measured duty cycle **30%**, so the visuals
  have the room to themselves the other 70%. `ghostAmp()` caps presence at 0.5 of a
  real hand and ducks it further where the music is already carrying the room:
  ×0.45 at the apex, ×0.65 at full energy, ×0.7 under CALM — about a seventh of a
  finger at a loud apex. A stroke lands over 0.9 s and *leaves* over 0.25 s,
  because a hand that fades out has no charge left to release; the brisk lift is
  what lets the ghost's strokes end in the same detonation a finger's do.
- **The clock is stroke-local**, which is what makes a stateless snake affordable
  (a dozen integer steps, not the history of the session) and, more importantly,
  what makes every stroke a *gesture with a beginning* instead of a window onto one
  endless wander. The first version replayed an absolute clock and re-seeded the
  walk every 96 steps — caught by the continuity test as a **0.82-unit teleport**
  mid-stroke. PAINT is the one choreography allowed to move discontinuously, and
  only across a lift, which the tests assert as exactly that: a big move is legal
  only while `on === 0`.
- **Two hands.** `uPtr2` carries a second centre, its own presence and its own
  mode; `warpPush()` (pure, GPU-parity-checked) is the deflection expressed as a
  *vector*, because two hands superpose and radii do not. The point shaders add the
  second push to the first, and the light-bending pass — full and lean — adds it to
  the sample coordinate and unions the two capture radii. It costs one branch and
  one metric evaluation, and only while the field is touched in two places.
  `touchPairMode()` gives the second hand the *complement* of the first, so a pair
  is never one force smeared twice: void ↔ accretion, the two chiralities against
  each other, and ripples with ripples because two sources of one wave is the
  pairing where sameness is the point. A real second finger takes that slot (it
  does not steer the camera — two fingers fighting over one camera is how a bad
  pinch feels), and so does the ghost when the music opens out, mirrored
  left/right, top/bottom or through the centre.
- **Where it must not play.** `prefers-reduced-motion` is a hard no, not a shrunken
  budget: shrinking a deformation somebody asked for is one thing, a room that
  starts moving on its own for somebody who asked it not to is another. ECO is a no
  because the ghost wakes a full-screen pass and that mode gives the battery to the
  music. Hidden tab, live finger, and the preference itself are the rest. The first
  real touch takes the field back **on the very next update**, mid-stroke.
- **Two bugs worth remembering.** (1) `TOUCHFX.load()` runs at module scope and
  `TOUCHFX.paint()` asked `typeof GHOST` — which *throws* for a `const` still in
  its temporal dead zone, so the whole app failed to boot. `typeof` is only a safe
  guard for things that are not lexically declared later in the same script. (2)
  The ghost's release fired at zero: the gain passed to `release()` was the
  enveloped presence, which is ~0 at the moment a stroke ends, so three minutes of
  play produced **0 wavefronts**. The weight a hand is worth and its presence right
  now are different numbers, and only the first belongs in a release.
- **Gated by `tools/touch_probe.mjs`**, which now runs 41 checks: the second hand
  bends the world around *itself* and captures light like the first, a pair is a
  sum rather than a swap (0.49 near the second hand against 0.12 at the first), the
  ghost's duty cycle and presence ceiling, that its strokes end in real releases,
  that it splits, that a finger takes the field back at once, and that switching it
  off means **0** frames of hand in two minutes.

### 1.2i The room arranges itself, and the palette is a chord

- **Four engines, four unrelated dice.** The director chose a scene; the touch rolled a
  personality; the ghost rolled a choreography; the lens picked a look; the palette
  drifted on a timer of its own. Every one of those decisions was defensible and
  nothing in the app had an opinion about whether they AGREED — which is why a
  beautiful moment was always partly luck. `roomMood()` is now the single reading
  of where the music stands (**adrift · ascend · drive · apex · swarm · dissolve**,
  branched from most specific claim to least) and the scene deal, the dwell, the
  touch re-tune, the ghost's choreography and the colour's chroma lean all come
  through it. The mood changing is not itself an event: nothing cuts because a
  word changed, it only leans the decisions that were already due.
- **Taste is declared, not hard-coded.** `pickScene` was a ladder of
  `if (i === 13) x += f.beat * 1.0 + f.bass * 0.8`, one line per scene, indexed by
  position. It had **AUREA missing from it entirely** — that room scored a flat 1
  for its whole life and could only ever be picked by accident. Scenes now carry a
  `key` (identity — `name` is a live label that OP-ART, PARLOR, HALO and the
  FRACTAL FIELD all rewrite on every re-roll) and collect a declared appetite from
  `SCENE_TASTE` at registration. A positive weight is an appetite; a negative one is
  an appetite for the ABSENCE, worth a full point when the material has none. A room
  with no entry scores 1 and still gets dealt, so a scene added tomorrow participates
  without anyone remembering to edit the director.
- **The set remembers.** A recency ring damps the last five rooms and lets them back
  gradually (`recencyPenalty`), a room the session has not shown gets a ×1.55 lift,
  and the lift resets when the gallery has been toured. Measured through the shipping
  picker: **16 of 17 rooms in 40 changes, zero back-to-back repeats**, gated in
  `acceptance`. The old ladder merely damped the active room ×0.15 — which looked
  harmless and was not, because `setScene` SWALLOWS a pick equal to the active scene
  while the SEGUE resets the dwell either way, so a "change" that landed on the
  current room bought the field another full dwell of nothing. A change is now a
  change, with a fallback for the case where there is genuinely nowhere else to go.
- **One bug in the walk, worth remembering.** A cumulative weighted walk that
  subtracts a zero weight and then asks `r <= 0` returns the zero-weight entry
  whenever r lands exactly on it — at `r = 0` that is the first entry, i.e. exactly
  the room just excluded. Rounding does the same at the far end. Zero-weight rooms
  are skipped explicitly and the fall-through returns the last room that was a real
  candidate.
- **The dwell is earned.** `roomDwell()` reads the mood (apex 18.6 s, dissolve 44.9 s
  at mid energy), turns over faster on busy material, and STRETCHES under the
  structure's ceiling — a passage the music is holding back is the last thing that
  should be cut to pieces by a timer that cannot hear it.
- **Six chords where there were four.** `colorScheme` splits the (energy × entropy)
  plane six ways instead of four, and the two new regions are ones the old map had no
  word for: material that is quiet but not settled (which came out as flat
  neighbours) now *hangs on the fourth*, and material that is hot and arguing with
  itself (which came out as a plain complement) now *aches on the seventh*. Clean
  drive opens to the sixth. Every scheme is a real interval through the same log-map
  (`schemeChord`), so the palette is literally the chord — and all four of the
  engine's existing readings keep their exact regions, which is checked.
- **A fourth note, where the gradient can hold one.** `uColA/B/C` is three swatches
  and always will be; the ramp is not. The seventh hands over `plan.extra` and the
  gradient closes its loop through it instead of jumping accent→root. The glide
  carries four slots always (repeating the accent when a chord has three), because a
  target array that changes length between tracks reads past its end for exactly one
  glide.
- **The arc is a temperature curve.** `actWarmth` pulls the palette toward amber into
  an apex and toward cold blue at the edges, scaled by the structure ceiling, so the
  same key reads differently at the two ends of its own song. Applied as **one
  rotation of the whole chord**: tilting each colour separately is the obvious thing
  and it is wrong — the pull is a fraction of each hue's own distance to the pole, so
  near hues move less than far ones and the chord compresses until the just third
  quietly stops being a third. And it is capped in DEGREES as well as in fraction:
  measured on 8B, an uncapped apex moved the root **53°**, blue to green-cyan, which
  is not a warmer room but a different one. Warmth is meant to be felt, not
  identified; the key is not the light's to change.
- **NOCTURNE**, a fourth ramp reading and DUOTONE's opposite number: that one removes
  the highlight so nothing can wash, this one keeps exactly one and spends the rest
  of the sweep making it worth arriving at. Chroma rises as lightness falls, because
  a dark stop that also desaturates is not night, it is grey.

### 1.2j The same update, offered again — and the verification that was verifying itself

- **The report, unchanged from §1.2f:** "update is working but not knowing it has and
  keeps offering it." The card in the screenshot reads `9e6b13a9be → new`, on the
  build already deployed, and lists four changes the listener already has. §1.2f
  built the rule that was supposed to end this; it ended one of the four ways in.
- **The verification layer never left the building.** `verifyShell()` — the whole
  point of §1.2f, the thing that turns "something changed" into "there is a newer
  build" — fetched `index.html?_v=…` with `cache: 'no-store'` and a comment saying
  "past every cache". The service worker's shell route matches on **path**; a query
  string is not part of a path, so the probe was answered out of the versioned cache,
  by us, in about a millisecond. `no-store` had nothing to say about it: that governs
  the HTTP cache, and a service worker sits in front of that. Every verdict it
  produced was the cache's opinion of itself, and it is wrong in *both* directions —
  a page loaded from the network while the cache still holds the previous shell
  "verifies" as stale and offers a downgrade. sw.js now passes anything carrying
  `mb8probe` straight to the network, and the probe counts requests at the ORIGIN to
  prove it arrived.
- **A waiting worker is a fact about `sw.js`, not about the shell.** §1.2f let a
  waiting worker stand on its own — "a versioned release the browser installed
  itself, the strongest evidence there is". But `sw.js` and `index.html` are separate
  objects with separate journeys through a CDN, and this repo ships them in a pair of
  deploys per merge (the content push, then the stamp workflow's). A worker that
  installs while the edge still serves the previous shell carries the build already
  running: it waits, every launch finds `registration.waiting` and offers it, every
  apply activates a worker whose cache holds the shell we already have, and the next
  launch finds the next one. It also carries no build id, which is where the word
  "new" in the screenshot comes from. It is checked against the deployed stamp now,
  and when it has nothing to bring it is **retired** — handed over silently, since a
  handover that changes no code costs the listener nothing.
- **The rule that makes an offer falsifiable at all.** Every apply was the app's
  first apply. Nothing was ever compared against anything, so a swap that *could not*
  change the running build — an un-stamped deploy, a worker with nothing in it — was
  offered again the moment the page came back, forever, and the loop had no memory to
  break it. An offer now has an identity: `updateOfferKey(running build, what it
  claims to bring)`, where "what it claims to bring" is the deployed stamp or, for an
  un-stamped deploy, the worker's content fingerprint (the only name that case has).
  Applying stores that key, and the store outlives the reload the apply causes —
  which is the whole point, because the page that asks again is a different page.
  Meeting the same key again returns `applied`: log it once, withdraw the card, stay
  quiet. The key contains the running build, so a build that *did* move can never be
  suppressed by an old memory, and `updateRecover()` forgets deliberately — a swap
  that failed must stay applicable.
- **The card also has to know what it already told you.** `newsSince()` walks the
  changelog until it meets the running build, and most deploys ship no entry of their
  own (polish, a fix, the stamp commit itself), so the running build was an id no
  entry had ever heard of: the walk ran off the end and the card answered "what's
  new?" with the last four things the listener already had. That is its own way of
  not knowing an update has landed. `stamp_version.py` now records every stamped
  build on the newest entry's `builds`, so the running build is always found.
- **What the probe watches now:** that the origin probe reaches the origin (counted
  server-side — under the old code it reached zero requests); that an un-stamped
  deploy is offered, applied, lands its bytes, and is then *not* offered again when
  the identical announcement is replayed; and that a worker installed from a changed
  `sw.js` over an unchanged shell is retired rather than sold. That last one has a
  harness lesson in it: `checkForUpdate()` fires `registration.update()` and walks
  away, and in a headless page nobody is looking at, Chromium is in no hurry to run
  an update job for a promise nothing holds — forty seconds of polling found an
  install that had never started. The probe awaits the same call the app makes,
  which changes the harness's patience and not the app's behaviour.

### 1.2k "You're up to date" — the status the loop never had

- **The report, a third time:** the same card, now reading `7dba7ac06f → new`, on
  the build deployed that very morning — after §1.2f and §1.2j had each closed real
  ways in. What was left standing were the two voices that can still say "new"
  without naming anything, and the absence of any state that says the opposite.
- **A 'shell' claim is only a measurement when it arrives WITH the measurement.**
  §1.2j trusted the provenance: the worker's byte-compare is a fact about content,
  so its claims stood unconditionally. But the claim and its guards live in
  different files. The page believes any `SHELL_FRESH` message, and the worker
  ACTIVE on a listener's device can be generations older than the page it serves —
  installed before the cold-cache guard, the dedup or the fingerprint existed, and
  kept alive indefinitely, because a waiting worker only activates on an apply or a
  full close while `revalidateShell` keeps recaching newer shells into the old
  worker's cache. Those retired voices announce on the same channel with none of
  the guarantees, and were believed on sight: rendered as "→ new" when they carried
  no build, or as an offer of the running build when they echoed the stamp.
  `updateOffer` now grades a shell claim by what it carries — a fingerprint stands
  (the un-stamped deploy path lives exactly there), a cross-build id stands (an id
  is falsifiable), and a claim with neither, or one naming the very build we run,
  is verified against the origin like any other rumour.
- **An offer that could not be named must not stand for the rest of the session.**
  `verifyShell`'s failure path raises the one honest unnamed card (a waiting worker
  is a real artefact in this device's storage, even offline) — and nothing ever
  re-examined it. `checkForUpdate` REMINDED about it on every timer and re-verified
  nothing, so one bad moment on the network pinned "→ new" until the next reload,
  six-hourly nag included. Every check now re-verifies a standing unnamed offer:
  the moment the origin is reachable again the card either gets its name or leaves.
- **And the affirmative state finally exists.** Every earlier fix ended at "the
  card leaves", which a listener cannot tell apart from "the card will be back".
  When verification finds the deployed build is the one running while the card is
  OPEN, the card now says so — "You're up to date", with the build id as the proof
  — and a swap that lands on the build it left says the same in its toast instead
  of the noncommittal "Refreshed". The loop's absence is something the listener
  can finally SEE.
- **What the probe watches now, on top of §1.2j's checks:** a fingerprinted shell
  claim still stands (stamp or no stamp); a claim with neither fingerprint nor
  build is verified against the origin and withdrawn rather than believed; and
  when that verification happens under an open card, the card turns into the
  up-to-date status rather than quietly emptying.

### 1.2l The stage: one field, several screens, and a booth nobody can see

- **The ask, in one sentence:** the fullscreen button should be able to put the
  visualizer on the television and leave the controls on the laptop, so the room
  sees the field and nobody sees the mixer. Everything else here follows from taking
  that literally.
- **A stage screen is the same page, told to be a screen.** `?stage=screen` and the
  player switches its chrome, its catalog, its transport and its audio off and waits
  to be told what the booth's ears are hearing. Not a video feed: sixty frames of
  pixels a second across a window boundary is precisely what a laptop driving a PA
  cannot spare, and pixels lose the thing that matters — a screen holding the
  NUMBERS renders at its own resolution, on its own GPU, at its own refresh, and can
  take its own slice of a field far larger than itself. The wire carries about forty
  floats over a `BroadcastChannel`.
- **What crosses, and what does not.** The packet is a fixed, flat list of names,
  each one clamped on arrival (`stageApplyFeat`): the spectrum and the beat, the
  clock, the dancer's pulse and brace, the act and phase, the colour chord as three
  OKLCH stops, the lens, the skin, the hand, and the camera. What does NOT cross is
  everything that would make a screen think for itself. A half-arrived packet leaves
  the last good reading in place — a screen facing an audience must degrade to
  *held*, never to *zero*.
- **The camera is sent as a POSE, not as the dials that make one.** Two screens
  deriving a camera from the same dials are two chances to diverge — a different
  frame time, a rounding, a scene that nudged the dolly — and the seam between two
  televisions is exactly where half a degree becomes a visible tear. Position,
  quaternion, field of view: eight numbers, and no arithmetic on the far side.
- **The cut.** N screens do not each draw a little scene of their own. They draw ONE
  camera whose frustum is N screens wide, each taking its own sub-rectangle
  (`stageSlice` → three.js `setViewOffset`, applied to the scene camera *and* the
  backdrop camera, or the sky tears at the seam). A shape crossing from screen 2 to
  screen 3 leaves and arrives at the same height, the same size, the same instant,
  because there was only ever one shape. `stageGrid` decides the arrangement: a row
  is what a stage is, up to four; past that a row gives each screen a letterbox slit,
  so it folds into the squarest grid that still fills — which is how a video wall is
  actually built. The unit suite proves the slices tile the field exactly once, with
  no gap and no overlap, for every wall from one screen to eight.
- **The booth folds into a corner.** With the field elsewhere, the operator's window
  becomes a mini player — transport, what is playing, how many screens are really
  lit — with a chevron for the twenty controls that are not needed mid-set. In the
  Mac app the shell shrinks the window itself and floats it above everything, so it
  survives a laptop lid at the side of a stage; on the web it is the same bar in the
  same corner. A folded booth draws NOTHING: the render is gated off entirely, so the
  GPU belongs to the screen the room can see.
- **The hand travels.** Nobody is standing at the television, so the touch that bends
  the field has to be somewhere else: the mini player carries a pad, and a drag on it
  sets exactly the fields a finger on that glass would have set — including the lift,
  which detonates through the same `INTERACT.release` a real hand does. It marks
  itself synthetic, so a hand that is not attached to anybody is never answered with
  a haptic buzz.
- **What is deliberately NOT synced, and why.** The library, the queue, the decks,
  the mixer, every panel: a stage screen has no business holding a copy of them, and
  a copy is a thing that can disagree. The screen also never applies an update by
  itself — nothing is playing on it, so every gate that protects a listener reads
  "idle, go ahead", and a screen facing an audience would reload itself mid-set.
- **Failure is a state, not a freeze.** The booth stamps every packet and each screen
  keeps a smoothed estimate of the difference between their clocks (`stageOffset`);
  four seconds of silence and the screen says the booth stopped speaking rather than
  holding a frozen picture the room reads as a crash. A closed screen tells the booth;
  a closed booth tells the screens; the Mac shell reports a window destroyed by a
  yanked cable the same way.
- **One screen is still a stage.** The room this was written for has a television in
  it. The machine everyone actually *tries* it on does not — one laptop display, no
  second monitor, and a webview whose popup policy is "no". That combination used to
  be a dead end: the app said "allow pop-ups for this site" and stopped, which inside
  the Mac shell (a WebKit view that opens no second window at all) meant the stage
  could not be reached by any route. So the stage also comes small — a picture in
  picture that floats over the booth, dragged by its bar, resized by its corner,
  pushed to full and back, with `↗` to send it to a real window the day there is one
  to send it to. It is reached three ways: asked for by name (the chooser offers it
  outright when there is only one display), taken as the default when one display is
  asked for one screen, and fallen back to when a window is blocked. The picture the
  room would see, at postcard size, is a preview rather than a hand-off — so the
  booth does NOT fold: the whole console stays, because the point of the small
  version is watching the screen while working the mixer.
- **The floor under that is an iframe, and it is chosen deliberately.** The Mac shell
  gives the corner stage a real window — decorated, resizable, above every other app
  — but the shell deploys in a day and the player deploys in a minute, so nothing may
  *depend* on it: the shell now names what it can do (`native_info.caps`) and the web
  asks by name. Where the answer is no, the booth grows the window itself: an iframe
  of this very page, told to be a screen. An iframe needs no second display, no popup
  permission and no shell, and it speaks the same `BroadcastChannel` as a screen on a
  television — the booth counts it, drives it and cuts its frustum identically. There
  is no second rendering path anywhere in this; there is one stage screen, hosted
  three ways.
- **Verified by `tools/stage_probe.mjs`** on two real windows with a real channel
  between them: the screen hides every control and keeps the field, loads no catalog,
  runs no director, takes the booth's spectrum, clock, act, chord, camera and hand,
  and the middle screen of three really does cut the middle third out of a frustum
  three screens wide. The geometry itself is in the unit suite, where the tiling
  proof lives.

### 1.2l′ The wall: screens that are rectangles, not numbers

- **The ask, in one sentence:** pick how many screens, watch them pop into existence,
  drag them onto the monitors and fullscreen them by hand — and have each one *know
  who it is and where it is* while you are still moving it.
- **What was wrong with a grid.** `stageSlice` answers "where does screen 2 of 3
  belong" with a guess: three equal boxes in a row. That guess is right on the night
  the televisions are identical and hung in a line, and wrong on every other night —
  a laptop beside a projector, one screen turned off, two windows an operator dragged
  somewhere sensible. Worse, it is *static*: nothing about dragging a window from the
  laptop to the television changes what that window thinks it is showing.
- **So a screen stopped being a number and became a rectangle.** Every screen reports
  where it actually is — `window.screenX/screenY` for its top-left, `innerWidth/
  innerHeight` for its size, which in every modern browser is the viewport's own
  position on the virtual desktop in CSS pixels from the primary display's corner.
  The booth takes the **union** of those rectangles and calls it the wall. A screen's
  slice is then simply its rectangle's share of the wall: the identical four numbers
  `setViewOffset` already wanted (`stageLayout` returns exactly `stageSlice`'s shape),
  arrived at from geometry instead of from arithmetic on an index. The grid stays the
  floor underneath, for a television whose browser was pointed at a URL by hand and
  for the first instant before the booth has heard from anyone.
- **The seam still has to be exact, and it is — provably.** A screen `w` pixels wide
  taking fraction `fw` computes the wall as `fullW = w/fw` in its own pixels, and its
  offset into it as `fx·fullW = (x − left)`. Every screen derives the *same* frustum
  from different numbers, so a shape crossing between two panels leaves one and
  enters the other at the same height, size and instant. The unit suite asserts this
  on a deliberately mismatched pair — a 1440×900 laptop beside a 1920×1080 television,
  vertically offset — because identical screens would prove nothing.
- **No browser fires an event when a window is dragged to another monitor.** There is
  no API for this and there is no way to ask to be told. The only place that can
  notice is the frame loop that is already running, so that is where the noticing
  happens: four numbers read per frame, and *sent* only when they change, with a
  two-second heartbeat under it. Reading is free; broadcasting is what costs. (This
  is the mechanism behind bgstaal's `multipleWindow3dScene`, the demo everybody has
  seen — it polls `-screenX/-screenY` per frame and translates a shared world by it.
  The same discovery, put through a camera frustum instead of a world transform,
  which is what makes it a *stage* rather than an effect: the field is cut, not
  moved, so each panel renders only its own part at its own resolution.)
- **One arithmetic, in one place.** Only the booth computes the wall, and it is
  broadcast — for the same reason the camera crosses as a pose rather than as the
  dials that produce one. Two screens deriving a bounding box from two slightly
  different rosters is two chances to disagree, and the seam is exactly where a
  disagreement of half a degree becomes a visible tear.
- **Identity survives renumbering, because the number is a property of the place.**
  Screens are keyed by an id that travels in the address; the *number* is reading
  order across the real desk — leftmost on the top shelf is screen one. Drag the
  third window to the far left and it becomes screen one, and its title bar says so
  before the hand is off it. `Identify` puts that number on every screen at the size
  a display-arrangement pane uses, because "which of these is screen two" is the
  first question anyone with four windows open asks.
- **And it rehearses on one laptop, which is where it will actually be built.** Ask
  for three screens on a single-display machine and three corner windows open, in a
  row, showing one field cut three ways — not three previews of three scenes. Slide
  them apart and the field stretches between them; overlap them and they show nearly
  the same picture; put them in a row and that is what the truss will do. The night
  it meets the real screens, the same windows get dragged onto them and made
  fullscreen by hand, and **not one line of the arithmetic changes** — the wall was
  always the union of wherever the windows really were. A corner window's rectangle
  is read by the booth that drew it rather than reported by the page inside it, which
  is why it is right on the frame the drag happens.
- **Verified by `tools/stage_probe.mjs --only wall`**, which is the part no unit test
  can reach: three windows open with three identities, the booth reads three real
  rectangles and cuts the field where they are (gaps included — three windows with
  space between them get *less* than a clean third each, exactly as three televisions
  with bezels would), a drag re-cuts the field **mid-gesture** and the others shrink
  to match, the new cut is broadcast before the hand lifts, the window now furthest
  left renames itself screen one, and the page inside really did take the cut it was
  sent rather than the one its address implied.

### 1.2l″ The door out of the app, and the hand that crosses the seam

Reported from a real Mac with a real monitor: *"I can't get the PIP windows to escape
the wider application to take them to other screens and then make them full screen."*
Three separate faults, all on the path from a corner window to a monitor.

- **`↗` reached for `window.open`, which is the one call the shell answers with
  `null`.** So inside the Mac app the corner window was a room with no door — it could
  be dragged around the booth and never out of it — and the button's only reply was a
  sentence about popup settings that no setting could fix. That is precisely the dead
  end 1.2l was built to escape, left standing in the one place it mattered most. The
  shell is asked first now: it puts a real window on a real display and fullscreens it
  there, which is the trick the web genuinely cannot do — a browser may open a window
  but may not choose the monitor, and may not go fullscreen without a gesture on that
  window itself. The operator is asked *which* monitor, by name and size. An older
  shell that does not know the command says so in words that name a way forward,
  because this page will often be newer than the binary around it.
- **Two screens on a two-monitor rig both landed on one monitor.** The display index
  came from the screen number — screen 1 to display 1, screen 2 to display 2 —
  deliberately skipping display 0 so a fullscreen stage would not bury the booth. On
  the two-monitor rig almost everyone has, that clamped screen 2 onto the same panel
  as screen 1: two fullscreen windows stacked, the other monitor dark, and a wall one
  screen wide. Asking for exactly as many screens as there are monitors plainly means
  all of them, the booth's included — it folds into a corner for exactly this.
- **The booth remembers which monitor it filled**, and that memory is in the wall. Not
  bookkeeping: a window the shell has fullscreened on a known monitor has a rectangle
  the booth knows *exactly*, so the wall is right on the frame the window opens rather
  than a second later when the page inside has booted far enough to say so. It is also
  the only rectangle that can be trusted if a webview reports its own position badly.
  That failure has a signature — two windows claiming the same rectangle, which would
  collapse the wall to one screen's worth of field with every screen showing all of it
  — so it is detected rather than assumed away, and those windows fall back to the
  monitor they were placed on. A window's own reading still outranks the placement
  whenever it is real, because only the window knows it has been dragged.
- **The hand was one touch per screen, not one gesture across the field.** The booth's
  hand has always MEANT "here, on the field". With one screen that is the same thing as
  "here, on this glass", so it crossed as-is — and with three screens it quietly became
  "here, on EVERY glass": one drag, three touches, one centred on each panel, none of
  them where the operator pointed. The hand is a point on the WALL now, and each screen
  converts it to its own glass. A screen the hand is not over gets a coordinate outside
  its own edges, which is right — the touch is somewhere else and its force falls off
  with distance like any other. Leaving screen 1's right edge and entering screen 2's
  left edge happen at the same instant, which is what makes dragging across two
  televisions one drag. With one screen the conversion is the identity.

No orientation setting is needed for any of this, and none is offered: the wall is the
union of where the monitors actually are, read from the OS. Rearranging the displays in
System Settings rearranges the field, live.

Verified in `tools/stage_probe.mjs --only native`, against a stubbed shell with a
1512×982 laptop at the origin and a 1920×1080 monitor at `(1512, −98)`: the operator is
asked by name, the shell is asked for the monitor named, `window.open` is never reached
at all, the placement is remembered, two screens get one monitor each, and the field
spans both as a single wall with the screens numbered left to right.

### 1.2l‴ The web learns to place a window, and the show learns to stay awake

For as long as this document has existed, one sentence has been the case for the Mac
shell: *a browser may open a window but may not choose the monitor.* It stopped being
true — Chromium's window-management permission hands the page the real list of screens
(positions, sizes, labels, which one the booth is on), lets `window.open` say `left`
and `top` on another monitor and mean it, and in recent builds lets a popup be born
fullscreen there. So the web path now does what only the shell could:

- **One arithmetic decides which screen goes on which monitor** — `stagePlan`, pure and
  unit-tested, shared by the shell door and the web door. Screens are dealt to monitors
  in READING ORDER across the real desk (the same banding `stageOrder` uses), because
  screen one belongs on the leftmost television and not on whichever monitor the OS
  enumerated first — which is also a bug the old inline arithmetic actually had: a
  television plugged in to the *left* of the laptop still got screen one dealt as if it
  hung to the right. The booth's monitor is spared while there are enough others, dealt
  in the moment every monitor is asked for; extras stack visibly on the last one rather
  than being refused invisibly.
- **The permission prompt rides the operator's own click, and only that click.** The
  chooser (the Stage chip) may ask; every other door in — a keyboard shortcut, a corner
  window's `↗` — uses the screens only if permission is already granted, and otherwise
  keeps the older manners. Not merely politeness: `getScreenDetails()` simply never
  resolves while its dialog hangs, and the first draft of this awaited it inside
  `open()` — in any context where nobody can answer (a webview, an automation, the
  probe itself) the stage never opened at all. A prompt nobody may ever answer cannot
  be on the opening path.
- **The booth records where it sent each window** (`placed`), exactly as it does for
  the shell's windows, so the wall is right on the frame the windows open. Where the
  browser placed the window but was not allowed to fullscreen it — the gesture a
  browser demands has to happen on THAT window — the answer is the video player's own
  convention: a double-click on the picture fills the screen, said once in the toast.
- **A monitor plugged in or lost mid-show is news, not silence.** `screenschange`
  refreshes the list and says so out loud; the windows keep their places, and the next
  door opened lands on the desk as it is now.
- **The glass stays lit for the length of the set.** A booth driving a stage and a
  room-sized screen both hold a wake lock now (same shape as `POWER.wake`, held
  separately — the stage's claim outlives any power mode the operator flips through),
  re-acquired when the tab returns because the OS releases them on hide, silently. A
  corner window leaves this to the booth it floats over. Nobody touches either surface
  for an hour precisely when the show is going *well*, and a television dimming
  mid-set reads as a crash from the back of the floor.

Safari and Firefox never learned the API and are not pretended at: they answer with
`screen.isExtended` at most (a count of one bit, enough to know the laptop is not
alone), windows open in a row, and the operator drags them onto the televisions —
the manners the wall was designed around in the first place, which is why nothing
above adds a second code path to the geometry. A placed window, a dragged window and
a shell window are all just rectangles in the same roster.

### 1.2m Stage presence at scale — three to eight televisions *(planned)*

What ships today is correct for any N — the address bar takes `screen` and `of`, the
slices tile, the booth can open as many windows as the machine will give it. What is
not yet done is everything that makes a WALL rather than several screens:

- **Fullscreen-shader scenes still draw themselves, not their slice.** The mesh
  scenes and the backdrop are continuous by construction because they are cut by the
  camera. The raymarched and full-quad scenes compute from `vUv` and a resolution
  uniform, so each screen currently draws the whole composition rather than its part
  of one. The fix is a `uSlice` uniform (`vec4(fx, fy, fw, fh)`, identity by default)
  applied in the four vertex shaders that assign `vUv = uv` — `MARCH_VERT` and the
  three full-quad scenes — plus feeding those shaders the FULL field's aspect rather
  than the window's. Small, mechanical, and unverifiable without a real wall in front
  of it, which is why it is written down rather than guessed at.
- **Bezels.** Televisions have frames, and a continuous field that ignores them
  visibly stretches at every seam. A per-screen bezel compensation (millimetres of
  frame as a fraction of panel width, folded into the slice's `fx/fw`) is the
  standard answer and belongs in the same place the slice is computed.
- ~~**Arrangements that are not rectangles.**~~ **Done, and better than planned
  (1.2l′).** The intent here was a per-screen rectangle typed into the address
  (`&rect=x,y,w,h`) with the grid as shorthand. Nobody should have to type that: a
  window already knows where it is, so the rectangle is *measured* rather than
  declared, and the wall is the union of the measurements. Screens of different
  sizes, one enormous one flanked by two small, a laptop beside a projector — all
  fall out of it, and they follow the windows as they move. What is still open is
  screens at ANGLES, which the union of axis-aligned rectangles cannot express and
  which wants a per-screen homography rather than a viewport offset.
- **Roles beyond a slice.** Eight screens showing eight parts of one image is one
  idea; eight screens where two carry the field, four carry mirrored halves and two
  carry the waveform is a different and often better one. The packet already carries
  everything a role would need; what is missing is the vocabulary (`&role=field|
  mirror|wave|type`) and a way to say it without typing URLs.
- **A clock good enough to cut on.** `stageOffset` is enough for smooth motion but
  not for a hard cut landing on the same frame across eight panels. That wants a
  proper round-trip estimate (the screens answer, the booth measures, the offset
  becomes a median of samples) and a scheduled-cut protocol: the booth names a beat
  in ITS clock, every screen converts and fires locally, so a late packet cannot
  make one panel a frame behind.
- **One address to hang a wall with.** Eight televisions should not each be typed
  by hand. A single QR/short link per screen (`aethrakairos.com/#3of8`) that a smart
  TV browser can open, and a roster in the booth that shows which numbers have
  reported in and which are still dark. *(Half of this landed with the wall: the
  booth keeps a roster keyed by identity with every screen's live rectangle in it,
  and `Identify` puts each screen's number on its own glass. What is missing is the
  short link and a visible map of the roster rather than a count.)*
- **Bandwidth and blast radius.** One channel, ~40 floats at 30 Hz, is nothing on a
  single machine. Across a LAN (screens on other computers, which is what eight
  panels really means) the transport becomes a WebSocket or WebRTC data channel and
  the same packet crosses unchanged — the design deliberately never made
  `BroadcastChannel` part of the contract.

---

### 1.2n The native shell: what the app owed the player

- **The Catalog button did nothing, and took the audio with it.** `window.prompt()`.
  wry's `WKUIDelegate` implements a file panel and a media-capture grant and *no
  JavaScript dialogs at all*, so the call returned instantly while WebKit still
  counted a dialog as open — no card, no typing, and a page whose media had been
  suspended behind a panel that was never on screen. The player now asks in its own
  voice (`ASK`), which is better in a browser too: a system prompt on top of a
  fullscreen visual field was always the wrong texture. `stage_probe` makes reaching
  for `window.prompt`, `confirm` or `alert` an error, so this cannot come back.
- **The microphone said "blocked" for four different reasons.** A denied permission,
  a machine with no input, a device held by another app and a browser with no
  microphone API all arrived as one sentence. They are named now — and inside the app
  the answer is somewhere the app cannot reach, so it says where (System Settings →
  Privacy & Security → Microphone) and the shell opens that pane. The entitlement and
  the usage string were already right; note also that `Cargo.lock` was not committed,
  so every build resolved a fresh `wry` — including, before 0.55, one with no
  media-capture grant at all. It is committed now: a native app whose dependencies
  drift between builds cannot be debugged from a bug report.
- **The app sold you the app.** `display-mode: standalone` is false in a WKWebView,
  so every browser-shaped test for "already installed" let install copy through into
  the Mac app. The stylesheet now refuses install affordances outright inside the
  shell, rather than leaving it to script that a future path could route around.
- **The native updater ignored every promise the player makes.** It checked on
  launch, downloaded, installed and called `restart()` — no ask, no save, mid-set, no
  matter what SHOW mode said, because the player was never told. The shell reports
  now and the player decides: the same button, the same card, the same three choices,
  the place saved first. And a native update NEVER applies itself — every gate that
  protects a listener is a gate about *playing*, and replacing the running process is
  not something a quiet moment licenses.
- **The seam is one bridge and one origin.** `withGlobalTauri` plus a capability
  whose `remote.urls` is exactly `https://aethrakairos.com` — the player is served
  from the web, so that is the only way it can reach the shell at all, and pinning the
  door to one origin is what keeps that reasonable. Every command is optional by
  construction: `NATIVE.call()` resolves `null` when there is no shell, or when the
  shell is an older build that never heard of the command, so features ship on the
  web first and light up natively later with no version checks anywhere in the player.

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

### Phase IV·5 — Stage presence *(the room, not the window)*
- The stage screen, the folded booth and the travelling hand: **shipped**
  (§1.2l). What remains is the wall — §1.2m has the list, and the first two
  items are the ones a real stage will notice: the `uSlice` uniform that makes
  fullscreen-shader scenes cut like the mesh scenes already do, and bezel
  compensation so a continuous field stops stretching at every frame.
- Then the transport question: eight panels means other machines, so the same
  packet over a WebSocket/WebRTC channel instead of `BroadcastChannel` — the
  contract was written so that this is a change of pipe, not of design.
- And a clock good enough to cut on, which is the difference between eight
  screens moving together and eight screens landing a hit on the same frame.

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
