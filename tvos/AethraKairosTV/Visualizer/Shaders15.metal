#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 12 — FLOW & KNOTS: KÁRMÁN, CAUSTICS, HOPF, KNOTS,
   BÉNARD. Motion and entanglement, all of it closed form.

   The vortex street is the honest streamfunction of the staggered
   rows (an infinite row of vortices sums to ln(cosh − cos));
   the pool light is the surface's true curvature, bright where
   the water's lens focuses; the Hopf fibration is sampled fiber
   by fiber and stereographically laid into nested tori; the
   torus knots are the (p, q) windings themselves; and Bénard's
   rolls are the linear convection modes with plumes riding the
   rising sheets on a hash schedule.

   Laws as ever: void ground, chord-only colour, govern_s() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 144 here).
   All symbols wear _s — a self-contained translation unit.
   ================================================================ */

constant float PI_S  = 3.14159265359;
constant float TAU_S = 6.28318530718;
constant float3 VOID_S = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_s(float3 c, float white) {
    /* INK, the web's law: the MAX CHANNEL rolls off on a soft knee and the
       whole triple is rescaled by that one factor, so hue and saturation
       survive any drive level. Light alone can no longer reach white —
       white must be SPENT, and `white` is the budget it is spent from. */
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
inline float hash21_s(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_s(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_s(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_s(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float3 chordRamp_s(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
// the slowly turning stage every 3D curve is projected through
inline float2 proj3_s(float3 w, float t) {
    float ry = t * 0.10, ca = cos(ry), sa = sin(ry);
    float x = w.x * ca + w.z * sa;
    float z = -w.x * sa + w.z * ca;
    return float2(x, w.y + z * 0.12);
}


// ===============================================================
// KÁRMÁN — the street the wake builds: two staggered rows of
// vortices in closed form (ln(cosh − cos) per row), contours as
// streamlines, the shedding clock on the music's own tempo.
// ===============================================================
static float street_s(float2 q, float ph, float gamma) {
    float k = TAU_S / 1.15;
    float h = 0.28;
    float upper = log(max(cosh(k * (q.y - h)) - cos(k * (q.x - ph)), 1e-4));
    float lower = log(max(cosh(k * (q.y + h)) - cos(k * (q.x - ph) + PI_S), 1e-4));
    return q.y * 1.05 - gamma * 0.16 * (upper - lower);
}

fragment float4 room_karman(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_s(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_s(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float phase = U.time * (0.40 + U.energy * 0.25);
    float gamma = 0.8 + U.bass * 0.7 + U.energy * 0.3;
    float2 cyl = float2(-U.aspect * 0.88, 0.0);
    float dc = length(p - cyl) - 0.17;
    float3 col = float3(0.0);
    float psi = street_s(p, phase, gamma);
    if (mode != 1) {
        float lines = mode == 2 ? 22.0 : 14.0;
        float band = abs(fract(psi * lines * 0.5) - 0.5) * 2.0;
        float g = exp(-pow(band, 2.0) * 40.0);
        float e2 = 0.012;
        float gx = street_s(p + float2(e2, 0.0), phase, gamma) - psi;
        float gy = street_s(p + float2(0.0, e2), phase, gamma) - psi;
        float speed = clamp(length(float2(gx, gy)) / e2 * 0.5 - 0.35, 0.0, 1.6);
        float3 ink = chordRamp_s(U, 0.26 + U.roll1 * 0.2 + clamp(psi * 0.22 + 0.5, 0.0, 1.0) * 0.25);
        col += ink * g * (0.10 + speed * (0.55 + U.mid * 0.3));
        col += chordRamp_s(U, 0.74 + U.roll1 * 0.15) * g * exp(-abs(psi) * 2.4) * (0.25 + U.onsetEnv * 0.35);
    } else {
        float dye = sin(psi * 9.0 + U.roll1 * TAU_S);
        float dye2 = sin(psi * 23.0 + 2.1);
        float v = smoothstep(0.2, 0.95, dye * 0.5 + 0.5);
        float3 ink = chordRamp_s(U, 0.22 + U.roll1 * 0.2 + v * 0.35);
        col += ink * v * (0.30 + U.mid * 0.25);
        col += chordRamp_s(U, 0.70 + U.roll1 * 0.18) * smoothstep(0.5, 0.98, dye2 * 0.5 + 0.5) * exp(-abs(psi) * 1.8) * 0.22;
    }
    col *= smoothstep(-0.02, 0.06, dc);
    col += chordRamp_s(U, 0.76 + U.roll1 * 0.14) * exp(-abs(dc) * 60.0) * (0.5 + U.onsetEnv * 0.4);
    col += (hash21_s(pos.xy) - 0.5) * 0.006;
    return float4(govern_s(VOID_S + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CAUSTICS — the light at the bottom of the pool: a sum of
// travelling waves the music drives, and the dancing net is the
// surface's true curvature — bright exactly where the lens of
// the water focuses. The onset drops a stone.
// ===============================================================
static float surf_s(float2 q, float t, float treble, float3 stone) {
    float h = 0.0;
    h += sin(dot(q, float2(1.7, 1.1)) * 2.3 + t * 1.10) * 0.50;
    h += sin(dot(q, float2(-1.2, 1.9)) * 3.1 + t * 1.45) * 0.34;
    h += sin(dot(q, float2(0.6, -2.3)) * 4.3 + t * 0.85) * 0.24;
    h += sin(dot(q, float2(2.9, 0.4)) * 5.9 + t * 1.9) * 0.14 * (1.0 + treble);
    float rd = length(q - stone.xy);
    float age = stone.z;
    h += sin((rd - age * 1.4) * 16.0) * exp(-abs(rd - age * 1.4) * 5.0) * exp(-age * 0.8) * 0.8;
    return h;
}

fragment float4 room_caustics(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_s(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_s(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the stone: a stateless rain of rings, one every few seconds, placed
    // by hash — the onset's energy hurries the clock
    float drop = floor(U.time / 4.5);
    float3 stone = float3((hash21_s(float2(drop, 3.7)) - 0.5) * 2.4,
                          (hash21_s(float2(drop, 8.1)) - 0.5) * 1.4,
                          fmod(U.time, 4.5));
    float zoom = mode == 1 ? 1.9 : 1.1;
    float2 q = p * zoom;
    float t = U.time * (0.55 + U.energy * 0.5);
    float e = 0.045;
    float h0 = surf_s(q, t, U.treble, stone);
    float hx = surf_s(q + float2(e, 0.0), t, U.treble, stone), hX = surf_s(q - float2(e, 0.0), t, U.treble, stone);
    float hy = surf_s(q + float2(0.0, e), t, U.treble, stone), hY = surf_s(q - float2(0.0, e), t, U.treble, stone);
    float lap = (hx + hX + hy + hY - 4.0 * h0) / (e * e);
    lap /= zoom * zoom;
    float focus = pow(clamp(-lap * 0.045 - 0.24, 0.0, 1.8), 1.9);
    float3 water = chordRamp_s(U, 0.30 + U.roll1 * 0.2);
    float3 lightC = chordRamp_s(U, 0.72 + U.roll1 * 0.15);
    float3 col = water * (mode == 2 ? 0.035 : 0.075);
    col += lightC * focus * (mode == 2 ? 0.45 : 0.62);
    col += lightC * clamp(-lap * 0.02, 0.0, 0.5) * 0.10;
    if (mode == 2) {
        float shaft = smoothstep(0.4, 1.0, sin(p.x * 3.0 + h0 * 1.4 + U.roll1 * 6.28) * 0.5 + 0.5);
        col += lightC * shaft * smoothstep(0.9, -0.6, p.y) * 0.10;
    }
    col += (hash21_s(pos.xy) - 0.5) * 0.006;
    return float4(govern_s(VOID_S + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// HOPF — the 3-sphere combed into circles, every pair linked
// exactly once. Nine fibers of the moving base ring, each a
// closed circle on S3, stereographically laid into nested tori
// and drawn as glowing polylines through the turning stage.
// ===============================================================
fragment float4 room_hopf(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_s(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float lat0 = mode == 0 ? 0.9 : (mode == 1 ? 1.05 : 0.45);
    float breathe = mode == 0 ? 0.65 : (mode == 1 ? 0.10 : 0.35);
    float lat = lat0 + sin(U.time * 0.21) * breathe;
    float a = cos(lat * 0.5), b = sin(lat * 0.5);
    float phase = U.time * (0.16 + U.bass * 0.35) + U.roll2 * TAU_S;
    float flow = fract(U.time * (0.08 + U.energy * 0.15));
    float3 col = float3(0.0);
    for (int fi = 0; fi < 9; fi++) {
        float f01 = float(fi) / 9.0;
        float lon = f01 * TAU_S + U.time * 0.05;
        float3 ink = chordRamp_s(U, fract(f01 + U.roll1));
        float2 prev = float2(0.0);
        for (int si = 0; si <= 36; si++) {
            float tf = float(si) / 36.0 * TAU_S;
            float x1 = a * cos(tf + phase), x2 = a * sin(tf + phase);
            float x3 = b * cos(tf + lon),   x4 = b * sin(tf + lon);
            float w = 1.0000001 - x4;
            float3 X = float3(x1 / w, x2 / w, x3 / w) * 0.42;
            float2 q = proj3_s(X, U.time);
            if (si > 0) {
                float dd = segd_s(p, prev, q);
                float tt = float(si) / 36.0;
                float head = fract(tt - flow - f01 * 0.31);
                float pulse = exp(-head * head * 200.0);
                float3 ink2 = mix(ink, chordRamp_s(U, 0.78 + U.roll1 * 0.1), pulse * 0.8);
                col += ink2 * exp(-dd * dd * 26000.0) * (0.30 + pulse * 0.9 + U.onsetEnv * 0.2);
                col += ink2 * exp(-dd * dd * 1200.0) * 0.012;
            }
            prev = q;
        }
    }
    col += (hash21_s(pos.xy) - 0.5) * 0.006;
    return float4(govern_s(VOID_S + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// KNOTS — wind a string p times around a torus and q times
// through it: coprime, it can never be untied. The (p, q)
// winding drawn as one glowing loop through the turning stage,
// the torus breathing on the bass, pulses running the string
// to prove it truly is one.
// ===============================================================
fragment float4 room_knots(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_s(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float pk = 2.0, qk = 3.0;
    if (mode == 1) { pk = 2.0; qk = 5.0; }
    else if (mode == 2) { pk = U.roll2 < 0.5 ? 3.0 : 4.0; qk = 5.0; }
    else {
        int pick = int(clamp(U.roll2 * 4.0, 0.0, 3.999));
        if (pick == 0) { pk = 2.0; qk = 3.0; } else if (pick == 1) { pk = 2.0; qk = 5.0; }
        else if (pick == 2) { pk = 3.0; qk = 4.0; } else { pk = 2.0; qk = 7.0; }
    }
    float R = 0.52;
    float r = (0.20 + U.bass * 0.10);
    float flow = fract(U.time * (0.10 + U.energy * 0.25));
    float3 col = float3(0.0);
    float2 prev = float2(0.0);
    for (int i = 0; i <= 144; i++) {
        float u = float(i) / 144.0 * TAU_S;
        float rr = R + r * cos(qk * u);
        float3 w = float3(rr * cos(pk * u), r * sin(qk * u), rr * sin(pk * u));
        // the stage leans so the knot's depth reads
        float tilt = 0.55 + sin(U.time * 0.17) * 0.25;
        float2 q = proj3_s(float3(w.x, w.y * cos(tilt) - w.z * sin(tilt), w.y * sin(tilt) + w.z * cos(tilt)), U.time * 2.2);
        if (i > 0) {
            float dd = segd_s(p, prev, q);
            float vT = float(i) / 144.0;
            float pulse = 0.0;
            for (int k = 0; k < 2; k++) {
                float head = fract(vT - flow - float(k) * 0.5);
                pulse += exp(-head * head * 500.0);
            }
            float3 ink = chordRamp_s(U, 0.20 + U.roll1 * 0.25 + vT * 0.40);
            ink = mix(ink, chordRamp_s(U, 0.76 + U.roll1 * 0.14), min(pulse, 1.0) * 0.9);
            col += ink * exp(-dd * dd * 24000.0) * (0.55 + pulse * 1.5 + U.onsetEnv * 0.3);
            col += ink * exp(-dd * dd * 900.0) * 0.030;
        }
        prev = q;
    }
    col += (hash21_s(pos.xy) - 0.5) * 0.006;
    return float4(govern_s(VOID_S + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// BÉNARD — heat the pan past Rayleigh's number and the fluid
// starts to ROLL: the honest linear modes as streamline arches,
// plumes riding the rising sheets on a hash schedule, the bass
// turning the burner up until the cells multiply.
// ===============================================================
fragment float4 room_benard(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_s(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_s(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float heat = 0.35 + U.bass * 0.55 + U.energy * 0.35;
    float cells = heat > 0.85 ? 5.0 : (heat > 0.55 ? 4.0 : 3.0);
    float aspect = max(U.aspect, 1e-4);
    float y01 = clamp(p.y / 1.6 + 0.5, 0.0, 1.0);
    float k = PI_S * cells / aspect;
    float psi = sin(p.x * k + U.roll1 * TAU_S) * sin(PI_S * y01);
    float theta = cos(p.x * k + U.roll1 * TAU_S) * sin(PI_S * y01);
    float T = (1.0 - y01) + theta * heat * 0.55;
    for (int j = 0; j < 5; j++) {
        float fj = float(j);
        float cellx = (fj + 0.5) / 5.0 * 2.0 - 1.0;
        float ph = fract(U.time * (0.10 + heat * 0.14) + hash21_s(float2(fj, floor(U.roll1 * 90.0))));
        float px2 = cellx * aspect + sin(U.time * 0.4 + fj) * 0.1;
        float py2 = -0.8 + ph * 1.6;
        float dpl = length((p - float2(px2, py2)) * float2(1.0, 0.75));
        float upHere = smoothstep(-0.2, 0.6, -cos(px2 * k + U.roll1 * TAU_S));
        T += exp(-dpl * dpl * 30.0) * (1.0 - ph) * upHere * heat * 0.8;
    }
    float3 cold = chordRamp_s(U, 0.26 + U.roll1 * 0.18);
    float3 hot = chordRamp_s(U, 0.72 + U.roll1 * 0.16);
    float3 col = cold * 0.10 + hot * pow(clamp(T, 0.0, 1.2) * 0.62, 1.5);
    if (mode < 2) {
        float lines = mode == 0 ? 9.0 : 5.0;
        float band = abs(fract(psi * lines * 0.5) - 0.5) * 2.0;
        col += chordRamp_s(U, 0.46 + U.roll1 * 0.2) * exp(-pow(band, 2.0) * 50.0) * (0.14 + abs(psi) * 0.30 + U.mid * 0.15);
    } else {
        float2 g = p * 4.6;
        float gr = sin(g.x * 2.1 + U.roll1 * 6.28) * sin(g.y * 2.3 + U.time * 0.3)
                 + 0.6 * sin((g.x + g.y) * 1.7 + U.time * 0.22)
                 + 0.35 * sin((g.x - g.y) * 3.1 + U.time * 0.4);
        float v = smoothstep(0.1, 1.2, gr + heat * 0.5);
        col = cold * 0.06 + hot * pow(v, 2.0) * 0.8;
        col += hot * pow(v, 6.0) * 0.5;
    }
    col += hot * exp(-pow(p.y + 0.82, 2.0) * 90.0) * (0.25 + U.bass * 0.35);
    col *= smoothstep(1.02, 0.86, abs(p.y / 0.86));
    col += (hash21_s(pos.xy) - 0.5) * 0.006;
    return float4(govern_s(VOID_S + max(col, float3(0.0)), U.white), 1.0);
}
