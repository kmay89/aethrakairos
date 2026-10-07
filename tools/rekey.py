#!/usr/bin/env python3
"""rekey.py — re-read every catalog track's KEY with the current detector,
touching nothing else.

The key detector was rebuilt (features.KEY_VERSION): the one that shipped
read 187 of 267 tracks as 8B and 75 as 7B — one artist, two keys, which is
not a catalog, it is a detector that cannot see. The beat grid, the regions
and the structure of every track are still current and expensive, so this
does NOT re-run the pipeline: it decodes each web MP3 once, rewrites the key
fields of its mix block (key, keyConf, kv) in features-cache.json and in
docs/catalog.json, and leaves every other byte alone. make_catalog.py does
the same on its next run for any entry whose `kv` is stale, so this tool is
only a way of landing the refresh now rather than at the next publish.

    python3 tools/rekey.py            # the whole catalog
    python3 tools/rekey.py --limit 5  # a taste
    python3 tools/rekey.py --dry-run  # report, write nothing
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import features as ft  # noqa: E402

CATALOG = ROOT / "docs" / "catalog.json"
CACHE = ROOT / "features-cache.json"
AUDIO = ROOT / "docs" / "audio"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-read keys already at KEY_VERSION")
    args = ap.parse_args(argv)
    cat = json.loads(CATALOG.read_text())
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {"by_sha": {}}
    by_sha = cache.setdefault("by_sha", {})
    before, after = Counter(), Counter()
    done = changed = 0
    for al in cat.get("albums", []):
        for t in al.get("tracks", []):
            mix = t.get("mix")
            if not isinstance(mix, dict):
                continue
            before[mix.get("key")] += 1
            if mix.get("kv") == ft.KEY_VERSION and not args.force:
                after[mix.get("key")] += 1
                continue
            path = AUDIO / al["tag"] / t["file"]
            if not path.exists():
                print(f"  ! missing audio: {path}")
                after[mix.get("key")] += 1
                continue
            try:
                mono, sr = ft.decode_mono(path, sr=44100)
                key, conf = ft.detect_key(mono, sr)
            except Exception as exc:  # noqa: BLE001 — one bad file must not stop the sweep
                print(f"  ! {al['tag']}/{t['file']}: {exc}")
                after[mix.get("key")] += 1
                continue
            old = mix.get("key")
            print(f"  {al['tag']}/{t['file']}: {old} -> {key} ({conf})", flush=True)
            if key != old:
                changed += 1
            mix["key"], mix["keyConf"], mix["kv"] = key, conf, ft.KEY_VERSION
            hit = by_sha.get(t.get("sha256"))
            if isinstance(hit, dict) and isinstance(hit.get("mix"), dict):
                hit["mix"]["key"], hit["mix"]["keyConf"], hit["mix"]["kv"] = key, conf, ft.KEY_VERSION
            after[key] += 1
            done += 1
            if args.limit and done >= args.limit:
                break
        if args.limit and done >= args.limit:
            break
    print(f"\nread {done} track(s), {changed} key(s) changed")
    print("before:", before.most_common(8))
    print("after: ", after.most_common(12))
    if args.dry_run:
        print("dry run — nothing written")
        return 0
    if done:
        CATALOG.write_text(json.dumps(cat, indent=1, ensure_ascii=False) + "\n")
        CACHE.write_text(json.dumps(cache, indent=0) + "\n")   # make_catalog.py's own format
        print("wrote docs/catalog.json and features-cache.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
