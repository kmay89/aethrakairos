// §10 acceptance runner — the parts a headless browser can honestly verify.
// Physical-device items (iOS lock screen, CarPlay, AirPlay) are NOT here;
// they need hardware and are reported as such in the handoff.
//
//   python3 tools/make_synthetic_deploy.py /tmp/mb8-accept 1000
//   node tools/acceptance.mjs /tmp/mb8-accept
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIR = process.argv[2] || '/tmp/mb8-accept';
const SHOTS = process.argv[3] || DIR;
// the synthetic "MP3s" are WAV payloads; the server says so honestly
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav',
  '.sig': 'text/plain' };

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(DIR, path === '/' ? 'index.html' : path.slice(1));
  if (!existsSync(file) || statSync(file).isDirectory()){
    res.writeHead(404); res.end(); return;
  }
  const data = readFileSync(file);
  // the shipped demo is a REAL mp3 among WAV-payload fixtures
  const ctype = /mobius-walking|breathing|finished-master/.test(file) ? 'audio/mpeg'
    : (MIME[extname(file)] || 'application/octet-stream');
  const headers = { 'Content-Type': ctype,
    'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  if (range){
    const s = +range[1], e = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s}-${e}/${data.length}`,
      'Content-Length': e - s + 1 });
    res.end(data.subarray(s, e + 1));
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': data.length });
    res.end(data);
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required',
    // the sandbox black-holes public CDNs; fail those connections instantly
    // instead of hanging (SW-mediated fetches bypass page routing)
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP cdnjs.cloudflare.com 127.0.0.1'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const results = [];
const R = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
};
page.on('pageerror', e => console.log('  [pageerror]', e.message.split('\n')[0]));
// the sandbox has no route to Google Fonts; a hanging render-blocking
// stylesheet would swamp every timing. Abort it (offline-font reality).
for (const p of [page]) await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

async function boot(){
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
  return Date.now() - t0;
}

// ---- 1 · boot: cold, then warm (SW + HTTP cache primed)
const cold = await boot();
await page.waitForTimeout(1200);                 // let the SW finish installing
const warm = await boot();
R('boot cold', true, cold + ' ms');
R('boot warm < 2000 ms (§10.10)', warm < 2000, warm + ' ms');

// ---- 2 · library renders 1000 tracks
await page.keyboard.press('b');
await page.waitForTimeout(600);
const libInfo = await page.evaluate(() => ({
  albums: document.querySelectorAll('#libList .alb').length,
  rows: document.querySelectorAll('#libList .lib-trk').length,
  count: document.getElementById('libCount').textContent,
  footer: document.getElementById('libFoot').textContent.includes('all rights reserved'),
}));
R('library renders all albums', libInfo.albums > 50, libInfo.albums + ' albums, ' + libInfo.count);
R('license footer present', libInfo.footer);
await page.screenshot({ path: join(SHOTS, 'shot-library.png') });
await page.keyboard.press('Escape');

// ---- 3 · console: map interactive, 1-hour deal < 100 ms
await page.keyboard.press('j');
await page.waitForTimeout(500);
const conVisible = await page.evaluate(() =>
  document.getElementById('console').classList.contains('open'));
R('console opens on J', conVisible);
const mapBox = await page.locator('#conMap').boundingBox();
await page.mouse.click(mapBox.x + mapBox.width * 0.3, mapBox.y + mapBox.height * 0.7);
await page.waitForTimeout(150);
const hint1 = await page.evaluate(() => document.getElementById('mapHint').textContent);
R('map tap sets FROM', /FROM/.test(hint1), hint1);
await page.screenshot({ path: join(SHOTS, 'shot-console.png') });
await page.click('#conEngage');
await page.waitForTimeout(800);
const deal = await page.evaluate(() => ({
  ms: window.__lastDealMs,
  status: document.getElementById('conStatus').textContent,
  queue: window.player ? undefined : undefined,
}));
const dealState = await page.evaluate(() => ({
  n: player.tracks.length, cur: player.cur, playing: player.playing,
  totalSec: player.tracks.reduce((a, t) => a + (t.duration || 0), 0),
}));
R('1-hour journey deals < 100 ms (§10.10)', deal.ms != null && deal.ms < 100,
  (deal.ms && deal.ms.toFixed(1)) + ' ms · ' + deal.status);
R('deal lands within ±10% of 1 hr', Math.abs(dealState.totalSec - 3600) / 3600 <= 0.1,
  Math.round(dealState.totalSec) + ' s across ' + dealState.n + ' tracks');
await page.keyboard.press('Escape');

// ---- 4 · playback starts (dealt queue, synthetic audio)
await page.waitForTimeout(1500);
const playState = await page.evaluate(() => ({
  playing: player.playing, cur: player.cur,
  src: !!(AE.decks && AE.decks[AE.active].a.src),
  t: AE.decks ? AE.decks[AE.active].a.currentTime : 0,
}));
R('dealt queue is playing', playState.playing && playState.src, 'currentTime ' + playState.t.toFixed(2) + ' s');
await page.screenshot({ path: join(SHOTS, 'shot-playing.png') });

// (the dance engine is exercised in 6b, on the demo track's real measured
//  grid — the synthetic queue auto-advances and its ambient tracks have no
//  grid, so it is the wrong bench for a grid-locked motion test)

// ---- 5 · kill mid-track, relaunch: restored paused at position (§10.8)
await page.waitForTimeout(1000);
const before = await page.evaluate(() => {
  PERSIST.save();
  const t = player.tracks[player.cur];
  return { key: t.sha256 || t.url, pos: AE.decks[AE.active].a.currentTime, n: player.tracks.length };
});
await page.waitForTimeout(300);
await page.goto('about:blank');                  // the kill
await boot();                                     // the relaunch
await page.waitForTimeout(1200);
const after = await page.evaluate(() => {
  const t = player.tracks[player.cur];
  return {
    key: t ? (t.sha256 || t.url) : null,
    playing: player.playing, n: player.tracks.length,
    pos: AE.decks && AE.decks[AE.active] ? AE.decks[AE.active].a.currentTime : -1,
  };
});
R('restore: same track, paused (§10.8)', after.key === before.key && after.playing === false,
  'queue ' + after.n + '/' + before.n + ', track match ' + (after.key === before.key));
R('restore: position survives', Math.abs(after.pos - before.pos) < 2.5,
  before.pos.toFixed(1) + ' s → ' + after.pos.toFixed(1) + ' s');

// ---- 5b · rituals: ?ritual= deep link deals for the moment
const page3 = await ctx.newPage();
await page3.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page3.goto(base + '?ritual=bedtime', { waitUntil: 'domcontentloaded' });
await page3.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
await page3.waitForTimeout(800);
const ritual = await page3.evaluate(() => {
  const es = player.tracks.map(t => t.features.energy);
  return { n: player.tracks.length,
    total: player.tracks.reduce((a, t) => a + (t.duration || 0), 0),
    firstE: es[0], lastE: es[es.length - 1],
    chips: (() => { openConsole(true); return document.querySelectorAll('#conRituals .ritual').length; })(),
    saveEnabled: !document.getElementById('conSave').disabled };
});
R('?ritual=bedtime deals a 30-min descent', ritual.n > 0
  && Math.abs(ritual.total - 1800) / 1800 <= 0.15 && ritual.lastE < ritual.firstE,
  ritual.n + ' tracks · ' + Math.round(ritual.total) + ' s · energy '
  + ritual.firstE.toFixed(2) + ' → ' + ritual.lastE.toFixed(2));
R('ritual chips render in the console', ritual.chips >= 6, ritual.chips + ' chips');
R('deep-link ritual can be saved once the console opens', ritual.saveEnabled);
await page3.close();

// ---- 5c · the crate holds 1,000 rows without flinching
const tCrate = Date.now();
await page.keyboard.press('c');
await page.waitForTimeout(900);
const crateBig = await page.evaluate(() => ({
  open: document.getElementById('crate').classList.contains('open'),
  rows: document.querySelectorAll('#crateBody .crate-row').length,
}));
R('crate renders 1000 mix-scored rows', crateBig.open && crateBig.rows === 1000,
  crateBig.rows + ' rows in ' + (Date.now() - tCrate) + ' ms');
await page.keyboard.press('Escape');

// ---- 5d · the storyteller: 13 scenes, live act readout, touch steering
const shaderErrs = [];
page.on('console', m => {
  if (m.type() === 'error' && /THREE|shader|GLSL/i.test(m.text())) shaderErrs.push(m.text().slice(0, 160));
});
const story = await page.evaluate(() => ({
  dots: document.querySelectorAll('#sceneDots .sdot').length,
  act: document.getElementById('actName').textContent,
}));
R('15 scene dots render', story.dots === 15, story.dots + ' dots');
// sweep every scene: each must compile its shaders and survive two frames
for (let i = 0; i < story.dots; i++){
  await page.evaluate(n => director.setScene(n, true), i);
  await page.waitForTimeout(160);
}
const sweep = await page.evaluate(() =>
  ({ name: document.getElementById('sceneName').textContent, n: scenes.length }));
R('all scenes render without shader errors', shaderErrs.length === 0 && sweep.n === 15,
  sweep.n + ' scenes swept, last ' + sweep.name
  + (shaderErrs.length ? ' — ' + shaderErrs[0] : ''));
R('story act readout is live', /OVERTURE|RISING|APEX|TURN|RESOLVE/.test(story.act), story.act);
await page.keyboard.press('7');
await page.waitForTimeout(400);
const scn7 = await page.evaluate(() => document.getElementById('sceneName').textContent);
R('key 7 summons RIBBONS', scn7 === 'RIBBONS', scn7);
const steer0 = await page.evaluate(() => director.camGoalTheta);
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.move(840, 430, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(150);
const steer1 = await page.evaluate(() => ({
  th: director.camGoalTheta, hold: INTERACT.holdOff, ptr: U.uPtr.value.z,
}));
R('drag steers the camera rig and holds the auto rig off',
  steer1.hold > 0 && Math.abs(steer1.th - steer0) > 0.2,
  steer0.toFixed(2) + ' → ' + steer1.th.toFixed(2) + ' rad · holdOff ' + steer1.hold.toFixed(1) + ' s');
R('pointer presence reaches the shaders', steer1.ptr > 0.1, 'uPtr.z ' + steer1.ptr.toFixed(2));
await page.mouse.dblclick(640, 400);
await page.waitForTimeout(80);
const imp = await page.evaluate(() => INTERACT.impulse);
R('double-tap fires a shockwave impulse', imp > 0.5, imp.toFixed(2));
await page.screenshot({ path: join(SHOTS, 'shot-ribbons.png') });

// ---- 5e · the colour engine reads the music
// the dealt queue may land on a keyless/ambient track (bpm 0 wildcards are
// legitimate); the colour-engine check wants a KEYED track, so summon one —
// this tests the engine, not the dice
await page.evaluate(() => {
  const t = player.tracks[player.cur];
  if (!(t && mixOf(t) && mixOf(t).key)){
    const i = player.tracks.findIndex(x => x && mixOf(x) && mixOf(x).key);
    if (i >= 0) player.playIndex(i);
  }
});
await page.waitForTimeout(700);
const colr = await page.evaluate(() => {
  const t = player.tracks[player.cur];
  const k = t && mixOf(t) && mixOf(t).key;
  return {
    keyed: !!(COLOR.plan && COLOR.plan.keyed),
    scheme: COLOR.plan && COLOR.plan.scheme,
    label: document.getElementById('colorScheme').textContent.trim(),
    swatch: document.getElementById('csw0').style.background,
    rootH: COLOR.plan && COLOR.plan.root.h,
    keyHue: k ? camelotHue(k) : null,
  };
});
R('colour engine live: keyed plan, named scheme, lit swatches',
  colr.keyed && /analogous|complement|triad/.test(colr.scheme || '') && colr.swatch !== '',
  colr.label + ' · ' + colr.swatch);
const hueDist = colr.keyHue == null ? 999
  : Math.min(Math.abs(colr.rootH - colr.keyHue), 360 - Math.abs(colr.rootH - colr.keyHue));
R('root hue derives from the camelot wheel (± designer tilt)', hueDist <= 45,
  'key ' + colr.keyHue + '° → root ' + (colr.rootH && colr.rootH.toFixed(0)) + '°');

// ---- 6 · v1 catalog is rejected with a named toast
writeFileSync(join(DIR, 'catalog-v1.json'), JSON.stringify({
  version: 1, title: 'ERRERlabs', tracks: [{ src: 'x.mp3', title: 'Old' }],
}));
const page2 = await ctx.newPage();
await page2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page2.goto(base + '?catalog=catalog-v1.json', { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(2500);
const toast = await page2.evaluate(() =>
  [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
R('v1 catalog rejected by name', /v1 flat catalog/.test(toast), toast.slice(0, 120));
await page2.close();

// ---- 6b · the demo is Möbius Walking, real analysis engaged
// fresh context: clean IndexedDB, missing catalog → empty state → demo button
const ctxD = await browser.newContext();
const pageD = await ctxD.newPage();
await pageD.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await pageD.goto(base + '?catalog=missing.json', { waitUntil: 'domcontentloaded' });
await pageD.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
await pageD.waitForTimeout(800);
await pageD.click('#btnDemo');
// wait for the grid clock to engage rather than betting on a fixed delay —
// under machine load playback can start seconds late and a snapshot at a
// fixed time reads bpm 0 while the deck is still buffering
await pageD.waitForFunction(
  'player.playing && AE.f.bpm > 0', null, { timeout: 15000 }).catch(() => {});
const demo = await pageD.evaluate(() => {
  const t = player.tracks[player.cur];
  return {
    playing: player.playing, title: t && t.title,
    key: t ? ((mixOf(t) || {}).key || null) : null,
    bpm: AE.f.bpm, keyed: !!(COLOR.plan && COLOR.plan.keyed),
    pos: AE.decks && AE.decks[AE.active] ? AE.decks[AE.active].a.currentTime : 0,
  };
});
R('demo plays Möbius Walking with its measured grid and key',
  demo.playing && demo.title === 'Möbius Walking' && demo.key === '7B'
  && demo.keyed && Math.abs(demo.bpm - 126.05) < 2,
  demo.title + ' · ' + demo.key + ' · ' + (demo.bpm && demo.bpm.toFixed(1)) + ' bpm · t=' + demo.pos.toFixed(1) + 's');

// ---- 6c · the dance engine performs on the demo's real, stable grid
const dance = await pageD.evaluate(async () => {
  const pulse = [], sway = [], times = [], emitted = [];
  let gridFrames = 0;
  await new Promise(res => {
    let n = 0;
    const tick = () => {
      if (DANCE.haveGrid) gridFrames++;
      pulse.push(DANCE.pulse); sway.push(DANCE.sway); times.push(U.uTime.value);
      emitted.push(U.uBeat.value);
      if (++n < 130) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
  return {
    gridFrames, frames: pulse.length,
    pMin: Math.min(...pulse), pMax: Math.max(...pulse),
    eMax: Math.max(...emitted),
    sSpan: Math.max(...sway) - Math.min(...sway),
    monotone: times.every((v, i) => i === 0 || v > times[i - 1]),
    roll: Math.abs(pageDcamZ()),
  };
  function pageDcamZ(){ return camera.rotation.z + scene.rotation.z; }
});
R('dance engine rides the grid: impact, release, anticipation',
  dance.gridFrames > dance.frames * 0.8 && dance.pMax > 0.45 && dance.pMin < 0.05,
  'pulse ' + dance.pMin.toFixed(2) + '..' + dance.pMax.toFixed(2)
  + ' · grid ' + dance.gridFrames + '/' + dance.frames);
// the check that would have caught the neutering: what the SHADERS receive
// (post-governor uBeat) must keep the choreographed punch at musical tempi
R('the governed beat keeps the danced punch (emitted uBeat)',
  dance.eMax >= dance.pMax * 0.85,
  'emitted peak ' + dance.eMax.toFixed(2) + ' vs danced ' + dance.pMax.toFixed(2));
R('the room sways through the bar and musical time stays monotone',
  dance.sSpan > 0.05 && dance.monotone && Math.abs(dance.roll) > 0.0005,
  'sway span ' + dance.sSpan.toFixed(2) + ' · lean ' + dance.roll.toFixed(3) + ' rad');

// ---- 6d · the console glows in the key + a scrubbable waveform overview
await pageD.waitForFunction(() => {
  const t = player.tracks[player.cur];
  return t && t._peaks && t._peaks.length > 0;
}, null, { timeout: 8000 }).catch(() => {});
const surf = await pageD.evaluate(() => {
  const t = player.tracks[player.cur];
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const cv = document.getElementById('waveCv');
  const cx = cv.getContext('2d');
  // is anything actually drawn? sample the canvas alpha coverage
  const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  let lit = 0; for (let i = 3; i < px.length; i += 40) if (px[i] > 12) lit++;
  return { peaks: t && t._peaks ? t._peaks.length : 0, accent: acc, lit };
});
R('the console accent is driven by the live key colour',
  /^rgb\(/.test(surf.accent) && surf.accent !== 'rgb(110, 231, 255)',
  surf.accent);
R('the seek is a decoded, rendered whole-track waveform',
  surf.peaks >= 400 && surf.lit > 50,
  surf.peaks + ' peak columns · ' + surf.lit + ' lit samples');

// ---- 6e · the booth (key D) + the front porch
await pageD.keyboard.press('d');
await pageD.waitForTimeout(400);
const booth = await pageD.evaluate(() => {
  const cv = document.getElementById('boothCv');
  const cx = cv.getContext('2d');
  const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  let lit = 0; for (let i = 3; i < px.length; i += 40) if (px[i] > 12) lit++;
  const g = id => document.getElementById(id).textContent;
  return { open: document.getElementById('booth').classList.contains('open'),
    nmA: g('boothNmA'), keyA: g('boothKeyA'), plan: g('boothPlan'), lit };
});
R('the booth opens on D — lane A carries the playing track, painted',
  booth.open && booth.nmA === 'Möbius Walking' && booth.keyA === '7B' && booth.lit > 40,
  booth.nmA + ' · ' + booth.keyA + ' · ' + booth.lit + ' lit · ' + booth.plan);
await ctxD.close();

// ---- 6f · the front porch (needs the real catalog — the main page)
const fresh = await page.evaluate(() => {
  renderFresh();
  const box = document.getElementById('libFresh');
  const cards = [...box.querySelectorAll('.fresh-card')].map(b => b.querySelector('.tag').textContent);
  return { hidden: box.hidden, cards };
});
R("the porch greets with the label's drops — fresh cards render",
  !fresh.hidden && fresh.cards.length >= 1, fresh.cards.join(' · ') || 'none');

// ---- 6g · the deck's pad row: eight best-next candidates from the shelf
const pads = await page.evaluate(() => {
  BOOTH.toggle(true);
  BOOTH.refreshPads();
  const rows = [...document.querySelectorAll('#boothPads .bpad')].map(b => ({
    title: b.querySelector('.bt').textContent,
    tag: b.querySelector('.bk').textContent,
  }));
  BOOTH.toggle(false);
  return rows;
});
R('the pad row deals eight next-up candidates, planner-tagged',
  pads.length === 8 && pads.every(r => r.title && /·/.test(r.tag)),
  pads.length + ' pads · first: ' + (pads[0] ? pads[0].title + ' [' + pads[0].tag + ']' : '—'));

// ---- 7 · service worker registered + audio requests bypass it
const swState = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return { registered: regs.length > 0, controlled: !!navigator.serviceWorker.controller };
});
R('service worker active', swState.registered && swState.controlled);
const swSrc = readFileSync(join(DIR, 'sw.js'), 'utf8');
R('sw: audio passthrough by construction', /isAudio\(req, url\)\) return;/.test(swSrc));

await browser.close();
server.close();
const fails = results.filter(r => !r.ok);
console.log('\n' + (results.length - fails.length) + '/' + results.length + ' acceptance checks passed');
process.exit(fails.length ? 1 : 0);
