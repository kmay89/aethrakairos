#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: QUARTET — builder owns everything between these fences ==== */
/* ================================================================
   QUARTET — the band, seen.

   The web's QUARTET, retold as a stateless fragment. Every song has
   been taken apart into its four players by Demucs and the drums
   charted hit by hit (tools/stems.py); the CPU samples the window three
   seconds behind now to three seconds ahead into a 64-texel lane
   texture (texture(3): r drums — beaded with the chart's hits — g bass,
   b voice, a everything else; texel 64's r is the LIVE flag), the same
   samples the web uploads. Four strands, one per player, as broad and as
   bright as that player is loud, flow through one NOW; a node lights
   where each crosses it; the coming three seconds are drawn ahead as a
   dotted ghost (dark when live — the future of the mic is unwritten).

   FACES (roll0 in halves, the web's two): THE SCORE — four strands left
   to right; THE RINGS — four concentric rings, now at the top, the
   future running clockwise.

   Laws as ever: void ground, chord-only colour (each strand a place on
   the chord ramp), govern() at the exit, roll0 the face, every loop
   bounded by a compile-time literal. All helpers live in namespace
   rm_qt: a self-contained translation unit.
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

namespace rm_qt {

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

inline float qtHash(float2 p){ p = fract(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

/* the lane texture at window position u (½ is now), linearly between
   texels as the web's LinearFilter reads it */
inline float4 qtLanes(texture2d<float, access::read> T, float u) {
    float x = clamp(u, 0.0, 1.0) * 64.0 - 0.5;
    float x0 = floor(x);
    float f = x - x0;
    int i0 = clamp(int(x0), 0, 63), i1 = clamp(int(x0) + 1, 0, 63);
    return mix(T.read(uint2(uint(i0), 0)), T.read(uint2(uint(i1), 0)), f);
}
// strand order, bottom to top (inner to outer): bass, drums, the rest, the voice
inline float qtLane(float4 L, int k) { return k == 0 ? L.g : (k == 1 ? L.r : (k == 2 ? L.a : L.b)); }

}  // namespace rm_qt

fragment float4 room_quartet(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]],
                             texture2d<float, access::read> lanes [[texture(3)]])
{
    using namespace rm_qt;
    float2 r2 = max(res, float2(1.0));
    float aspect = max(U.aspect, 0.3);
    float2 p = float2((pos.x / r2.x - 0.5) * 2.0 * aspect, (0.5 - pos.y / r2.y) * 2.0);
    bool rings = U.roll0 >= 0.5;
    float live = lanes.read(uint2(64, 0)).r;
    float th = atan2(p.x, p.y);                       // 0 at the top, clockwise positive
    float r = length(p);
    float u = rings ? 0.5 + th / 6.2831853 : 0.5 + p.x / (2.0 * aspect);
    float nowd = rings ? abs(th) * r : abs(p.x);
    float4 L = qtLanes(lanes, u);
    float4 N = qtLanes(lanes, 0.5);
    float fut = step(0.5, u);
    float dist = abs(u - 0.5);
    float past = exp(-dist * 2.4);
    float ghost = 0.50 * exp(-dist * 2.4) * (1.0 - live);
    float fr = fract(u * 110.0);
    float dots = 0.25 + 0.75 * smoothstep(0.30, 0.42, fr) * (1.0 - smoothstep(0.80, 0.92, fr));
    float fadeSoft = mix(past, ghost, fut);
    float fadeCore = mix(past, ghost * dots, fut);
    float phase = U.time * 0.6 + U.roll1 * 20.0;
    float beat = clamp(U.onsetEnv, 0.0, 1.5);
    float3 col = float3(0.0);
    float s = rings ? min(aspect, 1.0) : 1.0;
    for (int k = 0; k < 4; k++) {
        float fk = float(k);
        float v = qtLane(L, k);
        float vn = qtLane(N, k);
        float base = rings ? (0.24 + 0.215 * fk) * s : -0.66 + 0.44 * fk;
        float along = rings ? th * 2.2 : p.x * 2.6;
        float wob = (rings ? 0.018 : 0.034) * sin(along + phase * (0.55 + 0.12 * fk) + fk * 1.7) * (0.35 + v);
        float d = (rings ? r : p.y) - (base + wob);
        float w = 0.0035 + 0.046 * v;
        float3 c = chordRamp(U, 0.06 + 0.25 * fk);
        float core = exp(-(d * d) / (w * w));
        float glow = exp(-abs(d) / (w * 1.8 + 0.006)) * 0.20;
        float staff = exp(-abs(d) * 420.0) * 0.07;
        float soft = glow * v + staff;
        if (k == 3) soft += (1.0 - smoothstep(0.0, w * 1.9, abs(d))) * 0.16 * v;
        if (k == 2) soft += exp(-abs(abs(d) - w * 1.25) * 380.0) * 0.35 * v;
        col += c * (core * (0.25 + 0.95 * v) * fadeCore + soft * fadeSoft);
        float nd = length(float2(nowd, d));
        float hit = k == 1 ? beat : 0.0;
        col += c * exp(-nd * nd / (0.00025 + 0.0035 * vn)) * (0.20 + 1.1 * vn) * (1.0 + 0.7 * hit);
    }
    float nowLine = rings ? exp(-nowd * 260.0) * step(0.0, p.y) * (1.0 - smoothstep(0.15 * s, 1.05 * s, r))
                          : exp(-nowd * 260.0);
    col += chordRamp(U, 0.5) * nowLine * (0.07 + 0.22 * beat);
    col += (qtHash(pos.xy) - 0.5) * 0.006;
    return float4(govern(max(VOID + col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: QUARTET ==== */
