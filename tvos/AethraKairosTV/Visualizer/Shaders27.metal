#include <metal_stdlib>
using namespace metal;

/* ================================================================
   WAKE — the three cones: a source outrunning its own waves.

   Every point a moving source passes sends out a circle; when the source is
   faster than its waves the circles pile into a cone. THE BOOM is sound: the
   Mach number swept from a hum through the barrier to a shout (the wavefronts
   are emitted along the true integrated path, so the bunching, the wall at
   M = 1 and the cone sin θ = 1/M all emerge on their own), level, orbiting or
   diving. THE KELVIN WAKE is deep water: the crests are the stationary phase
   of k = g/(U² cos²θ), solved in closed form — 2y t² + x t + y = 0 — whose
   roots are real only inside |y/x| ≤ 1/√8: 19.47° at every speed. THE GLOW is
   Cherenkov light: a particle faster than c/n in water, its front at
   cos θ = 1/(nβ) closing as it slows, dark at threshold, the wall lit where
   the light lands.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildWake() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_wk: a self-contained translation unit.
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

namespace rm_wk {

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

/* the light of one charged track, t seconds into the event: x the Cherenkov front,
   y its rays, z the track and the particle. The particle slows linearly with path
   (beta = b0 - kk s), so s(t) = (b0/kk)(1 - exp(-kk c t)) and the time it stood at s
   is -ln(1 - kk s/b0)/(kk c): every emission is placed where and when it truly left. */
vec3 cherenkov(vec2 p, float t, vec2 P0, vec2 dir, float t0, float b0, float kk, float L, float fuzz, float seed){
  float c = 0.9, n = 1.33, cL = 0.9 / 1.33;
  float te = t - t0;
  if (te <= 0.0) return vec3(0.0);
  float sNow = min((b0 / kk) * (1.0 - exp(-kk * c * te)), L);
  float sTh = clamp((b0 - 1.0 / n) / kk, 0.0, sNow);
  vec2 nrm = vec2(-dir.y, dir.x);
  float front = 0.0, rays = 0.0;
  vec2 Fp0 = P0, Fm0 = P0;
  for (int i = 0; i <= 24; i++){
    float s = sTh * float(i) / 24.0;
    float b = b0 - kk * s;
    float ts = -log(max(1.0 - kk * s / b0, 1e-6)) / (kk * c);
    float th = acos(clamp(1.0 / (n * b), -1.0, 1.0)) + fuzz * (hash21(vec2(float(i) * 1.7, seed)) - 0.5);
    float ct = cos(th);
    float R = cL * max(te - ts, 0.0);
    vec2 E = P0 + dir * s;
    vec2 Fp = E + R * (ct * dir + sin(th) * nrm);
    vec2 Fm = E + R * (ct * dir - sin(th) * nrm);
    float wgt = max(1.0 - 1.0 / sq(n * b), 0.0) / 0.4348;  // Frank–Tamm: the light goes as sin²θ (1 at beta = 1)
    if (i > 0){
      float a1 = segd(p, Fp0, Fp), a2 = segd(p, Fm0, Fm);
      front += wgt * (glow(a1, 22000.0) + glow(a2, 22000.0) + 0.18 * (glow(a1, 700.0) + glow(a2, 700.0)));
    }
    rays += wgt * (glow(segd(p, E, Fp), 60000.0) + glow(segd(p, E, Fm), 60000.0));
    Fp0 = Fp; Fm0 = Fm;
  }
  vec2 Pn = P0 + dir * sNow;
  float trk = glow(segd(p, P0, Pn), 90000.0);
  float head = (sNow < L - 1e-3) ? glow(length(p - Pn), 2500.0) : 0.0;
  return vec3(front, rays, trk + head * 2.5);
}
/* where the same track's light lands on the wall x = Xw, near height yj, and how freshly */
float pmt(float yj, float Xw, float t, vec2 P0, vec2 dir, float t0, float b0, float kk, float L){
  float c = 0.9, n = 1.33, cL = 0.9 / 1.33;
  float te = t - t0;
  if (te <= 0.0) return 0.0;
  float sNow = min((b0 / kk) * (1.0 - exp(-kk * c * te)), L);
  float sTh = clamp((b0 - 1.0 / n) / kk, 0.0, sNow);
  vec2 nrm = vec2(-dir.y, dir.x);
  float hit = 0.0;
  for (int i = 0; i <= 16; i++){
    float s = sTh * float(i) / 16.0;
    float b = b0 - kk * s;
    float ts = -log(max(1.0 - kk * s / b0, 1e-6)) / (kk * c);
    float th = acos(clamp(1.0 / (n * b), -1.0, 1.0));
    float wgt = max(1.0 - 1.0 / sq(n * b), 0.0) / 0.4348;
    vec2 E = P0 + dir * s;
    for (int k = 0; k < 2; k++){
      vec2 u = cos(th) * dir + (k == 0 ? 1.0 : -1.0) * sin(th) * nrm;
      if (u.x > 1e-3){
        float lam = (Xw - E.x) / u.x;
        float yh = E.y + lam * u.y;
        float ta = ts + lam / cL;
        if (ta <= te) hit += wgt * glow(yh - yj, 900.0) * exp(-(te - ta) * 1.1);
      }
    }
  }
  return hit;
}
/* the Kelvin wake of one hull at s heading h, kappa = g/U²: two stationary phases */
vec2 kelvin(vec2 p, vec2 s, vec2 h, float kappa, float reach){
  vec2 q = p - s;
  float xi = -dot(q, h);
  float y = dot(q, vec2(-h.y, h.x));
  if (xi <= 0.0 || xi > reach) return vec2(0.0);
  float D = xi * xi - 8.0 * y * y;
  if (D <= 0.0) return vec2(0.0);
  float ys = abs(y) < 1e-5 ? (y < 0.0 ? -1e-5 : 1e-5) : y;
  float rD = sqrt(D);
  float cusp = clamp(ppow(xi * xi / max(D, 1e-7), 0.25), 1.0, 3.5);
  float fade = inversesqrt(0.35 + 2.0 * xi) * smoothstep(reach, reach * 0.7, xi) * smoothstep(0.0, 0.05, xi);
  vec2 o = vec2(0.0);
  for (int k = 0; k < 2; k++){
    float t = (-xi + (k == 0 ? rD : -rD)) / (4.0 * ys);
    float psi = kappa * (xi + y * t) * sqrt(1.0 + t * t) - 0.25 * PI;
    float grad = kappa * (1.0 + t * t);
    float wr = abs(mod(psi + PI, 2.0 * PI) - PI);
    float d = wr / grad;
    float spacing = 2.0 * PI / grad;
    float a = cusp * fade * smoothstep(0.006, 0.025, spacing);
    if (k == 0) o.x += glow(d, 16000.0) * a; else o.y += glow(d, 16000.0) * a;
  }
  return o;
}

}  // namespace rm_wk

