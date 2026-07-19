#!/usr/bin/env python3
"""features.py — the Python fallback feature extractor for the Möbius⁸ catalog.

Definitions mirror the wizard's calibrated meters and the player's DSP engine:

  lufs       ITU-R BS.1770-4 integrated loudness. The K-weighting biquads are
             the wizard's exact 48 kHz coefficients, so audio is resampled to
             48 kHz for this measurement only.
  dynamics   a loudness-range-like spread: p95 − p10 of the 400 ms / 100 ms
             K-weighted block loudnesses that survive the −70 LUFS gate.
  centroid   power-weighted spectral centroid in Hz (the DSP engine's
             definition: power-weighted, band edges from the real sample rate).
  entropy    power-weighted normalized spectral entropy, 0–1 (H / log2 N).
  onset_rate SuperFlux-lite onsets per second: log-magnitude flux half-wave
             rectified against a ±1-bin max filter of the previous frame,
             thresholded at 1.6× a running median (median, not mean+σ —
             flux is heavy-tailed).
  bpm        autocorrelation of a 100 Hz onset envelope, smallest strong local
             maximum (the fundamental, not a subharmonic), parabolic
             refinement, folded into 70–180. 0 when the material is unpitched
             or beatless — the solver treats 0 as a wildcard.

These are the RAW measures. make_catalog.py computes the catalog-wide 0–1
normalization (energy from lufs+dynamics, brightness from centroid, onsets
from onset_rate) and re-emits it every build so the space stays calibrated
as the library grows. Raw measures are what features-cache.json stores,
keyed by content SHA-256 — recomputing is never needed for a known hash.

Requires numpy. WAV decodes natively; anything else goes through ffmpeg.
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("features.py needs numpy:  pip install numpy")

from fingerprint import decode_mono, resample_poly

try:  # optional ~100× speedup for the sample-loop IIR; numpy-only path remains
    from scipy.signal import lfilter as _lfilter
except ImportError:  # pragma: no cover
    _lfilter = None

FFT = 2048
HOP = 512
ONSET_ENV_HZ = 100.0
BPM_LO, BPM_HI = 70.0, 180.0

FEATURES_VERSION = 2      # bump when any definition changes: invalidates cache


# ------------------------------------------------------- BS.1770-4 loudness

def _biquad(x, b0, b1, b2, a1, a2):
    if _lfilter is not None:
        return _lfilter([b0, b1, b2], [1.0, a1, a2], x)
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        yi = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def _k_weight_48k(x):
    """The wizard's exact 48 kHz K-weighting chain (shelf then high-pass)."""
    s1 = _biquad(x, 1.53512485958697, -2.69169618940638, 1.19839281085285,
                 -1.69065929318241, 0.73248077421585)
    return _biquad(s1, 1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621)


def loudness_blocks(mono, sr):
    """Gated 400 ms block loudnesses (LUFS) at 48 kHz, per BS.1770-4."""
    if sr != 48000:
        mono = resample_poly(mono, sr, 48000)
        sr = 48000
    f = _k_weight_48k(mono)
    bl, hop = int(sr * 0.4), int(sr * 0.1)
    if len(f) < bl:
        return np.array([])
    sq = f * f
    c = np.concatenate(([0.0], np.cumsum(sq)))
    starts = np.arange(0, len(f) - bl + 1, hop)
    z = (c[starts + bl] - c[starts]) / bl
    lb = -0.691 + 10 * np.log10(z + 1e-15)
    return lb[lb > -70.0]


def integrated_lufs(mono, sr):
    lb = loudness_blocks(mono, sr)
    if len(lb) == 0:
        return float("-inf"), 0.0
    z = 10 ** ((lb + 0.691) / 10)
    rel_thr = -0.691 + 10 * np.log10(z.mean()) - 10
    kept = lb[lb > rel_thr]
    if len(kept) == 0:
        return float("-inf"), 0.0
    zk = 10 ** ((kept + 0.691) / 10)
    lufs = -0.691 + 10 * np.log10(zk.mean())
    dyn = float(np.percentile(lb, 95) - np.percentile(lb, 10))
    return float(lufs), dyn


# ------------------------------------------------------- spectral features

def stft_power(mono, sr):
    if len(mono) < FFT:
        mono = np.pad(mono, (0, FFT - len(mono)))
    n_frames = 1 + (len(mono) - FFT) // HOP
    win = np.hanning(FFT)
    frames = np.lib.stride_tricks.as_strided(
        mono, shape=(n_frames, FFT),
        strides=(mono.strides[0] * HOP, mono.strides[0])).copy()
    spec = np.abs(np.fft.rfft(frames * win, axis=1)) ** 2
    freqs = np.fft.rfftfreq(FFT, 1.0 / sr)
    return spec, freqs


