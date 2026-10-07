#include <metal_stdlib>
using namespace metal;

/* ================================================================
   SEISMIC — how we know the inside of the Earth.

   THE EARTH: three layers — mantle, liquid outer core, solid inner core —
   each with η = r/v = c rⁿ, the profile for which the ray equation
   integrates in closed form: θ = acos(p/η)/n, t = √(η² − p²)/n. The ray
   parameter p = η sin i is kept across each boundary; S cannot enter the
   liquid (it reflects, ScS). Every pixel solves 32 rays at its own radius,
   descending and rising, and interpolates their travel times into the
   expanding wavefronts; the mantle's n is fitted so the direct rays reach
   ~98°, and the P and S shadow zones emerge on their own. THE WAVES:
   deformed lattices, each pixel solved back to its rest position by a
   fixed-point step — P, S, Rayleigh (retrograde, e^{−kz}), Love (in
   perspective). THE RECORD: a helicorder, S−P triangulation, and a
   Gutenberg–Richter / Omori swarm.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildSeismic() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_se: a self-contained translation unit.
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

namespace rm_se {

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

/* three layers (mantle, liquid outer core, inner core), each with r / v = c r^n, for which Snell's law
   integrates in closed form: theta = acos(p / eta) / n, t = sqrt(eta^2 - p^2) / n. Returns (r_top, r_bottom, n, c). */
vec4 layerOf(int k, float isS){
  if (k == 0) return vec4(1.0, 0.546, 1.43, isS > 0.5 ? 1.0 / 4.4 : 1.0 / 8.0);
  if (k == 1) return vec4(0.546, 0.192, 1.244, 0.1448);
  return vec4(0.192, 0.0, 1.0, isS > 0.5 ? 1.0 / 3.6 : 1.0 / 11.1);
}
/* a ray of parameter p, seen at radius r: (angle there going down, angle at the turn, time there, time at the turn);
   the angle there is -1 if the ray never reaches r. S cannot enter the liquid: it reflects (ScS). */
vec4 rayAt(float p, float r, float isS){
  float th = 0.0, tt = 0.0;
  float thP = -1.0, tP = 0.0, thH = 0.0, tH = 0.0;
  bool done = false;
  for (int k = 0; k < 3; k++){
    if (done) break;
    vec4 L = layerOf(k, isS);
    float eo = L.w * ppow(L.x, L.z);
    if ((isS > 0.5 && k == 1) || p >= eo){ thH = th; tH = tt; done = true; break; }
    float ei = k == 2 ? 0.0 : L.w * ppow(L.y, L.z);
    float eb = max(ei, p);
    float ao = acos(clamp(p / eo, 0.0, 1.0)), so = sqrt(max(eo * eo - p * p, 0.0));
    if (r <= L.x && r >= L.y){
      float er = L.w * ppow(max(r, 1e-4), L.z);
      if (er >= p){
        thP = th + (ao - acos(clamp(p / er, 0.0, 1.0))) / L.z;
        tP = tt + (so - sqrt(max(er * er - p * p, 0.0))) / L.z;
      }
    }
    th += (ao - acos(clamp(p / max(eb, 1e-6), 0.0, 1.0))) / L.z;
    tt += (so - sqrt(max(eb * eb - p * p, 0.0))) / L.z;
    if (ei <= p){ thH = th; tH = tt; done = true; }
  }
  return vec4(thP, thH, tP, tH);
}
/* the drum's signal: microseisms, and a quake every forty seconds (P, then S, then the long surface waves) */
float drumSig(float t){
  float s = (vnoise(vec2(t * 3.0, 1.0)) - 0.5) * 0.35 + (vnoise(vec2(t * 0.7, 5.0)) - 0.5) * 0.3;
  float ev = floor(t / 47.0);
  float big = 0.5 + hash21(vec2(ev, 2.0));
  float tq = mod(t, 47.0) - 8.0 - 20.0 * hash21(vec2(ev, 5.0));
  float P = tq > 0.0 ? exp(-tq * 1.2) * sin(tq * 40.0) * 0.8 : 0.0;
  float ts = tq - 3.2;
  float S = ts > 0.0 ? exp(-ts * 0.8) * sin(ts * 26.0) * 1.6 : 0.0;
  float tr = tq - 6.0;
  float R = tr > 0.0 ? tr * exp(-tr * 0.35) * sin(tr * 7.0) * 0.9 : 0.0;
  return s + (P + S + R) * big;
}

}  // namespace rm_se

