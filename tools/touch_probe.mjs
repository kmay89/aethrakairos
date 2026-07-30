/* TOUCH PROBE — is the hand IN the world, or on top of it?
 *
 * The defect this exists to catch cannot be unit-tested, because it was never a
 * maths error. The touch used to be answered by a 2D canvas at z-index 4 that
 * stroked photon rings, spiral arms, orbiting motes and a charge arc over the
 * field, plus a DOM div that darkened it with mix-blend-mode: multiply. Every
 * number in that code was correct. It still read as a heads-up display, because
 * a screen-space stroke at a fixed pixel width sits in FRONT of the world: it
 * ignores depth, ignores the camera, ignores which scene is up, and it needed a
 * dark veil painted underneath so its glow would read — dimming the actual
 * visuals so the decoration could be seen.
 *
 * So this measures the two things that distinguish a distortion of the world
 * from a decoration over it:
 *
 *   OVERLAY   that the overlay layers do not exist. Not "are hidden" — do not
 *             exist. A hidden div is one CSS change away from coming back, and
 *             this is the regression gate on that.
 *   BEND      that the IMAGE changes when a hand is present, everywhere the
 *             metric claims to reach and nowhere it claims not to, with the
 *             shape each personality promises: the void's core going dark, the
 *             vortex shearing tangentially, the accretion drawing in.
 *
 * It also checks the thing that keeps the light and the matter honest: the
 * shipped GLSL metric is evaluated ON THE GPU against warpDeflect() in JS, the
 * same way the colour probe checks the ink rolloff. One fabric or none.
 *
 * And it checks the accessibility floor, which is a real requirement and not a
 * nicety: a full-screen distortion is a vestibular event, so reduced motion must
 * shrink the deformation — and must NOT close it, because a hand that touches
 * the world and feels nothing is its own defect.
 *
 *   node tools/touch_probe.mjs docs [--png dir] [--scene N]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);
const DIR = args[0] || 'docs';
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const PNG_DIR = flag('--png');
const ONE_SCENE = flag('--scene');

const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav',
  '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-lcd-text'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 600 } })).newPage();

let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
};
const errs = [];
// only real faults count: the harness is offline, so a missing audio blob or a
// reset catalog fetch is the environment. Matched on the HEAD of the message —
// a shader error dumps its whole source, and that source can contain anything.
const NOISE = /404|Failed to fetch|net::ERR|NotAllowedError|The play\(\) request/;
page.on('pageerror', e => { const m = String(e).split('\n')[0]; if (!NOISE.test(m.slice(0, 60))) errs.push(m); });
page.on('console', m => {
  const t = m.text();
  if (/(THREE\.WebGLProgram|shader|compil)/i.test(t) && !NOISE.test(t.slice(0, 60))) errs.push(t.slice(0, 500));
});
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 40000 });

const W = 240, H = 150;      // the difference field's resolution — coarse on purpose
await page.evaluate(([w, h]) => {
  for (const id of ['firstRun', 'help', 'coach', 'onboard', 'library', 'console', 'playlist', 'emptyState', 'splash'])
    { const n = document.getElementById(id); if (n) n.style.display = 'none'; }
  document.body.classList.add('zen');
  // the director must not walk the scene or move the camera between the two
  // captures being compared: the difference would then be the camera's, and
  // this probe would happily report a bend that was really a pan
  /* SCRIPT THE ROOM, or measure the weather.

     How much |Δluma| a given deformation produces depends on how bright the
     scene is, and the scene's brightness rides on the live audio analysis and on
     where the director's story clock has got to. Left alone, this probe measured
     a different room each run: the same checks came back 26/0, then 24/2, then
     25/1, with nothing in the app having changed. A gate that is sometimes red
     guards nothing, so the audio state and the story clock are pinned here —
     exactly as tools/color_probe.mjs pins them, and for the same reason.

     Everything downstream of these two — the colour conductor, the governor, the
     metric, every shader — runs exactly as shipped. */
  const f = AE.f;
  window.analyse = function (dt, t){
    f.bass = 0.55; f.mid = 0.5; f.treble = 0.45; f.energy = 0.6;
    f.calm = 0.6; f.beat = 0.4; f.onset = false;
    f.eShort = 0.6; f.eLong = 0.55;
    f.entropy = 0.45; f.centroid = 0.35;
    f.piAcc += dt * 0.31; f.eAcc += dt * 0.27;
    f.piPhase = f.piAcc % 1; f.ePhase = f.eAcc % 1;
    f.coupling = 0.5 + 0.5 * Math.sin(t * 0.4);
  };
  if (typeof director !== 'undefined'){
    const upd = director.update.bind(director);
    director.update = function (dt){
      upd(dt);
      this.act = 1; this.ceil = 1; this.phase = 'flow';
      this.actT = ACTS[1].heat; U.uAct.value = this.actT;
      this.dwell = 0; this.auto = false;            // no scene changes mid-measurement
    };
    director.setAuto(false);
    director.hold = 1e9;
  }
  // measure the FABRIC, not the glass: an artistic lens folds the distortion into
  // its own symmetry, which is lovely to look at and impossible to score
  if (typeof LENS !== 'undefined' && LENS.set) LENS.set('none', false);
  /* PIN THE GOVERNOR. This probe renders three times inside one animation tick,
     which under SwiftShader looks exactly like a device that cannot cope — and
     the adaptive governor, correctly, responds by flagging PERF.struggling, at
     which point the light-bending pass switches itself off to protect the frame
     rate. Left alone that produced a run whose early checks passed and whose
     later ones read 0.0% with every annulus exactly zero: the instrument had
     measured its own cost and then measured the app's honest reaction to it.
     So the governor is held still here, and the skip-when-strained path gets its
     own explicit check further down instead of being triggered by accident. */
  if (typeof PERF !== 'undefined'){
    PERF.tick = () => {};
    PERF.struggling = false;
    PERF._warned = true;                    // and no toast about a strained device
  }
  /* THE PAIRED CAPTURE, and why anything else measures the wrong thing.

     The first version of this probe took one frame with no hand, waited, set the
     hand, and took another. On a point cloud that was nearly honest. On a
     raymarched scene it was worthless: PARLOR animates every frame, so 92% of the
     image differed between the two captures and the probe cheerfully reported a
     bend that was almost entirely the scene moving on its own. The annuli came
     back flat — the signature of a measurement with no signal in it.

     So both frames are rendered inside ONE animation tick, from the same scene
     state, the same camera, the same clock, with the hand's uniforms toggled
     between them. LENS.render is where every frame ends on both the direct and
     the render-target path, and by the time it runs the geometry for this tick is
     already placed — so calling it twice with different pointer uniforms produces
     two images whose ONLY difference is the hand. Whatever changes, the metric
     changed. Nothing else can have.

     The probe restores the real uniforms and renders once more before returning,
     so it never leaves its own state on the glass. */
  const lensRender = LENS.render.bind(LENS);
  const grab = () => {
    const cv = document.getElementById('glcanvas');
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const cx = o.getContext('2d');
    cx.drawImage(cv, 0, 0, w, h);
    return { px: cx.getImageData(0, 0, w, h).data, png: o.toDataURL('image/png') };
  };
  window.__pairWant = null; window.__pair = null;
  LENS.render = function (...a){
    const o = window.__pairWant;
    if (!o){ lensRender(...a); return; }
    window.__pairWant = null;
    const I = INTERACT;
    const keep = { s: I.strength, b: I.burst, c: I.charge, sp: I.spinE, sw: I.swirl,
      wx: I.wx, wy: I.wy, px: I.px, py: I.py, rp: I.ripplePhase };
    /* Frame A and frame B are both arbitrary hand states, not off-then-on. The
       graze-versus-hold comparison used two separate pair() calls and therefore
       two separate ticks, and on a fast-animating scene it duly reported the
       horizon getting BRIGHTER under a full hold — the scene had moved between
       the captures. Any two states this probe wants to compare are now compared
       inside one tick, which is the only way the difference means anything. */
    const put = live => {
      const st = (live ? o.b : o.a) || (live ? o : { off: true });
      if (st.off){
        I.strength = 0; I.charge = 0; I.burst = 0; I.spinE = 0; I.dragging = false;
      } else {
        I.strength = st.presence == null ? 1 : st.presence;
        I.charge = st.charge == null ? 0.85 : st.charge;
        I.burst = st.burst || 0;
        I.spinE = st.spin == null ? 0.7 : st.spin;
        I.dragging = !!st.drag;
      }
      I.swirl = o.swirl == null ? 1 : o.swirl;
      I.px = I.wx = o.x || 0; I.py = I.wy = o.y || 0;
      I.ripplePhase = 0;                 // one phase, so WAVE is comparable run to run
      // the uniforms the metric actually reads — written through the same
      // expressions the frame loop uses, so this exercises shipping code
      U.uPtr.value.set(I.wx, I.wy, I.strength);
      U.uPtrX.value.set(I.charge, I.burst, I.spinE);
      U.uPtrF.value.set(TOUCHFX.mode(),
        warpBudget({ reduced: reducedMotion, calm: typeof SAFE !== 'undefined' && SAFE.calm }),
        AE.f.beat, I.ripplePhase);
    };
    put(false); lensRender(...a); const A = grab();
    put(true);  lensRender(...a); const B = grab();
    I.strength = keep.s; I.burst = keep.b; I.charge = keep.c; I.spinE = keep.sp;
    I.swirl = keep.sw; I.wx = keep.wx; I.wy = keep.wy; I.px = keep.px; I.py = keep.py;
    I.ripplePhase = keep.rp; I.dragging = false;
    U.uPtr.value.set(I.wx, I.wy, I.strength);
    U.uPtrX.value.set(I.charge, I.burst, I.spinE);
    lensRender(...a);
    window.__pair = { a: Array.from(A.px), b: Array.from(B.px), pngA: A.png, pngB: B.png };
  };
  return true;
}, [W, H]);

