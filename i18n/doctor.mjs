// The generalized i18n doctor — every language pack held to the same
// contract, in any product that adopts the engine (i18n/engine.js).
//
// One pack is the GOLDEN file: its key set IS the schema (the keys are
// the exact English strings the app emits), and its @echo pool sizes
// are the sizes every other pack must match, index-aligned. Every
// other pack must carry every key and nothing else; every value must
// keep the English key's {placeholders} and HTML tags; a plural object
// must be shaped for CLDR.
//
//   node i18n/doctor.mjs --dir docs/lang --golden es          → all packs
//   node i18n/doctor.mjs --dir docs/lang --golden es fr       → one pack
//
// (The player's own tools/i18n_doctor.mjs additionally pins the pool
// sizes to the English pools inside docs/index.html; this standalone
// version trusts the golden pack, which that gate already validated.)
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const PLURAL_CATS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const placeholders = s => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort();
const tags = s => (String(s).match(/<\/?[a-z][a-z0-9]*\b/g) || []).map(t => t.toLowerCase()).sort();

export function checkPack(code, pack, golden){
  const errs = [];
  const err = m => errs.push(code + ': ' + m);
  const meta = pack['@meta'];
  if (!meta || meta.code !== code) err('@meta.code must be "' + code + '"');
  if (!meta || !meta.name || !meta.en) err('@meta needs name (endonym) and en (English name)');
  if (meta && meta.dir && meta.dir !== 'ltr' && meta.dir !== 'rtl') err('@meta.dir must be ltr or rtl');

  const want = golden['@echo'];
  const echo = pack['@echo'];
  if (want){
    if (!echo) err('@echo pools missing');
    else {
      if (!Array.isArray(echo.quotes) || echo.quotes.length !== want.quotes.length)
        err('@echo.quotes must have ' + want.quotes.length + ' entries (index-aligned with the golden pool)');
      else for (let i = 0; i < echo.quotes.length; i++){
        const q = echo.quotes[i];
        if (!q || !q.t || !q.a) err('@echo.quotes[' + i + '] needs t and a');
      }
      if (!Array.isArray(echo.prompts) || echo.prompts.length !== want.prompts.length)
        err('@echo.prompts must have ' + want.prompts.length + ' entries');
      for (const k of Object.keys(want.ack)){
        if (!echo.ack || !Array.isArray(echo.ack[k]) || echo.ack[k].length !== want.ack[k].length)
          err('@echo.ack.' + k + ' must have ' + want.ack[k].length + ' entries');
      }
      if (!Array.isArray(echo.frags) || echo.frags.length !== want.frags.length)
        err('@echo.frags must have ' + want.frags.length + ' entries');
      if (!Array.isArray(echo.turn) || echo.turn.length !== want.turn.length)
        err('@echo.turn must have ' + want.turn.length + ' entries');
      if (echo.feel){
        try { new RegExp(echo.feel, 'i'); } catch (e){ err('@echo.feel does not compile as a regex'); }
        if (/\\b/.test(echo.feel) && /[Ѐ-ӿ؀-ۿऀ-෿฀-๿぀-ヿ一-鿿가-힯]/.test(echo.feel))
          err('@echo.feel uses \\b beside a non-Latin script — JS \\b is ASCII-only there and never fires; use letter-class boundaries or plain alternation');
        if (/\(\?<[=!]/.test(echo.feel))
          err('@echo.feel uses lookbehind — unsupported in pre-16.4 Safari; use a consume-left boundary class instead');
      }
    }
  }

  const goldenKeys = Object.keys(golden).filter(k => k[0] !== '@');
  const packKeys = new Set(Object.keys(pack).filter(k => k[0] !== '@'));
  for (const k of goldenKeys) if (!packKeys.has(k)) err('missing key: ' + JSON.stringify(k.slice(0, 70)));
  for (const k of packKeys) if (!(k in golden)) err('unknown key (not in the golden set): ' + JSON.stringify(k.slice(0, 70)));

  for (const k of goldenKeys){
    const v = pack[k];
    if (v == null) continue;
    const variants = typeof v === 'object' ? Object.entries(v) : [[null, v]];
    if (typeof v === 'object'){
      if (!v.other) err('plural object without "other": ' + JSON.stringify(k.slice(0, 60)));
      for (const [cat] of variants) if (!PLURAL_CATS.has(cat)) err('bad plural category "' + cat + '" on ' + JSON.stringify(k.slice(0, 60)));
    }
    const wantPh = placeholders(k), wantTags = tags(k);
    for (const [cat, s] of variants){
      if (typeof s !== 'string'){ err('non-string value on ' + JSON.stringify(k.slice(0, 60))); continue; }
      const where = JSON.stringify(k.slice(0, 60)) + (cat ? ' [' + cat + ']' : '');
      const havePh = placeholders(s);
      for (const ph of wantPh) if (!havePh.includes(ph)) err('lost placeholder ' + ph + ' in ' + where);
      for (const ph of havePh) if (!wantPh.includes(ph)) err('invented placeholder ' + ph + ' in ' + where);
      const haveTags = tags(s);
      if (haveTags.join(',') !== wantTags.join(',')) err('HTML tags differ (' + wantTags.join(' ') + ' vs ' + haveTags.join(' ') + ') in ' + where);
    }
  }
  return errs;
}

export function runDoctor(langDir, goldenCode, only){
  const golden = JSON.parse(readFileSync(join(langDir, goldenCode + '.json'), 'utf8'));
  const files = readdirSync(langDir).filter(f => f.endsWith('.json'))
    .filter(f => !only || f === only + '.json').sort();
  const all = [];
  for (const f of files){
    const code = f.replace(/\.json$/, '');
    let pack;
    try { pack = JSON.parse(readFileSync(join(langDir, f), 'utf8')); }
    catch (e){ all.push(code + ': does not parse as JSON — ' + e.message); continue; }
    all.push(...checkPack(code, pack, golden));
  }
  return { files, errs: all, keyCount: Object.keys(golden).filter(k => k[0] !== '@').length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)){
  const args = process.argv.slice(2);
  const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
  const rest = args.filter((a, i) => a[0] !== '-' && args[i - 1] !== '--dir' && args[i - 1] !== '--golden');
  const { files, errs, keyCount } = runDoctor(opt('dir', 'docs/lang'), opt('golden', 'es'), rest[0] || null);
  console.log('i18n doctor — ' + files.length + ' pack(s), ' + keyCount + ' keys in the golden set');
  if (errs.length){
    for (const e of errs.slice(0, 60)) console.error('  ✗ ' + e);
    if (errs.length > 60) console.error('  … and ' + (errs.length - 60) + ' more');
    process.exit(1);
  }
  console.log('  ✓ every pack complete, placeholders and tags intact, pools aligned');
}
