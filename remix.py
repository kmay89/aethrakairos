#!/usr/bin/env python3
"""remix.py — the score, not the sound.

A remix here is a SIGNED JSON DOCUMENT that contains no audio: a list of
operations addressed in bars and beats against tracks named by content hash.
The audio only ever exists on the machine of someone who already holds the
files. That single property is what makes an open-source music label possible
on a public host: the repository distributes a score, and a score of a work
you may lawfully arrange is not a copy of it.

The three layers, and why each is licensed the way it is:

  0  the recording   docs/audio/*.mp3          LICENSE-AUDIO   all rights reserved
  1  the DNA         dna/*.fp, catalog analysis LICENSE-DNA     public domain
  2  the score       remixes/*/remix.json      LICENSE-CODE    open

Layer 1 is measurement — tempo, key, loudness, a fingerprint, a stem envelope.
Facts about a recording, not the recording. We put it in the public domain
deliberately, and that is where the "open source" in the label is real and
unqualified. Layer 2 is human arrangement, the part with authorship in it, and
it is open too. Layer 0 stays exactly as restricted as it was — with one
addition: a GRANT, a signed capability that says which derivative acts the
rights-holder permits, for which work, under which terms, until when.
LICENSE-AUDIO already says "not without prior written permission". A grant IS
that permission, in a form a script can check.

Commands:
  remix.py grant   --work SHA|--all --key K --permits ...   issue a grant
  remix.py pair    A B [--out remixes/slug]                 propose a mashup from
                                                            the catalog alone
  remix.py verify  remixes/*/remix.json [--json]            the gate CI runs
  remix.py compile remix.json [--out timeline.json]         player-ready timeline
  remix.py render  remix.json [--out build/]                an ffmpeg/demucs plan
  remix.py splits  remix.json                               credit from the score
  remix.py suggest [--instrumental|--acapella|--with SHA]   search the DNA
  remix.py intake  track.mp3 --origin suno --key K          bring new audio in
  remix.py selftest

Needs nothing but the standard library for everything above EXCEPT receipt
checking and intake fingerprinting, which import fingerprint.py (numpy) lazily
— so `verify` still runs a full structural, licence and lineage audit on a
machine that has no audio and no scientific stack, which is exactly the
machine CI runs on.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import signing

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / "docs" / "catalog.json"
AUDIO_ROOT = ROOT / "docs" / "audio"
GRANTS = ROOT / "grants"
DNA = ROOT / "dna"
STEMS_BUILD = ROOT / "build" / "stems"
TRUST = ROOT / "TRUST"

DNA_VERSION = 1
GRANT_VERSION = 1
BEATS_PER_BAR = 4          # the catalog's assumption everywhere
STEM_LANES = {"drums": "d", "bass": "b", "vocals": "v", "other": "o", "full": None}
ENV_HZ = 12.0              # tools/stems.py ships envelopes at 12 Hz

# What a manifest is allowed to ASK FOR, and what each verb means. A grant
# lists permits; verification computes the verbs a manifest actually uses and
# refuses anything the grant does not cover. Adding an operation to this tool
# without adding it here makes it unusable, which is the correct default.
PERMITS = {
    "excerpt":       "use a bounded time range of the recording",
    "separate":      "run source separation and use one stem lane",
    "timestretch":   "change playback rate to match another tempo",
    "pitchshift":    "transpose",
    "layer":         "combine with material from another work",
    "publish-score": "publish the manifest itself (no audio)",
    "render-public": "publish RENDERED AUDIO of the result",
    "commercial":    "any commercial exploitation",
}


# ---------------------------------------------------------------- errors

class Fail(Exception):
    """A verification failure with a human sentence attached."""


def die(msg):
    raise SystemExit(f"remix.py: {msg}")


# ---------------------------------------------------------------- catalog

def load_catalog(path=CATALOG):
    if not Path(path).exists():
        die(f"no catalog at {path} — run make_catalog.py first")
    return json.loads(Path(path).read_text())


def tracks(catalog):
    """Flatten the album tree into a list of (album, track)."""
    out = []
    for album in catalog.get("albums", []):
        for t in album.get("tracks", []):
            out.append((album, t))
    return out


def find_track(catalog, ref):
    """Resolve a track by sha256 (full or >=8 hex chars), file path, or title.

    Hash first, always. Titles collide — this catalog has two tracks called
    "beautiful" — and a remix that survives a retitle is a remix that keeps
    working. Titles are a convenience for the command line, never what gets
    written into a manifest."""
    ref = str(ref).strip()
    bare = ref[7:] if ref.startswith("sha256:") else ref
    hits = []
    for album, t in tracks(catalog):
        if t.get("sha256", "") == bare or (len(bare) >= 8 and t.get("sha256", "").startswith(bare.lower())):
            return album, t
        if t.get("file") == ref or Path(t.get("file", "")).stem == ref:
            hits.append((album, t))
        elif t.get("title", "").lower() == ref.lower():
            hits.append((album, t))
    if not hits:
        die(f"no track matches {ref!r}")
    if len(hits) > 1:
        listing = "\n  ".join(f"{t['sha256'][:12]}  {t['title']}" for _, t in hits)
        die(f"{ref!r} matches {len(hits)} tracks — name one by hash:\n  {listing}")
    return hits[0]


# ---------------------------------------------------------------- the grid

def grid_of(track):
    """(bpm, downbeat_seconds) or None when the track was never gridded.

    make_catalog.py deliberately leaves rubato, ambient and broken-grid
    material ungridded rather than forcing a tempo onto it — the piano rule.
    Such a track can still be excerpted in seconds; it just cannot be
    addressed in bars, and this returns None to say so."""
    mix = track.get("mix") or {}
    bpm, grid = mix.get("bpm"), mix.get("grid")
    if not bpm or bpm <= 0 or grid is None:
        return None
    return float(bpm), float(grid)


def bar_to_seconds(bpm, downbeat, bar, beat=1):
    """Bars and beats are 1-based, the way musicians count them."""
    return downbeat + ((bar - 1) * BEATS_PER_BAR + (beat - 1)) * 60.0 / bpm


def seconds_to_bar(bpm, downbeat, t):
    beats = (t - downbeat) * bpm / 60.0
    return beats / BEATS_PER_BAR + 1.0


def beats_seconds(bpm, beats):
    return beats * 60.0 / bpm


def resolve_position(track, pos):
    """A source position -> seconds. Accepts, in order of preference:

        {"bar": 33, "beat": 3}   the source's own measured grid
        {"section": 2}           1-based index into mix.structure.sections
        {"section": "apex"}      | "mixIn" | "mixOut" — the analysed landmarks
        {"t": 41.5}              raw seconds, the escape hatch

    Sections are stored as FRACTIONS of the duration, so they survive a
    re-encode that changes the file but not the performance."""
    dur = float(track.get("duration") or 0)
    if "t" in pos:
        return float(pos["t"])
    if "section" in pos:
        st = ((track.get("mix") or {}).get("structure") or {})
        sec = st.get("sections") or []
        which = pos["section"]
        if isinstance(which, str):
            if which not in ("apex", "mixIn", "mixOut"):
                raise Fail(f"unknown section landmark {which!r}")
            if st.get(which) is None:
                raise Fail(f"track has no analysed {which}")
            return float(st[which]) * dur
        i = int(which)
        if not 1 <= i <= len(sec):
            raise Fail(f"section {i} out of range (track has {len(sec)})")
        return float(sec[i - 1]["s"]) * dur
    if "bar" in pos:
        g = grid_of(track)
        if not g:
            raise Fail("track has no measured grid — address it in seconds ({\"t\": ...})")
        return bar_to_seconds(g[0], g[1], int(pos["bar"]), int(pos.get("beat", 1)))
    raise Fail(f"position {pos!r} has none of bar / section / t")


# ---------------------------------------------------------------- stem envelopes

def stem_envelope(track, lane):
    """Decode a 12 Hz stem envelope into floats in 0..1.

    tools/stems.py reduces each Demucs stem to one digit per 1/12 s. It is a
    few hundred bytes gzipped and it is the single most useful thing in the
    catalog for planning a remix, because it says WHERE THE VOICE IS without
    anyone having to ship, download, or even own the audio."""
    stems = (track.get("mix") or {}).get("stems") or {}
    code = STEM_LANES.get(lane)
    if code is None or code not in stems:
        return None
    return [int(c) / 9.0 for c in stems[code]]


def envelope_windows(env, present, min_seconds, want="quiet"):
    """Maximal runs where an envelope stays below (or above) a threshold.

    Returns [(start_s, end_s)] — the raw material for "where can this vocal
    live?" and "where is there a usable acapella?" """
    if not env:
        return []
    runs, start = [], None
    for i, v in enumerate(env):
        hit = (v < present) if want == "quiet" else (v >= present)
        if hit and start is None:
            start = i
        elif not hit and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(env)))
    return [(a / ENV_HZ, b / ENV_HZ) for a, b in runs if (b - a) / ENV_HZ >= min_seconds]


