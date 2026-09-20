# Aethra Kairos — the laws an agent works under

## The parity law (never break this)

The web player (`docs/index.html`) and the Apple TV app (`tvos/`) are one
product on two stages. Their scene rosters stay **1 : 1 by key** — same
rooms, same keys, same count. A wave that adds scenes to one stage is not
finished until the other stage has its twins; build both together, always.
See "The parity law" in `CONTRIBUTING.md` for the full contract and the
one-line parity checks.

When a wave lands, these move together:

- `SCENE_KEYS` + registries + manual in `docs/index.html`
- scene-count assertions in `tests/player.test.mjs`
- `Rooms.all` in `tvos/AethraKairosTV/Visualizer/Rooms.swift`
- the new `ShadersN.metal` translation unit, wired into
  `tvos/AethraKairos.xcodeproj/project.pbxproj` (all four sections)
- the tvOS welcome card's "N LIGHT SHOWS" line in
  `tvos/AethraKairosTV/UI/HomeView.swift`
- the roster table in `tvos/README.md`

## Verification before any scene PR

- Web: `node --test tests/player.test.mjs`, then `node tools/scene_smoke.mjs`
  (booth and sliced), then per-room screenshots iterated until each face is
  genuinely beautiful — structure on void, never a wall of mud.
- tvOS: the PR's CI compiles the app and photographs simulator frames
  (base64 JPEGs in the sim-shots job log); review them before merging.

## Conventions

- Metal rooms: stateless fragments, `VizUniforms` verbatim (stride 144),
  every loop bounded by a compile-time literal, `govern_*()` at every exit,
  void ground, chord-only colour, one `_x` suffix per translation unit.
- Colour comes from the colour engine (`Palette.swift` / the web `@color`
  block) — never hard-coded palettes in rooms.
- Commits and PRs follow the attribution footers configured for the session.
