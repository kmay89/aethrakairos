#!/usr/bin/env python3
"""stamp_version.py — stamp the player build id into docs/index.html
(MB8_BUILD) and docs/sw.js (VERSION), derived from the content itself.

The id is a short hash of index.html (with its own stamp line normalized)
plus the manifest, so:
  · any real change to the player produces a new id → sw.js changes →
    installed home-screen copies see an update and show the Update button
  · re-running with no changes is a no-op (idempotent, publish-safe)

It also keeps the changelog's LINEAGE. news.json entries name the build they
shipped as, and the update card walks the list until it meets the build you
are running. A deploy that ships no note of its own — polish, a fix, the
stamp commit itself — used to be a build id no entry had ever heard of, so
the walk ran off the end and the card answered "what's new?" with the last
four things the listener already had. Every stamped build is now recorded on
the newest entry's `builds`, so the running build is always found.

Run by publish.sh; safe to run by hand:  python3 tools/stamp_version.py
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"
SW = ROOT / "docs" / "sw.js"
MANIFEST = ROOT / "docs" / "manifest.webmanifest"
NEWS = ROOT / "docs" / "news.json"

BUILD_RE = re.compile(r"(const MB8_BUILD = ')[^']*(';)")
VER_RE = re.compile(r"(const VERSION = ')[^']*(';)")


def record_build(build):
    """Note `build` on the newest changelog entry unless the list already
    knows it. Returns True if news.json changed. Never fatal: a missing or
    malformed changelog costs the lineage, never the stamp."""
    try:
        news = json.loads(NEWS.read_text())
        entries = news.get("entries") or []
        if not entries:
            return False
        for e in entries:
            if e.get("build") == build or build in (e.get("builds") or []):
                return False          # already named — idempotent
        top = entries[0]
        top["builds"] = (top.get("builds") or []) + [build]
        NEWS.write_text(json.dumps(news, indent=2, ensure_ascii=False) + "\n")
        return True
    except Exception as exc:          # noqa: BLE001 — the stamp must still land
        print(f"! news.json lineage not recorded: {exc}")
        return False


def main():
    index = INDEX.read_text()
    sw = SW.read_text()
    if not BUILD_RE.search(index):
        sys.exit("stamp_version: MB8_BUILD line not found in docs/index.html")
    if not VER_RE.search(sw):
        sys.exit("stamp_version: VERSION line not found in docs/sw.js")

    normalized = BUILD_RE.sub(r"\g<1>@@BUILD@@\g<2>", index)
    h = hashlib.sha256()
    h.update(normalized.encode())
    h.update(MANIFEST.read_bytes())
    build = h.hexdigest()[:10]

    new_index = BUILD_RE.sub(rf"\g<1>{build}\g<2>", index)
    new_sw = VER_RE.sub(rf"\g<1>{build}\g<2>", sw)
    changed = []
    if new_index != index:
        INDEX.write_text(new_index)
        changed.append("index.html")
    if new_sw != sw:
        SW.write_text(new_sw)
        changed.append("sw.js")
    if record_build(build):
        changed.append("news.json")
    print(f"build {build}" + (f" — stamped {', '.join(changed)}" if changed
                              else " — already current"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
