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
 *   warm    the join, as something you DO: two questions, then every hand in
 *           the room drawn on every screen in the room.
 *
 *   node tools/stage_probe.mjs [--only ask,shell,stage,console,pip,slice,wall,native,wire,warm,crowd,pages,install] [--keep]
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
for (const f of ['index.html', 'mac.html', 'sw.js', 'three.min.js', 'manifest.webmanifest', 'news.json', 'catalog.json'])
  if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(DIR, f));
if (existsSync(join(SRC, 'icons'))) cpSync(join(SRC, 'icons'), join(DIR, 'icons'), { recursive: true });

/* THE MAILBOX, IN MINIATURE. The wire's front door is an ephemeral pigeonhole
 * (kmay89.com/api/room) that holds a WebRTC handshake under four letters —
 * nothing else crosses it, so nothing else needs emulating. This is the same
 * protocol the real one speaks (host/offer/join/answer/poll/close), held in a
 * Map instead of a blob store, so the probe can watch two REAL pages shake
 * hands and open a REAL data channel without leaving the loopback. */
const rooms = new Map();
function mailbox(req, res, q){
  const say = (o, status) => {
    res.writeHead(status || 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(o));
  };
  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => {
    let b = {};
    try { b = raw ? JSON.parse(raw) : {}; } catch (e){}
    const a = q.get('a') || '';
    if (a === 'ping') return say({ ok: true, t: Date.now() });
    if (a === 'host'){
      let code = b.code, key = b.key, room = code && rooms.get(code);
      if (!room || room.key !== key){
        key = 'k' + Math.random().toString(36).slice(2, 12);
        code = '';
        const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        for (let i = 0; i < 4; i++) code += AL[Math.floor(Math.random() * AL.length)];
        room = { key, seq: 0, slots: [] };
        rooms.set(code, room);
      } else room.slots = [];
      room.seq++;
      room.slots.push({ id: room.seq, offer: b.offer, claimed: false, answer: null });
      return say({ code, key, slot: room.seq });
    }
    if (a === 'beacon'){
      let code = b.code, key = b.key, room = code && rooms.get(code);
      if (!room || room.key !== key){
        key = 'k' + Math.random().toString(36).slice(2, 12);
        code = '';
        const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        for (let i = 0; i < 4; i++) code += AL[Math.floor(Math.random() * AL.length)];
        rooms.set(code, { key, seq: 0, slots: [], pulse: null });
      }
      return say({ code, key });
    }
    const code = String((b.code || q.get('code') || '')).toUpperCase();
    const room = rooms.get(code);
    if (!room) return say({ error: 'that room has gone' }, 404);
    if (a === 'offer'){
      if (room.key !== b.key) return say({ error: 'not your room' }, 403);
      room.seq++;
      room.slots.push({ id: room.seq, offer: b.offer, claimed: false, answer: null });
      return say({ slot: room.seq });
    }
    if (a === 'join'){
      const slot = room.slots.find(s => !s.claimed);
      if (!slot) return say({ error: 'That room is full up.' }, 409);
      slot.claimed = true;
      return say({ slot: slot.id, offer: slot.offer, name: 'The stage', host: 'The booth' });
    }
    if (a === 'answer'){
      const slot = room.slots.find(s => s.id === b.slot);
      if (!slot) return say({ error: 'that pigeonhole is gone' }, 404);
      slot.answer = b.answer;
      return say({ ok: true });
    }
    if (a === 'poll'){
      if (room.key !== q.get('key')) return say({ error: 'not your room' }, 403);
      const fresh = room.slots.filter(s => s.answer && !s.taken);
      for (const s of fresh) s.taken = true;
      return say({ answers: fresh.map(s => ({ slot: s.id, answer: s.answer, who: 'A screen' })),
        free: room.slots.filter(s => !s.claimed).length });
    }
    if (a === 'close'){ rooms.delete(code); return say({ ok: true }); }
    if (a === 'pulse'){
      if (req.method === 'POST'){
        if (room.key !== b.key) return say({ error: 'not your room' }, 403);
        room.pulse = b.pulse || null;
        return say({ ok: true });
      }
      return say({ pulse: room.pulse || null });
    }
    return say({ error: 'unknown request' }, 400);
  });
}

