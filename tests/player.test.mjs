// Player unit tests — §10 acceptance items 1, 3 and 4.
// The pure blocks are extracted straight out of docs/index.html between
// @pure-start/@pure-end and @solver-start/@solver-end markers, so what is
// tested IS what ships — no copies.
//
//   node tests/player.test.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'docs/index.html'), 'utf8');

function block(name){
  const m = html.match(new RegExp(`// @${name}-start\\n([\\s\\S]*?)// @${name}-end`));
  if (!m) throw new Error(`marker block ${name} not found`);
  return m[1];
}
const code = block('pure') + '\n' + block('solver') + '\n' + block('color') + '\n' + block('safe') + '\n' + block('clock') + '\n' + block('dance') +
  '\nreturn { touchFxMode, mulberry32, solverDist, lerpFeat, sampleWaypoint, dealJourney, monotonicity,' +
  ' quantumStep, eraEligible, orderMemories, historyWindow, historyVerdict, reconcileQueue, clamp01,' +
  ' RITUALS, ritualByKey, dealRitual, freshPicks, openingSet, surpriseSet, libraryOrder, firstUnheardIndex,' +
  ' smoothEnv, analyzeStructure, structureCeiling, pickLens, segueStyle, segueShouldFire, pickStructure, mixNarration, mixTechnique,' +
  ' camelotParse, camelotCompat, tempoFoldRatio, planTransition, glideRates, driftTrim,' +
  ' mixMatchScore, chartSet, nextUp, energyArcBias,' +
  ' camelotHue, oklchToRgb, lerpOklch, colorPlan, PHI, intervalHue, goldenGate,' +
  ' SAFE_TUNING, relLuma, redFraction, gateLuma, makeSafeColorState, safeColorStep,' +
  ' makeSafeBeatState, safeBeatStep, countFlashes,' +
  ' dancePulse, danceSway, danceTimeWarp, onsetEnergy, envFollow, beatSpringStep, beatGate,' +
  ' makeMediaClock, clockReset, clockSample, clockRead, tapTempo, phaseLock, planMixNow, envSample };';
const S = new Function(code)();

let passed = 0, failed = 0;
function test(name, fn){
  try { fn(); passed++; console.log('  ok', name); }
  catch (e){ failed++; console.error('  FAIL', name, '\n   ', e.message); }
}

// ---------------------------------------------------------------- fixtures

function synthCatalog(n, rng){
  // a spread through the feature space; durations 180–300 s
  const tracks = [];
  for (let i = 0; i < n; i++){
    const t = n === 1 ? 0 : i / (n - 1);
    tracks.push({
      id: i + 1,
      duration: 180 + Math.floor(rng() * 120),
      sha256: 'sha' + (i + 1),
      url: 'https://x/' + i, year: 2020 + (i % 6),
      features: {
        bpm: i % 7 === 0 ? 0 : 90 + Math.round(t * 80),   // every 7th is ambient
        energy: Math.min(1, t + (rng() - 0.5) * 0.15),
        brightness: Math.min(1, t + (rng() - 0.5) * 0.2),
        entropy: 0.3 + rng() * 0.4,
        onsets: Math.min(1, t * 0.8 + rng() * 0.2),
      },
    });
  }
  return tracks;
}
const rng0 = S.mulberry32(42);
const CAT = synthCatalog(60, rng0);
const featsById = new Map(CAT.map(t => [t.id, t.features]));

// ---------------------------------------------------------------- journey

test('endpoints honored', () => {
  const r = S.dealJourney({ tracks: CAT, fromId: 1, toId: 60, targetSec: 3600,
    heat: 0, rng: S.mulberry32(7) });
  assert.equal(r.order[0], 1, 'first is FROM');
  assert.equal(r.order[r.order.length - 1], 60, 'last is TO');
});

test('zero repeats within a deal', () => {
  for (const seed of [1, 2, 3, 4, 5]){
    const r = S.dealJourney({ tracks: CAT, fromId: 1, toId: 60, targetSec: 7200,
      heat: 0.6, rng: S.mulberry32(seed) });
    assert.equal(new Set(r.order).size, r.order.length, 'seed ' + seed);
  }
});

test('duration lands within ±10% of the time target', () => {
  for (const [seed, target] of [[11, 1800], [12, 3600], [13, 7200]]){
    const r = S.dealJourney({ tracks: CAT, fromId: 1, toId: 60, targetSec: target,
      heat: 0.3, rng: S.mulberry32(seed) });
    const err = Math.abs(r.totalSec - target) / target;
    assert.ok(err <= 0.10, `target ${target}: got ${r.totalSec} (${(err * 100).toFixed(1)}%)`);
  }
});

test('monotonicity > 0.8 at HEAT 0 (synthetic catalogs)', () => {
  for (const seed of [21, 22, 23]){
    const cat = synthCatalog(80, S.mulberry32(seed * 100));
    const from = cat[0], to = cat[cat.length - 1];
    const r = S.dealJourney({ tracks: cat, fromId: from.id, toId: to.id,
      targetSec: 5400, heat: 0, rng: S.mulberry32(seed) });
    const m = S.monotonicity(r.order, new Map(cat.map(t => [t.id, t.features])), to.features);
    assert.ok(m > 0.8, `seed ${seed}: monotonicity ${m.toFixed(3)}`);
  }
});

test('HEAT 1 is statistically indistinguishable from the permutation bag', () => {
  // at heat 1 every unused track must be equally likely at every step —
  // check the first-slot distribution over many deals
  const cat = synthCatalog(20, S.mulberry32(5));
  const N = 2000;
  const firstCount = new Map();
  for (let i = 0; i < N; i++){
    const r = S.dealJourney({ tracks: cat, targetCount: 20, heat: 1,
      rng: S.mulberry32(i + 1) });
    assert.equal(new Set(r.order).size, 20, 'still a full unique cycle');
    firstCount.set(r.order[0], (firstCount.get(r.order[0]) || 0) + 1);
  }
  const exp = N / 20, sd = Math.sqrt(N * (1 / 20) * (19 / 20));
  for (const t of cat){
    const c = firstCount.get(t.id) || 0;
    assert.ok(Math.abs(c - exp) < 4.5 * sd,
      `track ${t.id} opened ${c}× (expected ~${exp} ± ${(4.5 * sd) | 0})`);
  }
});

test('BPM 0 is a wildcard — no tempo term, eligible anywhere', () => {
  const amb = { bpm: 0, energy: 0.5, brightness: 0.5, entropy: 0.5, onsets: 0.1 };
  const fast = { bpm: 174, energy: 0.5, brightness: 0.5, entropy: 0.5, onsets: 0.1 };
  const slow = { bpm: 87, energy: 0.5, brightness: 0.5, entropy: 0.5, onsets: 0.1 };
  assert.equal(S.solverDist(amb, fast), S.solverDist(amb, slow), 'no tempo penalty on ambient');
  // and mismatched pitched tempi DO cost (non-octave ratio)
  const odd = { bpm: 130, energy: 0.5, brightness: 0.5, entropy: 0.5, onsets: 0.1 };
  assert.ok(S.solverDist(odd, fast) > S.solverDist(amb, fast), 'pitched mismatch costs');
  // ambient tracks actually get dealt at heat 0
  const r = S.dealJourney({ tracks: CAT, fromId: 1, toId: 60, targetSec: 7200,
    heat: 0, rng: S.mulberry32(3) });
  assert.ok(r.order.some(id => featsById.get(id).bpm === 0), 'an ambient track made the journey');
});

test('a drawn curve is sampled by arc length', () => {
  const wps = [
    { energy: 0, brightness: 0 }, { energy: 1, brightness: 0 }, { energy: 1, brightness: 1 },
  ];
  const start = S.sampleWaypoint(wps, 0), mid = S.sampleWaypoint(wps, 0.5), end = S.sampleWaypoint(wps, 1);
  assert.deepEqual([start.energy, start.brightness], [0, 0]);
  assert.deepEqual([end.energy, end.brightness], [1, 1]);
  assert.ok(Math.abs(mid.energy - 1) < 0.01 && Math.abs(mid.brightness) < 0.01, 'midpoint is the corner');
});

// ---------------------------------------------------------------- quantum

test('quantum respects the unique-cycle pass and reports exhaustion', () => {
  const used = new Set();
  const cur = CAT[0].features;
  for (let i = 0; i < CAT.length; i++){
    const step = S.quantumStep({ tracks: CAT, currentFeat: cur, heat: 0.4,
      rng: S.mulberry32(i), usedIds: used });
    assert.ok(!step.exhausted, 'not exhausted at step ' + i);
    assert.ok(!used.has(step.pickId), 'no repeat within the pass');
    used.add(step.pickId);
  }
  const done = S.quantumStep({ tracks: CAT, currentFeat: cur, heat: 0.4,
    rng: S.mulberry32(99), usedIds: used });
  assert.ok(done.exhausted, 'pass complete reads exhausted');
});

test('quantum probabilities are a distribution; hearts weigh the dice', () => {
  const cur = CAT[10].features;
  const plain = S.quantumStep({ tracks: CAT, currentFeat: cur, heat: 0.3,
    rng: () => 0.5, usedIds: new Set() });
  const sum = plain.probs.reduce((a, p) => a + p.p, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'probs sum to 1');
  const favId = plain.probs[3].id;
  const weighted = S.quantumStep({ tracks: CAT, currentFeat: cur, heat: 0.3,
    rng: () => 0.5, usedIds: new Set(), favIds: new Set([favId]) });
  const p0 = plain.probs.find(p => p.id === favId).p;
  const p1 = weighted.probs.find(p => p.id === favId).p;
  assert.ok(p1 > p0, 'a heart raises the draw probability');
  assert.ok(p1 / p0 < 1.35, 'slightly — not a thumb on the scale');
});

test('quantum at HEAT 1 is uniform', () => {
  const step = S.quantumStep({ tracks: CAT, currentFeat: CAT[0].features, heat: 1,
    rng: () => 0.5, usedIds: new Set() });
  const ps = step.probs.map(p => p.p);
  assert.ok(Math.max(...ps) - Math.min(...ps) < 1e-9, 'flat distribution');
});

// ---------------------------------------------------------------- history

test('play thresholds: ≥50% or 60 s counts, less is a skip', () => {
  assert.equal(S.historyVerdict(59, 300), false);
  assert.equal(S.historyVerdict(60, 300), true);
  assert.equal(S.historyVerdict(45, 90), true);      // 50%
  assert.equal(S.historyVerdict(44, 90), false);
  assert.equal(S.historyVerdict(61, 0), true);       // unknown duration, 60 s rule
});

