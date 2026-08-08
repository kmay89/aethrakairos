#!/usr/bin/env bash
# sync_audio.sh — push docs/audio/ to the Cloudflare R2 bucket that serves
# media.aethrakairos.com. The repo stays the master copy; the bucket is a
# mirror of it, and this is the one command that makes them agree.
#
#   ./tools/sync_audio.sh              # mirror docs/audio/ into the bucket
#   ./tools/sync_audio.sh --dry-run    # say what would move, move nothing
#
# Credentials (R2 → Manage API tokens → Object Read & Write), in the
# environment or ~/.aws/credentials under the profile named below:
#
#   export R2_ACCOUNT_ID=...
#   export AWS_ACCESS_KEY_ID=...
#   export AWS_SECRET_ACCESS_KEY=...
#
# WHY sync AND NOT cp: it uploads only what changed, so the first run moves
# 1.09 GB and every run after a release moves the one new track. R2 charges
# nothing for egress or ingress; you are paying for storage alone.
#
# WHAT THIS DOES NOT DO: CORS and the noindex header live on the bucket and
# on a Cloudflare Transform Rule, not in this script — see HOSTING.md §5.
# `python3 make_catalog.py doctor` (no --no-net) is what proves they are
# right, and it is worth running after the first sync rather than trusting
# the dashboard.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="${R2_BUCKET:-aethrakairos-audio}"
PROFILE="${R2_PROFILE:-r2}"
SRC="docs/audio"

: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID (Cloudflare dashboard → R2 → your account id)}"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

if ! command -v aws >/dev/null 2>&1; then
  echo "✗ the AWS CLI is not installed — R2 speaks S3, so that is the client:" >&2
  echo "    pip install awscli     (or: brew install awscli)" >&2
  exit 1
fi
[ -d "$SRC" ] || { echo "✗ no $SRC to sync — is this the repo root?" >&2; exit 1; }

# R2 has no regions, but the S3 client refuses to sign a request without one:
# 'auto' is the value R2 documents for exactly this.
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

# Recent AWS CLI v2 sends flexible-checksum headers on every upload by
# default; R2 rejects some of them and the sync dies partway with an opaque
# error. Both knobs fall back to the older behaviour, which R2 accepts. They
# are set only if the caller has not chosen already.
export AWS_REQUEST_CHECKSUM_CALCULATION="${AWS_REQUEST_CHECKSUM_CALCULATION:-when_required}"
export AWS_RESPONSE_CHECKSUM_VALIDATION="${AWS_RESPONSE_CHECKSUM_VALIDATION:-when_required}"

# credentials: explicit env wins, else the named profile
AUTH=()
if [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  AUTH=(--profile "$PROFILE")
fi

DRY=()
[ "${1:-}" = "--dry-run" ] && DRY=(--dryrun)

DEST="s3://$BUCKET/audio"
echo "· mirroring $SRC → $DEST  ($(du -sh "$SRC" | cut -f1))"
echo

# TWO PASSES, BECAUSE THE TWO KINDS OF FILE WANT DIFFERENT CACHING — and
# because a blanket --content-type would label the cover art as audio.
# Content types are left to the client, which reads them off the extension:
# .mp3 → audio/mpeg, .png → image/png. Getting that wrong on a cover is a
# broken image; getting it wrong on a track is a track that will not play.
#
# --delete on BOTH passes, with complementary filters, adds up to a full
# reconciliation: audio the catalog has dropped is retired from the bucket,
# so it can never drift into holding tracks the library has forgotten.

# 1 · the tracks. --size-only because a track is never rewritten in place —
# make_catalog gives new audio a new filename rather than reusing one — so a
# size match IS a content match here. Without it, sync compares timestamps,
# and a fresh clone has today's mtime on all 267 files: every run would
# re-upload the entire gigabyte.
echo "· tracks (immutable, one year)"
aws s3 sync "$SRC" "$DEST" \
  --endpoint-url "$ENDPOINT" \
  --exclude "*" --include "*.mp3" \
  --size-only --delete \
  --cache-control "public, max-age=31536000, immutable" \
  "${AUTH[@]}" "${DRY[@]}"

# 2 · cover art and anything else. A cover CAN be replaced under the same
# name, so it gets neither --size-only nor a year of immutability.
echo
echo "· artwork (one day)"
aws s3 sync "$SRC" "$DEST" \
  --endpoint-url "$ENDPOINT" \
  --exclude "*.mp3" \
  --delete \
  --cache-control "public, max-age=86400" \
  "${AUTH[@]}" "${DRY[@]}"

echo
echo "· synced. Prove it before you trust it:"
echo "    python3 make_catalog.py doctor        # samples real URLs: wants 206 + ACAO *"
