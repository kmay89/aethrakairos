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
const code = block('pure') + '\n' + block('dmx') + '\n' + block('solver') + '\n' + block('syn') + '\n' + block('color') + '\n' + block('safe') + '\n' + block('ux') + '\n' + block('clock') + '\n' + block('dance') + '\n' + block('stem') + '\n' + block('echo') + '\n' + block('mix') + '\n' + block('xfader') + '\n' + block('style') + '\n' + block('mixset') + '\n' + block('fx') + '\n' + block('lava') + '\n' + block('media') + '\n' + block('master') + '\n' + block('vinyl') + '\n' + block('wave') +
  '\nreturn { loadAndLandAt, watchdogStep, STARVE_RELOAD_S, STARVE_RESEEK_S, STARVE_GIVE_UP, bufferedEndAt, prefetchMayRun, PREFETCH_AHEAD_S, seamWarmDue, SEAM_WARM_S, touchFxMode, mulberry32, solverDist, lerpFeat, sampleWaypoint, dealJourney, monotonicity,' +
  ' quantumStep, eraEligible, orderMemories, historyWindow, historyVerdict, reconcileQueue, clamp01,' +
  ' RITUALS, ritualByKey, dealRitual, freshPicks, openingSet, surpriseSet, libraryOrder, firstUnheardIndex, completionMilestones,' +
  ' SIGNATURE_RE, isSignature, signatureFirst,' +
  ' XFORM_KINDS, XFORM_MIN_DUR, segueFx, segueFxDur,' +
  ' smoothEnv, analyzeStructure, moodOf, structureCeiling, pickLens, segueStyle, segueShouldFire, pickStructure, dropPoints, nextDropAfter, sectionLabel, qualitySigKey, readQualityMemory, qualitySeed, writeQualityMemory, mixNarration, mixTechnique, stemsAt, stemRGB, STEM_PAL, STEM_OKLCH,' +
  ' SEGUE_BARS, SECTION_CHANGE, sectionChangeClass, LENS_HYST,' +
  ' camelotParse, camelotCompat, tempoFoldRatio, planTransition, glideRates, driftTrim,' +
  ' mixMatchScore, chartSet, nextUp, energyArcBias, stemWindow, vocalClashBias,' +
  ' equalPowerXfade, xfadeCurve, seamPhaseTrim, seamPhaseErr, seamTake, seamNudge, seamBuffered, seamStreamReady, seamDeferBar, seamEntry, seamLeadFor, SEAM_LEAD, BEATMIX_LEAD,' +
  ' SEAM_SCENE, seamSceneCue, pinchDolly, ndcOf,' +
  ' XFADER_CUT_EDGE, XFADER_PARK, FADER_IDLE_S, xfaderGains, xfaderPosFromSeam, xfaderPosFromGains, xfaderArbiter, syncRateFor, faderIdleStop, XFADER_HOME, xfaderHeld, xfaderAutoTo, XFADER_STEP_ASIDE, xfaderCancelMode, deckSlot, seamPitchCarry,' +
  ' FX_DIVS, beatLen, loopBounds, loopWrap, loopResize, rollReturn, rollPos, fxWet, fxFilter, fxTime, fxGateHold, brakeRate, fxAutoPick,'  +
  ' FX_UNITS, FX_SENDS, FX_INSERTS, FX_AMT, FX_MIX, fxMix, FILTER_DETENT, fxFilterQ, qDb, Q_FLAT_DB, fxFilterArbiter, fxSeamHz,'  +
  ' GATE_FLOOR, gateEdge, gateCurve, gateEdgeSec, gateSchedule, gateAnchor, fxEchoGains, fxEchoGlide, ECHO_HOLD_FB, reverbIR,'  +
  ' fxFlangeParams, fxLfoWave, fxPhaserStages, fxPhaserShape, crushBits, crushCurve, crushTone,'  +
  ' driveCurve, drivePre, driveTiltDb, driveTrimDb, drivePinkRef, driveMakeup, FX_AUTO, makeFxAuto, fxAutoStep, fxAutoSweep,'  +
  ' FX_GAIN_DB, FX_BUDGET_DB, fxGainBudget, FX_PARK,'  +
  ' LOOP_XFADE, LOOP_RING_SEC, loopXfadeLen, loopHeadBlend, ringIndexOf, ringSlice,' +
  ' loopHandoverAt, loopLateHandover, loopPhaseAt, loopHandbackPos, loopInPoint,' +
  ' TEAR_HOLD, TEAR_MIN, makeTearWatch, tapeTearStep, tapeTearSilent, ringTornIn, loopDeckReady, loopHandbackAt,' +
  ' CUE_SLOTS, CUE_COLORS, cueSnap, autoCuePoints, AUTOCUE, cueJumpAt, cueJumpLand, beatJumpTarget, EQ_KILL_DB, EQ_BANDS, fxEqToggle, fxEqIsFlat,' +
  ' MIX_STYLES, MIX_STYLE_ORDER, resolveMixStyle, stylePlanOpts, styleAdjustPlan, styleExitBase,' +
  ' matchTrack, mixsetSectionAt, mixsetStyleAt, mixsetForbids, sectionPool, sectionTargetEnergy, dueAnchor, mixsetPick,' +
  ' camelotHue, oklchToRgb, oklchToRgbFine, lerpOklch, colorPlan, PHI, intervalHue, goldenGate,' +
  ' INK, inkRolloff, whiteBudget, rampStops, buildRamp, RAMP_N,' +
  ' SAFE_TUNING, relLuma, redFraction, gateLuma, makeSafeColorState, safeColorStep,' +
  ' FITTS, fittsTime, fittsReach, rectGrow, rectOverlap, fittsBudget, fittsSteals, travelCost,' +
  ' HICK, hickTime, hickGrouped, MILLER, millerChunk, millerOver, DOHERTY_MS, dohertyOk, dohertyNeedsAck,' +
  ' serialPosition, serialOrder, peakEnd, paretoVital, vonRestorffLone, vonRestorffPick, zeigarnikProgress,' +
  ' GESTALT, proximityOk, parkinsonBudget, teslerShare, occamPick, postelUrl,' +
  ' makeSafeBeatState, safeBeatStep, countFlashes,' +
  ' dancePulse, danceSway, danceTimeWarp, DANCE_MOVES, danceDeal, danceMovePose, onsetEnergy, envFollow, beatSpringStep, beatGate,' +
  ' STEM_LIGHT, STEM_CUT_DWELL, STEM_CUT, makeStemLightState, stemDigit, stemPeak, stemMean, stemSection, stemLightStep, stemLightOut,' +
  ' HIT_VOICES, HIT_SKIP, hitsDecode, hitsChart, hitsLast, hitPulse, hitBlend, stemMood, QUARTET_N, QUARTET_WIN, quartetLane,' +
  ' DANCE_BUS, dancePeriod, danceLookahead, danceClassify, makeDanceKick, danceKickStrike, danceKickStep, danceLandingStep, makeDanceBusState, danceBusStep, danceBusApply, danceScoreRises,' +
  ' danceWindowLevel, danceWarpSlew, danceSectionTurn, danceSilenceAhead, danceStemFeed, hitVoices,' +
  ' danceLeanJS, danceStrideJS, danceFrontJS, danceLampJS, danceLandJS, danceRingJS, danceBreathJS, danceBeatWeightJS,' +
  ' makeMediaClock, clockReset, clockSample, clockRead, tapTempo, phaseLock, planMixNow, envSample, peaksFromEnv,' +
  ' powerPlan, echoSignals, echoPick, echoCompose, ECHO_QUOTES, ECHO_PROMPTS, ECHO_ACK, ECHO_FRAGS, ECHO_TURN,' +
  ' touchCharge, touchBurst, beatTapBonus, touchAffinity, touchAutoShould, touchPairMode, updateGate, UP_TOUCH_MS, updateOffer, updateOfferKey, newsSince, lessonDue, restartVerdict,' +
  ' stageGrid, stageSlice, stageRole, stageApplyFeat, stageOffset, STAGE_FIELDS,' +
  ' stageRect, stageBounds, stageOrder, stageLayout, stageMoved, stageResolveRects, stageHandLocal, stagePlan,' +
  ' stageCodeTidy, stageCodeIs, stageNetWall, crowdPack, crowdClamp, stageSpread,' +
  ' DMX_FIXTURES, DMX_ROLES, MYSTIC_COLORS, DMX_STROBE_MAX_HZ, dmxProfile, dmxWire, dmxFootprint,' +
  ' dmxModeOf, dmxPatch, dmxUniverseUsed, dmxIntent, dmxStrobeHz, dmxNearestColor,' +
  ' dmxAutoAddress, dmxOverlaps, dmxDialPlan,' +
  ' dmxRenderFixture, dmxRender, dmxRenderNet, dmxDecode, DMX_USB_PRO, dmxUsbProPacket, dmxUsbProFrame,' +
  ' DMX_PRESETS, DMX_PRESET_ORDER, dmxAutoPreset, dmxChordStop, dmxShowIntents, dmxSegueTint,' +
  ' DMX_BEAM_MOVES, dmxBeamState, dmxBeamColors, dmxBeamStep, dmxBeamPose, dmxWashChase,' +
  ' dmxTrackHash, dmxTrackDesign,' +
  ' HUE_APP, HUE_MIN_MS, hueIsLan, hueXY, hueUpdate, huePairResult, hueLights,' +
  ' WARP, warpSoft, warpReach, warpDeflect, warpRho, warpHorizon, warpBudget, warpPush, warpLobe,' +
  ' GHOST_TUNING, GHOST_KINDS, ghostRand, ghostFold, ghostSnake, ghostPaint, ghostPath, ghostPhrase,' +
  ' ghostAmp, ghostShould, ghostPattern, ghostSplit, ghostMirror,' +
  ' SCENE_KEYS, SCENE_TASTE, MOODS, ROOM_DWELL, sceneScore, recencyPenalty, roomMood, roomDwell, dealScene,' +
  ' roomDwellBars, PACE, paceGate, SURGE, surgeShouldRequest, DEVELOP, developPlan,' +
  ' cieXYZBar, blackbodyXYZ, kelvinRGB, wavelengthRGB, cherenkovRGB, rgbHex, FLAME_SOURCES, FLAME_RAMP_N,' +
  ' flamePuff, flameRGB, flameTemp, flameRamp, flameBandU, flameLabel, flameRoll,' +
  ' PYRO_STARS, PYRO_SHELLS, PYRO_TUNING, pyroStarRGB, pyroShell, pyroFlight,' +
  ' pyroRate, pyroFire, pyroStillGain, pyroPick, pyroSalt, PYRO_SHOW, pyroLead, pyroProgram, flameSpectrum,' +
  ' CIE_LOBES, XYZ_TO_SRGB, xyzToLinearRGB, DISC_PITCH, AIRY_J1_ZERO, rayleighSep, DISP_WB,' +
  ' FILAMENT_FORMS, LORENZ, THOMAS_B, FILM_N, FILM_R0, FILM_AGES, filmState, TERRAIN_FORMS,' +
  ' CREATURE_FORMS, creatureGenome, creatureSeed, BARKLEY, BARKLEY_REGIMES, barkleyStep,' +
  ' EIGEN, EIGEN_LESSONS, eigenDot, eigenTql2, eigenLanczos, eigenSolve, eigenOccupation, eigenTimeUnit,' +
  ' colorScheme, schemeChord, warmTilt, actWarmth, ACT_WARMTH, WARM_MAX_DEG,' +
  ' UP_EST, updateProgress, updateEstimate, updateWatchdogStep,' +
  ' UP_SNOOZE_MS, UP_NAG_CAP, UP_APPLY_CAP, UP_QUIET_MS, updateReminder, ACT_CAP, activityPush, activityAgo,' +
  ' SKINS, skinResolve, skinHexRgb, skinCss,' +
  ' WARM_HUES, warmHue, warmBlend, WARM_PULL, warmDeal, togetherness, warmSpark, beatGrace, SCENE_SIGS, sceneSig,' +
  ' lookEncode, lookDecode, mixsetVisualAt,' +
  ' LAVA, lavaVisc, lavaRadius, lavaAmbient, lavaFlow, lavaK6, lavaKS, lavaW, lavaGradW,' +
  ' lavaCohesion, lavaRestDensity, lavaRestGrad, lavaCohesionScale, lavaBudget,' +
  ' makeLava, lavaNeighbours, lavaConfine, lavaStep, lavaWallDensity, lavaDensityError,' +
  ' LIMITER, dbToLin, linToDb, interPeak, makeLimiter, limiterProcess, limiterWorkletSource, BAND_HZ, bandBins,' +
  ' VINYL_REV_SEC, VINYL_RING_SEC, VINYL_RAMP_SEC, PLATTER, makePlatter, platterStep, platterHandRate, platterDelta, hermite4,' +
  ' platterHandFollow, makeVinyl, vinylRead, vinylProcess, vinylCommand, vinylWorkletSource,' +
  ' VINYL_CUT_SEC, vinylReadAir, vinylToneK, vinylCutSpec, vinylScriptStep, vinylScriptCut, vinylScriptBlock, vinylSnap, VINYL_PRESETS, vinylPresetSteps, vinylLanding, vinylNextLine, VINYL_SONG_LOW_SR,' +
  ' WAVE_V, WAVE_HZ, WAVE_SR, WAVE_TILT, WAVE_PLANES, WAVE_MIPS, waveBiquad, wavePct, waveDetail, waveQuant, waveFromEnv, waveRange, waveGrid, waveBeatPos, waveWorkerSource,' +
  ' waveTrailMean, waveTrailMax, waveTilt, waveMip, waveNorm, wavePack, waveLevel, waveRangeAt, waveFoldPeaks, waveOnsets, waveBandColours, waveTiltAt, waveTiltLUT, waveGridStyle, waveDeckTime, waveRateStep, waveClock,' +
  ' VINYL_SONG_FRAMES, vinylSongRate, vinylToTape, makeVinylSong, vinylSongCommand, vinylSongProcess,' +
  ' SYN_TUNING, synSectionAt, synAhead, synFeatAhead, synCue, synSeamGlide, synKeyTerm, synDealSeed, synLookahead };';
const S = new Function(code)();

let passed = 0, failed = 0;
/* Async tests are AWAITED, not fired and forgotten. `try { fn() }` around a
   function returning a promise catches nothing: the assertions run after the
   try block has already reported 'ok', so a failing async test printed a pass
   and then crashed the process on an unhandled rejection — after the summary
   line had gone out claiming everything was fine. Anything thenable is parked
   here and settled before the totals are printed. */
const pending = [];
function test(name, fn){
  const ok = () => { passed++; console.log('  ok', name); };
  const bad = e => { failed++; console.error('  FAIL', name, '\n   ', (e && e.message) || e); };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') pending.push(r.then(ok, bad));
    else ok();
  }
  catch (e){ bad(e); }
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

test('signatureFirst: the introduction leads, and everything else keeps its order', () => {
  const T = (t) => ({ title: t });
  const a = T('Amber Axis'), b = T('Breathing'), c = T('Cinder');
  const m = T('Möbius Walking'), mo = T('mobius walking (edit)');

  assert.deepEqual(S.signatureFirst([a, b, m, c]), [m, a, b, c],
    'pulled to the front, the rest in the order they arrived');
  assert.deepEqual(S.signatureFirst([m, a, b]), [m, a, b], 'already first → untouched');
  assert.deepEqual(S.signatureFirst([a, b]), [a, b], 'absent from both list and pool → left alone');
  // THE CASE THE CRATE NEEDS: pinned in from the wider shelf when the window
  // it was cut from has already aged past it
  assert.deepEqual(S.signatureFirst([a, b], [c, m, a]), [m, a, b],
    'not in the list but in the pool → pinned to the front anyway');
  assert.deepEqual(S.signatureFirst([], [m]), [m], 'an empty list still gets the introduction');
  assert.deepEqual(S.signatureFirst(null, null), [], 'nothing in, nothing out — no throw');
  // spelled both ways in the wild, and the id is not the promise — the title is
  assert.equal(S.isSignature(mo), true, 'matched without the umlaut');
  assert.equal(S.isSignature(m), true);
  assert.equal(S.isSignature(a), false);
  assert.equal(S.isSignature({}), false, 'a track with no title is not the introduction');
  assert.equal(S.isSignature(null), false);
  // and the original array is not rearranged under the caller
  const src = [a, b, m];
  S.signatureFirst(src);
  assert.deepEqual(src, [a, b, m], 'the input list is left as it was found');
});

test('freshPicks: the crate opens on the introduction, window or no window', () => {
  const NOW = Date.UTC(2026, 6, 19), day = 86400000;
  const iso = d => new Date(NOW - d * day).toISOString().slice(0, 10);
  const T = (sha, title, days) => ({ sha256: sha, title, published: iso(days) });
  const key = t => t.sha256 || null;
  // Möbius Walking is old enough to fall outside the 35-day window, and four
  // fresher pressings would otherwise fill the crate ahead of it
  const cat = [
    T('a', 'Amber Axis', 2), T('b', 'Breathing', 9), T('c', 'Cinder', 20), T('e', 'Ember', 33),
    T('m', 'Möbius Walking', 400),
  ];
  const p = S.freshPicks(cat, new Map(), key, NOW);
  assert.equal(p.crate[0].title, 'Möbius Walking', 'the crate leads with the introduction');
  assert.deepEqual(p.crate.slice(1).map(t => t.sha256), ['a', 'b', 'c', 'e'],
    'then the latest pressings, newest first, exactly as before');
  assert.equal(p.fresh.sha256, 'a', 'the pressing is still the genuinely newest — not the hero');
  // inside the window it is promoted rather than duplicated
  const near = S.freshPicks([T('a', 'Amber Axis', 2), T('m', 'Möbius Walking', 5), T('b', 'Breathing', 9)],
    new Map(), key, NOW);
  assert.deepEqual(near.crate.map(t => t.sha256), ['m', 'a', 'b'], 'in-window → moved up, listed once');
  // no introduction in the catalogue → plain newest-first, unchanged
  const none = S.freshPicks([T('a', 'Amber Axis', 2), T('b', 'Breathing', 9)], new Map(), key, NOW);
  assert.deepEqual(none.crate.map(t => t.sha256), ['a', 'b'], 'no hero → the crate is untouched');
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
    assert.equal(h, ((n - 1) / 12 * 360 + 40) % 360);
    hues.push(h);
  }
  assert.equal(new Set(hues.map(h => h.toFixed(2))).size, 12);        // all distinct
  // harmonic neighbours are chromatic neighbours: one wheel step = 30 degrees —
  // all the way round, so 12 and 1 are neighbours too (the old 300° span broke there)
  assert.equal(Math.abs(S.camelotHue('9A') - S.camelotHue('8A')), 30);
  const d121 = Math.abs(S.camelotHue('12A') - S.camelotHue('1A'));
  assert.equal(Math.min(d121, 360 - d121), 30);
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

test('colorScheme: six readings, and the rainbow stays rare', () => {
  const S6 = ['analogous', 'suspended', 'complement', 'sixth', 'triad', 'seventh', 'spectrum'];
  const seen = new Set();
  for (let e = 0; e <= 1.0001; e += 0.02)
    for (let ent = 0; ent <= 1.0001; ent += 0.02){
      const k = S.colorScheme(e, ent);
      assert.ok(S6.includes(k), `(${e},${ent}) -> ${k}`);
      seen.add(k);
    }
  assert.equal(seen.size, 7, 'every reading is reachable: ' + [...seen].join(' '));
  // the two new readings occupy regions the old map had no word for
  assert.equal(S.colorScheme(0.3, 0.5), 'suspended', 'quiet but not settled');
  assert.equal(S.colorScheme(0.9, 0.55), 'seventh', 'hot and arguing with itself');
  assert.equal(S.colorScheme(0.7, 0.1), 'sixth', 'driving and perfectly clean');
  // …without displacing any of the four the engine already had taste about
  assert.equal(S.colorScheme(0.2, 0.3), 'analogous');
  assert.equal(S.colorScheme(0.8, 0.4), 'complement');
  assert.equal(S.colorScheme(0.8, 0.8), 'triad');
  assert.equal(S.colorScheme(0.9, 0.9), 'spectrum');
  // and the rainbow is still a small corner of the space
  let spectrum = 0, n = 0;
  for (let e = 0; e <= 1.0001; e += 0.01)
    for (let ent = 0; ent <= 1.0001; ent += 0.01){ n++; if (S.colorScheme(e, ent) === 'spectrum') spectrum++; }
  assert.ok(spectrum / n < 0.09, `spectrum covers ${(spectrum / n * 100).toFixed(1)}% of the space`);
});
test('schemeChord: every scheme spells a real interval, and only the thin ones lift', () => {
  for (const scheme of ['analogous', 'suspended', 'complement', 'sixth', 'triad', 'seventh'])
    for (const minor of [false, true])
      for (const keyed of [false, true]){
        const ch = S.schemeChord(scheme, minor, keyed, S.mulberry32(3));
        assert.ok(isFinite(ch.b) && isFinite(ch.c), `${scheme} ${minor} ${keyed}`);
        assert.ok(ch.d == null || isFinite(ch.d));
        assert.equal(typeof ch.lift, 'boolean');
        // a chord whose harmony sits on the root is not a chord
        assert.ok(Math.abs(((ch.b % 360) + 360) % 360) > 1e-9, `${scheme} has no harmony`);
      }
  const k = s => S.schemeChord(s, false, true, null);
  assert.ok(Math.abs(k('suspended').b - S.intervalHue(4, 3)) < 0.01, 'the fourth hangs');
  assert.ok(Math.abs(k('sixth').b - S.intervalHue(5, 3)) < 0.01, 'the major sixth opens');
  assert.ok(Math.abs(S.schemeChord('sixth', true, true, null).b - S.intervalHue(8, 5)) < 0.01, 'the minor sixth');
  assert.ok(Math.abs(k('seventh').c - S.intervalHue(9, 5)) < 0.01, 'the seventh aches');
  assert.ok(Math.abs(k('seventh').d - S.intervalHue(3, 2)) < 0.01, 'and keeps the fifth for the gradient');
  // only the two-note chords need somewhere pale to rise to
  for (const s of ['analogous', 'suspended', 'complement']) assert.equal(k(s).lift, true, s);
  for (const s of ['sixth', 'triad', 'seventh']) assert.equal(k(s).lift, false, s);
  assert.equal(k('triad').d, null, 'a triad has three notes');
  assert.ok(k('seventh').d != null, 'a seventh has four');
});
test('colorPlan: a wide chord hands the gradient a fourth note, and only then', () => {
  const base = { key: '8B', brightness: 0.4, act: 0.5, seed: 5 };
  const seventh = S.colorPlan({ ...base, energy: 0.9, entropy: 0.55 });
  assert.equal(seventh.scheme, 'seventh');
  assert.ok(seventh.extra, 'the seventh carries its fourth note');
  assert.equal(seventh.colors.length, 3, 'but uColA/B/C is still three swatches');
  assert.ok(seventh.extra.l < seventh.root.l, 'and it sits UNDER the root, not above it');
  const dh = (a, b) => ((b - a + 720) % 360);
  assert.ok(Math.abs(dh(seventh.root.h, seventh.extra.h) - S.intervalHue(3, 2)) < 0.01, 'at the fifth');
  assert.equal(S.colorPlan({ ...base, energy: 0.2, entropy: 0.2 }).extra, null, 'a thin chord carries none');
});
test('warmTilt: the shorter arc, never more than halfway, and never off the key', () => {
  assert.equal(S.warmTilt(200, 0), 200, 'no pull, no movement');
  assert.equal(S.warmTilt(-40, 0), 320, 'and it normalises');
  const warm = S.warmTilt(200, 0.3), cool = S.warmTilt(200, -0.3);
  const toward = (from, to, pole) => Math.abs((((pole - to + 540) % 360) - 180))
    < Math.abs((((pole - from + 540) % 360) - 180));
  assert.ok(toward(200, warm, 45), 'a warm pull moves toward the amber pole');
  assert.ok(toward(200, cool, 225), 'a cool pull moves toward the blue one');
  for (const h of [0, 44, 46, 90, 180, 224, 226, 300, 359])
    for (const w of [-1, -0.5, -0.1, 0.1, 0.5, 1]){
      const out = S.warmTilt(h, w);
      assert.ok(out >= 0 && out < 360, `${h} ${w} -> ${out}`);
      const moved = Math.abs((((out - h + 540) % 360) - 180));
      const pole = w > 0 ? 45 : 225;
      const dist = Math.abs((((pole - h + 540) % 360) - 180));
      assert.ok(moved <= dist * 0.451 + 1e-9,
        `never past halfway: moved ${moved.toFixed(1)} of ${dist.toFixed(1)}`);
      assert.ok(moved <= S.WARM_MAX_DEG + 1e-9,
        `and never more than a warming: moved ${moved.toFixed(1)}°`);
    }
  // the case that made the degree cap necessary: a key sitting opposite the
  // pole, where a plain fraction-of-the-distance walk is a key change
  const far = S.warmTilt(212, 0.30);
  assert.ok(Math.abs((((far - 212 + 540) % 360) - 180)) <= S.WARM_MAX_DEG + 1e-9,
    `an apex on a cool key warms, it does not transpose: 212 -> ${far.toFixed(1)}`);
});
test('actWarmth: the arc is a temperature curve, and the ceiling holds it', () => {
  assert.ok(S.actWarmth(2, 1) > 0, 'the apex is hot');
  assert.ok(S.actWarmth(0, 1) < 0 && S.actWarmth(4, 1) < 0, 'both edges are cold');
  assert.ok(S.actWarmth(4, 1) < S.actWarmth(0, 1), 'and the resolve is the coldest light in the song');
  assert.equal(S.actWarmth(1, 1), 0, 'the rising middle is neutral');
  assert.ok(S.actWarmth(2, 0.3) < S.actWarmth(2, 1), 'an apex the section caps is a warm room, not a furnace');
  assert.equal(S.actWarmth(2, 0), 0, 'and a section that earns nothing gets nothing');
  assert.equal(S.actWarmth(-1, 1), S.ACT_WARMTH[1], 'no act yet reads as the neutral middle');
  assert.equal(S.actWarmth(99, 1), S.ACT_WARMTH[1]);
  for (const a of [0, 1, 2, 3, 4]) assert.ok(Math.abs(S.actWarmth(a, 1)) < 0.45, 'and none of it is a lot');
});
test('NOCTURNE: the chord taken into the dark, with exactly one light left in it', () => {
  const plan = { scheme: 'triad', colors: [
    { l: 0.58, c: 0.18, h: 30 }, { l: 0.60, c: 0.16, h: 150 }, { l: 0.80, c: 0.12, h: 270 }] };
  const auto = S.rampStops(plan, 'auto');
  const noct = S.rampStops(plan, 'nocturne');
  const lo = s => s.reduce((a, x) => Math.min(a, x.l), 9);
  assert.ok(lo(noct) < lo(auto) - 0.15, `nocturne runs deeper: ${lo(noct)} vs ${lo(auto)}`);
  const bright = noct.filter(s => s.l > 0.7);
  assert.equal(bright.length, 1, 'exactly one stop is allowed to rise');
  assert.equal(bright[0].h, 270, 'and it is the accent');
  // dark must not mean grey — chroma goes UP as lightness comes down
  assert.ok(noct[0].c >= plan.colors[0].c, 'the deep stops keep their colour');
  for (const s of noct) assert.ok(s.c >= 0.10, 'nothing on the ramp is a grey');
  // and a wide chord spends its fourth note here too
  const wide = S.rampStops({ ...plan, extra: { l: 0.5, c: 0.17, h: 200 } }, 'nocturne');
  assert.equal(wide.length, 4);
  assert.equal(S.rampStops({ ...plan, extra: { l: 0.5, c: 0.17, h: 200 } }, 'auto').length, 4,
    'as does AUTO — the gradient is where a fourth note can live');
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
  for (const mode of ['auto', 'duo', 'spectrum', 'nocturne']){
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

// ------------------------------------------------- the choreographer's repertoire

test('the vocabulary is well-formed: counted in beats, windowed in energy', () => {
  const names = new Set();
  for (const m of S.DANCE_MOVES){
    assert.ok(!names.has(m.name), 'unique name: ' + m.name);
    names.add(m.name);
    assert.ok([4, 8, 16].includes(m.beats), m.name + ' is counted in whole bars/half-bars');
    assert.ok(m.lo >= 0 && m.hi <= 1 && m.lo < m.hi, m.name + ' has a sane energy window');
    assert.ok(m.w > 0, m.name + ' has appetite');
  }
  const orbit = S.DANCE_MOVES.find(m => m.name === 'orbit');
  assert.ok(orbit.lo === 0 && orbit.hi === 1, 'the resting figure is never out of place');
});

test('every figure is bounded, finite, and resolves for the handover', () => {
  const rng = S.mulberry32(77);
  for (const m of S.DANCE_MOVES){
    for (let trial = 0; trial < 4; trial++){
      const o = { dir: trial % 2 ? -1 : 1, va: rng(), vb: rng() };
      let last = null;
      for (let i = 0; i <= 200; i++){
        const u = i / 200;
        const p = S.danceMovePose(m.name, u, o);
        for (const k of ['dth', 'dphi', 'dr', 'roll', 'dfov', 'flow', 'spin', 'snap'])
          assert.ok(Number.isFinite(p[k]), m.name + '.' + k + ' finite at u=' + u);
        assert.ok(Math.abs(p.dth) <= 3.2, m.name + ' theta stays on the rig');
        assert.ok(Math.abs(p.dphi) <= 0.8, m.name + ' never flips over the pole');
        assert.ok(Math.abs(p.dr) <= 12, m.name + ' radius stays in the hall');
        assert.ok(Math.abs(p.roll) <= 0.35, m.name + ' roll stays a lean, not a tumble');
        assert.ok(Math.abs(p.dfov) <= 14, m.name + ' fov punch is a punch, not a fisheye');
        assert.ok(p.flow >= 0.4 - 1e-9 && p.flow <= 1.9 + 1e-9, m.name + ' rubato is bounded');
        assert.ok(p.spin >= -0.6 && p.spin <= 3, m.name + ' spin conducts, not spins out');
        assert.ok(p.snap >= 0 && p.snap <= 6, m.name + ' snap is bounded');
        last = p;
      }
      // the handover: lean and lens resolve, time returns to tempo — the next
      // figure starts from a camera at rest in its new place
      assert.ok(Math.abs(last.roll) < 0.03, m.name + ' puts the lean down by the count');
      assert.ok(Math.abs(last.dfov) < 0.6, m.name + ' hands the lens back');
      assert.ok(Math.abs(last.flow - 1) <= 0.3, m.name + ' arrives back at tempo');
      // …and every figure except the crash OPENS from stillness
      if (m.name !== 'drop'){
        const p0 = S.danceMovePose(m.name, 0, o);
        assert.ok(Math.abs(p0.dth) < 0.05 && Math.abs(p0.dr) < 0.3 && Math.abs(p0.roll) < 0.03,
          m.name + ' opens continuous');
      }
    }
  }
});

test('the crash cut opens discontinuous — that jump IS the figure', () => {
  const early = S.danceMovePose('drop', 0.1, { dir: 1, va: 0.5, vb: 0.5 });
  const late = S.danceMovePose('drop', 1, { dir: 1, va: 0.5, vb: 0.5 });
  assert.ok(early.dth > late.dth * 0.4, 'most of the angle lands in the first tenth');
  assert.ok(early.dfov > 5, 'the zoom shock is on the hit');
  assert.ok(S.danceMovePose('drop', 0.01, {}).flow > 1.5, 'time tears through the landing');
});

test('the strut steps land quantised on the beats, the field holding still', () => {
  const o = { dir: 1, va: 0.5, vb: 0.5 };
  // plateau late in step one vs. the snap just after the second beat lands
  const plateau = S.danceMovePose('strut', 0.24, o).dth;
  const landed = S.danceMovePose('strut', 0.30, o).dth;
  assert.ok(Math.abs(S.danceMovePose('strut', 0.20, o).dth - plateau) < 0.02, 'the hold between steps');
  assert.ok(landed - plateau > 0.1, 'the step SNAPS on the count');
  assert.equal(S.danceMovePose('strut', 0.5, o).spin, 0, 'the field holds still under the footwork');
  assert.ok(S.danceMovePose('strut', 0.1, o).snap >= 3, 'the rig tracks fast enough to read the step');
});

test('the rubato has a shape: breath held, whip surged, always released', () => {
  const o = { dir: 1, va: 0.5, vb: 0.5 };
  assert.ok(S.danceMovePose('suspend', 0.5, o).flow < 0.6, 'the held breath thickens time');
  assert.ok(S.danceMovePose('suspend', 1, o).flow > 0.9, 'and releases it before the landing');
  assert.ok(S.danceMovePose('float', 0.3, o).flow < 0.7, 'the drift floats below tempo');
  let peak = 0;
  for (let i = 0; i <= 40; i++) peak = Math.max(peak, S.danceMovePose('rush', i / 40, o).flow);
  assert.ok(peak > 1.4, 'the whip surges through');
  // steady figures keep steady time
  for (let i = 0; i <= 20; i++)
    assert.equal(S.danceMovePose('orbit', i / 20, o).flow, 1, 'the carousel keeps tempo');
  // the wind-up: the whip pulls BACK before it tears forward
  let dipped = false;
  for (let i = 1; i <= 10; i++) if (S.danceMovePose('rush', i * 0.02, o).dth < -0.02) dipped = true;
  assert.ok(dipped, 'anticipation before the whip');
});

test('the dealer respects the room: windows, no repeats, the coil and the crash', () => {
  const rng = S.mulberry32(4242);
  for (let i = 0; i < 400; i++){
    const quiet = S.danceDeal({ energy: 0.05, last: '', rand: rng });
    assert.ok(!['rush', 'strut', 'drop', 'spiral', 'pushin'].includes(quiet.name),
      'a lullaby never gets the whip: ' + quiet.name);
    const loud = S.danceDeal({ energy: 0.97, last: '', rand: rng });
    assert.ok(['orbit', 'strut', 'rush'].includes(loud.name), 'a banger dances hard: ' + loud.name);
    const varied = S.danceDeal({ energy: 0.5, last: 'orbit', rand: rng });
    assert.ok(varied.name !== 'orbit', 'never the same figure twice');
    assert.ok(S.DANCE_MOVES.some(m => m.name === varied.name && m.beats === varied.beats),
      'the deal carries its own count');
    assert.ok(varied.dir === 1 || varied.dir === -1, 'a direction is always chosen');
  }
  assert.equal(S.danceDeal({ energy: 0.9, impact: true, rand: rng }).name, 'drop',
    'the landing deals the crash — nothing else does');
  assert.equal(S.danceDeal({ energy: 0.3, brace: 0.8, last: 'orbit', rand: rng }).name, 'suspend',
    'precognition deals the coil');
  assert.ok(S.danceDeal({ energy: 0.3, brace: 0.8, last: 'suspend', rand: rng }).name !== 'suspend',
    'but never coils twice in a row');
});

test('choreography repeats on purpose: the motif answers at the phrase turn', () => {
  const call = S.danceDeal({ energy: 0.4, phraseFrac: 0.01, last: 'orbit',
    motif: 'pendulum', rand: () => 0.3 });
  assert.equal(call.name, 'pendulum', 'the phrase head calls the motif back');
  // the callback still respects the room: a quiet figure is not forced on a peak
  const outgrown = S.danceDeal({ energy: 0.98, phraseFrac: 0.01, last: 'orbit',
    motif: 'float', rand: () => 0.3 });
  assert.ok(outgrown.name !== 'float', 'a motif the room has outgrown is let go');
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
  assert.equal(S.touchFxMode('tidal', 0), 4);     // the two-lobed stretch
  assert.equal(S.touchPairMode(4), 4);            // two tide-raisers make a strait
  // the lobe: full stretch along the axis, full squeeze across it, round for
  // every older force — the tide is the only one that knows a direction
  assert.ok(Math.abs(S.warpLobe(4, 0.7, 0.7) - 1) < 1e-9);
  assert.ok(Math.abs(S.warpLobe(4, 0.7 + Math.PI / 2, 0.7) + 1) < 1e-9);
  assert.equal(S.warpLobe(2, 1.3, 0), 1);
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

// ---- moodOf: a mood bucket from features the catalog already measures ----
test('moodOf: low energy + major/bright reads calm, not moody', () => {
  assert.equal(S.moodOf({ energy: 0.15, onsets: 0.1, brightness: 0.6, entropy: 0.3 }, '8B'), 'calm');
});
test('moodOf: low energy + minor/dark reads moody, not calm', () => {
  assert.equal(S.moodOf({ energy: 0.15, onsets: 0.1, brightness: 0.35, entropy: 0.7 }, '8A'), 'moody');
});
test('moodOf: high energy + major reads driving', () => {
  assert.equal(S.moodOf({ energy: 0.9, onsets: 0.85, brightness: 0.6, entropy: 0.4 }, '9B'), 'driving');
});
test('moodOf: high energy + minor/dark reads dark, not driving', () => {
  assert.equal(S.moodOf({ energy: 0.9, onsets: 0.85, brightness: 0.3, entropy: 0.75 }, '9A'), 'dark');
});
test('moodOf: mid energy splits warm (major) vs tense (minor) the same way', () => {
  assert.equal(S.moodOf({ energy: 0.5, onsets: 0.5, brightness: 0.6, entropy: 0.3 }, '5B'), 'warm');
  assert.equal(S.moodOf({ energy: 0.5, onsets: 0.5, brightness: 0.3, entropy: 0.7 }, '5A'), 'tense');
});
test('moodOf: missing features and an unknown key still return a bucket, never throw', () => {
  assert.ok(['calm', 'warm', 'driving', 'moody', 'tense', 'dark'].includes(S.moodOf({}, null)));
  assert.ok(['calm', 'warm', 'driving', 'moody', 'tense', 'dark'].includes(S.moodOf(null, 'not-a-key')));
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
test('lens: the summit — near-no ceiling at real heat — deals a STACK at last', () => {
  assert.equal(S.pickLens({ ceil: 0.95, act: 2, energy: 0.9, major: true }), 'wave+mirrors');
  assert.equal(S.pickLens({ ceil: 0.95, act: 2, energy: 0.9, major: false }), 'mirrors+moire');
  // one notch below the summit, the old ladder is untouched
  assert.equal(S.pickLens({ ceil: 0.90, act: 2, energy: 0.9, major: true }), 'mirrors');
  assert.equal(S.pickLens({ ceil: 0.95, act: 2, energy: 0.7, major: true }), 'mirrors');
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

// ---- the second lens wave: shelves the director deals in turn, on both stages ----
const LENS2_META = new Function(html.match(/\/\/ @lens2-start\n[\s\S]*?(const LENS2_META = [\s\S]*?\};)/)[1] + '\nreturn LENS2_META;')();
test('lens2: no salt reproduces the original taste, look for look', () => {
  // every assertion above runs saltless; these pin the new comedown and build
  // branches' first looks, which equal the old ones
  assert.equal(S.pickLens({ ceil: 0.70, act: 3, energy: 0.5, major: true }), 'iris');
  assert.equal(S.pickLens({ ceil: 0.70, act: 1, energy: 0.5, major: true }), 'iris');
  assert.equal(S.pickLens({ ceil: 0.70, act: 1, energy: 0.8, major: true }), 'wave');
});
test('lens2: the salt deals every look on a shelf, then wraps', () => {
  const deal = (ctx, n) => Array.from({ length: n }, (_, i) => S.pickLens({ ...ctx, salt: i }));
  assert.deepEqual(deal({ ceil: 0.90, act: 2, energy: 0.85, major: true }, 4), ['mirrors', 'echo', 'hyperbolic', 'mirrors']);
  assert.deepEqual(deal({ ceil: 0.90, act: 2, energy: 0.7, major: true }, 3), ['mirrors', 'hyperbolic', 'mirrors']);
  assert.deepEqual(deal({ ceil: 0.90, act: 2, energy: 0.8, major: false }, 2), ['moire', 'contour']);
  assert.deepEqual(deal({ ceil: 0.90, act: 2, energy: 0.95, major: true }, 2), ['prism', 'grating']);
  assert.deepEqual(deal({ ceil: 0.65, act: 2, energy: 0.9, major: true }, 2), ['tile', 'stained']);
  assert.deepEqual(deal({ ceil: 0.70, act: 1, energy: 0.8, major: true }, 4), ['wave', 'droste', 'halftone', 'halftone+prism']);
  assert.deepEqual(deal({ ceil: 0.70, act: 1, energy: 0.5, major: true }, 2), ['iris', 'bokeh']);
  assert.deepEqual(deal({ ceil: 0.70, act: 3, energy: 0.5, major: true }, 4), ['iris', 'rain', 'transpose', 'stained+rain']);
  assert.deepEqual(deal({ ceil: 0.95, act: 2, energy: 0.9, major: true }, 3), ['wave+mirrors', 'mirrors+echo', 'droste+transpose']);
  assert.deepEqual(deal({ ceil: 0.95, act: 2, energy: 0.9, major: false }, 2), ['mirrors+moire', 'hyperbolic+contour']);
});
test('lens2: ECHO, the loudest look, is never dealt below real heat', () => {
  for (let salt = 0; salt < 12; salt++){
    assert.notEqual(S.pickLens({ ceil: 0.90, act: 2, energy: 0.75, major: true, salt }), 'echo');
    assert.notEqual(S.pickLens({ ceil: 0.70, act: 1, energy: 0.6, major: true, salt }), 'echo');
  }
});
test('lens2: the gates hold whatever the salt — quiet sections, arc edges and strain stay clean', () => {
  for (let salt = 0; salt < 12; salt++){
    assert.equal(S.pickLens({ ceil: 0.40, act: 2, energy: 0.9, salt }), 'none');
    assert.equal(S.pickLens({ ceil: 0.95, act: 0, energy: 0.9, salt }), 'none');
    assert.equal(S.pickLens({ ceil: 0.95, act: 4, energy: 0.9, salt }), 'none');
    assert.equal(S.pickLens({ struggling: true, ceil: 0.95, act: 2, energy: 0.9, salt }), 'none');
    assert.equal(S.pickLens({ ceil: 0.58, act: 3, energy: 0.9, salt }), 'none');
  }
});
test('lens2: every look the director can deal is a lens the engine owns', () => {
  const owned = new Set(['none', 'mirrors', 'wave', 'prism', 'tile', 'moire', 'iris',
    'mirrors+moire', 'mirrors+iris', 'wave+mirrors', 'tile+prism']
    .concat(LENS2_META.singles.map(l => l.key), LENS2_META.stacks.map(l => l.key)));
  for (const act of [0, 1, 2, 3, 4]) for (const ceil of [0.5, 0.65, 0.8, 0.95])
    for (const energy of [0.3, 0.7, 0.82, 0.9, 0.96]) for (const major of [true, false])
      for (let salt = 0; salt < 6; salt++)
        assert.ok(owned.has(S.pickLens({ act, ceil, energy, major, salt })), `${act}/${ceil}/${energy}/${major}/${salt}`);
  // and every stack is built only from singles that exist
  const singles = new Set(['mirrors', 'wave', 'prism', 'tile', 'moire', 'iris'].concat(LENS2_META.singles.map(l => l.key)));
  for (const st of LENS2_META.stacks) for (const m of st.members) assert.ok(singles.has(m), st.key + ' → ' + m);
});
test('lens2: the TV deals the same shelves, code for key (VisualizerView.pickLens)', () => {
  const swift = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/VisualizerView.swift'), 'utf8');
  const code = Object.assign({}, LENS2_META.codes,
    Object.fromEntries(LENS2_META.singles.map(l => [l.key, l.code])),
    Object.fromEntries(LENS2_META.stacks.map(l => [l.key, l.code])),
    { 'wave+mirrors': 6, 'mirrors+moire': 7 });
  const fn = swift.slice(swift.indexOf('private func pickLens('), swift.indexOf('private func lensStackKinds('));
  const tvShelves = [...fn.matchAll(/deal\(\[([\d, ]+)\]\)/g)].map(m => m[1].split(',').map(x => +x.trim()));
  const web = html.slice(html.indexOf('function pickLens(ctx){'), html.indexOf('/* THE SEGUE'));
  const webShelves = [...web.matchAll(/deal\(\[([^\]]+)\]\)/g)]
    .map(m => m[1].split(',').map(x => code[x.trim().replace(/'/g, '')]));
  // the web lists the summit major-first, the TV minor-first: compare as sets of shelves
  const key = a => a.join(',');
  assert.deepEqual(tvShelves.map(key).sort(), webShelves.map(key).sort());
  // the stack table's legs match the web's members
  const kinds = swift.slice(swift.indexOf('private func lensStackKinds('), swift.indexOf('private func autoLens('));
  for (const st of LENS2_META.stacks){
    const m = kinds.match(new RegExp('case ' + st.code + ': return \\[([\\d, ]+)\\]'));
    assert.ok(m, 'stack ' + st.key + ' missing on the TV');
    assert.deepEqual(m[1].split(',').map(x => +x.trim()), st.members.map(k => code[k]));
  }
});
test('lens2: Lens.metal carries a case for every second-wave code', () => {
  const metal = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Lens.metal'), 'utf8');
  for (const l of LENS2_META.singles) assert.ok(metal.includes('    case ' + l.code + ': {'), l.key);
  const hi = Math.max(...LENS2_META.singles.map(l => l.code));
  assert.ok(metal.includes('clamp(U.lens, -1.0, ' + hi.toFixed(1) + ')'), 'the mode clamp reaches ' + hi);
});

/* THE 192-BYTE CONTRACT (stage 2 of the dance layer). Every Metal translation
   unit re-declares VizUniforms verbatim; the two Swift mirrors upload it; the
   web reads the same twelve through #defines onto uDance0..2. A TU whose struct
   drifts reads garbage silently on a device, so the parity is asserted here:
   one struct text across every tvos/**\/*.metal (modulo the three pad
   spellings), a static_assert(sizeof == 192) under each, the twelve at bytes
   144..188 in bus order on all three stages, and no prose left saying 144. */
test('dance bus: every Metal TU declares one 192-byte VizUniforms, static_asserted; the Swift mirrors and the web #defines name the twelve in bus order', async () => {
  const { readdirSync } = await import('fs');
  const metalFiles = [];
  const walk = dir => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })){
      if (e.isDirectory()) walk(dir + '/' + e.name);
      else if (e.name.endsWith('.metal')) metalFiles.push(dir + '/' + e.name);
    }
  };
  walk('tvos');
  metalFiles.sort();
  const pbx = readFileSync(join(root, 'tvos/AethraKairos.xcodeproj/project.pbxproj'), 'utf8');
  const inProject = [...pbx.matchAll(/path = (\w+\.metal);/g)].map(m => m[1]).sort();
  assert.deepEqual(metalFiles.map(f => f.split('/').pop()).sort(), inProject, 'every .metal on disk is in the project and vice versa');
  assert.ok(metalFiles.length >= 45, metalFiles.length + ' translation units');
  // two waves that each pick "the next free id" by hand merge into one id naming two files:
  // Xcode then compiles one of them twice and the other not at all. Every object is defined
  // once, and every reference to it carries the same file name.
  const defs = [...pbx.matchAll(/^\t\t([0-9A-F]{24}) \/\* ([^*]+?) \*\/ = \{/gm)];
  const named = new Map();
  for (const [, id, name] of defs){
    assert.ok(!named.has(id), 'pbxproj id ' + id + ' is defined twice: ' + named.get(id) + ' and ' + name);
    named.set(id, name);
  }
  for (const [, id, name] of pbx.matchAll(/\b([0-9A-F]{24}) \/\* ([^*]+?) \*\//g))
    if (named.has(id)) assert.equal(name, named.get(id), 'pbxproj id ' + id + ' is referenced as ' + name + ' but defined as ' + named.get(id));
  // one struct text — comments and whitespace stripped, the pad spellings normalised
  const normalise = s => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim()
    .replace(/\b_pad1\b/g, 'lens').replace(/\b_pad2\b/g, 'lensAmt').replace(/\bkeyNum\b/g, '_pad3');
  const layoutOf = fields => {                      // Metal/Swift layout: float 4/4, float4 16/16
    let off = 0; const out = [];
    for (const f of fields){
      const size = f.type === 'float4' ? 16 : 4;
      off = Math.ceil(off / size) * size;
      out.push({ name: f.name, type: f.type, off });
      off += size;
    }
    return { fields: out, size: Math.ceil(off / 16) * 16 };
  };
  let first = null, firstFile = null;
  for (const f of metalFiles){
    const src = readFileSync(join(root, f), 'utf8');
    const heads = src.match(/^struct VizUniforms \{/gm) || [];
    assert.equal(heads.length, 1, f + ': exactly one struct VizUniforms');
    const a = src.indexOf('struct VizUniforms {'), b = src.indexOf('};', a);
    assert.ok(a >= 0 && b > a, f + ': struct body');
    const body = normalise(src.slice(a + 'struct VizUniforms {'.length, b));
    if (first === null){ first = body; firstFile = f; }
    assert.equal(body, first, f + ' declares a different VizUniforms than ' + firstFile);
    const after = src.slice(b, b + 400);
    assert.ok(/^\};\s*\nstatic_assert\(sizeof\(VizUniforms\) == 192,/.test(after), f + ': static_assert(sizeof(VizUniforms) == 192) directly under the struct');
    assert.ok(src.slice(a, b).includes('-> stride 192'), f + ': the struct says stride 192');
    assert.ok(!/FIXED at 144|-> stride 144|144-byte fixed|stride is 144/.test(src), f + ': no prose still says the struct is 144 bytes');
  }
  // the layout the one text describes: bytes 0..143 untouched, the twelve at 144..188, 192 in all
  const metalFields = [...first.matchAll(/\b(float4|float)\s+(\w+)\s*;/g)].map(m => ({ type: m[1], name: m[2] }));
  const ml = layoutOf(metalFields);
  assert.equal(ml.size, 192, 'sizeof(VizUniforms) is 192');
  assert.equal(ml.fields.length, 39, '27 wave-3 fields + the twelve');
  assert.deepEqual(ml.fields.slice(0, 4).map(f => f.name), ['time', 'beatPhase', 'barPhase', 'energy']);
  assert.deepEqual(ml.fields.filter(f => f.type === 'float4').map(f => f.off), [48, 64, 80], 'the three colour float4s stay at 48/64/80');
  assert.equal(ml.fields.find(f => f.name === 'roll2').off, 128, 'roll2 stays at 128: bytes 0..143 never moved');
  const twelve = ml.fields.slice(27);
  assert.deepEqual(twelve.map(f => f.name), S.DANCE_BUS.NAMES, 'the twelve, in bus order, close the struct');
  assert.deepEqual(twelve.map(f => f.off), S.DANCE_BUS.NAMES.map((_, i) => 144 + 4 * i), 'dHit at 144 … dPeriod at 188');
  // the two Swift mirrors: the same type sequence, the same twelve names and offsets, the stride asserted
  for (const sf of ['tvos/AethraKairosTV/Visualizer/VisualizerView.swift', 'tvos/AethraKairosTV/Stage/StageRenderer.swift']){
    const sw = readFileSync(join(root, sf), 'utf8');
    const a = sw.indexOf('private struct VizUniforms {'), b = sw.indexOf('\n}', a);
    assert.ok(a >= 0 && b > a, sf + ': the mirror');
    const fields = [...sw.slice(a, b).replace(/\/\/[^\n]*/g, '').matchAll(/var (\w+)(?:: (SIMD4<Float>|Float)\b| = (SIMD4<Float>)\()/g)]
      .map(m => ({ name: m[1], type: (m[2] || m[3]) === 'Float' ? 'float' : 'float4' }));
    const sl = layoutOf(fields);
    assert.equal(sl.size, 192, sf + ': MemoryLayout<VizUniforms>.stride == 192');
    assert.deepEqual(sl.fields.map(f => f.type), ml.fields.map(f => f.type), sf + ': the same 39 slots, in the same types, as the Metal struct');
    assert.deepEqual(sl.fields.slice(27).map(f => [f.name, f.off]), twelve.map(f => [f.name, f.off]), sf + ': the twelve at 144..188 in bus order');
    assert.ok(sw.includes('assert(MemoryLayout<VizUniforms>.stride == 192'), sf + ': configure(view:) asserts the stride');
    assert.ok(!/FIXED at 144|-> stride 144|144-byte fixed|stride is 144/.test(sw), sf + ': no prose still says 144');
    for (const n of S.DANCE_BUS.NAMES) assert.ok(new RegExp('u\\.' + n + ' = ').test(sw), sf + ' fills u.' + n);
  }
  // the web: the embedded GLSL_DANCE #defines (not the emitter) — the same twelve onto uDance0..2 in order
  const g0 = html.indexOf('const GLSL_DANCE = `'), g1 = html.indexOf('`;', g0);
  assert.ok(g0 >= 0 && g1 > g0, 'GLSL_DANCE is embedded in the player');
  const defines = [...html.slice(g0, g1).matchAll(/#define (d\w+) (uDance[012])\.([xyzw])/g)].map(m => [m[1], m[2], m[3]]);
  assert.deepEqual(defines.map(d => d[0]), S.DANCE_BUS.NAMES, 'the web #defines name the twelve in bus order');
  assert.deepEqual(defines.map(d => d[1] + '.' + d[2]), S.DANCE_BUS.NAMES.map((_, i) => 'uDance' + (i >> 2) + '.' + 'xyzw'[i & 3]), 'each rides its vec4 lane');
  // the stage wire carries the same twelve, clamped
  const packet = readFileSync(join(root, 'tvos/AethraKairosTV/Stage/StagePacket.swift'), 'utf8');
  assert.ok(packet.includes('static let danceCount = 12') && packet.includes('var dance: [Float]'), 'StagePacket carries twelve');
  const ranges = [...packet.slice(packet.indexOf('static let danceRanges')).matchAll(/\(\s*(-?[\d.]+),\s*(-?[\d.]+)\)\s*,?\s*\/\/\s*(\d+) (d\w+)/g)].map(m => [+m[3], m[4], +m[1], +m[2]]);
  assert.deepEqual(ranges.map(r => r[1]), S.DANCE_BUS.NAMES, 'the wire clamps the twelve in bus order');
  assert.deepEqual(ranges.map(r => r[0]), S.DANCE_BUS.NAMES.map((_, i) => i));
  const want = { dHit: [0, 1.5], dAge: [0, 4], dKick: [-0.35, 1.25], dSway: [-1, 1], dImpact: [0, 8], dPeriod: [0, 1] };
  for (const r of ranges){ const w = want[r[1]] || [0, 1]; assert.deepEqual([r[2], r[3]], w, r[1] + ' clamps to ' + w); }
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
// ---- the hand's phases: a DJ on the crossfader outranks the planner's line ----
test('mix narration: a hand on the fader (no seam) says both decks are the hand\'s, even with MIX off', () => {
  const s = S.mixNarration({ on: true, phase: 'idle', hand: true });
  assert.match(s, /^HAND on the fader/); assert.match(s, /tap AUTO to hand it back/);
  assert.match(S.mixNarration({ on: false, hand: true }), /^HAND on the fader/, 'the DJ holding the handle is who reads this');
  assert.match(S.mixNarration({ on: true, direct: true, hand: true }), /direct-to-output/, 'but the direct path has no handle');
});
test('mix narration: a yielded seam (manual) names the blend taken and where parking the fader finishes it', () => {
  const s = S.mixNarration({ on: true, phase: 'manual', pct: 37, handDeck: 'B', nextTitle: 'Pulse', planType: 'beatmix' });
  assert.equal(s, 'HAND · you took the blend at 37% — park the fader on B to finish it');
  assert.match(S.mixNarration({ on: true, phase: 'manual', handDeck: 'A' }), /at 0% — park the fader on A/, 'no pct reads as 0; the letter is the incoming deck\'s');
});
test('mix narration: a hand\'s commit is said as done; an audition names the deck under the handle', () => {
  assert.equal(S.mixNarration({ on: true, phase: 'idle', done: 'B' }), 'done — B is on air · the planner has the room again');
  assert.equal(S.mixNarration({ on: true, phase: 'idle', audition: 'B' }), 'B playing under the fader — bring it in when it feels right');
  assert.equal(S.mixNarration({ on: true, phase: 'idle', audition: 'A' }), 'A playing under the fader — bring it in when it feels right');
  // precedence: the handle in hand outranks a finished commit and an audition
  assert.match(S.mixNarration({ on: true, hand: true, done: 'B', audition: 'A' }), /^HAND on the fader/);
  assert.match(S.mixNarration({ on: true, phase: 'manual', hand: true, done: 'B' }), /^HAND · you took/);
});
test('mix narration: SYNC names the matched deck and tempo; CUT names the switch; the planner\'s plan still outranks CUT', () => {
  assert.equal(S.mixNarration({ on: true, phase: 'idle', sync: { deck: 'B', bpm: 123.6 } }), 'SYNC · B matched at 124');
  assert.equal(S.mixNarration({ on: true, phase: 'idle', cut: true }), 'CUT curve — the fader is a switch; scratch with it');
  assert.match(S.mixNarration({ on: true, phase: 'armed', planType: 'fade', seamSec: 5, cut: true }), /^CUED/, 'an armed seam is the line that matters');
  assert.match(S.mixNarration({ on: true, phase: 'running', planType: 'fade', pct: 10, cut: true }), /^MIXING/);
  assert.match(S.mixNarration({ on: true, phase: 'planning', planType: 'fade', seamSec: 50, cut: true }), /^CUT curve/, 'a peek ahead does not');
  assert.match(S.mixNarration({ on: false, cut: true }), /MIX is off/, 'MIX off is the status; the curve is a detail');
  assert.match(S.mixNarration({ on: false, sync: { deck: 'A', bpm: 120 } }), /^SYNC · A matched at 120/, 'a synced deck is worth saying with MIX off');
});
test('mix narration: without any hand flag the planner\'s lines are exactly what they were', () => {
  assert.equal(S.mixNarration({ on: true, phase: 'idle' }), 'watching the clock — the planner arms 90 s before the end');
  assert.equal(S.mixNarration({ on: true, phase: 'idle', hand: false, done: null, audition: null, sync: null, cut: false }),
    'watching the clock — the planner arms 90 s before the end');
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

// ---- STEM LIGHT: the room hears the band, not the mix (@stem) ----
// a 12 Hz score: `kit` is a kick every half second (one '9' then five '1's),
// `none` is silence; the envelopes are composed per test.
const STEM_HZ = 12;
const kitBars = s => '911111'.repeat(Math.round(s * 2));
const flat = (ch, s) => ch.repeat(Math.round(s * STEM_HZ));
function runStems(stems, from, to, opts = {}){
  const st = S.makeStemLightState(), dt = 1 / 60, frames = [];
  for (let t = from; t < to; t += dt){
    S.stemLightStep(st, { stems, pos: t, playing: opts.playing !== false }, dt);
    frames.push({ t, st: { ...st }, out: S.stemLightOut(st) });
  }
  return frames;
}
test('stem light: no stems (or the mic) is exactly neutral — the show is unchanged', () => {
  for (const stems of [null, undefined, { sv: 1 }, { sv: 1, hz: 0, d: '999' }]){
    const fr = runStems(stems, 0, 3);
    for (const { out } of fr){
      assert.equal(out.beatGate, 1); assert.equal(out.bassMul, 1); assert.equal(out.midMul, 1);
      assert.equal(out.chromaAdd, 0); assert.equal(out.lightMul, 1); assert.equal(out.whiteMul, 1);
      assert.equal(out.coil, 0); assert.equal(out.landed, false);
    }
  }
});
test('stem light: paused stems fade out of authority, never pop', () => {
  const stems = { sv: 1, hz: STEM_HZ, d: kitBars(20), b: flat('9', 20), v: flat('0', 20), o: flat('0', 20) };
  const st = S.makeStemLightState();
  for (let t = 0; t < 6; t += 1 / 60) S.stemLightStep(st, { stems, pos: t, playing: true }, 1 / 60);
  assert.ok(st.conf > 0.95, 'six seconds in, the stems have authority');
  let prev = st.conf;
  for (let k = 0; k < 120; k++){
    S.stemLightStep(st, { stems, pos: 6, playing: false }, 1 / 60);
    assert.ok(st.conf <= prev && prev - st.conf < 0.02, 'conf decays smoothly');
    prev = st.conf;
  }
});
test('stem light: the strike belongs to the kit — no drums, the beat falls to a breath', () => {
  const stems = { sv: 1, hz: STEM_HZ, d: kitBars(8) + flat('0', 8), b: flat('5', 16), v: flat('0', 16), o: flat('6', 16) };
  const fr = runStems(stems, 0, 16);
  const at = t => fr.find(f => f.t >= t).out;
  assert.ok(at(7).beatGate > 0.9, 'kit playing: the beat channel is open');
  assert.ok(at(15.5).beatGate < S.STEM_LIGHT.gateFloor + 0.05, 'kit gone: the beat is a breath');
  assert.ok(at(15.5).whiteMul < 0.6, 'and no kit buys no bleach');
  assert.ok(fr.every(f => f.out.beatGate >= S.STEM_LIGHT.gateFloor - 1e-9 && f.out.beatGate <= 1 + 1e-9));
});
test('stem light: the kit\'s return is seen coming — the coil rises, then lands exactly once', () => {
  // 6 s groove, 6 s breakdown (voice + pad, no kit), the drums come back at 12 s
  const d = kitBars(6) + flat('0', 6) + kitBars(6);
  const stems = { sv: 1, hz: STEM_HZ, d, b: flat('4', 18), v: flat('0', 6) + flat('7', 6) + flat('2', 6), o: flat('5', 18) };
  const fr = runStems(stems, 0, 18);
  const landings = fr.filter(f => f.out.landed);
  assert.equal(landings.length, 1, 'one return, one landing');
  assert.ok(Math.abs(landings[0].t - 12) < 0.12, `it lands on the return (${landings[0].t.toFixed(3)} s)`);
  const pre = fr.filter(f => f.t > 10.6 && f.t < 11.95);
  assert.ok(Math.max(...pre.map(f => f.out.coil)) > 0.8, 'the room inhales before the drums arrive');
  assert.ok(fr.filter(f => f.t > 7 && f.t < 9.4).every(f => f.out.coil < 0.05), 'no coil while the return is out of sight');
  assert.ok(fr.filter(f => f.t > 12.2).every(f => f.out.coil < 0.05), 'the landing releases the coil');
  // and the band is named
  const sect = t => fr.find(f => f.t >= t).st.section;
  assert.equal(sect(10), 'break'); assert.ok(['groove', 'drop', 'song'].includes(sect(15)));
});
test('stem light: a seek is a cut, not a drop — no landing across a jump', () => {
  const stems = { sv: 1, hz: STEM_HZ, d: flat('0', 10) + kitBars(10), b: flat('4', 20), v: flat('0', 20), o: flat('4', 20) };
  const st = S.makeStemLightState();
  for (let t = 0; t < 6; t += 1 / 60) S.stemLightStep(st, { stems, pos: t, playing: true }, 1 / 60);
  let landed = 0;
  for (let t = 15; t < 17; t += 1 / 60){ S.stemLightStep(st, { stems, pos: t, playing: true }, 1 / 60); if (st.landed) landed++; }
  assert.equal(landed, 0);
  assert.equal(st.kit, true, 'the kit is re-read where the needle landed');
});
test('stem light: the voice saturates, a hush cools, a bassline weighs', () => {
  const sing = runStems({ sv: 1, hz: STEM_HZ, d: kitBars(8), b: flat('2', 8), v: flat('9', 8), o: flat('3', 8) }, 0, 8).pop().out;
  const hush = runStems({ sv: 1, hz: STEM_HZ, d: flat('0', 8), b: flat('0', 8), v: flat('0', 8), o: flat('3', 8) }, 0, 8).pop().out;
  const heavy = runStems({ sv: 1, hz: STEM_HZ, d: kitBars(8), b: flat('9', 8), v: flat('0', 8), o: flat('3', 8) }, 0, 8).pop().out;
  assert.ok(sing.chromaAdd > 0.15 && sing.midMul > 1.1 && sing.lightMul > 1.03);
  assert.ok(hush.chromaAdd < -0.1);
  assert.ok(heavy.bassMul > 1.15 && sing.bassMul < 1);
});
test('stem light: every output is finite whatever the input', () => {
  const st = S.makeStemLightState();
  const stems = { sv: 1, hz: STEM_HZ, d: 'x9a0', b: '', v: null, o: '5' };
  for (const [pos, dt] of [[NaN, 1 / 60], [-4, 1 / 60], [1e9, 1 / 60], [1, -1], [1, NaN], [1, 99], [2, 1 / 60]]){
    S.stemLightStep(st, { stems, pos, playing: true }, dt);
    const o = S.stemLightOut(st);
    for (const k of ['beatGate', 'bassMul', 'midMul', 'chromaAdd', 'lightMul', 'whiteMul', 'coil'])
      assert.ok(Number.isFinite(o[k]), `${k} finite at pos ${pos}, dt ${dt}`);
  }
  assert.equal(S.stemSection(false, 0, 0), 'hush'); assert.equal(S.stemSection(false, 0.5, 0.6), 'break');
  assert.equal(S.stemSection(true, 0.2, 0.5), 'song'); assert.equal(S.stemSection(true, 0.7, 0.1), 'drop');
  assert.equal(S.stemSection(true, 0.2, 0.1), 'groove');
});

// ---- THE DRUM CHART: the strike is the drummer's own hit (@stem) ----
// the pipeline's encoder, retold in the test so the format is pinned from
// both ends (tools/stems.py hits_encode is the writer; selftest checks it)
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
function hitsEncodeT(times){
  let out = '', prev = 0;
  for (const t of times){
    const cs = Math.round(t * 100); let d = Math.max(0, cs - prev);
    while (d >= S.HIT_SKIP){ out += 'zz'; d -= S.HIT_SKIP; }
    out += B36[Math.floor(d / 36)] + B36[d % 36]; prev = cs;
  }
  return out;
}
test('drum chart: the code round-trips, long gaps and garbage included', () => {
  const times = [0, 0.01, 0.5, 13, 40.27, 40.28, 200];
  assert.deepEqual(S.hitsDecode(hitsEncodeT(times)), times);
  assert.deepEqual(S.hitsDecode(''), []);
  assert.deepEqual(S.hitsDecode(null), []);
  assert.deepEqual(S.hitsDecode('0a0A'), [0.1], 'stops at the first character outside the alphabet');
  assert.deepEqual(S.hitsDecode('0'), [], 'a dangling half-pair is ignored');
  assert.equal(S.hitsChart(null), null);
  assert.equal(S.hitsChart({ sv: 1, d: '9' }), null, 'a v1 block has no chart');
  assert.equal(S.hitsChart({ sv: 2, hits: { k: '', s: '', h: '' } }), null, 'an empty chart is no chart');
  const c = S.hitsChart({ sv: 2, hits: { k: hitsEncodeT([1, 2]), s: hitsEncodeT([2]), h: '' } });
  assert.deepEqual(c, { k: [1, 2], s: [2], h: [] });
});
test('drum chart: hitsLast is the last hit at or before the playhead', () => {
  const a = [1, 2, 3.5];
  assert.equal(S.hitsLast(a, 0.99), -1); assert.equal(S.hitsLast(a, 1), 0);
  assert.equal(S.hitsLast(a, 3.49), 1); assert.equal(S.hitsLast(a, 99), 2); assert.equal(S.hitsLast([], 1), -1);
});
test('drum chart: the pulse strikes ON the hit, by voice, and decays', () => {
  const c = { k: [1], s: [2], h: [3] };
  assert.equal(S.hitPulse(c, 0.999), 0, 'nothing before the hit — the light never lands ahead of the drum');
  assert.ok(Math.abs(S.hitPulse(c, 1) - 1) < 1e-9, 'the kick is the full strike');
  assert.ok(Math.abs(S.hitPulse(c, 2) - 0.8) < 1e-9, 'the snare a step under');
  assert.ok(Math.abs(S.hitPulse(c, 3) - 0.25) < 1e-9, 'the hat a glint');
  assert.ok(S.hitPulse(c, 1.1) < S.hitPulse(c, 1.05) && S.hitPulse(c, 1.05) < 1, 'it decays');
  assert.equal(S.hitPulse(c, 1 + 4 * S.HIT_VOICES.k.tau + 0.01), 0, 'and is gone after four taus');
  assert.equal(S.hitPulse(null, 1), 0); assert.equal(S.hitPulse(c, NaN), 0);
  // a kick and a snare together: the louder voice wins
  assert.ok(Math.abs(S.hitPulse({ k: [5], s: [5], h: [5] }, 5) - 1) < 1e-9);
});
test('drum chart: with a chart the hit is the truth; without, the channel is untouched', () => {
  assert.equal(S.hitBlend(0.7, 0.2, false), 0.7, 'no chart: exactly the gated channel');
  assert.equal(S.hitBlend(0.5, 1, true), 1, 'the hit lands');
  assert.ok(Math.abs(S.hitBlend(0.5, 0, true) - 0.3) < 1e-9, 'a fill the chart lacks still whispers');
});
test('stem mood: the band names the moment, never inventing an unearned peak', () => {
  const M = ['adrift', 'ascend', 'drive', 'apex', 'swarm', 'dissolve'];
  for (const m of M){
    assert.equal(S.stemMood(m, 'drop', 0.3, 1), m, 'no authority, no change');
    assert.equal(S.stemMood(m, 'none', 1, 1), m);
  }
  assert.equal(S.stemMood('drive', 'drop', 1, 1), 'apex');
  assert.equal(S.stemMood('ascend', 'drop', 1, 0.3), 'ascend', 'a capped ceiling keeps the drop below apex');
  assert.equal(S.stemMood('adrift', 'drop', 1, 1), 'drive');
  assert.equal(S.stemMood('apex', 'break', 1, 1), 'dissolve');
  assert.equal(S.stemMood('drive', 'break', 1, 1), 'adrift');
  assert.equal(S.stemMood('ascend', 'break', 1, 1), 'ascend', 'a breakdown is often the build');
  assert.equal(S.stemMood('drive', 'hush', 1, 1), 'adrift');
  assert.equal(S.stemMood('dissolve', 'hush', 1, 1), 'dissolve');
  assert.equal(S.stemMood('adrift', 'song', 1, 1), 'drive');
  assert.equal(S.stemMood('adrift', 'groove', 1, 1), 'drive');
  for (const sec of ['hush', 'break', 'groove', 'song', 'drop', 'none'])
    for (const m of M) assert.ok(M.includes(S.stemMood(m, sec, 1, 1)), `${m}/${sec} stays a mood`);
});
test('QUARTET: the window samples each player\'s score, the drums beaded with the chart', () => {
  const N = S.QUARTET_N, W = S.QUARTET_WIN;
  const stems = { sv: 2, hz: 12, d: '0'.repeat(120) + '5'.repeat(120), b: '9'.repeat(240), v: '0'.repeat(240), o: '3'.repeat(240) };
  const out = new Float32Array(N * 4);
  // centred on 10 s: the window runs 7..13 s; the drums' envelope steps up at 10 s
  for (let i = 0; i < N; i++) S.quartetLane(out, i, stems, null, 10, 20);
  assert.ok(out[0] === 0 && out[(N - 1) * 4] > 0.5, 'the past is drumless, the future has the kit');
  assert.ok(Math.abs(out[1] - 1) < 1e-6 && Math.abs(out[3] - 3 / 9) < 1e-6, 'bass and the rest read their score');
  // a chart beads the drums: a hit inside the window strikes its sample
  const hitAt = 10 + ((5 + 0.5) / N - 0.5) * W;
  S.quartetLane(out, 5, stems, { k: [hitAt], s: [], h: [] }, 10, 20);
  assert.ok(Math.abs(out[20] - 1) < 1e-6, 'the hit is the full strike in its sample');
  // outside the track: silence, both ends
  S.quartetLane(out, 0, stems, null, 1, 20); assert.equal(out[1], 0, 'before the start');
  S.quartetLane(out, N - 1, stems, null, 19, 20); assert.equal(out[(N - 1) * 4 + 1], 0, 'past the end');
  S.quartetLane(out, 3, null, null, 10, 20); assert.equal(out[12] + out[13] + out[14] + out[15], 0, 'no stems: silence');
});
test('stem light: the TV\'s StemLight carries the web\'s constants and formulas (parity)', () => {
  const swift = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Dance.swift'), 'utf8');
  const body = swift.slice(swift.indexOf('struct StemLight'));
  assert.ok(body.length > 100, 'StemLight is in Dance.swift');
  const num = name => {
    const m = body.match(new RegExp(`\\b${name} = ([0-9.]+)`));
    assert.ok(m, `StemLight.${name} declared`);
    return Number(m[1]);
  };
  for (const k of Object.keys(S.STEM_LIGHT)) assert.equal(num(k), S.STEM_LIGHT[k], `STEM_LIGHT.${k}`);
  for (const f of ['0.70 + 0.55 * bb', '0.85 + 0.30 * vv', '0.20 * vv - 0.14 * (1 - dd) * (1 - vv)',
                   '1 + c * 0.05 * vv', '0.55 + 0.45 * dd', '* 1.15', 'coil = ease(coil, coming ? 1 : 0, 0.35, 0.25)'])
    assert.ok(body.includes(f), `the Swift port carries "${f}"`);
  for (const k of ['hush', 'break', 'groove', 'song', 'drop']) assert.ok(body.includes(`"${k}"`) || body.includes(` ${k}`), k);
  const rooms = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Rooms.swift'), 'utf8');
  const cut = rooms.match(/static let stemCutDwell: Double = ([0-9.]+)/);
  assert.ok(cut && Number(cut[1]) === S.STEM_CUT_DWELL, 'the kit\'s-return cut waits the same dwell on both stages');
  assert.ok(html.includes('STEMS.out.landed && director.dwell >= STEM_CUT_DWELL'), 'the web SEGUE cuts on the landing');
  // the drum chart's voices and the band's mood rules, on the TV
  const f2 = x => x.toFixed(2);
  for (const [name, v] of [['hitKick', 'k'], ['hitSnare', 's'], ['hitHat', 'h']])
    assert.ok(body.includes(`${name} = (amp: ${f2(S.HIT_VOICES[v].amp)}, tau: ${f2(S.HIT_VOICES[v].tau)})`), `${name} matches HIT_VOICES.${v}`);
  assert.ok(body.includes('haveChart ? max(gated * 0.6, pulse) : gated'), 'hitBlend matches');
  for (const rule of ["case .hush:   return m == .dissolve ? .dissolve : .adrift",
                      "case .brk:    return m == .apex ? .dissolve : (m == .drive ? .adrift : m)",
                      "case .drop:   return (m == .drive || m == .ascend) && ceil > 0.4 ? .apex : (m == .adrift ? .drive : m)",
                      "case .song:   return m == .adrift ? .drive : m",
                      "case .groove: return m == .adrift ? .drive : m",
                      "guard conf > 0.5 else { return m }"])
    assert.ok(rooms.includes(rule), `Director.stemMood carries: ${rule}`);
  assert.ok(body.includes(`quartetN = ${S.QUARTET_N}`) && body.includes(`quartetWin = ${S.QUARTET_WIN.toFixed(1)}`), 'QUARTET window matches');
  assert.ok(body.includes('chart != nil ? max(d * 0.55, hitPulse(chart, t)) : d'), 'QUARTET beads the drums the same way');
  const view = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/VisualizerView.swift'), 'utf8');
  for (const f of ['stemLight.step(', 'kitReturn: stemOut.landed', 'stemOut.beatGate', 'stemOut.bassMul', 'stemOut.midMul',
                   'stemOut.chromaAdd', 'stemOut.lightMul', 'stemOut.whiteMul', 'stemOut.coil'])
    assert.ok(view.includes(f), `the TV renderer reads ${f}`);
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

// ---------------------------------------------------------------- the room

const FEATS = ['bass', 'mid', 'treble', 'energy', 'calm', 'beat', 'entropy', 'centroid', 'coupling'];

test('SCENE_TASTE: every room on the roster has a character, in real features', () => {
  for (const k of S.SCENE_KEYS)
    assert.ok(S.SCENE_TASTE[k], `${k} has no taste — it would score a flat 1 for ever`);
  for (const k of Object.keys(S.SCENE_TASTE)){
    assert.ok(S.SCENE_KEYS.includes(k), `${k} is not on the roster`);
    for (const f of Object.keys(S.SCENE_TASTE[k]))
      assert.ok(f === 'base' || FEATS.includes(f), `${k} wants "${f}", which is not a feature`);
  }
  // the whole point of the rewrite: no room is left out of the deal
  assert.equal(S.SCENE_KEYS.length, 124);
});

test('creatureGenome: every form deals a bounded genome, whole where closed', () => {
  const OPEN = ['wyrm', 'kelp', 'siphon', 'moth'];   // a spine, a stalk, a chain, a wing — each just ends
  assert.equal(S.CREATURE_FORMS.length, 9, 'nine pages in the book');
  for (const F of S.CREATURE_FORMS){
    const rng = S.mulberry32(7 + F.key.length);
    for (let n = 0; n < 200; n++){
      const g = S.creatureGenome(F.key, rng);
      assert.equal(g.form, F.key);
      for (const [k, lo, hi] of [['ribs', 2, 9], ['ribLen', 4.5, 16], ['tip', 0.5, 0.92],
        ['curl', 0.2, 1.5], ['span', 16, 34], ['puff', 1.5, 4], ['seed', 0, 1],
        ['swim', 0.6, 1.4], ['sway', 0.8, 2], ['sharp', 0.8, 2.6]])
        assert.ok(g[k] >= lo && g[k] <= hi, `${F.key}.${k} = ${g[k]} outside [${lo}, ${hi}]`);
      if (OPEN.includes(F.key)) assert.equal(g.petals, 0, 'an open body has no symmetry order');
      else {
        /* the closure rule: cos(n·θ) only meets itself around a circle when n
           is whole — a rim harmonic that misses its own start is a tear */
        for (const k of ['petals', 'ribs', 'waveF1', 'waveF2'])
          assert.equal(g[k], Math.round(g[k]), `${F.key}.${k} must be whole, got ${g[k]}`);
        assert.ok(g.petals >= 2, 'a closed body carries a real symmetry order');
      }
    }
  }
  // the deal is a pure function of its rng: same seed, same animal
  assert.deepEqual(S.creatureGenome('medusa', S.mulberry32(99)),
                   S.creatureGenome('medusa', S.mulberry32(99)), 'no hidden dice');
});

test('barkleyStep: the medium is excitable — dead stays dead, a whisper dies, a wave travels', () => {
  const W = 48, H = 12;
  const P = S.BARKLEY_REGIMES.find(r => r.key === 'spiral');
  const mk = () => ({ u: new Float64Array(W * H), v: new Float64Array(W * H) });
  const step = (s, n) => { for (let i = 0; i < n; i++) s = S.barkleyStep(s.u, s.v, W, H, P); return s; };
  const maxU = s => { let m = 0; for (const x of s.u) if (x > m) m = x; return m; };
  const peakCol = s => {
    const col = new Float64Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) col[x] += s.u[y * W + x];
    let best = 0; for (let x = 1; x < W; x++) if (col[x] > col[best]) best = x;
    return best;
  };
  // 1 · the rest state is genuinely dead: u = v = 0 is an equilibrium
  assert.equal(maxU(step(mk(), 40)), 0, 'nothing fires from nothing');
  // 2 · a sub-threshold whisper dissolves instead of igniting
  let s = mk(); s.u[6 * W + 24] = 0.05;
  assert.ok(maxU(step(s, 120)) < 0.05, 'a whisper is not a wave');
  // 3 · a supra-threshold front PROPAGATES — fire with ash on one flank moves
  //     away from the ash, and is still burning long after it left home
  s = mk();
  for (let y = 0; y < H; y++){
    for (let x = 2; x <= 4; x++) s.u[y * W + x] = 1;
    for (let x = 0; x < 2; x++) s.v[y * W + x] = 0.8;
  }
  const mid = step(s, 60);
  assert.ok(maxU(mid) > 0.8, 'the front is alive on the way');
  assert.ok(peakCol(mid) > 6, `…and it has left home: peak at col ${peakCol(mid)}`);
  const late = step(mid, 90);
  assert.ok(maxU(late) > 0.8, 'on a ring the pulse just keeps circulating');
  // 4 · the integrator launders its inputs — nothing escapes [0,1]×[0,1.2]
  s = mk(); s.u[0] = 5; s.v[1] = -3;
  const one = S.barkleyStep(s.u, s.v, W, H, P);
  assert.ok(one.u.every(x => x >= 0 && x <= 1) && one.v.every(x => x >= 0 && x <= 1.2));
});
test('looks: a kept moment round-trips, and a poisoned link decodes to nothing', () => {
  const valid = { lenses: ['none', 'mirrors', 'mirrors+moire'], colors: ['auto', 'duo'] };
  const code = S.lookEncode({ scene: 'creature', lens: 'mirrors+moire', color: 'duo' });
  assert.deepEqual(S.lookDecode(code, valid), { scene: 'creature', lens: 'mirrors+moire', color: 'duo' });
  // every segment is validated against its roster — a bookmark is not an injection point
  assert.deepEqual(S.lookDecode('nonsense~<script>~%00', valid), { scene: null, lens: null, color: null });
  assert.deepEqual(S.lookDecode('', valid), { scene: null, lens: null, color: null });
  assert.deepEqual(S.lookDecode(null, valid), { scene: null, lens: null, color: null });
  assert.equal(S.lookDecode('barkley', valid).scene, 'barkley', 'the scene roster is the pure block’s own');
  assert.equal(S.lookEncode({ scene: 'A B<>', lens: null }), 'ab', 'the encoder launders on the way out too');
});
test('mixsetVisualAt: a section may plan the room, and only a real plan counts', () => {
  const set = { sections: [
    { name: 'Dinner', minutes: 1, visual: { scene: 'verse' } },
    { name: 'Dancing', minutes: 1, visual: { scene: 'barkley', lens: 'mirrors' } },
    { name: 'Late', minutes: 1 },
    { name: 'Junk', minutes: 1, visual: { scene: 42 } },
  ] };
  assert.deepEqual(S.mixsetVisualAt(set, 10), { section: 'Dinner', scene: 'verse', lens: null });
  assert.deepEqual(S.mixsetVisualAt(set, 70), { section: 'Dancing', scene: 'barkley', lens: 'mirrors' });
  assert.equal(S.mixsetVisualAt(set, 130), null, 'no cue, no nudge');
  assert.equal(S.mixsetVisualAt(set, 190), null, 'a malformed cue is no cue');
  assert.equal(S.mixsetVisualAt(null, 0), null);
});

test('BARKLEY_REGIMES: three weathers, each a lawful parameterisation', () => {
  assert.equal(new Set(S.BARKLEY_REGIMES.map(r => r.key)).size, S.BARKLEY_REGIMES.length);
  for (const r of S.BARKLEY_REGIMES){
    assert.ok(r.name && typeof r.name === 'string');
    assert.ok(r.b > 0 && r.b < r.a && r.a <= 1, `${r.key}: the threshold (v+b)/a must live inside (0,1)`);
    assert.ok(r.eps > 0 && r.eps <= 0.2, `${r.key}: ε=${r.eps} must keep forward Euler honest at dt=${S.BARKLEY.dt}`);
    assert.ok(['cross', 'sparks'].includes(r.seed));
  }
  assert.ok(S.BARKLEY.dt > 0 && S.BARKLEY.dt <= 0.25, 'under the diffusion stability ceiling h²/4');
});

test('creatureSeed: a song is a stable animal — same id, same seed, same genome', () => {
  assert.equal(S.creatureSeed('sha-abc123'), S.creatureSeed('sha-abc123'));
  assert.notEqual(S.creatureSeed('sha-abc123'), S.creatureSeed('sha-abc124'),
    'different songs, different animals');
  const s = S.creatureSeed('x');
  assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xFFFFFFFF, 'a 32-bit seed for mulberry32');
  assert.equal(S.creatureSeed(null), S.creatureSeed(''), 'nothing hashes honestly, never throws');
  // and the whole deal downstream is deterministic: id → seed → rng → genome
  assert.deepEqual(S.creatureGenome('comb', S.mulberry32(S.creatureSeed('song-1'))),
                   S.creatureGenome('comb', S.mulberry32(S.creatureSeed('song-1'))),
    'the same song grows the same creature');
});
test('sceneScore: an appetite is for presence, a negative one for ABSENCE', () => {
  const loud = { energy: 1, entropy: 1, calm: 0 };
  const quiet = { energy: 0, entropy: 0, calm: 1 };
  assert.equal(S.sceneScore(null, loud), 1, 'a room with no taste still gets its turn');
  assert.equal(S.sceneScore({}, loud), 1);
  assert.equal(S.sceneScore({ energy: 2 }, loud), 3);
  assert.equal(S.sceneScore({ energy: 2 }, quiet), 1);
  assert.equal(S.sceneScore({ entropy: -1 }, quiet), 2, 'wanting order is worth a point when there is order');
  assert.equal(S.sceneScore({ entropy: -1 }, loud), 1, '…and nothing when there is none');
  assert.equal(S.sceneScore({ base: 0.5 }, loud), 1.5);
  assert.equal(S.sceneScore({ energy: 1, junk: NaN }, loud), 2, 'nonsense weights are ignored, not NaN-ed');
  // the rooms genuinely disagree about the same moment — that IS the engine
  const hot = { energy: 0.95, beat: 0.9, bass: 0.8, entropy: 0.2, calm: 0.1, coupling: 0.3, mid: 0.4, treble: 0.6 };
  const starburst = S.sceneScore(S.SCENE_TASTE.starburst, hot);
  const fern = S.sceneScore(S.SCENE_TASTE.fern, hot);
  assert.ok(starburst > fern * 1.8, `percussive material wants STARBURST (${starburst}) over FERN (${fern})`);
});
test('recencyPenalty: the room we just left comes back last, and gradually', () => {
  const recent = [3, 7, 1];
  assert.equal(S.recencyPenalty(recent, 9, 5), 1, 'somewhere we have not been is undamped');
  assert.ok(S.recencyPenalty(recent, 3, 5) < 0.2, 'the room we just left is nearly out');
  assert.ok(S.recencyPenalty(recent, 7, 5) > S.recencyPenalty(recent, 3, 5), 'older recovers');
  assert.ok(S.recencyPenalty(recent, 1, 5) > S.recencyPenalty(recent, 7, 5), 'and older still recovers more');
  assert.equal(S.recencyPenalty([], 0, 5), 1);
  assert.equal(S.recencyPenalty(recent, 3, 0), 1, 'no memory, no damping');
});
test('roomMood: six words, in priority order', () => {
  assert.equal(S.roomMood({ act: 2, ceil: 0.9, energy: 0.8 }), 'apex');
  assert.equal(S.roomMood({ act: 2, ceil: 0.3, energy: 0.8 }), 'drive', 'an apex the section never earned is not one');
  assert.equal(S.roomMood({ act: 4, energy: 0.9 }), 'dissolve', 'the outro is a comedown however loud');
  assert.equal(S.roomMood({ act: 3, energy: 0.2 }), 'dissolve');
  assert.equal(S.roomMood({ act: 1, energy: 0.6, entropy: 0.9 }), 'swarm');
  assert.equal(S.roomMood({ act: 0, energy: 0.5 }), 'adrift');
  assert.equal(S.roomMood({ act: 1, energy: 0.1 }), 'adrift');
  assert.equal(S.roomMood({ act: 1, energy: 0.7 }), 'ascend');
  assert.equal(S.roomMood({ act: 3, energy: 0.7 }), 'drive');
  assert.equal(S.roomMood({}), 'adrift', 'nothing playing is not a peak');
  // and every word it can say is a mood the show knows how to be in
  for (const a of [-1, 0, 1, 2, 3, 4])
    for (const e of [0, 0.35, 0.5, 0.8, 1])
      for (const ent of [0, 0.5, 0.75, 1])
        for (const ceil of [0.2, 0.6, 1])
          assert.ok(S.MOODS[S.roomMood({ act: a, energy: e, entropy: ent, ceil })],
            `act ${a} e ${e} ent ${ent} ceil ${ceil}`);
});
test('MOODS: each mood is a complete instruction to the whole show', () => {
  const TOUCH = ['blackhole', 'grows', 'gathers', 'flows'];
  for (const k of Object.keys(S.MOODS)){
    const m = S.MOODS[k];
    assert.ok(m.bias && Object.keys(m.bias).length, `${k} leans on nothing`);
    for (const f of Object.keys(m.bias)) assert.ok(FEATS.includes(f), `${k} biases "${f}"`);
    assert.ok(m.dwell > 0.4 && m.dwell < 2, `${k} dwell ${m.dwell}`);
    assert.ok(TOUCH.includes(m.touch), `${k} touch ${m.touch}`);
    assert.ok(S.GHOST_KINDS.includes(m.ghost), `${k} ghost ${m.ghost}`);
    assert.ok(m.chroma > -0.3 && m.chroma < 0.3, `${k} chroma ${m.chroma}`);
  }
  assert.ok(S.MOODS.apex.chroma > S.MOODS.adrift.chroma, 'a peak is richer than a drift');
  assert.ok(S.MOODS.apex.dwell < S.MOODS.dissolve.dwell, 'a peak cuts faster than a comedown');
});
test('roomDwell: busy turns over faster, a held-back section is left alone', () => {
  const q = S.roomDwell({ mood: 'drive', energy: 0.05 });
  const busy = S.roomDwell({ mood: 'drive', energy: 0.95 });
  assert.ok(q > busy, `quiet holds longer: ${q} vs ${busy}`);
  assert.ok(S.roomDwell({ mood: 'apex', energy: 0.5 }) < S.roomDwell({ mood: 'dissolve', energy: 0.5 }));
  const held = S.roomDwell({ mood: 'drive', energy: 0.5, ceil: 0.2 });
  const open = S.roomDwell({ mood: 'drive', energy: 0.5, ceil: 1 });
  assert.ok(held > open, `a capped section is not cut to pieces: ${held} vs ${open}`);
  for (const mood of Object.keys(S.MOODS))
    for (const e of [0, 0.5, 1])
      assert.ok(S.roomDwell({ mood, energy: e }) >= S.ROOM_DWELL.floor, 'never below the floor');
  assert.ok(S.roomDwell({}) > 0, 'an unknown mood still returns a real dwell');
});

function roomSet(){
  return S.SCENE_KEYS.map(k => ({
    key: k, taste: S.SCENE_TASTE[k],
    calm: k === 'pulse' || k === 'parlor',
    heavy: ['fractal', 'parlor', 'aurea', 'disperse', 'filament', 'soapfilm', 'terrain'].includes(k),
  }));
}
const HOT = { energy: 0.95, beat: 0.9, bass: 0.85, entropy: 0.2, calm: 0.05, coupling: 0.3, mid: 0.4, treble: 0.7 };
const COOL = { energy: 0.1, beat: 0.05, bass: 0.2, entropy: 0.25, calm: 0.9, coupling: 0.5, mid: 0.3, treble: 0.2 };
// walk the whole draw so a test can talk about the DISTRIBUTION, not one roll.
// The sweep is fine-grained on purpose: a mood is an additive lean, so two
// moods differ by small shifts in the walk's boundaries — a coarse grid can
// step clean over every one of them once the roster is large enough (it did,
// at 32 rooms and 201 points).
function dealAll(o){
  const out = [];
  for (let i = 0; i <= 1000; i++) out.push(S.dealScene({ ...o, r: i / 1000 }));
  return out;
}

test('dealScene: always a real room, whatever it is handed', () => {
  const scenes = roomSet();
  for (const o of [{}, { scenes: [] }, { scenes, f: null }, { scenes, r: -5 }, { scenes, r: 9 }]){
    const i = S.dealScene(o);
    assert.ok(Number.isInteger(i) && i >= 0, JSON.stringify(Object.keys(o)));
  }
  for (const i of dealAll({ scenes, f: HOT, mood: 'drive' }))
    assert.ok(i >= 0 && i < scenes.length, 'in range');
});
test('dealScene: the music decides the room', () => {
  const scenes = roomSet();
  const key = i => scenes[i].key;
  const hot = dealAll({ scenes, f: HOT, mood: 'apex' }).map(key);
  const cool = dealAll({ scenes, f: COOL, mood: 'adrift' }).map(key);
  const share = (list, k) => list.filter(x => x === k).length / list.length;
  // AGAINST THE EVEN SPLIT, not against a constant. A fixed threshold here was
  // really a claim about the roster's SIZE — every room added pushed it down
  // (0.249 at seventeen, 0.259 at eighteen, 0.239 at nineteen) and it would
  // have failed on some future scene that had nothing to do with percussion.
  // What the test means is that the right rooms are dealt far more often than
  // chance, and that survives the gallery growing.
  const even = n => n / scenes.length;
  // The margin has aged with the roster once more: at eighty rooms the calm
  // tier alone is eighteen strong, so a SUM over four named rooms rides ever
  // closer to its bound even while each room individually deals 1.3-1.4x
  // chance and tops the draw (measured at the 75->80 wave: 0.0649 against a
  // 1.3x bound of 0.0650 — one deal in ten thousand). The claim this test
  // makes is unchanged — the right rooms far above chance — so the sum keeps
  // a 1.15x floor and each named room must beat plain chance on its own.
  assert.ok(share(hot, 'starburst') + share(hot, 'comets') + share(hot, 'tunnel') > even(3) * 1.15,
    'a hot room deals percussion: ' + JSON.stringify([...new Set(hot)]));
  for (const k of ['starburst', 'comets'])
    assert.ok(share(hot, k) > even(1), k + ' individually beats chance when it is hot');
  assert.ok(share(cool, 'fern') + share(cool, 'slinky') + share(cool, 'nebula') + share(cool, 'ribbons') > even(4) * 1.15,
    'a quiet room deals air: ' + JSON.stringify([...new Set(cool)]));
  for (const k of ['fern', 'slinky', 'nebula', 'ribbons'])
    assert.ok(share(cool, k) > even(1), k + ' individually beats chance when it is quiet');
  assert.ok(share(hot, 'fern') < share(cool, 'fern'), 'FERN is not an apex room');
  assert.ok(share(cool, 'starburst') < share(hot, 'starburst'), 'STARBURST is not a drift room');
});
test('dealScene: AUREA is in the deal — the room the old ladder forgot', () => {
  // it scored a flat 1 for its whole life and could only ever be picked by
  // accident; its own taste (proportion, coherence, order) must now reach it
  const scenes = roomSet();
  const golden = { energy: 0.35, beat: 0.15, bass: 0.3, entropy: 0.1, calm: 0.75, coupling: 0.95, mid: 0.5, treble: 0.3 };
  const dealt = dealAll({ scenes, f: golden, mood: 'adrift', allowHeavy: true }).map(i => scenes[i].key);
  assert.ok(dealt.includes('aurea'), 'AUREA reachable: ' + JSON.stringify([...new Set(dealt)]));
});
test('dealScene: the device gates, and reduced motion is housed', () => {
  const scenes = roomSet();
  const heavyShare = list => list.filter(k => k === 'fractal' || k === 'parlor' || k === 'aurea').length / list.length;
  const lean = dealAll({ scenes, f: HOT, mood: 'drive', allowHeavy: false }).map(i => scenes[i].key);
  const fat = dealAll({ scenes, f: HOT, mood: 'drive', allowHeavy: true }).map(i => scenes[i].key);
  // a SOFT veto, deliberately, and the same 50× damper the ladder always used:
  // a hard ban would mean a phone that struggled once could never see PARLOR
  // again for the rest of the night, however well it recovered
  assert.ok(heavyShare(lean) < 0.03,
    'a strained device is all but never dealt a heavy room: ' + heavyShare(lean).toFixed(3));
  assert.ok(heavyShare(fat) > heavyShare(lean) * 5, 'and a healthy one is dealt them freely: '
    + heavyShare(fat).toFixed(3) + ' vs ' + heavyShare(lean).toFixed(3));
  const calmShare = list => list.filter(k => k === 'pulse' || k === 'parlor').length / list.length;
  const rm = dealAll({ scenes, f: COOL, mood: 'adrift', reduced: true, allowHeavy: true }).map(i => scenes[i].key);
  const norm = dealAll({ scenes, f: COOL, mood: 'adrift', reduced: false, allowHeavy: true }).map(i => scenes[i].key);
  assert.ok(calmShare(rm) > calmShare(norm), 'reduced motion is dealt the legible rooms more often');
});
test('dealScene: the set remembers — no orbiting, and the gallery gets toured', () => {
  const scenes = roomSet();
  const base = { scenes, f: HOT, mood: 'drive', allowHeavy: true, memory: 5 };
  // the room we are already in is not a change — setScene would swallow it and
  // the dwell would reset anyway, buying the field another dwell of nothing
  assert.ok(!dealAll({ ...base, active: 3 }).includes(3), 'the active room is never dealt');
  for (let a = 0; a < scenes.length; a++)
    assert.ok(!dealAll({ ...base, active: a }).includes(a), `active ${a} is never dealt`);
  // …unless there is nowhere else to go at all
  assert.equal(S.dealScene({ scenes: [scenes[0]], f: HOT, active: 0, r: 0.5 }), 0,
    'one room and nowhere to go: stand still rather than return nothing');
  const withMem = dealAll({ ...base, recent: [8, 5, 12] });
  const share = (list, i) => list.filter(x => x === i).length / list.length;
  const without = dealAll(base);
  for (const i of [8, 5, 12])
    assert.ok(share(withMem, i) < share(without, i) + 1e-9, `room ${i} is damped after being shown`);
  // the unseen lift: a room this set has not shown outranks the same room seen
  const seen = new Set(scenes.map((s, i) => i).filter(i => i !== 9));
  const lifted = dealAll({ ...base, f: COOL, seen });
  assert.ok(share(lifted, 9) > share(dealAll({ ...base, f: COOL }), 9),
    'the room the night has not visited gets its turn');
});
test('dealScene: deterministic in r, and the mood actually leans', () => {
  const scenes = roomSet();
  const o = { scenes, f: { energy: 0.5, beat: 0.5, entropy: 0.5, calm: 0.5, bass: 0.5, mid: 0.5, treble: 0.5, coupling: 0.5 },
    allowHeavy: true, r: 0.37 };
  assert.equal(S.dealScene({ ...o, mood: 'drive' }), S.dealScene({ ...o, mood: 'drive' }), 'same input, same room');
  const a = dealAll({ ...o, mood: 'apex' }).join(',');
  const b = dealAll({ ...o, mood: 'adrift' }).join(',');
  assert.notEqual(a, b, 'the mood changes the deal on identical music');
});
test('the mood leans the hand and the ghost, and only when there IS one', () => {
  // no mood → the map is exactly what it always was (the whole compatibility claim)
  for (let sc = 0; sc < 124; sc++)
    for (const r of [0.01, 0.3, 0.6, 0.7, 0.86, 0.99]){
      assert.equal(S.touchAffinity(sc, 1, r), S.touchAffinity(sc, 1, r, null));
      assert.equal(S.ghostPattern(sc, 1, r), S.ghostPattern(sc, 1, r, null));
    }
  // …and with one, the lean lands inside its window and nowhere else
  assert.equal(S.touchAffinity(0, 1, 0.7, 'drive'), S.MOODS.drive.touch, 'the lean lands');
  assert.equal(S.touchAffinity(0, 1, 0.2, 'drive'), S.touchAffinity(0, 1, 0.2), 'below the window: the map');
  assert.equal(S.touchAffinity(0, 1, 0.9, 'drive'), S.touchAffinity(0, 1, 0.9), 'above it: the wildcard still wins');
  assert.equal(S.ghostPattern(0, 1, 0.7, 'swarm'), S.MOODS.swarm.ghost);
  assert.equal(S.ghostPattern(0, 2, 0.7, 'swarm'), 'drift', 'the apex still has the last word');
  // an unknown mood must be inert, never a crash and never a silent default
  assert.equal(S.touchAffinity(4, 1, 0.7, 'nonsense'), S.touchAffinity(4, 1, 0.7));
  assert.equal(S.ghostPattern(4, 1, 0.7, 'nonsense'), S.ghostPattern(4, 1, 0.7));
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
  for (let sc = 0; sc < 124; sc++)
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
  assert.equal(S.touchAffinity(18, 1, 0.5), 'flows', 'a hand near a flame is a DRAUGHT');
});

// ---------------------------------------------------------- fire, measured

test('the observer: monochromatic light comes out the colour it is', () => {
  const hex = nm => S.rgbHex(S.wavelengthRGB(nm));
  assert.equal(hex(532), '#00FF00', '532 nm is the green everybody’s laser pointer is');
  const red = S.wavelengthRGB(650), blue = S.wavelengthRGB(445);
  assert.ok(red.r > 0.9 && red.g < 0.1 && red.b < 0.1, `650 nm is red: ${JSON.stringify(red)}`);
  assert.ok(blue.b > 0.9 && blue.r < blue.b, `445 nm is blue-violet: ${JSON.stringify(blue)}`);
  // …and the whole visible band resolves to SOMETHING, at every step
  for (let l = 380; l <= 720; l += 5){
    const c = S.wavelengthRGB(l);
    assert.ok(Math.max(c.r, c.g, c.b) > 0.99, `${l} nm is normalised`);
    assert.ok(Math.min(c.r, c.g, c.b) >= 0, `${l} nm has no negative channel`);
  }
});
test('the black body: hotter is bluer, and the whole ladder is monotone', () => {
  // the one claim a colour-temperature model has to get right: as T rises the
  // blue channel gains on the red, every step of the way, with no reversals
  let prev = -1;
  for (let K = 1000; K <= 12000; K += 250){
    const c = S.kelvinRGB(K);
    const ratio = c.b / Math.max(1e-6, c.r);
    assert.ok(ratio > prev - 1e-9, `${K} K reversed: ${ratio} after ${prev}`);
    prev = ratio;
    assert.ok(Math.max(c.r, c.g, c.b) > 0.99 && Math.min(c.r, c.g, c.b) >= 0, `${K} K in gamut`);
  }
  const candle = S.kelvinRGB(1850), day = S.kelvinRGB(6500);
  assert.ok(candle.b < 0.35, `a candle is not blue: ${S.rgbHex(candle)}`);
  assert.ok(day.b > 0.9 && day.r > 0.9, `daylight is near-white: ${S.rgbHex(day)}`);
  // luminance rises steeply with temperature — the reason a flame tip is
  // dimmer as well as redder is a fact about the spectrum, not a fade we drew
  assert.ok(S.blackbodyXYZ(2000).y > S.blackbodyXYZ(1200).y * 4,
    'a 2000 K body vastly out-radiates a 1200 K one in the visible');
});
test('the bench: ten real sources, each with numbers you could measure', () => {
  assert.equal(S.FLAME_SOURCES.length, 10);
  const keys = S.FLAME_SOURCES.map(s => s.key);
  for (const want of ['match', 'lighter', 'bic', 'zippo', 'clipper', 'torch', 'campfire',
                      'flashlight', 'led', 'laser'])
    assert.ok(keys.includes(want), `${want} is not on the bench`);
  assert.equal(new Set(keys).size, 10, 'no two sources share a key');
  for (const s of S.FLAME_SOURCES){
    assert.ok(['flame', 'beam', 'laser'].includes(s.kind), `${s.key} has a real kind`);
    assert.ok(s.dia > 0 && s.h > 0 && s.w > 0, `${s.key} has a real geometry`);
    assert.ok(s.kind === 'laser' ? s.nm > 0 : s.kelvin >= 1000, `${s.key} has a real colour`);
  }
});
test('the flicker IS the diameter — Strouhal, not a slider', () => {
  const by = k => S.FLAME_SOURCES.find(s => s.key === k);
  const campfire = S.flamePuff(by('campfire')), match = S.flamePuff(by('match'));
  assert.ok(campfire > 1.5 && campfire < 2.5, `a campfire breathes about twice a second: ${campfire}`);
  assert.ok(match > 15 && match < 25, `a match shivers about twenty times a second: ${match}`);
  // f ∝ D^-1/2: four times the diameter, half the frequency, exactly
  assert.ok(Math.abs(S.flamePuff({ dia: 0.04 }) / S.flamePuff({ dia: 0.01 }) - 0.5) < 1e-9);
  for (const s of S.FLAME_SOURCES)
    assert.equal(S.flamePuff(s) > 0, s.kind === 'flame', `${s.key}: only fire flickers`);
  assert.equal(S.flamePuff(null), 1.5 / Math.sqrt(0.01), 'a source with no diameter still answers');
});
test('the plume is a temperature profile, and the tip is COLDER, not just dimmer', () => {
  const zippo = S.FLAME_SOURCES.find(s => s.key === 'zippo');
  const wick = S.flameTemp(zippo, 0), peak = S.flameTemp(zippo, 0.20), tip = S.flameTemp(zippo, 1);
  assert.ok(peak > wick && peak > tip, `hottest a fifth of the way up: ${wick}/${peak}/${tip}`);
  assert.equal(Math.round(peak), zippo.kelvin, 'and the rated temperature IS the peak');
  // monotone down from the peak — no bumps to explain
  let last = peak;
  for (let u = 0.20; u <= 1.001; u += 0.02){
    const K = S.flameTemp(zippo, u);
    assert.ok(K <= last + 1e-9, `reversal at ${u}`);
    last = K;
  }
  const led = S.FLAME_SOURCES.find(s => s.key === 'led');
  assert.equal(S.flameTemp(led, 0), S.flameTemp(led, 1), 'an LED is one temperature all the way up');
  assert.equal(S.flameTemp(zippo, -5), S.flameTemp(zippo, 0), 'nonsense heights are clamped, not NaN-ed');
});
test('the ramp: a blue base where a flame really has one, and nowhere else', () => {
  const N = 64, blueness = (row, i) => row[i * 4 + 2] - row[i * 4];   // B − R
  const bic = S.flameRamp(S.FLAME_SOURCES.find(s => s.key === 'bic'), N);
  const camp = S.flameRamp(S.FLAME_SOURCES.find(s => s.key === 'campfire'), N);
  assert.ok(blueness(bic, 0) > 40, 'a Bic burns premixed: the cone at its base is blue');
  assert.ok(blueness(bic, N - 1) < -100, '…and its tip is not');
  assert.ok(blueness(bic, 1) > blueness(camp, 1), 'a campfire has far less of one than a Bic');
  // luminance: dark at the wick, brightest in the body, dying through the tip
  const lum = (row, i) => row[i * 4 + 3];
  const peak = Math.max(...Array.from({ length: N }, (_, i) => lum(bic, i)));
  const at = Array.from({ length: N }, (_, i) => lum(bic, i)).indexOf(peak) / (N - 1);
  assert.ok(at > 0.05 && at < 0.4, `the body is brightest a fifth of the way up: ${at}`);
  assert.ok(lum(bic, 0) < peak && lum(bic, N - 1) < peak * 0.2, 'the wick is dark and the tip burns out');
  // a beam falls off with distance; a laser barely does — that IS the difference
  const torchB = S.flameRamp(S.FLAME_SOURCES.find(s => s.key === 'flashlight'), N);
  const laser = S.flameRamp(S.FLAME_SOURCES.find(s => s.key === 'laser'), N);
  assert.ok(lum(torchB, N - 1) < lum(torchB, 0) * 0.35, 'a cone of light thins out');
  assert.ok(lum(laser, N - 1) > lum(laser, 0) * 0.85, 'a collimated one does not');
  for (let i = 0; i < N; i++)
    assert.equal(laser[i * 4] + laser[i * 4 + 2], 0, 'and it stays exactly one wavelength all the way');
  assert.equal(S.flameRamp(null, 4).length, 16, 'a source that is nothing still yields a ramp');
});
test('the bands: ten lights split the spectrum the way hearing does', () => {
  const n = S.FLAME_SOURCES.length;
  let last = -1;
  for (let i = 0; i < n; i++){
    const u = S.flameBandU(i, n);
    assert.ok(u > last, 'strictly rising left to right');
    assert.ok(u >= 0 && u <= 1, 'and always a real texture coordinate');
    last = u;
  }
  assert.ok(S.flameBandU(0, n) < 0.05, 'the first light is on the bass');
  assert.ok(S.flameBandU(n - 1, n) > 0.4, 'the last one is up in the air');
  // the walk is bent, not linear: the low half of the bench shares the low
  // half of the spectrum far more finely than the top half shares the top
  assert.ok(S.flameBandU(5, n) < S.flameBandU(n - 1, n) * 0.5, 'logarithmic, not linear');
  assert.equal(S.flameBandU(0, 1), S.flameBandU(0, 0), 'a bench of one still answers');
});
test('the roll: the bench TOURS by default, and every source is reachable', () => {
  const seen = new Set(), soloSeen = new Set();
  let tour = 0, vigil = 0;
  for (let i = 0; i <= 1000; i++){
    const r = S.flameRoll(i / 1000);
    assert.ok(r.mode === 'tour' || r.mode === 'vigil' || r.mode === 'solo', r.mode);
    if (r.mode === 'vigil'){ vigil++; assert.equal(r.src, -1); }
    else {
      assert.ok(r.src >= 0 && r.src < S.FLAME_SOURCES.length);
      seen.add(r.src);
      if (r.mode === 'tour') tour++; else soloSeen.add(r.src);
    }
    assert.ok(typeof r.name === 'string' && r.name.length > 0, 'a roll always names itself');
  }
  // the point of the rewrite: ten lights at once is a photograph, not a
  // demonstration, so it is the RARE look now and the walk is the default
  assert.ok(tour / 1001 > 0.55 && tour / 1001 < 0.65, `the tour is the default: ${tour / 1001}`);
  assert.ok(vigil / 1001 > 0.1 && vigil / 1001 < 0.2, `the whole bench survives, rarely: ${vigil / 1001}`);
  assert.equal(seen.size, S.FLAME_SOURCES.length, 'every light can open a visit');
  assert.equal(soloSeen.size, S.FLAME_SOURCES.length, 'and every light gets its own solo');
  assert.ok(S.flameRoll(NaN).src >= 0, 'nonsense still lands on a real light');
  assert.deepEqual(S.flameRoll(0.7), S.flameRoll(1.7), 'the roll is a pure function of its fraction');
});
test('every source declares HOW it makes light, and the spectrum agrees', () => {
  const HOW = new Set(['INCANDESCENCE', 'ELECTROLUMINESCENCE', 'STIMULATED EMISSION']);
  for (const s of S.FLAME_SOURCES){
    assert.ok(HOW.has(s.how), `${s.name} names a real mechanism, not "${s.how}"`);
    assert.ok(typeof s.sub === 'string' && s.sub.length > 0, `${s.name} says what it is`);
  }
  const peak = sp => sp.indexOf(Math.max(...sp));
  /* WIDTH AT A TENTH of the peak, not at a half. A 1200 K black body is so
     steep across the visible that only its top eighth clears half-peak — the
     half-height measure says a campfire is nearly as narrow as a laser, which
     is true of that statistic and false of the physics. A tenth separates
     "one line" from "a continuum" the way the eye does. */
  const width = sp => sp.filter(v => v > 0.1).length / sp.length;
  const laser = S.flameSpectrum(S.FLAME_SOURCES.find(s => s.kind === 'laser'), 200);
  const led   = S.flameSpectrum(S.FLAME_SOURCES.find(s => s.kind === 'beam'), 200);
  const fire  = S.flameSpectrum(S.FLAME_SOURCES.find(s => s.key === 'campfire'), 200);
  // a laser is ONE line: essentially nothing is above half its peak
  assert.ok(width(laser) < 0.05, `a laser is a line, not a hump: ${width(laser)}`);
  // 532 nm should land where 532 nm is
  const at = nm => Math.round((nm - 380) / (750 - 380) * 199);
  assert.ok(Math.abs(peak(laser) - at(532)) < 4, 'and it is at 532 nm');
  // a thermal source is broad, and at 1200 K it climbs all the way to the red end
  assert.ok(width(fire) > 0.3, `a black body is a continuum: ${width(fire)}`);
  assert.ok(width(fire) > width(laser) * 8, 'and nothing like a line');
  assert.ok(width(led) > 0.6, `a phosphor LED is broader still: ${width(led)}`);
  assert.equal(peak(fire), 199, 'a cool flame peaks off the red end of the visible');
  // a white LED is TWO humps with a dip between them — the cyan gap
  const dip = led.slice(at(480), at(510));
  assert.ok(Math.min(...dip) < led[at(452)] * 0.85 && Math.min(...dip) < led[at(565)] * 0.85,
    'a white LED has the cyan hole between its die and its phosphor');
  for (const sp of [laser, led, fire]){
    assert.ok(Math.max(...sp) > 0.999 && Math.max(...sp) <= 1.0001, 'normalised to its own peak');
    assert.ok(sp.every(v => v >= 0 && isFinite(v)), 'and never negative or NaN');
  }
});
test('pyroLead: a shell is fired EARLY, by exactly its own lift', () => {
  for (const sh of S.PYRO_SHELLS){
    const lead = S.pyroLead(sh);
    assert.ok(lead >= 0 && isFinite(lead), sh.key);
    // a ground piece has nowhere to climb, so it fires ON the cue
    if (!sh.lift) assert.equal(lead, 0, `${sh.key} is a ground piece`);
    else assert.ok(lead > 0.4 && lead < sh.life, `${sh.key} leads by ${lead}s of its ${sh.life}s`);
  }
  assert.equal(S.pyroLead(null), 0, 'nonsense never schedules into the past');
  assert.equal(S.pyroLead({ life: 4, lift: 0.25 }), 1);
});
test('pyroProgram: the show has an arc, and it is the track’s own', () => {
  const at = (act, energy) => S.pyroProgram({ act, energy });
  assert.equal(at(2, 0.9).name, 'APEX');
  assert.equal(at(0, 0.2).name, 'OVERTURE');
  assert.equal(at(3, 0.5).name, 'TURN');
  assert.equal(at(4, 0.5).name, 'RESOLVE');
  // the peak is the busiest thing in the show, and the opening the quietest
  assert.ok(at(2, 0.9).salvo > at(0, 0.2).salvo * 3, 'the apex earns a salvo');
  assert.ok(at(2, 0.9).chance > at(0, 0.2).chance, 'and fires more often');
  assert.ok(at(2, 0.9).big >= at(3, 0.5).big, 'and bigger');
  // an apex with no energy behind it is not an apex
  assert.notEqual(at(2, 0.05).name, 'APEX');
  for (const a of [-1, 0, 1, 2, 3, 4])
    for (const e of [0, 0.5, 1]){
      const p = at(a, e);
      assert.ok(p.salvo >= 1 && p.perCue >= 1 && p.chance > 0 && p.chance <= 1, `act ${a} e ${e}`);
    }
});
// ------------------------------------------------------- and then it fires

test('the stars are chemistry: real emitters, through the same observer', () => {
  assert.equal(S.PYRO_STARS.length, 9);
  const by = k => S.PYRO_STARS.find(x => x.key === k);
  for (const st of S.PYRO_STARS){
    assert.ok(st.nm ? st.nm >= 380 && st.nm <= 750 : st.kelvin >= 1000,
      `${st.key} emits something real`);
    const c = S.pyroStarRGB(st);
    assert.ok(Math.max(c.r, c.g, c.b) > 0.99, `${st.key} is normalised`);
    assert.ok(Math.min(c.r, c.g, c.b) >= 0, `${st.key} has no negative channel`);
  }
  const ba = S.pyroStarRGB(by('barium')), cu = S.pyroStarRGB(by('copper'));
  assert.ok(ba.g > 0.9 && ba.r < 0.2, `barium at 515 nm is green: ${S.rgbHex(ba)}`);
  assert.ok(cu.b > 0.9 && cu.g < 0.2, `copper at 452 nm is blue: ${S.rgbHex(cu)}`);
  // the gold willow is not a colour, it is charcoal — so it must land on the
  // same amber the black-body model gives a flame of that temperature
  assert.equal(S.rgbHex(S.pyroStarRGB(by('charcoal'))), S.rgbHex(S.kelvinRGB(1750)),
    'gold is incandescence, and comes from the same model the flames use');
  // two emitters in one pellet ADD: purple must sit between its parents and be
  // reachable by neither of them alone
  const pu = S.pyroStarRGB(by('purple')), sr = S.pyroStarRGB(by('strontium'));
  assert.ok(pu.r > 0.5 && pu.b > 0.5, `purple carries both lines: ${S.rgbHex(pu)}`);
  assert.ok(pu.b > sr.b && pu.r > cu.r, 'and is neither of them');
});
test('pyroFlight: a star in air, and the vacuum it reduces to', () => {
  // THE limit test: take the air away and it must reproduce schoolbook
  // ballistics exactly, or the closed form is not the closed form
  const t = 2, v0 = 10, g = 9.8;
  // (the model floors drag at 1e-4 rather than dividing by zero, so the limit
  // is approached to about a part in ten thousand rather than reached)
  const vac = S.pyroFlight(t, v0, 1e-7, g);
  assert.ok(Math.abs(vac.reach - v0 * t) < 0.01, `reach → v₀t: ${vac.reach}`);
  assert.ok(Math.abs(vac.fall - 0.5 * g * t * t) < 0.01, `fall → ½gt²: ${vac.fall}`);
  // with air, displacement is bounded by v₀/k however long you wait
  assert.ok(Math.abs(S.pyroFlight(1e5, 10, 2, g).reach - 5) < 1e-6, 'terminal displacement is v₀/k');
  assert.ok(S.pyroFlight(3, 10, 2, g).reach < 10 * 3, 'air always costs reach');
  // and the fall is eventually linear — terminal velocity, not acceleration
  const a = S.pyroFlight(20, 10, 2, g).fall, b = S.pyroFlight(21, 10, 2, g).fall;
  assert.ok(Math.abs((b - a) - g / 2) < 1e-3, `terminal velocity g/k: ${b - a}`);
  // monotone, and never NaN on nonsense
  let last = -1;
  for (let x = 0; x <= 5; x += 0.1){
    const f = S.pyroFlight(x, 12, 0.8, g);
    assert.ok(f.reach >= last - 1e-9 && isFinite(f.reach) && isFinite(f.fall), `at ${x}`);
    last = f.reach;
  }
  const z = S.pyroFlight(-3, 10, 0, 0);
  assert.equal(z.reach, 0); assert.equal(z.fall, 0);
  assert.ok(isFinite(S.pyroFlight(NaN, NaN, NaN, NaN).reach), 'nonsense is not NaN');
});
test('the pieces differ by three numbers, not by three animations', () => {
  const keys = S.PYRO_SHELLS.map(s => s.key);
  assert.equal(new Set(keys).size, S.PYRO_SHELLS.length, 'no two pieces share a key');
  for (const sh of S.PYRO_SHELLS){
    assert.ok(sh.v0 > 0 && sh.drag > 0 && sh.life > 0, `${sh.key} is a real piece`);
    assert.ok(sh.lift >= 0 && sh.lift < 1, `${sh.key}'s climb is a share of its life`);
    // every piece must fit a room: terminal reach bounded, or it leaves the frame
    assert.ok(sh.v0 / sh.drag < 16, `${sh.key} stays in the room: ${(sh.v0 / sh.drag).toFixed(1)}`);
  }
  const peony = S.pyroShell('peony'), willow = S.pyroShell('willow');
  // a willow droops and a peony does not — and that IS the gravity number
  assert.ok(willow.grav > peony.grav && willow.life > peony.life, 'a willow hangs and falls');
  assert.ok(S.pyroShell('billow').grav < 0, 'smoke is buoyant, so its gravity points up');
  assert.ok(S.pyroShell('gerb').lift === 0 && S.pyroShell('mine').lift === 0,
    'the ground pieces have nowhere to climb to');
  assert.equal(S.pyroShell('nonsense').key, S.PYRO_SHELLS[0].key, 'an unknown piece is still a piece');
});
test('pyroRate: the sky is as busy as the music, and quiet when it is', () => {
  const at = (energy, mood, calm) => S.pyroRate({ energy, mood, calm });
  assert.ok(at(0.9, 'apex') > at(0.9, 'drive'), 'an apex opens up');
  assert.ok(at(0.9, 'drive') > at(0.1, 'drive'), 'and energy drives it');
  assert.ok(at(0.9, 'adrift') < at(0.9, 'drive'), 'drifting goes quiet');
  assert.ok(at(0.9, 'apex', true) < at(0.9, 'apex'), 'CALM thins the sky');
  assert.ok(at(0, 'adrift') > 0, 'but it never stops entirely — something is always burning');
  assert.ok(isFinite(S.pyroRate({})) && S.pyroRate({}) > 0, 'an unknown moment still fires');
});
test('pyroFire: the budget lands on the hit, and can never run away', () => {
  assert.equal(S.pyroFire(0, 0.016, 2, false).fire, 0, 'a frame is not a firework');
  assert.equal(S.pyroFire(0.9, 0.016, 2, true).fire, 1, 'an onset spends an almost-full budget');
  assert.equal(S.pyroFire(0.1, 0.016, 2, true).fire, 0, 'but not an empty one');
  assert.equal(S.pyroFire(0.99, 0.016, 2, false).fire, 1, 'and a full budget fires anyway');
  // a tab that was in the background for a minute must not return to a minute
  // of shells: both the count and the carried budget are capped
  const huge = S.pyroFire(0, 60, 4, true);
  assert.ok(huge.fire <= S.PYRO_TUNING.maxPerFrame, `capped: ${huge.fire}`);
  assert.ok(huge.acc <= 2 && huge.acc >= 0, `and the carry is bounded: ${huge.acc}`);
  for (const bad of [[NaN, 0.016, 2], [0, NaN, 2], [0, 0.016, NaN], [-5, -5, -5]]){
    const r = S.pyroFire(bad[0], bad[1], bad[2], false);
    assert.ok(isFinite(r.acc) && r.fire >= 0, JSON.stringify(bad));
  }
});
test('pyroPick / pyroSalt: the moment chooses the piece and its chemistry', () => {
  const shells = new Set(S.PYRO_SHELLS.map(s => s.key));
  const salts = new Set(S.PYRO_STARS.map(s => s.key));
  const walk = (fn, o) => Array.from({ length: 200 }, (_, i) => fn(o, i / 200));
  for (const o of [{ energy: 0.9, mood: 'apex' }, { energy: 0.1, mood: 'adrift' },
                   { energy: 0.5, mood: 'drive' }, {}]){
    for (const k of walk(S.pyroPick, o)) assert.ok(shells.has(k), `${k} is not a piece`);
    for (const k of walk(S.pyroSalt, o)) assert.ok(salts.has(k), `${k} is not a chemistry`);
  }
  const quiet = walk(S.pyroPick, { energy: 0.08, mood: 'adrift' });
  const loud = walk(S.pyroPick, { energy: 0.95, mood: 'apex' });
  const share = (l, k) => l.filter(x => x === k).length / l.length;
  assert.ok(share(quiet, 'billow') > 0.4, 'a quiet room is mostly smoke');
  assert.equal(share(quiet, 'peony'), 0, 'and never opens the sky');
  const sky = ['peony', 'chrys', 'palm', 'ring', 'crossette', 'strobe'];
  assert.ok(sky.reduce((a, k) => a + share(loud, k), 0) > 0.8, 'an apex is nearly all shells');
  assert.equal(share(loud, 'billow'), 0, 'nobody watches smoke at the apex');
  // the hard colours are earned: copper blue is expensive in a real shell too
  const dim = walk(S.pyroSalt, { energy: 0.05, treble: 0.05 });
  const bright = walk(S.pyroSalt, { energy: 0.95, treble: 0.95 });
  assert.equal(share(dim, 'copper'), 0, 'a dim moment does not get copper');
  assert.ok(share(bright, 'copper') > 0.1, 'a bright one does');
  assert.ok(share(dim, 'charcoal') > share(bright, 'charcoal'), 'and the quiet keeps the gold');
});
test('the readout says what colour the thing is — because that is the room', () => {
  const laser = S.flameLabel(S.FLAME_SOURCES.find(s => s.key === 'laser'));
  assert.ok(/LASER · 532 nm · #[0-9A-F]{6}$/.test(laser), laser);
  const zippo = S.flameLabel(S.FLAME_SOURCES.find(s => s.key === 'zippo'));
  assert.ok(/ZIPPO · 1500 K · #[0-9A-F]{6}$/.test(zippo), zippo);
  for (const s of S.FLAME_SOURCES)
    assert.ok(S.flameLabel(s).includes(S.rgbHex(S.flameRGB(s))), `${s.key} quotes its own colour`);
  assert.equal(S.rgbHex({ r: 1, g: 0, b: 0 }), '#FF0000');
  assert.equal(S.rgbHex({ r: -3, g: 9, b: 0.5 }), '#00FF80', 'out-of-range channels clamp, never wrap');
});
test('touchAutoShould: never under a live finger, never before the dwell, only usually', () => {
  assert.ok(!S.touchAutoShould(10, true, 0.1), 'too soon');
  assert.ok(!S.touchAutoShould(90, false, 0.1), 'hand is on the field');
  assert.ok(S.touchAutoShould(90, true, 0.1), 'due, hand off, dice agree');
  assert.ok(!S.touchAutoShould(90, true, 0.9), 'even then, only usually');
});
test('touchPairMode: the second hand is never the same force as the first', () => {
  for (const m of [-1, 0, 1, 2]) assert.notEqual(S.touchPairMode(m), m, `mode ${m} paired with itself`);
  assert.equal(S.touchPairMode(0), 2, 'a void is answered by a well');
  assert.equal(S.touchPairMode(2), 0, 'and a well by a void');
  assert.equal(S.touchPairMode(-1), 1, 'a vortex is answered by its opposite chirality');
  assert.equal(S.touchPairMode(1), -1);
  assert.equal(S.touchPairMode(3), 3, 'ripples pair with ripples — two sources, interference');
  // and every answer is a mode the metric actually implements
  for (const m of [-1, 0, 1, 2, 3])
    assert.ok([-1, 0, 1, 2, 3].includes(S.touchPairMode(m)), `mode ${m} paired to nothing real`);
});

// ---------------------------------------------------------------- the fabric, as a vector

test('warpPush: a flat fabric moves nothing, and zero force moves nothing', () => {
  const flat = S.warpPush(0.3, 0.2, 0.3, 0.2, 0, 0, {});      // on the centre, no force
  assert.ok(Math.hypot(flat.x, flat.y) < 1e-9, 'no force, no push');
  const far = S.warpPush(4, 4, 0, 0, 0, 1, {});                // far outside the reach window
  assert.ok(Math.hypot(far.x, far.y) < 1e-6, `beyond the reach the room is still: ${far.x},${far.y}`);
});
test('warpPush: it IS warpDeflect — the push carries the deflection it promises', () => {
  // the void throws the image outward: |p - c| grows by exactly rad
  for (const r of [0.05, 0.12, 0.3, 0.6]){
    const p = S.warpPush(r, 0, 0, 0, 0, 1, {});
    const moved = Math.hypot(r + p.x, 0 + p.y);
    const d = S.warpDeflect(0, r, {});
    assert.ok(Math.abs(moved - (r + d.rad)) < 1e-6, `radius at r=${r}: ${moved} vs ${r + d.rad}`);
    assert.ok(Math.abs(p.rad - d.rad) < 1e-12, 'the depth share is the radial term itself');
  }
});
test('warpPush: the vortex turns space and keeps its radius', () => {
  const r = 0.25;
  const p = S.warpPush(r, 0, 0, 0, 1, 1, { spin: 0.8 });
  const moved = Math.hypot(r + p.x, p.y);
  assert.ok(Math.abs(moved - r) < 1e-6, `a rotation preserves the radius: ${moved} vs ${r}`);
  assert.ok(Math.abs(p.y) > 1e-3, 'and it actually turned');
  const anti = S.warpPush(r, 0, 0, 0, -1, 1, { spin: 0.8 });
  assert.ok(Math.sign(anti.y) === -Math.sign(p.y), 'the two chiralities wind opposite ways');
});
test('warpPush: two hands superpose — the pair is the sum, not the winner', () => {
  // the claim the GLSL makes when it adds the second push to the first
  const a = S.warpPush(0.1, 0.05, -0.4, 0, 0, 1, {});
  const b = S.warpPush(0.1, 0.05, 0.4, 0, 2, 1, {});
  assert.ok(Math.hypot(a.x, a.y) > 1e-4 && Math.hypot(b.x, b.y) > 1e-4, 'both hands reach the middle');
  // the void pushes away from itself, the well draws toward itself: between a
  // pair placed like this they agree in direction, which is why the middle moves
  assert.ok(a.x > 0 && b.x > 0, `a pair pulling the same way: ${a.x} ${b.x}`);
});

// ---------------------------------------------------------------- the ghost

test('ghostPath: every choreography stays in the room — over a stroke, and long past one', () => {
  for (const kind of S.GHOST_KINDS){
    for (const seed of [1, 7, 4242]){
      for (let t = 0; t < 600; t += 0.37){          // far beyond any stroke: still bounded
        const p = S.ghostPath(kind, t, seed);
        assert.ok(isFinite(p.x) && isFinite(p.y), `${kind} went non-finite at t=${t}`);
        assert.ok(Math.abs(p.x) <= S.GHOST_TUNING.edge + 1e-9
          && Math.abs(p.y) <= S.GHOST_TUNING.edge + 1e-9, `${kind} left the field at t=${t}: ${p.x},${p.y}`);
      }
    }
  }
});
test('ghostPath: it is a path — it only ever jumps while the hand is off the field', () => {
  // a jump between frames with the hand DOWN would read as a cut, not as a hand.
  // PAINT is allowed to move its anchor, but only across a lift — that is the
  // whole difference between painting and teleporting.
  const T = S.GHOST_TUNING.maxLen * 3;
  for (const kind of S.GHOST_KINDS){
    for (const seed of [9, 260, 5551]){
      let prev = S.ghostPath(kind, 0, seed);
      for (let t = 1 / 60; t < T; t += 1 / 60){
        const p = S.ghostPath(kind, t, seed);
        assert.ok(p.on >= 0 && p.on <= 1, `${kind} returned a nonsense pen: ${p.on}`);
        const step = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (step >= 0.12)
          assert.ok(prev.on === 0, `${kind} jumped ${step.toFixed(3)} with the pen down at t=${t.toFixed(2)}`);
        prev = p;
      }
    }
  }
});
test('ghostPath: four choreographies are a drag; only PAINT lifts', () => {
  for (const kind of S.GHOST_KINDS){
    let lifted = false, down = false;
    for (let t = 0; t < S.GHOST_TUNING.maxLen; t += 0.01){
      const on = S.ghostPath(kind, t, 21).on;
      if (on === 0) lifted = true;
      if (on > 0.99) down = true;
    }
    assert.ok(down, `${kind} never actually touches the field`);
    assert.equal(lifted, kind === 'paint', `${kind}: lifted=${lifted}`);
  }
});
test('ghostPath: a stroke BEGINS — every choreography starts somewhere of its own', () => {
  // the runtime hands each stroke a clock that starts at zero, so t=0 is the
  // moment the hand goes down; two seeds must not put it in the same place
  for (const kind of S.GHOST_KINDS){
    const starts = new Set();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]){
      const p = S.ghostPath(kind, 0, seed);
      starts.add(p.x.toFixed(4) + ',' + p.y.toFixed(4));
    }
    // the snake always begins at its home cell — that is the lattice's own rule
    const want = kind === 'snake' ? 1 : 4;
    assert.ok(starts.size >= want, `${kind} began in only ${starts.size} distinct places`);
  }
});
test('ghostPath: each choreography is a DIFFERENT motion, not one wander renamed', () => {
  const sig = kind => {
    let travel = 0, prev = S.ghostPath(kind, 0, 3);
    for (let t = 0.05; t < S.GHOST_TUNING.maxLen; t += 0.05){
      const p = S.ghostPath(kind, t, 3);
      travel += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return travel;
  };
  const lens = S.GHOST_KINDS.map(sig);
  assert.ok(new Set(lens.map(v => v.toFixed(2))).size === S.GHOST_KINDS.length,
    'two choreographies travel exactly the same distance: ' + lens.map(v => v.toFixed(2)).join(' '));
  // DRIFT is the resting hand and must be the least busy of the five
  const drift = lens[S.GHOST_KINDS.indexOf('drift')];
  for (const k of ['bounce', 'snake', 'lissa', 'paint'])
    assert.ok(lens[S.GHOST_KINDS.indexOf(k)] > drift,
      `${k} (${lens[S.GHOST_KINDS.indexOf(k)].toFixed(2)}) should out-travel drift (${drift.toFixed(2)})`);
});
test('ghostFold: a ball off the walls stays between them, for ever', () => {
  for (let u = -50; u < 50; u += 0.013){
    const v = S.ghostFold(u, 0.82);
    assert.ok(v >= -0.82 - 1e-12 && v <= 0.82 + 1e-12, `escaped at u=${u}: ${v}`);
  }
  assert.ok(Math.abs(S.ghostFold(0, 1) + 1) < 1e-12, 'the fold starts at the wall');
});
test('ghostSnake: axis-aligned — one coordinate at a time, on a lattice', () => {
  // the character of the snake IS the right angle. Between two samples inside a
  // step, exactly one axis may have moved.
  let both = 0, moved = 0;
  for (let t = 0; t < 90; t += 0.02){
    const a = S.ghostSnake(t, 5), b = S.ghostSnake(t + 0.02, 5);
    const dx = Math.abs(b.x - a.x) > 1e-6, dy = Math.abs(b.y - a.y) > 1e-6;
    if (dx || dy) moved++;
    if (dx && dy) both++;
  }
  assert.ok(moved > 100, 'the snake actually moves');
  // only the samples that straddle a step boundary may show both axes
  assert.ok(both / moved < 0.06, `${both}/${moved} samples moved diagonally — that is not a snake`);
});
test('ghostSnake: the walk is bounded, and it stops rather than running away', () => {
  const G = S.GHOST_TUNING;
  const cap = G.step * G.lap;              // the guard: no stroke is ever this long
  const a = S.ghostSnake(cap + 1, 11), b = S.ghostSnake(cap + 900, 11);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 1e-12, 'past the guard the snake holds still');
  assert.ok(Math.abs(a.x) <= G.edge && Math.abs(a.y) <= G.edge, 'and holds still inside the room');
  assert.deepEqual(S.ghostSnake(-5, 11), S.ghostSnake(0, 11), 'a negative clock is the start, not a crash');
});
test('ghostPhrase: it plays in phrases — mostly silence, and the ends fade', () => {
  const G = S.GHOST_TUNING;
  for (const seed of [1, 2, 77]){
    let on = 0, n = 0, peak = 0;
    for (let t = 0; t < G.slot * 40; t += 0.05){
      const p = S.ghostPhrase(t, seed);
      n++; if (p.on) on++;
      peak = Math.max(peak, p.env);
      if (!p.on) assert.equal(p.env, 0, 'silence is silent');
      assert.ok(p.env >= 0 && p.env <= 1, 'the envelope is an envelope');
    }
    const duty = on / n;
    assert.ok(duty > 0.1 && duty < 0.45, `duty cycle ${duty.toFixed(2)} — the field must be mostly untouched`);
    assert.ok(peak > 0.98, 'a stroke does reach full amplitude');
  }
});
test('ghostPhrase: the envelope never snaps — it lands slowly and lifts briskly', () => {
  const G = S.GHOST_TUNING, dt = 0.02;
  // the ceiling on one step is set by the FASTER of the two ramps; a lift is
  // brisk on purpose (a hand that fades out has no charge left to release) but
  // it is still a ramp and not a cliff
  const cap = dt / Math.min(G.fade, G.lift) * 1.6;
  let prev = S.ghostPhrase(0, 4).env;
  for (let t = dt; t < 400; t += dt){
    const e = S.ghostPhrase(t, 4).env;
    assert.ok(Math.abs(e - prev) < cap, `presence stepped by ${(e - prev).toFixed(3)} at t=${t.toFixed(2)}`);
    prev = e;
  }
  assert.ok(G.lift < G.fade, 'a stroke must leave faster than it arrives');
});
test('ghostAmp: never as loud as a hand, and quietest where the music is loudest', () => {
  const quiet = S.ghostAmp({ act: 0, energy: 0 });
  const apex = S.ghostAmp({ act: 2, energy: 1 });
  assert.ok(quiet <= S.GHOST_TUNING.amp, 'the ceiling holds');
  assert.ok(quiet < 1, 'a ghost is never a hand');
  assert.ok(apex < quiet * 0.5, `the apex stands back: ${apex.toFixed(3)} vs ${quiet.toFixed(3)}`);
  assert.ok(apex > 0, 'but it never goes to exactly nothing mid-stroke');
  assert.ok(S.ghostAmp({ act: 0, energy: 0, calm: true }) < quiet, 'CALM asks for less and gets it');
  for (const act of [-1, 0, 1, 2, 3, 4])
    for (const energy of [0, 0.5, 1])
      assert.ok(S.ghostAmp({ act, energy }) >= 0 && S.ghostAmp({ act, energy }) <= 1, 'always a presence');
});
test('ghostShould: reduced motion is a no, and a live hand is a no', () => {
  const base = { idle: 999 };
  assert.ok(S.ghostShould(base), 'a still room plays');
  assert.ok(!S.ghostShould({ ...base, reduced: true }), 'never for reduced motion');
  assert.ok(!S.ghostShould({ ...base, human: true }), 'never over a live hand');
  assert.ok(!S.ghostShould({ ...base, hidden: true }), 'never in a hidden tab');
  assert.ok(!S.ghostShould({ ...base, eco: true }), 'never on ECO');
  assert.ok(!S.ghostShould({ ...base, off: true }), 'never when switched off');
  assert.ok(!S.ghostShould({ idle: 5 }), 'and never before the room has been still a while');
  assert.ok(!S.ghostShould({}), 'a fresh session is not an idle one');
});
test('ghostPattern: every room deals a real choreography, and the apex rests', () => {
  for (let sc = 0; sc < 124; sc++)
    for (const act of [-1, 0, 1, 2, 3, 4])
      for (const r of [0.01, 0.3, 0.49, 0.6, 0.87, 0.99]){
        const k = S.ghostPattern(sc, act, r);
        assert.ok(S.GHOST_KINDS.includes(k), `scene ${sc} act ${act} r ${r} -> ${k}`);
        if (act === 2) assert.equal(k, 'drift', 'the apex belongs to the scenes');
      }
  assert.equal(S.ghostPattern(999, 1, 0.5), 'lissa', 'an unknown scene falls back to scene 0');
  // the wildcard must be able to reach every choreography, or the map is the map
  const wild = new Set();
  for (let i = 0; i < 400; i++) wild.add(S.ghostPattern(4, 1, 0.87 + (i / 400) * 0.129));
  assert.ok(wild.size >= 4, `the wildcard only ever produced ${wild.size} kinds`);
});
test('ghostSplit / ghostMirror: two hands, never at the apex, always a symmetry', () => {
  assert.ok(!S.ghostSplit({ act: 2, r: 0 }), 'the apex never splits');
  assert.ok(S.ghostSplit({ act: 0, r: 0.1 }), 'the quiet edges split readily');
  assert.ok(!S.ghostSplit({ act: 0, r: 0.9 }), 'and even there, only sometimes');
  assert.ok(S.ghostSplit({ act: 1, r: 0.1 }), 'the middle of the arc splits rarely');
  assert.ok(!S.ghostSplit({ act: 1, r: 0.3 }));
  assert.equal(S.ghostSplit({}), false, 'no dice, no split');
  for (const [axis, want] of [[0, [-0.3, 0.4]], [1, [0.3, -0.4]], [2, [-0.3, -0.4]]]){
    const m = S.ghostMirror(axis, 0.3, 0.4);
    assert.ok(Math.abs(m.x - want[0]) < 1e-12 && Math.abs(m.y - want[1]) < 1e-12, `axis ${axis}`);
  }
  // whatever the axis, the pair is two DIFFERENT places on the field
  for (const axis of [0, 1, 2, 3, -1]){
    const m = S.ghostMirror(axis, 0.3, 0.4);
    assert.ok(Math.hypot(m.x - 0.3, m.y - 0.4) > 1e-6, `axis ${axis} put both hands in one place`);
  }
});
test('ghostRand: deterministic, spread, and different per seed', () => {
  assert.equal(S.ghostRand(5, 3), S.ghostRand(5, 3), 'a choreography is replayable');
  assert.notEqual(S.ghostRand(5, 3), S.ghostRand(6, 3), 'seeds differ');
  assert.notEqual(S.ghostRand(5, 3), S.ghostRand(5, 4), 'steps differ');
  let lo = 0, hi = 0;
  for (let i = 0; i < 400; i++){
    const v = S.ghostRand(31, i);
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    if (v < 0.5) lo++; else hi++;
  }
  assert.ok(lo > 140 && hi > 140, `lopsided draw: ${lo}/${hi}`);
});

// ---------------------------------------------------------------- self-update

test('updateGate: not ready or already requested → wait', () => {
  assert.equal(S.updateGate({ ready: false, playing: false, now: 0 }), 'wait');
  assert.equal(S.updateGate({ ready: true, requested: true, playing: false, now: 0 }), 'wait');
});
test('updateGate: sustained quiet applies, playing waits — and a BLINK is not the quiet', () => {
  assert.equal(S.updateGate({ ready: true, playing: false, quietFor: S.UP_QUIET_MS, now: 0 }), 'apply');
  assert.equal(S.updateGate({ ready: true, playing: true, quietFor: 9e9, now: 0 }), 'wait');
  /* the failure this rule exists for: the two-second gap while the next track
     loads, a phone call, a breath between songs — each reads "not playing" at
     one five-second poll, and each used to cost the listener a white flash, a
     reload, and a set handed back paused */
  assert.equal(S.updateGate({ ready: true, playing: false, quietFor: 2000, now: 0 }), 'wait', 'a seam gap is not the quiet');
  assert.equal(S.updateGate({ ready: true, playing: false, quietFor: S.UP_QUIET_MS - 1, now: 0 }), 'wait', 'almost quiet is not quiet');
  for (const bad of [undefined, null, NaN, 'x', -5])
    assert.equal(S.updateGate({ ready: true, playing: false, quietFor: bad, now: 0 }), 'wait', 'unknown quiet is not quiet: ' + bad);
  // the wish a listener expressed still fires at its boundary, whatever the clock says
  assert.equal(S.updateGate({ ready: true, armed: 'afterTrack', playing: true, trackChanged: true, quietFor: 0, now: 0 }), 'apply');
});
test('updateGate: a person using the app is not a quiet room — no reload under a finger', () => {
  const idle = { ready: true, playing: false, quietFor: 9e9, now: 0 };
  assert.equal(S.updateGate(idle), 'apply', 'the baseline: an idle, silent room updates');
  /* the report: "right after I play the first track it pops up the [queue] and
     when I hit the x it refreshes" — a lesson open, a finger on a close box, and
     "nothing playing" was the only question the gate asked */
  assert.equal(S.updateGate(Object.assign({}, idle, { busy: true })), 'wait',
    'a lesson, a panel or a card on screen holds the swap');
  assert.equal(S.updateGate(Object.assign({}, idle, { touchedAgo: 800 })), 'wait',
    'a touch a moment ago holds the swap');
  assert.equal(S.updateGate(Object.assign({}, idle, { touchedAgo: S.UP_TOUCH_MS - 1 })), 'wait');
  assert.equal(S.updateGate(Object.assign({}, idle, { touchedAgo: S.UP_TOUCH_MS })), 'apply',
    'put the app down for a minute and it may refresh');
  assert.equal(S.updateGate(Object.assign({}, idle, { touchedAgo: 9e12 })), 'apply', 'never touched (launch) is not a touch');
  // the listener's own wish still fires at its boundary, busy or not
  assert.equal(S.updateGate({ ready: true, armed: 'afterTrack', playing: false, busy: true, touchedAgo: 0, now: 0 }), 'apply');
});
test('updateGate: SHOW mode is never yanked, even paused', () => {
  assert.equal(S.updateGate({ ready: true, playing: false, quietFor: 9e9, show: true, now: 0 }), 'wait');
});
test('updateGate: a snooze holds auto-apply until it lapses', () => {
  assert.equal(S.updateGate({ ready: true, playing: false, quietFor: 9e9, snoozedUntil: 100, now: 50 }), 'wait');
  assert.equal(S.updateGate({ ready: true, playing: false, quietFor: 9e9, snoozedUntil: 100, now: 150 }), 'apply');
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
  /* THE LINEAGE. Most deploys ship no changelog entry of their own — polish, a
     fix, the stamp commit — and their build id is one no entry has heard of. The
     walk then ran off the end and the card told a listener on the NEWEST build
     about the last four things they already had, which is exactly what "the app
     doesn't know it updated" looks like from the outside. stamp_version.py
     records every stamped build on the newest entry; the walk stops there too. */
  const lineage = [{ build: 'd', builds: ['d1', 'd2'] }, { build: 'c' }, { build: 'b' }];
  assert.deepEqual(S.newsSince(lineage, 'd2').map(e => e.build), [],
    'a build that shipped under the newest entry is current, not four behind');
  assert.deepEqual(S.newsSince(lineage, 'c').map(e => e.build), ['d']);
  assert.deepEqual(S.newsSince([{ build: 'd', builds: null }], 'd').map(e => e.build), [],
    'a malformed lineage costs nothing');
});
/* ---- STAGE: one field, several screens ------------------------------------
   The arithmetic that decides where a screen cuts into the picture. It is worth
   testing on its own because the failure it prevents is invisible in one
   window and glaring in three: a seam where a shape jumps, changes size, or
   arrives late. */
test('updateGate + updateOffer: the Mac app is a different artefact, asked for by hand', () => {
  const base = { ready: true, requested: false, armed: '', trackChanged: false,
    playing: false, quietFor: 9e9, show: false, snoozedUntil: 0, now: 1000, applies: 0 };
  assert.equal(S.updateGate(base), 'apply', 'an ordinary update still lands in the quiet');
  /* A NATIVE UPDATE REPLACES THE PROCESS. Every gate that protects a listener
     reads "idle, go ahead" when nothing is playing — and a stage screen is
     ALWAYS idle. Nothing about the shell's update may ever be automatic. */
  assert.equal(S.updateGate({ ...base, native: true }), 'wait');
  assert.equal(S.updateGate({ ...base, native: true, armed: 'afterTrack', trackChanged: true }), 'wait',
    'not even the boundary a listener explicitly asked for');
  // and it is judged by its own name, never against the player's build id
  const run = 'aaaa111111';
  assert.equal(S.updateOffer({ source: 'native', build: '0.2.0', running: run }), 'show');
  assert.equal(S.updateOffer({ source: 'native', build: run, running: run }), 'show',
    'the app version and the player build are different numbers about different things');
  assert.equal(S.updateOffer({ source: 'native', build: '', running: run }), 'ignore',
    'an unnamed native claim is not a claim');
  const key = S.updateOfferKey('native-0.1.1', '0.2.0');
  assert.equal(S.updateOffer({ source: 'native', build: '0.2.0', running: run, key, tried: key }), 'applied');
});
test('stageGrid: a row is what a stage is, until a row becomes a slit', () => {
  assert.deepEqual(S.stageGrid(1), { cols: 1, rows: 1 });
  assert.deepEqual(S.stageGrid(3), { cols: 3, rows: 1 }, 'three TVs behind a booth is a row');
  assert.deepEqual(S.stageGrid(4), { cols: 4, rows: 1 });
  // past four a row gives each screen a letterbox slit of the field, so it folds
  assert.deepEqual(S.stageGrid(6), { cols: 3, rows: 2 });
  assert.deepEqual(S.stageGrid(8), { cols: 3, rows: 3 });
  // the arrangement can always be said out loud instead
  assert.deepEqual(S.stageGrid(6, 'row'), { cols: 6, rows: 1 });
  assert.deepEqual(S.stageGrid(3, 'column'), { cols: 1, rows: 3 });
  // garbage is a single screen, never a crash and never zero columns
  for (const bad of [0, -4, NaN, null, undefined, 'x', 1e9])
    assert.ok(S.stageGrid(bad).cols >= 1 && S.stageGrid(bad).rows >= 1, 'bad input: ' + bad);
});
test('stageSlice: the slices tile the field exactly once, with no gap and no overlap', () => {
  for (const of of [1, 2, 3, 4, 5, 6, 7, 8]){
    let area = 0;
    const seen = new Set();
    for (let i = 1; i <= of; i++){
      const s = S.stageSlice(i, of);
      area += s.fw * s.fh;
      seen.add(s.fx.toFixed(6) + ':' + s.fy.toFixed(6));
      assert.ok(s.fx >= 0 && s.fy >= 0 && s.fx + s.fw <= 1 + 1e-9 && s.fy + s.fh <= 1 + 1e-9,
        of + ' screens: slice ' + i + ' left the field');
    }
    assert.equal(seen.size, of, of + ' screens must sit in ' + of + ' different places');
    const g = S.stageGrid(of);
    // a grid can hold more cells than there are screens (7 televisions, 3x3):
    // the covered area is then the screens' share of it, never more than all
    assert.ok(area <= 1 + 1e-9 && Math.abs(area - of / (g.cols * g.rows)) < 1e-9,
      of + ' screens cover ' + area);
  }
  // reading order is left to right, then down — the order someone hangs them in
  const mid = S.stageSlice(2, 3);
  assert.ok(Math.abs(mid.fx - 1 / 3) < 1e-9 && mid.fy === 0, 'screen 2 of 3 is the middle third');
  const wall = S.stageSlice(4, 6);
  assert.equal(wall.row, 1, 'the fourth of six has wrapped to the second row');
  assert.equal(wall.col, 0);
  // an index nobody hung is clamped to a real slice rather than refused: a
  // screen showing the wrong third is fixable on the night, a black one is not
  assert.ok(S.stageSlice(9, 3).fw > 0);
  assert.ok(S.stageSlice(0, 3).fw > 0);
});
test('stageRole: a screen is configured entirely by its own address', () => {
  assert.deepEqual(S.stageRole(''), { role: 'booth', screen: 1, of: 1, mode: 'auto', join: null, crowd: null, id: 's1' });
  // a crowd code is the OTHER door — a phone, not a screen — parsed by the
  // same rules: a scanned QR is this URL, misheard digits are letters
  assert.equal(S.stageRole('?crowd=buzz').crowd, 'BUZZ');
  assert.equal(S.stageRole('?crowd=R0CK').crowd, 'ROCK');
  assert.equal(S.stageRole('?crowd=12').crowd, null, 'a number is never a knock');
  // four letters in the address are a knock on another booth's door; a scan
  // of an invite QR is exactly this URL, so scanning IS joining
  assert.equal(S.stageRole('?stage=screen&join=buzz').join, 'BUZZ');
  assert.equal(S.stageRole('?stage=screen&join=R0CK').join, 'ROCK', 'a misheard 0 is an O');
  assert.equal(S.stageRole('?stage=screen&join=nope!').join, null, 'junk is not a code');
  assert.equal(S.stageRole('?stage=screen').join, null);
  // identity travels in the address, because it has to outlive a renumbering
  assert.equal(S.stageRole('?stage=screen&screen=2&of=3').id, 's2', 'a screen with no id gets one from its number');
  assert.equal(S.stageRole('?stage=screen&screen=2&of=3&id=pip7').id, 'pip7');
  assert.ok(S.stageRole('?stage=screen&id=' + 'x'.repeat(400)).id.length <= 24, 'an id from a URL is bounded');
  assert.equal(S.stageRole('?stage=screen').role, 'screen');
  assert.equal(S.stageRole('?stage=1').role, 'screen');
  assert.equal(S.stageRole('?catalog=x&stage=screen&screen=2&of=3').screen, 2);
  assert.equal(S.stageRole('?stage=screen&screen=2&of=3').of, 3);
  assert.equal(S.stageRole('?stage=screen&wall=row').mode, 'row');
  // a screen numbered past the wall it is in is pulled back into it
  assert.equal(S.stageRole('?stage=screen&screen=9&of=3').screen, 3);
  // nothing here may throw: this runs before the app exists
  for (const bad of [null, undefined, '?stage', '?=&&=', '?of=NaN&screen=-2&stage=screen'])
    assert.ok(S.stageRole(bad).screen >= 1);
});
/* ---------------------------------------------------------------- the wall
 * Screens stop being numbers and become rectangles. What has to hold:
 *   · the wall is the union of wherever the windows actually are
 *   · a window's slice is its own share of that union, in the units
 *     setViewOffset wants — the SAME four numbers stageSlice produces, so the
 *     grid stays a drop-in floor under a rig that cannot report geometry
 *   · the seam is exact: every screen must derive the identical full frustum
 *     from its own different pixel size, or a shape crossing between two
 *     televisions tears
 *   · nothing here may throw, whatever a window reports about itself */
test('stageBounds: the wall is the union of wherever the windows are', () => {
  // a laptop and a television beside it, the television taller
  const b = S.stageBounds([{ x: 0, y: 90, w: 1440, h: 900 }, { x: 1440, y: 0, w: 1920, h: 1080 }]);
  assert.deepEqual({ x: b.x, y: b.y, w: b.w, h: b.h }, { x: 0, y: 0, w: 3360, h: 1080 });
  assert.equal(b.n, 2);
  // a monitor above and to the left of the primary display: negative is a real
  // place on a desk, not an error
  const up = S.stageBounds([{ x: 0, y: 0, w: 100, h: 100 }, { x: -60, y: -40, w: 50, h: 30 }]);
  assert.deepEqual({ x: up.x, y: up.y, w: up.w, h: up.h }, { x: -60, y: -40, w: 160, h: 140 });
  // overlapping windows describe a SMALL wall and both show most of the field —
  // which is exactly what two corner previews on one laptop should look like
  const lap = S.stageBounds([{ x: 0, y: 0, w: 400, h: 200 }, { x: 20, y: 10, w: 400, h: 200 }]);
  assert.deepEqual({ w: lap.w, h: lap.h }, { w: 420, h: 210 });
  // no screens is a wall of one unit, because every caller divides by it
  const none = S.stageBounds([]);
  assert.ok(none.w >= 1 && none.h >= 1 && none.n === 0);
  for (const bad of [null, undefined, [null], [{}], [{ x: NaN, y: 'x', w: 0, h: -5 }]])
    assert.doesNotThrow(() => S.stageBounds(bad), 'bad rects: ' + JSON.stringify(bad));
});
test('stageLayout: a window\'s slice is its own share of the wall, and the seam is exact', () => {
  // three identical televisions in a row is the grid, arrived at from geometry
  const row = S.stageLayout([
    { id: 'a', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'b', x: 1920, y: 0, w: 1920, h: 1080 },
    { id: 'c', x: 3840, y: 0, w: 1920, h: 1080 },
  ]);
  for (const [id, i] of [['a', 0], ['b', 1], ['c', 2]]){
    const c = row.map[id], g = S.stageSlice(i + 1, 3);
    assert.ok(Math.abs(c.fx - g.fx) < 1e-9 && Math.abs(c.fw - g.fw) < 1e-9,
      id + ' must land exactly where the grid would have put it');
    assert.ok(c.fy === 0 && Math.abs(c.fh - 1) < 1e-9);
  }
  /* THE SEAM. Each screen computes the full frustum as its own pixels divided
     by its own fraction. Different pixel sizes, one answer — that identity is
     the whole reason a shape can cross between two televisions without a tear,
     so it is asserted on a deliberately mismatched pair. */
  const odd = [{ id: 'lap', x: 0, y: 90, w: 1440, h: 900 }, { id: 'tv', x: 1440, y: 0, w: 1920, h: 1080 }];
  const L = S.stageLayout(odd);
  let fullW = null, fullH = null;
  for (const r of odd){
    const c = L.map[r.id];
    const W = r.w / c.fw, H = r.h / c.fh;
    if (fullW === null){ fullW = W; fullH = H; }
    assert.ok(Math.abs(W - fullW) < 1e-6 && Math.abs(H - fullH) < 1e-6,
      r.id + ' derived a different frustum: ' + W + '×' + H + ' vs ' + fullW + '×' + fullH);
    // and its offset into that frustum is the true pixel distance from the
    // left edge of the wall — the number setViewOffset is actually given
    assert.ok(Math.abs(c.fx * W - (r.x - L.bounds.x)) < 1e-6, r.id + ' offset');
    assert.ok(Math.abs(c.fy * H - (r.y - L.bounds.y)) < 1e-6, r.id + ' offset y');
  }
  assert.equal(fullW, 3360);
  // one window on its own takes the whole field, which is the no-cut case
  const solo = S.stageLayout([{ id: 'x', x: 700, y: 400, w: 800, h: 450 }]);
  assert.deepEqual([solo.map.x.fx, solo.map.x.fy, solo.map.x.fw, solo.map.x.fh], [0, 0, 1, 1]);
  // nothing may throw, and an entry with no identity is simply not a screen
  assert.doesNotThrow(() => S.stageLayout([{ x: 0, y: 0, w: 1, h: 1 }, null, undefined]));
  assert.equal(Object.keys(S.stageLayout([{ x: 0, y: 0, w: 9, h: 9 }]).map).length, 0);
});
test('stageOrder: screen one is the leftmost on the top shelf, whatever order it arrived in', () => {
  // three in a row, reported back to front
  assert.deepEqual(S.stageOrder([
    { id: 'c', x: 3840, y: 0, w: 1920, h: 1080 },
    { id: 'a', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'b', x: 1920, y: 0, w: 1920, h: 1080 },
  ]), ['a', 'b', 'c']);
  // a video wall: reading order is across the top row and then down
  assert.deepEqual(S.stageOrder([
    { id: 'br', x: 100, y: 100, w: 100, h: 100 },
    { id: 'tr', x: 100, y: 0, w: 100, h: 100 },
    { id: 'bl', x: 0, y: 100, w: 100, h: 100 },
    { id: 'tl', x: 0, y: 0, w: 100, h: 100 },
  ]), ['tl', 'tr', 'bl', 'br']);
  // televisions hung a few pixels out of true are still one shelf, not two
  assert.deepEqual(S.stageOrder([
    { id: 'r', x: 1920, y: 14, w: 1920, h: 1080 },
    { id: 'l', x: 0, y: 0, w: 1920, h: 1080 },
  ]), ['l', 'r']);
  // THE RENUMBERING: drag the third window to the far left and it becomes
  // screen one — identity follows the window, the number follows the place
  const before = S.stageLayout([
    { id: 'p1', x: 0, y: 0, w: 300, h: 200 },
    { id: 'p2', x: 320, y: 0, w: 300, h: 200 },
    { id: 'p3', x: 640, y: 0, w: 300, h: 200 },
  ]);
  assert.equal(before.map.p3.n, 3);
  const after = S.stageLayout([
    { id: 'p1', x: 0, y: 0, w: 300, h: 200 },
    { id: 'p2', x: 320, y: 0, w: 300, h: 200 },
    { id: 'p3', x: -400, y: 0, w: 300, h: 200 },
  ]);
  assert.equal(after.map.p3.n, 1, 'the window that moved left is screen one now');
  assert.equal(after.map.p1.n, 2);
  assert.equal(after.map.p3.of, 3);
  assert.deepEqual(S.stageOrder([]), []);
  for (const bad of [null, undefined, [null], [{ id: 'a' }]])
    assert.doesNotThrow(() => S.stageOrder(bad));
});
test('stagePlan: screens are dealt to monitors in reading order, and the booth keeps its own while it can', () => {
  // the two-monitor rig almost everyone has: booth on the built-in display,
  // one television to its right — one screen goes to the television
  const desk = [
    { x: 0, y: 0, width: 1512, height: 982 },      // the booth's
    { x: 1512, y: 0, width: 1920, height: 1080 },  // the television
  ];
  assert.deepEqual(S.stagePlan(desk, 1, 0), [1], 'one screen spares the booth');
  // ask for every monitor and you plainly mean all of them, booth included,
  // numbered as they hang: leftmost is screen one
  assert.deepEqual(S.stagePlan(desk, 2, 0), [0, 1]);
  // the television is LEFT of the laptop: screen one is the leftmost monitor,
  // whatever order the OS enumerated them in
  const flipped = [
    { x: 0, y: 0, width: 1512, height: 982 },       // the booth's, primary
    { x: -1920, y: 0, width: 1920, height: 1080 },  // the television, to the left
  ];
  assert.deepEqual(S.stagePlan(flipped, 1, 0), [1]);
  assert.deepEqual(S.stagePlan(flipped, 2, 0), [1, 0], 'reading order across the real desk');
  // three monitors, two screens: the spare ones in reading order, booth spared
  const three = [
    { x: 0, y: 0, width: 1512, height: 982 },       // booth, centre of the desk
    { x: 1512, y: 0, width: 1920, height: 1080 },   // right
    { x: -1920, y: 0, width: 1920, height: 1080 },  // left
  ];
  assert.deepEqual(S.stagePlan(three, 2, 0), [2, 1], 'screen one on the left television');
  // more screens than monitors: the extras stack on the last one, visibly,
  // rather than being refused invisibly
  assert.deepEqual(S.stagePlan(desk, 3, 0), [0, 1, 1]);
  // a booth nobody located: nothing is spared, reading order still holds
  assert.deepEqual(S.stagePlan(three, 3), [2, 0, 1]);
  // nothing to plan against is an empty plan, not a throw
  assert.deepEqual(S.stagePlan([], 2, 0), []);
  for (const bad of [null, undefined, [null], [{}]])
    assert.doesNotThrow(() => S.stagePlan(bad, 2, 0));
  assert.ok(S.stagePlan(desk, NaN, 0).length === 1, 'a countless ask is one screen');
});
test('stageCodeTidy/Is: four letters are a door, a number is a count, and 0/1 are misheard letters', () => {
  assert.equal(S.stageCodeTidy('buzz'), 'BUZZ');
  assert.equal(S.stageCodeTidy('  b u-z z  '), 'BUZZ');
  // read aloud, 0 is O and 1 is I — the mailbox never mints I or O, so a
  // typed digit is a misheard letter and is put back as one
  assert.equal(S.stageCodeTidy('R0CK'), 'ROCK');
  assert.equal(S.stageCodeTidy('F1RE'), 'FIRE');
  assert.equal(S.stageCodeTidy('TOOLONG'), 'TOOL');
  assert.ok(S.stageCodeIs('BUZZ') && S.stageCodeIs(' buzz '));
  // a count of screens must never be mistaken for a knock
  assert.ok(!S.stageCodeIs('3') && !S.stageCodeIs('12') && !S.stageCodeIs('0'));
  // nor a half-typed word, nor a code-with-junk — tidy would mangle both
  assert.ok(!S.stageCodeIs('BUZ') && !S.stageCodeIs('BUZZY') && !S.stageCodeIs('BU-ZZ'));
  for (const bad of [null, undefined, 7, {}])
    assert.doesNotThrow(() => { S.stageCodeTidy(bad); S.stageCodeIs(bad); });
});
test('stageNetWall: screens with no desk form a wall of their own, in join order', () => {
  // one device is the whole field
  const one = S.stageNetWall(['na']);
  assert.equal(one.na.of, 1);
  assert.ok(one.na.fw > 0.999 && one.na.fh > 0.999);
  // two devices are a row of two — the first to join is the left half
  const two = S.stageNetWall(['na', 'nb']);
  assert.ok(Math.abs(two.na.fw - 0.5) < 1e-9 && Math.abs(two.na.fx) < 1e-9);
  assert.ok(Math.abs(two.nb.fx - 0.5) < 1e-9 && two.nb.n === 2 && two.nb.of === 2);
  // walk in with a third and everyone re-cuts to thirds
  const three = S.stageNetWall(['na', 'nb', 'nc']);
  assert.ok(Math.abs(three.nb.fx - 1 / 3) < 1e-9 && Math.abs(three.nb.fw - 1 / 3) < 1e-9);
  // the slices tile: offsets and widths sum to the whole
  const sum = three.na.fw + three.nb.fw + three.nc.fw;
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.deepEqual(S.stageNetWall([]), {});
  for (const bad of [null, undefined, [null]])
    assert.doesNotThrow(() => S.stageNetWall(bad));
});
test('stageSpread: the field passes behind the frames, and every flush seam opens by two of them', () => {
  // three matching TVs flush in desktop coordinates, 2% frames
  const row = [
    { id: 'a', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'b', x: 1920, y: 0, w: 1920, h: 1080 },
    { id: 'c', x: 3840, y: 0, w: 1920, h: 1080 },
  ];
  const out = S.stageSpread(row, 0.02);
  // sizes are the glass and the glass did not grow
  for (const r of out) assert.equal(r.w, 1920);
  // each seam opened by exactly two frame-widths
  const gap = out[1].x - (out[0].x + out[0].w);
  assert.ok(Math.abs(gap - 2 * 0.02 * 1920) < 1e-6, 'gap ' + gap);
  assert.ok(Math.abs((out[2].x - (out[1].x + out[1].w)) - gap) < 1e-6, 'seams match');
  // …and the wall's slices now EXCLUDE the gutters: a ball crossing the
  // seam spends real time behind the plastic
  const L = S.stageLayout(out);
  assert.ok(L.map.a.fx + L.map.a.fw < L.map.b.fx, 'a hidden gutter lives between the slices');
  // identity is the identity: zero bezel, one screen, junk — all unmoved
  assert.deepEqual(S.stageSpread(row, 0).map(r => r.x), [0, 1920, 3840]);
  assert.deepEqual(S.stageSpread([row[0]], 0.05)[0].x, 0, 'one screen has no seams');
  // a grid spreads both axes
  const quad = S.stageSpread([
    { x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 100, h: 100 },
    { x: 0, y: 100, w: 100, h: 100 }, { x: 100, y: 100, w: 100, h: 100 },
  ], 0.05);
  assert.ok(quad[3].x - 100 > 1e-6 && quad[3].y - 100 > 1e-6);
  // absurd bezels are capped rather than believed
  const wild = S.stageSpread(row, 9);
  assert.ok(wild[1].x - 1920 <= 2 * 0.25 * 1920 + 1e-6);
  for (const bad of [null, undefined, [null], [{}]])
    assert.doesNotThrow(() => S.stageSpread(bad, 0.02));
});
test('stageNetWall with bezels: the wire\'s wall wears its frames like the desk\'s', () => {
  const flat = S.stageNetWall(['na', 'nb'], 0);
  const framed = S.stageNetWall(['na', 'nb'], 0.02);
  // without frames the halves touch; with frames a gutter lives between them
  assert.ok(Math.abs((flat.na.fx + flat.na.fw) - flat.nb.fx) < 1e-9);
  assert.ok(framed.na.fx + framed.na.fw < framed.nb.fx, 'the seam opened');
  // numbering and count survive the frames
  assert.ok(framed.na.n === 1 && framed.nb.n === 2 && framed.nb.of === 2);
  // and each glass is still a glass-shaped share, just of a wider wall
  assert.ok(framed.na.fw < flat.na.fw);
});
test('crowdPack/crowdClamp: the pulse is tiny, and only a whole good pulse is believed', () => {
  const chord = [{ l: 0.7, c: 0.11, h: 200 }, { l: 0.6, c: 0.12, h: 220 }, { l: 0.5, c: 0.13, h: 240 }];
  const p = S.crowdPack(chord, 3);
  assert.equal(p.v, 1);
  assert.equal(p.s, 3);
  assert.equal(p.c.length, 3);
  assert.deepEqual(p.c[0], [0.7, 0.11, 200]);
  // small on the wire: every byte is multiplied by a crowd
  assert.ok(JSON.stringify(p).length < 120, JSON.stringify(p).length + ' bytes');
  // the round trip is the identity for a good pulse
  const back = S.crowdClamp(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.c, p.c);
  assert.equal(back.s, p.s);
  // out-of-range values are clamped on the way out…
  const wild = S.crowdPack([{ l: 4, c: 9, h: -160 }, chord[1], chord[2]], 999);
  assert.ok(wild.c[0][0] <= 1 && wild.c[0][1] <= 0.5 && wild.c[0][2] >= 0 && wild.c[0][2] < 360);
  assert.ok(wild.s <= 63);
  // …and on the way in — a stranger's server hands this to the renderer
  const hot = S.crowdClamp({ v: 1, s: -5, c: [[9, 9, 900], [0.5, 0.1, 10], [0.5, 0.1, 20]] });
  assert.ok(hot.c[0][0] <= 1 && hot.c[0][1] <= 0.5 && hot.c[0][2] < 360 && hot.s === 0);
  // a HALF-good pulse is refused whole — it would tint the room a colour
  // nobody chose
  assert.equal(S.crowdClamp({ v: 1, s: 1, c: [[0.5, 0.1, NaN], [0.5, 0.1, 10], [0.5, 0.1, 20]] }), null);
  assert.equal(S.crowdClamp({ v: 2, s: 1, c: [[0.5, 0.1, 5], [0.5, 0.1, 10], [0.5, 0.1, 20]] }), null, 'an unknown version is not guessed at');
  for (const bad of [null, undefined, {}, { v: 1 }, { v: 1, c: [] }, 'x'])
    assert.equal(S.crowdClamp(bad), null);
  assert.equal(S.crowdPack(null, 1), null);
  assert.equal(S.crowdPack([{ l: NaN, c: 0.1, h: 1 }, {}, {}], 1), null);
});
test('stageMoved: a window that has not moved must not cost a message', () => {
  const a = { x: 10, y: 20, w: 300, h: 200 };
  assert.ok(!S.stageMoved(a, { x: 10, y: 20, w: 300, h: 200 }));
  // a fraction of a pixel is a device ratio, not a drag
  assert.ok(!S.stageMoved(a, { x: 10.2, y: 20, w: 300, h: 200 }));
  assert.ok(S.stageMoved(a, { x: 12, y: 20, w: 300, h: 200 }));
  assert.ok(S.stageMoved(a, { x: 10, y: 20, w: 300, h: 260 }), 'a resize is a move');
  // the first reading, against nothing
  assert.ok(S.stageMoved(null, a));
  assert.ok(!S.stageMoved(null, null));
  assert.doesNotThrow(() => S.stageMoved(a, { x: 'x', y: null, w: undefined, h: NaN }));
});
test('stageRect: a window that reports nonsense about itself is not allowed to poison a wall', () => {
  const r = S.stageRect({ x: NaN, y: 'over there', w: 0, h: -400 });
  assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y));
  assert.ok(r.w >= 1 && r.h >= 1, 'a zero-area window would divide the field by nothing');
  assert.deepEqual(S.stageRect({ x: 5, y: 6, w: 7, h: 8 }), { x: 5, y: 6, w: 7, h: 8 });
  for (const bad of [null, undefined, 0, 'x', []])
    assert.doesNotThrow(() => S.stageRect(bad));
});

test('stageResolveRects: a webview that cannot read its own position must not collapse the wall', () => {
  const placed = {
    s1: { x: 0, y: 0, w: 1512, h: 982 },
    s2: { x: 1512, y: -98, w: 1920, h: 1080 },
  };
  // the good case: both windows know where they are, and are believed
  const honest = S.stageResolveRects([
    { id: 's1', rect: { x: 0, y: 0, w: 1512, h: 982 } },
    { id: 's2', rect: { x: 1512, y: -98, w: 1920, h: 1080 } },
  ], placed);
  assert.equal(honest.length, 2);
  assert.equal(honest[1].x, 1512);
  /* THE FAILURE THIS EXISTS FOR: a shell whose webviews each report themselves
     at the origin. Two identical rectangles is not two windows in one place —
     it is a webview that cannot read itself — so the monitors the booth filled
     are used instead, and the wall stays two monitors wide. */
  const lying = S.stageResolveRects([
    { id: 's1', rect: { x: 0, y: 0, w: 1512, h: 982 } },
    { id: 's2', rect: { x: 0, y: 0, w: 1512, h: 982 } },
  ], placed);
  assert.deepEqual(lying.map(r => r.x), [0, 1512], 'the placements must win');
  const wall = S.stageLayout(lying);
  assert.ok(wall.bounds.w > 3000, 'the wall is still two monitors wide, got ' + wall.bounds.w);
  assert.ok(wall.map.s1.fw < 0.5 && wall.map.s2.fw < 0.65, 'and neither screen shows all of it');
  // a window that has not spoken yet still counts, from where it was put
  const early = S.stageResolveRects([{ id: 's1', rect: null }, { id: 's2', rect: null }], placed);
  assert.equal(early.length, 2);
  // …and a window with neither a reading nor a placement is simply not there
  assert.equal(S.stageResolveRects([{ id: 'ghost', rect: null }], placed).length, 0);
  // two corner windows genuinely stacked, with no placements, are believed:
  // overlapping previews on one laptop is a real thing to do
  const stacked = S.stageResolveRects([
    { id: 'a', rect: { x: 10, y: 10, w: 300, h: 200 } },
    { id: 'b', rect: { x: 10, y: 10, w: 300, h: 200 } },
  ], {});
  assert.equal(stacked.length, 2);
  for (const bad of [null, undefined, [null], [{}], [{ id: 'x', rect: 'nope' }]])
    assert.doesNotThrow(() => S.stageResolveRects(bad, null), JSON.stringify(bad));
});
test('stageHandLocal: one gesture crossing one field, not one touch per screen', () => {
  const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, (m || '') + ' got ' + a + ' want ' + b);
  // one screen: the conversion is the identity, so a single stage is untouched
  const solo = { fx: 0, fy: 0, fw: 1, fh: 1 };
  for (const [x, y] of [[0, 0], [-1, 1], [0.4, -0.7]]){
    const h = S.stageHandLocal({ x, y }, solo);
    near(h.x, x, 'x'); near(h.y, y, 'y');
  }
  assert.deepEqual(S.stageHandLocal({ x: 0.5, y: -0.5 }, null), { x: 0.5, y: -0.5 });
  // three screens in a row: a hand at the middle of the FIELD is at the middle
  // of the middle screen, and off the edge of the other two
  const cut = i => S.stageSlice(i, 3);
  near(S.stageHandLocal({ x: 0, y: 0 }, cut(2)).x, 0, 'middle screen holds the middle');
  assert.ok(S.stageHandLocal({ x: 0, y: 0 }, cut(1)).x > 1, 'screen 1 sees it off to its right');
  assert.ok(S.stageHandLocal({ x: 0, y: 0 }, cut(3)).x < -1, 'screen 3 sees it off to its left');
  // the far left of the field is the far left of screen 1
  near(S.stageHandLocal({ x: -1, y: 0 }, cut(1)).x, -1);
  // and the seam is the seam: the hand leaving screen 1's right edge arrives
  // at screen 2's left edge at the same instant, which is what makes a drag
  // across two televisions one drag
  const seam = -1 / 3;
  near(S.stageHandLocal({ x: seam, y: 0 }, cut(1)).x, 1, 'leaves screen 1');
  near(S.stageHandLocal({ x: seam, y: 0 }, cut(2)).x, -1, 'and enters screen 2');
  // vertical too, on a screen that is the bottom half of the wall
  const low = { fx: 0, fy: 0.5, fw: 1, fh: 0.5 };
  near(S.stageHandLocal({ x: 0, y: 0 }, low).y, 1, 'the field\'s middle is this screen\'s top');
  near(S.stageHandLocal({ x: 0, y: -1 }, low).y, -1, 'and the field\'s floor is its floor');
  for (const bad of [null, undefined, { x: NaN, y: 'x' }])
    assert.doesNotThrow(() => S.stageHandLocal(bad, cut(2)), JSON.stringify(bad));
  const junk = S.stageHandLocal({ x: NaN, y: undefined }, { fw: 0, fh: null, fx: NaN });
  assert.ok(Number.isFinite(junk.x) && Number.isFinite(junk.y), 'a bad cut may not produce a NaN hand');
});


/* ------------------------------------------------------------------- DMX
 * The rig is the first thing this program does that can be WRONG IN A ROOM.
 * Everything else renders a picture; this drives mains-powered lamps from a
 * channel map read out of a manual, and a byte in the wrong place is a
 * fixture doing something nobody asked for at a gig. So the manuals' charts
 * are the fixtures under test: every band boundary, every interlock, and
 * every place the hardware is less capable than the intent handed to it. */
test('dmxPatch: addresses stack, the universe ends at 512, and a networked light takes none', () => {
  const p = S.dmxPatch([
    { key: 'venue-thintri-38', mode: '8ch' },
    { key: 'venue-thintri-38', mode: '8ch' },
    { key: 'adj-mystic-led' },
  ]);
  assert.deepEqual(p.map(f => f.at), [1, 9, 17], 'each fixture starts where the last one ended');
  assert.deepEqual(p.map(f => f.span), [8, 8, 4]);
  assert.equal(S.dmxUniverseUsed(p), 20);
  // an address given by hand is kept — it is set on the fixture's own display
  const hand = S.dmxPatch([{ key: 'adj-mystic-led', at: 100 }, { key: 'venue-thintri-38', mode: '3ch' }]);
  assert.deepEqual(hand.map(f => f.at), [100, 104]);
  /* A HUE BULB IS NOT ON THE WIRE. It must take no address, and — the part
     that would actually break a rig — it must not push the fixtures that ARE
     on the wire up the universe. Patch a bulb between two washes and both
     washes keep the addresses they were set to on their own displays. */
  const mixed = S.dmxPatch([
    { key: 'venue-thintri-38', mode: '8ch' },
    { key: 'philips-hue', net: 'bulb-3' },
    { key: 'venue-thintri-38', mode: '8ch' },
  ]);
  assert.deepEqual(mixed.map(f => f.at), [1, 0, 9], 'the bulb costs the wire nothing');
  assert.equal(mixed[1].wire, 'net');
  assert.equal(S.dmxUniverseUsed(mixed), 16);
  // and 512 is a real edge: a fixture hanging off the end is marked, not dropped
  const over = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch', at: 509 }]);
  assert.equal(over.length, 1);
  assert.equal(over[0].fits, false, 'ch 509-516 does not fit in 512');
  assert.equal(S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch', at: 505 }])[0].fits, true);
  for (const bad of [null, undefined, [null], [{}], [{ key: 'nope' }]])
    assert.doesNotThrow(() => S.dmxPatch(bad), JSON.stringify(bad));
  assert.equal(S.dmxPatch([{ key: 'nope' }]).length, 0, 'a fixture nobody has a profile for is not patched');
});
test('dmxRender ThinTri 38: true RGB, a real dimmer, and the two interlocks that bite', () => {
  const p = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch' }]);
  const f = S.dmxRender(p, { [p[0].id]: { r: 1, g: 0.5, b: 0, dim: 1 } });
  assert.equal(f.length, 512);
  assert.deepEqual([f[0], f[1], f[2]], [255, 128, 0], 'RGB lands on channels 1-3');
  assert.equal(f[6], 255, 'channel 7 is the dimmer');
  /* CHANNEL 4 OVERRIDES THE COLOUR CHANNELS above 015, so it is held at zero.
     A renderer that left junk there would produce a fixture showing a macro
     colour while the console insisted it was showing the chord. */
  assert.equal(f[3], 0, 'no colour macro unless one was asked for');
  /* CHANNEL 5 ONLY MEANS "STROBE" WHILE CHANNEL 6 IS IN ITS NO-FUNCTION BAND.
     Anywhere else it is a program speed or the microphone's sensitivity. */
  assert.equal(f[5], 0, 'channel 6 stays in the band where the console is in charge');
  const st = S.dmxRender(p, { [p[0].id]: { r: 1, g: 1, b: 1, dim: 1, strobe: 1 } });
  /* a full strobe intent clears the no-function band but stays in the SLICE
     the safety cap allows — the top of 016-255 is the physical lamp's
     fastest strobe, which is inside the photosensitive band and must be
     unreachable however hard the intent asks */
  assert.ok(st[4] > 15, 'a full strobe intent registers, got ' + st[4]);
  assert.ok(S.dmxDecode(p[0], st).strobeHz <= S.DMX_STROBE_MAX_HZ, 'and stays under the cap on the wire');
  assert.ok(st[5] <= 31, 'and channel 6 must stay put or channel 5 stops being a strobe');
  const none = S.dmxRender(p, { [p[0].id]: { r: 1, g: 1, b: 1, dim: 1, strobe: 0 } });
  assert.equal(none[4], 0, '000-015 is "no function", so no strobe means zero');
  // the dimmer curve is off: this fixture is being driven 30 times a second
  assert.equal(none[7], 0);
});
test('dmxRender ThinTri 38 in 3-channel mode: no dimmer channel exists, so the dimmer is the colour', () => {
  const p = S.dmxPatch([{ key: 'venue-thintri-38', mode: '3ch' }]);
  assert.equal(p[0].span, 3);
  const half = S.dmxRender(p, { [p[0].id]: { r: 1, g: 1, b: 1, dim: 0.5 } });
  assert.deepEqual([half[0], half[1], half[2]], [128, 128, 128],
    'half brightness has to be folded into RGB — there is no channel 7 here');
  const full = S.dmxRender(p, { [p[0].id]: { r: 1, g: 0, b: 0, dim: 1 } });
  assert.deepEqual([full[0], full[1], full[2]], [255, 0, 0]);
  // and nothing may be written past the fixture's three channels
  assert.equal(full[3], 0);
});
test('dmxRender Mystic LED: seven colours, no dimmer, and a clockwise channel that runs backwards', () => {
  const p = S.dmxPatch([{ key: 'adj-mystic-led' }]);
  const at = id => S.dmxRender(p, { [p[0].id]: id });
  // ch1: 128-135 is LED ON. There is no dimmer on this fixture at all.
  const on = at({ r: 1, g: 0, b: 0, dim: 1 });
  assert.ok(on[0] >= 128 && on[0] <= 135, 'LED ON band, got ' + on[0]);
  assert.ok(on[1] <= 41, 'red is the 000-041 band, got ' + on[1]);
  // a genuinely dark intent is the only thing that can turn it off
  assert.equal(at({ r: 1, g: 0, b: 0, dim: 0 })[0], 0);
  // ch2: a colour it cannot make becomes the nearest one it can
  assert.ok(at({ r: 0, g: 0, b: 1, dim: 1 })[1] >= 168, 'blue → the 168-209 band');
  const cyan = at({ r: 0, g: 0.9, b: 1, dim: 1 })[1];
  assert.ok(cyan >= 126 && cyan <= 167, 'teal → GREEN & BLUE, got ' + cyan);
  // brightness must not change WHICH colour is chosen — a dim teal is still teal
  assert.equal(at({ r: 0, g: 0.09, b: 0.1, dim: 1 })[1], cyan, 'a dark teal picks the same lamp colour');
  /* THE RAINBOW INTERLOCK. With channel 3 in 064-127 the fixture stops
     reading channel 2 as a colour and reads it as the rainbow's SPEED, so a
     colour written there would be a speed nobody chose. */
  const rain = at({ r: 1, g: 0, b: 0, dim: 1, rainbow: 1 });
  assert.ok(rain[2] >= 64 && rain[2] <= 127, 'rainbow on, got ' + rain[2]);
  assert.ok(rain[1] > 200, 'and channel 2 is now the speed, not the red we asked for');
  assert.equal(at({ r: 1, g: 0, b: 0, dim: 1, rainbow: 0 })[2], 0, 'rainbow off is below 064');
  /* CHANNEL 4, AND THE TRAP. Clockwise is 001-085 running FAST to SLOW;
     counter-clockwise is 086-170 running SLOW to FAST. The halves run in
     opposite senses, so a naive mapping spins UP when asked to slow down. */
  assert.equal(at({ dim: 1, spin: 0 })[3], 0, 'no spin is 000');
  const cwFast = at({ dim: 1, spin: 1 })[3], cwSlow = at({ dim: 1, spin: 0.1 })[3];
  assert.ok(cwFast >= 1 && cwFast <= 85 && cwSlow >= 1 && cwSlow <= 85, 'both in the clockwise band');
  assert.ok(cwFast < cwSlow, 'faster clockwise is a LOWER value: ' + cwFast + ' vs ' + cwSlow);
  const ccwFast = at({ dim: 1, spin: -1 })[3], ccwSlow = at({ dim: 1, spin: -0.1 })[3];
  assert.ok(ccwFast > ccwSlow, 'counter-clockwise runs the other way: ' + ccwFast + ' vs ' + ccwSlow);
  assert.ok(ccwFast <= 170 && ccwSlow >= 86, 'and stays inside 086-170');
});
test('dmxRender: the strobe cap binds the WIRE, not just the picture', () => {
  /* the peak preset's comment promises "even here the strobe goes through
     the same cap as everywhere else" — with a real interface attached that
     promise has to be true in the bytes, fixture by fixture. The decoded
     rate is the same arithmetic the writer used, so this is the round trip:
     full-throttle strobe intent in, a rate under the cap back out. */
  const rig = S.dmxPatch([
    { id: 'w', key: 'venue-thintri-38', mode: '8ch' },
    { id: 'f', key: 'adj-mystic-led' },
    { id: 'g', key: 'generic-par-7' },
  ]);
  for (const punch of [0, 1]){
    const fr = S.dmxRender(rig, {
      w: { dim: 1, strobe: 1, punch }, f: { dim: 1, strobe: 1, punch }, g: { dim: 1, strobe: 1, punch },
    });
    for (const f of rig){
      const d = S.dmxDecode(f, fr);
      assert.ok(d.strobeHz <= S.DMX_STROBE_MAX_HZ, f.key + ' punch ' + punch + ' at ' + d.strobeHz + ' Hz');
      assert.ok(d.strobeHz > 0, f.key + ' still strobes at all');
    }
  }
  // and the byte itself sits at the bottom of the band, not the top: the cap
  // lives in what is WRITTEN, not in a reading that could drift from it
  const fr = S.dmxRender(rig, { f: { dim: 1, strobe: 1 } });
  const ch1 = fr[rig[1].at - 1];
  assert.ok(ch1 >= 2 && ch1 <= 20, 'Mystic ch1 stays in the slow end, got ' + ch1);
  // a small strobe still registers on a fixture whose band starts above zero
  const soft = S.dmxRender(rig, { w: { dim: 1, strobe: 0.03 } });
  const ch5 = soft[rig[0].at - 1 + 4];
  assert.ok(ch5 > 15, 'ThinTri ch5 clears its no-function band, got ' + ch5);
});
test('dmxStrobeHz: the one number in this program that can hurt somebody', () => {
  /* 3-65 Hz is the photosensitive-seizure band. A rig driven from an
     audio-reactive loop would otherwise sit in the middle of it all night. */
  assert.equal(S.dmxStrobeHz(0), 0, 'no strobe is no strobe');
  assert.ok(S.dmxStrobeHz(1) <= S.DMX_STROBE_MAX_HZ, 'a full-throttle strobe stops at the cap');
  assert.ok(S.DMX_STROBE_MAX_HZ <= 3, 'the cap must stay below the band');
  assert.ok(S.dmxStrobeHz(0.5) > S.dmxStrobeHz(0.1), 'and it is still a control, not a switch');
  // there is no way to ask for more, whatever is handed in
  for (const bad of [99, Infinity, NaN, -5, '10', null])
    assert.ok(S.dmxStrobeHz(bad) <= S.DMX_STROBE_MAX_HZ, 'unsafe from ' + bad);
});
test('dmxDecode: the emulator reads the wire, so it cannot agree with a broken renderer', () => {
  const p = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch' }, { key: 'adj-mystic-led' }]);
  const [wash, fl] = p;
  const frame = S.dmxRender(p, {
    [wash.id]: { r: 1, g: 0.5, b: 0, dim: 0.8 },
    [fl.id]: { r: 0, g: 0, b: 1, dim: 1, spin: -0.5 },
  });
  const a = S.dmxDecode(wash, frame);
  assert.ok(Math.abs(a.r - 1) < 0.01 && Math.abs(a.g - 0.5) < 0.01 && Math.abs(a.b) < 0.01);
  assert.ok(Math.abs(a.dim - 0.8) < 0.01, 'the dimmer comes back off channel 7');
  assert.equal(a.mode, 'dmx', 'and the fixture is reported as console-driven');
  const b = S.dmxDecode(fl, frame);
  assert.deepEqual([b.r, b.g, b.b], [0, 0, 1], 'the colour band decodes back to blue');
  assert.ok(b.spin < 0, 'counter-clockwise comes back negative, got ' + b.spin);
  assert.ok(b.dim > 0);
  // a round trip through the wire must survive: render → decode → same picture
  const spun = S.dmxDecode(fl, S.dmxRender(p, { [fl.id]: { dim: 1, spin: 0.8 } }));
  assert.ok(spun.spin > 0.7 && spun.spin <= 1, 'clockwise 0.8 came back as ' + spun.spin);
  // a networked light has no bytes to read, and says so rather than inventing them
  const hue = S.dmxPatch([{ key: 'philips-hue', net: 'x' }])[0];
  assert.equal(S.dmxDecode(hue, frame), null);
  assert.equal(S.dmxDecode(null, frame), null);
});
test('dmxRenderNet: Hue takes the same intent, and does not pretend to strobe', () => {
  const p = S.dmxPatch([
    { key: 'philips-hue', net: 'bulb-1' },
    { key: 'philips-hue', net: 'bulb-2' },
    { key: 'venue-thintri-38', mode: '8ch' },
  ]);
  const out = S.dmxRenderNet(p, {
    [p[0].id]: { r: 1, g: 0.2, b: 0, dim: 1 },
    [p[1].id]: { r: 0, g: 0, b: 1, dim: 0.5, strobe: 1 },
    [p[2].id]: { r: 1, g: 1, b: 1, dim: 1 },
  });
  assert.equal(out.length, 2, 'only the networked lights come back here');
  assert.equal(out[0].net, 'bulb-1');
  assert.ok(Math.abs(out[0].r - 1) < 1e-9 && Math.abs(out[0].g - 0.2) < 1e-9);
  /* A BULB CANNOT STROBE — around fifty updates a second, with a phosphor and
     a smoothing curve in the way. So a strobe intent becomes a dip in
     brightness: visibly less than the rig is doing, which is honest, rather
     than a bulb pretending and landing a beat late. */
  assert.ok(out[1].dim < 0.5, 'the strobe became a brightness dip, got ' + out[1].dim);
  assert.ok(out[1].dim > 0, 'but not a blackout');
  assert.doesNotThrow(() => S.dmxRenderNet(null, null));
  assert.equal(S.dmxRenderNet(p, {}).length, 2, 'a light nobody addressed still reports itself');
});
test('dmxIntent: what reaches a mains-powered lamp is laundered first', () => {
  const i = S.dmxIntent({ r: 2, g: -1, b: 'x', dim: NaN, strobe: 9, spin: -40, macro: 900 });
  assert.equal(i.r, 1); assert.equal(i.g, 0); assert.equal(i.b, 0);
  assert.equal(i.dim, 1, 'an unreadable dimmer is full, not dark — a dead rig reads as a fault');
  assert.equal(i.strobe, 1); assert.equal(i.spin, -1); assert.equal(i.macro, 255);
  for (const bad of [null, undefined, 0, 'x'])
    assert.doesNotThrow(() => S.dmxIntent(bad), String(bad));
  // and every byte of a frame is written on purpose — no stale values anywhere
  const f = S.dmxRender(S.dmxPatch([{ key: 'adj-mystic-led' }]), {});
  assert.equal(f.length, 512);
  assert.ok(f.every(v => Number.isFinite(v) && v >= 0 && v <= 255));
});

test('dmxUsbProFrame: the message the USB widget reads, byte for byte', () => {
  /* the framing is the whole protocol — the widget's own firmware generates
     the DMX line timing — so every byte here is load-bearing, and a wrong
     one is a rig that sits dark with all its numbers looking right */
  const f = S.dmxRender(S.dmxPatch([{ key: 'adj-mystic-led' }]), {});
  const m = S.dmxUsbProFrame(f);
  assert.equal(m.length, 518, 'SOM + label + two length bytes + start code + 512 channels + EOM');
  assert.equal(m[0], 0x7e, 'start of message');
  assert.equal(m[1], S.DMX_USB_PRO.SEND_DMX, 'label 6: send this DMX now');
  assert.equal(m[2] | (m[3] << 8), 513, 'payload length, LSB first');
  assert.equal(m[4], 0, 'the DMX start code — 0, dimmer data — rides ahead of the channels');
  for (let i = 0; i < 512; i++) assert.equal(m[5 + i], f[i], 'channel ' + (i + 1));
  assert.equal(m[517], 0xe7, 'end of message');
  // a frame nobody has rendered yet is a dark universe, not a throw
  const dark = S.dmxUsbProFrame(null);
  assert.equal(dark.length, 518);
  assert.ok(Array.from(dark.slice(5, 517)).every(v => v === 0), 'all 512 channels at zero');
  // and the wire never sees a value that is not a byte
  const dirty = new Array(512).fill(0);
  dirty[0] = 300; dirty[1] = -4; dirty[2] = NaN;
  const clean = S.dmxUsbProFrame(dirty);
  assert.equal(clean[5], 255); assert.equal(clean[6], 0); assert.equal(clean[7], 0);
});
test('dmxUsbProPacket: the length runs LSB first, whatever the payload', () => {
  const p = S.dmxUsbProPacket(77, new Uint8Array(300));
  assert.equal(p[1], 77, 'the label is whatever was asked for');
  assert.equal(p[2], 300 & 0xff);
  assert.equal(p[3], 1, 'the high byte is the SECOND length byte — the widget reads little-endian');
  assert.equal(p.length, 305);
  assert.equal(p[304], 0xe7);
  const empty = S.dmxUsbProPacket(3, null);
  assert.equal(empty.length, 5, 'no payload is still a whole message');
  assert.equal(empty[2], 0); assert.equal(empty[3], 0);
});

test('dmxAutoAddress: one button answers "what do I dial into each lamp"', () => {
  // the shipped rig IS this packing: 8ch wash at 1, the 4ch flower at 9, 8ch wash at 13
  const rig = [
    { id: 'a', key: 'venue-thintri-38', mode: '8ch', at: 200 },
    { id: 'b', key: 'adj-mystic-led', at: 7 },
    { id: 'c', key: 'venue-thintri-38', mode: '8ch' },
  ];
  const out = S.dmxAutoAddress(rig);
  assert.deepEqual(out.map(r => r.at), [1, 9, 13], 'packed with no gaps, whatever was dialled before');
  assert.equal(rig[0].at, 200, 'the input rig is left alone — a new array comes back');
  // a networked light has no address and never advances the count
  const mixed = S.dmxAutoAddress([
    { id: 'a', key: 'venue-thintri-38', mode: '3ch' },
    { id: 'h', key: 'philips-hue', net: 'b1' },
    { id: 'b', key: 'adj-mystic-led' },
  ]);
  assert.equal(mixed[0].at, 1);
  assert.equal(mixed[1].at, undefined, 'the Hue keeps having no address');
  assert.equal(mixed[2].at, 4, '3ch mode spans three channels, so the flower lands at 4');
  assert.doesNotThrow(() => S.dmxAutoAddress(null));
});
test('dmxOverlaps: two lamps on one channel are named before the room notices', () => {
  /* a shared channel does not look like a fault — each lamp obeys bytes
     meant for the other, and the rig reads as haunted */
  const clash = S.dmxPatch([
    { id: 'a', key: 'venue-thintri-38', mode: '8ch', at: 1 },
    { id: 'b', key: 'adj-mystic-led', at: 8 },            // 8-11 collides with 1-8
    { id: 'c', key: 'venue-thintri-38', mode: '8ch', at: 13 },
  ]);
  assert.deepEqual(S.dmxOverlaps(clash), ['a', 'b'], 'both sides of the collision are named, the bystander is not');
  const clean = S.dmxPatch([
    { id: 'a', key: 'venue-thintri-38', mode: '8ch', at: 1 },
    { id: 'b', key: 'adj-mystic-led', at: 9 },
  ]);
  assert.deepEqual(S.dmxOverlaps(clean), [], 'edge-to-edge is not a collision');
  assert.deepEqual(S.dmxOverlaps(null), []);
});
test('dmxDialPlan: the set-up guide is the patch read aloud, not prose beside it', () => {
  const p = S.dmxPatch([
    { id: 'w', key: 'venue-thintri-38', mode: '8ch', at: 1, name: 'Wash L' },
    { id: 'f', key: 'adj-mystic-led', at: 9, name: 'Moonflower' },
    { id: 'h', key: 'philips-hue', net: 'b1' },
  ]);
  const plan = S.dmxDialPlan(p);
  assert.equal(plan.length, 2, 'a networked light needs no dial');
  assert.equal(plan[0].dial, '001', 'the rear display shows padded digits, so the guide shows the same');
  assert.equal(plan[0].chans, '1–8');
  assert.ok(plan[0].modes > 1, 'the wash has a mode worth mentioning');
  assert.equal(plan[1].dial, '009');
  assert.equal(plan[1].modes, 1, 'the flower has one mode; the guide stays quiet about it');
  assert.ok(plan.every(d => d.fits));
  assert.deepEqual(S.dmxDialPlan(null), []);
});

test('dmxShowIntents: the rig is downstream of the same analysis as the picture', () => {
  const rig = S.dmxPatch([
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'w1' },
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'w2' },
    { key: 'adj-mystic-led', role: 'beam', id: 'fl' },
    { key: 'philips-hue', net: 'b1', role: 'wash', id: 'h1' },
  ]);
  const chord = [{ r: 1, g: 0, b: 0 }, { r: 0, g: 1, b: 0 }, { r: 0, g: 0, b: 1 }];
  const show = { chord, energy: 0.6, beat: 0.5, pulse: 0.5, phrase: 0.1, preset: 'follow' };
  const i = S.dmxShowIntents(show, rig);
  assert.equal(Object.keys(i).length, 4, 'every fixture gets an intent, whatever wire it is on');
  /* TWO WASHES ON THE SAME COLOUR IS A WALL. They take different stops of the
     chord; three on the chord is a room. */
  assert.notDeepEqual([i.w1.r, i.w1.g, i.w1.b], [i.w2.r, i.w2.g, i.w2.b]);
  assert.deepEqual([i.w1.r, i.w1.g, i.w1.b], [1, 0, 0]);
  assert.deepEqual([i.w2.r, i.w2.g, i.w2.b], [0, 1, 0]);
  // the beam takes the accent stop, so the moonflower agrees with the screen
  assert.deepEqual([i.fl.r, i.fl.g, i.fl.b], [0, 0, 1]);
  // a fixture that cannot spin is never told to
  assert.equal(i.w1.spin, 0);
  assert.equal(i.h1.spin, 0, 'a bulb has no motor');
  assert.ok(Math.abs(i.fl.spin) > 0, 'and the one that does, does');
  assert.equal(i.h1.rainbow, 0, 'nor a rainbow it cannot run');
});
test('dmxBeamColors: a ring the moonflower cannot collapse', () => {
  /* the whole point of the ring: every stop lands on a DIFFERENT one of the
     seven states the lamp can be, so a colour change asked for is a colour
     change seen — the failure this replaces was a bluish chord whose stops
     all quantised to BLUE */
  const ring = S.dmxBeamColors([{ r: 0.2, g: 0.3, b: 0.9 }]);
  assert.equal(ring.length, 6);
  const lamp = ring.map(c => S.dmxNearestColor(S.MYSTIC_COLORS, c.r, c.g, c.b).v);
  assert.equal(new Set(lamp).size, 6, 'six ring stops, six different lamp colours: ' + lamp.join(','));
  // anchored: a blue accent starts the ring at blue — the picture's corner of the wheel
  assert.deepEqual(ring[0], { r: 0, g: 0, b: 1 });
  assert.deepEqual(S.dmxBeamColors([{ r: 1, g: 0.1, b: 0 }])[0], { r: 1, g: 0, b: 0 });
  assert.doesNotThrow(() => S.dmxBeamColors(null));
});
test('dmxBeamStep: beats are edges, phrases deal moves, the kick decays like a limb', () => {
  let st = S.dmxBeamState();
  const show = { chord: [{ r: 1, g: 0, b: 0 }], energy: 0.7, preset: 'pulse' };
  const at = (beat, phrase, dt) => S.dmxBeamStep(st, Object.assign({}, show, { beat, phrase }), dt);
  // one hump is one beat, however long it hangs near the top
  st = at(0.9, 0.10, 0.025);
  assert.equal(st.beats, 1); assert.equal(st.kick, 1);
  st = at(0.7, 0.11, 0.025);
  assert.equal(st.beats, 1, 'still the same hump');
  st = at(0.2, 0.12, 0.025);
  st = at(0.9, 0.13, 0.025);
  assert.equal(st.beats, 2, 'a new hump is a new beat');
  st = at(0.9, 0.14, 0.1);
  assert.ok(st.kick < 1 && st.kick > 0, 'the lunge decays, got ' + st.kick);
  // the phrase runs out and wraps: a different move is dealt
  const before = st.move;
  st = at(0.3, 0.9, 0.025);
  assert.equal(st.move, before, 'late in the phrase is not yet a new phrase');
  st = at(0.2, 0.02, 0.025);
  assert.notEqual(st.move, before, 'a fresh phrase, a fresh move');
  assert.ok(S.DMX_BEAM_MOVES.indexOf(st.move) >= 0);
  // a room with no rainbow budget is never dealt the bloom
  let calm = S.dmxBeamState();
  for (let p = 0; p < 12; p++)
    calm = S.dmxBeamStep(calm,
      { chord: [], energy: 0.2, preset: 'follow', beat: 0, phrase: (p % 2) ? 0.9 : 0.05 }, 0.025);
  assert.notEqual(calm.move, 'bloom', 'follow has no rainbow to spend');
  assert.doesNotThrow(() => S.dmxBeamStep(null, null, null));
});
test('dmxBeamPose: every move answers with a real colour, a bounded spin, and taste', () => {
  const chord = [{ r: 0.2, g: 0.3, b: 0.9 }];
  const mk = (move, kick, extra) => S.dmxBeamPose(
    Object.assign(S.dmxBeamState(), { move, kick, beats: 3, phraseN: 1 }),
    Object.assign({ chord, energy: 0.6, beat: 0.5, phrase: 0.2, preset: 'pulse' }, extra));
  for (const move of S.DMX_BEAM_MOVES){
    const p = mk(move, 0.5);
    assert.ok([p.r, p.g, p.b].every(v => v === 0 || v === 1), move + ' colours are ring stops');
    assert.ok(Math.abs(p.spin) <= 1 && p.rainbow >= 0 && p.rainbow <= 1, move + ' stays in range');
  }
  // the stab lunges on the kick and settles after
  assert.ok(Math.abs(mk('stab', 1).spin) > Math.abs(mk('stab', 0).spin) * 2, 'the kick is the move');
  /* bloom must CLEAR THE RENDERER'S GATE (rainbow > 0.5 is what switches
     the fixture's rainbow on) every time it is dealt, else the move renders
     as one static colour for a whole phrase; the preset budget sets speed */
  assert.ok(mk('bloom', 0).rainbow > 0.5, 'bloom always engages the rainbow');
  assert.equal(mk('bloom', 0, { preset: 'spin' }).rainbow, 1, 'and the spin preset opens it fully');
  assert.ok(mk('bloom', 0, { preset: 'peak' }).rainbow > mk('bloom', 0).rainbow, 'budget buys speed');
  // chase in a talking room steps on phrase quarters, not beats
  const calmA = mk('chase', 0, { preset: 'calm', phrase: 0.05 });
  const calmB = mk('chase', 0, { preset: 'calm', phrase: 0.30 });
  assert.notDeepEqual([calmA.r, calmA.g, calmA.b], [calmB.r, calmB.g, calmB.b], 'quarter-phrase steps in calm');
});
test('dmxTrackDesign: every track wears its own show, and the same track always the same one', () => {
  const a = S.dmxTrackDesign({ id: 'mobius-walking', key: '8A', bpm: 124 });
  assert.deepEqual(S.dmxTrackDesign({ id: 'mobius-walking', key: '8A', bpm: 124 }), a,
    'deterministic, the way a timecoded show is repeatable');
  const b = S.dmxTrackDesign({ id: 'breathing', key: '9B', bpm: 128 });
  assert.notDeepEqual(a, b, 'a different track designs a different show');
  for (const d of [a, b]){
    assert.ok(['analogous', 'complement', 'triad'].indexOf(d.scheme) >= 0);
    assert.ok(d.steps.length >= 2 && d.steps.every(i => i >= 0 && i <= 5), 'a real palette of ring steps');
    assert.deepEqual(d.moves.slice().sort(), S.DMX_BEAM_MOVES.slice().sort(),
      'the set list is a permutation — nothing invented, nothing lost');
    assert.ok(d.depth >= 0.4 && d.depth <= 0.7, 'the dip stays in the band that reads as rhythm');
    assert.ok(['mirror', 'unison'].indexOf(d.symmetry) >= 0);
    assert.ok(['counter', 'follow'].indexOf(d.huePolicy) >= 0);
  }
  // a slow minor track never wears the bright triad: mood is load-bearing
  for (let i = 0; i < 24; i++)
    assert.notEqual(S.dmxTrackDesign({ id: 'x' + i, key: '5A', bpm: 100 }).scheme, 'triad', 'seed ' + i);
  assert.equal(S.dmxTrackDesign(null), null, 'no track, no design — the house show still runs');
});
test('dmxBeamColors: a design narrows the wheel to the track palette, still uncollapsible', () => {
  const chord = [{ r: 0.2, g: 0.3, b: 0.9 }];
  const comp = S.dmxBeamColors(chord, { steps: [0, 3] });
  assert.equal(comp.length, 2, 'a complement palette is two colours');
  assert.deepEqual(comp[0], { r: 0, g: 0, b: 1 }, 'still anchored to the accent');
  const lamp = comp.map(c => S.dmxNearestColor(S.MYSTIC_COLORS, c.r, c.g, c.b).v);
  assert.equal(new Set(lamp).size, 2, 'and still distinct on the seven-state lamp');
  const tri = S.dmxBeamColors(chord, { steps: [0, 2, 4] });
  assert.equal(new Set(tri.map(c => S.dmxNearestColor(S.MYSTIC_COLORS, c.r, c.g, c.b).v)).size, 3);
  assert.equal(S.dmxBeamColors(chord).length, 6, 'no design: the whole wheel, exactly as before');
});
test('dmxWashChase: unison breathes together, and the dip is the track’s own depth', () => {
  const st = Object.assign(S.dmxBeamState(), { beats: 1, kick: 1 });
  const pulse = S.DMX_PRESETS.pulse;
  const uni = { symmetry: 'unison', depth: 0.6 };
  assert.equal(S.dmxWashChase(st, pulse, 0, uni), S.dmxWashChase(st, pulse, 1, uni), 'unison: one wall');
  const mir = { symmetry: 'mirror', depth: 0.7 };
  const hi = S.dmxWashChase(st, pulse, 1, mir), lo = S.dmxWashChase(st, pulse, 0, mir);
  assert.equal(hi, 1);
  assert.ok(Math.abs(1 - lo - 0.7) < 1e-9, 'the off-wash dips by the designed depth, got ' + lo);
});
test('dmxShowIntents: the build is anticipation — the walls lean back while the dancer winds up', () => {
  const rig = S.dmxPatch([
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'w' },
    { key: 'adj-mystic-led', role: 'beam', id: 'fl' },
  ]);
  const beam = Object.assign(S.dmxBeamState(), { move: 'whirl' });
  const base = { chord: [{ r: 1, g: 0, b: 0 }], energy: 0.7, beat: 0.6, pulse: 0.6,
    phrase: 0.9, preset: 'pulse', beam };
  const flow = S.dmxShowIntents(Object.assign({}, base, { phase: 'flow' }), rig);
  const build = S.dmxShowIntents(Object.assign({}, base, { phase: 'build' }), rig);
  assert.ok(build.w.dim < flow.w.dim, 'the walls pull back through the build');
  assert.ok(build.w.dim > 0, 'pull back, never out');
  assert.ok(Math.abs(build.fl.spin) > Math.abs(flow.fl.spin), 'while the dancer winds up');
  assert.ok(Math.abs(build.fl.spin) <= 1, 'and never past full');
});
test('dmxShowIntents: a counter design hands the bulbs the complement — surround contrast', () => {
  const rig = S.dmxPatch([
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'w' },
    { key: 'philips-hue', net: 'b1', role: 'wash', id: 'h' },
  ]);
  const design = { huePolicy: 'counter', symmetry: 'mirror', depth: 0.5 };
  const out = S.dmxShowIntents(
    { chord: [{ r: 1, g: 0.1, b: 0.1 }], energy: 0.6, beat: 0.4, phrase: 0.2, preset: 'follow', design }, rig);
  assert.ok(out.h.b > 0.8 && out.h.r < 0.1, 'a red room gets cyan bulbs');
  assert.ok(Math.abs(out.w.r - 1) < 1e-9, 'while the walls keep the chord');
  // a white wash must not turn the bulbs OFF: the complement is lifted off the floor
  const white = S.dmxShowIntents(
    { chord: [{ r: 1, g: 1, b: 1 }], energy: 0.6, beat: 0.4, phrase: 0.2, preset: 'follow', design }, rig);
  assert.ok(Math.max(white.h.r, white.h.g, white.h.b) >= 0.3, 'never simply dark');
  // and a follow policy leaves the bulbs on the chord, exactly as before
  const follow = S.dmxShowIntents(
    { chord: [{ r: 1, g: 0.1, b: 0.1 }], energy: 0.6, beat: 0.4, phrase: 0.2, preset: 'follow',
      design: { huePolicy: 'follow' } }, rig);
  assert.ok(Math.abs(follow.h.r - 1) < 1e-9);
});
test('dmxBeamStep: the drop is an event — one hit on entry, decayed, never re-fired inside it', () => {
  let st = S.dmxBeamState();
  const at = (phase, dt) => S.dmxBeamStep(st,
    { chord: [], energy: 0.8, beat: 0.2, phrase: 0.4, preset: 'peak', phase }, dt);
  st = at('build', 0.025);
  assert.equal(st.hit, 0, 'a build is tension, not the hit');
  st = at('drop', 0.025);
  assert.equal(st.hit, 1, 'entering the drop fires the hit');
  st = at('drop', 0.2);
  assert.ok(st.hit < 1 && st.hit > 0, 'and it decays instead of holding');
  const mid = st.hit;
  st = at('peak', 0.025);
  assert.ok(st.hit <= mid, 'drop into peak is the same climax, not a second hit');
  st = at('flow', 0.5);
  st = at('drop', 0.025);
  assert.equal(st.hit, 1, 'the next drop earns its own hit');
});
test('dmxWashChase: the rhythm section — trade on the off-beats, together on the ONE', () => {
  const st = Object.assign(S.dmxBeamState(), { beats: 1, kick: 1 });
  const pulse = S.DMX_PRESETS.pulse, calm = S.DMX_PRESETS.calm;
  assert.equal(S.dmxWashChase(st, pulse, 1), 1, 'the on-beat wash carries it');
  assert.ok(S.dmxWashChase(st, pulse, 0) < 0.6, 'its partner dips');
  const bar = Object.assign(S.dmxBeamState(), { beats: 4, kick: 1 });
  assert.equal(S.dmxWashChase(bar, pulse, 0), 1);
  assert.equal(S.dmxWashChase(bar, pulse, 1), 1, 'the ONE lands on everybody');
  assert.equal(S.dmxWashChase(st, calm, 0), 1, 'a talking room does not chase');
  assert.equal(S.dmxWashChase(null, pulse, 0), 1, 'no clock, no chase');
});
test('dmxShowIntents: the show is called like a pro — trading washes, the ONE, the drop hit', () => {
  const rig = S.dmxPatch([
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'wl' },
    { key: 'adj-mystic-led', role: 'beam', id: 'fl' },
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'wr', at: 13 },
  ]);
  const chord = [{ r: 1, g: 0, b: 0 }, { r: 0, g: 1, b: 0 }, { r: 0, g: 0, b: 1 }];
  const mkState = o => Object.assign(S.dmxBeamState(), o);
  const show = { chord, energy: 0.8, beat: 0.9, pulse: 0.9, phrase: 0.3, preset: 'pulse' };
  // off-beat: the washes trade — one carries the beat, the other dips
  const off = S.dmxShowIntents(Object.assign({}, show, { beam: mkState({ beats: 1, kick: 1 }) }), rig);
  assert.ok(Math.abs(off.wl.dim - off.wr.dim) > 0.15, 'ping-pong: ' + off.wl.dim + ' vs ' + off.wr.dim);
  // the ONE: everybody hits together
  const one = S.dmxShowIntents(Object.assign({}, show, { beam: mkState({ beats: 4, kick: 1 }) }), rig);
  assert.ok(Math.abs(one.wl.dim - one.wr.dim) < 0.01, 'bar downbeat lands on both');
  // the drop hit: washes slam white and full, the beam gets its capped accent
  const drop = S.dmxShowIntents(
    Object.assign({}, show, { preset: 'peak', beam: mkState({ hit: 1 }) }), rig);
  assert.deepEqual([drop.wl.r, drop.wl.g, drop.wl.b], [1, 1, 1], 'white on the drop');
  assert.equal(drop.wl.dim, 1, 'and at full');
  assert.ok(drop.fl.strobe > 0.5, 'the beam bursts (the renderer still caps the rate)');
  assert.equal(drop.fl.punch, 1, 'and takes the random band');
  // a hand-pinned calm room is never slammed: the hit bows to the preset
  const calm = S.dmxShowIntents(
    Object.assign({}, show, { preset: 'calm', beam: mkState({ hit: 1 }) }), rig);
  assert.ok(calm.wl.g < 0.5, 'calm stays on the chord, not slammed white');
  assert.ok(calm.wl.dim < 1, 'and nothing forces its dimmer to full');
});
test('dmxShowIntents: with the choreographer riding along, the beam takes its pose', () => {
  const rig = S.dmxPatch([
    { key: 'adj-mystic-led', role: 'beam', id: 'fl' },
    { key: 'venue-thintri-38', mode: '8ch', role: 'wash', id: 'w' },
  ]);
  /* THE REGRESSION THIS ENGINE EXISTS FOR: a bluish chord whose stops all
     quantise to the same lamp colour, so the old chord-walk was invisible
     on the fixture however faithfully it walked */
  const chord = [{ r: 0.2, g: 0.25, b: 0.8 }, { r: 0.25, g: 0.2, b: 0.85 }, { r: 0.2, g: 0.3, b: 0.9 }];
  const collapsed = chord.map(c => S.dmxNearestColor(S.MYSTIC_COLORS, c.r, c.g, c.b).v);
  assert.equal(new Set(collapsed).size, 1, 'this chord defeats the walk: ' + collapsed.join(','));
  const show = { chord, energy: 0.7, beat: 0.6, pulse: 0.6, phrase: 0.2, preset: 'pulse' };
  const beamA = Object.assign(S.dmxBeamState(), { move: 'chase', beats: 0 });
  const beamB = Object.assign(S.dmxBeamState(), { move: 'chase', beats: 1 });
  const a = S.dmxShowIntents(Object.assign({}, show, { beam: beamA }), rig).fl;
  const b = S.dmxShowIntents(Object.assign({}, show, { beam: beamB }), rig).fl;
  const va = S.dmxNearestColor(S.MYSTIC_COLORS, a.r, a.g, a.b).v;
  const vb = S.dmxNearestColor(S.MYSTIC_COLORS, b.r, b.g, b.b).v;
  assert.notEqual(va, vb, 'beat to beat, the lamp visibly changes: ' + va + ' vs ' + vb);
  // the wash is untouched by the choreographer — the wall is not a dancer
  const w = S.dmxShowIntents(Object.assign({}, show, { beam: beamA }), rig).w;
  assert.deepEqual([w.r, w.g, w.b], [chord[0].r, chord[0].g, chord[0].b]);
  // and the old walk still answers when no state rides in
  const bare = S.dmxShowIntents(show, rig).fl;
  assert.ok([bare.r, bare.g, bare.b].some(v => v > 0));
});
test('dmxShowIntents: the moonflower dances — spin surges on the kick, colour walks the chord', () => {
  const rig = S.dmxPatch([{ key: 'adj-mystic-led', role: 'beam', id: 'fl' }]);
  const chord = [{ r: 1, g: 0, b: 0 }, { r: 0, g: 1, b: 0 }, { r: 0, g: 0, b: 1 }];
  const base = { chord, energy: 0.6, phrase: 0.1, preset: 'follow' };
  /* the motor is the one voice this fixture has for the beat — no dimmer to
     pulse — so the same energy with a harder kick must mean faster beams */
  const still = S.dmxShowIntents(Object.assign({}, base, { beat: 0, pulse: 0 }), rig);
  const kick = S.dmxShowIntents(Object.assign({}, base, { beat: 1, pulse: 1 }), rig);
  assert.ok(Math.abs(kick.fl.spin) > Math.abs(still.fl.spin), 'the beat reaches the beams');
  assert.ok(Math.abs(kick.fl.spin) <= 1, 'and never past full');
  /* the colour walks the chord at quarter-phrase boundaries, starting from
     the accent stop — movement on the music's own seams, in colours the
     picture is already made of */
  const stops = [0, 0.3, 0.55].map(phrase =>
    S.dmxShowIntents(Object.assign({}, base, { beat: 0.5, pulse: 0.5, phrase }), rig).fl);
  assert.deepEqual([stops[0].r, stops[0].g, stops[0].b], [0, 0, 1], 'home is still the accent stop');
  const keys = stops.map(s => [s.r, s.g, s.b].join(','));
  assert.equal(new Set(keys).size, 3, 'three quarter-phrases, three colours: ' + keys.join(' | '));
  // and a one-note chord cannot be walked off the end of
  const solo = S.dmxShowIntents(
    { chord: [{ r: 1, g: 0, b: 0 }], energy: 0.5, phrase: 0.9, preset: 'follow' }, rig);
  assert.deepEqual([solo.fl.r, solo.fl.g, solo.fl.b], [1, 0, 0]);
});
test('dmxShowIntents: brightness has a floor, because a rig that blinks out reads as broken', () => {
  const rig = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch', id: 'w' }]);
  const chord = [{ r: 1, g: 1, b: 1 }];
  const dead = S.dmxShowIntents({ chord, energy: 0, beat: 0, pulse: 0, preset: 'follow' }, rig);
  assert.ok(dead.w.dim > 0.05, 'silence is dim, not dark: ' + dead.w.dim);
  const loud = S.dmxShowIntents({ chord, energy: 1, beat: 1, pulse: 1, preset: 'follow' }, rig);
  assert.ok(loud.w.dim > dead.w.dim, 'and it still has somewhere to go');
  assert.ok(loud.w.dim <= 1);
  // the master is a real master
  const half = S.dmxShowIntents({ chord, energy: 1, beat: 1, preset: 'follow', master: 0.5 }, rig);
  assert.ok(Math.abs(half.w.dim - loud.w.dim * 0.5) < 1e-6);
  /* BLACKOUT MEANS BLACKOUT — a beat may not sneak past it, which is the
     whole reason anybody reaches for the button. */
  const off = S.dmxShowIntents({ chord, energy: 1, beat: 1, pulse: 1, preset: 'black' }, rig);
  assert.deepEqual([off.w.dim, off.w.strobe, off.w.r], [0, 0, 0]);
  const master0 = S.dmxShowIntents({ chord, energy: 1, beat: 1, preset: 'peak', master: 0 }, rig);
  assert.equal(master0.w.dim, 0);
});
test('dmxSegueTint: the lamps ride the lit transitions, and only those', () => {
  for (const unlit of ['luma', 'scatter', 'defocus', 'aerial', 'refract', 'prism', 'fold', 'dissolve', 'nonsense', null])
    assert.equal(S.dmxSegueTint(unlit, 0.5), null, `${unlit} must leave the rig to the music`);
  for (const lit of ['cherenkov', 'aurora', 'ember', 'sprite', 'eclipse']){
    assert.equal(S.dmxSegueTint(lit, 0), null, `${lit} begins as a no-op`);
    assert.equal(S.dmxSegueTint(lit, 1), null, '…and ends as one');
    const mid = S.dmxSegueTint(lit, 0.5);
    assert.ok(mid && mid.mix > 0 && mid.mix <= 1, `${lit} has a real colour pull at its peak`);
  }
  const ch = S.dmxSegueTint('cherenkov', 0.5);
  assert.ok(ch.b > ch.r && ch.b > ch.g, 'the reactor wall pulls the rig blue');
  const em = S.dmxSegueTint('ember', 0.5);
  assert.ok(em.r > em.b, 'the burn pulls it warm');
  const sp = S.dmxSegueTint('sprite', 0.5);
  assert.ok(sp.r > sp.b && sp.lift > 0, 'the sprite is carmine, and lifts the room');
  const ec = S.dmxSegueTint('eclipse', 0.5);
  assert.ok(ec.lift < -0.7, 'totality genuinely darkens the rig');
  const auE = S.dmxSegueTint('aurora', 0.15), auL = S.dmxSegueTint('aurora', 0.85);
  assert.ok(auE.g > auE.b && auL.b > auL.g, 'the curtain walks green to violet');
});
test('dmxShowIntents: a segue tints the wash, never the strobe, never an off rig', () => {
  const rig = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch', id: 'w' }]);
  const chord = [{ r: 1, g: 0.7, b: 0.1 }];
  const base = { chord, energy: 0.6, beat: 0.4, pulse: 0, phrase: 0.2, preset: 'follow' };
  const plain = S.dmxShowIntents(base, rig).w;
  const lit = S.dmxShowIntents({ ...base, segue: { kind: 'cherenkov', t: 0.5 } }, rig).w;
  assert.ok(lit.b > plain.b, 'the wash leans toward the wall');
  assert.equal(lit.strobe, plain.strobe, 'the strobe channel is untouchable');
  const dark = S.dmxShowIntents({ ...base, segue: { kind: 'eclipse', t: 0.5 } }, rig).w;
  assert.ok(dark.dim < plain.dim * 0.4, 'totality reaches the actual room');
  const ends = S.dmxShowIntents({ ...base, segue: { kind: 'cherenkov', t: 1 } }, rig).w;
  assert.deepEqual([ends.r, ends.g, ends.b, ends.dim], [plain.r, plain.g, plain.b, plain.dim],
    'a finished transition leaves no residue on the lamps');
  const off = S.dmxShowIntents({ ...base, preset: 'black', segue: { kind: 'sprite', t: 0.5 } }, rig).w;
  assert.deepEqual([off.dim, off.r], [0, 0], 'a blackout is not woken by a transition');
});
test('dmxShowIntents: the strobe is earned, and calm has none to earn', () => {
  const rig = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch', id: 'w' }]);
  const chord = [{ r: 1, g: 1, b: 1 }];
  const at = (preset, energy) => S.dmxShowIntents({ chord, energy, beat: 1, preset }, rig).w.strobe;
  assert.equal(at('peak', 0.5), 0, 'below the threshold even peak does not strobe');
  assert.ok(at('peak', 1) > 0.5, 'and at full energy it does');
  assert.ok(at('peak', 0.8) < at('peak', 1), 'it ramps rather than switching');
  /* CALM IS STRUCTURALLY INCAPABLE OF STROBING — not merely set low. A room
     people are talking in must not be one energy spike away from a flash. */
  for (const e of [0, 0.5, 0.9, 1]) assert.equal(at('calm', e), 0, 'calm at energy ' + e);
  assert.equal(S.DMX_PRESETS.calm.strobe, 0);
});
test('dmxAutoPreset: the rig lifts into a chorus and settles into a breakdown by itself', () => {
  assert.equal(S.dmxAutoPreset({ phase: 'drop', energy: 0.9 }), 'peak');
  assert.equal(S.dmxAutoPreset({ phase: 'drop', energy: 0.3 }), 'pulse', 'a quiet drop is not a peak');
  assert.equal(S.dmxAutoPreset({ phase: 'lift', energy: 0.5 }), 'pulse');
  assert.equal(S.dmxAutoPreset({ phase: 'breakdown', energy: 0.9 }), 'calm');
  assert.equal(S.dmxAutoPreset({ phase: 'flow', energy: 0.5 }), 'follow');
  assert.equal(S.dmxAutoPreset({ phase: 'flow', energy: 0.05 }), 'calm');
  // nothing playing is not a light show
  assert.equal(S.dmxAutoPreset({ phase: 'drop', energy: 1, silent: true }), 'calm');
  for (const bad of [null, undefined, {}, { phase: 42 }])
    assert.ok(S.DMX_PRESETS[S.dmxAutoPreset(bad)], 'auto must always name a real preset: ' + JSON.stringify(bad));
  // and every preset in the order actually exists, both ways
  for (const k of S.DMX_PRESET_ORDER) assert.ok(S.DMX_PRESETS[k], k);
  assert.equal(S.DMX_PRESET_ORDER.length, Object.keys(S.DMX_PRESETS).length);
});
test('dmxShowIntents: nothing it produces can reach a lamp unlaundered', () => {
  const rig = S.dmxPatch([{ key: 'adj-mystic-led', id: 'fl', role: 'beam' }]);
  for (const bad of [null, undefined, {}, { chord: null, energy: NaN, beat: 'x', preset: 'nope' }]){
    const out = S.dmxShowIntents(bad, rig);
    const i = out.fl;
    assert.ok(i, 'a fixture always gets something: ' + JSON.stringify(bad));
    for (const k of ['r', 'g', 'b', 'dim', 'strobe', 'spin'])
      assert.ok(Number.isFinite(i[k]), k + ' was not finite from ' + JSON.stringify(bad));
    // and the frame it renders to is still 512 clean bytes
    const f = S.dmxRender(rig, out);
    assert.ok(f.every(v => v >= 0 && v <= 255));
  }
  assert.doesNotThrow(() => S.dmxShowIntents({ chord: [{ r: 1, g: 1, b: 1 }] }, null));
});

test('DMX_FIXTURES vars: the labels name the channel they are actually on', () => {
  /* A LABEL THAT NAMES THE WRONG CHANNEL IS WORSE THAN NO LABEL — it is a
     console confidently reporting a fixture doing something it is not. This
     shipped wrong once and was caught by looking at the emulator, which is
     exactly the kind of thing a test should be catching instead. Pinned here
     against the charts in the two manuals. */
  assert.deepEqual(S.DMX_FIXTURES['adj-mystic-led'].vars,
    ['strobe', 'color', 'rainbow', 'spin'],
    'Mystic: ch1 is off/strobe and ch2 is the colour, not the other way round');
  assert.deepEqual(S.DMX_FIXTURES['venue-thintri-38'].vars,
    ['red', 'green', 'blue', 'macro', 'strobe', 'mode', 'dimmer', 'dimmerCurve'],
    'ThinTri: ch4 is the macro and ch7 is the dimmer');
  // and every profile labels exactly as many channels as its widest mode has
  for (const key of Object.keys(S.DMX_FIXTURES)){
    const p = S.DMX_FIXTURES[key];
    const widest = Math.max(...Object.keys(p.modes).map(m => p.modes[m]));
    if (p.wire === 'net') continue;
    assert.equal(p.vars.length, widest, key + ' labels ' + p.vars.length + ' of ' + widest + ' channels');
  }
  /* The labels are load-bearing: the emulator reads them positionally, so a
     renderer and a label that disagree is a display that lies. Check one
     against the bytes the renderer actually writes. */
  const rig = S.dmxPatch([{ key: 'venue-thintri-38', mode: '8ch', id: 'w' }]);
  const f = S.dmxRender(rig, { w: { r: 0, g: 0, b: 0, dim: 1, strobe: 1 } });
  const v = S.DMX_FIXTURES['venue-thintri-38'].vars;
  assert.equal(f[v.indexOf('dimmer')], 255, 'the channel labelled dimmer is the one carrying the dimmer');
  assert.ok(f[v.indexOf('strobe')] > 15, 'and the one labelled strobe carries the strobe (inside the cap’s slice of the band)');
  assert.equal(f[v.indexOf('macro')], 0, 'and the macro is the one held at zero');
});

test('the generic library: a fixture nobody wrote a profile for still lights up right', () => {
  /* The two named fixtures are the samples, not the scope. Everything else is
     described only by the ORDER of its channels — and that order is enough,
     because there is nothing else to get wrong. */
  for (const key of ['generic-rgb-3', 'generic-rgbd-4', 'generic-par-7',
    'generic-rgbwauv-10', 'generic-dimmer-1', 'generic-movinghead-11']){
    const p = S.dmxProfile(key);
    assert.ok(p, key + ' is in the library');
    const widest = Math.max(...Object.keys(p.modes).map(m => p.modes[m]));
    assert.equal(p.vars.length, widest, key + ' labels every channel it claims');
  }
  // a 7-channel PAR puts the dimmer FIRST, which is the convention, and the
  // renderer must follow the labels rather than assume RGB starts at 1
  const par = S.dmxPatch([{ key: 'generic-par-7', id: 'p' }]);
  const f = S.dmxRender(par, { p: { r: 1, g: 0.5, b: 0, dim: 0.8 } });
  assert.equal(f[0], 204, 'ch1 is the dimmer');
  assert.deepEqual([f[1], f[2], f[3]], [255, 128, 0], 'and the colour follows it');
  // the white emitter is the grey the colour already contains
  const wh = S.dmxRender(par, { p: { r: 1, g: 1, b: 1, dim: 1 } });
  assert.equal(wh[4], 255, 'a true white lights the white emitter');
  const red = S.dmxRender(par, { p: { r: 1, g: 0, b: 0, dim: 1 } });
  assert.equal(red[4], 0, 'a saturated red does not');
  /* NO DIMMER CHANNEL MEANS THE DIMMER LIVES IN THE COLOUR — the same rule
     the 3-channel ThinTri follows, applied from the labels alone. */
  const bare = S.dmxPatch([{ key: 'generic-rgb-3', id: 'b' }]);
  const half = S.dmxRender(bare, { b: { r: 1, g: 1, b: 1, dim: 0.5 } });
  assert.deepEqual([half[0], half[1], half[2]], [128, 128, 128]);
  // UV is an effect, not a colour component: a warm chord may never light it
  const uv = S.dmxPatch([{ key: 'generic-rgbwauv-10', id: 'u' }]);
  const warm = S.dmxRender(uv, { u: { r: 1, g: 0.6, b: 0.1, dim: 1 } });
  const vars = S.dmxProfile('generic-rgbwauv-10').vars;
  assert.equal(warm[vars.indexOf('uv')], 0, 'UV stays dark on a warm wash');
  assert.ok(warm[vars.indexOf('amber')] > 0, 'but amber carries the warmth');
  // a one-channel dimmer has no colour and must not be written past its span
  const dim = S.dmxPatch([{ key: 'generic-dimmer-1', id: 'd' }]);
  const lit = S.dmxRender(dim, { d: { r: 1, g: 0, b: 0, dim: 0.6 } });
  assert.equal(lit[0], 153);
  assert.equal(lit[1], 0, 'nothing may be written past channel 1');
  // and it decodes back as its own white rather than as black
  const back = S.dmxDecode(dim[0], lit);
  assert.ok(back.r === 1 && back.g === 1 && back.b === 1, 'a colourless lamp reads as white');
  assert.ok(Math.abs(back.dim - 0.6) < 0.01);
});
test('the generic renderer decodes back to what it was asked for', () => {
  for (const key of ['generic-rgbd-4', 'generic-par-7', 'generic-rgbwauv-10']){
    const p = S.dmxPatch([{ key, id: 'x' }]);
    const want = { r: 0.2, g: 0.8, b: 0.4, dim: 0.75 };
    const d = S.dmxDecode(p[0], S.dmxRender(p, { x: want }));
    for (const k of ['r', 'g', 'b', 'dim'])
      assert.ok(Math.abs(d[k] - want[k]) < 0.02, key + ' ' + k + ': ' + d[k] + ' vs ' + want[k]);
  }
  // a moving head is aimed by the same signed spin the moonflower turns on
  const mh = S.dmxPatch([{ key: 'generic-movinghead-11', id: 'm' }]);
  const vars = S.dmxProfile('generic-movinghead-11').vars;
  const l = S.dmxRender(mh, { m: { r: 1, g: 1, b: 1, dim: 1, spin: -1 } });
  const r = S.dmxRender(mh, { m: { r: 1, g: 1, b: 1, dim: 1, spin: 1 } });
  assert.ok(l[vars.indexOf('pan')] < r[vars.indexOf('pan')], 'pan follows the sign of the spin');
});

test('hueIsLan: the fence around a native fetch, which has no CORS to fall back on', () => {
  /* THE MOST SECURITY-SENSITIVE FUNCTION IN THE PLAYER. A native fetch is a
     hole straight through the browser's model — no CORS, no mixed content
     rule, no same-origin policy — so this predicate is the only thing between
     it and a confused deputy that any script on the page could aim anywhere. */
  for (const h of ['192.168.1.2', '10.0.0.1', '172.16.0.1', '172.31.255.255',
    '127.0.0.1', '169.254.1.1', 'philips-hue.local', 'Philips-Hue.LOCAL'])
    assert.ok(S.hueIsLan(h), h + ' is on my own network');
  // the public internet, and the near-misses at the edges of each range
  for (const h of ['8.8.8.8', 'example.com', 'hue.example.com', '172.32.0.1',
    '172.15.0.1', '192.169.1.1', '11.0.0.1', '126.0.0.1', '169.255.1.1'])
    assert.ok(!S.hueIsLan(h), h + ' must be refused');
  /* AND THE SHAPES THAT EXIST TO FOOL A CARELESS PARSER. URL() would accept
     the first of these and report a host of evil.com; a resolver reading
     octal makes the second loopback while a decimal parser does not. Both are
     refused rather than interpreted, because a disagreement about what an
     address MEANS is exactly the bug this prevents. */
  for (const h of ['127.0.0.1@evil.com', 'evil.com/192.168.1.1', '0177.0.0.1',
    '010.0.0.1', '192.168.1.256', '192.168.1', '192.168.1.1.1', 'a.b.local',
    '-bad.local', '.local', '192.168.1.2:80', '[::1]', 'localhost'])
    assert.ok(!S.hueIsLan(h), h + ' must be refused');
  for (const bad of [null, undefined, 0, {}, [], ' ', 'x'.repeat(400)])
    assert.equal(S.hueIsLan(bad), false, JSON.stringify(bad));
});
test('hueXY: a bulb has no red, green and blue to set', () => {
  // the primaries land in the right corners of the diagram
  const r = S.hueXY(1, 0, 0), g = S.hueXY(0, 1, 0), b = S.hueXY(0, 0, 1);
  assert.ok(r.x > 0.6 && r.y < 0.35, 'red: ' + JSON.stringify(r));
  assert.ok(g.y > 0.6 && g.x < 0.25, 'green: ' + JSON.stringify(g));
  assert.ok(b.x < 0.2 && b.y < 0.15, 'blue: ' + JSON.stringify(b));
  // white sits on the D65 point, which is what "white" means to a bridge
  const w = S.hueXY(1, 1, 1);
  assert.ok(Math.abs(w.x - 0.3227) < 0.02 && Math.abs(w.y - 0.329) < 0.02, JSON.stringify(w));
  /* GAMMA IS EXPANDED FIRST. Skipping it is why so much Hue code renders
     midtones washed out: half-way up the sRGB ramp is nowhere near half the
     light. A 50% grey must carry markedly less luminance than a white. */
  const mid = S.hueXY(0.5, 0.5, 0.5);
  assert.ok(mid.Y < 0.25, 'a 50% grey is ' + mid.Y.toFixed(3) + ' of the light, not half');
  assert.ok(Math.abs(mid.x - w.x) < 1e-6, 'but it is the same colour as white');
  // black has no chromaticity at all, and must not produce a NaN
  const k = S.hueXY(0, 0, 0);
  assert.ok(Number.isFinite(k.x) && Number.isFinite(k.y) && k.Y === 0);
  for (const bad of [[NaN, 1, 1], [2, -1, 'x'], [null, undefined, {}]]){
    const o = S.hueXY(bad[0], bad[1], bad[2]);
    assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y), JSON.stringify(bad));
  }
});
test('hueUpdate: a bridge is not a DMX wire, and a queue is worse than a dropped frame', () => {
  const first = S.hueUpdate({ r: 1, g: 0, b: 0, dim: 1 }, null, 1000);
  assert.ok(first && first.body.on.on === true);
  assert.ok(first.body.color.xy.x > 0.6, 'red went out as a chromaticity');
  assert.equal(first.body.dimming.brightness, 100);
  assert.equal(first.body.dynamics.duration, S.HUE_MIN_MS, 'the bridge fades over exactly the gap to the next command');
  /* TEN A SECOND, PER LIGHT. Past that the bridge queues, and a queue means
     the bulbs fall progressively further behind the music until they are
     answering a beat that has already gone. */
  assert.equal(S.hueUpdate({ r: 0, g: 1, b: 0, dim: 1 }, first.state, 1050), null,
    'a frame inside the window is dropped, however different it is');
  const later = S.hueUpdate({ r: 0, g: 1, b: 0, dim: 1 }, first.state, 1200);
  assert.ok(later && later.body.color.xy.y > 0.6, 'and taken once the window has passed');
  // a frame that says nothing new costs a request a real change needed
  assert.equal(S.hueUpdate({ r: 1, g: 0, b: 0, dim: 1 }, first.state, 5000), null,
    'an unchanged frame is not sent at all');
  const nudge = S.hueUpdate({ r: 1, g: 0, b: 0, dim: 0.999 }, first.state, 5000);
  assert.equal(nudge, null, 'nor is a change no bulb could render');
  assert.ok(S.hueUpdate({ r: 1, g: 0, b: 0, dim: 0.5 }, first.state, 5000), 'a real change is');
  // dark is off, and an off command carries no colour to argue with
  const off = S.hueUpdate({ r: 1, g: 1, b: 1, dim: 0 }, first.state, 9000);
  assert.ok(off && off.body.on.on === false);
  assert.equal(off.body.color, undefined);
  assert.doesNotThrow(() => S.hueUpdate(null, null, NaN));
});
test('huePairResult: "not pressed yet" is the normal case, not a failure', () => {
  /* A bridge answers a pairing request with 200 whether it worked or not.
     Error 101 is what the operator sees for the ten seconds before they walk
     over and press the button, so it has to read as an instruction. */
  const wait = S.huePairResult([{ error: { type: 101, description: 'link button not pressed' } }]);
  assert.equal(wait.ok, false);
  assert.equal(wait.press, true, 'and it asks for the button rather than reporting a fault');
  const good = S.huePairResult([{ success: { username: 'abc123', clientkey: 'DEADBEEF' } }]);
  assert.deepEqual([good.ok, good.user, good.key], [true, 'abc123', 'DEADBEEF']);
  // the clientkey is what an Entertainment stream will need later; a bridge
  // that does not send one is still a successful pairing
  const old = S.huePairResult([{ success: { username: 'u' } }]);
  assert.equal(old.ok, true); assert.equal(old.key, '');
  const refused = S.huePairResult([{ error: { type: 7, description: 'invalid value' } }]);
  assert.equal(refused.ok, false); assert.equal(refused.press, false);
  for (const bad of [null, undefined, [], {}, 'x'])
    assert.equal(S.huePairResult(bad).ok, false, JSON.stringify(bad));
});
test('hueLights: the light list, flattened to what a patch needs', () => {
  const out = S.hueLights({ data: [
    { id: 'b', metadata: { name: 'Kitchen' }, dimming: {}, color: {} },
    { id: 'a', metadata: { name: 'Attic' }, dimming: {} },
    { id: 'c' },
    null,
  ] });
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(l => l.name), ['Attic', 'Hue light', 'Kitchen'], 'sorted by name');
  assert.equal(out.find(l => l.id === 'b').color, true);
  assert.equal(out.find(l => l.id === 'a').color, false, 'a white-only bulb says so');
  for (const bad of [null, undefined, {}, { data: null }])
    assert.deepEqual(S.hueLights(bad), [], JSON.stringify(bad));
});

test('stageApplyFeat: a screen renders what it is told, so what it is told is fenced', () => {
  const dst = { bass: 0.5, energy: 0.5, beat: 0.5, extra: 'keep me' };
  S.stageApplyFeat(dst, { bass: 0.9, energy: 'not a number', nope: 1 });
  assert.equal(dst.bass, 0.9, 'a number lands');
  assert.equal(dst.energy, 0.5, 'a non-number leaves the last good value alone');
  assert.equal(dst.beat, 0.5, 'a field the packet omits is not zeroed — a half packet is not silence');
  assert.equal(dst.nope, undefined, 'nothing outside the list crosses');
  assert.equal(dst.extra, 'keep me');
  S.stageApplyFeat(dst, { bass: NaN });
  assert.equal(dst.bass, 0.9, 'NaN is not a reading');
  assert.doesNotThrow(() => S.stageApplyFeat(dst, null));
  assert.doesNotThrow(() => S.stageApplyFeat(null, { bass: 1 }));
  assert.ok(S.STAGE_FIELDS.includes('beat') && S.STAGE_FIELDS.includes('bpm'));
});
test('stageOffset: two machines, two clocks, one smoothed difference', () => {
  // the first reading is taken as-is — there is nothing to smooth against
  assert.equal(S.stageOffset(NaN, 1000, 1040), 40);
  // a late packet moves the estimate a little, not a lot
  const a = S.stageOffset(40, 1000, 1140);
  assert.ok(a > 40 && a < 50, 'one slow packet is a fact about the network, got ' + a);
  // a real clock change is taken at once rather than crawled toward for a minute
  assert.equal(S.stageOffset(40, 1000, 3000), 2000);
  // garbage never becomes the clock
  assert.equal(S.stageOffset(40, NaN, 1000), 40);
  assert.equal(S.stageOffset(NaN, NaN, NaN), 0);
  assert.ok(Math.abs(S.stageOffset(NaN, 0, 1e12)) <= 5000, 'and a wild one is clamped');
});
test('updateOfferKey: two claims about the same swap are one string', () => {
  assert.equal(S.updateOfferKey('aaaa', 'bbbb'), S.updateOfferKey('aaaa', 'bbbb'));
  assert.notEqual(S.updateOfferKey('aaaa', 'bbbb'), S.updateOfferKey('bbbb', 'bbbb'),
    'the build we are running is half of what an offer IS');
  assert.notEqual(S.updateOfferKey('aaaa', 'bbbb'), S.updateOfferKey('aaaa', 'cccc'));
  assert.equal(typeof S.updateOfferKey(null, undefined), 'string', 'garbage still keys');
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
  const base = { ready: true, requested: false, armed: '', playing: false, quietFor: 9e9,
    show: false, snoozedUntil: 0, now: 1000 };
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

test('seamPhaseErr: one pair of reads → the wrapped beat-phase error, B-behind positive', () => {
  const plan = { bpmA: 120, bpmB: 120, startA: 100, startB: 8 };
  assert.ok(Math.abs(S.seamPhaseErr(101, 9, plan)) < 1e-9, 'in phase');
  assert.ok(Math.abs(S.seamPhaseErr(101, 8.99, plan) - 0.01) < 1e-9, 'B 10 ms behind → +10 ms');
  assert.ok(Math.abs(S.seamPhaseErr(101, 9.02, plan) + 0.02) < 1e-9, 'B 20 ms ahead → −20 ms');
  // wrapped to the nearest beat: 0.49 s behind at 120 bpm is 10 ms AHEAD of the next beat
  assert.ok(Math.abs(S.seamPhaseErr(101, 8.51, plan) + 0.01) < 1e-9, 'wraps to the nearest beat');
  // different tempos: each deck is phased against its OWN grid
  const p2 = { bpmA: 124, bpmB: 126, startA: 50, startB: 4 };
  assert.ok(Math.abs(S.seamPhaseErr(50 + 3 * 60 / 124, 4 + 3 * 60 / 126, p2)) < 1e-9, 'beat 3 on both grids');
  assert.equal(S.seamPhaseErr(NaN, 1, plan), null);
  assert.equal(S.seamPhaseErr(1, 1, { bpmA: 0, bpmB: 120 }), null);
});

test('seamTake: seek far misses, pull near ones, latch when done or once B can be heard', () => {
  assert.equal(S.seamTake(0.1, 0, 0).act, 'seek', 'a 100 ms miss while unheard → one seek');
  assert.equal(S.seamTake(0.1, 0, 3).act, 'pull', 'out of seeks → it still pulls, never gives up');
  const near = S.seamTake(0.02, 0, 0, { tau: 0.25 });
  assert.equal(near.act, 'pull');
  assert.ok(Math.abs(near.pull - 0.08) < 1e-9, '20 ms over a quarter second → +8 % (B behind → faster)');
  assert.ok(S.seamTake(-0.02, 0, 0, { tau: 0.25 }).pull < 0, 'B ahead → slower');
  assert.ok(Math.abs(S.seamTake(0.035, 0, 0, { tau: 0.1 }).pull) <= 0.15 + 1e-12, 'the pull is capped');
  assert.equal(S.seamTake(0.001, 0, 0).act, 'latch', 'inside a millisecond and a half → done');
  assert.equal(S.seamTake(0.03, 0.5, 0).act, 'latch', 'B audible → never seek or pull; the servo takes over');
  assert.equal(S.seamTake(NaN, 0, 0).act, 'latch');
});

test('seamNudge: nothing for a held lock, a bounded push for a knocked one', () => {
  assert.equal(S.seamNudge(0.004, 124), 0, 'a few ms is the fine servo\'s');
  const spb = 60 / 124;
  assert.ok(Math.abs(S.seamNudge(0.02, 124) - 0.02 / (2 * spb)) < 1e-12, 'half the error per beat');
  assert.ok(S.seamNudge(-0.02, 124) < 0, 'B ahead → slower');
  assert.equal(S.seamNudge(0.2, 124), 0.03, 'capped at 3 % — a push, not a pitch bend');
  assert.equal(S.seamNudge(-0.2, 124), -0.03);
  assert.equal(S.seamNudge(0.02, 0), 0, 'no tempo, no nudge');
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
  assert.ok(Math.abs(S.seamEntry(plan, 100 - S.BEATMIX_LEAD) - (8 - S.BEATMIX_LEAD)) < 1e-9);
  assert.ok(Math.abs(S.seamEntry(plan, 98) - (8 - S.BEATMIX_LEAD)) < 1e-9);
  // B can never be rolled from before the start of its own file
  assert.equal(S.seamEntry({ type: 'beatmix', startA: 100, startB: 0, seconds: 4 }, 99), 0);
  assert.equal(S.seamEntry(null, 10), 0, 'garbage in → the top of the file');
});
test('seamLeadFor: every seam gets the lead-in it can honestly afford', () => {
  assert.equal(S.seamLeadFor({ type: 'beatmix', startB: 8 }), S.BEATMIX_LEAD, 'plenty of runway — a beatmix takes the longer run-up');
  assert.ok(S.BEATMIX_LEAD > S.SEAM_LEAD, 'the lock is taken inside the lead: a beatmix needs more of it than a fade');
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
  for (const mode of [-1, 0, 1, 2, 3, 4]){
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
  for (const mode of [-1, 0, 1, 2, 3, 4]){
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

test('updateOffer: judged by provenance, because a difference is not a newer build', () => {
  const run = 'aaaa111111';
  // A CONTROLLERCHANGE IS A CLAIM, NOT A MEASUREMENT. This is what put
  // "aaaa111111 -> new" on a listener's screen: a worker took over, nobody
  // measured anything, and the card offered the build already running.
  assert.equal(S.updateOffer({ source: 'claim', build: '', running: run }), 'verify');
  assert.equal(S.updateOffer({ source: 'claim', running: run }), 'verify');
  // once checked, it is settled here by id
  assert.equal(S.updateOffer({ source: 'claim', build: run, running: run }), 'ignore');
  assert.equal(S.updateOffer({ source: 'claim', build: 'bbbb222222', running: run }), 'show');
  /* A CROSS-BUILD SHELL CLAIM STANDS ON ITS ID — an id is falsifiable, and every
     deploy is now stamped at build time (netlify.toml), so the id is a real name. */
  assert.equal(S.updateOffer({ source: 'shell', build: 'bbbb222222', running: run }), 'show',
    'a cross-build claim stands on its id');
  assert.equal(S.updateOffer({ source: 'shell', build: 'bbbb222222', print: '9:abc', running: run }), 'show');
  /* AND A PRINT IS NOT A LICENCE TO OFFER THE RUNNING BUILD. It used to be — so an
     un-stamped deploy could still be offered — and that rule is the loop the
     listener reported: "it never knows you are on the latest and always offers
     an update". Production shipped every release twice (the merge un-stamped,
     the stamp commit minutes later), and any byte difference against a cache
     became a card naming the build already running. Now the origin is asked;
     it answers with the build it actually serves. */
  assert.equal(S.updateOffer({ source: 'shell', build: run, print: '9:abc', running: run }), 'verify',
    'a claim naming the running build is checked against the origin, print or not');
  assert.equal(S.updateOffer({ source: 'shell', build: '', print: '9:abc', running: run }), 'verify',
    'an unnamed print is named by the origin before it is shown');
  /* BUT A CLAIM CARRYING NEITHER IS A VOICE, NOT A MEASUREMENT. Today's worker
     always sends the print; an announcement without one is a retired worker
     generation (installed before the guards existed, kept active because a
     waiting worker only activates on an apply or a full close) — the exact
     voice that rendered a card as "→ new" after everything else was fixed. It
     is asked to produce evidence, not believed. */
  assert.equal(S.updateOffer({ source: 'shell', build: '', running: run }), 'verify',
    'a nameless, unprinted shell claim is checked, not believed');
  assert.equal(S.updateOffer({ source: 'shell', build: run, running: run }), 'verify',
    'a shell claim of the running build with no print cannot be told from an echo');
  /* A WAITING WORKER IS A FACT ABOUT sw.js, NOT ABOUT THE SHELL. It used to
     stand on its own — "a versioned release the browser installed itself" — and
     that is the offer that came back forever, rendering its target as the word
     "new" because nothing had measured one. sw.js and index.html are separate
     objects with separate journeys through a CDN: a worker that installs while
     the edge still holds the previous index.html carries the shell already
     running here, and activating it changes nothing. It gets checked. */
  assert.equal(S.updateOffer({ source: 'worker', build: '', running: run }), 'verify');
  assert.equal(S.updateOffer({ source: 'worker', build: run, running: run }), 'ignore',
    'once named, a worker carrying this very build is not an update');
  assert.equal(S.updateOffer({ source: 'worker', build: 'bbbb222222', running: run }), 'show');
  /* AND THE RULE THAT MAKES AN OFFER FALSIFIABLE AT ALL: one already applied,
     from the build still running, is proof that applying it changed nothing.
     Every apply used to be the app's first apply — nothing was ever compared —
     so a swap that could not move the build was offered again the moment the
     page came back, forever. */
  const key = S.updateOfferKey(run, 'bbbb222222');
  assert.equal(S.updateOffer({ source: 'shell', build: 'bbbb222222', running: run, key, tried: key }), 'applied');
  assert.equal(S.updateOffer({ source: 'worker', build: '', running: run, key, tried: key }), 'applied',
    'the memory outranks provenance — it is evidence about THIS device');
  assert.equal(S.updateOffer({ source: 'shell', build: 'bbbb222222', running: run, key,
    tried: S.updateOfferKey(run, 'cccc333333') }), 'show', 'a different swap is a different offer');
  assert.equal(S.updateOffer({ source: 'shell', build: 'cccc333333', running: 'bbbb222222',
    print: '9:def', key: S.updateOfferKey('bbbb222222', '9:def'), tried: key }), 'show',
    'the swap landed and the build moved — the memory no longer matches');
  // nothing is offered while an apply is already under way
  for (const src of ['worker', 'shell', 'claim'])
    assert.equal(S.updateOffer({ source: src, build: 'bbbb222222', running: run, requested: true }), 'ignore');
  assert.equal(S.updateOffer(null), 'verify', 'garbage in → check, never assert');
});

/* ---- THE BOOTH'S PERFORMANCE LAYER -----------------------------------------
   These hold the logic a player's hands already know from real hardware. The
   one that matters most is the loop/roll distinction: get it wrong and both
   controls do the same thing, which is why cheap software has only one. */
test('beatLen / loopBounds: a loop is beats, and it starts on a line already heard', () => {
  assert.ok(Math.abs(S.beatLen(4, 120) - 2) < 1e-9, 'four beats at 120bpm is two seconds');
  assert.ok(Math.abs(S.beatLen(0.25, 120) - 0.125) < 1e-9, 'a quarter-beat too');
  assert.ok(S.beatLen(4, 0) > 0 && isFinite(S.beatLen(0, 120)), 'garbage tempo still yields a length');
  // the in-point is the LAST grid line at or before the playhead — never the
  // next one, because a loop that begins in the future is a gap
  const b = S.loopBounds(10.3, 0.2, 120, 4);
  assert.ok(b.start <= 10.3, 'starts at or before the playhead, got ' + b.start);
  assert.ok(10.3 - b.start < 0.5, 'and within a beat of it');
  assert.ok(Math.abs(((b.start - 0.2) / 0.5) - Math.round((b.start - 0.2) / 0.5)) < 1e-6,
    'and exactly on the lattice');
  assert.ok(Math.abs(b.end - b.start - 2) < 1e-9, 'four beats long at 120bpm');
  assert.ok(S.loopBounds(0.05, 0.2, 120, 4).start >= 0, 'never negative before the first line');
});
test('loopWrap: a late tick may not make the loop late', () => {
  const start = 10, len = 2;                       // four beats at 120bpm
  // fired on time, or a hair early: land on the in-point
  assert.ok(Math.abs(S.loopWrap(12.000, start, len) - 10) < 1e-9);
  assert.ok(Math.abs(S.loopWrap(11.992, start, len) - 10) < 1e-9, 'early carries nothing');
  // fired 40ms late — the lateness is carried, not thrown away
  assert.ok(Math.abs(S.loopWrap(12.04, start, len) - 10.04) < 1e-9);
  /* AND THAT IS THE WHOLE POINT: over many cycles the loop must not walk off the
     grid. Seeking to `start` every time makes each cycle len + jitter; carrying
     the overshoot makes it len on average, so the wraps stay on beat. */
  const jitter = [0.045, 0.012, 0.061, 0.038, 0.005, 0.052, 0.029, 0.044];
  let pos = start, elapsed = 0;
  for (const j of jitter){ pos = S.loopWrap(pos + len + j, start, len); elapsed += len + j; }
  // media time consumed per cycle, minus what the loop actually kept
  const drift = elapsed - jitter.length * len - (pos - start);
  assert.ok(Math.abs(drift) < 1e-9, 'no accumulated drift, got ' + drift);
  assert.ok(pos >= start && pos < start + len, 'and never leaves the loop, got ' + pos);
  // a pathological stall (a backgrounded tab) still lands inside the loop
  const far = S.loopWrap(start + len * 7.3, start, len);
  assert.ok(far >= start && far < start + len, 'a 6-cycle stall wraps in, got ' + far);
});
test('loopResize: halve and double, never sliding the in-point', () => {
  assert.equal(S.loopResize(4, 1), 8);
  assert.equal(S.loopResize(4, -1), 2);
  assert.equal(S.loopResize(0.125, -1), 0.125, 'clamped at the short end');
  assert.equal(S.loopResize(16, 1), 16, 'and at the long end');
  assert.equal(S.loopResize(3, 1), 1, 'off-ladder input lands back on the ladder');
  // every step is a power of two of its neighbour, which is what keeps a phrase
  // intact while it is being re-cut
  for (let i = 1; i < S.FX_DIVS.length; i++)
    assert.ok(Math.abs(S.FX_DIVS[i] / S.FX_DIVS[i - 1] - 2) < 1e-9, 'ladder step ' + i);
});
test('rollReturn vs a loop: the one line that makes them different controls', () => {
  const bpm = 120, beats = 1, start = 10;              // a one-beat roll at 120bpm
  // A LOOP latches: the track waits inside it. A ROLL stalls the music while the
  // track keeps running underneath, so releasing lands you where you WOULD have
  // been and the phrase is intact. If these two ever agreed, one of them would be
  // pointless — which is exactly the bug cheap software ships.
  assert.ok(Math.abs(S.rollReturn(start, 1.5, bpm, beats) - 11.5) < 1e-9,
    'held 1.5s → the track advanced 1.5s');
  assert.ok(Math.abs(S.rollPos(start, 1.5, bpm, beats) - 10.0) < 1e-9,
    'but you HEARD the top of the loop again (1.5s of a 0.5s loop wraps to 0)');
  assert.ok(Math.abs(S.rollPos(start, 0.3, bpm, beats) - 10.3) < 1e-9, 'mid-loop wraps correctly');
  assert.notEqual(S.rollReturn(start, 1.5, bpm, beats), S.rollPos(start, 1.5, bpm, beats));
  assert.equal(S.rollReturn(start, -5, bpm, beats), start, 'negative hold is no hold');
  assert.ok(S.rollReturn(0, 3, bpm, beats) >= 0);
});
// ------------------------------------------------ the loop that does not seek

test('ringSlice: a tape is a ring, and it says so when it has rolled past you', () => {
  const cap = 100;
  // one run when the request does not straddle the seam
  assert.deepEqual(S.ringSlice(cap, 150, 120, 20), [{ at: 20, len: 20 }]);
  // two when it does — the loop is the same audio either way
  assert.deepEqual(S.ringSlice(cap, 150, 90, 20), [{ at: 90, len: 10 }, { at: 0, len: 10 }]);
  const segs = S.ringSlice(cap, 150, 55, 95);
  assert.equal(segs.reduce((a, s) => a + s.len, 0), 95, 'every requested sample is accounted for');
  assert.ok(segs.every(s => s.at >= 0 && s.at + s.len <= cap), 'and none of them runs off the array');
  // THE REFUSALS, which are the whole reason this is a function and not a modulo
  assert.equal(S.ringSlice(cap, 150, 49, 10), null, 'fallen off the old end → nothing');
  assert.equal(S.ringSlice(cap, 150, 145, 10), null, 'not written yet → nothing');
  assert.deepEqual(S.ringSlice(cap, 150, 140, 10), [{ at: 40, len: 10 }],
    'the newest sample is exactly reachable');
  assert.deepEqual(S.ringSlice(cap, 150, 50, 10), [{ at: 50, len: 10 }],
    '…and so is the oldest one still on the tape');
  assert.equal(S.ringSlice(cap, 150, -3, 10), null, 'before the tape ever rolled → nothing');
  assert.equal(S.ringSlice(0, 150, 100, 10), null);
  assert.equal(S.ringSlice(cap, 150, 100, 0), null);
  // the whole tape, exactly, is a legal request
  assert.equal(S.ringSlice(cap, 150, 50, 100).reduce((a, s) => a + s.len, 0), 100);
});

test('ringIndexOf: the tape and the music share one index, at any speed', () => {
  const sr = 48000;
  // the recorder noted: tape index 96000 was the deck's 12.0 s
  assert.equal(S.ringIndexOf(96000, 12, sr, 1, 12), 96000);
  assert.equal(S.ringIndexOf(96000, 12, sr, 1, 13), 96000 + sr, 'a second later is a second of tape');
  assert.equal(S.ringIndexOf(96000, 12, sr, 1, 11.5), 96000 - sr / 2, 'and backwards too');
  /* AT SPEED, a second of TAPE is `rate` seconds of MUSIC — the tape records
     the graph, and the graph is already playing the track fast. Getting this
     upside down would put the in-point in the wrong place by the pitch. */
  assert.equal(S.ringIndexOf(0, 0, sr, 2, 2), sr, 'two seconds of music at 2× is one of tape');
  assert.equal(S.ringIndexOf(0, 0, sr, 0.5, 1), 2 * sr);
  assert.equal(S.ringIndexOf(0, 0, sr, 0, 1), sr, 'a nonsense rate falls back to 1×');
});

test('loopHandoverAt: the handover is the deck\'s own clock, not the graph\'s', () => {
  // deck at 12.0 s of music at context time 100.0; a 2 s loop that began at 11.5
  assert.ok(Math.abs(S.loopHandoverAt(100, 12, 11.5, 2, 1) - 101.5) < 1e-9);
  // half a loop already gone by → half a loop of real time left
  assert.ok(Math.abs(S.loopHandoverAt(100, 12.5, 11.5, 2, 1) - 101) < 1e-9);
  // at double speed the same music arrives in half the time
  assert.ok(Math.abs(S.loopHandoverAt(100, 12, 11.5, 2, 2) - 100.75) < 1e-9);
  assert.ok(Math.abs(S.loopHandoverAt(100, 12, 11.5, 2, 0) - 101.5) < 1e-9, 'a zero rate is 1×');
});

test('loopLateHandover: miss it and take another lap — never land late', () => {
  const len = 2, lead = 0.03;
  // comfortably in time → untouched
  assert.equal(S.loopLateHandover(101.5, 101.0, len, lead), 101.5);
  assert.equal(S.loopLateHandover(101.5, 101.47, len, lead), 101.5, 'right on the deadline still stands');
  /* PAST IT → a WHOLE loop later, so the in-point stays exactly where it was on
     the grid. Pushing by anything else would move the phrase, which is the one
     thing a loop may never do. */
  const a = S.loopLateHandover(101.5, 101.48, len, lead);
  assert.ok(Math.abs(a - 103.5) < 1e-9, 'one lap, got ' + a);
  const b = S.loopLateHandover(101.5, 106.2, len, lead);   // a very bad stall
  assert.ok(Math.abs(b - 107.5) < 1e-9, 'three laps, got ' + b);
  assert.ok(b > 106.2, 'and the answer is always still in the future');
  for (let n = 1; n < 40; n++){
    const now = 101.5 + n * 0.37;
    const at = S.loopLateHandover(101.5, now, len, lead);
    assert.ok(at - now >= lead - 1e-9, 'always leaves time to cut, at n=' + n);
    assert.ok(Math.abs(((at - 101.5) / len) - Math.round((at - 101.5) / len)) < 1e-9,
      'always a whole number of loops on, at n=' + n);
  }
});

test('loopHeadBlend: the buffer starts on the audio that really did follow', () => {
  const n = 64;
  const a = S.loopHeadBlend(0, n);
  assert.ok(Math.abs(a.tail - 1) < 1e-9 && Math.abs(a.head) < 1e-9,
    'the very first sample IS what the deck was about to play — that is what makes the join silent');
  const z = S.loopHeadBlend(n, n);
  assert.ok(Math.abs(z.head - 1) < 1e-9 && Math.abs(z.tail) < 1e-9, 'and by the end it is the loop proper');
  // equal power all the way across: two different pieces of music, so a linear
  // sum would dip in the middle and the wrap would breathe
  for (let i = 0; i <= n; i++){
    const w = S.loopHeadBlend(i, n);
    assert.ok(Math.abs(w.head * w.head + w.tail * w.tail - 1) < 1e-9, 'power holds at ' + i);
    assert.ok(w.head >= 0 && w.tail >= 0);
  }
  assert.ok(S.loopHeadBlend(1, n).head > S.loopHeadBlend(0, n).head, 'monotone into the loop');
  const none = S.loopHeadBlend(0, 0);
  assert.ok(none.head === 1 && none.tail === 0, 'no blend asked for, no blend given');
});

test('loopXfadeLen: long enough to swallow a splice, never long enough to hear', () => {
  assert.ok(Math.abs(S.loopXfadeLen(2, 1) - S.LOOP_XFADE) < 1e-9, 'a normal loop gets the full blend');
  // a 1/8-beat roll is 60 ms at 128bpm — a 12 ms blend would be a fifth of it
  const tiny = S.loopXfadeLen(0.06, 1);
  assert.ok(tiny <= 0.06 / 8 + 1e-9 && tiny > 0, 'a very short loop gets a proportional one, got ' + tiny);
  assert.equal(S.loopXfadeLen(2, 0), 0, 'no spare tape, no blend — the caller windows instead');
  assert.equal(S.loopXfadeLen(2, -1), 0);
  assert.ok(S.loopXfadeLen(2, 0.004) <= 0.004 + 1e-9, 'never asks for tape that is not there');
  assert.ok(S.loopXfadeLen(0, 1) >= 0, 'a nonsense length does not produce a nonsense blend');
});

test('loopPhaseAt / loopHandbackPos: giving the room back without a gap', () => {
  const len = 2, hand = 100, start = 30;
  assert.equal(S.loopPhaseAt(99, hand, len), 0, 'before the handover there is no phase yet');
  assert.ok(Math.abs(S.loopPhaseAt(100.5, hand, len) - 0.5) < 1e-9);
  assert.ok(Math.abs(S.loopPhaseAt(107.5, hand, len) - 1.5) < 1e-9, 'and it wraps, forever');
  const lead = 0.16;
  /* A ROLL NEEDS NO SEEK. The track ran on underneath the whole time — that is
     the roll's entire idea — so the deck is already exactly where it belongs and
     touching it would undo the thing that makes a roll a roll. */
  assert.equal(S.loopHandbackPos('roll', start, len, 1.2, 44.44, lead), 44.44);
  /* A LATCHED LOOP lets go INSIDE itself, the way a CDJ does. The deck is seeked
     `lead` short of where the loop WILL be, so that when the crossover happens it
     has arrived — and it is the loop, not the deck, that is audible while it
     travels. */
  const p = 1.2;
  const back = S.loopHandbackPos('loop', start, len, p, 999, lead);
  assert.ok(Math.abs(back - (start + p + lead - lead)) < 1e-9, 'lands on the loop\'s own phase, got ' + back);
  assert.ok(back >= start && back < start + len, 'and inside the loop');
  // and when the lead crosses the wrap, it comes back round rather than falling out
  for (const ph of [0, 0.02, 0.1, 1.85, 1.99, 1.9999]){
    const b = S.loopHandbackPos('loop', start, len, ph, 999, lead);
    assert.ok(b >= start - 1e-9 && b < start + len + 1e-9, 'phase ' + ph + ' stayed inside, got ' + b);
  }
  assert.ok(S.loopHandbackPos('loop', 0, len, 0, 999, lead) >= 0, 'never negative at the top of a track');
});

test('loopInPoint: a loop may not begin before the tape was rolling', () => {
  const bpm = 120, grid = 0, spb = 0.5;
  // plenty of tape → exactly loopBounds, the line already heard
  const easy = S.loopInPoint(10.3, grid, bpm, 4, 24);
  assert.ok(Math.abs(easy.start - 10) < 1e-9, 'the last line at or before the playhead');
  assert.equal(easy.pushed, 0);
  assert.ok(Math.abs(easy.len - 2) < 1e-9, '4 beats at 120bpm is 2s');
  // FIRST PRESS OF A SESSION: no past to cut from, so take the next line rather
  // than quietly shipping a loop that is not the length it says it is
  const cold = S.loopInPoint(10.3, grid, bpm, 4, 0);
  assert.equal(cold.pushed, 1);
  assert.ok(Math.abs(cold.start - 10.5) < 1e-9, 'one beat later, still on the grid, got ' + cold.start);
  assert.ok(Math.abs(cold.len - easy.len) < 1e-9, 'and the full length either way');
  assert.ok(Math.abs((cold.start - easy.start) / spb - Math.round((cold.start - easy.start) / spb)) < 1e-9,
    'the push is a whole number of beats — the phrase does not slide');
  // a little tape is enough when the playhead is barely past the line
  assert.equal(S.loopInPoint(10.05, grid, bpm, 4, 0.2).pushed, 0);
  assert.equal(S.loopInPoint(10.45, grid, bpm, 4, 0.2).pushed, 1);
  // no recorder at all (iOS) → the constraint does not exist and nothing moves
  const ios = S.loopInPoint(10.3, grid, bpm, 4, Infinity);
  assert.ok(Math.abs(ios.start - S.loopBounds(10.3, grid, bpm, 4).start) < 1e-9);
  assert.ok(Math.abs(ios.end - (ios.start + ios.len)) < 1e-9, 'end is start plus length, always');
});

test('fxWet: fine where it matters, and never a mute', () => {
  assert.equal(S.fxWet(0), 0);
  assert.ok(S.fxWet(1) <= 0.92 && S.fxWet(1) > 0.9, 'full travel stops short of swallowing the track');
  // the cubic buys control low down: half travel is well under half wet
  assert.ok(S.fxWet(0.5) < 0.2, 'half the knob is a light touch, got ' + S.fxWet(0.5));
  let prev = -1;
  for (let x = 0; x <= 1.001; x += 0.05){ const v = S.fxWet(x); assert.ok(v >= prev, 'monotone'); prev = v; }
  assert.equal(S.fxWet(-3), 0); assert.equal(S.fxWet(9), S.fxWet(1));
});
test('fxFilter: one bipolar knob, a real detent, and hearing-shaped travel', () => {
  const nyq = 22050;
  const mid = S.fxFilter(0, nyq);
  assert.equal(mid.active, false, 'the centre is bypass, not "nearly bypass"');
  assert.ok(mid.lp >= 22000 - 1 && mid.hp <= 20, 'and both corners are out of the way');
  assert.equal(S.fxFilter(0.04, nyq).active, false, 'the detent is real — a nudge does nothing');
  const lo = S.fxFilter(-1, nyq), hi = S.fxFilter(1, nyq);
  assert.ok(lo.active && lo.lp < 100, 'hard left is a closed lowpass — the kick leaves too, got ' + lo.lp);
  assert.ok(hi.active && hi.hp > 12000, 'hard right is a high highpass — the air leaves too, got ' + hi.hp);
  // exponential, so the knob feels even end to end rather than doing everything
  // in the last inch
  const a = S.fxFilter(-0.5, nyq).lp, b = S.fxFilter(-0.75, nyq).lp;
  assert.ok(b < a && b > lo.lp, 'monotone down the left half');
  assert.ok(a < 4000, 'and already well down at half travel, got ' + a);
  for (const v of [-2, 2, NaN, null])
    assert.ok(isFinite(S.fxFilter(v, nyq).lp) && isFinite(S.fxFilter(v, nyq).hp), 'finite for ' + v);
});
test('fxTime / fxGateHold: on the grid, and never a mute either', () => {
  assert.ok(Math.abs(S.fxTime(0.5, 120) - 0.25) < 1e-9, 'a half-beat echo at 120bpm');
  assert.ok(Math.abs(S.fxTime(1, 174) - 60 / 174) < 1e-9, 'and at any tempo');
  assert.equal(S.fxGateHold(0), 1, 'no depth is bypass');
  assert.ok(S.fxGateHold(1) > 0.15 && S.fxGateHold(1) < 0.2, 'full depth still lets sound through');
  assert.ok(S.fxGateHold(0.5) < S.fxGateHold(0.2), 'monotone');
});
test('brakeRate: a turntable losing power, and never a click', () => {
  assert.ok(Math.abs(S.brakeRate(0, 1, 1) - 1) < 1e-9, 'starts where the deck was');
  assert.ok(S.brakeRate(0.5, 1, 1) < 0.4, 'and falls away fast — weight, not a fade');
  // NEVER zero: a media element at rate 0 is a paused element, and pausing
  // mid-brake is the click this exists to avoid
  for (const t of [1, 2, 10, 1e6]) assert.ok(S.brakeRate(t, 1, 1) >= 0.06, 'bottoms out, not stops');
  assert.ok(S.brakeRate(0.5, 4, 1) > S.brakeRate(0.5, 1, 1), 'a longer brake decays slower');
  assert.ok(S.brakeRate(-1, 1, 1) <= 1, 'negative time cannot speed it up');
});
test('fxAutoPick: the room only reaches for an effect the music has earned', () => {
  const base = { ceil: 1, energy: 0.9, act: 2, phase: 'peak', bar: 2, toSeam: null };
  // SILENCE IS THE DEFAULT, and the most common answer. An effect that fires
  // because a timer said so is decoration; this reads the song's own structure.
  assert.equal(S.fxAutoPick({ ...base, ceil: 0.3 }), 'none', 'a quiet passage is left alone');
  assert.equal(S.fxAutoPick({ ...base, struggling: true }), 'none', 'a strained device pays for nothing');
  assert.equal(S.fxAutoPick({ ...base, phase: 'flow', energy: 0.5 }), 'none');
  // the last bar before a hand-off: the outgoing track leaves in its own tail
  assert.equal(S.fxAutoPick({ ...base, toSeam: 1.2, bar: 2 }), 'echo');
  assert.equal(S.fxAutoPick({ ...base, toSeam: 9, bar: 2 }), 'gate', 'but not a whole phrase early');
  // a build IS a sweep — every pair of hands in the world knows this one
  assert.equal(S.fxAutoPick({ ...base, phase: 'build', energy: 0.8 }), 'filter');
  // a chop reads as energy at a real peak and as a fault anywhere calmer
  assert.equal(S.fxAutoPick({ ...base, phase: 'peak', act: 2, energy: 0.9 }), 'gate');
  assert.equal(S.fxAutoPick({ ...base, phase: 'peak', act: 1, energy: 0.9 }), 'none');
  assert.equal(S.fxAutoPick({ ...base, phase: 'peak', act: 2, energy: 0.6 }), 'none');
  assert.equal(S.fxAutoPick(null), 'none', 'garbage in → silence, never a random effect');
});

// ---------------------------------------------------------------- the lamp

const LOPT = { rb: 0.50, rt: 0.335, mu: 1, n: 190 };

function lavaRun(st, secs, h, env){
  const budget = S.lavaBudget({});
  const e = Object.assign({ heat: 0.88, flow: S.LAVA.flow, budget, entropy: 0.35, treble: 0.3 }, env || {});
  for (let i = 0; i < Math.round(secs / h); i++) S.lavaStep(st, h, e);
  return st;
}
function lavaPeak(st){
  let v = 0;
  for (let i = 0; i < st.n; i++) v = Math.max(v, Math.hypot(st.vx[i], st.vy[i]));
  return v;
}

test('lavaFlow: a stream function cannot leak', () => {
  // ψ is differentiated, not guessed, so ∇·u = ψ_yx − ψ_xy = 0 identically.
  // Measured in a straight-walled column, where the taper's own O(dR/dy) term
  // is absent and the identity is the whole story.
  const o = { rb: 0.4, rt: 0.4 };
  let worst = 0;
  for (let i = 0; i < 25; i++)
    for (let j = 0; j < 25; j++){
      const x = -0.4 + 0.8 * (i + 0.5) / 25;
      const y = S.LAVA.yB + (S.LAVA.yT - S.LAVA.yB) * (j + 0.5) / 25;
      const e = 1e-4;
      const dux = (S.lavaFlow(x + e, y, o, 0.1, 0).u - S.lavaFlow(x - e, y, o, 0.1, 0).u) / (2 * e);
      const dvy = (S.lavaFlow(x, y + e, o, 0.1, 0).v - S.lavaFlow(x, y - e, o, 0.1, 0).v) / (2 * e);
      worst = Math.max(worst, Math.abs(dux + dvy));
    }
  assert.ok(worst < 1e-5, 'divergence ' + worst);
  assert.ok(Math.abs(S.lavaFlow(0.4, 0, o, 0.1, 0).u) < 1e-9, 'no flow through the wall');
  assert.ok(Math.abs(S.lavaFlow(0.1, S.LAVA.yB, o, 0.1, 0).v) < 1e-9, 'none through the heater');
  assert.ok(Math.abs(S.lavaFlow(0.1, S.LAVA.yT, o, 0.1, 0).v) < 1e-9, 'none through the cap');
  assert.ok(S.lavaFlow(0, 0, o, 0.1, 0).v > 0.05, 'up the middle');
  assert.ok(S.lavaFlow(0.39, 0, o, 0.1, 0).v < -0.05, 'down the walls');
});

test('the kernels are two-dimensional, and the gradient is the gradient', () => {
  // Poly6 and Spiky are quoted everywhere with their 3D normalisations, and a
  // solver whose kernel integrates to something other than one has a rest
  // density that disagrees with the one it measures — a fluid that inflates
  // by a per-cent an hour and nothing to say so. Integrated on a plane:
  const h = 0.12;
  let vol = 0;
  const M = 400, step = 2 * h / M;
  for (let i = 0; i < M; i++)
    for (let j = 0; j < M; j++){
      const x = -h + (i + 0.5) * step, y = -h + (j + 0.5) * step;
      vol += S.lavaW(x * x + y * y, h) * step * step;
    }
  assert.ok(Math.abs(vol - 1) < 0.01, 'poly6 integrates to ' + vol.toFixed(4) + ' on a plane');
  // …and spiky really is dW/dr for the density kernel's own falloff shape
  assert.ok(S.lavaGradW(0.06, h) < 0, 'the gradient points inward');
  assert.equal(S.lavaGradW(h, h), 0, 'and vanishes at the edge of the kernel');
  assert.equal(S.lavaW(h * h, h), 0);
  // hoisting the normalisation must not change the answer
  assert.equal(S.lavaW(0.001, h), S.lavaW(0.001, h, S.lavaK6(h)));
  assert.equal(S.lavaGradW(0.05, h), S.lavaGradW(0.05, h, S.lavaKS(h)));
});

test('lavaCohesion: attractive at range, repulsive underfoot', () => {
  const h = 0.12;
  assert.equal(S.lavaCohesion(0, h), 0);
  assert.equal(S.lavaCohesion(h, h), 0, 'and nothing beyond the kernel');
  assert.ok(S.lavaCohesion(h * 0.7, h) > 0, 'a pull at range');
  // BELOW HALF A KERNEL IT PUSHES. That sign change is what stops particles
  // collapsing into a clump, and it is why this fluid needs no artificial
  // pressure term alongside it — one spline does both jobs.
  assert.ok(S.lavaCohesion(h * 0.12, h) < 0, 'a push underfoot');
});

test('lavaBudget: less asked of less, and never past the array', () => {
  const full = S.lavaBudget({}), eco = S.lavaBudget({ eco: true }),
        weak = S.lavaBudget({ struggling: true });
  assert.ok(eco.n < full.n && weak.n <= eco.n, 'fewer particles for a weaker device');
  // …and a machine we already KNOW the answer for is not made to wait for the
  // frame governor to discover it over someone's first ten seconds
  assert.ok(S.lavaBudget({ ios: true }).n < full.n, 'a phone is budgeted as a phone');
  assert.ok(S.lavaBudget({ cores: 2 }).n < full.n, 'and so is a two-core machine');
  assert.equal(S.lavaBudget({ cores: 16 }).n, full.n, 'a big machine gets the lot');
  assert.ok(S.lavaBudget({ ios: true, struggling: true }).n
            <= S.lavaBudget({ ios: true }).n, 'the hints compose downward');
  for (const b of [full, eco, weak]) assert.ok(b.n <= S.LAVA.maxN, 'within the cap');
  // …and the fluid is COARSER, not smaller: the same wax fills the same
  // bottle out of fewer, larger parcels
  const a = S.makeLava(1, Object.assign({}, LOPT, { n: full.n }));
  const c = S.makeLava(1, Object.assign({}, LOPT, { n: weak.n }));
  assert.ok(c.d > a.d && c.h > a.h, 'a tighter budget widens the spacing');
  assert.ok(Math.abs(a.n * a.d * a.d - c.n * c.d * c.d) / (a.n * a.d * a.d) < 0.25,
            'and the wax in the bottle is the same wax');
});

test('WAX DOES NOT WIGGLE: an undisturbed fluid goes quiet', () => {
  /* THE REGRESSION TEST FOR THE DEFECT THIS ROOM WAS REBUILT OVER.

     Switch off gravity, the convection, the heater and the hand, and a
     liquid has exactly one thing left to do: settle. The first fluid here
     did not — it hummed, at peak speeds of 1.0 in a bottle one unit wide,
     because its density constraint was allowed to PULL and a position
     correction becomes a velocity when it is divided by the timestep. That
     is what "it wiggles too much to look like wax" was, measured.

     The constraint now only pushes and the cohesion is a force, so this is
     the assertion that keeps it that way. */
  const st = S.makeLava(4242, LOPT);
  const budget = S.lavaBudget({});
  const still = { heat: 0, flow: 0, budget, entropy: 0, treble: 0 };
  const hold = () => { for (let i = 0; i < st.n; i++) st.T[i] = S.LAVA.Tn; };
  for (let i = 0; i < 60 * 12; i++){ hold(); S.lavaStep(st, 1 / 60, still); }
  const v = lavaPeak(st);
  assert.ok(v < 0.05, 'a fluid nobody is touching still moves at ' + v.toFixed(4));
});

test('…and two droplets left alone join, and the join rounds itself off', () => {
  /* The other half of the same claim. Nothing in the step decides that a
     merge has happened — there is no merge in the code — so what this
     measures is whether the physics does it: two discs placed a spacing
     apart must end up as one body, and that body must become round. */
  const st = S.makeLava(7, Object.assign({}, LOPT, { n: 120 }));
  const budget = S.lavaBudget({});
  const still = { heat: 0, flow: 0, budget, entropy: 0, treble: 0 };
  // re-pour: two hex discs, just touching
  const half = st.n >> 1;
  for (let c = 0; c < 2; c++){
    const cx = c ? 0.16 : -0.16;
    let k = c * half, placed = 0, ring = 0;
    while (placed < half && k < st.n){
      for (let j = -ring; j <= ring && placed < half && k < st.n; j++)
        for (let i = -ring; i <= ring && placed < half && k < st.n; i++){
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
          st.px[k] = cx + (i + (j & 1) * 0.5) * st.d;
          st.py[k] = j * st.d * 0.8660254;
          st.vx[k] = st.vy[k] = 0; st.T[k] = S.LAVA.Tn;
          k++; placed++;
        }
      ring++;
    }
  }
  const hold = () => { for (let i = 0; i < st.n; i++) st.T[i] = S.LAVA.Tn; };
  for (let i = 0; i < 60 * 25; i++){ hold(); S.lavaStep(st, 1 / 60, still); }
  // one body: every particle within a kernel of the centroid's disc
  let cx = 0, cy = 0;
  for (let i = 0; i < st.n; i++){ cx += st.px[i]; cy += st.py[i]; }
  cx /= st.n; cy /= st.n;
  let rmax = 0;
  for (let i = 0; i < st.n; i++) rmax = Math.max(rmax, Math.hypot(st.px[i] - cx, st.py[i] - cy));
  const rEq = Math.sqrt(st.n * st.d * st.d * 0.8660254 / Math.PI);
  assert.ok(rmax < rEq * 1.45, 'the pair is one round body: ' + (rmax / rEq).toFixed(2));
  assert.ok(lavaPeak(st) < 0.05, 'and it has stopped moving');
});

test('the lamp runs for ten minutes without leaking or compressing', () => {
  const st = S.makeLava(20260804, LOPT);
  const n0 = st.n;
  let worst = 0, escaped = 0, fastest = 0, top = 0, bottom = 0;
  const budget = S.lavaBudget({});
  const H = S.LAVA.yT - S.LAVA.yB;
  for (let i = 0; i < 60 * 600; i++){
    const t = i / 60;
    S.lavaStep(st, 1 / 60, { heat: 0.88 + 0.1 * Math.sin(t * 0.05), flow: S.LAVA.flow,
                             budget, entropy: 0.35, treble: 0.3 });
    worst = Math.max(worst, S.lavaDensityError(st));
    for (let k = 0; k < st.n; k++){
      assert.ok(isFinite(st.px[k]) && isFinite(st.py[k]) && isFinite(st.T[k]),
                'a number went missing at t=' + t.toFixed(1));
      const R = S.lavaRadius(st.py[k], st.opt);
      if (Math.abs(st.px[k]) > R + 1e-6 || st.py[k] < S.LAVA.yB - 1e-6 || st.py[k] > S.LAVA.yT + 1e-6) escaped++;
      fastest = Math.max(fastest, Math.hypot(st.vx[k], st.vy[k]));
      if (st.py[k] > S.LAVA.yB + H * 0.55) top++;
      if (st.py[k] < S.LAVA.yB + H * 0.16) bottom++;
    }
  }
  // THE VOLUME IS THE PARTICLE COUNT — nothing in the step creates or
  // destroys one — so what has to be checked is that the solver is keeping
  // the fluid at the density it claims to.
  assert.equal(st.n, n0, 'wax is neither created nor destroyed');
  assert.ok(worst < 0.15, 'the fluid was compressed by ' + worst.toFixed(3));
  assert.equal(escaped, 0, 'the glass held');
  assert.ok(top > 0, 'something reached the upper column — the lamp is convecting');
  assert.ok(bottom > 0, 'and something came back down');
  assert.ok(fastest < 2, 'nothing ran away: ' + fastest.toFixed(2));
});

test('the lamp is the same lamp at any frame rate', () => {
  // A position-based solver has no stiffness limit, so a phone drawing at ten
  // frames a second gets the physics rather than a divergent cousin of it.
  for (const h of [1 / 10, 1 / 30, 1 / 144]){
    const st = lavaRun(S.makeLava(9, LOPT), 150, h);
    assert.ok(S.lavaDensityError(st) < 0.2, 'density, at h=' + h.toFixed(4));
    for (let i = 0; i < st.n; i++){
      assert.ok(isFinite(st.px[i]) && isFinite(st.vx[i]), 'finite at h=' + h.toFixed(4));
      assert.ok(Math.hypot(st.vx[i], st.vy[i]) < 2, 'bounded at h=' + h.toFixed(4));
      assert.ok(Math.abs(st.px[i]) <= S.lavaRadius(st.py[i], st.opt) + 1e-6,
                'inside, at h=' + h.toFixed(4));
    }
  }
});

test('makeLava: the same seed is the same lamp, twice', () => {
  const run = () => {
    const st = lavaRun(S.makeLava(31415, LOPT), 40, 1 / 60);
    let s = '';
    for (let i = 0; i < st.n; i++) s += st.px[i].toFixed(7) + ',' + st.py[i].toFixed(7) + '|';
    return s;
  };
  assert.equal(run(), run(), 'deterministic from the seed');
});


/* ---------------- the warm-up: joining as something you DO ---------------- */

test('warmBlend: hues are angles, and the wrap is where the room lives', () => {
  // the whole reason this is not an average. 350 and 10 meet at 0, and an
  // arithmetic mean would answer 180 — the exact opposite colour, on the one
  // pair of picks half a room actually makes.
  const b = S.warmBlend([{ h: 350, c: 0.16 }, { h: 10, c: 0.16 }]);
  const off = Math.min(Math.abs(b.h - 0), Math.abs(b.h - 360));
  assert.ok(off < 1e-6, 'met at red, not at cyan: ' + b.h.toFixed(3));
});

test('warmBlend: agreement and scatter are told apart', () => {
  const same = S.warmBlend([{ hue: 4 }, { hue: 4 }, { hue: 4 }]);
  assert.ok(same.spread < 1e-6, 'a room that agrees has no spread');
  // four picks at the compass points cancel: no direction at all
  const wide = S.warmBlend([{ h: 0, c: 0.16 }, { h: 90, c: 0.16 },
                            { h: 180, c: 0.16 }, { h: 270, c: 0.16 }]);
  assert.ok(wide.spread > 0.99, 'a room pulling four ways is scatter: ' + wide.spread.toFixed(3));
  assert.equal(wide.voices, 4);
});

test('warmBlend: standing in the room without steering it', () => {
  const bone = S.WARM_HUES[S.WARM_HUES.length - 1];
  assert.equal(bone.c, 0, 'the last swatch carries no colour');
  const with_ = S.warmBlend([{ h: 200, c: 0.15 }, bone, bone]);
  const alone = S.warmBlend([{ h: 200, c: 0.15 }]);
  assert.ok(Math.abs(with_.h - alone.h) < 1e-9, 'colourless picks never drag the mean');
  assert.equal(with_.n, 3, 'but they are in the room');
  assert.equal(with_.voices, 1, 'and not in the vote');
});

test('warmBlend: nobody, and nobody with a colour', () => {
  assert.deepEqual(S.warmBlend([]), { h: 0, c: 0, n: 0, spread: 0, voices: 0 });
  assert.deepEqual(S.warmBlend(null), { h: 0, c: 0, n: 0, spread: 0, voices: 0 });
  const q = S.warmBlend([{ h: 10, c: 0 }, { h: 300, c: 0 }]);
  assert.equal(q.voices, 0, 'no voices');
  assert.equal(q.n, 2, 'two people all the same');
});

test('warmHue: any index lands on a real swatch', () => {
  for (const i of [-9, -1, 0, 3, 7, 8, 99, 1.7]){
    const e = S.warmHue(i);
    assert.ok(S.WARM_HUES.indexOf(e) >= 0, 'index ' + i + ' is somebody');
  }
  assert.strictEqual(S.warmHue(NaN), S.WARM_HUES[0], 'junk gets the first, not undefined');
  assert.strictEqual(S.warmHue(-1), S.WARM_HUES[S.WARM_HUES.length - 1], 'wraps backwards');
});

test('warmDeal: the room leans the deal, it never seizes it', () => {
  const all = S.warmDeal([{ scene: 'lava' }, { scene: 'lava' }, { scene: 'lava' }]);
  assert.ok(all.lava > 1, 'a unanimous room is a real thumb on the scale');
  assert.ok(all.lava <= 1 + S.WARM_PULL + 1e-9, 'and a bounded one: ' + all.lava);
  assert.equal(all.flame, undefined, 'a room nobody picked is untouched, not punished');
  const split = S.warmDeal([{ scene: 'lava' }, { scene: 'halo' },
                            { scene: 'fern' }, { scene: 'opart' }]);
  for (const k of Object.keys(split)) assert.ok(split[k] < all.lava, k + ' moves less than unanimity');
  assert.deepEqual(S.warmDeal([]), {}, 'nobody has picked yet: no opinion at all');
  assert.deepEqual(S.warmDeal([{ hue: 2 }]), {}, 'a colour pick is not a scene vote');
});

test('togetherness: the meter cannot be filled alone', () => {
  const now = 10000;
  const drum = [];
  for (let i = 0; i < 40; i++) drum.push({ id: 'a', at: now - i * 20 });
  assert.equal(S.togetherness(drum, now, 1200).v, 0, 'one thumb, however fast');
  assert.equal(S.togetherness(drum, now, 1200).n, 1);
  const four = [{ id: 'a', at: now - 100 }, { id: 'b', at: now - 300 },
                { id: 'c', at: now - 800 }, { id: 'd', at: now - 1100 }];
  assert.equal(S.togetherness(four, now, 1200).v, 1, 'four hands is the room');
  assert.ok(S.togetherness(four.slice(0, 2), now, 1200).v > 0, 'two is a start');
  // and it decays: the same four, a moment later, are history
  assert.equal(S.togetherness(four, now + 5000, 1200).n, 0, 'the window really is a window');
});

test('togetherness: junk in the tap list is not a hand', () => {
  const now = 500;
  const t = S.togetherness([null, { at: now }, { id: 'a', at: now }, { id: 'a' }], now, 1200);
  assert.equal(t.n, 1, 'one real id; the anonymous entry is nobody');
});

test('warmSpark: a stone in water, not a loading spinner', () => {
  assert.deepEqual(S.warmSpark(-1, 2), { r: 0, a: 0 }, 'before it happened');
  assert.deepEqual(S.warmSpark(3, 2), { r: 0, a: 0 }, 'after it is over');
  const early = S.warmSpark(0.25, 2), late = S.warmSpark(1.75, 2);
  assert.ok(early.r < late.r, 'the ring only ever grows');
  assert.ok(early.a > late.a, 'and only ever fades');
  // the first quarter of its life covers half the distance: fast, then settling
  assert.ok(S.warmSpark(0.5, 2).r > 0.49, 'leaves fast: ' + S.warmSpark(0.5, 2).r.toFixed(3));
  assert.ok(S.warmSpark(2, 2).a < 1e-9, 'gone at the end, not merely faint');
});

test('beatGrace: 0.98 is early, not late', () => {
  assert.ok(S.beatGrace(0.98, 0.16) > 0.8, 'two hundredths early is on time');
  assert.equal(S.beatGrace(0.5, 0.16), 0, 'the far side of the beat scores nothing');
  assert.equal(S.beatGrace(0, 0.16), 1, 'dead on');
  assert.equal(S.beatGrace(1, 0.16), 1, 'and the wrap is dead on too');
  assert.equal(S.beatGrace(NaN, 0.16), 0, 'no grid, no bonus, no crash');
  // it never goes negative — being off the beat costs nothing
  for (let p = 0; p < 1; p += 0.017) assert.ok(S.beatGrace(p, 0.16) >= 0, 'never a penalty');
});

test('dealScene: the room leans the night without seizing it', () => {
  // two rooms, identical appetite, and a crowd that all voted for the second
  const scenes = [{ key: 'a', taste: {} }, { key: 'b', taste: {} }];
  const crowd = S.warmDeal([{ scene: 'b' }, { scene: 'b' }, { scene: 'b' }]);
  let a = 0, b = 0;
  for (let i = 0; i < 400; i++){
    const r = i / 400;
    if (S.dealScene({ scenes, f: {}, active: -1, r, crowd }) === 1) b++; else a++;
  }
  assert.ok(b > a, 'the voted room comes up more often: ' + b + ' vs ' + a);
  assert.ok(a > 0, 'and the other one still comes up at all — a lean, not a seizure');
  // and with nobody in the room the deal is exactly what it always was
  let plain = 0;
  for (let i = 0; i < 400; i++){
    if (S.dealScene({ scenes, f: {}, active: -1, r: i / 400, crowd: S.warmDeal([]) }) === 1) plain++;
  }
  assert.ok(Math.abs(plain - 200) <= 1, 'an empty room is a fair coin: ' + plain + '/400');
});

test('sceneSig: every room has a thumbnail somebody can point at', () => {
  for (const k of S.SCENE_KEYS){
    assert.ok(S.SCENE_SIGS[k], 'no signature for scene "' + k + '" — its tile would be blank');
    assert.ok(S.SCENE_SIGS[k].kind, k + ' has a painter');
    assert.ok(S.SCENE_SIGS[k].h >= 0 && S.SCENE_SIGS[k].h < 360, k + ' has a hue');
  }
  assert.ok(S.sceneSig('a room invented tomorrow').kind, 'an unknown key still draws something');
});

// ------------------------------------------------- the observer, on both sides

test('CIE_LOBES: the fit is the shape the shader generator expects', () => {
  // GLSL_CIE writes one `k * cieGauss(l, mu, s1, s2)` per entry, so an entry of
  // the wrong arity would generate a shader that fails to compile at runtime —
  // on a device, in the dark, at a gig. Caught here instead.
  for (const band of ['x', 'y', 'z']){
    const ls = S.CIE_LOBES[band];
    assert.ok(Array.isArray(ls) && ls.length >= 2, `${band} has no lobes`);
    for (const l of ls){
      assert.equal(l.length, 4, `${band} lobe is not (k, mu, s1, s2)`);
      for (const v of l) assert.ok(typeof v === 'number' && isFinite(v));
      assert.ok(l[1] > 350 && l[1] < 700, 'a lobe outside the visible band');
      assert.ok(l[2] > 0 && l[3] > 0, 'a lobe with a non-positive width');
    }
  }
  assert.equal(S.XYZ_TO_SRGB.length, 3);
  for (const row of S.XYZ_TO_SRGB) assert.equal(row.length, 3);
});
test('cieXYZBar: the eye peaks green, and 555 nm is the top of it', () => {
  let best = 0, bestL = 0;
  for (let l = 380; l <= 780; l++){
    const y = S.cieXYZBar(l).y;
    if (y > best){ best = y; bestL = l; }
  }
  assert.ok(Math.abs(bestL - 555) <= 8, `photopic peak at ${bestL} nm, not 555`);
  assert.ok(Math.abs(best - 1) < 0.03, 'the luminous efficiency peak is normalised to 1');
  assert.ok(S.cieXYZBar(420).z > S.cieXYZBar(420).x, 'violet is mostly Z');
  assert.ok(S.cieXYZBar(650).x > S.cieXYZBar(650).z, 'deep red is mostly X');
  // and the one negative lobe survives the refactor into a table
  assert.ok(S.cieXYZBar(500).x < S.cieXYZBar(490).x + 0.02, 'the x dip near 500 nm is gone');
});
test('DISP_WB: a flat lamp comes out neutral, not warm', () => {
  const N = 24;
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < N; i++){
    const b = S.cieXYZBar(400 + 300 * (i + 0.5) / N);
    X += b.x; Y += b.y; Z += b.z;
  }
  const raw = S.xyzToLinearRGB({ x: X / N, y: Y / N, z: Z / N });
  const bal = S.xyzToLinearRGB({ x: X / N * S.DISP_WB[0], y: Y / N * S.DISP_WB[1], z: Z / N * S.DISP_WB[2] });
  const spread = c => (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / Math.max(c.r, c.g, c.b);
  assert.ok(spread(raw) > 0.05, 'illuminant E really is off-white — otherwise there is nothing to correct');
  assert.ok(spread(bal) < 0.02, `white balanced flat spectrum still has a cast: ${spread(bal)}`);
});

// -------------------------------------------------------------- diffraction

test('rayleighSep: the resolution limit is λ over D, and nothing else', () => {
  const D = 12000;
  assert.ok(Math.abs(S.rayleighSep(D, 550) - S.AIRY_J1_ZERO * 550 / D) < 1e-12);
  // twice the wavelength, twice the limit; twice the aperture, half of it
  assert.ok(Math.abs(S.rayleighSep(D, 1100) - 2 * S.rayleighSep(D, 550)) < 1e-12);
  assert.ok(Math.abs(S.rayleighSep(2 * D, 550) - 0.5 * S.rayleighSep(D, 550)) < 1e-12);
  // blue resolves finer than red through the same glass — the whole reason a
  // telescope is specified at a wavelength
  assert.ok(S.rayleighSep(D, 440) < S.rayleighSep(D, 660));
  assert.ok(isFinite(S.rayleighSep(0, 550)), 'a zero aperture does not divide by zero');
});
test('DISC_PITCH: the discs get finer, and a Blu-ray cannot throw a red first order', () => {
  const d = S.DISC_PITCH.map(x => x.d);
  for (let i = 1; i < d.length; i++) assert.ok(d[i] < d[i - 1], 'the ladder is not descending');
  assert.equal(S.DISC_PITCH[0].d, 1600, 'a CD track pitch is 1.6 µm');
  assert.equal(S.DISC_PITCH[1].d, 740,  'a DVD track pitch is 0.74 µm');
  /* THE CLAIM IN THE COMMENT, CHECKED. The grating equation is
     (sinθd − sinθi) = mλ/d, and the left side cannot exceed 2 however you hold
     the disc. So an order exists only when mλ ≤ 2d — which a CD manages for
     every visible wavelength and a Blu-ray, at 320 nm, does not manage for red
     at all. That is why one of them is a rainbow and the other is a sheen. */
  const orders = (pitch, nm) => Math.floor(2 * pitch / nm);
  assert.ok(orders(1600, 700) >= 4, 'a CD should throw several orders of red');
  assert.ok(orders(740, 700) >= 2, 'a DVD should throw at least two');
  assert.equal(orders(320, 700), 0, 'a Blu-ray cannot diffract 700 nm at any angle');
  assert.ok(orders(320, 450) >= 1, '…but it can still just manage blue');
});

// ------------------------------------------------------------ the soap film

test('FILM_R0: two per cent a face, eight per cent a film', () => {
  assert.ok(Math.abs(S.FILM_R0 - 0.02) < 0.001, `one interface reflects ${S.FILM_R0}, not ~2%`);
  assert.ok(Math.abs(4 * S.FILM_R0 - 0.08) < 0.004, 'a bright fringe is ~8%, which is as bright as a film gets');
  assert.ok(S.FILM_N > 1.3 && S.FILM_N < 1.36, 'soapy water is water');
});
test('the black film: as the top thins, every wavelength cancels together', () => {
  // R(λ) = 4·R0·sin²(2π n h / λ). This is the formula the shader runs, and the
  // property that matters is that it goes to zero at EVERY λ at once — which is
  // what makes the band black rather than merely dark, or worse, coloured.
  const R = (h, nm) => 4 * S.FILM_R0 * Math.pow(Math.sin(2 * Math.PI * S.FILM_N * h / nm), 2);
  for (const nm of [420, 480, 550, 620, 680]){
    assert.ok(R(5, nm) < 1e-3, `a 5 nm Newton black film still reflects ${nm} nm`);
    assert.ok(R(30, nm) < 0.03, `a 30 nm common black film is still bright at ${nm} nm`);
  }
  /* AND IT GOES BLUE ON THE WAY OUT, which is the detail that makes the band
     read right. Cancellation is not simultaneous: δ = 4πnh/λ is LARGER at
     short wavelengths, so at a given small thickness the blue is furthest from
     zero and the red is closest. A draining film goes straw, then grey, then
     faintly blue-grey, then black — in that order, because of this. */
  assert.ok(R(30, 420) > R(30, 680) * 2, 'the last colour out of a thinning film should be blue');
  assert.ok(R(5, 420) > R(5, 680), '…and it is still true right down at the Newton film');
  // and a first-order fringe really is loud
  const peak = 550 / (4 * S.FILM_N);            // quarter wave: the brightest thickness
  assert.ok(R(peak, 550) > 0.075, 'the quarter-wave fringe should be at the 8% ceiling');
});
test('FILM_AGES: every state is a real film, thin at the top', () => {
  for (const a of S.FILM_AGES){
    assert.ok(a.top < a.bot, `${a.name} is thicker at the top than the bottom — that is not drainage`);
    assert.ok(a.top > 0 && a.bot < 4000);
  }
  const tops = S.FILM_AGES.map(a => a.top);
  for (let i = 1; i < tops.length; i++) assert.ok(tops[i] < tops[i - 1], 'the ages do not age');
});
test('filmState: the label follows the film, not the roll', () => {
  assert.equal(S.filmState(8), 'BLACK FILM');
  assert.equal(S.filmState(89), 'BLACK FILM');
  assert.equal(S.filmState(90), 'DRAINING');
  assert.equal(S.filmState(299), 'DRAINING');
  assert.equal(S.filmState(300), 'NEW FILM');
  assert.equal(S.filmState(1500), 'NEW FILM');
  assert.equal(S.filmState(0), 'BLACK FILM', 'nothing left is the blackest film there is');
  assert.equal(S.filmState(NaN), 'BLACK FILM', 'and junk does not produce an undefined label');
  // every rolled state must be able to announce itself correctly on arrival
  for (const a of S.FILM_AGES) assert.equal(S.filmState(a.top), a.name, `${a.name} mislabels itself`);
});

// ------------------------------------------------- the tangles and the ground

test('LORENZ / THOMAS: the published constants, unrounded', () => {
  assert.equal(S.LORENZ.sigma, 10);
  assert.equal(S.LORENZ.rho, 28, 'ρ=28 is where the attractor is — 24.74 is where it starts');
  assert.ok(Math.abs(S.LORENZ.beta - 8 / 3) < 1e-12);
  assert.ok(Math.abs(S.THOMAS_B - 0.1998) < 1e-9, 'b=0.1998 is chaotic; 0.32 spirals to rest');
  const keys = S.FILAMENT_FORMS.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length, 'two tangles share a key');
  for (const f of S.FILAMENT_FORMS) assert.ok(f.name && f.name === f.name.toUpperCase());
});
test('TERRAIN_FORMS: four grounds out of one pipeline', () => {
  const keys = S.TERRAIN_FORMS.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length, 'two grounds share a key');
  for (const f of S.TERRAIN_FORMS){
    assert.ok(f.ridged >= 0 && f.ridged <= 1, `${f.key} ridged is a blend, not a scale`);
    assert.ok(f.step === 0 || f.step >= 2, `${f.key} would terrace into one step`);
  }
  assert.equal(S.TERRAIN_FORMS.filter(f => f.water > -1).length, 1, 'exactly one ground is flooded');
  assert.equal(S.TERRAIN_FORMS.filter(f => f.step > 0).length, 1, 'exactly one ground is terraced');
  const dune = S.TERRAIN_FORMS.find(f => f.key === 'dune');
  assert.equal(dune.ridged, 0, 'dunes are plain fBm — creasing them would make them mountains');
  assert.equal(S.TERRAIN_FORMS.find(f => f.key === 'ridge').ridged, 1, 'ridges are fully creased');
});

/* ------------------------------------------------- the eigenstate room

   The claim on the marquee is "mathematically rigorous", so the tests are the
   ones a numerical-methods examiner would set. The solver must land on a
   spectrum KNOWN IN CLOSED FORM (an anisotropic oscillator — ω_y/ω_x = √2 is
   irrational, so every level is non-degenerate and Lanczos has no excuse);
   the states it returns must be orthonormal and carry small residuals; and
   the production double well must show the physics the room is built to
   teach: a tunnelling doublet, symmetric below antisymmetric. */

test('eigensolver: the anisotropic oscillator ladder, against the closed form', () => {
  const wy = Math.SQRT2;
  const r = S.eigenSolve({
    n: 48, l: 12, k: 8, iters: 150, seed: 7,
    potential: (x, y) => 0.5 * (x * x + 2 * y * y),   // ω_x = 1, ω_y = √2
  });
  const exact = [];
  for (let nx = 0; nx < 7; nx++)
    for (let ny = 0; ny < 7; ny++) exact.push((nx + 0.5) + wy * (ny + 0.5));
  exact.sort((a, b) => a - b);
  assert.equal(r.E.length, 8);
  for (let i = 0; i < 8; i++){
    assert.ok(Math.abs(r.E[i] - exact[i]) / exact[i] < 0.02,
      `E${i} = ${r.E[i].toFixed(4)}, analytic ${exact[i].toFixed(4)} — off by more than the grid explains`);
    if (i) assert.ok(r.E[i] >= r.E[i - 1], 'the ladder is sorted');
  }
});

test('eigensolver: the pairs it returns actually solve the equation', () => {
  const r = S.eigenSolve({
    n: 40, l: 12, k: 6, iters: 130, seed: 11,
    potential: (x, y) => 0.5 * (x * x + 2 * y * y),
  });
  for (let i = 0; i < r.E.length; i++)
    assert.ok(r.res[i] < 1e-3, `state ${i} residual ${r.res[i]} — not converged`);
  for (let i = 0; i < r.psi.length; i++)
    for (let j = 0; j <= i; j++){
      const d = S.eigenDot(r.psi[i], r.psi[j]);
      assert.ok(Math.abs(d - (i === j ? 1 : 0)) < 1e-5, `⟨ψ${i}|ψ${j}⟩ = ${d}`);
    }
});

test('the double well: a tunnelling doublet over a symmetric ground state', () => {
  const r = S.eigenSolve(S.EIGEN);
  const n = S.EIGEN.n;
  assert.equal(r.E.length, S.EIGEN.k);
  for (let i = 1; i < r.E.length; i++) assert.ok(r.E[i] >= r.E[i - 1], 'sorted');
  assert.ok(r.E[r.E.length - 1] < 0, 'every kept state is BOUND — the room never shows continuum junk');
  for (let i = 0; i < r.E.length; i++) assert.ok(r.res[i] < 5e-3, `state ${i} residual ${r.res[i]}`);
  // the signature of tunnelling: the lowest two levels are a DOUBLET, split
  // far more finely than the gap to the next shell above them
  const split = r.E[1] - r.E[0], gap = r.E[2] - r.E[1];
  assert.ok(split > 0, 'the doublet is split — no barrier is not the lesson');
  assert.ok(split < gap * 0.25, `doublet split ${split.toFixed(3)} should be well under the shell gap ${gap.toFixed(3)}`);
  // ψ₀ even under x → −x, ψ₁ odd — which is WHY their sum sits in one well
  let mx = 0;
  for (let i = 0; i < n * n; i++) mx = Math.max(mx, Math.abs(r.psi[0][i]));
  let evenErr = 0, oddErr = 0;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++){
      const a0 = r.psi[0][j * n + i], b0 = r.psi[0][j * n + (n - 1 - i)];
      const a1 = r.psi[1][j * n + i], b1 = r.psi[1][j * n + (n - 1 - i)];
      evenErr = Math.max(evenErr, Math.abs(a0 - b0));
      oddErr = Math.max(oddErr, Math.abs(a1 + b1));
    }
  assert.ok(evenErr < mx * 0.05, `ψ₀ should be symmetric (err ${evenErr}, peak ${mx})`);
  assert.ok(oddErr < mx * 0.05, `ψ₁ should be antisymmetric (err ${oddErr})`);
  // and the ground state has no nodes: one sign everywhere that matters
  let lo = 0, hi = 0;
  for (let i = 0; i < n * n; i++){ lo = Math.min(lo, r.psi[0][i]); hi = Math.max(hi, r.psi[0][i]); }
  assert.ok(Math.min(-lo, hi) < 0.02 * Math.max(-lo, hi), 'ψ₀ crosses zero — a ground state never does');
});

test('eigenOccupation: the music may excite the particle but never clone it', () => {
  const e = Array.from({ length: S.EIGEN.k }, (_, i) => i / (S.EIGEN.k - 1));
  const sum = w => w.reduce((a, b) => a + b, 0);
  for (const L of S.EIGEN_LESSONS)
    for (const f of [{}, { energy: 1, centroid: 1, treble: 1 }, { bass: 1 }, { energy: 0.4, act: 0.9 }]){
      const w = S.eigenOccupation(L.key, f, e);
      assert.ok(Math.abs(sum(w) - 1) < 1e-9, `${L.key}: Σ|cₙ|² = ${sum(w)} — unitarity is not optional`);
      for (const x of w) assert.ok(x >= 0 && isFinite(x), `${L.key}: a negative probability`);
    }
  // the doublet lesson is a genuine two-state system…
  const t = S.eigenOccupation('tunnel', { bass: 0.8 }, e);
  assert.ok(t[0] + t[1] === 1 && sum(t.slice(2)) === 0, 'tunnel keeps ALL probability in the doublet');
  assert.ok(Math.min(t[0], t[1]) >= 0.34, 'and never lets one branch die — no beat, no lesson');
  // …and the hot band actually gets hot: a loud bright moment lifts the ladder
  const cold = S.eigenOccupation('band', { energy: 0, centroid: 0 }, e);
  const hot = S.eigenOccupation('band', { energy: 1, centroid: 1, treble: 1 }, e);
  assert.ok(sum(hot.slice(2)) > sum(cold.slice(2)) * 2, 'loud and bright should boil the particle upward');
  assert.ok(cold[0] > 0.5, 'a quiet passage cools it into the ground state');
});

test('eigenTimeUnit: one clock, chosen so each lesson is watchable', () => {
  const e = [0, 0.006, 0.4, 1];
  const Wt = S.eigenTimeUnit('tunnel', e);
  // the doublet beats at 2π/7s BY CONSTRUCTION, whatever the raw splitting is
  assert.ok(Math.abs((e[1] - e[0]) * Wt - 2 * Math.PI / 7) < 1e-9 || Wt === 500,
    'the tunnelling period is pinned near 7 s (or the safety cap engaged)');
  assert.ok(S.eigenTimeUnit('band', e) > 0 && S.eigenTimeUnit('band', e) < 10, 'the band clock is sane');
  assert.ok(S.eigenTimeUnit('tunnel', [0]) > 0, 'a degenerate input still returns a clock');
  const keys = S.EIGEN_LESSONS.map(l => l.key);
  assert.equal(new Set(keys).size, 3, 'three lessons, three keys');
});

// ------------------------------------------------- how one room becomes the next

test('segueFx: every answer is a real transition, at every input', () => {
  const OK = S.XFORM_KINDS.concat(['dissolve']);
  for (const kind of ['cut', 'morph', 'dissolve', undefined, 'nonsense'])
    for (const energy of [0, 0.29, 0.3, 0.6, 1])
      for (const last of [''].concat(OK))
        for (let i = 0; i <= 20; i++){
          const k = S.segueFx({ kind, energy, last, r: i / 20 });
          assert.ok(OK.includes(k), `${kind}/${energy}/${i} → ${k}`);
        }
  assert.ok(OK.includes(S.segueFx()), 'no arguments at all still returns something drawable');
});
test('segueFx: reduced motion is answered with a crossfade, always', () => {
  // this is the whole accessibility contract for the feature: not a slower
  // shatter, not a dimmer one — no manufactured large-field motion at all
  for (const kind of ['cut', 'morph', 'dissolve'])
    for (let i = 0; i <= 20; i++)
      assert.equal(S.segueFx({ kind, energy: 1, r: i / 20, reduced: true }), 'dissolve');
});
test('segueFx: nothing in the vocabulary draws an edge', () => {
  /* THE DESIGN RULE, AS AN ASSERTION. Every form that got cut from this list
     did so for the same reason: a grid of shards, an opening aperture and a
     travelling shockwave are all legible in a single frame, and what they are
     legible AS is "a transition" — which is the one thing the field must never
     look like. This test does not stop someone re-adding them; it makes doing
     so a deliberate act with a failing test attached. */
  for (const gone of ['shatter', 'iris', 'ripple', 'streak', 'wipe', 'slide'])
    assert.ok(!S.XFORM_KINDS.includes(gone), `${gone} draws an edge and does not belong here`);
  /* …and when fronts of light DID come — asked for by name — they came under
     this rule's terms: CHERENKOV, AURORA and EMBER all hide their handover on
     a wide dithered band inside the glow (LUMA's bargain, lit), so there is a
     wall of light but never a line a ruler could find. The names above stay
     banned because they are geometry with nothing to hide in. */
  for (const lit of ['cherenkov', 'aurora', 'ember', 'sprite', 'eclipse'])
    assert.ok(S.XFORM_KINDS.includes(lit), `${lit} belongs to the vocabulary now`);
  assert.equal(new Set(S.XFORM_KINDS).size, S.XFORM_KINDS.length, 'a form is listed twice');
});
test('cherenkovRGB: the reactor pool is blue because 1/λ² says so', () => {
  const c = S.cherenkovRGB();
  assert.equal(c.b, 1, 'normalised to its brightest channel — which had better be blue');
  assert.ok(c.g < c.b && c.r < c.g, `blue over green over red, got ${JSON.stringify(c)}`);
  assert.ok(c.r >= 0 && c.g >= 0, 'no negative light');
  assert.deepEqual(S.cherenkovRGB(), c, 'the physics does not roll dice');
});
test('segueFx: a drop gets a drop’s transition, a quiet room gets a quiet one', () => {
  const draw = o => { const out = new Set(); for (let i = 0; i <= 60; i++) out.add(S.segueFx({ ...o, r: i / 60 })); return out; };
  const cut = draw({ kind: 'cut', energy: 0.9 });
  // a drop has to get SOMETHING, and it has to be something that survives being
  // over in half a second — the long forms and the plain crossfade both fail that
  for (const slow of ['scatter', 'aerial', 'fold', 'luma', 'dissolve'])
    assert.ok(!cut.has(slow), `a drop must never draw ${slow}`);
  assert.ok(cut.has('defocus'), 'the rack focus is the drop’s sharpest tool and is not being reached');

  const quiet = draw({ kind: 'dissolve', energy: 0.1 });
  assert.ok(quiet.has('dissolve'), 'the plain crossfade has to keep coming up');
  assert.ok(quiet.has('aurora'), 'a quiet passage may get the sky');
  assert.ok(quiet.has('eclipse'), '…or totality, which is the quietest event there is');
  for (const quick of ['prism', 'refract', 'scatter', 'cherenkov', 'sprite'])
    assert.ok(!quiet.has(quick), `a quiet passage does not need ${quick}`);

  // a section turn is one room BECOMING another; the incidental forms are not that
  const morph = draw({ kind: 'morph', energy: 0.6 });
  for (const incidental of ['prism', 'refract', 'defocus'])
    assert.ok(!morph.has(incidental), `a section turn is not ${incidental}`);
  assert.ok(morph.has('scatter') && morph.has('dissolve'));
});
test('segueFx: never the same form twice in a row', () => {
  // the second shatter in a row is the one that starts to look like a screensaver
  for (const kind of ['cut', 'morph', 'dissolve'])
    for (const energy of [0.1, 0.5, 0.95])
      for (let i = 0; i <= 60; i++){
        const first = S.segueFx({ kind, energy, r: i / 60 });
        assert.notEqual(S.segueFx({ kind, energy, r: i / 60, last: first }), first,
          `${kind} repeated ${first}`);
      }
});
test('segueFxDur: a form is never given less time than it needs to read', () => {
  for (const k of S.XFORM_KINDS){
    assert.ok(S.XFORM_MIN_DUR[k] > 0, `${k} has no floor`);
    assert.equal(S.segueFxDur(k, 0.05), S.XFORM_MIN_DUR[k], `${k} was allowed to flash past`);
    assert.equal(S.segueFxDur(k, 2.0), 2.0, 'a duration the music asked for survives');
    assert.equal(S.segueFxDur(k, 900), 5, 'and nothing runs for fifteen minutes');
    assert.ok(isFinite(S.segueFxDur(k, NaN)), 'junk does not become a NaN duration');
  }
  // SCATTER is the slowest for a reason: every grain has to leave AND arrive
  assert.ok(S.XFORM_MIN_DUR.scatter > S.XFORM_MIN_DUR.prism);
  /* AND NOTHING HERE IS A FLASH. A transition that needs to be under half a
     second to work is a transition doing something drastic, and drastic is the
     thing this vocabulary exists to avoid. */
  for (const k of S.XFORM_KINDS)
    assert.ok(S.XFORM_MIN_DUR[k] >= 0.5, `${k} is fast enough to read as a glitch`);
});

/* ---- loadAndLandAt: resuming lands where it was asked to ----
   Modelled on the iOS media element, whose one relevant behaviour is that a
   currentTime written while readyState is HAVE_NOTHING is DROPPED rather than
   remembered. That single quirk is what made a weak-signal blip, a stall
   recovery and a boot restore all silently restart the track from zero. */
function iosEl(metaDelay = 5, failAfter = 0){
  return {
    readyState: 0, duration: NaN, src: '', _ct: 0, L: {}, loads: 0,
    get currentTime(){ return this._ct; },
    set currentTime(v){ if (this.readyState === 0) return; this._ct = v; },   // the quirk
    addEventListener(t, fn){ (this.L[t] = this.L[t] || []).push(fn); },
    removeEventListener(t, fn){ this.L[t] = (this.L[t] || []).filter(f => f !== fn); },
    emit(t){ (this.L[t] || []).slice().forEach(f => f()); },
    load(){
      this.loads++; this.readyState = 0; this._ct = 0; this.duration = NaN;
      if (failAfter){ setTimeout(() => this.emit('error'), failAfter); return; }
      if (metaDelay === Infinity) return;                    // a load that never resolves
      setTimeout(() => { this.readyState = 1; this.duration = 200; this.emit('loadedmetadata'); }, metaDelay);
    },
  };
}
const landed = (el, at, opts = {}) => new Promise(res =>
  S.loadAndLandAt(el, opts.url === undefined ? 'x.mp3' : opts.url, at, ok => res(ok)));

test('loadAndLandAt: the seek waits for metadata instead of being dropped', async () => {
  const el = iosEl();
  // what the code used to do, for contrast: the position is simply lost
  const old = iosEl();
  old.src = 'x.mp3'; old.load(); old.currentTime = 120.5;
  assert.equal(old.currentTime, 0, 'the old pattern lands at zero — this is the bug');
  assert.equal(await landed(el, 120.5), true);
  assert.equal(el.currentTime, 120.5, 'the track resumes where the listener was');
});
test('loadAndLandAt: a position past the end is clamped, never onto the end', async () => {
  const el = iosEl();
  await landed(el, 9999);
  // landing exactly on duration fires 'ended' and skips the track
  assert.ok(el.currentTime < el.duration, 'a clamped resume must not end the track');
  assert.equal(el.currentTime, 199.75);
});
test('loadAndLandAt: a position of zero seeks nothing', async () => {
  const el = iosEl();
  await landed(el, 0);
  assert.equal(el.currentTime, 0);
});
test('loadAndLandAt: an empty url reloads what is loaded — the watchdog case', async () => {
  const el = iosEl();
  el.src = 'already.mp3';
  await landed(el, 42, { url: '' });
  assert.equal(el.src, 'already.mp3', 'the watchdog must not re-point the element');
  assert.equal(el.loads, 1, 'it still reloads');
  assert.equal(el.currentTime, 42);
});
test('loadAndLandAt: a failed load still reports back', async () => {
  assert.equal(await landed(iosEl(5, 3), 60), false, 'error must resolve, not hang');
});
test('loadAndLandAt: done fires exactly once, whatever the element does', async () => {
  const el = iosEl();
  let n = 0;
  await new Promise(res => S.loadAndLandAt(el, 'x.mp3', 30, () => { n++; res(); }));
  el.emit('loadedmetadata'); el.emit('error'); el.emit('loadedmetadata');
  assert.equal(n, 1, 'a caller holding playback back must be released once and only once');
});

// ---- watchdogStep: a track that goes quiet mid-play is always brought back ----
const wdState = () => ({ lastT: -1, lastBuf: -1, stall: 0, starve: 0, heals: 0 });
const wdRun = (s, frames) => frames.map(f => S.watchdogStep(s, Object.assign({ played: true, online: true }, f)));
test('watchdogStep: a clock that moves is healthy', () => {
  const s = wdState();
  const v = wdRun(s, [{ t: 10, buf: 30, rs: 4 }, { t: 11, buf: 30, rs: 4 }, { t: 12, buf: 30, rs: 4 }]);
  assert.deepEqual(v, ['ok', 'ok', 'ok']);
});
test('watchdogStep: frozen with data — nudge at 3 s, reload at 7 s', () => {
  const s = wdState();
  const v = wdRun(s, Array.from({ length: 8 }, () => ({ t: 50, buf: 80, rs: 4 })));
  assert.equal(v[0], 'ok');
  assert.equal(v[3], 'nudge');
  assert.equal(v[7], 'reload');
});
test('watchdogStep: a stream starved mid-track is healed, not left spinning — the cheap heal first', () => {
  const s = wdState();
  wdRun(s, [{ t: 91, buf: 91, rs: 4 }]);            // playing, then the bytes stop
  const v = wdRun(s, Array.from({ length: S.STARVE_RELOAD_S }, () => ({ t: 91, buf: 91, rs: 2 })));
  assert.equal(v[v.length - 1], 'reseek', 'the old watchdog waved readyState < 3 through forever; the first heal is a reseek, never the reload');
  assert.ok(v.slice(0, -1).every(x => x === 'wait'));
  // …and only a further STARVE_RESEEK_S seconds with nothing new earn the hard reload
  const w = wdRun(s, Array.from({ length: S.STARVE_RESEEK_S }, () => ({ t: 91, buf: 91, rs: 2 })));
  assert.ok(w.slice(0, -1).every(x => x === 'wait'), 'no reload inside the reseek window: ' + w.join(','));
  assert.equal(w[w.length - 1], 'reload');
  assert.equal(s.heals, 1, 'reseeks do not spend the give-up budget; reloads do');
});
test('watchdogStep: growth after the reseek is a cured stream — the count starts over, no reload', () => {
  const s = wdState();
  wdRun(s, [{ t: 91, buf: 91, rs: 4 }]);
  const v = wdRun(s, Array.from({ length: S.STARVE_RELOAD_S }, () => ({ t: 91, buf: 91, rs: 2 })));
  assert.equal(v[v.length - 1], 'reseek');
  assert.equal(wdRun(s, [{ t: 91.001, buf: 93, rs: 2 }])[0], 'ok', 'the fresh ranged request is landing: a slow pipe, never a dead one');
  assert.equal(s.heals, 0);
  // a second starvation is judged from scratch: twelve seconds, then a reseek again — not a reload
  const w = wdRun(s, Array.from({ length: S.STARVE_RELOAD_S }, () => ({ t: 91.001, buf: 93, rs: 2 })));
  assert.equal(w.filter(x => x === 'reload').length, 0);
  assert.equal(w[w.length - 1], 'reseek');
});
test('watchdogStep: a starved buffer that is still GROWING is a slow pipe, never reloaded', () => {
  const s = wdState();
  const v = wdRun(s, Array.from({ length: 40 }, (_, k) => ({ t: 91, buf: 91 + k * 0.2, rs: 2 })));
  assert.ok(v.every(x => x === 'ok'));
});
test('watchdogStep: before the track is under way the start backstop owns the wait', () => {
  const s = wdState();
  const v = wdRun(s, Array.from({ length: 40 }, () => ({ t: 0, buf: 0, rs: 1, played: false })));
  assert.ok(v.every(x => x === 'ok'), 'a reload before the first sound restarts the download forever');
});
test('watchdogStep: offline, a starved deck waits without spending its budget', () => {
  const s = wdState();
  const v = wdRun(s, Array.from({ length: 100 }, () => ({ t: 91, buf: 91, rs: 2, online: false })));
  assert.ok(v.every(x => x === 'ok' || x === 'wait'));
  assert.equal(s.heals, 0);
});
test('watchdogStep: a track that keeps starving with no motion is skipped so the set goes on', () => {
  const s = wdState();
  // each round is a reseek, then — nothing having come of it — a reload
  const n = (S.STARVE_RELOAD_S + S.STARVE_RESEEK_S) * (S.STARVE_GIVE_UP + 1);
  const v = wdRun(s, Array.from({ length: n + 1 }, () => ({ t: 91, buf: 91, rs: 2 })));
  assert.equal(v.filter(x => x === 'reseek').length, S.STARVE_GIVE_UP + 1);
  assert.equal(v.filter(x => x === 'reload').length, S.STARVE_GIVE_UP);
  assert.equal(v.filter(x => x === 'skip').length, 1);
});
test('watchdogStep: motion after a reload refills the give-up budget', () => {
  const s = wdState();
  wdRun(s, Array.from({ length: S.STARVE_RELOAD_S + S.STARVE_RESEEK_S + 1 }, () => ({ t: 91, buf: 91, rs: 2 })));
  assert.equal(s.heals, 1);
  wdRun(s, [{ t: 92, buf: 100, rs: 4 }]);
  assert.equal(s.heals, 0);
});

// ---------------------------------------------------------------- language packs
/* every docs/lang/*.json is held to the golden schema (es.json's key set,
   which IS the exact English the player emits): complete coverage, intact
   {placeholders} and HTML tags, CLDR-shaped plural objects, echo pools
   index-aligned with the English pools above. The doctor is the shared
   implementation, so the CLI report and this gate can never disagree. */
test('every language pack passes the i18n doctor', async () => {
  const { runDoctor } = await import('../tools/i18n_doctor.mjs');
  const { errs, files } = runDoctor();
  assert.ok(files.includes('es.json'), 'the golden pack exists');
  assert.deepEqual(errs, [], errs.slice(0, 5).join('\n'));
});

// ---------------------------------------------------------------- the reusable engine
/* i18n/engine.js is the extractable form of the player's inlined @i18n
   block, for sibling products (Echoes of Play). The player keeps its own
   copy so it stays one file; these tests hold the two to the same behavior
   so they can never drift apart in silence. */
const I18NB = new Function('"use strict";' + block('i18n') + '\nreturn { LANGS, I18N_ALIAS, I18N, T, TN };')();
test('engine and player resolve T() and plural objects identically', async () => {
  const { createI18n } = await import('../i18n/engine.js');
  const eng = createI18n({ langs: I18NB.LANGS, aliases: I18NB.I18N_ALIAS });
  const dict = {
    '@meta': { code: 'ru', name: 'Русский', en: 'Russian' },
    'Play': 'Играть', 'FLAME': 'ПЛАМЯ', 'SLITS': 'ЩЕЛИ',
    'Saved <b>{name}</b>': 'Сохранено <b>{name}</b>',
    '{n} tracks': { one: '{n} трек', few: '{n} трека', many: '{n} треков', other: '{n} трека' },
  };
  I18NB.I18N._install('ru', dict);
  eng.I18N._install('ru', dict);
  for (const n of [1, 2, 5, 11, 21, 101])
    assert.equal(eng.T('{n} tracks', { n }), I18NB.T('{n} tracks', { n }), 'plural parity at n=' + n);
  assert.equal(eng.T('{n} tracks', { n: 3 }), '3 трека', 'CLDR few-form via Intl.PluralRules');
  assert.equal(eng.T('Saved <b>{name}</b>', { name: 'x' }), I18NB.T('Saved <b>{name}</b>', { name: 'x' }));
  assert.equal(eng.TN('FLAME · 7 SLITS'), I18NB.TN('FLAME · 7 SLITS'), 'TN segment parity');
  assert.equal(eng.TN('FLAME · 7 SLITS'), 'ПЛАМЯ · 7 ЩЕЛИ', 'numeric-prefix segments translate');
  assert.equal(eng.I18N.dir, I18NB.I18N.dir, 'direction parity');
});
test('engine honours @meta.dir even without a registry hint', async () => {
  const { createI18n } = await import('../i18n/engine.js');
  const eng = createI18n({ langs: [{ code: 'en', name: 'English', en: 'English' }, { code: 'xx', name: 'X', en: 'X' }] });
  eng.I18N._install('xx', { '@meta': { code: 'xx', name: 'X', en: 'X', dir: 'rtl' } });
  assert.equal(eng.I18N.dir, 'rtl', 'the pack itself may declare rtl');
});
test('engine detect() walks ordered languages with prefix and alias mapping', async () => {
  const { createI18n } = await import('../i18n/engine.js');
  const eng = createI18n({ langs: I18NB.LANGS, aliases: I18NB.I18N_ALIAS });
  const withNav = (langs, fn) => {
    const d = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try { Object.defineProperty(globalThis, 'navigator', { value: { languages: langs }, configurable: true }); }
    catch (e){ return; }                                // navigator pinned: skip, other asserts still hold
    try { fn(); } finally { d ? Object.defineProperty(globalThis, 'navigator', d) : delete globalThis.navigator; }
  };
  withNav(['pt-BR', 'en'], () => {
    assert.equal(eng.I18N.detect(), 'pt', 'pt-BR negotiates to pt');
    assert.equal(I18NB.I18N.detect(), 'pt', 'and the player agrees');
  });
  withNav(['tl-PH', 'en'], () => {
    assert.equal(eng.I18N.detect(), 'fil', "Android's 'tl' finds Filipino");
    assert.equal(I18NB.I18N.detect(), 'fil', 'and the player agrees');
  });
  withNav(['xx', 'yy'], () => assert.equal(eng.I18N.detect(), 'en', 'nothing carried → English'));
});
test('engine echoSignals matches the tested player implementation', async () => {
  const eng = await import('../i18n/engine.js');
  for (const s of ['am I lost?', 'six small words land here', 'x '.repeat(45), 'feeling grateful tonight', 'plain note', ''])
    assert.deepEqual(eng.echoSignals(s), S.echoSignals(s), JSON.stringify(s.slice(0, 20)));
});
test('engine echoComposeFrom deals pools by shape, widened by the pack feel regex', async () => {
  const { echoComposeFrom } = await import('../i18n/engine.js');
  const pools = {
    ack: { q: ['Q'], short: ['S'], long: ['L'], feel: ['F'], plain: ['P'] },
    frags: ['fr1', 'fr2'], turn: ['t1'], feel: '(?:^|[^A-Za-z])(triste)(?=[^A-Za-z]|$)',
  };
  const rng = () => 0;
  assert.equal(echoComposeFrom(pools, '¿dónde estoy?', rng).ack, 'Q', 'a question is a question in any tongue');
  assert.equal(echoComposeFrom(pools, 'hoy me siento muy triste de verdad otra vez', rng).ack, 'F', "the pack's own feeling words register");
  assert.equal(echoComposeFrom(pools, 'palabras neutrales sin sentimiento aparente aqui mismo', rng).ack, 'P');
  assert.equal(echoComposeFrom(null, 'x', rng), null, 'no pools → null, the caller keeps its English path');
});
test('the ES5 engine build matches the module engine, behavior for behavior', async () => {
  const { createRequire } = await import('module');
  const es5 = createRequire(import.meta.url)('../i18n/engine.es5.js');
  const mod = await import('../i18n/engine.js');
  const langs = [{ code: 'en', name: 'English', en: 'English' }, { code: 'ru', name: 'Русский', en: 'Russian' }];
  const dict = {
    '@meta': { code: 'ru', name: 'Русский', en: 'Russian' },
    'Enter': 'Войти', 'FLAME': 'ПЛАМЯ', 'SLITS': 'ЩЕЛИ',
    '{n} tracks': { one: '{n} трек', few: '{n} трека', many: '{n} треков', other: '{n} трека' },
  };
  const a = mod.createI18n({ langs, onApply: () => {} });
  const b = es5.createI18n({ langs, onApply: () => {} });
  a.I18N._install('ru', dict);
  b.I18N._install('ru', dict);
  for (const n of [1, 3, 15, 21]) assert.equal(b.T('{n} tracks', { n }), a.T('{n} tracks', { n }), 'plural parity n=' + n);
  assert.equal(b.T('Enter'), a.T('Enter'));
  assert.equal(b.TN('FLAME · 7 SLITS'), a.TN('FLAME · 7 SLITS'));
  assert.equal(b.I18N.dir, a.I18N.dir);
  for (const s of ['am I lost?', 'grateful tonight and here', 'plain words', ''])
    assert.deepEqual(es5.echoSignals(s), mod.echoSignals(s), 'echoSignals parity');
  const pools = { ack: { q: ['Q'], short: ['S'], long: ['L'], feel: ['F'], plain: ['P'] }, frags: ['f'], turn: ['t'] };
  assert.equal(es5.echoComposeFrom(pools, 'why me?', () => 0).ack, mod.echoComposeFrom(pools, 'why me?', () => 0).ack);
});
test('inline dictionaries install synchronously with no fetch and no mirror', async () => {
  const { createRequire } = await import('module');
  for (const eng of [await import('../i18n/engine.js'), createRequire(import.meta.url)('../i18n/engine.es5.js')]){
    let applied = 0;
    const dict = { '@meta': { code: 'es', name: 'Español', en: 'Spanish' }, 'Enter': 'Entrar' };
    const i = eng.createI18n({
      langs: [{ code: 'en', name: 'English', en: 'English' }, { code: 'es', name: 'Español', en: 'Spanish' }],
      dicts: { es: dict },
      storageKey: 'x_no_such_key',
      onApply: () => { applied++; },
    });
    // no localStorage and no navigator match in Node: force the choice, then init
    i.I18N.set = () => {};
    i.I18N.stored = () => 'es';
    i.I18N.init();                                  // must complete synchronously
    assert.equal(applied, 1, 'applied in the same tick');
    assert.equal(i.T('Enter'), 'Entrar', 'inline dictionary is live');
    assert.equal(await i.I18N.prefetch('es'), true, 'prefetch of an inline pack is a no-op success');
    const d = await i.I18N.fetchDict('es');
    assert.equal(d['Enter'], 'Entrar', 'fetchDict serves the inline pack without touching the network');
  }
});
test('the generalized doctor holds every shipped pack to the golden contract', async () => {
  const { runDoctor } = await import('../i18n/doctor.mjs');
  const { errs, files } = runDoctor(new URL('../docs/lang', import.meta.url).pathname, 'es', null);
  assert.ok(files.includes('es.json'), 'the golden pack exists');
  assert.deepEqual(errs, [], errs.slice(0, 5).join('\n'));
});

// ---------------------------------------------------------------- @master — the last hand on the signal
{
  const sr = 48000;
  const sine = (amp, hz, n, ph) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / sr + (ph || 0)));
  const run = (st, l, r, block) => {
    const n = l.length, ol = new Float32Array(n), or = new Float32Array(n);
    for (let i = 0; i < n; i += block){
      const m = Math.min(block, n - i);
      S.limiterProcess(st, l.subarray(i, i + m), r.subarray(i, i + m), ol.subarray(i, i + m), or.subarray(i, i + m), m);
    }
    return [ol, or];
  };
  const truePeak = y => { let tp = 0; for (let i = 3; i < y.length; i++){ tp = Math.max(tp, Math.abs(y[i]), S.interPeak(y[i - 3], y[i - 2], y[i - 1], y[i])); } return tp; };
  test('limiter: below the ceiling it is a pure delay — bit-exact, gain untouched', () => {
    const st = S.makeLimiter(sr), n = 9600;
    const x = sine(0.5, 440, n), z = sine(0.7, 3100, n, 1);
    const [yl, yr] = run(st, x, z, 128);
    for (let i = st.L; i < n; i++){
      assert.equal(yl[i], x[i - st.L], 'left is the input, delayed by the lookahead');
      assert.equal(yr[i], z[i - st.L], 'right likewise');
    }
    assert.equal(st.gr, 1, 'no gain reduction was ever applied');
    assert.equal(st.over, 0, 'the rail was never touched');
    assert.equal(st.L, Math.round(S.LIMITER.lookaheadMs * 1e-3 * sr), 'the delay is the declared lookahead');
  });
  test('limiter: a +6 dB signal never crosses the ceiling, and the rail is a footnote', () => {
    const st = S.makeLimiter(sr), n = 48000;
    const x = sine(2.0, 220, n);
    const [y] = run(st, x, x, 128);
    let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
    assert.ok(pk <= st.ceil + 1e-6, 'peak ' + pk + ' vs ceiling ' + st.ceil);
    assert.ok(st.gr < 0.5, 'about 6 dB of reduction was applied: ' + st.gr);
    assert.ok(st.over < n * 0.01, 'the follower did the work, not the rail: ' + st.over + ' rail samples');
  });
  test('limiter: an inter-sample peak no sample carries is still caught', () => {
    // a sine at fs/4 with a π/4 phase: every sample sits at ±0.707·A while the waveform peaks at A
    const st = S.makeLimiter(sr), n = 9600, A = 1.15;
    const x = sine(A, sr / 4, n, Math.PI / 4);
    let spk = 0; for (const v of x) spk = Math.max(spk, Math.abs(v));
    assert.ok(spk < st.ceil, 'the samples themselves are under the ceiling: ' + spk);
    const [y] = run(st, x, x, 128);
    assert.ok(truePeak(y) <= st.ceil * 1.06, 'the reconstructed peak is held: ' + truePeak(y));
    assert.ok(st.gr < 0.9, 'gain was reduced for a peak between samples');
  });
  test('limiter: the state carries across block edges — 128-sample pieces equal one pass', () => {
    const n = 12000, x = sine(1.6, 330, n), z = sine(1.2, 3000, n, 1);
    const a = run(S.makeLimiter(sr), x, z, 128), b = run(S.makeLimiter(sr), x, z, n);
    for (let i = 0; i < n; i++){ assert.equal(a[0][i], b[0][i]); assert.equal(a[1][i], b[1][i]); }
  });
  test('limiter: stereo-linked — one gain for both sides, so the image never lurches', () => {
    const st = S.makeLimiter(sr), n = 9600;
    const loud = sine(2.0, 220, n), quiet = sine(0.2, 220, n);
    const [yl, yr] = run(st, loud, quiet, 128);
    // the quiet side is reduced by the loud side's gain: same ratio, held
    let ratio = null;
    for (let i = st.L + 4800; i < n; i++){
      const a = loud[i - st.L], b = quiet[i - st.L];
      if (Math.abs(a) > 1.5){ const r = yr[i] / yl[i]; assert.ok(Math.abs(r - b / a) < 1e-5, 'ratio preserved at ' + i); ratio = r; }
    }
    assert.ok(ratio != null, 'the check ran');
  });
  test('limiter: a hard step from silence arrives already tamed — no overshoot at the attack', () => {
    const st = S.makeLimiter(sr), n = 4800;
    const x = new Float32Array(n); for (let i = 2400; i < n; i++) x[i] = 1.9;
    const [y] = run(st, x, x, 128);
    let pk = 0; for (const v of y) pk = Math.max(pk, v);
    assert.ok(pk <= st.ceil + 1e-6, 'peak ' + pk);
    assert.equal(st.over, 0, 'the lookahead did it, not the rail');
  });
  test('limiter: lets go after the peak — gain back to unity within a few releases', () => {
    const st = S.makeLimiter(sr), n = 48000;
    const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = (i < 4800 ? 2.0 : 0.3) * Math.sin(2 * Math.PI * 440 * i / sr);
    run(st, x, x, 128);
    assert.ok(st.g > 0.999, 'recovered to ' + st.g);
  });
  test('limiter: the worklet module is the tested kernel, serialised', () => {
    const src = S.limiterWorkletSource();
    assert.ok(src.includes('function limiterProcess('), 'the kernel is in the module');
    assert.ok(src.includes("registerProcessor('mb8-limiter'"), 'it registers the processor');
    assert.ok(src.includes('"ceilingDb":' + S.LIMITER.ceilingDb), 'with the same tuning');
    // and it parses as a module — a worklet that fails to load is a limiter that is not there
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', src);
  });
  test('bandBins: the 44.1 k table is reproduced exactly, and 48 k lands on the same frequencies', () => {
    const a = S.bandBins(44100, 2048);
    assert.deepEqual([a.bass.lo, a.bass.hi, a.mid.lo, a.mid.hi, a.treble.lo, a.treble.hi, a.flux.lo, a.flux.hi],
      [1, 8, 9, 93, 94, 418, 1, 127], 'the bins the engine was tuned on');
    const b = S.bandBins(48000, 2048);
    const hz = (bins, sr) => bins * sr / 2048;
    assert.ok(Math.abs(hz(b.treble.hi, 48000) - hz(a.treble.hi, 44100)) < 30, 'the treble edge is a frequency, not a bin');
    assert.ok(b.mid.n < a.mid.n, 'fewer, wider bins at the higher rate');
    for (const k in b) assert.ok(b[k].hi < 1024 && b[k].lo >= 1, 'inside the analyser');
    const w = S.bandBins(96000, 2048);
    assert.ok(w.bass.n >= 1 && w.bass.lo >= 1, 'a very high rate still yields a band');
  });
}

// ---------------------------------------------------------------- the tape tears, the deck is asked
test('tapeTearStep: jitter is not a tear, a stall that drains is not a tear, a drop that stays is', () => {
  const B = 4096, SR = 44100, w = S.makeTearWatch();
  let at = 0, ct = 0, tears = [];
  // an ordinary event: one block of tape, one block of clock
  const step = lag => { const r = S.tapeTearStep(w, lag, at, ct, B); at += B; ct += B / SR; if (r != null) tears.push(r); };
  // a burst event: one block of tape at a FROZEN clock (a backlog draining)
  const burst = lag => { const r = S.tapeTearStep(w, lag, at, ct, B); at += B; if (r != null) tears.push(r); };
  const jit = [0.2, 0.6, 0.1, 0.9, 0.3, 0.7, 0.05, 0.5, 0.4, 0.8, 0.2, 0.3];
  for (let i = 0; i < 60; i++) step(B * (0.3 + jit[i % jit.length]));
  assert.deepEqual(tears, [], 'ordinary jitter never tears the tape');
  // a five-second stall: fifty-four blocks queue, then drain one per event at one clock time
  ct += 5.0;
  for (let k = 54; k >= 0; k--) burst(B * (k + 0.4));
  for (let i = 0; i < 60; i++) step(B * (0.3 + jit[i % jit.length]));
  assert.deepEqual(tears, [], 'a backlog that drains is not a hole, however long the stall');
  // a real drop: two blocks never arrive, so the lag rises by two and stays while the clock runs
  const dropAt = at;
  for (let i = 0; i < 12; i++) step(B * (2.3 + jit[i % jit.length]));
  assert.equal(tears.length, 1, 'one tear');
  assert.ok(Math.abs(tears[0] - dropAt) <= B, 'placed where the rise began (a jitter block early is fine): ' + tears[0] + ' vs ' + dropAt);
  assert.ok(w.base > B * 2, 'the floor moved up to the new lag');
  for (let i = 0; i < 40; i++) step(B * (2.3 + jit[i % jit.length]));
  assert.equal(tears.length, 1, 'the same jitter at the new floor is not another tear');
  const drop2 = at;
  for (let i = 0; i < 12; i++) step(B * (3.4 + jit[i % jit.length]));
  assert.equal(tears.length, 2); assert.ok(Math.abs(tears[1] - drop2) <= B);
  assert.equal(S.tapeTearStep(null, 1, 0, 0, B), null, 'no watch, no tear');
  assert.equal(S.tapeTearStep(S.makeTearWatch(), NaN, 0, 0, B), null, 'a broken reading is ignored');
});
test('tapeTearSilent: a block of exact zeros is a tear on its face; the quietest music is not', () => {
  const z = new Float32Array(4096);
  assert.equal(S.tapeTearSilent(z, 4096), true);
  z[2000] = 1e-5;
  assert.equal(S.tapeTearSilent(z, 4096), false, 'one sample of anything and it is music');
  assert.equal(S.tapeTearSilent(null, 4096), false);
  assert.equal(S.tapeTearSilent(z, 0), false);
});
test('ringTornIn: a cut is refused only when a tear falls strictly inside it', () => {
  assert.equal(S.ringTornIn([], 100, 50), false);
  assert.equal(S.ringTornIn([120], 100, 50), true, 'inside');
  assert.equal(S.ringTornIn([100], 100, 50), false, 'a join right before the first sample is not in the cut');
  assert.equal(S.ringTornIn([150], 100, 50), false, 'a join right after the last sample is not in the cut');
  assert.equal(S.ringTornIn([10, 99, 151, 900], 100, 50), false, 'all around, none within');
  assert.equal(S.ringTornIn([10, 149], 100, 50), true);
  assert.equal(S.ringTornIn(null, 100, 50), false);
});
test('loopDeckReady: real data and buffered bytes across the window, or not ready', () => {
  const ranges = arr => ({ length: arr.length, start: i => arr[i][0], end: i => arr[i][1] });
  assert.equal(S.loopDeckReady(4, ranges([[0, 30]]), 12, 0.4), true);
  assert.equal(S.loopDeckReady(2, ranges([[0, 30]]), 12, 0.4), false, 'HAVE_CURRENT_DATA is one frame, not a window');
  assert.equal(S.loopDeckReady(4, ranges([[0, 12.1]]), 12, 0.4), false, 'the window runs past the buffer');
  assert.equal(S.loopDeckReady(4, ranges([[0, 5], [20, 30]]), 12, 0.4), false, 'the return point sits in a gap');
  assert.equal(S.loopDeckReady(4, ranges([]), 12, 0.4), false);
});
test('loopHandbackAt: waits for the deck, never past the cap, never inside the lead', () => {
  assert.equal(S.loopHandbackAt(10.16, 10.0, 0.04, true, 0, 1.5), 10.16, 'ready and on time: the planned instant');
  assert.equal(S.loopHandbackAt(10.16, 10.0, 0.04, false, 0.1, 1.5), null, 'not ready, budget left: wait');
  assert.ok(Math.abs(S.loopHandbackAt(10.16, 11.0, 0.04, true, 1.0, 1.5) - 11.04) < 1e-9, 'ready late: as soon as it can be scheduled');
  assert.ok(Math.abs(S.loopHandbackAt(10.16, 11.6, 0.04, false, 1.6, 1.5) - 11.64) < 1e-9, 'the budget spent: go anyway');
});

// ---------------------------------------------------------------- hot cues, beat jumps, the EQ
/* a synthetic song on a 128 bpm grid: intro 16 bars (quiet), build 8 (mid),
   drop 16 (loud), break 8 (quiet), drop 16 (loud), outro 8 (thin) — the
   band energies are drawn per column exactly as the booth decodes them */
function songBands(grid, bpm, plan, N){
  const bar = 4 * 60 / bpm;
  const totalBars = plan.reduce((a, p) => a + p[0], 0);
  const dur = grid + totalBars * bar + 2;
  const l = new Float32Array(N), m = new Float32Array(N), h = new Float32Array(N);
  for (let i = 0; i < N; i++){
    const t = (i + 0.5) * dur / N;
    let v = 0.02, acc = grid;
    for (const [bars, lvl] of plan){ if (t >= acc && t < acc + bars * bar){ v = lvl; break; } acc += bars * bar; }
    l[i] = v; m[i] = v * 0.8; h[i] = v * 0.6;
  }
  return { bands: { l, m, h }, bmax: { l: 1, m: 1, h: 1 }, dur, bar };
}
test('autoCuePoints: a cue at every real turn of the song, on the bar line, named for what it does', () => {
  const grid = 0.5, bpm = 128;
  const S0 = songBands(grid, bpm, [[16, 0.25], [8, 0.55], [16, 1.0], [8, 0.2], [16, 1.0], [8, 0.3]], 1200);
  const cues = S.autoCuePoints({ bands: S0.bands, bmax: S0.bmax, dur: S0.dur, bpm, grid });
  const barsAt = cues.map(c => Math.round((c.t - grid) / S0.bar));
  assert.deepEqual(barsAt, [0, 16, 24, 40, 48, 64], 'the six turns, bar-exact: ' + JSON.stringify(cues));
  assert.deepEqual(cues.map(c => c.label), ['INTRO', 'BUILD', 'DROP', 'BREAK', 'DROP', 'OUTRO']);
  for (const c of cues){
    const off = ((c.t - grid) / S0.bar) - Math.round((c.t - grid) / S0.bar);
    assert.ok(Math.abs(off) < 1e-6, 'every cue sits ON a bar line');
  }
});
test('autoCuePoints: a change that lands a bar off the phrase is still found, never doubled', () => {
  const grid = 0.2, bpm = 124;
  // the drop arrives at bar 17 (a bar late) — one cue for it, near it
  const S0 = songBands(grid, bpm, [[17, 0.2], [15, 1.0], [16, 0.3]], 900);
  const cues = S.autoCuePoints({ bands: S0.bands, bmax: S0.bmax, dur: S0.dur, bpm, grid });
  const drops = cues.filter(c => c.label === 'DROP');
  assert.equal(drops.length, 1, JSON.stringify(cues));
  assert.ok(Math.abs(Math.round((drops[0].t - grid) / S0.bar) - 17) <= 1);
});
test('autoCuePoints: a flat track gets its top and nothing invented; never more than eight', () => {
  const grid = 0, bpm = 120;
  const flat = songBands(grid, bpm, [[64, 0.7]], 800);
  const c1 = S.autoCuePoints({ bands: flat.bands, bmax: flat.bmax, dur: flat.dur, bpm, grid });
  assert.equal(c1.length, 1, 'no change, no cue — only the top');
  // a restless track: a change every 8 bars for 128 bars
  const plan = []; for (let i = 0; i < 16; i++) plan.push([8, i % 2 ? 1.0 : 0.2]);
  const busy = songBands(grid, bpm, plan, 2400);
  const c2 = S.autoCuePoints({ bands: busy.bands, bmax: busy.bmax, dur: busy.dur, bpm, grid });
  assert.ok(c2.length <= S.AUTOCUE.max, 'capped at the pad count');
  for (let i = 1; i < c2.length; i++) assert.ok(c2[i].t > c2[i - 1].t, 'in time order');
  assert.deepEqual(S.autoCuePoints({ bands: null, dur: 10 }), [], 'no wave, no cues');
});
test('autoCuePoints: without a grid it reads the coarse sections instead', () => {
  const sections = [{ s: 0, e: 0.2, energy: 0.2 }, { s: 0.2, e: 0.6, energy: 0.9 }, { s: 0.6, e: 1, energy: 0.15 }];
  const flat = songBands(0, 120, [[8, 0.5]], 100);
  const c = S.autoCuePoints({ bands: flat.bands, bmax: flat.bmax, dur: 200, bpm: 0, grid: NaN, sections });
  assert.deepEqual(c.map(x => x.label), ['INTRO', 'DROP', 'BREAK']);
  assert.deepEqual(c.map(x => x.t), [0, 40, 120]);
});

test('cueSnap: a cue set with a grid lands on the nearest beat; without one, where the hand was', () => {
  const bpm = 120, grid = 0.25;               // beats at 0.25, 0.75, 1.25 …
  assert.equal(S.cueSnap(0.80, grid, bpm, true), 0.75);
  assert.equal(S.cueSnap(1.10, grid, bpm, true), 1.25);
  assert.equal(S.cueSnap(0.80, grid, bpm, false), 0.80, 'no grid, no snap');
  assert.equal(S.cueSnap(0.80, undefined, bpm, true), 1.0, 'a grid the clock has not resolved reads as zero, never NaN');
  assert.ok(isFinite(S.cueJumpAt(10.2, 4, NaN, bpm, true).fireAt), 'likewise for the jump');
  assert.equal(S.cueSnap(-3, grid, bpm, true), 0.25, 'before the start snaps to the first beat');
  assert.equal(S.cueSnap(0.0, 0.3, bpm, true), 0, 'a snap that would land before zero is clamped');
});
test('cueJumpAt: a jump pressed mid-beat waits for the beat line; on it, goes now', () => {
  const bpm = 120, grid = 0;                  // beats every 0.5 s
  let j = S.cueJumpAt(10.20, 4.0, grid, bpm, true);
  assert.ok(Math.abs(j.fireAt - 10.5) < 1e-9, 'the next beat line: ' + j.fireAt);
  assert.equal(j.to, 4.0);
  j = S.cueJumpAt(10.5, 4.0, grid, bpm, true);
  assert.ok(Math.abs(j.fireAt - 10.5) < 1e-9, 'on the line, no wait');
  j = S.cueJumpAt(10.20, 4.0, grid, bpm, false);
  assert.equal(j.fireAt, 10.20, 'no grid: immediate');
  assert.equal(S.cueJumpAt(3, -1, grid, bpm, true).to, 0, 'a cue is never negative');
});
test('cueJumpLand: a tick that noticed late carries the lateness onto the landing', () => {
  assert.equal(S.cueJumpLand(10.5, 10.5, 4.0), 4.0, 'on time: the cue itself');
  assert.ok(Math.abs(S.cueJumpLand(10.58, 10.5, 4.0) - 4.08) < 1e-9, '80 ms late lands 80 ms in — the beat is kept');
  assert.equal(S.cueJumpLand(10.4, 10.5, 4.0), 4.0, 'early never lands before the cue');
  // …unless the caller CHOSE to go early (a slow frame clock): then the lead is
  // carried, bounded by what it allowed — phase kept either side of the line
  assert.ok(Math.abs(S.cueJumpLand(10.47, 10.5, 4.0, 0.05) - 3.97) < 1e-9, '30 ms early lands 30 ms before the cue');
  assert.ok(Math.abs(S.cueJumpLand(10.3, 10.5, 4.0, 0.05) - 3.95) < 1e-9, 'never more early than allowed');
  assert.equal(S.cueJumpLand(10.47, 10.5, 0.01, 0.05), 0, 'never before the top of the track');
});
test('beatJumpTarget: whole beats either way, clamped inside the track', () => {
  assert.ok(Math.abs(S.beatJumpTarget(10, 4, 120, 200) - 12) < 1e-9);
  assert.ok(Math.abs(S.beatJumpTarget(10, -16, 120, 200) - 2) < 1e-9);
  assert.equal(S.beatJumpTarget(1, -16, 120, 200), 0, 'never before the start');
  assert.equal(S.beatJumpTarget(199.9, 16, 120, 200), 199.75, 'never onto the end');
  assert.ok(Math.abs(S.beatJumpTarget(10, 1, 0, 200) - 10.5) < 1e-9, 'no tempo: a default beat rather than nothing');
});
test('fxEqToggle: a pad that is already doing what it is asked to do undoes it', () => {
  assert.equal(S.fxEqToggle(0, S.EQ_KILL_DB), S.EQ_KILL_DB, 'flat → kill');
  assert.equal(S.fxEqToggle(S.EQ_KILL_DB, S.EQ_KILL_DB), 0, 'kill → flat');
  assert.equal(S.fxEqToggle(S.EQ_KILL_DB, -6), -6, 'kill → dip: a different ask is a new state');
  assert.equal(S.fxEqToggle(0, 40), 6, 'a lift is capped');
  assert.equal(S.fxEqToggle(0, -100), -40, 'a cut is capped');
  assert.equal(S.fxEqIsFlat({ lo: 0, mid: 0, hi: 0 }), true);
  assert.equal(S.fxEqIsFlat({ lo: 0, mid: -6, hi: 0 }), false);
  assert.equal(S.fxEqIsFlat(null), true);
  assert.equal(S.CUE_COLORS.length, S.CUE_SLOTS, 'every slot has a colour');
});

// ---------------------------------------------------------------- the room changes hands with the music
test('seamSceneCue: a beatmix cues the room on the bass swap, sized to it', () => {
  const c = S.seamSceneCue({ plan: { type: 'beatmix', seconds: 8, bpmA: 124, bpmB: 126 }, overlap: 8, auto: true, dwell: 30 });
  assert.equal(c.fire, true); assert.equal(c.big, true);
  assert.ok(Math.abs(c.delay - 4) < 1e-9, 'the midpoint of the blend');
  assert.ok(Math.abs(c.dur - 2 * 60 / 126) < 1e-9, 'two beats of the incoming tempo: ' + c.dur);
});
test('seamSceneCue: a fade cues where the incoming takes over; a gapless join is a quiet dissolve or nothing', () => {
  const f = S.seamSceneCue({ plan: { type: 'fade', seconds: 3 }, auto: true, dwell: 30 });
  assert.equal(f.fire, true); assert.ok(Math.abs(f.delay - 1.8) < 1e-9); assert.ok(f.dur >= S.SEAM_SCENE.durMin);
  const g = S.seamSceneCue({ plan: { type: 'gapless' }, auto: true, dwell: 30 });
  assert.equal(g.fire, true); assert.equal(g.big, false); assert.equal(g.delay, 0);
  const g2 = S.seamSceneCue({ plan: { type: 'gapless' }, auto: true, dwell: 4 });
  assert.equal(g2.fire, false, 'the room only just arrived: same album, same room');
});
test('seamSceneCue: a manual director is never overruled, and reduced motion gets a slow dissolve', () => {
  assert.equal(S.seamSceneCue({ plan: { type: 'beatmix', seconds: 8 }, auto: false, dwell: 30 }).fire, false);
  assert.equal(S.seamSceneCue({ plan: null, auto: true }).fire, false);
  assert.equal(S.seamSceneCue(null).fire, false);
  const r = S.seamSceneCue({ plan: { type: 'beatmix', seconds: 8, bpmB: 128 }, auto: true, dwell: 30, reduced: true });
  assert.ok(r.dur >= 2.0, 'nothing quick under reduced motion');
  const long = S.seamSceneCue({ plan: { type: 'beatmix', seconds: 16, bpmB: 40 }, auto: true, dwell: 30 });
  assert.equal(long.dur, S.SEAM_SCENE.durMax, 'a slow tempo does not make a slow picture');
});
// ---------------------------------------------------------------- two fingers, two axes
test('pinchDolly: spreading the fingers brings the room closer, pinching sends it back — inside the rails', () => {
  assert.ok(Math.abs(S.pinchDolly(30, 100, 200) - 15) < 1e-9 || S.pinchDolly(30, 100, 200) === 16, 'spread ×2 halves the reach, floored');
  assert.equal(S.pinchDolly(30, 100, 200), 16, 'the floor');
  assert.ok(Math.abs(S.pinchDolly(30, 100, 150) - 20) < 1e-9);
  assert.ok(Math.abs(S.pinchDolly(30, 100, 75) - 40) < 1e-9);
  assert.equal(S.pinchDolly(30, 100, 20), 44, 'the ceiling');
  assert.equal(S.pinchDolly(30, 0, 50), 30, 'no starting spread: nothing moves');
  assert.equal(S.pinchDolly(30, 100, 0), 30, 'fingers on top of each other: nothing moves');
  assert.equal(S.pinchDolly(0, 100, 50), 16, 'a broken reach is clamped, not propagated');
});
test('ndcOf: the glass is its own rectangle, not the window', () => {
  const r = { left: 100, top: 50, width: 400, height: 200 };
  assert.deepEqual(S.ndcOf(100, 50, r), [-1, 1], 'top-left');
  assert.deepEqual(S.ndcOf(500, 250, r), [1, -1], 'bottom-right');
  assert.deepEqual(S.ndcOf(300, 150, r), [0, -0].map(v => v + 0), 'centre');
  const c = S.ndcOf(300, 150, r); assert.ok(Math.abs(c[0]) < 1e-9 && Math.abs(c[1]) < 1e-9);
  assert.deepEqual(S.ndcOf(0, 0, null), [-1, 1], 'no rectangle: a 1×1 origin, never NaN');
  assert.ok(Number.isFinite(S.ndcOf(10, 10, { left: 0, top: 0, width: 0, height: 0 })[0]), 'a zero-size glass never divides by zero');
});

// ---------------------------------------------------------------- @ux — the laws of the hand and the eye
test('Fitts: the time is a log, and a target twice as wide is not twice as fast', () => {
  const near = S.fittsTime(100, 44), far = S.fittsTime(400, 44);
  assert.ok(far > near, 'further is slower');
  assert.ok(far < near * 2, 'and only by a log: ' + near.toFixed(0) + ' → ' + far.toFixed(0) + ' ms');
  assert.ok(S.fittsTime(200, 88) < S.fittsTime(200, 44), 'wider is faster');
  assert.equal(S.fittsTime(0, 44), S.FITTS.a, 'a target under the finger costs only the constant');
  assert.ok(isFinite(S.fittsTime(200, 0)), 'a zero-width target does not divide by zero');
});
test('Fitts: the reach is what the ink is missing, halved to each side — and zero when it already fits', () => {
  const r = S.fittsReach(50, 19);           // a HUD chip: wide enough, far too short
  assert.equal(r.x, 0, 'nothing to add across');
  assert.ok(Math.abs(r.y - 12.5) < 1e-9, 'and 12.5 px above and below to make 44: ' + r.y);
  assert.deepEqual(S.fittsReach(48, 48), { x: 0, y: 0 }, 'a target that already passes grows by nothing');
  assert.deepEqual(S.fittsReach(0, 0), { x: 22, y: 22 }, 'and one with no ink at all is all reach');
});
test('Fitts: a reach may take half the gap and never more', () => {
  assert.equal(S.fittsBudget(12.5, 14), 7, 'half of the 14 px the HUD leaves between chips');
  assert.equal(S.fittsBudget(12.5, 40), 12.5, 'where there is room, the whole ask');
  assert.equal(S.fittsBudget(12.5, 0), 0, 'touching neighbours get nothing');
  assert.equal(S.fittsBudget(-3, 20), 0, 'never negative');
});
test('Fitts: a reach that swallows a neighbour is the failure nobody checks for', () => {
  const chip = { left: 0, top: 0, right: 50, bottom: 19 };
  const next = { left: 64, top: 0, right: 114, bottom: 19 };   // 14 px of gap
  const polite = S.rectGrow(chip, 7, 12.5);
  assert.equal(S.fittsSteals(polite, next), false, 'half the gap keeps its hands to itself');
  const greedy = S.rectGrow(chip, 20, 12.5);
  assert.equal(S.fittsSteals(greedy, next), true, 'more than the gap eats the neighbour');
  assert.equal(S.rectOverlap(chip, next), 0, 'the ink never overlapped to begin with');
  assert.ok(S.rectOverlap(greedy, next) > 0);
  assert.equal(S.rectOverlap(null, next), 0);
});
test('travelCost: a layout is charged for the journeys it asks for', () => {
  const together = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 8 }];
  assert.equal(S.travelCost(together), 9, '5 then 4');
  assert.equal(S.travelCost([{ x: 0, y: 0 }]), 0, 'one target is no journey');
  assert.equal(S.travelCost([]), 0);
  assert.ok(S.travelCost([{ x: 0, y: 0 }, { x: 900, y: 0 }]) > S.travelCost(together), 'across the screen costs more');
});
test('Hick: ten choices is not ten times one, and grouping is worth what the log says', () => {
  const one = S.hickTime(1), ten = S.hickTime(10);
  assert.ok(ten / one < 4, 'ten options cost ' + (ten / one).toFixed(1) + '× one, not 10×');
  assert.ok(S.hickTime(0) < one, 'no choice at all is the cheapest thing there is');
  assert.ok(S.hickGrouped(3, 3, 0) > 1, 'under Hick ALONE a split loses — two decisions, two constants');
  assert.ok(S.hickGrouped(5, 5, 40) < 1, 'but once finding is paid for, five groups of five beats a flat twenty-five');
  assert.ok(S.hickGrouped(3, 3, 40) > 0.95, 'and at nine options the split is a wash — grouping there is for the eye');
  assert.ok(S.hickGrouped(1, 9, 40) > 1, 'one group of nine is the flat pile with extra steps');
});
test('Miller: chunks are what is counted, and the span is where it stops being free', () => {
  const eleven = Array.from({ length: 11 }, (_, i) => i);
  const g = S.millerChunk(eleven, 4);
  assert.deepEqual(g.map(x => x.length), [4, 4, 3], 'eleven in fours');
  assert.deepEqual([].concat.apply([], g), eleven, 'and nothing is lost or reordered');
  assert.equal(S.millerChunk(eleven, 99)[0].length, S.MILLER.span + S.MILLER.slack, 'a chunk is capped at nine');
  assert.equal(S.millerOver([3, 4, 4]), 0, 'three small groups are free');
  assert.equal(S.millerOver([3, 11]), 1, 'one group of eleven is not');
});
test('Doherty: 400 ms is the line, and what cannot be fast must say so inside it', () => {
  assert.equal(S.dohertyOk(120), true);
  assert.equal(S.dohertyOk(S.DOHERTY_MS), true, 'exactly on the line still counts as the same event');
  assert.equal(S.dohertyOk(401), false);
  assert.equal(S.dohertyNeedsAck(90), false, 'a fast job is its own acknowledgement');
  assert.equal(S.dohertyNeedsAck(1500), true, 'a slow one owes the listener a word');
});
test('serial position: the ends are what is remembered, the middle is where things go to be forgotten', () => {
  const n = 9, w = Array.from({ length: n }, (_, i) => S.serialPosition(i, n));
  const trough = w.indexOf(Math.min.apply(null, w));
  assert.ok(w[0] > w[trough] && w[n - 1] > w[trough], 'both ends beat the trough');
  assert.ok(w[n - 1] > w[0], 'and recency is the sharper of the two');
  assert.ok(trough > (n - 1) / 2 && trough < n - 2,
    'so the worst seat is not the centre but just past it: ' + trough + ' of ' + n);
  assert.equal(S.serialPosition(0, 1), 1, 'a list of one is all ends');
});
test('serialOrder: the heaviest first, the next heaviest last, the rest out of the light', () => {
  const items = [{ n: 'a', w: 1 }, { n: 'b', w: 9 }, { n: 'c', w: 8 }, { n: 'd', w: 2 }, { n: 'e', w: 5 }];
  const out = S.serialOrder(items, x => x.w).map(x => x.n);
  assert.equal(out[0], 'b', 'the heaviest opens');
  assert.equal(out[out.length - 1], 'c', 'the next heaviest closes');
  assert.equal(out.length, items.length, 'and nothing is dropped');
  assert.deepEqual(out.slice().sort(), ['a', 'b', 'c', 'd', 'e']);
  assert.ok(out.indexOf('a') > 0 && out.indexOf('a') < out.length - 1, 'the lightest is in the middle');
});
test('peak-end: the best moment and the last one, never the average', () => {
  const spike = [1, 1, 9, 1, 1], flat = [3, 3, 3, 3, 3];
  assert.equal(S.peakEnd(spike), 5, 'one high point carries the memory');
  assert.equal(S.peakEnd(flat), 3);
  assert.ok(S.peakEnd(spike) > S.peakEnd(flat), 'even though the flat run has the higher mean');
  assert.equal(S.peakEnd([1, 1, 9, 1, 8]), 8.5, 'ending well is worth as much as peaking well');
  assert.equal(S.peakEnd([]), 0);
});
test('Pareto: the vital few, named by what is actually reached for', () => {
  const counts = [100, 80, 5, 4, 3, 2, 1, 1];
  const vital = S.paretoVital(counts);
  assert.deepEqual(vital, [0, 1], 'two controls carry four fifths of the use');
  assert.ok(S.paretoVital(counts, 0.99).length > vital.length, 'a stricter fraction takes more');
  assert.deepEqual(S.paretoVital([]), []);
  assert.deepEqual(S.paretoVital([0, 0, 0]), [], 'a control nobody touches is never vital');
});
test('Von Restorff: the budget is exactly one, and it goes to the best candidate that is live', () => {
  assert.equal(S.vonRestorffLone([false, true, false]), true);
  assert.equal(S.vonRestorffLone([true, true, false]), false, 'two glows are a pattern, and a pattern is wallpaper');
  assert.equal(S.vonRestorffLone([false, false]), false, 'and none is a screen with no way in');
  assert.equal(S.vonRestorffPick([{ key: 'play', rank: 5, live: true }, { key: 'update', rank: 9, live: true }]), 'update');
  assert.equal(S.vonRestorffPick([{ key: 'play', rank: 5, live: true }, { key: 'update', rank: 9, live: false }]), 'play',
    'a primary nobody can press is not a primary');
  assert.equal(S.vonRestorffPick([]), null);
});
test('Zeigarnik: a bar never sits at zero and never lies about being done', () => {
  assert.equal(S.zeigarnikProgress(0, 10), 0.04, 'started is not nothing');
  assert.ok(Math.abs(S.zeigarnikProgress(5, 10) - 0.5) < 1e-9);
  assert.ok(S.zeigarnikProgress(9.99, 10) < 1, 'nearly done is not done');
  assert.equal(S.zeigarnikProgress(10, 10), 1, 'done is done');
  assert.equal(S.zeigarnikProgress(99, 10), 1, 'and never more than done');
  assert.equal(S.zeigarnikProgress(1, 0), null, 'nothing to be finished is no bar at all');
});
test('proximity: a group reads as a group only when the air outside beats the air inside', () => {
  assert.equal(S.proximityOk(6, 14), true, 'the HUD: six inside a group, fourteen between them');
  assert.equal(S.proximityOk(12, 14), false, 'gaps that nearly match read as one long row');
  assert.equal(S.proximityOk(0, 14), true, 'touching things are unambiguously together');
  assert.equal(S.proximityOk(6, 0), false, 'and no gap at all groups nothing');
});
test('Parkinson and Tesler: a budget is the design, and the machine should be carrying it', () => {
  assert.deepEqual(S.parkinsonBudget(300, 400), { over: false, frac: 0.75 });
  assert.equal(S.parkinsonBudget(900, 400).over, true);
  assert.equal(S.parkinsonBudget(900, 0).over, false, 'no budget, nothing to be over');
  assert.equal(S.teslerShare(9, 1), 0.9, 'the engine beatmatches, the listener presses play');
  assert.equal(S.teslerShare(0, 0), 1, 'a task with no complexity is nobody\'s burden');
  assert.ok(S.teslerShare(1, 9) < 0.5, 'and a design that hands the work back is failing');
});
test('Occam: of the readings that work, the one with fewer parts', () => {
  const pick = S.occamPick([{ n: 'wizard', parts: 7, works: true }, { n: 'one button', parts: 1, works: true },
                            { n: 'nothing', parts: 0, works: false }]);
  assert.equal(pick.n, 'one button');
  assert.equal(S.occamPick([{ parts: 1, works: false }]), null, 'simplest is no virtue if it does not work');
});
test('Postel: every unambiguous paste is accepted, and nothing dangerous is guessed at', () => {
  const P = (s, o) => S.postelUrl(s, o);
  assert.equal(P('https://x.com/catalog.json'), 'https://x.com/catalog.json', 'the plain case is untouched');
  assert.equal(P('  https://x.com/catalog.json  '), 'https://x.com/catalog.json', 'whitespace');
  assert.equal(P('"https://x.com/catalog.json"'), 'https://x.com/catalog.json', 'the quotes a copy brought with it');
  assert.equal(P('Load https://x.com/catalog.json.'.slice(5).trim()), 'https://x.com/catalog.json', 'the full stop of the sentence it was in');
  assert.equal(P('x.com'), 'https://x.com/catalog.json', 'a bare host means the file everybody names the same thing');
  assert.equal(P('x.com/music/'), 'https://x.com/music/catalog.json', 'and so does a directory');
  assert.equal(P('//x.com/catalog.json'), 'https://x.com/catalog.json', 'a protocol-relative link');
  assert.equal(P('x.com/api/feed'), 'https://x.com/api/feed', 'a path that points AT something is left exactly alone');
  assert.equal(P('http://x.com/catalog.json', { secure: true }), 'https://x.com/catalog.json',
    'an http link on an https page is upgraded, not fetched into a mixed-content refusal');
  assert.equal(P('http://x.com/catalog.json', { secure: false }), 'http://x.com/catalog.json', 'and left alone off it');
  assert.equal(P('catalog.json', { base: 'https://y.com/app/' }), 'https://y.com/app/catalog.json',
    'a bare filename is a file next to the page, not a host that happens to look like one');
  assert.equal(P('x.com/catalog.json', { base: 'https://y.com/app/' }), 'https://x.com/catalog.json',
    'and the slash is what tells the two apart');
  assert.equal(P('catalog.json'), null, 'with nothing to resolve against, it is refused rather than invented');
  for (const bad of ['javascript:alert(1)', 'data:text/json,{}', 'blob:https://x/1', 'file:///etc/passwd', '', '   ', null, undefined])
    assert.equal(P(bad), null, 'refused rather than guessed at: ' + bad);
});

// ------------------------------------------------- continuous play, on a phone

test('the waveform folds from the shipped score — no fetch, no decoder', () => {
  // a 4 Hz score, one second long: bass on the first two steps, treble on the last
  const env = { hz: 4, b: '9900', m: '0090', t: '0009', o: '9000' };
  const got = S.peaksFromEnv(env, 8);
  assert.ok(got && got.pk.length === 8 && got.bands.l.length === 8, 'N columns of peak + bands');
  assert.ok(Math.abs(got.pk[0] - 1) < 1e-9, 'peaks normalise to 1.0 like the decode path');
  assert.ok(got.pk[7] > 0.99, 'a single full band is as loud as any other single full band');
  assert.ok(got.bands.l[0] > 0.99 && got.bands.l[7] === 0, 'the low band follows the score\'s bass');
  assert.ok(got.bands.h[7] > 0.99 && got.bands.h[0] === 0, 'and the high band its treble');
  assert.ok(got.bmax.l > 0.99 && got.bmax.m > 0.99 && got.bmax.h > 0.99, 'per-band maxima for the drive to scale against');
  const wide = S.peaksFromEnv(env, 480);
  assert.equal(wide.pk.length, 480, 'more columns than steps is fine — steps are held');
  assert.ok(wide.pk[479] > 0.99 && wide.bands.h[479] > 0.99, 'the last column reads the last step');
  const quiet = S.peaksFromEnv({ hz: 4, b: '0000', m: '0000', t: '0000' }, 8);
  assert.ok(quiet && quiet.pk[0] === 0, 'silence is silence, not NaN');
  assert.equal(S.peaksFromEnv(null, 8), null);
  assert.equal(S.peaksFromEnv({ hz: 4, b: '99' }, 8), null, 'a partial score is refused, so the decoder runs instead');
  assert.equal(S.peaksFromEnv({ hz: 4, b: '', m: '', t: '' }, 8), null, 'an empty one too');
});

test('the heart lesson waits for a track that actually sounded', () => {
  const L = S.lessonDue;
  const base = { tutored: true, favSeen: false, shareSeen: false, firstListen: true };
  assert.equal(L({ ...base, starts: 1 }), null, 'one track heard: nothing yet');
  assert.equal(L({ ...base, starts: 2 }), 'fav', 'the second track that sounds brings the heart');
  assert.equal(L({ ...base, starts: 2, tutored: false }), null, 'never before the tour');
  assert.equal(L({ ...base, starts: 3, favSeen: true }), 'share', 'then share, on the third');
  assert.equal(L({ ...base, starts: 3, favSeen: true, firstListen: false }), null, 'share waits for a first listen');
  assert.equal(L({ ...base, starts: 3, favSeen: true, shareSeen: true }), null, 'each lesson once');
  assert.equal(L({ ...base, starts: 5 }), 'fav', 'the heart is never skipped past — it is still owed');
  assert.equal(L({ starts: 'x' }), null, 'garbage counts as zero');
});

test('a boot that finds the alive mark names a restart the browser made', () => {
  const R = S.restartVerdict;
  const now = 1_000_000;
  assert.equal(R({ alive: null, now }), null, 'a clean boot: the mark was taken away in pagehide');
  assert.equal(R({ alive: { t: now - 4000 }, updatedFrom: true, now }), null, 'our own update swap is not a restart');
  const v = R({ alive: { t: now - 4000, b: 'b1', cur: 'Möbius Walking', playing: true }, now });
  assert.ok(v && v.reason === 'browser', 'the mark survived: the browser reloaded us');
  assert.equal(v.ageMs, 4000, 'and how long ago it was last seen alive');
  assert.equal(v.cur, 'Möbius Walking'); assert.equal(v.playing, true); assert.equal(v.build, 'b1');
  assert.ok(Number.isNaN(R({ alive: { t: 'no' }, now }).ageMs), 'an unreadable mark still names the restart, just not its age');
  assert.equal(R({ alive: 'junk', now }), null, 'a mark that is not a record is ignored');
});

// ---------------------------------------------------------------- the piano inside the ∞
/* The @piano block is the trainer's whole brain — theory, the curriculum, the
   lesson state machine, the backing patterns, the clock, the MIDI file writer,
   the pitch detector — with no DOM and no audio in it, so the same bytes that
   ship run here. The DOM and the sound (PIANO, PnStage, PnAudio) live outside
   the markers and are exercised by the browser probe (tools/piano_probe.mjs). */
const P = new Function('"use strict";' + block('piano') + '\nreturn { pnMidiToFreq, pnFreqToNote, pnNoteName, pnNoteNameBoth, pnParseNote, pnIsBlack,' +
  ' pnCircleIndex, pnCircleRoot, pnMakeKey, pnCamelot, pnKeyFromCamelot, pnKeyName, pnStepCircle, pnRelativeKey, pnKeyScalePcs,' +
  ' pnDiatonicChords, PN_PROGRESSIONS, pnProgressionChords, pnDetectChord, pnIntervalName, pnJustCentsOff, pnVoiceLead, pnSnapToScale, pnOneFingerChord,' +
  ' PnClock, pnTapTempo, PN_STYLES, pnDrumBassStep, pnChordLayerStep, pnChordAtStep, pnBuildLoop, pnGuideEvents, pnArpCycle, pnArpNote,' +
  ' pnBuildMidiFile, pnParseMidi, pnVelocityToGain, pnKeyToMidi, pnDetectNotes, PnNoteStabilizer, PnLessonRunner, PN_TRACKS, PN_ALL_LESSONS, pnLessonById, PN_FIRST, PN_LAST };')();

test('piano: midi ↔ frequency, names, parsing', () => {
  assert.equal(P.pnMidiToFreq(69), 440);
  assert.ok(Math.abs(P.pnMidiToFreq(60) - 261.6256) < 0.001);
  assert.ok(Math.abs(P.pnMidiToFreq(72) / P.pnMidiToFreq(60) - 2) < 1e-12, 'an octave doubles');
  assert.ok(Math.abs(P.pnMidiToFreq(69, 432) - 432) < 1e-9, 'the tuning control moves A4');
  assert.deepEqual(P.pnFreqToNote(445), { midi: 69, cents: 20 });
  assert.equal(P.pnNoteName(60), 'C4'); assert.equal(P.pnNoteName(61), 'C♯4'); assert.equal(P.pnNoteName(61, true), 'D♭4');
  assert.equal(P.pnNoteNameBoth(61), 'C♯4 / D♭4');
  assert.equal(P.pnParseNote('C4'), 60); assert.equal(P.pnParseNote('Bb2'), 46); assert.equal(P.pnParseNote('F#3'), 54); assert.equal(P.pnParseNote('nope'), null);
  assert.equal(P.pnIsBlack(61), true); assert.equal(P.pnIsBlack(60), false);
});
test('piano: the circle of fifths and the Camelot wheel agree with the DJ software', () => {
  assert.equal(P.pnCircleIndex(0), 0); assert.equal(P.pnCircleIndex(7), 1); assert.equal(P.pnCircleIndex(5), 11);
  for (let i = 0; i < 12; i++) assert.equal(P.pnCircleIndex(P.pnCircleRoot(i)), i);
  assert.equal(P.pnCamelot(P.pnMakeKey(0, 'major')), '8B'); assert.equal(P.pnCamelot(P.pnMakeKey(9, 'minor')), '8A');
  assert.equal(P.pnCamelot(P.pnMakeKey(7, 'major')), '9B'); assert.equal(P.pnCamelot(P.pnMakeKey(5, 'major')), '7B'); assert.equal(P.pnCamelot(P.pnMakeKey(4, 'minor')), '9A');
  for (let n = 1; n <= 12; n++) for (const L of ['A', 'B']) assert.equal(P.pnCamelot(P.pnKeyFromCamelot(n + L)), n + L, 'round trip ' + n + L);
  assert.equal(P.pnKeyFromCamelot('13A'), null);
  assert.equal(P.pnKeyName(P.pnMakeKey(10, 'major')), 'B♭ major', 'flat-side keys spell with flats');
  assert.deepEqual(P.pnStepCircle(P.pnMakeKey(0, 'major'), 1), P.pnMakeKey(7, 'major'));
  assert.deepEqual(P.pnStepCircle(P.pnMakeKey(0, 'major'), -1), P.pnMakeKey(5, 'major'));
  assert.deepEqual(P.pnRelativeKey(P.pnMakeKey(0, 'major')), P.pnMakeKey(9, 'minor'));
  /* the same Camelot grammar the player's own colour engine parses, so a
     C-major key here lands on the hue the booth paints for a track in 8B */
  assert.equal(S.camelotHue(P.pnCamelot(P.pnMakeKey(0, 'major'))), S.camelotHue('8B'));
});
test('piano: diatonic chords and the progressions resolve to the right names', () => {
  assert.deepEqual(P.pnDiatonicChords(P.pnMakeKey(0, 'major')).map(x => x.name), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  assert.deepEqual(P.pnDiatonicChords(P.pnMakeKey(0, 'major')).map(x => x.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.deepEqual(P.pnDiatonicChords(P.pnMakeKey(9, 'minor')).map(x => x.name), ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
  assert.equal(P.pnDiatonicChords(P.pnMakeKey(5, 'major'))[3].name, 'B♭');
  const names = (root, mode, id) => P.pnProgressionChords(P.pnMakeKey(root, mode), P.PN_PROGRESSIONS.find(p => p.id === id)).map(c => c.name);
  assert.deepEqual(names(0, 'major', 'anthem'), ['C', 'G', 'Am', 'F']);
  assert.deepEqual(names(7, 'major', 'anthem'), ['G', 'D', 'Em', 'C']);
  assert.deepEqual(names(9, 'minor', 'trance'), ['Am', 'F', 'C', 'G']);
  assert.deepEqual(names(9, 'minor', 'dark'), ['Am', 'G', 'F', 'E']);
  assert.deepEqual(names(0, 'major', 'house'), ['Dm', 'G', 'C', 'Am']);
  assert.deepEqual(names(0, 'major', 'lofi'), ['Cmaj7', 'Am7', 'Dm7', 'G7']);
  assert.deepEqual(names(0, 'major', 'canon'), ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G']);
  assert.deepEqual(names(0, 'major', 'twochord'), ['C', 'F']);
  const ids = P.PN_PROGRESSIONS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'progression ids are unique');
});
test('piano: chord detection names what the hands hold, inversions included', () => {
  const d = (n, f) => P.pnDetectChord(n, f);
  assert.equal(d([60, 64, 67]).name, 'C'); assert.equal(d([60, 63, 67]).name, 'Cm'); assert.equal(d([64, 67, 72]).name, 'C/E');
  assert.equal(d([64, 67, 72]).inversion, 1); assert.equal(d([67, 72, 76]).inversion, 2);
  assert.equal(d([60, 64, 67, 70]).name, 'C7'); assert.equal(d([60, 64, 67, 71]).name, 'Cmaj7'); assert.equal(d([60, 63, 67, 70]).name, 'Cm7');
  assert.equal(d([60, 65, 67]).name, 'Csus4', 'the bass wins the root when two readings tie'); assert.equal(d([60, 62, 67]).name, 'Csus2');
  assert.equal(d([60, 64, 67, 74]).name, 'Cadd9'); assert.equal(d([60, 67]).name, 'C5'); assert.equal(d([60, 63, 66]).name, 'Cdim');
  assert.equal(d([61, 65, 68], true).name, 'D♭'); assert.equal(d([61, 65, 68]).name, 'C♯');
  assert.equal(d([60]), null, 'one note is not a chord'); assert.equal(d([]), null);
  assert.equal(d([60, 61]).name, null, 'a cluster has a bass and pitch classes but no name');
  assert.equal(P.pnIntervalName(7), 'Perfect 5th'); assert.equal(P.pnIntervalName(6), 'Tritone'); assert.equal(P.pnIntervalName(19), 'Perfect 5th + 1 oct');
  assert.ok(Math.abs(P.pnJustCentsOff(7) + 1.955) < 0.01, 'the equal-tempered fifth is two cents flat of 3:2');
});
test('piano: voice leading keeps the hand still, key lock and one-finger chords stay in the key', () => {
  const C = [0, 4, 7], G = [7, 11, 2];
  const v1 = P.pnVoiceLead(null, C), v2 = P.pnVoiceLead(v1, G);
  assert.equal(v1.length, 3); assert.ok(v2[2] - v2[0] <= 12, 'inside a hand');
  const moved = v2.reduce((a, m, i) => a + Math.abs(m - v1[i]), 0);
  assert.ok(moved <= 6, 'C → G moves the hand by ' + moved + ' semitones in all');
  const set = new Set(P.pnKeyScalePcs(P.pnMakeKey(0, 'major')));
  assert.equal(P.pnSnapToScale(61, set), 60, 'C♯ snaps down to C'); assert.equal(P.pnSnapToScale(64, set), 64);
  assert.deepEqual(P.pnOneFingerChord(62, set), [62, 65, 69], 'D under one finger is D minor');
  assert.deepEqual(P.pnOneFingerChord(61, set), [60, 64, 67], 'off-key input snaps first');
});
test('piano: the beat clock keeps its place across tempo changes and fires each 16th once', () => {
  let now = 0;
  const c = new P.PnClock(() => now);
  c.bpm = 120; c.start(0, 0);
  now = 1; assert.ok(Math.abs(c.beat - 2) < 1e-9, 'two beats after a second at 120');
  c.setBpm(60); assert.ok(Math.abs(c.beat - 2) < 1e-9, 'the beat does not jump when the tempo does');
  now = 2; assert.ok(Math.abs(c.beat - 3) < 1e-9);
  const fired = [];
  c.setBpm(120); now = 0; c.start(0, 0);
  c.pump(0.5, (step, t) => fired.push(step));
  assert.deepEqual(fired, [0, 1, 2, 3], 'four 16ths inside half a second at 120');
  c.pump(0.5, (step) => fired.push(step));
  assert.equal(fired.length, 4, 'nothing fires twice');
  assert.ok(Math.abs(c.offFromBeat(1.0)) < 1e-9); assert.ok(Math.abs(c.offFromOffbeat(1.25)) < 1e-9);
  assert.equal(P.pnTapTempo([0, 500, 1000, 1500]), 120); assert.equal(P.pnTapTempo([0, 500, 1000]), 120); assert.equal(P.pnTapTempo([0, 500]), null, 'two taps is one interval: not yet a tempo');
  assert.equal(P.pnTapTempo([0, 5000, 5500, 6000]), 120, 'a long gap starts a fresh count');
});
test('piano: backing patterns are pure, per style, and every style has a name', () => {
  for (const id of Object.keys(P.PN_STYLES)){
    assert.ok(P.PN_STYLES[id].name && P.PN_STYLES[id].blurb, id);
    for (let step = 0; step < 32; step++){
      for (const a of P.pnDrumBassStep(id, step, { rootPc: 0 })) assert.ok(['drum', 'bass', 'click'].includes(a.kind), id + ' ' + a.kind);
      for (const n of P.pnChordLayerStep(id, step, [60, 64, 67])) assert.ok(n.midi > 0 && n.dur > 0 && n.inst, id);
    }
  }
  const house = P.pnDrumBassStep('house', 0, { rootPc: 0 });
  assert.ok(house.some(a => a.kind === 'drum' && a.name === 'kick' && a.duck), 'house kicks on the one and ducks the pads');
  assert.ok(P.pnDrumBassStep('house', 4, { rootPc: 0 }).some(a => a.name === 'clap'), 'clap on two');
  assert.equal(P.pnDrumBassStep('house', 0, null).filter(a => a.kind === 'bass').length, 0, 'no chord, no bass');
  assert.equal(P.pnDrumBassStep('house', 2, { rootPc: 7 }).find(a => a.kind === 'bass').midi, 43, 'the bass plays the root, low');
  assert.equal(P.pnDrumBassStep('ballad', 4, { rootPc: 0 }).length, 0, 'a ballad has no drums');
  assert.equal(P.pnDrumBassStep('drone', 0, { rootPc: 0 }).length, 0);
  assert.equal(P.pnDrumBassStep('metronome', 0, null)[0].accent, true, 'the click accents the one');
  assert.equal(P.pnChordLayerStep('ballad', 0, [60, 64, 67])[0].midi, 60, 'the broken chord starts on the root');
  assert.equal(P.pnChordLayerStep('ballad', 1, [60, 64, 67]).length, 0, 'one note per eighth');
  assert.equal(P.pnChordLayerStep('house', 2, [60, 64, 67]).length, 3, 'house stabs the chord on the "&"');
});
test('piano: the loop, its chord clock and the falling guide', () => {
  const loop = P.pnBuildLoop(P.pnMakeKey(0, 'major'), 'anthem');
  assert.deepEqual(loop.chords.map(c => c.name), ['C', 'G', 'Am', 'F']);
  assert.equal(loop.voicings.length, 4);
  assert.deepEqual(P.pnChordAtStep(loop.chords, 0), { chord: loop.chords[0], index: 0, first: true });
  assert.equal(P.pnChordAtStep(loop.chords, 17).index, 1); assert.equal(P.pnChordAtStep(loop.chords, 17).first, false);
  assert.equal(P.pnChordAtStep(loop.chords, 64).index, 0, 'the loop wraps');
  assert.equal(P.pnChordAtStep([], 0), null);
  const ev = P.pnGuideEvents(loop, 0, 9, 4);
  assert.equal(ev.length, 3 * 3, 'three chords in view, three notes each');
  assert.ok(ev.every(e => e.dur > 0 && e.start >= 0));
  assert.equal(P.pnGuideEvents(loop, 0, 1e9, 4).length <= 16 * 3, true, 'bounded however far the horizon');
  assert.equal(P.pnBuildLoop(P.pnMakeKey(0, 'major'), 'nope').prog.id, 'anthem', 'an unknown loop falls back to the anthem');
});
test('piano: the arpeggiator orders the held notes', () => {
  assert.deepEqual(P.pnArpCycle([67, 60, 64], 'up'), [60, 64, 67]);
  assert.deepEqual(P.pnArpCycle([67, 60, 64], 'down'), [67, 64, 60]);
  assert.deepEqual(P.pnArpCycle([60, 64, 67], 'updown'), [60, 64, 67, 64]);
  assert.deepEqual(P.pnArpCycle([60, 64, 67], 'up', 2), [60, 64, 67, 72, 76, 79]);
  assert.deepEqual(P.pnArpCycle([67, 60], 'played'), [67, 60]);
  assert.deepEqual([...P.pnArpCycle([60, 64, 67], 'random', 1, 3)].sort(), [60, 64, 67], 'random is a permutation');
  assert.deepEqual(P.pnArpCycle([60, 64, 67], 'random', 1, 3), P.pnArpCycle([60, 64, 67], 'random', 1, 3), 'and a seeded one');
  assert.equal(P.pnArpCycle([], 'up').length, 0);
  assert.equal(P.pnArpNote([60, 64, 67], 4), 64); assert.equal(P.pnArpNote([], 4), null);
});
test('piano: the MIDI file writer emits a valid format-0 SMF a DAW will open', () => {
  const bytes = P.pnBuildMidiFile([{ beat: 0, type: 'on', note: 60, vel: 100 }, { beat: 1, type: 'off', note: 60 }], 120, 480);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  assert.deepEqual([...bytes.slice(4, 14)], [0, 0, 0, 6, 0, 0, 0, 1, 1, 224], 'header: length 6, format 0, one track, 480 ppq');
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), 'MTrk');
  const track = [...bytes.slice(22)];
  const tempo = track.indexOf(0x51);
  assert.equal((track[tempo + 2] << 16) | (track[tempo + 3] << 8) | track[tempo + 4], 500000, '120 BPM is 500 000 µs per quarter');
  const on = track.indexOf(0x90);
  assert.deepEqual(track.slice(on, on + 3), [0x90, 60, 100]);
  const off = track.indexOf(0x80);
  assert.deepEqual(track.slice(off - 2, off + 3), [0x83, 0x60, 0x80, 60, 0], 'a 480-tick delta as a two-byte VLQ, then the note-off');
  assert.deepEqual(track.slice(-4), [0, 0xff, 0x2f, 0], 'end of track');
});
test('piano: MIDI bytes become events, velocities become gain, the computer keyboard becomes keys', () => {
  assert.deepEqual(P.pnParseMidi([0x90, 60, 100]), { type: 'noteOn', ch: 0, note: 60, vel: 100 });
  assert.equal(P.pnParseMidi([0x90, 60, 0]).type, 'noteOff', 'velocity zero is a note-off');
  assert.deepEqual(P.pnParseMidi([0x81, 60, 0]), { type: 'noteOff', ch: 1, note: 60, vel: 0 });
  assert.deepEqual(P.pnParseMidi([0xb0, 64, 127]), { type: 'sustain', ch: 0, down: true, value: 127 });
  assert.equal(P.pnParseMidi([0xb0, 64, 10]).down, false);
  assert.equal(P.pnParseMidi([0xb0, 123, 0]).type, 'allNotesOff');
  assert.deepEqual(P.pnParseMidi([0xb0, 74, 64]), { type: 'cc', ch: 0, cc: 74, value: 64 });
  assert.equal(P.pnParseMidi([0xe0, 0, 64]).value, 0, 'centre bend'); assert.equal(P.pnParseMidi([0xe0, 127, 127]).value, 8191);
  assert.equal(P.pnParseMidi([0xf8]).type, 'other');
  assert.equal(P.pnVelocityToGain(127), 1); assert.ok(P.pnVelocityToGain(64) < 0.5, 'a gentle curve for weighted keys'); assert.ok(P.pnVelocityToGain(1) > 0);
  assert.equal(P.pnKeyToMidi('z'), 48); assert.equal(P.pnKeyToMidi('s'), 49); assert.equal(P.pnKeyToMidi('m'), 59); assert.equal(P.pnKeyToMidi(','), 60);
  assert.equal(P.pnKeyToMidi('q'), 60); assert.equal(P.pnKeyToMidi('2'), 61); assert.equal(P.pnKeyToMidi('i'), 72, 'the upper row runs an octave and a third'); assert.equal(P.pnKeyToMidi('p'), 76); assert.equal(P.pnKeyToMidi(']'), 79);
  assert.equal(P.pnKeyToMidi('Q', 36), 48, 'case-insensitive, base shifts the octave'); assert.equal(P.pnKeyToMidi('Shift'), null); assert.equal(P.pnKeyToMidi('x!'), null);
});
test('piano: the pitch detector hears a chord in a synthetic spectrum and the stabiliser holds it', () => {
  const sr = 48000, fft = 16384, bins = fft / 2, binHz = sr / fft;
  const mag = new Float32Array(bins).fill(1e-4);
  for (const m of [60, 64, 67]){
    const f0 = P.pnMidiToFreq(m);
    for (let h = 1; h <= 5; h++){ const k = Math.round((f0 * h) / binHz); mag[k] += 1 / h; mag[k - 1] += 0.4 / h; mag[k + 1] += 0.4 / h; }
  }
  const found = P.pnDetectNotes(mag, sr, fft).map(n => n.midi);
  assert.deepEqual(found, [60, 64, 67], 'C E G out of their harmonics');
  const silent = P.pnDetectNotes(new Float32Array(bins).fill(1e-4), sr, fft);
  assert.equal(silent.length, 0, 'a flat floor is not a note');
  const st = new P.PnNoteStabilizer(2, 2);
  assert.deepEqual(st.update([60]), { on: [], off: [] }, 'one frame is a flicker');
  assert.deepEqual(st.update([60]), { on: [60], off: [] }, 'two frames is a note');
  assert.deepEqual(st.update([]), { on: [], off: [] });
  assert.deepEqual(st.update([]), { on: [], off: [60] }, 'and it lets go after two silent frames');
});
const PN_STEP_TYPES = new Set(['info', 'checklist', 'timer', 'find', 'press', 'sequence', 'count', 'groove', 'quiz', 'ear', 'pedal']);
test('piano: the curriculum is well formed — ids unique, notes on the keyboard, fingers 1..5, chords spelt right', () => {
  assert.ok(P.PN_TRACKS.length >= 7, 'seven tracks'); assert.ok(P.PN_ALL_LESSONS.length >= 40, 'forty-odd lessons');
  const ids = new Set();
  for (const l of P.PN_ALL_LESSONS){
    assert.ok(!ids.has(l.id), 'duplicate lesson id ' + l.id); ids.add(l.id);
    assert.ok(l.title && l.blurb && l.minutes > 0 && l.steps.length >= 2, l.id);
    for (const [i, s] of l.steps.entries()){
      const where = l.id + '[' + i + '] ' + s.title;
      assert.ok(PN_STEP_TYPES.has(s.type), where + ': unknown type ' + s.type);
      assert.ok(s.title, where + ': title');
      assert.ok(s.text || s.type === 'checklist' || s.type === 'quiz', where + ': text');
      for (const n of [...(s.notes || []), ...Object.keys(s.fingers || {}).map(Number), ...(s.show || []), ...((s.demo && s.demo.notes) || [])])
        assert.ok(n >= P.PN_FIRST && n <= P.PN_LAST, where + ': note ' + n + ' off the keyboard');
      for (const f of [...Object.values(s.fingers || {}), ...(s.fingerSeq || [])]) assert.ok(f >= 1 && f <= 5, where + ': finger ' + f);
      if (s.type === 'sequence' || s.type === 'press') assert.ok(s.notes && s.notes.length, where + ': needs notes');
      if (s.type === 'sequence' && s.fingers) assert.equal(Object.keys(s.fingers).length, new Set(s.notes).size, where + ': one finger per distinct note');
      if (s.fingerSeq) assert.equal(s.fingerSeq.length, s.notes.length, where + ': one finger per note played');
      if (s.type === 'quiz') assert.ok(s.choices.length >= 2 && s.answer >= 0 && s.answer < s.choices.length, where);
      if (s.type === 'ear'){
        assert.ok(s.choices.length >= 2 && s.rounds >= 2, where);
        for (const c of s.choices) assert.ok(c.label && c.notes && c.notes.length, where + ': ear choice');
        assert.equal(new Set(s.choices.map(c => c.label)).size, s.choices.length, where + ': labels unique');
      }
      if (s.type === 'find') assert.ok(s.pcs.length && s.count > 0, where);
      if (s.type === 'groove') assert.ok(['on', 'off', 'grid'].includes(s.expect) && s.needed > 0, where);
      if (s.type === 'checklist') assert.ok(s.items.length >= 3, where);
      if (s.type === 'count') assert.ok(s.count > 0, where);
      if (s.chord) assert.equal(P.pnDetectChord(s.notes).name, s.chord, where + ': ' + s.notes + ' is not ' + s.chord);
      if (s.focus) assert.ok(s.focus[0] < s.focus[1], where + ': focus');
      if (s.demo) assert.ok(['chord', 'seq', 'chords'].includes(s.demo.mode), where + ': demo mode');
    }
  }
  assert.ok(P.pnLessonById('fourchords'), 'the fast track opens with the four chords');
  assert.equal(P.pnLessonById('nope'), undefined);
});
test('piano: fingerings follow standard piano technique', () => {
  const find = (id, title) => P.pnLessonById(id).steps.find(s => s.title === title);
  const rh = find('scale', 'Right hand, up'); assert.deepEqual(rh.notes.map(n => rh.fingers[n]), [1, 2, 3, 1, 2, 3, 4, 5]);
  const lh = find('scale', 'Left hand, up'); assert.deepEqual(lh.notes.map(n => lh.fingers[n]), [5, 4, 3, 2, 1, 3, 2, 1]);
  const ode = find('odetojoy', 'Phrase 1'); assert.ok(ode.fingerSeq.every((f, i) => f === ode.notes[i] - 60 - Math.floor((ode.notes[i] - 60) / 2) + Math.floor((ode.notes[i] - 60) / 2) - 0 || true));
  assert.deepEqual(ode.notes.map(n => ({ 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 })[n]), ode.fingerSeq, 'Ode to Joy sits in C position: one finger per key');
  const voicing = P.pnLessonById('voicing').steps.filter(s => s.type === 'press').map(s => s.notes);
  for (let i = 1; i < voicing.length; i++){
    const moved = voicing[i].reduce((a, m, k) => a + Math.abs(m - voicing[i - 1][k]), 0);
    assert.ok(moved <= 5, 'smooth voicing ' + i + ' moves ' + moved + ' semitones');
  }
  const four = P.pnLessonById('fourchords').steps.filter(s => s.type === 'press').map(s => s.notes);
  assert.deepEqual(four.map(n => P.pnDetectChord(n).name), ['C/E', 'G/D', 'Am/E', 'F'], 'the four chords, voice-led');
});
const pnMake = (lesson, env) => new P.PnLessonRunner(lesson, env);
test('piano: lesson steps complete the way a teacher would tick them', () => {
  const r = pnMake({ steps: [{ type: 'info', title: 'a', text: 'x' }, { type: 'info', title: 'b', text: 'y' }] });
  assert.equal(r.done, true); assert.ok(r.next()); assert.equal(r.index, 1); assert.equal(r.next(), false); r.prev(); assert.equal(r.index, 0);
  const f = pnMake({ steps: [{ type: 'find', title: 'C', text: '', pcs: [0], count: 3 }] });
  f.noteOn(60); f.noteOn(60); f.noteOn(61);
  assert.equal(f.found.size, 1); assert.equal(f.mistakes, 1);
  f.noteOn(48); f.noteOn(72); assert.equal(f.done, true);
  const p = pnMake({ steps: [{ type: 'press', title: 'C', text: '', notes: [60, 64, 67] }] });
  p.noteOn(60); p.noteOff(60); p.noteOn(64); p.noteOn(67); assert.equal(p.done, false); p.noteOn(60); assert.equal(p.done, true);
  const mic = pnMake({ steps: [{ type: 'press', title: 'C', text: '', notes: [60, 64, 67] }] });
  mic.noteOn(48, 'mic'); mic.noteOn(52, 'mic'); mic.noteOn(79, 'mic'); assert.equal(mic.done, true, 'the microphone matches by pitch class');
  const s = pnMake({ steps: [{ type: 'sequence', title: 's', text: '', notes: [60, 62, 64], fingerSeq: [1, 2, 3] }] });
  s.noteOn(60); s.noteOn(64); assert.equal(s.pos, 0); assert.equal(s.mistakes, 1);
  s.noteOn(60); assert.deepEqual(s.guide().badges, [{ midi: 62, text: '2', hand: 'right' }], 'the finger for the next note rides on its key');
  assert.equal(s.guide().keys.find(k => k.midi === 62).role, 'next');
  s.noteOn(62); s.noteOn(64); assert.equal(s.done, true); assert.equal(s.progress, 1); assert.equal(s.guide().badges.length, 0);
  const c = pnMake({ steps: [{ type: 'count', title: 'c', text: '', count: 3, allowedPcs: [1, 3, 6, 8, 10] }] });
  c.noteOn(60); c.noteOn(61); c.noteOn(63); c.noteOn(66); assert.equal(c.done, true);
  const soft = pnMake({ steps: [{ type: 'count', title: 'c', text: '', count: 2, maxVelocity: 60 }] });
  soft.noteOn(60, 'midi', 100); soft.noteOn(60, 'midi', 100); assert.equal(soft.done, false, 'too loud does not count');
  soft.noteOn(60, 'midi', 40); soft.noteOn(60, 'midi', 40); assert.equal(soft.done, true);
  const kb = pnMake({ steps: [{ type: 'count', title: 'c', text: '', count: 1, maxVelocity: 60 }] });
  kb.noteOn(60, 'key'); assert.equal(kb.done, true, 'no velocity (computer keys) is never penalised');
  const ck = pnMake({ steps: [{ type: 'checklist', title: 'c', items: ['a', 'b'] }] });
  ck.toggleCheck(0); assert.equal(ck.done, false); ck.toggleCheck(1); assert.equal(ck.done, true); ck.toggleCheck(1); assert.equal(ck.checked.size, 1);
  const q = pnMake({ steps: [{ type: 'quiz', title: 'q', choices: ['a', 'b'], answer: 1 }] });
  assert.equal(q.answerQuiz(0), false); assert.equal(q.mistakes, 1); assert.equal(q.answerQuiz(1), true); assert.equal(q.done, true);
  const pd = pnMake({ steps: [{ type: 'pedal', title: 'p', count: 2 }] });
  pd.pedal(true); pd.pedal(false); assert.equal(pd.done, false); pd.pedal(true); pd.pedal(false); assert.equal(pd.done, true);
  let now = 0;
  const t = pnMake({ steps: [{ type: 'timer', title: 't', seconds: 10 }] }, { now: () => now });
  now = 5000; t.tick(); assert.equal(t.done, false); assert.ok(Math.abs(t.progress - 0.5) < 1e-9); now = 10001; t.tick(); assert.equal(t.done, true);
});
test('piano: groove steps judge timing against the clock', () => {
  let now = 0;
  const clock = new P.PnClock(() => now); clock.bpm = 120; clock.start(0, 0);
  const timing = { running: () => clock.running, offBeat: t => clock.offFromBeat(t), offOffbeat: t => clock.offFromOffbeat(t) };
  const on = pnMake({ steps: [{ type: 'groove', title: 'g', text: '', expect: 'on', needed: 3, pcs: [0] }] }, { now: () => now, timing });
  now = 1.0; on.noteOn(48); assert.equal(on.streak, 1, 'on the beat');
  now = 1.25; on.noteOn(48); assert.equal(on.streak, 0, 'the "&" resets an on-beat streak');
  now = 2.0; on.noteOn(48); now = 2.5; on.noteOn(48); now = 3.02; on.noteOn(48); assert.equal(on.done, true, 'forty milliseconds late is inside the pocket');
  const off = pnMake({ steps: [{ type: 'groove', title: 'g', text: '', expect: 'off', needed: 2 }] }, { now: () => now, timing });
  now = 4.25; off.noteOn(60); now = 4.75; off.noteOn(60); assert.equal(off.done, true);
  const grid = pnMake({ steps: [{ type: 'groove', title: 'g', text: '', expect: 'grid', needed: 2 }] }, { now: () => now, timing });
  now = 5.0; grid.noteOn(60); now = 5.25; grid.noteOn(60); assert.equal(grid.done, true);
  const stopped = pnMake({ steps: [{ type: 'groove', title: 'g', text: '', expect: 'on', needed: 1 }] }, { now: () => now, timing: { ...timing, running: () => false } });
  stopped.noteOn(60); assert.match(stopped.lastMessage, /Play/, 'no beat running: asks for it rather than failing the learner');
});
test('piano: ear-training rounds draw a target, judge the answer, and streak to completion', () => {
  const step = { type: 'ear', title: 'e', text: '', rounds: 3, seed: 4, choices: [{ label: 'A', notes: [60, 64] }, { label: 'B', notes: [60, 67] }, { label: 'C', notes: [60, 72] }] };
  const r = pnMake({ steps: [step] });
  const t0 = r.earTarget();
  assert.ok(step.choices.includes(t0)); assert.equal(r.earTarget(), t0, 'the target holds still until answered');
  const wrong = step.choices.findIndex(c => c !== t0);
  assert.equal(r.answerEar(wrong), false); assert.equal(r.mistakes, 1); assert.equal(r.streak, 0); assert.equal(r.lastRight, false); assert.match(r.lastMessage, new RegExp(t0.label));
  let guard = 0;
  while (!r.done && guard++ < 10) assert.equal(r.answerEar(step.choices.indexOf(r.earTarget())), true);
  assert.equal(r.done, true); assert.equal(r.streak, 3); assert.equal(r.lastRight, true, 'the verdict of the last answer survives the target moving on');
  assert.equal(r.answerEar(0), false, 'a finished step ignores further answers');
  const seen = new Set(); const r2 = pnMake({ steps: [step] });
  for (let k = 0; k < 12; k++){ seen.add(r2.earTarget().label); r2.answerEar(-1); }
  assert.equal(seen.size, 3, 'the draw covers every choice');
  const a = pnMake({ steps: [step] }), b = pnMake({ steps: [step] });
  assert.equal(a.earTarget(), b.earTarget(), 'deterministic per seed, so a lesson replays the same');
});
test('piano: every lesson can be completed by a scripted player', () => {
  let now = 0;
  const clock = new P.PnClock(() => now); clock.bpm = 120; clock.start(0, 0);
  const timing = { running: () => true, offBeat: t => clock.offFromBeat(t), offOffbeat: t => clock.offFromOffbeat(t) };
  for (const lesson of P.PN_ALL_LESSONS){
    const r = new P.PnLessonRunner(lesson, { now: () => now, timing });
    for (let i = 0; i < r.total; i++){
      r.goto(i);
      const s = r.step;
      switch (s.type){
        case 'find': { let m = 30, n = 0; while (n < s.count && m < 100){ if (s.pcs.includes(m % 12)){ r.noteOn(m); n++; } m++; } break; }
        case 'press': s.notes.forEach(n => r.noteOn(n)); break;
        case 'sequence': s.notes.forEach(n => r.noteOn(n)); break;
        case 'count': for (let k = 0; k < s.count; k++) r.noteOn(s.allowedPcs ? s.allowedPcs[0] + 60 : 60, 'midi', 40); break;
        case 'groove': for (let k = 0; k < s.needed; k++){ now = 10 + k * 0.5 + (s.expect === 'off' ? 0.25 : 0); r.noteOn(s.pcs ? s.pcs[0] + 60 : 60); } break;
        case 'checklist': s.items.forEach((_, k) => r.toggleCheck(k)); break;
        case 'quiz': r.answerQuiz(s.answer); break;
        case 'ear': { let g = 0; while (!r.done && g++ < 40) r.answerEar(s.choices.indexOf(r.earTarget())); break; }
        case 'pedal': for (let k = 0; k < s.count; k++){ r.pedal(true); r.pedal(false); } break;
        case 'timer': now += s.seconds * 1000 + 1; r.tick(); break;
        default:
      }
      assert.ok(r.done, lesson.id + '[' + i + '] "' + s.title + '" did not complete');
      const g = r.guide();
      assert.ok(Array.isArray(g.keys) && Array.isArray(g.badges), 'guide shape');
      for (const k of g.keys) assert.ok(k.midi >= P.PN_FIRST && k.midi <= P.PN_LAST && k.role, 'guide key');
    }
    assert.ok(r.finished, lesson.id);
  }
});
test('piano: the trainer is wired into the shipped page — the dialog, the boot, the hidden way in', () => {
  assert.ok(html.includes('<div id="piano" role="dialog"'), 'the dialog is in the markup');
  assert.ok(html.includes('id="pnCanvas"') && html.includes('id="pnPanel"') && html.includes('id="pnClose"'), 'stage, panel and close');
  assert.ok(/try \{ PIANO\.boot\(\); \} catch \(e\)\{\}/.test(html), 'booted alongside the rig, and a broken piano cannot stop the player booting');
  assert.ok(html.includes("document.querySelector('.wordmark .loop8')"), 'the ∞ in the wordmark is the way in');
  assert.ok(/taps\.length >= 5/.test(html), 'five taps');
  assert.ok(html.includes("q.has('piano')"), 'and ?piano for a direct link');
  assert.ok(!/<kbd>[^<]*<\/kbd>[^\n]*piano/i.test(html.slice(html.indexOf('<h3>Keyboard</h3>'), html.indexOf('<h3>Milestones</h3>'))), 'the manual keeps the secret');
  assert.equal((html.match(/^const MB8_BUILD = '[0-9a-f@]*';/gm) || []).length, 1, 'the build stamp is still the only one');
  assert.ok(html.includes("document.addEventListener('keydown', this._kd, true)"), 'the piano takes the keyboard in the capture phase while open');
  assert.ok(html.includes('e.stopPropagation();                              // the piano owns the keyboard while it is open'), 'and stops the player shortcuts firing under the keys');
  assert.ok(html.includes('this.engine.init(AE.ctx, dest, AE.analyser || null)'), 'the sound rides the player context, into the master and the analyser');
});

// ---------------------------------------------------------------- the record: charts from the library
/* tools/piano_chart.py transcribes a library track's piano part into
   docs/charts/<tag>.json; pnChartLesson turns a chart into a lesson and the
   play-along step judges the learner against the record's own beat. The
   shipped charts are held to the shape the trainer reads. */
const PC = new Function('"use strict";' + block('piano') + '\nreturn { pnChartLesson, pnChartWindow, pnChartChordAt, PnLessonRunner, pnDetectChord, PN_FIRST, PN_LAST, pnKeyUsesFlats, pnMakeKey };')();
const CHART_ROSTER = (() => {
  const m = html.match(/const PN_CHARTS = \[([\s\S]*?)\];/);
  assert.ok(m, 'PN_CHARTS roster is in the page');
  return [...m[1].matchAll(/tag: '([a-z0-9-]+)'[^}]*sha256: '([0-9a-f]{64})'/g)].map(x => ({ tag: x[1], sha256: x[2] }));
})();
test('record: every chart in the roster ships, matches its catalog track, and is shaped for the highway', () => {
  assert.ok(CHART_ROSTER.length >= 1, 'at least one charted track');
  const catalog = JSON.parse(readFileSync(join(root, 'docs/catalog.json'), 'utf8'));
  const bySha = {};
  for (const a of catalog.albums) for (const t of a.tracks || []) bySha[t.sha256] = { album: a, track: t };
  for (const row of CHART_ROSTER){
    const chart = JSON.parse(readFileSync(join(root, 'docs/charts/' + row.tag + '.json'), 'utf8'));
    assert.equal(chart.v, 1); assert.equal(chart.tag, row.tag); assert.equal(chart.sha256, row.sha256, row.tag + ': the roster sha256 is the chart\'s');
    const hit = bySha[chart.sha256];
    assert.ok(hit, row.tag + ': the chart\'s track is in the catalog');
    assert.equal(hit.album.tag, row.tag, 'and under the album tag the chart is named for');
    assert.equal(chart.bpm, hit.track.mix.bpm, 'the chart rides the catalog\'s grid'); assert.equal(chart.grid, hit.track.mix.grid);
    assert.ok(chart.bars > 8 && chart.chords.length === chart.bars, 'one chord entry per bar');
    assert.ok(chart.key && chart.key.root >= 0 && chart.key.root < 12 && /^\d{1,2}[AB]$/.test(chart.key.camelot));
    let last = -1;
    for (const n of chart.notes){
      assert.ok(n.m >= PC.PN_FIRST && n.m <= PC.PN_LAST, 'note on the keyboard'); assert.ok(n.b >= 0 && n.d >= 0.25 && n.v > 0 && n.v <= 1, 'quantised, audible');
      assert.ok(Math.abs(n.b * 4 - Math.round(n.b * 4)) < 1e-9, 'starts sit on 16ths'); assert.ok(n.b >= last, 'sorted by start'); last = n.b;
    }
    for (const c of chart.chords) if (c.name) assert.ok(Array.isArray(c.pcs) && c.pcs.length >= 2 && c.pcs.every(p => p >= 0 && p < 12), 'a named chord has pitch classes');
    assert.ok(chart.loop.length >= 2 && chart.loop.every(n => chart.chords.some(c => c.name === n)), 'the loop is made of the chart\'s own chords');
    assert.ok(chart.sections.length >= 1 && chart.sections.every(s => s.name && s.bar >= 0 && s.bars > 0));
    assert.ok(chart.riff.length >= 16 && chart.phrases.length >= 1, 'a riff to learn');
    for (const p of chart.phrases) assert.ok(p.notes.length >= 1 && p.notes.length <= 24 && p.bar >= 0);
    assert.ok(chart.riff.every(n => n.m >= 60), 'the riff is the right hand');
  }
});
test('record: Highway is charted in D♭ major with the vi–IV–I–V loop the ear expects', () => {
  const chart = JSON.parse(readFileSync(join(root, 'docs/charts/highway.json'), 'utf8'));
  assert.equal(chart.key.camelot, '3B'); assert.equal(chart.key.mode, 'major'); assert.equal(chart.key.root, 1);
  assert.ok(chart.key.confidence > 0.6, 'the key is not a guess');
  const loop = chart.loop.map(n => n.replace('maj7', '').replace('add9', ''));
  const cyc = [...loop, ...loop].join(' ');
  assert.ok(cyc.indexOf('B♭m G♭ D♭ A♭') >= 0, 'the loop is the final drop\'s cycle, B♭m – G♭ – D♭ – A♭ in some rotation, got ' + chart.loop.join(' '));
  assert.ok(chart.sections.some(s => /drop/i.test(s.name)), 'the structure names a drop');
});
const fakeChart = () => ({
  v: 1, tag: 'fake', title: 'Fake', sha256: 'x'.repeat(64), bpm: 120, grid: 0.5, duration: 40, bars: 8,
  key: { root: 0, mode: 'major', camelot: '8B', confidence: 0.9 },
  loop: ['C', 'G', 'Am', 'F'],
  sections: [{ name: 'Intro', bar: 0, bars: 4, energy: 0.3 }, { name: 'Drop', bar: 4, bars: 4, energy: 0.9 }],
  chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'].map((name, bar) => ({ bar, name, root: { C: 0, G: 7, Am: 9, F: 5 }[name], pcs: { C: [0, 4, 7], G: [7, 11, 2], Am: [9, 0, 4], F: [5, 9, 0] }[name] })),
  notes: Array.from({ length: 32 }, (_, i) => ({ m: 64 + (i % 4) * 2, b: i, d: 0.5, v: 0.8 })),
  riff: Array.from({ length: 32 }, (_, i) => ({ m: 64 + (i % 4) * 2, b: i, d: 0.5, v: 0.8 })),
  left: [], phrases: [{ bar: 0, notes: Array.from({ length: 8 }, (_, i) => ({ m: 64 + (i % 4) * 2, b: i, d: 0.5, v: 0.8 })) }, { bar: 2, notes: Array.from({ length: 8 }, (_, i) => ({ m: 64 + (i % 4) * 2, b: 8 + i, d: 0.5, v: 0.8 })) }],
});
test('record: a chart becomes a lesson — chords of the loop, the roots, the riff, then playing along', () => {
  const l = PC.pnChartLesson(fakeChart());
  assert.equal(l.id, 'chart:fake'); assert.ok(l.chart);
  const types = l.steps.map(s => s.type);
  assert.equal(types[0], 'info'); assert.ok(l.steps[0].action === 'cue:0' && l.steps[0].key, 'the opener cues the record and sets the key');
  assert.deepEqual(types.filter(t => t === 'press').length, 4, 'one hand shape per chord of the loop');
  const shapes = l.steps.filter(s => s.type === 'press');
  assert.deepEqual(shapes.map(s => PC.pnDetectChord(s.notes).name.replace(/\/.*$/, '')), ['C', 'G', 'Am', 'F'], 'the shapes are the chords');
  for (let i = 1; i < shapes.length; i++){
    const moved = shapes[i].notes.reduce((a, m, k) => a + Math.abs(m - shapes[i - 1].notes[k]), 0);
    assert.ok(moved <= 6, 'voice-led: shape ' + i + ' moves ' + moved);
    assert.equal(Object.keys(shapes[i].fingers).length, 3);
  }
  const roots = l.steps.find(s => s.title === 'The bass roots');
  assert.deepEqual(roots.notes.map(m => m % 12), [0, 7, 9, 5]); assert.equal(roots.hand, 'left');
  assert.ok(l.steps.some(s => s.type === 'count' && s.record && /^cue:/.test(s.action)), 'the loop is played with the record');
  const riffs = l.steps.filter(s => s.type === 'sequence' && /^Riff/.test(s.title));
  assert.equal(riffs.length, 2); assert.ok(riffs[0].demo && riffs[0].demo.mode === 'seq' && riffs[0].action === 'cue:4', 'riff phrases come from the focus section, cued at its bar');
  assert.ok(riffs.every(r => r.fingerSeq && r.fingerSeq.length === r.notes.length && r.fingerSeq.every(f => f >= 1 && f <= 5)), 'every phrase is fingered');
  assert.match(shapes[0].text, /I–V–vi–IV/); assert.match(shapes[0].text, /four chords/, 'the four chords are named as such');
  assert.match(shapes[0].title, /\(I\)$/); assert.match(shapes[2].title, /\(vi\)$/, 'shapes carry their Roman numerals');
  const pa = l.steps.filter(s => s.type === 'playalong');
  assert.equal(pa.length, 2, 'a section, then the whole record');
  assert.ok(pa[0].notes.every(n => n.b >= 16 && n.b < 32), 'the section play-along uses the drop\'s notes');
  assert.equal(pa[1].notes.length, 32); assert.ok(pa[1].needed <= 40);
  assert.equal(types[types.length - 1], 'info');
  const empty = PC.pnChartLesson({ tag: 'e', title: 'E', bpm: 100, grid: 0, bars: 4, key: { root: 9, mode: 'minor', camelot: '8A' }, chords: [], notes: [], riff: [], phrases: [], sections: [], loop: [] });
  assert.ok(empty.steps.length >= 2, 'a thin chart still yields a lesson');
});
test('record: the play-along step is judged against the record\'s beat, one hit per chart note', () => {
  const chart = fakeChart();
  const step = PC.pnChartLesson(chart).steps.find(s => s.type === 'playalong');
  let beat = null;
  const r = new PC.PnLessonRunner({ steps: [step] }, { timing: { running: () => false, offBeat: () => 0, offOffbeat: () => 0, recordBeat: () => beat } });
  r.noteOn(64); assert.equal(r.hits, 0); assert.match(r.lastMessage, /Cue the record/, 'nothing is judged before the record plays');
  beat = 16.1; r.noteOn(64); assert.equal(r.hits, 1); assert.equal(r.streak, 1);
  r.noteOn(64); assert.equal(r.hits, 1, 'the same chart note cannot be hit twice'); assert.equal(r.streak, 0);
  beat = 17.0; r.noteOn(66 + 12); assert.equal(r.hits, 2, 'any octave counts here');
  beat = 18.6; r.noteOn(68); assert.equal(r.hits, 2, 'too late for the note at 18, too early for 22'); assert.equal(r.mistakes, 2);
  beat = 19.0; r.noteOn(60); assert.equal(r.hits, 2); assert.match(r.lastMessage, /wants A♯4|wants B♭4|wants/, 'names the note the record wanted');
  let b = 18; for (let k = 0; k < 40 && !r.done; k++){ beat = b; r.noteOn(64 + (b % 4) * 2); b++; }   // 18 and 19 are still unhit, so sixteen land
  assert.equal(r.done, true); assert.equal(r.progress, 1);
  assert.deepEqual(r.guide().keys, [], 'the keys stay clear: the highway carries the record');
});
test('record: the highway window and the bar\'s chord follow the beat', () => {
  const chart = fakeChart();
  const w = PC.pnChartWindow(chart, 10, 9);
  assert.ok(w.length > 0 && w.every(e => e.start >= 9 && e.start <= 19) && w[0].midi === chart.notes.find(n => n.b >= 9).m);
  assert.deepEqual(PC.pnChartChordAt(chart, 5.5), { bar: 1, name: 'G', pcs: [7, 11, 2] });
  assert.equal(PC.pnChartChordAt(chart, 99).name, null, 'past the end there is no chord');
  assert.equal(PC.pnChartWindow({ notes: [] }, 0).length, 0);
});
test('record: the page fetches charts on demand and cues the player, never a second audio path', () => {
  assert.ok(html.includes("fetch('charts/' + tag + '.json'"), 'charts load lazily');
  assert.ok(html.includes('player.playIndex(i)') && html.includes('d.a.currentTime = Math.min(t, d.a.duration - 0.5)'), 'the record is the player\'s own deck, seeked to the bar');
  assert.ok(html.includes('return CLOCK.beats;'), 'the play-along beat is the player\'s healed clock');
  assert.ok(html.includes("SPEED.STEPS.indexOf(0.75)"), 'the slow practice speed is the player\'s own SPEED');
  const wf = readFileSync(join(root, '.github/workflows/piano_chart.yml'), 'utf8');
  assert.ok(/htdemucs_6s/.test(wf) && /basic-pitch/.test(wf) && /tools\/piano_chart\.py/.test(wf), 'the professional pass runs on a runner');
});

// ---------------------------------------------------------------- practice: wait mode, arrangements, stars
const PR = new Function('"use strict";' + block('piano') + '\nreturn { pnChartLesson, pnChartArrange, pnPracticeStep, pnStars, PnLessonRunner };')();
test('practice: arrangements — Full is the transcription, Easy is one note per beat and a root per bar', () => {
  const chart = fakeChart();
  const full = PR.pnChartArrange(chart, 'full');
  assert.equal(full.right.length, chart.riff.length);
  assert.equal(full.left.length, chart.chords.length * 2, 'an untrusted left hand is rebuilt from the chords: root on 1, fifth on 3');
  assert.deepEqual(full.left.slice(0, 2).map(n => [n.m % 12, n.b]), [[0, 0], [7, 2]]);
  const trusted = Object.assign({}, chart, { leftVerified: true, left: [{ m: 48, b: 0, d: 1, v: 1 }] });
  assert.deepEqual(PR.pnChartArrange(trusted, 'full').left, trusted.left, 'a verified left hand is the transcription');
  const easy = PR.pnChartArrange(chart, 'easy');
  assert.ok(easy.right.length <= 32 && easy.right.every((n, i, a) => !i || Math.floor(a[i - 1].b) < Math.floor(n.b)), 'at most one right-hand note per beat');
  assert.ok(easy.right.every(n => n.d >= 1), 'held at least a beat');
  assert.equal(easy.left.length, chart.chords.length, 'one root per bar');
  assert.deepEqual(easy.left.slice(0, 4).map(n => n.m % 12), [0, 7, 9, 5]);
  assert.ok(easy.left.every(n => n.m >= 36 && n.m < 48), 'roots in the low octave');
  const busy = Object.assign({}, chart, { riff: [{ m: 64, b: 0.25, d: 0.25, v: 1 }, { m: 65, b: 0.5, d: 0.25, v: 1 }, { m: 67, b: 1, d: 0.25, v: 1 }, { m: 69, b: 1.5, d: 0.25, v: 1 }] });
  assert.deepEqual(PR.pnChartArrange(busy, 'easy').right.map(n => n.m), [64, 67], 'the note on the beat wins, else the first in the beat');
});
test('practice: a practice step picks the hand, groups notes by 16th, and keeps the other hand as accompaniment', () => {
  const chart = fakeChart();
  const st = PR.pnPracticeStep(chart, { from: 4, to: 8, hands: 'right', level: 'full', tempo: 0.6, name: 'drop' });
  assert.equal(st.type, 'practice'); assert.equal(st.from, 16); assert.equal(st.to, 32); assert.equal(st.hands, 'right');
  assert.ok(st.notes.every(n => n.b >= 16 && n.b < 32), 'only the section');
  assert.equal(st.groups.length, 16); assert.ok(st.groups.every((g, i, a) => !i || g.b > a[i - 1].b), 'groups in order');
  assert.equal(st.accomp.length, 8, 'the left hand (from the chords) is the accompaniment: root and fifth for four bars');
  const easyBoth = PR.pnPracticeStep(chart, { from: 0, to: 2, hands: 'both', level: 'easy' });
  const g0 = easyBoth.groups[0];
  assert.deepEqual(g0.m.sort((a, b) => a - b), [36, 64], 'beat one is the root and the melody note together');
  const left = PR.pnPracticeStep(chart, { from: 0, to: 2, hands: 'left', level: 'easy' });
  assert.equal(left.groups.length, 2); assert.ok(left.accomp.length > 0, 'the right hand is played for you');
  assert.match(st.title, /Practice: right hand, drop/);
  const chord = Object.assign({}, chart, { riff: [{ m: 60, b: 0, d: 1, v: 1 }, { m: 64, b: 0, d: 1, v: 1 }, { m: 67, b: 0, d: 1, v: 1 }, { m: 62, b: 1, d: 1, v: 1 }] });
  const cs = PR.pnPracticeStep(chord, { from: 0, to: 1, hands: 'right' });
  assert.deepEqual(cs.groups.map(g => g.m), [[60, 64, 67], [62]], 'a chord is one group');
});
test('practice: wait mode holds at each group, takes chord notes in any order, names slips, loops passes', () => {
  const chart = fakeChart();
  const chord = Object.assign({}, chart, { riff: [{ m: 60, b: 0, d: 1, v: 1 }, { m: 64, b: 0, d: 1, v: 1 }, { m: 67, b: 0, d: 1, v: 1 }, { m: 62, b: 1, d: 1, v: 1 }, { m: 64, b: 2, d: 1, v: 1 }] });
  const st = PR.pnPracticeStep(chord, { from: 0, to: 1, hands: 'right', passes: 2 });
  const r = new PR.PnLessonRunner({ steps: [st] });
  assert.equal(r.pos, 0); assert.equal(r.progress, 0);
  assert.deepEqual(r.guide().keys.filter(k => k.role === 'next').map(k => k.midi).sort((a, b) => a - b), [60, 64, 67], 'the current group lights as next');
  assert.ok(r.guide().keys.some(k => k.role === 'hint' && k.midi === 62), 'the following group is hinted');
  r.noteOn(67); assert.equal(r.pos, 0); assert.match(r.lastMessage, /and C4 \+ E4|and C4/);
  assert.ok(r.guide().keys.some(k => k.midi === 67 && k.role === 'done'), 'a pressed note of the group reads as done');
  r.noteOn(61); assert.equal(r.mistakes, 1); assert.match(r.lastMessage, /wants C4 \+ E4 \+ G4/);
  r.noteOn(67); assert.match(r.lastMessage, /Already there/); assert.equal(r.mistakes, 1);
  r.noteOn(60); r.noteOn(64); assert.equal(r.pos, 1); assert.equal(r.hits, 1); assert.equal(r.cleanGroups, 0, 'a slip in the group means it was not clean');
  r.noteOn(62); assert.equal(r.pos, 2); assert.equal(r.cleanGroups, 1);
  r.noteOn(64); assert.equal(r.passes, 1); assert.equal(r.pos, 0, 'pass one done: back to the top'); assert.equal(r.done, false);
  assert.ok(Math.abs(r.progress - 0.5) < 1e-9);
  for (const m of [60, 64, 67, 62, 64]) r.noteOn(m);
  assert.equal(r.done, true); assert.equal(r.passes, 2); assert.equal(r.progress, 1);
  assert.ok(Math.abs(r.accuracy - 6 / 7) < 1e-9, 'six hits, one slip');
  assert.equal(PR.pnStars(r.accuracy), 2);
  assert.equal(PR.pnStars(1), 3); assert.equal(PR.pnStars(0.8), 2); assert.equal(PR.pnStars(0.6), 1); assert.equal(PR.pnStars(0.2), 0);
  const any = new PR.PnLessonRunner({ steps: [Object.assign({}, st, { anyOctave: true })] });
  any.noteOn(72); any.noteOn(52); any.noteOn(79); assert.equal(any.pos, 1, 'any octave when the step allows it');
});
test('practice: the chart lesson teaches a section hands apart then together, easy or full, before the record', () => {
  const l = PR.pnChartLesson(fakeChart(), 'easy');
  const types = l.steps.map(s => s.type);
  const prac = l.steps.filter(s => s.type === 'practice');
  assert.deepEqual(prac.map(s => s.hands), ['right', 'left', 'both']);
  assert.ok(prac.every(s => s.level === 'easy' && s.from === 16 && s.to === 32), 'the drop, at the easy level');
  assert.ok(types.indexOf('practice') < types.indexOf('playalong'), 'practice comes before the record');
  const firstRiff = l.steps.findIndex(s => /^Riff/.test(s.title));
  assert.ok(firstRiff >= 0 && firstRiff < types.indexOf('practice'), 'the phrases are learned before the section is put together');
  assert.equal(l.level, 'easy');
  const full = PR.pnChartLesson(fakeChart(), 'full');
  assert.deepEqual(full.steps.filter(s => s.type === 'practice').map(s => s.hands), ['right', 'left', 'both'], 'full teaches both hands too, with the chord-built left hand');
  assert.ok(full.steps.find(s => s.type === 'playalong').notes.length >= l.steps.find(s => s.type === 'playalong').notes.length, 'full plays more notes along than easy');
  assert.ok(l.steps.filter(s => /^Riff/.test(s.title)).length <= 4, 'the riff phrases are capped');
});
test('practice: the page drives wait mode on its own clock, with hands, tempo and stars', () => {
  assert.ok(html.includes("startPractice(){") && html.includes("_practiceTick(now){") && html.includes("p.beat = g.b; p.waiting = true;"), 'the clock holds at the next group');
  assert.ok(html.includes("this.engine.playTimed(n.m, 0.42 * (0.5 + n.v)"), 'the other hand is played for you');
  assert.ok(html.includes('data-hands="') && html.includes('id="pnPracTempo"') && html.includes('data-level="'), 'hands, tempo and level controls');
  assert.ok(html.includes("sc[idx] = { stars, acc:"), 'best scores are kept per step');
  assert.ok(html.includes("ev.dim ? (active ? 0.4 : 0.18)"), 'accompaniment falls dimmer than your notes');
});

// ---------------------------------------------------------------- teaching quality: folding, fingering, sections, streaks
const PT = new Function('"use strict";' + block('piano') + '\nreturn { pnFoldLine, pnFingerLine, pnSectionLoop, pnFocusSection, pnRomanIn, pnStreak, pnMakeKey, pnChartLesson, pnPracticeStep, PnLessonRunner };')();
test('teaching: folding brings a line under one hand without changing its pitch classes', () => {
  const line = [72, 74, 76, 88, 71, 55].map((m, i) => ({ m, b: i, d: 1, v: 1 }));
  const f = PT.pnFoldLine(line);
  assert.ok(Math.max(...f.map(n => n.m)) - Math.min(...f.map(n => n.m)) <= 11, 'within one hand span');
  assert.deepEqual(f.map(n => n.m % 12), line.map(n => n.m % 12), 'the same notes, octaves moved');
  assert.deepEqual(f.map(n => n.b), line.map(n => n.b), 'the same rhythm');
  assert.equal(PT.pnFoldLine([]).length, 0);
});
test('teaching: beginner fingering — a five-finger position by distance, thumb low in the right hand, pinky low in the left', () => {
  assert.deepEqual(PT.pnFingerLine([60, 62, 64, 65, 67]), [1, 2, 3, 4, 5], 'C position');
  assert.deepEqual(PT.pnFingerLine([67, 65, 64, 62, 60]), [5, 4, 3, 2, 1]);
  assert.deepEqual(PT.pnFingerLine([48, 50, 52, 53, 55], 'left'), [5, 4, 3, 2, 1], 'left hand mirrors');
  assert.deepEqual(PT.pnFingerLine([72, 73, 75]), [1, 2, 3], 'Highway\'s hook, C–D♭–E♭: 1-2-3');
  assert.deepEqual(PT.pnFingerLine([60, 67]), [1, 5], 'a fifth spans the hand');
  const jump = PT.pnFingerLine([60, 62, 72, 74]);
  assert.deepEqual(jump, [1, 2, 1, 2], 'a leap beyond the hand starts a new position');
  for (const f of PT.pnFingerLine([60, 61, 63, 66, 67, 70, 72])) assert.ok(f >= 1 && f <= 5);
});
test('teaching: a section\'s chord cycle is found in its own order, with Roman numerals', () => {
  const mk = names => ({ chords: names.map((n, bar) => { const minor = /m$/.test(n); const root = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9 }[n[0]]; return { bar, name: n, root, pcs: minor ? [root, (root + 3) % 12, (root + 7) % 12] : [root, (root + 4) % 12, (root + 7) % 12] }; }) });
  const four = PT.pnSectionLoop(mk(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F']), 0, 8);
  assert.deepEqual(four.map(c => c.root + (c.minor ? 'm' : '')), ['0', '7', '9m', '5']);
  const k = PT.pnMakeKey(0, 'major');
  assert.deepEqual(four.map(c => PT.pnRomanIn(k, c.root, c.minor)), ['I', 'V', 'vi', 'IV']);
  const held = PT.pnSectionLoop(mk(['C', 'Am', 'F', 'F', 'C', 'Am', 'F', 'F']), 0, 8);
  assert.deepEqual(held.map(c => c.root), [0, 9, 5], 'a chord held two bars appears once');
  assert.equal(PT.pnRomanIn(k, 1, false), '?', 'a chromatic chord has no diatonic numeral');
});
test('teaching: the focus section is the loud one the record confirms best', () => {
  const chart = { bars: 40, sections: [{ name: 'Intro', bar: 0, bars: 8 }, { name: 'Drop', bar: 8, bars: 8 }, { name: 'Final drop', bar: 24, bars: 16 }],
    verify: { riffPerBar: Array.from({ length: 40 }, (_, i) => (i >= 24 ? 0.95 : i >= 8 ? 0.5 : 0.2)) } };
  assert.equal(PT.pnFocusSection(chart).name, 'Final drop');
  delete chart.verify;
  assert.equal(PT.pnFocusSection(chart).name, 'Drop', 'without verification: the first drop');
  assert.equal(PT.pnFocusSection({ bars: 4, sections: [] }).bar, 0);
});
test('teaching: a looping practice step scores on the first clean pass and keeps looping', () => {
  const chart = { riff: [{ m: 60, b: 0, d: 1, v: 1 }, { m: 62, b: 1, d: 1, v: 1 }], chords: [], left: [] };
  const st = PT.pnPracticeStep(chart, { from: 0, to: 1, hands: 'right' });
  st.loop = true; st.passes = 999;
  const r = new PT.PnLessonRunner({ steps: [st] });
  r.noteOn(60); r.noteOn(62);
  assert.equal(r.done, true, 'one pass completes the step'); assert.equal(r.pos, 0, 'and the loop goes again');
  r.noteOn(60); assert.equal(r.pos, 1, 'still listening while it loops');
});
test('teaching: the streak counts consecutive days, and survives until today is over', () => {
  const now = new Date(2026, 9, 10, 12);
  assert.equal(PT.pnStreak(['2026-10-08', '2026-10-09', '2026-10-10'], now), 3);
  assert.equal(PT.pnStreak(['2026-10-08', '2026-10-09'], now), 2, 'not played yet today: yesterday still counts');
  assert.equal(PT.pnStreak(['2026-10-07', '2026-10-09', '2026-10-10'], now), 2, 'a gap breaks it');
  assert.equal(PT.pnStreak([], now), 0);
});
test('teaching: Highway — the lesson teaches the drop\'s own cycle, the hook under three fingers, and the four chords', () => {
  const chart = JSON.parse(readFileSync(join(root, 'docs/charts/highway.json'), 'utf8'));
  assert.ok(chart.verify && chart.verify.riff.attack > chart.verify.riff.semitoneUp + 0.25 && chart.verify.riff.attack > chart.verify.riff.eighthLate + 0.3, 'the shipped riff beats its semitone and time-shifted controls against the record');
  assert.ok(chart.verify.chords.share > chart.verify.chords.randomShare * 2, 'the named chords own their bars');
  assert.equal(chart.leftVerified, false, 'the mix\'s left hand is not trusted; the lesson builds it from the chords');
  const l = PT.pnChartLesson(chart, 'easy');
  const shapes = l.steps.filter(s => s.type === 'press');
  assert.match(shapes[0].title, /D♭ \(I\)/, 'the drop starts on the one');
  assert.ok(shapes.some(s => /^Final drop adds A♭ \(V\)/.test(s.title) && /four chords/.test(s.text)), 'the final drop\'s V completes the four chords');
  assert.match(chart.transcriber, /piano stem/, 'the shipped chart was transcribed from the isolated piano stem');
  const riffs = l.steps.filter(s => /^Riff/.test(s.title));
  assert.ok(riffs.length >= 3);
  for (const r of riffs) assert.ok(Math.max(...r.notes) - Math.min(...r.notes) <= 11, 'easy phrases sit under one hand');
  const pos = [68, 70, 72, 73, 75];   // A♭4 B♭4 C5 D♭5 E♭5: one five-finger position
  assert.ok(riffs.every(r => r.notes.every(m => pos.includes(m))), 'at Easy the whole hook sits in the A♭ five-finger position');
  assert.ok(riffs.every(r => r.fingerSeq.every((f, k) => f === { 68: 1, 70: 2, 72: 3, 73: 4, 75: 5 }[r.notes[k]])), 'and is fingered as that position: A♭=1 … E♭=5');
});

// ---------------------------------------------------------------- the dance bus

/* THE BUS IS A BODY, AND A BODY HAS A SHAPE THAT CAN BE MEASURED. These tests
   pin the twelve floats to numbers: the kick spring's peak, rebound and
   settle in BEATS at three tempi; the voices (a hat may light, never move);
   stillness that arrives; the landing that fires from silence; the prelude's
   shapes; and a frozen trace of the whole bus on a fixed synthetic drive —
   the table the Swift port (Dance.swift) is checked against. */

const BUS_FPS = 60, BUS_DT = 1 / BUS_FPS;
// one frame of inputs with every field the stepper reads, defaulting to a quiet, playing room
function busInp(over){
  return Object.assign({
    bass: 0, mid: 0, treble: 0, energy: 0, centroid: 0.4,
    rb: 0, rm: 0, rt: 0, punch: 0,
    period: 0.5, haveGrid: true, beatIdx: 1, barPhase: 0.3, phrasePhase: 0.1,
    ear: 0.85, playing: true, breath: 0, calm: false,
  }, over || {});
}

test('dance bus: the kick spring — a unit strike peaks at 1.0, rebounds once, is home by 0.8 beat, the same at any tempo', () => {
  const film = (P, calm) => {
    const ks = S.makeDanceKick();
    S.danceKickStrike(ks, 1);
    const xs = [];
    for (let i = 1; i <= Math.round(2 * P * BUS_FPS); i++){
      const x = S.danceKickStep(ks, BUS_DT, P, calm);
      xs.push({ b: i * BUS_DT / P, x });
    }
    return xs;
  };
  const shape = xs => {
    let peak = xs[0];
    for (const o of xs) if (o.x > peak.x) peak = o;
    const mins = [];
    for (let i = 1; i < xs.length - 1; i++)
      if (xs[i].b > peak.b && xs[i].b <= 1.0 && xs[i].x < xs[i - 1].x && xs[i].x <= xs[i + 1].x && xs[i].x < 0) mins.push(xs[i]);
    const tail = xs.filter(o => o.b >= 0.8);
    return { peak, mins, tailMax: Math.max(...tail.map(o => Math.abs(o.x))) };
  };
  const ref = film(0.5, false);
  for (const bpm of [90, 120, 174]){
    const P = 60 / bpm, xs = film(P, false), s = shape(xs);
    assert.ok(Math.abs(s.peak.x - 1) <= 0.1, bpm + ' BPM: a unit strike peaks at ' + s.peak.x.toFixed(3));
    assert.ok(s.peak.b > 0.1 && s.peak.b < 0.35, bpm + ' BPM: the body arrives after the foot, at ' + s.peak.b.toFixed(2) + ' beat');
    assert.equal(s.mins.length, 1, bpm + ' BPM: exactly one rebound below rest inside the beat, got ' + s.mins.length);
    const reb = s.mins[0].x / s.peak.x;
    assert.ok(reb <= -0.15 && reb >= -0.30, bpm + ' BPM: the rebound is ' + (100 * reb).toFixed(0) + '% of the peak');
    assert.ok(s.mins[0].b > 0.5 && s.mins[0].b < 0.75, bpm + ' BPM: the rebound sits at ' + s.mins[0].b.toFixed(2) + ' beat');
    assert.ok(s.tailMax < 0.1 * s.peak.x, bpm + ' BPM: within 10% of rest from 0.8 beat (worst ' + s.tailMax.toFixed(3) + ')');
    // the SAME shape in beats: resample against 120 BPM
    const at = (arr, b) => { for (let i = 1; i < arr.length; i++) if (arr[i].b >= b){ const a = arr[i - 1], c = arr[i]; return a.x + (c.x - a.x) * (b - a.b) / (c.b - a.b); } return arr[arr.length - 1].x; };
    let se = 0, n = 0;
    for (let b = 0.05; b < 1.9; b += 0.01){ const d = at(xs, b) - at(ref, b); se += d * d; n++; }
    const rms = Math.sqrt(se / n);
    assert.ok(rms <= 0.03, bpm + ' BPM: rms vs 120 BPM in beats = ' + rms.toFixed(4));
  }
  // the calm body (iOS / CALM, ζ 0.55) still peaks at 1 — its own gain
  const calm = shape(film(0.5, true));
  assert.ok(Math.abs(calm.peak.x - 1) <= 0.1, 'calm: a unit strike peaks at ' + calm.peak.x.toFixed(3));
  // the rails: a 100 ms frame gap and an absurd strike cannot blow it up
  const ks = S.makeDanceKick(); S.danceKickStrike(ks, 5);
  for (let i = 0; i < 40; i++){ const x = S.danceKickStep(ks, 0.1, 0.3, false); assert.ok(isFinite(x) && Math.abs(x) <= 2, 'railed: ' + x); }
});

test('dance bus: the classifier — kick, snare and hat are different voices; a sustained bassline is weight, not a strike', () => {
  const kick = S.danceClassify({ rb: 0.6, punch: 0.9, bass: 0.9, mid: 0.3 }, 0.3);
  assert.ok(kick.kick > 0.9 && kick.snare < 0.2 && kick.hat === 0, 'a kick: ' + JSON.stringify(kick));
  const hat = S.danceClassify({ rt: 0.5, punch: 0, bass: 0.25, mid: 0.3 }, 0.25);
  assert.ok(hat.kick === 0 && hat.snare === 0 && Math.abs(hat.hat - 0.65) < 1e-9, 'a bare hat: ' + JSON.stringify(hat));
  const snare = S.danceClassify({ rm: 0.5, punch: 0.7, bass: 0.3, mid: 0.8 }, 0.3);
  assert.ok(snare.snare > 0.9 && snare.kick === 0, 'a snare over flat bass: ' + JSON.stringify(snare));
  // the bass floor: the same hit reads as a kick only when the bass RISES above its own recent floor
  const held = S.danceClassify({ punch: 0.9, bass: 0.9, mid: 0.2 }, 0.9);
  const fresh = S.danceClassify({ punch: 0.9, bass: 0.9, mid: 0.2 }, 0.3);
  const ungated = S.danceClassify({ punch: 0.9, bass: 0.9, mid: 0.2 }, null);
  assert.ok(held.kick === 0 && fresh.kick > 0.5 && ungated.kick > 0.5, 'floor: held ' + held.kick + ' fresh ' + fresh.kick + ' ungated ' + ungated.kick);
  // a hat on top of a kick is mostly the kick's
  const both = S.danceClassify({ rb: 0.6, rt: 0.5, punch: 0.9, bass: 0.9, mid: 0.3 }, 0.3);
  assert.ok(both.hat < hat.hat * 0.4, 'the hat yields to the kick: ' + both.hat.toFixed(3));
  // garbage in: finite out
  const junk = S.danceClassify({ rb: NaN, punch: Infinity, bass: undefined }, NaN);
  for (const k of ['kick', 'snare', 'hat']) assert.ok(isFinite(junk[k]) && junk[k] >= 0 && junk[k] <= 1, k + ' finite');
});

test('dance bus: a hat train lights dHit no more than 0.25, never resets dAge, never strikes the body', () => {
  // bare hats on every eighth over flat bass: the treble flicks, the body does not move
  let st = S.makeDanceBusState();
  for (let i = 0; i < 240; i++){
    const onHat = i % 15 === 0;
    const { bus } = S.danceBusStep(st, busInp({
      bass: 0.25, mid: 0.3, treble: 0.2 + 0.4 * Math.exp(-((i % 15) * BUS_DT) / 0.05), energy: 0.3,
      rt: onHat ? 0.5 : 0, beatIdx: Math.floor(i / 30) % 4, barPhase: (i / 120) % 1,
    }), BUS_DT);
    assert.ok(bus[0] <= 0.25 + 1e-6, 'frame ' + i + ': a hat lit dHit to ' + bus[0].toFixed(3));
    assert.ok(Math.abs(bus[2]) <= 0.02, 'frame ' + i + ': a hat moved dKick to ' + bus[2].toFixed(3));
    assert.equal(bus[1], 4, 'frame ' + i + ': dAge stays saturated — no strike happened');
    if (onHat && i > 0) assert.ok(bus[5] > 0.5, 'frame ' + i + ': the hat reaches dSpark (' + bus[5].toFixed(2) + ')');
  }
  // a kick, then hats: dAge counts up from the kick and is never reset by a hat
  st = S.makeDanceBusState();
  let prevAge = -1;
  for (let i = 0; i < 120; i++){
    const onKick = i === 30, onHat = i > 30 && i % 15 === 0;
    const { bus, state } = S.danceBusStep(st, busInp({
      bass: i < 30 ? 0.25 : 0.25 + 0.65 * Math.exp(-((i - 30) * BUS_DT) / 0.12), mid: 0.3,
      treble: 0.2 + (i > 30 ? 0.4 * Math.exp(-((i % 15) * BUS_DT) / 0.05) : 0), energy: 0.3,
      rb: onKick ? 0.6 : 0, punch: onKick ? 0.9 : 0, rt: onHat ? 0.5 : 0, beatIdx: 0,
    }), BUS_DT);
    if (i === 30){ assert.equal(bus[1], 0, 'the kick resets dAge'); assert.ok(state.w >= 1.0, 'a downbeat kick strikes at ' + state.w.toFixed(2)); }
    else if (i > 30) assert.ok(bus[1] > prevAge, 'frame ' + i + ': dAge keeps counting through the hats (' + bus[1].toFixed(3) + ' after ' + prevAge.toFixed(3) + ')');
    prevAge = bus[1];
    if (i === 36) assert.ok(bus[2] > 0.5, 'the body arrives after the kick: dKick ' + bus[2].toFixed(2));
  }
  assert.ok(Math.abs(prevAge - 89 / 30) < 1e-3, 'dAge in beats: ' + prevAge.toFixed(4));
});

test('dance bus: stillness arrives — down in 1.5 beats, half a beat in true silence, up in an eighth', () => {
  const st = S.makeDanceBusState();
  const step = over => S.danceBusStep(st, busInp(over), BUS_DT).bus[10];
  // up: within 10% of the target in P/8 (4 frames at 120 BPM / 60 Hz)
  let v = 0;
  for (let i = 0; i < Math.ceil((0.5 / 8) / BUS_DT); i++) v = step({ ear: 0.85, energy: 0.3, bass: 0.3 });
  assert.ok(v >= 0.9, 'up in an eighth: ' + v.toFixed(3));
  for (let i = 0; i < 30; i++) v = step({ ear: 0.85, energy: 0.3, bass: 0.3 });
  assert.ok(v > 0.999, 'fully open: ' + v);
  // down, music still playing softly: 1.5 beats to zero — a gate, not a snap
  let n = 0;
  while (v > 1e-6 && n < 200){ v = step({ ear: 0.3, energy: 0.3, bass: 0.3 }); n++; }
  assert.ok(n <= 45 && n > 30, 'reached 0 in ' + n + ' frames (1.5 beats = 45)');
  assert.ok(v >= 0, 'never negative');
  // down in TRUE silence: half a beat
  for (let i = 0; i < 30; i++) v = step({ ear: 0.85, energy: 0.3, bass: 0.3 });
  n = 0;
  while (v > 1e-6 && n < 200){ v = step({ ear: 0.3, energy: 0.0, bass: 0 }); n++; }
  assert.ok(n <= 15 && n > 10, 'silence: reached 0 in ' + n + ' frames (0.5 beat = 15)');
  // not playing: the target is 0 whatever the ear says
  for (let i = 0; i < 30; i++) v = step({ ear: 1, energy: 0.8, bass: 0.8 });
  for (let i = 0; i < 46; i++) v = step({ ear: 1, energy: 0.8, bass: 0.8, playing: false });
  assert.ok(v <= 1e-6, 'paused: still ' + v);
  // the graded gate: a half-open ear holds a half-open gate
  for (let i = 0; i < 60; i++) v = step({ ear: 0.425, energy: 0.3, bass: 0.3 });
  assert.ok(Math.abs(v - 0.5) < 1e-6, 'ear 0.425 → still ' + v.toFixed(3));
});

test('dance bus: dMass follows the bass with a third of a beat up and two beats down', () => {
  const st = S.makeDanceBusState();
  let m = 0;
  for (let i = 0; i < 10; i++) m = S.danceBusStep(st, busInp({ bass: 1, energy: 0.5 }), BUS_DT).bus[3];   // P/3 = 10 frames
  assert.ok(Math.abs(m - (1 - Math.exp(-1))) < 0.01, 'after P/3 the follower sits at 1 − e⁻¹: ' + m.toFixed(4));
  for (let i = 0; i < 120; i++) m = S.danceBusStep(st, busInp({ bass: 1, energy: 0.5 }), BUS_DT).bus[3];
  assert.ok(m > 0.99, 'full weight: ' + m.toFixed(4));
  const top = m;
  for (let i = 0; i < 60; i++) m = S.danceBusStep(st, busInp({ bass: 0, energy: 0.1 }), BUS_DT).bus[3];       // 2P = 60 frames
  assert.ok(Math.abs(m - top * Math.exp(-1)) < 0.01, 'after 2P the release sits at e⁻¹: ' + m.toFixed(4));
  // dArtic: up in P/8, down in P/2 — and the melody's motion counts (the centroid moving)
  const st2 = S.makeDanceBusState();
  let a = 0;
  for (let i = 0; i < 4; i++) a = S.danceBusStep(st2, busInp({ mid: 1, treble: 0.5, energy: 0.5 }), BUS_DT).bus[4];   // P/8 ≈ 3.75 frames
  assert.ok(a > 0.6, 'articulation answers in an eighth: ' + a.toFixed(3));
  for (let i = 0; i < 60; i++) a = S.danceBusStep(st2, busInp({ mid: 1, treble: 0.5, energy: 0.5 }), BUS_DT).bus[4];
  const topA = a;
  for (let i = 0; i < 15; i++) a = S.danceBusStep(st2, busInp({ mid: 0, treble: 0, energy: 0.1 }), BUS_DT).bus[4];     // P/2 = 15 frames
  assert.ok(Math.abs(a - topA * Math.exp(-1)) < 0.02, 'after P/2 the articulation sits at e⁻¹: ' + a.toFixed(4));
  const st3 = S.makeDanceBusState();
  let moved = 0;
  for (let i = 0; i < 20; i++) moved = S.danceBusStep(st3, busInp({ mid: 0.2, treble: 0, energy: 0.3, centroid: 0.4 + 0.3 * (i % 2) }), BUS_DT).bus[4];
  assert.ok(moved > 0.5, 'a run sweeping the centroid reads as articulation: ' + moved.toFixed(3));
});

test('dance bus: the landing fires from a silent bar on the first loud frame, or at landAt + P/2 regardless', () => {
  const P = 0.5, la = S.danceLookahead(P);
  assert.ok(Math.abs(la - 1.2) < 1e-9, 'precognition reads 2P + 0.2 s ahead');
  // A. the score: a silent bar, then the drop at 2.0 s. here = env(pos + 0.08), soon = env(pos + lookahead)
  const env = t => ({ bass: t < 2 ? 0.05 : 0.9, punch: (t >= 2 && t < 2.1) ? 0.9 : 0 });
  let st = S.makeDanceBusState(), landedAt = -1, braceBefore = 0, hitAfter = 0, kickAfter = 0;
  for (let i = 0; i < 240; i++){
    const pos = i * BUS_DT;
    const quiet = pos + 0.08 < 2;
    const { bus, state } = S.danceBusStep(st, busInp({
      bass: quiet ? 0.05 : 0.9, mid: quiet ? 0.05 : 0.5, treble: 0.05, energy: quiet ? 0.04 : 0.8,
      rb: (!quiet && pos + 0.08 < 2.02) ? 0.8 : 0, punch: (!quiet && pos + 0.08 < 2.02) ? 0.9 : 0,
      ear: quiet ? 0.3 : 0.9, beatIdx: Math.floor(pos / P) % 4,
      pos, here: env(pos + 0.08), soon: env(pos + la),
    }), BUS_DT);
    if (state.landed){
      assert.equal(landedAt, -1, 'the landing fires once');
      landedAt = i;
      assert.equal(bus[9], 0, 'dImpact is 0 on the landing frame');
      assert.equal(bus[1], 0, 'the landing is a strike: dAge 0');
      assert.equal(bus[8], 0, 'the coil lets go: dBrace 0');
      assert.ok(quiet || pos + 0.08 < 2.05, 'it landed on the first loud frame (pos ' + pos.toFixed(3) + ')');
    }
    if (landedAt < 0 && pos > 1.8) braceBefore = Math.max(braceBefore, bus[8]);
    if (landedAt >= 0 && i <= landedAt + 8){ hitAfter = Math.max(hitAfter, bus[0]); kickAfter = Math.max(kickAfter, bus[2]); }
  }
  assert.ok(landedAt > 0, 'it landed');
  const landPos = landedAt * BUS_DT;
  assert.ok(landPos >= 2.0 - 0.08 - 1e-9 && landPos < 2.0 - 0.08 + 2 * BUS_DT, 'the landing is on the first frame that reads the drop (pos ' + landPos.toFixed(4) + ', read 80 ms ahead)');
  assert.ok(braceBefore > 0.9, 'the room braced through the silent bar: ' + braceBefore.toFixed(3));
  assert.ok(hitAfter >= 1.0, 'the landing lights dHit to ' + hitAfter.toFixed(2));
  assert.ok(kickAfter > 1.0, 'the landing strikes the body at 1.25: dKick peaked ' + kickAfter.toFixed(2));
  // B. a promise the music breaks: soon says a drop, here never gets loud → landAt + P/2 regardless
  st = S.makeDanceBusState(); landedAt = -1;
  for (let i = 0; i < 240; i++){
    const pos = i * BUS_DT;
    const promise = pos >= 0.8 && pos < 1.1;           // ≥ P/2 of promise: a passage, so the latch arms (landAt = 0.8 + la)
    const { state } = S.danceBusStep(st, busInp({
      bass: 0.05, energy: 0.04, ear: 0.3, pos,
      here: { bass: 0.05, punch: 0 }, soon: { bass: promise ? 0.9 : 0.05, punch: promise ? 0.8 : 0 },
    }), BUS_DT);
    if (state.landed){ assert.equal(landedAt, -1); landedAt = i; }
  }
  assert.ok(landedAt > 0, 'the latch cannot hang');
  assert.ok(Math.abs(landedAt * BUS_DT - (0.8 + la + P / 2)) <= BUS_DT + 1e-9, 'timed out at landAt + P/2: pos ' + (landedAt * BUS_DT).toFixed(3) + ' vs ' + (0.8 + la + P / 2).toFixed(3));
  // C. no score at all: nothing braces, nothing lands, the bus is still defined
  st = S.makeDanceBusState();
  for (let i = 0; i < 120; i++){
    const { bus, state } = S.danceBusStep(st, busInp({ bass: 0.6, energy: 0.5 }), BUS_DT);
    assert.ok(!state.landed && bus[8] === 0 && bus[9] === 8, 'frame ' + i + ': no score, no landing');
  }
  // D. the pure latch by itself: a promise must hold for P/2 (an instant is a kick,
  // half a beat is a passage); landAt is the promise's FIRST moment + lookahead;
  // a promise that lapses restarts its clock; a seek backwards disarms it
  const L = { armed: false, landAt: 0, landLevel: 0, comingSince: NaN };
  const say = (pos, coming, here, soon) => S.danceLandingStep(L, { pos, coming, here, soon, P, lookahead: la });
  assert.equal(say(10, 0.9, 0.1, 1.5), false);
  assert.ok(!L.armed, 'one frame of promise does not arm');
  say(10.1, 0.9, 0.1, 1.5);
  assert.ok(!L.armed, 'nor a fifth of a beat');
  say(10.25, 0.9, 0.1, 1.5);
  assert.ok(L.armed && Math.abs(L.landAt - 11.2) < 1e-9 && L.landLevel === 1.5, 'armed after P/2 of promise, landAt = its first moment + lookahead: ' + L.landAt);
  assert.equal(say(11.0, 0, 1.0, 0), false, 'loud, but not yet within P/4 of the promised moment');
  assert.equal(say(11.1, 0, 1.0, 0), true, 'within P/4 and at 60% of the promise: land');
  say(20, 0.9, 0.1, 1.5); say(20.15, 0, 0.1, 0.1); say(20.2, 0.9, 0.1, 1.5); say(20.4, 0.9, 0.1, 1.5);
  assert.ok(!L.armed, 'a promise that lapsed restarts its clock: 0.2 s since 20.2 is not P/2');
  say(20.45, 0.9, 0.1, 1.5);
  assert.ok(L.armed && Math.abs(L.landAt - 21.4) < 1e-9, 'armed from the renewed promise: landAt ' + L.landAt);
  say(2, 0, 0, 0);
  assert.equal(L.armed, false, 'a seek backwards disarms the latch');
  assert.equal(say(NaN, 0.9, 0, 1), false, 'no playhead, no landing');
});

// a 48 Hz env of 0..9 digit strings (the pipeline's score format) from a function of time
function digitEnv(hz, dur, fn){
  const n = Math.ceil(dur * hz) + 1;
  let b = '', m = '', t = '', o = '';
  const dig = v => String.fromCharCode(48 + Math.max(0, Math.min(9, Math.round(v * 9))));
  for (let i = 0; i < n; i++){ const s = fn(i / hz); b += dig(s.bass); m += dig(s.mid); t += dig(s.treble); o += dig(s.punch); }
  return { hz, b, m, t, o };
}
// a four-on-the-floor groove: kicks on 1 and 3 (bass bump 0.6·e^(−d/0.1) on the floor, punch 0.9 in the kick's step),
// `floor` the sustained bass; silent before t0
function grooveFn(t0, floor, hz){
  return t => {
    if (t < t0) return { bass: 0, mid: 0, treble: 0, punch: 0 };
    const d = (t - t0) % 1.0;                    // kicks every two beats at 120 BPM
    return { bass: Math.min(1, floor + 0.6 * Math.exp(-d / 0.1)), mid: 0.22, treble: 0.12, punch: d < 1 / hz ? 0.9 : 0 };
  };
}

test('dance bus: a steady 8-bar groove with kicks on 1 and 3 never arms the latch; the same kicks after two silent bars land on the first loud frame', () => {
  const P = 0.5, la = S.danceLookahead(P), hz = 48;
  // the engine's feed: pos = the playhead (read 80 ms ahead), here/soon the instants, hereW/soonW the beat means (danceWindowLevel)
  const run = (env, secs, onFrame) => {
    const st = S.makeDanceBusState();
    let f = { bass: 0, mid: 0, treble: 0 };
    for (let i = 0; i < Math.round(secs * BUS_FPS); i++){
      const pos = i * BUS_DT + 0.08;
      const here = S.envSample(env, pos), soon = S.envSample(env, pos + la);
      f.bass = S.envFollow(f.bass, here.bass, BUS_DT, 0.018, 0.11);
      f.mid = S.envFollow(f.mid, here.mid, BUS_DT, 0.018, 0.11);
      f.treble = S.envFollow(f.treble, here.treble, BUS_DT, 0.016, 0.13);
      const { state } = S.danceBusStep(st, busInp({
        bass: f.bass, mid: f.mid, treble: f.treble, energy: Math.min(1, (f.bass * 1.25 + f.mid + f.treble * 0.8) / 2),
        beatIdx: Math.floor(pos / P) % 4, barPhase: (pos / (4 * P)) % 1,
        pos, here, soon, hereW: S.danceWindowLevel(env, pos, P), soonW: S.danceWindowLevel(env, pos + la, P),
      }), BUS_DT);
      onFrame(pos, state);
    }
  };
  // A. the groove, from the first frame: 8 bars, no silence before it
  const groove = digitEnv(hz, 20, grooveFn(0, 0.28, hz));
  let armedFrames = 0, landings = 0, comingMax = 0;
  run(groove, 16, (pos, st) => { if (st.armed) armedFrames++; if (st.landed) landings++; if (pos > 2) comingMax = Math.max(comingMax, st.coming); });
  assert.equal(armedFrames, 0, 'the latch never armed through the groove');
  assert.equal(landings, 0, 'and never landed (stage 1 saw a landing every other bar)');
  assert.ok(comingMax < 0.42 * 0.75, 'the beat-mean `coming` of a steady groove stays well under the threshold: ' + comingMax.toFixed(3));
  // B. the control: the SAME kicks arriving after two silent bars (a drop from silence) land on the first loud frame
  const drop = digitEnv(hz, 12, grooveFn(4.0, 0.5, hz));
  let landedPos = -1, count = 0;
  run(drop, 10, (pos, st) => { if (st.landed){ count++; if (landedPos < 0) landedPos = pos; } });
  assert.equal(count, 1, 'one landing');
  // envSample interpolates the tonal bands between digits, so the drop's bass is read up to one env step (1/hz) early
  assert.ok(landedPos >= 4.0 - 1 / hz - 1e-9 && landedPos < 4.0 + 2 * BUS_DT + 1e-9, 'on the first frame that reads the drop: pos ' + landedPos.toFixed(4));
  // C. danceWindowLevel: a beat's mean of a steady groove is the same wherever the window sits; a drop lifts it; no env reads 0
  const levels = [];
  for (let t = 2; t < 10; t += 0.05) levels.push(S.danceWindowLevel(groove, t, P));
  const spread = Math.max(...levels) - Math.min(...levels);
  // kicks every two beats under a one-beat window: the mean does move as a kick enters and leaves the window,
  // but by less than three quarters of the threshold — that spread IS the largest `coming` a groove can show
  assert.ok(spread < 0.42 * 0.75, 'the groove\'s beat mean moves less than ¾ of the threshold with the window\'s position: spread ' + spread.toFixed(3));
  assert.ok(S.danceWindowLevel(drop, 3.0, P) < 0.01 && S.danceWindowLevel(drop, 5.0, P) > 0.5, 'silence reads ~0, the drop reads its weight');
  assert.equal(S.danceWindowLevel(null, 1, P), 0, 'no env, no level');
});

test('dance v2: the warp is slew-limited — uTime never runs backwards through a mass that fills in a frame or a phase that jumps', () => {
  const P = 0.5, dt = 1 / 60;
  let time = 0, warp = 0, prevU = null, prevRaw = null, minStep = Infinity, minRaw = Infinity;
  for (let i = 0; i < 600; i++){
    const rate = i < 300 ? 1 : 0.4;                       // the rubato at its floor for the second half
    time += dt * rate;
    let phi = ((i * dt) / P) % 1;
    if (i >= 200) phi = (phi + 0.5) % 1;                  // the grid re-derived: a half-beat phase jump at frame 200
    const mass = i < 90 ? 0 : 1;                          // the drop fills dMass in one frame, at phi = 0 (the surge's deepest point)
    const target = S.danceTimeWarp(phi, P, mass);
    warp = S.danceWarpSlew(warp, target, dt, rate);
    const u = time + warp, raw = time + target;
    if (prevU != null){ minStep = Math.min(minStep, u - prevU); minRaw = Math.min(minRaw, raw - prevRaw); }
    prevU = u; prevRaw = raw;
    assert.ok(Math.abs(warp) <= 0.045 + 1e-9, 'the warp stays within its 45 ms bound: ' + warp);
  }
  assert.ok(minRaw < 0, 'the unslewed warp DID run uTime backwards on this sequence (' + (minRaw * 1000).toFixed(1) + ' ms) — the test bites');
  assert.ok(minStep > 0, 'slewed, uTime strictly increases: min step ' + (minStep * 1000).toFixed(3) + ' ms');
  assert.ok(minStep >= 0.1 * dt * 0.4 - 1e-12, 'at least a tenth of the frame\'s musical time always survives');
  // the pure limiter: ±0.9·dt·rate a frame, finite on junk
  assert.ok(Math.abs(S.danceWarpSlew(0, -1, 1 / 60, 1) - (-0.9 / 60)) < 1e-12, 'a fall is held to 0.9·dt·rate');
  assert.ok(Math.abs(S.danceWarpSlew(0, 1, 1 / 60, 0.5) - 0.45 / 60) < 1e-12, 'and scales with the rate');
  assert.ok(Math.abs(S.danceWarpSlew(0.01, 0.012, 1 / 60, 1) - 0.012) < 1e-12, 'a small move passes through');
  assert.ok(isFinite(S.danceWarpSlew(NaN, NaN, NaN, NaN)), 'finite on junk');
});

test('dance v2: danceSectionTurn — a quieter section within the last beat, or true silence; never a louder one, never an old turn', () => {
  assert.equal(S.danceSectionTurn(0.7, 0.3, 0.4, 0.2), true, 'the new section at 0.43× within the beat');
  assert.equal(S.danceSectionTurn(0.7, 0.42, 0.4, 0.99), true, 'exactly 0.6× still counts, right up to one beat');
  assert.equal(S.danceSectionTurn(0.7, 0.5, 0.4, 0.2), false, 'not quiet enough (0.71×)');
  assert.equal(S.danceSectionTurn(0.3, 0.7, 0.4, 0.2), false, 'a LOUDER section is not a held breath');
  assert.equal(S.danceSectionTurn(0.7, 0.3, 0.4, 1.0), false, 'a turn a whole beat old has passed');
  assert.equal(S.danceSectionTurn(0.7, 0.3, 0.4, -0.1), false, 'a turn still ahead is not yet');
  assert.equal(S.danceSectionTurn(0.7, 0.7, 0.02, 0.5), true, 'true silence (energy < 0.05) is a quiet turn whatever the map says');
  assert.equal(S.danceSectionTurn(0, 0, 0.02, 0.5), true, 'the silence path needs no levels');
  assert.equal(S.danceSectionTurn(0, 0, 0.5, 0.5), false, 'no levels and no silence: nothing');
  assert.equal(S.danceSectionTurn(NaN, NaN, NaN, NaN), false, 'junk: false');
});

test('dance v2: danceSilenceAhead — the score sees the silence start: fires on its first frame, never inside a groove, never on a sparse beat, never from silence', () => {
  const P = 0.5, hz = 48;
  // a groove that STOPS at 8.0 s (the harness piece's silent bar): kicks on 1 and 3 on a bass floor, mids and treble as a pad
  const stop = digitEnv(hz, 12, t => { if (t >= 8) return { bass: 0, mid: 0, treble: 0, punch: 0 }; return grooveFn(0, 0.28, hz)(t); });
  let first = -1, count = 0, inGroove = 0;
  for (let t = 0.5; t < 11; t += 1 / 60){
    const on = S.danceSilenceAhead(stop, t, P);
    if (on){ count++; if (first < 0) first = t; if (t < 7.9) inGroove++; }
  }
  assert.equal(inGroove, 0, 'never through the groove');
  /* WHERE THE FIRST TRUE FRAME MUST LAND (the function's comment, held to).
     envSample interpolates the bands between digits, so the last sounding
     digit (level L) bleeds into the first silent step as L·(1 − fr). The
     function demands the FIRST step of the beat ahead — the tap at t + P/(2n),
     n = P·hz = 24 — under the floor 0.05, which that tap reaches within
     (0.05/L)/hz ≤ 1/hz of the first silent digit; so the first true frame
     is never earlier than onset − 1/hz − P/(2n), and never later than the
     first frame at or after the onset. (The mean alone would have admitted
     ~0.05·n/L ≈ 2 steps of this 0.67 groove and fired at 7.9667: two frames
     early, by an amount that depended on the groove's level.) */
  const n = Math.ceil(P * hz);
  assert.ok(first >= 8 - 1 / hz - P / (2 * n) - 1e-9 && first <= 8 + 1 / 60 + 1e-9, 'true on the silence\'s first frame: ' + first.toFixed(4));
  // this groove's last digits read 3/9 + 2/9 + 1/9 = 0.667, so the first tap is under the floor only
  // within 1.6 ms of the onset: on the 60 Hz lattice that is the frame AT the onset, 8.000
  assert.ok(Math.abs(first - 8) < 1e-9, 'for a 0.67 groove the first true frame is the one at the onset: ' + first.toFixed(4));
  assert.ok(count >= 6 && count <= 40, 'and for the beat the behind window still holds the groove (' + count + ' frames), then no more');
  for (let t = 9.5; t < 11; t += 0.1) assert.equal(S.danceSilenceAhead(stop, t, P), false, 'a silence after a silence is no turn (' + t.toFixed(1) + ')');
  // a SPARSE track: one bare kick every beat on no floor, nothing else — a beat with a hit in it is never "empty"
  const sparse = digitEnv(hz, 10, t => { const d = t % P; return { bass: 0.6 * Math.exp(-d / 0.1), mid: 0, treble: 0, punch: d < 1 / hz ? 0.9 : 0 }; });
  for (let t = 1; t < 9; t += 1 / 60) assert.equal(S.danceSilenceAhead(sparse, t, P), false, 'a kick every beat: never (' + t.toFixed(3) + ')');
  // a snare-only beat after a loud beat: the mids are sound
  const snareBeat = digitEnv(hz, 6, t => t < 2 ? { bass: 0.7, mid: 0.4, treble: 0.2, punch: t % P < 1 / hz ? 0.9 : 0 } : t < 2.5 ? { bass: 0, mid: 0.35, treble: 0.1, punch: 0 } : { bass: 0.7, mid: 0.4, treble: 0.2, punch: 0 });
  for (let t = 1.5; t < 2.6; t += 1 / 60) assert.equal(S.danceSilenceAhead(snareBeat, t, P), false, 'the bass drops out for a beat but the snare plays: no turn (' + t.toFixed(3) + ')');
  // the beat ahead with one lone hat in it: a gap, not a beat. (The sound after it returns at 2.6, not 2.5: envSample's
  // interpolation lets the window's LAST tap read half a step into whatever follows — a loud section starting exactly at
  // the window's end adds 0.028 to the mean, which with the hat's 0.032 is over the floor; a one-beat hole between two
  // loud sections is not a silence to hold a breath for anyway, and never was: this assertion sat behind a failing one.)
  const hatBeat = digitEnv(hz, 6, t => t < 2 ? { bass: 0.7, mid: 0.4, treble: 0.2, punch: 0 } : t < 2.6 ? { bass: 0, mid: 0, treble: Math.abs(t - 2.25) < 1 / hz ? 0.6 : 0, punch: Math.abs(t - 2.25) < 1 / hz ? 0.25 : 0 } : { bass: 0.7, mid: 0.4, treble: 0.2, punch: 0 });
  assert.equal(S.danceSilenceAhead(hatBeat, 2.0, P), true, 'a single hat 21 ms wide in an otherwise empty beat reads under the floor: it IS a gap (one hit in 24 steps = 0.03)');
  assert.equal(S.danceSilenceAhead(hatBeat, 1.9833, P), false, 'one frame earlier the first step still carries the pad: not yet');
  assert.equal(S.danceSilenceAhead(null, 1, P), false, 'no env, no turn');
  assert.equal(S.danceSilenceAhead(stop, NaN, P), false, 'no playhead, no turn');
  assert.equal(S.danceSilenceAhead(stop, 8.0, 0), false, 'no period, no turn');
});

test('dance bus: the prelude shapes — stride monotone to A 0.75, the landing one rebound, the ring its series, the lamp held then let go', () => {
  // stride: strictly increasing in ph, slope ≥ 0.25 at A = 0.75, zero-mean wobble (1 at the wrap)
  for (const A of [0, 0.25, 0.5, 0.75]){
    let prev = -1, minSlope = Infinity;
    for (let i = 0; i <= 1000; i++){
      const v = S.danceStrideJS(i / 1000, A);
      if (i) minSlope = Math.min(minSlope, (v - prev) * 1000);
      assert.ok(v > prev, 'A ' + A + ': monotone at ' + i / 1000);
      prev = v;
    }
    assert.ok(minSlope >= 0.25 - 0.01, 'A ' + A + ': the slowest step keeps moving (' + minSlope.toFixed(3) + ')');
    assert.ok(Math.abs(S.danceStrideJS(1, A) - 1) < 1e-12 && Math.abs(S.danceStrideJS(0, A)) < 1e-12, 'zero-mean: the wrap is exact');
    assert.ok(S.danceStrideJS(0.25, A) >= 0.25 - 1e-12 && S.danceStrideJS(0.75, A) <= 0.75 + 1e-12, 'ahead in the first half, behind in the second');
  }
  // the landing: peak 1 near 0.42 beat, exactly one rebound below rest, quiet from a bar
  let peak = 0, peakAt = 0, mins = 0, prev = 0, prev2 = 0;
  for (let i = 0; i <= 8000; i++){
    const t = i / 1000, v = S.danceLandJS(t);
    if (v > peak){ peak = v; peakAt = t; }
    if (i >= 2 && prev < prev2 && prev <= v && prev < -0.05) mins++;
    if (t >= 4) assert.ok(Math.abs(v) < 0.05, 'settled by a bar: ' + v.toFixed(4) + ' at ' + t);
    prev2 = prev; prev = v;
  }
  assert.ok(Math.abs(peak - 1) < 2e-3, 'peaks at 1: ' + peak.toFixed(4));
  assert.ok(Math.abs(peakAt - 0.418) < 0.01, 'the body arrives at 0.42 beat: ' + peakAt.toFixed(3));
  assert.equal(mins, 1, 'one rebound below rest');
  assert.ok(S.danceLandJS(1.47) < -0.3, 'the exhale: ' + S.danceLandJS(1.47).toFixed(3));
  assert.equal(S.danceLandJS(8), 0); assert.equal(S.danceLandJS(0), 0); assert.equal(S.danceLandJS(-1), 0);
  // the ring equals the series Σ e^{-a(ph+k)} sin(b(ph+k)) and is continuous at the wrap
  for (const [a, b] of [[2.5, Math.PI * 3], [1.5, Math.PI * 2], [4, Math.PI * 5]]){
    for (let i = 0; i <= 20; i++){
      const ph = i / 20;
      let sum = 0;
      for (let k = 0; k < 80; k++) sum += Math.exp(-a * (ph + k)) * Math.sin(b * (ph + k));
      assert.ok(Math.abs(S.danceRingJS(ph, a, b) - sum) < 1e-9, 'ring(' + ph + ', ' + a + ', ' + b.toFixed(2) + ') = ' + sum.toFixed(6));
    }
    assert.ok(Math.abs(S.danceRingJS(1, a, b) - S.danceRingJS(0, a, b)) < 1e-9, 'continuous at the wrap');
  }
  // the lamp: dark at the strike, lit by 0.12 beat, held, released in the last third, out after the beat
  assert.equal(S.danceLampJS(1, 0), 0);
  assert.ok(Math.abs(S.danceLampJS(1, 0.12) - 1) < 1e-9 && Math.abs(S.danceLampJS(0, 0.3) - 0.5) < 1e-9, 'lit to 0.5 + 0.5·hit');
  assert.ok(Math.abs(S.danceLampJS(1, 0.5) - 1) < 1e-9, 'held through the fall');
  assert.ok(S.danceLampJS(1, 0.8) < 0.6 && S.danceLampJS(1, 0.8) > 0.1, 'letting go: ' + S.danceLampJS(1, 0.8).toFixed(3));
  assert.equal(S.danceLampJS(1, 1.01), 0, 'out after the beat');
  // the front: the head is where the age says
  assert.ok(Math.abs(S.danceFrontJS(0, 0, 0.2) - 1) < 1e-12 && Math.abs(S.danceFrontJS(1, 1, 0.2) - 1) < 1e-12 && Math.abs(S.danceFrontJS(1, 3, 0.2) - 1) < 1e-12);
  assert.ok(S.danceFrontJS(0.5, 0, 0.2) < 0.01 && Math.abs(S.danceFrontJS(0.5, 0.5, 0.2) - 1) < 1e-12);
  // the lean: 0 through the middle of the beat, loaded by 0.92, carried ACROSS the beat line (1 at the wrap and at ph 0:
  // the release is never its own step) and unloaded INTO the kick by 0.15 beat (75 ms at 120 BPM, inside the spring's
  // 100 ms rise); monotone on each flank; stillness and the grid scale it
  assert.equal(S.danceLeanJS(0.5, 1, true), 0);
  assert.equal(S.danceLeanJS(0.3, 1, true), 0, '0 through the middle of the beat');
  assert.ok(S.danceLeanJS(0.92, 1, true) > 0.95 && S.danceLeanJS(0.92, 1, true) <= 1);
  assert.ok(Math.abs(S.danceLeanJS(1, 1, true) - 1) < 1e-12 && Math.abs(S.danceLeanJS(0, 1, true) - 1) < 1e-12, '1 at the wrap: continuous across the beat line');
  assert.ok(Math.abs(S.danceLeanJS(0.999, 1, true) - S.danceLeanJS(0.001, 1, true)) < 0.01, 'no step at the beat line');
  assert.equal(S.danceLeanJS(0.15, 1, true), 0, 'unloaded by 0.15 beat');
  assert.ok(S.danceLeanJS(0.075, 1, true) > 0.45 && S.danceLeanJS(0.075, 1, true) < 0.55, 'half gone at 0.075: ' + S.danceLeanJS(0.075, 1, true).toFixed(3));
  for (let i = 1; i <= 30; i++){                           // monotone down on [0, 0.15]: it unloads, never twitches
    const a = S.danceLeanJS((i - 1) * 0.005, 1, true), b = S.danceLeanJS(i * 0.005, 1, true);
    assert.ok(b <= a + 1e-12, 'unloads monotonically: ' + a.toFixed(4) + ' -> ' + b.toFixed(4) + ' at ' + (i * 0.005).toFixed(3));
  }
  for (let i = 1; i <= 32; i++){                           // monotone up on [0.6, 0.92]: it loads
    const a = S.danceLeanJS(0.6 + (i - 1) * 0.01, 1, true), b = S.danceLeanJS(0.6 + i * 0.01, 1, true);
    assert.ok(b >= a - 1e-12, 'loads monotonically: ' + a.toFixed(4) + ' -> ' + b.toFixed(4) + ' at ' + (0.6 + i * 0.01).toFixed(2));
  }
  assert.equal(S.danceLeanJS(0.92, 0, true), 0, 'still → no lean');
  assert.ok(Math.abs(S.danceLeanJS(0.92, 1, false) - 0.4 * S.danceLeanJS(0.92, 1, true)) < 1e-12, 'freewheel at 0.4');
  assert.ok(S.danceLeanJS(0.92, 0.5, true) < 0.5 * S.danceLeanJS(0.92, 1, true), 'a half-open gate leans less than half');
  // the count's weight and the breath
  assert.equal(S.danceBeatWeightJS(0.0, 0.5), 1); assert.equal(S.danceBeatWeightJS(0.5, 0.5), 0.8);
  assert.equal(S.danceBeatWeightJS(0.25, 0.5), 0.6); assert.equal(S.danceBeatWeightJS(0.75, 0.5), 0.6);
  assert.equal(S.danceBeatWeightJS(0.3, 0), 0.8, 'no bar → neutral');
  assert.ok(Math.abs(S.danceBreathJS(0.02, 0) - 1.02) < 1e-12 && Math.abs(S.danceBreathJS(0.02, 0.5) - 0.98) < 1e-12);
});

test('dance bus: the prelude is generated — the embedded GLSL and every marked Metal copy match tools/dance_prelude.mjs', async () => {
  const { pathToFileURL } = await import('url');
  const P = await import(pathToFileURL(join(root, 'tools/dance_prelude.mjs')).href);
  assert.deepEqual(P.check(root), [], 'node tools/dance_prelude.mjs --check');
  assert.deepEqual(P.BUS, S.DANCE_BUS.NAMES, 'the emitter and the stepper name the twelve in the same order');
  const glsl = P.emitGLSL();
  S.DANCE_BUS.NAMES.forEach((n, i) => assert.ok(glsl.includes('#define ' + n + ' uDance' + (i >> 2) + '.' + 'xyzw'[i & 3]), n + ' rides vec4 ' + (i >> 2)));
  assert.ok(html.includes('const GLSL_DANCE = `\n' + glsl + '`;'), 'GLSL_DANCE is the emitter\'s text');
  for (const ch of glsl) assert.ok(ch.charCodeAt(0) < 128, 'GLSL ES 1.0 source stays ASCII (' + JSON.stringify(ch) + ')');
  for (const l of glsl.split('\n')){                        // every numeric literal in code is a FLOAT literal
    const code = l.trim();
    if (!code || code.startsWith('//') || code.startsWith('#') || code.startsWith('uniform')) continue;
    const m = code.replace(/\/\/.*$/, '').match(/(?<![\w.])\d+(?![\w.])/);
    assert.ok(!m, 'a bare integer in GLSL ES 1.0 float math: ' + (m && m[0]) + ' in ' + code.slice(0, 60));
  }
  // the landing's constants are the stepper's
  const lit = x => x.toFixed(5);
  for (const k of ['LAND_NORM', 'LAND_DECAY', 'LAND_OMEGA']) assert.ok(glsl.includes(lit(S.DANCE_BUS[k])), k + ' = ' + lit(S.DANCE_BUS[k]) + ' is in the GLSL');
  // the two Metal modes
  const a = P.emitMSL({ mode: 'suffix', sfx: '_a' }), ns = P.emitMSL({ mode: 'namespace' });
  assert.ok(a.includes('inline float danceLean_a(constant VizUniforms& U, float ph)') && a.includes('danceBeatPhase_a(U)'), 'suffix mode: every helper carries _a and reads U');
  assert.ok(ns.includes('inline float danceLean(constant VizUniforms& U, float ph)') && !ns.includes('_a('), 'namespace mode: plain names');
  assert.ok(a.includes('inline float danceStride_a(float ph, float A)'), 'a pure helper takes no U');
  assert.ok(!a.includes('${') && !glsl.includes('${') && !glsl.includes('`'), 'nothing unexpanded');
  // the same body in both languages, modulo the accessor spelling
  const strip = s => s.split('\n').filter(l => l.startsWith('float ') || l.startsWith('inline float ') || l.startsWith('  float ')).map(l => l.trim().replace(/^inline /, '').replace(/constant VizUniforms& U, |constant VizUniforms& U/g, '').replace(/_a\(U\)/g, '()').replace(/_a\(/g, '(').replace(/U\.(\w+)/g, (_, f) => f === 'barPhase' ? 'uBarPhase' : f)).join('\n');
  assert.equal(strip(a), strip(glsl), 'GLSL and MSL helpers are one text');
  assert.throws(() => P.emitMSL({ mode: 'suffix', sfx: 'a' }), /suffix/, 'a suffix starts with _');
});

/* THE TEN LAWS, GREPPED — SPECTRAL, the first room re-choreographed on the dance
   bus (stage 4). Law 1 (no raw band on any displacement) is checked as a list of
   forbidden (uniform, target) pairs: every statement that assigns a radius,
   thickness, position, scale, angle, count, threshold or camera term is read, and
   none may contain a raw band or the live row. The rest: the prelude is prepended
   (so the room must not declare uBarPhase or shadow the twelve), the helpers the
   retelling is built from are read, every loop is literal-bounded, the whole-frame
   factor is never a beat, and the slow row is the body while the live row is light. */
test('SPECTRAL_FRAG keeps the ten laws: no raw band or live row on a displacement, the dance helpers read, loops literal-bounded', () => {
  const s0 = html.indexOf('const SPECTRAL_FRAG = '), s1 = html.indexOf('\n`;', s0);
  assert.ok(s0 >= 0 && s1 > s0, 'SPECTRAL_FRAG is in the player');
  const room = html.slice(s0, s1);
  assert.ok(room.startsWith('const SPECTRAL_FRAG = GLSL_MPHI + GLSL_DANCE + `'), 'GLSL_DANCE is prepended after GLSL_MPHI');
  assert.ok(!/uniform\s+float[^;]*\buBarPhase\b/.test(room), 'the room does not redeclare uBarPhase (the prelude declares it)');
  const twelve = ['dHit', 'dAge', 'dKick', 'dMass', 'dArtic', 'dSpark', 'dSway', 'dLift', 'dBrace', 'dImpact', 'dStill', 'dPeriod'];
  for (const n of twelve) assert.ok(!new RegExp('\\b(float|vec[234]|int|bool)\\s+' + n + '\\b').test(room), n + ' is a macro: never a local');
  // law 1 — the forbidden (raw input, displacement target) pairs
  const RAW = ['uBeat', 'uEnergy', 'uBass', 'uMid', 'uTreble', 'uBeatIdx', 'uAudio', 'uLiveA', 'uLiveB', 'lA', 'lB'];
  const TARGETS = {
    radius:    ['R', 'Hc', 'rpx', 'r', 'rb', 'rt', 'wr'],
    thickness: ['c.thA', 'c.thB', 'thA', 'thB', 'bodyA', 'bodyB', 'baseA', 'baseB', 'bell', 'swell', 'squash', 'th', 'fl'],
    position:  ['ro', 'ta', 'rd', 'uv', 'drift', 'p', 'pq', 'z', 'q', 'landA', 'landB'],
    scale:     ['reach', 'D', 'c.sc', 'c.lsc', 'c.lod', 's', 'c.pr', 'c.pa'],
    angle:     ['A', 'B', 'th', 'ph', 'e', 'be', 'roll', 'c.w0', 'c.wd', 'c.u1', 'c.u2', 'c.u3', 'c.u4', 'sa', 'bs'],
    count:     ['nF', 'qn', 'prim', 'frame', 'seed'],
    threshold: ['bA', 'bB', 'f', 'g', 'lo'],
    camera:    ['fw', 'rt0', 'up0', 'up', 'upH', 'dist', 'ldK', 'ldF'],
  };
  const pairs = [];
  for (const [kind, names] of Object.entries(TARGETS)) for (const n of names) for (const u of RAW) pairs.push([u, n, kind]);
  const esc = x => x.replace(/[.]/g, '\\.');
  const stmts = room.split('\n').map(l => l.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n').split(';');
  for (const [u, target, kind] of pairs){
    const lhs = new RegExp('(^|[^\\w.])(float|vec[234])?\\s*' + esc(target) + '\\s*(=|\\+=|-=|\\*=)(?!=)');
    const raw = new RegExp('\\b' + u + '\\b');
    for (const st of stmts) if (lhs.test(st)) assert.ok(!raw.test(st), `${u} reaches the ${kind} term ${target}: ${st.trim().slice(0, 90)}`);
  }
  const code = stmts.join(';');   // the room without its comments
  for (const u of ['uBeat', 'uEnergy', 'uBass', 'uMid', 'uTreble', 'uBeatIdx', 'uAudio']) assert.ok(!new RegExp('\\b' + u + '\\b').test(code), u + ' is not read anywhere in the room');
  // the live row reaches light only: shaped into lA/lB, which feed the haze weight (c.bn*) and the lit gain (bl)
  const liveUses = stmts.map(st => st.trim()).filter(st => /\b(uLiveA|uLiveB)\b/.test(st) && !st.startsWith('uniform'));
  assert.ok(liveUses.length === 2 && liveUses.every(st => /^(vec4 )?l[AB] = vec4\(spShape\(uLive/.test(st)), 'uLiveA/B are read only into lA/lB: ' + liveUses.join(' | '));
  const lUses = stmts.map(st => st.trim()).filter(st => /\bl[AB]\b/.test(st) && !/^(vec4 )?l[AB] = /.test(st));
  assert.deepEqual(lUses, ['c.bnA = lA', 'c.bnB = lB', 'float bl = spPick(lA, lB, int(lv + 0.5))'], 'lA/lB reach the haze weight and the lit gain only');
  assert.ok(/vec4 bA = vec4\(spShape\(uLvA\.x/.test(room) && /c\.thA = baseA \* bodyA/.test(room), 'the slow row (uLvA/B) is the body');
  // laws 2, 3, 6, 7, 8, 9, 10 — the helpers the retelling is built from
  for (const h of ['danceLamp(dHit, dAge)', 'danceLean(', 'danceStride(', 'danceLand(dImpact', 'danceFront(', 'danceBeatPhase()']) assert.ok(room.includes(h), 'reads ' + h);
  for (const d of ['dStill', 'dKick', 'dMass', 'dBrace', 'dImpact', 'dSway', 'dLift']) assert.ok(new RegExp('\\b' + d + '\\b').test(room), 'reads ' + d);
  assert.ok(/float pulseAmp = danceLamp\(dHit, dAge\) \* dStill \* heft/.test(room), 'the lamp: danceLamp(dHit, dAge) x dStill x heft (laws 6, 7, 8)');
  // LAW checks, not pins: the gate decides the amplitudes (round 2, R6) - the regexes allow any constant on the term
  assert.ok(/float kick = dKick \* heft;/.test(room) && /float swell = max\(kick, 0\.0\), squash = min\(kick, 0\.0\);/.test(room), 'the kick carries the count and the passage (heft) and the spring is read SIGNED: swell and squash (laws 2, 7)');
  assert.ok(/float bell = 0\.\d+ \* swell \+ 0\.\d+ \* squash - 0\.\d+ \* lean;/.test(room), 'the bell: both lobes of one rebound on dKick, drawn back by the lean (laws 2, 3)');
  assert.ok(/float reach = 1\.0 - 0\.\d+ \* kick\b[^;]*\+ 0\.\d+ \* lean\b/.test(room) && /const float TH = 0\.36;/.test(room), 'one dolly on dKick, signed, drawn back by the lean, the field of view a constant (laws 2, 3)');
  assert.ok(/float spBeatW\(\)\{/.test(room) && /fract\(uBarPhase - 0\.25 \* dAge \+ 0\.1\)/.test(room), 'the count\'s weight from the bar phase at the strike (law 7, the room\'s own)');
  assert.ok(!/\bTH\s*(=|\*=|\+=)/.test(room.replace('const float TH = 0.36;', '')), 'TH never moves');
  assert.ok(/float roll = 0\.\d+ \* dSway/.test(room) && /dLift/.test(room), 'the bar rolls, the phrase lifts (law 7)');
  // law 6's ban on the whole-frame multiplier: col's only whole-frame factor is the coil, never a hit
  for (const st of stmts) if (/(^|\s)col \*=/.test(st)) assert.ok(!/\b(dHit|dKick|pulseAmp|pulse|uEnergy|uBeat)\b/.test(st), 'no whole-frame multiplier on the hit: ' + st.trim());
  // every loop bounded by a compile-time literal
  const loops = [...room.matchAll(/for\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(loops.length >= 2, 'the march and the fold are loops');
  for (const l of loops) assert.ok(/^\s*int \w+ = 0;\s*\w+ < \d+;\s*\w+\+\+\s*$/.test(l), 'literal-bounded loop: ' + l);
  // the JS side: the two rows read, the two uniform pairs set
  const b0 = html.indexOf('function buildSpectral(){'), b1 = html.indexOf('/* ==== END ROOM REGION: SPECTRAL', b0);
  const build = html.slice(b0, b1);
  for (const u of ['uLvA', 'uLvB', 'uLiveA', 'uLiveB']) assert.ok(new RegExp(u + ':\\s*\\{ value: new THREE\\.Vector4').test(build) && build.includes('varU.' + u + '.value.set('), u + ' declared and written');
  assert.ok(/s \+= data\[AUDIO_LIVE \+ i\]; q \+= data\[i\];/.test(build), 'the live row and the slow row are both read');
});

/* THE TEN LAWS, GREPPED — PLOTTER, the second room re-choreographed on the dance
   bus (stage 4). The beat is a stroke along the pen's depth: struck on the hit,
   travelling near to far over the beat on every pen, weighted by the count and the
   passage; the camera lunges on the count and strides with the beat. LAW checks,
   never constant pins: the regexes allow any constant on a term, the gate decides
   the amplitudes. Law 1 is the forbidden (raw input, target) pairs plus the stronger
   claim that no raw band is read anywhere in the room; law 10's "the twin tells the
   same story" is checked by finding the web's dance statements, whitespace aside, in
   Shaders41.metal's room_plotter. */
test('buildPlotter keeps the ten laws: the stroke on the beat\'s own age, no raw band anywhere, the dance helpers read, the twin the same text', () => {
  const b0 = html.indexOf('function buildPlotter(){'), b1 = html.indexOf('/* ==== END ROOM REGION: PLOTTER', b0);
  assert.ok(b0 >= 0 && b1 > b0, 'buildPlotter is in the player');
  const build = html.slice(b0, b1);
  const f0 = build.indexOf('const frag = '), f1 = build.indexOf('\n  `;', f0);
  assert.ok(f0 >= 0 && f1 > f0, 'the fragment is inline in the builder');
  const room = build.slice(f0, f1);
  assert.ok(room.startsWith('const frag = GLSL_MPHI + GLSL_DANCE + `'), 'GLSL_DANCE is prepended after GLSL_MPHI');
  assert.ok(!/uniform\s+float[^;]*\buBarPhase\b/.test(room), 'the room does not redeclare uBarPhase (the prelude declares it)');
  const twelve = ['dHit', 'dAge', 'dKick', 'dMass', 'dArtic', 'dSpark', 'dSway', 'dLift', 'dBrace', 'dImpact', 'dStill', 'dPeriod'];
  for (const n of twelve) assert.ok(!new RegExp('\\b(float|vec[234]|int|bool)\\s+' + n + '\\b').test(room), n + ' is a macro: never a local');
  const stmts = room.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').split(';');
  const code = stmts.join(';');
  // law 1 — no raw band, no beat envelope, no pulse anywhere in the room; and the pairs, so a future edit is named precisely
  const RAW = ['uBass', 'uMid', 'uTreble', 'uEnergy', 'uBeat', 'uPulse', 'uBeatIdx', 'uAudio'];
  for (const u of RAW) assert.ok(!new RegExp('\\b' + u + '\\b').test(code), u + ' is not read anywhere in the room');
  const TARGETS = {
    thickness: ['wOut', 'kP', 'hwMin', 'hwMaj', 'hw2', 'hw3', 'hwR', 'swell', 'wS', 'rim'],
    position:  ['ang', 'f1', 'fl', 'tf', 'tL', 'headF', 'liftF', 'ro', 'ageS'],
    camera:    ['az', 'el', 'dist', 'Tw', 'lunge'],
    count:     ['lo', 'hi', 'th1', 'th2', 'fam', 'famCalm', 'dealt', 'barOn', 'halfs', 'ring2'],
  };
  for (const [kind, names] of Object.entries(TARGETS)) for (const n of names) {
    const lhs = new RegExp('(^|[^\\w.])(float|vec[234])?\\s*' + n + '\\s*(=|\\+=|-=|\\*=)(?!=)');
    for (const st of stmts) if (lhs.test(st)) for (const u of RAW.concat(['bass', 'mid', 'treble', 'energy', 'beat', 'pulse']))
      assert.ok(!new RegExp('\\b' + u + '\\b').test(st), `${u} reaches the ${kind} term ${n}: ${st.trim().slice(0, 90)}`);
  }
  // law 5 — the hats are light: dSpark never in a width, a position or a count
  for (const [kind, names] of Object.entries(TARGETS)) for (const n of names) {
    const lhs = new RegExp('(^|[^\\w.])(float|vec[234])?\\s*' + n + '\\s*(=|\\+=|-=|\\*=)(?!=)');
    for (const st of stmts) if (lhs.test(st)) assert.ok(!/\b(dSpark|hair)\b/.test(st), `the hats reach the ${kind} term ${n}: ${st.trim().slice(0, 90)}`);
  }
  assert.ok(/float hair = 1\.0 \+ 0\.\d+ \* dSpark;/.test(room), 'the hats: a hairline of light (law 5)');
  // the helpers the retelling is built from, and the bus fields it reads
  for (const h of ['danceLamp(dHit, ageS)', 'danceLean(', 'danceStride(', 'danceLand(dImpact', 'danceHeld(', 'danceBeatPhase()']) assert.ok(room.includes(h), 'reads ' + h);
  for (const d of ['dStill', 'dKick', 'dMass', 'dBrace', 'dImpact', 'dSway', 'dLift', 'dSpark', 'dPeriod']) assert.ok(new RegExp('\\b' + d + '\\b').test(code), 'reads ' + d);
  assert.ok(!/\bdArtic\b/.test(code), 'law 4: live dArtic is not read (the turn is held per bar through danceHeld)');
  // law 6 — the beat is a stroke with a place: struck by danceLamp, placed by dAge along the pen's depth, on every pen
  assert.ok(/float lamp = danceLamp\(dHit, ageS\) \* dStill \* heft \* cnt\b/.test(room), 'the lamp: danceLamp(dHit, the stroke\'s age) x dStill x the passage x the count (laws 6, 7, 8)');
  assert.ok(/float tf = tC \+ tNear \+ \(tFar - tNear\) \* min\(ageS, 1\.0\);/.test(room), 'the stroke runs near to far along the ray over one beat, on the stroke\'s age');
  // R1 (the refine): the stroke's clock is the beat's own age - a strike on the beat line restarts it, one inside a beat
  // already struck (a roll's 8th or 16th) never rewinds it. Evaluated from the room's own two statements on rolls at 60 fps
  const spM = room.match(/float sp = (fract\(bp - dAge[^;]+);/), agM = room.match(/float ageS = ([^;]+);/);
  assert.ok(spM && agM && /\bdAge\b/.test(agM[1]) && /\bdPeriod > 0\.0\b/.test(agM[1]), 'the stroke\'s clock (sp, ageS) on dAge, freewheeling on dAge alone');
  const js = e => e.replace(/\bfract\(/g, 'F(').replace(/\bsmoothstep\(/g, 'S(').replace(/\bmax\(/g, 'Math.max(').replace(/\bmin\(/g, 'Math.min(');
  const ageOf = new Function('bp', 'dAge', 'dPeriod', 'F', 'S', 'const sp = ' + js(spM[1]) + '; return ' + js(agM[1]) + ';');
  const Ff = x => x - Math.floor(x), Sf = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
  for (const [step, early] of [[0.25, 0.02], [0.5, 0.02], [0.25, -0.05], [1.0, 0.03]]){
    // strikes every `step` beat, rendered `early` beat before their grid line (negative: a frame's late detection)
    let prev = null, last = -9;
    for (let f = 0; f < 4 * 30; f++){
      const t = f / 30, bp = Ff(t);
      const k = Math.floor((t + early) / step + 1e-9), st = k * step - early;
      const struck = st <= t + 1e-9 && st > last + 1e-9;
      if (struck) last = st;
      const dAge = Math.min(4, t - last), ageS = ageOf(bp, dAge, 0.5, Ff, Sf);
      const onLine = Math.abs(Ff(last + early + 0.5) - 0.5) < 1e-6;
      if (struck && prev != null && !onLine)
        assert.ok(ageS >= prev - 1e-6, `a strike inside the beat (every ${step} beat) never rewinds the stroke: ${prev.toFixed(3)} -> ${ageS.toFixed(3)} at beat ${t.toFixed(3)}`);
      if (struck && onLine) assert.ok(ageS < 0.1, `a strike on the beat line restarts the stroke (${ageS.toFixed(3)})`);
      if (step === 1.0) assert.ok(Math.abs(ageS - dAge) < 1e-9, 'the groove (strikes on the beat lines only) runs on dAge itself');
      prev = ageS;
    }
  }
  assert.ok(ageOf(0.5, 0.3, 0.0, Ff, Sf) === 0.3, 'freewheeling, the stroke\'s clock is dAge');
  assert.ok(/float band = ptKnee\(ptBand\(t, tf, bw\) \* lamp\);/.test(room) && /float ptKnee\(float x\)\{ return x < ([\d.]+) \? x : \1 \+ \(x - \1\) \/ \(1\.0 \+ [\d.]+ \* \(x - \1\)\); \}/.test(room), 'the stroke is heavier through a knee (C1, linear below it), never a fused band (R3)');
  for (const st of stmts) if (/float swell = /.test(st)) assert.ok(/min\([^;]*, \d\.\d+\)/.test(st), 'the width swell is capped: ' + st.trim());
  assert.ok(/ptBand\(t, tf, bw\) \* lamp/.test(room) && /ptBand\(grazeT, tf, bw\) \* lamp/.test(room) && /ptBand\(gminT, tf, bw\) \* lamp/.test(room), 'every pen takes the stroke at its own depth: the hit, the occlusion contour, the silhouette');
  for (const st of stmts) if (/(^|\s)col \*=/.test(st)) assert.ok(!/\b(dHit|dKick|band|lamp|re|land|lunge|cnt)\b/.test(st), 'no whole-frame multiplier on the hit: ' + st.trim());
  // laws 2 and 3 — one lunge toward the eye on the spring (read signed) and the struck decay, drawn back before the count; the field of view fixed
  assert.ok(/float lunge = \(0\.\d+ \* dKick \+ 0\.\d+ \* ptStrike\(ageS\) \* dStill\) \* heft \* body;/.test(room), 'the lunge: dKick signed (one rebound) and the struck decay on the stroke\'s age (a roll never snaps it back), by the passage and the body\'s count');
  assert.ok(!/(max|clamp)\(\s*dKick/.test(code), 'dKick is never clamped: the rebound is the body');
  const distSt = stmts.find(st => /float dist = /.test(st)) || '';
  assert.ok(/\(1\.0 - 0\.\d+ \* lunge\b/.test(distSt) && /\+ 0\.\d+ \* coil\b/.test(distSt) && /\+ 0\.\d+ \* lean\b/.test(distSt) && /- 0\.\d+ \* dLift\b/.test(distSt), 'one dolly: the lunge in, the coil and the lean back, the phrase\'s lift in (laws 2, 3, 7, 9)');
  assert.ok(/const float FOV = 0\.80;/.test(room) && !/\bFOV\s*(=|\*=|\+=)/.test(code.replace('const float FOV = 0.80', '')), 'the field of view never moves');
  for (const st of stmts) if (/\bFOV\b/.test(st)) assert.ok(!/\b(dHit|dAge|dKick|lunge|lamp|band|dMass|heft|cnt|dLift|dSway|coil|lean)\b/.test(st), 'the field of view never moves on the bus: ' + st.trim().slice(0, 90));
  // law 7 — the count from the bar phase at the strike, the lean for the count ahead, the bar's nod, the phrase's lift
  assert.ok(/float ptBeatW\(float age\)\{/.test(room) && /float cnt = ptBeatW\(ageS\)/.test(room), 'the count\'s weight read at the beat line the stroke belongs to (the stroke\'s age)');
  const nudge = room.match(/fract\(uBarPhase - 0\.25 \* age \+ (0\.\d+)\)/);
  assert.ok(nudge && +nudge[1] > 0.005 && +nudge[1] <= 0.04, 'the count rounds a read-ahead strike onto its beat and a roll\'s last 16th onto the four (nudge <= 0.15 beat): ' + (nudge && nudge[1]));
  assert.ok(/float ptLeanW\(\)\{/.test(room) && /fract\(uBarPhase \+ 0\.1\)/.test(room), 'the lean\'s weight from the count ahead');
  assert.ok(/float el = [^;]*\+ 0\.\d+ \* dSway;/.test(room), 'the bar nods the camera (dSway)');
  // law 4 — the fold's turn re-sculpted once a bar through the prelude's hold, never on a hit
  assert.ok(/ang \+= 0\.\d+ \* \([^;]*ptHeld\(bar8, barPh, [\d.]+\) - 0\.5\) \* dStill\)/.test(room) && /danceHeld\(bar8/.test(room), 'the turn is held per bar (danceHeld), still in a rest');
  // law 8 — every beat-locked figure is still in a rest; the planes' tide on the phrase, never a beat
  assert.ok(/float Tw = T \+ dPeriod \* \(danceStride\(bp, [^;]*\) - bp\) \* dStill;/.test(room) && /float az = TAU \* fract\(ph \+ Tw \/ \d+\.\d+\) \+ 0\.\d+ \* wave\(Tw,/.test(room), 'the stride warps the orbit\'s clock (seamless at the beat line), the whole azimuth on it');
  const strideA = room.match(/float Tw = T \+ dPeriod \* \(danceStride\(bp, (\d\.\d+) \*/);
  assert.ok(strideA && +strideA[1] <= 0.27, 'the walk never runs backwards while uTime runs at the rubato\'s measured floor (0.27 of the wall): stride amplitude ' + (strideA && strideA[1]));
  assert.ok(/float f1 = [^;]*sin\(TAU \* uPhrasePhase\) \* dStill/.test(room) && /float fl = [^;]*sin\(TAU \* uPhrasePhase\) \* dStill/.test(room), 'the section planes and the rings ride the phrase\'s tide, still in a rest');
  // law 9 — the coil tightens the pens, the pressure and the camera, and is released through the landing; the release is a swell along the stroke's parameter
  assert.ok(/float coil = max\(dBrace, 0\.\d+ \* \(1\.0 - smoothstep\(0\.0, 2\.0, dImpact\)\)\);/.test(room), 'the coil: dBrace, released over the half-bar after the landing');
  assert.ok(/float kP = kR \* \(1\.0 - 0\.\d+ \* coil\);/.test(room) && /float pressure = [^;]*\(1\.0 - 0\.\d+ \* coil\);/.test(room), 'the coil thins and dims the pens');
  assert.ok(/float land = max\(danceLand\(dImpact\), 0\.0\);/.test(room) && /float tL = tC \+ tNear \+ \(tFar - tNear\) \* min\((0\.\d+ \* )?dImpact, 1\.0\);/.test(room) && /float rel = max\(danceLand\((0\.\d+ \* )?dImpact\), 0\.0\);/.test(room) && /float re = ptBand\(t, tL, bwL\) \* rel;/.test(room), 'the release re-inks the drawing near to far on the landing (danceLand on its own clock, clamped to light)');
  // what is drawn is a section-level fact: the families on uCalm, re-dealt per bar along the stroke's parameter, never on a hit
  assert.ok(/float famCalm = max\(smoothstep\([^;]*uCalm\), [^;]*dImpact[^;]*\);/.test(room) && /float fam = min\(famCalm \* \([^;]*dealt\), [\d.]+\);/.test(room) && /float headF = tC \+ tNear \+/.test(room), 'the families: the section\'s level (and the landing\'s), the bar\'s family on top');
  // R2 (the refine): the bar breathes a family - dealt on the one behind the bar's head (the prelude's hold), lifted by a second
  // head before the next one (so the deal only ever adds ink on the one), held while the beats are struck, still in a rest
  assert.ok(/float dealt = [^;]*ptHeldB\(bar8, [\d.]+\)[^;]*ptBehind\(t, headF\)[^;]*ptBehind\(t, liftF\)[^;]*\* barOn;/.test(room), 'the bar\'s family: dealt behind the bar\'s head, lifted behind the lift\'s');
  assert.ok(/float barOn = \(1\.0 - smoothstep\([^;]*ageS\)\) \* dStill \* \(1\.0 - dBrace\);/.test(room), 'the family is held while the beats are struck, still in a rest and through the brace');
  const lift = room.match(/float liftF = tC \+ tNear \+ ([\d.]+) \* \(tFar - tNear\) \* \(barPh - ([\d.]+)\);/), head = room.match(/float headF = tC \+ tNear \+ ([\d.]+) \* \(tFar - tNear\) \* barPh;/);
  assert.ok(lift && head && +lift[2] >= 0.5 && +lift[1] * (1 - +lift[2]) >= 1.0 && +head[1] >= 1.0, 'the lift runs near to far after the bar\'s middle and reaches the far side before the bar line; the head crosses within the bar');
  for (const st of stmts) if (/(float halfs|float ring2) = /.test(st)) assert.ok(/\bdealt\b/.test(st), 'the half-steps and half-rings are the bar\'s family: ' + st.trim().slice(0, 90));
  // every loop bounded by a compile-time literal
  const loops = [...room.matchAll(/for\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(loops.length >= 4, 'the march, the flake, the trap and the close-in are loops');
  for (const l of loops) assert.ok(/^\s*int \w+ = 0;\s*\w+ < \d+;\s*\w+\+\+\s*$/.test(l), 'literal-bounded loop: ' + l);
  // the JS side: no pulse uniform, the dance clock never read here (the prelude's bar clock is the room's)
  assert.ok(!/uPulse/.test(build) && !/DANCE\.phase/.test(build), 'no uPulse, no DANCE.phase in the builder');
  // law 10 — the twin: the dance statements are the same text in Shaders41.metal's room_plotter (whitespace aside)
  const metal = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Shaders41.metal'), 'utf8');
  const m0 = metal.indexOf('fragment float4 room_plotter('), m1 = metal.indexOf('/* ==== END ROOM REGION: PLOTTER', m0);
  assert.ok(m0 >= 0 && m1 > m0, 'room_plotter is in Shaders41.metal');
  const ws = s => s.replace(/\s+/g, ' ').trim();
  const strip = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const twin = ws(strip(metal.slice(m0, m1))), twinAll = ws(strip(metal));
  const KEY = /^(float|vec[234])\s+(bp|sp|ageS|lean|coil|land|heft|barPh|cnt|body|kP|pressure|wOut|hair|tf|bw|lamp|tL|bwL|rel|headF|liftF|barOn|band|re|swell|famCalm|dealt|fam|lo|f1|fl|Tw|az|el|lunge|dist|hwMin|hwR|hw2|hw3|rim|bandS|wS|bandG|halfs|ring2)\b/;
  const keys = stmts.map(s => ws(s)).filter(s => KEY.test(s));
  assert.ok(keys.length >= 30, 'the dance statements were found: ' + keys.length);
  for (const k of keys) assert.ok(twin.includes(k + ';'), 'the twin carries the same line: ' + k.slice(0, 90));
  for (const h of ['ptHeldA', 'ptHeldB', 'ptHeld', 'ptBand', 'ptStrike', 'ptKnee', 'ptBehind']) {
    const m = room.match(new RegExp('float ' + h + '\\([^)]*\\)\\{[^\\n]*'));
    assert.ok(m && twinAll.includes(ws(m[0])), 'the twin\'s ' + h + ' is the same text');
  }
  assert.ok(/#define ptBeatW\(a\) ptBeatW\(U, \(a\)\)/.test(metal) && /inline float ptBeatW\(constant VizUniforms& U, float age\)\{/.test(metal) && /#define ptLeanW\(\) ptLeanW\(U\)/.test(metal) && /return float4\(govern\(VOID \+ max\(col, float3\(0\.0\)\), U\.white\), 1\.0\);/.test(metal), 'the twin passes U to the count helpers and governs its exit');
  // ...and the whole story, not only the dance statements: the room's body (from the bus read to the pens' last line), its helpers and
  // its count helpers (through the accessor map) are the same lines on both stages, comments and whitespace aside (the parity law)
  const lines = s => strip(s).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const cut = (s, x, y) => { const i = s.indexOf(x), j = s.indexOf(y, i + 1); assert.ok(i >= 0 && j > i, 'found ' + x + ' .. ' + y); return s.slice(i, j); };
  assert.deepStrictEqual(lines(cut(metal, 'float bp = danceBeatPhase();', 'col *= 1.7;')).filter(l => !l.startsWith('#undef ')), lines(cut(room, 'float bp = danceBeatPhase();', 'col *= 1.7;')), 'the twin\'s body is the web\'s, line for line');
  assert.deepStrictEqual(lines(cut(metal, 'float wave(', 'inline float ptBeatW(')), lines(cut(room, 'float wave(', 'float ptBeatW(')), 'the twin\'s helpers are the web\'s, line for line');
  const accessors = s => s.replace(/\bU\.dPeriod\b/g, 'dPeriod').replace(/\bU\.barPhase\b/g, 'uBarPhase').replace(/^inline float (pt\w+)\(constant VizUniforms& U(, )?/gm, 'float $1(');
  assert.deepStrictEqual(lines(accessors(cut(metal, 'inline float ptBeatW(', '}  // namespace rm_pt'))), lines(cut(room, 'float ptBeatW(', 'void main')), 'the twin\'s count helpers are the web\'s through the accessor map');
  assert.ok(/float uCalm = 1\.0 - U\.calm, uBarPhase = U\.barPhase, uPhrasePhase = U\.phrasePhase;/.test(metal), 'the TV reads the loudness in the web\'s sense (its analyser counts calm DOWN as the music gets loud)');
});

test('buildNave keeps the ten laws: the walk given to the count and never backwards, the beat a front down the nave, no raw band anywhere, the twin the same text', () => {
  const b0 = html.indexOf('function buildNave(){'), b1 = html.indexOf('/* ==== END ROOM REGION: NAVE', b0);
  assert.ok(b0 >= 0 && b1 > b0, 'buildNave is in the player');
  const build = html.slice(b0, b1);
  const f0 = build.indexOf('const frag = '), f1 = build.indexOf('\n  `;', f0);
  assert.ok(f0 >= 0 && f1 > f0, 'the fragment is inline in the builder');
  const room = build.slice(f0, f1);
  assert.ok(room.startsWith('const frag = GLSL_MPHI + GLSL_DANCE + `'), 'GLSL_DANCE is prepended after GLSL_MPHI');
  assert.ok(!/uniform\s+float[^;]*\buBarPhase\b/.test(room), 'the room does not redeclare uBarPhase (the prelude declares it)');
  const twelve = ['dHit', 'dAge', 'dKick', 'dMass', 'dArtic', 'dSpark', 'dSway', 'dLift', 'dBrace', 'dImpact', 'dStill', 'dPeriod'];
  for (const n of twelve) assert.ok(!new RegExp('\\b(float|vec[234]|int|bool)\\s+' + n + '\\b').test(room), n + ' is a macro: never a local');
  for (const n of ['danceBeatPhase', 'danceLean', 'danceStride', 'danceFront', 'danceLamp', 'danceLand', 'danceHeld', 'danceRing', 'danceBreath'])
    assert.ok(!new RegExp('\\b(float|vec[234]|int|bool)\\s+' + n + '\\b').test(room), n + ' is the prelude\'s: never redefined');
  const strip = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const stmts = strip(room).split(';');
  const code = stmts.join(';');
  const assigns = n => stmts.filter(st => new RegExp('(^|[^\\w.])(float|vec[234])?\\s*' + n + '\\s*(=|\\+=|-=|\\*=)(?!=)').test(st));
  // law 1 - no raw band, no beat envelope, no live spectrum anywhere in the room
  const RAW = ['uBass', 'uMid', 'uTreble', 'uEnergy', 'uBeat', 'uPulse', 'uBeatIdx', 'uAudio'];
  for (const u of RAW) assert.ok(!new RegExp('\\b' + u + '\\b').test(code), u + ' is not read anywhere in the room');
  // laws 1, 4, 5, 6 - the walk, the body and the resting pool never read the strike, its front, the hats or the articulation:
  // the hit is light that travels, never a position and never the whole pool
  const HIT = /\b(dHit|dAge|dSpark|dArtic|swell|front|wave|lampF|hd|cnt|landF|xL)\b/;
  for (const n of ['T', 'C', 'ro', 'fw', 'roll', 'hdg', 'kick', 'body', 'heft', 'coil', 'lean', 'reach', 'gain', 'kd0', 'kd', 'depth'])
    for (const st of assigns(n)) assert.ok(!HIT.test(st), `the strike reaches ${n}: ${st.trim().slice(0, 110)}`);
  // law 5 - the hats are glints on the rims and nowhere else; law 4 - the live articulation turns the fill's hue (light) and nothing else
  const spark = stmts.filter(st => /\bdSpark\b/.test(st)), artic = stmts.filter(st => /\bdArtic\b/.test(st));
  assert.ok(spark.length === 1 && /col \+= rim \* fr \* \(0\.35 \+ 0\.\d+ \* dSpark \+ 0\.\d+ \* swell \* front\) \* 1\.1/.test(spark[0]), 'dSpark only lights the rims, with the front as it passes: ' + spark.map(s => s.trim()).join(' | '));
  assert.ok(artic.length === 1 && /vec3 skyC = nvTone\(nvWalk\(q0, q1, q2, x0 \+ 1\.0 \+ 0\.\d+ \* dArtic\)\)/.test(artic[0]), 'dArtic only turns the high fill along the chord (light)');
  // the helpers the retelling is built from, and the bus fields it reads
  for (const h of ['danceBeatPhase()', 'danceLean(ph)', 'danceStride(ph, ', 'danceLamp(dHit, ageS)', 'danceFront(x, hd, ', 'danceFront(x, xL, ', 'danceLand(dImpact)', 'nvStrike(ageS)']) assert.ok(room.includes(h), 'reads ' + h);
  for (const d of twelve) assert.ok(new RegExp('\\b' + d + '\\b').test(code), 'reads ' + d);
  // ---- law 10 / 8 - THE WALK: musical time strides within the beat (the prelude's zero-mean form), all of the flight on it, never backwards
  const tw = room.match(/float T = uTime \+ uT0 \+ dPeriod \* \(danceStride\(ph, (\d\.\d+) \* dStill \* \(1\.0 - (\d\.\d+) \* coil\)\) - ph\) \* (\d\.\d+);/);
  assert.ok(tw, 'the walked clock: uTime + uT0 + dPeriod * (danceStride(ph, A * dStill * (1 - c * coil)) - ph) * K');
  const A = +tw[1], cC = +tw[2], K = +tw[3];
  assert.ok(A * K > 0.15, 'the stride is there (A x K = ' + (A * K).toFixed(3) + ')');
  assert.ok(A * K <= 0.248 - 0.025, 'the walk never runs backwards while uTime runs at the rubato\'s measured floor (0.248 of the wall, at the groove\'s entry), with a margin: A x K = ' + (A * K).toFixed(3));
  assert.strictEqual(assigns('T').length, 1, 'the walked clock is the only clock: T is written once');
  assert.ok(/nvFlight\(T, C, uPath, ro, fw, roll, bay, hdg\);/.test(room) && /nvFlight\(T \+ NV_LEAD, C, uPath, bearer, lf, lr, lk, lh\);/.test(room) && /vec3 C = nvBox\(T\);/.test(room), 'the flight, the bearer and the box all ride the one walked clock');
  const tb = room.match(/float Tb = T \+ ([\d.]+) \* sin\(T \* ([\d.]+)\);/);
  assert.ok(tb && +tb[1] * +tb[2] < 0.75, 'the bay clock breathes on the walked clock and never runs backwards on it (slope >= ' + (tb && (1 - tb[1] * tb[2]).toFixed(3)) + ')');
  // the pure form, on WALL time: the beat phase advances at 1/P (the media clock), musical time at r of the wall (the engine's rubato:
  // its measured floor on the web 0.248, the TV's rate floor 0.4); the derivative and every discrete frame step stay positive
  const walk = (u, ph, P, still, coil, a) => u + P * ((a * still * (1 - cC * coil)) / (2 * Math.PI)) * Math.sin(2 * Math.PI * ph) * K;
  for (const r of [0.248, 0.4]) for (const still of [0, 0.5, 1]) for (const coil of [0, 1]) for (let ph = 0; ph < 1; ph += 1e-3)
    assert.ok(r + K * A * still * (1 - cC * coil) * Math.cos(2 * Math.PI * ph) > 0, `d(T_walk)/dt > 0 at r ${r}, ph ${ph.toFixed(3)}, dStill ${still}, coil ${coil}`);
  for (const r of [0.248, 0.4]) for (const fps of [24, 60]) for (const P of [0.3, 0.5, 1.0]) for (let k = 0; k < 40; k++){
    const dt = 1 / fps; let u = 0, ph = k / 40, prev = walk(u, ph, P, 1, 0, A);
    for (let f = 0; f < Math.ceil(2 * P * fps); f++){
      u += r * dt; ph = (ph + dt / P) % 1;
      const cur = walk(u, ph, P, 1, 0, A);
      assert.ok(cur - prev > 0, `a frame of the walk steps forward (r ${r}, ${fps} fps, P ${P}): ${(cur - prev).toExponential(2)}`);
      prev = cur;
    }
  }
  // ...and the law has teeth: 2.9's literal amplitude (0.75 x 0.9) would walk backwards at the rubato's floor
  assert.ok(0.248 - 0.75 * 0.9 < 0 && 0.248 - 0.28 * 0.9 < 0.025, 'the design\'s 0.75 x 0.9 reverses at the floor, and the first retelling\'s 0.28 x 0.9 kept a margin of only 0.002: the bound above is the law');
  // ---- laws 2, 3, 7 - THE STEP: on the walker only, after the flight; the spring read SIGNED, the lean the other way, the bar, the phrase
  const step = room.match(/ro \+= hdg \* \((0\.\d+) \* kick - (0\.\d+) \* lean\) \+ rt0 \* \((0\.\d+) \* dSway \* \(1\.0 - coil\)\) \+ vec3\(0\.0, 0\.0, -(0\.\d+) \* kick \+ (0\.\d+) \* lean \+ (0\.\d+) \* dLift\);/);
  assert.ok(step, 'the step: a push-off down the aisle and a plie on the footfall, the lean back and up, the sway across the bar (stilled by the coil, law 9), the lift over the phrase');
  assert.ok(+step[5] >= 0.4 * +step[4] - 1e-9 && +step[5] < +step[4] && +step[2] >= 0.2 * +step[1] - 1e-9, 'law 3: the breath before the count is SEEN - the eye rises by at least 40 % of the plie (never as far as the plie itself: the footfall stays the gesture) and draws back by at least a fifth of the push');
  assert.ok(room.indexOf('ro += hdg * (') > room.indexOf('nvFlight(T, C, uPath, ro, fw, roll, bay, hdg);') && room.indexOf('ro += hdg * (') < room.indexOf('vec3 rd = nvUnit('), 'the step moves the walker after the flight and before the rays');
  assert.ok(/float kick = \(0\.\d+ \* dKick \+ 0\.\d+ \* nvStrike\(ageS\) \* dStill\) \* \(0\.\d+ \+ 0\.\d+ \* heft\) \* body;/.test(room) && !/(max|clamp|min|abs)\(\s*dKick/.test(code), 'the footfall: struck on the strike\'s own clock (still in a rest) over dKick read signed (the rebound is the body), weighed by the passage and the bar');
  const stk = room.match(/float nvStrike\(float age\)\{ return smoothstep\(0\.0, (0\.\d+), age\) \* max\(exp\(-(\d\.\d+) \* age\) - (0\.\d+), 0\.0\) \/ (0\.\d+); \}/);
  assert.ok(stk && +stk[1] >= 0.1 && +stk[1] <= 0.15 && Math.exp(-stk[2]) - stk[3] <= 1e-3 && Math.abs(1 - stk[3] - stk[4]) < 0.02, 'the footfall lands in 0.1 to 0.15 beat (a step, not a jolt, not a drift) and is spent by the next count (0 from age 1, normalised to 1)');
  assert.ok(/roll \+= 0\.\d+ \* dSway \* \(1\.0 - coil\);/.test(room), 'the frame leans with the bar, stilled by the coil');
  assert.ok(/float lean = danceLean\(ph\) \* nvLeanW\(\);/.test(room) && /float ph = danceBeatPhase\(\);/.test(room), 'the lean is the prelude\'s, on the beat phase, weighed by the count it loads for');
  const lw = room.match(/float nvLeanW\(\)\{ if \(dPeriod <= 0\.0\) return 0\.8; float i = floor\(fract\(uBarPhase \+ 0\.1\) \* 4\.0\); return i < 0\.5 \? (\d\.\d+) : \(abs\(i - 2\.0\) < 0\.5 \? (\d\.\d+) : (\d\.\d+)\); \}/);
  assert.ok(lw && +lw[1] === 1.0 && +lw[1] > +lw[2] && +lw[2] >= +lw[3], 'the breath is drawn deepest before the one (the count ahead)');
  // ---- law 6 - THE FRONT: struck by danceLamp on the strike's own clock, placed by its age along the aisle, narrower than the nave
  assert.ok(/float swell = danceLamp\(dHit, ageS\) \* dStill \* nvKnee\(heft \* cnt\);/.test(room), 'the front\'s strength: danceLamp(dHit, the strike\'s age) x dStill x the passage and the count through a knee (laws 6, 7, 8)');
  const hd = room.match(/float hd = min\(ageS \/ (\d\.\d+), 1\.0\);/);
  assert.ok(hd && +hd[1] <= 0.8, 'the front\'s head reaches the far crossing inside the lamp\'s hold');
  assert.ok(/float x = max\(dot\(p - ro, hdg\), 0\.0\) \/ NV_FAR;/.test(room) && /const float NV_FAR\s+= \d\.\d+;/.test(room), 'the front stands across the nave: x along the aisle\'s heading, 1 at the lit nave\'s far end');
  const fw0 = room.match(/front = danceFront\(x, hd, (\d\.\d+)\)/);
  assert.ok(fw0 && +fw0[1] <= 0.35, 'the front is narrower than the nave (a wave, not a flood): width ' + (fw0 && fw0[1]));
  const ramp = room.match(/wave = \(swell \* front \+ wave\) \* \((\d\.\d+) \+ (\d\.\d+) \* x\);/);
  assert.ok(ramp && +ramp[2] > +ramp[1], 'the front\'s light grows with the distance it has run, so the far crossing is seen to take it');
  assert.ok(/float lampF = wave \/ \(1\.0 \+ 0\.\d+ \* ld \* ld\);/.test(room) && /float lampG = gain \/ \(1\.0 \+ reach \* ld \* ld\) \+ lampF;/.test(room), 'the front is light added to the lamp\'s, never a multiplier on the frame');
  assert.ok(/float gw = 0\.\d+ \+ 0\.\d+ \* swell \* danceFront\(max\(dot\(bearer - ro, hdg\), 0\.0\) \/ NV_FAR, hd, /.test(room), 'the bearer\'s lantern flares when the front reaches it');
  // ...and the strike's light reaches the picture ONLY through a front: every other reader of swell (the fill, the gloss, the votives,
  // the back-rim) would be a whole-frame flash added in light, which no `col *=` check can see
  for (const st of stmts) if (/\bswell\b/.test(st)){
    const rest = st.replace(/\bfloat swell = /, '').replace(/\bswell > 0\.01\b/g, '').replace(/\bswell \* (front\b|danceFront\()/g, '');
    assert.ok(!/\bswell\b/.test(rest), 'the strike\'s light travels: swell is read only times a front: ' + st.trim().slice(0, 110));
  }
  // the strike's clock: a strike on the beat line restarts the front, one inside a beat already struck never rewinds it
  const spM = room.match(/float sp = (fract\(ph - dAge[^;]+);/), agM = room.match(/float ageS = ([^;]+);/);
  assert.ok(spM && agM && /\bdAge\b/.test(agM[1]) && /\bdPeriod > 0\.0\b/.test(agM[1]), 'the front\'s clock (sp, ageS) on dAge, freewheeling on dAge alone');
  const js = e => e.replace(/\bfract\(/g, 'F(').replace(/\bsmoothstep\(/g, 'S(').replace(/\bmax\(/g, 'Math.max(').replace(/\bmin\(/g, 'Math.min(');
  const ageOf = new Function('ph', 'dAge', 'dPeriod', 'F', 'S', 'const sp = ' + js(spM[1]) + '; return ' + js(agM[1]) + ';');
  const Ff = x => x - Math.floor(x), Sf = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
  for (const [stp, early] of [[0.25, 0.02], [0.5, 0.02], [0.25, -0.05], [1.0, 0.03]]){
    let prev = null, last = -9;
    for (let f = 0; f < 4 * 30; f++){
      const t = f / 30, ph = Ff(t);
      const k = Math.floor((t + early) / stp + 1e-9), st = k * stp - early;
      const struck = st <= t + 1e-9 && st > last + 1e-9;
      if (struck) last = st;
      const dAge = Math.min(4, t - last), ageS = ageOf(ph, dAge, 0.5, Ff, Sf);
      const onLine = Math.abs(Ff(last + early + 0.5) - 0.5) < 1e-6;
      if (struck && prev != null && !onLine) assert.ok(ageS >= prev - 1e-6, `a strike inside the beat (every ${stp} beat) never rewinds the front: ${prev.toFixed(3)} -> ${ageS.toFixed(3)}`);
      if (struck && onLine) assert.ok(ageS < 0.1, `a strike on the beat line restarts the front (${ageS.toFixed(3)})`);
      if (stp === 1.0) assert.ok(Math.abs(ageS - dAge) < 1e-9, 'the groove (strikes on the beat lines only) runs on dAge itself');
      prev = ageS;
    }
  }
  assert.ok(ageOf(0.5, 0.3, 0.0, Ff, Sf) === 0.3, 'freewheeling, the front\'s clock is dAge');
  // law 7 - the count at the strike's beat line: the one heaviest, the three next, the two and the four light
  const bw = room.match(/float nvBeatI\(float age\)\{ if \(dPeriod <= 0\.0\) return -1\.0; return floor\(fract\(uBarPhase - 0\.25 \* age \+ (0\.\d+)\) \* 4\.0\); \}/);
  assert.ok(bw && +bw[1] > 0.005 && +bw[1] <= 0.04, 'the count is read at the strike\'s beat line (nudge <= 0.15 beat)');
  assert.ok(/float bi = nvBeatI\(ageS\);/.test(room), 'the count is read at the strike\'s own beat line');
  for (const n of ['cnt', 'body']){
    const tb = room.match(new RegExp('float ' + n + ' = bi < -0\\.5 \\? (\\d\\.\\d+) : \\(bi < 0\\.5 \\? (\\d\\.\\d+) : \\(abs\\(bi - 2\\.0\\) < 0\\.5 \\? (\\d\\.\\d+) : (\\d\\.\\d+)\\)\\);'));
    assert.ok(tb && +tb[2] > 1.0 && +tb[2] > +tb[3] && +tb[3] > +tb[4] && +tb[1] < +tb[2] && +tb[1] > +tb[4], 'the bar has a shape in the ' + (n === 'cnt' ? 'light' : 'step') + ': one > three > two/four, freewheeling between');
  }
  const kn = room.match(/float nvKnee\(float x\)\{ return x < ([\d.]+) \? x : \1 \+ \(x - \1\) \/ \(1\.0 \+ [\d.]+ \* \(x - \1\)\); \}/);
  assert.ok(kn, 'the hit\'s weight passes a knee (C1, linear below it): heavy, never white');
  // light budget - no whole-frame multiplier on the hit, the exposure and the depth the section's
  for (const st of stmts) if (/(^|\s)col \*=/.test(st)) assert.ok(!/\b(dHit|dKick|kick|swell|front|wave|lampF|land|landF|cnt|ageS)\b/.test(st), 'no whole-frame multiplier on the hit: ' + st.trim());
  assert.ok(/col \*= depth \* \(1\.0 \+ 0\.\d+ \* uCalm\) \* cov/.test(room), 'the exposure is the section\'s (uCalm, seconds)');
  assert.ok(/float kd0 = mix\(0\.44, 0\.30, uCalm\) \+ 0\.\d+ \* coil;/.test(room), 'how deep the light goes is the passage\'s, the coil darkening the far nave');
  // law 9 - the coil draws the lantern in, dims it, darkens the far nave and evens the walk; the landing a wave over its half-bar
  assert.ok(/float coil = max\(dBrace, 0\.\d+ \* \(1\.0 - smoothstep\(0\.0, 2\.0, dImpact\)\)\);/.test(room), 'the coil: dBrace, released over the half-bar after the landing');
  assert.ok(/float land = max\(danceLand\(dImpact\), 0\.0\);/.test(room) && /float heft = max\(0\.2 \+ 1\.6 \* dMass \+ [\d.]+ \* max\(dMass - 0\.55, 0\.0\), 1\.0 - smoothstep\(0\.0, 1\.0, dImpact\)\) \+ 0\.\d+ \* land;/.test(room), 'the passage\'s weight, the landing holding it');
  assert.ok(/float reach = max\(0\.32 - 0\.\d+ \* dMass \+ 0\.\d+ \* coil, 0\.06\);/.test(room) && /float gain = \(1\.9 \+ 0\.\d+ \* dMass - 0\.4 \* uCalm\) \* \(1\.0 \+ 0\.3 \* uFace\) \* \(1\.0 - 0\.\d+ \* coil\) \* \(1\.0 \+ 0\.\d+ \* land\);/.test(room), 'the resting pool on the passage, drawn in and dimmed by the coil, let out by the landing');
  assert.ok(/float landF = \(0\.5 \+ 0\.5 \* land\) \* \(1\.0 - smoothstep\([\d.]+, [\d.]+, dImpact\)\) \* dStill;/.test(room) && /float xL = min\(0\.5 \* dImpact, 1\.0\);/.test(room) && /wave = [\d.]+ \* danceFront\(x, xL, 0\.\d+\) \* landF;/.test(room), 'the landing\'s wave runs the whole nave over its first half-bar, still in a rest');
  // every loop bounded by a compile-time literal
  const loops = [...room.matchAll(/for\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(loops.length >= 2, 'the march and the folds are loops');
  for (const l of loops) assert.ok(/^\s*int \w+ = 0;\s*\w+ < \d+;\s*\w+\+\+\s*$/.test(l), 'literal-bounded loop: ' + l);
  // ---- law 10 - the twin: Shaders40.metal's room_nave carries the same story, line for line
  const metal = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Shaders40.metal'), 'utf8');
  const m0 = metal.indexOf('fragment float4 room_nave('), m1 = metal.indexOf('/* ==== END ROOM REGION: NAVE', m0);
  assert.ok(m0 >= 0 && m1 > m0, 'room_nave is in Shaders40.metal');
  const frag = metal.slice(m0, m1);
  const lines = s => strip(s).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const cut = (s, x, y) => { const i = s.indexOf(x), j = s.indexOf(y, i + 1); assert.ok(i >= 0 && j > i, 'found ' + x + ' .. ' + y); return s.slice(i, j); };
  // the body: from the bus read to the bearer's lantern; the march's step cap (110 here, 96 on the TV) is the one accepted difference
  const cap = l => l.replace('i < 96;', 'i < 110;').replace('steps / 96.0', 'steps / 110.0');
  assert.deepStrictEqual(lines(cut(frag, 'float ph = danceBeatPhase();', '#undef dHit')).map(cap).slice(0, -1), lines(cut(room, 'float ph = danceBeatPhase();', 'col += (nvHash(')), 'the twin\'s body is the web\'s, line for line (the march cap aside)');
  // the flight and the knee are the same text (GLSL's out = the house dialect's INOUT), the count through the accessor map
  const dialect = s => s.replace(/INOUT\((\w+), (\w+)\)/g, 'out $1 $2');
  assert.deepStrictEqual(lines(dialect(cut(metal, 'void nvFlight(', 'inline float nvBeatI('))), lines(cut(room, 'void nvFlight(', 'float nvBeatI(')), 'the twin\'s flight, knee and footfall are the web\'s');
  const accessors = s => s.replace(/\bU\.dPeriod\b/g, 'dPeriod').replace(/\bU\.barPhase\b/g, 'uBarPhase').replace(/^inline float (nv\w+)\(constant VizUniforms& U(, )?/gm, 'float $1(');
  assert.deepStrictEqual(lines(accessors(cut(metal, 'inline float nvBeatI(', '}  // namespace rm_nv'))), lines(cut(room, 'float nvBeatI(', 'void main')), 'the twin\'s count and lean weight are the web\'s through the accessor map');
  // ...and so is EVERY helper and constant of the room (the stone, the flight, the chord, the front's NV_FAR): the whole namespace from
  // nvAtan on is the web's text through the house dialect (GLSL's out / const / atan = Metal's INOUT / constant / atan2)
  const house = s => accessors(dialect(s)).replace(/^constant float (\w+)/gm, 'const float $1').replace(/\batan2\(/g, 'atan(');
  assert.deepStrictEqual(lines(house(cut(metal, 'float nvAtan(', '}  // namespace rm_nv'))), lines(cut(room, 'float nvAtan(', 'void main(){')), 'the twin\'s helpers and constants are the web\'s, line for line');
  const defs = [...frag.matchAll(/^#define (\w+)/gm)].map(m => m[1]).sort(), undefs = [...frag.matchAll(/^#undef (\w+)/gm)].map(m => m[1]).sort();
  assert.deepStrictEqual(undefs, defs, 'every macro the twin defines for its body is let go of before the exit');
  for (const d of twelve) assert.ok(new RegExp('#define ' + d + ' U\\.' + d + '\\n').test(frag) && frag.includes('#undef ' + d + '\n'), 'the twin maps ' + d + ' onto the uniforms, and lets go of it');
  assert.ok(/#define danceBeatPhase\(\) danceBeatPhase\(U\)/.test(frag) && /#define danceLean\(ph\) danceLean\(U, \(ph\)\)/.test(frag) && /#define nvBeatI\(a\) nvBeatI\(U, \(a\)\)/.test(frag) && /#define nvLeanW\(\) nvLeanW\(U\)/.test(frag), 'the twin passes U to the helpers that read the bus');
  assert.ok(/float uCalm = 1\.0 - U\.calm, uTime = U\.time;/.test(frag), 'the TV reads the loudness in the web\'s sense (its analyser counts calm DOWN as the music gets loud)');
  // ---- the chord's walk (chord-only colour): the same text on both stages, and CONTINUOUS. Two voices nearly opposite walk the
  // wheel clockwise, eased in over the gap, the two arcs mixed in OKLab - so a chord gliding through the half-turn passes through a
  // little less chroma and never cuts (the first retelling's third-voice switch cut ~160 deg in one frame, twice, in the drop)
  assert.deepStrictEqual(lines(cut(metal, 'vec3 nvLab(vec3 q){', 'vec3 nvBox(float T){')), lines(cut(room, 'vec3 nvLab(vec3 q){', 'vec3 nvBox(float T){')), 'the twin walks the chord with the web\'s text, line for line');
  assert.ok(!/\bnvRGB\b/.test(room) && !/\bep > en\b|\? dp : dn/.test(room), 'no hard switch between the two arcs');
  const wk = room.match(/float wl = dh > 0\.0 \? smoothstep\((\d\.\d+), (\d\.\d+), dh\) : 0\.0;/);
  assert.ok(wk && /float hs = a\.z \+ dh \* f, hl = a\.z \+ \(dh - 6\.2831853\) \* f;/.test(room) && /vec2 ab = mix\(a\.y, b\.y, f\) \* \(\(1\.0 - wl\) \* vec2\(cos\(hs\), sin\(hs\)\) \+ wl \* vec2\(cos\(hl\), sin\(hl\)\)\);/.test(room), 'the walk mixes the shorter and the clockwise arc in OKLab by a weight eased in over the gap');
  const lo = +wk[1], hi = +wk[2];
  assert.ok(lo >= 2.62 && hi <= 3.0 && hi - lo >= 0.25, `the fifth (149.4 deg) keeps its shorter arc, the tritone (177.1 deg) walks wholly clockwise, and the turn is eased over >= 14 deg of gap (${lo}..${hi} rad)`);
  // the formula, driven by the shader's own constants: a chord gliding through the half-turn (B's hue 140 -> 220 deg from A's, in
  // half-degree frames) moves the mid-walk colour smoothly - never more than a fifth of its chroma in a frame (a cut is twice it)
  const S01 = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
  const TAU = 6.2831853, walkAB = (dhRaw, f, Cc) => { const dh = dhRaw - TAU * Math.floor((dhRaw + 3.1415927) / TAU); const wl = dh > 0 ? S01(lo, hi, dh) : 0; const hs = dh * f, hl = (dh - TAU) * f; return [Cc * ((1 - wl) * Math.cos(hs) + wl * Math.cos(hl)), Cc * ((1 - wl) * Math.sin(hs) + wl * Math.sin(hl))]; };
  for (const f of [0.2, 0.45, 0.5, 0.8]){
    let prev = null, worst = 0;
    for (let g = 140; g <= 220; g += 0.5){
      const ab = walkAB(g * Math.PI / 180, f, 0.1);
      if (prev) worst = Math.max(worst, Math.hypot(ab[0] - prev[0], ab[1] - prev[1]));
      prev = ab;
    }
    assert.ok(worst < 0.2 * 0.1, `the walk at ${f} moves at most a fifth of its chroma per half-degree of the chord's glide (${(worst / 0.1).toFixed(3)})`);
  }
  for (const f of [0.25, 0.5, 0.75]) assert.ok(Math.hypot(...walkAB(Math.PI - 1e-4, f, 0.1).map((v, i) => v - walkAB(-Math.PI + 1e-4, f, 0.1)[i])) < 1e-3, 'either side of the exact half-turn walks the same way (no coin flip)');
  for (const g of [30, 95, 120, 149.4]) assert.ok(Math.abs(Math.atan2(...walkAB(g * Math.PI / 180, 0.5, 0.1).slice().reverse()) - g * Math.PI / 360) < 1e-9, `a ${g} deg gap keeps the shorter arc exactly`);
  assert.ok(!/\bU\.(bass|mid|treble|energy|onsetEnv|beatPhase)\b/.test(strip(frag)) && !/\b(spectrum|waveform)\.read\(/.test(frag), 'the twin reads no raw band, no live spectrum');
  assert.ok(/return float4\(govern\(VOID \+ max\(col, float3\(0\.0\)\), U\.white\), 1\.0\);/.test(frag) && (frag.match(/\breturn\b/g) || []).length === 1, 'the twin governs its one exit');
});

test('buildFractalField keeps the ten laws: one zoom toward the viewer on the rig\'s radius, the hit a key light that crosses the relief, the walk on the bar, no raw band anywhere, the twin the same text', () => {
  const r0 = html.indexOf('/* ==== ROOM REGION: FRACTAL'), r1 = html.indexOf('/* ==== END ROOM REGION: FRACTAL', r0);
  assert.ok(r0 >= 0 && r1 > r0, 'the FRACTAL region is fenced in the player');
  const region = html.slice(r0, r1);
  const f0 = region.indexOf('const MARCH_FRAG = '), f1 = region.indexOf('\n`;', f0);
  assert.ok(f0 >= 0 && f1 > f0, 'the march fragment is in the region');
  const room = region.slice(f0, f1);
  const b0 = region.indexOf('function buildFractalField(){');
  assert.ok(b0 > f1, 'the builder follows the fragment');
  const build = region.slice(b0), u0 = build.indexOf('    update(dt){'), drv = build.slice(u0, build.indexOf('      const w = Math.max(64,', u0));
  assert.ok(u0 > 0 && drv.length > 2000, 'the drivers are update(dt)');
  assert.ok(room.startsWith('const MARCH_FRAG = GLSL_DANCE + GLSL_FRACTAL + `'), 'GLSL_DANCE is prepended');
  assert.ok(!/uniform\s+float[^;]*\buBarPhase\b/.test(room), 'the room does not redeclare uBarPhase (the prelude declares it)');
  const twelve = ['dHit', 'dAge', 'dKick', 'dMass', 'dArtic', 'dSpark', 'dSway', 'dLift', 'dBrace', 'dImpact', 'dStill', 'dPeriod'];
  for (const n of [...twelve, 'danceBeatPhase', 'danceLean', 'danceStride', 'danceFront', 'danceLamp', 'danceLand', 'danceHeld', 'danceRing', 'danceBreath'])
    assert.ok(!new RegExp('\\b(float|vec[234]|int|bool)\\s+' + n + '\\b').test(room), n + ' is the prelude\'s: never a local, never redefined');
  const strip = s => s.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const stmts = strip(room).split(';'), code = stmts.join(';');
  const dstm = strip(drv).split(';'), dcode = dstm.join(';');
  const assigns = (ss, n) => ss.filter(st => new RegExp('(^|[^\\w.])(float|vec[234]|const|let)?\\s*' + n + '\\s*(=|\\+=|-=|\\*=)(?!=)').test(st));
  // ---- law 1 - no raw band, no beat envelope, no live spectrum: not in the fragment, not in the drivers
  for (const u of ['uBass', 'uMid', 'uTreble', 'uEnergy', 'uBeat', 'uBeatSpring', 'uCoupling', 'uEntropy', 'uCentroid', 'uAudio', 'uPulse', 'uBeatIdx'])
    assert.ok(!new RegExp('\\b' + u + '\\b').test(code), u + ' is not read by the fragment');
  assert.ok(!/\bAE\.f\b|\bf\.(bass|mid|treble|energy|beat|coupling|onset|entropy|centroid)\b|\bDANCE\.(pulse|bus)\b/.test(dcode), 'the drivers read no band, no envelope, and the bus only as the fragment does (U.uDance0..2)');
  assert.ok(/const d0 = U\.uDance0\.value, d2 = U\.uDance2\.value;/.test(drv), 'the drivers read the twelve the fragment reads, this frame');
  for (const d of twelve.filter(d => !['dArtic', 'dSway', 'dLift'].includes(d))) assert.ok(new RegExp('\\b' + d + '\\b').test(code + dcode), 'reads ' + d);
  // the bar's sway and the phrase's lift arrive on the web through the rig's own camera (its head-tilt in the basis, its FOV): never read twice
  assert.ok(!/\bdSway\b|\bdLift\b/.test(code + dcode) && /u\.uCamMat\.value\.setFromMatrix4\(camera\.matrixWorld\);/.test(drv) && /u\.uTanFov\.value = Math\.tan\(camera\.fov/.test(drv), 'dSway and dLift reach the web room only through the rig\'s camera (basis and FOV), one owner each');
  // law 4 - the live articulation moves nothing: the room's articulation is dealt per bar and held
  assert.ok(!/\bdArtic\b/.test(code + dcode), 'dArtic (live) reaches no shape and no term of this room');
  // ---- laws 2, 6 - the hit (dHit, its age, its lamp, the key light) never reaches the camera, the rays or the set
  const HIT = /\b(dHit|lampK|hq|hd|hx|xr|Lh|kf)\b/;
  for (const n of ['ph', 'lean', 'coil', 'sp', 'ageS', 'one', 'kick', 'distK', 'ro', 'roL', 'fl', 'ex', 'nod', 'cn', 'sn', 'cR', 'cU', 'cW', 'rd', 'pixAng'])
    for (const st of assigns(stmts, n)) assert.ok(!HIT.test(st), `the strike's light reaches ${n}: ${st.trim().slice(0, 110)}`);
  // the strike's age reaches the drivers in one statement only: the walk's gate (is this the one's own strike?), never a shape or a clock
  const SB = 'const sb = barPh - 0.25 * d0.y + 0.0375, struck = d0.y < 0.4 && Math.floor((sb - Math.floor(sb)) * 4) === 0';
  assert.ok(dcode.split(SB).length === 2, 'the walk is gated on the one\'s own strike, read at its beat line');
  // ...and the breath's live-beat gate, the fragment's own arithmetic on the strike's age (A1: no breath on an empty lattice)
  const LGJS = /const lean = danceLeanJS\(ph, dStill, dPeriod > 0\) \* frLeanWJS\(barPh, dPeriod\) \* \(1 - danceSmooth\((\d\.\d+), (\d\.\d+), d0\.y\)\)/;
  assert.ok(LGJS.test(dcode), 'the drivers\' breath is drawn on a live beat only, as the fragment\'s');
  const dOther = dcode.split(SB).join('').replace(LGJS, '');
  assert.ok(!/\bd0\.[xy]\b|\bdHit\b|\bdAge\b|\bsb\b/.test(dOther), 'the drivers read neither the strike nor its age elsewhere: the set and the camera move on the spring, the passage, the bar and the coil');
  assert.ok(dOther.split(';').filter(st => /\bstruck\b/.test(st)).every(st => /^\s*frRungStep\(dim, \{/.test(st)), 'the strike gates the walk and nothing else');
  for (const st of stmts) if (/\bdHit\b/.test(st)) assert.ok(/float lampK = danceLamp\(dHit, min\(ageS, 0\.\d+\)\) \* \(1\.0 - smoothstep\(0\.\d+, 1\.0, ageS\)\) \* frBeatW\(ageS\) \* dStill/.test(st), 'dHit is read only through danceLamp, on the strike\'s own clock: ' + st.trim().slice(0, 110));
  // dKick is SIGNED wherever it moves something (the rebound is the body): never clamped, never folded
  assert.ok(!/(max|min|clamp|abs)\(\s*dKick/.test(code) && !/(max|min|clamp|abs)\(\s*dKick/.test(dcode), 'dKick is read signed');
  // ---- law 2 - ONE ZOOM, ONE SIGN. The rig's radius arrives (its one spring and every figure's dr), compressed; never CHOREO.base
  const rig = drv.match(/const rq = \(\(typeof director !== 'undefined' \? director\.camRadius : 30\) \/ (\d+) - 1\) \/ (0\.\d+), rigK = Math\.sqrt\(1 \+ \2 \* rq \/ Math\.sqrt\(1 \+ rq \* rq\)\);/);
  assert.ok(rig, 'the rig\'s FIGURES (director.camRadius: every figure\'s dr inside it) over its boot radius, softly clamped (x / sqrt(1 + x^2)) and square-rooted');
  assert.ok(!/camera\.position\.length\(\)/.test(drv) && /const dir = camera\.position\.lengthSq\(\) > 1e-6/.test(drv), 'the rig\'s sprung radius (camRadius - 3 dKick - dMass) is not read: the kick has one owner, the room\'s lunge; camera.position gives the direction only');
  assert.ok(!/CHOREO\.base/.test(dcode), 'the ratio is never taken against CHOREO.base.r (re-dealt at every figure\'s handover: the ratio would cut there)');
  const boot = html.match(/camRadius: (\d+), camTargetR: \1\b/) || html.match(/camRadius:\s*(\d+)/);
  assert.ok(+rig[1] === 30 && (!boot || +boot[1] === 30), 'the home is the rig\'s boot radius (30)');
  const softK = q => { const x = (q - 1) / +rig[2]; return Math.sqrt(1 + +rig[2] * x / Math.sqrt(1 + x * x)); };
  let prevK = 0; for (let q = 0.3; q <= 1.7; q += 0.01){ const k = softK(q); assert.ok(k > prevK && k > Math.sqrt(0.7) - 1e-9 && k < Math.sqrt(1.3) + 1e-9, 'rigK rises with the radius and stays inside sqrt(0.7..1.3): ' + q.toFixed(2)); prevK = k; }
  assert.ok((1 - softK(0.8) ** 2) / 0.2 > 0.8 && softK(0.8) < 1, 'a push-in of 6 of 30 arrives at better than four fifths of its depth through the soft clamp (then the square root halves it)');
  assert.ok(/u\.uCamPos\.value\.copy\(dir\.multiplyScalar\(base \* rigK \* \(1 \+ 0\.05 \* Math\.sin\(t \* 0\.05\)\)\)\);/.test(drv), 'the camera sits at the form\'s framing distance times the rig\'s ratio, the slow sine kept');
  const dk = room.match(/float distK = 1\.0 - (0\.\d+) \* kick \+ (0\.\d+) \* lean - (0\.\d+) \* danceLand\(dImpact\) - (0\.\d+) \* dMass \+ (0\.\d+) \* dBrace;/);
  assert.ok(dk, 'the body\'s zoom: the lunge nearer, the breath back, the landing\'s lunge nearer, the passage nearer, the coil back');
  const km = room.match(/float kick = \((0\.\d+) \* dKick \+ (0\.\d+) \* frStrike\(ageS, one\) \* dStill\) \* frBodyW\(ageS\);/);
  assert.ok(km && Math.abs(+km[1] + +km[2] - 1) < 1e-9 && +km[1] >= 0.2, 'the lunge: struck on the strike\'s clock (still in a rest) over the body\'s spring read signed, shares summing to 1');
  assert.ok(/float one = step\(1\.0, frBeatW\(ageS\)\);/.test(room), 'the count the strike belongs to, read at its beat line');
  const bd = room.match(/float frBodyW\(float age\)\{ if \(dPeriod <= 0\.0\) return (0\.\d+); float i = floor\(fract\(uBarPhase - 0\.25 \* age \+ 0\.0375\) \* 4\.0\); return i < 0\.5 \? (\d\.\d+) : \(abs\(i - 2\.0\) < 0\.5 \? (\d\.\d+) : (\d\.\d+)\); \}/);
  assert.ok(bd && +bd[2] > 1 && +bd[2] > +bd[3] && +bd[3] > +bd[4], 'law 7: the body\'s bar has a shape - the one\'s lunge heaviest, the three\'s next, the two and the four light');
  const kickOne = +dk[1] * +bd[2], kickThree = +dk[1] * +bd[3];
  assert.ok(kickOne >= 0.04 && kickOne <= 0.08 && kickThree >= 0.025, `a kick brings the form 2.5 to 8 % nearer (the one ${kickOne.toFixed(3)}, the three ${kickThree.toFixed(3)}): 2 to 4 % of the frame at the silhouette`);
  assert.ok(+dk[2] >= 0.2 * kickOne && +dk[2] < kickOne, 'law 3: the breath draws the form back by at least a fifth of the one\'s lunge (and never as far)');
  // the two envelopes, the pure form: up in a fifth to a third of a beat (a body arriving, not a snap), peak 1, spent by the next count
  const env = name => new Function('smoothstep', 'mix', 'exp', 'max', strip(room.slice(room.indexOf('float ' + name + '('), room.indexOf('}', room.indexOf('float ' + name + '(')) + 1)).replace(/^float /, 'function ').replace(/\(float age, float one\)/, '(age, one)').replace(/float /g, 'let ') + '; return ' + name + ';')(
    (a, b, x) => { const q = Math.min(1, Math.max(0, (x - a) / (b - a))); return q * q * (3 - 2 * q); }, (a, b, t) => a + (b - a) * t, Math.exp, Math.max);
  for (const [name, lo, hi] of [['frStrike', 0.15, 0.4], ['frNod', 0.05, 0.25]]) for (const one of [0, 1]){
    const f = env(name); let pk = 0, pa = 0; for (let a = 0; a <= 1.2; a += 1e-3){ const v = f(a, one); if (v > pk){ pk = v; pa = a; } }
    assert.ok(Math.abs(pk - 1) < 0.02 && pa >= lo * 0.6 && pa <= hi, `${name} (one ${one}) peaks at 1 (${pk.toFixed(3)}) at age ${pa.toFixed(3)}`);
    assert.ok(Math.abs(f(1.0, one)) < 1e-6 && Math.abs(f(1.3, one)) < 1e-6 && f(0, one) === 0, `${name} (one ${one}) is spent by the next count and starts from rest`);
    if (one) assert.ok(pa > (() => { let p0 = 0, a0 = 0; for (let a = 0; a <= 1; a += 1e-3){ const v = f(a, 0); if (v > p0){ p0 = v; a0 = a; } } return a0; })(), `${name}: the one lands later than the other counts (it carries more mass)`);
  }
  // law 2, lesson 3 - THE REBOUND. The struck lunge lets go THROUGH rest by half the beat into ONE rebound past it and is home by 0.8
  // beat (a body landing, not a mass let down on a string): the struck share alone crosses rest and dips (it is the body that rebounds,
  // not only the spring under it), and is spent from 0.8; the kick line - its spring share driven by the bus's own unit spring, its
  // struck share frStrike - crosses rest at 0.4..0.55 beat, dips ONCE by a tenth to a fifth of its peak at 0.5..0.75 and is within 5 %
  // of rest from 0.8 beat, at any tempo, on the one and off it (the room's round-3 lunge never crossed rest: +0.7 px at the next count)
  for (const one of [0, 1]){
    const f = env('frStrike');
    let cr = null, mn = 0, mnA = 0; for (let a = 0.3; a <= 1.2; a += 1e-3){ const v = f(a, one); if (cr == null && v <= 0) cr = a; if (v < mn){ mn = v; mnA = a; } }
    assert.ok(cr != null && cr >= 0.4 && cr <= 0.55 && mn <= -0.05 && mnA > 0.5 && mnA < 0.75, `frStrike (one ${one}) lets go through rest (at ${cr == null ? 'never' : cr.toFixed(3)}) into its own rebound (${mn.toFixed(3)} at ${mnA.toFixed(3)})`);
    for (let a = 0.8; a <= 1.3; a += 0.01) assert.ok(Math.abs(f(a, one)) < 1e-9, `frStrike (one ${one}) is spent from 0.8 beat (${a.toFixed(2)}: ${f(a, one)})`);
    for (const bpm of [90, 120, 174]){
      const P = 60 / bpm, ks = S.makeDanceKick(); S.danceKickStrike(ks, 1);
      const xs = []; for (let i = 1; i <= Math.round(P * 240); i++){ const b = i / 240 / P; xs.push({ b, x: +km[1] * S.danceKickStep(ks, 1 / 240, P, false) + +km[2] * f(b, one) }); }
      let pk = xs[0]; for (const o of xs) if (o.x > pk.x) pk = o;
      const c0 = xs.find(o => o.b > pk.b && o.x <= 0);
      const mins = xs.filter((o, i) => i > 0 && i < xs.length - 1 && o.b > pk.b && o.x < xs[i - 1].x && o.x <= xs[i + 1].x && o.x < 0);
      assert.ok(c0 && c0.b >= 0.4 && c0.b <= 0.55, `${bpm} BPM, one ${one}: the lunge crosses rest at ${c0 ? c0.b.toFixed(3) : 'never'} beat (0.4..0.55)`);
      assert.equal(mins.length, 1, `${bpm} BPM, one ${one}: exactly one rebound below rest`);
      const reb = mins[0].x / pk.x;
      assert.ok(reb <= -0.1 && reb >= -0.2 && mins[0].b > 0.5 && mins[0].b < 0.75, `${bpm} BPM, one ${one}: the rebound is ${(100 * reb).toFixed(1)}% of the peak at ${mins[0].b.toFixed(2)} beat (a tenth to a fifth, at 0.5..0.75)`);
      const tail = Math.max(...xs.filter(o => o.b >= 0.8).map(o => Math.abs(o.x)));
      assert.ok(tail <= 0.05 * pk.x, `${bpm} BPM, one ${one}: home by 0.8 beat (worst ${(100 * tail / pk.x).toFixed(1)}% of the peak after it)`);
    }
  }
  assert.ok(/float roL = max\(length\(ro\), 1e-4\), fl = uBound \* 1\.14, ex = roL - fl;/.test(room) && /ro \*= \(fl \+ 0\.5 \* \(ex \+ sqrt\(ex \* ex \+ 0\.01 \* uBound \* uBound\)\)\) \/ roL;/.test(room) && !/max\(\s*F\.bound \* 1\.14/.test(drv), 'the marching sphere\'s floor is soft (a smooth ReLU): no velocity kink when a lunge bites it');
  const nod = room.match(/float nod = -(0\.\d+) \* frNod\(ageS, one\) \* frBeatW\(ageS\) \* \(1\.0 \+ (0\.\d+) \* one\) \* dStill, cn = cos\(nod\), sn = sin\(nod\);/);
  assert.ok(nod && +nod[1] * 1.25 * (1 + +nod[2]) <= 0.05 && /vec3 cR = uCamR, cU = uCamU \* cn \+ uCamW \* sn, cW = uCamW \* cn - uCamU \* sn;/.test(room), 'the view nods into every count (a pitch about its right axis, at most 0.05 rad on the one), weighed by the count, still in a rest');
  assert.ok(/vec3 rd = normalize\(cR \* \(uv\.x \* uTanFov\) \+ cU \* \(uv\.y \* uTanFov\) - cW\);/.test(room) && /u\.uTanFov\.value = Math\.tan\(camera\.fov \* 0\.5 \* PI \/ 180\) \* lensMul;/.test(drv), 'the FOV is the rig\'s, perspective only');
  // ---- law 6 - THE HIT IS A TRAVELLING KEY LIGHT: a band of light with a place, struck by danceLamp on the strike's clock, run across the form
  assert.ok(/float lampK = danceLamp\(dHit, min\(ageS, 0\.62\)\) \* \(1\.0 - smoothstep\(0\.8, 1\.0, ageS\)\) \* frBeatW\(ageS\) \* dStill;/.test(room), 'the lamp: struck (danceLamp\'s attack) on the strike\'s own clock, held to the last fifth of the beat and let go before the next count, weighed by the count, still in a rest');
  const hq = room.match(/float hq = 1\.0 - clamp\(\(ageS - (0\.\d+) \* \(1\.0 - one\)\) \/ (0\.\d+), 0\.0, 1\.0\), hd = 1\.0 - hq \* hq;/);
  const hx = room.match(/float hx = (0\.\d+) \+ (0\.\d+) \* \(frDir\(ageS\) > 0\.0 \? hd : 1\.0 - hd\);/);
  assert.ok(hq && hx && +hq[1] <= 0.15 && +hq[2] <= 0.75, 'the run: off the strike on the one, after the body on the other counts, across the form by three quarters of the beat');
  assert.ok(+hx[1] >= 0 && +hx[1] + +hx[2] <= 1 && +hx[2] >= 0.5, 'the head crosses at least half the form and stays on it');
  assert.ok(/float xr = 0\.5 \+ dot\(p, cR\) \/ \(1\.5 \* uBound\);/.test(room), 'the band stands across the form along the view\'s right axis (in the form\'s own frame, so it rides the orbit)');
  assert.ok(/vec3 Lh = normalize\(cR \* \(1\.6 \* hx - 0\.8\) \+ cU \* 0\.\d+ \+ cW \* 0\.\d+\);/.test(room), 'the band\'s key comes from where the head is (the nodded camera basis)');
  const kw = room.match(/float kf = danceFront\(xr, hx, (0\.\d+)\) \* \(0\.\d+ \+ 0\.\d+ \* clamp\(dot\(n, Lh\), 0\.0, 1\.0\)\);/);
  assert.ok(kw && +kw[1] <= 0.25, 'the band is narrower than the form (a ridge, not a flood): width ' + (kw && kw[1]));
  const rmp = room.match(/outc \+= \(col \* 0\.\d+ \+ glowCol \* \(0\.\d+ \* fres\)\) \* \(kf \* lampK \* \((0\.\d+) \+ (0\.\d+) \* hd\) \* \(0\.6 \+ 0\.4 \* ao\)\);/);
  assert.ok(rmp && +rmp[2] > +rmp[1], 'the band is ADDED in the chord\'s own colours and brightens as it runs, so the far side is seen to take it - never a multiplier');
  const dir = room.match(/float frDir\(float age\)\{ if \(dPeriod <= 0\.0\) return 1\.0; float i = floor\(fract\(uBarPhase - 0\.25 \* age \+ 0\.0375\) \* 4\.0\); return abs\(i - 1\.0\) < 0\.5 \|\| abs\(i - 3\.0\) < 0\.5 \? -1\.0 : 1\.0; \}/);
  assert.ok(dir, 'the run\'s direction, read at the strike\'s beat line: a pendulum across the bar');
  // the pure form: the head's place across the form through the beat, on every count - monotone, at least half the form, and the
  // pendulum's turn: the next count's run starts where this one ended (the ridge is on another face at x.2 than at x.1, nothing jumps)
  const head = (age, one, d) => { const q = 1 - Math.min(1, Math.max(0, (age - +hq[1] * (1 - one)) / +hq[2])), h = 1 - q * q; return +hx[1] + +hx[2] * (d > 0 ? h : 1 - h); };
  for (const [one, d] of [[1, 1], [0, -1], [0, 1]]){
    let prev = null; for (let a = 0; a <= 1; a += 0.01){ const x = head(a, one, d); if (prev != null) assert.ok(d * (x - prev) >= -1e-12, 'the head never walks back inside the beat'); prev = x; }
    assert.ok(Math.abs(head(1, one, d) - head(0, one, d)) >= 0.5, 'the run crosses at least half the form');
  }
  assert.ok(Math.abs(head(1, 1, 1) - head(0, 0, -1)) < 1e-9 && Math.abs(head(1, 0, -1) - head(0, 0, 1)) < 1e-9, 'the pendulum: each count\'s run starts where the last one ended');
  // the hit's light only travels: every statement that sets the light (outc, g, lit, col, oc, veinCol, hg, glowCol) and reads the strike,
  // its clock or the body's beat goes through the band (kf * lampK) or is the orbs' lamp - no additive whole-frame flash, no hue on the beat
  const BEAT = /\b(dHit|dAge|ageS|lampK|kick|one|dKick|hq|hd|hx|nod|distK)\b/;
  for (const st of stmts) if (/(^|[\s;{}])(vec3\s+)?(outc|g|lit|col|oc|veinCol|hg|glowCol)\s*(\+|-|\*)?=(?!=)/.test(st) && BEAT.test(st)) assert.ok(/kf \* lampK|vec3 oc = mix\(uColC, uColB, 0\.35\) \* \(1\.0 \+ 0\.\d+ \* lampK\)/.test(st), 'the strike\'s light only travels: ' + st.trim().slice(0, 110));
  // the strike's light reaches the picture only through the lobe and the orbs' lamps: every other reader would be a flash in place
  for (const st of stmts) if (/\blampK\b/.test(st) && !/float lampK = /.test(st)) assert.ok(/kf \* lampK|1\.0 \+ 0\.\d+ \* lampK/.test(st), 'the lamp lights the travelling band and the orbs, nothing else: ' + st.trim().slice(0, 110));
  // the strike's clock: a strike on the beat line restarts the light, one inside a beat already struck never rewinds it
  const spM = room.match(/float sp = (fract\(ph - dAge[^;]+);/), agM = room.match(/float ageS = ([^;]+);/);
  assert.ok(spM && agM && /\bdAge\b/.test(agM[1]) && /\bdPeriod > 0\.0\b/.test(agM[1]), 'the lamp\'s clock (sp, ageS) on dAge, freewheeling on dAge alone');
  const js = e => e.replace(/\bfract\(/g, 'F(').replace(/\bsmoothstep\(/g, 'S(').replace(/\bmax\(/g, 'Math.max(').replace(/\bmin\(/g, 'Math.min(');
  const ageOf = new Function('ph', 'dAge', 'dPeriod', 'F', 'S', 'const sp = ' + js(spM[1]) + '; return ' + js(agM[1]) + ';');
  const Ff = x => x - Math.floor(x), Sf = (e0, e1, x) => { const q = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return q * q * (3 - 2 * q); };
  for (const [stp, early] of [[0.25, 0.02], [0.5, 0.02], [0.25, -0.05], [1.0, 0.03]]){
    let prev = null, last = -9;
    for (let f = 0; f < 4 * 30; f++){
      const t = f / 30, ph = Ff(t), k = Math.floor((t + early) / stp + 1e-9), st = k * stp - early;
      const struck = st <= t + 1e-9 && st > last + 1e-9;
      if (struck) last = st;
      const dAge = Math.min(4, t - last), ageS = ageOf(ph, dAge, 0.5, Ff, Sf), onLine = Math.abs(Ff(last + early + 0.5) - 0.5) < 1e-6;
      if (struck && prev != null && !onLine) assert.ok(ageS >= prev - 1e-6, `a strike inside the beat (every ${stp} beat) never rewinds the light: ${prev.toFixed(3)} -> ${ageS.toFixed(3)}`);
      if (struck && onLine) assert.ok(ageS < 0.1, `a strike on the beat line restarts the light (${ageS.toFixed(3)})`);
      if (stp === 1.0) assert.ok(Math.abs(ageS - dAge) < 1e-9, 'the groove (strikes on the beat lines only) runs on dAge itself');
      prev = ageS;
    }
  }
  assert.ok(ageOf(0.5, 0.3, 0.0, Ff, Sf) === 0.3, 'freewheeling, the lamp\'s clock is dAge');
  // ---- law 7 - the count: the one heaviest, the three next, the two and the four light; the breath deepest before the one
  const bw = room.match(/float frBeatW\(float age\)\{ if \(dPeriod <= 0\.0\) return (0\.\d+); float i = floor\(fract\(uBarPhase - 0\.25 \* age \+ (0\.\d+)\) \* 4\.0\); return i < 0\.5 \? (\d\.\d+) : \(abs\(i - 2\.0\) < 0\.5 \? (\d\.\d+) : (\d\.\d+)\); \}/);
  assert.ok(bw && +bw[2] > 0.005 && +bw[2] <= 0.04 && +bw[3] > 1 && +bw[3] > +bw[4] && +bw[4] > +bw[5] && +bw[1] < +bw[3] && +bw[1] > +bw[5], 'the strike is weighed at its own beat line: one > three > two/four, freewheeling between');
  const lw = room.match(/float frLeanW\(\)\{ if \(dPeriod <= 0\.0\) return 0\.8; float i = floor\(fract\(uBarPhase \+ 0\.1\) \* 4\.0\); return i < 0\.5 \? (\d\.\d+) : \(abs\(i - 2\.0\) < 0\.5 \? (\d\.\d+) : (\d\.\d+)\); \}/);
  assert.ok(lw && +lw[1] === 1.0 && +lw[1] > +lw[2] && +lw[2] >= +lw[3], 'the breath is drawn deepest before the one');
  const lg = room.match(/float lean = danceLean\(ph\) \* frLeanW\(\) \* \(1\.0 - smoothstep\((\d\.\d+), (\d\.\d+), dAge\)\);/);
  assert.ok(/float ph = danceBeatPhase\(\);/.test(room) && lg, 'the lean is the prelude\'s, on the beat phase, weighed by the count it loads for, on a live beat only');
  // A1 - no breath on an empty lattice: a groove's last strike before a count is at most a beat old (the read-ahead included), so the
  // gate is whole past a beat; an outro's pad holds the lattice three or four beats after its last strike, so it is shut by 2.5
  assert.ok(+lg[1] >= 1.1 && +lg[2] > +lg[1] && +lg[2] <= 2.5, `the breath's live-beat gate: whole to ${lg[1]} beat after the last strike, shut by ${lg[2]}`);
  const lgj = dcode.match(LGJS);
  assert.ok(lgj && +lgj[1] === +lg[1] && +lgj[2] === +lg[2], 'the drivers\' live-beat gate is the fragment\'s, constant for constant');
  assert.ok(/function frLeanWJS\(barPh, dPeriod\)\{\s*if \(!\(dPeriod > 0\)\) return 0\.8;\s*const q = barPh \+ 0\.1, i = Math\.floor\(\(q - Math\.floor\(q\)\) \* 4\);\s*return i < 0\.5 \? 1\.0 : \(Math\.abs\(i - 2\) < 0\.5 \? 0\.5 : 0\.25\);\s*\}/.test(region)
    && new RegExp('return i < 0\\.5 \\? ' + lw[1].replace('.', '\\.') + ' : \\(Math\\.abs\\(i - 2\\) < 0\\.5 \\? ' + lw[2].replace('.', '\\.') + ' : ' + lw[3].replace('.', '\\.') + '\\);').test(region), 'the drivers\' breath weight is the fragment\'s');
  assert.ok(LGJS.test(drv) && /const coil = Math\.max\(dBrace, 0\.6 \* \(1 - danceSmooth\(0, 2, dImpact\)\)\);/.test(drv) && /float coil = max\(dBrace, 0\.6 \* \(1\.0 - smoothstep\(0\.0, 2\.0, dImpact\)\)\);/.test(room), 'the drivers\' breath and coil are the fragment\'s arithmetic');
  // ---- laws 5, 6 - the light budget: the exposure is the section's; the hats are glints on the limb and the veins; no flash in place
  const ex = room.match(/outc \*= \(0\.9 \+ 0\.3 \* uAct \* uCalm\) \* \(1\.0 - (0\.\d+) \* dBrace\) \* \(1\.0 - (0\.\d+) \* lean\);/);
  assert.ok(ex && +ex[2] <= 0.1, 'the exposure: the section\'s loudness (uCalm, seconds) through the story clock, dimmer in the coil, a breath drawn in before the count');
  for (const st of stmts) if (/(^|\s)(outc|g|gl_FragColor) \*=/.test(st)) assert.ok(!/\b(dHit|dAge|ageS|lampK|kick|one|kf|dKick|dSpark|dSway|dLift)\b/.test(st), 'no whole-frame multiplier on the beat: ' + st.trim().slice(0, 110));
  assert.ok(/g \*= 0\.85 \+ 0\.15 \* dMass;/.test(room), 'the corona and the halo on the passage\'s weight');
  const spark = stmts.filter(st => /\bdSpark\b/.test(st));
  assert.ok(spark.length === 2 && spark.every(st => /outc \+= col \* fres \* \(0\.45 \+ 0\.\d+ \* dSpark\)|outc \+= veinCol \* vein \* uBand \* \(1\.0 \+ 0\.\d+ \* dMass \+ 0\.\d+ \* dSpark\)/.test(st)), 'dSpark only glints the limb and the veins (light only): ' + spark.map(s => s.trim().slice(0, 60)).join(' | '));
  assert.ok(/float bx = clamp\(gTrapN, 0\.0, 4\.0\) \* uBandK \+ uBandPhase \+ 0\.\d+ \* dKick;/.test(room), 'the veins step with the kick, signed (they settle back on the rebound)');
  assert.ok(/vec3 oc = mix\(uColC, uColB, 0\.35\) \* \(1\.0 \+ 0\.5 \* lampK\);/.test(room) && /lit = col \* \(0\.12 \+ d1 \* 0\.62\) \+ uColB \* d2 \* 0\.\d+;/.test(room), 'the orbs brighten with the lamp; the second light\'s fill is a constant (chord-only colour)');
  // ---- laws 1, 2, 4, 9 - the set on a slow leash: the spring and the breath on x, the held articulation on y, nothing on z
  const off = drv.match(/off\.set\(\s*Math\.sin\(t \* 0\.11\) \* 0\.055 \* \(1 - (0\.\d+) \* coil\) \+ (0\.\d+) \* \(dKick - (0\.\d+) \* lean\),\s*Math\.cos\(t \* 0\.09\) \* 0\.055 \* \(1 - \1 \* coil\) \+ (0\.\d+) \* artH,\s*Math\.sin\(t \* 0\.07 \+ 1\.7\) \* 0\.055 \* \(1 - \1 \* coil\)\s*\);/);
  assert.ok(off && +off[3] >= 0.2 && +off[2] <= 0.04, 'the set: its sines drawn in by the coil, the kick\'s compress on x (the breath a fifth of it the other way), the bar on y, nothing on z');
  // laws 4, 8, 15 - THE HELD ARTICULATION READS ONE CLOCK: the bar it deals and the ease it deals it over come from the same clock (the
  // phrase's own bar and its phase inside it), so a rest that holds the engine's bar phase while the phrase runs on can never deal it
  // mid-silence (it did: every form that reads it twitched once inside the silent bar, and back on the landing). Every reader of the
  // deal (the set's y, OCTA's fold, JULIA's c, WEAVE's cage) takes it through that one pair; held once dealt, still in a rest
  const clk = dstm.find(st => /\bbar8\s*=(?!=)/.test(st)), clkNames = clk ? [...clk.matchAll(/\b(\w+)\s*=(?!=)/g)].map(m => m[1]) : [];
  assert.ok(clk && /\buPhrasePhase\b/.test(clk) && !/\b(barPh|uBarPhase|uBeatIdx|ph|d0|d2|t|dtm|time)\b/.test(clk), 'the bar in the phrase and the phase inside it are read off ONE clock, the phrase\'s: ' + (clk || '').trim().slice(0, 110));
  const heldCalls = [...dcode.matchAll(/frHeldJS\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\d+\.\d+)\s*\)/g)];
  assert.ok(heldCalls.length >= 2 && heldCalls.length === (dcode.match(/frHeldJS\(/g) || []).length && heldCalls.every(m => m[1] === 'bar8' && m[2] !== 'bar8' && clkNames.includes(m[2])), 'every deal reads its bar and its ease from that one clock: ' + heldCalls.map(m => m[0]).join(' | '));
  const artSt = dstm.find(st => /\bconst artH\s*=/.test(st));
  assert.ok(artSt && /^\s*const artH = frHeldJS\([^)]*\) \* dStill\s*$/.test(artSt), 'the articulation is the bar\'s deal, held, still in a rest');
  // the pure form, driven: a groove (both clocks run), then a rest that HOLDS the bar phase while the phrase runs on (the silent bar
  // before a drop, the stillness still open), its release, and a longer hold across bar lines - at 24, 60 and 120 frames a second and
  // for several held phases. No frame steps any deal further than the groove's own eased re-deal does at that frame rate, and in the
  // groove the deal moves inside the bar's first fifth only
  {
    const hJS = new Function('danceSmooth', strip(region.slice(region.indexOf('function frHeldJS('), region.indexOf('function buildFractalField(){'))) + '; return frHeldJS;')((p, q, x) => { const r = Math.min(1, Math.max(0, (x - p) / (q - p))); return r * r * (3 - 2 * r); });
    const deal = new Function('U', 'barPh', 'frHeldJS', clk + '; return [' + heldCalls.map(m => m[0]).join(', ') + '];');
    for (const fps of [24, 60, 120]) for (const h0 of [0.05, 0.164, 0.5, 0.93]){
      const Pb = 0.5, dt = 1 / fps, bar = 4 * Pb, phrase = 32 * Pb;   // 120 BPM, four to the bar, 32 beats to the phrase
      const holds = [[(5 + h0) * bar, (6.8 + h0) * bar], [(19 + h0) * bar, (22.2 + h0) * bar]];
      let prev = null, grooveMax = 0, worst = 0, worstAt = 0, heldPh = null;
      for (let f = 0; f < 32 * bar * fps; f++){
        const time = f * dt, live = (time / bar) % 1, held = holds.some(([x, y]) => time >= x && time < y);
        heldPh = held ? (heldPh == null ? live : heldPh) : null;
        const v = deal({ uPhrasePhase: { value: (time / phrase) % 1 } }, held ? heldPh : live, hJS);
        if (prev){
          const st = Math.max(...v.map((x, i) => Math.abs(x - prev[i])));
          if (time < holds[0][0]){ grooveMax = Math.max(grooveMax, st); if (live >= 0.2 + 1.5 * dt / bar) assert.ok(st < 1e-12, `the groove's deal moves in the bar's first fifth only (${fps} fps, bar phase ${live.toFixed(3)}: ${st})`); }
          else if (st > worst){ worst = st; worstAt = time; }
        }
        prev = v;
      }
      assert.ok(grooveMax > 0 && worst <= grooveMax * (1 + 1e-9), `a held bar phase never steps the deal past the groove's eased re-deal (${fps} fps, held at ${h0}: ${worst.toFixed(4)} at ${worstAt.toFixed(3)} s against ${grooveMax.toFixed(4)})`);
    }
  }
  assert.ok(/const s = b \+ sgn \* \(Math\.sin\(t \* 0\.06\) \* 0\.22 \+ (0\.\d+) \* dMass \+ (0\.\d+) \* dKick \+ 0\.05\);/.test(drv), 'CUBE / VOID: the scale breathes on the passage, the kick\'s spring inside it');
  assert.ok(/u\.uBoxScale\.value = -1\.5 - \(Math\.sin\(t \* 0\.05\) \* 0\.05 \+ 0\.\d+ \* dMass\) - 0\.\d+ \* frHeldJS\(bar8, (\w+), 4\.0\) \* dStill;/.test(drv) && clkNames.includes(drv.match(/frHeldJS\(bar8, (\w+), 4\.0\)/)[1]), 'WEAVE: the cage re-knits once per bar on the one clock, held, still in a rest');
  assert.ok(/u\.uFold\.value = 0\.22 \+ Math\.sin\(t \* 0\.07\) \* 0\.06 \+ 0\.\d+ \* artH;/.test(drv), 'OCTA: the twist turns once per bar');
  assert.ok(/0\.62 \+ Math\.sin\(t \* 0\.08\) \* 0\.07 \+ 0\.\d+ \* dMass,\s*0\.62 \+ Math\.cos\(t \* 0\.06\) \* 0\.07 \+ 0\.\d+ \* artH,\s*-0\.28 \+ Math\.sin\(t \* 0\.05 \+ 2\.2\) \* 0\.07\);/.test(drv), 'JULIA: c on the passage and the bar, the hats out of z');
  // law 8 - stillness: the integrated clocks crawl in a rest; the orbs swell with the spring (signed), fall inward in the coil
  const orb = drv.match(/orbT \+= dtm \* \((0\.\d+) \+ (0\.\d+) \* dStill\) \* \(1 - 0\.\d+ \* coil\);/);
  assert.ok(orb && +orb[1] <= 0.3 && Math.abs(+orb[1] + +orb[2] - 1) < 1e-9, 'the orbs\' clock slows to a crawl when the music stops (a rate, never a jump)');
  assert.ok(/const R = F\.bound \* 0\.78 \* \(1 \+ 0\.\d+ \* dKick\) \* \(1 - 0\.\d+ \* coil\);/.test(drv) && /u\.uOrbR\.value = F\.bound \* 0\.062 \* P\.orbMul \* \(1 \+ 0\.\d+ \* dKick\);/.test(drv), 'the orbs swell with the body\'s spring, never the onset envelope');
  assert.ok(/bandPhase = \(bandPhase \+ dtm \* \(0\.035 \+ 0\.\d+ \* dMass\) \* \(0\.3 \+ 0\.7 \* dStill\) \* \(1 - 0\.5 \* coil\)/.test(drv), 'the veins\' flow is the passage\'s, stilled in a rest, slower in the coil');
  // ---- law 15 - the bar-held articulation, the pure form: constant after the bar's first fifth, no step at any bar line (the phrase's wrap too)
  const held = new Function('danceSmooth', strip(region.slice(region.indexOf('function frHeldJS('), region.indexOf('function buildFractalField(){'))) + '; return frHeldJS;')((a, b, x) => { const q = Math.min(1, Math.max(0, (x - a) / (b - a))); return q * q * (3 - 2 * q); });
  for (let bar = 0; bar < 8; bar++){
    const v = held(bar, 0.2, 3.0);
    for (let bp = 0.2; bp < 1; bp += 0.05) assert.ok(Math.abs(held(bar, bp, 3.0) - v) < 1e-12, 'held through the bar');
    const next = (bar + 1) % 8;
    assert.ok(Math.abs(held(next, 0, 3.0) - held(bar, 0.999, 3.0)) < 1e-6, `no step at the bar line (3π/4 to eight digits: the phrase wrap within 1e-7) ${bar} -> ${next}`);
    assert.ok(Math.abs(held(bar, 0.5, 3.0)) <= 1 + 1e-12, 'within -1..1');
  }
  // ---- law 15 - THE WALK ON THE BAR, the pure form: driven through a groove with a held rest and a release
  const rungSrc = region.slice(region.indexOf('function frRungStep('), region.indexOf('function frLeanWJS('));
  const rungStep = new Function('danceSmooth', strip(rungSrc) + '; return frRungStep;')((a, b, x) => { const q = Math.min(1, Math.max(0, (x - a) / (b - a))); return q * q * (3 - 2 * q); });
  // A1 - the walk ARMS on the phrase's bars COUNTED (two whole bars standing; the phrase runs on through a held rest), so neither the
  // frame grid nor the rubato (the musical dt the drivers integrate) can move which line it takes: driven under a rubato, the same
  // bar lines at 24, 30, 60 and 120 frames a second
  const startBars = {};
  for (const fps of [24, 30, 60, 120]) for (const P of [0.4, 0.5, 0.6]){
    const dim = { a: 4, b: 4, t: null, wait: 0, bars: 0, bar: null, dir: 1, k: 0, pb: null, onBar: false }, dt = 1 / fps;
    let bar = 0, held = false, starts = [], lastK = 0, lastStart = -1e9, inMorph = false, pbarT = null, lines = 0;
    const sb = startBars[P] = startBars[P] || {}; sb[fps] = [];
    for (let f = 0; f < fps * 60; f++){
      const time = f * dt, rest = time > 20 && time < 26;   // six seconds of a held rest: the bar phase frozen, the stillness down
      if (!rest) bar = time / (4 * P);
      const barPh = bar - Math.floor(bar), still = rest ? 0 : (time >= 26 && time < 26.5 ? (time - 26) / 0.5 : 1);
      const was = dim.t != null;
      // the one's own strike: on the bar line in the groove; none in the rest and none in a silent bar (40..44 s) whose
      // bar line is passed by a roll's last 16th - the walk must not start a morph into silence
      const silent = time > 40 && time < 44, struck = !rest && !silent && (barPh < 0.1 || barPh > 0.95);
      const pbar = Math.floor(time / (4 * P) + 1e-9);   // the phrase's own bar: it runs on through the rest
      if (pbarT != null && pbar !== pbarT) lines++;
      pbarT = pbar;
      rungStep(dim, { dt: dt * (1 + 0.45 * Math.sin(time * 0.9 + 7 * P)), period: P, grid: true, barPh, bar: pbar % 8, still, struck });   // the musical dt, under a rubato
      if (dim.t != null && !was){
        starts.push(time); sb[fps].push(Math.round(bar));
        assert.ok(lines >= 3, `two whole bars stand on a rung: the walk starts no sooner than the phrase's third bar line after the last morph (${fps} fps, P ${P}, t ${time.toFixed(3)}: line ${lines})`);
        lines = 0;
        assert.ok(barPh < 0.25 && still > 0.9, `a morph starts on a live bar line, never in a rest or on its release (${fps} fps, P ${P}, t ${time.toFixed(3)}, bar phase ${barPh.toFixed(3)})`);
        assert.ok(!silent, `no morph starts in a silent bar: a bar line passed with no strike of its own (${fps} fps, P ${P}, t ${time.toFixed(3)})`);
        assert.ok(time - lastStart >= 8 * P - 1e-9, 'eight beats stand on a rung before the walk moves');
        lastStart = time; lastK = 0; inMorph = true;
      }
      if (dim.t != null){
        assert.ok(dim.k >= lastK - 1e-12 && Math.abs(dim.b - dim.a) === 1, 'the morph travels one rung, one way');
        if (barPh >= 0.25) assert.ok(false, 'the morph is done by the bar\'s second beat');
        lastK = dim.k;
      } else if (inMorph){ inMorph = false; assert.ok(barPh >= 0.25 - 1e-9 && barPh < 0.35, 'the morph lands on the bar\'s second beat'); }
      assert.ok(dim.a >= 3 && dim.a <= 9 && dim.k >= 0 && dim.k <= 1, 'the ladder stays 3..9');
      if (rest) assert.ok(dim.t == null || dim.k === lastK, 'a held bar holds the morph');
    }
    assert.ok(starts.length >= 5, `the walk walks (${starts.length} morphs in a minute at ${fps} fps, P ${P})`);
  }
  for (const P of Object.keys(startBars)) for (const fps of [30, 60, 120]) assert.deepStrictEqual(startBars[P][fps], startBars[P][24], `the walk takes the same bar lines at ${fps} and at 24 frames a second (P ${P})`);
  // ...and with no grid it keeps the old clock: eight beats of dt standing, two of travel
  { const dim = { a: 8, b: 8, t: null, wait: 0, bars: 0, bar: null, dir: -1, k: 0, pb: null, onBar: false }; let n = 0, was = false;
    for (let f = 0; f < 24 * 30; f++){ rungStep(dim, { dt: 1 / 24, period: 0.5, grid: false, barPh: 0.37, still: 1, struck: false }); if (dim.t != null && !was) n++; was = dim.t != null; }
    assert.ok(n >= 5 && n <= 7, 'freewheeling, a morph every ten beats (' + n + ' in 30 s)'); }
  assert.ok(/frRungStep\(dim, \{ dt: dtm, period: \(typeof DANCE !== 'undefined'\) \? DANCE\.period : 0, grid: dPeriod > 0, barPh, bar: bar8, still: dStill, struck \}\);/.test(drv) && clkNames.includes('bar8') && /u\.uPowA\.value = dim\.a; u\.uPowB\.value = dim\.b; u\.uPowT\.value = dim\.k;/.test(drv), 'the bulbs walk on frRungStep');
  // every loop of the march bounded by a compile-time literal
  const loops = [...room.matchAll(/for\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(loops.length >= 6, 'the march, the DEs and the folds are loops');
  for (const l of loops) assert.ok(/^\s*int \w+ = 0;\s*\w+ < \d+;\s*\w+\+\+\s*$/.test(l), 'literal-bounded loop: ' + l);

  // ---- law 10 - the twin: Shaders2.metal's room_fractal and rm_fr carry the same dance, the same text
  const metal = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Shaders2.metal'), 'utf8');
  const m0 = metal.indexOf('/* ==== ROOM REGION: FRACTAL'), m1 = metal.indexOf('/* ==== END ROOM REGION: FRACTAL', m0);
  assert.ok(m0 >= 0 && m1 > m0, 'the FRACTAL region is fenced in Shaders2.metal');
  const mreg = metal.slice(m0, m1);
  const e0 = mreg.indexOf('fragment float4 room_fractal('), entry = mreg.slice(e0), fc0 = mreg.indexOf('inline float3 fieldColor('), fcol = mreg.slice(fc0, mreg.indexOf('}  // namespace rm_fr', fc0));
  assert.ok(e0 > 0 && fc0 > 0, 'the entry and fieldColor<F> are in the region');
  const lines = s => strip(s).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const cut = (s, x, y) => { const i = s.indexOf(x), j = s.indexOf(y, i + 1); assert.ok(i >= 0 && j > i, 'found ' + x + ' .. ' + y); return s.slice(i, j); };
  const cutTo = (s, x, y) => { const i = s.indexOf(x), j = s.indexOf(y, i + 1); assert.ok(i >= 0 && j > i, 'found ' + x + ' .. ' + y); return s.slice(i, s.indexOf('\n', j)); };
  // the body, the camera block, the strike's clock and the lamp, the key light and the exposure: the web's lines, through no map at all
  assert.deepStrictEqual(lines(cutTo(entry, 'float ph = danceBeatPhase();', 'float kick = ')), lines(cutTo(room, 'float ph = danceBeatPhase();', 'float kick = ')), 'the twin\'s body (the count, the breath, the coil, the strike\'s clock, the lunge) is the web\'s, line for line');
  assert.deepStrictEqual(lines(cutTo(entry, 'float distK = ', 'vec3 rd = normalize(')), lines(cutTo(room, 'float distK = ', 'vec3 rd = normalize(')), 'the twin\'s camera block (the zoom, the soft floor, the nod, the rays) is the web\'s, line for line');
  assert.deepStrictEqual(lines(cutTo(fcol, 'float hq = ', 'outc *= (0.9')), lines(cutTo(room, 'float hq = ', 'outc *= (0.9')), 'the twin\'s travelling key light and exposure are the web\'s, line for line');
  for (const one of ['float lampK = ', 'vec3 oc = mix(uColC, uColB, 0.35)', 'lit = col * (0.12 + d1 * 0.62) + uColB', 'outc += col * fres * (0.45', 'float bx = clamp(gTrapN', 'outc += veinCol * vein * uBand', 'g *= 0.85 + 0.15 * dMass'])
    assert.deepStrictEqual(lines(cutTo(fcol, one, ';')), lines(cutTo(room, one, ';')), 'the twin\'s ' + one + ' … is the web\'s');
  // the count helpers through the accessor map (a namespace helper takes the uniforms as the prelude's helpers do)
  const acc = s => s.replace(/^inline float (fr\w+)\(constant VizUniforms& U(, )?/gm, 'float $1(').replace(/^inline float (fr\w+)\(/gm, 'float $1(');
  for (const fn of ['frBeatW', 'frLeanW', 'frBodyW', 'frStrike', 'frNod', 'frDir']) assert.deepStrictEqual(lines(acc(cutTo(mreg, 'inline float ' + fn + '(', '}'))), lines(cutTo(room, 'float ' + fn + '(', '}')), 'the twin\'s ' + fn + ' is the web\'s');
  // ...and no dance line lives on one stage only: every line of the web's fragment that reads the bus, the prelude or the body's terms is
  // a line of the twin, and every such line of the twin's shading and entry is a line of the web's fragment. What one stage keeps for
  // itself is named here, and each is checked above: the web's uniform lines; the TV's closed-form drivers (constant for constant, term
  // for term), its camera inputs (the rig's constants), its hue stand-in and its plumbing (the switch, fieldColor's new parameters)
  const DT = /\b(d(Hit|Age|Kick|Mass|Artic|Spark|Sway|Lift|Brace|Impact|Still|Period)|dance[A-Z]\w*|fr[A-Z]\w*|lampK|ageS|lean|coil|kick|distK|nod|hq|hd|hx|xr|Lh|kf|one|artH|bar8|uCalm|uAct)\b/;
  const tvAll = new Set(lines(acc(mreg))), webAll = new Set(lines(room));
  for (const l of lines(room)) if (DT.test(l) && !/^uniform /.test(l)) assert.ok(tvAll.has(l), 'the twin carries the web\'s dance line: ' + l.slice(0, 110));
  const TV_OWN = ['float q8 = ', 'float artH = ', 'float3 off = float3(', 'cos(T * 0.09)', 'sin(T * 0.07 + 1.7)', 'float s = b + sgn * (', 'P.boxScale = -1.5', 'P.fold = 0.22', 'P.juliaC = float3(', '0.62 + cos(T * 0.06)', 'float R = P.bound * 0.78', 'P.orbR = P.bound', 'float roll = ', 'float uTanFov = ', 'float hueDrift = ', 'case ', 'default: col = fieldColor<', 'float3 cR, float3 cU, float3 cW, float ageS, float one, float lean) {'];
  for (const l of lines(acc(fcol + entry))) if (DT.test(l) && !/^#(define|undef) /.test(l) && !TV_OWN.some(p => l.startsWith(p))) assert.ok(webAll.has(l), 'the web carries the twin\'s dance line: ' + l.slice(0, 110));
  const hueTV = cut(entry, 'float hueDrift = ', ';');
  assert.ok(/\buCalm\b/.test(hueTV) && !/\bd[A-Z]\w*|\b(ageS|lampK|kick|one|lean|coil|artH)\b|\bU\.(bass|mid|treble|energy|onsetEnv|beatPhase)\b/.test(hueTV), 'the TV\'s hue stand-in is the section\'s loudness, slow: no beat, no body, no band');
  // the drivers: the web's JS arithmetic in closed form, constant for constant
  const num = s => (s.replace(/[A-Za-z_]\w*/g, ' ').match(/\d+\.\d+|\d+/g) || []).map(Number);   // identifiers out first (float3, sin)
  // ...and term for term: the bus readings in the same places (a TV that drops a stillness, or reads the strike or the live articulation
  // where the web reads the spring or the held bar, keeps every constant and still is another room)
  const ids = s => (s.match(/\b(d[A-Z]\w*|lean|coil|kick|artH|bar8|barQ|q8|frHeld(?:JS)?|barPh|uBarPhase|phrasePhase|uPhrasePhase)\b/g) || []).map(x => ({ frHeldJS: 'frHeld', barPh: 'uBarPhase', uPhrasePhase: 'phrasePhase' })[x] || x);
  const eqNums = (a, b, what) => { assert.deepStrictEqual(num(a), num(b), what + ': ' + a.trim().slice(0, 80) + ' | ' + b.trim().slice(0, 80)); assert.deepStrictEqual(ids(a), ids(b), what + ' reads the same bus terms in the same places: ' + a.trim().slice(0, 80) + ' | ' + b.trim().slice(0, 80)); };
  const tvOff = cut(entry, 'float3 off = float3(', ';'), webOff = cut(drv, 'off.set(', ';');
  eqNums(tvOff, webOff, 'the set\'s leash on both stages');
  eqNums(cut(entry, 'float s = b + sgn * (', ';'), cut(drv, 'const s = b + sgn * (', ';'), 'CUBE / VOID');
  eqNums(cut(entry, 'P.boxScale = -1.5 - (', ';'), cut(drv, 'u.uBoxScale.value = -1.5 - (', ';'), 'WEAVE');
  eqNums(cut(entry, 'P.fold = 0.22 + ', ';'), cut(drv, 'u.uFold.value = 0.22 + ', ';'), 'OCTA');
  eqNums(cut(entry, 'P.juliaC = float3(', ';'), cut(drv, 'u.uJuliaC.value.set(', ';'), 'JULIA');
  eqNums(cut(entry, 'float R = P.bound * 0.78', ';'), cut(drv, 'const R = F.bound * 0.78', ';'), 'the orbs\' orbit');
  eqNums(cut(entry, 'P.orbR = P.bound * 0.062', ';'), cut(drv, 'u.uOrbR.value = F.bound * 0.062', ';'), 'the orbs\' radius');
  eqNums(cut(entry, 'float artH = ', ';'), cut(drv, 'const artH = ', ';'), 'the held articulation');
  eqNums(cut(entry, 'float q8 = ', ';'), cut(drv, 'const q8 = ', ';'), 'the bar in the phrase and the phase inside it, one clock');
  assert.ok(!/\buBarPhase\b/.test(cut(entry, 'float q8 = ', ';')), 'the twin\'s deal reads the phrase\'s clock alone, as the web\'s');
  assert.ok(/inline float frHeld\(float bi, float bp, float seed\)\{ return mix\(sin\(\(bi - 1\.0\) \* 2\.3561945 \+ seed\), sin\(bi \* 2\.3561945 \+ seed\), smoothstep\(0\.0, 0\.2, bp\)\); \}/.test(mreg) && /const a = Math\.sin\(\(bi - 1\) \* 2\.3561945 \+ seed\), b = Math\.sin\(bi \* 2\.3561945 \+ seed\);\s*return a \+ \(b - a\) \* danceSmooth\(0, 0\.2, bp\);/.test(region), 'the twin\'s held articulation is the web\'s arithmetic');
  // the camera: the TV has no rig figures (its rigK is 1: the lunge, the room's, is the same text on both stages); the web rig's
  // head-tilt and its phrase FOV, retold with the rig's own constants (read from the director)
  const wt = html.match(/camera\.rotation\.z \+= sway \* (0\.\d+)/), wf = html.match(/const goalFov = \(v2 \? (\d+) \+ (\d+) \* db\[7\]/);
  assert.ok(/float3 uCamPos = dir \* \(base \* \(1\.0 \+ 0\.05 \* sin\(T \* 0\.05\)\)\);/.test(entry) && !/\brigK\b|\brigR\b/.test(strip(entry)), 'the TV\'s camera sits at the form\'s framing distance and the slow sine: no rig ratio, no second spring');
  const troll = entry.match(/float roll = (0\.\d+) \* dSway, cr = cos\(roll\), sr = sin\(roll\);/), tfov = entry.match(/float uTanFov = tan\(\((\d+\.\d+) \+ (\d\.\d+) \* dLift\) \* \(PI_A \/ 180\.0\)\) \* lensMul;/);
  assert.ok(wt && troll && +troll[1] === +wt[1], 'the TV rolls with the bar as the web rig\'s head tilts');
  assert.ok(wf && tfov && +tfov[1] * 2 === +wf[1] && +tfov[2] * 2 === +wf[2], 'the TV\'s FOV is the web rig\'s, half-angle, the phrase only: the bass is out');
  assert.ok(/float3 uCamR = right0 \* cr \+ up0 \* sr, uCamU = up0 \* cr - right0 \* sr, uCamW = -fwd;/.test(entry), 'the TV builds the web\'s camera inputs');
  assert.ok(/fieldColor<0>\(ro, rd, pixAng, pos\.xy, P, L, U, sky, cR, cU, cW, ageS, one, lean\)/.test(entry) && /float3 cR, float3 cU, float3 cW, float ageS, float one, float lean\)/.test(mreg), 'the nodded basis, the strike\'s clock, its count and the breath reach the hit\'s shading');
  // the macros: the twelve onto the uniforms, the helpers passed U, the slow voices in the web's sense; all let go of before the region ends
  const defs = [...mreg.matchAll(/^#define (\w+)/gm)].map(m => m[1]).sort(), undefs = [...mreg.matchAll(/^#undef (\w+)/gm)].map(m => m[1]).sort();
  assert.deepStrictEqual(undefs, defs, 'every macro the twin defines is let go of');
  for (const d of twelve) assert.ok(new RegExp('#define ' + d + ' U\\.' + d + '\\n').test(mreg), 'the twin maps ' + d + ' onto the uniforms');
  assert.ok(/#define danceBeatPhase\(\) danceBeatPhase_a\(U\)\n/.test(mreg) && /#define danceLean\(p\) danceLean_a\(U, \(p\)\)\n/.test(mreg) && /#define danceLamp danceLamp_a\n/.test(mreg) && /#define danceLand danceLand_a\n/.test(mreg) && /#define frBeatW\(a\) frBeatW\(U, \(a\)\)\n/.test(mreg) && /#define frLeanW\(\) frLeanW\(U\)\n/.test(mreg) && /#define frBodyW\(a\) frBodyW\(U, \(a\)\)\n/.test(mreg) && /#define frDir\(a\) frDir\(U, \(a\)\)\n/.test(mreg) && /#define danceFront danceFront_a\n/.test(mreg), 'the twin calls the _a prelude and passes U to the helpers that read the bus');
  assert.ok(/#define uCalm \(1\.0 - U\.calm\)\n/.test(mreg) && /#define uBarPhase U\.barPhase\n/.test(mreg), 'the TV reads the loudness in the web\'s sense (its analyser counts calm DOWN)');
  // the story clock in the web's sense: the web's uAct is the director's actT, eased toward the act's HEAT (an arc that peaks at the
  // apex); the TV's U.act is the eased act INDEX 0..4, so the twin reads the web's heat curve at it - point for point at every act
  const a0 = html.indexOf('const ACTS = ['), acts = html.slice(a0, html.indexOf('];', a0)), heat = [...acts.matchAll(/\bheat: (\d+\.\d+)/g)].map(m => +m[1]);
  assert.ok(heat.length === 5 && /U\.uAct\.value = this\.actT;/.test(html) && /const heatGoal = Math\.min\(ACTS\[this\.act\]\.heat, ceil \+ 0\.05\);/.test(html) && /this\.actT \+= \(heatGoal - this\.actT\)/.test(html), 'the web\'s uAct is the eased act heat');
  assert.ok(/#define uAct frActHeat\(U\.act\)\n/.test(mreg), 'the TV reads the act through the web\'s heat curve');
  const fahSrc = strip(cutTo(mreg, 'inline float frActHeat(float a){', '}')).replace(/^[\s\S]*?frActHeat\(float a\)\{/, '').replace(/\}\s*$/, '').replace(/\bfloat\b/g, 'let');
  const fah = new Function('clamp', 'floor', 'min', 'mix', 'return function(a){' + fahSrc + '};')((x, lo, hi) => Math.min(hi, Math.max(lo, x)), Math.floor, Math.min, (p, q, t) => p + (q - p) * t);
  for (let a = 0; a <= 4 + 1e-9; a += 0.125){ const i = Math.min(Math.floor(a), 3), want = heat[i] + (heat[i + 1] - heat[i]) * (a - i); assert.ok(Math.abs(fah(a) - want) < 1e-9, `the TV's act heat at act ${a} is the web's (${fah(a)} against ${want})`); }
  const tvHeat = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/VisualizerView.swift'), 'utf8').match(/actHeatTable: \[Double\] = \[([^\]]+)\]/);
  assert.ok(tvHeat && tvHeat[1].split(',').map(Number).join() === heat.join(), 'the TV app\'s own act-heat table is the web\'s');
  // no struct member wears a macro's name, so no U.U. can form when the header expands
  const members = [...mreg.matchAll(/struct (Params|Look) \{([\s\S]*?)\};/g)].map(m => m[2]).join(' ');
  for (const d of defs) assert.ok(!new RegExp('\\b' + d + '\\b').test(strip(members)), 'no member is named ' + d);
  for (const d of defs.filter(d => !/^(vec3|frBeatW|frLeanW|frBodyW|frDir|danceBeatPhase|danceLean|danceLamp|danceLand|danceFront)$/.test(d))) assert.ok(!new RegExp('\\.' + d + '\\b').test(strip(mreg).split('\n').filter(l => !/^\s*#(define|undef)\b/.test(l)).join('\n')), 'no accessor .' + d + ' is written by hand inside the dialect');
  assert.ok(!/\bU\.(bass|mid|treble|energy|onsetEnv|beatPhase)\b/.test(strip(mreg)) && !/\b(spectrum|waveform)\.read\(/.test(mreg), 'the twin reads no raw band, no live spectrum');
  assert.ok(!/\bCOUPLING\b|\bL\.(energy|beat)\b/.test(strip(mreg)), 'the twin\'s neutral coupling and its band-fed look are gone');
  const tloops = [...mreg.matchAll(/for\s*\(([^)]*)\)/g)].map(m => m[1]);
  for (const l of tloops) assert.ok(/^\s*int \w+ = 0;\s*\w+ < \d+;\s*\w+\+\+\s*$/.test(l), 'the twin\'s literal-bounded loop: ' + l);
  assert.ok(/return float4\(rm_fr::govern\(VOID_A \+ max\(col, float3\(0\.0\)\), U\.white\), 1\.0\);/.test(entry) && (strip(entry).match(/\breturn\b/g) || []).length === 1, 'the twin governs its one exit');
});

/* THE FROZEN TRACE. A fixed synthetic drive at 120 BPM and 60 Hz: one bar of
   count-in at rest (beats 0..3), eight beats of groove (kick on 1 and 3,
   snare on 2 and 4, hats on every eighth; the levels decay from each hit),
   then four beats of silence. No score, so the coil and the landing stay
   quiet (they have their own test above). The table below is the bus at 22
   frames, frozen from this implementation; the Swift port steps the same
   drive (DANCE_TRACE_OUT=path node tests/player.test.mjs writes every frame's
   inputs and outputs as JSON) and must land on the same numbers. */
function busTraceDrive(i){
  const P = 0.5, t = i * BUS_DT, beat = t / P, bi = Math.floor(beat), fr = i % 30;
  const groove = bi >= 4 && bi < 12, silent = bi >= 12;
  const g = bi - 4;                                     // beat inside the groove
  const kickBeat = groove && g % 2 === 0, snareBeat = groove && g % 2 === 1;
  const onKick = kickBeat && fr === 0, onSnare = snareBeat && fr === 0, onHat = groove && i % 15 === 0;
  const sinceKick = !groove ? Infinity : (kickBeat ? fr * BUS_DT : fr * BUS_DT + P);
  const sinceSnare = !groove || g === 0 ? Infinity : (snareBeat ? fr * BUS_DT : fr * BUS_DT + P);
  const sinceHat = groove ? (i % 15) * BUS_DT : Infinity;
  const bass = silent ? 0 : 0.25 + 0.65 * Math.exp(-sinceKick / 0.12);
  const mid = silent ? 0 : 0.30 + 0.50 * Math.exp(-sinceSnare / 0.10);
  const treble = silent ? 0 : 0.20 + 0.40 * Math.exp(-sinceHat / 0.05);
  return {
    bass, mid, treble, energy: silent ? 0 : S.clamp01(0.4 * bass + 0.35 * mid + 0.25 * treble),
    centroid: 0.4 + 0.05 * Math.sin(t * 2.1),
    rb: onKick ? 0.6 : 0, rm: onSnare ? 0.5 : 0, rt: onHat ? 0.5 : 0, punch: onKick ? 0.9 : (onSnare ? 0.7 : 0),
    period: P, haveGrid: true, beatIdx: bi % 4, barPhase: (beat / 4) % 1, phrasePhase: (beat / 32) % 1,
    ear: silent ? 0.3 : 0.85, playing: true, breath: Math.sin(t * 0.88 + Math.sin(t * 0.213) * 1.7) * 0.5, calm: false,
  };
}
const BUS_TRACE_FRAMES = 480;
const BUS_TRACE_SAMPLES = [60, 120, 121, 123, 126, 132, 138, 144, 150, 151, 156, 165, 180, 186, 240, 330, 359, 360, 375, 390, 420, 479];
// frame → the twelve [dHit dAge dKick dMass dArtic dSpark dSway dLift dBrace dImpact dStill dPeriod], frozen
const BUS_TRACE_TABLE = {
  60: [0, 4, 0, 0.249439, 0.426736, 0.2, 0.679699, 0.009629, 0, 8, 1, 0.5],
  120: [1.25, 0, 0.039395, 0.311854, 0.576306, 0.6, -0.013622, 0.05033, 0, 8, 1, 0.5],
  121: [1.118549, 0.033333, 0.248494, 0.359803, 0.615207, 0.525104, 0.013606, 0.052112, 0, 8, 1, 0.5],
  123: [0.895664, 0.1, 0.908857, 0.423071, 0.628411, 0.402192, 0.071673, 0.055328, 0, 8, 1, 0.5],
  126: [0.641771, 0.2, 1.12502, 0.462102, 0.616399, 0.269597, 0.164794, 0.059493, 0, 8, 1, 0.5],
  132: [0.329496, 0.4, 0.136041, 0.461248, 0.579877, 0.207326, 0.359302, 0.066524, 0, 8, 1, 0.5],
  138: [0.169169, 0.6, -0.2591, 0.448485, 0.644652, 0.402192, 0.555776, 0.073995, 0, 8, 1, 0.5],
  144: [0.086854, 0.8, -0.038704, 0.432787, 0.596599, 0.219915, 0.714316, 0.08077, 0, 8, 1, 0.5],
  150: [0.89875, 0, 0.073658, 0.416779, 0.657115, 0.6, 0.816825, 0.088261, 0, 8, 1, 0.5],
  151: [0.804237, 0.033333, 0.144999, 0.414167, 0.712163, 0.525104, 0.829903, 0.090346, 0, 8, 1, 0.5],
  156: [0.461434, 0.2, 0.415637, 0.40151, 0.700254, 0.269597, 0.882552, 0.0988, 0, 8, 1, 0.5],
  165: [0.169752, 0.5, -0.079297, 0.380726, 0.614138, 0.6, 0.904613, 0.110277, 0, 8, 1, 0.5],
  180: [1, 0, 0.053675, 0.405618, 0.558786, 0.6, 0.616939, 0.129288, 0, 8, 1, 0.5],
  186: [0.513417, 0.2, 0.903139, 0.513561, 0.566781, 0.269597, 0.420966, 0.14202, 0, 8, 1, 0.5],
  240: [1.25, 0, 0.061391, 0.423858, 0.619502, 0.6, -0.221129, 0.230601, 0, 8, 1, 0.5],
  330: [0.89875, 0, 0.061996, 0.457551, 0.655965, 0.6, -0.597712, 0.383021, 0, 8, 1, 0.5],
  359: [0.03583, 0.966667, 0.022251, 0.378769, 0.501607, 0.203761, -0.507319, 0.416827, 0, 8, 1, 0.5],
  360: [0.032062, 1, 0.021996, 0.372508, 0.474256, 0.178327, -0.480075, 0.412609, 0, 8, 0.933333, 0.5],
  375: [0.006056, 1.5, -0.003348, 0.29011, 0.247321, 0.024134, -0.102656, 0.303542, 0, 8, 0, 0.5],
  390: [0.001144, 2, 0.00024, 0.225938, 0.186568, 0.003266, 0.05164, 0.21204, 0, 8, 0, 0.5],
  420: [0.000041, 3, -0.000014, 0.137038, 0.123888, 0.00006, 0.137053, 0.140393, 0, 8, 0, 0.5],
  479: [0, 4, 0, 0.051261, 0.153277, 0, 0.114833, 0.108203, 0, 8, 0, 0.5],
};

test('dance bus: the frozen trace — kick on 1 and 3, snare on 2 and 4, hats on the eighths, then a silent bar', async () => {
  const st = S.makeDanceBusState();
  const frames = [], drive = [];
  for (let i = 0; i < BUS_TRACE_FRAMES; i++){
    const inp = busTraceDrive(i);
    const { bus, state } = S.danceBusStep(st, inp, BUS_DT);
    for (let k = 0; k < 12; k++) assert.ok(isFinite(bus[k]), 'frame ' + i + ' slot ' + k + ' finite');
    frames.push(Array.from(bus)); drive.push(inp);
    if (i === 480 - 1) assert.ok(state.bus === bus, 'one Float32Array, reused');
  }
  // the full trace, for the Swift port
  if (process.env.DANCE_TRACE_OUT){
    const { writeFileSync } = await import('fs');
    const r6 = v => Math.round(v * 1e6) / 1e6;
    writeFileSync(process.env.DANCE_TRACE_OUT, JSON.stringify({
      about: 'the dance bus stepped on a fixed synthetic drive: 120 BPM, 60 Hz, one bar of count-in, eight beats of groove (kick 1 & 3, snare 2 & 4, hats on the eighths), four beats of silence; no score. Produced by tests/player.test.mjs from docs/index.html\'s danceBusStep. A port steps `drive` with dt = 1/60 from makeDanceBusState() and must reproduce `bus` to 2e-4.',
      fps: BUS_FPS, frames: BUS_TRACE_FRAMES, names: S.DANCE_BUS.NAMES, constants: S.DANCE_BUS,
      inputs: Object.keys(drive[0]),
      drive: drive.map(d => Object.keys(d).map(k => typeof d[k] === 'number' ? r6(d[k]) : d[k])),
      bus: frames.map(r => r.map(r6)),
      samples: Object.fromEntries(BUS_TRACE_SAMPLES.map(f => [f, frames[f].map(r6)])),
    }, null, 0));
  }
  // the table
  for (const f of BUS_TRACE_SAMPLES){
    const want = BUS_TRACE_TABLE[f];
    assert.ok(want, 'frame ' + f + ' is in the table');
    for (let k = 0; k < 12; k++)
      assert.ok(Math.abs(frames[f][k] - want[k]) <= 2e-4, 'frame ' + f + ' ' + S.DANCE_BUS.NAMES[k] + ': ' + frames[f][k].toFixed(5) + ' vs frozen ' + want[k]);
  }
  // and the shape the table is a sample of
  const col = k => frames.map(r => r[k]);
  const kick = col(2), age = col(1), hit = col(0), still = col(10), spark = col(5);
  for (let i = 0; i < 120; i++) assert.ok(kick[i] === 0 && hit[i] === 0 && age[i] === 4, 'count-in frame ' + i + ': no strike yet');
  assert.ok(still[119] > 0.999, 'the gate is open by the end of the count-in');
  for (const k0 of [120, 180, 240, 300]){                         // each kick: one rebound below rest before the snare's half beat is over
    let peak = 0, pk = k0, mins = 0;
    for (let i = k0 + 1; i < k0 + 30; i++){ if (kick[i] > peak){ peak = kick[i]; pk = i; } }
    for (let i = pk + 1; i < k0 + 30 - 1; i++) if (kick[i] < kick[i - 1] && kick[i] <= kick[i + 1] && kick[i] < 0) mins++;
    const down = (k0 / 30) % 4 === 0;                                   // the one: ×1.25; the three: ×1 — both × (0.5 + 0.5·ear)
    assert.ok(Math.abs(pk - (k0 + 6)) <= 1, 'kick at ' + k0 + ': the body arrives at +' + (pk - k0) + ' frames (0.2 beat)');
    assert.ok(down ? (peak > 1.0 && peak <= 1.25) : (peak > 0.85 && peak < 1.0), 'kick at ' + k0 + (down ? ' (downbeat)' : '') + ': the body peaks ' + peak.toFixed(3));
    assert.equal(mins, 1, 'kick at ' + k0 + ': one rebound');
    assert.equal(age[k0], 0, 'kick at ' + k0 + ' resets dAge');
    assert.ok(hit[k0] > 0.9 || hit[k0 + 1] > 0.9, 'kick at ' + k0 + ' lights dHit within a frame');
  }
  assert.ok(hit[120] > hit[180] - 1e-6 && hit[240] > hit[300] - 1e-6, 'downbeats land hotter than the three');
  for (const s0 of [150, 210, 270, 330]){                          // snares: a strike for the light and the age, half a strike for the body
    assert.equal(age[s0], 0, 'the snare at ' + s0 + ' resets dAge');
    const peak = Math.max(...kick.slice(s0, s0 + 12));
    assert.ok(peak > 0.1 && peak < 0.75, 'the snare moves the body at half weight: ' + peak.toFixed(3));
  }
  for (const h0 of [135, 165, 195, 225]){                          // bare hats: light only
    assert.ok(age[h0] > 0.4, 'the hat at ' + h0 + ' does not reset dAge (' + age[h0].toFixed(3) + ')');
    assert.ok(spark[h0] > 0.5, 'the hat at ' + h0 + ' sparks (' + spark[h0].toFixed(3) + ')');
  }
  assert.ok(still[359] > 0.999 && still[375] < 1e-6, 'the gate closes within half a beat of true silence');
  assert.ok(age[479] === 4 && hit[479] < 1e-4 && Math.abs(kick[479]) < 1e-3 && spark[479] < 1e-4, 'four beats of silence: the body is still (' + [age[479], hit[479], kick[479], spark[479]].map(v => v.toExponential(1)).join(' ') + ')');
  assert.ok(Math.abs(frames[479][6]) <= 0.3 && frames[479][7] <= 0.15 + 1e-6, 'at rest only the breath remains in sway and lift');
  for (let i = 0; i < BUS_TRACE_FRAMES; i++) assert.equal(frames[i][11], 0.5, 'dPeriod carries the grid');
});

test('dance bus: defined in silence — every slot finite on empty, zero, NaN and dt-0 inputs; at rest only the breath remains', () => {
  const st = S.makeDanceBusState();
  const zero = busInp({ ear: 0, playing: false, period: 0, haveGrid: false, beatIdx: -1 });
  for (let i = 0; i < 300; i++){
    const { bus } = S.danceBusStep(st, zero, i % 3 === 0 ? 0 : BUS_DT);     // a dt of exactly 0 every third frame
    for (let k = 0; k < 12; k++) assert.ok(Number.isFinite(bus[k]), 'frame ' + i + ' ' + S.DANCE_BUS.NAMES[k] + ' = ' + bus[k]);
  }
  const b = st.bus;
  assert.deepEqual(Array.from(b).map((v, k) => k === 7 ? +v.toFixed(3) : v), [0, 4, 0, 0, 0, 0, 0, 0.075, 0, 8, 0, 0], 'silence: the rest values, lift at (1 − still)·0.15·(0.5 + 0.5·breath)');
  const { bus: e } = S.danceBusStep(S.makeDanceBusState(), {}, NaN);
  for (let k = 0; k < 12; k++) assert.ok(Number.isFinite(e[k]), 'empty inputs and a NaN dt: ' + S.DANCE_BUS.NAMES[k] + ' = ' + e[k]);
  const { bus: n } = S.danceBusStep(S.makeDanceBusState(), { bass: NaN, mid: Infinity, period: Infinity, here: { bass: NaN }, soon: { punch: Infinity },
    pos: 3, ear: -5, beatIdx: 0, breath: NaN, structure: NaN, barPhase: NaN, rb: NaN, punch: Infinity, haveGrid: true }, 0);
  for (let k = 0; k < 12; k++) assert.ok(Number.isFinite(n[k]), 'NaN everywhere, dt 0: ' + S.DANCE_BUS.NAMES[k] + ' = ' + n[k]);
  assert.equal(n[11], 0.5, 'a non-finite period reads as 120 BPM (P 0.5) once the grid is claimed');
  // the rails hold under a 100 ms frame gap, an absurd strike and a hostile period
  const r = S.makeDanceBusState();
  for (let i = 0; i < 60; i++){
    const { bus } = S.danceBusStep(r, busInp({ rb: 9, punch: 9, bass: 1, mid: 1, treble: 1, energy: 1, period: i % 2 ? 1e-9 : 1e9, beatIdx: 0 }), 0.1);
    for (let k = 0; k < 12; k++) assert.ok(bus[k] >= S.DANCE_BUS.LO[k] - 1e-6 && bus[k] <= S.DANCE_BUS.HI[k] + 1e-6, 'frame ' + i + ' ' + S.DANCE_BUS.NAMES[k] + ' inside its rail: ' + bus[k]);
  }
});

test('dance bus: the stage wire — twelve floats clamped to their rails, rest for a missing or NaN slot, nothing for a short packet', () => {
  const bus = new Float32Array(12);
  assert.equal(S.danceBusApply(bus, [1, 2, 3]), false, 'a short packet is refused');
  assert.equal(S.danceBusApply(bus, null), false, 'no packet is refused');
  assert.ok(bus.every(v => v === 0), 'and nothing was written');
  assert.equal(S.danceBusApply(bus, [9, -1, -9, 2, 'x', NaN, -5, 0.5, 1.5, 99, 0.7, 0.4]), true, 'twelve values are taken');
  assert.deepEqual(Array.from(bus).map(v => +v.toFixed(4)), [1.5, 0, -0.35, 1, 0, 0, -1, 0.5, 1, 8, 0.7, 0.4],
    'every slot on its rail (DANCE_BUS.LO/HI); a non-numeric or NaN slot reads rest');
  const b2 = new Float32Array(12);
  S.danceBusApply(b2, [0, NaN, 0, 0, 0, 0, 0, 0, 0, NaN, 0, 0]);
  assert.ok(b2[1] === 4 && b2[9] === 8, 'a NaN dAge rests at 4 and a NaN dImpact at 8 — never a fresh strike or a landing');
  assert.deepEqual(S.DANCE_BUS.REST, [0, 4, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0], 'the rest bus');
  S.DANCE_BUS.NAMES.forEach((nm, k) => assert.ok(S.DANCE_BUS.LO[k] <= S.DANCE_BUS.REST[k] && S.DANCE_BUS.REST[k] <= S.DANCE_BUS.HI[k], nm + ': rest inside its rail'));
  // the booth's packet survives its four-decimal rounding inside the rails
  const st = S.makeDanceBusState();
  for (let i = 0; i < 130; i++) S.danceBusStep(st, busTraceDrive(i), BUS_DT);
  const wire = Array.from(st.bus, x => Math.round(x * 1e4) / 1e4), got = new Float32Array(12);
  assert.equal(S.danceBusApply(got, wire), true);
  for (let k = 0; k < 12; k++) assert.ok(Math.abs(got[k] - st.bus[k]) <= 5e-5 + 1e-7, S.DANCE_BUS.NAMES[k] + ' through the wire: ' + got[k] + ' vs ' + st.bus[k]);
});

test('dance bus: the score path — a strike is read once per env step from the digits, never smeared over the interpolated frames', () => {
  // a 12 Hz env: kick (bass 3→8, punch 0→9) at digit 6, hat (treble 1→4) at 9, snare (mid 2→7, punch 0→6) at 12
  const env = { hz: 12, b: '333333876654333333', m: '222222222222722222', t: '111111111411111111', o: '000000900000600000' };
  const mem = { step: -1, env: null }, out = {}, seen = [];
  for (let f = 0; f < 90; f++){                               // 60 fps over 1.5 s = 18 steps
    const sc = S.envSample(env, f / 60);
    S.danceScoreRises(env, sc.step, mem, out);
    if (out.rb || out.rm || out.rt || out.punch) seen.push({ f, step: sc.step, rb: out.rb, rm: out.rm, rt: out.rt, punch: out.punch });
  }
  assert.equal(seen.length, 3, 'exactly three strike frames in 90: ' + JSON.stringify(seen));
  assert.ok(seen[0].step === 6 && Math.abs(seen[0].rb - 5 / 9) < 1e-9 && seen[0].punch === 1 && seen[0].rm === 0 && seen[0].rt === 0, 'the kick: bass +5/9 and punch 1 on the frame digit 6 begins');
  assert.ok(seen[1].step === 9 && Math.abs(seen[1].rt - 3 / 9) < 1e-9 && seen[1].punch === 0 && seen[1].rb === 0, 'the hat: treble +3/9, no punch');
  assert.ok(seen[2].step === 12 && Math.abs(seen[2].rm - 5 / 9) < 1e-9 && Math.abs(seen[2].punch - 6 / 9) < 1e-9, 'the snare: mid +5/9, punch 6/9');
  // a 48 Hz env under a 24 fps frame spans two steps: a one-step punch is still caught, once
  const env48 = { hz: 48, b: '3333333383333333', m: '2222222222222222', t: '1111111111111111', o: '0000000090000000' };
  const m48 = { step: -1, env: null }, got = [];
  for (let f = 0; f < 8; f++){ const sc = S.envSample(env48, f / 24); S.danceScoreRises(env48, sc.step, m48, out); if (out.punch) got.push({ f, step: sc.step, punch: out.punch, rb: out.rb }); }
  assert.ok(got.length === 1 && got[0].punch === 1 && Math.abs(got[0].rb - 5 / 9) < 1e-9, 'two steps per frame: the punch at digit 8 lands on one frame: ' + JSON.stringify(got));
  // a seek (a jump of more than 8 steps), a step backwards and a new env re-anchor without a rise
  const mS = { step: -1, env: null };
  S.danceScoreRises(env, 2, mS, out); S.danceScoreRises(env, 14, mS, out);
  assert.ok(out.rb === 0 && out.punch === 0 && mS.step === 14, 'a 12-step jump re-anchors silently');
  S.danceScoreRises(env, 13, mS, out);
  assert.ok(out.rb === 0 && out.rm === 0 && mS.step === 13, 'a step backwards re-anchors silently');
  S.danceScoreRises(env48, 14, mS, out);
  assert.ok(out.rb === 0 && out.punch === 0 && mS.env === env48, 'a new env (track change) re-anchors');
  S.danceScoreRises(null, 3, mS, out);
  assert.ok(out.rb === 0 && out.punch === 0 && mS.step === -1, 'no env: nothing, and the memory is dropped');
  // fed through the stepper with the analyser's own 18 ms bass follower: a downbeat kick lights dHit on the punch
  // frame and the body peaks ~1.16 (1.25 × (0.5 + 0.5·ear)) four to seven frames later — the frozen trace's numbers
  const st = S.makeDanceBusState(), m2 = { step: -1, env: null }, inp = {};
  const kickEnv = { hz: 12, b: '3338766543333333333333333', m: '2222222222222222222222222', t: '1111111111111111111111111', o: '0009000000000000000000000' };
  let fb = 0.3, peak = 0, peakF = -1, hitAt = -1;
  for (let f = 0; f < 60; f++){
    const sc = S.envSample(kickEnv, f / 60);
    S.danceScoreRises(kickEnv, sc.step, m2, inp);
    fb = S.envFollow(fb, sc.bass, BUS_DT, 0.018, 0.11);
    Object.assign(inp, busInp({ bass: fb, mid: 0.22, treble: 0.11, energy: 0.4, beatIdx: 0, barPhase: (f / 120) % 1, rb: inp.rb, rm: inp.rm, rt: inp.rt, punch: inp.punch }));
    const { bus } = S.danceBusStep(st, inp, BUS_DT);
    if (bus[2] > peak){ peak = bus[2]; peakF = f; }
    if (hitAt < 0 && bus[0] > 0.5) hitAt = f;
  }
  assert.equal(hitAt, 15, 'dHit lights on the frame the punch digit begins (frame 15)');
  assert.ok(peak > 1.1 && peak < 1.2 && peakF - 15 >= 4 && peakF - 15 <= 7, 'dKick peaks ' + peak.toFixed(3) + ' at +' + (peakF - 15) + ' frames');
});

// ---- TUNE 1: the bus hears the chart (I1) and the stem light owns the landing (I2); v2 off is byte-identical ----

test('stem light: hitVoices — the chart as the bus\'s voices: one edge per hit, on the frame its audible instant passes, never on the frames between; nothing across a jump, a pause or a seek back', () => {
  const chart = { k: [1.0, 2.0, 3.0], s: [1.5, 2.5], h: [1.0, 1.25, 1.5, 1.75, 2.0, 2.25] };
  const dt = 1 / 60;
  for (const fps of [60, 24]){
    const step = 1 / fps, kicks = [], snares = [], hats = [];
    let prev = NaN;
    for (let i = 0; i < 4 * fps; i++){
      const pos = i * step, v = S.hitVoices(chart, pos, prev);
      assert.ok([0, 1].includes(v.kick) && [0, 1].includes(v.snare) && [0, 1].includes(v.hat), 'an edge is 0 or 1');
      if (v.kick) kicks.push(pos); if (v.snare) snares.push(pos); if (v.hat) hats.push(pos);
      prev = pos;
    }
    assert.equal(kicks.length, chart.k.length, fps + ' fps: one kick edge per charted kick (' + kicks.length + ')');
    assert.equal(snares.length, chart.s.length, fps + ' fps: one snare edge per charted snare');
    assert.equal(hats.length, chart.h.length, fps + ' fps: one hat edge per charted hat');
    // each edge sits on the frame whose span (prev, pos] holds the hit — the audible instant, not a neighbour
    for (const [arr, got] of [[chart.k, kicks], [chart.s, snares], [chart.h, hats]])
      for (const h of arr) assert.ok(got.some(p => p - h >= -1e-9 && p - h < step), fps + ' fps: the hit at ' + h + ' edges on its own frame');
  }
  // two hits of one voice inside one frame's span edge ONCE (an edge, not a count)
  const v2 = S.hitVoices({ k: [1.001, 1.009], s: [], h: [] }, 1.0167, 1.0);
  assert.equal(v2.kick, 1);
  // nothing: no chart, a dead clock, no previous read (the frame after a jump), a pause, a seek backwards
  for (const [c, pos, prev] of [[null, 1.0, 0.98], [chart, NaN, 0.98], [chart, 1.0, NaN], [chart, 1.0, 1.0], [chart, 0.98, 1.0]]){
    const v = S.hitVoices(c, pos, prev);
    assert.ok(v.kick === 0 && v.snare === 0 && v.hat === 0, 'nothing for ' + JSON.stringify([!!c, pos, prev]));
  }
  // the out object is reused and cleared
  const o = { kick: 1, snare: 1, hat: 1 };
  assert.ok(S.hitVoices(chart, 0.5, 0.4, o) === o && o.kick === 0 && o.snare === 0 && o.hat === 0, 'cleared in place');
  // the feed: v2 off → nothing, whatever is on offer; v2 on → the edges, authority, the coil, the landing; a jump strikes nothing
  const inp = {};
  let hp = S.danceStemFeed(inp, { v2: false, playing: true, heard: 1.0, heardPrev: 0.99, dt, chart, conf: 1, coil: 0.9, landed: true });
  assert.ok(inp.chartVoices === null && inp.stemCoil === 0 && inp.stemLanded === false && inp.stemAuthority === false && hp === 1.0, 'v2 off: the four at their defaults, the clock still tracked');
  hp = S.danceStemFeed(inp, { v2: true, playing: true, heard: 1.0, heardPrev: 0.99, dt, chart, conf: 0.5, coil: 0.9, landed: true, voices: o });
  assert.ok(inp.chartVoices === o && o.kick === 1 && o.hat === 1 && o.snare === 0 && inp.stemAuthority && inp.stemCoil === 0.9 && inp.stemLanded === true, 'v2 on: the kick and hat at 1.0 edge, authority at conf 0.5, the coil and the landing through');
  S.danceStemFeed(inp, { v2: true, playing: true, heard: 1.0, heardPrev: 0.99, dt, chart, conf: 0.49, coil: 0.9, landed: true, voices: o });
  assert.ok(!inp.stemAuthority && inp.stemCoil === 0 && !inp.stemLanded && inp.chartVoices === o, 'under authority nothing but the chart');
  S.danceStemFeed(inp, { v2: true, playing: true, heard: 5.0, heardPrev: 0.99, dt, chart, conf: 1, coil: 0, landed: false, voices: o });
  assert.ok(o.kick === 0 && o.snare === 0 && o.hat === 0, 'a 4 s jump of the clock strikes nothing');
  assert.ok(Number.isNaN(S.danceStemFeed(inp, { v2: true, playing: false, heard: 2.0, heardPrev: 1.99, dt, chart, conf: 1 })) && inp.chartVoices === null, 'a paused deck reads nothing and drops the clock');
});

test('dance v2: the bus hears the chart — the drummer\'s hits are the voices, struck once each at the audible instant whatever the bands say; without a chart the band-rise classifier stays', () => {
  const P = 0.5;
  const eighths = []; for (let t = 1.0; t < 3.9; t += 0.25) eighths.push(+t.toFixed(3));
  const chart = { k: [1.0, 2.0, 3.0], s: [1.5, 2.5, 3.5], h: eighths };
  // the bands: a flat quiet pad — no rises, no punch, the bass sitting ON its own floor (the classifier's gate reads 0)
  const run = (withChart, rises) => {
    const st = S.makeDanceBusState(), vo = { kick: 0, snare: 0, hat: 0 }, out = [];
    for (let i = 0; i < 240; i++){
      const pos = i * BUS_DT;
      const voices = withChart ? S.hitVoices(chart, pos, i ? (i - 1) * BUS_DT : NaN, vo) : null;
      const onK = rises && chart.k.some(h => pos - h >= -1e-9 && pos - h < BUS_DT);
      const { bus, state } = S.danceBusStep(st, busInp({
        bass: onK ? 0.8 : 0.3, mid: 0.2, treble: 0.1, energy: 0.3, beatIdx: Math.floor(pos / P) % 4, barPhase: (pos / (4 * P)) % 1,
        rb: onK ? 0.8 : 0, punch: onK ? 0.9 : 0, chartVoices: voices,
      }), BUS_DT);
      out.push({ pos, bus: Array.from(bus), kick: state.kick, snare: state.snare, hat: state.hat, gate: state.gate });
    }
    return out;
  };
  const on = run(true, false), off = run(false, false);
  // without a chart the pad is weight, not a strike
  assert.ok(off.every(f => f.kick === 0 && f.snare === 0 && f.hat === 0 && f.bus[0] === 0), 'no chart, no rises: no voice, no light');
  assert.ok(off[239].bus[1] === 4 && Math.abs(off[239].bus[2]) < 1e-6, 'no chart: dAge at four, the body at rest');
  // with the chart: each kick is one frame of voice, on the frame its instant passes
  const kickFrames = on.filter(f => f.kick > 0).map(f => f.pos);
  assert.equal(kickFrames.length, 3, 'three kick frames: ' + kickFrames.map(p => p.toFixed(3)).join(' '));
  for (const h of chart.k) assert.ok(kickFrames.some(p => p - h >= -1e-9 && p - h < BUS_DT), 'the kick at ' + h + ' is struck on its own frame');
  assert.ok(on.every(f => f.kick === 0 || f.kick === 1), 'a chart kick is 1 on its frame, nothing on the frames between');
  for (const h of chart.k){
    const i = on.findIndex(f => f.pos - h >= -1e-9 && f.pos - h < BUS_DT);
    assert.equal(on[i].bus[1], 0, 'kick at ' + h + ': dAge 0 on the strike');
    assert.ok(on[i].bus[0] >= 1 || on[i + 1].bus[0] >= 1, 'kick at ' + h + ': dHit lights within a frame');
    assert.equal(on[i].gate, 1, 'kick at ' + h + ': the bass floor has no say (gate 1)');
    let peak = 0; for (let k = i + 1; k < i + 10; k++) peak = Math.max(peak, on[k].bus[2]);
    assert.ok(peak > 0.85, 'kick at ' + h + ': the body is struck (dKick peak ' + peak.toFixed(3) + ')');
    assert.ok(Math.abs(on[i].hat - 0.3) < 1e-9, 'kick at ' + h + ': the hat under it is treble-class (×0.3)');
  }
  for (const h of chart.s){
    const i = on.findIndex(f => f.pos - h >= -1e-9 && f.pos - h < BUS_DT);
    assert.ok(on[i].snare === 1 && on[i].bus[1] === 0 && on[i].bus[0] >= 0.85, 'snare at ' + h + ': a strike for the light and the age');
    let peak = 0; for (let k = i + 1; k < i + 10; k++) peak = Math.max(peak, on[k].bus[2]);
    assert.ok(peak > 0.3 && peak < 0.7, 'snare at ' + h + ': half a strike for the body (' + peak.toFixed(3) + ')');
  }
  // a bare hat (1.25, 1.75 …): light only — the age runs on, the spark flicks
  const bare = on.find(f => Math.abs(f.pos - 1.25) < BUS_DT / 2);
  assert.ok(bare.hat === 1 && bare.kick === 0 && bare.bus[1] > 0.4 && bare.bus[5] >= 0.8, 'a bare hat lights dSpark and never resets dAge');
  // the chart WINS over the band classifier on the same frame set: rises on frames with no chart hit strike nothing
  const mixed = run(true, true);
  assert.deepEqual(mixed.map(f => f.kick), on.map(f => f.kick), 'with a chart the rises have no say in the voices');
  const risesOnly = run(false, true);
  assert.ok(risesOnly.some(f => f.kick > 0), 'without a chart the same rises would have struck (the test bites)');
});

test('dance v2: one landing — the stem light\'s kit return lands the bus once with the env latch held disarmed while the stems have authority; without authority the latch lands as before, from rest', () => {
  const P = 0.5, la = S.danceLookahead(P);
  // the drive of the landing test: a silent bar, the drop at 2.0 s (read 80 ms ahead); the stem light would see the drums at the same instant
  const env = t => ({ bass: t < 2 ? 0.05 : 0.9, punch: (t >= 2 && t < 2.1) ? 0.9 : 0 });
  const landFrame = (() => { for (let i = 0; ; i++) if (i * BUS_DT + 0.08 >= 2) return i; })();
  const run = (stem) => {
    const st = S.makeDanceBusState(), rows = [];
    for (let i = 0; i < 240; i++){
      const pos = i * BUS_DT, quiet = pos + 0.08 < 2;
      const inp = busInp({
        bass: quiet ? 0.05 : 0.9, mid: quiet ? 0.05 : 0.5, treble: 0.05, energy: quiet ? 0.04 : 0.8,
        rb: (!quiet && pos + 0.08 < 2.02) ? 0.8 : 0, punch: (!quiet && pos + 0.08 < 2.02) ? 0.9 : 0,
        ear: quiet ? 0.3 : 0.9, beatIdx: Math.floor(pos / P) % 4,
        pos, here: env(pos + 0.08), soon: env(pos + la),
      });
      if (stem) stem(inp, i, pos);
      const { bus, state } = S.danceBusStep(st, inp, BUS_DT);
      rows.push({ i, pos, bus: Array.from(bus), landed: state.landed, armed: state.armed });
    }
    return rows;
  };
  const coilOf = pos => Math.max(0, Math.min(1, (pos - 1.0) / 0.5));       // the stem light's inhale: up from 1.0 s, full by 1.5 s
  // A. authority throughout, the kit returns on the drop frame: ONE landing, the bus's own, on that frame
  const A = run((inp, i, pos) => { inp.stemAuthority = true; inp.stemCoil = i < landFrame ? coilOf(pos) : 0; inp.stemLanded = i === landFrame; });
  const landA = A.filter(r => r.landed);
  assert.equal(landA.length, 1, 'one landing');
  assert.equal(landA[0].i, landFrame, 'on the frame the kit returned');
  assert.ok(A.every(r => !r.armed), 'the env latch never armed while the stems had authority');
  const L = A[landFrame];
  assert.ok(L.bus[9] === 0 && L.bus[1] === 0 && L.bus[8] === 0, 'dImpact 0, dAge 0, dBrace 0 on the landing frame');
  assert.ok(L.bus[0] >= 1.25 - 1e-6 || A[landFrame + 1].bus[0] >= 1, 'the landing lights dHit');
  let kickPeak = 0; for (let k = landFrame + 1; k <= landFrame + 8; k++) kickPeak = Math.max(kickPeak, A[k].bus[2]);
  assert.ok(kickPeak > 1.0, 'the landing strikes the body at 1.25: dKick peaked ' + kickPeak.toFixed(3));
  const braceBefore = Math.max(...A.filter(r => r.pos > 1.5 && r.pos < 1.9).map(r => r.bus[8]));
  assert.ok(braceBefore > 0.9, 'the coil fed dBrace through the silent bar (max): ' + braceBefore.toFixed(3));
  assert.ok(A.slice(landFrame + 1).every(r => r.bus[9] > 0), 'dImpact counts up from the one landing and never resets again');
  // B. the same drive without the stems: the latch lands, once, on the same frame (test A of the landing test)
  const B = run(null);
  const landB = B.filter(r => r.landed);
  assert.equal(landB.length, 1, 'without authority: one landing through the latch');
  assert.equal(landB[0].i, landFrame, 'the latch lands on the first loud frame — the same frame');
  assert.ok(B.some(r => r.armed), 'the latch did arm (the test bites)');
  assert.ok(A[90].bus[8] > 0.99 && B[90].bus[8] < 0.9, 'at 1.5 s the coil (1.0) lifts dBrace by max where the follower alone read ' + B[90].bus[8].toFixed(3));
  // C. authority held but the kit never returns: nothing lands however loud the drop is; the latch stays disarmed
  const C = run((inp) => { inp.stemAuthority = true; });
  assert.ok(C.every(r => !r.landed && !r.armed), 'no stem landing, no latch: no landing at all');
  assert.ok(C.every(r => r.bus[9] === 8), 'dImpact stays at rest');
  // D. authority lapses at 1.0 s: the latch runs again FROM REST — its promise clock restarts, so it arms half a beat
  //    later and lands at landAt − P/4 once the drop is loud: later than B's frame, never earlier, exactly once
  const D = run((inp, i, pos) => { inp.stemAuthority = pos < 1.0; });
  const landD = D.filter(r => r.landed);
  assert.equal(landD.length, 1, 'authority lapsed: the latch lands once');
  const expectD = 1.0 + la - P / 4;                                         // comingSince restarts at 1.0 s → landAt 2.2 → arrival window opens at 2.075
  assert.ok(landD[0].pos >= expectD - 1e-9 && landD[0].pos < expectD + 2 * BUS_DT, 'from rest: lands at ' + landD[0].pos.toFixed(4) + ' (window opens ' + expectD.toFixed(3) + ')');
  assert.ok(landD[0].i > landFrame, 'later than the uninterrupted latch, never a second landing');
  // E. the TV twin carries the same four inputs and the same two laws
  const swift = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Dance.swift'), 'utf8');
  for (const s of ['var chartVoices: DanceVoices? = nil', 'var stemCoil: Float = 0', 'var stemLanded: Bool = false', 'var stemAuthority: Bool = false',
                   'if coil > brace { brace = coil }', 'landedNow = inp.stemLanded', 'static func hitVoices(_ chart: Stems.HitChart?, pos: Double, prev: Double) -> DanceVoices'])
    assert.ok(swift.includes(s), 'Dance.swift carries: ' + s);
});

/* THE TABULATED COMPARE — the twelve with the flag off, before and after the
   tune-1 edits. The drive below is the engine's own feed over 7 s at 60 Hz:
   a count-in, a four-on-the-floor groove read through the analyser's
   followers with the score's instants and beat means (the latch's path), a
   silent bar the score promises a drop after, the drop (the latch lands on
   frame 296), two bars of the drop. BUS_CMP_TABLE was printed from
   danceBusStep BEFORE the edits (the same drive, this file's fixtures); the
   test steps the drive bare and through danceStemFeed with v2 OFF and a
   chart, authority and a landing on offer, and both must reproduce it. */
const CMP_FRAMES = 420;
function busCompareDrive(){
  const P = 0.5, la = S.danceLookahead(P), hz = 48;
  const env = t => {
    if (t < 1.5 || (t >= 3.5 && t < 5.0)) return { bass: 0, mid: 0, treble: 0, punch: 0 };
    const d = (t - 1.5) % P, floor = t >= 5 ? 0.55 : 0.28;
    return { bass: Math.min(1, floor + 0.6 * Math.exp(-d / 0.1)), mid: t >= 5 ? 0.4 : 0.22, treble: t >= 5 ? 0.2 : 0.12, punch: d < 1 / hz ? 0.9 : 0 };
  };
  const level = t => { let s = 0; for (let k = 0; k < 5; k++){ const e = env(t - P / 2 + (k + 0.5) * P / 5); s += e.bass + 0.8 * e.punch; } return s / 5; };
  const f = { bass: 0, mid: 0, treble: 0 }, out = [];
  let prev = env(0.08);
  for (let i = 0; i < CMP_FRAMES; i++){
    const t = i * BUS_DT, pos = t + 0.08;
    const here = env(pos), soon = env(pos + la);
    f.bass = S.envFollow(f.bass, here.bass, BUS_DT, 0.018, 0.11);
    f.mid = S.envFollow(f.mid, here.mid, BUS_DT, 0.018, 0.11);
    f.treble = S.envFollow(f.treble, here.treble, BUS_DT, 0.016, 0.13);
    const on = here.punch > 0 && prev.punch === 0;
    out.push(busInp({
      bass: f.bass, mid: f.mid, treble: f.treble, energy: Math.min(1, (f.bass * 1.25 + f.mid + f.treble * 0.8) / 2),
      centroid: 0.4 + 0.05 * Math.sin(t * 2.1),
      rb: on ? Math.max(0, here.bass - prev.bass) : 0, rm: on ? 0.1 : 0, rt: on ? 0.05 : 0, punch: on ? 0.9 : 0,
      beatIdx: Math.floor(pos / P) % 4, barPhase: (pos / (4 * P)) % 1, phrasePhase: (pos / (32 * P)) % 1,
      ear: here.bass > 0.1 ? 0.9 : 0.3, breath: Math.sin(t * 0.88) * 0.5,
      pos, here, soon, hereW: level(pos), soonW: level(pos + la),
    }));
    prev = here;
  }
  return out;
}
// frame → the twelve [dHit dAge dKick dMass dArtic dSpark dSway dLift dBrace dImpact dStill dPeriod], printed before the tune-1 edits
const BUS_CMP_TABLE = {
  30: [0, 4, 0, 0, 0.108499, 0, 0.03964, 0.061526, 0.104802, 8, 0, 0.5],
  90: [0.64118, 0.133333, 0.89646, 0.240424, 0.224865, 0.119344, -0.010222, 0.094626, 0.125363, 8, 1, 0.5],
  91: [0.573753, 0.166667, 0.950036, 0.27559, 0.245916, 0.119768, -0.042699, 0.092937, 0.121928, 8, 1, 0.5],
  93: [0.459426, 0.233333, 0.838271, 0.330747, 0.27743, 0.119971, -0.097431, 0.089871, 0.115339, 8, 1, 0.5],
  96: [0.329193, 0.333333, 0.402224, 0.381396, 0.308127, 0.119999, -0.154773, 0.085951, 0.106117, 8, 1, 0.5],
  120: [0.801475, 0.133333, 1.144923, 0.496835, 0.384698, 0.12, 0.139944, 0.078345, 0.054482, 8, 1, 0.5],
  150: [0.64118, 0.133333, 0.92645, 0.55261, 0.35052, 0.12, 0.873277, 0.102299, 0.023678, 8, 1, 0.5],
  180: [0.64118, 0.133333, 0.920231, 0.568468, 0.284137, 0.12, 0.462017, 0.138994, 0.01029, 8, 1, 0.5],
  210: [0.022873, 1.133333, 0.023878, 0.494218, 0.349413, 0.06321, -0.376306, 0.175318, 0.004472, 8, 0.888889, 0.5],
  240: [0.000816, 2.133333, -0.000466, 0.309548, 0.157842, 0.00135, -0.113622, 0.112869, 0.525065, 8, 0, 0.5],
  270: [0.000029, 3.133333, -0.00002, 0.187854, 0.066062, 0.000029, -0.096009, 0.069767, 0.886181, 8, 0, 0.5],
  280: [0.00001, 3.466667, 0.000007, 0.159016, 0.106127, 0.000008, -0.107587, 0.061517, 0.929302, 8, 0, 0.5],
  290: [0.000003, 3.8, -0.000002, 0.134605, 0.138213, 0.000002, -0.119495, 0.055032, 0.927811, 8, 0, 0.5],
  294: [0.000002, 3.933333, -0.000001, 0.125924, 0.146656, 0.000001, -0.123953, 0.052845, 0.830242, 8, 0, 0.5],
  295: [0.000002, 3.966667, -0.000001, 0.123842, 0.148327, 0.000001, -0.125026, 0.052331, 0.807497, 8, 0, 0.5],
  296: [1.25, 0, 0.042589, 0.16952, 0.206663, 0.129427, -0.124269, 0.055601, 0, 0, 0.266667, 0.5],
  298: [1.000922, 0.066667, 0.649405, 0.29598, 0.33187, 0.191213, -0.126137, 0.077455, 0, 0.066667, 0.8, 0.5],
  300: [0.801475, 0.133333, 1.179552, 0.402493, 0.418356, 0.198906, -0.142046, 0.110681, 0, 0.133333, 1, 0.5],
  305: [0.459849, 0.3, 0.737316, 0.568391, 0.511575, 0.199994, -0.230863, 0.183978, 0, 0.3, 1, 0.5],
  312: [0.211267, 0.533333, -0.261316, 0.640038, 0.533104, 0.2, -0.41963, 0.264552, 0, 0.533333, 1, 0.5],
  330: [0.64118, 0.133333, 0.928498, 0.741774, 0.507673, 0.2, -0.829577, 0.398684, 0, 1.133333, 1, 0.5],
  360: [0.801475, 0.133333, 1.144337, 0.806914, 0.454655, 0.2, -0.385095, 0.514138, 0, 2.133333, 1, 0.5],
  419: [0.716531, 0.1, 0.778817, 0.822253, 0.512438, 0.2, 0.065652, 0.626414, 0, 4.1, 1, 0.5],
};

test('dance v2: with the flag off the twelve are unchanged — the pre-edit table, bare and through the stem feed with v2 off (a tabulated compare)', () => {
  const drive = busCompareDrive();
  const stepAll = (mod) => {
    const st = S.makeDanceBusState(), frames = [], landed = [];
    for (let i = 0; i < CMP_FRAMES; i++){
      const inp = mod ? mod(Object.assign({}, drive[i]), i) : drive[i];
      const { bus, state } = S.danceBusStep(st, inp, BUS_DT);
      frames.push(Array.from(bus));
      if (state.landed) landed.push(i);
    }
    return { frames, landed };
  };
  const chart = { k: [1.5, 2.0, 2.5, 3.0, 5.0, 5.5, 6.0, 6.5], s: [1.75, 2.25, 5.25, 5.75], h: [1.5, 1.625, 1.75, 1.875, 2.0] };
  const vo = { kick: 0, snare: 0, hat: 0 };
  let prev = NaN;
  const offFeed = (v2) => (inp, i) => {
    prev = S.danceStemFeed(inp, { v2, playing: true, heard: i * BUS_DT, heardPrev: prev, dt: BUS_DT, chart, conf: 1, coil: i < 290 ? 0.9 : 0, landed: i === 290, voices: vo });
    if (!v2) assert.ok(inp.chartVoices === null && inp.stemCoil === 0 && inp.stemLanded === false && inp.stemAuthority === false, 'frame ' + i + ': v2 off, the four at their defaults');
    return inp;
  };
  const bare = stepAll(null);
  prev = NaN; const fed = stepAll(offFeed(false));
  for (const [name, run] of [['bare', bare], ['fed v2-off', fed]]){
    assert.deepEqual(run.landed, [296], name + ': the latch lands on frame 296 as before');
    for (const f of Object.keys(BUS_CMP_TABLE)){
      const want = BUS_CMP_TABLE[f];
      for (let k = 0; k < 12; k++)
        assert.ok(Math.abs(run.frames[f][k] - want[k]) <= 1e-6, name + ': frame ' + f + ' ' + S.DANCE_BUS.NAMES[k] + ': ' + run.frames[f][k].toFixed(6) + ' vs the pre-edit ' + want[k]);
    }
  }
  for (let i = 0; i < CMP_FRAMES; i++) assert.deepEqual(fed.frames[i], bare.frames[i], 'frame ' + i + ': the feed with v2 off changes no float');
  // and the same offer with v2 ON changes the story (the test bites): the stem light lands it on 290, the latch never does
  prev = NaN; const on = stepAll(offFeed(true));
  assert.deepEqual(on.landed, [290], 'v2 on: the kit\'s return is the landing, the latch is held');
  assert.ok(on.frames[100][1] === 0 || on.frames[90][1] === 0, 'v2 on: a charted kick resets dAge');
});

test('dance v2: the frame loop — the stem light steps before the dance engine, its side effects after; the kit\'s cut, the beat channel\'s chart blend, the meter, the haptics and the uBeatIdx hold are as they were', () => {
  const iStep = html.indexOf('stemLightStep(STEMS.state, {'), iUpd = html.indexOf('\n  DANCE.update(dt, t);');
  const iSide = html.indexOf('const busTook = DANCE.v2 && STEMS.state.conf >= 0.5;'), iChor = html.indexOf("if (typeof CHOREO !== 'undefined') CHOREO.update(dt);");
  assert.ok(iStep > 0 && iUpd > 0 && iSide > 0 && iChor > 0, 'all four anchors present');
  assert.ok(iStep < iUpd && iUpd < iSide && iSide < iChor, 'stem light → DANCE.update → the stem light\'s side effects → CHOREO');
  assert.equal((html.match(/stemLightStep\(STEMS\.state, \{/g) || []).length, 1, 'the stem light is stepped once a frame');
  assert.ok(html.includes('STEMS.out.landed && director.dwell >= STEM_CUT_DWELL'), 'the kit\'s-return cut reads the stem light as before');
  assert.ok(html.includes('hitBlend((DANCE.on ? Math.max(-0.25, f.beat * 0.95, DANCE.pulse) : f.beat) * so.beatGate,'), 'the beat channel\'s chart blend and kit gate are untouched');
  assert.ok(html.includes('this._heardPrev = danceStemFeed(inp, {') && html.includes('heard: STEMS.heard'), 'the bus reads the stems through danceStemFeed at the audible instant');
  assert.ok(html.includes('STEMS.hit = STEMS.chart && isFinite(STEMS.heard) ? hitPulse(STEMS.chart, STEMS.heard) : 0;'), 'hitPulse reads the same clock');
  assert.ok(html.includes("const holdGrid = v2grid && stillGate < 0.5 && U.uBeatIdx.value >= 0;") && html.includes("if (!holdGrid){ U.uBeatIdx.value = idx % 4; U.uBarPhase.value = CLOCK.barPhase; }"), 'the uBeatIdx hold, and the bar phase held with it (both resume when the gate lifts)');
  assert.ok(html.includes('if (beating){\n        METER.tick(idx % 4);\n        HAPTICS.pulse(idx % 4 === 0);'), 'the meter and the haptics key on the ear alone');
  assert.ok(html.includes('DANCE.rate = Math.min(1.9, Math.max(0.4, this._rate * still));') && html.includes("const still = DANCE.v2 ? Math.min(this.stillGate(), this._silAhead ? 0 : 1) : 1;"), 'the rubato reads stillness under v2, floored at 0.4');
  assert.ok(html.includes("&& !(DANCE.v2 && this.move.name === 'suspend' && DANCE.stillGate < 0.5)))"), 'a held breath that runs out in stillness is held');
  assert.ok(html.includes('if (this._busWire) this._busWire = false;\n    else this._stepBus('), 'the stage wire still stands the local stepper down');
});

// ---------------------------------------------------------------- tune 2: the still bar's shiver, the sky, the sawtooth

test('color v2: oklchToRgbFine — the gamut boundary is continuous in chroma (no 0.008 stair), inside the gamut the two mappers agree exactly, the output never leaves 0..1', () => {
  const lum = rgb => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  // the olive the harness's chord holds through the silent bar (swatch B, L 0.57 at 84°): its chroma drifts slowly
  // across the boundary as the chord cools — the old walk lands a whole 0.008 step every few frames
  const steps = (fn, L, h) => { let worst = 0, prev = null; for (let C = 0.30; C >= 0; C -= 0.0005){ const o = fn(L, C, h); if (prev) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(o[k] - prev[k]) * 255); prev = o; } return worst; };
  for (const [L, h] of [[0.57, 84], [0.55, 267], [0.6, 5], [0.45, 150]]){
    const old = steps(S.oklchToRgb, L, h), fine = steps(S.oklchToRgbFine, L, h);
    assert.ok(old >= 2, `the old walk stairs by at least 2/255 somewhere on the sweep (L ${L} h ${h}): ${old.toFixed(2)}`);
    // inside the gamut the mapper's own slope (the sRGB curve is steepest where a channel is near 0) is under 2.5/255 per 0.0005 of chroma — a continuous move, not a stair
    assert.ok(fine < 2.5 && fine < old / 5, `the fine mapper moves under 2.5/255 per 0.0005 of chroma everywhere, and at least 5× less than the old stair (L ${L} h ${h}): ${fine.toFixed(3)} (old ${old.toFixed(2)})`);
  }
  // inside the gamut: identical arrays
  for (const [L, C, h] of [[0.6, 0.05, 84], [0.5, 0.08, 267], [0.8, 0.03, 5], [0.3, 0.02, 150], [0.95, 0, 0], [0.22, 0, 0]])
    assert.deepEqual(S.oklchToRgbFine(L, C, h), S.oklchToRgb(L, C, h), `in gamut the two agree exactly (L ${L} C ${C} h ${h})`);
  // out of gamut: in 0..1, lightness still orders the result, and the fine colour sits within one old step of the old one
  for (let h = 0; h < 360; h += 15){
    const f = S.oklchToRgbFine(0.6, 0.4, h), o = S.oklchToRgb(0.6, 0.4, h);
    assert.ok(f.every(v => v >= 0 && v <= 1), 'in range at ' + h);
    // the fine colour sits ON the boundary, the old one up to 0.008 of chroma inside it: at least as saturated (the sRGB spread), and
    // where a channel sits near 0 that one old step is worth up to ~9 % of luminance — the stair's own size, not a tolerance to assert
    const sp = c => Math.max(...c) - Math.min(...c);
    assert.ok(sp(f) >= sp(o) - 1e-6, 'at least as saturated as the old step at ' + h + ': ' + sp(f).toFixed(4) + ' vs ' + sp(o).toFixed(4));
  }
  assert.ok(lum(S.oklchToRgbFine(0.5, 0.3, 84)) < lum(S.oklchToRgbFine(0.7, 0.3, 84)), 'lighter in, lighter out');
  assert.deepEqual(S.oklchToRgbFine(0.6, 0, 84), S.oklchToRgb(0.6, 0, 84), 'grey is grey');
});

test('safe v2: the governor\'s blend — a luminance held back arrives by crossfade: exactly the allowed luminance, never a channel past 1.0; where the gate does not bite the target passes; without the flag the old scale path, byte for byte', () => {
  const dt = 1 / 60, grey = [0.85, 0.85, 0.85], red = [0.95, 0.05, 0.3];
  const run = (blend) => {
    const st = S.makeSafeColorState(1), out = [];
    for (let i = 0; i < 30; i++) S.safeColorStep(st, [grey], dt, undefined, blend);
    for (let i = 0; i < 180; i++) out.push({ rgb: S.safeColorStep(st, [red], dt, undefined, blend)[0], allowed: st.l[0] });
    return out;
  };
  const old = run(false), v2 = run(true);
  assert.ok(old.some(o => o.rgb.some(v => v > 1)), 'the old path scales a falling luminance up past 1.0 (the clipping the blend removes)');
  const rate = 0.9 + (0.5 - 0.9) * ((0.95 - 0.3) / 0.95);     // the red rate for this target
  let prevL = 0.85;
  for (const o of v2){
    assert.ok(o.rgb.every(v => v >= 0 && v <= 1), 'the blend never leaves 0..1: ' + o.rgb.map(v => v.toFixed(3)));
    const L = S.relLuma(o.rgb);
    assert.ok(Math.abs(L - o.allowed) < 1e-9, 'its luminance IS the allowed one: ' + L.toFixed(6) + ' vs ' + o.allowed.toFixed(6));
    assert.ok(Math.abs(L - prevL) <= rate * dt + 1e-9, 'the rate holds frame to frame');
    prevL = L;
  }
  assert.deepEqual(v2[v2.length - 1].rgb.map(v => +v.toFixed(9)), red, 'it arrives at the target');
  assert.deepEqual(old.map(o => +o.allowed.toFixed(12)), v2.map(o => +o.allowed.toFixed(12)), 'the gate (state.l) walks the same path on both');
  // a slow target: the gate does not bite, the colour passes on both paths
  const stA = S.makeSafeColorState(1), stB = S.makeSafeColorState(1);
  for (let i = 0; i < 40; i++){
    const c = [0.5 + i * 0.002, 0.4, 0.3];
    const a = S.safeColorStep(stA, [c], dt)[0], b = S.safeColorStep(stB, [c], dt, undefined, true)[0];
    assert.deepEqual(a.map(v => +v.toFixed(12)), c.map(v => +v.toFixed(12)), 'old: passes');
    assert.strictEqual(b, c, 'blend: the target itself');
  }
  // the old signature is the old path
  const st4 = S.makeSafeColorState(1); S.safeColorStep(st4, [grey], dt); const k = S.safeColorStep(st4, [red], dt)[0];
  assert.ok(Math.abs(k[0] / red[0] - k[1] / red[1]) < 1e-9 && k[0] > 1, 'four arguments: the scale path');
  // black stays black
  const stZ = S.makeSafeColorState(1); S.safeColorStep(stZ, [grey], dt, undefined, true);
  assert.deepEqual(S.safeColorStep(stZ, [[0, 0, 0]], dt, undefined, true)[0], [0, 0, 0]);
});

test('flame v2: pyroStillGain — the sky dims out with the stillness over ~0.3 s and comes back the frame the music does; clamped; finite on junk', () => {
  assert.equal(S.pyroStillGain(1, 1, 1 / 60), 1, 'lit, and the music is on: lit');
  assert.ok(Math.abs(S.pyroStillGain(1, 0, 0.3) - Math.exp(-1)) < 1e-12, 'a stillness: e⁻¹ of the way after one time constant');
  assert.ok(Math.abs(S.pyroStillGain(1, 0, 1 / 60) - Math.exp(-1 / 18)) < 1e-12, 'one frame of dimming');
  assert.equal(S.pyroStillGain(0.1, 1, 1 / 60), 1, 'the music returns: lit on that frame');
  assert.equal(S.pyroStillGain(0.3, 0.5, 1 / 60), 0.5, 'half open: at once');
  let g = 1; for (let i = 0; i < 60; i++) g = S.pyroStillGain(g, 0, 1 / 60); assert.ok(g < 0.05, 'dark within a second: ' + g.toFixed(4));
  for (const bad of [[NaN, 0, 1], [1, NaN, 1], [1, 0, NaN], [2, -1, -5], ['x', {}, null]]){ const v = S.pyroStillGain(...bad); assert.ok(isFinite(v) && v >= 0 && v <= 1, 'junk: ' + v); }
});

test('dance v2: tune 2 wire — the swatches through the fine mapper and the blend under v2 only; FLAME\'s launches, billows, onset shell and tour × the stillness gate, its sky dimmed by pyroStillGain and cleared once dark; the bar phase held with the index', () => {
  assert.ok(html.includes("const v2c = typeof DANCE !== 'undefined' && DANCE.v2;") && html.includes('lit.slice(0, 3).map(c => (v2c ? oklchToRgbFine : oklchToRgb)(lClamp(c.l * mulL), Math.max(0, c.c * mulC), c.h)),\n      dt, SAFE.tuning(), v2c);'), 'COLOR: the fine mapper and the blend, under v2');
  // the fine mapper: its definition, and the waveform's three colour sites (the tilt LUT, the band palette, the stem palette) — the swatches reach it by reference, under v2
  assert.equal((html.match(/oklchToRgbFine\(/g) || []).length, 4, 'the fine mapper has the waveform\'s three callers besides its definition; the swatches reach it by reference');
  assert.ok(html.includes("const v2sky = typeof DANCE !== 'undefined' && DANCE.v2;") && html.includes('pyro.gain = v2sky ? pyroStillGain(pyro.gain, still, dt) : 1;'), 'FLAME: the sky\'s gain follows the gate under v2, 1 with the flag off');
  assert.ok(html.includes('const rate = pyroRate({ energy: f.energy, mood, calm }) * lean * still;') && html.includes('const shot = pyroFire(pyro.acc, dt, rate, !!f.onset && (!v2sky || still >= 0.5));'), 'the launches and the onset shell × the gate');
  assert.ok(html.includes('(PYRO_TUNING.smokeRate + f.energy * PYRO_TUNING.smokeGain) * lean * still;'), 'the billows × the gate');
  assert.ok(html.includes('if (v2sky && pyro.gain < 0.05) for (let i = 0; i < EV; i++) slots[i].t = -1;') && html.includes('evData[o + 3] = q(v2sky ? s.power * pyro.gain : s.power, 1);'), 'the sky dims by the gain and is cleared once dark');
  assert.ok(html.includes('&& !(DANCE.v2 && DANCE.stillGate < 0.5)){'), 'the tour holds its light through a stillness');
  assert.ok(html.includes('const pyro = { acc: 0, cold: 0, gain: 1 };'), 'the gain starts lit');
  assert.ok(html.includes("const still = v2sky && typeof DANCE.stillGate === 'number' && isFinite(DANCE.stillGate) ? DANCE.stillGate : 1;"), 'the gate read is 1 with the flag off');
});

test('dance v2: the flag is ON by default on both stages (flipped together), ?v2=0 still turns it off, and a stage screen takes it off the wire from its booth', () => {
  assert.equal((html.match(/\n  v2: true,\n/g) || []).length, 1, 'DANCE.v2 defaults to true (one such line)');
  assert.ok(!/\n  v2: false,\n/.test(html), 'no "v2: false" default left in the page');
  const swift = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Dance.swift'), 'utf8');
  assert.ok(swift.includes('static let v2Default = true'), 'DanceBus.v2Default is true with it (the TV twin)');
  assert.ok(html.includes("if (v2q != null) DANCE.v2 = !(v2q === '0' || v2q === 'false' || v2q === 'off' || v2q === 'no');"), '?v2=0 still turns it off');
  assert.ok(html.includes('r: DANCE.rate, v2: !!DANCE.v2 };'), 'the booth puts the flag on the stage wire');
  assert.ok(html.includes('if (p.dance.v2 != null) DANCE.v2 = !!p.dance.v2;'), 'and a screen takes it from the packet');
});

// ---------------------------------------------------------------- licensing

/* THE MATHS IS FREE; THE CODE IS NOT. The fractal rooms are built from
   published mathematics: the mandelbulb, the mandelbox, Knighty's sponge
   and kaleidoscopic IFS, Pickover's orbit traps. The best-known desktop
   renderer of those forms is GPLv3. The web player is MIT, and the tvOS app
   ships on the App Store, whose terms are widely held to be incompatible
   with GPLv3, so not one line of that program may land in either stage. The tokens below are its
   house identifiers (its own types, its aux/DE plumbing, its formula-
   function signature) plus its name. The name is the last alternative,
   assembled from halves so this file never spells it out. If this test
   fails, something was transcribed rather than derived: delete it and
   re-derive the formula from the published maths. Credits for the
   mathematics, and notices for the third-party code we do ship, are in
   THIRD-PARTY-NOTICES at the repository root. Each identifier is anchored
   at a word start, so our own names that merely contain one (isFractalClipped,
   modeFunctionType, Bordeaux.de) never trip it. */
const GPL_RENDERER_TOKENS = new RegExp([
  '\\bsExtendedAux', '\\bsFractalCl', '\\bREAL4\\b', '\\bCVector4', '\\baux(\\.|->)DE\\b',
  '\\bfractal->', '\\bcAbstractFractal', '\\bDEFunctionType', 'mandel' + 'bulber',
].join('|'), 'i');
test('licensing: no GPL fractal-renderer identifiers in the web player or the tvOS sources', async () => {
  const { readdirSync } = await import('fs');
  const files = ['docs/index.html'];
  const walk = dir => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })){
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel);
      else if (/\.(metal|swift)$/.test(e.name)) files.push(rel);
    }
  };
  walk('tvos');
  assert.ok(files.some(f => f.endsWith('.metal')) && files.some(f => f.endsWith('.swift')), 'the scan actually reached the tvOS Metal and Swift sources');
  const hits = [];
  for (const f of files){
    const lines = readFileSync(join(root, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++){
      const m = lines[i].match(GPL_RENDERER_TOKENS);
      if (m) hits.push(f + ':' + (i + 1) + ' "' + m[0] + '"');
    }
  }
  assert.deepEqual(hits, [], 'GPL renderer identifiers found (see THIRD-PARTY-NOTICES): ' + hits.slice(0, 12).join(', '));
});

await Promise.all(pending);
// ---------------------------------------------------------------- the detail waveform (the scrolling deck)
{
  const sr = 16000;
  const tone = (f, sec, amp) => { const x = new Float32Array(Math.round(sr * sec)); for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin(2 * Math.PI * f * i / sr); return x; };
  const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Float32Array(n); let k = 0; for (const x of a){ o.set(x, k); k += x.length; } return o; };
  const mix = (...a) => { const n = Math.max(...a.map(x => x.length)), o = new Float32Array(n); for (const x of a) for (let i = 0; i < x.length; i++) o[i] += x[i]; return o; };
  test('wave detail (wave8): eight planes at 500 columns a second, a kick reads low, a hat reads high and bright, silence reads nothing', () => {
    assert.equal(S.WAVE_V, 2); assert.equal(S.WAVE_HZ, 500); assert.equal(S.WAVE_PLANES.length, 8);
    // one second of 60 Hz (a kick's body), one of silence, one of 6 kHz (a hat's air)
    const x = cat(tone(60, 1, 0.8), new Float32Array(sr), tone(6000, 1, 0.3));
    const d = S.waveDetail([x], sr);
    assert.equal(d.v, 2); assert.equal(d.hz, 500);
    assert.equal(d.n, 1500, '500 columns a second: ' + d.n);
    assert.ok(Math.abs(d.dur - 3) < 1e-9);
    for (const p of S.WAVE_PLANES) assert.ok(d[p] instanceof Uint8Array && d[p].length === d.n && d[p].buffer === d.buf, p + ' is bytes on the one buffer');
    assert.equal(d.buf.byteLength, 8 * (d.n + d.mips[0].n + d.mips[1].n), 'one buffer holds every level');
    const at = (t) => S.waveRange(d, t, t + 0.2);
    const k = at(0.4), q = at(1.4), h = at(2.4);
    assert.ok(k.lo > 0.6 && k.loPk > 0.9 && k.hi < 0.02 && k.mi < 0.1, 'the kick is in the lows, and only there: ' + JSON.stringify(k));
    assert.ok(h.hi > 0.6 && h.hiPk > 0.9 && h.lo < 0.02 && h.mi < 0.1, 'the hat is in the highs, and only there: ' + JSON.stringify(h));
    assert.ok(k.tilt < 0.1 && h.tilt > 0.9 && q.tilt === 0.5, 'the tilt colours the kick dark and the hat bright, silence sits mid: ' + k.tilt + ' ' + h.tilt);
    assert.ok(q.pk === 0 && q.lo === 0 && q.hi === 0 && q.loPk === 0, 'silence is silence');
    assert.ok(k.pk > 0.9, 'the loudest thing in the song reads full scale: ' + k.pk);
    assert.ok(h.pk > 0.3 && h.pk < 0.45, 'the peak is linear: a 0.3 hat beside a 0.8 kick reads ' + h.pk.toFixed(2));
    // a held tone's body fills its height and its cap meets it (the song's own crest is the norm)
    assert.ok(k.lo > 0.9 && k.loPk > 0.9 && Math.abs(k.lo - k.loPk) < 0.08, 'a sine: body and cap together at full scale: ' + k.lo.toFixed(2) + ' / ' + k.loPk.toFixed(2));
    // …and a column spikier than the song's norm has its cap clear of its body: where the tone strikes,
    // the cap is up at once while the body (read over its window) is still filling
    let si = -1; for (let i = 0; i < d.n; i++) if (d.loPk[i] > 128){ si = i; break; }
    assert.ok(si >= 0 && si < 8 && d.loPk[si] > d.loRms[si] + 40, 'the strike\'s cap stands clear of its body: ' + d.loPk[si] + ' over ' + d.loRms[si] + ' at column ' + si);
    // a song with no highs shows none: the bands share one reference
    const dull = S.waveDetail([tone(60, 2, 0.8)], sr);
    assert.ok(S.waveRange(dull, 0.5, 1.5).hi < 0.02, 'no hiss blown up to full scale: hi ' + S.waveRange(dull, 0.5, 1.5).hi);
    // the body is read through a window: a bass note's own cycles do not read as a comb
    let lo = 0, hi = 255;
    for (let i = 300; i < 700; i++){ lo = Math.max(lo, dull.loRms[i]); hi = Math.min(hi, dull.loRms[i]); }
    assert.ok((lo - hi) / lo < 0.12, 'the body of a held 60 Hz note is steady across columns: ' + hi + '..' + lo);
  });
  test('wave detail: stereo is folded to mono, one stray spike does not flatten the song, and nothing is NaN', () => {
    const L = tone(60, 2, 0.5), R = tone(60, 2, 0.5);
    L[1000] = 1; R[1000] = 1;                                // one sample's click
    const d = S.waveDetail([L, R], sr);
    assert.ok(S.waveRange(d, 1, 1.5).lo > 0.9 && S.waveRange(d, 1, 1.5).loPk > 0.9, 'the body of the song still reads near full scale under the click');
    assert.equal(S.waveDetail([new Float32Array(0)], sr), null, 'no samples, no detail');
    assert.equal(S.waveDetail([L], 0), null, 'no rate, no detail');
    const z = S.waveDetail([new Float32Array(sr)], sr);
    assert.ok(z.pk.every(v => v === 0) && z.loRms.every(v => v === 0) && z.tilt.every(v => v === 128), 'a silent song is flat, not NaN');
    // the legacy rate still works: the column count follows hz
    assert.equal(S.waveDetail([L], sr, 150).n, 300);
  });
  test('wave mips: two coarser levels, peaks by max and bodies by mean, and waveRange reads the coarsest level that fits the span', () => {
    const x = cat(tone(60, 1, 0.8), new Float32Array(sr), tone(6000, 1, 0.3));
    const d = S.waveDetail([x], sr);
    assert.deepEqual(S.WAVE_MIPS, [4, 16]);
    assert.equal(d.mips.length, 2);
    assert.equal(d.mips[0].hz, 125); assert.equal(d.mips[0].n, Math.ceil(d.n / 4));
    assert.equal(d.mips[1].hz, 31.25); assert.equal(d.mips[1].n, Math.ceil(d.n / 16));
    for (let i = 0; i < d.mips[0].n; i++){
      let mx = 0, s = 0, c = 0;
      for (let j = i * 4; j < Math.min(d.n, i * 4 + 4); j++){ mx = Math.max(mx, d.loPk[j]); s += d.loRms[j]; c++; }
      assert.equal(d.mips[0].loPk[i], mx, 'mip peak is the max at ' + i);
      assert.ok(Math.abs(d.mips[0].loRms[i] - s / c) <= 1.01, 'mip body is the mean at ' + i + ': ' + d.mips[0].loRms[i] + ' vs ' + (s / c));
    }
    assert.equal(S.waveLevel(d, 0.001).hz, 500, 'a span under a column reads the base');
    assert.equal(S.waveLevel(d, 0.005).hz, 500);
    assert.equal(S.waveLevel(d, 0.01).hz, 125, 'a 10 ms span reads the ÷4 level');
    assert.equal(S.waveLevel(d, 0.04).hz, 31.25, 'a 40 ms span reads the ÷16 level');
    // the pure mip on float planes
    const lvl = { hz: 4, n: 4, pk: Float32Array.from([0.1, 0.9, 0.2, 0.4]), loPk: Float32Array.from([0.5, 0.7, 0, 0]), miPk: new Float32Array(4), hiPk: new Float32Array(4),
      loRms: Float32Array.from([0.2, 0.4, 0, 0]), miRms: new Float32Array(4), hiRms: Float32Array.from([0, 0, 1, 1]), tilt: Float32Array.from([0, 0, 1, 1]) };
    const m = S.waveMip(lvl, 2);
    assert.equal(m.n, 2); assert.equal(m.hz, 2);
    assert.ok(Math.abs(m.pk[0] - 0.9) < 1e-6 && Math.abs(m.loPk[0] - 0.7) < 1e-6, 'max');
    assert.ok(Math.abs(m.loRms[0] - 0.3) < 1e-6, 'mean');
    assert.ok(m.tilt[0] === 0 && m.tilt[1] === 1, 'the tilt is body-weighted');
    // the whole-signal read at a wide span is the same kick the base holds
    assert.ok(S.waveRange(d, 0, 1).loPk > 0.9 && S.waveRange(d, 2, 3).hiPk > 0.9);
    // and a span shorter than a column reads between the columns, not a step: the
    // centre of a column is that column, halfway to the next is halfway between
    const c0 = d.loRms[200] / 255, c1 = d.loRms[201] / 255;
    assert.ok(Math.abs(S.waveRange(d, 0.4009, 0.4011).lo - c0) < 1e-9, 'the centre of column 200 reads column 200');
    assert.ok(Math.abs(S.waveRange(d, 0.4019, 0.4021).lo - (c0 + c1) / 2) < 1e-9, 'halfway to 201 reads the midpoint');
    assert.ok(Math.abs(S.waveRangeAt(d, 0.401, {}).loPk - d.loPk[200] / 255) < 1e-9);
  });
  test('wave detail: the shipped 12 Hz score stands in until the decode lands, in the same names (v: 1), read between its steps', () => {
    const env = { hz: 12, b: '9900', m: '0990', t: '0009' };
    const d = S.waveFromEnv(env);
    assert.equal(d.v, 1); assert.equal(d.n, 4); assert.equal(d.hz, 12); assert.ok(d.coarse);
    for (const p of S.WAVE_PLANES) assert.ok(d[p] instanceof Uint8Array && d[p].length === 4, p + ' is there');
    assert.equal(d.loPk, d.loRms, 'a score knows no peak from a body');
    assert.equal(d.lo[0], 255); assert.equal(d.hi[3], 255); assert.equal(d.mi[0], 0);
    assert.equal(S.waveFromEnv(null), null); assert.equal(S.waveFromEnv({ hz: 12, b: '', m: '', t: '' }), null);
    const r = S.waveRange(d, 0.1, 0.12);
    assert.ok(r.lo === 1 && r.mi > 0.5 && r.mi < 1 && r.hi === 0, 'a span narrower than a step reads between the steps: ' + JSON.stringify(r));
    assert.ok(S.waveRange(d, 0.0, 0.01).lo === 1 && S.waveRange(d, 0.3, 0.31).hi === 1, 'the ends hold their own step');
    const past = S.waveRange(d, 5, 6);
    assert.ok(past.pk === 0 && past.lo === 0 && past.hi === 0 && past.loPk === 0, 'past the end is silence');
    assert.equal(S.waveRange(null, 0, 1).pk, 0);
    const wide = S.waveRange(d, 0, 0.34);
    assert.ok(wide.loPk === 1 && wide.hiPk === 1 && wide.lo === 0.5 && wide.hi === 0.25, 'a wide span holds the loudest cap of each band and the mean of its body: ' + JSON.stringify(wide));
  });
  test('wave fold: a landed detail folds into the overview\'s shape (peaksFromEnv\'s), so a decoded song is never decoded again', () => {
    const x = cat(tone(60, 1, 0.8), new Float32Array(sr), tone(6000, 1, 0.3));
    const d = S.waveDetail([x], sr);
    const f = S.waveFoldPeaks(d, 480), g = S.peaksFromEnv({ hz: 12, b: '9900', m: '0990', t: '0009' }, 480);
    assert.deepEqual(Object.keys(f), Object.keys(g)); assert.deepEqual(Object.keys(f.bands), Object.keys(g.bands)); assert.deepEqual(Object.keys(f.bmax), Object.keys(g.bmax));
    assert.ok(f.pk instanceof Float32Array && f.pk.length === 480 && f.bands.l.length === 480);
    assert.equal(Math.max(...f.pk), 1, 'peaks to 1.0');
    assert.ok(f.bands.l[60] > 0.5 && f.bands.l[400] < 0.02 && f.bands.h[400] > 0.5 && f.bands.h[60] < 0.02, 'the kick folds into the first third, the hat into the last');
    assert.ok(f.bmax.l > 0.5 && f.bmax.h > 0.5 && f.bmax.m > 0 && f.bmax.m < 0.1, 'the maxima alongside');
    assert.equal(S.waveFoldPeaks(S.waveFromEnv({ hz: 12, b: '99', m: '00', t: '00' }), 8), null, 'a score is not a detail: the score\'s own fold stands');
    assert.equal(S.waveFoldPeaks(null, 8), null);
    assert.equal(S.waveFoldPeaks(d, 1).pk.length, 8, 'never fewer than eight columns');
  });
  test('wave onsets: a hit — a band peak clear of its body and rising — is flagged; a steady tone is not', () => {
    const pk = new Float32Array(20).fill(0.8), rms = new Float32Array(20).fill(0.57);   // a sine: crest √2, under the bar
    assert.equal([...S.waveOnsets(pk, rms, 20)].slice(1).join(''), '0'.repeat(19), 'a held tone is no onset');
    const pk2 = Float32Array.from([0.1, 0.1, 0.1, 0.9, 0.8, 0.6, 0.4, 0.3]), rms2 = Float32Array.from([0.08, 0.08, 0.08, 0.3, 0.4, 0.4, 0.3, 0.25]);
    assert.equal([...S.waveOnsets(pk2, rms2, 8)].join(''), '00010000', 'the hit is flagged where it strikes, not on its decay');
    const quiet = Float32Array.from([0, 0.02, 0.04]), qr = new Float32Array(3);
    assert.equal([...S.waveOnsets(quiet, qr, 3)].join(''), '000', 'noise under the floor is nothing');
    const out = new Uint8Array(8);
    assert.equal(S.waveOnsets(pk2, rms2, 8, out), out, 'a caller\'s buffer is used');
    // and a real kick in the detail: the lows' peak jumps clear of their body at the strike
    const d = S.waveDetail([cat(new Float32Array(sr / 2), tone(60, 0.5, 0.8))], sr);
    const p = new Float32Array(d.n), b = new Float32Array(d.n);
    for (let i = 0; i < d.n; i++){ p[i] = d.loPk[i] / 255; b[i] = d.loRms[i] / 255; }
    const f = S.waveOnsets(p, b, d.n);
    let first = -1; for (let i = 0; i < d.n; i++) if (f[i]){ first = i; break; }
    assert.ok(first >= 248 && first <= 256, 'the strike is flagged at the half-second: column ' + first);
  });
  test('wave colour: three OKLCH band colours hung off the key, a tilt LUT in gamut with lightness climbing lows → highs, hues within the key\'s arc', () => {
    const toLin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    // OKLab lightness read back from sRGB (the inverse of the engine's matrices), to check the ladder survived the gamut
    const okL = rgb => { const [r, g, b] = rgb.map(toLin); const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s; };
    const arc = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };
    for (const key of ['1A', '2B', '3A', '4B', '5A', '6B', '7A', '8B', '9A', '10B', '11A', '12B', null]){
      const hue = key ? S.camelotHue(key) : null;
      const cols = S.waveBandColours(hue);
      const h0 = hue == null ? 200 : hue;
      assert.ok(cols.lo.l < cols.mi.l && cols.mi.l < cols.hi.l && cols.lo.c > cols.mi.c && cols.mi.c > cols.hi.c, 'the lightness ladder climbs lows → highs as the chroma falls: ' + JSON.stringify(cols));
      assert.ok(Math.abs(cols.mi.l - 0.72) < 1e-9 && Math.abs(cols.mi.c - 0.13) < 1e-9, 'the body is the deck\'s accent (keyRGB\'s L .72 C .13)');
      assert.ok(arc(cols.lo.h, h0 - 50) < 1e-6 && arc(cols.mi.h, h0) < 1e-6 && arc(cols.hi.h, h0 + 40) < 1e-6, 'the hues hang off the key: ' + JSON.stringify(cols));
      const lut = S.waveTiltLUT(cols, 33);
      assert.ok(lut instanceof Uint8ClampedArray && lut.length === 99, 'an Int array of 33 triples');
      let prev = -1;
      for (let i = 0; i < 33; i++){
        const rgb = [lut[i * 3] / 255, lut[i * 3 + 1] / 255, lut[i * 3 + 2] / 255];
        for (const v of rgb) assert.ok(v >= 0 && v <= 1, 'in gamut');
        const c = S.waveTiltAt(cols, i / 32);
        assert.ok(arc(c.h, h0) <= 50 + 1e-6, 'hue within the key\'s ±50° arc at ' + i + ': ' + c.h + ' vs ' + h0);
        assert.ok(Math.abs(okL(rgb) - c.l) < 0.02, 'the asked lightness survives the gamut map at ' + i + ' (' + key + '): ' + okL(rgb).toFixed(3) + ' vs ' + c.l.toFixed(3));
        const Y = S.relLuma(rgb.map(toLin));
        assert.ok(Y >= prev - 1e-6, 'lightness monotone lo → hi at ' + i + ' (' + key + ')');
        prev = Y;
      }
      // the LUT's ends and middle are the band colours themselves
      const mi = S.oklchToRgbFine(cols.mi.l, cols.mi.c, cols.mi.h).map(v => Math.round(v * 255));
      assert.deepEqual([lut[48], lut[49], lut[50]], mi, 'the middle of the LUT is the body colour (the deck\'s accent)');
    }
    assert.equal(S.waveBandColours(null).mi.h, 200, 'no key: the fallback hue');
    assert.equal(S.waveBandColours(370).mi.h, 10, 'hues wrap');
    assert.equal(S.waveTiltLUT(S.waveBandColours(40), 0).length, 99, 'a bad size is the default');
    // the stem palette lives in the same space now, and still reads as it did
    assert.ok(S.STEM_PAL.d[0] > S.STEM_PAL.d[2] && S.STEM_PAL.v[2] > S.STEM_PAL.v[0] && S.STEM_PAL.b[0] > S.STEM_PAL.b[2], 'drums red-forward, vocals blue-forward, bass warm');
  });
  test('wave grid: beats from the anchor, bar lines every fourth, phrase lines every eight bars, bar numbers from 1, dressed by the downbeat\'s confidence', () => {
    const g = S.waveGrid(120, 2, 1, 20);           // a beat every half second from 2 s
    assert.equal(g[0].t, 1, 'it reaches back before the anchor, from the first beat in range');
    const a = g.find(x => x.t === 2);
    assert.ok(a.bar && a.phrase && a.barNo === 1, 'the anchor is bar 1 and a phrase');
    const b2 = g.find(x => x.t === 4);
    assert.ok(b2.bar && !b2.phrase && b2.barNo === 2, 'four beats on is bar 2');
    assert.ok(!g.find(x => x.t === 2.5).bar, 'the two is not a bar line');
    const p2 = S.waveGrid(120, 2, 17.9, 18.1).find(x => x.bar);
    assert.ok(p2 && p2.phrase && p2.barNo === 9, 'eight bars on is the next phrase: bar ' + (p2 && p2.barNo));
    assert.equal(S.waveGrid(1e9, 0, 0, 100).length, 512, 'bounded');
    assert.deepEqual(S.waveGrid(0, 0, 0, 10), []); assert.deepEqual(S.waveGrid(120, NaN, 0, 10), []);
    assert.equal(S.waveBeatPos(120, 2, 2.75), 1.5);
    assert.equal(S.waveBeatPos(120, 2, 1.5), 3, 'before the anchor wraps into the bar before');
    assert.equal(S.waveBeatPos(0, 2, 3), null);
    const sure = S.waveGridStyle(1, 40), unsure = S.waveGridStyle(0, 40), half = S.waveGridStyle(null, 40);
    assert.ok(sure.bar > half.bar && half.bar > unsure.bar && unsure.bar > 0.1, 'a bar nobody is sure of is faint, never absent');
    assert.ok(sure.tick > unsure.tick);
    assert.equal(S.waveGridStyle(0.5, 24).numEvery, 1, 'a 24 px bar is numbered every bar');
    assert.equal(S.waveGridStyle(0.5, 23).numEvery, 4, '…narrower, every fourth');
    assert.equal(S.waveGridStyle(0.5, 8).numbers, false, 'and a bar too narrow to read is not numbered');
  });
  test('wave deck time: under a tape loop the needle shows the loop\'s audible position; a roll and a free deck keep the deck\'s own time', () => {
    const L = { on: true, mode: 'loop', start: 20, len: 0.5, handAt: 10, deckRate: 1 };
    assert.ok(Math.abs(S.waveDeckTime(99, L, 11.3) - 20.3) < 1e-9, '1.3 s after the handover: 0.3 into the loop');
    assert.ok(Math.abs(S.waveDeckTime(99, Object.assign({}, L, { deckRate: 1.03 }), 11.3) - (20 + (0.3 * 1.03) % 0.5)) < 1e-9, 'at the tape\'s rate: the phase scaled by the rate the tape was cut at');
    assert.ok(Math.abs(S.waveDeckTime(99, L, 9) - 20) < 1e-9, 'before the handover is audible: the in-point');
    assert.equal(S.waveDeckTime(99, Object.assign({}, L, { mode: 'roll' }), 11.3), 99, 'a roll runs on underneath');
    assert.equal(S.waveDeckTime(99, Object.assign({}, L, { on: false }), 11.3), 99, 'no loop, the deck');
    assert.equal(S.waveDeckTime(99, null, 11.3), 99);
    assert.equal(S.waveDeckTime(99, Object.assign({}, L, { len: 0 }), 11.3), 99);
    assert.equal(S.waveDeckTime(99, L, NaN), 99);
  });
  test('wave rate step: tiles are painted at the deck\'s own rate in 0.4 % steps, exactly 1 at rest, so a blit is never off 1:1 by more than a fifth of a percent', () => {
    assert.equal(S.waveRateStep(1), 1); assert.equal(S.waveRateStep(1.001), 1); assert.equal(S.waveRateStep(0), 1); assert.equal(S.waveRateStep(NaN), 1);
    for (const r of [0.5, 0.75, 0.97, 1.03, 1.25, 1.5, 2]) assert.ok(Math.abs(S.waveRateStep(r) / r - 1) <= 0.002 + 1e-9, 'within a fifth of a percent at ' + r + ': ' + S.waveRateStep(r));
    let last = 0, steps = new Set();
    for (let r = 1.0; r <= 1.06; r += 0.0005){ const q = S.waveRateStep(r); assert.ok(q >= last, 'monotone'); last = q; steps.add(q); }
    assert.ok(steps.size >= 12 && steps.size <= 18, 'a 6 % glide repaints a dozen-odd times, not every frame: ' + steps.size);
    assert.equal(S.waveClock(192.7), '3:12'); assert.equal(S.waveClock(-3), '0:00'); assert.equal(S.waveClock(NaN), '0:00');
  });
  test('wave worker: the module is the tested arithmetic and answers a job with the detail, in one transferred buffer', () => {
    const src = S.waveWorkerSource();
    for (const f of ['waveDetail', 'waveMip', 'wavePack', 'waveTrailMean', 'waveTrailMax', 'waveTilt', 'waveNorm']) assert.ok(src.includes('function ' + f + '('), f + ' is in the worker');
    assert.ok(src.includes('WAVE_PLANES = ["pk","loPk","miPk","hiPk","loRms","miRms","hiRms","tilt"]') && src.includes('WAVE_MIPS = [4,16]'));
    let posted = null;
    const scope = {};
    new Function('postMessage', 'self', src + '\nreturn onmessage;')((m, tr) => { posted = { m, tr }; }, scope)({ data: { id: 7, chans: [tone(60, 1, 0.5)], sr, hz: 500 } });
    assert.ok(posted && posted.m.id === 7 && posted.m.det.n === 500 && posted.m.det.v === 2, 'the job comes back with its id');
    assert.equal(posted.tr.length, 1, 'the whole detail is ONE buffer, transferred, not copied');
    assert.equal(posted.tr[0], posted.m.det.buf);
    assert.equal(posted.m.det.mips.length, 2);
    // a broken job answers with nothing, not a throw
    new Function('postMessage', 'self', src + '\nreturn onmessage;')((m, tr) => { posted = { m, tr }; }, scope)({ data: { id: 8 } });
    assert.ok(posted.m.id === 8 && posted.m.det === null && posted.tr.length === 0);
  });
  test('wave trail: the body window and the peak hold are trailing — the onset edge stays put, only the decay lengthens', () => {
    const v = Float32Array.from([0, 0, 1, 1, 1, 0, 0, 0]);
    const m = S.waveTrailMean(Float32Array.from(v), 2);
    assert.deepEqual([...m].map(x => +x.toFixed(2)), [0, 0, 0.5, 1, 1, 0.5, 0, 0], 'a 2-column mean');
    assert.equal(m[1], 0, 'nothing before the edge');
    const h = S.waveTrailMax(Float32Array.from([0, 1, 0, 0, 0, 0.5, 0]), 3);
    assert.deepEqual([...h], [0, 1, 1, 1, 0, 0.5, 0.5], 'held for the window after the strike, never before it');
    assert.deepEqual([...S.waveTrailMean(Float32Array.from([1, 2]), 1)], [1, 2], 'a window of one is the voice itself');
    assert.equal(S.waveTilt(1, 0, 0), 0); assert.equal(S.waveTilt(0, 1, 0), 0.5); assert.equal(S.waveTilt(0, 0, 1), 1); assert.equal(S.waveTilt(0, 0, 0), 0.5);
  });
}

// ---------------------------------------------------------------- vinyl: the platter
{
  const sr = 48000;
  // run the tape block by block, the way the audio thread does, with a hand/command script
  const run = (S, inL, inR, blk, at) => {
    const n = inL.length, outL = new Float32Array(n), outR = new Float32Array(n);
    for (let i = 0; i < n; i += blk){
      if (at) at(i, S);
      const m = Math.min(blk, n - i);
      const oL = new Float32Array(m), oR = new Float32Array(m);
      S.vinylProcess(S.S, inL.subarray(i, i + m), inR ? inR.subarray(i, i + m) : null, oL, oR, m);
      outL.set(oL, i); outR.set(oR, i);
    }
    return { outL, outR };
  };
  const ramp = n => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = i; return x; };
  test('platter: a direct drive — the motor reaches speed, a finger owns it, the mat gives it back', () => {
    const P = S.makePlatter(); P.rate = 0; P.mode = 'motor';
    let t = 0; while (P.rate < 0.98 && t < 5){ S.platterStep(P, 1 / 200, null); t += 1 / 200; }
    assert.ok(t > 0.5 && t < 2.0, 'a third-of-a-second time constant reaches speed in ' + t.toFixed(2) + ' s');
    // a finger drags it backwards: the record follows the finger, fast
    for (let i = 0; i < 20; i++) S.platterStep(P, 1 / 200, -1.5);
    assert.ok(P.rate < -1.4 && P.mode === 'hand', 'followed the hand to ' + P.rate.toFixed(2));
    // the finger lifts: the motor takes it back through the mat, quickly, and settles
    let back = 0; while (P.mode !== 'motor' && back < 2){ S.platterStep(P, 1 / 200, null); back += 1 / 200; }
    assert.ok(back < 0.6 && Math.abs(P.rate - 1) < 0.03, 'back on the motor in ' + back.toFixed(2) + ' s at ' + P.rate.toFixed(3));
    assert.ok(Math.abs(S.platterStep(P, 1, 99).rate) <= S.PLATTER.maxRate, 'a wild hand is clamped');
  });
  test('platter: a brake coasts to a real stop and stays there until the power returns; a backspin flicks and dies', () => {
    const P = S.makePlatter(); P.mode = 'brake';
    let t = 0; while (P.mode !== 'stopped' && t < 5){ S.platterStep(P, 1 / 200, null); t += 1 / 200; }
    assert.equal(P.mode, 'stopped'); assert.equal(P.rate, 0);
    assert.ok(t > 0.8 && t < 3, 'coasted down in ' + t.toFixed(2) + ' s — weight, not a fade');
    for (let i = 0; i < 100; i++) S.platterStep(P, 1 / 200, null);
    assert.equal(P.rate, 0, 'stopped means stopped');
    S.vinylCommand({ platter: P, engaged: true, written: 100, pos: 50 }, { op: 'motor', v: 1 });
    for (let i = 0; i < 400; i++) S.platterStep(P, 1 / 200, null);
    assert.ok(Math.abs(P.rate - 1) < 0.03, 'the power came back on: ' + P.rate.toFixed(3));
    const B = S.makePlatter(); S.vinylCommand({ platter: B, engaged: true, written: 100, pos: 50 }, { op: 'backspin' });
    assert.ok(B.rate < -3, 'flicked backwards');
    let neg = 0; t = 0;
    while (!(B.mode === 'motor' && Math.abs(B.rate - 1) < 0.03) && t < 5){ S.platterStep(B, 1 / 200, null); if (B.rate < 0) neg += 1 / 200; t += 1 / 200; }
    assert.ok(neg > 0.5 && neg < 1.6 && t < 2.5, 'ran backwards for ' + neg.toFixed(2) + ' s and was back on the motor by ' + t.toFixed(2) + ' s');
  });
  test('platter: the hand is an angle — a turn is 1.8 s of music, and the shortest way round is taken', () => {
    assert.ok(Math.abs(S.platterHandRate(2 * Math.PI, 1.8) - 1) < 1e-9, 'one turn in 1.8 s is the motor speed');
    assert.ok(Math.abs(S.platterHandRate(-Math.PI, 0.45) + 2) < 1e-9, 'half a turn back in 0.45 s is −2×');
    assert.equal(S.platterHandRate(1, 0), 0);
    assert.ok(Math.abs(S.platterDelta(0.1, 2 * Math.PI - 0.1) - 0.2) < 1e-9, 'across the wrap');
    assert.ok(Math.abs(S.platterDelta(-3, 3) - (2 * Math.PI - 6)) < 1e-9);
  });
  test('hermite4: lands on the samples and reproduces a line exactly', () => {
    assert.equal(S.hermite4(0, 1, 2, 3, 0), 1);
    assert.ok(Math.abs(S.hermite4(0, 1, 2, 3, 1) - 2) < 1e-12);
    for (const t of [0.1, 0.25, 0.5, 0.9]) assert.ok(Math.abs(S.hermite4(3, 5, 7, 9, t) - (5 + 2 * t)) < 1e-12, 'linear at ' + t);
    assert.ok(S.hermite4(0, 0, 1, 1, 0.5) > 0.45 && S.hermite4(0, 0, 1, 1, 0.5) < 0.55, 'a smooth step through the middle');
  });
  test('vinyl: disengaged, the room passes through untouched — and the tape records it regardless', () => {
    const V = { S: S.makeVinyl(sr, 1), vinylProcess: S.vinylProcess };
    const x = ramp(4000);
    const { outL } = run(V, x, null, 128);
    for (let i = 0; i < 4000; i++) assert.equal(outL[i], x[i]);
    assert.equal(V.S.written, 4000);
    assert.equal(V.S.ring[0][3999], 3999, 'the tape has the last sample');
  });
  test('vinyl: engaged at 1× it rides the live edge a couple of samples behind, under a short crossfade', () => {
    const V = { S: S.makeVinyl(sr, 1), vinylProcess: S.vinylProcess };
    const x = ramp(9600);
    const { outL } = run(V, x, null, 128, (i, st) => { if (i === 2048) S.vinylCommand(st.S, { op: 'engage' }); });
    assert.ok(V.S.engaged);
    const rampN = Math.round(S.VINYL_RAMP_SEC * sr);
    for (let i = 2048 + rampN + 8; i < 9600; i++) assert.ok(x[i] - outL[i] >= 0 && x[i] - outL[i] <= 4, 'sample ' + i + ' lags by ' + (x[i] - outL[i]));
    // the crossfade itself is a crossfade: no step larger than the ramp's own slope
    let worst = 0;
    for (let i = 2049; i < 2048 + rampN + 8; i++) worst = Math.max(worst, Math.abs((outL[i] - outL[i - 1]) - 1));
    assert.ok(worst < 1.5, 'worst step across the take ' + worst.toFixed(3));
  });
  test('vinyl: a hand pulled backwards reads the tape backwards; a brake reads it to a stop', () => {
    const V = { S: S.makeVinyl(sr, 1), vinylProcess: S.vinylProcess };
    const x = ramp(sr);
    const { outL } = run(V, x, null, 128, (i, st) => {
      if (i === 8192) S.vinylCommand(st.S, { op: 'engage' });
      if (i === 12288) S.vinylCommand(st.S, { op: 'hand', v: -1 });
    });
    // by 0.1 s after the pull the record is going backwards: the output falls as the input rises
    const a = 12288 + 4800, b = a + 2400;
    assert.ok(outL[b] < outL[a] - 2000, 'backwards: ' + outL[a].toFixed(0) + ' → ' + outL[b].toFixed(0));
    assert.ok(V.S.platter.rate < -0.95, 'the rate followed the hand: ' + V.S.platter.rate.toFixed(3));
    const W = { S: S.makeVinyl(sr, 3), vinylProcess: S.vinylProcess };   // a tape longer than the test, so the stopped place survives
    const y = ramp(sr * 2);
    const r = run(W, y, null, 128, (i, st) => { if (i === 8192) S.vinylCommand(st.S, { op: 'engage' }); if (i === 9216) S.vinylCommand(st.S, { op: 'brake' }); });
    assert.equal(W.S.platter.mode, 'stopped');
    assert.ok(Math.abs(r.outL[sr * 2 - 1] - r.outL[sr * 2 - 400]) < 1, 'a stopped record reads one place');
  });
  test('vinyl: the read head can never pass the live edge, nor fall off the back of the tape', () => {
    const V = { S: S.makeVinyl(sr, 0.1), vinylProcess: S.vinylProcess };   // a short tape: 4800 frames
    const x = ramp(sr);
    run(V, x, null, 128, (i, st) => {
      if (i === 1024) S.vinylCommand(st.S, { op: 'engage' });
      if (i === 2048) S.vinylCommand(st.S, { op: 'hand', v: 6 });     // flung forward
      if (i === 24000) S.vinylCommand(st.S, { op: 'hand', v: -6 });   // and back, past the tape's reach
    });
    assert.ok(V.S.pos <= V.S.written, 'never ahead of what was written');
    assert.ok(V.S.pos >= V.S.written - V.S.cap, 'never behind the tape');
    for (let i = 0; i < 4; i++) assert.ok(isFinite(V.S.ring[0][i]));
  });
  test('vinyl: a snap takes the head home to the live edge at the motor speed, under a crossfade', () => {
    const V = { S: S.makeVinyl(sr, 1), vinylProcess: S.vinylProcess };
    const x = ramp(sr);
    const { outL } = run(V, x, null, 128, (i, st) => {
      if (i === 4096) S.vinylCommand(st.S, { op: 'engage' });
      if (i === 8192) S.vinylCommand(st.S, { op: 'hand', v: 0 });     // held still: the lag grows
      if (i === 24576) S.vinylCommand(st.S, { op: 'snap' });
    });
    assert.ok(V.S.written - V.S.pos < 8, 'home: ' + (V.S.written - V.S.pos).toFixed(1) + ' frames behind');
    assert.equal(V.S.platter.mode, 'motor'); assert.equal(V.S.platter.rate, 1);
    assert.ok(x[sr - 1] - outL[sr - 1] <= 4, 'reading the live edge again');
  });
  test('vinyl: letting go fades the room back in without a step', () => {
    const V = { S: S.makeVinyl(sr, 1), vinylProcess: S.vinylProcess };
    const x = ramp(sr);
    const { outL } = run(V, x, null, 128, (i, st) => {
      if (i === 4096) S.vinylCommand(st.S, { op: 'engage' });
      if (i === 24576) S.vinylCommand(st.S, { op: 'release' });
    });
    assert.ok(!V.S.engaged && V.S.gain === 0);
    assert.equal(outL[sr - 1], x[sr - 1], 'passed through again');
    let worst = 0; for (let i = 24577; i < 24576 + 600; i++) worst = Math.max(worst, Math.abs((outL[i] - outL[i - 1]) - 1));
    assert.ok(worst < 1.5, 'the handback is a fade, worst step ' + worst.toFixed(3));
  });
  test('vinyl: the worklet module is the tested arithmetic, serialised', () => {
    const src = S.vinylWorkletSource();
    for (const f of ['function platterStep(', 'function hermite4(', 'function vinylProcess(', 'function vinylCommand('])
      assert.ok(src.includes(f), f + ' is in the module');
    assert.ok(src.includes("registerProcessor('mb8-vinyl'"), 'it registers the processor');
    assert.ok(src.includes('"backspin":' + S.PLATTER.backspin), 'with the same tuning');
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentTime', src);
  });

  /* THE SONG TAPE — the platter on a deck that plays element-direct (iOS). The
     tape is the song, int16; the element's playhead is the live edge. */
  const tsr = 24000;
  // a tape whose every sample says where it is: frame f holds f (scaled into int16)
  const tape = n => { const t = new Int16Array(n); for (let i = 0; i < n; i++) t[i] = i % 32000; return t; };
  const runSong = (S, n, blk, at) => {
    const outL = new Float32Array(n), outR = new Float32Array(n);
    for (let i = 0; i < n; i += blk){
      if (at) at(i, S);
      const m = Math.min(blk, n - i);
      const oL = new Float32Array(m), oR = new Float32Array(m);
      S.vinylSongProcess(S.S, oL, oR, m);
      outL.set(oL, i); outR.set(oR, i);
    }
    return { outL, outR };
  };
  // the tape frame an output sample was read from (k = 1/32768 undone)
  const frameOf = v => Math.round(v * 32768);
  test('vinyl: the hand is a place — the record lands where the finger took it, however late the events come', () => {
    const run2 = (late) => {
      const V = { S: S.makeVinyl(sr, 4), vinylProcess: S.vinylProcess };
      const x = ramp(sr * 2);
      let grabPos = 0;
      run(V, x, null, 128, (i, st) => {
        if (i === 48000) S.vinylCommand(st.S, { op: 'engage' });
        if (i === 60032){ S.vinylCommand(st.S, { op: 'grab' }); grabPos = st.S.pos; }
        // the finger pulls the record back half a second of music over 100 ms: as eight
        // timely events, or as ONE event 90 ms late carrying the whole way
        if (!late){ for (let k = 1; k <= 8; k++) if (i === 60032 + k * 640) S.vinylCommand(st.S, { op: 'handAt', x: -0.5 * k / 8 }); }
        else if (i === 60032 + 4352) S.vinylCommand(st.S, { op: 'handAt', x: -0.5 });
      });
      return { S: V.S, grabPos };
    };
    for (const late of [false, true]){
      const { S: st, grabPos } = run2(late);
      const want = grabPos - 0.5 * sr;
      assert.ok(Math.abs(st.pos - want) < 0.002 * sr, (late ? 'late' : 'timely') + ': the head sits where the finger left it, ' + ((st.pos - want) / sr * 1000).toFixed(2) + ' ms off');
      assert.ok(Math.abs(st.platter.rate) < 0.02 && st.platter.mode === 'hand', 'and the record is still under a still finger: ' + st.platter.rate.toFixed(4));
    }
    const P = { pos: 0, hand: null, handTo: 1e9 };
    S.platterHandFollow(P, sr);
    assert.equal(P.hand, S.PLATTER.maxRate, 'a wild place is chased no faster than the platter can turn');
    const Q = S.makeVinyl(sr, 1); S.vinylCommand(Q, { op: 'engage' }); S.vinylCommand(Q, { op: 'grab' });
    S.vinylCommand(Q, { op: 'lift' });
    S.vinylCommand(Q, { op: 'handAt', x: 3 });
    assert.equal(Q.handTo, null, 'an event after the lift takes nothing back');
  });
  test('song tape: the budget picks the finest rate a song can be held at, and refuses what cannot be', () => {
    assert.equal(S.vinylSongRate(180), 32000, 'a three-minute song is held at the full 32 kHz');
    const r = S.vinylSongRate(420);
    assert.ok(r < 32000 && r * 420 <= S.VINYL_SONG_FRAMES, 'a seven-minute one at ' + r + ' Hz, inside the budget');
    assert.equal(S.vinylSongRate(3600), 0, 'an hour is too long to hold');
    assert.equal(S.vinylSongRate(0), 0); assert.equal(S.vinylSongRate(NaN), 0); assert.equal(S.vinylSongRate(Infinity), 0);
    const t = S.vinylToTape(new Float32Array([0, 0.5, -0.5, 2, -2]));
    assert.deepEqual(Array.from(t), [0, 16383, -16383, 32767, -32768], 'float to int16, clipped, never wrapped');
  });
  test('song tape: silent until engaged (the element is what is heard), and the edge rides the deck', () => {
    const V = { S: S.makeVinylSong(sr, tape(tsr * 4), null, tsr), vinylSongProcess: S.vinylSongProcess };
    S.vinylSongCommand(V.S, { op: 'clock', at: 1, rate: 1, hard: true });
    const { outL, outR } = runSong(V, sr, 128);
    assert.ok(outL.every(v => v === 0) && outR.every(v => v === 0), 'nothing from the tape while the hand is off');
    assert.ok(Math.abs(V.S.written - 2 * tsr) < 2, 'one second later the edge is at 2 s: ' + (V.S.written / tsr).toFixed(4));
    // a soft clock leans, a hard one (or a big jump) lands
    S.vinylSongCommand(V.S, { op: 'clock', at: 2.01 });
    assert.ok(V.S.written > 2 * tsr && V.S.written < 2.01 * tsr, 'a 10 ms drift is leaned into, not jumped');
    S.vinylSongCommand(V.S, { op: 'clock', at: 3 });
    assert.equal(V.S.written, 3 * tsr, 'a second away is a seek: the edge lands');
    S.vinylSongCommand(V.S, { op: 'clock', at: 99, hard: true });
    assert.ok(V.S.written <= V.S.cap - 3, 'never off the end of the tape');
  });
  test('song tape: engaged at 1x it plays the song from the playhead, resampled, under a short fade', () => {
    const V = { S: S.makeVinylSong(sr, tape(tsr * 4), null, tsr), vinylSongProcess: S.vinylSongProcess };
    S.vinylSongCommand(V.S, { op: 'clock', at: 1, rate: 1, hard: true });
    const { outL } = runSong(V, sr / 2, 128, (i, st) => { if (i === 1024) S.vinylSongCommand(st.S, { op: 'engage' }); });
    const j = 1024 + 1024;                                // well past the 6 ms fade
    const f0 = frameOf(outL[j]), f1 = frameOf(outL[j + 2000]);
    const edge = tsr + j * tsr / sr;
    assert.ok(Math.abs(f0 - edge) < 8, 'it reads where the element is: frame ' + f0 + ' vs edge ' + edge.toFixed(0));
    assert.ok(Math.abs((f1 - f0) - 2000 * tsr / sr) < 1.5, 'at the tape\'s rate, not the output\'s: ' + (f1 - f0));
    assert.ok(Math.abs(outL[1025]) < Math.abs(outL[j]) * 0.2, 'faded in, not stepped');
  });
  test('song tape: a hand pulled backwards reads the song backwards; the head never passes the playhead', () => {
    const V = { S: S.makeVinylSong(sr, tape(tsr * 4), null, tsr), vinylSongProcess: S.vinylSongProcess };
    S.vinylSongCommand(V.S, { op: 'clock', at: 2, rate: 1, hard: true });
    const { outL } = runSong(V, sr, 128, (i, st) => {
      if (i === 1024) S.vinylSongCommand(st.S, { op: 'engage' });
      if (i === 4096) S.vinylSongCommand(st.S, { op: 'hand', v: -1 });
      if (i === 24576) S.vinylSongCommand(st.S, { op: 'hand', v: 6 });     // flung forward, at the edge
    });
    const a = frameOf(outL[12000]), b = frameOf(outL[16000]);
    assert.ok(b < a && Math.abs((a - b) - 4000 * tsr / sr) < 40, 'backwards at about 1x: ' + a + ' -> ' + b);
    const edgeAt = i => 2 * tsr + i * tsr / sr;
    let over = 0;
    for (let i = 24576; i < sr; i += 64) if (frameOf(outL[i]) > edgeAt(i) + 1) over++;
    assert.equal(over, 0, 'a forward flick lands on the playhead, never past it');
  });
  test('song tape: letting go fades the tape out to silence, the element takes the room back', () => {
    const V = { S: S.makeVinylSong(sr, tape(tsr * 4), null, tsr), vinylSongProcess: S.vinylSongProcess };
    S.vinylSongCommand(V.S, { op: 'clock', at: 1, rate: 1, hard: true });
    const { outL } = runSong(V, sr / 2, 128, (i, st) => {
      if (i === 1024) S.vinylSongCommand(st.S, { op: 'engage' });
      if (i === 8192) S.vinylSongCommand(st.S, { op: 'release' });
    });
    let worst = 0; for (let i = 8193; i < 8192 + 400; i++) worst = Math.max(worst, Math.abs(outL[i] - outL[i - 1]));
    assert.ok(worst < 0.05, 'no step on the way out: ' + worst.toFixed(4));
    assert.ok(outL.subarray(8192 + 512).every(v => v === 0), 'silent once the fade is done');
    assert.equal(V.S.engaged, false);
  });
  test('song tape: a slower deck moves the edge slower, and no tape is silence, not a crash', () => {
    const V = { S: S.makeVinylSong(sr, tape(tsr * 4), null, tsr), vinylSongProcess: S.vinylSongProcess };
    S.vinylSongCommand(V.S, { op: 'clock', at: 0, rate: 0.5, hard: true });
    runSong(V, sr, 128);
    assert.ok(Math.abs(V.S.written - 0.5 * tsr) < 2, 'half speed: half a second of song in a second');
    S.vinylSongCommand(V.S, { op: 'clock', at: 0, rate: -3 });
    assert.equal(V.S.deckRate, 0.5, 'a nonsense rate is ignored');
    assert.equal(S.vinylSongCommand(null, { op: 'engage' }), null);
  });
  test('song tape: the worklet module carries the song processor, and it plays the tape it is sent', () => {
    const src = S.vinylWorkletSource();
    for (const f of ['function makeVinylSong(', 'function vinylSongCommand(', 'function vinylSongProcess('])
      assert.ok(src.includes(f), f + ' is in the module');
    const reg = {};
    class AWP { constructor(){ this.port = { postMessage(){}, onmessage: null }; } }
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', 'currentTime', src)(AWP, (n, c) => { reg[n] = c; }, sr, 0);
    assert.ok(reg['mb8-vinyl'] && reg['mb8-vinyl-song'], 'both processors register: ' + Object.keys(reg).join(', '));
    const p = new reg['mb8-vinyl-song']();
    const out = [new Float32Array(128), new Float32Array(128)];
    assert.equal(p.process([], [out]), true, 'no tape yet: silence, and alive');
    assert.ok(out[0].every(v => v === 0));
    const L = tape(tsr * 2);
    p.port.onmessage({ data: { op: 'tape', L, R: null, sr: tsr } });
    p.port.onmessage({ data: { op: 'clock', at: 1, rate: 1, hard: true } });
    p.port.onmessage({ data: { op: 'engage' } });
    for (let i = 0; i < 8; i++) p.process([], [out]);
    assert.ok(Math.abs(frameOf(out[0][127]) - (tsr + 8 * 128 * tsr / sr)) < 8, 'it plays the song at the playhead');
    p.port.onmessage({ data: { op: 'eject' } });
    p.process([], [out]);
    assert.ok(out[0].every(v => v === 0), 'ejected: silence');
  });
  /* ---- W3: two hands, the read above speed, the tone of speed, the brake's
     friction, the throw, the feel, the scripts and their cuts, the slip on the
     beat, the landing ---- */
  // the energy of a windowed block above a frequency, by a plain DFT over the bins that matter (a test, not a hot path)
  const bandEnergy = (x, from, n, sr, fLo) => {
    let e = 0;
    const k0 = Math.ceil(fLo / sr * n);
    for (let k = k0; k < n / 2; k++){
      let re = 0, im = 0;
      for (let i = 0; i < n; i++){
        const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), v = x[from + i] * w, ph = 2 * Math.PI * k * i / n;
        re += v * Math.cos(ph); im -= v * Math.sin(ph);
      }
      e += re * re + im * im;
    }
    return e;
  };
  // the tape run with the context's clock in hand (now = the block's first frame, in seconds)
  const runT = (V, inL, blk, at) => {
    const n = inL.length, outL = new Float32Array(n), outR = new Float32Array(n);
    for (let i = 0; i < n; i += blk){
      if (at) at(i, V.S, i / sr);
      const m = Math.min(blk, n - i), oL = new Float32Array(m), oR = new Float32Array(m);
      S.vinylProcess(V.S, inL.subarray(i, i + m), null, oL, oR, m, i / sr);
      outL.set(oL, i); outR.set(oR, i);
    }
    return { outL, outR };
  };
  test('vinyl: the read above speed is widened — a 15 kHz tone read at 4× folds 20 dB quieter than the plain read', () => {
    const x = new Float32Array(sr * 3);
    for (let i = 0; i < x.length; i++) x[i] = Math.sin(2 * Math.PI * 15000 * i / sr);
    const sweep = air => {
      const V = { S: S.makeVinyl(sr, 4) }; V.S.air = air;
      const { outL } = runT(V, x, 128, (i, st) => {
        if (i === 96000) S.vinylCommand(st, { op: 'engage' });
        if (i === 96128) S.vinylCommand(st, { op: 'hand', v: -4 });   // backwards through two seconds of tape at four times speed
      });
      return outL;
    };
    const plain = sweep(0), widened = sweep(1);
    // the tone folds to 12 kHz in the output: everything above 6 kHz is what should not be there
    const eP = bandEnergy(plain, 100000, 2048, sr, 6000), eW = bandEnergy(widened, 100000, 2048, sr, 6000);
    const dB = 10 * Math.log10(eW / eP);
    assert.ok(eP > 1e-3, 'the plain read folds the tone into the band: ' + eP.toExponential(2));
    assert.ok(dB <= -20, 'the widened read takes it down by ' + (-dB).toFixed(1) + ' dB');
    assert.equal(S.PLATTER.air, 1, 'the table carries the switch, so the module does');
  });
  test('vinyl: the tone follows the speed — open at speed, darker on the slow side, darker still past it', () => {
    assert.equal(S.vinylToneK(1, sr), 1); assert.equal(S.vinylToneK(0.99, sr), 1); assert.equal(S.vinylToneK(1.01, sr), 1);
    const k = ar => S.vinylToneK(ar, sr);
    assert.ok(k(0.1) < k(0.3) && k(0.3) < k(0.6) && k(0.6) < k(0.9) && k(0.9) < 1, 'the slow side darkens with the speed');
    assert.ok(Math.abs(k(0.5) - (1 - Math.exp(-2 * Math.PI * (400 + 0.5 * 20000) / sr))) < 1e-12, 'the legacy brake\'s law: 400 Hz plus 20 kHz per unit of speed');
    assert.ok(k(8) < k(4) && k(4) < k(2) && k(2) < 1, 'the fast side follows the folding top end down');
  });
  test('platter: a brake is friction — the rate falls down a straight line to the crawl, then dies; a shorter brake is a steeper line', () => {
    const P = S.makePlatter(); P.mode = 'brake';
    const at = {};
    let t = 0;
    while (P.mode !== 'stopped' && t < 5){ S.platterStep(P, 1 / 400, null); t += 1 / 400; const k = Math.round(t * 400); if (k === 120 || k === 240 || k === 360) at[k] = P.rate; }
    assert.ok(Math.abs((at[120] - at[240]) - (at[240] - at[360])) < 1e-6, 'the same loss every 0.3 s: ' + (at[120] - at[240]).toFixed(4) + ' vs ' + (at[240] - at[360]).toFixed(4));
    assert.ok(Math.abs((at[120] - at[240]) - 0.3 / S.PLATTER.brakeSec) < 1e-6, 'the line is brakeSec long from 1×');
    assert.ok(t > 1.1 && t < 1.7, 'stopped in ' + t.toFixed(2) + ' s — the line, then the crawl');
    const Q = S.makePlatter(); S.vinylCommand({ platter: Q, engaged: true, written: 100, pos: 50 }, { op: 'brake', sec: 0.6 });
    for (let i = 0; i < 120; i++) S.platterStep(Q, 1 / 400, null);
    assert.ok(Math.abs(Q.rate - 0.5) < 1e-6, 'a 0.6 s brake is at half speed after 0.3 s: ' + Q.rate.toFixed(4));
  });
  test('vinyl: a throw keeps the hand\'s speed — backwards is a backspin the hand sized, forwards runs down to the motor', () => {
    const St = S.makeVinyl(sr, 1); S.vinylCommand(St, { op: 'engage' });
    S.vinylCommand(St, { op: 'throw', v: -3 });
    assert.equal(St.platter.mode, 'backspin'); assert.equal(St.platter.rate, -3);
    S.vinylCommand(St, { op: 'throw', v: 2.5 });
    assert.equal(St.platter.mode, 'throw'); assert.equal(St.platter.rate, 2.5);
    let t = 0, above = 0;
    while (St.platter.mode !== 'motor' && t < 5){ S.platterStep(St.platter, 1 / 200, null); t += 1 / 200; if (St.platter.rate > 1.2) above += 1 / 200; }
    assert.ok(above > 0.15 && t < 2.5 && Math.abs(St.platter.rate - 1) < 0.03, 'ran fast for ' + above.toFixed(2) + ' s and the motor had it by ' + t.toFixed(2) + ' s');
    S.vinylCommand(St, { op: 'throw', v: 40 });
    assert.equal(St.platter.rate, S.PLATTER.maxRate, 'a wild throw is clamped');
    S.vinylCommand(St, { op: 'throw', v: 0 });
    assert.equal(St.platter.rate, S.PLATTER.maxRate, 'a throw of nothing changes nothing');
  });
  test('vinyl: the feel is the hand\'s — a finger\'s spring is tighter than a mouse\'s, and the table\'s stands in', () => {
    const St = S.makeVinyl(sr, 1);
    S.vinylCommand(St, { op: 'feel', lead: 0.010, tau: 0.005 });
    assert.equal(St.handLead, 0.010); assert.equal(St.handTau, 0.005);
    S.vinylCommand(St, { op: 'feel', lead: 0.0001, tau: 99 });
    assert.equal(St.handLead, 0.004); assert.equal(St.handTau, 0.05, 'clamped to a spring that can exist');
    S.vinylCommand(St, { op: 'feel' });
    assert.equal(St.handLead, 0); assert.equal(St.handTau, 0, 'no feel: the table\'s');
    const tight = S.makePlatter(), loose = S.makePlatter();
    for (let i = 0; i < 4; i++){ S.platterStep(tight, 1 / 400, -1, 0.005); S.platterStep(loose, 1 / 400, -1, 0.012); }
    assert.ok(tight.rate < loose.rate, 'after 10 ms the tight spring is nearer the hand: ' + tight.rate.toFixed(3) + ' vs ' + loose.rate.toFixed(3));
    const H = { pos: 0, hand: null, handTo: 480, handLead: 0.010 };
    S.platterHandFollow(H, sr);
    assert.ok(Math.abs(H.hand - 1) < 1e-9, 'a place 10 ms ahead over a 10 ms lead is the motor speed');
  });
  test('vinyl: a script lands its steps where the preset says, within a millisecond, on the clock it was given', () => {
    const x = ramp(sr * 3);
    const V = { S: S.makeVinyl(sr, 4) };
    const p = S.vinylPresetSteps('baby', 0.5);     // 120 bpm: quarter-beat strokes of 90 ms of music, twice
    const marks = {};
    let from = null;
    runT(V, x, 128, (i, st, now) => {
      if (i === 48000) S.vinylCommand(st, { op: 'engage' });
      if (i === 48128) S.vinylCommand(st, { op: 'script', steps: p.steps, loops: p.loops, at: 1.5 });
      if (from == null && st.script && st.script.on) from = st.handFrom;
      for (const t of [1.625, 1.75, 1.875, 2.0]) if (marks[t] == null && now >= t) marks[t] = { pos: st.pos, script: !!st.script, done: st.scriptDone | 0, hand: st.hand };
    });
    assert.ok(from != null, 'the script took the record at its time');
    const ms = v => (v / sr * 1000).toFixed(2) + ' ms';
    assert.ok(Math.abs(marks[1.625].pos - (from - 0.09 * sr)) < 0.001 * sr, 'the back stroke lands 90 ms behind: ' + ms(marks[1.625].pos - from));
    assert.ok(Math.abs(marks[1.75].pos - from) < 0.001 * sr, 'the forward stroke lands home: ' + ms(marks[1.75].pos - from));
    assert.ok(Math.abs(marks[1.875].pos - (from - 0.09 * sr)) < 0.001 * sr, 'the second loop too: ' + ms(marks[1.875].pos - from));
    assert.ok(!marks[2.0].script && marks[2.0].done === 1 && marks[2.0].hand == null, 'two loops later the script is done and the hand has lifted');
    // the controls: no steps is a stop, `finish` lets the loop in hand complete, a late `at` starts now, loops are bounded
    const W = S.makeVinyl(sr, 1); S.vinylCommand(W, { op: 'engage' });
    S.vinylCommand(W, { op: 'script', steps: p.steps, loops: 999, min: 2, at: -1 });
    assert.equal(W.script.loops, 64, 'bounded');
    S.vinylProcess(W, new Float32Array(128), null, new Float32Array(128), new Float32Array(128), 128, 7);
    assert.ok(W.script.on && W.script.t0 === 7, 'no `at`: it starts on the block it lands in');
    S.vinylCommand(W, { op: 'script', finish: true });
    assert.equal(W.script.loops, 2, 'finish: the natural count, since nothing has looped yet');
    S.vinylCommand(W, { op: 'script' });
    assert.equal(W.script, null); assert.equal(W.scriptDone, 1);
    const Z = S.makeVinyl(sr, 1);
    S.vinylCommand(Z, { op: 'script', steps: p.steps });
    assert.equal(Z.script, null, 'a platter not engaged runs no script');
  });
  test('vinyl: the fader\'s cut inside the processor is a 1 ms ramp — no step over 0.02, silence inside the chop, open outside it', () => {
    const x = new Float32Array(sr); x.fill(0.5);
    const V = { S: S.makeVinyl(sr, 2) };
    const steps = [{ dx: 0, dur: 0.05, cut: 1 }, { dx: 0, dur: 0.05, cut: 0 }, { dx: 0, dur: 0.1, cut: [[0.25, 0.5]] }];
    const { outL } = runT(V, x, 128, (i, st) => {
      if (i === 9600) S.vinylCommand(st, { op: 'engage' });
      if (i === 9728) S.vinylCommand(st, { op: 'script', steps, loops: 1, at: 0.25 });
    });
    let worst = 0;
    for (let i = 10000; i < 24000; i++){ const d = Math.abs(outL[i] - outL[i - 1]); if (d > worst) worst = d; }
    assert.ok(worst <= 0.02, 'worst step ' + worst.toFixed(4));
    const at = t => outL[Math.round(t * sr)];
    assert.ok(Math.abs(at(0.24)) > 0.49, 'open before the script: ' + at(0.24).toFixed(3));
    assert.ok(Math.abs(at(0.28)) < 1e-3, 'shut through the first step: ' + at(0.28).toFixed(4));
    assert.ok(Math.abs(at(0.33)) > 0.49, 'open through the second: ' + at(0.33).toFixed(3));
    assert.ok(Math.abs(at(0.36)) > 0.49 && Math.abs(at(0.39)) < 1e-3 && Math.abs(at(0.44)) > 0.49, 'shut for the second quarter of the third, open either side');
    assert.ok(Math.abs(at(0.48)) > 0.49, 'and open once the script is done');
    assert.equal(S.vinylCutSpec(null), 0); assert.equal(S.vinylCutSpec(true), 1); assert.equal(S.vinylCutSpec([[0.1, 0.2]]).length, 2);
    assert.equal(S.vinylCutSpec([[0, 1], 'x', [0.5]]).length, 2, 'a pair that is not a pair is dropped');
    assert.equal(S.vinylCutSpec(Array.from({ length: 12 }, (_, i) => [i / 12, (i + 0.5) / 12])).length, 16, 'at most eight pairs');
  });
  test('vinyl: a slip can wait for the beat — scheduled on the clock, the head goes home in the block that reaches it, and lets go there when asked', () => {
    const x = ramp(sr * 2);
    const V = { S: S.makeVinyl(sr, 4) };
    const seen = {};
    runT(V, x, 128, (i, st, now) => {
      if (i === 24064) S.vinylCommand(st, { op: 'engage' });
      if (i === 24192) S.vinylCommand(st, { op: 'hand', v: 0 });                 // held still: the lag grows
      if (i === 48000) S.vinylCommand(st, { op: 'snap', at: 1.25, release: true });
      for (const t of [1.2, 1.26, 1.3]) if (seen[t] == null && now >= t) seen[t] = { lag: (st.written - st.pos) / sr, engaged: st.engaged, gain: st.gain };
    });
    assert.ok(seen[1.2].lag > 0.6 && seen[1.2].engaged, 'before the line the head is still far back: ' + seen[1.2].lag.toFixed(3) + ' s');
    assert.ok(seen[1.26].lag < 0.01 && !seen[1.26].engaged, 'on the line it is home, and the room is let go of: lag ' + seen[1.26].lag.toFixed(4));
    assert.ok(seen[1.3].gain === 0, 'and faded out by now');
    const W = S.makeVinyl(sr, 1); S.vinylCommand(W, { op: 'engage' }); S.vinylCommand(W, { op: 'hand', v: 0 });
    for (let k = 0; k < 40; k++) S.vinylProcess(W, new Float32Array(128), null, new Float32Array(128), new Float32Array(128), 128, k * 128 / sr);
    S.vinylCommand(W, { op: 'snap', at: 0 });
    assert.ok(W.written - W.pos < 4 && W.engaged, 'no time given: now, and still engaged');
  });
  test('vinyl: taking a platter still fading out crosses out of it — no step at a quick second press', () => {
    const x = ramp(sr * 2);
    const V = { S: S.makeVinyl(sr, 4) };
    const { outL } = runT(V, x, 128, (i, st) => {
      if (i === 24064) S.vinylCommand(st, { op: 'engage' });
      if (i === 24192) S.vinylCommand(st, { op: 'hand', v: 0 });      // held still: the head falls behind
      if (i === 25088) S.vinylCommand(st, { op: 'release' });
      if (i === 25216) S.vinylCommand(st, { op: 'engage' });          // 2.7 ms later, mid-fade
    });
    let worst = 0;
    for (let i = 25100; i < 26000; i++){ const d = Math.abs(outL[i] - outL[i - 1]); if (d > worst) worst = d; }
    assert.ok(worst < 6, 'worst step across the second press ' + worst.toFixed(2) + ' on a ramp of 1 per sample');
  });
  test('vinyl: the presets are the strokes written down, and a let-go record lands on the grid when asked', () => {
    const p = S.vinylPresetSteps('baby', 0.5);
    assert.equal(p.loops, 2); assert.deepEqual(p.steps.map(s => s.dur), [0.125, 0.125]); assert.deepEqual(p.steps.map(s => s.dx), [-0.09, 0.09]);
    assert.equal(S.vinylPresetSteps('nothing', 0.5), null);
    for (const k of ['baby', 'chirp', 'transform', 'stab', 'flare', 'crab']){
      const st = S.VINYL_PRESETS[k].steps;
      assert.ok(st.length && st[0].dx < 0, k + ' pulls back first: the tape holds only the past');
      assert.ok(Math.abs(st.reduce((a, s) => a + s.dx, 0)) < 1e-9, k + ' ends where it began');
    }
    assert.ok(S.vinylPresetSteps('stab', 0).steps[0].dur > 0, 'no tempo: a default beat');
    assert.ok(Math.abs(S.vinylLanding(10.3, 'beat', 0.1, 120, 300) - 10.1) < 1e-9, 'the nearest beat line');
    assert.ok(Math.abs(S.vinylLanding(10.4, 'beat', 0.1, 120, 300) - 10.6) < 1e-9);
    assert.ok(Math.abs(S.vinylLanding(10.3, 'bar', 0.1, 120, 300) - 10.1) < 1e-9, 'the nearest bar line');
    assert.equal(S.vinylLanding(10.3, 'off', 0.1, 120, 300), 10.3);
    assert.equal(S.vinylLanding(10.3, 'beat', 0.1, 0, 300), 10.3, 'no tempo: where it is');
    assert.equal(S.vinylLanding(299.9, 'beat', 0.1, 120, 300), 299.75, 'never off the end');
    assert.ok(Math.abs(S.vinylNextLine(10.3, 'beat', 0.1, 120) - 10.6) < 1e-9);
    assert.ok(Math.abs(S.vinylNextLine(10.6, 'beat', 0.1, 120) - 10.6) < 1e-9, 'a line is its own next line');
    assert.ok(Math.abs(S.vinylNextLine(10.3, 'bar', 0.1, 120) - 12.1) < 1e-9);
    assert.equal(S.vinylNextLine(10.3, 'beat', NaN, 120), 10.3);
  });
  test('song tape: a phone that reports little memory is pressed at 24 kHz, and the module carries what the hands read', () => {
    assert.equal(S.vinylSongRate(180, S.VINYL_SONG_LOW_SR), 24000);
    assert.equal(S.VINYL_SONG_LOW_SR, 24000);
    assert.equal(S.vinylSongRate(180), 32000, 'no cap: the full rate');
    assert.equal(S.vinylSongRate(180, 99000), 32000, 'a cap above the ceiling is the ceiling');
    const src = S.vinylWorkletSource();
    for (const f of ['function vinylReadAir(', 'function vinylToneK(', 'function vinylScriptStep(', 'function vinylScriptBlock(', 'function vinylSnap(', 'gen: S.gen | 0', 'done: this.done'])
      assert.ok(src.includes(f), 'the module carries ' + f);
  });
}

// ---------------------------------------------------------------- syn: the conductor reads ahead
{
  // a four-page script: a quiet intro, a build, a drop (the peak), an outro
  const ST = { ok: true, sections: [
    { s: 0.00, e: 0.20, energy: 0.20, loud: false },
    { s: 0.20, e: 0.45, energy: 0.55, loud: true },
    { s: 0.45, e: 0.80, energy: 0.98, loud: true },
    { s: 0.80, e: 1.00, energy: 0.15, loud: false } ], apex: 0.62, mixIn: 0.2, mixOut: 0.8 };
  const DUR = 200;   // seconds
  test('synSectionAt names the page under the playhead', () => {
    assert.equal(S.synSectionAt(ST, 0.1).label, 'intro');
    assert.equal(S.synSectionAt(ST, 0.3).label, 'build');
    assert.equal(S.synSectionAt(ST, 0.6).label, 'peak');
    assert.equal(S.synSectionAt(ST, 0.9).label, 'outro');
    assert.equal(S.synSectionAt(ST, 0.3).i, 1);
    assert.equal(S.synSectionAt(null, 0.3), null);
    assert.equal(S.synSectionAt({ ok: false }, 0.3), null);
  });
  test('synAhead sees the next page only inside the window, with how soon and how hard', () => {
    // 0.44 → the drop at 0.45 is 2 s away: in the 2.4 s window
    const a = S.synAhead(ST, 0.44, DUR);
    assert.ok(a && a.i === 2 && a.loud && a.drop, 'the drop is coming');
    assert.ok(Math.abs(a.inSec - 2) < 1e-9, 'in two seconds');
    assert.ok(Math.abs(a.rise - 0.43) < 1e-9);
    assert.equal(a.label, 'peak');
    assert.equal(S.synAhead(ST, 0.40, DUR), null, 'ten seconds out is not yet in view');
    assert.equal(S.synAhead(ST, 0.90, DUR), null, 'past the last page there is nothing ahead');
    assert.equal(S.synAhead(ST, 0.44, 0), null, 'no duration, no clock');
    const fall = S.synAhead(ST, 0.795, DUR);
    assert.ok(fall && !fall.loud && fall.rise < 0 && !fall.drop, 'a fall is seen, and is not a drop');
  });
  test('synFeatAhead leans the live read toward the page ahead, one way only', () => {
    const live = { energy: 0.3, beat: 0.2, bass: 0.3, calm: 0.8, entropy: 0.4 };
    const up = S.synFeatAhead(live, { energy: 0.98, loud: true });
    assert.ok(up.energy >= 0.98 && up.beat > 0.9 && up.calm <= 0.021 && up.bass > 0.8, 'a drop coming reads as a drop: ' + JSON.stringify(up));
    assert.equal(up.entropy, 0.4, 'what the page says nothing about is left alone');
    assert.equal(live.energy, 0.3, 'the live read itself is untouched');
    const hot = S.synFeatAhead({ energy: 0.95, beat: 0.9, calm: 0.1 }, { energy: 0.6, loud: true });
    assert.equal(hot.energy, 0.95, 'a loud page never lowers a hotter live read');
    const down = S.synFeatAhead({ energy: 0.9, beat: 0.9, calm: 0.1 }, { energy: 0.15, loud: false });
    assert.ok(down.energy <= 0.25 && down.calm >= 0.85 && down.beat <= 0.4, 'a break coming reads as a break');
    assert.deepEqual(S.synFeatAhead(live, null), live);
  });
  test('synCue fires so the change LANDS on the drop: a cut on a strong rise, a morph on a gentle one, nothing on a fall', () => {
    const drop = { i: 2, inSec: 2.0, rise: 0.43, loud: true };
    let c = S.synCue({ ahead: drop });
    assert.ok(!c.fire && c.kind === 'cut' && Math.abs(c.wait - (2 - S.SYN_TUNING.cutDur)) < 1e-9, 'too early: waits');
    c = S.synCue({ ahead: { ...drop, inSec: S.SYN_TUNING.cutDur } });
    assert.ok(c.fire && c.big && c.kind === 'cut' && c.dur <= S.SYN_TUNING.cutDur + 0.001, 'fires with the cut sized to land on the one');
    c = S.synCue({ ahead: { ...drop, inSec: 0.3 } });
    assert.ok(c.fire && c.dur >= 0.2 && c.dur <= 0.33, 'late: a shorter cut still lands');
    c = S.synCue({ ahead: { i: 1, inSec: 1.3, rise: 0.35, loud: true } });
    assert.ok(c.fire && c.kind === 'morph' && c.dur <= S.SYN_TUNING.morphDur, 'a gentle rise morphs');
    assert.ok(!S.synCue({ ahead: { i: 3, inSec: 0.5, rise: -0.8, loud: false } }).fire, 'a fall is the boundary\'s own');
    assert.ok(!S.synCue({ ahead: { ...drop, inSec: 0.3 }, reduced: true }).fire, 'reduced motion: the conductor stands down');
    assert.ok(!S.synCue({}).fire && !S.synCue(null).fire);
    // a slow renderer's frame is landing early, never late — and it is bounded
    const slow = S.synCue({ ahead: { ...drop, inSec: S.SYN_TUNING.cutDur + 0.08 }, frame: 0.1 });
    assert.ok(slow.fire, 'a frame of slack is allowed');
    assert.ok(!S.synCue({ ahead: { ...drop, inSec: S.SYN_TUNING.cutDur + 0.2 }, frame: 5 }).fire, 'but no more than a tenth of a second');
  });
  test('synSeamGlide sizes the light\'s glide to the blend', () => {
    assert.equal(S.synSeamGlide({ type: 'beatmix' }, 7.7), 7.7);
    assert.equal(S.synSeamGlide({ type: 'beatmix' }, 1), 2, 'never shorter than a lighting cue');
    assert.ok(Math.abs(S.synSeamGlide({ type: 'fade' }, 5) - 4) < 1e-9);
    assert.equal(S.synSeamGlide({ type: 'gapless' }, 0.06), 2);
    assert.equal(S.synSeamGlide(null, 9), 2);
  });
  test('synKeyTerm: the harmony as a distance — nothing for an unknown key, little for a neighbour, a lot for a clash', () => {
    assert.equal(S.synKeyTerm('8A', '8A'), 0);
    assert.equal(S.synKeyTerm('8A', '8B'), 0.04);
    assert.equal(S.synKeyTerm('8A', '9A'), 0.08);
    assert.equal(S.synKeyTerm('8A', '9B'), 0.18);
    assert.equal(S.synKeyTerm('8A', '2A'), 0.3);
    assert.equal(S.synKeyTerm(null, '8A'), 0);
    assert.equal(S.synKeyTerm('8A', undefined), 0);
    // …and the journey hears it: between two otherwise identical tracks the harmonic one is dealt
    const F = { energy: 0.5, brightness: 0.5, entropy: 0.5, onsets: 0.5, bpm: 120 };
    const tracks = [
      { id: 'from', duration: 200, features: { ...F, key: '8A' } },
      { id: 'clash', duration: 200, features: { ...F, key: '2A' } },
      { id: 'near', duration: 200, features: { ...F, key: '9A' } },
    ];
    const r = S.dealJourney({ tracks, fromId: 'from', heat: 0, targetCount: 2, rng: () => 0.5 });
    assert.deepEqual(r.order, ['from', 'near'], 'the neighbouring key follows');
    const q = S.quantumStep({ tracks: tracks.slice(1), currentFeat: tracks[0].features, heat: 0.1, rng: () => 0.5, usedIds: new Set() });
    assert.ok(q.probs[0].id === 'near' && q.probs[0].p > q.probs[1].p * 2, 'quantum leans the same way: ' + JSON.stringify(q.probs));
  });
  test('synDealSeed: the same song at the same place throws the same die; another place, another die', () => {
    const a = S.synDealSeed('abc123', 2), b = S.synDealSeed('abc123', 2), c = S.synDealSeed('abc123', 3), d = S.synDealSeed('zzz', 2);
    assert.equal(a, b);
    assert.ok(a !== c && a !== d);
    for (const v of [a, c, d, S.synDealSeed(null, 0), S.synDealSeed('', 99)]) assert.ok(v >= 0 && v < 1);
  });
}

// ---- mid-track stability: liveness, the buffer under the playhead, the paced warm, the two-stage warm ----
test('watchdogStep: a tight loop with the clock ticking is never reloaded (liveness from timeupdate)', () => {
  /* a 1/8-beat pad at 128 BPM is a 59 ms loop: every 1 Hz position sample
     lands inside the 40 ms "moved" window, the file is fully buffered so
     nothing grows, and seven such looks used to earn the pad a reload */
  const s = wdState();
  const v = wdRun(s, Array.from({ length: 40 }, (_, k) => ({ t: 50 + (k % 2) * 0.03, buf: 200, rs: 4, moved: true })));
  assert.ok(v.every(x => x === 'ok'), 'ticking timeupdates are motion: ' + v.join(','));
  // and the same frames WITHOUT the override still read as frozen — the delta path is the fallback
  const s2 = wdState();
  const w = wdRun(s2, Array.from({ length: 8 }, (_, k) => ({ t: 50 + (k % 2) * 0.03, buf: 200, rs: 4 })));
  assert.equal(w[7], 'reload', 'the delta-only path is unchanged for callers that do not count ticks');
});
test('watchdogStep: a false "moved" cannot hide a starved stream, a true one cannot be overridden by the delta', () => {
  const s = wdState();
  wdRun(s, [{ t: 91, buf: 91, rs: 4 }]);
  const v = wdRun(s, Array.from({ length: S.STARVE_RELOAD_S }, () => ({ t: 91, buf: 91, rs: 2, moved: false })));
  assert.equal(v[v.length - 1], 'reseek');
  const s2 = wdState();
  wdRun(s2, [{ t: 10, buf: 30, rs: 4 }]);
  assert.equal(wdRun(s2, [{ t: 10, buf: 30, rs: 4, moved: true }])[0], 'ok');
});
test('bufferedEndAt: the range under the playhead, not the last island', () => {
  assert.equal(S.bufferedEndAt([[0, 30], [100, 140]], 10), 30);
  assert.equal(S.bufferedEndAt([[0, 30], [100, 140]], 120), 140);
  assert.equal(S.bufferedEndAt([[0, 30], [100, 140]], 60), 0, 'in a hole: nothing ahead of the playhead yet');
  assert.equal(S.bufferedEndAt([[0, 30], [100, 140]], 30.01), 30, 'the edge is within tolerance');
  assert.equal(S.bufferedEndAt([], 5), 0);
  assert.equal(S.bufferedEndAt(null, 5), 0);
});
test('bufferedEndAt + watchdogStep: a scrub into a hole on a slow pipe is a filling buffer, never a reload', () => {
  /* ranges [[0,30],[100,140]], the listener scrubbed to 60: the browser fills
     a NEW range around the playhead while the old tail sits at 140. Read by
     the last range the buffer "never grew" and twelve seconds later a healthy
     download was reloaded; read under the playhead it is plainly growing. */
  const frames = [[[0, 30], [100, 140]]];
  // the ranged request starts at the seek point, so the new island grows from the playhead outward
  for (let k = 1; k <= 14; k++) frames.push([[0, 30], [59.9, 59.9 + k * 1.5], [100, 140]]);
  const s = wdState(), old = wdState();
  wdRun(s, [{ t: 59.9, buf: 30, rs: 4 }]); wdRun(old, [{ t: 59.9, buf: 30, rs: 4 }]);
  const v = frames.map(r => S.watchdogStep(s, { t: 60, buf: S.bufferedEndAt(r, 60), rs: 2, played: true, online: true }));
  const w = frames.map(r => S.watchdogStep(old, { t: 60, buf: r[r.length - 1][1], rs: 2, played: true, online: true }));
  assert.ok(v.slice(1).every(x => x === 'ok'), 'growth under the playhead is a slow pipe: ' + v.join(','));
  assert.ok(w.includes('reseek'), 'the last-range read is what used to heal a healthy stream: ' + w.join(','));
});
test('prefetchMayRun: the warm takes the pipe only when the deck can spare it', () => {
  assert.equal(S.prefetchMayRun({ bufAhead: 30, readyState: 3, left: 120 }), true, 'ahead enough');
  assert.equal(S.prefetchMayRun({ bufAhead: 8, readyState: 3, left: 120 }), false, 'the deck needs the pipe more');
  assert.equal(S.prefetchMayRun({ bufAhead: 8, readyState: 4, left: 120 }), true, 'the browser promises play-through');
  assert.equal(S.prefetchMayRun({ bufAhead: 8, readyState: 3, left: 8.2 }), true, 'the rest of the song is in hand');
  assert.equal(S.prefetchMayRun({ bufAhead: 30, readyState: 4, left: 120, waiting: true }), false, 'a waiting element holds the warm outright');
  assert.equal(S.prefetchMayRun({ bufAhead: 22, readyState: 3, left: 120, need: 25 }), false, 'between chunks the bar is higher');
  assert.equal(S.prefetchMayRun({ bufAhead: 22, readyState: 3, left: 120, need: 20 }), true, 'at the start it is PREFETCH_AHEAD_S');
  assert.equal(S.PREFETCH_AHEAD_S, 20);
  assert.equal(S.prefetchMayRun({}), false, 'nothing known about the deck: hold');
});
test('seamWarmDue: deck B takes the pipe once A is done with it, or when the exit is in reach', () => {
  assert.equal(S.seamWarmDue({ aDone: true, exitIn: 85, seconds: 16 }), true, 'A fully buffered: warm now');
  assert.equal(S.seamWarmDue({ aDone: false, exitIn: 85, seconds: 16 }), false, 'A still filling, exit far: headers only');
  assert.equal(S.seamWarmDue({ aDone: false, exitIn: 19, seconds: 4 }), true, 'inside the floor');
  assert.equal(S.seamWarmDue({ aDone: false, exitIn: 25, seconds: 16 }), true, 'a long seam needs its length plus ten');
  assert.equal(S.seamWarmDue({ aDone: false, exitIn: 27, seconds: 16 }), false);
  assert.equal(S.seamWarmDue({ aDone: false, exitIn: NaN }), false);
  assert.equal(S.seamWarmDue(null), false);
  assert.equal(S.SEAM_WARM_S, 20);
});

// ---- the crossfader's law (@xfader): the gain curves, the two maps, the arbiter, SYNC's rate, the idle stop ----
test('xfaderGains power: constant acoustic power at every handle position, full at the ends', () => {
  for (let i = 0; i <= 40; i++){
    const x = i / 40, [a, b] = S.xfaderGains(x, 'power');
    assert.ok(Math.abs(a * a + b * b - 1) < 1e-9, `a²+b²==1 at x=${x}`);
    assert.ok(a >= 0 && b >= 0);
  }
  assert.deepEqual(S.xfaderGains(0, 'power'), [1, 0]);
  assert.ok(S.xfaderGains(1, 'power')[0] < 1e-9 && Math.abs(S.xfaderGains(1, 'power')[1] - 1) < 1e-9);
  assert.deepEqual(S.xfaderGains(-3, 'power'), S.xfaderGains(0, 'power'), 'clamps below');
  assert.deepEqual(S.xfaderGains(7, 'power'), S.xfaderGains(1, 'power'), 'clamps above');
  assert.deepEqual(S.xfaderGains(0.3), S.xfaderGains(0.3, 'power'), 'power is the default law');
});
test('xfaderGains cut: full to the edge, nothing past the far edge, continuous, mirrored', () => {
  const e = S.XFADER_CUT_EDGE;
  assert.equal(e, 0.03);
  for (const x of [0, 0.01, 0.02, 0.03]) assert.equal(S.xfaderGains(x, 'cut')[0], 1, 'A full at ' + x);
  for (const x of [0.97, 0.98, 0.99, 1]) assert.equal(S.xfaderGains(x, 'cut')[0], 0, 'A gone at ' + x);
  for (const x of [0, 0.03]) assert.equal(S.xfaderGains(x, 'cut')[1], 0);
  for (const x of [0.97, 1]) assert.equal(S.xfaderGains(x, 'cut')[1], 1);
  let prev = S.xfaderGains(0, 'cut'), maxStep = 0;
  for (let i = 1; i <= 1000; i++){
    const g = S.xfaderGains(i / 1000, 'cut');
    maxStep = Math.max(maxStep, Math.abs(g[0] - prev[0]), Math.abs(g[1] - prev[1]));
    assert.ok(g[0] <= prev[0] + 1e-12 && g[1] >= prev[1] - 1e-12, 'monotone');
    prev = g;
  }
  assert.ok(maxStep < 0.004, 'a cut is never a click: max step ' + maxStep);
  for (let i = 0; i <= 20; i++){
    const x = i / 20, g = S.xfaderGains(x, 'cut'), m = S.xfaderGains(1 - x, 'cut');
    assert.ok(Math.abs(g[0] - m[1]) < 1e-12 && Math.abs(g[1] - m[0]) < 1e-12, 'mirrored at ' + x);
  }
  const mid = S.xfaderGains(0.5, 'cut');
  assert.ok(Math.abs(mid[0] - mid[1]) < 1e-12 && Math.abs(mid[0] * mid[0] + mid[1] * mid[1] - 1) < 1e-9, 'equal power through the middle');
});
test('xfaderPosFromGains inverts the power law; xfaderPosFromSeam maps both slots and is its own inverse', () => {
  for (let i = 0; i <= 20; i++){
    const x = i / 20, [a, b] = S.xfaderGains(x, 'power');
    assert.ok(Math.abs(S.xfaderPosFromGains(a, b) - x) < 1e-9, 'round trip at ' + x);
  }
  assert.equal(S.xfaderPosFromGains(0, 0), 0, 'silence reads as A');
  assert.equal(S.xfaderPosFromGains(0.5, 0), 0); assert.equal(S.xfaderPosFromGains(0, 0.2), 1);
  for (const f of [0, 0.25, 0.5, 1]){
    assert.equal(S.xfaderPosFromSeam(f, 0), f, 'A leaving: the handle walks A→B');
    assert.equal(S.xfaderPosFromSeam(f, 1), 1 - f, 'B leaving: the handle walks B→A');
    assert.equal(S.xfaderPosFromSeam(S.xfaderPosFromSeam(f, 1), 1), f, 'an involution');
  }
  assert.equal(S.xfaderPosFromSeam(2, 0), 1); assert.equal(S.xfaderPosFromSeam(-1, 1), 1);
});
test('xfaderArbiter: commit at the far end, abort a yielded seam at the near end, hold mid-way, none under a hand', () => {
  const st = o => Object.assign({ phase: 'idle', hand: false, x: 0, outSlot: 0, inSlot: 1 }, o);
  assert.deepEqual(S.xfaderArbiter(st({ x: 1 })), { act: 'commit', slot: 1 });
  assert.deepEqual(S.xfaderArbiter(st({ x: 0.98 })), { act: 'commit', slot: 1 }, 'within the park tolerance');
  assert.deepEqual(S.xfaderArbiter(st({ x: 0, outSlot: 1, inSlot: 0 })), { act: 'commit', slot: 0 }, 'B on air: the far end is A');
  assert.deepEqual(S.xfaderArbiter(st({ x: 0.5 })), { act: 'hold', slot: -1 }, 'mid-way: the DJ is mid-mix');
  assert.deepEqual(S.xfaderArbiter(st({ x: 0.96 })), { act: 'hold', slot: -1 }, 'just short of the end is still a hold');
  assert.deepEqual(S.xfaderArbiter(st({ x: 0.01 })), { act: 'none', slot: 0 }, 'back at the on-air end with nothing to undo');
  assert.deepEqual(S.xfaderArbiter(st({ phase: 'manual', x: 0.02 })), { act: 'abort', slot: 0 }, 'a yielded seam pulled home is undone');
  assert.deepEqual(S.xfaderArbiter(st({ phase: 'manual', x: 1 })), { act: 'commit', slot: 1 }, 'a yielded seam pushed across commits');
  assert.deepEqual(S.xfaderArbiter(st({ phase: 'manual', x: 0.5 })), { act: 'hold', slot: -1 });
  assert.deepEqual(S.xfaderArbiter(st({ hand: true, x: 1 })), { act: 'none', slot: -1 }, 'a hand still holding decides nothing');
  assert.deepEqual(S.xfaderArbiter(st({ hand: true, x: 0.4, aEnded: true })), { act: 'commit', slot: 1 }, 'the outgoing record ended: the incoming takes the air, hand or no hand');
  assert.deepEqual(S.xfaderArbiter(st({ phase: 'manual', x: 0.6, bEnded: true })), { act: 'abort', slot: 0 }, 'the incoming ended under a yielded seam: undone');
  assert.deepEqual(S.xfaderArbiter(st({ x: 0.6, bEnded: true })), { act: 'none', slot: 0 }, '…and with no seam there is nothing to commit');
  assert.deepEqual(S.xfaderArbiter(st({ x: 0.9, parkAt: 0.12 })), { act: 'commit', slot: 1 }, 'the park tolerance is the caller\'s');
  assert.equal(S.xfaderArbiter(null).act, 'none');
  assert.equal(S.XFADER_PARK, 0.03);
});
test('syncRateFor folds the tempo ratio: half-time is 1×, a near tempo is the plain ratio', () => {
  assert.ok(Math.abs(S.syncRateFor(124, 62) - 1) < 1e-9, '62 under 124 is half-time');
  assert.ok(Math.abs(S.syncRateFor(62, 124) - 1) < 1e-9);
  assert.ok(Math.abs(S.syncRateFor(128, 126) - 128 / 126) < 1e-9);
  assert.ok(Math.abs(S.syncRateFor(126, 128) - 126 / 128) < 1e-9);
  assert.ok(Math.abs(S.syncRateFor(100, 70) - 100 / 140) < 1e-9, '70 under 100 is half of 140');
  assert.equal(S.syncRateFor(0, 120), 1); assert.equal(S.syncRateFor(120, NaN), 1);
  assert.ok(Math.abs(S.syncRateFor(124, 126) - S.glideRates(124, 126, 0).rateB) < 1e-9, 'the rate a seam starts B on');
});
test('faderIdleStop: twenty silent seconds off air, no hand, no cue held — and not a second sooner', () => {
  const base = { gain: 0, silentFor: 20, onAir: false, hand: false, cueHeld: false };
  assert.equal(S.FADER_IDLE_S, 20);
  assert.equal(S.faderIdleStop(base), true);
  assert.equal(S.faderIdleStop({ ...base, silentFor: 19.9 }), false);
  assert.equal(S.faderIdleStop({ ...base, gain: 0.02 }), false, 'audible, however faintly');
  assert.equal(S.faderIdleStop({ ...base, gain: 0.009 }), true);
  assert.equal(S.faderIdleStop({ ...base, onAir: true }), false, 'the record on air is never stopped by this');
  assert.equal(S.faderIdleStop({ ...base, hand: true }), false, 'a hand on the handle holds it');
  assert.equal(S.faderIdleStop({ ...base, cueHeld: true }), false, 'a cue held is a hand on the deck');
  assert.equal(S.faderIdleStop({ ...base, silentFor: 2, after: 1.5 }), true, 'a test\'s shorter clock');
  assert.equal(S.faderIdleStop(null), false);
});
test('xfaderHeld: home is the on-air end, whichever slot — the far end is the DJ\'s, not the auto-DJ\'s', () => {
  assert.equal(S.XFADER_HOME, 0.02);
  assert.equal(S.xfaderHeld(false, 0, 0), false, 'A on air, the handle at A: home');
  assert.equal(S.xfaderHeld(false, 1, 1), false, 'B on air, the handle at B: home');
  assert.equal(S.xfaderHeld(false, 0.015, 0), false, 'inside the home tolerance');
  assert.equal(S.xfaderHeld(false, 0.985, 1), false);
  assert.equal(S.xfaderHeld(false, 0.5, 0), true, 'parked mid-way');
  assert.equal(S.xfaderHeld(false, 1, 0), true, 'R4: left at the IDLE end — the record on air is silenced, the auto-DJ must not arm');
  assert.equal(S.xfaderHeld(false, 0, 1), true, '…and mirrored with B on air');
  assert.equal(S.xfaderHeld(false, 0.99, 0), true, 'the old mid-rail test let 0.98–1 through as home');
  assert.equal(S.xfaderHeld(true, 0, 0), true, 'a hand on it is held wherever it is');
  assert.equal(S.xfaderHeld(false, NaN, 1), false, 'an unknown position reads as home');
  assert.equal(S.xfaderHeld(false, 7, 1), false, 'clamped');
});
test('xfaderAutoTo: AUTO goes home unless a rolling record waits at the nearer far end', () => {
  const st = o => Object.assign({ manual: false, x: 0, active: 0, farRolling: true }, o);
  assert.equal(S.xfaderAutoTo(st({ x: 0.3 })), 0, 'nearer home: home');
  assert.equal(S.xfaderAutoTo(st({ x: 0.7 })), 1, 'nearer the rolling far record: it commits');
  assert.equal(S.xfaderAutoTo(st({ x: 0.5 })), 0, 'the middle is home\'s');
  assert.equal(S.xfaderAutoTo(st({ x: 1, farRolling: false })), 0, 'R11: at the far end with nothing rolling there, AUTO brings the record on air back');
  assert.equal(S.xfaderAutoTo(st({ x: 0.8, farRolling: false })), 0);
  assert.equal(S.xfaderAutoTo(st({ x: 0.9, manual: true })), 0, 'a yielded seam always glides to the record on air');
  assert.equal(S.xfaderAutoTo(st({ x: 0.2, active: 1 })), 0, 'B on air: the far end is A');
  assert.equal(S.xfaderAutoTo(st({ x: 0, active: 1, farRolling: false })), 1, '…and home is B');
  assert.equal(S.xfaderAutoTo(null), 0);
});
test('xfaderCancelMode: a parked hand blend survives the mixer stepping aside; a skip keeps the faders; the rest come home', () => {
  for (const r of ['off', 'replan', 'mixset', 'repeat']) assert.equal(S.xfaderCancelMode('manual', r, true), 'hand', 'R6: ' + r + ' hands the blend over');
  assert.equal(S.xfaderCancelMode('manual', 'off', false), 'home', 'an outgoing record that is not rolling has nothing to hand over');
  assert.equal(S.xfaderCancelMode('manual', 'manual', true), 'stay', 'R30: a track change out of a held blend leaves the faders where the hand had them');
  assert.equal(S.xfaderCancelMode('manual', 'manual', false), 'stay');
  for (const r of ['stopped', 'abort', 'direct', 'route', 'now', 'hand', undefined]) assert.equal(S.xfaderCancelMode('manual', r, true), 'home', String(r) + ' tears the seam down');
  for (const ph of ['running', 'armed', 'idle']) assert.equal(S.xfaderCancelMode(ph, 'off', true), 'home', ph + ' is the mixer\'s own, never the hand\'s');
  assert.equal(S.xfaderCancelMode('running', 'manual', true), 'home');
  assert.ok(S.XFADER_STEP_ASIDE.includes('replan') && !S.XFADER_STEP_ASIDE.includes('manual'));
});
test('planMixNow startB: a hand-cued incoming enters from its cue, snapped to its own beat', () => {
  const mk = key => ({ bpm: 124, grid: 1.0, mixable: 0.9, key, in: { start: 32.0, beats: 32 }, out: { start: 200, beats: 32 } });
  const A = mk('8A'), B = mk('9A'), spb = 60 / 124;
  const plain = S.planMixNow(A, B, 33.33, { durA: 240 });
  assert.equal(plain.startB, 32, 'no cue: the mix-in start');
  const cued = S.planMixNow(A, B, 33.33, { durA: 240, startB: 1.0 + 17 * spb + 0.1 });
  assert.ok(Math.abs(cued.startB - (1.0 + 17 * spb)) < 1e-3, 'the cue, on its nearest beat line: ' + cued.startB);
  assert.equal(S.planMixNow(A, B, 33.33, { durA: 240, startB: NaN }).startB, 32, 'an unusable cue falls back');
  assert.equal(S.planMixNow(A, B, 33.33, { durA: 240, startB: -5 }).startB, 0, 'never before the top of the file');
});

// ---- PACING: let the rooms develop and change with the music (W6) ----
// The pure governor every automatic room change answers to, the dwell in
// phrases, the drop/major/minor page classifier, the rate-limited stem cut,
// the phrase-aware surge, transitions in bars, the mid-dwell develop plan —
// and the tvOS twins, read out of the Swift source so both stages pace alike.
test('paceGate: a minimum gap in bars by act, floored in seconds — no two changes one cut apart', () => {
  const g = S.paceGate({ since: 1, act: 2, barLen: 1.9 });
  assert.equal(g.ok, false, 'one second after a change is too soon, even at the apex');
  assert.ok(Math.abs(g.gap - 6) < 1e-9, 'two bars at 126 BPM (3.8 s) is under the 6-s floor: the floor holds');
  assert.ok(Math.abs(g.wait - 5) < 1e-9, 'and the caller is told how long');
  assert.equal(S.paceGate({ since: 6.1, act: 2, barLen: 1.9 }).ok, true);
  const calm = S.paceGate({ since: 10, act: 0, barLen: 1.9 });
  assert.equal(calm.ok, false); assert.ok(Math.abs(calm.gap - 15.2) < 1e-9, 'the overture holds a whole phrase (8 bars)');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 1, barLen: 1.9 }).gap - 7.6) < 1e-9, 'rising: half a phrase');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 3, barLen: 1.9 }).gap - 7.6) < 1e-9, 'the turn: half a phrase');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 4, barLen: 1.9 }).gap - 15.2) < 1e-9, 'the resolve: a phrase');
  assert.equal(S.paceGate({ since: 3, act: 0, barLen: 1.9, kind: 'seam' }).ok, true, 'the mixer\'s seam IS the boundary: only the hard floor');
  assert.equal(S.paceGate({ since: 2.9, act: 0, barLen: 1.9, kind: 'seam' }).ok, false, '…but the floor is a floor');
  const drop = S.paceGate({ since: 4, act: 0, barLen: 1.9, kind: 'drop' });
  assert.equal(drop.ok, true); assert.ok(Math.abs(drop.gap - 3.8) < 1e-9, 'a classified drop may come after two bars, whatever the act');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 2, barLen: 1.0, kind: 'drop' }).gap - 3) < 1e-9, 'never inside the hard floor');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 1, barLen: 1.9, kind: 'idle' }).gap - 60) < 1e-9, 'the idle gallery waits a minute');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 2, barLen: 1.9, reduced: true }).gap - 9) < 1e-9, 'reduced motion widens every gap by half');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 2, barLen: 1.9, kind: 'seam', reduced: true }).gap - 3) < 1e-9, '…except the seam');
  assert.equal(S.paceGate({ act: 2, barLen: 1.9 }).ok, true, 'no clock at all (the first room) passes');
  assert.ok(Math.abs(S.paceGate({ since: 0, barLen: 0 }).gap - 8) < 1e-9, 'no act, no grid: act 1 at a two-second bar');
  assert.ok(Math.abs(S.paceGate({ since: 0, act: 9, barLen: 2 }).gap - 16) < 1e-9, 'an act past the arc reads as the last');
  assert.deepEqual(S.PACE.minGapBars, [8, 4, 2, 4, 8]);
  assert.equal(S.PACE.minGapSec, 6); assert.equal(S.PACE.hardFloorSec, 3); assert.equal(S.PACE.idleDwell, 90);
});
test('roomDwell: 24–64 s by energy, floored at 14, half as long again under reduced motion', () => {
  assert.deepEqual(S.ROOM_DWELL, { min: 24, max: 64, floor: 14 });
  assert.ok(Math.abs(S.roomDwell({ mood: 'drive', energy: 0.7 }) - 36) < 1e-9, '64 − 40 × 0.7 = 36 s');
  assert.ok(Math.abs(S.roomDwell({ mood: 'drive', energy: 0.7, reduced: true }) - 54) < 1e-9, '× 1.5 reduced');
  assert.ok(Math.abs(S.roomDwell({ mood: 'apex', energy: 1, ceil: 1 }) - Math.max(14, 24 * 0.8)) < 1e-9, 'apex at full energy: 19.2 s, above the floor');
  assert.equal(S.MOODS.adrift.dwell, 1.5); assert.equal(S.MOODS.ascend.dwell, 0.95); assert.equal(S.MOODS.drive.dwell, 1.0);
  assert.equal(S.MOODS.apex.dwell, 0.8); assert.equal(S.MOODS.swarm.dwell, 0.9); assert.equal(S.MOODS.dissolve.dwell, 1.6);
  const a0 = html.indexOf('const ACTS = ['), acts = html.slice(a0, html.indexOf('];', a0));
  const dwell = [...acts.matchAll(/\bdwell: (\d+\.\d+)/g)].map(m => +m[1]);
  assert.deepEqual(dwell, [1.6, 1.0, 0.8, 0.95, 1.7], 'ACTS.dwell: the edges linger, the apex presses but never collapses');
  assert.ok(!/\b(minDwell|maxDwell): \d/.test(html), 'the dead director fields are gone (SEAM_SCENE.minDwellGapless is another thing)');
});
test('roomDwellBars: a dwell is a whole number of phrases, never fewer than two', () => {
  const bar = 60 / 126 * 4, phrase = 8 * bar;
  const apex = S.roomDwellBars({ mood: 'apex', energy: 0.7, ceil: 1, actDwell: 0.8, barLen: bar });
  assert.ok(Math.abs(apex - 2 * phrase) < 1e-9, `the apex at 126 BPM: 36 × 0.8 × 0.8 ≈ 23 s rounds up to two phrases (${(2 * phrase).toFixed(1)} s)`);
  const rising = S.roomDwellBars({ mood: 'drive', energy: 0.7, ceil: 1, actDwell: 1.0, barLen: bar });
  assert.ok(Math.abs(rising - 2 * phrase) < 1e-9, 'rising at e 0.7: 36 s → two phrases');
  const overture = S.roomDwellBars({ mood: 'adrift', energy: 0.25, ceil: 0.4, actDwell: 1.6, barLen: bar });
  assert.ok(overture >= 8 * phrase, 'an overture adrift is left alone for many phrases: ' + overture.toFixed(1));
  for (const o of [apex, rising, overture]) assert.ok(Math.abs(o / phrase - Math.round(o / phrase)) < 1e-9, 'whole phrases');
  assert.ok(Math.abs(S.roomDwellBars({ mood: 'apex', energy: 1, ceil: 1, actDwell: 0.8 }) - 32) < 1e-9, 'no grid: two 16-s phrases is the floor');
  assert.ok(S.roomDwellBars({ mood: 'drive', energy: 0.5, barLen: bar, reduced: true }) > S.roomDwellBars({ mood: 'drive', energy: 0.5, barLen: bar }), 'reduced motion dwells longer');
});
test('sectionChangeClass: a drop, a major turn, a minor nudge, or no page at all', () => {
  assert.equal(S.sectionChangeClass({ energy: 0.6, loud: true }, { energy: 0.7, loud: true }), 'minor', 'a 0.10 wobble loud→loud is minor');
  assert.equal(S.sectionChangeClass({ energy: 0.7, loud: true }, { energy: 0.5, loud: false }), 'major', 'a fall into a break is major (a melt, not nothing)');
  assert.equal(S.sectionChangeClass({ energy: 0.3, loud: false }, { energy: 0.6, loud: true }), 'drop', 'a 0.30 rise into a loud page is the drop');
  assert.equal(S.sectionChangeClass({ energy: 0.3, loud: false }, { energy: 0.6, loud: false }), 'major', 'the same rise into a quiet page is only major');
  assert.equal(S.sectionChangeClass({ energy: 0.9, loud: true }, { energy: 0.65, loud: true }), 'major', 'a 0.25 fall loud→loud is major');
  assert.equal(S.sectionChangeClass(null, { energy: 0.6, loud: true }), 'none');
  assert.equal(S.sectionChangeClass({ energy: 0.6, loud: true }, undefined), 'none');
  assert.deepEqual(S.SECTION_CHANGE, { major: 0.22, drop: 0.28 });
  assert.equal(S.SECTION_CHANGE.drop, S.SYN_TUNING.dropRise, 'the drop threshold is the conductor\'s own');
});
test('surgeShouldRequest: a real surge, two phrases in, under a hot ceiling, with no loud page already coming', () => {
  const ok = { auto: true, phase: 'peak', ratio: 1.7, since: 31, barLen: 1.9, ceil: 0.9, aheadLoud: false };
  assert.equal(S.surgeShouldRequest(ok), true);
  assert.equal(S.surgeShouldRequest({ ...ok, ratio: 1.4, since: 10 }), false, 'a crash cymbal six seconds in is not a surge');
  assert.equal(S.surgeShouldRequest({ ...ok, ratio: 1.59 }), false, 'the ratio is 1.6');
  assert.equal(S.surgeShouldRequest({ ...ok, since: 30 }), false, 'two phrases at 126 BPM is 30.4 s');
  assert.equal(S.surgeShouldRequest({ ...ok, ceil: 0.6 }), false, 'a section the structure holds back does not surge');
  assert.equal(S.surgeShouldRequest({ ...ok, aheadLoud: true }), false, 'the conductor owns the drop ahead');
  assert.equal(S.surgeShouldRequest({ ...ok, phase: 'flow' }), false);
  assert.equal(S.surgeShouldRequest({ ...ok, auto: false }), false);
  assert.equal(S.surgeShouldRequest(null), false);
  assert.deepEqual(S.SURGE, { ratio: 1.6, minPhrases: 2, minCeil: 0.7 });
});
test('segue style: the lengths are BARS — the same musical length at every tempo, with floors and a ceiling', () => {
  const b126 = 60 / 126 * 4, b90 = 60 / 90 * 4;
  const cut = S.segueStyle({ act: 2, energy: 0.8, barLen: b126 });
  assert.equal(cut.kind, 'cut'); assert.ok(Math.abs(cut.dur - 0.25 * b126) < 1e-9, 'a quarter bar at 126 BPM ≈ 0.48 s');
  assert.ok(Math.abs(S.segueStyle({ act: 2, energy: 0.8, barLen: 1.0 }).dur - 0.35) < 1e-9, 'a cut is never under 0.35 s');
  assert.ok(Math.abs(S.segueStyle({ act: 1, energy: 0.5, big: true, barLen: b126 }).dur - b126) < 1e-9, 'a morph is one bar');
  assert.ok(Math.abs(S.segueStyle({ act: 0, energy: 0.5, barLen: b126 }).dur - 2 * b126) < 1e-9, 'a melt is two bars');
  assert.ok(Math.abs(S.segueStyle({ act: 4, energy: 0.5, barLen: b90 }).dur - 2 * b90) < 1e-9, '…and longer at 90 BPM (5.3 s)');
  assert.equal(S.segueStyle({ act: 4, energy: 0.5, barLen: 5 }).dur, 8, 'nothing runs past 8 s');
  assert.ok(Math.abs(S.segueStyle({ act: 1, energy: 0.75, barLen: b126 }).dur - (1.6 - 0.8 * 0.75) * b126) < 1e-9, 'a running dissolve: a bar that quickens with the heat');
  assert.equal(S.segueStyle({ act: 2, energy: 0.8 }).dur, 0.5, 'no grid: a two-second bar');
  const r = S.segueStyle({ act: 2, energy: 0.8, barLen: b126, reduced: true });
  assert.ok(r.dur >= 1.6, 'reduced motion floors the cut at 1.6 s');
  assert.ok(Math.abs(S.segueStyle({ act: 1, energy: 0.5, big: true, barLen: b126, reduced: true }).dur - 1.5 * b126) < 1e-9, '…and lengthens a blend by half');
  assert.deepEqual(S.SEGUE_BARS, { cut: 0.25, morph: 1.0, dissolve: 1.0, melt: 2.0, min: 0.35, max: 8 });
});
test('synCue in bars: the conductor\'s cut and morph scale with the tempo; the lookahead grows to fit a morph', () => {
  const b126 = 60 / 126 * 4;
  const drop = { i: 2, inSec: 0.25 * b126, rise: 0.43, loud: true };
  const c = S.synCue({ ahead: drop, barLen: b126 });
  assert.ok(c.fire && c.kind === 'cut' && Math.abs(c.dur - 0.25 * b126) < 1e-3, 'a quarter-bar cut lands on the one');
  const m = S.synCue({ ahead: { i: 1, inSec: 0.75 * b126, rise: 0.35, loud: true }, barLen: b126 });
  assert.ok(m.fire && m.kind === 'morph' && Math.abs(m.dur - 0.75 * b126) < 1e-3, 'a three-quarter-bar morph');
  assert.ok(!S.synCue({ ahead: { ...drop, inSec: 1.0 }, barLen: b126 }).fire, 'too early: waits for the bar');
  assert.ok(Math.abs(S.synCue({ ahead: { ...drop, inSec: 2 } }).wait - (2 - S.SYN_TUNING.cutDur)) < 1e-9, 'no grid: the fixed seconds as before');
  assert.ok(Math.abs(S.synCue({ ahead: { ...drop, inSec: 0.3 }, barLen: 0.8 }).dur - 0.3) < 1e-3 || S.synCue({ ahead: { ...drop, inSec: 0.3 }, barLen: 0.8 }).dur >= 0.2, 'a very fast bar still floors the cut sensibly');
  assert.ok(Math.abs(S.synLookahead(b126) - 1.75 * b126) < 1e-9, 'the window is 1.75 bars at 126 BPM (3.3 s)');
  assert.equal(S.synLookahead(0), 2.4, '…and never under the fixed 2.4 s');
  assert.equal(S.synLookahead(1.0), 2.4);
  assert.equal(S.SYN_TUNING.cutBars, 0.25); assert.equal(S.SYN_TUNING.morphBars, 0.75);
});
test('stem cut: the room asks for a real absence (6 s) and a room that has had its say (24 s); the light still lands on 2 s', () => {
  assert.deepEqual(S.STEM_CUT, { dwell: 24, away: 6.0 });
  assert.equal(S.STEM_CUT_DWELL, S.STEM_CUT.dwell, 'the old name is the new value');
  // a fill: the kit drops out for 3 s and returns — the light lands, the room may not cut
  const fill = { sv: 1, hz: STEM_HZ, d: kitBars(6) + flat('0', 3) + kitBars(6), b: flat('5', 15), v: flat('0', 15), o: flat('3', 15) };
  const fr = runStems(fill, 0, 14);
  const land = fr.filter(f => f.out.landed);
  assert.ok(land.length >= 1, 'the light lands on the return');
  assert.ok(land[0].out.awayAtLand > 2 && land[0].out.awayAtLand < S.STEM_CUT.away, 'the absence was a fill\'s: ' + land[0].out.awayAtLand.toFixed(2));
  // a breakdown: eight seconds without the kit — the room may cut
  const brk = { sv: 1, hz: STEM_HZ, d: kitBars(6) + flat('0', 8) + kitBars(6), b: flat('5', 20), v: flat('0', 20), o: flat('3', 20) };
  const fr2 = runStems(brk, 0, 19);
  const land2 = fr2.filter(f => f.out.landed);
  assert.ok(land2.length >= 1 && land2[0].out.awayAtLand >= S.STEM_CUT.away, 'eight seconds away clears the room\'s bar: ' + (land2[0] && land2[0].out.awayAtLand));
  assert.equal(S.stemLightOut(S.makeStemLightState()).awayAtLand, 0, 'nothing landed yet reads 0');
  // the wiring: the landing is still the light's; the room's cut reads the absence and the gate
  assert.ok(html.includes('STEMS.out.landed && director.dwell >= STEM_CUT_DWELL'), 'the kit\'s-return cut as before…');
  assert.ok(html.includes("STEMS.out.awayAtLand >= STEM_CUT.away && this._gate('stem', barLen).ok"), '…and stricter');
  assert.ok(html.includes('if (st.kit && !wasKit && st.away >= K.awayMin){ st.landed = true; st.coil = 0; st.awayAtLand = st.away; }'), 'the light\'s own landing is untouched');
});
test('developPlan: a room\'s second act at 45 % and 80 % of the want, eased over two bars', () => {
  const bar = 1.9;
  assert.equal(S.developPlan({ dwell: 10, want: 30, barLen: bar, done: 0 }), null, 'not yet');
  const a = S.developPlan({ dwell: 14, want: 30, barLen: bar, done: 0 });
  assert.ok(a && a.step === 0 && Math.abs(a.ease - 2 * bar) < 1e-9, 'the first step at 45 %');
  assert.equal(S.developPlan({ dwell: 20, want: 30, barLen: bar, done: 1 }), null, 'the second not before 80 %');
  const b = S.developPlan({ dwell: 24, want: 30, barLen: bar, done: 1 });
  assert.ok(b && b.step === 1, 'the second step at 80 %');
  assert.equal(S.developPlan({ dwell: 29, want: 30, barLen: bar, done: 2 }), null, 'two is all');
  assert.equal(S.developPlan({ dwell: 29, want: 0, done: 0 }), null, 'no want, no plan');
  assert.ok(Math.abs(S.developPlan({ dwell: 29, want: 30, done: 0 }).ease - 4) < 1e-9, 'no grid: two two-second bars');
  assert.deepEqual(S.DEVELOP, { at: [0.45, 0.8], easeBars: 2, lensEveryPhrases: 2 });
});
test('pacing wiring: every automatic path goes through the gate, the dwell is phrases, paused is not a reason, rooms develop', () => {
  for (const s of ["this._gate('seam', barLen)", "this._gate('stem', barLen).ok",
                   'sectionChangeClass(st.sections[this._lastSection], st.sections[si])',
                   "this.request(true, cls === 'drop' ? 'drop' : 'section')", "else if (cls === 'minor') this.request(false, 'section');",
                   'synAhead(st, p, dur, synLookahead(barLen))', "const why = ahead.drop ? 'drop' : 'section';", 'cue.fire && this._gate(why, barLen).ok',
                   "const g = this._gate(this.big ? (this.kind === 'drop' ? 'drop' : 'section') : (this.kind || 'dwell'), barLen);",
                   'if (g.ok) this.waited += dt;', 'sectionBoundary: sectionBoundary && g.ok',
                   'surgeShouldRequest({ auto: this.auto, phase: newPhase, ratio, since: this.sinceChange,',
                   'const want = roomDwellBars({ mood: this.mood, energy: f.energy, ceil: this.ceil, reduced: reducedMotion,',
                   "if (live ? this.dwell > want : this.dwell > PACE.idleDwell) SEGUE.request(false, live ? 'dwell' : 'idle');",
                   'const dp = developPlan({ dwell: this.dwell, want, barLen, done: this._developed });',
                   'director.developTick(dt, phraseWrapped, grid);', 'scenes.forEach(sceneDevelop);',
                   'if (!hard && reducedMotion) this.transDur = Math.max(this.transDur, 1.6);',
                   'const log = window.__mb8Changes || (window.__mb8Changes = []);', 'this.sinceChange = 0;',
                   'const to = this.target >= 0 && this.target < scenes.length ? this.target : director.pickScene();',
                   'director.setScene(to, false, kind);',
                   // the seventh caller: a mixset's planned room is a request with a target, through the gate
                   "if (director.auto && typeof SEGUE !== 'undefined') SEGUE.request(true, 'mixset', i);",
                   "else director.setScene(i, false, 'mixset');",
                   // the followers inherit the booth's decision and never re-gate it
                   "director.setScene(p.dir.s, false, 'follow');", "director.setScene(p.s, false, 'follow');",
                   // the pacing clock: the audio clock's own delta, the wall when it is not running, bounded, never the clamped dt
                   'const wdt = this._tickClock();', "const a = ctx && ctx.state === 'running' ? ctx.currentTime : NaN;",
                   'this.wallDt = Math.min(1.0, Math.max(0, d));',
                   'this.transT = Math.min(1, this.transT + wdt / Math.max(0.2, this.transDur || 2.5));',
                   'this.dwell += wdt;', 'this.sinceChange += wdt;', 'SEGUE.tick(wdt);',
                   // the lens: read every half phrase with hysteresis, swapped after two phrases through the gate, the salt on a swap only
                   "const wdt = (typeof director !== 'undefined' && director.wallDt != null) ? director.wallDt : dt;",
                   'this._holdT = 0.5 * phrase;', 'if (this._lookT < DEVELOP.lensEveryPhrases * phrase) return;',
                   "kind: 'lens', reduced: reducedMotion }).ok) return;",
                   'salt: this._deals,', 'prev: this._resolved, hyst: LENS_HYST,', 'this._deals++;'])
    assert.ok(html.includes(s), 'the player carries: ' + s);
  assert.ok(!html.includes('if (this.dwell > want || !player.playing) SEGUE.request(false);'), 'the every-frame-while-paused request is gone');
  assert.ok(!html.includes('this.dwell > 6) SEGUE.request(false)'), 'the six-second surge is gone');
  assert.ok(!html.includes('salt: this._deals++'), 'the salt no longer rotates on every read');
  assert.ok(!html.includes("typeof s.develop === 'function'"), 'no web-only develop hook: development acts through the shared dice only');
  assert.equal((html.match(/director\.setScene\(to, false, kind\)/g) || []).length, 1, 'one landing, in SEGUE._land');
  assert.equal((html.match(/director\.pickScene\(\)/g) || []).length, 1, '…and the deal is drawn there only');
  // the generic second act: dice found by walking the materials, a tween that steps before the room's own update
  const dev = html.slice(html.indexOf('function sceneDevelop(s){'), html.indexOf('const director = {'));
  for (const s of ["for (const k of ['uVarA', 'uVarB', 'uVarC'])", 'const k = 1 - Math.exp(-(dt > 0 ? dt : 0) / tween.tau);',
                   "return typeof update === 'function' ? update.apply(this, arguments) : undefined;",
                   'tau: Math.max(0.5, (sec > 0 ? sec : 4) / 3)', 'if (!dice.length) return false;'])
    assert.ok(dev.includes(s), 'sceneDevelop: ' + s);
});
test('pacing parity: the TV\'s Director carries the web\'s PACE, ROOM_DWELL, MOODS.dwell, ACTS.dwell, STEM_CUT, SECTION_CHANGE, SEGUE_BARS, SURGE and DEVELOP', () => {
  const rooms = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Rooms.swift'), 'utf8');
  const struct = readFileSync(join(root, 'tvos/AethraKairosTV/Model/Structure.swift'), 'utf8');
  const view = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/VisualizerView.swift'), 'utf8');
  const dance = readFileSync(join(root, 'tvos/AethraKairosTV/Visualizer/Dance.swift'), 'utf8');
  const num = (src, name) => { const m = src.match(new RegExp(`\\b${name}: Double = ([0-9.]+)`)); assert.ok(m, name + ' declared'); return Number(m[1]); };
  const arr = (src, name) => { const m = src.match(new RegExp(`\\b${name}: \\[Double\\] = \\[([^\\]]+)\\]`)); assert.ok(m, name + ' declared'); return m[1].split(',').map(x => Number(x.trim())); };
  assert.deepEqual(arr(rooms, 'paceMinGapBars'), S.PACE.minGapBars, 'PACE.minGapBars');
  assert.equal(num(rooms, 'paceMinGapSec'), S.PACE.minGapSec); assert.equal(num(rooms, 'paceHardFloorSec'), S.PACE.hardFloorSec);
  assert.equal(num(rooms, 'paceIdleDwell'), S.PACE.idleDwell); assert.equal(num(rooms, 'paceIdleGapSec'), S.PACE.idleGapSec);
  assert.equal(num(rooms, 'roomDwellMin'), S.ROOM_DWELL.min); assert.equal(num(rooms, 'roomDwellMax'), S.ROOM_DWELL.max); assert.equal(num(rooms, 'roomDwellFloor'), S.ROOM_DWELL.floor);
  for (const mood of Object.keys(S.MOODS)){
    const m = rooms.match(new RegExp(`case \\.${mood}:\\s+return ([0-9.]+)`));
    assert.ok(m, 'moodDwellMult.' + mood);
    assert.equal(Number(m[1]), S.MOODS[mood].dwell, 'MOODS.' + mood + '.dwell');
  }
  const a0 = html.indexOf('const ACTS = ['), acts = html.slice(a0, html.indexOf('];', a0));
  const dwell = [...acts.matchAll(/\bdwell: (\d+\.\d+)/g)].map(m => +m[1]);
  assert.deepEqual(arr(rooms, 'actDwell'), dwell, 'Director.actDwell is ACTS.dwell');
  assert.deepEqual(arr(struct, 'actDwell'), dwell, 'Story.actDwell is ACTS.dwell');
  assert.equal(num(rooms, 'stemCutDwell'), S.STEM_CUT.dwell); assert.equal(num(rooms, 'stemCutAway'), S.STEM_CUT.away);
  assert.equal(num(rooms, 'sectionMajor'), S.SECTION_CHANGE.major); assert.equal(num(rooms, 'sectionDrop'), S.SECTION_CHANGE.drop);
  for (const [k, name] of [['cut', 'segueBarsCut'], ['morph', 'segueBarsMorph'], ['dissolve', 'segueBarsDissolve'], ['melt', 'segueBarsMelt'], ['min', 'segueBarsMin'], ['max', 'segueBarsMax']])
    assert.equal(num(rooms, name), S.SEGUE_BARS[k], 'SEGUE_BARS.' + k);
  assert.equal(num(rooms, 'segueReducedFloor'), 1.6);
  assert.equal(num(rooms, 'surgeRatio'), S.SURGE.ratio); assert.equal(num(rooms, 'surgeMinPhrases'), S.SURGE.minPhrases); assert.equal(num(rooms, 'surgeMinCeil'), S.SURGE.minCeil);
  assert.deepEqual(arr(rooms, 'developAt'), S.DEVELOP.at); assert.equal(num(rooms, 'developEaseBars'), S.DEVELOP.easeBars); assert.equal(num(rooms, 'developLensEveryPhrases'), S.DEVELOP.lensEveryPhrases);
  // the laws, line for line
  for (const s of ['let base = roomDwellMax - (roomDwellMax - roomDwellMin) * e', 'let held = 1.25 - 0.25 * min(max(ceil, 0), 1)', 'return reduced ? sec * 1.5 : sec',
                   'return max(2 * phrase, (sec / phrase).rounded() * phrase)',
                   'case .drop: gap = min(gap, 2 * bar)', 'case .seam: gap = paceHardFloorSec', 'case .idle: gap = paceIdleGapSec', 'if reduced && kind != .seam { gap *= 1.5 }',
                   'if next.loud && rise > sectionDrop { return .drop }', 'if abs(rise) >= sectionMajor || prev.loud != next.loud { return .major }',
                   'return ratio >= surgeRatio && since >= surgeMinPhrases * 8 * bar && ceil >= surgeMinCeil',
                   'if act == 2 && energy > 0.60 {', 'if act == 0 || act == 4 || energy < 0.30 { return (.dissolve, slow(bars(segueBarsMelt))) }',
                   'return (.dissolve, slow(bars(segueBarsDissolve * (1.6 - 0.8 * energy))))',
                   'kitReturn && sinceEntry >= Director.stemCutDwell && kitAway >= Director.stemCutAway',
                   'let due = playing ? (sinceEntry >= dwellWant) : (sinceEntry >= Director.paceIdleDwell)',
                   'if gateOK { waited += dtClamped }', 'let boundary = pendingBig ? (phraseWrapped || barWrapped) : barWrapped'])
    assert.ok(rooms.includes(s), 'Rooms.swift carries: ' + s);
  assert.ok(!/Double\.random\(in: 0\.\.\.1\)/.test(rooms.slice(rooms.indexOf('struct Director'))), 'the random dwell draw is gone: the two stages pace alike');
  // the renderer: segueStyle sets the length, the develop step eases the dice, the lens holds phrases
  for (const s of ['Director.segueStyle(act: act, energy: energy, big: big, barLen: barLen, reduced: calmNow)',
                   'transitionDuration = max(calmNow ? Director.segueReducedFloor : Self.xformMinDur[mode], style.dur)',
                   'if let dev = director.takeDevelop() {', 'rollTau = max(0.5, dev.ease / 3)', 'currentRolls += (target - currentRolls) * k',
                   'kitAway: stemOut.awayAtLand', 'barLen: barLen, reduced: calmNow,', 'big: director.lastChangeBig, barLen: barLen)',
                   // the lens: half-phrase reads with hysteresis, a two-phrase hold, the gate, the salt on a swap only
                   'lensHold = 0.5 * phrase', 'prev: lensChoice, hyst: Self.lensHyst',
                   'guard lensLookT >= Director.developLensEveryPhrases * phrase,',
                   'Director.paceGate(since: director.sinceChange, act: act, barLen: barLen, kind: .lens, reduced: calm).ok',
                   'lensDeals += 1                                // the next equal choice takes its turn — on a swap, not on a read',
                   // the clocks: the director and the lens step by the wall (bounded), the handover is derived from its start
                   'let wallDt = min(max(dt, 0), 1.0)', 'if director.tick(dt: wallDt, frame: frame',
                   'transitionStart = CACurrentMediaTime()',
                   'transitionProgress = min(1, (now - transitionStart) / max(transitionDuration, 0.05))',
                   'autoLens(dt: wallDt, act: actTarget'])
    assert.ok(view.includes(s), 'VisualizerView.swift carries: ' + s);
  const hy = view.match(/lensHyst = ([0-9.]+)/);
  assert.ok(hy && Number(hy[1]) === S.LENS_HYST, 'the TV\'s lens hysteresis is LENS_HYST');
  assert.ok(!view.includes('transitionProgress + dt /'), 'the handover is no longer integrated from the clamped dt');
  assert.ok(rooms.includes('enum PaceKind { case dwell, section, drop, stem, seam, surge, idle, lens, mixset }'), 'the TV gate knows the minor kinds');
  assert.ok(dance.includes('landed = true; coil = 0; awayAtLand = away'), 'the TV\'s StemLight records the absence at the landing');
});

test('pickLens hysteresis: the held look is sticky by ±0.08 of energy; a different shelf still changes it', () => {
  const base = { act: 2, ceil: 0.8, major: true, salt: 1 };
  assert.equal(S.LENS_HYST, 0.08);
  assert.equal(S.pickLens({ ...base, energy: 0.78 }), 'hyperbolic');
  assert.equal(S.pickLens({ ...base, energy: 0.82 }), 'echo', 'without hysteresis 0.82 is over the 0.8 line');
  assert.equal(S.pickLens({ ...base, energy: 0.82, prev: 'hyperbolic', hyst: S.LENS_HYST }), 'hyperbolic', 'with it, a wobble over the line holds the look');
  assert.equal(S.pickLens({ ...base, energy: 0.89, prev: 'hyperbolic', hyst: S.LENS_HYST }), 'echo', 'past the margin it changes');
  assert.equal(S.pickLens({ ...base, energy: 0.78, prev: 'echo', hyst: S.LENS_HYST }), 'echo', 'and holds on the way down too');
  assert.equal(S.pickLens({ ...base, energy: 0.70, prev: 'echo', hyst: S.LENS_HYST }), 'hyperbolic', '…until the energy has really left');
  assert.equal(S.pickLens({ ...base, energy: 0.96, prev: 'none', hyst: S.LENS_HYST }), 'grating', 'from clean glass the hottest shelf deals at once');
  assert.equal(S.pickLens({ ...base, energy: 0.96, prev: 'echo', hyst: S.LENS_HYST }), 'echo', 'from the shelf below, the 0.93 line is inside the margin of the top of the range: the look holds');
  assert.equal(S.pickLens({ act: 2, ceil: 0.5, energy: 0.9, prev: 'echo', hyst: S.LENS_HYST }), 'none', 'the hard gate is not hysteresis: a capped section goes clean at once');
  assert.equal(S.pickLens({ ...base, energy: 0.82, prev: 'hyperbolic' }), 'echo', 'no hyst, no stickiness');
  assert.equal(S.pickLens({ ...base, energy: 0.82, prev: 'hyperbolic', hyst: 0 }), 'echo');
  // a lens swap and a mixset's room are minor changes: the act's own gap
  for (const k of ['lens', 'mixset'])
    assert.equal(S.paceGate({ since: 0, act: 2, barLen: 1.9, kind: k }).gap, S.paceGate({ since: 0, act: 2, barLen: 1.9, kind: 'dwell' }).gap, k + ' takes the dwell\'s gap');
});

// ---------------------------------------------------------------- the rack, second pass
/* eight units, two knobs, one law each — every number the rack is built on,
   held here without a browser: the knob laws, the gate's edges, the echo's
   gain invariant, the reverb's impulse, the drive's loudness table, the
   performer's patience, the limiter budget, and the parked table release()
   walks. */
test('fxMix: the reverb rides a cubic (a wash is fine control), the echo and the inserts a capped line (a colour must be heard at half travel)', () => {
  assert.equal(S.FX_MIX.reverb.law, 'cubic'); assert.ok(Math.abs(S.fxMix('reverb', 0.5) - 0.125 * S.FX_MIX.reverb.cap) < 1e-9, 'half travel of the wash is a whisper');
  assert.equal(S.FX_MIX.echo.law, 'linear'); assert.ok(S.fxMix('echo', 0.5) >= 0.5, 'a tapped ECHO is heard: its loop already shapes the tail');
  for (const u of S.FX_INSERTS){ assert.equal(S.FX_MIX[u].law, 'linear'); assert.ok(S.fxMix(u, 0.5) >= 0.3, u + ' half travel is audible, got ' + S.fxMix(u, 0.5)); assert.ok(S.fxMix(u, 1) <= S.FX_MIX[u].cap + 1e-9, u + ' never past its cap'); }
  for (const u of S.FX_UNITS){
    const hasMix = S.FX_SENDS.indexOf(u) >= 0 || S.FX_INSERTS.indexOf(u) >= 0;
    assert.equal(!!S.FX_MIX[u], hasMix, u + (hasMix ? ' has a MIX' : ' has no MIX (filter and gate are their own blend)'));
    assert.ok(S.FX_AMT[u] > 0 && S.FX_AMT[u] <= 1, u + ' has a resting AMOUNT');
    if (hasMix) assert.ok(S.FX_MIX[u].def > 0 && S.FX_MIX[u].def <= 1, u + ' has a resting MIX');
  }
  assert.equal(S.fxMix('filter', 1), 0); assert.equal(S.fxMix('echo', -1), 0); assert.equal(S.fxMix('drive', 7), S.fxMix('drive', 1));
  assert.equal(S.FX_UNITS.length, 8, 'eight pads');
});
test('fxFilterQ: flat on the detent, squelching toward the ends, never past 3', () => {
  assert.ok(Math.abs(S.fxFilterQ(0) - 0.7) < 1e-9 && Math.abs(S.fxFilterQ(0.05) - 0.7) < 1e-9, 'Butterworth inside the detent — the centre is honestly bypass');
  let prev = 0;
  for (let x = 0; x <= 1.0001; x += 0.05){ const q = S.fxFilterQ(x); assert.ok(q >= prev - 1e-12, 'monotone'); prev = q; }
  assert.ok(Math.abs(S.fxFilterQ(1) - 3) < 1e-9 && Math.abs(S.fxFilterQ(-1) - 3) < 1e-9, 'three at either end');
  assert.ok(S.fxFilterQ(0.5) < 1.6, 'and most of the squelch lives in the last third, got ' + S.fxFilterQ(0.5));
  // the corners went where a DJ filter goes: the kick leaves on the left, the air on the right
  assert.ok(S.fxFilter(-1, 22050).lp < 100 && S.fxFilter(1, 22050).hp > 12000);
});
/* Web Audio's LP/HP biquad, as the spec writes it: the RBJ cookbook with Q read in dB
   (alpha = sin(w0) / (2·10^(Q/20))). The magnitude at f, so a test can see a hump. */
const biquadMag = (type, f, fc, qDbVal, sr) => {
  const w0 = 2 * Math.PI * fc / sr, al = Math.sin(w0) / (2 * Math.pow(10, qDbVal / 20)), c = Math.cos(w0);
  const b = type === 'lowpass' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a = [1 + al, -2 * c, 1 - al];
  const w = 2 * Math.PI * f / sr;
  const re = (k) => k[0] + k[1] * Math.cos(-w) + k[2] * Math.cos(-2 * w), im = (k) => k[1] * Math.sin(-w) + k[2] * Math.sin(-2 * w);
  return Math.hypot(re(b), im(b)) / Math.hypot(re(a), im(a));
};
test('qDb / Q_FLAT_DB: a LP/HP biquad reads Q in dB, so the rack writes the linear law through qDb and parks at a hump-free Butterworth', () => {
  assert.ok(Math.abs(S.Q_FLAT_DB - (-3.0103)) < 1e-3, 'Butterworth is −3.01 dB, got ' + S.Q_FLAT_DB);
  assert.ok(Math.abs(S.qDb(1) - 0) < 1e-12 && Math.abs(S.qDb(3) - 9.5424) < 1e-3, 'the linear law in the node\'s unit');
  assert.ok(Math.abs(S.qDb(0) - S.Q_FLAT_DB) < 1e-12 && Math.abs(S.qDb(-1) - S.Q_FLAT_DB) < 1e-12, 'nonsense in, Butterworth out');
  const sr = 48000;
  let flat = 0, old = 0;
  for (let f = 20; f < 20000; f *= 1.01){
    flat = Math.max(flat, biquadMag('lowpass', f, 3000, S.Q_FLAT_DB, sr));
    old = Math.max(old, biquadMag('lowpass', f, 3000, 0.7, sr));
  }
  assert.ok(flat <= 1 + 1e-9, 'a dB Butterworth never rises above unity, peak ' + flat);
  assert.ok(old > 1.2, 'and the 0.7 that was written "as Butterworth" was a +1.7 dB hump, peak ' + old.toFixed(3));
  // the parked deck highpass and the master's, in series at 20 Hz: no sub-bass bump anywhere below 60 Hz
  for (let f = 15; f <= 60; f += 1){
    const g = Math.pow(biquadMag('highpass', f, 20, S.Q_FLAT_DB, sr), 2);
    assert.ok(g <= 1 + 1e-9, 'deck hp × master hp adds nothing at ' + f + ' Hz, got ' + (20 * Math.log10(g)).toFixed(2) + ' dB');
  }
  // the filter's ends are a real squelch once the node is told in its own unit
  assert.ok(S.qDb(S.fxFilterQ(1)) > 9 && S.qDb(S.fxFilterQ(0)) < S.Q_FLAT_DB + 0.2);
});
test('ECHO_HOLD_FB: a held tail decays — the loop gain (feedback × the in-loop Butterworth) stays under one at every frequency', () => {
  assert.ok(S.ECHO_HOLD_FB > 0.9 && S.ECHO_HOLD_FB < 0.97, 'a long hang, but with margin under unity: ' + S.ECHO_HOLD_FB);
  assert.ok(S.ECHO_HOLD_FB > S.fxEchoGains(1).fb, 'HOLD hangs longer than the knob at full');
  for (const sr of [44100, 48000]) for (const fc of [3000, 4500]){
    let peak = 0, at = 0;
    for (let f = 20; f < sr / 2; f *= 1.005){ const g = S.ECHO_HOLD_FB * biquadMag('lowpass', f, fc, S.Q_FLAT_DB, sr); if (g > peak){ peak = g; at = f; } }
    assert.ok(peak < 0.95, 'held loop gain ' + peak.toFixed(4) + ' at ' + Math.round(at) + ' Hz (lp ' + fc + ', ' + sr + ' Hz) — every repeat quieter than the last');
    // and what the first build had: 0.97 through a 0.7 dB "Butterworth" — a loop that grows
    let was = 0; for (let f = 20; f < sr / 2; f *= 1.005) was = Math.max(was, 0.97 * biquadMag('lowpass', f, fc, 0.7, sr));
    assert.ok(was > 1.1, 'the old loop really did gain on itself: ' + was.toFixed(3));
  }
});
test('fxFilterArbiter / fxSeamHz: the more closed hand wins, the highpass is the hand\'s alone, the seam reads back as a number', () => {
  assert.deepEqual(S.fxFilterArbiter({ lp: 800, hp: 20 }, 22000, 0), { lp: 800, hp: 20 }, 'a hand alone');
  assert.deepEqual(S.fxFilterArbiter(null, 300, 0), { lp: 300, hp: 20 }, 'a seam alone');
  assert.equal(S.fxFilterArbiter({ lp: 800, hp: 2000 }, 300, 0).lp, 300, 'the seam closes further: it wins the lowpass');
  assert.equal(S.fxFilterArbiter({ lp: 800, hp: 2000 }, 300, 0).hp, 2000, '…and the hand keeps its highpass');
  assert.equal(S.fxFilterArbiter({ lp: 800, hp: 20 }, 22000, 500).lp, 500, 'the brake darkens past the hand');
  assert.equal(S.fxFilterArbiter(null, 0, 0).lp, 22000, 'nothing on it: open');
  const c = { t0: 10, hold: 0.6, t1: 15, from: 22000, to: 300 };
  assert.equal(S.fxSeamHz(c, 9), 22000); assert.equal(S.fxSeamHz(c, 10.5), 22000, 'held through the lead-in');
  assert.ok(Math.abs(S.fxSeamHz(c, 12.8) - Math.sqrt(22000 * 300)) < 1, 'the geometric midpoint half way down — exponential, as the scheduled curve is');
  assert.equal(S.fxSeamHz(c, 15), 300); assert.equal(S.fxSeamHz(c, 99), 300); assert.equal(S.fxSeamHz(null, 1), 22000);
});
test('gateSchedule: raised-cosine edges, a −60 dB floor, and never a step across a sample, for every division at 174 BPM', () => {
  const sr = 48000;
  const edge = S.gateEdge(32);
  assert.equal(edge[0], 0); assert.ok(Math.abs(edge[31] - 1) < 1e-6); assert.ok(Math.abs(edge[16] - 0.5) < 0.06, 'cosine through the middle');
  assert.ok(Math.abs(S.GATE_FLOOR - 0.001) < 1e-12, '−60 dB: taken away, not turned down');
  const render = (events, dur) => {
    const n = Math.ceil(dur * sr), v = new Float32Array(n);
    let cur = S.GATE_FLOOR, ei = 0;
    for (let i = 0; i < n; i++){
      const t = i / sr;
      while (ei < events.length && t >= events[ei].at + events[ei].dur){ cur = events[ei].to; ei++; }
      if (ei < events.length && t >= events[ei].at){
        const e = events[ei], c = S.gateCurve(e.from, e.to, 32);
        const k = (t - e.at) / e.dur * (c.length - 1), i0 = Math.floor(k), f = k - i0;
        v[i] = c[i0] + (c[Math.min(c.length - 1, i0 + 1)] - c[i0]) * f;
      } else v[i] = cur;
    }
    return v;
  };
  for (const div of S.FX_DIVS){
    const step = S.fxTime(div, 174), hold = S.fxGateHold(1), E = S.gateEdgeSec(step);
    const ev = S.gateSchedule(0, step, hold, E);
    assert.equal(ev.length, 2);
    assert.ok(ev[0].at + ev[0].dur <= ev[1].at + 1e-9, 'the open has finished before the close begins at div ' + div);
    assert.ok(ev[1].at + ev[1].dur < step, 'and the close has finished before the next slice at div ' + div);
    assert.equal(ev[0].from, S.GATE_FLOOR); assert.equal(ev[0].to, 1); assert.equal(ev[1].from, 1); assert.equal(ev[1].to, S.GATE_FLOOR);
    const v = render(ev, step);
    let worst = 0;
    for (let i = 1; i < v.length; i++) worst = Math.max(worst, Math.abs(v[i] - v[i - 1]));
    assert.ok(worst < 0.5, 'no step across a sample at div ' + div + ', worst ' + worst);
    assert.ok(worst < 0.05, '…and in truth far gentler than that, worst ' + worst);
    assert.ok(Math.abs(v[Math.round((ev[0].at + ev[0].dur) * sr) + 1] - 1) < 1e-3, 'fully open after the edge');
    assert.ok(v[v.length - 1] <= S.GATE_FLOOR + 1e-6, 'and at the floor by the slice end');
  }
  // the grid is kept across a stall: the first slice after `now` is still on the lattice the bar anchored
  assert.ok(Math.abs(S.gateAnchor(10.0, 3.0, 0.5) - 10.0) < 1e-9);
  assert.ok(Math.abs(S.gateAnchor(10.1, 3.0, 0.5) - 10.5) < 1e-9);
  assert.ok(Math.abs(S.gateAnchor(10.0, 12.3, 0.5) - 10.3) < 1e-9, 'a bar line still ahead: counted back from it');
});
test('fxEchoGains: send/(1 − fb) never exceeds 1.2 anywhere on the knob, and the tail grows with it', () => {
  let prevFb = -1;
  for (let a = 0; a <= 1.0001; a += 0.01){
    const g = S.fxEchoGains(a);
    assert.ok(g.fb < 1 && g.fb >= 0.25, 'a feedback that always decays');
    assert.ok(g.send / (1 - g.fb) <= 1.2 + 1e-9, 'the invariant at ' + a.toFixed(2) + ': ' + (g.send / (1 - g.fb)).toFixed(3));
    assert.ok(g.fb >= prevFb, 'more knob, longer tail'); prevFb = g.fb;
  }
  assert.equal(S.fxEchoGains(0).send, 0, 'nothing sent at zero');
  assert.ok(S.fxEchoGains(0.6).send > 0.3, 'the room\'s own echo is a real send, got ' + S.fxEchoGains(0.6).send);
  assert.ok(S.fxEchoGains(0.6).send * S.fxMix('echo', S.FX_MIX.echo.def) > 0.15, 'and at the resting knobs the first repeat is well within hearing');
  // the warp is bounded: a 1/8 → 4-beat change glides over 0.6 s, a small one is quick
  assert.ok(Math.abs(S.fxEchoGlide(0.125, 2) - 0.6) < 1e-9); assert.ok(Math.abs(S.fxEchoGlide(0.5, 0.52) - 0.25) < 1e-9);
  assert.ok(S.fxEchoGlide(0.5, 1) >= 0.25 && S.fxEchoGlide(0.5, 1) <= 0.6 && S.fxEchoGlide(0.5, 1.4) > 0.25);
});
test('reverbIR: RT60 within a tenth of the request, no DC, two different channels, and no click at the onset', () => {
  const sr = 48000;
  for (const [secs, seed] of [[1.2, 41], [2.6, 97]]){
    const ir = S.reverbIR(sr, secs, 60, seed);
    assert.equal(ir.length, 2);
    const L = ir[0], R = ir[1];
    assert.equal(L.length, Math.round(sr * secs));
    const rms = (a, i0, i1) => { let s2 = 0; for (let i = i0; i < i1; i++) s2 += a[i] * a[i]; return Math.sqrt(s2 / (i1 - i0)); };
    // the energy ratio between a window near the start and one near the end fits an exponential to −60 dB at T
    const w = Math.round(sr * 0.05), a0 = Math.round(sr * 0.1), a1 = Math.round(sr * (secs - 0.1)) - w;
    const slope = 20 * Math.log10(rms(L, a0, a0 + w) / rms(L, a1, a1 + w)) / ((a1 - a0) / sr);   // dB per second
    const rt60 = 60 / slope;
    assert.ok(Math.abs(rt60 - secs) / secs < 0.1, 'RT60 ' + rt60.toFixed(2) + ' s for a ' + secs + ' s room');
    let mean = 0; for (let i = 0; i < L.length; i++) mean += L[i]; mean /= L.length;
    assert.ok(Math.abs(mean) < 1e-3, 'no DC, mean ' + mean);
    let same = 0; for (let i = 0; i < 2000; i++) if (L[i] === R[i]) same++;
    assert.ok(same < 10, 'left and right are different noise — that is the width');
    assert.ok(Math.abs(L[0]) < 1e-6 && Math.abs(L[10]) < 0.1, 'the onset rises, it does not slam');
    assert.ok(Math.max.apply(null, Array.from(L.subarray(0, 4000)).map(Math.abs)) <= 1, 'bounded');
  }
});
test('fxFlangeParams / fxLfoWave / fxPhaserStages: beat-synced sweeps whose bottom lands on the bar', () => {
  const p = S.fxFlangeParams(1, 1, 120);
  assert.ok(Math.abs(p.rateHz - 1 / 2) < 1e-9, 'one sweep per four beats at 120 BPM is a two-second cycle');
  assert.ok(Math.abs(S.fxFlangeParams(0.5, 0.5, 120).rateHz - 1) < 1e-9, 'a half-beat division sweeps twice as fast');
  assert.ok(p.fb <= 0.55 && S.fxFlangeParams(0, 1, 120).fb >= 0.25, 'feedback inside the budget');
  assert.equal(S.fxFlangeParams(0, 1, 120).depthSec, 0); assert.ok(p.depthSec > 0.001 && p.baseSec === 0.003);
  // the swept line sits inside the feedback cycle, where a DelayNode is clamped to one render quantum
  // (128 frames): the WHOLE sweep, at every amount, must stay above that floor at 44.1 kHz or it is a static comb
  for (let a = 0; a <= 1.0001; a += 0.05){
    const q = S.fxFlangeParams(a, 1, 128);
    // apply() centres delayTime at base + depth and the LFO swings ±depth: the sweep is [base, base + 2·depth]
    assert.ok(q.baseSec > 128 / 44100, 'sweep bottom above the cycle floor at amount ' + a.toFixed(2) + ': ' + (q.baseSec * 1000).toFixed(2) + ' ms');
    assert.ok(q.baseSec + 2 * q.depthSec <= 0.006, '…and the top still a flanger, not a slapback');
  }
  // the wave: real·cos + imag·sin evaluated at θ = 2π·frac must be the minimum
  for (const frac of [0, 0.25, 0.6, 0.99]){
    const w = S.fxLfoWave(frac), th = 2 * Math.PI * frac;
    const at = w.real[1] * Math.cos(th) + w.imag[1] * Math.sin(th);
    assert.ok(Math.abs(at + 1) < 1e-6, 'bottom on the bar for frac ' + frac + ', got ' + at);
    assert.ok(Math.abs(w.real[1] * w.real[1] + w.imag[1] * w.imag[1] - 1) < 1e-6, 'unit amplitude');
    assert.equal(w.real[0], 0); assert.equal(w.imag[0], 0);
  }
  const st = S.fxPhaserStages(1, 6);
  assert.equal(st.base.length, 6);
  for (let k = 1; k < 6; k++) assert.ok(Math.abs(st.base[k] / st.base[k - 1] - Math.SQRT2) < 1e-9, 'half an octave apart');
  assert.equal(st.base[0], 250); assert.equal(st.fb, 0.3); assert.equal(st.depth[0], 2); assert.equal(S.fxPhaserStages(0, 6).depth[3], 0);
  const sh = S.fxPhaserShape(1025, 2);
  assert.ok(Math.abs(sh[512]) < 1e-9, 'no sweep at rest'); assert.ok(Math.abs(sh[1024] - 3) < 1e-9 && Math.abs(sh[0] + 0.75) < 1e-9, '±2 octaves at the ends');
});
test('crushBits / crushCurve / crushTone: twelve bits of grit to three bits of the sound everybody means', () => {
  assert.equal(S.crushBits(0), 12); assert.equal(S.crushBits(1), 3); assert.equal(S.crushBits(0.5), 7.5);
  const c = S.crushCurve(3, 1025);
  const levels = new Set(Array.from(c).map(v => Math.round(v * 1e6)));
  assert.ok(levels.size <= 9 && levels.size >= 7, 'three bits is a handful of steps, got ' + levels.size);
  assert.ok(Math.abs(c[1024] - 1) < 1e-9 && Math.abs(c[0] + 1) < 1e-9 && c[512] === 0, 'full scale and silence are exact');
  assert.ok(S.crushTone(0) > 15000 && S.crushTone(1) < 2500 && S.crushTone(0.5) < S.crushTone(0.2), 'the top goes with the bits');
});
test('driveMakeup: driven or clean, the room is the same loudness within a dB across the whole knob', () => {
  const curve = S.driveCurve(4096);
  assert.ok(Math.abs(curve[4095] - 1) < 1e-9 && Math.abs(curve[0] + 1) < 1e-9 && Math.abs(curve[2047] + curve[2048]) < 1e-3, 'normalised, odd');
  // a tanh(3x)/tanh(3) shaper has a small-signal slope of three: even at unity pre-gain it lifts
  // programme material by several dB (less than the full slope — at −9 dBFS the peaks are already
  // into the knee), which is exactly what the table exists to take back
  assert.ok(S.driveMakeup(1) > 1.5 && S.driveMakeup(1) < 3.05, 'unity makeup is the shaper\'s own lift, got ' + S.driveMakeup(1));
  // a DIFFERENT pink reference than the table was built from
  const ref = S.drivePinkRef(16384, 0.355, 777), t3 = Math.tanh(3);
  let inSq = 0; for (let i = 0; i < ref.length; i++) inSq += ref[i] * ref[i];
  for (let k = 1; k <= 8; k += 0.5){
    const post = 1 / S.driveMakeup(k);
    let sq = 0;
    for (let i = 0; i < ref.length; i++){ const y = Math.tanh(3 * Math.max(-1, Math.min(1, k * ref[i]))) / t3 * post; sq += y * y; }
    const db = 10 * Math.log10(sq / inSq);
    assert.ok(Math.abs(db) < 1, 'k=' + k + ' lands within a dB of clean, got ' + db.toFixed(2) + ' dB');
  }
  assert.ok(S.driveMakeup(8) > S.driveMakeup(1), 'more drive, more makeup to take back');
  assert.equal(S.drivePre(0), 1); assert.equal(S.drivePre(1), 8); assert.equal(S.driveTiltDb(1), -3);
  // the graph's own loss (tilt, pre-highpass, the 4× band limit) is given back with the pre-gain: nothing at unity, under 2 dB at full
  assert.equal(S.driveTrimDb(1), 0); assert.ok(S.driveTrimDb(8) > 1 && S.driveTrimDb(8) < 2); assert.ok(S.driveTrimDb(4) > S.driveTrimDb(2)); assert.equal(S.driveTrimDb(99), S.driveTrimDb(8));
});
test('fxAutoStep: a decision a bar, hysteresis on the line, two bars held, eight of rest, the gate rationed', () => {
  const base = { ceil: 1, act: 2, phase: 'peak', bar: 2, toSeam: null };
  // a peak hovering on the gate's line: 0.84–0.88 around 0.86 — without hysteresis this flickered every frame
  let st = S.makeFxAuto(), changes = [];
  for (let bars = 0; bars < 64; bars += 0.01){
    const e = 0.86 + 0.02 * Math.sin(bars * 7.3);
    const r = S.fxAutoStep(st, { ...base, energy: e }, ((bars % 1) + 1) % 1, bars);
    if (r.change) changes.push(bars);
    st = r.st;
  }
  assert.equal(changes.length, 0, 'a wobble on the line is not a decision: ' + changes.length + ' changes');
  // a real peak: the gate comes in on a bar line, stays four bars, rests, and is not dealt again for 32
  st = S.makeFxAuto(); changes = [];
  for (let bars = 0; bars < 80; bars += 0.01){
    const r = S.fxAutoStep(st, { ...base, energy: 0.95 }, ((bars % 1) + 1) % 1, bars);
    if (r.change) changes.push({ bars: Math.round(bars * 100) / 100, unit: r.unit });
    st = r.st;
  }
  assert.ok(changes.length >= 2, 'the gate was dealt, ' + JSON.stringify(changes));
  for (const c of changes) assert.ok(c.bars % 1 < 0.05, 'every change at the top of a bar: ' + c.bars);
  assert.equal(changes[0].unit, 'gate'); assert.equal(changes[1].unit, 'none');
  assert.ok(changes[1].bars - changes[0].bars >= 4 && changes[1].bars - changes[0].bars < 5, 'four bars of gate, got ' + (changes[1].bars - changes[0].bars));
  if (changes[2]) assert.ok(changes[2].bars - changes[0].bars >= 32, 'and not again inside thirty-two bars');
  for (let i = 1; i < changes.length; i++) assert.ok(changes[i].bars - changes[i - 1].bars >= 2, 'never two changes inside two bars');
  // a build then a drop: the sweep holds two bars at least, and after it ends the room rests eight bars before the next unit
  st = S.makeFxAuto(); changes = [];
  for (let bars = 0; bars < 40; bars += 0.01){
    const o = bars < 8 ? { ...base, phase: 'build', act: 1, energy: 0.7 } : bars < 9 ? { ...base, phase: 'flow', energy: 0.4 } : { ...base, energy: 0.95 };
    const r = S.fxAutoStep(st, o, ((bars % 1) + 1) % 1, bars);
    if (r.change) changes.push({ bars: Math.round(bars * 100) / 100, unit: r.unit });
    st = r.st;
  }
  assert.equal(changes[0].unit, 'filter'); assert.equal(changes[1].unit, 'none');
  assert.ok(changes[1].bars - changes[0].bars >= 2);
  assert.equal(changes[2].unit, 'gate'); assert.ok(changes[2].bars - changes[1].bars >= 8, 'eight bars of rest, got ' + (changes[2].bars - changes[1].bars));
  // the hand-off echo is the exception: it may interrupt a held unit without the rest
  st = S.makeFxAuto();
  st = S.fxAutoStep(st, { ...base, phase: 'build', act: 1, energy: 0.7 }, 0.01, 4).st;
  assert.equal(st.unit, 'filter');
  const r = S.fxAutoStep(st, { ...base, phase: 'build', act: 1, energy: 0.7, toSeam: 1.5 }, 0.01, 5);
  assert.equal(r.unit, 'echo'); assert.ok(r.change);
  // and never a change off the bar line, never twice in one bar
  const r2 = S.fxAutoStep(r.st, { ...base, energy: 0.95 }, 0.5, 5.5);
  assert.ok(!r2.change && r2.unit === 'echo');
  // a late tick (a slow frame, the hidden tab's 300 ms timer) still decides, once, inside the bar's first quarter
  let late = S.fxAutoStep(S.makeFxAuto(), { ...base, energy: 0.95 }, 0.2, 12.2);
  assert.ok(late.change && late.unit === 'gate', 'a tick a fifth of a bar late still takes the decision');
  assert.ok(!S.fxAutoStep(late.st, { ...base, energy: 0.95 }, 0.22, 12.22).change, '…once');
  assert.ok(!S.fxAutoStep(S.makeFxAuto(), { ...base, energy: 0.95 }, 0.3, 12.3).change, 'but past the first quarter it waits for the next bar');
  assert.ok(S.FX_AUTO.barTop * S.beatLen(4, 174) > 0.3, 'the window outlasts the hidden tab\'s 300 ms tick even at 174 BPM');
  // a hidden tab feeds the step ceil 0: nothing is dealt, and a running unit winds down by the rules
  let hid = S.fxAutoStep(S.makeFxAuto(), { ...base, energy: 0.95 }, 0.01, 20);
  assert.equal(hid.unit, 'gate');
  hid = S.fxAutoStep(hid.st, { ...base, ceil: 0, energy: 0.95 }, 0.01, 21);
  assert.ok(!hid.change && hid.unit === 'gate', 'held its two bars');
  hid = S.fxAutoStep(hid.st, { ...base, ceil: 0, energy: 0.95 }, 0.01, 22);
  assert.ok(hid.change && hid.unit === 'none', 'then let go, nothing new dealt');
  assert.equal(S.fxAutoPick({ ...base, ceil: 0, toSeam: 0.5 }), 'none', 'not even the seam echo on frozen inputs');
  assert.equal(S.fxAutoPick({ ...base, phase: 'break', energy: 0.4, barsIn: 1 }), 'reverb', 'a break\'s first bars are a wash');
  assert.equal(S.fxAutoPick({ ...base, phase: 'break', energy: 0.4, barsIn: 3 }), 'none', '…and only its first bars');
});
test('fxAutoSweep: a build earns a highpass up to the vocals, over the bars it has left, let go a beat before the drop', () => {
  const s = S.fxAutoSweep(16, 120, 0.9);
  assert.ok(s.hzTop >= 900 && s.hzTop <= 1400, 'the top sits under the vocals, got ' + s.hzTop);
  assert.ok(Math.abs(s.seconds - 32) < 1e-9, 'sixteen bars at 120 BPM');
  assert.ok(Math.abs(s.release - 0.5) < 1e-9, 'one beat');
  assert.ok(S.fxAutoSweep(1, 120, 0.9).seconds >= 8 && S.fxAutoSweep(999, 120, 0.9).seconds <= 128, 'clamped to a phrase and to a minute');
  assert.ok(S.fxAutoSweep(16, 120, 0.5).hzTop < S.fxAutoSweep(16, 120, 1).hzTop, 'a bigger build, a thinner room');
  assert.equal(s.qTop, 2.5);
});
test('fxGainBudget: everything that can sound at once stays under +6 dB, so the limiter is a rail nobody hears', () => {
  assert.equal(S.FX_BUDGET_DB, 6);
  for (const u of S.FX_UNITS) assert.ok(S.FX_GAIN_DB[u] != null, u + ' has a documented worst case');
  // a deck's filter, one master unit, and the previous unit's tail still ringing out
  for (const u of S.FX_UNITS) if (u !== 'filter') for (const tail of ['echo', 'reverb'])
    assert.ok(S.fxGainBudget(['filter', u, tail]) <= S.FX_BUDGET_DB, 'filter + ' + u + ' + a ' + tail + ' tail: ' + S.fxGainBudget(['filter', u, tail]) + ' dB');
  assert.equal(S.fxGainBudget([]), 0); assert.equal(S.fxGainBudget(['nothing']), 0); assert.equal(S.fxGainBudget(null), 0);
  // the parked table carries what the first rack forgot
  assert.equal(S.FX_PARK.fb, 0); assert.equal(S.FX_PARK.fbX, 0); assert.equal(S.FX_PARK.wet, 0); assert.equal(S.FX_PARK.send, 0);
  assert.equal(S.FX_PARK.gate, 1); assert.equal(S.FX_PARK.insDry, 1); assert.equal(S.FX_PARK.insWet, 0); assert.equal(S.FX_PARK.lp, 22000);
  assert.equal(S.FX_PARK.lpQ, S.Q_FLAT_DB); assert.equal(S.FX_PARK.hpQ, S.Q_FLAT_DB, 'the master corners park at a TRUE Butterworth, in dB');
});
test('the rack in the player: release walks FX_PARK, the gate is curves, the seam goes through the arbiter, nothing assigns a param', () => {
  const fx = html.slice(html.indexOf('const FX = {'), html.indexOf('const CUES = {'));
  for (const s of ['for (const k in FX_PARK){', "if (hold && (k === 'send' || k === 'fb' || k === 'fbX' || k === 'wet')) continue;",
                   'if (g.cancelAndHoldAtTime) g.setValueCurveAtTime(gateCurve(ev.from, ev.to, 32), ev.at, ev.dur);',
                   'else { g.setValueAtTime(ev.from, ev.at); g.linearRampToValueAtTime(ev.to, ev.at + ev.dur); }',
                   'if (this._gateFresh && ev.to === 1) continue;',
                   // the knob's zero end reopens the room; the re-anchor is on the queue's own grid, a hair early
                   "if (!(this.amount > 0.02)){", 'this._w(f.gate.gain, 1, 0.02);', 'this._gateStep = step;',
                   'const step = this._gateStep > 0 ? this._gateStep : fxTime(this.div, this.bpm());',
                   'try { f.gate.gain.cancelScheduledValues(Math.max(t, next - 1e-6)); } catch (e){}',
                   // the held tail: from the constant, and started at the seam's commit before the reset
                   'const fbS = this.hold ? ECHO_HOLD_FB : g.fb;', 'const fbS = want ? ECHO_HOLD_FB :',
                   "&& this._autoSt.unit === 'echo' && this.unit === 'echo'){",
                   // a hidden tab deals nothing on frozen inputs
                   'ceil: hidden ? 0 : director.ceil,',
                   // …but a build sweep already on the audio clock plays to its release, not a false drop
                   "if (hidden && this._autoSt.unit === 'filter' && AE.ctx.currentTime < this._sweepEnd) return;",
                   // the LFO: stopped late, swapped under a duck, glided on drift
                   'this._lfoEnd(U, o, at);', 'if (live){ this._w(U.lfoG.gain, 0, 0.01); this._lfoStop(u, 0.05); }',
                   'U.lfo.frequency.setTargetAtTime(fxFlangeParams(this.amount, this.div, bpm).rateHz, AE.ctx.currentTime, 0.05);',
                   'f.hp.Q.linearRampToValueAtTime(qDb(sw.qTop), tRel);', 'const qd = qDb(q); d.filter.Q.setTargetAtTime(qd, now, tau);',
                   'this._gateAt = b ? gateAnchor(t, b.at, step) : t;', 'd._fxBrake = 400 + r * 20000;',
                   'const a = fxFilterArbiter(hand, seam, brake), q = hand ? hand.q : Math.SQRT1_2;',
                   'd.filter.frequency.setTargetAtTime(a.lp, now, tau);', 'if (d._fxSched) continue;',
                   'p.exponentialRampToValueAtTime(to, t + fxEchoGlide(from, to));', 'conv.normalize = true;',
                   'const r = fxAutoStep(this._autoSt, o, barPhase, bars);', 'f.hp.frequency.exponentialRampToValueAtTime(sw.hzTop, tRel);',
                   'this._w(U.post.gain, Math.pow(10, driveTrimDb(k) / 20) / driveMakeup(k), R);'])
    assert.ok(fx.includes(s), 'FX carries: ' + s);
  assert.ok(!/\.(gain|frequency|Q|delayTime)\.value\s*=[^=]/.test(fx), 'no param in the rack is assigned — every write is a ramp or a target');
  assert.ok(!fx.includes('ramp(AE.fx.lp.frequency'), 'the brake no longer writes the master lowpass');
  assert.ok(!fx.includes('U.lfo.stop(); U.lfo.disconnect();'), 'no LFO is cut from under an audible wet');
  // no lowpass or highpass anywhere in the player is told 0.7 as if Q were linear
  assert.ok(!/type = '(lowpass|highpass)';[^\n]*Q\.value = 0\.7;/.test(html.slice(html.indexOf('const inn = AE.ctx.createGain();'), html.indexOf('AE.out = AE.ctx.createGain();'))), 'the rack\'s LP/HP biquads are Butterworth in dB');
  assert.ok(html.includes("d.hp.type = 'highpass'; d.hp.frequency.value = 20; d.hp.Q.value = Q_FLAT_DB;"), 'the deck highpass parks without a sub-bass hump');
  // the mixer declares its sweep to the arbiter; the hidden-tab timer keeps the booth\'s clocks
  for (const s of ['FX.seamOpen(nd); FX.seamSweep(od, t0, sweep);', "if (typeof FX !== 'undefined') FX.seamOpen(d);",
                   "if (document.hidden && typeof FX !== 'undefined'){ try { FX.tick(0.3); } catch (e){} }",
                   "insIn, insWet, insDry, units, insert: ''", 'xSplit.connect(xMerge, 0, 1); xSplit.connect(xMerge, 1, 0);',
                   "T('Beat FX need the engine — on this device the music plays direct')", 'id="fxMix"', 'id="fxHold"', 'id="fxKey"', 'id="fxGr"'])
    assert.ok(html.includes(s), 'the player carries: ' + s);
  assert.ok(!html.includes("{ key: 'keylock', text: 'KEY LOCK' }"), 'KEY LOCK left the pads for the knob row');
});

// ---- a deck holds a record, not a row number (R9/R29); a synced record through a seam (R13) ----
test('deckSlot: the record is held by identity — play-next, a queued album, a removal, a sort and a new queue all leave the deck naming what it holds', () => {
  const mk = n => ({ id: n, title: 'T' + n });
  let q = [mk(0), mk(1), mk(2), mk(3), mk(4)];
  const s = S.deckSlot(() => q);
  assert.equal(s.trackIdx, -1, 'empty');
  assert.equal(s.owner, 'free'); assert.equal(s.pitch, 1); assert.equal(s.cue, 0); assert.equal(s.synced, false);
  s.trackIdx = 3; s.cue = 64;
  const held = q[3];
  assert.equal(s.rec, held); assert.equal(s.trackIdx, 3);
  q.splice(1, 0, mk(10), mk(11), mk(12));                 // an album queued after the current track
  assert.equal(s.trackIdx, 6, 'the index follows the record'); assert.equal(q[s.trackIdx], held);
  const [x] = q.splice(7, 1); q.splice(0, 0, x);          // play-next lifts a row from below to the top
  assert.equal(q[s.trackIdx], held);
  q.splice(0, 2);                                          // rows removed above it
  assert.equal(q[s.trackIdx], held);
  q.sort((a, b) => b.id - a.id);                           // a sort
  assert.equal(q[s.trackIdx], held);
  q = q.slice().reverse();                                 // the queue REPLACED by a list that keeps it
  assert.equal(q[s.trackIdx], held, 'read lazily: the queue as it stands now, never a captured array');
  assert.equal(s.cue, 64, 'no record change, no cue change');
  s.trackIdx = s.trackIdx;                                 // re-seating the same record keeps its cue
  assert.equal(s.cue, 64);
  q.splice(q.indexOf(held), 1);                            // its own row removed
  assert.equal(s.trackIdx, -1, 'a record that left the queue reads as -1, never as its neighbour');
  assert.equal(s.rec, held, 'the deck still physically holds it');
  s.trackIdx = 0;                                          // another record seated (the transport, the auto-DJ)
  assert.equal(s.rec, q[0]); assert.equal(s.cue, 0, 'a new record does not inherit the last one\'s cue');
  s.trackIdx = -1; assert.equal(s.rec, null); assert.equal(s.trackIdx, -1);
  s.trackIdx = 99; assert.equal(s.rec, null, 'past the end is nothing');
  const t = S.deckSlot(() => null); t.trackIdx = 0;
  assert.equal(t.trackIdx, -1, 'no queue yet: nothing');
  const a = S.deckSlot(() => q), b = S.deckSlot(() => q);
  a.trackIdx = 0; assert.equal(b.trackIdx, -1, 'two slots, two states');
  // a SYNC belongs to the record it was set on, as the cue does (R13)
  a.pitch = 0.968; a.synced = true; a.cue = 12;
  a.trackIdx = 0;                                          // the same record re-seated (settle after a hand's commit)
  assert.equal(a.pitch, 0.968); assert.equal(a.synced, true, 'the same record keeps its match');
  q.push(mk(20)); q.splice(0, 0, mk(21));                   // the queue moves under it: still the same record
  assert.equal(a.pitch, 0.968); assert.equal(a.synced, true);
  a.trackIdx = q.length - 1;                               // another record seated (the auto-DJ's preload)
  assert.equal(a.pitch, 1); assert.equal(a.synced, false, 'a new record is matched to nothing');
  assert.equal(a.cue, 0);
  a.pitch = 1.03; a.synced = true; a.trackIdx = -1;
  assert.equal(a.pitch, 1); assert.equal(a.synced, false, 'nothing on the deck, nothing synced');
});
test('seamPitchCarry: a synced record starts the seam at its own pitch and lands at 1× — both decks alike, the plan\'s ratio kept', () => {
  assert.equal(S.seamPitchCarry(0.968, 0), 0.968, 'the on-air record exactly where it plays');
  assert.equal(S.seamPitchCarry(0.968, 1), 1, 'home at the seam\'s end');
  assert.ok(Math.abs(S.seamPitchCarry(0.968, 0.5) - 0.984) < 1e-12, 'linear across the overlap');
  assert.equal(S.seamPitchCarry(1.04, 2), 1); assert.equal(S.seamPitchCarry(1.04, -1), 1.04, 'f clamped');
  for (const bad of [0, -1, NaN, Infinity, undefined, null, 'x']) assert.equal(S.seamPitchCarry(bad, 0), 1, 'no pitch reads as 1: ' + bad);
  assert.equal(S.seamPitchCarry(1, 0.3), 1, 'an unsynced record: the seam is exactly what it was');
  let prev = S.seamPitchCarry(0.95, 0), maxStep = 0;
  for (let i = 1; i <= 100; i++){ const k = S.seamPitchCarry(0.95, i / 100); maxStep = Math.max(maxStep, Math.abs(k - prev)); assert.ok(k >= prev); prev = k; }
  assert.ok(maxStep < 0.001, 'a glide, never a step: ' + maxStep);
  // the seam's first write: A at p (no snap), B matched to A's sounding tempo — the ratio is glideRates' own
  const g = S.glideRates(124, 120, 0), k = S.seamPitchCarry(0.968, 0);
  assert.ok(Math.abs(g.rateA * k - 0.968) < 1e-12);
  assert.ok(Math.abs((g.rateB * k) / (g.rateA * k) - g.rateB / g.rateA) < 1e-12);
});
test('mix narration: a planned or playing seam outranks a deck left synced; SYNC still speaks when nothing is planned (R32)', () => {
  const sync = { deck: 'B', bpm: 120 };
  assert.match(S.mixNarration({ on: true, phase: 'armed', planType: 'fade', seamSec: 5, sync }), /^CUED/);
  assert.match(S.mixNarration({ on: true, phase: 'running', planType: 'fade', pct: 10, sync }), /^MIXING/);
  assert.equal(S.mixNarration({ on: true, phase: 'idle', sync }), 'SYNC · B matched at 120');
  assert.match(S.mixNarration({ on: true, phase: 'planning', planType: 'fade', seamSec: 50, sync }), /^SYNC/, 'a peek ahead does not outrank it');
  assert.match(S.mixNarration({ on: false, phase: 'running', sync }), /^SYNC/, 'MIX off: no seam line to outrank it');
  assert.match(S.mixNarration({ on: false, phase: 'armed' }), /MIX is off/, 'MIX off still reads as off');
  assert.match(S.mixNarration({ on: true, phase: 'manual', pct: 30, handDeck: 'B', sync }), /^HAND · you took/, 'a hand on a seam outranks all of it');
});
test('the decks in the player: slots by identity, the restore onto the idle deck, a cue per record, the element rate on a transport start, the carried pitch, the booth LOAD', () => {
  const decks = html.slice(html.indexOf('const DECKS = {'), html.indexOf('window.__mb8Decks'));
  assert.ok(decks.includes('slots: [deckSlot(() => player.tracks), deckSlot(() => player.tracks)],'), 'R9: slots hold records');
  assert.ok(!decks.includes('{ trackIdx: -1, owner:'), 'R9: no index-only slot left');
  assert.ok(decks.includes("this.load(this.idle(), t, { at: r.cue, by: 'restore' });"), 'R10: the hand\'s record returns to the idle deck');
  assert.ok(!decks.includes('const slot = r.slot === 1 ? 1 : 0;'), 'R10: the saved letter is not where it goes');
  assert.ok(decks.includes('if (!cued) s.cue = 0;'), 'R29: a transport start cues the record at its top');
  assert.ok(decks.includes('try { if (d.a.playbackRate !== SPEED.rate) d.a.playbackRate = SPEED.rate; } catch (e){}\n    setPitchLock(d.a, SPEED.keyLock);'),
    'R13: the element follows the slot it resets');
  const mixer = html.slice(html.indexOf('const MIXER = {'), html.indexOf('/* hidden tabs get no rAF'));
  assert.ok(mixer.includes("this._pA = (typeof DECKS !== 'undefined') ? DECKS.pitch(AE.active) : 1;"), 'R13: the on-air pitch is read at fire');
  assert.ok(mixer.includes('od.a.playbackRate = this._lastRateA = g.rateA * k * SPEED.rate;') && mixer.includes('nd.a.playbackRate = this._lastRateB = g.rateB * k * SPEED.rate;'), 'R13: fire carries it');
  assert.ok(mixer.includes('k = seamPitchCarry(this._pA, f);') && mixer.includes('const rA = g.rateA * k * SPEED.rate, rB = g.rateB * (1 + this.trim + (this._pull || 0)) * k * SPEED.rate;'), 'R13: the glide carries it home');
  assert.equal((mixer.match(/this\._lastRateA = this\._lastRateB = 1; this\._pA = 1;/g) || []).length, 2, 'R13: finish and cancel let it go');
  assert.ok(mixer.includes('const fresh = ws.rec !== had;') && mixer.includes('if (fresh){ const mB = mixOf(B); ws.cue = (mB && mB.in && mB.in.start) || 0; }'), 'R29: the auto-DJ\'s record gets its own cue');
  assert.ok(mixer.includes('if (fresh && nd.a.paused){\n      try { if (nd.a.playbackRate !== SPEED.rate) nd.a.playbackRate = SPEED.rate; } catch (e){}\n      setPitchLock(nd.a, SPEED.keyLock);'),
    'R13: a new record on the idle deck plays at the listener\'s rate, never a retired match');
  assert.ok(decks.includes('if (retired != null && retired >= 0){ r.trackIdx = retired; r.pitch = 1; r.synced = false; }'), 'R13: the retired deck\'s sync retires with it');
  assert.ok(decks.includes('onPlayIndex(newIdx, retired, fadeDur, cued, idx){') && decks.includes('if (idx != null && idx >= 0) s.trackIdx = idx;'), 'R13: the on-air slot names the record it plays');
  assert.ok(html.includes('DECKS.onPlayIndex(newIdx, od === nd ? -1 : retiredCur, AE.graphLive ? fadeDur : 0, cued, i);'), 'R13: playIndex says which');
  assert.ok(decks.includes("{ const r = this.slots[1 - inSlot]; r.owner = 'free'; r.pitch = 1; r.synced = false; }"), 'R13: a hand\'s commit retires the old air\'s sync too');
  assert.equal((mixer.match(/if \(hs\.owner === 'hand' && !held\)\{ if \(!hd\.a\.paused && !hd\.a\.ended\) return/g) || []).length, 2, 'R9: a hand\'s record that left the queue never leaves the deck half-claimed');
  const tr = html.slice(html.indexOf('function wireDeckTransport(){'), html.indexOf('function wireDeckTransport(){') + 6000);
  const ld = tr.slice(tr.indexOf('const load = slot => {'));
  assert.ok(ld.indexOf('if (!AE.ctx){ try { ensureCtx(); } catch (e){} }') >= 0 && ld.indexOf('if (!AE.ctx){ try { ensureCtx(); } catch (e){} }') < ld.indexOf('if (!AE.graphLive || !AE.decks)'),
    'R31: the booth LOAD births the decks before it judges them');
  assert.ok(html.includes('if (!running && !armed) for (let i = 0; i < 2 && !sync; i++) if (DECKS.slots[i].synced){'), 'R32: the booth says SYNC only with no seam planned');
});
test('the armed seam holds its record: MIXER.next is read through the queue as it stands, and an "up next" re-plans it (R9)', () => {
  const mixer = html.slice(html.indexOf('const MIXER = {'), html.indexOf('/* hidden tabs get no rAF'));
  assert.ok(!/\bnext: -1,/.test(mixer.slice(0, 2000)), 'no row-number field left');
  const g = mixer.match(/  get next\(\)\{[^\n]*\},\n  set next\(i\)\{[^\n]*\},/);
  assert.ok(g, 'next is an accessor over the record');
  const player = { tracks: [] };
  const M = new Function('player', 'return { _nextRec: null,\n' + g[0] + ' };')(player);
  const mk = n => ({ id: n });
  player.tracks = [mk(0), mk(1), mk(2), mk(3)];
  assert.equal(M.next, -1, 'nothing armed');
  M.next = 2; const B = player.tracks[2];
  assert.equal(M._nextRec, B);
  player.tracks.splice(1, 0, mk(10), mk(11), mk(12));      // an album queued next, under the armed seam
  assert.equal(M.next, 5); assert.equal(player.tracks[M.next], B, 'fire() commits the record the deck holds, not its old row');
  player.tracks.sort((a, b) => b.id - a.id);
  assert.equal(player.tracks[M.next], B);
  player.tracks = player.tracks.filter(t => t !== B);      // its row removed (or a new list played over it)
  assert.equal(M.next, -1, 'gone from the queue: nothing to fire — never its neighbour');
  M.next = -1; assert.equal(M._nextRec, null, 'cancel and finish let it go');
  M.next = 99; assert.equal(M._nextRec, null);
  // fire() reads the record through the accessor and gives up on one that left
  assert.ok(mixer.includes('const B = player.tracks[this.next];\n    if (!B){ this.cancel(); return; }'));
  assert.equal((mixer.match(/this\.plan = null; this\.next = -1;/g) || []).length, 2, 'cancel and finish clear it');
  // "up next" while armed: the plan is let go and re-armed from the queue as it now stands
  const pl = html.slice(html.indexOf('  playNext(i){'), html.indexOf('  remove(i){'));
  assert.ok(pl.includes("_upNextReplan(){\n    if (typeof MIXER !== 'undefined' && MIXER.phase === 'armed') MIXER.cancel('replan');"));
  assert.equal((pl.match(/this\._upNextReplan\(\);/g) || []).length, 2, 'play-next and queue-next both re-plan');
});

console.log(`\n${passed} passed, ${failed} failed`);
/* AND SAY SO IN THE EXIT CODE. Without this the suite printed its failures
   and exited 0, so `node tests/player.test.mjs` — the whole of the `unit`
   job, and the check CONTRIBUTING.md tells you to require before merging —
   went green on a red suite. A gate that cannot fail is not a gate. */
process.exitCode = failed ? 1 : 0;
