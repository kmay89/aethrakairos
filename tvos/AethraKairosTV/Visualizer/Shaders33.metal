#include <metal_stdlib>
using namespace metal;

/* ================================================================
   CORIOLIS — the turning frame.

   THE CAROUSEL: a puck launched from the rim of a table turning at Ω, its
   inertial velocity the aimed one plus Ω×r of the thrower, so its inertial
   path is straight; drawn in the table's frame it is that path rotated by
   −Ω(t_launch + s), the hook of the Coriolis and centrifugal forces. Three
   throws are kept, polylines exact to the closed form. THE PENDULUM: the
   swing plane turns at Ω sin φ; each past half-swing is a diameter at angle
   −Ω sin φ · t_k, found for a pixel in closed form from its own angle
   (age = mod(θ − α, π) / Ω sin φ), with the museum's ring of pegs falling as
   the plane passes. THE STORM: a Rankine vortex winding two-phase flow noise
   into spiral bands round its eye; inertial oscillations
   x = x0 + Ut + (U/f)(sin ft, cos ft − 1), clockwise in the north; and the
   three-cell zonal winds u ∝ −sin 6|φ|, v ∝ −sign φ sin 6|φ| on a globe.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildCoriolis() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_cr: a self-contained translation unit.
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

namespace rm_cr {

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

/* the puck's flight time until it leaves a disk of radius R */
float leaveTime(vec2 P0, vec2 V, float R){
  float a = max(dot(V, V), 1e-6), b = 2.0 * dot(P0, V), c = dot(P0, P0) - R * R;
  float d = max(b * b - 4.0 * a * c, 0.0);
  return max((-b + sqrt(d)) / (2.0 * a), 0.0);
}
/* the puck at flight time u, in the inertial frame (fr = 0) or the table's (fr = 1) */
vec2 puckAt(vec2 P0, vec2 V, float u, float Om, float tl, float fr){
  vec2 P = P0 + V * u;
  return fr > 0.5 ? rot(P, -Om * (tl + u)) : P;
}
/* the zonal and meridional surface winds of the three cells, by latitude (radians) */
vec2 beltWind(float lat){
  float s = sin(6.0 * abs(lat));
  return vec2(-s, (lat < 0.0 ? 1.0 : -1.0) * s * 0.45);
}

}  // namespace rm_cr

