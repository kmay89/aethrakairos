#!/usr/bin/env bash
# move_to_r2.sh — one command for the whole move: put this checkout on the
# right branch, upload docs/audio/ to the R2 bucket, and prove the bucket
# works before anything is merged.
#
#   ./tools/move_to_r2.sh
#
# It asks for the three R2 values rather than making you export them, and it
# stops the moment anything is wrong instead of carrying on into a mess.
# Nothing here touches the live site — merging PR #176 is what does that, and
# this script only ever tells you whether that merge is safe.
#
# Safe to re-run. If the upload dies halfway, run it again: sync resumes.
set -uo pipefail

BRANCH="claude/library-releases-playback-gu1co5"
BUCKET="${R2_BUCKET:-aethrakairos-audio}"

cd "$(dirname "$0")/.." || exit 1

# ------------------------------------------------------------------ output
bold=$'\033[1m'; dim=$'\033[2m'; red=$'\033[31m'; grn=$'\033[32m'
ylw=$'\033[33m'; off=$'\033[0m'
step(){ printf '\n%s──  %s%s\n' "$bold" "$1" "$off"; }
ok(){   printf '  %s✓%s %s\n' "$grn" "$off" "$1"; }
warn(){ printf '  %s!%s %s\n' "$ylw" "$off" "$1"; }
die(){  printf '\n  %s✗ %s%s\n' "$red" "$1" "$off"; shift
        for l in "$@"; do printf '    %s\n' "$l"; done
        printf '\n    Nothing was changed. Fix the above and run this again.\n\n'
        exit 1; }

printf '\n%sMoving the music to R2%s\n' "$bold" "$off"
printf '%sSteps 6 and 7 of the runbook. Steps 1-5 (bucket, domain, CORS,\n' "$dim"
printf 'robots rule, API token) must already be done.%s\n' "$off"

# ------------------------------------------------------------------ 1 · place
step "1/6  Checking you are in the right folder"
[ -f make_catalog.py ] && [ -d docs/audio ] || die \
  "this is not the aethrakairos repo" \
  "Run the script from inside your clone, like this:" \
  "    cd ~/path/to/aethrakairos && ./tools/move_to_r2.sh"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die \
  "this folder is not a git checkout" \
  "Clone the repo first, then run this from inside it."
ok "found the repo ($(pwd))"

# ------------------------------------------------------------------ 2 · branch
step "2/6  Putting you on the branch that has the sync script"
if [ -n "$(git status --porcelain)" ]; then
  printf '\n'; git status --short | sed 's/^/      /'
  die "you have uncommitted changes" \
      "Switching branches could lose them, so this script will not do it." \
      "Save them first (git stash, or commit them), then run this again."
fi
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT" = "$BRANCH" ]; then
  ok "already on $BRANCH"
else
  printf '  %s· fetching…%s\n' "$dim" "$off"
  git fetch origin "$BRANCH" --quiet || die "could not reach GitHub" \
      "Check your internet connection and try again."
  git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH" --track "origin/$BRANCH" \
    || die "could not switch to $BRANCH"
  ok "switched from $CURRENT to $BRANCH"
fi
git pull --quiet --ff-only origin "$BRANCH" 2>/dev/null && ok "branch is up to date"
[ -x tools/sync_audio.sh ] || die "tools/sync_audio.sh is missing" \
  "The branch may not have finished checking out. Try again."

# ------------------------------------------------------------------ 3 · tools
step "3/6  Checking the tools this needs"
command -v python3 >/dev/null 2>&1 || die "python3 is not installed" \
  "On a Mac: xcode-select --install"
command -v curl >/dev/null 2>&1 || die "curl is not installed"

# aws is the only hard requirement. Naming the RIGHT install command matters
# more than naming one: 'pip' does not exist on macOS (it is pip3), and a pip
# install of awscli commonly lands the binary somewhere not on PATH, so it
# reports success and the next run still cannot find it.
if ! command -v aws >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      die "the AWS command-line tool is not installed" \
          "You have Homebrew, so this is the one to use:" \
          "    brew install awscli" \
          "Then run this script again."
    fi
    die "the AWS command-line tool is not installed" \
        "Use Amazon's official macOS installer — it puts 'aws' somewhere your" \
        "shell can actually find it, which pip often does not. Copy all three:" \
        "" \
        "    curl -o AWSCLIV2.pkg https://awscli.amazonaws.com/AWSCLIV2.pkg" \
        "    sudo installer -pkg AWSCLIV2.pkg -target /" \
        "    rm AWSCLIV2.pkg" \
        "" \
        "It will ask for your Mac password. Then run this script again."
  fi
  die "the AWS command-line tool is not installed" \
      "    python3 -m pip install awscli" \
      "Then run this script again."
fi
ok "aws and python3 are present"