def spectral_stats(spec, freqs):
    """Power-weighted centroid (Hz) and normalized entropy (0–1),
    averaged over frames that carry signal."""
    power = spec.sum(axis=1)
    gate = power > max(1e-12, np.percentile(power, 20) * 0.1)
    if not gate.any():
        return 0.0, 0.0
    s = spec[gate]
    cent = (s * freqs).sum(axis=1) / (s.sum(axis=1) + 1e-30)
    p = s / (s.sum(axis=1, keepdims=True) + 1e-30)
    H = -(p * np.log2(p + 1e-30)).sum(axis=1) / np.log2(s.shape[1])
    return float(cent.mean()), float(H.mean())


def onset_curve(spec, sr):
    """SuperFlux-lite onset strength per STFT frame + boolean onset flags."""
    logm = np.log1p(1e4 * np.sqrt(spec))
    # ±1-bin max filter of the PREVIOUS frame kills vibrato false hits
    prev = logm[:-1]
    prev_max = np.maximum(prev, np.maximum(
        np.pad(prev[:, 1:], ((0, 0), (0, 1)), mode="edge"),
        np.pad(prev[:, :-1], ((0, 0), (1, 0)), mode="edge")))
    flux = np.maximum(0.0, logm[1:] - prev_max).sum(axis=1)
    if len(flux) == 0:
        return np.array([]), np.array([], dtype=bool)
    # running median threshold (heavy-tailed distribution → median, not mean+σ)
    k = max(1, int(round(1.0 * sr / HOP)))  # ~1 s window
    med = np.empty_like(flux)
    for i in range(len(flux)):
        lo, hi = max(0, i - k), min(len(flux), i + k + 1)
        med[i] = np.median(flux[lo:hi])
    hits = flux > np.maximum(1.6 * med, 1e-9)
    # debounce 0.12 s
    min_gap = max(1, int(round(0.12 * sr / HOP)))
    onsets = np.zeros_like(hits)
    last = -min_gap
    for i in np.flatnonzero(hits):
        if i - last >= min_gap:
            onsets[i] = True
            last = i
    return flux, onsets


def estimate_bpm(flux, onsets, sr):
    """Autocorrelate a 100 Hz onset envelope; smallest strong local maximum,
    parabolic refinement, octave fold into 70–180. Returns 0.0 for beatless."""
    if len(flux) == 0 or onsets.sum() < 8:
        return 0.0
    frame_hz = sr / HOP
    t_env = np.arange(int(len(flux) * ONSET_ENV_HZ / frame_hz)) / ONSET_ENV_HZ
    idx = np.minimum((t_env * frame_hz).astype(int), len(flux) - 1)
    env = flux[idx]
    env = env - env.mean()
    if np.abs(env).sum() < 1e-9:
        return 0.0
    lag_min = int(ONSET_ENV_HZ * 60.0 / 200.0)     # 200 bpm
    lag_max = int(ONSET_ENV_HZ * 60.0 / 50.0)      # 50 bpm
    if len(env) < lag_max * 3:
        return 0.0
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    ac = ac / (ac[0] + 1e-30)
    seg = ac[lag_min:lag_max + 1]
    if len(seg) < 3:
        return 0.0
    # local maxima, strong = above 0.25 and above 60% of global max in range
    strong = []
    thresh = max(0.25, 0.6 * seg.max())
    for i in range(1, len(seg) - 1):
        if seg[i] >= seg[i - 1] and seg[i] >= seg[i + 1] and seg[i] >= thresh:
            strong.append(i)
    if not strong:
        return 0.0
    i = strong[0] + lag_min                        # smallest lag = fundamental
    # parabolic interpolation around the peak
    if 1 <= i < len(ac) - 1:
        a, b, c = ac[i - 1], ac[i], ac[i + 1]
        denom = a - 2 * b + c
        i = i + (0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0)
    bpm = 60.0 * ONSET_ENV_HZ / i
    while bpm < BPM_LO:
        bpm *= 2
    while bpm > BPM_HI:
        bpm /= 2
    return round(float(bpm), 1)


# ------------------------------------------------------- mix analysis
# The mix engine's substrate: a beat grid (Ellis dynamic-programming beat
# tracker over the same SuperFlux onset envelope the features use), a
# downbeat, a Camelot key (chromagram → Krumhansl–Schmuckler), 16-bar
# mixable in/out regions aligned to downbeats, and a `mixable` confidence
# that tells the player when NOT to beatmix (the piano rule).

MIX_VERSION = 1

# Krumhansl–Kessler key profiles (major, minor)
_KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                      2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                      2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
# Camelot wheel: index = pitch class of the tonic. B = major, A = minor.
_CAMELOT_MAJOR = {0: '8B', 1: '3B', 2: '10B', 3: '5B', 4: '12B', 5: '7B',
                  6: '2B', 7: '9B', 8: '4B', 9: '11B', 10: '6B', 11: '1B'}