fragment float4 room_coriolis(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_cr;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.75 + 3;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 cA = ramp(0.15 + uVarA * 0.2), cB = ramp(0.5 + uVarA * 0.2), cC = ramp(0.8 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE CAROUSEL
          bool both = uShape > 1.5;
          float view = uShape > 0.5 && uShape < 1.5 ? 1.0 : 0.0;
          float R = 0.8;
          vec2 q = p;
          if (both){
            R = 0.7;
            view = p.x > 0.0 ? 1.0 : 0.0;
            q = p - vec2(p.x > 0.0 ? 0.86 : -0.86, 0.0);
          }
          float Om = 0.5;
          float tab = view > 0.5 ? 0.0 : Om * T;                // the table's angle, as drawn in this view
          vec2 qt = rot(q, -tab);
          float r = length(q);
          // the table: rings and spokes, turning (or not)
          if (r < R){
            float ring = abs(fract(r / (R * 0.25) + 0.5) - 0.5) * R * 0.25;
            float at = atan2s(qt.y, qt.x);
            float spoke = abs(fract(at / (PI / 6.0) + 0.5) - 0.5) * (PI / 6.0) * r;
            col += cB * 0.03 + cB * (glow(ring, 90000.0) + glow(spoke, 90000.0)) * 0.12;
          }
          col += cB * glow(r - R, 20000.0) * 0.45;
          float Tp = 4.6;
          for (int k = 0; k < 3; k++){
            float n = floor(T / Tp) - float(k);
            float tl = n * Tp;
            float s = T - tl;
            float a0 = hash21(vec2(n, 1.7)) * 2.0 * PI;
            float vA = 0.6 + 0.22 * hash21(vec2(n, 4.1));
            float aim = (hash21(vec2(n, 9.3)) - 0.5) * 0.4;
            vec2 e0 = vec2(cos(a0 + Om * tl), sin(a0 + Om * tl));
            vec2 P0 = R * 0.96 * e0;
            vec2 V = vA * rot(-e0, aim) + Om * R * 0.96 * vec2(-e0.y, e0.x);   // aimed, plus the thrower's own motion
            float sOut = leaveTime(P0, V, R);
            float sEnd = min(s, sOut);
            float fade = k == 0 ? 1.0 : (k == 1 ? 0.4 : 0.15);
            // the path so far, exact at 24 joints
            float dmin = 1e9;
            vec2 prev = puckAt(P0, V, 0.0, Om, tl, view);
            for (int j = 1; j <= 24; j++){
              float u = sEnd * float(j) / 24.0;
              vec2 cur = puckAt(P0, V, u, Om, tl, view);
              dmin = min(dmin, segd(q, prev, cur));
              prev = cur;
            }
            vec3 pc = k == 0 ? cC : cA;
            col += pc * glow(dmin, 40000.0) * 0.8 * fade;
            if (k == 0 && s < sOut){
              vec2 pk = puckAt(P0, V, s, Om, tl, view);
              col += mix(cC, vec3(1.0), 0.5) * glow(length(q - pk), 3000.0) * (1.0 + uBeat);
            }
            if (k == 0){
              // the thrower on the rim, and (in the table's frame) the line he aimed along
              vec2 th = rot(R * 0.96 * vec2(cos(a0), sin(a0)), view > 0.5 ? 0.0 : Om * T);
              col += cA * glow(length(q - th), 6000.0) * 0.9;
              if (view > 0.5){
                vec2 ad = rot(-vec2(cos(a0), sin(a0)), aim);
                float ux = dot(q - th, ad);
                float dl = length(q - th - ad * ux);
                float dash = step(0.5, fract(ux * 14.0));
                col += cA * glow(dl, 60000.0) * dash * step(0.0, ux) * step(ux, 1.6 * R) * step(length(q), R) * 0.35;
              }
            }
          }
        } else if (uMode < 1.5){
          // THE PENDULUM: Foucault's, at three latitudes
          float sl = uShape < 0.5 ? 0.7524 : (uShape < 1.5 ? 1.0 : 0.0);
          float Op = 0.11 * sl;                                   // the plane's turn, a day in under a minute
          float w = 2.0 * PI / 3.2;
          float A = 0.7 + 0.05 * uEnergy;
          float al = -Op * T;
          float r = length(p);
          // the floor: a compass rose
          col += cB * glow(r - 0.86, 9000.0) * 0.2 + cB * 0.02 * step(r, 0.86);
          // the trace: each past half-swing is a diameter; the pixel's own angle says which
          float a = atan2s(p.y, p.x);
          float hp = PI / w;
          float age = Op > 1e-5 ? mod(a - al, PI) / Op : 0.0;
          for (int j = 0; j < 2; j++){
            float ak = (floor(age / hp) + float(j)) * hp;
            if (Op < 1e-5) ak = 0.0;
            float th = al + Op * ak;
            vec2 dr = vec2(cos(th), sin(th));
            float dl = abs(p.x * dr.y - p.y * dr.x);
            float fade = exp(-ak / 14.0) * step(r, A);
            col += mix(cA, cC, exp(-ak / 4.0)) * glow(dl, 50000.0) * fade * 0.55;
          }
          // the bob (with the faint ellipse the Coriolis force gives each swing)
          float c = cos(w * T);
          vec2 bob = A * c * vec2(cos(al), sin(al)) + A * (Op / w) * sin(w * T) * vec2(-sin(al), cos(al));
          col += mix(cC, vec3(1.0), 0.4) * glow(length(p - bob), 2500.0) * (1.0 + 0.6 * uBeat);
          col += cC * glow(length(p - bob), 200.0) * 0.12;
          // the ring of pegs, knocked down as the plane comes round
          for (int j = 0; j < 2; j++){
            float N = 40.0;
            float ap = mod(a, 2.0 * PI);
            float idx = floor(ap / (2.0 * PI / N)) + float(j);
            float b = (idx + 0.5) * 2.0 * PI / N;
            float swept = mod(Op * T, PI);
            float down = Op > 1e-5 ? step(mod(-b, PI), swept) : 0.0;
            vec2 pp = (A + 0.045 + down * 0.035) * vec2(cos(b), sin(b));
            col += mix(cC, cA * 0.4, down) * glow(length(p - pp), 25000.0) * (down > 0.5 ? 0.35 : 0.9);
          }
          // the globe, with the pendulum's latitude
          vec2 g = p - vec2(uAspect - 0.3, -0.7);
          float gr = length(g);
          float lat = asin(clamp(sl, 0.0, 1.0));
          col += cB * glow(gr - 0.16, 40000.0) * 0.5 + cB * glow(g.y, 400000.0) * step(gr, 0.16) * 0.25;
          col += cC * glow(length(g - 0.16 * vec2(cos(lat), sin(lat))), 30000.0);
          col += cA * glow(g.x, 400000.0) * step(abs(g.y), 0.2) * 0.3;
        } else {
          if (uShape < 0.5){
            // THE HURRICANE: a Rankine vortex winding its own clouds into spiral bands
            float r = max(length(p), 1e-4);
            float a = atan2s(p.y, p.x);
            float rm = 0.13;
            float om = 0.6 * (r < rm ? 1.0 : sq(rm / r));       // angular speed: solid core, free vortex outside
            float P = 12.0;
            float f1 = fract(T / P), f2 = fract(T / P + 0.5);
            vec2 q1 = r * vec2(cos(a - om * f1 * P), sin(a - om * f1 * P));
            vec2 q2 = r * vec2(cos(a - om * f2 * P), sin(a - om * f2 * P));
            float w1 = 1.0 - abs(2.0 * f1 - 1.0), w2 = 1.0 - abs(2.0 * f2 - 1.0);
            float n = (fbm4(q1 * 9.0 + 3.0) * w1 + fbm4(q2 * 9.0 + 11.0) * w2) / max(w1 + w2, 1e-3);
            // two rainbands spiralling in, counterclockwise in the north
            float band = ppow(0.5 + 0.5 * cos(2.0 * (a - 2.4 * log(r)) - T * 0.35), 1.5);
            float env = smoothstep(1.05, 0.5, r) * smoothstep(0.045, 0.1, r);
            float cloud = smoothstep(0.5, 0.68, n * 0.55 + band * 0.42 + 0.06) * env;
            float tops = smoothstep(0.55, 0.8, n) * cloud;
            float wall = glow(r - rm * 1.05, 900.0) * (0.6 + 0.4 * n);
            vec3 cc = mix(cB, vec3(0.9), 0.45);
            col += cc * (cloud * 0.42 + tops * 0.45 + wall * 0.75) * (0.8 + 0.3 * uMid);
            // lightning in the eyewall, on the beat
            float cell = floor(a / (PI / 8.0));
            float fl = step(0.8, hash21(vec2(cell, floor(T * 2.0)))) * uBeat;
            col += cC * glow(r - rm * 1.2, 2000.0) * fl * 0.8;
            col += cA * 0.03 * smoothstep(1.2, 0.3, r);
          } else if (uShape < 1.5){
            // INERTIAL CIRCLES: drifters released into a slow current, looping clockwise
            float f = 0.9;
            col += cB * 0.015;
            vec2 gq = p * 5.0;
            vec2 gd = abs(fract(gq) - 0.5);
            col += cB * glow(min(gd.x, gd.y) / 5.0, 400000.0) * 0.08;
            for (int k = 0; k < 3; k++){
              float fk = float(k);
              float P = 26.0;
              float tk = mod(T + fk * 6.5, P);
              float ep = floor((T + fk * 6.5) / P);
              vec2 x0 = vec2(-uAspect * 0.8 + 0.35 * fk, (hash21(vec2(fk, ep)) - 0.5) * 1.2);
              vec2 cur = vec2(0.075, 0.012 * (fk - 1.5));
              float Ud = 0.18 + 0.06 * hash21(vec2(ep, fk + 3.0));
              float dmin = 1e9;
              vec2 prev = x0;
              float t0 = max(tk - 12.0, 0.0);
              prev = x0 + cur * t0 + (Ud / f) * vec2(sin(f * t0), cos(f * t0) - 1.0);
              for (int j = 1; j <= 56; j++){
                float t = mix(t0, tk, float(j) / 56.0);
                vec2 cp = x0 + cur * t + (Ud / f) * vec2(sin(f * t), cos(f * t) - 1.0);
                dmin = min(dmin, segd(p, prev, cp));
                prev = cp;
              }
              vec3 dc = ramp(fk * 0.22 + uVarA * 0.2);
              float life = smoothstep(P, P - 3.0, tk);
              col += dc * glow(dmin, 40000.0) * 0.8 * life;
              col += mix(dc, vec3(1.0), 0.5) * glow(length(p - prev), 4000.0) * (1.0 + uBeat) * life;
            }
          } else {
            // THE WIND BELTS on a turning globe: trades, westerlies, polar easterlies
            float Rg = 0.88;
            float r = length(p);
            if (r < Rg){
              vec3 nn = vec3(p / Rg, sqrt(max(1.0 - dot(p, p) / (Rg * Rg), 0.0)));
              float tilt = 0.4;
              vec3 e = vec3(nn.x, nn.y * cos(tilt) - nn.z * sin(tilt), nn.y * sin(tilt) + nn.z * cos(tilt));
              float lat = asin(clamp(e.y, -1.0, 1.0));
              float lon = atan2s(e.x, e.z) + T * 0.05;
              vec2 wv = beltWind(lat);
              vec2 fd = normalize(wv + vec2(1e-4, 0.0));
              vec2 q = vec2(lon * cos(lat), lat);
              float P = 8.0;
              float f1 = fract(T / P), f2 = fract(T / P + 0.5);
              float sp = length(wv);
              vec2 o1 = fd * sp * f1 * P * 0.06, o2 = fd * sp * f2 * P * 0.06;
              vec2 fp = vec2(-fd.y, fd.x);
              float s1 = vnoise(vec2(dot(q - o1, fd) * 5.0, dot(q - o1, fp) * 45.0));
              float s2 = vnoise(vec2(dot(q - o2, fd) * 5.0 + 5.0, dot(q - o2, fp) * 45.0 + 9.0));
              float w1 = 1.0 - abs(2.0 * f1 - 1.0), w2 = 1.0 - abs(2.0 * f2 - 1.0);
              float st = (s1 * w1 + s2 * w2) / max(w1 + w2, 1e-3);
              float streak = smoothstep(0.66, 0.86, st) * smoothstep(0.05, 0.35, sp);
              vec3 wc = wv.x < 0.0 ? cA : cC;                     // easterlies one colour, westerlies the other
              float lit = 0.35 + 0.65 * max(dot(nn, normalize(vec3(-0.5, 0.3, 0.8))), 0.0);
              col += wc * streak * 1.1 * lit * (0.8 + 0.4 * uEnergy);
              col += cB * 0.04 * lit;
              // the cell boundaries: the doldrums, the horse latitudes, the polar front
              float bd = min(abs(abs(lat) - PI / 6.0), abs(abs(lat) - PI / 3.0));
              bd = min(bd, abs(lat));
              col += cB * glow(bd * Rg * nn.z, 60000.0) * 0.2;
            }
            col += cB * glow(r - Rg, 9000.0) * 0.35;
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