test('era-window eligibility math (release + history)', () => {
  const rel = S.eraEligible(CAT, { mode: 'release', y0: 2021, y1: 2022 }, new Map());
  assert.ok(rel.length > 0);
  assert.ok(rel.every(t => t.year >= 2021 && t.year <= 2022));
  const day = 86400000, now = 1700000000000;
  const win = S.historyWindow(now, 30, 28);
  assert.equal(win.to, now - 30 * day);
  assert.equal(win.from, now - 58 * day);
  const counts = new Map([['sha3', { plays: 5, last: 1 }], ['sha7', { plays: 1, last: 2 }]]);
  const hist = S.eraEligible(CAT, { mode: 'history' }, counts);
  assert.deepEqual(hist.map(t => t.id).sort((a, b) => a - b), [3, 7]);
  const ordered = S.orderMemories(hist, counts, S.mulberry32(1));
  assert.equal(ordered[0], 3, 'what mattered then leads');
});

test('history survives a republished path — events key on hash, not path', () => {
  // the same sha under a new URL still matches the counts map
  const moved = { ...CAT[2], url: 'https://elsewhere/newpath.mp3' };
  const counts = new Map([['sha3', { plays: 2, last: 9 }]]);
  const elig = S.eraEligible([moved], { mode: 'history' }, counts);
  assert.equal(elig.length, 1);
});

// ---------------------------------------------------------------- rituals

test('every ritual deals a unique, non-empty playlist near its target', () => {
  const cat = synthCatalog(120, S.mulberry32(77));
  for (const r of S.RITUALS){
    const d = S.dealRitual(r, cat, S.mulberry32(7));
    assert.ok(d.order.length > 0, r.key + ' dealt nothing');
    assert.equal(new Set(d.order).size, d.order.length, r.key + ' repeats');
    const err = Math.abs(d.totalSec - r.targetSec) / r.targetSec;
    assert.ok(err <= 0.10, `${r.key}: ${d.totalSec}s vs ${r.targetSec}s (${(err * 100).toFixed(1)}%)`);
  }
});

test('rituals are deterministic per seed — a saved ritual re-deals the same intent', () => {
  const cat = synthCatalog(120, S.mulberry32(78));
  const r = S.ritualByKey('run');
  const a = S.dealRitual(r, cat, S.mulberry32(1234));
  const b = S.dealRitual(r, cat, S.mulberry32(1234));
  assert.deepEqual(a.order, b.order);
});

test('going for a run builds; bedtime descends; dinner stays quiet-handed', () => {
  const cat = synthCatalog(120, S.mulberry32(79));
  const feats = new Map(cat.map(t => [t.id, t.features]));
  const mean = (ids, k) => ids.reduce((a, id) => a + feats.get(id)[k], 0) / ids.length;

  const run = S.dealRitual(S.ritualByKey('run'), cat, S.mulberry32(2)).order;
  const third = Math.max(1, Math.floor(run.length / 3));
  assert.ok(mean(run.slice(-third), 'energy') > mean(run.slice(0, third), 'energy'),
    'run: the back third must carry more energy than the front third');

  const bed = S.dealRitual(S.ritualByKey('bedtime'), cat, S.mulberry32(3)).order;
  const first = feats.get(bed[0]), last = feats.get(bed[bed.length - 1]);
  assert.ok(last.energy < first.energy, 'bedtime: ends quieter than it starts');
  const catMedianE = cat.map(t => t.features.energy).sort((a, b) => a - b)[cat.length >> 1];
  assert.ok(last.energy < catMedianE, 'bedtime: lands below the catalog median');

  const din = S.dealRitual(S.ritualByKey('dinner'), cat, S.mulberry32(4)).order;
  const catMeanOnsets = cat.reduce((a, t) => a + t.features.onsets, 0) / cat.length;
  assert.ok(mean(din, 'onsets') < catMeanOnsets, 'dinner: less percussive than the catalog at large');
});

// ---------------------------------------------------------------- the pad row

test('nextUp: the pads hold the best next tracks, judged by the mix planner', () => {
  const cur = mkMixTrack(1);                                    // 126 · 8A
  const cands = [
    mkMixTrack(2, { mix: { mixable: 0.2 } }),                   // the piano rule → fade
    mkMixTrack(3, { mix: { bpm: 124, key: '8B' } }),            // close tempo, friendly key
    mkMixTrack(4, { mix: { bpm: 152 } }),                       // tempo gap → fade
    mkMixTrack(5, { mix: { bpm: 126, key: '9A' } }),            // adjacent key
  ];
  const ranked = S.nextUp(cands, cur, 8);
  assert.equal(ranked.length, 4);
  assert.ok([1, 3].includes(ranked[0].i), 'a real beatmix leads');
  assert.equal(ranked[0].plan.type, 'beatmix');
  const fadeRanks = ranked.map((r, at) => ({ ...r, at })).filter(r => r.plan.type === 'fade');
  assert.equal(fadeRanks.length, 2, 'the piano and the tempo gap fall to fades');
  assert.ok(fadeRanks.every(r => r.at >= 2), 'fades sit at the back of the pad row');
  assert.equal(S.nextUp(cands, cur, 2).length, 2, 'n caps the row');
});

// ---------------------------------------------------------------- fresh picks

test('freshPicks: the front porch — hot by plays, crate by publish date, pressing newest', () => {
  const NOW = Date.UTC(2026, 6, 19);
  const day = 86400000;
  const iso = d => new Date(NOW - d * day).toISOString().slice(0, 10);
  const T = (sha, days, over) => Object.assign({ sha256: sha, title: sha, published: iso(days) }, over);
  const key = t => t.sha256 || null;
  const tracks = [
    T('a', 3), T('b', 10), T('c', 30), T('d', 200),
    T('demo', 1, { demo: true }),            // the demo never fronts the porch
    T('a', 3),                                // catalog duplicate — surfaces once
  ];
  const counts = new Map([['c', 5], ['b', 5], ['d', 2]]);
  const p = S.freshPicks(tracks, counts, key, NOW);
  assert.equal(p.fresh.sha256, 'a', 'the pressing is the newest publish (demo excluded)');
  assert.equal(p.hot.sha256, 'b', 'plays tie 5–5 → the newer publish takes hot');
  assert.equal(p.plays, 5);
  assert.deepEqual(p.crate.map(t => t.sha256), ['a', 'b', 'c'], 'a slow month widens 35 → 90 days');
  const busy = [T('a', 3), T('b', 10), T('c', 30), T('e', 33), T('d', 80)];
  const p2 = S.freshPicks(busy, new Map(), key, NOW);
  assert.deepEqual(p2.crate.map(t => t.sha256), ['a', 'b', 'c', 'e'],
    'a full month keeps the 35-day window — the 80-day track stays out');
  assert.equal(p2.hot, null, 'no history, no hot — never invented');
  const p3 = S.freshPicks([{ sha256: 'x', title: 'x' }], new Map([['x', 1]]), key, NOW);
  assert.equal(p3.fresh, null, 'no publish dates → no pressing, no crate');
  assert.equal(p3.hot.sha256, 'x', 'but local plays still crown a hot track');
});

test('openingSet: Möbius Walking leads, then the freshest, cued for a first visit', () => {
  const NOW = Date.UTC(2026, 6, 19), day = 86400000;
  const iso = d => new Date(NOW - d * day).toISOString().slice(0, 10);
  const T = (sha, title, days) => ({ sha256: sha, title, published: iso(days) });
  const key = t => t.sha256 || null;
  const cat = [
    T('m', 'Möbius Walking', 400),           // old, but the hero always leads
    T('a', 'Amber Axis', 2),
    T('b', 'Breathing', 9),
    T('c', 'Cinder', 30),
    { ...T('z', 'Demo Loop', 1), demo: true },   // demos never enter, even though newest
    T('a', 'Amber Axis', 2),                 // catalog duplicate — surfaces once
  ];
  const set = S.openingSet(cat, key, 2);
  assert.equal(set[0].title, 'Möbius Walking', 'the signature track opens the room');
  assert.deepEqual(set.slice(1).map(t => t.sha256), ['a', 'b'], 'then the freshest, newest first');
  assert.equal(set.length, 3, 'hero + n');
  assert.ok(!set.some(t => t.demo), 'no demo in the opening set');
  // Möbius Walking absent → the freshest track leads instead
  const noHero = S.openingSet([T('a', 'Amber Axis', 2), T('c', 'Cinder', 30)], key, 5);
  assert.equal(noHero[0].sha256, 'a', 'no Möbius Walking → freshest leads');
  assert.equal(noHero.length, 2);
  assert.deepEqual(S.openingSet([], key, 10), [], 'an empty shelf yields nothing (caller shows the demo)');
});

test('libraryOrder: the whole library, newest→oldest, hero first, no dupes/demos', () => {
  const NOW = Date.UTC(2026, 6, 19), day = 86400000;
  const iso = d => new Date(NOW - d * day).toISOString().slice(0, 10);
  const T = (sha, title, days) => ({ sha256: sha, title, published: iso(days) });
  const key = t => t.sha256 || null;
  const cat = [
    T('c', 'Cinder', 30),
    T('m', 'Möbius Walking', 400),               // old, but the hero still leads
    T('a', 'Amber Axis', 2),                     // newest of the rest
    T('b', 'Breathing', 9),
    { ...T('z', 'Demo Loop', 1), demo: true },   // demos never enter
    T('a', 'Amber Axis', 2),                     // duplicate — once
  ];
  const order = S.libraryOrder(cat, key);
  assert.deepEqual(order.map(t => t.sha256), ['m', 'a', 'b', 'c'], 'hero, then strictly newest→oldest, whole library');
  assert.ok(!order.some(t => t.demo), 'no demo');
  assert.deepEqual(S.libraryOrder([], key), [], 'empty shelf → nothing');
  // no hero present → pure newest→oldest
  const noHero = S.libraryOrder([T('a', 'Amber Axis', 2), T('c', 'Cinder', 30), T('b', 'Breathing', 9)], key);
  assert.deepEqual(noHero.map(t => t.sha256), ['a', 'b', 'c'], 'no hero → pure newest→oldest');
});

