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
`HOSTING.md`; the researched roadmap in `DESIGN.md`. This repo is the
MASTER: the Möbius⁸ engine is developed here. Its original home,
[kmay89/quantum_jukebox-](https://github.com/kmay89/quantum_jukebox-), is
dormant and holds the history.

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

**Drop songs as they are** — MP3, WAV, or M4A (AIFF and FLAC too). Anything
that isn't MP3 becomes a 320k web MP3 on the way in (`ffmpeg`, tags and the
file's own dates carried over); a same-stem `.mp3` already beside a source
wins. The public tree still serves only web MP3s, and masters still never
enter the repo.

**The folder is the album.** An album folder's *name* becomes the album's
name — embedded album tags never override where you put a song (track
titles still come from the tags; a stale iTunes `Album` field must not
regroup your shelf). **Loose files at the masters root are singles**: each
becomes its own one-track release named after the song, exactly the shape
the starter catalog ships in. Moving a song between folders later just
re-files it — the publish date rides along.

```
masters/
  Echoes of Us Album I/     ← one folder per album; the name is the title
  Echoes of Us Album II/
  Echoes of Us Album III/
  Zenith.mp3                ← loose at the root = its own single
```

**The dates are the artist's story.** A new track's `published` date is read
from the file itself (birth time where the OS records one, else modification
time — carried through conversion), sanity-clamped to `[2000, today]`. The
player's *"The progression — first pressing to now"* smart list plays the
catalog oldest-first: the arc, in order.

Duplicate-proof at three levels:

1. **Ingest** — the wizard's SHA-256 IndexedDB ledger catches exact re-drops.
2. **Catalog** — `make_catalog.py` hashes every file. A known hash at a new
   path is a **move** (path updates, `published` survives, DNA references stay
   intact); a known hash at the same path is a no-op; two entries with one
   hash cannot be emitted. Titles are tidied (unicode normalized, control
   characters and underscores out), and two different songs can never claim
   one public filename — collisions step to `-2`, `-3`, …
3. **Perceptual** — the Haitsma–Kalker gate runs on every *new* hash. On a
   CLONE verdict (best-10-second-window bit-error rate < 0.14) — the same
   song under two names — an interactive publish **asks which name wins**:
   keep the existing entry (default), `use-new` (the new file and name
   replace the old entry; the publish date survives, the retired audio and
   fingerprint leave the tree), or `both`. Scripted runs pick with
   `--on-clone keep|use-new|both`; `--force` still means `both`, and every
   override is stamped into the catalog entry so honesty survives.

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
the build loudly. (ZIPs may carry WAV/M4A freely — they unpack into
`masters/`, which stays on the machine, and convert on the way in.)

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

**Nothing the renderer does can be heard.** Every audible parameter of a seam
is *scheduled* on the audio clock, never written per animation frame: the
equal-power crossfade, the filtered fade, and the bass swap are all
sample-accurate automation, and the seam's own position is read from the same
clock those curves were scheduled on — so a dropped frame can't step the low
end, and the blend can't be cut off mid-curve by a late frame. The heavy
opportunistic work stays off the blend too: a whole-song fetch + decode (what
draws the waveform overview) is never started while a seam is running, so it
can't race the incoming deck for bandwidth or drop a song of PCM on the main
thread mid-transition. It does that work in the 90-second armed window
instead, where it belongs.

**Ready means ready.** A blend only starts when the incoming deck actually
owns the window it is about to play — `HAVE_FUTURE_DATA` plus either the
browser's play-through promise or visible buffered bytes across the whole
overlap. (`readyState >= 2` promises only the single frame under the
playhead, which is how a beatmix becomes a stall two beats in.) When the
stream isn't there yet, the mixer does what a DJ does and **takes another
eight**: the seam waits a whole bar — still a downbeat, with B's entry point
unmoved, so the wait buys buffer for exactly the window it's waiting on — and
only falls back to an honest fade once it's out of bars or out of runway.

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

## The Booth (key `D`) — watch the engine mix

The mixer has always run two decks, planned the seam on the bar line and
phase-locked the blend; the booth turns the lights on. A frosted panel over
the field shows **both whole-track frequency-coloured waveforms** with the
planned seam painted on each lane — a lit region with a beat-grid comb, so
you can *see* where the engine will blend and count the bars it will take —
both playheads, the deck states (`on air` · `loaded · cued` · `handing
over` · `on air — blending`), the live tempo trim in percent, the crossfader
riding the equal-power curve, and the **phase lock in milliseconds**.
Between the decks sits the resonance orb: the two tracks' key colours orbit
apart while the seam settles and **fuse into one glowing sphere as the phase
error dies** — beat-lock, made visible. Idle, the booth narrates honestly:
the planner arms 90 seconds before the end of every track, and you watch
deck B load, cue to its mix-in downbeat, and take the room. A DJ booth
where the DJ is the machine and the crowd gets to watch it work.

The booth is a full **performance deck**, drawn in homage to the drum-machine
DJ controllers: two **jog platters that actually turn at each deck's playback
rate** — when the engine bends tempo to lock a blend, you see the spin bend.
**The LED ring around each platter is the song itself**: the track's decoded
peaks wrap the wheel as 48 segments, each coloured by that slice's frequency
makeup (warm lows, the key on the mids, bright highs) with loudness carried
as intensity — you can see the drop coming around the wheel, the played arc
burning bright behind a white-hot head LED. The platters press like tinted
vinyl (grooves, key-coloured rim glow, a hub that breathes with the beat),
and the whole device **wears the keys**: deck A's colour washes in from the
left, deck B's from the right, each weighted by who owns the room. A **red
seven-segment BPM readout in dark glass** glides live through a mix as the
master tempo hands over; the **16-step sequencer row** (four bars of four,
the classic red/orange/yellow/cream quads) marches on the same CLOCK the
shaders follow; **segmented channel meters bounce with the music** in the
green-amber-red every mixer speaks, weighted by the true equal-power gains;
the **crossfader rail blends A's colour into B's** with a centre detent, so
the handle's position and the colour under it always agree; and **LOW
lamps** visibly hand the bassline over at the seam's midpoint — the
one-bass rule, made watchable.

**The playlist stays master — and you get override inserts.** Under the
decks sits a row of **performance pads: the eight best next tracks from the
whole shelf**, ranked by the same planner that performs the mix, each pad
glowing in its track's key with the plan spelled on it (`9A · 16 beats`,
`gapless`, `fade`). Tap a pad and that track is pinned as the draw and
**blended in from the next bar line**; when the seam ends, the auto-mix
simply continues from wherever you steered it. All anyone needs to have fun
and make a great-sounding set: watch it work, and reach in when inspiration
strikes.

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
  opens to a *triad*; and material that has genuinely come apart — high
  entropy *and* high energy together — opens to a **spectrum**: a full hue
  wheel anchored so the track's own key is the bright point the rainbow
  falls away from. It is the rarest reading in the engine on purpose. A
  spectrum laid over a calm track says nothing about the track, which is
  why most visualizers' rainbows read as wallpaper.