# ---------------------------------------------------------------- keys

CAMELOT = re.compile(r"^(\d{1,2})([AB])$")


def camelot_compatible(k1, k2):
    """The wheel: same key, ±1 around the ring, or the relative major/minor.

    Harmonic mixing is the difference between a mashup and a car crash, and it
    is decidable from two short strings the catalog already carries."""
    m1, m2 = CAMELOT.match(k1 or ""), CAMELOT.match(k2 or "")
    if not m1 or not m2:
        return False
    n1, l1 = int(m1.group(1)), m1.group(2)
    n2, l2 = int(m2.group(1)), m2.group(2)
    if l1 == l2:
        return n1 == n2 or (n1 - n2) % 12 in (1, 11)
    return n1 == n2


def tempo_ratio(b1, b2):
    """Playback-rate ratio to put b2 on b1's grid, folded across the octave.

    Half-time is family: 70 mixes with 140. The fold is what makes a drum'n'bass
    stem usable over a house track without anyone doing arithmetic."""
    if not b1 or not b2:
        return None
    best = None
    for mult in (0.25, 0.5, 1.0, 2.0, 4.0):
        r = (b1 / (b2 * mult))
        if 0.5 < r < 2.0 and (best is None or abs(r - 1) < abs(best - 1)):
            best = r
    return best


# ---------------------------------------------------------------- grants

def grant_path_for(work_sha, issuer_key):
    return GRANTS / f"{signing.keyid(issuer_key)[:8]}-{work_sha[:12]}.json"


def make_grant(work, title, issuer_key, permits, terms, expires=None, note=""):
    g = {
        "grant": GRANT_VERSION,
        "work": "*" if work == "*" else f"sha256:{work}",
        "title": title,
        "issuer": issuer_key,
        "issued": _today(),
        "expires": expires,
        "permits": sorted(set(permits)),
        "terms": terms,
    }
    if note:
        g["note"] = note
    return g


def _today():
    """Dates are metadata, never a clock the verifier depends on.

    Expiry is checked against a date the CALLER supplies (CI passes the commit
    date), so a verification run is reproducible: re-verifying an old commit
    must not start failing because time passed."""
    import datetime
    return datetime.date.today().isoformat()


def load_grants(dirpath=GRANTS):
    out = []
    d = Path(dirpath)
    if not d.exists():
        return out
    for p in sorted(d.glob("*.json")):
        try:
            out.append((p, json.loads(p.read_text())))
        except json.JSONDecodeError as e:
            raise Fail(f"{p}: not valid JSON ({e})")
    return out


def check_grant(grant, work_sha, needed, trust, as_of=None, source_path="grant"):
    """Does this grant permit these verbs on this work, and is it real?

    Order matters: signature first. An unsigned grant's contents are not
    evidence of anything, so there is nothing to reason about until the
    signature holds."""
    problems = []
    issuer = grant.get("issuer")
    if not issuer:
        return [f"{source_path}: no issuer"]
    if not signing.verify_obj(grant, issuer):
        return [f"{source_path}: signature does not verify against its own issuer key"]
    if issuer not in trust:
        problems.append(f"{source_path}: issuer {signing.keyid(issuer)} is not in TRUST")
    scope = grant.get("work")
    if scope != "*" and scope != f"sha256:{work_sha}":
        problems.append(f"{source_path}: covers {scope}, not sha256:{work_sha[:12]}")
    exp = grant.get("expires")
    if exp and as_of and str(exp) < str(as_of):
        problems.append(f"{source_path}: expired {exp} (checking as of {as_of})")
    missing = sorted(set(needed) - set(grant.get("permits") or []))
    if missing:
        problems.append(f"{source_path}: does not permit {', '.join(missing)}")
    return problems


# ---------------------------------------------------------------- manifests

def required_permits(manifest):
    """The verbs a manifest actually uses, derived from the manifest itself.

    Nobody declares what they need — it is computed, so it cannot be
    understated. This is the whole trick that keeps grants honest."""
    need = {"excerpt", "publish-score"}
    lanes = {l["id"]: l for l in manifest.get("lanes", [])}
    if any(l.get("stem", "full") != "full" for l in lanes.values()):
        need.add("separate")
    sources_used = {l.get("source") for l in lanes.values()}
    if len(sources_used) > 1:
        need.add("layer")
    for c in manifest.get("clips", []):
        if c.get("warp"):
            need.add("timestretch")
        if c.get("semitones"):
            need.add("pitchshift")
    if manifest.get("publish", {}).get("audio"):
        need.add("render-public")
    if manifest.get("publish", {}).get("commercial"):
        need.add("commercial")
    return need


def per_source_permits(manifest):
    """Split required_permits by source: a lane only implicates its own work."""
    lanes = {l["id"]: l for l in manifest.get("lanes", [])}
    multi = len({l.get("source") for l in lanes.values()}) > 1
    out = {}
    for lane in lanes.values():
        s = lane.get("source")
        need = out.setdefault(s, {"excerpt", "publish-score"})
        if lane.get("stem", "full") != "full":
            need.add("separate")
        if multi:
            need.add("layer")
    for c in manifest.get("clips", []):
        lane = lanes.get(c.get("lane"))
        if not lane:
            continue
        need = out.setdefault(lane.get("source"), {"excerpt", "publish-score"})
        if c.get("warp"):
            need.add("timestretch")
        if c.get("semitones"):
            need.add("pitchshift")
    pub = manifest.get("publish") or {}
    for need in out.values():
        if pub.get("audio"):
            need.add("render-public")
        if pub.get("commercial"):
            need.add("commercial")
    return out


