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
# WHY sync AND NOT cp: `aws s3 sync` uploads only what changed, so the first
# run moves 1.09 GB and every run after a release moves the one new track.
# R2 egress is free; ingress is free; you are paying for storage alone.
#
# WHAT THIS DOES NOT DO: CORS and the noindex header live on the bucket, not
# in this script — see HOSTING.md §5. `python3 make_catalog.py doctor` (no
# --no-net) is what proves they are right, and it is worth running after the
# first sync rather than trusting the dashboard.
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

# credentials: explicit env wins, else the named profile
AUTH=()
if [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  AUTH=(--profile "$PROFILE")
fi

DRY=()
[ "${1:-}" = "--dry-run" ] && DRY=(--dryrun)

echo "· mirroring $SRC → s3://$BUCKET/audio  ($(du -sh "$SRC" | cut -f1))"

# --size-only: MP3s are content-addressed by the catalog's sha256 and never
# rewritten in place, so a size match IS a content match here — and it skips
# re-hashing a gigabyte on every run. --delete retires audio the catalog has
# dropped, so the bucket can never drift into holding tracks the library has
# forgotten.
aws s3 sync "$SRC" "s3://$BUCKET/audio" \
  --endpoint-url "$ENDPOINT" \
  --size-only --delete \
  --content-type audio/mpeg \
  --cache-control "public, max-age=31536000, immutable" \
  "${AUTH[@]}" "${DRY[@]}"

echo
echo "· synced. Prove it before you trust it:"
echo "    python3 make_catalog.py doctor        # samples real URLs: wants 206 + ACAO *"
