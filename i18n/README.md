# The Möbius i18n engine

One dictionary per tongue, for any app in the family. This directory is the
reusable form of the internationalization that ships inside the Aethra Kairos
player — extracted so a sibling product (**Echoes of Play** first among them)
can adopt it by copying two files and writing zero framework code.

```
i18n/engine.js      the runtime — createI18n(), T(), TN(), applyI18nDom(),
                    plus the echo machinery (echoSignals, echoComposeFrom)
i18n/engine.es5.js  the same engine, ES5 syntax, classic-script/UMD — for
                    siblings with no build step (the unit suite holds the
                    two builds to behavioral parity)
i18n/doctor.mjs     the gate — holds every pack to the golden pack's contract
```

No dependencies, no build step. The player itself keeps an inlined,
specialized copy of the same core (the `@i18n` marker block in
`docs/index.html`) so it stays one self-contained file; the unit suite holds
the two to the same behavior.

## The idea

- **English strings are the keys.** The app is written in English. A language
  pack maps each English string to its rendering. A missing dictionary, or a
  missing key, falls back to English — honestly, never to a blank.
- **One JSON file per language.** Adding a language to a shipped product is
  one file in its `lang/` directory plus one line in its registry. No code.
- **Zero flash.** The chosen dictionary is mirrored into `localStorage`; the
  next boot installs it synchronously, before first paint. First visits in a
  new tongue resolve `I18N.ready`, which the app awaits under its splash.
- **Grammar without call sites.** A dictionary value may be a plural object —
  `{ "one": …, "few": …, "many": …, "other": … }` — resolved with the
  browser's own `Intl.PluralRules` against the `{n}` variable. Russian's
  three forms and Arabic's six need no changes where `T()` is called.
- **Right-to-left honoured.** `@meta.dir: "rtl"` (or the registry entry)
  flips `document.documentElement.dir` for the whole page.
- **Translations ship without releases.** Serve `lang/*.json` with a
  stale-while-revalidate cache (the player adds them to its service worker's
  catalog route); the engine quietly refreshes the mirror after boot.

## Pack format

```jsonc
{
  "@meta": { "code": "es", "name": "Español", "en": "Spanish", "dir": "ltr" },
  "@echo": {                       // optional — products with echo pools
    "quotes":  [ { "t": "…", "a": "…" }, … ],   // index-aligned with golden
    "prompts": [ "…", … ],
    "ack":     { "q": […], "short": […], "long": […], "feel": […], "plain": […] },
    "frags":   [ "…", … ],
    "turn":    [ "…", … ],
    "feel":    "regex of feeling words — see boundary rules below"
  },
  "Play": "Reproducir",
  "Saved <b>{name}</b>": "Guardado <b>{name}</b>",
  "{n} tracks": { "one": "{n} трек", "few": "{n} трека", "many": "{n} треков", "other": "{n} трека" }
}
```

Rules the doctor enforces: every golden key present and nothing extra; every
`{placeholder}` and HTML tag preserved in every value (every plural variant
included); plural objects use only CLDR categories and always carry `other`;
`@echo` pools match the golden pack's sizes exactly (the deal logic indexes
them one-to-one).

### The `feel` regex — boundary rules by script

JavaScript's `\b` and `\w` are ASCII-only without the `u` flag. Getting this
wrong fails **silently** — the regex compiles and simply never matches.

| Script | Boundary style | Example shape |
|---|---|---|
| Latin (accents incl.) | consume-left letter class, lookahead right | `(?:^|[^A-Za-zÀ-ỹ])(word…)(?=[^A-Za-zÀ-ỹ]\|$)` |
| Cyrillic | same, with Cyrillic class | `(?:^|[^а-яёА-ЯЁ])(…)` |
| Arabic / Persian / Urdu | same, Arabic block; Arabic adds proclitics `و ف ب ال` and suffixes `ة ين` | `(?:^|[^؀-ۿ])(?:[وفب](?:ال)?)?(…)` |
| CJK, Korean, Thai | plain alternation, no boundaries (particles/no spaces attach directly) | `(외로움\|기쁨\|…)` |
| Devanagari, Bengali, Gurmukhi | plain alternation of explicit inflected forms | `(उदास\|अकेला\|…)` |

Never use lookbehind (`(?<=…)`) — unsupported before Safari 16.4. The doctor
rejects lookbehind and `\b`-beside-non-Latin outright.

### Inline dictionaries — single-file, zero-network products

A product whose identity is "one HTML file, zero network" (Echoes of Play)
ships its packs inside the file instead of a `lang/` directory: pass them
as `dicts: { es: {…}, … }` in the config. Inline packs install
**synchronously** — no fetch, no localStorage mirror, no `ready` to await —
and `prefetch`/`fetchDict` serve them without touching the network. Use
`engine.es5.js` there if the product is ES5-only.

## Adopting the engine (Echoes of Play)

1. Copy `engine.js` (and `doctor.mjs` for CI) into the project — or
   `engine.es5.js` inlined, for a single-file ES5 product.
2. Create `lang/` with a **golden pack** — the first fully-translated
   language (the player uses Spanish). Its key set becomes the schema.
3. Wire the boot:

   ```html
   <script type="module">
     import { createI18n, echoComposeFrom } from './engine.js';
     const { I18N, T, TN, applyI18nDom } = createI18n({
       langs: [
         { code: 'en', name: 'English',  en: 'English' },
         { code: 'es', name: 'Español',  en: 'Spanish' },
         { code: 'ar', name: 'العربية',   en: 'Arabic', dir: 'rtl' },
       ],
       aliases: { tl: 'fil' },
       storageKey: 'eop_lang',          // per-product keys — mirrors
       cacheKey:   'eop_dict_v1',       // must not collide across apps
       dictUrl: code => 'lang/' + code + '.json',
     });
     I18N.init();                        // synchronous when mirrored
     await Promise.race([I18N.ready, new Promise(r => setTimeout(r, 2600))]);
     applyI18nDom();                     // then dissolve your splash
   </script>
   ```

4. Route every user-facing string through `T()` (and composed `·`-seamed
   names through `TN()`); leave the English literal as the argument — it is
   the key.
5. For echoes: `echoComposeFrom(I18N.echo, text, rng)` deals the current
   language's pools with the same shape-reading in every tongue; it returns
   `null` when no pools are loaded (English), so keep the English pools as
   the fallback path.
6. Gate CI on the doctor:

   ```
   node i18n/doctor.mjs --dir lang --golden es
   ```

7. To pre-warm a language switch (a picker that reloads), call
   `I18N.prefetch(code)` first, then reload — the next boot paints
   translated from byte one. Add `lang/*.json` to the service worker's
   revalidating cache so translations work offline and ship without app
   releases.

## Generating packs

Translate from the **English keys** (source of truth); use the golden pack
only as a shape and tone reference. The proven pipeline: one agent per
language, each given the golden file, a register brief (formality, script,
loanword policy, plural rules, feel-regex boundary style for its script),
looping on the doctor until clean. Landing gates beyond the doctor, per
language: edge-space preservation on concatenation-prefix keys (CJK
full-width punctuation legitimately drops them), and word-by-word feel-regex
verification with false-positive checks.