- **Arousal → chroma; acts → heat.** Energy drives saturation
  monotonically, the five-act arc breathes chroma and lightness live, and
  energy-phase peaks/breaks push and pull the accent.
- **OKLCH throughout.** All colour math happens in a perceptually uniform
  space, gamut-mapped by chroma reduction (never channel clipping), and
  every change glides over **eight beats of the measured grid** through
  OKLCH's shortest hue arc — a lighting cue, not a crossfade through mud.

- **The Mozart layer — the composer's numbers, wired to the light.** A pitch
  ratio lands on the colour wheel at `360·frac(log₂ r)` — the log-map that
  makes octaves identities makes intervals *angles*. A keyed palette spells
  the chord of its key in light: the harmony colour sits at the key's just
  third (94.7° minor, 115.9° major), the accent at the perfect fifth
  (210.6°), calm analogous neighbours a semitone apart (33.6°) — and the
  driving "complement" is really the **tritone** (177.1°, a hair off 180 —
  diabolus in musica; the eye can't say why it's uneasy). No even-spaced
  palette generator produces these angles. Three more numbers run live:
  the **golden swell** breathes chroma hottest at φ of every 8-bar phrase
  (the proportion Mozart placed his arrivals on); the **conjuror's wash**
  uses precognition — when the score shows a landing coming, the room
  inhales toward its own complement, the retina adapts against it, and on
  the hit the true hues snap back and bloom *hotter than the screen can
  paint* (a deliberate afterimage — luminance barely moves, so the flash
  governor has nothing to object to, and CALM keeps a gentler inhale); and
  **dreimal**, every third arrival answering three times, one fading echo
  per beat — the Magic Flute's threefold chord.

