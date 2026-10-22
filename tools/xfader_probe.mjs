// XFADER PROBE — the two-deck engine and the crossfader's law, live.
//
//   load       a record loaded onto the idle deck by hand leaves the record on
//              air untouched: its gain is where it was, the new deck's fader is
//              at zero (the handle rests at the on-air end), the slot is the hand's
//   push       a hand on the handle, moved to the far end and let go, COMMITS the
//              other deck: the on-air badge flips, player.cur is its record, the
//              retired deck's fader is zero and it is stopped
//   arm        the auto-DJ plans AGAINST a record the hand loaded and cued —
//              the deck is moved to the seam's warm point, never reloaded
//   yield      a hand landing on a running seam takes the level and leaves the
//              mixer the tempo lock: phase 'manual', both deck gains at their
//              trim, the fader nodes carrying the blend where the seam was
//   abort      pulled back to the outgoing end, the commit is undone and the
//              mixer is left to re-arm from here
//   commit     pushed across with no seam in flight, the hand's record takes the
//              air without the rack being wiped
//   idle stop  a record faded out and left is stopped after the idle clock
//   the hand   the booth's band over the painted rail, dragged with a real
//              pointer: takes, blends, commits — and the keys, AUTO, CUT,
//              the transport row answering inside the press
//
//   python3 tools/make_mix_fixture.py /tmp/mb8-mix && cp docs/three.min.js /tmp/mb8-mix/
//   cp docs/index.html /tmp/mb8-mix/ && node tools/xfader_probe.mjs /tmp/mb8-mix
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
  // the fixture's records are thirty seconds long, so the auto-DJ arms the
  // moment a record starts: it stands down for the hand-only checks (1-2) and
  // is switched on for the ones that are about it (3 on)
  player.cur = -1; player._bag = []; MIXER.setOn(false); player.playIndex(0);
  BOOTH.toggle(true);
});
await page.waitForFunction('player.playing && activeDeck() && activeDeck().a.currentTime > 0.5', null, { timeout: 15000 });
const wait = (fn, ms) => page.waitForFunction(fn, null, { timeout: ms || 8000 }).then(() => true, () => false);
const snap = () => page.evaluate(() => window.__mb8Decks());

// ---- 0 · the first record of the session lands on A, the handle at A's end
const s0 = await snap();
R('the first record is on deck A, the handle at rest at A', s0.active === 0 && s0.fader.x === 0 && s0.fader.mode === 'rest' && s0.slots[0].fader === 1 && s0.slots[1].fader === 0,
  JSON.stringify({ active: s0.active, fader: s0.fader.x, nodes: s0.slots.map(s => s.fader) }));

// ---- 1 · LOAD: a record onto the idle deck, by hand, leaves the air alone
const load = await page.evaluate(async () => {
  const before = AE.decks[0].gain.gain.value;
  const t = player.tracks[1];
  const ok = DECKS.load(1, t);
  await new Promise(r => setTimeout(r, 600));
  const d = AE.decks[1];
  return { ok, before, after: AE.decks[0].gain.gain.value, faderA: AE.decks[0].fader.gain.value, faderB: d.fader.gain.value,
    owner: DECKS.slots[1].owner, src: d.a.src.indexOf(encodeURI(t.url).split('/').pop()) >= 0, paused: d.a.paused,
    gainB: d.gain.gain.value, normB: d.norm, cue: DECKS.slots[1].cue, at: d.a.currentTime, active: AE.active, cur: player.cur };
});
R('a record loaded onto the idle deck by hand: the slot is the hand\'s, the deck holds it, paused at its cue',
  load.ok && load.owner === 'hand' && load.src && load.paused && Math.abs(load.at - load.cue) < 0.3 && load.active === 0 && load.cur === 0, JSON.stringify(load));
R('…and the record on air is untouched: its gain where it was, its fader open, the new deck\'s fader shut',
  Math.abs(load.after - load.before) < 1e-3 && Math.abs(load.faderA - 1) < 1e-3 && load.faderB < 1e-3 && Math.abs(load.gainB - load.normB) < 0.02, JSON.stringify(load));
