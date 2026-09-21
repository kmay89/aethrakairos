#include <metal_stdlib>
using namespace metal;

/* ================================================================
   THE FIELD — the ghost's hand on the light itself.

   The web player's touch metric bends BOTH matter and light: every
   point shader moves its particles through warpPush(), and a full-
   screen pass (LENS_FIELD) moves the sample coordinate of the finished
   frame through the same deflection, so the room's glow, its void, its
   everything curves around the hand — not only the sprites that chose
   to listen.

   On the TV the hand is the GHOST (the phantom that plays the field
   after 22 s of stillness). The rooms already lean toward it where
   they individually opted in; this pass is the other half of the web's
   law, ported: one full-screen resample between the XFORM composite
   and the LENS, deflected by the ghost's own force. It is the web's
   LENS_FIELD_LEAN for one hand — the same warpReach / warpSoft /
   warpDeflect ladder with the same constants baked, so a gathers room
   pulls the light inward on both stages by the same curve.

   The renderer runs it ONLY while the ghost is present
   (ghostStrength > threshold); a still room, a live remote, CALM and
   Reduce Motion all skip the pass entirely — the wave-2 tail survives
   untouched, and a bug here degrades to a straight passthrough, never
   a black screen.

   Laws in force:
   - Colour is only MOVED, never invented: the pass resamples the scene
     the rooms already drew. The one darkening is the event horizon's
     capture, which the web's twin does too.
   - govern_f at the exit, the same INK knee every room exits through.
   - No loops at all, so the bounded-loop law is satisfied trivially.
   - The hand's parameters ride buffer(2) as one float4:
       x = mode   (the room's touch affinity: 0 blackhole, 1 grows,
                   2 gathers, 3 flows — the ghost never deals TIDAL)
       y = charge (the moment's onset envelope standing in for the
                   web hand's banked press)
       z = spin   (the swirl energy a slow phantom stroke carries)
       w = phase  (the ripple clock, advanced by the renderer)

   Helper names carry the _f suffix so this translation unit never
   collides with its siblings at metallib link. VizUniforms is
   re-declared VERBATIM (144-byte fixed layout); this unit reads the
   ghost block (offsets 108..120) and white (104).
   ================================================================ */

// ---- THE FINAL VizUniforms — VERBATIM, 144-byte fixed layout.
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
// the metric — the web's WARP constants, baked verbatim
// ---------------------------------------------------------------

// how far the hand reaches (ndc), smoothstepped to zero at the rim
inline float warpReach_f(float r, float reach) {
    float x = clamp(1.0 - r / max(1e-4, reach), 0.0, 1.0);
    return x * x * (3.0 - 2.0 * x);
}

// the soft ceiling: exact for small x, asymptotic to m — the web's
// warpSoft, so no deflection ever folds the frame over itself
inline float warpSoft_f(float x, float m) {
    return x / (1.0 + fabs(x) / max(1e-4, m));
}

/* rad = displacement along the radius, ang = rotation around the hand
   (radians), both per unit force — the web's warpDeflect ladder,
   character for character with its JS and GLSL twins:
     mode -1  grows, the other chirality (pure swirl, CCW)
     mode  0  blackhole — light falls IN, and twists as it falls
     mode  1  grows — pure swirl, CW
     mode  2  gathers — the accretion well: pull + strong swirl
     mode  3  flows — a radial ripple travelling on the phase clock
     mode  4  tidal — kept so the ladder stays whole; the ghost
              never deals it (its two lobes need an axis no phantom
              stroke carries here)                                   */
inline float2 warpDeflect_f(float mode, float r, float charge, float spin,
                            float beat, float phase) {
    float w = warpReach_f(r, 0.7800 * (1.0 + charge * 0.35));
    float inv = 1.0 / (r + 0.0550);
    float rad = 0.0, ang = 0.0;
    if (mode < -0.5) {
        ang = -0.6200 * inv * (0.5 + spin * 1.1) * w;
    } else if (mode < 0.5) {
        rad = 0.0360 * inv * (1.0 + charge * 0.7) * w;
        ang = 0.6200 * 0.20 * inv * charge * w;
    } else if (mode < 1.5) {
        ang = 0.6200 * inv * (0.5 + spin * 1.1) * w;
    } else if (mode < 2.5) {
        rad = -0.0360 * inv * (0.85 + charge * 0.6) * w;
        ang = 0.6200 * (0.45 + charge * 0.55) * inv * w;
    } else if (mode < 3.5) {
        rad = 0.0360 * 1.8 * sin(r * 12.0000 - phase)
            * (0.55 + beat * 0.75 + charge * 0.5) * w;
    } else {
        rad = 0.0360 * inv * (0.9 + charge * 0.6) * w;
        ang = 0.6200 * 0.15 * inv * spin * w;
    }
    return float2(warpSoft_f(rad, 0.1750), warpSoft_f(ang, 1.4500));
}

// the event horizon: only the BLACKHOLE has one, and inside it the
// light is simply caught — the web's warpHorizon, same radius
inline float warpHorizon_f(float mode, float force, float charge) {
    if (!(mode > -0.5 && mode < 0.5)) return 0.0;
    return 0.0460 * force * (0.75 + charge * 0.9);
}

// the flash governor at the exit — the INK knee every room obeys
inline float3 govern_f(float3 c, float white) {
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

// ---------------------------------------------------------------
// the one triangle's fragment — the ghost bends the frame
// ---------------------------------------------------------------
fragment float4 field_pass(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           constant float4& P [[buffer(2)]],
                           texture2d<float> scene [[texture(0)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);

    float2 r = max(res, float2(1.0));
    float2 uv = pos.xy / r;

    // the ghost's presence IS the force — already capped at half a real
    // hand by the renderer, already zero under CALM / Reduce Motion
    float force = clamp(U.ghostStrength, 0.0, 1.0);
    if (force < 0.003) {
        return float4(scene.sample(smp, uv).rgb, 1.0);
    }

    float aspect = max(U.aspect, 1e-4);
    // centered, y-down — the same frame the rooms read the ghost in
    float2 p = (uv * 2.0 - 1.0) * float2(aspect, 1.0);
    float2 c = float2(U.ghostX * aspect, -U.ghostY);

    float mode = P.x, charge = P.y, spin = P.z, phase = P.w;

    float2 d = p - c;
    float dist = length(d);
    float2 dir = normalize(d + 1e-5);

    float2 warp = warpDeflect_f(mode, dist, charge, spin, U.onsetEnv, phase);
    float ang = warp.y * force, rad = warp.x * force;

    float horizon = warpHorizon_f(mode, force, charge);
    float caught = horizon > 0.0
        ? 1.0 - smoothstep(horizon * 0.72, horizon * 1.15, dist) : 0.0;

    // rotate the ray around the hand and slide it along the radius —
    // then read where the light CAME FROM
    float ca = cos(ang), sa = sin(ang);
    float2 rot = float2(dir.x * ca - dir.y * sa, dir.x * sa + dir.y * ca);
    float2 uA = (c + rot * (dist + rad)) / float2(aspect, 1.0) * 0.5 + 0.5;

    float3 col = scene.sample(smp, clamp(uA, 0.0, 1.0)).rgb * (1.0 - caught);
    return float4(govern_f(max(col, float3(0.0)), U.white), 1.0);
}
