#!/usr/bin/env python3
"""piano_chart.py — transcribe a library track's piano part into a chart the
piano trainer (the ∞ Easter egg in docs/index.html) can teach.

The professional route, done offline the way the stems job does it:

  1. SEPARATE the mix with Demucs — `htdemucs_6s` has a dedicated PIANO stem
     (plus bass, which anchors the chord roots). Falls back to `htdemucs`'s
     "other" stem when the 6-source model is unavailable.
  2. TRANSCRIBE the piano stem to note events. Uses Spotify's basic-pitch
     when it is installed; otherwise a numpy harmonic-summation transcriber
     (the same idea the trainer's microphone listener uses, run on a clean
     stem with a long window, plus octave/fifth suppression and note tracking).
  3. QUANTIZE to the track's own beat grid from catalog.json (mix.bpm /
     mix.grid — the lattice the player's CLOCK already dances to), so the
     chart falls down the trainer's highway in sync with the record.
  4. READ the chart: chords per bar (template match, bass-anchored), the
     right-hand riff (top voice, phrased at rests), the left hand, the song's
     sections (from the catalog's structure), the repeating loop, the key.

Writes docs/charts/<tag>.json and prints a lead sheet to read by eye.

  python3 tools/piano_chart.py highway            # album tag (docs/audio/<tag>/)
  python3 tools/piano_chart.py highway --stems /path/to/dir   # reuse separated stems
  python3 tools/piano_chart.py --selftest         # transcriber on a synthetic chord (no torch)

Requires numpy; Demucs (+ ffmpeg) only to separate; basic-pitch optional.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CATALOG = Path("docs/catalog.json")
AUDIO = Path("docs/audio")
CHARTS = Path("docs/charts")
SR = 44100
NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
TEMPLATES = [  # id, symbol, intervals, prior (lower = preferred)
    ('maj', '', (0, 4, 7), 0.0), ('min', 'm', (0, 3, 7), 0.0),
    ('dom7', '7', (0, 4, 7, 10), 0.08), ('maj7', 'maj7', (0, 4, 7, 11), 0.08), ('min7', 'm7', (0, 3, 7, 10), 0.08),
    ('sus2', 'sus2', (0, 2, 7), 0.14), ('sus4', 'sus4', (0, 5, 7), 0.14), ('dim', 'dim', (0, 3, 6), 0.14),
    ('add9', 'add9', (0, 2, 4, 7), 0.12), ('pow', '5', (0, 7), 0.22), ('aug', 'aug', (0, 4, 8), 0.2),
]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def midi_to_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def camelot(root, minor):
    idx = ((root + 3) % 12 if minor else root) * 7 % 12       # circle-of-fifths index of the relative major
    return f"{(idx + 7) % 12 + 1}{'A' if minor else 'B'}"


def uses_flats(root, minor):
    idx = ((root + 3) % 12 if minor else root) * 7 % 12
    return idx >= 7


# ------------------------------------------------------------------ separation
def separate(path, workdir, model="htdemucs_6s"):
    """Run Demucs; return {stem_name: wav path}."""
    out = Path(workdir)
    subprocess.run([sys.executable, "-m", "demucs", "-n", model, "-o", str(out), str(path)], check=True)
    model_dir = out / model
    stem_dirs = [d for d in model_dir.iterdir() if d.is_dir()]
    if not stem_dirs:
        raise RuntimeError("Demucs produced no output")
    return {w.stem: w for w in stem_dirs[0].glob("*.wav")}


# ------------------------------------------------------------------ transcription (numpy)
def stft_mag(x, sr, n=8192, hop=1024, fmax=5200.0):
    win = np.hanning(n).astype(np.float32)
    nfr = max(1, 1 + (len(x) - n) // hop)
    kmax = int(fmax / (sr / n)) + 2
    mag = np.empty((nfr, kmax), dtype=np.float32)
    x = x.astype(np.float32)
    for i in range(nfr):
        seg = x[i * hop:i * hop + n] * win
        mag[i] = np.abs(np.fft.rfft(seg)[:kmax])
    return mag, sr / n, hop / sr, (n / 2) / sr


def salience(mag, bin_hz, lo=36, hi=96, harmonics=(1.0, 0.85, 0.7, 0.55, 0.45), tol=0.35):
    """S[frame, midi-lo]: weighted sum of the peak magnitude near each harmonic,
    and F[frame, midi-lo]: the fundamental's own peak (a note must have one)."""
    nfr, kmax = mag.shape
    n = hi - lo + 1
    S = np.zeros((nfr, n), dtype=np.float32)
    F = np.zeros((nfr, n), dtype=np.float32)
    for j, m in enumerate(range(lo, hi + 1)):
        f0 = midi_to_hz(m)
        for h, w in enumerate(harmonics, start=1):
            fh = f0 * h
            a = int(fh * 2 ** (-tol / 12) / bin_hz)
            b = int(math.ceil(fh * 2 ** (tol / 12) / bin_hz)) + 1
            if a < 1 or a >= kmax:
                break
            b = min(b, kmax)
            pk = mag[:, a:b].max(axis=1)
            S[:, j] += w * pk
            if h == 1:
                F[:, j] = pk
    return S, F


