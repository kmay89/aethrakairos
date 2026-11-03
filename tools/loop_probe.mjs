/* LOOP PROBE — is the loop actually seamless, or does it just say so?
 *
 * The booth's loop arithmetic is unit-tested to death and always was; that was
 * never the problem. The problem was a SEEK: once per cycle the old loop wrote
 * currentTime back to the in-point, and a media element asked to jump takes a
 * moment to have audio again. Nothing in a unit test can see that, because the
 * arithmetic it produces is perfect. You have to listen.
 *
 * AND LISTEN TO THE SPEAKER, NOT TO THE CODE. The first seamless loop was a
 * tape on the master bus whose blocks went through the main thread; this probe
 * inspected the buffer it cut and found the join perfect, while under a busy
 * renderer the cut itself was taken 130–150 ms off its in-point and the room
 * heard a splice on every lap. So nothing here is read off the loop's own state
 * where the output can answer instead. The output is recorded by an AudioWorklet
 * on AE.out — frames stamped on the audio thread, messages queued rather than
 * dropped, so the recorder has no seams of its own — and measured:
 *
 *   seeks          how many times the playhead was written to while a loop was
 *                  held. The re-seek path does this every cycle. The deck's tape
 *                  must do it exactly zero times — the one number that cannot be
 *                  argued with.
 *   laps           every lap after the handover against the lap before it,
 *                  sample for sample. A loop that holds the music is a signal
 *                  that repeats exactly; a re-seek loop never does.
 *   steps, holes   the largest sample-to-sample step against the music's own
 *                  99.99th percentile, and runs of near-silence: a splice is a
 *                  step far outside the music's distribution, a decoder
 *                  re-priming is a hole.
 *   the strip      a loop lives at the head of its deck's strip now, so the
 *                  deck's filter must reach it, and nothing on the bus — the
 *                  other deck, the echo — may be taken away by it.
 *   the handback   letting go of a latched loop lands the deck where the loop
 *                  was; the music after the handback is compared with the lap
 *                  before it, and how far apart they sit is the landing error.
 *
 * And the two paths are measured on the SAME music with the SAME loop, because
 * a click you cannot compare to anything is a number, not a finding.
 *
 *   node tools/loop_probe.mjs
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

const browser = await chromium.launch({ executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'] });

let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};

/* A SMALL WINDOW, ON PURPOSE. The visuals are not under test; the audio is, and
   a software rasteriser filling a big canvas starves the one main thread that
   the handback and the probe's own bookkeeping share. */
const ctx = await browser.newContext({ viewport: { width: 240, height: 180 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });

/* THE MUSIC. The shipped demo loop: eight bars at 124 BPM, kick, hats, claps and
   arps, built in an OfflineAudioContext by the app's own synthesizer. Real
   audio, identical on every run, and no file has to be fetched from anywhere. */
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
if (!live){ console.log('\n  cannot measure a loop with nothing playing'); await browser.close(); server.close(); process.exit(1); }
// the tapes are seated with the platters, once the worklet module has loaded
await page.waitForFunction('AE.decks.every(d => d.tape)', null, { timeout: 15000 }).catch(() => {});

/* THE INSTRUMENTS.
   · every write to the playhead is counted, by shadowing the element's own
     accessor — a seek that happens is a seek that shows up, wherever it came from
   · the finished mix is recorded on the audio thread, so what is measured is what
     a listener would have heard rather than what the code believes it did */
await page.evaluate(async () => {
  window.__seeks = 0;
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  for (const d of AE.decks) Object.defineProperty(d.a, 'currentTime', {
    configurable: true,
    get(){ return desc.get.call(this); },
    set(v){ window.__seeks++; desc.set.call(this, v); },
  });
  const src = `class ProbeEar extends AudioWorkletProcessor {
    constructor(){ super(); this.on = false; this.buf = new Float32Array(1024); this.n = 0; this.f = 0;
      this.port.onmessage = e => { this.on = !!e.data; if (!this.on && this.n){ this.port.postMessage({ f: this.f, x: this.buf.slice(0, this.n) }); this.n = 0; } }; }
    process(inputs){
      if (!this.on) return true;
      const ch = inputs[0] && inputs[0][0];
      for (let i = 0; i < 128; i++){
        if (this.n === 0) this.f = currentFrame + i;
        this.buf[this.n++] = ch ? ch[i] : 0;
        if (this.n === 1024){ this.port.postMessage({ f: this.f, x: this.buf }); this.buf = new Float32Array(1024); this.n = 0; }
      }
      return true;
    }
  }
  registerProcessor('probe-ear', ProbeEar);`;
  await AE.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  const ear = new AudioWorkletNode(AE.ctx, 'probe-ear', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
  AE.out.connect(ear);
  const chunks = [];
  ear.port.onmessage = e => chunks.push(e.data);
  window.frameNow = () => Math.round(AE.ctx.currentTime * AE.ctx.sampleRate);
  window.recStart = () => { chunks.length = 0; ear.port.postMessage(true); };
  window.recStop = () => new Promise(res => { ear.port.postMessage(false); setTimeout(() => {
    const ch = chunks.slice().sort((p, q) => p.f - q.f);
    if (!ch.length) return res(null);
    const f0 = ch[0].f, last = ch[ch.length - 1];
    const x = new Float32Array(last.f + last.x.length - f0);
    let gaps = 0, want = f0;
    for (const c of ch){ if (c.f !== want) gaps++; x.set(c.x, c.f - f0); want = c.f + c.x.length; }
    window.__rec = { f0, x, gaps };
    res({ f0, n: x.length, gaps });
  }, 400); });
  /* THE MEASURES, all on the last recording, between context frames a and b.
     A SPLICE is a step far outside the music's own distribution of steps; a
     HOLE is 5 ms or more with nothing in it; a LOOP is a signal that repeats
     every n frames. */
  const span = (a, b) => { const r = window.__rec; return [Math.max(1, a - r.f0), Math.min(r.x.length, b - r.f0)]; };
  window.measure = (a, b, n) => {
    const r = window.__rec, x = r.x, [i0, i1] = span(a, b), sr = AE.ctx.sampleRate;
    const steps = [];
    let worst = 0, rms = 0, peak = 0;
    for (let i = i0; i < i1; i++){ const s = Math.abs(x[i] - x[i - 1]); steps.push(s); if (s > worst) worst = s; rms += x[i] * x[i]; peak = Math.max(peak, Math.abs(x[i])); }
    rms = Math.sqrt(rms / Math.max(1, i1 - i0));
    const sorted = Float32Array.from(steps).sort();
    const p9999 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.9999 * sorted.length))] : 0;
    let holes = 0, run = 0; const w = Math.round(0.005 * sr);
    for (let i = i0; i < i1; i++){ if (Math.abs(x[i]) < 1e-4){ if (++run === w) holes++; } else run = 0; }
    let lap = null;
    // (a stretch shorter than two loops compares nothing, and reads as no answer at all — never as a perfect one)
    if (n > 0){ let d = 0; for (let i = i0 + n; i < i1; i++) d = Math.max(d, Math.abs(x[i] - x[i - n])); lap = i1 - i0 < 2 * n ? NaN : peak > 0 ? d / peak : 1; }
    return { sec: (i1 - i0) / sr, rms, peak, worst, p9999, holes, lap, gaps: r.gaps };
  };
  // the music's energy in one narrow band (Goertzel), and its high end (a first difference)
  window.tone = (a, b, hz) => {
    const x = window.__rec.x, [i0, i1] = span(a, b), k = 2 * Math.cos(2 * Math.PI * hz / AE.ctx.sampleRate);
    let s1 = 0, s2 = 0;
    for (let i = i0; i < i1; i++){ const s = x[i] + k * s1 - s2; s2 = s1; s1 = s; }
    return (s1 * s1 + s2 * s2 - k * s1 * s2) / Math.max(1, (i1 - i0) * (i1 - i0));
  };
  window.bright = (a, b) => { const x = window.__rec.x, [i0, i1] = span(a, b); let e = 0; for (let i = i0; i < i1; i++){ const d = x[i] - x[i - 1]; e += d * d; } return e / Math.max(1, i1 - i0); };
  /* WHERE THE MUSIC AFTER A HANDBACK SITS against the lap it continues: the
     stretch from `a` is slid across the same stretch one loop earlier, and the
     lag that matches best is how far from the loop's own place the deck came back. */
  window.landing = (a, w, n, maxLag) => {
    const x = window.__rec.x, i = a - window.__rec.f0;
    if (!(i - n - maxLag >= 0) || i + w + maxLag > x.length) return null;   // outside the recording is not a perfect landing
    let best = 0, bestE = Infinity, norm = 0;
    for (let j = 0; j < w; j++) norm += x[i + j] * x[i + j];
    for (let lag = -maxLag; lag <= maxLag; lag++){
      let e = 0;
      for (let j = 0; j < w; j++){ const d = x[i + j] - x[i - n + lag + j]; e += d * d; }
      if (e < bestE){ bestE = e; best = lag; }
    }
    return { lag: best, fit: norm > 0 ? bestE / norm : 1 };
  };
});

