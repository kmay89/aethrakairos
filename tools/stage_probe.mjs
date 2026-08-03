/* STAGE / SHELL PROBE — the room with more than one window in it.
 *
 * Three things live here that no unit test can reach, because all three are
 * facts about a BROWSER rather than about arithmetic:
 *
 *   ask     the app's own prompt and confirm. The native shell's webview draws
 *           no JavaScript dialogs at all, so any surviving window.prompt() is a
 *           dead control — the probe makes calling one an error and then works
 *           the buttons that used to.
 *   shell   what the player hides when it is running INSIDE the Mac app: an
 *           install chip for an app you are already in, a nudge to go and get it.
 *   stage   the field on a screen of its own — two real windows, a real
 *           BroadcastChannel between them, and a screen that renders the booth's
 *           numbers without a catalog, a transport or a sound of its own.
 *
 *   node tools/stage_probe.mjs [--only ask,shell,stage,slice] [--keep]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, extname } from 'path';

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ONLY = (flag('--only') || '').split(',').filter(Boolean);
const KEEP = args.includes('--keep');
const SRC = 'docs';
const DIR = join('tests', '_tmp_stage');
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const NATIVE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/17.4 Safari/605.1.15 AethraKairosNative/1.0';

let pass = 0, fail = 0;
function verdict(name, ok, detail){
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  · ' + detail : ''}`);
}
const want = n => !ONLY.length || ONLY.includes(n);

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
for (const f of ['index.html', 'sw.js', 'three.min.js', 'manifest.webmanifest', 'news.json', 'catalog.json'])
  if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(DIR, f));
if (existsSync(join(SRC, 'icons'))) cpSync(join(SRC, 'icons'), join(DIR, 'icons'), { recursive: true });

const hits = [];
const server = createServer((req, res) => {
  hits.push(req.url);
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

/* A DEAD DIALOG MUST BE AN ERROR, NOT A SILENCE. Every window.prompt/confirm/
 * alert is replaced with a throw before a line of the app runs, so any control
 * still reaching for one fails loudly here instead of quietly on a listener's
 * Mac. */
async function open(ctx, path){
  const page = await ctx.newPage();
  const rogue = [];
  await page.addInitScript(() => {
    for (const k of ['prompt', 'confirm', 'alert']){
      window[k] = () => { window.__rogueDialog = k; throw new Error('window.' + k + ' is not available in the native shell'); };
    }
  });
  page.on('pageerror', e => rogue.push(String(e.message)));
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  await page.evaluate(() => {
    for (const id of ['firstRun', 'coach', 'onboard', 'emptyState', 'help']){
      const n = document.getElementById(id);
      if (n){ n.classList.remove('open', 'in'); n.style.display = 'none'; }
    }
  });
  return { page, rogue };
}

// ------------------------------------------------------------------- ask
if (want('ask')){
  console.log('\nthe app asks in its own voice — no native dialogs anywhere');
  const ctx = await browser.newContext();
  const { page } = await open(ctx, '/');
  await page.evaluate(() => document.getElementById('btnCatalog').click());
  await page.waitForTimeout(400);
  const up = await page.evaluate(() => ({
    open: document.getElementById('askCard').classList.contains('in'),
    scrim: document.getElementById('askScrim').classList.contains('in'),
    value: document.getElementById('askInput').value,
    shown: !document.getElementById('askInput').hidden,
    rogue: window.__rogueDialog || '',
  }));
  verdict('ask: the catalog button opens the app\'s own card', up.open && up.shown, 'value "' + up.value + '"');
  verdict('ask: and no native dialog was reached for', !up.rogue, up.rogue || 'none');
  verdict('ask: the card takes the whole window while it is up', up.scrim);

  // typing and confirming resolves the promise with the text
  const typed = await page.evaluate(async () => {
    const p = ASK.text({ title: 't', body: 'b', value: 'seed' });
    await new Promise(r => setTimeout(r, 80));
    document.getElementById('askInput').value = 'https://example.test/catalog.json';
    document.getElementById('askYes').click();
    return p;
  });
  verdict('ask: OK resolves what was typed', typed === 'https://example.test/catalog.json', String(typed));
  const esc = await page.evaluate(async () => {
    const p = ASK.confirm({ title: 't', body: 'b' });
    await new Promise(r => setTimeout(r, 80));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return p;
  });
  verdict('ask: Escape is a no', esc === false);
  const gone = await page.evaluate(() => document.getElementById('askCard').classList.contains('in'));
  verdict('ask: and the card leaves when it is answered', !gone);
  await ctx.close();
}

