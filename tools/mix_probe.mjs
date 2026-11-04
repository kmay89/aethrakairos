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
 * AND THEN THE CUE. The lead-in covered B's resume most of the time and not
 * always: 210-680 ms against a lead capped by however much of B comes before
 * its downbeat. The second seam measured here is the fixture's runway pair
 * (alpha→tau), where B is pre-rolled silently through the armed window and
 * the seam is called on a deck already moving — measured, not assumed, along
 * with the two ways a cue is let go of (a cancel, a hand on the handle).
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
    // (the fallback check below makes a rolling cue read as STALLED the
    // instant the seam is called — no movement since its last read — once, so
    // fire() must let it go and take the placement path; B's bytes untouched)
    if (window.__knockCue && MIXER.cueing()){
      const c = MIXER._cue;
      c.lastB = c.d.a.currentTime; c.movedAt = 0;
      window.__knockCue = 0; window.__knocked = true;
    }
    fire(now);
    window.__seam.fired = { phase: MIXER.phase, type: MIXER.plan && MIXER.plan.type, deferred: MIXER.plan && MIXER.plan.deferred || 0, why: MIXER.plan && MIXER.plan.why };
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

/* THE CUE'S OWN WATCH. While a pre-rolled cue rolls (MIXER.cueing()), deck B
 * is an unpaused element under an armed plan, and the one promise that makes
 * that acceptable is that nobody can hear it and nothing takes it for the air:
 * both of its nodes — the mixer's gain and the crossfader's fader — at zero,
 * and AE.active never pointing at it. Sampled on a timer of its own, like
 * everything here, for the whole of every pre-roll. */
await page.evaluate(() => {
  window.__cueWatch = { n: 0, maxGain: 0, maxFader: 0, onAir: 0 };
  setInterval(() => {
    if (typeof MIXER === 'undefined' || !MIXER.cueing() || !AE.decks) return;
    const w = window.__cueWatch, d = MIXER._cue.d;
    w.n++;
    w.maxGain = Math.max(w.maxGain, d.gain.gain.value);
    w.maxFader = Math.max(w.maxFader, d.fader.gain.value);
    if (AE.decks.indexOf(d) === AE.active) w.onAir++;
    // what it rolled on: the record seated from memory (MIXER._seat), or the stream warm
    w.seated = !!(d.a._warmSrc && d.a.src === d.a._warmSrc);
  }, 10);
});

/* THE TRANSPORT'S WORD, watched. Through a seam the player must never say it
 * is paused, and nothing may log a pause the system did not make — a deck
 * paused and started again in one task hears its 'pause' late (see the deck
 * wiring), which is exactly what a cue let go at fire() does. */
await page.evaluate(() => {
  window.__flips = 0; window.__sysPauses = 0;
  setInterval(() => { if ((MIXER.phase === 'running' || MIXER.phase === 'armed') && !player.playing) window.__flips++; }, 5);
  if (typeof ACTIVITY !== 'undefined'){
    const log = ACTIVITY.log.bind(ACTIVITY);
    ACTIVITY.log = (kind, ...rest) => { if (kind === 'system') window.__sysPauses++; return log(kind, ...rest); };
  }
});

/* ONE SEAM, MEASURED. alpha into `title`, found by name rather than by queue
 * position (the shuffle bag is free to reorder), with A jumped to `before`
 * seconds short of its bar line so the probe does not sit through a whole
 * track. Returns everything the gates below read. */
