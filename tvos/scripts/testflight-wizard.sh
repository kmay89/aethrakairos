#!/bin/bash
# ONE COMMAND, START TO FINISH — turning on TestFlight for the Apple TV app.
#
#     bash tvos/scripts/testflight-wizard.sh
#
# Run it as many times as you like. Every step checks whether it is already
# done and skips itself, so a re-run after a coffee break picks up exactly
# where you stopped, and a re-run after everything works does nothing at all.
# The state it trusts is GitHub's, never a local progress file — the repo is
# the only honest record of which secrets exist.
#
# What it automates: validating the App Store Connect API key (.p8), storing
# the four secrets + the ENABLE_TVOS_SIGNING switch, and (with --ship)
# dispatching the TestFlight run and watching it land. What it cannot do for
# you — and walks you through instead — are the three browser steps Apple
# reserves for a signed-in human: registering the bundle ID, creating the
# app record, and generating the API key. tvos/TESTFLIGHT.md is the long-form
# runbook behind every prompt here.
#
#   --paste   never write to GitHub; copy each value to the clipboard and wait
#             while you paste it into the web UI. For when you would rather
#             not sign the CLI in.
#   --ship    after setup, dispatch the tvos workflow with channel=testflight
#             and watch the run to the end.
#
# FUTURE APPS: nothing in here is Aethra-specific but three defaults.
# REPO, BUNDLE_ID and APP_NAME are environment overrides, so the next app is
#     REPO=you/nextapp BUNDLE_ID=com.next.tv APP_NAME="Next" bash tvos/scripts/testflight-wizard.sh
# against a repo carrying the same four-secret workflow contract.

set -euo pipefail

REPO="${REPO:-kmay89/aethrakairos}"
BUNDLE_ID="${BUNDLE_ID:-com.aethrakairos.tv}"
APP_NAME="${APP_NAME:-Aethra Kairos}"
PASTE=0
SHIP=0
for a in "$@"; do
  case "$a" in
    --paste) PASTE=1 ;;
    --ship)  SHIP=1 ;;
    -h|--help) sed -n '2,30p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$a" >&2; exit 2 ;;
  esac
done

BOLD=$'\033[1m'; DIM=$'\033[2m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; OFF=$'\033[0m'
step() { printf '\n%s──── %s ────%s\n' "$BOLD" "$*" "$OFF"; }
ok()   { printf '  %sok%s   %s\n' "$GRN" "$OFF" "$*"; }
skip() { printf '  %s--%s   %s %s(already done)%s\n' "$DIM" "$OFF" "$*" "$DIM" "$OFF"; }
warn() { printf '  %s!!%s   %s\n' "$YEL" "$OFF" "$*"; }
die()  { printf '\n%sSTOPPED%s %s\n\n' "$RED" "$OFF" "$*" >&2; exit 1; }
pause(){ printf '\n  Press RETURN when done, or Ctrl-C to stop here. '; read -r _; }
ask()  { local v; printf '  %s: ' "$1" >&2; read -r v; printf '%s' "$v"; }

GH_OK=0
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then GH_OK=1; fi
have_secret() { [ "$GH_OK" = 1 ] && gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
set_secret() {  # name value  — write to GitHub, or park on the clipboard
  if [ "$PASTE" = 1 ]; then
    printf '%s' "$2" | pbcopy
    printf '  %s→%s  %s is on your clipboard. Paste it at\n' "$YEL" "$OFF" "$1"
    printf '      https://github.com/%s/settings/secrets/actions/new  (name: %s)\n' "$REPO" "$1"
    pause
  else
    printf '%s' "$2" | gh secret set "$1" --repo "$REPO"
    ok "secret $1 stored"
  fi
}

printf '%s\nTestFlight for the Apple TV app — %s (%s)%s\n' "$BOLD" "$APP_NAME" "$REPO" "$OFF"
if [ "$PASTE" = 1 ]; then
  printf '%sPaste mode: nothing is written to GitHub. Each value lands on your\nclipboard and you paste it into the web UI.%s\n' "$DIM" "$OFF"
fi

# ─────────────────────────────────────────────────────────── 1. tools
step "1/6  Tools"
[ "$(uname -s)" = "Darwin" ] || die "Run this on your Mac (pbcopy, and it's where the .p8 download lands)."
command -v openssl >/dev/null || die "No openssl."
ok "macOS, openssl"
if [ "$PASTE" = 0 ]; then
  command -v gh >/dev/null || die "GitHub CLI missing. Either:
      brew install gh && gh auth login
  …or re-run this with --paste to skip the CLI entirely."
  [ "$GH_OK" = 1 ] || die "gh is installed but not signed in. Run: gh auth login
  (or re-run this with --paste)"
  ok "gh signed in"
fi

# ────────────────────────────────────────────── 2. the browser-only steps
step "2/6  Apple's side (browser — Apple reserves these for a human)"
printf '%s  These are Parts 0–2 of tvos/TESTFLIGHT.md. Skip any already done.%s\n' "$DIM" "$OFF"
printf '
  a) Apple Developer Program membership ($99/yr, ~48h to activate):
       https://developer.apple.com/programs/enroll/
  b) Register the bundle ID  %s%s%s  (Identifiers → ＋ → App IDs → App →
     Explicit, no capabilities):
       https://developer.apple.com/account/resources/identifiers/list
  c) Create the app record (My Apps → ＋ → New App → platform tvOS,
     bundle ID %s, SKU anything):
       https://appstoreconnect.apple.com/apps
' "$BOLD" "$BUNDLE_ID" "$OFF" "$BUNDLE_ID"
pause