- **Three colours → a gradient.** Before any scene sees the plan, the three
  stops are stretched into a 128-texel cyclic ramp interpolated in OKLCH. A
  straight blend between two saturated hues is at its greyest *exactly*
  halfway — which is where most of a spiral's arm or a coil's length happens
  to live — so the ramp walks the hue around the wheel instead and holds
  chroma the whole way across.
- **A highlight rolloff, and a white budget.** Additive light is unbounded and
  a framebuffer is not. Hundreds of glowing sprites summing into one pixel
  used to clip channel-by-channel, and because the brightest channel clips
  *first*, the colour died before the brightness did — that white blob with a
  coloured rim is a hue failure, not a brightness one. The field now
  accumulates in a half-float target (capability-probed, never assumed) and a
  final GRADE pass compresses the max channel along a soft knee, rescaling the
  triple by the same factor so hue and saturation survive **any** drive: a 5×
  amber lands as a blazing amber, not as chalk. The curve approaches 1 from
  below without arriving, so *light alone can no longer make white*. Bleaching
  is spent from a budget the act and the section's own intensity ceiling open —
  a loud intro stays a colour; the drop gets the glare. Devices without
  half-float targets — and ECO power mode, which pays for no extra passes at
  all — fall back to a tighter additive trim and the same per-layer rolloff.

Three dots in the HUD show the live palette next to the key and scheme —
and they are a button: click to hold the room in **SPECTRUM** or **DUOTONE**
(two colours, nothing pale to wash toward), or leave it on AUTO.
Unkeyed material (local files, the mic) plans from live brightness and
entropy and re-deals itself periodically. This is the contract a
Sphere-class surface wants: features in, palette out, deterministic,
testable, 60 fps cheap.

## The console — a control surface that glows in the key