async function measureSeam(title, before, warmFirst){
  const base = await page.evaluate(() => {
    Object.assign(window.__seam, { seamAt: null, bAtSeam: null, bMoved: null, bLate: null });
    Object.assign(window.__cueWatch, { n: 0, maxGain: 0, maxFader: 0, onAir: 0 });
    return { done: window.__mixCompleted || 0, cued: window.__mixCued || 0, flips: window.__flips, sys: window.__sysPauses };
  });
  const started = await page.evaluate(t => {
    const i = player.tracks.findIndex(x => x.title === 'alpha');
    const j = player.tracks.findIndex(x => x.title === t);
    if (i < 0 || j < 0) return null;
    player.repeat = 'off'; player.shuffle = false;
    player._committedNext = j;
    player.playIndex(i);
    return { i, j };
  }, title);
  if (!started) return null;
  await page.waitForFunction('MIXER.phase === "armed"', null, { timeout: 40000 });
  const readPlan = () => page.evaluate(() => ({ ...MIXER.plan, next: player.tracks[MIXER.next] && player.tracks[MIXER.next].title }));
  let plan = await readPlan();
  if (plan.next !== title){
    // the draw picked another track; re-arm explicitly onto the pair under test
    await page.evaluate(t => {
      MIXER.cancel('probe');
      const j = player.tracks.findIndex(x => x.title === t);
      player._committedNext = j;
      player.pickNext = () => j;
      MIXER.arm();
    }, title);
    await page.waitForFunction('MIXER.phase === "armed"', null, { timeout: 20000 });
    plan = await readPlan();
  }
  console.log(`\nplan: ${plan.type} -> ${plan.next} · ${plan.beats} beats · ${plan.keys}`
    + ` · ${plan.seconds}s · ${plan.bpmA}->${plan.bpmB} bpm`
    + ` · startA ${plan.startA && plan.startA.toFixed(2)}s startB ${plan.startB && plan.startB.toFixed(2)}s`);
  /* warmFirst: let the warm land before A is jumped to the seam, as it does in
   * a set (the arm comes ninety seconds early, A finishes buffering, B's record
   * is fetched into memory and seated) — jumped at once, the warm's first look
   * is already inside the exit backstop and it streams instead. Both are real;
   * the cued seam takes the first, the fallback and the let-go checks the second. */
  if (warmFirst) await page.waitForFunction('AE.decks[1 - AE.active]._warmed && !AE.decks[1 - AE.active]._preloadOnce', null, { timeout: 20000 }).catch(() => {});
  // where the arm parked the incoming deck: a cue's park, or the old lead-in park
  const park = await page.evaluate(() => { const nd = AE.decks[1 - AE.active]; return { cueAt: nd._cueAt, seekTo: nd._seekTo }; });
  await page.evaluate(b => {
    const d = AE.decks[AE.active];
    try { d.a.currentTime = Math.max(0, MIXER.plan.startA - b); } catch (e){}
  }, before);
  await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 60000 });
  const preRms = await page.evaluate(() => {
    const a = window.__seam.rms.filter(s => s.t < window.__seam.seamAt && s.t > window.__seam.seamAt - 1.2);
    return a.length ? a.reduce((x, s) => x + s.r, 0) / a.length : 0;
  });
  await page.waitForFunction(n => (window.__mixCompleted || 0) > n, base.done, { timeout: 90000 });
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
      bMoved: s.bMoved, bLate: s.bLate, phase: window.__mixPhaseErrMs, fired: s.fired };
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
  const cue = await page.evaluate(b => ({ cued: (window.__mixCued || 0) - b.cued, fired: MIXER._cueFired || null,
    watch: Object.assign({}, window.__cueWatch), lat: MIXER._cueLat, uncued: window.__mixUncued || null,
    flips: window.__flips - b.flips, sys: window.__sysPauses - b.sys }), base);
  const rel = m.bins.map(v => v == null || !preRms ? null : v / preRms);
  const endLevel = preRms > 0 ? postRms / preRms : null;
  console.log(`seam measured over ${m.n} frames · overlap ${plan.seconds}s` + (m.fired ? ` · fired as ${m.fired.type}${m.fired.deferred ? ' after ' + m.fired.deferred + ' deferred bar(s)' : ''}${m.fired.why ? ' (' + m.fired.why + ')' : ''}` : ''));
  console.log('  master level by fifth of the blend: ' + rel.map(pct).join(' ') + '   (100% = A alone)');
  console.log('  B alone, after the seam settles: ' + pct(endLevel));
  /* THE HONEST DEADLINE is the moment B could be HEARD, not the moment the fader
   * starts moving. The equal-power curve holds the incoming deck below -24 dB
   * (equalPowerXfade().b < 0.06, the same threshold the engine's own phase lock
   * treats as inaudible) for the first ~3.8 % of the blend, and the seam is
   * scheduled a lead-in ahead of the call on top of that. A deck that starts
   * rolling inside that window contributes silence to nothing a listener can
   * hear; one that starts after it is a soft entry — the defect. */
  const audibleMs = (Math.asin(0.06) * 2 / Math.PI) * plan.seconds * 1000;
  return { plan, park, m, rel, endLevel, cue, audibleMs };
}
const pct = v => v == null ? ' --' : (v * 100).toFixed(0).padStart(3) + '%';
const rollWord = (s, cued) => s.m.bMoved == null ? 'not observed' : (s.m.bMoved < 0 ? 'playhead never advanced'
  : 'rolling ' + Math.abs(s.m.bLate).toFixed(0) + ' ms ' + (s.m.bLate <= 0 ? 'before' : 'after') + ' the fader, '
    + (s.audibleMs - s.m.bLate).toFixed(0) + ' ms of margin on the -24 dB deadline'
    + (cued ? ' · already rolling at the call, pre-rolled ' + s.cue.fired.rolledMs + ' ms before it'
            : ' · started ' + s.m.bMoved.toFixed(0) + ' ms after the call'));
