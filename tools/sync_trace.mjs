// SYNC TRACE — how tight is a live beatmix, measured on the AUDIO.
//
// Every beat of a real seam, two ways:
//   TRUE flam   each deck's own signal tapped off its source node into an
//               AudioWorklet, onsets timed on the render thread to the sample:
//               B's hit minus the nearest A hit. This is what a listener hears.
//   per-deck    heard − reported: where each deck's onset sits against the
//               media time its element reported at that audio instant. Near
//               zero means the element's clock can be steered by; it is NOT
//               near zero under the browser's pitch-preserving stretcher,
//               which is why a beatmix rides vinyl (see MIXER.fire).
// plus the mixer's own view: the take (seek / pull / latch), the sampler's
// reads, and the rates it set.
//
//   python3 tools/make_mix_fixture.py /tmp/mb8-mix && cp docs/three.min.js /tmp/mb8-mix/
//   cp docs/index.html /tmp/mb8-mix/ && node tools/sync_trace.mjs /tmp/mb8-mix [runs]
//
//   FAST=1    stub the WebGL draw — a stand-in for a real GPU (the software
//             renderer here spends ~100 ms a frame; a Mac a few)
//   NOSEEK=1  forbid the take's seeks, to see what tempo alone does
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIR = process.argv[2] || '/tmp/mb8-mix';
const RUNS = +(process.argv[3] || 3);
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  if (range){
    const s0 = +range[1], e = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s0}-${e}/${data.length}`, 'Content-Length': e - s0 + 1 });
    res.end(data.subarray(s0, e + 1));
  } else { res.writeHead(200, { ...headers, 'Content-Length': data.length }); res.end(data); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required',
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP cdnjs.cloudflare.com 127.0.0.1'],
});
const all = [];
for (let run = 0; run < RUNS; run++){
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => console.log('  [pageerror]', e.message.split('\n')[0]));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
  // FAST=1 stands in for a real GPU: the software renderer here spends ~100 ms a
  // frame, a Mac a few; stubbing the draw leaves every music-side path running
  if (process.env.FAST) await page.evaluate(() => { renderer.render = () => {}; });
  if (process.env.NOSEEK) await page.evaluate(() => {
    const orig = window.seamPhaseTrim;
    window.seamPhaseTrim = (e, ti, f, o) => orig(e, ti, f, Object.assign({}, o, { hardErr: 99 }));
  });
  await page.evaluate(() => {
    const byTitle = new Map(allTracks().map(t => [t.title, t]));
    player.tracks = ['alpha', 'beta', 'gamma'].map(n => byTitle.get(n)).filter(Boolean);
    player.cur = -1; player._bag = [];
    MIXER.setOn(true);
    player.playIndex(0);
  });
  await page.evaluate(async () => {
    // GROUND TRUTH: each deck's own audio, tapped straight off its source node
    // into an AudioWorklet — onsets timed on the render thread, to the sample,
    // on the audio clock. Detection runs on the first difference: the hats are
    // broadband clicks, the chord drone a low sine the difference all but erases.
    const code = `class Onset extends AudioWorkletProcessor {
      constructor(){ super(); this.prev = 0; this.last = -1; }
      process(ins){
        const x = ins[0] && ins[0][0]; if (!x) return true;
        for (let n = 0; n < x.length; n++){
          const dx = Math.abs(x[n] - this.prev); this.prev = x[n];
          const t = currentTime + n / sampleRate;
          if (dx > 0.03 && t - this.last > 0.2){ this.last = t; this.port.postMessage(t); }
        }
        return true;
      }
    } registerProcessor('onset', Onset);`;
    await AE.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    window.__on = [[], []];
    AE.decks.forEach((d, i) => {
      const w = new AudioWorkletNode(AE.ctx, 'onset');
      w.port.onmessage = e => window.__on[i].push(e.data);
      const z = AE.ctx.createGain(); z.gain.value = 0;
      d.src.connect(w); w.connect(z); z.connect(AE.ctx.destination);
    });
  });
  await page.evaluate(() => {
    window.__takeLog = [];
    const orig = MIXER._sample.bind(MIXER);
    window.__sampN = 0; window.__sampMoving = 0;
    MIXER._sample = function(){
      window.__sampN++; if (this._rolling) window.__sampMoving++;
      const a0 = this._aligns, l0 = this._latched, n0 = (this._errs || []).length;
      orig();
      const E = this._errs || [];
      if (E.length && (E.length !== n0 || E.length === 9)) (window.__sampLog = window.__sampLog || []).push([AE.ctx.currentTime, E[E.length - 1] * 1000]);
      if (this._aligns !== a0 || this._latched !== l0)
        window.__takeLog.push({ f: this.audioT0 != null ? +((AE.ctx.currentTime - this.audioT0) / this.overlap).toFixed(3) : null,
          err: +(window.__mixPhaseErrMs || 0).toFixed(1), aligns: this._aligns, latched: this._latched });
    };
  });
  await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 40000 });
  const trace = await page.evaluate(() => new Promise(res => {
    const p = MIXER.plan, rows = [];
    window.__pairs = [];
    const raf = () => { if (MIXER.phase !== 'running') return; const od = MIXER.outDeck, nd = AE.decks[AE.active];
      window.__pairs.push([AE.ctx.currentTime, od.a.currentTime, nd.a.currentTime]); requestAnimationFrame(raf); };
    raf();
    const iv = setInterval(() => {
      if (MIXER.phase !== 'running'){ clearInterval(iv); res({ plan: { beats: p.beats, bpmA: p.bpmA, bpmB: p.bpmB }, rows }); return; }
      const od = MIXER.outDeck, nd = AE.decks[AE.active];
      const errs = [];
      for (let k = 0; k < 40; k++){
        const tA = od.a.currentTime, tB = nd.a.currentTime;
        const phA = (((tA - p.startA) / (60 / p.bpmA)) % 1 + 1) % 1;
        const phB = (((tB - p.startB) / (60 / p.bpmB)) % 1 + 1) % 1;
        let e = phA - phB; if (e > 0.5) e -= 1; if (e < -0.5) e += 1;
        errs.push(e * 60 / p.bpmB * 1000);
      }
      errs.sort((a, b) => a - b);
      if (rows.length === 0 || performance.now() - (window.__lastRow || 0) > 200){ window.__lastRow = performance.now(); rows.push({ f: MIXER.lastF, ref: errs[errs.length >> 1], eng: window.__mixPhaseErrMs,
        rA: od.a.playbackRate, rB: nd.a.playbackRate, trim: MIXER.trim, aligns: MIXER._aligns, ppA: od.a.preservesPitch, ppB: nd.a.preservesPitch }); }
      if (!window.__seam) MIXER._traceBpm = p.bpmB, window.__seam = { t0: MIXER.audioT0, dur: MIXER.overlap, inIdx: AE.active };
    }, 20);
  }));
  const truth = await page.evaluate(() => {
    const s = window.__seam, A = window.__on[1 - s.inIdx], B = window.__on[s.inIdx];
    const out = [];
    for (const tb of B){
      if (tb < s.t0 || tb > s.t0 + s.dur) continue;
      let best = null;
      for (const ta of A) if (best == null || Math.abs(ta - tb) < Math.abs(best - tb)) best = ta;
      const spb = 60 / MIXER._traceBpm; if (best != null && Math.abs(best - tb) < spb / 2) out.push({ f: (tb - s.t0) / s.dur, ms: (tb - best) * 1000 });
    }
    return out;
  });
  const perDeck = await page.evaluate(() => {
    const s = window.__seam, P = window.__pairs;
    const one = (onsets, col, bpm) => onsets.filter(T => T > P[0][0] && T < P[P.length - 1][0]).map(T => {
      const k = P.findIndex(p => p[0] >= T); const [c0] = P[k - 1], [c1] = P[k];
      const M = P[k - 1][col] + (P[k][col] - P[k - 1][col]) * (T - c0) / Math.max(1e-6, c1 - c0);
      const spb = 60 / bpm, g = (M - 0.5) / spb;
      return ((M - (0.5 + Math.round(g) * spb)) * 1000).toFixed(1);
    });
    return { A: one(window.__on[1 - s.inIdx], 1, 124).join(' '), B: one(window.__on[s.inIdx], 2, 126).join(' ') };
  });
  console.log('  per-deck (heard − reported, ms)  A: ' + perDeck.A + '\n                                  B: ' + perDeck.B);
  console.log('  take: ' + JSON.stringify(await page.evaluate(() => window.__takeLog)) + ' samples ' + await page.evaluate(() => window.__sampN + '/' + window.__sampMoving + ' pull ' + MIXER._pull));
  const sl = await page.evaluate(() => { const s = window.__seam; return (window.__sampLog || []).map(([t, e]) => ((t - s.t0) / s.dur).toFixed(2) + ':' + e.toFixed(1)).join(' '); });
  console.log('  sampler reads (f:err ms, +=B behind): ' + sl);
  console.log('  TRUE flam (B onset − nearest A onset), per beat:');
  console.log('   ' + truth.map(r => `${r.f.toFixed(2)}:${r.ms.toFixed(1)}`).join('  '));
  const aud = truth.filter(r => r.f > 0.05);
  if (aud.length) console.log(`   → true mean |flam| ${(aud.reduce((s, r) => s + Math.abs(r.ms), 0) / aud.length).toFixed(1)} ms · worst ${Math.max(...aud.map(r => Math.abs(r.ms))).toFixed(1)} ms`);
  console.log(`run ${run + 1}: beats ${trace.plan.beats} · ${trace.plan.bpmA}→${trace.plan.bpmB}`);
  for (const r of trace.rows)
    console.log(`  f ${r.f.toFixed(2)}  ref ${r.ref.toFixed(1).padStart(6)} ms  eng ${r.eng == null ? '  -  ' : r.eng.toFixed(1).padStart(5)}  rateA ${r.rA.toFixed(4)} rateB ${r.rB.toFixed(4)} trim ${(r.trim * 100).toFixed(3)}% aligns ${r.aligns} pp ${r.ppA}/${r.ppB}`);
  const audible = trace.rows.filter(r => r.f > 0.05);
  const worst = Math.max(...audible.map(r => Math.abs(r.ref)));
  const mean = audible.reduce((s, r) => s + Math.abs(r.ref), 0) / Math.max(1, audible.length);
  console.log(`  → audible stretch: mean |err| ${mean.toFixed(1)} ms · worst ${worst.toFixed(1)} ms`);
  all.push({ mean, worst });
  await page.close();
}
console.log(`\nALL: mean ${(all.reduce((s, r) => s + r.mean, 0) / all.length).toFixed(1)} ms · worst ${Math.max(...all.map(r => r.worst)).toFixed(1)} ms`);
await browser.close(); server.close();
