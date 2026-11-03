/* iOS BOOTH PROBE — two decks on an iPhone, with the media on another origin.
 *
 * DECKROUTE lets an iPhone's open booth take the decks into the Web Audio graph
 * and give them back to direct elements when it closes, hides or loses its
 * context. The one thing every older probe could not see is TAINT: they serve
 * the page and the music from one origin with a permissive header, and a
 * capture of a no-CORS cross-origin stream — the shipped catalog's media host,
 * every first track of every session — outputs pure zeros with no error. So
 * this probe serves the page on one origin and the music on ANOTHER:
 *
 *   /cors/…     the header on every response (what the media host sends)
 *   /nocors/…   no header at all (a CORS-mode load fails; a direct one plays)
 *   /flaky/…    the header on the first response only, so a later ranged
 *               request mid-track fails the CORS check (MEDIA_ERR code 4)
 *
 * paced like a real pipe, so a seek far ahead really is a new request.
 * Chromium, like WebKit, outputs zeros from a tainted MediaElementSource, so
 * taint is observable here. An iPhone iOS 18 user agent, a stubbed
 * navigator.audioSession, the autoplay policy that wants a gesture, real taps
 * for every gesture that matters, and ?decks=graph (the route ships off).
 *
 * What it holds the route to (scenario names follow the design's probe plan):
 *   S1  boot is direct, exactly as today
 *   S2  the open booth takes the decks mid-track: no stop, no false pause, the
 *       swap lined up, and the speaker hears the graph right after
 *   S3  the probe can see taint: a capture of a no-CORS element is silent
 *   S4  under the graph: deck B loads and plays, the crossfader blends both,
 *       both platters scratch, MIX NOW changes the record (rates held at 1×:
 *       two tempi meet in the fade), SYNC stands down and says why
 *   S5  the closing booth gives back to direct without stopping
 *   S6  a hidden page gives the decks back
 *   S8  a CORS-refused crossover never leaves a tainted capture as the only
 *       audible path: the decks wait for the next track, and join there
 *   S9  a CORS failure mid-track hands that record back direct from its spot
 *   S10 NEXT during a take calls it off; the music never stops
 *   S11 decks=direct, and an iOS the gate leaves out, behave as today
 * Chromium cannot show: per-element blessing, the lock screen, the real tap
 * and mute lags, AirPlay, WebKit's drift between two captured elements, iOS
 * memory — that is the device checklist's.
 *
 *   node tools/ios_booth_probe.mjs /tmp/mb8-mix
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, copyFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const ONLY = process.env.MB8_ONLY || '';          // main | variants | taint | lost | gated | worklets: one bench, while iterating
const DIR = args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/mb8-mix';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const f of ['index.html', 'sw.js', 'three.min.js']){
  const from = join(ROOT, 'docs', f);
  if (existsSync(from) && existsSync(DIR)) copyFileSync(from, join(DIR, f));
}
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };

// ---- the media host: another origin, three behaviours, a paced pipe -------
const KBPS = 6000;
const flakySeen = new Map(), flakyLog = [];
let mediaRequests = 0;
const media = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/(cors|nocors|flaky)\/(.*)$/);
  if (!m){ res.writeHead(404); res.end(); return; }
  const f = join(DIR, decodeURIComponent(m[2]));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const mode = m[1];
  const n = (flakySeen.get(u.pathname) || 0) + 1; flakySeen.set(u.pathname, n);
  // flaky: the header on the opening response (from byte 0) only — a ranged request from further in goes without
  const from0 = !req.headers.range || /bytes=0-/.test(req.headers.range);
  const allow = mode === 'cors' || (mode === 'flaky' && from0);
  if (mode === 'flaky') flakyLog.push((req.headers.range || 'all') + (allow ? ' +acao' : ' -acao'));
  const data = readFileSync(f);
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (allow) headers['Access-Control-Allow-Origin'] = '*';
  if (req.method === 'OPTIONS'){ res.writeHead(204, headers); res.end(); return; }
  const range = req.headers.range && req.headers.range.match(/bytes=(\d+)-(\d*)/);
  let body = data, status = 200, extra = {};
  if (range){
    const s0 = +range[1], e = range[2] ? +range[2] : data.length - 1;
    body = data.subarray(s0, e + 1); status = 206;
    extra = { 'Content-Range': `bytes ${s0}-${e}/${data.length}` };
  }
  mediaRequests++;
  res.writeHead(status, { ...headers, ...extra, 'Content-Length': body.length });
  const perMs = (KBPS * 1024 / 8) / 1000, CH = 32 * 1024;
  let off = 0, gone = false;
  res.on('close', () => { gone = true; });
  const pump = () => {
    if (gone) return;
    if (off >= body.length){ res.end(); return; }
    const k = Math.min(CH, body.length - off);
    res.write(body.subarray(off, off + k)); off += k;
    setTimeout(pump, k / perMs);
  };
  pump();
});
await new Promise(r => media.listen(0, '127.0.0.1', r));
const MEDIA = `http://127.0.0.1:${media.address().port}`;

// ---- the page's own origin --------------------------------------------------
const page0 = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  let body = readFileSync(f);
  // the catalog points at the media host, as the shipped one does
  if (p === '/catalog.json'){
    const c = JSON.parse(body.toString('utf8')); c.base = MEDIA + '/cors/' + (c.base || 'audio');
    body = Buffer.from(JSON.stringify(c));
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
});
await new Promise(r => page0.listen(0, '127.0.0.1', r));
const SITE = `http://127.0.0.1:${page0.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const UA18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const UA176 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  · ' + detail : ''));
};
const NOISE = /404|Failed to fetch|net::ERR|NotAllowedError|The play\(\) request|AbortError|CORS|MEDIA_ERR|NotSupportedError|no supported source/;

async function open(label, { ua = UA18, query = '?decks=graph', session = true } = {}){
  console.log('\n' + label);
  const ctx = await browser.newContext({ ...devices['iPhone 13'], userAgent: ua });
  await ctx.addInitScript(([session]) => {
    try { localStorage.setItem('mb8_lang', 'en'); } catch (e){}
    // Safari 16.4+'s audio session; Chromium has none, so the route's gate needs it stubbed
    if (session && !navigator.audioSession) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' }, configurable: true });
    // a page the probe can hide: document.hidden / visibilityState answer window.__hide
    for (const [k, v] of [['hidden', () => !!window.__hide], ['visibilityState', () => window.__hide ? 'hidden' : 'visible']])
      Object.defineProperty(Document.prototype, k, { get: v, configurable: true });
  }, [session]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { const m = String(e).split('\n')[0]; if (!NOISE.test(m)) errs.push(m); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(SITE + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 90000 });
  await page.evaluate(() => {
    for (const id of ['firstRun', 'help', 'coach', 'onboard', 'library', 'console', 'playlist', 'emptyState', 'splash'])
      { const n = document.getElementById(id); if (n){ n.classList.remove('open'); n.style.display = 'none'; } }
    if (typeof firstRunClose === 'function') try { firstRunClose(); } catch (e){}
    try { director.setAuto(false); } catch (e){}
    try { renderer.render = () => {}; } catch (e){}   // the bench's software GPU would starve the timers under test
    player.repeat = 'off'; player.shuffle = false;
  });
  return { ctx, page, errs };
}
const idx = (page, title) => page.evaluate(t => player.tracks.findIndex(x => x.title === t), title);
// a real tap somewhere harmless: a gesture, so the next call runs with transient activation
const touch = async page => { await page.touchscreen.tap(195, 120); };
// the booth's own controls, tapped: the chip opens it, its close button (which covers the chip on a phone) shuts it
const tapBooth = async page => {
  const id = await page.evaluate(() => BOOTH.open ? 'boothClose' : 'chipBooth');
  const vis = await page.evaluate(id => { const b = document.getElementById(id); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden'; }, id);
  let ok = false;
  if (vis) ok = await page.tap('#' + id, { timeout: 4000 }).then(() => true).catch(() => false);
  if (!ok){ await touch(page); await page.evaluate(() => BOOTH.toggle()); }
};
/* ▶ AS A FINGER PRESSES IT. On a phone the open booth covers the transport,
   so the probe floats its own ▶ above everything — a real button, a real tap,
   the transport's own toggle in its click handler, exactly as the lock
   screen's or the bar's ▶ would run it. */
