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
