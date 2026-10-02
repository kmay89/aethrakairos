/* PROTOTYPE HARNESS — render a WebGL2 fragment shader to PNG frames in headless Chromium (SwiftShader).
 *   node render.mjs <shader.frag> <outPrefix> [--w 640 --h 360 --times 0,4,9 --bass 0.6 --treb 0.3 --beat 0.0]
 * The fragment receives (all optional to use):
 *   uniform vec2 uRes; uniform float uTime; uniform float uBass, uMid, uTreb, uBeat, uEnergy;
 *   uniform vec3 uColA, uColB, uColC;   // a stand-in chord (amber / ice / violet), like the engine's colour engine
 *   out vec4 fragColor;  — write `void main()` using gl_FragCoord.
 * Prints compile errors and per-frame wall-clock render time (median of 3 draws, after a warm-up draw; SwiftShader CPU —
 * NOT a GPU number; compare only against baseline.frag rendered at the same size: `node render.mjs baseline.frag out/base`).
 * Also prints void% (share of pixels with luma < 18/255) and mean luma: the measurable form of 'structure on void'.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
const args = process.argv.slice(2);
const src = readFileSync(args[0], 'utf8'); const out = args[1];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 640), H = +opt('h', 360);
const times = opt('times', '0,4,9').split(',').map(Number);
const U = { bass: +opt('bass', 0.6), mid: +opt('mid', 0.4), treb: +opt('treb', 0.3), beat: +opt('beat', 0), energy: +opt('energy', 0.5) };
const colA = opt('cola', '1.0,0.62,0.22'), colB = opt('colb', '0.35,0.75,1.0'), colC = opt('colc', '0.72,0.42,1.0');
const html = `<!doctype html><canvas id=c width=${W} height=${H}></canvas><script>
const gl = document.getElementById('c').getContext('webgl2', {preserveDrawingBuffer:true});
const vs = '#version 300 es\\nin vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';
function sh(t, s){ const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
  if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('COMPILE: ' + gl.getShaderInfoLog(o)); return o; }
window.setup = (fs) => {
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('LINK: ' + gl.getProgramInfoLog(pr));
  gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  window.pr = pr; return true; };
window.draw = (t, u, ca, cb, cc) => { const g = n => gl.getUniformLocation(pr, n);
  gl.uniform2f(g('uRes'), ${W}, ${H}); gl.uniform1f(g('uTime'), t);
  gl.uniform1f(g('uBass'), u.bass); gl.uniform1f(g('uMid'), u.mid); gl.uniform1f(g('uTreb'), u.treb);
  gl.uniform1f(g('uBeat'), u.beat); gl.uniform1f(g('uEnergy'), u.energy);
  gl.uniform3fv(g('uColA'), ca); gl.uniform3fv(g('uColB'), cb); gl.uniform3fv(g('uColC'), cc);
  const px = new Uint8Array(4); const ms = [];
  for (let k = 0; k < 3; k++){ const t0 = performance.now(); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); ms.push(performance.now() - t0); }
  ms.sort((a,b)=>a-b); return ms[1]; };
</script>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
try { await page.evaluate(fs => window.setup(fs), src); }
catch (e) { console.log(String(e.message).replace(/\\n/g, '\n')); await browser.close(); process.exit(2); }
const P = s => s.split(',').map(Number);
await page.evaluate(([u, a, b, c]) => window.draw(0, u, a, b, c), [U, P(colA), P(colB), P(colC)]); // warm-up: compile + first draw
for (const t of times) {
  const ms = await page.evaluate(([t, u, a, b, c]) => window.draw(t, u, a, b, c), [t, U, P(colA), P(colB), P(colC)]);
  const f = `${out}_t${String(t).replace('.', 'p')}.png`;
  await page.locator('#c').screenshot({ path: f });
  // void check: share of near-black pixels and mean luma, so 'structure on void' is measurable
  const stats = await page.evaluate(() => { const c = document.getElementById('c'); const g = c.getContext('webgl2');
    const w = c.width, h = c.height, px = new Uint8Array(w*h*4); g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,px);
    let dark = 0, sum = 0; for (let i = 0; i < px.length; i += 4){ const y = 0.2126*px[i]+0.7152*px[i+1]+0.0722*px[i+2]; sum += y; if (y < 18) dark++; }
    return { dark: dark/(w*h), mean: sum/(w*h) }; });
  console.log(`frame t=${t} -> ${f}  swiftshader ${ms.toFixed(0)}ms  void=${(stats.dark*100).toFixed(0)}%  meanLuma=${stats.mean.toFixed(1)}`);
}
await browser.close();
