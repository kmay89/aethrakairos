#!/usr/bin/env node
/* DEVELOP AUDIT — which of a room's dice may be EASED, on both stages.

   A room's second act (sceneDevelop's rollEased on the web, the TV's
   rollTarget) tweens the variation dice toward a fresh deal over two bars.
   That is only a breath when the shader reads the die SMOOTHLY — a scale, a
   mix, a radius. A die that is floored into a count, compared against 0.5
   for a spin sign, fed to a hash, or multiplied into the running clock does
   not breathe when it is swept: it re-deals the whole field a dozen times a
   second, flips a direction with a hard angle jump, or spins the room at
   strobe speed (uTime × Δdie is hundreds of radians late in a set). So the
   develop is opt-in per die, and this is the reader that decides it.

   The reader (below) follows the die and every local computed from it
   through the room's shaders — and its JS, and the helpers it calls — and
   errs toward NO: what it cannot parse it judges by a blunter rule, and a
   die the room never reads is not eligible either (nothing to breathe).

   Only dice A and B (uVarA/uVarB ↔ roll0/roll1) are candidates: the TV's
   roll2 also deals the MIRRORS lens fold for every room (Lens.metal), and a
   fold that flips 6 ↔ 8 in the middle of a look is exactly the cut the
   develop exists to avoid. A room is listed only when BOTH stages have a
   smooth die in it, so a room that develops here develops there.

   `node tools/develop_audit.mjs` prints what DEVELOP_DICE (docs/index.html)
   and Rooms.developDice (tvos/…/Rooms.swift) may hold (`--why` gives every
   refusal); the unit suite re-runs the audit, so a shader edit that makes a
   listed die discrete fails. */
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const DEVELOP_LETTERS = ['A', 'B'];
const WEB_DIE = { A: 'uVarA', B: 'uVarB', C: 'uVarC' };
const TV_DIE = { A: 'roll0', B: 'roll1', C: 'roll2' };

// calls that are continuous in every argument — anything else (floor, step,
// fract, mod, hash, noise, a room's own helper…) is a reason to say no
const SMOOTH = new Set(['mix', 'sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'tanh', 'clamp', 'saturate',
  'smoothstep', 'pow', 'exp', 'exp2', 'log', 'log2', 'sqrt', 'rsqrt', 'inversesqrt', 'abs', 'fabs', 'min', 'max',
  'fmin', 'fmax', 'length', 'normalize', 'dot', 'cross', 'distance', 'fma',
  'vec2', 'vec3', 'vec4', 'float', 'float2', 'float3', 'float4', 'half', 'half2', 'half3', 'half4',
  'mat2', 'mat3', 'float2x2', 'float3x3']);
// the clock and the phases that grow with it
const CLOCK = ['uTime', 'time', 'iTime', 'uPiPhase', 'uEPhase', 'elapsed', 'now', 'performance'];

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const TYPE = /^(?:const\s+|thread\s+|constexpr\s+)*(?:float[234]?(?:x[234])?|half[234]?|int[234]?|uint|bool|vec[234]|mat[234]|let|var)\s+/;
// split `float a = x, b = y` into its declarations (top-level commas only)
function splitDecl(s){
  if (!TYPE.test(s)) return [s];
  const parts = []; let depth = 0, from = 0;
  for (let i = 0; i < s.length; i++){
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0){ parts.push(s.slice(from, i)); from = i + 1; }
  }
  parts.push(s.slice(from));
  return parts.map(x => x.trim()).filter(Boolean);
}
const statements = src => stripComments(src).split(/[;{}]/).map(s => s.trim()).filter(Boolean)
  // a uniform/attribute/varying declaration, or a bare `float2 z, c`, reads nothing
  .filter(s => !/^(?:uniform|attribute|varying|in|out)\s/.test(s))
  .flatMap(splitDecl)
  .filter(s => !(TYPE.test(s) && !s.includes('=') && !s.includes('(')) && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(s));