fragment float4 room_seismic(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_se;
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
        vec3 cP = ramp(0.15 + uVarA * 0.2), cS = ramp(0.75 + uVarA * 0.2), cM = ramp(0.45 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE EARTH: a source at the top, rays down through the shells
          float Re = 0.92;
          vec2 q = p / Re;
          float r = length(q);
          float th = atan2s(abs(q.x), q.y);                     // angular distance from the source
          float isS = uShape < 0.5 ? 0.0 : (uShape < 1.5 ? 1.0 : step(0.0, p.x));
          vec3 rc = isS > 0.5 ? cS : cP;
          if (r < 1.0){
            // the shells: the core tinted, the boundaries drawn
            col += cM * 0.025 + cM * 0.04 * step(r, 0.546) + cM * 0.04 * step(r, 0.192);
            col += cM * (glow((r - 0.546) * Re, 60000.0) + glow((r - 0.192) * Re, 60000.0) + 0.3 * glow((r - 0.896) * Re, 60000.0)) * 0.25;
            float c1 = layerOf(0, isS).w;
            float tau = mod(T, 13.0) * 0.03;                        // the pulse: ~twenty minutes of travel in ten seconds
            // the rays, and the wavefront: travel time interpolated between neighbouring rays on each branch
            float okP = 0.0, pa1 = 0.0, pa2 = 0.0, pt1 = 0.0, pt2 = 0.0;
            float front = 0.0;
            for (int j = 0; j < 32; j++){
              float si = 0.02 + 0.97 * ppow((float(j) + 0.5) / 32.0, 1.4);
              float pr = si * c1;
              vec4 ra = rayAt(pr, r, isS);
              if (ra.x < 0.0){ okP = 0.0; continue; }
              float th1 = ra.x, th2 = 2.0 * ra.y - ra.x;
              float t1 = ra.z, t2 = 2.0 * ra.w - ra.z;
              float d1 = abs(th - th1) * r * Re, d2 = abs(th - th2) * r * Re;
              col += rc * (glow(d1, 120000.0) + glow(d2, 120000.0)) * (0.03 + 0.04 * uEnergy);
              if (okP > 0.5){
                if ((th - pa1) * (th - th1) <= 0.0 && abs(th1 - pa1) < 0.5){
                  float tI = mix(pt1, t1, (th - pa1) / (th1 - pa1 + 1e-6));
                  front = max(front, glow((tI - tau) * 10.0 * Re, 12000.0));
                }
                if ((th - pa2) * (th - th2) <= 0.0 && abs(th2 - pa2) < 0.5){
                  float tI = mix(pt2, t2, (th - pa2) / (th2 - pa2 + 1e-6));
                  front = max(front, glow((tI - tau) * 10.0 * Re, 12000.0));
                }
              }
              okP = 1.0; pa1 = th1; pa2 = th2; pt1 = t1; pt2 = t2;
            }
            col += mix(rc, vec3(1.0), 0.35) * front * (0.9 + 0.6 * uBeat);
          }
          // the surface: arrivals bright, shadows dark
          float rim = glow((r - 1.0) * Re, 20000.0);
          float arr = 0.0;
          float c1b = layerOf(0, isS).w;
          if (abs(r - 1.0) < 0.08){
            for (int j = 0; j < 32; j++){
              float si = 0.02 + 0.97 * ppow((float(j) + 0.5) / 32.0, 1.4);
              vec4 ra = rayAt(si * c1b, 1.0, isS);
              arr += glow((th - 2.0 * ra.y) * Re, 900.0);
            }
          }
          col += cM * rim * 0.25 + rc * rim * min(arr, 1.5) * 0.9;
          // the source
          col += vec3(1.0) * glow(length(q - vec2(0.0, 1.0)) * Re, 8000.0) * (0.8 + uBeat);
        } else if (uMode < 1.5){
          // THE WAVES: deformed lattices, each pixel solved back to its rest position
          float k = 2.0 * PI / 1.1;
          float w = 2.0 * PI * 0.45;
          float A = 0.065 + 0.04 * uEnergy + 0.02 * uBass;
          vec2 X = p;
          vec3 lc = cM;
          float sp = 0.075;
          float yS = 0.0;
          float wave = 0.0;
          float scl = 1.0;
          if (uShape < 0.5){
            // P above, S below
            bool top = p.y > 0.0;
            lc = top ? cP : cS;
            for (int i = 0; i < 3; i++){
              float ph = k * X.x - w * T;
              vec2 u = top ? vec2(A * sin(ph), 0.0) : vec2(0.0, A * sin(ph));
              X = p - u;
            }
            yS = abs(p.y) - 0.02;
            wave = step(0.03, abs(p.y));
          } else if (uShape < 1.5){
            // Rayleigh: retrograde ellipses shrinking with depth below a free surface
            float sy = 0.45;
            for (int i = 0; i < 3; i++){
              float z = max(sy - X.y, 0.0);
              float ph = k * X.x - w * T;
              float dec = exp(-k * z * 0.55);
              vec2 u = A * 1.3 * dec * vec2(-sin(ph) * 0.7, cos(ph));
              X = p - u;
            }
            wave = step(X.y, sy);
            lc = mix(cP, cS, 0.5);
            // the orbits the particles trace, faint
            vec2 cell = (floor(X / sp + 0.5)) * sp;
            float z0 = max(sy - cell.y, 0.0);
            float dec0 = exp(-k * z0 * 0.55);
            vec2 dd = (p - cell) / max(A * 1.3 * dec0, 1e-3);
            float orb = abs(length(dd * vec2(1.0 / 0.7, 1.0)) - 1.0) * A * 1.3 * dec0;
            col += lc * glow(orb, 300000.0) * 0.15 * wave;
          } else {
            // Love: the ground seen in perspective, sheared side to side
            float hz = 0.62;
            float dz = hz - p.y;
            wave = smoothstep(0.1, 0.5, dz);
            vec2 g = vec2(p.x / max(dz, 0.05), 1.0 / max(dz, 0.05)) * 0.5;
            X = g;
            for (int i = 0; i < 3; i++){
              float ph = k * X.x * 0.8 - w * T;
              X = g - vec2(0.0, A * 3.0 * sin(ph));
            }
            lc = cS;
            sp = 0.12;
            scl = 2.0 * max(dz, 0.05);
          }
          // the lattice: lines through rest positions on a grid, and the nodes
          vec2 f = abs(fract(X / sp + 0.5) - 0.5) * sp;
          float ln = min(f.x, f.y) * scl;
          float nd = length(f) * scl;
          col += lc * glow(ln, 150000.0) * 0.3 * wave;
          col += mix(lc, vec3(1.0), 0.3) * glow(nd, 30000.0) * 0.9 * wave;
          if (uShape < 0.5) col += cM * glow(p.y, 80000.0) * 0.3;
          if (uShape > 0.5 && uShape < 1.5) col += cM * glow(p.y - 0.45 - A * 1.3 * cos(k * p.x - w * T), 40000.0) * 0.4;
        } else {
          if (uShape < 0.5){
            // THE DRUM: a helicorder page, one row a minute, the pen on the last row
            float rows = 13.0;
            float rh = 1.8 / rows;
            float j = floor((0.9 - p.y) / rh);
            float yy = (0.9 - p.y) - (j + 0.5) * rh;
            float W = 20.0;
            float xf = (p.x / (uAspect * 0.92) + 1.0) * 0.5;
            float pen = fract(T / W);
            float row0 = floor(T / W);
            float t = (row0 - (rows - 1.0) + j) * W + xf * W;
            float inP = step(0.0, j) * step(j, rows - 1.0) * step(0.0, xf) * step(xf, 1.0) * step(t, T);
            float live = exp(-(T - t) * 2.0);
            float sg = drumSig(t) + live * (uBass - 0.3) * 1.2;
            float sg2 = drumSig(t + 0.02) + live * (uBass - 0.3) * 1.2;
            float am = rh * 0.22;
            float slope = (sg2 - sg) / 0.02 * am / (uAspect * 1.84 / W);
            float dl = abs(-yy - sg * am) / min(sqrt(1.0 + slope * slope), 8.0);
            vec3 ic = mix(cP, cS, fract(j * 0.37));
            col += ic * glow(dl, 160000.0) * 0.85 * inP;
            // the pen
            vec2 pp = vec2((pen * 2.0 - 1.0) * uAspect * 0.92, 0.9 - (rows - 0.5) * rh - drumSig(T) * am);
            col += vec3(1.0) * glow(length(p - pp), 9000.0) * (0.8 + uBeat);
          } else if (uShape < 1.5){
            // TRIANGULATION: three stations, three S-minus-P circles, one epicentre
            float cyc = floor(T / 9.0);
            float ph = fract(T / 9.0);
            vec2 E = vec2((hash21(vec2(cyc, 1.0)) - 0.5) * uAspect * 1.1, (hash21(vec2(cyc, 2.0)) - 0.5) * 1.1);
            col += cM * 0.02;
            vec2 gq = p * 4.0;
            vec2 gd = abs(fract(gq) - 0.5);
            col += cM * glow(min(gd.x, gd.y) / 4.0, 400000.0) * 0.07;
            for (int s = 0; s < 3; s++){
              float a = float(s) * 2.0944 + 0.5;
              vec2 St = vec2(cos(a) * uAspect * 0.62, sin(a) * 0.72);
              float D = length(E - St);
              float grow = smoothstep(0.05, 0.6, ph) * D;
              vec3 sc = ramp(float(s) * 0.3 + uVarA * 0.2);
              col += sc * glow(abs(length(p - St) - grow), 60000.0) * 0.6;
              // the station
              vec2 dS = abs(p - St);
              col += sc * step(max(dS.x, dS.y * 1.4), 0.025) * 0.8;
            }
            float hit = smoothstep(0.58, 0.62, ph) * (1.0 - smoothstep(0.85, 1.0, ph));
            col += vec3(1.0) * glow(length(p - E), 2500.0) * hit * (1.0 + uBeat);
            col += cS * glow(abs(length(p - E) - (ph - 0.6) * 1.5), 8000.0) * hit * 0.5;
          } else {
            // THE SWARM: a main shock, Omori's aftershocks, Gutenberg-Richter's magnitudes, along a fault
            float P = 30.0;
            float cyc = floor(T / P);
            float tm = mod(T, P);
            float fx = p.x / (uAspect * 0.9);
            float fy = 0.25 * sin(fx * 2.2 + cyc) + 0.1 * sin(fx * 5.0);
            col += cM * glow(p.y - fy, 3000.0) * 0.12;
            for (int i = 0; i < 48; i++){
              float fi = float(i);
              float u = hash21(vec2(fi, cyc + 3.0));
              float ti = i == 0 ? 0.0 : 0.05 * (exp(u * 6.3) - 1.0);       // Omori: dN/dt ~ 1/(c + t)
              float age = tm - ti;
              if (age < 0.0) continue;
              float m = i == 0 ? 6.5 : min(1.0 - log(max(hash21(vec2(fi, cyc + 7.0)), 1e-3)) / (2.3 * 1.0), 5.8);   // b = 1
              float xe = (hash21(vec2(fi, cyc + 11.0)) - 0.5) * (i == 0 ? 0.0 : 1.4);
              vec2 ep = vec2(xe * uAspect * 0.9, 0.25 * sin(xe * 2.2 + cyc) + 0.1 * sin(xe * 5.0) + (hash21(vec2(fi, 4.0)) - 0.5) * 0.08);
              float sz = 0.012 * exp(0.5 * 2.3026 * (m - 1.0) * 0.55);
              float rr = length(p - ep);
              float fade = exp(-age * 0.35);
              vec3 ec = ramp(m / 7.0 + uVarA * 0.2);
              col += ec * glow(rr - sz, 4000.0 / (sz * 10.0)) * fade * 0.7;
              col += ec * glow(abs(rr - sz - age * 0.12), 9000.0) * exp(-age * 1.2) * 0.6;
            }
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
