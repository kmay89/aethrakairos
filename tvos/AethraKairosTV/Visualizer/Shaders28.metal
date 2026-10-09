#include <metal_stdlib>
using namespace metal;

/* ================================================================
   BRACHISTOCHRONE — the race of curves: fastest descent and equal time.

   THE RACE: four beads from A to B under gravity — the straight ramp
   (s = ½ g sinα t², exact), Galileo's circle and a deeper dive (timed by
   marching dt = ds/√(2gh) along each rail, the start's 1/√h singularity
   removed by a squared parameter), and the cycloid (θ = t√(g/r), exact),
   which wins every time, dipping below B when the course is long. A strobe
   leaves the past behind each bead. THE TAUTOCHRONE: the cycloid as a bowl,
   where s = s₀ cos ωt, ω = √(g/4r): seven heights, one arrival; a circular
   bowl beside it (a pendulum of the same small-swing period, solved with
   Jacobi's sn) cannot keep the appointment. HUYGENS' CLOCK: the bob hung
   between cycloidal cheeks — the evolute of the cycloid is itself a
   cycloid, so the string wraps and the bob runs isochronous — beside a
   plain pendulum swung as wide, which lags, and one swung small, which
   does not.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildBrachisto() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_bc: a self-contained translation unit.
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

namespace rm_bc {

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

/* Jacobi's sn(u, k) by the descending AGM: the exact large-swing pendulum */
float jsn(float u, float k){
  float a[6]; float c[6];
  a[0] = 1.0; c[0] = k;
  float b = sqrt(max(1.0 - k * k, 0.0));
  for (int n = 1; n < 6; n++){
    a[n] = 0.5 * (a[n - 1] + b);
    c[n] = 0.5 * (a[n - 1] - b);
    b = sqrt(a[n - 1] * b);
  }
  float ph = 32.0 * a[5] * u;
  for (int n = 5; n >= 1; n--) ph = 0.5 * (ph + asin(clamp(c[n] / a[n] * sin(ph), -1.0, 1.0)));
  return sin(ph);
}
/* the complete elliptic integral K(k) by the same AGM */
float ellK(float k){
  float a = 1.0, b = sqrt(max(1.0 - k * k, 0.0));
  for (int n = 0; n < 6; n++){ float an = 0.5 * (a + b); b = sqrt(a * b); a = an; }
  return 1.5707963 / a;
}
/* the simple pendulum released from rest at th0: angle at time t (omega0 = sqrt(g/L)) */
float pend(float th0, float w0, float t){
  float k = sin(0.5 * abs(th0));
  float s = jsn(ellK(k) + w0 * t, k);
  return 2.0 * asin(clamp(k * s, -1.0, 1.0)) * (th0 < 0.0 ? -1.0 : 1.0);
}
/* the cycloid bowl (bottom at the origin, radius r) at arc length s from the bottom */
vec2 bowl(float s, float r){
  float ph = 2.0 * asin(clamp(s / (4.0 * r), -1.0, 1.0));
  return r * vec2(ph + sin(ph), 1.0 - cos(ph));
}
vec3 beadAt(vec2 p, vec2 c, float rad, vec3 hue, vec3 bg){
  vec3 o = sphereShade((p - c) / rad, hue, bg, 0.7);
  return o + hue * glow(length(p - c) - rad, 3000.0) * 0.35;
}

}  // namespace rm_bc