// the identifiers a statement names. A member (`uv.y`, `col.rgb`) is not the
// local of the same name — except the dice and the clock themselves, which
// arrive as members (`U.roll0`, `U.time`, `u.uVarA.value`)
const MEMBER_OK = new Set(['uVarA', 'uVarB', 'uVarC', 'roll0', 'roll1', 'roll2', ...CLOCK]);
const idents = s => {
  const out = new Set();
  for (const m of s.matchAll(IDENT)){
    const dotted = /\.\s*$/.test(s.slice(Math.max(0, m.index - 3), m.index));
    // an object literal's key (`{ uVarA: { value: … } }`) names a uniform, it does not read one
    if (/^\s*:(?!:)/.test(s.slice(m.index + m[0].length)) && /(?:^|,)\s*$/.test(s.slice(0, m.index))) continue;
    if (!dotted || MEMBER_OK.has(m[0])) out.add(m[0]);
  }
  return out;
};
// the name a statement assigns (`float k = …`, `k += …`, `a.k = …`), or null;
// `pre` is what stands before the target, less the target's member chain
// (`varU.uVarA.value = Math.random()` is a deal, not a read) — so the test of
// a brace-less `if (die > 0.5) x = 1.0` is still read — and `rhs` what it gets
function assigned(s){
  const m = s.match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?\s*([+\-*/]?=)(?!=)/);
  if (!m) return null;
  const pre = s.slice(0, m.index).replace(/(?:[A-Za-z_][A-Za-z0-9_]*\s*\.\s*)+$/, ' ');
  const rhs = s.slice(m.index + m[0].length);
  return { name: m[1], op: m[2], decl: TYPE.test(s), pre, rhs };
}
/* THE READER. Each statement's right-hand side is parsed and every value
   carries flags: DIE (computed from the die) and CLOCK (computed from the
   running clock, or a phase that grows with it, and not yet folded back into
   a bounded range by a sin, a clamp or a ramp). Sums keep both and are
   harmless — `lean + sway(t)` breathes; a PRODUCT of the two is the spin that
   runs away (`uTime × (die·2 − 1)` sweeps hundreds of radians in a tween).
   Each die value also carries its GAIN — how far it moves per unit of die —
   and a periodic read (sin, cos, the cyclic colour ramp) of a steep one is a
   flicker however smooth the function: sin(die × 50) beats at 3 Hz through a
   two-bar tween. A die reaching an index, a modulo, a bit operation or a call
   outside the smooth set (floor, fract, int, any hash or noise) is a discrete
   read. So is a comparison, a ternary's test or a step() of the die — unless
   the compared value also carries POS, the pixel's own position: `u > plen`
   along a pinna whose length the die sets is an edge that SLIDES as the die
   moves, not a switch that flips the whole room at once. A call to one of the
   room's own helpers is read through, its parameters carrying the arguments'
   flags. Anything the reader cannot parse falls back to the blunt rule: a die
   and the clock in one statement, or a die beside any rough call, is a no.
   Flags flow in program order; a fresh declaration replaces a name's flags
   (short names are reused all over a shader), a reassignment only adds to
   them (it may be conditional); two passes carry a value round a loop. */
const DIE = 1, CLK = 2, POS = 4;
// where a pixel is: the TV fragment's [[position]], the web's varyings and gl_FragCoord
const WHERE = ['pos', 'gl_FragCoord', 'vUv', 'uv', 'position'];
// a test of the die is a switch, unless it is a test of where the pixel sits
const switchOn = f => (f & DIE) && !(f & POS);
// calls whose output is bounded however far the input runs — the clock is folded away
const BOUNDED = /^(?:sin|cos|tanh|atan|atan2|smoothstep|clamp|saturate|govern(?:_[a-z])?|ramp|chordRamp_[a-z])$/;
// calls that act on each argument alone (no product between them)
const LINEAR = /^(?:vec[234]|float[234]?|half[234]?|mat[234]|float[234]x[234]|min|max|fmin|fmax|abs|fabs|sin|cos|tan|atan|asin|acos|tanh|exp|exp2|log|log2|sqrt|rsqrt|inversesqrt|length|normalize|saturate)$/;
// the INK governor is a soft knee; the colour ramps are cyclic and continuous
// (the web's ramp() wraps a ring of stops, the TV's chordRamp_* walks A→B→C→A)
const RAMP = /^(?:ramp|chordRamp_[a-z])$/;
const smoothCall = n => SMOOTH.has(n) || RAMP.test(n) || /^govern(?:_[a-z])?$/.test(n);
// a periodic read's steepest allowed gain: two turns, or two trips round the ramp, per unit of die
const PERIOD_GAIN = { sin: 12.6, cos: 12.6, tan: 12.6 };
const periodGain = n => PERIOD_GAIN[n] || (RAMP.test(n) ? 2 : 0);
class Rough extends Error {}
class Discrete extends Error {}

