#include <metal_stdlib>
using namespace metal;

/* ================================================================
   IRIS — the sky's optics, in spectral colour.

   THE BOW: Descartes' minimum deviation in a raindrop (cos²i = (n²−1)/3 for
   the primary at ~42°, (n²−1)/8 for the secondary at ~51°, reversed), with
   water's own dispersion, and the bright edge drawn by Airy's theory, Ai²(−z),
   so supernumerary bands appear for small drops and fog washes it white;
   Alexander's dark band between. THE HALO: ice prisms — the 22° and 46° halos
   by minimum deviation through 60° and 90° prisms, the sundogs from plates
   (n′ = √(n² − sin²e)/cos e), the parhelic circle, and the circumzenithal arc
   at asin √(n² − cos²e), alive only below 32.2° — in a stereographic sky, so
   circles stay circles. THE CORONA: the moon through thin cloud, diffraction
   by droplets, (2J₁(x)/x)² with x = πdθ/λ (Abramowitz & Stegun's
   polynomials), iridescent where the drop size changes, stretched by pollen.
   Sixteen wavelengths a pixel, each through the CIE observer the web uses.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildIris() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_ir: a self-contained translation unit.
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

namespace rm_ir {

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
float nWater(float l){ return 1.3249 + 2970.0 / (l * l); }
float nIce(float l){ return 1.2995 + 3184.0 / (l * l); }
/* Ai(-z), the rainbow's profile: Taylor at the caustic, the asymptotes either side */
float airyAi(float z){
  float a0 = 0.35503 + 0.25882 * z;
  float zz = max(abs(z), 1e-3);
  float tt = smoothstep(0.6, 1.6, abs(z));
  if (z > 0.0) return mix(a0, 0.56419 * ppow(zz, -0.25) * sin(0.666667 * zz * sqrt(zz) + 0.785398), tt);
  return mix(max(a0, 0.0), 0.28209 * ppow(zz, -0.25) * exp(-0.666667 * zz * sqrt(zz)), tt);
}
/* Descartes: the primary and secondary rainbow angles from the antisolar point */
vec2 bowAngles(float n){
  float i1 = acos(clamp(sqrt((n * n - 1.0) / 3.0), 0.0, 1.0));
  float r1 = asin(clamp(sin(i1) / n, -1.0, 1.0));
  float i2 = acos(clamp(sqrt((n * n - 1.0) / 8.0), 0.0, 1.0));
  float r2 = asin(clamp(sin(i2) / n, -1.0, 1.0));
  return vec2(4.0 * r1 - 2.0 * i1, PI + 2.0 * i2 - 6.0 * r2);
}
/* 2 J1(x)/x — the Airy pattern of a droplet (Abramowitz & Stegun 9.4.4 and 9.4.6) */
float jinc(float x){
  float ax = abs(x);
  if (ax < 3.0){
    float y = sq(x / 3.0);
    return 2.0 * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))));
  }
  float y = 3.0 / ax;
  float f1 = 0.79788456 + y * (0.00000156 + y * (0.01659667 + y * (0.00017105 + y * (-0.00249511 + y * (0.00113653 - y * 0.00020033)))));
  float t1 = ax - 2.35619449 + y * (0.12499612 + y * (0.00005650 + y * (-0.00637879 + y * (0.00074348 + y * (0.00079824 - y * 0.00029166)))));
  return 2.0 * f1 * cos(t1) / (sqrt(ax) * ax);
}
/* the inverse stereographic projection: screen (u, v) to a direction, camera pitched up by pitch */
vec3 stereoDir(vec2 uv, float pitch){
  float r2 = dot(uv, uv);
  vec3 l = vec3(4.0 * uv.x, 4.0 * uv.y, 4.0 - r2) / (4.0 + r2);
  float cp = cos(pitch), sp = sin(pitch);
  // camera: right = +x, up and forward tilted by pitch about x
  return vec3(l.x, l.y * cp + l.z * sp, -l.y * sp + l.z * cp);
}

}  // namespace rm_ir

