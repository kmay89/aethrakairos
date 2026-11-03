/* SOAK PROBE — a listening session, not a unit of one.
 *
 * Every other probe measures one mechanism in isolation, on a server that
 * answers at memory speed. The defect a listener reported lives in neither
 * place: a stutter "halfway through a song, when loading" is the next record's
 * download competing with the one on air, on a real pipe, while the visuals
 * eat the main thread and a hand does things to the decks. So this plays the
 * set through in REAL TIME, on a THROTTLED link, with the visualizer running,
 * and listens to the finished mix the way the speaker does:
 *
 *   the link     one shared token bucket for every audio byte (SOAK_KBPS,
 *                default 1500 kbps — under five times a 320k stream's own
 *                rate, so the incoming deck's warm genuinely competes with
 *                the record on air). Ranged, fair-shared, abortable.
 *   the speaker  an AudioWorklet on AE.out (after the limiter) that counts
 *                runs of silence. Every soak track carries a sustained chord
 *                from first sample to last, so silence in the output is a
 *                dropout, never the music.
 *   the decks    every media event on both elements (waiting, stalled,
 *                emptied, loadstart …), a 50 ms sampler of the on-air
 *                playhead against the audio clock (a freeze is the clock
 *                standing still while we believe we're playing), and every
 *                watchdog heal (a reseek or a reload is an audible event).
 *   the hands    a scratch on the record on air, two FX units, and the
 *                crossfader grabbed mid-seam, held, and pushed across to
 *                commit — each one marked, so what a hand legitimately
 *                silences is never scored as a dropout.
 *
 *   python3 tools/make_soak_fixture.py /tmp/mb8-soak
 *   node tools/soak_probe.mjs /tmp/mb8-soak
 *   SOAK_KBPS=700 node tools/soak_probe.mjs /tmp/mb8-soak     # a weaker link
 *   SOAK_QUIET=1  node tools/soak_probe.mjs /tmp/mb8-soak     # renderer off
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, copyFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR = process.argv[2] || '/tmp/mb8-soak';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KBPS = +process.env.SOAK_KBPS || 1500;
if (!existsSync(join(DIR, 'catalog.json'))){
  console.log('no soak fixture at ' + DIR + ' — python3 tools/make_soak_fixture.py ' + DIR);
  process.exit(1);
}
// measure the engine in the working tree, never the copy the fixture was built with
for (const f of ['index.html', 'sw.js', 'three.min.js']){
  const from = join(ROOT, 'docs', f);
  if (existsSync(from)) copyFileSync(from, join(DIR, f));
}
{
  const p = join(DIR, 'index.html');
  let s = readFileSync(p, 'utf8');
  s = s.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three.min.js')
       .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
  (await import('fs')).writeFileSync(p, s);
}

/* THE LINK. One bucket, refilled every 20 ms, split evenly across whatever
 * audio responses are open — roughly what TCP does to two downloads on one
 * pipe. Everything that is not audio is served at once: the shell is cached
 * by the service worker in real life, and throttling it would only make the
 * boot slow, not the music. */
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const streams = new Set();
const net = [];
const TICK = 20;
setInterval(() => {
  const open = [...streams].filter(s => !s.blocked);
  if (!open.length) return;
  const per = Math.max(1, Math.floor(KBPS * 1000 / 8 * TICK / 1000 / open.length));
  for (const s of open){
    const n = Math.min(per, s.end - s.pos);
    if (n > 0){
      const ok = s.res.write(s.data.subarray(s.pos, s.pos + n));
      s.pos += n; s.log.bytes += n;
      if (!ok){ s.blocked = true; s.res.once('drain', () => { s.blocked = false; }); }
    }
    if (s.pos >= s.end){ s.res.end(); streams.delete(s); s.log.done = true; s.log.end = Date.now(); }
  }
}, TICK);
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  let s0 = 0, e = data.length - 1;
  if (range){
    s0 = +range[1]; e = range[2] ? Math.min(+range[2], data.length - 1) : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s0}-${e}/${data.length}`, 'Content-Length': e - s0 + 1 });
  } else res.writeHead(200, { ...headers, 'Content-Length': data.length });
  if (!/^\/audio\//.test(p)){ res.end(data.subarray(s0, e + 1)); return; }
  // a media element asks for identity encoding and a range; fetch() asks for neither
  const kind = /identity;q=1/.test(req.headers['accept-encoding'] || '') ? 'media' : 'fetch';
  const log = { path: p, size: data.length, from: s0, bytes: 0, done: false, at: Date.now(), kind };
  net.push(log);
  const s = { res, data, pos: s0, end: e + 1, blocked: false, log };
  streams.add(s);
  req.on('close', () => { if (streams.has(s)){ streams.delete(s); log.aborted = true; log.end = Date.now(); } });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP cdnjs.cloudflare.com 127.0.0.1'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
};
const errs = [];
const NOISE = /404|Failed to fetch|net::ERR|NotAllowedError|The play\(\) request/;
page.on('pageerror', e => { const m = String(e).split('\n')[0]; if (!NOISE.test(m.slice(0, 80))) errs.push(m); });
page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text().slice(0, 80))) errs.push('console: ' + m.text().slice(0, 160)); });
const T0 = Date.now();
const say = s => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s] ${s}`);

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 60000 });
await page.evaluate(quiet => {
  for (const id of ['firstRun', 'coach', 'onboard', 'emptyState', 'help']){
    const n = document.getElementById(id);
    if (n){ n.classList.remove('open', 'in'); n.style.display = 'none'; }
  }
  if (quiet && typeof POWER !== 'undefined'){
    POWER.set('eco', false);
    const cv = document.getElementById('glcanvas');
    if (cv) cv.style.display = 'none';
  }
}, process.env.SOAK_QUIET === '1');

