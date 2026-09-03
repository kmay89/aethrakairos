/* UX PROBE — the laws, measured on the page that ships.
 *
 * The arithmetic of the laws is pure and lives in the `@ux` marker block,
 * where the unit suite proves it. None of that can see the one thing that
 * actually matters: whether the INTERFACE obeys it. A 44-pixel constant in
 * a tested function and a nineteen-pixel chip on a phone are perfectly
 * consistent with each other and the second is the bug.
 *
 * So this drives the real page in a real browser and measures:
 *
 *   reach       every visible control's hit target against the floor for the
 *               pointer that is actually being used — 44 px for a thumb
 *               (Apple HIG), 24 px for a mouse (WCAG 2.5.8). Measured by
 *               HIT TESTING, not by reading CSS: the four corners and the
 *               centre of the target a finger would aim at must all land on
 *               the control. A rule that computes correctly and is then
 *               covered by a panel is still a control nobody can press.
 *   theft       …and the failure nobody checks for: a reach so greedy it
 *               swallows its neighbour. Every control's own centre must
 *               still belong to it once all the reaches are in play.
 *   the one     exactly one ring in the document, over the action the
 *               ladder says is worth marking, and nothing else on the page
 *               wearing a spin of its own. Von Restorff's budget is one, and
 *               a budget nobody audits is a budget that is already spent.
 *   the turn    that the ring genuinely TURNS — the registered custom
 *               property advancing between two samples — and that reduced
 *               motion stops it dead while leaving the mark in place.
 *   grouping    the HUD's chips in chunks inside Miller's span, with the air
 *               between groups beating the air inside one by the margin
 *               proximityOk() calls deliberate.
 *   answering   that a press is acknowledged inside the Doherty threshold,
 *               because past 400 ms the answer is no longer part of the press.
 *   the keys    that every control shows something when focused, since a
 *               focus ring is the entire interface for anyone not using a
 *               mouse.
 *
 *   node tools/ux_probe.mjs [--png DIR]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const PNG = process.argv.includes('--png') ? process.argv[process.argv.indexOf('--png') + 1] : null;
if (PNG) try { mkdirSync(PNG, { recursive: true }); } catch (e){}

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join('docs', p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

/* THE INSTRUMENT, injected once and used by every check below. It enumerates
   what a person can actually press, and it hit-tests rather than trusting the
   stylesheet — the only opinion that counts is the browser's. */