test('firstUnheardIndex: a returning listener drops in at the first fresh track', () => {
  const key = t => t.sha256 || null;
  const order = [{ sha256: 'm' }, { sha256: 'a' }, { sha256: 'b' }, { sha256: 'c' }];
  assert.equal(S.firstUnheardIndex(order, new Set(), key), 0, 'all fresh → start at the top');
  assert.equal(S.firstUnheardIndex(order, new Set(['m']), key), 1, 'heard the hero → drop in at the next');
  assert.equal(S.firstUnheardIndex(order, new Set(['m', 'a']), key), 2, 'walks forward past everything heard');
  assert.equal(S.firstUnheardIndex(order, new Set(['m', 'a', 'b', 'c']), key), 0, 'a full lap done → back to the top');
});

test('surpriseSet: the vibe turns the solver dials the way the words promise', () => {
  const fastRun = S.surpriseSet('fast', 'running');
  const slowRun = S.surpriseSet('slow', 'running');
  const slowChill = S.surpriseSet('slow', 'chill');
  const fastChill = S.surpriseSet('fast', 'chill');

  // running is a PROGRESSION: it starts lower and ends higher
  assert.ok(fastRun.to.energy > fastRun.from.energy, 'running climbs energy');
  assert.ok(fastRun.to.bpm > fastRun.from.bpm, 'running climbs tempo');
  // chill HOLDS its level — barely any spread, and it lets tempo wander (bpm 0)
  assert.ok(Math.abs(slowChill.to.energy - slowChill.from.energy) < 0.2, 'chill holds its level');
  assert.equal(slowChill.from.bpm, 0, 'chill chases no tempo target');
  assert.equal(fastChill.to.bpm, 0, 'chill chases no tempo target (fast too)');

  // fast aims higher than slow at the same mood
  assert.ok(fastRun.to.energy > slowRun.to.energy, 'fast peaks hotter than slow');
  assert.ok(fastRun.from.onsets > slowRun.from.onsets, 'fast is busier than slow');
  assert.ok(fastRun.from.bpm > slowRun.from.bpm, 'fast targets a higher tempo');

  // every dial the journey solver reads stays in range, and it deals a real set
  for (const s of [fastRun, slowRun, slowChill, fastChill]){
    assert.ok(s.heat >= 0 && s.heat <= 1, 'heat in 0..1');
    assert.ok(s.targetSec > 600, 'a set worth sitting with');
    for (const p of ['energy', 'brightness', 'onsets']){
      assert.ok(s.from[p] >= 0 && s.from[p] <= 1, p + ' from in range');
      assert.ok(s.to[p] >= 0 && s.to[p] <= 1, p + ' to in range');
    }
    assert.ok(typeof s.label === 'string' && s.label.length, 'a human label');
  }

  // and it actually deals a coherent set through the same solver as a ritual
  const dealt = S.dealJourney({ tracks: CAT, fromFeat: fastRun.from, toFeat: fastRun.to,
    targetSec: fastRun.targetSec, heat: fastRun.heat, rng: S.mulberry32(7) });
  assert.ok(dealt.order.length >= 2, 'the vibe deals a real set from the catalog');
  assert.equal(new Set(dealt.order).size, dealt.order.length, 'no track twice');
});

// ---------------------------------------------------------------- mix planner

function mkMixTrack(id, over){
  return Object.assign({
    id, duration: 300, sha256: 'mx' + id,
    mix: Object.assign({
      bpm: 126, grid: 0.4, key: '8A', mixable: 0.9, phrases: 32,
      in: { start: 0.4, beats: 64 }, out: { start: 240.0, beats: 64 },
    }, over && over.mix || {}),
  }, over || {}, over && over.mix ? { mix: Object.assign({
    bpm: 126, grid: 0.4, key: '8A', mixable: 0.9, phrases: 32,
    in: { start: 0.4, beats: 64 }, out: { start: 240.0, beats: 64 },
  }, over.mix) } : {});
}

test('camelot wheel math', () => {
  assert.equal(S.camelotCompat('8A', '8A'), 0);
  assert.equal(S.camelotCompat('8A', '8B'), 0.5);       // relative
  assert.equal(S.camelotCompat('8A', '9A'), 1);          // adjacent
  assert.equal(S.camelotCompat('8A', '9B'), 2);          // diagonal stretch
  assert.equal(S.camelotCompat('12A', '1A'), 1);         // the wheel wraps
  assert.equal(S.camelotCompat('8A', '3B'), 3);          // clash
  assert.equal(S.camelotCompat('8A', null), 1.5);        // unknown ≠ clash
});

test('tempo folding: half-time is family, not a clash', () => {
  assert.ok(Math.abs(S.tempoFoldRatio(140, 70) - 1) < 1e-9);
  assert.ok(Math.abs(S.tempoFoldRatio(124, 126) - 124 / 126) < 1e-9);
});

test('planner gates: beatmix, tempo fade, key fade, piano rule', () => {
  const A = mkMixTrack(1);
  const good = S.planTransition(A, mkMixTrack(2, { mix: { bpm: 124, key: '8B' } }));
  assert.equal(good.type, 'beatmix', JSON.stringify(good));
  const farTempo = S.planTransition(A, mkMixTrack(3, { mix: { bpm: 152 } }));
  assert.equal(farTempo.type, 'fade');
  assert.match(farTempo.why, /tempo/);
  const clash = S.planTransition(A, mkMixTrack(4, { mix: { key: '3B' } }));
  assert.equal(clash.type, 'fade');
  assert.match(clash.why, /key/);
  const piano = S.planTransition(A, mkMixTrack(5, { mix: { mixable: 0.2 } }));
  assert.equal(piano.type, 'fade');
  assert.match(piano.why, /piano/);
  const halfTime = S.planTransition(A, mkMixTrack(6, { mix: { bpm: 63 } }));
  assert.equal(halfTime.type, 'beatmix', 'half-time folds into family');
});

test('planner: album sequence is gapless; overrides win', () => {
  const A = mkMixTrack(1), B = mkMixTrack(2);
  assert.equal(S.planTransition(A, B, { albumSequential: true }).type, 'gapless');
  const forced = S.planTransition(A, mkMixTrack(3, { mix: { bpm: 152 } }),
    { override: { type: 'beatmix', beats: 8 } });
  assert.equal(forced.type, 'beatmix', 'your fix beats the gate');
  assert.equal(forced.beats, 8);
  const fadeFix = S.planTransition(A, B, { override: { type: 'fade', seconds: 6 } });
  assert.equal(fadeFix.type, 'fade');
  assert.equal(fadeFix.seconds, 6);
});

test('beatmix geometry: bar-aligned start, overlap fits, harmony sets length', () => {
  const A = mkMixTrack(1), spb = 60 / 126;
  const same = S.planTransition(A, mkMixTrack(2));               // same key
  assert.equal(same.beats, 32, 'clean harmony affords 32 beats');
  const adj = S.planTransition(A, mkMixTrack(3, { mix: { key: '9A' } }));
  assert.equal(adj.beats, 16);
  const stretch = S.planTransition(A, mkMixTrack(4, { mix: { key: '9B' } }));
  assert.equal(stretch.beats, 8);
  for (const p of [same, adj, stretch]){
    const barErr = (p.startA - 0.4) % (4 * spb);
    assert.ok(Math.min(barErr, 4 * spb - barErr) < 1e-6, 'starts on A\'s bar line');
    assert.ok(p.startA + p.beats * spb <= 300 - 0.29, 'overlap fits inside A');
  }
  const shortRegion = S.planTransition(A, mkMixTrack(5, { mix: { in: { start: 0.4, beats: 8 } } }));
  assert.equal(shortRegion.beats, 8, 'regions clamp the blend');
});

test('the master tempo curve glides and lands', () => {
  const g0 = S.glideRates(126, 120, 0), g1 = S.glideRates(126, 120, 1);
  assert.ok(Math.abs(g0.rateA - 1) < 1e-9, 'A starts untouched');
  assert.ok(Math.abs(g1.rateB - 1) < 1e-9, 'B lands untouched');
  assert.ok(g1.rateA < 1 && g0.rateB > 1, 'both stretch toward each other');
  const half = S.glideRates(140, 70, 1);
  assert.ok(Math.abs(half.rateB - 1) < 1e-9, 'half-time glide respects the fold');
});

test('drift trim is proportional, clamped, and signed right', () => {
  assert.ok(S.driftTrim(0.01) > 0, 'behind → speed up');
  assert.ok(S.driftTrim(-0.01) < 0, 'ahead → slow down');
  assert.equal(S.driftTrim(1), 0.004, 'clamped up');
  assert.equal(S.driftTrim(-1), -0.004, 'clamped down');
});

// ---------------------------------------------------------------- the crate

function synthMixCatalog(n, rng){
  // a club-shaped catalog: one tempo band, spread keys, a few unmixables
  const tracks = [];
  for (let i = 0; i < n; i++){
    const bpm = 120 + Math.round(rng() * 12 * 2) / 2;
    const dur = 200 + Math.floor(rng() * 100);
    const unmixable = rng() < 0.12;
    tracks.push({
      id: i + 1, duration: dur, sha256: 'cs' + (i + 1),
      features: { bpm, energy: rng(), brightness: rng(),
                  entropy: 0.3 + rng() * 0.4, onsets: 0.4 + rng() * 0.5 },
      mix: unmixable ? { mixable: 0.2, key: null } : {
        bpm, grid: 0.4, key: (1 + ((i * 5) % 12)) + (i % 2 ? 'A' : 'B'),
        keyConf: 0.8, phrases: 32, mixable: 0.85,
        in: { start: 0.4, beats: 64 },
        out: { start: dur - 64 * 60 / bpm, beats: 64 },
      },
    });
  }
  return tracks;
}

test('match scoring ranks like a DJ: clean mix > stretch > fade', () => {
  const A = { id: 1, duration: 300, mix: { bpm: 124, grid: 0.4, key: '8A', mixable: 0.9,
    in: { start: 0.4, beats: 64 }, out: { start: 240, beats: 64 } } };
  const mk = (bpm, key, mixable) => ({ id: 2, duration: 300, mix: { bpm, key,
    mixable: mixable == null ? 0.9 : mixable, grid: 0.4,
    in: { start: 0.4, beats: 64 }, out: { start: 240, beats: 64 } } });
  const clean = S.mixMatchScore(A, mk(124, '8A')).score;
  const adjacent = S.mixMatchScore(A, mk(126, '9A')).score;
  const stretch = S.mixMatchScore(A, mk(126, '9B')).score;
  const clash = S.mixMatchScore(A, mk(124, '3B')).score;
  const piano = S.mixMatchScore(A, mk(124, '8A', 0.2)).score;
  assert.ok(clean > adjacent, 'same key beats adjacent');
  assert.ok(adjacent > stretch, 'adjacent beats diagonal stretch');
  assert.ok(stretch > clash, 'any beatmix beats a key-clash fade');
  assert.ok(clash <= 0.2 && piano <= 0.2, 'fades score as fallbacks');
});

