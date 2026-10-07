#!/usr/bin/env node
// tools/dance_prelude.mjs — THE DANCE PRELUDE, one source, two languages.
//
// The dance bus (docs/index.html, @dance block: danceBusStep) is twelve floats
// stepped once per frame on each stage's CPU. The rooms read them through a
// small set of SHAPE helpers — lean, stride, front, lamp, land, held, ring,
// breath — that must mean exactly the same thing in a web fragment (GLSL ES
// 1.0) and in a Metal translation unit (MSL). Two hand-kept copies would drift;
// so the helpers are written ONCE here and emitted:
//
//   GLSL  → the `const GLSL_DANCE` block in docs/index.html, between the markers
//           /* @dance-prelude-begin */ … /* @dance-prelude-end */  (the player is
//           one file, so the block is embedded, and this tool keeps it honest)
//   MSL   → any .metal file carrying
//           // @dance-prelude-begin(suffix,_a)  … // @dance-prelude-end     (every
//           helper named dance…_a — Shaders2.metal's one-suffix law), or
//           // @dance-prelude-begin(namespace)  … // @dance-prelude-end     (plain
//           names, placed inside the TU's namespace block — Shaders40/41/42)
//
//   node tools/dance_prelude.mjs --check          # refuse drift (the unit test runs this)
//   node tools/dance_prelude.mjs --write          # refresh every embedded copy
//   node tools/dance_prelude.mjs --print glsl | msl:suffix:_a | msl:namespace
//
// Rules the emitted text obeys on both sides: float literals everywhere (no bare
// ints in float math), S = smoothstep, no derivatives, no mod/fmod, no loops.
// On the web the twelve accessors are #defines onto three vec4 uniforms
// (uDance0 = hit,age,kick,mass; uDance1 = artic,spark,sway,lift; uDance2 =
// brace,impact,still,period); on Metal they are the fields VizUniforms gains at
// bytes 144..191 (stage 2), so the MSL helpers that read the bus take
// `constant VizUniforms& U` as their first argument. The JS twins of every
// shape (danceLeanJS … danceRingJS in the @dance block) are tested against the
// same formulas in tests/player.test.mjs.
//
// No dependencies. Node ≥ 18.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

export const BUS = ['dHit', 'dAge', 'dKick', 'dMass', 'dArtic', 'dSpark', 'dSway', 'dLift', 'dBrace', 'dImpact', 'dStill', 'dPeriod'];
const VEC4 = ['uDance0', 'uDance1', 'uDance2'];
const SWIZZLE = ['x', 'y', 'z', 'w'];

export const WEB_BEGIN = '/* @dance-prelude-begin */';
export const WEB_END = '/* @dance-prelude-end */';
export const MSL_BEGIN_RE = /\/\/ @dance-prelude-begin\((suffix|namespace)(?:,\s*([A-Za-z_]\w*))?\)[ \t]*\n/g;
export const MSL_END = '// @dance-prelude-end';

/* The helpers. `uses: true` marks a helper that reads a uniform (on Metal it
   then takes `constant VizUniforms& U`). In a body, ${U:name} is a uniform read
   (barPhase or one of the twelve) and ${F:name}() a call to another helper. */