const hits = [];
const server = createServer((req, res) => {
  hits.push(req.method + ' ' + req.url);
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);
  if (p === '/api/room') return mailbox(req, res, u.searchParams);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    /* the wire section runs a real RTCPeerConnection over the loopback.
     * Chromium hides host candidates behind mDNS names, and multicast does
     * not exist inside a CI container — so the two pages would offer each
     * other names neither can resolve and the handshake would hang. Plain
     * addresses on the loopback are exactly what a probe wants. */
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--allow-loopback-in-peer-connection',
    /* the crowd section joins with a microphone: a fake device, granted
     * without a prompt, because there is no hand here to tap "allow" */
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream'] });

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

// --------------------------------------------------------------- console
/* THE DECK. The strip is right for the shell's 360×148 sliver; the same
 * console owning a monitor-sized browser window used to be three buttons
 * over a void. What is checked here is the answer: a roomy window lays the
 * controls on the desk, gives every screen a live tile — fed by the
 * screen's own postcard of its own glass, not by a hopeful local re-render
 * — and folds back to the strip the moment the window really is a sliver,
 * at which point the screens are told to stop photographing themselves. */
if (want('console')){
  console.log('\nthe console, given a window worth using');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');
  const { page: screen } = await open(ctx, '/?stage=screen&screen=1&of=1');
  await booth.evaluate(() => { STAGE.on = true; STAGE.setMini(true); });
  await booth.waitForTimeout(1200);                     // roster, wall, deckSync
  const deck = await booth.evaluate(() => ({
    deck: document.body.classList.contains('deck'),
    mons: !document.getElementById('miniMons').hidden,
    tiles: document.querySelectorAll('.mon-tile[data-sid]').length,
    add: !!document.querySelector('.mon-tile.add'),
    more: !document.getElementById('miniMore').hidden,
    moreBtns: document.getElementById('miniMore').childElementCount,
    chevron: getComputedStyle(document.getElementById('miniExpand')).display,
    padH: document.getElementById('miniPad').getBoundingClientRect().height,
    airplay: document.getElementById('miniAirplay').style.display,
    airplaySays: (player.cur !== -1 && airplaySupported()),
  }));
  verdict('console: a roomy window is a desk, not a strip in a void', deck.deck && deck.mons);
  verdict('console: the twenty controls are ON the desk — no chevron to know about',
    deck.more && deck.moreBtns >= 10 && deck.chevron === 'none', deck.moreBtns + ' controls');
  verdict('console: the pad grows into the room it was given', deck.padH >= 100,
    Math.round(deck.padH) + 'px');
  verdict('console: every screen is a tile, and one tile adds a screen',
    deck.tiles >= 1 && deck.add, deck.tiles + ' tile(s)');
  verdict('console: AirPlay shows exactly when the platform can answer it',
    (deck.airplay === '') === deck.airplaySays, 'display "' + deck.airplay + '"');
  const shotOn = await screen.evaluate(() => STAGE.shotsOn === true);
  verdict('console: the screen was told somebody is looking', shotOn);
  await booth.waitForTimeout(2400);
  const shot = await booth.evaluate(() => {
    const img = document.querySelector('.mon-tile[data-sid] img');
    return { has: !!img, jpeg: !!img && /^data:image\/jpeg/.test(img.src),
      size: img ? img.src.length : 0 };
  });
  verdict('console: the tile is the screen\'s own postcard, not a guess',
    shot.has && shot.jpeg && shot.size > 400, (shot.size / 1024).toFixed(1) + ' KB');
  /* a rig standing on popped-out windows grows by a popped-out window — the
   * add tile is clicked for REAL so the gesture is live, which is the whole
   * mechanism: window.open inside the click, never a corner pip. */
  await booth.evaluate(() => { STAGE.wins.push({ closed: false }); });
  const popup = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  await booth.click('.mon-tile.add');
  const pw = await popup;
  if (pw) await pw.waitForLoadState('domcontentloaded').catch(() => {});
  const grown = await booth.evaluate(() => STAGE.wins.length);
  verdict('console: a rig of popped-out windows grows by a popped-out window',
    !!pw && /stage=screen/.test(pw.url()) && grown === 2,
    pw ? pw.url().replace(/^[^?]*/, '') : 'no window opened');
  if (pw) await pw.close();
  /* the shrink is waited for by its arrival, not by a stopwatch — on a
   * software-GL runner the resize can take longer than any polite guess.
   * And the booth is brought forward first: resize events ride rendering
   * frames, which a backgrounded page may not get at all — while a real
   * operator resizing a real window is, necessarily, looking at it. */
  await booth.bringToFront();
  await booth.setViewportSize({ width: 400, height: 160 });
  await booth.waitForFunction(() => window.innerWidth <= 420, null, { timeout: 8000 });
  await booth.waitForTimeout(250);
  const strip = await booth.evaluate(() => ({
    deck: document.body.classList.contains('deck'),
    chevron: getComputedStyle(document.getElementById('miniExpand')).display !== 'none',
    mons: document.getElementById('miniMons').hidden,
  }));
  verdict('console: a sliver of a window is a strip again',
    !strip.deck && strip.chevron && strip.mons, JSON.stringify(strip));
  await screen.waitForFunction(() => STAGE.shotsOn === false, null, { timeout: 4000 }).catch(() => {});
  const shotOff = await screen.evaluate(() => STAGE.shotsOn === false);
  verdict('console: and the screens stop photographing themselves for nobody', shotOff);
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

  /* AND THE QUAD SCENES TAKE THEIR SLICE TOO. Five scenes are fullscreen
   * quads that build their picture from vUv, straight past the camera —
   * for them setViewOffset does nothing, and each used to draw the WHOLE
   * composition on every screen of a wall. Their uSlice uniform (identity
   * everywhere else) is what cuts them now: switch a quad scene live on
   * the middle screen of three and its material must be holding the middle
   * third and the wall's aspect, not the window's. */
  const quad = await page.evaluate(async () => {
    const i = scenes.findIndex(s => /OP.?ART|PARLOR|PULSE/i.test(String(s.name || '')));
    if (i < 0) return { found: false };
    director.setScene(i, false);
    await new Promise(r => setTimeout(r, 500));
    let got = null;
    scene.traverse(o => {
      const u = o.material && o.material.uniforms;
      if (!got && u && u.uSlice && u.uAspect && u.uSlice.value.z < 0.999)
        got = { s: u.uSlice.value.toArray(), a: u.uAspect.value };
    });
    return { found: true, got, winAsp: window.innerWidth / Math.max(1, window.innerHeight) };
  });
  verdict('slice: a fullscreen-shader scene holds the middle third of the wall, not the whole picture',
    quad.found && !!quad.got
    && Math.abs(quad.got.s[0] - 1 / 3) < 1e-3 && Math.abs(quad.got.s[2] - 1 / 3) < 1e-3,
    JSON.stringify(quad.got));
  verdict('slice: and builds it against the wall\'s aspect, not the window\'s',
    quad.found && !!quad.got && Math.abs(quad.got.a - quad.winAsp * 3) < 1e-3,
    quad.got && (quad.got.a.toFixed(3) + ' vs window ' + quad.winAsp.toFixed(3)));
  await ctx.close();
}

/* ------------------------------------------------------------------ wall
 * THE THING THAT CANNOT BE UNIT TESTED: that the picture follows the window.
 *
 * The arithmetic has its own tests — the wall is the union, a slice is a share
 * of it, the seam is exact. What only a browser can answer is whether that
 * arithmetic is actually WIRED to anything: whether three corner windows open
 * at all, whether the booth is reading their real rectangles rather than a
 * grid, whether dragging one re-cuts the field under the hand rather than on
 * the drop, and whether the window that ends up furthest left starts calling
 * itself screen one. */
if (want('wall')){
  console.log('\nthree screens on a one-screen laptop, and a field that follows them');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');

  await booth.evaluate(() => STAGE.open(3, { pip: true }));
  await booth.waitForFunction(() => document.querySelectorAll('.stage-pip').length === 3,
    null, { timeout: 5000 });
  const up = await booth.evaluate(() => {
    const boxes = [...document.querySelectorAll('.stage-pip')];
    return {
      n: boxes.length,
      on: STAGE.on, pip: STAGE.pip, pips: STAGE.pips.length,
      srcs: boxes.map(b => b.querySelector('iframe').getAttribute('src')),
      titles: boxes.map(b => b.querySelector('.pip-title').textContent),
      inView: boxes.every(b => {
        const r = b.getBoundingClientRect();
        return r.left >= -1 && r.top >= -1
          && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
      }),
      // opened as a row, which is what a stage is
      row: (() => {
        const ys = boxes.map(b => Math.round(b.getBoundingClientRect().top));
        return ys.every(y => Math.abs(y - ys[0]) < 2);
      })(),
      booth: !document.body.classList.contains('mini'),
    };
  });
  verdict('wall: three screens asked for, three windows opened', up.n === 3 && up.pips === 3, up.n + ' windows');
  verdict('wall: each is a stage screen with an identity of its own',
    up.srcs.every((s, i) => /stage=screen/.test(s) && /pip=1/.test(s) && s.includes('id=s' + (i + 1))),
    up.srcs[0]);
  verdict('wall: each carries its own number where a hand can read it',
    up.titles.every((t, i) => t.includes(String(i + 1))), up.titles.join(' | '));
  verdict('wall: they open as a row, inside the window, with the booth left whole',
    up.row && up.inView && up.booth);

  /* THE CUT COMES FROM THE RECTANGLES, NOT FROM THE COUNT. Three windows in a
   * row with gaps between them do NOT each get a clean third — they get their
   * true share of the union, gaps and all, exactly as three televisions with
   * bezels would. A layout that returned 1/3 here would be the grid wearing
   * the wall's clothes. */
  const wall = await booth.evaluate(() => {
    const L = stageLayout(STAGE.rects());
    return { map: L.map, bounds: L.bounds, ids: Object.keys(L.map) };
  });
  const shares = wall.ids.map(id => wall.map[id].fw);
  verdict('wall: the booth reads all three real rectangles', wall.ids.length === 3, wall.ids.join(','));
  verdict('wall: and cuts the field where they actually are, gaps included',
    shares.every(f => f > 0.2 && f < 1 / 3), shares.map(f => f.toFixed(3)).join(' '));
  verdict('wall: which tiles left to right without overlapping',
    Math.abs(wall.map.s1.fx) < 1e-9 && wall.map.s1.fx + wall.map.s1.fw <= wall.map.s2.fx + 1e-9
      && wall.map.s2.fx + wall.map.s2.fw <= wall.map.s3.fx + 1e-9);

  /* THE EFFECT ITSELF: drag one, and the cut moves with it — on the move, not
   * on the drop. The far side of the wall is watched, because a window dragged
   * left widens the wall and every OTHER window's slice must shrink to match:
   * one field, not three that happen to agree. */
  const dragged = await booth.evaluate(async () => {
    const before = stageLayout(STAGE.rects()).map;
    const box = [...document.querySelectorAll('.stage-pip')][2];
    const head = box.querySelector('.pip-head');
    const r = box.getBoundingClientRect();
    head.dispatchEvent(new PointerEvent('pointerdown',
      { pointerId: 9, clientX: r.left + 30, clientY: r.top + 10, bubbles: true }));
    head.dispatchEvent(new PointerEvent('pointermove',
      { pointerId: 9, clientX: 34, clientY: 40, bubbles: true }));
    // a second move past the thirty-a-second valve, so what is read below is
    // what the booth had actually broadcast rather than what it was holding
    await new Promise(r2 => setTimeout(r2, 80));
    head.dispatchEvent(new PointerEvent('pointermove',
      { pointerId: 9, clientX: 34, clientY: 40, bubbles: true }));
    // read the wall MID-DRAG: the pointer is still down
    await new Promise(r2 => setTimeout(r2, 60));
    const mid = { map: stageLayout(STAGE.rects()).map, sent: JSON.parse(JSON.stringify(STAGE.wall.map)) };
    head.dispatchEvent(new PointerEvent('pointerup',
      { pointerId: 9, clientX: 34, clientY: 40, bubbles: true }));
    return { before, mid: mid.map, sent: mid.sent,
      titles: [...document.querySelectorAll('.pip-title')].map(t => t.textContent) };
  });
  verdict('wall: the window that moved took its slice with it',
    dragged.mid.s3.fx < dragged.before.s3.fx - 0.1,
    dragged.before.s3.fx.toFixed(3) + ' → ' + dragged.mid.s3.fx.toFixed(3));
  verdict('wall: and the others re-cut around it — one field, not three pictures',
    Math.abs(dragged.mid.s1.fw - dragged.before.s1.fw) > 1e-3,
    dragged.before.s1.fw.toFixed(3) + ' → ' + dragged.mid.s1.fw.toFixed(3));
  verdict('wall: the booth had already broadcast the new cut before the hand lifted',
    !!dragged.sent.s3 && Math.abs(dragged.sent.s3.fx - dragged.mid.s3.fx) < 1e-6);
  verdict('wall: the window now furthest left calls itself screen one',
    dragged.mid.s3.n === 1 && /1 of 3/.test(dragged.titles[2]), dragged.titles.join(' | '));

  // and the frame inside really did take the cut it was sent
  const inner = booth.frames().find(f => /id=s1/.test(f.url()));
  let took = null;
  if (inner){
    await inner.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
    await booth.evaluate(() => STAGE.pushWall(true));
    await booth.waitForTimeout(400);
    took = await inner.evaluate(() => ({
      cut: STAGE.cut,
      view: camera.view ? { on: camera.view.enabled, full: camera.view.fullWidth,
        off: camera.view.offsetX } : null,
      w: window.innerWidth,
    }));
  }
  verdict('wall: the screen took the cut the booth sent it, not the one its address implied',
    !!took && !!took.cut && !!took.view && took.view.on
      && Math.abs(took.view.full - took.w / took.cut.fw) < 2,
    took ? JSON.stringify(took.cut) : 'no frame');

  // which one is which, held up in letters a room away can read
  const ident = await booth.evaluate(async () => {
    STAGE.identify(1200);
    await new Promise(r => setTimeout(r, 300));
    return document.querySelectorAll('.stage-pip iframe').length;
  });
  let badge = null;
  if (inner) badge = await inner.evaluate(() => {
    const b = document.getElementById('stageIdent');
    return b && !b.hidden ? b.querySelector('b').textContent : null;
  });
  verdict('wall: identify puts a number on every screen', ident === 3 && badge !== null, 'badge ' + badge);

  /* the ball: one point sweeps the WHOLE wall on the booth's clock, and each
   * screen draws only its own leg of the journey — the seam rehearsal */
  let ball = null;
  if (inner) ball = await inner.evaluate(async () => {
    const at = () => {
      const d = document.querySelector('#stageIdent .ball');
      return d ? { x: parseFloat(d.style.left), on: d.style.opacity !== '0' } : null;
    };
    const a = at();
    await new Promise(r => setTimeout(r, 260));
    const b = at();
    return a && b ? { moved: Math.abs(b.x - a.x) > 0.01, a: a.x, b: b.x } : null;
  });
  verdict('wall: and a ball rolls the wall for the seams to be judged by',
    !!ball && ball.moved, ball ? ball.a.toFixed(1) + '% → ' + ball.b.toFixed(1) + '%' : 'no ball');

  /* SEAMS: one press and the field passes behind the frames — the wall
   * re-cuts with hidden gutters between the glasses */
  const seams = await booth.evaluate(async () => {
    const share = m => Object.values(m).reduce((a, c) => a + c.fw, 0);
    const flat = share(stageLayout(stageSpread(STAGE.rects(), 0)).map);
    STAGE.seams();                                     // 0 → 1%
    await new Promise(r => setTimeout(r, 200));
    const framed = STAGE.wall ? share(STAGE.wall.map) : -1;
    // put the knob back where the next section expects it
    while (STAGE.bezel !== 0) STAGE.seams();
    return { flat, framed };
  });
  verdict('wall: seams grow the wall behind the frames — the glasses take a smaller share of it',
    seams.framed > 0 && seams.framed < seams.flat - 1e-6,
    'glass share ' + seams.flat.toFixed(3) + ' → ' + seams.framed.toFixed(3));

  // one screen unplugged is one screen unplugged, and the rest re-cut
  const shut = await booth.evaluate(async () => {
    document.querySelectorAll('.stage-pip')[2].querySelectorAll('.pip-head button')[2].click();
    await new Promise(r => setTimeout(r, 120));
    const L = stageLayout(STAGE.rects());
    return { left: document.querySelectorAll('.stage-pip').length, on: STAGE.on,
      ids: Object.keys(L.map), fw: L.map.s1.fw };
  });
  verdict('wall: ✕ on one of several closes that one and re-cuts the rest',
    shut.left === 2 && shut.on && shut.ids.length === 2 && shut.fw > 0.33,
    shut.left + ' left, s1 now ' + shut.fw.toFixed(3));
  await ctx.close();
}

/* ---------------------------------------------------------------- native
 * THE BUG, REPORTED FROM A REAL MAC WITH A REAL MONITOR: the corner windows
 * could not be got out of the app. `↗` reached for window.open, which is the
 * one call the shell's WebKit view answers with null, so the only reply was a
 * sentence about popup settings that no setting could fix — the same dead end
 * the corner stage was built to escape, left standing in the one place it
 * mattered most.
 *
 * The shell is stubbed here rather than run: what is being tested is that the
 * player ASKS it, asks it for the right monitor, and believes the answer. */
if (want('native')){
  console.log('\ninside the Mac app — a corner window can get out, onto a monitor');
  const ctx = await browser.newContext({ userAgent: NATIVE_UA });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    for (const k of ['prompt', 'confirm', 'alert'])
      window[k] = () => { window.__rogueDialog = k; throw new Error('window.' + k); };
    window.__calls = [];
    window.__opened = 0;
    const DISPLAYS = [
      { index: 0, name: 'Built-in Liquid Retina', x: 0, y: 0, width: 1512, height: 982, scale: 2, primary: true },
      { index: 1, name: 'LG UltraFine', x: 1512, y: -98, width: 1920, height: 1080, scale: 1, primary: false },
    ];
    window.__TAURI__ = {
      core: {
        invoke: async (cmd, args) => {
          window.__calls.push({ cmd, args });
          if (cmd === 'list_displays') return DISPLAYS;
          if (cmd === 'native_info') return { version: '1.0.0', os: 'macos', caps: ['stage_pip'] };
          if (cmd === 'open_stage') return true;
          return null;
        },
      },
      event: { listen: async () => {} },
    };
  });
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  // the shell's webview opens no second window at all — this is the whole bug
  await page.evaluate(() => { window.open = () => { window.__opened++; return null; }; });

  await page.evaluate(() => STAGE.open(2, { pip: true }));
  await page.waitForFunction(() => document.querySelectorAll('.stage-pip').length === 2,
    null, { timeout: 5000 });

  // ↗ on the first one, and answer "the LG"
  const out = await page.evaluate(async () => {
    document.querySelectorAll('.stage-pip')[0].querySelectorAll('.pip-head button')[0].click();
    await new Promise(r => setTimeout(r, 260));
    const card = document.getElementById('askCard');
    const body = card ? card.textContent : '';
    document.getElementById('askInput').value = '2';
    document.getElementById('askYes').click();
    await new Promise(r => setTimeout(r, 300));
    return {
      body,
      calls: window.__calls.filter(c => c.cmd === 'open_stage'),
      popups: window.__opened,
      pips: document.querySelectorAll('.stage-pip').length,
      placed: STAGE.placed,
      rogue: window.__rogueDialog || '',
      wall: STAGE.wall ? STAGE.wall.map : null,
    };
  });
  verdict('native: the operator is asked which monitor, by name',
    /LG UltraFine/.test(out.body) && /Built-in/.test(out.body));
  verdict('native: and no native dialog was reached for', !out.rogue, out.rogue || 'none');
  verdict('native: the shell is asked for a real window on the monitor named',
    out.calls.length === 1 && out.calls[0].args.display === 1 && out.calls[0].args.screen === 1,
    JSON.stringify(out.calls.map(c => c.args)));
  verdict('native: and window.open — the call the shell answers with null — is never reached',
    out.popups === 0, out.popups + ' popup attempts');
  verdict('native: the corner window is gone, the other one stays', out.pips === 1);
  verdict('native: the booth remembers which monitor it filled',
    !!out.placed.s1 && out.placed.s1.display === 1 && out.placed.s1.w === 1920,
    JSON.stringify(out.placed.s1));
  verdict('native: and the wall spans the monitor and the corner window at once',
    !!out.wall && !!out.wall.s1 && !!out.wall.s2 && out.wall.s1.fw > 0.4 && out.wall.s2.fw < 0.4,
    out.wall ? Object.keys(out.wall).map(k => k + ':' + out.wall[k].fw.toFixed(2)).join(' ') : 'no wall');

  /* AND THE OTHER HALF OF THE REPORT: two monitors, two screens. This used to
   * index displays by screen number and then clamp, which put BOTH fullscreen
   * windows on the external monitor and left the other one dark. */
  const both = await page.evaluate(async () => {
    STAGE.stop();
    window.__calls.length = 0;
    await new Promise(r => setTimeout(r, 120));
    await STAGE.open(2, { pip: false });
    await new Promise(r => setTimeout(r, 200));
    return { calls: window.__calls.filter(c => c.cmd === 'open_stage').map(c => c.args),
      placed: STAGE.placed, wall: STAGE.wall ? STAGE.wall.map : null };
  });
  verdict('native: two screens on a two-monitor rig get one monitor each',
    both.calls.length === 2 && both.calls[0].display === 0 && both.calls[1].display === 1,
    JSON.stringify(both.calls.map(c => c.display)));
  verdict('native: and the field spans both monitors as one wall',
    !!both.wall && Math.abs(both.wall.s1.fw - 1512 / 3432) < 0.02
      && Math.abs(both.wall.s2.fw - 1920 / 3432) < 0.02,
    both.wall ? 's1 ' + both.wall.s1.fw.toFixed(3) + ' s2 ' + both.wall.s2.fw.toFixed(3) : 'no wall');
  verdict('native: with the screens numbered left to right across the desk',
    !!both.wall && both.wall.s1.n === 1 && both.wall.s2.n === 2);
  await ctx.close();
}