const padB = await page.evaluate(() => ({ nmB: document.getElementById('boothNmB').textContent, nmA: document.getElementById('boothNmA').textContent }));
R('the booth shows it on lane B, the record on air on lane A', padB.nmB === 'beta' && padB.nmA === 'alpha', JSON.stringify(padB));

// ---- 2 · PUSH: play the hand's deck, take the handle, push it across, let go
const push = await page.evaluate(async () => {
  DECKS.play(1);
  await new Promise(r => setTimeout(r, 500));
  const rolling = !AE.decks[1].a.paused && AE.decks[1].a.currentTime > 0;
  const g1 = DECKS.faderGrab(0);
  DECKS.faderMove(0.5);
  await new Promise(r => setTimeout(r, 120));
  const law = xfaderGains(0.5, 'power');
  const mid = { fA: AE.decks[0].fader.gain.value, fB: AE.decks[1].fader.gain.value, law: law[0], mode: DECKS.fader.mode, hand: DECKS.fader.hand };
  DECKS.faderMove(1);
  const v = DECKS.faderRelease();
  await new Promise(r => setTimeout(r, 250));
  return { rolling, g1, mid, act: v.act, slot: v.slot, active: AE.active, cur: player.cur, curTitle: player.tracks[player.cur].title,
    faderA: AE.decks[0].fader.gain.value, faderB: AE.decks[1].fader.gain.value, aPaused: AE.decks[0].a.paused, x: DECKS.fader.x, mode: DECKS.fader.mode,
    ownerA: DECKS.slots[0].owner, ownerB: DECKS.slots[1].owner, playing: player.playing, laneA: DECKS.track(0) && DECKS.track(0).title };
});
R('the hand\'s record rolls; mid-way both fader nodes read the power law within 1 %', push.rolling && push.g1 && push.mid.mode === 'hand' && push.mid.hand
  && Math.abs(push.mid.fA - push.mid.law) < 0.01 && Math.abs(push.mid.fB - push.mid.law) < 0.01, JSON.stringify(push.mid));
R('pushed to B\'s end and let go: B commits — the on-air badge flips, player.cur is B\'s record', push.act === 'commit' && push.slot === 1 && push.active === 1 && push.curTitle === 'beta' && push.playing,
  JSON.stringify({ act: push.act, active: push.active, cur: push.curTitle }));
R('…A\'s fader is zero, A is stopped, the handle rests at B, the retired record stays on lane A', push.faderA < 1e-3 && Math.abs(push.faderB - 1) < 1e-3 && push.aPaused && push.x === 1 && push.mode === 'rest' && push.ownerB === 'free' && push.laneA === 'alpha',
  JSON.stringify({ faderA: push.faderA, faderB: push.faderB, aPaused: push.aPaused, x: push.x, mode: push.mode, laneA: push.laneA }));

// ---- 3 · ARM: the auto-DJ plans against a record the hand loaded and cued (B on air now; alpha back onto A)
const arm = await page.evaluate(async () => {
  const t = player.tracks[0];
  const ok = DECKS.load(0, t, { at: 4.0 });
  MIXER.setOn(true);
  const srcBefore = AE.decks[0].a.src;
  for (let k = 0; k < 40 && MIXER.phase !== 'armed'; k++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 300));
  const p = MIXER.plan;
  return { ok, phase: MIXER.phase, next: MIXER.next, plan: p && p.type, owner: DECKS.slots[0].owner, srcSame: AE.decks[0].a.src === srcBefore,
    paused: AE.decks[0].a.paused, at: AE.decks[0].a.currentTime, warm: p && p.type === 'beatmix' ? Math.max(0, p.startB - seamLeadFor(p)) : null,
    hasNext: player.hasNext(), pick: (() => { const i = player.pickNext(); return i; })(), pairB: conMixPair() && conMixPair().B.title };
});
R('the auto-DJ arms AGAINST the hand\'s cued record: a beatmix planned for it, the slot still the hand\'s, the deck not reloaded',
  arm.ok && arm.phase === 'armed' && arm.next === 0 && arm.plan === 'beatmix' && arm.owner === 'hand' && arm.srcSame && arm.paused, JSON.stringify(arm));
