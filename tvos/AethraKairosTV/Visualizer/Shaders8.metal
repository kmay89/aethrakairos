#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 6a — FEIGENBAUM, CHLADNI, AUTOMATON, EVENT HORIZON,
   FERROFLUID, GALTON. The first six rooms of the chaos wing, the
   Apple TV embodiments of the web player's scenes 42–47.

   The same laws as waves 1–5, and the same licence the ARCADE took:
   where the web room runs a CPU simulation, the television retells
   it CLOSED-FORM — no state, no history, every frame computed from
   the clock — because a Metal fragment owns nothing but its pixel.
   What is never retold loosely is the mathematics on display: the
   logistic map is iterated for real, the plate modes are the real
   eigenfunctions, Rule 90's rain is the real binomial parity, the
   photon geodesics really bend, the beads really binomial.

   - The ground is the void; colours come ONLY from the chord.
   - govern_h() holds WCAG 2.3.1 at every exit.
   - Spectrum by integer texel (the filterability law).
   - ghostStrength is the hand: the fader, the damping finger, the
     stylus, the doomed star, the magnet, the tilt.
   - roll0..2 deal each room's face on entry.
   - Every loop is bounded by a compile-time literal (≤ 64 here).
   All symbols wear _h — a self-contained translation unit.
   ================================================================ */

constant float PI_H  = 3.14159265359;
constant float TAU_H = 6.28318530718;
constant float3 VOID_H = float3(0.019608, 0.023529, 0.054902);

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

