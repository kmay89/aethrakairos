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
const code = block('pure') + '\n' + block('solver') + '\n' + block('color') + '\n' + block('safe') + '\n' + block('clock') + '\n' + block('dance') + '\n' + block('echo') + '\n' + block('mix') + '\n' + block('style') + '\n' + block('mixset') +
  '\nreturn { touchFxMode, mulberry32, solverDist, lerpFeat, sampleWaypoint, dealJourney, monotonicity,' +
  ' quantumStep, eraEligible, orderMemories, historyWindow, historyVerdict, reconcileQueue, clamp01,' +
  ' RITUALS, ritualByKey, dealRitual, freshPicks, openingSet, surpriseSet, libraryOrder, firstUnheardIndex, completionMilestones,' +
  ' smoothEnv, analyzeStructure, structureCeiling, pickLens, segueStyle, segueShouldFire, pickStructure, dropPoints, nextDropAfter, sectionLabel, qualitySigKey, readQualityMemory, qualitySeed, writeQualityMemory, mixNarration, mixTechnique, stemsAt, stemRGB,' +
  ' camelotParse, camelotCompat, tempoFoldRatio, planTransition, glideRates, driftTrim,' +
  ' mixMatchScore, chartSet, nextUp, energyArcBias, stemWindow, vocalClashBias,' +
  ' equalPowerXfade, xfadeCurve, seamPhaseTrim, seamBuffered, seamStreamReady, seamDeferBar, seamEntry, seamLeadFor, SEAM_LEAD,' +
  ' MIX_STYLES, MIX_STYLE_ORDER, resolveMixStyle, stylePlanOpts, styleAdjustPlan, styleExitBase,' +
  ' matchTrack, mixsetSectionAt, mixsetStyleAt, mixsetForbids, sectionPool, sectionTargetEnergy, dueAnchor, mixsetPick,' +
  ' camelotHue, oklchToRgb, lerpOklch, colorPlan, PHI, intervalHue, goldenGate,' +
  ' INK, inkRolloff, whiteBudget, rampStops, buildRamp, RAMP_N,' +
  ' SAFE_TUNING, relLuma, redFraction, gateLuma, makeSafeColorState, safeColorStep,' +
  ' makeSafeBeatState, safeBeatStep, countFlashes,' +
  ' dancePulse, danceSway, danceTimeWarp, onsetEnergy, envFollow, beatSpringStep, beatGate,' +
  ' makeMediaClock, clockReset, clockSample, clockRead, tapTempo, phaseLock, planMixNow, envSample,' +
  ' powerPlan, echoSignals, echoPick, echoCompose, ECHO_QUOTES, ECHO_PROMPTS, ECHO_ACK, ECHO_FRAGS, ECHO_TURN,' +
  ' touchCharge, touchBurst, beatTapBonus, touchAffinity, touchAutoShould, updateGate, newsSince,' +
  ' WARP, warpSoft, warpReach, warpDeflect, warpRho, warpHorizon, warpBudget,' +
  ' UP_EST, updateProgress, updateEstimate, updateWatchdogStep,' +
  ' UP_SNOOZE_MS, UP_NAG_CAP, UP_APPLY_CAP, updateReminder, ACT_CAP, activityPush, activityAgo,' +
  ' SKINS, skinResolve, skinHexRgb, skinCss };';
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

