/* PLATTER TOUCH PROBE — does a FINGER on the booth's platter scratch?
 *
 * vinyl_probe drives the layer through its own methods. This one does what a
 * listener does: a phone-sized page, real touch events dragged round deck A's
 * record (and, on the graph, deck B's — the record a hand loaded there — and
 * both strips), an ear at the speaker, and the SCRATCH bank's CUT pad held
 * against the crossfader. It runs twice:
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
  if (!direct){
    // DECK B: the record a hand loaded onto the other deck has its own platter and its own strip
    const bReady = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const ok = DECKS.load(1, player.tracks[player.cur]);
      for (let k = 0; k < 60 && AE.decks[1].a.readyState < 2; k++) await wait(100);
      const played = DECKS.play(1);
      await wait(500);
      BOOTH.draw();
      const r = el.boothCv.getBoundingClientRect(), j = BOOTH._jogB;
      return { ok, played, g: j && { x: r.left + j.cx, y: r.top + j.cy, r: j.r } };
    });
    R('deck B takes the record by hand and its platter is drawn to be touched', bReady.ok && bReady.played && !!bReady.g);
    if (bReady.g){
      const gb = bReady.g, ptB = a => ({ x: gb.x + Math.cos(a) * gb.r * 0.6, y: gb.y + Math.sin(a) * gb.r * 0.6 });
      let minB = 9, engB = false, engA = false, focus = -1;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [ptB(0)] });
      for (let i = 1; i <= 30; i++){
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [ptB(-i * 0.15)] });
        await page.waitForTimeout(16);
        const s = await page.evaluate(() => ({ r: VINYL.for(1).rate, e: VINYL.for(1).engaged, a: VINYL.for(0).engaged, f: DECKS.focus }));
        minB = Math.min(minB, s.r); engB ||= s.e; engA ||= s.a; focus = s.f;
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      R('a finger on deck B\'s platter takes B\'s record (the hand\'s focus follows) and turns it backwards — A\'s stays untouched', engB && !engA && focus === 1 && minB < -0.3, 'B min rate ' + minB.toFixed(2) + '×, focus ' + focus);
      // the lower strip is deck B's record
      const wvB = await page.evaluate(() => { const r = el.boothWave.getBoundingClientRect(), g = DECKWAVE._geom; return g && { x: r.left + r.width / 2, y: r.top + g.yB + g.sh / 2 }; });
      let wMinB = 9, wEngB = false;
      if (wvB){
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: wvB.x, y: wvB.y }] });
        for (let i = 1; i <= 20; i++){
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: wvB.x + i * 6, y: wvB.y }] });
          await page.waitForTimeout(16);
          const s = await page.evaluate(() => ({ r: VINYL.for(1).rate, e: VINYL.for(1).engaged }));
          wMinB = Math.min(wMinB, s.r); wEngB ||= s.e;
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(300);
      }
      R('dragging deck B\'s wave takes B\'s record, and pulls it backwards', !!wvB && wEngB && wMinB < -0.3, 'min rate ' + wMinB.toFixed(2) + '×');
      // the strip's corner word switches it to a seek strip, and a drag then seeks instead of scratching
      const scrub = await page.evaluate(async () => {
        const wait = ms => new Promise(res => setTimeout(res, ms));
        DECKWAVE.stripMode[1] = 'scrub';
        BOOTH.draw(); await wait(50);
        const r = el.boothWave.getBoundingClientRect(), g = DECKWAVE._geom, d = AE.decks[1];
        const y = r.top + g.yB + g.sh / 2, x0 = r.left + r.width / 2;
        const t0 = d.a.currentTime;
        const down = new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 });
        el.boothWave.dispatchEvent(down);
        el.boothWave.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x0 + 80, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
        await wait(100);
        const t1 = d.a.currentTime, eng = VINYL.for(1).engaged;
        el.boothWave.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x0 + 80, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
        DECKWAVE.stripMode[1] = null;
        return { t0, t1, eng, mode: DECKWAVE.stripModeOf(1) };
      });
      R('in scrub mode the same drag seeks deck B backwards instead of taking the record', scrub.t1 < scrub.t0 - 0.3 && !scrub.eng && scrub.mode === 'scratch', `${scrub.t0.toFixed(2)} → ${scrub.t1.toFixed(2)} s`);
    }
    // the SCRATCH bank's CUT pad: held, the crossfader wears the cut curve; let go, the law it had
    const cut = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      FXPADS.setBank('scratch');
      const pad = [...document.querySelectorAll('#fxPads .fxp')].find(b => b.textContent === 'CUT');
      if (!pad) return { pad: false };
      const was = DECKS.fader.curve;
      DECKS.faderGrab(0); DECKS.faderMove(0.9);
      await wait(60);
      const powerLaw = xfaderGains(0.9, 'power')[0], cutLaw = xfaderGains(0.9, 'cut')[0];
      pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 }));
      await wait(120);
      const held = { curve: DECKS.fader.curve, fA: AE.decks[0].fader.gain.value, lit: pad.classList.contains('lit') };
      pad.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true }));
      await wait(120);
      const after = { curve: DECKS.fader.curve, fA: AE.decks[0].fader.gain.value, lit: pad.classList.contains('lit') };
      DECKS.faderMove(0); DECKS.faderRelease();
      FXPADS.setBank('loop');
      return { pad: true, was, powerLaw, cutLaw, held, after };
    });
    R('the CUT pad held puts the cut curve on the crossfader (the fader node follows the sharper law), and gives the old law back on the lift',
      cut.pad && cut.held.curve === 'cut' && cut.held.lit && Math.abs(cut.held.fA - cut.cutLaw) < 0.02 && cut.after.curve === cut.was && !cut.after.lit && Math.abs(cut.after.fA - cut.powerLaw) < 0.02,
      JSON.stringify({ held: cut.held, after: cut.after, cutLaw: cut.cutLaw, powerLaw: cut.powerLaw }));
    await page.evaluate(() => { try { DECKS.pause(1); DECKS.eject(1); } catch (e){} });
  } else {
    // element-direct: the second platter stands down honestly — its hand says so, nothing pretends
    const bWhy = await page.evaluate(() => VINYL.for(1).why());
    R('element-direct, deck B\'s platter says it has none (only the record on air has one)', /only the record on air/.test(bWhy), bWhy);
  }
  R('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await bench('graph (a phone with the Web Audio graph)', '');
await bench('direct (an iPhone, element-direct)', IPHONE);
await browser.close(); server.close();
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