/* AND THE SAME GRID. The beat analyser is still settling on this track and
   reports a different tempo every few seconds, so without pinning it two runs
   cut two different bars of two different lengths and the comparison says
   nothing. Redefined rather than assigned, because the analyser writes to it on
   every frame. */
await page.evaluate(() => {
  Object.defineProperty(CLOCK, 'bpm', { get(){ return 120; }, set(){}, configurable: true });
  Object.defineProperty(CLOCK, 'grid', { get(){ return 0; }, set(){}, configurable: true });
  Object.defineProperty(CLOCK, 'haveGrid', { get(){ return true; }, set(){}, configurable: true });
  LOOPER.__ok = LOOPER.ok;
});

const LOOP_BEATS = 2;
// THE SAME BAR, BOTH TIMES: the deck is put back to the same place before each run
const reset = async () => {
  await page.evaluate(() => { FX.clearLoop(); LOOPER.cancel(); activeDeck().a.currentTime = 1.0; });
  await page.waitForTimeout(700);
};
const measureLoop = async legacy => {
  await reset();
  const setup = await page.evaluate(({ legacy, beats }) => {
    LOOPER.ok = legacy ? () => false : LOOPER.__ok;
    window.recStart();
    FX.setLoop(beats, false);
    const d = activeDeck(), sr = AE.ctx.sampleRate, rate = d.a.playbackRate || 1;
    return { len: FX.loop ? FX.loop.len : 0, rate, sr, taped: LOOPER.engaged(), N: LOOPER.engaged() ? LOOPER.N : Math.round(FX.loop.len / rate * sr) };
  }, { legacy, beats: LOOP_BEATS });
  /* WAIT FOR THE HANDOVER RATHER THAN GUESSING AT IT: the out-point of the first
     pass, which the tape takes by itself. Everything measured below is measured
     from a whole lap after it. */
  if (!legacy) await page.waitForFunction('LOOPER.on', null, { timeout: 8000 }).catch(() => {});
  else await page.waitForTimeout(Math.round(setup.len * 1000) + 900);
  await page.waitForTimeout(Math.round(setup.len * 1000) + 100);
  const a = await page.evaluate(() => { window.__seeks = 0; return window.frameNow(); });
  await page.waitForTimeout(Math.round(setup.len * 4000) + 300);
  const b = await page.evaluate(() => ({ f: window.frameNow(), seeks: window.__seeks, on: LOOPER.on, deck: LOOPER.deck, active: AE.active,
    N: LOOPER.N, playing: player.playing, rep: LOOPER.rep }));
  await page.evaluate(() => window.recStop());
  const m = await page.evaluate(([a, b, n]) => window.measure(a, b, n), [a, b.f, setup.N]);
  await page.evaluate(() => { FX.clearLoop(); LOOPER.ok = LOOPER.__ok; });
  await page.waitForTimeout(500);
  return { setup, a, b, m };
};

/* THE INSTRUMENT, MEASURED FIRST: plain playback, no loop, nothing spliced and
   nothing to find. Every number below is read against this one. */
