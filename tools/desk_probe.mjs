// DESK PROBE — the visuals on the big screen, the booth on this one.
//
// The Mac shell is stood in for (two displays, a stage window that opens): the
// booth head's "Visuals → screen" button must open the stage on the OTHER
// display, keep this window its own size (no mini strip — that fights macOS
// fullscreen), turn it into the booth desk with the field not drawn here, and
// hand everything back when the stage stops. Screenshots land in $OUT.
//
//   cp docs/index.html /tmp/mb8-mix/ && OUT=/tmp node tools/desk_probe.mjs /tmp/mb8-mix
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIR = process.argv[2] || '/tmp/mb8-mix';
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  if (range){
    const s0 = +range[1], e = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s0}-${e}/${data.length}`, 'Content-Length': e - s0 + 1 });
    res.end(data.subarray(s0, e + 1));
  } else { res.writeHead(200, { ...headers, 'Content-Length': data.length }); res.end(data); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required',
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP cdnjs.cloudflare.com 127.0.0.1'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', e => console.log('  [pageerror]', e.message.split('\n')[0]));
page.on('popup', p => console.log('  popup opened:', p.url().slice(-60)));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
await page.evaluate(() => { const byTitle = new Map(allTracks().map(t => [t.title, t]));
  player.tracks = ['alpha', 'beta', 'gamma'].map(n => byTitle.get(n)); player.cur = -1; MIXER.setOn(true); player.playIndex(0); BOOTH.toggle(true); });
await page.waitForTimeout(2500);
await page.screenshot({ path: (process.env.OUT || '/tmp') + '/desk0-before.png' });
const r = await page.evaluate(async () => {
  // the Mac shell, stood in for: two displays, a stage window that opens
  window.__calls = [];
  NATIVE.ready = () => true;
  NATIVE.call = async (cmd, a) => { window.__calls.push(cmd);
    if (cmd === 'list_displays') return [{ x: 0, y: 0, width: 1440, height: 900, primary: true }, { x: 1440, y: 0, width: 3840, height: 2160, primary: false, name: 'SAMSUNG' }];
    if (cmd === 'open_stage') return true; return null; };
  await STAGE.boothPop();
  await new Promise(r => setTimeout(r, 1500));
  const cs = id => getComputedStyle(document.getElementById(id));
  return { on: STAGE.on, desk: STAGE.desk, cls: document.body.classList.contains('boothdesk'), mini: STAGE.mini,
    booth: cs('booth').display, canvas: document.getElementById('glcanvas') ? cs('glcanvas').display : 'none?', transport: cs('transport').display,
    btn: document.getElementById('boothPop').textContent, wins: STAGE.wins.length, pip: STAGE.pip };
});
console.log(JSON.stringify(r));
await page.waitForTimeout(1000);
await page.screenshot({ path: (process.env.OUT || '/tmp') + '/desk1.png' }); await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(800); await page.screenshot({ path: (process.env.OUT || '/tmp') + '/desk2.png' });
const r2 = await page.evaluate(() => { STAGE.setDesk(false); return { desk: STAGE.desk, cls: document.body.classList.contains('boothdesk'), btn: document.getElementById('boothPop').textContent }; });
console.log(JSON.stringify(r2));
await page.evaluate(() => STAGE.setDesk(true));
await page.evaluate(() => STAGE.stop());
const r3 = await page.evaluate(() => ({ calls: window.__calls.join(','), on: STAGE.on, desk: STAGE.desk, cls: document.body.classList.contains('boothdesk') }));
console.log(JSON.stringify(r3));
const checks = [
  ['one click: the stage opens on the other display, this window becomes the desk', r.on && r.desk && r.cls && !r.mini],
  ['the field is not drawn here — the booth and transport are', r.canvas === 'none' && r.booth === 'flex' && r.transport === 'flex'],
  ['the button can bring the visuals back behind the booth', !r2.desk && !r2.cls],
  ['the window was never folded to a strip on the way in', !/set_mini/.test(r3.calls.split('close_stage')[0])],
  ['stopping the stage leaves the desk', !r3.on && !r3.desk && !r3.cls],
];
for (const [n, ok] of checks) console.log((ok ? '  ok   ' : '  FAIL ') + n);
await browser.close(); server.close();
process.exit(checks.every(c => c[1]) ? 0 : 1);

