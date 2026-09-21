#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 11 — THE NUMBER WING: ULAM, CARDIOID, COLLATZ,
   MEDIANT, ZETA. Arithmetic itself on stage, every theorem
   computed live, per pixel, per frame.

   ULAM addresses every cell of the square spiral in closed form
   and runs real trial division on it. CARDIOID draws the times
   table's chords and lets the envelope be the theorem. COLLATZ
   walks hero hailstone paths as curling turtles — the same 3n+1
   arithmetic, float-exact far past every visible seed. MEDIANT
   descends the Stern–Brocot tree beneath each pixel and draws
   Ford's kissing circles in honest isotropic units. ZETA sums
   n^(-1/2 - it) term by term and draws the walk; when it comes
   home, the line has a zero and the room holds its breath.

   Laws as ever: void ground, chord-only colour, govern_r() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 96 here).
   All symbols wear _r — a self-contained translation unit.
   ================================================================ */

constant float PI_R  = 3.14159265359;
constant float TAU_R = 6.28318530718;
constant float3 VOID_R = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_r(float3 c, float white) {
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
inline float hash21_r(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_r(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_r(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_r(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float3 chordRamp_r(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}


// ===============================================================
// ULAM — the primes have a shape. The square spiral's address
// book in closed form, real trial division per pixel, and the
// diagonals no one ordered appear. The beat sends a census wave
// out from 1; the energy leans the survey deeper.
// ===============================================================
static float ulamN_r(float2 c) {
    float r = max(abs(c.x), abs(c.y));
    if (r < 0.5) return 1.0;
    float s = (2.0 * r + 1.0); s = s * s;
    if (c.y <= -r + 0.5 && c.x > -r - 0.5) return s - (r - c.x);
    if (c.x <= -r + 0.5)                   return s - 2.0 * r - (c.y + r);
    if (c.y >= r - 0.5)                    return s - 4.0 * r - (r - c.x);
    return s - 6.0 * r - (r - c.y);
}
static float isPrime_r(float n) {
    if (n < 1.5) return 0.0;
    if (n < 3.5) return 1.0;
    if (fmod(n, 2.0) < 0.5) return 0.0;
    for (int d = 3; d <= 89; d += 2) {
        float fd = float(d);
        if (fd * fd > n) break;
        if (fmod(n, fd) < 0.5) return 0.0;
    }
    return 1.0;
}

fragment float4 room_ulam(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_r(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_r(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float S = 0.036 - min(0.009, U.energy * 0.012);
    float pulseR = fract(U.time * (0.35 + U.energy * 0.4));
    float3 col = float3(0.0);
    if (mode < 2) {
        float2 cell = floor(p / S + 0.5);
        float2 fc = p / S - cell;
        float n = ulamN_r(cell);
        float pr = isPrime_r(n);
        float d2 = dot(fc, fc);
        float R = length(cell) * S;
        float wave = exp(-pow(R - pulseR * 1.9, 2.0) * 60.0);
        float3 ink = chordRamp_r(U, 0.30 + U.roll1 * 0.2 + fract(n * 0.618034) * 0.12);
        col += ink * pr * exp(-d2 * 26.0) * (0.70 + wave * 1.2 + U.treble * 0.4);
        col += chordRamp_r(U, 0.20 + U.roll1 * 0.2) * (1.0 - pr) * exp(-d2 * 60.0) * (0.016 + wave * 0.05);
        if (mode == 1 && pr > 0.5) {
            float twin = max(isPrime_r(n - 2.0), isPrime_r(n + 2.0));
            col += chordRamp_r(U, 0.76 + U.roll1 * 0.14) * twin * exp(-d2 * 20.0) * (0.5 + U.onsetEnv * 0.5);
        }
        col += chordRamp_r(U, 0.78) * exp(-dot(p, p) * 800.0) * 0.5;
    } else {
        /* SACKS: one number per turn of an Archimedean spiral — squares
           line up, prime families bend into parabolas */
        float th01 = fract(atan2(p.y, p.x) / TAU_R);
        float R = length(p) / (S * 1.9);
        for (int j = -1; j <= 1; j++) {
            float rt = floor(R - th01 + 0.5 + float(j)) + th01;
            if (rt < 0.5) continue;
            float n = floor(rt * rt + 0.5);
            float pr = isPrime_r(n);
            float2 P = float2(cos(th01 * TAU_R), sin(th01 * TAU_R)) * rt * S * 1.9;
            float dd = dot(p - P, p - P);
            float wave = exp(-pow(rt * S * 1.9 - pulseR * 1.9, 2.0) * 60.0);
            col += chordRamp_r(U, 0.30 + U.roll1 * 0.2 + fract(n * 0.618034) * 0.12) * pr
                 * exp(-dd / (S * S) * 30.0) * (0.55 + wave * 1.2 + U.treble * 0.4);
            col += chordRamp_r(U, 0.20 + U.roll1 * 0.2) * (1.0 - pr) * exp(-dd / (S * S) * 55.0) * 0.028;
        }
    }
    col += (hash21_r(pos.xy) - 0.5) * 0.006;
    return float4(govern_r(VOID_R + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CARDIOID — multiplication, drawn: N points on a circle, every
// n joined to k·n mod N. The chords envelope a heart at two, a
// kidney at three, a rose beyond. The multiplier glides with
// the music and snaps onto the integers, where the shape
// resolves and rings true.
// ===============================================================
fragment float4 room_cardioid(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_r(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_r(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float lo = mode == 1 ? 2.0 : 2.0;
    float hi = mode == 0 ? 7.0 : (mode == 1 ? 3.0 : 13.0);
    float rate = mode == 0 ? 0.030 : (mode == 1 ? 0.008 : 0.055);
    float k = lo + fmod(U.time * (rate + U.energy * rate * 1.6) * 8.0 + U.roll2 * (hi - lo), hi - lo);
    float near = abs(k - round(k));
    float snap = exp(-near * near * 300.0);
    float R = 0.82;
    float3 col = float3(0.0);
    float r = length(p);
    col += chordRamp_r(U, 0.30 + U.roll1 * 0.2) * exp(-pow(abs(r - R), 2.0) * 5000.0) * 0.14;
    const float N = 96.0;
    for (int i = 0; i < 96; i++) {
        float n = float(i);
        float a0 = n / N * TAU_R - PI_R * 0.5;
        float a1 = fract(n * k / N) * TAU_R - PI_R * 0.5;
        float2 A = float2(cos(a0), sin(a0)) * R;
        float2 B = float2(cos(a1), sin(a1)) * R;
        float dd = segd_r(p, A, B);
        float g = exp(-dd * dd * 60000.0);
        col += chordRamp_r(U, 0.24 + U.roll1 * 0.2 + n / N * 0.28) * g * (0.075 + U.mid * 0.04 + snap * 0.06);
    }
    col += chordRamp_r(U, 0.76 + U.roll1 * 0.14) * snap * exp(-pow(abs(r - R * 0.6), 2.0) * 8.0) * 0.15;
    float th01 = fract((atan2(p.y, p.x) + PI_R * 0.5) / TAU_R);
    float fc = fract(th01 * N) - 0.5;
    float arc = fc * (TAU_R * R / N);
    float db = arc * arc + pow(abs(r - R), 2.0);
    col += chordRamp_r(U, 0.42 + U.roll1 * 0.2) * exp(-db * 30000.0) * 0.30;
    col += (hash21_r(pos.xy) - 0.5) * 0.006;
    return float4(govern_r(VOID_R + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// COLLATZ — the hailstone journey. Halve the evens, triple-and-
// add-one the odds: every number ever tried has fallen to 1 and
// nobody can prove they all must. The television follows two
// heroes at once — their paths drawn as curling turtles, turning
// one way on even steps and the other on odd, pulses running
// the length of the fall. The seeds redeal with the dice.
// ===============================================================
fragment float4 room_collatz(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_r(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float evenA = mode == 0 ? 0.225 : (mode == 1 ? 0.13 : 0.0);
    float oddA  = mode == 0 ? -0.45 : (mode == 1 ? -0.26 : 0.0);
    bool chart = mode == 2;
    float flow = fract(U.time * (0.06 + U.energy * 0.14));
    float3 col = float3(0.0);
    for (int hero = 0; hero < 2; hero++) {
        // an odd seed from the dice — famous wanderers live in this range
        float seed = 27.0 + floor((hero == 0 ? U.roll1 : U.roll2) * 4000.0) * 2.0 + 1.0;
        float n = seed;
        float2 q = chart ? float2(-1.55, -0.7 + log2(seed) * 0.09)
                         : float2(hero == 0 ? -0.45 : 0.45, -0.85);
        float th = PI_R * 0.5;
        float2 prev = q;
        float SC = chart ? 0.033 : 0.030;
        for (int i = 0; i < 96; i++) {
            if (n <= 1.0) break;
            bool odd = fmod(n, 2.0) > 0.5;
            n = odd ? 3.0 * n + 1.0 : n * 0.5;
            if (chart) {
                q = float2(q.x + 0.033, -0.7 + log2(max(n, 1.0)) * 0.09);
            } else {
                th += odd ? oddA : evenA;
                q += float2(cos(th), sin(th)) * SC;
            }
            float dd = segd_r(p, prev, q);
            float u = float(i) / 96.0;
            float head = fract(u - flow);
            float pulse = exp(-head * head * 300.0);
            float3 ink = chordRamp_r(U, 0.16 + U.roll1 * 0.2 + float(hero) * 0.4 + u * 0.10);
            ink = mix(ink, chordRamp_r(U, 0.76 + U.roll1 * 0.14), pulse * 0.85);
            col += ink * exp(-dd * dd * 34000.0) * (0.50 + pulse * 1.5 + U.onsetEnv * 0.3);
            col += ink * exp(-dd * dd * 1400.0) * 0.018;
            prev = q;
        }
        // the landing: 1, where every journey so far has ended
        float dl = length(p - prev);
        col += chordRamp_r(U, 0.76 + U.roll1 * 0.14) * exp(-dl * dl * 3000.0) * (0.5 + U.onsetEnv * 0.5);
    }
    col += (hash21_r(pos.xy) - 0.5) * 0.006;
    return float4(govern_r(VOID_R + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// MEDIANT — every fraction, exactly once. The Stern–Brocot tree
// descended beneath each pixel, Ford's circles drawn in honest
// isotropic units so they truly KISS; the golden ratio's road —
// always the mediant, never arriving — burns as the descent
// that cannot end.
// ===============================================================
fragment float4 room_mediant(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_r(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_r(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float depth = 7.0 + min(5.0, floor(U.treble * 4.0 + U.energy * 3.0));
    float SPAN = max(U.aspect, 1e-4) * 3.1;
    float x01 = p.x / SPAN + 0.5;
    float yy = (p.y + 0.66) / SPAN;
    float3 col = float3(0.0);
    col += chordRamp_r(U, 0.30 + U.roll1 * 0.2) * exp(-pow(p.y + 0.66, 2.0) * 9000.0) * 0.18;
    if (x01 > 0.0 && x01 < 1.0 && yy > -0.02) {
        float a = 0.0, b = 1.0, c = 1.0, d = 1.0;
        float goldT = fract(U.time * 0.2);
        for (int lvl = 0; lvl < 12; lvl++) {
            if (float(lvl) >= depth) break;
            float mq = b + d;
            float mp = a + c;
            float m = mp / mq;
            float rad = 0.5 / (mq * mq);
            float2 C = float2(m, rad);
            float dd = abs(length(float2(x01, yy) - C) - rad);
            float lw = 0.0026 + rad * 0.06;
            float glow = exp(-dd * dd / (lw * lw));
            float lvl01 = float(lvl) / 11.0;
            float3 ink = chordRamp_r(U, 0.18 + U.roll1 * 0.2 + lvl01 * 0.5);
            float breathe = 0.5 + 0.5 * cos(U.time * 0.7 + lvl01 * 5.0);
            col += ink * glow * (0.26 + breathe * 0.14 + U.mid * 0.18 * (1.0 - lvl01) + U.treble * 0.35 * lvl01);
            col += ink * exp(-dd * dd / (lw * lw * 36.0)) * 0.035;
            if (mode == 2) {
                float dphi = abs(m - 0.6180339887);
                col += chordRamp_r(U, 0.76 + U.roll1 * 0.14) * glow * exp(-dphi * dphi * 300.0 * mq) * (0.5 + goldT * 0.4);
            }
            if (x01 < m) { c = mp; d = mq; } else { a = mp; b = mq; }
        }
        if (mode == 1) {
            // THE KISSES: the tangencies as tiny suns
            float aa = 0.0, bb = 1.0, cc = 1.0, dn = 1.0;
            for (int lvl = 0; lvl < 10; lvl++) {
                float mq = bb + dn, mp = aa + cc;
                float m = mp / mq;
                float2 CL = float2(aa / bb, 0.5 / (bb * bb));
                float2 CM = float2(m, 0.5 / (mq * mq));
                float2 kiss = mix(CL, CM, bb * bb / (bb * bb + mq * mq));
                float dk = length(float2(x01, yy) - kiss);
                col += chordRamp_r(U, 0.72 + U.roll1 * 0.15) * exp(-dk * dk * 90000.0) * (0.5 + U.onsetEnv * 0.5);
                if (x01 < m) { cc = mp; dn = mq; } else { aa = mp; bb = mq; }
            }
        }
    }
    col += (hash21_r(pos.xy) - 0.5) * 0.006;
    return float4(govern_r(VOID_R + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// ZETA — the walk along the critical line: partial sums of
// zeta(1/2 + it) as a spiral staircase that circles, hesitates,
// and closes. When the walk comes home the line has a zero —
// exactly where the million-dollar sentence says every zero
// must stand. PRIME MUSIC keeps only Euler's terms.
// ===============================================================
static float isPrimeSmall_r(float n) {
    if (n < 1.5) return 0.0;
    if (n < 3.5) return 1.0;
    if (fmod(n, 2.0) < 0.5 || fmod(n, 3.0) < 0.5) return 0.0;
    if (n > 24.5 && fmod(n, 5.0) < 0.5) return 0.0;
    if (n > 48.5 && fmod(n, 7.0) < 0.5) return 0.0;
    return 1.0;
}

fragment float4 room_zeta(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_r(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_r(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    bool primesOnly = mode == 2;
    float rate = mode == 1 ? 0.9 : 0.16;
    float t = 20.0 + U.roll2 * 60.0 + U.time * rate * (1.0 + U.energy * 1.5);
    float2 zEnd = float2(0.0);
    for (int n = 1; n <= 72; n++) {
        float fn = float(n);
        if (primesOnly && isPrimeSmall_r(fn) < 0.5) continue;
        float amp = rsqrt(fn);
        float ph = -t * log(fn);
        zEnd += amp * float2(cos(ph), sin(ph));
    }
    float2 centre = zEnd * 0.5;
    float SC = 0.48;
    float3 col = float3(0.0);
    float2 z = float2(0.0);
    float2 prev = (z - centre) * SC;
    for (int n = 1; n <= 72; n++) {
        float fn = float(n);
        if (primesOnly && isPrimeSmall_r(fn) < 0.5) continue;
        float amp = rsqrt(fn);
        float ph = -t * log(fn);
        z += amp * float2(cos(ph), sin(ph));
        float2 q = (z - centre) * SC;
        float dd = segd_r(p, prev, q);
        float u = fn / 72.0;
        float3 ink = chordRamp_r(U, 0.18 + U.roll1 * 0.2 + u * 0.45);
        col += ink * exp(-dd * dd * 30000.0) * (0.80 - u * 0.30 + U.mid * 0.25);
        col += ink * exp(-dd * dd * 1600.0) * 0.035;
        prev = q;
    }
    float endD = length(zEnd);
    float zero = exp(-endD * endD * 3.0);
    float2 zq = (zEnd - centre) * SC;
    float dHome = length(p - zq);
    col += chordRamp_r(U, 0.76 + U.roll1 * 0.14) * exp(-dHome * dHome * 3000.0) * (0.7 + U.onsetEnv * 0.5 + zero * 1.6);
    float dOrigin = length(p + centre * SC);
    col += chordRamp_r(U, 0.72 + U.roll1 * 0.15) * exp(-dOrigin * dOrigin * 4000.0) * (0.25 + zero * 1.4);
    col += chordRamp_r(U, 0.78) * zero * exp(-dot(p, p) * 2.2) * 0.30;
    col += (hash21_r(pos.xy) - 0.5) * 0.006;
    return float4(govern_r(VOID_R + max(col, float3(0.0)), U.white), 1.0);
}
