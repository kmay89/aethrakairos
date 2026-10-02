#include <metal_stdlib>
using namespace metal;

/* ================================================================
   THE LENS — the artistic post-lens, one pass over the whole scene.
   Wave 3 splices this between the XFORM composite and the GRADE. The
   renderer runs it ONLY when U.lens >= 0 (autoLens picks a lens by act
   and energy and holds it ~9 s so it never flickers); when the lens is
   off the pass is skipped and the GRADE reads the composite directly —
   the exact proven wave-2 picture. So a bug in this file degrades to
   clean glass, never a black screen.

   Laws in force here:
   - Colour is only ever BENT, never invented. Every lens resamples the
     scene the room already drew (a fold, a ripple, a channel split, a
     mirror-tile) or DARKENS it (the iris aperture, the moire bands). No
     lens adds light the room did not make. The second wave (codes 8–17,
     generated from one source with the web's LENS2 fragments) adds one
     more verb: RE-VOICE. Where those lenses colour the light they hold its
     OKLab lightness exactly and only lend it the chord's hue and chroma
     (colA/B/C, the same three stops the web reads off its ramp), so the
     key colours the room without brightening a single pixel. ECHO is the
     one lens with a memory: texture(1) is its own last frame, combined by
     max() so the feedback can never climb past what the room has lit.
   - Luminance is governed at the exit (govern_L), the same law the rooms
     obey: no frame may strobe toward white. Geometric lenses cannot
     brighten a pixel past the scene's own peak (they only move existing
     samples); the two shading lenses only darken; govern_L is the belt
     over the braces. The GRADE still rolls off overdrive afterwards.
   - The effect scales by U.lensAmt (0..1). At amt → 0 every lens
     collapses to the identity sample, so the renderer's engage/disengage
     ramp dissolves in and out with no pop.
   - The scene arrives as a FILTERABLE rgba16Float texture (the composite
     target), so a normalized linear sampler is legal here — unlike the
     r32Float strips the rooms read by hand.

   Helper names carry the _L suffix so this translation unit never
   collides with Shaders.metal / Xforms.metal at metallib link. The
   VizUniforms block is re-declared VERBATIM (144-byte layout, fixed);
   this unit reads U.lens (offset 132) and U.lensAmt (offset 136).
   ================================================================ */

constant float TAU_L = 6.28318530718;

// ---- THE FINAL VizUniforms — VERBATIM, 144-byte fixed layout.
// Wave 3 names offset 132 `lens` and offset 136 `lensAmt`; offset 140
// carries the song's Camelot number for the CIPHER. Only names differ from the sibling units — the bytes
// the CPU uploads are identical, and this unit is the one that reads the
// two lens fields at their fixed offsets.
struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float lens; float lensAmt; float _pad3;            // 128..140  -> stride 144
};

// ---------------------------------------------------------------
// helpers (this translation unit owns its own — a Metal helper cannot
// cross a translation unit, so none of these is shared by name)
// ---------------------------------------------------------------

