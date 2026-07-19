#!/usr/bin/env python3
"""fingerprint.py — the heredity check: a Philips Haitsma–Kalker audio
fingerprint that yields a similarity CONTINUUM, not just a match.

Method (the README's spec, kept exactly):
  - decode to 11.025 kHz mono
  - 0.37 s frames every 23 ms, Hann-windowed
  - 33 logarithmically spaced bands from 300–2000 Hz
  - one bit per band-pair from the sign of the time–frequency energy
    difference:  bit = (E[n,m] - E[n,m+1]) - (E[n-1,m] - E[n-1,m+1]) > 0
  - each track becomes an N-frame × 32-bit hash identity matrix,
    stored as binary .fp files under dna/ (never fetched by the player)

Similarity = minimum bit-error rate over all time alignments, plus a
best-10-second-window BER that catches derivatives sharing only a stretch.
Verdicts: window BER < 0.14 = CLONE, < 0.30 = RELATED, else UNRELATED.

Honest limitation: time-stretched or pitch-shifted derivatives break frame
alignment and read as unrelated — this proves clones and shared material;
it cannot prove absence of influence.

CLI:
  fingerprint.py index [--audio DIR] [--dna DIR]     build/refresh dna/*.fp
  fingerprint.py check FILE --against DIR|--parent REF [--audio DIR] [--dna DIR]
  fingerprint.py verify --flavors docs/flavors.json  audit flavor lineage

Requires numpy. WAV decodes natively; anything else goes through ffmpeg.
"""

import argparse
import json
import struct
import subprocess
import sys
import wave
from pathlib import Path

try:
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("fingerprint.py needs numpy:  pip install numpy")

FP_SR = 11025            # Hz, mono
FRAME_S = 0.37           # seconds per frame
HOP_S = 0.023            # seconds per hop
BANDS = 33               # log bands 300–2000 Hz -> 32 bits/frame
F_LO, F_HI = 300.0, 2000.0
WINDOW_S = 10.0          # best-window length for the window BER
CLONE_BER = 0.14
RELATED_BER = 0.30
FP_MAGIC = b"MB8FP\x01"

AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus"}


# ---------------------------------------------------------------- decode

