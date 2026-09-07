# STAGE — the Apple TV as a wire screen

DESIGN.md §1.2o names the one gap a native tvOS app was built to close:

> "an Apple TV has no browser to knock on the wire with — AirPlay carries it the
> sound, mirroring a stage window carries it the picture, and any device *with* a
> browser should take the four letters instead, because rendering locally beats
> streaming pixels on every axis the room can see."

The Stage client is that door. The TV joins a booth's room by a **four-letter
code**, receives the booth's ~40-float feature packet at ~30 Hz, and renders the
field on **its own GPU** (Metal), never as streamed pixels. It is a *screen*, not
a player: **it plays no audio** — the booth (a phone or laptop running the web
player) carries the sound; the TV carries only the picture.

This document is the contract between the TV and the booth. It is honest about
what the booth must provide, because the tvOS side ships complete and the booth
side needs one small piece that does not exist in this repo yet.

---

## 1. Why a relay (and not WebRTC)

The web wire (DESIGN §1.2l–§1.2m‴) is two WebRTC data channels brokered by a
mailbox at `kmay89.com /api/room` under a four-letter code. That path is
off-limits here for two hard reasons, both ground rules of this app:

- **No third-party packages, ever.** A production WebRTC stack on Apple platforms
  means `libwebrtc` or an SPM/CocoaPods wrapper. This app is Apple-frameworks-only
  for App Store cleanliness — no SPM, no CocoaPods, no vendored binaries.
- **First-party networking only.** The transport is `URLSessionWebSocketTask`
  (Foundation). Nothing else.

So the TV speaks the **tvOS-clean equivalent** of the web's WebRTC + mailbox: a
single **WebSocket** to a thin **relay bridge** that the booth also connects to.
The relay does one job — fan the booth's frames out to every screen sharing the
code. It replaces both halves of the web design at once: the mailbox (the
four-letter rendezvous) and the data channel (the 30 Hz feed).

```
   booth (web player, "stage host")                Apple TV (this client)
   ────────────────────────────────                ──────────────────────
   analyses audio, builds the packet   ──frames──▶   relay   ──frames──▶  StageClient
   30 Hz feature frames                                (fan-out            → StageRenderer
   plays the audio                                      by code)           → the field on Metal
                                                                            (no audio)
```

**What the booth must provide (not shipped here):** a small WebSocket relay and a
booth-side sender. The relay is a few dozen lines — accept connections at
`/stage/<CODE>`, and forward every text frame from the *producer* (the booth) to
every *consumer* (the screens) on that code. The booth-side sender is the web
player emitting the same `stageApplyFeat` frame it already computes, as JSON, to
the relay instead of (or in addition to) the WebRTC channel. Neither exists in
this repository; the TV client is written against this contract so it works the
moment a relay does.

The relay host is a **documented constant** in the client
(`StageClient.relayHost`), currently:

```
stage.aethrakairos.com
```

Point it at any relay that honours the URL shape and packet schema below.

---

## 2. The URL shape

```
wss://<relayHost>/stage/<CODE>
```

- `wss://` only — plain `ws://` is never used (default ATS is TLS-only, and WSS
  is the App-Store-exempt, encryption-declaration-clean choice).
- `<relayHost>` = `stage.aethrakairos.com` (the constant above).
- `<CODE>` = exactly **four ASCII letters**, upper-cased by the client
  (`join(code:)` refuses anything that is not four A–Z letters before opening a
  socket). Example: `wss://stage.aethrakairos.com/stage/QNXA`.

**Roles.** The client identifies itself once, right after the socket opens, with
a tiny control frame the relay is free to ignore:

```json
{"hello":"screen","code":"QNXA"}
```

and, on leaving, a courtesy:

```json
{"bye":true}
```

A relay that distinguishes producers from consumers may use `hello` to route; a
dumb broadcast relay may drop both. The client also sends a WebSocket **ping**
roughly every 20 s so a quiet booth's connection is not reaped by a NAT.

---

## 3. The packet (booth → screen)