test('chartSet arranges the crate into a mostly-beatmixed line', () => {
  const cat = synthMixCatalog(60, S.mulberry32(9));
  const r = S.chartSet({ tracks: cat, fromId: 1, targetSec: 3600, rng: S.mulberry32(4) });
  assert.equal(r.order[0], 1, 'starts from the chosen track');
  assert.equal(new Set(r.order).size, r.order.length, 'no repeats');
  assert.ok(Math.abs(r.totalSec - 3600) / 3600 <= 0.12, 'lands near the hour: ' + r.totalSec);
  const frac = r.mixed / r.transitions.length;
  assert.ok(frac >= 0.7, 'beatmixed fraction ' + frac.toFixed(2));
});

test('chartSet is deterministic per seed', () => {
  const cat = synthMixCatalog(60, S.mulberry32(10));
  const a = S.chartSet({ tracks: cat, fromId: 3, targetSec: 1800, rng: S.mulberry32(7) });
  const b = S.chartSet({ tracks: cat, fromId: 3, targetSec: 1800, rng: S.mulberry32(7) });
  assert.deepEqual(a.order, b.order);
});

// ---------------------------------------------------------------- restore

test('restore reconciliation: keeps the living, counts the vanished', () => {
  const byKey = new Map([['a', 1], ['c', 3]]);
  const { kept, dropped } = S.reconcileQueue(['a', 'b', 'c', 'd'], byKey);
  assert.deepEqual(kept, ['a', 'c']);
  assert.equal(dropped, 2);
});

// ---------------------------------------------------------------- colour engine

test('camelot wheel maps to the colour wheel — the crate chip mapping', () => {
  const hues = [];
  for (let n = 1; n <= 12; n++){
    const h = S.camelotHue(n + 'A');
    assert.equal(h, ((n - 1) / 12 * 300 + 40) % 360);
    hues.push(h);
  }
  assert.equal(new Set(hues.map(h => h.toFixed(2))).size, 12);        // all distinct
  // harmonic neighbours are chromatic neighbours: one wheel step = 25 degrees
  assert.equal(Math.abs(S.camelotHue('9A') - S.camelotHue('8A')), 25);
  // relative major/minor share the wheel position
  assert.equal(S.camelotHue('8A'), S.camelotHue('8B'));
  assert.equal(S.camelotHue('nope'), null);
});

test('colorPlan is deterministic per seed', () => {
  const inp = { key: '8A', energy: 0.6, entropy: 0.4, brightness: 0.5, act: 0.5, seed: 99 };
  assert.deepEqual(S.colorPlan(inp), S.colorPlan({ ...inp }));
  const other = S.colorPlan({ ...inp, seed: 100, key: null });
  const same = S.colorPlan({ ...inp, seed: 100, key: null });
  assert.deepEqual(other, same);
});

test('the scheme follows the character: calm/driving/dense', () => {
  const base = { key: '5B', brightness: 0.4, act: 0.5, seed: 1 };
  assert.equal(S.colorPlan({ ...base, energy: 0.2, entropy: 0.3 }).scheme, 'analogous');
  assert.equal(S.colorPlan({ ...base, energy: 0.8, entropy: 0.4 }).scheme, 'complement');
  assert.equal(S.colorPlan({ ...base, energy: 0.8, entropy: 0.8 }).scheme, 'triad');
});

test('arousal drives chroma; the act raises the temperature', () => {
  const base = { key: '5B', entropy: 0.3, brightness: 0.4, act: 0.4, seed: 1 };
  const c1 = S.colorPlan({ ...base, energy: 0.1 }).root.c;
  const c2 = S.colorPlan({ ...base, energy: 0.5 }).root.c;
  const c3 = S.colorPlan({ ...base, energy: 0.9 }).root.c;
  assert.ok(c1 < c2 && c2 < c3, 'chroma monotone in energy');
  const quiet = S.colorPlan({ ...base, energy: 0.4, act: 0.1 }).root.c;
  const apex  = S.colorPlan({ ...base, energy: 0.4, act: 1.0 }).root.c;
  assert.ok(apex > quiet, 'apex act runs hotter than overture');
});

test('minor keys sit darker and cooler than their relative major', () => {
  const inp = { energy: 0.5, entropy: 0.3, brightness: 0.4, act: 0.5, seed: 1 };
  const minor = S.colorPlan({ ...inp, key: '8A' });
  const major = S.colorPlan({ ...inp, key: '8B' });
  assert.ok(minor.minor && !major.minor);
  assert.ok(minor.root.l < major.root.l, 'minor is darker');
  assert.notEqual(minor.root.h, major.root.h, 'mode tilts the temperature');
});

test('MOZART: intervals become angles — the log-map spells chords in light', () => {
  assert.equal(S.intervalHue(2, 1), 0, 'the octave is an identity');
  assert.ok(Math.abs(S.intervalHue(3, 2) - 210.59) < 0.1, 'the fifth: ' + S.intervalHue(3, 2).toFixed(2));
  assert.ok(Math.abs(S.intervalHue(5, 4) - 115.89) < 0.1, 'the major third');
  assert.ok(Math.abs(S.intervalHue(6, 5) - 94.74) < 0.1, 'the minor third');
  assert.ok(Math.abs(S.intervalHue(45, 32) - 177.06) < 0.1,
    'the tritone falls a hair off the complement — diabolus in musica');
  assert.ok(Math.abs(S.intervalHue(16, 15) - 33.59) < 0.1, 'the semitone');
});

test('MOZART: a keyed palette is tuned — third to the harmony, fifth to the accent', () => {
  const base = { energy: 0.8, entropy: 0.8, brightness: 0.4, act: 0.5, seed: 7 };
  const dh = (a, b) => ((b - a + 720) % 360);
  const maj = S.colorPlan({ ...base, key: '8B' });     // triad scheme, major
  assert.equal(maj.scheme, 'triad');
  assert.ok(Math.abs(dh(maj.colors[0].h, maj.colors[1].h) - S.intervalHue(5, 4)) < 0.1,
    'major third to the harmony');
  assert.ok(Math.abs(dh(maj.colors[0].h, maj.colors[2].h) - S.intervalHue(3, 2)) < 0.1,
    'perfect fifth to the accent');
  const min = S.colorPlan({ ...base, key: '8A' });     // minor spells the minor third
  assert.ok(Math.abs(dh(min.colors[0].h, min.colors[1].h) - S.intervalHue(6, 5)) < 0.1,
    'minor third to the harmony');
  const drive = S.colorPlan({ ...base, entropy: 0.4, key: '8B' });   // complement scheme
  assert.equal(drive.scheme, 'complement');
  assert.ok(Math.abs(dh(drive.colors[0].h, drive.colors[1].h) - S.intervalHue(45, 32)) < 0.1,
    'the driving complement is really the tritone');
  const unkeyed = S.colorPlan({ ...base, key: null });
  assert.ok(Math.abs(dh(unkeyed.colors[0].h, unkeyed.colors[2].h) - 240) < 0.1,
    'unkeyed material keeps the classic art-school triad');
});

test('MOZART: the golden gate peaks at phi of the phrase and fades symmetrically', () => {
  assert.ok(S.goldenGate(S.PHI) > 0.999, 'unity at the golden section');
  assert.ok(S.goldenGate(0.5) < 0.15, 'quiet at mid-phrase');
  assert.ok(S.goldenGate(0.0) < 0.01 && S.goldenGate(0.95) < 0.01, 'silent at the turnarounds');
  const before = S.goldenGate(S.PHI - 0.05), after = S.goldenGate(S.PHI + 0.05);
  assert.ok(Math.abs(before - after) < 1e-9, 'the swell is symmetric about phi');
  assert.ok(Math.abs(S.goldenGate(1.618) - S.goldenGate(0.618)) < 1e-9, 'wraps the phrase');
});

test('oklchToRgb stays in gamut by chroma reduction, and hue-lerps take the short arc', () => {
  for (let h = 0; h < 360; h += 30){
    const rgb = S.oklchToRgb(0.6, 0.4, h);           // deliberately out of gamut
    assert.ok(rgb.every(v => v >= 0 && v <= 1), 'in gamut at hue ' + h);
  }
  const white = S.oklchToRgb(1, 0, 0), black = S.oklchToRgb(0, 0, 0);
  assert.ok(white.every(v => v > 0.99) && black.every(v => v < 0.01));
  const mid = S.lerpOklch({ l: 0.5, c: 0.1, h: 350 }, { l: 0.5, c: 0.1, h: 10 }, 0.5);
  assert.equal(Math.round(mid.h), 0);                 // through red, not the rainbow
});

// ---------------------------------------------------------------- safety (§ SAFE)
// WCAG 2.3.1 as a tested invariant, not a review note: the governor must hold
// under a worst-case strobe no real track would produce.

test('flash governor: a 30 Hz full-field strobe emerges under 3 flashes/sec', () => {
  const st = S.makeSafeColorState(1);
  const dt = 1 / 60;
  const trace = [];
  for (let i = 0; i < 120; i++){                       // 2 s of alternate black/white
    const target = i % 2 ? [1, 1, 1] : [0, 0, 0];
    trace.push(S.relLuma(S.safeColorStep(st, [target], dt)[0]));
  }
  // count flashes in every sliding 1 s (60-frame) window
  for (let w = 0; w + 60 <= trace.length; w += 10){
    const flashes = S.countFlashes(trace.slice(w, w + 60));
    assert.ok(flashes <= 3, `window at ${w}: ${flashes} flashes`);
  }
});

test('flash governor: an eight-beat glide passes through untouched', () => {
  const st = S.makeSafeColorState(1);
  const dt = 1 / 60;
  let maxErr = 0;
  for (let i = 0; i <= 240; i++){                      // 4 s glide, dark → bright
    const k = i / 240;
    const target = [0.1 + k * 0.5, 0.1 + k * 0.5, 0.1 + k * 0.5];
    const out = S.safeColorStep(st, [target], dt)[0];
    maxErr = Math.max(maxErr, Math.abs(S.relLuma(out) - S.relLuma(target)));
  }
  assert.ok(maxErr < 0.01, 'designed glides never feel the governor: err ' + maxErr);
});

