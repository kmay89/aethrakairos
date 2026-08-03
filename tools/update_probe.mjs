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
 *   current    no deploy at all — a correct app is silent, and a card raised in
 *              error can leave
 *   again      the reported loop: the origin probe must reach the origin, and a
 *              swap already applied must never be offered a second time
 *   idle       a worker installed from a changed sw.js while the shell stayed
 *              put — it carries the running build and must be retired, not sold
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
  const hits = [];                          // every request that reached the ORIGIN
  const server = createServer((req, res) => {
    hits.push(req.url);
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = join(dir, p === '/' ? 'index.html' : p.slice(1));
    if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
    // no-store on the shell: the probe measures the SERVICE WORKER's update
    // machinery, and an HTTP cache in the way would measure the wrong thing
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-cache' });
    res.end(readFileSync(f));
  });
  return { dir, server, hits, close(){ server.close(); if (!KEEP) rmSync(dir, { recursive: true, force: true }); } };
}
function deploy(dir, stampSw){
  writeFileSync(join(dir, 'index.html'), readFileSync(join(dir, 'index.html'), 'utf8')
    .replace(/const MB8_BUILD = '[^']*';/, `const MB8_BUILD = '${NEW}';`));
  if (stampSw) writeFileSync(join(dir, 'sw.js'), readFileSync(join(dir, 'sw.js'), 'utf8')
    .replace(/const VERSION = '[^']*';/, `const VERSION = '${NEW}';`));
}
/* A DEPLOY OF THE WORKER ALONE. sw.js and index.html are separate objects with
 * separate journeys through a CDN, so this is not a hypothetical: a worker
 * installs from a changed sw.js while the edge still serves the previous shell,
 * and then waits — carrying the build already running. */
function bumpWorkerOnly(dir){
  writeFileSync(join(dir, 'sw.js'), readFileSync(join(dir, 'sw.js'), 'utf8')
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
  try { await fn({ origin, ctx, dir: s.dir, stampSw, hits: s.hits }); }
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

/* ------------------------------------------------- THE OFFER THAT KEPT COMING
 * The report, in the listener's words: "update is working but not knowing it has
 * and keeps offering it". Three separate mechanisms let that happen, and each
 * gets a scenario here, because each is invisible to the other two.
 */
if (want('again')){
  console.log('\napplied once — the same swap must never be offered again');
  await run('again', false, async ({ origin, ctx, dir, hits }) => {
    const page = await ctx.newPage();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 25000 }).catch(() => {});

    /* 1 · THE ORIGIN PROBE MUST REACH THE ORIGIN. verifyShell() is the whole
     * verification layer, and it fetched `index.html?_v=…` — which the worker's
     * shell route matches, because that route compares PATHS and a query string
     * is not one. The probe was answered out of the cache, by the worker, and
     * every verdict it produced was the cache's opinion of itself. */
    const before = hits.length;
    await page.evaluate(() => verifyShell('claim'));
    await page.waitForTimeout(1500);
    const probed = hits.slice(before).filter(u => /mb8probe/.test(u));
    verdict('again: the origin probe reaches the origin, not our own cache', probed.length > 0,
      probed.length + ' request(s) past the service worker');

    /* 2 · AN UN-STAMPED DEPLOY, APPLIED, IS DONE. Same build id, different bytes
     * — so applying it can never move MB8_BUILD, and nothing about the running
     * page can prove the swap landed. What proves it is the memory of having
     * applied that exact offer, which is why the memory has to outlive the
     * reload the apply causes. */
    writeFileSync(join(dir, 'index.html'), readFileSync(join(dir, 'index.html'), 'utf8')
      .replace('</html>', '<!-- probe-unstamped --></html>'));
    await page.evaluate(() => checkForUpdate());
    const offered = await page.waitForFunction('!document.getElementById("btnUpdate").hidden', null,
      { timeout: 30000 }).then(() => true).catch(() => false);
    verdict('again: an un-stamped deploy is still offered', offered);
    if (!offered) return;
    const announced = await page.evaluate(() => UPDATE.key);
    await page.evaluate(() => applyUpdate()).catch(() => {});
    await page.waitForTimeout(4000);
    await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 25000 }).catch(() => {});
    await prep(page);
    const landed = await page.evaluate(() => document.documentElement.outerHTML.includes('probe-unstamped'));
    verdict('again: the swap landed — the new bytes are what is running', landed);
    verdict('again: and the app remembers applying it',
      (await page.evaluate(() => UPDATE.tried)) === announced,
      'remembered "' + await page.evaluate(() => UPDATE.tried) + '"');

    // now replay the exact announcement the worker would make. A correct app has
    // nothing to say: it already did this one, and doing it again cannot help.
    await page.evaluate(k => {
      const t = String(k).split('>').pop();
      offerUpdate('shell', MB8_BUILD, t);
    }, announced);
    await page.waitForTimeout(800);
    for (let i = 0; i < 3; i++){ await page.evaluate(() => checkForUpdate()); await page.waitForTimeout(1200); }
    verdict('again: the same offer, replayed, is not a card',
      await page.evaluate(() => document.getElementById('btnUpdate').hidden === true),
      'source "' + await page.evaluate(() => UPDATE.source) + '"');
  });
}

/* 3 · A WAITING WORKER WITH NOTHING TO BRING. sw.js changed and index.html did
 * not — a real CDN state, and one that used to raise a card on every single
 * launch reading "<build> → new", because a waiting worker was believed on
 * sight. Applying it activated a worker whose cache held the shell already
 * running, changed nothing, and left the next launch to find the next one. */
if (want('idle')){
  console.log('\na waiting worker that carries this very build — retire it, do not offer it');
  await run('idle', false, async ({ origin, ctx, dir }) => {
    const page = await ctx.newPage();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 25000 }).catch(() => {});
    const running = await build(page);
    bumpWorkerOnly(dir);
    /* AWAIT the registration's own update job. checkForUpdate() fires it and
     * walks away, which is right for the app and wrong for a probe: in a
     * headless page nobody is looking at, Chromium is in no hurry to run an
     * update job for a promise nothing holds, and forty seconds of polling
     * found an install that had never started. Awaiting the same call the app
     * makes changes the harness's patience, not the app's behaviour — from here
     * on it is the page's own updatefound/statechange listeners doing the work.
     *
     * The retirement is then read out of the ACTIVITY log rather than by
     * watching registration.waiting: the fix is faster than a poll can be — the
     * worker is handed over within a round-trip of installing — so waiting for
     * `waiting` to be non-null is a race the CORRECT app wins. The log is the
     * receipt it leaves behind. */
    await page.evaluate(() => swReg.update().catch(() => {}));
    const retired = await page.waitForFunction(
      "ACTIVITY.list.some(e => /handed over quietly/.test(e.m || ''))", null,
      { timeout: 40000 }).then(() => true).catch(() => false);
    verdict('idle: a worker carrying the running build is retired, not sold', retired,
      retired ? 'handed over without a word' : 'no handover in the log');
    verdict('idle: and it never became a card',
      await page.evaluate(() => document.getElementById('btnUpdate').hidden === true),
      'target was "' + await page.evaluate(() => UPDATE.newBuild || 'new') + '"');
    verdict('idle: nothing is left waiting to ask again next launch',
      await page.evaluate(() => !(swReg && swReg.waiting)));
    verdict('idle: the listener is still on the build they booted', (await build(page)) === running);
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