// ----------------------------------------------------------------- shell
if (want('shell')){
  console.log('\ninside the Mac app — the app does not sell you the app');
  const ctx = await browser.newContext({ userAgent: NATIVE_UA });
  const { page } = await open(ctx, '/');
  const seen = await page.evaluate(() => {
    const vis = id => {
      const n = document.getElementById(id);
      if (!n) return 'missing';
      return getComputedStyle(n).display === 'none' ? 'hidden' : 'shown';
    };
    // force the two paths that used to put install copy on screen
    window.dispatchEvent(new Event('beforeinstallprompt'));
    if (typeof frInstallSetup === 'function') frInstallSetup();
    if (typeof MACPROMO !== 'undefined') MACPROMO.show();
    return {
      native: document.documentElement.classList.contains('native'),
      install: vis('btnInstall'), frInstall: vis('frInstall'), promo: vis('macPromo'),
    };
  });
  verdict('shell: the player knows it is in the app', seen.native);
  verdict('shell: no install chip, even when the browser offers one', seen.install !== 'shown', seen.install);
  verdict('shell: no "add to home screen" in the welcome', seen.frInstall !== 'shown', seen.frInstall);
  verdict('shell: no "get the Mac app" inside the Mac app', seen.promo !== 'shown', seen.promo);
  // and the bridge is a no-op rather than a crash when there is no shell behind it
  const bridge = await page.evaluate(async () => ({
    ready: NATIVE.ready(), call: await NATIVE.call('list_displays'),
  }));
  verdict('shell: the native bridge answers null rather than throwing', bridge.ready === false && bridge.call === null);
  await ctx.close();
}