test('flash governor: saturated red climbs at a strictly slower luminance rate', () => {
  const stR = S.makeSafeColorState(1), stW = S.makeSafeColorState(1);
  const dt = 1 / 60;
  // both states start dark, then a full-brightness target appears; compare
  // the PER-FRAME luminance step each is granted (red's hazard, red's leash)
  S.safeColorStep(stR, [[0, 0, 0]], dt); S.safeColorStep(stW, [[0, 0, 0]], dt);
  const dR = S.relLuma(S.safeColorStep(stR, [[1, 0, 0]], dt)[0]);
  const dW = S.relLuma(S.safeColorStep(stW, [[1, 1, 1]], dt)[0]);
  assert.ok(dR > 0 && dW > 0, 'both move');
  assert.ok(dR < dW * 0.7, `red step ${dR.toFixed(4)} vs white step ${dW.toFixed(4)}`);
  assert.ok(Math.abs(dR - S.SAFE_TUNING.redRate * dt) < 1e-6, 'red at the red rate');
  assert.ok(Math.abs(dW - S.SAFE_TUNING.rate * dt) < 1e-6, 'white at the full rate');
});

test('beat shaper: a 10 Hz onset train passes at most 3 full pulses/sec', () => {
  const st = S.makeSafeBeatState();
  const dt = 1 / 60;
  let raw = 0, full = 0;
  let prev = 0;
  for (let i = 0; i < 60; i++){                        // 1 s, onset every 6 frames
    if (i % 6 === 0) raw = 1;
    const v = S.safeBeatStep(st, raw, dt);
    if (v >= 0.7 && prev < 0.7) full++;                // soft pulses cap at 0.45
    prev = v;
    raw *= Math.exp(-dt / 0.25);                       // source decay, as analyse() does
  }
  assert.ok(full <= 3, `${full} full pulses in one second`);
});

test('beat shaper: musical tempi land at full amplitude, snapping within 3 frames', () => {
  const st = S.makeSafeBeatState();
  const dt = 1 / 60;
  let raw = 0, full = 0, prev = 0;
  for (let i = 0; i < 120; i++){                       // 2 s at 120 BPM (beat every 30 frames)
    if (i % 30 === 0) raw = 1;
    const v = S.safeBeatStep(st, raw, dt);
    if (v >= 0.7 && prev < 0.7){
      full++;
      assert.ok(i % 30 <= 2, 'the hit lands within 3 frames of the beat (frame ' + (i % 30) + ')');
    }
    prev = v;
    raw *= Math.exp(-dt / 0.25);
  }
  assert.equal(full, 4, 'every beat of 120 BPM lands at full amplitude');
});

test('the governor must not blunt a danced impact (the regression that neutered the room)', () => {
  // a dancePulse-shaped waveform at 126 BPM: instant impact, exponential
  // release, anticipation dip. The emitted peak must stay within 10% of the
  // choreographed peak — the governor gates STROBES, not choreography.
  const st = S.makeSafeBeatState();
  const dt = 1 / 60, period = 60 / 126;
  let peakIn = 0, peakOut = 0;
  for (let i = 0; i < 240; i++){
    const tSec = i * dt;
    const phi = (tSec / period) % 1;
    const raw = 1.1 * Math.exp(-phi / 0.2) - 0.15 * S.clamp01((phi - 0.72) / 0.2);
    const v = S.safeBeatStep(st, raw, dt);
    if (i > 30){ peakIn = Math.max(peakIn, raw); peakOut = Math.max(peakOut, v); }
  }
  assert.ok(peakOut >= peakIn * 0.9,
    `emitted peak ${peakOut.toFixed(2)} vs choreographed ${peakIn.toFixed(2)}`);
});

test('the danced punch survives 120/240 Hz displays (edge-latched attack)', () => {
  // at high frame rates the per-frame attack step is small, and a governor
  // that chases the DECAYING source converges to ~1.0 no matter how hot the
  // downbeat was choreographed. The rising edge latches the hit's height;
  // the ramp climbs to THAT. Same rate, same cap, same pulse count.
  for (const fps of [120, 240]){
    const st = S.makeSafeBeatState();
    const dt = 1 / fps, period = 60 / 126;
    let peakIn = 0, peakOut = 0;
    for (let i = 0; i < 4 * fps; i++){
      const tSec = i * dt;
      const phi = (tSec / period) % 1;
      const raw = 1.35 * Math.exp(-phi / 0.1);         // hot downbeat, fast release
      const v = S.safeBeatStep(st, raw, dt);
      if (tSec > 0.6){ peakIn = Math.max(peakIn, raw); peakOut = Math.max(peakOut, v); }
    }
    assert.ok(peakOut >= peakIn * 0.95,
      `${fps} fps: emitted peak ${peakOut.toFixed(2)} vs choreographed ${peakIn.toFixed(2)}`);
  }
});

test('countFlashes counts pairs of opposing >=0.1 transitions', () => {
  assert.equal(S.countFlashes([0, 1, 0, 1, 0]), 2);
  assert.equal(S.countFlashes([0, 0.05, 0, 0.05, 0]), 0);   // under threshold
  assert.equal(S.countFlashes([0, 1]), 0);                   // one transition is not a flash
  assert.equal(S.countFlashes([0.2, 0.8, 0.1, 0.9, 0.05, 0.95, 0.1]), 3);
});

// ---------------------------------------------------------------- dance engine

test('onsetEnergy: the whole spectrum, continuously — nuance survives (no gate)', () => {
  const at = (bass, mid, treble, punch) => ({ bass, mid, treble, punch });
  // a hard kick reads loud
  const kick = S.onsetEnergy(at(0.8, 0.3, 0.2, 0.9), at(0.2, 0.3, 0.2, 0.1));
  // a ghost hi-hat (the OLD > 0.55 gate would have thrown this away) still moves it
  const hat = S.onsetEnergy(at(0.2, 0.2, 0.5, 0.2), at(0.2, 0.2, 0.25, 0.05));
  assert.ok(kick > 0.7, 'the kick lands hard: ' + kick.toFixed(2));
  assert.ok(hat > 0.1 && hat < kick, 'the ghost hat still registers, smaller: ' + hat.toFixed(2));
  // silence stays still
  assert.equal(S.onsetEnergy(at(0.1, 0.1, 0.1, 0), at(0.1, 0.1, 0.1, 0)), 0);
  // a treble RISE alone (a hat with no o-channel) is caught by the band rise
  const trebleRise = S.onsetEnergy(at(0.1, 0.1, 0.7, 0), at(0.1, 0.1, 0.1, 0));
  assert.ok(trebleRise > 0.15, 'a tonal onset the o-channel missed still shows');
  // monotone in punch — harder hit, bigger number
  assert.ok(S.onsetEnergy(at(0.3, 0.3, 0.3, 0.9), at(0.3, 0.3, 0.3, 0.3))
          > S.onsetEnergy(at(0.3, 0.3, 0.3, 0.4), at(0.3, 0.3, 0.3, 0.3)));
});

test('envFollow: fast attack, slow release — a hit is a hit, not a swell', () => {
  const dt = 1 / 60;
  // one step up: reaches most of the way in a couple frames (tauUp ~18ms)
  let up = 0;
  for (let i = 0; i < 3; i++) up = S.envFollow(up, 1, dt, 0.018, 0.11);
  assert.ok(up > 0.85, 'the attack snaps: ' + up.toFixed(2));
  // from full, the release takes far longer (tauDown ~110ms)
  let down = 1;
  for (let i = 0; i < 3; i++) down = S.envFollow(down, 0, dt, 0.018, 0.11);
  assert.ok(down > 0.55, 'the release carries: ' + down.toFixed(2));
  assert.ok(up - 0.85 > 0, 'attack faster than release');
  assert.ok((1 - up) < down, 'the same 3 frames move up far more than down');
});

test('the pulse has impact, release, and a pull-back before the next hit', () => {
  const o = { art: 0.5, bounce: 0.5, amp: 1 };
  const impact = S.dancePulse(0.02, o);
  assert.ok(impact > 0.8, 'the hit lands hard: ' + impact.toFixed(2));
  assert.ok(S.dancePulse(0.55, o) < impact - 0.4, 'the release lets go');
  assert.ok(S.dancePulse(0.88, o) < 0, 'anticipation dips below rest before the next hit');
  assert.ok(S.dancePulse(0.02, { ...o, down: true }) > impact, 'downbeats hit harder');
});

test('staccato snaps, legato carries — articulation shapes the release', () => {
  const dMax = art => {
    let m = 0;
    for (let i = 0; i < 200; i++){
      const a = S.dancePulse(i / 200, { art, bounce: 0 }), b = S.dancePulse((i + 1) / 200, { art, bounce: 0 });
      m = Math.max(m, Math.abs(b - a));
    }
    return m;
  };
  assert.ok(dMax(1) > dMax(0) * 1.3, 'staccato moves sharper than legato');
});

test('follow-through: with bounce, the body rebounds after the hit', () => {
  let fell = false, rebounded = false, prev = S.dancePulse(0.04, { art: 0.8, bounce: 1 });
  for (let i = 5; i < 60; i++){
    const v = S.dancePulse(i / 100, { art: 0.8, bounce: 1 });
    if (v < prev - 1e-4) fell = true;
    else if (fell && v > prev + 1e-4) rebounded = true;
    prev = v;
  }
  assert.ok(fell && rebounded, 'a fall then a rebound inside the beat');
});

test('the sway leans with the bar and closes its loop', () => {
  const a = S.danceSway(0, 0.3, { energy: 0.5 });
  const b = S.danceSway(1, 0.3, { energy: 0.5 });
  assert.ok(Math.abs(a.sway - b.sway) < 1e-9, 'bar sway is continuous across the barline');
  assert.ok(Math.abs(S.danceSway(0.25, 0, { energy: 1 }).sway) > Math.abs(S.danceSway(0.25, 0, { energy: 0 }).sway) * 0.9,
    'energy widens the lean');
  const lift0 = S.danceSway(0, 0, {}).lift, liftMid = S.danceSway(0, 0.5, {}).lift;
  assert.ok(liftMid > lift0, 'the phrase rises to its middle');
});