const rolledInTime = s => s.m.bLate != null && s.m.bMoved >= 0 && s.m.bLate <= s.audibleMs;
// the blend's shape: no hole in the first half, never under the quieter track, never silent
function blendGates(s, tag){
  R(tag + 'the blend has no hole in its first half',
    s.rel[0] != null && s.rel[1] != null && s.rel[0] > 0.55 && s.rel[1] > 0.55,
    'first fifth ' + pct(s.rel[0]) + ', second ' + pct(s.rel[1]));
  // the floor each fifth is judged against: whichever of the two tracks is
  // quieter is where a correct blend is allowed to sit, less a little headroom
  const floor = Math.min(1, s.endLevel == null ? 1 : s.endLevel) * 0.75;
  R(tag + 'the master level never falls below both tracks',
    s.rel.every(v => v != null && v >= floor),
    'floor ' + pct(floor) + ' · B alone reads ' + pct(s.endLevel));
  R(tag + 'the output never drops to silence mid-seam', s.m.zero === 0, s.m.zero + ' silent frames');
}

// ---- SEAM 1 · alpha → beta: the pair with NO runway (beta enters 0.50 s in)
const s1 = await measureSeam('beta', 3);
if (!s1){ console.log('fixture is missing alpha/beta — rebuild it'); await browser.close(); server.close(); process.exit(1); }

/* WITH NO RUNWAY THE OLD PATH STANDS, and it is still honestly variable. The
 * element's resume runs 210-680 ms under a saturated main thread, and beta's
 * lead-in is capped at the half second it has before its downbeat, so the
 * lead covers it most of the time and not always. Note what this does NOT
 * cost: the beat lock converges regardless, because the latch measures the
 * grids once B is genuinely rolling rather than trusting where it was placed.
 * The worst observed case is an onset at about -20 dB a half-beat into the
 * fade — a soft entry, not a hole, which is why the level envelope cannot see
 * it. The cued deck below closes it wherever the incoming record has material
 * before its entry; a record that enters on its first downbeat has nothing to
 * pre-roll from, so this stays a number with a name. */
R('no runway, no cue: beta enters at its first downbeat and keeps the old park',
  s1.park.cueAt == null && s1.cue.cued === 0, 'park ' + (s1.park.seekTo != null ? s1.park.seekTo.toFixed(2) : '--') + ' s · cued ' + s1.cue.cued);
O('with no runway, the incoming deck is rolling before the blend can be heard', rolledInTime(s1), rollWord(s1, false));
blendGates(s1, '');
/* THE GATE THIS TOOL WAS BUILT TO EARN. This read 114-119 ms with the renderer
 * running — a quarter beat at 124 bpm, the audible flam behind the "glitch in
 * the auto mix" — because the seam was PLACED by the animation loop: B was
 * dropped at its absolute entry point at whatever instant the loop noticed A had
 * crossed the bar line, so the grid offset was simply the frame's lateness. The
 * seam is now placed RELATIVE to where A actually is (seamEntry) and latched the
 * moment B rolls rather than a beat later, which makes the lock a fact about the
 * two grids instead of a fact about the frame rate. It holds single digits under
 * a saturated main thread, so it is a regression gate from here on. */
