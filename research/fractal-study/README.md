# Fractal study: eight prototype rooms

Throwaway evidence for one question: can outside fractal and line-art work drive
new visuals in this engine, and how? These files are not wired into the player or
the Apple TV app. They are reference material for the waves that follow.

## What was studied and what came of it

| Source | Licence | Verdict |
|---|---|---|
| mandelbulber2 (3D fractal renderer) | GPLv3 | **Use the maths, never the code.** GPL code in `docs/index.html` would make the player a GPL work, and the parity law would carry it into the App Store build. The formulas, the inventors' published posts, and the rendering techniques as algorithms are free to reimplement. |
| ln (3D line-art renderer, Michael Fogleman) | MIT | **Take the idea, skip the code.** ln removes hidden lines on the CPU, which is too slow for live frames. In a raymarcher, lines drawn as level sets on the first hit get hidden-line removal for free, so only ln's line vocabulary carries over. |

## The prototypes

Every shader here is original code, written from published maths without access
to any GPL renderer source. Each obeys the Apple TV room laws: loops bounded by
literals, stateless, colour only from the three chord colours, void ground, ink
rolloff at the exit. Scores come from an independent judge (see `JUDGES.md`); 8+
means "full-screen on a 4K TV in a dark room".

| Room | Shader | Maths | Score | Cost vs shipped face | Recommendation |
|---|---|---|---|---|---|
| NAVE | `shaders/kleinian.frag` | pseudo-Kleinian limit set (Knighty after Theli-at, 2011) | 7 | 1.59x | new room |
| CAGE | `shaders/cage.frag` | Kali box (Kali, after Tom Lowe's mandelbox, 2010) | 7 | 0.80x | fractal form face |
| FILAMENTS | `shaders/filaments.frag` | orbit-trap light on Knighty's octahedral KIFS | 6.5 | 1.50x | engine upgrade |
| SPECTRAL | `shaders/spectral.frag` | IFS of rings, one spectrum band per scale (after Knighty's mdifs, 2012) | 6.5 | 1.65x | new room |
| PLOTTER | `shaders/plotter.frag` | ln-style slice, outline and hatch lines on a KIFS | 6 | 0.84x | new room |
| CHAINMAIL | `shaders/rings.frag` | recursive torus rings (msltoe, 2014) | 6 | 1.27x | later |
| LACE | `shaders/lace.frag` | Apollonian / Soddy sphere packing | 6 | 1.75x | later |
| NEST | `shaders/nest.frag` | per-axis power map, seam-free at any real power (Jeannot, 2020) | 6 | 1.42x | fractal form face |

`frames/` holds one frame per prototype and four photos of the shipped fractal
room (`before-*.jpg`) for comparison.

## Running them

```bash
cd research/fractal-study/harness
node render.mjs ../shaders/plotter.frag /tmp/plotter --times 0,5,11 --bass 0.95 --energy 0.95
node render.mjs baseline.frag /tmp/base --times 0,5,11      # cost reference
```

`render.mjs` draws a fragment shader in headless Chromium with software WebGL and
prints per-frame time (only meaningful as a ratio against `baseline.frag`), the
share of near-black pixels, and mean luma. Uniforms: `uRes`, `uTime`, `uBass`,
`uMid`, `uTreb`, `uBeat`, `uEnergy`, `uColA/B/C`.

## Before any of this ships

- Colour in the prototypes is a plain RGB blend standing in for the engine's OKLCH
  chord ramp; the real ramp removes the grey midpoints the judges flagged.
- Apply the judges' fixes (`JUDGES.md`) in the real room, against the real uniforms,
  and review at 1080p.
- Follow the clean-room rule for every new form: a maths-only spec written from the
  inventor's original public post, a provenance header naming the inventor in both
  stages, and no GPL renderer source anywhere in the implementer's reach.