_CAMELOT_MINOR = {0: '5A', 1: '12A', 2: '7A', 3: '2A', 4: '9A', 5: '4A',
                  6: '11A', 7: '6A', 8: '1A', 9: '8A', 10: '3A', 11: '10A'}


def detect_key(spec, freqs):
    """Camelot code + confidence from a power chromagram."""
    lo, hi = 55.0, 4000.0
    mask = (freqs >= lo) & (freqs <= hi)
    f = freqs[mask]
    pc = (np.round(12 * np.log2(f / 440.0)) + 69).astype(int) % 12
    energy = spec[:, mask].sum(axis=0)
    chroma = np.zeros(12)
    for k in range(12):
        chroma[k] = energy[pc == k].sum()
    if chroma.sum() <= 0:
        return None, 0.0
    chroma = chroma / (np.linalg.norm(chroma) + 1e-12)
    best, best_r, second = None, -2.0, -2.0
    for tonic in range(12):
        for profile, table in ((_KK_MAJOR, _CAMELOT_MAJOR), (_KK_MINOR, _CAMELOT_MINOR)):
            p = np.roll(profile, tonic)
            p = p / np.linalg.norm(p)
            r = float(np.dot(chroma, p))
            if r > best_r:
                second = best_r
                best_r, best = r, table[tonic]
            elif r > second:
                second = r
    conf = max(0.0, min(1.0, (best_r - second) * 10))
    return best, round(conf, 2)


def beat_track(flux, sr, hop=HOP):
    """Ellis (2007) dynamic-programming beat tracker.
    Returns (beat_frame_indices, bpm) or (None, 0)."""
    if len(flux) < 32:
        return None, 0.0
    fps = sr / hop
    env = flux / (flux.std() + 1e-9)
    # global tempo estimate: autocorrelation of the envelope, 60–200 BPM
    ac = np.correlate(env - env.mean(), env - env.mean(), mode='full')[len(env) - 1:]
    lag_min, lag_max = int(fps * 60 / 200), int(fps * 60 / 60)
    if lag_max >= len(ac):
        return None, 0.0
    seg = ac[lag_min:lag_max + 1]
    # prefer the fundamental: weight against long lags' harmonics mildly
    lags = np.arange(lag_min, lag_max + 1)
    weight = np.exp(-0.5 * ((np.log2(lags / (fps * 60 / 120))) / 1.0) ** 2)
    period = lags[int(np.argmax(seg * weight))]
    alpha = 400.0                      # transition-cost weight (Ellis's tightness)
    window = np.arange(int(-2 * period), -int(period / 2))
    txcost = -alpha * (np.log(-window / period) ** 2)
    D = np.copy(env)
    P = np.zeros(len(env), dtype=int)
    for i in range(int(period / 2), len(env)):
        idx = i + window
        ok = idx >= 0
        if not ok.any():
            continue
        scores = txcost[ok] + D[idx[ok]]
        j = int(np.argmax(scores))
        D[i] = env[i] + scores[j]
        P[i] = idx[ok][j]
    # backtrack from the best late score
    tail = D[-int(period):]
    i = len(D) - int(period) + int(np.argmax(tail))
    beats = [i]
    while P[i] > 0:
        i = P[i]
        beats.append(i)
    beats = np.array(beats[::-1])
    if len(beats) < 8:
        return None, 0.0
    # snap each beat to its local onset peak — the DP prefers the climb, the
    # ear hears the hit
    snapped = np.array([max(0, b - 4) + int(np.argmax(flux[max(0, b - 4):b + 5]))
                        for b in beats])
    ibi = np.diff(snapped) / fps
    bpm = 60.0 / np.median(ibi)
    return snapped, round(float(bpm), 2)


# Constant analysis latency of the STFT/flux front end, measured against
# synthetic ground-truth grids (stable within ±0.3 ms across tempo, phase
# and offset). Beat times are frame indices / fps + this.
GRID_LATENCY = 0.0505


