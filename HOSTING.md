# aethrakairos.com — hosting setup (one-time, ~15 minutes)

> **Where production actually is (2026-08-05):** aethrakairos.com and www
> both resolve to the Netlify project (`aethrakairos.netlify.app`), not
> GitHub Pages — the checklist below was never completed, and this repo has
> no Pages deployments. Netlify is production today, configured by
> `netlify.toml`: production ships `docs/` with the audio; deploy previews
> strip it and borrow production's copy. Anyone editing `netlify.toml` must
> keep that split — a rule that strips or redirects `/audio/*` in the
> production context points the site at itself and silences every track
> (that is exactly what happened on 2026-08-04). If the domain ever moves
> to Pages as planned below, revisit the preview redirect target too.
>
> **Where the music actually is (2026-08-07):** not here. The audio has
> graduated to a Cloudflare R2 bucket at `media.aethrakairos.com` — see §5,
> which is now a record of a move that happened rather than a plan. No
> deploy ships `docs/audio/` any more; the repo is still its master copy.

Sections 2–4 below describe the same-origin GitHub Pages arrangement the
project was designed around and never completed. They are kept because the
domain may yet move to Pages — but read the two notes above first: today the
site is on Netlify and the music is on R2, and neither §2 nor §3 has been
done.

## 1. What's already done (in the repo)

- `docs/CNAME` contains `aethrakairos.com` — Pages picks it up automatically.
- `docs/catalog.json` is built with `base: "audio"` — the player streams
  from `aethrakairos.com/audio/…`, same origin. No CORS, seeking works,
  no raw.githubusercontent rate-limit trap.
- `make_catalog.py doctor` warns before any file nears GitHub's 100 MiB
  hard cap or the audio tree nears the ~1 GB Pages soft limit.

## 2. GitHub settings (repo → Settings → Pages)

1. **Source**: Deploy from a branch → `main` → `/docs`.
2. **Custom domain**: enter `aethrakairos.com`. GitHub verifies DNS.
3. After DNS passes (below), tick **Enforce HTTPS**
   (certificate can take up to an hour to appear).

## 3. Registrar DNS records

| Type  | Name | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| AAAA  | @    | 2606:50c0:8000::153 |
| AAAA  | @    | 2606:50c0:8001::153 |
| AAAA  | @    | 2606:50c0:8002::153 |
| AAAA  | @    | 2606:50c0:8003::153 |
| CNAME | www  | `<github-username>.github.io` |

(If the registrar offers ALIAS/ANAME on the apex, pointing it at
`<github-username>.github.io` also works — keep the A records regardless.)

## 4. Publishing music (forever after)

```bash
./publish.sh                      # masters/ → catalog → doctor → commit → push
./publish.sh masters album40.zip  # wizard ZIPs unpack first
```

Drop album folders of web MP3s (plus optional `cover.jpg`, `info.txt`) into
`masters/`, run the script, and the album is live at aethrakairos.com when
the push lands. Nothing else to operate.

## 5. The graduation (done 2026-08-07 — the heavy bytes have moved)

The ceiling was reached. 264 tracks came to 1.07 GB and the library kept
growing; every production deploy shipped the whole gigabyte, and on
2026-08-04 nine preview builds doing the same exhausted the account's usage
and **paused the project** — the player kept booting from its service-worker
cache while every track buffered and failed, because audio deliberately
bypasses the worker and goes straight to the network.

So the audio now lives in a **Cloudflare R2 bucket** (free egress, forever)
served at `media.aethrakairos.com`. `docs/audio/` remains the master copy in
the repo — the pipeline, the fingerprint index and the stems job all read it
— but no deploy ships it.

**The order matters. Do these in sequence, and do not merge the catalog
change before step 2 has finished:** the catalog's `base` is what every
listener resolves track URLs against, so pointing it at an empty bucket
silences the entire library exactly the way 2026-08-04 did.

1. Create the R2 bucket, connect the custom domain `media.aethrakairos.com`,
   and set:
   - **CORS on the bucket, with `AllowedOrigins: ["*"]`.** The player sets
     `crossOrigin='anonymous'` so the analyser can read the stream, and a
     bucket without CORS plays to a dead visualiser or not at all. It has
     to be `*` rather than a list of origins for two reasons: deploy
     previews get a fresh hostname each time
     (`deploy-preview-176--aethrakairos.netlify.app`), so no fixed list can
     cover them, and `doctor` asserts the header is exactly `*`. This is
     the same posture Netlify served `/audio/*` with, not a loosening.
     `AllowedHeaders` must include `Range`, or seeking dies.
   - **`X-Robots-Tag: noindex, nofollow`** via a Cloudflare **Transform
     Rule** (Rules → Transform Rules → Modify Response Header) on the
     `media.aethrakairos.com` hostname. It cannot come from the upload:
     it is not one of the S3 headers `aws s3 sync` knows how to set.
     `docs/robots.txt` cannot reach across to another host, so this rule is
     the only thing keeping crawlers out of the tracks.
2. Upload the tree and wait for it to finish:
   ```bash
   export R2_ACCOUNT_ID=...  AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...
   ./tools/sync_audio.sh --dry-run     # read it first
   ./tools/sync_audio.sh               # ~1.09 GB on the first run, one track after
   ```
3. **Prove the bucket before trusting it** — this is the acceptance test, and
   it fails loudly on a missing CORS header or a bucket that answers 200
   instead of 206 (no 206 means no seeking):
   ```bash
   python3 make_catalog.py doctor      # NOT --no-net; the probes are the point
   ```
4. Ship the catalog whose `base` is `https://media.aethrakairos.com/audio`,
   and the `netlify.toml` that strips `docs/audio` from every deploy.

After this, `./publish.sh` keeps working unchanged: `make_catalog.py`
inherits an absolute `base` from the shipped catalog, so a release can never
quietly reset the library to a same-origin tree that no longer ships. Run
`./tools/sync_audio.sh` after each release to put the new track in the
bucket.

### The one rule for `/audio/*`

A redirect for `/audio/*` may only ever point at a **different host**. On
2026-08-04 one pointed at `aethrakairos.com` — which *is* the site — and
every track request 302'd to itself until the browser gave up. The rule in
`netlify.toml` targets `media.aethrakairos.com`, so it cannot close that
loop. It exists because `sw.js` serves `catalog.json`
stale-while-revalidate: a returning listener plays a whole session off the
*old* catalog, whose base is still the same-origin tree, before the new one
lands.

## Provenance

**This repo is the master.** The site, the music, the pipeline, and the
Möbius⁸ engine itself are all developed here. The engine's original home,
[kmay89/quantum_jukebox-](https://github.com/kmay89/quantum_jukebox-),
is dormant — it holds the history and can be brought back to parity
later, but new work lands here and only here.