const HELPERS = [
  { name: 'danceBeatPhase', args: '', uses: true,
    doc: '0 at the hit, 1 at the next count - the bar phase, four to the bar',
    body: 'return fract(${U:barPhase} * 4.0);' },
  { name: 'danceBeatWeight', args: '', uses: true,
    doc: 'the count\'s weight: 1 on the one, 0.8 on the three, 0.6 on the two and the four; 0.8 without a bar (freewheel)',
    body: 'if (${U:dPeriod} <= 0.0) return 0.8; float i = floor(${U:barPhase} * 4.0); return i < 0.5 ? 1.0 : (abs(i - 2.0) < 0.5 ? 0.8 : 0.6);' },
  { name: 'danceLean', args: 'float ph', uses: true,
    doc: 'the coil before the beat: loads over the last 40 % of the beat, unloads in the last 35 ms as dKick begins to rise; gated by stillness, 0.4 when freewheeling. Rooms subtract ~20 % of the hit\'s gain x lean: the form draws back before it moves',
    body: 'return ${U:dStill} * (0.6 + 0.4 * ${U:dStill}) * smoothstep(0.60, 0.92, ph) * (1.0 - smoothstep(0.93, 1.0, ph)) * (${U:dPeriod} > 0.0 ? 1.0 : 0.4);' },
  { name: 'danceStride', args: 'float ph, float A',
    doc: 'the step: a C1 reshaping of the beat\'s progress - fastest on the count, dwelling at the half; slope 1 + A*cos >= 0.25 for A <= 0.75, so a walk on it never runs backwards (T += dPeriod * (danceStride(ph, A) - ph))',
    body: 'return ph + (A / 6.2831853) * sin(6.2831853 * ph);' },
  { name: 'danceFront', args: 'float x, float age, float w',
    doc: 'a travelling head along x (0 near ... 1 far) that leaves at age 0 and arrives at age 1 - the beat as an event with a place',
    body: 'float d = (x - min(age, 1.0)) / w; return exp(-d * d);' },
  { name: 'danceLamp', args: 'float hit, float age',
    doc: 'struck on the hit (the 0.12-beat attack is the body arriving, not a snap), HELD through the fall, released in the last third of the beat; 0 once the beat is over',
    body: 'return (0.5 + 0.5 * hit) * smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.62, 1.0, age)) * step(age, 1.0);' },
  { name: 'danceLand', args: 'float age',
    doc: 'the heavy landing (age = dImpact, in beats): a struck mass with period two beats and zeta 0.32 - peak 1 at 0.42 beat, one rebound below rest (-35 %), within 5 % by a bar; 0 for age >= 8 (none)',
    body: 'return 1.60729 * exp(-1.00531 * age) * sin(2.97640 * age) * step(0.0, age) * (1.0 - step(8.0, age));' },
  { name: 'danceHeld', args: 'float barIdx, float barPh, float seed',
    doc: 'articulation held per bar: a re-sculpt in the first fifth of the bar, then hold - a fold turns once per bar, never 0.04 rad on every snare',
    body: 'float a = fract(sin((barIdx - 1.0) * 12.9898 + seed) * 43758.5453); float b = fract(sin(barIdx * 12.9898 + seed) * 43758.5453); return mix(a, b, smoothstep(0.0, 0.2, barPh));' },
  { name: 'danceRing', args: 'float ph, float a, float b',
    doc: 'a struck damped oscillator\'s PERIODIC steady state from the phase alone (= sum e^{-a(ph+k)} sin(b(ph+k))): a sprung rebound at a fixed place in the beat with no CPU state. a = settle (2.5 ~ 92 % by the next count), b = 2*pi x rebounds',
    body: 'float ea = exp(-a); return exp(-a * ph) * (sin(b * ph) - ea * sin(b * ph - b)) / (1.0 - 2.0 * ea * cos(b) + ea * ea);' },
  { name: 'danceBreath', args: 'float amt', uses: true,
    doc: 'the breathing law (Shaders.metal\'s pulse room): a swell with the beat clock, never a flash with it',
    body: 'return 1.0 + amt * cos(${F:danceBeatPhase}() * 6.2831853);' },
];

function uniformName(lang, field, sfx){
  if (lang === 'msl') return 'U.' + field;
  if (field === 'barPhase') return 'uBarPhase';
  return field;                                   // the #define
}
function render(h, lang, sfx){
  const name = h.name + (lang === 'msl' ? sfx : '');
  let body = h.body
    .replace(/\$\{U:(\w+)\}/g, (_, f) => uniformName(lang, f, sfx))
    .replace(/\$\{F:(\w+)\}\(\)/g, (_, f) => lang === 'msl' ? f + sfx + '(U)' : f + '()');
  let args = h.args;
  if (lang === 'msl' && h.uses) args = 'constant VizUniforms& U' + (args ? ', ' + args : '');
  const head = (lang === 'msl' ? 'inline ' : '') + 'float ' + name + '(' + args + ')';
  return { doc: h.doc, line: head + '{ ' + body + ' }' };
}

