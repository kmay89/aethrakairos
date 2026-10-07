# Aethra Kairos — the audit: smooth everywhere, mixing like a hand

*October 2026. A full read of the player (`docs/index.html`), the native Mac
shell (`desktop/`), the Apple TV app (`tvos/`) and the pipeline (`features.py`,
`make_catalog.py`), with one question: what stands between this and visuals
that never drop a frame, a mixer a DJ would call a mixer, and auto modes that
feel like one mind choosing the room, the light and the next record together.*

Part 1 is what was found. Part 2 is what this wave landed. Part 3 is the plan
for what is left, ordered by payoff, with the honest cost of each step.

---

## 0 · The verdict in one paragraph

The engine is unusually well made: every decision is a pure, tested function,
the seam is scheduled on the audio clock, the rooms are governed by a real
frame-time controller, and the show already agrees with itself about the
*moment*. Three things held it back. **The decks are media elements**, which is
right for iOS and for a static site and is also why nothing could scratch,
reverse, or stop with weight: the element's slowest speed is a crawl and it has
no negative. **The key detector was broken** — 187 of 267 tracks read as C major
and 75 as F major — so every harmonic gate always passed, the Camelot wheel never
turned, and key-to-colour painted one hue. **The show reacted to the song a
frame late**: a room was dealt on the frame a drop landed, by the smoothed
features of the bar before it. This wave fixes all three without changing what
the app is: still one file, still element-backed playback everywhere it matters,
still the same rooms on both stages.

---

## 1 · What was found

### 1.1 Playback and mixing (the web player; the Mac app runs the same code)

**Architecture.** Two `<audio>` elements through `createMediaElementSource`,
each with a 200 Hz low shelf, a sweepable low-pass and a gain, summed on a bus,
then a gate, a three-band EQ, high/low-pass, a gate, drive and a send/echo, then
the master, then the true-peak limiter (an AudioWorklet, with a compressor
fallback). The analyser taps the bus gate, before the rack. iOS plays
element-direct with no graph at all, by design.

**What is genuinely good.** Equal-power seams are `setValueCurveAtTime`
automation, not animation-frame writes. Phase is corrected by tempo trims, never
by an audible seek; a hard seek is permitted only while the incoming deck is
below −24 dB. The planner gates a beatmix on grid stability, an 8 % folded tempo
window and Camelot distance ≤ 2 before a single sample moves. The looper records
the room and plays the loop from a buffer source, with the handover calibrated
by an impulse rather than modelled. The limiter kernel is the same code in the
suite and on the audio thread.

**What stood between it and a DJ's mixer.**

- *No scratch, no reverse, no real brake.* A media element cannot run backwards
  and cannot go slower than Chromium's 0.0625× floor; the brake bottomed out at
  a crawl and jumped back. The jog wheels were drawings.
- *Element start latency is learned, not known.* A cold element resumes in
  170–680 ms; the seam compensates with a learned lead and a servo, which is
  excellent engineering around a limit the platform imposes.
- *Pitch during a blend rides the tempo.* Key lock is switched off for the
  blend because the browser's stretcher places transients ±15 ms off the
  reported time (measured by `tools/sync_trace.mjs`). ±8 % is 1.3 semitones.
- *Per-deck processing is thin.* One shelf and one low-pass per deck; the
  three-band EQ, the filter and every effect are on the master. A bass swap is a
  −14 dB shelf, not a kill.
- *No headphone cue, no manual crossfader, no nudge.* The crossfader is drawn.
- *Grids are constant-tempo with an assumed downbeat.* Correct for this
  catalog (DAW-made); wrong for a live drummer.

### 1.2 The visual pipeline

**What is genuinely good.** One honest frame-time governor (`PERF`) that sheds
pixel ratio rather than frames, remembers what the device proved, and flags a
struggling device so the director spares it the heavy rooms. The transition
engine photographs the outgoing room once rather than rendering two rooms. The
beat clock is a regression on media time with output-latency compensation and a
kick-locked self-heal. WCAG 2.3.1 flash limits are enforced in code.

**Where frames were being dropped.**