console.log('\n  · the instrument itself, on plain playback');
await reset();
await page.evaluate(() => window.recStart());
await page.waitForTimeout(4200);
const baseRec = await page.evaluate(() => window.recStop());
const base = await page.evaluate(r => window.measure(r.f0 + 4410, r.f0 + r.n, 0), baseRec);
console.log(`    ${base.sec.toFixed(1)} s recorded, rms ${base.rms.toFixed(3)}, worst step ${base.worst.toFixed(4)} ` +
            `(${(base.worst / base.p9999).toFixed(2)}× its own 99.99th), holes ${base.holes}, recorder gaps ${base.gaps}`);
R('the recorder has no seams of its own', base.gaps === 0 && base.holes === 0, `gaps ${base.gaps}, holes ${base.holes}`);

console.log('\n  · the loop that seeks (the fallback: iOS, no worklet, a cut the tape refused)');
const old = await measureLoop(true);
console.log(`    ${old.m.sec.toFixed(1)} s, lap against lap ${(old.m.lap * 100).toFixed(1)}% of peak, worst step ` +
            `${(old.m.worst / old.m.p9999).toFixed(2)}× the music's 99.99th, holes ${old.m.holes}, seeks ${old.b.seeks}`);
console.log('\n  · the loop that does not');
const neu = await measureLoop(false);
console.log(`    ${neu.m.sec.toFixed(1)} s, lap against lap ${(neu.m.lap * 100).toFixed(3)}% of peak, worst step ` +
            `${(neu.m.worst / neu.m.p9999).toFixed(2)}× the music's 99.99th, holes ${neu.m.holes}, seeks ${neu.b.seeks}`);
console.log('');

R('each deck carries its own loop tape, seated at the head of its strip', await page.evaluate(() => AE.decks.every(d => !!d.tape) && LOOPER.ok(0) && LOOPER.ok(1)));
R('the loop handed over to the deck\'s tape — on the record on air', neu.setup.taped && neu.b.on && neu.b.deck === neu.b.active,
  `taped=${neu.setup.taped} on=${neu.b.on} deck=${neu.b.deck} on air=${neu.b.active}`);
/* THE PERIOD IS THE PERIOD. The tape loops between two frame counts, so the
   cycle cannot drift — but it can be the WRONG length if the loop was sized
   wrong, and that is a loop that slides off the phrase over a minute. */
// derived on its own terms, not from the code's arithmetic: two beats of the tempo the room hears (pinned at 120)
const wantN = Math.round(LOOP_BEATS * 60 / 120 * neu.setup.sr);
R('…and the cycle it loops is exactly the loop that was asked for, at the rate the deck is playing',
  neu.b.N === wantN && neu.b.rep && neu.b.rep.N === wantN,
  `${neu.b.N} frames (processor: ${neu.b.rep && neu.b.rep.N}) vs ${wantN} wanted — ${neu.setup.len.toFixed(4)} s at ×${neu.setup.rate}`);
R('every lap after the handover is the same audio as the one before it, sample for sample',
  neu.m.lap != null && neu.m.lap < 0.005, `lap against lap ${(neu.m.lap * 100).toFixed(3)}% of peak, over ${neu.m.sec.toFixed(1)} s`);
R('…where the re-seek loop never once repeats itself', old.m.lap > 0.05, `${(old.m.lap * 100).toFixed(1)}% of peak`);
/* THE ONE NUMBER. Every cycle of the old loop wrote the playhead; the tape must
   not write it at all, for as long as it is held. */
R('NOT ONE SEEK while the loop is held', neu.b.seeks === 0, 'seeks=' + neu.b.seeks);
R('…where the old path seeks every single cycle', old.b.seeks >= 3, `${old.b.seeks} seeks in ${old.m.sec.toFixed(1)} s of a ${old.setup.len.toFixed(2)} s loop`);
R('no step in the held output the music does not already contain',
  neu.m.worst / neu.m.p9999 <= Math.max(2.5, (base.worst / base.p9999) * 1.3),
  `held ${(neu.m.worst / neu.m.p9999).toFixed(2)}×, re-seeking ${(old.m.worst / old.m.p9999).toFixed(2)}×, plain playback ${(base.worst / base.p9999).toFixed(2)}×`);
R('no hole anywhere in it', neu.m.holes === 0 && neu.m.gaps === 0, `holes ${neu.m.holes}`);
R('the music never stopped for any of it', neu.b.playing && neu.m.rms > 0.01, `rms=${neu.m.rms.toFixed(3)}`);

/* THE LOOP IS THE DECK'S, NOT THE ROOM'S. The old tape closed a gate on the
   whole bus to play itself back, so a loop took away everything else the room
   was hearing — the other deck under the handle, an echo's tail. A tone is put
   on the bus beside the decks, and it must come through a held loop exactly as
   it came through before it. And the deck's own filter, which the old tape sat
   AFTER, must now reach the loop. */
const strip = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 1.0;
  await new Promise(r => setTimeout(r, 700));
  const osc = AE.ctx.createOscillator(), g = AE.ctx.createGain();
  osc.frequency.value = 2600; g.gain.value = 0.08;
  osc.connect(g); g.connect(AE.bus); osc.start();
  window.recStart();
  await new Promise(r => setTimeout(r, 900));
  const f0 = window.frameNow();
  FX.setLoop(2, false);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
  await new Promise(r => setTimeout(r, 300));
  const f1 = window.frameNow();
  await new Promise(r => setTimeout(r, 900));
  const f2 = window.frameNow();
  osc.stop(); osc.disconnect(); g.disconnect();          // (the tone is on the bus, past the deck's filter: out of the way of it)
  FX.auto = false; FX.set('filter', 0.02);              // the hand's filter, hard left, on the deck holding the loop
  await new Promise(r => setTimeout(r, 600));
  const f3 = window.frameNow();
  await new Promise(r => setTimeout(r, 900));
  const f4 = window.frameNow();
  FX.set('', 0);
  await window.recStop();
  FX.clearLoop();
  const sr = AE.ctx.sampleRate, w = Math.round(0.8 * sr);
  return { held: LOOPER.on, before: window.tone(f0 - w, f0, 2600), during: window.tone(f1, f1 + w, 2600),
           open: window.bright(f1, f2), shut: window.bright(f3, f4), gate: AE.busGate.gain.value };
});
await page.waitForTimeout(600);
R('a loop leaves the rest of the room alone — what else is on the bus comes through it untouched',
  strip.during > strip.before * 0.7 && strip.during < strip.before * 1.4 && strip.gate > 0.99,
  `a 2.6 kHz tone on the bus: ${(10 * Math.log10(strip.during / strip.before)).toFixed(2)} dB through the held loop · busGate ${strip.gate.toFixed(2)}`);