/* emitGLSL — the web block's body: two-space indented lines, trailing newline,
   meant to sit inside `const GLSL_DANCE = \`…\`;` and be concatenated by a room
   exactly as GLSL_MPHI is. Declares the three vec4s and uBarPhase: a room that
   adopts it drops its own `uniform float uBarPhase` (GLSL forbids two). */
export function emitGLSL(){
  const L = [];
  L.push('// THE DANCE BUS - generated by tools/dance_prelude.mjs (node tools/dance_prelude.mjs --write); never edit by hand.');
  L.push('// Twelve floats stepped once per frame by danceBusStep; the MSL twin of every helper below is emitted from the same source.');
  L.push('uniform vec4 ' + VEC4.join(', ') + ';');
  L.push('uniform float uBarPhase;');
  BUS.forEach((n, i) => L.push('#define ' + n + ' ' + VEC4[i >> 2] + '.' + SWIZZLE[i & 3]));
  for (const h of HELPERS){
    const r = render(h, 'glsl', '');
    L.push('// ' + r.doc);
    L.push(r.line);
  }
  return L.map(l => '  ' + l).join('\n') + '\n';
}

/* emitMSL — the Metal block's body for one translation unit. mode 'suffix'
   appends sfx (e.g. '_a') to every helper, the one-suffix law of a flat TU;
   mode 'namespace' emits plain names for placement inside the TU's namespace
   block. Helpers that read the bus take `constant VizUniforms& U` first; the
   accessors are U.dHit … U.dPeriod (VizUniforms bytes 144..191). */
export function emitMSL(opts){
  const o = opts || {};
  const mode = o.mode === 'namespace' ? 'namespace' : 'suffix';
  const sfx = mode === 'suffix' ? (o.sfx || '_a') : '';
  if (mode === 'suffix' && !/^_[A-Za-z0-9_]*$/.test(sfx)) throw new Error('dance_prelude: a suffix starts with _ (got ' + JSON.stringify(sfx) + ')');
  const L = [];
  L.push('// THE DANCE BUS - generated by tools/dance_prelude.mjs (node tools/dance_prelude.mjs --write); never edit by hand.');
  L.push('// Accessors: U.' + BUS[0] + ' ... U.' + BUS[BUS.length - 1] + ' (VizUniforms bytes 144..191). Mode: ' + mode + (sfx ? ' ' + sfx : '') + '.');
  for (const h of HELPERS){
    const r = render(h, 'msl', sfx);
    L.push('// ' + r.doc);
    L.push(r.line);
  }
  return L.join('\n') + '\n';
}

/* webBlock — exactly what stands between the two web markers. */
export function webBlock(){ return 'const GLSL_DANCE = `\n' + emitGLSL() + '`;\n'; }

const WEB_FILE = 'docs/index.html';
const METAL_DIR = 'tvos';

function walkMetal(root){
  const out = [];
  const walk = dir => {
    let ents;
    try { ents = readdirSync(join(root, dir), { withFileTypes: true }); } catch (e){ return; }
    for (const e of ents){
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.metal')) out.push(rel);
    }
  };
  walk(METAL_DIR);
  return out.sort();
}

function webRegion(html){
  const a = html.indexOf(WEB_BEGIN), b = html.indexOf(WEB_END);
  if (a < 0 || b < 0 || b < a) return null;
  const start = a + WEB_BEGIN.length + 1;          // after the marker's newline
  return { start, end: b, text: html.slice(start, b) };
}

/* metalRegions — every marked block in one file: [{mode, sfx, start, end, text}]. */
function metalRegions(src){
  const out = [];
  MSL_BEGIN_RE.lastIndex = 0;
  let m;
  while ((m = MSL_BEGIN_RE.exec(src))){
    const start = m.index + m[0].length;
    const end = src.indexOf(MSL_END, start);
    if (end < 0){ out.push({ mode: m[1], sfx: m[2], start, end: -1, text: null }); break; }
    out.push({ mode: m[1], sfx: m[2], start, end, text: src.slice(start, end) });
  }
  return out;
}

/* check — every embedded copy equals the generator's text. Returns the list of
   problems (empty = clean). root: the repository root. */