/* ----------------------------------------------------------------- pages
 * THE SITE HAS A SECOND PAGE, AND THE WORKER USED TO EAT IT.
 *
 * The shell route matched any same-origin NAVIGATION, and mac.html — the page
 * the "Get the Mac app" button goes to — is a same-origin navigation. So
 * anyone who had ever loaded the player got a worker that answered the
 * download page with the player: reachable exactly once, before the worker
 * installed, and never again.
 *
 * This needs two navigations in one context with a real service worker
 * between them, which is why it lives in a browser probe and not a test. */
if (want('pages')){
  console.log('\ntwo pages, and a worker that only claims one of them');
  const ctx = await browser.newContext();
  const { page } = await open(ctx, '/');
  // the worker must actually be in charge before the question means anything
  const controlled = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'unsupported';
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return 'none';
    for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++)
      await new Promise(r => setTimeout(r, 100));
    return navigator.serviceWorker.controller ? 'yes' : 'uncontrolled';
  });
  verdict('pages: the worker is installed and in charge', controlled === 'yes', controlled);

  const mac = await ctx.newPage();
  await mac.goto(origin + '/mac.html', { waitUntil: 'domcontentloaded' });
  await mac.waitForTimeout(300);
  const got = await mac.evaluate(() => ({
    h2: [...document.querySelectorAll('h2')].map(n => n.textContent.trim()),
    title: document.title,
    dl: !!document.getElementById('dlBtn'),
    player: !!document.getElementById('onboard'),
  }));
  verdict('pages: asking for the download page gets the download page',
    got.dl && !got.player, got.player ? 'got the player instead' : 'ok');
  verdict('pages: with all of it, not a cached shell wearing its URL',
    got.h2.length >= 4 && got.h2.some(h => /^Install/.test(h)), got.h2.join(' | '));
  verdict('pages: and stage mode is the case it makes for the app',
    got.h2.some(h => /Stage mode/.test(h)));
  await ctx.close();
}