R('the deck\'s own filter reaches the loop it is holding — the tape sits at the head of the strip',
  strip.shut < strip.open * 0.2, `high end under the loop ${(100 * strip.shut / strip.open).toFixed(1)}% of open with the filter hard left`);

/* HALVE AND DOUBLE, FROM THE SAME IN-POINT. Halved, the music must repeat every
   half-loop; doubled back, it must be the ORIGINAL loop again, sample for sample —
   the proof the in-point never moved, and that the second half was taken from
   the deck's own run-on, not invented. */
const resize = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 0.3;                     // the run-on must not reach the end guard inside this test
  await new Promise(r => setTimeout(r, 700));
  window.__seeks = 0;
  window.recStart();
  FX.setLoop(2, false);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
  const N = LOOPER.N, sr = AE.ctx.sampleRate, lap = N / sr * 1000;
  await new Promise(r => setTimeout(r, lap * 1.1));
  const fA = window.frameNow();
  await new Promise(r => setTimeout(r, lap * 2.1));
  const fB = window.frameNow();
  FX.resizeLoop(-1);
  await new Promise(r => setTimeout(r, 150));
  const fC = window.frameNow(), halfN = LOOPER.N;
  await new Promise(r => setTimeout(r, lap * 1.1));
  const fD = window.frameNow();
  FX.resizeLoop(1);
  const t2 = Date.now();
  while (LOOPER.N !== N && Date.now() - t2 < 3000) await new Promise(r => setTimeout(r, 20));
  await new Promise(r => setTimeout(r, lap * 1.1));
  const fE = window.frameNow();
  await new Promise(r => setTimeout(r, lap * 2.1));
  const fF = window.frameNow();
  const seeks = window.__seeks, beats = FX.loop ? FX.loop.beats : 0;
  await window.recStop();
  FX.clearLoop();
  const before = window.measure(fA, fB, N), half = window.measure(fC, fD, halfN), back = window.measure(fE, fF, N);
  /* the doubled loop against the ORIGINAL laps, a whole number of loops earlier.
     Where in the doubled loop the head sits depends on which half it was in when
     the length came back — a CDJ's doubling is the same — so the original is
     allowed either alignment, half a loop apart; anything else is not the loop. */
  const x = window.__rec.x, f0 = window.__rec.f0;
  const sameAt = off => {
    let d = 0, peak = 0;
    for (let f = fE; f < fF; f++){
      const g = fA + ((f - fA + off) % N + N) % N;           // the same place in an original lap
      d = Math.max(d, Math.abs(x[f - f0] - x[g - f0])); peak = Math.max(peak, Math.abs(x[f - f0]));
    }
    return peak > 0 ? d / peak : 1;
  };
  return { N, halfN, beats, seeks, before: before.lap, half: half.lap, back: back.lap, same: Math.min(sameAt(0), sameAt(halfN)), holes: half.holes + back.holes };
});
await page.waitForTimeout(500);
R('halving is at once and exact: the music repeats every half-loop',
  resize.halfN === Math.round(resize.N / 2) && resize.half < 0.005,
  `${resize.halfN} frames of ${resize.N} · lap against lap ${(resize.half * 100).toFixed(3)}%`);
R('…and doubling back takes the deck\'s own run-on: the ORIGINAL loop again, sample for sample, the in-point never moved',
  resize.beats === 2 && resize.back < 0.005 && resize.same < 0.005 && resize.holes === 0 && resize.seeks === 0,
  `lap ${(resize.back * 100).toFixed(3)}% · against the loop before the halving ${(resize.same * 100).toFixed(3)}% · seeks ${resize.seeks}`);

/* A LOOP AT ANOTHER RATE IS STILL ITS BEATS. The clock's tempo is the one the
   room hears — the record's tempo times the deck's rate — and a loop sized at
   it and then cut at the deck's rate held beats/rate beats: 1.6 at ×1.25, every
   lap short, every downbeat early. Judged from the output: at ×1.25 the music
   must repeat every two HEARD beats (the clock is pinned at 120, so a second),
   a length derived here and not by the code under test. */
const rated = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  SPEED.idx = 1; SPEED.apply();                          // the listener's ×1.25
  activeDeck().a.currentTime = 1.0;
  await new Promise(r => setTimeout(r, 900));
  const d = activeDeck(), sr = AE.ctx.sampleRate;
  window.recStart();
  FX.setLoop(2, false);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
  const want = Math.round(2 * 60 / 120 * sr), N = LOOPER.N, rate = d.a.playbackRate;
  await new Promise(r => setTimeout(r, 1300));
  const a = window.frameNow();
  await new Promise(r => setTimeout(r, 3200));
  const b = window.frameNow();
  // …and doubled, then halved back, still at ×1.25: four heard beats, then two
  FX.resizeLoop(1);
  let t2 = Date.now();
  while (LOOPER.N !== 2 * want && Date.now() - t2 < 5000) await new Promise(r => setTimeout(r, 20));
  await new Promise(r => setTimeout(r, 300));
  const c = window.frameNow();
  while (window.frameNow() - c < 2.3 * 2 * want) await new Promise(r => setTimeout(r, 50));   // two laps and change, on the audio clock
  const e = window.frameNow(), N2 = LOOPER.N;
  FX.resizeLoop(-1);
  await new Promise(r => setTimeout(r, 300));
  const g = window.frameNow();
  await new Promise(r => setTimeout(r, 2200));
  const h = window.frameNow(), N3 = LOOPER.N;
  await window.recStop();
  FX.clearLoop();
  SPEED.idx = 0; SPEED.apply();
  await new Promise(r => setTimeout(r, 300));
  return { rate, N, N2, N3, want, on: LOOPER.cycles > 0, heard: window.measure(a, b, want).lap, cut: window.measure(a, b, N).lap,
           doubled: window.measure(c, e, 2 * want).lap, halved: window.measure(g, h, want).lap };
});
R('a loop at ×1.25 is two beats of what the room hears — judged from the output, it repeats every two heard beats',
  Math.abs(rated.rate - 1.25) < 1e-6 && rated.heard < 0.005 && Math.abs(rated.N - rated.want) <= 1,
  `the music repeats at ${rated.want} frames to ${(rated.heard * 100).toFixed(3)}% of peak · the tape cut ${rated.N} frames (${(rated.N / rated.want * 2).toFixed(2)} beats)`);
