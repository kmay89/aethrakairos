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
     lens adds light the room did not make.
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
   this unit reads U.lens (offset 128) and U.lensAmt (offset 132).
   ================================================================ */

constant float TAU_L = 6.28318530718;

// ---- THE FINAL VizUniforms — VERBATIM, 144-byte fixed layout.
// Wave 3 names offset 128 `lens` and offset 132 `lensAmt`; offset 140
// stays reserved. Only names differ from the sibling units — the bytes
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
    float L = lumaOf_L(c);
    float cap = 0.70 + 1.6 * clamp(white, 0.0, 1.0);   // 0.78 (verse) .. 2.17 (drop)
    return (L > cap && L > 1e-4) ? c * (cap / L) : c;
}

// ---------------------------------------------------------------
// the one triangle's fragment — the lens
// ---------------------------------------------------------------
fragment float4 lens_pass(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float> scene [[texture(0)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);

    float2 r = max(res, float2(1.0));
    float2 uv = pos.xy / r;
    float aspect = max(U.aspect, 1e-4);

    float amt = clamp(U.lensAmt, 0.0, 1.0);
    int mode = int(round(clamp(U.lens, -1.0, 5.0)));

    // clean glass — the renderer bypasses this pass when lens < 0, but a
    // stray call (or amt of zero) passes the scene straight through.
    if (mode < 0 || amt <= 0.0) {
        return float4(scene.sample(smp, uv).rgb, 1.0);
    }

    float t      = U.time;
    float energy = clamp(U.energy, 0.0, 2.0);
    float onset  = clamp(U.onsetEnv, 0.0, 1.0);

    float3 col;

    switch (mode) {

    // ---- 0 MIRRORS — kaleidoscopic fold into k sectors, slow turn ----
    case 0: {
        float2 p = uv - 0.5;
        p.x *= aspect;
        float rad = length(p);
        float ang = atan2(p.y, p.x) + t * 0.12;          // the slow turn
        float k = 6.0;
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
        col = scene.sample(smp, uv).rgb * mix(1.0, v, amt);          // darken only
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
        float da = 0.05 + 0.05 * energy;
        float g1 = sin(dot(pc, float2(cos(da),  sin(da)))  * f);
        float g2 = sin(dot(pc, float2(cos(-da), sin(-da))) * f);
        float grat = 0.5 + 0.5 * g1 * g2;                            // interference 0..1
        float shade = mix(1.0, 0.55 + 0.45 * grat, amt);            // darken only (<= 1)
        col = scene.sample(smp, uv).rgb * shade;
        break;
    }

    default:
        col = scene.sample(smp, uv).rgb;
        break;
    }

    col = govern_L(max(col, float3(0.0)), U.white);
    return float4(col, 1.0);
}