R('…only moved to the seam\'s warm point; and the hand\'s record is what "next" means everywhere', arm.warm != null && Math.abs(arm.at - arm.warm) < 0.3 && arm.hasNext && arm.pick === 0 && arm.pairB === 'alpha',
  JSON.stringify({ at: arm.at, warm: arm.warm, pick: arm.pick, pairB: arm.pairB }));

// ---- 4 · YIELD: mix now, then a hand lands on the running seam
const yld = await page.evaluate(async () => {
  const now = MIXER.tryMixNow();
  for (let k = 0; k < 120 && MIXER.phase !== 'running'; k++) await new Promise(r => setTimeout(r, 100));
  for (let k = 0; k < 100 && !(MIXER.lastF > 0.25); k++) await new Promise(r => setTimeout(r, 50));
  const outSlot = AE.decks.indexOf(MIXER.outDeck), xBefore = DECKS.fader.x;
  // where the seam IS, fresh — lastF is the last frame's, and a headless frame can be a fifth of a second old
  const fAt = Math.min(1, (AE.ctx.currentTime - MIXER.audioT0) / MIXER.overlap);
  const g = DECKS.faderGrab();
  const xAfter = DECKS.fader.x;
  await new Promise(r => setTimeout(r, 150));
  const law = xfaderGains(DECKS.fader.x, 'power');
  return { now, fAt, outSlot, xBefore, xAfter, g, phase: MIXER.phase, yielded: window.__mixYielded,
    gA: AE.decks[0].gain.gain.value, gB: AE.decks[1].gain.gain.value, nA: AE.decks[0].norm, nB: AE.decks[1].norm,
    fA: AE.decks[0].fader.gain.value, fB: AE.decks[1].fader.gain.value, law, active: AE.active, cur: player.tracks[player.cur].title,
    samplerOn: !!MIXER._sampleT, plan: !!MIXER.plan, out: !!MIXER.outDeck };
});
R('MIX NOW from the hand\'s cue runs a beatmix; a hand on the handle mid-seam YIELDS it: phase manual, the mixer keeps the plan and the lock',
  yld.now && yld.fAt > 0.2 && yld.g && yld.phase === 'manual' && yld.yielded >= 1 && yld.plan && yld.out && yld.samplerOn,
  JSON.stringify({ fAt: yld.fAt, phase: yld.phase, yielded: yld.yielded, sampler: yld.samplerOn }));
R('…both deck gains at their trim, the fader nodes carrying the blend where the seam was (the handle landed on it)',
  Math.abs(yld.gA - yld.nA) < 0.03 && Math.abs(yld.gB - yld.nB) < 0.03 && Math.abs(yld.fA - yld.law[0]) < 0.02 && Math.abs(yld.fB - yld.law[1]) < 0.02
  && Math.abs(yld.xAfter - xfaderPosFromSeamLocal(yld.fAt, yld.outSlot)) < 0.08,
  JSON.stringify({ gA: yld.gA, gB: yld.gB, nA: yld.nA, nB: yld.nB, fA: yld.fA, fB: yld.fB, law: yld.law, x: yld.xAfter, f: yld.fAt, out: yld.outSlot }));
function xfaderPosFromSeamLocal(f, outSlot){ return outSlot === 1 ? 1 - f : f; }

