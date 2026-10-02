# Judge verdicts, round 1

Each prototype was re-rendered and scored by an independent agent that did not build it. Scale: 8+ only if it belongs full-screen on a 4K TV in a dark room at a show. Cost is software-WebGL time relative to `harness/baseline.frag` (the shipped mandelbox face) at 640x360.

## NAVE (`shaders/kleinian.frag`)

- Score: **7/10** · cost **1.59x** · mud: some · recommendation: needs-another-iteration
- Provenance: Pseudo-Kleinian limit set after Knighty (fractalforums.com "pseudo-Kleinian" thread, 2011), building on Theli-at's "scale-1 Julia box plus something": an unscaled box fold p=2clamp(p,-C,C)-p, then a conditional sphere inversion k=max(S/r^2,1). Closing distance from Knighty: max(rxy-Q, |rxy*z|/|p|)/dr for face 0 (pierced shells); the "standard" (rxy-0.06)/dr for face 1 (hanging filigree, kleinian_filigree.frag). Implemented only from the given spec and my own derivation, including the exact 4C-periodic mod reduction and a CPU clearance scan that found the nave line (y,z)=(Cy,Cz). No mandelbulber2, Shadertoy or Fragmentarium code was read or pasted. A PROVENANCE comment heads the shader.

**Problems**

- Hard far cut at t=5. The fade exp(-kf*t) only gets down to 0.12 (quiet) or 0.25 (loud) at the cut, so geometry ends at a sharp spherical boundary. I confirmed it by rendering the same frame with t<8: wedge-shaped regions with hard edges appear and disappear. In loud t=7 the far arch at the centre shows torn fragments with hard edges. In motion this becomes a reveal front sweeping toward the camera.
- The corridor repeats exactly every 52.8 s (4*CB.x/0.07) along one straight line. Sway and yaw only disguise it, and a room is watched for minutes.
- Beat geometry breath moves fine porthole detail more than the big arches (3.2% of pixels change significantly per beat), so it reads as swimming filigree.
- Violet and teal fresnel stipple on porthole rims, caused by the sawtooth of the 6th-7th fold levels. Temporal stability is good at 640x360 (0.34% of pixels change >12% per 1/60 s, against 2.6% for the baseline), but the figure doubles to 0.71% at 1080p, so it will shimmer more at 4K.
- Near pillars look like matte, lumpy clay or coral. Step-count AO darkens the deep portholes but gives the big surfaces no form.
- Quiet state is dim (peak 125/255) with a low-contrast purple mid-ground, and the exp fade near the void has no dither, so 8-bit TV output risks banding.
- ro.x = 0.07*T is unbounded, so float32 precision degrades over long sessions.
- On the grazing-fallback hit path, lev reads gDr from the previous march step.
- The title 'CATHEDRAL' collides with the fractal room's SPACE face of the same name.
- There is no bounding volume, so the cost does not drop when the frame is emptier: void pixels seen through portholes are the most expensive. Measured ratio is 1.59x at 640x360 (interleaved medians, 77 ms vs 48.5 ms) and 1.43x at 1080p (single run, 780 vs 545 ms).

**Fixes the judge proposed**

- Dissolve to void before the cut: fade *= 1.0 - smoothstep(3.6, 5.0, t), or a fade that reaches about 0 at tmax, so far arches emerge from black instead of popping in at a spherical front.
- Wrap the camera: ro.x = mod(0.07*T, 4.0*CB.x). It is seamless because the DE is exactly 4C-periodic, and it removes the long-session precision loss.
- Break the repetition: slowly animate CB (for example +-0.03 on a slow clock). It is continuous and trig-free, so the shells morph without seams. Or turn 90 degrees at nave crossings on a phrase clock, so the 53-s corridor never repeats exactly.
- Halve the beat breath (0.012 to 0.006), or move beat to a short lamp swell and keep geometry on a slow bass envelope, so the porthole detail stops re-texturing every beat.
- Compute the rim normal with a wider epsilon (about 6*px*t), or fade fr by fold level (lev), so the 6th-7th-level sawtooth stops stippling the rims at 4K.
- Replace step-count AO with one normal-offset AO tap, (DE(p+0.06n)/0.06), to give the near pillars form. It costs one DE.
- Add 1/255 triangular dither before inkRolloff/govern to avoid banding in the dim purple fade.
- Rename the room (NAVE or LIMIT SET) to avoid the fractal SPACE 'CATHEDRAL'.
- MSL port: return dr in a struct, use floor-based mod, pass S explicitly, put govern_x at the exit, and cap the tvOS march at about 96 steps with the same 1.5px cone threshold.

**Metal portability**

Good, with the restructuring the author listed. (1) mod(): use x - y*floor(x/y). MSL fmod truncates toward zero and would break the 4C-periodic reduction for negative coordinates. (2) gDr and gS are mutable program-scope globals, which MSL does not allow. Return dr in a float2 or struct and pass S as an argument. (3) Split the #if FACE into two DE functions with one _x suffix. (4) Put govern_x() at the single exit in place of inkRolloff. The rest maps 1:1: loops bounded by literals (7 and 110), no fwidth or derivatives, no arrays, no textures. pow(0,n) under fast math gives 0, so it is safe. The 1e-8 guards are fine in float32. Budget: the worst case is 110x7 = 770 cheap fold iterations (clamp, dot, max, div, no trig) plus 28 for the normal. The shipped tvOS fractal has 80x12 = 960 plus 48, so the cost class is the same. But there is no bounding sphere, so every pixel marches, and the rays that graze through portholes into void are the most expensive. Plan on capping at about 96 steps on tvOS. Precision: ro.x = 0.07*T is unbounded, and near the camera the normal-tap epsilon (3*px*t, about 1e-4 at 1080p) will lose float32 resolution in long sessions. Wrap ro.x with mod(0.07*T, 4*CB.x). The DE is exactly 4C-periodic, so the wrap is seamless. I scanned the camera's clearance over 4000 s: the minimum is 0.36, so the camera never enters geometry.

