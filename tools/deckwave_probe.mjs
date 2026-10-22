/* DECKWAVE PROBE — the scrolling decks: real detail, and cheap.
 *
 * Plays a real catalog track (the media host is answered from docs/audio, so
 * no network is needed), opens the booth, and checks what a unit test cannot:
 * that the detail is decoded and analysed off the main thread and lands at
 * deck resolution in the shape the page says it has (hz, v, the eight planes);
 * that the strips are drawn from it at every zoom; that deck B's strip is
 * handed its own record's cues; that a deck off rate 1 is still blitted crisp;
 * and that a whole booth frame stays inside its budget, which is the point of
 * painting the song into tiles once instead of every bar every frame.
 *
 * THE BUDGET IS RELATIVE. The bench this runs on is a software rasteriser
 * whose speed is nobody's guarantee, so a frame WITH the strips is held to
 * 1.5× a frame without them measured in the same run (or 4 ms, whichever is
 * kinder; MB8_BUDGET_MS pins an absolute), which is what the strips may cost
 * the booth, wherever the booth is drawn.
 *
 *   node tools/deckwave_probe.mjs
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
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const BUDGET_MS = +process.env.MB8_BUDGET_MS || 0;   // an absolute budget, when the bench is known; else relative (see the header)

for (const [label, vw, vh] of [['desktop', 1280, 900], ['phone', 390, 844]]){
  console.log(label);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, ...(vw < 600 ? { hasTouch: true, isMobile: true } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem('mb8_lang', 'en'); localStorage.setItem('mb8_wavezoom', '2'); } catch (e){} });
  // the catalog's media host, answered from the repository's own copies (ranges honoured)
  await ctx.route(/media\.aethrakairos\.com\/audio\//, async route => {
    const f = join('docs', decodeURIComponent(new URL(route.request().url()).pathname));
    if (!existsSync(f)) return route.fulfill({ status: 404 });
    const buf = readFileSync(f), rng = route.request().headers()['range'];
    const h = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
    if (rng){
      const m = /bytes=(\d+)-(\d*)/.exec(rng), a = +m[1], b = m[2] ? +m[2] : buf.length - 1;
      return route.fulfill({ status: 206, headers: { ...h, 'Content-Range': `bytes ${a}-${b}/${buf.length}` }, body: buf.subarray(a, b + 1) });
    }
    return route.fulfill({ status: 200, headers: h, body: buf });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 60000 });
  await page.evaluate(async () => {
    const o = document.getElementById('onboard'); if (o) o.classList.remove('open');
    if (typeof firstRunClose === 'function') try { firstRunClose(); } catch (e) {}
    director.setAuto(false);
    ensureCtx(); if (AE.ctx.state !== 'running') await AE.ctx.resume().catch(() => {});
    try { renderer.render = () => {}; } catch (e){}   // the bench's software GPU is not what is measured here
    player.playIndex(player.tracks.findIndex(t => t.mix && t.mix.bpm > 0 && t.url && !t.demo));
  });
  const playing = await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1', null, { timeout: 60000 })
    .then(() => true).catch(() => false);
  R('a catalog track is playing', playing);
  if (!playing){ await ctx.close(); continue; }
  await page.evaluate(() => { activeDeck().a.currentTime = 40; BOOTH.toggle(true); });
  const coarse = await page.evaluate(() => { const s = DECKWAVE.src(player.tracks[player.cur]); return s ? !!s.coarse : null; });
  R('before the decode lands, the strip already draws from the shipped score', coarse === true);
  const det = await page.waitForFunction('window.__mb8WaveDetail', null, { timeout: 60000 }).then(h => h.jsonValue()).catch(() => null);
  const page_ = await page.evaluate(() => ({ hz: WAVE_HZ, v: WAVE_V, planes: WAVE_PLANES.length, mips: WAVE_MIPS.slice(), dur: activeDeck().a.duration }));
  const dur = page_.dur;
  R('the detail lands at deck resolution, in the contract the page declares', det && det.hz === page_.hz && det.v === page_.v && Math.abs(det.n / det.hz - dur) < 1,
    det ? det.n + ' columns at ' + det.hz + ' Hz (v' + det.v + ') for ' + dur.toFixed(1) + ' s' : 'never landed');
  R('…with its eight planes and two mips', det && det.planes === page_.planes && det.planes === 8 && det.mips.length === page_.mips.length && det.mips[0] === page_.hz / page_.mips[0],
    det ? det.planes + ' planes, mips at ' + det.mips.join(' / ') + ' Hz' : '');
  const worker = await page.evaluate(() => !!DECKWAVE._worker && !DECKWAVE._broken);
  R('…analysed in a worker, off the main thread', worker);
  const shape = await page.evaluate(() => {
    const s = DECKWAVE.src(player.tracks[player.cur]);
    let lo = 0, hi = 0, mx = 0, loCap = 0, clear = 0, tiltSpread = 0, onBuf = 0, bytes = 0, tmin = 255, tmax = 0;
    for (let i = 0; i < s.n; i++){
      lo += s.loRms[i]; hi += s.hiRms[i]; loCap += s.loPk[i]; if (s.pk[i] > mx) mx = s.pk[i];
      if (s.loPk[i] > s.loRms[i] + 25) clear++;                       // a hit: the cap clear of its body
      if (s.tilt[i] < tmin) tmin = s.tilt[i]; if (s.tilt[i] > tmax) tmax = s.tilt[i];
    }
    tiltSpread = (tmax - tmin) / 255;
    for (const p of WAVE_PLANES) if (s[p].buffer === s.buf) onBuf++;
    bytes = s.buf.byteLength;
    return { coarse: !!s.coarse, lo: lo / s.n / 255, hi: hi / s.n / 255, loCap: loCap / s.n / 255, mx, clear: clear / s.n, tiltSpread, onBuf, bytes, perMin: bytes / (s.dur / 60) };
  });
  R('…and it is real music: every band alive, the caps a reading of their own (hits clear of their bodies), the tilt moving, on one buffer',
    !shape.coarse && shape.lo > 0.05 && shape.hi > 0.01 && shape.mx === 255 && shape.clear > 0.02 && shape.loCap > 0.01 && shape.tiltSpread > 0.3 && shape.onBuf === 8,
    'mean low ' + shape.lo.toFixed(2) + ', mean high ' + shape.hi.toFixed(2) + ', hits on ' + (shape.clear * 100).toFixed(0) + ' % of columns, tilt spread ' + shape.tiltSpread.toFixed(2) + ', ' + (shape.bytes / 1048576).toFixed(2) + ' MB (' + (shape.perMin / 1024).toFixed(0) + ' KB a minute)');
  R('…within the memory the design allows (2.5 MB for seven minutes)', shape.perMin * 7 <= 2.5 * 1048576);
  await page.waitForTimeout(800);
  const zooms = await page.evaluate(() => {
    const out = [];
    for (const z of [0, 2, 4]){ DECKWAVE.setZoom(z); BOOTH.draw(); out.push(Math.round(DECKWAVE._geom.pps)); }
    DECKWAVE.setZoom(2);
    return out;
  });
  R('every zoom draws, from close to wide', zooms[0] > zooms[1] && zooms[1] > zooms[2], zooms.join(' > ') + ' px/s');
  // deck B's strip is its OWN record's: load one by hand, cue it, and both strips get what is theirs
  const stripB = await page.evaluate(async () => {
    const t = player.tracks.find((x, i) => i !== player.cur && x.url && !x.demo && x.mix && x.mix.bpm > 0);
    if (!t || typeof DECKS === 'undefined' || !DECKS.load(1, t)) return { loaded: false };
    await new Promise(r => setTimeout(r, 500));
    DECKS.focus = 1; await CUES.follow(t); const at = CUES.set(2, 12.5);   // the hand on B sets a cue on B's record (snapped to B's grid)
    BOOTH.draw();
    const hand = { A: DECKWAVE._last.A, B: DECKWAVE._last.B };
    DECKS.focus = 0; await CUES.follow(DECKS.track(0));                // the hand back on A: B's strip still reads B's cues
    BOOTH.draw(); await new Promise(r => setTimeout(r, 200)); BOOTH.draw();
    const back = { A: DECKWAVE._last.A, B: DECKWAVE._last.B };
    const own = a => a && a.cues ? a.cues.filter(v => v != null).length : 0;
    return { loaded: true, hand, back, at,
      bHasCue: at != null && !!(hand.B && hand.B.cues && Math.abs(hand.B.cues[2] - at) < 1e-6),
      aNotB: !(hand.A && hand.A.cues && hand.A.cues[2] != null && Math.abs(hand.A.cues[2] - at) < 1e-6),
      stillB: at != null && !!(back.B && back.B.cues && Math.abs(back.B.cues[2] - at) < 1e-6), aOwn: own(back.A) };
  });
  R('strip B receives its own record\'s cues — from the pads while the hand is on B, from the store once it leaves',
    stripB.loaded && stripB.bHasCue && stripB.aNotB && stripB.stillB, stripB.loaded ? JSON.stringify({ set: stripB.at, hand: stripB.hand.B && stripB.hand.B.cues, back: stripB.back.B && stripB.back.B.cues, aOwn: stripB.aOwn }) : 'deck B could not be loaded');
  // a deck off rate 1 is painted at its own rate and blitted 1:1 without smoothing
  const crisp = await page.evaluate(() => {
    const d = activeDeck(), was = d.a.playbackRate;
    d.a.playbackRate = 1.03; BOOTH.draw();
    const g = Object.assign({}, DECKWAVE._geom);
    const keys = [...DECKWAVE._tiles.keys()].filter(k => k.startsWith(DECKWAVE.key(player.tracks[player.cur]) + '|'));
    d.a.playbackRate = was; BOOTH.draw();
    return { scale: g.scale, smooth: g.smooth, painted: keys.length };
  });
  R('tiles are crisp at rate 1.03: painted at the deck\'s rate, blitted within 0.2 % of 1:1, no smoothing', Math.abs(crisp.scale - 1) <= 0.002 && crisp.smooth === false && crisp.painted > 0,
    'scale ' + crisp.scale.toFixed(4) + ', ' + crisp.painted + ' tiles at that rate');
  // the tiles at this zoom are warm; scroll on through the song and measure every frame —
  // first the booth WITHOUT its strips (the bench's own speed), then with them
  const cost = await page.evaluate(async () => {
    const run = async () => {
      const ts = [];
      for (let i = 0; i < 180; i++){
        await new Promise(r => requestAnimationFrame(r));
        const a = performance.now(); BOOTH.draw(); ts.push(performance.now() - a);
      }
      ts.sort((a, b) => a - b);
      return { med: ts[90], p95: ts[171] };
    };
    const real = DECKWAVE.draw;
    DECKWAVE.draw = () => {};
    const base = await run();
    DECKWAVE.draw = real;
    BOOTH.draw();
    const full = await run();
    return { base, full, tiles: DECKWAVE._tiles.size, cap: DECKWAVE._cap };
  });
  const budget = BUDGET_MS > 0 ? BUDGET_MS : Math.max(4, 1.5 * cost.base.p95);
  R('a booth frame stays inside its budget while the song scrolls (the strips ≤ 1.5× the rest of the booth, or 4 ms)', cost.full.p95 <= budget,
    'median ' + cost.full.med.toFixed(2) + ' ms, p95 ' + cost.full.p95.toFixed(2) + ' ms (without the strips: p95 ' + cost.base.p95.toFixed(2) + ' ms; budget ' + budget.toFixed(2) + ' ms), ' + cost.tiles + ' tiles held');
  R('the tile cache is bounded', cost.tiles <= cost.cap && cost.cap <= 48, cost.tiles + ' ≤ ' + cost.cap);
  await page.evaluate(() => BOOTH.toggle(false));
  R('closing the booth lets the painted tiles go', await page.evaluate(() => DECKWAVE._tiles.size === 0));
  R('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
