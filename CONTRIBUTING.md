# Contributing & repository guardrails

A short, honest note on how changes land here and how the repo is kept safe from
stray or automated edits.

## How changes reach `main`

Everything ships through a **pull request** — nothing is pushed straight to
`main`. The player is a single file (`docs/index.html`); its logic is unit-tested
by extracting the marked blocks (`@pure` / `@solver` / `@color` / `@safe` /
`@clock` / `@dance`) so *what is tested is what ships*.

Before opening a PR:

```bash
node tests/player.test.mjs        # the unit suite
python3 tools/stamp_version.py    # re-stamp the build hash (index.html + sw.js)
```

## What the bots can and cannot do

Two bots comment on pull requests. Neither can change code or merge:

- **`netlify[bot]`** posts a deploy-preview link for each PR — read-only.
- **`gemini-code-assist[bot]`** posts review *comments* only.

If you want the Gemini comments to stop entirely, uninstall the **Gemini Code
Assist** GitHub App: repo **Settings → Integrations / GitHub Apps → Configure →
Uninstall** (or scope it away from this repo).

## The lock: branch protection on `main`

The real safeguard — so no bot, no accidental push, and no force-push can rewrite
`main` without a reviewed PR. Turn it on once:

1. Repo **Settings → Branches → Add branch ruleset** (or **Add rule**).
2. Branch name pattern: `main`.
3. Enable:
   - **Require a pull request before merging**
   - **Require approvals** → `1`
   - **Require review from Code Owners** (pairs with `.github/CODEOWNERS`, so
     your review is always requested and required)
   - **Do not allow force pushes**
   - **Restrict deletions**
4. Save.

With this on, `main` can only change through a PR you have reviewed and approved.

## Code ownership

`.github/CODEOWNERS` assigns the whole repository to **@kmay89**, so every pull
request automatically requests your review.

## The parity law — every room ships twice

The house has two stages: the web player (`docs/index.html`, THREE.js scenes)
and the Apple TV app (`tvos/`, Metal fragment rooms). They are one product,
and their rosters stay **1 : 1 by key** — same rooms, same keys, same count,
always.

- **A new scene is not done until both stages have it.** A wave that adds
  rooms lands as two PRs — web first (screenshot-iterated), then the Metal
  retelling in the same wave — and the second PR is not optional follow-up
  work; the wave is open until it merges. Never grow one roster without
  growing the other.
- **Keys are the contract.** `SCENE_KEYS` in `docs/index.html` and
  `Rooms.all[*].key` in `tvos/AethraKairosTV/Visualizer/Rooms.swift` must be
  the same set (order may differ; the director deals by taste, not index).
  A room's key never differs between stages.
- **The counts that face people follow the roster**: the web manual, the
  tvOS welcome card ("N LIGHT SHOWS"), `tvos/README.md`'s roster table, and
  the scene-count assertions in `tests/player.test.mjs` all move together in
  the same wave.
- **Where the platforms differ, the mathematics does not.** The web room may
  keep CPU state (particles, piles, growing flowers); the Metal twin retells
  it closed-form from the clock, the uniforms and the spectrum — but it is
  the same idea, the same faces, the same appetite (taste vector), and it
  answers the same features of the music.

Checking parity is one line per side:

```bash
# web: the roster the tests pin
node -e "const m=require('fs').readFileSync('docs/index.html','utf8').match(/SCENE_KEYS = \[[^\]]+\]/)[0]; console.log(m)"
# tvos: the roster the renderer builds
grep -o 'key: "[a-z]*"' tvos/AethraKairosTV/Visualizer/Rooms.swift
```

## Languages — one file per tongue

The player speaks many languages, and every one of them is a single JSON
file: `docs/lang/<code>.json`. The keys are the exact English strings the
player emits (English in the code is the source of truth); the values are
your language. `docs/lang/es.json` is the reference pack — same shape,
finished with care.

To improve a translation, edit that one file. To add a language, copy the
shape, fill every key, add the language to the `LANGS` roster near the top
of the player's script, and hold your work to the same gate CI does:

```
node tools/i18n_doctor.mjs <code>
```

The doctor checks completeness against the reference pack, that every
`{placeholder}` and HTML tag survived translation, that plural objects are
CLDR-shaped, and that the echo pools stay index-aligned with the English
originals. A pack the doctor passes is a pack the player can wear.

The same machinery lives as a reusable, product-agnostic engine in
`i18n/` — `engine.js` (the runtime any sibling app can import) and
`doctor.mjs` (the same gate, config-driven). `i18n/README.md` documents the
pack format, the feel-regex boundary rules per script, and the adoption
steps. The player keeps its own inlined copy of the core (the `@i18n`
marker block) so it stays one self-contained file; the unit suite holds
the two to the same behavior.