function tokenize(src){
  const out = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?[fFhHuU]?|\.\d+(?:[eE][+-]?\d+)?[fFhH]?)|([A-Za-z_][A-Za-z0-9_]*)|(<<|>>|<=|>=|==|!=|&&|\|\||[-+*/%<>!~&|^?:,.()\[\]]))/y;
  while (re.lastIndex < src.length){
    const at = re.lastIndex;
    const m = re.exec(src);
    if (!m){ if (/^\s*$/.test(src.slice(at))) break; throw new Rough('token at ' + src.slice(at, at + 12)); }
    if (m[1] != null) out.push({ t: 'num', v: parseFloat(m[1]) });
    else if (m[2] != null) out.push({ t: 'id', v: m[2] });
    else out.push({ t: 'op', v: m[3] });
  }
  return out;
}
const PREC = { '?': 1, '||': 2, '&&': 3, '|': 4, '^': 5, '&': 6, '==': 7, '!=': 7, '<': 8, '>': 8, '<=': 8, '>=': 8,
               '<<': 9, '>>': 9, '+': 10, '-': 10, '*': 11, '/': 11, '%': 11 };

// the helpers a room's source defines: name → { params, body }
function helpersOf(src){
  const out = {};
  const clean = stripComments(src);
  const re = /(?:^|[\n;}])\s*(?:inline\s+|static\s+)*(?:float[234]?|vec[234]|half[234]?|int|uint|bool|void|float[234]x[234]|mat[234])\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)\s*\{/g;
  for (const m of clean.matchAll(re)){
    let depth = 1, j = m.index + m[0].length;
    for (; j < clean.length && depth; j++){ if (clean[j] === '{') depth++; else if (clean[j] === '}') depth--; }
    const params = m[2].split(',').map(p => (p.trim().match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?\s*$/) || [])[1]).filter(Boolean);
    if (!out[m[1]]) out[m[1]] = { params, body: clean.slice(m.index + m[0].length, j - 1) };
  }
  return out;
}

