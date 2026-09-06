#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 3 (C) — EIGENSTATE, AUREA, FILIGREE, ROSETTE.
   Single-triangle fragment shaders, one per room, nothing else.

   The same laws that rule Shaders.metal / Shaders2.metal /
   Shaders3.metal rule here:
   - The ground is the void (#05060e). A room ADDS light onto it; it
     never paints a theme over it. A faint static starfield lies
     under every room so the void reads as a sky, not a hole.
   - Colours come ONLY from the track's chord (colA/colB/colC). No
     hardcoded rainbows — a rainbow must be earned upstream. Even
     EIGENSTATE's phase hue and ROSETTE's three "chromatic" channels
     ride the chord stops, never a raw RGB wheel.
   - phi(x) = 2·atan(x) is the engine's signature fold; the rooms in
     this file lean on analytic form instead, but the law is the same:
     unbounded runs brought home to a finite frame.
   - WCAG 2.3.1 is a law: govern_c() caps luminance at every exit so
     additive enthusiasm becomes saturation, never a white strobe.
     The cap is the INK budget: white in 0.05..0.92 sets how bright a
     core may burn, so a drop may bloom where a verse will not. The
     beat is answered as a breath of geometry, never a luminance flash.
   - r32Float is not filterable on the living-room GPUs, so spectrum
     and waveform are read by INTEGER TEXEL and lerped by hand.
   - ghostStrength is the phantom hand: before shaping, each room lets
     its coordinate drift toward (ghostX, ghostY).
   - roll0..2 are the room's dice, re-dealt on entry — a room never
     shows the same face twice. Each room spends its dice on
     form / direction / proportion so re-entry is a new variation.
   - Every accumulation loop is bounded by a compile-time literal
     (<= 96 iterations) — no data-dependent trip counts.

   This is a SELF-CONTAINED translation unit. Every helper wears a _c
   suffix so its symbol never collides with the identically shaped
   helpers in Shaders.metal / Shaders2.metal / Shaders3.metal (a
   helper cannot cross a Metal translation unit).
   ================================================================ */

constant float PI_C  = 3.14159265359;
constant float TAU_C = 6.28318530718;

// the void ground — #05060e in the linear-ish working space
constant float3 VOID_C = float3(0.019608, 0.023529, 0.054902);

// ---------------------------------------------------------------
// THE FINAL VizUniforms — verbatim, byte-for-byte identical across
// Shaders.metal, Shaders2/3/4.metal, Xforms.metal and the mirror
// Swift struct. The first 96 bytes are wave 1 unchanged; _pad0 is
// renamed xformMode (same slot); twelve floats are appended after
// colC, padded to a clean 144-byte, 16-byte-aligned stride. Wave 3
// gives _pad1/_pad2 meaning (lens/lensAmt) in the files that READ
// them; the rooms never read the lens, so the last three floats keep
// the neutral pad names here — what matters is three floats there.
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
// helpers (all _c — this file's private ladder)
// ---------------------------------------------------------------

inline float lumaOf_c(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// The flash governor, doubling as the INK budget. white in 0.05..0.92
// maps to a luminance cap in ~0.15..0.85 — overdrive turns to colour,
// and the ceiling itself rises and falls with the story's openness.
inline float3 govern_c(float3 c, float white) {
    float L = lumaOf_c(c);
    float cap = 0.13 + 0.80 * clamp(white, 0.0, 1.0);
    return (L > cap) ? c * (cap / max(L, 1e-4)) : c;
}

// sin-dot hashes: 1->1 and 2->1
inline float hash11_c(float x) {
    return fract(sin(x * 12.9898) * 43758.5453123);
}
inline float hash21_c(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands.
// Manual lerp — the filterability law forbids a linear sampler here.
inline float band64_c(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel position -> centered, aspect-true coordinates (y in -1..1)
inline float2 centered_c(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    return p;
}

// the starfield underlay — two octaves of tiny static hashed points,
// brightness ~0.10-0.25, returned as a scalar and tinted by the caller
// so even the sky obeys the colour law.
inline float starLayer_c(float2 uv) {
    float s = 0.0;
    float2 g = uv * 94.0;
    float2 c = floor(g);
    float2 f = fract(g) - 0.5;
    s += smoothstep(0.994, 1.0, hash21_c(c)) * exp(-dot(f, f) * 45.0) * 0.16;
    g = uv * 171.0 + 27.3;
    c = floor(g);
    f = fract(g) - 0.5;
    s += smoothstep(0.997, 1.0, hash21_c(c + 5.9)) * exp(-dot(f, f) * 60.0) * 0.10;
    return s;
}

// the phantom hand — before shaping, a coordinate drifts toward the
// ghost point inside a soft attraction well, scaled by ghostStrength.
inline float2 ghostWarp_c(float2 p, constant VizUniforms& U) {
    float2 g = float2(U.ghostX, U.ghostY);
    float2 d = g - p;
    float pull = U.ghostStrength * 0.33 * exp(-dot(d, d) * 0.8);
    return p + d * pull;
}

// the chord read as a cyclic three-stop ramp (A->B->C->A), the only
// colour source these rooms are allowed. t is wrapped to 0..1.
inline float3 chordRamp_c(constant VizUniforms& U, float t) {
    t = fract(t);
    float seg = t * 3.0;
    if (seg < 1.0)      return mix(U.colA.rgb, U.colB.rgb, seg);
    else if (seg < 2.0) return mix(U.colB.rgb, U.colC.rgb, seg - 1.0);
    else                return mix(U.colC.rgb, U.colA.rgb, seg - 2.0);
}

// physicist's Hermite polynomials H_n, n = 0..4 (the axis quantum
// number is capped at 4 by contract).
inline float hermite_c(int n, float x) {
    float x2 = x * x;
    switch (n) {
        case 0:  return 1.0;
        case 1:  return 2.0 * x;
        case 2:  return 4.0 * x2 - 2.0;
        case 3:  return (8.0 * x2 - 12.0) * x;              // 8x^3 - 12x
        case 4:  return 16.0 * x2 * x2 - 48.0 * x2 + 12.0;  // 16x^4 - 48x^2 + 12
        default: return 1.0;
    }
}

// the 1-D harmonic-oscillator normalisation N_n = 1/sqrt(2^n n! sqrt(pi))
// so every eigenmode carries unit weight before the occupations tilt it.
inline float hoNorm_c(int n) {
    switch (n) {
        case 0:  return 0.751126;
        case 1:  return 0.531125;
        case 2:  return 0.265563;
        case 3:  return 0.108415;
        case 4:  return 0.038331;
        default: return 0.751126;
    }
}

// ---------------------------------------------------------------
// the one triangle is declared in Shaders.metal (fullscreen_vertex);
// these rooms reuse that vertex stage — no vertex function here.
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// EIGENSTATE — the web's default opener, quantum. The frame is the
// exact unitary evolution of a superposition of ANALYTIC 2-D
// harmonic-oscillator eigenmodes psi_{nx,ny} = N·H_nx(x)·H_ny(y)·
// exp(-(x^2+y^2)/2), each carried forward by its own phase
// exp(-i·E_n·t) with E_n = nx+ny+1. Twelve terms (nx,ny <= 3 here,
// <= 4 by contract). Brightness is |Psi|^2; hue is the local PHASE
// arg(Psi) laid onto the chord ramp. The music only chooses the
// superposition: a Boltzmann-ish occupation tilt whose temperature
// rises with energy/treble lights the higher rungs, an onset KICKS a
// chosen level and scrambles its phase (a quantum jump), and an
// energy-ladder readout up the left edge is lit by the occupations.
// ---------------------------------------------------------------
fragment float4 room_eigen(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_c(centered_c(pos.xy, res, U.aspect), U);

    // the mode ladder: twelve lowest (nx,ny) pairs, ordered by energy
    const int NX[12] = { 0, 1, 0, 1, 2, 0, 2, 1, 3, 0, 2, 3 };
    const int NY[12] = { 0, 0, 1, 1, 0, 2, 1, 2, 0, 3, 2, 1 };

    // spatial scale — a few nodes across the visible frame
    float s = 2.7;
    float x = p.x * s;
    float y = p.y * s;
    float gx = exp(-0.5 * x * x);
    float gy = exp(-0.5 * y * y);

    // precompute the five per-axis eigenfunctions (norm × Hermite × gaussian)
    float px[5];
    float py[5];
    for (int k = 0; k < 5; k++) {
        px[k] = hoNorm_c(k) * hermite_c(k, x) * gx;
        py[k] = hoNorm_c(k) * hermite_c(k, y) * gy;
    }

    // --- occupations: a Boltzmann-ish tilt the music warms ---
    // hot music (high energy/treble) lowers beta -> flatter -> higher
    // rungs light; treble tilts the high levels further; an onset kicks
    // one rolled level.
    float beta = max(0.5, 5.0 - 3.6 * U.energy - 1.4 * U.treble);
    int kicked = int(floor(clamp(U.roll2, 0.0, 0.999) * 12.0));
    float w[12];
    float sumW = 0.0;
    for (int i = 0; i < 12; i++) {
        float E0 = float(NX[i] + NY[i]);                 // E_n - 1 (ground = 0)
        float wi = exp(-beta * E0);
        wi *= (1.0 + 0.5 * U.treble * E0);               // treble lifts high levels
        if (i == kicked) wi *= (1.0 + 2.2 * U.onsetEnv); // the quantum jump
        w[i] = wi;
        sumW += wi;
    }

    // --- exact unitary evolution: Psi = sum a_n psi_n exp(-i theta_n) ---
    float tu = 0.85;                                      // global time unit
    float re = 0.0, im = 0.0;
    for (int i = 0; i < 12; i++) {
        float a = sqrt(w[i] / max(sumW, 1e-5));
        float psi = px[NX[i]] * py[NY[i]];
        float E = float(NX[i] + NY[i] + 1);
        float ph0 = TAU_C * hash11_c(float(i) * 1.7 + U.roll0 * 9.0);      // dealt phase
        float scr = U.onsetEnv * TAU_C * hash11_c(float(i) * 3.1 + U.roll1 * 5.0); // scramble
        float theta = E * U.time * tu + ph0 + scr;
        re += a * psi * cos(theta);
        im += a * psi * sin(theta);
    }

    float dens = re * re + im * im;                       // |Psi|^2
    float phase = atan2(im, re);                          // the phase hue
    float vign = exp(-dot(p, p) * 0.22);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float bright = dens * 1.9 * vign;
    float3 col = chordRamp_c(U, phase / TAU_C + 0.5 + U.time * 0.015)
               * bright * (0.45 + 0.9 * coreScale);

    // --- the energy-ladder readout up the left edge ---
    // twelve stacked rungs; each glows with its level's occupation and
    // wears that level's stop on the chord ramp.
    {
        float x0 = 0.028, x1 = 0.098;
        float inBox = step(x0, uv.x) * step(uv.x, x1);
        float rung = uv.y * 12.0;
        int j = clamp(int(floor(rung)), 0, 11);
        float rf = fract(rung);
        float band = smoothstep(0.16, 0.30, rf) * smoothstep(0.84, 0.70, rf);
        float occ = w[j] / max(sumW, 1e-4);
        col += chordRamp_c(U, float(j) * 0.11 + 0.08)
             * inBox * band * clamp(occ * 4.0, 0.0, 1.0) * 0.55 * (0.5 + 0.6 * coreScale);
    }

    // the void sky shows through where the wavefunction is dark
    col += starLayer_c(uv) * mix(float3(0.7), U.colC.rgb, 0.5) * (1.0 - clamp(bright, 0.0, 1.0));

    col += (hash21_c(pos.xy) - 0.5) * 0.004;              // grain vs banding
    return float4(govern_c(VOID_C + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// AUREA — golden-angle phyllotaxis. Ninety seeds placed purely as a
// function of index i: angle = i·2.399963 (the golden angle), radius
// = sqrt(i)·k. roll0 deals the form — a sunflower DISC, a VORTEX
// (angle twisted by radius), or a Fibonacci TORUS KNOT walking the
// pairs (2,3)->(3,5)->(5,8) on the phrase clock. Colour is the
// parastichy family (i mod a Fibonacci of {5,8,13}, dealt by roll2)
// drawn from the chord; each seed reads its own spectrum band so the
// spiral sings; a slow morph rides the phrase. Seeds are soft
// additive dots. roll1 flips the spin direction.
// ---------------------------------------------------------------
fragment float4 room_aurea(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_c(centered_c(pos.xy, res, U.aspect), U);

    float3 col = starLayer_c(uv) * mix(float3(0.7), U.colC.rgb, 0.5);

    const float GA = 2.39996323;                          // the golden angle (rad)
    float dir = (U.roll1 < 0.5) ? -1.0 : 1.0;
    float spin = U.time * (0.05 + 0.15 * U.energy) * dir;

    // the dealt form and its parastichy Fibonacci
    int form = (U.roll0 < 0.34) ? 0 : (U.roll0 < 0.67 ? 1 : 2);
    int fibSel = int(floor(clamp(U.roll2, 0.0, 0.999) * 3.0));
    int fib = (fibSel == 0) ? 5 : (fibSel == 1 ? 8 : 13);

    // the knot pair walks on the phrase clock: (2,3)->(3,5)->(5,8)
    float2 pairs[3] = { float2(2.0, 3.0), float2(3.0, 5.0), float2(5.0, 8.0) };
    float seg = fract(U.phrasePhase) * 3.0;
    int pi = int(floor(seg)) % 3;
    float fr = smoothstep(0.8, 1.0, fract(seg));
    float2 pqA = pairs[pi];
    float2 pqB = pairs[(pi + 1) % 3];
    float pk = mix(pqA.x, pqB.x, fr);
    float qk = mix(pqA.y, pqB.y, fr);

    // a gentle breathing morph on the phrase (disc/vortex)
    float breathe = 1.0 + 0.05 * sin(fract(U.phrasePhase) * TAU_C);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    for (int i = 0; i < 90; i++) {                        // literal-bounded seeds
        float fi = float(i);
        float a = fi * GA + spin;
        float rad = sqrt(fi) * 0.099 * breathe;           // sqrt(89)·0.099 ~ 0.93

        float2 sp;
        if (form == 0) {
            // SUNFLOWER DISC
            sp = float2(cos(a), sin(a)) * rad;
        } else if (form == 1) {
            // VORTEX — the arm twists more the further out it sits
            float a2 = a + rad * 4.0;
            sp = float2(cos(a2), sin(a2)) * rad;
        } else {
            // FIBONACCI TORUS KNOT, walking (p,q) on the phrase
            float tparam = fi / 90.0 * TAU_C;
            float R0 = 0.55;
            float tube = 0.30;
            float rr = R0 + tube * cos(qk * tparam + spin);
            sp = float2(rr * cos(pk * tparam), rr * sin(pk * tparam)) * 0.9;
        }

        // colour by parastichy family; brightness reads the spectrum
        float fam = float(i % fib) / float(fib);
        float3 dotCol = chordRamp_c(U, fam + U.time * 0.01);
        float amp = band64_c(spectrum, fi / 89.0);

        float2 d = p - sp;
        float rd = 0.020 + 0.024 * amp;                   // soft dot radius
        float dotv = exp(-dot(d, d) / (rd * rd));
        col += dotCol * dotv * (0.12 + 0.8 * amp + 0.4 * U.onsetEnv) * (0.4 + 0.7 * coreScale);
    }

    col += (hash21_c(pos.xy) - 0.5) * 0.004;
    return float4(govern_c(VOID_C + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// FILIGREE — flat escape-time Mandelbrot/Julia (80 iterations) with
// two pro techniques: a smooth iteration count nu = n + 1 -
// log2(log2|z|) for band-free exterior colour, and an ORBIT TRAP
// (a walking point + the real axis as a line) that paints the gold
// lace from the chord. roll0 deals the set: MANDELBROT slowly DIVES
// (a zoom on the phrase clock, into the seahorse valley) or JULIA
// WALKS c around the main cardioid (roll1 offsets the walk). The trap
// radius OPENS and closes on the beat — the lace breathes with the
// onset.
// ---------------------------------------------------------------
fragment float4 room_mandel(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = ghostWarp_c(centered_c(pos.xy, res, U.aspect), U);

    bool julia = (U.roll0 >= 0.5);
    float2 z, c;

    if (!julia) {
        // MANDELBROT — dive on the phrase clock into the seahorse valley
        float dive = pow(0.03, clamp(U.phrasePhase, 0.0, 1.0));   // up to ~33x
        float scale = 1.5 * dive;
        float2 center = float2(-0.745, 0.113);
        c = center + p * scale;
        z = float2(0.0);
    } else {
        // JULIA — c walks the main cardioid, nudged just inside it so
        // the set stays connected; roll1 offsets where the walk begins.
        float th = U.time * 0.05 + U.roll1 * TAU_C;
        float2 e1 = float2(cos(th), sin(th));
        float2 e2 = float2(cos(2.0 * th), sin(2.0 * th));
        c = (0.5 * e1 - 0.25 * e2) * 0.985;
        z = p * 1.5;
    }

    // the walking point trap, and the real axis as a line trap
    float2 trapC = float2(0.32 * cos(U.time * 0.08), 0.32 * sin(U.time * 0.08));
    float traceP = 1e9, traceL = 1e9;
    bool escaped = false;
    int escN = 80;
    float m2 = 0.0;
    for (int i = 0; i < 80; i++) {                        // literal-bounded iterations
        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        m2 = dot(z, z);
        traceP = min(traceP, length(z - trapC));
        traceL = min(traceL, abs(z.y));
        if (m2 > 16.0) { escaped = true; escN = i; break; }
    }

    // smooth iteration count (only meaningful once the orbit escaped)
    float sn = float(escN);
    if (escaped) {
        float log_zn = 0.5 * log(max(m2, 1e-6));
        float nu = log(max(log_zn / log(2.0), 1e-6)) / log(2.0);
        sn = float(escN) + 1.0 - nu;
    }

    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // the lace: point + line traps, the radius breathing on the beat
    float wp = 0.06 + 0.10 * U.onsetEnv;
    float wl = 0.05 + 0.08 * U.onsetEnv;
    float laceP = exp(-traceP * traceP / (wp * wp));
    float laceL = exp(-traceL * traceL / (wl * wl));

    float3 gold = mix(U.colB.rgb, U.colC.rgb, clamp(traceP * 2.0, 0.0, 1.0));
    float3 col = gold * laceP * (0.5 + 0.9 * coreScale);
    col += U.colA.rgb * laceL * 0.5 * (0.4 + 0.8 * coreScale);

    // faint exterior banding on the smooth count — the outer sky, kept dark
    if (escaped) {
        float band = 0.5 + 0.5 * cos(sn * 0.5 + U.time * 0.1);
        col += chordRamp_c(U, sn * 0.03 + U.time * 0.02)
             * band * 0.09 * smoothstep(0.0, 6.0, sn);
    }

    col *= (0.65 + 0.5 * U.energy);

    // the void sky shows through where the lace is faint
    col += starLayer_c(uv) * mix(float3(0.7), U.colC.rgb, 0.5)
         * (1.0 - clamp(laceP + laceL, 0.0, 1.0));

    col += (hash21_c(pos.xy) - 0.5) * 0.004;
    return float4(govern_c(VOID_C + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// ROSETTE — a spirograph of nested rings. Up to fourteen concentric
// rosette rings (a wavy radius R_k(theta) = R0_k + amp·cos(pet·theta
// + phase)), each reading its own spectrum bin so a singing band
// swells its ring. Each ring is drawn in THREE chromatic channels
// mapped to the three chord stops, evaluated at theta+delta / theta /
// theta-delta; the angular offset delta grows with bass + beat, so a
// quiet passage converges the three onto one (the stops sum toward
// near-white) and a hit blooms the coloured fringe. A slow spin turns
// the whole figure and a gentle vertical squash tumbles it in 3-D.
// roll0 deals the ring count, roll1 the spin direction, roll2 the
// tumble rate.
// ---------------------------------------------------------------
fragment float4 room_rosette(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p0 = ghostWarp_c(centered_c(pos.xy, res, U.aspect), U);

    // slow spin (direction dealt by roll1) + a gentle 3-D tumble (roll2)
    float dir = (U.roll1 < 0.5) ? -1.0 : 1.0;
    float spin = U.time * (0.12 + 0.5 * U.energy) * dir;
    float cs = cos(spin), sn = sin(spin);
    float2 p = float2(p0.x * cs - p0.y * sn, p0.x * sn + p0.y * cs);
    float tilt = 0.55 + 0.35 * sin(U.time * (0.08 + 0.10 * U.roll2));
    p.y /= max(0.30, tilt);                               // squash -> ellipse illusion

    float r = length(p);
    float th = atan2(p.y, p.x);

    // the channel angular offset — quiet converges, a hit blooms
    float delta = 0.012 + U.bass * 0.10 + U.onsetEnv * 0.13;

    int NR = 8 + int(floor(clamp(U.roll0, 0.0, 0.999) * 7.0));   // 8..14 rings
    float ch0 = 0.0, ch1 = 0.0, ch2 = 0.0;
    for (int k = 0; k < 14; k++) {                        // literal-bounded rings
        if (k >= NR) break;
        float fk = float(k);
        float bin = band64_c(spectrum, fk / 13.0);        // the ring's own band
        float R0 = 0.10 + fk * 0.055;
        float pet = 2.0 + float(k % 6);                   // petal count varies by ring
        float amp = 0.018 + bin * 0.06;                   // a singing band swells the ring
        float phase = fk * 0.7 + U.time * (0.2 + 0.1 * bin);
        float wline = 0.008 + 0.004 * bin;
        float iw = 1.0 / (wline * wline);

        float rr0 = R0 + amp * cos(pet * (th + delta) + phase);
        float rr1 = R0 + amp * cos(pet * (th)         + phase);
        float rr2 = R0 + amp * cos(pet * (th - delta) + phase);
        ch0 += exp(-(r - rr0) * (r - rr0) * iw);
        ch1 += exp(-(r - rr1) * (r - rr1) * iw);
        ch2 += exp(-(r - rr2) * (r - rr2) * iw);
    }

    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);
    // the three channels ride the three chord stops (never a raw RGB wheel)
    float3 col = U.colA.rgb * ch0 + U.colB.rgb * ch1 + U.colC.rgb * ch2;
    col *= (0.30 + 0.45 * U.mid) * (0.5 + 0.7 * coreScale);

    // a faint bass ground swell so the nest has a centre
    col += U.colB.rgb * exp(-r * r * 22.0) * (0.10 + 0.28 * U.bass);

    col += starLayer_c(uv) * mix(float3(0.7), U.colC.rgb, 0.5);
    col += (hash21_c(pos.xy) - 0.5) * 0.004;
    return float4(govern_c(VOID_C + max(col, float3(0.0)), U.white), 1.0);
}
