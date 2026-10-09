#include <metal_stdlib>
using namespace metal;

/* ================================================================
   PLATEAU — why water falls in drops: the Rayleigh–Plateau instability.

   A ripple of wavenumber k on a liquid cylinder of radius a grows as e^{σt},
   σ² ∝ x I₁(x)/I₀(x) (1 − x²), x = ka: only x < 1 grows and x = 0.697 grows
   fastest — drops 9.02 radii apart. THE JET is closed form in the nozzle's
   time: a fluid element fallen a distance s left at τ(s) = (v − v₀)/g,
   v = √(v₀² + 2gs), with radius a₀√(v₀/v) and ripple ε₀e^{στ} cos ω(t − τ);
   past the breakup time the n-th drop sits at s = v₀A + gA²/2 (A its age),
   radius (¾a₀²v₀/f)^{1/3} (one wavelength's volume), oscillating, with its
   satellite. THE INSTABILITY: Rayleigh's curve with Bessel functions; seven
   modes racing on one cylinder; three at once. THE BEADS: dew on an
   Archimedean capture spiral, coated fibres, a dripping tap (an SDF pendant
   drop pinching off). Every surface lit as a liquid lens.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildPlateau() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_pl: a self-contained translation unit.
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

namespace rm_pl {

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

/* Rayleigh's growth: sigma^2 = x I1(x)/I0(x) (1 - x^2), via the polynomial Bessel fits (x < 3.75) */
float rpSig2(float x){
  float t = x / 3.75, t2 = t * t;
  float i0 = 1.0 + t2 * (3.5156229 + t2 * (3.0899424 + t2 * (1.2067492 + t2 * (0.2659732 + t2 * (0.0360768 + t2 * 0.0045813)))));
  float i1 = x * (0.5 + t2 * (0.87890594 + t2 * (0.51498869 + t2 * (0.15084934 + t2 * (0.02658733 + t2 * (0.00301532 + t2 * 0.00032411))))));
  return x * i1 / i0 * (1.0 - x * x);
}
/* a liquid surface lit as a lens: d the signed distance, g the outward direction, R its local radius */
vec3 liquid(float d, vec2 g, float R, vec3 hue){
  float ins = smoothstep(0.0025, -0.0025, d);
  float t = clamp(1.0 + d / max(R, 1e-4), 0.0, 1.0);
  vec3 n = vec3(g * t, sqrt(max(1.0 - t * t, 0.0)));
  float fr = ppow(1.0 - n.z, 3.0);
  float spc = ppow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 40.0);
  float back = ppow(max(dot(n, normalize(vec3(0.5, -0.6, 0.6))), 0.0), 8.0);
  return (hue * (0.05 + 0.2 * n.z) + mix(hue, vec3(1.0), 0.5) * fr * 0.55 + vec3(1.0) * spc * 0.9 + hue * back * 0.25) * ins
       + hue * glow(d, 200000.0) * 0.25;
}
/* an ellipse (semi-axes rx across, ry along) as (d, gx, gy, R) */
vec4 ellD(vec2 q, float rx, float ry){
  vec2 u = q / vec2(rx, ry);
  float l = length(u);
  vec2 g = l > 1e-5 ? u / l : vec2(1.0, 0.0);
  return vec4((l - 1.0) * min(rx, ry), g, min(rx, ry));
}
/* a horizontal liquid cylinder of radius a at time tc with one ripple of ka = xs (phase ph), breaking into drops:
   q measured from its axis (x along); returns (d, gx, gy, R) of the nearest surface */
