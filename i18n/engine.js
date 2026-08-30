/* ================================================================
   The Möbius i18n engine — one dictionary per tongue, for any app.

   This is the reusable form of the i18n core that ships inside the
   Aethra Kairos player (docs/index.html, the `@i18n` marker block).
   The player keeps its own inlined, specialized copy so it stays a
   single self-contained file; the unit suite holds the two to the
   same behavior. Any sibling product — Echoes of Play first among
   them — imports THIS file and brings only a config and its packs.

   The contract it serves (the same one tools/i18n_doctor.mjs holds
   the door on):

     · English strings ARE the keys. The app is written in English;
       a dictionary maps each English string to its rendering, so a
       missing dictionary or key falls back to English, honestly.
     · One JSON file per language, self-describing:
         { "@meta": { code, name, en, dir? },
           "@echo": { quotes, prompts, ack, frags, turn, feel }?,
           "English key": "rendering",
           "{n} things": { "one": "…", "few": "…", "other": "…" } }
       A plural OBJECT is resolved with the browser's own
       Intl.PluralRules against the {n} substitution variable, so
       Russian's three forms and Arabic's six need no call sites.
     · The choice persists in localStorage; a mirrored copy of the
       chosen dictionary boots the next visit synchronously — no
       flash of English. The mirror quietly refreshes afterward, so
       a fixed translation never waits for an app release.
     · Right-to-left is honoured where it is written: @meta.dir (or
       the registry entry) flips document.documentElement.dir.

   Usage:

     import { createI18n, echoComposeFrom } from './engine.js';
     const { I18N, T, TN, applyI18nDom } = createI18n({
       langs: [ { code: 'en', name: 'English', en: 'English' },
                { code: 'es', name: 'Español', en: 'Spanish' }, … ],
       storageKey: 'myapp_lang',
       cacheKey:   'myapp_dict_v1',
       dictUrl: code => 'lang/' + code + '.json',
     });
     I18N.init();                       // synchronous when mirrored
     await I18N.ready;                  // first visit in a new tongue
     applyI18nDom();                    // translate the static page
     T('Saved {n} notes', { n: 3 });    // runtime strings

   No dependencies, no build step, no framework. ES module and
   classic-script friendly (see the export shim at the bottom).
   ================================================================ */