// ----------------------------------------------------------------- stage
if (want('stage')){
  console.log('\ntwo windows, one field');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');
  const before = hits.length;
  const { page: screen } = await open(ctx, '/?stage=screen&screen=1&of=1');

  const look = await screen.evaluate(() => ({
    role: STAGE.cfg.role,
    body: document.body.classList.contains('stage-screen'),
    bar: getComputedStyle(document.querySelector('.topbar')).display,
    canvas: getComputedStyle(document.getElementById('glcanvas')).display,
    tracks: player.tracks.length,
    auto: director.auto,
  }));
  verdict('stage: the screen knows what it is', look.role === 'screen' && look.body);
  verdict('stage: every control is gone, the field is not', look.bar === 'none' && look.canvas !== 'none',
    'topbar ' + look.bar + ', canvas ' + look.canvas);
  verdict('stage: it loads no catalog — that is megabytes it will never show',
    look.tracks === 0 && !hits.slice(before).some(u => /catalog\.json/.test(u)));
  verdict('stage: and runs no director of its own', look.auto === false);

  // the numbers cross, and everything downstream reads them
  await screen.evaluate(() => STAGE.recv({
    t: 'f', at: performance.now(),
    f: { bass: 0.77, mid: 0.4, treble: 0.2, energy: 0.61, beat: 0.5, centroid: 0.3 },
    clock: { g: true, i: 3, b: 0.25, t: 128 },
    dance: { p: 0.4, w: 0.01, e: 0.9, b: 0.2, f: 0.5, g: true },
    dir: { s: 1, a: 2, t: 0.5, p: 'peak', c: 0.1, w: 0.2 },
    cam: [3, 4, 12, 0, 0, 0, 1, 55],
    col: [[0.7, 0.11, 200], [0.6, 0.12, 220], [0.5, 0.13, 240]],
    hand: { x: 0.3, y: -0.2, d: true },
  }));
  await screen.waitForTimeout(350);
  const got = await screen.evaluate(() => ({
    bass: AE.f.bass, energy: AE.f.energy, bpm: CLOCK.bpm, grid: CLOCK.haveGrid,
    act: director.act, phase: director.phase,
    camZ: Math.round(camera.position.z), fov: camera.fov,
    px: INTERACT.px, py: INTERACT.py, down: INTERACT.dragging, synth: INTERACT.synth,
    hue: COLOR.now && COLOR.now[0] ? Math.round(COLOR.now[0].h) : -1,
    waiting: !document.getElementById('stageWait').hidden,
  }));
  verdict('stage: the booth\'s ears become the screen\'s picture',
    got.bass === 0.77 && got.energy === 0.61, JSON.stringify({ bass: got.bass, energy: got.energy }));
  verdict('stage: the beat clock crosses too', got.bpm === 128 && got.grid === true);
  verdict('stage: so does the act the room is in', got.act === 2 && got.phase === 'peak',
    'act ' + got.act + ', phase ' + got.phase);
  verdict('stage: and the camera is the booth\'s pose, not a second guess at it',
    got.camZ === 12 && got.fov === 55, 'z ' + got.camZ + ', fov ' + got.fov);
  verdict('stage: and the light — the same chord, no track needed', got.hue === 200, 'hue ' + got.hue);
  verdict('stage: the hand arrives, and it is not attached to anybody here',
    Math.abs(got.px - 0.3) < 1e-9 && got.down === true && got.synth === true);
  verdict('stage: the waiting card leaves the moment the booth speaks', !got.waiting);

  // …and over the real channel, between two real windows
  await booth.evaluate(() => { STAGE.on = true; });
  await booth.waitForTimeout(900);
  const live = await Promise.all([
    booth.evaluate(() => STAGE.live()),
    screen.evaluate(() => STAGE.seenAt > 0),
    screen.evaluate(() => Number.isFinite(STAGE.offset)),
  ]);
  verdict('stage: the booth counts the screens that are really lit', live[0] >= 1, live[0] + ' screen(s)');
  verdict('stage: the screen is hearing the booth for itself', live[1] === true);
  verdict('stage: and keeps an estimate of the difference between their clocks', live[2] === true);

  // the corner booth, and the pad that reaches the far screen
  await booth.evaluate(() => STAGE.setMini(true));
  await booth.waitForTimeout(200);
  const mini = await booth.evaluate(() => {
    const pad = document.getElementById('miniPad');
    const r = pad.getBoundingClientRect();
    const ev = t => new PointerEvent(t, { pointerId: 7, clientX: r.left + r.width * 0.75,
      clientY: r.top + r.height * 0.25, bubbles: true });
    pad.dispatchEvent(ev('pointerdown'));
    const down = { px: INTERACT.px, py: INTERACT.py, dragging: INTERACT.dragging };
    pad.dispatchEvent(ev('pointerup'));
    return {
      down,
      up: INTERACT.dragging,
      mini: document.body.classList.contains('mini'),
      bar: !document.getElementById('miniBar').hidden,
      topbar: getComputedStyle(document.querySelector('.topbar')).display,
    };
  });
  verdict('stage: the booth folds into a corner', mini.mini && mini.bar && mini.topbar === 'none');
  verdict('stage: and the pad is a finger on the far screen',
    Math.abs(mini.down.px - 0.5) < 0.06 && Math.abs(mini.down.py - 0.5) < 0.06 && mini.down.dragging,
    JSON.stringify(mini.down));
  verdict('stage: lifting it lets go', mini.up === false);
  await ctx.close();
}

