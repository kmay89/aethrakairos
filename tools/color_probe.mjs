/* COLOUR PROBE — measures what the eye complains about.
 *
 * The failure this instrument exists to catch is WASHOUT: hundreds of additive
 * sprites summing past 1.0 in the framebuffer, every channel clipping, and a
 * scene that was supposed to be amber ending up as a white blob with a coloured
 * rim. It is invisible to unit tests (the palette maths is perfect right up to
 * the moment the blend saturates) and invisible to a green CI run, so it gets
 * measured on a real GL context or it does not get measured at all.
 *
 * Per scene, at a scripted audio state, it reports:
 *   blown  — share of pixels reading as white in ALL THREE channels (the defect —
 *            except at APEX, where it is the point)
 *   hot    — share of pixels above 0.75 luma (brightness, which we WANT)
 *   chroma — mean saturation of the lit pixels (colour, which washout destroys)
 *
 * blown near zero while hot and chroma stay high is the target: a radiant,
 * saturated field. blown climbing only in the APEX state is the design —
 * bleaching to white is meant to be the peak's privilege, not the default.
 *
 *   node tools/color_probe.mjs docs [--json out.json] [--png dir] [--scenes 0,3,7]
 *                                [--settle ms] [--nohdr]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);
const DIR = args[0] || 'docs';
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const JSON_OUT = flag('--json');
const PNG_DIR = flag('--png');
const ONLY = flag('--scenes');
const SETTLE = Number(flag('--settle') || 3200);
// --nohdr measures the FALLBACK: the path a device without renderable
// half-float targets takes, where the GRADE pass cannot run and the additive
// trim is the only thing holding the sum in gamut. It is a real shipping
// configuration, so it gets a real measurement rather than a promise.
const NOHDR = args.includes('--nohdr');

const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-lcd-text'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 600 } })).newPage();
const errs = [];
// Only real faults count: a missing audio blob or a reset catalog fetch is the
// harness's own offline environment, not a defect in the light. Matched against
// the HEAD of the message only — a shader error dumps its whole source, and a
// loose pattern anywhere in that dump will happily swallow the one message this
// instrument most needs to surface.
const NOISE = /^(Failed to load resource|.*net::ERR_)/;
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !NOISE.test(t.slice(0, 160))) errs.push('console: ' + t.slice(0, 900));
});
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 30000 });

/* The two states worth measuring. FLOW is the ordinary middle of a track — the
 * 80% of a set where washout is simply a bug. APEX is the drop: the one place
 * the light has earned the right to bleach. */
const STATES = {
  flow: { energy: 0.55, bass: 0.5, mid: 0.45, treble: 0.4, beat: 0.35, act: 1, ceil: 0.6, phase: 'flow' },
  apex: { energy: 1.0, bass: 0.95, mid: 0.9, treble: 0.85, beat: 1.0, act: 2, ceil: 1.0, phase: 'peak' },
};

/* Drive the engine from outside: stub the analyser so every frame sees the same
 * scripted audio, and pin the director so the act/ceiling/phase hold still.
 * Everything downstream — colour conductor, governor, shaders — runs as shipped. */
