/* STEM PROBE — the room hears the band. Plays a real catalog track across a
 * return of the kit (the drums come back after a long absence) and reads the
 * shipped engine as it goes: the STEM LIGHT stepper (@stem), the beat channel
 * it gates, the dancer's brace it feeds, the colour wash and bloom, and the
 * scene cut on the landing. Frames are photographed in the breakdown, in the
 * coil and just after the landing, so the inhale and the arrival can be seen.
 *
 *   node tools/stem_probe.mjs [file.mp3] [returnSeconds]
 *   SHOTS=/some/dir node tools/stem_probe.mjs      (default: build/stem-shots, git-ignored)
 *   CHART=build/chart.json node tools/stem_probe.mjs   (graft a drum chart — {k,s,h} codes —
 *                                                      onto the track before it plays)
 *   V2=1 node tools/stem_probe.mjs                     (load the page with ?v2=1: the stage-3 engine —
 *                                                      the bus hears the chart (I1) and the kit's
 *                                                      return lands the bus once (I2); V2=0 for off.
 *                                                      Prints a per-frame landing / strike audit.)
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const FILE = process.argv[2] || '01-audio-4927.mp3';
const RETURN = Number(process.argv[3] || 88.7);
const SHOTS = process.env.SHOTS || 'build/stem-shots';
const V2 = process.env.V2 == null ? null : !(process.env.V2 === '0' || process.env.V2 === 'off' || process.env.V2 === 'false');
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
await page.goto(`http://127.0.0.1:${server.address().port}/${V2 == null ? '' : (V2 ? '?v2=1' : '?v2=0')}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 60000 });

const CHART = process.env.CHART ? JSON.parse(readFileSync(process.env.CHART, 'utf8')) : null;
const found = await page.evaluate(async ([file, chart]) => {
  for (const id of ['firstRun', 'help', 'coach', 'library', 'console', 'playlist', 'emptyState'])
    { const n = document.getElementById(id); if (n) n.style.display = 'none'; }
  document.body.classList.add('zen');
  const i = player.tracks.findIndex(t => t && String(t.file || t.url || '').endsWith(file));
  if (i < 0) return { ok: false, n: player.tracks.length };
  if (chart){ const st = mixOf(player.tracks[i]).stems; st.sv = 2; st.hits = chart; }
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
  // the per-FRAME audit (the poll below sees a frame many times under a software GPU): after each
  // frame's choreography the engine's landing marks and the bus's voices are recorded once
  window.__rec = [];
  if (typeof CHOREO !== 'undefined' && typeof DANCE !== 'undefined'){
    const cu = CHOREO.update.bind(CHOREO);
    CHOREO.update = function (dt){
      cu(dt);
      if (window.__rec.length >= 20000) return;
      const dk = activeDeck(), b = DANCE.bus, bs = DANCE.busState, bi = DANCE._busInp || {};
      window.__rec.push({ pos: dk && dk.a ? dk.a.currentTime : NaN, heard: STEMS.heard, dt,
        landedAt: DANCE.landedAt, impulse: INTERACT.impulse, fbeat: AE.f.beat,
        dImpact: b ? b[9] : 8, dKick: b ? b[2] : 0, dAge: b ? b[1] : 4, dBrace: b ? b[8] : 0, dHit: b ? b[0] : 0,
        kick: bs ? bs.kick : 0, snare: bs ? bs.snare : 0, hat: bs ? bs.hat : 0,
        cv: !!bi.chartVoices, auth: !!bi.stemAuthority, stemLanded: !!bi.stemLanded,
        soLanded: !!STEMS.out.landed, coil: STEMS.out.coil, conf: STEMS.state.conf, kit: STEMS.state.kit,
        v2: !!DANCE.v2, brace: DANCE.brace, rate: DANCE.rate, move: (typeof CHOREO !== 'undefined' && CHOREO.move) ? CHOREO.move.name : null });
    };
  }
  return { ok: true, i, stems: !!trackStems(player.tracks[i]), v2: typeof DANCE !== 'undefined' ? !!DANCE.v2 : null };
}, [FILE, CHART]);
console.log(`page: DANCE.v2 ${found.v2} (${V2 == null ? 'the page\'s default' : 'asked for ' + (V2 ? 'on' : 'off')})`);
if (!found.ok){ console.log('track not in the queue', found); process.exit(1); }
await page.waitForFunction('player.playing && activeDeck() && activeDeck().a.currentTime > 0.2', null, { timeout: 60000 });
await page.evaluate((t) => { activeDeck().a.currentTime = t; }, RETURN - 5);
await page.waitForFunction((t) => Math.abs(activeDeck().a.currentTime - t) < 2, RETURN - 5, { timeout: 30000 });
// a software GPU draws a frame every second or so; slow the song so the
// stepper sees the return at frame resolution (the probe watches the ENGINE,
// and every law it reads is relative to the playhead it is handed)
await page.evaluate(() => { director.dwell = 30; activeDeck().a.playbackRate = 0.15; });

function hitsDecodeNode(code){
  const out = []; let cs = 0;
  for (let i = 0; i + 1 < (code || '').length; i += 2){
    const d = parseInt(code.slice(i, i + 2), 36); cs += d; if (d !== 1295) out.push(cs / 100);
  }
  return out;
}
const read = () => page.evaluate(() => {
  const s = STEMS.state, o = STEMS.out;
  return { pos: activeDeck().a.currentTime, kit: s.kit, away: s.away, d: s.d, v: s.v, b: s.b,
    section: s.section, conf: s.conf, coil: o.coil, gate: o.beatGate, brace: DANCE.brace,
    beat: U.uBeat.value, white: U.uWhite.value, wash: COLOR._wash || 0, bloom: COLOR.bloom || 0,
    cuts: window.__mb8StemCue || 0, scene: director.active, hit: STEMS.hit, chart: !!STEMS.chart,
    heard: activeDeck().a.currentTime - CLOCK.latency(),
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
if (CHART){
  // every frame that read a strike must sit just after a charted hit
  const H = ['k', 's', 'h'].flatMap(v => hitsDecodeNode(CHART[v]));
  const struck = log.filter(r => r.hit > 0.5);
  const onTime = struck.filter(r => H.some(t => r.heard - t >= -1e-6 && r.heard - t < 0.2)).length;
  console.log(`chart: ${log.some(r => r.chart) ? 'loaded' : 'MISSING'} · ${struck.length} struck frames, ${onTime} within 200 ms after a charted hit`);
  if (!log.some(r => r.chart) || !struck.length || onTime !== struck.length) errs.push('drum chart strikes off the chart');
}
// ---- THE PER-FRAME AUDIT (V2): the kit's return must land the engine ONCE, and the bus's kick must strike on the chart's kicks
{
  const rec = await page.evaluate(() => window.__rec || []);
  const chartK = await page.evaluate(() => (typeof STEMS !== 'undefined' && STEMS.chart) ? STEMS.chart.k : null);
  writeFileSync(join(SHOTS, 'audit.json'), JSON.stringify({ v2: V2, file: FILE, ret: RETURN, chartK, rec }));   // the per-frame record, for a closer read
  const near = rec.filter(r => isFinite(r.pos) && r.pos > RETURN - 4 && r.pos < RETURN + 3);
  const edges = (arr, on) => { const out = []; for (let i = 1; i < arr.length; i++) if (on(arr[i]) && !on(arr[i - 1])) out.push(arr[i]); return out; };
  const landedAtChanges = near.filter((r, i) => i > 0 && r.landedAt !== near[i - 1].landedAt);
  const impulseJumps = edges(near, r => r.impulse >= 0.99);
  const beatJumps = edges(near, r => r.fbeat >= 1.19);
  const impactZero = near.filter(r => r.dImpact === 0);
  const soLanded = near.filter(r => r.soLanded), stemLanded = near.filter(r => r.stemLanded);
  const fmt = rs => rs.map(r => r.pos.toFixed(2)).join(' ') || '-';
  console.log(`\nV2 AUDIT (${rec.length} frames recorded, ${near.length} within ${RETURN - 4}–${RETURN + 3} s; page v2 ${rec.length ? rec[rec.length - 1].v2 : '?'})`);
  console.log(`  stem light landed (so.landed) on ${soLanded.length} frame(s): ${fmt(soLanded)}`);
  console.log(`  bus input stemLanded on ${stemLanded.length} frame(s): ${fmt(stemLanded)} · authority on ${near.filter(r => r.auth).length}/${near.length} frames · chart voices fed on ${near.filter(r => r.cv).length}`);
  console.log(`  DANCE.landedAt changed on ${landedAtChanges.length} frame(s): ${fmt(landedAtChanges)}`);
  console.log(`  INTERACT.impulse rose to >= 0.99 on ${impulseJumps.length} frame(s): ${fmt(impulseJumps)}`);
  console.log(`  AE.f.beat rose to >= 1.19 on ${beatJumps.length} frame(s): ${fmt(beatJumps)}`);
  console.log(`  dImpact == 0 on ${impactZero.length} frame(s): ${fmt(impactZero)}; dBrace peak before the return ${Math.max(0, ...near.filter(r => r.pos < RETURN).map(r => r.dBrace)).toFixed(2)}`);
  const L = soLanded[0] || stemLanded[0];
  if (L){
    const i = near.indexOf(L);
    const win = near.slice(Math.max(0, i - 2), i + 6);
    console.log('  around the landing: pos · dImpact · dAge · dKick · dHit · dBrace · impulse · fbeat · move');
    for (const r of win) console.log(`    ${r.pos.toFixed(2)} · ${r.dImpact.toFixed(2)} · ${r.dAge.toFixed(2)} · ${r.dKick.toFixed(2)} · ${r.dHit.toFixed(2)} · ${r.dBrace.toFixed(2)} · ${r.impulse.toFixed(2)} · ${r.fbeat.toFixed(2)} · ${r.move}`);
  }
  if (chartK && chartK.length){
    // every bus kick voice sits on the frame a charted kick's audible instant passed; every charted kick in the
    // covered span (the kit playing, the chart fed) struck exactly once
    const fed = rec.filter(r => r.cv && isFinite(r.heard));
    const strikes = fed.filter(r => r.kick >= 0.5);
    let onChart = 0;
    for (let i = 0; i < fed.length; i++){
      if (fed[i].kick < 0.5) continue;
      const prev = i > 0 ? fed[i - 1].heard : NaN;
      if (isFinite(prev) && chartK.some(k => k > prev && k <= fed[i].heard)) onChart++;
    }
    // the charted kicks the bus COULD have struck: those inside a frame's span (prev, heard], seeks excluded (the probe's
    // own jump to the return, the stem light's 1.5 s rule)
    let spans = 0;
    for (let i = 1; i < fed.length; i++){
      const a = fed[i - 1].heard, b = fed[i].heard;
      if (!(b > a) || b - a > 1.5) continue;
      spans += chartK.filter(k => k > a && k <= b).length;
    }
    const kickPeaks = strikes.map(s => { const i = rec.indexOf(s); return Math.max(...rec.slice(i, i + 4).map(r => r.dKick)); });
    console.log(`  chart kicks: ${strikes.length} bus kick strikes on ${fed.length} chart-fed frames, ${onChart} on a charted kick's frame; ${spans} charted kicks inside the fed frames' spans; dKick after a strike: min ${kickPeaks.length ? Math.min(...kickPeaks).toFixed(2) : '-'} max ${kickPeaks.length ? Math.max(...kickPeaks).toFixed(2) : '-'}`);
    if (rec.some(r => r.v2) && (strikes.length === 0 || onChart !== strikes.length)) errs.push('v2: the bus\'s kicks are off the chart');
  }
  if (rec.some(r => r.v2) && rec.some(r => r.pos > RETURN + 0.5)){
    if (landedAtChanges.length !== 1) errs.push(`v2: the landing fired ${landedAtChanges.length} times (landedAt)`);
    if (impulseJumps.length !== 1) errs.push(`v2: the shockwave fired ${impulseJumps.length} times`);
    if (impactZero.length !== 1) errs.push(`v2: dImpact reset on ${impactZero.length} frames`);
  }
}
const ok = found.stems && peakCoil > 0.5 && minGate < 0.6 && log.some(r => r.bloom > 0.8) && errs.length === 0;
console.log(`\nstems ${found.stems} · peak coil ${peakCoil.toFixed(2)} · breakdown gate ${minGate.toFixed(2)}`
  + ` · bloom ${log.some(r => r.bloom > 0.8)} · scene cut on landing ${landedAt != null ? landedAt.toFixed(2) + ' s' : 'no'}`
  + ` · page errors ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
console.log(ok ? 'STEM PROBE: PASS' : 'STEM PROBE: FAIL');
await browser.close(); server.close();
process.exit(ok ? 0 : 1);
