# REMIX — an open-source music label that ships no music

*The score is open. The sound is not. That one sentence is the whole design.*

A record label on GitHub sounds like a contradiction. Labels exist to control
copies; GitHub exists to make copying free. Every attempt to reconcile the two
ends the same way: either the music is given away and the label is a charity,
or the repository is a marketing page with a link to Bandcamp.

There is a third option, and it comes from an old idea. A **score** is not a
**recording**. Sheet music for a song you do not own is not a copy of it.
A recipe is not the dish. A `package.json` is not `node_modules`. A demoscene
`.mod` file is four kilobytes that becomes four minutes.

So: this repository publishes **scores**. A remix is a signed JSON document
containing no audio — a list of operations addressed in bars and beats against
recordings named by content hash. It can be forked, diffed, reviewed, starred,
and merged, because it is text. The audio materialises only on the machine of
someone who already holds the files, when they run a build script they can
read first.

That is the trick. Everything below is the engineering that makes it real
rather than cute.

---

## 1. Three layers, three licences

The mistake is treating "a track" as one indivisible thing with one licence.
It is three things, and they have genuinely different legal characters.

| layer | what it is | where | licence |
|---|---|---|---|
| **0 — the recording** | the master, the mp3 | `docs/audio/` | `LICENSE-AUDIO` · all rights reserved |
| **1 — the DNA** | what we *measured* about it | `dna/`, `catalog.json` analysis fields | `LICENSE-DNA` · CC0, public domain |
| **2 — the score** | what a human *arranged* | `remixes/*/remix.json` | `LICENSE-CODE` · MIT |

**Layer 1 is where "open source" is real and unqualified.** A tempo is a fact.
So is a key, a loudness, the moment the third section starts, and the shape of
a vocal's energy across four minutes. Facts are not copyrightable in the US no
matter how much work went into finding them (*Feist*, 499 U.S. 340), and the
European database right that *could* bite is explicitly waived in
`LICENSE-DNA`. We are not being generous; we are declining to pretend we own
arithmetic.

**Layer 2 is where the authorship is.** An arrangement — these sixteen bars
under that vocal, this filter opening across that phrase — is a creative act
with a human behind it, and it is released MIT.

**Layer 0 does not move.** `LICENSE-AUDIO` stays exactly as restrictive as it
was. It always said *"not without prior written permission"*. The remix layer
adds one thing: a way to give that permission in a form a script can check.

There is a pleasing consequence to this split. If the recording came out of a
generative model, its copyright status is genuinely unsettled — the US
Copyright Office's position is that output without human authorship is not
protectable. Under a one-licence model that is a crisis. Under this one it is
merely interesting: whatever is true of layer 0, the *arrangement* in layer 2
is unambiguously human-authored and unambiguously yours.

---

## 2. Grants: permission as a capability, not a paragraph

A blanket "remixes allowed!" is useless — it cannot be scoped, dated, or taken
back. Instead the rights-holder issues a **grant**: a small signed document
naming one work, some verbs, and an expiry.

```json
{
  "grant": 1,
  "work": "sha256:74a4f4553b948a17906d860417238226c4d71649c7e444f23aa1b9e836c2bc75",
  "title": "137",
  "issuer": "ed25519:S1w2ori4x0g7wuL5OnOFkyry9Ti457N5/H4rrJiYsCU=",
  "issued": "2026-08-06",
  "expires": null,
  "permits": ["excerpt", "layer", "publish-score", "separate", "timestretch"],
  "terms": "LICENSE-AUDIO · remix grant",
  "sig": "ed25519:..."
}
```

The vocabulary is deliberately small and deliberately verb-shaped:

| permit | means |
|---|---|
| `excerpt` | use a bounded time range |
| `separate` | run source separation, use one stem lane |
| `timestretch` / `pitchshift` | change the rate / transpose |
| `layer` | combine with another work |
| `publish-score` | publish the manifest (no audio) |
| `render-public` | publish **rendered audio** of the result |
| `commercial` | any commercial exploitation |

Two of those are the interesting ones. `publish-score` is cheap and should
usually be granted — it costs the rights-holder nothing, because a score is
not a copy. `render-public` is expensive and should usually not be, because
that *is* a copy. **The whole label runs in the gap between them.**

