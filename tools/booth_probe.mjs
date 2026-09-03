/* BOOTH PROBE — does the performance layer actually DO anything?
 *
 * A booth is the easiest thing in an app to fake. Pads light, knobs move, labels
 * update, and none of it reaches the sound; every unit test passes because the
 * arithmetic was never the hard part. So this measures OUTPUT — an analyser on
 * the rack's own out, after the effect — and asks whether the room changed.
 *
 * THE INSTRUMENT, and why it is built this way. The first version compared the
 * master's spectrum with an effect bypassed against the master's spectrum a
 * second later with it engaged, and the readings were nonsense: measured on the
 * fixture, the >4kHz band of the DRY signal alone ran 0 → 31554 → 1168 across
 * three consecutive reads. That is not an effect, that is music. A spectrum
 * taken at two different moments of a song compares two different songs.
 *
 * So the rack is characterised on a BENCH: its input is swapped off the bus and
 * onto a deterministic generated signal — pink noise for the filters and the
 * gate, a sine for the saturation — measured, and swapped back. The nodes, the
 * params and FX.apply() under test are the real ones; only the signal holds
 * still. Sharp thresholds become meaningful because the same signal goes in
 * every run.
 *
 * A bench can be wired to nothing, though, so it is paired with one check on the
 * REAL music: the gate, measured in the time domain. A gate's signature is that
 * the level repeatedly falls to near-silence and returns, which no amount of
 * musical variation imitates — so it proves the rack is in the path of the
 * actual playing track, which is what the bench cannot prove.
 *
 *   transport  a loop must actually pull the playhead back, hold it on the
 *              beat grid, and a roll must return it to real time — the one
 *              difference that makes them two controls rather than one.
 *   safety     nothing here may stop, mute or strand playback, and the whole
 *              rack must return to bypass on release. A booth that leaves the
 *              master filtered after a track change is worse than no booth.
 *
 * ONE MORE LESSON, PAID FOR: the fixture's tracks are 20-30s and the run is
 * longer than that, so playback used to walk off the end mid-measurement — and
 * a track change calls FX.release(), which parks the rack. Readings were being
 * taken with the effect switched off by the app, on a different song. Every
 * timed check now runs under deck(), which fails loudly if the track changed
 * underneath it rather than quietly reporting the wrong number.
 *
 *   node tools/booth_probe.mjs /tmp/mb8-mix
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, copyFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR = process.argv[2] || '/tmp/mb8-mix';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const f of ['index.html', 'sw.js', 'three.min.js']){
  const from = join(ROOT, 'docs', f);
  if (existsSync(from) && existsSync(DIR)) copyFileSync(from, join(DIR, f));
}
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };
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
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext()).newPage();
let pass = 0, fail = 0, open = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
};
/* A KNOWN-OPEN DEFECT IS NOT A TEST FAILURE — it is a number with a name, same
 * convention as mix_probe. OPEN items print their measurement and do not affect
 * the exit code; when one starts holding, promote it to R(). */
const O = (name, ok, detail) => {
  open++;
  console.log((ok ? '  ok?  ' : '  OPEN ') + name + (detail ? '  · ' + detail : ''));
};
const errs = [];
const NOISE = /404|Failed to fetch|net::ERR|NotAllowedError|The play\(\) request/;
page.on('pageerror', e => { const m = String(e).split('\n')[0]; if (!NOISE.test(m.slice(0, 60))) errs.push(m); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 40000 });
await page.evaluate(() => {
  for (const id of ['firstRun', 'help', 'coach', 'onboard', 'library', 'console', 'playlist', 'emptyState', 'splash'])
    { const n = document.getElementById(id); if (n) n.style.display = 'none'; }
});

const started = await page.evaluate(() => {
  if (!player.tracks.length) return null;
  /* repeat:'one' is the switch that disables the app's auto-crossfade (see the
     `player.repeat !== 'one'` guard on it). Without it the crate hands over to
     the next track a whole XFADE before the end, mid-measurement, and a hand-over
     calls FX.release(). Between this and the deck watchdog below, nothing can
     change track under a reading except the probe itself. */
  player.repeat = 'one'; player.shuffle = false;
  MIXER.setOn(false);                       // the seam is measured elsewhere; this is the booth
  player.playIndex(0);
  return player.tracks[0].title;
});
if (!started){ console.log('fixture has no tracks'); await browser.close(); server.close(); process.exit(1); }
await page.waitForFunction('player.playing && AE.fx && activeDeck() && activeDeck().a.currentTime > 0.5',
  null, { timeout: 40000 });
