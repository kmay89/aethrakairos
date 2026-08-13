/* LOOP PROBE — is the loop actually seamless, or does it just say so?
 *
 * The booth's loop arithmetic is unit-tested to death and always was; that was
 * never the problem. The problem was a SEEK: once per cycle the old loop wrote
 * currentTime back to the in-point, and a media element asked to jump takes a
 * moment to have audio again. Nothing in a unit test can see that, because the
 * arithmetic it produces is perfect. You have to listen.
 *
 * So this listens. A second recorder is hung on the master, the real player
 * plays real (synthesized, deterministic, no network) music, a real loop is
 * pressed, and the OUTPUT is measured:
 *
 *   seeks          how many times the playhead was written to while a loop was
 *                  held. The old path does this every cycle. The new one must
 *                  do it exactly zero times — that is the whole claim, and it
 *                  is the one number that cannot be argued with.
 *   discontinuity  the largest sample-to-sample step in the recorded output,
 *                  against the largest step the music itself contains. A splice
 *                  in the wrong place is a step far outside the music's own
 *                  distribution; a seamless one is inside it.
 *   silence        a decoder re-priming leaves a hole. Holes are counted.
 *   period         the loop's cycle length, taken off the buffer the audio
 *                  thread is actually looping, against the beats that were
 *                  asked for.
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'] });

let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};

/* A SMALL WINDOW, ON PURPOSE. Everything here — the recorder, the tape, the
   render loop — shares one main thread, and a software rasteriser filling 640×420
   starves it badly enough to become the thing being measured. The visuals are not
   under test; the audio is. */
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

/* THE INSTRUMENTS.
   · every write to the playhead is counted, by shadowing the element's own
     accessor — a seek that happens is a seek that shows up, wherever it came from
   · the master is recorded through a second processor, so what is measured is
     what a listener would have heard rather than what the code believes it did */
await page.evaluate(() => {
  window.__seeks = 0;
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  for (const d of AE.decks) Object.defineProperty(d.a, 'currentTime', {
    configurable: true,
    get(){ return desc.get.call(this); },
    set(v){ window.__seeks++; desc.set.call(this, v); },
  });
  window.__rec = null;
  window.recStart = () => {
    const sp = AE.ctx.createScriptProcessor(4096, 2, 1);
    const chunks = [];
    sp.onaudioprocess = e => chunks.push(Float32Array.from(e.inputBuffer.getChannelData(0)));
    const z = AE.ctx.createGain(); z.gain.value = 0;
    AE.master.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
    window.__rec = { sp, z, chunks };
  };
  /* WHAT A SPLICE LOOKS LIKE. Music is continuous: adjacent samples differ by a
     little, and how little depends on how bright the music is. A join in the
     wrong place is a STEP — one pair of samples far outside everything around
     them. So the measure is the largest step, reported against the 99.99th
     percentile of all of them, which is the music's own idea of "large". A
     decoder re-priming instead leaves a HOLE, so runs of near-silence are
     counted too: the old path could show either. */
  window.recStop = () => {
    const r = window.__rec; if (!r) return null;
    try { AE.master.disconnect(r.sp); r.sp.disconnect(); r.z.disconnect(); } catch (e){}
    r.sp.onaudioprocess = null; window.__rec = null;
    let n = 0; for (const c of r.chunks) n += c.length;
    const x = new Float32Array(n);
    /* THE INSTRUMENT'S OWN SEAMS ARE NOT THE MUSIC'S. This recorder is a
       ScriptProcessorNode on the same starved main thread as the render loop,
       and a block it fails to service in time is a block that never reaches the
       array — leaving a step between two chunks that was never in the audio.
       Measured on plain playback with no loop at all, those artefacts run three
       times the music's own 99.99th percentile, which is larger than the fault
       this probe exists to find. They fall at chunk boundaries and nowhere else,
       so the boundaries are excluded and everything inside a chunk is kept. */
    const edges = new Set();
    let w = 0;
    for (const c of r.chunks){ x.set(c, w); w += c.length; edges.add(w); }
    const steps = [];
    let rms = 0, worst = 0, worstAt = 0;
    for (let i = 1; i < n; i++){
      rms += x[i] * x[i];
      if (edges.has(i)) continue;
      const s = Math.abs(x[i] - x[i - 1]);
      steps.push(s);
      if (s > worst){ worst = s; worstAt = i; }
    }
    rms = Math.sqrt(rms / Math.max(1, n - 1));
    const sorted = Float32Array.from(steps).sort();
    const q = f => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] : 0;
    /* A HOLE is 5 ms or more with nothing in it. A decoder re-priming after a
       seek leaves one; so, sometimes, does the music. The two are told apart by
       WHERE they fall: a fault sits at the loop's wrap, so its distance from the
       wrap is the same every time, while the music's own gaps sit wherever the
       music put them. Both are reported, and the caller decides. */
    const sr = AE.ctx.sampleRate, win = Math.round(0.005 * sr);
    const holes = [];
    let run = 0;
    for (let i = 0; i < n; i++){
      if (Math.abs(x[i]) < 1e-4){ if (++run === win) holes.push((i - win) / sr); } else run = 0;
    }
    return { n, sec: n / sr, rms, worst, worstAt: worstAt / sr,
             p9999: q(0.9999), p999: q(0.999), holes };
  };
});

