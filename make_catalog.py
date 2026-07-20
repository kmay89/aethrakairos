#!/usr/bin/env python3
"""make_catalog.py — build docs/catalog.json (schema v2) for the Möbius⁸
distribution build. Add music forever without thinking: one idempotent loop,
duplicate-proof at three levels.

  Level 1 (ingest)     lives in the wizard: its SHA-256 IndexedDB ledger
                       catches exact re-drops across sessions.
  Level 2 (catalog)    this script hashes every file. A hash already in the
                       catalog under a different path is a MOVE, not an add —
                       path updates, `published` survives, DNA references stay
                       intact. A hash already present at the same path is a
                       no-op. Two entries with one hash cannot be emitted.
  Level 3 (perceptual) the Haitsma–Kalker gate (fingerprint.py) runs on every
                       NEW hash. A CLONE verdict against the existing library
                       refuses the add by name; --force overrides and stamps
                       the override into the catalog entry so honesty survives.

Features come from the wizard's JSON report when one sits in the album folder
(wizard-report.json), else from features.py. Both cache raw measures into
features-cache.json keyed by SHA-256. The 0–1 normalization is recomputed over
the whole catalog every build, so the space stays calibrated as it grows.

Masters never enter the public repo: any .wav under audio/ fails the build
loudly. The masters directory is read, web MP3s are copied into
audio/<album-tag>/, and the WAVs stay where they are.

Usage:
  make_catalog.py MASTERS_DIR --repo USER/REPO [--artist A] [--label L] [--force]
  make_catalog.py doctor [--samples N] [--no-net]

`doctor` is the monthly once-over: schema, mandatory fields, art, duplicate
hashes, fingerprint-index currency, sampled CORS/Range probes, size budgets.
Nonzero exit on any failure so it can gate publish.sh.
"""

import argparse
import datetime as _dt
import gzip
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.request
from pathlib import Path

import fingerprint as fpmod
import features as ftmod

SCHEMA_VERSION = 2
AUDIO_EXTS = {".mp3"}                      # the public tree carries web MP3s only
MASTER_EXTS = {".wav", ".aif", ".aiff", ".flac"}
INGEST_EXTS = {".wav", ".m4a", ".aif", ".aiff", ".flac"}   # welcome in masters/ — converted on the way in
ART_NAMES = ("cover", "folder", "front", "art")
ART_EXTS = (".jpg", ".jpeg", ".png", ".webp")
CATALOG_PATH = Path("docs/catalog.json")
CACHE_PATH = Path("features-cache.json")
AUDIO_ROOT = Path("docs/audio")           # inside docs/: Pages serves it same-origin
DNA_ROOT = Path("dna")
# §9's original 500 KB budget predates THE SCORE: every real track now ships
# ~3 KB (gz) of 12 Hz band envelopes so graphless platforms (iOS) dance to
# truth. A few hundred real tracks land near 1 MB; the ceiling below keeps an
# honest alarm. Past it, the graduation path is per-track score sidecars
# fetched on play — not fatter catalogs.
CATALOG_BUDGET_GZ = 1536 * 1024


