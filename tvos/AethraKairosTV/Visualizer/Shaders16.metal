#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 13 — THE SKY: ORRERY, LENSING, PULSAR, ANALEMMA,
   ECLIPSE. The astronomy wing, all of it closed form.

   The orrery solves Kepler's equation honestly every frame (four
   Newton steps — the planets truly rush their perihelia) and its
   PTOLEMY face watches the same sky from home, where the sampled
   difference of two orbits draws the retrograde loops. The lens
   is the thin-lens equation itself, beta = theta − thetaE²/theta,
   applied per pixel, so Einstein's ring and cross fall out of one
   line. The pulsar's stacked ridge plot seeds each past rotation
   from its own index, so the history scrolls with no state kept
   anywhere. The analemma is the equation of time against the
   sun's declination, walked by the story clock. The eclipse's
   obscuration is the honest circle-circle overlap, its corona
   masked outside the limb, its diamond ring fired by geometry.

   Laws as ever: void ground, chord-only colour, govern_t() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 52 here).
   All symbols wear _t — a self-contained translation unit.
   ================================================================ */

constant float PI_T  = 3.14159265359;
constant float TAU_T = 6.28318530718;
constant float3 VOID_T = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

inline float3 govern_t(float3 c, float white) {
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
inline float hash21_t(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_t(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_t(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_t(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float wraps_t(float a) { return fmod(a + PI_T, TAU_T) - PI_T; }


// ===============================================================
// ORRERY — the clockwork sky: Kepler's equation, four Newton
// steps, honest per frame. COPERNICUS and CONJUNCTION watch the
// sun; PTOLEMY watches from home, where the sampled difference
// of two orbits draws the retrograde loops itself.
// ===============================================================
static float2 kepler_t(float a, float e, float M) {
    float E = M;
    for (int k = 0; k < 4; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
    return float2(a * (cos(E) - e), a * sqrt(1.0 - e * e) * sin(E));
}
static float orbA_t(float i) { return 0.145 + i * 0.152; }
static float orbE_t(float i) { return i < 0.5 ? 0.21 : 0.04 + 0.035 * fract(sin(i * 37.7) * 43758.5); }
static float meanM_t(float i, float t, float varA) {
    float a = orbA_t(i);
    return i * 2.39996 + varA * TAU_T + t / pow(a, 1.5) * 0.42;   // Kepler III sets the gears
}

fragment float4 room_orrery(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_t(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_t(U);
        p += dh * (U.ghostStrength * 0.22 / (dot(dh, dh) + 0.28));  // a hand is a mass among masses
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float clock = U.time * 0.55;
    bool geo = mode == 1;
    float zoom = mode == 2 ? 0.52 : 1.18;
    p *= zoom;
    float3 col = float3(0.0);
    float2 earth = kepler_t(orbA_t(2.0), orbE_t(2.0), meanM_t(2.0, clock, varA));
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float a = orbA_t(fi), e = orbE_t(fi);
        float2 posP = kepler_t(a, e, meanM_t(fi, clock, varA));
        if (geo) {
            /* PTOLEMY watched five wanderers and the sun. Each trail steps by
               half a radian of ITS OWN anomaly, so the fast stay smooth and
               the slow reach back far enough for their loops to close. */
            if (i == 2 || i > 5) continue;
            float2 tp = posP - earth;
            float dtb = 1.19 * pow(a, 1.5);
            for (int s2 = 1; s2 < 15; s2++) {
                float tb = clock - float(s2) * dtb;
                float2 pp = kepler_t(a, e, meanM_t(fi, tb, varA))
                          - kepler_t(orbA_t(2.0), orbE_t(2.0), meanM_t(2.0, tb, varA));
                float d2 = length(p - pp);
                col += chordRamp_t(U, 0.16 + fi * 0.075) * exp(-d2 * d2 / 0.00010) * exp(-float(s2) * 0.14) * 0.42;
            }
            float d = length(p - tp);
            float sz = 0.015 + 0.005 * fmod(fi, 3.0);
            col += chordRamp_t(U, 0.14 + fi * 0.075) * exp(-d * d / (sz * sz)) * (0.85 + U.onsetEnv * 0.3);
            col += chordRamp_t(U, 0.14 + fi * 0.075) * exp(-d * 26.0) * 0.06;
            continue;
        }
        // the orbit path, each sphere lit by its own band — the music of the spheres
        {
            float b = a * sqrt(1.0 - e * e);
            float2 q = float2((p.x + a * e) / a, p.y / b);
            float ring = abs(length(q) - 1.0);
            float band = spectrum.read(uint2(uint(2 + i * 7), 0)).r;
            col += chordRamp_t(U, 0.30 + fi * 0.055) * exp(-ring * (90.0 - 30.0 * min(fi, 1.0)))
                 * (0.05 + band * (mode == 2 ? 0.55 : 0.25));
        }
        // the trail hugs the path, fading with angular lag; then the planet
        {
            float b2 = a * sqrt(1.0 - e * e);
            float2 q = float2((p.x + a * e) / a, p.y / b2);
            float onPath = exp(-abs(length(q) - 1.0) * 120.0);
            float Enow = atan2(q.y, q.x);
            float Epl = atan2(posP.y, posP.x + a * e);
            float lag = fmod(Epl - Enow + TAU_T, TAU_T);
            col += chordRamp_t(U, 0.16 + fi * 0.075) * onPath * exp(-lag * 1.35) * (0.35 + U.energy * 0.3);
            float d = length(p - posP);
            float sz = 0.016 + 0.006 * fmod(fi, 3.0);
            col += chordRamp_t(U, 0.14 + fi * 0.075) * exp(-d * d / (sz * sz)) * (0.85 + U.onsetEnv * 0.3);
            col += chordRamp_t(U, 0.14 + fi * 0.075) * exp(-d * 26.0) * 0.10;
        }
    }
    // conjunctions ring like chimes: adjacent pairs near one longitude
    for (int i = 0; i < 7; i++) {
        if (geo && (i == 1 || i == 2 || i > 4)) continue;
        float fi = float(i);
        float2 pa = kepler_t(orbA_t(fi), orbE_t(fi), meanM_t(fi, clock, varA));
        float2 pb = kepler_t(orbA_t(fi + 1.0), orbE_t(fi + 1.0), meanM_t(fi + 1.0, clock, varA));
        if (geo) { pa -= earth; pb -= earth; }
        float dl = abs(wraps_t(atan2(pa.y, pa.x) - atan2(pb.y, pb.x)));
        if (dl < 0.10) {
            float2 ab = pb - pa; float L = length(ab); float2 dir = ab / max(L, 1e-4);
            float along = clamp(dot(p - pa, dir), 0.0, L);
            float dc = length(p - (pa + dir * along));
            col += chordRamp_t(U, 0.82) * exp(-dc * 90.0) * (1.0 - dl / 0.10) * (0.25 + U.onsetEnv * 0.55);
        }
    }
    float r = length(p);
    if (!geo) {
        // the belt: dust between the fourth and fifth spheres, lit by the highs
        float belt = smoothstep(0.62, 0.68, r) * smoothstep(0.80, 0.74, r);
        float grain = step(0.986, hash21_t(floor(p * 240.0) + floor(clock * 0.5)));
        col += chordRamp_t(U, 0.5) * belt * grain * (0.25 + U.treble * 0.8);
    }
    float dc0 = length(p);
    if (geo) {
        col += chordRamp_t(U, 0.62) * exp(-dc0 * dc0 / 0.0004) * 1.1;      // home, a cool jewel
        col += chordRamp_t(U, 0.55) * exp(-abs(dc0 - 0.05) * 120.0) * 0.4;
        // Ptolemy's sun: the sixth wanderer, circling home with its own trail
        for (int s3 = 0; s3 < 15; s3++) {
            float tb = clock - float(s3) * 0.36;
            float2 sp = -kepler_t(orbA_t(2.0), orbE_t(2.0), meanM_t(2.0, tb, varA));
            float d2 = length(p - sp);
            float lead = s3 == 0 ? 1.0 : 0.0;
            col += chordRamp_t(U, 0.06) * exp(-d2 * d2 / (0.0004 + lead * 0.0006))
                 * (exp(-float(s3) * 0.16) * 0.5 + lead * 0.9);
        }
    } else {
        col += chordRamp_t(U, 0.06) * exp(-dc0 * dc0 / 0.0016) * (1.2 + U.bass * 0.8);
        col += chordRamp_t(U, 0.10) * exp(-dc0 * 9.0) * (0.16 + U.bass * 0.22);
    }
    col += (hash21_t(pos.xy) - 0.5) * 0.006;
    return float4(govern_t(VOID_T + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// LENSING — gravity's own glass: beta = theta − thetaE²/theta at
// every pixel, so the arcs, the doubling, the ring and the cross
// are never painted — they fall out of the one equation.
// ===============================================================
static float3 deepField_t(constant VizUniforms& U, float2 s, float2 gal, float t) {
    float3 col = float3(0.0);
    for (int oct = 0; oct < 2; oct++) {
        float sc = oct == 0 ? 16.0 : 34.0;
        float2 cell = floor(s * sc);
        float2 fr = fract(s * sc) - 0.5;
        float h = hash21_t(cell + float(oct) * 71.0);
        if (h > 0.90) {
            float2 off = float2(hash21_t(cell + 3.1), hash21_t(cell + 7.7)) - 0.5;
            float d = length(fr - off * 0.8);
            float tw = 0.75 + 0.25 * sin(t * (1.0 + h * 5.0) + h * 40.0);
            col += chordRamp_t(U, 0.62 + h * 0.2) * exp(-d * d * (900.0 + h * 900.0)) * tw * (oct == 0 ? 0.9 : 0.45);
        }
    }
    float2 g = s - gal;
    g = float2x2(float2(0.86, 0.5), float2(-0.5, 0.86)) * g;
    g.y *= 2.2;
    float r = length(g);
    float th = atan2(g.y, g.x);
    float arm = cos(2.0 * (th - log(max(r, 1e-4)) * 3.4));
    float disc = exp(-r * 6.0);
    col += chordRamp_t(U, 0.24) * exp(-r * 16.0) * 1.3;
    col += chordRamp_t(U, 0.55) * disc * smoothstep(0.15, 1.0, arm) * 0.55;
    col += chordRamp_t(U, 0.42) * disc * 0.18;
    return col;
}

fragment float4 room_lensing(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_t(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    bool micro = mode == 2;
    float clock = U.time * 0.7;
    float varA = U.roll1;
    float2 c = micro ? float2(fmod(clock * 0.12, 2.4) - 1.2, 0.12 * sin(clock * 0.1))
                     : float2(0.42 * sin(clock * 0.11 + varA * TAU_T), 0.30 * sin(clock * 0.073));
    if (U.ghostStrength > 0.05) c = mix(c, ghostUp_t(U), min(U.ghostStrength * 1.4, 1.0));  // the hand IS a mass
    float thetaE = micro ? 0.055 : 0.15 + U.bass * 0.11;
    float2 gal = float2(0.34 * sin(clock * 0.05 + 2.1), 0.24 * cos(clock * 0.043));
    float2 tv = p - c;
    float t2 = max(dot(tv, tv), 1e-6);
    float2 beta = tv - thetaE * thetaE * tv / t2;
    if (mode == 1) beta -= 0.22 * float2(tv.x, -tv.y);            // the shear that makes the cross
    float3 col = deepField_t(U, c + beta, gal, U.time);
    float align = micro ? 0.0 : exp(-dot(c - gal, c - gal) * 6.0);
    float ring = exp(-pow((length(tv) - thetaE) * 26.0, 2.0));
    col += chordRamp_t(U, 0.8) * ring * align * (0.12 + U.mid * 0.2 + U.onsetEnv * 0.15);
    if (micro) {
        // the survey strip: Paczynski's curve written by the sweep itself
        float y0 = -0.78;
        if (p.y < y0 + 0.30) {
            float xx = (p.x / max(U.aspect, 1e-4)) * 0.5 + 0.5;
            float tPast = clock - (1.0 - xx) * 24.0;
            float2 cPast = float2(fmod(tPast * 0.12, 2.4) - 1.2, 0.12 * sin(tPast * 0.1));
            float u = length(cPast - float2(0.31, 0.05)) / 0.16;
            float A = (u * u + 2.0) / max(u * sqrt(u * u + 4.0), 1e-3);
            float trace = y0 + 0.03 + clamp((A - 1.0) * 0.09, 0.0, 0.22);
            col *= 0.25;
            col += chordRamp_t(U, 0.7) * exp(-abs(p.y - trace) * 160.0) * 0.9;
            col += chordRamp_t(U, 0.3) * exp(-abs(p.y - y0) * 300.0) * 0.3;
        }
    }
    col += (hash21_t(pos.xy) - 0.5) * 0.006;
    return float4(govern_t(VOID_T + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// PULSAR — the lighthouse that keeps time: dipole petals, twin
// beams, and THE STACK's ridge plot whose history scrolls because
// each past rotation is seeded by its own index — no state kept.
// ===============================================================
static float profile_t(float x, float rotIdx) {
    float h1 = hash21_t(float2(rotIdx, 3.7));
    float h2 = hash21_t(float2(rotIdx, 9.1));
    float c = 0.5 + (h1 - 0.5) * 0.10;
    float w = 0.018 + h2 * 0.03;
    float a = 0.35 + h1 * 0.6;
    float main1 = a * exp(-pow((x - c) / w, 2.0));
    float inter = 0.22 * h2 * exp(-pow((x - c + 0.09) / 0.05, 2.0));
    float noise = 0.045 * (hash21_t(float2(floor(x * 90.0), rotIdx)) - 0.5);
    return main1 + inter + noise;
}

fragment float4 room_pulsar(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 r2 = max(res, float2(1.0));
    float2 uv = pos.xy / r2;
    uv.y = 1.0 - uv.y;                                   // read the plots y-up
    float2 p = centeredUp_t(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_t(U);
        float sw = U.ghostStrength * 0.35 / (dot(dh, dh) + 0.2);
        p = float2(p.x - dh.y * sw, p.y + dh.x * sw);     // a hand torques the magnetosphere
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float spin = U.time * 2.2;
    float rot = U.time * 0.35;
    float3 col = float3(0.0);
    if (mode == 0) {
        /* THE LIGHTHOUSE */
        float r = length(p);
        float th = atan2(p.y, p.x);
        float axis = spin;
        float wob = 0.35 * sin(spin * 0.23 + varA * TAU_T);
        float lam = th - axis;
        for (int i = 0; i < 4; i++) {
            float L = 0.30 + float(i) * 0.26;
            float d = abs(r - L * pow(sin(lam), 2.0));
            float d2 = abs(r - L * pow(sin(lam + PI_T), 2.0));
            col += chordRamp_t(U, 0.35 + float(i) * 0.06) * (exp(-d * 60.0) + exp(-d2 * 60.0))
                 * (0.05 + U.mid * 0.10) * exp(-r * 0.8);
        }
        float bw = 0.16 + U.bass * 0.10;
        float beam = exp(-pow(wraps_t(th - axis - wob) / bw, 2.0))
                   + exp(-pow(wraps_t(th - axis - wob + PI_T) / bw, 2.0));
        col += chordRamp_t(U, 0.72) * beam * exp(-r * 1.9) * (0.5 + U.energy * 0.45);
        float sweep = exp(-pow(wraps_t(axis + wob) / 0.13, 2.0));
        col += chordRamp_t(U, 0.85) * sweep * exp(-r * 2.6) * 0.5;
        col += chordRamp_t(U, 0.9) * exp(-r * r / 0.0006) * (1.4 + sweep * 1.2);
        col += chordRamp_t(U, 0.5) * exp(-abs(r - 0.05 - U.onsetEnv * 0.012) * 150.0) * 0.5;
        float2 cell = floor((p + 9.0) * 15.0);
        if (hash21_t(cell) > 0.94) {
            float2 fr = fract((p + 9.0) * 15.0) - 0.5;
            col += chordRamp_t(U, 0.63) * exp(-dot(fr, fr) * 700.0) * 0.4;
        }
    } else if (mode == 1) {
        /* THE STACK — eighteen rotations as a ridge line, front row live */
        float x = uv.x;
        bool occ = false;
        for (int k = 0; k < 18; k++) {
            float fk = float(k);
            float base = 0.10 + fk * 0.042;
            float rotIdx = rot - fk;
            float prof = profile_t(x, floor(rotIdx));
            if (k == 0) {
                float w = spectrum.read(uint2(uint(19.0 + abs(x - 0.5) * 2.0 * 13.0), 0)).r;
                prof = prof * 0.55 + w * 0.5 * exp(-pow((x - 0.5) / 0.16, 2.0));
            }
            float line = base + prof * 0.14;
            float d = uv.y - line;
            if (!occ) {
                col += chordRamp_t(U, 0.28 + fk * 0.012) * exp(-abs(d) * (300.0 - fk * 9.0)) * (1.0 - fk * 0.045);
                if (d < -0.002) occ = true;               // the nearer ridge hides the farther
            }
        }
    } else {
        /* DISPERSION — frequency against time, the chirps the sky sends */
        float x = uv.x, band = uv.y;
        float live = spectrum.read(uint2(uint(clamp(band * 0.62 + 0.02, 0.0, 1.0) * 63.0), 0)).r;
        for (int k = 0; k < 6; k++) {
            float rotIdx = floor(rot) - float(k);
            float age = rot - rotIdx;
            float nu = 0.55 + band * 0.45;
            float delay = 0.16 * (1.0 / (nu * nu) - 1.0) * (0.75 + 0.25 * hash21_t(float2(rotIdx, 1.3)));
            float d = abs(x - (1.0 - (age + delay) * 0.24));
            col += chordRamp_t(U, 0.30 + band * 0.45) * exp(-d * d * 2600.0) * (0.55 + live * 0.9)
                 * (0.95 - float(k) * 0.12);
        }
        col += chordRamp_t(U, 0.55) * (0.03 + live * 0.14) * (0.6 + 0.4 * sin(band * 200.0));
    }
    col += (hash21_t(pos.xy) - 0.5) * 0.006;
    return float4(govern_t(VOID_T + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// ANALEMMA — the year, photographed: the equation of time against
// the sun's declination, THE SONG FOR THE YEAR (the story clock
// walks January to December). THE PLATE is every exposure at
// once; THE MOON walks its wilder eight through the night.
// ===============================================================
static float2 sunAt_t(float N, float moon) {
    float B = TAU_T * (N - 81.0) / 365.0;
    float eot = 9.87 * sin(2.0 * B) - 7.53 * cos(B) - 1.5 * sin(B);
    float dec = 23.44 * sin(TAU_T * (N + 284.0) / 365.0);
    if (moon > 0.5) {
        float M = TAU_T * N / 27.3;
        eot = 22.0 * sin(2.0 * M + 0.6) - 9.0 * cos(M);
        dec = 25.0 * sin(M + 2.1);
    }
    return float2(eot * 0.022, dec * 0.021 + 0.22);
}

fragment float4 room_analemma(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_t(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_t(U);
        p += float2(dh.y, -dh.x) * (U.ghostStrength * 0.10 / (dot(dh, dh) + 0.25));  // a breeze over the plate
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    bool plate = mode == 1;
    bool moon = mode == 2;
    float varA = U.roll1;
    float Y = clamp(U.act * 0.25, 0.0, 1.0);              // the story clock, 0..1 through the act arc
    float2 sunNow = sunAt_t(Y * 365.0, moon ? 1.0 : 0.0);
    float3 col = float3(0.0);
    float season = 0.5 - 0.5 * cos(TAU_T * (Y + 0.03));
    float skyH = smoothstep(-1.0, 1.0, p.y);
    if (moon) {
        col += chordRamp_t(U, 0.62) * (0.04 + 0.03 * (1.0 - skyH));
        float2 cell = floor((p + 7.0) * 18.0);
        if (hash21_t(cell) > 0.93) {
            float2 fr = fract((p + 7.0) * 18.0) - 0.5;
            float tw = 0.7 + 0.3 * sin(U.time * (1.0 + hash21_t(cell + 1.0) * 4.0));
            col += chordRamp_t(U, 0.68) * exp(-dot(fr, fr) * 800.0) * tw * 0.6;
        }
    } else {
        col += mix(chordRamp_t(U, 0.60), chordRamp_t(U, 0.10), season * 0.35)
             * (0.05 + 0.09 * (1.0 - skyH)) * (0.5 + season * 0.5);
    }
    float ridge = -0.48 + 0.05 * sin(p.x * 2.1 + varA * TAU_T) + 0.03 * sin(p.x * 5.3 + 1.3);
    float ground = smoothstep(0.015, -0.015, p.y - ridge);
    col *= 1.0 - ground * 0.92;
    col += chordRamp_t(U, 0.30) * exp(-abs(p.y - ridge) * 120.0) * 0.22;
    float gx = 0.62;
    if (abs(p.x - gx) < 0.028 && p.y > ridge - 0.02 && p.y < ridge + 0.34) {
        col *= 0.06;
        col += chordRamp_t(U, 0.25) * exp(-abs(p.x - gx - 0.03) * 90.0) * (0.2 + season * 0.2);
    }
    // the exposures: 52 weeks on one plate
    for (int w = 0; w < 52; w++) {
        float N = float(w) * 7.02;
        float frac = N / 365.0;
        float2 sp = sunAt_t(N, moon ? 1.0 : 0.0);
        float d = length(p - sp);
        bool taken = plate || frac <= Y;
        float g = exp(-d * d / 0.00022);
        if (taken) {
            col += (moon ? chordRamp_t(U, 0.64) : chordRamp_t(U, 0.12 + frac * 0.06)) * g * (plate ? 0.55 : 0.5);
        } else {
            col += chordRamp_t(U, 0.55) * exp(-d * d / 0.00006) * 0.10;   // appointments not yet kept
        }
        if (plate) {
            col += chordRamp_t(U, 0.2) * exp(-abs(p.y - sp.y) * 200.0)
                 * smoothstep(0.35, 0.0, abs(p.x - sp.x)) * 0.03;         // the day's own streak
        }
    }
    // the sun of THIS week, burning at the head of the eight
    float dNow = length(p - sunNow);
    float3 sunCol = moon ? chordRamp_t(U, 0.66) : chordRamp_t(U, 0.08);
    col += sunCol * exp(-dNow * dNow / 0.0011) * (1.3 + U.energy * 0.6);
    col += sunCol * exp(-dNow * 3.4) * (0.20 + U.bass * 0.18);
    if (moon) {
        float ph = fract(Y * 13.4);
        float dSh = length(p - sunNow - float2((ph - 0.5) * 0.14, 0.0));
        float shadow = smoothstep(0.040, 0.030, dSh);
        col -= sunCol * exp(-dNow * dNow / 0.0011) * shadow * 1.1;
    }
    // the stations of the year ring as the song passes them
    for (int s = 0; s < 4; s++) {
        float NS = float(s) * 91.3 + 79.0;
        float2 sp = sunAt_t(NS, moon ? 1.0 : 0.0);
        float near = exp(-pow((Y * 365.0 - NS) / 5.0, 2.0));
        col += chordRamp_t(U, 0.85) * exp(-abs(length(p - sp) - 0.045 - near * 0.02) * 90.0)
             * (0.06 + near * (0.4 + U.onsetEnv * 0.3));
    }
    col += chordRamp_t(U, 0.5) * exp(-abs(p.y - ridge - 0.05) * 30.0) * U.treble * 0.06
         * (0.5 + 0.5 * sin(p.x * 30.0 + U.time * 3.0));
    col += (hash21_t(pos.xy) - 0.5) * 0.006;
    return float4(govern_t(VOID_T + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// ECLIPSE — the appointment: the honest circle-circle overlap,
// the corona masked outside the limb, the diamond ring fired by
// geometry alone. The transit clock is SHAPED so it lingers at
// totality. ANNULAR is the ring of fire; PINHOLES watches the
// ground under a tree, every leaf-gap a camera.
// ===============================================================
static float overlapFrac_t(float d, float rs, float rm) {
    if (d >= rs + rm) return 0.0;
    if (d <= abs(rm - rs)) return min(1.0, (rm * rm) / (rs * rs));
    float d2 = d * d, rs2 = rs * rs, rm2 = rm * rm;
    float a1 = rs2 * acos((d2 + rs2 - rm2) / (2.0 * d * rs));
    float a2 = rm2 * acos((d2 + rm2 - rs2) / (2.0 * d * rm));
    float a3 = 0.5 * sqrt(max((-d + rs + rm) * (d + rs - rm) * (d - rs + rm) * (d + rs + rm), 0.0));
    return (a1 + a2 - a3) / (PI_T * rs2);
}

fragment float4 room_eclipse(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_t(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float varA = U.roll1;
    float rs = 0.30;
    bool annular = mode == 1;
    bool pinhole = mode == 2;
    float rm = annular ? 0.26 : 0.315;
    // the shaped transit: compressed near the middle, so totality lingers
    float u01 = fract(U.time * 0.011 + varA);
    float sgn = u01 < 0.5 ? -1.0 : 1.0;
    float t = sgn * pow(abs(2.0 * u01 - 1.0), 1.7) * 1.5;
    float2 mpos = float2(t, t * 0.18);
    if (U.ghostStrength > 0.05) mpos += (ghostUp_t(U) - mpos) * min(U.ghostStrength * 0.5, 0.55);
    float sep = length(mpos);
    float frac = overlapFrac_t(sep, rs, rm);
    float total = smoothstep(0.965, 0.998, frac);
    float3 col = float3(0.0);
    float skyLight = 1.0 - 0.93 * pow(frac, 1.5);
    if (pinhole) {
        col += mix(chordRamp_t(U, 0.32), chordRamp_t(U, 0.18), 0.5) * 0.05 * skyLight;
        for (int i = 0; i < 28; i++) {
            float fi = float(i);
            float2 c = float2(hash21_t(float2(fi, 1.0)) - 0.5, hash21_t(float2(fi, 2.0)) - 0.5)
                     * float2(2.0 * U.aspect, 2.0) * 0.92;
            float sc = 0.05 + hash21_t(float2(fi, 3.0)) * 0.05;
            float2 q = (p - c) / sc;
            float ds = length(q);
            float dm = length(q - mpos / rs);              // the same sky, in leaf-gap units
            float sun = smoothstep(1.05, 0.9, ds);
            float bite = smoothstep(0.9, 1.05, dm / (rm / rs));
            col += chordRamp_t(U, 0.10) * sun * bite * (0.34 + U.energy * 0.18) * skyLight;
        }
        float bands = smoothstep(0.7, 0.97, frac) * (1.0 - total);
        col *= 1.0 + bands * 0.20 * sin(p.x * 26.0 + p.y * 8.0 + U.time * 2.2) * (0.3 + U.mid * 0.7);
        col *= 1.0 - total * 0.85;
    } else {
        col += chordRamp_t(U, 0.58) * (0.10 + 0.06 * (1.0 - smoothstep(-1.0, 1.0, p.y))) * skyLight;
        float2 cell = floor((p + 7.0) * 16.0);
        if (hash21_t(cell) > 0.93) {
            float2 fr = fract((p + 7.0) * 16.0) - 0.5;
            col += chordRamp_t(U, 0.66) * exp(-dot(fr, fr) * 800.0) * (1.0 - skyLight) * 0.8;
        }
        col += chordRamp_t(U, 0.10) * exp(-pow((p.y + 0.86) * 4.5, 2.0)) * (1.0 - skyLight) * 0.5;
        float ds = length(p);
        float dm = length(p - mpos);
        float sun = smoothstep(rs + 0.004, rs - 0.004, ds);
        float limb = sqrt(max(1.0 - ds * ds / (rs * rs), 0.0));
        float bite = smoothstep(rm - 0.004, rm + 0.004, dm);
        float gran = 0.5 + 0.5 * sin(p.x * 60.0 + sin(p.y * 47.0 + U.time * 0.3) * 2.0) * sin(p.y * 53.0 - U.time * 0.2);
        col += chordRamp_t(U, 0.08) * sun * bite * (0.5 + 0.6 * limb) * (0.88 + gran * 0.14) * (1.0 - total * 0.9);
        col += chordRamp_t(U, 0.10) * exp(-max(ds - rs, 0.0) * 9.0) * bite * 0.16 * (1.0 - frac);
        if (annular) {
            col += chordRamp_t(U, 0.05) * exp(-abs(ds - rs + 0.02) * 60.0) * bite * frac * 0.8;  // the ring of fire
        }
        float rim = exp(-abs(dm - rm) * 200.0);
        col += float3(0.8, 0.15, 0.08) * rim * smoothstep(0.93, 0.99, frac) * (1.0 - total) * 0.55;
        float limbAng = atan2(p.y - mpos.y, p.x - mpos.x);
        float valley = step(0.72, hash21_t(float2(floor(limbAng * 14.0), varA * 40.0)));
        float bead = exp(-abs(dm - rm) * 300.0) * valley
                   * smoothstep(0.985, 0.955, frac) * smoothstep(0.90, 0.955, frac);
        col += chordRamp_t(U, 0.9) * bead * 1.4;
        float contact = exp(-pow((frac - 0.985) / 0.008, 2.0));
        float2 tip = mpos * (rs / max(sep, 1e-4));
        float dt2 = length(p - tip);
        col += chordRamp_t(U, 0.95) * contact
             * (exp(-dt2 * dt2 / 0.0009) * 2.2
                + exp(-abs(p.y - tip.y) * 200.0) * exp(-abs(p.x - tip.x) * 8.0) * 0.5);
        if (total > 0.0) {
            float th = atan2(p.y - mpos.y, p.x - mpos.x);
            float rr = max(dm / rm, 1.0);
            float streamer = 0.62 + 0.38 * (0.5 * cos(2.0 * th + varA * TAU_T)
                           + 0.3 * cos(3.0 * th - 1.1) + 0.2 * cos(7.0 * th + U.time * 0.10));
            float equator = 1.0 + 0.8 * pow(abs(cos(th)), 2.0);
            float cor = pow(1.0 / rr, 2.6) * streamer * equator;
            cor *= smoothstep(rm - 0.004, rm + 0.012, dm);  // the moon itself stays VOID
            col += chordRamp_t(U, 0.62) * cor * total * (0.9 + U.calm * 0.3);
            col += chordRamp_t(U, 0.75) * exp(-abs(dm - rm) * 90.0) * total * 0.5;
        }
        float bands = smoothstep(0.75, 0.97, frac) * (1.0 - total);
        col += chordRamp_t(U, 0.4) * bands * 0.05 * sin(p.x * 30.0 - U.time * 2.6)
             * exp(-pow(p.y + 0.6, 2.0) * 3.0) * (0.3 + U.mid * 0.7);
    }
    col += (hash21_t(pos.xy) - 0.5) * 0.006;
    return float4(govern_t(VOID_T + max(col, float3(0.0)), U.white), 1.0);
}