// how many seconds a `beats`-beat loop lasts here, from the app's own clock
const LOOP_BEATS = 2;
const measure = async (legacy) => {
  /* THE SAME BAR, BOTH TIMES. Two loops cut from two different parts of a track
     are two different pieces of music, and comparing a click in one against a
     click in the other is comparing nothing. So the deck is put back to the same
     place before each run — which also keeps the whole measurement well clear of
     the end of a sixteen-second demo, where the booth's end-guard would
     legitimately move a (muted) playhead and muddy the seek count. */
  await page.evaluate(() => {
    FX.clearLoop(); LOOPER.cancel(); LOOPER.close();
    /* AND THE SAME GRID. The beat analyser is still settling on this track and
       reports a different tempo every few seconds, so without pinning it the two
       runs cut two different bars of two different lengths and the comparison
       says nothing. Redefined rather than assigned, because the analyser writes
       to it on every frame. */
    if (!CLOCK.__pinned){
      Object.defineProperty(CLOCK, 'bpm', { get(){ return 120; }, set(){}, configurable: true });
      Object.defineProperty(CLOCK, 'grid', { get(){ return 0; }, set(){}, configurable: true });
      Object.defineProperty(CLOCK, 'haveGrid', { get(){ return true; }, set(){}, configurable: true });
      CLOCK.__pinned = true;
    }
    activeDeck().a.currentTime = 1.0;
  });
  await page.waitForTimeout(500);
  const setup = await page.evaluate(({ legacy, beats }) => {
    LOOPER.ok = legacy ? () => false : LOOPER.__ok;
    window.__seeks = 0;
    FX.setLoop(beats, false);
    return { len: FX.loop ? FX.loop.len : 0, bpm: FX.bpm(), at: activeDeck().a.currentTime };
  }, { legacy, beats: LOOP_BEATS });
  /* WAIT FOR THE HANDOVER RATHER THAN GUESSING AT IT. It takes one out-point on
     a healthy machine and a lap or two on this one (a software rasteriser with
     60–200 ms frames), and which of those happened is not the claim under test —
     the claim is what happens AFTER. Everything measured below is measured from
     the moment the loop is genuinely in the audio thread. */
  if (!legacy) await page.waitForFunction('LOOPER.on', null, { timeout: 20000 }).catch(() => {});
  else await page.waitForTimeout(Math.round(setup.len * 1000) + 900);
  const engaged = await page.evaluate(() => {
    /* THE WRAP, MEASURED WHERE IT ACTUALLY HAPPENS. Everything the recorder sees
       is filtered through a starved main thread; the WRAP is not, because the
       audio thread loops the buffer bit-exactly between loopEnd and loopStart.
       So the honest question is whether the buffer's last sample and its first
       sample are neighbours — and that is answered inside the buffer, with no
       instrument in the way and no run-to-run noise at all. If they are, the
       output cannot click, whatever a jittery recording of it looks like. */
    let wrap = null;
    if (LOOPER.src && LOOPER.src.buffer){
      const b = LOOPER.src.buffer.getChannelData(0), n = b.length;
      const st = new Float32Array(n - 1);
      for (let i = 1; i < n; i++) st[i - 1] = Math.abs(b[i] - b[i - 1]);
      const sorted = Float32Array.from(st).sort();
      wrap = { step: Math.abs(b[0] - b[n - 1]),
               p9999: sorted[Math.floor(0.9999 * sorted.length)],
               median: sorted[sorted.length >> 1], max: sorted[sorted.length - 1] };
    }
    return {
      on: LOOPER.on, armed: LOOPER.armed, K: LOOPER.K, laps: LOOPER.laps, wrap,
      loopEnd: LOOPER.src ? LOOPER.src.loopEnd : 0,
      bufLen: LOOPER.src ? LOOPER.src.buffer.length : 0,
      sr: AE.ctx.sampleRate, gate: AE.busGate.gain.value, out: LOOPER.out ? LOOPER.out.gain.value : 0,
    };
  });
  await page.evaluate(() => { window.__seeks = 0; window.recStart(); });
  await page.waitForTimeout(Math.round(setup.len * 4000) + 300);
  const out = await page.evaluate(() => {
    const r = window.recStop();
    /* AND WHAT THE LOOP ITSELF CONTAINS. If the cut holds a quiet stretch then
       the recording will hold one every cycle and that is the music, not a
       fault — the only way to tell is to look inside the buffer the audio thread
       is actually looping. */
    let quiet = 0;
    if (LOOPER.src && LOOPER.src.buffer){
      const b = LOOPER.src.buffer.getChannelData(0), w = Math.round(0.005 * AE.ctx.sampleRate);
      let run = 0;
      for (let i = 0; i < b.length; i++){ if (Math.abs(b[i]) < 1e-4){ if (++run === w) quiet++; } else run = 0; }
    }
    return { r, quiet, seeks: window.__seeks, playing: player.playing,
             pos: activeDeck().a.currentTime };
  });
  await page.evaluate(() => FX.clearLoop());
  await page.waitForTimeout(500);
  return { setup, engaged, ...out };
};