test('completionMilestones: library-completion badges cross at half and all', () => {
  assert.deepEqual(S.completionMilestones(0, 0), [], 'no library → nothing to complete');
  assert.deepEqual(S.completionMilestones(9, 0), [], 'no total → nothing, even with heard counts');
  assert.deepEqual(S.completionMilestones(0, 10), [], 'heard none → no badge');
  assert.deepEqual(S.completionMilestones(4, 10), [], 'under half → still nothing');
  assert.deepEqual(S.completionMilestones(5, 10), ['half_heard'], 'exactly half → Halfway Home');
  assert.deepEqual(S.completionMilestones(9, 10), ['half_heard'], 'most → half only, not all');
  assert.deepEqual(S.completionMilestones(10, 10), ['half_heard', 'heard_all'], 'every track → both badges');
  assert.deepEqual(S.completionMilestones(3, 5), ['half_heard'], 'half rounds UP: 3 of 5 counts');
  assert.deepEqual(S.completionMilestones(2, 5), [], 'below the rounded-up half → nothing');
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

test('beatmix geometry: bar-aligned start, overlap fits, eight beats by default', () => {
  const A = mkMixTrack(1), spb = 60 / 126;
  // EIGHT is the default whatever the harmony says. A long overlap is the
  // hardest thing in the engine to hold in phase, so length is now something
  // asked for, never something a clean key change quietly buys.
  const same = S.planTransition(A, mkMixTrack(2));               // same key
  assert.equal(same.beats, 8, 'a perfect key match still blends in eight');
  const adj = S.planTransition(A, mkMixTrack(3, { mix: { key: '9A' } }));
  assert.equal(adj.beats, 8);
  const stretch = S.planTransition(A, mkMixTrack(4, { mix: { key: '9B' } }));
  assert.equal(stretch.beats, 8);
  const long = S.planTransition(A, mkMixTrack(6), { forceBeats: 32 });
  assert.equal(long.beats, 32, 'a longer blend is available when asked for');
  for (const p of [same, adj, stretch, long]){
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

// ---------------------------------------------------------------- ink (§ INK)
// The washout is a hue failure, not a brightness failure, so these tests are
// about CHROMATICITY surviving drive — the one property clamping destroys.

test('the rolloff preserves hue and saturation at any drive level', () => {
  const hue = ([r, g, b]) => {                      // chromaticity as a ratio triple
    const m = Math.max(r, g, b) || 1;
    return [r / m, g / m, b / m];
  };
  const amber = [1.0, 0.72, 0.28];
  const ref = hue(amber);
  for (const k of [1, 1.5, 2, 4, 8, 40]){
    const out = S.inkRolloff(amber.map(v => v * k), 0);
    const h = hue(out);
    for (let i = 0; i < 3; i++)
      assert.ok(Math.abs(h[i] - ref[i]) < 1e-6, `chromaticity held at ${k}x (channel ${i})`);
  }
  // and the naive alternative does not — this is the defect, stated as a test
  const clipped = amber.map(v => Math.min(1, v * 4));
  assert.ok(clipped.every(v => v === 1), 'a hard clamp turns 4x amber into white');
});

test('below the knee the light is untouched; above it, never quite white', () => {
  const K = S.INK.knee;
  const low = [0.3, K - 0.01, 0.1];
  assert.deepEqual(S.inkRolloff(low, 1), low, 'linear region is exact');
  for (const k of [1, 3, 10, 100, 1e4]){
    const out = S.inkRolloff([k, k * 0.5, k * 0.2], 0);
    assert.ok(Math.max(...out) < 1, `never reaches 1 at ${k}x without budget`);
    assert.ok(Math.max(...out) > K, 'and never falls back below the knee');
  }
});

test('white is spent, not earned by brightness alone', () => {
  const drive = [6, 4.2, 1.8];
  const dim = S.inkRolloff(drive, 0.0);
  const some = S.inkRolloff(drive, 0.5);
  const open = S.inkRolloff(drive, 1.0);
  const sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
  assert.ok(sat(dim) > sat(some) && sat(some) > sat(open), 'budget monotonically bleaches');
  assert.ok(sat(open) < 0.06, 'a full budget does let the peak blow out');
  assert.ok(sat(dim) > 0.65, 'a closed budget keeps the whole colour');
  // the threshold is what makes it a budget: mild overdrive stays coloured even
  // when the budget is wide open, which is why a drop reads as a core and a rim
  assert.ok(sat(S.inkRolloff([1.2, 0.84, 0.36], 1.0)) > 0.5, 'a 1.2x field is not a whiteout');
});

test('the budget takes both a hot section and a hot moment', () => {
  const at = o => S.whiteBudget({ act: 1, ceil: 1, energy: 1, phase: 'peak', ...o });
  assert.ok(at({}) > 0.85, 'a real apex may bleach');
  assert.ok(at({ act: 0.15 }) < 0.15, 'a loud OVERTURE may not — the act refuses it');
  assert.ok(at({ ceil: 0.3 }) < 0.25, 'nor may a loud passage the structure caps');
  assert.ok(at({ energy: 0.2 }) < at({}) * 0.4, 'nor a quiet moment inside a hot act');
  assert.ok(at({ phase: 'break' }) < at({ phase: 'flow' }), 'a breakdown darkens');
  assert.ok(at({ calm: true }) < at({}) * 0.7, 'CALM never bleaches the field');
  // never outside its own rails, for any input anyone can hand it
  for (const a of [0, 0.5, 1]) for (const e of [0, 0.5, 1]) for (const c of [0, 0.5, 1])
    for (const p of ['flow', 'peak', 'break']){
      const w = S.whiteBudget({ act: a, ceil: c, energy: e, phase: p });
      assert.ok(w >= S.INK.whiteFloor - 1e-9 && w <= S.INK.whiteCeil + 1e-9, 'inside the rails');
    }
  assert.equal(S.whiteBudget(), S.whiteBudget({ act: 0.5, ceil: 1, energy: 0 }), 'sane with no input');
});

test('the shipped GLSL rolloff is the shipped JS rolloff', () => {
  // the shader knee is generated from INK.knee — a drift between them would be
  // invisible until a field went chalk on a device nobody in the room owns
  const src = html.match(/const GLSL_INK = `([\s\S]*?)`;/)[1];
  assert.ok(src.includes('${INK.knee'), 'the shader knee is GENERATED from INK, not typed twice');
  const glsl = new Function('INK', 'return `' + src + '`;')(S.INK);   // render it as it ships
  assert.ok(glsl.includes(`const float K = ${S.INK.knee.toFixed(4)};`), 'knee matches');
  assert.ok(glsl.includes(`const float D = ${(1 - S.INK.knee).toFixed(4)};`), 'shoulder matches');
  assert.ok(glsl.includes(`mix(${S.INK.wpDim.toFixed(2)}, ${S.INK.wpHot.toFixed(2)}, uWhite)`),
    'white points match');
  assert.ok(!/[0-9]\.[0-9]{3,}/.test(src.replace(/\$\{[^}]*\}/g, '')),
    'no tuning constant is hardcoded alongside the generated ones');
  assert.ok(/uniform float uWhite/.test(html.match(/const GLSL_MPHI = `([\s\S]*?)`/)[1]),
    'every scene shader can see the budget');
});

// ---------------------------------------------------------------- ramp (§ RAMP)

test('the ramp keeps chroma across the sweep where an RGB lerp loses it', () => {
  // two saturated, well-separated hues: the case that goes muddy halfway
  const plan = { scheme: 'complement', colors: [
    { l: 0.58, c: 0.22, h: 40 }, { l: 0.58, c: 0.22, h: 220 }, { l: 0.78, c: 0.12, h: 130 }] };
  const px = S.buildRamp(S.rampStops(plan, 'duo'), 64);
  const sat = i => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const m = Math.max(r, g, b);
    return m ? (m - Math.min(r, g, b)) / m : 0;
  };
  const A = S.oklchToRgb(0.58, 0.22, 40), B = S.oklchToRgb(0.58, 0.22, 220);
  const naive = [0, 1, 2].map(k => (A[k] + B[k]) / 2);      // what mix(a,b,0.5) gives
  const naiveSat = (Math.max(...naive) - Math.min(...naive)) / Math.max(...naive);
  assert.ok(sat(16) > naiveSat + 0.15, 'the quarter point beats the straight-line blend');
  let worst = 1;
  for (let i = 0; i < 64; i++) worst = Math.min(worst, sat(i));
  assert.ok(worst > 0.25, 'no point on the ramp goes grey');
});

test('the ramp is cyclic, opaque, and correctly sized for any stop count', () => {
  const plan = { scheme: 'triad', colors: [
    { l: 0.55, c: 0.2, h: 10 }, { l: 0.6, c: 0.18, h: 130 }, { l: 0.8, c: 0.12, h: 250 }] };
  for (const mode of ['auto', 'duo', 'spectrum']){
    const px = S.buildRamp(S.rampStops(plan, mode), 128);
    assert.equal(px.length, 128 * 4, mode + ' is RGBA and the right length');
    for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 255, mode + ' is opaque');
    // the seam: the last texel and the first must be neighbours, not strangers
    const d = Math.abs(px[0] - px[127 * 4]) + Math.abs(px[1] - px[127 * 4 + 1]) + Math.abs(px[2] - px[127 * 4 + 2]);
    assert.ok(d < 40, mode + ' wraps without a seam (' + d + ')');
  }
});

test('SPECTRUM is a full wheel anchored on the key, and stays rare', () => {
  const plan = { scheme: 'triad', colors: [
    { l: 0.55, c: 0.2, h: 200 }, { l: 0.6, c: 0.18, h: 320 }, { l: 0.8, c: 0.12, h: 80 }] };
  const stops = S.rampStops(plan, 'spectrum');
  const hues = stops.map(s => s.h);
  assert.equal(hues[0], 200, 'the sweep starts at the key’s own hue');
  const spanned = new Set(hues.map(h => Math.floor(h / 90))).size;
  assert.equal(spanned, 4, 'and covers every quadrant of the wheel');
  const bright = stops.reduce((a, s) => s.l > a.l ? s : a, stops[0]);
  assert.equal(bright.h, 200, 'the key’s hue is the bright point the rest falls away from');
  // the director only reaches for it when the material has genuinely come apart
  const base = { key: '5B', brightness: 0.4, act: 0.5, seed: 1 };
  assert.equal(S.colorPlan({ ...base, energy: 0.9, entropy: 0.9 }).scheme, 'spectrum');
  assert.equal(S.colorPlan({ ...base, energy: 0.9, entropy: 0.7 }).scheme, 'triad');
  assert.equal(S.colorPlan({ ...base, energy: 0.4, entropy: 0.9 }).scheme, 'triad');
});

test('the ramp carries the flash governor rather than escaping it', () => {
  const plan = { scheme: 'triad', colors: [
    { l: 0.7, c: 0.15, h: 40 }, { l: 0.7, c: 0.15, h: 160 }, { l: 0.7, c: 0.12, h: 280 }] };
  const stops = S.rampStops(plan, 'auto');
  const full = S.buildRamp(stops, 64, 1);
  const gated = S.buildRamp(stops, 64, 0.25);       // the governor allowed a quarter of the light
  let dimmer = 0;
  for (let i = 0; i < 64; i++){
    const a = full[i * 4] + full[i * 4 + 1] + full[i * 4 + 2];
    const b = gated[i * 4] + gated[i * 4 + 1] + gated[i * 4 + 2];
    if (b < a) dimmer++;
  }
  assert.equal(dimmer, 64, 'every texel obeys the gate, not just the three stops');
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
test('lens: only the hottest bright apex splits the light (prism)', () => {
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.95, major: true }), 'prism');
  // a tense peak at the same heat stays interference — agitation outranks electricity
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.95, major: false }), 'moire');
});
test('lens: an apex the section holds back gets tiled order, not full blast', () => {
  assert.equal(S.pickLens({ ceil: 0.65, act: 2, energy: 0.9, major: true }), 'tile');
  // …but below the hard gate it is still clean glass
  assert.equal(S.pickLens({ ceil: 0.50, act: 2, energy: 0.9, major: true }), 'none');
});
test('lens: a truly driving build rolls a wave; a comedown at the same energy stays iris', () => {
  assert.equal(S.pickLens({ ceil: 0.70, act: 1, energy: 0.8, major: true }), 'wave');
  assert.equal(S.pickLens({ ceil: 0.70, act: 3, energy: 0.8, major: true }), 'iris');
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

// ---- per-stem waveform: sample the envelopes, blend the source palette ----
test('stemsAt: no stems → null (caller falls back to the band split)', () => {
  assert.equal(S.stemsAt(null, 0.5), null);
});
test('stemsAt: samples each stem 0..1 across the track, clamped at the ends', () => {
  // "9" all the way → 1; "0" → 0; a ramp reads low at the start, high at the end
  const stems = { d: '99999', b: '00000', v: '00099', o: '5' };
  const mid = S.stemsAt(stems, 0.5);
  assert.ok(Math.abs(mid.d - 1) < 1e-6, 'full drums');
  assert.equal(mid.b, 0, 'silent bass');
  const start = S.stemsAt(stems, 0), end = S.stemsAt(stems, 1);
  assert.ok(start.v < end.v, 'the vocal ramp rises toward the end');
  assert.ok(Math.abs(end.v - 1) < 1e-6, 'clamps to the last digit at frac=1');
  assert.ok(Math.abs(S.stemsAt(stems, 0.5).o - 5 / 9) < 1e-6, 'a single-digit stem is constant');
});
test('stemRGB: the loudest source dominates the colour', () => {
  const drums = S.stemRGB({ d: 1, b: 0, v: 0, o: 0 });
  const vox = S.stemRGB({ d: 0, b: 0, v: 1, o: 0 });
  // drums run warm-red: red channel dominant; vocals run cyan: blue/green dominant
  assert.ok(drums[0] > drums[2], 'drums are red-forward');
  assert.ok(vox[2] > vox[0], 'vocals are blue-forward');
  assert.equal(S.stemRGB(null), null, 'no weights → null');
  // silence (all zero) is safe, not a divide-by-zero
  const zero = S.stemRGB({ d: 0, b: 0, v: 0, o: 0 });
  assert.ok(zero.every(c => isFinite(c)), 'all-silent blend is finite');
});

// ---- drop markers: read the build→drop boundaries from the structure ----
test('dropPoints: finds a build→loud boundary, strongest first', () => {
  const struct = { ok: true, sections: [
    { s: 0, e: 0.2, energy: 0.15, loud: false },   // quiet intro
    { s: 0.2, e: 0.45, energy: 0.35, loud: false }, // build
    { s: 0.45, e: 0.7, energy: 0.9, loud: true },   // DROP (big rise into loud)
    { s: 0.7, e: 0.82, energy: 0.3, loud: false },  // breakdown
    { s: 0.82, e: 1, energy: 0.75, loud: true },    // second drop (smaller rise)
  ] };
  const drops = S.dropPoints(struct);
  assert.ok(drops.length >= 1, 'at least the main drop');
  assert.ok(Math.abs(drops[0].at - 0.45) < 1e-9, 'the biggest drop is at the loud block');
  assert.ok(drops[0].strength >= drops[drops.length - 1].strength, 'sorted strongest first');
  assert.ok(drops.every(d => d.at >= 0 && d.at <= 1 && d.strength > 0 && d.strength <= 1), 'positions and strengths are normalized');
});
test('dropPoints: a flat or missing structure yields no markers', () => {
  assert.deepEqual(S.dropPoints(null), []);
  assert.deepEqual(S.dropPoints({ ok: false }), []);
  assert.deepEqual(S.dropPoints({ ok: true, sections: [{ s: 0, e: 1, energy: 0.5, loud: true }] }), []);
  // a gentle rise below the threshold is not a "drop"
  assert.deepEqual(S.dropPoints({ ok: true, sections: [
    { s: 0, e: 0.5, energy: 0.5, loud: false }, { s: 0.5, e: 1, energy: 0.6, loud: true }] }), []);
});
test('nextDropAfter: the first drop strictly ahead, else null', () => {
  const st = { ok: true, sections: [
    { s: 0, e: 0.2, energy: 0.1, loud: false },
    { s: 0.2, e: 0.45, energy: 0.9, loud: true },   // drop at 0.2
    { s: 0.45, e: 0.6, energy: 0.25, loud: false },
    { s: 0.6, e: 1, energy: 0.85, loud: true },     // drop at 0.6
  ] };
  assert.ok(Math.abs(S.nextDropAfter(st, 0) - 0.2) < 1e-9, 'from the top → first drop');
  assert.ok(Math.abs(S.nextDropAfter(st, 0.3) - 0.6) < 1e-9, 'past the first → the second');
  assert.equal(S.nextDropAfter(st, 0.7), null, 'past the last → none');
  assert.equal(S.nextDropAfter(null, 0), null, 'no structure → null');
});
test('sectionLabel: names where the playhead sits, structurally', () => {
  const st = { ok: true, sections: [
    { s: 0, e: 0.12, energy: 0.1, loud: false },   // intro
    { s: 0.12, e: 0.35, energy: 0.55, loud: true }, // build (loud, before peak)
    { s: 0.35, e: 0.5, energy: 0.95, loud: true },  // peak (loudest)
    { s: 0.5, e: 0.62, energy: 0.25, loud: false }, // break (quiet, middle)
    { s: 0.62, e: 0.85, energy: 0.7, loud: true },  // drive (loud, after peak)
    { s: 0.85, e: 1, energy: 0.12, loud: false },   // outro
  ] };
  assert.equal(S.sectionLabel(st, 0.05), 'intro');
  assert.equal(S.sectionLabel(st, 0.2), 'build');
  assert.equal(S.sectionLabel(st, 0.42), 'peak');
  assert.equal(S.sectionLabel(st, 0.55), 'break');
  assert.equal(S.sectionLabel(st, 0.7), 'drive');
  assert.equal(S.sectionLabel(st, 0.95), 'outro');
});
test('sectionLabel: empty without usable structure', () => {
  assert.equal(S.sectionLabel(null, 0.5), '');
  assert.equal(S.sectionLabel({ ok: false }, 0.5), '');
  assert.equal(S.sectionLabel({ ok: true, sections: [] }, 0.5), '');
});

// ---- capability memory: remember a device's proven render quality ----
test('qualitySigKey: same device → same key; a different display or class differs', () => {
  assert.equal(S.qualitySigKey(2, 8, false), S.qualitySigKey(2, 8, false));
  assert.notEqual(S.qualitySigKey(2, 8, false), S.qualitySigKey(3, 8, false));   // density
  assert.notEqual(S.qualitySigKey(2, 8, false), S.qualitySigKey(2, 8, true));    // iOS
  assert.equal(S.qualitySigKey(2, 999, false), S.qualitySigKey(2, 40, false));   // cores capped
});
test('quality memory: round-trips write → read for the matching device', () => {
  const now = 1_000_000, key = S.qualitySigKey(2, 8, false);
  const raw = S.writeQualityMemory(key, 1.35, false, now);
  const mem = S.readQualityMemory(raw, key, now + 1000, 120 * 864e5);
  assert.ok(mem && Math.abs(mem.pr - 1.35) < 1e-6 && mem.struggling === false);
});
test('quality memory: rejects a wrong device, corrupt, or stale record', () => {
  const now = 5_000_000, key = S.qualitySigKey(2, 8, false), other = S.qualitySigKey(3, 8, false);
  const raw = S.writeQualityMemory(key, 1.5, false, now);
  assert.equal(S.readQualityMemory(raw, other, now, 864e5), null, 'wrong device');
  assert.equal(S.readQualityMemory('not json', key, now, 864e5), null, 'corrupt');
  assert.equal(S.readQualityMemory(null, key, now, 864e5), null, 'empty');
  assert.equal(S.readQualityMemory(raw, key, now + 200 * 864e5, 120 * 864e5), null, 'stale');
});
test('qualitySeed: boots at proven quality, floors a strained device, defaults with no memory', () => {
  assert.deepEqual(S.qualitySeed(null, 1, 2, 1.5), { pr: 1.5, struggling: false });
  assert.deepEqual(S.qualitySeed({ pr: 1.7, struggling: false }, 1, 2, 2), { pr: 1.7, struggling: false });
  assert.deepEqual(S.qualitySeed({ pr: 0.9, struggling: true }, 1, 2, 2), { pr: 1, struggling: true });
  // a remembered ratio out of the current device's range is clamped
  assert.equal(S.qualitySeed({ pr: 3, struggling: false }, 1, 2, 2).pr, 2);
});

// ---- stem-aware transitions: never blend two voices ----
test('stemWindow: averages a stem envelope over a fractional window', () => {
  assert.equal(S.stemWindow('99999', 0, 1), 1);          // all full
  assert.equal(S.stemWindow('00000', 0, 1), 0);          // all silent
  assert.ok(S.stemWindow('000999', 0.6, 1) > 0.9, 'a fully-loud tail window reads high');
  assert.ok(S.stemWindow('999000', 0.6, 1) < 0.1, 'a silent tail window reads low');
  assert.equal(S.stemWindow('', 0, 1), 0);               // no data → 0
});
test('vocalClashBias: two voices edge-to-edge are penalized', () => {
  const vox = '9'.repeat(60), inst = '0'.repeat(60), beat = '9'.repeat(60);
  // A sings to the end, B sings from the start → clash → penalty
  const A = { mix: { stems: { sv: 1, v: vox, d: inst } } };
  const B = { mix: { stems: { sv: 1, v: vox, d: inst } } };
  assert.ok(S.vocalClashBias(A, B) < -0.05, 'overlapping voices are punished');
  // B enters instrumental (no voice) → no clash
  const Binst = { mix: { stems: { sv: 1, v: inst, d: beat } } };
  assert.ok(S.vocalClashBias(A, Binst) >= 0, 'an instrumental entry does not clash');
  // a drum-led entry earns a small reward
  assert.ok(S.vocalClashBias({ mix: { stems: { sv: 1, v: inst, d: inst } } }, Binst) > 0,
    'landing on drums is rewarded');
});
test('vocalClashBias: inert until both tracks are separated', () => {
  const sep = { mix: { stems: { sv: 1, v: '9'.repeat(60), d: '0'.repeat(60) } } };
  const raw = { mix: {} };
  assert.equal(S.vocalClashBias(sep, raw), 0, 'no stems on B → 0');
  assert.equal(S.vocalClashBias(raw, sep), 0, 'no stems on A → 0');
  assert.equal(S.vocalClashBias(null, sep), 0, 'null track → 0');
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

// ---------------------------------------------------------------- power plan

test('powerPlan AUTO matches the legacy governor bounds exactly', () => {
  const p = S.powerPlan('auto', 2, false);
  assert.equal(p.maxPR, 2); assert.equal(p.minPR, 1); assert.equal(p.pinPR, null);
  assert.equal(p.frameDiv, 1);
  assert.ok(p.lens && p.heavy && p.govern && p.remember && !p.wake);
  const ios = S.powerPlan('auto', 3, true);
  assert.equal(ios.maxPR, 2, 'auto caps at 2 even on a 3× display');
  assert.equal(ios.minPR, 0.9, 'iOS floor is 0.9');
});
test('powerPlan SHOW raises the ceiling, keeps the screen awake, never teaches AUTO', () => {
  const p = S.powerPlan('show', 3, false);
  assert.equal(p.maxPR, 3, 'the full display density is on the table');
  assert.equal(p.pinPR, 3, 'boots at the ceiling');
  assert.ok(p.govern, 'the governor still sheds under it — fluid outranks dense');
  assert.ok(p.wake && !p.remember && p.lens && p.heavy);
});
test('powerPlan ECO pins the floor, halves the draw, waves off the heavy work', () => {
  const p = S.powerPlan('eco', 3, false);
  assert.equal(p.maxPR, p.minPR); assert.equal(p.pinPR, p.minPR);
  assert.ok(p.pinPR <= 0.75, 'a quarter of the pixels or less vs 1.5×');
  assert.equal(p.frameDiv, 2, 'every other frame');
  assert.ok(!p.lens && !p.heavy && !p.govern && !p.remember && !p.wake);
});
test('powerPlan ECO never pins above a low-density display', () => {
  const p = S.powerPlan('eco', 0.6, false);
  assert.ok(p.pinPR <= 0.6 + 1e-9);
});
test('powerPlan falls back to AUTO on an unknown mode', () => {
  assert.deepEqual(S.powerPlan('warp', 2, false), S.powerPlan('auto', 2, false));
});

// ---------------------------------------------------------------- echoes

test('every quote is attributed, non-empty, and short enough to drift', () => {
  assert.ok(S.ECHO_QUOTES.length >= 40, 'a real pool');
  for (const q of S.ECHO_QUOTES){
    assert.ok(q.t && q.t.trim().length > 0, 'text');
    assert.ok(q.a && q.a.trim().length > 0, 'attribution');
    assert.ok(q.t.length <= 220, `drifts, not scrolls: ${q.a}`);
    assert.ok(['physics', 'math', 'stoic', 'music', 'wonder'].includes(q.p), 'a known pool');
  }
});
test('echoPick avoids the recent window and always lands in range', () => {
  const rng = S.mulberry32(11);
  const recent = [];
  for (let k = 0; k < 200; k++){
    const i = S.echoPick(10, recent, rng);
    assert.ok(i >= 0 && i < 10);
    assert.ok(!recent.slice(-9).includes(i), 'no repeat inside the window');
    recent.push(i); if (recent.length > 9) recent.shift();
  }
});
test('echoCompose is deterministic for a seed', () => {
  const a = S.echoCompose('I feel tired but hopeful', S.mulberry32(7));
  const b = S.echoCompose('I feel tired but hopeful', S.mulberry32(7));
  assert.deepEqual(a, b);
});
test('echoCompose answers the SHAPE of the text — question, brevity, flood, feeling', () => {
  const rng = () => S.mulberry32(3);
  assert.ok(S.ECHO_ACK.q.includes(S.echoCompose('why does this keep happening?', rng()).ack));
  assert.ok(S.ECHO_ACK.short.includes(S.echoCompose('just tired', rng()).ack));
  const flood = Array(45).fill('word').join(' ');
  assert.ok(S.ECHO_ACK.long.includes(S.echoCompose(flood, rng()).ack));
  assert.ok(S.ECHO_ACK.feel.includes(S.echoCompose('today I am somewhere between grateful and lonely honestly', rng()).ack));
});
test('the reply pools never flatter, never diagnose, never prescribe', () => {
  const all = [].concat(S.ECHO_ACK.q, S.ECHO_ACK.short, S.ECHO_ACK.long, S.ECHO_ACK.feel,
    S.ECHO_ACK.plain, S.ECHO_FRAGS, S.ECHO_TURN, S.ECHO_PROMPTS);
  for (const line of all){
    assert.ok(!/\b(diagnos|disorder|depress|anxiety disorder|you should|you must|amazing|brilliant|perfect)\b/i.test(line),
      `overclaims or judges: "${line}"`);
  }
});
test('echoSignals reads word count, questions and feelings honestly', () => {
  const s = S.echoSignals('am I lost?');
  assert.equal(s.words, 3); assert.ok(s.question && s.feeling && s.short && s.me);
  const empty = S.echoSignals('');
  assert.equal(empty.words, 0); assert.ok(!empty.short && !empty.long);
});

// ---------------------------------------------------------------- touch feel

test('touchCharge: commits toward 1 while held, drains fast on release', () => {
  let c = 0;
  for (let i = 0; i < 60; i++) c = S.touchCharge(c, 1 / 60, true);      // one second held
  assert.ok(c > 0.5 && c < 1, `a second of hold is felt but not full: ${c}`);
  let full = c;
  for (let i = 0; i < 240; i++) full = S.touchCharge(full, 1 / 60, true);
  assert.ok(full > 0.95, `four more seconds saturates: ${full}`);
  let drained = full;
  for (let i = 0; i < 60; i++) drained = S.touchCharge(drained, 1 / 60, false);
  assert.ok(drained < 0.05, `a second after release it is gone: ${drained}`);
});
test('touchBurst: a graze is silent, a hold detonates, a flick detonates without the hold', () => {
  assert.equal(S.touchBurst(0.05, 0.1), 0, 'a tap-and-drift costs nothing');
  const held = S.touchBurst(1, 0);
  assert.ok(held >= 0.95, `a full hold is a full detonation: ${held}`);
  const slung = S.touchBurst(0, 1);
  assert.ok(slung > 0.7, `a hard flick detonates on speed alone: ${slung}`);
  assert.ok(S.touchBurst(0.5, 0.2) > S.touchBurst(0.2, 0.2), 'more hold, more boom');
});
test('beatTapBonus: full exactly on the beat, zero off the window, symmetric', () => {
  assert.equal(S.beatTapBonus(0), 1);
  assert.equal(S.beatTapBonus(1), 1);
  assert.equal(S.beatTapBonus(0.5), 0);
  assert.ok(Math.abs(S.beatTapBonus(0.1) - S.beatTapBonus(0.9)) < 1e-9, 'early and late are equals');
  assert.ok(S.beatTapBonus(0.05) > 0.6 && S.beatTapBonus(0.14) < 0.1, 'the window is tight');
  assert.equal(S.beatTapBonus(-0.2), 0); assert.equal(S.beatTapBonus(NaN), 0);
});
test('touchAffinity: every scene resolves to a real personality', () => {
  const KEYS = ['blackhole', 'grows', 'gathers', 'flows'];
  for (let sc = 0; sc < 16; sc++)
    for (const act of [-1, 0, 1, 2, 3, 4])
      for (const r of [0.01, 0.3, 0.6, 0.86, 0.99])
        assert.ok(KEYS.includes(S.touchAffinity(sc, act, r)), `scene ${sc} act ${act} r ${r}`);
});
test('touchAffinity: the map has taste — spirals spin, tunnels void, apex never ripples', () => {
  assert.equal(S.touchAffinity(0, 1, 0.5), 'grows', 'the spiral wants SPIN');
  assert.equal(S.touchAffinity(5, 1, 0.5), 'blackhole', 'the tunnel wants the VOID');
  assert.equal(S.touchAffinity(8, 1, 0.5), 'gathers', 'comets want the PULL');
  assert.notEqual(S.touchAffinity(4, 2, 0.3), 'flows', 'the apex does not ripple');
  assert.equal(S.touchAffinity(999, 1, 0.5), 'grows', 'an unknown scene falls back to scene 0’s map entry');
});
test('touchAutoShould: never under a live finger, never before the dwell, only usually', () => {
  assert.ok(!S.touchAutoShould(10, true, 0.1), 'too soon');
  assert.ok(!S.touchAutoShould(90, false, 0.1), 'hand is on the field');
  assert.ok(S.touchAutoShould(90, true, 0.1), 'due, hand off, dice agree');
  assert.ok(!S.touchAutoShould(90, true, 0.9), 'even then, only usually');
});

// ---------------------------------------------------------------- self-update

test('updateGate: not ready or already requested → wait', () => {
  assert.equal(S.updateGate({ ready: false, playing: false, now: 0 }), 'wait');
  assert.equal(S.updateGate({ ready: true, requested: true, playing: false, now: 0 }), 'wait');
});
test('updateGate: idle applies, playing waits', () => {
  assert.equal(S.updateGate({ ready: true, playing: false, now: 0 }), 'apply');
  assert.equal(S.updateGate({ ready: true, playing: true, now: 0 }), 'wait');
});
test('updateGate: SHOW mode is never yanked, even paused', () => {
  assert.equal(S.updateGate({ ready: true, playing: false, show: true, now: 0 }), 'wait');
});
test('updateGate: a snooze holds auto-apply until it lapses', () => {
  assert.equal(S.updateGate({ ready: true, playing: false, snoozedUntil: 100, now: 50 }), 'wait');
  assert.equal(S.updateGate({ ready: true, playing: false, snoozedUntil: 100, now: 150 }), 'apply');
});
test('updateGate: "after this track" fires at the boundary or the pause — above snooze and SHOW', () => {
  const base = { ready: true, armed: 'afterTrack', snoozedUntil: 9e9, show: true, now: 0 };
  assert.equal(S.updateGate({ ...base, playing: true, trackChanged: false }), 'wait', 'mid-track holds');
  assert.equal(S.updateGate({ ...base, playing: true, trackChanged: true }), 'apply', 'the boundary fires');
  assert.equal(S.updateGate({ ...base, playing: false, trackChanged: false }), 'apply', 'the pause fires');
});
test('newsSince: walks newest-first until the running build, exclusive, capped', () => {
  const entries = [{ build: 'd' }, { build: 'c' }, { build: 'b' }, { build: 'a' }];
  assert.deepEqual(S.newsSince(entries, 'b').map(e => e.build), ['d', 'c']);
  assert.deepEqual(S.newsSince(entries, 'd').map(e => e.build), [], 'current build → no news');
  assert.deepEqual(S.newsSince(entries, 'unknown').map(e => e.build), ['d', 'c', 'b', 'a'], 'unknown build shows the newest few');
  assert.deepEqual(S.newsSince(entries, 'unknown', 2).map(e => e.build), ['d', 'c'], 'the cap holds');
  assert.deepEqual(S.newsSince(null, 'x'), [], 'no entries, no crash');
});

// ------------------------------------------------ update progress + watchdog

test('updateProgress: starts at zero, rises, never reaches the cap', () => {
  assert.equal(S.updateProgress(0, 4000), 0);
  const early = S.updateProgress(1000, 4000);
  const late = S.updateProgress(4000, 4000);
  assert.ok(early > 0.2, 'moves early');
  assert.ok(late > early, 'keeps rising');
  assert.ok(S.updateProgress(1e9, 4000) <= S.UP_EST.cap, 'a stuck swap never claims done');
});
test('updateProgress: monotone — never below the previous frame', () => {
  // a clock stepping backward mid-swap must not walk the bar backward
  assert.equal(S.updateProgress(100, 4000, 0.8), 0.8);
  assert.ok(S.updateProgress(8000, 4000, 0.5) > 0.5);
});
test('updateProgress: garbage in, safe motion out', () => {
  for (const bad of [NaN, -5, Infinity, 'x', null, undefined]){
    const f = S.updateProgress(bad, bad, bad);
    assert.ok(Number.isFinite(f) && f >= 0 && f <= S.UP_EST.cap, 'elapsed/estimate/prev = ' + bad);
  }
  // estimate of 0 or negative falls back to the default curve, still finite
  assert.ok(Number.isFinite(S.updateProgress(2000, 0)));
  assert.ok(Number.isFinite(S.updateProgress(2000, -100)));
});
test('updateEstimate: default with no history, blends, clamps absurd samples', () => {
  assert.equal(S.updateEstimate(null, null), S.UP_EST.def, 'no history → default');
  assert.equal(S.updateEstimate('garbage', NaN), S.UP_EST.def, 'poisoned storage → default');
  const learned = S.updateEstimate(4000, 8000);
  assert.ok(learned > 4000 && learned < 8000, 'a slow swap raises the estimate partway');
  assert.ok(S.updateEstimate(4000, 1e9) <= S.UP_EST.max, 'a frozen-overnight sample is clamped');
  assert.ok(S.updateEstimate(4000, 1) >= S.UP_EST.min, 'an instant sample is clamped');
  assert.ok(S.updateEstimate(1e9, 4000) <= Math.round(S.UP_EST.max * 0.6 + 4000 * 0.4), 'a poisoned prior is clamped before blending');
});
test('updateWatchdogStep: waits, then escalating reloads, then recovery', () => {
  assert.equal(S.updateWatchdogStep(1000, 0), 'wait', 'healthy first second');
  assert.equal(S.updateWatchdogStep(3100, 0), 'reload', 'first nudge at 3 s');
  assert.equal(S.updateWatchdogStep(4000, 1), 'wait', 'stage two not due yet');
  assert.equal(S.updateWatchdogStep(5600, 1), 'reload', 'second nudge at 5.5 s');
  assert.equal(S.updateWatchdogStep(8100, 2), 'reload', 'third nudge at 8 s');
  assert.equal(S.updateWatchdogStep(9000, 3), 'recover', 'three refusals → hand the app back');
});
test('updateWatchdogStep: a broken clock reads as wait, never a panic reload', () => {
  assert.equal(S.updateWatchdogStep(NaN, 0), 'wait');
  assert.equal(S.updateWatchdogStep(-500, 0), 'wait');
  assert.equal(S.updateWatchdogStep(NaN, 3), 'recover', 'recovery still fires on attempts alone');
});

test('updateGate: the loop brake stops AUTOMATIC swaps, never a deliberate one', () => {
  const base = { ready: true, requested: false, armed: '', playing: false, show: false,
    snoozedUntil: 0, now: 1000 };
  assert.equal(S.updateGate(base), 'apply', 'a quiet moment applies');
  assert.equal(S.updateGate({ ...base, applies: S.UP_APPLY_CAP - 1 }), 'apply', 'under the cap, still automatic');
  assert.equal(S.updateGate({ ...base, applies: S.UP_APPLY_CAP }), 'wait', 'at the cap, stand down');
  assert.equal(S.updateGate({ ...base, applies: 99 }), 'wait');
  // an explicit "after this track" wish is the listener's, and outranks the brake
  assert.equal(S.updateGate({ ...base, applies: 99, armed: 'afterTrack', trackChanged: true }), 'apply',
    'a wish the listener expressed is not rate-limited');
  // junk from a poisoned sessionStorage reads as zero, not as a lock-out
  for (const bad of [undefined, null, NaN, 'x', -1])
    assert.equal(S.updateGate({ ...base, applies: bad }), 'apply', 'sane for ' + bad);
});

// ------------------------------------------------- "later", and the receipt

test('updateReminder: a deferral is remembered and shown back as a count', () => {
  const now = 1_000_000;
  const fresh = S.updateReminder({ now, snoozedUntil: 0, deferrals: 0, pending: true });
  assert.equal(fresh.badge, '•', 'a waiting update wears a dot');
  assert.equal(fresh.snoozed, false);
  assert.equal(fresh.due, false, 'nothing to remind about before anyone defers');
  const once = S.updateReminder({ now, snoozedUntil: now + S.UP_SNOOZE_MS, deferrals: 1, pending: true });
  assert.equal(once.badge, '1', 'the count is the badge');
  assert.equal(once.snoozed, true);
  assert.equal(once.due, false, 'silent while the snooze they asked for holds');
  assert.ok(once.waitMs > 0 && once.waitMs <= S.UP_SNOOZE_MS);
  const thrice = S.updateReminder({ now, snoozedUntil: now + 10, deferrals: 3, pending: true });
  assert.equal(thrice.badge, '3');
  // nothing pending and nothing deferred: no badge at all
  assert.equal(S.updateReminder({ now, pending: false }).badge, '');
});

test('updateReminder: the reminder fires once per expiry, then stops nagging', () => {
  const until = 500_000;
  const expired = { now: until + 1, snoozedUntil: until, deferrals: 2, lastRemindAt: 0, pending: true };
  assert.equal(S.updateReminder(expired).due, true, 'the snooze ran out — say so');
  // once answered, the same expiry never fires again (a double reload is not
  // two reminders)
  assert.equal(S.updateReminder({ ...expired, lastRemindAt: until }).due, false);
  // ...but the NEXT deferral's expiry is a new promise, so it does
  assert.equal(S.updateReminder({ now: until + 999, snoozedUntil: until + 900,
    deferrals: 3, lastRemindAt: until, pending: true }).due, true);
  // someone who has said "later" this many times has told us something
  assert.equal(S.updateReminder({ ...expired, deferrals: S.UP_NAG_CAP }).due, true, 'at the cap, still one nudge');
  assert.equal(S.updateReminder({ ...expired, deferrals: S.UP_NAG_CAP + 1 }).due, false, 'past it, badge only');
  assert.equal(S.updateReminder({ ...expired, deferrals: 99 }).badge, '99', 'the badge never gives up');
});

test('updateReminder: junk in the store cannot break the button', () => {
  for (const bad of [undefined, null, {}, { now: NaN, snoozedUntil: NaN, deferrals: NaN },
    { now: 0, snoozedUntil: -1, deferrals: -5 }, { deferrals: 1e9, now: 1, snoozedUntil: 'x' }]){
    const r = S.updateReminder(bad);
    assert.ok(typeof r.badge === 'string', 'always a string badge');
    assert.ok(typeof r.due === 'boolean' && typeof r.snoozed === 'boolean');
    assert.ok(r.deferrals >= 0 && r.deferrals <= 99, 'deferrals stay sane: ' + r.deferrals);
    assert.ok(r.waitMs >= 0);
  }
});

test('activityPush: newest first, bounded, and repeats coalesce into a count', () => {
  let l = [];
  l = S.activityPush(l, { t: 1, k: 'play', m: 'One' });
  l = S.activityPush(l, { t: 2, k: 'play', m: 'Two' });
  assert.deepEqual(l.map(e => e.m), ['Two', 'One'], 'newest first');
  l = S.activityPush(l, { t: 3, k: 'play', m: 'Two' });
  l = S.activityPush(l, { t: 9, k: 'play', m: 'Two' });
  assert.equal(l.length, 2, 'a repeat does not add a row');
  assert.equal(l[0].n, 3, 'it counts');
  assert.equal(l[0].t, 9, 'and carries the latest time');
  // the same text under a different kind is a different event
  l = S.activityPush(l, { t: 10, k: 'system', m: 'Two' });
  assert.equal(l.length, 3);
  // a blank line is not an event
  assert.equal(S.activityPush(l, { t: 11, m: '' }).length, 3);
  // the cap holds, and the oldest is what goes
  let big = [];
  for (let i = 0; i < 40; i++) big = S.activityPush(big, { t: i, k: 'play', m: 'T' + i }, 10);
  assert.equal(big.length, 10);
  assert.equal(big[0].m, 'T39');
  assert.equal(big[9].m, 'T30', 'the oldest fell off the end');
  // and the caller's array is never mutated under them
  const before = [{ t: 1, k: 'play', m: 'X' }];
  const after = S.activityPush(before, { t: 2, k: 'play', m: 'X' });
  assert.equal(before[0].n, undefined, 'the input is left alone');
  assert.equal(after[0].n, 2);
});

test('activityPush: a poisoned store cannot break the log', () => {
  assert.deepEqual(S.activityPush(null, { t: 1, k: 'play', m: 'A' }).map(e => e.m), ['A']);
  assert.deepEqual(S.activityPush('nonsense', { t: 1, k: 'play', m: 'A' }).map(e => e.m), ['A']);
  const e = S.activityPush([], { t: 'x', m: 'A' })[0];
  assert.equal(e.t, 0, 'a bad timestamp reads as unknown, not NaN');
  assert.equal(e.k, 'system', 'a missing kind falls back');
  assert.ok(S.activityPush([], { m: 'x'.repeat(500) })[0].m.length <= 200, 'a runaway line is trimmed');
  assert.equal(S.activityPush([], { m: 'A' }, 0).length, 1, 'a zero cap still keeps one');
  assert.ok(S.activityPush([], { m: 'A' }, 1e9).length === 1);
});

test('activityAgo: the shortest honest phrase, never a broken one', () => {
  assert.equal(S.activityAgo(0), 'just now');
  assert.equal(S.activityAgo(44_000), 'just now');
  assert.equal(S.activityAgo(90_000), '2 min ago');
  assert.equal(S.activityAgo(3600_000), '1 h ago');
  assert.equal(S.activityAgo(5 * 3600_000), '5 h ago');
  assert.equal(S.activityAgo(3 * 86400_000), '3 d ago');
  for (const bad of [NaN, -1, undefined, null, 'x', Infinity])
    assert.ok(/just now|min ago|h ago|d ago/.test(S.activityAgo(bad)), 'sane for ' + bad);
});

// ---------------------------------------------------------------- skins

test('SKINS: every skin is a full outfit with unique keys, original first', () => {
  assert.equal(S.SKINS[0].key, 'obsidian', 'the shipped look leads');
  const keys = new Set();
  for (const s of S.SKINS){
    keys.add(s.key);
    for (const f of ['void', 'panel', 'panelHard', 'ink', 'dim', 'faint', 'lineC', 'pi', 'e', 'beat', 'accent', 'accent2', 'accentInk'])
      assert.ok(S.skinHexRgb(s[f]), s.key + '.' + f + ' must be a parseable hex colour');
    assert.ok(s.name && s.note, s.key + ' has a name and a note');
  }
  assert.equal(keys.size, S.SKINS.length, 'no duplicate keys');
});
test('skinResolve: unknown, null, garbage all land on the original', () => {
  assert.equal(S.skinResolve('velvet').key, 'velvet');
  assert.equal(S.skinResolve('no-such-skin').key, 'obsidian');
  assert.equal(S.skinResolve(null).key, 'obsidian');
  assert.equal(S.skinResolve({ evil: true }).key, 'obsidian');
  assert.equal(S.skinResolve('x', []).key, 'obsidian', 'an empty list falls back to SKINS');
});
test('skinCss: full variable coverage, well-formed colours', () => {
  for (const s of S.SKINS){
    const css = S.skinCss(s, S.SKINS[0]);
    for (const v of ['--void', '--card', '--glass', '--glass-hard', '--ink', '--dim', '--faint', '--line', '--line-soft',
      '--pi', '--e', '--beat', '--pi-dim', '--e-dim', '--accent', '--accent-2', '--accent-ink',
      '--accent-dim', '--accent-glow', '--accent-line'])
      assert.ok(/^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,0?\.\d+\))$/i.test(css[v]), s.key + ' ' + v + ' = ' + css[v]);
  }
});
test('skinCss: a poisoned skin falls back slot-by-slot, never unreadable', () => {
  const bad = { key: 'bad', void: 'purple-ish', ink: null, pi: '#ffb454' };
  const css = S.skinCss(bad, S.SKINS[0]);
  const base = S.skinCss(S.SKINS[0], S.SKINS[0]);
  assert.equal(css['--void'], base['--void'], 'unparseable void → original void');
  assert.equal(css['--ink'], base['--ink'], 'missing ink → original ink');
  assert.equal(css['--pi'], '#ffb454', 'the one good colour survives');
  assert.deepEqual(S.skinCss(null, S.SKINS[0]), base, 'no skin at all → the original outfit');
});

// ---------------------------------------------------------- the seam (@mix)

test('equalPowerXfade: constant acoustic power across the whole blend', () => {
  for (let i = 0; i <= 20; i++){
    const f = i / 20, g = S.equalPowerXfade(f);
    assert.ok(Math.abs(g.a * g.a + g.b * g.b - 1) < 1e-9, `a^2+b^2==1 at f=${f}`);
  }
  const s = S.equalPowerXfade(0), e = S.equalPowerXfade(1);
  assert.ok(Math.abs(s.a - 1) < 1e-9 && s.b < 1e-9, 'start: outgoing full, incoming silent');
  assert.ok(e.a < 1e-9 && Math.abs(e.b - 1) < 1e-9, 'end: outgoing silent, incoming full');
  assert.deepEqual(S.equalPowerXfade(-1), S.equalPowerXfade(0), 'clamps below 0');
  assert.deepEqual(S.equalPowerXfade(2), S.equalPowerXfade(1), 'clamps above 1');
});

test('xfadeCurve: monotonic, norm-scaled, correct endpoints per side', () => {
  const out = S.xfadeCurve(0.8, 'out', 32), inc = S.xfadeCurve(0.5, 'in', 32);
  assert.equal(out.length, 32); assert.equal(inc.length, 32);
  assert.ok(Math.abs(out[0] - 0.8) < 1e-6 && Math.abs(out[31]) < 1e-6, 'out: norm → 0');
  assert.ok(Math.abs(inc[0]) < 1e-6 && Math.abs(inc[31] - 0.5) < 1e-6, 'in: 0 → norm');
  for (let i = 1; i < 32; i++){
    assert.ok(out[i] <= out[i - 1] + 1e-9, 'out is non-increasing');
    assert.ok(inc[i] >= inc[i - 1] - 1e-9, 'in is non-decreasing');
  }
  // the two sides, at equal norm, still sum to constant power sample-for-sample
  const a = S.xfadeCurve(1, 'out', 16), b = S.xfadeCurve(1, 'in', 16);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(a[i] * a[i] + b[i] * b[i] - 1) < 1e-6, 'equal-power curve');  // Float32 storage
  assert.ok(S.xfadeCurve(0, 'in', 8)[7] > 0, 'a zero/garbage norm falls back to unity, never silence');
});

test('seamPhaseTrim: never seeks an audible deck; tempo-only once heard', () => {
  // big error while the incoming is still inaudible (f≈0) → a hard align is allowed
  const early = S.seamPhaseTrim(0.05, 0, 0.0);
  assert.equal(early.seek, true, 'inaudible + large error → one hard align');
  // the SAME big error once the blend is audible → never a seek, tempo trim only
  const mid = S.seamPhaseTrim(0.05, 0, 0.35);
  assert.equal(mid.seek, false, 'audible deck is never seeked');
  assert.ok(mid.trim !== 0, 'it still corrects — via playbackRate');
  // inside the deadband → hold the integrator, no thrash
  const locked = S.seamPhaseTrim(0.001, 0.0007, 0.6);
  assert.equal(locked.seek, false);
  assert.equal(locked.trim, 0.0007, 'in lock: integrator only');
  // the integrator is bounded so a persistent error can't run the tempo away
  let ti = 0;
  for (let k = 0; k < 500; k++) ti = S.seamPhaseTrim(0.05, ti, 0.5).trimI;
  assert.ok(Math.abs(ti) <= 0.002 + 1e-9, 'integrator stays capped at ±0.2%');
});

// ---- ready means ready: no seam starts on a stream that can't carry it ----
const ranges = list => ({ length: list.length, start: i => list[i][0], end: i => list[i][1] });

test('seamBuffered: only the range CONTAINING the entry point can carry the seam', () => {
  assert.equal(S.seamBuffered(ranges([[0, 30]]), 10, 8), true, 'covered → ready');
  assert.equal(S.seamBuffered(ranges([[0, 30]]), 25, 8), false, 'runs off the end of the buffer');
  // bytes exist further along, but we would stall before ever reaching them
  assert.equal(S.seamBuffered(ranges([[0, 5], [60, 200]]), 10, 8), false, 'a later island is not coverage');
  assert.equal(S.seamBuffered(ranges([[60, 200]]), 60, 8), true, 'entry at a range start counts');
  assert.equal(S.seamBuffered(ranges([]), 0, 8), false, 'nothing buffered → not ready');
  assert.equal(S.seamBuffered(null, 0, 8), false, 'no ranges object → not ready');
});
test('seamStreamReady: HAVE_CURRENT_DATA is never enough for a beatmix', () => {
  const buffered = ranges([[0, 200]]);
  // readyState 2 promises only the frame under the playhead — the old bug
  assert.equal(S.seamStreamReady({ type: 'beatmix', readyState: 2, buffered, from: 10, need: 8 }), false);
  assert.equal(S.seamStreamReady({ type: 'beatmix', readyState: 3, buffered, from: 10, need: 8 }), true);
  // HAVE_FUTURE_DATA but the bytes for THIS window aren't there → wait
  assert.equal(S.seamStreamReady({ type: 'beatmix', readyState: 3, buffered: ranges([[0, 12]]), from: 10, need: 8 }), false);
  // the browser's own play-through promise stands in for visible bytes
  assert.equal(S.seamStreamReady({ type: 'beatmix', readyState: 4, buffered: ranges([]), from: 10, need: 8 }), true);
  // a fade streams one deck from its start: readyState alone decides
  assert.equal(S.seamStreamReady({ type: 'fade', readyState: 3, buffered: ranges([]) }), true);
  assert.equal(S.seamStreamReady({ type: 'fade', readyState: 2, buffered }), false);
  assert.equal(S.seamStreamReady(null), false, 'garbage in → not ready');
});
test('seamDeferBar: take another eight — a whole bar later, B entering where it always was', () => {
  const plan = { type: 'beatmix', beats: 16, bpmA: 120, bpmB: 120, startA: 100, startB: 8 };
  const a = S.seamDeferBar(plan, 300);
  assert.equal(a.startA, 102, 'one bar of A at 120bpm = 2 s later');
  assert.equal(a.startB, 8, "B's entry never moves — the wait buys buffer for THAT window");
  assert.equal(a.deferred, 1);
  assert.equal(a.beats, 16, 'the blend itself is unchanged');
  // bounded: a stream this slow must fall back honestly rather than wait forever
  let p = plan, n = 0;
  while (p && n < 20){ p = S.seamDeferBar(p, 300); n++; }
  assert.ok(n <= 5, 'deferral is bounded, got ' + n);
  // never past the runway the overlap needs: a bar later, the 8 s blend would
  // run off the end of a 300 s track
  assert.ok(S.seamDeferBar({ ...plan, startA: 270 }, 300), 'still fits → wait');
  assert.equal(S.seamDeferBar({ ...plan, startA: 292 }, 300), null, 'no room left → stop waiting');
  // only beatmix defers; a fade has nothing to align to
  assert.equal(S.seamDeferBar({ type: 'fade', seconds: 3 }, 300), null);
});
test('seamEntry: a late call places a CORRECT seam, not a punctual wrong one', () => {
  const plan = { type: 'beatmix', beats: 8, bpmA: 124, bpmB: 124, startA: 100, startB: 8, seconds: 3.87 };
  // on time: B enters exactly where the plan said
  assert.equal(S.seamEntry(plan, 100), 8);
  // THE FIX. The renderer stalled the loop for one 114 ms frame, so A is already
  // past its bar line — B must enter 114 ms into its own material for the two
  // grids to agree. Dropping it at startB instead is a quarter-beat flam at
  // 124 bpm, which is exactly the glitch the probe measured.
  const slipped = S.seamEntry(plan, 100.114);
  assert.ok(Math.abs(slipped - 8.114) < 1e-9, 'B carries A\'s slip, got ' + slipped);
  const spb = 60 / 124;
  const phaseErr = ((slipped - plan.startB) - (100.114 - plan.startA)) / spb;
  assert.ok(Math.abs(phaseErr) < 1e-9, 'the grids agree to the sample');
  // a whole beat late is still a valid seam — the correction is not periodic,
  // it is the honest offset, so even a badly late call locks
  assert.ok(Math.abs(S.seamEntry(plan, 100 + spb) - (8 + spb)) < 1e-9);
  // clamped: past a whole seam the plan is stale rather than late, and B must
  // not be flung deep into a track it was cued to enter at the top of
  assert.equal(S.seamEntry(plan, 100 + 60), 8 + 3.87);
  // EARLY is the normal case, not an anomaly: a beatmix is triggered a lead-in
  // early on purpose, so B is placed a lead-in before its entry and arrives on
  // it exactly as the fader opens. Bounded by the lead — an absurdly early call
  // still only backs B up by the lead it was given.
  assert.ok(Math.abs(S.seamEntry(plan, 100 - S.SEAM_LEAD) - (8 - S.SEAM_LEAD)) < 1e-9);
  assert.ok(Math.abs(S.seamEntry(plan, 99) - (8 - S.SEAM_LEAD)) < 1e-9);
  // B can never be rolled from before the start of its own file
  assert.equal(S.seamEntry({ type: 'beatmix', startA: 100, startB: 0, seconds: 4 }, 99), 0);
  assert.equal(S.seamEntry(null, 10), 0, 'garbage in → the top of the file');
});
test('seamLeadFor: every seam gets the lead-in it can honestly afford', () => {
  assert.equal(S.seamLeadFor({ type: 'beatmix', startB: 8 }), S.SEAM_LEAD, 'plenty of runway');
  assert.equal(S.seamLeadFor({ type: 'beatmix', startB: 0.1 }), 0.1, 'cued near the top → a short lead');
  assert.equal(S.seamLeadFor({ type: 'beatmix', startB: 0 }), 0, 'no runway → no lead, honestly');
  assert.equal(S.seamLeadFor({ type: 'gapless' }), 0, 'the artist sequenced those two to touch');
  assert.equal(S.seamLeadFor({ type: 'fade', seconds: 3 }), S.SEAM_LEAD, 'a fade has no bar line to hit');
  assert.equal(S.seamLeadFor(null), S.SEAM_LEAD);
  assert.equal(S.seamLeadFor({ type: 'beatmix', startB: 8 }, 0), 0, 'a lead can be waived');
});

// ------------------------------------------------- transition style (@style)

test('resolveMixStyle: the three feels, and a safe default', () => {
  assert.equal(S.resolveMixStyle('club').beats, 16, 'club asks for a longer blend');
  assert.equal(S.resolveMixStyle('musical').beatmix, false, 'musical never beatmixes mid-song');
  assert.equal(S.resolveMixStyle('adaptive').beats, 8, 'adaptive is the 8-beat house default');
  assert.equal(S.resolveMixStyle('nonsense'), S.MIX_STYLES.adaptive, 'garbage → adaptive');
  assert.deepEqual([...S.MIX_STYLE_ORDER].sort(), ['adaptive', 'club', 'musical'], 'exactly three styles cycle');
});

test('stylePlanOpts: club forces 16 beats; others leave the default; fade length tracks the style', () => {
  assert.equal(S.stylePlanOpts('club', {}).forceBeats, 16);
  assert.equal(S.stylePlanOpts('adaptive', {}).forceBeats, undefined, 'adaptive leaves planTransition on its 8-beat default');
  assert.equal(S.stylePlanOpts('musical', {}).fadeSeconds, S.MIX_STYLES.musical.quickFade);
  // never clobbers the caller's opts
  const o = S.stylePlanOpts('club', { albumSequential: true, override: { x: 1 } });
  assert.equal(o.albumSequential, true); assert.deepEqual(o.override, { x: 1 });
});

test('styleAdjustPlan: musical turns a mid-song beatmix into a play-out fade; others untouched', () => {
  const bm = { type: 'beatmix', beats: 8, startA: 100, bpmA: 120, bpmB: 120 };
  const m = S.styleAdjustPlan('musical', bm);
  assert.equal(m.type, 'fade', 'musical never beatmixes');
  assert.equal(m.seconds, S.MIX_STYLES.musical.quickFade);
  assert.equal(S.styleAdjustPlan('club', bm).type, 'beatmix', 'club keeps the beatmix');
  assert.equal(S.styleAdjustPlan('adaptive', bm).type, 'beatmix', 'adaptive keeps the beatmix');
  // gapless (album order) is sacred in every style
  assert.equal(S.styleAdjustPlan('musical', { type: 'gapless' }).type, 'gapless');
});

test('styleExitBase: musical rides to the end; adaptive mixes out early at the last loud block', () => {
  const dur = 200, fade = { type: 'fade', seconds: 4 };
  const structure = { ok: true, mixOut: 0.80 };                 // last loud block at 160 s
  // adaptive: exit early at mixOut (160), like a DJ
  assert.equal(S.styleExitBase('adaptive', fade, dur, structure), 160);
  // musical: ignore the early mix-out, ride to the natural fade point (dur - seconds = 196)
  assert.equal(S.styleExitBase('musical', fade, dur, structure), dur - 4);
  // beatmix always leaves on its grid seam, regardless of style
  assert.equal(S.styleExitBase('club', { type: 'beatmix', startA: 123 }, dur), 123);
  // no structure → the plain base for everyone
  assert.equal(S.styleExitBase('adaptive', fade, dur, null), dur - 4);
});

/* ---- THE FABRIC ------------------------------------------------------------
   These hold the metric the hand bends, and they exist because two consumers
   read it: the point shaders displace real particles through it, and a
   full-screen pass refracts the composited frame through it. The GLSL is
   generated from the same constants and checked against these functions on the
   GPU by tools/touch_probe.mjs, so a change here that the shader does not
   follow is caught rather than shipped. */
test('warpSoft: exact for a small deflection, bounded for a large one', () => {
  // the far field must keep the TRUE 1/r tail — that long reach is most of why
  // the deformation reads as space rather than as a brush, so the clip has to be
  // invisible out there
  assert.ok(Math.abs(S.warpSoft(0.001, 0.2) - 0.001) < 2e-5, 'small values pass through');
  assert.ok(Math.abs(S.warpSoft(-0.001, 0.2) + 0.001) < 2e-5, 'and they keep their sign');
  // and it must never exceed the ceiling, however absurd the input. Real 1/b
  // deflection diverges at the centre; a screen cannot survive that (measured:
  // 1.6 screen radii of displacement, the frame annihilated)
  for (const x of [0.5, 5, 500, 1e6, -1e6])
    assert.ok(Math.abs(S.warpSoft(x, 0.2)) < 0.2, 'bounded at ' + x);
  assert.ok(S.warpSoft(1e6, 0.2) > 0.199, 'and it does reach the ceiling');
  assert.equal(S.warpSoft(0, 0.2), 0, 'no hand, no deflection');
  // monotone: a stronger cause must never produce a weaker effect
  let prev = -Infinity;
  for (let x = 0; x < 3; x += 0.05){
    const v = S.warpSoft(x, 0.2);
    assert.ok(v >= prev - 1e-12, 'monotone at ' + x.toFixed(2));
    prev = v;
  }
});
test('warpReach: still under the hand, still in the corners, smooth between', () => {
  assert.ok(Math.abs(S.warpReach(0, 0.8) - 1) < 1e-9, 'full under the hand');
  assert.equal(S.warpReach(0.8, 0.8), 0, 'zero at the reach');
  assert.equal(S.warpReach(2, 0.8), 0, 'and beyond it — the far corners do not swim');
  // C1 at both ends is what keeps the edge of the influence from being a seam a
  // listener can find by moving their finger slowly
  const d = (r, h) => (S.warpReach(r + h, 0.8) - S.warpReach(r - h, 0.8)) / (2 * h);
  assert.ok(Math.abs(d(0, 1e-4)) < 1e-3, 'flat at the centre');
  assert.ok(Math.abs(d(0.8 - 1e-3, 1e-4)) < 1e-2, 'flat at the edge');
  assert.ok(S.warpReach(0.3, 0.8) > S.warpReach(0.6, 0.8), 'monotone falloff');
  assert.equal(S.warpReach(0.3, 0), 0, 'a zero reach is a flat fabric');
});
test('warpDeflect: each force is a different deformation, and every one is bounded', () => {
  const o = { charge: 0.5, spin: 0.5, beat: 0.4, phase: 0 };
  const at = (mode, r) => S.warpDeflect(mode, r, o);
  // VOID pushes the image OUT (light bends in); ACCRETION draws it IN. If these
  // ever agreed in sign, two personalities would be one.
  assert.ok(at(0, 0.2).rad > 0, 'the void stretches the image outward');
  assert.ok(at(2, 0.2).rad < 0, 'the accretion draws it inward');
  // the vortices are rotation only, and opposite — chirality follows the drag
  assert.ok(Math.abs(at(1, 0.2).rad) < 1e-9 && Math.abs(at(-1, 0.2).rad) < 1e-9,
    'a vortex does not move anything radially');
  assert.ok(at(1, 0.2).ang > 0 && at(-1, 0.2).ang < 0, 'and the two wind opposite ways');
  assert.ok(Math.abs(at(1, 0.2).ang + at(-1, 0.2).ang) < 1e-9, 'by exactly the same amount');
  // every branch respects the ceilings, at every radius, at every commitment
  for (const mode of [-1, 0, 1, 2, 3]){
    for (const charge of [0, 0.5, 1]){
      for (let r = 0; r < 1.6; r += 0.02){
        const d = S.warpDeflect(mode, r, { charge, spin: 1, beat: 1, phase: 0.7 });
        assert.ok(Math.abs(d.rad) <= S.WARP.radMax + 1e-9, 'radial bounded: mode ' + mode + ' r ' + r.toFixed(2));
        assert.ok(Math.abs(d.ang) <= S.WARP.angMax + 1e-9, 'angular bounded: mode ' + mode + ' r ' + r.toFixed(2));
        assert.ok(isFinite(d.rad) && isFinite(d.ang), 'finite everywhere');
      }
    }
  }
  // beyond the reach the fabric is flat, for every force — the whole screen must
  // not be dragged around by a finger in one corner
  for (const mode of [-1, 0, 1, 2, 3]){
    const far = S.warpDeflect(mode, 4, { charge: 1, spin: 1, beat: 1 });
    assert.ok(Math.abs(far.rad) < 1e-9 && Math.abs(far.ang) < 1e-9, 'flat far away: mode ' + mode);
  }
  // commitment DEEPENS the deformation — that is the whole charge mechanic, and
  // it is what replaced the progress arc that used to be drawn under the thumb
  const light = S.warpDeflect(0, 0.25, { charge: 0 }).rad;
  const held = S.warpDeflect(0, 0.25, { charge: 1 }).rad;
  assert.ok(held > light, 'a held void bends harder: ' + light.toFixed(4) + ' -> ' + held.toFixed(4));
  // and it reaches further: at a radius the graze cannot touch, the hold can
  const edge = S.WARP.reach * 1.1;
  assert.equal(S.warpDeflect(0, edge, { charge: 0 }).rad, 0, 'past a graze\'s reach');
  assert.ok(S.warpDeflect(0, edge, { charge: 1 }).rad > 0, 'but inside a hold\'s');
  // the ripple oscillates — it must actually change sign with radius, or it is
  // not a wave, it is a bulge
  let sign = 0, flips = 0;
  for (let r = 0.02; r < 0.7; r += 0.01){
    const v = S.warpDeflect(3, r, { charge: 0.3, beat: 0.5, phase: 0 }).rad;
    const sg = Math.sign(v);
    if (sg && sign && sg !== sign) flips++;
    if (sg) sign = sg;
  }
  assert.ok(flips >= 2, 'the wave metric actually oscillates, got ' + flips + ' sign changes');
  // the beat is in the fabric: a hit crests the ripple harder
  const quiet = Math.abs(S.warpDeflect(3, 0.12, { beat: 0, phase: 0 }).rad);
  const hit = Math.abs(S.warpDeflect(3, 0.12, { beat: 1, phase: 0 }).rad);
  assert.ok(hit > quiet, 'the ripples crest on the beat');
  // garbage in: no NaN reaches a shader
  const junk = S.warpDeflect(0, 0.2, null);
  assert.ok(isFinite(junk.rad) && isFinite(junk.ang), 'null options are survivable');
});
test('warpRho: the sample radius never folds through zero', () => {
  // a negative radius is a reflection, and a lens that turns the world inside
  // out under the finger is a bug rather than a feature
  for (const mode of [-1, 0, 1, 2, 3])
    for (let r = 0; r < 1.2; r += 0.01)
      assert.ok(S.warpRho(mode, r, 1, { charge: 1, spin: 1, beat: 1 }) >= 0,
        'mode ' + mode + ' at r ' + r.toFixed(2));
  // a flat fabric is the identity: no force, no distortion, exactly
  for (const mode of [-1, 0, 1, 2, 3])
    assert.equal(S.warpRho(mode, 0.3, 0, { charge: 1 }), 0.3, 'zero force is the identity');
});
test('warpHorizon: only the void captures, and the hold widens it', () => {
  // the void's core is black because light inside this radius does not come back.
  // That used to be a div with mix-blend-mode: multiply hovering over the field.
  assert.ok(S.warpHorizon(0, 1, 0) > 0, 'the void has a horizon');
  for (const mode of [-1, 1, 2, 3])
    assert.equal(S.warpHorizon(mode, 1, 1), 0, 'nothing else captures: mode ' + mode);
  assert.ok(S.warpHorizon(0, 1, 1) > S.warpHorizon(0, 1, 0), 'the hold widens the horizon');
  assert.equal(S.warpHorizon(0, 0, 1), 0, 'no hand, no horizon');
});
test('warpBudget: shrinks for reduced motion, and never closes', () => {
  // a full-screen distortion is a vestibular event, not just a look — but a hand
  // that touches the world and feels nothing is its own defect, so the ceiling
  // comes down and never to zero
  const n = S.warpBudget({}), c = S.warpBudget({ calm: true }), r = S.warpBudget({ reduced: true });
  assert.equal(n, 1, 'no constraint, full authority');
  assert.ok(c < n && c > 0.2, 'the safety governor calms it: ' + c);
  assert.ok(r < c && r > 0.2, 'reduced motion calms it further, and it still answers: ' + r);
  assert.equal(S.warpBudget({ reduced: true, calm: true }), r, 'reduced motion is the floor either way');
  assert.equal(S.warpBudget(null), 1, 'garbage in → no constraint claimed');
});

// -------------------------------------------------- the mixset (@mixset)

const MIXSET_FIX = {
  name: 'Test night',
  defaults: { style: 'adaptive' },
  sections: [
    { name: 'Cocktail', minutes: 10, energy: [0.1, 0.4], style: 'musical', pool: { energy: [0.0, 0.5] } },
    { name: 'Dancing',  minutes: 20, energy: [0.7, 1.0], style: 'club',    pool: { energy: [0.5, 1.0] } },
  ],
  anchors: [
    { name: 'First dance', at: { elapsedMin: 10 }, track: { title: 'Ballad' }, playInFull: true },
  ],
  doNotPlay: [{ tag: 'banned-album' }],
};
const LIB = [
  { id: 1, title: 'Soft opener',  albumTag: 'a', features: { energy: 0.20 } },
  { id: 2, title: 'Ballad',       albumTag: 'a', features: { energy: 0.30 } },
  { id: 3, title: 'Floor filler', albumTag: 'b', features: { energy: 0.90 } },
  { id: 4, title: 'Peak banger',  albumTag: 'b', features: { energy: 0.75 } },
  { id: 5, title: 'Nope',         albumTag: 'banned-album', features: { energy: 0.85 } },
];

test('matchTrack: id/title/tag/energy selectors, AND-combined, forgiving', () => {
  const t = LIB[2];   // Floor filler, tag b, energy .9
  assert.ok(S.matchTrack({ any: true }, t));
  assert.ok(S.matchTrack({ id: 3 }, t) && !S.matchTrack({ id: 9 }, t));
  assert.ok(S.matchTrack({ title: 'floor' }, t), 'substring, case-insensitive');
  assert.ok(S.matchTrack({ tag: 'B' }, t), 'tag case-insensitive');
  assert.ok(S.matchTrack({ energy: [0.8, 1.0] }, t) && !S.matchTrack({ energy: [0.0, 0.5] }, t));
  assert.ok(S.matchTrack({ tag: 'b', energy: [0.8, 1.0] }, t), 'keys AND');
  assert.ok(!S.matchTrack({ tag: 'b', energy: [0.0, 0.5] }, t), 'one failing key fails the match');
  assert.ok(!S.matchTrack({ id: 3 }, null) && !S.matchTrack(null, t), 'null-safe');
});

test('mixsetSectionAt: cumulative minutes, edges, and the last section holds forever', () => {
  assert.equal(S.mixsetSectionAt(MIXSET_FIX, 0).section.name, 'Cocktail');
  assert.equal(S.mixsetSectionAt(MIXSET_FIX, 0).edge, 'start');
  assert.equal(S.mixsetSectionAt(MIXSET_FIX, 5 * 60).section.name, 'Cocktail');
  assert.equal(S.mixsetSectionAt(MIXSET_FIX, 10 * 60 + 5).section.name, 'Dancing', 'crossed into dancing');
  assert.equal(S.mixsetSectionAt(MIXSET_FIX, 999 * 60).section.name, 'Dancing', 'past the end → last section holds');
  assert.equal(S.mixsetSectionAt(MIXSET_FIX, 10 * 60 - 1).edge, 'end', 'the last 2 s of a section read as its end');
});

test('mixsetStyleAt: section style wins, falls back to default then adaptive', () => {
  assert.equal(S.mixsetStyleAt(MIXSET_FIX, 60), 'musical', 'cocktail is musical');
  assert.equal(S.mixsetStyleAt(MIXSET_FIX, 11 * 60), 'club', 'dancing is club');
  assert.equal(S.mixsetStyleAt({ sections: [{ name: 'x', minutes: 5 }] }, 0), 'adaptive', 'no style → adaptive');
  assert.equal(S.mixsetStyleAt({ defaults: { style: 'club' }, sections: [{ minutes: 5 }] }, 0), 'club', 'default applies');
});

test('sectionPool + doNotPlay: pool filter minus forbidden', () => {
  const cocktail = MIXSET_FIX.sections[0], dancing = MIXSET_FIX.sections[1];
  const cp = S.sectionPool(MIXSET_FIX, cocktail, LIB).map(t => t.id).sort();
  assert.deepEqual(cp, [1, 2], 'cocktail pool = low-energy, unbanned');
  const dp = S.sectionPool(MIXSET_FIX, dancing, LIB).map(t => t.id).sort();
  assert.deepEqual(dp, [3, 4], 'dancing pool = high-energy, and the banned-album track is excluded');
  assert.ok(S.mixsetForbids(MIXSET_FIX, LIB[4]), 'the banned album is forbidden everywhere');
});

test('dueAnchor: fires on elapsed threshold, once, then is spent', () => {
  assert.equal(S.dueAnchor(MIXSET_FIX, { elapsedSec: 9 * 60, playedAnchors: new Set() }), null, 'not yet');
  const d = S.dueAnchor(MIXSET_FIX, { elapsedSec: 10 * 60, playedAnchors: new Set() });
  assert.ok(d && d.index === 0, 'due at 10 min');
  assert.equal(S.dueAnchor(MIXSET_FIX, { elapsedSec: 12 * 60, playedAnchors: new Set([0]) }), null, 'already played');
});

test('mixsetPick: anchor first (in full), else nearest-energy from the section pool', () => {
  // at 10 min the first-dance anchor is due → the Ballad, played in full
  const a = S.mixsetPick(MIXSET_FIX, LIB, { elapsedSec: 10 * 60, playedIds: new Set(), playedAnchors: new Set() });
  assert.equal(a.track.title, 'Ballad'); assert.equal(a.playInFull, true); assert.equal(a.style, 'club');
  // mid-cocktail, no anchor: nearest to the cocktail target (~0.25) from {1:.2, 2:.3}
  const c = S.mixsetPick(MIXSET_FIX, LIB, { elapsedSec: 3 * 60, playedIds: new Set(), playedAnchors: new Set() });
  assert.ok([1, 2].includes(c.track.id), 'cocktail draws from its own low-energy pool'); assert.equal(c.style, 'musical');
  // mid-dancing: target ~0.85, pool {3:.9, 4:.75} → 3 is closer
  const d = S.mixsetPick(MIXSET_FIX, LIB, { elapsedSec: 15 * 60, playedIds: new Set([0]), playedAnchors: new Set([0]) });
  assert.equal(d.track.id, 3, 'dancing lands on the nearest-energy floor filler'); assert.equal(d.style, 'club');
  // exhausted pool (all played) still yields a pick, not null (a set never dead-airs)
  const e = S.mixsetPick(MIXSET_FIX, LIB, { elapsedSec: 15 * 60, playedIds: new Set([3, 4]), playedAnchors: new Set([0]) });
  assert.ok(e && [3, 4].includes(e.track.id), 'pool exhausted → repeats allowed, never null');
  // no mixset / empty library → null (mixer falls back)
  assert.equal(S.mixsetPick(null, LIB, {}), null);
  assert.equal(S.mixsetPick(MIXSET_FIX, [], {}), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