fragment float4 room_wake(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_wk;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.95 + 3;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 cA = ramp(0.08 + uVarA * 0.15), cB = ramp(0.42 + uVarA * 0.15), cC = ramp(0.75 + uVarA * 0.15);
        if (uMode < 0.5){
          /* ===== THE BOOM: circles from the true path, the cone as their caustic ===== */
          float c = 0.36;
          float amp = 0.55 + uBass * 0.55;
          float om = 2.0 * PI / 40.0;
          float gy = -0.74;
          vec2 S = vec2(0.0);
          float Sx = 0.30 * uAspect;
          // the source now
          if (uShape < 0.5) S = vec2(Sx, 0.18);
          else if (uShape < 1.5){ float th = (c / 0.42) * (1.5 * T - (0.95 / om) * sin(om * T)); S = 0.42 * vec2(cos(th), sin(th)); }
          else S = vec2(Sx, 0.10);
          float tc = mod(T, 12.0);
          float ear = 0.0;
          bool nearGround = abs(p.y - gy) < 0.07 && uShape != 1.0;
          float ox = floor(p.x / 0.36 + 0.5) * 0.36;
          vec2 O = vec2(ox, gy);
          bool listen = uHand.z > 0.05;
          float handHear = 0.0;
          for (int k = 0; k < 44; k++){
            float tau = (float(k) + fract(T * 8.0)) / 8.0;
            vec2 E;
            float w = amp * smoothstep(5.5, 4.2, tau);
            if (uShape < 0.5){
              float dx = c * (1.5 * tau - (0.95 / om) * (sin(om * T) - sin(om * (T - tau))));
              E = vec2(Sx - dx, 0.18);
            } else if (uShape < 1.5){
              float th = (c / 0.42) * (1.5 * (T - tau) - (0.95 / om) * sin(om * (T - tau)));
              E = 0.42 * vec2(cos(th), sin(th));
            } else {
              float te = tc - tau;
              w *= step(0.0, te);
              float dx = c * (0.3 * tau + 0.12 * (tc * tc - te * te));
              E = vec2(Sx - dx, 0.10);
            }
            float r = 0.36 * tau;
            float d = abs(length(p - E) - r);
            float spread = inversesqrt(1.0 + 5.0 * r);
            col += mix(cB, cA, tau / 5.5) * glow(d, 26000.0) * w * spread * 0.6;
            col += cB * glow(d, 2500.0) * w * spread * 0.04;
            if (nearGround) ear += glow(abs(length(O - E) - r), 900.0) * w * spread;
            if (listen) handHear += glow(abs(length(uHand.xy - E) - r), 900.0) * w * spread;
          }
          // the source
          float d0 = length(p - S);
          col += cC * (glow(d0, 5000.0) * 1.4 + glow(d0, 120.0) * 0.12);
          // the ground and its listeners: a ping for each front, the boom when the cone sweeps them
          if (uShape != 1.0){
            col += ramp(0.55) * glow(p.y - gy, 30000.0) * 0.10;
            if (nearGround){
              float dl = length(p - O);
              col += cC * glow(dl, 9000.0) * (0.35 + 0.8 * min(ear, 3.0) + uBeat * 0.3);
              col += cC * glow(dl, 500.0) * min(ear, 3.0) * 0.14;
            }
          }
          if (listen){
            float dh = abs(length(p - uHand.xy) - 0.05);
            col += cC * glow(dh, 6000.0) * uHand.z * (0.3 + 0.4 * min(handHear, 3.0));
          }
        } else if (uMode < 1.5){
          /* ===== THE KELVIN WAKE: the stationary phase, in closed form ===== */
          float g = 0.822;                                  // V = 0.12 draws lambda = 2 pi V²/g = 0.11
          vec2 tr = vec2(0.0), dv = vec2(0.0);
          float hulls = 0.0;
          for (int i = 0; i < 5; i++){
            float fi = float(i);
            vec2 h; float V; vec2 s; float reach;
            if (uShape < 0.5){
              if (i > 0) continue;
              h = normalize(vec2(1.0, 0.16)); V = 0.12;
            } else if (uShape < 1.5){
              if (i > 1) continue;
              h = i == 0 ? normalize(vec2(1.0, 0.18)) : normalize(vec2(-1.0, 0.10));
              V = i == 0 ? 0.12 : 0.18;
            } else {
              h = normalize(vec2(1.0, 0.08)); V = 0.07;
            }
            float Lp = 2.0 * uAspect + 1.6;
            float trav = mod(V * T + 0.45 * Lp + fi * 0.37 * Lp * step(0.5, uShape) * step(uShape, 1.5), Lp);
            s = -h * (0.5 * Lp) + h * trav + vec2(-h.y, h.x) * (uShape < 0.5 ? -0.05 : (uShape < 1.5 ? (i == 0 ? -0.25 : 0.30) : 0.0));
            if (uShape > 1.5 && i > 0){
              // the ducklings: a V behind the mother
              float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
              float rank = floor((fi + 1.0) * 0.5);
              s += -h * 0.09 * rank + vec2(-h.y, h.x) * side * 0.055 * rank;
            }
            reach = min(trav, uShape > 1.5 ? 1.5 : 2.6);
            float kappa = g / (V * V);
            vec2 w = kelvin(p, s, h, kappa, reach) * (uShape > 1.5 ? (i == 0 ? 0.55 : 0.30) : 1.0);
            tr += w.x; dv += w.y;
            // the hull, and the 19.47° the sea always draws behind it
            vec2 q = p - s;
            float xa = dot(q, h), ya = dot(q, vec2(-h.y, h.x));
            float hullL = V * 0.45;
            float hull = length(vec2(xa / max(hullL, 0.008), ya / max(hullL * 0.28, 0.004)));
            hulls += smoothstep(1.2, 0.8, hull) + glow(hull - 1.0, 6.0) * 0.15;
            float xi = -xa;
            if (xi > 0.0 && xi < reach && uShape < 1.5){
              float dl = abs(abs(ya) - 0.353553 * xi) * 0.942809;
              col += cA * glow(dl, 40000.0) * 0.10 * step(0.5, fract(xi * 9.0));
            }
          }
          col += cB * min(tr.x, 2.0) * (0.55 + uBass * 0.4);
          col += cA * min(dv.x, 2.0) * (0.55 + uBass * 0.4);
          col += cC * hulls * (0.9 + uBeat * 0.4);
          col += ramp(0.6) * 0.012 * (0.5 + 0.5 * sin(p.y * 60.0 + T * 0.7));
        } else {
          /* ===== THE GLOW: Cherenkov light in water ===== */
          float W = uAspect - 0.12, Hh = 0.80;
          float edge = abs(max(abs(p.x) - W, abs(p.y) - Hh));
          col += cA * glow(edge, 40000.0) * 0.10;
          float inside = step(abs(p.x), W) * step(abs(p.y), Hh);
          float te = mod(T, 9.0) - 0.4;
          vec3 L = vec3(0.0);
          float wall = 0.0;
          float yj = clamp(floor(p.y / 0.07 + 0.5) * 0.07, -Hh + 0.04, Hh - 0.04);
          bool nearWall = abs(p.x - W) < 0.045;
          float jit = (uVarA - 0.5) * 0.3;
          if (uShape < 0.5){
            vec2 P0 = vec2(-W, 0.22 + jit); vec2 d = normalize(vec2(1.0, -0.10));
            float Lt = 1.9 * W, kk = (0.995 - 0.70) / Lt;
            L += cherenkov(p, te, P0, d, 0.0, 0.995, kk, Lt, 0.0, 1.0);
            if (nearWall) wall += pmt(yj, W, te, P0, d, 0.0, 0.995, kk, Lt);
          } else if (uShape < 1.5){
            // an electron showers: the primary, then an invisible photon converting to a pair
            vec2 P0 = vec2(-W, 0.10 + jit); vec2 d0 = normalize(vec2(1.0, 0.05));
            L += cherenkov(p, te, P0, d0, 0.0, 0.99, 0.40, 0.65, 0.10, 2.0);
            vec2 P1 = P0 + d0 * 1.05;
            float t1 = 1.05 / 0.9;
            vec2 da = normalize(vec2(1.0, 0.20)), db = normalize(vec2(1.0, -0.16));
            L += cherenkov(p, te, P1, da, t1, 0.985, 0.42, 0.70, 0.12, 3.0);
            L += cherenkov(p, te, P1, db, t1, 0.98, 0.46, 0.60, 0.12, 4.0);
            if (nearWall){
              wall += pmt(yj, W, te, P0, d0, 0.0, 0.99, 0.40, 0.65);
              wall += pmt(yj, W, te, P1, da, t1, 0.985, 0.42, 0.70);
              wall += pmt(yj, W, te, P1, db, t1, 0.98, 0.46, 0.60);
            }
            float gam = glow(segd(p, P0 + d0 * 0.3, P1), 90000.0) * step(0.5, fract(length(p - P0) * 14.0));
            col += cC * gam * 0.12 * step(0.3 / 0.9, te);
          } else {
            // a neutrino arrives unseen; at the vertex a muon and an electron leave
            vec2 V = vec2(-0.25 * W, -0.12 + jit);
            float tv = (V.x + W) / 0.9;
            float dn = segd(p, vec2(-W, V.y - 0.25), V);
            col += cC * glow(dn, 120000.0) * 0.18 * step(0.5, fract(p.x * 18.0)) * step(p.x, V.x) * step(-W, p.x);
            vec2 dm = normalize(vec2(1.0, 0.28)), de = normalize(vec2(1.0, -0.55));
            float Lm = 1.6 * W, km = (0.99 - 0.72) / Lm;
            L += cherenkov(p, te, V, dm, tv, 0.99, km, Lm, 0.0, 5.0);
            L += cherenkov(p, te, V, de, tv, 0.97, 0.55, 0.45, 0.22, 6.0);
            if (nearWall){
              wall += pmt(yj, W, te, V, dm, tv, 0.99, km, Lm);
              wall += pmt(yj, W, te, V, de, tv, 0.97, 0.55, 0.45);
            }
            col += cC * glow(length(p - V), 3000.0) * smoothstep(tv, tv + 0.1, te) * exp(-max(te - tv, 0.0) * 2.0) * 3.0;
          }
          col += (cB * 0.85 + vec3(0.15)) * min(L.x, 3.0) * inside * (0.65 + uBass * 0.5);
          col += cB * min(L.y, 4.0) * inside * 0.16;
          col += cC * min(L.z, 3.0) * 0.9;
          // the wall of photomultipliers: dim eyes, opening where the light lands
          if (nearWall){
            float dp = length(p - vec2(W, yj));
            float lit = min(wall, 2.0);
            col += cA * glow(dp, 9000.0) * 0.22;
            col += (cB + vec3(0.15)) * (glow(dp, 3500.0) * 1.4 + glow(dp, 300.0) * 0.15) * lit * (0.8 + uBeat * 0.6);
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
