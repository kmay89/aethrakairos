#!/bin/bash
# ONE COMMAND, START TO FINISH — turning on signed + notarized Mac releases.
#
#     bash desktop/scripts/signing-wizard.sh
#
# Run it as many times as you like. Every step checks whether it is already
# done and skips itself, so a re-run after a coffee break picks up exactly
# where you stopped, and a re-run after everything works does nothing at all.
# That is the whole design: the thing people actually need is not a script that
# does eight steps, it is a script that can be run again after step five went
# wrong without undoing steps one to four.
#
#   --paste   never write to GitHub; copy each value to the clipboard and wait
#             while you paste it into the web UI. For when you would rather not
#             sign the CLI in.
#   --build   after setup, also run the validation build and watch it.
#
# The one thing this cannot do for you: the certificate has to be exported on
# the Mac holding its private key, because macOS will not release the key
# without your login password. Everything around that is automated.

set -euo pipefail

REPO="${REPO:-kmay89/aethrakairos}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASTE=0
RUN_BUILD=0
for a in "$@"; do
  case "$a" in
    --paste) PASTE=1 ;;
    --build) RUN_BUILD=1 ;;
    # only the comment lines, so the help can never leak a line of code
    -h|--help) sed -n '2,30p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$a" >&2; exit 2 ;;
  esac
done
export PASTE

