/* MASTER PROBE — is the rail there, and does it hold?
 *
 * The limiter's kernel is pure and unit-tested to the bit. What a unit test
 * cannot see is whether the kernel is actually IN the signal path on a real
 * graph: an AudioWorklet module that fails to load fails silently — the
 * direct path keeps playing, the music sounds identical, and the one
 * downbeat where two full-scale decks agree to peak goes straight to the DAC
 * and clips there. So this listens at the speaker.
 *
 * The bench plays the shipped demo through the real engine, then turns the
 * decks up by 12 dB — a mix no listener would make and every worst case
 * would — and records at AE.out, the node the speaker hears. It reports:
 *
 *   seat       which limiter took the seat: the worklet (the tested kernel),
 *              the compressor (the fallback rail), or none (a fault)
 *   ceiling    the largest sample that reached the speaker, against the
 *              declared ceiling, with the pre-limiter peak alongside so the
 *              reduction is visible rather than inferred
 *   silence    that a clean −6 dB mix passes UNTOUCHED — a limiter that
 *              colours what it was told to protect is the other fault
 *   meter      that the booth's reading agrees with what was recorded
 *
 *   node tools/master_probe.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

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
let pass = 0, fail = 0;
const R = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const ctx = await browser.newContext({ viewport: { width: 240, height: 180 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
await page.evaluate(async () => {
  const o = document.getElementById('onboard'); if (o) o.classList.remove('open');
  if (typeof firstRunClose === 'function') try { firstRunClose(); } catch (e) {}
  director.setAuto(false);
  ensureCtx();
  if (AE.ctx.state !== 'running') await AE.ctx.resume().catch(() => {});
  await player.synthesizeDemo();
});
const live = await page.waitForFunction(
  '!!(AE.ctx && AE.ctx.state === "running" && player.playing && activeDeck() && activeDeck().a.currentTime > 0.4)',
  null, { timeout: 30000 }).then(() => true).catch(() => false);
R('the bench is playing real music into a live graph', live);
if (!live){ await browser.close(); server.close(); process.exit(1); }

const seat = await page.waitForFunction('window.__mb8Limiter && window.__mb8Limiter !== "none"', null, { timeout: 10000 })
  .then(() => page.evaluate('window.__mb8Limiter')).catch(() => 'none');
R('a limiter took the seat before the speaker', seat !== 'none', 'seat=' + seat);
R('…and it is the tested kernel on the audio thread, not the fallback', seat === 'worklet', 'seat=' + seat);

/* THE INSTRUMENT: two recorders, one at the master (what the decks made) and
   one at AE.out (what the speaker gets). Both ScriptProcessors, both silenced. */
await page.evaluate(() => {
  window.__tap = (node) => {
    const sp = AE.ctx.createScriptProcessor(4096, 2, 1);
    let pk = 0, n = 0, sq = 0;
    sp.onaudioprocess = e => {
      for (let c = 0; c < 2; c++){ const d = e.inputBuffer.getChannelData(c); for (let i = 0; i < d.length; i++){ const a = Math.abs(d[i]); if (a > pk) pk = a; sq += a * a; n++; } }
    };
    const z = AE.ctx.createGain(); z.gain.value = 0;
    node.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
    return { stop(){ try { node.disconnect(sp); sp.disconnect(); z.disconnect(); } catch (e){} sp.onaudioprocess = null; return { peak: pk, rms: Math.sqrt(sq / Math.max(1, n)), n }; } };
  };
});
const measure = async (secs) => {
  await page.evaluate(() => { window.__pre = window.__tap(AE.master); window.__post = window.__tap(AE.out); });
  await page.waitForTimeout(secs * 1000);
  return page.evaluate(() => ({ pre: window.__pre.stop(), post: window.__post.stop(), gr: MASTERLIM.grDb(), ceil: Math.pow(10, LIMITER.ceilingDb / 20) }));
};

// clean: the demo at unity is well under the ceiling — the rail must not touch it
const clean = await measure(2.5);
R('a clean mix reaches the speaker untouched — same peak, same level', Math.abs(clean.pre.peak - clean.post.peak) < 0.02 && Math.abs(clean.pre.rms - clean.post.rms) < 0.01,
  `pre ${clean.pre.peak.toFixed(3)}/${clean.pre.rms.toFixed(3)} · post ${clean.post.peak.toFixed(3)}/${clean.post.rms.toFixed(3)}`);
R('…and the meter reads no reduction', clean.gr > -0.05, 'gr ' + clean.gr.toFixed(2) + ' dB');

// hot: +12 dB on the deck — the sound every worst case makes
await page.evaluate(() => { const d = activeDeck(); d.gain.gain.cancelScheduledValues(0); d.gain.gain.setValueAtTime(4, AE.ctx.currentTime); });
const hot = await measure(3);
R('a +12 dB mix is a +12 dB mix at the master', hot.pre.peak > 1.5, 'pre peak ' + hot.pre.peak.toFixed(3));
R('…and never crosses the ceiling at the speaker', hot.post.peak <= hot.ceil * 1.02, `post peak ${hot.post.peak.toFixed(4)} vs ceiling ${hot.ceil.toFixed(4)}`);
R('…while the music is still there, not strangled', hot.post.rms > clean.post.rms * 0.8, `rms ${hot.post.rms.toFixed(3)} vs clean ${clean.post.rms.toFixed(3)}`);
R('the booth meter saw the reduction', hot.gr < -3, 'gr ' + hot.gr.toFixed(2) + ' dB');

// back to unity: the rail lets go
await page.evaluate(() => { const d = activeDeck(); d.gain.gain.setValueAtTime(d.norm || 1, AE.ctx.currentTime); });
await page.waitForTimeout(800);
const back = await measure(1.5);
R('lets go once the mix is clean again', back.gr > -0.1 && Math.abs(back.pre.peak - back.post.peak) < 0.02, `gr ${back.gr.toFixed(2)} · pre ${back.pre.peak.toFixed(3)} post ${back.post.peak.toFixed(3)}`);

// the volume slider is ramped, not stepped: drag it hard and count the steps at the speaker
const zipper = await page.evaluate(async () => {
  const sp = AE.ctx.createScriptProcessor(4096, 2, 1);
  const chunks = [];
  sp.onaudioprocess = e => chunks.push(Float32Array.from(e.inputBuffer.getChannelData(0)));
  const z = AE.ctx.createGain(); z.gain.value = 0;
  AE.out.connect(sp); sp.connect(z); z.connect(AE.ctx.destination);
  const el2 = document.getElementById('vol');
  for (let i = 0; i < 20; i++){ el2.value = i % 2 ? 100 : 15; el2.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 40)); }
  el2.value = 100; el2.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 300));
  try { AE.out.disconnect(sp); sp.disconnect(); z.disconnect(); } catch (e){}
  let worst = 0, n = 0; const steps = [];
  for (const c of chunks){ for (let i = 1; i < c.length; i++){ const s = Math.abs(c[i] - c[i - 1]); steps.push(s); if (s > worst) worst = s; n++; } }
  steps.sort((a, b) => a - b);
  return { worst, q: steps[Math.floor(steps.length * 0.9999)] || 0, n };
});
R('a hard volume drag leaves no step the music does not already contain', zipper.worst < zipper.q * 3, `worst ${zipper.worst.toFixed(4)} vs music's 99.99th ${zipper.q.toFixed(4)}`);

R('no page errors throughout', errs.length === 0, errs.join(' | '));
console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