const pressPlay = async page => {
  await page.evaluate(() => {
    if (document.getElementById('__probePlay')) return;
    const b = document.createElement('button'); b.id = '__probePlay'; b.textContent = '▶';
    Object.assign(b.style, { position: 'fixed', left: '4px', top: '4px', width: '44px', height: '44px', zIndex: 2147483647 });
    b.addEventListener('click', () => player.toggle());
    document.body.appendChild(b);
  });
  await page.tap('#__probePlay');
};
// the instruments: a 50 ms sampler of the transport and the route, and an ear at the speaker (the graph's output)
const instrument = page => page.evaluate(() => {
  window.__S = []; window.__lv = [];
  const sp = AE.ctx.createScriptProcessor(1024, 2, 1);
  sp.onaudioprocess = e => { const x = e.inputBuffer.getChannelData(0); let q = 0; for (const v of x) q += v * v; window.__lv.push({ w: performance.now(), rms: Math.sqrt(q / x.length) }); };
  const z = AE.ctx.createGain(); z.gain.value = 0; AE.out.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
  window.__mark = () => { window.__S = []; window.__lv = []; };
  clearInterval(window.__si);
  window.__si = setInterval(() => {
    const d = AE.decks && AE.decks[AE.active];
    const els = (AE.decks || []).map(k => k.a).concat(DECKROUTE.twins.map(t => t.a));
    window.__S.push({ w: performance.now(), playing: player.playing, active: AE.active, ct: d ? d.a.currentTime : -1,
      paused: d ? d.a.paused : true, muted: d ? d.a.muted : false, phase: DECKROUTE.phase, graph: AE.graphLive, cur: player.cur,
      srcs: els.filter(a => a.src && !/^data:/.test(a.src)).length });
  }, 50);
});
const samples = page => page.evaluate(() => ({ S: window.__S.slice(), lv: window.__lv.slice() }));
const sysPauses = page => page.evaluate(() => (ACTIVITY.list || []).filter(e => /system paused/.test(e.m || '')).length).catch(() => -1);
// the transport through a window: never paused, the on-air clock never jumping
function continuity(S){
  let stops = 0, jumps = 0, maxSrc = 0, worst = 0;
  for (let i = 1; i < S.length; i++){
    if (!S[i].playing) stops++;
    maxSrc = Math.max(maxSrc, S[i].srcs);
    if (S[i].cur !== S[i - 1].cur) continue;           // a track change is a new clock
    const exp = (S[i].w - S[i - 1].w) / 1000, got = S[i].ct - S[i - 1].ct;
    const off = got - exp;
    if (Math.abs(off) > Math.abs(worst)) worst = off;
    if (off < -0.3 || off > 0.3) jumps++;
  }
  return { stops, jumps, maxSrc, worst: +worst.toFixed(3) };
}
const peakAfter = (lv, w0, ms) => lv.filter(x => x.w >= w0 && x.w < w0 + ms).reduce((m, x) => Math.max(m, x.rms), 0);
const quietestBlockAfter = (lv, w0, ms) => { const v = lv.filter(x => x.w >= w0 && x.w < w0 + ms); return v.length ? Math.min(...v.map(x => x.rms)) : 0; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// ===========================================================================
// THE MAIN BENCH: an iPhone on iOS 18, the route opted in
// ===========================================================================
if (!ONLY || ONLY === 'main'){
  const { ctx, page, errs } = await open('an iPhone on iOS 18, ?decks=graph, the media on another origin');
  // S1 — boot
  const s1 = await page.evaluate(() => ({ ios: IS_IOS, gate: IOS_GRAPH, graph: AE.graphLive, phase: DECKROUTE.phase }));
  R('S1 boot: the route is open on this device, and boot is direct as today', s1.ios && s1.gate && !s1.graph && s1.phase === 'direct', JSON.stringify(s1));
  const iA = await idx(page, 'alpha'), iB = await idx(page, 'beta');
  if (iA < 0 || iB < 0){ console.log('fixture lacks alpha/beta'); process.exit(1); }
  await page.evaluate(([a, b]) => { player.prepare(a, 0); player._committedNext = b; }, [iA, iB]);
  await page.tap('#btnPlay');
  const rolling = await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1.5', null, { timeout: 30000 }).then(() => true).catch(() => false);
  const d0 = await page.evaluate(() => ({ cors: AE.decks.map(d => d.a.crossOrigin), src: activeDeck().a.currentSrc, graph: AE.graphLive }));
  R('S1 the first record plays direct, no-CORS, from the media host (tainted for the graph)', rolling && !d0.graph && d0.cors.every(c => !c) && d0.src.startsWith(MEDIA), JSON.stringify(d0));
  await instrument(page);

  // S2 — take mid-track, in the tap that opens the booth
  await page.evaluate(() => window.__mark());
  const t0 = await page.evaluate(() => performance.now());
  await tapBooth(page);
  const took = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 6000 }).then(() => true).catch(() => false);
  await wait(2400);
  const s2 = await page.evaluate(() => ({ route: window.__mb8Route(), active: AE.active, graph: AE.graphLive,
    cors: AE.decks.map(d => d.a.crossOrigin), src: activeDeck().a.currentSrc, vinyl: window.__mb8VinylDecks,
    gain: activeDeck().gain ? activeDeck().gain.gain.value : -1, swapAt: (window.__S.find(x => x.graph) || {}).w,
    session: navigator.audioSession.type, held: ratesHeld(), rate: activeDeck().a.playbackRate }));

  const { S, lv } = await samples(page);
  const c2 = continuity(S);
  const swapW = (S.find(x => x.phase !== 'taking' && x.active !== S[0].active) || {}).w;
  R('S2 the open booth takes the decks into the graph within 4 s', took && s2.graph && s2.route.phase === 'graph' && (swapW ? swapW - t0 < 4000 : false),
    swapW ? 'swapped ' + Math.round(swapW - t0) + ' ms after the tap' : JSON.stringify(s2.route));
  R('S2 the air moved to deck B; both decks are CORS-mode now; the record on air is CORS or a blob', s2.active !== S[0].active && s2.cors.every(c => c === 'anonymous')
    && (s2.src.startsWith(MEDIA) || s2.src.startsWith('blob:')), 'active ' + S[0].active + '→' + s2.active + ' · ' + s2.src.slice(0, 40));
  R('S2 the music never stopped and the clock never jumped (|Δ| ≤ 0.3 s per 50 ms)', c2.stops === 0 && c2.jumps === 0, JSON.stringify(c2));
  R('S2 at most two deck decoders at every sample (twins stay empty)', c2.maxSrc <= 2, 'max ' + c2.maxSrc);
  if (swapW){
    const p300 = peakAfter(lv, swapW, 400), floor = quietestBlockAfter(lv, swapW + 400, 2000);
    R('S2 the speaker hears the graph within 300 ms of the swap, and steadily for 2 s', p300 > 0.01 && floor > 0.003,
      'peak ' + p300.toFixed(4) + ' · quietest block ' + floor.toFixed(4));
  } else R('S2 the speaker hears the graph after the swap', false, 'no swap seen');
  R('S2 the session says playback; both platters are seated; the rates are held at 1×', s2.session === 'playback'
    && s2.vinyl && s2.vinyl.A === 'worklet' && s2.vinyl.B === 'worklet' && s2.held && s2.rate === 1, JSON.stringify({ s: s2.session, v: s2.vinyl, held: s2.held, r: s2.rate }));
  R('S2 no false "the system paused the audio"', (await sysPauses(page)) === 0);

  // S3 — negative control: a no-CORS capture is silent, so this probe can see taint
  const s3 = await page.evaluate(async url => {
    const a = new Audio(); a.src = url; a.loop = true; a.muted = false;
    await a.play().catch(() => {});
    for (let k = 0; k < 40 && a.currentTime < 0.5; k++) await new Promise(r => setTimeout(r, 100));
    const an = AE.ctx.createAnalyser(); an.fftSize = 2048;
    const s = AE.ctx.createMediaElementSource(a); s.connect(an);
    await new Promise(r => setTimeout(r, 700));
    const b = new Float32Array(2048); an.getFloatTimeDomainData(b); let q = 0; for (const v of b) q += v * v;
    const t = a.currentTime; a.pause(); a.removeAttribute('src'); a.load();
    return { rms: Math.sqrt(q / b.length), t };
  }, MEDIA + '/nocors/audio/deck-beta/01-beta.mp3');
  R('S3 negative control: a capture of a no-CORS cross-origin element is silent here, as on WebKit', s3.t > 0.5 && s3.rms < 1e-4, 'rms ' + s3.rms.toExponential(2) + ' at ' + s3.t.toFixed(2) + ' s');

  // S4 — under the graph: deck B, the crossfader, both platters, SYNC, MIX NOW
  const s4 = await page.evaluate(async b => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const idle = DECKS.idle();
    const loaded = DECKS.load(idle, player.tracks[b]);
    for (let k = 0; k < 80 && AE.decks[idle].a.readyState < 2; k++) await sleep(100);
    const played = DECKS.play(idle);
    await sleep(800);
    const ear = () => { const v = window.__lv.slice(-6); return v.length ? Math.min(...v.map(x => x.rms)) : 0; };
    const sweep = [];
    DECKS.faderGrab(AE.active);
    for (let i = 0; i <= 10; i++){
      const x = AE.active === 0 ? i / 10 : 1 - i / 10;
      DECKS.faderMove(x); await sleep(220);
      sweep.push({ x, rms: ear(), fA: AE.decks[0].fader.gain.value, fB: AE.decks[1].fader.gain.value });
    }
    DECKS.faderMove(AE.active); DECKS.faderRelease();
    await sleep(200);
    // SYNC: a rate, and these decks hold 1×
    DECKS.focus = idle;
    const sync = DECKS.sync(idle), syncWhy = BOOTH._txt['boothSt' + (idle ? 'B' : 'A')] || '';
    return { loaded, played, idle, bPlaying: !AE.decks[idle].a.paused, sweep, sync, syncedFlag: DECKS.slots[idle].synced, rateB: AE.decks[idle].a.playbackRate };
  }, iB);
  const minRms = Math.min(...s4.sweep.map(x => x.rms));
  const follows = s4.sweep.every(x => x.fA >= 0 && x.fB >= 0) && Math.abs(s4.sweep[0].fA - s4.sweep[10].fA) > 0.5 && Math.abs(s4.sweep[0].fB - s4.sweep[10].fB) > 0.5;
  R('S4 deck B loads and plays by hand under the graph', s4.loaded && s4.played && s4.bPlaying, JSON.stringify({ loaded: s4.loaded, played: s4.played }));
  R('S4 the crossfader sweeps end to end with the speaker never silent, both faders following', minRms > 0.003 && follows,
    'quietest ' + minRms.toFixed(4) + ' · fA ' + s4.sweep[0].fA.toFixed(2) + '→' + s4.sweep[10].fA.toFixed(2) + ' · fB ' + s4.sweep[0].fB.toFixed(2) + '→' + s4.sweep[10].fB.toFixed(2));
  R('S4 SYNC stands down on held rates (no false match, B stays at 1×)', !s4.sync && !s4.syncedFlag && s4.rateB === 1, 'rate ' + s4.rateB);
  // both platters, each its own record
  const plat = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = [];
    for (const i of [0, 1]){
      const h = VINYL.for(i);
      const why = h.why();
      const ok = h.engage(false);
      await sleep(200);
      try { h.grab && h.grab(); } catch (e){}
      const e = h.engaged;
      h.drop(); await sleep(150);
      out.push({ i, why, ok, engaged: e, after: h.engaged, kind: h.kind });
    }
    return out;
  });
  R('S4 both platters take their own record and let it go', plat.every(p => p.ok && p.engaged && !p.after && p.kind === 'worklet'), JSON.stringify(plat.map(p => ({ i: p.i, ok: p.ok, why: p.why }))));
  // MIX NOW on a pair at two tempi: held rates turn the beatmix into the fade — and the record changes
  await page.evaluate(() => { DECKS.pause(DECKS.idle()); DECKS.eject(DECKS.idle()); });
  const s4m = await page.evaluate(async b => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const before = player.tracks[player.cur].title, act = AE.active;
    player._committedNext = b;
    const took = MIXER.tryMixNow();
    for (let k = 0; k < 120 && (AE.xfading || MIXER.phase !== 'idle' || player.tracks[player.cur].title === before); k++) await sleep(100);
    return { took, before, after: player.tracks[player.cur].title, act0: act, act1: AE.active, rates: AE.decks.map(d => d.a.playbackRate) };
  }, (await idx(page, 'tau')));
  R('S4 MIX NOW blends to the next record (a fade: two tempi on held rates), the air changes decks, rates stay 1×',
    s4m.took && s4m.after !== s4m.before && s4m.act1 !== s4m.act0 && s4m.rates.every(r => r === 1), JSON.stringify(s4m));

  // S5 — give at booth close: no stop, back to direct
  await page.evaluate(() => window.__mark());
  const g0 = await page.evaluate(() => performance.now());
  await tapBooth(page);
  const gave = await page.waitForFunction('DECKROUTE.phase === "direct" && !AE.graphLive', null, { timeout: 6000 }).then(() => true).catch(() => false);
  await wait(1200);
  const s5 = await page.evaluate(() => ({ graph: AE.graphLive, cors: AE.decks.map(d => d.a.crossOrigin), nodes: AE.decks.map(d => !!d.gain),
    on: { paused: activeDeck().a.paused, muted: activeDeck().a.muted, vol: activeDeck().a.volume }, slots: window.__mb8Decks().slots.map(s => s.owner),
    log: (ACTIVITY.list || []).slice(0, 3) }));
  const S5 = await samples(page), c5 = continuity(S5.S);
  const backW = (S5.S.find(x => !x.graph) || {}).w;
  R('S5 the closing booth gives the decks back to direct within 3 s', gave && !s5.graph && backW && backW - g0 < 3000, backW ? Math.round(backW - g0) + ' ms' : 'never');
  R('S5 direct elements again: no CORS, no chain, the record on air unmuted and rolling', s5.cors.every(c => !c) && s5.nodes.every(n => !n) && !s5.on.paused && !s5.on.muted && s5.on.vol > 0, JSON.stringify(s5.on));
  R('S5 the music never stopped through the hand-back, no clock jump', c5.stops === 0 && c5.jumps === 0 && c5.maxSrc <= 2, JSON.stringify(c5));
  R('S5 no false system pause; the hand\'s slots collapsed', (await sysPauses(page)) === 0 && s5.slots.every(o => o === 'free'));

  // S10 — NEXT during a take calls it off; the music never stops
  await page.evaluate(() => window.__mark());
  await tapBooth(page);
  await page.waitForFunction('DECKROUTE.phase !== "direct"', null, { timeout: 3000 }).catch(() => {});
  const s10a = await page.evaluate(() => DECKROUTE.phase);
  if (s10a === 'taking'){
    await page.evaluate(() => player.next());
    await wait(1500);
    const s10 = await page.evaluate(() => ({ phase: DECKROUTE.phase, want: DECKROUTE.wantTake, playing: player.playing }));
    R('S10 NEXT during a take calls it off: direct again, the booth waits for a touch, the music on', s10.phase === 'direct' && s10.want && s10.playing, JSON.stringify(s10));
  } else {
    R('S10 NEXT during a take calls it off (the take was over before NEXT could land — measured instead)', s10a === 'graph', 'phase ' + s10a);
  }
  // wake it (a touch in the booth), then the booth closed and opened again during the hand-back stays live
  await page.waitForTimeout(800);
  if (await page.evaluate(() => DECKROUTE.phase === 'direct')){
    const box = await page.evaluate(() => { const r = el.booth.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(40, r.height / 2) }; });
    await page.touchscreen.tap(box.x, box.y);
  }
  const woke = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
  R('S10 a touch inside the sleeping booth wakes the decks', woke, JSON.stringify(await page.evaluate(() => window.__mb8Route())));
  if (woke){
    await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1 && activeDeck().a.duration - activeDeck().a.currentTime > 6', null, { timeout: 30000 }).catch(() => {});
    await tapBooth(page);                         // close: the hand-back starts…
    await page.waitForFunction('DECKROUTE.phase === "giving"', null, { timeout: 2000 }).catch(() => {});
    const mid = await page.evaluate(() => DECKROUTE.phase);
    await tapBooth(page);                         // …and the booth opens again before its commit
    await wait(800);
    const s10b = await page.evaluate(() => ({ phase: DECKROUTE.phase, graph: AE.graphLive, open: BOOTH.open, playing: player.playing }));
    R('S10 closed and opened again before the hand-back\'s commit: the decks stay live', mid !== 'giving' || (s10b.graph && s10b.phase === 'graph' && s10b.open && s10b.playing),
      'mid ' + mid + ' → ' + JSON.stringify(s10b));
  }

  // S6 — a hidden page gives the decks back
  if (!(await page.evaluate(() => DECKROUTE.phase === 'graph'))){
    await page.evaluate(() => { if (!BOOTH.open) BOOTH.toggle(true); });
    await touch(page); await page.evaluate(() => DECKROUTE.take('probe'));
    await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).catch(() => {});
  }
  await page.waitForFunction('MIXER.phase === "idle" && !AE.xfading', null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => window.__mark());
  await page.evaluate(() => { window.__hide = true; document.dispatchEvent(new Event('visibilitychange')); });
  const hid = await page.waitForFunction('DECKROUTE.phase === "direct" && !AE.graphLive', null, { timeout: 10000 }).then(() => true).catch(() => false);
  const S6 = await samples(page), c6 = continuity(S6.S);
  const s6 = await page.evaluate(() => ({ route: window.__mb8Route(), playing: player.playing, paused: activeDeck().a.paused }));
  R('S6 hidden with no blend in flight: the decks are handed back to direct, the music on', hid && s6.playing && !s6.paused && c6.stops === 0, JSON.stringify({ c6, phase: s6.route.phase }));
  await page.evaluate(() => { window.__hide = false; document.dispatchEvent(new Event('visibilitychange')); });
  await wait(300);
  const s6b = await page.evaluate(() => ({ want: DECKROUTE.wantTake, text: BOOTH.open ? DECKROUTE.boothText() : '' }));
  R('S6 shown again, the booth says the decks are asleep until a touch', s6b.want && /asleep/.test(s6b.text), s6b.text);

  R('no page errors on the main bench', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ===========================================================================
// S5, THE TWO-DECK STATES A HAND-BACK MUST RESOLVE: a seam running on its
// curves (it lands on the incoming), and a hand's record cued on deck B (it
// plays next, from its cue, on the direct path)
// ===========================================================================
if (!ONLY || ONLY === 'variants'){
  const { ctx, page, errs } = await open('S5 variants: the booth closed mid-blend, and with a hand\'s record cued');
  const iA = await idx(page, 'alpha'), iB = await idx(page, 'beta'), iT = await idx(page, 'tau');
  await page.evaluate(([a, b]) => { player.prepare(a, 0); player._committedNext = b; MIXER.setOn(true); }, [iA, iB]);
  await page.tap('#btnPlay');
  await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1', null, { timeout: 30000 }).catch(() => {});
  await instrument(page);
  await tapBooth(page);
  const live = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
  if (live){
    // the auto-DJ's own seam, near the end of the record: let it fire, then shut the booth while it runs
    await page.evaluate(b => { player._committedNext = b; const d = activeDeck(); d.a.currentTime = Math.max(0, d.a.duration - 16); }, iB);
    const running = await page.waitForFunction('MIXER.phase === "running"', null, { timeout: 25000 }).then(() => true).catch(() => false);
    await page.evaluate(() => window.__mark());
    if (running) await tapBooth(page);
    const gone = await page.waitForFunction('DECKROUTE.phase === "direct" && !AE.graphLive', null, { timeout: 8000 }).then(() => true).catch(() => false);
    await wait(800);
    const S = await samples(page), c = continuity(S.S);
    const v = await page.evaluate(() => ({ title: player.tracks[player.cur].title, mixer: MIXER.phase, playing: player.playing, paused: activeDeck().a.paused, srcs: AE.decks.filter(d => d.a.src).length }));
    R('S5 the booth shut while a seam runs: it lands on the incoming record, direct, the music never stopped',
      running && gone && v.title === 'beta' && v.mixer === 'idle' && v.playing && !v.paused && c.stops === 0 && c.maxSrc <= 2, JSON.stringify({ running, ...v, c }));
    // wake the booth with a touch inside it; a hand puts tau on the idle deck, cued 6 s in, and leaves it there
    await page.evaluate(() => { if (!BOOTH.open) BOOTH.toggle(true); });
    const box = await page.evaluate(() => { const r = el.booth.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(40, r.height / 2) }; });
    await page.touchscreen.tap(box.x, box.y);
    const woke = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
    const cued = await page.evaluate(async t => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const idle = DECKS.idle();
      const ok = DECKS.load(idle, player.tracks[t], { at: 6 });
      for (let k = 0; k < 60 && AE.decks[idle].a.readyState < 2; k++) await sleep(100);
      return { ok, owner: DECKS.slots[idle].owner, cue: DECKS.slots[idle].cue };
    }, iT);
    await tapBooth(page);
    await page.waitForFunction('DECKROUTE.phase === "direct" && !AE.graphLive', null, { timeout: 8000 }).catch(() => {});
    const nx = await page.evaluate(async t => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const committed = player._committedNext, keep = player._nextCue ? player._nextCue[player.tracks[t].id] : null;
      player.next();
      for (let k = 0; k < 60 && !(player.playing && activeDeck().a.currentTime > 0 && !activeDeck().a.muted); k++) await sleep(100);
      await sleep(500);
      const d = activeDeck();
      return { committed, keep, title: player.tracks[player.cur].title, t: d.a.currentTime, playing: player.playing, graph: AE.graphLive };
    }, iT);
    R('S5 a hand\'s record cued on deck B at the hand-back plays next, from its cue, on the direct path',
      woke && cued.ok && nx.committed === iT && nx.keep === 6 && nx.title === 'tau' && nx.t > 5.8 && nx.t < 9 && nx.playing && !nx.graph, JSON.stringify({ cued, nx }));
    // paused: the hand-back has no overlap to carry — the twin waits at the spot, and ▶ picks it up there
    await page.evaluate(() => { if (!BOOTH.open) BOOTH.toggle(true); });
    await page.touchscreen.tap(box.x, box.y);
    const woke2 = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
    await page.waitForFunction('activeDeck().a.currentTime > 9', null, { timeout: 15000 }).catch(() => {});
    const spot = await page.evaluate(() => { player.pause(); return activeDeck().a.currentTime; });
    await tapBooth(page);
    await page.waitForFunction('DECKROUTE.phase === "direct" && !AE.graphLive', null, { timeout: 8000 }).catch(() => {});
    await pressPlay(page);
    await wait(1500);
    const pz = await page.evaluate(() => { const d = activeDeck(); return { t: d.a.currentTime, playing: player.playing, paused: d.a.paused, muted: d.a.muted, graph: AE.graphLive, cors: d.a.crossOrigin }; });
    R('S5 paused at the hand-back: the twin waits at the spot, and ▶ picks it up there, direct', woke2 && !pz.graph && !pz.cors && pz.playing && !pz.paused && !pz.muted
      && pz.t >= spot - 0.3 && pz.t < spot + 2.5, JSON.stringify({ spot, ...pz }));
  } else R('S5 variants: the decks were taken', false, JSON.stringify(await page.evaluate(() => window.__mb8Route())));
  R('no page errors on the variants bench', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ===========================================================================
// TAINT: a crossover CORS refuses, and a CORS failure mid-track
// ===========================================================================
if (!ONLY || ONLY === 'taint'){
  const { ctx, page, errs } = await open('taint: the crossover refused, and a mid-track CORS failure');
  const iA = await idx(page, 'alpha'), iB = await idx(page, 'beta'), iT = await idx(page, 'tau');
  // alpha only on the no-header path: it plays direct, and deck B's CORS-mode copy is refused
  await page.evaluate(([a, b, base]) => {
    const t = player.tracks[a]; t.url = t.url.replace('/cors/', '/nocors/');
    player.prepare(a, 0); player._committedNext = b;
  }, [iA, iB]);
  await page.tap('#btnPlay');
  await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1', null, { timeout: 30000 }).catch(() => {});
  await instrument(page);
  await page.evaluate(() => window.__mark());
  await tapBooth(page);
  const pend = await page.waitForFunction('DECKROUTE.pendingTake && DECKROUTE.phase === "direct"', null, { timeout: 12000 }).then(() => true).catch(() => false);
  const S8 = await samples(page), c8 = continuity(S8.S);
  const s8 = await page.evaluate(() => ({ route: window.__mb8Route(), text: DECKROUTE.boothText(), graph: AE.graphLive, muted: activeDeck().a.muted, playing: player.playing }));
  R('S8 deck B\'s CORS-mode copy refused: the tainted record is never captured — the decks wait for the next track', pend && !s8.graph && !s8.muted && s8.playing && c8.stops === 0,
    JSON.stringify({ phase: s8.route.phase, pending: s8.route.pendingTake, c8 }));
  R('S8 …and the booth says so', /next track/.test(s8.text), s8.text);
  // the boundary: NEXT, and the decks are live on the next record, heard
  await page.evaluate(() => window.__mark());
  const n0 = await page.evaluate(() => performance.now());
  await touch(page);
  await page.evaluate(() => player.next());
  const joined = await page.waitForFunction('AE.graphLive && DECKROUTE.phase === "graph" && player.playing && activeDeck().a.currentTime > 0.5', null, { timeout: 15000 }).then(() => true).catch(() => false);
  await wait(2500);
  const S8b = await samples(page);
  const roll = (S8b.S.find(x => x.graph && x.ct > 0.2) || {}).w;
  let gap = 0, last = null;
  for (const x of S8b.lv){ if (roll && x.w < roll) continue; if (x.rms < 0.003){ if (last == null) last = x.w; gap = Math.max(gap, x.w - last); } else last = null; }
  R('S8 at the boundary the decks join, and the next record is heard with no dropout over 300 ms', joined && roll && gap <= 300, (roll ? Math.round(roll - n0) + ' ms to roll' : 'never rolled') + ' · longest quiet ' + Math.round(gap) + ' ms');

  // S9 — the record on air fails CORS mid-track (one later range without the header)
  const s9 = await page.evaluate(async t => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const tr = player.tracks[t]; tr.url = tr.url.replace('/cors/', '/flaky/');
    for (const d of AE.decks) d.a.addEventListener('error', () => { window.__lastErr = d.a.error ? d.a.error.code + ' ' + (d.a.error.message || '') : '?'; }, true);
    player.playIndex(t);
    for (let k = 0; k < 80 && !(activeDeck().a.currentTime > 1.2); k++) await sleep(100);
    const graphed = AE.graphLive, at = activeDeck().a.currentTime;
    const d0 = activeDeck();
    try { d0.a.currentTime = d0.a.duration - 6; } catch (e){}   // far ahead: a new ranged request, without the header
    for (let k = 0; k < 20 && !window.__lastErr; k++) await sleep(100);
    /* WEBKIT FAILS THE ELEMENT HERE, Chromium does not. WebCoreNSURLSession
       folds every response's CORS result into one sticky flag, and one failed
       range fails the player as MEDIA_ERR_SRC_NOT_SUPPORTED (code 4); Chromium
       retries the range quietly and the element just stalls. So where no error
       came, the probe delivers WebKit's — the element's own error, code 4 —
       and what is held to account is the app's answer to it. */
    const synth = !window.__lastErr;
    if (synth){
      Object.defineProperty(d0.a, 'error', { get: () => ({ code: 4, message: 'CORS (as WebKit reports it)' }), configurable: true });
      d0.a.dispatchEvent(new Event('error'));
    }
    const lastGood = AE._lastGoodT;
    for (let k = 0; k < 100 && AE.graphLive; k++) await sleep(100);
    await sleep(1500);
    const d = activeDeck();
    return { err: window.__lastErr || null, synth, graphed, at, graph: AE.graphLive, phase: DECKROUTE.phase, noGraph: DECKROUTE._noGraph.has(tr.id), title: player.tracks[player.cur].title,
      t: d.a.currentTime, paused: d.a.paused, cors: d.a.crossOrigin, lastGood, playing: player.playing };
  }, iT);
  console.log('   flaky requests: ' + flakyLog.join(', '));
  R('S9 a CORS failure mid-track hands that record back direct, from where it was last heard — no skip, no stop',
    s9.graphed && !s9.graph && s9.phase === 'direct' && s9.noGraph && s9.title === 'tau' && !s9.paused && !s9.cors && s9.playing
    && s9.t >= s9.lastGood - 0.5 && s9.t < s9.lastGood + 4, JSON.stringify(s9));
  R('no page errors on the taint bench', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ===========================================================================
// S7 — the context lost with the decks in the graph and the page hidden
// ===========================================================================
if (!ONLY || ONLY === 'lost'){
  const { ctx, page, errs } = await open('S7: the context lost behind a lock, with the decks in the graph');
  const iA = await idx(page, 'tau');
  await page.evaluate(a => player.prepare(a, 0), iA);
  await page.tap('#btnPlay');
  await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1', null, { timeout: 30000 }).catch(() => {});
  await instrument(page);
  await tapBooth(page);
  const live = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
  /* KEEP THE GRAPH THROUGH THE HIDE (three refused hand-backs: 'keep'), so the
     context can be lost UNDER it — the case the twins exist for. */
  const hold = async () => page.evaluate(() => { DECKROUTE.giveRetry = 3; DECKROUTE._tryAt = performance.now(); window.__hide = true; document.dispatchEvent(new Event('visibilitychange')); });
  if (live){
    await hold();
    await wait(700);
    const kept = await page.evaluate(() => DECKROUTE.phase);
    const lost = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const w0 = performance.now();
      await AE.ctx.suspend();
      for (let k = 0; k < 80 && AE.graphLive; k++) await sleep(100);
      await sleep(1200);
      const d = activeDeck();
      return { lost: { pos: DECKROUTE._lastPos }, graph: AE.graphLive, phase: DECKROUTE.phase, playing: player.playing, paused: d.a.paused,
        t: d.a.currentTime, el: (performance.now() - w0) / 1000, cors: d.a.crossOrigin, nodes: !!d.gain };
    });
    const pos = lost.lost ? lost.lost.pos : NaN;
    R('S7 hidden with the graph kept (three refused hand-backs), the context lost: a twin plays on from the spot, direct',
      kept === 'graph' && !lost.graph && lost.phase === 'direct' && lost.playing && !lost.paused && !lost.cors && !lost.nodes,
      JSON.stringify({ kept, ...lost, lost: undefined }));
    // the spot: where the music was last heard, played on for the time since (generous: a hidden bench's timers are slow)
    R('S7 …from where it was last heard (the lost position, played on)', isFinite(pos) && lost.t >= pos - 0.3 && lost.t <= pos + lost.el + 0.5,
      'lost at ' + (isFinite(pos) ? pos.toFixed(2) : '?') + ' → ' + lost.t.toFixed(2) + ' after ' + lost.el.toFixed(1) + ' s');
  } else R('S7 the decks were taken for the context-loss bench', false, JSON.stringify(await page.evaluate(() => window.__mb8Route())));
  // back, awake, and this time nothing may start: the twins refuse, and there is no gesture behind a lock
  await page.evaluate(() => { window.__hide = false; document.dispatchEvent(new Event('visibilitychange')); });
  await wait(300);
  const box = await page.evaluate(() => { const r = el.booth.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(40, r.height / 2) }; });
  await page.touchscreen.tap(box.x, box.y);
  const again = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
  if (again){
    await page.evaluate(() => {
      for (const t of DECKROUTE.twins) t.a.play = () => Promise.reject(new DOMException('refused', 'NotAllowedError'));
      DECKROUTE._gestureLive = () => false;          // behind a lock no gesture is live
    });
    await hold();
    await wait(700);
    const slept = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      await AE.ctx.suspend();
      for (let k = 0; k < 60 && player.playing; k++) await sleep(100);
      await sleep(300);
      const d = activeDeck();
      return { playing: player.playing, paused: d.a.paused, t: d.a.currentTime, lost: DECKROUTE._lost, graph: AE.graphLive,
        ms: navigator.mediaSession ? navigator.mediaSession.playbackState : 'n/a', log: (ACTIVITY.list || []).slice(0, 4).map(e => e.m) };
    });
    const sp = slept.lost ? slept.lost.pos : NaN;
    R('S7 with nothing allowed to start: an honest pause at the spot — paused transport, the lock screen says paused, the log says why',
      !slept.playing && slept.paused && (slept.ms === 'paused' || slept.ms === 'n/a') && Math.abs(slept.t - sp) < 0.3 && slept.log.some(m => /asleep|sleep/.test(m)),
      JSON.stringify({ ...slept, log: slept.log[0] }));
    // ▶, a real tap: the press is the gesture the emergency needs
    await page.evaluate(() => { window.__hide = false; delete DECKROUTE._gestureLive; document.dispatchEvent(new Event('visibilitychange')); });
    await pressPlay(page);
    await wait(2500);
    const back = await page.evaluate(() => { const d = activeDeck(); return { playing: player.playing, paused: d.a.paused, t: d.a.currentTime, graph: AE.graphLive, phase: DECKROUTE.phase }; });
    R('S7 one press of ▶ brings it back from that spot', back.playing && !back.paused && back.t >= sp - 0.3 && back.t < sp + 4, JSON.stringify({ from: sp, ...back }));
  } else R('S7 the decks woke again for the second half', false, JSON.stringify(await page.evaluate(() => window.__mb8Route())));
  R('no page errors on the context-loss bench', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// ===========================================================================
// S11 — the devices the route leaves out behave as today
// ===========================================================================
for (const [label, ua, query] of (!ONLY || ONLY === 'gated') ? [['decks=direct on iOS 18', UA18, '?decks=direct'], ['iOS 17.6 with no override (the route ships off)', UA176, '']] : []){
  const { ctx, page, errs } = await open('S11 ' + label, { ua, query });
  const iA = await idx(page, 'alpha');
  await page.evaluate(a => player.prepare(a, 0), iA);
  await page.tap('#btnPlay');
  await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1', null, { timeout: 30000 }).catch(() => {});
  await tapBooth(page);
  await wait(2000);
  const s = await page.evaluate(() => ({ gate: IOS_GRAPH, graph: AE.graphLive, phase: DECKROUTE.phase, twins: DECKROUTE.twins.length,
    why: BOOTH.faderWhy(), platterB: VINYL.for(1).why(), canSong: VINYL.canSong(), cors: AE.decks.map(d => d.a.crossOrigin), playing: player.playing }));
  const today = /direct-to-output/.test(s.why) || (query === '?decks=direct' && /decks=direct/.test(s.why));
  R('S11 ' + label + ': the booth stays direct, no twins, no CORS, the song-tape platter as today', !s.gate && !s.graph && s.phase === 'direct' && s.twins === 0
    && s.cors.every(c => !c) && s.canSong && /only the record on air/.test(s.platterB) && s.playing && today, JSON.stringify(s));
  R('no page errors (' + label + ')', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// A2 — '?worklets=0': the decks still go into the graph, with no platter worklet, for an A/B of dropouts on a device
if (!ONLY || ONLY === 'worklets'){
  const { ctx, page, errs } = await open('A2: ?decks=graph&worklets=0', { query: '?decks=graph&worklets=0' });
  const iA = await idx(page, 'alpha');
  await page.evaluate(a => player.prepare(a, 0), iA);
  await page.tap('#btnPlay');
  await page.waitForFunction('player.playing && activeDeck().a.currentTime > 1', null, { timeout: 30000 }).catch(() => {});
  await tapBooth(page);
  const live = await page.waitForFunction('DECKROUTE.phase === "graph"', null, { timeout: 8000 }).then(() => true).catch(() => false);
  await wait(1500);
  const w = await page.evaluate(() => ({ flag: IOS_WORKLETS, decks: window.__mb8VinylDecks, why: VINYL.for(AE.active).why(), playing: player.playing }));
  R('A2 ?worklets=0: the decks are live with no platter seated, and the platter says why', live && !w.flag && w.decks && w.decks.A === 'none' && w.decks.B === 'none'
    && /worklets=0/.test(w.why) && w.playing, JSON.stringify(w));
  R('no page errors (worklets=0)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed · ' + mediaRequests + ' media requests');
await browser.close(); media.close(); page0.close();
process.exit(fail ? 1 : 0);
