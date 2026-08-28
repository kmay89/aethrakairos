// i18n doctor — every language pack held to the same contract.
//
// docs/lang/es.json is the golden file: its key set IS the schema (the keys
// are the exact English strings the player emits). Every other pack must
// carry every key and nothing else; every value must keep the English key's
// {placeholders} and HTML tags; a plural object must be shaped for CLDR; the
// echo pools must match the English pools' sizes, so the deal logic can
// index them one-to-one.
//
//   node tools/i18n_doctor.mjs            → report, exit 1 on any failure
//
// The unit suite runs the same checks (tests/player.test.mjs), so CI holds
// the door. This tool is the human-readable version of that gate.
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const langDir = join(root, 'docs', 'lang');
const html = readFileSync(join(root, 'docs', 'index.html'), 'utf8');

// the English echo pools, straight out of the shipped file — the same marker
// extraction the unit suite uses, so the sizes can never drift apart
function block(name){
  const m = html.match(new RegExp(`// @${name}-start\\n([\\s\\S]*?)// @${name}-end`));
  if (!m) throw new Error(`marker block ${name} not found`);
  return m[1];
}
const echoEnv = new Function(block('pure') + '\n' + block('echo')
  + '\nreturn { ECHO_QUOTES, ECHO_PROMPTS, ECHO_ACK, ECHO_FRAGS, ECHO_TURN };')();

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

  const echo = pack['@echo'];
  if (!echo) err('@echo pools missing');
  else {
    if (!Array.isArray(echo.quotes) || echo.quotes.length !== echoEnv.ECHO_QUOTES.length)
      err('@echo.quotes must have ' + echoEnv.ECHO_QUOTES.length + ' entries (index-aligned with the English pool)');
    else for (let i = 0; i < echo.quotes.length; i++){
      const q = echo.quotes[i];
      if (!q || !q.t || !q.a) err('@echo.quotes[' + i + '] needs t and a');
    }
    if (!Array.isArray(echo.prompts) || echo.prompts.length !== echoEnv.ECHO_PROMPTS.length)
      err('@echo.prompts must have ' + echoEnv.ECHO_PROMPTS.length + ' entries');
    for (const k of ['q', 'short', 'long', 'feel', 'plain']){
      const want = echoEnv.ECHO_ACK[k].length;
      if (!echo.ack || !Array.isArray(echo.ack[k]) || echo.ack[k].length !== want)
        err('@echo.ack.' + k + ' must have ' + want + ' entries');
    }
    if (!Array.isArray(echo.frags) || echo.frags.length !== echoEnv.ECHO_FRAGS.length)
      err('@echo.frags must have ' + echoEnv.ECHO_FRAGS.length + ' entries');
    if (!Array.isArray(echo.turn) || echo.turn.length !== echoEnv.ECHO_TURN.length)
      err('@echo.turn must have ' + echoEnv.ECHO_TURN.length + ' entries');
    if (echo.feel){ try { new RegExp(echo.feel, 'i'); } catch (e){ err('@echo.feel does not compile as a regex'); } }
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

export function runDoctor(only){
  const golden = JSON.parse(readFileSync(join(langDir, 'es.json'), 'utf8'));
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
  const { files, errs, keyCount } = runDoctor(process.argv[2] || null);
  console.log('i18n doctor — ' + files.length + ' pack(s), ' + keyCount + ' keys in the golden set');
  if (errs.length){
    for (const e of errs.slice(0, 60)) console.error('  ✗ ' + e);
    if (errs.length > 60) console.error('  … and ' + (errs.length - 60) + ' more');
    process.exit(1);
  }
  console.log('  ✓ every pack complete, placeholders and tags intact, pools aligned');
}
