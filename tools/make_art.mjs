// Generative cover art — the label's records dress themselves.
// Reads docs/catalog.json and renders a 1024×1024 cover for every album
// whose art file is missing (--force regenerates all). The art is derived
// from the MUSIC: the root hue comes from the track's detected key mapped
// around the Camelot wheel (the same mapping the player's colour engine
// and the Crate's key chips use), density and amplitude from the analysed
// energy/BPM, and the motif from the album's name — so a record's face is
// an honest portrait of what it sounds like.
//
//   node tools/make_art.mjs [--force]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const force = process.argv.includes('--force');
const cat = JSON.parse(readFileSync(join(root, 'docs/catalog.json'), 'utf8'));

const jobs = [];
for (const al of cat.albums || []){
  if (!al.art) continue;
  const out = join(root, 'docs', cat.base || 'audio', al.tag, al.art);
  if (existsSync(out) && !force) continue;
  const t = (al.tracks && al.tracks[0]) || {};
  jobs.push({
    out, title: al.title, artist: cat.artist || '', label: cat.label || '',
    key: (t.mix && t.mix.key) || null,
    energy: (t.features && t.features.energy) || 0.5,
    entropy: (t.features && t.features.entropy) || 0.4,
    bpm: (t.mix && t.mix.bpm) || 120,
    seed: t.sha256 || al.tag,
    motif: /breath/i.test(al.tag) ? 'rings' : /walk|mobius/i.test(al.tag) ? 'ribbon' : 'burst',
  });
}
if (!jobs.length){ console.log('all covers present — nothing to render'); process.exit(0); }