R('the beat lock holds inside its 40 ms contract', s1.m.phase != null && s1.m.phase < 40,
  s1.m.phase == null ? 'not measured' : s1.m.phase.toFixed(1) + ' ms');

/* SETTLE — a mix engine rots by leaving state behind. Every deck must be back
 * to unity after a seam, or the next one starts from a lie. */
const readSettle = () => page.evaluate(() => {
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
    trimI: MIXER.trimI, latched: !!MIXER._latched, aligns: MIXER._aligns,
    // the loudness trim the record on air is owed — what playIndex() would give it
    want: normLin(player.tracks[player.cur]) };
});
function settleGates(settle, tag){
  const act = settle.decks.find(d => d.active), idle = settle.decks.find(d => !d.active);
  // arming the NEXT transition straight after a seam is correct behaviour, so the
  // phase is free to be 'armed' here; what must be clean is the seam's own state —
  // its audio-clock origin, both halves of the phase servo, and the latch, since a
  // latch left set would let the NEXT seam skip the align it needs.
  R(tag + 'the finished seam leaves no scheduling state behind',
    settle.audioT0 === null && settle.trim === 0 && settle.trimI === 0
      && !settle.latched && settle.aligns === 0,
    JSON.stringify({ phase: settle.phase, trim: settle.trim, trimI: settle.trimI,
      latched: settle.latched, aligns: settle.aligns }));
  /* "unity" is the record's OWN loudness trim, not 1.0: an auto-mixed record
     used to arrive on a deck whose trim nobody set, so it sat at 1.0 (or at
     the last record's trim) and this check, written against 1.0, held only
     because of that. The fixture's records are trimmed +6 dB. */
  R(tag + 'the surviving deck is at its record\'s trim and unity rate',
    Math.abs(act.gain - settle.want) < 0.06 * settle.want && Math.abs(act.rate - 1) < 0.002,
    'gain ' + act.gain + ' (owed ' + (+settle.want.toFixed(4)) + ') rate ' + act.rate);
  R(tag + 'the retired deck is silent and paused', idle.gain < 0.02 && idle.paused,
    'gain ' + idle.gain + ' paused ' + idle.paused);
  R(tag + 'both decks leave the bass shelf flat and the filter open',
    settle.decks.every(d => Math.abs(d.shelf) < 0.01 && d.filter > 15000),
    settle.decks.map(d => 'shelf ' + d.shelf + '/f ' + d.filter).join(' · '));
}
/* THE WAY HOME. The blend holds the record on air at its own tempo and pitches
 * the incoming to it (glideRates: rateA is 1 at every f); once alone on air the
 * incoming glides home to its own tempo at ten cents a second (seamHomeRate).
 * So the surviving deck is not at unity the instant the seam finishes — it is
 * on its way, and must land within its walking time, moving one way only. The
 * settle gates below read the deck once it is home. */
async function walkHome(tag){
  const t0 = Date.now(), rates = [];
  let st, secs = null;
  for (;;){
    st = await page.evaluate(() => {
      const d = AE.decks[AE.active], h = MIXER._home;
      return { rate: +d.a.playbackRate.toFixed(5), home: !!h, secs: h ? +h.secs.toFixed(2) : null, from: h ? +h.from.toFixed(5) : null };
    });
    if (st.home && secs == null) secs = st.secs;
    rates.push(st.rate);
    if (!st.home || Date.now() - t0 > 15000) break;
    await page.waitForTimeout(100);
  }
  const took = (Date.now() - t0) / 1000;
  const dir = Math.sign(rates[rates.length - 1] - rates[0]);
  const oneWay = rates.every((r, i) => i === 0 || r === rates[i - 1] || Math.sign(r - rates[i - 1]) === dir);
  const landed = !st.home && Math.abs(rates[rates.length - 1] - 1) < 0.002;
  const inTime = secs == null || took <= secs + 1.5;
  R(tag + 'the incoming record comes home at a walking pace — one way, in its own time, to its own tempo',
    landed && oneWay && inTime,
    (secs == null ? 'already home' : 'from ' + rates[0] + ' over ' + secs + ' s') + ' · took ' + took.toFixed(1) + ' s · ' + rates.length + ' reads · landed ' + rates[rates.length - 1]);
}
await walkHome('');
settleGates(await readSettle(), '');

