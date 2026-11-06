# Aethra Kairos for Apple TV — App Store review checklist

Everything App Review asks, answered ahead of time. `TESTFLIGHT.md` is the
build-and-upload runbook (the token, signing, TestFlight); **this** file is what
you fill in on the App Store Connect *product page* and *App Review* screens once
a build is processed. Follow it top to bottom the first time; after that it is a
reference for re-submissions.

The whole review posture rests on one true fact, so it is worth stating once:

> **The app collects nothing and phones home to nobody.** No accounts, no
> sign-in, no analytics, no advertising, no third-party SDKs. Hearts, history,
> resume position and the two mixing preferences live only on the device. The
> only bytes that leave are HTTPS requests for the published catalog and its
> audio (the STAGE screen, which would add a read-only WebSocket, is hidden
> until its relay exists). Answer every questionnaire from that fact and the
> answers below fall out consistently.

Cross-check the in-repo sources of truth as you go: `PrivacyInfo.xcprivacy`
(the shipped privacy manifest), `Info.plist` (encryption + background modes),
`LICENSE-AUDIO` (the streaming right), and `TESTFLIGHT.md` (bundle ID, app
record, signing).

---

## 0. Identity (must already match TESTFLIGHT.md)

| Field | Value |
| --- | --- |
| App name | `Aethra Kairos` (fallback `Aethra Kairos — Möbius⁸` if taken) |
| Bundle ID | `com.aethrakairos.tv` |
| Platform | tvOS only |
| Primary category | **Music** |
| Secondary category | *(leave empty, or Entertainment)* |
| Price | **Free** (no IAP, no subscriptions) |

If any of these is not yet set, do **TESTFLIGHT.md Parts 1–2 first** — the app
record and bundle ID come from there.

---

## 1. Age rating → **4+**

App Store Connect → your app → **General → Age Rating → Edit**. The app is an
abstract music visualizer; there is no user-generated content, no chat, no web
browser, no ads. Answer **None / No** to every content-descriptor question:

- Cartoon or Fantasy Violence — **None**
- Realistic Violence — **None**
- Sexual Content or Nudity — **None**
- Profanity or Crude Humor — **None**
- Alcohol, Tobacco, or Drug Use or References — **None**
- Horror/Fear Themes, Mature/Suggestive Themes, Gambling — **None**
- Medical/Treatment Information — **None**
- **Unrestricted Web Access** — **No** (the app has no web view)
- **Gambling and Contests** — **No**
- Age Assurance / Age Verification — **No**

Result: **4+**. Nothing to justify.

---

## 2. App Privacy → **Data Not Collected**

App Store Connect → your app → **App Privacy → Get Started / Edit**.

1. First question — *"Do you or your third-party partners collect data from this
   app?"* → choose **No, we do not collect data from this app.**
2. That is the whole questionnaire. Publish.

This must stay identical to the shipped **`PrivacyInfo.xcprivacy`**, which
declares:

- `NSPrivacyTracking` = **false**, `NSPrivacyTrackingDomains` = **empty** — the
  app does no tracking and contacts no tracking domains.
- `NSPrivacyCollectedDataTypes` = **empty** — no data type is collected.
- `NSPrivacyAccessedAPITypes` — three **required-reason** API declarations, none
  of which is data collection (they are on-device housekeeping):

  | Category | Reason | Why it is used |
  | --- | --- | --- |
  | `NSPrivacyAccessedAPICategoryUserDefaults` | **CA92.1** | The app's own preferences (`Player.swift`, `Rooms.swift`, `@AppStorage`) and the catalog's ETag (`CatalogStore.swift`). |
  | `NSPrivacyAccessedAPICategoryFileTimestamp` | **C617.1** | `TrackLoader.swift` reads/sets modification dates on files in the app's own audio cache to run an LRU eviction. |
  | `NSPrivacyAccessedAPICategorySystemBootTime` | **35F9.1** | `ProcessInfo.systemUptime` / `mach_absolute_time()` time fades, throttles and the analyser's clock (`AudioEngine`, `Player`, `Library`, `NowPlayingCenter`, `Analyzer`) — on-device timing only. |

  `NSPrivacyAccessedAPICategoryDiskSpace` and `…ActiveKeyboards` are **not**
  declared — the app calls neither. If a future change adds a free-space check
  (`volumeAvailableCapacity*`, `systemFreeSize`) or reads active keyboards, add
  the matching category to the manifest **and** revisit this table, or the build
  will draw an `ITMS-91053` "missing API declaration" email from Apple.