vec4 cylBreak(vec2 q, float a, float xs, float tc, float eps0, float sg0, float ph){
  float k = xs / a;
  float sg = sg0 * sqrt(max(rpSig2(xs), 0.0));
  float tb = sg > 1e-4 ? log(1.0 / eps0) / sg : 1e9;
  if (tc < tb){
    float al = eps0 * exp(sg * tc);
    float r = a * (sqrt(max(1.0 - al * al * 0.5, 0.0)) + al * cos(k * q.x + ph));
    return vec4(abs(q.y) - r, 0.0, sign(q.y + 1e-6), max(r, 1e-3));
  }
  float lam = 2.0 * PI / k;
  float Rd = ppow(0.75 * a * a * lam, 1.0 / 3.0);
  float Ab = tc - tb;
  float e = 1.0 + 0.3 * exp(-Ab * 2.5) * cos(14.0 * Ab);
  float m = floor((q.x * k + ph) / (2.0 * PI) + 0.5);
  float xc = (2.0 * PI * m - ph) / k;
  vec4 D = ellD(vec2(q.y, q.x - xc), Rd * ppow(e, -1.0 / 3.0), Rd * ppow(e, 2.0 / 3.0));
  D = vec4(D.x, D.z, D.y, D.w);
  float xsat = xc + (q.x > xc ? 0.5 : -0.5) * lam;
  vec4 S = ellD(vec2(q.y, q.x - xsat), Rd * 0.28, Rd * 0.28);
  S = vec4(S.x, S.z, S.y, S.w);
  return S.x < D.x ? S : D;
}
/* the dripping tap's hanging drop (before the pinch) or its remnant (after): a signed distance */
float dripSDF(vec2 p, float tc, float tp, float yn, float rn){
  if (tc >= tp) return length(p - vec2(0.0, yn)) - rn * (0.8 + 0.4 * smoothstep(0.0, 0.4, tc - tp));
  float u = tc / tp;
  float Rd = mix(0.042, 0.1, ppow(u, 0.7));
  float yc = yn - Rd * (0.55 + 0.9 * u * u);
  float rneck = rn * (1.0 - 0.95 * smoothstep(0.55, 1.0, u));
  float dS = length(p - vec2(0.0, yc)) - Rd;
  float yl = yc + Rd * 0.4;
  float w = clamp((yn - p.y) / max(yn - yl, 1e-3), 0.0, 1.0);
  float dN = max(abs(p.x) - mix(rn, rneck, w), max(p.y - yn, yl - p.y));
  return smin(dS, dN, 0.025);
}

}  // namespace rm_pl