// ------------------------------------------------------------------- pip
/* ONE SCREEN IS STILL A STAGE. The laptop on the table has one display and no
 * popup permission worth relying on, and for a long time that meant the stage
 * could not be reached at all: the app said "allow pop-ups" and stopped. The
 * small window is the answer, and it is the floor under everything — so what is
 * checked here is that it opens, that it is a real screen on the real channel,
 * that a hand can move and size it, and that a blocked popup arrives here
 * rather than at a dead end. */
if (want('pip')){
  console.log('\none screen, and the stage still opens');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');

  await booth.evaluate(() => STAGE.open(1, { pip: true }));
  await booth.waitForSelector('#stagePip', { timeout: 5000 });
  const up = await booth.evaluate(() => {
    const box = document.getElementById('stagePip');
    const f = box.querySelector('iframe');
    const r = box.getBoundingClientRect();
    return {
      on: STAGE.on, pip: STAGE.pip,
      src: f ? f.getAttribute('src') : '',
      mini: document.body.classList.contains('mini'),
      topbar: getComputedStyle(document.querySelector('.topbar')).display,
      w: Math.round(r.width), h: Math.round(r.height),
      inView: r.left >= 0 && r.top >= 0
        && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      buttons: box.querySelectorAll('.pip-head button').length,
    };
  });
  verdict('pip: the stage opens in the corner of the booth', up.on && up.pip && !!up.src);
  verdict('pip: and what is in it is a stage screen, told it is a small one',
    /stage=screen/.test(up.src) && /pip=1/.test(up.src), up.src);
  verdict('pip: the booth stays whole — this is a preview, not a hand-off',
    !up.mini && up.topbar !== 'none');
  verdict('pip: it starts inside the window, at a size a hand can use',
    up.inView && up.w >= 220 && up.h >= 150, up.w + '×' + up.h);
  verdict('pip: with a way out, a way big and a way closed', up.buttons === 3, up.buttons + ' buttons');

  // the frame really is a screen, on the real channel, counted by the booth
  const frame = booth.frames().find(f => /stage=screen/.test(f.url()));
  let lit = 0, role = '';
  if (frame){
    await frame.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
    role = await frame.evaluate(() => STAGE.cfg.role + '/' + (document.body.classList.contains('pip') ? 'pip' : ''));
    await booth.waitForTimeout(900);
    lit = await booth.evaluate(() => STAGE.live());
  }
  verdict('pip: the picture inside it knows it is a screen', role === 'screen/pip', role);
  verdict('pip: and the booth counts it like any television', lit >= 1, lit + ' screen(s)');

  // a hand on the bar moves it; a hand on the corner sizes it
  const moved = await booth.evaluate(async () => {
    const box = document.getElementById('stagePip');
    const drag = (el, from, to) => {
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, clientX: from.x, clientY: from.y, bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, clientX: to.x, clientY: to.y, bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, clientX: to.x, clientY: to.y, bubbles: true }));
    };
    const a = box.getBoundingClientRect();
    const head = box.querySelector('.pip-head');
    drag(head, { x: a.left + 40, y: a.top + 10 }, { x: 120, y: 90 });
    const b = box.getBoundingClientRect();
    const grip = box.querySelector('.pip-grip');
    drag(grip, { x: b.right - 4, y: b.bottom - 4 }, { x: b.left + 340, y: b.top + 250 });
    const c = box.getBoundingClientRect();
    // and off the edge of the world is not a place it can be put
    drag(head, { x: c.left + 40, y: c.top + 10 }, { x: -900, y: -900 });
    const d = box.getBoundingClientRect();
    return {
      x: Math.round(b.left), y: Math.round(b.top),
      w: Math.round(c.width), h: Math.round(c.height),
      clampX: Math.round(d.left), clampY: Math.round(d.top),
    };
  });
  verdict('pip: the bar drags it', Math.abs(moved.x - 80) < 3 && Math.abs(moved.y - 80) < 3,
    moved.x + ',' + moved.y);
  verdict('pip: the corner sizes it', Math.abs(moved.w - 340) < 3 && Math.abs(moved.h - 250) < 3,
    moved.w + '×' + moved.h);
  verdict('pip: and it cannot be dragged out of the window', moved.clampX === 0 && moved.clampY === 0,
    moved.clampX + ',' + moved.clampY);

  const big = await booth.evaluate(async () => {
    const box = document.getElementById('stagePip');
    box.querySelectorAll('.pip-head button')[1].click();
    await new Promise(r => setTimeout(r, 60));
    const r = box.getBoundingClientRect();
    return { full: box.classList.contains('full'), w: Math.round(r.width), h: Math.round(r.height),
      vw: window.innerWidth, vh: window.innerHeight };
  });
  verdict('pip: and it fills the window when it is asked to',
    big.full && Math.abs(big.w - big.vw) < 2 && Math.abs(big.h - big.vh) < 2,
    big.w + '×' + big.h);

  const shut = await booth.evaluate(async () => {
    document.querySelectorAll('#stagePip .pip-head button')[2].click();
    await new Promise(r => setTimeout(r, 120));
    return { box: !!document.getElementById('stagePip'), on: STAGE.on, pip: STAGE.pip };
  });
  verdict('pip: the ✕ takes the whole thing away', !shut.box && !shut.on && !shut.pip);
  await ctx.close();

  /* THE BUG THIS EXISTS FOR: a window that will not open must not be the end of
   * the road. The Mac shell's webview opens no second window at all, and the
   * old code answered that with a sentence about popup settings and nothing
   * else — the stage was simply unreachable there. */
  const ctx2 = await browser.newContext();
  const { page: p2 } = await open(ctx2, '/');
  const fell = await p2.evaluate(async () => {
    window.open = () => null;                      // every popup blocked, as in the shell
    await STAGE.open(1);                           // the ordinary "put it on a screen"
    await new Promise(r => setTimeout(r, 200));
    return { box: !!document.getElementById('stagePip'), on: STAGE.on, pip: STAGE.pip };
  });
  verdict('pip: a blocked window falls back to the small stage, not to a dead end',
    fell.box && fell.on && fell.pip);
  await ctx2.close();
}