> Consistency rule: the App Privacy answers on the web and the on-device
> manifest must never disagree. Both say **no collection, no tracking**.

---

## 3. Export compliance / encryption → **exempt, no interrogation**

- `Info.plist` ships **`ITSAppUsesNonExemptEncryption` = `false`**.
- The app uses only standard HTTPS (TLS) for the catalog and audio and standard
  WSS (TLS) for the stage relay (hidden for now). That is exempt encryption under the
  U.S. export rules, and the Info.plist key means **App Store Connect never asks
  the export-compliance questions** — builds move straight to "Ready to Submit"
  / "Ready to Test."
- Do **not** add `NSAllowsArbitraryLoads`. Default App Transport Security holds:
  the media host and the relay are `https://` and `wss://`, so no ATS exception
  is needed, and adding one would invite an avoidable review question.

If App Review ever asks anyway, the one-line answer is: *"The app uses only
HTTPS/TLS for network transport and contains no proprietary or non-standard
cryptography; it qualifies for the export exemption, and `Info.plist` declares
`ITSAppUsesNonExemptEncryption = NO`."*

---

## 4. Background audio → justified

`Info.plist` declares **`UIBackgroundModes` = `[audio]`**. A music player that
went silent the moment the app was backgrounded would read as broken to Review;
this lets playback continue.

- The app configures a single `AVAudioSession` category `.playback` for its
  lifetime (`Player.swift`), publishes Now Playing metadata and generative
  artwork to `MPNowPlayingInfoCenter`, and honors the remote transport commands
  — so lock-screen / control-center / Siri Remote play-pause behave correctly.
- Justification for App Review notes: *"The app is an audio player. It declares
  the `audio` background mode so streamed playback continues while the app is
  not foreground, exactly as expected of a music app. It plays audio only; there
  is no VoIP, location, or other background activity."*

---

## 5. Rights to stream the catalog (LICENSE-AUDIO)

App Review will want to know you have the right to the music. You do, and the
binary bundles none of it:

- **The publisher is the rights holder.** Per `LICENSE-AUDIO` at the repository
  root: *"© ERRERlabs / Aethra Kairos — all rights reserved. Every audio
  recording distributed through this catalog … is the property of ERRERlabs /
  Aethra Kairos,"* and it expressly permits *"Streaming the recordings from this
  catalog, through this repository's player or any client reading
  docs/catalog.json as published here."* This tvOS app is exactly such a client.
- **The binary ships no audio.** The app streams from the canonical host
  (`aethrakairos.com/catalog.json`, schema v2, refused if not), verifies each
  download against the catalog's own `sha256`, and keeps only an on-device LRU
  cache of what it played. No recording is embedded in the app bundle.
- **What to have ready** for Review notes or a Rights/Content question:
  - Statement of ownership: the developer account holder is (or represents)
    ERRERlabs / Aethra Kairos, the rights holder named in `LICENSE-AUDIO`.
  - The streaming right above, quoted from `LICENSE-AUDIO`.
  - Note that provenance is verifiable — each track carries a content SHA-256
    and publication date, with a fingerprint index and optional catalog
    signature (see `LICENSE-AUDIO` → PROVENANCE).

Suggested Review-notes line: *"All music streamed by this app is owned by the
developer (ERRERlabs / Aethra Kairos) and streamed from our own catalog under
our own licence (see LICENSE-AUDIO). The app bundles no audio and streams no
third-party content."*

---

## 6. The no-account / no-data privacy story (for Review notes & the Support page)

- **No sign-in.** The app opens straight into the field; a listener never
  creates or enters an account, an email, or a password. There is no login
  screen to demo because there is no login.
