#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 16 — THE BENCH: MAXWELL, THE SEVENTEEN, MINIMAL.
   Light, pattern, soap.

   Maxwell's dipole draws the true field-line contours of an
   oscillating dipole — C = sin²θ·(cos(kr−ωt) − sin(kr−ωt)/kr) —
   the loops pinching off the antenna exactly as the solution
   says they must, and the spectrum's visible sliver is drawn
   through the same CIE fit the web page carries. The Seventeen
   deals an asymmetric motif and folds it through Fedorov's
   complete census of the plane — all seventeen wallpaper
   groups, no more existing. Minimal plays the soap films: the
   catenoid–helicoid associate family turning through itself
   without stretching, Scherk's towers per pixel from
   z = ln(cos x / cos y), and the catenoid between two rings
   snapping to Goldschmidt's two discs past the honest limit.

   Laws as ever: void ground, chord-only colour (the spectrum's
   physical wavelengths are the Balmer precedent), govern_w() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 48 here).
   All symbols wear _w — a self-contained translation unit.
   ================================================================ */

constant float PI_W  = 3.14159265359;
constant float TAU_W = 6.28318530718;
constant float3 VOID_W = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_w(float3 c, float white) {
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
inline float hash21_w(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_w(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_w(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_w(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_w(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
/* the web page's own CIE fit, numbers carried verbatim (CIE_LOBES +
   XYZ_TO_SRGB) — the two stages cannot disagree about what 550 nm is */
inline float cieGauss_w(float l, float mu, float s1, float s2) {
    float t = (l - mu) * (l < mu ? 1.0 / s1 : 1.0 / s2);
    return exp(-0.5 * t * t);
}
inline float3 wavelengthLinearRGB_w(float l) {
    float X = 1.056 * cieGauss_w(l, 599.8, 37.9, 31.0)
            + 0.362 * cieGauss_w(l, 442.0, 16.0, 26.7)
            - 0.065 * cieGauss_w(l, 501.1, 20.4, 26.2);
    float Y = 0.821 * cieGauss_w(l, 568.8, 46.9, 40.5)
            + 0.286 * cieGauss_w(l, 530.9, 16.3, 31.1);
    float Z = 1.217 * cieGauss_w(l, 437.0, 11.8, 36.0)
            + 0.681 * cieGauss_w(l, 459.0, 26.0, 13.8);
    return max(float3( 3.2406 * X - 1.5372 * Y - 0.4986 * Z,
                      -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
                       0.0557 * X - 0.2040 * Y + 1.0570 * Z), float3(0.0));
}


// ===============================================================
// MAXWELL — the equations that turned light on: the dipole's
// pinching field loops, the E×B wave itself, and the thirteen
// octaves of spectrum with our sliver drawn through the eye.
// ===============================================================
fragment float4 room_maxwell(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 r2 = max(res, float2(1.0));
    float2 uv = pos.xy / r2;
    float2 p = centeredUp_w(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_w(U);
        float sw = U.ghostStrength * 0.30 / (dot(dh, dh) + 0.22);
        p = float2(p.x - dh.y * sw, p.y + dh.x * sw);        // a hand bends the field
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the web feeds the antenna at the song's tempo; the TV's stateless
    // clock drives it at pi per beat of a steady walking pace
    float drive = U.time * 6.0;
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE DIPOLE — contours of C = sin^2(theta)(cos(kr-wt) - sin(kr-wt)/kr),
           the loops pinching off the antenna exactly as the solution says */
        float r = length(p) + 1e-4;
        float st = abs(p.x) / r;                             // the antenna stands vertical
        float k = 9.0;
        float phase = k * r - drive;
        float C = st * st * (cos(phase) - sin(phase) / (k * r));
        float band = abs(fract(C * 3.0) - 0.5) * 2.0;
        float lines = exp(-band * band * 60.0);
        float fade = exp(-r * 0.9);
        col += chordRamp_w(U, 0.30 + 0.25 * smoothstep(-0.5, 0.5, C)) * lines * fade * (0.30 + U.bass * 0.35);
        col += chordRamp_w(U, 0.75) * lines * exp(-pow(abs(C) * 8.0, 2.0)) * fade * 0.25;  // the pinch-off seam
        float rod = segd_w(p, float2(0.0, -0.16), float2(0.0, 0.16));
        col += chordRamp_w(U, 0.10) * exp(-rod * 90.0) * (0.5 + U.bass * 0.8);
        col += chordRamp_w(U, 0.85) * exp(-r * r / 0.0008) * (0.4 + U.onsetEnv * 0.6);
    } else if (mode == 1) {
        /* E x B — the wave itself: the electric ribbon and the magnetic one,
           perpendicular, in phase, advancing at the one speed there is */
        float ph0 = drive * 0.5;
        float3 colE = chordRamp_w(U, 0.14), colB = chordRamp_w(U, 0.62);
        for (int i = 0; i < 48; i++) {
            float x = -1.6 + float(i) / 47.0 * 3.2;
            float w = sin(x * 6.0 - ph0) * (0.34 + U.mid * 0.18);
            float2 E = float2(x * U.aspect * 0.6, w);
            float2 B = float2(x * U.aspect * 0.6 + w * 0.36, w * 0.14);
            float dE = length(p - E), dB = length(p - B);
            col += colE * exp(-dE * dE / 0.00030) * 0.5;
            col += colB * exp(-dB * dB / 0.00030) * 0.42;
            // the field VECTORS, sampled sparsely — the comb of the wave
            if (fmod(float(i), 6.0) < 0.5) {
                float ax = x * U.aspect * 0.6;
                col += colE * exp(-segd_w(p, float2(ax, 0.0), float2(ax, w)) * 160.0) * 0.30;
                col += colB * exp(-segd_w(p, float2(ax, 0.0), float2(ax + w * 0.36, w * 0.14)) * 160.0) * 0.26;
            }
        }
        col += chordRamp_w(U, 0.45) * exp(-abs(p.y) * 200.0) * exp(-abs(p.x) * 0.4) * 0.12;
    } else {
        /* THE SPECTRUM — thirteen octaves of light, and the sliver we see,
           drawn through the CIE eye, honestly narrow */
        float x01 = uv.x;
        float vis0 = 0.46, vis1 = 0.58;
        if (x01 > vis0 && x01 < vis1) {
            float nm = mix(700.0, 400.0, (x01 - vis0) / (vis1 - vis0));
            col += wavelengthLinearRGB_w(nm) * 0.55 * smoothstep(0.85, 0.35, abs(p.y * 2.0));
        }
        // the long-wave shore: radio ripples on the bass
        float radio = smoothstep(0.30, 0.0, x01);
        col += chordRamp_w(U, 0.30) * radio * exp(-pow((p.y - 0.3 * sin(p.x * 4.0 - drive * 0.4)) * 5.0, 2.0)) * (0.22 + U.bass * 0.5);
        // microwave and IR: heat shimmer
        float ir = smoothstep(0.30, 0.42, x01) * smoothstep(0.50, 0.42, x01);
        col += chordRamp_w(U, 0.20) * ir * (0.14 + 0.12 * sin(p.y * 30.0 + U.time * 3.0 + x01 * 40.0)) * (0.5 + U.mid * 0.5);
        // the short shore: UV, X, gamma — spikes on the onsets
        float uvx = smoothstep(0.58, 0.75, x01);
        float spikes = step(0.97, hash21_w(float2(floor(x01 * 90.0), floor(U.time * (2.0 + U.treble * 8.0)))));
        col += chordRamp_w(U, 0.70) * uvx * spikes * abs(p.y) * (0.4 + U.onsetEnv * 0.8);
        col += chordRamp_w(U, 0.62) * uvx * 0.05;
        // the axis, and the honest label of scale: tick marks every octave
        col += chordRamp_w(U, 0.5) * exp(-abs(p.y) * 300.0) * 0.16;
        float tick = exp(-pow((fract(x01 * 13.0) - 0.5) * 14.0, 2.0));
        col += chordRamp_w(U, 0.55) * tick * exp(-abs(p.y + 0.55) * 60.0) * 0.26;
    }
    col += (hash21_w(pos.xy) - 0.5) * 0.006;
    return float4(govern_w(VOID_W + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// THE SEVENTEEN — every pattern there will ever be: Fedorov's
// census of the plane, one asymmetric motif walked through all
// seventeen wallpaper groups, the fold changing on the phrase.
// ===============================================================
static float3 motif_w(float2 q, constant VizUniforms& U, float morph) {
    float3 m = float3(0.0);
    float d1 = length(q - float2(0.30, 0.22));
    float d2 = length(q - float2(0.62, 0.55) * float2(1.0, 0.8));
    float d3 = length(q - float2(0.25, 0.68));
    m += chordRamp_w(U, 0.12) * exp(-d1 * d1 * (110.0 - U.bass * 35.0));
    m += chordRamp_w(U, 0.45) * exp(-d2 * d2 * 150.0) * 0.8;
    m += chordRamp_w(U, 0.70) * exp(-d3 * d3 * 200.0) * 0.7;
    // one comma of a curve, so chirality is visible
    float ang = atan2(q.y - 0.42, q.x - 0.42);
    float rr = length(q - float2(0.42));
    m += chordRamp_w(U, 0.30) * exp(-abs(rr - 0.16 - ang * 0.03) * 55.0) * smoothstep(2.4, 0.6, abs(ang)) * 0.75;
    return m * morph;
}
/* one cell coordinate, folded by group g (0..16 in the standard order
   p1 p2 pm pg cm pmm pmg pgg cmm p4 p4m p4g p3 p3m1 p31m p6 p6m).
   Square cells for the first twelve, hex-ish folds for the last five. */
static float2 foldCell_w(float2 q, float g) {
    float2 c = fract(q);
    if (g < 0.5) { return c; }                                            // p1
    if (g < 1.5) { if (c.y > 0.5) c = float2(1.0) - c; return c; }        // p2
    if (g < 2.5) { c.x = abs(c.x - 0.5); return c; }                      // pm
    if (g < 3.5) { if (c.x > 0.5) { c.x = c.x - 0.5; c.y = 1.0 - c.y; } return c; } // pg
    if (g < 4.5) { c = abs(c - 0.5); if (c.x + c.y > 0.5) c = float2(0.5) - c.yx; return c; } // cm
    if (g < 5.5) { return abs(c - 0.5); }                                 // pmm
    if (g < 6.5) { c.x = abs(c.x - 0.5); if (c.y > 0.5) { c.y = c.y - 0.5; c.x = 0.5 - c.x; } return c; } // pmg
    if (g < 7.5) { if (c.x > 0.5) { c.x -= 0.5; c.y = 1.0 - c.y; } if (c.y > 0.5) { c.y -= 0.5; c.x = 0.5 - c.x; } return c; } // pgg
    if (g < 8.5) { c = abs(c - 0.5); if (c.y > c.x) c = c.yx; return c; } // cmm
    if (g < 9.5) { c -= 0.5; for (int i = 0; i < 3; i++) { if (abs(c.y) > abs(c.x)) c = float2(c.y, -c.x); } return c + 0.5; } // p4
    if (g < 10.5) { c = abs(c - 0.5); if (c.y > c.x) c = c.yx; return c; }               // p4m (kaleido wedge)
    if (g < 11.5) { c -= 0.5; for (int i = 0; i < 3; i++) { if (abs(c.y) > abs(c.x)) c = float2(c.y, -c.x); } c += 0.5; c.y = abs(c.y - 0.5); return c; } // p4g
    // the hexagonal five: fold the angle around the cell centre —
    // threefold for the p3 kinds, sixfold for the p6 kinds, and a
    // mirror inside the wedge for the -m- kinds
    float2 d = fract(q) - 0.5;
    float ang = atan2(d.y, d.x);
    float rr = length(d);
    float n = g < 14.5 ? 3.0 : 6.0;
    float sector = TAU_W / n;
    float a2 = ang - sector * floor(ang / sector);
    bool mirrored = (g > 12.5 && g < 14.6) || g > 15.5;   // p3m1, p31m, p6m
    if (mirrored) a2 = abs(a2 - sector * 0.5);
    if (g > 13.5 && g < 14.6) a2 = sector * 0.5 - a2 + sector * 0.5;      // p31m: the other seam
    return float2(cos(a2), sin(a2)) * rr + 0.5;
}
fragment float4 room_seventeen(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_w(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_w(U);
        p += dh * (U.ghostStrength * 0.18 / (dot(dh, dh) + 0.28));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    // THE CENSUS walks one group per twelve patient seconds, and the change
    // DISSOLVES — the motif dips while the fold swaps, stateless via the
    // clock's own fraction; the other faces hold the dealt group still
    float g; float morph = 1.0;
    if (mode == 0) {
        float tt = U.time / 12.0 + U.roll2 * 17.0;
        g = fmod(floor(tt), 17.0);
        float fr = fract(tt);
        morph = clamp(min(fr, 1.0 - fr) * 16.0, 0.0, 1.0);
    } else {
        g = floor(clamp(U.roll2, 0.0, 0.999) * 17.0);
    }
    float2 q = p * (1.9 + 0.3 * sin(varA * TAU_W)) + float2(varA * 4.0, U.time * 0.03);
    float2 c = foldCell_w(q, g);
    float3 col = motif_w(c, U, morph);
    // a second, quieter voice half a cell away — depth without violence
    col += motif_w(fract(c + float2(0.5)), U, morph) * 0.22;
    if (mode == 2) {
        // THE CELL: the machinery bared — cell edges and the fold's seams
        float2 cf = fract(q);
        float edge = min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y));
        col += chordRamp_w(U, 0.55) * exp(-edge * 60.0) * 0.14;
        col += chordRamp_w(U, 0.85) * exp(-length(cf - 0.5) * 30.0) * 0.10; // the cell's heart
    }
    col += (hash21_w(pos.xy) - 0.5) * 0.006;
    return float4(govern_w(VOID_W + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// MINIMAL — the shapes soap already knows: the catenoid turning
// into the helicoid without stretching, Scherk's saddle towers,
// and the film between two rings snapping at Goldschmidt's limit.
// ===============================================================
fragment float4 room_minimal(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_w(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_w(U);
        p += float2(dh.y, -dh.x) * (U.ghostStrength * 0.12 / (dot(dh, dh) + 0.25));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE TURN — the associate family: X = cos(t)*catenoid + sin(t)*helicoid,
           an exact isometry all the way around; the music leans on the swing */
        float t = U.time * 0.45 + U.energy * 0.35;
        float ct = cos(t), st2 = sin(t);
        float va = U.time * 0.12 + varA * TAU_W;
        float cva = cos(va), sva = sin(va);
        for (int iu = 0; iu < 26; iu++) {
            for (int iv = 0; iv < 9; iv++) {
                float u = float(iu) / 25.0 * TAU_W;
                float u2 = float(iu + 1) / 25.0 * TAU_W;
                float v = (float(iv) / 8.0 - 0.5) * 2.4;
                // catenoid: (cosh v cos u, cosh v sin u, v) · helicoid: (sinh v sin u, -sinh v cos u, u)
                float chv = (exp(v) + exp(-v)) * 0.5, shv = (exp(v) - exp(-v)) * 0.5;
                float3 P = ct * float3(chv * cos(u), v, chv * sin(u))
                         + st2 * float3(shv * sin(u), u * 0.38 - 1.2, -shv * cos(u));
                float3 Q = ct * float3(chv * cos(u2), v, chv * sin(u2))
                         + st2 * float3(shv * sin(u2), u2 * 0.38 - 1.2, -shv * cos(u2));
                P *= 0.40; Q *= 0.40;
                // the turntable
                float x = P.x * cva + P.z * sva;
                float z = -P.x * sva + P.z * cva;
                float2 S = float2(x, P.y + z * 0.14);
                float x2 = Q.x * cva + Q.z * sva;
                float z2 = -Q.x * sva + Q.z * cva;
                float2 S2 = float2(x2, Q.y + z2 * 0.14);
                float depth = 0.55 + 0.45 * (z * 0.4 + 0.5);
                // the WIRE, not just its knots: the net woven along u
                float dseg = segd_w(p, S, S2);
                float dw = length(p - S);
                col += chordRamp_w(U, 0.30 + 0.30 * (float(iv) / 8.0)) * exp(-dseg * 150.0) * depth * 0.14;
                col += chordRamp_w(U, 0.30 + 0.30 * (float(iv) / 8.0)) * exp(-dw * dw / 0.00035) * depth * 0.22;
            }
        }
    } else if (mode == 1) {
        /* SCHERK — the saddle towers, per pixel: z = ln(cos x / cos y) exists
           only on the checkerboard, and the level bands say how steeply */
        float2 q = p * 3.4 + float2(varA * 3.0);
        float cx = cos(q.x), cy = cos(q.y);
        float sgn = cx * cy;
        if (sgn > 0.0) {
            float z = log(abs(cx) + 1e-4) - log(abs(cy) + 1e-4) + U.time * 0.15;
            float band = abs(fract(z * 2.2) - 0.5) * 2.0;
            float line = exp(-band * band * 50.0);
            col += chordRamp_w(U, 0.28 + 0.22 * smoothstep(-2.0, 2.0, z)) * line * (0.35 + U.mid * 0.2);
            // the towers' walls glow where the surface goes vertical
            float wall = exp(-abs(cx * cy) * 9.0);
            col += chordRamp_w(U, 0.62) * wall * 0.28;
        } else {
            // off the checkerboard there is no surface — the void, honestly
            float wall = exp(-abs(cx * cy) * 9.0);
            col += chordRamp_w(U, 0.70) * wall * 0.16;
        }
    } else {
        /* THE FILM — a catenoid between two rings; past Goldschmidt's limit
           the least area is two flat discs, and the film says so.
           The rings ride the bass — pull hard enough and it SNAPS. */
        float sep = 0.35 + U.bass * 0.45;                    // half-separation over ring radius
        bool snapped = sep > 0.6627;                         // the honest critical ratio
        float ringY = sep;
        for (int s = 0; s < 2; s++) {
            float y0 = s == 0 ? ringY : -ringY;
            float d = abs(length(float2(p.x / 0.62, (p.y - y0) * 4.0)) - 1.0);
            col += chordRamp_w(U, 0.55) * exp(-d * 14.0) * 0.35;
        }
        if (!snapped) {
            // the neck: r(y) = c cosh(y/c), c solved well enough by six turns
            float c = 0.8 - sep * 0.75;
            for (int it = 0; it < 6; it++) {
                float f = c * (exp(sep / c) + exp(-sep / c)) * 0.5;
                c += (0.62 - f) * 0.4;
                c = clamp(c, 0.05, 0.62);
            }
            float r = c * (exp(abs(p.y) / c) + exp(-abs(p.y) / c)) * 0.5;
            float d = abs(abs(p.x) - r * 0.62);
            float inFilm = step(abs(p.y), ringY);
            col += chordRamp_w(U, 0.34) * exp(-d * 30.0) * inFilm * (0.4 + U.mid * 0.2);
            col += chordRamp_w(U, 0.62) * exp(-d * 90.0) * inFilm * 0.30;
            // the waist, breathing thinner as the rings part
            col += chordRamp_w(U, 0.85) * exp(-length(float2(abs(p.x) - c * 0.62, p.y)) * 20.0) * 0.18;
        } else {
            // SNAP: the two discs, and the memory of the neck as a falling drop
            for (int s = 0; s < 2; s++) {
                float y0 = s == 0 ? ringY : -ringY;
                float disc = smoothstep(0.63, 0.58, length(float2(p.x / 0.62, (p.y - y0) * 4.0)));
                col += chordRamp_w(U, 0.40) * disc * 0.20;
            }
            float drop = length(p - float2(0.0, -fract(U.time * 0.5) * 0.8));
            col += chordRamp_w(U, 0.85) * exp(-drop * drop / 0.0008) * 0.5;
        }
    }
    col += (hash21_w(pos.xy) - 0.5) * 0.006;
    return float4(govern_w(VOID_W + max(col, float3(0.0)), U.white), 1.0);
}
