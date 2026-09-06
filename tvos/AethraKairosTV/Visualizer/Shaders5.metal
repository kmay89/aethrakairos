#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 3 (D) — PARLOR, DISPERSION, CREATURE, SLINKY.
   Single-triangle fragment shaders, one per room, nothing else.

   The same laws that rule Shaders.metal / Shaders2.metal /
   Shaders3.metal / Shaders4.metal rule here:
   - The ground is the void (#05060e). A room ADDS light onto it; it
     never paints a theme over it. A faint static starfield lies
     under every room so the void reads as a sky, not a hole.
   - Colours come ONLY from the track's chord (colA/colB/colC). No
     hardcoded rainbows — a rainbow must be earned upstream. The one
     sanctioned exception in this file is DISPERSION, whose colour is
     REAL PHYSICS (a CIE-observer spectral integral, like FIREWORKS
     and OIL FILM); even there the chord is kept as a subtle tint.
   - phi(x) = 2·atan(x) is the engine's signature fold; the rooms in
     this file lean on analytic form and honest optics instead, but
     the law is the same: unbounded runs brought home to a finite frame.
   - WCAG 2.3.1 is a law: govern_d() caps luminance at every exit so
     additive enthusiasm becomes saturation, never a white strobe.
     The cap is the INK budget: white in 0.05..0.92 sets how bright a
     core may burn, so a drop may bloom where a verse will not. Every
     beat is answered as a breath of GEOMETRY, never a luminance flash —
     PARLOR and SLINKY are calm rooms and must never strobe.
   - r32Float is not filterable on the living-room GPUs, so spectrum
     and waveform are read by INTEGER TEXEL and lerped by hand.
   - ghostStrength is the phantom hand: before shaping, each room lets
     its coordinate drift toward (ghostX, ghostY).
   - roll0..2 are the room's dice, re-dealt on entry — a room never
     shows the same face twice. Each room spends its dice on
     form / direction / proportion so re-entry is a new variation.
   - Every accumulation loop is bounded by a compile-time literal
     (<= 96 iterations) — no data-dependent trip counts.

   This is a SELF-CONTAINED translation unit. Every helper wears a _d
   suffix so its symbol never collides with the identically shaped
   helpers in Shaders.metal / Shaders2/3/4.metal (a helper cannot
   cross a Metal translation unit). The one triangle stage
   (fullscreen_vertex) lives in Shaders.metal and is reused here.
   ================================================================ */

constant float PI_D  = 3.14159265359;
constant float TAU_D = 6.28318530718;

// the void ground — #05060e in the linear-ish working space
constant float3 VOID_D = float3(0.019608, 0.023529, 0.054902);

// ---------------------------------------------------------------
// THE FINAL VizUniforms — verbatim, byte-for-byte identical across
// Shaders.metal, Shaders2/3/4/5.metal, Xforms.metal and the mirror
// Swift struct. The first 96 bytes are wave 1 unchanged; _pad0 is
// renamed xformMode (same slot); twelve floats are appended after
// colC, padded to a clean 144-byte, 16-byte-aligned stride. Wave 3
// gives _pad1/_pad2 meaning (lens/lensAmt) in the files that READ
// them (Shaders.metal, Lens.metal, the Swift mirror); the rooms here
// never read the lens, so the last three floats keep the neutral pad
// names — what matters is three floats there, so the stride is 144.
// ---------------------------------------------------------------
struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11  (was _pad0)
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

// ---------------------------------------------------------------
// helpers (all _d — this file's private ladder)
// ---------------------------------------------------------------

inline float lumaOf_d(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// The flash governor, doubling as the INK budget. white in 0.05..0.92
// maps to a luminance cap in ~0.15..0.85 — overdrive turns to colour,
// and the ceiling itself rises and falls with the story's openness.
inline float3 govern_d(float3 c, float white) {
    float L = lumaOf_d(c);
    float cap = 0.13 + 0.80 * clamp(white, 0.0, 1.0);
    return (L > cap) ? c * (cap / max(L, 1e-4)) : c;
}

// sin-dot hashes: 1->1 and 2->1
inline float hash11_d(float x) {
    return fract(sin(x * 12.9898) * 43758.5453123);
}
inline float hash21_d(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands.
// Manual lerp — the filterability law forbids a linear sampler here.
inline float band64_d(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel position -> centered, aspect-true coordinates (y in -1..1)
inline float2 centered_d(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    return p;
}

// the starfield underlay — two octaves of tiny static hashed points,
// brightness ~0.10-0.25, returned as a scalar and tinted by the caller
// so even the sky obeys the colour law.
inline float starLayer_d(float2 uv) {
    float s = 0.0;
    float2 g = uv * 94.0;
    float2 c = floor(g);
    float2 f = fract(g) - 0.5;
    s += smoothstep(0.994, 1.0, hash21_d(c)) * exp(-dot(f, f) * 45.0) * 0.16;
    g = uv * 171.0 + 27.3;
    c = floor(g);
    f = fract(g) - 0.5;
    s += smoothstep(0.997, 1.0, hash21_d(c + 5.9)) * exp(-dot(f, f) * 60.0) * 0.10;
    return s;
}

// the phantom hand — before shaping, a coordinate drifts toward the
// ghost point inside a soft attraction well, scaled by ghostStrength.
inline float2 ghostWarp_d(float2 p, constant VizUniforms& U) {
    float2 g = float2(U.ghostX, U.ghostY);
    float2 d = g - p;
    float pull = U.ghostStrength * 0.33 * exp(-dot(d, d) * 0.8);
    return p + d * pull;
}

// the chord read as a cyclic three-stop ramp (A->B->C->A), the only
// colour source these rooms are allowed (bar DISPERSION's tint). t is
// wrapped to 0..1.
inline float3 chordRamp_d(constant VizUniforms& U, float t) {
    t = fract(t);
    float seg = t * 3.0;
    if (seg < 1.0)      return mix(U.colA.rgb, U.colB.rgb, seg);
    else if (seg < 2.0) return mix(U.colB.rgb, U.colC.rgb, seg - 1.0);
    else                return mix(U.colC.rgb, U.colA.rgb, seg - 2.0);
}

// the glow of a chalk grain to a rib SEGMENT [base -> tip]: closest
// point on the segment, then a tight gaussian. Shared by CREATURE.
inline float segGlow_d(float2 p, float2 base, float2 tip, float k) {
    float2 ap = p - base;
    float2 ab = tip - base;
    float h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
    float d = length(ap - ab * h);
    return exp(-d * d * k);
}

// ---- an analytic CIE 1931 observer, gaussian-lobe fit --------------
// Wyman/Sloan/Shirley "Simple Analytic Approximations to the CIE XYZ
// Colour Matching Functions" — each bar is a sum of piecewise (skewed)
// gaussian lobes. Real physics, not an invented API: this is the same
// observer FIREWORKS/OIL FILM lean on, ported once here with the _d
// suffix. lambda in nanometres, returns (X,Y,Z) weights.
inline float lobe_d(float x, float mu, float s1, float s2) {
    float t = (x - mu) / (x < mu ? s1 : s2);
    return exp(-0.5 * t * t);
}
inline float3 cie_d(float lam) {
    float X = 1.056 * lobe_d(lam, 599.8, 37.9, 31.0)
            + 0.362 * lobe_d(lam, 442.0, 16.0, 26.7)
            - 0.065 * lobe_d(lam, 501.1, 20.4, 26.2);
    float Y = 0.821 * lobe_d(lam, 568.8, 46.9, 40.5)
            + 0.286 * lobe_d(lam, 530.9, 16.3, 31.1);
    float Z = 1.217 * lobe_d(lam, 437.0, 11.8, 36.0)
            + 0.681 * lobe_d(lam, 459.0, 26.0, 13.8);
    return float3(max(X, 0.0), max(Y, 0.0), max(Z, 0.0));
}
// linear sRGB (D65) from CIE XYZ — the standard matrix.
inline float3 xyz2rgb_d(float3 c) {
    return float3(
        dot(c, float3( 3.2406, -1.5372, -0.4986)),
        dot(c, float3(-0.9689,  1.8758,  0.0415)),
        dot(c, float3( 0.0557, -0.2040,  1.0570)));
}

// ---------------------------------------------------------------
// PARLOR — the illusion machine. One of three rolled fields lies to
// the eye, and the LIE STRENGTHENS AS THE MUSIC BUILDS — the mortar
// luminance, the twist and the ray/seed count all ride a long-term
// energy term (`build`), so a quiet verse holds the geometry honest
// and a swelling section makes it slide. Geometry only, NEVER a
// strobe (this is a calm room). roll0 deals the field, roll1 the
// spin direction, roll2 the ring/petal proportion:
//   CORD   — café-wall tiles sheared into a Fraser false spiral.
//   PENTA  — a de-Bruijn 5-wave Penrose skeleton (the pentagrid).
//   SWARM  — a golden-angle phyllotaxis whose parastichy spirals
//            manufacture their own motion.
// ---------------------------------------------------------------
fragment float4 room_parlor(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_d(centered_d(pos.xy, res, U.aspect), U);

    float3 col = starLayer_d(uv) * mix(float3(0.7), U.colC.rgb, 0.5);

    int form = (U.roll0 < 0.34) ? 0 : (U.roll0 < 0.67 ? 1 : 2);
    float dir = (U.roll1 < 0.5) ? -1.0 : 1.0;
    // the long-term build: the picture lies harder as the music grows.
    float build = clamp(0.20 + 0.65 * U.energy + 0.10 * U.act, 0.0, 1.0);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float r = length(p);
    float ang = atan2(p.y, p.x);

    if (form == 2) {
        // SWARM — golden-angle seeds; the emergent parastichy spirals
        // ARE the illusion, so the seed count riding the build makes the
        // false motion strengthen with the music.
        const float GA = 2.39996323;
        float spin = U.time * (0.03 + 0.10 * U.energy) * dir;
        float3 acc = float3(0.0);
        for (int i = 0; i < 90; i++) {                       // literal-bounded seeds
            float fi = float(i);
            float a2 = fi * GA + spin;
            float rad = sqrt(fi) * 0.098;
            float2 sp = float2(cos(a2), sin(a2)) * rad;
            float2 d = p - sp;
            float rd = 0.014 + 0.020 * build;
            float dv = exp(-dot(d, d) / (rd * rd));
            float fam = float(i % 8) / 8.0;                  // parastichy family
            acc += chordRamp_d(U, fam + U.time * 0.01)
                 * dv * (0.10 + 0.7 * band64_d(spectrum, fi / 89.0));
        }
        col += acc * (0.4 + 0.7 * coreScale) * (0.4 + 0.6 * build);
        col += (hash21_d(pos.xy) - 0.5) * 0.004;
        return float4(govern_d(VOID_D + max(col, float3(0.0)), U.white), 1.0);
    }

    float pat = 0.0;       // 0..1 tile field (dark/light)
    float skel = 0.0;      // the thin skeleton line the illusion hangs on
    float3 tone = U.colA.rgb;
    float3 skelCol = U.colC.rgb;

    if (form == 0) {
        // CORD -> FRASER false spiral. Concentric rings of checker tiles;
        // each ring is sheared by a twisted-cord amount so the grey mortar
        // between rings reads as a continuous spiral. Both the shear and
        // the mortar's grey level (the café-wall's whole trick) ride the
        // build, so the twist tightens with the music.
        float rings = 8.0 + floor(clamp(U.roll2, 0.0, 0.999) * 6.0);   // 8..13
        float spin = U.time * 0.05 * dir;
        float ri = r * rings * 1.7;
        float ringF = fract(ri);
        float ringI = floor(ri);
        float tiles = 20.0;
        float shear = (0.20 + 0.55 * build) * (ringF - 0.5);           // the twisted cord
        float phase = ang * tiles + ringI * 0.5 + (shear + spin) * tiles;
        pat = step(0.5, fract(phase));
        // the grey mortar band at each ring boundary
        float m = smoothstep(0.0, 0.09, ringF) * smoothstep(0.20, 0.09, ringF);
        skel = m;
        tone = mix(U.colA.rgb, U.colB.rgb, pat);
        skelCol = mix(U.colC.rgb, float3(0.5), 0.5);                   // the grey line
    } else {
        // PENTA — the de-Bruijn pentagrid: FIVE plane waves 72° apart.
        // Their summed field's ridges are a quasiperiodic Penrose lattice.
        // The wave count is fixed at five (the count is the physics), but
        // the frequency and ridge sharpness ride the build.
        float freq = 6.0 + 8.0 * build;
        float spin = U.time * 0.02 * dir;
        float sum = 0.0;
        for (int j = 0; j < 5; j++) {                        // literal-bounded: the pentagrid
            float aa = float(j) * (TAU_D / 5.0) + spin;
            float2 kdir = float2(cos(aa), sin(aa));
            sum += cos(dot(p, kdir) * freq + U.time * 0.15);
        }
        sum /= 5.0;                                          // -1..1
        pat = 0.5 + 0.5 * sum;
        skel = smoothstep(0.55, 0.82, pat);                  // the Penrose edges
        tone = mix(U.colA.rgb, U.colC.rgb, pat);
        skelCol = U.colC.rgb;
    }

    float vign = exp(-dot(p, p) * 0.40);
    col += tone * pat * (0.13 + 0.22 * U.mid) * vign * (0.5 + 0.6 * coreScale);
    // the skeleton line — its luminance is the dial the lie turns, so it
    // rides the build, but gently: a swell, never a flash.
    col += skelCol * skel * (0.05 + 0.30 * build) * vign * coreScale;

    col += (hash21_d(pos.xy) - 0.5) * 0.004;
    return float4(govern_d(VOID_D + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// DISPERSION — spectral diffraction, every pixel a spectral integral.
// The intensity of a grating / double-source pattern is summed over
// SIXTEEN wavelengths 400..700 nm, each weighted by the analytic CIE
// 1931 observer (cie_d) -> XYZ -> sRGB, so the colour is REAL PHYSICS:
// the zeroth order is white and the higher orders disperse into a true
// spectrum because each wavelength's fringes sit where lambda puts them.
// Two coherent sources sit at ±sep and WALK RAYLEIGH'S CRITERION on the
// beat — the separation breathes through the resolution limit so they
// merge and split with the music. This room may lean on physics colour
// rather than the chord (like FIREWORKS), but a subtle chord tint and
// the luminance governor still stand. roll0 deals the slit count
// (N=2 is Young's slits), roll1 the grating scale.
// ---------------------------------------------------------------
fragment float4 room_disperse(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_d(centered_d(pos.xy, res, U.aspect), U);

    // two sources walk Rayleigh's criterion on the beat — a breath of
    // GEOMETRY (the separation), not a luminance flash.
    float sep = 0.16 + 0.11 * sin(U.beatPhase * TAU_D) + 0.05 * U.onsetEnv;
    float Nsl = 2.0 + floor(clamp(U.roll0, 0.0, 0.999) * 3.0);   // 2..4 slits
    float gscale = 6.0 + 6.0 * U.roll1;                          // fringe scale

    // a soft vertical slit-height envelope so the field fades top/bottom
    float vEnv = exp(-p.y * p.y * 1.1);

    float3 XYZ = float3(0.0);
    float wsum = 0.0;                                    // observer normalisation (equal-energy white)
    for (int k = 0; k < 16; k++) {                       // literal-bounded: the spectral samples
        float fk = float(k) / 15.0;
        float lam = 400.0 + 300.0 * fk;                  // nm
        float lamu = lam / 550.0;                        // normalised to green

        // incoherent sum of the two sources' diffraction patterns
        float I = 0.0;
        for (int s = 0; s < 2; s++) {                    // literal-bounded: the pair
            float sx = (s == 0) ? -sep : sep;
            float u = (p.x - sx) * gscale / lamu;
            // single-slit envelope (sinc^2)
            float sc = (abs(u) < 1e-4) ? 1.0 : sin(u) / u;
            float env = sc * sc;
            // N-slit grating factor [sin(N beta)/(N sin beta)]^2 (fine structure)
            float beta = u * 4.0;
            float sd = sin(beta);
            float grat = (abs(sd) < 1e-4) ? Nsl : (sin(Nsl * beta) / sd);
            grat = grat * grat / (Nsl * Nsl);
            I += env * grat;
        }
        I *= vEnv;

        float3 obs = cie_d(lam);
        XYZ += obs * I;
        wsum += obs.y;
    }
    XYZ /= max(wsum, 1e-4);

    float3 rgb = max(xyz2rgb_d(XYZ), float3(0.0));
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // exposure rides energy + treble (this is the trebly room), the
    // governor rolls off the bright zeroth-order core into saturation.
    rgb *= (0.32 + 0.55 * U.energy) * (0.7 + 0.5 * U.treble) * (0.5 + 0.7 * coreScale);

    // the subtle chord tint — the spectral colour still leads, the key
    // only leans it.
    float3 chord = chordRamp_d(U, 0.5 + 0.15 * sin(p.x * 3.0 + U.time * 0.10));
    rgb = mix(rgb, rgb * (0.35 + 1.35 * chord), 0.16);

    float3 col = starLayer_d(uv) * mix(float3(0.7), U.colC.rgb, 0.5)
               * (1.0 - clamp(lumaOf_d(rgb) * 2.0, 0.0, 1.0));
    col += rgb;

    col += (hash21_d(pos.xy) - 0.5) * 0.004;
    return float4(govern_d(VOID_D + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// CREATURE — the cosine creature. One axis wave carries a spine; a rib
// field k = cos(ribs·τ·s) sets how far each rib reaches, and the tips
// IGNITE where k² crosses a genome threshold. The GENOME — a handful of
// constants (rib count, reach, threshold, wave amplitude/frequency) —
// is seeded from roll0..2, so every song grows its own animal. An onset
// sends one bright PULSE travelling down the body, bass is the breath,
// treble lights the tips, and each station reads its own spectrum bin so
// the ribs sing. roll1 turns the body page: WYRM (a swimming serpent),
// MEDUSA (a bell trailing swaying tentacles), BLOOM (petals on a rose).
// ---------------------------------------------------------------
fragment float4 room_creature(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_d(centered_d(pos.xy, res, U.aspect), U);

    float3 col = starLayer_d(uv) * mix(float3(0.7), U.colC.rgb, 0.5);

    // ---- the genome: a few constants seeded from the dice (roll0..2) ----
    float gAmp = hash11_d(U.roll0 * 17.0 + 1.3);
    float gFrq = hash11_d(U.roll0 * 5.0 + U.roll2 * 9.0 + 2.7);
    float gRib = hash11_d(U.roll2 * 13.0 + 3.1);
    float gThr = hash11_d(U.roll1 * 7.0 + U.roll2 * 3.0 + 4.9);
    float gRch = hash11_d(U.roll0 * 3.0 + U.roll1 * 11.0 + 5.3);

    float ribs    = 4.0 + floor(gRib * 7.0);        // 4..10 ribs
    float thr     = 0.30 + 0.45 * gThr;             // ignition threshold on k^2
    float axisAmp = 0.10 + 0.35 * gAmp;             // axis-wave amplitude
    float axisFrq = 1.0 + 3.0 * gFrq;               // axis-wave frequency
    float reach   = 0.10 + 0.16 * gRch;             // base rib reach

    int page = (U.roll1 < 0.34) ? 0 : (U.roll1 < 0.67 ? 1 : 2);

    float breath = 1.0 + 0.10 * U.bass * sin(U.time * 1.3);   // bass = breath
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);
    float pulsePos = fract(U.time * 0.6);                     // the pulse runs the body

    float3 body = float3(0.0);
    const int NS = 64;                                        // stations (literal bound)
    for (int i = 0; i < NS; i++) {
        float s = float(i) / float(NS - 1);                  // 0..1 along the body

        // ---- the spine point + rib direction(s) for this page ----
        float2 sp, dir1, dir2;
        float w2, lenScale;
        if (page == 0) {
            // WYRM — a swimming serpent; ribs on both flanks
            float x = mix(-0.85, 0.85, s);
            float phase = axisFrq * TAU_D * s + U.time * 1.1;
            float ampS = axisAmp * (0.4 + 0.6 * s);
            float y = ampS * sin(phase);
            sp = float2(x, y);
            float dx = 1.7;
            float dy = ampS * axisFrq * TAU_D * cos(phase) + axisAmp * 0.6 * sin(phase);
            float2 tang = normalize(float2(dx, dy));
            float2 nrm = float2(-tang.y, tang.x);
            dir1 = nrm; dir2 = -nrm; w2 = 1.0; lenScale = 1.0;
        } else if (page == 1) {
            // MEDUSA — a bell dome with swaying tentacles hanging down
            float a = mix(-1.0, 1.0, s);
            sp = float2(a * 0.5, 0.34 - 0.16 * a * a);
            float2 sway = normalize(float2(sin(U.time * 0.8 + a * 3.14) * 0.5, -1.0));
            dir1 = sway; dir2 = float2(0.0); w2 = 0.0; lenScale = 2.2;
        } else {
            // BLOOM — petals on a rose curve r = |cos(k·θ)|
            float th = s * TAU_D;
            float rr = 0.22 + 0.40 * abs(cos(ribs * 0.5 * th + U.time * 0.10));
            sp = float2(cos(th), sin(th)) * rr;
            dir1 = normalize(sp + float2(1e-4)); dir2 = -dir1; w2 = 0.0; lenScale = 0.8;
        }
        sp *= breath;

        // ---- the rib field: k = cos(ribs·τ·s); tips ignite on k^2 > thr ----
        float k = cos(ribs * TAU_D * s + U.time * 0.2);
        float k2 = k * k;
        float ignite = smoothstep(thr, thr + 0.12, k2);
        float amp = band64_d(spectrum, s);               // this station's own band
        float ribLen = reach * lenScale * (0.3 + 1.2 * k2) * (0.6 + 0.9 * amp);

        // pulse travelling down the body, flared by the onset
        float pd = s - pulsePos;
        float pulse = exp(-pd * pd * 120.0) * U.onsetEnv;

        float3 cbody = chordRamp_d(U, s * 0.5 + U.time * 0.02);

        // the spine node — the axis wave read as a line of light
        float spineG = exp(-dot(p - sp, p - sp) * 900.0);
        body += cbody * spineG * (0.22 + 0.6 * amp);
        body += U.colC.rgb * spineG * pulse * 1.2;

        // rib 1 (always) and rib 2 (wyrm only) — the ribs, then the tips
        float2 tip1 = sp + dir1 * ribLen;
        float g1 = segGlow_d(p, sp, tip1, 1600.0);
        float t1 = exp(-dot(p - tip1, p - tip1) * 1500.0);
        body += cbody * g1 * (0.18 + 0.5 * amp);
        body += U.colC.rgb * t1 * ignite * (0.3 + 1.2 * U.treble + 2.0 * pulse);

        if (w2 > 0.5) {
            float2 tip2 = sp + dir2 * ribLen;
            float g2 = segGlow_d(p, sp, tip2, 1600.0);
            float t2 = exp(-dot(p - tip2, p - tip2) * 1500.0);
            body += cbody * g2 * (0.18 + 0.5 * amp);
            body += U.colC.rgb * t2 * ignite * (0.3 + 1.2 * U.treble + 2.0 * pulse);
        }
    }

    col += body * (0.5 + 0.6 * coreScale);
    col += (hash21_d(pos.xy) - 0.5) * 0.004;
    return float4(govern_d(VOID_D + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// SLINKY — nine stacked chalk-grain rings (≤ 9×64 grains). Perspective
// alone supplies the ellipse illusion: each ring is a flat ellipse, its
// helix phase advancing per ring so the stack reads as one coil whose
// spin direction is honestly ambiguous. The spin rides energy
// (base·(0.35 + energy·0.7)); a beat sends a COMPRESSION WAVE up the
// stack, sin(t·2.2 − ring·7)·onsetEnv, squeezing the ring spacing —
// geometry, not a flash. This is the one room that RESTS the palette:
// it is deliberately near-monochrome, painted in the accent stop
// (colC) alone. roll0 flattens the ellipse, roll1 flips the spin,
// roll2 sets the chalk grain size.
// ---------------------------------------------------------------
fragment float4 room_slinky(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_d(centered_d(pos.xy, res, U.aspect), U);

    float dir = (U.roll1 < 0.5) ? -1.0 : 1.0;
    float spinBase = U.time * (0.35 + 0.7 * U.energy) * dir;      // spin rides energy
    float flatten = 0.85 + 0.30 * U.roll0;                        // ellipse minor axis
    float grainK = 3200.0 - 1400.0 * clamp(U.roll2, 0.0, 1.0);    // chalk grain tightness
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float a = 0.60;                                               // ellipse semi-major (x)
    float grain = 0.0;

    for (int rgi = 0; rgi < 9; rgi++) {                          // nine rings (literal)
        float rf = float(rgi) / 8.0;                             // 0 (far/top) .. 1 (near/bottom)
        // the compression wave squeezes the ring spacing up the stack
        float comp = sin(U.time * 2.2 - float(rgi) * 7.0) * U.onsetEnv * 0.045;
        float yr = mix(0.72, -0.72, rf) + comp;
        float b = (0.085 + 0.03 * rf) / flatten;                // perspective minor axis

        // per-ring helix phase so the stack reads as one coil
        float spin = spinBase + float(rgi) * 0.7;

        // find this pixel's parametric angle on the ring's ellipse, then
        // snap to the nearest of 64 grains (and its two neighbours) — the
        // ellipse still shows 64 discrete chalk grains without a 576-wide loop.
        float2 q = p - float2(0.0, yr);
        float phi = atan2(q.y / max(b, 1e-4), q.x / max(a, 1e-4));
        float gpf = (phi - spin) / TAU_D * 64.0;
        for (int j = -1; j <= 1; j++) {                          // nearest 3 grains (literal)
            float gi = floor(gpf + 0.5) + float(j);
            float gang = (gi / 64.0) * TAU_D + spin;
            float jit = (hash11_d(gi * 1.7 + float(rgi) * 9.0) - 0.5) * 0.03;  // chalk jitter
            float2 gp = float2(cos(gang) * (a + jit), sin(gang) * (b + jit)) + float2(0.0, yr);
            float d = length(p - gp);
            float g = exp(-d * d * grainK);
            g *= 0.7 + 0.3 * hash11_d(gi * 5.3 + float(rgi) * 2.1);            // chalk stipple
            grain += g * (0.55 + 0.45 * rf);                                  // near rings read brighter
        }
    }

    // near-monochrome: the accent stop alone rests the palette
    float3 col = starLayer_d(uv) * mix(float3(0.7), U.colC.rgb, 0.5);
    col += U.colC.rgb * grain * (0.30 + 0.35 * U.mid) * (0.5 + 0.6 * coreScale);
    col += U.colC.rgb * grain * grain * 0.14;                    // a soft accent haze around the coil

    col += (hash21_d(pos.xy) - 0.5) * 0.004;
    return float4(govern_d(VOID_D + max(col, float3(0.0)), U.white), 1.0);
}
