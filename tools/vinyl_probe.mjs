/* VINYL PROBE — is the platter really in the signal path, and does it scratch?
 *
 * The platter's arithmetic is pure and unit-tested. What a unit test cannot
 * see is whether the worklet took its seat on a real graph, whether taking
 * the room and giving it back are silent at the speaker, and whether a
 * backspin actually runs the music backwards out of AE.out. So this listens
 * at the speaker while driving the layer the way the booth's hands would.
 *
 *   node tools/vinyl_probe.mjs
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
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const ctx = await browser.newContext({ viewport: { width: 240, height: 180 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
await page.evaluate(async () => {
  const o = document.getElementById('onboard'); if (o) o.classList.remove('open');
  if (typeof firstRunClose === 'function') try { firstRunClose(); } catch (e) {}
  director.setAuto(false);
  ensureCtx();
  if (AE.ctx.state !== 'running') await AE.ctx.resume().catch(() => {});
  await player.synthesizeDemo();
});
const live = await page.waitForFunction(
  '!!(AE.ctx && AE.ctx.state === "running" && player.playing && activeDeck() && activeDeck().a.currentTime > 0.4)',
  null, { timeout: 30000 }).then(() => true).catch(() => false);
R('the bench is playing real music into a live graph', live);
if (!live){ await browser.close(); server.close(); process.exit(1); }

const seat = await page.waitForFunction('window.__mb8Vinyl && window.__mb8Vinyl !== "none"', null, { timeout: 10000 })
  .then(() => page.evaluate('window.__mb8Vinyl')).catch(() => 'none');
R('the platter took its seat between the gate and the rack', seat === 'worklet', 'seat=' + seat);
if (seat !== 'worklet'){ await browser.close(); server.close(); process.exit(1); }

/* the instrument: a recorder at AE.out that keeps the samples, so the music
   can be compared against itself — a backspin is the same music, backwards */
await page.evaluate(() => {
  window.__rec = () => {
    const sp = AE.ctx.createScriptProcessor(4096, 2, 1);
    const chunks = [];
    sp.onaudioprocess = e => chunks.push(Float32Array.from(e.inputBuffer.getChannelData(0)));
    const z = AE.ctx.createGain(); z.gain.value = 0;
    AE.out.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
    return { stop(){ try { AE.out.disconnect(sp); sp.disconnect(); z.disconnect(); } catch (e){} sp.onaudioprocess = null;
      const n = chunks.reduce((a, c) => a + c.length, 0), out = new Float32Array(n); let o = 0;
      for (const c of chunks){ out.set(c, o); o += c.length; }
      return out; } };
  };
  window.__stats = (x, a, b) => { let pk = 0, sq = 0, worst = 0; a = a || 0; b = b || x.length;
    for (let i = a; i < b; i++){ const v = Math.abs(x[i]); if (v > pk) pk = v; sq += v * v; if (i > a){ const s = Math.abs(x[i] - x[i - 1]); if (s > worst) worst = s; } }
    return { peak: pk, rms: Math.sqrt(sq / Math.max(1, b - a)), worst }; };
});

// 1. seated and disengaged, the platter is invisible: the room passes straight through
const idle = await page.evaluate(async () => {
  const r = window.__rec(); await new Promise(res => setTimeout(res, 1500));
  const x = r.stop(); return { st: window.__stats(x), engaged: VINYL.engaged };
});
R('disengaged, the music reaches the speaker', idle.st.rms > 0.01 && !idle.engaged, `rms ${idle.st.rms.toFixed(3)}`);

// 2. a backspin: the record runs backwards, then the motor takes it up again and the layer lets go
const spin = await page.evaluate(async () => {
  const r = window.__rec();
  const t0 = performance.now();
  const ok = VINYL.backspin();
  let minRate = 1, sawBack = false, neg = 0;
  for (let i = 0; i < 60 && VINYL.engaged; i++){
    await new Promise(res => setTimeout(res, 50));
    if (VINYL.rate < minRate) minRate = VINYL.rate;
    if (VINYL.mode === 'backspin') sawBack = true;
    if (VINYL.rate < 0) neg += 50;
  }
  const held = performance.now() - t0;
  const x = r.stop();
  const sr = AE.ctx.sampleRate;
  return { ok, minRate, sawBack, neg, held, engaged: VINYL.engaged, sr,
           during: window.__stats(x, Math.floor(sr * 0.1), Math.floor(sr * 0.5)), after: window.__stats(x, x.length - sr, x.length), lag: VINYL.lag };
});
R('a backspin takes the platter', spin.ok && spin.sawBack, `mode seen=${spin.sawBack}`);
R('…runs the record backwards at speed', spin.minRate < -2.5, `min rate ${spin.minRate.toFixed(2)}×, ${spin.neg} ms backwards`);
R('…with music at the speaker the whole way', spin.during.rms > 0.005 && spin.after.rms > 0.005, `rms during ${spin.during.rms.toFixed(3)} after ${spin.after.rms.toFixed(3)}`);
R('…and gives the room back on its own', !spin.engaged, `let go after ${spin.held.toFixed(0)} ms`);

