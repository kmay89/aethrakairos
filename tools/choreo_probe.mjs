// CHOREO probe — boot the player headless, let the dancer freewheel on the
// mic path, and verify: figures deal and advance, musical time is monotone,
// the rubato stays bounded, the camera actually performs — and reduced
// motion stands the whole engine down.
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
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let errors = 0;
const boot = async (opts) => {
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  if (opts && opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', e => { errors++; console.log('pageerror:', String(e.message).slice(0, 200)); });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  try { await page.click('#langGate .lg-opt[data-lang="en"]', { timeout: 5000 }); } catch (e) {}
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const fr = document.getElementById('firstRun'); if (fr) fr.classList.remove('open');
    const ob = document.getElementById('onboard'); if (ob){ ob.classList.remove('open'); ob.style.display = 'none'; }
  });
  // the mic path makes the dancer freewheel without any audio pipeline
  await page.evaluate(() => { AE.mic.on = true; });
  return page;
};

let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ok ' : '  FAIL ') + msg); if (!ok) fails++; };

// ---- the live dancer ----
const page = await boot();
await page.waitForTimeout(4000);
const a = await page.evaluate(() => ({
  move: CHOREO.move && CHOREO.move.name, u: CHOREO.u, pose: !!CHOREO.pose,
  rate: DANCE.rate, time: DANCE.time, beats: DANCE.beats,
  th: director.camTheta, fov: director.fov,
}));
await page.waitForTimeout(3000);
const b = await page.evaluate(() => ({
  move: CHOREO.move && CHOREO.move.name, u: CHOREO.u,
  rate: DANCE.rate, time: DANCE.time, beats: DANCE.beats,
  th: director.camTheta, uTime: U.uTime.value,
}));
check(!!a.move && !!a.pose, `a figure is dealt and posed (${a.move})`);
check(b.beats > a.beats, `the count advances (${a.beats.toFixed(1)} -> ${b.beats.toFixed(1)})`);
check(b.time > a.time, `musical time is monotone (${a.time.toFixed(2)} -> ${b.time.toFixed(2)})`);
check(a.rate >= 0.4 && a.rate <= 1.9 && b.rate >= 0.4 && b.rate <= 1.9,
  `the rubato stays bounded (${a.rate.toFixed(2)}, ${b.rate.toFixed(2)})`);
check(Math.abs(b.th - a.th) > 0.005, `the camera performs (theta ${a.th.toFixed(3)} -> ${b.th.toFixed(3)})`);
check(Number.isFinite(b.uTime), 'uTime is finite');

// deal a dozen figures by hand and watch the goals stay on the rig
const deals = await page.evaluate(() => {
  const seen = [];
  for (let i = 0; i < 12; i++){
    CHOREO._deal(null);
    seen.push(CHOREO.move.name);
    const p = danceMovePose(CHOREO.move.name, 0.5, CHOREO.move);
    const phi = CHOREO.base.phi + p.dphi, r = CHOREO.base.r + p.dr;
    if (!(phi > 0 && phi < Math.PI) || !(r > 5 && r < 60)) return { bad: CHOREO.move.name, phi, r };
  }
  return { seen };
});
check(!deals.bad, deals.bad ? `figure ${deals.bad} left the rig (phi ${deals.phi}, r ${deals.r})`
  : `twelve deals stay on the rig (${[...new Set(deals.seen)].join(', ')})`);
check(deals.seen && new Set(deals.seen).size >= 3, 'the dealer varies its figures');
await page.close();

// ---- reduced motion stands the dancer down ----
const calm = await boot({ reduced: true });
await calm.waitForTimeout(2500);
const c = await calm.evaluate(() => ({
  pose: CHOREO.pose, move: CHOREO.move, rate: DANCE.rate, reduced: reducedMotion,
}));
check(c.reduced === true, 'the reduced-motion flag is honoured by the page');
check(c.pose === null && c.move === null && c.rate === 1,
  `reduced motion stands the choreographer down (rate ${c.rate})`);
await calm.close();

check(errors === 0, `no page errors (${errors})`);
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall clear');
process.exit(fails ? 1 : 0);