R('…and halved or doubled at ×1.25 it is still beats of what the room hears: four, then two again',
  Math.abs(rated.N2 - 2 * rated.want) <= 1 && rated.doubled < 0.005 && Math.abs(rated.N3 - rated.want) <= 1 && rated.halved < 0.005,
  `doubled: ${rated.N2} frames, repeating at four heard beats to ${(rated.doubled * 100).toFixed(3)}% · halved back: ${rated.N3}, at two to ${(rated.halved * 100).toFixed(3)}%`);

/* A JUMP UNDER A HELD LOOP. A beat jump or a cue moves the loop with it: the
   same length is latched again at the new place. Under a tape loop that loop
   has to be cut from tape the deck recorded AT the new place — a seek is asked
   at once and lands later, and a cut taken before it has landed reaches back
   across the jump: the first stretch of every lap is the old place and the
   seek's gap. So the new loop's lap is compared, piece by piece, with the song
   itself played plainly through the same chain at the same place: the whole
   lap must be one stretch of the song, head included. And a doubling must
   still land on it afterwards. */
const jumped = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const landed = async d => { let p = -1; for (let k = 0; k < 200; k++){ await sleep(15); const c = d.a.currentTime; if (!d.a.seeking && d.a.readyState >= 3 && p >= 0 && c > p) return; p = d.a.seeking ? -1 : c; } };
  FX.clearLoop(); LOOPER.cancel();
  const d = activeDeck(), sr = AE.ctx.sampleRate, r = d.a.playbackRate || 1;
  d.a.currentTime = 1.0;
  await landed(d); await sleep(700);
  FX.setLoop(2, false);
  let t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await sleep(30);
  await sleep(1300);
  const g0 = LOOPER.gen;
  window.recStart();
  FX.beatJump(4);                                        // four beats on: two seconds at the pinned 120
  t = Date.now();
  while (!(LOOPER.gen !== g0 && LOOPER.on) && Date.now() - t < 8000) await sleep(20);
  const relatched = LOOPER.gen !== g0 && LOOPER.on && LOOPER.deck === AE.active;
  const N = LOOPER.N, H = LOOPER.A + LOOPER.N, start = FX.loop ? FX.loop.start : NaN, beats = FX.loop ? FX.loop.beats : 0;
  await sleep(N / sr * 1000 * 1.3);
  const a = window.frameNow();
  await sleep(N / sr * 1000 + 150);
  await window.recStop();
  const lapRec = window.__rec;
  // a doubling must still land on the re-latched loop
  FX.resizeLoop(1);
  t = Date.now();
  while (LOOPER.N !== 2 * N && Date.now() - t < 5000) await sleep(20);
  const doubled = LOOPER.N === 2 * N;
  FX.clearLoop();
  t = Date.now();
  while ((LOOPER.backing || LOOPER.on) && Date.now() - t < 4000) await sleep(20);   // the handback's own seeks, done
  // the song itself, plainly, at the same place
  d.a.currentTime = Math.max(0, start - 0.6);
  await landed(d); await sleep(250);
  window.recStart();
  await sleep(30);
  const fR = window.frameNow(), cR = d.a.currentTime;
  await sleep((N / sr + 1.0) * 1000);
  await window.recStop();
  const plain = window.__rec;
  // where the lap's samples should sit in the plain recording, up to the deck's own latency (searched, ±50 ms)
  const fS = fR + Math.round((start - cR) / r * sr), phaseA = ((a - H) % N + N) % N;
  const want = j => fS + ((phaseA + j) % N);
  const lapAt = j => lapRec.x[a + j - lapRec.f0], plainAt = f => plain.x[f - plain.f0];
  const err = (pFrom, pTo, lag) => {
    let e = 0, ref = 0, n = 0;
    for (let j = 0; j < N; j++){
      const p = (phaseA + j) % N; if (p < pFrom || p >= pTo) continue;
      const q = plainAt(want(j) + lag), y = lapAt(j);
      if (q === undefined || y === undefined) return Infinity;
      e += (y - q) * (y - q); ref += q * q; n++;
    }
    return n && ref > 0 ? Math.sqrt(e / ref) : Infinity;
  };
  const L50 = Math.round(0.05 * sr);
  let best = 0, bestE = Infinity;
  for (let lag = -L50; lag <= L50; lag += 4){ const e = err(Math.round(0.35 * N), Math.round(0.95 * N), lag); if (e < bestE){ bestE = e; best = lag; } }
  for (let lag = best - 4; lag <= best + 4; lag++){ const e = err(Math.round(0.35 * N), Math.round(0.95 * N), lag); if (e < bestE){ bestE = e; best = lag; } }
  const head = err(Math.round(0.02 * sr), Math.round(0.25 * sr), best);
  return { relatched, beats, doubled, tail: bestE, head, lag: best / sr * 1000, playing: player.playing };
});
R('a beat jump under a held loop latches it again from the new place — the whole lap is one stretch of the song, head included',
  jumped.relatched && jumped.beats === 2 && jumped.tail < 0.05 && jumped.head < 0.05,
  `against the song played plainly there: head ${(jumped.head * 100).toFixed(1)}%, body ${(jumped.tail * 100).toFixed(1)}% (rms of the difference), at ${jumped.lag.toFixed(1)} ms`);
