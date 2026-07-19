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
