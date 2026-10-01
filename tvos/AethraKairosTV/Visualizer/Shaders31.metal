#include <metal_stdlib>
using namespace metal;

/* ================================================================
   AURORA — the northern lights, in the true colours of their atoms.

   THE CURTAIN marches each ray through the upper atmosphere (Earth's curvature
   included) and finds where it crosses each auroral sheet; a sheet is a
   fold-and-curl surface hung along B (dip 79°). At a crossing the emission is
   the altitude profile of the three great lines — O 557.7 nm from the lower
   edge (set by the electrons' energy, i.e. the music's), O 630.0 nm above
   ~200 km, N2+ 427.8 nm at the hem — divided by |n·d|, the path length
   through a thin sheet: folds seen edge-on blaze. Looking up, rays parallel to
   B converge on the magnetic zenith. THE OVAL is the auroral oval from above
   (orthographic polar view, noon up), its equatorward drift, breakup bulge
   and westward travelling surge on a 24 s substorm clock; the limb view and
   the theta aurora. THE MIRROR: a dipole line r = L cos²λ, the gyrophase
   integrated per pixel (dΦ/ds ∝ B / v∥, v∥ = v sqrt(1 − B sin²α0/B0)), the
   gyroradius ∝ B^−1/2 and the mirror latitude from B(λm) = B0 / sin²α0 —
   the first adiabatic invariant, drawn.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildAurora() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_au: a self-contained translation unit.
   ================================================================ */

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