def frame_notes(S, F, floor, lo=36, max_notes=6, rel=0.3, abs_k=5.0):
    """Greedy per-frame pitch pick with octave/fifth suppression — the same
    logic as iterative cancellation, on the salience row."""
    out = []
    order = np.argsort(-S)
    best = S[order[0]] if len(order) else 0
    if best <= 0:
        return out
    for j in order[:max_notes * 3]:
        s = S[j]
        if s < best * rel or F[j] < floor * abs_k:
            continue
        if F[j] < 0.12 * s:                       # a real note has energy at its fundamental; leakage does not
            continue
        m = lo + j
        ok = True
        for (am, as_) in out:
            d = m - am
            if d in (12, 19, 24, 28, 31, 34, 36) and s < as_ * 0.62:   # a harmonic of a note already picked
                ok = False
                break
            if d in (-12, -24) and s < as_ * 0.85:                       # sub-octave ghost: its "harmonics" are the real note
                ok = False
                break
        if ok:
            out.append((m, float(s)))
        if len(out) >= max_notes:
            break
    return out


def transcribe_numpy(x, sr, lo=36, hi=96, max_notes=6, min_on=3, max_off=4):
    mag, bin_hz, dt, t0 = stft_mag(x, sr)
    S, F = salience(mag, bin_hz, lo, hi)
    floor = float(np.median(mag[:, 1:int(6000 / bin_hz)])) + 1e-9
    nfr = S.shape[0]
    active = {}          # midi -> [start_frame, peak, off_count]
    notes = []
    prev = {}
    for i in range(nfr):
        picks = dict(frame_notes(S[i], F[i], floor, lo, max_notes))
        # re-attack: salience jumps well above its recent level while the note is still "on"
        for m in list(active):
            if m in picks and active[m][0] < i - 2:
                # a fresh hammer on a note still ringing: its salience climbs well above the
                # floor it had decayed to a few frames ago, and is still climbing now
                j = m - lo
                base = S[max(0, i - 10):max(1, i - 3), j].min() if i >= 4 else 0
                rising = picks[m] > S[i - 1, j] * 1.08 if i >= 1 else True
                if picks[m] > base * 1.9 and rising and picks[m] > floor * 40 and i - active[m][0] >= min_on:
                    st, pk, _ = active.pop(m)
                    notes.append((m, st, i, pk))
        for m, s in picks.items():
            if m in active:
                active[m][1] = max(active[m][1], s)
                active[m][2] = 0
            else:
                active[m] = [i, s, 0]
        for m in list(active):
            if m not in picks:
                active[m][2] += 1
                if active[m][2] > max_off:
                    st, pk, off = active.pop(m)
                    end = i - off
                    if end - st >= min_on:
                        notes.append((m, st, end, pk))
        prev = picks
    for m, (st, pk, off) in active.items():
        if nfr - off - st >= min_on:
            notes.append((m, st, nfr - off, pk))
    if not notes:
        return []
    pks = np.array([n[3] for n in notes])
    p95 = np.percentile(pks, 95) or 1.0
    # frame times are window CENTRES: an onset is read where the window is centred on it, not where it begins
    return [{"m": int(m), "t": st * dt + t0, "e": en * dt + t0, "v": float(min(1.0, pk / p95))} for m, st, en, pk in notes]