test('musical time surges but never runs backwards', () => {
  for (const period of [0.35, 0.48, 0.8]){
    let prev = -Infinity;
    for (let i = 0; i <= 480; i++){
      const t = i * (period / 240);                       // real time across 2 beats
      const phi = (t / period) % 1;
      const wt = t + S.danceTimeWarp(phi, period, 1);
      assert.ok(wt > prev, 'monotone at period ' + period);
      prev = wt;
    }
  }
  assert.ok(Math.abs(S.danceTimeWarp(0, 0.5, 1) - S.danceTimeWarp(1, 0.5, 1)) < 1e-9, 'continuous at the wrap');
  for (let i = 0; i < 20; i++)
    assert.ok(Math.abs(S.danceTimeWarp(i / 20, 0.5, 1)) <= 0.045 + 1e-9, 'bounded to 45 ms');
});

// ---------------------------------------------------------------- the score

test('the score: tonal voices interpolate, the punch holds its step', () => {
  const env = { hz: 4, b: '09090', m: '00900', t: '90009', o: '00900' };
  const mid = S.envSample(env, 0.125);           // halfway step 0 → 1
  assert.ok(Math.abs(mid.bass - 0.5) < 1e-9, 'bass interpolates: ' + mid.bass);
  const hit = S.envSample(env, 0.5);             // step 2
  assert.ok(Math.abs(hit.punch - 1) < 1e-9, 'punch is step-held at the hit');
  const off = S.envSample(env, 0.75);            // step 3
  assert.equal(off.punch, 0, 'and silent off it');
  assert.equal(S.envSample(env, 99).bass, 0, 'past the end reads the last step');
  assert.equal(S.envSample(null, 1), null);
  assert.equal(S.envSample({ hz: 4, b: '1' }, 1), null, 'partial env refused');
});

// ---------------------------------------------------------------- media clock + mix-now

test('media clock: regression recovers a jittery quantized position to sub-2ms', () => {
  const c = S.makeMediaClock();
  let est = null;
  for (let i = 0; i < 40; i++){
    const wall = i * 0.0167;
    const media = 10 + wall * 1.0;
    // quantized to 5 ms steps + up to 2 ms of jitter — worse than real decks
    const q = Math.floor((media + (i % 3) * 0.002) / 0.005) * 0.005;
    S.clockSample(c, wall, q);
    est = S.clockRead(c, wall);
  }
  const wall = 40 * 0.0167;
  assert.ok(c.ok, 'clock locks');
  assert.ok(Math.abs(S.clockRead(c, wall) - (10 + wall)) < 0.004,
    'err ' + Math.abs(S.clockRead(c, wall) - (10 + wall)));
  assert.ok(Math.abs(c.b - 1) < 0.02, 'measured rate ~1: ' + c.b);
});

test('media clock: duplicates carry no information; a seek resets the window', () => {
  const c = S.makeMediaClock();
  for (let i = 0; i < 20; i++) S.clockSample(c, i * 0.0167, 5 + i * 0.0167);
  const nBefore = c.n;
  S.clockSample(c, 21 * 0.0167, c.lastRaw);          // duplicate reading
  assert.equal(c.n, nBefore, 'duplicate rejected');
  S.clockSample(c, 22 * 0.0167, 99.0);               // a seek
  assert.ok(c.n <= 1, 'discontinuity resets');
});

test('phaseLock: kicks on the beat lock with confidence; scattered kicks do not', () => {
  const dt = 1 / 60;
  // kicks landing right on the beat (phi ≈ 0) for ~4 s
  let onbeat = null;
  for (let i = 0; i < 240; i++) onbeat = S.phaseLock(onbeat, i % 30 === 0 ? 0.02 : 0.0,
    i % 30 === 0 ? 1 : 0, dt);
  assert.ok(onbeat.conc > 0.8, 'tight on-beat kicks → high confidence: ' + onbeat.conc.toFixed(2));
  assert.ok(Math.abs(onbeat.off) < 0.03, 'and ~zero offset: ' + onbeat.off.toFixed(3));
  // kicks landing a consistent 0.1 beat LATE → the grid is early, off > 0
  let late = null;
  for (let i = 0; i < 240; i++) late = S.phaseLock(late, 0.1, i % 30 === 0 ? 1 : 0, dt);
  assert.ok(late.off > 0.06 && late.off < 0.14, 'a late kick reads a positive offset: ' + late.off.toFixed(3));
  // kicks scattered all over the beat → low confidence, no trustworthy offset
  let scatter = null, seed = 1;
  for (let i = 0; i < 480; i++){
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    scatter = S.phaseLock(scatter, (seed / 0x7fffffff), i % 8 === 0 ? 1 : 0, dt);
  }
  assert.ok(scatter.conc < 0.4, 'scattered kicks → low confidence (no correction): ' + scatter.conc.toFixed(2));
});

test('phaseLock: the resultant wraps correctly — kicks just before the beat read negative', () => {
  const dt = 1 / 60;
  let early = null;
  for (let i = 0; i < 240; i++) early = S.phaseLock(early, 0.95, i % 30 === 0 ? 1 : 0, dt);
  assert.ok(early.off < -0.02 && early.off > -0.09,
    'a kick at phi 0.95 folds to a small negative offset: ' + early.off.toFixed(3));
  assert.ok(early.conc > 0.8, 'still confident');
});

test('media clock: a reset clears the ring COMPLETELY — no stale-sample corruption', () => {
  // the review catch: resetting n without the write index i let old samples
  // haunt the next regression. Fill on one line, reset, refit on another.
  const c = S.makeMediaClock();
  for (let i = 0; i < 10; i++) S.clockSample(c, i * 0.0167, 100 + i * 0.0167);
  S.clockReset(c);
  assert.equal(c.i, 0, 'write index cleared');
  for (let i = 0; i < 6; i++) S.clockSample(c, 10 + i * 0.0167, 5 + i * 0.0167);
  const got = S.clockRead(c, 10 + 6 * 0.0167);
  assert.ok(Math.abs(got - (5 + 6 * 0.0167)) < 0.004,
    'fresh line wins cleanly: ' + got);
});

test('media clock: a backgrounded gap resets even when both clocks advanced in step', () => {
  // the resume bug: rAF froze, then the tab returned. Wall and media BOTH
  // jumped ~60 s together, so the prediction test (media vs a+b·wall) still
  // roughly holds and would NOT trip — yet the ring now mixes pre-gap points
  // with one post-gap point and fits a wrong rate. The wall-gap guard must
  // catch it regardless.
  const c = S.makeMediaClock();
  for (let i = 0; i < 12; i++) S.clockSample(c, i * 0.0167, 5 + i * 0.0167);
  assert.ok(c.ok && c.n >= 4, 'a good line is fitted before the gap');
  const wall = 12 * 0.0167, media = 5 + 12 * 0.0167;
  S.clockSample(c, wall + 60, media + 60);            // 60 s away, in step
  assert.ok(c.n <= 1, 'the stale window is dropped, not extended (n=' + c.n + ')');
  // and a normal frame-to-frame step is NOT a reset (no false positives)
  const c2 = S.makeMediaClock();
  for (let i = 0; i < 12; i++) S.clockSample(c2, i * 0.0167, 5 + i * 0.0167);
  const n2 = c2.n;
  S.clockSample(c2, 12 * 0.0167, 5 + 12 * 0.0167);
  assert.ok(c2.n >= n2, 'a real 16 ms frame keeps the window');
});

test('tapTempo: reads tempo and confidence from the beat a listener taps', () => {
  // a lone tap sets phase only — no tempo, no confidence
  assert.deepEqual(
    (({ bpm, conf }) => ({ bpm, conf }))(S.tapTempo([10.0])), { bpm: 0, conf: 0 });
  // four taps a steady 0.5 s apart → 120 BPM, high confidence
  const steady = S.tapTempo([10.0, 10.5, 11.0, 11.5]);
  assert.ok(Math.abs(steady.bpm - 120) < 0.5, '120 BPM from half-second taps: ' + steady.bpm);
  assert.ok(steady.conf >= 0.8, 'steady taps are trusted: ' + steady.conf.toFixed(2));
  // 0.4 s → 150 BPM
  assert.ok(Math.abs(S.tapTempo([0, 0.4, 0.8, 1.2]).bpm - 150) < 0.5, '150 BPM');
  // ragged spacing → some tempo, but low confidence (uses the median)
  const ragged = S.tapTempo([0, 0.5, 0.72, 1.4, 1.55]);
  assert.ok(ragged.conf < steady.conf, 'ragged taps trusted less than steady');
  // absurd spacing (out of 40–240) yields no usable tempo
  assert.equal(S.tapTempo([0, 3.0]).bpm, 0, '20 BPM is out of range → no tempo');
  assert.equal(S.tapTempo([0, 0.1]).bpm, 0, '600 BPM is out of range → no tempo');
  // a big gap mid-count (e.g. a seek) is filtered out, not folded into the median
  const withSeek = S.tapTempo([10.0, 10.5, 40.5, 41.0]);   // one 30 s gap among 0.5 s taps
  assert.ok(Math.abs(withSeek.bpm - 120) < 0.5, '120 BPM survives a seek gap: ' + withSeek.bpm);
  assert.ok(withSeek.conf >= 0.5, 'steady taps stay trusted despite the seek: ' + withSeek.conf.toFixed(2));
});

test('mix now: the seam starts on the NEXT BAR LINE of the playing grid', () => {
  const A = { bpm: 120, grid: 0.5, key: '8B', mixable: 0.9, in: { start: 0.5, beats: 32 }, out: { start: 100, beats: 32 } };
  const B = { bpm: 122, grid: 1.0, key: '8B', mixable: 0.9, in: { start: 1.0, beats: 32 }, out: { start: 90, beats: 32 } };
  const plan = S.planMixNow(A, B, 33.33, { durA: 240 });
  assert.equal(plan.type, 'beatmix');
  const barA = (60 / 120) * 4;
  const rel = (plan.startA - 0.5) / barA;
  assert.ok(Math.abs(rel - Math.round(rel)) < 1e-6, 'startA is a bar line: ' + plan.startA);
  assert.ok(plan.startA > 33.33 + 0.17 && plan.startA <= 33.33 + 0.18 + barA, 'the NEXT one');
  assert.equal(plan.startB, 1.0, 'B enters on its own mix-in downbeat');
  assert.equal(plan.beats, 16, 'compatible keys earn sixteen beats');
});