The chrome is not a fixed theme; it is a pro-audio instrument that **lights up
in the music's key**. The colour engine's live palette (derived from the
track's detected key) drives a `--accent` variable each frame, so the play
button, the active tabs, the volume, the now-playing row, the focus glow — the
whole console — breathe in the key colour. Möbius Walking (7B) makes a teal
instrument; a track in another key makes a different-coloured one. The UI and
the art are one organism reading the same music.

The seek is a **decoded whole-track waveform** — the DJ-deck overview. On load,
the track is decoded off the playback clock into a peak envelope; the played
portion lights in the key, the rest sits dim, a bright playhead rides the
position, and you scrub the song by grabbing it. When there is no decodable
buffer (the mic, an exotic codec) it falls back to a **live frequency-coloured
scope** — lows warm, mids in the key, highs bright — so the seek is always alive.
The same decoded envelope doubles as a reactivity fallback: on a platform with
no live analyser and no shipped score, `driveFromEnvelope` feeds the field from
the track's own low/mid/high bands, so local files dance too.

The chrome is built in the platform's own visual language: **native system type**
(SF on Apple, Segoe on Windows, Roboto on Android — the technical π/e/BPM readouts
stay monospaced), **see-through frosted panels** with heavy blur and saturation
so the field glows through them, an inner top sheen for depth, and neon-glow
accents that light active tabs, icons and the play button in the key. On phones
the top bar declutters into a ••• overflow sheet, the scene dots become a
scroll strip, and the transport grows to full thumb size.

## The storyteller field — abstract art that answers back

The visualizer is one engine now (the best of the retired quantum/π-e pages
folded into Möbius⁸, see `legacy/`): **seventeen scenes** — spiral, helix,
Möbius band, starburst, nebula, tunnel, **RIBBONS** (six spectral ribbons
that dissolve into particle mist as the music's entropy rises), the
raymarched fractal field, and the new wing: **COMETS** (neon meteor rain,
every streak its own colour), **FERN** (an iterated-function fractal drawn
dot-by-dot as the track plays — a different species every visit), **ROSETTE**
(spirograph rings drawn three times in offset palette channels, the
chromatic fringe blooming on hits), **SLINKY** (a chalk-grain coil whose
ambiguous spin you can argue with by dragging), and **OP-ART** (a flat
pattern machine rolling between six forms: an isometric cube tessellation,
a circular labyrinth around a black hole, an infinity-mirror dance floor
lit on the grid, a scalloped psychedelic spiral, a dot-grid disco tunnel
falling to its vanishing point, and dashed radar rings relayed in offset
palette channels), and **HALO** (the spectrum bent into a ring: a torus of
thousands of rainbow motes where each angle of the circle listens to one
band of the live spectrum and visibly swells where its band sings — an
equalizer curled into a circle of light, with winding bead-strands, a
beat soliton orbiting the ring, and treble twinkles). Keys `1`–`9` and
`0` reach the first ten; the scene dots reach them all. Over any scene, the **lens engine** can reshape the whole
frame — kaleidoscope MIRRORS, a rolling WAVE, a chromatic PRISM, a mirrored
TILE relay, MOIRÉ interference, a breathing IRIS, and stacks of them — with
AUTO putting a lens on only where the song's structure earns it. Three things keep it feeling like a storytelling machine
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
- **Touch — the fabric, not a heads-up display.** Drag steers the camera (the
  auto rig waits ~9 s while you hold it), scroll walks in and out, double-tap
  fires a shockwave. But the touch itself is not drawn: your hand deforms the
  metric the world lives in, and everything obeys it. See
  [Touching the fabric](#touching-the-fabric) below.

## Touching the fabric

The touch used to have a *stage*. A full-screen 2D canvas at `z-index: 4` drew
each personality: a photon ring stroked around the void, three spiral arms wound
for the vortex, a disk of orbiting motes for the accretion, expanding rings for
the waves, a progress arc banking the hold, a bright wavefront on release — all
in the music's live palette, over a `<div>` that darkened the field with
`mix-blend-mode: multiply`.

Every number in it was correct, and it read as a HUD. That is not a tuning
problem: a screen-space stroke at a fixed pixel width sits in *front* of the
world. It ignores depth, ignores the camera, ignores which scene is up — and it
needed a dark radial veil painted underneath so its glow would read over a busy
field, which means the actual visuals were being dimmed so the decoration could
be seen. A progress arc under your thumb is a UI element no matter what palette
it borrows.

All of it is deleted. `#touchCanvas`, `#voidFx` and `#voidRing` are gone from the
document, and nothing replaced them in that layer. What answers your hand now is
a **metric** — one description of how space is deformed around your touch, with
two consumers reading the very same functions:

- **the matter.** Every point shader displaces its particles through the metric,
  in view space *and in depth*, so a well is a hole you can see into and matter
  pushed away shrinks and dims through the same perspective divide as everything
  else. Nothing is faked; it is actually further away.
- **the light.** A full-screen pass refracts the composited frame through the
  same metric. This is what makes the eleven raymarched scenes answer at all —
  they have no particles to push, and until now a touch got them a camera nudge
  and nothing more. It runs *before* the artistic lenses, so a kaleidoscope
  repeats your distortion into every sector: the room's symmetry answering the
  touch rather than covering it.

The GLSL is generated from the same constants the JS holds, and
`tools/touch_probe.mjs` evaluates it **on the GPU against the JS** and fails on
drift (worst observed: 2 × 10⁻⁵). One fabric or none.

### What each force is, now that nothing is drawn

| | | |
|---|---|---|
| **VOID** | a black hole | Light bends *in*, so the image is pushed *out*. The core is black because light inside the capture radius does not come back — there is nothing there to sample. Hold, and the horizon genuinely widens. |
| **SPIN** | a vortex | Frame dragging: space is *rotated*, chirality from your drag, speed from the spin you banked slinging it. Rotation preserves radius, so it winds the world without smearing it. |
| **PULL** | an accretion disk | The well draws inward *and* shears into orbit. Light concentrates as space compresses, so the middle brightens — measured at 22× the surrounding luma. |
| **WAVE** | ripples | The metric oscillates radially: real refraction rings, cresting harder on the beat, because the fabric is listening too. |

The bright ring around the void is not stroked. A lens produces **two images** of
whatever is behind it, and at the Einstein radius the two converge on the same
source point and the light doubles — so the pass samples both deflections and
adds them, and the ring appears where the physics puts it. The commitment you
build by holding shows up as the horizon widening and the colour channels
splitting under strain. The release travels: a wavefront leaving the lift point
at (1−burst)·1.55 screen radii, measured moving from the innermost annulus to the
fifth as it decays.

### Bounded on purpose

Real deflection goes as 1/*b* and therefore diverges at the centre. Physics is
fine with that; a screen is not. The first attempt displaced samples by **1.6
screen radii** under the finger and annihilated the frame. So the deflection is
soft-clipped by `x/(1+|x|/max)` — exact for small *x*, which keeps the true 1/*r*
tail in the far field where the "this is space" reading actually comes from, and
asymptotic under the hand where the horizon has taken over anyway.

The long tail matters more than the near field does. A decoration changes a disc
of fixed pixel radius; gravity is felt across the room. Measured, in annuli
around the touch: `0.097 0.097 0.052 0.013 0.010 0.003` — hard near the hand,
faint far away, and **zero in the corners**, because a distortion with no edge is
nausea rather than wonder.

Which is the other half of this. A full-screen deformation is a vestibular event,
so `warpBudget()` caps it: 0.6 when the safety governor has already asked the
show to calm down, 0.34 under `prefers-reduced-motion`, and the ripple's own
clock freezes there so nothing swims. It shrinks and it **never closes** — a hand
that touches the world and feels nothing is its own defect. On a device the adaptive governor
has found to be struggling the light pass **degrades rather than disappears** —
`LENS_FIELD_LEAN` is one texture tap through the same metric, same capture radius,
same ceilings, dropping only the ornament (the second image, the channel split, the
area dimming). It used to be switched off entirely, which meant the phones most
likely to be holding this app had a touch that moved particles and left the light
alone, and every raymarched scene answered a hand with silence. ECO is the one place
it does not run at all: that mode exists to give the battery to the music.

## The gap between two tracks, on a phone

iOS is a different engine. The WebAudio graph is deliberately not live there —
`createMediaElementSource` is a one-way door and a suspended context silences
lock-screen playback — so the mixer stands down and every track change is the
same-element advance: assign a new `src` to the **one** element holding the audio
session, and play. That element is blessed. Moving playback to the other deck is an
un-gestured start iOS blocks when the screen is locked, and alternating decks churns
iOS's decoder budget until the blessing quietly lapses and the music stops mid-queue.
Both of those were learned the hard way and are not up for renegotiation.

Which left the cost of the swap itself, and nothing was warming it: the deck preload
that covers this on desktop lives in `MIXER.arm()`, which never runs when the graph
isn't live. Measured with an iPhone user-agent over a 900 kbps pipe, so the shipping
iOS branch is the branch under test: **2148 ms of silence between tracks**.

`PREFETCH` fetches the next track into memory while the current one plays and hands
the element an object URL at swap time. One element, still blessed, no extra decoder
— the bytes simply arrive from RAM instead of from the network.

| | requests | served | gap |
|---|---|---|---|
| nothing warmed | 4 | 3.7 MB | **2148 ms** |
| prefetch on | 3–4 | 5.1 MB | **~1500 ms**, none of it network |

What's left is not ours. With the warm on, the app reaches `playIndex` **0 ms** after
the track ends and there is no network in the path at all; every remaining millisecond
is the media element tearing down one decoder and building another. On one element
that cost cannot be removed, and the second element that would remove it is precisely
what costs iOS the lock screen. So `tools/handover_probe.mjs` gates the parts this
code owns — no app latency, no network in the path, playback never leaving the blessed
element — and reports the total with its measurement rather than asserting a number
this layer can't promise.

Metered connections are left alone (`saveData`, 2g/3g). The draw is committed the way
`MIXER.arm()` already commits it, and a running mixset's draw is never advanced early,
because that one carries the set's own bookkeeping. A prefetch that fails is silent:
playback falls back to the network URL, which is exactly what happened before.

## The front porch — fresh inspiration at the door

The label is always pressing new music, so the library greets you with
what's fresh instead of an alphabetical wall: **Hot this week** (the most
played track on this device — your own honest taste, from the local
history, never a server), **This month's crate** (the latest pressings by
publish date, tappable as a ready-made set), and the **Fresh pressing**
(the newest drop). All of it computes itself — the crate reads the
catalog's `published` dates the build already stamps, the hot track reads
the play history the player already keeps, and a slow month quietly widens
the window so the porch is never empty. Publish music and the porch
updates; play music and it learns.

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

### Updating — a tap that always means something

Two independent paths carry a new release to a running page, and one policy
governs both. A stamped deploy is a new `sw.js`, so a new worker installs and
**waits**; applying hands over (`SKIP_WAITING` → `controllerchange` → reload).
A deploy that forgot the stamp still arrives, because the live worker
byte-compares `index.html` on every boot and every check — bytes, not version
strings — and tells the page when they differ. Nobody has to delete site data.

The parts that took a real browser to get right:

- **A tap is never a no-op.** `applyUpdate()` used to refuse when no worker was
  waiting, and silently hide the button. That state is easy to reach: a second
  client — another tab, or the installed app open beside the browser — applies
  first, its `SKIP_WAITING` activates the new worker, and every *other* client's
  `registration.waiting` drops to null. Those pages are the worst ones to
  refuse: they are already controlled by the new worker, whose cache holds the
  new shell, so a plain reload lands the update immediately. Now it reloads.
- **A sibling handover is noticed.** A `controllerchange` we did not ask for
  means the code running here is older than the shell the controlling worker has
  cached. The page is never yanked mid-track, but the offer stays true. (The
  *first* claim of an uncontrolled page is excluded — that is a first visit, not
  an update, and treating it as one made every first visit update itself.)
- **A difference is not a newer build.** A listener was shown `05d9b7a1af → new`
  while running `05d9b7a1af`; applying it changed nothing and the next check
  raised it again. Three things let that through: the "already current" guard only
  rejected a matching build when a card was *already* on screen, so the first claim
  of every check sailed past; the sibling-handover path carries no build id, so the
  guard was skipped entirely and the card rendered its target as the word "new";
  and the worker announced a fresh shell whenever the fetch differed from its
  cache — **including when that cache was empty**, which it is on every activation,
  because `SHELL_CACHE` is versioned. `updateOffer()` is the rule that was missing:
  a waiting worker stands on its own, a shell claim carrying an id is settled
  against the running build with no qualifiers, and a claim with no id is *checked*
  against the deployed shell before it earns a card. A card raised in error now
  withdraws itself instead of waiting for a reload.

  The loop brake in `updateGate` had been there since the deferral work and was
  not enough: it rate-limits the *automatic* apply, which is why the app kept
  working and also why the card kept coming back by hand. Braking the apply treats
  the symptom; the offer itself was never gated.
- **"Later" is a promise.** The snooze used to live in a variable, so the next
  reload forgot it and the app went straight back to asking. It is stored now,
  along with a count: the button wears that count as a badge, goes quiet while
  the snooze holds, and reminds **once** when it runs out — then stops talking
  after five deferrals and keeps only the badge. Applying clears the count.
- **A loop brake.** Applying reloads, and a reloaded page asks again — so a host
  that made the shell compare differently every time would reload forever, which
  is worse than never updating. After three automatic swaps in one session,
  automatic application stands down; a deliberate tap is never rate-limited.
- Plus what was already there: an honest progress bar on a learned estimate, a
  staged watchdog that escalates and then hands the app back alive rather than
  leaving a dead "Updating…", and ⚡ SHOW mode, which holds every update so a
  performance is never interrupted.

### The mix engine — what is solid, and what is measured but not yet fixed

The blend defaults to **eight beats**. That is a reliability decision before a
taste one: at 124 bpm a 32-beat overlap is fifteen seconds during which two decks
must hold phase and the tempo glide has to walk from one BPM to the other and
back into lock, and any drift the lock cannot absorb has fifteen seconds to grow
into a flam. Eight beats is under four seconds — long enough to read as a mix,
short enough that error has no room to accumulate, and it is what a working DJ
does on a floor that wants the next song. Longer blends stay available per pair
in the Mix tuner; nothing takes one by default. Match scoring was decoupled from
blend length at the same time — it now reads harmonic distance and tempo
proximity, which are properties of the *pair*, rather than rewarding whichever
plan happened to be longest.

`tools/mix_probe.mjs` measures a real seam on a real graph. It localised a defect
that had been reported as intermittent, and the fix is measured by the same tool:

| condition | beat-phase error | | |
|---|---|---|---|
| | before | after | contract |
| main thread free | 0.3 ms | **4.0 ms** | 40 ms |
| visualizer running | 114–119 ms | **1.9–8.0 ms** | 40 ms |

The seam was excellent when nothing else was competing and lost its beat lock when
the visualizer saturated the main thread — a **coupling** problem, not a tuning
one. The cause turned out to be a single line. The incoming deck was placed at its
absolute planned entry point at whatever instant the animation loop *noticed* that
the outgoing track had crossed its bar line, so the offset between the two beat
grids was simply the frame's lateness: at 124 bpm a 114 ms frame is a quarter
beat, which is exactly the flam a listener reports. Worse, the only window in
which the phase servo is allowed to correct hard — while the incoming deck is
still inaudible — had closed before the servo's once-a-beat check ever ran, so the
error survived the whole blend at the ±0.4 % the tempo trim can absorb.

Three changes, none of which depends on the frame rate:

- **The seam is placed relative to where the outgoing track actually is.**
  `seamEntry()` gives the incoming deck the outgoing deck's slip, so a late call
  places a *correct* seam rather than a punctual wrong one. A whole beat late is
  still in lock.
- **Every seam is scheduled a lead-in ahead of itself on the audio clock**, and a
  beatmix is triggered that much early so the fader still opens on the bar line.
  The deck gets 450 ms to actually start rolling — media elements take 200–700 ms
  to resume under load — through a window in which it cannot be heard.
- **The servo latches the moment the incoming deck is genuinely rolling**, not a
  beat later, so the hard align happens inside the lead-in where it is silent.

Both `tools/mix_acceptance.mjs` phase checks (0.9 ms and 0.4 ms) and the probe's
beat-lock check now pass under render load; the latter was promoted from a tracked
number to a **regression gate**. What remains open, and is printed with its
measurement on every run, is that the element's resume still runs 210–680 ms, so
the lead does not always cover it. That no longer costs the lock — the servo
measures the grids once the deck is rolling rather than trusting where it was
placed — but the worst observed case is an onset around −20 dB a half-beat into
the fade: a soft entry, not a hole. Closing it means rolling the incoming deck
silently through the armed window so the seam never calls `play()` at all.

**iOS is a different engine and is unchanged.** There the WebAudio graph is not
live at all: `createMediaElementSource` is a one-way door and a suspended context
would silence lock-screen playback, so decks play element-direct and the OS owns
them. iOS also ignores `volume` on media elements, so a crossfade is not
expressible — every transition falls to the same-element advance, which is the
audible stop-and-reload between tracks. Fixing it means choosing between routing
iOS through the graph (risking the pocketed phone going silent) and alternating
two elements (which churns iOS's decoder budget and can quietly drop an element's
autoplay blessing mid-queue). Both are real trades with real downside; neither
should be made silently.

### The activity log

At the bottom of the Console: what the application has actually done on this
device — updates offered, deferred, applied and recovered; what played; when the
library loaded; when the network came and went. Newest first, bounded, with
consecutive repeats coalesced into a count so a long set does not bury the one
line that matters. Kept on the device, sent nowhere, and clearable. It exists
because everything above happens behind the glass, and when something feels
wrong there was previously nothing to look at.

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
python3 tests/test_pipeline.py      # 41 tests: build, dedupe, ingest-convert, name-pick, folder-is-album, orphan-sweep, gate, doctor, features, mix,
                                    #   the score's band envelopes, + the shipped catalog's
                                    #   hashes match the audio on disk
node tests/player.test.mjs          # 207 tests: solver, quantum, history, restore, planner,
                                    #   colour, safety governor, clock, dance (extracted from
                                    #   the shipped HTML, not a copy)
python3 tools/make_synthetic_deploy.py /tmp/mb8 1000
node tools/acceptance.mjs /tmp/mb8  # 36 browser checks: boot < 2 s warm, deal < 100 ms,
                                    #   restore-paused, v1 rejection, SW audio bypass, crate,
                                    #   15-scene sweep, acts, touch, colour, dance, real demo,
                                    #   key-reactive accent, decoded waveform seek
python3 tools/make_mix_fixture.py /tmp/mb8m
node tools/mix_acceptance.mjs /tmp/mb8m      # 28 checks: grids, keys, live beatmix, MIX NOW,
                                    #   phase lock < 40 ms, gates, crate, mixfix
node tools/update_acceptance.mjs /tmp/mb8u   # 9 checks: publish → Update button →
                                    #   one tap → new build live, state intact
python3 tools/make_mix_fixture.py /tmp/mb8-mix
node tools/mix_probe.mjs /tmp/mb8-mix        # the SEAM on a real graph: master-level
                                    #   envelope across the blend, whether the incoming
                                    #   deck was rolling before the blend could be heard,
                                    #   the beat-phase error, and that no deck is left
                                    #   off-unity afterwards. MB8_PROBE_RENDER=1 re-runs
                                    #   it with the visualizer live, which is how the
                                    #   seam's frame-rate coupling was found — and is now
                                    #   the condition the beat lock is GATED under
node tools/update_probe.mjs         # 17 checks on the REACHABILITY of an update:
                                    #   stamped + unstamped deploys, a sibling client
                                    #   consuming the waiting worker, and "Later"
                                    #   surviving a reload. (acceptance asks whether
                                    #   state survives a swap; this asks whether the
                                    #   swap happens at all), plus the one nothing
                                    #   was watching: with NO deploy, four checks
                                    #   and a reload must produce no offer at all
node tools/color_probe.mjs docs     # per-scene washout + chroma on a real GL context,
                                    #   and the shipped GLSL rolloff checked against
                                    #   its JS twin on the GPU
node tools/handover_probe.mjs /tmp/mb8-mix   # the gap between two tracks on the path a
                                    #   PHONE takes: an iPhone user-agent so the shipping
                                    #   iOS branch of playIndex is what runs, and a
                                    #   throttled pipe, because a stall that only exists
                                    #   over a real network is invisible on localhost.
                                    #   Reports the gap broken into its legs and checks
                                    #   playback never leaves the blessed element.
                                    #   --nowarm measures the before picture (2148 ms)
node tools/touch_probe.mjs docs     # 27 checks that the hand is IN the world: the
                                    #   overlay layers do not exist, the image bends
                                    #   where the metric claims and nowhere else, all
                                    #   four forces are genuinely different
                                    #   deformations, a raymarched scene answers, the
                                    #   GPU metric matches the JS one, and reduced
                                    #   motion shrinks it without closing it.
                                    #   --png DIR writes the before/after frames
```

Physical-device acceptance (iPhone lock screen ≥ 10 min, Bluetooth
next/prev, CarPlay Now Playing, AirPlay routing, interruption recovery) needs
hardware — see DESIGN.md for the current status.