def transcribe_basic_pitch(wav):
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH
    except Exception:
        return None
    _, _, events = predict(str(wav), ICASSP_2022_MODEL_PATH, onset_threshold=0.5, frame_threshold=0.3, minimum_note_length=80)
    return [{"m": int(p), "t": float(s), "e": float(e), "v": float(a)} for s, e, p, a, _ in events]


def bass_line(x, sr):
    """Monophonic: the strongest low note per frame, as note events."""
    mag, bin_hz, dt, t0 = stft_mag(x, sr, n=16384, hop=2048, fmax=1200)
    S, F = salience(mag, bin_hz, 24, 60, harmonics=(1.0, 0.8, 0.5))
    floor = float(np.median(mag[:, 1:])) + 1e-9
    seq = []
    for i in range(S.shape[0]):
        j = int(np.argmax(S[i]))
        if F[i, j] > floor * 6:
            m = 24 + j
            if m - 12 >= 24 and S[i, j - 12] > S[i, j] * 0.55:   # prefer the lower octave when it is really there
                m -= 12
            seq.append((i * dt + t0, m))
        else:
            seq.append((i * dt + t0, None))
    return seq


# ------------------------------------------------------------------ reading the chart
def q(x, step=0.25):
    return round(x / step) * step


def key_of(notes):
    hist = np.zeros(12)
    for n in notes:
        hist[n["m"] % 12] += (n["e"] - n["t"]) * (0.5 + n["v"])
    if hist.sum() == 0:
        return 0, False, 0.0
    best = None
    for root in range(12):
        for minor, prof in ((False, MAJOR_PROFILE), (True, MINOR_PROFILE)):
            r = np.corrcoef(np.roll(prof, root), hist)[0, 1]
            if best is None or r > best[0]:
                best = (r, root, minor)
    return best[1], best[2], float(best[0])


def chord_for(weights, bass_pc, flats):
    """weights: 12 pitch-class weights over a bar; returns (name, root, intervals) or None."""
    total = weights.sum()
    if total <= 0:
        return None
    w = weights / total
    best = None
    for root in range(12):
        for tid, sym, ivs, prior in TEMPLATES:
            inside = sum(w[(root + i) % 12] for i in ivs)
            outside = 1 - inside
            score = inside - 0.7 * outside - prior
            if w[root] < 0.08 and (bass_pc is None or bass_pc != root):
                score -= 0.25                                       # a chord without its root is a stretch
            if bass_pc is not None and bass_pc == root:
                score += 0.18
            if len(ivs) >= 4 and w[(root + ivs[3]) % 12] < 0.06:
                score -= 0.2                                        # do not name a seventh that is not there
            if best is None or score > best[0]:
                best = (score, root, sym, ivs)
    score, root, sym, ivs = best
    names = FLATS if flats else NAMES
    return {"name": names[root] + sym, "root": root, "pcs": [(root + i) % 12 for i in ivs], "score": round(float(score), 3)}


def section_names(sections, n_bars):
    """Catalog structure (fractions, loud flags) → named bar ranges."""
    out, seen_loud = [], 0
    for i, s in enumerate(sections):
        b0 = int(round(s["s"] * n_bars)); b1 = int(round(s["e"] * n_bars))
        if b1 <= b0:
            continue
        if s.get("loud"):
            seen_loud += 1
            name = "Drop" if seen_loud == 1 else ("Final drop" if i == len(sections) - 1 else f"Drop {seen_loud}")
        else:
            name = "Intro" if i == 0 else ("Outro" if i == len(sections) - 1 else "Break")
        out.append({"name": name, "bar": b0, "bars": b1 - b0, "energy": s.get("energy", 0)})
    return out


