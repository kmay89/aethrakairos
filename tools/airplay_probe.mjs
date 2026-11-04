/* AIRPLAY REBUILD PROBE — the route change, without an Apple TV.
 *
 * AirPlay routes a media element's OWN pipeline, and a desktop deck's audio
 * has been pulled into the WebAudio graph by createMediaElementSource — a
 * one-way door. So handing the music to an Apple TV means rebuilding the
 * decks out of elements that have never been through it, and that rebuild
 * is the part this repo actually owns and can therefore be held to:
 *
 *   - the same track is still loaded, still playing, at the same place
 *   - the graph is genuinely gone (no source node, no gain) and comes back
 *   - the element carries the volume once it is the playback path
 *   - the route button is hidden when nothing is out there to receive
 *
 * The wireless hop itself needs an Apple TV and stays on the physical-device
 * acceptance list. Everything up to it runs here.
 *
 *   node tools/airplay_probe.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json',
               '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join('docs', p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const body = readFileSync(f);
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
                       'Accept-Ranges': 'bytes', 'Content-Length': body.length });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
await page.evaluate(() => {
  const o = document.getElementById('onboard'); if (o) o.classList.remove('open');
  if (typeof firstRunClose === 'function') firstRunClose();
});

let bad = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!ok) bad++;
};

/* START A REAL TRACK AND LET IT GET SOMEWHERE — a track this machine can
   actually fetch. The shipped catalog points at the media host, which a
   probe box usually cannot reach; the synthesized demo is a blob the page
   builds itself, so the route change is measured on a record that really
   sounds. Looped, because the demo is shorter than the probe. */
await page.evaluate(async () => {
  ensureCtx();
  if (AE.ctx.state !== 'running') await AE.ctx.resume().catch(() => {});
  await player.synthesizeDemo();
  activeDeck().a.loop = true;
  /* AN EAR AT THE SPEAKER. Element state says a deck is playing; only the
     samples say it can be HEARD. The return from AirPlay used to rebuild the
     graph with the on-air deck's gain at zero — playing, advancing, silent —
     and every check below that reads the element passed straight over it. */
  const sp = AE.ctx.createScriptProcessor(2048, 2, 1); window.__lv = [];
  sp.onaudioprocess = e => { const x = e.inputBuffer.getChannelData(0); let q = 0; for (const v of x) q += v * v; window.__lv.push(Math.sqrt(q / x.length)); };
  const z = AE.ctx.createGain(); z.gain.value = 0; AE.out.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
});
await page.waitForTimeout(3500);
// the level the speaker got over the last `ms`: the loudest block, so one quiet bar is not silence
const heard = ms => page.evaluate(n => { const v = window.__lv.slice(-n); return v.length ? Math.max(...v) : 0; }, Math.max(4, Math.round(ms / 46)));
const before = await page.evaluate(() => ({
  graphLive: AE.graphLive, playing: player.playing, cur: player.cur,
  t: activeDeck().a.currentTime, src: activeDeck().a.currentSrc,
  hasGraph: !!activeDeck().gain, paused: activeDeck().a.paused,
}));
const beforeLv = await heard(800);
check('a track is really playing through the graph',
  before.playing && before.graphLive && before.hasGraph && before.t > 0.3 && !before.paused,
  JSON.stringify(before));
check('…and the probe can hear it (the ear works before it is trusted)', beforeLv > 0.003, 'peak block rms ' + beforeLv.toFixed(4));

// a hand's FILTER on the deck before the music leaves: the chain it sits on is torn down and rebuilt
const filt0 = await page.evaluate(async () => {
  FX.set('filter', 0.25); FX.hand();                  // the knob at -0.5: a lowpass
  await new Promise(r => setTimeout(r, 400));
  const d = activeDeck();
  return { hand: d._fxHand ? d._fxHand.lp : null, node: d.filter ? d.filter.frequency.value : null };
});
check('a hand\'s lowpass is on the deck filter before the route change', filt0.hand && filt0.hand < 2000 && Math.abs(filt0.node - filt0.hand) < filt0.hand * 0.1,
  JSON.stringify(filt0));

// --- go element-direct, the way the route button does ---
const direct = await page.evaluate(async () => {
  const left = activeDeck().a.currentTime;          // where the record was the instant the route changed
  const ok = await AIRPLAY.setDirect(true);
  const landed = activeDeck().a.currentTime;        // …and where the new element is the instant it resolves
  await new Promise(r => setTimeout(r, 1200));
  return { ok, left, landed, graphLive: AE.graphLive, playing: player.playing, cur: player.cur,
           t: activeDeck().a.currentTime, src: activeDeck().a.currentSrc,
           hasGraph: !!activeDeck().gain, hasSrcNode: !!activeDeck().src,
           paused: activeDeck().a.paused, vol: activeDeck().a.volume };
});
check('setDirect(true) reports success', direct.ok);
check('the graph is genuinely gone', !direct.graphLive && !direct.hasGraph && !direct.hasSrcNode,
  `graphLive=${direct.graphLive} gain=${direct.hasGraph} src=${direct.hasSrcNode}`);