/* THE ROOM CHANGED HANDS WITH THE MUSIC. The seam cues the visual director on
   the audio clock (seamSceneCue); with the director automatic, exactly one
   scene change must have landed at the cue — not a frame's worth late, and not
   on the dwell clock a few bars later. */
const room = await page.evaluate(() => ({ n: window.__mb8SeamScene || 0, late: window.__mb8SeamSceneLate, waited: window.__mb8SeamSceneWaited,
  auto: director.auto, kind: SEGUE.lastKind, cue: window.__mb8SeamCue, pending: SEGUE.seam, transT: director.transT }));
R('the room changed hands with the music — the seam cued one scene change', room.auto && room.n >= 1,
  `auto=${room.auto} changes=${room.n} kind=${room.kind}` + (room.n ? '' : ' · cue ' + JSON.stringify(room.cue) + ' pending ' + JSON.stringify(room.pending) + ' transT ' + room.transT));
// a crossfade still running when the cue lands is let finish first; on this
// renderer that can be seconds, and is reported rather than failed
R('…and it landed on the cue, not on the dwell clock', room.late != null && room.late >= 0 && (room.late < 0.25 || room.waited),
  room.late == null ? 'no cue landed' : `${(room.late * 1000).toFixed(0)} ms past the cue` + (room.waited ? ' (a crossfade was still running at the cue)' : ''));

// ---- SEAM 2 · alpha → tau: the pair WITH runway — the cued deck
/* THE PRE-ROLLED CUE, measured end to end. tau has a DJ's intro and the
 * fixture's canon pair fix enters it on its first kick, sixteen beats in, so B
 * has seconds of material before its entry (make_mix_fixture). The arm parks
 * B a pre-roll short of where the seam will need it; the cue lets it go
 * silently while the seam is armed, steers it onto the grid by tempo, and
 * fire() finds it rolling: no placement seek, no play(). A is jumped far
 * enough back that the cue rolls on its own clock, as it would in a set.
 *
 * WHAT IT FOUND. Before the cue this item read, renderer running, "rolling 89
 * ms after the fader · started 580 ms after the call" on the zero-runway pair
 * — the resume landing inside the blend. With a cue the deck is already moving
 * when the seam is called, the call has nothing to start, and the margin is
 * the whole lead-in plus the -24 dB window, on every run, under either renderer
 * condition. That is why it is a gate now rather than a number with a name. */
const cueConst = await page.evaluate(() => ({ win: SEAM_CUE_S, tol: SEAM_CUE_TOL }));
const lead2 = await page.evaluate(() => {
  const i = player.tracks.findIndex(x => x.title === 'tau');
  return i >= 0 ? BEATMIX_LEAD : null;
});
if (lead2 == null){ console.log('fixture is missing tau (the cued deck\'s runway pair) — rebuild it'); await browser.close(); server.close(); process.exit(1); }
const s2 = await measureSeam('tau', lead2 + cueConst.win + 3, true);
const f2 = s2.cue.fired;
R('the runway pair parks B a pre-roll short of its entry (seamCuePoint)',
  s2.plan.type === 'beatmix' && s2.plan.startB > 5 && s2.park.cueAt != null && Math.abs(s2.park.seekTo - s2.park.cueAt) < 1e-9
    && s2.park.cueAt < s2.plan.startB - lead2,
  'startB ' + (s2.plan.startB || 0).toFixed(2) + ' s · parked at ' + (s2.park.cueAt != null ? s2.park.cueAt.toFixed(2) : '--') + ' s');
// (a handful of samples is enough to be honest about: under the renderer the
// probe's own timers land a dozen times in three seconds, not three hundred)
R('…rolled it SILENT: both of B\'s nodes at zero, never on air, for the whole pre-roll',
  s2.cue.watch.n >= 5 && s2.cue.watch.maxGain < 1e-3 && s2.cue.watch.maxFader < 1e-3 && s2.cue.watch.onAir === 0,
  `${s2.cue.watch.n} samples · max gain ${s2.cue.watch.maxGain.toExponential(1)} · max fader ${s2.cue.watch.maxFader.toExponential(1)} · on air ${s2.cue.watch.onAir}`);