R('…and a doubling still lands on the loop latched after the jump', jumped.doubled, 'doubled=' + jumped.doubled);

/* HALVE STRAIGHT BACK OVER A DOUBLING THE TAPE HAS NOT TAKEN YET. The doubling
   waits for tape; pressed back to the same length before it lands, it must be
   forgotten — or the loop grows to twice its length a few laps later while the
   pads say one beat. Judged from the output, after the doubling would have
   landed. */
const back2 = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 1.0;
  await new Promise(r => setTimeout(r, 900));
  FX.setLoop(1, false);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
  const N1 = LOOPER.N, sr = AE.ctx.sampleRate;
  FX.resizeLoop(1); FX.resizeLoop(-1);                   // double, and straight back before the tape could take it
  window.recStart();
  await new Promise(r => setTimeout(r, 1500));
  const a = window.frameNow();
  await new Promise(r => setTimeout(r, 2000));
  const b = window.frameNow();
  await window.recStop();
  const out = { N1, N: LOOPER.N, beats: FX.loop ? FX.loop.beats : 0, lap: window.measure(a, b, N1).lap };
  FX.clearLoop();
  return out;
});
await page.waitForTimeout(400);
R('doubled and straight back before the tape could take it: the loop stays the length the pads show',
  back2.N === back2.N1 && back2.beats === 1 && back2.lap < 0.005,
  `tape ${back2.N} frames vs ${back2.N1} · pads ${back2.beats} beat · the music repeats at one beat to ${(back2.lap * 100).toFixed(3)}%`);

/* A JUMP INSIDE THE PASS A LOOP IS BEING CUT FROM. The deck is re-seeked a
   millisecond on (as the watchdog's heal does) while the tape is still
   recording the loop's first pass: that pass is no longer the song in order,
   and it must never be cut into the tape — the loop is handed to the re-seek
   path, on the in-point the hand pressed, and keeps looping there. Judged by
   the processor's own reports (it must never have taken the cut) and by the
   output: after the out-point the music must not repeat the first pass, as a
   tape loop of it would, sample for sample. Main-thread state alone cannot tell
   a tape that let go from one that was never told to. */
const brokeRun = async (lateMs) => page.evaluate(async lateMs => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 1.0;
  await sleep(900);
  const d = activeDeck(), sr = AE.ctx.sampleRate;
  window.recStart();
  FX.setLoop(2, false);                                  // a one-second first pass
  const gen = LOOPER.gen, L = FX.loop, N = LOOPER.N, A = LOOPER.A, cut = (A + N) / sr;   // the out-point, as armed
  const tape = LOOPER.node(LOOPER.deck), modes = [];
  const hear = e => { const m = e.data || {}; if (m.gen === gen && m.mode) modes.push(m.mode); };
  if (tape) tape.port.addEventListener('message', hear);
  let jumpAt;
  if (lateMs){
    // just before the out-point, with the main thread busy for a frame — its 'seeking' is handled after the tape took the cut
    while (AE.ctx.currentTime < cut - lateMs / 1000) await sleep(2);
    jumpAt = AE.ctx.currentTime - cut;
    d.a.currentTime = d.a.currentTime + 0.5;
    const t = performance.now(); while (performance.now() - t < 220);
  } else {
    await sleep(120);
    jumpAt = AE.ctx.currentTime - cut;
    d.a.currentTime = d.a.currentTime + 0.001;
  }
  const pending = jumpAt < 0;
  window.__seeks = 0;
  await sleep(3600);
  const b = window.frameNow();
  await window.recStop();
  if (tape) tape.port.removeEventListener('message', hear);
  const pos = d.a.currentTime;
  const out = { pending, jumpAt: jumpAt * 1000, engaged: LOOPER.engaged(), loop: FX.loop === L, seeks: window.__seeks,
    inside: !!L && pos >= L.start - 0.02 && pos <= L.start + L.len + 0.15,
    held: modes.length ? modes[modes.length - 1] === 'loop' : false,       // the processor's own last word
    lap: window.measure(A + N + Math.round(0.4 * sr), b, N).lap };          // the output after the out-point, against itself a loop earlier
  FX.clearLoop();
  return out;
}, lateMs);
const broke = await brokeRun(0);
await page.waitForTimeout(400);
R('a jump inside the pass a loop is being cut from is never cut into the tape — the re-seek loop holds the pressed in-point',
  broke.pending && !broke.engaged && !broke.held && broke.loop && broke.seeks >= 1 && broke.inside && broke.lap > 0.05,
  `the tape's own last word ${broke.held ? 'loop' : 'pass'} · after the out-point the music repeats a lap to ${(broke.lap * 100).toFixed(1)}% (a tape loop of the pass: ~0) · re-seek wraps ${broke.seeks} · inside ${broke.inside}`);
/* …AND ONE WHOSE EVENT IS HANDLED LATE. A seek ninety milliseconds before the
   out-point, with the main thread then busy for a frame: by the time its
   'seeking' is handled the tape has already taken the cut, jump and all, and
   the old code took it for a jump under a held loop. A break is dated by when
   it could have happened, so the spoiled cut is let go of all the same. */
let late = null;
for (let k = 0; k < 3 && !(late && late.pending && late.jumpAt > -150); k++){ late = await brokeRun(90); await page.waitForTimeout(400); }
R('…and a jump just before the out-point whose event is handled after it is not looped either',
  late.pending && late.jumpAt > -150 && !late.engaged && !late.held && late.loop && late.lap > 0.05,
  `jumped ${late.jumpAt.toFixed(0)} ms before the out-point · the tape's own last word ${late.held ? 'loop' : 'pass'} · after the out-point the music repeats a lap to ${(late.lap * 100).toFixed(1)}%`);

/* A RE-LATCH BELONGS TO THE RECORD THAT JUMPED. A beat jump under a held loop
   waits for the deck to land before it latches the loop again; if the hand
   touches the other deck meanwhile (its jog, its PLAY, its lane), the latch must
   still be taken — the loop is this record's — and above all the covering loop
   must never be left playing with nothing that owns it: a pause must silence it. */
