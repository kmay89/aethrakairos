#!/bin/bash
# The second half of turning on signing: the notarization credentials, the
# updater key, and the one variable that arms the whole thing.
#
#     bash desktop/scripts/finish-signing-setup.sh
#
# set-signing-secrets.sh handles the CERTIFICATE (it has to run on the Mac
# holding the private key). This handles everything else, and it exists for the
# same reason: the dangerous state is a HALF-finished setup, because the
# workflow then builds unsigned under a green checkmark. So nothing here arms
# signing until every piece it depends on is actually present.
#
# Safe to re-run. It only asks for what is missing, and it never prints a
# secret back to the terminal.

set -euo pipefail

REPO="${REPO:-kmay89/aethrakairos}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mok\033[0m   %s\n' "$*"; }
warn() { printf '  \033[33m!!\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[31mx\033[0m    %s\n' "$*"; }
die()  { printf '\n\033[31mSTOPPED\033[0m %s\n\n' "$*" >&2; exit 1; }

say "Checking tools"
command -v gh >/dev/null || die "GitHub CLI missing. Install it: brew install gh"
gh auth status >/dev/null 2>&1 || die "gh is not signed in. Run: gh auth login"
gh repo view "$REPO" >/dev/null 2>&1 || die "Cannot see $REPO with this gh login."
ok "gh signed in, $REPO reachable"

# `gh secret list` shows NAMES, never values — which is all we need and all we
# should ever have. A name being present does not prove the value is right; it
# only proves somebody set something, which is the difference between "not
# configured" and "configured wrong" and worth keeping distinct.
have_secret() { gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
have_var()    { gh variable list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
var_value()   { gh variable get "$1" --repo "$REPO" 2>/dev/null || true; }

# ---------------------------------------------------------------- certificate
say "The certificate (set by set-signing-secrets.sh)"
CERT_OK=1
for s in APPLE_DESKTOP_CERTIFICATE APPLE_DESKTOP_CERTIFICATE_PASSWORD APPLE_SIGNING_IDENTITY; do
  if have_secret "$s"; then ok "$s"; else bad "$s is not set"; CERT_OK=0; fi
done
if [ "$CERT_OK" -eq 0 ]; then
  die "Run this first, on the Mac holding the signing key:
    bash desktop/scripts/set-signing-secrets.sh
  It exports a single-identity .p12 and sets all three from the same
  certificate, so they cannot disagree. See desktop/SIGNING.md §1-2."
fi

# ------------------------------------------------------- notarization details
# Signing without notarizing produces an app macOS still refuses to open — and
# it looks like a completely successful release until somebody downloads it.
say "Notarization credentials"

ask_secret() {   # name, prompt, validator, hint
  local name="$1" prompt="$2" check="$3" hint="$4" value=""
  if have_secret "$name"; then ok "$name (already set — leave blank to keep it)"; fi
  printf '  %s' "$prompt"
  if [ "$name" = "APPLE_PASSWORD" ]; then read -r -s value; printf '\n'; else read -r value; fi
  if [ -z "$value" ]; then
    have_secret "$name" && { ok "$name kept"; return 0; }
    die "$name is required. $hint"
  fi
  if ! printf '%s' "$value" | grep -Eq "$check"; then
    die "That does not look like $name. $hint"
  fi
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  ok "$name set"
}

ask_secret APPLE_ID "Apple ID email: " \
  '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' \
  "It is the email you sign in to developer.apple.com with."

# An app-specific password is always xxxx-xxxx-xxxx-xxxx. Checking the shape
# catches the single most common mistake here by a mile: pasting the Apple ID
# ACCOUNT password, which notarization refuses with an authentication error
# eight minutes into a build.
ask_secret APPLE_PASSWORD "App-specific password (xxxx-xxxx-xxxx-xxxx, hidden): " \
  '^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$' \
  "Make one at appleid.apple.com -> Sign-In & Security -> App-Specific Passwords. NOT your Apple ID password."

ask_secret APPLE_TEAM_ID "Team ID (10 characters): " \
  '^[A-Z0-9]{10}$' \
  "developer.apple.com/account -> Membership details -> Team ID."

# ------------------------------------------------------------- the updater key
# SEPARATE FROM APPLE ENTIRELY, free, and the difference between an app that
# updates itself and one you have to tell people to re-download.
#
# The trap: tauri.conf.json already carries a PUBLIC key, and an update is only
# installed if it was signed by the private half of THAT pair. Generating a
# fresh key without updating the embedded public one produces releases every
# existing install silently refuses — silently, because a signature that does
# not verify is indistinguishable from no update at all. So this reports and
# refuses to guess.
say "Updater signing (nothing to do with Apple)"
if have_secret TAURI_SIGNING_PRIVATE_KEY; then
  ok "TAURI_SIGNING_PRIVATE_KEY is set — auto-update can install"
else
  warn "TAURI_SIGNING_PRIVATE_KEY is NOT set. Releases will build, but no"
  printf '       installed copy can auto-update from them.\n'
  printf '       tauri.conf.json already embeds a PUBLIC key, so a new keypair\n'
  printf '       must be matched there or every existing install will refuse the\n'
  printf '       update without saying why. To make one:\n\n'
  printf '         cd desktop && npx @tauri-apps/cli signer generate -w ~/.tauri/aethra.key\n'
  printf '         gh secret set TAURI_SIGNING_PRIVATE_KEY --repo %s < ~/.tauri/aethra.key\n' "$REPO"
  printf '         # then paste the PUBLIC key it printed into\n'
  printf '         # desktop/src-tauri/tauri.conf.json -> plugins.updater.pubkey\n'
  printf '         # and commit that change, or updates will not verify.\n\n'
fi

# ------------------------------------------------------------------ the switch
say "Arming"
CUR="$(var_value ENABLE_MACOS_SIGNING)"
if [ "$CUR" = "true" ]; then
  ok "ENABLE_MACOS_SIGNING is already true"
else
  gh variable set ENABLE_MACOS_SIGNING --repo "$REPO" --body true
  ok "ENABLE_MACOS_SIGNING set to true"
fi

say "Everything signing needs is present"
printf '
Next, a VALIDATION build. It signs and notarizes exactly like a release and
publishes nothing, so a wrong secret costs you one build instead of a bad
release:

  gh workflow run desktop.yml --repo %s --ref main -f channel=none
  gh run watch --repo %s

The preflight fails in about twenty seconds if a certificate is wrong, so you
will not wait eight minutes to find out. When it goes green:

  gh workflow run desktop.yml --repo %s --ref main -f channel=dev     # rolling pre-release
  gh workflow run desktop.yml --repo %s --ref main -f channel=stable  # the real one

Install the dev build before cutting stable. It is the first time any of this
meets a real Mac.
' "$REPO" "$REPO" "$REPO" "$REPO"
