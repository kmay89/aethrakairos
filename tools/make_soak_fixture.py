#!/usr/bin/env python3
"""Build the soak fixture: three LONG synthesized tracks pushed through the
real pipeline (WAV masters → make_catalog → 320k web MP3s, beat grids, keys,
mixable scores), deployed as a servable player copy.

The mix fixture's tracks are 20-30 s, which is right for measuring one seam
and wrong for the defect a listener actually reported: a stutter "halfway
through a song, when loading". The auto-DJ arms the next record 90 s before
the end, so on a 30 s track it arms at the first frame and the load never
overlaps a song in full flight. These run long enough that it does, and every
pair is engineered to beatmix, so a soak walks through real seams:

  north (124 · 8A) → south (125 · 9A) → west (123.5 · 8A)

Every track carries a sustained chord from its first sample to its last, so a
dropout in the output is a run of silence that cannot be the music's own.

  python3 tools/make_soak_fixture.py DEST [seconds-per-track]
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

from test_pipeline import write_wav, synth_beat_track

DEST = Path(sys.argv[1] if len(sys.argv) > 1 else "soak-fixture").resolve()
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 130.0
shutil.rmtree(DEST, ignore_errors=True)
(DEST / "masters").mkdir(parents=True)

A_MINOR = [0, 3, 7]        # A C E  → Camelot 8A
E_MINOR = [7, 10, 14]      # E G B  → Camelot 9A (adjacent)
# WAV masters, so the pipeline's own ffmpeg step makes the 320k MP3s the
# deployed site serves — the decoder and the byte rate are the real ones
# (each one distinct in tempo or phase: the synth is deterministic, and two
# byte-identical masters are one catalog entry — the pipeline dedupes by hash)
for album, name, bpm, off, pcs in (("Soak North", "01-north.wav", 124.0, 0.5, A_MINOR),
                                   ("Soak South", "01-south.wav", 125.0, 0.5, E_MINOR),
                                   ("Soak West",  "01-west.wav",  123.5, 0.6, A_MINOR)):
    write_wav(DEST / "masters" / album / name,
              synth_beat_track(bpm, dur=DUR, offset=off, key_pcs=pcs))

subprocess.run([sys.executable, str(ROOT / "make_catalog.py"), "masters",
                "--base", "audio", "--artist", "Aethra Kairos",
                "--label", "ERRERlabs"], cwd=DEST, check=True)

for f in (ROOT / "docs").iterdir():
    if f.is_file():
        shutil.copyfile(f, DEST / f.name)
shutil.copytree(ROOT / "docs" / "icons", DEST / "icons", dirs_exist_ok=True)
shutil.copyfile(DEST / "docs" / "catalog.json", DEST / "catalog.json")
shutil.copytree(DEST / "docs" / "audio", DEST / "audio", dirs_exist_ok=True)
idx = (DEST / "index.html").read_text()
idx = idx.replace("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
                  "three.min.js")
idx = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>', "", idx)
(DEST / "index.html").write_text(idx)
print(f"{DEST}: soak fixture ready ({DUR:.0f} s per track)")