/* One request, two frames, one tick. The hand's state is set inside the render
 * hook rather than out here, because a value written from Node and read a frame
 * later is a value the spring and the frame loop have already had a chance to
 * move. */
async function pair(opts){
  await page.evaluate(o => { window.__pair = null; window.__pairWant = o; }, opts || {});
  // generous: a raymarched scene under SwiftShader can take many seconds per
  // frame, and this asks for three renders in one of them
  await page.waitForFunction('window.__pair !== null', null, { timeout: 90000 });
  return page.evaluate(() => window.__pair);
}

/* THE DIFFERENCE FIELD. Two frames of the same scene, one with a hand on it, and
 * the answer to "did the world change, where, and by how much". Reported in
 * annuli around the touch point, because WHERE the change lives is the whole
 * argument: a decoration changes a disc of fixed pixel radius; a metric with a
 * 1/r falloff changes the near field hard and the far field faintly, and that
 * long tail is most of why it reads as space rather than as a brush. */
function diffField(a, b, cx, cy){
  const N = 6, sum = new Float64Array(N), cnt = new Float64Array(N);
  let moved = 0, tot = 0, darker = 0, lighter = 0;
  const maxR = Math.hypot(1, 1);
  for (let y = 0; y < H; y++){
    for (let x = 0; x < W; x++){
      const i = (y * W + x) * 4;
      const la = (a[i] * 0.2126 + a[i + 1] * 0.7152 + a[i + 2] * 0.0722) / 255;
      const lb = (b[i] * 0.2126 + b[i + 1] * 0.7152 + b[i + 2] * 0.0722) / 255;
      const d = Math.abs(la - lb);
      // NDC-ish coordinates around the touch, aspect-corrected so the annuli are
      // round in the same space the shader works in
      const nx = ((x + 0.5) / W * 2 - 1) * (W / H), ny = 1 - (y + 0.5) / H * 2;
      const r = Math.hypot(nx - cx * (W / H), ny - cy) / maxR;
      const k = Math.min(N - 1, Math.floor(r * N));
      sum[k] += d; cnt[k]++;
      tot++;
      if (d > 0.02) moved++;
      if (lb < la - 0.02) darker++;
      if (lb > la + 0.02) lighter++;
    }
  }
  const rings = [];
  for (let k = 0; k < N; k++) rings.push(cnt[k] ? sum[k] / cnt[k] : 0);
  return { rings, moved: moved / tot, darker: darker / tot, lighter: lighter / tot };
}
// mean luma inside a small disc around the touch — the void's core lives here
function coreLuma(px, cx, cy, rad){
  let s = 0, n = 0;
  for (let y = 0; y < H; y++){
    for (let x = 0; x < W; x++){
      const nx = ((x + 0.5) / W * 2 - 1) * (W / H), ny = 1 - (y + 0.5) / H * 2;
      if (Math.hypot(nx - cx * (W / H), ny - cy) > rad) continue;
      const i = (y * W + x) * 4;
      s += (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255; n++;
    }
  }
  return n ? s / n : 0;
}

const pct = v => (v * 100).toFixed(1) + '%';
const shots = [];
if (PNG_DIR) mkdirSync(PNG_DIR, { recursive: true });
const keep = (name, png) => { if (PNG_DIR) shots.push([name, png]); };

// ---------------------------------------------------------------- 1 · OVERLAY
console.log('\nthe overlay is gone — not hidden, gone');
const dom = await page.evaluate(() => {
  const ids = ['touchCanvas', 'voidFx', 'voidRing'];
  const present = ids.filter(id => !!document.getElementById(id));
  // any element other than the GL canvas painting over the field would do the
  // same damage under a different name, so ask the layout, not the id list
  const over = [];
  for (const n of document.querySelectorAll('body *')){
    const st = getComputedStyle(n);
    if (st.position !== 'fixed' || st.display === 'none' || st.visibility === 'hidden') continue;
    if (parseFloat(st.opacity) < 0.02) continue;
    const r = n.getBoundingClientRect();
    const full = r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9;
    if (!full) continue;
    if (n.id === 'glcanvas' || n.id === 'bgcanvas') continue;
    if (st.pointerEvents === 'none' && (st.backgroundColor === 'rgba(0, 0, 0, 0)' || !st.backgroundColor)
        && n.tagName !== 'CANVAS') continue;                 // an inert, empty layer paints nothing
    over.push(n.id || n.tagName.toLowerCase() + '.' + (n.className || '').toString().slice(0, 24));
  }
  return { present, over, touchfxHasRender: typeof TOUCHFX.render === 'function' };
});
R('no #touchCanvas, #voidFx or #voidRing in the document',
  dom.present.length === 0, dom.present.length ? 'still present: ' + dom.present.join(', ') : 'all three deleted');
R('TOUCHFX no longer draws anything', !dom.touchfxHasRender,
  dom.touchfxHasRender ? 'TOUCHFX.render still exists' : 'no render method — the bank is a bank');
R('nothing full-screen paints over the field',
  dom.over.length === 0, dom.over.length ? 'over the field: ' + dom.over.join(', ') : 'the GL canvas is the top layer');

// ---------------------------------------------------------------- 2 · PARITY
console.log('\none fabric: the GPU metric against the JS metric');
const parity = await page.evaluate(() => {
  // compile the SHIPPED GLSL_WARP and read warpDeflect() back out of it, the
  // same trick the colour probe uses on the ink rolloff. If these two ever
  // drift, the light and the matter are being bent by different physics.
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const gl = cv.getContext('webgl');
  if (!gl) return { skipped: 'no webgl' };
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }');
  gl.compileShader(vs);
  /* The GPU reports the DIFFERENCE against the JS answer, not the answer.
   * Packing the value itself would make the readback's precision depend on the
   * metric's magnitude — and the first version of this check duly "failed" at
   * r=0 because a deflection of 1.6 saturated the encoding, which says nothing
   * about parity. Differencing on the GPU makes one 8-bit step ~4e-5 of drift
   * everywhere in the domain, which is the resolution this claim needs. */
  const fsSrc = 'precision highp float;\n' + GLSL_WARP + `
    uniform float uMode, uR;
    uniform vec2 uExpect;      // what the JS metric says, at full float precision
    void main(){
      vec2 d = warpDeflect(uMode, uR);
      gl_FragColor = vec4((d.x - uExpect.x) * 100.0 + 0.5,
                          (d.y - uExpect.y) * 100.0 + 0.5, 0.0, 1.0);
    }`;
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return { err: gl.getShaderInfoLog(fs) };
  const pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { err: gl.getProgramInfoLog(pr) };
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uni = n => gl.getUniformLocation(pr, n);
  const px = new Uint8Array(4);
  let worstRad = 0, worstAng = 0, n = 0, worstAt = null;
  for (const mode of [-1, 0, 1, 2, 3]){
    for (const charge of [0, 0.5, 1]){
      for (const spin of [0, 0.8]){
        for (let i = 0; i <= 24; i++){
          const r = i / 24 * 1.2;
          gl.uniform3f(uni('uPtr'), 0, 0, 1);
          gl.uniform3f(uni('uPtrX'), charge, 0, spin);
          gl.uniform4f(uni('uPtrF'), mode, 1, 0.4, 0.9);
          gl.uniform1f(uni('uMode'), mode);
          gl.uniform1f(uni('uR'), r);
          const js = warpDeflect(mode, r, { charge, spin, beat: 0.4, phase: 0.9 });
          gl.uniform2f(uni('uExpect'), js.rad, js.ang);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const dR = Math.abs((px[0] / 255 - 0.5) / 100), dA = Math.abs((px[1] / 255 - 0.5) / 100);
          if (dR > worstRad){ worstRad = dR; worstAt = { mode, charge, spin, r: +r.toFixed(3) }; }
          if (dA > worstAng) worstAng = dA;
          n++;
        }
      }
    }
  }
  return { worstRad, worstAng, n, worstAt };
});
if (parity.err || parity.skipped){
  R('the shipped GLSL metric matches the JS metric', false, parity.err || parity.skipped);
} else {
  // one 8-bit step of the differenced readback is 1/255/100 ≈ 4e-5, so the
  // tolerance below is the INSTRUMENT's floor and not a licence to drift
  R('the shipped GLSL metric matches the JS metric',
    parity.worstRad < 3e-4 && parity.worstAng < 3e-4,
    parity.n + ' samples · worst radial ' + parity.worstRad.toFixed(5)
      + ' · worst angular ' + parity.worstAng.toFixed(5)
      + (parity.worstAt ? ' @ ' + JSON.stringify(parity.worstAt) : ''));
}

