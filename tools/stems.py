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

v2 adds the DRUM CHART (`mix.stems.hits`): every kick, snare and hat onset,
detected on the separated drum stem while this job still holds it — the one
moment true per-hit timing exists, since a 12 Hz envelope cannot place a hit
inside its own 83 ms step. Three delta-coded strings (see hits_encode), about
a kilobyte a track, and both stages strike the light on the real hit, known
in advance (docs/index.html @stem, tvOS StemLight).

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
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

# this script lives in tools/, but fingerprint.py (the audio decoder it uses to
# read Demucs's output) sits at the repo root — put the root on sys.path so the
# lazy `from fingerprint import decode_mono` in separate() resolves no matter the
# CWD the script is launched from (running `python3 tools/stems.py` otherwise
# puts only tools/ on the path, and every separation silently misses).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CATALOG_PATH = Path("docs/catalog.json")
AUDIO_ROOT = Path("docs/audio")
STEMS_VERSION = 2            # v2: + hits (the drum chart: kick / snare / hat onsets)
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


# ---------------------------------------------------------------- the drum chart
#
# Onsets on the SEPARATED drum stem, one band per voice. A band's onset curve
# is its log-power rise over the previous two frames (half-wave rectified, so
# a ringing tail never re-triggers), picked where it clears a local median by
# a fixed margin, is a local maximum, respects the voice's refractory gap,
# and lands loud enough against the band's own loud hits (so a breakdown's
# bleed is never charted). Then the classic confusions are resolved: a kick's
# beater click rises in the snare band, and a snare's wires rise in the hat
# band — a coincident candidate is kept only when its OWN band rose harder.

HIT_FPS = 100                 # 10 ms frames: the chart's resolution
HIT_NFFT = 2048
HIT_BANDS = {                 # Hz, per voice
    "k": (30.0, 150.0),       # kick: the body
    "s": (180.0, 4000.0),     # snare: shell and crack
    "h": (6000.0, 16000.0),   # hats and cymbals: the sizzle
}
HIT_GAP = {"k": 0.09, "s": 0.09, "h": 0.05}        # s — refractory
HIT_RISE = 0.30               # log10 power over the local median (~3 dB)
HIT_FLOOR = 2.5               # log10 below the band's loud hits (~25 dB) is bleed
HIT_MEDIAN = 51               # frames — the local median's window (~0.5 s)


