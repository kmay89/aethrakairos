#include <metal_stdlib>
using namespace metal;

/* ================================================================
   KUTTA — lift, made visible: potential flow round a Joukowski airfoil.

   The flow round a circle (W = U[(ζ−μ)e^{−iα} + a²e^{iα}/(ζ−μ)] + iΓ/2π log(ζ−μ))
   carried onto the airfoil by z = ζ + s/ζ (inverted per pixel, the root
   outside the circle kept), Γ fixed by Kutta's condition at the sharp
   trailing edge, Γ = 4πaU sin(α + β). Streamlines are the stream function's
   level sets, the colour Bernoulli's pressure, and the smoke pulses carry
   each point's true time of flight, integrated backward along its streamline
   (RK2 in the z-plane): the upper half of a pulse beats the lower half to
   the trailing edge — no equal transit, only circulation. THE CURVEBALL is
   the Magnus cylinder, its stagnation points merging and leaving the
   surface past Γ = 4πaU. THE MAP morphs the circle and its log-polar grid
   into the wing as s runs from 0 to 1 — conformal, every small square
   staying square.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildKutta() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_ku: a self-contained translation unit.
   ================================================================ */

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140
    // _pad1/_pad2 (132/136) carry the LENS pass's live fields and _pad3
    // (140) the song's Camelot number — no pad here is free to claim
    float dHit; float dAge; float dKick; float dMass;               // 144..156  the dance bus (see tools/dance_prelude.mjs)
    float dArtic; float dSpark; float dSway; float dLift;           // 160..172
    float dBrace; float dImpact; float dStill; float dPeriod;       // 176..188  -> stride 192
};
static_assert(sizeof(VizUniforms) == 192, "VizUniforms drifted: the CPU mirror uploads 192 bytes");

namespace rm_ku {

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

/* the flow round a circle (centre mu, radius a), free stream U = 1 at angle al, circulation G:
   dW/dzeta, and the stream function psi = Im W (its log term has no cut) */
vec2 cylV(vec2 zt, vec2 mu, float a, float al, float G){
  vec2 w = zt - mu;
  vec2 em = vec2(cos(al), -sin(al)), ep = vec2(cos(al), sin(al));
  return em - a * a * cdiv(ep, cmul(w, w)) + G / (2.0 * PI) * cdiv(vec2(0.0, 1.0), w);
}
float cylPsi(vec2 zt, vec2 mu, float a, float al, float G){
  vec2 w = zt - mu;
  vec2 em = vec2(cos(al), -sin(al)), ep = vec2(cos(al), sin(al));
  vec2 W = cmul(w, em) + a * a * cdiv(ep, w);
  return W.y + G / (2.0 * PI) * log(max(length(w), 1e-6));
}
/* z -> zeta outside the circle, for z = zeta + s/zeta: of the two roots, the one farther from mu */
vec2 zetaOf(vec2 z, float s, vec2 mu){
  vec2 r = csqrt(cmul(z, z) - vec2(4.0 * s, 0.0));
  vec2 z1 = 0.5 * (z + r), z2 = 0.5 * (z - r);
  return length(z1 - mu) >= length(z2 - mu) ? z1 : z2;
}
/* the velocity (u, v) in the z-plane */
vec2 flowZ(vec2 z, float s, vec2 mu, float a, float al, float G){
  vec2 zt = zetaOf(z, s, mu);
  vec2 dz = vec2(1.0, 0.0) - s * cdiv(vec2(1.0, 0.0), cmul(zt, zt));
  vec2 c = cdiv(cylV(zt, mu, a, al, G), dz);
  return vec2(c.x, -c.y);
}
/* the time of flight from far upstream (x = xUp) to z along its streamline, RK2 backwards */
float tof(vec2 z, float s, vec2 mu, float a, float al, float G, float xUp){
  float tau = 0.0;
  vec2 q = z;
  for (int i = 0; i < 20; i++){
    if (q.x < xUp) break;
    float h = 0.26;
    vec2 v0 = flowZ(q, s, mu, a, al, G);
    vec2 qm = q - 0.5 * h * v0 / max(length(v0), 0.04);
    vec2 vm = flowZ(qm, s, mu, a, al, G);
    float spm = max(length(vm), 0.04);
    q -= h * vm / spm;
    tau += h / spm;
  }
  return tau + (q.x - xUp) / max(cos(al), 0.3);           // signed: undo the overshoot, so tau stays continuous
}

}  // namespace rm_ku