function evalExpr(src, ctx){
  const { vars, gains, dieName } = ctx;
  const tk = tokenize(src);
  let i = 0;
  const peek = () => tk[i], next = () => tk[i++];
  const expect = v => { const t = next(); if (!t || t.v !== v) throw new Rough('expected ' + v); };
  const product = (a, b, why) => {
    if (((a.f & DIE) && (b.f & CLK)) || ((a.f & CLK) && (b.f & DIE))) throw new Discrete('clock × die: ' + why);
  };
  // the gain of a product: a known constant scales it; two unknowns are taken as O(1) each
  const gainMul = (a, b) => a.num != null ? Math.abs(a.num) * b.g : b.num != null ? a.g * Math.abs(b.num) : a.g + b.g;
  function call(name){
    const args = [];
    if (peek() && peek().v !== ')'){ for (;;){ args.push(expr(0)); if (peek() && peek().v === ','){ next(); continue; } break; } }
    expect(')');
    let f = 0, g = 0;
    for (const a of args){ f |= a.f; g += a.g; }
    if (name === 'step'){ if (switchOn(f)) throw new Discrete('step() of die'); return { f: f & ~CLK, g: 0 }; }
    if (!smoothCall(name)){
      if (!(f & DIE)) return { f, g: 0 };
      const h = ctx.helpers[name];
      if (!h || ctx.depth >= 4) throw new Discrete(name + '()');
      // read through the room's own helper, its parameters carrying the arguments' flags
      const inner = { vars: new Map([...CLOCK.map(c => [c, CLK]), ...WHERE.map(w => [w, POS])]), gains: new Map(), dieName, helpers: ctx.helpers, depth: ctx.depth + 1 };
      if (dieName) inner.vars.set(dieName, DIE), inner.gains.set(dieName, 1);
      h.params.forEach((p, k) => { if (args[k]){ inner.vars.set(p, args[k].f); inner.gains.set(p, args[k].g); } });
      const r = readStatements(statements(h.body), inner);
      if (r.bad) throw new Discrete(name + '() → ' + r.bad);
      return { f: r.ret.f | f, g: Math.max(r.ret.g, g) };
    }
    if (!LINEAR.test(name)) for (let x = 0; x < args.length; x++) for (let y = x + 1; y < args.length; y++) product(args[x], args[y], name + '()');
    const pg = periodGain(name);
    if (pg && g > pg) throw new Discrete('steep periodic ' + name + '() (gain ' + g.toFixed(1) + ')');
    return BOUNDED.test(name) ? { f: f & ~CLK, g: Math.min(g, 2) } : { f, g };
  }
  function primary(){
    const t = next();
    if (!t) throw new Rough('eof');
    let v;
    if (t.t === 'num') v = { f: 0, g: 0, num: t.v };
    else if (t.t === 'id'){
      if (peek() && peek().v === '('){ next(); v = call(t.v); }
      else v = { f: vars.get(t.v) || 0, g: gains.get(t.v) || 0 };
    } else if (t.v === '('){ v = expr(0); expect(')'); }
    else if (t.v === '-' || t.v === '+'){ const x = primary(); v = { f: x.f, g: x.g, num: x.num != null ? (t.v === '-' ? -x.num : x.num) : undefined }; }
    else if (t.v === '!' || t.v === '~'){ const x = primary(); if (switchOn(x.f)) throw new Discrete('branch ' + t.v); v = { f: x.f, g: 0 }; }
    else throw new Rough('unexpected ' + t.v);
    // postfix: members (the die and the clock arrive as members: U.roll0, U.time, u.uVarA.value) and indices
    for (;;){
      const p = peek();
      if (p && p.v === '.'){
        next(); const m = next();
        if (!m || m.t !== 'id') throw new Rough('member');
        if (m.v === dieName) v = { f: v.f | DIE, g: v.g + 1 };
        else if (CLOCK.includes(m.v)) v = { f: v.f | CLK, g: v.g };
      } else if (p && p.v === '['){
        next(); const ix = expr(0); expect(']');
        if (ix.f & DIE) throw new Discrete('index by die');
      } else break;
    }
    return v;
  }
  function expr(min){
    let a = primary();
    for (;;){
      const t = peek();
      if (!t || t.t !== 'op' || !(t.v in PREC) || PREC[t.v] < min) break;
      next();
      if (t.v === '?'){
        if (switchOn(a.f)) throw new Discrete('ternary on die');
        const b = expr(0); expect(':'); const c = expr(1);
        a = { f: a.f | b.f | c.f, g: Math.max(b.g, c.g) };
        continue;
      }
      const b = expr(PREC[t.v] + 1);
      if (t.v === '*' || t.v === '/'){
        product(a, b, t.v);
        const g = t.v === '*' ? gainMul(a, b) : (b.num ? a.g / Math.abs(b.num) : a.g + b.g);
        a = { f: a.f | b.f, g, num: a.num != null && b.num != null ? (t.v === '*' ? a.num * b.num : a.num / b.num) : undefined };
      } else if (t.v === '+' || t.v === '-'){
        a = { f: a.f | b.f, g: a.g + b.g, num: a.num != null && b.num != null ? (t.v === '+' ? a.num + b.num : a.num - b.num) : undefined };
      } else if (['%', '|', '&', '^', '<<', '>>'].includes(t.v)){
        if ((a.f | b.f) & DIE) throw new Discrete('integer ' + t.v);
        a = { f: a.f | b.f, g: 0 };
      } else {
        if (switchOn(a.f | b.f)) throw new Discrete('branch ' + t.v);
        a = { f: a.f | b.f, g: 0 };
      }
    }
    return a;
  }
  const v = expr(0);
  if (i < tk.length) throw new Rough('trailing ' + tk[i].v);
  return v;
}

/* One body, in order, twice: { reads, bad, ret } — `bad` is the first
   discrete read (null when there is none), `ret` the flags of what it returns. */