- **No personal data, ever.** Hearts, play history (capped, oldest dropped),
  resume position and the app's preferences are written to on-device storage
  (small JSON files in the first folder proved writable — Application Support,
  else Caches — and UserDefaults) and mirrored nowhere. Deleting the app
  removes all of it.
- **No analytics, ads, or trackers.** No third-party SDKs are linked; there is
  no SPM/CocoaPods dependency. Only first-party Apple frameworks are used.
- **Network, in full:** HTTPS GET of the published catalog (conditional — an
  unchanged catalog is a 304) and its audio. Nothing else touches the network.
  (The STAGE client is compiled in but its shelf is hidden —
  `StageClient.available = false` — until the relay it needs is deployed; see
  STAGE.md. Re-enable it, and restore its line here and in §7, only then.)
- **Privacy Policy URL:** `https://aethrakairos.com/privacy` (`docs/privacy.html`).
- **Support URL:** `https://aethrakairos.com/support` (`docs/support.html`,
  which sends questions to the repository's GitHub Issues).
- **Marketing URL** (optional): `https://aethrakairos.com/`.

---

## 7. Review demo & notes (paste into "App Review Information → Notes")

No credentials are needed — leave the demo-account fields **empty** and, if a
toggle exists, mark **"Sign-in not required."** Suggested notes:

```
Aethra Kairos is a music player and Metal audio-visualizer for Apple TV.

• No account or sign-in — the app opens directly into playback. Leave the
  demo-account fields blank.
• To review: open the app and click PARTY, CHILL or SHUFFLE on the welcome
  screen — music starts at once, blended nonstop. Swipe up/down on the Siri
  Remote to change the light show, left/right for the previous/next song;
  press Menu to browse albums, rituals and Settings (Menu again goes to the
  Home Screen). The on-screen card melts away during playback by design — press
  any button to bring it back.
• Data: none collected. See our privacy manifest (PrivacyInfo.xcprivacy) and
  App Privacy answer ("Data Not Collected").
• Music rights: all recordings are owned by the developer and streamed from our
  own catalog under our own licence; the binary bundles no audio.
• Encryption: HTTPS/TLS only; ITSAppUsesNonExemptEncryption = NO.
• Background audio: declared (UIBackgroundModes = audio) so playback continues
  when backgrounded, as expected of a music app.
• Privacy policy: https://aethrakairos.com/privacy · Support:
  https://aethrakairos.com/support
```

---

## 8. Accessibility (what a VoiceOver reviewer will find)

VoiceOver on tvOS can describe now-playing state:

- The player field announces the current track, whether it is **Playing** or
  **Paused**, and a hint describing the Siri Remote grammar (play/pause, previous/next track,
  room up/down, press-and-hold to love, Menu for shelves). See
  `UI/RemoteControls.swift`.
- The now-playing card exposes the **Favorite** control (value *Loved / Not
  loved*) and a **Progress** value; the corner room-name whisper is a labeled
  accessibility element. See `UI/NowPlayingHUD.swift`.
- **Reduce Flashing** is a first-class setting (SETTINGS shelf) that tightens the
  luminance governor and opens every set in the calm PULSE room — worth naming if
  a photosensitivity question comes up (the visualizer already enforces a WCAG
  2.3.1 flash governor).

---

## 9. Submit

1. Product page filled: name, subtitle, description, keywords, support URL,
   privacy-policy URL, and screenshots (tvOS App Store needs 1920×1080 or
   3840×2160 — `⌘S` in the tvOS simulator saves 1920×1080; see TESTFLIGHT.md §8).
2. Sections 1–6 above answered in App Store Connect.
3. Pick the processed build (uploaded per **TESTFLIGHT.md** Parts 3–5).
4. **Content Rights**: "No, it does not contain, show, or access third-party
   content" — the music is the developer's own (Section 5).
5. **Advertising Identifier (IDFA)**: **No.**
6. **Submit for Review.**

If a build is rejected for a **missing-API-declaration** email
(`ITMS-91053`), it means a required-reason API was added since this pass — find
the new call, add its category+reason to `PrivacyInfo.xcprivacy` (Section 2
table), re-archive, and re-upload. No product-page changes are needed for that.