// ---- 5 · ABORT: pulled back to the outgoing end (B's), the commit is undone and the mixer re-arms from here
const abort = await page.evaluate(async () => {
  DECKS.faderMove(1);                       // B (slot 1) was leaving: its end is the outgoing end
  const v = DECKS.faderRelease();
  await new Promise(r => setTimeout(r, 300));
  const phase0 = MIXER.phase;
  for (let k = 0; k < 30 && MIXER.phase !== 'armed'; k++) await new Promise(r => setTimeout(r, 100));
  return { act: v.act, phase0, phase: MIXER.phase, active: AE.active, cur: player.tracks[player.cur].title, next: MIXER.next,
    aPaused: AE.decks[0].a.paused, bRolling: !AE.decks[1].a.paused, x: DECKS.fader.x, ownerA: DECKS.slots[0].owner,
    gB: AE.decks[1].gain.gain.value, nB: AE.decks[1].norm, fB: AE.decks[1].fader.gain.value, fA: AE.decks[0].fader.gain.value,
    committed: player._committedNext, laneA: DECKS.track(0) && DECKS.track(0).title };
});
R('pulled home and let go: the seam is ABORTED — B is on air again, alpha is the next, the incoming deck is stopped and still the hand\'s',
  abort.act === 'abort' && abort.active === 1 && abort.cur === 'beta' && abort.aPaused && abort.bRolling && abort.ownerA === 'hand' && abort.laneA === 'alpha',
  JSON.stringify(abort));
R('…B at full through its fader, the handle at B, and the auto-DJ re-armed against the same record from here',
  Math.abs(abort.gB - abort.nB) < 0.03 && Math.abs(abort.fB - 1) < 0.02 && abort.fA < 0.02 && abort.x === 1 && abort.phase === 'armed' && abort.next === 0,
  JSON.stringify({ gB: abort.gB, fB: abort.fB, fA: abort.fA, x: abort.x, phase: abort.phase, next: abort.next }));

// ---- 6 · COMMIT by hand with no seam in flight: play A by hand (the plan is dropped), push across
const commit = await page.evaluate(async () => {
  FX.set('filter', 0.7); FX.hand();            // something on the rack a hand set
  const played = DECKS.play(0);
  await new Promise(r => setTimeout(r, 400));
  const dropped = MIXER.phase;
  DECKS.faderGrab(1); DECKS.faderMove(0.4);
  await new Promise(r => setTimeout(r, 100));
  DECKS.faderMove(0);
  const v = DECKS.faderRelease();
  await new Promise(r => setTimeout(r, 300));
  return { played, dropped, act: v.act, active: AE.active, cur: player.tracks[player.cur].title, bPaused: AE.decks[1].a.paused,
    unit: FX.unit, amount: FX.amount, x: DECKS.fader.x, mode: DECKS.fader.mode, ownerA: DECKS.slots[0].owner, phase: MIXER.phase };
});
R('a hand starting the armed deck drops the plan; pushed across with no seam, the hand\'s record COMMITS and the rack it set is kept',
  commit.played && commit.dropped === 'idle' && commit.act === 'commit' && commit.active === 0 && commit.cur === 'alpha' && commit.bPaused
  && commit.unit === 'filter' && Math.abs(commit.amount - 0.7) < 1e-6 && commit.x === 0 && commit.mode === 'rest' && commit.ownerA === 'free',
  JSON.stringify(commit));

// ---- 7 · the idle stop: a record started by hand and left under a shut handle is stopped after the idle clock
const idle = await page.evaluate(async () => {
  DECKS.idleStopSec = 1.5;                      // the test's shorter clock (the law is faderIdleStop's, tested)
  const t = player.tracks[1];
  DECKS.load(1, t);
  await new Promise(r => setTimeout(r, 400));
  DECKS.play(1);
  await new Promise(r => setTimeout(r, 500));
  const rolling = !AE.decks[1].a.paused;
  const silent = AE.decks[1].fader.gain.value;
  await new Promise(r => setTimeout(r, 2600));
  return { rolling, silent, paused: AE.decks[1].a.paused, owner: DECKS.slots[1].owner, silentFor: DECKS.slots[1].silentFor, active: AE.active, aRolling: !AE.decks[0].a.paused };
});
R('a hand\'s record rolling silently under a shut handle is stopped after the idle clock, its slot free; the record on air plays on',
  idle.rolling && idle.silent < 0.01 && idle.paused && idle.owner === 'free' && idle.active === 0 && idle.aRolling, JSON.stringify(idle));

