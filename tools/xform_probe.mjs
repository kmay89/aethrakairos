/* tools/xform_probe.mjs — the transition, in a real browser.
 *
 * segueFx decides WHICH form a cut takes and is unit-tested. This checks the
 * half that unit tests cannot see: that the frozen copy of the outgoing room is
 * actually captured, that the shader compiles and runs, that the frame during a
 * cut is drawn from both rooms at once, that the old room is let go of
 * rather than drawn twice — and, the part that matters most, that the whole
 * thing STANDS DOWN where it is supposed to.
 *
 * The stand-downs are the reason this file exists. A transition engine that
 * silently keeps running under prefers-reduced-motion, or on a device the
 * governor has found to be struggling, is a bug nobody would notice on a
 * developer's machine and everybody would notice on a phone.
 *
 *   node tools/xform_probe.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join('docs', p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};

async function boot(opts){
  const ctx = await browser.newContext({ viewport: { width: 640, height: 420 },
    reducedMotion: opts && opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  page.on('console', m => { const t = m.text(); if (/shader|GLSL|compil/i.test(t) && /error/i.test(t)) errs.push(t.slice(0, 400)); });
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  await page.evaluate(() => {
    const o = document.getElementById('onboard'); if (o) o.classList.remove('open');
    if (typeof firstRunClose === 'function') try { firstRunClose(); } catch (e) {}
    director.setAuto(false);
    if (typeof LENS !== 'undefined' && LENS.set) LENS.set('none', false);
  });
  return { page, ctx, errs };
}
// the software rasteriser genuinely IS struggling, so the governor genuinely
// does stand the transition down. Pin it off to see the effect at all.
const PIN = () => { try { Object.defineProperty(PERF, 'struggling', { get(){ return false; }, set(){}, configurable: true }); } catch (e) {} };

// ---------------------------------------------------------------- 1 · it runs
{
  const { page, ctx, errs } = await boot();
  await page.evaluate(PIN);
  const keys = await page.evaluate(() => scenes.map(s => s.key));
  /* THE OUTGOING ROOM IS A FULL-FRAME ONE, on purpose. Most scenes here are
     sparse point clouds on black, so "the capture is not empty" is not a claim
     a handful of pixels can settle for them — the honest reading would be
     indistinguishable from a real failure. TERRAIN fills the frame edge to
     edge, so a capture of it either has light in it or the capture is broken. */
  const A = keys.indexOf('terrain'), B = keys.indexOf('mandala');

  await page.evaluate(i => { director.setScene(i, false); director.transDur = 0.2; }, A);
  await page.waitForTimeout(1200);
  const before = await page.screenshot();

  const armed = await page.evaluate(({ j }) => {
    segueFx = () => 'defocus';                    // pin the form; the picker is unit-tested
    director.setScene(j, false);
    director.transDur = 8; XFORM.dur = 8;         // stretch it so a screenshot lands mid-cut
    return { on: XFORM.on, kind: XFORM.kind,
             rtW: XFORM._rt ? XFORM._rt.width : 0, canvasW: renderer.domElement.width,
             prev: director.prev,
             prevVisible: director.prev >= 0 ? scenes[director.prev].group.visible : false };
  }, { j: B });

  R('a cut arms and names its form', armed.on && armed.kind === 'defocus', 'kind=' + armed.kind);
  R('the outgoing room is photographed at canvas size',
    armed.rtW > 0 && armed.rtW === armed.canvasW, `rt ${armed.rtW} vs canvas ${armed.canvasW}`);
  /* THE OLD ROOM IS LET GO OF. Its frozen copy is what the transition draws, so
     leaving the live one running would draw it twice — once shattering and once
     calmly fading underneath. That ghost image is invisible in a screenshot and
     obvious in motion, which is exactly why it is asserted here. */
  R('…and the live one is released, not drawn twice',
    armed.prev === -1 && !armed.prevVisible, 'prev=' + armed.prev);

  await page.waitForTimeout(2000);
  const mid = await page.evaluate(() => {
    // read the frozen copy back off the GPU: a capture that silently produced
    // an empty frame would leave every transition mixing against black, which
    // reads as a plain fade-from-nothing and would be easy to ship by accident
    /* THE READBACK HAS TO MATCH THE TARGET'S TYPE. Where the driver gives us
       half-float targets the ghost is one too, and readPixels on a HALF_FLOAT
       attachment wants a Uint16Array — hand it a Uint8Array and it returns
       zeroes, which is indistinguishable from a genuinely black capture and is
       exactly what the first cut of this check reported. Either way a black
       pixel is all-zero bits, so counting non-zero bits works for both. */
    const w = 160, h = 100, hdr = XFORM._rt.texture.type === THREE.HalfFloatType;
    const buf = hdr ? new Uint16Array(w * h * 4) : new Uint8Array(w * h * 4);
    let lit = 0;
    try {
      /* READ THE MIDDLE, not the corner. Every scene here is composed around
         the origin and most of them leave the corners of the frame empty, so a
         patch at (0,0) reports a black capture for a perfectly good one — which
         is what this check did on its first honest run. */
      const cx = Math.max(0, ((XFORM._rt.width - w) / 2) | 0);
      const cy = Math.max(0, ((XFORM._rt.height - h) / 2) | 0);
      renderer.readRenderTargetPixels(XFORM._rt, cx, cy, w, h, buf);
      for (let i = 0; i < buf.length; i += 4)
        if (buf[i] || buf[i + 1] || buf[i + 2]) lit++;
    } catch (e){ return { err: String(e) }; }
    return { t: director.transT, frames: XFORM._frames, uT: LENS._mats.xform.uniforms.uT.value,
             lit: lit / (w * h) };
  });
  R('the cut is still in flight when we look at it', mid.t > 0.02 && mid.t < 0.95, 't=' + (mid.t || 0).toFixed(2));
  /* THE PASS IS ACTUALLY IN THE CHAIN. Arming the transition and then having
     the render path quietly drop the pass produces something that looks exactly
     like a crossfade — no error, no warning, a feature that simply is not
     there. The counter is the only way to tell the two apart from outside. */
  R('the transition pass really ran, every frame of it', mid.frames > 3, 'frames=' + mid.frames);
  R('…driven by the director\'s own crossfade clock', Math.abs(mid.uT - mid.t) < 0.05,
    `uT=${(mid.uT || 0).toFixed(2)} transT=${(mid.t || 0).toFixed(2)}`);
  R('the frozen copy holds a real picture, not a black frame', mid.lit > 0.85,
    'lit=' + (mid.lit == null ? mid.err : mid.lit.toFixed(2)));

  await page.evaluate(() => { director.transDur = 0.2; });
  await page.waitForTimeout(1600);
  const after = await page.screenshot();
  const done = await page.evaluate(() => ({ on: XFORM.on, t: director.transT, prev: director.prev }));
  R('and it ends cleanly', !done.on && done.t >= 1 && done.prev === -1);

  R('the two rooms really are different pictures',
    before.length !== after.length || !before.equals(after));
  R('no shader errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// ------------------------------------------------ 2 · every form compiles and runs
{
  const { page, ctx, errs } = await boot();
  await page.evaluate(PIN);
  const kinds = await page.evaluate(() => XFORM_KINDS);
  const keys = await page.evaluate(() => scenes.map(s => s.key));
  const A = keys.indexOf('mandala'), B = keys.indexOf('halo');
  let bad = [];
  for (const k of kinds){
    await page.evaluate(i => { director.setScene(i, false); director.transDur = 0.2; }, A);
    await page.waitForTimeout(700);
    const on = await page.evaluate(({ k, j }) => {
      segueFx = () => k; director.setScene(j, false); director.transDur = 3; return XFORM.on;
    }, { k, j: B });
    await page.waitForTimeout(700);
    if (!on) bad.push(k);
  }
  R(`all ${kinds.length} forms arm and draw`, bad.length === 0, bad.join(','));
  R('…without a single shader error between them', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// ------------------------------------------------------- 3 · the stand-downs
{
  const { page, ctx } = await boot({ reduced: true });
  await page.evaluate(PIN);
  const keys = await page.evaluate(() => scenes.map(s => s.key));
  await page.evaluate(i => director.setScene(i, false), keys.indexOf('mandala'));
  await page.waitForTimeout(900);
  const r = await page.evaluate(j => {
    segueFx = () => 'defocus';                    // even asked for directly
    director.setScene(j, false);
    return { reduced: reducedMotion, on: XFORM.on, allowed: XFORM.allowed() };
  }, keys.indexOf('spiral'));
  R('prefers-reduced-motion is honoured', r.reduced && !r.on && !r.allowed,
    `reducedMotion=${r.reduced} on=${r.on}`);
  await ctx.close();
}
{
  const { page, ctx } = await boot();
  const keys = await page.evaluate(() => scenes.map(s => s.key));
  await page.evaluate(i => director.setScene(i, false), keys.indexOf('mandala'));
  await page.waitForTimeout(900);
  const r = await page.evaluate(j => {
    try { Object.defineProperty(PERF, 'struggling', { get(){ return true; }, set(){}, configurable: true }); } catch (e) {}
    segueFx = () => 'defocus';
    director.setScene(j, false);
    const on = XFORM.on;
    // and the plain crossfade takes over — the outgoing room is still there,
    // still live, still fading, exactly as it was before any of this existed
    return { on, prev: director.prev, prevVisible: director.prev >= 0 ? scenes[director.prev].group.visible : false };
  }, keys.indexOf('spiral'));
  R('a struggling device falls back to the crossfade', !r.on && r.prev >= 0 && r.prevVisible,
    `on=${r.on} prev=${r.prev}`);
  await ctx.close();
}
{
  const { page, ctx } = await boot();
  const keys = await page.evaluate(() => scenes.map(s => s.key));
  await page.evaluate(i => director.setScene(i, false), keys.indexOf('mandala'));
  await page.waitForTimeout(900);
  const r = await page.evaluate(j => {
    if (typeof POWER === 'undefined') return { skip: true };
    try { Object.defineProperty(POWER, 'lensOK', { get(){ return false; }, set(){}, configurable: true }); } catch (e) {}
    segueFx = () => 'defocus';
    director.setScene(j, false);
    return { on: XFORM.on };
  }, keys.indexOf('spiral'));
  R('ECO pays for no render targets', r.skip || !r.on);
  await ctx.close();
}

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