// ---------------------------------------------------------------- 3 · THE BEND
/* Two scenes, deliberately: a POINT-CLOUD scene, where the matter itself is
 * displaced, and a RAYMARCHED scene, which has no particles at all. The second
 * is the one that could not answer a touch before this — it got a camera nudge
 * and nothing else — so it is the clearest evidence that the response now lives
 * in the world rather than in a layer above it. */
/* Chosen by COMPOSITION, not by name. Asking for /TUNNEL|PARLOR|OP-ART/ picked
 * MÖBIUS SPIRAL on the first run — a point cloud — because the alternation also
 * matched MÖBIUS, and the "raymarched scene answers too" check quietly measured
 * the point-cloud path twice. Counting Points objects in the scene graph cannot
 * be fooled by a rename, and it is the property the claim is actually about. */
const sceneKinds = await page.evaluate(() => scenes.map((s, i) => {
  let pts = 0, mesh = 0;
  s.group.traverse(o => { if (o.isPoints) pts++; else if (o.isMesh) mesh++; });
  return { i, name: s.name, pts, mesh };
}));
const POINTS = ONE_SCENE != null ? +ONE_SCENE
  : (sceneKinds.find(s => s.pts > 0) || { i: 0 }).i;
// a mesh-only scene is a full-screen fragment shader: no particles to displace,
// so anything that changes there changed because the LIGHT was bent
const rayScenes = sceneKinds.filter(s => s.pts === 0 && s.mesh > 0);
const RAY = rayScenes.length ? rayScenes[rayScenes.length - 1].i : -1;