fragment float4 room_iris(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_ir;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.75 + 0;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;

        if (uMode < 0.5){
          /* ===== THE BOW ===== */
          float yh = -0.62;
          float land = yh + 0.07 * fbm4(vec2(p.x * 1.6 + 3.0, 1.0)) - 0.035;
          float e = (0.21 + 0.06 * sin(T * 0.05));                 // the sun's elevation, radians
          float k = 0.56;                                          // radians of sky per unit of screen
          vec2 As = vec2(0.10 * sin(T * 0.03), yh - e / k);
          float psi = length(p - As) * k;
          float w = (uShape < 0.5 ? 0.0045 : (uShape < 1.5 ? 0.012 : 0.026)) * (1.0 - 0.2 * uBass);
          float fog = step(1.5, uShape);
          vec3 acc = vec3(0.0), wsum = vec3(0.0);
          for (int i = 0; i < 16; i++){
            float l = 405.0 + 290.0 * (float(i) + 0.5) / 16.0;
            vec3 wl = wavelengthLinearRGB(l);
            wsum += wl;
            vec2 ang = bowAngles(nWater(l));
            float ws = w * ppow(l / 550.0, 0.6667);
            // the sun is half a degree wide: each colour's caustic is smeared across its disk
            float I1 = 0.0, I2 = 0.0;
            for (int j = 0; j < 3; j++){
              float o = (float(j) - 1.0) * 0.0036;
              float z1 = (ang.x - psi + o) / ws;
              float a1 = airyAi(z1) / 0.5357 * (1.0 - fog * (1.0 - exp(-max(z1 - 1.5, 0.0) * 0.8)));
              float a2 = airyAi((psi - ang.y + o) / (ws * 1.5)) / 0.5357;
              I1 += a1 * a1 / 3.0; I2 += a2 * a2 / 3.0;
            }
            float inside = smoothstep(ang.x + 2.0 * ws, ang.x - 2.0 * ws, psi);
            float outside = smoothstep(ang.y - 2.0 * ws, ang.y + 2.0 * ws, psi);
            float I = 1.3 * I1 + 0.55 * I2 + 0.20 * inside * (0.55 + 0.45 * psi / ang.x) + 0.08 * outside + 0.02;
            acc += wl * I;
          }
          vec3 bow = acc / max(wsum, vec3(1e-4));
          bow = mix(bow, vec3(dot(bow, vec3(0.3333))), fog * 0.72);    // the fogbow: every colour's broad lobe overlapping into white
          // the rain curtain the light is shining into: brighter where it rains harder
          float rain = 0.35 + 0.65 * smoothstep(0.25, 0.75, fbm4(vec2(p.x * 0.7 + T * 0.02, p.y * 0.35 - T * 0.01)));
          float streak = vnoise(vec2(p.x * 90.0 + p.y * 25.0, p.y * 3.0 + T * 4.0));
          rain *= 0.9 + 0.2 * streak + uBeat * 0.08 * step(0.85, streak);
          vec3 sky = ramp(0.58) * 0.05 * (1.2 - p.y) + ramp(0.15) * 0.03;
          col = sky + bow * rain * 0.85;
          // the land in front, catching a little of the low sun
          if (p.y < land){
            col = ramp(0.40) * 0.035 + ramp(0.05) * 0.04 * smoothstep(land - 0.3, land, p.y);
            col += vec3(0.05) * glow(p.y - land, 20000.0);
          }
        } else if (uMode < 1.5){
          /* ===== THE HALO: ice, toward the sun, in a stereographic sky ===== */
          float e = (uShape < 0.5 ? 0.14 : (uShape < 1.5 ? 0.38 : 0.70)) + 0.03 * sin(T * 0.05);
          float pitch = e + 0.36;
          vec3 d = stereoDir(p / 1.25, pitch);
          vec3 S = vec3(0.0, sin(e), cos(e));
          float alt = asin(clamp(d.y, -1.0, 1.0));
          float az = atan2s(d.x, d.z);
          float psi = acos(clamp(dot(d, S), -1.0, 1.0));
          vec3 acc = vec3(0.0), wsum = vec3(0.0);
          float gh = hash21(floor((p + vec2(T * 0.01, 0.0)) * 260.0));
          float glitter = step(0.9993 - 0.0012 * uTreble, gh) * (0.5 + 0.5 * sin(T * 9.0 + gh * 60.0));
          for (int i = 0; i < 16; i++){
            float l = 405.0 + 290.0 * (float(i) + 0.5) / 16.0;
            vec3 wl = wavelengthLinearRGB(l);
            wsum += wl;
            float n = nIce(l);
            // 22° and 46°: minimum deviation through the 60° and 90° prisms of randomly turned crystals
            float D22 = 2.0 * asin(clamp(n * 0.5, -1.0, 1.0)) - PI / 3.0;
            float D46 = 2.0 * asin(clamp(n * 0.707107, -1.0, 1.0)) - PI * 0.5;
            float h22 = smoothstep(D22 - 0.006, D22 + 0.002, psi) * exp(-max(psi - D22, 0.0) / 0.045) * 0.8;
            float h46 = smoothstep(D46 - 0.008, D46 + 0.003, psi) * exp(-max(psi - D46, 0.0) / 0.07) * 0.28;
            // the sundogs: plates, horizontal, the index made effective by the sun's height
            float np = sqrt(max(n * n - sin(e) * sin(e), 0.0)) / cos(e);
            float Dp = 2.0 * asin(clamp(np * 0.5, -1.0, 1.0)) - PI / 3.0;
            float band = exp(-sq((alt - e) / 0.014));
            float dog = band * smoothstep(Dp - 0.006, Dp + 0.002, abs(az)) * exp(-max(abs(az) - Dp, 0.0) / 0.045) * 2.2;
            // the circumzenithal arc: in at the top face, out at a side; only below 32.2°
            float s2 = n * n - cos(e) * cos(e);
            float cza = 0.0;
            if (s2 < 1.0){
              float a = asin(clamp(sqrt(max(s2, 0.0)), 0.0, 1.0));
              cza = exp(-sq((alt - a) / 0.006)) * exp(-sq(az / 0.75)) * 2.4 * smoothstep(0.0, 0.08, 1.0 - s2);
            }
            acc += wl * (h22 + h46 + dog + cza);
          }
          vec3 halo = acc / max(wsum, vec3(1e-4));
          // the sky: darker inside the 22° ring, the sun's glare, the parhelic circle
          float skyB = 0.05 + 0.05 * smoothstep(0.32, 0.42, psi) * exp(-psi * 1.2);
          vec3 sky = ramp(0.6) * skyB + ramp(0.15) * 0.02;
          float sun = exp(-psi * psi * 4000.0) * 3.0 + exp(-psi * 30.0) * 0.25 + exp(-psi * 6.0) * 0.06;
          float parhelic = exp(-sq((alt - e) / 0.004)) * 0.12;
          col = sky + vec3(1.0, 0.97, 0.9) * sun * (1.0 + uBeat * 0.15) + halo * (0.75 + uBass * 0.4) + vec3(parhelic);
          col += vec3(0.8) * glitter * smoothstep(0.5, 0.15, psi) * (0.2 + 0.8 * uTreble);
          if (alt < 0.0){
            col = ramp(0.6) * 0.04 + vec3(0.03) * smoothstep(-0.25, 0.0, alt);
            col += vec3(1.0, 0.97, 0.9) * glow(alt, 4000.0) * 0.08;
          }
        } else {
          /* ===== THE CORONA: the moon through thin cloud ===== */
          vec2 M = vec2(0.15 * sin(T * 0.02), 0.08);
          vec2 q = p - M;
          if (uShape > 1.5) q.x *= 1.32;                      // pollen grains are not round
          float th = length(q) * 0.085;                       // radians of sky per unit
          float cl = fbm4(p * 1.6 + vec2(T * 0.06, T * 0.015));
          float cl2 = fbm4(p * 3.1 - vec2(T * 0.03, 0.0) + 7.0);
          float dBase = (uShape < 0.5 ? 13.0 : (uShape < 1.5 ? 18.0 : 24.0)) * (1.0 + 0.15 * uBass);
          float dLoc = dBase * (0.75 + 0.5 * cl2);            // the drops grow where the cloud is older
          float spread = uShape > 0.5 ? 0.16 : 0.08;
          vec3 acc = vec3(0.0), wsum = vec3(0.0);
          for (int i = 0; i < 16; i++){
            float l = 405.0 + 290.0 * (float(i) + 0.5) / 16.0;
            vec3 wl = wavelengthLinearRGB(l);
            wsum += wl;
            float I = 0.0;
            for (int j = 0; j < 3; j++){
              float dj = dLoc * (1.0 + spread * (float(j) - 1.0));
              float x = PI * dj * 1000.0 / l * th;
              float jj = jinc(x);
              I += (j == 1 ? 0.5 : 0.25) * jj * jj;
            }
            acc += wl * I;
          }
          // the eye sees the rings at a few per cent of the aureole: a compressive response
          vec3 cor = vec3(1.0) - exp(-acc / max(wsum, vec3(1e-4)) * 45.0);
          if (uShape > 1.5){
            float ang = atan2s(q.y, q.x);
            cor *= 0.75 + 0.5 * sq(cos(2.0 * ang));            // the pollen corona's brighter knots
          }
          // thin cloud: the corona lives where it is thin enough to see through
          float thick = smoothstep(0.30, 0.80, cl);
          float veil = 0.35 + 0.65 * smoothstep(0.15, 0.55, cl);       // the corona needs cloud to be made in
          float transmit = 1.0 - 0.6 * thick;
          vec3 cloud = ramp(0.6) * 0.05 * thick + vec3(0.03) * thick * exp(-th * 25.0);
          float moon = smoothstep(0.065, 0.055, length(p - M));
          float glare = exp(-length(p - M) * 9.0) * 0.25;
          col = ramp(0.58) * 0.025 + cloud + cor * 0.55 * veil * transmit * smoothstep(0.004, 0.01, th);
          col += vec3(0.95, 0.95, 0.9) * (moon * 1.6 + glare) * transmit;
          // the stars, where the sky is clear
          float st = step(0.9988, hash21(floor(p * 160.0)));
          col += vec3(0.7) * st * (1.0 - veil) * 0.6;
        }
        if (uHand.z > 0.05) col += ramp(0.85) * glow(length(p - uHand.xy) - 0.06, 4000.0) * uHand.z * 0.35;
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