R('the FX rack is inserted on the master', await page.evaluate(() => !!(AE.fx && AE.fx.out)),
  'bus → filter → gate → drive → echo → master');

/* KEEP THE FIXTURE FROM RUNNING OUT UNDER A MEASUREMENT. Every track here is
   20-30 s and this run is minutes; a track that ends calls playIndex, which calls
   FX.release(), which parks the rack. That is correct behaviour and it was
   quietly destroying readings — a filter measured as "47% of dry kept" turned out
   to be a filter the app had switched off half way through. BOTH decks are held
   back, not just the active one: the idle deck is still rolling whatever it was
   playing, and its `ended` is what advances the crate underneath us. Nothing the
   booth does depends on where in a file the playhead sits, so this changes no
   measurement — it only stops the crate moving during one. */
await page.evaluate(() => {
  const act = AE.active;
  (AE.decks || []).forEach((d, i) => {          // an earlier hand-over may have left one rolling
    if (i !== act && d && d.a && !d.a.paused){ try { d.a.pause(); } catch (e){} }
  });
  setInterval(() => {
    for (const d of (AE.decks || [])){
      const a = d && d.a;
      if (FX.loop) continue;                    // never fight a loop the probe is measuring
      if (a && !a.paused && isFinite(a.duration) && a.duration > 8 && a.currentTime > a.duration - 4)
        { try { a.currentTime = 1; } catch (e){} }
    }
  }, 300);
});

