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
remix.py                   the remix layer — scores, grants, lineage (REMIX.md)
signing.py                 Ed25519 in pure Python + canonical JSON
TRUST                      the keys this label accepts grants and scores from
grants/                    signed permissions to make derivative works
remixes/<slug>/remix.json  a remix: a signed score, containing no audio
LICENSE-CODE               MIT (the code)
LICENSE-AUDIO              all rights reserved (the recordings)
LICENSE-DNA                CC0 (the measurements — fingerprints, grid, key, stems)
```

## the remix layer — [REMIX.md](REMIX.md)

*The score is open. The sound is not.*

A remix here is a signed JSON document containing **no audio**: operations
addressed in bars and beats against recordings named by content hash. It
forks, diffs and merges because it is text; the audio materialises only on a
machine that already holds the files. That is what makes an open-source label
possible on a public host — the repository distributes a score, and a score of
a work you may lawfully arrange is not a copy of it.

Three layers, three licences. The recordings stay all-rights-reserved. The
**measurements** — fingerprints, tempo, key, structure, the 12 Hz per-stem
envelopes — go to the public domain under `LICENSE-DNA`, because a tempo is a
fact, and that is where the "open" is real. Arrangements are MIT.

Permission to make a derivative is a **grant**: a signed capability naming one
work, some verbs (`excerpt`, `separate`, `timestretch`, `layer`,
`publish-score`, `render-public`, `commercial`), and an expiry. Verification
*computes* the verbs a score actually uses and refuses anything the grant does
not cover — so holding a trusted key does not let you exceed your grant.

Because the DNA is open and rich, the tooling can draft a musically valid
mashup with no audio present at all:

```sh
python3 remix.py suggest --instrumental      # where can a vocal live?
python3 remix.py pair BED TOP --out remixes/x  # 80 vocal-free bars, key- and tempo-matched
python3 remix.py verify remixes/*/remix.json   # the gate CI runs
```

Signatures are Ed25519 implemented in ~150 lines of stdlib arithmetic, because
a grant issued today must still verify in 2040 from a clone with nothing
installed. There is no blockchain: git is already a Merkle DAG with a social
consensus layer, and `TRUST` is a file whose every line has a `git blame`.

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
                    "entropy": 0.55, "onsets": 0.30,
                    "instr": { "bass": 0.64, "perc": 0.10, "tonal": 0.90, "air": 0.01 },
                    "texture": "bass-driven" }
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

`instr` is a per-track timbral fingerprint (bass/percussive/tonal/air, each a
0–1 share of the track's own spectral energy) from a median-filtering
harmonic/percussive split (Fitzgerald 2010) — no ML, no training data. `texture`
is a catalog-relative label (`bass-driven` / `percussive` / `melodic` /
`atmospheric` / `full-spectrum`) picked by percentile-scaling those four ratios
against the whole library, so a track only earns a label when one axis genuinely
stands out from the rest of the catalog. The `mix` block also carries a
`structure` field — the same energy-hysteresis section arc (`intro` / `build` /
`peak` / `drive` / `break` / `outro`) the player derives client-side from the
waveform, precomputed server-side so the booth and Crate never have to guess it
from a partial buffer.

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

### The last hand on the signal

Everything upstream of the speaker is allowed to be loud: two decks at +6 dB
of loudness make-up, an echo unit that sums back in pre-fader, a drive stage
whose wet and dry add, a beat echo in parallel with both. Nothing upstream
was allowed to *clip*, and nothing upstream prevented it — the browser
hard-clips at the DAC, which is the one distortion that is not a choice.

So the master now ends in a **brickwall true-peak limiter**, transparent by
construction and running on the audio thread inside an `AudioWorklet`:

- **lookahead** — the signal is delayed three milliseconds and the gain that
  will be needed is computed from the samples still in the delay line, so the
  gain has already *arrived* when the peak does; a hard step from silence
  comes out already tamed, with no overshoot and no click at the attack
- **true peak** — the detector estimates the waveform *between* samples with a
  cubic through its neighbours, so a peak the DAC's reconstruction filter will
  reach but no sample carries is still seen; the ceiling sits at −1 dBTP
- **stereo-linked** — one gain for both channels, or the image would lurch
  toward whichever side was quieter on every hit
- **unity until needed** — below the ceiling the kernel is a pure delay: the
  output *is* the input, bit for bit, and the unit suite holds it to
  bit-exactness. A limiter that colours the music it was told to protect is a
  fault
- **visible** — the gain reduction is posted back twenty times a second and the
  booth draws it as a `LIM` lamp beside the channel meters. The honest
  expectation is that it stays dark: a clean set never reaches the rail

The kernel is pure arithmetic in the `@master` block; the worklet module is
those very functions serialised into a blob, so what the suite tested is what
the audio thread runs — there is no copy to drift. Where there is no
`AudioWorklet` at all a `DynamicsCompressor` at a hard ratio takes the seat:
not transparent, not true-peak, but a rail. The direct path is live from the
first sample and the limiter is crossfaded in the moment its module loads, so
the music never waits on it. On iOS, where playback is element-direct, none
of this applies and none of it is claimed.

Two smaller things landed with it. **The master is never written, it is
ramped**: a volume slider that wrote a gain node forty times a second was
forty small steps in the waveform, and a mute that stepped to zero was a
click. And the analyser's **band edges are frequencies, not bins**: the
44.1 kHz table was being read on 48 kHz contexts too, which put every
crossover nine percent sharp on half the machines the visuals dance on.

`tools/master_probe.mjs` proves the rail is *there*, on a real graph: a
+12 dB mix never crosses the ceiling at the speaker while a clean one passes
untouched, the meter agrees with the recorder, and a hard volume drag leaves
no step the music does not already contain.

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

**And it has hands.** Below the decks is an **FX rack in six banks**, laid out
the way hardware lays them out because that layout is the argument:

- **LOOP** — eight beat loops from a 32nd to 16 bars. Tap and the loop latches
  on the **last grid line the ear already heard**, never the next one, because a
  loop that begins in the future is a gap. Halve and double re-cut from the same
  in-point, so a phrase can never slide out from under your hand. And it does not
  seek — see below.
- **ROLL** — the same eight lengths, **momentary**: held, not latched. This is
  the one difference that makes them two controls instead of one. A loop makes
  the track *wait*; a roll stalls the music while the track keeps running
  underneath, so releasing lands you where you would have been. The phrase stays
  intact and the roll reads as a stutter *over* the music rather than a detour
  through it.
- **CUE** — eight **hot cues per track, remembered**. An empty pad takes the
  playhead and **snaps it to the nearest beat line**; a set pad jumps back to it
  — and the jump is **quantised the way a CDJ quantises**: pressed mid-beat it
  waits for the beat line before it goes, and a tick that noticed late carries
  its lateness onto the landing, so the phrase never stumbles. Hold a pad to
  clear it. The cues are keyed on the track's hash, so a republished file keeps
  them, and they never leave the device. `⇧1`–`⇧8` are the same eight pads from
  the keyboard, booth open or not; the flags sit on the waveform in the pad's
  colour.
- **JUMP** — whole beats forward or back, one to sixteen, phase kept by
  construction (`,` `.` and `<` `>` from the keyboard). A jump under a held loop
  **moves the loop with it**: the loop lets go, the deck moves, the same length
  latches again at the new place — the hand never has to choose between the two.
- **EQ** — a channel strip's three bands on the mix, at the corners a DJ mixer
  puts them (250 Hz shelf, 1 kHz bell, 4 kHz shelf), and the thing a hand does
  to them most: **kill one**. Kills are deep, not infinite (−36 dB reads as gone
  and still lets the band breathe back in without a step), a pad that is already
  doing what it is asked undoes it, FLAT is bypass to the same standard as the
  filter's detent — and `booth_probe` measures each band on the bench.
- **FX** — filter, echo, gate and drive on one knob, every time constant a beat
  division read from the **same CLOCK the shaders and the haptics follow**. The
  filter is one bipolar sweep with a real detent at the centre. The gate chops on
  the beat rather than from an LFO, because an oscillator drifts against the music
  within a bar and the beat clock does not. Plus a **BRAKE** that is a turntable
  losing power, not a fade — and a **KEY LOCK** pad. On, a deck bent to match a
  tempo keeps its pitch through the browser's time-stretcher, which is the
  right default. Off, the pitch rides the tempo the way vinyl does: a third of
  a semitone sharp at +3%, and free of the stretcher's artefacts, which on some
  engines is the more transparent sound over a small trim. A DJ's call, so it
  is a pad, and it is remembered.

The waveform on lane A is a **scrub strip**: a finger or a mouse on it seeks the
deck that owns the room, a drag follows it, and the seek keeps a held loop the
way a beat jump does. Not during a seam — the outgoing deck belongs to the
mixer then.

The magical half is **AUTO**: the same hands, given to the director. A listener
who never opens the booth still hears the echo bloom into a hand-off and the
filter open across a build — chosen from the song's own structure, never from a
timer, and never during a quiet passage or on a device that is struggling. The
moment you touch anything, AUTO switches off and **stays** off until you arm it
again. A room that quietly undid what you just set would be a fight you cannot
win, because the room never tires.

Nothing in the rack can strand the music: every unit is parked at bypass, every
automation is bounded, and a track change hands the whole booth back — no seam
ever inherits an effect the last track left switched on.

### The loop does not seek

A beat loop in a browser is normally a **re-seek**: watch the playhead on an
animation frame and, when it passes the out-point, write `currentTime` back to
the in-point. The arithmetic here was always right — the overshoot is carried
across the wrap, so the average cycle is exactly the length it says it is and the
loop never drifts off the grid. That is the half a unit test can prove, and it
was never the problem. The other half it cannot touch: **setting `currentTime` on
a media element asks a decoder to jump, and a decoder asked to jump takes a
moment to have audio again.** Once per cycle, forever, exactly on the beat — the
single most audible place a fault can be.

So the loop stopped seeking. A recorder on the mix keeps the last twenty-four
seconds; the first time the loop goes past, it is **cut out of that tape and
handed to an `AudioBufferSourceNode` with `loop = true`**. From that instant the
wrap happens in the audio thread between two adjacent samples — no drift, no
decoder, no animation frame, and no seek at all for as long as the loop is held.
The deck keeps running underneath, silent, so letting go is a crossfade rather
than a jump; a **roll** does not even need that, because the track really did run
on underneath it and is already exactly where it should be.

Three things make it honest rather than merely clever:

- **The head of the loop is blended with the audio that really did follow the
  out-point**, over about twelve milliseconds. A loop point is a splice — sample
  *len* is followed by sample 0 — and if the waveform disagrees there it clicks
  on every single cycle. That one blend fixes both joins at once: the buffer's
  first sample *is* the sample the deck was about to play, so the handover is
  continuous and so is every wrap after it.
- **The tape calibrates itself.** Cutting the loop out needs to know which
  recorded sample the graph is playing right now, and the recorder runs ahead of
  what is audible by an amount nobody documents and every device gets
  differently. Guessing it wrong does not fail loudly — it puts one audible jump
  at the top of the first loop. So it is not guessed: a single-sample impulse is
  fired into the recorder at a known clock time and found again in the ring,
  which measures the relation exactly, on the actual device. It never reaches the
  room, and it is zeroed out of the tape once it has been read.
- **It never races.** Cutting the buffer is main-thread work on a main thread
  that is also drawing thirty-one rooms, and there is no arrangement of leads and
  timers that wins that race on every device. So the **old re-seek loop keeps
  running until the handover can be made properly** — the loop loops from the
  instant the pad goes down, and the tape takes over on the first out-point it
  can reach in time. The failure mode of the new machinery is the old machinery,
  which is the only failure mode worth having. On iOS, where playback is
  element-direct and there is no graph to record, the whole layer stands down.

Three more things, found by listening harder:

- **The tape can tear.** The recorder runs on the main thread, and a block the
  main thread fails to collect in time is a block that never reached the ring —
  the tape then holds two moments of music butted together as if they were one,
  and a loop cut across that join carries the splice on every lap. The recorder
  now notes where each tear fell, off the processor's own clock; a cut that spans
  one is **refused**, the anchor is moved to the next lap (the re-seek loop is
  replaying the same slice underneath), and the loop is taken from tape that is
  whole.
- **The handback asks the deck.** Letting go of a loop seeks the deck early and
  lets the loop cover for it — but the crossover used to be scheduled at a fixed
  lead regardless of whether the deck had anything to play there, and a seek
  into a cold range takes as long as it takes. Now the deck is asked — real
  data, and buffered bytes across the window it is about to play — and the
  handback **waits for the answer**: late rather than empty, never past a budget,
  and if the loop wrapped while it waited the deck is put back where the loop
  will be and asked again.
- **The room can change shape.** The calibration is a measurement of one output
  device; a Bluetooth reconnect or an OS route change is another device with
  another latency, and a stale reading puts the handover on the wrong sample. A
  context that comes back from suspension, or a `devicechange` from the OS,
  **measures the tape again** — at once when it is idle, and once a held loop
  has been let go when it is not.

`tools/loop_probe.mjs` measures it in a real browser, on real music, both ways:
a recorder on the master, every write to the playhead counted. The seeking loop
writes the playhead on **every cycle**; the taped one writes it **zero times**,
and the wrap in the buffer the audio thread is looping is a step around **one
per cent** of the largest the music itself contains. The probe measures its own
instrument first — a `ScriptProcessorNode` on a starved main thread leaves
artefacts larger than the fault — so the numbers are read against that floor
rather than against nothing.

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
folded into Möbius⁸, see `legacy/`): **thirty-one scenes** — spiral, helix,
Möbius band, starburst, nebula, tunnel, **RIBBONS** (six spectral ribbons
that dissolve into particle mist as the music's entropy rises), the
raymarched fractal field, and the new wing: **COMETS** (neon meteor rain,
every streak its own colour), **FERN** (an iterated-function fractal drawn
dot-by-dot as the track plays — a different species every visit, and **coloured
by which of its four affine maps placed each dot**: the chaos game's only
structure is that choice, so the stem, the body and the two side fronds read as
their own colour families and their own depths, and the plant becomes a picture
of its own recursion rather than a green silhouette), **ROSETTE**
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
beat soliton orbiting the ring, and treble twinkles), the **LAVA LAMP**
— see [The lamp](#the-lamp--a-scene-where-the-wax-is-a-fluid) below — and the
mood-board wing: **CUBE SHEETS** (three lattices of rainbow blocks bobbing on
a rippled clock — the bob's phase travels outward from a rolled origin, so the
lattice moves as a wave, and contact is *earned*: quiet material bobs short of
touching while the bass and the beat drive the sheets the last inch into a
clap that visibly squashes), **MANDALA** (the kaleidoscope as a subject rather
than a treatment, dealt two ways: a k-fold petal BLOOM in the palette's five
hard colours, or the dotted SWIRL vortex on a log-spiral lattice where every
scale listens to its own band of the live spectrum), **OIL FILM** (thin-film
interference on a dark current: three wavelengths of one marbled thickness,
so the low end *walks* every fringe instead of brightening it, and the beat
drops a ripple ring), **BUBBLES** — see [Soap films](#soap-films--the-rainbow-solved-not-painted) below —
**CONSTELLATIONS** — see [The sky over Ohio](#the-sky-over-ohio--a-star-viewer-that-talks) below —
**FIREWORKS** — see [The show](#the-show--fired-to-the-grid) below —
**FILIGREE** — see [The escape-time set](#the-escape-time-set--three-techniques-and-an-honest-floor) below —
and the perception-and-optics wing:
**DRIFT** — see [Pictures that move without moving](#pictures-that-move-without-moving) below —
**DISPERSION** — see [Light, taken apart by an edge](#light-taken-apart-by-an-edge) below —
**FILAMENT** — see [A wire, seen through a bad lens](#a-wire-seen-through-a-bad-lens) below —
**SOAP FILM** — see [The sheet that drains](#the-sheet-that-drains) below —
and **TERRAIN** — see [A country with the colour turned up](#a-country-with-the-colour-turned-up) below.
Keys `1`–`9` and
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

## The room changes hands with the music

A seam is the one moment a set has that is bigger than a bar line — a new
track, a new key, a new tempo — and the visual director used to sleep through
it, changing rooms on its own dwell clock a few bars later or a few bars
earlier. Now **the seam cues the room**: the moment the mixer fires a blend,
a scene change is scheduled on the audio clock at the instant the music
itself changes hands. A beatmix lands it on the **bass swap**, when the
one-bass rule hands the low end over, and the visual crossfade is sized to
that swap — two beats of the incoming tempo — so the picture and the bass
move together. A fade lands it where the incoming becomes the louder of the
two. A gapless join takes a quiet dissolve, same album, same room, and
nothing at all if the room only just arrived. The decision is pure
(`seamSceneCue`), an automatic director only, reduced motion takes its slow
dissolve, and a cancelled seam withdraws its cue.

## The cut — how one room becomes the next

A scene change used to be a crossfade: both rooms live, one fading up through
the other. That is the right answer often and a wasted moment the rest of the
time, because a cut is the one instant in a set when the field has your whole
attention.

**The trick is the freeze.** On the single frame a cut happens, the room being
*left* is rendered once into a texture and never simulated again. From that
instant it is a still image — and a still image can be carried along a flow
field, thrown out of focus, pushed back into haze or bent through glass, none of
which is possible while it is still a live particle system with an update loop of
its own. One extra render every twenty to forty seconds buys the entire
vocabulary. The room *arriving* stays live throughout, which is why these read as
the field changing rather than as two videos being mixed.

### Nothing here has an edge

That is the constraint the whole thing is built around, and it is worth being
blunt about because the obvious transitions all violate it. A grid of spinning
shards. An opening aperture. A shockwave ring crossing the frame. A glowing seam
down the middle. Every one of those is legible in a single frozen frame, and what
it is legible *as* is **"a transition"** — which breaks the only claim the field
makes, that it is a space and not a screen with effects played over it.

So there is no geometry in here the world does not already contain, no boundary
travelling across the picture, and no seam lit in any colour. What is left is
seven things that could be happening to the light or to the matter:

- **LUMA** — the old room hands over **with its own light**. Its brightness is
  what decides where the new field comes through first, so every cut is shaped by
  whatever picture happened to be on screen and no two are alike. The threshold is
  dissolved into two scales of noise and the band is deliberately wide, so the
  handover happens grain by grain and there is no front to follow. Narrow it and
  a smooth gradient in the old frame sweeps as a hard line — which is a wipe, and
  a wipe is the thing being avoided.
- **SCATTER** — both rooms carried along **one** flow field in opposite
  directions, each gated on its own clock. The old does not fade and the new does
  not appear; the same material rearranges. The gate is smooth noise at two
  scales, not a per-pixel hash: a hash looks like dither, or worse like a bad
  JPEG, and a room that appears to be *compressing* itself is not a room
  dissolving.
- **DEFOCUS** — a rack focus, and the most invisible cut there is. Ten taps on a
  golden-angle spiral at radius √f, which fills a **disc** evenly rather than a
  ring, so a highlight opens into round bokeh the way a lens makes one instead of
  smearing into a star. The two rooms cross while *both* are soft, so at no point
  is there a sharp edge anywhere in the frame to notice.
- **AERIAL** — the old room recedes and the new one comes forward, and the thing
  between them is air. Extinction is exponential in depth and the departing room
  fades toward the **sky**, not toward black — the same rule TERRAIN draws its
  horizon with, and the reason a distant ridge is paler than a near one rather
  than dimmer. The scale change is two per cent: enough to read as depth, far
  short of reading as a zoom.
- **REFRACT** — one smooth low-frequency displacement across the whole frame,
  swelling to its peak at the midpoint and exactly zero at both ends, so the
  transition begins and finishes on an undistorted picture and the swap happens
  underneath the distortion. A hair of dispersion on the way, because glass in
  this player disperses.
- **PRISM** — the three channels separate and re-converge, 120° apart, at **three
  per cent** of the frame rather than nine. At nine it is an effect with a name;
  at three it is a lens that was briefly not quite right, which is the whole
  difference.
- **FOLD** — both rooms folded into the same N-fold symmetry by the same amount,
  rising to full at the midpoint and relaxing back to none, so at the moment of
  the swap the frame is a symmetry belonging to neither room and the join has
  nowhere to show. An earlier version collapsed the old room to a point and
  unfolded the new one out of it — a lovely trick, and unmistakably a trick.

And a plain crossfade, which still comes up often enough to keep the others rare.

### The music picks the form

`segueStyle` already decided how *long* a change takes; `segueFx` decides what it
looks like, and they are separate because a duration is a musical judgement while
a form is about what the eye can read in that time. A **drop** draws from
DEFOCUS · PRISM · REFRACT — decisive, and decisive does not mean loud; a hard
rack focus lands harder than any shattering glass. A **section turn** draws from
SCATTER · AERIAL · FOLD · LUMA, the forms that read as one room *becoming*
another. A quiet passage draws from the gentle end. Two rules on top: the plain
crossfade stays **in** the pools, because a night where every change is an event
has no events in it; and a form never immediately repeats, because the second one
in a row is where the eye starts looking for the mechanism instead of at the
room. Cuts land where they always did — the next bar downbeat, or the next phrase
for a big one.

The duration floors are long on purpose. A transition that has to be quick to
survive is a transition doing something drastic, and drastic is what this
vocabulary exists to avoid.

### Where it stands down

Under `prefers-reduced-motion` there is no transition at all — manufactured
large-field motion is exactly what that setting refuses, and the crossfade is the
correct answer rather than a degraded one. In ECO, because that mode's job is
giving the battery to the music. And on a device the governor has found to be
struggling. In all three the director's opacity crossfade takes over untouched;
there is no half-transition state to get wrong, and `tools/xform_probe.mjs`
asserts all three stand-downs in a real browser.

Two details that took a defect each to find. The old room has to be **let go of
entirely** the moment the freeze is taken: its frozen copy is what the transition
draws, so leaving the live one running draws it twice — once transforming, once
calmly fading underneath — which is invisible in a screenshot and obvious in
motion. And the transition pass goes **first** in the lens chain, ahead of the
hand and ahead of the glass: put it last and a kaleidoscope would fold only the
room arriving, with the room leaving glued flat over the top of the folded result.

On a **stage wall** the form and the seed go on the wire with the scene index,
because a wall is one picture cut into panels and has to agree with itself. On a
**floor full of phones** they deliberately do not: forty screens doing the same
thing on the same grid at the same instant would look like a stunt rather than
like a room.

## The escape-time set — three techniques, and an honest floor

The room already had a fractal — a raymarched Mandelbulb — but not the one
everybody means: the flat escape-time set, and the lace that grows on its
boundary. Three techniques separate a Mandelbrot that looks like a plate from
one that looks like a screensaver, and scene 26 uses all three.

**The smooth iteration count.** Colouring by the integer escape count gives
concentric bands with hard steps, which is the most recognisable tell of a
naive renderer. Subtracting the fraction the orbit had already earned —
`ν = n − log₂(log₂|z|)` — is continuous across the whole plane, so the bands
dissolve into a gradient the palette can actually use.

**The distance estimator.** Carrying the derivative alongside the orbit
(`dz′ = 2·z·dz + 1`, one complex multiply a step) gives the distance to the set
itself: `d = |z|·log|z| / |dz|`. That's a real length in the plane, so the
boundary can be drawn at a width measured in *pixels* rather than iterations —
which is why the filaments stay one hair wide at any zoom instead of aliasing
into mush, and the difference between a fractal that survives a projector and
one that doesn't.

**Orbit traps.** Watch how close the orbit passes to a shape — point, line,
circle, wave — and colour by the closest approach. The set doesn't change; what
changes is what you're asking about it, and the answer is the ornamental lace
along every filament. Every curl is a place where the orbits sweep past the
trap, not decoration laid on top.

Two forms, because they fail in opposite directions. **MANDELBROT** zooms, and
a zoom is finite here: single-precision floats run out of relative resolution
around 10⁻⁵, after which the plane goes visibly blocky. So it dives into a named
valley — Seahorse, Elephant, the Spike, the Antenna — hangs at a floor set
*above* that limit, and lifts back out on a phrase rather than pretending it can
go forever. **JULIA** doesn't zoom at all; it morphs, walking c around the
cardioid's edge where the set reorganises continuously and no precision is ever
spent. Between them the room is endless and honest at once.

Two things the screenshots caught. The far-field dimming was **inverted** — it
shaded by escape count, which darkens the thin intricate skin around the
boundary and leaves the empty plane blazing; the detail is what the room is for,
so it's the fast-escaping field that falls away now. And the palette is walked
in **log**: the escape count is tiny over most of the plane and enormous in a
thin skin, so a linear walk spends the whole gradient on the far field — which
is exactly what made the first cut a flat orange sheet with a thread of detail
in it.

## Pictures that move without moving

Every other room here earns its motion: something is animated and you see it
move. Scene 27 animates almost nothing and you see it move anyway, because the
motion is manufactured inside your visual system rather than inside the frame.
It is the only scene in the player whose subject is the observer.

**Peripheral drift** — Kitaoka's *Rotating Snakes* — is four luminance steps
laid tangentially around a ring. Low-contrast edges are processed with a longer
latency than high-contrast ones, so the four edges of one cell arrive at
motion-sensitive cortex at four different times; sequenced asymmetrically, those
arrival times look exactly like a moving edge, and V5 reports motion that is not
there. Three facts fall out of that mechanism and all three are honoured:

- **It is luminance, not hue.** The famous blue and yellow are decoration; the
  effect survives in greyscale and dies if you equate the four luminances. So
  the scene takes its **hue** from the live palette and then **forces the
  luminance** of every patch onto the four-step run. The room keeps the colour;
  the illusion keeps the brightness.
- **The order is the direction.** Reverse the run and the ring turns the other
  way. Adjacent rings alternate, which is why the plate shears against itself.
- **It needs a refresh.** The drift fires on transients — blinks and saccades —
  and fades under hard fixation. So the one thing this room animates is a
  couple of degrees of rotational **jog on the beat**, sprung so it returns
  exactly to zero. That is not an effect laid on top; it is the stimulus the
  illusion requires, and the music is supplying the blink.

The cell size is the mechanism, not a taste call. The first cut used a fixed
handful of segments per ring and drew a dartboard: at that scale the four edges
of one run land in different parts of the visual field, the latency differences
never get compared, and the plate is a pattern instead of an illusion. The
count is `2π·(ring index)` now, which makes every cell square.

Three more plates share the room. **BULGE** is a flat grid of flat tiles, each
carrying a small linear ramp along the gradient of a dome — every tile's mean
luminance is identical and its hue never varies, so there is no vignette and no
shading anywhere in the frame, only local gradients, and the grid swells off the
screen. (The first cut leaked the dome into the hue and drew a *lamp*; a lamp is
a picture of a bulge and this has to be evidence of one.) **ENIGMA** is Leviant's
— high-frequency radial spokes with plain coloured annuli over them, where the
rings stream and nobody quite agrees why; it is in precisely because it is the
one still under argument. **OUCHI** is two check fields at right angles, where
the disc reads as a separate sheet sliding over the ground.

And a line on **reduced motion**, which matters more here than anywhere else in
the player: a room whose entire purpose is to manufacture apparent motion is
exactly the wrong room for a vestibular listener. Under
`prefers-reduced-motion` the four steps are re-tuned **symmetric** — 0, ½, 1, ½ —
which kills the drift signal at its source while leaving the pattern on screen.
Not dimmed, not slowed: defused. The plate is still there and it no longer turns.

## Light, taken apart by an edge

A prism splits light because glass has a different index at every wavelength.
Nothing in scene 28 is dispersive at all — there is no glass, no index, no
material property. There is an **obstacle**, and the only length in the problem
is the wavelength, so every angle in every pattern is proportional to λ and the
colours fall out of geometry alone.

**The colour is not a palette; it is an integral.** Every pixel is the intensity
of the diffraction pattern at two dozen wavelengths across 400–700 nm, each
weighted by the CIE 1931 observer, summed into XYZ and converted once. It is the
same observer the flame bench integrates a black body against — `GLSL_CIE` is
**generated** from the very table `cieXYZBar()` reads, so the green of a laser
and the green of a first-order fringe come out of one set of numbers or neither
does. `tools/spectrum_probe.mjs` runs the shipped shader on the GPU across the
band and compares it against the shipped JS, the same way `touch_probe` checks
the fabric metric. This is the second room in the player that declines the
track's palette, for the reason the first one does: the colour here is a
measurement, and a measurement you can re-tint is not one.

- **AIRY.** A circular aperture: `I = [2·J₁(x)/x]²`, with J₁ from the
  Abramowitz & Stegun polynomial rather than a table. The first dark ring is at
  x = 3.8317 for *every* wavelength — which means it is at a different **angle**
  for each, blue's rings tight and red's wide, and the fringes are coloured
  without anything being coloured. Roll two sources and the room becomes
  **Rayleigh's criterion, walked**: the pair drifts together until the second
  core lands in the first one's first dark ring, which is the exact moment a
  telescope stops being able to tell them apart. You can watch the pair stop
  being two.
- **GRATING.** N slits of width a at pitch d, the exact textbook product —
  `[sin(Nβ)/(N·sinβ)]²` for the interference between slits times `sinc²(α)` for
  one slit's own diffraction. Set N = 2 and it is **Young's experiment**; wind N
  up and the orders snap into a spectrometer's sharp spectra. There is a ceiling
  on N and it is an honest one: order width goes as 1/N, so a hundred-line
  grating resolves a passband far narrower than two dozen samples across the band
  can represent, and what comes out is not a finer spectrum but an **aliased**
  one — red, green and blue dots where a rainbow should be. The first cut ran
  twenty-four slits and drew exactly that.
- **DISC.** A CD is a reflection grating with circular tracks at 1.6 µm, and this
  is the real grating equation on real geometry: incident and viewing directions
  computed from an actual lamp and an actual eye, and the order that reaches you
  is `m = d·(d̂−î)·ĝ/λ`. Which has a consequence worth watching for — **spinning
  the disc does nothing.** The tracks are circles, so the grating is rotationally
  symmetric and the pattern cannot know the disc turned; a CD's rainbow moves
  when the *lamp* moves. So here, the lamp moves. CD, DVD and Blu-ray are their
  real pitches, and the Blu-ray's 320 nm is why it throws a sheen and not a
  rainbow: `mλ ≤ 2d` means **700 nm has no first order at any angle**, which is a
  claim the unit tests check.

One concession, stated where it happens: the Airy rings past the first are 1.7 %,
0.4 %, 0.2 % of the core. Shown linearly you would see a white dot on black,
which is why every published Airy photograph is stretched. So is this one — but
the stretch is applied to **luminance only** and the chromaticity is carried
through untouched, so it is a long exposure of the real thing rather than a
repainting of it. (A per-channel gamma, which is the obvious way to do it, shifts
every hue in the frame toward whichever primary happened to be largest.)

## A wire, seen through a bad lens

Two ideas in scene 29, and the second is why it exists.

**The wire is a real curve.** Nothing is drawn with noise. **COILED COIL** is
what is actually inside an incandescent bulb and the nicest piece of engineering
most people have never looked at: the tungsten is wound into a helix, and that
helix is wound into another one, so a long hot wire packs into a small volume,
convects less, and runs hotter for the same watts. It is built here the way it is
built there — a primary helix on a torus, and a secondary helix carried on the
primary's own moving frame, because a secondary coil laid in world space wanders
off the wire. **LORENZ** is σ=10, ρ=28, β=8/3 integrated with RK4, transient
discarded before anything is drawn. **TORUS KNOT** is the exact (p, q)
parametrisation with p and q coprime — otherwise the curve closes early and draws
a smaller knot than the one on the label. **THOMAS** is the cyclically symmetric
attractor at b = 0.1998, the value at which the flow is chaotic rather than
spiralling to rest; it looks more like a dropped tangle of glowing wire than
anything else in the player, and it is a three-line differential equation.

**And the lens is honestly bad.** Every filament carries a colour fringe, and it
is the fringe a real simple lens makes. Glass has a higher index at short
wavelengths, so blue focuses shorter, so the blue image is **smaller** than the
red one — which means the sign is not a taste call: red on the far side of an
edge, blue on the near side. **Lateral** aberration grows with distance off the
optical axis and fringes the corners; **axial** aberration is each wavelength
focusing at a different *distance* and is present everywhere including dead
centre, which is why even a centred highlight on a cheap lens has a colour edge.
Both terms are here, computed rather than painted, and they are most of why the
tangle reads as something photographed instead of something drawn.

## The sheet that drains

[Soap films](#soap-films--the-rainbow-solved-not-painted) above does thin-film
interference on a **sphere**. Scene 30 does it on the thing a bubble is made of,
which behaves completely differently.

**It drains.** A vertical film is being pulled down by gravity the whole time, so
it is thin at the top and thick at the bottom and thinner everywhere as it ages.
The colour of every point is a readout of its thickness, which makes the picture
a live map of where the water has gone — and the room keeps draining while you
watch it, walking down the ladder from new film to the loud first-order colours
to the black band creeping down from the top. The label follows the film rather
than the roll, because a scene announcing NEW FILM over a black band is a scene
lying to you.

**The top goes black, and that is the whole point.** Reflection off the front
face flips phase by half a wavelength; reflection off the back does not. So as
the thickness runs to zero the two reflections arrive out of step at *every*
wavelength at once and the film stops reflecting anything — not dark, black, a
hole where a surface was. That band is real, it is called the black film, it is
about thirty nanometres thick, and its appearance means the bubble has seconds to
live. Nothing paints it: it falls out of `4·R₀·sin²(δ/2)` as δ → 0 and it could
not be removed without breaking the physics. (It also goes **blue on the way
out** — δ is larger at short wavelengths, so blue is the last colour to cancel.
The unit tests check that too.)

**The swirls are not turbulence.** They are **marginal regeneration**, which is
stranger: patches of thin film are less dense than the thick film around them, so
they **rise** — buoyantly, upward, against the drainage — dragging the colour
bands into plumes and fingers. That is why the flow in this room runs up while
the water runs down. The bands lie down because a rising plume is climbing
through a stack of horizontal iso-thickness bands and gets stretched sideways by
them, so the field is sampled at about six times the vertical frequency of the
horizontal one; sample it isotropically, as the first cut did, and you get blobs,
which is what a film looks like nowhere.

The colour is an **integral**, not a lookup — `R(λ) = 4·R₀·sin²(2πnh·cosθ/λ)` at
two dozen wavelengths through the same CIE observer the grating uses. Which is
why the high orders wash out to pearl on their own: past about a micron the
fringes are packed closer than the eye's colour channels can separate, the
integral averages them away, and nobody had to decide that. Fresnel makes the
edges silver at a glance, as a tilted film does. And eight per cent is the
brightest a soap film ever gets, so there is an exposure on top — which changes
how bright the film is and nothing at all about what colour it is.

## A country with the colour turned up

Scene 31 is the loudest room in the player and it says so. Everything else in
this wing answers to a measurement; this one answers to a poster. But the
**shape** is not invented, because the thing that makes a landscape look like a
landscape is a specific piece of arithmetic:

**Ridged multifractal.** Ordinary fBm — octaves of noise at halving amplitude and
doubling frequency — gives hills. Pleasant, wrong. Real mountains have sharp
crests and rounded valleys, and the asymmetry comes from erosion, which fBm knows
nothing about. The standard fix is one character long: take `1 − |n|` on each
octave before adding it. The absolute value folds every zero crossing into a
crease, the creases at successive scales land on each other, and out of a sum of
smooth functions you get arêtes. Weight each octave by the previous one and the
detail piles onto the crests and leaves the valleys smooth — which is where
erosion actually concentrates. Leave the fold out and you get **DUNES**; quantise
the sum and you get **MESAS**; flood it and you get an **ARCHIPELAGO**. One
pipeline, four worlds.

**The air is thick.** Distance is drawn by aerial perspective and nothing else —
extinction is exponential in depth and the light that replaces the ground is the
*sky*, so the far ridges go violet on their own rather than merely grey. Leonardo
wrote the rule down around 1500 and it is still the only one that matters for
making a picture read as deep. The world has to end somewhere, and fog alone
cannot end it — fog replaces ground with sky, which is still opaque, so the first
cut drew a crisply-edged slab of sky hanging in the star field. Fading the alpha
on a circle turns the edge into distance instead: the country runs out of air
before it runs out of ground.

**The contours are level sets**, so where they crowd the ground is steep and
where they open out it is flat — a topographic map drawn on the terrain it
describes. WebGL 1 has no `fwidth()` without an extension, so the line width is
estimated from the slope and the distance, which is exactly what makes contours
crowd and what makes a far ridge's contours fall below a pixel.

Two framing decisions, and they are the only two in this batch. The director's
rig orbits from high above the origin to well below it while always looking *at*
the origin, so a world-aligned ground plane spends a third of every set being
viewed from underneath — a flat coloured ceiling — and another third out of frame
entirely. What fixes it is putting the ground into the **rig's own frame**: hang
it fifteen units below the eye along the rig's up vector, and the horizon lands
at eye level every time while the roam reads as bank and pitch. And on an
infinite plane the horizon sits at eye level whatever your altitude, so a level
view spends the top half of the frame on empty sky — raising the camera does not
help and cannot. Pitch is the only control that does.

The colour is where the room stops being a measurement and starts being a
decision, and it says so: altitude drives a full hue circle at close to maximum
saturation, mixed back toward the track's own key so the room still belongs to
the set it is in. Nothing about a mountain is magenta. It is magenta here on
purpose.

### What this wing costs, measured

Four of these five rooms carry the `heavy` flag, and it is a measurement rather
than a guess. On the software rasteriser the smoke tests run under, SPIRAL is
the reference: DRIFT draws at about a third of its rate, which is where LAVA and
CONSTELLATIONS already live, and DISPERSION, FILAMENT, SOAP FILM and TERRAIN
draw at a fifth to a sixth — below anything shipping before this batch. So the
director's existing gate applies: on a strained device or in ECO those four
score 2 % and effectively step aside, and the two that integrate a spectrum
per pixel also stand their sample count down from 24 to 10 under
`PERF.struggling`. The flag matters because the sample-count fallback only helps
*after* the device has struggled.

The number is honest about what it is. A CPU rasteriser punishes a fragment
shader far harder than a real GPU does, and every expensive thing in this wing
is per-pixel work, so these ratios are a floor and not a forecast — which is
also why the fix here was a flag rather than a rewrite of arithmetic that is
correct.

## The bench — three ways to make a photon

Scene 19 used to light all ten sources at once. Ten lights at once is a
photograph of a bench; it is not a demonstration of anything, because the one
thing worth showing — that these are **three different pieces of physics** that
happen to both end in light — is exactly what gets lost when they are all lit
together and equally small.

So the bench **tours** by default: one source at a time, held for about eight
beats, stepping on a beat rather than mid-phrase. The card names what is lit,
how it makes light, the numbers you could measure off it, and draws **its actual
emission spectrum**:

- **INCANDESCENCE** — the seven flames. The yellow is not burning gas, it is
  solid soot heated white and radiating as a black body; the blue at the wick is
  different light entirely, excited CH· and C₂ emitting as they react. The
  spectrum is a broad Planck hump running off the red end, with the
  chemiluminescence lines standing on top of it wherever the flame is premixed.
- **ELECTROLUMINESCENCE** — the LED and the flashlight. Nothing here is hot.
  Electrons drop across a band gap and emit blue; a phosphor absorbs some of it
  and re-emits broad yellow. The spectrum is two humps with the **cyan hole**
  between them that no white LED fills — and the "6500 K" on the box is the
  colour it *matches*, not a temperature it has.
- **STIMULATED EMISSION** — the laser. Every photon emitted by a copy of the one
  that triggered it: same wavelength, same phase, same direction. One line, two
  nanometres wide, and nothing else at all.

`flameSpectrum()` is pure and the tests hold each shape to what it claims: the
laser's width, that its line lands at 532 nm, that a cool flame peaks off the
red end, and that the LED really has its cyan gap.

## The show — fired to the grid

Scene 25 is a fireworks show, and a show is not "more fireworks". It is a script.

**The one trick that matters: a shell is fired early.** A shell takes about a
second to climb before it breaks. Fire it *on* the beat and the break lands a
second late — which is precisely what makes amateur footage look wrong and why
nobody can say why. Every choreographed show in the world solves it the same
way: you know the cue, you know the lift time of the piece, so you fire at
**cue − lift**. This room can do that honestly because the beat grid is measured
at publish time and the clock reads ahead of itself — the same grid the mixer
plans seams on. The scheduler asks when the next cue is, subtracts that piece's
own lift (`pyroLead`, pure and tested), and lights the fuse then. The break is on
the beat because it was aimed there. With no grid it falls back to firing on the
onset — late by a lift, and honest about it.

**The show has an arc, and it is the track's own.** The five acts drive a real
program rather than a rate knob (`pyroProgram`, also pure): OVERTURE fires single
shells, low and far apart; RISING opens into pairs and fans; **APEX fires salvos**
— a fan of shells as one cue, so a row of breaks lands together across the sky —
on every beat rather than once a bar; TURN is the long slow willows and palms
falling; RESOLVE gets one last barrage and is then allowed to go quiet, because a
show that never stops is a sky nobody looks up at. A phrase boundary earns the
wide salvo. Cues stay grid-aligned at every rate, so a denser program is never an
off-the-music one.

Every piece is still the same three numbers the bench used — how hard the break
throws its stars, how thick the air is, how heavy they are — so a willow and a
peony are one shader and not two animations, and the stars are still real
emitters (strontium at 650 nm, barium at 515, copper at 452) through the same CIE
observer as everything else. Rings leave in a plane, palms in a few thick fronds,
crossettes split into four mid-flight, strobes blink, and a colour-change shell
carries a second salt under the first.

## Soap films — the rainbow solved, not painted

The first cut of scene 23 walked a hue around each disc with `atan(y, x)` and
called it iridescence. It isn't: that makes the colour a function of **where
on the screen** a pixel sits, so the rainbow is a decal that slides with the
camera. No shape, no depth, and colours that never move the way a real
bubble's do.

A soap bubble is a film of water a few hundred nanometres thick with air on
both sides. Light reflects off the front surface *and* the back; where the two
reflections differ by a whole wavelength they add, where they differ by a half
they cancel. Three numbers, all physical:

- **Δ = 2·n·d·cosθt** — the optical path difference, with `d` the thickness,
  `n = 1.33` for soap water, and θt the *refracted* angle inside the film
  (Snell's law from the angle you're viewing the surface at).
- **+λ/2** — the phase flip on reflection off the denser medium. It's why a
  film thinner than the light goes **black** rather than white, and leaving it
  out is the classic way to get a rainbow that never dies.
- **F(θ)** — Fresnel. At n = 1.33 only ~2 % of light comes back head-on and
  nearly all of it at grazing incidence, which is the entire reason a bubble is
  a bright ring around a clear middle.

Because θ is measured from the surface **normal**, the colour depends on the
angle between eye and film — so on a sphere it's a function of radius across
the disc, and it stays put as the camera moves. Each sprite is a **sphere
impostor**: the fragment reconstructs the normal it would have on a real ball
(`n.z = √(1−r²)`), so shading, Fresnel and interference are all evaluated
against true 3D geometry, and the film pattern is anchored in *world* space
(the normal is rotated back out of view space by `v * mat3(viewMatrix)`, since
GLSL ES 1.0 has no `transpose()`).

Everything else falls out of the same physics. **The film drains** — gravity
pulls it down, so it's thin at the crown and thick at the foot, which is why
real bubbles wear sinking horizontal bands; it drains over the bubble's life
too, so the colours march and the crown eventually thins past the black film,
at which point the bubble **pops** in an expanding ring and a new one rises.
**You see the film twice**, front wall and back, so a second dimmer
interference image sits inside the first — the ghost in every bubble
photograph. And the bands that sweep *across* a bubble's face are the
reflection of a **light** rather than of the room, so they're taken at the
half-vector `n·H` — which is also why a bubble's highlight is coloured instead
of white.

Two details that are craft rather than physics: the shells **composite**
rather than sum (a hundred added-together transparent walls stack into one
white blob — normal blending lets the far one show through the near one, and
lets the Fresnel curve carry the silhouette), and the whole film gets a broad
exposure gain, because 2 % reflectance is honest and also a black screen — a
real bubble is lit by a bright room, and that gain is the room.

## The sky over Ohio — a star viewer that talks

Scene 24 is a planetarium with an actual catalogue behind it. Every star in
it is a real star at its J2000 right ascension and declination, carrying its
Bayer letter, its proper name, its spectral class, its visual magnitude and
its distance in light years. **Twenty-two IAU constellations** are drawn as
their traditional figures, not three-line sketches: Orion gets his shield,
club and sword; **Draco winds fourteen segments** from the Little Dipper's
tail to the head diamond; Hercules gets the Keystone and both arms.

**The projection is honest.** RA and dec are converted to altitude and
azimuth for **latitude 39.96° N — Columbus, Ohio** — at a local sidereal
time rolled fresh on every visit, so what stands above the horizon is what
that sky really holds at that hour. ORION owns the winter roll, CYGNUS and
the Summer Triangle the July one, SCORPIUS never climbs more than a few
degrees because from Ohio it never does, and URSA MAJOR, CASSIOPEIA,
CEPHEUS, DRACO and URSA MINOR are always somewhere in the room because
above 40° N they never set. Stars fade out toward the horizon the way they
actually do through the thickness of the air, twelve deep-sky objects sit
where they belong (M31, M42, M45, M13, M44, the Double Cluster…), and a
dashed **altitude grid** marks the horizon and the 30° and 60° almucantars.

The music drives a four-beat cycle:

- **PAN** — the sky opens to a wide field and swings, *yaw first and then
  tilt*, so the horizon stays level. A shortest-arc slerp is the obvious
  implementation and it is the wrong one: it rolls the horizon, and a horizon
  that tilts while you turn is the single motion that makes people ill in a dome.
- **DRAW** — the figure is drawn in gold, paced off the measured beat grid,
  a spark riding the pen. Every star it reaches flares a **six-point
  diffraction cross**, casts an expanding ring, and **writes its own name
  into the sky**. The stroke is not a line — WebGL will not give you a thick
  one — but a river of additive sprites sampled along each segment, which is
  what makes it read as a brushstroke and what makes the fizzle free.
- **HOLD** — the completed figure glows and breathes on the beat.
- **FIZZLE** — the strokes come apart into particles that fan outward from
  the figure's own centre and cool from gold to starlight as they rejoin the map.

**The room frames each figure like an observatory would.** One fixed zoom
cannot serve both Lyra (five degrees across) and Draco (forty), so the field
of view is computed from the figure's own angular radius the way you would
choose an eyepiece — and opens back out while panning, so you see where in
the sky it is going before it closes in on what it found.

**And it tells you what you are looking at.** While a figure is up, the card
at the left carries the IAU name, genitive and abbreviation, what the figure
is, which quadrant it belongs to, its area and rank among the 88, and —
computed live from this roll — the compass point it stands in, its altitude
in degrees, and whether it is rising, setting or on the meridian. Each star
the pen touches adds its own line (magnitude, distance, spectral class), and
the ones with a story tell it: Algol dimming every 2.87 days, Thuban holding
the pole for the pyramid builders, δ Cephei whose pulse became the
measuring rod for the universe, 61 Cygni as the first star ever to have its
distance measured.

## The lamp — a scene where the wax is a fluid

Scene 18 is a lava lamp, and the wax in it is *solved*, not animated. The
first version of this room was a dozen discs, each with a radius and a
wobble, merged by a rule when they touched — and every recognisable failure
of it came from that one decision. A rule that fires cannot show you a neck
thinning. A disc with a shape parameter has a resonant frequency, so it
**rings**, and wax does not ring — wax creeps. So the wax is now a
**position-based fluid** (Macklin & Müller 2013), a couple of hundred
particles in the same bottle.

- **Incompressibility is a constraint, not a force.** Each particle measures
  the density around it with an SPH kernel and the solver finds the position
  correction that puts every density back to rest — two Jacobi sweeps, no
  stiffness, no timestep limit. That is what makes the wax hold a *volume*
  rather than a radius, and it is why a pool spreads on the heater and a
  droplet is round without either being written down.
- **Surface tension is a smooth pairwise force**, and the constraint only
  ever *pushes*. That combination is the whole fix for the wobble, and it is
  worth being precise about why: a position correction becomes a **velocity**
  when you divide it by the timestep, so letting the density constraint pull
  as well as push hands every particle on every free surface a velocity it
  did not earn, sixty times a second. Measured, with gravity, heat and flow
  all switched off and the fluid at rest, the first draft peaked at 1.0 in a
  bottle one unit wide. Cohesion is a force now — it can no more inject a
  spike than gravity can — and the same spline turns *repulsive* below half a
  kernel, so it does the anti-clustering job an artificial-pressure term
  would otherwise be added for.
- **Nothing decides that a merge has happened**, because nothing has to. Two
  droplets drifting together are drawn the last little way by that cohesion,
  the contact widens on its own, and the neck fills in over about a second. A
  thread that thins past a point pinches, by the same number.
- **Viscosity is XSPH** — each particle takes a share of its neighbours'
  velocity — and it is the single line that separates wax from water. At the
  coefficient this lamp runs, a droplet struck by another does not bounce,
  does not ring and does not wobble: it deforms, and then it stops.
- **Drag acts on the skin, and so does heat.** The clear fluid is not
  simulated, so its drag has to be applied somewhere — and applying it to
  every particle would make every blob rise at the same speed whatever its
  size. It is applied instead to the particles the solver has *already*
  identified: a density deficit is exactly what "near the free surface"
  means, and it costs nothing to read. A blob's skin grows as its radius and
  its mass as the area, so the big ones rise faster for the reason they
  really do. Heat enters through the same skin and then conducts inward
  between neighbours, which is why a big blob has a hot skin and a cold core
  — the real mechanism behind the plume that lifts off the pool.

The thermodynamics are unchanged and unglamorous: buoyancy is Boussinesq
(lift is temperature and nothing else), viscosity is Arrhenius (cold wax is
nine times thicker, so the fall never looks like the rise), and the column is
one Rayleigh–Bénard cell written as a **stream function**, `u = ∂ψ/∂y`,
`v = −∂ψ/∂x` — divergence-free by construction, so however hard the music
drives it the fluid cannot source, sink, or leak through the glass.

**One number is measured five times a step, so it is measured once.** Every
pass of the solver wants the same four facts about the same pair — the
offset, the kernel, the gradient over r — and the first version recomputed
all of them, square root and all, in each of five walks. They are computed
once per solver sweep now and read by everything downstream, with nothing
approximated: the cache is filled from the *same* positions the pass filling
it is solving against. That paid for a third Jacobi sweep at no cost, which
took the worst compression from 3.8% to 1.1% and peak speeds from 0.75 to
0.31 — and then paid for the particle count to nearly double.

**The picture is splatted, not evaluated.** Testing every blob against every
pixel is fine for a dozen blobs and impossible for two hundred particles —
the cost is O(pixels × N). So each particle draws its own kernel once,
additively, into a small texture, and the cost becomes O(N × sprite) +
O(pixels): N leaves the pixel loop entirely, which is what allowed the fluid
to get good. Four taps of that texture give the gradient, and everything the
old room did analytically still falls out of it — `(F−iso)/|∇F|` is the
distance to the surface in world units, so the antialiasing is still computed
against the *screen's* pixel size and stays exact at full resolution over a
deliberately coarse field; the same field gives a real surface normal and a
thickness; and the thickness makes the absorption honest Beer–Lambert, so a
thin edge is pale and a fat middle is deep, with the light that does *not*
get through coming back as the glow inside. Refraction is a real `refract()`
against that normal, split into three wavelengths, reading the coil's own
light in the liquid behind. The splat is deliberately wider than the particle
spacing: it low-pass-filters the field, so what you see is the shape of the
*fluid* rather than the arrangement of the samples standing in for it.

**What is splatted is a normalised field, not a density**, and that is the
difference between a lamp with droplets in it and a lamp with one lump. A
droplet of four particles is genuinely less dense than the middle of a pool —
its kernels have less to overlap with — so any isosurface that puts the
pool's edge in the right place makes the droplet vanish completely. Dividing
each particle's contribution by its own density (which the solver has already
measured, so it is free) turns the sum into an interpolation of the constant
1 — the classic colour function — and one threshold is then right for a
droplet and a pool alike. The beaded chain of drops pinching off a rising
column only appears on screen because of that one division.

Two more things fall out of the same texture. The **temperature is splatted
alongside the density**, in the next channel, weighted by the same kernel, so
the wax is not one colour with a hot core painted on: every pixel reads the
temperature of the wax actually in front of it, and a blob that has just left
the coil is visibly hotter where it left. And one extra tap *below* each
pixel gives the **shadow** — the only light in the object is under the
column, so a blob is between the coil and everything above it, and until that
tap existed the room read as a flat cut-out however good the blob itself
looked. Two fetches for the only depth cue a two-dimensional lamp can
honestly have.

**The music is the thermostat.** Bass and the act's own heat turn the coil
up; the column gets hotter, the wax climbs faster and breaks more readily.
Put a hand on it and the wax *flows*, and keeps flowing after you let go,
because it is matter with momentum — while the room behind the glass bends
through the same metric every other scene answers a hand with.

**The budget is one number, and it governs both halves.** The solver is O(N)
and the renderer splats N sprites, so a device that cannot afford as many
particles is given a **coarser** fluid rather than a smaller lamp: the
spacing and the kernel widen together and the same wax fills the same bottle
out of fewer, larger parcels. Nothing has a stiffness limit either — the
solver caps its own internal step so the caller can hand it anything,
including the long strides the warm-up uses, and get the same fluid out.

It is headless, pure and deterministic from a seed. `tests/player.test.mjs`
runs it for ten simulated minutes and holds it to not leaking and not
compressing; checks the 2D kernels really integrate to one on a plane; and
carries the regression test for the defect this room was rebuilt over — with
gravity, heat, flow and hands all switched off, **an undisturbed fluid has to
go quiet**, and two droplets left alone have to become one round body on
their own.

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

### Two fingers, two axes

The first finger owns the orbit and the second plants its own force, as
before — and now the **distance between them owns the camera's reach**:
spread them and the room comes closer, pinch and it recedes. Distance is an
axis neither finger can claim alone, which is why the two never fight over
the camera the way a pinch-to-zoom does when an app gets it wrong. A third
finger is nobody's: both hands are taken, and letting it seize the primary
slot used to orphan the finger that was actually holding the field. And the
hand's place on the glass is read from the canvas's own rectangle rather than
the window's — the two agree only while the canvas *is* the window, and
nothing should depend on that.

### PULL is the door the field opens at

**AUTO** — the scenes manager re-tuning the touch to whichever room it walks
into — is the more interesting idea, and it has a problem as a *default*: the
first thing anyone does with the field is put a finger on it, and whichever
personality happens to be dealt at that moment is the one they judge the whole
feature by. **PULL** is the one that reads instantly — the room falls toward
your hand, shears into orbit and detonates when you let go — so that is what
the field ships on, and AUTO is the first tap away. Every saved choice from
before, AUTO included, is honoured on load; nothing about AUTO's behaviour
changed. Only which door the room is standing at when you arrive.

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
history, never a server), **This month's crate** (the introduction, then the
latest pressings by publish date, tappable as a ready-made set), and the
**Fresh pressing** (the newest drop). All of it computes itself — the crate
reads the catalog's `published` dates the build already stamps, the hot track
reads the play history the player already keeps, and a slow month quietly widens
the window so the porch is never empty. Publish music and the porch
updates; play music and it learns.

**The crate opens on Möbius Walking**, the way the opening set and the library
walk already did. It is the calibrated piece — analysed with a measured grid, so
the beat lock, the structure reader and the colour conductor are all fully
engaged from the first bar instead of warming up on whatever happened to be
pressed most recently. It is pinned to the front rather than sorted there, so it
leads even once it has aged out of the window: being the introduction is not a
function of a publish date. The Fresh pressing badge still names the genuinely
newest track — the introduction leads the list, it does not pretend to be new.

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
  because `SHELL_CACHE` is versioned. `updateOffer()` is the rule that was missing,
  and it judges by **provenance**: a waiting worker stands on its own; a *shell*
  claim is the worker's byte-compare reporting that the deployed shell differs from
  the one this page was served, which is a fact about content and stands whether or
  not the stamp moved; a bare *claim* — a `controllerchange` nobody asked for — is
  evidence a worker took over and nothing more, so it is checked against the
  deployed shell before it earns a card. A card raised in error now withdraws itself
  instead of waiting for a reload.

  The first attempt at this rule rejected any claim whose build id matched the
  running one, which fixes the loop and **breaks the un-stamped deploy** — whose
  entire signature is *same id, different content*. The smoke test's "a fresh deploy
  raises the update badge by itself" caught it within minutes: a false positive
  traded for a false negative, which is the worse of the two.

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
**AirPlay — and why it needs the decks rebuilt.** AirPlay routes a media
element's *own* playback pipeline. Desktop decks are fed through
`createMediaElementSource` into the WebAudio graph — which is what buys the
mixer, the FX rack and the analyser — and an element in that state has no
pipeline left to route: the sound leaves through the AudioContext's
destination, into whatever the system output happens to be. Picking an Apple
TV in the picker moved silence. iOS never had the problem because iOS decks
bypass the graph entirely, which is the shape of the fix.

So the route button goes **element-direct first, then opens the picker**:
fresh elements that have never been through that one-way door, the current
track restored at its position, and `AE.graphLive` false. Everything
downstream already understands that mode because iOS has always run in it —
the mixer stands down to same-element advances, volume becomes element
volume, the rack parks at bypass, and the visuals fall back to the shipped
per-track envelope score. Coming off the route rebuilds the graph the same
way. `tools/airplay_probe.mjs` holds the rebuild to the parts that don't need
an Apple TV: same track, same place, still playing, graph genuinely gone and
genuinely back.

The button is also gated on a real receiver now. `WebKitPlaybackTargetAvailabilityEvent`
existing means the browser knows what AirPlay *is*, not that an Apple TV is
awake — the availability **event** is the only thing that knows that, and
nothing was listening, so every Safari showed a route button all night and in
an empty room it opened an empty picker. Where availability genuinely cannot
be judged the control is shown rather than guessed at. System-level routing
(Control Centre → an AirPlay speaker) is untouched and always worked: it moves
the output device underneath the app, graph and all.

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

## Stage mode in a room — getting the best show out of one laptop

Stage mode (the **Stage** chip, or hold **F** / press **⇧F**) puts the field
fullscreen on the screens the audience sees while this window stays the booth.
Every screen renders the field on its own GPU from ~40 shared numbers a frame —
no pixels are streamed between windows — so the picture is as good as the
display it lands on. What varies is how the display reaches the laptop:

- **Wired is the show.** USB-C/Thunderbolt → HDMI (or a TV's own HDMI input via
  a dock) gives full resolution at the panel's refresh rate with effectively no
  added latency, so the visuals sit *on* the beat. An Apple-silicon MacBook Pro
  drives one external display on M-base chips and two to four on Pro/Max —
  enough for a real wall from one machine. In **System Settings → Displays**
  choose *extend* (never mirror): the stage wants its own screen, and the wall
  reads the real arrangement, so dragging the monitor tiles there rearranges
  the field live.
- **Apple TV / AirPlay works — as an extended display.** On the Mac, AirPlay to
  an Apple TV and pick *Use As Extended Display* (not mirroring). macOS then
  treats it as a real monitor: the Mac app can place a stage window on it, and
  Chrome can too. The costs are AirPlay's, not the stage's: the picture is
  compressed video with roughly a hundred milliseconds of latency, which a
  music visual *shows* — motion lands audibly behind the beat — and a busy
  venue's Wi-Fi can stutter it. If AirPlay is the only route: wire the Apple TV
  to the router (or use peer-to-peer AirPlay with Wi-Fi off on neither device),
  keep it on 5 GHz, and treat it as the ambience screen rather than the main
  wall.
- **In a browser**, Chrome and Edge can put each screen fullscreen on the
  monitor you name (one permission prompt, on your own click on the Stage
  chip). Safari and Firefox open the screens as windows in a row — drag each
  onto its television and double-click the picture to fill it. The Mac app does
  the placement in every browser's stead.
- **Every scene spans the wall as one picture** — the camera-cut scenes always
  did, and the shader scenes (the fractal, the op-art rooms, the lava lamp)
  now take their slice of one composition too. **Seams** (in the folded booth)
  is the video-wall knob: it opens hidden gutters so the field passes *behind*
  the televisions' frames instead of teleporting across them — and **Which?**
  holds up each screen's number, its edges, and a ball that rolls the whole
  wall so you can judge the seams by eye, the way walls are actually tuned.
- **The machine keeps itself honest** during a set: the booth and every
  room-sized screen hold a screen wake lock, so nothing dims mid-show. Plug the
  laptop into power anyway — a fullscreen field per monitor is real GPU work —
  and close what you don't need; the booth folds itself into a corner player on
  its own.

### Any device is a screen — the wire

No cable at all: type **invite** into the Stage card (or tap **Invite** in the
folded booth) and you get four letters and a QR. Scan the QR with an iPad,
a phone, or open the site on another laptop, tap **Stage**, and type the
letters — that device is now a screen of your stage. Each one renders the
field on its **own** GPU from ~40 numbers a frame sent peer-to-peer over
your network; no pixels are streamed, so there's no AirPlay-style compression
or lag — on the same Wi-Fi the numbers arrive in a millisecond or two and the
visuals sit on the beat. Two devices become a row of two, a third re-cuts the
field to thirds, live; a device that reloads or drops Wi-Fi rejoins under the
same code by itself.

Practicalities: all devices need to reach the same network **and** each
other — venue Wi-Fi with client isolation blocks device-to-device traffic, in
which case share a hotspot that has internet and join every device to it. The
internet is needed only at the door: minting and joining a code fetches the
~600-character handshake from the family's mailbox at kmay89.com. The show
itself never touches it — once linked, the devices talk directly. A wall is
up to **16** screens wide.

### The whole crowd — every phone on the floor

The wire makes a device a *tile*; crowd mode makes it a *hand*. Type **crowd**
into the Stage card (or tap **Crowd** in the folded booth) and put the QR on
the projector: anyone who scans it gets a one-tap "Join the show" veil, and
their phone becomes the whole field — listening to the room through its **own
microphone** and dancing to what it actually hears, in this booth's palette
and scene. The speakers are the broadcast, so it scales to any crowd the room
holds: nothing fast ever crosses the network. The booth leaves only a *pulse*
at the mailbox — three colours and a scene, ~80 bytes every 2.5 seconds — and
every phone reads it through the CDN, so a thousand phones cost the mailbox
one request every couple of seconds. Phones need internet (cellular is fine —
they never talk to your laptop, only to the pulse); if the booth goes quiet,
the floor keeps dancing in colours of its own.

## Tests

```bash
python3 tests/test_pipeline.py      # 41 tests: build, dedupe, ingest-convert, name-pick, folder-is-album, orphan-sweep, gate, doctor, features, mix,
                                    #   the score's band envelopes, + the shipped catalog's
                                    #   hashes match the audio on disk
node tests/player.test.mjs          # 427 tests: solver, quantum, history, restore, planner,
                                    #   colour, safety governor, clock, dance, the CIE observer,
                                    #   diffraction limits, the black film, which transition a
                                    #   cut deserves, the tape a seamless loop is cut from,
                                    #   the true-peak limiter held to the bit, hot cues and
                                    #   the EQ, the seam's cue to the room, the pinch
                                    #   (extracted from the shipped HTML, not a copy)
node tools/master_probe.mjs         # 12 checks on the rail before the speaker: the worklet
                                    #   takes the seat, a clean mix passes untouched, a +12 dB
                                    #   mix never crosses the ceiling at AE.out, the booth's
                                    #   meter agrees with the recorder, and a hard volume
                                    #   drag leaves no step the music does not already contain
node tools/loop_probe.mjs           # 26 checks on the booth loop in a real browser, playing
                                    #   real music, with a recorder on the master: the loop
                                    #   hands over to the audio thread, the cycle is exactly the
                                    #   beats asked for, the wrap is a step the music itself
                                    #   already contains — and the playhead is written ZERO
                                    #   times, against every cycle on the path it replaces.
                                    #   Measures its own instrument first, and holds the numbers
                                    #   to that floor rather than to nothing. Plus: a cut across
                                    #   a planted tear is refused and taken from the next lap,
                                    #   a handback into a starved deck waits with the loop
                                    #   covering, and a route change re-measures the tape
node tools/booth_probe.mjs /tmp/mb8-mix      # the rack measured at its OUTPUT on a bench signal:
                                    #   filter, drive, gate, the EQ kills and FLAT; then the
                                    #   transport on the real track — loop, roll, brake, a
                                    #   four-beat jump that is four beats, a hot cue that snaps
                                    #   to the grid and jumps back ON the beat line
node tools/xform_probe.mjs          # 15 checks on the scene transition in a real browser: the
                                    #   freeze is captured and is not a black frame, the pass is
                                    #   really in the chain (not configured and then dropped),
                                    #   all eight forms compile, the outgoing room is released
                                    #   rather than drawn twice, and it stands down under
                                    #   prefers-reduced-motion, ECO and a strained governor
node tools/spectrum_probe.mjs       # the CIE 1931 observer, run on the GPU out of the shipped
                                    #   GLSL_CIE and compared against the shipped JS across 96
                                    #   wavelengths — the guard on "generated from one table,
                                    #   so they cannot drift"
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
node tools/airplay_probe.mjs        # the deck rebuild a route change runs: same track,
                                    #   same place, still playing, the WebAudio graph
                                    #   genuinely gone and genuinely back — plus the
                                    #   route button hidden when no receiver is there.
                                    #   The wireless hop itself needs an Apple TV
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
