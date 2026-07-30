/* UPDATE PROBE — does a deploy actually reach the listener?
 *
 * The self-update path is the one piece of this app that cannot be unit-tested,
 * because the thing under test IS the browser: a service-worker registration,
 * a waiting worker, a byte-compared shell, a controllerchange, a reload. Every
 * part of it is pure and tested (updateGate, updateProgress, updateWatchdogStep,
 * updateReminder) and none of that would have caught the bug this tool was
 * written for — a tap on "Update now" that silently did nothing.
 *
 * So it serves a scratch copy of docs/ over a real origin, boots the real page,
 * simulates a deploy by rewriting MB8_BUILD (and sw.js's VERSION) on disk, and
 * then checks that a listener who taps Update ends up on the new build.
 *
 * Scenarios (all run by default):
 *   stamped    a normal release — sw.js changes, a new worker waits
 *   unstamped  a deploy that forgot the stamp — only index.html differs, so
 *              only the worker's byte-compare can notice it
 *   sibling    two clients open; ONE applies. The other's waiting worker is
 *              consumed out from under it — the state that used to leave a
 *              dead Update button and a page stranded on old code
 *   later      "Later" is a promise: it must survive a reload, show a badge,
 *              remind once when it expires, and clear when the update lands
 *
 *   node tools/update_probe.mjs [--only stamped,sibling] [--keep]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ONLY = (flag('--only') || '').split(',').filter(Boolean);
const KEEP = args.includes('--keep');
const NEW = 'probe0new0';
const SRC = 'docs';
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

let pass = 0, fail = 0;
const results = [];
function verdict(name, ok, detail){
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  · ' + detail : ''}`);
}

/* a throwaway origin serving a COPY, so the probe can rewrite the deploy under
 * the browser's feet without touching the repo */
function site(tag){
  const dir = join('tests', '_tmp_update_' + tag);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'sw.js', 'three.min.js', 'manifest.webmanifest', 'news.json', 'catalog.json'])
    if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(dir, f));
  if (existsSync(join(SRC, 'icons'))) cpSync(join(SRC, 'icons'), join(dir, 'icons'), { recursive: true });
  const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = join(dir, p === '/' ? 'index.html' : p.slice(1));
    if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    // no-store on the shell: the probe measures the SERVICE WORKER's update
    // machinery, and an HTTP cache in the way would measure the wrong thing
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-cache' });
    res.end(readFileSync(f));
  });
  return { dir, server, close(){ server.close(); if (!KEEP) rmSync(dir, { recursive: true, force: true }); } };
}
function deploy(dir, stampSw){
  writeFileSync(join(dir, 'index.html'), readFileSync(join(dir, 'index.html'), 'utf8')
    .replace(/const MB8_BUILD = '[^']*';/, `const MB8_BUILD = '${NEW}';`));
  if (stampSw) writeFileSync(join(dir, 'sw.js'), readFileSync(join(dir, 'sw.js'), 'utf8')
    .replace(/const VERSION = '[^']*';/, `const VERSION = '${NEW}';`));
}
/* Clear the curtains and hold auto-apply off. SHOW mode is the app's own
 * "never yank a performance" switch, which is exactly the gate needed to test
 * what a deliberate TAP does rather than what the timer does. */
async function prep(page){
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 40000 });
  await page.evaluate(() => {
    for (const id of ['firstRun', 'coach', 'onboard', 'emptyState', 'help']){
      const n = document.getElementById(id);
      if (n){ n.classList.remove('open', 'in'); n.style.display = 'none'; }
    }
    if (typeof POWER !== 'undefined') POWER.set('show', false);
  });
}
/* Press the control, not the pixel. Playwright's click is viewport-aware and
   began timing out with "element is outside of the viewport" as the HUD grew —
   which says something about layout on a 1280x720 headless window and nothing
   about the update machinery this tool exists to test. Dispatching the click on
   the element runs the same handler a tap runs. */
const build = page => page.evaluate(() => (typeof MB8_BUILD === 'string' ? MB8_BUILD : '?')).catch(() => '?');