// ----------------------------------------------------------------- slice
if (want('slice')){
  console.log('\none camera, cut across three televisions');
  const ctx = await browser.newContext();
  const { page } = await open(ctx, '/?stage=screen&screen=2&of=3');
  await page.waitForTimeout(500);
  const cut = await page.evaluate(() => ({
    cfg: STAGE.cfg,
    view: camera.view ? { enabled: camera.view.enabled, fullWidth: camera.view.fullWidth,
      offsetX: camera.view.offsetX, width: camera.view.width } : null,
    bg: (typeof bgCam !== 'undefined' && bgCam.view) ? bgCam.view.offsetX : null,
    aspect: camera.aspect,
    w: window.innerWidth,
  }));
  verdict('slice: the screen read its place off its own address',
    cut.cfg.screen === 2 && cut.cfg.of === 3, JSON.stringify(cut.cfg));
  verdict('slice: the frustum is three screens wide', !!cut.view && cut.view.enabled
    && Math.abs(cut.view.fullWidth - cut.w * 3) < 2, JSON.stringify(cut.view));
  verdict('slice: and this one takes the middle third',
    !!cut.view && Math.abs(cut.view.offsetX - cut.w) < 2 && Math.abs(cut.view.width - cut.w) < 2);
  verdict('slice: the backdrop is cut the same way, or the sky would tear at the seam',
    cut.bg !== null && Math.abs(cut.bg - cut.w) < 2, String(cut.bg));
  await ctx.close();
}

await browser.close();
server.close();
if (!KEEP) rmSync(DIR, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
