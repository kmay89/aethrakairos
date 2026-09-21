# Aethra Kairos for Apple TV

The native tvOS app: the whole catalog on the biggest screen in the house,
DJ'd by the same journey logic as the web player, drawn by a Metal visualizer
that listens to the actual audio graph. **tvOS has no web view — there is no
wrapper to hide in** — so unlike the Mac app (a shell around `docs/index.html`)
this is a from-scratch native embodiment of the same product: same catalog,
same journeys, same physics of taste, told in Swift.

DESIGN.md §1.2l dreamed the stage: *a television that draws the field while
the booth keeps the controls.* This app is that television grown a brain of
its own — it holds the booth's ears (an FFT tap on its own output), the
booth's hands (the Siri Remote), and the booth's taste (the journey solver),
because on a TV the player and the screen are finally the same machine.

```
AethraKairos.xcodeproj      the Xcode project — open this
AethraKairosTV/
  App/                      @main, appearance, scene lifecycle
  Model/                    catalog.json v2 parsing · fetch/cache · hearts/history/resume
  Audio/                    AVAudioEngine two-deck graph · downloads+sha256 · FFT analyzer
  Journey/                  the journey solver and rituals, ported
  Art/                      generative covers, drawn from each track's own numbers
  Visualizer/               MTKView + Metal rooms, driven by the analyzer
  UI/                       the 10-foot shelves, the zen HUD, Siri Remote grammar
  Assets.xcassets           layered app icon · top shelf · launch (generated, see below)
  Info.plist
scripts/make_icons.py       derives every brand asset from docs/icons/icon-512.png
TESTFLIGHT.md               the ordered runbook: the token, TestFlight, the App Store
```

## Run it

```sh
open tvos/AethraKairos.xcodeproj
```

Pick an **Apple TV 4K** simulator, **⌘R**. No account or signing needed for
the simulator; for a real Apple TV or TestFlight, `TESTFLIGHT.md` is the
complete, no-guessing runbook.

## What it does

- **Streams the real catalog** — fetches `aethrakairos.com/catalog.json`
  (schema v2, refused if not), streams from the same media host as the web
  player, verifies each download against the catalog's own `sha256`, and
  keeps an LRU cache so the last night's music survives the router.
- **Journeys, natively** — the same feature-space solver (bpm, energy,
  brightness, entropy, onsets, timbre) shapes a set from here to there;
  rituals are one click on the top shelf row.
- **Beat-aware transitions** — two decks on one `AVAudioEngine`, crossfades
  scheduled against each track's analyzed grid (`mix.in`/`mix.out`), track
  `gain` applied so the night stays level.
