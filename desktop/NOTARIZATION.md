# Aethra Kairos for Mac — signing, notarization & the install experience

Everything about how the Mac app is delivered: how people open it today, how to
make it open with **zero warning** (Apple notarization), and how the whole thing
works under the hood. If you only read one section, read the [TL;DR](#tldr).

---

## TL;DR

- The Mac app is currently **unsigned**. First launch shows a Gatekeeper warning
  ("Apple could not verify…"). It's a signing formality, not a sign of anything
  unsafe — the whole app is open source.
- **Notarization is already wired.** The build signs, notarizes, and staples
  automatically **the moment six `APPLE_*` secrets exist** — no code change.
  Until then, builds are unsigned and nothing breaks.
- To switch it on: add the six secrets ([Part 2](#part-2--turn-on-notarization-one-time-setup)),
  then cut a stable release. Every release from then on opens with a plain
  double-click.
- Users stuck on the warning today: [Part 1](#part-1--opening-the-app-today-unsigned).

---

## Part 1 — Opening the app today (unsigned)

Until notarization is on, the first launch needs a one-time nudge. Any **one** of
these works; they're all documented for users at **aethrakairos.com/mac**.

**A. Right-click → Open** *(simplest, older macOS)*
Right-click (or Control-click) the app in Applications → **Open** → **Open** again.

**B. System Settings → Open Anyway** *(macOS Sequoia / 15+, where right-click is refused)*
Try to open the app once (it gets blocked) → **System Settings → Privacy &
Security** → scroll to **Security** → *"Aethra Kairos was blocked…"* → **Open
Anyway** → confirm with Touch ID/password. This whitelists it permanently.

**C. One-line command** *(foolproof, any macOS)*
Open **Terminal** and paste:

```sh
xattr -dr com.apple.quarantine "/Applications/Aethra Kairos.app"
```

It clears the "downloaded from the internet" quarantine flag, so the app then
opens normally. If the app lives somewhere other than `/Applications`, type
`xattr -dr com.apple.quarantine ` (with a trailing space) and **drag the app into
the Terminal window** to fill in the path.

> Once notarization is on (Part 2), none of this is needed — the app just opens.

---

## Part 2 — Turn on notarization (one-time setup)

### What you need

- An **Apple Developer Program** membership ($99/year).
- ~15 minutes.

### The six secrets

Add these under **GitHub → repo → Settings → Secrets and variables → Actions →
New repository secret**. The build stays unsigned until **all six** are present.

| Secret | What it is | Where it comes from |
|---|---|---|
| `APPLE_TEAM_ID` | Your 10-character Team ID | [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| `APPLE_ID` | Your Apple ID email | (your Apple account) |
| `APPLE_PASSWORD` | An **app-specific** password (not your login password) | [appleid.apple.com](https://appleid.apple.com) → Sign-In & Security → App-Specific Passwords |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` | The cert's exact name (step 4) |
| `APPLE_CERTIFICATE` | base64 of your Developer ID `.p12` | Exported from Keychain (step 4) |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` | You choose it (step 4) |

### Step-by-step

**1. Team ID** — [developer.apple.com/account](https://developer.apple.com/account)
→ **Membership** → copy the 10-character **Team ID**. That's `APPLE_TEAM_ID`.

**2. Apple ID** — your Apple developer account email. That's `APPLE_ID`.

**3. App-specific password** — [appleid.apple.com](https://appleid.apple.com) →
**Sign-In and Security → App-Specific Passwords → +**. Name it "aethrakairos
notarization", copy the generated `xxxx-xxxx-xxxx-xxxx`. That's `APPLE_PASSWORD`.
(Notarization won't accept your real Apple password — it must be app-specific.)

**4. The Developer ID Application certificate** — this yields three of the secrets.

  1. **Make a signing request (CSR):** open **Keychain Access** → menu **Keychain
     Access → Certificate Assistant → Request a Certificate from a Certificate
     Authority**. Enter your email, leave "CA Email" blank, choose **Saved to
     disk**, save `CertificateSigningRequest.certSigningRequest`.
  2. **Create the cert:** [developer.apple.com/account](https://developer.apple.com/account)
     → **Certificates → +** → choose **Developer ID Application** → upload the CSR
     → **Download** the resulting `.cer`.
  3. **Import + export as `.p12`:** double-click the `.cer` (it lands in Keychain
     Access → **My Certificates**). Find **`Developer ID Application: Your Name
     (TEAMID)`**, right-click → **Export** → File Format **Personal Information
     Exchange (.p12)** → save as `cert.p12` and **set an export password**.
     - That exact row name is `APPLE_SIGNING_IDENTITY`.
     - The export password is `APPLE_CERTIFICATE_PASSWORD`.
  4. **base64 the `.p12`:** in Terminal —
     ```sh
     base64 -i cert.p12 | pbcopy
     ```
     The clipboard now holds `APPLE_CERTIFICATE`. Paste it into the secret.

**5. Add all six secrets** in GitHub (Settings → Secrets and variables → Actions).

**6. Cut a notarized release:** **Actions → desktop → Run workflow → channel
`stable`** (or push a `desktop-vX.Y.Z` tag). The build detects the cert, signs
with the hardened runtime, submits to Apple for notarization, staples the ticket,
and publishes. **First launch is now a plain double-click.**

### Verify it worked

- The `desktop` run logs show *"Apple signing configured — this build will be
  signed + notarized"* (instead of *"not configured — unsigned build"*).
- On a Mac: download the new `.dmg`, drag to Applications, double-click — it opens
  with **no** warning. To be thorough: `spctl -a -vvv "/Applications/Aethra
  Kairos.app"` should report `accepted` / `source=Notarized Developer ID`.

---

## Part 3 — How it works under the hood

### The signing gate (why unsigned builds don't break)

Apple signing is triggered by the `APPLE_*` env vars merely being **present** —
an *empty* `APPLE_CERTIFICATE` would make the bundler try to import nothing and
fail. So [`desktop.yml`](../.github/workflows/desktop.yml) has an **"Enable Apple
signing when configured"** step that exports the vars (into `$GITHUB_ENV`) **only
when a certificate is actually set**. No cert → the vars are absent → a clean
unsigned build. This is what keeps notarization dormant-but-ready.

### Hardened runtime, entitlements, and the microphone

Notarization requires the **hardened runtime** (Tauri enables it by default). Under
it, capabilities must be declared:

- [`src-tauri/Entitlements.plist`](src-tauri/Entitlements.plist) grants
  `com.apple.security.device.audio-input` — the **mic-reactive visual** asks for
  the microphone, and without this a notarized build would silently deny it.
- [`src-tauri/Info.plist`](src-tauri/Info.plist) adds `NSMicrophoneUsageDescription`
  — macOS requires a usage string for any mic access, signed or not.

Both are referenced from `tauri.conf.json` (`bundle.macOS.entitlements` /
`bundle.macOS.infoPlist`).

### Two separate signatures

Don't confuse them — they're independent:

| Signature | Secret | Purpose |
|---|---|---|
| **Updater** | `TAURI_SIGNING_PRIVATE_KEY` | Signs `latest.json` so installed apps trust auto-updates. Gated by config (`createUpdaterArtifacts`). |
| **Apple** | the six `APPLE_*` | Signs + notarizes the `.app`/`.dmg` so Gatekeeper opens it without warning. Gated by the step above. |

Either can be on without the other.

### The DMG drag window

[`src-tauri/background.png`](src-tauri/background.png) (660×400, matching the
default DMG window) is set as `bundle.macOS.dmg.background`. It shows a "drag →
Applications" arrow between the app slot (180,170) and the Applications folder
(480,170), plus a first-launch help line pointing at aethrakairos.com/mac.

---

## Part 4 — Troubleshooting

| Symptom in the build log | Cause & fix |
|---|---|
| `security: SecKeychainItemImport … parameters … not valid` / `failed to import keychain certificate` | `APPLE_CERTIFICATE` is empty or not valid base64. Re-run `base64 -i cert.p12 \| pbcopy` and re-paste. (An empty one used to break unsigned builds too — that's now gated, see Part 3.) |
| `No signing identity found` / identity mismatch | `APPLE_SIGNING_IDENTITY` must be the **exact** row name from Keychain, e.g. `Developer ID Application: Jane Doe (AB12CD34EF)`. |
| Notarization rejected: hardened runtime / entitlements | Make sure `Entitlements.plist` is intact and hardened runtime is on (it is by default). |
| Notarization rejected: invalid credentials | `APPLE_PASSWORD` must be an **app-specific** password, not your Apple ID login. `APPLE_TEAM_ID` must match the cert's team. |
| Build is unsigned when you expected signing | The gate only turns on when `APPLE_CERTIFICATE` is non-empty. Confirm all six secrets are set on the **repo** (not an environment). |

---

## Files involved

```
.github/workflows/desktop.yml     # the signing gate + tauri-action build/notarize
desktop/src-tauri/tauri.conf.json # bundle.macOS.{entitlements,infoPlist,dmg.background}
desktop/src-tauri/Entitlements.plist
desktop/src-tauri/Info.plist
desktop/src-tauri/background.png   # the DMG drag-window background
docs/mac.html                      # the public install page (aethrakairos.com/mac)
```

See also [`README.md`](README.md) for the release channels and parity model.