/* THE INSTRUMENT. Everything is stamped on the audio clock, so a silence the
 * worklet hears can be laid against the events and the hands that explain it. */
await page.evaluate(() => {
  const S = window.__soak = { ev: [], sil: [], frz: [], jumps: [], heals: [], loads: [], hands: [],
    lt: [], ticks: 0, armed: false, heard: false, minRms: 1 };
  const now = () => (AE.ctx ? AE.ctx.currentTime : 0);
  S.mark = (what, on) => {
    if (on) S.hands.push({ what, from: now(), to: Infinity });
    else { const h = S.hands.slice().reverse().find(x => x.what === what && x.to === Infinity); if (h) h.to = now(); }
  };
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.duration >= 200) S.lt.push(Math.round(e.duration)); })
      .observe({ entryTypes: ['longtask'] });
  } catch (e){}
  // every reload (AE._loadAt exists once the graph is built — wrapped as it appears)
  const wrapLoad = () => {
    if (typeof AE._loadAt !== 'function' || AE._loadAt.__soak) return;
    const load = AE._loadAt;
    AE._loadAt = function (a, url, at, cb){
      const i = AE.decks ? AE.decks.findIndex(d => d.a === a) : -1;
      S.loads.push({ t: now(), deck: i, onAir: i === AE.active, at: +(+at || 0).toFixed(2),
        by: (new Error().stack.split('\n')[2] || '').trim().slice(0, 90) });
      return load.call(this, a, url, at, cb);
    };
    AE._loadAt.__soak = true;
  };
  const log = ACTIVITY.log.bind(ACTIVITY);
  ACTIVITY.log = function (kind, msg){
    if (kind === 'system') S.heals.push({ t: now(), msg: String(msg).slice(0, 90) });
    return log(kind, msg);
  };
  const EVENTS = ['waiting', 'stalled', 'emptied', 'abort', 'loadstart', 'error', 'ended'];
  let tap = null;
  const install = async () => {
    wrapLoad();
    if (!tap && AE.ctx && AE.out){
      tap = 'pending';
      const src = `class SoakTap extends AudioWorkletProcessor {
        constructor(){ super(); this.run = 0; this.n = 0; this.armed = false; this.min = 1;
          this.port.onmessage = e => { this.armed = !!e.data; if (!this.armed) this.run = 0; }; }
        process(inputs){
          const ch = inputs[0] && inputs[0][0];
          let s = 0; if (ch) for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
          const rms = ch ? Math.sqrt(s / ch.length) : 0;
          if (this.armed){
            if (rms < 1e-3) this.run++;
            else { if (this.run >= 2) this.port.postMessage({ end: currentTime, blocks: this.run }); this.run = 0;
                   if (rms < this.min) this.min = rms; }
          }
          if (++this.n % 344 === 0){ this.port.postMessage({ tick: currentTime, rms, min: this.min }); this.min = 1; }
          return true;
        } }
        registerProcessor('soak-tap', SoakTap);`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      try {
        await AE.ctx.audioWorklet.addModule(url);
        const node = new AudioWorkletNode(AE.ctx, 'soak-tap');
        const sink = AE.ctx.createGain(); sink.gain.value = 0;
        AE.out.connect(node); node.connect(sink); sink.connect(AE.ctx.destination);
        node.port.onmessage = e => {
          const m = e.data;
          if (m.tick != null){ S.ticks++; if (S.armed && m.min < S.minRms) S.minRms = m.min; return; }
          S.sil.push({ from: m.end - m.blocks * 128 / AE.ctx.sampleRate, to: m.end, ms: +(m.blocks * 128 / AE.ctx.sampleRate * 1000).toFixed(1) });
        };
        tap = node;
      } catch (e){ tap = null; S.tapErr = String(e); }
    }
    (AE.decks || []).forEach((d, i) => {
      if (!d || !d.a || d.a.__soak) return;
      d.a.__soak = true;
      for (const type of EVENTS) d.a.addEventListener(type, () => {
        const t = now();
        S.ev.push({ t, deck: i, onAir: i === AE.active, type, ct: +d.a.currentTime.toFixed(2),
          playing: !!player.playing, paused: d.a.paused, healing: !!d._healing,
          seam: MIXER.phase === 'running' || MIXER.phase === 'manual' || t - (S.seamSeen || -9) < 3 });
      });
    });
  };
  setInterval(install, 250);

  /* THE PLAYHEAD. While we believe we're playing and nothing a hand did
   * explains it, the on-air clock must advance at its rate. */
  let last = null;
  setInterval(() => {
    const t = now();
    if (MIXER.phase === 'running' || MIXER.phase === 'manual') S.seamSeen = t;
    const d = AE.decks && AE.decks[AE.active];
    const handBusy = (typeof VINYL !== 'undefined' && VINYL.engaged) || (typeof FX !== 'undefined' && (FX.loop || FX.brakeT >= 0))
      || (typeof DECKS !== 'undefined' && DECKS.fader && DECKS.fader.hand);
    const live = !!(d && player.playing && !d.a.paused && !d._healing && AE.ctx && AE.ctx.state === 'running');
    if (live && !S.heard && d.a.currentTime > 0.5) S.heard = true;
    const want = live && S.heard && !handBusy && !S.stopArm;
    if (tap && tap !== 'pending' && want !== S.armed){ tap.port.postMessage(want); }
    S.armed = want;
    if (!live || handBusy){ last = null; return; }
    const ct = d.a.currentTime;
    if (last && last.d === d){
      const dt = t - last.t, dc = ct - last.ct;
      if (dc < 0.002 && dt > 0){
        last.still = (last.still || 0) + dt;
        return;                                        // keep the original anchor while frozen
      }
      if (last.still > 0.25){
        S.frz.push({ t, ms: Math.round(last.still * 1000), ct: +ct.toFixed(2), deck: AE.active,
          seam: t - (S.seamSeen || -9) < 3, start: !S.heard || ct < 0.6 });
      } else {
        const exp = dt * (d.a.playbackRate || 1);
        if (Math.abs(dc - exp) > 0.35 && !AE.xfading && MIXER.phase !== 'running' && MIXER.phase !== 'manual')
          S.jumps.push({ t, from: +last.ct.toFixed(2), to: +ct.toFixed(2), exp: +exp.toFixed(2), deck: AE.active });
      }
    }
    last = { d, t, ct, still: 0 };
  }, 50);

  // the set's order is the fixture's, not the shuffle bag's
  const order = ['north', 'south', 'west'];
  setInterval(() => {
    const cur = player.tracks[player.cur];
    if (!cur || player._committedNext != null || MIXER.phase !== 'idle') return;
    const k = order.indexOf(cur.title);
    if (k >= 0 && k < order.length - 1) player._committedNext = player.tracks.findIndex(x => x.title === order[k + 1]);
  }, 200);
});