## CAGE (`shaders/cage.frag`)

- Score: **7/10** · cost **0.8x** · mud: none · recommendation: add-as-fractal-dice-face
- Provenance: Kalibox / ABox-mod-Kali by Kali (Pablo Roman Andrioli), fractalforums.com, 2010-2011, a modification of Tom Lowe's Mandelbox (fractalforums.com, 2010). Written clean-room from the task's math spec only: z = K-|z|; m = s/clamp(r2,minR2,1); z = z*m + offset (Julia form); DE = |z|/|dr|. Sphere tracing after Hart (1996). All parameters were found by my own sweeps: K=1, s=-1.92, minR2=1e-4, offset 0.29 to 0.334. Nothing under mandelbulber2 or the restricted maps/sheets was opened.

**Problems**

- The ramp blends chord colours linearly in RGB, so complementary pairs pass through grey. With amber/ice, the A-B midpoint is about (0.68, 0.69, 0.61), roughly 11% saturation. In the loud t=7 frame, 7.9% of lit pixels are pale-grey, and the beige/whitish 'crumbs' in the foam are mostly this, not specular. The shader comment 'never through grey' is false for complementary chords.
- The march cut at tn+2.6 is a hard truncation to void, not a fade. At that depth the light is still 11% (quiet) to 18% (loud). Removing the cap changes about 1000 px (1.6% of lit) by more than 16/255 luma, up to 40, in the loud frame. The deep interior gets abrupt dark bites.
- The composition is static. The camera stays at distance 7.8, centred, elevation 0.22 to 0.62 rad, on a slow orbit. Every frame is the same 3/4 turntable shot of a cube filling about 60% of frame height. There is no change of scale, no fly-in and no interior view across a set, and the cube silhouette is very literal (the author admits this).
- The look depends on the generous cone epsilon (0.0028t). With the fractal room's shared 0.0009t epsilon and 96 steps, it thins into sparkly wire: void rises to 85% and the 1/30 s shimmer rises from 23% to 36% of lit pixels. So it cannot be dropped into the shared MARCH_FRAG unchanged.
- Beat moves s by 0.006 on top of the dolly. That re-tiles about 26% of the fine foam on every hit, which reads as a micro-boil rather than a breath.
- Quiet frames are dim (mean luma about 16, against the baseline's 40). The interior fades fast at low energy (exp(-0.86*depth)), so the quiet state is mostly blue edge tubes.
- govern_*() exits and the VizUniforms layout are absent. The 1/rd slab test and the unbounded dr growth are fast-math hazards for the Metal port.
- Temporal stability is better than the baseline but not still. Over 1/30 s, 20 to 31% of lit pixels change by more than 8/255, against 30 to 42% for the baseline. The author's 15% vs 21% used a different threshold. The direction holds, the magnitude is understated.
- The 1080p frame shows serrated, hairy fringes along the inner edges of the edge tubes and slight terracing on grazing faces (cone-epsilon steps). They are acceptable but visible at TV size.

**Fixes the judge proposed**

- Make the ramp chroma-preserving. After each mix, rescale toward the max channel of the two endpoints (or mix in a normalized-chroma space), or narrow each smoothstep to about a 0.25-wide band so A-B blends are thin seams rather than a third of the ramp. Re-measure pale-grey: lit should be under 2% in the loud state.
- Replace the hard depth cut with a window: fade *= smoothstep(2.6, 2.0, t - tn). Light then reaches zero exactly where the march stops.
- Drop the beat's s-breath (keep s fixed at -1.92) and keep only the dolly, perhaps 1.5% with an eased envelope. Geometry should change with bass, not on every hit.
- Give the camera a slow breathing distance, for example 7.8 down to about 4.5 on a 60 to 90 s cycle tied to phrase or energy, so the show sometimes pushes into a face lattice and you see the circles fill the screen. Or try the anisotropic-K variant the author found (hanging perforated panels) to break the literal cube.
- Lift the quiet floor: start light gain at about 0.95 and the depth fade at about 0.75 at energy 0, so the coral core is still readable when quiet (target quiet mean luma about 20 to 22 with void still at or above 75%).
- For the die integration, add it as FORM 10 'CAGE' with an #if FORM == 10 override: hit epsilon 0.0028t, the slab bound, the depth window, and a 'trap' synthesized from 0.42|p| + 0.18|1-|p|| so the room's SURFACES route the chord colours meaningfully. On tvOS, add it as fractalDE mode 3 with the same overrides at 80 steps.
- Metal: clamp the rd components before inverting, cap dr (dr = min(dr*abs(m), 1e30)), add govern_*() at every exit, and lower the step cap to 80 to 96 (measured max was 69).

**Metal portability**

Good. The DE is a pure function of (p, s, off). Loops are bounded by literals 12 and 128. There are no arrays, textures, fwidth/derivatives, mod or fmod (fract behaves the same in MSL), and no globals are written. The cost fits the Apple TV budget easily. In a step-count debug build over 8 frames (quiet and loud, t = 0, 7, 20, 40), rays inside the box took a mean of 12 to 14 steps, the maximum was 69, the mean of 8x8-tile maxima was about 23, and no ray ever reached the 128 cap. Only about 36% of pixels enter the slab, and each hit costs 4 extra DE taps. So the cap can drop to 80 or 96 to match tvOS room_fractal (80 steps) with no visible change. Fast-math hazards: (1) inv = 1.0/rd depends on IEEE infinities; clamp each rd component away from 0 with its sign kept, or bound with a sphere of radius 3.3. (2) dr *= abs(m) with minR2 = 1e-4 allows |m| up to about 19200 per iteration, so dr can overflow to inf near the fold origin, which is undefined under MTL_FAST_MATH; cap dr (min(dr, 1e30)) or test minR2 at 1e-3. (3) The epsilons (hit 0.0028t, about 0.015 to 0.03; normal h 0.0012t, about 0.008) are comfortable in fp32, but do not use half. (4) govern_*() and VizUniforms (stride 144) are missing and must be added; the prototype has neither. If it goes into tvOS room_fractal as a 4th mode, the uniform branch is fine, but it needs its own epsilon, depth cap and spatial colour instead of the shared orbit-trap tint.

## FILAMENTS (`shaders/filaments.frag`)

- Score: **6.5/10** · cost **1.5x** · mud: some · recommendation: needs-another-iteration
- Provenance: Fold: octahedral Kaleidoscopic IFS after Knighty ('Kaleidoscopic (escape time) IFS', fractalforums.com, 2010): abs-fold, sort axes, rotate, scale 2 about vertex (1,0,0). Light: orbit traps after Clifford Pickover (late-1980s orbit-trap pictures) and Inigo Quilez's public orbit-trap articles (iquilezles.org). Emission is accumulated along the sphere trace (demoscene practice), with standard emission-absorption compositing. The mandelbox evidence variant uses Tom Lowe's 2010 box fold and sphere fold. Own derivation: after i folds, z_i = 2^i * isometry(p), so dist(z_i, ring)/2^i is an exact world-space lower bound on the distance to the i-th generation of threads, and it is used as the march step bound. Written from the math only; nothing under /home/user/mandelbulber2 or the forbidden maps/sheets was opened. A PROVENANCE comment heads filaments.frag.

**Problems**

- Soft lines. A Lorentzian density integrated along the view ray gives a projected line profile that falls off only as 1/b. Every thread gets a wide halo, so at 4x zoom the lines look slightly out of focus rather than engraved. This is also the cause of the loud mandala's lavender wash at the centre.
- Dim overall. Mean luma is 18–21 and peak luma about 180–210 of 255, with nothing near clipping. On a 4K TV the piece will feel subdued.
- The loud state answers weakly: mean luma +16%, the beat is invisible (3% radius), and energy only lifts the third generation from weight 0.36 to 0.50 and overall gain by 27%.
- The subject is sparse and small. It covers the central ~50% of the frame width with 3 generations of rings, so it reads as an atom model or armillary sphere more than dense fractal lace. Over a set it is always the same object turning, with a 4-fold mandala about every 10 s.
- Novelty. It re-renders the existing OCTA form, and its glowing-circles-with-flow vocabulary overlaps HOPF.
- Integration gap. The room's surface die (trap colour, shine, lighting) has no meaning for an emission-only face, and the space die (MIRROR/ORBS/TELE/WIDE) would have to be honoured. The form die is a d10, so adding this as an 11th face changes the dice contract unless it replaces OCTA.
- Mid drives the fold twist. A 0.06 rad change moves the second and third generations by roughly 6–8 px at 360p, so an unsmoothed mid signal would make the finest lace wobble.
- Rays running along an axis thread use all 128 steps (2–18 px per frame in axis-aligned views, all at the centre). Absorption hides it, so it is negligible but real.
- Timing noise. SwiftShader varied from 41 to 81 ms per frame for the baseline alone. My interleaved A/B ratio was 1.54 (quiet 1.43, loud 1.59) and the harness pass gave 1.49, consistent with the agent's 1.4–1.8.

**Fixes the judge proposed**

- Sharpen the line profile: g = k*w*bead*lz*lz with lz = F2/(dq*dq+F2), a squared Lorentzian whose projected falloff is 1/b³. I tested this (jf/crisp.frag). Lines become fine and engraved and the loud-centre violet wash disappears, but the frame drops to mean luma 10 and 92% void. Raise the gain about 1.6–2x and widen TF slightly (about 0.013) so the cores stay at least ~1.5 px at 720p.
- Give the energy answer real range now that sharper lines remove the haze: gain about 12 → 24 from quiet to loud, and third-generation weight 0.2 → 0.6, so the third layer visibly 'arrives' on a drop.
- Make the beat legible without a flash. Send the onset envelope to a brightness pulse that travels outward along the parent rings, or to a short burst of pulse contrast (keeping the phase continuous), instead of the invisible 3% radius.
- Feed the fold twist from a smoothed mid envelope (time constant ≥ 250 ms) so the third-generation lace never jitters.
- Bring the camera in from 4.4 to about 3.7, or widen the lens, so the subject fills about 65–70% of the frame height. Optionally let a slow phrase-locked rotation pick which symmetry axis the camera favours, so successive cycles differ.
- Define how the dice apply. Either FILAMENTS replaces OCTA in the form die (keeping it a d10), or it becomes an OCTA surface variant ('LIGHT') that ignores the shine and lighting rolls. Make sure the space die's MIRROR and lens modes still apply to its rays.
- On tvOS, drop the step cap to 96 and skip the miss-path starfield and halo for this mode, keeping true void.

**Metal portability**

Good. The shader uses no mod/fmod, no fwidth, no textures, no arrays and no atan. Both loops are literal-bounded (3 and 128), and `break` is fine in MSL. The out-params become thread references. The only divisions are guarded by 1e-4 and F2 = 1.21e-4, which is safe under MTL_FAST_MATH (z.x + z.y >= 0 after the sort). dT = 1e9 must stay float, not half, as the agent says. Port checklist: flip y for the camera, map uBass/uMid/uTreb/uEnergy/uBeat onto the VizUniforms fields (bass/mid/treble/energy/onsetEnv), add govern_a() at the exit, and do NOT inherit the room's miss-path starfield or chord gradient, which would muddy the threads. Budget is well inside the Apple TV range. I measured about 10 steps per ray on average (9.2 to 10.3). Only 0.06% of rays exceed 96 steps and 0.016% exceed 112, all in axis-aligned views. Each step is 3 cheap folds plus 3 cos, 1 exp and 1 divide, far less work than the shipped room_fractal (80 steps × 8–12 DE iterations + 4 normal taps). Neighbouring pixels that pass close to threads take longer (up to about 60–80 steps), but a tvOS cap of 96 would lose only a few centre pixels in mandala views. It fits as mode 3 of room_fractal in Shaders2.metal, using the _a suffix.

## SPECTRAL (`shaders/spectral.frag`)

- Score: **6.5/10** · cost **1.65x** · mud: none · recommendation: needs-another-iteration
- Provenance: Construction: Knighty's 'mdifs' (distance-estimated IFS from primitives, fractalforums.com, 2012). Fold by a symmetry group, scale toward a vertex, and take the union of the primitive at every scale, dividing each distance by the accumulated scale. The torus/ring distance follows Inigo Quilez's 'distance functions' article. Our own derivations: the ring-of-rings variant (a D4 dihedral fold in the ring plane, then a child frame change (x-1, z, y)*2.2 so each child ring is threaded on its parent), the pixel-footprint LOD (unresolvable scales retract continuously into a line-integrated haze), and the band-per-scale mapping (Aethra-original). Written from scratch without consulting mandelbulber2, Shadertoy or Fragmentarium code.

**Problems**

- Framing: the top-most cluster clips the top edge of the frame in 30 of 45 sampled frames (t=0..176 s step 4, loud), including the agent's own best_1 (t=0) and my 1080p t=0 render. The jewel's extent is about +/-1.98 world units, while the visible half-height at CDIST=4, FOV=0.9 is about 1.8, and the elevated camera pushes the near clusters upward. The bottom of the frame always has margin.
- Cost grows with resolution: the reported 1.65x holds only at 640x360 (proto median 75 ms vs baseline 45.5 ms). At 1080p it is about 2.0x (768 vs 390 ms medians across 7 and 4 frames), because the pixel-relative LOD resolves more scales. At 4K it would be worse.
- The finest resolved scale always has sub-pixel tubes. Rings retract at 2.5-6 px radius, and tube radius is 0.03-0.15 of ring radius, so tubes are about 0.25-0.9 px wide. Those rings render as dotted, broken arcs and crawl in motion: about 3% of structure pixels change by more than 64/255 per 1/30 s, versus 2.5% for the baseline. This happens at every resolution by construction.
- Haze colour depends on resolution. Haze takes ramp(firstRetractedLevel/3), so at 640x360 the halos read violet or lavender (level 5) and at 1080p amber (level 6), and 4K would shift again. The web and tvOS stages would show different colour moods, which is a parity concern.
- The quiet state is dim (mean luma about 12.5) and the shadowed amber reads brownish. On a TV it may look under-lit rather than restrained.
- Motion monotony: the topology is fixed (always the same 4-fold cross). Motion is only a 0.09 rad/s in-plane spin plus camera wander, with no tumble and no change in structure, so it will feel static over a long set.
- The step-count AO is polluted by haze sub-stepping (steps clamp to max(hz, hw)=0.016 near the haze), so rings next to fine clusters darken for reasons unrelated to occlusion.
- Minor claim inaccuracy: the camera's minimum angle off the ring normal is about 17 deg (el=0.3, az crossing 0), not 24 deg. It is still never edge-on.
- No anti-aliasing: the big ring edges show stair-stepping at 640x360. The baseline shares this.

**Fixes the judge proposed**

- Fix the framing: raise CDIST to about 4.8-5.0, or aim the camera at a point slightly below the origin (e.g. look-at -0.15*up), so the bounding radius RB of about 1.98 fits inside the vertical half-extent with about 10% margin at every camera pose. Verify with an edge-clip sweep over 0-180 s.
- Clamp the LOD to a reference resolution: compute gPix with pixK = FOV/min(uRes.y, 1080.0) (or a fixed 1080 reference). This caps cost at the 1080p level, keeps the haze colour identical on web and TV, and preserves the stage parity.
- Give the tubes a pixel floor: th_eff = max(th*f, 0.6*gPix*s) while f > 0, or move the retract window to smoothstep(5.0, 12.0, rpx). The finest visible rings then stay at least about 1 px thick and stop dotting and crawling.
- Fix the haze colour to a chosen chord tone per level, independent of resolution (e.g. always ramp(0.666 + 0.1*uMid)), or derive it from N-1 rather than the first retracted level.
- Raise the quiet floor: lift the ambient term from 0.15 to about 0.25 and make the fresnel rim at least about 0.35, so the quiet jewel reads at mean luma about 16-18 without losing void. Keep the shadowed amber from going brown, e.g. mix toward rim colour rather than darkening.
- Add slow structural life: let the child frame twist by a small angle per level that drifts with uTime or mid (rotate z.xy by phi_i before the fold), or add a slow tumble of the whole jewel about an in-plane axis (+/-20 deg). The 4-fold cross then evolves over a set.
- Replace the step-count AO with a 2-tap DE-based AO along the normal, or count only steps where d < hz, so haze sub-stepping does not darken rings.
- Clamp the fresnel base to [0,1] before pow() for MSL fast-math safety.

**Metal portability**

Good. No mod/fmod, no fwidth or derivatives, no arrays, no textures. Loops are bounded by const N=7 and the literal 120, and the per-band wobble uses a rotation recurrence, so there is no trig inside the loop. fract() and smoothstep() have the same semantics in MSL. The mutable globals (gLevel, gHaze*, gPix, gW0, gWd) become a thread-local struct passed by reference, so it stays stateless. The epsilons are pixel-relative (hit 0.6*pixK*t is about 0.002 world at 1080p; normal e is about 0.0027), which is safe under fp32 fast-math. One fast-math hazard: pow(1.0 - max(dot(n,-rd),0.0), 3.0) can get a tiny negative base when the dot product rounds above 1, giving NaN in MSL, so clamp it to [0,1]. The baseline has the same pattern. Budget: the DE is 7 cheap iterations, about 7 march steps on average, max 80 at 640x360 and 119 for only about 4 pixels at 1080p. No rays exhausted the 120-step cap at 640x360. That fits the 80-120-step, 10-12-iteration Apple TV class. The caveat is that cost scales with output resolution because the LOD is pixel-relative: SwiftShader ratio is 1.65x at 640x360 but about 2.0x at 1080p (median 768 vs 390 ms). Native 4K would resolve scales 5 and 6 and cost more. Clamp gPix to a reference height such as min(uRes.y,1080). VizUniforms must expose the resolution, and govern_*() must be added at the exits during the port.

## PLOTTER (`shaders/plotter.frag`)

- Score: **6/10** · cost **0.84x** · mud: none · recommendation: needs-another-iteration
- Provenance: The line vocabulary follows Michael Fogleman's ln (MIT): planar slices, outlines and hidden-line removal as an idea only; no ln code was used. The fractal is a kaleidoscopic IFS after Knighty ('Kaleidoscopic (escape time) IFS', fractalforums.com, 2010): rotate, fold into the tetrahedral reflection-group chamber, scale about a vertex. Each level contributes a sphere (Eric Haines' 1987 sphereflake idea), and the levels are joined with Inigo Quilez's polynomial smooth-min. Sphere tracing follows Hart (1996). Line anti-aliasing comes from ray differentials (Igehy 1999), evaluated analytically on the tangent plane. All code is my own derivation. Nothing under /home/user/mandelbulber2, the mb-*.md maps or the sheets directory was opened.