const HX = 0.22, HY = 0.10;          // where the hand goes: off-centre on purpose
async function bendOn(sceneIdx, label, personality, opts){
  await page.evaluate(([i, k]) => {
    director.setScene(i, false);
    TOUCHFX.set(k, false);
  }, [sceneIdx, personality]);
  /* Wait for the scene to ARRIVE, not for a fixed interval. Scenes fade in, and a
   * measurement taken 900 ms after a switch caught MÖBIUS SPIRAL at a fraction of
   * its brightness: 1.7% of the frame moved and the void looked like it had
   * stopped working, when what had not arrived yet was the scene. So the probe
   * waits until the frame has light in it, then measures. */
  let pr = null;
  for (let tries = 0; tries < 6; tries++){
    await page.waitForTimeout(400);
    pr = await pair({ x: HX, y: HY, b: Object.assign({ drag: true }, opts || {}) });
    let lit = 0;
    for (let i = 0; i < pr.a.length; i += 4)
      if (pr.a[i] * 0.2126 + pr.a[i + 1] * 0.7152 + pr.a[i + 2] * 0.0722 > 20) lit++;
    if (lit / (pr.a.length / 4) > 0.02) break;    // 2% of the frame lit is enough to bend
  }
  keep(label + '-off', pr.pngA); keep(label + '-on', pr.pngB);
  return { off: { px: pr.a }, on: { px: pr.b }, f: diffField(pr.a, pr.b, HX, HY) };
}