def phrase(notes, max_len=16, gap=1.0, min_len=4):
    """Split a melodic line at rests of ≥ gap beats; cap phrase length; drop scraps."""
    phrases, cur = [], []
    for n in notes:
        if cur and (n["b"] - (cur[-1]["b"] + cur[-1]["d"]) >= gap or len(cur) >= max_len):
            phrases.append(cur); cur = []
        cur.append(n)
    if cur:
        phrases.append(cur)
    return [p for p in phrases if len(p) >= min_len]


def top_voice(right, min_v=0.3):
    """The melody as a hand would play it: the highest audible note at each
    16th, minus the one-16th leaps of more than a tenth that are a pad or a
    vocal poking through rather than the line."""
    top = {}
    for n in right:
        if n["v"] < min_v:
            continue
        k = n["b"]
        if k not in top or top[k]["m"] < n["m"]:
            top[k] = n
    line = sorted(top.values(), key=lambda n: n["b"])
    out = []
    for i, n in enumerate(line):
        prev = line[i - 1]["m"] if i else None
        nxt = line[i + 1]["m"] if i + 1 < len(line) else None
        far_prev = prev is None or abs(n["m"] - prev) > 10
        far_next = nxt is None or abs(n["m"] - nxt) > 10
        if far_prev and far_next and n["d"] <= 0.25 and prev is not None and nxt is not None:
            continue
        out.append(n)
    return out