**Problems**

- Side-on orbit phases (t about 20, 33 and 48, roughly 40% of the camera orbit) turn into horizontal zebra stripes over a lumpy cushion. The fractal hierarchy barely reads and the look drifts toward terrain CONTOURED. The three best PNGs are all cherry-picked from the near-3-fold-axis phases (t=5 and 11).
- The form has little presence on a show screen. It spans about 35% of frame width with mean luma 7.5 to 8.7 out of 255, so on a 4K TV it is a small, dim ornament in the middle of a black screen.
- The light is fixed in world space, so the treble hatch, the main loud-state cue, disappears whenever the lit side faces away (t=33 shows no hatch at treble 0.7).
- The hatch colour mix(uColA, uColB, 0.5+0.5*N.y) gives a near-grey midpoint for complementary chords: amber plus ice is about (0.68, 0.69, 0.61). This contradicts the shader's own rule of pure chord pens with never a grey midpoint. It is dim but visible as pale grey hatching in the 1080p crop.
- Quiet and loud are subtle as stills. Bass and mid read only in motion, and the energy pen-pressure range of 0.81 to 1.13 is small.
- The hierarchy is shallow. Five levels with smooth-min beads read as a seashell or pagoda ornament more than a fractal, especially at 360p where small beads lose their slices to the density fade.
- Small broken stipple and jaggies appear at occlusion edges on the small beads (visible in the 1080p crop). Rays that run out of the 100 steps while grazing creases are painted as silhouette instead of lines.
- The reported cost ratio of 0.70 is optimistic. I measured 0.84 at 640x360 (prototype median 39.5 ms, baseline median 47 ms, trivial-shader floor about 4 ms) and 0.81 at 1920x1080 (327 ms against 405 ms). It is still cheaper than the shipped mandelbox face.
- Not yet a Metal room: the program-scope mutable globals gRot and gScale must be refactored, and govern_*() exits and VizUniforms mapping are missing.