# ────────────────────────────────────────────────── 3. the token (.p8)
step "3/6  The token — App Store Connect API key"
if have_secret ASC_API_KEY_P8_BASE64 && have_secret ASC_KEY_ID && have_secret ASC_ISSUER_ID; then
  skip "ASC_API_KEY_P8_BASE64 / ASC_KEY_ID / ASC_ISSUER_ID"
  P8="" KEYID="" ISSUER=""
else
  printf '%s  Part 3 of tvos/TESTFLIGHT.md. Generate it once, download once:%s\n' "$DIM" "$OFF"
  printf '
  App Store Connect → Users and Access → Integrations → App Store Connect
  API → Team Keys → ＋ Generate API Key
    Name:   %s tvos ci
    Access: App Manager   (⚠ not Developer — too weak for cloud signing)
  then Download API Key — the download works EXACTLY ONCE; keep the file.
       https://appstoreconnect.apple.com/access/integrations/api
' "$APP_NAME"
  P8="$(ask 'Path to the downloaded AuthKey_XXXXXXXXXX.p8 (drag the file here)')"
  P8="${P8/#\~/$HOME}"; P8="$(printf '%s' "$P8" | sed "s/^'//; s/'\$//")"   # Terminal drag quotes
  [ -f "$P8" ] || die "No file at: $P8"
  # a truncated or wrong file fails HERE, with a name — not 20 min into CI
  openssl pkey -in "$P8" -noout 2>/dev/null || die "openssl cannot parse $P8 — not a valid .p8 key."
  ok ".p8 parses as a private key"
  KEYID="$(basename "$P8" | sed -n 's/^AuthKey_\([A-Z0-9]\{10\}\)\.p8$/\1/p')"
  if [ -n "$KEYID" ]; then
    ok "Key ID read from the filename: $KEYID"
  else
    KEYID="$(ask 'Key ID (10 characters, shown on the key row)')"
  fi
  case "$KEYID" in ??????????) : ;; *) die "A Key ID is exactly 10 characters — got '$KEYID'." ;; esac
  ISSUER="$(ask 'Issuer ID (the UUID at the top of the Team Keys page)')"
  case "$ISSUER" in
    ????????-????-????-????-????????????) : ;;
    *) die "An Issuer ID is a UUID like 57246542-96fe-1a63-e053-0824d011072a — got '$ISSUER'." ;;
  esac
fi

# ─────────────────────────────────────────────────────── 4. the team id
step "4/6  Team ID"
if have_secret APPLE_TEAM_ID; then
  skip "APPLE_TEAM_ID  (shared with the Mac app's notarization — one team, one id)"
  TEAMID=""
else
  printf '%s  Membership details → the 10-character Team ID:%s\n' "$DIM" "$OFF"
  printf '       https://developer.apple.com/account#MembershipDetailsCard\n'
  TEAMID="$(ask 'Team ID (10 characters, e.g. AB12CD34EF)')"
  case "$TEAMID" in ??????????) : ;; *) die "A Team ID is exactly 10 characters — got '$TEAMID'." ;; esac
fi

# ──────────────────────────────────────────── 5. secrets + the switch
step "5/6  GitHub secrets + the switch"
[ -n "${TEAMID}" ] && set_secret APPLE_TEAM_ID "$TEAMID"
if [ -n "${P8}" ]; then
  set_secret ASC_KEY_ID "$KEYID"
  set_secret ASC_ISSUER_ID "$ISSUER"
  set_secret ASC_API_KEY_P8_BASE64 "$(base64 -i "$P8" | tr -d '\n')"
fi
if [ "$PASTE" = 1 ]; then
  printf 'true' | pbcopy
  printf '  %s→%s  the variable: create %sENABLE_TVOS_SIGNING%s = true at\n' "$YEL" "$OFF" "$BOLD" "$OFF"
  printf '      https://github.com/%s/settings/variables/actions\n' "$REPO"
  pause
else
  if [ "$(gh variable get ENABLE_TVOS_SIGNING --repo "$REPO" 2>/dev/null || true)" = "true" ]; then
    skip "ENABLE_TVOS_SIGNING = true"
  else
    gh variable set ENABLE_TVOS_SIGNING --repo "$REPO" --body true
    ok "ENABLE_TVOS_SIGNING = true — the switch is on"
  fi
fi

# ───────────────────────────────────────────────────────── 6. ship it
step "6/6  Ship"
if [ "$SHIP" = 1 ] && [ "$PASTE" = 0 ]; then
  gh workflow run tvos.yml --repo "$REPO" -f channel=testflight
  ok "dispatched: tvos · channel=testflight"
  printf '  %swaiting for the run to register…%s\n' "$DIM" "$OFF"
  sleep 6
  RUN_ID="$(gh run list --repo "$REPO" --workflow tvos.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
  gh run watch "$RUN_ID" --repo "$REPO" --exit-status \
    && ok "uploaded — Apple processes 5–30 min, then the build appears under TestFlight" \
    || die "the run failed — its log names the cause; tvos/TESTFLIGHT.md Part 5 lists the first-run failure modes."
else
  printf '  Everything is set. Cut the build with either of:\n'
  printf '      gh workflow run tvos.yml --repo %s -f channel=testflight\n' "$REPO"
  printf '      %shttps://github.com/%s/actions/workflows/tvos.yml%s → Run workflow → testflight\n' "$DIM" "$REPO" "$OFF"
fi
printf '
%sAfter Apple finishes processing%s (App Store Connect → %s → TestFlight):
  · Internal Testing → ＋ group → toggle Automatic distribution → add yourself
  · On the Apple TV: App Store → install %sTestFlight%s → sign in with the
    invited Apple Account → %s appears → Install
  tvos/TESTFLIGHT.md Part 6 covers external testers and the public link.
' "$BOLD" "$OFF" "$APP_NAME" "$BOLD" "$OFF" "$APP_NAME"
