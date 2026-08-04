# Signing & notarizing Aethra Kairos (macOS)

Turn the Mac app from "unsigned, needs a right-click on first launch" into
**signed + notarized — double-click and it opens.** Everything is already
wired; this is the ordered, no-guessing runbook to switch it on.

> **The signing happens in CI**, not on your machine. You create the
> credentials once, store them as GitHub secrets, flip one variable, and every
> release the workflow builds is signed, notarized and stapled. You never run
> `codesign` by hand.

**What's wired for you** (`.github/workflows/desktop.yml`): opt-in on the
`ENABLE_MACOS_SIGNING` repo variable; when on, a preflight proves the
certificate before spending a build on it, then `tauri-action` imports the
Developer ID cert, signs under the hardened runtime, notarizes with your Apple
ID + app-specific password, staples the ticket — and a final step asks
Gatekeeper whether it would actually open.

This pipeline is ported from **securaCV**, whose comments record four failures
that each cost a release cycle. The odd-looking parts are all scars.

---

## 0. Prerequisites

- **Apple Developer Program** membership ($99/yr) — the personal team from a
  free Apple ID **cannot** create a Developer ID certificate.
- A **Mac** (to make the certificate request and export the key).

---

## 1. On your Mac + developer.apple.com

**1a. Team ID** — [developer.apple.com/account](https://developer.apple.com/account)
→ **Membership details** → copy the 10-character **Team ID** (e.g. `AB12CD34EF`).
→ this is `APPLE_TEAM_ID`.

**1b. Make a certificate request (CSR).** This generates your private key
locally and keeps it on your Mac:

- **Keychain Access** → **Certificate Assistant → Request a Certificate From a
  Certificate Authority…**
- **User Email**: your Apple ID email. **CA Email: leave blank.**
- Select **"Saved to disk"**.

**1c. Create the *Developer ID Application* certificate** — the one and only
correct type for an app downloaded outside the App Store:

- developer.apple.com → **Certificates** → **＋**
- pick **"Developer ID Application"** ⚠️ *not* "Apple Distribution", *not*
  "Developer ID Installer" (that one is for `.pkg`).
- Upload the CSR → **Download** the `.cer` → **double-click it** so it installs
  into your **login** keychain and pairs with the key from 1b.

**1d. App-specific password (for notarization).**
[appleid.apple.com](https://appleid.apple.com) → **Sign-In & Security** →
**App-Specific Passwords** → **＋** → name it `aethra notarize`. Copy the
`xxxx-xxxx-xxxx-xxxx` (you only see it once). Your Apple ID email is
`APPLE_ID`; this password is `APPLE_PASSWORD`.

---

## 2. Export the cert and set the secrets — one command

On the Mac holding the signing key:

```sh
bash desktop/scripts/set-signing-secrets.sh
```

It finds your **Developer ID Application** identity, repacks it into a `.p12`
holding **only** that one certificate and its matching private key, and sets
`APPLE_DESKTOP_CERTIFICATE`, `APPLE_DESKTOP_CERTIFICATE_PASSWORD` and
`APPLE_SIGNING_IDENTITY` — all three from the same certificate, so they cannot
disagree. Nothing reaches GitHub unless the file it built passes the same
checks CI runs. macOS will ask permission to export the private key; that
prompt is the keychain doing its job.

Those three are the *certificate*. Signing also needs the notarization
credentials and the variable — which is the second script:

```sh
bash desktop/scripts/finish-signing-setup.sh
```

It asks for the Apple ID, the app-specific password and the Team ID, checks the
shape of each before storing it (pasting your *account* password instead of an
app-specific one is the single commonest mistake, and notarization only tells
you eight minutes into a build), reports whether the updater key is set, and
then flips `ENABLE_MACOS_SIGNING`. It refuses to arm signing until the
certificate secrets are actually there.

Both scripts are safe to re-run and neither ever prints a secret back.

**Why two scripts and not one:** the certificate has to be exported on the Mac
holding the private key, and nothing else does. Splitting them means the half
that needs a specific machine is the only half that needs it.

---

## 3. The secrets and the variable

Repo → **Settings → Secrets and variables → Actions**.

> ⚠️ **The certificate secrets are deliberately not named `APPLE_CERTIFICATE`.**
> In securaCV the iOS/tvOS pipelines used that name for an **Apple
> Distribution** `.p12` (App Store signing). A Mac app needs a **Developer ID
> Application** `.p12` (notarized, downloaded outside the store) — a different
> certificate for a different job. They shared one name until 2026-07-29, and
> setting up the iPhone app silently overwrote the desktop identity: three
> releases in a row failed with *"certificate … does not match provided
> identity"*. One secret, one meaning.

| Secret | Value |
|---|---|
| `APPLE_DESKTOP_CERTIFICATE` | base64 of a **Developer ID Application** `.p12` holding that one identity |
| `APPLE_DESKTOP_CERTIFICATE_PASSWORD` | that `.p12`'s export password |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)`, byte-for-byte |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | the app-specific password from **1d** |
| `APPLE_TEAM_ID` | the 10-character Team ID from **1a** |

**Variable** (the *Variables* tab, not Secrets):

| Variable | Value |
|---|---|
| `ENABLE_MACOS_SIGNING` | `true` |

`finish-signing-setup.sh` sets all of these for you; the table is here so you
can check its work, or do it by hand.

Nothing signs until that variable is exactly `true`. That is on purpose: it
means the switch is one visible thing, not "whether six secrets happen to all
be set."

### The separate one worth doing anyway

`TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`) has **nothing to do with Apple**
and costs nothing. It is what lets the app verify an update it has downloaded —
without it, auto-update cannot install anything. It is the difference between
"the app updates itself" and "I tell everyone to re-download."

⚠️ **`tauri.conf.json` already embeds a public key**, and an update is only
installed if it was signed by the private half of *that* pair. Generating a
fresh keypair without replacing the embedded public one produces releases every
existing install silently refuses — silently, because a signature that does not
verify is indistinguishable from no update being there at all. If you generate
a new key:

```sh
cd desktop && npx @tauri-apps/cli signer generate -w ~/.tauri/aethra.key
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo kmay89/aethrakairos < ~/.tauri/aethra.key
# then paste the PUBLIC key it printed into
# desktop/src-tauri/tauri.conf.json → plugins.updater.pubkey, and commit it
```

---

## 4. Cut a build

A validation run signs and notarizes without publishing anything:

```sh
gh workflow run desktop.yml --ref main -f channel=none
```

Then the real thing — `dev` publishes to the rolling pre-release, `stable` cuts
a normal release with the tag derived from `desktop/src-tauri/tauri.conf.json`:

```sh
gh workflow run desktop.yml --ref main -f channel=dev
gh workflow run desktop.yml --ref main -f channel=stable
```

The last step of a signed build asks **Gatekeeper** whether it would open the
`.dmg`, and fails the run if it would not. A release that quietly came out
unsigned is the exact failure this pipeline exists to prevent, and it is
invisible unless something asks.

---

## What the preflight catches, and why each check is there

Every one of these fires in seconds instead of eight minutes into a bundle.

- **`APPLE_DESKTOP_CERTIFICATE` empty while signing is on.** The most likely
  half-finished state.
- **Extra identities in the `.p12`.** Tauri validates the **last** certificate
  it finds, so an iOS cert riding along aborts the build even though the right
  one is present. `security export -t identities` exports *every* identity in
  the keychain, which is exactly how it happens.
- **The identity is not in the `.p12` at all**, or is not a `Developer ID
  Application` one.
- **An expired certificate** — which otherwise fails with a message about the
  *identity*, not the date. Already expired is fatal; expiring within 30 days
  only warns, because a release on the last valid day must still ship.
- **The PKCS#12 MAC.** OpenSSL 3 writes AES-256 with a SHA-256 MAC; macOS's
  Security framework understands only the legacy SHA-1 MAC and rejects the rest
  as *"MAC verification failed during PKCS12 import (wrong password?)"*. The
  password is **not** wrong — that message is a lie, and every openssl check
  passes on such a file. The preflight re-encrypts it and then proves the
  result imports using the same `security import` command tauri runs.
- **Missing notarization credentials.** Signed-but-not-notarized still will not
  open, and looks like a successful release until someone downloads it.
