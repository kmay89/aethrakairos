#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 18 — THE PERFECT DECK: SHUFFLE.

   A perfect shuffle is not random at all: cut the deck exactly in
   half and interleave, and the card at position j lands at
   2j mod (N - 1). THE WEAVE draws that permutation as it happens,
   every card a thread, one shuffle a band — and after exactly
   eight out-shuffles a 52-card deck is home, because
   2^8 = 256 = 1 (mod 51) (32 cards take five, 64 take six).
   THE TRICK is Elmsley's binary: IN for every 1, OUT for every 0,
   and the top card lands at exactly k. THE ORBIT lays the deck on
   a circle, chords i -> 2^t i mod 51, walking the powers of two
   until every chord collapses to a point.

   Laws as ever: void ground, chord-only colour, govern_y() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (<= 64 here).
   All symbols wear _y — a self-contained translation unit.
   ================================================================ */

constant float PI_Y  = 3.14159265359;
constant float TAU_Y = 6.28318530718;
constant float3 VOID_Y = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_y(float3 c, float white) {
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
inline float hash21_y(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_y(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_y(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_y(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_y(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

// 2^s mod M, by doubling — exact in floats for every deck drawn here
inline float pow2mod_y(float s, float M) {
    float m = 1.0;
    for (int k = 0; k < 12; k++) {
        if (float(k) >= s) break;
        m = fmod(m * 2.0, M);
    }
    return m;
}
// one perfect OUT-shuffle: j -> 2j mod (N - 1), the bottom card stays
inline float outShuffle_y(float j, float N) { return j > N - 1.5 ? N - 1.0 : fmod(2.0 * j, N - 1.0); }
// one perfect IN-shuffle: j -> 2j + 1 mod (N + 1) — the top card goes in
inline float inShuffle_y(float j, float N) { return fmod(2.0 * j + 1.0, N + 1.0); }


// ===============================================================
// SHUFFLE — the perfect deck: the weave, the trick, the orbit.
// ===============================================================
fragment float4 room_shuffle(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_y(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_y(U);
        // a hand riffles the deck: the threads bow away from the thumb
        p.x += dh.x * U.ghostStrength * 0.12 / (dot(dh, dh) + 0.20);
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the dice deal the deck and the target; the web re-deals each cycle,
    // the TV holds one deal per visit — stateless, as every room here is
    int deck = int(clamp(U.roll1 * 4.0, 0.0, 3.999));
    float N = deck == 2 ? 32.0 : (deck == 3 ? 64.0 : 52.0);
    float ord = deck == 2 ? 5.0 : (deck == 3 ? 6.0 : 8.0);
    float k = 1.0 + floor(clamp(U.roll2, 0.0, 0.999) * 51.0);
    float L = floor(log2(k)) + 1.0;
    float beat = U.onsetEnv;
    float W = 0.80 * U.aspect;
    float Y0 = 0.68, Y1 = -0.60;
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE WEAVE — eight out-shuffles and the deck comes home */
        float M = N - 1.0;
        float prog = fmod(U.time * 0.45, ord + 2.2);
        float bh = (Y0 - Y1) / ord;
        float sf = (Y0 - p.y) / bh;
        float sb = floor(sf), f = sf - sb;
        float home = smoothstep(ord, ord + 0.35, prog);
        float pf = floor(prog), pr = prog - pf;
        if (sb >= 0.0 && sb < ord && abs(p.x) < W + 0.08) {
            float shown = sb < pf ? 1.0 : (sb < pf + 0.5 ? step(f, pr) : 0.0);
            float front = (sb > pf - 0.5 && sb < pf + 0.5) ? 1.0 : 0.0;
            float m = pow2mod_y(sb, M);
            float slopeK = 2.0 * W / M / bh;
            for (int i = 0; i < 64; i++) {
                float c = float(i);
                if (c > N - 0.5) break;
                float a = c > N - 1.5 ? M : fmod(c * m, M);
                float b = outShuffle_y(a, N);
                float xa = -W + 2.0 * W * a / M, xb = -W + 2.0 * W * b / M;
                float x = mix(xa, xb, f);
                float sl = (b - a) * slopeK;
                float d = abs(p.x - x) / sqrt(1.0 + sl * sl);
                float3 hue = chordRamp_y(U, c / N);
                col += hue * exp(-d * 520.0) * 0.40 * shown;
                float2 q = float2(mix(xa, xb, pr), Y0 - (sb + pr) * bh);
                col += hue * exp(-dot(p - q, p - q) * 9000.0) * front * (0.55 + beat * 0.6) * (1.0 - home);
                float2 ta = float2(xa, Y0 - sb * bh), tb = float2(xb, Y0 - (sb + 1.0) * bh);
                col += hue * exp(-dot(p - ta, p - ta) * 14000.0) * 0.55 * shown;
                col += hue * exp(-dot(p - tb, p - tb) * 14000.0) * 0.55 * shown * step(f, pr + step(sb + 0.5, pf));
            }
        }
        // the stage ticks down the right edge, lit as each shuffle lands
        for (int kk = 0; kk <= 12; kk++) {
            float fk = float(kk);
            if (fk > ord + 0.5) break;
            float2 t = float2(W + 0.07, Y0 - fk * bh);
            float lit = step(fk, prog + 0.001);
            col += chordRamp_y(U, 0.85) * exp(-dot(p - t, p - t) * 6000.0) * (0.12 + lit * 0.5);
        }
        // HOME: the bottom row is the top row again — the whole deck flares at once
        if (home > 0.0) {
            float dy = abs(p.y - Y1);
            for (int i = 0; i < 64; i++) {
                float c = float(i);
                if (c > N - 0.5) break;
                float x = -W + 2.0 * W * c / M;
                float2 d = float2(p.x - x, dy);
                col += chordRamp_y(U, c / N) * exp(-dot(d, d) * 5000.0) * home * (0.8 + beat * 0.6);
            }
            col += chordRamp_y(U, 0.85) * exp(-abs(p.y - Y1) * 60.0) * step(abs(p.x), W) * home * 0.10;
        }
    } else if (mode == 1) {
        /* THE TRICK — Elmsley's binary: IN for 1, OUT for 0, the top card lands at k */
        float NN = 52.0, M = 51.0;
        Y0 = 0.52; Y1 = -0.58;
        float cw = 2.0 * W / L;
        float prog = fmod(U.time * 0.45, L + 2.2);
        float sf = (p.x + W) / cw;
        float sb = floor(sf), f = sf - sb;
        float pf = floor(prog), pr = prog - pf;
        if (sb >= 0.0 && sb < L && p.y < Y0 + 0.02 && p.y > Y1 - 0.02) {
            float bit = fmod(floor(k / pow(2.0, L - 1.0 - sb)), 2.0);
            float shown = sb < pf ? 1.0 : (sb < pf + 0.5 ? step(f, pr) : 0.0);
            float slopeK = (Y0 - Y1) / M / cw;
            for (int i = 0; i < 52; i++) {
                float j = float(i);
                float nx = bit > 0.5 ? inShuffle_y(j, NN) : outShuffle_y(j, NN);
                float ya = Y0 - (Y0 - Y1) * j / M, yb = Y0 - (Y0 - Y1) * nx / M;
                float y = mix(ya, yb, f);
                float sl = (nx - j) * slopeK;
                float d = abs(p.y - y) / sqrt(1.0 + sl * sl);
                col += chordRamp_y(U, 0.30 + 0.35 * bit) * exp(-d * 460.0) * 0.16 * shown;
            }
            // the traced card: after s shuffles it sits at the first s binary digits of k
            float ts = floor(k / pow(2.0, L - sb));
            float tn = floor(k / pow(2.0, L - 1.0 - sb));
            float2 A = float2(-W + sb * cw, Y0 - (Y0 - Y1) * ts / M);
            float2 B = float2(-W + (sb + 1.0) * cw, Y0 - (Y0 - Y1) * tn / M);
            col += chordRamp_y(U, 0.85) * exp(-segd_y(p, A, B) * 260.0) * 0.85 * shown;
        }
        // the digits of k along the top: a full bead is IN (1), a ring is OUT (0)
        for (int b = 0; b < 6; b++) {
            float fb = float(b);
            if (fb > L - 0.5) break;
            float bit = fmod(floor(k / pow(2.0, L - 1.0 - fb)), 2.0);
            float2 c = float2(-W + (fb + 0.5) * cw, Y0 + 0.11);
            float r = length(p - c);
            float lit = step(fb, prog);
            col += chordRamp_y(U, 0.85) * (bit > 0.5 ? exp(-r * r * 3000.0) : exp(-abs(r - 0.028) * 300.0)) * (0.2 + lit * 0.6);
        }
        // the traveller riding its thread, and the ring waiting at k
        float pc = min(prog, L);
        float sc = min(floor(pc), L - 1.0), fc = pc - sc;
        float ts = floor(k / pow(2.0, L - sc)), tn = floor(k / pow(2.0, L - 1.0 - sc));
        float2 bead = float2(-W + (sc + fc) * cw, Y0 - (Y0 - Y1) * mix(ts, tn, fc) / M);
        col += chordRamp_y(U, 0.85) * exp(-dot(p - bead, p - bead) * 2500.0) * (0.9 + beat * 0.5);
        float2 goal = float2(W, Y0 - (Y0 - Y1) * k / M);
        float arrive = smoothstep(L - 0.05, L + 0.3, prog);
        col += chordRamp_y(U, 0.85) * exp(-abs(length(p - goal) - 0.045) * 220.0) * (0.25 + arrive * 0.8);
    } else {
        /* THE ORBIT — chords i -> 2^t i mod 51, walking the powers of two home */
        float M = 51.0;
        float prog = U.time * (0.16 + U.energy * 0.10);
        float t = floor(prog), u = smoothstep(0.15, 0.85, prog - t);
        float m0 = pow2mod_y(fmod(t, 8.0), M), m1 = pow2mod_y(fmod(t + 1.0, 8.0), M);
        float2 ctr = float2(0.0, 0.04);
        float R = 0.60;
        for (int i = 0; i < 51; i++) {
            float fi = float(i);
            float a = fi / M * TAU_Y + PI_Y * 0.5;
            float2 P = ctr + float2(cos(a), sin(a)) * R;
            float a0 = fmod(fi * m0, M) / M * TAU_Y + PI_Y * 0.5;
            float a1 = fmod(fi * m1, M) / M * TAU_Y + PI_Y * 0.5;
            float2 Q0 = ctr + float2(cos(a0), sin(a0)) * R;
            float2 Q1 = ctr + float2(cos(a1), sin(a1)) * R;
            float3 hue = chordRamp_y(U, fi / M);
            col += hue * exp(-segd_y(p, P, Q0) * 260.0) * 0.46 * (1.0 - u);
            col += hue * exp(-segd_y(p, P, Q1) * 260.0) * 0.46 * u;
            col += hue * exp(-dot(p - P, p - P) * 5000.0) * 0.6;
        }
        // home: when the power wraps to 2^8 = 256 = 1 (mod 51), the circle itself flares
        float homeNow = (fmod(t + 1.0, 8.0) < 0.5 ? u : 0.0) + (fmod(t, 8.0) < 0.5 ? 1.0 - u : 0.0);
        col += chordRamp_y(U, 0.85) * exp(-abs(length(p - ctr) - R) * 90.0) * homeNow * (0.35 + beat * 0.5);
    }
    col += (hash21_y(pos.xy) - 0.5) * 0.006;
    return float4(govern_y(VOID_Y + max(col, float3(0.0)), U.white), 1.0);
}