await page.evaluate((noHdr) => {
  if (noHdr){ LENS._init(); LENS._hdr = false; }     // pretend this device can't hold HDR
  window.__probe = { energy: 0.5, bass: 0.5, mid: 0.5, treble: 0.5, beat: 0.5, act: 1, ceil: 1, phase: 'flow' };
  const f = AE.f;
  window.analyse = function (dt, t){
    const p = window.__probe;
    f.bass = p.bass; f.mid = p.mid; f.treble = p.treble; f.energy = p.energy;
    f.calm = p.energy; f.beat = p.beat; f.onset = false;
    f.eShort = p.energy; f.eLong = 0.55;
    f.entropy = 0.45; f.centroid = 0.35;
    f.piAcc += dt * 0.31; f.eAcc += dt * 0.27;
    f.piPhase = f.piAcc % 1; f.ePhase = f.eAcc % 1;
    f.coupling = 0.5 + 0.5 * Math.sin(t * 0.4);
  };
  // freeze the story clock: probing must compare like with like across runs
  const upd = director.update.bind(director);
  director.update = function (dt){
    upd(dt);
    const p = window.__probe;
    this.act = p.act; this.ceil = p.ceil; this.phase = p.phase;
    this.actT = ACTS[p.act].heat; U.uAct.value = this.actT;
    this.dwell = 0; this.auto = false;               // no scene changes mid-measurement
  };
  director.setAuto(false);
  LENS.set('none', false);                          // measure the field, not the glass
  // clear the first-run curtain and every panel: the instrument looks at the
  // field, and an overlay in front of it would only measure the overlay
  for (const id of ['firstRun', 'help', 'coach', 'library', 'console', 'playlist', 'emptyState'])
    { const n = document.getElementById(id); if (n) n.style.display = 'none'; }
  document.body.classList.add('zen');

  /* Capture INSIDE the draw. The renderer runs without preserveDrawingBuffer,
   * so by the time an await resolves the buffer may already be gone and a
   * screenshot would read as pure black — a washout probe that silently
   * measures nothing is worse than no probe. LENS.render is the last thing
   * every frame does, on both the direct and the render-target path, so
   * copying there reads exactly the pixels that frame drew. */
  const lensRender = LENS.render.bind(LENS);
  window.__cap = null; window.__capWant = false;
  LENS.render = function (...a){
    lensRender(...a);
    if (!window.__capWant) return;
    window.__capWant = false;
    const cv = document.getElementById('glcanvas');
    const o = document.createElement('canvas'); o.width = 480; o.height = 300;
    const cx = o.getContext('2d');
    cx.drawImage(cv, 0, 0, 480, 300);
    window.__cap = cx.getImageData(0, 0, 480, 300).data;
    window.__capPng = o.toDataURL('image/png');
  };
  return true;
}, NOHDR);

/* Pixel verdict. sRGB in, so luma is approximate on purpose — the eye's
 * complaint is about apparent brightness, and the gamma error is identical
 * across every run being compared. */
async function measure(){
  await page.evaluate(() => { window.__cap = null; window.__capWant = true; });
  // generous: the raymarched scene under SwiftShader can take many seconds per
  // frame, and a slow frame is not the same finding as a dead render loop
  await page.waitForFunction('window.__cap !== null', null, { timeout: 60000 });
  return page.evaluate(() => {
    const w = 480, h = 300;
    const d = window.__cap;
    let blown = 0, hot = 0, lit = 0, chroma = 0, luma = 0;
    for (let i = 0; i < d.length; i += 4){
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      luma += L;
      // "reads as white", not "is exactly 255": the rolloff approaches 1 from
      // below and lands an earned whiteout in the mid-240s, which no eye can
      // tell from paper. A threshold at 0.98 would score a deliberate,
      // blown-out drop as if the light had never bleached at all.
      if (mn > 0.94) blown++;
      if (L > 0.75) hot++;
      if (L > 0.25){ lit++; chroma += mx > 1e-4 ? (mx - mn) / mx : 0; }
    }
    const n = w * h;
    return { blown: blown / n, hot: hot / n, litShare: lit / n,
      chroma: lit ? chroma / lit : 0, luma: luma / n };
  });
}

/* PARITY — the rolloff exists twice: once in JS (tested in tests/player.test.mjs,
 * and the definition of the curve) and once in GLSL (what actually draws every
 * pixel). The unit suite can only check that the two share their CONSTANTS; it
 * cannot run a shader. So the shipped GLSL is compiled here and evaluated on the
 * GPU against the JS across the whole working range, because a shoulder that
 * drifts between the two would be invisible until a field went chalk on a device
 * nobody in the room owns. */