fragment float4 room_plateau(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_pl;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.75 + 1;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 hue = ramp(0.55 + uVarA * 0.2), hB = ramp(0.2 + uVarA * 0.2), hC = ramp(0.85 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE JET: from a nozzle at the top, falling, rippling, breaking
          float t = uShape < 0.5 ? T * 0.07 : (uShape < 1.5 ? T * 0.9 : T * 0.45);
          float yn = 0.86;
          float s = yn - p.y;
          float v0 = 0.35, gg = 0.35, a0 = 0.016;
          float f = v0 / (9.02 * a0);
          float eps0 = uShape > 1.5 ? 0.01 + 0.1 * uBass + 0.06 * uBeat : 0.04;
          float sg = 2.3;
          float tb = log(1.0 / eps0) / sg;
          float Rd = ppow(0.75 * a0 * a0 * v0 / f, 1.0 / 3.0);
          // the nozzle
          vec2 nz = abs(p - vec2(0.0, yn + 0.1)) - vec2(0.03, 0.1);
          float dn = max(nz.x, nz.y);
          col += hB * (0.08 * step(dn, 0.0) + glow(dn, 90000.0) * 0.4);
          if (s > 0.0){
            float v = sqrt(v0 * v0 + 2.0 * gg * s);
            float tau = (v - v0) / gg;
            float a = a0 * sqrt(v0 / v);
            if (tau < tb){
              float al = min(eps0 * exp(sg * tau), 1.0);
              float ph = 2.0 * PI * f * (t - tau);
              float r = a * (sqrt(1.0 - al * al * 0.5) + al * cos(ph));
              col += liquid(abs(p.x) - r, vec2(sign(p.x + 1e-6), 0.0), max(r, 1e-3), hue);
            }
            // the drops (and their satellites): the n-th left the nozzle at n / f
            float m0 = floor(f * (t - tau) + 0.5);
            for (int j = -1; j <= 1; j++){
              float n = m0 + float(j);
              float A = t - n / f;
              vec3 dh = uShape > 1.5 ? ramp(fract(n * 0.13) * 0.6 + uVarA * 0.2) : hue;
              if (A >= tb){
                float sc = v0 * A + 0.5 * gg * A * A;
                float Ab = A - tb;
                float e = 1.0 + 0.32 * exp(-Ab * 2.5) * cos(14.0 * Ab);
                vec4 D = ellD(vec2(p.x, p.y - (yn - sc)), Rd * ppow(e, -1.0 / 3.0), Rd * ppow(e, 2.0 / 3.0));
                col += liquid(D.x, D.yz, D.w, dh);
              }
              float As = A - 0.5 / f;
              if (As >= tb + 0.03){
                float ss = v0 * As + 0.5 * gg * As * As + 0.01;
                vec4 S = ellD(vec2(p.x, p.y - (yn - ss)), Rd * 0.27, Rd * 0.27);
                col += liquid(S.x, S.yz, S.w, dh) * 0.9;
              }
            }
          }
          // the pool below, and the rings the drops leave in it
          float yw = -0.86;
          float Ah = (-v0 + sqrt(v0 * v0 + 2.0 * gg * (yn - yw))) / gg;
          if (p.y < yw){
            col += hue * 0.05 * smoothstep(yw - 0.3, yw, p.y);
          }
          float nh = floor(f * (t - Ah));
          for (int k = 0; k < 4; k++){
            float age = t - (nh - float(k)) / f - Ah;
            float rho = 0.6 * age;
            vec2 q = vec2(p.x, (p.y - yw) * 4.0);
            col += hue * glow(length(q) - rho, 9000.0) * exp(-age * 1.2) * 0.6 * step(0.0, age);
          }
          col += hue * glow(p.y - yw, 200000.0) * 0.25;
        } else if (uMode < 1.5){
          float P = uShape > 1.5 ? 12.0 : 10.0;
          float cyc = floor(T / P);
          float tc = mod(T, P);
          float fade = smoothstep(0.0, 0.5, tc) * smoothstep(P, P - 0.6, tc);
          float sg0 = 3.54;
          if (uShape < 0.5){
            // THE GROWTH CURVE, and a cylinder breaking at the ripple it picks
            float xs = 0.15 + 0.82 * hash21(vec2(cyc, 4.7));
            float a = 0.05;
            vec4 D = cylBreak(vec2(p.x, p.y - 0.42), a, xs, tc, 0.01, sg0, 0.0);
            col += liquid(D.x, D.yz, D.w, hue) * fade;
            // the curve: growth rate against ka
            float x0 = -uAspect * 0.8, x1 = uAspect * 0.8, yb = -0.78, yt = -0.12;
            float u = (p.x - x0) / (x1 - x0) * 1.15;
            float smax = sqrt(rpSig2(0.697));
            float fu = sqrt(max(rpSig2(u), 0.0)) / smax;
            float fu2 = sqrt(max(rpSig2(u + 0.003), 0.0)) / smax;
            float yc = yb + (yt - yb) * fu;
            float slope = (fu2 - fu) / 0.003 * (yt - yb) / ((x1 - x0) / 1.15);
            float inX = step(0.0, u) * step(u, 1.15);
            col += hue * glow((p.y - yc) / sqrt(1.0 + slope * slope), 150000.0) * inX * 0.9 * step(u, 1.0);
            col += hB * glow(p.y - yb, 300000.0) * inX * 0.3;
            // the marker at the chosen ripple, and the tick at the fastest
            float xm = x0 + xs / 1.15 * (x1 - x0);
            float ym = yb + (yt - yb) * sqrt(max(rpSig2(xs), 0.0)) / smax;
            col += hC * glow(length(p - vec2(xm, ym)), 20000.0) * (1.0 + uBeat);
            col += hC * glow(p.x - xm, 300000.0) * step(yb, p.y) * step(p.y, ym) * step(0.5, fract(p.y * 30.0)) * 0.4;
            float xb = x0 + 0.697 / 1.15 * (x1 - x0);
            col += hB * glow(p.x - xb, 300000.0) * step(abs(p.y - yb - 0.02), 0.02) * 0.6;
            col += hB * glow(p.x - x0 - (x1 - x0) / 1.15, 300000.0) * step(abs(p.y - yb - 0.02), 0.02) * 0.6;
          } else if (uShape < 1.5){
            // THE CYLINDER: roughened with every ripple at once; the 9-radius one wins
            float a = 0.07;
            float r = 0.0;
            float tcl = tc < 5.0 ? tc : 5.0 + (tc - 5.0) * 0.05;
            float amps = 0.0;
            vec2 q = vec2(p.x, p.y - 0.2);
            for (int i = 0; i < 7; i++){
              float xi = 0.13 * float(i + 1);
              float sgi = sg0 * sqrt(max(rpSig2(xi), 0.0));
              float ei = 0.0025 * (0.6 + 0.8 * hash21(vec2(cyc, float(i)))) * exp(sgi * tcl);
              r += ei * cos(xi / a * q.x + 6.2832 * hash21(vec2(float(i), cyc + 9.0)));
              // the amplitudes, as bars below (log scale)
              float bx = -0.6 + 0.2 * float(i);
              float bh = clamp((log(ei) + 7.0) / 7.0, 0.0, 1.0) * 0.45;
              vec3 bc = ramp(float(i) / 7.0 * 0.8 + uVarA * 0.2);
              float inB = step(abs(p.x - bx * uAspect * 0.9), 0.04) * step(-0.85, p.y) * step(p.y, -0.85 + bh);
              col += bc * inB * (0.25 + 0.5 * smoothstep(-0.85 + bh - 0.02, -0.85 + bh, p.y)) * fade;
              if (i == 4) col += hC * glow(abs(p.x - bx * uAspect * 0.9) - 0.055, 90000.0) * step(-0.87, p.y) * step(p.y, -0.38) * 0.4 * fade;
            }
            float rs = r / (1.0 + 0.15 * abs(r));
            float rr = a * (sqrt(max(1.0 - 0.5 * min(rs * rs, 1.0), 0.0)) + rs);
            col += liquid(abs(q.y) - rr, vec2(0.0, sign(q.y + 1e-6)), max(rr, 1e-3), hue) * fade;
            col += hB * glow(p.y + 0.85, 300000.0) * step(abs(p.x), uAspect * 0.7) * 0.3;
          } else {
            // THE BEST WAVE: three ripples race on three cylinders; the 0.697 one breaks first
            for (int i = 0; i < 3; i++){
              float xs = i == 0 ? 0.35 : (i == 1 ? 0.697 : 0.93);
              float yc = 0.52 - 0.52 * float(i);
              vec4 D = cylBreak(vec2(p.x, p.y - yc), 0.045, xs, tc, 0.01, sg0, 0.0);
              col += liquid(D.x, D.yz, D.w, ramp(float(i) * 0.3 + uVarA * 0.2)) * fade;
            }
          }
        } else {
          if (uShape < 0.5){
            // THE DEW: beads strung along a spider's capture spiral, lit by morning light
            vec2 q = p - vec2(0.0, 0.03);
            q += vec2(0.012 * sin(T * 0.7 + q.y * 2.0), 0.009 * cos(T * 0.5 + q.x * 3.0)) * (1.0 + 1.5 * uBass);
            // morning bokeh behind
            for (int b = 0; b < 6; b++){
              vec2 bc = vec2((hash21(vec2(float(b), 1.0)) - 0.5) * uAspect * 2.0, (hash21(vec2(float(b), 2.0)) - 0.5) * 2.0);
              float br = 0.15 + 0.2 * hash21(vec2(float(b), 3.0));
              col += ramp(hash21(vec2(float(b), 4.0)) * 0.6 + uVarA * 0.2) * smoothstep(br, br - 0.03, length(p - bc)) * 0.04;
            }
            float r = length(q);
            float a = atan2s(q.y, q.x);
            float r0 = 0.1, c = 0.0135, rmax = 0.86;
            // the radial threads
            float N = 19.0;
            float ai = (floor(a / (2.0 * PI) * N + 0.5) + 0.12 * (hash21(vec2(floor(a / (2.0 * PI) * N + 0.5), 5.0)) - 0.5)) * 2.0 * PI / N;
            float dr = r * abs(sin(a - ai));
            col += hB * glow(dr, 600000.0) * 0.25 * step(r, rmax + 0.05);
            // the capture spiral, and its dew
            float n = floor((r - r0 - c * (a + PI)) / (2.0 * PI * c) + 0.5);
            float rs = r0 + c * (a + PI + 2.0 * PI * n);
            if (rs > r0 && rs < rmax){
              col += hue * glow(r - rs, 900000.0) * 0.2;
              float Nb = floor(2.0 * PI * rs / 0.05);
              float dth = 2.0 * PI / Nb;
              float am = (a + PI);
              for (int j = -1; j <= 1; j++){
                float m = floor(am / dth + 0.5) + float(j);
                float th = m * dth;
                float rb0 = r0 + c * (th + 2.0 * PI * n);
                vec2 bp = rb0 * vec2(cos(th - PI), sin(th - PI));
                float h = hash21(vec2(m, n + 31.0));
                float br = (0.006 + 0.01 * h) * step(0.3, hash21(vec2(m + 7.0, n)));
                if (br > 0.0){
                  vec2 dq = q - bp;
                  float l = length(dq);
                  vec3 bh = ramp(fract(h * 3.7) * 0.5 + 0.35 + uVarA * 0.2);
                  vec3 lc = liquid(l - br, dq / max(l, 1e-5), br, bh);
                  float tw = 0.6 + 0.8 * uTreble * step(0.85, hash21(vec2(m, n + floor(T * 3.0))));
                  col += lc * tw;
                }
              }
            }
          } else if (uShape < 1.5){
            // THE FIBRE: three coated fibres beading up, the thicker coat into larger, sparser beads
            float P = 11.0;
            float tc = mod(T, P);
            float fade = smoothstep(0.0, 0.6, tc) * smoothstep(P, P - 0.6, tc);
            for (int i = 0; i < 3; i++){
              float yc = 0.5 - 0.5 * float(i);
              float a = 0.022 + 0.012 * float(i);
              float b = 0.005;
              float k = 1.0 / (sqrt(2.0) * a);
              float al = min(0.01 * exp(tc * 1.4 * 0.035 / a), 1.0);
              float ph = float(i) * 1.3 + 0.4 * sin(T * 0.1);
              float r = b + (a - b) * max(sqrt(1.0 - al * al * 0.5) + al * cos(k * p.x + ph), 0.04);
              vec3 hh = ramp(float(i) * 0.3 + uVarA * 0.2);
              float dy = p.y - yc;
              col += liquid(abs(dy) - r, vec2(0.0, sign(dy + 1e-6)), r, hh) * fade;
              // the fibre through it
              col += mix(hh, vec3(1.0), 0.5) * glow(dy, 400000.0) * 0.35;
            }
          } else {
            // THE DRIP: a tap, a pendant drop swelling, pinching, falling
            float P = 3.4;
            float tc = mod(T * 0.8, P);
            float tp = 2.5;
            float yn = 0.74, rn = 0.04;
            vec2 nz = abs(p - vec2(0.0, yn + 0.15)) - vec2(rn + 0.012, 0.15);
            float dn = max(nz.x, nz.y);
            col += hB * (0.08 * step(dn, 0.0) + glow(dn, 90000.0) * 0.4);
            float d = dripSDF(p, tc, tp, yn, rn);
            float Rd = mix(0.042, 0.1, ppow(min(tc / tp, 1.0), 0.7));
            // after the pinch: the drop falls and wobbles; a satellite; the next drop begins at the tap
            if (tc >= tp){
              float A = tc - tp;
              float Rf = 0.1;
              float ycf = (yn - Rf * 1.45) - 0.9 * A * A - 0.15 * A;
              float e = 1.0 + 0.28 * exp(-A * 3.0) * cos(22.0 * A);
              vec4 D = ellD(vec2(p.x, p.y - ycf), Rf * ppow(e, -1.0 / 3.0), Rf * ppow(e, 2.0 / 3.0));
              col += liquid(D.x, D.yz, D.w, hue);
              float ysat = yn - 0.06 - 0.6 * A * A;
              vec4 S = ellD(vec2(p.x, p.y - ysat), 0.012, 0.012);
              col += liquid(S.x, S.yz, S.w, hue) * step(0.04, A);
            }
            float eps = 0.002;
            vec2 gd = normalize(vec2(dripSDF(p + vec2(eps, 0.0), tc, tp, yn, rn) - d, dripSDF(p + vec2(0.0, eps), tc, tp, yn, rn) - d) + vec2(1e-7, 0.0));
            col += liquid(d, gd, tc < tp ? Rd : rn, hue);
            // the basin and the rings from the last drop
            float yw = -0.84;
            float Ah = (-0.15 + sqrt(0.0225 + 3.6 * (yn - 0.145 - yw))) / 1.8;
            float age = tc - tp - Ah;
            if (age < 0.0) age += P;
            vec2 q = vec2(p.x, (p.y - yw) * 4.0);
            col += hue * glow(length(q) - 0.5 * age, 9000.0) * exp(-age * 1.0) * 0.7;
            col += hue * glow(p.y - yw, 200000.0) * 0.25 + hue * 0.04 * step(p.y, yw);
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
