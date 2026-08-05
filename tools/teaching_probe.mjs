/* TEACHING PROBE — the room does not talk over its own teaching.
 *
 * Reported by a listener: info cards ("Playing …", "Your device is working
 * hard…", the touch-effects hint) sliding up UNDER the intro story, the
 * welcome card, the help panel and the first-run tour — exactly the moments
 * the app has asked for undivided attention. And the tour's first step said
 * "Möbius Walking is already moving" whether or not anything was moving.
 *
 * The contract under test:
 *
 *   held      while any teaching surface is up (intro story, welcome card,
 *             coach-mark tour — including the 900 ms gap before it starts —
 *             or the help panel), toast cards are HELD, not shown.
 *   flushed   once the surface closes, held cards appear (deduped, three
 *             deep, and only if less than thirty seconds old).
 *   honest    tour step 1 claims the music is moving only when it IS;
 *             a silent room gets "tap it to start the music" instead.
 *   playing   none of the holding ever touches the audio — the music runs
 *             under the tour the whole time.
 *
 * None of this is arithmetic: it needs the real first-run flow in a real
 * browser with the real catalog. So that is what this does.
 *
 *   node tools/teaching_probe.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'docs';
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.js': 'text/javascript', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.mp3': 'audio/mpeg' };

let pass = 0, fail = 0;
function verdict(name, ok, detail){
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  · ' + detail : ''}`);
}

/* the real site, served straight from docs/ — audio streams on demand, so the
 * 1.1 GB catalog costs only the one track the first run actually plays */
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(ROOT, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const st = statSync(f); const type = MIME[extname(f)] || 'application/octet-stream';
  const m = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (m){
    const start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : st.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    createReadStream(f, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
  createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const visibleToasts = () => page.evaluate(() =>
  [...document.getElementById('toasts').children].map(t => t.textContent));

console.log('\nteaching: no info cards over the intro, the welcome, the tour, the help');
await page.goto('http://127.0.0.1:' + PORT + '/');
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 30000 });
await page.waitForTimeout(300);

verdict('a first run opens on the intro story',
  await page.evaluate(() => document.getElementById('onboard').classList.contains('open')));

// give the boot-time cards ("Loaded N tracks", perf warnings…) time to try
await page.waitForTimeout(2500);
let v = await visibleToasts();
verdict('no info cards over the intro story', v.length === 0, JSON.stringify(v));

await page.click('#obSkip');
await page.waitForFunction(() => document.getElementById('firstRun').classList.contains('open'));
await page.waitForTimeout(1200);
v = await visibleToasts();
verdict('no info cards over the welcome card', v.length === 0, JSON.stringify(v));

await page.click('#frStart');
await page.waitForTimeout(1500);                    // the tour begins 900 ms after Start
verdict('the tour is up', await page.evaluate(() => TUTOR.active));
v = await visibleToasts();
verdict('no info cards over the tour — "Playing …" waits its turn',
  v.length === 0, JSON.stringify(v));

await page.waitForTimeout(3000);
const audio = await page.evaluate(() => ({
  playing: player.playing, t: activeDeck().a.currentTime, paused: activeDeck().a.paused }));
verdict('the music runs under the tour the whole time',
  audio.playing && !audio.paused && audio.t > 1, 't=' + audio.t.toFixed(1));

const bodies = await page.evaluate(() => {
  const playingCopy = TUTOR.steps[0].body();
  player.pause();
  const pausedCopy = TUTOR.steps[0].body();
  player.resume();
  return { playingCopy, pausedCopy };
});
verdict('tour step 1 claims motion only while something is moving',
  /already moving/.test(bodies.playingCopy) && !/already moving/.test(bodies.pausedCopy)
    && /tap it/.test(bodies.pausedCopy));

for (let i = 0; i < 4; i++){ await page.click('#coachNext'); await page.waitForTimeout(350); }
verdict('the tour finished and nothing is pending',
  await page.evaluate(() => !TUTOR.active && !TUTOR._pending));
await page.waitForTimeout(1600);                    // one janitor beat + the slide-in
v = await visibleToasts();
verdict('held cards flush once the tour closes', v.length > 0, JSON.stringify(v));

await page.waitForTimeout(3500);                    // let the flushed cards expire
await page.evaluate(() => openHelp(true));
await page.evaluate(() => toast('probe card while help is open'));
await page.waitForTimeout(900);
v = await visibleToasts();
verdict('no info cards while the help panel is open', v.length === 0, JSON.stringify(v));
await page.evaluate(() => openHelp(false));
await page.waitForTimeout(1600);
v = await visibleToasts();
verdict('the held card appears after help closes',
  v.some(t => /probe card/.test(t)), JSON.stringify(v));

await page.waitForTimeout(3000);
await page.evaluate(() => ONBOARD.show());          // "replay the intro", from the menu
await page.evaluate(() => toast('probe card during replayed intro'));
await page.waitForTimeout(900);
v = await visibleToasts();
verdict('a replayed intro holds cards too', v.length === 0, JSON.stringify(v));
await page.evaluate(() => ONBOARD.finish());
await page.waitForTimeout(1600);
v = await visibleToasts();
verdict('and they appear once it closes',
  v.some(t => /replayed intro/.test(t)), JSON.stringify(v));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