const started = await page.evaluate(() => {
  const i = player.tracks.findIndex(t => t.title === 'north');
  if (i < 0) return false;
  player.repeat = 'off'; player.shuffle = false;
  if (typeof FX !== 'undefined') FX.auto = false;    // the rack is the hands', so a unit we turn on is ours alone
  player._committedNext = player.tracks.findIndex(t => t.title === 'south');
  player.playIndex(i);
  return true;
});
if (!started){ console.log('fixture is missing north — rebuild it'); await browser.close(); server.close(); process.exit(1); }
say(`playing north on a ${KBPS} kbps link · renderer ${process.env.SOAK_QUIET === '1' ? 'quiet' : 'running'}`);

const at = (title, sec, ms = 400000) => page.waitForFunction(([ti, s]) => {
  const t = player.tracks[player.cur], d = AE.decks && AE.decks[AE.active];
  return t && t.title === ti && d && d.a.currentTime >= s;
}, [title, sec], { timeout: ms, polling: 200 });

// 1. a scratch on the record on air: grab, wiggle, let it snap home
await at('north', 18);
say('scratch on the record on air');
await page.evaluate(async () => {
  __soak.mark('scratch', true);
  VINYL.slip = true; VINYL.arm(true);
  const g = { cx: 50, cy: 50, r: 40 };
  VINYL.grab(90, 50, g);
  for (let i = 0; i < 40; i++){
    await new Promise(r => setTimeout(r, 25));
    const a = Math.sin(i / 4) * 0.9;
    VINYL.move(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a), g);
  }
  VINYL.lift(); VINYL.arm(false);
  await new Promise(r => setTimeout(r, 400));
  __soak.mark('scratch', false);
});