- *Shader compilation on the cut.* About 118 of the 122 rooms compiled their
  programs on first show — on the same frame as the transition's capture and
  the incoming room's `roll()`. Tens to hundreds of milliseconds, exactly where
  the eye is looking.
- *Four DOM style writes and an attribute every frame* for the seek bar, plus a
  class toggle for the beat dot, on the thread about to draw the field.
- *The eye ran one frame behind the ear.* The audio side was
  latency-compensated; the display side was not: what a frame draws reaches the
  glass a vsync after the frame's timestamp.
- *The dissolve on the weakest devices was the most expensive cut.* XFORM
  stands down when the governor is struggling or in ECO, which leaves a 2.5–3.4 s
  double-render dissolve as the only transition on the device least able to
  afford it.
- *Offscreen work on frames nobody sees.* Rooms that render to their own
  texture (the fractal marchers, the lamp's splat) did so inside `update()`, which
  runs on ECO's skipped frames, on the desk and under a mini booth.
- *Two full-screen integrators were not flagged heavy.* VORTEX integrates a
  128-step ODE per pixel twice; STELLARATOR marches 96 and 120 steps at full
  resolution. Neither was gated off a struggling device.
- *Per-frame allocations in the hot path:* `envSample` built two closures per
  call, twice a frame; the booth builds three radial gradients per jog per frame;
  BALLPIT re-uploads its whole instance attribute every frame; SCOPE re-uploads a
  500×400 canvas texture every frame.
- *Three coupled resolution controllers* (`PERF`, `bulbScale`, PLOTTER's line
  budget) each reallocate targets when they step.
- *The grade pass runs even with lens NONE* on every HDR-capable device: a
  full-resolution half-float target plus one pass, and the MSAA backbuffer then
  receives only the final triangle — antialiasing paid for and unused.
- *Stage screens apply the 30 Hz packet raw*, no interpolation, so camera and
  clock step at 30 Hz on a 60 Hz screen; each picture-in-picture is an iframe
  running the whole app.
- No `webglcontextlost` recovery, no frame cap on 120 Hz displays, no
  automatic ECO on battery.

### 1.3 The auto modes

**What is genuinely good.** One reading of the moment (`roomMood`) that the room
deal, the dwell, the touch, the ghost and the colour's chroma all read. Rooms
declare their appetite as weights, not `if (i === 13)`. A recency ring and a
"never shown" lift make a long night tour the gallery. Scene changes land on the
bar, the phrase, the section, or the seam's bass swap. Colour is perceptual
(OKLCH), spelled as just intervals, and glides through hue rather than mud. The
dancer reads the score 1.2 s ahead and braces.

**Where it was not one mind.**

- *The director reacted at the boundary, with stale features.* The dancer was
  the only thing with look-ahead. The room for a drop was dealt on the frame
  the drop landed, by the features of the quiet bar before it.
- *Colour re-planned at the commit*, eight beats after the seam had already
  started; the room changed hands at the bass swap and the light some seconds
  later.
- *The journey and quantum solvers never heard the key.* Harmonic mixing lived
  only in the planner's gate and the booth pads' score.
- *`fxAutoPick` could never choose the build sweep*: it waited for a phase
  called `build` from a director whose phases are flow, peak and break.
- *Two structure sources disagreed*: the director and the segue read the
  client-side wave analysis while the mixer and booth preferred the catalog's.
- *The Camelot wheel spanned 300°*, so keys 12 and 1 — harmonic neighbours —
  sat 85° apart in hue while every other step was 25°.
- *Two mood vocabularies* (`moodOf` for the Crate, `roomMood` for the show)
  that never meet; no per-track mood or texture ships in the catalog although
  `features.py` computes a texture label.

### 1.4 The pipeline's data

- *The key detector was reading one key.* The chromagram came off the
  2048-point analysis STFT — 21.5 Hz bins, wider than a semitone below ~700 Hz,
  where a bass-driven track keeps most of its harmonic energy — and the profile
  match was a plain dot product on positive vectors, which rewards the flattest
  profile whatever the music does. Result: 187 × 8B, 75 × 7B, 4 × 8A, 1 × 7A.
  Verified on 25 real tracks and on 24 synthetic songs with known keys, where it
  scored 2 of 24.
- The structure is loudness blocks with hysteresis — honest, not verse/chorus
  semantics — and `mixIn` is computed but never used.
- Stems ship (12 Hz envelopes per drums/bass/vocals/other) and are used only by
  the waveform display.
- No per-beat times or downbeat arrays are stored; the grid is one lattice.

### 1.5 The Mac app

The shell loads `https://aethrakairos.com` into a WKWebView; nothing from
`docs/index.html` is bundled. Every web change above reaches the Mac app on its
next launch with no rebuild. Native code adds Now Playing, media keys, the
stage windows, display enumeration, a LAN-only fetch for Hue, keep-awake, and
the updater. All audio runs inside the WebView. WKWebView supports
AudioWorklet (Safari 14.1+), so the platter works there. Two things worth
knowing: Safari's `preservesPitch` stretcher is the one that places transients
±15 ms off, so the blend's vinyl-mode switch matters most here; and the shell
sets no WebGL flags — none are needed, but a `webglcontextlost` handler in the
page would cover a GPU reset under a long show.

### 1.6 tvOS

Two `AVAudioPlayerNode`s through `AVAudioUnitTimePitch` (bypassed at unity)
and a two-band EQ, with a sample-accurate scheduled start — tvOS is already
*phase-correct by construction* where the web has to servo. The parity law
covers scene rosters; no scenes were added in this wave, so both stages stay
at 122.

---

## 2 · What this wave landed

**Smoothness.**
- `WARMUP`: every room's shaders are compiled ahead of their first cut, one room
  per frame, only on frames with headroom, through a scratch scene wearing the
  same fog so the program key matches. A struggling renderer never warms.
- The seek bar and beat dot write to the DOM only when the value they show has
  changed, at 20 Hz.
- The beat clock leads the glass by one measured frame period (capped at 100
  ms), closing the display side of the eye/ear gap.
- A struggling or ECO device's dissolve is capped at 1.1 s.
- `fieldDrawing`: the fractal marchers, the lamp's splat, NAVE, PLOTTER and
  SPECTRAL skip their offscreen render on a frame that is not shown.
- VORTEX and STELLARATOR are flagged heavy.
- `envSample` no longer allocates closures.

**The platter (`@vinyl`, `VINYL`).** An AudioWorklet insert between the bus
gate and the rack records the last 24 s of the room and plays it back at any
rate from −8× to 8× through four-point Hermite interpolation with a
speed-following low-pass. The physics is a direct drive in one table (motor,
brake, slipmat, backspin). Deck A's jog wheel in the booth is now a record you
can drag; the VINYL bank adds SCRATCH (stay in the hand), SLIP, BACKSPIN,
BRAKE (a real stop, then the power comes back on), held REVERSE, ½ and ¼
speed, and RESUME. SLIP snaps home with no seek; HOLD fetches the deck to the
platter under cover of the platter still playing, learning the seek latency
from each landing. The analyser sits after the insert, so the field scratches
with the record. The element never moves while a hand is on the platter. On
iOS the layer stands down and the pads say so. `tools/vinyl_probe.mjs` drives
it in headless Chromium and listens at the speaker.

**The conductor (`@syn`).** The director reads the script ahead: a louder
section coming within 2.4 s is arrived *with* — a strong rise as a cut timed to
land on the one, a gentler rise as a morph that completes as the page turns —
and the room is dealt by what the coming section promises. The deal's die is
seeded by track and section. The colour plan is re-read for the incoming track
the moment a seam fires and glides over the whole blend. The journey and quantum
solvers add a harmonic term. `fxAutoPick` now hears the structure's own words
(`build`, `peak`). Director, segue and mixer all read `trackStructure()`. The
Camelot wheel is the whole wheel.

**The keys.** `features.detect_key` is rebuilt: an 8192-point window at 22.05
kHz (2.7 Hz bins), the 65–2500 Hz band, a tuning estimate, log compression,
per-frame normalisation, and a Pearson vote across Krumhansl–Kessler, Temperley
and Albrecht–Shanahan profiles with relative- and parallel-key tie-breaks. On
the synthetic set it reads 13 of 24 exactly and 22 of 24 within one Camelot step
(the old one: 2 of 24). The key fields carry their own stamp (`mix.kv`), so the
cache refreshes keys without recomputing grids; `tools/rekey.py` re-read every
shipped track's key in place: 266 of 267 changed, nothing else touched, and
the catalog now spans 16 keys (9B 70, 10B 47, 5A 28, 4B 23, 10A 23, 7A 22,
6A 19, 6B 14, …) where it spanned four.

---

## 3 · The plan for what is left, by payoff

### Tier 1 — next, and cheap

1. **Grade only when a lens is on, or drop MSAA when the grade runs.** Today
   every HDR desktop pays a half-float target plus a pass with lens NONE and
   loses the antialiasing it paid for. Either choice is a few lines in
   `LENS.render`; measure with the colour probe before choosing.
2. **One resolution controller.** Fold `bulbScale` and PLOTTER's budget into
   `PERF` with quantised steps, so a shed is one reallocation, not three.
3. **Context loss.** A `webglcontextlost` / `restored` pair that rebuilds the
   renderer and re-runs `WARMUP`; a long Mac show under a GPU reset currently
   goes black.
4. **Stage interpolation.** Screens should extrapolate the 30 Hz packet by the
   measured offset so camera and clock move every frame.
5. **A 60 fps cap on 120 Hz displays** behind SHOW mode, and automatic ECO
   below 20 % on battery.
6. **Ship texture and mood in the catalog** (`features.py` already computes the
   texture label; `moodOf` is pure) and merge the two mood vocabularies.
7. **Per-track show memory.** The seeded die makes a song reach for the same
   rooms; a small per-track record of rooms that *landed* (the listener stayed,
   touched, did not skip) would let the show learn which rooms a song wears.

### Tier 2 — the mixer's next inch

8. **Stems in the mix.** The 12 Hz stem envelopes already ship. The planner can
   place the seam where the outgoing track's vocal envelope is silent and the
   incoming's drums are present, and the bass swap can be a real kill on the
   bass stem's envelope rather than a shelf.
9. **Per-deck three-band EQ with kills** so the swap is a kill, and a manual
   crossfader with curve selection in the booth.
10. **Nudge.** ±2 % momentary trims on the platter, quantised to the grid's
    phase error, as pads.
11. **Downbeat arrays in the catalog** for the day a live drummer enters it.

### Tier 3 — the long road to Serato (what it actually costs)

Serato-grade beatmixing rests on one thing this app deliberately does not do:
**decoded audio in memory.** A decoded deck (`AudioBufferSourceNode`, or a
worklet reading a decoded buffer) can be started at a sample, stretched with a
real key-lock (WSOLA or a phase vocoder in the worklet), scratched across the
whole track rather than its last 24 s, and cued in headphones through
`setSinkId`. The cost is everything `DESIGN.md §1.2g` names: a whole track of
PCM per deck (about 100 MB for four minutes of stereo), the decoder budget on
phones, the loss of background-audio blessing on iOS, and a `fetch` of the
whole file before play. The honest path is a **third deck kind** beside the
element decks and the platter: a decoded deck that exists only on desktop and
only when the listener opens the booth, fed from the prefetch the player
already does for the next track, and used for the blend window alone (the last
16 bars of A and the first 16 of B) rather than the whole track. That keeps the
element path as the always-on player and gives the seam a sample-accurate,
key-locked, headphone-cueable blend on the machines that can afford it. It is
a wave of its own; the platter in this wave is its first half (the worklet, the
ring, the handback, the probe), and the decoded deck is the second.

---

## 4 · How to verify

```sh
node tests/player.test.mjs                 # the unit suite (vinyl + syn blocks included)
node tools/vinyl_probe.mjs                 # the platter, in headless Chromium, at the speaker
node tools/scene_smoke.mjs                 # every room, booth and sliced
python3 -m unittest tests.test_pipeline    # the pipeline, key detection included
python3 tools/rekey.py --dry-run           # what the key refresh would do (idempotent: 0 once applied)
```