One JSON object per frame, sent as a WebSocket **text** message (binary is also
accepted and parsed identically). ~30 Hz is the design's rate; the client imposes
no rate and tolerates jitter. This mirrors the web's flat `stageApplyFeat` frame:
the booth resolves everything expensive (the palette chord, the eased act, the
white budget) so the screen does **no arithmetic it can avoid**.

### 3.1 Schema

| field         | type                    | range / meaning                                              |
|---------------|-------------------------|--------------------------------------------------------------|
| `clock`       | number                  | booth clock in **seconds** (its own monotonic time; used only for the smoothed skew estimate). |
| `scene`       | integer                 | which room — an index into `Rooms.all`; the client wraps it modulo the roster size, so any value is safe. |
| `bands`       | array of number         | spectrum bands, `0..1`. The renderer reads the **first 64** (they ride the first 64 texels of the spectrum strip, the room shaders' contract). |
| `beat`        | number `0..1`           | onset envelope (snap-and-decay).                             |
| `beatPhase`   | number `0..1`           | phase within the beat.                                       |
| `barPhase`    | number `0..1`           | phase within the bar (4 beats).                              |
| `phrasePhase` | number `0..1`           | phase within the 32-beat phrase.                             |
| `bpm`         | number `0..300`         | tempo (0 = unpitched).                                       |
| `energy`      | number `0..1`           | the master loudness/drive.                                   |
| `bass`        | number `0..1`           | low-band energy.                                             |
| `mid`         | number `0..1`           | mid-band energy.                                             |
| `treble`      | number `0..1`           | high-band energy.                                            |
| `calm`        | number `0..1`           | the smoothed calm meter.                                     |
| `act`         | number `0..4`           | the five-act arc, eased (OVERTURE 0 … RESOLVE 4).            |
| `white`       | number `0.05..0.92`     | the INK white budget the booth's grade opened.               |
| `pulse`       | number                  | dancer anticipation pulse (informational; clamped `0..2`).   |
| `brace`       | number `0..1`           | precognition brace before a drop (informational).            |
| `colors`      | array of stop           | the colour chord as **three OKLCH stops** (see below).       |
| `lens`        | number `-1..5`          | the booth's lens (-1 none / 0 mirrors / 1 wave / 2 prism / 3 iris / 4 tile / 5 moire). Rides in the uniforms; the stage renderer draws rooms only, so it is currently unread by them. |
| `lensAmt`     | number `0..1`           | lens intensity.                                              |
| `hand`        | object                  | the hand on the booth's glass (see below).                   |
| `camera`      | object                  | the camera pose, carried whole (see below).                  |

**A colour stop** is either an object or a triple; both are accepted:

```json
{"l": 0.63, "c": 0.14, "h": 45}      // or  [0.63, 0.14, 45]
```

`l` lightness `0..1`, `c` chroma `~0..0.4`, `h` hue **degrees** `0..360`. The
client converts each stop with the shipped `Palette.oklchToRGB` — the same
gamut-mapped OKLCH→sRGB the standalone player uses — so a stage screen and a
laptop screen light up in identical colour. Fewer than three stops are back-filled
from the idle chord.

**`hand`** — bent into the field as the phantom hand (the booth's touch reaches
across the wire and warps the TV's picture, exactly as a room leans toward its
own ghost hand):

```json
{"x": 0.2, "y": -0.1, "presence": 0.8, "mode": 0, "synthetic": false}
```

`x`/`y` centered field coordinates (`~ -1..1`), `presence` `0..1` (the warp
magnitude), `mode` the interaction personality index (informational),
`synthetic` = the booth's own ghost rather than a real hand.

**`camera`** — the pose the booth crossed, carried whole so the far side does no
arithmetic on it (DESIGN §1.2m: position + quaternion + FOV, eight numbers):

```json
{"position": [0, 0, 6], "quaternion": [0, 0, 0, 1], "fov": 55}
```

The room fragment fields are 2D and do not consume the pose today; it rides for
the wall and for rooms that later read one.

### 3.2 The law of arrival — hold last good, never zero

A packet is a snapshot, not a command, and the wire is lossy. The design's rule
(§1.2m‴) is that a **half-arrived packet holds last good** — it degrades to held,
never to zero — so a dropped `energy` keeps the last energy rather than snapping
the field dark. `StagePacket.decode(_:over:)` enforces this field by field: for
every field, use the incoming value if present, else the value the screen already
held, else the idle default. Only a completely unparseable payload (not JSON, or
not a top-level object) is refused, and even then the client simply keeps what it
had. A booth may therefore send **sparse** frames (only the fields that changed)
and the field stays whole.

### 3.3 A minimal frame

Everything except a couple of fields can be omitted and defaulted:

```json
{"clock": 40.12, "scene": 3, "energy": 0.6, "beat": 0.4,
 "colors": [[0.63,0.14,45],[0.55,0.12,210],[0.72,0.05,90]]}
```

---

## 4. The state machine

`StageClient.State`, the design's verbatim:

- **idle** — nothing joined; the code-entry grid is shown.
- **joining** — the socket is opening, no frame yet.
- **live** — frames are arriving; the field runs full-bleed and chrome-less.
- **held** — **four seconds of silence** (`StageClient.silenceHold`) with no
  frame. The client raises the *"the booth stopped speaking"* card and the
  renderer eases the field toward a **dim, cool breath** — energy, onset and the
  phantom hand fall away, the white budget closes, the chord cools toward ice — so
  the picture visibly *settles* rather than locking on a stale frame. A later
  packet flips it straight back to **live**. A screen **never freezes** and never
  goes black.
- **error** — the code was malformed or the socket dropped; the reason is shown
  with a way back.

`leave()` returns to idle and tears the socket down. Menu (the Siri Remote) leaves
the wire from any connected state, and closes the door from the entry screen.

**The smoothed clock offset.** Each packet's `clock` feeds a smoothed
`local − booth` skew estimate (`StageClient.clockOffset`, an EMA). A single screen
does not need it to draw, but it is the seed of the **cut-accurate shared wall**
the design wants (multiple screens tiling one frustum); it is kept and exposed for
that future.

---

## 5. What the TV renders (and what it does not)

- **Renders locally on Metal.** `StageRenderer` reuses the shipped metallib
  whole: the one `fullscreen_vertex`, every room fragment function in `Rooms.all`,
  and `grade_pass` (the hue-preserving INK grade + starfield floor + vignette). It
  re-declares the FIXED **144-byte** `VizUniforms` privately, identical to the
  standalone renderer's, and fills it from the packet. The room roster and the
  look never drift from the standalone player.
- **The booth deals the room.** `scene` chooses which room; the screen never
  self-directs mid-show (§1.2m). A scene change re-deals the room's three dice, so
  a re-entered room wears a fresh face.
- **No audio, ever.** There is no `AVAudioSession`, no player, no tap on the Stage
  path. The TV is a screen. The booth carries the sound (over AirPlay, its own
  speakers, or the room's PA — the booth's business, not the TV's).
- **No lens / XFORM / director.** The stage path is deliberately a single live
  room graded to the drawable — a small, self-contained renderer. The booth's
  chosen `lens` rides in the uniforms for a later pass but is not applied here.
- **The waveform is synthesized.** The booth sends spectrum `bands`, not a raw
  waveform; the renderer synthesizes a bounded scope line from the bands so
  SCOPE-family rooms still draw a living trace.

---

## 6. Booth checklist (to make a TV a screen)

1. Run a WebSocket relay reachable at `wss://<relayHost>/stage/<CODE>` that
   forwards the booth's text frames to every screen on `<CODE>`.
2. Point `StageClient.relayHost` at it (currently `stage.aethrakairos.com`).
3. From the web player's stage host, emit the `stageApplyFeat` frame as JSON
   (the schema in §3) to the relay at ~30 Hz.
4. Show the four-letter code (and/or its QR) to the room. On the TV: Home →
   **STAGE** → **JOIN A BOOTH** → type the code → **JOIN**.

That is the whole contract. The TV side is complete; the booth side needs the
relay and the JSON sender, both small, neither bundled here.