**Fixes the judge proposed**

- Tie the light to the camera, for example L = normalize(0.5*rt + 0.7*up - 0.5*fwd), so the treble hatch shows at every orbit phase.
- Remove the side-on zebra phase. Either limit the camera path to the hemisphere around the 3-fold axis where the spiral reads (bound elevation and azimuth swing instead of a full 0.11*uTime orbit), or tilt the slice normal n1 partly toward the view direction at a fixed oblique angle, so the contours always wrap the beads rather than banding across the silhouette.
- Bring the camera closer (CAMR from 2.3 to about 1.75, or a narrower FOV) so the shell fills about 60% of frame height. Consider a slow dolly toward a sub-spiral for presence on a TV.
- Draw the hatch with a pure pen, for example pen(floor(f2*0.5)) or uColB alone, instead of mixing A and B, so no grey midpoint can appear.
- Make loud readable in a still: let energy or treble widen the index pen (0.65 to about 1.1 px) and lower the minor-line density-fade threshold (show more slices as energy rises), so loud reads as denser, heavier engraving and quiet as sparse index lines.
- Deepen the IFS to 6 or 7 literal-bounded levels. That is still about half the Apple TV DE budget and gives the 1080p frame visible fine beads, so it reads as a fractal rather than an ornament.
- Scale pen half-widths and the 4/8 px fade thresholds by uRes.y/720, tuned at 1080p, which already looks better than the 360p tuning renders.
- For the twin: pass gRot and gScale into DE, map VizUniforms, add govern_*() at every exit, and wrap the time phases (fract or mod on 0.11*uTime and 0.12*uTime) for fast-math sin accuracy.

