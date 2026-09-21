#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 10 — THE HARMONY WING: TONNETZ, HARMONOGRAPH,
   OVERTONES, EUCLID, PHASE. The mathematics OF music, on the
   television, listening honestly.

   The analyzer's 64 bands are log-spaced 30 Hz → 14 kHz, so each
   band spans exactly 1.6624 semitones and the pitch class of
   band b is fmod(22.506 + (b+0.5)·1.6624, 12) — real chroma from
   real bins, no impersonation. A harmonic k sits 7.2185·log2(k)
   bands above its fundamental, so the overtone ladder reads the
   spectrum at the series' own spacing. The harmonograph snaps
   the two loudest peaks to the nearest just interval in
   semitone space. Euclid's necklaces are the k/n staircase in
   closed form on the bar phase. Reich's phasing is two clocks,
   3% apart, locking on schedule.

   Laws as ever: void ground, chord-only colour, govern_q() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 176 here).
   All symbols wear _q — a self-contained translation unit.
   ================================================================ */

constant float PI_Q  = 3.14159265359;
constant float TAU_Q = 6.28318530718;
constant float3 VOID_Q = float3(0.019608, 0.023529, 0.054902);
// the analyzer's geometry, baked: pitch class and octave walk per band
constant float PC0_Q   = 22.50638;   // pitch-class offset of band 0 (C = 0)
constant float PCSTEP_Q = 1.6624068; // semitones per band
constant float BANDS_PER_OCT_Q = 7.21851;

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