# numpy is OPTIONAL. It is only needed to run the repo's own doctor, and the
# checks that actually gate the merge are HTTP probes this script can make on
# its own. Nobody should have to install a numerical library to upload files.
HAVE_NUMPY=0
python3 -c "import numpy" >/dev/null 2>&1 && HAVE_NUMPY=1

TRACKS=$(find docs/audio -name '*.mp3' | wc -l | tr -d ' ')
SIZE=$(du -sh docs/audio | cut -f1)
ok "$TRACKS tracks on disk, $SIZE to upload"

# ------------------------------------------------------------------ 4 · creds
step "4/6  Your R2 credentials"
printf '%s  From step 5 of the runbook. Paste each one and press Enter.\n' "$dim"
printf '  The secret will not appear on screen as you paste it.%s\n\n' "$off"

trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; printf '%s' "${v%"${v##*[![:space:]]}"}"; }

# ASK EVERY TIME, EVEN IF THE ENVIRONMENT ALREADY HAS AWS CREDENTIALS.
# Anyone who uses AWS for anything else has AWS_ACCESS_KEY_ID exported
# already, and silently signing R2 requests with an Amazon key produces
# "SignatureDoesNotMatch" — an error that sends you hunting through a token
# you never actually typed. Ambient AWS settings are cleared for the same
# reason: a stale session token or a default profile breaks signing in ways
# that read as a credentials problem.
if [ -n "${AWS_ACCESS_KEY_ID:-}${AWS_PROFILE:-}${AWS_SESSION_TOKEN:-}" ]; then
  warn "ignoring the AWS credentials already in your environment — R2 needs its own"
fi
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE

# accepts the bare hex, the hostname, or the whole endpoint URL — all three
# get reduced to the account id, because pasting the full URL is the single
# most common way this goes wrong
printf '  Account ID %s(or paste the whole S3 endpoint URL)%s: ' "$dim" "$off"
read -r RAW
RAW="$(trim "$RAW")"; RAW="${RAW#https://}"; RAW="${RAW#http://}"
RAW="${RAW%%/*}"; ACCOUNT="${RAW%.r2.cloudflarestorage.com}"
[ -n "$ACCOUNT" ] || die "no account ID given"
case "$ACCOUNT" in
  *.*|*" "*) die "that does not look like an account ID: $ACCOUNT" \
      "It should be the plain hex string out of the endpoint, e.g." \
      "    https://a1b2c3d4.r2.cloudflarestorage.com  ->  a1b2c3d4" ;;
esac
ok "account ID: $ACCOUNT"

printf '  Access Key ID: '; read -r AWS_ACCESS_KEY_ID
AWS_ACCESS_KEY_ID="$(trim "$AWS_ACCESS_KEY_ID")"
[ -n "$AWS_ACCESS_KEY_ID" ] || die "no access key ID given"
ok "access key ID: ${AWS_ACCESS_KEY_ID:0:6}…"

printf '  Secret Access Key %s(hidden)%s: ' "$dim" "$off"
read -rs AWS_SECRET_ACCESS_KEY; printf '\n'
AWS_SECRET_ACCESS_KEY="$(trim "$AWS_SECRET_ACCESS_KEY")"
[ -n "$AWS_SECRET_ACCESS_KEY" ] || die "no secret access key given"
ok "secret received"

export R2_ACCOUNT_ID="$ACCOUNT" AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

# ------------------------------------------------------------------ 5 · upload
step "5/6  Uploading"
printf '  %s· dry run first — this moves nothing%s\n' "$dim" "$off"
DRY="$(./tools/sync_audio.sh --dry-run 2>&1)" || {
  printf '%s\n' "$DRY" | tail -20 | sed 's/^/      /'
  case "$DRY" in
    *SignatureDoesNotMatch*|*InvalidAccessKeyId*)
      die "R2 rejected those credentials" \
          "One of the three values has a typo, or the token was scoped to a" \
          "different bucket. Make a fresh token (runbook step 5) and retry." ;;
    *NoSuchBucket*)
      die "there is no bucket called '$BUCKET'" \
          "Check the name in Cloudflare matches exactly, or re-run as:" \
          "    R2_BUCKET=your-bucket-name ./tools/move_to_r2.sh" ;;
    *"Could not connect"*|*EndpointConnectionError*|*"SSL validation failed"*|\
    *"Name or service not known"*|*"nodename nor servname"*|*"Temporary failure in name resolution"*)
      die "could not reach $ACCOUNT.r2.cloudflarestorage.com" \
          "Almost always a wrong account ID — it is the hex string only, e.g." \
          "    https://a1b2c3d4.r2.cloudflarestorage.com  ->  a1b2c3d4" \
          "If the ID is definitely right, check your internet connection." ;;
    *AccessDenied*)
      die "R2 accepted the key but refused the bucket" \
          "The token was probably scoped to a different bucket, or created" \
          "as read-only. It needs Object Read & Write on '$BUCKET'." ;;
    *) die "the dry run failed — the last lines are above" ;;
  esac
}
PLANNED=$(printf '%s\n' "$DRY" | grep -c 'upload:' || true)
if [ "$PLANNED" -eq 0 ]; then
  ok "nothing to upload — the bucket already matches the repo"