const parity = await page.evaluate(() => {
  // pointed at a build from before the rolloff existed (an A/B against an older
  // docs/ is exactly what this tool is for), there is nothing to compare
  if (typeof GLSL_INK === 'undefined' || typeof inkRolloff !== 'function')
    return { skipped: 'this build has no ink rolloff' };
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return { skipped: 'no webgl' };
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }'));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER,
    'precision highp float; uniform float uWhite; uniform vec3 uIn;\n' + GLSL_INK +
    '\nvoid main(){ gl_FragColor = vec4(inkRolloff(uIn), 1.0); }'));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uW = gl.getUniformLocation(prog, 'uWhite'), uIn = gl.getUniformLocation(prog, 'uIn');
  const px = new Uint8Array(4);
  let worst = 0, worstAt = null, n = 0;
  const HUES = [[1, 0.72, 0.28], [0.3, 0.9, 1], [1, 0.2, 0.6], [0.4, 1, 0.5], [0.9, 0.9, 0.9], [1, 0.05, 0.05]];
  for (const w of [0, 0.2, 0.5, 0.8, 1]){
    for (const k of [0.2, 0.5, 0.68, 0.9, 1, 1.5, 2.5, 5, 12, 30]){
      for (const h of HUES){
        const c = h.map(v => v * k);
        gl.uniform1f(uW, w); gl.uniform3f(uIn, c[0], c[1], c[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const want = inkRolloff(c, w).map(v => Math.max(0, Math.min(1, v)));
        for (let i = 0; i < 3; i++){
          const d = Math.abs(px[i] / 255 - want[i]);
          if (d > worst){ worst = d; worstAt = { w, k, h, got: [...px].slice(0, 3), want }; }
        }
        n++;
      }
    }
  }
  return { n, worst, worstAt };
});
if (parity.skipped) console.log('PARITY skipped: ' + parity.skipped);
else {
  const tol = 2.5 / 255;                    // the 8-bit readback's own resolution
  console.log(`PARITY  ${parity.n} samples  worst |GLSL-JS| = ${(parity.worst * 255).toFixed(2)}/255` +
    (parity.worst <= tol ? '  OK' : '  FAIL'));
  if (parity.worst > tol){
    console.log(JSON.stringify(parity.worstAt));
    errs.push('ink rolloff: GLSL and JS disagree by ' + (parity.worst * 255).toFixed(2) + '/255');
  }
}

const sceneNames = await page.evaluate(() => scenes.map(s => s.name));
const want = ONLY ? ONLY.split(',').map(Number) : sceneNames.map((_, i) => i);
if (PNG_DIR) mkdirSync(PNG_DIR, { recursive: true });

const rows = [];
for (const i of want){
  const row = { i, name: sceneNames[i] };
  for (const [sk, sv] of Object.entries(STATES)){
    await page.evaluate(([idx, st]) => {
      Object.assign(window.__probe, st);
      director.setScene(idx, true);
      director.transT = 1; director.prev = -1;      // land the crossfade instantly
    }, [i, sv]);
    // Let the whole engine settle, not just the frame. The white budget eases
    // over about a second and the colour glide runs longer still, so a short
    // wait measures the ENGINE MID-TRANSITION and reports a drop as if it were
    // a build. Three seconds is the steady state these numbers claim to be.
    await page.waitForTimeout(SETTLE);
    row[sk] = await measure();
    if (PNG_DIR){
      const url = await page.evaluate(() => window.__capPng);   // the very frame measured
      writeFileSync(join(PNG_DIR, `${String(i).padStart(2, '0')}-${sk}.png`),
        Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    }
  }
  rows.push(row);
  const p = v => (v * 100).toFixed(1).padStart(5) + '%';
  console.log(`${String(i).padStart(2)} ${row.name.padEnd(22)}` +
    ` flow blown${p(row.flow.blown)} hot${p(row.flow.hot)} chroma${p(row.flow.chroma)}` +
    ` | apex blown${p(row.apex.blown)} hot${p(row.apex.hot)} chroma${p(row.apex.chroma)}`);
}

const mean = (k, s) => rows.reduce((a, r) => a + r[s][k], 0) / rows.length;
const summary = {
  scenes: rows.length, hdr: !NOHDR,
  flow: { blown: mean('blown', 'flow'), hot: mean('hot', 'flow'), chroma: mean('chroma', 'flow'), luma: mean('luma', 'flow') },
  apex: { blown: mean('blown', 'apex'), hot: mean('hot', 'apex'), chroma: mean('chroma', 'apex'), luma: mean('luma', 'apex') },
  errors: errs,
};
console.log('\nMEAN  flow  blown %s  hot %s  chroma %s',
  (summary.flow.blown * 100).toFixed(2), (summary.flow.hot * 100).toFixed(2), (summary.flow.chroma * 100).toFixed(2));
console.log('MEAN  apex  blown %s  hot %s  chroma %s',
  (summary.apex.blown * 100).toFixed(2), (summary.apex.hot * 100).toFixed(2), (summary.apex.chroma * 100).toFixed(2));
if (errs.length) console.log('\nPAGE ERRORS:\n' + errs.slice(0, 10).join('\n'));

if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ summary, rows }, null, 1));
await browser.close(); server.close();
process.exit(errs.length ? 1 : 0);