BOLD=$'\033[1m'; DIM=$'\033[2m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; OFF=$'\033[0m'
step() { printf '\n%s──── %s ────%s\n' "$BOLD" "$*" "$OFF"; }
ok()   { printf '  %sok%s   %s\n' "$GRN" "$OFF" "$*"; }
skip() { printf '  %s--%s   %s %s(already done)%s\n' "$DIM" "$OFF" "$*" "$DIM" "$OFF"; }
warn() { printf '  %s!!%s   %s\n' "$YEL" "$OFF" "$*"; }
die()  { printf '\n%sSTOPPED%s %s\n\n' "$RED" "$OFF" "$*" >&2; exit 1; }
pause(){ printf '\n  Press RETURN to continue, or Ctrl-C to stop here. '; read -r _; }

# Reading STATE from GitHub rather than from a local file is deliberate. A
# progress file lies the moment somebody deletes a secret in the web UI, and
# then the wizard skips the step that would have fixed it. The repo is the
# only honest record of what is set.
GH_OK=0
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then GH_OK=1; fi
have_secret() { [ "$GH_OK" = 1 ] && gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
have_var()    { [ "$GH_OK" = 1 ] && gh variable list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
var_is_true() { [ "$GH_OK" = 1 ] && [ "$(gh variable get ENABLE_MACOS_SIGNING --repo "$REPO" 2>/dev/null || true)" = "true" ]; }

printf '%s\nSigned + notarized Mac releases for %s%s\n' "$BOLD" "$REPO" "$OFF"
if [ "$PASTE" = 1 ]; then
  printf '%sPaste mode: nothing is written to GitHub. Each value lands on your\nclipboard and you paste it into the web UI.%s\n' "$DIM" "$OFF"
elif [ "$GH_OK" = 0 ]; then
  printf '%sgh is not signed in, so this run cannot read what is already set or\nwrite anything. Either sign in, or re-run with --paste.%s\n' "$DIM" "$OFF"
fi

# ─────────────────────────────────────────────────────────── 1. tools
step "1/6  Tools"
[ "$(uname -s)" = "Darwin" ] || die "Run this on the Mac holding your signing key."
command -v security >/dev/null || die "No /usr/bin/security — is this really macOS?"
command -v openssl  >/dev/null || die "No openssl."
ok "macOS, security, openssl"
if [ "$PASTE" = 0 ]; then
  if ! command -v gh >/dev/null; then
    warn "GitHub CLI missing."
    printf '      brew install gh && gh auth login\n'
    printf '      …or re-run this with --paste to skip the CLI entirely.\n'
    die "Install gh, or use --paste."
  fi
  [ "$GH_OK" = 1 ] || die "gh is installed but not signed in. Run: gh auth login
  (or re-run this with --paste)"
  ok "gh signed in"
fi

# ─────────────────────────────────────────────────────── 2. the certificate
step "2/6  The Developer ID certificate"
if [ "$PASTE" = 0 ] && have_secret APPLE_DESKTOP_CERTIFICATE \
   && have_secret APPLE_DESKTOP_CERTIFICATE_PASSWORD && have_secret APPLE_SIGNING_IDENTITY; then
  skip "all three certificate secrets are set"
  printf '      %sTo replace them (new or renewed certificate):%s\n' "$DIM" "$OFF"
  printf '      %sbash %s/set-signing-secrets.sh%s\n' "$DIM" "$HERE" "$OFF"
else
  if ! security find-identity -v -p codesigning 2>/dev/null | grep -q 'Developer ID Application:'; then
    warn "No 'Developer ID Application' certificate in this keychain."
    printf '
      This is the one certificate a downloaded-outside-the-App-Store app
      signs with. It is NOT "Apple Distribution" — that one is for the App
      Store, and using it is the mistake that cost securaCV three releases.

      Make one (about five minutes), then re-run this wizard:

        1. Keychain Access -> Certificate Assistant -> Request a Certificate
           From a Certificate Authority. Your email; CA Email BLANK;
           "Saved to disk".
        2. https://developer.apple.com/account/resources/certificates/add
           -> "Developer ID Application" -> upload that request -> Download.
        3. Double-click the downloaded .cer so it lands in your login keychain.

      Full detail: desktop/SIGNING.md section 1.
'
    die "Create the certificate, then run this again."
  fi
  ok "found a Developer ID Application identity"
  printf '      Exporting it. macOS will ask permission to release the private\n'
  printf '      key — that prompt is the keychain doing its job. Allow it.\n'
  pause
  bash "$HERE/set-signing-secrets.sh" || die "The certificate step stopped — its message above says why."
fi

# ─────────────────────────────────────────── 3. notarization credentials
step "3/6  Notarization credentials"
printf '  Signing alone is not enough: an app that is signed but NOT notarized\n'
printf '  still will not open, and it looks like a perfectly good release until\n'
printf '  somebody downloads it.\n\n'

need_secret() {   # name, prompt, regex, hint
  local name="$1" prompt="$2" re="$3" hint="$4" v=""
  if have_secret "$name"; then skip "$name"; return 0; fi
  printf '  %s%s%s\n    %s\n' "$BOLD" "$name" "$OFF" "$hint"
  printf '    value: '
  if [ "$name" = "APPLE_PASSWORD" ]; then read -r -s v; printf '\n'; else read -r v; fi
  [ -n "$v" ] || die "$name is required."
  printf '%s' "$v" | grep -Eq "$re" || die "That does not look like $name. $hint"
  if [ "$PASTE" = 1 ]; then
    printf '%s' "$v" | pbcopy
    printf '    copied. Paste it at https://github.com/%s/settings/secrets/actions/new\n' "$REPO"
    printf '    as %s, then press RETURN. ' "$name"; read -r _
    printf 'aethra-signing-clipboard-cleared' | pbcopy
  else
    printf '%s' "$v" | gh secret set "$name" --repo "$REPO"
  fi
  ok "$name set"
}
need_secret APPLE_ID "Apple ID" \
  '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' \
  "The email you sign in to developer.apple.com with."
# An app-specific password is ALWAYS xxxx-xxxx-xxxx-xxxx. Checking the shape
# catches the commonest mistake here by a mile — pasting the Apple ID account
# password — which Apple otherwise reports as an auth failure eight minutes
# into a build.
need_secret APPLE_PASSWORD "App-specific password" \
  '^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$' \
  "appleid.apple.com -> Sign-In & Security -> App-Specific Passwords -> +.
    Looks like abcd-efgh-ijkl-mnop. NOT your Apple ID password. (hidden as you type)"
need_secret APPLE_TEAM_ID "Team ID" \
  '^[A-Z0-9]{10}$' \
  "developer.apple.com/account -> Membership details -> Team ID. 10 characters."

# ───────────────────────────────────────────────────── 4. the updater key
step "4/6  Auto-update signing (nothing to do with Apple)"
if have_secret TAURI_SIGNING_PRIVATE_KEY; then
  skip "TAURI_SIGNING_PRIVATE_KEY — the app can install its own updates"
else
  warn "TAURI_SIGNING_PRIVATE_KEY is not set."
  printf '
      Releases will still build. No installed copy will ever auto-update
      from them, because it cannot verify what it downloaded.

      %sThe trap:%s tauri.conf.json already embeds a PUBLIC key. An update
      installs only if signed by the private half of THAT pair. Generate a
      fresh keypair without replacing the embedded public one and every
      existing install refuses the update SILENTLY — a signature that does
      not verify looks exactly like no update being there.

      So if you make a new one, do all three:

        cd desktop && npx @tauri-apps/cli signer generate -w ~/.tauri/aethra.key
        gh secret set TAURI_SIGNING_PRIVATE_KEY --repo %s < ~/.tauri/aethra.key
        # paste the PUBLIC key it prints into
        # desktop/src-tauri/tauri.conf.json -> plugins.updater.pubkey, commit it

      Skipping this is fine for now — signing works without it.
' "$BOLD" "$OFF" "$REPO"
fi

# ────────────────────────────────────────────────────────── 5. arm it
step "5/6  Arming"
if var_is_true; then
  skip "ENABLE_MACOS_SIGNING is true"
elif [ "$PASTE" = 1 ]; then
  printf '  Set a repository %sVARIABLE%s (the Variables tab, not Secrets):\n\n' "$BOLD" "$OFF"
  printf '    https://github.com/%s/settings/variables/actions/new\n' "$REPO"
  printf '    Name:  ENABLE_MACOS_SIGNING\n    Value: true\n'
  printf '\n  Press RETURN when it is saved. '; read -r _
  ok "ENABLE_MACOS_SIGNING (set by you)"
else
  gh variable set ENABLE_MACOS_SIGNING --repo "$REPO" --body true
  ok "ENABLE_MACOS_SIGNING set to true"
fi

# ──────────────────────────────────────────────────────── 6. prove it
step "6/6  Prove it"
printf '  A validation build signs and notarizes exactly like a release and\n'
printf '  publishes nothing. The preflight fails in about twenty seconds if a\n'
printf '  certificate is wrong, so a mistake costs you that instead of a bad\n'
printf '  release.\n\n'
printf '    gh workflow run desktop.yml --repo %s --ref main -f channel=none\n' "$REPO"
printf '    gh run watch --repo %s\n\n' "$REPO"
if [ "$RUN_BUILD" = 1 ] && [ "$GH_OK" = 1 ]; then
  printf '  Starting it now (--build).\n'
  gh workflow run desktop.yml --repo "$REPO" --ref main -f channel=none
  sleep 6
  gh run watch --repo "$REPO" || true
else
  printf '  %sRe-run this wizard with --build to start it for you.%s\n' "$DIM" "$OFF"
fi

printf '
%sWhen that run is green:%s

  gh workflow run desktop.yml --repo %s --ref main -f channel=dev     # rolling pre-release
  gh workflow run desktop.yml --repo %s --ref main -f channel=stable  # the real one

Install the dev build and double-click it — no right-click. That is the
first time any of this meets a real Mac, which is exactly why the dev
channel exists.
' "$BOLD" "$OFF" "$REPO" "$REPO"