inline float lumaOf_h(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }
inline float3 govern_h(float3 c, float white) {
    /* INK, the web's law: the MAX CHANNEL rolls off on a soft knee and the
       whole triple is rescaled by that one factor, so hue and saturation
       survive any drive level. Light alone can no longer reach white —
       white must be SPENT, and `white` is the budget it is spent from
       (an 18x core at the floor, 2.2x at an earned apex). */
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
inline float hash11_h(float x) { return fract(sin(x * 12.9898) * 43758.5453123); }
inline float hash21_h(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float vnoise_h(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_h(i), b = hash21_h(i + float2(1.0, 0.0));
    float c = hash21_h(i + float2(0.0, 1.0)), d = hash21_h(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
inline float fbm2_h(float2 p) {
    return vnoise_h(p) * 0.62 + vnoise_h(p * 2.13 + float2(9.1, 3.7)) * 0.38;
}
inline float band64_h(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}
inline float2 centeredUp_h(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_h(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}


// ===============================================================
// FEIGENBAUM — the road to chaos. Every pixel column ITERATES the
// map at its own r: warm-up, then samples lighting the pixel by
// orbit proximity. The playhead is the music (the ghost hand takes
// the fader); the vertical ticks are the real bifurcation points,
// their shrinking gaps being 4.669… happening in front of you.
// ===============================================================
inline float mapStep_h(float x, float r, float mode) {
    if (mode < 0.5 || mode > 1.5) return r * x * (1.0 - x);
    return r * 0.125 * PI_H * sin(PI_H * x);
}
fragment float4 room_bifurc(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    uv.y = 1.0 - uv.y;
    float mode = U.roll0 < 0.6 ? 0.0 : (U.roll0 < 0.85 ? 1.0 : 2.0);
    float2 win = (mode > 1.5) ? float2(3.43, 3.60) : float2(2.80, 4.00);
    float2 ywin = (mode > 1.5) ? float2(0.28, 0.92) : float2(0.0, 1.0);
    float r = mix(win.x, win.y, uv.x);
    float y = mix(ywin.x, ywin.y, uv.y);
    float span = ywin.y - ywin.x;
    float x = 0.51;
    for (int i = 0; i < 60; i++) x = mapStep_h(x, r, mode);
    float w = 0.0, k = 900.0 / span;
    for (int i = 0; i < 48; i++) {
        x = mapStep_h(x, r, mode);
        float d = (x - y) * k;
        w += exp(-d * d);
    }
    w = 1.0 - exp(-w * 0.55);
    float3 col = mix(U.colB.rgb, U.colA.rgb, w) * w * (0.75 + U.energy * 0.35);
    // the ruler — the gaps between these are the constant
    if (mode < 1.5) {
        float ticks[5] = { 3.0, 3.44949, 3.54409, 3.56441, 3.56995 };
        float tk = 0.0;
        for (int i = 0; i < 5; i++) tk = max(tk, exp(-abs(r - ticks[i]) / (win.y - win.x) * 700.0));
        col += U.colA.rgb * tk * 0.14;
    }
    // the playhead: the music's place on the road; the ghost takes the fader
    float play = 0.12 + clamp(U.energy * 1.15, 0.0, 1.0) * 0.83;
    if (U.ghostStrength > 0.1) play = clamp(U.ghostX * 0.5 + 0.5, 0.02, 0.98);
    float dp = abs(uv.x - play);
    col += U.colA.rgb * exp(-dp * 90.0) * (0.10 + U.onsetEnv * 0.20);
    if (dp < 0.012) {
        float rp = mix(win.x, win.y, play);
        float xo = 0.51;
        for (int i = 0; i < 60; i++) xo = mapStep_h(xo, rp, mode);
        float wo = 0.0;
        for (int i = 0; i < 20; i++) {
            xo = mapStep_h(xo, rp, mode);
            float d2 = (xo - y) / span * 120.0;
            wo += exp(-d2 * d2);
        }
        col += mix(U.colA.rgb, float3(1.0), 0.5) * min(wo, 1.4) * exp(-dp * 300.0)
             * (0.7 + U.onsetEnv * 0.8 + U.treble * 0.4);
    }
    col += (hash21_h(pos.xy) - 0.5) * 0.008;
    return float4(govern_h(VOID_H + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CHLADNI — the sound made of sand. The LIVE SPECTRUM's centre of
// mass climbs a ladder of real plate eigenmodes; onsets strike the
// plate and the sand leaps; the ghost's finger forces a node the
// whole figure rearranges around.
// ===============================================================
inline float plate_h(float2 q, float m, float n, float roundP) {
    if (roundP < 0.5)
        return cos(m * PI_H * q.x) * cos(n * PI_H * q.y)
             - cos(n * PI_H * q.x) * cos(m * PI_H * q.y);
    float r = length(q) * 1.35, th = atan2(q.y, q.x);
    return cos(m * th) * cos(n * PI_H * r) * smoothstep(1.05, 0.95, r);
}
fragment float4 room_cymatic(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_h(pos.xy, res, U.aspect);
    float roundP = U.roll0 < 0.6 ? 0.0 : 1.0;
    float2 q = p / 0.92;
    float edge = (roundP < 0.5) ? max(abs(q.x), abs(q.y)) : length(q) * 1.35 / 1.05;
    float inPlate = 1.0 - smoothstep(0.98, 1.0, edge);
    // the spectrum's centre of mass picks the rung of the mode ladder
    float num = 0.0, den = 1e-4;
    for (int i = 0; i < 8; i++) {
        float b = band64_h(spectrum, (float(i) + 0.5) / 8.0);
        num += b * float(i); den += b;
    }
    float rung = clamp(num / den * 1.9 + U.roll1 * 3.0, 0.0, 12.0);
    float mA = 1.0 + floor(rung * 0.5), nA = 2.0 + floor(rung * 0.85);
    float mB = mA + 1.0, nB = nA + 2.0;
    float mixAB = smoothstep(0.3, 0.7, fract(rung));
    float psi = mix(plate_h(q, mA, nA, roundP), plate_h(q, mB, nB, roundP), mixAB);
    // the finger forces a node
    float hd = length(p - ghostUp_h(U));
    psi *= mix(1.0, min(hd * 2.2, 1.0), clamp(U.ghostStrength * 1.5, 0.0, 1.0));
    // sand gathers where the plate is still; the strike lifts it
    float shake = U.onsetEnv * 0.8;
    float grain = 0.55 + 0.45 * vnoise_h(q * 150.0 + floor(shake * 23.0));
    float sand = exp(-abs(psi) * (6.5 + U.mid * 3.0)) * grain;
    sand = mix(sand, vnoise_h(q * 60.0 + U.time * 9.0) * 0.55, shake * 0.6);
    float dust = step(0.985, hash21_h(floor(q * 130.0) + floor(U.time * 20.0))) * shake;
    float3 plateCol = U.colC.rgb * 0.05 * (0.8 + 0.2 * vnoise_h(q * 9.0 + U.roll2 * 31.0));
    plateCol += U.colB.rgb * abs(psi) * 0.030 * (0.5 + U.energy) * (0.85 + 0.15 * sin(U.time * 34.0));
    float3 sandCol = mix(U.colA.rgb, float3(1.0, 0.98, 0.92), 0.55);
    float3 col = plateCol + sandCol * sand * (0.55 + U.energy * 0.25 + U.onsetEnv * 0.15) + sandCol * dust * 0.8;
    col *= inPlate;
    float rim = smoothstep(0.985, 1.0, edge) * (1.0 - smoothstep(1.04, 1.08, edge));
    col += U.colB.rgb * rim * 0.22;
    col += (hash21_h(pos.xy) - 0.5) * 0.006;
    return float4(govern_h(VOID_H + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// AUTOMATON — Rule 90's rain, told closed-form: from a single seed
// the automaton IS binomial parity (C(g,k) is odd iff k's bits fit
// inside g's — Kummer knew), so the whole falling tape is computed
// from the clock, and several seeds XOR together exactly as the
// rule would have them. The head steps on the song's sixteenths.
// ===============================================================
inline float rule90_h(float colIx, float g, float seedCol) {
    // alive iff |dx| <= g, dx+g even, and C(g,(dx+g)/2) odd
    float dx = colIx - seedCol;
    if (abs(dx) > g) return 0.0;
    float kk = (dx + g) * 0.5;
    if (fract(kk) > 0.25) return 0.0;
    uint gu = (uint)g, ku = (uint)kk;
    return ((ku & ~gu) == 0u) ? 1.0 : 0.0;
}
fragment float4 room_rule(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    const float W = 160.0, ROWS = 96.0;
    float colIx = floor(uv.x * W);
    // the head steps on sixteenths of the phrase clock — the machine computes
    // on the song. gHead grows forever; each screen row is one generation.
    float gHead = floor(U.time * (5.0 + U.energy * 6.0)) + 200.0;
    float rowUp = floor((1.0 - uv.y) * ROWS);          // 0 at the bottom…
    float g = gHead - (ROWS - 1.0 - rowUp);            // …top row is the head
    if (g < 0.0) return float4(VOID_H, 1.0);
    // the seeds: dealt by the roll, plus one the phrase drops periodically —
    // Sierpinski triangles interfering, xor being xor
    float alive = 0.0;
    for (int s = 0; s < 4; s++) {
        float fs = float(s);
        float born = floor(fs * 137.0 + U.roll1 * 400.0);
        float sc = floor(hash11_h(fs * 7.3 + U.roll2 * 13.0) * W);
        float age = g - born * 0.35;
        if (age >= 0.0) alive += rule90_h(colIx, floor(age), sc);
    }
    // the ghost's stylus writes a live seed at its column
    if (U.ghostStrength > 0.1) {
        float sc = floor((clamp(U.ghostX, -1.0, 1.0) * 0.5 + 0.5) * W);
        float age = g - floor(gHead - 8.0);
        if (age >= 0.0) alive += rule90_h(colIx, floor(age), sc);
    }
    float cell = fmod(alive, 2.0);
    // soft square cells; the head row burns
    float2 cf = fract(float2(uv.x * W, (1.0 - uv.y) * ROWS)) - 0.5;
    float sq = (1.0 - smoothstep(0.34, 0.5, abs(cf.x))) * (1.0 - smoothstep(0.30, 0.5, abs(cf.y)));
    float age01 = (ROWS - 1.0 - rowUp) / ROWS;
    float3 cNew = U.colA.rgb, cOld = U.colB.rgb;
    float3 col = mix(cNew, cOld, clamp(age01 * 1.6, 0.0, 1.0)) * cell * sq
               * (0.9 - age01 * 0.62) * (0.8 + U.energy * 0.35);
    float headBand = exp(-abs(rowUp - (ROWS - 1.0)) * 0.8);
    col += mix(cNew, float3(1.0), 0.5) * headBand * cell * sq * (0.5 + U.onsetEnv * 0.8);
    col += cNew * headBand * 0.04;
    col += (hash21_h(pos.xy) - 0.5) * 0.008;
    return float4(govern_h(VOID_H + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// EVENT HORIZON — the light bent until it orbits. Per-pixel photon
// geodesics: −1.5·h²·r/|r|⁵, forty adaptive steps; the shadow, the
// photon ring, the disk imaged over and under itself, Keplerian
// shear, Doppler beaming, a hotspot flaring on the onsets. The
// ghost's star comes apart into a tidal stream. HEAVY.
// ===============================================================
inline float3 stars_h(float3 rd, constant VizUniforms& U) {
    float3 a = abs(rd);
    float2 su = (a.z >= a.x && a.z >= a.y) ? rd.xy / a.z : (a.x >= a.y ? rd.yz / a.x : rd.xz / a.y);
    su = su * 0.5 + 0.5;
    float2 cellId = floor(su * 220.0) + floor(rd.z * 3.0);
    float lum = pow(hash21_h(cellId), 42.0) * 1.8;
    float2 sp = float2(hash21_h(cellId + 3.1), hash21_h(cellId + 7.7));
    float d = length(fract(su * 220.0) - sp);
    float3 c = float3(lum) * exp(-d * d * 40.0) * (0.7 + 0.3 * hash21_h(cellId + 11.0));
    c += U.colB.rgb * vnoise_h(su * 5.0 + U.roll1 * 13.0) * 0.05;
    return c;
}
fragment float4 room_hole(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_h(pos.xy, res, U.aspect);
    float inc = (U.roll0 < 0.5 ? 1.38 : (U.roll0 < 0.8 ? 0.25 : 0.9)) + sin(U.time * 0.05) * 0.1;
    float ci = cos(inc), si = sin(inc);
    float3 ro = float3(0.0, 16.0 * ci, -16.0 * si);
    float3 fw = normalize(-ro);
    float3 rt = normalize(cross(float3(0.0, 0.0, 1.0), fw));
    float3 up = cross(fw, rt);
    float3 rd = normalize(fw * 1.7 + rt * p.x + up * p.y);
    float3 posr = ro, vel = rd;
    float3 hv = cross(posr, vel);
    float h2 = dot(hv, hv);
    float3 col = float3(0.0);
    float through = 1.0;
    bool captured = false;
    float hot = U.time * (0.9 + U.energy * 0.8);
    float flare = 0.12 + U.energy * 0.2 + U.onsetEnv * 0.9;
    for (int i = 0; i < 40; i++) {
        float r2 = dot(posr, posr);
        float r1 = sqrt(r2);
        float dt2 = clamp(r1 * 0.11, 0.045, 0.42);
        vel += (-1.5 * h2 * posr / (r2 * r2 * r1)) * dt2;
        float3 nposr = posr + vel * dt2;
        if (posr.z * nposr.z < 0.0 && through > 0.01) {
            float tt = posr.z / (posr.z - nposr.z);
            float3 hit = mix(posr, nposr, tt);
            float hr = length(hit.xy);
            if (hr > 2.6 && hr < 9.0) {
                float ang = atan2(hit.y, hit.x);
                float om = 5.2 / (hr * sqrt(hr));
                float tex = vnoise_h(float2(ang * 3.0 - om * U.time * 2.0, hr * 2.2) + U.roll1 * 17.0) * 0.65
                          + vnoise_h(float2(ang * 9.0 - om * U.time * 4.5, hr * 5.0)) * 0.35;
                float bright = 5.5 / (hr * hr) * (0.35 + tex * 0.9) * (0.55 + U.energy * 0.6);
                float dop = sin(ang) * (1.1 / sqrt(hr));
                bright *= pow(clamp(1.0 + dop, 0.35, 1.9), 3.0);
                float3 dc = mix(U.colB.rgb, U.colA.rgb, clamp(0.5 + dop * 0.8, 0.0, 1.0));
                dc = mix(dc, float3(1.0, 0.97, 0.9), clamp(bright * 0.22, 0.0, 0.55));
                float hs = exp(-abs(hr - 3.1) * 1.6) * exp(-(1.0 - cos(ang - hot)) * 3.2) * flare * 3.0;
                col += (dc * bright + float3(1.0, 0.95, 0.85) * hs) * through
                     * smoothstep(2.6, 3.1, hr) * smoothstep(9.0, 7.2, hr);
                through *= 0.35;
            }
        }
        posr = nposr;
        if (r2 < 1.0) { captured = true; break; }
        if (r2 > 900.0) break;
    }
    if (!captured) col += stars_h(normalize(vel), U) * through;
    // the tidal stream — the ghost's star, coming apart along the fall line
    if (U.ghostStrength > 0.05) {
        float2 g = ghostUp_h(U);
        float2 toC = -g;
        float tlen = length(toC);
        float2 dir = toC / max(tlen, 1e-3);
        float2 rel = p - g;
        float along = clamp(dot(rel, dir) / max(tlen, 0.2), 0.0, 1.0);
        float perp = abs(dot(rel, float2(-dir.y, dir.x)));
        float stream = exp(-perp / mix(0.035, 0.006, along) * 3.0) * smoothstep(1.0, 0.0, along) * U.ghostStrength;
        col += U.colC.rgb * stream * 0.8;
        col += float3(1.0, 0.95, 0.85) * exp(-length(rel) * 30.0) * U.ghostStrength * 0.9;
    }
    col += (hash21_h(pos.xy) - 0.5) * 0.008;
    return float4(govern_h(VOID_H + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// FERROFLUID — the liquid that stands up. The Rosensweig crown as
// a ray-marched heightfield: hexagonal spikes whose amplitude is
// the bass, glossy black with a thin-film whisper in the fresnel.
// The ghost hovering over the pool is the magnet. HEAVY.
// ===============================================================
inline float ferroField_h(float2 q, constant VizUniforms& U) {
    float A = 0.30 + U.bass * 0.85 + U.onsetEnv * 0.35;
    float mode = U.roll0;
    if (mode > 0.4 && mode < 0.7) {
        float sw = U.time * 0.5;
        float2 c = float2(cos(sw), sin(sw)) * 2.4;
        A *= 0.25 + 1.3 * exp(-dot(q - c, q - c) * 0.10);
    } else if (mode >= 0.7) {
        float2 c1 = float2(-2.2, 0.0), c2 = float2(2.2, 0.0);
        A *= 0.2 + 1.1 * exp(-dot(q - c1, q - c1) * 0.12) + 1.1 * exp(-dot(q - c2, q - c2) * 0.12);
    } else {
        A *= 0.45 + 0.9 * exp(-dot(q, q) * 0.035);
    }
    if (U.ghostStrength > 0.03) {
        float2 g = ghostUp_h(U);
        float2 m = float2(g.x * 4.4, -g.y * 4.0 + 1.6);
        A += U.ghostStrength * 1.5 * exp(-dot(q - m, q - m) * 0.16);
    }
    return A;
}
inline float ferroPool_h(float2 q, constant VizUniforms& U) {
    float A = ferroField_h(q, U);
    const float2 e1 = float2(1.0, 0.0);
    const float2 e2 = float2(0.5, 0.8660254);
    float lam = 1.05;
    float2 lc = float2(q.x - q.y * 0.57735, q.y * 1.1547) / lam;
    float2 base = floor(lc);
    float d = 1e3;
    for (int i = 0; i <= 1; i++)
        for (int j = 0; j <= 1; j++) {
            float2 n = base + float2(float(i), float(j));
            float2 c = (e1 * n.x + e2 * n.y) * lam;
            d = min(d, length(q - c));
        }
    float peak = pow(max(0.0, 1.0 - d / (0.62 * lam)), 1.6);
    float h = -0.9 + peak * A * (0.5 + A * 0.9);
    h += (vnoise_h(q * 0.7 + U.time * 0.12) - 0.5) * 0.16;
    h += (vnoise_h(q * 6.0 + U.time * 1.4) - 0.5) * 0.02 * U.treble;
    return h;
}
fragment float4 room_ferro(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_h(pos.xy, res, U.aspect);
    float3 ro = float3(0.0, 5.4, 5.2);
    float3 fw = normalize(float3(0.0, -0.95, -1.0));
    float3 rt = normalize(cross(fw, float3(0.0, 1.0, 0.0)));
    float3 up = cross(rt, fw);
    float3 rd = normalize(fw * 1.5 + rt * p.x + up * p.y);
    float tm = 0.0, tx = 22.0;
    float hm = ro.y - ferroPool_h(ro.xz, U);
    float3 pm = ro + rd * 5.0;
    float hp = pm.y - ferroPool_h(pm.xz, U);
    float hx = (ro + rd * tx).y - ferroPool_h((ro + rd * tx).xz, U);
    if (hp < 0.0) { tx = 5.0; hx = hp; } else { tm = 5.0; hm = hp; }
    float3 col;
    if (hx > 0.0 && hm > 0.0) {
        col = U.colC.rgb * 0.020;
    } else {
        float3 hit = ro;
        for (int i = 0; i < 7; i++) {
            float tmid = mix(tm, tx, hm / (hm - hx));
            hit = ro + rd * tmid;
            float hmid = hit.y - ferroPool_h(hit.xz, U);
            if (hmid < 0.0) { tx = tmid; hx = hmid; } else { tm = tmid; hm = hmid; }
        }
        float eps = 0.02;
        float3 n = normalize(float3(ferroPool_h(hit.xz - float2(eps, 0.0), U) - ferroPool_h(hit.xz + float2(eps, 0.0), U),
                                    2.0 * eps,
                                    ferroPool_h(hit.xz - float2(0.0, eps), U) - ferroPool_h(hit.xz + float2(0.0, eps), U)));
        float3 V = -rd;
        float fres = pow(1.0 - max(0.0, dot(n, V)), 4.0);
        float3 c2 = float3(0.008, 0.008, 0.011);
        float3 L1 = normalize(float3(0.4, 0.9, 0.3));
        float3 L2 = normalize(float3(-0.55, 0.5, -0.4));
        c2 += float3(1.0, 0.99, 0.97) * pow(max(0.0, dot(reflect(-L1, n), V)), 240.0) * (1.6 + U.onsetEnv * 1.2);
        c2 += U.colB.rgb * pow(max(0.0, dot(reflect(-L2, n), V)), 32.0) * 0.30;
        float3 R = reflect(-V, n);
        c2 += U.colC.rgb * smoothstep(0.25, 0.6, R.y) * smoothstep(0.8, 0.3, abs(R.x)) * 0.17;
        c2 += mix(U.colA.rgb, U.colC.rgb, fract(fres * 2.2)) * fres * 0.16;   // the oily edge
        c2 *= 0.85 + U.energy * 0.30;
        col = c2 * (smoothstep(14.0, 4.0, length(hit.xz)) * 0.9 + 0.1);
    }
    col += (hash21_h(pos.xy) - 0.5) * 0.006;
    return float4(govern_h(max(col, VOID_H * 0.5), U.white), 1.0);
}


// ===============================================================
// GALTON — order out of coin flips, told the ARCADE's way: each
// bead's fall is closed-form (its pin decisions are hashes, its
// position a prefix walk), the bins fill toward the binomial the
// clock has earned, and the bell curve fades in over the pile.
// The ghost tilts the board and the law leans with it.
// ===============================================================
fragment float4 room_plinko(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_h(pos.xy, res, U.aspect);
    float3 col = float3(0.0);
    float tilt = U.ghostStrength > 0.1 ? clamp(U.ghostX, -1.0, 1.0) * 0.35 : 0.0;
    const float ROWSP = 0.145, TOP = 0.78;
    // THE PINS — a triangular lattice, one distance by cell folding
    {
        float rowF = (TOP - p.y) / ROWSP;
        float row = floor(rowF);
        if (row >= 0.0 && row < 11.0) {
            float sx = 0.16;
            float xo = p.x / sx + row * 0.5;
            float cellx = floor(xo);
            float nx = (cellx - row * 0.5 + 0.5) * sx;
            float ny = TOP - row * ROWSP;
            float inRow = step(abs(cellx - row * 0.5 + 0.5), row * 0.5 + 1.0);
            float d = length(p - float2(nx, ny));
            col += mix(U.colB.rgb, float3(0.75, 0.78, 0.85), 0.6) * 0.55
                 * exp(-d * d * 9000.0) * inRow;
        }
    }
    // THE BEADS — twenty aloft, each a closed-form walk down the rows
    for (int b = 0; b < 20; b++) {
        float fb = float(b);
        float cyc = U.time * (0.35 + U.energy * 0.5) + hash11_h(fb * 3.7 + U.roll1 * 11.0);
        float ph = fract(cyc);
        float gen = floor(cyc);
        float rowF = ph * 13.0 - 1.0;                       // enters above, exits below
        float x = 0.0;
        for (int rr = 0; rr < 11; rr++) {
            if (float(rr) < rowF)
                x += (hash11_h(fb * 17.3 + float(rr) * 7.7 + gen * 29.1 + U.roll2 * 5.0) < 0.5 + tilt ? 0.08 : -0.08);
        }
        float fr = fract(max(rowF, 0.0));
        float y = TOP - rowF * ROWSP + (0.5 - abs(fr - 0.5)) * 0.04;  // the little hop at each pin
        float2 bp = float2(x, min(y, TOP + 0.15));
        float d = length(p - bp);
        float3 bc = mix(U.colA.rgb, U.colC.rgb, hash11_h(fb + gen));
        col += bc * exp(-d * d * 5200.0) * (0.9 + U.onsetEnv * 0.5) * step(rowF, 12.2);
        col += float3(1.0) * exp(-d * d * 26000.0) * 0.35;
    }
    // THE LEDGER — bins filling toward the binomial the clock has earned
    if (p.y < -0.55) {
        float earn = clamp(U.time * 0.02 + U.act * 0.4, 0.0, 1.0);
        float bx = (p.x - tilt * 0.6) / 1.4 * 0.5 + 0.5;      // the pile leans with the board
        if (bx > 0.0 && bx < 1.0) {
            float nb = 21.0;
            float bi = floor(bx * nb);
            float ctr = (bi + 0.5) / nb - 0.5;
            float ideal = exp(-ctr * ctr / 0.028);
            float hgt = ideal * (0.28 + earn * 0.5) * (0.85 + 0.3 * hash11_h(bi * 3.1 + floor(U.time * 0.5)));
            float inBar = step(p.y, -0.98 + hgt) * step(0.06, abs(fract(bx * nb) - 0.5) < 0.42 ? 1.0 : 0.0);
            col += mix(U.colB.rgb, U.colA.rgb, bx) * inBar * (0.4 + (p.y + 0.98) * 1.2 + U.onsetEnv * 0.15);
            // the law, earned
            float curve = smoothstep(0.012, 0.0, abs(p.y - (-0.98 + ideal * 0.78 * earn)));
            col += float3(1.0, 0.98, 0.94) * curve * earn * 0.7;
        }
    }
    col *= 0.85 + U.energy * 0.3;
    col += (hash21_h(pos.xy) - 0.5) * 0.006;
    return float4(govern_h(VOID_H + max(col, float3(0.0)), U.white), 1.0);
}