// keep a pristine copy of the real ok() so `legacy` can be switched back off
await page.evaluate(() => { LOOPER.__ok = LOOPER.ok; });

/* THE INSTRUMENT, MEASURED FIRST. The recorder is a ScriptProcessorNode on the
   same main thread as everything else, and a main thread that misses a block
   puts a step or a gap into the RECORDING that was never in the audio. Measuring
   plain playback — no loop, nothing spliced, nothing to find — says how much of
   what follows is the microphone rather than the room. Every number below is
   read against this one. */
console.log('\n  · the instrument itself, on plain playback');
await page.evaluate(() => { FX.clearLoop(); LOOPER.cancel(); activeDeck().a.currentTime = 1.0; });
await page.waitForTimeout(500);
await page.evaluate(() => window.recStart());
await page.waitForTimeout(4200);
const base = await page.evaluate(() => window.recStop());
console.log(`    ${base.sec.toFixed(1)} s recorded, rms ${base.rms.toFixed(3)}, ` +
            `worst step ${base.worst.toFixed(4)} (${(base.worst / base.p9999).toFixed(2)}× its own 99.99th), ` +
            `holes ${base.holes.length}`);

console.log('\n  · the loop that seeks (what shipped before)');
const old = await measure(true);
console.log(`    ${old.r.sec.toFixed(1)} s recorded, rms ${old.r.rms.toFixed(3)}, ` +
            `worst step ${old.r.worst.toFixed(4)} (music's own 99.99th: ${old.r.p9999.toFixed(4)}), ` +
            `holes ${old.r.holes.length}, seeks ${old.seeks}`);

console.log('\n  · the loop that does not');
const neu = await measure(false);
console.log(`    ${neu.r.sec.toFixed(1)} s recorded, rms ${neu.r.rms.toFixed(3)}, ` +
            `worst step ${neu.r.worst.toFixed(4)} (music's own 99.99th: ${neu.r.p9999.toFixed(4)}), ` +
            `holes ${neu.r.holes.length} (${neu.quiet} of them in the loop's own audio), seeks ${neu.seeks}`);
console.log('');

/* THE CLAIM, one assertion at a time. */
R('the tape calibrated itself against this device', neu.engaged.K != null,
  'K=' + (neu.engaged.K == null ? 'null' : neu.engaged.K.toFixed(4)));
R('the loop handed over to the audio thread', neu.engaged.on,
  `on=${neu.engaged.on} armed=${neu.engaged.armed} after ${neu.engaged.laps} lap(s)`);
/* THE PERIOD IS THE PERIOD. A buffer source loops between two sample indices,
   so the cycle cannot drift — but it can be the WRONG length if the cut was cut
   wrong, and that is a loop that slides off the phrase over a minute. */
const wantN = Math.round(neu.setup.len * neu.engaged.sr);
R('…and the cycle it loops is exactly the loop that was asked for',
  Math.abs(neu.engaged.bufLen - wantN) <= 1 &&
  Math.abs(neu.engaged.loopEnd - neu.setup.len) < 2 / neu.engaged.sr,
  `${neu.engaged.bufLen} samples vs ${wantN} wanted (${neu.setup.len.toFixed(4)} s at ${neu.setup.bpm.toFixed(1)} bpm)`);
R('the room was taken from the decks, not muted at them',
  neu.engaged.gate < 0.01 && neu.engaged.out > 0.99,
  `busGate=${neu.engaged.gate.toFixed(3)} loop=${neu.engaged.out.toFixed(3)}`);

/* THE ONE NUMBER. Every cycle of the old loop wrote the playhead; the new one
   must not write it at all, for as long as it is held. */
R('NOT ONE SEEK while the loop is held', neu.seeks === 0, 'seeks=' + neu.seeks);
R('…where the old path seeks every single cycle', old.seeks >= 3,
  `${old.seeks} seeks in ${old.r.sec.toFixed(1)} s of a ${old.setup.len.toFixed(2)} s loop`);