fragment float4 room_brachisto(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_bc;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.95 + 0;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        float g = 2.2;
        vec3 rail = ramp(0.55) * 0.55;
        if (uMode < 0.5){
          /* ===== THE RACE ===== */
          float span = min(1.30, uAspect * 0.74);
          float ratio = uShape < 0.5 ? 1.35 : (uShape < 1.5 ? 2.6 : 0.85);
          // the cycloid through A and B: (th - sin th)/(1 - cos th) = X/Y, solved by bisection
          float lo = 0.01, hi = 6.27;
          for (int i = 0; i < 26; i++){ float m = 0.5 * (lo + hi); if ((m - sin(m)) / (1.0 - cos(m)) < ratio) lo = m; else hi = m; }
          float thB = 0.5 * (lo + hi);
          float Y0 = 1.0, X0 = ratio;
          float r0 = Y0 / (1.0 - cos(thB));
          float Hc = max(Y0, 2.0 * r0);
          float sc = min(2.0 * span / X0, 1.36 / Hc);
          float X = X0 * sc, Y = Y0 * sc, r = r0 * sc;
          vec2 A = vec2(-0.5 * X, 0.5 * max(Y, 2.0 * r) * 1.0 - 0.02 + 0.08);
          vec2 B = A + vec2(X, -Y);
          float Tc = thB * sqrt(r / g);
          float cyc = 2.3 * Tc + 1.6;
          float t = mod(T, cyc) - 0.6;
          vec3 hue0 = ramp(0.15 + uVarA * 0.2), hue1 = ramp(0.35 + uVarA * 0.2), hue2 = ramp(0.60 + uVarA * 0.2), hue3 = ramp(0.85 + uVarA * 0.2);
          // --- the straight ramp, exact
          float Ls = length(B - A), as = g * Y / Ls, Ts = sqrt(2.0 * Ls / as);
          vec2 ds = (B - A) / Ls;
          float dRail = segd(p, A, B);
          // --- the cycloid, exact: sampled for its rail
          float dCyc = 1e3;
          vec2 q0 = A;
          for (int i = 1; i <= 40; i++){
            float th = thB * float(i) / 40.0;
            vec2 q1 = A + r * vec2(th - sin(th), -(1.0 - cos(th)));
            dCyc = min(dCyc, segd(p, q0, q1));
            q0 = q1;
          }
          // --- Galileo's circle (vertical at A) and the dive: marched in time
          float Rc = (X * X + Y * Y) / (2.0 * X);
          vec2 Cc = A + vec2(Rc, 0.0);
          float psB = atan2s(Y, Rc - X);
          vec2 P1 = A + vec2(0.0, -2.0 * r), P2 = B + vec2(-0.40 * X, -1.3 * r);
          float dCir = 1e3, dDiv = 1e3;
          float tCir = 0.0, tDiv = 0.0;
          vec2 cPrev = A, vPrev = A;
          vec2 bc[7]; vec2 bd[7];
          for (int j = 0; j < 7; j++){ bc[j] = A; bd[j] = A; }
          for (int i = 1; i <= 48; i++){
            float w0 = float(i - 1) / 48.0, w1 = float(i) / 48.0, wm = 0.5 * (w0 + w1);
            // the circle: psi = psB w², v = sqrt(2 g Rc sin psi)
            float ps1 = psB * w1 * w1, psm = psB * wm * wm;
            vec2 c1 = Cc + Rc * vec2(-cos(ps1), -sin(ps1));
            float vm = sqrt(max(2.0 * g * Rc * sin(psm), 1e-6));
            float dtc = Rc * psB * (w1 * w1 - w0 * w0) / vm;
            // the dive: a cubic from A to B, parameter u = w²
            float u0 = w0 * w0, u1 = w1 * w1, um = wm * wm;
            vec2 d1 = A * (1.0 - u1) * (1.0 - u1) * (1.0 - u1) + 3.0 * P1 * u1 * (1.0 - u1) * (1.0 - u1) + 3.0 * P2 * u1 * u1 * (1.0 - u1) + B * u1 * u1 * u1;
            vec2 dm = A * (1.0 - um) * (1.0 - um) * (1.0 - um) + 3.0 * P1 * um * (1.0 - um) * (1.0 - um) + 3.0 * P2 * um * um * (1.0 - um) + B * um * um * um;
            float vd = sqrt(max(2.0 * g * (A.y - dm.y), 1e-6));
            float dtd = length(d1 - vPrev) / vd;
            for (int j = 0; j < 7; j++){
              float tq = t - float(j) * 0.11;
              if (tq > tCir && tq <= tCir + dtc) bc[j] = mix(cPrev, c1, (tq - tCir) / dtc);
              if (tq > tCir + dtc && i == 48) bc[j] = B;
              if (tq > tDiv && tq <= tDiv + dtd) bd[j] = mix(vPrev, d1, (tq - tDiv) / dtd);
              if (tq > tDiv + dtd && i == 48) bd[j] = B;
            }
            dCir = min(dCir, segd(p, cPrev, c1));
            dDiv = min(dDiv, segd(p, vPrev, d1));
            tCir += dtc; tDiv += dtd;
            cPrev = c1; vPrev = d1;
          }
          // the rails: each lights in its own colour once its bead is home
          col += mix(rail, hue0, step(Ts, t) * 0.6) * glow(dRail, 30000.0);
          col += mix(rail, hue1, step(tCir, t) * 0.6) * glow(dCir, 30000.0);
          col += mix(rail, hue2, step(Tc, t) * 0.8) * (glow(dCyc, 30000.0) * 1.2 + glow(dCyc, 900.0) * 0.06 * step(Tc, t));
          col += mix(rail, hue3, step(tDiv, t) * 0.6) * glow(dDiv, 30000.0);
          // start and finish
          col += ramp(0.5) * glow(length(p - A), 2500.0) * 0.6;
          float fin = exp(-max(t - Tc, 0.0) * 2.5) * step(Tc, t);
          col += hue2 * (glow(length(p - B), 2500.0) * 0.8 + glow(abs(length(p - B) - 0.05 - 0.25 * (1.0 - fin)), 5000.0) * fin * 1.5);
          // the strobe: each bead's past, fading
          float rad = 0.032;
          for (int j = 6; j >= 0; j--){
            float tq = t - float(j) * 0.11;
            float fade = j == 0 ? 1.0 : (0.40 - 0.05 * float(j)) * (1.0 + uBeat * 0.6);
            if (tq < 0.0) continue;
            vec2 ps = A + ds * 0.5 * as * min(tq, Ts) * min(tq, Ts);
            float thq = min(tq * sqrt(g / r), thB);
            vec2 pc = A + r * vec2(thq - sin(thq), -(1.0 - cos(thq)));
            if (j == 0){
              col = beadAt(p, ps, rad, hue0, col);
              col = beadAt(p, bc[j], rad, hue1, col);
              col = beadAt(p, pc, rad, hue2, col);
              col = beadAt(p, bd[j], rad, hue3, col);
            } else {
              col += hue0 * glow(length(p - ps), 4000.0) * fade;
              col += hue1 * glow(length(p - bc[j]), 4000.0) * fade;
              col += hue2 * glow(length(p - pc), 4000.0) * fade;
              col += hue3 * glow(length(p - bd[j]), 4000.0) * fade;
            }
          }
        } else if (uMode < 1.5){
          /* ===== THE TAUTOCHRONE: seven heights, one arrival ===== */
          float span = min(1.30, uAspect * 0.78);
          float Rb = min(0.36, span / PI);
          float w = sqrt(g / (4.0 * Rb));
          float yb = -0.42;
          float meet = exp(-sq(cos(w * T)) * 40.0);
          for (int k = 0; k < 7; k++){
            float fk = float(k);
            float dy = (fk - 3.0) * 0.105;
            vec2 base = vec2(0.0, yb + dy);
            vec3 hue = ramp(fk / 7.0 + uVarA);
            bool circ = uShape > 1.5 && mod(fk, 2.0) > 0.5;
            float side = (uShape > 0.5 && uShape < 1.5 && mod(fk, 2.0) > 0.5) ? 1.0 : -1.0;
            float ph0 = (0.22 + 0.68 * fk / 6.0) * PI;
            // the rail
            // the rail: the cycloid bowl, or the circle of the bottom's own curvature (radius 4r)
            float dr = 1e3;
            vec2 q0 = circ ? base + vec2(0.0, 4.0 * Rb) + 4.0 * Rb * vec2(-0.866025, -0.5) : base + Rb * vec2(-PI, 2.0);
            for (int i = 1; i <= 36; i++){
              float ph = -PI + 2.0 * PI * float(i) / 36.0;
              vec2 q1 = base + Rb * vec2(ph + sin(ph), 1.0 - cos(ph));
              if (circ){ float a = ph / 3.0; q1 = base + vec2(0.0, 4.0 * Rb) + 4.0 * Rb * vec2(sin(a), -cos(a)); }
              dr = min(dr, segd(p, q0, q1));
              q0 = q1;
            }
            col += (circ ? ramp(0.3) * 0.45 : rail) * glow(dr, 30000.0) * (0.8 + 0.2 * fk / 6.0);
            // the bead and its strobe
            for (int j = 5; j >= 0; j--){
              float tq = T - float(j) * 0.09;
              vec2 c;
              if (circ){
                // same release height as its cycloid neighbour, on the circle: a large-swing pendulum
                float h = Rb * (1.0 - cos(ph0));
                float th0 = acos(clamp(1.0 - h / (4.0 * Rb), -1.0, 1.0)) * side;
                float th = pend(th0, w, tq);
                c = base + vec2(0.0, 4.0 * Rb) + 4.0 * Rb * vec2(sin(th), -cos(th));
              } else {
                float s = side * 4.0 * Rb * sin(0.5 * ph0) * cos(w * tq);
                c = base + bowl(s, Rb);
              }
              if (j == 0) col = beadAt(p, c, 0.030, hue, col);
              else col += hue * glow(length(p - c), 5000.0) * (0.30 - 0.04 * float(j)) * (1.0 + uBeat * 0.5);
            }
          }
          // the appointment: every cycloid bead at the bottom at once
          float col0 = glow(p.x, 2000.0) * step(abs(p.y - yb), 0.40);
          col += ramp(0.85) * col0 * meet * (0.35 + uBeat * 0.4);
        } else {
          /* ===== HUYGENS' CLOCK: the cycloidal cheeks against the plain pendulum ===== */
          float th0 = uShape < 0.5 ? 0.44 : (uShape < 1.5 ? 0.80 : 1.01);
          float sp = min(1.05, uAspect * 0.58);
          float r = 0.29;
          float L = 4.0 * r;
          float w = sqrt(g / L);
          float yTop = 0.56;
          vec3 hH = ramp(0.62 + uVarA * 0.2), hS = ramp(0.12 + uVarA * 0.2), hR = ramp(0.36 + uVarA * 0.2);
          // --- Huygens, centre: pivot, cheeks, string, bob on the cycloid
          vec2 Pv = vec2(0.0, yTop);
          vec2 Bb = Pv - vec2(0.0, L);                 // the bowl's bottom
          float hgt = L * (1.0 - cos(th0));            // released from the same height as the plain one
          float phi0 = acos(clamp(1.0 - hgt / r, -1.0, 1.0));
          float s0 = 4.0 * r * sin(0.5 * phi0);
          float dch = 1e3, dpath = 1e3;
          vec2 e0 = Pv, f0 = Pv, b0 = Bb + r * vec2(-PI, 2.0);
          for (int i = 1; i <= 28; i++){
            float ph = PI * float(i) / 28.0;
            vec2 e1 = Bb + r * vec2(ph - sin(ph), 3.0 + cos(ph));      // the right cheek: the evolute
            vec2 f1 = Bb + r * vec2(-(ph - sin(ph)), 3.0 + cos(ph));   // the left cheek
            dch = min(dch, min(segd(p, e0, e1), segd(p, f0, f1)));
            e0 = e1; f0 = f1;
            float pb = -PI + 2.0 * PI * float(i) / 28.0;
            vec2 b1 = Bb + r * vec2(pb + sin(pb), 1.0 - cos(pb));
            dpath = min(dpath, segd(p, b0, b1));
            b0 = b1;
          }
          col += hH * glow(dch, 25000.0) * 0.9;
          col += rail * glow(dpath, 40000.0) * 0.5;
          float sH = s0 * cos(w * T);
          float phB = 2.0 * asin(clamp(sH / (4.0 * r), -1.0, 1.0));
          vec2 bob = Bb + r * vec2(phB + sin(phB), 1.0 - cos(phB));
          // the string: wrapped on the cheek down to the tangent point, then straight to the bob
          vec2 tp = Bb + r * vec2(phB - sin(phB), 3.0 + cos(phB));
          float dstr = segd(p, tp, bob);
          float sg = phB < 0.0 ? -1.0 : 1.0;
          float aph = abs(phB);
          vec2 w0 = Pv;
          for (int i = 1; i <= 12; i++){
            float ph = aph * float(i) / 12.0;
            vec2 w1 = Bb + r * vec2(sg * (ph - sin(ph)), 3.0 + cos(ph));
            dstr = min(dstr, segd(p, w0, w1));
            w0 = w1;
          }
          col += vec3(0.85) * glow(dstr, 90000.0) * 0.8;
          col = beadAt(p, bob, 0.05, hH, col);
          // --- the plain pendulum swung as wide, left; swung small, right
          // the plain pendulums: the same length and the same angles, drawn at 0.62 so all three fit
          float Lv = 0.62 * L;
          vec2 Pl = vec2(-sp - 0.12, yTop), Pr = vec2(sp + 0.12, yTop);
          float thL = pend(th0, w, T);
          float thR = pend(0.10, w, T);
          vec2 bl = Pl + Lv * vec2(sin(thL), -cos(thL)), br = Pr + Lv * vec2(sin(thR), -cos(thR));
          col += vec3(0.8) * (glow(segd(p, Pl, bl), 90000.0) + glow(segd(p, Pr, br), 90000.0)) * 0.7;
          float darc = min(abs(length(p - Pl) - Lv), abs(length(p - Pr) - Lv));
          col += rail * glow(darc, 40000.0) * 0.25 * step(p.y, yTop - 0.4);
          col = beadAt(p, bl, 0.036, hS, col);
          col = beadAt(p, br, 0.036, hR, col);
          // the pivots, and a lamp over each that ticks when its bob crosses the bottom
          for (int k = 0; k < 3; k++){
            vec2 P = k == 0 ? Pl : (k == 1 ? Pv : Pr);
            float cr = k == 0 ? abs(thL) / max(th0, 1e-3) : (k == 1 ? abs(phB) / max(phi0, 1e-3) : abs(thR) / 0.10);
            float tick = exp(-cr * cr * 60.0);
            vec3 hc = k == 0 ? hS : (k == 1 ? hH : hR);
            col += vec3(0.7) * glow(length(p - P), 9000.0);
            col += hc * (glow(length(p - P - vec2(0.0, 0.14)), 2500.0) * (0.25 + tick * (1.2 + uBeat * 0.6)) + glow(length(p - P - vec2(0.0, 0.14)), 200.0) * tick * 0.12);
          }
          // a beam: the support all three hang from
          col += ramp(0.5) * glow(p.y - yTop - 0.02, 40000.0) * step(abs(p.x), sp + 0.25) * 0.35;
        }
        // a hand is a finger that steadies the field: a soft ring where it rests
        if (uHand.z > 0.05) col += ramp(0.85) * glow(length(p - uHand.xy) - 0.06, 4000.0) * uHand.z * 0.4;
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
