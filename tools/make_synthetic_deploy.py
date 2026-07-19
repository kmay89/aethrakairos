#!/usr/bin/env python3
"""Build a synthetic 1,000-track deployment for the §10.10 acceptance run:
a copy of docs/ plus a generated catalog.json v2 and hardlinked tiny audio
files, servable from any static HTTP server.

  python3 tools/make_synthetic_deploy.py DEST [N_TRACKS]
"""
import hashlib
import json
import math
import os
import shutil
import struct
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = Path(sys.argv[1] if len(sys.argv) > 1 else "synthetic-deploy")
N = int(sys.argv[2]) if len(sys.argv) > 2 else 1000

shutil.rmtree(DEST, ignore_errors=True)
shutil.copytree(ROOT / "docs", DEST)

# The sandbox black-holes public CDNs (fonts, cdnjs). This deploy measures
# OUR boot cost, so third-party fetches are localized: three.js is expected
# at ./three.min.js (copy it in before serving) and the Google Fonts link is
# dropped. The shipped docs/index.html keeps both — noted in the handoff.
idx = DEST / "index.html"
s = idx.read_text()
s = s.replace("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
              "three.min.js")
s = s.replace('<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,'
              'wght@0,500;0,700;1,500;1,600&family=IBM+Plex+Mono:wght@400;500;600'
              '&display=swap" rel="stylesheet">',
              "<!-- fonts localized out for the offline acceptance run -->")
idx.write_text(s)

# one tiny real WAV, hardlinked under every track name (players sniff content)
seed_wav = DEST / "_seed.wav"
sr = 22050
with wave.open(str(seed_wav), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    frames = bytearray()
    for i in range(sr // 2):
        v = int(12000 * math.sin(2 * math.pi * 220 * i / sr) * (1 - i / (sr / 2)))
        frames += struct.pack("<h", v)
    w.writeframes(bytes(frames))

rng_state = 123456789
def rng():
    global rng_state
    rng_state = (1103515245 * rng_state + 12345) % (1 << 31)
    return rng_state / (1 << 31)

albums = []
track_no = 0
n_albums = max(1, N // 12)
for a in range(n_albums):
    tag = f"synthetic-album-{a+1:03d}"
    tracks = []
    per = N // n_albums + (1 if a < N % n_albums else 0)
    for k in range(per):
        track_no += 1
        fname = f"{k+1:02d}-track-{track_no:04d}.mp3"
        d = DEST / "audio" / tag
        d.mkdir(parents=True, exist_ok=True)
        try:
            os.link(seed_wav, d / fname)
        except OSError:  # cross-device or no-hardlink filesystems
            shutil.copyfile(seed_wav, d / fname)
        t = track_no / N
        dur = round(150 + rng() * 210, 1)
        bpm = 0 if track_no % 9 == 0 else round(118 + t * 16 + rng() * 4, 2)
        camelot = f"{1 + track_no % 12}{'A' if track_no % 2 else 'B'}"
        mix = {"v": 1, "mixable": 0.15, "key": camelot} if not bpm else {
            "v": 1, "bpm": bpm, "grid": round(0.3 + rng() * 0.4, 3),
            "key": camelot, "keyConf": 0.7, "phrases": 32,
            "in": {"start": 0.5, "beats": 64},
            "out": {"start": round(dur - 64 * 60 / bpm, 3), "beats": 64},
            "mixable": round(0.6 + rng() * 0.4, 2),
        }
        tracks.append({
            "title": f"Synthetic {track_no:04d}",
            "file": fname,
            "duration": dur,
            "sha256": hashlib.sha256(f"synthetic-{track_no}".encode()).hexdigest(),
            "published": "2026-07-18",
            "mix": mix,
            "features": {
                "bpm": 0 if track_no % 9 == 0 else round(80 + t * 90 + rng() * 8, 1),
                # loosely positively correlated, like real extraction — the
                # quiet-and-dark corner must exist or bedtime has nowhere to land
                "energy": round(min(1, max(0, t + (rng() - 0.5) * 0.3)), 3),
                "brightness": round(min(1, max(0, t * 0.5 + rng() * 0.5)), 3),
                "entropy": round(0.2 + rng() * 0.6, 3),
                "onsets": round(rng(), 3),
            },
        })
    albums.append({
        "title": f"Synthetic Album {a+1}", "tag": tag,
        "year": 2018 + a % 9, "genre": "Ambient Techno",
        "info": "Synthetic acceptance material — every value generated.",
        "tracks": tracks,
    })

catalog = {
    "version": 2, "label": "ERRERlabs", "artist": "Aethra Kairos",
    "license": {"code": "../LICENSE-CODE", "audio": "../LICENSE-AUDIO"},
    "base": "audio",
    "albums": albums,
}
(DEST / "catalog.json").write_text(json.dumps(catalog))
seed_wav.unlink()
size = (DEST / "catalog.json").stat().st_size
print(f"{DEST}: {N} tracks, {len(albums)} albums, catalog.json {size/1024:.0f} KB")
