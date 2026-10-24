/* VINYL PROBE — are the platters really in the signal path, and do they scratch?
 *
 * The platter's arithmetic is pure and unit-tested. What a unit test cannot
 * see is whether the worklets took their seats on a real graph — one per
 * deck — whether taking a record and giving it back are silent at the
 * speaker, whether a backspin actually runs the music backwards out of
 * AE.out, and whether a scratch on deck B leaves deck A's signal alone. So
 * this listens at the speaker while driving the layer the way the booth's
 * hands would.
 *
 *   node tools/vinyl_probe.mjs              the shipped player, the synthesized demo
 *   node tools/vinyl_probe.mjs <fixture>    …and, on the mix fixture, a scratch through a running seam
 *                                           (python3 tools/make_mix_fixture.py DIR && cp docs/three.min.js docs/index.html docs/sw.js DIR/)
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIR = process.argv[2] || '';
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR || 'docs', p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  if (range){
    const s0 = +range[1], e = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s0}-${e}/${data.length}`, 'Content-Length': e - s0 + 1 });
    res.end(data.subarray(s0, e + 1));
  } else { res.writeHead(200, { ...headers, 'Content-Length': data.length }); res.end(data); }
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
await ctx.addInitScript(fx => { window.__fixture = fx; try { localStorage.setItem('mb8_lang', 'en'); } catch (e){} }, !!DIR);
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
  if (window.__fixture){
    // the fixture's records, the auto-DJ off until the seam check wants it
    const byTitle = new Map(allTracks().map(t => [t.title, t]));
    player.tracks = ['alpha', 'beta'].map(n => byTitle.get(n)).filter(Boolean);
    player.cur = -1; player._bag = []; MIXER.setOn(false); player.playIndex(0);
  } else await player.synthesizeDemo();
});
const live = await page.waitForFunction(
  '!!(AE.ctx && AE.ctx.state === "running" && player.playing && activeDeck() && activeDeck().a.currentTime > 0.4)',
  null, { timeout: 30000 }).then(() => true).catch(() => false);
R('the bench is playing real music into a live graph', live);
if (!live){ await browser.close(); server.close(); process.exit(1); }

const seat = await page.waitForFunction('window.__mb8Vinyl && window.__mb8Vinyl !== "none"', null, { timeout: 10000 })
  .then(() => page.evaluate('window.__mb8Vinyl')).catch(() => 'none');
const decks = await page.evaluate('window.__mb8VinylDecks');
R('both platters took their seats — one insert per deck, between the filter and the gain', seat === 'worklet' && decks && decks.A === 'worklet' && decks.B === 'worklet', 'seat=' + seat + ' ' + JSON.stringify(decks));
if (seat !== 'worklet'){ await browser.close(); server.close(); process.exit(1); }
const seated = await page.evaluate(() => {
  const d = AE.decks, ok = d.every(k => k.vinyl && k.vinyl === (typeof VINYL !== 'undefined' && VINYL.for(d.indexOf(k)).node));
  return { ok, aliases: VINYL.engaged === false && typeof VINYL.grab === 'function' && VINYL.for(0) !== VINYL.for(1) && VINYL.focus === AE.active };
});
R('…each deck wears its own node, and the single-platter names still answer for the hand in focus', seated.ok && seated.aliases, JSON.stringify(seated));
// the demo is sixteen seconds and the probe is not: the record on air loops (the fixture's thirty-second records too)
await page.evaluate(() => { activeDeck().a.loop = true; });

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

// 6. two hands: deck B scratched while A plays leaves A's signal alone — a steady tone on A, read at the speaker
const two = await page.evaluate(async () => {
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const tr = player.tracks[player.cur];
  const loaded = DECKS.load(1, tr);
  for (let k = 0; k < 60 && AE.decks[1].a.readyState < 2; k++) await wait(100);
  const played = DECKS.play(1);
  await wait(400);
  // a 1 kHz tone into deck A's own chain (after the element), the element itself muted so the tone IS deck A
  const osc = AE.ctx.createOscillator(); osc.frequency.value = 1000;
  const og = AE.ctx.createGain(); og.gain.value = 0.2;
  osc.connect(og); og.connect(AE.decks[0].shelf); osc.start();
  AE.decks[0].a.muted = true;
  await wait(500);
  const r = window.__rec();
  await wait(500);                                           // the tone alone: the level before
  const h = VINYL.for(1), g = { cx: 50, cy: 50, r: 40 };
  const why = h.why(), grabbed = h.grab(90, 50, g, 0, 'mouse', false);
  let minRate = 9, aEngaged = false;
  for (let i = 1; i <= 25; i++){
    await wait(20);
    const a = -i * (Math.PI / 2) / 15; h.move(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a), g);
    if (h.rate < minRate) minRate = h.rate; aEngaged ||= VINYL.for(0).engaged;
  }
  await wait(200);
  const bEngagedDuring = h.engaged;
  h.lift();
  await wait(300);
  const x = r.stop();
  osc.stop(); AE.decks[0].a.muted = false;
  DECKS.pause(1); DECKS.eject(1);
  // the tone's level, by Goertzel at 1 kHz, before the grab and during the drag
  const sr = AE.ctx.sampleRate;
  const tone = (a, n) => { const w = 2 * Math.PI * 1000 / sr; let s0 = 0, s1 = 0, s2 = 0; const c = 2 * Math.cos(w);
    for (let i = a; i < a + n; i++){ s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
    return Math.sqrt(Math.max(1e-20, s1 * s1 + s2 * s2 - c * s1 * s2)) / n; };
  const n = Math.floor(sr * 0.3);
  const before = tone(Math.floor(sr * 0.1), n), during = tone(Math.floor(sr * 0.7), n);
  return { loaded, played, why, grabbed, minRate, aEngaged, bEngagedDuring, before, during, dB: 20 * Math.log10(during / before), released: !h.engaged, playing: player.playing };
});
R('deck B, loaded and rolling by hand, can be taken: its own platter, under the fader', two.loaded && two.played && two.why === '' && two.grabbed, 'why=' + JSON.stringify(two.why));
R('…dragged backwards it goes backwards, while A\'s hand stays off its record', two.minRate < -0.3 && !two.aEngaged && two.bEngagedDuring, `B rate ${two.minRate.toFixed(2)}×`);
R('…and A\'s tone at the speaker is untouched, within half a dB', Math.abs(two.dB) < 0.5 && two.before > 1e-4, `${two.dB.toFixed(2)} dB (before ${two.before.toExponential(2)})`);
R('…lifted, B\'s hand lets go and A plays on', two.released && two.playing);

// 7. a preset: the pad's strokes run inside the processor, on the beat, and the hand lets go on its own
const pre = await page.evaluate(async () => {
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const h = VINYL.for(0);
  const beat = 60 / FX.bpm();
  const t0 = performance.now();
  const why = h.why(), paused = AE.decks[0].a.paused, engaged0 = h.engaged;
  const ok = h.script('baby');
  const armedScript = !!h._script;
  let minRate = 9, started = 0, ended = 0;
  for (let i = 0; i < 100 && !ended; i++){
    await wait(25);
    if (h.rate < minRate) minRate = h.rate;
    if (!started && h.rate < -0.2) started = performance.now() - t0;
    if (!h._script) ended = performance.now() - t0;
  }
  await wait(400);
  return { ok, why, paused, engaged0, armedScript, beat, minRate, started, ended, released: !h.engaged, playing: player.playing };
});
R('a preset takes the record and pulls back first (the tape holds only the past)', pre.ok && pre.armedScript && pre.minRate < -0.2, `min rate ${pre.minRate.toFixed(2)}× · ok=${pre.ok} why=${JSON.stringify(pre.why)} paused=${pre.paused} engaged=${pre.engaged0}`);
R('…it starts within a beat and runs its course (BABY: one beat), then the hand lets go', pre.started > 0 && pre.started < pre.beat * 1000 + 150 && pre.ended > 0 && pre.ended < pre.beat * 2500 + 600 && pre.released && pre.playing,
  `started ${pre.started.toFixed(0)} ms, done ${pre.ended.toFixed(0)} ms (beat ${(pre.beat * 1000).toFixed(0)} ms)`);

// 8. quantised slip: the snap waits for the next beat line (only where a grid is known)
const qnt = await page.evaluate(async () => {
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const have = FX._gridOf(activeDeck()).have;
  VINYL.setQuant('beat');
  const h = VINYL.for(0); h.slip = true;
  const g = { cx: 50, cy: 50, r: 40 };
  h.grab(90, 50, g, 0, 'touch', false);
  await wait(400);
  const t0 = performance.now(), ctx0 = AE.ctx.currentTime;
  h.lift();
  const pending = !!h._snapT, engagedAfterLift = h.engaged;
  while (h.engaged && performance.now() - t0 < 3000) await wait(10);
  const took = performance.now() - t0;
  VINYL.setQuant('off');
  return { have, pending, engagedAfterLift, took, released: !h.engaged };
});
R('quantised to the beat, a slip waits for the line' + (qnt.have ? '' : ' (no grid on this record: it lets go at once)'),
  qnt.released && (qnt.have ? (qnt.pending && qnt.engagedAfterLift && qnt.took > 20) : !qnt.pending), `${qnt.took.toFixed(0)} ms`);

// 9. (fixture) a scratch through a running seam: the hand keeps the record, the mixer keeps the phase, a hold is a slip
if (DIR){
  const seam = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    activeDeck().a.loop = false;
    MIXER.setOn(true);
    for (let k = 0; k < 80 && MIXER.phase !== 'armed'; k++) await wait(100);
    const now = MIXER.tryMixNow();
    for (let k = 0; k < 150 && MIXER.phase !== 'running'; k++) await wait(100);
    for (let k = 0; k < 100 && !(MIXER.lastF > 0.15); k++) await wait(50);
    const phase0 = MIXER.phase;
    const outSlot = AE.decks.indexOf(MIXER.outDeck), h = VINYL.for(outSlot);
    h.slip = false;                                            // hold mode: through a seam it must behave as slip
    const why = h.why(), g = { cx: 50, cy: 50, r: 40 };
    const grabbed = h.grab(90, 50, g, 0, 'mouse', false);
    let minRate = 9;
    for (let i = 1; i <= 15; i++){ await wait(20); const a = -i * (Math.PI / 2) / 15; h.move(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a), g); if (h.rate < minRate) minRate = h.rate; }
    await wait(300);
    const phase1 = MIXER.phase, engaged = h.engaged;
    const backBefore = window.__mb8VinylBack ? window.__mb8VinylBack.to : null;
    h.lift();
    await wait(300);
    const backAfter = window.__mb8VinylBack ? window.__mb8VinylBack.to : null;
    const phase2 = MIXER.phase;
    h.slip = true;
    return { now, phase0, outSlot, why, grabbed, minRate, phase1, engaged, phase2, released: !h.engaged, seeked: backAfter !== backBefore };
  });
  R('(fixture) a beatmix runs, and the outgoing record can still be taken in hand through it', seam.now && seam.phase0 === 'running' && seam.why === '' && seam.grabbed, JSON.stringify({ phase: seam.phase0, why: seam.why }));
  R('…the scratch runs under the seam\'s curve: the mixer stays \'running\', the hand has the record', seam.phase1 === 'running' && seam.engaged && seam.minRate < -0.3, `phase ${seam.phase1}, rate ${seam.minRate.toFixed(2)}×`);
  R('…and letting go is a slip, never a seek — the phase lock owns the playheads', seam.phase2 === 'running' && seam.released && !seam.seeked, `phase ${seam.phase2}, seeked=${seam.seeked}`);
} else console.log('  (no fixture dir given: the seam check is skipped — node tools/vinyl_probe.mjs <fixture>)');

R('no page errors throughout', errs.length === 0, errs.join(' | '));
console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
