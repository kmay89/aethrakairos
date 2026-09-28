// DECK PROBE — the booth's "next on deck" pads and the song's own cues, live.
//
//   a pad tap  → that track is ON DECK: the idle deck loaded with it, the seam
//                planned (armed) for it, the pad lit — and nothing cut
//   tap again  → it mixes in NOW (the blend runs)
//   a tap mid-blend → the running seam is never cancelled; the pick follows it
//   auto cues  → a track with no cues gets them from its own waveform, on its
//                beat grid, named; a hand's cue is never overwritten
//
//   python3 tools/make_mix_fixture.py /tmp/mb8-mix && cp docs/three.min.js /tmp/mb8-mix/
//   cp docs/index.html /tmp/mb8-mix/ && node tools/deck_probe.mjs /tmp/mb8-mix
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
const results = [];
const R = (name, ok, detail) => { results.push(ok); console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (detail ? '  · ' + detail : '')); };
const page = await (await browser.newContext()).newPage();
let errors = 0;
page.on('pageerror', e => { errors++; console.log('  [pageerror]', e.message.split('\n')[0]); });
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
await page.evaluate(() => {
  const byTitle = new Map(allTracks().map(t => [t.title, t]));
  player.tracks = ['alpha', 'beta', 'gamma', 'e-one'].map(n => byTitle.get(n)).filter(Boolean);
  player.cur = -1; player._bag = []; MIXER.setOn(true); player.playIndex(0);
  BOOTH.toggle(true);
});
await page.waitForTimeout(1500);

// ---- 1 · a pad puts its track ON DECK
const pad = await page.evaluate(() => {
  BOOTH.refreshPads();
  const pads = [...el.boothPads.children];
  const b = pads.find(p => p._track && p._track.title === 'beta') || pads[0];
  const t = b._track;
  b.click();
  const i = player.tracks.indexOf(t);
  const nd = AE.decks[1 - AE.active];
  return { title: t.title, phase: MIXER.phase, next: MIXER.next, i, lit: b.classList.contains('ondeck'),
    loaded: !!nd.a.src && nd.a.src.indexOf(encodeURI(t.url).split('/').pop()) >= 0, planned: MIXER.plan && MIXER.plan.type,
    label: b.querySelector('.bk').textContent, playing: player.playing, cur: player.tracks[player.cur].title };
});
R('a pad tap puts the track on deck — armed for it, planned, the idle deck loaded', pad.phase === 'armed' && pad.next === pad.i && pad.loaded && !!pad.planned,
  JSON.stringify(pad));
R('…the pad is lit and says what the next tap does', pad.lit && /ON DECK/.test(pad.label), pad.label);
R('…and nothing was cut: the playing track plays on', pad.playing && pad.cur === 'alpha');
await page.waitForTimeout(400);
const booth = await page.evaluate(() => ({ nmB: document.getElementById('boothNmB').textContent }));
R('the booth shows it on deck B', booth.nmB === pad.title, booth.nmB);

// ---- 2 · the same pad again → now
const again = await page.evaluate(async () => {
  const b = [...el.boothPads.children].find(p => p.classList.contains('ondeck'));
  b.click();
  const was = { phase: MIXER.phase, now: !!(MIXER.plan && MIXER.plan.now) };
  for (let k = 0; k < 80 && MIXER.phase !== 'running'; k++) await new Promise(r => setTimeout(r, 100));
  return Object.assign(was, { ran: MIXER.phase === 'running' });
});
R('tapping the lit pad again mixes it in now', again.now && again.ran, JSON.stringify(again));

