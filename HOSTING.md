# aethrakairos.com — hosting setup (one-time, ~15 minutes)

The site and the music are served together from GitHub Pages, same origin,
free. This is the checklist; steps 2–3 can only be done by someone with
access to the GitHub repo settings and the domain registrar.

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

## 5. The graduation path (only when success demands it)

GitHub Pages' soft ceiling is ~100 GB of traffic/month — roughly 28,000
full-track streams. If GitHub's bandwidth emails start arriving:

1. Create a Cloudflare R2 bucket (free egress, forever) served at
   `media.aethrakairos.com`, with CORS allowing `https://aethrakairos.com`.
2. Upload the `docs/audio/` tree to the bucket.
3. Rebuild the catalog with
   `python3 make_catalog.py masters --base https://media.aethrakairos.com/audio`
4. Push. The site stays on Pages; only the heavy bytes move.

## Provenance

**This repo is the master.** The site, the music, the pipeline, and the
Möbius⁸ engine itself are all developed here. The engine's original home,
[kmay89/quantum_jukebox-](https://github.com/kmay89/quantum_jukebox-),
is dormant — it holds the history and can be brought back to parity
later, but new work lands here and only here.