### The part that makes grants honest

Nobody declares what they need. `remix.py` **computes** the required verbs
from the manifest itself — a lane with a stem implies `separate`, two sources
imply `layer`, `"warp": true` implies `timestretch` — and refuses anything the
grant does not cover. A permission you can't understate is a permission that
means something:

```
$ python3 remix.py verify remixes/137-x-runners-club/remix.json
  ok  grant  bed · 74dd7cc4-74a4f4553b94.json permits excerpt, layer, publish-score, separate
```

Add `"semitones": 3` to one clip and re-sign it with a perfectly valid trusted
key, and it still dies:

```
 FAIL source top: no grant covers excerpt, layer, pitchshift, publish-score, separate, timestretch
```

That is the property worth having. **Holding a trusted key does not let you
exceed your grant**, because the check is against what the document *does*,
not what it *claims*.

---

## 3. The crypto, and why there is no chain

You asked whether this needs "some sort of crypto logic". It does — and it is
worth being precise about which kind, because the industry reflex here is
expensive and wrong.

What a label actually needs is: **provenance** (who said this), **integrity**
(has it changed), **non-repudiation** (they can't deny saying it), and
**revocability** (we can stop trusting them). Those are signature properties.
They are solved by Ed25519 and content addressing, both of which are decades
old, free, offline, and boring.

What a blockchain adds on top is *distributed consensus about ordering among
mutually distrusting parties with no shared authority*. Look at what we
actually have:

**Git is already a Merkle DAG.** Every commit hashes its parents. Tampering
with history changes every subsequent hash. The ordering is agreed by a
social process — pull requests and merges — and the trust anchor is a file
called `TRUST` whose every line has a `git blame` pointing at the human who
merged it and the review where they explained why. There is no missing
ledger. Adding a token to this would be adding a second, worse copy of a
Merkle chain we are already using, plus a currency nobody asked for.

If you later want *third-party* proof that a grant existed on a given date —
a genuine gap, since our timestamps are self-asserted — the answer is an
OpenTimestamps proof or a signed git tag, not a coin.

Three deliberate implementation choices:

**Ed25519 in pure Python** (`signing.py`, ~150 lines, RFC 8032). A signature
is only worth what verifies it, and `pip install` is not a durability story.
A grant issued today must still verify in 2040, offline, from a clone. When a
real crypto library is importable we use it for *signing* (the secret half is
the half that leaks through timing); verification stays dependency-free
forever. This turned out to matter within an hour of being written — the
`cryptography` build on the machine this was developed on raises a Rust
`PanicException` that inherits from `BaseException` and sails straight through
`except Exception`. The accelerator must never be load-bearing. It isn't.

**Signatures cover a canonical form, not bytes.** Keys sorted, no
insignificant whitespace, `sig` removed (RFC 8785-flavoured). A remix is a
document people hand-edit and pipe through tools; a signature that a stray
newline invalidates is a signature nobody keeps.

**Two hashes, two jobs.** `sha256` identifies the *file*. The Haitsma–Kalker
fingerprint identifies the *music*. You need both, because MP3 decoding is not
bit-exact across decoders and neural separation is not bit-exact across
hardware — so a sha256 of a stem is a promise no honest tool can keep.

---

## 4. Stems, without shipping stems

Real stems are gigabytes and mostly redundant: they are a *deterministic-ish
function* of a file you already have. So a lane does not ship audio. It ships
a **receipt**:

```json
{ "id": "top-vocals", "source": "top", "stem": "vocals",
  "receipt": { "model": "htdemucs", "fp": "dna/stems/84dee9ec394b-vocals.fp",
               "tolerance": 0.14 } }
```

To verify, re-run the separation locally and compare — *perceptually*. Demucs
on a different GPU, BLAS, or torch build does not produce identical samples.
What is stable is what the stem *sounds* like, and `fingerprint.py` already
measures exactly that, as a bit-error rate with a CLONE threshold.

**A tolerance-aware hash is the right primitive for a neural derivation, and
this repository already had one.** That is the piece I'd point at if you want
the "genius" bit: the fingerprint index was built as an anti-piracy tool, and
it turns out to be the thing that makes reproducible stems possible.

The stem fingerprints themselves are Layer 1 — measurements — so they are CC0
and committed. ~34 KB each. Which means a third party holding only the source
mp3 can prove, months later, that the vocal lane in a manifest is the vocal
lane the author actually used.

### Planning a remix with no audio at all

`tools/stems.py` already ships a **12 Hz loudness envelope per stem** in the
catalog — a few hundred bytes gzipped, one digit per twelfth of a second, for
drums / bass / vocals / other. That data says *where the voice is*. Which
means the machine can draft a musical idea before anyone downloads a byte:

```
$ python3 remix.py suggest --instrumental --bars 16
  74a4f4553b   8B   128.0  bar   25.6 +  82.1 bars   137
  bfebf9c776   8B   128.0  bar   32.1 +  50.4 bars   Rare addiction

$ python3 remix.py pair 74a4f4553b 84dee9ec39 --out remixes/137-x-runners-club
  Drafted from catalog metadata alone: an 80-bar window of 137 that carries
  no vocal, hosting Runners club's longest sung passage, warped +0.0% onto
  128.01 BPM.
```

Key compatibility from the Camelot wheel, tempo folded across the octave
(70 mixes with 140 — half-time is family), both windows snapped to whole bars,
because a mashup that starts off the downbeat is just a mistake. No audio was
read. **This is the argument for keeping Layer 1 open and rich**: good DNA
lets anyone — a person, a script, a model — do musical work with material they
cannot hear.

---

## 5. Time is measured in bars, not seconds

```json
{ "lane": "top-vocals", "from": {"bar": 26}, "beats": 320,
  "at": {"bar": 1}, "warp": true, "fade": {"in": 1, "out": 4} }
```

Positions resolve against the *source's own measured downbeat* — `{"bar": 33}`,
or `{"section": 2}`, or the analysed landmarks `{"section": "apex"}` /
`"mixIn"` / `"mixOut"` (stored as fractions of duration, so they survive a
re-encode), with `{"t": 41.5}` as the escape hatch for material the pipeline
deliberately left ungridded — the piano rule: rubato and ambient are never
forced onto a grid.

Change `grid.bpm` and every clip moves together and stays musical. This is
what makes it *DNA* rather than a WAV edit: **the manifest is the genotype,
the render is the phenotype.** `remix.py compile` collapses it to absolute
seconds for the player; that one-way door lives in a tool, never in the file.

It is also what makes it performable. Beat-relative lanes with cue points on
section boundaries are exactly the shape the existing MIX planner and booth
already consume.

---

## 6. Lineage: CI as a paternity test

Every manifest declares its `parents`. Verification checks that the declared
parents cover every source actually used — you cannot quietly drop one:

```
 FAIL parents omits sources actually used: 84dee9ec394b
```

And because `dna/` indexes the whole catalog, the render script ends by
fingerprinting its own **output** against it. Whatever the arrangement claims,
the fingerprint reports which catalog works are audibly in the result. Git
gives the declared lineage for free — a fork is a remix of a remix, and
`git log` is the DAG. The fingerprint gives the *measured* one.

**The honest limit, stated plainly:** this proves clones and shared material.
It cannot prove absence of influence. Time-stretching and pitch-shifting break
frame alignment and read as unrelated, and no fingerprint on earth detects
that someone re-sang your melody. Screening catches re-uploads of *our own*
catalog. That is the real boundary, and no amount of cryptography moves it.

---

## 7. Bringing in AI-generated audio

Suno, Udio, our own model, a field recording, a licensed sample pack — all the
same problem: audio arrives from outside with a rights story that only a human
can vouch for. You cannot make that go away with a hash. What you *can* do is
make every claim attributable, dated, and non-repudiable.

```
$ python3 remix.py intake track.mp3 --origin generated \
    --generator suno-v4.5 --prompt "warm analog house, 124bpm" --key keys/you.key
```

Which produces a signed **origin declaration**: content hash, generator,
date, declarer, an exact-duplicate screen against the catalog, and a
statement the human signs. The prompt is stored as a **hash, not plaintext** —
it still proves later which prompt was used, without publishing it.

This is not novel. It is the paperwork labels have always kept. The only new
part is that the signature can be checked by a script, and that revoking a
key in `TRUST` retroactively invalidates everything it ever vouched for, on
the next CI run.

MP3-only is fine, incidentally, and always was — everything here decodes
through ffmpeg, and every threshold is perceptual precisely because lossy
round-trips are assumed.

---

## 8. How it feels to use

Contributing a remix is opening a pull request that adds one JSON file.

```
$ python3 remix.py verify remixes/137-x-runners-club/remix.json

  ok  shape · dna v1, 2 sources, 4 lanes, 4 clips
  ok  signature · 74dd7cc417549b39
  ok  source bed · 137 (74a4f4553b94)
  ok  grant  bed · 74dd7cc4-74a4f4553b94.json permits excerpt, layer, publish-score, separate
  ok  timing · 4 clips inside their sources
  ok  lineage · 2 parents declared, all sources accounted for
  ??  lane 'top-vocals': separated but carries no receipt
        accepted · 0 failures, 5 unproven
```

Note `??` and the word **unproven**. Something that could not be checked here
is never quietly promoted to a pass — CI holds no audio, so it says so.
`--check-receipts` on a machine that does hold the audio turns those into `ok`
or `FAIL`. "Unproven" and "proven" are different words on purpose.

Credit is computed from the arrangement rather than negotiated after it:

```
$ python3 remix.py splits remixes/137-x-runners-club/remix.json
   50.0%  Aethra Kairos          arrangement
   25.0%  137                    source recording  (320 beats)
   25.0%  Runners club           source recording  (320 beats)
```

Counted as the *union* of time a source occupies, not the sum of its clips —
a bed split into drums+bass+other occupies the same 80 bars as a bed used
whole, and paying it three times for being easy to separate is exactly the
arithmetic that makes people distrust an automatic ledger. It is a proposal
computed from evidence, not an agreement. Splits that matter get signed by
humans.

---

## 9. What this does not solve

Worth writing down, because a design doc that only lists strengths is an
advertisement.

- **It is not legal advice, and it is not a licence to remix anything.** It is
  a mechanism for expressing and checking permission that a rights-holder
  actually gave. A grant signed by someone who did not hold the rights is a
  signed lie, not a licence — and moral rights, sampling law, and publishing
  (composition, as distinct from recording) are all outside this machinery.
- **Two rights, not one.** A grant here covers the *recording*. If a work has
  a separately-owned composition, that is a second permission this repo does
  not model.
- **Perceptual fingerprints don't catch interpolation.** Re-sing the melody
  and every check passes.
- **Key revocation is retroactive and blunt.** Removing a `TRUST` line breaks
  every score that key ever signed. That is the correct default for a
  compromise and the wrong one for an amicable exit; a real deployment wants
  revocation *dates*, so honest old work keeps verifying.
- **The demo key is burned on purpose.** `tests/fixtures/demo-label.key` has a
  public secret so the example verifies out of the box. Every tool shouts
  about it whenever it appears in `TRUST`, because the convenient thing is the
  thing most likely to be left in by accident.
- **Determinism has limits.** Two ffmpeg versions will not produce identical
  renders. That is why receipts are perceptual and why `render` emits a script
  you read rather than a subprocess that surprises you.

---

## 10. Try it

```sh
python3 remix.py selftest                     # 40 checks, no deps, no audio
python3 remix.py suggest --instrumental        # where can a vocal live?
python3 remix.py suggest --with 74a4f4553b     # what mixes with this?
python3 remix.py pair BED TOP --out remixes/x  # draft a mashup
python3 remix.py verify remixes/*/remix.json   # the gate CI runs
python3 remix.py compile remixes/x/remix.json  # player-ready timeline
python3 remix.py render  remixes/x/remix.json  # a build script to read first
python3 remix.py splits  remixes/x/remix.json  # credit from the score

python3 signing.py keygen --out keys/you --name "Your Name"
python3 remix.py grant --work TRACK --key keys/you.key --permits excerpt layer
```

Files: `remix.py` · `signing.py` · `TRUST` · `LICENSE-DNA` · `grants/` ·
`remixes/` · `tests/test_remix.py`