async function run(tag, stampSw, fn){
  const s = site(tag);
  await new Promise(r => s.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.server.address().port}`;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext();
  try { await fn({ origin, ctx, dir: s.dir, stampSw }); }
  finally { await browser.close(); s.close(); }
}

const want = n => !ONLY.length || ONLY.includes(n);

// ---------------------------------------------------------------- one client
for (const [tag, stampSw, label] of [['stamped', true, 'stamped'], ['unstamped', false, 'unstamped']]){
  if (!want(tag)) continue;
  console.log(`\n${label} deploy — a listener taps Update now`);
  await run(tag, stampSw, async ({ origin, ctx, dir, stampSw }) => {
    const page = await ctx.newPage();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 25000 }).catch(() => {});
    const from = await build(page);
    deploy(dir, stampSw);
    await page.evaluate(() => checkForUpdate());
    const offered = await page.waitForFunction('!document.getElementById("btnUpdate").hidden', null,
      { timeout: 30000 }).then(() => true).catch(() => false);
    verdict(`${label}: the update is offered`, offered);
    if (!offered) return;
    await page.evaluate(() => document.getElementById('btnUpdate').click());
    await page.waitForTimeout(300);
    verdict(`${label}: the card opens`, await page.evaluate(() =>
      document.getElementById('updateCard').classList.contains('in')));
    await page.evaluate(() => document.getElementById('upNow').click());
    await page.waitForTimeout(5000);
    await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 25000 }).catch(() => {});
    const to = await build(page);
    verdict(`${label}: the tap lands the new build`, to === NEW, `${from} -> ${to}`);
  });
}

/* ------------------------------------------------- NO DEPLOY, NO OFFER
 * The failure a listener actually reported, and the one nothing here was
 * watching for: a card reading "05d9b7a1af → new" for the build they were
 * already running. Applying it changed nothing, the next check raised it again,
 * and the loop brake in updateGate — which only ever rate-limited the AUTOMATIC
 * apply — let it keep coming back by hand.
 *
 * So: boot, settle, then check for updates repeatedly WITHOUT deploying
 * anything. A correct app is silent. This also re-checks after a reload, because
 * every new worker starts with an empty versioned cache and the byte-compare
 * used to fire against that nothing and call it a fresh shell. */
if (want('current')){
  console.log('\nno deploy at all — the app must not offer an update to itself');
  await run('current', true, async ({ origin, ctx }) => {
    const page = await ctx.newPage();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 25000 }).catch(() => {});
    const running = await build(page);
    for (let i = 0; i < 4; i++){
      await page.evaluate(() => checkForUpdate());
      await page.waitForTimeout(1200);
    }
    const quiet = await page.evaluate(() => ({
      hidden: document.getElementById('btnUpdate').hidden,
      source: UPDATE.source, newBuild: UPDATE.newBuild,
    }));
    verdict('current: four checks, no deploy, no offer', quiet.hidden === true,
      'button hidden ' + quiet.hidden + ' · source "' + quiet.source + '" · target "' + quiet.newBuild + '"');

    // ...and again after a reload, which is when a fresh worker's cache is cold
    await page.reload({ waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i++){
      await page.evaluate(() => checkForUpdate());
      await page.waitForTimeout(1200);
    }
    const after = await page.evaluate(() => ({
      hidden: document.getElementById('btnUpdate').hidden, build: MB8_BUILD,
    }));
    verdict('current: still silent after a reload', after.hidden === true && after.build === running,
      'button hidden ' + after.hidden + ' · still on ' + after.build);

    /* AND A CARD RAISED IN ERROR MUST BE ABLE TO LEAVE. Forcing the exact claim
     * that caused the report — a controllerchange nobody asked for, which carries
     * no build id and measured nothing — must end with the button withdrawn once
     * the deployed shell is checked and found to be this very build, not with a
     * card the listener has to dismiss forever. */
    await page.evaluate(() => offerUpdate('claim', ''));
    const withdrawn = await page.waitForFunction('document.getElementById("btnUpdate").hidden === true',
      null, { timeout: 15000 }).then(() => true).catch(() => false);
    verdict('current: an unmeasured claim is checked and withdrawn, not shown', withdrawn,
      withdrawn ? 'verified against the deployed shell and dropped' : 'the card stayed up');

    /* THE OTHER DIRECTION, and the reason this is judged by provenance at all: a
     * 'shell' offer is the worker's byte-compare reporting that the deployed shell
     * differs from the one this page was served. That is a measurement, and it has
     * to stand even when the stamp did not move — an un-stamped deploy is the same
     * build id with different bytes, and rejecting it on id equality is how the
     * first version of this fix broke the badge entirely. */
    await page.evaluate(() => offerUpdate('shell', ''));
    await page.waitForTimeout(500);
    const stands = await page.evaluate(() => !document.getElementById('btnUpdate').hidden);
    verdict('current: a measured shell difference still stands, stamp or no stamp', stands,
      stands ? 'the worker measured content — the offer is kept' : 'the offer was dropped');
  });
}

// ------------------------------------------------------------ two clients
if (want('sibling')){
  console.log('\nsibling deploy — one client applies, the other must not be stranded');
  await run('sibling', true, async ({ origin, ctx, dir }) => {
    const A = await ctx.newPage(); await A.goto(origin + '/', { waitUntil: 'domcontentloaded' }); await prep(A);
    await A.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 25000 }).catch(() => {});
    const B = await ctx.newPage(); await B.goto(origin + '/', { waitUntil: 'domcontentloaded' }); await prep(B);
    deploy(dir, true);
    await A.evaluate(() => checkForUpdate());
    await A.waitForFunction('UPDATE.ready()', null, { timeout: 30000 }).catch(() => {});
    // B may not have run its own check; put the offer up the way a live page would
    await B.evaluate(() => { if (document.getElementById('btnUpdate').hidden) offerUpdate('worker', ''); });
    // evaluate() can reject as the page navigates out from under it — that IS
    // the swap working, so the throw is the expected case, not a failure
    await A.evaluate(() => applyUpdate()).catch(() => {});
    await A.waitForFunction(`typeof MB8_BUILD === 'string' && MB8_BUILD === '${NEW}'`, null,
      { timeout: 25000 }).catch(() => {});
    verdict('sibling: the client that applied is updated', (await build(A)) === NEW);
    await B.waitForTimeout(2500);
    // the whole point: B's waiting worker is gone, so B must have noticed that
    // the shell it is running is now stale
    verdict('sibling: the other client still has a live offer',
      await B.evaluate(() => UPDATE.ready()), 'source=' + await B.evaluate(() => UPDATE.source));
    await B.bringToFront();
    await B.evaluate(() => document.getElementById('btnUpdate').click()); await B.waitForTimeout(300);
    await B.evaluate(() => document.getElementById('upNow').click());
    await B.waitForTimeout(5000);
    await B.waitForFunction('window.__mb8Booted === true', null, { timeout: 25000 }).catch(() => {});
    const to = await build(B);
    verdict('sibling: its tap is not a no-op', to === NEW, 'ended on ' + to);
  });
}

// ------------------------------------------------------------------- later
if (want('later')){
  console.log('\n"Later" — a promise that outlives the page');
  await run('later', true, async ({ origin, ctx, dir }) => {
    const page = await ctx.newPage();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' }); await prep(page);
    await page.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 25000 }).catch(() => {});
    deploy(dir, true);
    await page.evaluate(() => checkForUpdate());
    await page.waitForFunction('!document.getElementById("btnUpdate").hidden', null, { timeout: 30000 });
    verdict('later: a waiting update wears a dot',
      await page.evaluate(() => document.getElementById('upBadge').textContent) === '•');
    await page.evaluate(() => document.getElementById('btnUpdate').click()); await page.waitForTimeout(250);
    await page.evaluate(() => document.getElementById('upLater').click()); await page.waitForTimeout(400);
    verdict('later: the badge becomes the count',
      await page.evaluate(() => document.getElementById('upBadge').textContent) === '1');
    await page.reload({ waitUntil: 'domcontentloaded' }); await prep(page);
    await page.waitForTimeout(1500);
    const kept = await page.evaluate(() => ({ d: UPDATE.deferrals, s: UPDATE.snoozedUntil > Date.now() }));
    verdict('later: the deferral survives a reload', kept.d === 1 && kept.s, JSON.stringify(kept));
    // the reminder: due once when the snooze runs out, never twice
    const r = await page.evaluate(() => {
      UPDATE.source = 'shell';                 // a pending update to be reminded about
      UPDATE.deferrals = 2; UPDATE.lastRemindAt = 0;
      UPDATE.snoozedUntil = Date.now() - 1000; UPDATE._persist();
      const host = document.getElementById('toasts');
      UPDATE.remind();
      const first = { toasts: host.children.length, stamped: UPDATE.lastRemindAt > 0 };
      UPDATE.remind();
      return { ...first, after: host.children.length };
    });
    verdict('later: the reminder fires exactly once per expiry',
      r.stamped && r.toasts === r.after, JSON.stringify(r));
    await page.evaluate(() => { const c = document.getElementById('updateCard'); if (c) c.classList.remove('in'); });
    await page.evaluate(() => document.getElementById('btnUpdate').click()); await page.waitForTimeout(250);
    await page.evaluate(() => document.getElementById('upNow').click()); await page.waitForTimeout(5000);
    await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 25000 }).catch(() => {});
    const done = await page.evaluate(() => ({ b: MB8_BUILD, d: UPDATE.deferrals })).catch(() => ({}));
    verdict('later: applying clears the deferral count', done.b === NEW && done.d === 0, JSON.stringify(done));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
