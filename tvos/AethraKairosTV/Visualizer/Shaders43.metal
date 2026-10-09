#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: FLUID — builder owns everything between these fences ==== */
/* ================================================================
   FLUID — the Navier–Stokes equations, retold without a grid.

   The web's FLUID solves the equations live: Stam's stable scheme on
   two ping-pong grids — advect, confine the vorticity, project out the
   divergence — with three DANCERS tracing harmonograph figures across
   the tank and dragging their ink behind them. A Metal room is a
   stateless fragment: no grid survives the frame, so this is the same
   picture told closed-form from the clock.

   THE FLOW is a stream function ψ built from five travelling shear
   waves and two gaussian whirls (the bass's, wound into the middle, and
   the ghost hand's); the velocity is (∂ψ/∂y, −∂ψ/∂x), so ∇·v = 0
   EXACTLY — the one law the web's pressure solve enforces by sixteen
   Jacobi sweeps a frame is here enforced by construction. THE INK is
   found the way the web's advection finds it: walk this pixel back
   along the flow, step by step, and wherever the walk passes a dancer's
   position at that earlier moment, that dancer's ink was laid there and
   has ridden the flow to here (twenty-four steps, 1.1 s of history, the
   ink fading per step as the web's dissipation fades it per frame). The
   three inks are places on the chord ramp, never colours. The onset is a
   splash: ink laid at the beat is heavier, so a blob travels down each
   trail from the moment of the hit, and the bass kicks the whirl. The
   ink has a surface lit from the upper left (the summed gradient of the
   gaussians is the normal, free), and a wide second skirt per gaussian
   stands in for the web's bloom.

   FACES (roll0 in thirds, the web's three): THE DANCE — two dancers, a
   lively flow; THE STORM — three, the flow strong, the whirl hard, the
   ink burned off fast; THE VEIL — one slow dancer laying wide sheets of
   all three inks that last. roll1/roll2 seed the figures and phases.

   PROVENANCE: Jos Stam, "Stable Fluids" (SIGGRAPH 1999) for the
   semi-Lagrangian back-walk; Mark Harris, GPU Gems ch. 38 (2004) and
   Fedkiw, Stam and Jensen (SIGGRAPH 2001) for the web twin's grid
   passes; the stream-function flow, the dancers and the three inks are
   our own. No code from any implementation is copied in.

   Laws as ever: void ground, chord-only colour, govern() at the exit,
   roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_fl: a self-contained translation unit.
   ================================================================ */

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140
    // _pad1/_pad2 (132/136) carry the LENS pass's live fields and _pad3
    // (140) the song's Camelot number — no pad here is free to claim
    float dHit; float dAge; float dKick; float dMass;               // 144..156  the dance bus (see tools/dance_prelude.mjs)
    float dArtic; float dSpark; float dSway; float dLift;           // 160..172
    float dBrace; float dImpact; float dStill; float dPeriod;       // 176..188  -> stride 192
};
static_assert(sizeof(VizUniforms) == 192, "VizUniforms drifted: the CPU mirror uploads 192 bytes");