fragment float4 room_kutta(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_ku;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.85 + 0;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 hot = ramp(0.85 + uVarA * 0.1), cool = ramp(0.15 + uVarA * 0.1), lineC = ramp(0.5 + uVarA * 0.1);
        // the stage: the body's frame, z-units (the airfoil runs about -2..2)
        float kz = 4.2 / min(1.15 * uAspect, 2.1);
        vec2 z = p * kz + vec2(0.25, 0.0);
        float s = 1.0;
        vec2 mu = vec2(0.0);
        float a = 1.0;
        float al = 0.0;
        float G = 0.0;
        float gridOnly = 0.0;
        float spin = 0.0;
        if (uMode < 0.5){
          float eps = uShape < 0.5 ? 0.10 : (uShape < 1.5 ? 0.08 : 0.18);
          float del = uShape < 0.5 ? 0.0 : (uShape < 1.5 ? 0.10 : 0.15);
          mu = vec2(-eps, del);
          a = length(vec2(1.0, 0.0) - mu);
          al = 0.13 + 0.08 * sin(T * 0.21) + 0.04 * uEnergy + (uHand.z > 0.05 ? uHand.y * 0.25 * uHand.z : 0.0);
          float be = atan2s(del, 1.0 + eps);
          G = 4.0 * PI * a * sin(al + be);
        } else if (uMode < 1.5){
          s = 0.0; mu = vec2(0.0); a = 1.0;
          z = p * kz * 0.95;
          float sw = uShape < 0.5 ? 0.55 + 0.35 * sin(T * 0.25) : (uShape < 1.5 ? -(0.55 + 0.35 * sin(T * 0.25)) : 1.05 + 1.0 * sin(T * 0.18));
          spin = sw + 0.25 * uBass;
          G = 4.0 * PI * a * spin;                               // Gamma = 4 pi a U s: s = 1 is where the stagnation points meet
          al = 0.0;
        } else {
          float m = 0.5 - 0.5 * cos(T * 2.0 * PI / 16.0);
          s = uShape < 0.5 || uShape > 1.5 ? m : 1.0;
          float q0 = sqrt(s);
          float bp = uShape < 0.5 || uShape > 1.5 ? 0.09 : 0.0;
          a = uShape < 0.5 || uShape > 1.5 ? 1.1 : 1.0;
          mu = vec2(q0 - a * cos(bp), a * sin(bp));
          if (uShape > 0.5 && uShape < 1.5) mu = vec2(0.0);       // a circle round the origin maps to the flat plate
          al = uShape > 0.5 && uShape < 1.5 ? 0.08 + 0.12 * m : 0.10;
          G = 4.0 * PI * a * sin(al + bp);
          // keep the body centred while the map changes
          vec2 c0 = mu + s * cdiv(vec2(1.0, 0.0), mu + vec2(1e-4, 0.0));
          z = p * kz + (uShape > 0.5 && uShape < 1.5 ? vec2(0.0) : c0 * 0.9);
          gridOnly = step(1.5, uShape);
        }
        vec2 zt = zetaOf(z, s, mu);
        float rr = length(zt - mu);
        bool body = rr < a;
        if (!body){
          vec2 dz = vec2(1.0, 0.0) - s * cdiv(vec2(1.0, 0.0), cmul(zt, zt));
          vec2 cV = cdiv(cylV(zt, mu, a, al, G), dz);
          float sp = length(cV);
          float Cp = 1.0 - sp * sp;
          // Bernoulli: suction warm, pressure cool
          col += hot * clamp(-Cp, 0.0, 3.0) * 0.07 * (0.8 + uMid * 0.4) + cool * clamp(Cp, 0.0, 1.0) * 0.09;
          // the streamlines: level sets of psi, drawn at constant width
          float psi = cylPsi(zt, mu, a, al, G);
          float dpsi = 0.24;
          float wr = abs(fract(psi / dpsi + 0.5) - 0.5) * dpsi;
          float dl = wr / max(sp, 0.02) / kz;
          float near = glow(dl, 160000.0);
          col += lineC * near * (gridOnly > 0.5 ? 0.0 : 0.55) * smoothstep(0.02, 0.15, sp);
          // the conformal grid of the circle's plane, carried through the map
          if (uMode > 1.5){
            float u = log(max(rr / a, 1e-4));
            float v = atan2s(zt.y - mu.y, zt.x - mu.x);
            float J = 1.0 / (max(rr, 1e-4) * max(length(dz), 1e-3) * kz);   // |grad u| in screen units
            float du = abs(fract(u / 0.12 + 0.5) - 0.5) * 0.12 / J;
            float dv = abs(fract(v / (PI / 16.0) + 0.5) - 0.5) * (PI / 16.0) / J;
            col += cool * (glow(du, 90000.0) + glow(dv, 90000.0)) * (gridOnly > 0.5 ? 0.6 : 0.22) * smoothstep(4.0, 2.0, u);
          }
          // the smoke pulses: true time of flight, released upstream every 0.9 s
          if (gridOnly < 0.5 && abs(z.y) < 3.2){
            float tau = tof(z, s, mu, a, al, G, -3.4);
            float ph = fract((T * 1.1 - tau) / 0.9);
            float band = smoothstep(0.0, 0.02, ph) * smoothstep(0.07, 0.025, ph);
            col += mix(vec3(0.85), lineC, 0.35) * band * (0.2 + uBeat * 0.2 + near * 0.35) * smoothstep(0.03, 0.12, sp);
          }
        } else {
          // the body
          float rim = glow((a - rr) * 0.5, 4000.0);
          col = ramp(0.6) * 0.03 + lineC * rim * 0.8;
          if (uMode > 0.5 && uMode < 1.5){
            float th = atan2s(zt.y, zt.x);
            float stripe = smoothstep(0.75, 0.95, cos(6.0 * (th + spin * T * 1.4)));
            col += hot * stripe * 0.25 * smoothstep(0.2, 0.9, rr);
          }
        }
        // the stagnation points on the circle, carried through the map
        float k = -G / (4.0 * PI * a);
        if (abs(k) <= 1.0){
          for (int j = 0; j < 2; j++){
            float th = al + (j == 0 ? asin(clamp(k, -1.0, 1.0)) : PI - asin(clamp(k, -1.0, 1.0)));
            vec2 zs = mu + a * vec2(cos(th), sin(th));
            vec2 Z = zs + s * cdiv(vec2(1.0, 0.0), zs);
            col += hot * glow(length(z - Z) / kz, 9000.0) * 0.9;
          }
        } else {
          // past 4 pi a U they merge and leave the body: one stagnation point, out in the flow
          float rs = a * (abs(k) + sqrt(k * k - 1.0));
          vec2 Z = mu + rs * vec2(0.0, k < 0.0 ? -1.0 : 1.0);
          col += hot * glow(length(z - Z) / kz, 9000.0) * 1.2;
        }
        // the lift: rho U Gamma, straight up the screen
        if (gridOnly < 0.5){
          vec2 Lc = (vec2(0.0, 0.0) - vec2(0.25, 0.0)) / kz;
          if (uMode > 0.5 && uMode < 1.5) Lc = vec2(0.0);
          float Lm = clamp(G * 0.055, -0.65, 0.65);
          vec2 L0 = Lc + vec2(0.0, sign(Lm) * 0.12), L1 = Lc + vec2(0.0, sign(Lm) * 0.12 + Lm);
          float da = segd(p, L0, L1);
          vec2 dir = normalize(L1 - L0 + vec2(0.0, 1e-5));
          float hd = min(segd(p, L1, L1 - dir * 0.05 + vec2(-dir.y, dir.x) * 0.03), segd(p, L1, L1 - dir * 0.05 - vec2(-dir.y, dir.x) * 0.03));
          col += hot * (glow(da, 60000.0) + glow(hd, 60000.0)) * 0.9 * step(0.02, abs(Lm));
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