const owned = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 1.0;
  await sleep(900);
  FX.setLoop(2, false);
  let t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await sleep(30);
  await sleep(1200);
  const g0 = LOOPER.gen, hs = DECKS.handSlot;
  FX.beatJump(4);
  DECKS.handSlot = () => 1 - AE.active;                  // the hand on the other deck while this one lands
  t = Date.now();
  while (FX.loop && FX.loop.relatch && Date.now() - t < 5000) await sleep(20);
  await sleep(200);
  DECKS.handSlot = hs;
  const latched = !!FX.loop && LOOPER.gen !== g0, stranded = !FX.loop && LOOPER.engaged();
  player.pause();
  await sleep(400);
  window.recStart();
  await sleep(100);
  const a = window.frameNow();
  await sleep(600);
  const b = window.frameNow();
  await window.recStop();
  const rms = window.measure(a, b, 0).rms;
  player.resume();
  await sleep(600);
  FX.clearLoop(); LOOPER.cancel();
  return { latched, stranded, rms, playing: player.playing };
});
R('a jump\'s re-latch is taken though the hand touched the other deck meanwhile — and a pause then silences it',
  owned.latched && !owned.stranded && owned.rms < 0.001 && owned.playing,
  `latched ${owned.latched} · a loop with no owner ${owned.stranded} · rms over the pause ${owned.rms.toFixed(4)}`);

/* LETTING GO OF A LATCHED LOOP lands the deck inside it, where the loop was —
   the one splice the tape cannot make alone, because the deck ran on and has to
   be seeked back. The music after the handback continues the lap it left, so it
   is compared with that lap: the lag that matches best is how far from the
   loop's own place the deck came back.
   AND IT MUST HAVE LET GO. Before the loop's next wrap a perfect handback and a
   loop that never let go are the same samples — the comparison above cannot
   tell them apart, and a probe that only looked there passed a tape that
   ignored its exit. So the recording runs on past where a held loop would have
   wrapped, and the music there must NOT repeat the lap before it: a deck that
   took the music back plays on into the song (the demo's 124 BPM against the
   grid pinned at 120, so a loop is never a period of the music). */
const backs = [];
for (let k = 0; k < 3; k++){
  const hb = await page.evaluate(async () => {
    FX.clearLoop(); LOOPER.cancel();
    activeDeck().a.currentTime = 1.0;
    await new Promise(r => setTimeout(r, 700));
    LOOPER.backAt = NaN;                                // a trial that makes no handback must not read the last one's
    window.recStart();
    FX.setLoop(4, false);                               // two seconds: room for a handback inside one lap
    const t = Date.now();
    while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
    const N = LOOPER.N, sr = AE.ctx.sampleRate;
    await new Promise(r => setTimeout(r, 300 + Math.random() * 600));
    window.__seeks = 0;
    FX.clearLoop();
    const t2 = Date.now();
    while ((LOOPER.backing || LOOPER.on) && Date.now() - t2 < 4000) await new Promise(r => setTimeout(r, 10));
    if (!isFinite(LOOPER.backAt)){ await window.recStop(); return { land: null, gone: 0, sr, seeks: window.__seeks, on: LOOPER.on, playing: player.playing, none: true }; }
    const at = Math.round(LOOPER.backAt * sr);
    const phase = ((at - (LOOPER.A + LOOPER.N)) % N + N) % N;
    const W = at + (N - phase);                         // where a loop still held would wrap back to its in-point
    while (window.frameNow() < W + Math.round(0.4 * sr)) await new Promise(r => setTimeout(r, 20));
    await window.recStop();
    const ramp = Math.round(0.015 * sr);           // the crossover (6 ms) and the limiter's lookahead (3 ms), well clear
    // judged only where the lap it continues was still inside the loop
    const room = N - phase - ramp - Math.round(0.06 * sr);
    const w = Math.min(Math.round(0.05 * sr), room);
    const land = w > 200 ? window.landing(at + ramp, w, N, Math.round(0.03 * sr)) : null;
    // …and past the wrap, the deck played on into the song rather than round the lap again
    const x = window.__rec.x, f0 = window.__rec.f0;
    let dd = 0, pk = 0;
    for (let f = W + Math.round(0.02 * sr); f < W + Math.round(0.3 * sr) && f - f0 < x.length; f++){
      dd = Math.max(dd, Math.abs(x[f - f0] - x[f - N - f0])); pk = Math.max(pk, Math.abs(x[f - f0]));
    }
    const gone = pk > 0.01 ? dd / pk : 0;
    return { land, w, gone, seeks: window.__seeks, err: LOOPER.lastErr, late: LOOPER.backLate, sr, on: LOOPER.on, playing: player.playing };
  });
  backs.push(hb);
}
const lands = backs.filter(b => b.land).map(b => b.land.lag / b.sr * 1000);
console.log('    handback landings, from the audio: ' + lands.map(v => v.toFixed(1) + ' ms').join(', ')
  + ' · fit ' + backs.filter(b => b.land).map(b => b.land.fit.toFixed(3)).join('/')
  + ' · the deck\'s own word ' + backs.map(b => b.err == null ? '–' : (b.err * 1000).toFixed(1) + ' ms').join('/')
  + ' · seeks ' + backs.map(b => b.seeks).join('/')
  + ' · past the wrap ' + backs.map(b => (b.gone * 100).toFixed(0) + '%').join('/') + ' unlike the lap');
R('letting go of a latched loop lands the deck where the loop was — within a seek\'s latency, never a lap out',
  lands.length >= 2 && lands.every(v => Math.abs(v) <= 12) && backs.every(b => b.land == null || b.land.fit < 0.05)
    && backs.every(b => !b.none && !b.on && b.playing && b.seeks >= 1 && b.seeks <= 4),
  lands.map(v => v.toFixed(1) + ' ms').join(', '));
