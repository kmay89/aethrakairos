#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: GLASS — builder owns everything between these fences ==== */
/* ================================================================
   GLASS — the glasshouse.

   A polyhedron built the way a glassblower would build it: every
   edge a bundle of three clear rods, every vertex a lit bead banded
   like cane, the whole cage nested three frames deep so the eye
   falls through it toward a warm core. The solid is one vertex and
   one half-edge folded through the polyhedral mirror group
   (Knighty's fold — [3,5] for the dodecahedron and the
   icosidodecahedron, [3,4] for the cube), and the glass is optics
   in miniature: the ray is marched THROUGH every rod it meets,
   entering and leaving, and at each surface Schlick's Fresnel
   decides how much of the studio it reflects — nearly invisible
   face-on, bright at the grazing edge.

   Laws as ever: void ground, chord-only colour, govern() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 96 here).
   All helpers live in namespace rm_gl: a self-contained
   translation unit.
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

namespace rm_gl {

constant float PI  = 3.14159265359;
constant float TAU = 6.28318530718;
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
inline float hash21(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float3x3 rotY(float a) { float c = cos(a), s = sin(a); return float3x3(float3(c, 0.0, -s), float3(0.0, 1.0, 0.0), float3(s, 0.0, c)); }
inline float3x3 rotX(float a) { float c = cos(a), s = sin(a); return float3x3(float3(1.0, 0.0, 0.0), float3(0.0, c, s), float3(0.0, -s, c)); }

// the web keeps these as shader globals; Metal carries them by hand
struct Glass {
    float3 nc; float3 v; float3 e; float3 u1; float3 u2;
    float tube; float bead; float bund; float L;
    float3x3 R0; float3x3 R1; float3x3 R2;
    float S0; float S1; float S2;
};

// one frame: fold into the fundamental domain, then ONE vertex stands
// for every vertex and ONE half-edge — a bundle of three glass rods
// running to the mirror, where its reflection meets it — for every edge
inline float2 frame(float3 p, thread const Glass& G) {
    for (int i = 0; i < 5; i++) {
        p.xy = abs(p.xy);
        p -= 2.0 * min(0.0, dot(p, G.nc)) * G.nc;
    }
    float3 q = p - G.v;
    float along = clamp(-dot(q, G.e), 0.0, G.L);
    float3 w = q + along * G.e;
    float2 c = float2(dot(w, G.u1), dot(w, G.u2));
    float tube = 1e5;
    for (int k = 0; k < 3; k++) {
        float th = float(k) * 2.0943951 + 0.5;
        tube = min(tube, length(c - G.bund * float2(cos(th), sin(th))));
    }
    tube -= G.tube;
    float bead = length(q) - G.bead;
    return tube < bead ? float2(tube, 0.0) : float2(bead, 1.0);
}
// three frames deep: x = distance, y = 0 rod / 1 bead, z = depth
inline float3 map(float3 p, thread const Glass& G) {
    float3 best = float3(frame(G.R0 * p / G.S0, G) * G.S0, 0.0);
    float2 d1 = frame(G.R1 * p / G.S1, G) * G.S1;
    if (d1.x < best.x) best = float3(d1, 1.0);
    float2 d2 = frame(G.R2 * p / G.S2, G) * G.S2;
    if (d2.x < best.x) best = float3(d2, 2.0);
    return best;
}
inline float3 nrm(float3 p, thread const Glass& G) {
    const float2 e = float2(0.0025, -0.0025);
    return normalize(e.xyy * map(p + e.xyy, G).x + e.yyx * map(p + e.yyx, G).x
                   + e.yxy * map(p + e.yxy, G).x + e.xxx * map(p + e.xxx, G).x);
}
// the studio the glass reflects: dark, with softboxes — chord light only
inline float3 studio(constant VizUniforms& U, float3 r) {
    float3 c = chordRamp(U, 0.60 + 0.08 * r.y) * 0.05;
    c += chordRamp(U, 0.82) * exp(-abs(r.y - 0.62) * 9.0) * 1.1;
    c += chordRamp(U, 0.35) * exp(-abs(r.x + 0.70) * 8.0) * smoothstep(-0.3, 0.7, r.y + 0.4) * 0.8;
    c += chordRamp(U, 0.70) * exp(-abs(r.x - 0.75) * 10.0) * smoothstep(-0.6, 0.4, -r.y) * 0.6;
    c += float3(1.0) * pow(max(dot(r, normalize(float3(0.45, 0.55, 0.70))), 0.0), 60.0) * 1.6;
    return c;
}

}  // namespace rm_gl

// ===============================================================
// GLASS — the lattice you can see through: the cage, the cube,
// the star, each three frames deep around a warm core.
// ===============================================================
fragment float4 room_glass(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_gl;
    float2 p = centeredUp(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    // the web eases these from the analyzer; the TV's stateless twins
    float spin = U.time * (0.10 + U.energy * 0.08);
    float breath = U.bass;
    float beat = pow(1.0 - fract(U.beatPhase), 4.0);

    Glass G;
    float N = mode == 1 ? 4.0 : 5.0;
    float cs = cos(PI / N), ss = sqrt(max(0.75 - cs * cs, 0.0));
    G.nc = float3(-0.5, -cs, ss);
    float3 pab = float3(0.0, 0.0, 1.0);
    float3 pca = normalize(float3(0.0, ss, cs));
    // which vertex of the domain carries the bead decides the solid;
    // its one live edge runs to the y-mirror (cage, cube) or the third (star)
    G.v = mode < 2 ? pca : pab;
    G.e = mode < 2 ? float3(0.0, 1.0, 0.0) : G.nc;
    G.L = dot(G.v, G.e);
    G.u1 = normalize(G.v - G.L * G.e);
    G.u2 = cross(G.e, G.u1);
    G.bund = mode == 2 ? 0.030 : 0.040;
    G.tube = mode == 2 ? 0.013 : 0.017;
    G.bead = G.bund + G.tube * 2.3;
    // the frames nest, each counter-turned; the bass breathes the inner ones
    float a = varA * TAU;
    G.S0 = 1.0;
    G.S1 = 0.56 * (1.0 + breath * 0.10);
    G.S2 = 0.31 * (1.0 + breath * 0.18);
    G.R0 = float3x3(1.0);
    G.R1 = rotY(0.6 + a * 0.3 - spin * 0.9) * rotX(0.35);
    G.R2 = rotY(-0.9 + spin * 1.7) * rotX(-0.5 + a * 0.1);

    // the camera orbits; a hand turns the cage toward itself
    float2 hand = ghostUp(U);
    float hz = U.ghostStrength > 0.05 ? U.ghostStrength : 0.0;
    float yaw = spin + a + hand.x / max(U.aspect, 1e-4) * hz * 1.2;
    float pit = 0.35 + 0.18 * sin(spin * 0.7) - hand.y * hz * 0.9;
    float3x3 cam = rotY(yaw) * rotX(pit) * rotY(0.52);
    float3 ro = cam * float3(0.0, 0.0, 3.3);
    float3 rd = cam * normalize(float3(p, -2.8));

    float3 col = float3(0.0);
    // one bounding sphere: most of the screen is void and pays nothing
    float bb = dot(ro, rd), cc = dot(ro, ro) - 1.21;
    float disc = bb * bb - cc;
    if (disc > 0.0) {
        float sq = sqrt(disc);
        float t = max(-bb - sq, 0.0), tEnd = -bb + sq;
        float trans = 1.0, side = 1.0;
        float3 warm = chordRamp(U, 0.12 + varA * 0.1);
        for (int i = 0; i < 96; i++) {
            float3 ps = ro + rd * t;
            float3 h = map(ps, G);
            float d = h.x * side;
            if (d < 0.0012) {
                float3 n = nrm(ps, G) * side;
                float cosi = clamp(-dot(rd, n), 0.0, 1.0);
                float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
                float3 refl = studio(U, reflect(rd, n));
                float depth = h.z;
                if (h.y > 0.5) {
                    // a bead: a lit glass marble, banded like cane
                    float band = pow(0.5 + 0.5 * sin(dot(n, normalize(float3(0.3, 1.0, 0.2))) * 9.0 + U.time * 0.6), 3.0);
                    float3 bc = chordRamp(U, 0.86 - depth * 0.30 + varA * 0.05);
                    float lit = 0.8 + beat * 0.6 + U.treble * 0.3;
                    float3 e = bc * (0.30 + 0.9 * band) * lit;
                    e = mix(e, float3(1.0), 0.35 * band * cosi * cosi);
                    col += trans * (e * (0.35 + 0.65 * cosi) + refl * F * 1.4 + bc * pow(1.0 - cosi, 3.0) * 0.5);
                    trans *= 0.45;
                } else {
                    // a rod: clear glass — the studio at the grazing edge, a whisper of tint
                    float3 tint = chordRamp(U, 0.78 - depth * 0.28);
                    float rim = pow(1.0 - cosi, 2.0);
                    col += trans * (refl * F * (side > 0.0 ? 1.3 : 0.8) + tint * (0.03 + rim * 0.30));
                    trans *= side > 0.0 ? 0.90 : 0.94;
                }
                side = -side;
                t += 0.004;
            } else {
                float st = max(d * 0.85, 0.004);
                // the warm core the frames fall toward
                float r2 = dot(ps, ps);
                col += trans * warm * (exp(-r2 * 30.0) * 2.2 + exp(-r2 * 6.0) * 0.25) * st * (1.0 + U.bass * 1.2);
                t += st;
            }
            if (t > tEnd || trans < 0.03) break;
        }
    }
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: GLASS ==== */
