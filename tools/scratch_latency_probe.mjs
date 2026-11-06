/* SCRATCH LATENCY — the engine's own share of touch-to-sound, measured on the
 * audio thread. The browser's part (the event's trip to the page, the output
 * latency) cannot be heard from inside a headless page, so this measures what
 * the engine adds on top: a hand's move posted to the platter worklet → the
 * next render quantum → the slipmat spring pulling the record after the
 * finger → the limiter's lookahead → AE.out.
 *
 *   node tools/scratch_latency_probe.mjs [fixture-dir]
 *
 * The record is taken in hand and held still (the tape reads a constant
 * sample), then at a known context time the hand is moved sharply: half a
 * second of music in one event. The ear at AE.out posts every 128-frame
 * block's first-difference energy stamped with the context clock — a still
 * record has none, a moving one has plenty — and the latency is the first
 * block, at or after the move, whose energy rises clearly above the still
 * level. Twenty trials; the median and the 95th percentile are the numbers.
 * Reported beside the context's own baseLatency/outputLatency, which are the
 * browser's and not ours. The thresholds leave margin for a loaded machine. */
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
  if (window.__fixture){
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
R('the platter worklet is seated', seat === 'worklet', 'seat=' + seat);
if (seat !== 'worklet'){ await browser.close(); server.close(); process.exit(1); }
await page.evaluate(() => { activeDeck().a.loop = true; if (typeof FX !== 'undefined') FX.auto = false; });

/* the ear: every 128-frame block's first-difference energy, stamped with the
   context clock on the audio thread — a stopped record is a constant sample
   (no energy), a moving one is music (plenty) */
const EAR_SRC = 'class LatEar extends AudioWorkletProcessor{constructor(){super();this.p=0;}'
  + 'process(i){const c=i[0]&&i[0][0];if(!c)return true;let q=0,p=this.p;for(let k=0;k<c.length;k++){const d=c[k]-p;q+=d*d;p=c[k];}this.p=p;'
  + 'this.port.postMessage({t:currentTime,d:Math.sqrt(q/c.length)});return true;}}'
  + 'registerProcessor("lat-ear",LatEar);';
const ear = await page.evaluate(async src => {
  try {
    await AE.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const n = new AudioWorkletNode(AE.ctx, 'lat-ear');
    const z = AE.ctx.createGain(); z.gain.value = 0; z.connect(AE.ctx.destination);
    window.__blocks = [];
    n.port.onmessage = e => { window.__blocks.push(e.data); };   // reset per trial (a rolling buffer shifted every index under the scan)
    AE.out.connect(n); n.connect(z);
    return { ok: true, sr: AE.ctx.sampleRate, base: AE.ctx.baseLatency || 0, out: AE.ctx.outputLatency || 0 };
  } catch (e){ return { ok: false, why: String(e) }; }
}, EAR_SRC);
R('an ear listens at AE.out on the audio thread', ear.ok, ear.ok ? `${ear.sr} Hz · baseLatency ${(ear.base * 1000).toFixed(1)} ms · outputLatency ${(ear.out * 1000).toFixed(1)} ms` : ear.why);
if (!ear.ok){ await browser.close(); server.close(); process.exit(1); }

/* one trial: take the record, hold it still, move it by `music` seconds — in one event, or in
   two 8 ms apart (`split`: the least any real pointer stream delivers, so the hand's speed is
   read and the feed-forward carry is exercised, not only the bare spring) — and listen.
   Two numbers come out: the FIRST CHANGE (the move posted → the first block at AE.out that
   differs: the port, the quantum, the limiter's lookahead) and the ARRIVAL (the record has
   got to where the finger put it and stopped again: the slipmat spring's whole answer). A
   small step measures the spring; a big flick measures the rate cap, which is not the spring. */
const trial = (kind, music, split) => page.evaluate(async ({ kind, music, split }) => {
  const h = VINYL.for(AE.active), g = { cx: 50, cy: 50, r: 40 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  VINYL.slip = true; VINYL.arm(true);
  // a record that stopped turning between trials (an element paused by a lift that never resumed it) is started again, or the grab is refused for 'Press play first'
  if (!h.rolling()){ try { const d = AE.decks[AE.active]; d.a.loop = true; await d.a.play(); } catch (e){} await sleep(400); }
  const a0 = 0;                                                     // the finger lands at the rim's right
  if (!h.grab(g.cx + g.r * Math.cos(a0), g.cy + g.r * Math.sin(a0), g, performance.now(), kind, false)) return { err: 'grab refused: ' + h.why() };
  await sleep(450);                                                 // the record stops under the finger; the ear settles on its still level
  const stillBlocks = window.__blocks.slice(-60);
  let still = 0; for (const b of stillBlocks) still = Math.max(still, b.d);
  window.__blocks = [];
  // `music` seconds of music in one event: the angle that is `music` at VINYL_REV_SEC per turn (the hand's own gain is 1)
  const dA = music / VINYL_REV_SEC * 2 * Math.PI, a1 = a0 + dA;
  const tIssue = AE.ctx.currentTime, wIssue = performance.now();
  if (split){
    const aH = a0 + dA / 2;
    h.move(g.cx + g.r * Math.cos(aH), g.cy + g.r * Math.sin(aH), g, wIssue);
    await sleep(8);
    h.move(g.cx + g.r * Math.cos(a1), g.cy + g.r * Math.sin(a1), g, wIssue + 8);
  } else h.move(g.cx + g.r * Math.cos(a1), g.cy + g.r * Math.sin(a1), g, wIssue);
  await sleep(300);
  const b = window.__blocks.slice();
  const thr = still * 4 + 1e-4;
  let first = -1, peak = 0;
  for (let i = 0; i < b.length; i++){ if (b[i].t >= tIssue - 1e-6 && b[i].d > thr){ first = i; break; } }
  for (let i = Math.max(0, first); i < b.length; i++) peak = Math.max(peak, b[i].d);
  // the arrival: after the rise, the first block from which the energy stays under 5 % of its peak for 15 ms
  let arrive = -1;
  if (first >= 0) for (let i = first + 1; i < b.length; i++){
    if (b[i].d > peak * 0.05) continue;
    let quiet = true; for (let j = i; j < b.length && b[j].t < b[i].t + 0.015; j++) if (b[j].d > peak * 0.05){ quiet = false; break; }
    if (quiet){ arrive = i; break; }
  }
  h.lift();
  await sleep(450);
  return { still, first: first >= 0 ? (b[first].t - tIssue) * 1000 : null, arrive: arrive >= 0 ? (b[arrive].t - tIssue) * 1000 : null, peak, n: b.length };
}, { kind, music, split: !!split });

const stats = xs => { const a = xs.slice().sort((p, q) => p - q); const q = p => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN; return { n: a.length, median: q(0.5), p95: q(0.95), min: a[0], max: a[a.length - 1] }; };
const fmt = s => `median ${s.median.toFixed(1)} ms · p95 ${s.p95.toFixed(1)} · min ${s.min.toFixed(1)} · max ${s.max.toFixed(1)} (${s.n})`;
const runs = async (kind, music, n, split) => {
  const firsts = [], arrives = [], errs2 = [];
  for (let i = 0; i < n; i++){
    const t = await trial(kind, music, split);
    if (t.err){ errs2.push(t.err); continue; }
    if (t.first == null) errs2.push('no rise heard (still ' + t.still.toExponential(2) + ', ' + t.n + ' blocks)'); else firsts.push(t.first);
    if (t.arrive != null) arrives.push(t.arrive);
  }
  return { first: stats(firsts), arrive: stats(arrives), errs: errs2 };
};
const blockMs = 128 / ear.sr * 1000;
// the port and the quantum: a flick of half a second, the first changed block
const flick = await runs('mouse', 0.5, 12);
R('a flick: the engine answers every move', flick.first.n >= 11, `${flick.first.n}/12 heard · ${flick.errs.slice(0, 2).join(' | ')}`);
R('…within two render quanta of the move (the port, the quantum, the limiter\'s 3 ms)', flick.first.p95 <= 2 * blockMs + 3.5, 'first change ' + fmt(flick.first));
// the spring: a small step, the record arriving where the finger put it
const stepMouse = await runs('mouse', 0.025, 16), stepTouch = await runs('touch', 0.025, 16);
R('a 25 ms step, mouse feel: the record arrives', stepMouse.arrive.n >= 14, `${stepMouse.arrive.n}/16 arrived · ${stepMouse.errs.slice(0, 2).join(' | ')}`);
R('…settled within 60 ms of the move', stepMouse.arrive.median < 60, 'arrival ' + fmt(stepMouse.arrive));
R('a 25 ms step, touch feel: the record arrives', stepTouch.arrive.n >= 14, `${stepTouch.arrive.n}/16 arrived · ${stepTouch.errs.slice(0, 2).join(' | ')}`);
R('…settled within 45 ms of the move', stepTouch.arrive.median < 45, 'arrival ' + fmt(stepTouch.arrive));
// the carry: the same step in two moves 8 ms apart (the least a real pointer stream delivers), so the hand's speed is read and the
// record is carried on past the second move for one period, then stopped where it is — never sprung back (the old carry held 20 ms
// for 50 ms and then played 22 ms of music backwards: it arrived at 170 ms, and this probe's single move never saw it)
const carryMouse = await runs('mouse', 0.025, 12, true), carryTouch = await runs('touch', 0.025, 12, true);
R('a 25 ms step in two moves, mouse feel: the record arrives', carryMouse.arrive.n >= 10, `${carryMouse.arrive.n}/12 arrived · ${carryMouse.errs.slice(0, 2).join(' | ')}`);
R('…and is still within 90 ms of the first move (the carry let go, no spring-back)', carryMouse.arrive.median < 90, 'arrival ' + fmt(carryMouse.arrive));
R('a 25 ms step in two moves, touch feel: the record arrives', carryTouch.arrive.n >= 10, `${carryTouch.arrive.n}/12 arrived · ${carryTouch.errs.slice(0, 2).join(' | ')}`);
R('…and is still within 75 ms of the first move', carryTouch.arrive.median < 75, 'arrival ' + fmt(carryTouch.arrive));
console.log(`\nengine share of touch-to-sound (the port, the quantum, the limiter): first change after a flick ${fmt(flick.first)} · one quantum is ${blockMs.toFixed(1)} ms`);
console.log(`the slipmat spring (a 25 ms step, moved then still): mouse arrival ${fmt(stepMouse.arrive)} · touch arrival ${fmt(stepTouch.arrive)}`);
console.log(`the carry (the step in two moves 8 ms apart, then still): mouse arrival ${fmt(carryMouse.arrive)} · touch arrival ${fmt(carryTouch.arrive)}`);
console.log(`the browser's own: baseLatency ${(ear.base * 1000).toFixed(1)} ms · outputLatency ${(ear.out * 1000).toFixed(1)} ms (not ours; a phone adds its touch delivery on top)`);
R('no page errors throughout', errs.length === 0, errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
