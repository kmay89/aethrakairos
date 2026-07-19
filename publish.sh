#!/usr/bin/env bash
# publish.sh — the whole maintenance loop, one command, idempotent.
# Adding album number forty must feel identical to adding album number four.
#
#   ./publish.sh [MASTERS_DIR] [WIZARD_ZIP ...]
#
# 1. any wizard ZIPs given (or found in MASTERS_DIR/incoming/) unpack into
#    MASTERS_DIR — the wizard names album folders itself
# 2. make_catalog.py runs: hash dedupe (move-vs-add), the fingerprint gate,
#    feature extraction with the shared cache, catalog-wide normalization
# 3. make_catalog.py doctor gates the publish — any failure stops it cold
# 4. commit + push
#
# Masters (.wav) never enter the public repo; make_catalog fails the build
# if one is found under docs/audio/.

set -euo pipefail
cd "$(dirname "$0")"

MASTERS="${1:-masters}"
shift || true

mkdir -p "$MASTERS"

# -------- 1 · unpack wizard ZIPs
unpack() {
  local zip="$1"
  echo "· unpacking $(basename "$zip")"
  python3 - "$zip" "$MASTERS" <<'PY'
import sys, zipfile, pathlib
zf, dest = sys.argv[1], pathlib.Path(sys.argv[2])
with zipfile.ZipFile(zf) as z:
    # WAV/M4A/AIFF/FLAC are welcome in masters/ — make_catalog converts
    # them to web MP3s on the way in; the PUBLIC tree still refuses masters
    z.extractall(dest)
PY
}
for zip in "$@"; do unpack "$zip"; done
if [ -d "$MASTERS/incoming" ]; then
  for zip in "$MASTERS"/incoming/*.zip; do
    [ -e "$zip" ] || continue
    unpack "$zip" && mv "$zip" "$zip.done"
  done
fi

# -------- 2 · build the catalog (dedupe · fingerprint gate · features)
# same-origin by default: audio lives in docs/audio/, served by Pages beside
# the player — no raw.githubusercontent, no CORS, no 60-req/hr wall
python3 make_catalog.py "$MASTERS" \
  --artist "Aethra Kairos" --label "ERRERlabs"

# -------- 3 · doctor gates the publish
python3 make_catalog.py doctor --no-net

# -------- 3b · stamp the player build id (idempotent) — a changed player
# means a changed sw.js, which is what makes installed home-screen copies
# notice the release and show their Update button
python3 tools/stamp_version.py

# -------- 4 · commit + push
git add docs/catalog.json docs/index.html docs/sw.js docs/audio \
        docs/LICENSE-CODE docs/LICENSE-AUDIO features-cache.json dna
if git diff --cached --quiet; then
  echo "· nothing new — catalog already current"
  exit 0
fi
git commit -m "catalog: $(date +%Y-%m-%d) build"
git push
echo "· published. The library updates on the next player load."