check('the same track is still loaded', direct.src === before.src);
check('it is still playing, not paused', direct.playing && !direct.paused);
/* where it left off: read at the instant the route changed and the instant
   the rebuild resolved, so the time the record plays on through the probe's
   own waits (seconds, on a slow bench) is not mistaken for a jump. A restart
   from the top reads as far behind the spot it left. */
check('it resumed where it left off (±1.5 s)', Math.abs(direct.landed - direct.left) < 1.5,
  `${direct.left.toFixed(2)} -> ${direct.landed.toFixed(2)}`);
check('the element carries the volume now', direct.vol > 0, 'volume=' + direct.vol);

// the element must be able to move: it is the playback path now
await page.waitForTimeout(1500);
const moved = await page.evaluate(() => activeDeck().a.currentTime);
check('playback advances on the rebuilt element', moved > direct.t + 0.5,
  `${direct.t.toFixed(2)} -> ${moved.toFixed(2)}`);

// --- and come home ---
const backT = await page.evaluate(async () => {
  await AIRPLAY.setDirect(false);
  await new Promise(r => setTimeout(r, 1200));
  return { graphLive: AE.graphLive, hasGraph: !!activeDeck().gain, hasSrcNode: !!activeDeck().src,
           playing: player.playing, paused: activeDeck().a.paused,
           t: activeDeck().a.currentTime, src: activeDeck().a.currentSrc };
});
check('setDirect(false) rebuilds the graph', backT.graphLive && backT.hasGraph && backT.hasSrcNode,
  JSON.stringify(backT));
/* …AND IT IS HEARD. The rebuilt deck's gain is born at zero (AE._deckGraph),
   and a deck on air must be brought up to its loudness trim or the return is
   a playing, advancing, silent player — everything on screen says yes. */
const home = await page.evaluate(() => { const d = activeDeck(); return { gain: d.gain ? d.gain.gain.value : -1, norm: d.norm || 1 }; });
const homeLv = await heard(800);
check('the on-air deck comes home at its loudness trim, not at zero', Math.abs(home.gain - home.norm) < 0.05,
  'gain ' + home.gain.toFixed(3) + ' · trim ' + home.norm.toFixed(3));
check('…and the speaker hears it after the route comes home', homeLv > 0.003, 'peak block rms ' + homeLv.toFixed(4));
check('same track, still playing, after coming home', backT.playing && !backT.paused && backT.src === before.src);
check('position survived the round trip', backT.t > moved - 3, `${moved.toFixed(2)} -> ${backT.t.toFixed(2)}`);
// the rebuilt chain is born open; the filter the hand still holds must be written onto it, not lost to a stale cache
const filt1 = await page.evaluate(async () => {
  await new Promise(r => setTimeout(r, 400));
  const d = activeDeck();
  const out = { hand: d._fxHand ? d._fxHand.lp : null, node: d.filter ? d.filter.frequency.value : null, x: FX.amount };
  FX.set('filter', 0.5); FX.set('');                 // centred and let go
  return out;
});
check('…and after coming home the hand\'s lowpass is on the NEW filter node, not just on the knob',
  filt1.hand && Math.abs(filt1.node - filt1.hand) < filt1.hand * 0.1, JSON.stringify(filt1));

// --- the button must not appear with nothing to send to ---
const btn = await page.evaluate(() => {
  AIRPLAY.told = true; AIRPLAY.avail = false; syncAirplayButton();
  const hidden = getComputedStyle(document.getElementById('btnAirplay')).display === 'none';
  AIRPLAY.avail = true; syncAirplayButton();
  const shown = getComputedStyle(document.getElementById('btnAirplay')).display !== 'none';
  AIRPLAY.told = false; AIRPLAY.avail = false; syncAirplayButton();
  return { hidden, shown };
});
check('no receiver in the room → no route button', btn.hidden);
check('a receiver appears → the button does too', btn.shown);

// a second call in the same mode is a no-op, not a second rebuild
const noop = await page.evaluate(async () => {
  const el0 = activeDeck().a;
  const ok = await AIRPLAY.setDirect(false);
  return { ok, same: activeDeck().a === el0 };
});
check('asking for the mode it is already in changes nothing', noop.ok && noop.same);

check('no page errors throughout', errs.length === 0, errs.join(' | '));

await browser.close();
server.close();
console.log(bad ? `\n${bad} check(s) failed` : '\nthe route change holds: same track, same place, graph off and back on');
process.exit(bad ? 1 : 0);
