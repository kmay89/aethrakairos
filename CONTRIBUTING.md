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
