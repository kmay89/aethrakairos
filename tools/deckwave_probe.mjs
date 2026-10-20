/* DECKWAVE PROBE — the scrolling decks: real detail, and cheap.
 *
 * Plays a real catalog track (the media host is answered from docs/audio, so
 * no network is needed), opens the booth, and checks what a unit test cannot:
 * that the detail is decoded and analysed off the main thread and lands at
 * deck resolution; that the strips are drawn from it at every zoom; and that
 * a whole booth frame stays inside its budget, which is the point of painting
 * the song into tiles once instead of every bar every frame.
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
const BUDGET_MS = 4;                       // a whole booth frame, p95, on this bench's CPU

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
  const dur = await page.evaluate(() => activeDeck().a.duration);
  R('the detail lands at deck resolution', det && det.hz === 150 && Math.abs(det.n / det.hz - dur) < 1,
    det ? det.n + ' columns for ' + dur.toFixed(1) + ' s' : 'never landed');
  const worker = await page.evaluate(() => !!DECKWAVE._worker && !DECKWAVE._broken);
  R('…analysed in a worker, off the main thread', worker);
  const shape = await page.evaluate(() => {
    const s = DECKWAVE.src(player.tracks[player.cur]);
    let lo = 0, hi = 0, mx = 0;
    for (let i = 0; i < s.n; i++){ lo += s.lo[i]; hi += s.hi[i]; if (s.pk[i] > mx) mx = s.pk[i]; }
    return { coarse: !!s.coarse, lo: lo / s.n / 255, hi: hi / s.n / 255, mx };
  });
  R('…and it is real music, every band alive', !shape.coarse && shape.lo > 0.05 && shape.hi > 0.01 && shape.mx === 255,
    'mean low ' + shape.lo.toFixed(2) + ', mean high ' + shape.hi.toFixed(2));
  await page.waitForTimeout(800);
  const zooms = await page.evaluate(() => {
    const out = [];
    for (const z of [0, 2, 4]){ DECKWAVE.setZoom(z); BOOTH.draw(); out.push(Math.round(DECKWAVE._geom.pps)); }
    DECKWAVE.setZoom(2);
    return out;
  });
  R('every zoom draws, from close to wide', zooms[0] > zooms[1] && zooms[1] > zooms[2], zooms.join(' > ') + ' px/s');
  // the tiles at this zoom are warm; scroll on through the song and measure every frame
  const cost = await page.evaluate(async () => {
    const ts = [];
    for (let i = 0; i < 180; i++){
      await new Promise(r => requestAnimationFrame(r));
      const a = performance.now(); BOOTH.draw(); ts.push(performance.now() - a);
    }
    ts.sort((a, b) => a - b);
    return { med: ts[90], p95: ts[171], tiles: DECKWAVE._tiles.size };
  });
  R('a booth frame stays inside its budget while the song scrolls', cost.p95 < BUDGET_MS,
    'median ' + cost.med.toFixed(2) + ' ms, p95 ' + cost.p95.toFixed(2) + ' ms, ' + cost.tiles + ' tiles held');
  R('the tile cache is bounded', cost.tiles <= 48);
  await page.evaluate(() => BOOTH.toggle(false));
  R('closing the booth lets the painted tiles go', await page.evaluate(() => DECKWAVE._tiles.size === 0));
  R('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