**Metal portability**

Good. There is no fwidth or derivative call: line anti-aliasing is analytic from ray differentials. mod is already written as k - 3*floor(k/3), so the trap where MSL fmod truncates instead of flooring does not arise. There are no arrays or textures. Swizzle assignments such as z.xy = -z.yx are legal in MSL, and mat3 and float3x3 are both column-major. Required changes: (1) the mutable program-scope globals gRot and gScale are illegal in MSL and must be passed into DE as parameters or a struct; (2) VizUniforms mapping (stride 144) and govern_*() at every exit are absent and must be added. Fast-math: the epsilons are safe. The hit epsilon 0.25*pxA*t is about 2e-4 at 4K with t near 2, far above fp32 resolution, the normal epsilon is at least 8e-4, and the smallest smin k is about 0.0028. Phases driven by uTime (0.11*uTime for the camera, 0.12*uTime for the slices) should be wrapped so fast-math sin stays accurate over long shows. Budget: a 100-step march with a 5-iteration DE, plus 4 normal taps and a bounding-sphere early-out, is well under the Apple TV allowance of an 80-120-step march with a 10-12-iteration DE, so there is room to deepen the IFS to 6-7 levels. Pen widths and the 4/8 px density-fade thresholds are in pixels, so they need a resolution factor. Tune it at the target resolution: the 1080p render already looks better than 360p, so scale by uRes.y/720, not /360.