export function check(root){
  const problems = [];
  let html;
  try { html = readFileSync(join(root, WEB_FILE), 'utf8'); }
  catch (e){ return [WEB_FILE + ': cannot read (' + e.message + ')']; }
  const wr = webRegion(html);
  if (!wr) problems.push(WEB_FILE + ': the markers ' + WEB_BEGIN + ' … ' + WEB_END + ' are missing');
  else if (wr.text !== webBlock()) problems.push(WEB_FILE + ': the GLSL_DANCE block differs from emitGLSL() — run node tools/dance_prelude.mjs --write');
  if (html.split(WEB_BEGIN).length > 2) problems.push(WEB_FILE + ': more than one ' + WEB_BEGIN);
  for (const f of walkMetal(root)){
    const src = readFileSync(join(root, f), 'utf8');
    if (!src.includes('@dance-prelude-begin')) continue;
    const regions = metalRegions(src);
    if (!regions.length) problems.push(f + ': a @dance-prelude-begin marker that does not parse — use // @dance-prelude-begin(suffix,_a) or // @dance-prelude-begin(namespace)');
    for (const r of regions){
      if (r.end < 0){ problems.push(f + ': @dance-prelude-begin without ' + MSL_END); continue; }
      if (r.mode === 'suffix' && !r.sfx){ problems.push(f + ': suffix mode needs a suffix, e.g. (suffix,_a)'); continue; }
      const want = emitMSL({ mode: r.mode, sfx: r.sfx });
      if (r.text !== want) problems.push(f + ': the ' + r.mode + (r.sfx ? ' ' + r.sfx : '') + ' prelude differs from emitMSL() — run node tools/dance_prelude.mjs --write');
    }
  }
  return problems;
}

/* write — refresh every embedded copy in place. Returns the files touched. */
export function write(root){
  const touched = [];
  const html = readFileSync(join(root, WEB_FILE), 'utf8');
  const wr = webRegion(html);
  if (!wr) throw new Error(WEB_FILE + ': the markers ' + WEB_BEGIN + ' … ' + WEB_END + ' are missing — add them next to GLSL_MPHI first');
  const next = html.slice(0, wr.start) + webBlock() + html.slice(wr.end);
  if (next !== html){ writeFileSync(join(root, WEB_FILE), next); touched.push(WEB_FILE); }
  for (const f of walkMetal(root)){
    let src = readFileSync(join(root, f), 'utf8');
    if (!src.includes('@dance-prelude-begin')) continue;
    const regions = metalRegions(src).filter(r => r.end >= 0 && (r.mode === 'namespace' || r.sfx));
    let out = src;
    for (let i = regions.length - 1; i >= 0; i--){          // back to front keeps the offsets valid
      const r = regions[i];
      out = out.slice(0, r.start) + emitMSL({ mode: r.mode, sfx: r.sfx }) + out.slice(r.end);
    }
    if (out !== src){ writeFileSync(join(root, f), out); touched.push(f); }
  }
  return touched;
}

// ------------------------------------------------------------------ CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain){
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const args = process.argv.slice(2);
  if (args[0] === '--check'){
    const p = check(root);
    if (p.length){ for (const x of p) console.error('dance_prelude: ' + x); process.exit(1); }
    console.log('dance_prelude: every embedded prelude matches the generator');
  } else if (args[0] === '--write'){
    const t = write(root);
    console.log(t.length ? 'dance_prelude: refreshed ' + t.join(', ') : 'dance_prelude: nothing to refresh');
  } else if (args[0] === '--print'){
    const what = (args[1] || 'glsl').split(':');
    if (what[0] === 'glsl') process.stdout.write(emitGLSL());
    else if (what[0] === 'msl') process.stdout.write(emitMSL({ mode: what[1] || 'suffix', sfx: what[2] || '_a' }));
    else { console.error('dance_prelude: --print glsl | msl:suffix:_a | msl:namespace'); process.exit(2); }
  } else {
    console.error('usage: node tools/dance_prelude.mjs --check | --write | --print glsl|msl:suffix:_a|msl:namespace');
    process.exit(2);
  }
}
