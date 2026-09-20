#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 8 — THE FOUNDING WING: π–e HELIX, MÖBIUS BAND,
   RIBBONS, COMETS, FERN, FLAME, CUBE SHEETS, BUBBLES, DRIFT,
   FILAMENT, SOAP FILM. The web player's eleven earliest scenes,
   retold in Metal — the parity law's debt paid, the house at
   sixty on both stages, 1:1 by key.

   The web originals are THREE.js point clouds and parametric
   meshes; the television retells each under the closed-form
   licence: curves sampled and drawn as glowing polylines through
   a slowly turning 3D frame, point systems as hashed lives
   derivable from the clock, and the two physics rooms (BUBBLES,
   SOAP FILM) keep their real physics — thin-film interference
   with the π phase flip, Fresnel as the alpha, gravity's
   drainage in the thickness field.

   Laws as ever: void ground, chord-only colour (the two
   measurement rooms lean on the chord rather than wearing it,
   exactly as their web twins do), govern_n() at every exit,
   ghostStrength as the hand, roll0..2 the dice, every loop
   bounded by a compile-time literal (≤ 72 here).
   All symbols wear _n — a self-contained translation unit.
   ================================================================ */

constant float PI_N  = 3.14159265359;
constant float TAU_N = 6.28318530718;
constant float3 VOID_N = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