## CHAINMAIL (`shaders/rings.frag`)

- Score: **6/10** · cost **1.27x** · mud: none · recommendation: needs-another-iteration
- Provenance: msltoe, "low-hanging dessert: an escape-time donut fractal", fractalforums.com (2014). Written from the task's math spec and my own derivation only. I did not open mandelbulber2, the mb-* maps or the sheets, and pasted no Shadertoy or Fragmentarium code. The PROVENANCE comment is at the top of the shader. Per level: exact torus distance divided by the accumulated scale, then atan, snap to the nearest of N sectors, rotate onto +x, subtract R, lean, swap y<->z, spin, scale by F. My own additions: the subtree-bound early break, pixel-footprint LOD that thins a level and lifts it past the hit epsilon, and the seam-safe sizing rule 1/(F-1)^2 < sin(pi/N), derived from the condition that grandchildren must fit inside the sector's half-width at the child's innermost point.

**Problems**

- Seam safety fails under mid lean at the resolution the TV actually renders. At 1920x1080 with N=7 and the prototype's own loud setting (mid 0.6), level-2 links are truncated into flat, faceted pink shards, and stipple or speckle patches appear in the dense interior. With mid 0.0 at 1080p they are gone, so the lean term breaks the F(N) sizing bound. With mid 1.0 the level-1 blue rings visibly tear and kink, and you can see it in the full frame. At 640x360 the fine levels are not resolved, which is why 12 review rounds at that size missed it.
- The look depends on resolution. The best PNGs at 640x360 show about 3 levels; 1080p shows all 5, with ice-blue level-4 rings everywhere. The submitted renders do not show what the Apple TV will show, and web booth vs TV looks will differ.
- The LOD fade band aliases at 720p and 1080p. Fading level-4 rings render as dotted or dashed outlines, and N=9 shows comb-like dashes on the rings.
- The material reads as glossy toy plastic or beads, not precious metal, and the level-0 ring is a plain featureless bar.
- The composition is static. It is always the same tilted ellipse at about 55-60% of frame width, seen from the same elevation, and nothing ever approaches the self-similar depth that is the shape's main appeal.
- The beat breath (2.5% of R) is invisible, and mid is barely readable, so two of five musical channels do little.
- Rings seen edge-on read as small spikes at 640x360.
- Not yet a room: N is hard-coded, and VizUniforms and govern_*() are not modelled.

**Fixes the judge proposed**

- Make the child scale aware of the lean. Compute the leaned child's tangential half-extent (child radius plus subtree bound, rotated by the lean) and pick F so it fits inside sin(pi/N) at the innermost point. Alternatively, clamp the lean to what the current F allows, or test the neighbouring sector as well at levels 0-1 only (cheap). Verify at 1920x1080 with N=3..9 and mid 0..1.
- Make the LOD reference independent of resolution, e.g. gPix = 0.9/min(uRes.y, 720.0), or cap the visible level count, so web and TV show the same structure. Always review renders at 1920x1080.
- Replace thinning in the fade band with a wider smoothstep plus colour/opacity fade toward the parent's tint, so fading rings do not break into dotted lines.
- Push the material toward real metal: higher-contrast environment strips, darker base, a sharper Fresnel rim. Give level 0 its own profile (twisted or beaded) so it is not a plain bar.
- Add composition variety per entry: roll camera elevation and distance, and add an occasional slow dolly into one subtree so the self-similarity is felt. Fill more of the frame.
- Give beat something visible but gentle, such as a small kick to the grandchild travel phase. Make mid read, for example as torsade lean on the outer levels only, once seams are safe.
- Guard normalize() in the normal estimate for MTL_FAST_MATH, and wire N, VizUniforms and govern_*() for the Metal twin.

**Metal portability**

Good, with the usual chores. Both loops are literal-bounded (5-level DE, 110-step march, 4 normal taps). There are no arrays, textures, recursion or fwidth. The sector snap uses floor(a/sec+0.5) rather than mod, so the fmod-truncates-vs-mod-floors trap does not arise. Required changes: (1) the file-scope mutable globals (gN, gR, gT, gF, gBnd, gSec, gPix, gLean, gSpin, gRx, gRz, gRo, plus the DE side outputs gLevel and gW) move into a thread-local context struct passed by reference; (2) atan becomes atan2; (3) add VizUniforms (stride 144) and govern_*() at every exit; (4) wire gN to a per-entry uniform, since it is hard-coded to 7.0. Under MTL_FAST_MATH, guard normalize() in the 4-tap normal with max(len, 1e-6): the level-4 tube radius (about 0.0044 at N=7) is close to the normal epsilon (0.0012*t, about 0.004), so the taps can cancel and give NaN or black pixels. The hit epsilon (0.0008*t) is safe in fp32. Budget: at most 110 steps x 5 levels = 550 level-iterations, well inside the 80-120 step x 10-12 iteration envelope. Each level does atan2 plus cos and sin, so use sincos. Cost grows with resolution because the LOD is resolution-relative: my paired measurement was 1.27x baseline at 640x360, about 1.45x at 720p and 1.2-1.4x at 1080p. That is acceptable, but at the TV's resolution all 5 levels resolve.

## LACE (`shaders/lace.frag`)

- Score: **6/10** · cost **1.75x** · mud: none · recommendation: needs-another-iteration
- Provenance: Built from a clean room. I opened no mandelbulber2 files, maps or sheets. The math is the classical Apollonian/Soddy sphere packing: five mutually tangent spheres, with the packing as the orbit under inversion in the five dual spheres, each orthogonal to four of the five. Public sources credited in the PROVENANCE header: Paul Bourke's Apollonian write-ups, Inigo Quilez's Apollonian and sphere-inversion articles, and Tom Lowe (TGlad), sphere-inversion clusters, fractalforums.org 2020. I derived every constant myself and checked it numerically in work/check.mjs: big balls at d=1/(1+sqrt(2/3)) with r=1-d; central dual radius^2 = d^2-r^2 = 0.10102; outer duals centred at -3v_j with radius sqrt(8); the dual polyhedron has all dihedral angles pi/3. Everything else is my own code: the fold loop with min-over-frames distance, the slicing-sphere ring construction, the transport of normals through inversions for the exact tube distance, and the inversion+mirror hyperbolic flow. Nothing was pasted from Shadertoy or Fragmentarium.