// ---- 8 · THE HAND ITSELF: the booth's band over the painted rail, dragged with a real pointer
//         (beta back onto B, rolling; the mouse lands on the band, crosses to the middle,
//          parks at B's end and lets go — the same commit as check 2, through the DOM)
await page.evaluate(() => {
  // the dialogs a first visit raises sit over the booth; a real pointer must reach the band
  const b = document.querySelector('#langGate .lg-opt.lean'); if (b) b.click();
  for (const id of ['onboard', 'firstRun', 'coach']){ const e = document.getElementById(id); if (e){ e.classList.remove('open', 'on'); e.style.display = 'none'; } }
});
await page.waitForTimeout(500);
const dom = await page.evaluate(async () => {
  DECKS.idleStopSec = 0;
  DECKS.load(1, player.tracks[1]);
  await new Promise(r => setTimeout(r, 400));
  DECKS.play(1);
  await new Promise(r => setTimeout(r, 400));
  const xf = document.getElementById('xfader'), r = xf.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, reach: XF_REACH, rolling: !AE.decks[1].a.paused,
    band: r.height, lamp: document.getElementById('xfAuto').classList.contains('on'), disabled: xf.getAttribute('aria-disabled') };
});
R('the band sits where a thumb needs it: 44 px tall, with reach past both ends, lit AUTO, enabled on the graph path',
  dom.band >= 44 && dom.w > 100 && dom.lamp && dom.disabled === 'false' && dom.rolling, JSON.stringify(dom));
const cy = dom.y + dom.h / 2, xA = dom.x + dom.reach + 1, xMid = dom.x + dom.w / 2, xB = dom.x + dom.w - dom.reach - 1;
await page.mouse.move(xA, cy); await page.mouse.down();
await page.mouse.move(xMid, cy, { steps: 6 });
await page.waitForTimeout(150);
const mid = await page.evaluate(() => ({ hand: DECKS.fader.hand, mode: DECKS.fader.mode, x: DECKS.fader.x,
  fA: AE.decks[0].fader.gain.value, fB: AE.decks[1].fader.gain.value, lamp: document.getElementById('xfAuto').classList.contains('on'),
  stA: document.getElementById('boothStA').textContent, stB: document.getElementById('boothStB').textContent,
  plan: document.getElementById('boothPlan').textContent, pressed: document.getElementById('xfAuto').getAttribute('aria-pressed') }));
R('a mouse on the band takes the handle: both fader nodes at the power law mid-way, the AUTO lamp dark, both rows in the hand\'s',
  mid.hand && mid.mode === 'hand' && Math.abs(mid.x - 0.5) < 0.04 && Math.abs(mid.fA - Math.cos(mid.x * Math.PI / 2)) < 0.03 && Math.abs(mid.fB - Math.sin(mid.x * Math.PI / 2)) < 0.03
  && !mid.lamp && mid.pressed === 'false' && /in your hands/.test(mid.stA) && /in your hands/.test(mid.stB) && /^HAND on the fader/.test(mid.plan), JSON.stringify(mid));