// ---- 3 · a tap during the blend never cuts it
const mid = await page.evaluate(() => {
  const b = [...el.boothPads.children].find(p => p._track && p._track.title !== 'beta' && p._track.title !== 'alpha');
  const out = MIXER.outDeck, f0 = MIXER.lastF;
  b.click();
  return { phase: MIXER.phase, outKept: MIXER.outDeck === out && !!out, f0, queued: player._committedNext != null && player.tracks[player._committedNext] === b._track,
    title: b._track.title, lit: b.classList.contains('ondeck') };
});
R('a pad tapped mid-blend leaves the blend running', mid.phase === 'running' && mid.outKept, JSON.stringify(mid));
R('…and its track follows this blend', mid.queued && mid.lit, mid.title);
await page.waitForFunction('MIXER.phase !== "running"', null, { timeout: 30000 });
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({ phase: MIXER.phase, next: MIXER.next >= 0 ? player.tracks[MIXER.next].title : (player._committedNext != null ? player.tracks[player._committedNext].title : null) }));
R('after the blend, the queued pick is the next on deck', after.next === mid.title, JSON.stringify(after));

// ---- 4 · the song's own cues
const cues = await page.evaluate(async () => {
  // a fresh track the store has never seen, with a synthetic structured wave
  // standing in for the decode (the detector itself is unit-tested). The
  // fixture's tracks are 30 s — fifteen bars — so the phrase spacing is
  // shortened to fit; the WIRING is what this checks
  AUTOCUE.gapBars = 4;
  const t = player.tracks[player.cur];
  const m = mixOf(t), bar = 4 * 60 / m.bpm, d = activeDeck(), dur = d.a.duration, N = 480;
  const l = new Float32Array(N), mm = new Float32Array(N), h = new Float32Array(N);
  for (let i = 0; i < N; i++){ const tt = (i + 0.5) * dur / N; const b = Math.floor((tt - m.grid) / bar);
    const v = tt < m.grid ? 0.02 : b < 4 ? 0.25 : b < 8 ? 1.0 : 0.3; l[i] = v; mm[i] = v; h[i] = v; }
  t._bands = { l, m: mm, h }; t._bmax = { l: 1, m: 1, h: 1 };
  CUES.key = null; CUES._cache.delete(CUES.keyOf(t)); CUES._lblCache.delete(CUES.keyOf(t));
  await DB.kvSet('cues:' + CUES.keyOf(t), null).catch(() => {});
  window.__autoCues = null;
  await CUES.follow(t);
  for (let k = 0; k < 40 && !window.__autoCues; k++){ CUES.autoTick(); await new Promise(r => setTimeout(r, 100)); }
  const pts = window.__autoCues || [];
  const onBar = pts.every(c => Math.abs(((c.t - m.grid) / bar) - Math.round((c.t - m.grid) / bar)) < 1e-3);
  FXPADS.bank = 'cue'; FXPADS.build && FXPADS.build();
  return { n: pts.length, labels: pts.map(c => c.label), slots: CUES.slots.filter(v => v != null).length, onBar, lbl1: CUES.label(1) };
});
R('a track with no cues gets the song\'s own, on its bar lines', cues.n >= 2 && cues.slots === cues.n && cues.onBar, JSON.stringify(cues));
R('…named for what happens there', cues.labels[0] === 'INTRO' && cues.labels.includes('DROP') && /DROP|BUILD|BREAK|DOWN|LIFT/.test(cues.lbl1), cues.labels.join(' '));
const hand = await page.evaluate(async () => {
  const t = player.tracks[player.cur];
  CUES.set(5, 7.0);
  CUES._autoFor = t; window.__autoCues = null; CUES.autoTick();
  return { kept: Math.abs(CUES.slots[5] - cueSnap(7.0, FX.grid(), FX.bpm(), CLOCK.haveGrid)) < 1e-6, relabelled: !!CUES.labels[5], reran: !!window.__autoCues };
});
R('a hand\'s cue is never overwritten by the auto pass', hand.kept && !hand.relabelled && !hand.reran, JSON.stringify(hand));
R('no page errors', errors === 0, errors + ' errors');
console.log(`\n${results.filter(Boolean).length}/${results.length} deck checks passed`);
await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