export function createI18n(config){
  const LANGS = config.langs || [{ code: 'en', name: 'English', en: 'English' }];
  const ALIAS = config.aliases || {};            // { tl: 'fil', … }
  const KEY = config.storageKey || 'i18n_lang';
  const CACHE = config.cacheKey || 'i18n_dict_v1';
  const URL_OF = config.dictUrl || (code => 'lang/' + code + '.json');
  const INLINE = config.dicts || null;           // { es: {…}, … } — dictionaries
                                                 // carried inside the app itself:
                                                 // a single-file, zero-network
                                                 // product (Echoes of Play) ships
                                                 // its packs inline and never
                                                 // fetches at all
  const REFRESH_MS = config.refreshDelayMs == null ? 6000 : config.refreshDelayMs;
  const FALLBACK = 'en';

  const NORM = s => String(s).replace(/\s+/g, ' ').trim();

  /* the active dictionary — English key → translation (string, or a
     plural object). One object for the app's whole life; the loader
     refills it in place. */
  const DICT = {};

  const I18N = {
    lang: FALLBACK, dir: 'ltr', echo: null, ready: Promise.resolve(), _plural: null,
    entry(code){ return LANGS.find(l => l.code === code) || null; },
    stored(){ try { return localStorage.getItem(KEY) || ''; } catch (e){ return ''; } },
    set(code){ try { localStorage.setItem(KEY, code); } catch (e){} },
    /* Apple-style negotiation: walk the listener's ORDERED language
       list and take the first the roster carries — 'pt-BR' finds pt,
       'zh-TW' finds zh, and the alias table catches the odd tags
       browsers still speak ('tl' for Filipino). */
    detect(){
      let cands = [];
      try { cands = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).filter(Boolean).map(t => String(t).toLowerCase()); } catch (e){}
      for (const t of cands){
        const base = ALIAS[t.split('-')[0]] || t;
        const hit = LANGS.find(l => base === l.code || base.indexOf(l.code + '-') === 0);
        if (hit) return hit.code;
      }
      return FALLBACK;
    },
    _install(code, dict){
      for (const k in DICT) delete DICT[k];
      this.echo = dict['@echo'] || null;
      for (const k in dict) if (k[0] !== '@') DICT[k] = dict[k];
      this.lang = code;
      const meta = dict['@meta'];
      const e = this.entry(code);
      this.dir = (meta && meta.dir) || (e && e.dir) || 'ltr';
      this._plural = null;
    },
    plural(n){
      try {
        if (!this._plural) this._plural = new Intl.PluralRules(this.lang);
        return this._plural.select(n);
      } catch (e){ return n === 1 ? 'one' : 'other'; }
    },
    _cacheRead(code){
      try {
        const raw = localStorage.getItem(CACHE);
        if (!raw) return null;
        const j = JSON.parse(raw);
        return j && j.code === code && j.dict ? j.dict : null;
      } catch (e){ return null; }
    },
    _cacheWrite(code, dict){
      try { localStorage.setItem(CACHE, JSON.stringify({ code, at: Date.now(), dict })); } catch (e){}
    },
    async fetchDict(code){
      if (INLINE && INLINE[code]) return INLINE[code];
      const r = await fetch(URL_OF(code), { cache: 'no-cache' });
      if (!r || !r.ok) throw new Error(URL_OF(code) + ' → ' + (r && r.status));
      return r.json();
    },
    /* pull a dictionary into the mirror ahead of a reload — a gate or
       language menu calls this so the NEXT boot paints translated
       from byte one */
    prefetch(code){
      if (code === FALLBACK) return Promise.resolve(true);
      return this.fetchDict(code).then(d => { this._cacheWrite(code, d); return true; }).catch(() => false);
    },
    /* boot. The stored choice wins; with nothing stored the browser's
       own language leans the boot. The synchronous path — dictionary
       already mirrored — installs before anyone sees a frame. The
       asynchronous path (first visit in a new language, or a cleared
       mirror) resolves `ready`, which the app awaits under its splash. */
    init(){
      const stored = this.stored();
      const code = this.entry(stored) ? stored : this.detect();
      if (code === FALLBACK){ this._apply(); return; }
      if (INLINE && INLINE[code]){                 // inline pack: synchronous,
        this._install(code, INLINE[code]);        // no mirror, no network, ever
        this._apply();
        return;
      }
      const cached = this._cacheRead(code);
      if (cached){
        this._install(code, cached);
        this._apply();
        // quietly refresh the mirror for the NEXT boot — a fixed
        // translation should not wait for an app release
        if (REFRESH_MS >= 0) setTimeout(() => this.prefetch(code), REFRESH_MS);
        return;
      }
      this.ready = (async () => {
        try {
          const dict = await this.fetchDict(code);
          this._install(code, dict);
          this._cacheWrite(code, dict);
        } catch (e){ /* offline and unmirrored: English, honestly */ }
        this._apply();
      })();
    },
    _apply(){ if (config.onApply) config.onApply(); else applyI18nDom(); },
  };

  function T(s, vars){
    let out = s;
    if (I18N.lang !== FALLBACK){
      let hit = DICT[s];
      if (hit == null) hit = DICT[NORM(s)];
      if (hit != null && typeof hit === 'object'){
        // a plural object — {one, few, many, other, …} by CLDR
        // category. The count rides in as {n}; a missing category
        // falls to `other`.
        const n = vars && vars.n != null ? Number(vars.n) : NaN;
        hit = (isFinite(n) ? hit[I18N.plural(n)] : null) || hit.other || hit.one || null;
      }
      if (hit != null) out = hit;
    }
    if (vars) for (const k in vars) out = out.split('{' + k + '}').join(vars[k]);
    return out;
  }

  /* TN — translate a composed display NAME segment by segment
     ('FLAME · MATCH' → 'LLAMA · CERILLA'): names assembled from
     vocabulary words with ' · ' seams; any segment the dictionary
     does not know stays as it is. */
  function TN(name){
    if (I18N.lang === FALLBACK) return name;
    return String(name).split(' · ').map(seg => {
      const t = T(seg);
      if (t !== seg) return t;
      const m = seg.match(/^(\d+(?:\.\d+)?) (.+)$/);   // '7 SLITS' — the number rides along
      if (m){ const r = T(m[2]); if (r !== m[2]) return m[1] + ' ' + r; }
      return seg;
    }).join(' · ');
  }

  /* one pass over the static markup — safe to call again (keys are
     English; an already-translated node simply stops matching) */
  function applyI18nDom(root){
    document.documentElement.lang = I18N.lang;
    document.documentElement.dir = I18N.dir;
    if (I18N.lang === FALLBACK) return;
    const dt = DICT[NORM(document.title)];
    if (typeof dt === 'string') document.title = dt;
    const scope = root || document.body;
    if (!scope) return;
    const nodes = scope.querySelectorAll('*');
    for (const n of nodes){
      if (!n.isConnected) continue;                    // subtree already replaced above it
      for (const a of ['title', 'aria-label', 'placeholder']){
        const v = n.getAttribute && n.getAttribute(a);
        if (v){ const t = DICT[NORM(v)]; if (typeof t === 'string') n.setAttribute(a, t); }
      }
      if (n.firstChild){
        const key = NORM(n.innerHTML);
        if (key){ const t = DICT[key]; if (typeof t === 'string') n.innerHTML = t; }
      }
    }
  }

  return { LANGS, I18N, T, TN, applyI18nDom, dict: DICT };
}

/* ---------------------------------------------------------------
   The echo machinery — for products that carry @echo pools in their
   packs (Echoes of Play). Shape-reading is language-blind (word
   count, the question mark); the FEELING signal is English by
   default and widened by the pack's own `feel` regex. Pools are
   dealt index-aligned, so a seeded rng gives the same deal in every
   tongue.
   --------------------------------------------------------------- */

export function echoSignals(text){
  const s = String(text || '').trim();
  const words = s ? s.split(/\s+/).length : 0;
  const FEEL = /\b(afraid|angry|anxious|alone|ashamed|calm|free|glad|grateful|happy|heavy|hope|hurt|lonely|lost|love|miss|numb|peace|proud|sad|scared|stuck|tired|worried)\w*\b/i;
  return {
    words,
    question: /\?/.test(s),
    feeling: FEEL.test(s),
    me: /(^|\s)i(’|'|\s|m\b|$)/i.test(s),
    short: words > 0 && words <= 6,
    long: words > 40,
  };
}

export function echoComposeFrom(pools, text, rng){
  if (!pools || !pools.ack || !pools.frags || !pools.turn) return null;
  let sig = echoSignals(text);
  if (!sig.feeling && pools.feel){
    try { sig = Object.assign({}, sig, { feeling: new RegExp(pools.feel, 'i').test(String(text || '')) }); } catch (e){}
  }
  const deal = arr => arr[Math.floor(rng() * arr.length) % arr.length];
  const ack = sig.question ? deal(pools.ack.q)
    : sig.short ? deal(pools.ack.short)
    : sig.long ? deal(pools.ack.long)
    : sig.feeling ? deal(pools.ack.feel)
    : deal(pools.ack.plain);
  return { ack, frag: deal(pools.frags), turn: deal(pools.turn), sig };
}
