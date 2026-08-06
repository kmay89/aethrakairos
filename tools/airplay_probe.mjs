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

// start a real track and let it get somewhere
await page.evaluate(() => player.playIndex(0));
await page.waitForTimeout(3500);
const before = await page.evaluate(() => ({
  graphLive: AE.graphLive, playing: player.playing, cur: player.cur,
  t: activeDeck().a.currentTime, src: activeDeck().a.currentSrc,
  hasGraph: !!activeDeck().gain, paused: activeDeck().a.paused,
}));
check('a track is really playing through the graph',
  before.playing && before.graphLive && before.hasGraph && before.t > 0.3 && !before.paused,
  JSON.stringify(before));

// --- go element-direct, the way the route button does ---
const direct = await page.evaluate(async () => {
  const ok = await AIRPLAY.setDirect(true);
  await new Promise(r => setTimeout(r, 1200));
  return { ok, graphLive: AE.graphLive, playing: player.playing, cur: player.cur,
           t: activeDeck().a.currentTime, src: activeDeck().a.currentSrc,
           hasGraph: !!activeDeck().gain, hasSrcNode: !!activeDeck().src,
           paused: activeDeck().a.paused, vol: activeDeck().a.volume };
});
check('setDirect(true) reports success', direct.ok);
check('the graph is genuinely gone', !direct.graphLive && !direct.hasGraph && !direct.hasSrcNode,
  `graphLive=${direct.graphLive} gain=${direct.hasGraph} src=${direct.hasSrcNode}`);
check('the same track is still loaded', direct.src === before.src);
check('it is still playing, not paused', direct.playing && !direct.paused);
check('it resumed where it left off (±3 s)', Math.abs(direct.t - before.t) < 3,
  `${before.t.toFixed(2)} -> ${direct.t.toFixed(2)}`);
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
check('same track, still playing, after coming home', backT.playing && !backT.paused && backT.src === before.src);
check('position survived the round trip', backT.t > moved - 3, `${moved.toFixed(2)} -> ${backT.t.toFixed(2)}`);

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