inline float3 govern_q(float3 c, float white) {
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
inline float hash21_q(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_q(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_q(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_q(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float band_q(texture2d<float, access::read> spectrum, int i) {
    return spectrum.read(uint2(uint(clamp(i, 0, 63)), 0)).r;
}
inline float3 chordRamp_q(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}


// ===============================================================
// TONNETZ — Euler's 1739 map of harmony: fifths along one axis,
// major thirds along the other, every triangle a triad. The 64
// log bands fold octave by octave into twelve chroma lights
// (the band-to-pitch-class walk is exact, see the header), and
// the lattice glows where the music actually is: a chord is
// three lit corners and a stained-glass pane between them.
// ===============================================================
fragment float4 room_tonnetz(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_q(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_q(U);
        p -= dh * (U.ghostStrength * 0.22 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the honest ear: fold every band into its pitch class, keep the max
    float ch[12];
    for (int i = 0; i < 12; i++) ch[i] = 0.0;
    for (int b = 2; b < 60; b++) {
        float a = band_q(spectrum, b);
        if (a < 0.18) continue;
        float pc = fmod(PC0_Q + (float(b) + 0.5) * PCSTEP_Q, 12.0);
        int pi = int(pc + 0.5) % 12;
        float w = a * a * max(0.3, 1.15 - float(b) / 70.0);
        if (w > ch[pi]) ch[pi] = w;
    }
    float mx = 0.10; int rootPC = 0;
    for (int i = 0; i < 12; i++) if (ch[i] > mx) { mx = ch[i]; rootPC = i; }
    for (int i = 0; i < 12; i++) ch[i] = min(ch[i] / mx, 1.0);

    if (mode == 1) {           // THE DRIFT: weather moving over the landscape
        float a = U.time * 0.018;
        float ca = cos(a), sa = sin(a);
        p = float2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
        p.x += U.time * 0.02;
    }
    float S = 0.44;
    float2 q = p / S;
    float bb = q.y / 0.8660254;
    float aa = q.x - 0.5 * bb;
    float ia = floor(aa), ib = floor(bb);
    float fa = aa - ia, fb = bb - ib;
    float3 col = float3(0.0);
    float c00 = 0.0, c10 = 0.0, c01 = 0.0, c11 = 0.0;
    float2 P00 = 0.0, P10 = 0.0, P01 = 0.0, P11 = 0.0;
    for (int di = 0; di < 2; di++)
    for (int dj = 0; dj < 2; dj++) {
        float i = ia + float(di), j = ib + float(dj);
        float pc = fmod(7.0 * i + 4.0 * j + 1200.0, 12.0);
        float2 P = float2(i + 0.5 * j, 0.8660254 * j) * S;
        float cv = 0.0;
        for (int k = 0; k < 12; k++) if (abs(float(k) - pc) < 0.5) cv = ch[k];
        float d = length(p - P);
        float3 ink = chordRamp_q(U, pc / 12.0 * 0.75 + U.roll1 * 0.25);
        float root = 1.0 - min(abs(pc - float(rootPC)), 1.0);
        col += ink * exp(-d * d * 2000.0) * (0.16 + cv * (1.2 + U.onsetEnv * 0.5) + root * U.onsetEnv * 0.6);
        col += ink * exp(-d * d * 220.0) * cv * 0.26;
        if (di == 0 && dj == 0) { c00 = cv; P00 = P; }
        if (di == 1 && dj == 0) { c10 = cv; P10 = P; }
        if (di == 0 && dj == 1) { c01 = cv; P01 = P; }
        if (di == 1 && dj == 1) { c11 = cv; P11 = P; }
    }
    // the roads: fifths flat, thirds climbing, the diagonal the minor third
    float w = 90000.0;
    float e;
    e = exp(-pow(segd_q(p, P00, P10), 2.0) * w); col += chordRamp_q(U, 0.30 + U.roll1 * 0.2) * e * (0.09 + min(c00, c10) * 0.60);
    e = exp(-pow(segd_q(p, P00, P01), 2.0) * w); col += chordRamp_q(U, 0.42 + U.roll1 * 0.2) * e * (0.09 + min(c00, c01) * 0.60);
    e = exp(-pow(segd_q(p, P10, P01), 2.0) * w); col += chordRamp_q(U, 0.54 + U.roll1 * 0.2) * e * (0.09 + min(c10, c01) * 0.60);
    e = exp(-pow(segd_q(p, P10, P11), 2.0) * w); col += chordRamp_q(U, 0.42 + U.roll1 * 0.2) * e * (0.09 + min(c10, c11) * 0.60);
    e = exp(-pow(segd_q(p, P01, P11), 2.0) * w); col += chordRamp_q(U, 0.30 + U.roll1 * 0.2) * e * (0.09 + min(c01, c11) * 0.60);
    // the panes: a sounding triad burns as stained glass
    float triA = min(c00, min(c10, c01));
    float triB = min(c11, min(c10, c01));
    float inA = (fa + fb < 1.0) ? 1.0 : 0.0;
    float paneGain = mode == 2 ? 0.85 : 0.30;
    float3 hot = chordRamp_q(U, 0.78 + U.roll1 * 0.12);
    col += hot * inA * triA * triA * paneGain * (0.8 + U.onsetEnv * 0.5);
    col += hot * (1.0 - inA) * triB * triB * paneGain * (0.8 + U.onsetEnv * 0.5);
    col += (hash21_q(pos.xy) - 0.5) * 0.006;
    return float4(govern_q(VOID_Q + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// HARMONOGRAPH — the Victorian two-pendulum drawing machine.
// The two loudest peaks in the spectrum, their gap snapped to
// the nearest just interval in semitone space, become the
// pendulum ratio; the figure is drawn as a closed-form damped
// polyline, the pen riding the flow, damping pulling every
// drawing home. Consonance draws knots; roughness scribbles.
// ===============================================================
fragment float4 room_harmonograph(float4 pos [[position]],
                                  constant VizUniforms& U [[buffer(0)]],
                                  constant float2& res [[buffer(1)]],
                                  texture2d<float, access::read> spectrum [[texture(0)]],
                                  texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_q(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));   // 0 lissajous, 1 pendulum, 2 two hearts
    // the two loudest peaks below ~1.4 kHz
    int b1 = 6; float v1 = 0.0; int b2 = 10; float v2 = 0.0;
    for (int b = 5; b < 44; b++) {
        float v = band_q(spectrum, b);
        if (v > v1 && v >= band_q(spectrum, b - 1) && v >= band_q(spectrum, b + 1)) {
            if (abs(b - b1) > 2) { v2 = v1; b2 = b1; }
            v1 = v; b1 = b;
        }
    }
    // their gap in semitones, snapped to the book of just intervals
    float semis = abs(float(b1 - b2)) * PCSTEP_Q;
    semis = fmod(semis, 12.0);
    float na = 3.0, nb = 2.0;                            // the fifth, until the music speaks
    float bestErr = 99.0;
    const float JS[8] = { 0.0, 7.02, 4.98, 3.86, 3.16, 8.84, 8.14, 2.04 };
    const float JN[8] = { 2.0, 3.0, 4.0, 5.0, 6.0, 5.0, 8.0, 9.0 };
    const float JD[8] = { 1.0, 2.0, 3.0, 4.0, 5.0, 3.0, 5.0, 8.0 };
    for (int j = 0; j < 8; j++) {
        float err = abs(semis - JS[j]);
        if (err < bestErr) { bestErr = err; na = JN[j]; nb = JD[j]; }
    }
    if (v2 < 0.15) { na = 3.0 + floor(U.roll1 * 3.0); nb = 2.0; }   // silence practises fifths and sixths
    float damp = mode == 0 ? 0.0 : (mode == 1 ? 0.16 : 0.05);
    float det  = mode == 0 ? 0.0 : (mode == 1 ? 0.013 : 0.006);
    float turnsL = mode == 0 ? TAU_Q : (mode == 1 ? TAU_Q * 7.0 : TAU_Q * 5.0);
    float ph = U.time * (0.05 + U.energy * 0.10) + U.roll2 * TAU_Q;
    float flow = fract(U.time * (0.10 + U.energy * 0.2));
    float naD = na + det, nbD = nb - det * 0.7;

    float3 col = float3(0.0);
    float2 prev = float2(0.0);
    for (int i = 0; i <= 176; i++) {
        float u = float(i) / 176.0;
        float th = u * turnsL;
        float env = exp(-damp * th);
        float2 z;
        if (mode == 2) {
            z = float2(sin(naD * th) + 0.72 * sin(nbD * th + ph),
                       cos(naD * th) + 0.72 * cos(nbD * th + ph)) * env * 0.42;
        } else {
            z = float2(sin(naD * th + ph), sin(nbD * th) * 0.78) * env * 0.72;
        }
        if (i > 0) {
            float dd = segd_q(p, prev, z);
            float head = fract(u - flow);
            float pen = exp(-head * head * 90.0);
            float3 ink = chordRamp_q(U, 0.22 + U.roll1 * 0.25 + u * 0.30);
            ink = mix(ink, chordRamp_q(U, 0.76 + U.roll1 * 0.14), pen * 0.9);
            col += ink * exp(-dd * dd * 30000.0) * (0.42 + pen * 1.8 + U.onsetEnv * 0.3);
            col += ink * exp(-dd * dd * 1200.0) * 0.020;
        }
        prev = z;
    }
    col += (hash21_q(pos.xy) - 0.5) * 0.006;
    return float4(govern_q(VOID_Q + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// OVERTONES — Pythagoras' monochord, played by the song. The
// fundamental is the loudest low band; harmonic k lives exactly
// 7.2185·log2(k) bands above it, so each partial's loudness is
// read at the series' own address. One string carrying sixteen
// standing waves, a ladder folding the series by octave (unison
// as literal alignment), and a bell ringing its modes.
// ===============================================================
fragment float4 room_overtones(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_q(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_q(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the fundamental: strongest band in 55..440 Hz
    int b0 = 10; float bv = 0.0;
    for (int b = 6; b <= 28; b++) {
        float v = band_q(spectrum, b);
        if (v > bv) { bv = v; b0 = b; }
    }
    float A[17];
    for (int k = 1; k <= 16; k++) {
        float fbk = float(b0) + BANDS_PER_OCT_Q * log2(float(k));
        float a = fbk < 63.0 ? band_q(spectrum, int(fbk + 0.5)) : 0.0;
        A[k] = a * (0.35 + 0.65 * a) * (0.5 + 0.8 / sqrt(float(k)));
    }
    float3 col = float3(0.0);
    float aspect = max(U.aspect, 1e-4);
    if (mode == 0) {
        /* THE STRING: sixteen standing waves and their sum, beating in
           slow motion — audio-rate is invisible, honesty is amplitude */
        float x01 = clamp(p.x / (aspect * 1.7) + 0.5, 0.0, 1.0);
        float inx = step(abs(p.x), aspect * 0.85);
        float Y = 0.0;
        float bigK = 1.0, bigA = 0.0;
        for (int k = 1; k <= 16; k++) {
            float fk = float(k);
            float yk = A[k] * 0.62 * sin(fk * PI_Q * x01) * cos(U.time * (0.9 + fk * 0.55) + U.roll2 * TAU_Q);
            Y += yk;
            float dg = abs(p.y - yk * 1.4);
            col += chordRamp_q(U, 0.15 + fk / 16.0 * 0.55 + U.roll1 * 0.15) * exp(-dg * dg * 2400.0) * A[k] * 0.30 * inx;
            if (A[k] > bigA) { bigA = A[k]; bigK = fk; }
        }
        float ds = abs(p.y - Y * 1.4);
        col += chordRamp_q(U, 0.76 + U.roll1 * 0.14) * exp(-ds * ds * 1400.0) * (0.9 + U.onsetEnv * 0.5 + U.energy * 0.3) * inx;
        col += chordRamp_q(U, 0.76 + U.roll1 * 0.14) * exp(-ds * ds * 90.0) * 0.10 * inx;
        for (int m = 1; m <= 15; m++) {
            if (float(m) >= bigK) break;
            float nx = (float(m) / bigK - 0.5) * aspect * 1.7;
            float dn = length(float2(p.x - nx, p.y));
            col += chordRamp_q(U, 0.30 + U.roll1 * 0.2) * exp(-dn * dn * 2600.0) * bigA * 0.9;
        }
    } else if (mode == 1) {
        /* THE LADDER: the series folded by octave — consonance as literal
           alignment, every agreeing partial hanging on one plumb line */
        float inx = step(abs(p.x), aspect * 0.86);
        for (int oc = 0; oc < 5; oc++) {
            float ry = 0.78 - float(oc) * 0.375;
            float dy = abs(p.y - ry);
            col += chordRamp_q(U, 0.30 + U.roll1 * 0.2) * exp(-dy * dy * 30000.0) * 0.05 * inx;
        }
        for (int k = 1; k <= 16; k++) {
            float fk = float(k);
            float ry = 0.78 - log2(fk) / 4.0 * 1.5;
            float rx = (fract(log2(fk)) - 0.5) * aspect * 1.6;
            float len = 0.14 + A[k] * 0.55;
            float dx = max(abs(p.x - rx) - len * 0.5, 0.0);
            float dy = abs(p.y - ry);
            float bar = exp(-(dx * dx * 3000.0 + dy * dy * 2600.0));
            col += chordRamp_q(U, 0.15 + fract(log2(fk)) * 0.7 + U.roll1 * 0.12) * bar * (0.28 + A[k] * (1.3 + U.onsetEnv * 0.5)) * inx;
            float dl = abs(p.x - rx);
            col += chordRamp_q(U, 0.30 + U.roll1 * 0.2) * exp(-dl * dl * 5000.0) * (0.05 + A[k] * 0.20) * inx * step(abs(p.y - 0.02), 0.80);
        }
    } else {
        /* THE BELL: the series bent around a ring, mode k rippling the rim
           with k lobes — the bell's voice is their sum */
        float r = length(p), th = atan2(p.y, p.x);
        float R = 0.58;
        for (int k = 1; k <= 12; k++) {
            float fk = float(k);
            R += A[k] * 0.13 * cos(fk * th + U.time * (0.3 + fk * 0.11) + U.roll2 * TAU_Q);
        }
        float dr = abs(r - R);
        col += chordRamp_q(U, 0.72 + U.roll1 * 0.15) * exp(-dr * dr * 2600.0) * (0.9 + U.onsetEnv * 0.5);
        col += chordRamp_q(U, 0.30 + U.roll1 * 0.2) * exp(-dr * dr * 240.0) * 0.30;
        col += chordRamp_q(U, 0.42 + U.roll1 * 0.2) * exp(-abs(r - 0.58) * 30.0) * 0.05;
    }
    col += (hash21_q(pos.xy) - 0.5) * 0.006;
    return float4(govern_q(VOID_Q + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// EUCLID — rhythm is a theorem: spread k beats as evenly as n
// slots allow (the k/n staircase, Euclid's algorithm in closed
// form) and the world's rhythms fall out — son clave, tresillo.
// Necklaces turning once per bar on the analyzed grid; every
// bead that crosses the top plays; the star face joins the
// beads into the near-regular polygon maximal evenness IS.
// ===============================================================
static float ehit_q(float b, float k, float n) {
    return step(0.5, floor(((b + 1.0) * k) / n) - floor((b * k) / n));
}

fragment float4 room_euclid(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_q(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_q(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    int setIdx = int(clamp(U.roll2 * 3.0, 0.0, 2.999));
    float2 KN[3];
    if (setIdx == 0) { KN[0] = float2(3, 8); KN[1] = float2(5, 8); KN[2] = float2(7, 16); }
    else if (setIdx == 1) { KN[0] = float2(2, 5); KN[1] = float2(3, 7); KN[2] = float2(5, 12); }
    else { KN[0] = float2(4, 8); KN[1] = float2(5, 16); KN[2] = float2(9, 16); }
    float r = length(p);
    float th01 = fract((atan2(p.y, p.x) - PI_Q * 0.5) / TAU_Q);
    float3 col = float3(0.0);
    if (mode < 2) {
        for (int m = 0; m < 3; m++) {
            float fm = float(m);
            float2 kn = KN[m];
            // NECKLACE: one bar each, alternating; CLOCKWORK: geared free-run
            float rot = mode == 0
                ? (m == 1 ? 1.0 - U.barPhase : U.barPhase)
                : fract(U.time * 0.05 / pow(2.0, fm));
            float R = 0.30 + fm * 0.245;
            float3 ink = chordRamp_q(U, 0.18 + fm * 0.24 + U.roll1 * 0.2);
            col += ink * exp(-pow(abs(r - R), 2.0) * 4000.0) * 0.14;
            float slot = th01 * kn.y - rot * kn.y;
            float b = floor(fmod(slot + kn.y * 4.0, kn.y));
            float fc = fract(slot) - 0.5;
            float arc = fc * (TAU_Q * R / kn.y);
            float dd = arc * arc + pow(abs(r - R), 2.0);
            float hit = ehit_q(b, kn.x, kn.y);
            col += ink * exp(-dd * 2600.0) * (0.10 + hit * (0.60 + U.mid * 0.3));
            col += chordRamp_q(U, 0.62 + U.roll1 * 0.18) * exp(-dd * 9000.0) * hit * 0.5;
            float dtop = min(th01, 1.0 - th01);
            float strike = exp(-dtop * dtop * 900.0) * hit * exp(-dd * 1800.0);
            col += chordRamp_q(U, 0.76 + U.roll1 * 0.14) * strike * (2.2 + U.onsetEnv * 1.4);
        }
        float dme = abs(p.x) * step(0.20, p.y) * step(p.y, 0.92);
        col += chordRamp_q(U, 0.76 + U.roll1 * 0.14) * exp(-dme * dme * 9000.0) * 0.12;
    } else {
        /* THE STAR: one necklace, its beads joined — the polygon breathes
           as the energy adds and removes beats */
        float n = 16.0;
        float k = 3.0 + min(6.0, floor(U.energy * 5.0 + U.bass * 2.0));
        float R = 0.62;
        float rot = U.barPhase;
        float3 ink = chordRamp_q(U, 0.30 + U.roll1 * 0.2);
        col += ink * exp(-pow(abs(r - R), 2.0) * 3000.0) * 0.10;
        float slot = th01 * n - rot * n;
        float b = floor(fmod(slot + n * 4.0, n));
        float fc = fract(slot) - 0.5;
        float arc = fc * (TAU_Q * R / n);
        float dd = arc * arc + pow(abs(r - R), 2.0);
        float hit = ehit_q(b, k, n);
        col += ink * exp(-dd * 2400.0) * (0.10 + hit * 0.65);
        float2 prev = float2(0.0), first = float2(0.0);
        bool have = false;
        for (int i = 0; i < 16; i++) {
            float fb = float(i);
            if (ehit_q(fb, k, n) > 0.5) {
                float ang = (fb + 0.5) / n * TAU_Q + rot * TAU_Q + PI_Q * 0.5;
                float2 P = float2(cos(ang), sin(ang)) * R;
                if (have) {
                    float ds = segd_q(p, prev, P);
                    col += chordRamp_q(U, 0.55 + U.roll1 * 0.2) * exp(-ds * ds * 30000.0) * (0.35 + U.onsetEnv * 0.3);
                } else first = P;
                prev = P; have = true;
            }
        }
        float ds = segd_q(p, prev, first);
        col += chordRamp_q(U, 0.55 + U.roll1 * 0.2) * exp(-ds * ds * 30000.0) * (0.35 + U.onsetEnv * 0.3);
        float dtop = min(th01, 1.0 - th01);
        col += chordRamp_q(U, 0.76 + U.roll1 * 0.14) * exp(-dtop * dtop * 3200.0) * hit * exp(-dd * 1800.0) * (2.2 + U.onsetEnv * 1.4);
    }
    col += (hash21_q(pos.xy) - 0.5) * 0.006;
    return float4(govern_q(VOID_Q + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// PHASE — Steve Reich's phasing, live: two identical loops, one
// three percent faster, shimmering with near-misses until the
// clocks lock and the room exhales. PIANO PHASE plays the 1967
// figure as two wheels of spokes; DRUMMING stacks four drifting
// tapes; THE RAIN phases the live spectrum against its echo.
// ===============================================================
static float pp_q(float c) {
    // E F#4 B C#5 D F#4 E C#5 B F#4 D C#5 — the figure, as heights
    float h = 1.0;
    if (c < 0.5) h = 4.0; else if (c < 1.5) h = 6.0; else if (c < 2.5) h = 11.0;
    else if (c < 3.5) h = 1.0; else if (c < 4.5) h = 2.0; else if (c < 5.5) h = 6.0;
    else if (c < 6.5) h = 4.0; else if (c < 7.5) h = 1.0; else if (c < 8.5) h = 11.0;
    else if (c < 9.5) h = 6.0; else if (c < 10.5) h = 2.0;
    return h / 11.0;
}

fragment float4 room_phase(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_q(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_q(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // two clocks, three percent apart — stateless, so the lock keeps its
    // schedule across every frame ever rendered
    float rate = 0.045;
    float phA = fract(U.time * rate + U.roll2);
    float phB = fract(U.time * rate * 1.031 + U.roll2);
    float dl = abs(phA - phB); dl = min(dl, 1.0 - dl);
    float lock = exp(-dl * dl * 900.0);
    float3 col = float3(0.0);
    float3 inkA = chordRamp_q(U, 0.20 + U.roll1 * 0.2);
    float3 inkB = chordRamp_q(U, 0.52 + U.roll1 * 0.2);
    float3 hot  = chordRamp_q(U, 0.78 + U.roll1 * 0.12);
    float aspect = max(U.aspect, 1e-4);
    if (mode == 0) {
        /* PIANO PHASE: two wheels of twelve — A reaches out, B reaches in,
           and where they agree the spoke runs straight through */
        float r = length(p);
        float th01 = fract((atan2(p.y, p.x) - PI_Q * 0.5) / TAU_Q);
        float R = 0.52;
        col += inkA * exp(-pow(abs(r - R), 2.0) * 5000.0) * 0.10;
        float sA = th01 * 12.0 - phA * 12.0;
        float cA = floor(fmod(sA + 48.0, 12.0));
        float fA = fract(sA) - 0.5;
        float hA = pp_q(cA);
        float kA = exp(-fA * fA * 260.0) * step(R - 0.015, r) * step(r, R + 0.06 + hA * 0.30);
        col += inkA * kA * (0.35 + U.mid * 0.3);
        float sB = th01 * 12.0 - phB * 12.0;
        float cB = floor(fmod(sB + 48.0, 12.0));
        float fB = fract(sB) - 0.5;
        float hB = pp_q(cB);
        float kB = exp(-fB * fB * 260.0) * step(r, R + 0.015) * step(R - 0.06 - hB * 0.30, r);
        col += inkB * kB * (0.35 + U.mid * 0.3);
        float agree = kA * kB * (1.0 - min(abs(hA - hB) * 8.0, 1.0));
        col += hot * agree * (1.6 + U.onsetEnv * 0.8);
        col += hot * exp(-pow(abs(r - R), 2.0) * 800.0) * lock * 0.9;
    } else if (mode == 1) {
        /* DRUMMING: four tapes, each a hair faster — the melody readable
           on every one, coincidence columns glowing through the stack */
        float rows = 4.0;
        float ry = (0.62 - p.y) / 1.24 * rows;
        float row = floor(ry);
        float fy = fract(ry);
        float x01 = clamp(p.x / (aspect * 1.7) + 0.5, 0.0, 1.0);
        float inx = step(abs(p.x), aspect * 0.85);
        if (row >= 0.0 && row < rows && fy > 0.10 && fy < 0.90) {
            float ph = row == 0.0 ? phA : (row == 1.0 ? phB : (row == 2.0 ? fract(phA * 2.0) : fract(phB * 2.0)));
            float slot = x01 * 12.0 - ph * 12.0;
            float c = floor(fmod(slot + 48.0, 12.0));
            float fc = fract(slot) - 0.5;
            float h = pp_q(c);
            float hw = 0.10 + h * 0.30;
            float bandv = smoothstep(hw + 0.06, hw - 0.02, abs(fy - 0.5));
            float k = exp(-fc * fc * 240.0);
            col += mix(inkA, inkB, row / 3.0) * k * bandv * (0.40 + h * 0.55 + U.mid * 0.3) * inx;
            col += mix(inkA, inkB, row / 3.0) * exp(-fc * fc * 900.0) * bandv * 0.35 * inx;
        }
        float slotA = x01 * 12.0 - phA * 12.0;
        float slotB = x01 * 12.0 - phB * 12.0;
        float gA = exp(-pow(fract(slotA) - 0.5, 2.0) * 240.0);
        float gB = exp(-pow(fract(slotB) - 0.5, 2.0) * 240.0);
        float hAg = 1.0 - min(abs(pp_q(floor(fmod(slotA + 48.0, 12.0))) - pp_q(floor(fmod(slotB + 48.0, 12.0)))) * 6.0, 1.0);
        col += hot * gA * gB * hAg * (1.1 + lock * 0.8) * inx * step(abs(p.y), 0.66);
    } else {
        /* THE RAIN: the live spectrum as a ring against its own echo —
           light only where the now and the memory agree */
        float r = length(p);
        float th01 = fract((atan2(p.y, p.x) - PI_Q * 0.5) / TAU_Q);
        float ampA = band_q(spectrum, int(fract(th01 - phA) * 28.0));
        float ampB = band_q(spectrum, int(fract(th01 - phB) * 28.0));
        float RA = 0.44 + ampA * 0.34;
        float RB = 0.44 + ampB * 0.34;
        col += inkA * exp(-pow(abs(r - RA), 2.0) * 3000.0) * (0.25 + ampA * 0.5);
        col += inkB * exp(-pow(abs(r - RB), 2.0) * 3000.0) * (0.25 + ampB * 0.5);
        float agree = exp(-pow(RA - RB, 2.0) * 500.0);
        col += hot * exp(-pow(abs(r - (RA + RB) * 0.5), 2.0) * 2400.0) * agree * min(ampA, ampB) * 1.6;
        col += hot * exp(-pow(abs(r - 0.44), 2.0) * 900.0) * lock * 0.8;
    }
    col += (hash21_q(pos.xy) - 0.5) * 0.006;
    return float4(govern_q(VOID_Q + max(col, float3(0.0)), U.white), 1.0);
}