**Problems**

- Visible limb artifacts at show size. At t=30 (quiet) a big portal ring at the lower-left limb is broken into two hooked arcs with a gap, and the arcs stick out past the globe silhouette. At loud t=7 and in hero720_t5, edge-on portal rings show as straight orange chords with a notch bitten out of the globe silhouette. The globe often looks dented or faceted at its edge.
- Single sample per pixel, with threads 1.3-2.3 px wide at 640x360: there are staircase jaggies on every ring (clearly visible in 3x crops), and thin-thread crawl is likely in motion. No analytic coverage or AA is applied, although the march already tracks the minimum distance.
- The inner armillary has dashed or broken arc segments and orange specks near ring crossings (confirmed in crops and in the three-frame sequence). These are xline-clamp or overstep artifacts near tangencies.
- The fractal identity does not read: only two tiers of ring size are visible, the fine generations that treble reveals are sub-pixel at 640x360, and the shell looks like a circle-packed wiffle ball rather than an Apollonian packing.
- The colouring is monotone: about 90% of threads take the B colour, the four portals A and the inner star C. The ramp over log2 J barely varies because few generations are visible.
- Beat is effectively invisible, and the bass swell is subtle in stills.
- The composition is static: a fixed-radius orbit camera, and the globe is always centred at the same size (about 70% of frame height) with no dolly or reveal. Mean luma is about 12; on a 4K TV in a dark room it is a small, dim, elegant object rather than a show moment.
- smoothstep with edge0 > edge1 (line 128) is undefined behaviour in GLSL and MSL.
- The self-report's cost attribution is incorrect. The march averages about 14 steps, never reaches the cap, and peaks around 70; the cost is the DE body. Measured ratio: about 1.70 quiet and 1.76-1.84 loud (interleaved A/B), 1.79 from the sequential harness runs. That is under 2.0, but with a loud-case margin of only about 10%.

**Fixes the judge proposed**

- Fix the limb: reduce step relaxation or clamp the step near the outer slicing sphere when the ray is grazing, for example t += min(d*0.75, k*t*pixelAngle*N) once |s1| is small. Alternatively, make the portal-ring tube distance exact: the ring is a circle in render space and has a closed-form torus distance before the flow. That would stop the broken, hooked portal arcs and the protruding segments.
- Add cheap analytic AA: the march already tracks hmin (the angular closest approach). Composite the thread colour by coverage = smoothstep(1.5*pixelAngle, 0, hmin) instead of relying on the binary hit test, or supersample 2x only where hmin is within 2 px. This removes the staircase and the crawl at 1080p.
- Make the Apollonian nesting legible: add a slow, music-gated camera dolly that sometimes pushes to about 1.4 units and drifts toward a portal or limb, so third- and fourth-generation rings become 2-6 px and the self-similarity shows. Alternatively, raise the treble range so log2 J up to 5 is visible when the camera is close.
- Give beat a nameable but gentle event: a chord-coloured brightness pulse that travels outward through the generations (a wave in log2 J, or in distance from gCore) and decays over about 400 ms, with no full-field flash. Widen bass eps to 0.05-0.35, or let the flow direction gU follow bass onsets, so swell and core drift read in stills.
- Spread colour: drive the ramp from log2 J with a bigger coefficient and from the frame index or the dual-sphere choice, so threads in the pebble mesh alternate between B and C and the portals keep A. That keeps chord-only colour but reduces the B monotone.
- Replace smoothstep(1.0, 0.6, dd) with 1.0 - smoothstep(0.6, 1.0, dd), and replace the float-equality argmax/argmin with explicit comparisons, before the Metal port.
- Lower the march cap from 128 to 96 (0% of pixels reach it), and cut DE cost by computing xline only for the slicing sphere that is nearer (|s1| vs |s2|) and hoisting the per-iteration log2/smoothstep fade. That should bring loud frames safely to about 1.5x.

**Metal portability**

Mostly straightforward, with five items to handle. (1) The program-scope mutable globals gU, gFC, gCore, gFR2, gTh, gR1, gR2, gLcut, gJ and gLayer are illegal in MSL. Make them a thread struct passed by reference into DE(); gJ and gLayer are side-channel outputs that the march loop and the hit-colouring read. (2) inversesqrt becomes rsqrt. (3) smoothstep(1.0, 0.6, dd) on line 128 has edge0 > edge1, which is undefined in both the GLSL ES and MSL specs. Rewrite it as 1.0 - smoothstep(0.6, 1.0, dd). (4) The argmax and argmin selection uses exact float equality (mx == dv.x ...). That is safe because max/min return one of their operands, but under MTL_FAST_MATH with FMA contraction dv may be recomputed differently. Use explicit comparisons, or track the index alongside the max, so that no fall-through to V4 can produce a wrong fold. (5) Precision: L = 1/eps reaches 14.3 and gFR2 about 203, so p = gFC + w*J cancels from magnitude 14 down to about 1. That is about 1e-6 absolute error against a 0.0085 thread and a 0.002 hit epsilon, which is fine even with fast math. The xline clamp max(1-c^2, 0.03) prevents blow-ups. There is no mod/fmod, no fwidth/dFdx, no texture, no array and no feedback. Both loops are literal-bounded (12 and 128) with early breaks. Budget: my step-count diagnostic shows 13.6-15.1 mean march steps per in-ball pixel, a maximum of about 70, and 0.0% of pixels reaching the 128 cap. So the march fits easily inside the Apple TV 80-120-step budget, and the cap can drop to 96 or even 80 with no visual change. The cost is in the heavy 12-iteration DE body (two xline sqrt/divides, two normal reflections, log2 and smoothstep per iteration) plus the 4 tetrahedral-normal DE calls. The prototype agent's claim that "the cost is in march steps" is wrong. The govern_*() exits and VizUniforms (stride 144) are port-time work, not present in the prototype.