function readStatements(stmts, ctx){
  const { vars, gains } = ctx;
  const has = (s, bit) => { for (const x of idents(s)) if ((vars.get(x) || 0) & bit) return true; return false; };
  let reads = 0;
  const ret = { f: 0, g: 0 };
  for (let pass = 0; pass < 2; pass++){
    for (const s of stmts){
      const a = assigned(s);
      // what the statement reads: the right-hand side, and any test before the target
      let rhs = a ? a.rhs : s;
      let pre = a ? a.pre : '';
      pre = pre.replace(TYPE, '').replace(/^\s*(?:else\s+)?(?:if|while)\b/, '').trim();
      if (!a){
        // `if (test) continue` / `if (test) return x`: the test is read, then what follows it
        const m = rhs.match(/^\s*(?:else\s+)?(?:if|while)\s*\(/);
        if (m){
          let depth = 1, j = m[0].length;
          for (; j < rhs.length && depth; j++){ if (rhs[j] === '(') depth++; else if (rhs[j] === ')') depth--; }
          pre = rhs.slice(m[0].length - 1, j);
          rhs = rhs.slice(j).trim();
        }
        rhs = rhs.replace(/^\s*(?:else|do|break|continue|discard|default\s*:)\s*/, '').trim();
      }
      const isReturn = !a && /^\s*return\b/.test(rhs);
      rhs = rhs.replace(/^\s*return\b/, '').trim();
      const compound = !!(a && a.op !== '=');
      const reading = has(pre + ' ' + rhs, DIE) || (compound && ((vars.get(a.name) || 0) & DIE));
      let v = { f: 0, g: 0 };
      try {
        if (pre && switchOn(evalExpr(pre, ctx).f)) throw new Discrete('branch on die');
        if (rhs) v = evalExpr(rhs, ctx);
        if (compound){
          const old = { f: vars.get(a.name) || 0, g: gains.get(a.name) || 0 };
          if ((a.op === '*=' || a.op === '/=') && (((old.f & DIE) && (v.f & CLK)) || ((old.f & CLK) && (v.f & DIE))))
            throw new Discrete('clock × die: ' + a.op);
          v = { f: old.f | v.f, g: a.op === '*=' ? (v.num != null ? old.g * Math.abs(v.num) : old.g + v.g) : old.g + v.g };
        }
      } catch (e){
        if (e instanceof Discrete) return { reads: reads + 1, bad: e.message + ' — ' + s, ret };
        if (!(e instanceof Rough)) throw e;
        if (reading){
          // the blunt rule for what the reader cannot parse
          if (has(s, CLK)) return { reads: reads + 1, bad: 'unparsed, clock — ' + s, ret };
          for (const m of s.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))
            if (!smoothCall(m[1]) || periodGain(m[1])) return { reads: reads + 1, bad: 'unparsed, ' + m[1] + '() — ' + s, ret };
          if (/[<>?%|&!]|==/.test(s)) return { reads: reads + 1, bad: 'unparsed, branch — ' + s, ret };
          v = { f: DIE, g: 99 };                       // a gain we could not read is taken as steep
        } else v = { f: has(s, CLK) ? CLK : 0, g: 0 };
      }
      if (pass === 0 && reading) reads++;
      if (isReturn){ ret.f |= v.f; ret.g = Math.max(ret.g, v.g); }
      if (a && a.name !== ctx.dieName){
        if (a.decl || compound){ vars.set(a.name, v.f); gains.set(a.name, v.g); }
        else { vars.set(a.name, (vars.get(a.name) || 0) | v.f); gains.set(a.name, Math.max(gains.get(a.name) || 0, v.g)); }
      }
    }
  }
  return { reads, bad: null, ret };
}

/* The verdict for one die in one room's source: { reads, smooth, why }.
   `die` is the token (uVarA / roll0). */
export function dieVerdict(src, die){
  const ctx = { vars: new Map([[die, DIE], ...CLOCK.map(c => [c, CLK]), ...WHERE.map(w => [w, POS])]), gains: new Map([[die, 1]]),
                dieName: die, helpers: helpersOf(src), depth: 0 };
  const r = readStatements(statements(src), ctx);
  if (r.bad) return { reads: r.reads, smooth: false, why: r.bad };
  return { reads: r.reads, smooth: r.reads > 0, why: r.reads ? '' : 'never read' };
}

/* ---- the web: each room's builder, plus any shared GLSL chunk it splices in ---- */
export function webRooms(html){
  const keysSrc = html.slice(html.indexOf('const SCENE_KEYS = ['), html.indexOf('];', html.indexOf('const SCENE_KEYS = [')));
  const keys = [...keysSrc.matchAll(/'([a-z0-9]+)'/g)].map(m => m[1]);
  const pushAt = html.indexOf('scenes.push(buildSpiral()');
  const push = html.slice(pushAt, html.indexOf(');\n', pushAt));
  const builders = [...push.matchAll(/(build[A-Za-z0-9]+)\(\)/g)].map(m => m[1]);
  const chunks = {};
  for (const m of html.matchAll(/^const ([A-Z0-9_]+) = `([\s\S]*?)`;/gm)) if (/uVar[ABC]/.test(m[2])) chunks[m[1]] = m[2];
  const out = {};
  builders.forEach((b, i) => {
    const at = html.indexOf('\nfunction ' + b + '(');
    if (at < 0) throw new Error('no builder ' + b);
    const end = html.indexOf('\n}\n', at);
    let src = html.slice(at, end + 2);
    for (const [name, text] of Object.entries(chunks)) if (new RegExp('\\b' + name + '\\b').test(src)) src += '\n' + text;
    out[keys[i]] = src;
  });
  return out;
}

