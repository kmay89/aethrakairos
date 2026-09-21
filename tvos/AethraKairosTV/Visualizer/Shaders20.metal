#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 17 — SPACETIME AND THE GAS: MINKOWSKI, BOLTZMANN.

   Minkowski draws the geometry under every clock: the light cone
   as the one absolute the theory keeps, the Lorentz boost as a
   real hyperbolic shear the invariant hyperbolae refuse to join,
   and the twins' two worldlines with proper time ticked honestly
   — tau = integral of sqrt(1 - v^2) dt, the traveller simply
   carrying fewer ticks. Boltzmann carries the only law with a
   direction: an exact ballistic gas folded specularly into its
   box, entropy measured from the real left-right occupancy
   inside the shader itself, the demon's sorting paid for in a
   ledger of bits at k ln 2 apiece, and the Maxwell-Boltzmann
   cloud breathing in velocity space with the song's energy as
   its temperature.

   Laws as ever: void ground, chord-only colour, govern_x() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 64 here).
   All symbols wear _x — a self-contained translation unit.
   ================================================================ */

constant float PI_X  = 3.14159265359;
constant float TAU_X = 6.28318530718;
constant float3 VOID_X = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
    // _pad1/_pad2 (132/136) carry the LENS pass's live fields and _pad3
    // (140) the song's Camelot number — no pad here is free to claim
};

