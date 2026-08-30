/* ================================================================
   The Möbius i18n engine — ES5 build.

   The same engine as engine.js, hand-held down to ES5 syntax for
   siblings that ship without a build step and promise maximum
   compatibility (Echoes of Play: one HTML file, ES5 only, zero
   network). Feature use is guarded: with dictionaries carried
   inline (config.dicts) the engine is fully synchronous and needs
   neither Promise nor fetch; the async pack-fetching paths engage
   only where those globals exist.

   Keep this file behaviorally identical to engine.js — the unit
   suite in tests/player.test.mjs holds the two to parity. When one
   changes, change both.

   Usage (classic script, or inlined into a single-file app):

     var i18n = MobiusI18n.createI18n({
       langs: [ { code: 'en', name: 'English', en: 'English' },
                { code: 'es', name: 'Español', en: 'Spanish' } ],
       storageKey: 'eop_lang',
       dicts: { es: { '@meta': { code: 'es', name: 'Español', en: 'Spanish' },
                      'Enter': 'Entrar' } },
     });
     i18n.I18N.init();          // synchronous with inline dicts
     i18n.applyI18nDom();
     i18n.T('Saved {n} notes', { n: 3 });
   ================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MobiusI18n = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createI18n(config) {
    var LANGS = config.langs || [{ code: 'en', name: 'English', en: 'English' }];
    var ALIAS = config.aliases || {};
    var KEY = config.storageKey || 'i18n_lang';
    var CACHE = config.cacheKey || 'i18n_dict_v1';
    var URL_OF = config.dictUrl || function (code) { return 'lang/' + code + '.json'; };
    var INLINE = config.dicts || null;
    var REFRESH_MS = config.refreshDelayMs == null ? 6000 : config.refreshDelayMs;
    var FALLBACK = 'en';

    function NORM(s) { return String(s).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }

    var DICT = {};

    var I18N = {
      lang: FALLBACK, dir: 'ltr', echo: null, ready: null, _plural: null,
      entry: function (code) {
        for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
        return null;
      },
      stored: function () { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } },
      set: function (code) { try { localStorage.setItem(KEY, code); } catch (e) {} },
      detect: function () {
        var cands = [];
        try {
          var raw = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
          for (var i = 0; i < raw.length; i++) if (raw[i]) cands.push(String(raw[i]).toLowerCase());
        } catch (e) {}
        for (var j = 0; j < cands.length; j++) {
          var t = cands[j];
          var base = ALIAS[t.split('-')[0]] || t;
          for (var k = 0; k < LANGS.length; k++) {
            var l = LANGS[k];
            if (base === l.code || base.indexOf(l.code + '-') === 0) return l.code;
          }
        }
        return FALLBACK;
      },
      _install: function (code, dict) {
        for (var k in DICT) if (DICT.hasOwnProperty(k)) delete DICT[k];
        this.echo = dict['@echo'] || null;
        for (var kk in dict) if (dict.hasOwnProperty(kk) && kk.charAt(0) !== '@') DICT[kk] = dict[kk];
        this.lang = code;
        var meta = dict['@meta'];
        var e = this.entry(code);
        this.dir = (meta && meta.dir) || (e && e.dir) || 'ltr';
        this._plural = null;
      },
      plural: function (n) {
        try {
          if (!this._plural) this._plural = new Intl.PluralRules(this.lang);
          return this._plural.select(n);
        } catch (e) { return n === 1 ? 'one' : 'other'; }
      },
      _cacheRead: function (code) {
        try {
          var raw = localStorage.getItem(CACHE);
          if (!raw) return null;
          var j = JSON.parse(raw);
          return j && j.code === code && j.dict ? j.dict : null;
        } catch (e) { return null; }
      },
      _cacheWrite: function (code, dict) {
        try { localStorage.setItem(CACHE, JSON.stringify({ code: code, at: Date.now(), dict: dict })); } catch (e) {}
      },
      fetchDict: function (code) {
        if (INLINE && INLINE[code]) return Promise.resolve(INLINE[code]);
        return fetch(URL_OF(code), { cache: 'no-cache' }).then(function (r) {
          if (!r || !r.ok) throw new Error(URL_OF(code) + ' → ' + (r && r.status));
          return r.json();
        });
      },
      prefetch: function (code) {
        var self = this;
        if (code === FALLBACK || (INLINE && INLINE[code])) return Promise.resolve(true);
        return this.fetchDict(code).then(function (d) { self._cacheWrite(code, d); return true; })
          ['catch'](function () { return false; });
      },
      init: function () {
        var self = this;
        var stored = this.stored();
        var code = this.entry(stored) ? stored : this.detect();
        if (code === FALLBACK) { this._apply(); return; }
        if (INLINE && INLINE[code]) {              // inline pack: synchronous,
          this._install(code, INLINE[code]);      // no mirror, no network, ever
          this._apply();
          return;
        }
        var cached = this._cacheRead(code);
        if (cached) {
          this._install(code, cached);
          this._apply();
          if (REFRESH_MS >= 0) setTimeout(function () { self.prefetch(code); }, REFRESH_MS);
          return;
        }
        this.ready = this.fetchDict(code).then(function (dict) {
          self._install(code, dict);
          self._cacheWrite(code, dict);
          self._apply();
        })['catch'](function () { self._apply(); });
      },
      _apply: function () { if (config.onApply) config.onApply(); else applyI18nDom(); },
    };

    function T(s, vars) {
      var out = s;
      if (I18N.lang !== FALLBACK) {
        var hit = DICT[s];
        if (hit == null) hit = DICT[NORM(s)];
        if (hit != null && typeof hit === 'object') {
          var n = vars && vars.n != null ? Number(vars.n) : NaN;
          hit = (isFinite(n) ? hit[I18N.plural(n)] : null) || hit.other || hit.one || null;
        }
        if (hit != null) out = hit;
      }
      if (vars) for (var k in vars) if (vars.hasOwnProperty(k)) out = out.split('{' + k + '}').join(vars[k]);
      return out;
    }

    function TN(name) {
      if (I18N.lang === FALLBACK) return name;
      var segs = String(name).split(' · ');
      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var t = T(seg);
        if (t !== seg) { segs[i] = t; continue; }
        var m = seg.match(/^(\d+(?:\.\d+)?) (.+)$/);
        if (m) { var r = T(m[2]); if (r !== m[2]) segs[i] = m[1] + ' ' + r; }
      }
      return segs.join(' · ');
    }

    function applyI18nDom(root) {
      document.documentElement.lang = I18N.lang;
      document.documentElement.dir = I18N.dir;
      if (I18N.lang === FALLBACK) return;
      var dt = DICT[NORM(document.title)];
      if (typeof dt === 'string') document.title = dt;
      var scope = root || document.body;
      if (!scope) return;
      var nodes = scope.querySelectorAll('*');
      var ATTRS = ['title', 'aria-label', 'placeholder'];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.isConnected) continue;
        for (var a = 0; a < ATTRS.length; a++) {
          var v = n.getAttribute && n.getAttribute(ATTRS[a]);
          if (v) { var t = DICT[NORM(v)]; if (typeof t === 'string') n.setAttribute(ATTRS[a], t); }
        }
        if (n.firstChild) {
          var key = NORM(n.innerHTML);
          if (key) { var tr = DICT[key]; if (typeof tr === 'string') n.innerHTML = tr; }
        }
      }
    }

    return { LANGS: LANGS, I18N: I18N, T: T, TN: TN, applyI18nDom: applyI18nDom, dict: DICT };
  }

  function echoSignals(text) {
    var s = String(text || '').replace(/^\s+|\s+$/g, '');
    var words = s ? s.split(/\s+/).length : 0;
    var FEEL = /\b(afraid|angry|anxious|alone|ashamed|calm|free|glad|grateful|happy|heavy|hope|hurt|lonely|lost|love|miss|numb|peace|proud|sad|scared|stuck|tired|worried)\w*\b/i;
    return {
      words: words,
      question: /\?/.test(s),
      feeling: FEEL.test(s),
      me: /(^|\s)i(’|'|\s|m\b|$)/i.test(s),
      short: words > 0 && words <= 6,
      long: words > 40,
    };
  }

  function echoComposeFrom(pools, text, rng) {
    if (!pools || !pools.ack || !pools.frags || !pools.turn) return null;
    var sig = echoSignals(text);
    if (!sig.feeling && pools.feel) {
      try {
        if (new RegExp(pools.feel, 'i').test(String(text || ''))) {
          var widened = {};
          for (var k in sig) if (sig.hasOwnProperty(k)) widened[k] = sig[k];
          widened.feeling = true;
          sig = widened;
        }
      } catch (e) {}
    }
    function deal(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
    var ack = sig.question ? deal(pools.ack.q)
      : sig.short ? deal(pools.ack.short)
      : sig.long ? deal(pools.ack.long)
      : sig.feeling ? deal(pools.ack.feel)
      : deal(pools.ack.plain);
    return { ack: ack, frag: deal(pools.frags), turn: deal(pools.turn), sig: sig };
  }

  return { createI18n: createI18n, echoSignals: echoSignals, echoComposeFrom: echoComposeFrom };
}));