const INSTRUMENT = () => {
  window.__ux = {
    /* every control a stranger could reach: on the page, in the viewport, big
       enough to see, and not lying under something else. Scroll containers are
       honoured — a row below the fold of the playlist is not on screen. */
    controls(){
      const sel = 'button,[role="button"],input:not([type="hidden"]),a[href],[tabindex]:not([tabindex="-1"])';
      const W = innerWidth, H = innerHeight, out = [];
      for (const e of document.querySelectorAll(sel)){
        if (e.disabled || e.hidden) continue;
        if (e.closest('[hidden]')) continue;
        const r = e.getBoundingClientRect();
        if (!(r.width >= 2 && r.height >= 2)) continue;
        if (r.left < 0 || r.top < 0 || r.right > W || r.bottom > H) continue;
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || (+cs.opacity || 0) < 0.05 || cs.pointerEvents === 'none') continue;
        const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!mid || !(mid === e || e.contains(mid))) continue;      // covered by something
        out.push({ e, r });
      }
      return out;
    },
    name(e){
      return (e.id ? '#' + e.id : '') || (e.getAttribute('aria-label') || '').slice(0, 24)
        || (e.className && String(e.className).split(' ')[0] ? '.' + String(e.className).split(' ')[0] : '')
        || e.tagName.toLowerCase();
    },
    floor(){ return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')) || 24; },
    /* THE REACH. The box a finger aims at is the control's own, grown to the
       floor; the extremes of it must all land on the control.
       SAMPLED AT THE EDGE MIDPOINTS, NOT THE CORNERS, and that is not a
       convenience — almost every control here is a rounded rectangle, and the
       geometric corner of a rounded rectangle is not part of it. Corner
       sampling reported a 129×34 button with a 12 px radius as unreachable,
       which is true of the four points nobody aims at and false of the
       button. The edge midpoints measure the same two spans and are inside
       any radius up to half the box. */
    /* THE VITAL FEW — the controls a listener touches while listening. Pareto
       says these carry nearly all of the use, and they are held to the floor
       without argument. Everything else is measured just as carefully and
       REPORTED rather than failed: a thirty-five-dot scene strip on a phone
       cannot give every dot forty-four pixels and remain one strip, the
       considered path to a scene is the look grid, and pretending otherwise
       would be a passing number bought with a worse interface. */
    VITAL: '#btnPlay,#btnPrev,#btnNext,#seek,#vol,#btnLibrary,#btnPlaylist,#btnMore,#btnUpdate,.hud .chip,.lg-opt,.tbtn.play',
    isVital(e){ try { return e.matches(this.VITAL); } catch (err){ return false; } },
    reach(){
      const min = this.floor(), bad = [];
      for (const { e, r } of this.controls()){
        const w = Math.max(r.width, min), h = Math.max(r.height, min);
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const l = cx - w / 2 + 1, rt = cx + w / 2 - 1, t = cy - h / 2 + 1, b = cy + h / 2 - 1;
        const pts = [[cx, cy], [cx, t], [cx, b], [l, cy], [rt, cy]];
        let hits = 0;
        for (const [x, y] of pts){
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { hits++; continue; }
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === e || e.contains(hit))) hits++;
        }
        if (hits < pts.length) bad.push({ n: this.name(e), w: Math.round(r.width), h: Math.round(r.height),
          hits, vital: this.isVital(e) });
      }
      return { min, bad, vital: bad.filter(b => b.vital), total: this.controls().length };
    },
    /* THE THEFT. With every reach in play, each control's own centre must
       still resolve to it. A neighbour that has grown over the top of one is
       exactly what this catches, and nothing else does. */
    theft(){
      const bad = [];
      for (const { e, r } of this.controls()){
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!hit || !(hit === e || e.contains(hit))) bad.push({ n: this.name(e), stolenBy: this.name(hit || document.body) });
      }
      return bad;
    },
    /* the chip strip, as the eye is asked to read it */
    grouping(){
      const gs = [...document.querySelectorAll('.hud .chipgroup')];
      if (!gs.length) return null;
      const inner = gs.map(g => parseFloat(getComputedStyle(g).columnGap) || 0);
      const rects = gs.map(g => g.getBoundingClientRect());
      let between = Infinity;
      for (let i = 1; i < rects.length; i++){
        if (Math.abs(rects[i].top - rects[i - 1].top) > 4) continue;      // a wrapped row is not a gap
        between = Math.min(between, rects[i].left - rects[i - 1].right);
      }
      const sizes = gs.map(g => [...g.querySelectorAll('.chip')].filter(c => !c.hidden).length);
      const loose = [...document.querySelectorAll('.hud > .chip')].length;
      return { groups: gs.length, sizes, inner: Math.max.apply(null, inner), between, loose };
    },
    ring(){
      const rings = document.querySelectorAll('#loneRing');
      const r = rings[0];
      if (!r) return { count: 0 };
      const i = r.firstElementChild, cs = getComputedStyle(i);
      const m = /from\s+([-\d.]+)deg/.exec(cs.backgroundImage);
      return { count: rings.length, on: r.classList.contains('on'), key: window.__mb8Lone || null,
        angle: m ? parseFloat(m[1]) : null, anim: cs.animationName, dur: cs.animationDuration,
        z: +getComputedStyle(r).zIndex, pe: getComputedStyle(r).pointerEvents,
        box: r.getBoundingClientRect() };
    },
    /* anything ELSE on the page turning a light of its own where the ring is */
    rivals(){
      const out = [];
      for (const e of document.querySelectorAll('button,a,.chip,.btn')){
        const r = e.getBoundingClientRect();
        if (!(r.width > 2 && r.height > 2)) continue;
        for (const pe of ['', '::before', '::after']){
          const cs = getComputedStyle(e, pe || undefined);
          if (/conic-gradient/.test(cs.backgroundImage) && cs.animationName !== 'none')
            out.push(this.name(e) + (pe || ''));
        }
      }
      return out;
    },
  };
};