namespace rm_fl {

constant float3 VOID = float3(0.019608, 0.023529, 0.054902);

inline float3 govern(float3 c, float white) {
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
inline float3 chordRamp(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}

#define vec2 float2
#define vec3 float3
#define vec4 float4

inline float flHash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
inline float flHash1(float x){ return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
// the harmonograph ratios the dice deal from, the web's figs table
constant float flFigA[5] = { 1.0, 3.0, 2.0, 3.0, 1.0 };
constant float flFigB[5] = { 2.0, 2.0, 3.0, 4.0, 3.0 };

/* THE FLOW. ψ = Σ aᵢ sin(kᵢ·p + ωᵢt + φᵢ) + whirls; v = (∂ψ/∂y, −∂ψ/∂x). */
struct Flow {
    vec2 k0, k1, k2, k3, k4;      // wave vectors
    vec4 w;  float w4;            // angular rates
    vec4 a;  float a4;            // amplitudes, already divided by |k|
    vec4 ph; float ph4;           // phases
    vec4 whirl;                   // the bass's: centre, strength, 1/σ²
    vec4 hand;                    // the ghost's
};
inline vec2 flWave(vec2 k, float w, float a, float ph, vec2 p, float t){
    float c = cos(dot(k, p) + w * t + ph);
    return a * c * vec2(k.y, -k.x);
}
inline vec2 flWhirl(vec4 W, vec2 p){
    vec2 d = p - W.xy;
    float g = exp(-dot(d, d) * W.w);
    // a tangential push of one strength across the whirl's reach, as the web's
    return vec2(-d.y, d.x) / (length(d) + 0.04) * (W.z * g);
}
inline vec2 flVel(thread const Flow& F, vec2 p, float t){
    vec2 v = flWave(F.k0, F.w.x, F.a.x, F.ph.x, p, t)
           + flWave(F.k1, F.w.y, F.a.y, F.ph.y, p, t)
           + flWave(F.k2, F.w.z, F.a.z, F.ph.z, p, t)
           + flWave(F.k3, F.w.w, F.a.w, F.ph.w, p, t)
           + flWave(F.k4, F.w4,  F.a4,  F.ph4,  p, t);
    v += flWhirl(F.whirl, p);
    if (F.hand.z != 0.0) v += flWhirl(F.hand, p);
    return v;
}

/* THE DANCERS: the web's harmonograph, in centred coordinates (y up, x
   spanning ±aspect). fig = (a, b, c, 0), ph = (pa, pb, pc, 0). */
inline vec2 flDancer(vec4 fig, vec4 ph, float th, float rx, float ry){
    return vec2(rx * (0.8 * sin(th * fig.x + ph.x) + 0.2 * sin(th * fig.z + ph.z)),
                ry * (0.8 * sin(th * fig.y + ph.y) + 0.2 * cos(th * fig.z * 0.7 + ph.x)));
}

}  // namespace rm_fl

fragment float4 room_fluid(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_fl;
    vec2 r2 = max(res, float2(1.0));
    float aspect = max(U.aspect, 0.3);
    // centred, y up, x spanning ±aspect — the web's (vUv − ½)·2·(aspect, 1)
    vec2 p = vec2((pos.x / r2.x - 0.5) * 2.0 * aspect, (0.5 - pos.y / r2.y) * 2.0);

    int face = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float energy = clamp(U.energy, 0.0, 1.0);
    float bass = clamp(U.bass, 0.0, 1.0), mid = clamp(U.mid, 0.0, 1.0), treble = clamp(U.treble, 0.0, 1.0);

    /* the faces, the web's numbers: how many dancers, how fast, how far,
       how thick the ink, how strong the flow, how long the ink lasts */
    int   nD     = face == 0 ? 2    : (face == 1 ? 3    : 1);
    float tempo  = face == 0 ? 1.0  : (face == 1 ? 1.4  : 0.45);
    float reach  = face == 0 ? 0.40 : (face == 1 ? 0.44 : 0.42);
    float sigma2 = face == 0 ? 0.0040 : (face == 1 ? 0.0048 : 0.016);    // the web's radius (uv²) in centred units (×4)
    float inkK   = face == 0 ? 1.15 : (face == 1 ? 1.30 : 0.50);
    float flowK  = face == 0 ? 0.55 : (face == 1 ? 0.85 : 0.28);
    float swirlK = face == 0 ? 0.5  : (face == 1 ? 1.0  : 0.25);
    float fadeK  = face == 0 ? 0.9  : (face == 1 ? 1.5  : 0.30);          // the web's ink dissipation, per second
    float relief = face == 2 ? 0.8 : 1.0;
    float bloomK = face == 0 ? 0.7 : (face == 1 ? 0.8 : 0.5);
    bool  blend  = face == 2;

    /* the song's pace: the web integrates its clock on the energy; the TV
       reads a steady clock and leans it on the (smoothed) energy */
    float t = U.time;
    float rate = tempo * 0.8;
    float th = t * rate + energy * 0.6;

    /* the figures: roll1 and roll2 deal the integer ratios and phases */
    vec4 fig[3]; vec4 ph[3];
    for (int e = 0; e < 3; e++){
        float s0 = flHash1(U.roll1 * 17.3 + float(e) * 3.1);
        float s1 = flHash1(U.roll2 * 23.7 + float(e) * 5.3);
        float s2 = flHash1(U.roll1 * 7.9 + U.roll2 * 11.1 + float(e));
        int fi = int(clamp(s0 * 5.0, 0.0, 4.999));
        fig[e] = vec4(flFigA[fi], flFigB[fi], 0.23 + 0.3 * s1, 0.0);
        ph[e] = vec4(s1 * 6.283, s2 * 6.283, s0 * 6.283, 0.0);
    }
    float rx = 2.0 * reach * aspect / max(aspect, 1.0);
    float ry = 2.0 * reach * min(1.0, aspect * 1.6);

    /* THE FLOW: five shear waves on different headings and rates, their
       amplitudes breathing with the energy; the bass's whirl in the middle,
       kicked by the onset; the ghost's hand a whirl of its own */
    Flow F;
    F.k0 = vec2( 2.3,  1.1); F.k1 = vec2(-1.7,  2.6); F.k2 = vec2( 3.4, -2.2);
    F.k3 = vec2(-0.9, -3.1); F.k4 = vec2( 1.3,  3.9);
    F.w  = vec4(0.37, -0.52, 0.61, -0.29); F.w4 = 0.44;
    float amp = flowK * (0.55 + energy * 0.7);
    F.a  = vec4(0.30, 0.26, 0.17, 0.21) * amp / vec4(length(F.k0), length(F.k1), length(F.k2), length(F.k3));
    F.a4 = 0.14 * amp / length(F.k4);
    F.ph = vec4(U.roll2 * 6.283, U.roll1 * 6.283, U.roll2 * 3.1, U.roll1 * 1.7); F.ph4 = 2.4;
    float dir = U.roll1 < 0.5 ? -1.0 : 1.0;
    float kick = U.onsetEnv * bass;
    F.whirl = vec4(0.0, 0.0, swirlK * (bass * 0.45 + kick) * 0.7 * dir, 1.0 / 0.48);
    F.hand = vec4(U.ghostX * aspect, -U.ghostY, U.ghostStrength > 0.05 ? U.ghostStrength * 1.4 : 0.0, 1.0 / 0.12);

    /* THE INK: walk back along the flow; where the walk meets a dancer's
       position at that earlier moment, its ink was laid there. The beat's
       ink is heavier — a splash riding each trail from the moment of the hit. */
    const float h = 0.045;                       // seconds per step: 24 of them, 1.08 s of history
    float fade = exp(-fadeK * h);
    float invR = 1.0 / sigma2;
    float tBeat = t - clamp(U.beatPhase, 0.0, 1.0) * 0.5;   // the last hit, at a half-second beat
    vec3 ink = vec3(0.0), skirt = vec3(0.0);
    vec2 grad = vec2(0.0);
    vec2 x = p;
    float decay = 1.0;
    for (int k = 0; k < 24; k++){
        float tk = t - float(k) * h;
        float thk = th - float(k) * h * rate;
        float splash = 1.0 + 2.2 * U.onsetEnv * exp(-pow((tk - tBeat) / 0.07, 2.0));
        for (int e = 0; e < 3; e++){
            if (e >= nD) break;
            vec2 E = flDancer(fig[e], ph[e], thk, rx, ry);
            vec2 d = x - E;
            float q = dot(d, d);
            float g = exp(-q * invR) * decay * splash;
            float band = e == 0 ? bass : (e == 1 ? mid : treble);
            if (blend){
                vec3 w3 = inkK * vec3(0.5 + bass, 0.3 + mid, 0.3 + treble);
                ink += g * w3;
                skirt += exp(-q * invR * 0.15) * decay * w3 * 0.25;
            } else {
                float amt = inkK * (0.25 + band * 0.9 + energy * 0.3);
                vec3 w3 = e == 0 ? vec3(amt, 0.0, 0.0) : (e == 1 ? vec3(0.0, amt, 0.0) : vec3(0.0, 0.0, amt));
                ink += g * w3;
                skirt += exp(-q * invR * 0.15) * decay * w3 * 0.25;
            }
            grad += d * (-2.0 * invR * g);
        }
        x -= flVel(F, x, tk) * h;
        decay *= fade;
    }

    /* the three inks are places on the chord ramp, drifting as the web's do */
    float drift = t * 0.011;
    vec3 cA = chordRamp(U, 0.08 + drift), cB = chordRamp(U, 0.40 + drift), cC = chordRamp(U, 0.72 + drift);
    /* the haze below a few percent is gated to the void and dense ink saturates
       in COLOUR, never bleaches — the web's gate and knee, on the same numbers */
    vec3 gated = max(ink - 0.035, float3(0.0)) * 1.08;
    vec3 kneed = 1.0 - exp(-gated * 1.3);
    vec3 col = (cA * kneed.x + cB * kneed.y + cC * kneed.z) * 1.4;
    // the surface: the summed gradient is the normal, lit from the upper left
    vec3 n = normalize(vec3(grad * 0.04, 1.0));
    float diff = clamp(dot(n, normalize(vec3(-0.4, 0.5, 0.75))) + 0.7, 0.7, 1.0);
    col *= mix(1.0, diff, relief);
    // the dancers: three small lights, each wearing its own ink's colour
    for (int e = 0; e < 3; e++){
        if (e >= nD) break;
        vec2 dd = p - flDancer(fig[e], ph[e], th, rx, ry);
        float q = dot(dd, dd) * 0.25;                 // the web's uv² footprint, in centred units
        float band = e == 0 ? bass : (e == 1 ? mid : treble);
        vec3 lc = e == 0 ? cA : (e == 1 ? cB : cC);
        float glow = (0.5 + band * 0.6 + U.onsetEnv * 0.5) * (blend ? 0.7 : 1.0);
        col += lc * (exp(-q * 9000.0) * 1.6 + exp(-q * 600.0) * 0.35) * glow;
    }
    // the bloom: the wide skirt of every gaussian, on the same inks
    col += (cA * skirt.x + cB * skirt.y + cC * skirt.z) * bloomK * (0.8 + U.onsetEnv * 0.4);
    // a static dither, as the web's: the pixel's own hash
    col += (flHash(pos.xy) - 0.5) * 0.006;
    return float4(govern(max(VOID + col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: FLUID ==== */
