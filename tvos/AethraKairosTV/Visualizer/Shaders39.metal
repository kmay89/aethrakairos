#include <metal_stdlib>
using namespace metal;

/* ================================================================
   HUBBLE — the expanding universe.

   The scale factor from Friedmann's equation H² = H0²(Ωr a⁻⁴ + Ωm a⁻³ + Ωk a⁻² + ΩΛ)
   solved in closed form for our flat ΛCDM universe (Ωm 0.31, ΩΛ 0.69):
   a(t) = (Ωm/ΩΛ)^{1/3} sinh^{2/3}(3/2 √ΩΛ H0 t); a closed matter universe
   (Ωm = 5, the cycloid a ∝ 1 − cos η, t ∝ η − sin η) that recollapses; and an
   empty coasting one (a ∝ t). THE EXPANSION: galaxies at fixed
   comoving positions, their screen positions a(t) x; their colour the true
   redshift of the light we see from them now, from the comoving distance
   χ = ∫ c da/(a²H) (24 steps in √a) inverted for the emission scale factor. THE LIGHT CONE:
   proper distance a(t)χ(t) of our past light cone against cosmic time — the
   teardrop, peaking at z ≈ 1.6 — with the Hubble sphere c/H, the particle
   horizon and the surface of last scattering at z ≈ 1090, its anisotropies
   from fbm on the sky.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildHubble() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_hb: a self-contained translation unit.
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

namespace rm_hb {

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
/* H(a)/H0 for our universe (flat, matter and dark energy) */
float hubbleE(float a){
  float aa = max(a, 1e-3);
  return sqrt(0.31 / (aa * aa * aa) + 0.69);
}
/* cosmic time (1/H0) at scale factor a, and its inverse — closed form for flat matter + Lambda */
float ageAt(float a){ return 2.0 / (3.0 * sqrt(0.69)) * asinhx(sqrt(0.69 / 0.31) * ppow(max(a, 0.0), 1.5)); }
float aOfT(float t){ return ppow(0.31 / 0.69, 1.0 / 3.0) * ppow(sinhx(1.5 * sqrt(0.69) * max(t, 0.0)), 2.0 / 3.0); }
/* the comoving distance light travels between scale factors a and 1 (c/H0 units), in u = sqrt(a) */
float chiOf(float a){
  float s = 0.0;
  float u0 = sqrt(max(a, 0.0));
  float du = (1.0 - u0) / 24.0;
  for (int i = 0; i < 24; i++){
    float u = u0 + (float(i) + 0.5) * du;
    s += 2.0 / (u * u * u * hubbleE(u * u)) * du;
  }
  return s;
}
/* a closed matter universe (Omega_m = 5): a = 5/8 (1 - cos eta), t = 5/16 (eta - sin eta) */
float aClosed(float t){
  float lo = 0.0, hi = 2.0 * PI;
  for (int k = 0; k < 16; k++){
    float m = 0.5 * (lo + hi);
    if (0.3125 * (m - sin(m)) < t) lo = m; else hi = m;
  }
  float e = 0.5 * (lo + hi);
  return t > 0.3125 * 2.0 * PI ? 0.0 : 0.625 * (1.0 - cos(e));
}

}  // namespace rm_hb

