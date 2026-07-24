// POWER + ECHOES smoke — the modes and the drift, verified in a real headless browser.
//   python3 tools/make_synthetic_deploy.py /tmp/mb8-accept 1000
//   node tools/echoes_power_smoke.mjs /tmp/mb8-accept
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIR = process.argv[2];
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(DIR, path === '/' ? 'index.html' : path.slice(1));
  if (!existsSync(file) || statSync(file).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(file);
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Content-Length': data.length });
  res.end(data);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
let fails = 0;
const R = (name, ok, detail) => { fails += ok ? 0 : 1;
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (detail ? ' — ' + detail : '')); };
page.on('pageerror', e => console.log('  [pageerror]', e.message.split('\n')[0]));

await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.keyboard.press('Escape');
await page.evaluate(() => { const f = document.getElementById('firstRun'); if (f) f.classList.remove('open'); });

// chips exist
R('power chip renders', await page.locator('#chipPower').count() === 1);
R('echo chip renders', await page.locator('#chipEcho').count() === 1);
R('echo defaults to DRIFT', (await page.locator('#chipEcho').textContent()).includes('DRIFT'));

// POWER cycling: auto -> show -> eco -> auto, pixel ratio follows the plan
const pr = () => page.evaluate(() => ({ mode: POWER.mode, pr: PERF.pr, max: PERF.maxPR, min: PERF.minPR,
  div: POWER._div, lens: POWER.lensOK, heavy: POWER.heavyOK, gov: POWER.governs }));
const p0 = await pr();
R('boots in AUTO governing', p0.mode === 'auto' && p0.gov && p0.div === 1, JSON.stringify(p0));
await page.evaluate(() => POWER.cycle());
const p1 = await pr();
R('SHOW pins the ceiling', p1.mode === 'show' && Math.abs(p1.pr - p1.max) < 1e-6 && p1.lens, JSON.stringify(p1));
await page.evaluate(() => POWER.cycle());
const p2 = await pr();
R('ECO pins the floor + halves the draw', p2.mode === 'eco' && p2.pr <= 0.75 + 1e-6
  && p2.div === 2 && !p2.lens && !p2.heavy && !p2.gov, JSON.stringify(p2));
R('ECO persists', await page.evaluate(() => localStorage.getItem('mb8_power')) === 'eco');
// frame loop still renders in eco (scene keeps advancing)
const t0 = await page.evaluate(() => U.uTime.value);
await page.waitForTimeout(600);
const t1 = await page.evaluate(() => U.uTime.value);
R('frame loop alive in ECO', t1 > t0, `${t0} -> ${t1}`);
await page.evaluate(() => POWER.cycle());
const p3 = await pr();
const autoMax = await page.evaluate(() => Math.min(window.devicePixelRatio || 1, 2));
R('back to AUTO restores the governor', p3.mode === 'auto' && p3.gov && p3.max === autoMax, JSON.stringify(p3));

// ECHO: force a quote and a prompt through the real path
await page.evaluate(() => { ECHO.set('muse', false); ECHO.floatQuote(); });
await page.waitForTimeout(300);
const cloud = await page.evaluate(() => {
  const c = document.querySelector('#echoLayer .echo-cloud');
  return c ? { text: c.textContent, live: c.classList.contains('live') } : null;
});
R('a quote drifts as a cloud', !!cloud && cloud.live && cloud.text.includes('—'), cloud && cloud.text.slice(0, 60));
await page.evaluate(() => ECHO.floatPrompt());
await page.waitForTimeout(200);
R('a prompt carries its answer button', await page.locator('#echoLayer .eq-ask').count() >= 1);
await page.evaluate(() => document.querySelector('#echoLayer .eq-ask').click());
await page.waitForTimeout(150);
R('the panel opens on answer', await page.locator('#echoPanel.open').count() === 1);
await page.evaluate(() => { document.getElementById('epTa').value = 'why does this song feel like summer?'; document.getElementById('epGo').click(); });
await page.waitForTimeout(200);
const reply = await page.evaluate(() => document.getElementById('epReply').textContent);
R('the reflection composes three lines', reply.split('\n\n').length === 3, reply.replace(/\n/g, ' | ').slice(0, 90));
const journal = await page.evaluate(() => JSON.parse(localStorage.getItem('mb8_echoes') || '[]'));
R('the journal keeps it locally', journal.length === 1 && journal[0].x.includes('summer'));
R('the panel links to Echoes of Play', await page.evaluate(() =>
  document.querySelector('#echoPanel .ep-eop').href) === 'https://echoesofplay.com/');
// tick cadence: simulate played time, calm act
await page.evaluate(() => { player.playing = true; director.act = 1; ECHO._t = 0; ECHO._next = 1; ECHO.closePanel();
  document.querySelectorAll('.chrome.open').forEach(n => n.classList.remove('open')); });
await page.evaluate(() => ECHO.tick(2));
await page.waitForTimeout(200);
const dbg = await page.evaluate(() => {
  const count0 = ECHO._count;
  ECHO._t = 0; ECHO._next = 1; director.act = 1;
  ECHO.tick(2);
  return { dealt: ECHO._count === count0 + 1, rerolled: ECHO._next > 100 };
});
R('the timer deals a thought on schedule and re-rolls the clock', dbg.dealt && dbg.rerolled, JSON.stringify(dbg));
R('apex defers the drift', await page.evaluate(() => {
  ECHO._t = 0; ECHO._next = 1; director.act = 2;
  const before = document.querySelectorAll('#echoLayer .echo-cloud').length;
  ECHO.tick(2);
  return document.querySelectorAll('#echoLayer .echo-cloud').length === before && ECHO._t < ECHO._next;
}));

await browser.close(); server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall smoke checks passed');
process.exit(fails ? 1 : 0);