## NEST (`shaders/nest.frag`)

- Score: **6/10** · cost **1.42x** · mud: some · recommendation: add-as-fractal-dice-face
- Provenance: Mandelnest per-axis map by Jeannot, "Mandelbrot 3D: mandelnest", fractalforums.org (2020): w_i = sin(P*asin(z_i/r)), the direction is renormalised, scaled by r^P, then c = p is added. The DE is the potential form 0.5*log(r)*r/dr with the bulb derivative dr = P*r^(P-1)*dr + 1 (White/Nylander 2009 Mandelbulb; Inigo Quilez's DE articles). I added my own correction: dr is divided by clamp(|w|,0.35,1) for the renormalisation stretch. asin uses the Abramowitz & Stegun 4.4.45 form, refit by me with a0 pinned to pi/2 so the odd extension is exactly continuous at 0. The classic-bulb comparison uses the White/Nylander triplex formula. Everything was written from the math. Nothing was read under /home/user/mandelbulber2 or from the maps and sheets scratch files.

**Problems**

- Ray-march artifacts on the petal fields. In 720p crops (t=7 loud, t=56 glide) there are smeared streak textures and hard staircase-edged 'flake' chips where the step overshoots. Smooth petals also show terrace contour rings like wood grain. The clamp(|w|,0.35,1) derivative correction is non-smooth and heuristic, and these defects will be visible full-screen at 1080p.
- One chord slot dominates. For long stretches 70-80% of the lit surface sits in one slot (violet from t=0 to 30 with the stand-in chord), so many frames are effectively one colour plus a small accent.
- The composition is the same object all session. The camera is locked to the pole, the ball always fills about 55% of frame height and sits centred, the P glide period is about 105 s and the roll is slow. The beauty depends on that locked view, because off-axis it becomes a lumpy pinecone.
- Low novelty as a standalone room. It reads as another mandelbulb-family ball next to the fractal room's bulb faces.
- The beat is not gentle in practice. The 3% geometry scale on fine fractal detail shifts about 30% of lit pixels per beat if uBeat is an impulse.
- The quiet state is murky: a dim violet blob with soft internal structure (meanLuma 20) and few crisp edges, so there is some mud inside the silhouette even though the macro void is fine.
- Silhouettes have a hairy, sub-pixel fringe from the residual singular rays.
- Metal precision hazards: pow() with a zero base under fast-math, and the unclamped final log(length(z)).
- The best PNGs are cherry-picked. t=56 (ice and amber) is genuinely attractive, but my t=0, t=7 and t=30 renders are flatter: a violet blob, and an amber pumpkin with steel-blue ribs.

**Fixes the judge proposed**

- Replace clamp(lw,0.35,1) with a smooth regulariser such as dr /= sqrt(lw*lw+0.1). Also carry a min|w| trap and shrink the step factor near singular rays, t += d*mix(0.45,0.8,smoothstep(0.2,0.6,minW)), then add 2-3 bisection refinement steps on hit. Together these remove the flakes and the terrace rings.
- Set the normal epsilon from the pixel footprint (about 1.5 px: k*t/uRes.y) instead of 0.0032*t, so crispness holds when going from 360p to 1080p.
- Split the front petal field across two chord slots every frame: raise the orbit-trap weight in ramp() from 0.2*tR to about 0.45, or key the slot to the band term. Tie slot rotation to a slow musical accumulator (phrase or section) rather than raw time.
- Cut the beat breath to 1-1.5%, or put it on a smoothed beat envelope. Alternatively route the beat to a small filigree or rim bump instead of geometry.
- Lift the quiet floor, for example gain 1.45 + 0.3*E and a stronger rim at low energy, so the quiet state shows crisp edge structure instead of a dim blob.
- Add the tested 3-fold diagonal (trefoil) excursion and an occasional slow dolly toward a petal hub to break the single-view sameness. As a dice face, face cycling also solves this.
- For Metal: use a thread state struct, literal loop bounds, explicit multiplies or powr instead of pow, clamp length(z) before log, and float only.

**Metal portability**

Good, close to 1:1. The shader has no textures, arrays, atan, fwidth, mod or fmod. fract() in ramp() behaves the same in MSL. Changes needed: (1) gP, gS, trapR and trapF are mutable program-scope globals, which MSL forbids. Pass them as a thread struct by reference into DE(). (2) Remove the PFORCE/NITER/NSTEP #ifdef hooks and make NITER=6 and NSTEP=100 literal. (3) Use float throughout, not half. asinF's sqrt*poly and exp((P-1)*log r) need it. (4) Under MTL_FAST_MATH, pow(x,y) is undefined for x<=0. pow(1-ndv,3) and pow(max(dot,0),40) can hit 0, so use explicit multiplies or powr on max(x,1e-4). (5) The final r=length(z) feeds log() unclamped. Clamp it to 1e-6 so a NaN cannot stall the march to 100 steps. (6) sign(0)=0 matches in both languages, so the continuity of asinF holds. (7) The epsilons are relative: hit 0.0015*t and normal 0.0032*t, with t around 2-3. That is safe for fp32 fast-math. Budget: 100 steps x 6 iterations, where each iteration costs 3 sin + 3 sqrt + exp + log + 2 lengths, plus 4 normal taps. That is roughly 12 mandelbox-iteration equivalents, inside the 80-120 step x 10-12 iteration Apple TV envelope. SwiftShader puts it at 1.33-1.48x the shipped mandelbox baseline, so it likely needs the same render scale as the current fractal room at 1080p. Standard port work still applies: VizUniforms verbatim, govern_*() at every exit and the _x suffix.
