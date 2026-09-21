#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 15 — THE ICONS: RAIN, TERRA, STOKES, ORBITALS, DNA.
   The images everyone half-knows, done honestly.

   The rain hides a raymarched form spoken only through which
   glyphs glow; Terra's continents are a real 64×32 landmask
   packed bit by bit (the cipher's trick, turned on geography);
   Navier–Stokes appears only where the unsolvable equation
   surrenders exactly (Taylor–Green, Lamb–Oseen, the linear
   Kelvin–Helmholtz mode); the orbitals are hydrogen's true
   wavefunctions with the nodes kept honest and the Balmer
   flares at RGB values computed from the web's own CIE fit;
   and the DNA is B-form to the letter — 10.5 pairs a turn,
   the grooves at their true unequal 2.27 radians.

   Laws as ever: void ground, chord-only colour, govern_v() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 56 here).
   All symbols wear _v — a self-contained translation unit.
   ================================================================ */

constant float PI_V  = 3.14159265359;
constant float TAU_V = 6.28318530718;
constant float3 VOID_V = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_v(float3 c, float white) {
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
inline float hash21_v(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_v(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_v(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_v(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_v(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float vnoise_v(float2 q) {
    float2 i = floor(q), f = fract(q);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21_v(i), hash21_v(i + float2(1.0, 0.0)), f.x),
               mix(hash21_v(i + float2(0.0, 1.0)), hash21_v(i + float2(1.0, 1.0)), f.x), f.y);
}
// the house's 5x7 alphabet, packed — same bytes as the cipher's
static float2 glyphBits_v(float li) {
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
static float glyphPx_v(float li, float2 uv) {
    if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) return 0.0;
    float u = floor(uv.x * 5.0);
    float v = floor(uv.y * 7.0);
    float2 ab = glyphBits_v(li);
    float rowBits = v < 3.5 ? fmod(floor(ab.x / pow(32.0, v)), 32.0)
                            : fmod(floor(ab.y / pow(32.0, v - 4.0)), 32.0);
    return fmod(floor(rowBits / pow(2.0, 4.0 - u)), 2.0);
}


// ===============================================================
// RAIN — the characters that dream in shapes: every column falls
// at its own band's speed, and the form behind is raymarched for
// real, spoken only through which drops glow.
// ===============================================================
static float sdf_v(float3 q, float kind) {
    if (kind < 0.5) {
        float3 d = abs(q) - float3(0.52);
        return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - 0.10;
    }
    float2 t = float2(length(q.xz) - 0.55, q.y);
    return length(t) - 0.24;
}
static float shade_v(float2 sp, float kind, float time, float varA) {
    float a = time * 0.21 + varA * 6.28, b = time * 0.13;
    float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
    float3 ro = float3(sp * 1.35, -2.4);
    float3 rd = normalize(float3(sp * 0.22, 1.0));
    float t = 0.8;
    for (int i = 0; i < 22; i++) {
        float3 q = ro + rd * t;
        q.xz = float2x2(float2(ca, sa), float2(-sa, ca)) * q.xz;
        q.yz = float2x2(float2(cb, sb), float2(-sb, cb)) * q.yz;
        float d = sdf_v(q, kind);
        if (d < 0.004 || t > 4.0) break;
        t += d * 0.9;
    }
    if (t > 4.0) return 0.0;
    float3 q = ro + rd * t;
    q.xz = float2x2(float2(ca, sa), float2(-sa, ca)) * q.xz;
    q.yz = float2x2(float2(cb, sb), float2(-sb, cb)) * q.yz;
    float2 e = float2(0.012, 0.0);
    float3 n = normalize(float3(
        sdf_v(q + e.xyy, kind) - sdf_v(q - e.xyy, kind),
        sdf_v(q + e.yxy, kind) - sdf_v(q - e.yxy, kind),
        sdf_v(q + e.yyx, kind) - sdf_v(q - e.yyx, kind)));
    float lam = max(dot(n, normalize(float3(-0.5, 0.8, -0.45))), 0.0);
    return 0.18 + lam * 0.9;
}

fragment float4 room_rain(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 r2 = max(res, float2(1.0));
    float2 uv = pos.xy / r2;                                // y down: rain falls with it
    float2 p = centeredUp_v(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_v(U);
        p += float2(0.0, sin(dh.x * 8.0)) * (U.ghostStrength * 0.05 / (dot(dh, dh) + 0.3));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float fall = U.time * 1.1;
    float cols = 46.0, rows = 26.0;
    float2 cell = float2(floor(uv.x * cols), floor(uv.y * rows));
    float2 cuv = float2(fract(uv.x * cols), fract(uv.y * rows));
    float band = spectrum.read(uint2(uint(clamp(cell.x / cols * 0.55 + 0.02, 0.0, 1.0) * 63.0), 0)).r;
    float sp = 0.25 + band * 1.9 + hash21_v(float2(cell.x, varA * 9.0)) * 0.35;
    float head = fract(hash21_v(float2(cell.x, 3.3)) * 7.0 - fall * sp * 0.16);
    float lag = fmod(head - uv.y + 2.0, 1.0);
    float trail = exp(-lag * (7.0 - U.energy * 2.5));
    float isHead = step(lag, 1.2 / rows);
    float li = floor(hash21_v(cell + floor(fall * (2.0 + hash21_v(cell) * 4.0))) * 26.0);
    float px = glyphPx_v(li, cuv / float2(0.78, 0.86) - float2(0.11, 0.06));
    float o = mode == 2 ? 0.0 : shade_v(p * (1.0 + U.bass * 0.04), float(mode), U.time, varA);
    float3 col = float3(0.0);
    col += chordRamp_v(U, 0.52 + hash21_v(cell + 7.0) * 0.14) * px * trail * (mode == 2 ? 0.55 : 0.30);
    col += chordRamp_v(U, 0.85) * px * isHead * (0.7 + U.onsetEnv * 0.5);
    col += chordRamp_v(U, 0.10) * px * o * (0.85 + U.onsetEnv * 0.25);
    col += chordRamp_v(U, 0.16) * px * o * o * 0.5;
    col += (hash21_v(pos.xy) - 0.5) * 0.006;
    return float4(govern_v(VOID_V + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// TERRA — the blue marble: a REAL 64×32 landmask, bit by bit,
// with the music's weather over it.
// ===============================================================
static float4 landRow_v(float r) {
    if (r < 0.5) return float4(0.0, 0.0, 0.0, 0.0);
    else if (r < 1.5) return float4(0.0, 480.0, 0.0, 0.0);
    else if (r < 2.5) return float4(0.0, 2032.0, 0.0, 28672.0);
    else if (r < 3.5) return float4(2047.0, 59376.0, 3103.0, 65520.0);
    else if (r < 4.5) return float4(16383.0, 62400.0, 8191.0, 65535.0);
    else if (r < 5.5) return float4(4095.0, 63488.0, 16383.0, 65520.0);
    else if (r < 6.5) return float4(255.0, 64513.0, 32767.0, 65520.0);
    else if (r < 7.5) return float4(63.0, 64512.0, 65535.0, 65472.0);
    else if (r < 8.5) return float4(63.0, 61443.0, 8191.0, 65280.0);
    else if (r < 9.5) return float4(63.0, 57345.0, 49919.0, 65152.0);
    else if (r < 10.5) return float4(31.0, 49155.0, 64767.0, 64512.0);
    else if (r < 11.5) return float4(6.0, 16387.0, 64575.0, 63488.0);
    else if (r < 12.5) return float4(0.0, 7.0, 65030.0, 61440.0);
    else if (r < 13.5) return float4(0.0, 7.0, 65026.0, 24576.0);
    else if (r < 14.5) return float4(0.0, 30727.0, 65408.0, 16384.0);
    else if (r < 15.5) return float4(0.0, 15872.0, 65280.0, 8192.0);
    else if (r < 16.5) return float4(0.0, 16256.0, 15872.0, 3968.0);
    else if (r < 17.5) return float4(0.0, 8128.0, 15872.0, 1536.0);
    else if (r < 18.5) return float4(0.0, 8064.0, 15872.0, 1984.0);
    else if (r < 19.5) return float4(0.0, 8064.0, 15488.0, 4032.0);
    else if (r < 20.5) return float4(0.0, 7936.0, 15360.0, 4064.0);
    else if (r < 21.5) return float4(0.0, 7680.0, 6144.0, 4064.0);
    else if (r < 22.5) return float4(0.0, 6144.0, 0.0, 64.0);
    else if (r < 23.5) return float4(0.0, 6144.0, 0.0, 0.0);
    else if (r < 24.5) return float4(0.0, 4096.0, 0.0, 0.0);
    else if (r < 25.5) return float4(0.0, 0.0, 0.0, 0.0);
    else if (r < 26.5) return float4(0.0, 0.0, 0.0, 0.0);
    else if (r < 27.5) return float4(0.0, 3072.0, 0.0, 0.0);
    else return float4(65535.0, 65535.0, 65535.0, 65535.0);
}
static float landBit_v(float c, float r) {
    if (r < 0.0) return 0.0;
    if (r > 31.0) return 1.0;
    float4 R = landRow_v(floor(r));
    float cc = fmod(c + 64.0, 64.0);
    float g = floor(cc / 16.0);
    float v = g < 0.5 ? R.x : (g < 1.5 ? R.y : (g < 2.5 ? R.z : R.w));
    return fmod(floor(v / pow(2.0, 15.0 - fmod(cc, 16.0))), 2.0);
}
static float landAt_v(float lon01, float lat01) {
    float c = lon01 * 64.0 - 0.5, r = lat01 * 32.0 - 0.5;
    float2 f = float2(fract(c), fract(r));
    float a = landBit_v(floor(c), floor(r)),       b = landBit_v(floor(c) + 1.0, floor(r));
    float d = landBit_v(floor(c), floor(r) + 1.0), e = landBit_v(floor(c) + 1.0, floor(r) + 1.0);
    return mix(mix(a, b, f.x), mix(d, e, f.x), f.y);
}

fragment float4 room_terra(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_v(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    bool night = mode == 1;
    bool storm = mode == 2;
    float R = storm ? 0.86 : 0.62;
    float2 c0 = float2(0.0, storm ? -0.25 : 0.02);
    if (U.ghostStrength > 0.05) p -= (ghostUp_v(U) - c0) * U.ghostStrength * 0.03;
    float2 q = p - c0;
    float rr = length(q);
    float3 col = float3(0.0);
    float2 cellS = floor((p + 7.0) * 16.0);
    if (hash21_v(cellS) > 0.94 && rr > R) {
        float2 fr = fract((p + 7.0) * 16.0) - 0.5;
        col += chordRamp_v(U, 0.66) * exp(-dot(fr, fr) * 800.0) * 0.45;
    }
    if (rr < R + 0.055) {
        float inside = smoothstep(R + 0.004, R - 0.004, rr);
        float3 n = float3(q / R, 0.0);
        n.z = sqrt(max(1.0 - dot(n.xy, n.xy), 0.0));
        float sunA = night ? 2.6 : (U.act * 0.25 - 0.45) * 1.9 + 0.15 * sin(U.time * 0.05);
        float3 sunDir = normalize(float3(sin(sunA), 0.20, cos(sunA)));
        float day = clamp(dot(n, sunDir), 0.0, 1.0);
        float lat = asin(clamp(n.y, -1.0, 1.0));
        float lon = atan2(n.x, n.z) + U.time * 0.08;
        float lon01 = fract(lon / TAU_V + 0.5);
        float lat01 = 0.5 - lat / PI_V;
        float land = landAt_v(lon01, lat01);
        float ice = smoothstep(0.78, 0.86, abs(lat) / 1.5707963);
        float3 sea = chordRamp_v(U, 0.60) * (0.035 + day * 0.30)
                   + chordRamp_v(U, 0.55) * pow(day, 6.0) * 0.30 * (1.0 - land);
        float3 dirt = mix(chordRamp_v(U, 0.30), chordRamp_v(U, 0.22), vnoise_v(float2(lon01 * 22.0, lat01 * 11.0)));
        float3 ground = dirt * (0.07 + day * 0.68);
        float3 surf = mix(sea, ground, smoothstep(0.35, 0.65, land));
        float coast = exp(-pow((land - 0.5) * 6.0, 2.0));
        surf += chordRamp_v(U, 0.45) * coast * (0.05 + day * 0.22);
        surf = mix(surf, chordRamp_v(U, 0.88) * (0.12 + day * 0.75), ice);
        float cl = vnoise_v(float2(lon01 * 9.0 + U.time * 0.010, lat01 * 5.0)) * 0.65
                 + vnoise_v(float2(lon01 * 21.0 - U.time * 0.016, lat01 * 12.0)) * 0.35;
        if (storm) {
            float2 sc = float2(fract(lon01 + 0.3) - 0.5, lat01 - 0.58) * float2(2.2, 1.4);
            float sr = length(sc) + 1e-4;
            float sa2 = atan2(sc.y, sc.x) + log(sr) * (3.2 + U.bass * 1.8) - U.time * 0.10;
            cl = max(cl, smoothstep(0.1, 0.9, sin(sa2 * 2.0) * 0.5 + 0.5) * exp(-sr * 5.5) * 1.4);
            cl *= 1.0 - exp(-sr * 40.0) * 0.9;
        }
        float cloud = smoothstep(0.52, 0.78, cl);
        surf *= 1.0 - cloud * 0.35 * day;
        float3 deck = chordRamp_v(U, 0.90) * cloud * (0.06 + day * 0.80);
        float dark = 1.0 - smoothstep(0.0, 0.12, day);
        float city = step(0.955, hash21_v(floor(float2(lon01 * 190.0, lat01 * 95.0)))) * step(0.5, land);
        col += chordRamp_v(U, 0.12) * city * dark * (1.0 - cloud) * 0.7 * inside;
        float2 stormCell = floor(float2(lon01 * 14.0, lat01 * 7.0));
        float bolt = step(0.90, hash21_v(stormCell + floor(U.time * 2.0))) * step(0.55, cloud) * dark;
        col += chordRamp_v(U, 0.95) * bolt * U.onsetEnv * inside * 1.4;
        float aur = smoothstep(0.68, 0.80, abs(lat) / 1.5707963) * (1.0 - smoothstep(0.80, 0.9, abs(lat) / 1.5707963));
        col += chordRamp_v(U, 0.45) * aur * dark * U.treble * (0.5 + 0.5 * sin(lon * 5.0 + U.time * 1.5)) * 0.5 * inside;
        col += (surf + deck) * inside;
        col += chordRamp_v(U, 0.55) * exp(-abs(rr - R) * 40.0) * (0.10 + day * 0.25);
    }
    col += (hash21_v(pos.xy) - 0.5) * 0.006;
    return float4(govern_v(VOID_V + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// STOKES — where the equation surrenders: the exact solutions
// only, the dye back-advected along them as filaments on void.
// ===============================================================
static float2 velTG_v(float2 q, float A) {
    return float2(cos(q.x) * sin(q.y), -sin(q.x) * cos(q.y)) * A;
}
static float2 velLO_v(float2 q, float core, float G) {
    float r2 = dot(q, q) + 1e-5;
    float vth = G / r2 * (1.0 - exp(-r2 / max(core, 1e-4)));
    return float2(-q.y, q.x) * vth;
}

fragment float4 room_stokes(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_v(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_v(U);
        float sw = U.ghostStrength * 0.35 / (dot(dh, dh) + 0.22);
        p = float2(p.x - dh.y * sw, p.y + dh.x * sw);        // the hand stirs — of course it stirs
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    // the TV's viscous clock breathes on its own patient cycle: the flow
    // dies its honest death and is quietly re-stirred
    float decay = 0.15 + 1.05 * (0.5 - 0.5 * cos(U.time * 0.10));
    float wind = U.time * 0.6;
    float3 col = float3(0.0);
    float A = exp(-2.0 * decay);
    if (mode == 0) {
        /* TAYLOR–GREEN */
        float2 q = p * 2.4 + float2(varA * 6.28);
        float2 x = q;
        for (int s = 0; s < 10; s++) x -= velTG_v(x, A) * 0.16;
        float dye = sin(x.x) * sin(x.y);
        float f1 = exp(-pow((dye - 0.55) * 5.0, 2.0));
        float f2 = exp(-pow((dye + 0.55) * 5.0, 2.0));
        float f3 = exp(-pow(sin(x.x * 3.0 + 1.3) - 0.8, 2.0) * 30.0);
        col += chordRamp_v(U, 0.30) * f1 * (0.28 + U.mid * 0.2);
        col += chordRamp_v(U, 0.48) * f2 * (0.24 + U.mid * 0.15);
        col += chordRamp_v(U, 0.62) * f3 * 0.16;
        float w = cos(q.x) * cos(q.y) * A;
        col += chordRamp_v(U, 0.12) * pow(max(w, 0.0), 3.0) * (0.5 + U.bass * 0.5);
        col += chordRamp_v(U, 0.75) * pow(max(-w, 0.0), 3.0) * (0.5 + U.bass * 0.5);
    } else if (mode == 1) {
        /* LAMB–OSEEN */
        float core = 0.02 + decay * 0.22;
        float G = 0.16 * (0.6 + U.energy * 0.7);
        float2 x = p;
        for (int s = 0; s < 12; s++) x -= velLO_v(x, core, G) * 3.5;
        float ang0 = atan2(x.y, x.x);
        float rr = length(p);
        float dye = sin(ang0 * 4.0 + varA * 6.28);
        float arm = exp(-pow((dye - 0.75) * 4.5, 2.0));
        float arm2 = exp(-pow((dye + 0.75) * 4.5, 2.0));
        float reach = smoothstep(1.5, 0.25, rr) * smoothstep(0.02, 0.14, rr);
        col += chordRamp_v(U, 0.30) * arm * reach * (0.42 + U.mid * 0.2);
        col += chordRamp_v(U, 0.52) * arm2 * reach * 0.30;
        col += chordRamp_v(U, 0.08) * exp(-dot(p, p) / max(core, 1e-3)) * (0.30 + U.onsetEnv * 0.35);
        col += chordRamp_v(U, 0.60) * exp(-abs(rr - sqrt(core) * 2.2) * 9.0) * 0.14;
    } else {
        /* KELVIN–HELMHOLTZ — the linear stage, on its own clock */
        float k = 4.4;
        float g = 0.05 + 0.85 * (1.0 - exp(-decay * 1.6));
        float xi = p.x * k - wind * 1.2;
        float eta = g * 0.22 * cos(xi);
        float2 lp = float2(p.x, p.y - eta);
        float roll2 = g * 1.6 * exp(-pow(p.y * 2.6, 2.0));
        float ca = cos(roll2 * sin(xi)), sa = sin(roll2 * sin(xi));
        lp = float2(lp.x * ca - lp.y * sa, lp.x * sa + lp.y * ca);
        float side = smoothstep(-0.05, 0.05, lp.y);
        col += mix(chordRamp_v(U, 0.18), chordRamp_v(U, 0.62), side) * 0.09 * exp(-abs(p.y) * 1.4);
        col += chordRamp_v(U, 0.85) * exp(-abs(lp.y) * (26.0 - g * 14.0)) * (0.35 + U.mid * 0.25);
        float streak = exp(-pow(sin(p.x * 15.0 + (p.y > eta ? wind * 3.0 : -wind * 3.0)) - 0.85, 2.0) * 20.0);
        col += chordRamp_v(U, 0.40) * streak * exp(-abs(p.y) * 2.2) * 0.14;
    }
    col += (hash21_v(pos.xy) - 0.5) * 0.006;
    return float4(govern_v(VOID_V + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// ORBITALS — hydrogen's true wavefunctions, the lobes coloured
// by the honest sign of psi, the Balmer flares at RGB values
// computed from the web's own CIE fit and carried verbatim.
// ===============================================================
static float psi_v(float3 q, float pick) {
    float r = length(q) + 1e-4;
    float ct = q.y / r;
    float st2 = sqrt(max(1.0 - ct * ct, 0.0));
    float ph = atan2(q.z, q.x);
    if (pick < 0.5)      return exp(-r * 2.2);                                        // 1s
    else if (pick < 1.5) return r * exp(-r * 1.15) * ct;                              // 2pz
    else if (pick < 2.5) return r * r * exp(-r * 0.85) * (3.0 * ct * ct - 1.0);       // 3dz2
    else if (pick < 3.5) return r * r * exp(-r * 0.85) * st2 * st2 * sin(2.0 * ph);   // 3dxy
    else if (pick < 4.5) return r * r * r * exp(-r * 0.66) * st2 * st2 * st2 * cos(3.0 * ph); // 4f
    return (1.0 - r * 1.1) * exp(-r * 1.1);                                           // 2s
}

fragment float4 room_orbitals(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_v(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_v(U);
        p -= dh * (U.ghostStrength * 0.18 / (dot(dh, dh) + 0.28));   // probability gathers
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float pick;
    if (mode == 1) {
        pick = floor(varA * 5.999);
    } else {
        // THE LADDER climbs with the story: s, p, d at the apex, f, home to 2s
        int act = int(clamp(U.act + 0.5, 0.0, 4.0));
        float dPick = sin(varA * 9.0) > 0.0 ? 3.0 : 2.0;
        pick = act == 0 ? 0.0 : (act == 1 ? 1.0 : (act == 2 ? dPick : (act == 3 ? 4.0 : 5.0)));
    }
    float a = U.time * 0.16 + varA * 6.28;
    float ca = cos(a), sa = sin(a);
    float ext = pick < 0.5 ? 1.4 : (pick < 1.5 ? 5.2 : (pick < 2.5 ? 9.0
              : (pick < 3.5 ? 9.0 : (pick < 4.5 ? 14.5 : 4.8))));
    float pk = pick < 0.5 ? 1.0 : (pick < 1.5 ? 0.104 : (pick < 2.5 ? 2.26
             : (pick < 3.5 ? 0.565 : (pick < 4.5 ? 22.1 : 1.0))));
    float accP = 0.0, accM = 0.0, shell = 0.0;
    for (int i = 0; i < 18; i++) {
        float z = ((float(i) + 0.5) / 18.0 * 2.0 - 1.0) * ext * 0.75;
        float3 q = float3(p * ext * 0.55, z);
        q.xz = float2x2(float2(ca, sa), float2(-sa, ca)) * q.xz;
        float ps = psi_v(q, pick);
        float d = ps * ps / pk;
        if (ps > 0.0) accP += d; else accM += d;
        shell = max(shell, exp(-abs(ps) / sqrt(pk) * 60.0) * min(d * 40.0, 1.0));
    }
    accP *= 0.55; accM *= 0.55;
    float3 col = float3(0.0);
    float dP = 1.0 - exp(-accP * 1.3);
    float dM = 1.0 - exp(-accM * 1.3);
    float skinP = exp(-pow((dP - 0.60) * 5.5, 2.0));
    float skinM = exp(-pow((dM - 0.60) * 5.5, 2.0));
    col += chordRamp_v(U, 0.12) * (skinP * 0.62 + dP * dP * 0.16) * (0.8 + U.mid * 0.2);
    col += chordRamp_v(U, 0.62) * (skinM * 0.62 + dM * dM * 0.16) * (0.8 + U.mid * 0.2);
    col *= 1.0 - shell * 0.35;
    col += chordRamp_v(U, 0.85) * exp(-dot(p, p) / 0.0004) * 0.9;
    if (mode == 2) {
        /* THE SERIES: the Balmer lines, their linear-sRGB taken from the
           web's own CIE machinery — the two stages cannot disagree */
        for (int L = 0; L < 4; L++) {
            float3 lc = L == 0 ? float3(0.5276, 0.0, 0.0)
                      : (L == 1 ? float3(0.0, 0.3087, 0.5785)
                      : (L == 2 ? float3(0.2129, 0.0, 1.7139) : float3(0.0543, 0.0, 0.2235)));
            float x0 = -U.aspect * 0.72 + float(L) * 0.17;
            float d = abs(p.x - x0);
            col += lc * exp(-d * 240.0) * smoothstep(-0.75, -0.2, p.y) * smoothstep(0.9, 0.0, p.y)
                 * (0.12 + U.onsetEnv * (L == 0 ? 0.9 : 0.5 - float(L) * 0.09));
        }
        float ring = exp(-abs(length(p) - fract(U.time * 0.9) * 1.5) * 10.0);
        col += float3(0.5276, 0.0, 0.0) * ring * U.onsetEnv * 0.30;
    }
    col += (hash21_v(pos.xy) - 0.5) * 0.006;
    return float4(govern_v(VOID_V + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// DNA — the code that writes its reader: B-form to the letter,
// the grooves at their true unequal angles, the wheel spelled
// in the house's own characters.
// ===============================================================
fragment float4 room_dna(float4 pos [[position]],
                         constant VizUniforms& U [[buffer(0)]],
                         constant float2& res [[buffer(1)]],
                         texture2d<float, access::read> spectrum [[texture(0)]],
                         texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_v(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_v(U);
        float sw = U.ghostStrength * 0.30 / (dot(dh, dh) + 0.22);
        p = float2(p.x - dh.y * sw, p.y + dh.x * sw);        // a hand twists the helix
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float scroll = U.time * 1.0;
    float fork = scroll + 6.0 * sin(scroll * 0.05);
    float3 col = float3(0.0);
    bool wheel = mode == 2;
    bool script = mode == 1;
    if (!wheel) {
        float RR = 0.30, rise = 0.075, dphi = TAU_V / 10.5, off = 2.27;
        float a = U.time * 0.30;
        float ca = cos(a), sa = sin(a);
        float gc = 0.30 + U.roll2 * 0.40;                    // the deal's own GC share
        for (int k = 0; k < 56; k++) {
            float fk = float(k) - 28.0;
            float bp = floor(scroll) + fk;
            float y = fk * rise + fract(scroll) * -rise;
            if (abs(y) > 1.25) continue;
            float ph = bp * dphi;
            float open2 = script ? exp(-pow((bp - fork) / 4.5, 2.0)) : 0.0;
            float R1 = RR * (1.0 + open2 * 0.8);
            float3 s1 = float3(cos(ph) * R1, y, sin(ph) * R1);
            float3 s2 = float3(cos(ph + off) * R1, y, sin(ph + off) * R1);
            s1.xz = float2x2(float2(ca, sa), float2(-sa, ca)) * s1.xz;
            s2.xz = float2x2(float2(ca, sa), float2(-sa, ca)) * s2.xz;
            float2 P1 = float2(s1.x, s1.y + s1.z * 0.10);
            float2 P2 = float2(s2.x, s2.y + s2.z * 0.10);
            float z1 = 0.6 + 0.4 * (s1.z * 0.5 + 0.5);
            float z2 = 0.6 + 0.4 * (s2.z * 0.5 + 0.5);
            float d1 = length(p - P1), d2 = length(p - P2);
            col += chordRamp_v(U, 0.34) * exp(-d1 * d1 / 0.00045) * z1 * 0.55;
            col += chordRamp_v(U, 0.40) * exp(-d2 * d2 / 0.00045) * z2 * 0.55;
            float isGC = step(hash21_v(float2(bp, varA * 30.0)), gc);
            if (open2 < 0.5) {
                float2 mid = (P1 + P2) * 0.5;
                float dr1 = segd_v(p, P1, mid), dr2 = segd_v(p, mid, P2);
                float3 c1 = isGC > 0.5 ? chordRamp_v(U, 0.14) : chordRamp_v(U, 0.58);
                float3 c2 = isGC > 0.5 ? chordRamp_v(U, 0.20) : chordRamp_v(U, 0.64);
                float w = (1.0 - open2) * min(z1, z2);
                float pulse = 1.0 + U.onsetEnv * exp(-pow((bp - fork) / 8.0, 2.0)) * 0.8;
                col += c1 * exp(-dr1 * dr1 / 0.00012) * 0.5 * w * pulse;
                col += c2 * exp(-dr2 * dr2 / 0.00012) * 0.5 * w * pulse;
            } else if (script) {
                float2 Pm = float2(P1.x * 0.4 - 0.22, P1.y + 0.16 + open2 * 0.12);
                float dm = length(p - Pm);
                col += chordRamp_v(U, 0.85) * exp(-dm * dm / 0.0003) * open2 * 0.8;
            }
        }
        if (script) {
            float phF = fork * dphi;
            float3 sF = float3(cos(phF) * RR, (fork - scroll) * -rise, sin(phF) * RR);
            sF.xz = float2x2(float2(ca, sa), float2(-sa, ca)) * sF.xz;
            float2 PF = float2(sF.x, sF.y + sF.z * 0.10);
            float dF = length(p - PF);
            col += chordRamp_v(U, 0.08) * exp(-dF * dF / 0.003) * (0.5 + U.onsetEnv * 0.4);
        }
    } else {
        /* THE CODON WHEEL — glyphs 0/2/6/20 of the alphabet spell A C G U */
        float r = length(p);
        float th = atan2(p.y, p.x);
        float codon = floor(fmod(scroll * 0.33, 64.0));
        float b1 = fmod(floor(codon / 16.0), 4.0);
        float b2 = fmod(floor(codon / 4.0), 4.0);
        for (int ring = 0; ring < 3; ring++) {
            float fr = float(ring);
            float N = fr < 0.5 ? 4.0 : (fr < 1.5 ? 16.0 : 64.0);
            float rad = 0.22 + fr * 0.20;
            float size = 0.10 - fr * 0.028;
            float sec = TAU_V / N;
            float k0 = floor(th / sec);
            for (int dk = -1; dk <= 1; dk++) {
                float k = fmod(k0 + float(dk) + N * 2.0, N);
                float ang = (k + 0.5) * sec;
                float base = fmod(k, 4.0);
                float li = base < 0.5 ? 0.0 : (base < 1.5 ? 2.0 : (base < 2.5 ? 6.0 : 20.0));
                float2 c = float2(cos(ang), sin(ang)) * rad;
                float2 qq = p - c;
                float rca = cos(-(ang - 1.5707963)), rsa = sin(-(ang - 1.5707963));
                qq = float2(qq.x * rca - qq.y * rsa, qq.x * rsa + qq.y * rca);
                float g = glyphPx_v(li, qq / size * float2(1.0, -1.0) / float2(0.72, 1.0) + float2(0.5, 0.5));
                float sel = fr < 0.5 ? step(abs(k - b1), 0.25)
                          : (fr < 1.5 ? step(abs(k - (b1 * 4.0 + b2)), 0.25) : step(abs(k - codon), 0.25));
                col += (sel > 0.5 ? chordRamp_v(U, 0.85) : chordRamp_v(U, 0.25 + fr * 0.15)) * g
                     * (sel > 0.5 ? 0.9 + U.onsetEnv * 0.4 : 0.30);
            }
            col += chordRamp_v(U, 0.55) * exp(-abs(r - rad - size * 0.8) * 240.0) * 0.08;
        }
        float angC = (codon + 0.5) * TAU_V / 64.0;
        float beamd = abs(fmod(th - angC + PI_V + TAU_V, TAU_V) - PI_V);
        col += chordRamp_v(U, 0.85) * exp(-beamd * 14.0) * exp(-abs(r - 0.45) * 3.0) * (0.10 + U.onsetEnv * 0.4);
        col += chordRamp_v(U, 0.10 + hash21_v(float2(codon, 4.4)) * 0.6) * exp(-r * r / 0.005) * 0.7;
    }
    col += (hash21_v(pos.xy) - 0.5) * 0.006;
    return float4(govern_v(VOID_V + max(col, float3(0.0)), U.white), 1.0);
}