console.log('\nthe world bends — a point-cloud scene (' + (sceneKinds[POINTS] || {}).name + ')');
const vd = await bendOn(POINTS, 'points-void', 'blackhole');
R('a hand changes the image at all',
  vd.f.moved > 0.05, pct(vd.f.moved) + ' of the frame moved');
/* NEAR HARD, FAR FAINT — the shape of a 1/r field, and the thing that separates
 * it from a brush. The near field is the PEAK of the first two annuli, not the
 * first: under the void the innermost ring is largely inside the capture radius,
 * where both frames are black and the difference is therefore small. Reading
 * ring 0 alone scored a correctly-working black hole as a failure whenever the
 * horizon happened to cover enough of it (measured: 0.021 in ring 0 against
 * 0.062 in ring 1). */
const near = Math.max(vd.f.rings[0], vd.f.rings[1]);
R('the near field is bent far harder than the far field',
  near > vd.f.rings[5] * 2.5,
  'near ' + near.toFixed(4) + ' vs far ' + vd.f.rings[5].toFixed(4)
    + ' · by annulus: ' + vd.f.rings.map(v => v.toFixed(4)).join(' '));
R('the far corners are still — the room does not swim',
  vd.f.rings[5] < 0.035, 'outermost annulus ' + vd.f.rings[5].toFixed(4));
