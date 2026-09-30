#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 21 — THE ELASTIC COLLISION, IN SLOW MOTION: CAROM.

   Nothing is lost in an elastic collision: momentum and energy
   both come out exactly as they went in, and everything a ball
   does afterwards was decided in that one instant of contact.
   THE TABLE is a box of balls, watched in slow motion. On the web
   it is a live simulation, every impulse along the line of
   centres; here it is retold closed-form, as every room is: each
   ball a triangle wave of time off the walls — exact — and lit
   where two of them meet. THE LANES are rows of equal balls in
   one dimension, where the physics has a secret: equal masses
   that collide elastically simply exchange velocities, the same
   picture as passing straight through and swapping names — so
   every ball's whole future is a triangle wave, sorted. Exact
   and closed on both stages. THE CRADLE is Newton's: five hanging
   balls, one or two or three swung out, the momentum crossing the
   row in an instant and leaving as the same number of balls, each
   swing a pendulum at θ = θ₀ sin ωt.

   Laws as ever: void ground, chord-only colour, govern_o() at
   every exit, ghostStrength as the hand, roll0..2 the dice, every
   loop bounded by a compile-time literal (<= 16 here). All symbols
   wear _o — a self-contained translation unit.
   ================================================================ */

constant float PI_O  = 3.14159265359;
constant float TAU_O = 6.28318530718;
constant float3 VOID_O = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_o(float3 c, float white) {
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
// x², as a multiply: under fast math pow(x, 2.0) is NaN for x < 0, and one NaN voids the pixel
inline float sq_o(float x) { return x * x; }
inline float hash21_o(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_o(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_o(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_o(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_o(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
/* a ball bouncing between two walls is a triangle wave of time — exact, and it
   carries its own velocity sign: (position, velocity). mod is the floor kind. */
inline float2 fold_o(float x0, float v, float t, float a, float b) {
    float L = max(b - a, 1e-4);
    float u = x0 + v * t - a;
    u = u - floor(u / (2.0 * L)) * (2.0 * L);
    return u < L ? float2(a + u, v) : float2(b - (u - L), -v);
}
/* the streak behind a ball: where it was a moment ago — slow motion's signature */
inline void trail_o(float2 p, float2 c, float2 v, float r, float3 hue, float treble, thread float3& col) {
    float sp = length(v);
    if (sp < 0.03) return;
    float2 tail = c - v * (0.42 + 0.18 * treble);
    float d = segd_o(p, c, tail);
    float along = clamp(dot(p - c, tail - c) / max(dot(tail - c, tail - c), 1e-6), 0.0, 1.0);
    col += hue * exp(-d * d / (r * r * 0.45)) * (1.0 - along) * (1.0 - along) * 0.45;
}
/* the ball itself: a lit sphere, its glow, and the ring an impact throws */
inline void disc_o(float2 p, float2 c, float r, float hit, float3 hue, float bass, thread float3& col) {
    float2 d = p - c;
    float len = length(d), q = len / r;
    col += hue * exp(-sq_o(len - r) * 700.0) * (0.16 + bass * 0.16 + hit * 0.8) * step(r, len);
    float ring = r + (1.0 - hit) * 0.20;
    col += hue * exp(-sq_o(len - ring) * 5000.0) * hit * hit * 1.1;
    if (q < 1.02) {
        float3 n = float3(d / r, sqrt(max(1.0 - q * q, 0.0)));
        float3 L = normalize(float3(-0.45, 0.62, 0.64));
        float dif = max(0.0, dot(n, L));
        float spec = pow(max(0.0, dot(reflect(-L, n), float3(0.0, 0.0, 1.0))), 40.0);
        float edge = smoothstep(1.0, 0.95, q);
        float3 body = hue * (0.18 + 0.82 * dif) + spec * 0.6 + hue * hit * 0.5;
        col = mix(col, body, edge);
    }
}


// ===============================================================
// CAROM — the table, the lanes, the cradle.
// ===============================================================
fragment float4 room_carom(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_o(pos.xy, res, U.aspect);
    float2 hand = ghostUp_o(U);
    float hs = clamp(U.ghostStrength, 0.0, 1.0);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the dice deal the table, the lanes and the cradle; the web re-deals on every
    // entry, the TV holds one deal per visit — stateless, as every room here is
    float varA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    int deal = int(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float count = deal == 0 ? 8.0 : (deal == 1 ? 12.0 : 16.0);
    float laneN = 3.0 + floor(clamp(U.roll1, 0.0, 0.999) * 3.0);
    float swing = 1.0 + floor(clamp(U.roll2, 0.0, 0.999) * 3.0);
    float beat = U.onsetEnv;
    // slow time: the web stretches its clock with the music; the TV, stateless,
    // keeps one steady slow motion
    float simT = U.time * 0.55;
    float W = max(0.6, U.aspect - 0.08), H = 0.92;
    float3 col = float3(0.0);
    // the table's edge, faint — the walls that give every bounce back
    float edge = abs(max(abs(p.x) - W, abs(p.y) - H));
    col += chordRamp_o(U, 0.55) * exp(-edge * edge * 30000.0) * 0.10;
    if (mode == 0) {
        /* THE TABLE — retold: exact off the walls, lit where two balls meet */
        float2 c[16], v[16];
        float rr[16], hit[16];
        for (int i = 0; i < 16; i++) {
            float fi = float(i);
            float h1 = hash21_o(float2(fi * 3.7 + 1.3, varA * 11.0));
            float h2 = hash21_o(float2(fi * 5.1 + 2.9, varA * 7.0 + 3.0));
            float h3 = hash21_o(float2(varA * 5.0 + 0.7, fi * 2.3));
            float h4 = hash21_o(float2(fi + 0.5, varA + 0.25));
            float r = h4 < 0.33 ? 0.055 : (h4 < 0.66 ? 0.075 : 0.10);
            float sp = 0.42 + 0.30 * h3, an = h2 * TAU_O;
            float2 fx = fold_o(-W + r + h1 * 2.0 * (W - r), cos(an) * sp, simT, -W + r, W - r);
            float2 fy = fold_o(-H + r + fract(h1 * 7.3 + h2 * 3.1) * 2.0 * (H - r), sin(an) * sp, simT, -H + r, H - r);
            c[i] = float2(fx.x, fy.x); v[i] = float2(fx.y, fy.y); rr[i] = r;
            // the wall flashes: a ball at a wall is a ball that just struck it
            float wx = min(fx.x - (-W + r), (W - r) - fx.x), wy = min(fy.x - (-H + r), (H - r) - fy.x);
            hit[i] = max(exp(-sq_o(wx) * 900.0), exp(-sq_o(wy) * 900.0));
        }
        for (int i = 0; i < 16; i++) {
            if (float(i) >= count) break;
            for (int j = 0; j < 16; j++) {
                if (float(j) >= count || j == i) continue;
                float gap = length(c[i] - c[j]) - (rr[i] + rr[j]);
                hit[i] = max(hit[i], exp(-sq_o(max(gap, 0.0)) * 900.0));
            }
        }
        for (int i = 0; i < 16; i++) {
            if (float(i) >= count) break;
            trail_o(p, c[i], v[i], rr[i], chordRamp_o(U, fract(float(i) / count + varA)), U.treble, col);
        }
        for (int i = 0; i < 16; i++) {
            if (float(i) >= count) break;
            disc_o(p, c[i], rr[i], hit[i] * (0.7 + beat * 0.5), chordRamp_o(U, fract(float(i) / count + varA)), U.bass, col);
        }
        // the ghost's hand: a cushion, drawn where it rests
        if (hs > 0.05) {
            float dh = abs(length(p - hand) - 0.16);
            col += chordRamp_o(U, 0.85) * exp(-dh * dh * 3000.0) * hs * 0.5;
        }
    } else if (mode == 1) {
        /* THE LANES — equal masses exchange velocities: the triangle waves, sorted */
        float r = 0.075;
        float n = laneN;
        float a = -W + r, b = W - r - (n - 1.0) * 2.0 * r;
        for (int l = 0; l < 5; l++) {
            float fl = float(l);
            float y = (fl - 2.0) * 0.40;
            if (abs(p.y - y) > 0.30) continue;
            col += chordRamp_o(U, 0.55) * exp(-sq_o(p.y - y) * 40000.0) * step(abs(p.x), W) * 0.05;
            float2 g[5];
            for (int i = 0; i < 5; i++) {
                float fi = float(i);
                float h1 = hash21_o(float2(fl * 3.1 + fi * 7.7, varA * 13.0));
                float h2 = hash21_o(float2(fi * 5.3 + 1.7, fl * 9.1 + varA * 7.0));
                float h3 = hash21_o(float2(fl + 0.5, fi + varA));
                float x0 = a + h1 * (b - a);
                float vv = (0.22 + 0.34 * h2) * (h3 < 0.5 ? -1.0 : 1.0);
                g[i] = fold_o(x0, vv, simT, a, b);
            }
            // sort the ghosts by position: the ball at rank k is always ball k
            for (int i = 0; i < 4; i++)
                for (int j = 0; j < 4; j++) {
                    if (j < 4 - i) {
                        float2 A = g[j], B = g[j + 1];
                        if (float(j + 1) < n && A.x > B.x) { g[j] = B; g[j + 1] = A; }
                    }
                }
            for (int k = 0; k < 5; k++) {
                float fk = float(k);
                if (fk >= n) break;
                float2 c = float2(g[k].x + fk * 2.0 * r, y);
                trail_o(p, c, float2(g[k].y, 0.0), r, chordRamp_o(U, fract(fk / n + varA + fl * 0.13)), U.treble, col);
            }
            for (int k = 0; k < 5; k++) {
                float fk = float(k);
                if (fk >= n) break;
                // a contact is a ghost crossing: the gap to the neighbour closing to nothing
                float hit = 0.0;
                for (int j = 0; j < 5; j++) {
                    if (float(j) >= n) break;
                    float gap = abs(g[j].x - g[k].x);
                    if (j != k) hit = max(hit, exp(-gap * gap * 2500.0));
                }
                if (k == 0) hit = max(hit, exp(-sq_o(g[k].x - a) * 2500.0));
                if (fk == n - 1.0) hit = max(hit, exp(-sq_o(g[k].x - b) * 2500.0));
                float2 c = float2(g[k].x + fk * 2.0 * r, y);
                disc_o(p, c, r, hit * (0.7 + beat * 0.5), chordRamp_o(U, fract(fk / n + varA + fl * 0.13)), U.bass, col);
            }
        }
    } else {
        /* THE CRADLE — Newton's: the momentum crosses the row in an instant */
        float r = 0.11, L = 1.1, top = 0.82;
        float m = swing;
        float th0 = 0.40 + 0.20 * U.energy;
        float om = PI_O / 1.4;
        float ph = fract(simT * om / TAU_O) * TAU_O;
        float left = ph < PI_O ? -th0 * sin(ph) : 0.0;
        float right = ph < PI_O ? 0.0 : th0 * sin(ph - PI_O);
        float dleft = ph < PI_O ? -th0 * om * cos(ph) : 0.0;
        float dright = ph < PI_O ? 0.0 : th0 * om * cos(ph - PI_O);
        // the moment of transfer: a flash that crosses the row
        float near_ = min(ph, min(TAU_O - ph, abs(ph - PI_O)));
        float xfer = exp(-near_ * near_ * 60.0);
        col += chordRamp_o(U, 0.55) * exp(-sq_o(p.y - top) * 40000.0) * step(abs(p.x), 0.75) * 0.12;
        for (int k = 0; k < 5; k++) {
            float fk = float(k);
            float th = 0.0, dth = 0.0;
            if (fk < m) { th = left; dth = dleft; }
            if (fk > 4.0 - m) { th = th + right; dth = dth + dright; }
            float2 piv = float2((fk - 2.0) * 2.0 * r, top);
            float2 c = piv + L * float2(sin(th), -cos(th));
            float2 v = L * dth * float2(cos(th), sin(th));
            float ds = segd_o(p, piv, c);
            col += chordRamp_o(U, 0.55) * exp(-ds * ds * 60000.0) * 0.16;
            trail_o(p, c, v, r, chordRamp_o(U, fract(fk / 5.0 + varA)), U.treble, col);
        }
        for (int k = 0; k < 5; k++) {
            float fk = float(k);
            float th = 0.0;
            if (fk < m) th = left;
            if (fk > 4.0 - m) th = th + right;
            float2 piv = float2((fk - 2.0) * 2.0 * r, top);
            float2 c = piv + L * float2(sin(th), -cos(th));
            disc_o(p, c, r, xfer * (0.6 + beat * 0.5), chordRamp_o(U, fract(fk / 5.0 + varA)), U.bass, col);
        }
    }
    col += (hash21_o(pos.xy) - 0.5) * 0.006;
    return float4(govern_o(VOID_O + max(col, float3(0.0)), U.white), 1.0);
}