R('…and the seam fired ON the cue: no placement seek, no play(), B on the grid',
  s2.cue.cued === 1 && f2 && isFinite(f2.err) && Math.abs(f2.err) <= cueConst.tol,
  f2 ? `${(f2.err * 1000).toFixed(1)} ms off the grid at fire · pre-rolled ${f2.rolledMs} ms · ${f2.seeks} seeks · play() latency learned ${(s2.cue.lat * 1000).toFixed(0)} ms · rolled on ${s2.cue.watch.seated ? 'the copy seated from memory' : 'the stream warm'}`
     : 'the seam took the placement path' + (s2.cue.uncued ? ' (last let go: ' + s2.cue.uncued + ')' : ''));
R('the incoming deck is rolling before the blend can be heard', rolledInTime(s2) && s2.cue.cued === 1, rollWord(s2, !!f2));
blendGates(s2, 'cued: ');
R('cued: the beat lock holds inside its 40 ms contract', s2.m.phase != null && s2.m.phase < 40,
  s2.m.phase == null ? 'not measured' : s2.m.phase.toFixed(1) + ' ms');
await walkHome('cued: ');
settleGates(await readSettle(), 'cued: ');
const left2 = await page.evaluate(() => ({ cue: !!MIXER._cue, poll: !!MIXER._cueT }));
R('cued: nothing of the cue outlives the seam', !left2.cue && !left2.poll, JSON.stringify(left2));

/* A CUE THAT DOES NOT HOLD IS NOT A SECOND WAY FOR A SEAM TO GO WRONG. The
 * rolling cue is made to read as stalled the instant fire() looks at it, so
 * the seam must let it go and place B exactly as it always has: paused,
 * seeked, play(). The transport must not blink on the way (the deck's late
 * 'pause' is stale by then), and the lock must hold. */
await page.evaluate(() => { window.__knockCue = true; window.__knocked = false; MIXER._cueFired = null; });
const s3 = await measureSeam('tau', lead2 + cueConst.win + 3);
const knocked = await page.evaluate(() => { const k = window.__knocked; window.__knockCue = false; return k; });
// (under a saturated renderer the stream-warmed cue can miss its own window and
// never roll; then the seam was placed the old way with nothing to let go of,
// which is the same path, and is said so rather than scored as a cue)
R('a cue that reads as stalled at fire: let go, and the seam placed B the old way',
  s3.cue.cued === 0 && (!knocked || s3.cue.uncued === 'missed at fire') && s3.m.fired && s3.m.fired.type === 'beatmix' && s3.m.bMoved != null && s3.m.bMoved >= 0,
  (knocked ? 'let go: ' + s3.cue.uncued : 'no cue rolled in time under this load: placed the old way') + ' · ' + rollWord(s3, false));
R('…the transport never blinked: no paused frame, no pause the system did not make',
  s1.cue.flips + s2.cue.flips + s3.cue.flips === 0 && s1.cue.sys + s2.cue.sys + s3.cue.sys === 0,
  `paused frames ${s1.cue.flips}/${s2.cue.flips}/${s3.cue.flips} · system pauses logged ${s1.cue.sys}/${s2.cue.sys}/${s3.cue.sys} (seams 1/2/3)`);
R('fallback: the beat lock holds inside its 40 ms contract', s3.m.phase != null && s3.m.phase < 40,
  s3.m.phase == null ? 'not measured' : s3.m.phase.toFixed(1) + ' ms');
// silence is only "none" over a blend that was actually heard: every fifth must hold samples
R('fallback: the blend never drops to silence mid-seam',
  s3.m.n > 0 && s3.rel.every(v => v != null) && s3.m.zero === 0,
  s3.m.zero + ' silent frames over ' + s3.m.n + ' · fifths ' + s3.rel.map(pct).join(' ')
    + (s3.rel.some(v => v == null) ? ' — not measured: a fifth has no samples' : ''));