def verify(manifest, catalog, trust, as_of=None, audio_root=AUDIO_ROOT,
           grants_dir=GRANTS, check_receipts=False, stems_dir=STEMS_BUILD):
    """The gate. Returns (ok, [(level, message), ...]).

    Levels: 'ok', 'warn', 'fail'. A warning is something that could not be
    checked here (no audio on this machine); a failure is something checked
    and found wrong. Never silently upgrade an unchecked thing to a pass —
    "unproven" and "proven" are different words on purpose."""
    log = []
    def ok(m):   log.append(("ok", m))
    def warn(m): log.append(("warn", m))
    def bad(m):  log.append(("fail", m))

    for key, why in signing.BURNED.items():
        if key in trust:
            warn(f"TRUST lists a BURNED key ({signing.keyid(key)}): {why}. "
                 f"Remove it before this label issues grants that matter.")

    # -- shape
    if manifest.get("dna") != DNA_VERSION:
        bad(f"dna version is {manifest.get('dna')!r}, this tool speaks {DNA_VERSION}")
        return False, log
    for field in ("id", "title", "author", "grid", "sources", "lanes", "clips"):
        if field not in manifest:
            bad(f"missing required field {field!r}")
    if any(l == "fail" for l, _ in log):
        return False, log
    ok(f"shape · dna v{DNA_VERSION}, {len(manifest['sources'])} sources, "
       f"{len(manifest['lanes'])} lanes, {len(manifest['clips'])} clips")

    # -- author signature
    author_key = (manifest.get("author") or {}).get("key")
    if not author_key:
        bad("author has no key — an unsigned remix has no author, only a filename")
    elif not manifest.get("sig"):
        bad("manifest is unsigned")
    elif not signing.verify_obj(manifest, author_key):
        bad("manifest signature does not verify")
    else:
        who = trust.get(author_key, "not in TRUST")
        ok(f"signature · {signing.keyid(author_key)} ({who})")
        if author_key not in trust:
            warn("author key is not in TRUST — anyone may sign a score, but the label "
                 "only vouches for keys it has merged")

    # -- sources resolve, and against the real catalog
    by_id = {}
    for sid, src in manifest["sources"].items():
        sha = (src.get("sha256") or "").replace("sha256:", "")
        if not re.fullmatch(r"[0-9a-f]{64}", sha):
            bad(f"source {sid}: sha256 is not 64 hex chars")
            continue
        hit = next((t for _, t in tracks(catalog) if t.get("sha256") == sha), None)
        if not hit:
            warn(f"source {sid}: sha256:{sha[:12]} is not in this catalog "
                 f"(a remix of someone else's work verifies on THEIR catalog)")
        else:
            by_id[sid] = hit
            ok(f"source {sid} · {hit['title']} ({sha[:12]})")

    # -- grants
    needs = per_source_permits(manifest)
    available = load_grants(grants_dir)
    for sid, src in manifest["sources"].items():
        sha = (src.get("sha256") or "").replace("sha256:", "")
        need = needs.get(sid, {"excerpt", "publish-score"})
        named = src.get("grant")
        candidates = []
        if named:
            p = ROOT / named
            if not p.exists():
                bad(f"source {sid}: names grant {named}, which does not exist")
                continue
            candidates = [(p, json.loads(p.read_text()))]
        else:
            candidates = available
        problems, accepted = [], None
        for p, g in candidates:
            probs = check_grant(g, sha, need, trust, as_of, source_path=str(Path(p).name))
            if not probs:
                accepted = p
                break
            problems.extend(probs)
        if accepted:
            ok(f"grant  {sid} · {Path(accepted).name} permits {', '.join(sorted(need))}")
        else:
            bad(f"source {sid}: no grant covers {', '.join(sorted(need))}"
                + ("\n         " + "\n         ".join(problems[:4]) if problems else
                   f" (searched {grants_dir})"))

    # -- lanes and clips are internally consistent
    lane_ids = set()
    for lane in manifest["lanes"]:
        lid = lane.get("id")
        if lid in lane_ids:
            bad(f"lane {lid!r} defined twice")
        lane_ids.add(lid)
        if lane.get("source") not in manifest["sources"]:
            bad(f"lane {lid!r}: unknown source {lane.get('source')!r}")
        if lane.get("stem", "full") not in STEM_LANES:
            bad(f"lane {lid!r}: unknown stem {lane.get('stem')!r} "
                f"(expected one of {', '.join(STEM_LANES)})")

    bpm = float((manifest.get("grid") or {}).get("bpm") or 0)
    if bpm <= 0:
        bad("grid.bpm must be a positive number")
    for i, c in enumerate(manifest["clips"]):
        where = f"clip {i}"
        lane = next((l for l in manifest["lanes"] if l.get("id") == c.get("lane")), None)
        if not lane:
            bad(f"{where}: unknown lane {c.get('lane')!r}")
            continue
        track = by_id.get(lane.get("source"))
        if not track:
            continue
        try:
            start = resolve_position(track, c.get("from") or {})
        except Fail as e:
            bad(f"{where}: {e}")
            continue
        beats = float(c.get("beats") or 0)
        if beats <= 0:
            bad(f"{where}: beats must be positive")
            continue
        src_bpm = (grid_of(track) or (bpm, 0))[0]
        length = beats_seconds(src_bpm, beats)
        dur = float(track.get("duration") or 0)
        if start < -0.05:
            bad(f"{where}: starts at {start:.2f}s, before the file begins")
        if dur and start + length > dur + 0.05:
            bad(f"{where}: runs to {start + length:.2f}s, past the {dur:.1f}s source")
        if c.get("warp"):
            r = tempo_ratio(bpm, src_bpm)
            if r is None:
                bad(f"{where}: warp requested but {src_bpm:.1f} does not fold onto {bpm:.1f}")
            elif abs(r - 1) > 0.08:
                warn(f"{where}: warp of {(r - 1) * 100:+.1f}% is past the 8% the "
                     f"planner considers musical")
    if not any(l == "fail" for l, _ in log[-len(manifest['clips']) - 1:]):
        ok(f"timing · {len(manifest['clips'])} clips inside their sources")

    # -- lineage: every source must be declared a parent
    parents = {p.replace("sha256:", "") for p in manifest.get("parents", [])}
    used = {(s.get("sha256") or "").replace("sha256:", "") for s in manifest["sources"].values()}
    undeclared = used - parents
    if undeclared:
        bad("parents omits sources actually used: " + ", ".join(s[:12] for s in sorted(undeclared)))
    else:
        ok(f"lineage · {len(parents)} parents declared, all sources accounted for")

    # -- receipts: the only check that needs real audio
    for lane in manifest["lanes"]:
        r = lane.get("receipt")
        if lane.get("stem", "full") == "full":
            continue
        if not r:
            warn(f"lane {lane.get('id')!r}: separated but carries no receipt — "
                 f"nobody can confirm which model produced it")
            continue
        if not check_receipts:
            warn(f"lane {lane.get('id')!r}: receipt {r.get('model')} unproven "
                 f"(pass --check-receipts on a machine with the audio)")
        else:
            log.extend(_verify_receipt(lane, by_id.get(lane.get("source")), stems_dir))

    return not any(l == "fail" for l, _ in log), log


def _verify_receipt(lane, track, stems_dir):
    """Re-separate and compare PERCEPTUALLY, not byte-for-byte.

    Demucs on a different GPU, a different BLAS, a different torch build does
    not produce identical samples — so a sha256 of a stem is a promise no
    honest tool can keep. What IS stable is what the stem sounds like, and
    fingerprint.py already measures exactly that: a Haitsma-Kalker bit-error
    rate. So the receipt stores the fingerprint of the stem, and the check is
    "does re-running the model land inside CLONE distance". A tolerance-aware
    hash is the right primitive for a neural derivation, and this repo
    happened to already have one."""
    lid = lane.get("id")
    receipt = lane.get("receipt") or {}
    if not track:
        return [("warn", f"lane {lid!r}: source not in catalog, cannot re-derive")]
    ref = ROOT / receipt.get("fp", "")
    if not receipt.get("fp") or not ref.exists():
        return [("warn", f"lane {lid!r}: receipt names {receipt.get('fp')!r}, "
                         f"which is not in this tree")]
    stem_wav = stem_wav_path(track, lane.get("stem"), stems_dir)
    if not stem_wav.exists():
        return [("warn", f"lane {lid!r}: {stem_wav} not present — run the render "
                         f"script first, then re-check")]
    try:
        import fingerprint as fp
    except ImportError as e:
        return [("warn", f"lane {lid!r}: receipt unproven ({e.name} not installed)")]
    try:
        got = fp.fingerprint_file_multi(stem_wav)
        want = fp.load_fp(ref)
        result = fp.compare_best(got, want)
    except Exception as e:  # decoding and separation are big external parts
        return [("warn", f"lane {lid!r}: could not re-derive ({e})")]
    tol = float(receipt.get("tolerance", fp.CLONE_BER))
    ber = result["window_ber"]
    if ber <= tol:
        return [("ok", f"receipt {lid!r} · re-derived at window BER {ber:.3f} ≤ {tol} "
                       f"({receipt.get('model', 'unknown model')})")]
    return [("fail", f"receipt {lid!r} · re-derived at window BER {ber:.3f} > {tol}; "
                     f"this lane is not the audio the manifest claims it is")]