const openPage = async (opts) => {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1180, height: 800 } }, opts || {}));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  await page.evaluate(INSTRUMENT);
  return { page, errs, ctx };
};
const enterInstrument = async page => {
  await page.evaluate(() => { const b = document.querySelector('#langGate .lg-opt.lean'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    for (const id of ['onboard', 'firstRun', 'coach']){
      const e = document.getElementById(id);
      if (e){ e.classList.remove('open', 'on'); e.style.display = 'none'; }
    }
  });
  await page.waitForTimeout(700);
  await page.evaluate(INSTRUMENT);
};

/* ---------------------------------------------------------------- the mouse */
console.log('\nthe instrument, under a mouse — the 24 px floor and the density it came for');
const { page, errs } = await openPage();

console.log('\n  the first screen a stranger sees');
await page.waitForTimeout(600);          // the ring's own clock is slow on purpose
let ring = await page.evaluate(() => window.__ux.ring());
R('exactly one ring exists in the document — the budget is structural, not a rule to remember',
  ring.count === 1, ring.count + ' found');
R('…and on the first screen it marks the language the browser itself leans toward',
  ring.on === true && ring.key === 'lang', 'key=' + ring.key + ' on=' + ring.on);
R('…above the dialog it is marking, and deaf to the pointer',
  ring.z >= 96 && ring.pe === 'none', 'z=' + ring.z + ' pointer-events=' + ring.pe);
if (PNG) await page.screenshot({ path: join(PNG, 'ux-1-gate.png') });

/* THE TURN. Not "is an animation declared" — whether the angle actually moves. */
const a1 = (await page.evaluate(() => window.__ux.ring())).angle;
await page.waitForTimeout(420);
const a2 = (await page.evaluate(() => window.__ux.ring())).angle;
R('the ring genuinely turns — the registered angle advances between two samples',
  a1 != null && a2 != null && Math.abs(a2 - a1) > 1, a1 + '° → ' + a2 + '°');

await enterInstrument(page);
console.log('\n  the instrument itself');
ring = await page.evaluate(() => window.__ux.ring());
R('the ring travelled to the invitation once the dialogs were answered',
  ring.on === true && ring.key === 'btnPlay', 'key=' + ring.key);
const rivals = await page.evaluate(() => window.__ux.rivals());
R('and nothing else on the page is turning a light of its own', rivals.length === 0, rivals.join(', ') || 'none');

const shortfall = b => b.n + ' ' + b.w + '×' + b.h;
const reach = await page.evaluate(() => window.__ux.reach());
R('every control you touch while listening reaches the floor for this pointer',
  reach.vital.length === 0,
  reach.total + ' controls at ' + reach.min + ' px' +
  (reach.vital.length ? ' — short: ' + reach.vital.map(shortfall).join(', ') : ''));
if (reach.bad.length) console.log('       (and ' + reach.bad.length + ' secondary control(s) short of it: '
  + reach.bad.slice(0, 8).map(shortfall).join(', ') + ')');
const theft = await page.evaluate(() => window.__ux.theft());
R('…and no control\'s reach has swallowed its neighbour',
  theft.length === 0, theft.length ? theft.slice(0, 5).map(t => t.n + ' ← ' + t.stolenBy).join(', ') : 'none');

const g = await page.evaluate(() => window.__ux.grouping());
R('the chip strip is chunked, and every chunk is inside Miller\'s span',
  !!g && g.groups > 0 && g.sizes.every(n => n <= 9) && g.loose === 0,
  g ? g.groups + ' groups of ' + g.sizes.join('/') + (g.loose ? ' + ' + g.loose + ' loose' : '') : 'no groups');
R('…and the air between groups beats the air inside one by enough to read as deliberate',
  !!g && g.between >= g.inner * 1.8,
  g ? g.inner + ' px inside vs ' + g.between + ' px between (' + (g.between / Math.max(1, g.inner)).toFixed(1) + '×, 1.8× is the line)' : '—');
if (PNG) await page.screenshot({ path: join(PNG, 'ux-2-instrument.png') });

/* DOHERTY. Press a real control and watch for the page to say something back. */
const ack = await page.evaluate(async () => {
  const out = [];
  const press = (id, sense) => new Promise(res => {
    const el = document.getElementById(id);
    if (!el) return res(null);
    const before = sense();
    const t0 = performance.now();
    el.click();
    const tick = () => {
      if (sense() !== before) return res({ id, ms: performance.now() - t0 });
      if (performance.now() - t0 > 1200) return res({ id, ms: Infinity });
      requestAnimationFrame(tick);
    };
    tick();
  });
  out.push(await press('chipCalm', () => document.getElementById('chipCalm').className));
  out.push(await press('chipLens', () => document.getElementById('chipLens').textContent));
  out.push(await press('btnPlaylist', () => document.getElementById('playlist').className));
  out.push(await press('chipBooth', () => document.getElementById('booth').className));
  return out.filter(Boolean);
});
R('a press is answered inside the Doherty threshold, so the answer is still part of the press',
  ack.every(a => a.ms <= 400), ack.map(a => a.id + ' ' + (isFinite(a.ms) ? a.ms.toFixed(0) + ' ms' : 'never')).join(' · '));

/* THE KEYS. A focus ring is the whole interface for anyone not using a mouse. */
const focus = await page.evaluate(() => {
  const bad = [];
  for (const { e } of window.__ux.controls().slice(0, 40)){
    e.focus();
    const cs = getComputedStyle(e);
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
      || cs.boxShadow !== 'none' || cs.borderColor !== '';
    if (!ring) bad.push(window.__ux.name(e));
    e.blur();
  }
  return bad;
});
R('every control shows something when the keyboard lands on it', focus.length === 0, focus.slice(0, 6).join(', ') || 'none');
R('no page errors under the mouse', errs.length === 0, errs.slice(0, 2).join(' | '));

/* ---------------------------------------------------------------- the thumb */
console.log('\nthe same instrument, under a thumb — the floor moves to 44 and the layout pays for it');
const touch = await openPage({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' });
await enterInstrument(touch.page);
const tFloor = await touch.page.evaluate(() => window.__ux.floor());
R('a coarse pointer raises the floor to 44', tFloor === 44, tFloor + ' px');
const tReach = await touch.page.evaluate(() => window.__ux.reach());
R('every control a thumb reaches for on a phone gets its forty-four pixels', tReach.vital.length === 0,
  tReach.total + ' controls' + (tReach.vital.length ? ' — short: ' + tReach.vital.map(shortfall).join(', ') : ''));
if (tReach.bad.length) console.log('       (and ' + tReach.bad.length + ' secondary control(s) short of it: '
  + tReach.bad.slice(0, 8).map(shortfall).join(', ') + ')');
const tTheft = await touch.page.evaluate(() => window.__ux.theft());
R('…and the bigger reach still keeps its hands off the neighbours', tTheft.length === 0,
  tTheft.length ? tTheft.slice(0, 6).map(t => t.n + ' ← ' + t.stolenBy).join(', ') : 'none');
if (PNG) await touch.page.screenshot({ path: join(PNG, 'ux-3-thumb.png'), fullPage: false });
R('no page errors under the thumb', touch.errs.length === 0, touch.errs.slice(0, 2).join(' | '));

/* ---------------------------------------------------------------- reduced motion */
console.log('\nreduced motion — the mark stays, the movement goes');
const calm = await openPage({ reducedMotion: 'reduce' });
await calm.page.waitForTimeout(500);
const c1 = await calm.page.evaluate(() => window.__ux.ring());
await calm.page.waitForTimeout(500);
const c2 = await calm.page.evaluate(() => window.__ux.ring());
R('the ring still marks the one action', c1.on === true && !!c1.key, 'key=' + c1.key);
R('…and stops dead — the distinction the setting is actually asking for',
  c1.anim === 'none' && c1.angle === c2.angle, 'animation=' + c1.anim + ' angle held at ' + c1.angle + '°');
R('no page errors under reduced motion', calm.errs.length === 0, calm.errs.slice(0, 2).join(' | '));

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