test('mix now: NaN cannot leak — grid-less blocks refuse; intros clamp to the anchor', () => {
  const A = { bpm: 120, grid: 0.5, key: '8B', mixable: 0.9, in: { start: 0.5, beats: 32 } };
  const noGridB = { bpm: 121, key: '8B', mixable: 0.9 };          // no grid, no in
  assert.equal(S.planMixNow(A, noGridB, 30, { durA: 240 }).why, 'no beat grid');
  // deep intro: pos before the anchor must never schedule before it
  const B = { bpm: 121, grid: 1, key: '8B', mixable: 0.9, in: { start: 1, beats: 32 } };
  const early = S.planMixNow(Object.assign({}, A, { grid: 8.0 }), B, 0.2, { durA: 240 });
  assert.equal(early.type, 'beatmix');
  assert.ok(early.startA >= 8.0 - 1e-9, 'seam never before the anchor: ' + early.startA);
});

test('mix now: keys arguing shortens the seam; the gates still refuse', () => {
  const A = { bpm: 120, grid: 0.5, key: '8B', mixable: 0.9, in: { start: 0.5, beats: 32 } };
  const mk = (key, mixable, bpm) => ({ bpm: bpm || 121, grid: 1, key, mixable: mixable == null ? 0.9 : mixable, in: { start: 1, beats: 32 } });
  assert.equal(S.planMixNow(A, mk('7A'), 30, { durA: 240 }).beats, 8, 'diagonal key = 8 beats');
  assert.equal(S.planMixNow(A, mk('3B'), 30, { durA: 240 }).type, 'fade');
  assert.equal(S.planMixNow(A, mk('8B', 0.2), 30, { durA: 240 }).why, 'not beat-stable');
  assert.equal(S.planMixNow(A, mk('8B', 0.9, 150), 30, { durA: 240 }).why, 'tempo gap');
  const tight = S.planMixNow(A, mk('8B'), 236, { durA: 240 });
  assert.equal(tight.type, 'beatmix', 'near the edge: a tight blend, not a cut');
  assert.equal(tight.beats, 4, 'clamped to the room that remains');
  const none = S.planMixNow(A, mk('8B'), 239, { durA: 240 });
  assert.equal(none.type, 'fade', 'truly out of road: fade');
  assert.ok(none.seconds <= 1, 'and the fallback stays prompt');
});

// ---------------------------------------------------------------- touch-FX
test('touch-FX: each effect maps to its force; the black hole is the default field', () => {
  assert.equal(S.touchFxMode('blackhole', 0), 0);
  assert.equal(S.touchFxMode('blackhole', 2), 0);
  assert.equal(S.touchFxMode('gathers', 0), 2);   // gravity well — attract
  assert.equal(S.touchFxMode('flows', 0), 3);     // ripples
  assert.equal(S.touchFxMode('', 0), 0);          // unknown falls back to the repelling field
  assert.equal(S.touchFxMode('nope', 3), 0);
});
test('touch-FX: the vortex has two chiralities and the drag chooses', () => {
  assert.equal(S.touchFxMode('grows', 0), 1, 'still hand → default winding');
  assert.equal(S.touchFxMode('grows', 1.5), 1, 'drag right → one way');
  assert.equal(S.touchFxMode('grows', -1.5), -1, 'drag left → the other way');
  assert.equal(S.touchFxMode('grows', -0.01), 1, 'tiny jitter stays put');
  assert.equal(S.touchFxMode('grows', -0.2), -1, 'a real left drag flips it');
});

// ---------------------------------------------------------------- structure
// a synthetic "traditional script": quiet intro · build · loud chorus ·
// breakdown · the biggest drop (apex) · quiet outro
function scriptPeaks(){
  const N = 480, p = new Float32Array(N);
  for (let i = 0; i < N; i++){
    const f = i / N;
    let v;
    if (f < 0.12) v = 0.10;                          // intro
    else if (f < 0.25) v = 0.10 + (f - 0.12) / 0.13 * 0.55;  // build ramp
    else if (f < 0.45) v = 0.72;                     // chorus (loud)
    else if (f < 0.60) v = 0.16;                     // breakdown (quiet)
    else if (f < 0.85) v = 0.95;                     // THE DROP — loudest (apex)
    else v = 0.12;                                   // outro
    p[i] = v + (((i * 2654435761) >>> 0) % 100) / 100 * 0.05;   // a little deterministic grain
  }
  return p;
}
test('structure: the apex lands in the real drop, not a fixed clock point', () => {
  const st = S.analyzeStructure(scriptPeaks());
  assert.ok(st.ok, 'analysed');
  assert.ok(st.apex > 0.60 && st.apex < 0.86, 'apex sits in the loudest block, got ' + st.apex.toFixed(3));
  assert.ok(st.sections.length >= 4, 'found the distinct sections, got ' + st.sections.length);
});
test('structure: the intensity ceiling is low in the quiet parts, open in the loud ones', () => {
  const st = S.analyzeStructure(scriptPeaks());
  const cIntro = S.structureCeiling(st, 0.06);       // intro
  const cBreak = S.structureCeiling(st, 0.52);       // breakdown
  const cDrop  = S.structureCeiling(st, 0.72);       // the drop
  assert.ok(cDrop > 0.9, 'the drop opens it up, got ' + cDrop.toFixed(3));
  assert.ok(cIntro < 0.55 && cBreak < 0.55, 'quiet parts stay capped, intro=' + cIntro.toFixed(2) + ' break=' + cBreak.toFixed(2));
  assert.ok(cDrop > cBreak + 0.3, 'the drop is decisively louder than the breakdown');
  assert.ok(cIntro >= 0.3, 'never dead — floored');
});
test('structure: the exit point is the end of the last loud block, in the back half', () => {
  const st = S.analyzeStructure(scriptPeaks());
  assert.ok(st.mixOut > 0.78 && st.mixOut <= 0.97, 'exits as the drop ends into the outro, got ' + st.mixOut.toFixed(3));
  assert.ok(st.mixIn >= 0.20 && st.mixIn < 0.5, 'enters on the first strong block, skipping the intro, got ' + st.mixIn.toFixed(3));
});
test('structure: a featureless track degrades gracefully', () => {
  const flat = new Float32Array(480).fill(0.5);
  const st = S.analyzeStructure(flat);
  assert.ok(st.ok, 'still returns a map');
  assert.equal(S.structureCeiling(st, 0.5) > 0, true, 'a ceiling exists');
  const tiny = S.analyzeStructure(new Float32Array(4).fill(0.5));
  assert.equal(tiny.ok, false, 'too little data → not ok, safe defaults');
  assert.equal(tiny.apex, 0.6);
});

// ---- the director's lens taste (pure map) ----
test('lens: the ceiling is a hard gate — a quiet section stays clean glass', () => {
  // even at the APEX act, a low ceiling (a breakdown mislabelled by the clock) → NONE
  assert.equal(S.pickLens({ ceil: 0.40, act: 2, energy: 0.9, major: true }), 'none');
  assert.equal(S.pickLens({ ceil: 0.30, act: 1, energy: 0.5, major: false }), 'none');
});
test('lens: the arc edges (overture/resolve) never get a lens', () => {
  assert.equal(S.pickLens({ ceil: 0.95, act: 0, energy: 0.9, major: true }), 'none');
  assert.equal(S.pickLens({ ceil: 0.95, act: 4, energy: 0.9, major: false }), 'none');
});
test('lens: an uplifting/major apex earns hypnotic mirrors', () => {
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.8, major: true }), 'mirrors');
});
test('lens: a tense/minor apex at real intensity earns moiré, not otherwise', () => {
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.8, major: false }), 'moire');
  // same minor apex but only mid-energy → falls back to mirrors, not agitation
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.5, major: false }), 'mirrors');
});
test('lens: builds and comedowns get a focusing iris', () => {
  assert.equal(S.pickLens({ ceil: 0.70, act: 1, energy: 0.5, major: true }), 'iris');
  assert.equal(S.pickLens({ ceil: 0.70, act: 3, energy: 0.5, major: false }), 'iris');
});
test('lens: a strained device is always spared (clean glass)', () => {
  assert.equal(S.pickLens({ struggling: true, ceil: 0.95, act: 2, energy: 0.9, major: true }), 'none');
});
test('lens: an unknown key is treated as bright (mirrors, never moiré)', () => {
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.9 }), 'mirrors');
});

// ---- the beat spring: it overshoots the hit and settles (the elastic bounce) ----
test('beat spring: a sharp hit overshoots past the drive, then rings back', () => {
  let x = 0, v = 0, peak = 0;
  // hold the drive at 1 and integrate ~0.6s in 60fps steps
  for (let i = 0; i < 36; i++){ const s = S.beatSpringStep(x, v, 1, 1 / 60); x = s.x; v = s.v; peak = Math.max(peak, x); }
  assert.ok(peak > 1.02, 'the spring overshoots its target (bounce), got peak ' + peak.toFixed(3));
  assert.ok(Math.abs(x - 1) < 0.15, 'and settles back toward the drive, got ' + x.toFixed(3));
});
test('beat spring: silence stays still (no phantom motion)', () => {
  let x = 0, v = 0;
  for (let i = 0; i < 30; i++){ const s = S.beatSpringStep(x, v, 0, 1 / 60); x = s.x; v = s.v; }
  assert.equal(x, 0, 'no drive → no displacement');
});
test('beat spring: a long frame gap stays finite (sub-stepped, never diverges)', () => {
  let x = 0, v = 0;
  for (let i = 0; i < 20; i++){ const s = S.beatSpringStep(x, v, 1, 0.1); x = s.x; v = s.v; }   // 100ms frames
  assert.ok(isFinite(x) && Math.abs(x) < 3, 'bounded under coarse dt, got ' + x);
});

