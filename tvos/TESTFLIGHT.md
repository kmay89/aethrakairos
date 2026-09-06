# Aethra Kairos for Apple TV — the token, TestFlight, and the App Store

Turn the tvOS app from "builds on my Mac" into **"lands on every tester's
Apple TV by itself."** Everything is already wired; this is the ordered,
no-guessing runbook to switch it on.

> **The signing happens in CI**, not on your machine — and unlike the Mac
> pipeline there is **no certificate to export and no .p12 to babysit**. One
> App Store Connect **API key** (a `.p8` file — "the token") lets `xcodebuild`
> create a cloud-managed distribution certificate, sign, and upload straight
> to TestFlight. You create the token once, store four GitHub secrets, flip
> one variable, and every `testflight` run of the workflow ships a build.

**What's wired for you** (`.github/workflows/tvos.yml`): every PR touching
`tvos/**` gets an unsigned compile check on a Mac runner; a manual run with
`channel: testflight` archives, signs under your team with the API key, and
uploads to App Store Connect — gated on the `ENABLE_TVOS_SIGNING` repo
variable so nothing is attempted before the secrets exist.

---

## TL;DR

1. Join the **Apple Developer Program** ($99/yr) — [Part 0](#0-prerequisites).
2. Register the bundle ID **`com.aethrakairos.tv`** — [Part 1](#1-register-the-app-id).
3. Create the **app record** in App Store Connect (platform: tvOS) — [Part 2](#2-create-the-app-record).
4. Generate the **App Store Connect API key** — the token — [Part 3](#3-the-token--app-store-connect-api-key).
5. Store **four secrets + one variable** in GitHub — [Part 4](#4-github-secrets--the-switch).
6. Run the workflow with `channel: testflight` — [Part 5](#5-cut-a-testflight-build).
7. Add testers in TestFlight; they install the **TestFlight app on Apple TV** — [Part 6](#6-distribute-on-testflight).

---

## 0. Prerequisites

- **Apple Developer Program** membership ($99/yr) —
  [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/).
  The free personal team can run the app on your own Apple TV from Xcode, but
  it **cannot** upload to TestFlight — the Program is the price of admission.
  Enrollment usually activates within 48 hours.
- A **Mac with Xcode 16+** for local development. CI does the shipping, so
  strictly the Mac is only needed to develop — but you want one anyway.
- Admin (or Account Holder) access to the Apple Developer account — creating
  API keys is restricted to Admins.

---

## 1. Register the App ID

On [developer.apple.com/account](https://developer.apple.com/account):

**1a. Team ID** — **Membership details** → copy the 10-character **Team ID**
(e.g. `AB12CD34EF`). → this is the `APPLE_TEAM_ID` secret. (If you already
set it up for the Mac app's notarization, it is the same value.)

**1b. Bundle ID** — **Certificates, Identifiers & Profiles** →
**Identifiers** → **＋** →

- **App IDs** → Continue → type **App** → Continue.
- **Description**: `Aethra Kairos TV`.
- **Bundle ID**: **Explicit** → `com.aethrakairos.tv`
  ⚠️ exactly this — it must match `PRODUCT_BUNDLE_IDENTIFIER` in
  `tvos/AethraKairos.xcodeproj`, and it can never be changed after the first
  upload.
- **Capabilities**: leave everything unticked — the app needs nothing special.
- **Register**.

---

## 2. Create the app record

On [appstoreconnect.apple.com](https://appstoreconnect.apple.com):

- **My Apps** → **＋** → **New App**.
- **Platforms**: **tvOS** (only).
- **Name**: `Aethra Kairos` — this is the public App Store name; if the plain
  name is taken, `Aethra Kairos — Möbius⁸` works.
- **Primary language**: English (U.S.).
- **Bundle ID**: pick `com.aethrakairos.tv` from the dropdown (it appears
  because of Part 1b; if the dropdown is empty, wait a minute and reload).
- **SKU**: `aethrakairos-tv` (internal, never shown to anyone).
- **User Access**: Full Access → **Create**.

The record can sit empty for now — uploads attach to it by bundle ID.

---

## 3. The token — App Store Connect API key

This is the single credential CI uses for *everything*: creating the signing
certificate, provisioning, and uploading. Treat it like a password to your
whole developer account.

- App Store Connect → **Users and Access** → **Integrations** tab →
  **App Store Connect API** → **Team Keys**.
  (First time here: click **Request Access** and confirm — it's instant.)
- **＋ Generate API Key**.
- **Name**: `aethra tvos ci`.
- **Access**: **App Manager** ⚠️ — not Developer (too weak to manage cloud
  signing), not Admin (more power than CI should hold).
- **Generate**, then on the key's row:
  - **Issuer ID** (top of the page, a UUID like
    `57246542-96fe-1a63-e053-0824d011072a`) → this is `ASC_ISSUER_ID`.
  - **Key ID** (10 characters, e.g. `2X9R4HXF34`) → this is `ASC_KEY_ID`.
  - **Download API Key** → you get `AuthKey_<KEYID>.p8`.
    ⚠️ **This download works exactly once.** Store the file somewhere safe
    (a password manager attachment is ideal). If you lose it, revoke the key
    and generate a new one — there is no re-download.

Base64 the key for GitHub (secrets are line-ending–hostile; base64 makes it
paste-proof). On your Mac:

```sh
base64 -i AuthKey_2X9R4HXF34.p8 | pbcopy      # now it's on your clipboard
```

---

## 4. GitHub secrets + the switch

Repo → **Settings** → **Secrets and variables** → **Actions**:

Under **Secrets** (New repository secret ×4):

| Secret | Value |
| --- | --- |
| `APPLE_TEAM_ID` | the 10-character Team ID from 1a |
| `ASC_ISSUER_ID` | the Issuer ID UUID from Part 3 |
| `ASC_KEY_ID` | the 10-character Key ID from Part 3 |
| `ASC_API_KEY_P8_BASE64` | the base64 blob on your clipboard from Part 3 |

Under **Variables** (New repository variable):

| Variable | Value |
| --- | --- |
| `ENABLE_TVOS_SIGNING` | `true` (exactly, lowercase) |

The variable is the switch: until it reads `true`, `testflight` runs refuse
early with a message naming this file, and PR builds stay unsigned compile
checks — nothing breaks, nothing leaks.

---

## 5. Cut a TestFlight build

**Actions** → **tvos** → **Run workflow** → `channel: testflight` → **Run**.

What happens, so nothing in the log is a surprise:

1. The runner writes the `.p8` back out of the secret and hands it to
   `xcodebuild` (`-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`).
2. `xcodebuild archive … -allowProvisioningUpdates` signs with a
   **cloud-managed Apple Distribution certificate** — created automatically on
   the first run, managed by Apple, nothing to export, renew, or store.
3. `xcodebuild -exportArchive` with `destination: upload` sends the build
   straight to App Store Connect. The build number is the workflow run
   number, so every upload is unique and monotonic without touching the repo.
4. Apple **processes** the build (5–30 min). It then appears in App Store
   Connect → your app → **TestFlight** tab.
5. There is **no export-compliance interrogation**: the app declares
   `ITSAppUsesNonExemptEncryption = NO` in its Info.plist (it uses only
   HTTPS, which is exempt), so builds go straight to "Ready to Test".

First-run failure modes, so you don't debug blind:

- `Cloud signing permission error` / `unable to create certificate` → the API
  key's role is Developer; regenerate it as **App Manager** (Part 3).
- `No App Store Connect record found` → Part 2 wasn't done, or the bundle ID
  doesn't match `com.aethrakairos.tv` exactly.
- `Authentication credentials are missing or invalid` → the base64 secret got
  truncated; redo the `base64 | pbcopy` and re-paste.
- The refusal message naming this file → set `ENABLE_TVOS_SIGNING` to `true`
  (Part 4 — it's a *variable*, not a secret).

---

## 6. Distribute on TestFlight

In App Store Connect → your app → **TestFlight**:

**Internal testing** (up to 100 members of your team, instant, no review):

- **Internal Testing** → **＋** → group name `core`.
- Toggle **Automatic distribution** on — every future upload reaches the
  group by itself.
- **Testers** → **＋** → pick people. Anyone you add must first exist under
  **Users and Access** (any role works, even Customer Support).

**External testing** (up to 10,000 testers, first build per group passes a
light Beta App Review, usually <24h):

- **External Testing** → **＋** → group name `listeners`.
- Add a build → answer the two review questions (what to test, contact info).
- Either add testers by email or click **Public link** and put the link
  anywhere — aethrakairos.com is the obvious place.

**On the Apple TV** (what testers actually do):

1. Open the **App Store** on Apple TV → search **TestFlight** → install.
   (TestFlight is a real tvOS app.)
2. Sign in with the same Apple Account that accepted the email invite —
   or, for a public link, **TestFlight → Redeem** and type the short code the
   link shows.
3. Aethra Kairos appears in TestFlight → **Install**. Builds expire after 90
   days; automatic distribution means the next CI run refreshes everyone.

---

## 7. Local development (none of the above required)

```
open tvos/AethraKairos.xcodeproj
```

- **Simulator**: pick any *Apple TV 4K* simulator → **⌘R**. No account, no
  signing, no membership.
- **Your own Apple TV**: Xcode → target **AethraKairosTV** → **Signing &
  Capabilities** → tick *Automatically manage signing* → pick your team (a
  free personal team is fine here). Pair the device once (on the Apple TV:
  Settings → Remotes and Devices → Remote App and Devices, with Xcode's
  **Devices and Simulators** window open) → **⌘R**.

---

## 8. When it's time for the real App Store

Same pipeline, no new credentials: the exact build already on TestFlight is
promotable. In App Store Connect fill the app's product page (screenshots
from the simulator are legal: **⌘S** in the tvOS simulator saves 1920×1080),
pick the build, and **Submit for Review**. The only new decisions are
marketing: price (free), category (Music), and the privacy questionnaire —
answer **no data collected**, because the player stores everything on-device
and phones home to nobody, which is the whole point.
