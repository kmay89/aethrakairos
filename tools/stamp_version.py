#!/usr/bin/env python3
"""stamp_version.py — stamp the player build id into docs/index.html
(MB8_BUILD) and docs/sw.js (VERSION), derived from the content itself.

The id is a short hash of index.html (with its own stamp line normalized)
plus the manifest, so:
  · any real change to the player produces a new id → sw.js changes →
    installed home-screen copies see an update and show the Update button
  · re-running with no changes is a no-op (idempotent, publish-safe)

Run by publish.sh; safe to run by hand:  python3 tools/stamp_version.py
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"
SW = ROOT / "docs" / "sw.js"
MANIFEST = ROOT / "docs" / "manifest.webmanifest"

BUILD_RE = re.compile(r"(const MB8_BUILD = ')[^']*(';)")
VER_RE = re.compile(r"(const VERSION = ')[^']*(';)")


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
    print(f"build {build}" + (f" — stamped {', '.join(changed)}" if changed
                              else " — already current"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