// ---- iOS beat priority: the deadband gives downtime + near-critical damping rests ----
test('beat gate: floor 0 (desktop) is a passthrough of the honest drive', () => {
  assert.equal(S.beatGate(0.4, 0), 0.4);
  assert.equal(S.beatGate(0, 0), 0);
  assert.equal(S.beatGate(-0.1, 0), 0);            // never negative
});
test('beat gate: a deadband floor drops the between-beat drive to zero (downtime)', () => {
  assert.equal(S.beatGate(0.20, 0.30), 0, 'weak, between-beat drive → rest');
  assert.equal(S.beatGate(0.30, 0.30), 0, 'at the floor → rest');
  assert.ok(S.beatGate(1, 0.30) > 0.99, 'a full beat still reads full');
  assert.ok(S.beatGate(0.65, 0.30) > 0.4 && S.beatGate(0.65, 0.30) < 0.6, 'mid drive rescaled above the floor');
});
test('beat gate: gated silence keeps the spring perfectly at rest (no jitter)', () => {
  let x = 0, v = 0;
  for (let i = 0; i < 40; i++){ const g = S.beatGate(0.15, 0.30); const s = S.beatSpringStep(x, v, g, 1 / 60, 230, 30); x = s.x; v = s.v; }
  assert.equal(x, 0, 'below-floor drive never moves the field');
});
test('beat spring: the iOS params punch and SETTLE without a fake ring (near-critical)', () => {
  let x = 0, v = 0, peak = 0;
  for (let i = 0; i < 40; i++){ const s = S.beatSpringStep(x, v, 1, 1 / 60, 230, 30); x = s.x; v = s.v; peak = Math.max(peak, x); }
  assert.ok(peak <= 1.02, 'near-critical: no overshoot ring, got peak ' + peak.toFixed(3));
  assert.ok(x > 0.9, 'still reaches the beat, got ' + x.toFixed(3));
});

// ---- the segue: how a transition looks, and when it fires ----
test('segue style: a high-energy apex earns a hard CUT', () => {
  const s = S.segueStyle({ act: 2, energy: 0.8 });
  assert.equal(s.kind, 'cut');
  assert.ok(s.dur < 0.6, 'a cut is fast, got ' + s.dur);
});
test('segue style: the calm edges MELT (a long dissolve)', () => {
  assert.equal(S.segueStyle({ act: 0, energy: 0.5 }).kind, 'dissolve');
  assert.ok(S.segueStyle({ act: 4, energy: 0.2 }).dur > 3, 'calm is a long melt');
  assert.equal(S.segueStyle({ act: 1, energy: 0.1 }).kind, 'dissolve', 'very low energy melts even mid-arc');
});
test('segue style: a big section change gets a morph-length blend', () => {
  const s = S.segueStyle({ act: 1, energy: 0.5, big: true });
  assert.equal(s.kind, 'morph');
});
test('segue style: a hotter passage blends quicker than a cooler one', () => {
  const hot = S.segueStyle({ act: 1, energy: 0.75 }).dur;
  const cool = S.segueStyle({ act: 1, energy: 0.45 }).dur;
  assert.ok(hot < cool, `hotter should be quicker: ${hot} < ${cool}`);
});
test('segue fire: a structural boundary fires immediately (follow the script)', () => {
  assert.equal(S.segueShouldFire({ sectionBoundary: true, grid: true, waited: 0 }), true);
});
test('segue fire: with a grid, a normal change waits for the next bar downbeat', () => {
  assert.equal(S.segueShouldFire({ grid: true, barWrapped: false, waited: 1 }), false, 'mid-bar → hold');
  assert.equal(S.segueShouldFire({ grid: true, barWrapped: true, waited: 1 }), true, 'downbeat → fire');
});
test('segue fire: a big change holds for a phrase, not just a bar', () => {
  assert.equal(S.segueShouldFire({ big: true, grid: true, barWrapped: false, phraseWrapped: false, waited: 1 }), false);
  assert.equal(S.segueShouldFire({ big: true, grid: true, phraseWrapped: true, waited: 1 }), true);
});
test('segue fire: without a grid it lands on the next onset, or a max-wait', () => {
  assert.equal(S.segueShouldFire({ grid: false, onset: true, waited: 0.1, maxWait: 4 }), true, 'onset fires');
  assert.equal(S.segueShouldFire({ grid: false, onset: false, waited: 1, maxWait: 4 }), false, 'else hold');
  assert.equal(S.segueShouldFire({ grid: false, onset: false, waited: 5, maxWait: 4 }), true, 'never stalls');
});

// ---- structure source: precompute-first, client fallback ----
test('pickStructure: a valid precomputed map wins (the catalog is authoritative)', () => {
  const pre = { ok: true, from: 'catalog' }, client = { ok: true, from: 'browser' };
  assert.equal(S.pickStructure(pre, client).from, 'catalog');
});
test('pickStructure: falls back to the client map when no precompute exists', () => {
  const client = { ok: true, from: 'browser' };
  assert.equal(S.pickStructure(null, client).from, 'browser');
  assert.equal(S.pickStructure(undefined, client).from, 'browser');
});
test('pickStructure: an invalid precomputed map is skipped for a valid client one', () => {
  const client = { ok: true, from: 'browser' };
  assert.equal(S.pickStructure({ ok: false }, client).from, 'browser');
});
test('pickStructure: nothing valid → null (features check their inputs)', () => {
  assert.equal(S.pickStructure(null, null), null);
  assert.equal(S.pickStructure({ ok: false }, { ok: false }), null);
});

// ---- the auto-mixer narrates its intent + timing ----
test('mix narration: OFF says so plainly', () => {
  assert.match(S.mixNarration({ on: false }), /MIX is off/);
});
test('mix narration: PLANNING peeks ahead — names the track, plan, and when it arms', () => {
  const s = S.mixNarration({ on: true, phase: 'planning', nextTitle: 'Aurora', planType: 'beatmix', beats: 16,
    keys: '8A→9A', compat: 1, seamSec: 72 });
  assert.match(s, /PLANNING/);
  assert.match(s, /Aurora/);
  assert.match(s, /16-beat blend/);
  assert.match(s, /8A→9A ✓/);           // compatible → check mark
  assert.match(s, /arms in 1:12/);       // 72 s
});
test('mix narration: CUED counts down to the seam and names the filtered fade', () => {
  const s = S.mixNarration({ on: true, phase: 'armed', nextTitle: 'Drift', planType: 'fade', seconds: 6,
    keys: '8A→2B', compat: 3, seamSec: 24 });
  assert.match(s, /CUED/);
  assert.match(s, /filtered fade/);
  assert.match(s, /8A→2B ✕/);            // a clash → the cross
  assert.match(s, /seam in 0:24/);
});
test('mix narration: MIXING shows the live percentage', () => {
  const s = S.mixNarration({ on: true, phase: 'running', nextTitle: 'Pulse', planType: 'beatmix', beats: 32, pct: 62 });
  assert.match(s, /MIXING/);
  assert.match(s, /62%/);
});
test('mix narration: an adjacent key reads ≈, and no next track is graceful', () => {
  assert.match(S.mixNarration({ on: true, phase: 'armed', planType: 'fade', keys: '8A→9A', compat: 2, seamSec: 5 }), /≈/);
  assert.match(S.mixNarration({ on: true, phase: 'armed', planType: 'fade', seamSec: 5 }), /the next track/);
});
test('mix technique: a running fade names the move in play, in schedule order', () => {
  assert.equal(S.mixTechnique({ phase: 'running', planType: 'fade', pct: 5 }), 'aligning');
  assert.equal(S.mixTechnique({ phase: 'running', planType: 'fade', pct: 30 }), 'filtering · bass swap');
  const late = S.mixTechnique({ phase: 'running', planType: 'fade', pct: 70 });
  assert.match(late, /filtering/); assert.match(late, /bass swap/); assert.match(late, /echo/);
});
test('mix technique: beatmix hands the bass over near the midpoint; only while running', () => {
  assert.equal(S.mixTechnique({ phase: 'running', planType: 'beatmix', pct: 20 }), 'beat-locked');
  assert.match(S.mixTechnique({ phase: 'running', planType: 'beatmix', pct: 52 }), /bass swap/);
  assert.match(S.mixTechnique({ phase: 'running', planType: 'beatmix', pct: 80 }), /B leads/);
  assert.equal(S.mixTechnique({ phase: 'armed', planType: 'fade', pct: 30 }), '');   // not running → silent
});
test('mix narration: MIXING a fade surfaces the live technique', () => {
  const s = S.mixNarration({ on: true, phase: 'running', nextTitle: 'Pulse', planType: 'fade', seconds: 6, pct: 60 });
  assert.match(s, /MIXING/); assert.match(s, /echo/); assert.match(s, /60%/);
});

// ---- energy-arc scoring: hold or lift the floor, never crash it ----
test('energy arc: a gentle lift beats an energy crash', () => {
  const lift = S.energyArcBias(0.5, 0.6, 'up');
  const crash = S.energyArcBias(0.5, 0.15, 'up');
  assert.ok(lift > crash, `lift ${lift} should beat crash ${crash}`);
  assert.ok(crash < 0, 'a crash is a penalty');
});
test('energy arc: the default rewards a small lift most', () => {
  const lift = S.energyArcBias(0.5, 0.6, 'up');
  const hold = S.energyArcBias(0.5, 0.5, 'up');
  const jump = S.energyArcBias(0.5, 0.95, 'up');
  assert.ok(lift >= hold && lift > jump, `a gentle lift (${lift}) tops hold (${hold}) and a big jump (${jump})`);
});
test('energy arc: a crash is the harshest penalty of all', () => {
  const crash = S.energyArcBias(0.8, 0.2, 'up');
  const jump = S.energyArcBias(0.2, 0.8, 'up');
  assert.ok(crash < jump, `a crash (${crash}) hurts more than a jump up (${jump})`);
});
test('energy arc: a wind-down set prefers dropping the energy', () => {
  const down = S.energyArcBias(0.6, 0.5, 'down');
  const up = S.energyArcBias(0.6, 0.7, 'down');
  assert.ok(down > up, `winding down should favour a drop: ${down} > ${up}`);
});
test('energy arc: unknown energy is neutral (no nudge)', () => {
  assert.equal(S.energyArcBias(null, 0.5, 'up'), 0);
  assert.equal(S.energyArcBias(0.5, null, 'up'), 0);
});
test('nextUp: between equally-mixable tracks, the lift outranks the crash', () => {
  const cur = { mix: { bpm: 128, key: '8A', mixable: 1, out: { start: 100, beats: 64 }, grid: 0 }, duration: 200, features: { energy: 0.5 } };
  const mk = (e) => ({ mix: { bpm: 128, key: '8A', mixable: 1, in: { start: 0, beats: 64 }, out: { start: 100, beats: 64 }, grid: 0 }, duration: 200, features: { energy: e } });
  const cands = [mk(0.15), mk(0.6)];           // 0 = a crash, 1 = a gentle lift; same key/tempo → same mixability
  const ranked = S.nextUp(cands, cur, 2);
  assert.equal(ranked[0].i, 1, 'the gentle lift is suggested first');
});

console.log(`\n${passed} passed, ${failed} failed`);


process.exit(failed ? 1 : 0);