def _decode_wav(path):
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        ch = w.getnchannels()
        sw = w.getsampwidth()
        raw = w.readframes(n)
    # trailing padding/metadata bytes must not break frombuffer/reshape
    frame_bytes = max(1, sw * ch)
    raw = raw[:(len(raw) // frame_bytes) * frame_bytes]
    if sw == 2:
        x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    elif sw == 4:
        x = np.frombuffer(raw, dtype="<i4").astype(np.float64) / 2147483648.0
    elif sw == 1:
        x = (np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128.0) / 128.0
    elif sw == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        x = ((b[:, 0].astype(np.int32)) | (b[:, 1].astype(np.int32) << 8)
             | (b[:, 2].astype(np.int32) << 16))
        x = np.where(x >= 1 << 23, x - (1 << 24), x).astype(np.float64) / float(1 << 23)
    else:
        raise ValueError(f"unsupported WAV sample width {sw}")
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def _decode_ffmpeg(path, sr):
    cmd = ["ffmpeg", "-v", "error", "-i", str(path),
           "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, check=True).stdout
    except FileNotFoundError:
        raise RuntimeError(
            f"cannot decode {path.name}: ffmpeg not found (WAV decodes natively; "
            "MP3/FLAC/AAC need ffmpeg on PATH)")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed on {path.name}: {e.stderr.decode(errors='replace').strip()}")
    return np.frombuffer(out, dtype="<f4").astype(np.float64), sr


def decode_mono(path, sr=FP_SR):
    """Return (samples float64 mono at sr, sr). Dispatch is by content magic,
    not extension — a RIFF/WAVE payload decodes natively whatever it is named;
    everything else goes through ffmpeg."""
    path = Path(path)
    with open(path, "rb") as f:
        magic = f.read(4)
    if magic == b"RIFF":
        x, native_sr = _decode_wav(path)
        if native_sr != sr:
            x = resample_poly(x, native_sr, sr)
        return x, sr
    return _decode_ffmpeg(path, sr)


def resample_poly(x, sr_in, sr_out):
    """FFT-domain resampler — no scipy dependency. Exactly band-limited
    (downsampling truncates the spectrum, upsampling zero-pads it), which is
    more than a 33-band 300–2000 Hz fingerprint or a loudness meter needs."""
    if sr_in == sr_out or len(x) == 0:
        return x
    n_out = max(1, int(round(len(x) * sr_out / sr_in)))
    spec = np.fft.rfft(x)
    n_bins = n_out // 2 + 1
    if n_bins <= len(spec):
        spec = spec[:n_bins].copy()
        spec[-1] = spec[-1].real  # keep the output strictly real-spectrum-valid
    else:
        spec = np.concatenate([spec, np.zeros(n_bins - len(spec), dtype=spec.dtype)])
    return np.fft.irfft(spec, n=n_out) * (n_out / len(x))


# ---------------------------------------------------------------- fingerprint

def band_edges(sr=FP_SR, n_fft=None):
    n_fft = n_fft or int(round(FRAME_S * sr))
    freqs = np.logspace(np.log10(F_LO), np.log10(F_HI), BANDS + 1)
    bins = np.clip((freqs / (sr / 2) * (n_fft // 2)).astype(int), 1, n_fft // 2 - 1)
    # ensure strictly increasing so every band has at least one bin
    for i in range(1, len(bins)):
        if bins[i] <= bins[i - 1]:
            bins[i] = bins[i - 1] + 1
    return bins


def fingerprint(samples, sr=FP_SR):
    """Return uint32 array: one 32-bit sub-fingerprint per frame."""
    frame = int(round(FRAME_S * sr))
    hop = int(round(HOP_S * sr))
    if len(samples) < frame + hop:
        return np.zeros(0, dtype=np.uint32)
    n_frames = 1 + (len(samples) - frame) // hop
    win = np.hanning(frame)
    edges = band_edges(sr, frame)
    E = np.empty((n_frames, BANDS))
    for i in range(n_frames):
        seg = samples[i * hop:i * hop + frame] * win
        spec = np.abs(np.fft.rfft(seg)) ** 2
        for b in range(BANDS):
            E[i, b] = spec[edges[b]:edges[b + 1]].sum()
    # bit[n, m] = (E[n,m]-E[n,m+1]) - (E[n-1,m]-E[n-1,m+1]) > 0
    d = E[:, :-1] - E[:, 1:]                    # (n_frames, 32)
    dd = d[1:] - d[:-1]                         # (n_frames-1, 32)
    bits = (dd > 0).astype(np.uint32)
    weights = (1 << np.arange(31, -1, -1)).astype(np.uint32)
    return (bits * weights).sum(axis=1).astype(np.uint32)


def fingerprint_multi(samples, sr=FP_SR, n_offsets=4):
    """Fingerprints at n_offsets sub-hop sample offsets. The whole-hop shift
    search in compare() can only align to the 23 ms grid; a clone whose lead-in
    is a fractional number of hops lands between grid points and reads worse
    than it is. Comparing all sub-hop variants and keeping the best bounds the
    residual misalignment to hop/(2·n_offsets) ≈ 3 ms."""
    hop = int(round(HOP_S * sr))
    return [fingerprint(samples[(k * hop) // n_offsets:], sr)
            for k in range(n_offsets)]


def compare_best(fps_a, fp_b, **kw):
    """compare() over a list of candidate sub-hop fingerprints; keeps the
    result with the lowest window BER."""
    best = None
    for fa in fps_a:
        r = compare(fa, fp_b, **kw)
        if best is None or r["window_ber"] < best["window_ber"]:
            best = r
    return best or {"ber": 1.0, "window_ber": 1.0, "shift": 0, "verdict": "UNRELATED"}


def fingerprint_file(path):
    x, sr = decode_mono(path)
    return fingerprint(x, sr)


def fingerprint_file_multi(path, n_offsets=4):
    x, sr = decode_mono(path)
    return fingerprint_multi(x, sr, n_offsets)


# ---------------------------------------------------------------- .fp io

def save_fp(fp, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(FP_MAGIC)
        f.write(struct.pack("<I", len(fp)))
        f.write(fp.astype("<u4").tobytes())


def load_fp(path):
    with open(path, "rb") as f:
        magic = f.read(len(FP_MAGIC))
        if magic != FP_MAGIC:
            raise ValueError(f"{path}: not a Möbius⁸ fingerprint file")
        (n,) = struct.unpack("<I", f.read(4))
        return np.frombuffer(f.read(4 * n), dtype="<u4").astype(np.uint32)


# ---------------------------------------------------------------- similarity

_POPCOUNT = np.array([bin(i).count("1") for i in range(65536)], dtype=np.uint32)


def _popcount32(x):
    return _POPCOUNT[x & 0xFFFF] + _POPCOUNT[(x >> 16) & 0xFFFF]


def compare(fp_a, fp_b, max_shift_s=6.0):
    """Return dict(ber, window_ber, shift, verdict).

    ber        — minimum whole-overlap bit-error rate over all alignments
    window_ber — best (lowest) BER of any WINDOW_S-long stretch at the best
                 alignment scan, catching flavors that share only a section
    """
    if len(fp_a) == 0 or len(fp_b) == 0:
        return {"ber": 1.0, "window_ber": 1.0, "shift": 0, "verdict": "UNRELATED"}
    if len(fp_a) < len(fp_b):
        fp_a, fp_b = fp_b, fp_a
    max_shift = int(max_shift_s / HOP_S)
    win_frames = max(1, int(WINDOW_S / HOP_S))
    best_ber, best_win, best_shift = 1.0, 1.0, 0
    for shift in range(-max_shift, max_shift + 1):
        a0, b0 = (shift, 0) if shift >= 0 else (0, -shift)
        n = min(len(fp_a) - a0, len(fp_b) - b0)
        if n < win_frames // 2:
            continue
        errs = _popcount32(fp_a[a0:a0 + n] ^ fp_b[b0:b0 + n])
        ber = errs.sum() / (32.0 * n)
        if ber < best_ber:
            best_ber, best_shift = ber, shift
        if n >= win_frames:
            c = np.concatenate(([0], np.cumsum(errs)))
            wsum = c[win_frames:] - c[:-win_frames]
            wber = wsum.min() / (32.0 * win_frames)
        else:
            wber = ber
        if wber < best_win:
            best_win = wber
    verdict = ("CLONE" if best_win < CLONE_BER
               else "RELATED" if best_win < RELATED_BER
               else "UNRELATED")
    return {"ber": round(float(best_ber), 4), "window_ber": round(float(best_win), 4),
            "shift": best_shift, "verdict": verdict}


# ---------------------------------------------------------------- index

def fp_path_for(audio_path, audio_root, dna_root):
    rel = Path(audio_path).relative_to(audio_root)
    return Path(dna_root) / rel.with_suffix(rel.suffix + ".fp")


def build_index(audio_root, dna_root, verbose=True):
    """Fingerprint every audio file under audio_root into dna_root. Skips
    up-to-date .fp files; prunes .fp files whose audio vanished."""
    audio_root, dna_root = Path(audio_root), Path(dna_root)
    made = skipped = 0
    seen = set()
    for p in sorted(audio_root.rglob("*")):
        if p.suffix.lower() not in AUDIO_EXTS or not p.is_file():
            continue
        out = fp_path_for(p, audio_root, dna_root)
        seen.add(out)
        if out.exists() and out.stat().st_mtime >= p.stat().st_mtime:
            skipped += 1
            continue
        save_fp(fingerprint_file(p), out)
        made += 1
        if verbose:
            print(f"  fp  {p.relative_to(audio_root)}")
    pruned = 0
    if dna_root.exists():
        for fp in dna_root.rglob("*.fp"):
            if fp not in seen:
                fp.unlink()
                pruned += 1
    if verbose:
        print(f"index: {made} fingerprinted, {skipped} current, {pruned} pruned")
    return made, skipped, pruned


def scan_library(candidate_fps, audio_root, dna_root, skip=None):
    """Compare a candidate (list of sub-hop fingerprints, or one fingerprint)
    against every indexed track. Returns (best_match_relpath, result) for the
    lowest window BER."""
    if not isinstance(candidate_fps, (list, tuple)):
        candidate_fps = [candidate_fps]
    audio_root, dna_root = Path(audio_root), Path(dna_root)
    best = (None, {"ber": 1.0, "window_ber": 1.0, "shift": 0, "verdict": "UNRELATED"})
    for fpfile in sorted(dna_root.rglob("*.fp")):
        rel = fpfile.relative_to(dna_root)
        rel_audio = str(rel)[:-3]  # strip ".fp"
        if skip and rel_audio == skip:
            continue
        r = compare_best(candidate_fps, load_fp(fpfile))
        if r["window_ber"] < best[1]["window_ber"]:
            best = (rel_audio, r)
    return best


# ---------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_index = sub.add_parser("index", help="fingerprint the audio library into dna/")
    p_index.add_argument("--audio", default="audio")
    p_index.add_argument("--dna", default="dna")

    p_check = sub.add_parser("check", help="compare a file against the library or one parent")
    p_check.add_argument("file")
    p_check.add_argument("--parent", help="album-tag/file ref to compare against")
    p_check.add_argument("--audio", default="audio")
    p_check.add_argument("--dna", default="dna")

    p_verify = sub.add_parser("verify", help="audit every flavor against its claimed parent")
    p_verify.add_argument("--flavors", default="docs/flavors.json")
    p_verify.add_argument("--audio", default="audio")
    p_verify.add_argument("--dna", default="dna")

    a = ap.parse_args(argv)

    if a.cmd == "index":
        build_index(a.audio, a.dna)
        return 0

    if a.cmd == "check":
        cand = fingerprint_file_multi(a.file)
        if a.parent:
            pfp = Path(a.dna) / (a.parent + ".fp")
            if not pfp.exists():
                print(f"no fingerprint for parent {a.parent} — run `fingerprint.py index` first")
                return 2
            r = compare_best(cand, load_fp(pfp))
            print(f"{a.file} vs {a.parent}: {r['verdict']}  "
                  f"(BER {r['ber']}, window {r['window_ber']}, shift {r['shift']})")
            return 0
        rel, r = scan_library(cand, a.audio, a.dna)
        if rel is None:
            print("library index is empty — run `fingerprint.py index` first")
            return 2
        print(f"{a.file}: closest is {rel} — {r['verdict']}  "
              f"(BER {r['ber']}, window {r['window_ber']})")
        return 0

    if a.cmd == "verify":
        fl = Path(a.flavors)
        if not fl.exists():
            print(f"{fl} not found — nothing to verify")
            return 0
        genome = json.loads(fl.read_text())
        flavors = genome.get("flavors", [])
        bad = 0
        for f in flavors:
            parent, src = f.get("parent"), f.get("file")
            if not parent or not src:
                continue
            pfp = Path(a.dna) / (parent + ".fp")
            if not pfp.exists():
                print(f"  ? {f.get('id')}: parent {parent} has no fingerprint")
                bad += 1
                continue
            r = compare_best(fingerprint_file_multi(src), load_fp(pfp))
            ok = r["verdict"] in ("CLONE", "RELATED")
            print(f"  {'✓' if ok else '✗'} {f.get('id')}: {r['verdict']} vs {parent} "
                  f"(window BER {r['window_ber']})")
            if not ok:
                bad += 1
        print(f"verify: {len(flavors)} flavors, {bad} failing")
        return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
