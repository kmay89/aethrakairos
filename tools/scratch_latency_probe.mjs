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
    n.port.onmessage = e => { const b = window.__blocks; b.push(e.data); if (b.length > 4000) b.splice(0, b.length - 4000); };
    AE.out.connect(n); n.connect(z);
    return { ok: true, sr: AE.ctx.sampleRate, base: AE.ctx.baseLatency || 0, out: AE.ctx.outputLatency || 0 };
  } catch (e){ return { ok: false, why: String(e) }; }
}, EAR_SRC);
R('an ear listens at AE.out on the audio thread', ear.ok, ear.ok ? `${ear.sr} Hz · baseLatency ${(ear.base * 1000).toFixed(1)} ms · outputLatency ${(ear.out * 1000).toFixed(1)} ms` : ear.why);
if (!ear.ok){ await browser.close(); server.close(); process.exit(1); }

/* one trial: take the record, hold it still, move it sharply, listen */
const trial = (kind) => page.evaluate(async kind => {
  const h = VINYL.for(AE.active), g = { cx: 50, cy: 50, r: 40 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  VINYL.slip = true; VINYL.arm(true);
  const a0 = 0;                                                     // the finger lands at the rim's right
  if (!h.grab(g.cx + g.r * Math.cos(a0), g.cy + g.r * Math.sin(a0), g, performance.now(), kind, false)) return { err: 'grab refused: ' + h.why() };
  await sleep(450);                                                 // the record stops under the finger; the ear settles on its still level
  const blocks = window.__blocks; const nStill = blocks.length;
  const stillFrom = Math.max(0, nStill - 60);
  let still = 0; for (let i = stillFrom; i < nStill; i++) still = Math.max(still, blocks[i].d);
  // half a second of music in one event: the angle that is 0.5 s at VINYL_REV_SEC per turn (the hand's own gain is 1)
  const dA = 0.5 / VINYL_REV_SEC * 2 * Math.PI, a1 = a0 + dA;
  const tIssue = AE.ctx.currentTime, wIssue = performance.now();
  h.move(g.cx + g.r * Math.cos(a1), g.cy + g.r * Math.sin(a1), g, wIssue);
  await sleep(250);
  const b = window.__blocks;
  let first = -1;
  for (let i = nStill; i < b.length; i++){ if (b[i].t >= tIssue - 1e-6 && b[i].d > still * 4 + 1e-4){ first = i; break; } }
  const lat = first >= 0 ? (b[first].t - tIssue) : null;
  // the spring's settling: the block from which the energy stays up for 20 ms (the record is moving steadily)
  h.lift();
  await sleep(500);
  return { still, lat, first: first >= 0 ? b[first].d : null, n: b.length - nStill, rate: h.rate };
}, kind);

const runs = async (kind, n) => {
  const lats = [], errs2 = [];
  for (let i = 0; i < n; i++){
    const t = await trial(kind);
    if (t.err){ errs2.push(t.err); continue; }
    if (t.lat == null) errs2.push('no rise heard (still ' + t.still.toExponential(2) + ')'); else lats.push(t.lat * 1000);
  }
  lats.sort((a, b) => a - b);
  const q = p => lats.length ? lats[Math.min(lats.length - 1, Math.floor(p * lats.length))] : NaN;
  return { lats, errs: errs2, median: q(0.5), p95: q(0.95), min: lats[0], max: lats[lats.length - 1] };
};
const mouse = await runs('mouse', 20);
R('twenty mouse trials: the engine answers every move', mouse.lats.length >= 18, `${mouse.lats.length}/20 heard · ${mouse.errs.slice(0, 2).join(' | ')}`);
R('mouse feel: median engine latency under 25 ms', mouse.median < 25, `median ${mouse.median.toFixed(1)} ms · p95 ${mouse.p95.toFixed(1)} ms · min ${mouse.min.toFixed(1)} · max ${mouse.max.toFixed(1)}`);
const touch = await runs('touch', 20);
R('twenty touch trials: the engine answers every move', touch.lats.length >= 18, `${touch.lats.length}/20 heard · ${touch.errs.slice(0, 2).join(' | ')}`);
R('touch feel: median engine latency under 18 ms', touch.median < 18, `median ${touch.median.toFixed(1)} ms · p95 ${touch.p95.toFixed(1)} ms · min ${touch.min.toFixed(1)} · max ${touch.max.toFixed(1)}`);
console.log(`\nengine latency (move posted → first changed block at AE.out, limiter included): mouse median ${mouse.median.toFixed(1)} ms / p95 ${mouse.p95.toFixed(1)} ms · touch median ${touch.median.toFixed(1)} ms / p95 ${touch.p95.toFixed(1)} ms`);
console.log(`the browser's own: baseLatency ${(ear.base * 1000).toFixed(1)} ms · outputLatency ${(ear.out * 1000).toFixed(1)} ms (not ours; a phone adds its touch delivery on top)`);
R('no page errors throughout', errs.length === 0, errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