R('…and it really let go: past where a held loop would wrap, the music plays on instead of repeating the lap',
  backs.every(b => b.gone > 0.05), backs.map(b => (b.gone * 100).toFixed(0) + '%').join(', ') + ' of peak away from the lap before');

/* A ROLL IS STILL A ROLL. It stalls the music while the track runs on
   underneath, and now it does that literally: the deck is never touched, so on
   release it is already exactly where it would have been. */
const roll = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 1.0;
  await new Promise(r => setTimeout(r, 700));
  FX.setLoop(1, true);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
  const held = LOOPER.on;
  const d = activeDeck(), t0 = d.a.currentTime;
  window.__seeks = 0;
  await new Promise(r => setTimeout(r, 2200));
  const ran = d.a.currentTime - t0, during = window.__seeks;
  FX.clearLoop();
  await new Promise(r => setTimeout(r, 400));
  return { held, ran, during, onRelease: window.__seeks - during, on: LOOPER.on };
});
R('a roll engages the same way', roll.held);
R('…and the track really did run on underneath it, untouched', roll.ran > 2.0 && roll.during === 0,
  `advanced ${roll.ran.toFixed(2)} s in 2.2 s, ${roll.during} seeks`);
R('…so releasing it needs no seek at all', roll.onRelease === 0 && !roll.on, 'seeks=' + roll.onRelease);

/* A CUT THE TAPE CANNOT HOLD IS NOT A LOOP OF NOTHING. The tapes are reopened
   (their past starts now) and the booth is lied to about how much past there is,
   so the in-point falls before the tape began. The processor must refuse the
   cut — and the loop must still loop, on the re-seek path, rather than play a
   lap of silence or run straight past its out-point. */
const refuse = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 2.3;
  await new Promise(r => setTimeout(r, 900));
  LOOPER.close(); LOOPER.open();
  const have = LOOPER.have; LOOPER.have = () => 30;
  const before = LOOPER.refused;
  window.__seeks = 0;
  FX.setLoop(2, false);
  LOOPER.have = have;
  const L = FX.loop;
  await new Promise(r => setTimeout(r, 3200));
  const d = activeDeck(), pos = d.a.currentTime;
  const out = { refused: LOOPER.refused - before, engaged: LOOPER.engaged(), loop: !!FX.loop, seeks: window.__seeks,
    inside: L && pos >= L.start - 0.02 && pos <= L.start + L.len + 0.15, pos, start: L && L.start, len: L && L.len };
  FX.clearLoop();
  return out;
});
await page.waitForTimeout(500);
R('a cut reaching before the tape\'s past is refused by the processor, not made from whatever was there', refuse.refused === 1 && !refuse.engaged,
  `refused ${refuse.refused}, engaged ${refuse.engaged}`);
R('…and the loop still loops, on the re-seek path', refuse.loop && refuse.seeks >= 2 && refuse.inside,
  `seeks ${refuse.seeks}, playhead ${refuse.pos.toFixed(2)} in [${refuse.start.toFixed(2)}, ${(refuse.start + refuse.len).toFixed(2)}]`);

/* THE HANDBACK ASKS THE DECK. The deck is seeked early and the loop covers;
   the deck is made to report an empty buffer for a while, and the handback must
   wait for it — then go the moment it can. */
const wait = await page.evaluate(async () => {
  FX.clearLoop(); LOOPER.cancel();
  activeDeck().a.currentTime = 1.0;
  await new Promise(r => setTimeout(r, 700));
  FX.setLoop(1, false);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 8000) await new Promise(r => setTimeout(r, 30));
  if (!LOOPER.on) return { on: false };
  const d = activeDeck();
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'buffered');
  const empty = { length: 0, start(){ return 0; }, end(){ return 0; } };
  let starve = true;
  Object.defineProperty(d.a, 'buffered', { configurable: true, get(){ return starve ? empty : desc.get.call(this); } });
  const t0 = AE.ctx.currentTime;
  const lead = LOOPER.handBack();
  const waiting = !!LOOPER.backing && LOOPER.on;
  await new Promise(r => setTimeout(r, 450));
  const stillWaiting = !!LOOPER.backing && LOOPER.on;
  starve = false;                        // the bytes arrive
  const t1 = Date.now();
  while (LOOPER.backing && Date.now() - t1 < 3000) await new Promise(r => setTimeout(r, 20));
  const went = !LOOPER.backing && !LOOPER.on;
  const at = LOOPER.backAt - t0;
  Object.defineProperty(d.a, 'buffered', { configurable: true, get(){ return desc.get.call(this); } });
  FX.loop = null;
  await new Promise(r => setTimeout(r, 400));
  return { on: true, lead, waiting, stillWaiting, went, at, playing: player.playing, waits: LOOPER.waits };
});
R('a handback into an unbuffered deck waits, with the loop still covering', wait.on && wait.waiting && wait.stillWaiting,
  `waiting=${wait.waiting} still=${wait.stillWaiting} after 450 ms`);
R('…and goes the moment the deck has the bytes — late, never empty', wait.went && wait.at > 0.4 && wait.at < 2.0 && wait.playing,
  `handed back ${(wait.at * 1000).toFixed(0)} ms after the call (planned lead was ${(wait.lead * 1000).toFixed(0)} ms)`);

/* THE STAND-DOWN. Where there is no live graph there is no tape, and the booth
   must keep the loop it has always had rather than losing the feature. */
const ios = await page.evaluate(() => {
  const was = AE.graphLive;
  AE.graphLive = false;
  const ok = LOOPER.ok();
  const tape = (LOOPER.ok() && LOOPER.open()) ? LOOPER.have() : Infinity;
  const b = loopInPoint(activeDeck().a.currentTime, FX.grid(), FX.bpm(), 4, tape);
  const plain = loopBounds(activeDeck().a.currentTime, FX.grid(), FX.bpm(), 4);
  AE.graphLive = was;
  return { ok, same: Math.abs(b.start - plain.start) < 1e-9 };
});
R('element-direct playback stands the tape down', !ios.ok);
R('…and the old re-seek loop keeps its in-point exactly', ios.same);

R('no page errors throughout', errs.length === 0, errs.slice(0, 2).join(' | '));

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
