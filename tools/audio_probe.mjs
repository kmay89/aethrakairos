/* AUDIO FAILURE PROBE — what the player says when the music does not arrive.
 *
 * Reported by a listener: an endless parade of identical "Weak signal —
 * holding X…" cards, then "Couldn't decode X — skipping", over and over,
 * with nothing ever playing. Three separate faults behind one screenshot:
 *
 *   diagnosis   every failure was reported as a DECODE failure. A file the
 *               server never sent, a file it refused on CORS, and a file that
 *               really is corrupt all read identically — and the one of those
 *               three that is nearly always the truth (the server didn't send
 *               it) was the one never named. A wrong diagnosis is worse than
 *               none: it points at the one layer that is working.
 *   the loop    the retry budget refills on two seconds of progress, which is
 *               right, and was unbounded, which is how a stream that plays
 *               three seconds and drops forever holds a track forever.
 *   the march   skipping on failure is right for one bad file and wrong for a
 *               host that is down: the player walks the whole catalog, one
 *               card per track, and arrives at the end having said nothing.
 *
 * None of this is arithmetic and none of it is reachable from a unit test —
 * it needs a real <audio> element getting a real MediaError from a real
 * server that refuses. So that is what this does.
 *
 *   node tools/audio_probe.mjs [--keep]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, extname } from 'path';

const KEEP = process.argv.includes('--keep');
const DIR = join('tests', '_tmp_audio');
const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

let pass = 0, fail = 0;
function verdict(name, ok, detail){
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  · ' + detail : ''}`);
}

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
for (const f of ['index.html', 'three.min.js', 'manifest.webmanifest'])
  if (existsSync(join('docs', f))) cpSync(join('docs', f), join(DIR, f));

/* THE HOST THAT REFUSES. /audio/* answers 404 with no body — exactly what a
 * missing file, a stripped preview directory or a bad redirect looks like to
 * a media element, and the case the player used to call a decode failure. */
let audioHits = 0;
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/audio/')){ audioHits++; res.writeHead(404); res.end(); return; }
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Cache-Control': 'no-cache' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });

console.log('\nwhen the music does not arrive');

/* Drive the REAL handler: a real element, a real 404, a real MediaError. The
 * player is told it is playing a streaming track, which is the state a
 * listener is in when this happens to them. */
await page.evaluate(() => ensureCtx());     // the decks exist only once the graph does

const drive = (title, n) => page.evaluate(async ([title, n]) => {
  const seen = [];
  player.tracks = [];
  for (let k = 0; k < n; k++)
    player.tracks.push({ title: title + ' ' + (k + 1), url: 'audio/nope-' + k + '.mp3' });
  player.cur = 0;
  player.playing = true;
  player._netSkips = 0;      // each run counts its own three, not the last run's
  // step through however many tracks the player decides to walk
  const orig = player.next;
  player.next = () => { player.cur++; if (player.cur < n) fire(); };
  const d = AE.decks[AE.active];
  function fire(){
    const t = player.tracks[player.cur];
    if (!t) return;
    d.a.src = t.url;
    d.a.load();
    d.a.play().catch(() => {});
  }
  fire();
  // wait for the player to reach a resting state rather than for a clock: a
  // fixed sleep either flakes or hides how long the listener actually waits
  const t0 = Date.now();
  while (Date.now() - t0 < 20000){
    await new Promise(r => setTimeout(r, 120));
    if (!player.playing || player.cur >= n) break;
  }
  await new Promise(r => setTimeout(r, 600));      // let the last toast land
  player.next = orig;
  for (const el of document.getElementById('toasts').children) seen.push(el.textContent);
  return { toasts: seen, playing: player.playing, walked: player.cur };
}, [title, n]);

const one = await drive('Nope', 1);
const text = one.toasts.join(' | ');
verdict('audio: a 404 is reported as a server that did not send the file,\n'
  + '        not as a file that failed to decode',
  /didn't send it/.test(text) && !/decode/.test(text), text || '(no toast)');
verdict('audio: and it says so in words somebody can act on',
  /missing, blocked, or cross-origin/.test(text), '');

// the march: three unreachable tracks in a row is a dead pipe, not three bad files
const many = await drive('Nope', 40);
const t2 = many.toasts.join(' | ');
verdict('audio: an unreachable host stops the player instead of marching it\n'
  + '        through the whole catalog', many.playing === false && many.walked < 6,
  'walked ' + many.walked + ' of 40, playing=' + many.playing);
verdict('audio: and says the files are not the problem',
  /Can't reach the music/.test(t2), t2.slice(0, 120));

// identical cards do not stack — one problem is one card
const stacked = await page.evaluate(async () => {
  document.getElementById('toasts').innerHTML = '';
  for (let i = 0; i < 5; i++) toast('Weak signal — holding <b>X</b>…');
  await new Promise(r => setTimeout(r, 60));
  return document.getElementById('toasts').children.length;
});
verdict('audio: the same message five times is one card, not five',
  stacked === 1, stacked + ' card(s)');

verdict('audio: the player really did ask the server for the audio',
  audioHits > 0, audioHits + ' request(s)');

await browser.close();
server.close();
if (!KEEP) rmSync(DIR, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