/* THE CUE LET GO OF. A cue is an optimisation; the deck under it must come
 * back exactly as the paused, parked deck everything else has always met —
 * when the plan is dropped (MIX switched off: one of cancel()'s reasons, all of
 * which take the same road) and when a hand lands on the handle. Each is done
 * while the cue is genuinely rolling, and read in the same task. */
async function whileCued(action){
  // under a saturated renderer a cue can be let go before the probe catches it
  // rolling (the reason is in the result); the scenario is tried up to three times
  let r;
  for (let k = 0; k < 3; k++){ r = await whileCuedOnce(action); if (r.rolled) return Object.assign(r, { tries: k + 1 }); }
  return r;
}
async function whileCuedOnce(action){
  await page.evaluate(() => {
    const i = player.tracks.findIndex(x => x.title === 'alpha'), j = player.tracks.findIndex(x => x.title === 'tau');
    MIXER.setOn(true);
    player._committedNext = j; player.pickNext = () => j;
    player.playIndex(i);
  });
  await page.waitForFunction('MIXER.phase === "armed" && player.tracks[MIXER.next] && player.tracks[MIXER.next].title === "tau"', null, { timeout: 40000 });
  // the warm let land first, as the cued seam did, so the scenario is about the let-go and not the warm's timing
  await page.waitForFunction('AE.decks[1 - AE.active]._warmed && !AE.decks[1 - AE.active]._preloadOnce', null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(b => { const d = AE.decks[AE.active]; try { d.a.currentTime = Math.max(0, MIXER.plan.startA - b); } catch (e){} },
    lead2 + cueConst.win + 3);
  // polled on a timer, not the frame: under the renderer a frame can be most of a second
  const rolled = await page.waitForFunction('MIXER.cueing() && MIXER._cue.moved', null, { timeout: 20000, polling: 15 }).then(() => true, () => false);
  if (!rolled) return Object.assign({ rolled }, await page.evaluate(() => ({ phase: MIXER.phase, done: MIXER._cueDone, rolls: MIXER._cueRolls,
    uncued: window.__mixUncued || null, cuedSeams: window.__mixCued || 0, toBar: MIXER.plan ? +(MIXER.plan.startA - activeDeck().a.currentTime).toFixed(2) : null })));
  return Object.assign({ rolled }, await page.evaluate(act => {
    const nd = MIXER._cue.d, i = AE.decks.indexOf(nd), od = AE.decks[AE.active];
    if (act === 'off') MIXER.setOn(false); else DECKS.faderGrab(DECKS.fader.x);
    const r = { cueing: MIXER.cueing(), paused: nd.a.paused, at: nd.a.currentTime, park: nd._seekTo,
      rate: nd.a.playbackRate, want: SPEED.rate * DECKS.pitch(i), gain: nd.gain.gain.value, fader: nd.fader.gain.value,
      phase: MIXER.phase, aPlaying: !od.a.paused && player.playing, active: AE.decks[AE.active] === od };
    if (act !== 'off') DECKS.faderRelease();                // the hand lets go at home: nothing decided
    return r;
  }, action));
}
const off = await whileCued('off');
R('a cancel while the cue rolls: B stopped, parked again where the warm left it, at its own rate, silent — the air untouched',
  off.rolled && !off.cueing && off.paused && Math.abs(off.at - off.park) < 0.06 && Math.abs(off.rate - off.want) < 1e-6
    && off.gain < 1e-3 && off.fader < 0.02 && off.phase === 'idle' && off.aPlaying && off.active,
  JSON.stringify(off));
const hand = await whileCued('hand');
R('a hand on the handle while the cue rolls: parked on the instant, exactly the deck a hand always met',
  hand.rolled && !hand.cueing && hand.paused && Math.abs(hand.at - hand.park) < 0.06 && Math.abs(hand.rate - hand.want) < 1e-6
    && hand.gain < 1e-3 && hand.aPlaying && hand.active,
  JSON.stringify(hand));

console.log(`\n${pass} passed, ${fail} failed, ${open} tracked as open`);
if (fail) console.log('a FAIL here is a regression in an invariant that was holding.');
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
