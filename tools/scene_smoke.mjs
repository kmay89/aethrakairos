/* SCENE SMOKE — every scene, twice: once as a booth, once as the middle
 * screen of three. A shader edit that breaks one scene breaks it silently
 * (three.js logs and draws nothing), and the wall's uSlice work touches
 * every fullscreen-quad program — so this sweeps them all and fails on any
 * shader compile error or frame exception, on either kind of page.
 *
 *   node tools/scene_smoke.mjs
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
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext();
let bad = 0;

for (const path of ['/', '/?stage=screen&screen=2&of=3']){
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => {
    const t = m.text();
    if (/THREE|shader|SHADER|GLSL|Fragment|Vertex/i.test(t) && /error|invalid|fail/i.test(t))
      errs.push('console: ' + t.slice(0, 160));
  });
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });
  const n = await page.evaluate(() => scenes.length);
  for (let i = 0; i < n; i++){
    await page.evaluate(idx => { director.setScene(idx, false); }, i);
    await page.waitForTimeout(650);
    const name = await page.evaluate(idx => scenes[idx].name || ('scene ' + idx), i);
    const fresh = errs.splice(0);
    if (fresh.length){ bad++; console.log('FAIL', path, name, '\n  ' + fresh.join('\n  ')); }
    else console.log('  ok', path.padEnd(30), name);
  }
  await page.close();
}
await browser.close();
server.close();
console.log(bad ? `\n${bad} scene(s) with errors` : '\nevery scene clean, booth and sliced screen alike');
process.exit(bad ? 1 : 0);
