/* PLATTER TOUCH PROBE — does a FINGER on the booth's platter scratch?
 *
 * vinyl_probe drives the layer through its own methods. This one does what a
 * listener does: a phone-sized page, real touch events dragged round deck A's
 * record, and an ear at the speaker. It runs twice:
 *
 *   graph   a phone whose music runs through the Web Audio graph (Android):
 *           the drag must survive (the canvas owns its touches — no
 *           pointercancel a few moves in) and take the room's tape backwards
 *   direct  an iPhone, whose music plays element-direct: the record is
 *           pressed into the song tape while the booth is open, the element
 *           goes quiet under the hand and the tape is heard instead, and the
 *           element is given back the moment the finger lifts
 *
 *   node tools/platter_touch_probe.mjs
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
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};

async function bench(label, ua){
  console.log(label);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem('mb8_lang', 'en'); } catch (e){} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  await page.evaluate(async () => {
    const o = document.getElementById('onboard'); if (o) o.classList.remove('open');
    if (typeof firstRunClose === 'function') try { firstRunClose(); } catch (e) {}
    director.setAuto(false);
    ensureCtx();
    if (AE.ctx.state !== 'running') await AE.ctx.resume().catch(() => {});
    await player.synthesizeDemo();
    // the bench's software GPU would starve the main thread of the pointer events under test
    try { renderer.render = () => {}; } catch (e){}
    BOOTH.toggle(true);
  });
  const playing = await page.waitForFunction('player.playing && activeDeck().a.currentTime > 0.5', null, { timeout: 30000 })
    .then(() => true).catch(() => false);
  R('the bench is playing with the booth open', playing);
  if (!playing){ await ctx.close(); return; }
  await page.evaluate(() => { activeDeck().a.loop = true; });   // the demo is short; the probe is not
  const direct = await page.evaluate(() => !AE.graphLive);
  R(direct ? 'the music plays element-direct, as on an iPhone' : 'the music runs through the graph', direct === !!ua);
  if (direct){
    const pressed = await page.waitForFunction('VINYL.songReady()', null, { timeout: 30000 }).then(() => true).catch(() => false);
    const info = await page.evaluate(() => window.__mb8VinylSong);
    R('the record is pressed into the song tape while the booth is open', pressed && info && info.frames > 0,
      info ? info.sr + ' Hz, ' + (info.frames / info.sr).toFixed(1) + ' s' : 'not pressed');
  }
  const g = await page.evaluate(() => {
    const r = el.boothCv.getBoundingClientRect(), j = BOOTH._jogA;
    return j && { x: r.left + j.cx, y: r.top + j.cy, r: j.r };
  });
  R('deck A\'s platter is drawn to be touched', !!g);
  if (!g){ await ctx.close(); return; }
  await page.evaluate(() => {
    window.__ev = {};
    for (const t of ['pointermove', 'pointercancel']) el.boothCv.addEventListener(t, () => { window.__ev[t] = (window.__ev[t] || 0) + 1; }, true);
    // an ear at the speaker
    const sp = AE.ctx.createScriptProcessor(2048, 2, 1); window.__lv = [];
    sp.onaudioprocess = e => { const x = e.inputBuffer.getChannelData(0); let q = 0; for (const v of x) q += v * v; window.__lv.push(Math.sqrt(q / x.length)); };
    const z = AE.ctx.createGain(); z.gain.value = 0; AE.out.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
  });
  // a finger, round the label, backwards
  const cdp = await ctx.newCDPSession(page);
  const pt = a => ({ x: g.x + Math.cos(a) * g.r * 0.6, y: g.y + Math.sin(a) * g.r * 0.6 });
  let minRate = 9, engaged = false, muted = false;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(0)] });
  const heard0 = await page.evaluate(() => window.__lv.length);
  for (let i = 1; i <= 30; i++){
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(-i * 0.15)] });
    await page.waitForTimeout(16);
    const s = await page.evaluate(() => ({ r: VINYL.rate, e: VINYL.engaged, m: activeDeck().a.muted }));
    minRate = Math.min(minRate, s.r); engaged ||= s.e; muted ||= s.m;
  }
  const lv = await page.evaluate(n => window.__lv.slice(n), heard0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  const ev = await page.evaluate(() => window.__ev);
  R('the drag stays in the hand — no pointercancel', !ev.pointercancel && (ev.pointermove || 0) >= 30,
    (ev.pointermove || 0) + ' moves, ' + (ev.pointercancel || 0) + ' cancels');
  R('the finger takes the record', engaged);
  R('…and turns it backwards', minRate < -0.3, 'min rate ' + minRate.toFixed(2) + '×');
  const loud = lv.filter(v => v > 0.005).length;
  R('…with the scratch at the speaker', loud >= 3, loud + ' of ' + lv.length + ' blocks sounding');
  if (direct) R('the element is silent under the hand', muted);
  {
    // the scrolling wave is the same record: a finger dragged right across deck A pulls the music back
    await page.waitForTimeout(400);
    const wv = await page.evaluate(() => { const r = el.boothWave.getBoundingClientRect(), g = DECKWAVE._geom; return g && { x: r.left + r.width / 2, y: r.top + g.sh / 2 }; });
    let wMin = 9, wEng = false;
    if (wv){
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: wv.x, y: wv.y }] });
      for (let i = 1; i <= 20; i++){
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: wv.x + i * 6, y: wv.y }] });
        await page.waitForTimeout(16);
        const s = await page.evaluate(() => ({ r: VINYL.rate, e: VINYL.engaged }));
        wMin = Math.min(wMin, s.r); wEng ||= s.e;
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    }
    R('the scrolling wave is drawn to be touched', !!wv);
    R('dragging deck A\'s wave takes the record, and pulls it backwards', wEng && wMin < -0.3, 'min rate ' + wMin.toFixed(2) + '×');
  }
  const after = await page.evaluate(() => ({ e: VINYL.engaged, m: activeDeck().a.muted, p: player.playing }));
  R('lifted, the room is given back' + (direct ? ' and the element sounds again' : ''), !after.e && !after.m && after.p);
  R('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await bench('graph (a phone with the Web Audio graph)', '');
await bench('direct (an iPhone, element-direct)', IPHONE);
await browser.close(); server.close();
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
