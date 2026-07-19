// Render the Aethra Kairos mark into the PWA icon set:
// an A whose crossbar is the Möbius⁸ lemniscate — artist on top, engine at heart.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || 'docs/icons';
mkdirSync(OUT, { recursive: true });

// the identity mark: ink A, amber π loop crossing ice e loop as its crossbar
const mark = (pad, r) => `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='100%' height='100%'>
  <rect width='64' height='64' rx='${r}' fill='#05060e'/>
  <g transform='translate(32 32) scale(${1 - pad}) translate(-32 -32)'>
    <path d='M32 9 L14 55 M32 9 L50 55' fill='none' stroke='#e9edf6'
      stroke-width='4.2' stroke-linecap='round'/>
    <g transform='translate(32 40) scale(.55) translate(-32 -32)'>
      <circle cx='23.5' cy='32' r='8.5' fill='#05060e' stroke='#ffb454' stroke-width='6.5'/>
      <circle cx='40.5' cy='32' r='8.5' fill='none' stroke='#6ee7ff' stroke-width='6.5' opacity='.92'/>
    </g>
  </g>
</svg>`;

const page = await (await chromium.launch({
  executablePath: process.env.MB8_CHROME || '/opt/pw-browsers/chromium',
})).newPage();
const jobs = [
  ['icon-192.png', 192, 0, 10],
  ['icon-512.png', 512, 0, 10],
  ['maskable-192.png', 192, 0.22, 0],   // safe-zone padding, full-bleed square
  ['maskable-512.png', 512, 0.22, 0],
  ['apple-touch-icon.png', 180, 0.06, 0],
];
for (const [name, size, pad, r] of jobs){
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${mark(pad, r)}</body>`);
  await page.screenshot({ path: `${OUT}/${name}` });
  console.log(name, size + 'px');
}
process.exit(0);