// 3. the hand: armed, held still, the lag grows; a slip lets go and snaps home
const hand = await page.evaluate(async () => {
  VINYL.slip = true;
  VINYL.arm(true);
  const g = { cx: 50, cy: 50, r: 40 };
  const grabbed = VINYL.grab(90, 50, g);
  await new Promise(res => setTimeout(res, 600));          // a finger holding the record still
  const lagHeld = VINYL.lag, rateHeld = VINYL.rate;
  // a slow drag backwards: a quarter turn in ~300 ms. The rate is read DURING
  // the drag (its most negative reading) — the moment the finger stops moving,
  // the still-finger rule holds the record, which is right and is not the drag.
  let rateDrag = 1;
  for (let i = 1; i <= 15; i++){
    await new Promise(res => setTimeout(res, 20));
    const a = -i * (Math.PI / 2) / 15; VINYL.move(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a), g);
    if (VINYL.rate < rateDrag) rateDrag = VINYL.rate;
  }
  VINYL.lift();
  await new Promise(res => setTimeout(res, 250));
  const lagAfterLift = VINYL.lag, stillEngaged = VINYL.engaged, armed = VINYL.armed;
  VINYL.arm(false);
  await new Promise(res => setTimeout(res, 200));
  return { grabbed, lagHeld, rateHeld, rateDrag, lagAfterLift, stillEngaged, armed, released: !VINYL.engaged, errs: 0 };
});
R('the hand takes the record', hand.grabbed);
R('held still, the record stops and the room falls behind the deck', Math.abs(hand.rateHeld) < 0.1 && hand.lagHeld > 0.4, `rate ${hand.rateHeld.toFixed(3)} lag ${hand.lagHeld.toFixed(2)} s`);
R('dragged backwards, the record goes backwards', hand.rateDrag < -0.3, `rate ${hand.rateDrag.toFixed(2)}`);
R('armed, a lift keeps the record in hand and slip snaps it home', hand.stillEngaged && hand.armed && hand.lagAfterLift < 0.05, `lag after lift ${hand.lagAfterLift.toFixed(3)} s`);
R('disarming gives the room back', hand.released);

// 4. hold (no slip): letting go fetches the deck to the platter — the deck seeks back, and the handback lands
const hold = await page.evaluate(async () => {
  VINYL.slip = false;
  const d = activeDeck();
  const g = { cx: 50, cy: 50, r: 40 };
  VINYL.grab(90, 50, g);
  await new Promise(res => setTimeout(res, 900));          // ~0.9 s behind
  const lag = VINYL.lagNow(), before = d.a.currentTime;
  VINYL.lift();
  const t0 = performance.now();
  while (VINYL.engaged && performance.now() - t0 < 2500) await new Promise(res => setTimeout(res, 20));
  const took = performance.now() - t0;
  const back = window.__mb8VinylBack || null;
  return { lag, before, after: d.a.currentTime, took, back, released: !VINYL.engaged, playing: player.playing };
});
R('hold: the deck is fetched back to where the record is', hold.back && hold.back.to < hold.before - 0.5, `deck ${hold.before.toFixed(2)} → ${hold.back && hold.back.to.toFixed(2)} (lag ${hold.lag.toFixed(2)} s)`);
R('…and the handback lands, with the music still playing', hold.released && hold.playing && hold.took < 2500, `${hold.took.toFixed(0)} ms`);

// 5. a brake: a real stop, the power back on, and the room given back
const brake = await page.evaluate(async () => {
  VINYL.slip = true;
  const ok = FX.brake(1.1);
  let minRate = 1, stopped = false;
  const t0 = performance.now();
  while (VINYL.engaged && performance.now() - t0 < 4000){ await new Promise(res => setTimeout(res, 40)); if (VINYL.rate < minRate) minRate = VINYL.rate; if (VINYL.mode === 'stopped') stopped = true; }
  return { minRate, stopped, released: !VINYL.engaged, took: performance.now() - t0, playing: player.playing };
});
R('the brake goes through the platter and reaches a real stop', brake.stopped && brake.minRate < 0.02, `min rate ${brake.minRate.toFixed(3)}`);
R('…the power comes back and the room is given back', brake.released && brake.playing, `${brake.took.toFixed(0)} ms`);

R('no page errors throughout', errs.length === 0, errs.join(' | '));
console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