const coreOff = coreLuma(vd.off.px, HX, HY, 0.06);
const coreOn = coreLuma(vd.on.px, HX, HY, 0.06);
R('the void takes a real bite out of the light',
  coreOn < coreOff * 0.55 + 0.01,
  'core luma ' + coreOff.toFixed(4) + ' -> ' + coreOn.toFixed(4)
    + (coreOff > 1e-4 ? ' (' + pct(1 - coreOn / coreOff) + ' darker)' : ''));

if (RAY >= 0){
  console.log('\nthe world bends — a RAYMARCHED scene (' + sceneKinds[RAY].name + '), which has no particles to push');
  const rr = await bendOn(RAY, 'ray-void', 'blackhole');
  R('a scene with no point cloud still answers the hand',
    rr.f.moved > 0.05, pct(rr.f.moved) + ' of the frame moved');
    const rNear = Math.max(rr.f.rings[0], rr.f.rings[1]);
  R('and it answers in the near field, not uniformly',
    rNear > rr.f.rings[5] * 2.0,
    'near ' + rNear.toFixed(4) + ' vs far ' + rr.f.rings[5].toFixed(4)
      + ' · by annulus: ' + rr.f.rings.map(v => v.toFixed(4)).join(' '));
} else {
  console.log('\n  (no raymarched scene matched by name — skipped)');
}

// ---------------------------------------------------- 4 · EVERY PERSONALITY
/* Each force must actually be a DIFFERENT deformation. Four effects that all
 * bend the frame by the same amount in the same place would be four names for
 * one thing — which is exactly what a costume is. */
console.log('\nfour forces, four different deformations');
const marks = {}, coreMarks = {};
for (const k of ['blackhole', 'grows', 'gathers', 'flows']){
  const b = await bendOn(POINTS, 'points-' + k, k);
  marks[k] = b.f;
  coreMarks[k] = { offCore: coreLuma(b.off.px, HX, HY, 0.05), onCore: coreLuma(b.on.px, HX, HY, 0.05) };
  R(k + ': bends the world', b.f.moved > 0.04,
    pct(b.f.moved) + ' moved · rings ' + b.f.rings.slice(0, 4).map(v => v.toFixed(3)).join(' '));
}
/* THE VOID IS THE ONLY ONE THAT CAPTURES. The first version of this asked which
 * force darkened the most PIXELS, and the vortex won — because rotating an image
 * moves bright things off where they were, and "this pixel got darker" is what
 * any displacement looks like. The claim is about the CORE, so measure the core:
 * inside the horizon the void must take the light away, and the three forces that
 * only move space around must not. */
const cores = {};
for (const k of ['blackhole', 'grows', 'gathers', 'flows']){
  const b = coreMarks[k];
  cores[k] = b.onCore / Math.max(1e-4, b.offCore);
}
R('only the void captures light — the core goes dark under it and not under the others',
  cores.blackhole < 0.6 && cores.blackhole < Math.min(cores.grows, cores.gathers, cores.flows) * 0.8,
  'core luma, after / before — void ×' + cores.blackhole.toFixed(2)
    + ' · spin ×' + cores.grows.toFixed(2) + ' · pull ×' + cores.gathers.toFixed(2)
    + ' · wave ×' + cores.flows.toFixed(2));
// and no two forces may produce the same picture
const sig = k => marks[k].rings.map(v => v.toFixed(3)).join(',');
const uniq = new Set(['blackhole', 'grows', 'gathers', 'flows'].map(sig));
R('no two forces produce the same deformation', uniq.size === 4, uniq.size + '/4 distinct radial signatures');

// ------------------------------------------------- 5 · COMMITMENT & RELEASE
console.log('\nthe hold is legible in the light, and the release travels');
/* The commitment and release checks run on a FULL-FRAME scene, because they are
 * claims about radius. The wavefront at burst 0.45 sits at 0.85 screen radii, and
 * on a scene whose content is a compact bright core there is simply nothing out
 * there to bend — the first run measured 0.003 and called the wavefront missing
 * when what was missing was the scene. */
const WIDE = (sceneKinds.find(s => s.pts === 0 && s.mesh > 0 && /OP.?ART|RADAR/i.test(s.name))
  || sceneKinds[RAY >= 0 ? RAY : POINTS]).i;