# ---------------------------------------------------------------- helpers

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slug(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "untitled"


def clean_name(name):
    n = re.sub(r"\.[a-z0-9]{2,5}$", "", str(name), flags=re.I)
    n = re.sub(r"^\d{1,3}[-_. ]+", "", n)
    n = re.sub(r"[_]+", " ", n)
    n = re.sub(r"\s{2,}", " ", n).strip()
    return n or "Untitled"


def today():
    return _dt.date.today().isoformat()


def tidy_title(s):
    """Gentle title hygiene: unicode normalized, control characters and
    underscores out, whitespace collapsed, stray edge punctuation trimmed.
    Never rewrites words — 'Final Countdown' keeps its Final."""
    s = unicodedata.normalize("NFC", str(s))
    s = "".join(c for c in s if unicodedata.category(c)[0] != "C")
    s = s.replace("_", " ")
    s = re.sub(r"\s{2,}", " ", s).strip()
    s = s.strip(" -–—.·")
    return s or "Untitled"


def created_date(path):
    """The day the song was made, as best the file can tell: the earliest
    sane timestamp it carries (birth time where the OS records one, else
    modification time). The label's progression lives in these dates, so
    they are read from the files, not invented — anything insane (epoch,
    the future) falls back to today."""
    st = os.stat(path)
    cands = [st.st_mtime]
    bt = getattr(st, "st_birthtime", None)
    if bt:
        cands.append(bt)
    ts = min(c for c in cands if c and c > 0) if any(c and c > 0 for c in cands) else None
    if ts is None:
        return today()
    d = _dt.date.fromtimestamp(ts)
    if _dt.date(2000, 1, 1) <= d <= _dt.date.today():
        return d.isoformat()
    return today()


def fail(msg):
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------- ID3 (tags only)

def _syncsafe(b):
    return (b[0] & 127) << 21 | (b[1] & 127) << 14 | (b[2] & 127) << 7 | (b[3] & 127)


def _dec(b, enc):
    try:
        if enc == 0:
            return b.decode("latin-1")
        if enc == 3:
            return b.decode("utf-8")
        if enc == 2:
            return b.decode("utf-16-be")
        return b.decode("utf-16")
    except UnicodeDecodeError:
        return b.decode("latin-1", errors="replace")


def id3_parse(path):
    """Minimal ID3v2 reader: title/artist/album/year/track/genre + APIC bytes."""
    out = {"title": "", "artist": "", "album": "", "year": "", "track": "",
           "genre": "", "art": None, "art_mime": ""}
    with open(path, "rb") as f:
        head = f.read(10)
        if len(head) < 10 or head[:3] != b"ID3":
            return out
        ver = head[3]
        size = _syncsafe(head[6:10])
        body = f.read(size)
    p = 0
    if head[5] & 0x40 and len(body) >= 4:  # extended header
        p = (_syncsafe(body[0:4]) if ver == 4
             else int.from_bytes(body[0:4], "big") + 4)
    while p + 10 <= len(body):
        fid = body[p:p + 4]
        if not re.match(rb"^[A-Z0-9]{4}$", fid):
            break
        sz = (_syncsafe(body[p + 4:p + 8]) if ver == 4
              else int.from_bytes(body[p + 4:p + 8], "big"))
        fb = body[p + 10:p + 10 + sz]
        p += 10 + sz
        if not sz:
            continue
        fid = fid.decode()
        def text():
            return _dec(fb[1:], fb[0]).rstrip("\x00").lstrip("﻿")
        if fid == "TIT2":
            out["title"] = text()
        elif fid == "TPE1":
            out["artist"] = text()
        elif fid == "TALB":
            out["album"] = text()
        elif fid in ("TYER", "TDRC"):
            out["year"] = text()[:4]
        elif fid == "TRCK":
            out["track"] = text().split("/")[0]
        elif fid == "TCON":
            out["genre"] = re.sub(r"^\(\d+\)", "", text())
        elif fid == "APIC" and out["art"] is None:
            # a malformed frame (missing null terminators) skips the art,
            # never the build
            enc = fb[0]
            i = fb.find(b"\x00", 1)
            if i == -1:
                continue
            out["art_mime"] = _dec(fb[1:i], 0)
            i += 2  # 0x00 + picture type
            if enc in (1, 2):
                while i + 1 < len(fb) and (fb[i] or fb[i + 1]):
                    i += 2
                i += 2
            else:
                j = fb.find(b"\x00", i)
                if j == -1:
                    continue
                i = j + 1
            if i < len(fb):
                out["art"] = fb[i:]
    return out


# ---------------------------------------------------------------- feature cache

def load_cache():
    if CACHE_PATH.exists():
        try:
            c = json.loads(CACHE_PATH.read_text())
            if c.get("v") == ftmod.FEATURES_VERSION:
                return c
        except json.JSONDecodeError:
            pass
    return {"v": ftmod.FEATURES_VERSION, "by_sha": {}}


def raw_features_for(sha, path, cache, wizard_features=None):
    """Wizard report → cache → features.py, in that order. Cached raws win.
    Entries cached before the mix engine existed are upgraded in place —
    one extra decode adds the mix block without recomputing loudness."""
    hit = cache["by_sha"].get(sha)
    if hit:
        mix = hit.get("mix")
        if not isinstance(mix, dict) or mix.get("v") != ftmod.MIX_VERSION:
            hit["mix"] = ftmod.extract_mix_file(path)
        return hit, True
    if wizard_features and all(k in wizard_features for k in
                               ("lufs", "centroid", "entropy", "onset_rate", "bpm")):
        raw = dict(wizard_features)
        raw["v"] = ftmod.FEATURES_VERSION
        if not isinstance(raw.get("mix"), dict):
            raw["mix"] = ftmod.extract_mix_file(path)
    else:
        raw = ftmod.extract(path)
    cache["by_sha"][sha] = raw
    return raw, False


def load_mixfix():
    """mixfix.json — corrections exported from the player's mix tuner,
    graduated to canon: {grids: {sha: deltaSeconds}, pairs: {"shaA|shaB":
    {type, beats?, offsetBeats?}}}. Grid deltas are applied to each track's
    mix block; pair overrides ride the catalog for every device to inherit."""
    p = Path("mixfix.json")
    if not p.exists():
        return {"grids": {}, "pairs": {}}
    try:
        fx = json.loads(p.read_text(encoding="utf-8"))
        return {"grids": dict(fx.get("grids", {})), "pairs": dict(fx.get("pairs", {}))}
    except (json.JSONDecodeError, OSError, UnicodeDecodeError):
        print("  ! mixfix.json is unreadable — ignoring")
        return {"grids": {}, "pairs": {}}


def load_wizard_report(album_dir):
    """wizard-report.json in an album folder: {tracks:[{file, sha256, features?}]}"""
    rp = album_dir / "wizard-report.json"
    if not rp.exists():
        return {}
    try:
        rep = json.loads(rp.read_text())
    except json.JSONDecodeError:
        print(f"  ! unreadable wizard report in {album_dir.name} — ignoring")
        return {}
    out = {}
    for t in rep.get("tracks", []):
        if t.get("sha256") and isinstance(t.get("features"), dict):
            out[t["sha256"]] = t["features"]
    return out


# ---------------------------------------------------------------- build

def refuse_wavs_in_audio():
    if not AUDIO_ROOT.exists():
        return
    wavs = [p for p in AUDIO_ROOT.rglob("*") if p.suffix.lower() in MASTER_EXTS]
    if wavs:
        for w in wavs:
            print(f"  ✗ MASTER IN PUBLIC TREE: {w}", file=sys.stderr)
        fail(f"{len(wavs)} master file(s) inside {AUDIO_ROOT}/ — masters never "
             "enter the public repo. Move them out and rebuild.")


def load_existing_catalog():
    if not CATALOG_PATH.exists():
        return None
    try:
        cat = json.loads(CATALOG_PATH.read_text())
    except json.JSONDecodeError:
        print("  ! existing catalog.json is unreadable — starting fresh")
        return None
    if cat.get("version") != SCHEMA_VERSION:
        print(f"  ! existing catalog is schema v{cat.get('version')} — "
              "entries carry over where hashes match")
    return cat


def existing_by_sha(cat):
    out = {}
    if not cat:
        return out
    for al in cat.get("albums", []):
        for tr in al.get("tracks", []):
            if tr.get("sha256"):
                out[tr["sha256"]] = {"album_tag": al.get("tag"), "track": tr}
    return out


def _ffmpeg():
    return os.environ.get("MB8_FFMPEG") or shutil.which("ffmpeg")


def convert_masters(masters_dir):
    """The inbox takes songs AS THEY ARE: WAV, M4A (iTunes/Music AAC),
    AIFF or FLAC dropped into masters/ become 320k web MP3s in place, tags
    carried over. A same-stem .mp3 already sitting beside a source wins —
    the source is left alone. Originals never leave masters/ (which never
    leaves the machine), so re-runs skip everything already converted."""
    masters_dir = Path(masters_dir)
    if not masters_dir.is_dir():
        return
    srcs = sorted(p for p in masters_dir.rglob("*")
                  if p.is_file() and p.suffix.lower() in INGEST_EXTS)
    if not srcs:
        return
    ff = _ffmpeg()
    if not ff:
        fail("masters/ holds WAV/M4A/AIFF/FLAC files but ffmpeg is not on "
             "PATH — install it (brew install ffmpeg) so they can become "
             "web MP3s")
    for src in srcs:
        dst = src.with_suffix(".mp3")
        if dst.exists():
            print(f"  = {src.name}: an .mp3 twin sits beside it — using the mp3")
            continue
        r = subprocess.run(
            [ff, "-nostdin", "-loglevel", "error", "-i", str(src),
             "-map_metadata", "0", "-id3v2_version", "3", "-vn",
             "-codec:a", "libmp3lame", "-b:a", "320k", str(dst)],
            capture_output=True, text=True)
        if r.returncode != 0 or not dst.exists():
            dst.unlink(missing_ok=True)
            tail = r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "ffmpeg failed"
            fail(f"could not convert {src.name} to MP3: {tail}")
        # the mp3 inherits the source's file times — the publish date reads
        # the day the song was MADE, and conversion must not erase it
        shutil.copystat(src, dst)
        print(f"  ♫ converted: {src.name} → {dst.name} (320k web MP3)")


def sweep_orphans(prior_cat):
    """Self-healing after an interrupted run. A build that dies mid-way
    (Ctrl-C, power, anything) leaves copied audio and fingerprints that the
    catalog never learned about — and the next run's clone gate would read
    the artist's OWN library as clones of those ghosts, refusing every
    track. The catalog is the only owner of the public tree: anything under
    docs/audio it does not list is an orphan and is swept before gating.
    Masters is the source of truth — swept files re-enter cleanly."""
    if not AUDIO_ROOT.exists():
        return
    owned = set()
    for al in (prior_cat or {}).get("albums", []):
        for tr in al.get("tracks", []):
            if al.get("tag") and tr.get("file"):
                owned.add(f"{al['tag']}/{tr['file']}")
    swept = 0
    for p in sorted(AUDIO_ROOT.rglob("*.mp3")):
        rel = p.relative_to(AUDIO_ROOT).as_posix()
        if rel in owned:
            continue
        p.unlink()
        fpf = DNA_ROOT / (rel + ".fp")
        if fpf.exists():
            fpf.unlink()
        swept += 1
    if swept:
        print(f"  − swept {swept} orphaned file(s) left by an interrupted "
              "run — the catalog never published them; they re-enter "
              "cleanly from masters")


def ask_clone(src, new_title, matched, old, ber):
    """Same song, two names — spell out exactly which is which before the
    label picks. Every option names the title it acts on, and the choice
    is echoed back so there is never a doubt about what was decided.
    A CAPITAL answer applies the choice to every remaining duplicate.
    Returns (choice, applies_to_all)."""
    old_title = old["track"].get("title") or Path(matched).name if old else Path(matched).name
    old_date = (old["track"].get("published") or "unknown date") if old else "not in the catalog"
    print(f"\n  ⚠ same song, two names (window BER {ber}):")
    print(f"      NEW file  : {src.name} — would publish as “{new_title}”")
    print(f"      PUBLISHED : “{old_title}” — {matched}, on the site since {old_date}")
    print(f"    [k] KEEP “{old_title}” — skip {src.name}   (default)")
    if old:
        print(f"    [n] NEW  — publish “{new_title}” and retire “{old_title}” "
              "(its publish date carries over)")
    print(f"    [b] BOTH — publish “{new_title}” alongside “{old_title}” as its own track")
    keys = "[k/n/b]" if old else "[k/b]"
    print(f"    (a CAPITAL letter — {'K/N/B' if old else 'K/B'} — applies "
          "that choice to EVERY remaining duplicate this run)")
    while True:
        a = input(f"    which name wins? {keys} ").strip()
        for_all = a.isupper() and a != ""
        a = a.lower()
        tail = " — and the same for all remaining duplicates" if for_all else ""
        if a in ("", "k"):
            print(f"    → keeping “{old_title}” — {src.name} skipped{tail}")
            return "keep", for_all
        if a == "n" and old:
            print(f"    → “{new_title}” takes over — “{old_title}” retires, "
                  f"publish date carries{tail}")
            return "use-new", for_all
        if a == "b":
            print(f"    → keeping both — “{new_title}” joins the catalog{tail}")
            return "both", for_all


def scan_masters(masters_dir):
    """Yield (album_dir, [mp3 paths sorted]) — one level of album folders;
    loose files at the root form an 'unfiled' album."""
    masters_dir = Path(masters_dir)
    if not masters_dir.is_dir():
        fail(f"masters directory not found: {masters_dir}")
    albums = []
    loose = sorted(p for p in masters_dir.iterdir()
                   if p.is_file() and p.suffix.lower() in AUDIO_EXTS)
    if loose:
        albums.append((masters_dir, loose))
    for d in sorted(p for p in masters_dir.iterdir() if p.is_dir()):
        mp3s = sorted(p for p in d.rglob("*") if p.suffix.lower() in AUDIO_EXTS)
        if mp3s:
            albums.append((d, mp3s))
    if not albums:
        fail(f"no publishable audio under {masters_dir} — drop MP3, WAV or "
             "M4A files (one folder per album); anything that isn't MP3 is "
             "converted on the way in")
    return albums


def majority(values):
    vals = [v for v in values if v]
    if not vals:
        return ""
    return max(set(vals), key=vals.count)


def pick_art(album_dir, tags_list, tag, dry=False):
    """Explicit cover file wins; else first embedded picture. Returns the
    art filename placed in audio/<tag>/ (or None)."""
    for name in ART_NAMES:
        for ext in ART_EXTS:
            src = album_dir / f"{name}{ext}"
            if src.exists():
                dst = AUDIO_ROOT / tag / f"cover{ext if ext != '.jpeg' else '.jpg'}"
                if not dry:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(src, dst)
                return dst.name
    for t in tags_list:
        if t.get("art"):
            ext = ".png" if "png" in t.get("art_mime", "") else ".jpg"
            dst = AUDIO_ROOT / tag / f"cover{ext}"
            if not dry:
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(t["art"])
            return dst.name
    return None


def build(args):
    refuse_wavs_in_audio()
    convert_masters(args.masters)
    prior_cat = load_existing_catalog()
    sweep_orphans(prior_cat)
    prior = existing_by_sha(prior_cat)
    cache = load_cache()
    mixfix = load_mixfix()
    force_notes = {}
    on_clone = "both" if args.force else args.on_clone
    replaced_shas = set()
    replaced_rels = set()
    used_names = {}                        # tag → filenames claimed this build

    # keep the fingerprint index current before gating new material
    if DNA_ROOT.exists() or AUDIO_ROOT.exists():
        AUDIO_ROOT.mkdir(exist_ok=True)
        fpmod.build_index(AUDIO_ROOT, DNA_ROOT, verbose=False)

    albums_out = []
    seen_sha = {}
    moves = adds = noops = refused = 0

    # THE FOLDER IS THE ALBUM. Where you put a song is your statement of
    # what album it belongs to — a stale iTunes album tag must never
    # override the drag. Loose files at the masters root are SINGLES:
    # each becomes its own one-track album named after the song, exactly
    # like the shipped starter singles.
    masters_root = Path(args.masters).resolve()
    scanned = []
    for album_dir, mp3s in scan_masters(args.masters):
        if Path(album_dir).resolve() == masters_root:
            scanned.extend((album_dir, [p], True) for p in mp3s)
        else:
            scanned.append((album_dir, mp3s, False))

    for album_dir, mp3s, is_single in scanned:
        tags_list = [id3_parse(p) for p in mp3s]
        wizard_feats = load_wizard_report(album_dir)

        album_title = (tidy_title(tags_list[0]["title"] or clean_name(mp3s[0].name))
                       if is_single else tidy_title(clean_name(album_dir.name)))
        tag = slug(album_title)
        genre = majority(t["genre"] for t in tags_list)
        years = [t["year"] for t in tags_list if re.match(r"^\d{4}$", t["year"] or "")]
        year = int(majority(years)) if years else None
        info_file = album_dir / "info.txt"
        info = "" if is_single else (
            info_file.read_text().strip() if info_file.exists() else "")

        tracks_out = []
        for order, (src, tags) in enumerate(zip(mp3s, tags_list), start=1):
            sha = sha256_file(src)
            if sha in seen_sha:
                print(f"  = duplicate in drop: {src.name} is byte-identical to "
                      f"{seen_sha[sha]} — skipped (one hash, one entry)")
                continue
            if sha in replaced_shas:
                print(f"  − skipped: {src.name} — its entry was replaced by "
                      "a new name this run")
                continue

            title = tidy_title(tags["title"] or clean_name(src.name))
            was = prior.get(sha)
            if was:
                # ---- level 2: known hash → no-op or move; never renumber
                filename = was["track"]["file"]
                used_names.setdefault(tag, set()).add(filename)
                published = was["track"].get("published", today())
                dest = AUDIO_ROOT / tag / filename
                if was["album_tag"] == tag and dest.exists():
                    noops += 1
                else:
                    old = AUDIO_ROOT / (was["album_tag"] or "") / filename
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    if old.exists() and old != dest:
                        shutil.move(str(old), str(dest))
                    elif not dest.exists():
                        shutil.copyfile(src, dest)
                    print(f"  → move: {filename} "
                          f"({was['album_tag']} → {tag}) — published date kept")
                    moves += 1
                entry_extra = {k: was["track"][k] for k in ("fingerprint_override",)
                               if k in was["track"]}
            else:
                # ---- level 3: new hash → perceptual gate before it may land
                num = tags["track"] if re.match(r"^\d+$", tags["track"] or "") else str(order)
                filename = f"{int(num):02d}-{slug(title)}.mp3"
                # the day the song was MADE, read from the file itself —
                # the catalog carries the artist's progression, not the
                # day of the drag-and-drop
                published = created_date(src)
                entry_extra = {}
                # two different songs must never share a public filename:
                # claim it, and step -2, -3… past anything already taken
                # this build or sitting on disk with different audio
                used = used_names.setdefault(tag, set())
                stem = filename[:-4]
                k = 1
                while True:
                    cand = filename if k == 1 else f"{stem}-{k}.mp3"
                    on_disk = AUDIO_ROOT / tag / cand
                    clash = cand in used or (on_disk.exists()
                                             and sha256_file(on_disk) != sha)
                    if not clash:
                        if k > 1:
                            print(f"  ~ name collision: {filename} is taken in "
                                  f"{tag} — using {cand}")
                        filename = cand
                        break
                    k += 1
                used.add(filename)
                if DNA_ROOT.exists() and any(DNA_ROOT.rglob("*.fp")):
                    cand_fp = fpmod.fingerprint_file_multi(src)
                    match_rel, r = fpmod.scan_library(cand_fp, AUDIO_ROOT, DNA_ROOT)
                    if r["verdict"] == "CLONE":
                        # same song, two names — the label decides which
                        # one the catalog keeps
                        old = next((v for v in prior.values()
                                    if f"{v['album_tag']}/{v['track']['file']}" == match_rel),
                                   None)
                        choice = on_clone
                        if choice == "ask":
                            if sys.stdin.isatty():
                                choice, for_all = ask_clone(
                                    src, title, match_rel, old, r["window_ber"])
                                if for_all:
                                    on_clone = choice   # sticky for the rest of the run
                            else:
                                choice = "keep"
                        if choice == "use-new" and old is None:
                            # matched audio is not a catalog entry (stray
                            # file) — nothing to replace; keep both instead
                            choice = "both"
                        if choice == "both":
                            entry_extra["fingerprint_override"] = {
                                "matched": match_rel, "window_ber": r["window_ber"],
                                "forced": today()}
                            print(f"  ! forced past the gate: {src.name} reads CLONE "
                                  f"of {match_rel} (window BER {r['window_ber']}) — "
                                  "override stamped into the catalog entry")
                        elif choice == "use-new":
                            published = old["track"].get("published", today())
                            replaced_shas.add(old["track"]["sha256"])
                            replaced_rels.add(match_rel)
                            entry_extra["fingerprint_override"] = {
                                "matched": match_rel, "window_ber": r["window_ber"],
                                "replaced": today()}
                            print(f"  ↺ new name wins: {src.name} replaces "
                                  f"{match_rel} — same song, publish date kept")
                        else:
                            print(f"  ✗ kept the existing one: {src.name} is a clone of "
                                  f"{match_rel} (window BER {r['window_ber']}). "
                                  "Re-run with --on-clone use-new to adopt the new "
                                  "name, or --on-clone both / --force to keep both.")
                            refused += 1
                            continue
                dest = AUDIO_ROOT / tag / filename
                dest.parent.mkdir(parents=True, exist_ok=True)
                if src.resolve() != dest.resolve():
                    shutil.copyfile(src, dest)
                adds += 1
                print(f"  + add: {tag}/{filename}")

            raw, cached = raw_features_for(sha, AUDIO_ROOT / tag / filename,
                                           cache, wizard_feats.get(sha))
            mix = dict(raw.get("mix") or {"v": ftmod.MIX_VERSION, "mixable": 0.0})
            delta = mixfix["grids"].get(sha)
            if delta is not None and "grid" in mix:
                mix["grid"] = round(float(mix["grid"]) + float(delta), 3)
                mix["gridFixed"] = True
            entry = {"title": title, "file": filename,
                     "duration": raw["duration"], "sha256": sha,
                     "published": published, "mix": mix, "_raw": raw}
            entry.update(entry_extra)
            if tags["artist"] and tags["artist"] != args.artist:
                entry["artist"] = tags["artist"]
            seen_sha[sha] = f"{tag}/{filename}"
            tracks_out.append(entry)

        if not tracks_out:
            continue
        # a single's art comes from its own embedded picture — a stray
        # cover.png at the masters root must not brand every single
        art = pick_art(album_dir if not is_single else album_dir / "__single__",
                       tags_list, tag)
        album = {"title": album_title, "tag": tag}
        if year:
            album["year"] = year
        if genre:
            album["genre"] = genre
        if art:
            album["art"] = art
        if info:
            album["info"] = info
        album["tracks"] = tracks_out
        albums_out.append(album)

    # ---- retire entries the label replaced with a new name this run:
    # their scan output drops, their public audio and fingerprint go
    if replaced_shas:
        for al in albums_out:
            kept = []
            for t in al["tracks"]:
                if t["sha256"] in replaced_shas:
                    print(f"  − retired: {al['tag']}/{t['file']} — replaced by the new name")
                else:
                    kept.append(t)
            al["tracks"] = kept
        albums_out = [al for al in albums_out if al["tracks"]]
        for rel in replaced_rels:
            old_audio = AUDIO_ROOT / rel
            if old_audio.exists():
                old_audio.unlink()
            old_fp = DNA_ROOT / Path(rel).with_suffix(Path(rel).suffix + ".fp")
            if old_fp.exists():
                old_fp.unlink()

    if not albums_out:
        fail("nothing publishable made it through the gates")

    # ---- catalog-wide normalization, re-emitted every build
    flat = [t for al in albums_out for t in al["tracks"]]
    normd = ftmod.normalize_catalog([t["_raw"] for t in flat])
    for t, feats in zip(flat, normd):
        t["features"] = feats
        # loudness normalization: gain in dB toward a -14 LUFS street level,
        # boost capped at +6 (headroom), cut at -12 (sanity). The player
        # applies it per deck; a hand-edited catalog without it plays at unity.
        lufs = t["_raw"].get("lufs")
        if isinstance(lufs, (int, float)) and lufs > -70:
            t["gain"] = round(max(-12.0, min(6.0, -14.0 - lufs)), 2)
        # the score: band envelopes for platforms that cannot analyse live
        if isinstance(t["_raw"].get("env"), dict):
            t["env"] = t["_raw"]["env"]
        del t["_raw"]

    # ---- mandatory-at-publish check (the player degrades; the build does not)
    for al in albums_out:
        for t in al["tracks"]:
            for field in ("duration", "sha256", "published", "features", "mix"):
                if not t.get(field):
                    fail(f"{al['tag']}/{t['file']} is missing mandatory field "
                         f"'{field}' — publish requires it")

    # Same-origin by default: the audio tree lives inside docs/ and GitHub
    # Pages serves both site and sound from one origin — no CORS, Range works,
    # and nobody hits raw.githubusercontent's 60-requests/hour/IP wall.
    # --base overrides for the day the heavy bytes graduate to a CDN.
    if args.repo:
        print("note: --repo no longer sets a raw.githubusercontent base "
              "(60 req/hr/IP since May 2025 — a listener trap); "
              "the catalog now defaults to the same-origin 'audio' tree. "
              "Use --base to point at a CDN instead.")
    base = args.base or "audio"

    # the license files must live inside the published tree to be linkable
    for lic in ("LICENSE-CODE", "LICENSE-AUDIO"):
        src = Path(lic)
        if src.exists():
            shutil.copy2(src, CATALOG_PATH.parent / lic)

    catalog = {
        "version": SCHEMA_VERSION,
        "label": args.label,
        "artist": args.artist,
        "license": {"code": "LICENSE-CODE", "audio": "LICENSE-AUDIO"},
        "base": base,
        "albums": albums_out,
    }
    if mixfix["pairs"]:
        catalog["mixfix"] = {"pairs": mixfix["pairs"]}
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + "\n")
    CACHE_PATH.write_text(json.dumps(cache, indent=0) + "\n")

    # refresh the fingerprint index so the next run gates against everything
    fpmod.build_index(AUDIO_ROOT, DNA_ROOT, verbose=False)

    n_tracks = len(flat)
    size = CATALOG_PATH.stat().st_size
    gz = len(gzip.compress(CATALOG_PATH.read_bytes()))
    print(f"\ncatalog: {len(albums_out)} albums, {n_tracks} tracks — "
          f"{adds} added, {moves} moved, {noops} unchanged, {refused} refused")
    print(f"docs/catalog.json: {size/1024:.0f} KB ({gz/1024:.0f} KB gzipped)")
    if refused and not args.force:
        print("note: refusals above are not in the catalog — that is the point")
    return 0