def stem_wav_path(track, lane_stem, stems_dir, model="htdemucs"):
    """Where `remix.py render`'s script leaves a separated stem."""
    return Path(stems_dir) / model / Path(track["file"]).stem / f"{lane_stem}.wav"


def write_receipts(manifest, catalog, stems_dir, model="htdemucs"):
    """Fingerprint the separated stems and record them as Layer-1 DNA.

    A stem's fingerprint is a measurement of a derivation — the same kind of
    fact as a tempo or a key — so it goes in dna/ under LICENSE-DNA, public
    domain, and it is small: ~34 KB for a four-minute stem. Committing it is
    what lets a THIRD party, months later, holding only the source mp3, prove
    that the lane in this manifest is the lane the author actually used."""
    try:
        import fingerprint as fp
    except ImportError:
        die("writing receipts needs numpy (fingerprint.py) — pip install numpy")
    by_id = {}
    for sid, src in manifest["sources"].items():
        sha = (src.get("sha256") or "").replace("sha256:", "")
        hit = next((t for _, t in tracks(catalog) if t.get("sha256") == sha), None)
        if hit:
            by_id[sid] = hit
    written = []
    for lane in manifest["lanes"]:
        stem = lane.get("stem", "full")
        if stem == "full":
            continue
        track = by_id.get(lane.get("source"))
        if not track:
            die(f"lane {lane['id']!r}: source not in the catalog")
        wav = stem_wav_path(track, stem, stems_dir, model)
        if not wav.exists():
            die(f"lane {lane['id']!r}: {wav} not found — run the render script first")
        out = DNA / "stems" / f"{track['sha256'][:12]}-{stem}.fp"
        fp.save_fp(fp.fingerprint_file(wav), out)
        lane["receipt"] = {
            "model": f"{model}",
            "fp": str(out.relative_to(ROOT)),
            "tolerance": fp.CLONE_BER,
        }
        written.append(out)
    return written


# ---------------------------------------------------------------- compile

def compile_timeline(manifest, catalog):
    """Flatten a manifest into absolute seconds — what a player can execute.

    The manifest is written in bars because bars are what survive: change
    grid.bpm and every clip moves together and stays musical. The player wants
    seconds. This is the one-way door between the two, and it belongs in a
    tool, not in the file."""
    bpm = float(manifest["grid"]["bpm"])
    by_id = {}
    for sid, src in manifest["sources"].items():
        sha = (src.get("sha256") or "").replace("sha256:", "")
        hit = next((t for _, t in tracks(catalog) if t.get("sha256") == sha), None)
        if hit:
            by_id[sid] = hit
    lanes = {l["id"]: l for l in manifest["lanes"]}

    events = []
    for c in manifest["clips"]:
        lane = lanes[c["lane"]]
        track = by_id.get(lane["source"])
        if not track:
            continue
        src_bpm = (grid_of(track) or (bpm, 0.0))[0]
        rate = (tempo_ratio(bpm, src_bpm) or 1.0) if c.get("warp") else 1.0
        at_bar = float((c.get("at") or {}).get("bar", 1))
        at_beat = float((c.get("at") or {}).get("beat", 1))
        start_out = ((at_bar - 1) * BEATS_PER_BAR + (at_beat - 1)) * 60.0 / bpm
        src_start = resolve_position(track, c.get("from") or {})
        beats = float(c["beats"])
        events.append({
            "lane": c["lane"],
            "stem": lane.get("stem", "full"),
            "file": track["file"],
            "sha256": track["sha256"],
            "at": round(start_out, 4),
            "dur": round(beats_seconds(bpm, beats), 4),
            "src": round(src_start, 4),
            "srcDur": round(beats_seconds(src_bpm, beats), 4),
            "rate": round(rate, 6),
            "gain": float(c.get("gain", 0.0)),
            "semitones": float(c.get("semitones", 0.0)),
            "fadeIn": round(beats_seconds(bpm, float((c.get("fade") or {}).get("in", 0))), 4),
            "fadeOut": round(beats_seconds(bpm, float((c.get("fade") or {}).get("out", 0))), 4),
        })
    events.sort(key=lambda e: (e["at"], e["lane"]))
    total = max((e["at"] + e["dur"] for e in events), default=0.0)
    return {
        "timeline": 1,
        "id": manifest["id"],
        "title": manifest["title"],
        "bpm": bpm,
        "key": (manifest.get("grid") or {}).get("key"),
        "duration": round(total, 3),
        "bar": round(BEATS_PER_BAR * 60.0 / bpm, 6),
        "lanes": [{"id": l["id"], "stem": l.get("stem", "full"), "source": l["source"]}
                  for l in manifest["lanes"]],
        "events": events,
        "cues": [{"at": round(e["at"], 3), "label": e["lane"]} for e in events],
    }


# ---------------------------------------------------------------- render plan

def render_plan(manifest, catalog, out_dir):
    """Emit a build script rather than shelling out behind the user's back.

    Rendering needs Demucs (a few hundred MB of model) and ffmpeg, takes
    minutes, and writes audio that is licensed differently from everything
    else here. That deserves a script the user reads before running, not a
    subprocess that surprises them. It is also the honest artifact: a plain
    text file that says exactly which bytes of which file became which second
    of the result."""
    tl = compile_timeline(manifest, catalog)
    out = Path(out_dir)
    lines = [
        "#!/bin/sh",
        "# Generated by remix.py render — read it before you run it.",
        f"# {manifest['title']}  ({manifest['id']})",
        "#",
        "# This script materialises audio on THIS machine from files you already",
        "# hold. It does not download anything and it does not publish anything.",
        "# Whether you may share what it produces is a question of your grant:",
        f"#   permits needed: {', '.join(sorted(required_permits(manifest)))}",
        "#",
        "# Run it from the root of the repository. Paths are relative on purpose:",
        "# a build script with someone else's home directory baked into it is a",
        "# build script that only ever ran once.",
        "set -eu",
        f'OUT="${{OUT:-{out.as_posix()}}}"',
        f'SRC="${{SRC:-{AUDIO_ROOT.relative_to(ROOT).as_posix()}}}"',
        '[ -d "$SRC" ] || { echo "no audio at $SRC — set SRC=/path/to/your/files" >&2; exit 1; }',
        'mkdir -p "$OUT/stems"',
        "",
    ]
    need_sep = sorted({(e["file"], e["stem"]) for e in tl["events"] if e["stem"] != "full"})
    if need_sep:
        lines += ["# --- separate the lanes that need separating (idempotent)"]
        for f, stem in sorted({(f, s) for f, s in need_sep}):
            slug = Path(f).stem
            lines.append(
                f'[ -f "$OUT/stems/htdemucs/{slug}/{stem}.wav" ] || '
                f'python3 -m demucs -n htdemucs -o "$OUT/stems" "$SRC/{f}"')
        lines.append("")

    lines += ["# --- cut each clip"]
    inputs = []
    for i, e in enumerate(tl["events"]):
        slug = Path(e["file"]).stem
        src = (f'"$OUT/stems/htdemucs/{slug}/{e["stem"]}.wav"' if e["stem"] != "full"
               else f'"$SRC/{e["file"]}"')
        clip = f'"$OUT/clip{i:03d}.wav"'
        filters = []
        if abs(e["rate"] - 1.0) > 1e-6:
            # atempo is limited to 0.5..2.0 per stage; every ratio we allow is
            # inside that, because tempo_ratio() folds it there first.
            filters.append(f'atempo={e["rate"]:.6f}')
        if e["semitones"]:
            cents = e["semitones"] * 100
            filters.append(f'rubberband=pitch={2 ** (e["semitones"] / 12):.6f}'
                           f'  # {cents:+.0f} cents')
        if e["gain"]:
            filters.append(f'volume={e["gain"]:+.2f}dB')
        if e["fadeIn"]:
            filters.append(f'afade=t=in:st=0:d={e["fadeIn"]:.3f}')
        if e["fadeOut"]:
            filters.append(f'afade=t=out:st={max(0, e["dur"] - e["fadeOut"]):.3f}:'
                           f'd={e["fadeOut"]:.3f}')
        filters.append(f'adelay={int(e["at"] * 1000)}:all=1')
        chain = ",".join(filters) if filters else "anull"
        lines.append(f'ffmpeg -y -loglevel error -ss {e["src"]:.4f} -t {e["srcDur"]:.4f} '
                     f'-i {src} -af "{chain}" -ar 48000 -ac 2 {clip}')
        inputs.append(clip)

    lines += ["", "# --- sum the lanes"]
    if inputs:
        ins = " ".join(f"-i {c}" for c in inputs)
        lines.append(
            f'ffmpeg -y -loglevel error {ins} '
            f'-filter_complex "amix=inputs={len(inputs)}:normalize=0,'
            f'alimiter=limit=0.97" -ar 48000 -ac 2 "$OUT/{manifest["id"]}.wav"')
        lines.append(f'ffmpeg -y -loglevel error -i "$OUT/{manifest["id"]}.wav" '
                     f'-b:a 320k "$OUT/{manifest["id"]}.mp3"')
    lines += [
        "",
        "# --- the receipt: prove afterwards what this render actually contains.",
        "# The paternity test runs on the OUTPUT: whatever the arrangement claims,",
        "# the fingerprint says which catalog works are audibly in the result.",
        f'python3 fingerprint.py check "$OUT/{manifest["id"]}.mp3" '
        f'--against {DNA.relative_to(ROOT).as_posix()} || true',
        'echo "done → $OUT"',
    ]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- splits