await page.evaluate(([i, k]) => { director.setScene(i, false); TOUCHFX.set(k, false); }, [WIDE, 'blackhole']);
await page.waitForTimeout(900);
/* WHAT A HOLD PROMISES, measured directly and in ONE tick.
 *
 * This went through three versions, and the first two both asked the question
 * sideways. Comparing |Δluma| in the innermost annulus FELL under a full hold —
 * for a real reason: the widened horizon makes more of that annulus black in BOTH
 * frames. Comparing "how much of the frame each state changes" then measured
 * 29.1% against 32.0% under a ×1.15 bar, because on a full-frame scene even a
 * graze already moves a third of the picture and the hold's extra reach arrives
 * as a faint outer fringe that never crosses the per-pixel threshold.
 *
 * The mechanic's claim is simply that committing DEEPENS the deformation, around
 * the hand. So render the graze and the hold in the same tick and difference them
 * against each other: whatever separates those two frames IS the hold, with no
 * scene motion, no second baseline, and no threshold arithmetic about how much a
 * graze already covered. */
const chP = await pair({ x: HX, y: HY, a: { drag: true, charge: 0.02 }, b: { drag: true, charge: 1 } });
keep('graze', chP.pngA); keep('held', chP.pngB);
const ch = diffField(chP.a, chP.b, HX, HY);
const chNear = Math.max(ch.rings[0], ch.rings[1]);
R('a committed hold visibly deepens the deformation',
  ch.moved > 0.03,
  pct(ch.moved) + ' of the frame differs between a graze and a full hold');
R('and it deepens it around the hand, not uniformly',
  chNear > ch.rings[5] * 2,
  'near ' + chNear.toFixed(4) + ' vs far ' + ch.rings[5].toFixed(4)
    + ' · by annulus: ' + ch.rings.map(v => v.toFixed(4)).join(' '));
const gzCore = coreLuma(chP.a, HX, HY, 0.07), hdCore = coreLuma(chP.b, HX, HY, 0.07);
R('and the horizon widens — the core is darker under a full hold',
  hdCore < gzCore * 0.9,
  'core luma, graze ' + gzCore.toFixed(4) + ' -> held ' + hdCore.toFixed(4));

/* THE RELEASE, ISOLATED. Its wavefront sits at (1-burst)·front screen radii, so a
 * fresh burst is still near the hand and a decayed one is far out; asking whether
 * the peak MOVED is the direct test of "it travels".
 *
 * presence: 0 is the key, and it is also the honest state: after you lift, the
 * hand's presence decays while the burst rides its own decay, so there is a real
 * moment where the only thing bending the fabric is the departing wavefront. With
 * presence held at 1 the static deflection swamped it and the first attempt
 * measured 0.002 either way. */
const nearBurst = await pair({ x: HX, y: HY, b: { charge: 0, burst: 0.88, presence: 0 } });
const farBurst = await pair({ x: HX, y: HY, b: { charge: 0, burst: 0.42, presence: 0 } });
keep('burst-near', nearBurst.pngB); keep('burst-far', farBurst.pngB);
const nb = diffField(nearBurst.a, nearBurst.b, HX, HY);
const fb = diffField(farBurst.a, farBurst.b, HX, HY);
const peak = r => r.rings.indexOf(Math.max.apply(null, r.rings));
R('the release travels — a fresh wavefront is near the hand, a decayed one is out in the field',
  peak(fb) > peak(nb),
  'peak annulus — burst 0.88 at ' + peak(nb) + ', burst 0.42 at ' + peak(fb)
    + ' · rings ' + nb.rings.map(v => v.toFixed(3)).join(' ')
    + ' | ' + fb.rings.map(v => v.toFixed(3)).join(' '));

// ------------------------------------------------------ 6 · THE FLOOR
/* Reduced motion is not a reason to make the hand dead. The budget shrinks the
 * deformation; it must never close it. Both halves are asserted, because the
 * failure modes are opposite and both are real. */
console.log('\nreduced motion shrinks the deformation and never closes it');
const budget = await page.evaluate(() => ({
  normal: warpBudget({}),
  calm: warpBudget({ calm: true }),
  reduced: warpBudget({ reduced: true }),
  both: warpBudget({ reduced: true, calm: true }),
}));
R('the budget shrinks for reduced motion and calm, and stays open',
  budget.reduced > 0.05 && budget.reduced < budget.calm && budget.calm < budget.normal
    && budget.both === budget.reduced,
  JSON.stringify(budget));
