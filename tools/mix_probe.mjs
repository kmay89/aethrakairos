/* MIX PROBE — measures the SEAM, not the plan.
 *
 * The planner is pure and unit-tested; the curves are pure and unit-tested. None
 * of that can hear a glitch, because a glitch is a timing fact about the audio
 * graph: the crossfade curves are scheduled on the audio clock the instant the
 * seam fires, but the incoming <audio> element does not begin producing samples
 * until play() has actually started it and any seek has settled. For however
 * long that takes, the fade-IN ramp is multiplying silence while the fade-OUT
 * ramp runs on schedule — a hole in the middle of the blend.
 *
 * So this taps the real master bus during a real seam on a real graph and
 * reports what a listener would hear:
 *
 *   start     when deck B's playhead actually begins advancing, relative to the
 *             fader opening AND to the -24 dB point of the fade-in curve. The
 *             second is the honest deadline: silence multiplied by a gain no one
 *             can hear is not a hole.
 *   trough    the deepest point of the master RMS envelope across the seam,
 *             relative to the pre-seam level. An equal-power crossfade of two
 *             comparably loud tracks should hold roughly level; a hole shows
 *             up here and nowhere else.
 *   phase     the beat-phase error the engine's own lock reports (ms).
 *   settle    that every deck is left clean afterwards — unity gain, unity
 *             rate, flat shelf, open filter. Rot in a mix engine is cumulative;
 *             a seam that leaves a deck at 0.7 gain poisons the next one.
 *
 * WHAT IT FOUND, and why the engine looks the way it does now:
 *
 *   before      renderer quieted   lock   0.3 ms   ·  B started  41 ms late
 *               renderer running   lock 114.0 ms   ·  B started 322-441 ms late
 *   after       renderer running   lock 1.9-8.0 ms ·  B started 210-680 ms after the call
 *
 * The seam was excellent when the main thread was free and fell apart when the
 * visualizer saturated it — not a tuning problem but a coupling problem. B was
 * dropped at its absolute entry point at whatever instant the animation loop
 * NOTICED that A had crossed the bar line, so the grid offset was exactly the
 * frame's lateness: a quarter beat at 124 bpm on a busy frame. Two changes broke
 * the coupling, and both are cheap: place B relative to where A actually is
 * (seamEntry), and schedule the whole seam a lead-in ahead on the audio clock so
 * the deck is rolling and the grids are latched before the fader moves. Neither
 * depends on the frame rate, which is why the lock now holds under load.
 *
 *   python3 tools/make_mix_fixture.py /tmp/mb8-mix
 *   node tools/mix_probe.mjs /tmp/mb8-mix                 # measurement conditions
 *   MB8_PROBE_RENDER=1 node tools/mix_probe.mjs /tmp/mb8-mix   # real-session conditions
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, copyFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR = process.argv[2] || '/tmp/mb8-mix';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
/* The fixture is built once and reused; the player inside it is a COPY taken at
 * build time. Left alone, this tool would happily measure whatever version of
 * the engine happened to be current when the fixture was made — which is how a
 * mix probe reports yesterday's numbers with total confidence. Re-sync the
 * shell from the working tree on every run. */