def _band_curves(mono, sr):
    """Per-voice log-power curves at HIT_FPS from a centred, Hann STFT."""
    x = np.asarray(mono, dtype=np.float64)
    hop = max(1, int(round(sr / HIT_FPS)))
    pad = HIT_NFFT // 2
    x = np.pad(x, (pad, pad))
    n = 1 + max(0, (len(x) - HIT_NFFT) // hop)
    if n < 8:
        return None
    win = np.hanning(HIT_NFFT)
    freqs = np.fft.rfftfreq(HIT_NFFT, 1.0 / sr)
    masks = {k: (freqs >= lo) & (freqs < hi) for k, (lo, hi) in HIT_BANDS.items()}
    curves = {k: np.empty(n) for k in HIT_BANDS}
    step = 2048                                    # frames per FFT batch — memory stays flat
    for a in range(0, n, step):
        b = min(n, a + step)
        idx = (np.arange(a, b) * hop)[:, None] + np.arange(HIT_NFFT)[None, :]
        spec = np.abs(np.fft.rfft(x[idx] * win, axis=1)) ** 2
        for k, m in masks.items():
            curves[k][a:b] = np.log10(spec[:, m].sum(axis=1) + 1e-10)
    return curves


def _onsets(e, gap_frames):
    """Pick one band's onsets: (frame indices, strengths)."""
    n = len(e)
    prev = np.maximum(np.concatenate(([e[0]], e[:-1])), np.concatenate(([e[0], e[0]], e[:-2])))
    flux = np.maximum(0.0, e - prev)
    w = HIT_MEDIAN
    padded = np.pad(flux, (w // 2, w // 2), mode="edge")
    med = np.median(np.lib.stride_tricks.sliding_window_view(padded, w), axis=1)[:n]
    loud = np.percentile(e, 97)
    peak_lvl = np.maximum.reduce([e, np.roll(e, -1), np.roll(e, -2)])
    ok = (flux > med + HIT_RISE) & (peak_lvl > loud - HIT_FLOOR)
    ok[max(0, n - 4):] = False                     # the file's own end is a cut, not a hit
    picks, strengths = [], []
    last = -10 ** 9
    for t in np.flatnonzero(ok):
        lo, hi = max(0, t - 2), min(n, t + 3)
        if flux[t] < flux[lo:hi].max():
            continue                               # not the local maximum
        if t - last < gap_frames:
            if picks and flux[t] > strengths[-1]:  # a stronger re-strike inside the gap wins
                picks[-1], strengths[-1], last = t, flux[t], t
            continue
        picks.append(t); strengths.append(flux[t]); last = t
    return np.asarray(picks, dtype=int), np.asarray(strengths)


HIT_BLEED = 0.7              # log10: a coincident candidate within ~7 dB of its band's loud hits is its own


def _level_at(e, t):
    return e[t:t + 3].max()


def drum_hits(mono, sr):
    """{k, s, h: sorted onset times in seconds} from the separated drum stem,
    or None when the stem is too short to read."""
    if mono is None:
        return None
    curves = _band_curves(mono, sr)
    if curves is None:
        return None
    raw = {k: _onsets(curves[k], max(1, int(round(HIT_GAP[k] * HIT_FPS)))) for k in HIT_BANDS}

    def near(frames, t, w=3):
        if len(frames) == 0:
            return False
        i = np.searchsorted(frames, t)
        return any(0 <= j < len(frames) and abs(frames[j] - t) <= w for j in (i - 1, i))

    out = {}
    # the beater's click is not a snare, a snare's body is not a kick, and the
    # wires' sizzle is not a hat: a candidate that coincides with another
    # voice's onset is kept only when its own band is LOUD there — a log rise
    # from a quiet floor is scale-free, so bleed rises as steeply as a hit;
    # what it never reaches is the band's own level when that voice plays
    # "loud" is the band's own LOUD HITS (p90 of its candidates' peaks), not
    # its whole curve — a curve is mostly decay, and would set the bar at bleed
    loud = {k: (np.percentile([_level_at(curves[k], t) for t in raw[k][0]], 90)
                if len(raw[k][0]) else np.inf) for k in HIT_BANDS}
    def own(k, t):
        return _level_at(curves[k], t) > loud[k] - HIT_BLEED
    keep = {}
    for k in HIT_BANDS:
        others = [raw[o][0] for o in HIT_BANDS if o != k]
        keep[k] = [t for t in raw[k][0] if not any(near(f, t) for f in others) or own(k, t)]
    for k, frames in keep.items():
        out[k] = [round(int(f) / HIT_FPS, 2) for f in frames]
    return out


B36 = "0123456789abcdefghijklmnopqrstuvwxyz"
HIT_SKIP = 36 * 36 - 1        # "zz": advance 12.95 s with no hit


def hits_encode(times):
    """Seconds → the chart string: each hit is its gap from the previous one
    in centiseconds, two base-36 digits; a gap past 12.94 s spends "zz"s
    (each advancing 12.95 s, no hit) before its remainder. ~2 bytes a hit."""
    out, prev = [], 0
    for t in times:
        cs = int(round(t * 100))
        d = max(0, cs - prev)
        while d >= HIT_SKIP:
            out.append("zz"); d -= HIT_SKIP
        out.append(B36[d // 36] + B36[d % 36])
        prev = cs
    return "".join(out)


def hits_decode(code):
    """The inverse: chart string → seconds (the clients' hitsDecode)."""
    times, cs = [], 0
    for i in range(0, len(code) - 1, 2):
        a, b = B36.find(code[i]), B36.find(code[i + 1])
        if a < 0 or b < 0:
            break
        d = a * 36 + b
        cs += d
        if d != HIT_SKIP:
            times.append(cs / 100.0)
    return times


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
    hits = drum_hits(stem_monos.get("d"), sr) if stem_monos.get("d") is not None else None
    if hits is not None:
        out["hits"] = {k: hits_encode(v) for k, v in hits.items()}
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
        stem_dirs = [d for d in model_dir.iterdir() if d.is_dir()] if model_dir.is_dir() else []
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


def _track_key(album, tr):
    """A stable identifier for a track across catalog revisions — album tag +
    file. Lets a batch's freshly computed stems be re-applied to a newer
    catalog by IDENTITY, never by line position, so overlapping CI runs merge
    into a clean union instead of colliding on git's line-level diff."""
    tag, file = album.get("tag"), tr.get("file")
    if not tag or not file:
        return None
    return f"{tag}/{file}"


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
    banked = {}                                      # track_key -> stems block, for sidecar re-apply
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
        key = _track_key(album, tr)
        if key:
            banked[key] = block
        done += 1
    return done, skip, miss, banked


def reapply(catalog, banked, force=False):
    """Merge a batch's computed stems (from a sidecar) into THIS catalog by
    track identity. Used after a CI push loses the race and resets onto the
    latest main: the freshly pulled catalog may already carry some of these
    tracks (from the run that won the race) — those are left untouched — while
    ours that are still missing get added. The result is the union of both
    runs' work, re-serialized whole, so there is no line-level conflict to
    resolve. Returns how many tracks this actually added."""
    added = 0
    for album, tr in _iter_tracks(catalog):
        mix = tr.get("mix")
        if not isinstance(mix, dict):
            continue
        key = _track_key(album, tr)
        block = banked.get(key) if key else None
        if block is None:
            continue
        st = mix.get("stems")
        if not force and isinstance(st, dict) and st.get("sv") == STEMS_VERSION:
            continue                                 # already banked upstream — keep theirs
        mix["stems"] = block
        added += 1
    return added


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
    # reapply merges a sidecar into a newer catalog by identity: a track the
    # winning run already banked keeps THEIRS; ours that are still missing get
    # added — the union, never a clobber.
    upstream = {"sv": STEMS_VERSION, "hz": ENV_HZ, "d": "9" * 48}
    catalog = {"albums": [{"tag": "A", "tracks": [
        {"file": "won.mp3", "mix": {"stems": upstream}},   # already banked upstream
        {"file": "ours.mp3", "mix": {}},                    # ours, still missing
        {"file": "nostems.mp3"},                            # no mix at all — untouched
    ]}]}
    sidecar = {"A/won.mp3": block, "A/ours.mp3": block}
    added = reapply(catalog, sidecar)
    tracks = catalog["albums"][0]["tracks"]
    assert added == 1, f"only the missing track is added, got {added}"
    assert tracks[0]["mix"]["stems"] is upstream, "the winning run's stems are kept"
    assert tracks[1]["mix"]["stems"] == block, "our missing track gets banked"
    assert "mix" not in tracks[2], "a track without mix is never fabricated"
    # THE DRUM CHART, on a synthetic kit: four-on-the-floor kicks (a falling
    # sine), snares on 2 and 4 (a tone plus noise), hats on the eighths
    # (high-passed noise), 8 s of groove then 4 s of silence then 4 more.
    rng = np.random.default_rng(7)
    dur, bpm = 16.0, 120.0
    kit = np.zeros(int(sr * dur))
    def put(sig, at):
        i = int(at * sr); kit[i:i + len(sig)] += sig[:len(kit) - i]
    tk = np.arange(int(0.25 * sr)) / sr
    kick = 0.9 * np.sin(2 * np.pi * (50 * tk + 70 * (1 - np.exp(-tk * 30)) / 30 * 1)) * np.exp(-tk * 18)
    ts = np.arange(int(0.18 * sr)) / sr
    snare = (0.35 * np.sin(2 * np.pi * 190 * ts) + 0.45 * rng.standard_normal(len(ts))) * np.exp(-ts * 25)
    th = np.arange(int(0.05 * sr)) / sr
    hn = rng.standard_normal(len(th) + 4)
    hat = 0.12 * np.diff(hn, 4) * np.exp(-th * 90)        # 4th difference: a steep high-pass
    beat = 60.0 / bpm
    want = {"k": [], "s": [], "h": []}
    for seg0, seg1 in ((0.5, 8.5), (12.5, 16.0)):
        b = seg0
        n_beat = 0
        while b < seg1 - 0.3:
            put(kick, b); want["k"].append(b)
            if n_beat % 2 == 1:
                put(snare, b); want["s"].append(b)
            for half in (0.0, beat / 2):
                put(hat, b + half); want["h"].append(b + half)
            b += beat; n_beat += 1
    kit += 1e-4 * rng.standard_normal(len(kit))          # the floor every real stem has
    got = drum_hits(kit, sr)
    assert got is not None
    for k in "ksh":
        w, g = np.asarray(want[k]), np.asarray(got[k])
        hit = sum(1 for x in w if len(g) and np.min(np.abs(g - x)) <= 0.03)
        prec = sum(1 for x in g if len(w) and np.min(np.abs(w - x)) <= 0.03) / max(1, len(g))
        rec = hit / max(1, len(w))
        assert rec >= 0.9 and prec >= 0.9, f"{k}: recall {rec:.2f}, precision {prec:.2f} ({len(g)} vs {len(w)})"
    assert not any(8.8 < t < 12.4 for k in "ksh" for t in got[k]), "silence charts nothing"
    pad = 0.5 * np.sin(2 * np.pi * 220 * np.arange(sr * 4) / sr) + 1e-4 * rng.standard_normal(sr * 4)
    assert sum(len(v) for v in drum_hits(pad, sr).values()) <= 1, "a held pad is not a drum"
    # the chart string round-trips, long gaps included
    times = [0.0, 0.01, 0.5, 13.0, 40.27, 40.28, 200.0]
    assert hits_decode(hits_encode(times)) == times, hits_decode(hits_encode(times))
    assert hits_decode("") == [] and hits_encode([]) == ""
    block2 = reduce_stems({"d": kit, "b": loud[:len(kit)], "v": None, "o": None}, sr)
    assert "hits" in block2 and set(block2["hits"]) == {"k", "s", "h"}
    print(f"selftest OK — stem envelopes match the catalog's digit shape; the drum chart reads "
          f"{len(got['k'])} kicks, {len(got['s'])} snares, {len(got['h'])} hats on the synthetic kit")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="add per-stem energy envelopes (mix.stems) to the catalog via Demucs")
    ap.add_argument("--check", action="store_true", help="report coverage, do not separate or write")
    ap.add_argument("--selftest", action="store_true", help="verify the envelope reduction (no Demucs needed)")
    ap.add_argument("--force", action="store_true", help="re-separate tracks that already have stems")
    ap.add_argument("--limit", type=int, default=None, help="separate at most N tracks this run")
    ap.add_argument("--catalog", default=str(CATALOG_PATH))
    ap.add_argument("--sidecar", default=None,
                    help="also write this run's banked stems to this JSON path (for conflict-free re-apply)")
    ap.add_argument("--reapply", default=None, metavar="SIDECAR",
                    help="don't separate; merge a sidecar's stems into the catalog by track identity")
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
    if a.reapply:
        banked = json.loads(Path(a.reapply).read_text(encoding="utf-8"))
        added = reapply(catalog, banked, force=a.force)
        print(f"stems: re-applied {added} track(s) from {a.reapply} onto {path}")
        if added:
            path.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"wrote {path}")
        else:
            print("no changes")
        return 0
    done, skip, miss, banked = enrich(catalog, limit=a.limit, force=a.force)
    print(f"stems: separated {done}, skipped {skip} (already current), missed {miss} (no audio / failed)")
    if done:
        path.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {path}")
        if a.sidecar:                                # persist for a post-race re-apply
            Path(a.sidecar).write_text(json.dumps(banked, ensure_ascii=False), encoding="utf-8")
            print(f"wrote sidecar {a.sidecar} ({len(banked)} tracks)")
    else:
        print("no changes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