namespace rm_au {

constant float PI = 3.14159265359;
constant float3 VOID = float3(0.019608, 0.023529, 0.054902);

inline float3 govern(float3 c, float white) {
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
inline float3 chordRamp(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}

// the house dialect: GLSL's words for Metal's types
#define vec2 float2
#define vec3 float3
#define vec4 float4
#define mod(a, b) ((a) - (b) * floor((a) / (b)))
#define inversesqrt rsqrt
#define INOUT(T, n) thread T& n
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sq(float x){ return x * x; }
float glow(float d, float k){ return exp(-d * d * k); }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0); }
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0); return length(pa - ba * h); }
float ppow(float x, float y){ return exp2(y * log2(max(x, 1e-20))); }
float atan2s(float y, float x){ return atan2(y, (abs(x) + abs(y) < 1e-12) ? 1e-12 : x); }
float sinhx(float x){ return 0.5 * (exp(x) - exp(-x)); }
float coshx(float x){ return 0.5 * (exp(x) + exp(-x)); }
float tanhx(float x){ float e = exp(-2.0 * abs(x)); float t = (1.0 - e) / (1.0 + e); return x < 0.0 ? -t : t; }
float asinhx(float x){ float a = abs(x); float r = log(a + sqrt(a * a + 1.0)); return x < 0.0 ? -r : r; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float vnoise(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm4(vec2 x){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(x); x = rot(x, 0.6) * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b){ float d = max(dot(b, b), 1e-12); return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
vec2 csqrt(vec2 z){ float r = length(z); float a = sqrt(max(0.5 * (r + z.x), 0.0)); float b = sqrt(max(0.5 * (r - z.x), 0.0)); return vec2(a, z.y < 0.0 ? -b : b); }
vec2 clog(vec2 z){ return vec2(log(max(length(z), 1e-12)), atan2s(z.y, z.x)); }
/* a lit sphere's colour at q (unit disc coords), or the background passed in */
vec3 sphereShade(vec2 q, vec3 hue, vec3 bg, float spec){
  float r2 = dot(q, q);
  if (r2 > 1.0) return bg;
  vec3 n = vec3(q, sqrt(max(1.0 - r2, 0.0)));
  vec3 L = normalize(vec3(-0.45, 0.62, 0.64));
  float dif = max(0.0, dot(n, L));
  float sp = ppow(max(0.0, dot(reflect(-L, n), vec3(0.0, 0.0, 1.0))), 40.0);
  float edge = smoothstep(1.0, 0.90, sqrt(r2));
  return mix(bg, hue * (0.20 + 0.80 * dif) + vec3(sp * spec), edge);
}
/* THE EYE: the same observer GLSL_CIE builds, generated from the same CIE_LOBES
   and XYZ_TO_SRGB, so the web and the TV cannot disagree about 587 nm */
float cieGauss(float l, float mu, float s1, float s2){ float t = (l - mu) * (l < mu ? 1.0 / s1 : 1.0 / s2); return exp(-0.5 * t * t); }
vec3 wavelengthLinearRGB(float l){
  vec3 c = vec3(1.0560 * cieGauss(l, 599.8, 37.9, 31.0) + 0.3620 * cieGauss(l, 442.0, 16.0, 26.7) + -0.0650 * cieGauss(l, 501.1, 20.4, 26.2),
                0.8210 * cieGauss(l, 568.8, 46.9, 40.5) + 0.2860 * cieGauss(l, 530.9, 16.3, 31.1),
                1.2170 * cieGauss(l, 437.0, 11.8, 36.0) + 0.6810 * cieGauss(l, 459.0, 26.0, 13.8));
  return max(vec3(3.2406 * c.x + -1.5372 * c.y + -0.4986 * c.z,
                  -0.9689 * c.x + 1.8758 * c.y + 0.0415 * c.z,
                  0.0557 * c.x + -0.2040 * c.y + 1.0570 * c.z), vec3(0.0));
}
/* a colour's hue at full brightness */
vec3 hueOf(vec3 c){ return c / max(max(c.r, c.g), max(c.b, 1e-4)); }
/* the auroral sheet k: its northward range (km) at eastward x, folded and curled */
float sheetZ(float x, float k, float T, float base, float fold, float curl){
  return base + 120.0 * k
    + fold * (110.0 * sin(x * 0.0035 + T * 0.10 + k * 1.7) + 50.0 * sin(x * 0.009 - T * 0.21 + k * 2.9))
    + curl * 16.0 * sin(x * 0.04 + T * 0.8 + k * 4.1);
}
/* the three lines' volume emission by altitude h (km) above an electron-set lower edge e:
   (O 557.7 green, O 630.0 red, N2+ 427.8 violet) */
vec3 emis(float h, float e){
  float u = h - e;
  float g = smoothstep(-5.0, 6.0, u) * exp(-max(u, 0.0) / 38.0);
  float r = smoothstep(50.0, 140.0, u) * exp(-max(u - 140.0, 0.0) / 120.0) * 0.17;
  float b = smoothstep(-4.0, 2.0, u) * exp(-max(u, 0.0) / 14.0) * 0.4;
  return vec3(g, r, b);
}
/* the fine rays along the sheet: constant along B, so a function of x alone */
float raysAt(float x, float k, float T){
  float a = vnoise(vec2(x * 0.03, T * 0.15 + k * 13.0));
  float b = vnoise(vec2(x * 0.11, T * 0.4 + k * 7.0));
  return 0.25 + 0.75 * a * a + 0.5 * b * b * b;
}
/* one sheet between two march samples: if crossed, the light it gives (three lines + the pink hem),
   divided by |n.d| — the slant path through a thin sheet */
vec4 sheetLight(float k, float dA, float dB, float xA, float xB, float hA, float hB, vec3 rd,
                float T, float base, float fold, float curl, float e, float calm){
  if (dA * dB > 0.0) return vec4(0.0);
  float den = dA - dB;
  float fr = abs(den) > 1e-6 ? clamp(dA / den, 0.0, 1.0) : 0.5;
  float x = mix(xA, xB, fr), h = mix(hA, hB, fr);
  float sl = (sheetZ(x + 2.0, k, T, base, fold, curl) - sheetZ(x - 2.0, k, T, base, fold, curl)) * 0.25;
  vec3 g = vec3(-sl, -0.2, 1.0);
  float c = abs(dot(g, rd)) / length(g);
  vec3 em = emis(h, e);
  float pk = smoothstep(e - 8.0, e - 2.0, h) * smoothstep(e + 5.0, e, h);
  float ry = mix(raysAt(x, k, T), 1.0, calm);
  return vec4(em, pk) * ry * inversesqrt(c * c + 0.02);
}
/* the dipole's field strength along a line, relative to the equator */
float dipB(float l){ float c = cos(l), s = sin(l); return sqrt(1.0 + 3.0 * s * s) / max(c * c * c * c * c * c, 1e-6); }
/* the mirror latitude for equatorial pitch angle a0: B(lm) = B0 / sin^2 a0 */
float mirrorLat(float a0){
  float target = 1.0 / max(sq(sin(a0)), 1e-4);
  float lo = 0.0, hi = 1.5;
  for (int i = 0; i < 16; i++){ float m = 0.5 * (lo + hi); if (dipB(m) < target) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
/* the gyrophase from the equator to latitude l: dPhi/dl = B / v_par * sqrt(1 + 3 s^2) c (midpoint rule) */
float gyroPhase(float l, float a0, float lm){
  float la = min(abs(l), lm * 0.999);
  float s2 = sq(sin(a0));
  float ph = 0.0;
  float dl = la / 16.0;
  for (int i = 0; i < 16; i++){
    float x = (float(i) + 0.5) * dl;
    float B = dipB(x);
    float c = cos(x), s = sin(x);
    ph += B / sqrt(max(1.0 - B * s2, 1e-3)) * sqrt(1.0 + 3.0 * s * s) * c * dl;
  }
  return l < 0.0 ? -ph : ph;
}

}  // namespace rm_au

fragment float4 room_aurora(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_au;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.7 + 0;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 Cg = hueOf(wavelengthLinearRGB(557.7)), Cr = hueOf(wavelengthLinearRGB(630.0));
        vec3 Cb = hueOf(wavelengthLinearRGB(427.8)), Cpk = hueOf(wavelengthLinearRGB(668.0) + 0.5 * wavelengthLinearRGB(427.8));   // the pink hem: N2 red with N2+ violet
        vec3 chord = ramp(0.55 + uVarA * 0.2);
        float e0 = 108.0 - 16.0 * uEnergy - 7.0 * uBeat;           // the lower edge: harder electrons reach deeper
        if (uMode < 0.5){
          bool storm = uShape > 0.5 && uShape < 1.5;
          bool corona = uShape > 1.5;
          float pitch = corona ? 1.42 : 0.30;
          float f = 1.25;
          float yH = -f * tan(pitch);
          vec2 q = p;
          float refl = 0.0;
          if (!corona && q.y < yH){
            // the lake: the sky mirrored, rippled
            refl = 1.0;
            q.y = 2.0 * yH - q.y;
            q.x += 0.006 * sin(p.y * 150.0 + T * 1.7) * (yH - p.y) * 3.0;
          }
          // the far shore: a low hill and spruces
          float occ = 0.0;
          if (!corona){
            float hy = q.y - yH;
            float hill = 0.016 + 0.012 * sin(q.x * 2.3 + 1.0) + 0.007 * sin(q.x * 7.1);
            occ = step(hy, hill);
            float w = 0.038;
            for (int j = 0; j < 3; j++){
              float id = floor(q.x / w) + float(j) - 1.0;
              float hh = (0.04 + 0.11 * hash21(vec2(id, 3.1))) * step(0.3, hash21(vec2(id, 7.7)));
              float cx = (id + 0.5 + 0.3 * (hash21(vec2(id, 1.3)) - 0.5)) * w;
              float v = (hy - hill * 0.6) / max(hh, 1e-3);
              float hw = 0.12 * hh * (1.0 - v) * (0.75 + 0.4 * fract(v * 7.0));
              occ = max(occ, step(0.0, v) * step(v, 1.0) * step(abs(q.x - cx), hw));
            }
          }
          float cp = cos(pitch), sp = sin(pitch);
          vec3 rd = normalize(vec3(q.x, f * sp + q.y * cp, f * cp - q.y * sp));   // (east, up, north)
          vec3 sky = vec3(0.0);
          if (rd.y > 0.0 && occ < 0.5){
            float fold = storm ? 1.5 + 0.8 * uBass : (corona ? 1.0 + 0.5 * uBass : 0.5 + 0.4 * uBass);
            float curl = storm ? 1.0 + uMid : (corona ? 0.6 : 0.15);
            float base = corona ? -70.0 : (storm ? 150.0 : 175.0);
            float Tt = storm ? T * 1.8 : T;
            float calm = storm ? 0.0 : (corona ? 0.1 : 0.55);
            float e = e0 - (storm ? 8.0 : 0.0);
            float tA = 75.0 / rd.y, tB = min(470.0 / rd.y, 2600.0);
            tA = min(tA, tB - 1.0);
            float dt = (tB - tA) / 48.0;
            tA += dt * (hash21(p * 431.0 + fract(T)) - 0.5) * 0.6;          // dither the march: steps become grain, not stairs
            float hz2 = rd.x * rd.x + rd.z * rd.z;
            vec4 acc = vec4(0.0);
            vec3 haze = vec3(0.0);
            vec3 dP = vec3(0.0);
            float xP = 0.0, hP = 0.0;
            for (int i = 0; i < 49; i++){
              float t = tA + dt * float(i);
              float x = rd.x * t;
              float h = rd.y * t + t * t * hz2 / 12742.0;          // the Earth curves away beneath the far sky
              float ze = rd.z * t - (h - 100.0) * 0.2;              // measured along B
              vec3 d = vec3(ze - sheetZ(x, 0.0, Tt, base, fold, curl),
                            ze - sheetZ(x, 1.0, Tt, base, fold, curl),
                            ze - sheetZ(x, 2.0, Tt, base, fold, curl));
              if (i > 0){
                acc += sheetLight(0.0, dP.x, d.x, xP, x, hP, h, rd, Tt, base, fold, curl, e, calm);
                acc += sheetLight(1.0, dP.y, d.y, xP, x, hP, h, rd, Tt, base, fold, curl, e, calm) * 0.7;
                if (storm || corona) acc += sheetLight(2.0, dP.z, d.z, xP, x, hP, h, rd, Tt, base, fold, curl, e, calm) * 0.55;
              }
              // the diffuse glow round the sheets
              haze += emis(h, e) * (exp(-d.x * d.x / 9000.0) + 0.6 * exp(-d.y * d.y / 9000.0)) * dt * 0.0012;
              dP = d; xP = x; hP = h;
            }
            float gain = (storm ? 0.3 : 0.22) * (0.75 + 0.35 * uEnergy + 0.4 * uBeat);
            vec3 L3 = acc.xyz * gain + haze;
            sky = Cg * L3.x + Cr * L3.y + Cb * L3.z + Cpk * acc.w * gain * (storm ? 0.9 : 0.15) * (0.4 + uEnergy);
            sky = sky / (1.0 + 0.35 * max(max(sky.r, sky.g), sky.b));
            // the stars, and the airglow on the horizon
            vec2 sg = vec2(atan2s(rd.x, rd.z), asin(clamp(rd.y, -1.0, 1.0))) * 110.0;
            vec2 si = floor(sg);
            float st = step(0.982, hash21(si)) * glow(length(fract(sg) - 0.5 - 0.3 * (vec2(hash21(si + 3.1), hash21(si + 7.3)) - 0.5)), 90.0);
            sky += mix(vec3(1.0), chord, 0.4) * st * (0.35 + 0.3 * sin(T * 3.0 + hash21(si) * 40.0)) * (0.5 + 0.5 * uTreble);
            sky += chord * 0.07 * exp(-rd.y * 10.0) + Cg * 0.05 * exp(-rd.y * 6.0) * (0.6 + uEnergy);
          }
          col = sky * (refl > 0.5 ? 0.32 + 0.1 * uCalm : 1.0);
        } else if (uMode < 1.5){
          if (uShape < 0.5 || uShape > 1.5){
            // from above the pole: orthographic, noon at the top, midnight at the bottom
            float Re = 1.55;
            float r = length(p);
            float ph = fract(T / 24.0);                                        // the substorm clock
            float grow = smoothstep(0.0, 0.45, ph) * (1.0 - smoothstep(0.45, 0.6, ph));
            float onset = smoothstep(0.45, 0.5, ph) * (1.0 - smoothstep(0.6, 0.98, ph));
            float expd = smoothstep(0.45, 0.8, ph);
            if (r < Re){
              float deg = asin(clamp(r / Re, 0.0, 1.0)) * 57.2958;
              float psi = atan2s(p.x, -p.y);                                    // from midnight; dawn to the right
              float cm = cos(psi);
              float thc = 19.0 + 4.0 * cm + 2.0 * grow;
              float w = 1.3 + 2.2 * (0.5 + 0.5 * cm) + 0.6 * uEnergy;
              float st = (0.45 + 0.8 * vnoise(vec2(psi * 9.0, T * 0.3))) * (0.45 + 0.55 * sq(cos((deg - thc) * 2.2 + 0.4 * sin(psi * 5.0 + T * 0.2))));
              float I = exp(-sq((deg - thc) / w)) * (0.3 + 0.7 * (0.5 + 0.5 * cm)) * st;
              // the breakup: a bulge at midnight, poleward and spreading, its westward surge running to dusk
              float bw = 0.25 + 1.2 * expd;
              float pole = thc - 1.0 - 6.0 * expd;
              float bul = onset * exp(-sq(psi / bw)) * smoothstep(thc + w, thc, deg) * smoothstep(pole - 1.5, pole + 0.5, deg);
              float ws = -0.15 - 1.6 * expd;
              float surge = onset * exp(-sq((psi - ws) / 0.12) - sq((deg - thc + 1.0) / 1.6)) * 2.0;
              float green = (I + bul * 1.6 + surge) * (0.8 + 0.5 * uBeat);
              float red = exp(-sq((deg - thc + w * 1.1) / (w * 0.9))) * (0.3 + 0.7 * (0.5 + 0.5 * cm)) * 0.22 + bul * 0.25;
              // the theta aurora: an arc straight across the polar cap, drifting dawn to dusk
              if (uShape > 1.5){
                float xa = 0.22 * Re * sin(T * 0.11) + 0.025 * sin(p.y * 5.0 + T * 0.3);
                float cap = smoothstep(thc - w * 0.4, thc - w * 1.4, deg);
                green += exp(-sq((p.x - xa) / 0.014)) * cap * (0.7 + 0.3 * vnoise(vec2(p.y * 14.0, T))) * 0.9;
                red += exp(-sq((p.x - xa) / 0.04)) * cap * 0.15;
              }
              // the night Earth: the dayside faintly lit, a graticule every ten degrees
              float lim = sqrt(max(1.0 - sq(r / Re), 0.0));
              col += chord * 0.05 * smoothstep(-0.1, 0.5, p.y / Re) * lim;
              float gr = abs(fract(deg / 10.0 + 0.5) - 0.5) * 10.0 / 57.2958 * Re * lim;
              col += chord * glow(gr, 30000.0) * 0.06;
              col += (Cg * green + Cr * red) * 0.9 * (0.4 + 0.6 * lim);
            }
            // the airglow on the limb, and the stars beyond
            col += Cg * glow(r - Re, 25000.0) * 0.12 + chord * glow(r - Re, 3000.0) * 0.04;
            if (r > Re){
              vec2 sg = p * 60.0;
              vec2 si = floor(sg);
              col += vec3(0.8) * step(0.985, hash21(si)) * glow(length(fract(sg) - 0.5), 60.0) * 0.5;
            }
          } else {
            // the limb, edge-on from orbit
            float Rs = 2.6;
            vec2 C = vec2(0.0, -0.42 - Rs);
            float rr = length(p - C);
            float alt = (rr - Rs) * 900.0;                                     // km
            float xk = atan2s(p.x - C.x, p.y - C.y) * Rs * 900.0;               // km along the limb
            float env = 0.25 + 0.75 * sq(0.5 + 0.5 * sin(xk * 0.0011 + T * 0.06));
            if (alt > 0.0){
              vec3 em = emis(alt, e0) * raysAt(xk + 0.2 * alt, 0.0, T) * env * (0.8 + 0.5 * uBeat);
              col += (Cg * em.x + Cr * em.y + Cb * em.z) * 0.9;
              col += Cg * glow((alt - 95.0) / 900.0, 300000.0) * 0.18;       // the green airglow layer
              col += Cr * glow((alt - 250.0) / 900.0, 4000.0) * 0.03;
              vec2 sg = p * 60.0;
              vec2 si = floor(sg);
              col += vec3(0.8) * step(0.985, hash21(si)) * glow(length(fract(sg) - 0.5), 60.0) * 0.5 * smoothstep(380.0, 520.0, alt);
            } else {
              // on the disk below: the curtains seen obliquely, standing up from their footline
              float dd = -alt / 900.0;
              float yf = 0.15 + 0.05 * sin(xk * 0.0016 + T * 0.13) + 0.02 * sin(xk * 0.005 - T * 0.2);
              float hgt = (yf - dd) / 0.11 * 300.0 + 100.0;
              vec3 em = emis(hgt, e0) * step(0.0, yf - dd + 0.01) * raysAt(xk, 1.0, T) * env;
              col += (Cg * em.x + Cr * em.y + Cb * em.z) * 0.6 * smoothstep(0.0, 0.03, dd);
              // the night side's lights
              float ct = step(0.7, fbm4(vec2(xk * 0.004, dd * 14.0))) * step(0.93, hash21(floor(vec2(xk * 0.05, dd * 300.0))));
              col += ramp(0.1 + uVarA * 0.2) * ct * 0.25;
              col += chord * 0.02;
            }
            col += chord * glow(alt / 900.0, 9000.0) * 0.08;
          }
        } else {
          // THE MIRROR: dipole field lines r = L re cos^2(lat), Earth at the left of the stage
          bool one = uShape < 0.5;
          bool rain = uShape > 1.5;
          float re = one ? 0.21 : 0.17;
          vec2 c0 = one ? vec2(-0.85, 0.0) : vec2(0.0);
          vec2 q = p - c0;
          float r = length(q);
          float la = atan2s(q.y, abs(q.x));
          float side = q.x < 0.0 ? -1.0 : 1.0;
          float cl = max(cos(la), 1e-3);
          float Lp = r / (re * cl * cl);
          float gL = sqrt(1.0 + 4.0 * sq(tan(la))) / (re * cl * cl);           // |grad L| on the screen
          if (r > re * 1.02){
            // the field lines
            float Ld = abs(fract(Lp + 0.5) - 0.5) / gL;
            col += chord * glow(Ld, 40000.0) * (one ? 0.22 : 0.28) * step(1.5, Lp) * step(Lp, 8.5);
            // the belts: inner and outer, held near the equator
            if (!one){
              float belt = exp(-sq((Lp - 1.6) / 0.35)) * 0.5 + exp(-sq((Lp - 4.6) / 1.2));
              col += ramp(0.3 + uVarA * 0.2) * belt * exp(-sq(la / 0.55)) * (0.1 + 0.1 * uBass);
            }
            // the particle on the nearest of its lines
            float L0 = one ? 6.0 : (Lp < 3.6 ? 2.6 : (Lp < 5.4 ? 4.5 : 6.4));
            float a0 = one ? 0.62 + 0.2 * sin(T * 0.06) : (L0 < 3.0 ? 0.55 : (L0 < 5.0 ? 0.75 : 0.95));
            float lm = mirrorLat(a0);
            float lf = acos(clamp(1.0 / sqrt(L0), -1.0, 1.0));                                    // where the line meets the ground
            float Tb = one ? 6.0 : 3.0 + L0 * 0.6;
            float ph = T * 2.0 * PI / Tb + (one ? 0.0 : L0 * 1.7);
            float sd = (Lp - L0) / gL;                                           // signed screen distance from the line
            float A0 = one ? 0.05 : 0.028;
            float drift = one ? step(0.0, side) : 1.0;
            if (!one){
              float pd = T * (0.08 + 0.03 * L0) + L0;                            // the slow drift round the Earth
              drift = 0.12 + 0.88 * sqrt(max(side * cos(pd), 0.0));
            }
            if (rain){
              // the loss cone: these do not turn back; streams of electrons to both feet
              float u = abs(la) / lf;
              float A = A0 * 0.5 * (1.0 - u) / sqrt(dipB(la));
              float Ph = 70.0 * u + T * 3.0;
              float dh = abs(sd - A * cos(Ph));
              float pul = ppow(0.5 + 0.5 * cos(2.0 * PI * (u * 2.0 - T * 0.5 + L0 * 0.37)), 24.0);
              col += mix(Cg, chord, 0.5) * glow(dh, 25000.0) * (0.25 + 1.6 * pul) * step(u, 1.0) * (0.65 + 0.35 * step(0.0, sin(Ph))) * drift;
            } else if (abs(la) < lm * 1.02){
              float A = A0 / sqrt(dipB(la));
              float Pt = gyroPhase(lm, a0, lm);
              float K = 2.0 * PI * (one ? 11.0 : 7.0) / max(Pt, 1e-3);
              float Ph = K * gyroPhase(la, a0, lm);
              float B = dipB(la);
              float s = sin(la);
              float dPds = K * B / sqrt(max(1.0 - B * sq(sin(a0)), 1e-3)) / (L0 * re);   // dPhi per screen unit along the line
              float dh = abs(sd - A * cos(Ph)) / min(sqrt(1.0 + sq(A * dPds * sin(Ph))), 3.0) + step(A + 0.03, abs(sd));
              float front = 0.35 + 0.65 * step(0.0, sin(Ph));
              // the head, and its fading trail
              float lp = lm * sin(ph);
              float dir = cos(ph) >= 0.0 ? 1.0 : -1.0;
              float behind = (lp - la) * dir;
              float trail = behind >= 0.0 ? exp(-behind / (lm * 0.35)) : 0.0;
              float wl = one ? 20000.0 : 30000.0;
              col += mix(chord, vec3(1.0), 0.3) * glow(dh, wl) * front * (0.3 + 1.1 * trail) * drift;
              float hl = abs(la - lp) * L0 * re;
              col += vec3(1.0) * glow(hl, 2500.0) * glow(dh, wl * 0.3) * (1.5 + uBeat) * drift;
              // the mirror points
              vec2 mp = re * L0 * sq(cos(lm)) * vec2(cos(lm) * side, sin(lm) * (la > 0.0 ? 1.0 : -1.0));
              col += chord * glow(length(q - mp), 30000.0) * 0.5 * drift;
            }
            // the aurora at the feet of the lines: both hemispheres at once
            for (int j = 0; j < 2; j++){
              float Lf = one ? 6.0 : (j == 0 ? 4.5 : 6.4);
              float lff = acos(clamp(1.0 / sqrt(Lf), -1.0, 1.0));
              vec2 fp = re * vec2(cos(lff) * side, sin(lff) * (la > 0.0 ? 1.0 : -1.0));
              float ar = glow(length(q - fp * 1.04), 3000.0);
              float amt = (rain ? 0.9 + 0.8 * uBeat : 0.35 + 0.4 * uBeat) * (one ? step(0.0, side) : 1.0);
              col += (Cg + Cr * 0.25) * ar * amt;
            }
          } else {
            // the Earth: night, and day from the left
            float z2 = sqrt(max(1.0 - sq(r / re), 0.0));
            vec3 n = vec3(q / re, z2);
            col += chord * 0.08 * max(dot(n, normalize(vec3(-1.0, 0.3, 0.6))), 0.0) + chord * 0.01;
          }
          col += Cg * glow(r - re * 1.02, 20000.0 / (re * re * 25.0)) * 0.1;
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