def _union_length(intervals):
    """Total length covered by a set of possibly-overlapping intervals."""
    total, cur_a, cur_b = 0.0, None, None
    for a, b in sorted(intervals):
        if cur_b is None or a > cur_b:
            if cur_b is not None:
                total += cur_b - cur_a
            cur_a, cur_b = a, b
        else:
            cur_b = max(cur_b, b)
    return total + (cur_b - cur_a if cur_b is not None else 0.0)


def splits(manifest, catalog, arranger_share=0.5):
    """Credit computed from the score instead of negotiated after the fact.

    Every clip contributes beats. Beats per source, normalised, is a defensible
    first number for who did what — and unlike a spreadsheet, it updates itself
    when the arrangement changes. THIS IS A CREDIT LEDGER, NOT A CONTRACT: it
    records a proposal in a machine-readable place so that the conversation
    starts from evidence. Splits that matter get agreed by humans and signed."""
    lanes = {l["id"]: l for l in manifest["lanes"]}
    bpm = float(manifest["grid"]["bpm"])

    # Union of occupied time, per source — NOT the sum of its clips. A bed
    # split into drums+bass+other occupies the same 80 bars as a bed used
    # whole; counting each lane separately would pay a source three times for
    # being easy to separate, which is exactly the kind of arithmetic that
    # makes people distrust an automatic ledger.
    spans = {}
    for c in manifest["clips"]:
        lane = lanes.get(c["lane"])
        if not lane:
            continue
        at = (c.get("at") or {})
        start = ((float(at.get("bar", 1)) - 1) * BEATS_PER_BAR
                 + (float(at.get("beat", 1)) - 1))
        spans.setdefault(lane["source"], []).append((start, start + float(c.get("beats") or 0)))

    beats = {sid: _union_length(iv) for sid, iv in spans.items()}
    total = sum(beats.values()) or 1.0
    rows = []
    for sid, b in sorted(beats.items(), key=lambda kv: -kv[1]):
        src = manifest["sources"].get(sid, {})
        rows.append({
            "source": sid,
            "title": src.get("title", sid),
            "sha256": src.get("sha256"),
            "beats": round(b, 2),
            "share": round((1.0 - arranger_share) * b / total, 4),
            "role": "source recording",
        })
    author = manifest.get("author") or {}
    rows.insert(0, {
        "source": None,
        "title": author.get("name", "arranger"),
        "key": author.get("key"),
        "beats": None,
        "share": round(arranger_share, 4),
        "role": "arrangement",
    })
    return rows


# ---------------------------------------------------------------- suggest / pair

def suggest_windows(catalog, kind, min_bars=8, limit=20):
    """Find usable material across the whole library from envelopes alone.

    instrumental — a stretch with music but no voice: where another vocal can live
    acapella   — a stretch with voice and little else: what you would drop in"""
    rows = []
    for _, t in tracks(catalog):
        g = grid_of(t)
        if not g:
            continue
        bpm = g[0]
        min_s = min_bars * BEATS_PER_BAR * 60.0 / bpm
        voc = stem_envelope(t, "vocals")
        if not voc:
            continue
        if kind == "instrumental":
            other = stem_envelope(t, "other") or []
            drums = stem_envelope(t, "drums") or []
            wins = envelope_windows(voc, 0.12, min_s, want="quiet")
            wins = [w for w in wins if _mean_between(other, w) > 0.15 or
                    _mean_between(drums, w) > 0.15]
        else:
            wins = envelope_windows(voc, 0.45, min_s, want="loud")
        for a, b in wins:
            rows.append({
                "title": t["title"], "sha256": t["sha256"], "bpm": round(bpm, 2),
                "key": (t.get("mix") or {}).get("key"),
                "from": round(seconds_to_bar(g[0], g[1], a), 1),
                "bars": round((b - a) * bpm / 60.0 / BEATS_PER_BAR, 1),
                "start": round(a, 2), "end": round(b, 2),
            })
    rows.sort(key=lambda r: -r["bars"])
    return rows[:limit]


def _mean_between(env, window):
    if not env:
        return 0.0
    a, b = int(window[0] * ENV_HZ), int(window[1] * ENV_HZ)
    seg = env[a:b]
    return sum(seg) / len(seg) if seg else 0.0


def compatible(catalog, track, limit=15):
    g = grid_of(track)
    key = (track.get("mix") or {}).get("key")
    rows = []
    for _, t in tracks(catalog):
        if t["sha256"] == track["sha256"]:
            continue
        g2 = grid_of(t)
        if not g or not g2:
            continue
        r = tempo_ratio(g[0], g2[0])
        if r is None or abs(r - 1) > 0.08:
            continue
        k2 = (t.get("mix") or {}).get("key")
        if not camelot_compatible(key, k2):
            continue
        rows.append({"title": t["title"], "sha256": t["sha256"], "bpm": round(g2[0], 2),
                     "key": k2, "stretch": f"{(r - 1) * 100:+.1f}%",
                     "has_stems": bool(stem_envelope(t, "vocals"))})
    rows.sort(key=lambda r: abs(float(r["stretch"].rstrip("%"))))
    return rows[:limit]