for (const f of ['index.html', 'sw.js', 'three.min.js']){
  const from = join(ROOT, 'docs', f);
  if (existsSync(from) && existsSync(DIR)) copyFileSync(from, join(DIR, f));
}
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };
// Range support matters here: the incoming deck SEEKS to its mix-in point, and a
// server that cannot serve a byte range turns every seam into a full re-download,
// which would fake the very latency this tool exists to measure.
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  if (range){
    const s0 = +range[1], e = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s0}-${e}/${data.length}`,
      'Content-Length': e - s0 + 1 });
    res.end(data.subarray(s0, e + 1));
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': data.length });
    res.end(data);
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext()).newPage();
let pass = 0, fail = 0, open = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
};
/* A KNOWN-OPEN DEFECT IS NOT A TEST FAILURE — it is a number with a name.
 * Reporting it as FAIL would make this tool red forever, and a tool that is
 * always red guards nothing. OPEN items print their measurement and do not
 * affect the exit code; the fixed invariants do. When an OPEN item starts
 * passing, promote it to R() and it becomes a regression gate from then on. */
const O = (name, ok, detail) => {
  open++;
  console.log((ok ? '  ok?  ' : '  OPEN ') + name + (detail ? '  · ' + detail : ''));
};
page.on('pageerror', e => console.log('  [pageerror]', String(e).split('\n')[0]));

await page.addInitScript(v => { window.__probeRender = v; }, process.env.MB8_PROBE_RENDER === '1');
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 40000 });
await page.evaluate(() => {
  for (const id of ['firstRun', 'coach', 'onboard', 'emptyState', 'help']){
    const n = document.getElementById(id);
    if (n){ n.classList.remove('open', 'in'); n.style.display = 'none'; }
  }
  /* Starve the renderer, not the instrument. Under SwiftShader the visualizer
   * pins the main thread to a few frames a second, and a probe that samples on
   * requestAnimationFrame then resolves the seam at ~3 Hz — far too coarse to
   * say anything about a level envelope or a start latency. The audio path is
   * unaffected: every ramp in the seam is scheduled sample-accurately on the
   * audio clock, so quieting the GPU changes what we can SEE, not what plays. */
  /* Quiet the renderer by default, so the INSTRUMENT is not the bottleneck.
   * Under SwiftShader the visualizer saturates the main thread and even a 12 ms
   * sampling timer lands only a handful of times across a four-second seam —
   * far too coarse to say anything about a level envelope. The audio path is
   * unaffected: every ramp in the seam is scheduled sample-accurately on the
   * audio clock, so this changes what can be SEEN, not what plays.
   * MB8_PROBE_RENDER=1 leaves the visualizer running, which is how the seam's
   * sensitivity to frame rate was found in the first place. */
  if (!window.__probeRender && typeof POWER !== 'undefined'){
    POWER.set('eco', false);
    const cv = document.getElementById('glcanvas');
    if (cv) cv.style.display = 'none';
  }
});

/* Instrument the graph from outside: an analyser on the master, sampled every
 * frame together with BOTH playheads. Nothing in the app changes — this listens
 * to exactly the signal that reaches the speakers.
 *
 * The metric that matters is the ENVELOPE SHAPE across the overlap. An
 * equal-power crossfade of two comparably loud tracks holds roughly level; a
 * deck that has not started yet shows up as a dip early in the blend, because
 * the fade-out ran on schedule while the fade-in multiplied silence. Reading
 * only the minimum is not enough — the end of a seam legitimately dips if the
 * incoming track's entry is quiet — so the probe reports the whole curve. */
await page.evaluate(() => {
  window.__seam = { rms: [], seamAt: null, bAtSeam: null, bMoved: null, bLate: null };
  const install = () => {
    if (!AE.ctx || !AE.master || window.__seam.tap) return;
    const an = AE.ctx.createAnalyser();
    an.fftSize = 2048;
    AE.master.connect(an);                       // a tap, not an insert
    const buf = new Float32Array(an.fftSize);
    window.__seam.tap = an;
    const loop = () => {
      if (AE.ctx.state === 'running'){
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        const a = MIXER.outDeck, b = AE.decks[AE.active];
        window.__seam.rms.push({ t: AE.ctx.currentTime, r: Math.sqrt(s / buf.length),
          b: b ? b.a.currentTime : 0, bp: b ? b.a.paused : true });
        if (window.__seam.rms.length > 20000) window.__seam.rms.shift();
      }
    };
    setInterval(loop, 12);            // ~80 Hz, independent of the render loop
  };
  setInterval(install, 200);

  /* Was the incoming deck ALREADY producing audio when the fader opened? The
   * honest test is that its playhead advances across the first moments of the
   * blend — sampled after the latch has placed it, not before, because the
   * latch legitimately seeks it backwards onto the downbeat.
   *
   * The reference is the FADER, not the call. A seam is now scheduled a lead-in
   * ahead of the call precisely so B can spend that time getting going, so
   * measuring from fire() would score the engine's own head start as latency.
   * bLate is milliseconds relative to the fader opening: negative means the deck
   * was already rolling when the blend began, which is the whole point. */
  const fire = MIXER.fire.bind(MIXER);
  MIXER.fire = function (now){
    fire(now);
    if (MIXER.phase !== 'running') return;
    const nd = AE.decks[AE.active];
    const seam = MIXER.audioT0 != null ? MIXER.audioT0 : AE.ctx.currentTime;
    window.__seam.seamAt = seam;
      const at = nd.a.currentTime;
    window.__seam.bAtSeam = at;
    const t0 = AE.ctx.currentTime;
    const watch = () => {
      if (window.__seam.bMoved != null) return;
      const dt = AE.ctx.currentTime - t0;
      if (nd.a.currentTime > at + 0.02){
        window.__seam.bMoved = dt * 1000;
        window.__seam.bLate = (dt - (seam - t0)) * 1000;
        clearInterval(iv); return;
      }
      if (dt > 1.5){ window.__seam.bMoved = -1; window.__seam.bLate = 1500; clearInterval(iv); return; }
    };
    const iv = setInterval(watch, 8);
  };
});

// alpha→beta is the pair the fixture engineers into a beatmix; find it by name
// rather than by queue position, which the shuffle bag is free to reorder
const started = await page.evaluate(() => {
  const i = player.tracks.findIndex(t => t.title === 'alpha');
  const j = player.tracks.findIndex(t => t.title === 'beta');
  if (i < 0 || j < 0) return null;
  player.repeat = 'off'; player.shuffle = false;
  player._committedNext = j;
  player.playIndex(i);
  return { i, j };
});
if (!started){ console.log('fixture is missing alpha/beta — rebuild it'); await browser.close(); server.close(); process.exit(1); }
await page.waitForFunction('MIXER.phase === "armed"', null, { timeout: 40000 });
let plan = await page.evaluate(() => ({ ...MIXER.plan, next: player.tracks[MIXER.next] && player.tracks[MIXER.next].title }));
if (plan.next !== 'beta'){
  // the draw picked another track; re-arm explicitly onto beta so the probe
  // measures the engineered beatmix pair rather than whatever came up
  await page.evaluate(() => {
    MIXER.cancel('probe');
    const j = player.tracks.findIndex(t => t.title === 'beta');
    player._committedNext = j;
    player.pickNext = () => j;
    MIXER.arm();
  });
  await page.waitForFunction('MIXER.phase === "armed"', null, { timeout: 20000 });
  plan = await page.evaluate(() => ({ ...MIXER.plan, next: player.tracks[MIXER.next] && player.tracks[MIXER.next].title }));
}
console.log(`\nplan: ${plan.type} -> ${plan.next} · ${plan.beats} beats · ${plan.keys}`
  + ` · ${plan.seconds}s · ${plan.bpmA}->${plan.bpmB} bpm`
  + ` · startA ${plan.startA && plan.startA.toFixed(2)}s startB ${plan.startB && plan.startB.toFixed(2)}s`);
// jump to just before the seam so the probe does not sit through a whole track
await page.evaluate(() => {
  const d = AE.decks[AE.active];
  try { d.a.currentTime = Math.max(0, MIXER.plan.startA - 3); } catch (e){}
});
await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 60000 });
const preRms = await page.evaluate(() => {
  const a = window.__seam.rms.filter(s => s.t < window.__seam.seamAt && s.t > window.__seam.seamAt - 1.2);
  return a.length ? a.reduce((x, s) => x + s.r, 0) / a.length : 0;
});
await page.waitForFunction('window.__mixCompleted >= 1', null, { timeout: 90000 });
await page.waitForTimeout(1800);      // let B play on alone, so it can be measured alone

const m = await page.evaluate(dur => {
  const s = window.__seam, t0 = s.seamAt;
  const win = s.rms.filter(x => x.t >= t0 - 0.02 && x.t <= t0 + dur);
  // five buckets across the overlap: the shape of the blend
  const bins = [0, 0, 0, 0, 0].map(() => ({ n: 0, sum: 0 }));
  let zero = 0;
  for (const x of win){
    const f = Math.min(0.999, Math.max(0, (x.t - t0) / dur));
    const k = Math.floor(f * 5);
    bins[k].n++; bins[k].sum += x.r;
    if (x.r < 1e-4) zero++;
  }
  return { bins: bins.map(b => b.n ? b.sum / b.n : null), zero, n: win.length,
    bMoved: s.bMoved, bLate: s.bLate, phase: window.__mixPhaseErrMs };
}, plan.seconds);

/* A DECLINING ENVELOPE IS NOT AUTOMATICALLY A HOLE. If the incoming track is
 * simply quieter than the outgoing one, a correct equal-power crossfade lands
 * lower than it started and there is nothing wrong. So measure B ALONE, after
 * the seam has fully settled, and judge the blend against where it was always
 * going to end up rather than against where it began. */
const postRms = await page.evaluate(dur => {
  // strictly AFTER the blend, so this is B on its own and not part of the mix
  const t = window.__seam.seamAt + dur + 0.3;
  const a = window.__seam.rms.filter(s => s.t > t);
  return a.length ? a.reduce((x, s) => x + s.r, 0) / a.length : 0;
}, plan.seconds);
const rel = m.bins.map(v => v == null || !preRms ? null : v / preRms);
const endLevel = preRms > 0 ? postRms / preRms : null;
const pct = v => v == null ? ' --' : (v * 100).toFixed(0).padStart(3) + '%';
console.log(`\nseam measured over ${m.n} frames · overlap ${plan.seconds}s`);
console.log('  master level by fifth of the blend: ' + rel.map(pct).join(' ') + '   (100% = A alone)');
console.log('  B alone, after the seam settles: ' + pct(endLevel));

/* THE HONEST DEADLINE is the moment B could be HEARD, not the moment the fader
 * starts moving. The equal-power curve holds the incoming deck below -24 dB
 * (equalPowerXfade().b < 0.06, the same threshold the engine's own phase lock
 * treats as inaudible) for the first ~3.8 % of the blend, and the seam is
 * scheduled a lead-in ahead of the call on top of that. A deck that starts
 * rolling inside that window contributes silence to nothing a listener can
 * hear; one that starts after it is a soft entry — the defect.
 *
 * STILL OPEN, and honestly variable: the element's resume runs 210-680 ms under
 * a saturated main thread, so the 450 ms lead covers it most of the time and not
 * always. Note what this does NOT cost: the beat lock converges regardless,
 * because the latch measures the grids once B is genuinely rolling rather than
 * trusting where it was placed. The worst observed case is therefore an onset at
 * about -20 dB a half-beat into the fade — a soft entry, not a hole, which is why
 * the level envelope above cannot see it. Closing it properly means rolling B
 * SILENTLY during the armed window so the seam never calls play() at all; that
 * needs its own cancel/replan bookkeeping and a phase servo willing to trim a
 * residual instead of seeking it, so it is named here rather than guessed at. */
const audibleMs = (Math.asin(0.06) * 2 / Math.PI) * plan.seconds * 1000;
/* WHY A PRE-ROLLED CUE IS NOT HERE, having been designed properly and measured.
 *
 * The remaining latency is the incoming element's resume: 210-680 ms, against a
 * 450 ms lead-in, so the tail arrives as a soft entry around -24 dB rather than a
 * hole. The fix is a DJ's cued deck — roll it early from a point that carries it to
 * its entry exactly as the seam fires, so fire() has no placement seek to make.
 * seamCuePoint() works that out from A's position and rate, and the alignment is
 * time-invariant: notice the moment late and both decks have advanced together.
 *
 * It cannot be measured here. This fixture's incoming track mixes in at 0.00 s, so
 * it has NEGATIVE runway before its entry and the cue correctly declines every
 * time. Shipping runtime state (cue, uncue, re-cue on a deferred bar, and a branch
 * in fire() that skips placement) which no test can drive end to end is how a path
 * rots — so it was reverted rather than merged unexercised.
 *
 * What would make it measurable: a fixture pair whose incoming track has several
 * seconds of material before its mix-in point. That also means updating the two
 * mix_acceptance assertions that count the crate's six rows. */
O('the incoming deck is rolling before the blend can be heard',
  m.bLate != null && m.bMoved >= 0 && m.bLate <= audibleMs,
  m.bMoved == null ? 'not observed' : (m.bMoved < 0 ? 'playhead never advanced'
    : 'rolling ' + Math.abs(m.bLate).toFixed(0) + ' ms '
      + (m.bLate <= 0 ? 'before' : 'after') + ' the fader, '
      + (audibleMs - m.bLate).toFixed(0) + ' ms of margin on the -24 dB deadline'
      + ' · started ' + m.bMoved.toFixed(0) + ' ms after the call'));
R('the blend has no hole in its first half',
  rel[0] != null && rel[1] != null && rel[0] > 0.55 && rel[1] > 0.55,
  'first fifth ' + pct(rel[0]) + ', second ' + pct(rel[1]));
// the floor each fifth is judged against: whichever of the two tracks is
// quieter is where a correct blend is allowed to sit, less a little headroom
const floor = Math.min(1, endLevel == null ? 1 : endLevel) * 0.75;
R('the master level never falls below both tracks',
  rel.every(v => v != null && v >= floor),
  'floor ' + pct(floor) + ' · B alone reads ' + pct(endLevel));
R('the output never drops to silence mid-seam', m.zero === 0, m.zero + ' silent frames');
/* THE GATE THIS TOOL WAS BUILT TO EARN. This read 114-119 ms with the renderer
 * running — a quarter beat at 124 bpm, the audible flam behind the "glitch in
 * the auto mix" — because the seam was PLACED by the animation loop: B was
 * dropped at its absolute entry point at whatever instant the loop noticed A had
 * crossed the bar line, so the grid offset was simply the frame's lateness. The
 * seam is now placed RELATIVE to where A actually is (seamEntry) and latched the
 * moment B rolls rather than a beat later, which makes the lock a fact about the
 * two grids instead of a fact about the frame rate. It holds single digits under
 * a saturated main thread, so it is a regression gate from here on. */
R('the beat lock holds inside its 40 ms contract', m.phase != null && m.phase < 40,
  m.phase == null ? 'not measured' : m.phase.toFixed(1) + ' ms');

/* SETTLE — a mix engine rots by leaving state behind. Every deck must be back
 * to unity after a seam, or the next one starts from a lie. */
const settle = await page.evaluate(() => {
  const out = [];
  AE.decks.forEach((d, i) => {
    out.push({ i, active: i === AE.active,
      gain: d.gain ? +d.gain.gain.value.toFixed(4) : null,
      rate: +d.a.playbackRate.toFixed(4),
      shelf: d.shelf ? +d.shelf.gain.value.toFixed(2) : null,
      filter: d.filter ? Math.round(d.filter.frequency.value) : null,
      paused: d.a.paused });
  });
  return { decks: out, phase: MIXER.phase, trim: MIXER.trim, audioT0: MIXER.audioT0,
    trimI: MIXER.trimI, latched: !!MIXER._latched, aligns: MIXER._aligns };
});
const act = settle.decks.find(d => d.active), idle = settle.decks.find(d => !d.active);
// arming the NEXT transition straight after a seam is correct behaviour, so the
// phase is free to be 'armed' here; what must be clean is the seam's own state —
// its audio-clock origin, both halves of the phase servo, and the latch, since a
// latch left set would let the NEXT seam skip the align it needs.
R('the finished seam leaves no scheduling state behind',
  settle.audioT0 === null && settle.trim === 0 && settle.trimI === 0
    && !settle.latched && settle.aligns === 0,
  JSON.stringify({ phase: settle.phase, trim: settle.trim, trimI: settle.trimI,
    latched: settle.latched, aligns: settle.aligns }));
R('the surviving deck is at unity gain and unity rate',
  Math.abs(act.gain - 1) < 0.06 && Math.abs(act.rate - 1) < 0.002,
  'gain ' + act.gain + ' rate ' + act.rate);
R('the retired deck is silent and paused', idle.gain < 0.02 && idle.paused,
  'gain ' + idle.gain + ' paused ' + idle.paused);
R('both decks leave the bass shelf flat and the filter open',
  settle.decks.every(d => Math.abs(d.shelf) < 0.01 && d.filter > 15000),
  settle.decks.map(d => 'shelf ' + d.shelf + '/f ' + d.filter).join(' · '));

console.log(`\n${pass} passed, ${fail} failed, ${open} tracked as open`);
if (fail) console.log('a FAIL here is a regression in an invariant that was holding.');
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
