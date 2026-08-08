/* tools/spectrum_probe.mjs — the eye, checked on both sides of the bus.
 *
 * DISPERSION and SOAP FILM integrate a diffraction pattern against the CIE 1931
 * observer a few million times a second, so that observer has to live in GLSL.
 * The flame bench integrates a black body against the SAME observer in JS. The
 * claim the code makes — in a comment, which is worth nothing on its own — is
 * that GLSL_CIE is GENERATED from the very table cieXYZBar() reads, and that
 * the two therefore cannot drift.
 *
 * This checks it. It runs the shipped GLSL_CIE on the GPU across the visible
 * band, reads the pixels back, and compares them against the shipped JS. It is
 * the same thing tools/touch_probe.mjs does for the fabric metric, for the same
 * reason: a constant copied by hand is a constant that is already wrong, and
 * nobody would see this one until they compared a laser to a grating order and
 * found two different greens.
 *
 *   node tools/spectrum_probe.mjs
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
const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e.message)));
await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__mb8Booted === true', null, { timeout: 45000 });

/* THE ENCODING. x̄ has a negative lobe near 500 nm and z̄ peaks above 1.2, so
   the bars do not fit in a byte on their own. An affine map takes the whole
   range into 0..1 with room to spare, and 8 bits then buys about 0.01 of
   resolution in bar units — an order finer than the tolerance below, and
   comfortably finer than any drift a mistyped constant would cause. */
const N = 96, LO = 400, HI = 700, K = 0.4, B = 0.12;

const out = await page.evaluate(({ N, LO, HI, K, B }) => {
  const rt = new THREE.WebGLRenderTarget(N, 1, {
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: { uN: { value: N }, uLo: { value: LO }, uHi: { value: HI }, uK: { value: K }, uB: { value: B } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: GLSL_CIE + `
      uniform float uN, uLo, uHi, uK, uB;
      varying vec2 vUv;
      void main(){
        float lam = uLo + (uHi - uLo) * (floor(vUv.x * uN) + 0.5) / uN;
        gl_FragColor = vec4(cieXYZBar(lam) * uK + uB, 1.0);
      }
    `,
  });
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const cam = new THREE.Camera();
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(sc, cam);
  const buf = new Uint8Array(N * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, N, 1, buf);
  renderer.setRenderTarget(prev);
  rt.dispose(); mat.dispose();

  // and the JS side, straight out of the shipped pure block
  const js = [];
  for (let i = 0; i < N; i++){
    const lam = LO + (HI - LO) * (i + 0.5) / N;
    const b = cieXYZBar(lam);
    js.push([b.x, b.y, b.z]);
  }
  return { gpu: Array.from(buf), js, lobes: CIE_LOBES, glsl: GLSL_CIE };
}, { N, LO, HI, K, B });

let fails = 0, worst = 0, worstAt = 0;
const TOL = 0.02;
for (let i = 0; i < N; i++){
  const lam = LO + (HI - LO) * (i + 0.5) / N;
  for (let c = 0; c < 3; c++){
    const gpu = (out.gpu[i * 4 + c] / 255 - B) / K;
    const d = Math.abs(gpu - out.js[i][c]);
    if (d > worst){ worst = d; worstAt = lam; }
    if (d > TOL){
      fails++;
      if (fails <= 8) console.log(`  FAIL ${Math.round(lam)} nm ${'xyz'[c]}: gpu ${gpu.toFixed(4)} vs js ${out.js[i][c].toFixed(4)}`);
    }
  }
}

// and the generator really did read the table rather than a second copy of it
let genFails = 0;
for (const band of ['x', 'y', 'z'])
  for (const l of out.lobes[band]){
    const needle = `cieGauss(l, ${l[1].toFixed(1)}, ${l[2].toFixed(1)}, ${l[3].toFixed(1)})`;
    if (!out.glsl.includes(needle)){ console.log(`  FAIL generated GLSL is missing ${needle}`); genFails++; }
    if (!out.glsl.includes(l[0].toFixed(4))){ console.log(`  FAIL generated GLSL is missing weight ${l[0]}`); genFails++; }
  }

console.log(`\n  ${N} wavelengths, 3 bars each — worst disagreement ${worst.toFixed(4)} at ${Math.round(worstAt)} nm (tolerance ${TOL})`);
if (errs.length) console.log('  page errors:', errs.slice(0, 3).join(' | '));
const bad = fails + genFails + errs.length;
console.log(bad ? `\n  ${bad} problem(s) — the GPU observer and the JS observer disagree`
                : '\n  the shader eye and the JS eye are the same eye');

await browser.close();
server.close();
process.exit(bad ? 1 : 0);