/* AND WHAT THAT SOUNDS LIKE. The wrap is between two samples that were adjacent
   on the tape, so the output should contain no step the music does not already
   contain. This is measured rather than reasoned about because the reasoning is
   exactly what was wrong last time. */
/* THE SEAM ITSELF, measured where it actually happens. The loop's last sample
   and its first are neighbours in the recording the tape made, because the head
   of the buffer was blended with the audio that really did follow the out-point.
   So the wrap must be no larger a step than the music's own largest — checked in
   the buffer, where the audio thread's wrap is bit-exact and there is no
   instrument in the way and no run-to-run noise at all. */
const W = neu.engaged.wrap;
R('the wrap is a step the music itself already contains', !!W && W.step <= W.p9999,
  W ? `wrap ${W.step.toFixed(5)} vs the loop's own 99.99th ${W.p9999.toFixed(5)}` : 'no buffer');
R('…and not merely a quiet passage where anything would join cleanly',
  !!W && W.max > 0.01, W ? "the loop's largest step is " + W.max.toFixed(4) : '');
/* The RECORDED output is reported rather than asserted on. The recorder is a
   main-thread processor sharing a starved thread with the render loop, and the
   baseline above — plain playback, no loop, nothing spliced — shows its own
   artefacts running three to four times the music's 99.99th percentile, which is
   larger than the fault this is looking for. So it is held to the instrument's
   own floor, and the claims that matter are carried by the wrap, the holes and
   the seek count, none of which jitter can fake. */
R('the recorded output is no rougher than plain playback through the same recorder',
  neu.r.worst / neu.r.p9999 <= Math.max(2.5, (base.worst / base.p9999) * 1.3),
  `taped ${(neu.r.worst / neu.r.p9999).toFixed(2)}×, seeking ${(old.r.worst / old.r.p9999).toFixed(2)}×, ` +
  `instrument ${(base.worst / base.p9999).toFixed(2)}×`);
/* A HOLE PER CYCLE that is also in the buffer is the music being quiet; a hole
   the buffer does not contain is the seam. Only the second kind is a fault. */
const perCycle = Math.ceil(neu.r.sec / neu.setup.len);
R('no hole the loop\'s own audio does not already have',
  neu.r.holes.length <= neu.quiet * perCycle,
  `${neu.r.holes.length} in the output, ${neu.quiet} in the buffer × ${perCycle} cycles`);
R('the music never stopped for any of it', neu.playing && neu.r.rms > 0.01,
  `rms=${neu.r.rms.toFixed(3)}`);

/* LETTING GO. A handback is a splice too, and it is the one place the new path
   DOES seek — once, early, while the loop is still covering for it. */
const after = await page.evaluate(() => ({
  gate: AE.busGate.gain.value, out: LOOPER.out ? LOOPER.out.gain.value : 0,
  on: LOOPER.on, loop: !!FX.loop, playing: player.playing,
}));
R('letting go gives the room back to the decks', after.gate > 0.99 && after.out < 0.01 && !after.on,
  `busGate=${after.gate.toFixed(3)} loop=${after.out.toFixed(3)}`);
R('…with the music still playing afterwards', after.playing && !after.loop);

/* A ROLL IS STILL A ROLL. It stalls the music while the track runs on
   underneath, and now it does that literally: the deck is never touched, so on
   release it is already exactly where it would have been. */
const roll = await page.evaluate(async () => {
  FX.setLoop(1, true);
  const t = Date.now();
  while (!LOOPER.on && Date.now() - t < 15000) await new Promise(r => setTimeout(r, 30));
  const held = LOOPER.on;
  // measured from the handover, because before it the booth's own re-seek loop
  // is legitimately holding the loop and legitimately seeking to do so
  const d = activeDeck(), t0 = d.a.currentTime;
  window.__seeks = 0;
  await new Promise(r => setTimeout(r, 2200));
  const ran = d.a.currentTime - t0, during = window.__seeks;
  FX.clearLoop();
  await new Promise(r => setTimeout(r, 400));
  return { held, ran, during, onRelease: window.__seeks - during, after: d.a.currentTime - t0 };
});
R('a roll engages the same way', roll.held);
R('…and the track really did run on underneath it, untouched', roll.ran > 2.0 && roll.during === 0,
  `advanced ${roll.ran.toFixed(2)} s in 2.2 s, ${roll.during} seeks`);
/* THE ROLL'S RELEASE IS THE ONE HANDBACK THAT COSTS NOTHING. A latched loop has
   to put the deck back inside itself; a roll does not, because the deck was
   never held — it ran on underneath, which is the roll's whole idea, and now it
   does that literally rather than by arithmetic. */
R('…so releasing it needs no seek at all', roll.onRelease === 0, 'seeks=' + roll.onRelease);

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
