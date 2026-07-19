import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
const DIR = process.argv[2];
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.mp3': 'audio/wav' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = join(DIR, p === '/' ? 'index.html' : p.slice(1));
  if (!existsSync(f) || statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const d = readFileSync(f);
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*' });
  res.end(d);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext()).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 15000 });
const st = await page.evaluate(() => ({
  tracks: player.tracks.length,
  albums: catalog.albums.map(a => a.tag),
  featured: catalog.featured,
  info: catalog.albums.find(a => a.info) ? true : false,
  ambient: allTracks().filter(t => t.features && t.features.bpm === 0).length,
  consoleVisible: !document.getElementById('btnConsole').hidden,
}));
console.log(JSON.stringify(st, null, 1));
// play the first track end-to-end
await page.evaluate(() => player.playIndex(0));
await page.waitForTimeout(2500);
const play = await page.evaluate(() => ({
  playing: player.playing, t: AE.decks[AE.active].a.currentTime,
  title: document.title,
}));
console.log(JSON.stringify(play));
await browser.close(); server.close();
const ok = st.tracks === 4 && st.featured === 4 && st.consoleVisible && play.playing && play.t > 1;
console.log(ok ? 'INTEGRATION OK' : 'INTEGRATION FAILED');
process.exit(ok ? 0 : 1);
