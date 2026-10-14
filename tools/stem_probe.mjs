/* STEM PROBE — the room hears the band. Plays a real catalog track across a
 * return of the kit (the drums come back after a long absence) and reads the
 * shipped engine as it goes: the STEM LIGHT stepper (@stem), the beat channel
 * it gates, the dancer's brace it feeds, the colour wash and bloom, and the
 * scene cut on the landing. Frames are photographed in the breakdown, in the
 * coil and just after the landing, so the inhale and the arrival can be seen.
 *
 *   node tools/stem_probe.mjs [file.mp3] [returnSeconds]
 *   SHOTS=/some/dir node tools/stem_probe.mjs      (default: build/stem-shots, git-ignored)
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const FILE = process.argv[2] || '01-audio-4927.mp3';
const RETURN = Number(process.argv[3] || 88.7);
const SHOTS = process.env.SHOTS || 'build/stem-shots';
mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join('docs', p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const body = readFileSync(f), range = req.headers.range;
  const type = MIME[extname(f)] || 'application/octet-stream';
  if (range){
    const [a, b] = range.replace('bytes=', '').split('-');
    const s = Number(a), e = b ? Number(b) : body.length - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${s}-${e}/${body.length}`, 'Content-Length': e - s + 1 });
    res.end(body.subarray(s, e + 1)); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
// the catalog's audio lives on the media host; serve it from the checkout
await page.route(/^https:\/\/media\.aethrakairos\.com\/audio\//, async (route) => {
  const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/audio\//, ''));
  const f = join('docs/audio', rel);
  if (!existsSync(f)) return route.fulfill({ status: 404 });
  // ranged, so the media element can seek
  const body = readFileSync(f), range = route.request().headers().range;
  const hdr = { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' };
  if (range){
    const [a, z] = range.replace('bytes=', '').split('-');
    const st = Number(a), e = z ? Number(z) : body.length - 1;
    return route.fulfill({ status: 206, contentType: 'audio/mpeg', body: body.subarray(st, e + 1),
      headers: { ...hdr, 'Content-Range': `bytes ${st}-${e}/${body.length}` } });
  }
  return route.fulfill({ status: 200, contentType: 'audio/mpeg', body, headers: hdr });
});
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 60000 });

const found = await page.evaluate(async (file) => {
  for (const id of ['firstRun', 'help', 'coach', 'library', 'console', 'playlist', 'emptyState'])
    { const n = document.getElementById(id); if (n) n.style.display = 'none'; }
  document.body.classList.add('zen');
  const i = player.tracks.findIndex(t => t && String(t.file || t.url || '').endsWith(file));
  if (i < 0) return { ok: false, n: player.tracks.length };
  player.playIndex(i);
  // capture INSIDE the draw (no preserveDrawingBuffer): LENS.render is last
  const lensRender = LENS.render.bind(LENS);
  window.__capWant = false; window.__capPng = null;
  LENS.render = function (...a){
    lensRender(...a);
    if (!window.__capWant) return;
    window.__capWant = false;
    window.__capPng = document.getElementById('glcanvas').toDataURL('image/jpeg', 0.85);
  };
  return { ok: true, i, stems: !!trackStems(player.tracks[i]) };
}, FILE);
if (!found.ok){ console.log('track not in the queue', found); process.exit(1); }
await page.waitForFunction('player.playing && activeDeck() && activeDeck().a.currentTime > 0.2', null, { timeout: 60000 });
await page.evaluate((t) => { activeDeck().a.currentTime = t; }, RETURN - 5);
await page.waitForFunction((t) => Math.abs(activeDeck().a.currentTime - t) < 2, RETURN - 5, { timeout: 30000 });
// a software GPU draws a frame every second or so; slow the song so the
// stepper sees the return at frame resolution (the probe watches the ENGINE,
// and every law it reads is relative to the playhead it is handed)
await page.evaluate(() => { director.dwell = 30; activeDeck().a.playbackRate = 0.15; });

const read = () => page.evaluate(() => {
  const s = STEMS.state, o = STEMS.out;
  return { pos: activeDeck().a.currentTime, kit: s.kit, away: s.away, d: s.d, v: s.v, b: s.b,
    section: s.section, conf: s.conf, coil: o.coil, gate: o.beatGate, brace: DANCE.brace,
    beat: U.uBeat.value, white: U.uWhite.value, wash: COLOR._wash || 0, bloom: COLOR.bloom || 0,
    cuts: window.__mb8StemCue || 0, scene: director.active,
    dwell: director.dwell, auto: director.auto, transT: director.transT, landed: o.landed };
});
const shoot = async (name) => {
  await page.evaluate(() => { window.__capPng = null; window.__capWant = true; });
  await page.waitForFunction('window.__capPng !== null', null, { timeout: 60000 });
  const png = await page.evaluate(() => window.__capPng);
  writeFileSync(join(SHOTS, name + '.jpg'), Buffer.from(png.split(',')[1], 'base64'));
};

const log = [], shot = { breakdown: false, coil: false, landed: false };
let landedAt = null, peakCoil = 0, minGate = 1;
const t0 = Date.now();
while (Date.now() - t0 < 240000){
  const r = await read();
  log.push(r);
  peakCoil = Math.max(peakCoil, r.coil);
  if (!r.kit) minGate = Math.min(minGate, r.gate);
  if (r.cuts && landedAt == null) landedAt = r.pos;
  if (!shot.breakdown && r.pos > RETURN - 4.2){ shot.breakdown = true; await shoot('1-breakdown'); }
  else if (!shot.coil && r.coil > 0.6){ shot.coil = true; await shoot('2-coil'); }
  else if (!shot.landed && r.pos > RETURN + 0.15 && r.kit){ shot.landed = true; await shoot('3-landed'); }
  if (r.pos > RETURN + 3) break;
  await page.waitForTimeout(60);
}
for (const r of log.filter((_, k) => k % 3 === 0))
  console.log(`${r.pos.toFixed(2).padStart(7)}s  kit ${r.kit ? 'ON ' : 'off'}  ${r.section.padEnd(6)} d ${r.d.toFixed(2)} v ${r.v.toFixed(2)}`
    + `  coil ${r.coil.toFixed(2)} brace ${r.brace.toFixed(2)} gate ${r.gate.toFixed(2)}  beat ${r.beat.toFixed(2)}`
    + ` away ${r.away.toFixed(2)}  wash ${r.wash.toFixed(2)} bloom ${r.bloom.toFixed(2)}  cuts ${r.cuts}`);
const ok = found.stems && peakCoil > 0.5 && minGate < 0.6 && log.some(r => r.bloom > 0.8) && errs.length === 0;
console.log(`\nstems ${found.stems} · peak coil ${peakCoil.toFixed(2)} · breakdown gate ${minGate.toFixed(2)}`
  + ` · bloom ${log.some(r => r.bloom > 0.8)} · scene cut on landing ${landedAt != null ? landedAt.toFixed(2) + ' s' : 'no'}`
  + ` · page errors ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
console.log(ok ? 'STEM PROBE: PASS' : 'STEM PROBE: FAIL');
await browser.close(); server.close();
process.exit(ok ? 0 : 1);
