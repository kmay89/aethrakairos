#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 14 — THE WORD: TELEGRAPH, SEMAPHORE, SCRIBE,
   CIPHER, BABEL. The language wing — writing before and beside
   meaning, all of it closed form.

   The telegraph quantizes the song's bars into dits and dahs on
   a punched tape; the semaphore spells by the real system's own
   logic (the alphabet as the ordered enumeration of arm pairs);
   the scribe's asemic hand lays deterministic strokes in musical
   time; the cipher turns a REAL dot-matrix alphabet — twenty-six
   5×7 glyphs packed bit by bit into two floats each — one detent
   per bar; and Babel falls forever down the hexagonal air shaft,
   shelf-light breathing with the live spectrum.

   Laws as ever: void ground, chord-only colour, govern_u() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 56 here).
   All symbols wear _u — a self-contained translation unit.
   ================================================================ */

constant float PI_U  = 3.14159265359;
constant float TAU_U = 6.28318530718;
constant float3 VOID_U = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

inline float3 govern_u(float3 c, float white) {
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
inline float hash21_u(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_u(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_u(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_u(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_u(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}


// ===============================================================
// TELEGRAPH — the song speaking morse: the bars quantized into
// dits and dahs on a punched tape, the lamp blooming as each
// mark passes the head; the beacon takes the message to sea.
// ===============================================================
static float markAt_u(float slot, float density, float seed) {
    float h = hash21_u(float2(slot, seed));
    if (h > density) return 0.0;
    return hash21_u(float2(slot, 9.7)) > 0.62 ? 2.0 : 1.0;    // 2 = dah, 1 = dit
}

fragment float4 room_telegraph(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_u(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_u(U);
        p += dh * (U.ghostStrength * 0.20 / (dot(dh, dh) + 0.30));   // the key pulls
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float seed = U.roll1 * 60.0;
    float density = 0.42 + U.energy * 0.3;
    float head = U.time * 1.2;
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE TAPE — tilted a hair, the way it comes off a real reel */
        float2 tp2 = float2(p.x * 0.9982 - p.y * 0.06, p.x * 0.06 + p.y * 0.9982);
        float y = tp2.y + 0.06;
        float slotW = 0.15;
        float slot = floor(head - (tp2.x - 0.30) / slotW);
        float sx = fract(head - (tp2.x - 0.30) / slotW);
        float m = markAt_u(slot, density, seed);
        float band = smoothstep(0.165, 0.150, abs(y));
        col += chordRamp_u(U, 0.55) * band * 0.045;
        col += chordRamp_u(U, 0.60) * (exp(-abs(abs(y) - 0.165) * 260.0)) * 0.28;
        float spro = exp(-pow((fract((tp2.x + head * slotW) / 0.075) - 0.5) * 7.0, 2.0));
        col += chordRamp_u(U, 0.62) * spro * (exp(-pow((abs(y) - 0.115) * 110.0, 2.0))) * 0.30;
        if (m > 0.5) {
            float len = m > 1.5 ? 0.82 : 0.30;
            float inMark = smoothstep(0.04, 0.10, sx) * smoothstep(len + 0.06, len, sx);
            col += chordRamp_u(U, 0.16 + m * 0.06) * inMark * exp(-pow(y * 24.0, 2.0)) * (0.75 + U.mid * 0.35);
        }
        float now = markAt_u(floor(head), density, seed);
        float on = now > 0.5 ? (now > 1.5 ? 1.0 : step(fract(head), 0.42)) : 0.0;
        col += chordRamp_u(U, 0.7) * exp(-abs(tp2.x - 0.30) * 70.0) * band * 0.20;
        float2 lampP = float2(0.30, 0.52);
        float dl = length(p - lampP);
        col += chordRamp_u(U, 0.12) * exp(-dl * dl / 0.0035) * (0.18 + on * (0.9 + U.onsetEnv * 0.4));
        col += chordRamp_u(U, 0.10) * exp(-dl * 2.6) * on * 0.30;
        col += chordRamp_u(U, 0.14) * exp(-abs(dl - fract(head) * 0.9) * 14.0) * on * 0.10;
        float2 gp = p - float2(-1.05, 0.42);
        float na = -0.55 + U.onsetEnv * 1.1;
        float2 nd = float2(sin(na), cos(na));
        float t2 = clamp(dot(gp, nd), 0.0, 0.20);
        col += chordRamp_u(U, 0.5) * exp(-length(gp - nd * t2) * 180.0) * 0.55;
        col += chordRamp_u(U, 0.55) * exp(-abs(length(gp) - 0.22) * 110.0) * smoothstep(-0.02, 0.20, gp.y) * 0.28;
    } else if (mode == 1) {
        /* THE BEACON — the same message, taken to sea */
        float now = markAt_u(floor(head), density, seed);
        float on = now > 0.5 ? (now > 1.5 ? 1.0 : step(fract(head), 0.42)) : 0.0;
        float horizon = -0.05;
        col += chordRamp_u(U, 0.60) * (0.035 + 0.05 * smoothstep(horizon, 1.0, p.y));
        float2 cell = floor((p + 6.0) * 14.0);
        if (hash21_u(cell) > 0.95 && p.y > horizon) {
            float2 fr = fract((p + 6.0) * 14.0) - 0.5;
            col += chordRamp_u(U, 0.66) * exp(-dot(fr, fr) * 900.0) * 0.35;
        }
        float2 lp = float2(-0.85, horizon + 0.62);
        float tw = 0.055 * (1.0 - (p.y - horizon) * 0.35);
        float tower = step(abs(p.x - lp.x), tw) * step(horizon - 0.04, p.y) * step(p.y, lp.y);
        col *= 1.0 - tower * 0.92;
        col += chordRamp_u(U, 0.30) * exp(-abs(abs(p.x - lp.x) - tw) * 120.0)
             * step(horizon - 0.04, p.y) * step(p.y, lp.y) * 0.16;
        float dl = length(p - lp);
        col += chordRamp_u(U, 0.10) * exp(-dl * dl / 0.0025) * (0.35 + on * 1.3);
        float ang = atan2(p.y - lp.y, p.x - lp.x);
        float beam = exp(-pow(ang / 0.10, 2.0)) * exp(-max(p.x - lp.x, 0.0) * 0.8);
        col += chordRamp_u(U, 0.14) * beam * on * step(lp.x, p.x) * 0.5;
        if (p.y < horizon) {
            float sw = sin(p.x * 14.0 + U.time * 1.2) * 0.5 + sin(p.x * 31.0 - U.time * 0.8) * 0.3;
            float lane = exp(-pow((p.x - lp.x - (horizon - p.y) * 0.15 * sw) * 6.0, 2.0));
            col += chordRamp_u(U, 0.12) * lane * on * exp((p.y - horizon) * 2.5) * 0.45;
            col += chordRamp_u(U, 0.58) * exp((p.y - horizon) * 4.0) * 0.05;
        }
        col += chordRamp_u(U, 0.62) * exp(-abs(p.y - horizon) * 120.0) * 0.18;
    } else {
        /* THE RECORDER — every bar a line of the roll, newest at the pen */
        float rows = 12.0;
        float row = floor((0.75 - p.y) / 1.1 * rows);
        float ry = fract((0.75 - p.y) / 1.1 * rows);
        if (row >= 0.0 && row < rows && abs(p.x) < U.aspect * 0.92) {
            float bar = floor(head / 8.0) - row;
            float slot = floor((p.x / (U.aspect * 0.92) * 0.5 + 0.5) * 8.0);
            float m = markAt_u(bar * 8.0 + slot, density, seed);
            float sx = fract((p.x / (U.aspect * 0.92) * 0.5 + 0.5) * 8.0);
            float len = m > 1.5 ? 0.8 : 0.3;
            float inMark = m > 0.5 ? smoothstep(0.05, 0.12, sx) * smoothstep(len + 0.05, len, sx) : 0.0;
            float pen = exp(-pow((ry - 0.5) * 5.0, 2.0));
            col += chordRamp_u(U, 0.2 + row * 0.02) * inMark * pen * (0.6 - row * 0.035)
                 * (1.0 + (row < 0.5 ? U.onsetEnv * 0.5 : 0.0));
            col += chordRamp_u(U, 0.55) * exp(-pow((ry - 0.5) * 12.0, 2.0)) * 0.03;
        }
    }
    col += (hash21_u(pos.xy) - 0.5) * 0.006;
    return float4(govern_u(VOID_U + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// SEMAPHORE — the signalman at dusk: two flags, eight positions,
// the alphabet as the ordered enumeration of arm pairs.
// ===============================================================
static float2 semPair_u(float n) {
    if (n < 7.0)  return float2(0.0, n + 1.0);
    if (n < 13.0) return float2(1.0, n - 5.0);
    if (n < 18.0) return float2(2.0, n - 10.0);
    if (n < 22.0) return float2(3.0, n - 14.0);
    if (n < 25.0) return float2(4.0, n - 17.0);
    return float2(5.0, 6.0);
}
static float armAng_u(float k) { return -1.5707963 + k * 0.7853982; }

static float3 signalman_u(constant VizUniforms& U, float2 p, float2 base,
                          float scale, float spell, float seed, float lit) {
    float3 col = float3(0.0);
    float2 q = (p - base) / scale;
    float n0 = floor(hash21_u(float2(floor(spell), seed)) * 26.0);
    float n1 = floor(hash21_u(float2(floor(spell) + 1.0, seed)) * 26.0);
    float tt = smoothstep(0.0, 0.30, fract(spell));
    float2 pr0 = semPair_u(n0), pr1 = semPair_u(n1);
    col += chordRamp_u(U, 0.30) * exp(-segd_u(q, float2(0.0, -0.60), float2(0.0, 0.15)) * 150.0) * 0.8;
    col += chordRamp_u(U, 0.30) * exp(-segd_u(q, float2(-0.16, -0.60), float2(0.16, -0.60)) * 150.0) * 0.5;
    col += chordRamp_u(U, 0.32) * exp(-length(q - float2(0.0, 0.24)) * 42.0) * 0.6;
    for (int arm = 0; arm < 2; arm++) {
        float k0 = arm == 0 ? pr0.x : pr0.y;
        float k1 = arm == 0 ? pr1.x : pr1.y;
        float a0 = armAng_u(k0), a1 = armAng_u(k1);
        float da = a1 - a0;
        if (da > PI_U) da -= TAU_U;
        if (da < -PI_U) da += TAU_U;
        float a = a0 + da * tt + sin(U.time * 3.0 + seed * 9.0) * 0.015;
        float mirror = arm == 0 ? -1.0 : 1.0;
        float2 dir = float2(cos(a) * mirror, sin(a));
        float2 sh = float2(mirror * 0.06, 0.10);
        float2 tip = sh + dir * 0.62;
        col += chordRamp_u(U, 0.34) * exp(-segd_u(q, sh, tip) * 150.0) * 0.8;
        float2 fx = tip + dir * 0.18;
        float cloth = segd_u(q, tip, fx + float2(-dir.y, dir.x)
                    * (0.13 + 0.04 * sin(U.time * 6.0 + q.y * 18.0 + seed * 5.0) * (0.4 + U.mid)));
        col += chordRamp_u(U, arm == 0 ? 0.12 : 0.72) * exp(-cloth * 60.0) * (0.7 + lit * 0.5 + U.onsetEnv * 0.25);
    }
    return col;
}

fragment float4 room_semaphore(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_u(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_u(U);
        p += float2(dh.y, -dh.x) * (U.ghostStrength * 0.14 / (dot(dh, dh) + 0.25));  // wind through the yard
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float seed = U.roll1 * 7.0;
    float spell = U.time * 0.3;
    float3 col = float3(0.0);
    bool night = mode == 2;
    float horizon = -0.25;
    col += chordRamp_u(U, night ? 0.62 : 0.14) * (night ? 0.03 : 0.05)
         * (1.0 - smoothstep(horizon, 1.0, p.y)) * 1.6;
    col += chordRamp_u(U, 0.58) * 0.03;
    if (night) {
        float2 cell = floor((p + 6.0) * 14.0);
        if (hash21_u(cell) > 0.94 && p.y > horizon) {
            float2 fr = fract((p + 6.0) * 14.0) - 0.5;
            col += chordRamp_u(U, 0.68) * exp(-dot(fr, fr) * 900.0) * 0.5;
        }
    }
    float ground = smoothstep(0.012, -0.012, p.y - horizon);
    col *= 1.0 - ground * 0.90;
    col += chordRamp_u(U, 0.30) * exp(-abs(p.y - horizon) * 130.0) * 0.2;
    if (mode == 1) {
        /* THE FLEET: stations answering down the coast, each a beat behind */
        col += signalman_u(U, p, float2(-0.72, 0.06), 0.85, spell, seed, 1.0);
        col += signalman_u(U, p, float2(0.28, 0.14), 0.5, spell - 1.0, seed, 0.7);
        col += signalman_u(U, p, float2(0.98, 0.20), 0.3, spell - 2.0, seed, 0.45);
    } else {
        col += signalman_u(U, p, float2(0.0, 0.08), 1.1, spell, seed, night ? 1.2 : 1.0);
        if (night) {
            float trail = exp(-fract(spell) * 3.0);
            col += chordRamp_u(U, 0.5) * exp(-abs(length(p - float2(0.0, 0.19)) - 0.71) * 30.0)
                 * trail * 0.10 * smoothstep(horizon, horizon + 1.2, p.y);
        }
    }
    col += (hash21_u(pos.xy) - 0.5) * 0.006;
    return float4(govern_u(VOID_U + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// SCRIBE — the hand that writes: asemic calligraphy laid down in
// musical time, deterministic in each stroke's own index.
// ===============================================================
static float3 stroke_u(constant VizUniforms& U, float2 p, float idx, float reveal,
                       float big, float seed, float inkT, float aspect) {
    float3 col = float3(0.0);
    float perLine = big > 0.5 ? 1.0 : 10.0;
    float lines = big > 0.5 ? 1.0 : 3.0;
    float li = floor(idx / perLine);
    float ci = fmod(idx, perLine);
    float2 base = big > 0.5 ? float2(0.0, -0.05)
                : float2((-0.80 + (ci + 0.5) * (1.60 / perLine)) * aspect, 0.50 - fmod(li, lines) * 0.36);
    float sc = big > 0.5 ? 0.55 : 0.085;
    float2 a = (float2(hash21_u(float2(idx, seed)), hash21_u(float2(idx, seed + 1.0))) - 0.5) * 2.0;
    float2 b = (float2(hash21_u(float2(idx, seed + 2.0)), hash21_u(float2(idx, seed + 3.0))) - 0.5) * 2.0;
    float2 c = (float2(hash21_u(float2(idx, seed + 4.0)), hash21_u(float2(idx, seed + 5.0))) - 0.5) * 2.0;
    c += (b - a) * 0.6;
    float2 prev = base + a * sc;
    float width = 90.0 / (0.6 + U.energy * 0.8);
    for (int s = 1; s < 9; s++) {
        float t = float(s) / 8.0;
        if (t > reveal) break;
        float2 q = mix(mix(a, b, t), mix(b, c, t), t);
        float2 pt = base + q * sc;
        float d = segd_u(p, prev, pt);
        float taper = 0.55 + 0.45 * sin(t * PI_U);
        col += chordRamp_u(U, inkT) * exp(-d * width / taper) * (big > 0.5 ? 0.62 : 0.42);
        prev = pt;
    }
    return col;
}

fragment float4 room_scribe(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_u(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_u(U);
        p += float2(dh.y, -dh.x) * (U.ghostStrength * 0.12 / (dot(dh, dh) + 0.25));  // a draught riffles the page
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    bool big = mode == 1;
    bool pal = mode == 2;
    float seed = U.roll1 * 40.0;
    float idxNow = U.time * (big ? 0.25 : 1.0) + 12.0 + U.roll2 * 16.0;   // mid-manuscript, always
    float3 col = float3(0.0);
    col += chordRamp_u(U, 0.58) * 0.035;
    float perPage = big ? 1.0 : 30.0;
    float pageNow = floor(idxNow / perPage);
    if (!big) {
        float lineY = fract((0.50 - p.y) / 0.36);
        col += chordRamp_u(U, 0.55) * exp(-pow((lineY - 0.72) * 60.0, 2.0)) * 0.05
             * step(abs(p.x), U.aspect * 0.86) * step(-0.35, p.y) * step(p.y, 0.60);
    }
    for (int w = 0; w < 34; w++) {
        float idx;
        if (big) {
            if (w > 5) break;
            idx = floor(idxNow) - float(w);
            if (idx < 0.0) break;
        } else {
            idx = pageNow * perPage + float(w);
            if (idx > idxNow) break;
        }
        float reveal = idx >= floor(idxNow) ? fract(idxNow) : 1.0;
        float fade = big ? 1.0 - float(w) * 0.13 : 1.0;
        col += stroke_u(U, p, idx, reveal, big ? 1.0 : 0.0, seed, 0.16 + fmod(idx, 7.0) * 0.02, U.aspect) * fade;
        if (pal) {
            col += stroke_u(U, p + float2(0.012, -0.008), idx - perPage, 1.0, 0.0, seed + 13.0, 0.60, U.aspect) * 0.35;
        }
    }
    // the nib: a bright point riding the newest stroke
    {
        float idx = floor(idxNow);
        float t = fract(idxNow);
        float perLine = big ? 1.0 : 10.0;
        float li = floor(idx / perLine);
        float ci = fmod(idx, perLine);
        float2 base = big ? float2(0.0, -0.05)
                  : float2((-0.80 + (ci + 0.5) * (1.60 / perLine)) * U.aspect, 0.50 - fmod(li, 3.0) * 0.36);
        float sc = big ? 0.55 : 0.085;
        float2 a = (float2(hash21_u(float2(idx, seed)), hash21_u(float2(idx, seed + 1.0))) - 0.5) * 2.0;
        float2 b = (float2(hash21_u(float2(idx, seed + 2.0)), hash21_u(float2(idx, seed + 3.0))) - 0.5) * 2.0;
        float2 c = (float2(hash21_u(float2(idx, seed + 4.0)), hash21_u(float2(idx, seed + 5.0))) - 0.5) * 2.0;
        c += (b - a) * 0.6;
        float2 q = mix(mix(a, b, t), mix(b, c, t), t);
        float2 nib = base + q * sc;
        float dn = length(p - nib);
        col += chordRamp_u(U, 0.08) * exp(-dn * dn / 0.00012) * (0.8 + U.onsetEnv * 0.6);
        col += chordRamp_u(U, 0.12) * exp(-dn * 30.0) * U.onsetEnv * 0.25;
    }
    col += (hash21_u(pos.xy) - 0.5) * 0.006;
    return float4(govern_u(VOID_U + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CIPHER — the wheel that keeps the secret: a real dot-matrix
// alphabet on turning rings, the shift clicking one detent a bar.
// ===============================================================
static float2 glyphBits_u(float li) {
    if (li < 0.5) return float2(1033774.0, 17969.0);
    else if (li < 1.5) return float2(1001022.0, 31281.0);
    else if (li < 2.5) return float2(541230.0, 14896.0);
    else if (li < 3.5) return float2(575068.0, 29265.0);
    else if (li < 4.5) return float2(999967.0, 32272.0);
    else if (li < 5.5) return float2(999967.0, 16912.0);
    else if (li < 6.5) return float2(770606.0, 15921.0);
    else if (li < 7.5) return float2(1033777.0, 17969.0);
    else if (li < 8.5) return float2(135310.0, 14468.0);
    else if (li < 9.5) return float2(67655.0, 12866.0);
    else if (li < 10.5) return float2(807505.0, 18004.0);
    else if (li < 11.5) return float2(541200.0, 32272.0);
    else if (li < 12.5) return float2(710513.0, 17969.0);
    else if (li < 13.5) return float2(644913.0, 17969.0);
    else if (li < 14.5) return float2(575022.0, 14897.0);
    else if (li < 15.5) return float2(1001022.0, 16912.0);
    else if (li < 16.5) return float2(575022.0, 13909.0);
    else if (li < 17.5) return float2(1001022.0, 18004.0);
    else if (li < 18.5) return float2(475663.0, 30753.0);
    else if (li < 19.5) return float2(135327.0, 4228.0);
    else if (li < 20.5) return float2(575025.0, 14897.0);
    else if (li < 21.5) return float2(575025.0, 4433.0);
    else if (li < 22.5) return float2(706097.0, 10933.0);
    else if (li < 23.5) return float2(141873.0, 17962.0);
    else if (li < 24.5) return float2(141873.0, 4228.0);
    else return float2(133183.0, 32264.0);
}
static float glyphPx_u(float li, float2 uv) {
    if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) return 0.0;
    float u = floor(uv.x * 5.0);
    float v = floor(uv.y * 7.0);
    float2 ab = glyphBits_u(li);
    float rowBits = v < 3.5 ? fmod(floor(ab.x / pow(32.0, v)), 32.0)
                            : fmod(floor(ab.y / pow(32.0, v - 4.0)), 32.0);
    return fmod(floor(rowBits / pow(2.0, 4.0 - u)), 2.0);
}
static float ringGlyph_u(float2 p, float li, float radius, float ang, float size) {
    float2 c = float2(cos(ang), sin(ang)) * radius;
    float2 q = p - c;
    float ca = cos(-(ang - 1.5707963)), sa = sin(-(ang - 1.5707963));
    q = float2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
    return glyphPx_u(li, q / size * float2(1.0, -1.0) / float2(0.72, 1.0) + float2(0.5, 0.5));
}

fragment float4 room_cipher(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_u(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_u(U);
        float sw = U.ghostStrength * 0.30 / (dot(dh, dh) + 0.22);
        p = float2(p.x - dh.y * sw, p.y + dh.x * sw);          // the hand turns the wheel
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    // the base shift stands in for the song's key; the dice deal it here,
    // the way the TV's rooms take their key-coloured judgements from rolls
    float baseShift = floor(U.roll2 * 12.0) + 1.0;
    float3 col = float3(0.0);
    float step26 = TAU_U / 26.0;
    float clickClock = U.time * 0.45;
    float click = floor(clickClock) + smoothstep(0.0, 0.22, fract(clickClock));
    float shift = baseShift + click;
    if (mode != 1) {
        /* THE WHEEL (and ROTORS: three of them, geared like an odometer) */
        bool rotors = mode == 2;
        float r = length(p);
        float th = atan2(p.y, p.x);
        int N = rotors ? 3 : 2;
        for (int ring = 0; ring < 3; ring++) {
            if (ring >= N) break;
            float rad = rotors ? 0.24 + float(ring) * 0.18 : (ring == 0 ? 0.40 : 0.62);
            float size = rotors ? 0.070 : 0.095;
            float turn = ring == 0 ? shift * step26
                       : (rotors ? floor(click / pow(26.0, float(ring))) * step26 : 0.0);
            float bright = 0.0;
            float k0 = floor((th - turn) / step26);
            for (int dk = -1; dk <= 1; dk++) {
                float k = fmod(k0 + float(dk) + 52.0, 26.0);
                float ang = (k + 0.5) * step26 + turn;
                bright += ringGlyph_u(p, k, rad, ang, size);
            }
            col += chordRamp_u(U, 0.22 + float(ring) * 0.18) * bright * (0.40 + U.mid * 0.25);
            col += chordRamp_u(U, 0.55) * exp(-abs(r - rad - size * 0.75) * 240.0) * 0.10;
            col += chordRamp_u(U, 0.55) * exp(-abs(r - rad + size * 0.75) * 240.0) * 0.10;
        }
        float ask = floor(hash21_u(float2(floor(clickClock * 4.0), varA * 30.0)) * 26.0);
        float angOut = (ask + 0.5) * step26;
        float angIn = (fmod(ask - shift + 52.0, 26.0) + 0.5) * step26 + shift * step26;
        float beamd = min(abs(fmod(th - angOut + PI_U + TAU_U, TAU_U) - PI_U),
                          abs(fmod(th - angIn + PI_U + TAU_U, TAU_U) - PI_U));
        col += chordRamp_u(U, 0.85) * exp(-beamd * 18.0) * exp(-abs(r - 0.51) * 4.0) * (0.14 + U.onsetEnv * 0.6);
        col += chordRamp_u(U, 0.10) * exp(-r * r / 0.002) * (0.5 + U.onsetEnv * 0.5);
    } else {
        /* THE RAIL FENCE: nothing substituted, everything out of ORDER */
        float rails = 3.0 + floor(varA * 2.0 + 0.5);
        float speed = clickClock * 1.2;
        for (int i = 0; i < 40; i++) {
            float fi = float(i);
            float x = U.aspect * 0.94 - fmod(fi * 0.19 + speed * 0.10, U.aspect * 1.9);
            float phase = fmod(fi, 2.0 * (rails - 1.0));
            float railIdx = phase < rails ? phase : 2.0 * (rails - 1.0) - phase;
            float y = 0.55 - railIdx * (0.75 / (rails - 1.0)) + 0.02 * sin(U.time + fi);
            float li = floor(hash21_u(float2(fi, varA * 20.0)) * 26.0);
            float2 q = (p - float2(x, y)) / 0.10 * float2(1.0, -1.0) / float2(0.72, 1.0) + float2(0.5, 0.5);
            col += chordRamp_u(U, 0.2 + railIdx * 0.12) * glyphPx_u(li, q) * (0.5 + U.treble * 0.3);
        }
        for (int rr = 0; rr < 5; rr++) {
            if (float(rr) >= rails) break;
            float y = 0.55 - float(rr) * (0.75 / (rails - 1.0));
            col += chordRamp_u(U, 0.55) * exp(-abs(p.y - y) * 200.0) * 0.06;
        }
    }
    col += (hash21_u(pos.xy) - 0.5) * 0.006;
    return float4(govern_u(VOID_U + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// BABEL — the library that contains everything: falling forever
// down the hexagonal air shaft, shelf-light breathing with the
// live spectrum, the corner lamps insufficient and continuous.
// ===============================================================
static float hexd_u(float2 q) {
    q = abs(q);
    return max(q.x * 0.866025 + q.y * 0.5, q.y);
}

fragment float4 room_babel(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_u(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_u(U);
        p += dh * (U.ghostStrength * -0.18 / (dot(dh, dh) + 0.30));   // the shaft pulls; a hand resists
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uFall = U.time * 0.22;
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE SHAFT — falling past gallery after gallery */
        float fall = fract(uFall);
        for (int k = 0; k < 8; k++) {
            float fk = float(k);
            float depth = fk - fall + 1.0;
            float s = pow(0.74, depth);
            float rot = (fmod(fk - floor(uFall) + 64.0, 2.0) < 0.5 ? 1.0 : -1.0) * 0.10 + U.time * 0.008;
            float ca = cos(rot), sa = sin(rot);
            float2 q = float2(p.x * ca - p.y * sa, p.x * sa + p.y * ca) / s;
            float hd = hexd_u(q);
            float floorIdx = floor(uFall) + fk;
            float ring = smoothstep(0.62, 0.66, hd) * smoothstep(1.02, 0.98, hd);
            if (ring > 0.0) {
                float ang = atan2(q.y, q.x);
                float slot = floor(ang * 34.0 / TAU_U + floorIdx * 7.0);
                float su = fract(ang * 34.0 / TAU_U + floorIdx * 7.0);
                float h = hash21_u(float2(slot, floorIdx));
                float bandE = spectrum.read(uint2(uint(fract(h * 0.61) * 63.0), 0)).r;
                float spine = smoothstep(0.12, 0.3, su) * smoothstep(0.88, 0.7, su);
                float shelf = smoothstep(0.3, 0.5, fract(hd * 9.0));
                col += chordRamp_u(U, 0.15 + h * 0.5) * ring * spine * shelf
                     * (0.05 + h * 0.10 + bandE * 0.5) * pow(0.72, depth) * 2.0;
            }
            col += chordRamp_u(U, 0.30) * exp(-abs(hd - 0.62) * 120.0) * pow(0.70, depth) * 0.5;
            for (int L = 0; L < 2; L++) {
                float la = (float(L) * PI_U) + floorIdx * 1.1;
                float2 lp = float2(cos(la), sin(la)) * 0.64;
                float dl = length(q - lp);
                col += chordRamp_u(U, 0.10) * exp(-dl * dl / 0.003) * pow(0.72, depth) * (0.5 + U.bass * 0.25);
            }
        }
        float bookT = fract(uFall * 0.5 + 0.31);
        float2 bp = float2(sin(floor(uFall * 0.5) * 5.7) * 0.3, 0.0);
        float bs = pow(0.74, bookT * 6.0);
        float db = length(p - bp * bs) - 0.012 * bs;
        col += chordRamp_u(U, 0.85) * exp(-max(db, 0.0) * 300.0 / bs) * bs * (0.4 + U.onsetEnv * 0.5);
        col *= smoothstep(0.0, 0.15, hexd_u(p));
    } else if (mode == 1) {
        /* THE GALLERY — one floor, walked past */
        float px = p.x + uFall * 0.35;
        for (int layer = 0; layer < 3; layer++) {
            float fl = float(layer);
            float depth = 1.0 + fl * 0.8;
            float x = px / depth;
            float rowH = 0.30 / (0.8 + fl * 0.4);
            float row = floor((p.y + 0.75) / rowH);
            float ry = fract((p.y + 0.75) / rowH);
            float slot = floor(x * (17.0 + fl * 8.0));
            float su = fract(x * (17.0 + fl * 8.0));
            float h = hash21_u(float2(slot, row + fl * 31.0));
            float bandE = spectrum.read(uint2(uint(fract(h * 0.61) * 63.0), 0)).r;
            float spine = smoothstep(0.10, 0.24, su) * smoothstep(0.92, 0.78, su);
            float books = smoothstep(0.06, 0.16, ry) * smoothstep(0.98, 0.88, ry);
            float lean = 0.9 + 0.1 * sin(slot * 3.0 + row);
            col += chordRamp_u(U, 0.12 + h * 0.55) * spine * books * lean
                 * (0.06 + h * 0.10 + bandE * 0.45) / (depth * depth) * step(p.y, 0.55 - fl * 0.1);
            col += chordRamp_u(U, 0.32) * exp(-pow((ry - 0.03) * 30.0, 2.0)) / (depth * depth) * 0.20
                 * step(p.y, 0.55 - fl * 0.1);
        }
        float2 lp = float2(0.25 * sin(U.time * 0.4), 0.72);
        float dl = length(p - lp);
        col += chordRamp_u(U, 0.10) * exp(-dl * dl / 0.004) * (0.8 + U.bass * 0.3);
        col += chordRamp_u(U, 0.12) * exp(-dl * 2.2) * 0.18;
    } else {
        /* THE INDEX — the wall of every page, flipping on the beat */
        float gx = floor((p.x / U.aspect * 0.5 + 0.5) * 22.0);
        float gy = floor((p.y * 0.5 + 0.5) * 13.0);
        float2 cu = float2(fract((p.x / U.aspect * 0.5 + 0.5) * 22.0), fract((p.y * 0.5 + 0.5) * 13.0));
        float flip = floor(uFall * 2.0 + hash21_u(float2(gx, gy)) * 4.0);
        float h = hash21_u(float2(gx * 7.0 + gy, flip));
        float u = floor(cu.x * 5.0), v = floor(cu.y * 7.0);
        float bit = step(0.5, hash21_u(float2(u + gx * 5.0, v + gy * 7.0 + flip * 13.0)));
        float margin = step(0.08, cu.x) * step(cu.x, 0.92) * step(0.10, cu.y) * step(cu.y, 0.90);
        col += chordRamp_u(U, 0.2 + h * 0.35) * bit * margin * (0.10 + h * 0.14 + U.treble * 0.18);
        float2 lampP = float2(sin(uFall * 0.7) * 0.8 * U.aspect, sin(uFall * 0.43 + 1.0) * 0.6);
        float dl = length(p - lampP);
        col *= 0.45 + 0.55 * exp(-dl * dl * 1.2);
        col += chordRamp_u(U, 0.10) * exp(-dl * dl / 0.01) * 0.30;
        if (gx == floor((lampP.x / U.aspect * 0.5 + 0.5) * 22.0) && gy == floor((lampP.y * 0.5 + 0.5) * 13.0)) {
            col += chordRamp_u(U, 0.85) * bit * margin * (0.4 + U.onsetEnv * 0.5);
        }
    }
    col += (hash21_u(pos.xy) - 0.5) * 0.006;
    return float4(govern_u(VOID_U + max(col, float3(0.0)), U.white), 1.0);
}