// 2. an echo for a phrase, then off
await at('north', 28);
say('echo up');
await page.evaluate(() => { FX.auto = false; FX.set('echo', 0.6, 0.45); });
await page.waitForTimeout(5000);
await page.evaluate(() => { FX.set('', null); });
say('echo down · now listening through the warm of deck B');

// 3. seam one, untouched: the auto-DJ's own beatmix
await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 400000, polling: 100 });
const seam1 = await page.evaluate(() => ({ type: MIXER.plan && MIXER.plan.type, beats: MIXER.plan && MIXER.plan.beats, next: player.tracks[MIXER.next] && player.tracks[MIXER.next].title }));
say(`seam one fires: ${seam1.type} → ${seam1.next} (${seam1.beats || '-'} beats)`);
await page.waitForFunction('(window.__mixCompleted || 0) >= 1', null, { timeout: 120000, polling: 200 });
const phase1 = await page.evaluate(() => window.__mixPhaseErrMs);
say(`seam one done · phase error ${phase1 == null ? '-' : (+phase1).toFixed(1) + ' ms'}`);

// 4. a flanger on the new record
await at('south', 25);
say('flanger up');
await page.evaluate(() => { FX.auto = false; FX.set('flanger', 0.5, 0.5); });
await page.waitForTimeout(5000);
await page.evaluate(() => { FX.set('', null); });
say('flanger down');

