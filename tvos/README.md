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
  feeds Metal rooms; beat phase comes from the analyzed grid (the truth), not
  onset guessing. Swipe up/down on the remote to change rooms; the UI melts
  away and the zen card whispers what's playing.
- **First-class TV citizenship** — Now Playing metadata + generative artwork
  on the TV and every iPhone remote; play/pause on the remote does what it
  says; the layered icon parallaxes; the top shelf carries the field.
- **Remembers, locally, like everything else here** — hearts, history, and
  where you were, in on-device storage sized for tvOS's small persistent
  quota. No login. No server. Ever.

## Regenerating the brand assets

The asset catalog is committed, so building never requires this. To re-derive
after the mark changes:

```sh
python3 -m pip install Pillow
python3 tvos/scripts/make_icons.py
```