/* ------------------------------------------------------------------ install
 * THE BUTTON THAT MEANT THE WRONG THING. "Install" was only ever the PWA
 * affordance — hidden until beforeinstallprompt, which Safari never fires, so
 * on the platform the native app EXISTS for it was invisible. And the only
 * other route to the download page was a promo card that shows once and then
 * remembers being dismissed forever.
 *
 * Both halves are checked: a Mac gets a visible button that opens mac.html,
 * and every other platform keeps the web-app install it had. */
if (want('install')){
  console.log('\non a Mac, Install means the Mac app');
  const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const ctx = await browser.newContext({ userAgent: MAC_UA });
  const { page } = await open(ctx, '/');
  const btn = await page.evaluate(() => {
    const b = document.getElementById('btnInstall');
    return b ? { hidden: b.hidden, label: (b.querySelector('.lbl') || {}).textContent,
      aria: b.getAttribute('aria-label') } : null;
  });
  verdict('install: on a Mac the button is visible without waiting for a prompt Safari never sends',
    !!btn && btn.hidden === false, btn ? JSON.stringify(btn) : 'no button');
  verdict('install: and it says what it does', !!btn && /Mac app/i.test(btn.label || ''), btn && btn.label);

  // clicking it opens the download page rather than a web-app prompt
  const opened = await page.evaluate(() => {
    let got = '';
    window.open = u => { got = String(u); return { closed: false }; };
    document.getElementById('btnInstall').click();
    return got;
  });
  verdict('install: it opens the Mac download page', /mac\.html/.test(opened), opened || 'nothing opened');

  /* AND THE OTHER PLATFORMS KEEP WHAT THEY HAD. A Windows or Android browser
   * has no Mac app to offer, so the button must stay the web-app install and
   * stay hidden until the browser actually offers one. */
  const ctx2 = await browser.newContext({ userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36' });
  const { page: p2 } = await open(ctx2, '/');
  const other = await p2.evaluate(() => {
    const b = document.getElementById('btnInstall');
    return { hidden: b.hidden, label: (b.querySelector('.lbl') || {}).textContent };
  });
  verdict('install: off a Mac it is still the web-app install, hidden until offered',
    other.hidden === true && /Install/i.test(other.label || ''), JSON.stringify(other));
  await ctx.close(); await ctx2.close();
}

/* ------------------------------------------------------------------ wire
 * FOUR LETTERS, AND ANOTHER MACHINE IS A SCREEN. Everything below runs over
 * a REAL RTCPeerConnection between two real pages — the loopback stands in
 * for the LAN, the miniature mailbox above stands in for kmay89.com, and
 * nothing about the client knows the difference. What has to hold: the booth
 * mints a code; a page told nothing but that code becomes a screen; the
 * packet crosses the data channel and everything downstream reads it; a
 * second device makes the wall re-cut to halves; and the booth going home is
 * said out loud, not shown as a freeze. */
if (want('wire')){
  console.log('\nfour letters, and another machine is a screen');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');

  const minted = await booth.evaluate(async () => {
    const r = await WIRE.host();
    if (r) STAGE.on = true;                       // the packets flow from this frame on
    return r && { code: r.code, base: WIRE.base };
  });
  verdict('wire: the booth minted four letters from the mailbox',
    !!minted && /^[A-Z]{4}$/.test(minted.code), minted && (minted.code + ' via ' + minted.base));
  if (!minted){ await ctx.close(); }
  else {
    // the "iPad": a page told nothing but the code in its address
    const { page: pad } = await open(ctx, '/?stage=screen&join=' + minted.code);
    await booth.waitForFunction('WIRE.count() >= 1', null, { timeout: 30000 });
    verdict('wire: a device knocked and was adopted', true);
    const who = await pad.evaluate(() => ({
      role: STAGE.cfg.role, id: STAGE.cfg.id, linked: WIRE.linked,
      body: document.body.classList.contains('stage-screen'),
    }));
    verdict('wire: and it is a screen, not a second booth', who.role === 'screen' && who.body);
    verdict('wire: with an identity of its own minting, not a URL\'s',
      /^n/.test(who.id), who.id);

    // the packet crosses the channel and everything downstream reads it
    await pad.waitForFunction('STAGE.seenAt > 0 && STAGE.last && STAGE.last.f', null, { timeout: 20000 });
    const heard = await pad.evaluate(() => ({
      offset: Number.isFinite(STAGE.offset),
      waiting: !document.getElementById('stageWait').hidden,
      cutOf: STAGE.cut ? STAGE.cut.of : 1,
    }));
    verdict('wire: the booth\'s ears reach the far machine', true);
    verdict('wire: and the clocks are being reconciled', heard.offset);
    verdict('wire: the waiting card left when the booth spoke', !heard.waiting);

    // a second device walks in, and the wall re-cuts to halves — live
    const { page: pad2 } = await open(ctx, '/?stage=screen&join=' + minted.code);
    await booth.waitForFunction('WIRE.count() >= 2', null, { timeout: 30000 });
    // BOTH devices must hold the re-cut before it is sampled — the wall
    // message crosses two separate channels and lands a beat apart
    await pad.waitForFunction('STAGE.cut && STAGE.cut.of === 2', null, { timeout: 15000 });
    await pad2.waitForFunction('STAGE.cut && STAGE.cut.of === 2', null, { timeout: 15000 });
    const halves = await Promise.all([
      pad.evaluate(() => ({ fx: STAGE.cut.fx, fw: STAGE.cut.fw, n: STAGE.cut.n })),
      pad2.evaluate(() => STAGE.cut ? { fx: STAGE.cut.fx, fw: STAGE.cut.fw, n: STAGE.cut.n } : null),
    ]);
    verdict('wire: two devices are a row of two, cut at the join',
      Math.abs(halves[0].fw - 0.5) < 1e-6 && halves[0].n === 1
      && !!halves[1] && Math.abs(halves[1].fx - 0.5) < 1e-6 && halves[1].n === 2,
      JSON.stringify(halves));
    const counted = await booth.evaluate(() => {
      STAGE.setMini(true);
      STAGE.paint();
      return document.getElementById('miniScreens').textContent;
    });
    verdict('wire: the booth counts them beside its own', /2 screens/.test(counted)
      && /over the wire/.test(counted), counted);

    // the booth goes home: said on the ordered channel, shown as words
    await booth.evaluate(() => STAGE.stop());
    await pad.waitForFunction(
      '!document.getElementById("stageWait").hidden', null, { timeout: 10000 });
    const why = await pad.evaluate(() => document.getElementById('stageWaitWhy').textContent);
    verdict('wire: a booth that leaves says so — the screen never just freezes',
      /closed|stopped/.test(why), why);
    await ctx.close();
  }
}

// ----------------------------------------------------------------- warm
if (want('warm')){
  console.log('\nthe warm-up, and the room\'s hands');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');
  const { page: screen } = await open(ctx, '/?stage=screen&screen=1&of=1');

  // nothing at all until the booth has actually shown a picture: a warm-up
  // over a black rectangle is somebody decorating a crash
  const early = await screen.evaluate(() => !document.getElementById('warmup').hidden);
  verdict('warm: silent until the field is really there', early === false);

  const frame = () => screen.evaluate(() => STAGE.recv({
    t: 'f', at: performance.now(),
    f: { bass: 0.4, mid: 0.4, treble: 0.2, energy: 0.5, beat: 0.4, centroid: 0.3 },
    clock: { g: true, i: 3, b: 0.02, t: 120 },
    dance: { p: 0.4, w: 0.01, e: 0.9, b: 0.2, f: 0.5, g: true },
    dir: { s: 1, a: 2, t: 0.5, p: 'peak', c: 0.1, w: 0.2 },
    cam: [3, 4, 12, 0, 0, 0, 1, 55],
    col: [[0.7, 0.11, 200], [0.6, 0.12, 220], [0.5, 0.13, 240]],
    hand: { x: 0, y: 0, d: false },
  }));
  /* A STREAM, NOT A PACKET. The booth sends 't':'f' sixty times a second, and
   * the first version of this probe sent exactly one — which is precisely the
   * sequence in which a warm-up that re-renders itself on every frame still
   * works. It shipped untouchable: the swatches were drawn and lit, and the
   * button under your finger was destroyed and rebuilt between pointerdown and
   * pointerup, so `click` was never delivered. Anything that reacts to the
   * heartbeat has to be probed WITH the heartbeat running. */
  await frame();
  const beat = setInterval(() => { frame().catch(() => {}); }, 16);
  await screen.waitForTimeout(400);

  const step1 = await screen.evaluate(() => ({
    up: !document.getElementById('warmup').hidden,
    cells: document.querySelectorAll('#wuGrid .wu-cell').length,
    title: document.getElementById('wuTitle').textContent,
    cursor: getComputedStyle(document.body).cursor,
  }));
  verdict('warm: the first frame brings the questions with it', step1.up === true);
  verdict('warm: one swatch per colour, all of them tappable',
    step1.cells === 8 && /colour/i.test(step1.title), step1.cells + ' cells, "' + step1.title + '"');
  verdict('warm: a screen being PICKED on shows its cursor again — a hidden pointer\n'
    + '        cannot find a swatch', step1.cursor !== 'none', step1.cursor);

  /* the identity of a swatch, held across the heartbeat. If the grid is being
   * rebuilt underneath, this node is detached moments later — a far sharper
   * test than "did something get clicked", and the one that would have caught
   * it before a listener did. */
  const held = await screen.evaluateHandle(
    () => document.querySelector('#wuGrid .wu-cell:nth-child(5)'));
  await screen.waitForTimeout(500);
  const stable = await screen.evaluate(n => !!n && n.isConnected, held);
  verdict('warm: the card survives the booth\'s heartbeat — a grid rebuilt on\n'
    + '        every frame destroys the button between press and release, and no\n'
    + '        click is ever delivered', stable === true);

  await screen.click('#wuGrid .wu-cell:nth-child(5)');       // sky
  await screen.waitForTimeout(400);
  const step2 = await screen.evaluate(() => {
    const tiles = [...document.querySelectorAll('#wuGrid .wu-cell')];
    // a tile that painted nothing is a tile nobody will ever choose, so the
    // pixels are read rather than the presence of a canvas trusted
    let painted = 0;
    for (const t of tiles){
      const cv = t.querySelector('canvas');
      if (!cv || !cv.width) continue;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let lo = 255, hi = 0;
      for (let i = 0; i < d.length; i += 4 * 37){
        const v = d[i] + d[i + 1] + d[i + 2];
        if (v < lo) lo = v; if (v > hi) hi = v;
      }
      if (hi - lo > 40) painted++;                            // it has CONTRAST, not just a fill
    }
    return { n: tiles.length, painted, title: document.getElementById('wuTitle').textContent };
  });
  verdict('warm: picking a colour asks the second question', /look/i.test(step2.title), step2.title);
  verdict('warm: every room drew itself a thumbnail with something in it',
    step2.n > 0 && step2.painted === step2.n, step2.painted + '/' + step2.n + ' painted');

  await screen.click('#wuGrid .wu-cell:nth-child(2)');
  await screen.waitForTimeout(600);
  clearInterval(beat);
  const after = await screen.evaluate(() => ({
    up: !document.getElementById('warmup').hidden,
    done: WARM.done, hue: WARM.hue, scene: WARM.scene,
    sparks: WARM.sparks.length,
    cursor: getComputedStyle(document.body).cursor,
  }));
  verdict('warm: picking a look ends the warm-up', after.up === false && after.done === true);
  verdict('warm: and the pick is confirmed in light, not in words', after.sparks >= 1,
    after.sparks + ' spark(s)');
  verdict('warm: the audience surface hides its cursor again', after.cursor === 'none', after.cursor);

  const heard = await booth.evaluate(() => {
    const p = [...WARM.picks.values()];
    return { n: WARM.picks.size, hue: p[0] && p[0].hue, scene: p[0] && p[0].scene,
             crowd: WARM.crowd() };
  });
  verdict('warm: the booth learns who joined and what they like',
    heard.n === 1 && heard.hue === after.hue && heard.scene === after.scene,
    JSON.stringify(heard));
  verdict('warm: and that vote reaches the director as a lean',
    heard.crowd[after.scene] > 1, JSON.stringify(heard.crowd));

  // A HAND ON THE PICTURE. The field is the only control a stage screen has.
  await screen.mouse.move(240, 200);
  await screen.mouse.down();
  await screen.mouse.up();
  await screen.waitForTimeout(500);
  const rippled = await Promise.all([
    screen.evaluate(() => WARM.sparks.length),
    booth.evaluate(() => WARM.taps.length),
    booth.evaluate(() => WARM.sparks.length),
  ]);
  verdict('warm: touching the picture ripples on the screen that felt it', rippled[0] >= 1);
  verdict('warm: the booth hears the hand', rippled[1] >= 1, rippled[1] + ' tap(s)');
  verdict('warm: and shows it on its own field — the operator sees the room',
    rippled[2] >= 1, rippled[2] + ' spark(s)');

  /* THE ONE THING THE METER MUST NOT DO. Filled by one person it is a toy that
   * is over in four seconds; the whole design rests on it counting SCREENS.
   *
   * The meter is a RAMP driven by the frame loop, and a background tab's
   * requestAnimationFrame is throttled to about a frame a second — so the
   * booth is brought to the front first and then given real seconds. Read too
   * early, a working meter shows 0.2 and this reads as a bug in the meter
   * rather than in the probe; that is exactly what it did first time. */
  await booth.bringToFront();
  await booth.evaluate(() => {
    const now = Date.now();
    for (let i = 0; i < 60; i++) WARM.taps.push({ id: 'n-one-thumb', at: now - i * 15 });
  });
  await booth.waitForTimeout(1600);
  const solo = await booth.evaluate(() => WARM.v);
  verdict('warm: sixty touches from one screen do not move the meter', solo < 0.02,
    'v = ' + solo.toFixed(3));

  await booth.evaluate(() => {
    const now = Date.now();
    for (const id of ['n-a', 'n-b', 'n-c', 'n-d']) WARM.taps.push({ id, at: now });
  });
  await booth.waitForFunction('WARM.v > 0.5', null, { timeout: 8000 }).catch(() => {});
  const room = await booth.evaluate(() => WARM.v);
  verdict('warm: four screens do', room > 0.5, 'v = ' + room.toFixed(3));

  // and a screen that leaves takes its vote with it
  await screen.close();
  await booth.evaluate(() => STAGE.recv({ t: 'screen-gone', id: 'nope' }));
  await booth.waitForTimeout(200);
  await ctx.close();
}

/* ----------------------------------------------------------------- crowd
 * THE WHOLE FLOOR, IN THEIR HANDS. Not the wire: a phone that scans a crowd
 * code takes no seat and holds no slice — it listens with its own microphone
 * (a fake one here, granted by flag) and reads the booth's pulse from the
 * mailbox. What has to hold: the booth mints a beacon with no handshake; a
 * page told nothing but the code becomes all-field with a one-tap veil; the
 * tap grants the mic and starts the poll; the booth's palette and scene
 * arrive and are applied as a glide; and — the contract that makes a crowd
 * affordable — the pulse reads carry NO cache-buster, so a CDN can answer
 * them. */
if (want('crowd')){
  console.log('\nthe whole floor, in their hands');
  const ctx = await browser.newContext();
  const { page: booth } = await open(ctx, '/');
  const minted = await booth.evaluate(async () => {
    const r = await WIRE.api('beacon', { name: 'The show' });
    if (!r || r.error || !r.code) return null;
    CROWD.code = r.code; CROWD.key = r.key;
    // a known palette and scene, held still so the far phone's colours are
    // checkable to the digit — the live engine would breathe them
    COLOR.on = false;
    COLOR.now = [{ l: 0.7, c: 0.11, h: 200 }, { l: 0.6, c: 0.12, h: 220 }, { l: 0.5, c: 0.13, h: 240 }];
    director.active = 2;
    CROWD.start();
    return r.code;
  });
  verdict('crowd: the booth minted a beacon — a code with no handshake at all',
    !!minted && /^[A-Z]{4}$/.test(minted), minted);
  if (!minted){ await ctx.close(); }
  else {
    const { page: phone } = await open(ctx, '/?crowd=' + minted);
    const veiled = await phone.evaluate(() => ({
      crowd: document.body.classList.contains('crowd'),
      veil: !!document.getElementById('crowdGo'),
      topbar: getComputedStyle(document.querySelector('.topbar')).display,
      canvas: getComputedStyle(document.getElementById('glcanvas')).display,
      auto: director.auto,
    }));
    verdict('crowd: the phone is all field behind a one-tap veil',
      veiled.crowd && veiled.veil && veiled.topbar === 'none' && veiled.canvas !== 'none',
      'topbar ' + veiled.topbar + ', veil ' + veiled.veil);
    verdict('crowd: and its director does not choose scenes — the booth does', veiled.auto === false);

    // the tap: mic granted (fake device), poll starts
    await phone.evaluate(() => document.getElementById('crowdGo').click());
    await phone.waitForFunction('AE.mic.on === true', null, { timeout: 15000 });
    verdict('crowd: one tap and the phone is listening to the room', true);
    await phone.waitForFunction(
      'COLOR.target && Math.round(COLOR.target[0].h) === 200 && Math.round(COLOR.target[1].h) === 220',
      null, { timeout: 15000 });
    const got = await phone.evaluate(() => ({
      glide: COLOR.glideT < 1 || COLOR.glideDur === 4,
      scene: director.active,
      veilGone: !document.getElementById('crowdGo'),
    }));
    verdict('crowd: the booth\'s palette arrives, and as a glide rather than a snap', got.glide);
    verdict('crowd: and the booth\'s scene', got.scene === 2, 'scene ' + got.scene);
    verdict('crowd: the veil left with the tap', got.veilGone);

    /* THE AFFORDABILITY CONTRACT: every pulse read is the identical URL —
     * no cache-buster — or a CDN could never answer the crowd and every
     * phone would be an origin hit. The booth's own POSTs may bust away;
     * only the reads multiply by the crowd. */
    const reads = hits.filter(u => /^GET /.test(u) && /a=pulse/.test(u) && !/[?&]_=/.test(u));
    const busted = hits.filter(u => /^GET /.test(u) && /a=pulse/.test(u) && /[?&]_=/.test(u));
    verdict('crowd: pulse reads carry no cache-buster — the CDN can answer the floor',
      reads.length > 0 && busted.length === 0,
      reads.length + ' clean read(s), ' + busted.length + ' busted');
    await ctx.close();
  }
}

await browser.close();
server.close();
if (!KEEP) rmSync(DIR, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
