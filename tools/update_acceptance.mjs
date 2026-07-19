// Self-update acceptance — the seamless-update contract, end to end:
//   1. boot build A, SW installs, play state accumulates
//   2. a new build B is "published" (files change on the server)
//   3. the running page notices on its next update check → Update button
//   4. tapping it saves state, swaps workers, reloads
//   5. build B is live, and queue/position/hearts survived untouched
//
//   python3 tools/make_synthetic_deploy.py /tmp/mb8-upd 60
//   node tools/update_acceptance.mjs /tmp/mb8-upd
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR = process.argv[2] || '/tmp/mb8-upd';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };

const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const d = readFileSync(f);
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache' });
  res.end(d);
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

// stamp DIR's copies in place, like publish.sh would
function stamp(){
  execFileSync('python3', [join(ROOT, 'tools/stamp_version.py')], {
    env: { ...process.env }, cwd: ROOT,
  });
}
function syncBuild(marker){
  // copy the repo's (stamped) player + sw into the deploy dir, applying the
  // same localizations make_synthetic_deploy applies
  let idx = readFileSync(join(ROOT, 'docs/index.html'), 'utf8');
  idx = idx.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three.min.js');
  idx = idx.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '');
  if (marker) idx = idx.replace('</body>', `<script>window.__marker='${marker}'</script></body>`);
  writeFileSync(join(DIR, 'index.html'), idx);
  writeFileSync(join(DIR, 'sw.js'), readFileSync(join(ROOT, 'docs/sw.js')));
}

// ---- build A
stamp();
const buildA = readFileSync(join(ROOT, 'docs/sw.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
syncBuild('A');
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
await page.waitForFunction('navigator.serviceWorker.controller !== null', null, { timeout: 15000 })
  .catch(() => {});
const a = await page.evaluate(() => ({
  build: MB8_BUILD, marker: window.__marker,
  controlled: !!navigator.serviceWorker.controller,
}));
R('build A boots under SW control', a.marker === 'A' && a.controlled, 'build ' + a.build);
R('no update offered when none exists', await page.evaluate(() => el.btnUpdate.hidden));

// give it a played state worth preserving
await page.evaluate(() => {
  player.playIndex(3);
  const t = player.tracks[3];
  FAVS.toggle(t);
});
await page.waitForTimeout(2000);
// the synthetic tracks are half a second long — pause so the reference
// state can't auto-advance underneath the update sequence
await page.evaluate(() => player.pause());
const beforeState = await page.evaluate(() => {
  PERSIST.save();
  const t = player.tracks[player.cur];
  return { key: t.sha256 || t.url, favs: [...FAVS.keys],
           pos: AE.decks[AE.active].a.currentTime };
});

// ---- "publish" build B: touch the player so the stamp changes
const idxPath = join(ROOT, 'docs/index.html');
const orig = readFileSync(idxPath, 'utf8');
writeFileSync(idxPath, orig.replace('</body>', '<!-- update-acceptance build B -->\n</body>'));
try {
  stamp();
  const buildB = readFileSync(join(ROOT, 'docs/sw.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
  R('a player change produces a new build id', buildB !== buildA, buildA + ' → ' + buildB);
  syncBuild('B');

  // the running page checks on foreground/interval; poke it and await the
  // check so the assertion isn't racing the network
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update().catch(() => {});
  });
  await page.waitForFunction('el.btnUpdate.hidden === false', null, { timeout: 15000 });
  R('Update button appears on the running page', true);

  // tap it — the seam
  await page.click('#btnUpdate');
  await page.waitForFunction(`window.__marker === 'B'`, null, { timeout: 15000 });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(async () => {
    const t = player.tracks[player.cur];
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      build: MB8_BUILD, marker: window.__marker,
      key: t ? (t.sha256 || t.url) : null,
      playing: player.playing,
      pos: AE.decks && AE.decks[AE.active] ? AE.decks[AE.active].a.currentTime : -1,
      favs: [...FAVS.keys],
      caches: await caches.keys(),
      controlled: regs.length > 0,
    };
  });
  R('build B is live after one tap', after.marker === 'B' && after.build !== a.build,
    'build ' + after.build);
  R('queue + track survive the update', after.key === beforeState.key,
    'before ' + beforeState.key + ' → after ' + after.key + ' · paused=' + !after.playing);
  R('position survives the update', Math.abs(after.pos - beforeState.pos) < 2.5,
    beforeState.pos.toFixed(1) + ' s → ' + after.pos.toFixed(1) + ' s');
  R('hearts survive the update', JSON.stringify(after.favs) === JSON.stringify(beforeState.favs));
  R('stale shell cache cleaned, catalog cache kept',
    after.caches.some(c => c.includes(buildB)) && !after.caches.some(c => c.includes(buildA))
    && after.caches.includes('mb8-catalog-v1'), after.caches.join(', '));
} finally {
  writeFileSync(idxPath, orig);                  // restore the repo copy
  stamp();
}

await browser.close();
server.close();
const fails = results.filter(r => !r.ok);
console.log('\n' + (results.length - fails.length) + '/' + results.length + ' update checks passed');
process.exit(fails.length ? 1 : 0);