await page.mouse.move(xB, cy, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
const park = await page.evaluate(() => ({ active: AE.active, cur: player.tracks[player.cur].title, x: DECKS.fader.x, mode: DECKS.fader.mode, hand: DECKS.fader.hand,
  aPaused: AE.decks[0].a.paused, lamp: document.getElementById('xfAuto').classList.contains('on'), plan: document.getElementById('boothPlan').textContent,
  value: +document.getElementById('xfader').value, vt: document.getElementById('xfader').getAttribute('aria-valuetext') }));
R('…parked at B\'s end and let go: B commits through the DOM exactly as through the API, the lamp relights, the line says done',
  park.active === 1 && park.cur === 'beta' && park.x === 1 && park.mode === 'rest' && !park.hand && park.aPaused && park.lamp && /^done — B is on air/.test(park.plan)
  && park.value === 1000 && park.vt === 'B', JSON.stringify(park));

// ---- 9 · the keys: [ nudges, \ recentres (and flashes the detent), AUTO glides the handle home
await page.keyboard.press('[');
await page.waitForTimeout(80);
const nudged = await page.evaluate(() => ({ x: DECKS.fader.x, mode: DECKS.fader.mode }));
await page.keyboard.press('\\');
await page.waitForTimeout(120);
const centred = await page.evaluate(() => ({ x: DECKS.fader.x, flash: !!BOOTH._xfFlash, lamp: document.getElementById('xfAuto').classList.contains('on'),
  fA: AE.decks[0].fader.gain.value, plan: document.getElementById('boothPlan').textContent }));
R('[ nudges the handle five percent; \\ recentres it and the detent flashes, the lamp dark — the hand\'s blend',
  Math.abs(nudged.x - 0.95) < 1e-6 && nudged.mode === 'rest' && Math.abs(centred.x - 0.5) < 1e-6 && centred.flash && !centred.lamp && Math.abs(centred.fA - Math.SQRT1_2) < 0.03,
  JSON.stringify({ nudged, centred }));
await page.click('#xfAuto');
await page.waitForTimeout(700);
const home = await page.evaluate(() => ({ x: DECKS.fader.x, mode: DECKS.fader.mode, hand: DECKS.fader.hand, active: AE.active,
  lamp: document.getElementById('xfAuto').classList.contains('on'), fB: AE.decks[1].fader.gain.value }));
R('AUTO glides the handle home to the record on air and relights', home.x === 1 && home.mode === 'rest' && !home.hand && home.active === 1 && home.lamp && Math.abs(home.fB - 1) < 0.02,
  JSON.stringify(home));

// ---- 10 · the transport row: PLAY A starts the retired record under the shut handle, the row says so inside 400 ms; CUT flips the curve
const tr = await page.evaluate(async () => {
  const st = document.getElementById('boothStA'), before = st.textContent, t0 = performance.now();
  document.getElementById('deckPlayA').click();
  let ms = Infinity;
  for (let k = 0; k < 60; k++){ await new Promise(r => setTimeout(r, 16)); if (st.textContent !== before){ ms = performance.now() - t0; break; } }
  await new Promise(r => setTimeout(r, 200));
  const lit = document.getElementById('deckPlayA').classList.contains('on');
  const pressed = document.getElementById('deckPlayA').getAttribute('aria-pressed');
  const word = st.textContent, rolling = !AE.decks[0].a.paused, owner = DECKS.slots[0].owner;
  document.getElementById('deckPlayA').click();
  await new Promise(r => setTimeout(r, 200));
  const paused = AE.decks[0].a.paused;
  document.getElementById('xfCut').click();
  const cut = DECKS.fader.curve, cutLit = document.getElementById('xfCut').classList.contains('on');
  document.getElementById('xfCut').click();
  return { ms, lit, pressed, word, rolling, owner, paused, cut, cutLit, back: DECKS.fader.curve };
});
R('PLAY A starts the retired record by hand, the row answers inside the Doherty threshold and names the shut fader; PLAY again pauses it',
  tr.ms <= 400 && tr.lit && tr.pressed === 'true' && /playing \(silent\)/.test(tr.word) && /fader is on B/.test(tr.word) && tr.rolling && tr.owner === 'hand' && tr.paused, JSON.stringify(tr));
R('CUT flips the curve and its lamp, and back', tr.cut === 'cut' && tr.cutLit && tr.back === 'power', JSON.stringify({ cut: tr.cut, lit: tr.cutLit, back: tr.back }));

R('no page errors', errors === 0, errors + ' errors');
console.log(`\n${results.filter(Boolean).length}/${results.length} crossfader checks passed`);
await browser.close(); server.close();
process.exit(results.every(Boolean) ? 0 : 1);