// 5. seam two, taken by the hand: grab mid-seam, hold half-way, push across
await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 400000, polling: 100 });
await page.waitForTimeout(1200);
const hand = await page.evaluate(async () => {
  __soak.mark('fader', true);
  const inSlot = AE.active, next = player.tracks[MIXER.next] && player.tracks[MIXER.next].title;
  const g = DECKS.faderGrab();
  const phaseAfterGrab = MIXER.phase;
  const x0 = DECKS.fader.x;
  for (let i = 1; i <= 10; i++){ await new Promise(r => setTimeout(r, 40)); DECKS.faderMove(x0 + (0.5 - x0) * i / 10); }
  await new Promise(r => setTimeout(r, 2500));                // both records, half and half
  for (let i = 1; i <= 10; i++){ await new Promise(r => setTimeout(r, 40)); DECKS.faderMove(0.5 + (inSlot - 0.5) * i / 10); }
  const v = DECKS.faderRelease();
  await new Promise(r => setTimeout(r, 600));
  __soak.mark('fader', false);
  return { grabbed: !!g, phaseAfterGrab, next, verdict: v, inSlot, active: AE.active,
    cur: player.tracks[player.cur] && player.tracks[player.cur].title, mode: DECKS.fader.mode, x: DECKS.fader.x };
});
say(`seam two by hand: grab → ${hand.phaseAfterGrab}, release → ${JSON.stringify(hand.verdict)} · on air: ${hand.cur}`);

// 6. the last record plays on alone
await at('west', 20, 120000).catch(() => {});
await page.waitForTimeout(8000);
await page.evaluate(() => { __soak.stopArm = true; });
await page.waitForTimeout(300);
const S = await page.evaluate(() => {
  const s = window.__soak;
  return { ev: s.ev, sil: s.sil, frz: s.frz, jumps: s.jumps, heals: s.heals, loads: s.loads, hands: s.hands.map(h => ({ ...h, to: h.to === Infinity ? 1e9 : h.to })),
    lt: s.lt, ticks: s.ticks, heard: s.heard, tapErr: s.tapErr || null, minRms: s.minRms,
    mixes: window.__mixCompleted || 0, cur: player.tracks[player.cur] && player.tracks[player.cur].title };
});
await page.evaluate(() => { player.pause && player.pause(); });
await browser.close();
server.close();

/* THE VERDICT. A hand's window (plus a beat of slack either side) explains a
 * silence; nothing else does. */
const inHand = t => S.hands.some(h => t >= h.from - 0.5 && t <= h.to + 0.5);
const drops = S.sil.filter(s => !inHand(s.from) && !inHand(s.to));
const freezes = S.frz.filter(f => !inHand(f.t) && !f.seam && !f.start);
const entryFreezes = S.frz.filter(f => !inHand(f.t) && f.seam);
// a record's first moments inside its own seam are the ENTRY (judged below), not the middle of a record
const atEntry = e => e.seam && e.ct < 0.6;
const onAirBad = S.ev.filter(e => e.onAir && e.playing && !e.healing && /waiting|stalled|emptied|abort|error/.test(e.type) && !(e.type === 'waiting' && atEntry(e)));
const entryWaits = S.ev.filter(e => e.onAir && e.playing && e.type === 'waiting' && atEntry(e));
const blinks = S.ev.filter(e => e.onAir && e.playing && e.type === 'loadstart' && e.ct > 1);
const healsOnAir = S.loads.filter(l => /_judge|check/.test(l.by));
const byUrl = {};
for (const l of net){ const k = l.path; (byUrl[k] = byUrl[k] || { size: l.size, bytes: 0, reqs: 0, aborted: 0 }); byUrl[k].bytes += l.bytes; byUrl[k].reqs++; if (l.aborted) byUrl[k].aborted++; }

console.log(`\nsession: ${S.mixes} seams completed · ended on ${S.cur} · ${S.ticks} tap ticks · quietest heard block ${S.minRms < 1 ? (20 * Math.log10(S.minRms)).toFixed(1) + ' dBFS' : '-'}`);
console.log('network:');
for (const [k, v] of Object.entries(byUrl))
  console.log(`  ${k}  ${(v.bytes / 1e6).toFixed(2)} MB of ${(v.size / 1e6).toFixed(2)} MB (${(v.bytes / v.size).toFixed(2)}×) in ${v.reqs} request(s), ${v.aborted} aborted`);