# ---------------------------------------------------------------- doctor

def probe_url(url, timeout=10):
    req = urllib.request.Request(url, method="GET", headers={
        "Origin": "https://example.com", "Range": "bytes=0-1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, {k.lower(): v for k, v in r.headers.items()}


def doctor(args):
    problems = []
    ok = lambda m: print(f"  ✓ {m}")
    bad = lambda m: (problems.append(m), print(f"  ✗ {m}"))

    print("doctor: the monthly once-over\n")
    if not CATALOG_PATH.exists():
        bad(f"{CATALOG_PATH} does not exist")
        return 1
    try:
        cat = json.loads(CATALOG_PATH.read_text())
    except json.JSONDecodeError as e:
        bad(f"catalog.json is not valid JSON: {e}")
        return 1

    if cat.get("version") != SCHEMA_VERSION:
        bad(f"schema version is {cat.get('version')}, expected {SCHEMA_VERSION}")
    else:
        ok(f"schema v{SCHEMA_VERSION}")
    for key in ("label", "artist", "base", "albums"):
        if not cat.get(key):
            bad(f"catalog missing '{key}'")
    if not isinstance(cat.get("license"), dict) or \
       not cat.get("license", {}).get("code") or not cat.get("license", {}).get("audio"):
        bad("catalog missing license links (code + audio)")
    else:
        ok("license links present")

    refuse = [p for p in AUDIO_ROOT.rglob("*")
              if p.suffix.lower() in MASTER_EXTS] if AUDIO_ROOT.exists() else []
    if refuse:
        bad(f"{len(refuse)} master file(s) under {AUDIO_ROOT}/ — e.g. {refuse[0]}")
    else:
        ok("no masters in the public tree")

    shas = {}
    n_tracks = 0
    missing_fields = 0
    for al in cat.get("albums", []):
        art = al.get("art")
        if art:
            if not (AUDIO_ROOT / al.get("tag", "") / art).exists():
                bad(f"album '{al.get('tag')}' art file missing: {art}")
        else:
            # the player draws a key-coloured monogram when art is absent —
            # missing covers degrade gracefully, so they warn, never block
            print(f"  ! album '{al.get('tag')}' has no art — the player "
                  "draws a monogram; drop a cover.png in its masters folder "
                  "whenever you like")
        for tr in al.get("tracks", []):
            n_tracks += 1
            for field in ("duration", "sha256", "published", "features", "mix"):
                if not tr.get(field):
                    missing_fields += 1
                    bad(f"{al.get('tag')}/{tr.get('file')}: missing {field}")
            m = tr.get("mix")
            if isinstance(m, dict) and not isinstance(m.get("mixable"), (int, float)):
                missing_fields += 1
                bad(f"{al.get('tag')}/{tr.get('file')}: mix block lacks a mixable score")
            sha = tr.get("sha256")
            if sha:
                if sha in shas:
                    bad(f"duplicate hash: {al.get('tag')}/{tr.get('file')} and {shas[sha]}")
                shas[sha] = f"{al.get('tag')}/{tr.get('file')}"
            f = AUDIO_ROOT / al.get("tag", "") / tr.get("file", "")
            if not f.exists():
                bad(f"file missing on disk: {f}")
    if not missing_fields and n_tracks:
        ok(f"{n_tracks} tracks all carry duration/sha256/published/features/mix")
    if len(shas) == n_tracks and n_tracks:
        ok("no duplicate hashes")

    # fingerprint index currency
    stale = 0
    for al in cat.get("albums", []):
        for tr in al.get("tracks", []):
            audio = AUDIO_ROOT / al.get("tag", "") / tr.get("file", "")
            fp = DNA_ROOT / al.get("tag", "") / (tr.get("file", "") + ".fp")
            if not fp.exists() or (audio.exists() and
                                   fp.stat().st_mtime < audio.stat().st_mtime):
                stale += 1
    if stale:
        bad(f"fingerprint index stale for {stale} track(s) — run fingerprint.py index")
    else:
        ok("fingerprint index current")

    size = CATALOG_PATH.stat().st_size
    gz = len(gzip.compress(CATALOG_PATH.read_bytes()))
    if gz > CATALOG_BUDGET_GZ:
        bad(f"catalog gzip size {gz/1024:.0f} KB exceeds the "
            f"{CATALOG_BUDGET_GZ // 1024} KB budget — time to move the "
            "scores to per-track sidecars")
    else:
        ok(f"catalog {size/1024:.0f} KB raw, {gz/1024:.0f} KB gzipped "
           f"(budget {CATALOG_BUDGET_GZ // 1024} KB)")

    # GitHub's walls, warned about before they're hit: 100 MiB per file is a
    # hard push rejection; ~1 GB published-site is a soft limit.
    if AUDIO_ROOT.exists():
        tree_bytes = 0
        for p in AUDIO_ROOT.rglob("*"):
            if p.is_file():
                tree_bytes += p.stat().st_size
                if p.stat().st_size > 90 * 1024 * 1024:
                    bad(f"{p} is {p.stat().st_size / 2**20:.0f} MB — GitHub "
                        "rejects files over 100 MiB; re-encode or split it")
        if tree_bytes > 1536 * 1024 * 1024:
            bad(f"audio tree is {tree_bytes / 2**30:.2f} GB — well past the "
                "~1 GB Pages soft limit; graduate 'base' to a CDN (HOSTING.md "
                "has the R2 path) before adding more")
        elif tree_bytes > 900 * 1024 * 1024:
            # Pages' ~1 GB is a soft limit — sites this size generally serve
            # fine — so the label's first pressing is not blocked on it; the
            # graduation clock is ticking, though
            print(f"  ! audio tree is {tree_bytes / 2**30:.2f} GB — near the "
                  "~1 GB Pages soft limit; plan the CDN graduation "
                  "(HOSTING.md → Cloudflare R2) before the next big drop")
        else:
            ok(f"audio tree {tree_bytes / 2**20:.0f} MB "
               "(file cap 100 MiB, site soft cap ~1 GB)")

    if not args.no_net and cat.get("base", "").startswith("http"):
        all_urls = []
        for al in cat.get("albums", []):
            for tr in al.get("tracks", []):
                all_urls.append(f"{cat['base']}/{al['tag']}/{tr['file']}")
        sample = random.sample(all_urls, min(args.samples, len(all_urls)))
        for url in sample:
            try:
                status, hdrs = probe_url(url)
                aco = hdrs.get("access-control-allow-origin", "")
                if status == 206 and aco == "*":
                    ok(f"206 + CORS: {url.rsplit('/', 1)[-1]}")
                else:
                    bad(f"probe {url}: HTTP {status}, "
                        f"access-control-allow-origin={aco or 'MISSING'} "
                        "(need 206 and *)")
            except Exception as e:
                bad(f"probe {url}: {e}")
    else:
        print("  – network probes skipped"
              + ("" if args.no_net else " (base is not http)"))

    print()
    if problems:
        print(f"doctor: {len(problems)} problem(s) — fix before publishing")
        return 1
    print("doctor: clean bill of health")
    return 0


# ---------------------------------------------------------------- main

def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "doctor":
        ap = argparse.ArgumentParser(prog="make_catalog.py doctor")
        ap.add_argument("--samples", type=int, default=5)
        ap.add_argument("--no-net", action="store_true",
                        help="skip the CORS/Range probes (offline runs)")
        return doctor(ap.parse_args(argv[1:]))

    ap = argparse.ArgumentParser(description="build docs/catalog.json v2")
    ap.add_argument("masters", help="directory of album folders holding web MP3s")
    ap.add_argument("--repo", help="deprecated — accepted, warned about, ignored "
                    "(the catalog defaults to the same-origin 'audio' tree)")
    ap.add_argument("--base", help="explicit base URL — set only when audio "
                    "graduates to a CDN (default: same-origin 'audio')")
    ap.add_argument("--artist", default="Aethra Kairos")
    ap.add_argument("--label", default="ERRERlabs")
    ap.add_argument("--force", action="store_true",
                    help="publish past a CLONE verdict (stamped into the entry) "
                         "— same as --on-clone both")
    ap.add_argument("--on-clone", choices=["ask", "keep", "use-new", "both"],
                    default="ask",
                    help="when a new file sounds identical to a published one: "
                         "ask (interactive; falls back to keep when there is "
                         "no terminal), keep the existing entry, use-new "
                         "(replace it — the new file and name take over, the "
                         "publish date is kept), or both")
    return build(ap.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
