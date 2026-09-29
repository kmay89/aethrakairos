#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 20 — SACRED GEOMETRY, MAGNETISED: FLUX.

   Every figure here is one lattice: a centre, six circles at R
   (the Seed of Life), six at 2R and six at √3R between them (the
   Flower of Life); the first thirteen are Metatron's cube. Put a
   magnet at every centre and the drawing becomes a field, and in
   two dimensions the field is exact: a line dipole of moment m at
   angle α has A_z = m (dy cos α − dx sin α)/r², a line current I
   has A_z = −I ln r, and the field lines are the level sets of
   the sum, B = ∇A × ẑ, drawn one width everywhere by dividing by
   |B|. Where B vanishes the lines cross — X-points and O-points,
   the seats of reconnection — and those are lit. THE FLOWER turns
   its nineteen magnets ring against ring, so the geometries
   interact and the nulls walk. THE HALBACH is twelve magnets on a
   ring at α = (1 + k)θ: inside, a pure 2k-pole — uniform,
   quadrupole, sextupole as k sweeps — and outside, nothing. THE
   METATRON runs three-phase currents through the cube's thirteen
   wires, the inner ring turning one way and the outer the other:
   the induction motor's rotating field, twice, meeting. The flux
   runs along the lines as dashes of the conjugate potential
   Φ = m (dx cos α + dy sin α)/r², the harmonic twin of A. The
   ghost's hand is a magnet too.

   Laws as ever: void ground, chord-only colour, govern_m() at
   every exit, ghostStrength as the hand, roll0..2 the dice, every
   loop bounded by a compile-time literal (<= 19 here). All symbols
   wear _m — a self-contained translation unit.
   ================================================================ */

