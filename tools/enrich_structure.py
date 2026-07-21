#!/usr/bin/env python3
"""enrich_structure.py — add each track's structural SCRIPT to the catalog.

For every track it writes a `mix.structure` block — the song's arc read as
sections (loud/quiet blocks), the apex (where it peaks), and the DJ cue regions
mix-in / mix-out — using the EXACT segmentation the browser runs in
`analyzeStructure`. Crucially it needs NO audio decode: it derives the loudness
envelope from the band-energy `env` score that is ALREADY in catalog.json, so
the whole catalog enriches in seconds with nothing but numpy — which is what
lets a GitHub Action keep it fresh on every push.

Purely ADDITIVE: existing fields (bpm, grid, key, in/out, phrases, env, …) are
never touched, so the mixer's proven seam is unchanged. The new `mix.structure`
powers the booth's structural overlay today (read precompute-first via the
client's trackStructure()), and is there for the mixer's cue-point logic next.

Usage:
  python3 tools/enrich_structure.py            # enrich docs/catalog.json in place
  python3 tools/enrich_structure.py --check    # compute + report coverage, don't write
  python3 tools/enrich_structure.py --selftest # verify the port against known shapes
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

CATALOG_PATH = Path("docs/catalog.json")
STRUCTURE_VERSION = 1


def smooth_env(peaks, win):
    """Box blur over [i-w, i+w] inclusive — mirrors the JS smoothEnv."""
    peaks = np.asarray(peaks, dtype=float)
    n = len(peaks)
    w = max(1, int(win))
    csum = np.concatenate(([0.0], np.cumsum(peaks)))
    lo = np.clip(np.arange(n) - w, 0, n - 1)
    hi = np.clip(np.arange(n) + w, 0, n - 1)
    return (csum[hi + 1] - csum[lo]) / (hi - lo + 1)


def analyze_structure(peaks, smooth=None, min_frac=0.06):
    """Port of the browser's analyzeStructure(): sections + apex + mix-in/out
    from a loudness envelope. The full per-sample envelope is intentionally NOT
    shipped — the booth reads sections/apex and the director reads the client
    map, so a per-track envelope would just bloat the catalog. If a consumer ever
    needs structureCeiling() over the precomputed map, add a compact `env` here
    (or reconstruct it from the track's existing band-energy score)."""
    peaks = np.asarray(peaks, dtype=float)
    n = len(peaks)
    if n < 8:
        return {"ok": False, "v": STRUCTURE_VERSION, "sections": [],
                "apex": 0.6, "mixIn": 0.0, "mixOut": 0.9}
    win = smooth if smooth is not None else max(4, round(n / 24))
    env = smooth_env(peaks, win)
    lo = float(env.min())
    hi = float(env.max())
    span = max(1e-4, hi - lo)
    thr_hi = lo + span * 0.55
    thr_lo = lo + span * 0.42
    # loud/quiet with hysteresis so a wobble never splits a block
    loud = env[0] > lo + span * 0.5
    loud_arr = np.empty(n, dtype=int)
    for i in range(n):
        if loud and env[i] < thr_lo:
            loud = False
        elif (not loud) and env[i] > thr_hi:
            loud = True
        loud_arr[i] = 1 if loud else 0
    min_len = max(4, round(n * min_frac))
    runs = []
    start = 0
    for i in range(1, n + 1):
        if i == n or loud_arr[i] != loud_arr[start]:
            runs.append({"s": start, "e": i, "loud": bool(loud_arr[start])})
            start = i
    merged = []
    for r in runs:
        if merged and (r["e"] - r["s"]) < min_len:
            merged[-1]["e"] = r["e"]           # absorb a too-short run
        else:
            merged.append(dict(r))
    sections = []
    for r in merged:
        seg = env[r["s"]:r["e"]]
        energy = (float(seg.mean()) - lo) / span
        sections.append({"s": round(r["s"] / n, 4), "e": round(r["e"] / n, 4),
                         "energy": round(energy, 3), "loud": r["loud"]})
    apex = 0.6
    best = -1e9
    for sec in sections:
        if sec["energy"] > best:
            best = sec["energy"]
            apex = (sec["s"] + sec["e"]) / 2
    mix_in = 0.0
    for sec in sections:
        if sec["loud"] and sec["s"] < 0.5:
            mix_in = sec["s"]
            break
    mix_out = 0.9
    for sec in sections:
        if sec["loud"] and sec["e"] > 0.45:
            mix_out = sec["e"] if sec["e"] < 0.97 else 0.97
    return {"ok": True, "v": STRUCTURE_VERSION,
            "sections": sections, "apex": round(apex, 4),
            "mixIn": round(mix_in, 4), "mixOut": round(mix_out, 4)}


def env_curve(env):
    """A loudness envelope from the score's band digit-strings (bass-weighted:
    the kick drives structure). Returns None if the score is missing/too short."""
    b, m, t = env.get("b"), env.get("m"), env.get("t")
    if not b or not m or not t:
        return None
    n = min(len(b), len(m), len(t))
    if n < 8:
        return None
    to = lambda s: np.frombuffer(s[:n].encode("ascii"), dtype=np.uint8).astype(float) - 48.0
    return 1.0 * to(b) + 0.8 * to(m) + 0.6 * to(t)


def enrich(catalog):
    ok = skip = 0
    for album in catalog.get("albums", []):
        for tr in album.get("tracks", []):
            mix, env = tr.get("mix"), tr.get("env")
            if not isinstance(mix, dict) or not isinstance(env, dict):
                skip += 1
                continue
            curve = env_curve(env)
            if curve is None:
                skip += 1
                continue
            mix["structure"] = analyze_structure(curve)
            ok += 1
    return ok, skip


def selftest():
    """The song-script shape must survive the port: a quiet intro/build, a loud
    chorus+drop in the back half, a quiet outro → apex in the loud back half,
    mix-out at the end of the last loud block, mix-in skipping the intro."""
    def block(v, n):
        return [v] * n
    # 0.06 intro · 0.12 build · 0.20 chorus · 0.10 breakdown · 0.22 drop · 0.10 outro
    peaks = (block(0.10, 30) + block(0.45, 60) + block(0.85, 100)
             + block(0.30, 50) + block(0.95, 110) + block(0.12, 50))
    st = analyze_structure(peaks)
    assert st["ok"], "should analyze"
    assert st["apex"] > 0.5, f"apex in the loud back half, got {st['apex']}"
    assert 0.78 < st["mixOut"] <= 0.97, f"exits as the last loud block ends, got {st['mixOut']}"
    assert 0.05 < st["mixIn"] < 0.5, f"enters past the intro, got {st['mixIn']}"
    assert len(st["sections"]) >= 3, "several sections"
    # a flat track degrades gracefully (still ok, one section)
    flat = analyze_structure([0.5] * 480)
    assert flat["ok"], "flat still analyzes"
    # too little data → not ok, safe defaults
    tiny = analyze_structure([0.5] * 4)
    assert tiny["ok"] is False and tiny["apex"] == 0.6, "tiny → safe defaults"
    print("selftest OK — structure port matches the browser's shape")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="add mix.structure to the catalog from the band-energy score")
    ap.add_argument("--check", action="store_true", help="compute + report, do not write")
    ap.add_argument("--selftest", action="store_true", help="verify the port against known shapes")
    ap.add_argument("--catalog", default=str(CATALOG_PATH))
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    path = Path(a.catalog)
    catalog = json.loads(path.read_text())
    ok, skip = enrich(catalog)
    total = ok + skip
    pct = (100.0 * ok / total) if total else 0.0
    print(f"structure: enriched {ok}/{total} tracks ({pct:.0f}%), skipped {skip} (no score)")
    if a.check:
        # show a sample so a human can eyeball it
        for album in catalog.get("albums", []):
            for tr in album.get("tracks", []):
                st = tr.get("mix", {}).get("structure")
                if st and st.get("ok"):
                    print(f"  e.g. {tr.get('title')!r}: {len(st['sections'])} sections, "
                          f"apex {st['apex']}, mixIn {st['mixIn']}, mixOut {st['mixOut']}")
                    return 0
        return 0
    path.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