/* ---- the TV: each room's fragment, plus every helper in its file it calls ---- */
export function tvRooms(roomsSwift, metalFiles){
  const byFile = [];         // per file: function name → its text
  for (const src of metalFiles){
    const f = {};
    const lines = src.split('\n');
    let cur = null, buf = [];
    for (const line of lines){
      if (!cur && /^[A-Za-z]/.test(line) && line.includes('(') && !/^(struct|constant|#|using|typedef|enum)/.test(line)){
        const m = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        if (m){ cur = m[1]; buf = [line]; if (/\}\s*$/.test(line) && line.includes('{')){ f[cur] = line; cur = null; } continue; }
      }
      if (cur){
        buf.push(line);
        if (/^\}/.test(line)){ f[cur] = buf.join('\n'); cur = null; }
      }
    }
    byFile.push(f);
  }
  const rooms = [...roomsSwift.matchAll(/Room\(key: "([a-z0-9]+)",[^)]*?fragmentFunction: "([a-z0-9_]+)"/g)].map(m => ({ key: m[1], fn: m[2] }));
  const out = {};
  for (const r of rooms){
    const file = byFile.find(f => f[r.fn]);
    if (!file) throw new Error('no fragment ' + r.fn);
    const seen = new Set([r.fn]), queue = [r.fn];
    let src = '';
    while (queue.length){
      const n = queue.shift();
      src += '\n' + file[n];
      for (const m of file[n].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))
        if (file[m[1]] && !seen.has(m[1])){ seen.add(m[1]); queue.push(m[1]); }
    }
    out[r.key] = src;
  }
  return out;
}

/* The audit: for every room, the letters each stage reads smoothly, and why
   the others are not. `table` is what DEVELOP_DICE may hold: the rooms that
   have a smooth die on BOTH stages (a room develops on both or on neither —
   the parity law), each stage easing its own smooth dice. The two stages'
   letters need not match: they are separate translations, and the web's
   uVarA and the TV's roll0 deal different things in most rooms anyway. */
export function auditDevelop(root){
  const html = readFileSync(join(root, 'docs/index.html'), 'utf8');
  const vis = join(root, 'tvos/AethraKairosTV/Visualizer');
  const roomsSwift = readFileSync(join(vis, 'Rooms.swift'), 'utf8');
  const metal = readdirSync(vis).filter(f => /^Shaders\d*\.metal$/.test(f)).map(f => readFileSync(join(vis, f), 'utf8'));
  const web = webRooms(html), tv = tvRooms(roomsSwift, metal);
  const table = {}, detail = {}, smooth = { web: {}, tv: {} };
  for (const key of Object.keys(tv)){
    detail[key] = {};
    let w = '', t = '';
    for (const L of DEVELOP_LETTERS){
      const wv = dieVerdict(web[key] || '', WEB_DIE[L]), tvv = dieVerdict(tv[key], TV_DIE[L]);
      detail[key][L] = { web: wv, tv: tvv };
      if (wv.smooth) w += L;
      if (tvv.smooth) t += L;
    }
    if (w) smooth.web[key] = w;
    if (t) smooth.tv[key] = t;
    if (w && t) table[key] = { web: w, tv: t };
  }
  return { table, smooth, detail };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const { table, smooth, detail } = auditDevelop(root);
  if (process.argv.includes('--why')){
    for (const [k, d] of Object.entries(detail))
      for (const [L, v] of Object.entries(d))
        console.log(`${k}.${L}  web:${v.web.smooth ? 'smooth' : 'NO'} ${v.web.why.slice(0, 110)}\n${' '.repeat(k.length + 3)}tv:${v.tv.smooth ? 'smooth' : 'NO'} ${v.tv.why.slice(0, 110)}`);
  }
  console.log('smooth on the web: ' + JSON.stringify(smooth.web));
  console.log('smooth on the TV:  ' + JSON.stringify(smooth.tv));
  console.log('DEVELOP_DICE may hold: ' + JSON.stringify(table));
  console.log(Object.keys(table).length + ' of ' + Object.keys(detail).length + ' rooms may develop on both stages');
}