inline float3 govern_n(float3 c, float white) {
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
inline float hash11_n(float x) { return fract(sin(x * 12.9898) * 43758.5453123); }
inline float hash21_n(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float vnoise_n(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_n(i), b = hash21_n(i + float2(1.0, 0.0));
    float c = hash21_n(i + float2(0.0, 1.0)), d = hash21_n(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
inline float fbm3_n(float2 p) {
    return vnoise_n(p) * 0.5 + vnoise_n(p * 2.1 + 7.3) * 0.3 + vnoise_n(p * 4.3 + 3.1) * 0.2;
}
inline float2 centeredUp_n(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_n(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_n(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float band_n(texture2d<float, access::read> spectrum, int i) {
    return spectrum.read(uint2(uint(clamp(i, 0, 63)), 0)).r;
}
// the chord as a cyclic 3-stop ramp — the gradient the web's uRamp carries
inline float3 chordRamp_n(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
// the slowly turning stage every 3D curve is projected through
inline float2 proj3_n(float3 w, float t) {
    float ry = t * 0.10, ca = cos(ry), sa = sin(ry);
    float x = w.x * ca + w.z * sa;
    float z = -w.x * sa + w.z * ca;
    return float2(x, w.y + z * 0.12);        // a whisper of tilt: depth reads without a camera
}
// the same stage, leaned back — a ring lying in the plane needs a real
// tilt before its geometry can be seen at all
inline float2 proj3t_n(float3 w, float t, float tilt) {
    float ct = cos(tilt), st = sin(tilt);
    return proj3_n(float3(w.x, w.y * ct - w.z * st, w.y * st + w.z * ct), t);
}
// the web's thin film, verbatim: δ = 2Nd·cosT, the +π flip so a vanishing
// film goes BLACK, and Schlick's Fresnel with water-soap R0
inline float3 filmSpectrum_n(float d, float ci) {
    const float N = 1.33;
    float sinT2 = (1.0 - ci * ci) / (N * N);
    float cosT = sqrt(max(1.0 - sinT2, 0.0));
    float delta = 2.0 * N * d * cosT;
    float3 lambda = float3(650.0, 545.0, 460.0);
    return 0.5 + 0.5 * cos(TAU_N * delta / lambda + PI_N);
}
inline float filmFresnel_n(float ci) {
    const float R0 = 0.0202;
    float u = 1.0 - clamp(ci, 0.0, 1.0);
    float u2 = u * u;
    return R0 + (1.0 - R0) * u2 * u2 * u;
}


// ===============================================================
// π–e HELIX — the two constants as intertwined strands. Bass
// swells one helix, treble the other; each point's own spectrum
// band sets its radius, so the coil IS the equalizer bent into
// space; rungs appear between the strands when the music holds
// together. Counter-phased by π — of course.
// ===============================================================
fragment float4 room_helix(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_n(U);
        p += d * (U.ghostStrength * 0.30 / (dot(d, d) + 0.35));
    }
    float turns = 3.0 + floor(U.roll1 * 3.0);       // 3-5: smooth at this sample budget
    float span = 1.55 + U.roll0 * 0.5;
    float3 col = float3(0.0);
    float2 prevQ[2];
    float prevAmp[2];
    for (int i = 0; i <= 64; i++) {
        float t = float(i) / 64.0;
        for (int s = 0; s < 2; s++) {
            float fs = float(s);
            float amp = band_n(spectrum, int(fs * 32.0 + t * 30.0));
            float phase = U.time * (0.11 + fs * 0.06) + U.roll2 * TAU_N;
            float coil = t * TAU_N * turns + phase + fs * PI_N + U.time * 0.4;
            float rad = 0.28 + U.roll0 * 0.12 + amp * 0.26
                      + (s == 0 ? U.bass : U.treble) * 0.20;
            float3 w = float3(cos(coil) * rad, (t - 0.5) * span, sin(coil) * rad);
            float2 q = proj3_n(w, U.time);
            if (i > 0) {
                float d = segd_n(p, prevQ[s], q);
                float glow = 0.5 * (amp + prevAmp[s]);
                float3 ink = s == 0 ? U.colA.rgb : U.colB.rgb;
                col += ink * exp(-d * d * 26000.0) * (0.5 + glow * 1.3 + U.onsetEnv * 0.4);
                col += ink * exp(-d * d * 900.0) * (0.05 + glow * 0.10);
                // the rungs: only where the music holds itself together
                if (s == 1 && (i % 8) == 0) {
                    float dr = segd_n(p, prevQ[0], q);
                    float hold = clamp(U.mid * 0.9 + U.onsetEnv * 0.6, 0.0, 1.0);
                    col += U.colC.rgb * exp(-dr * dr * 14000.0) * hold * 0.6;
                }
            }
            prevQ[s] = q; prevAmp[s] = amp;
        }
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// MÖBIUS BAND — the one-sided surface, twisted an ODD number of
// half-turns (one or three — the invariant is load-bearing). The
// mids ripple the strip radially, the spectrum fattens it, and
// the edge — the band's single edge, twice around — burns as one
// bright wire.
// ===============================================================
fragment float4 room_band(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    float half_twists = U.roll1 < 0.55 ? 0.5 : 1.5;         // ×ang: 1 or 3 half-twists
    float3 col = float3(0.0);
    float2 pe0, pe1;
    for (int i = 0; i <= 64; i++) {
        float t = float(i) / 64.0;
        float ang = t * TAU_N;
        float amp = band_n(spectrum, int(t * 63.0));
        float tw = ang * half_twists + U.time * 0.13 + U.roll2 * PI_N;
        float w = 0.13 + amp * 0.10 + U.mid * 0.05;
        float R = 0.60 + U.roll0 * 0.16 + sin(ang * 3.0 + U.time * 0.3) * 0.035
                + amp * 0.12 * sin(U.time * 0.5 + ang * (6.0 + U.roll2 * 8.0));
        float3 c3 = float3(R * cos(ang), sin(ang * 2.0 + U.time * 0.4) * U.mid * 0.10, R * sin(ang));
        float3 e0 = c3 + float3(cos(ang) * cos(tw), sin(tw), sin(ang) * cos(tw)) * w;
        float3 e1 = c3 - float3(cos(ang) * cos(tw), sin(tw), sin(ang) * cos(tw)) * w;
        // leaned back 0.9 rad: the ring shows as a ring, the twist as a twist
        float2 q0 = proj3t_n(e0, U.time, 0.9);
        float2 q1 = proj3t_n(e1, U.time, 0.9);
        // the surface: soft light between the edges, fresnel-ish off the twist
        float ds = segd_n(p, q0, q1);
        float fres = pow(abs(sin(tw)), 2.0);
        col += chordRamp_n(U, t + U.roll2) * exp(-ds * ds * 2600.0)
             * (0.055 + amp * 0.08 + fres * 0.085 + U.onsetEnv * 0.03);
        if (i > 0) {
            // the single edge, twice around — the wire that proves one side
            float d0 = segd_n(p, pe0, q0);
            float d1 = segd_n(p, pe1, q1);
            float dm = min(d0, d1);
            col += U.colC.rgb * exp(-dm * dm * 30000.0) * (0.5 + amp * 0.8 + U.onsetEnv * 0.5);
        }
        pe0 = q0; pe1 = q1;
    }
    if (U.ghostStrength > 0.05) {
        float dg = length(p - ghostUp_n(U));
        col += U.colA.rgb * exp(-dg * 6.0) * U.ghostStrength * 0.35;
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// RIBBONS — silk in a slow orbit. Each ribbon reads its own
// spectral band: loudness is WIDTH, pinched to a point at both
// ends; entropy dissolves the silk toward mist and calm gathers
// it back. Airy, flowing, lived-in.
// ===============================================================
fragment float4 room_ribbons(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_n(U);
        p += d * (U.ghostStrength * 0.35 / (dot(d, d) + 0.30));
    }
    // the web's entropy proxy: high band + onset churn dissolves the silk
    float morph = clamp(0.55 * U.treble + 0.60 * U.onsetEnv - 0.15, 0.0, 1.0) * (1.0 - U.calm * 0.6);
    float3 col = float3(0.0);
    for (int rb = 0; rb < 4; rb++) {
        float fr = float(rb);
        float2 prev = float2(0.0);
        for (int i = 0; i <= 36; i++) {
            float t = float(i) / 36.0;
            float amp = band_n(spectrum, int(fract(t * 0.45 + fr * 0.25) * 63.0));
            float ang = t * TAU_N * (1.1 + U.roll0 * 1.6) + fr * TAU_N * 0.25
                      + U.time * (0.10 + U.roll2 * 0.12) * (U.roll1 * 2.0 - 1.0) * 1.6;
            float R = 0.42 + 0.18 * sin(t * 4.0 + U.time * 0.23 + fr * 9.0) + amp * 0.28 + U.bass * 0.12;
            float y = (t - 0.5) * (0.9 + U.roll0 * 0.5)
                    + sin(U.time * 0.31 + fr * 7.0 + t * 8.0) * 0.13
                    + sin(U.time * 0.17 + fr * 3.0) * 0.09;
            float3 w3 = float3(cos(ang) * R, y, sin(ang) * R);
            // the dissolve: the silk's own points scatter into mist
            float jit = morph * (0.02 + 0.16 * hash21_n(float2(fr * 31.0 + float(i), 7.0)));
            w3 += float3(sin(fr * 91.7 + float(i) * 3.1 + U.time * 0.9),
                         cos(fr * 45.3 + float(i) * 1.7 + U.time * 0.7),
                         sin(fr * 77.1 + float(i) * 2.3 - U.time * 0.8)) * jit;
            float2 q = proj3_n(w3, U.time);
            if (i > 0) {
                float d = segd_n(p, prev, q);
                float taper = pow(max(sin(t * PI_N), 0.001), 0.65);
                float wdt = (0.016 + amp * 0.065 + U.onsetEnv * 0.020) * taper;
                float body = exp(-d * d / max(wdt * wdt, 1e-8));
                // silk, not wire: a soft edge glow widens the sheet and a
                // bright spine keeps it from going flat
                float spine = exp(-d * d / max(wdt * wdt * 0.12, 1e-8));
                float3 ink = chordRamp_n(U, t + fr * 0.25);
                col += ink * body * (0.22 + amp * 0.6 + U.onsetEnv * 0.18) * (1.0 - morph * 0.55);
                col += ink * spine * 0.16 * (1.0 - morph * 0.4);
                col += ink * exp(-d * d * 500.0) * 0.028;
            }
            prev = q;
        }
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// COMETS — velocity, made visible. A rain of streaks falling
// through a corridor on a rolled diagonal, heads flaring and
// tails STRETCHING on the beat; the treble's colour turns every
// streak's place on the chord.
// ===============================================================
fragment float4 room_comets(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_n(U);
        p += d * (U.ghostStrength * 0.30 / (dot(d, d) + 0.35));
    }
    float3 rain = normalize(float3(U.roll0 * 2.0 - 1.0, -0.85, U.roll1 * 2.0 - 1.0));
    float3 col = float3(0.0);
    for (int s = 0; s < 46; s++) {
        float fs = (float(s) + 0.5) / 46.0;
        float h1 = fract(fs * 127.1), h2 = fract(fs * 311.7);
        float h3 = fract(fs * 74.7),  h4 = fract(fs * 91.3);
        float speed = (0.35 + h3 * 0.9) * (0.5 + U.energy * 1.2 + U.act * 0.2) * (0.6 + U.roll2 * 0.9);
        float travel = fmod(h3 * 200.0 + U.time * speed, 5.0) - 2.5;
        float3 base = float3((h1 - 0.5) * 2.6, (h2 - 0.5) * 1.9, (h4 - 0.5) * 2.6);
        float hue = fract(h1 + U.treble * 0.3);
        float3 ink = chordRamp_n(U, hue);
        // the streak: one drawn tail from head to wake, plus a hot head
        float tailLen = 0.16 + speed * 0.16 * (0.6 + U.onsetEnv * 0.9);
        float3 head3 = base + rain * travel;
        float2 hq = proj3_n(head3, U.time * 0.3);
        float2 wq = proj3_n(head3 - rain * tailLen, U.time * 0.3);
        float dTail = segd_n(p, hq, wq);
        float wS = (0.005 + h3 * 0.004) * (1.0 + U.onsetEnv * 0.6);
        col += ink * exp(-dTail * dTail / max(wS * wS, 1e-8))
             * (0.55 + U.onsetEnv * 0.4 + U.energy * 0.3);
        float2 dh = p - hq;
        float hs = wS * 2.2;
        float hg = exp(-dot(dh, dh) / max(hs * hs, 1e-8));
        col += mix(ink, float3(1.0, 0.98, 0.94), 0.45) * hg * (0.9 + U.onsetEnv * 0.8);
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// FERN — the self-similar frond, drawn crisp (a fern that blurs
// is no fern at all). A stem curve carries twenty pinnae a side,
// each serrated into pinnules by its own local wave, stippled to
// dots exactly as the chaos game stipples the web's — grown
// through the song's own arc, swaying on the bass. CALM.
// ===============================================================
fragment float4 room_fern(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    float mirror = U.roll1 < 0.5 ? -1.0 : 1.0;
    p.x *= mirror;
    p.y += 0.78;                                    // root the plant near the floor
    // the sway: bass leans the whole plant, more the higher you look
    float swayA = sin(U.time * 0.6 + U.roll2 * TAU_N) * (0.02 + U.bass * 0.06);
    float grow = clamp(0.55 + U.act * 0.12 + U.time * 0.003, 0.0, 1.0);
    float3 col = float3(0.0);
    // the stem: a gentle exponential lean, growing WITH its pinnae — a
    // bare mast above the fronds is a flagpole, not a plant
    float lean = (U.roll0 - 0.5) * 0.5;
    float2 prevS = float2(0.0);
    float2 stemAt[19];
    for (int i = 0; i <= 18; i++) {
        float v = float(i) / 18.0;
        float2 s2 = float2(lean * v * v * 0.9 + swayA * v * v * 1.4, v * 1.5);
        stemAt[i] = s2;
        if (i > 0 && v <= grow + 0.04) {
            float d = segd_n(p, prevS, s2);
            float wdt = 0.006 * (1.0 - v * 0.75);
            col += chordRamp_n(U, 0.05 + v * 0.25) * exp(-d * d / max(wdt * wdt, 1e-8)) * 0.55;
        }
        prevS = s2;
    }
    // the pinnae: one per station per side, self-similar, serrated, stippled
    for (int k = 0; k < 32; k++) {
        float fk = float(k);
        float side = (k % 2) == 0 ? 1.0 : -1.0;
        float v = 0.08 + (fk / 32.0) * 0.86;        // station on the stem
        if (v > grow) break;                        // the plant is still arriving
        int si = int(v * 18.0);
        float2 base2 = mix(stemAt[si], stemAt[min(si + 1, 18)], fract(v * 18.0));
        // pinna direction: up and OUT — steeper near the crown, flatter at
        // the base, the way a real frond opens — swaying with the stem
        float pang = (0.62 + v * 0.55)                       // angle up from horizontal
                   + swayA * (1.5 + v * 2.0) + sin(U.time * 0.8 + fk) * 0.02 * (1.0 + U.bass);
        float2 dir = normalize(float2(cos(pang) * side, sin(pang) * 0.55));
        float plen = 0.42 * pow(max(sin((1.0 - v) * PI_N * 0.62 + 0.35), 0.05), 0.9) * (0.8 + 0.2 * hash11_n(fk));
        // local frame along the pinna
        float2 rel = p - base2;
        float u = dot(rel, dir);
        float wloc = rel.x * dir.y - rel.y * dir.x;  // signed distance off the pinna axis
        if (u < -0.02 || u > plen + 0.02) continue;
        float uu = clamp(u / max(plen, 1e-4), 0.0, 1.0);
        // the pinnule serration: teeth shortening toward the tip
        float tooth = abs(sin(uu * (26.0 + U.roll2 * 8.0) + fk * 0.7));
        float reach = (0.055 + 0.02 * hash11_n(fk * 3.1)) * (1.0 - uu * 0.85) * (0.35 + tooth * 0.75);
        float inside = smoothstep(reach, reach * 0.55, abs(wloc));
        if (inside <= 0.0) continue;
        // the stipple: the chaos game's dots, retold as a hash screen
        float dotmask = step(0.42, hash21_n(floor(p * 240.0) + fk * 17.0));
        float amp = band_n(spectrum, int(4.0 + fract(fk * 0.618) * 56.0));
        float tipglow = smoothstep(grow - 0.06, grow, v);   // the growing frontier burns
        float3 ink = chordRamp_n(U, 0.08 + v * 0.30 + side * 0.04);
        ink = mix(ink, U.colC.rgb, tipglow * 0.7 + U.onsetEnv * 0.15);
        col += ink * inside * dotmask * (0.55 + amp * 0.5 + tipglow * 0.8 + U.energy * 0.2);
    }
    if (U.ghostStrength > 0.05) {
        float dg = length(p - float2(ghostUp_n(U).x * mirror, ghostUp_n(U).y + 0.78));
        col += U.colB.rgb * exp(-dg * 5.0) * U.ghostStrength * 0.3;
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// FLAME — the vigil. Real flame anatomy, closed-form: the blue
// combustion ring at the wick, the white core just above it, the
// orange body pinched to a tip, Rayleigh–Taylor puffing at the
// real 1.5/√d frequency, instability growing downstream, embers
// on the treble. The roll deals one candle, three, or the bench
// of five. Colour is the fire's own — the chord only warms it.
// ===============================================================
fragment float4 room_flame(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    int count = U.roll0 < 0.5 ? 1 : (U.roll0 < 0.82 ? 3 : 5);
    float flick = 1.0 - U.calm * 0.6;
    float3 col = float3(0.0);
    for (int f = 0; f < 5; f++) {
        if (f >= count) break;
        float ff = float(f);
        float bx = (ff - float(count - 1) * 0.5) * (count > 3 ? 0.52 : 0.75);
        float scale = count == 1 ? 1.0 : (0.55 + hash11_n(ff + U.roll1 * 9.0) * 0.25);
        float amp = band_n(spectrum, int(6.0 + ff * 11.0));
        float lift = 1.0 + amp * 0.8 + U.bass * 0.25 + U.onsetEnv * 0.2;
        float2 q = (p - float2(bx, -0.45)) / scale;
        float H = 0.62 * lift;
        float h = q.y / H;                          // 0 at the wick, 1 at the tip
        if (h > -0.15 && h < 1.35) {
            // the puff: the real frequency, 1.5/sqrt(diameter)
            float PUFF = 9.0 + hash11_n(ff * 7.7) * 4.0;
            float puff = sin((U.time * PUFF * 0.35 - h * 2.6) * 1.0) * flick;
            // instability grows downstream: the tip writes, the wick holds still
            float sway = (sin(h * 4.1 + U.time * 3.1 + ff * TAU_N)
                        + 0.5 * sin(h * 7.9 - U.time * 2.3 + ff * 12.0))
                       * 0.06 * pow(max(h, 0.0), 1.4) * flick * (1.0 + U.treble * 0.8);
            float W = 0.085 * (1.0 + puff * 0.18) * scale / max(scale, 1e-4);
            float envl = pow(clamp(h, 0.001, 1.0), 0.34) * (1.0 - clamp(h, 0.0, 1.0));
            float rad = W * envl * 2.5;
            float dx = abs(q.x - sway) / max(rad, 1e-4);
            float body = exp(-dx * dx * 2.2) * smoothstep(-0.06, 0.06, h) * smoothstep(1.08, 0.85, h);
            // the fire's own colours: tip red, body orange, core white-gold
            float hot = 1.0 - smoothstep(0.05, 0.34, h);
            float3 fire = mix(float3(1.0, 0.32, 0.05), float3(1.0, 0.62, 0.14), 1.0 - h);
            fire = mix(fire, float3(1.0, 0.93, 0.72), hot * (1.0 - dx * 0.6));
            fire = mix(fire, U.colC.rgb, 0.09);
            col += fire * body * (0.5 + amp * 0.9 + U.onsetEnv * 0.25) * (0.7 + hot * 0.6);
            // the blue of actual combustion, a ring hugging the wick
            float blue = exp(-(h - 0.015) * (h - 0.015) * 900.0) * smoothstep(1.4, 0.7, dx);
            col += float3(0.25, 0.42, 1.0) * blue * 0.5;
            // the halo — soft radiant air around the flame
            float2 hd = q - float2(sway, H * 0.35);
            col += fire * exp(-dot(hd, hd) * 9.0) * 0.10 * (1.0 + amp);
        }
        // embers: a handful of hashed lives rising off the tip on the treble
        for (int e = 0; e < 4; e++) {
            float fe = float(e);
            float hz = hash11_n(ff * 13.0 + fe * 7.1);
            float life = fract(U.time * (0.25 + hz * 0.3) + hz * 9.0);
            float2 ep = float2(bx + sin(life * 9.0 + hz * TAU_N) * 0.08 * life,
                               -0.45 + (0.62 + life * 0.75) * scale);
            float2 de = p - ep;
            float spark = exp(-dot(de, de) * 30000.0) * (1.0 - life) * step(0.35, U.treble + U.onsetEnv);
            col += float3(1.0, 0.55, 0.18) * spark * 1.3;
        }
    }
    if (U.ghostStrength > 0.05) {
        // the draught: the flames lean away from the finger
        float dg = length(p - ghostUp_n(U));
        col += U.colB.rgb * exp(-dg * 7.0) * U.ghostStrength * 0.2;
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CUBE SHEETS — the collider. Three lattices of cubes, the middle
// one in antiphase, a ripple travelling out from a rolled origin;
// the BASS sets how far the sheets reach toward each other, the
// beat's spring lands the clap, and contact flashes white — a
// meeting the music has to earn. Raymarched, briefly.
// ===============================================================
inline float sheetsMap_n(float3 w, constant VizUniforms& U, float reach, thread float& clapOut) {
    float d = 1e3;
    float2 org = (float2(U.roll0, U.roll1) - 0.5) * 16.0;
    clapOut = 0.0;
    for (int s = 0; s < 3; s++) {
        float fs = float(s);
        float3 q = w;
        float2 cell = round(q.xz / 2.05);
        float rr = length(cell * 2.05 - org);
        float ph = U.time * (1.5 + U.energy * 1.6) - rr * (0.30 + U.roll2 * 0.35);
        float wave = sin(ph);
        float dir = s == 1 ? -1.0 : 1.0;
        float travel = 1.14 * reach;
        float clap = smoothstep(0.88, 1.0, abs(wave)) * smoothstep(0.72, 0.95, reach);
        q.xz -= cell * 2.05;
        q.y -= (fs - 1.0) * 3.2 + dir * travel * wave;
        float3 b = float3(0.92, 0.92 * (1.0 - clap * 0.38), 0.92);
        b.xz *= 1.0 + clap * 0.20;
        float3 dq = abs(q) - b * 0.5;
        float bd = length(max(dq, 0.0)) + min(max(dq.x, max(dq.y, dq.z)), 0.0);
        if (bd < d) { d = bd; clapOut = clap; }
    }
    return d;
}
fragment float4 room_sheets(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = centeredUp_n(pos.xy, res, U.aspect);
    float reach = clamp(0.30 + U.bass * 0.55 + U.onsetEnv * 0.35 + U.energy * 0.15, 0.0, 1.0);
    // a slow orbiting eye, looking into the gap between the sheets
    float ot = U.time * 0.06;
    float3 ro = float3(sin(ot) * 12.0, 5.5 + sin(U.time * 0.045) * 1.5, cos(ot) * 12.0);
    float3 fw = normalize(-ro + float3(0.0, 0.0, 0.0));
    float3 rt = normalize(cross(fw, float3(0.0, 1.0, 0.0)));
    float3 up = cross(rt, fw);
    float3 rd = normalize(fw * 1.6 + rt * uv.x + up * uv.y);
    if (U.ghostStrength > 0.05) {
        float2 g = ghostUp_n(U);
        rd = normalize(rd + float3(g.x, g.y, 0.0) * U.ghostStrength * 0.12);
    }
    float3 col = float3(0.0);
    float t = 0.0, clap = 0.0;
    bool hit = false;
    float3 w = ro;
    for (int i = 0; i < 64; i++) {
        w = ro + rd * t;
        float d = sheetsMap_n(w, U, reach, clap);
        if (d < 0.012) { hit = true; break; }
        t += d * 0.9;
        if (t > 46.0) break;
    }
    if (hit) {
        // face normal from the local box: cheapest honest lambert
        const float e = 0.02;
        float c0;
        float3 n = normalize(float3(
            sheetsMap_n(w + float3(e, 0, 0), U, reach, c0) - sheetsMap_n(w - float3(e, 0, 0), U, reach, c0),
            sheetsMap_n(w + float3(0, e, 0), U, reach, c0) - sheetsMap_n(w - float3(0, e, 0), U, reach, c0),
            sheetsMap_n(w + float3(0, 0, e), U, reach, c0) - sheetsMap_n(w - float3(0, 0, e), U, reach, c0)));
        float lam = 0.40 + 0.60 * max(0.0, dot(n, normalize(float3(0.35, 0.9, 0.2))));
        float2 cell = round(w.xz / 2.05);
        float hue = fract((cell.x + cell.y) / 24.0 + U.time * 0.012);
        float3 ink = chordRamp_n(U, hue) * lam;
        ink = mix(ink, float3(1.0), clap * (0.22 + U.white * 0.35));
        float fog = exp(-max(t - 10.0, 0.0) * 0.06);
        col = ink * (0.75 + U.energy * 0.35) * fog;
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// BUBBLES — glass, air, and the physics of thin films. Every
// bubble is a true sphere the fragment reconstructs; its colour
// is real interference — gravity thins the crown, bass stirs the
// marbling, and a film that reaches zero goes BLACK, exactly as
// soap does. Alpha IS the reflectance. The last 4% of a life is
// the burst. CALM.
// ===============================================================
fragment float4 room_bubbles(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_n(U);
        p += d * (U.ghostStrength * 0.25 / (dot(d, d) + 0.35));
    }
    float3 col = float3(0.0);
    for (int b = 0; b < 18; b++) {
        float fb = (float(b) + 0.5) / 18.0;
        float h1 = fract(fb * 127.1), h2 = fract(fb * 311.7);
        float h3 = fract(fb * 74.7),  h4 = fract(fb * 269.5);
        float span = 9.0 + h3 * 8.0;
        float tt = U.time * (0.55 + U.energy * 0.45) / span + h2 * 7.31;
        float life = fract(tt);
        float amp = band_n(spectrum, int(h1 * 63.0));
        float R = (0.045 + pow(h4, 2.4) * 0.20) * (1.0 + amp * 0.22);
        float wob = 1.0 + U.onsetEnv * 0.05 * sin(U.time * 9.0 + h1 * 20.0);
        R *= wob;
        float2 c = float2((h1 - 0.5) * (1.7 + U.roll0 * 0.5) + cos(U.time * (0.05 + h3 * 0.12) + h1 * TAU_N + floor(tt) * 2.4) * 0.08,
                          (life - 0.5) * 2.2);
        float2 d2 = p - c;
        float r = length(d2) / max(R, 1e-5);
        float popT = smoothstep(0.955, 1.0, life);
        if (popT > 0.001) {
            // the burst: one bright expanding ring, then nothing
            float ringR = mix(0.35, 1.6, popT);
            float ring = exp(-abs(r - ringR) * 8.0) * (1.0 - popT);
            col += mix(float3(1.0, 0.95, 0.85), chordRamp_n(U, fb), 0.5) * ring * 1.4;
            continue;
        }
        if (r >= 1.0) continue;
        float2 nc = d2 / max(R, 1e-5);
        float nz = sqrt(max(1.0 - r * r, 0.0));
        float ci = nz;
        // gravity: thin at the crown, thick at the foot; the film drains as it ages
        float drain = 1.0 - life * 0.62;
        float dNm = (150.0 + 620.0 * (0.5 - 0.5 * nc.y)) * drain;
        dNm += (fbm3_n(nc * 2.3 + float2(fb * 31.0, -U.time * 0.10 - life * 1.4)) - 0.5)
             * 260.0 * (0.6 + U.bass * 0.5);
        float F = filmFresnel_n(ci);
        float3 film = filmSpectrum_n(dNm, ci) * F
                    + filmSpectrum_n(dNm * 1.18 + 40.0, max(ci * 0.72, 0.05)) * F * 0.45;
        // the bands across the face, at the half-vector of a keyed light
        float cH = clamp(nz * 0.62 + nc.y * 0.5 + 0.2, 0.0, 1.0);
        film += filmSpectrum_n(dNm, cH) * filmFresnel_n(cH) * 3.2 * smoothstep(0.0, 0.35, cH);
        film *= 5.0 + U.energy * 2.0;
        film = mix(film, film * chordRamp_n(U, fract(fb + dNm * 0.0006)), 0.35);
        float s1 = pow(cH, 220.0);
        float3 spec = float3(1.0, 0.98, 0.94) * s1 * (1.0 + U.treble * 0.6);
        float a = clamp(F * 5.0 + s1, 0.0, 1.0) * smoothstep(1.0, 0.965, r);
        col += (film + spec) * a * (0.55 + amp * 0.7 + U.onsetEnv * 0.10);
    }
    // the fizz: micro-bubbles rising on the treble
    for (int z = 0; z < 20; z++) {
        float fz = (float(z) + 0.5) / 20.0;
        float h1 = fract(fz * 127.1), h2 = fract(fz * 311.7), h3 = fract(fz * 74.7);
        float rise = fmod(h2 * 60.0 + U.time * (0.12 + h3 * 0.17), 2.4) - 1.2;
        float2 c = float2((h1 - 0.5) * 1.6 + sin(U.time * (1.2 + h3) + h2 * 40.0) * 0.02, rise);
        float2 dz = p - c;
        float g = exp(-dot(dz, dz) * 60000.0);
        col += chordRamp_n(U, fz) * g * (0.4 + U.treble * 0.8);
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// DRIFT — the illusions. Four classic plates whose MOTION exists
// only in the visual system: rotating snakes, the bulge, Leviant's
// Enigma, the Ouchi disc. The pattern never moves — the light
// breathes, the beat jogs the whole field a hair, and the eye
// does the rest. Under CALM the plates stay but the motion signal
// is defused, exactly as the web does it.
// ===============================================================
inline float3 atLuma_n(float3 c, float L) {
    float y = dot(c, float3(0.2126, 0.7152, 0.0722));
    if (L <= y) return c * (L / max(y, 1e-5));
    return mix(c, float3(1.0), clamp((L - y) / max(1.0 - y, 1e-5), 0.0, 1.0));
}
fragment float4 room_drift(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    int form = int(U.roll0 * 3.999);
    float ampK = U.calm > 0.5 ? 0.55 : 1.0;         // reduce-motion defuses the signal
    // the jog: a stiff spring kicked by the beat, reconstructed from the
    // onset envelope's own decay clock — always returns exactly to zero
    float since = -log(max(U.onsetEnv, 1e-3)) * 0.25;
    float sgn = hash11_n(floor(U.time * 1.7)) < 0.5 ? -1.0 : 1.0;
    float jog = sgn * (0.035 + U.energy * 0.030) * ampK * exp(-6.5 * since) * sin(8.8 * since);
    float cj = cos(jog), sj = sin(jog);
    float2 q = float2(p.x * cj - p.y * sj, p.x * sj + p.y * cj);
    float rad = length(q);
    float ang = atan2(q.y, q.x);
    // the asymmetric four-step run: dark mid on the climb, light mid on the fall
    float4 steps = float4(0.02, 0.26 + U.roll1 * 0.10, 0.98, 0.66 + U.roll1 * 0.10);
    if (U.calm > 0.5) steps = float4(0.03, 0.50, 0.98, 0.50);
    float L = 0.5, hue = 0.0, sat = 0.5;
    if (form == 0) {
        // ROTATING SNAKES / RAINBOW SPIRAL
        float spiral = U.roll2 > 0.55 ? (U.roll2 > 0.775 ? 1.0 : -1.0) : 0.0;
        float rings = 6.5 + U.roll1 * 3.5;
        float ringF = rad * rings + spiral * (ang / TAU_N);
        float ring = floor(ringF), rf = fract(ringF);
        float cells = max(8.0, floor(TAU_N * (ring + 0.5)));
        float dirn = fmod(ring, 2.0) < 0.5 ? 1.0 : -1.0;
        float a = fract((ang / TAU_N + 0.5) * cells);
        float qq = dirn > 0.0 ? a : 1.0 - a;
        int st = int(qq * 3.999);
        L = 0.5 + (steps[st] - 0.5) * ampK;
        float bandm = smoothstep(0.10, 0.20, rf) * (1.0 - smoothstep(0.80, 0.90, rf));
        L = mix(0.5, L, bandm);
        hue = fract(ring * 0.17 + U.treble * 0.6 + U.roll2);
        sat = mix(0.10, 1.0, bandm);
    } else if (form == 1) {
        // BULGE / DENT — shape from shading, every tile mid-grey on average
        float sgn2 = U.roll2 < 0.5 ? 1.0 : -1.0;
        float cr = U.roll2 * 1.57, cc2 = cos(cr), ss2 = sin(cr);
        float2 pr = float2(q.x * cc2 - q.y * ss2, q.x * ss2 + q.y * cc2);
        float cw = 0.075 * (0.8 + U.roll1 * 0.7);
        float2 g = pr / cw;
        float2 cid = floor(g);
        float2 f = fract(g) - 0.5;
        float2 cc = (cid + 0.5) * cw;
        float sig = 0.46;
        float dome = exp(-dot(cc, cc) / (2.0 * sig * sig));
        float2 grd = -cc / (sig * sig) * dome * sgn2;
        float am = clamp(length(grd) * sig / 0.6065, 0.0, 1.0);
        float e = clamp(dot(f, normalize(grd + float2(1e-5, 0.0))) * 2.0, -1.0, 1.0);
        L = 0.5 + e * am * 0.46 * ampK;
        float bord = max(abs(f.x), abs(f.y));
        L *= 1.0 - smoothstep(0.42, 0.50, bord) * 0.8;
        hue = fract(U.treble * 0.7 + U.roll1);
        sat = 0.5;
    } else if (form == 2) {
        // ENIGMA — flat annuli over a spoke fan; the annuli must stay FLAT
        float spokes = 36.0 + floor(U.roll1 * 5.0) * 8.0;
        float sp = 0.5 + 0.5 * sign(sin(ang * spokes));
        L = 0.5 + (mix(steps.x, steps.z, sp) - 0.5) * ampK;
        sat = 0.2;
        float rr = rad * (2.4 + U.roll1 * 1.2);
        float k = floor(rr), kf = fract(rr);
        float ann = smoothstep(0.28, 0.33, kf) * (1.0 - smoothstep(0.62, 0.67, kf));
        L = mix(L, 0.52, ann);
        hue = mix(fract(U.treble + U.roll2), fract(k * 0.29 + U.treble + U.roll2), ann);
        sat = mix(0.2, 1.0, ann);
    } else {
        // OUCHI — orthogonal checks; the disc slips on the beat
        float inside = smoothstep(0.44, 0.41, rad);
        float2 s = mix(float2(26.0, 5.0), float2(5.0, 26.0), inside);
        float2 qq2 = q + float2(jog * 0.9, 0.0) * inside;
        float chk = fmod(floor(qq2.x * s.x) + floor(qq2.y * s.y) + 8.0, 2.0);
        L = 0.5 + (mix(steps.x, steps.z, chk) - 0.5) * ampK;
        hue = fract(U.treble + inside * 0.42 + U.roll2);
        sat = 0.42;
    }
    float3 base = mix(float3(1.0), chordRamp_n(U, hue), sat);
    float3 col = atLuma_n(base, clamp(L, 0.0, 1.0));
    col *= 0.86 + U.energy * 0.20 + U.onsetEnv * 0.06;   // the LIGHT breathes; the pattern never does
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(col, U.white), 1.0);
}


// ===============================================================
// FILAMENT — a current, looking for something to carry. The two
// closed-form faces of the web's wire (the coiled coil and the
// torus knot), three nested strands, a bright pulse running the
// arclength on the music's pace — seen through a slightly bad
// lens: real chromatic aberration, worse on the drop, vanishing
// dead centre. HEAVY.
// ===============================================================
inline float3 filPoint_n(float u, float s, float face, constant VizUniforms& U) {
    if (face < 0.5) {
        // COILED COIL: a helix wound on a ring. The web's second winding
        // (k2 ≈ 200/turn) is far below any polyline's resolving power here —
        // it comes back as a glow shimmer in the fragment, not as geometry.
        float R = 0.62 + U.roll1 * 0.15 + s * 0.04;
        float r1 = 0.15 + U.roll2 * 0.05;
        float k1 = 6.0 + floor(U.roll1 * 4.0);          // 6-9 wraps: smooth at 72 samples
        return float3((R + r1 * cos(k1 * u)) * cos(u),
                      (R + r1 * cos(k1 * u)) * sin(u),
                      r1 * sin(k1 * u));
    }
    // TORUS KNOT (p,q) — coprime pairs by the roll
    float P = U.roll2 < 0.5 ? 2.0 : 3.0;
    float Q = U.roll2 < 0.25 ? 3.0 : (U.roll2 < 0.5 ? 5.0 : (U.roll2 < 0.75 ? 4.0 : 7.0));
    float th = u * P + s * 0.9;
    float w = Q * th / P;
    return float3((2.0 + cos(w)) * cos(th), (2.0 + cos(w)) * sin(th), sin(w) * 1.6) * (0.30 + s * 0.015);
}
fragment float4 room_filament(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_n(U);
        p += d * (U.ghostStrength * 0.30 / (dot(d, d) + 0.35));
    }
    float face = U.roll0 < 0.55 ? 0.0 : 1.0;
    float chroma = (0.06 + U.roll1 * 0.06) * (0.7 + U.energy * 0.5 + U.onsetEnv * 0.25);
    float k = chroma * (0.35 + clamp(length(p), 0.0, 1.6));
    float flow = U.time * 0.14 * (U.roll2 < 0.5 ? 1.0 : -1.0);
    float3 col = float3(0.0);
    for (int s = 0; s < 3; s++) {
        float fs = float(s);
        float2 prev = float2(0.0);
        for (int i = 0; i <= 72; i++) {
            float aT = float(i) / 72.0;
            float u = aT * TAU_N;
            float3 w3 = filPoint_n(u, fs, face, U);
            float2 q = proj3_n(w3, U.time * 1.2);
            if (i > 0) {
                float d = segd_n(p, prev, q);
                float amp = band_n(spectrum, int(aT * 63.0));
                float head = fract(aT - flow - fs * 0.31);
                float pulse = exp(-head * head * 260.0) + exp(-(1.0 - head) * (1.0 - head) * 260.0);
                // the second winding, as light: the microcoil's shimmer
                float micro = face < 0.5 ? 0.75 + 0.25 * sin(u * 52.0 + U.time * 2.0) : 1.0;
                float glow = (0.24 + amp * 1.1 + pulse * (0.7 + U.onsetEnv * 0.9) + U.energy * 0.25) * micro;
                float3 ink = chordRamp_n(U, fract(aT * 1.6 + fs * 0.37 + U.treble * 0.5));
                // the bad lens: red's disc runs long, blue's runs out sooner
                float sR = exp(-d * d * 15000.0 * (1.0 - k) * (1.0 - k));
                float sG = exp(-d * d * 15000.0);
                float sB = exp(-d * d * 15000.0 * (1.0 + k) * (1.0 + k));
                col += float3(ink.r * sR, ink.g * sG, ink.b * sB) * glow * 0.55;
                col += float3(1.0) * sG * sG * clamp(glow - 0.9, 0.0, 1.2) * 0.35;
            }
            prev = q;
        }
    }
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// SOAP FILM — a film drains on its own clock. The thickness field
// is gravity's: thick at the foot, thinning at the crown, plumes
// stretched sideways by the bands and rising as marginal
// regeneration says they must; the colour is the interference
// integral over that thickness — and where the film reaches zero
// it goes BLACK, a hole and not a smudge. The story arc drains
// it: by the resolve the black film is eating the frame. HEAVY.
// ===============================================================
fragment float4 room_soapfilm(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = centeredUp_n(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_n(U);
        uv += d * (U.ghostStrength * 0.04 / (dot(d, d) + 0.35));
    }
    // the age the roll deals, then the arc drains: top first, foot slowly
    float top0, bot0;
    if (U.roll0 < 0.5)      { top0 = 180.0; bot0 = 1050.0; }   // DRAINING — the whole ladder
    else if (U.roll0 < 0.75){ top0 = 620.0; bot0 = 1500.0; }   // NEW FILM — washed pastel
    else                    { top0 = 8.0;   bot0 = 640.0;  }   // BLACK FILM — seconds to live
    float drainT = clamp(U.act / 4.0, 0.0, 1.0);
    float hTop = max(6.0, top0 * (1.0 - drainT * 0.8));
    float hBot = max(240.0, bot0 * (1.0 - drainT * 0.35));
    float depth = uv.y;                                        // 0 at the top of the frame
    // the crown PLUNGES to the black film — a hole in the light, not a
    // smudge: the top of a draining film really has almost nothing left
    float base = mix(hTop * smoothstep(-0.02, 0.24, depth), hBot, pow(depth, 1.45));
    // plumes: stretched sideways, advected upward — thin patches rise
    float rise = (0.05 + U.roll1 * 0.09) * (0.6 + U.energy * 0.9 + U.onsetEnv * 0.3);
    float churn = 0.55 + (0.55 * U.treble + 0.60 * U.onsetEnv) * 0.7 + U.mid * 0.3;
    float2 flow = float2(uv.x * (1.4 + U.roll1 * 1.1), uv.y * (9.0 + U.roll2 * 5.0) + U.time * rise);
    float n1 = fbm3_n(flow);
    float n2 = fbm3_n(flow * 2.7 + float2(n1 * 1.4, -U.time * rise * 1.6));
    float n3 = vnoise_n(flow * 7.5 + float2(n2 * 2.0, -U.time * rise * 2.4));
    float h = max(0.0, base * (0.42 + 1.05 * n1 * (0.55 + churn * 0.6) + 0.30 * n2 * churn + 0.10 * n3 * churn));
    // the membrane's slow breathing tilts the normal a little
    float wob = sin(uv.x * 9.0 + U.time * 0.55) * (0.9 + U.bass * 1.4) * 0.02
              + sin(uv.y * 14.0 - U.time * 0.71) * (0.45 + U.mid * 0.5) * 0.02;
    float ci = clamp(0.92 - abs(wob) * 3.0 - length(p) * 0.10, 0.35, 1.0);
    float F = filmFresnel_n(ci);
    /* coherence: past ~a micron the fringes pack tighter than the eye's
       three channels resolve and the film reads PEARL, not acid — the web
       gets this for free from its 26-sample CIE integral; the 3-λ port
       earns it by letting the spectral contrast decay with thickness. */
    float coh = exp(-h / 1300.0);
    float3 s1 = mix(float3(0.5), filmSpectrum_n(h, ci), coh);
    float3 s2 = mix(float3(0.5), filmSpectrum_n(h * 1.18 + 40.0, max(ci * 0.72, 0.05)), coh * 0.8);
    // the black film: below ~60 nm every wavelength cancels at once
    float dark = smoothstep(90.0, 25.0, h);
    float3 film = (s1 * F * 4.0 + s2 * F * 1.6) * (1.0 - dark);
    film *= (17.0 + U.roll2 * 9.0) * (0.85 + U.energy * 0.35) * 0.19;
    // a wandering highlight along the crown
    float spec = pow(max(1.0 - abs(uv.y - 0.18 - wob * 2.0) * 6.0, 0.0), 3.0) * F * 3.0;
    float3 col = film + float3(1.0, 0.98, 0.95) * spec;
    col *= 0.85 + U.energy * 0.35 + U.onsetEnv * 0.12;
    // the frame: the two wires, and the film's own reflectance as its alpha
    float ed = abs(uv.y - 0.5) * 2.0;
    float inside = 1.0 - smoothstep(0.962, 0.999, ed);
    float rim = smoothstep(0.936, 0.966, ed) * (1.0 - smoothstep(0.984, 1.0, ed));
    // the film's reflectance shades toward the void, but softly — squaring
    // the light away is how round 2 lost the pearl
    float aa = clamp(max(col.r, max(col.g, col.b)) * 3.2, 0.0, 1.0);
    col = col * inside * (0.35 + 0.65 * aa) + float3(0.78, 0.83, 0.92) * rim * 0.7;
    col += (hash21_n(pos.xy) - 0.5) * 0.006;
    return float4(govern_n(VOID_N + max(col, float3(0.0)), U.white), 1.0);
}