await page.evaluate(() => {
  /* THE TAPS. Two, because the questions are different shapes: a spectrum
     analyser answers "which bands are here", and a short time-domain window
     answers "is the level being taken away and given back". Using the first for
     the second is what made the gate unmeasurable — an FFT over 2048 samples
     (46 ms) with smoothing on cannot see a 45 ms hole. */
  /* 16384 samples — 371 ms — because the bottom of the range is the point. A
     2048-sample window cannot resolve a 60 Hz cycle, so those bins wander by
     several percent between reads, and in linear power on a pink signal they are
     also the biggest contributors. That variance alone made a bypassed filter
     differ from a bypassed filter by 5%. Resolution, not averaging, is the fix. */
  const an = AE.ctx.createAnalyser();
  an.fftSize = 16384; an.smoothingTimeConstant = 0.3;
  AE.fx.out.connect(an);
  /* IN LINEAR POWER, NOT BYTES. getByteFrequencyData is a dB scale clamped at
     -100 dB, so a band the filter has cut by 46 dB still comes back as a
     respectable byte value — sum 800 of those and a demolished low end reads as
     "101% of dry". The first pass at this probe believed that number. Float dB
     converted back to power makes a cut a cut: -46 dB is 0.002 of the original,
     which is what the ear hears and what a threshold can be set against. */
  window.__spec = () => {
    const b = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(b);
    const nyq = AE.ctx.sampleRate / 2, per = nyq / b.length;
    /* THREE BANDS, and the bottom of the range left out of all of them. Below
       ~60 Hz a 46 ms window cannot resolve a cycle, so those bins wander — and
       in LINEAR power they are also the largest, because the bench signal is
       pink. Including them made a bypassed filter differ from a bypassed filter
       by several percent. What is measured is what can be measured. */
    let lo = 0, mid = 0, hi = 0, all = 0;
    for (let i = 0; i < b.length; i++){
      const f = i * per;
      if (f < 60) continue;
      const p = b[i] <= -180 ? 0 : Math.pow(10, b[i] / 10);
      all += p;
      if (f < 500) lo += p; else if (f < 4000) mid += p; else hi += p;
    }
    return { lo, mid, hi, all };
  };
  const td = AE.ctx.createAnalyser();
  td.fftSize = 256; td.smoothingTimeConstant = 0;     // 5.8 ms, unsmoothed
  AE.fx.out.connect(td);
  window.__rms = () => {
    const b = new Float32Array(td.fftSize);
    td.getFloatTimeDomainData(b);
    let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    return Math.sqrt(s / b.length);
  };

  /* THE BENCH. The rack's input is swapped off the bus and onto a signal that
     holds still, so a spectrum measured now and a spectrum measured in four
     seconds differ only by what the rack did to them. Everything under test —
     nodes, params, FX.apply() — is the shipping rack; only the source changes.
     The generator is seeded, so the same signal is measured every run. */
  window.__benchOn = mode => {
    const ctx = AE.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 2);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    if (mode === 'sine'){
      // 900 Hz. A tanh is odd-symmetric, so saturation lands harmonics at 2700,
      // 4500, 6300 — a >4kHz band that is empty when clean and full when driven.
      for (let i = 0; i < len; i++) d[i] = Math.sin(2 * Math.PI * 900 * i / sr) * 0.9;
    } else {
      let s = 12345, b0 = 0, b1 = 0, b2 = 0;          // seeded LCG → pinkish noise
      for (let i = 0; i < len; i++){
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const w = s / 0x40000000 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(AE.fx.in); src.start();
    try { AE.bus.disconnect(AE.fx.in); } catch (e){}   // the music steps aside
    window.__masterWas = AE.master.gain.value;
    AE.master.gain.value = 0;                          // measured at fx.out, not heard
    window.__bench = src;
  };
  window.__benchOff = () => {
    try { window.__bench.stop(); window.__bench.disconnect(); } catch (e){}
    window.__bench = null;
    try { AE.bus.connect(AE.fx.in); } catch (e){}
    if (window.__masterWas != null) AE.master.gain.value = window.__masterWas;
  };
  window.__deckId = () => {
    const d = activeDeck();
    return player.cur + '|' + (d && d.a ? d.a.src : '') + '|' + (player.playing ? 1 : 0);
  };
});
// average a few reads: one frame of a spectrum is noise, several are a measurement
const spec = async ms => page.evaluate(t => new Promise(res => {
  const acc = { lo: 0, mid: 0, hi: 0, all: 0 }; let n = 0;
  const iv = setInterval(() => {
    const s = window.__spec();
    for (const k of ['lo', 'mid', 'hi', 'all']) acc[k] += s[k];
    n++;
    if (n * 40 >= t){
      clearInterval(iv);
      const o = { n }; for (const k of ['lo', 'mid', 'hi', 'all']) o[k] = acc[k] / n;
      res(o);
    }
  }, 40);
}), ms);
// the envelope, sampled far faster than any beat division: 120 reads over 1.2 s
const env = () => page.evaluate(() => new Promise(res => {
  const v = []; let n = 0;
  const iv = setInterval(() => { v.push(window.__rms()); if (++n >= 120){ clearInterval(iv); res(v); } }, 10);
}));
/* THE CONTRAST, as the 5th percentile over the 95th. A gate drops the level to
   near-silence on every slice and gives it back; music that is merely loud and
   quiet does not repeatedly touch zero. Percentiles rather than min and max, so
   one unlucky read cannot decide the check either way — and against the 95th
   rather than the MEAN, because at full depth this gate is open for only 18% of
   each slice, which pulls the mean down into the hole and flatters the ratio
   until it means nothing. Top against bottom is what a gate does. */
const floor = a => {
  const s = a.slice().sort((x, y) => x - y);
  const hi = s[Math.floor(a.length * 0.95)];
  return hi > 0 ? s[Math.floor(a.length * 0.05)] / hi : 1;
};

const setFx = (unit, amount, div) => page.evaluate(([u, a, d]) => {
  FX.auto = false;
  if (d) FX.div = d;
  FX.set(u, a);
}, [unit, amount, div || null]);
// restart the fixture's first track so a timed section has runway; these tracks
// are 20-30 s and a track change parks the rack
const freshTrack = async () => {
  await page.evaluate(() => { player.playIndex(0); });
  /* AND WAIT FOR THE DECK TO ACTUALLY BE THE NEW ONE. activeDeck() still points at
     the outgoing deck for a moment after playIndex, and that deck is seconds into
     its own track — so waiting for "currentTime > 0.4" was satisfied instantly by
     the track we were trying to leave, and the id captured here belonged to it.
     The upper bound is the whole fix: only a freshly started track is near zero. */
  await page.waitForFunction(
    'player.playing && player.cur === 0 && activeDeck() && activeDeck().a.currentTime > 0.4'
    + ' && activeDeck().a.currentTime < 5', null, { timeout: 20000 });
  return page.evaluate(() => window.__deckId());
};
// what the deck was doing when a timed measurement started, and whether it is
// still doing it — a reading taken across a track change is not a reading
const deckHeld = async id => {
  const now = await page.evaluate(() => window.__deckId()
    + '|t=' + (activeDeck() ? activeDeck().a.currentTime.toFixed(1) : '?'));
  if (now.slice(0, id.length) === id) return true;
  console.log('     (the deck changed under this measurement: ' + id + ' → ' + now + ')');
  return false;
};

console.log('\nthe rack — each unit measured against a signal that holds still');
await page.evaluate(() => window.__benchOn('pink'));
await setFx('', 0);
await page.waitForTimeout(400);
const dry = await spec(500);

// FILTER, hard left: a closed lowpass must take the top off the room
await setFx('filter', 0.02);
await page.waitForTimeout(400);
const lowpass = await spec(500);
const hiKept = dry.hi > 0 ? lowpass.hi / dry.hi : 1;
R('filter: hard left closes the top down', hiKept < 0.25,
  'high band kept ' + (hiKept * 100).toFixed(0) + '% of dry');
// FILTER, hard right: a high highpass must take the bottom out
await setFx('filter', 0.98);
await page.waitForTimeout(400);
const hipass = await spec(500);
const loKept = dry.lo > 0 ? hipass.lo / dry.lo : 1;
R('filter: hard right takes the bottom out', loKept < 0.35,
  'low band kept ' + (loKept * 100).toFixed(0) + '% of dry');
/* AND THE CENTRE IS A REAL DETENT — not "nearly open", which is the usual way a
   bipolar filter knob is wrong. On the bench this can be asserted tightly: the
   same noise through the centre position must come back the same shape. */
/* THE CENTRE IS A REAL DETENT — measured band by band, because "nearly open" is
   the usual way a bipolar filter knob is quietly wrong and a single summed number
   hides a tilt. Averaged over 2.04 s, one full turn of the 2 s noise loop, so
   both readings see the same signal; and against a bypass taken immediately
   before rather than four seconds and two filter sweeps earlier. */
await setFx('', 0); await page.waitForTimeout(300);
const dryNow = await spec(2040);
await setFx('filter', 0.5);
await page.waitForTimeout(300);
const centre = await spec(2040);
const bands = ['lo', 'mid', 'hi'].map(k => Math.abs(centre[k] - dryNow[k]) / Math.max(1e-12, dryNow[k]));
const worst = Math.max.apply(null, bands);
R('filter: the centre detent is genuinely bypass', worst < 0.03,
  'lo/mid/hi within ' + bands.map(x => (x * 100).toFixed(1) + '%').join(' / ') + ' of bypass');

// THE EQ: a kill must take its band out of the room and leave the others alone;
// FLAT must be bypass to the same standard as the filter's detent
await setFx('', 0); await page.waitForTimeout(300);
const dryEq = await spec(1020);
await page.evaluate(() => FX.setEq('lo', EQ_KILL_DB)); await page.waitForTimeout(400);
const killLo = await spec(1020);
R('eq: KILL LOW takes the bottom out of the mix', dryEq.lo > 0 && killLo.lo / dryEq.lo < 0.15 && killLo.hi / dryEq.hi > 0.8,
  'low kept ' + (100 * killLo.lo / dryEq.lo).toFixed(1) + '% · high kept ' + (100 * killLo.hi / dryEq.hi).toFixed(0) + '%');
await page.evaluate(() => { FX.setEq('lo', EQ_KILL_DB); FX.setEq('hi', EQ_KILL_DB); }); await page.waitForTimeout(400);
const killHi = await spec(1020);
R('eq: KILL HI takes the top off, and pressing KILL LOW again gave the bottom back', dryEq.hi > 0 && killHi.hi / dryEq.hi < 0.15 && killHi.lo / dryEq.lo > 0.8,
  'high kept ' + (100 * killHi.hi / dryEq.hi).toFixed(1) + '% · low kept ' + (100 * killHi.lo / dryEq.lo).toFixed(0) + '%');
await page.evaluate(() => FX.flatEq()); await page.waitForTimeout(400);
const flat = await spec(2040);
const flatBands = ['lo', 'mid', 'hi'].map(k => Math.abs(flat[k] - dryEq[k]) / Math.max(1e-12, dryEq[k]));
// (8%, not the detent's 3%: this reading is four seconds and two kills away from
// its dry, and under load the sampler misses enough of the 2 s noise loop to
// move a low band by a few percent on its own)
R('eq: FLAT is bypass', Math.max.apply(null, flatBands) < 0.08,
  'lo/mid/hi within ' + flatBands.map(x => (x * 100).toFixed(1) + '%').join(' / ') + ' of dry');

// DRIVE: saturation adds harmonics — energy above a tone that had none
await page.evaluate(() => { window.__benchOff(); window.__benchOn('sine'); });
await setFx('', 0);
await page.waitForTimeout(400);
const clean = await spec(500);
await setFx('drive', 1);
await page.waitForTimeout(400);
const driven = await spec(500);
// as a share of the tone's own energy, so the reading does not depend on level
const upTop = x => x.all > 0 ? x.hi / x.all : 0;
R('drive: saturation puts energy up top that was not there', upTop(driven) > upTop(clean) * 4,
  'above 4k: ' + (upTop(clean) * 100).toFixed(3) + '% of a clean 900 Hz tone → '
    + (upTop(driven) * 100).toFixed(3) + '% driven');

/* GATE: the point is not that it is quieter, it is that the sound is
   PERIODICALLY taken away — a fader lowers the level, a gate removes it and
   gives it back in time. Measured on the bench first, where noise has an almost
   constant envelope and the hole is unmistakable. */
await page.evaluate(() => { window.__benchOff(); window.__benchOn('pink'); });
await setFx('', 0); await page.waitForTimeout(400);
const openB = floor(await env());
await setFx('gate', 1, 0.5);
await page.waitForTimeout(400);
const gateB = floor(await env());
R('gate: the sound is taken away and given back, not just turned down',
  gateB < 0.25 && gateB < openB * 0.4,
  'quiet/loud ' + openB.toFixed(2) + ' open → ' + gateB.toFixed(2) + ' gated');
await setFx('', 0);
await page.evaluate(() => window.__benchOff());
await page.waitForTimeout(400);

/* ---- and the bench is wired to the real thing ---- */
console.log('\nthe music — the bench proves the rack works, this proves it is in the path');
let id = await freshTrack();
await setFx('', 0); await page.waitForTimeout(300);
const openM = floor(await env());
await setFx('gate', 1, 1);
await page.waitForTimeout(400);
const gateM = floor(await env());
R('the gate reaches the actual playing track, not a test signal',
  (await deckHeld(id)) && gateM < openM * 0.4,
  'quiet/loud ' + openM.toFixed(2) + ' open → ' + gateM.toFixed(2) + ' gated on the music');
await setFx('', 0);

/* ---- transport: the one difference that makes loop and roll two controls ---- */
console.log('\nthe transport — a loop latches on the grid, a roll returns you to real time');
id = await freshTrack();
await page.evaluate(() => FX.release());
await page.waitForTimeout(300);
/* A LOOP IS JUDGED AGAINST THE TICK IT CAN FIRE ON. We re-seek a media element
   from the frame loop; under SwiftShader a frame is 40-60 ms, so the wrap cannot
   be sample-accurate and pretending otherwise would only make this flaky. What
   CAN be demanded — and is the thing that matters musically — is that the loop
   never leaves its bounds by more than one tick, and that its cycles do not
   walk late as they repeat. So the tick period is measured alongside, and the
   wrap-to-wrap period is checked against the loop length. */
const looped = await page.evaluate(() => new Promise(res => {
  const d = activeDeck();
  FX.setLoop(2, false);                       // two beats, latched
  const start = FX.loop.start, len = FX.loop.len;
  const seen = [], ticks = [], wraps = [];
  let last = performance.now(), prev = d.a.currentTime;
  /* SAMPLED ON A TIMER, NOT A FRAME. Under SwiftShader a frame here runs ~180 ms
     — a third of the loop — and wrap timestamps read off it carry ±180 ms of
     their own, which is larger than the drift being looked for. A 10 ms timer is
     throttled too, but nothing like as hard, and it is not coupled to the render
     the loop is being asked to survive. The rAF pass alongside it exists only to
     report the tick period the wrap can actually fire on. */
  const raf = () => { const n = performance.now(); ticks.push(n - last); last = n; requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  const iv = setInterval(() => {
    /* THE POSITION THE ROOM HEARS. Once the tape has taken the loop the deck
       runs on underneath it, muted, by design — its playhead is no longer where
       the music is. The loop's own phase is. */
    const t = LOOPER.on ? LOOPER.start + loopPhaseAt(AE.ctx.currentTime, LOOPER.handAt, LOOPER.len) : d.a.currentTime;
    if (t < prev - len * 0.4) wraps.push(performance.now() / 1000);   // the playhead jumped back
    prev = t; seen.push(t);
  }, 10);
  setTimeout(() => {
    clearInterval(iv);
    FX.clearLoop();
    /* THE MEDIAN GAP, not the mean. The sampler can itself stall for longer than
       the loop — a 1 s hitch in a 10 ms timer is not rare on this renderer — and
       a stall that spans a whole cycle makes the probe MISS a wrap, which shows
       up as one double-length gap and drags a mean straight through the
       threshold. It cost one false failure at 1137 ms for a 968 ms loop. A
       missed wrap cannot move a median. */
    const gaps = [];
    for (let i = 1; i < wraps.length; i++) gaps.push(wraps[i] - wraps[i - 1]);
    gaps.sort((a, b) => a - b);
    ticks.sort((a, b) => a - b);
    res({ start, len, max: Math.max.apply(null, seen), min: Math.min.apply(null, seen),
      tick: ticks[ticks.length >> 1] / 1000, wraps: wraps.length,
      period: gaps.length ? gaps[gaps.length >> 1] : 0 });
  }, 7200);
}));
const slack = Math.max(0.05, looped.tick * 1.5);
const over = looped.max - (looped.start + looped.len);
R('a loop actually holds the playhead inside it',
  (await deckHeld(id)) && over <= slack && looped.min >= looped.start - 0.02,
  'bounds [' + looped.start.toFixed(2) + ', ' + (looped.start + looped.len).toFixed(2) + '] · observed '
    + looped.min.toFixed(2) + '–' + looped.max.toFixed(2) + ' · over by ' + (over * 1000).toFixed(0)
    + 'ms against a ' + (looped.tick * 1000).toFixed(0) + 'ms tick');
/* THE WRAP COSTS WHAT THE PLATFORM CHARGES. loopWrap's arithmetic — carry the
   overshoot so cycles cannot compound — is proved in the unit tests, where it is
   exact. What cannot be fixed from here is the SEEK: re-pointing a streaming
   media element flushes its buffer and restarts its decoder, and that costs real
   time during which the playhead does not move. Measured on this software
   renderer it runs from ~0 to ~450 ms per wrap depending on how hard the machine
   is breathing, which lands the cycle anywhere from 968 ms to 1.4 s for a 968 ms
   loop. So this is tracked as a number, not asserted as a contract: asserting it
   would be asserting the host's seek latency.

   Buying it back would mean decoding loops through an AudioBufferSource, which
   is genuinely sample-accurate — and which the rest of the app deliberately does
   not do, because streaming elements are what keep iOS's decoder budget and
   background-audio blessing intact. That trade is the app's, not this loop's. */
const excess = looped.period - looped.len;
O('and its cycles do not walk late as it repeats',
  looped.wraps >= 4 && excess < looped.len * 0.06,
  looped.wraps + ' wraps, a median ' + (looped.period * 1000).toFixed(0) + 'ms apart for a '
    + (looped.len * 1000).toFixed(0) + 'ms loop · ' + (excess * 1000).toFixed(0)
    + 'ms of it the element seek, against a ' + (looped.tick * 1000).toFixed(0) + 'ms tick');

/* AND THE BOOTH MAY NOT TAKE A RATE IT DOES NOT OWN. release() puts playbackRate
   back, which is right after a brake and wrong during a seam — the mixer sets
   both decks' rates to tempo-match, and commitMix() calls release() immediately
   afterwards. That collision only showed up as an occasional blown beat lock in
   mix_probe, roughly one seam in three, so it is pinned here instead: state the
   rule directly and let it fail every time rather than sometimes. */
const owns = await page.evaluate(() => {
  const d = activeDeck(), out = {};
  FX.brakeT = -1;                                   // no brake: the rate is not ours
  d.a.playbackRate = 1.031;                         // as a tempo match would leave it
  FX.release();
  out.matchKept = +d.a.playbackRate.toFixed(4);
  FX.brakeT = 0; FX._brakeSec = 1; FX._brakeFrom = 1;   // a brake: the rate IS ours
  d.a.playbackRate = 0.4;
  FX.release();
  out.brakeUndone = +d.a.playbackRate.toFixed(4);
  out.want = +SPEED.rate.toFixed(4);
  return out;
});
R('release hands back a rate the brake took, and leaves a tempo match alone',
  Math.abs(owns.matchKept - 1.031) < 1e-3 && Math.abs(owns.brakeUndone - owns.want) < 1e-3,
  JSON.stringify(owns));

id = await freshTrack();
const rolled = await page.evaluate(() => new Promise(res => {
  const d = activeDeck();
  const before = d.a.currentTime;
  const t0 = performance.now();
  FX.setLoop(1, true);                        // the same length, as a ROLL
  setTimeout(() => {
    const held = (performance.now() - t0) / 1000;
    FX.clearLoop();
    setTimeout(() => res({ before, after: d.a.currentTime, held }), 60);
  }, 1400);
}));
/* THE CLAIM: the track ran on underneath while the music stalled, so releasing
   lands roughly where it would have been — not back at the loop's in-point. If
   these ever agreed, one of the two controls would be pointless. */
const advanced = rolled.after - rolled.before;
R('a roll returns the playhead to real time, not to the loop',
  (await deckHeld(id)) && advanced > rolled.held * 0.6,
  'held ' + rolled.held.toFixed(2) + 's, playhead advanced ' + advanced.toFixed(2) + 's');

/* ---- safety: a booth may never strand the music ---- */
console.log('\nsafety — the booth hands everything back');
id = await freshTrack();
const braked = await page.evaluate(() => new Promise(res => {
  const d = activeDeck();
  FX.brake(0.8);
  setTimeout(() => res({ mid: d.a.playbackRate, playing: !d.a.paused }), 400);
}));
R('brake: the deck slows without ever pausing',
  braked.mid < 0.85 && braked.mid > 0.05 && braked.playing,
  'rate ' + braked.mid.toFixed(3) + ' · still rolling ' + braked.playing);
await page.waitForTimeout(1600);
const after = await page.evaluate(() => ({
  rate: activeDeck().a.playbackRate, playing: !activeDeck().a.paused, brakeT: FX.brakeT,
}));
R('brake: and comes back to unity on its own',
  (await deckHeld(id)) && Math.abs(after.rate - 1) < 0.02 && after.playing && after.brakeT < 0,
  'rate ' + after.rate.toFixed(3));

await setFx('filter', 0.02);
await page.waitForTimeout(300);
await page.evaluate(() => FX.release());
await page.waitForTimeout(500);
const parked = await page.evaluate(() => ({
  lp: Math.round(AE.fx.lp.frequency.value), hp: Math.round(AE.fx.hp.frequency.value),
  gate: +AE.fx.gate.gain.value.toFixed(3), send: +AE.fx.send.gain.value.toFixed(3),
  wet: +AE.fx.driveWet.gain.value.toFixed(3), unit: FX.unit, loop: !!FX.loop,
}));
R('release parks the whole rack at bypass',
  parked.lp > 18000 && parked.hp < 40 && parked.gate > 0.95 && parked.send < 0.02
    && parked.wet < 0.02 && !parked.unit && !parked.loop,
  JSON.stringify(parked));
const audible = await page.evaluate(() => new Promise(res => {
  const v = []; let n = 0;
  const iv = setInterval(() => { v.push(window.__rms()); if (++n >= 40){ clearInterval(iv); res(v); } }, 10);
})).then(v => v.reduce((a, b) => a + b, 0) / v.length);
R('and the music is still there afterwards', audible > 0.005,
  'rms ' + audible.toFixed(4) + ' at the rack out');

/* A TRACK CHANGE MUST HAND THE BOOTH OVER TOO. A loop or an effect belonged to
   the track that just left; carrying it into the next one is the fault this
   check exists to catch. */
await setFx('echo', 0.9);
await page.evaluate(() => FX.setLoop(4, false));
await page.evaluate(() => player.playIndex(1));
await page.waitForTimeout(1200);
const handed = await page.evaluate(() => ({
  unit: FX.unit, loop: !!FX.loop, send: +AE.fx.send.gain.value.toFixed(3),
  rate: activeDeck().a.playbackRate,
}));
R('a new track never inherits the last one\'s booth',
  !handed.unit && !handed.loop && handed.send < 0.02 && Math.abs(handed.rate - 1) < 0.02,
  JSON.stringify(handed));

/* ---- the room's own hands ---- */
console.log('\nAUTO — the room reaches for an effect only where the song earns it');
const auto = await page.evaluate(() => {
  const calm = fxAutoPick({ ceil: 0.3, act: 0, phase: 'flow', energy: 0.2, bar: 2 });
  const build = fxAutoPick({ ceil: 1, act: 1, phase: 'build', energy: 0.8, bar: 2 });
  const seam = fxAutoPick({ ceil: 1, act: 2, phase: 'peak', energy: 0.9, bar: 2, toSeam: 1.5 });
  return { calm, build, seam };
});
R('AUTO stays out of a quiet passage and reaches at a build or a hand-off',
  auto.calm === 'none' && auto.build === 'filter' && auto.seam === 'echo',
  JSON.stringify(auto));
/* A HAND TAKES THE BOOTH AND KEEPS IT. Handing control back on a timer sounds
   considerate and is a footgun — a performer holding a filter would watch the
   room undo it, and the room never tires. It stays off until the listener arms
   it again, which is one visible, deliberate tap. */
const handWins = await page.evaluate(() => new Promise(res => {
  FX.auto = true;
  FX.hand();
  const immediately = FX.auto;
  setTimeout(() => res({ immediately, later: FX.auto }), 1200);
}));
R('a hand takes the booth and keeps it until AUTO is armed again',
  handWins.immediately === false && handWins.later === false, JSON.stringify(handWins));

if (errs.length){
  console.log('\n  page errors:');
  for (const e of errs.slice(0, 6)) console.log('   ' + e.slice(0, 200));
}
/* THE TRANSPORT'S NEW HANDS, on the real track: a beat jump moves the playhead
   by exactly the beats asked for, and a hot cue set mid-beat snaps to the grid,
   then jumps back to it ON the beat line rather than the instant the pad went
   down — quantised, the way a CDJ quantises. */
const jumpId = await freshTrack();
await page.evaluate(() => { FX.release(); FX.auto = false; });
await page.waitForTimeout(600);
const bj = await page.evaluate(async () => {
  const d = activeDeck(), spb = 60 / FX.bpm();
  const t0 = d.a.currentTime, c0 = AE.ctx.currentTime;
  FX.beatJump(4);
  await new Promise(r => setTimeout(r, 350));
  const moved = d.a.currentTime - t0 - (AE.ctx.currentTime - c0) * (d.a.playbackRate || 1);
  return { moved, want: 4 * spb, grid: CLOCK.haveGrid, bpm: FX.bpm() };
});
R('beat jump: four beats forward is four beats forward', Math.abs(bj.moved - bj.want) < 0.12,
  'moved ' + bj.moved.toFixed(3) + ' s, four beats at ' + bj.bpm.toFixed(1) + ' bpm is ' + bj.want.toFixed(3) + ' s');
const cue = await page.evaluate(async () => {
  const d = activeDeck(), spb = 60 / FX.bpm(), grid = FX.grid();
  const here = d.a.currentTime;
  const at = CUES.set(0);                               // snapped
  if (!(at >= 0) || !isFinite(spb)) return { bad: { at, spb, here, grid, bpm: FX.bpm(), have: CLOCK.haveGrid, key: CUES.key, slots: CUES.slots, playing: player.playing } };
  const onGrid = Math.abs(((at - grid) / spb) - Math.round((at - grid) / spb)) < 1e-6;
  const near = Math.abs(at - here) <= spb / 2 + 0.01;
  // walk away, then press mid-beat: it must wait for the line
  d.a.currentTime = at + 3.1 * spb;
  await new Promise(r => setTimeout(r, 400));
  const pos = d.a.currentTime;
  const phase = ((pos - grid) % spb + spb) % spb;
  CUES.press(0);
  const waited = !!FX.jump;
  const t = Date.now();
  while (FX.jump && Date.now() - t < 3000) await new Promise(r => setTimeout(r, 10));
  const fired = Date.now();                             // the jump went on the beat line, not at the press
  await new Promise(r => setTimeout(r, 250));
  // where the playhead is now, minus what has elapsed since the landing, should be the cue
  const back = d.a.currentTime;
  const land = back - ((Date.now() - fired) / 1000) * (d.a.playbackRate || 1);
  const phaseNow = ((back - grid) % spb + spb) % spb;
  CUES.del(0);
  return { at, onGrid, near, waited, phaseAtPress: phase / spb, landErr: land - at, phaseErr: Math.min(phaseNow, spb - phaseNow), spb, grid: CLOCK.haveGrid };
});
if (cue.bad) console.log('     (the cue check could not run: ' + JSON.stringify(cue.bad) + ')');
R('hot cue: set mid-beat, it snaps to the nearest beat line', !cue.bad && cue.onGrid && cue.near, cue.bad ? 'no cue' : 'cue at ' + cue.at.toFixed(3) + ' s');
R('hot cue: pressed mid-beat, the jump waits for the line', !cue.bad && (!cue.grid || cue.waited || cue.phaseAtPress < 0.05),
  cue.bad ? 'no cue' : 'phase at press ' + cue.phaseAtPress.toFixed(2) + ' beat · waited=' + cue.waited);
R('…and lands on the cue with the beat phase intact', !cue.bad && Math.abs(cue.landErr) < 0.35 && cue.phaseErr < 0.06,
  cue.bad ? 'no cue' : 'landed ' + (cue.landErr * 1000).toFixed(0) + ' ms from the cue · beat phase off by ' + (cue.phaseErr * 1000).toFixed(0) + ' ms');
await deckHeld(jumpId);

R('no page errors across the run', errs.length === 0, errs.length + ' errors');
console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + open + ' tracked as open');
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
