/* PIANO PROBE — opens the piano hidden in the ∞ and walks every tab: the
 * lessons, the circle, the beat with backing, the mic panel, the settings.
 * Fails on any page error, and photographs each face so the look can be
 * judged by eye (booth and phone widths).
 *
 *   node tools/piano_probe.mjs [outDir]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const out = process.argv[2] || 'tests/_tmp_piano';
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join('docs', p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL', m); };

for (const [label, vp] of [['booth', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]){
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: label === 'phone' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('mb8_lang', 'en'); } catch (e){} });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && /piano|Pn|pn/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(origin + '/?piano', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  await page.evaluate(() => {
    const b = document.querySelector('#langGate .lg-opt.lean'); if (b) b.click();
    for (const id of ['langGate', 'firstRun', 'help', 'coach', 'onboard', 'library', 'console', 'playlist', 'emptyState', 'splash'])
      { const n = document.getElementById(id); if (n){ n.classList.remove('open', 'on'); n.style.display = 'none'; } }
  });
  await page.waitForSelector('#piano.open', { timeout: 8000 }).catch(() => fail(label + ': ?piano did not open the piano'));
  await page.waitForTimeout(600);
  // a few keys, by pointer and by the computer keyboard
  const box = await page.locator('#pnCanvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9);
  await page.keyboard.down('z'); await page.keyboard.down('c'); await page.keyboard.down('b');
  await page.waitForTimeout(250);
  const chord = await page.evaluate(() => (PIANO.lastChord && PIANO.lastChord.name) || null);
  if (chord !== 'C') fail(label + ': holding Z C B should name C major, got ' + chord);
  await page.keyboard.up('z'); await page.keyboard.up('c'); await page.keyboard.up('b');
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, label + '-learn.png') });
  // the lesson runner heard the keys
  const stepType = await page.evaluate(() => PIANO.runner.step.type);
  console.log('  ', label, 'first step:', stepType, 'lesson:', await page.evaluate(() => PIANO.state.lessonId));
  // step through a press step with the guide showing
  await page.evaluate(() => { PIANO.runner.goto(1); PIANO._applyGuide(); PIANO.renderLessonBody(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, label + '-lesson-press.png') });
  const guide = await page.evaluate(() => PIANO.stage.guide.badges.length);
  if (guide < 3) fail(label + ': the press step should badge three fingers, got ' + guide);
  await page.evaluate(() => { for (const n of [64, 67, 72]) PIANO.playNote(n, 0.7, true, 'probe'); });
  await page.waitForTimeout(150);
  if (!(await page.evaluate(() => PIANO.runner.done))) fail(label + ': holding E G C should complete "Bar 1: C"');
  await page.evaluate(() => { for (const n of [64, 67, 72]) PIANO.playNote(n, 0, false, 'probe'); });
  // a song step: the finger for the next note on its key
  await page.evaluate(() => { PIANO.setLesson('odetojoy'); PIANO.runner.goto(1); PIANO._applyGuide(); PIANO.renderLessonBody(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, label + '-song.png') });
  // an ear-training round through the buttons: play, then name it
  await page.evaluate(() => { PIANO.setLesson('earintervals'); PIANO.runner.goto(1); PIANO._applyGuide(); PIANO.renderLessonBody(); });
  await page.waitForTimeout(200);
  await page.click('#pnEarPlay');
  await page.waitForTimeout(300);
  const right = await page.evaluate(() => PIANO.runner.step.choices.indexOf(PIANO.runner.earTarget()));
  await page.click('[data-e="' + right + '"]');
  await page.waitForTimeout(150);
  if ((await page.evaluate(() => PIANO.runner.streak)) !== 1) fail(label + ': a right ear answer should start the streak');
  await page.screenshot({ path: join(out, label + '-ear.png') });
  // the record: the library chart becomes a lesson; the play-along step is judged on the record's beat (stubbed here — no audio host in the sandbox)
  await page.evaluate(() => PIANO.setLesson('chart:highway'));
  await page.waitForFunction(() => PIANO.runner && PIANO.runner.lesson.id === 'chart:highway', null, { timeout: 8000 }).catch(() => fail(label + ': the Highway chart lesson did not load'));
  const chartSteps = await page.evaluate(() => PIANO.runner.lesson.steps.map(s => s.type));
  if (!chartSteps.includes('playalong') || !chartSteps.includes('press')) fail(label + ': the chart lesson lacks shapes or play-along, got ' + chartSteps.join(','));
  const keyNow = await page.evaluate(() => pnKeyName(PIANO.state.key));
  if (keyNow !== 'D♭ major') fail(label + ': opening the chart should set the key to D♭ major, got ' + keyNow);
  await page.evaluate(() => { const i = PIANO.runner.lesson.steps.findIndex(s => s.type === 'playalong'); PIANO.runner.goto(i); PIANO._applyGuide(); PIANO.renderLessonBody(); });
  await page.evaluate(() => { PIANO.record = { chart: PIANO.charts.highway, bar: 14 }; PIANO._stubBeat = 56.0; PIANO._realRecordBeat = PIANO.recordBeat; PIANO.recordBeat = () => PIANO._stubBeat; });
  await page.waitForTimeout(400);
  const falling = await page.evaluate(() => PIANO.stage.guideEvents.length);
  if (falling < 4) fail(label + ': the record\'s notes should fall down the highway, got ' + falling);
  const hit = await page.evaluate(() => { const st = PIANO.runner.step; const n = st.notes.find(x => x.b >= 56); PIANO._stubBeat = n.b + 0.05; PIANO.playNote(n.m, 0.8, true, 'probe'); PIANO.playNote(n.m, 0, false, 'probe'); return PIANO.runner.hits; });
  if (hit !== 1) fail(label + ': playing the falling note on the beat should count a hit, got ' + hit);
  await page.screenshot({ path: join(out, label + '-record.png') });
  await page.evaluate(() => { PIANO.recordBeat = PIANO._realRecordBeat; PIANO.record = null; PIANO.setLesson('fourchords'); });
  // explore
  await page.evaluate(() => PIANO.setMode('explore'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, label + '-explore.png') });
  const circle = await page.locator('#pnCircle').boundingBox();
  if (circle){
    await page.mouse.click(circle.x + circle.width * 0.5, circle.y + circle.height * 0.08); // the top sector: C major
    await page.waitForTimeout(200);
    const k = await page.evaluate(() => pnKeyName(PIANO.state.key));
    if (k !== 'C major') fail(label + ': the top of the circle is C major, got ' + k);
    await page.mouse.click(circle.x + circle.width * 0.92, circle.y + circle.height * 0.5); // three o'clock: A major
    await page.waitForTimeout(200);
    const k2 = await page.evaluate(() => pnKeyName(PIANO.state.key));
    if (k2 !== 'A major') fail(label + ': three o\'clock on the circle is A major, got ' + k2);
    await page.evaluate(() => PIANO.setKey(pnMakeKey(0, 'major')));
  }
  // perform: beat on, chords row lit
  await page.evaluate(() => PIANO.setMode('perform'));
  await page.waitForTimeout(300);
  await page.click('#pnPlay');
  await page.waitForTimeout(2600);
  const running = await page.evaluate(() => PIANO.clock.running && PIANO.clock.beat > 2);
  if (!running) fail(label + ': the beat should be running');
  const ev = await page.evaluate(() => PIANO.stage.guideEvents.length);
  if (ev < 3) fail(label + ': falling guide notes expected while the loop runs, got ' + ev);
  await page.evaluate(() => { for (const n of [60, 64, 67]) PIANO.playNote(n, 0.8, true, 'probe'); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, label + '-perform.png') });
  await page.evaluate(() => { for (const n of [60, 64, 67]) PIANO.playNote(n, 0, false, 'probe'); });
  const chordIdx = await page.evaluate(() => PIANO.currentChordIndex);
  if (chordIdx < 0) fail(label + ': the chord row should follow the bar');
  await page.click('#pnPlay');
  // recording round trip
  await page.evaluate(() => { PIANO.toggleRecord(); PIANO.playNote(60, 0.7, true, 'probe'); PIANO.playNote(60, 0, false, 'probe'); PIANO.toggleRecord(); });
  const recN = await page.evaluate(() => PIANO.rec.length);
  if (recN !== 2) fail(label + ': a note on/off should record two events, got ' + recN);
  // listen + settings
  await page.evaluate(() => PIANO.setMode('listen'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, label + '-listen.png') });
  await page.evaluate(() => PIANO.setMode('settings'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, label + '-settings.png') });
  // escape closes; the player shortcut is back
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await page.evaluate(() => PIANO.on)) fail(label + ': Escape should close the piano');
  if (await page.evaluate(() => PIANO.clock.running)) fail(label + ': closing stops the beat');
  // the ∞, five taps
  await page.evaluate(() => { const n = document.querySelector('.wordmark .loop8'); for (let i = 0; i < 5; i++) n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => PIANO.on))) fail(label + ': five taps on the ∞ should open the piano');
  await page.evaluate(() => PIANO.show(false));
  if (errs.length){ bad++; console.log('FAIL', label, 'errors:\n  ' + errs.join('\n  ')); }
  else console.log('  ok', label);
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? `\n${bad} problem(s)` : '\npiano probe clean, booth and phone alike');
process.exit(bad ? 1 : 0);