const rmBend = await page.evaluate(() => {
  // read the uniform the live pass is actually bound to, not a recomputation of
  // it: the claim is that the shipping frame loop routes through warpBudget
  const f = LENS._mats.field.uniforms.uPtrF.value;
  return { budgetNow: f.y, mode: f.x };
});
R('the live pass reads its budget from warpBudget, not from a constant',
  rmBend.budgetNow === budget.normal || rmBend.budgetNow === budget.calm || rmBend.budgetNow === budget.reduced,
  'uPtrF.y = ' + rmBend.budgetNow);

// -------------------------------------------------------- 7 · COST
/* The pass exists only while a hand is on the fabric. A flat metric resampling
 * the whole frame to prove it changed nothing is not free on a phone. */
console.log('\nthe pass costs nothing when nobody is touching');
const cost = await page.evaluate(() => {
  const I = INTERACT;
  I.strength = 0; I.burst = 0;
  const idle = LENS.handLive();
  I.strength = 1;
  const live = LENS.handLive();
  I.strength = 0; I.burst = 0.5;
  const lingering = LENS.handLive();
  I.burst = 0;
  return { idle, live, lingering };
});
R('no hand, no pass', cost.idle === false && cost.live === true,
  'idle ' + cost.idle + ' · touching ' + cost.live);
R('a still-travelling release keeps the pass alive after the finger has gone',
  cost.lingering === true, 'burst 0.5 -> ' + cost.lingering);
/* THE WEAK-DEVICE PATH, on purpose rather than by accident. A device the governor
 * has found to be struggling must not pay for a four-tap resample — but it used to
 * get NOTHING, which meant the phones most likely to be holding this app had a
 * touch that moved particles and left the light alone, and every raymarched scene
 * answered a hand with silence. It now gets the LEAN pass: one tap through the
 * same metric, same capture radius, same ceilings, without the second image or the
 * channel split. Asserted here because the probe pins the governor off, and a path
 * nothing exercises is a path that rots. */
const strained = await page.evaluate(() => {
  const was = PERF.struggling;
  INTERACT.strength = 1;
  const allowed = typeof POWER === 'undefined' || POWER.lensOK;
  const pick = () => {
    if (!(allowed && LENS._ready && LENS.handLive())) return 'none';
    return PERF.struggling ? 'lean' : 'full';
  };
  PERF.struggling = false; const healthy = pick();
  PERF.struggling = true;  const weak = pick();
  PERF.struggling = was; INTERACT.strength = 0;
  return { healthy, weak, hasLean: !!(LENS._mats && LENS._mats.fieldLean) };
});
R('a struggling device still bends the light, on the lean pass',
  strained.healthy === 'full' && strained.weak === 'lean' && strained.hasLean,
  'healthy → ' + strained.healthy + ' · struggling → ' + strained.weak);

/* AND THE LEAN PASS MUST ACTUALLY BEND. A cheaper pass that quietly did nothing
 * would be the same defect wearing a different name, so it is measured the same
 * way the full one is: two frames, one tick, hand toggled between them. */
await page.evaluate(i => director.setScene(i, false), POINTS);
await page.waitForTimeout(900);
await page.evaluate(() => { PERF.struggling = true; });
const leanBend = await pair({ x: HX, y: HY, b: { drag: true } });
await page.evaluate(() => { PERF.struggling = false; });
const lb = diffField(leanBend.a, leanBend.b, HX, HY);
const lbNear = Math.max(lb.rings[0], lb.rings[1]);
R('the lean pass bends the world too, and in the near field',
  lb.moved > 0.03 && lbNear > lb.rings[5] * 2,
  pct(lb.moved) + ' moved · near ' + lbNear.toFixed(4) + ' vs far ' + lb.rings[5].toFixed(4));

if (PNG_DIR){
  for (const [name, png] of shots)
    writeFileSync(join(PNG_DIR, name + '.png'), Buffer.from(png.split(',')[1], 'base64'));
  console.log('\n  ' + shots.length + ' frames -> ' + PNG_DIR);
}
if (errs.length){
  console.log('\n  page/shader errors:');
  for (const e of errs.slice(0, 8)) console.log('   ' + e.split('\n')[0].slice(0, 220));
}
R('no shader or page errors across the run', errs.length === 0, errs.length + ' errors');

const gov = await page.evaluate(() => ({ struggling: PERF.struggling, pr: PERF.pr }));
console.log('\n  measured with the adaptive governor pinned (struggling=' + gov.struggling
  + ', pixel ratio ' + gov.pr + ') — see the note at the top of the init block');
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