constant float PI_M  = 3.14159265359;
constant float TAU_M = 6.28318530718;
constant float3 VOID_M = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_m(float3 c, float white) {
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
inline float hash21_m(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_m(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_m(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_m(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float segd_m(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
/* the lattice every figure is drawn on: the centre; six at R; six at 2R;
   six at √3R between them. Metatron's cube is the first thirteen. */
inline float2 latt_m(float i) {
    if (i < 0.5) return float2(0.0);
    if (i < 6.5) { float a = (i - 1.0) * 1.0471976; return float2(cos(a), sin(a)); }
    if (i < 12.5) { float a = (i - 7.0) * 1.0471976; return 2.0 * float2(cos(a), sin(a)); }
    float a = 0.5235988 + (i - 13.0) * 1.0471976; return 1.7320508 * float2(cos(a), sin(a));
}
/* a line dipole, moment m at angle α: A_z = m (dy cos α − dx sin α)/r², its harmonic
   twin Φ = m (dx cos α + dy sin α)/r², and B = ∇A × ẑ — exact and closed */
inline void dipole_m(float2 d, float m, float al, thread float& A, thread float& Ph, thread float2& B) {
    float r2 = max(dot(d, d), 1e-5);
    float ca = cos(al), sa = sin(al);
    float u = d.y * ca - d.x * sa;
    float v = d.x * ca + d.y * sa;
    A += m * u / r2;
    Ph += m * v / r2;
    float Ax = m * (-sa * r2 - 2.0 * u * d.x) / (r2 * r2);
    float Ay = m * ( ca * r2 - 2.0 * u * d.y) / (r2 * r2);
    B += float2(Ay, -Ax);
}
/* a line current I: A_z = −I ln r, B = I (−dy, dx)/r² — Ampère's law, exact */
inline void wire_m(float2 d, float I, thread float& A, thread float2& B) {
    float r2 = max(dot(d, d), 1e-5);
    A += -I * 0.5 * log(r2);
    B += I * float2(-d.y, d.x) / r2;
}


// ===============================================================
// FLUX — the flower, the Halbach, the Metatron.
// ===============================================================
fragment float4 room_flux(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_m(pos.xy, res, U.aspect);
    float2 hand = ghostUp_m(U);
    float hs = clamp(U.ghostStrength, 0.0, 1.0);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the dice deal the flower's pattern and the phase; the web re-deals on every
    // entry, the TV holds one deal per visit — stateless, as every room here is
    int pi = int(clamp(U.roll1 * 4.0, 0.0, 3.999));
    float pat = pi == 0 ? 0.0 : (pi == 1 ? 1.0 : (pi == 2 ? 2.0 : -1.0));
    float varA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    float beat = U.onsetEnv;
    // the clocks the web accumulates with the music, here read off the one clock
    float spin = U.time * 0.35;
    float morph = U.time * 0.045;
    float flow = U.time * 2.0;
    float3 col = float3(0.0);
    float A = 0.0, Ph = 0.0;
    float2 B = float2(0.0);
    float guide = 0.0, glyph = 0.0;
    float3 glyphC = float3(0.0);
    float R = 0.30, dA = 0.30, dashes = 1.0, gate = 1.0, nk = 0.12;
    float mmag = 1.0 + 0.25 * beat;
    if (mode == 0) {
        /* THE FLOWER — nineteen magnets on the Flower of Life, turning ring against ring */
        R = 0.30;
        for (int i = 0; i < 19; i++) {
            float fi = float(i);
            float2 c = latt_m(fi) * R;
            float ring = fi < 0.5 ? 0.0 : (fi < 6.5 ? 1.0 : 2.0);
            float th = atan2(c.y, c.x);
            float w = ring < 0.5 ? 1.0 : (ring < 1.5 ? -1.0 : 0.6);
            float al = pat * th + spin * w + varA * TAU_M;
            float2 d = p - c;
            dipole_m(d, mmag, al, A, Ph, B);
            float rr = length(d);
            guide += exp(-pow((rr - R) * 90.0, 2.0));
            float pole = dot(d, float2(cos(al), sin(al)));
            float dt = exp(-rr * rr * 2600.0) * smoothstep(0.0, 0.008, abs(pole));
            glyphC += (pole > 0.0 ? chordRamp_m(U, 0.85) : chordRamp_m(U, 0.30)) * dt; glyph += dt;
        }
        dA = 0.85;
        gate = smoothstep(2.6 * R, 2.2 * R, length(p));
    } else if (mode == 1) {
        /* THE HALBACH — twelve on a ring, α = (1 + k)θ: a pure 2k-pole inside, nothing outside */
        R = 0.62;
        float k = 2.0 - cos(PI_M * morph);
        for (int i = 0; i < 12; i++) {
            float th = float(i) * TAU_M / 12.0;
            float2 c = R * float2(cos(th), sin(th));
            float al = (1.0 + k) * th + spin * 0.35 + varA * TAU_M;
            float2 d = p - c;
            dipole_m(d, mmag, al, A, Ph, B);
            float rr = length(d);
            guide += exp(-pow((rr - R * 0.2588) * 90.0, 2.0));   // twelve touching circles, the rosette
            float pole = dot(d, float2(cos(al), sin(al)));
            float dt = exp(-rr * rr * 2000.0) * smoothstep(0.0, 0.01, abs(pole));
            glyphC += (pole > 0.0 ? chordRamp_m(U, 0.85) : chordRamp_m(U, 0.30)) * dt; glyph += dt;
        }
        guide += exp(-pow((length(p) - R) * 90.0, 2.0)) * 0.6;
        dA = 1.10;
        gate = smoothstep(0.95 * R, 0.85 * R, length(p));    // the outside is dark because the field IS
    } else {
        /* THE METATRON — thirteen wires on the cube, three-phase, ring against ring */
        R = 0.42;
        dashes = 0.0;
        for (int i = 0; i < 13; i++) {
            float fi = float(i);
            float2 c = latt_m(fi) * R;
            float I;
            if (fi < 0.5) I = 0.6 * cos(spin * 0.5 + varA * TAU_M);
            else if (fi < 6.5) { float ph = fmod(fi - 1.0, 3.0) * TAU_M / 3.0; I = cos(spin - ph) * (fi < 3.5 ? 1.0 : -1.0); }
            else { float ph = fmod(fi - 7.0, 3.0) * TAU_M / 3.0; I = -cos(spin * 0.7 + ph + varA * TAU_M) * (fi < 9.5 ? 1.0 : -1.0); }
            float2 d = p - c;
            wire_m(d, I, A, B);
            float rr = length(d);
            guide += exp(-pow((rr - R) * 90.0, 2.0)) * 0.7;
            float dt = exp(-rr * rr * 3000.0) * (0.3 + 0.7 * abs(I));
            glyphC += (I > 0.0 ? chordRamp_m(U, 0.85) : chordRamp_m(U, 0.30)) * dt; glyph += dt;
        }
        // the cube: every centre joined to every other, seventy-eight lines
        for (int i = 0; i < 13; i++) {
            float2 a = latt_m(float(i)) * R;
            for (int j = 0; j < 13; j++) {
                if (j <= i) continue;
                float d = segd_m(p, a, latt_m(float(j)) * R);
                guide += exp(-d * d * 40000.0) * 0.55;
            }
        }
        dA = 0.20;
        nk = 1.5;                 // the wires' field is gentler, so a null is a smaller thing
        gate = smoothstep(2.5 * R, 2.1 * R, length(p));
    }
    // the ghost's hand is a magnet too — a spinning one, pulling the lines to it
    if (hs > 0.02) dipole_m(p - hand, 2.0 * hs, U.time * 1.5, A, Ph, B);
    // louder, more flux: the lines come closer together
    dA /= 1.0 + 0.6 * U.energy;
    float Bm = length(B);
    // the field lines: level sets of A, one every dA, one width by |∇A| = |B|;
    // where they crowd past what a pixel can hold, at the poles, they are let go
    float dl = abs(fract(A / dA + 0.5) - 0.5) * dA / max(Bm, 1e-4);
    float spacing = dA / max(Bm, 1e-4);
    float fade = smoothstep(0.0035, 0.009, spacing);
    float ln = exp(-dl * dl * 120000.0) * fade;
    // the flux runs along them: dashes of Φ, the harmonic twin, with the current
    float fl = dashes > 0.5 ? 0.62 + 0.38 * cos(Ph * 2.0 - flow) : 1.0;
    float lb = clamp((log(Bm + 1e-4) + 1.0) / 5.0, 0.0, 1.0);
    col += chordRamp_m(U, 0.10 + 0.55 * lb) * ln * (0.55 + 0.35 * fl) * (0.9 + beat * 0.2);
    // the nulls: where B vanishes the lines cross — X-points, O-points, reconnection
    float nul = exp(-Bm * Bm * nk) * gate;
    col += chordRamp_m(U, 0.85) * nul * (0.45 + beat * 0.6);
    // the figure itself, faint beneath — and the magnets, north lit, south in the chord
    col += chordRamp_m(U, 0.55) * guide * (0.10 + U.bass * 0.08);
    col += glyphC * 0.9;
    col += (hash21_m(pos.xy) - 0.5) * 0.006;
    return float4(govern_m(VOID_M + max(col, float3(0.0)), U.white), 1.0);
}