def pair(catalog, bed_ref, vocal_ref, author_name, author_key, min_bars=16):
    """Propose a mashup: one track's instrumental window hosting another's vocal.

    Every number here comes out of the catalog — tempo, key, downbeat, and the
    two stem envelopes that say where the voice is and is not. No audio is
    read. This is the argument for keeping layer 1 open and rich: with good
    enough DNA, a machine can draft a musical idea before anyone downloads a
    single byte."""
    _, bed = find_track(catalog, bed_ref)
    _, voc = find_track(catalog, vocal_ref)
    gb, gv = grid_of(bed), grid_of(voc)
    if not gb or not gv:
        die("both tracks need a measured grid to be paired in bars")
    bpm = gb[0]
    ratio = tempo_ratio(bpm, gv[0])
    if ratio is None:
        die(f"{voc['title']} at {gv[0]:.1f} does not fold onto {bed['title']} at {bpm:.1f}")

    bed_v = stem_envelope(bed, "vocals")
    voc_v = stem_envelope(voc, "vocals")
    if not bed_v or not voc_v:
        die("both tracks need stem envelopes — run tools/stems.py first")

    min_s_bed = min_bars * BEATS_PER_BAR * 60.0 / bpm
    holes = envelope_windows(bed_v, 0.12, min_s_bed, want="quiet")
    if not holes:
        die(f"{bed['title']} has no {min_bars}-bar stretch clear of vocals")
    hole = max(holes, key=lambda w: w[1] - w[0])

    min_s_voc = min_bars * BEATS_PER_BAR * 60.0 / gv[0]
    sings = envelope_windows(voc_v, 0.45, min_s_voc, want="loud")
    if not sings:
        die(f"{voc['title']} has no {min_bars}-bar stretch of sustained voice")
    sing = max(sings, key=lambda w: w[1] - w[0])

    # snap both to whole bars — a mashup that starts off the downbeat is a mistake
    bed_bar = int(seconds_to_bar(gb[0], gb[1], hole[0])) + 1
    voc_bar = int(seconds_to_bar(gv[0], gv[1], sing[0])) + 1
    bars = int(min(
        (hole[1] - bar_to_seconds(gb[0], gb[1], bed_bar)) * bpm / 60.0 / BEATS_PER_BAR,
        (sing[1] - bar_to_seconds(gv[0], gv[1], voc_bar)) * gv[0] / 60.0 / BEATS_PER_BAR))
    bars = max(min_bars, (bars // 4) * 4)

    slug = f"{Path(bed['file']).stem}-x-{Path(voc['file']).stem}"[:60]
    manifest = {
        "dna": DNA_VERSION,
        "id": slug,
        "title": f"{voc['title']} over {bed['title']}",
        "author": {"name": author_name, "key": author_key},
        "created": _today(),
        "license": "LICENSE-CODE",
        "note": (f"Drafted by `remix.py pair` from catalog metadata alone: a "
                 f"{bars}-bar window of {bed['title']} that carries no vocal, "
                 f"hosting {voc['title']}'s longest sung passage, warped "
                 f"{(ratio - 1) * 100:+.1f}% onto {bpm:.2f} BPM."),
        "grid": {"bpm": round(bpm, 3), "beatsPerBar": BEATS_PER_BAR,
                 "bars": bars, "key": (bed.get("mix") or {}).get("key")},
        "sources": {
            "bed": {"sha256": bed["sha256"], "title": bed["title"], "file": bed["file"]},
            "top": {"sha256": voc["sha256"], "title": voc["title"], "file": voc["file"]},
        },
        "lanes": [
            {"id": "bed-drums", "source": "bed", "stem": "drums"},
            {"id": "bed-bass", "source": "bed", "stem": "bass"},
            {"id": "bed-other", "source": "bed", "stem": "other"},
            {"id": "top-vocals", "source": "top", "stem": "vocals"},
        ],
        "clips": [
            {"lane": "bed-drums", "from": {"bar": bed_bar}, "beats": bars * BEATS_PER_BAR,
             "at": {"bar": 1}, "fade": {"in": 4, "out": 8}},
            {"lane": "bed-bass", "from": {"bar": bed_bar}, "beats": bars * BEATS_PER_BAR,
             "at": {"bar": 1}, "fade": {"in": 4, "out": 8}},
            {"lane": "bed-other", "from": {"bar": bed_bar}, "beats": bars * BEATS_PER_BAR,
             "at": {"bar": 1}, "gain": -2.0, "fade": {"in": 8, "out": 8}},
            {"lane": "top-vocals", "from": {"bar": voc_bar}, "beats": bars * BEATS_PER_BAR,
             "at": {"bar": 1}, "warp": True, "fade": {"in": 1, "out": 4}},
        ],
        "parents": [f"sha256:{bed['sha256']}", f"sha256:{voc['sha256']}"],
        "publish": {"audio": False, "commercial": False},
    }
    return manifest


# ---------------------------------------------------------------- intake

def intake_declaration(path, origin, key, catalog, note="", generator=None, prompt=None):
    """An origin declaration for audio arriving from outside the label.

    You cannot make a rights problem go away with a hash. What you CAN do is
    make every claim attributable, dated, and non-repudiable: a human signs a
    statement about where a file came from and what they believe they hold. If
    the claim is later wrong, the record shows exactly who said what and when,
    and the grant that depends on it can be revoked. That is what a label's
    paperwork has always been; this is the same paperwork with a signature that
    a script can check.

    Note plainly what this does NOT do: it does not verify the claim, and no
    fingerprint can tell you whether a generated track is a melodic copy of
    something it was trained on. Screening against the catalog catches
    re-uploads of our own material. That is the honest limit."""
    p = Path(path)
    if not p.exists():
        die(f"{p} does not exist")
    sha = hashlib.sha256(p.read_bytes()).hexdigest()
    clash = next((t for _, t in tracks(catalog) if t.get("sha256") == sha), None)
    decl = {
        "declaration": 1,
        "work": f"sha256:{sha}",
        "filename": p.name,
        "bytes": p.stat().st_size,
        "origin": origin,
        "declared": _today(),
        "declarer": key,
        "statement": (
            "I obtained or created this recording as described in `origin`. To the "
            "best of my knowledge I hold the rights I am granting, I am not "
            "knowingly reproducing anyone else's recording, and I accept that this "
            "declaration is the basis on which the label accepts the work."),
        "screened": {
            "against": "docs/catalog.json",
            "exact_duplicate": bool(clash),
            "duplicate_of": clash["title"] if clash else None,
            "perceptual": "run `fingerprint.py check --against dna/` — not done here",
        },
    }
    if generator:
        decl["generator"] = generator
    if prompt is not None:
        # the prompt itself may be private; commit only its hash unless the
        # author chooses otherwise. A hash still proves later that a given
        # prompt was the one used.
        decl["prompt_sha256"] = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    if note:
        decl["note"] = note
    return decl, sha


# ---------------------------------------------------------------- selftest

def selftest(verbose=True):
    ok_all = True

    def check(name, cond):
        nonlocal ok_all
        ok_all = ok_all and bool(cond)
        if verbose:
            print(f"  {'ok  ' if cond else 'FAIL'}  {name}")

    check("bar 1 is the downbeat", abs(bar_to_seconds(120.0, 2.0, 1) - 2.0) < 1e-9)
    check("bar 3 at 120bpm is 4s later", abs(bar_to_seconds(120.0, 2.0, 3) - 6.0) < 1e-9)
    check("bars round-trip", abs(seconds_to_bar(120.0, 2.0, bar_to_seconds(120.0, 2.0, 9)) - 9) < 1e-9)
    check("camelot: same key", camelot_compatible("8A", "8A"))
    check("camelot: neighbour", camelot_compatible("8A", "9A") and camelot_compatible("12A", "1A"))
    check("camelot: relative", camelot_compatible("8A", "8B"))
    check("camelot: unrelated", not camelot_compatible("8A", "3B"))
    check("camelot: nonsense", not camelot_compatible("", "8A"))
    check("tempo folds half-time", abs(tempo_ratio(140.0, 70.0) - 1.0) < 1e-9)
    check("tempo ratio stretches up", abs(tempo_ratio(128.0, 124.0) - 128 / 124) < 1e-9)

    env = [0.0] * 24 + [0.9] * 60 + [0.0] * 24
    quiet = envelope_windows(env, 0.12, 1.0, want="quiet")
    loud = envelope_windows(env, 0.45, 1.0, want="loud")
    check("envelope finds the hole", len(quiet) == 2 and abs(quiet[0][1] - 2.0) < 1e-9)
    check("envelope finds the voice", len(loud) == 1 and abs(loud[0][0] - 2.0) < 1e-9)
    check("envelope respects the minimum", envelope_windows(env, 0.45, 60.0) == [])

    m = {
        "dna": 1, "id": "t", "title": "t", "author": {"name": "x", "key": "k"},
        "grid": {"bpm": 120}, "sources": {"a": {}, "b": {}},
        "lanes": [{"id": "l1", "source": "a", "stem": "vocals"},
                  {"id": "l2", "source": "b", "stem": "full"}],
        "clips": [{"lane": "l1", "beats": 16, "warp": True},
                  {"lane": "l2", "beats": 16, "semitones": 2}],
    }
    need = required_permits(m)
    check("permits inferred from the score", need ==
          {"excerpt", "publish-score", "separate", "layer", "timestretch", "pitchshift"})
    check("render-public is not implied", "render-public" not in need)
    per = per_source_permits(m)
    check("source a needs separate, b does not",
          "separate" in per["a"] and "separate" not in per["b"])
    check("pitchshift lands on b only",
          "pitchshift" in per["b"] and "pitchshift" not in per["a"])

    check("union of disjoint spans adds up", _union_length([(0, 4), (8, 12)]) == 8)
    check("union of overlapping spans does not double count",
          _union_length([(0, 8), (4, 12)]) == 12)
    check("union of identical spans counts once",
          _union_length([(0, 8), (0, 8), (0, 8)]) == 8)
    check("union of nested spans", _union_length([(0, 16), (4, 8)]) == 16)
    check("union of nothing is nothing", _union_length([]) == 0.0)

    sp = splits({"grid": {"bpm": 120}, "author": {"name": "a", "key": "k"},
                 "sources": {"x": {"title": "X"}, "y": {"title": "Y"}},
                 "lanes": [{"id": "x1", "source": "x", "stem": "drums"},
                           {"id": "x2", "source": "x", "stem": "bass"},
                           {"id": "y1", "source": "y", "stem": "vocals"}],
                 "clips": [{"lane": "x1", "at": {"bar": 1}, "beats": 64},
                           {"lane": "x2", "at": {"bar": 1}, "beats": 64},
                           {"lane": "y1", "at": {"bar": 1}, "beats": 64}]}, None, 0.5)
    check("splits do not reward being separated into more lanes",
          abs(sp[1]["share"] - sp[2]["share"]) < 1e-9)
    check("splits sum to one", abs(sum(r["share"] for r in sp) - 1.0) < 1e-9)

    secret = hashlib.sha256(b"remix selftest").digest()
    pub = signing.enc(signing.public_from_secret(secret))
    g = make_grant("ab" * 32, "T", pub, ["excerpt", "publish-score"], "LICENSE-AUDIO")
    g["sig"] = signing.sign_obj(g, secret)
    trust = {pub: "selftest"}
    check("grant verifies for what it permits",
          check_grant(g, "ab" * 32, {"excerpt"}, trust) == [])
    check("grant refuses what it does not permit",
          check_grant(g, "ab" * 32, {"separate"}, trust) != [])
    check("grant refuses another work",
          check_grant(g, "cd" * 32, {"excerpt"}, trust) != [])
    check("grant refuses an untrusted issuer",
          check_grant(g, "ab" * 32, {"excerpt"}, {}) != [])
    tampered = dict(g, permits=["excerpt", "publish-score", "commercial"])
    check("widening the permits breaks the signature",
          check_grant(tampered, "ab" * 32, {"commercial"}, trust) != [])
    expired = make_grant("ab" * 32, "T", pub, ["excerpt"], "L", expires="2020-01-01")
    expired["sig"] = signing.sign_obj(expired, secret)
    check("expiry is honoured",
          check_grant(expired, "ab" * 32, {"excerpt"}, trust, as_of="2026-01-01") != [])
    check("expiry is relative to the date asked about",
          check_grant(expired, "ab" * 32, {"excerpt"}, trust, as_of="2019-06-01") == [])

    wildcard = make_grant("*", "whole catalog", pub, ["excerpt", "publish-score"], "L")
    wildcard["sig"] = signing.sign_obj(wildcard, secret)
    check("a catalog-wide grant covers any work",
          check_grant(wildcard, "ff" * 32, {"excerpt"}, trust) == [])

    return ok_all


# ---------------------------------------------------------------- reporting

def print_report(log, path=""):
    icon = {"ok": "  ok  ", "warn": "  ??  ", "fail": " FAIL "}
    if path:
        print(f"\n{path}")
    for level, msg in log:
        print(f"{icon[level]}{msg}")
    fails = sum(1 for l, _ in log if l == "fail")
    warns = sum(1 for l, _ in log if l == "warn")
    print(f"        {'REJECTED' if fails else 'accepted'} · "
          f"{fails} failure{'s' * (fails != 1)}, {warns} unproven")
    return fails == 0


# ---------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser(
        description=__doc__.split("\n")[0],
        epilog="the score is open, the sound is not — see REMIX.md",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--catalog", default=str(CATALOG))
    ap.add_argument("--trust", default=str(TRUST))
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("grant", help="issue a signed remix grant")
    g.add_argument("--work", help="track ref, or * for the whole catalog")
    g.add_argument("--key", required=True, help="path to the issuer's .key")
    g.add_argument("--permits", nargs="+", default=["excerpt", "separate", "layer",
                                                    "timestretch", "publish-score"],
                   choices=sorted(PERMITS), metavar="PERMIT",
                   help="one or more of: " + ", ".join(sorted(PERMITS)))
    g.add_argument("--terms", default="LICENSE-AUDIO · remix grant")
    g.add_argument("--expires", default=None, help="YYYY-MM-DD")
    g.add_argument("--note", default="")
    g.add_argument("--out", default=None)

    v = sub.add_parser("verify", help="the gate CI runs")
    v.add_argument("manifests", nargs="+")
    v.add_argument("--check-receipts", action="store_true",
                   help="re-derive stems and compare fingerprints (needs audio)")
    v.add_argument("--stems", default=str(STEMS_BUILD),
                   help="where the render script left the separated stems")
    v.add_argument("--as-of", default=None, help="date to judge expiry against")
    v.add_argument("--json", action="store_true")

    c = sub.add_parser("compile", help="flatten to an absolute-time timeline")
    c.add_argument("manifest")
    c.add_argument("--out", default=None)

    r = sub.add_parser("render", help="write a build script (does not run it)")
    r.add_argument("manifest")
    r.add_argument("--out", default="build")
    r.add_argument("--write", default=None, help="path for the script")

    s = sub.add_parser("splits", help="credit shares implied by the arrangement")
    s.add_argument("manifest")
    s.add_argument("--arranger", type=float, default=0.5)

    q = sub.add_parser("suggest", help="search the DNA for usable material")
    q.add_argument("--instrumental", action="store_true")
    q.add_argument("--acapella", action="store_true")
    q.add_argument("--with", dest="with_track", help="tracks compatible with this one")
    q.add_argument("--bars", type=int, default=8)
    q.add_argument("--limit", type=int, default=15)

    p = sub.add_parser("pair", help="draft a mashup from catalog metadata alone")
    p.add_argument("bed", help="track providing the instrumental")
    p.add_argument("top", help="track providing the vocal")
    p.add_argument("--bars", type=int, default=16)
    p.add_argument("--name", default="")
    p.add_argument("--key", default=None, help="path to your .key (signs the draft)")
    p.add_argument("--out", default=None, help="directory to write remix.json into")

    i = sub.add_parser("intake", help="declare the origin of audio from outside")
    i.add_argument("file")
    i.add_argument("--origin", required=True,
                   help="e.g. 'generated', 'recorded', 'licensed'")
    i.add_argument("--generator", default=None, help="e.g. suno-v4, udio, our own")
    i.add_argument("--prompt", default=None, help="hashed, not stored in the clear")
    i.add_argument("--key", required=True)
    i.add_argument("--note", default="")
    i.add_argument("--out", default=None)

    rc = sub.add_parser("receipt", help="fingerprint the separated stems into dna/")
    rc.add_argument("manifest")
    rc.add_argument("--stems", default=str(STEMS_BUILD))
    rc.add_argument("--model", default="htdemucs")
    rc.add_argument("--key", default=None, help="re-sign the manifest afterwards")

    sub.add_parser("selftest", help="the arithmetic, the permits, the grants")
    a = ap.parse_args(argv)

    if a.cmd == "selftest":
        print("remix.py selftest")
        okk = selftest()
        print("\nsigning.py selftest")
        okk = signing.selftest() and okk
        print("\n" + ("all good" if okk else "FAILURES — do not ship"))
        return 0 if okk else 1

    trust = signing.load_trust(a.trust)

    if a.cmd == "grant":
        secret = signing.read_secret(a.key)
        issuer = signing.enc(signing.public_from_secret(secret))
        if a.work == "*":
            work_sha, title = "*", "(entire catalog)"
        else:
            catalog = load_catalog(a.catalog)
            _, t = find_track(catalog, a.work)
            work_sha, title = t["sha256"], t["title"]
        grant = make_grant(work_sha, title, issuer, a.permits, a.terms, a.expires, a.note)
        grant["sig"] = signing.sign_obj(grant, secret)
        out = Path(a.out) if a.out else grant_path_for(
            work_sha if work_sha != "*" else "catalog0000", issuer)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(grant, indent=2) + "\n")
        print(f"{out}\n  work    {grant['work']}  {title}"
              f"\n  issuer  {signing.keyid(issuer)}"
              f"\n  permits {', '.join(grant['permits'])}")
        if issuer not in trust:
            print(f"\n  note: {a.trust} does not list this key yet, so `verify` will "
                  f"reject\n        grants it issues. Add:\n          {issuer}  <your name>")
        return 0

    if a.cmd == "verify":
        catalog = load_catalog(a.catalog)
        results, all_ok = [], True
        for path in a.manifests:
            manifest = json.loads(Path(path).read_text())
            good, log = verify(manifest, catalog, trust, as_of=a.as_of,
                               check_receipts=a.check_receipts, stems_dir=a.stems)
            all_ok = all_ok and good
            results.append({"path": path, "ok": good,
                            "log": [{"level": l, "message": m} for l, m in log]})
            if not a.json:
                print_report(log, path)
        if a.json:
            print(json.dumps({"ok": all_ok, "results": results}, indent=2))
        return 0 if all_ok else 1

    if a.cmd in ("compile", "render", "splits"):
        catalog = load_catalog(a.catalog)
        manifest = json.loads(Path(a.manifest).read_text())

        if a.cmd == "compile":
            tl = compile_timeline(manifest, catalog)
            text = json.dumps(tl, indent=2)
            if a.out:
                Path(a.out).write_text(text + "\n")
                print(f"{a.out} · {len(tl['events'])} events, {tl['duration']:.1f}s")
            else:
                print(text)
            return 0

        if a.cmd == "render":
            script = render_plan(manifest, catalog, a.out)
            if a.write:
                Path(a.write).write_text(script)
                Path(a.write).chmod(0o755)
                print(f"{a.write} — read it, then run it")
            else:
                print(script)
            return 0

        rows = splits(manifest, catalog, a.arranger)
        print(f"{manifest['title']}\n")
        for r in rows:
            print(f"  {r['share'] * 100:5.1f}%  {r['title'][:44].ljust(46)}"
                  f"{r['role']}" + (f"  ({r['beats']:.0f} beats)" if r["beats"] else ""))
        print(f"\n  {sum(r['share'] for r in rows) * 100:5.1f}%  total")
        print("\n  A proposal computed from the arrangement, not an agreement.")
        return 0

    if a.cmd == "receipt":
        catalog = load_catalog(a.catalog)
        path = Path(a.manifest)
        manifest = json.loads(path.read_text())
        written = write_receipts(manifest, catalog, a.stems, a.model)
        if a.key:
            manifest["sig"] = signing.sign_obj(manifest, signing.read_secret(a.key))
        else:
            manifest.pop("sig", None)
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        for w in written:
            print(f"  {w.relative_to(ROOT)}  {w.stat().st_size // 1024} KB")
        print(f"\n{path} updated with {len(written)} receipts.")
        print("  Adding a receipt changes the manifest, so the old signature is gone."
              + ("" if a.key else "  Re-sign it:\n"
                 f"    python3 signing.py sign {path} --key keys/you.key"))
        return 0

    if a.cmd == "suggest":
        catalog = load_catalog(a.catalog)
        if a.with_track:
            _, t = find_track(catalog, a.with_track)
            print(f"compatible with {t['title']} "
                  f"({(t.get('mix') or {}).get('key')}, {(t.get('mix') or {}).get('bpm')} bpm)\n")
            for r in compatible(catalog, t, a.limit):
                print(f"  {r['sha256'][:10]}  {r['key'] or '--':>3}  {r['bpm']:6.1f}  "
                      f"{r['stretch']:>7}  {'stems' if r['has_stems'] else '     '}  {r['title'][:40]}")
            return 0
        kind = "acapella" if a.acapella else "instrumental"
        print(f"{kind} windows of at least {a.bars} bars\n")
        for r in suggest_windows(catalog, kind, a.bars, a.limit):
            print(f"  {r['sha256'][:10]}  {r['key'] or '--':>3}  {r['bpm']:6.1f}  "
                  f"bar {r['from']:>6.1f} + {r['bars']:>5.1f} bars   {r['title'][:38]}")
        return 0

    if a.cmd == "pair":
        catalog = load_catalog(a.catalog)
        key_text = "ed25519:" + "A" * 43 + "="
        if a.key:
            key_text = signing.enc(signing.public_from_secret(signing.read_secret(a.key)))
        manifest = pair(catalog, a.bed, a.top, a.name or "unsigned draft", key_text, a.bars)
        if a.key:
            manifest["sig"] = signing.sign_obj(manifest, signing.read_secret(a.key))
        text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
        if a.out:
            d = Path(a.out)
            d.mkdir(parents=True, exist_ok=True)
            (d / "remix.json").write_text(text)
            print(f"{d / 'remix.json'}\n\n{manifest['note']}")
        else:
            print(text)
        return 0

    if a.cmd == "intake":
        catalog = load_catalog(a.catalog)
        secret = signing.read_secret(a.key)
        declarer = signing.enc(signing.public_from_secret(secret))
        decl, sha = intake_declaration(a.file, a.origin, declarer, catalog,
                                       a.note, a.generator, a.prompt)
        decl["sig"] = signing.sign_obj(decl, secret)
        out = Path(a.out) if a.out else GRANTS / f"declaration-{sha[:12]}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(decl, indent=2) + "\n")
        print(f"{out}\n  work      sha256:{sha}"
              f"\n  origin    {a.origin}" + (f" · {a.generator}" if a.generator else "") +
              f"\n  declarer  {signing.keyid(declarer)}")
        if decl["screened"]["exact_duplicate"]:
            print(f"\n  STOP: byte-identical to {decl['screened']['duplicate_of']!r} "
                  f"already in the catalog.")
        print("\n  Next: fingerprint.py check for near-duplicates, then issue a grant\n"
              "  so the label may actually use it:\n"
              f"    python3 fingerprint.py check {a.file} --against dna/\n"
              f"    python3 remix.py grant --work {sha[:12]} --key {a.key}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