console.log('requests:');
for (const l of net) console.log(`  +${((l.at - T0) / 1000).toFixed(1).padStart(6)}s ${l.kind.padEnd(5)} ${l.path.replace(/^\/audio\//, '').padEnd(26)} from ${(l.from / 1e6).toFixed(2)} MB · ${(l.bytes / 1e6).toFixed(2)} MB${l.aborted ? ' · aborted' : l.done ? ' · done' : ' · open'}${l.end ? ' after ' + ((l.end - l.at) / 1000).toFixed(1) + 's' : ''}`);
console.log(`hands: ${S.hands.map(h => h.what + ' ' + h.from.toFixed(1) + '–' + h.to.toFixed(1) + 's').join(' · ')}`);
if (S.sil.length) console.log('silences: ' + S.sil.map(s => `${s.from.toFixed(2)}s ${s.ms}ms${inHand(s.from) ? ' (hand)' : ''}`).join(' · '));
if (S.frz.length) console.log('freezes: ' + S.frz.map(f => `${f.t.toFixed(2)}s ${f.ms}ms deck ${'AB'[f.deck]} @${f.ct}`).join(' · '));
if (S.jumps.length) console.log('jumps: ' + S.jumps.map(j => `${j.t.toFixed(2)}s ${j.from}→${j.to} (exp +${j.exp})`).join(' · '));
if (S.ev.length) console.log('media events: ' + S.ev.map(e => `${e.t.toFixed(1)}s ${'AB'[e.deck]}${e.onAir ? '*' : ''} ${e.type}@${e.ct}`).join(' · '));
if (S.loads.length) console.log('loads: ' + S.loads.map(l => `${l.t.toFixed(1)}s ${'AB'[l.deck]}${l.onAir ? '*' : ''} @${l.at} ← ${l.by}`).join('\n       '));
if (S.heals.length) console.log('system lines: ' + S.heals.map(h => `${h.t.toFixed(1)}s ${h.msg}`).join(' · '));
console.log(`long tasks ≥200 ms: ${S.lt.length}${S.lt.length ? ' (max ' + Math.max(...S.lt) + ' ms, median ' + S.lt.sort((a, b) => a - b)[S.lt.length >> 1] + ' ms)' : ''}`);
console.log('');

R('the speaker tap is listening', !S.tapErr && S.ticks > 50 && S.heard, S.tapErr || `${S.ticks} ticks`);
R('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
R('both seams completed and the set reached the last record', S.mixes >= 2 && S.cur === 'west', `${S.mixes} seams · on ${S.cur}`);
R('the auto-DJ beatmixed seam one', seam1.type === 'beatmix' && seam1.next === 'south', JSON.stringify(seam1));
R('a hand grabbing a running seam takes it, and a push across commits', hand.grabbed && hand.phaseAfterGrab === 'manual' && hand.cur === 'west' && hand.mode === 'rest',
  JSON.stringify(hand));
R('no dropout at the speaker outside a hand', drops.length === 0,
  drops.length ? drops.slice(0, 6).map(s => `${s.from.toFixed(2)}s ${s.ms}ms`).join(' · ') : `${S.sil.length} silence(s), all inside a hand`);
R('the on-air clock never freezes mid-record', freezes.length === 0, freezes.slice(0, 6).map(f => `${f.ms}ms @${f.ct}`).join(' · '));
R('the incoming record is rolling when its seam begins', entryFreezes.length === 0 && entryWaits.length === 0,
  [...entryFreezes.map(f => `froze ${f.ms}ms @${f.ct}`), ...entryWaits.map(e => `waiting @${e.ct}`)].slice(0, 6).join(' · '));
R('the on-air clock never jumps', S.jumps.length === 0, S.jumps.slice(0, 4).map(j => `${j.from}→${j.to}`).join(' · '));
R('the record on air never starves (no waiting/stalled/emptied mid-play)', onAirBad.length === 0,
  onAirBad.slice(0, 6).map(e => `${e.type}@${e.ct}`).join(' · '));
R('no reload blink on the record on air', blinks.length === 0 && healsOnAir.length === 0,
  [...blinks.map(e => 'loadstart@' + e.ct), ...healsOnAir.map(l => 'heal@' + l.at)].join(' · '));
const over = Object.entries(byUrl).filter(([, v]) => v.bytes > v.size * 1.3);
R('every record crosses the link once', over.length === 0, over.map(([k, v]) => `${k} ${(v.bytes / v.size).toFixed(2)}×`).join(' · '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