def build_chart(tag, track, piano_notes, bass_seq, bpm, grid, duration):
    spb = 60.0 / bpm
    n_bars = int(math.floor((duration - grid) / spb / 4))
    # quantize piano notes to the lattice (16ths); drop the sub-noise
    qn = []
    for n in piano_notes:
        b0 = (n["t"] - grid) / spb
        b1 = (n["e"] - grid) / spb
        if b1 < 0 or b0 > n_bars * 4:
            continue
        s = q(max(0.0, b0)); d = max(0.25, q(b1 - b0))
        if n["v"] < 0.12:
            continue
        qn.append({"m": n["m"], "b": round(s, 3), "d": round(d, 3), "v": round(n["v"], 2)})
    # merge duplicates (same pitch, same start)
    merged = {}
    for n in qn:
        k = (n["m"], n["b"])
        if k not in merged or merged[k]["d"] < n["d"]:
            merged[k] = n
    qn = sorted(merged.values(), key=lambda n: (n["b"], n["m"]))
    # bass root per bar
    bass_pc_by_bar = {}
    for bar in range(n_bars):
        t0 = grid + bar * 4 * spb; t1 = t0 + 4 * spb
        c = Counter(m % 12 for (t, m) in bass_seq if m is not None and t0 <= t < t1)
        if c:
            bass_pc_by_bar[bar] = c.most_common(1)[0][0]
    root, minor, conf = key_of(piano_notes)
    flats = uses_flats(root, minor)
    # chords per bar from the piano (weight = duration × velocity), anchored on the bass
    chords, last = [], None
    for bar in range(n_bars):
        w = np.zeros(12)
        for n in qn:
            a, b = n["b"], n["b"] + n["d"]
            ov = max(0.0, min(b, (bar + 1) * 4) - max(a, bar * 4))
            if ov > 0:
                w[n["m"] % 12] += ov * (0.4 + n["v"])
        bpc = bass_pc_by_bar.get(bar)
        if bpc is not None:
            w[bpc] += 1.2
        c = chord_for(w, bpc, flats) if w.sum() > 0.6 else None
        if c is None:
            c = dict(last) if last else None
            if c:
                c["carried"] = True
        chords.append(c)
        if c and not c.get("carried"):
            last = c
    # the loop: the most common 4-bar chord sequence among named bars
    seqs = Counter()
    for bar in range(0, n_bars - 3):
        names = tuple(c["name"] if c else "—" for c in chords[bar:bar + 4])
        if "—" not in names:
            seqs[names] += 1
    loop = list(seqs.most_common(1)[0][0]) if seqs else []
    right = [n for n in qn if n["m"] >= 60]
    left = [n for n in qn if n["m"] < 60]
    # the riff: the top voice of the right hand, cleaned of one-16th pokes from above
    riff = top_voice(right)
    structure = (track.get("mix") or {}).get("structure") or {}
    sections = section_names(structure.get("sections") or [], n_bars)
    return {
        "v": 1, "tag": tag, "title": track.get("title"), "file": track.get("file"), "sha256": track.get("sha256"),
        "bpm": bpm, "grid": grid, "duration": duration, "bars": n_bars,
        "key": {"root": root, "mode": "minor" if minor else "major", "camelot": camelot(root, minor), "confidence": round(conf, 3)},
        "loop": loop,
        "sections": sections,
        "chords": [{"bar": i, **({k: v for k, v in c.items()} if c else {"name": None})} for i, c in enumerate(chords)],
        "notes": qn,
        "riff": riff,
        "left": left,
        "phrases": [{"bar": int(p[0]["b"] // 4), "notes": p} for p in phrase(riff)],
    }


# ------------------------------------------------------------------ verification against the record
class Verifier:
    """Checks a chart against the audio it came from. A note is EVIDENCED when
    its own pitch (fundamental + 2 harmonics) rises at its charted time; the
    same test run on the notes moved an 8th, or a semitone, is the control.
    A part whose real score does not beat its semitone-shifted control is
    hearing the drums and the sub, not a piano — it is flagged untrusted."""
    def __init__(self, x, sr, grid, bpm, n=8192, hop=256):
        self.sr, self.grid, self.spb, self.n, self.hop = sr, grid, 60.0 / bpm, n, hop
        win = np.hanning(n).astype(np.float32)
        frames = 1 + (len(x) - n) // hop
        x = x.astype(np.float32)
        self.M = np.empty((frames, n // 2 + 1), dtype=np.float32)
        for i in range(frames):
            self.M[i] = np.abs(np.fft.rfft(x[i * hop:i * hop + n] * win))
        self.frames, self._e = frames, {}

    def _energy(self, m):
        if m not in self._e:
            f0 = midi_to_hz(m); idx = []
            for h in (1, 2, 3):
                k = int(round(f0 * h / (self.sr / self.n)))
                if 1 <= k < self.M.shape[1] - 1:
                    idx.append(k)
            self._e[m] = np.log1p(self.M[:, idx].sum(1)) if idx else np.zeros(self.frames)
        return self._e[m]

    def rise(self, m, beat):
        t = self.grid + beat * self.spb
        i = int(round((t - self.n / 2 / self.sr) * self.sr / self.hop)); d = max(2, int(0.07 * self.sr / self.hop))
        if i - d < 0 or i + d >= self.frames:
            return None
        e = self._energy(m)
        return float(e[i:i + d].max() - e[i - d:i].mean())

    def evidenced(self, m, beat, thr=0.15):
        """this pitch attacks here, and more than either semitone neighbour
        (a neighbour that rises as much is leakage, or a different note)"""
        r = self.rise(m, beat)
        if r is None:
            return None
        lo, hi = self.rise(m - 1, beat) or 0.0, self.rise(m + 1, beat) or 0.0
        return r > thr and r > 1.15 * max(lo, hi, 0.0)

    def rate(self, notes, toff=0.0, shift=0, thr=0.15):
        v = [self.evidenced(n["m"] + shift, n["b"] + toff, thr) for n in notes]
        v = [a for a in v if a is not None]
        return float(np.mean(v)) if v else 0.0


def chord_share(chart, x, sr, rng_seed=1):
    """Share of each bar's pitch-class energy (130 Hz–2.1 kHz) held by the
    named chord, and the same for a random chord of the same shape."""
    n, hop = 4096, 1024
    win = np.hanning(n)
    freqs = np.fft.rfftfreq(n, 1 / sr)
    band = (freqs > 120) & (freqs < 2100)
    pcs = np.round(12 * np.log2(freqs[band] / 440) + 69).astype(int) % 12
    spb = 60.0 / chart["bpm"]
    E = np.zeros((chart["bars"], 12))
    for i in range(1 + (len(x) - n) // hop):
        t = (i * hop + n / 2) / sr
        bar = int((t - chart["grid"]) / spb // 4)
        if 0 <= bar < chart["bars"]:
            np.add.at(E[bar], pcs, np.abs(np.fft.rfft(x[i * hop:i * hop + n] * win))[band] ** 2)
    rng = np.random.default_rng(rng_seed)
    real, rand = [], []
    for c in chart["chords"]:
        if not c.get("pcs") or c.get("carried"):
            continue
        e = E[c["bar"]]; tot = e.sum()
        if tot <= 0:
            continue
        real.append(e[c["pcs"]].sum() / tot)
        rand.append(e[[(p + int(rng.integers(1, 12))) % 12 for p in c["pcs"]]].sum() / tot)
    return (float(np.mean(real)) if real else 0.0), (float(np.mean(rand)) if rand else 0.0)


def verify_chart(chart, x, sr, thr=0.15):
    """Score the chart against the record, keep only evidenced riff notes, and
    mark the left hand trusted or not. Mutates and returns the chart."""
    V = Verifier(x, sr, chart["grid"], chart["bpm"])
    rep = {}
    for part in ("riff", "left"):
        notes = chart[part]
        rep[part] = {
            "attack": round(V.rate(notes), 3),
            "eighthLate": round(V.rate(notes, 0.5), 3),
            "eighthEarly": round(V.rate(notes, -0.5), 3),
            "semitoneUp": round(V.rate(notes, 0, 1), 3),
            "notes": len(notes),
        }
    kept = [n for n in chart["riff"] if V.evidenced(n["m"], n["b"], thr)]
    rep["riff"]["kept"] = len(kept)
    per_bar = []
    for bar in range(chart["bars"]):
        ns = [n for n in chart["riff"] if bar * 4 <= n["b"] < bar * 4 + 4]
        per_bar.append(round(V.rate(ns), 2) if ns else None)
    rep["riffPerBar"] = per_bar
    real, rand = chord_share(chart, x, sr)
    rep["chords"] = {"share": round(real, 3), "randomShare": round(rand, 3)}
    left_ok = rep["left"]["attack"] - max(rep["left"]["semitoneUp"], rep["left"]["eighthLate"], rep["left"]["eighthEarly"]) > 0.15
    chart["riff"] = kept
    chart["phrases"] = [{"bar": int(p[0]["b"] // 4), "notes": p} for p in phrase(kept)]
    chart["leftVerified"] = bool(left_ok)
    chart["verify"] = rep
    return chart


def compare_charts(a, b, tol=0.25):
    """How far two charts of one record agree: the riff note for note
    (same pitch, start within a 16th), its pitch classes, the key, the chords."""
    def match(x, y, pc=False):
        ys = {}
        for n in y:
            ys.setdefault(n["m"] % 12 if pc else n["m"], []).append(n["b"])
        hit = 0
        for n in x:
            k = n["m"] % 12 if pc else n["m"]
            if any(abs(b - n["b"]) <= tol for b in ys.get(k, ())):
                hit += 1
        return hit / max(1, len(x))
    ra, rb = a.get("riff", []), b.get("riff", [])
    same_ch = sum(1 for x, y in zip(a.get("chords", []), b.get("chords", [])) if x.get("root") is not None and x.get("root") == y.get("root"))
    n_ch = sum(1 for x in a.get("chords", []) if x.get("root") is not None)
    lines = ["compare: earlier chart vs this one",
             f"  riff notes of the earlier chart found in this one: {match(ra, rb)*100:.0f}% exact pitch, {match(ra, rb, True)*100:.0f}% pitch class (of {len(ra)})",
             f"  riff notes of this chart found in the earlier one: {match(rb, ra)*100:.0f}% exact pitch, {match(rb, ra, True)*100:.0f}% pitch class (of {len(rb)})",
             f"  key {a.get('key', {}).get('camelot')} vs {b.get('key', {}).get('camelot')} · chord roots agree on {same_ch}/{n_ch} bars",
             f"  loop {' '.join(a.get('loop', []))} vs {' '.join(b.get('loop', []))}"]
    return "\n".join(lines)


def lead_sheet(chart):
    k = chart['key']
    names = FLATS if uses_flats(k['root'], k['mode'] == 'minor') else NAMES
    lines = [f"{chart['title']} — {k['camelot']} {names[k['root']]} {k['mode']} (conf {k['confidence']}) · {chart['bpm']} BPM · {chart['bars']} bars"]
    lines.append("loop: " + " | ".join(chart["loop"]))
    for s in chart["sections"]:
        lines.append(f"  {s['name']:<11} bars {s['bar']:>3}–{s['bar'] + s['bars'] - 1:<3} energy {s['energy']}")
    row = []
    for c in chart["chords"]:
        row.append((c.get("name") or "—") + ("*" if c.get("carried") else ""))
        if len(row) == 8:
            lines.append("  " + " | ".join(f"{x:<6}" for x in row)); row = []
    if row:
        lines.append("  " + " | ".join(f"{x:<6}" for x in row))
    lines.append(f"notes {len(chart['notes'])} · riff {len(chart['riff'])} in {len(chart['phrases'])} phrases · left hand {len(chart['left'])}")
    v = chart.get("verify")
    if v:
        r, l, c = v["riff"], v["left"], v["chords"]
        lines.append(f"verified against the record: riff {r['attack']*100:.0f}% of notes attack on time (8th late {r['eighthLate']*100:.0f}%, semitone up {r['semitoneUp']*100:.0f}%), kept {r['kept']}/{r['notes']}")
        lines.append(f"  left hand {l['attack']*100:.0f}% (semitone up {l['semitoneUp']*100:.0f}%) → {'trusted' if chart.get('leftVerified') else 'NOT trusted: the trainer derives the left hand from the chords'}")
        lines.append(f"  chords hold {c['share']*100:.0f}% of each bar's pitch energy (random chord {c['randomShare']*100:.0f}%)")
    return "\n".join(lines)


def selftest():
    sr = 44100
    t = np.arange(int(sr * 2.0)) / sr
    x = np.zeros_like(t)
    for m in (60, 64, 67):           # a C major chord with harmonics, one second, then a G
        f = midi_to_hz(m)
        env = np.exp(-t * 1.2) * (t < 1.0)
        for h in range(1, 5):
            x += env * np.sin(2 * np.pi * f * h * t) / h
    for m in (67, 71, 74):
        f = midi_to_hz(m)
        env = np.exp(-(t - 1.0) * 1.2) * (t >= 1.0)
        for h in range(1, 5):
            x += env * np.sin(2 * np.pi * f * h * t) / h
    notes = transcribe_numpy(x / x.max(), sr)
    first = sorted({n["m"] for n in notes if n["t"] < 0.6})
    second = sorted({n["m"] for n in notes if n["t"] > 0.85})
    assert all(abs(n["t"]) < 0.12 for n in notes if n["t"] < 0.6), [round(n["t"], 3) for n in notes]   # onsets land where they are
    assert first == [60, 64, 67], first
    assert second == [67, 71, 74], second
    root, minor, conf = key_of(notes)
    assert root in (0, 7) and not minor, (root, minor)   # C E G + G B D: C or G major, both honest
    # the verifier hears the notes that are there, and not the ones a semitone off:
    # a G chord with a 10 ms hammer ramp at one second, over a quiet noise floor
    rng = np.random.default_rng(3)
    y = 0.002 * rng.standard_normal(len(t))
    ramp = np.clip((t - 1.0) / 0.01, 0, 1) * np.exp(-np.maximum(t - 1.0, 0) * 1.5)
    for m in (67, 71, 74):
        for h in range(1, 5):
            y += ramp * np.sin(2 * np.pi * midi_to_hz(m) * h * t) / h
    V = Verifier(y / np.abs(y).max(), sr, 0.0, 60.0)      # one beat per second
    real = [{"m": m, "b": 1.0} for m in (67, 71, 74)]
    assert V.rate(real) == 1.0, V.rate(real)
    assert V.rate(real, 0, 1) < 0.5, V.rate(real, 0, 1)
    assert V.rate(real, 0.5) == 0.0, V.rate(real, 0.5)    # half a second late: nothing new arrives
    w = np.zeros(12); w[[0, 4, 7]] = 1
    assert chord_for(w, 0, False)["name"] == "C"
    w = np.zeros(12); w[[9, 0, 4]] = 1
    assert chord_for(w, 9, False)["name"] == "Am"
    print("selftest ok")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tag", nargs="?")
    ap.add_argument("--stems", help="directory with already-separated stems (piano.wav / other.wav / bass.wav)")
    ap.add_argument("--model", default="htdemucs_6s")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--keep", help="copy the separated stems here")
    ap.add_argument("--mix", action="store_true", help="no separation: transcribe the whole mix (basic-pitch), bass from its low end")
    ap.add_argument("--wav", help="an already-decoded WAV of the track (else the mp3 is decoded)")
    ap.add_argument("--compare", help="an earlier chart to compare against (precision/recall of the riff, key, loop)")
    args = ap.parse_args()
    if args.selftest:
        selftest(); return
    if not args.tag:
        ap.error("an album tag is required")
    from fingerprint import decode_mono
    cat = json.load(open(CATALOG))
    album = next((a for a in cat["albums"] if a.get("tag") == args.tag), None)
    if not album:
        sys.exit(f"no album tagged {args.tag}")
    track = album["tracks"][0]
    src = AUDIO / args.tag / track["file"]
    mix = track.get("mix") or {}
    bpm, grid = mix.get("bpm"), mix.get("grid")
    if not bpm or grid is None:
        sys.exit("the catalog has no beat grid for this track")
    with tempfile.TemporaryDirectory() as td:
        if args.mix:
            wav = Path(args.wav) if args.wav else Path(td) / "mix.wav"
            if not args.wav:
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", str(SR), str(wav)], check=True)
            stems = {"piano": wav, "bass": wav}
        elif args.stems:
            stems = {w.stem: w for w in Path(args.stems).glob("*.wav")}
        else:
            print(f"separating {src} with {args.model} …", flush=True)
            stems = separate(src, td, args.model)
            if args.keep:
                import shutil
                Path(args.keep).mkdir(parents=True, exist_ok=True)
                for w in stems.values():
                    shutil.copy(w, Path(args.keep) / w.name)
        piano_wav = stems.get("piano") or stems.get("other")
        if not piano_wav:
            sys.exit(f"no piano/other stem among {sorted(stems)}")
        print(f"transcribing {piano_wav.name} …", flush=True)
        x, sr = decode_mono(str(piano_wav), sr=SR)
        # a 6-stem model that found little piano: fall back to "other"
        if piano_wav.stem == "piano" and stems.get("other"):
            y, _ = decode_mono(str(stems["other"]), sr=SR)
            if np.sqrt(np.mean(x ** 2)) < 0.15 * np.sqrt(np.mean(y ** 2)):
                print("  the piano stem is faint; the piano lives in 'other' — using that", flush=True)
                x = y
        notes = transcribe_basic_pitch(piano_wav)
        used = "basic-pitch"
        if not notes:
            notes = transcribe_numpy(x, sr); used = "harmonic summation"
        bass = []
        if stems.get("bass"):
            bx, _ = decode_mono(str(stems["bass"]), sr=SR)
            bass = bass_line(bx, sr)
    duration = float(track.get("duration") or len(x) / sr)
    chart = build_chart(args.tag, track, notes, bass, float(bpm), float(grid), duration)
    print("verifying against the record …", flush=True)
    verify_chart(chart, x, sr)
    chart["transcriber"] = used + (" on the whole mix" if args.mix else " on the " + piano_wav.stem + " stem")
    if args.compare and Path(args.compare).exists():
        old = json.loads(Path(args.compare).read_text())
        print(compare_charts(old, chart))
    CHARTS.mkdir(parents=True, exist_ok=True)
    out = CHARTS / f"{args.tag}.json"
    out.write_text(json.dumps(chart, separators=(",", ":"), ensure_ascii=False))
    print(lead_sheet(chart))
    print(f"wrote {out} ({out.stat().st_size} bytes) via {used}")


if __name__ == "__main__":
    main()
