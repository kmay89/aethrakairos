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
- **A visualizer with real ears** — an FFT tap on the engine's own mix bus
  feeds fourteen Metal rooms; beat phase comes from the analyzed grid (the
  truth), not onset guessing. Swipe up/down on the remote to change rooms; the
  UI melts away and the zen card whispers what's playing. The full roster:

  | | | |
  |---|---|---|
  | **MÖBIUS SPIRAL** — phi-folded 3-arm spiral | **PULSE** — the radial spectrum meter (the calm opener) | **NEBULA** — drifting value-noise clouds |
  | **TUNNEL** — phi-folded rings, bass is the speed | **OP-ART** — interfering gratings | **SCOPE** — the waveform as an oscilloscope trace |
  | **FRACTAL FIELD** — a live raymarched mandelbulb/box/tetra | **FIREWORKS** — closed-form ballistics, breaks land on the bar | **OIL FILM** — thin-film interference, bass thickens the film |
  | **MANDALA** — hard-quantized kaleidoscope | **HALO** — the equalizer bent into a torus, a beat soliton orbiting it | **TERRAIN** — a ridged-multifractal heightfield |
  | **STARBURST** — spectrum rays + onset shock rings | **LAVA LAMP** — metaball wax the music heats | | |

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