def extract_mix(mono, sr, spec=None, freqs=None, flux=None):
    """The catalog `mix` block for one decoded track (None = not mixable)."""
    if spec is None:
        spec, freqs = stft_power(mono, sr)
    if flux is None:
        flux, _ = onset_curve(spec, sr)
    dur = len(mono) / sr
    beats, bpm = beat_track(flux, sr)
    key, key_conf = detect_key(spec, freqs)
    if beats is None or bpm <= 0:
        return {"v": MIX_VERSION, "mixable": 0.0, "key": key}
    fps = sr / HOP
    beat_times = beats / fps + GRID_LATENCY
    ibi = np.diff(beat_times)
    cv = float(np.std(ibi) / (np.mean(ibi) + 1e-9))       # grid stability
    # onset support: fraction of beats landing on a real onset peak
    support = float(np.mean(flux[np.clip(beats, 0, len(flux) - 1)]
                            > np.median(flux) * 1.1))
    # downbeat = the beat phase (mod 4) carrying the most low-end energy.
    # The beat frame marks the onset RISE; the kick's low-frequency body
    # develops over the following frames, so score a short window after
    # each beat on LINEAR bass power (log-flux flattens accents).
    bass_bins = freqs < 150
    bass = spec[:, bass_bins].sum(axis=1)
    def beat_bass(b):
        return bass[b:b + 7].mean() if b + 7 <= len(bass) else bass[b:].mean()
    phase_score = np.zeros(4)
    for ph in range(4):
        sel = beats[ph::4]
        if len(sel):
            phase_score[ph] = float(np.mean([beat_bass(b) for b in sel]))
    down = int(np.argmax(phase_score))
    grid = float(beat_times[down])
    mixable = max(0.0, min(1.0, np.exp(-8 * cv) * support))
    spb = 60.0 / bpm
    n_beats = int((dur - grid) / spb)
    region = min(64, max(8, (n_beats // 2) // 4 * 4))     # ≤16 bars, bar-aligned
    out_start = grid + max(0, ((n_beats - region) // 4) * 4) * spb
    return {
        "v": MIX_VERSION,
        "bpm": round(bpm, 2),
        "grid": round(grid, 3),
        "key": key, "keyConf": key_conf,
        "phrases": 32,
        "in": {"start": round(grid, 3), "beats": int(region)},
        "out": {"start": round(out_start, 3), "beats": int(region)},
        "mixable": round(mixable, 2),
    }


# ------------------------------------------------------- top level

def extract(path):
    """Raw feature dict for one audio file (includes the mix block)."""
    mono, sr = decode_mono(path, sr=44100)
    dur = len(mono) / sr
    lufs, dyn = integrated_lufs(mono, sr)
    spec, freqs = stft_power(mono, sr)
    centroid, entropy = spectral_stats(spec, freqs)
    flux, onsets = onset_curve(spec, sr)
    onset_rate = float(onsets.sum() / dur) if dur > 0 else 0.0
    bpm = estimate_bpm(flux, onsets, sr)
    return {
        "v": FEATURES_VERSION,
        "duration": round(dur, 1),
        "lufs": round(lufs, 2) if lufs != float("-inf") else -70.0,
        "dynamics": round(dyn, 2),
        "centroid": round(centroid, 1),
        "entropy": round(entropy, 3),
        "onset_rate": round(onset_rate, 3),
        "bpm": bpm,
        "mix": extract_mix(mono, sr, spec, freqs, flux),
    }


def extract_mix_file(path):
    """Mix block alone — the cache-upgrade path for tracks whose loudness
    features are already cached from before the mix engine existed."""
    mono, sr = decode_mono(path, sr=44100)
    return extract_mix(mono, sr)


def normalize_catalog(raw_list):
    """Catalog-wide 0–1 scaling, recomputed every build (robust 5–95 pct).
    Input: list of raw dicts. Output: list of catalog feature dicts
    {bpm, energy, brightness, entropy, onsets} in catalog order."""
    def scale(vals, lo_p=5, hi_p=95):
        v = np.asarray(vals, dtype=float)
        lo, hi = np.percentile(v, lo_p), np.percentile(v, hi_p)
        if hi - lo < 1e-9:
            return np.full(len(v), 0.5)
        return np.clip((v - lo) / (hi - lo), 0.0, 1.0)

    # energy: loud and compressed reads high; quiet and wide-open reads low
    energy_raw = [r["lufs"] - 0.35 * r["dynamics"] for r in raw_list]
    energy = scale(energy_raw)
    brightness = scale([np.log10(max(r["centroid"], 20.0)) for r in raw_list])
    onsets = scale([r["onset_rate"] for r in raw_list])
    out = []
    for i, r in enumerate(raw_list):
        out.append({
            "bpm": r["bpm"],
            "energy": round(float(energy[i]), 3),
            "brightness": round(float(brightness[i]), 3),
            "entropy": round(float(min(max(r["entropy"], 0.0), 1.0)), 3),
            "onsets": round(float(onsets[i]), 3),
        })
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="extract raw Möbius⁸ features from audio files")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--json", action="store_true", help="emit one JSON object keyed by filename")
    a = ap.parse_args(argv)
    out = {}
    for f in a.files:
        out[f] = extract(f)
        if not a.json:
            print(f"{f}: {out[f]}")
    if a.json:
        json.dump(out, sys.stdout, indent=2)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