fragment float4 room_hubble(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_hb;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.75 + 2;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 cB = ramp(0.6 + uVarA * 0.2), cH = ramp(0.9 + uVarA * 0.2), cR = ramp(0.25 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE EXPANSION: a lattice of galaxies at fixed comoving places, the scale factor breathing
          float P = 30.0;
          float ph = fract(T / P);
          float a = 0.35 + 1.0 * ph + 0.05 * uBass;
          float fade = smoothstep(0.0, 0.06, ph) * smoothstep(1.0, 0.94, ph);
          vec2 O = vec2(0.0);
          if (uShape > 0.5 && uShape < 1.5){
            // every centre: the observer hops from galaxy to galaxy
            float hop = floor(T / 6.0);
            O = 0.17 * vec2(floor((hash21(vec2(hop, 1.0)) - 0.5) * 6.0), floor((hash21(vec2(hop, 2.0)) - 0.5) * 4.0));
          }
          vec2 xc = (p / a) + O;
          float cell = 0.17;
          vec2 id = floor(xc / cell + 0.5);
          for (int j = 0; j < 4; j++){
            vec2 nid = id + vec2(float(j - (j / 2) * 2), float(j / 2)) - vec2(step(fract(xc.x / cell + 0.5), 0.5), step(fract(xc.y / cell + 0.5), 0.5));
            vec2 jit = (vec2(hash21(nid), hash21(nid + 17.0)) - 0.5) * cell * 0.7;
            vec2 gx = nid * cell + jit;
            vec2 sp = (gx - O) * a;
            float d = length(p - sp);
            float h = hash21(nid + 3.3);
            float sz = (0.006 + 0.01 * h) * a;
            float ang = h * 6.2832;
            vec2 dq = rot(p - sp, ang) / vec2(1.0, 0.45 + 0.5 * hash21(nid + 9.0));
            float gl = glow(length(dq), 1.0 / (sz * sz) * 0.6) + 0.35 * glow(length(dq), 1.0 / (sz * sz) * 0.08);
            vec3 gc = mix(cB, vec3(1.0), 0.4 * h);
            float dist = length(gx - O);
            if (uShape > 1.5){
              // the redshift we see: the light left when space was smaller; 1 + z = 1 / a_emit
              float chi = dist * 0.32 / a;
              float ae = 1.0;
              // invert chi(ae) by bisection (chi grows as ae shrinks)
              float lo = 0.05, hi = 1.0;
              for (int k = 0; k < 10; k++){
                if (gl < 0.003) break;
                float m = 0.5 * (lo + hi);
                if (chiOf(m) > chi) lo = m; else hi = m;
              }
              ae = 0.5 * (lo + hi);
              float z = 1.0 / ae - 1.0;
              gc = wavelengthLinearRGB(clamp(450.0 * (1.0 + z), 400.0, 680.0)) * 2.2 / ((1.0 + z) * (1.0 + z));
            }
            col += gc * gl * fade * (0.9 + 0.3 * uBeat);
            // the recession arrows on a few: v = H d
            if (uShape < 0.5 && h > 0.86){
              float H = 1.0 / P / a * 4.0;
              vec2 v = (gx - O) * a * H * 2.5;
              col += cH * glow(segd(p, sp, sp + v), 200000.0) * 0.5 * fade;
            }
          }
          // the observer
          col += cH * glow(length(p), 4000.0) * 0.7 + cH * glow(length(p) - 0.05, 60000.0) * 0.4;
          if (uShape > 0.5 && uShape < 1.5){
            float r = length(p);
            col += cH * glow(abs(fract(r * 3.0 / a) - 0.5) / 3.0 * a, 200000.0) * 0.05;
          }
        } else if (uMode < 1.5){
          // THE FATES: a(t) for three universes, ours drawn with its eras; the pen walks with the music
          float x0 = -uAspect * 0.86, x1 = uAspect * 0.86, y0 = -0.72, y1 = 0.78;
          float tmax = 2.4;
          float tt = (p.x - x0) / (x1 - x0) * tmax;
          float amax = 3.0;
          float now = fract(T / 30.0) * tmax;
          float inP = step(0.0, tt) * step(tt, tmax);
          // the three curves: ours, the closed one, the empty one
          float e = 0.01;
          float aL = aOfT(tt), aC = aClosed(tt), aE = tt;
          float sy = (y1 - y0) / amax, sx = (x1 - x0) / tmax;
          float slL = (aOfT(tt + e) - aL) / e * sy / sx;
          float slC = (aClosed(tt + e) - aC) / e * sy / sx;
          float slE = sy / sx;
          float wL = uShape < 0.5 ? 1.0 : 0.3, wC = uShape > 0.5 && uShape < 1.5 ? 1.0 : 0.3, wE = uShape > 1.5 ? 1.0 : 0.3;
          col += cB * glow((p.y - y0 - aL * sy) / sqrt(1.0 + slL * slL), 120000.0) * wL * inP;
          col += cR * glow((p.y - y0 - aC * sy) / min(sqrt(1.0 + slC * slC), 30.0), 120000.0) * wC * inP * step(tt, 0.3125 * 2.0 * PI);
          col += cH * glow((p.y - y0 - aE * sy) / sqrt(1.0 + slE * slE), 120000.0) * wE * inP;
          // the axes, today's a = 1 line, and the eras of ours: radiation, matter, dark energy
          col += cB * (glow(p.y - y0, 400000.0) + glow(p.x - x0, 400000.0) * step(y0, p.y) * step(p.y, y1)) * 0.3;
          col += cB * glow(p.y - (y0 + sy), 400000.0) * step(0.5, fract(p.x * 30.0)) * 0.15;
          float tEq = ageAt(ppow(0.31 / (2.0 * 0.69), 1.0 / 3.0));     // when the expansion began to accelerate
          float xEq = x0 + tEq * sx;
          col += cH * glow(p.x - xEq, 400000.0) * step(y0, p.y) * step(p.y, y1) * step(0.5, fract(p.y * 25.0)) * 0.25;
          // the pen on the chosen universe, with its galaxies' spacing shown as a ring
          float tn = now;
          float an = uShape < 0.5 ? aOfT(tn) : (uShape < 1.5 ? aClosed(tn) : tn);
          vec2 pen = vec2(x0 + tn * sx, y0 + an * sy);
          col += vec3(1.0) * glow(length(p - pen), 9000.0) * (0.9 + 0.5 * uBeat);
          vec2 bc = vec2(x0 + 0.38 * (x1 - x0), y1 - 0.18);
          float rr = length(p - bc);
          for (int k = 0; k < 6; k++){
            float ag = float(k) * PI / 3.0 + 0.3;
            vec2 g = bc + 0.06 * an * vec2(cos(ag), sin(ag));
            col += cH * glow(length(p - g), 30000.0) * 0.8;
          }
          col += cB * glow(rr - 0.06 * an, 200000.0) * 0.15;
        } else {
          // THE LIGHT CONE: proper distance (x) against cosmic time (y, the Big Bang at the bottom)
          float t0 = ageAt(1.0);
          float y0 = -0.82, y1 = 0.82;
          float tt = (p.y - y0) / (y1 - y0) * t0 * 1.15;
          float a = aOfT(tt);
          float sx = uAspect * 0.86 / 0.6;
          float D = abs(p.x) / sx;                                 // proper distance, c/H0
          float inT = step(0.0, tt) * step(tt, t0 * 1.15);
          float past = step(tt, t0);
          // our past light cone: proper distance a(t) chi(a)
          float Dc = a * chiOf(a);
          float chiA = Dc / max(a, 1e-4);
          float dDdt = (chiA - 1.0 / max(a * hubbleE(a), 1e-3)) * a * hubbleE(a);     // d(a chi)/dt, closed form
          float slope = dDdt * sx / ((y1 - y0) / (t0 * 1.15));
          col += cH * glow(abs(D - Dc) * sx / sqrt(1.0 + slope * slope), 60000.0) * past * inT * 1.1;
          col += cH * 0.04 * step(D, Dc) * past * inT;
          // the worldlines of galaxies: fixed comoving distance, proper distance a chi
          float chiG = D / max(a, 1e-3);
          float wl = abs(fract(chiG / 0.25 + 0.5) - 0.5) * 0.25 * a * sx;
          col += cB * glow(wl, 200000.0) * 0.25 * inT * smoothstep(0.05, 0.25, a);
          // where a worldline crosses the cone: the light we see from that galaxy today
          if (uShape > 0.5){
            // the Hubble sphere c/H, and the particle horizon a * chi_horizon
            float DH = 1.0 / max(hubbleE(a), 1e-3);
            float Dp = a * (3.2613 - chiA);                           // the horizon today: int da/(a^2 E) from 0 to 1 = 3.2613
            col += cR * glow(abs(D - DH) * sx, 60000.0) * inT * 0.7;
            col += ramp(0.4 + uVarA * 0.2) * glow(abs(D - Dp) * sx, 60000.0) * inT * 0.5;
          }
          if (uShape > 1.5){
            // the last scattering: a band near the bottom, its ripples the seeds of galaxies
            float yl = y0 + ageAt(1.0 / 1091.0) / (t0 * 1.15) * (y1 - y0);
            float cmb = fbm4(vec2(p.x * 10.0, T * 0.05)) - 0.5;
            col += mix(cR, cH, 0.5 + cmb * 2.0) * smoothstep(0.03, 0.0, abs(p.y - yl - 0.012)) * (0.4 + 0.6 * abs(cmb) * 3.0);
            col += cR * 0.07 * smoothstep(yl + 0.02, y0, p.y);
          }
          // now: the observer at the apex
          float yn = y0 + t0 / (t0 * 1.15) * (y1 - y0);
          col += cB * glow(p.y - yn, 400000.0) * 0.25;
          col += vec3(1.0) * glow(length(p - vec2(0.0, yn)), 6000.0) * (0.9 + 0.5 * uBeat);
          // a photon on its way to us, running down the cone each cycle: it first recedes, then arrives
          float ph = fract(T / 14.0);
          float tp = ph * t0;
          float ap = aOfT(tp);
          float Dpn = ap * chiOf(ap);
          float yp = y0 + tp / (t0 * 1.15) * (y1 - y0);
          col += cH * glow(length(vec2(abs(p.x) - Dpn * sx, p.y - yp)), 9000.0) * 1.2;
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
