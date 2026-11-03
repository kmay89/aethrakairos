#!/usr/bin/env python3
"""Build the mix-engine acceptance fixture: real synthesized tracks pushed
through the REAL pipeline (make_catalog → beat grids, keys, mixable scores),
deployed as a servable player copy. The pairs are engineered so every
planner verdict occurs in queue order:

  alpha (124 · 8A) → beta (126 · 9A)   beatmix (adjacent key → 16 beats)
  beta  → gamma (152)                  fade — tempo gap
  gamma → delta (beatless pad)         fade — the piano rule
  delta → e1                           fade — delta has no grid
  e1 → e2 (same album, sequential)     gapless — the artist's intent
  alpha (124 · 8A) → tau (126 · E minor) beatmix WITH RUNWAY — the cued deck

The last pair exists for the pre-rolled cue (MIXER._cueRoll, seamCuePoint).
Every other incoming record here enters on a downbeat half a second in, the
lead-in takes all of that, and a cue correctly declines on every seam — so
until tau, no fixture could drive that path end to end. tau is a record with
a DJ's intro: hats and its chord from the top, the kick only from bar five.

Its runway comes the way a real catalog gets one, not by editing a number.
The pipeline's mix-in is the lattice's FIRST downbeat — the beat tracker
counts the grid from the top, through any intro — so tau's own mix-in sits
half a second in like everybody else's. What moves an entry later is a pair
fix: the mix tuner's offset, saved, exported as mixfix.json and graduated to
canon by make_catalog (catalog.mixfix). The fixture ships exactly that file —
alpha→tau enters sixteen beats in, on tau's first kick — so the planner sees
a beatmix whose incoming record has about seven seconds of material before
its entry, through the same code a published fix takes.

tau is APPENDED: its album sorts after every other one, so make_catalog seats
it last and every probe that reads the crate by position (booth_probe,
handover_probe) or builds its own queue by title (mix_acceptance,
xfader_probe, deck_probe, vinyl_probe) sees exactly the rows it always did.
Only the crate's row count moves, and mix_acceptance counts the catalog
rather than a literal. The fix is keyed alpha|tau and touches no other pair.

  python3 tools/make_mix_fixture.py DEST
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

import numpy as np
from test_pipeline import write_wav, synth_beat_track

DEST = Path(sys.argv[1] if len(sys.argv) > 1 else "mix-fixture").resolve()
shutil.rmtree(DEST, ignore_errors=True)
(DEST / "masters").mkdir(parents=True)

# pitch classes are semitones above A3 (the synth's 220 Hz reference):
A_MINOR = [0, 3, 7]        # A C E  → Camelot 8A
E_MINOR = [7, 10, 14]      # E G B  → Camelot 9A (adjacent)
def put(album, name, samples):
    write_wav(DEST / "masters" / album / name, samples)

put("Deck Alpha", "01-alpha.mp3", synth_beat_track(124.0, dur=30.0, key_pcs=A_MINOR))
put("Deck Beta",  "01-beta.mp3",  synth_beat_track(126.0, dur=30.0, key_pcs=E_MINOR))
put("Deck Gamma", "01-gamma.mp3", synth_beat_track(152.0, dur=25.0, key_pcs=A_MINOR))
t = np.arange(int(22 * 44100)) / 44100
pad = 0.3 * np.sin(2 * np.pi * 220 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t))
put("Deck Delta", "01-delta.mp3", pad)
put("Album E", "01-e-one.mp3", synth_beat_track(124.0, dur=20.0, key_pcs=A_MINOR))
put("Album E", "02-e-two.mp3", synth_beat_track(124.0, dur=20.0, key_pcs=A_MINOR, offset=0.7))


def synth_intro_track(bpm, dur, intro_beats, key_pcs, offset=0.5, sr=44100):
    """synth_beat_track's record with a DJ's intro: the hat on every beat and
    the chord from the top — so the beat tracker has real onsets to count the
    grid by, all the way through — and the kick only from beat `intro_beats`
    (a downbeat, so the bass that names the downbeat agrees with the grid)."""
    n = int(dur * sr)
    t = np.arange(n) / sr
    x = np.zeros(n)
    spb = 60.0 / bpm
    beat, tt = 0, offset
    while tt < dur - 0.1:
        i0 = int(tt * sr)
        ln = min(int(0.1 * sr), n - i0)
        env = np.exp(-np.arange(ln) / (0.012 * sr))
        if beat >= intro_beats:
            x[i0:i0 + ln] += (1.0 if beat % 4 == 0 else 0.55) * env * np.sin(
                2 * np.pi * 70 * np.arange(ln) / sr)
        x[i0:i0 + ln // 4] += 0.2 * env[:ln // 4] * np.random.default_rng(beat).standard_normal(ln // 4)
        tt += spb
        beat += 1
    for pc in key_pcs:
        f0 = 220.0 * 2 ** (pc / 12)
        x += 0.12 * np.sin(2 * np.pi * f0 * t)
        x += 0.05 * np.sin(2 * np.pi * f0 * 2 * t)
    return 0.85 * x / (np.abs(x).max() + 1e-9)


TAU_INTRO = 16                      # beats of intro before tau's first kick: four bars
put("Deck Tau", "01-tau.mp3", synth_intro_track(126.0, dur=34.0, intro_beats=TAU_INTRO, key_pcs=E_MINOR))

# the canon pair fix that gives alpha→tau its runway (see the docstring): the
# entry moves TAU_INTRO beats on from tau's first downbeat, onto its first kick.
# Keyed by the masters' sha256, as make_catalog keys every track.
import hashlib
import json
def sha(p):
    return hashlib.sha256((DEST / "masters" / p).read_bytes()).hexdigest()
(DEST / "mixfix.json").write_text(json.dumps({"grids": {}, "pairs": {
    sha("Deck Alpha/01-alpha.mp3") + "|" + sha("Deck Tau/01-tau.mp3"):
        {"type": "beatmix", "beats": 8, "offsetBeats": TAU_INTRO}}}, indent=1))

# the real pipeline, exactly as publish.sh runs it
subprocess.run([sys.executable, str(ROOT / "make_catalog.py"), "masters",
                "--base", "audio", "--artist", "Aethra Kairos",
                "--label", "ERRERlabs"], cwd=DEST, check=True)

# deployable player copy (same localizations as the synthetic deploy)
for f in (ROOT / "docs").iterdir():
    if f.is_file():
        shutil.copyfile(f, DEST / f.name)
shutil.copytree(ROOT / "docs" / "icons", DEST / "icons", dirs_exist_ok=True)
shutil.copyfile(DEST / "docs" / "catalog.json", DEST / "catalog.json")
# the build writes the public tree under docs/ (same-origin hosting); this
# fixture serves from its root, so the audio tree must sit beside the catalog
shutil.copytree(DEST / "docs" / "audio", DEST / "audio", dirs_exist_ok=True)
idx = (DEST / "index.html").read_text()
idx = idx.replace("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
                  "three.min.js")
import re
idx = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>', "", idx)
(DEST / "index.html").write_text(idx)
print(f"{DEST}: mix fixture ready (copy three.min.js in before serving)")
