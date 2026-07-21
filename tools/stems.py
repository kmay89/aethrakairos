#!/usr/bin/env python3
"""stems.py — add each track's per-STEM energy envelopes to the catalog.

For every track it writes a `mix.stems` block: four compact loudness envelopes,
one per source — drums, bass, vocals, other — obtained by running Demucs
(htdemucs) offline and reducing each separated stem to the SAME 12 Hz,
p95-normalized, single-digit envelope the catalog already ships for the
band-energy score (`env`). A 4-minute track is a few KB raw and gzips to a few
hundred bytes per stem, so the whole set costs almost nothing on the wire.

Why offline: true source separation is a neural model (hundreds of MB, GPU-happy)
— impossible in the browser and pointless to run per playback. The catalog is
the right place: separate once in CI, ship the tiny envelopes, and let the
player read them precompute-first (client `trackStems()`), falling back to the
spectral band split when a track hasn't been separated yet.

What the envelopes unlock, without shipping any stem AUDIO (which would be
multiple GB across the library and is deliberately out of scope):
  • per-stem COLOURED waveforms in the booth — drums/bass/vocals/other, not a
    blunt low/mid/high split that can't tell a hi-hat from a voice;
  • VOCAL-CLASH-aware transitions — the mixer can see where a voice sits and
    avoid blending two of them over each other;
  • DRUM-anchored cue points — mix where the beat actually is.

Purely ADDITIVE: existing fields are never touched. Skips tracks that already
carry a current-version `mix.stems` (so CI re-runs are cheap and incremental);
--force re-does them.

Usage:
  python3 tools/stems.py                 # separate + enrich docs/catalog.json in place
  python3 tools/stems.py --limit 5       # only the first 5 tracks that still need it
  python3 tools/stems.py --check         # report coverage, don't separate or write
  python3 tools/stems.py --selftest      # verify the envelope reduction (no Demucs/torch needed)
  python3 tools/stems.py --force         # re-separate even tracks that already have stems

Requires numpy always; Demucs + ffmpeg only when actually separating audio
(i.e. NOT for --selftest / --check).
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

CATALOG_PATH = Path("docs/catalog.json")
AUDIO_ROOT = Path("docs/audio")
STEMS_VERSION = 1
ENV_HZ = 12.0                 # match the band-energy score's rate
DEMUCS_MODEL = "htdemucs"     # 4-stem: drums / bass / other / vocals
# catalog key ↔ Demucs stem filename
STEM_FILES = {"d": "drums", "b": "bass", "v": "vocals", "o": "other"}


def stem_env(mono, sr, hz=ENV_HZ):
    """Reduce one stem's mono samples to a 12 Hz loudness envelope digit-string,
    p95-normalized and clipped to 0..9 — the EXACT shape features.band_env emits
    for the spectral score, so the player samples stems and bands the same way.
    Returns None if the stem is too short to make a meaningful envelope."""
    mono = np.asarray(mono, dtype=float)
    step = max(1, int(round(sr / hz)))
    n = len(mono) // step
    if n < 2:
        return None
    frames = mono[:n * step].reshape(n, step)
    steps = np.sqrt(np.maximum((frames * frames).mean(axis=1), 0.0))   # per-window RMS
    ref = np.percentile(steps, 95) + 1e-12
    return "".join(str(v) for v in np.clip(steps / ref * 9.49, 0, 9).astype(int))


def reduce_stems(stem_monos, sr):
    """stem_monos: {catalog_key: mono ndarray}. Returns the `mix.stems` block, or
    None if nothing reduced cleanly."""
    out = {"sv": STEMS_VERSION, "hz": ENV_HZ}
    any_ok = False
    for key in STEM_FILES:
        env = stem_env(stem_monos.get(key), sr) if stem_monos.get(key) is not None else None
        if env is not None:
            out[key] = env
            any_ok = True
    return out if any_ok else None


def separate(path, sr=44100):
    """Run Demucs on one file and return {catalog_key: mono ndarray at sr}.
    Demucs (torch) and the WAV decoder are imported lazily so --selftest/--check
    never need them."""
    from fingerprint import decode_mono   # WAV-native decode; ffmpeg for the rest
    with tempfile.TemporaryDirectory() as td:
        out = Path(td)
        # -o out writes out/<model>/<trackname>/{drums,bass,other,vocals}.wav
        subprocess.run(
            [sys.executable, "-m", "demucs", "-n", DEMUCS_MODEL, "-o", str(out), str(path)],
            check=True)
        # Demucs may sanitize the track name when it names the output folder, so
        # don't assume it equals Path(path).stem — only one file was separated
        # into this temp dir, so take the single subdir that appeared.
        model_dir = out / DEMUCS_MODEL
        stem_dirs = [d for d in model_dir.iterdir() if d.is_dir()] if model_dir.exists() else []
        if not stem_dirs:
            raise RuntimeError(f"Demucs produced no output under {model_dir}")
        stem_dir = stem_dirs[0]
        monos = {}
        for key, name in STEM_FILES.items():
            wav = stem_dir / f"{name}.wav"
            if wav.exists():
                mono, msr = decode_mono(str(wav), sr=sr)
                monos[key] = mono
        return monos, sr


def _iter_tracks(catalog):
    for album in catalog.get("albums", []):
        for tr in album.get("tracks", []):
            yield album, tr


def _audio_path(album, tr):
    tag, file = album.get("tag"), tr.get("file")
    if not tag or not file:
        return None
    return AUDIO_ROOT / tag / file


def _needs(tr, force):
    mix = tr.get("mix")
    if not isinstance(mix, dict):
        return False
    if force:
        return True
    st = mix.get("stems")
    return not (isinstance(st, dict) and st.get("sv") == STEMS_VERSION)


def enrich(catalog, limit=None, force=False):
    done = skip = miss = 0
    for album, tr in _iter_tracks(catalog):
        if limit is not None and done >= limit:
            break                                    # stop scanning once the batch is full
        if not _needs(tr, force):
            skip += 1
            continue
        path = _audio_path(album, tr)
        if not path or not path.exists():
            miss += 1
            continue
        print(f"  separating {path} …", flush=True)
        try:
            monos, sr = separate(path)
        except Exception as e:                       # a bad decode must not kill the batch
            print(f"    ! {type(e).__name__}: {e}", file=sys.stderr)
            miss += 1
            continue
        block = reduce_stems(monos, sr)
        if block is None:
            miss += 1
            continue
        tr["mix"]["stems"] = block
        done += 1
    return done, skip, miss


def coverage(catalog):
    have = total = 0
    for _, tr in _iter_tracks(catalog):
        mix = tr.get("mix")
        if not isinstance(mix, dict):
            continue
        total += 1
        st = mix.get("stems")
        if isinstance(st, dict) and st.get("sv") == STEMS_VERSION:
            have += 1
    return have, total


def selftest():
    """The reduction must (a) match the catalog's digit-envelope shape, (b) put a
    loud stem's energy high and a near-silent stem's low, and (c) degrade to None
    on too-little data — all without Demucs or torch."""
    sr = 44100
    t = np.arange(sr * 4) / sr                         # 4 s
    loud = 0.8 * np.sin(2 * np.pi * 110 * t)           # a steady, loud bassline
    quiet = 1e-3 * np.sin(2 * np.pi * 440 * t)         # a near-silent "other"
    e_loud = stem_env(loud, sr)
    e_quiet = stem_env(quiet, sr)
    assert e_loud and set(e_loud) <= set("0123456789"), "envelope is a digit-string"
    assert len(e_loud) == int(4 * ENV_HZ), f"~12 Hz over 4 s → 48 steps, got {len(e_loud)}"
    # a steady tone p95-normalizes to a flat, near-full envelope
    assert np.mean([int(c) for c in e_loud]) > 6, "a loud steady stem reads high"
    # a bursting stem: loud first half, silent second → high digits then zeros
    burst = np.concatenate([loud[:sr * 2], quiet[:sr * 2]])
    e_burst = stem_env(burst, sr)
    first = np.mean([int(c) for c in e_burst[:len(e_burst) // 2]])
    last = np.mean([int(c) for c in e_burst[len(e_burst) // 2:]])
    assert first > last + 3, f"the burst's energy lands in the first half ({first} vs {last})"
    # reduce_stems assembles the block and versions it
    block = reduce_stems({"d": loud, "b": loud, "v": quiet, "o": quiet}, sr)
    assert block and block["sv"] == STEMS_VERSION and block["hz"] == ENV_HZ
    assert all(k in block for k in ("d", "b", "v", "o")), "all four stems present"
    # too little data → None, and an all-missing set → None
    assert stem_env([0.0, 0.1], sr) is None, "tiny → None"
    assert reduce_stems({"d": None, "b": None, "v": None, "o": None}, sr) is None
    print("selftest OK — stem envelopes match the catalog's digit shape")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="add per-stem energy envelopes (mix.stems) to the catalog via Demucs")
    ap.add_argument("--check", action="store_true", help="report coverage, do not separate or write")
    ap.add_argument("--selftest", action="store_true", help="verify the envelope reduction (no Demucs needed)")
    ap.add_argument("--force", action="store_true", help="re-separate tracks that already have stems")
    ap.add_argument("--limit", type=int, default=None, help="separate at most N tracks this run")
    ap.add_argument("--catalog", default=str(CATALOG_PATH))
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    path = Path(a.catalog)
    catalog = json.loads(path.read_text(encoding="utf-8"))
    if a.check:
        have, total = coverage(catalog)
        pct = (100.0 * have / total) if total else 0.0
        print(f"stems: {have}/{total} tracks have current-version envelopes ({pct:.0f}%)")
        return 0
    done, skip, miss = enrich(catalog, limit=a.limit, force=a.force)
    print(f"stems: separated {done}, skipped {skip} (already current), missed {miss} (no audio / failed)")
    if done:
        path.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {path}")
    else:
        print("no changes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