inline float3 govern_x(float3 c, float white) {
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
inline float hash21_x(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_x(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_x(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_x(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_x(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
// ballistic flight folded into a box: exact specular reflections, no state
inline float foldR_x(float x, float R) {
    float m = fmod(x + R, 4.0 * R);
    if (m < 0.0) m += 4.0 * R;
    return abs(m - 2.0 * R) - R;
}


// ===============================================================
// MINKOWSKI — the geometry under every clock: the cone, the
// boost, and the twins with their honestly counted proper time.
// ===============================================================
fragment float4 room_minkowski(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_x(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_x(U);
        // a hand boosts the neighbourhood — an x–t shear, the only warp relativity owns
        float sh = U.ghostStrength * 0.14 / (dot(dh, dh) + 0.26);
        p = float2(p.x + dh.y * sh, p.y + dh.x * sh);
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    // the web eases these from the analyzer; the TV's stateless twins
    float boost = 0.25 + U.bass * 0.55;
    float now = U.time * (0.8 + U.energy * 0.6);
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE CONE — the absolute boundary: what an event may touch */
        float2 g = abs(fract(p * 2.5) - 0.5);
        col += chordRamp_x(U, 0.50) * exp(-min(g.x, g.y) * 40.0) * 0.05;
        float dc = abs(abs(p.y) - abs(p.x)) * 0.7071;
        col += chordRamp_x(U, 0.62) * exp(-dc * 80.0) * 0.35;
        float inside = step(abs(p.x), abs(p.y));
        float rr = exp(-length(p) * 0.8);
        col += chordRamp_x(U, 0.30) * inside * step(0.0, p.y) * 0.045 * rr;   // the future, faintly warm
        col += chordRamp_x(U, 0.15) * inside * step(p.y, 0.0) * 0.028 * rr;   // the past, dimmer still
        // the song's moments as events, each with its own little cone
        for (int i = 0; i < 8; i++) {
            float fi = float(i);
            float2 e = float2((hash21_x(float2(fi, varA * 7.0)) * 2.0 - 1.0) * U.aspect * 0.8,
                              hash21_x(float2(fi + 9.0, varA * 7.0)) * 1.4 - 0.7);
            float2 d = p - e;
            float amp = fi < 2.5 ? U.bass : (fi < 5.5 ? U.mid : U.treble);
            float cone = abs(abs(d.y) - abs(d.x)) * 0.7071;
            col += chordRamp_x(U, 0.15 + fi * 0.09) * exp(-cone * 110.0) * exp(-length(d) * 2.4) * (0.14 + amp * 0.5);
            col += chordRamp_x(U, 0.85) * exp(-dot(d, d) * 500.0) * (0.25 + amp * 0.7);
        }
        // a photon pair launched from the origin event, riding the edges at c
        float r = fract(now) * 1.3;
        for (int s = 0; s < 2; s++) {
            float2 ph = float2(s == 0 ? r : -r, r);
            col += chordRamp_x(U, 0.85) * exp(-dot(p - ph, p - ph) * 900.0) * (1.0 - fract(now)) * 0.8;
        }
        // and a WORLDLINE — Minkowski's own subject: a timelike path, its
        // slope everywhere inside the cone, an observer riding it with a
        // little cone of their own
        float wamp = 0.55, wfrq = 1.2;
        for (int i = 0; i < 24; i++) {
            float t0 = -1.0 + float(i) / 24.0 * 2.0;
            float t1 = -1.0 + float(i + 1) / 24.0 * 2.0;
            float2 A = float2(wamp * sin(t0 * wfrq + varA * TAU_X) / wfrq, t0);
            float2 B = float2(wamp * sin(t1 * wfrq + varA * TAU_X) / wfrq, t1);
            col += chordRamp_x(U, 0.45) * exp(-segd_x(p, A, B) * 130.0) * 0.45;
        }
        float tb = -1.0 + 2.0 * fract(now * 0.15);
        float2 bead = float2(wamp * sin(tb * wfrq + varA * TAU_X) / wfrq, tb);
        float2 db = p - bead;
        col += chordRamp_x(U, 0.85) * exp(-dot(db, db) * 700.0) * 0.9;
        float bcone = abs(abs(db.y) - abs(db.x)) * 0.7071;
        col += chordRamp_x(U, 0.70) * exp(-bcone * 130.0) * exp(-length(db) * 3.5) * 0.30;
    } else if (mode == 1) {
        /* THE BOOST — the grid shears, the hyperbolae refuse */
        float phi = boost;
        float ch = (exp(phi) + exp(-phi)) * 0.5, sh = (exp(phi) - exp(-phi)) * 0.5;
        float tb = p.y * ch - p.x * sh;
        float xb = p.x * ch - p.y * sh;
        float2 g = abs(fract(float2(xb, tb) * 2.2) - 0.5);
        col += chordRamp_x(U, 0.35) * exp(-min(g.x, g.y) * 45.0) * 0.30;   // the moving frame
        float2 g0 = abs(fract(p * 2.2) - 0.5);
        col += chordRamp_x(U, 0.55) * exp(-min(g0.x, g0.y) * 45.0) * 0.10; // the one it left behind
        // the invariants: t^2 - x^2 = ±s^2 — every observer agrees, so they hold still
        float s2 = p.y * p.y - p.x * p.x;
        for (int k = 1; k <= 3; k++) {
            float d = abs(abs(s2) - float(k) * 0.22);
            col += chordRamp_x(U, s2 > 0.0 ? 0.15 : 0.75) * exp(-d * 30.0) * 0.20;
        }
        // the boosted axes themselves: t' along x = vt, x' along t = vx —
        // simultaneity tilting toward the light, the whole of "relative"
        float vb = (exp(2.0 * phi) - 1.0) / (exp(2.0 * phi) + 1.0);
        float nrm = 1.0 / sqrt(1.0 + vb * vb);
        col += chordRamp_x(U, 0.30) * exp(-abs(p.x - p.y * vb) * nrm * 90.0) * 0.45;   // t' axis
        col += chordRamp_x(U, 0.75) * exp(-abs(p.y - p.x * vb) * nrm * 90.0) * 0.45;   // x' axis
        float dc = abs(abs(p.y) - abs(p.x)) * 0.7071;
        col += chordRamp_x(U, 0.85) * exp(-dc * 90.0) * 0.40;              // and the cone, invariant of invariants
    } else {
        /* THE TWINS — two roads between the same two events */
        float v = clamp((exp(2.0 * boost) - 1.0) / (exp(2.0 * boost) + 1.0), 0.30, 0.85);
        float gam = 1.0 / sqrt(1.0 - v * v);
        // the diagram rides high so the departure event clears the shelf
        float x0 = -0.12 * U.aspect;
        float yc0 = 0.15, H = 0.70;
        float dh2 = abs(p.x - x0);
        float online = step(abs(p.y - yc0), H);
        col += chordRamp_x(U, 0.30) * exp(-dh2 * 100.0) * online * 0.65;   // the one who stayed
        float2 A = float2(x0, yc0 - H), T = float2(x0 + v * H, yc0), B = float2(x0, yc0 + H);
        float dtrav = min(segd_x(p, A, T), segd_x(p, T, B));
        col += chordRamp_x(U, 0.62) * exp(-dtrav * 100.0) * 0.65;          // the one who went
        // proper time, ticked honestly: the traveller's ticks sit gamma times
        // farther apart in coordinate time — so between A and B there are fewer
        float dtau = 0.125;
        float ftH = abs(fract((p.y - yc0 + H) / dtau) - 0.5) * dtau;
        col += chordRamp_x(U, 0.85) * exp(-(dh2 * dh2 + ftH * ftH) * 4000.0) * online * 0.8;
        float sv = dtau * gam;
        float ftV = abs(fract((p.y - yc0 + H) / sv) - 0.5) * sv;
        col += chordRamp_x(U, 0.85) * exp(-(dtrav * dtrav + ftV * ftV) * 4000.0) * 0.8;
        // the sweeping now — simultaneity, the thing the twins can never share
        float nline = yc0 - H + fract(now * 0.10) * 2.0 * H;
        col += chordRamp_x(U, 0.55) * exp(-abs(p.y - nline) * 120.0) * 0.28;
        col += chordRamp_x(U, 0.85) * exp(-dot(p - A, p - A) * 700.0) * 0.8;
        col += chordRamp_x(U, 0.85) * exp(-dot(p - B, p - B) * 700.0) * 0.8;
    }
    col += (hash21_x(pos.xy) - 0.5) * 0.006;
    return float4(govern_x(VOID_X + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// BOLTZMANN — the arrow hidden in the counting: the box, the
// demon's ledger, and the heat that is only a width.
// ===============================================================
fragment float4 room_boltzmann(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_x(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_x(U);
        p += dh * (U.ghostStrength * 0.16 / (dot(dh, dh) + 0.27));      // a hand compresses the gas
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float gas = U.time * (0.6 + U.energy * 0.4);
    float temp = 0.35 + U.energy * 0.5;
    float3 col = float3(0.0);
    float Rx = 0.80 * U.aspect, Ry = 0.58;
    if (mode == 0) {
        /* THE BOX — the arrow of time, and Poincare's wink at the end */
        float tc = fmod(gas, 40.0);
        float left = 0.0;
        for (int i = 0; i < 64; i++) {
            float fi = float(i);
            float h1 = hash21_x(float2(fi, varA * 9.0));
            float h2 = hash21_x(float2(fi + 31.0, varA * 9.0));
            float h3 = hash21_x(float2(fi + 67.0, varA * 9.0));
            float h4 = hash21_x(float2(fi + 113.0, varA * 9.0));
            // everyone starts gathered in the left corner
            float2 p0 = float2(-Rx + h1 * Rx * 0.5, -Ry + h2 * Ry * 0.7);
            float sp = 0.10 + sqrt(-2.0 * log(h3 + 1e-4)) * 0.10;
            float2 vel = float2(cos(h4 * TAU_X), sin(h4 * TAU_X)) * sp;
            float2 q = float2(foldR_x(p0.x + vel.x * tc, Rx), foldR_x(p0.y + vel.y * tc, Ry));
            if (q.x < 0.0) left += 1.0;
            float2 d = p - q;
            col += chordRamp_x(U, 0.20 + h3 * 0.45) * exp(-dot(d, d) * 1400.0) * 0.65;
        }
        // the box itself
        float wall = min(min(abs(p.x - Rx), abs(p.x + Rx)) * step(abs(p.y), Ry + 0.01),
                         min(abs(p.y - Ry), abs(p.y + Ry)) * step(abs(p.x), Rx + 0.01));
        col += chordRamp_x(U, 0.55) * exp(-wall * 90.0) * 0.25;
        // the entropy meter, measured from the REAL occupancy just counted,
        // drawn inside the lid where nothing can hide it
        float fr = clamp(left / 64.0, 1e-4, 1.0 - 1e-4);
        float ent = -(fr * log(fr) + (1.0 - fr) * log(1.0 - fr)) / 0.6931472;
        float lit = step(-Rx + 0.04, p.x) * step(p.x, -Rx + 0.04 + ent * (2.0 * Rx - 0.08));
        col += chordRamp_x(U, 0.85) * lit * exp(-abs(p.y - Ry + 0.07) * 110.0) * 0.60;
    } else if (mode == 1) {
        /* THE DEMON — sorted heat, and the ledger that pays for it */
        for (int i = 0; i < 64; i++) {
            float fi = float(i);
            float h1 = hash21_x(float2(fi, varA * 9.0));
            float h2 = hash21_x(float2(fi + 31.0, varA * 9.0));
            float h3 = hash21_x(float2(fi + 67.0, varA * 9.0));
            float h4 = hash21_x(float2(fi + 113.0, varA * 9.0));
            bool hot = fi < 31.5;
            float Rh = Rx * 0.48;
            float cx = hot ? -Rx * 0.51 : Rx * 0.51;
            float sp = (hot ? 0.26 : 0.09) * (0.7 + h3 * 0.6);
            float2 vel = float2(cos(h4 * TAU_X), sin(h4 * TAU_X)) * sp;
            float2 p0 = float2((h1 * 2.0 - 1.0) * Rh, (h2 * 2.0 - 1.0) * Ry);
            float2 q = float2(cx + foldR_x(p0.x + vel.x * gas, Rh), foldR_x(p0.y + vel.y * gas, Ry));
            float2 d = p - q;
            // hot burns big and bright; cold sits small and dim — the sort made visible
            col += chordRamp_x(U, hot ? 0.10 : 0.65) * exp(-dot(d, d) * (hot ? 1100.0 : 2400.0)) * (hot ? 0.85 : 0.38);
        }
        // the wall, the demon at its gate, and the ledger along the lid —
        // one bit per decision, k ln 2 apiece
        col += chordRamp_x(U, 0.55) * exp(-abs(p.x) * 60.0) * step(abs(p.y), Ry) * 0.30;
        col += chordRamp_x(U, 0.85) * exp(-dot(p, p) * 300.0) * (0.4 + U.onsetEnv * 0.8);
        for (int b = 0; b < 16; b++) {
            float fb = float(b);
            float2 bp = float2(-0.30 + fb * 0.04, Ry - 0.08);
            float on = step(fb + 0.5, fmod(gas * 0.8, 17.0));
            float2 d = p - bp;
            col += chordRamp_x(U, 0.75) * exp(-dot(d, d) * 6000.0) * (0.10 + on * 0.55);
        }
    } else {
        /* THE HEAT — temperature is the width of this cloud, nothing else */
        float sig = 0.14 + temp * 0.22;
        for (int i = 0; i < 64; i++) {
            float fi = float(i);
            float h3 = hash21_x(float2(fi + 67.0, varA * 9.0));
            float h4 = hash21_x(float2(fi + 113.0, varA * 9.0));
            float h5 = hash21_x(float2(fi + 151.0, varA * 9.0));
            float sp = sqrt(-2.0 * log(h3 + 1e-4)) * sig;
            float ang = h4 * TAU_X + gas * (0.02 + h5 * 0.05);
            float2 q = float2(cos(ang), sin(ang)) * sp;
            q.x *= U.aspect * 0.9;
            float2 d = p - q;
            col += chordRamp_x(U, 0.15 + h3 * 0.55) * exp(-dot(d, d) * 1600.0) * 0.6;
        }
        // the axes of velocity space
        col += chordRamp_x(U, 0.50) * exp(-abs(p.x) * 200.0) * 0.10;
        col += chordRamp_x(U, 0.50) * exp(-abs(p.y) * 200.0) * 0.10;
        // the exact Maxwell-Boltzmann speed curve, drawn clear of the shelf
        float s = abs(p.x) / (U.aspect * 0.9);
        float fmb = (s / (sig * sig)) * exp(-s * s / (2.0 * sig * sig));
        float yc = -0.18 + fmb * sig * 0.50;
        col += chordRamp_x(U, 0.75) * exp(-abs(p.y - yc) * 70.0) * step(s, 1.2) * 0.50;
    }
    col += (hash21_x(pos.xy) - 0.5) * 0.006;
    return float4(govern_x(VOID_X + max(col, float3(0.0)), U.white), 1.0);
}
