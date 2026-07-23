// Mix-engine acceptance — the whole chain, live: pipeline-built grids →
// planner verdicts → two decks actually overlapping in a real browser,
// with the beat-phase error measured, the drift lock observed, and the
// refusals (tempo gap, piano rule, album gapless) honored.
//
//   python3 tools/make_mix_fixture.py /tmp/mb8-mix
//   cp node_modules/three/build/three.min.js /tmp/mb8-mix/
//   node tools/mix_acceptance.mjs /tmp/mb8-mix
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIR = process.argv[2] || '/tmp/mb8-mix';
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  if (range){
    const s0 = +range[1], e = range[2] ? +range[2] : data.length - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${s0}-${e}/${data.length}`,
      'Content-Length': e - s0 + 1 });
    res.end(data.subarray(s0, e + 1));
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
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP cdnjs.cloudflare.com 127.0.0.1'],
});
const page = await (await browser.newContext()).newPage();
const results = [];
const R = (name, ok, detail) => {
  results.push({ name, ok });
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
};
page.on('pageerror', e => console.log('  [pageerror]', e.message.split('\n')[0]));

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });

// ---- 0 · the pipeline gave the fixture real grids
const meta = await page.evaluate(() => allTracks().map(t => ({
  title: t.title, bpm: t.mix && t.mix.bpm, key: t.mix && t.mix.key,
  mixable: t.mix ? t.mix.mixable : null,
})));
const byTitle = Object.fromEntries(meta.map(m => [m.title, m]));
R('pipeline grids: alpha 124 · beta 126 · gamma 152',
  Math.abs(byTitle['alpha'].bpm - 124) < 3 && Math.abs(byTitle['beta'].bpm - 126) < 3
  && Math.abs(byTitle['gamma'].bpm - 152) < 4,
  meta.map(m => `${m.title}:${m.bpm}`).join(' '));
R('pipeline keys: 8A → 9A adjacency', byTitle['alpha'].key === '8A' && byTitle['beta'].key === '9A',
  byTitle['alpha'].key + ' ' + byTitle['beta'].key);
R('the pad is unmixable', (byTitle['delta'].mixable || 0) < 0.5, 'mixable ' + byTitle['delta'].mixable);

// ---- 1 · MIX chip appears; engage mix + play the engineered order
// (make_catalog orders albums alphabetically — the test flow needs its own)
await page.evaluate(() => {
  const byTitle = new Map(allTracks().map(t => [t.title, t]));
  player.tracks = ['alpha', 'beta', 'gamma', 'delta', 'e-one', 'e-two']
    .map(n => byTitle.get(n)).filter(Boolean);
  player.cur = -1; player._bag = [];
  MIXER.setOn(true);
  player.playIndex(0);
});
await page.waitForTimeout(500);
const chipState = await page.evaluate(() => ({
  hidden: el.chipMix.hidden, on: el.chipMix.classList.contains('on'),
}));
R('MIX chip live and on', !chipState.hidden && chipState.on);

// ---- 1b · the BPM readout is grid-locked: steady, correct, no flashing
await page.waitForTimeout(1500);
const bpm1 = await page.evaluate(() => ({ bpm: AE.f.bpm, badge: !el.bpmBadge.classList.contains('hide') }));
await page.waitForTimeout(1500);
const bpm2 = await page.evaluate(() => ({ bpm: AE.f.bpm, badge: !el.bpmBadge.classList.contains('hide') }));
R('BPM readout locked to the measured grid (steady, ≈124)',
  Math.abs(bpm1.bpm - 124) < 3 && Math.abs(bpm2.bpm - bpm1.bpm) < 0.05 && bpm1.badge && bpm2.badge,
  bpm1.bpm.toFixed(2) + ' → ' + bpm2.bpm.toFixed(2));

// ---- 2 · alpha→beta arms as a beatmix on alpha's bar grid
await page.waitForFunction('MIXER.phase !== "idle"', null, { timeout: 20000 });
const armed = await page.evaluate(() => ({ phase: MIXER.phase, plan: MIXER.plan }));
R('alpha→beta plans a beatmix', armed.plan && armed.plan.type === 'beatmix',
  JSON.stringify(armed.plan && { type: armed.plan.type, beats: armed.plan.beats, keys: armed.plan.keys }));
const barOk = await page.evaluate(() => {
  const p = MIXER.plan;
  const m = allTracks().find(t => t.title === 'alpha').mix;
  const spb = 60 / m.bpm, bar = 4 * spb;
  const e = (p.startA - m.grid) % bar;
  return Math.min(e, bar - e) < 1e-6;
});
R('overlap starts on a bar line of A', barOk);

// ---- 3 · the overlap actually runs: two decks, glide, drift lock
await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 40000 });
await page.waitForTimeout(1200);
const mid1 = await page.evaluate(() => ({
  a: MIXER.outDeck.a.currentTime, b: AE.decks[AE.active].a.currentTime,
  rA: MIXER.outDeck.a.playbackRate, rB: AE.decks[AE.active].a.playbackRate,
  pausedA: MIXER.outDeck.a.paused, pausedB: AE.decks[AE.active].a.paused,
}));
await page.waitForTimeout(500);
// lock quality = convergence, not a lucky instant: poll for ~3 s and take
// the settled minimum (the early stage may legitimately hard-seek once)
const mid2 = await page.evaluate(() => new Promise(res => {
  const out = { a: MIXER.outDeck ? MIXER.outDeck.a.currentTime : -1,
                b: AE.decks[AE.active].a.currentTime, err: Infinity };
  let n = 0;
  const iv = setInterval(() => {
    if (window.__mixPhaseErrMs != null) out.err = Math.min(out.err, window.__mixPhaseErrMs);
    if (++n >= 12 || MIXER.phase !== 'running'){ clearInterval(iv); res(out); }
  }, 250);
}));
R('both decks play through the overlap',
  !mid1.pausedA && !mid1.pausedB && mid2.a > mid1.a && mid2.b > mid1.b,
  `A ${mid1.a.toFixed(1)}→${mid2.a.toFixed(1)} · B ${mid1.b.toFixed(1)}→${mid2.b.toFixed(1)}`);
R('the master tempo curve is gliding both decks',
  mid1.rA >= 1.0 && mid1.rB <= 1.0 && (mid1.rA > 1.0001 || mid1.rB < 0.9999),
  `rateA ${mid1.rA.toFixed(4)} rateB ${mid1.rB.toFixed(4)}`);
R('beat-phase lock < 40 ms', mid2.err != null && mid2.err < 40,
  (mid2.err && mid2.err.toFixed(1)) + ' ms');

// ---- 4 · the mix completes; beta is current and playing
await page.waitForFunction('window.__mixCompleted >= 1', null, { timeout: 40000 });
const post = await page.evaluate(() => ({
  title: player.tracks[player.cur].title, playing: player.playing,
  rate: AE.decks[AE.active].a.playbackRate,
}));
R('handover complete — beta playing at rate 1', post.title === 'beta' && post.playing
  && Math.abs(post.rate - 1) < 1e-6, JSON.stringify(post));

// ---- 5 · refusals: tempo gap and the piano rule plan as fades
const verdicts = await page.evaluate(() => {
  const M = new Map(allTracks().map(t => [t.title, t]));
  const w = t => Object.assign({}, t, { mix: mixOf(t) });
  return {
    tempoGap: planTransition(w(M.get('beta')), w(M.get('gamma')), {}),
    piano: planTransition(w(M.get('gamma')), w(M.get('delta')), {}),
    albumSeq: planTransition(w(M.get('e-one')), w(M.get('e-two')),
      { albumSequential: isAlbumSequential(M.get('e-one'), M.get('e-two')) }),
  };
});
R('beta→gamma refuses: tempo gap → fade', verdicts.tempoGap.type === 'fade'
  && /tempo/.test(verdicts.tempoGap.why), verdicts.tempoGap.why);
R('gamma→delta refuses: piano rule → fade', verdicts.piano.type === 'fade'
  && /piano/.test(verdicts.piano.why), verdicts.piano.why);
R('e-one→e-two: album order → gapless', verdicts.albumSeq.type === 'gapless');

// ---- 5b · the crate: mix-scored table, Serato-grade recommendations
await page.keyboard.press('c');
await page.waitForTimeout(600);
const crate = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#crateBody .crate-row')];
  return {
    open: document.getElementById('crate').classList.contains('open'),
    n: rows.length,
    playing: player.tracks[player.cur] && player.tracks[player.cur].title,
    first: rows[0] && rows[0].querySelector('.nm').textContent,
    firstTag: rows[0] && rows[0].querySelector('.matchtag').textContent,
    second: rows[1] && rows[1].querySelector('.nm').textContent,
    secondTag: rows[1] && rows[1].querySelector('.matchtag').textContent,
    keychips: rows.filter(r => r.querySelector('.keychip').textContent !== '—').length,
  };
});
R('crate opens on C with every track', crate.open && crate.n === 6, crate.n + ' rows');
// beta is playing by now (the mix handed over) — its safest next is alpha
R('match sort: the playing track leads, its safest next is a real beatmix',
  crate.first === crate.playing && crate.firstTag === 'playing' && /mix/.test(crate.secondTag),
  crate.first + ' [' + crate.firstTag + '] then ' + crate.second + ' [' + crate.secondTag + ']');
R('key chips colored from real analysis', crate.keychips >= 5, crate.keychips + ' keyed');

// ---- 5c · chart a set: one button, one continuous mixable line
const chart = await page.evaluate(() => {
  document.getElementById('chartLen').value = '1800';
  crateChart();
  return { last: window.__lastChart, queue: player.tracks.length,
    mixOn: MIXER.on, first: player.tracks[0] && player.tracks[0].title };
});
R('chart-a-set deals the crate as a mixable line',
  chart.last && chart.queue === chart.last.n && chart.mixOn && chart.last.mixed >= 1,
  chart.last && (chart.last.n + ' tracks · ' + chart.last.mixed + '/' + chart.last.total + ' beatmixed'));
await page.keyboard.press('Escape');

// ---- 6 · a saved pair fix overrides the planner and survives replan
const fixed = await page.evaluate(() => {
  const M = new Map(allTracks().map(t => [t.title, t]));
  const A = M.get('beta'), B = M.get('gamma');
  MIXFIX.setPair(A, B, { type: 'beatmix', beats: 8 });
  const p = planTransition(
    Object.assign({}, A, { mix: mixOf(A) }),
    Object.assign({}, B, { mix: mixOf(B) }),
    { override: MIXFIX.pairOverride(A, B) });
  return { type: p.type, beats: p.beats };
});
R('your fix beats the gate — forced beatmix 8', fixed.type === 'beatmix' && fixed.beats === 8);

// ---- 6b · MIX NOW: the listener says "next" — the seam starts on the next
// bar line from HERE, the incoming enters on its own downbeat, and the cut
// never happens
const mixNow = await page.evaluate(() => {
  // the auto-mixer may already have armed its own pick (beta is 30 s, the
  // planner arms 90 s out) — clear it so MIX NOW draws the pinned track;
  // an armed plan's pick is otherwise honoured by design
  if (MIXER.phase !== 'idle') MIXER.cancel('test');
  const M = new Map(allTracks().map(t => [t.title, t]));
  player._committedNext = player.tracks.indexOf(M.get('alpha'));
  const d = activeDeck();
  const pos = d.a.currentTime;
  const mA = mixOf(player.tracks[player.cur]);
  const ok = MIXER.tryMixNow();
  const p = MIXER.plan;
  return { ok, phase: MIXER.phase, pos,
    plan: p && { type: p.type, now: p.now, beats: p.beats, startA: p.startA },
    barA: mA ? 4 * 60 / mA.bpm : 0, grid: mA ? mA.grid : 0 };
});
const barRel = (mixNow.plan.startA - mixNow.grid) / mixNow.barA;
const latticeOffMs = Math.abs(barRel - Math.round(barRel)) * mixNow.barA * 1000;
R('mix now arms a beatmix from HERE', mixNow.ok && mixNow.phase === 'armed'
  && mixNow.plan.type === 'beatmix' && mixNow.plan.now === true,
  JSON.stringify(mixNow.plan));
// the plan stores startA at 1 ms resolution; 3 ms of lattice tolerance is
// sub-frame — the ear's own resolution for "on the bar" is ~10 ms
R('mix now seam sits on the next bar line',
  latticeOffMs < 3
  && mixNow.plan.startA > mixNow.pos && mixNow.plan.startA <= mixNow.pos + mixNow.barA + 0.2,
  'startA ' + mixNow.plan.startA.toFixed(3) + ' (pos ' + mixNow.pos.toFixed(3)
  + ', bar ' + mixNow.barA.toFixed(3) + ', off-lattice ' + latticeOffMs.toFixed(2) + ' ms)');
await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 8000 });
// the booth watches the live seam: open it mid-blend, read the room
await page.evaluate(() => BOOTH.toggle(true));
await page.waitForTimeout(350);
const booth = await page.evaluate(() => {
  const cv = document.getElementById('boothCv');
  const cx = cv.getContext('2d');
  const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  let lit = 0; for (let i = 3; i < px.length; i += 40) if (px[i] > 12) lit++;
  const g = id => document.getElementById(id).textContent;
  const out = { plan: g('boothPlan'), nmA: g('boothNmA'), nmB: g('boothNmB'),
    stB: g('boothStB'), lit, running: MIXER.phase === 'running' };
  BOOTH.toggle(false);
  return out;
});
R('the booth watches the live seam — outgoing named, incoming on air, painted',
  !booth.running || (/blending/.test(booth.plan) && booth.nmA === 'beta'
    && booth.nmB === 'alpha' && /on air/.test(booth.stB) && booth.lit > 30),
  booth.nmA + ' → ' + booth.nmB + ' · ' + booth.plan + ' · ' + booth.lit + ' lit'
  + (booth.running ? '' : ' (seam already handed over — skipped)'));
const nowErr = await page.evaluate(() => new Promise(res => {
  let best = Infinity, n = 0;
  const iv = setInterval(() => {
    if (window.__mixPhaseErrMs != null) best = Math.min(best, window.__mixPhaseErrMs);
    if (++n >= 10 || MIXER.phase !== 'running'){ clearInterval(iv); res(best); }
  }, 250);
}));
R('mix now beat-phase lock < 40 ms', nowErr < 40, nowErr && nowErr.toFixed(1) + ' ms');
// the beatmix runs 16 beats (~8 s at 124 BPM) then hands over; under heavy
// machine load that can drift, so give the handover generous headroom
await page.waitForFunction('MIXER.phase === "idle" && player.tracks[player.cur] '
  + '&& player.tracks[player.cur].title === "alpha"', null, { timeout: 30000 });
R('mix now hands over — alpha playing', await page.evaluate(() =>
  player.playing && player.tracks[player.cur].title === 'alpha'));

// ---- 7 · a grid nudge shifts the plan and is hash-keyed
const nudged = await page.evaluate(() => {
  const M = new Map(allTracks().map(t => [t.title, t]));
  const A = M.get('alpha'), B = M.get('beta');
  const w = t => Object.assign({}, t, { mix: mixOf(t) });
  const before = planTransition(w(A), w(B), {});
  MIXFIX.nudgeGrid(A, 0.02);
  const after = planTransition(w(A), w(B), {});
  return { shift: after.startA - before.startA, exported: JSON.parse(MIXFIX.exportJson()) };
});
R('grid nudge shifts the mix point by exactly the fix', Math.abs(nudged.shift - 0.02) < 1e-6,
  'shift ' + (nudged.shift * 1000).toFixed(1) + ' ms');
R('fixes export for make_catalog (mixfix.json)',
  Object.keys(nudged.exported.grids).length === 1 && Object.keys(nudged.exported.pairs).length === 1);

// ---- 8 · MIX state survives a relaunch
await page.evaluate(() => PERSIST.save());
await page.waitForTimeout(300);
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
await page.waitForTimeout(500);
R('MIX on survives relaunch', await page.evaluate(() =>
  MIXER.on && el.chipMix.classList.contains('on')));

// ---- 9 · the pad insert: tap a pad → the draw is pinned; auto-mix continues
const padPin = await page.evaluate(() => {
  BOOTH.toggle(true);
  BOOTH.refreshPads();
  const pads = [...document.querySelectorAll('#boothPads .bpad')];
  const target = pads.find(b => b.querySelector('.bt').textContent === 'gamma');
  if (target) target.click();
  const gi = player.tracks.findIndex(t => t.title === 'gamma');
  const out = { pads: pads.length, found: !!target,
    committed: player._committedNext, gi,
    armedAt: MIXER.phase === 'armed' ? MIXER.next : null };
  BOOTH.toggle(false);
  return out;
});
R('a pad tap pins the draw — gamma is the committed next (or already armed)',
  padPin.found && (padPin.committed === padPin.gi || padPin.armedAt === padPin.gi),
  padPin.pads + ' pads · committed ' + padPin.committed + ' / armed ' + padPin.armedAt
  + ' vs gamma@' + padPin.gi);

await browser.close();
server.close();
const fails = results.filter(r => !r.ok);
console.log('\n' + (results.length - fails.length) + '/' + results.length + ' mix checks passed');
process.exit(fails.length ? 1 : 0);