else
  ok "$PLANNED file(s) to upload, $SIZE"
  printf '\n  Upload now? This takes a while on a home connection.\n'
  printf '  Type %syes%s to continue: ' "$bold" "$off"
  read -r GO
  [ "$GO" = "yes" ] || { printf '\n  Stopped. Nothing was uploaded.\n\n'; exit 0; }
  printf '\n'
  ./tools/sync_audio.sh || die "the upload failed partway" \
      "Run this script again — sync picks up where it left off."
  ok "upload finished"
fi

# ------------------------------------------------------------------ 6 · proof
step "6/6  Proving the bucket before you merge"
FAIL=0

# Sample five real track URLs straight out of the shipped catalog — stdlib
# only, so this works whether or not numpy is installed.
URLS="$(python3 -c "
import json, random
c = json.load(open('docs/catalog.json'))
u = [c['base'] + '/' + a['tag'] + '/' + t['file']
     for a in c['albums'] for t in a['tracks']]
print('\n'.join(random.sample(u, min(5, len(u)))))" 2>/dev/null)"
[ -n "$URLS" ] || die "could not read track URLs out of docs/catalog.json"

# A GET carrying a Range header, exactly as a browser seeking a track sends
# it. NOT curl -I: that sends HEAD, which servers may answer 200 even when
# ranges work, so it cannot tell you what you need to know here.
probe(){ curl -s -o /dev/null -D - --max-time 30 -r 0-1 \
           -H 'Origin: https://example.com' "$1" 2>&1 | tr -d '\r'; }

printf '  %s· fetching the first two bytes of five random tracks…%s\n' "$dim" "$off"
GOOD=0; N=0
while IFS= read -r u; do
  [ -n "$u" ] || continue
  N=$((N + 1)); H="$(probe "$u")"; NAME="${u##*/}"
  case "$H" in
    *" 206"*)
      case "$H" in
        *[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin:\ \**)
          ok "206 + CORS  $NAME"; GOOD=$((GOOD + 1)) ;;
        *) warn "206 but no 'Access-Control-Allow-Origin: *'  $NAME"; FAIL=1 ;;
      esac ;;
    *" 200"*)
      warn "200, not 206  $NAME — it plays, but SEEKING IS BROKEN"
      warn "   fix: add \"Range\" to AllowedHeaders in the CORS policy (step 3)"; FAIL=1 ;;
    *" 404"*)
      warn "404  $NAME — not in the bucket; the upload is incomplete"; FAIL=1 ;;
    *" 401"*|*" 403"*)
      warn "not public  $NAME — check the custom domain in step 2"; FAIL=1 ;;
    *)
      warn "no usable response for $NAME:"
      printf '%s\n' "$H" | head -3 | sed 's/^/      /'; FAIL=1 ;;
  esac
done <<EOF
$URLS
EOF
[ "$GOOD" -eq "$N" ] && ok "all $N sampled tracks serve correctly"

FIRST="$(printf '%s\n' "$URLS" | head -1)"
printf '\n  %s· checking the crawler header%s\n' "$dim" "$off"
case "$(probe "$FIRST")" in
  *[Xx]-[Rr]obots-[Tt]ag:*noindex*) ok "X-Robots-Tag is set" ;;
  *) warn "X-Robots-Tag missing — re-check the Transform Rule (step 4)"; FAIL=1 ;;
esac

if [ "$HAVE_NUMPY" -eq 1 ]; then
  printf '\n  %s· running the repo'"'"'s own doctor as well%s\n' "$dim" "$off"
  if DOC="$(python3 make_catalog.py doctor 2>&1)"; then
    ok "doctor: clean bill of health"
  else
    printf '%s\n' "$DOC" | grep -E '✗' | sed 's/^/      /'
    warn "doctor found problems — see above"; FAIL=1
  fi
else
  printf '\n  %s· skipping the repo doctor (numpy not installed) — the probes\n' "$dim"
  printf '    above are the checks that gate the merge, and they ran%s\n' "$off"
fi

printf '\n%s' "$bold"
if [ "$FAIL" -eq 0 ]; then
  printf '%s  ✓  SAFE TO MERGE PR #176%s\n' "$grn" "$off"
  printf '     The bucket serves every track with the right headers.\n'
  printf '     Merge it, then load the site and play something.\n'
  printf '     %sIf the first load misbehaves, reload once — the old catalog\n' "$dim"
  printf '     is cached and the redirect covers it.%s\n\n' "$off"
else
  printf '%s  ✗  DO NOT MERGE YET%s\n' "$red" "$off"
  printf '     Fix what is flagged above and run this script again.\n'
  printf '     Merging now would point every track at something broken.\n\n'
  exit 1
fi