const browser = await chromium.launch({ executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('about:blank');

for (const job of jobs){
  const dataUrl = await page.evaluate(spec => {
    const S = 1024;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    // seeded rng from the track hash — the same record renders the same face
    let a = 0;
    for (let i = 0; i < spec.seed.length; i++) a = (a * 31 + spec.seed.charCodeAt(i)) | 0;
    const rng = () => {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    // key → hue, the colour engine's wheel
    const m = /^(\d{1,2})(A|B)$/.exec(spec.key || '');
    const H = m ? ((+m[1] - 1) / 12 * 300 + 40) % 360 : rng() * 360;
    const minor = m && m[2] === 'A';
    const L = minor ? 0.55 : 0.63;
    const col = (l, c, h, alpha) => `oklch(${l} ${c} ${h} / ${alpha == null ? 1 : alpha})`;

    // ground: deep vertical wash of the key colour
    const bg = g.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, col(0.13, 0.02, H));
    bg.addColorStop(0.55, col(0.16, 0.035, H + 10));
    bg.addColorStop(1, col(0.10, 0.02, H - 15));
    g.fillStyle = bg; g.fillRect(0, 0, S, S);

    g.globalCompositeOperation = 'lighter';
    const e = spec.energy;
    if (spec.motif === 'ribbon'){
      // a Möbius band walking across the frame: layered sine strands that
      // twist once — width collapses through the crossing
      const strands = 110;
      for (let i = 0; i < strands; i++){
        const t0 = i / strands;
        g.beginPath();
        const drift = (rng() - 0.5) * 90;
        for (let x = -40; x <= S + 40; x += 8){
          const u = x / S;
          const twist = Math.cos(u * Math.PI * 2 + t0 * Math.PI);   // the fold
          const y = S * 0.52 + Math.sin(u * Math.PI * 2.2 + t0 * 6.4) * (120 + e * 160) * twist
                  + (t0 - 0.5) * 300 * Math.abs(twist) + drift * (1 - Math.abs(twist));
          x === -40 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.strokeStyle = col(L + t0 * 0.25, 0.11 + e * 0.06, H + t0 * 34 - 10, 0.10 + rng() * 0.08);
        g.lineWidth = 1 + rng() * 2.2;
        g.stroke();
      }
    } else if (spec.motif === 'rings'){
      // breath: concentric rings that wobble like slow lungs
      const rings = 46;
      for (let i = 0; i < rings; i++){
        const t0 = i / rings;
        const R = 60 + t0 * 430;
        g.beginPath();
        const wob = 6 + t0 * 26 + e * 20, ph = rng() * Math.PI * 2, lobes = 3 + Math.floor(rng() * 4);
        for (let k = 0; k <= 220; k++){
          const th = k / 220 * Math.PI * 2;
          const r = R + Math.sin(th * lobes + ph) * wob;
          const x = S * 0.5 + Math.cos(th) * r, y = S * 0.46 + Math.sin(th) * r * 0.96;
          k === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.closePath();
        g.strokeStyle = col(L + (1 - t0) * 0.3, 0.10 + (1 - t0) * 0.06, H + t0 * 26 - 8, 0.16 * (1 - t0 * 0.7));
        g.lineWidth = 1.2 + (1 - t0) * 1.6;
        g.stroke();
      }
      const glow = g.createRadialGradient(S * 0.5, S * 0.46, 0, S * 0.5, S * 0.46, 240);
      glow.addColorStop(0, col(0.85, 0.06, H, 0.25));
      glow.addColorStop(1, col(0.85, 0.06, H, 0));
      g.fillStyle = glow; g.fillRect(0, 0, S, S);
    } else {
      // burst: a pressed master — a spectral fan of rays from the low centre
      const rays = 190;
      for (let i = 0; i < rays; i++){
        const t0 = i / rays;
        const th = (t0 * Math.PI * 1.15) + Math.PI * 0.925;      // upward fan
        const len = 180 + Math.pow(rng(), 1.6) * (420 + e * 220);
        const x0 = S * 0.5, y0 = S * 0.66;
        g.beginPath();
        g.moveTo(x0 + Math.cos(th) * 40, y0 + Math.sin(th) * 40);
        g.lineTo(x0 + Math.cos(th) * len, y0 + Math.sin(th) * len);
        g.strokeStyle = col(L + rng() * 0.3, 0.10 + rng() * 0.08, H + (t0 - 0.5) * 44, 0.12 + rng() * 0.14);
        g.lineWidth = 1 + rng() * 3;
        g.stroke();
      }
      g.beginPath();
      g.arc(S * 0.5, S * 0.66, 34 + e * 22, 0, Math.PI * 2);
      g.fillStyle = col(0.9, 0.05, H, 0.85);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';

    // grain — record-sleeve tooth
    for (let i = 0; i < 5200; i++){
      g.fillStyle = `rgba(255,255,255,${0.015 + rng() * 0.035})`;
      g.fillRect(rng() * S, rng() * S, 1, 1);
    }
    // vignette
    const vg = g.createRadialGradient(S / 2, S / 2, S * 0.42, S / 2, S / 2, S * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, S, S);

    // the sleeve type
    g.textBaseline = 'alphabetic';
    g.fillStyle = col(0.93, 0.03, H, 0.95);
    g.font = 'italic 600 68px Georgia, "Times New Roman", serif';
    g.fillText(spec.title, 64, S - 132);
    g.fillStyle = col(0.8, 0.05, H, 0.8);
    g.font = '500 26px "Courier New", monospace';
    const sub = (spec.artist + '  ·  ' + Math.round(spec.bpm) + ' BPM  ·  ' + (spec.key || '')).toUpperCase();
    g.fillText(sub, 66, S - 84);
    g.font = '500 22px "Courier New", monospace';
    g.fillStyle = col(0.75, 0.04, H, 0.6);
    g.textAlign = 'right';
    g.fillText('∞⁸ ' + spec.label.toUpperCase(), S - 56, S - 56);
    return cv.toDataURL('image/png');
  }, job);
  writeFileSync(job.out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('rendered', job.out.split('/docs/')[1], '·', job.motif, '· key', job.key);
}
await browser.close();