inline float lumaOf_L(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// The flash governor, same law the rooms exit through: luminance capped
// at a headroom widened by the INK white budget. A quiet verse (white
// near the floor) caps under 1.0; a drop (white near the ceiling) is
// allowed to overdrive, and the GRADE rolls that off into saturation.
inline float3 govern_L(float3 c, float white) {
    /* INK, the web's law: the MAX CHANNEL rolls off on a soft knee and the
       whole triple is rescaled by that one factor, so hue and saturation
       survive any drive level. Light alone can no longer reach white —
       white must be SPENT, and `white` is the budget it is spent from
       (an 18x core at the floor, 2.2x at an earned apex). */
    float m = max(c.x, max(c.y, c.z));
    const float K = 0.68;
    if (m <= K) return c;
    float m2 = 1.0 - (1.0 - K) * (1.0 - K) / (m - 2.0 * K + 1.0);
    float3 o = c * (m2 / m);
    float w = clamp(white, 0.0, 1.0);
    if (w <= 0.0) return o;
    float wp = 18.0 + (2.2 - 18.0) * w;
    float t = clamp((m - 1.0) / max(wp - 1.0, 1e-4), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t) * w;
    return mix(o, float3(m2), t);
}

// @lens2-lib-start

#define vec2 float2
#define vec3 float3
#define vec4 float4
#define mod(a, b) ((a) - (b) * floor((a) / (b)))
/* THE SECOND LENS WAVE's words, generated from one source with the web's
   LENS2 fragments (scratchpad forge, lens2.mjs). They live in namespace lx so
   nothing here can collide with a room's helpers at metallib link. */
namespace lx {
float cbrtL(float x){ return sign(x) * exp2(log2(max(abs(x), 1e-12)) / 3.0); }
/* OKLab, Ottosson's matrices: the space the colour engine already thinks in */
vec3 toLab(vec3 c){
  float l = cbrtL(0.4122214708 * c.x + 0.5363325363 * c.y + 0.0514459929 * c.z);
  float m = cbrtL(0.2119034982 * c.x + 0.6806995451 * c.y + 0.1073969566 * c.z);
  float s = cbrtL(0.0883024619 * c.x + 0.2817188376 * c.y + 0.6299787005 * c.z);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 fromLab(vec3 q){
  float l = q.x + 0.3963377774 * q.y + 0.2158037573 * q.z;
  float m = q.x - 0.1055613458 * q.y - 0.0638541728 * q.z;
  float s = q.x - 0.0894841775 * q.y - 1.2914855480 * q.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
/* RE-VOICE: the room keeps its light, the key lends its colour. OKLab L is
   held exactly; only hue and chroma swing toward the chord colour, and the
   chroma it lends scales with how lit the pixel already is — so the void stays
   void and no lens ever makes light the room did not. */
vec3 revoice(vec3 c, vec3 target, float w){
  vec3 a = toLab(max(c, vec3(0.0)));
  vec3 t = toLab(max(target, vec3(0.0)));
  float tc = length(t.yz);
  vec2 dir = tc > 1e-5 ? t.yz / tc : vec2(0.0);
  float cc = max(length(a.yz), tc * clamp(a.x / max(t.x, 0.05), 0.0, 1.2));
  vec2 ab = mix(a.yz, dir * cc, w);
  return max(fromLab(vec3(a.x, ab)), vec3(0.0));
}
/* turn the light's hue about the OKLab axis, lightness untouched */
vec3 hueTurn(vec3 c, float ang){
  vec3 a = toLab(max(c, vec3(0.0)));
  float cs = cos(ang), sn = sin(ang);
  return max(fromLab(vec3(a.x, cs * a.y - sn * a.z, sn * a.y + cs * a.z)), vec3(0.0));
}
float lumaL(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hashL(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 rotL(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec2 cmulL(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdivL(vec2 a, vec2 b){ float d = max(dot(b, b), 1e-12); return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
float atan2L(float y, float x){ return atan2(y, (abs(x) + abs(y) < 1e-12) ? 1e-12 : x); }
/* the observer GLSL_CIE builds on the web, generated from the same CIE_LOBES
   and XYZ_TO_SRGB, so the grating's rainbow is the same rainbow on both stages */
float cieGauss(float l, float mu, float s1, float s2){ float t = (l - mu) * (l < mu ? 1.0 / s1 : 1.0 / s2); return exp(-0.5 * t * t); }
vec3 wavelengthLinearRGB(float l){
  vec3 c = vec3(1.0560 * cieGauss(l, 599.8, 37.9, 31.0) + 0.3620 * cieGauss(l, 442.0, 16.0, 26.7) + -0.0650 * cieGauss(l, 501.1, 20.4, 26.2),
                0.8210 * cieGauss(l, 568.8, 46.9, 40.5) + 0.2860 * cieGauss(l, 530.9, 16.3, 31.1),
                1.2170 * cieGauss(l, 437.0, 11.8, 36.0) + 0.6810 * cieGauss(l, 459.0, 26.0, 13.8));
  return max(vec3(3.2406 * c.x + -1.5372 * c.y + -0.4986 * c.z, -0.9689 * c.x + 1.8758 * c.y + 0.0415 * c.z, 0.0557 * c.x + -0.2040 * c.y + 1.0570 * c.z), vec3(0.0));
}
/* the chord, exactly as the rooms' chordRamp walks it: A at 0, B at 1/3, C at 2/3 */
inline float3 rampL(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
}  // namespace lx
// @lens2-lib-end

// ---------------------------------------------------------------
// the one triangle's fragment — the lens
// ---------------------------------------------------------------
fragment float4 lens_pass(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float> scene [[texture(0)]],
                          texture2d<float> prev [[texture(1)]])     // ECHO's own last frame (else the scene again)
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);

    float2 r = max(res, float2(1.0));
    float2 uv = pos.xy / r;
    float aspect = max(U.aspect, 1e-4);

    float amt = clamp(U.lensAmt, 0.0, 1.0);
    int mode = int(round(clamp(U.lens, -1.0, 17.0)));

    // clean glass — the renderer bypasses this pass when lens < 0, but a
    // stray call (or amt of zero) passes the scene straight through.
    if (mode < 0 || amt <= 0.0) {
        return float4(scene.sample(smp, uv).rgb, 1.0);
    }

    float t      = U.time;
    float energy = clamp(U.energy, 0.0, 2.0);
    float onset  = clamp(U.onsetEnv, 0.0, 1.0);

    float3 col;
    float2 uvT = uv;                                     // the second wave's lenses read the scene through this

    switch (mode) {

    // ---- 0 MIRRORS — kaleidoscopic fold into k sectors, slow turn ----
    case 0: {
        float2 p = uv - 0.5;
        p.x *= aspect;
        float rad = length(p);
        float ang = atan2(p.y, p.x) + t * 0.12;          // the slow turn
        float k = U.roll2 < 0.5 ? 6.0 : 8.0;             // the dice deal the fold
        float sector = TAU_L / k;
        float a = ang - sector * floor(ang / sector);    // wrap into one sector
        a = fabs(a - sector * 0.5);                       // mirror within it
        float2 fp = float2(cos(a), sin(a)) * rad;
        fp.x /= aspect;
        float2 foldUV = fp + 0.5;
        float2 luv = mix(uv, foldUV, amt);               // amt → 0 is identity
        col = scene.sample(smp, luv).rgb;
        break;
    }

    // ---- 1 WAVE — concentric ripples, amp damped by radius ----
    case 1: {
        float2 c = uv - 0.5;
        float2 pc = c; pc.x *= aspect;                   // aspect-true radius
        float rad = length(pc);
        float amp = (0.006 + 0.014 * energy + 0.010 * onset) * amt;
        float wv = sin(rad * 38.0 - t * 3.0);
        float disp = amp * wv / (1.0 + rad * 4.0);       // damped by radius
        float2 dir = pc / (rad + 1e-4);
        float2 off = dir * disp;
        off.x /= aspect;
        col = scene.sample(smp, uv + off).rgb;
        break;
    }

    // ---- 2 PRISM — radial RGB channel split ----
    case 2: {
        float2 c = uv - 0.5;
        float2 pc = c; pc.x *= aspect;
        float rad = length(pc) + 1e-4;
        float2 dir = pc / rad;
        float sep = (0.004 + 0.014 * energy) * amt;
        float2 off = dir * sep;
        off.x /= aspect;
        float rC = scene.sample(smp, uv + off).r;
        float gC = scene.sample(smp, uv).g;
        float bC = scene.sample(smp, uv - off).b;
        col = float3(rC, gC, bC);                         // channels bent, not invented
        break;
    }

    // ---- 3 IRIS — a soft vignette aperture, breathing ----
    case 3: {
        float2 pc = uv - 0.5; pc.x *= aspect;
        float rad = length(pc);
        float aperture = 0.40 + 0.05 * sin(1.4 * t) + 0.30 * energy;
        float v = 1.0 - smoothstep(aperture, aperture + 0.35, rad);  // 1 in, 0 out
        col = scene.sample(smp, uv).rgb * mix(1.0, mix(0.10, 1.0, v), amt);  // darken, never to black
        break;
    }

    // ---- 4 TILE — a 3x3 mirror-fold grid, tiles breathing ----
    case 4: {
        float breathe = 1.0 + 0.05 * sin(t * 0.8);
        float2 g = uv * 3.0;
        float2 cellLocal = fract(g);
        float2 folded = fabs(cellLocal * 2.0 - 1.0);                 // mirror each tile
        folded = clamp((folded - 0.5) * breathe + 0.5, 0.0, 1.0);   // tiles breathe
        float2 luv = mix(uv, folded, amt);
        col = scene.sample(smp, luv).rgb;
        break;
    }

    // ---- 5 MOIRE — two rotated gratings interfering (darkening bands) ----
    case 5: {
        float2 pc = uv - 0.5; pc.x *= aspect;
        float f = 46.0 + 8.0 * energy;
        // both gratings turn together and the second leads by a hair — the
        // web's crawl, verbatim: a tiny angle delta is a huge moire drift
        float a1 = t * 0.06;
        float a2 = a1 + 0.05 + 0.05 * energy;
        float g1 = sin(dot(pc, float2(cos(a1), sin(a1))) * f);
        float g2 = sin(dot(pc, float2(cos(a2), sin(a2))) * (f + 4.0));
        float grat = 0.5 + 0.5 * g1 * g2;                            // interference 0..1
        float shade = mix(1.0, 0.55 + 0.45 * grat, amt);            // darken only (<= 1)
        col = scene.sample(smp, uv).rgb * shade;
        break;
    }

    // @lens2-cases-start

    // ---- 8 TRANSPOSE — the key walks the circle of fifths through the light ----
    case 8: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 p = (uv - 0.5) * vec2(asp, 1.0);
          float r = length(p);
          // one Camelot step — a perfect fifth, 25 degrees of hue — every six seconds,
          // gliding in over the first second; the new key arrives from the centre out
          float tt = T - r * 2.4;
          float k = mod(floor(tt / 6.0), 72.0);
          float g = smoothstep(0.0, 1.0, clamp(fract(tt / 6.0) / 0.18, 0.0, 1.0));
          col = hueTurn(SCENE(uv), (k + g) * 0.436332313);
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 9 ECHO — every frame falls back into the next, turning round the wheel ----
    case 9: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 q = (uv - 0.5) * vec2(asp, 1.0);
          float zoom = 1.016 + 0.018 * E + 0.014 * B;
          vec2 qp = rotL(q, 0.005 + 0.008 * sin(T * 0.13)) / zoom;
          vec2 puv = qp / vec2(asp, 1.0) + 0.5;
          float inside = smoothstep(0.0, 0.03, min(min(puv.x, 1.0 - puv.x), min(puv.y, 1.0 - puv.y)));
          // each older generation a step further round the colour wheel, a little dimmer
          vec3 back = hueTurn(PREV(puv), 0.03) * (0.86 + 0.07 * E) * inside;
          col = max(SCENE(uv), back);
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 10 DROSTE — the picture spirals into itself, a chord step each turn ----
    case 10: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 p = (uv - 0.5) * vec2(asp, 1.0);
          float r = max(length(p), 1e-4);
          vec2 w = vec2(log(r), atan2L(p.y, p.x));
          float L = 1.3862944;                                  // ln 4: each turn, the picture a quarter the size
          vec2 s = cmulL(w, vec2(1.0, -L / 6.2831853));         // one turn of the spiral is one step of scale
          s.x -= T * (0.16 + 0.10 * E);                         // and it falls inward forever
          float lev = floor(s.x / L);
          float u = s.x - lev * L - L;                          // [-L, 0): radius 1/4 .. 1
          vec2 d0 = exp(u) * vec2(cos(s.y), sin(s.y));
          vec2 d1 = exp(u - L) * vec2(cos(s.y), sin(s.y));
          vec3 a0 = SCENE(d0 * 0.48 / vec2(asp, 1.0) + 0.5);
          vec3 a1 = SCENE(d1 * 0.48 / vec2(asp, 1.0) + 0.5);
          vec3 sc = mix(a0, a1, smoothstep(-0.3, 0.0, u));      // the seam crossfades into the next ring down
          float f = fract(s.x / L);
          float k = mod(lev, 3.0);
          vec3 vA = revoice(sc, CHORDF(k), 0.5);
          vec3 vB = revoice(sc, CHORDF(mod(k + 1.0, 3.0)), 0.5);
          col = mix(vA, vB, smoothstep(0.8, 1.0, f));
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 11 HYPERBOLIC — Escher's disk: seven triangles round every corner ----
    case 11: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 p = (uv - 0.5) * vec2(asp, 1.0);
          vec2 z = p / 0.47;
          float rz = length(z);
          // the whole tiling drifts by a Mobius translation, an isometry of the disk
          vec2 a = 0.34 * vec2(cos(T * 0.07), sin(T * 0.053));
          z = cdivL(z + a, vec2(1.0, 0.0) + cmulL(vec2(a.x, -a.y), z));
          vec2 nA = vec2(-0.4338837, 0.9009689);
          vec2 cC = vec2(2.0121922, 0.0);
          float rr = 3.0489173;
          float n = 0.0;
          for (int i = 0; i < 28; i++){
            if (z.y < 0.0){ z.y = -z.y; n += 1.0; }
            float dA = dot(z, nA);
            if (dA > 0.0){ z -= 2.0 * dA * nA; n += 1.0; }
            vec2 dc = z - cC;
            float l2 = dot(dc, dc);
            if (l2 < rr){ z = cC + dc * (rr / max(l2, 1e-9)); n += 1.0; }
          }
          float edge = min(min(z.y, -dot(z, nA)), length(z - cC) - 1.7461149);
          // every fundamental triangle is a stretched, mirrored copy of the WHOLE frame,
          // so each tile carries the room's light wherever the room happens to be lit —
          // the way each of Escher's fish is the same fish, only nearer the edge
          vec2 tq = vec2(z.x / 0.2660772, z.y / 0.1281360);
          vec2 suv = vec2(fract(tq.x * 0.5 + 0.25 + 0.02 * T), clamp(tq.y, 0.0, 1.0));
          vec2 tuv = vec2(0.08 + 0.84 * suv.x, 0.08 + 0.84 * suv.y);
          vec3 sc = SCENE(tuv);
          // near the rim a tile is a few pixels wide and the room's thin lines alias
          // away: there the tile fills with the room's broad light instead (a coarse
          // five-tap average), so the disk stays lit to its edge
          vec3 broad = (SCENE(tuv + vec2(0.06, 0.0)) + SCENE(tuv - vec2(0.06, 0.0))
                      + SCENE(tuv + vec2(0.0, 0.06)) + SCENE(tuv - vec2(0.0, 0.06)) + sc) * 0.2;
          float shrink = (1.0 - rz * rz) * 0.47 * RES.y;      // pixels per unit length here
          vec3 tile = mix(broad * 2.4, max(sc, broad * 1.5), smoothstep(40.0, 140.0, shrink));
          vec3 v = revoice(tile, CHORDF(mod(n, 2.0)), 0.55);
          float lead = 0.55 + 0.45 * smoothstep(0.0, 1.5 / max(shrink, 1.0), edge);
          col = v * lead * smoothstep(1.0, 0.97, rz);
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 12 STAINED GLASS — leaded cells, each one voice of the chord ----
    case 12: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        float cell = 0.075 + 0.05 * clamp(BASS, 0.0, 1.0);
          vec2 p = (uv - 0.5) * vec2(asp, 1.0) / cell;
          vec2 ip = floor(p), fp = fract(p);
          float d1 = 8.0, d2 = 8.0;
          vec2 bid = vec2(0.0), bseed = vec2(0.0);
          for (int j = -1; j <= 1; j++){
            for (int i = -1; i <= 1; i++){
              vec2 g = vec2(float(i), float(j));
              vec2 id = ip + g;
              vec2 o = vec2(hashL(id), hashL(id + 17.3));
              o = 0.5 + 0.38 * sin(T * 0.15 + 6.2831853 * o);
              vec2 rv = g + o - fp;
              float d = dot(rv, rv);
              if (d < d1){ d2 = d1; d1 = d; bid = id; bseed = id + o; }
              else if (d < d2){ d2 = d; }
            }
          }
          float edge = (sqrt(d2) - sqrt(d1)) * cell;
          vec3 sc = mix(SCENE(bseed * cell / vec2(asp, 1.0) + 0.5), SCENE(uv), 0.25);
          vec3 v = revoice(sc, CHORDF(floor(hashL(bid + 5.1) * 3.0)), 0.6);
          col = v * (0.82 + 0.18 * hashL(bid + 9.7)) * smoothstep(0.003, 0.009, edge);
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 13 HALFTONE — printed in the chord: three inks at the old screen angles ----
    case 13: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 px = uv * RES;
          float cellPx = max(6.0, RES.y / 72.0);
          vec3 acc = vec3(0.0);
          float cov = 0.0;
          for (int k = 0; k < 3; k++){
            float ang = k == 0 ? 0.2617994 : (k == 1 ? 1.3089969 : 0.7853982);   // 15, 75, 45 degrees
            vec2 q = rotL(px, ang) / cellPx;
            vec2 f = fract(q) - 0.5;
            vec2 cuv = rotL((floor(q) + 0.5) * cellPx, -ang) / RES;
            vec3 cs = SCENE(cuv);
            float lum = clamp(toLab(max(cs, vec3(0.0))).x, 0.0, 1.0);
            float rad = 0.62 * sqrt(lum);
            float e = 1.0 / cellPx;
            float dotm = smoothstep(rad + e, rad - e, length(f));
            acc += revoice(cs, CHORDF(float(k)), 0.75) * dotm;
            cov += dotm;
          }
          col = acc / max(cov, 1.0);
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 14 RAIN — drops on the glass, each one a little lens ----
    case 14: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 p = uv * vec2(asp, 1.0);
          vec2 off = vec2(0.0);
          float shade = 1.0;
          for (int l = 0; l < 2; l++){
            float cs = l == 0 ? 0.17 : 0.1;
            float speed = l == 0 ? 0.11 : 0.0;                    // the near drops slide, the far ones cling
            vec2 a = vec2(p.x / cs, p.y / (cs * 1.4));
            float colH = hashL(vec2(floor(a.x), float(l) * 7.1));
            a.y += T * speed * (0.6 + 0.8 * colH) * (1.0 + 0.6 * E) / (cs * 1.4);
            vec2 id = floor(a);
            vec2 f = fract(a) - 0.5;
            float h1 = hashL(id + float(l) * 3.3), h2 = hashL(id + 11.7), h3 = hashL(id + 29.1);
            float life = fract(T * 0.07 + h3);                    // drops come and go; the beat brings more
            float on = step(0.3 - 0.2 * B, h2) * smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.85, life);
            vec2 c = vec2(0.3 * (h1 - 0.5), 0.3 * (h3 - 0.5));
            float rd = (0.14 + 0.14 * h1) * on;
            vec2 dq = (f - c) * vec2(1.0, 1.4);
            float d = length(dq) / max(rd, 1e-4);
            if (d < 1.0){
              // a ball lens: the view through the drop is turned upside down and pulled in
              off += -dq / vec2(1.0, 1.4) * cs * vec2(1.0 / asp, 1.0 / 1.4) * 0.9;
              shade *= mix(1.0, 0.5, pow(d, 6.0));          // only the very rim darkens, where the glass bends hardest
            }
          }
          col = SCENE(uv + off) * shade;
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 15 GRATING — a diffraction grating, its rainbow filtered through the chord ----
    case 15: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 c = uv - 0.5;
          float k = (0.016 + 0.03 * E) * (1.0 + 0.15 * sin(T * 0.6));
          vec2 ch0 = toLab(max(CHORDF(0.0), vec3(0.0))).yz;
          vec2 ch1 = toLab(max(CHORDF(1.0), vec3(0.0))).yz;
          vec2 ch2 = toLab(max(CHORDF(2.0), vec3(0.0))).yz;
          vec3 acc = vec3(0.0), wsum = vec3(0.0);
          for (int i = 0; i < 8; i++){
            float lam = 405.0 + 36.0 * float(i);
            vec3 w = wavelengthLinearRGB(lam);
            vec2 wl = toLab(max(w, vec3(0.0))).yz;
            vec2 wn = wl / max(length(wl), 1e-5);
            float pass = max(max(dot(wn, ch0 / max(length(ch0), 1e-5)), dot(wn, ch1 / max(length(ch1), 1e-5))),
                             dot(wn, ch2 / max(length(ch2), 1e-5)));
            w *= 0.3 + 0.7 * clamp(pass, 0.0, 1.0);             // the chord as a filter on the spectrum
            vec3 s = SCENE(uv + c * k * (lam - 530.0) / 125.0);
            acc += s * w;
            wsum += w;
          }
          col = acc / max(wsum, vec3(1e-4));                    // per channel: a flat white field stays white
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 16 BOKEH — out of focus through an aperture with as many blades as the key says ----
    case 16: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec2 p = (uv - 0.5) * vec2(asp, 1.0);
          float band = 0.08 + 0.05 * sin(T * 0.21);
          float blur = clamp((abs(p.y + 0.06 * sin(T * 0.13)) - band) * 0.10, 0.0, 0.035) * (0.7 + 0.6 * E);
          float nB = KEYN > 0.5 ? 5.0 + mod(KEYN, 4.0) : 6.0;   // 5 to 8 blades
          float seg = 6.2831853 / nB;
          vec3 acc = vec3(0.0);
          float ws = 0.0;
          for (int i = 0; i < 24; i++){
            float fi = float(i);
            float a = fi * 2.3999632 + T * 0.05;                // the golden angle fills the aperture evenly
            float am = mod(a, seg) - 0.5 * seg;
            float poly = cos(0.5 * seg) / cos(am);              // the polygon's radius at this angle
            vec2 o = sqrt((fi + 0.5) / 24.0) * poly * vec2(cos(a), sin(a)) * blur;
            vec3 s = SCENE(uv + o / vec2(asp, 1.0));
            float l = lumaL(s);
            float w = 1.0 + 6.0 * l * l;                        // highlights open into discs
            acc += s * w;
            ws += w;
          }
          col = acc / ws;
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }

    // ---- 17 CONTOUR — the light drawn as a map, each level a voice of the chord ----
    case 17: {
        using namespace lx;
        float2 uv = float2(uvT.x, 1.0 - uvT.y);          // the dialect's y runs up, as on the web
        float asp = r.x / r.y;
        float T = t, E = energy, B = onset, BASS = clamp(U.bass, 0.0, 1.5), KEYN = U._pad3;
        float2 RES = r;
#define SCENE(q) scene.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define PREV(q) prev.sample(smp, float2(clamp((q).x, 0.0, 1.0), 1.0 - clamp((q).y, 0.0, 1.0))).rgb
#define RAMP(tt) rampL(U, (tt))
#define CHORDF(k) RAMP((k) / 3.0)
        vec3 s = SCENE(uv);
          vec2 px = 1.5 / RES;
          float L0 = toLab(max(s, vec3(0.0))).x;
          float Lx = toLab(max(SCENE(uv + vec2(px.x, 0.0)), vec3(0.0))).x;
          float Ly = toLab(max(SCENE(uv + vec2(0.0, px.y)), vec3(0.0))).x;
          float gL = length(vec2(Lx - L0, Ly - L0)) / 1.5;      // lightness change per pixel
          float t = L0 / 0.07;
          float dl = abs(fract(t + 0.5) - 0.5) * 0.07 / max(gL, 1e-4);
          // where the contours crowd closer than ~2 px the line is a thin bright feature, not a slope: leave it lit
          float line = (1.0 - smoothstep(0.6, 1.6, dl)) * smoothstep(0.5, 0.2, gL / 0.07);
          vec3 v = revoice(s, CHORDF(mod(floor(t), 3.0)), 0.6);
          col = v * (1.0 - 0.85 * line);
#undef SCENE
#undef PREV
#undef RAMP
#undef CHORDF
        col = mix(scene.sample(smp, uvT).rgb, col, amt);
        break;
    }
    // @lens2-cases-end

    default:
        col = scene.sample(smp, uv).rgb;
        break;
    }

    col = govern_L(max(col, float3(0.0)), U.white);
    return float4(col, 1.0);
}