- **Lit by the music, not themed** — the web player's colour engine, whole:
  the track's key maps around the Camelot wheel to a root hue, its character
  picks one of six chords spelled in just-intonation intervals (spectrum only
  when it's earned), every blend glides through OKLCH so nothing passes
  through mud, the story arc warms and cools the whole chord as one rotation,
  and a WCAG flash governor is the last hand on the light.
- **A visualizer with real ears** — an FFT tap on the engine's own mix bus
  feeds seventy Metal rooms — one for every scene the web player has, 1:1 by
  key (the parity law in `CONTRIBUTING.md`); beat phase comes from the analyzed grid (the
  truth), not onset guessing. Swipe up/down on the remote to change rooms; the
  UI melts away and the zen card whispers what's playing. The full roster:

  | | | |
  |---|---|---|
  | **MÖBIUS SPIRAL** — phi-folded 3-arm spiral | **PULSE** — the radial spectrum meter (the calm opener) | **NEBULA** — drifting value-noise clouds |
  | **TUNNEL** — phi-folded rings, bass is the speed | **OP-ART** — interfering gratings | **SCOPE** — the waveform as an oscilloscope trace |
  | **FRACTAL FIELD** — a live raymarched mandelbulb/box/tetra | **FIREWORKS** — closed-form ballistics, breaks land on the bar | **OIL FILM** — thin-film interference, bass thickens the film |
  | **MANDALA** — hard-quantized kaleidoscope | **HALO** — the equalizer bent into a torus, a beat soliton orbiting it | **TERRAIN** — a ridged-multifractal heightfield |
  | **STARBURST** — spectrum rays + onset shock rings | **LAVA LAMP** — metaball wax the music heats | **EIGENSTATE** — an analytic quantum superposition |
  | **AUREA** — golden-angle phyllotaxis | **FILIGREE** — escape-time Mandelbrot, orbit-trap gold lace | **ROSETTE** — a chromatic spirograph |
  | **PARLOR** — the illusion machine, lying harder as it builds | **DISPERSION** — real CIE-spectral diffraction | **CREATURE** — a cosine organism whose genome is the track |
  | **SLINKY** — stacked chalk rings, the room that rests the palette | **ARCADE** — a television inside the screen, games played by the spectrum | **CONSTELLATIONS** — a real star sky, the lines drawn on the beat |
  | **EXCITABLE** — spiral & target waves of an excitable medium | **VERSE** — dots that assemble the song's own words, then scatter | **ARABESQUE** — the girih star lattice, pulled through a horizon |
  | **MAELSTROM** — a ray-marched storm sea, Stokes crests and honest foam | **VOLTAGE** — dielectric breakdown at glow width, struck by every onset | **SILICON** — a Truchet circuit board thinking on the music's clock |
  | **FEIGENBAUM** — the bifurcation diagram, iterated per pixel, the music on the fader | **CHLADNI** — sand on a ringing plate, the spectrum picking the mode | **AUTOMATON** — Rule 90's rain as live binomial parity, stepping on the song |
  | **EVENT HORIZON** — photon geodesics: the shadow, the ring, the beamed disk | **FERROFLUID** — the Rosensweig crown leaping on the kick, glossy black | **GALTON** — beads through pins, the bell curve earned by the count |
  | **PENDULA** — three double pendulums integrated live, fraying apart | **ATTRACTOR** — Lorenz and Rössler as neon ribbons with flowing pulses | **FIREFLIES** — Kuramoto synchrony locking the meadow to the beat |
  | **THREE BODY** — the figure-eight choreography, shaken by the onsets | **DENDRITE** — frost grown over the song's own five acts | **MURMURATION** — a flock as living density, shimmer as turn, a falcon on the drop |
  | **FOURIER** — an epicycle chain, arm lengths straight off the spectrum | **INTERFERENCE** — two-source fringes crawling at the beat frequency | **JULIA** — z²+c iterated live, c dancing along the Mandelbrot boundary |
  | **POINCARÉ** — the hyperbolic disc tiled by fold and inversion | **QUASICRYSTAL** — five-to-sevenfold plane waves blooming as rosettes | **PHYLLOTAXIS** — the golden-angle flower, found by inverting the spiral |
  | **SANDPILE** — the four-ink pile, avalanche fronts running on the onsets | **π–e HELIX** — the two constants as intertwined strands, bass and treble each wearing one | **MÖBIUS BAND** — one-sided surface, the mids riding its twist |
  | **RIBBONS** — airy silk sheets flowing on entropy | **COMETS** — velocity made visible, heads on the beat | **FERN** — the Barnsley fern, grown patient and organic |
  | **FLAME** — the vigil: a warm flame held steady | **CUBE SHEETS** — the collider's percussive lattice of planes | **BUBBLES** — glass and air, treble caught in thin films |
  | **DRIFT** — motion illusions in a still room | **FILAMENT** — a current looking for something to carry | **SOAP FILM** — a draining film's interference colours |
  | **LINDENMAYER** — the branching fold, wind in the deepest twigs | **HILBERT** — the plane-filling curve as pipework, music commuting along it | **KOCH** — the coastline paradox: shore, snowflake, antiflake |
  | **DRAGON** — the paper that remembers every fold, evaluated not stored | **CANTOR** — the middle third removed forever: bars, staircase, dust | **TONNETZ** — Euler's map of harmony, lit by real chroma |
  | **HARMONOGRAPH** — two pendulums drawing the just intervals | **OVERTONES** — the monochord: one string, sixteen partials, read at the series' own addresses | **EUCLID** — the world's rhythms as maximally even necklaces |
  | **PHASE** — Reich's phasing: two clocks, 3% apart, locking on schedule | | |

- **The wire — a stage screen for a live set** — the Apple TV joins a DJ
  booth's four-letter room code and renders the field locally from the booth's
  live feature feed (a first-party WebSocket — never streamed pixels, never any
  sound of its own). It holds the last good frame when the booth goes quiet
  rather than freezing. The relay contract is in [STAGE.md](./STAGE.md).

- **A lens over every room** — an artistic post-process — mirrors, wave, prism,
  iris, tile, moire — auto-picked by the act and the energy and held so it never
  flickers. It bends the field without inventing colour, and it's off by default
  on the calm rooms and under Reduce Motion.
- **The Journey Console, on the ten-foot screen** — the brightness-by-energy
  library map, the heat and length dials, and the three faces (Journey · Quantum
  · Memories), all driving the same bit-exact solver, operable with nothing but
  the Siri Remote.

- **It performs, not just reacts** — a five-act story arc
  (OVERTURE · RISING · APEX · TURN · RESOLVE) read from each track's own
  structure drives a mood-based auto-director and an INK "white budget" (a
  drop may blow out; a verse may not). Rooms cross through an edge-free
  transition vocabulary — luma · scatter · defocus · prism · ember, never the
  same one twice — and every colour is the track's own key (a rainbow has to
  be earned by the music's entropy, never wallpaper).
- **Ghost mode** — a screen nobody is touching is exactly what a TV is, so
  after ~22 s of stillness a phantom hand works the field itself in phrases,
  softer than a real hand; the first press on the remote reclaims it.
- **The booth on the shelf** — a settings shelf carries the mix styles
  (adaptive / musical / club), key lock, calm mode (WCAG 2.3.1 flash
  governor, tightened), and auto/manual rooms; the now-playing header shows
  the live room and the current act.
- **First-class TV citizenship** — Now Playing metadata + generative artwork
  on the TV and every iPhone remote; play/pause on the remote does what it
  says; the layered icon parallaxes; the top shelf carries the field.
- **Remembers, locally, like everything else here** — hearts (toggle with a
  long-press on the remote), history, and where you were, in on-device
  storage sized for tvOS's small persistent quota. No login. No server. Ever.

## Regenerating the brand assets

The asset catalog is committed, so building never requires this. To re-derive
after the mark changes:

```sh
python3 -m pip install Pillow
python3 tvos/scripts/make_icons.py
```
