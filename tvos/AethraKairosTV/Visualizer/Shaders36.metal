#include <metal_stdlib>
using namespace metal;

/* ================================================================
   VORTEX — the life of vortices.

   THE LEAPFROG: two coaxial vortex pairs (their mirror images implicit),
   Helmholtz's point-vortex law integrated per pixel by RK2 from the cycle's
   start (128 steps), drawn in the pairs' mean moving frame: their looping
   paths, the stream function ψ = Σ Γ/2π ln|z − zᵢ| − U y and its carried
   bubble, and the streamlines tinted by side. THE DANCE: a Thomson polygon
   (N = 3..7, rigid rotation Ω = Γ(N−1)/4πR², ψ in the rotating frame);
   four equal vortices in chaos; two dipoles colliding — the latter two
   integrated as above with fading trails. THE DRAIN: dye carried back along
   its true path — the Burgers vortex (u_r = −αr/2, v_θ = Γ/2πr (1 − e^{−r²/r_c²}),
   the angle integrated along the inflowing path), the Lamb–Oseen core
   spreading as √(4νt), and the Rankine free surface in section.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildVortex() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_vx: a self-contained translation unit.
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

namespace rm_vx {

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

/* the velocity at z induced by a vortex of strength g at c (counterclockwise for g > 0) */
vec2 vInd(vec2 z, vec2 c, float g){
  vec2 d = z - c;
  return g / (2.0 * PI) * vec2(-d.y, d.x) / (dot(d, d) + 0.0025);
}
/* the leapfrog's two upper vortices (mirrors at -y, opposite strength): their velocities */
void leapV(vec2 A, vec2 B, float G, INOUT(vec2, va), INOUT(vec2, vb)){
  va = vInd(A, vec2(A.x, -A.y), -G) + vInd(A, B, G) + vInd(A, vec2(B.x, -B.y), -G);
  vb = vInd(B, vec2(B.x, -B.y), -G) + vInd(B, A, G) + vInd(B, vec2(A.x, -A.y), -G);
}
/* four free vortices: the velocity of vortex i given all four (strengths g) */
vec2 fourV(int i, vec2 z0, vec2 z1, vec2 z2, vec2 z3, vec4 g){
  vec2 zi = i == 0 ? z0 : (i == 1 ? z1 : (i == 2 ? z2 : z3));
  vec2 v = vec2(0.0);
  if (i != 0) v += vInd(zi, z0, g.x);
  if (i != 1) v += vInd(zi, z1, g.y);
  if (i != 2) v += vInd(zi, z2, g.z);
  if (i != 3) v += vInd(zi, z3, g.w);
  return v;
}
/* the angular speed of the Burgers / Lamb-Oseen profile at r */
float omegaAt(float r, float G, float rc){
  float r2 = max(r * r, 1e-6);
  return G / (2.0 * PI * r2) * (1.0 - exp(-r2 / (rc * rc)));
}

}  // namespace rm_vx

fragment float4 room_vortex(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_vx;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.8 + 0;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 cA = ramp(0.1 + uVarA * 0.2), cB = ramp(0.45 + uVarA * 0.2), cC = ramp(0.8 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE LEAPFROG
          float sc = 0.95;
          float G = 1.0 + 0.15 * uEnergy;
          float P = 12.0;
          float tau = mod(T, P);
          float fadeIn = smoothstep(0.0, 0.8, tau) * smoothstep(P, P - 0.8, tau);
          vec2 A = vec2(0.0, 0.5), B = vec2(0.5, 0.5);
          float h = tau / 128.0;
          float dA = 1e9, dB = 1e9;
          float Ubar = 0.4 * G;                                   // the pairs' mean speed: the frame we ride in
          vec2 pA = A, pB = B;
          for (int i = 0; i < 128; i++){
            vec2 va, vb, va2, vb2;
            leapV(A, B, G, va, vb);
            leapV(A + 0.5 * h * va, B + 0.5 * h * vb, G, va2, vb2);
            A += h * va2; B += h * vb2;
            float sh = Ubar * h * float(i + 1);
            vec2 cA0 = A - vec2(sh, 0.0), cB0 = B - vec2(sh, 0.0);
            if (uShape < 0.5){
              vec2 q = vec2(p.x, abs(p.y)) / sc + vec2(0.25, 0.0);
              dA = min(dA, segd(q, pA, cA0));
              dB = min(dB, segd(q, pB, cB0));
            }
            pA = cA0; pB = cB0;
          }
          // the pixel in the moving frame
          vec2 z = p / sc + vec2(0.25, 0.0);
          vec2 Am = pA, Bm = pB;
          // the stream function in the moving frame
          float psi = G / (2.0 * PI) * (log(length(z - Am) + 1e-3) - log(length(z - vec2(Am.x, -Am.y)) + 1e-3)
                    + log(length(z - Bm) + 1e-3) - log(length(z - vec2(Bm.x, -Bm.y)) + 1e-3)) + Ubar * z.y;
          float e = 0.004;
          vec2 zx = z + vec2(e, 0.0);
          float psx = G / (2.0 * PI) * (log(length(zx - Am) + 1e-3) - log(length(zx - vec2(Am.x, -Am.y)) + 1e-3)
                    + log(length(zx - Bm) + 1e-3) - log(length(zx - vec2(Bm.x, -Bm.y)) + 1e-3)) + Ubar * zx.y;
          vec2 zy = z + vec2(0.0, e);
          float psy = G / (2.0 * PI) * (log(length(zy - Am) + 1e-3) - log(length(zy - vec2(Am.x, -Am.y)) + 1e-3)
                    + log(length(zy - Bm) + 1e-3) - log(length(zy - vec2(Bm.x, -Bm.y)) + 1e-3)) + Ubar * zy.y;
          float gp = length(vec2(psx - psi, psy - psi)) / e / sc;
          float lv = 0.035;
          float dl = abs(fract(psi / lv + 0.5) - 0.5) * lv / max(gp, 1e-3);
          if (uShape < 0.5){
            col += cB * glow(dl, 90000.0) * 0.12;
            col += cA * glow(dA * sc, 60000.0) * 0.8 * fadeIn + cC * glow(dB * sc, 60000.0) * 0.8 * fadeIn;
          } else if (uShape < 1.5){
            // the bubble: the pocket of fluid the pairs carry (psi of one sign, closed round the cores)
            float sepl = glow(abs(psi) / max(gp, 1e-3), 30000.0);
            col += cB * glow(dl, 90000.0) * 0.35 + mix(cA, cC, step(0.0, z.y)) * sepl * 0.8;
            col += cB * 0.05 * step(abs(psi), 0.06);
          } else {
            float side = step(0.0, psi);
            vec3 dc = mix(cA, cC, side);
            float band = fract(psi / lv);
            col += dc * (0.1 + 0.15 * sin(band * 6.2832) + 0.55 * glow(dl, 50000.0)) * smoothstep(0.0, 0.02, abs(psi) - 0.0 + 0.01);
          }
          // the cores
          for (int j = 0; j < 4; j++){
            vec2 c = j == 0 ? Am : (j == 1 ? vec2(Am.x, -Am.y) : (j == 2 ? Bm : vec2(Bm.x, -Bm.y)));
            float d = length(z - c) * sc;
            vec3 cc = j < 2 ? cA : cC;
            col += mix(cc, vec3(1.0), 0.5) * glow(d, 6000.0) * (0.9 + 0.6 * uBeat) * fadeIn + cc * glow(d, 300.0) * 0.08;
          }
        } else if (uMode < 1.5){
          float sc = 0.85;
          vec2 z = p / sc;
          if (uShape < 0.5){
            // THE POLYGONS: N equal vortices on a ring, turning rigidly; psi in the rotating frame
            float N = 3.0 + mod(floor(T / 9.0), 5.0);
            float R = 0.5;
            float G = 1.0;
            float Om = G * (N - 1.0) / (4.0 * PI * R * R);
            float ang = Om * T;
            float psi = 0.5 * Om * dot(z, z);
            vec2 gpv = Om * z;
            for (int k = 0; k < 7; k++){
              if (float(k) >= N) break;
              float a = ang + 2.0 * PI * float(k) / N;
              vec2 c = R * vec2(cos(a), sin(a));
              vec2 d = z - c;
              float d2 = dot(d, d) + 1e-5;
              psi -= G / (4.0 * PI) * log(d2);
              gpv -= G / (2.0 * PI) * d / d2;
              col += mix(cC, vec3(1.0), 0.5) * glow(length(d) * sc, 5000.0) * (1.0 + 0.6 * uBeat);
            }
            float gp = length(gpv) / sc;
            float lv = 0.03;
            float dl = abs(fract(psi / lv + 0.5) - 0.5) * lv / max(gp, 1e-3);
            float hue = fract(psi * 2.0);
            col += ramp(hue * 0.5 + uVarA * 0.2) * glow(dl, 90000.0) * 0.45 * smoothstep(1.6, 0.6, length(z));
          } else {
            // THE FOUR, THE DIPOLES: integrated from the cycle's start, trails fading behind
            bool dip = uShape > 1.5;
            float P = dip ? 16.0 : 20.0;
            float tau = mod(T, P);
            float fadeIn = smoothstep(0.0, 0.8, tau) * smoothstep(P, P - 0.8, tau);
            vec4 g = dip ? vec4(1.0, -1.0, 1.0, -1.0) : vec4(1.0, 0.8, 1.0, -0.7);
            vec2 z0 = dip ? vec2(-1.2, 0.2) : vec2(0.5, 0.1);
            vec2 z1 = dip ? vec2(-1.2, -0.05) : vec2(-0.3, 0.45);
            vec2 z2 = dip ? vec2(1.2, -0.2) : vec2(-0.45, -0.3);
            vec2 z3 = dip ? vec2(1.2, 0.05) : vec2(0.2, -0.5);
            if (dip){
              // facing each other, slightly offset so they swap partners
              z0 = vec2(-1.3, 0.13); z1 = vec2(-1.3, -0.13); z2 = vec2(1.3, -0.07); z3 = vec2(1.3, 0.19);
            }
            float h = tau / 128.0;
            float d0 = 1e9, d1 = 1e9, d2 = 1e9, d3 = 1e9;
            float a0 = 0.0, a1 = 0.0, a2 = 0.0, a3 = 0.0;
            for (int i = 0; i < 128; i++){
              vec2 v0 = fourV(0, z0, z1, z2, z3, g), v1 = fourV(1, z0, z1, z2, z3, g);
              vec2 v2 = fourV(2, z0, z1, z2, z3, g), v3 = fourV(3, z0, z1, z2, z3, g);
              vec2 m0 = z0 + 0.5 * h * v0, m1 = z1 + 0.5 * h * v1, m2 = z2 + 0.5 * h * v2, m3 = z3 + 0.5 * h * v3;
              vec2 n0 = z0 + h * fourV(0, m0, m1, m2, m3, g), n1 = z1 + h * fourV(1, m0, m1, m2, m3, g);
              vec2 n2 = z2 + h * fourV(2, m0, m1, m2, m3, g), n3 = z3 + h * fourV(3, m0, m1, m2, m3, g);
              float age = tau - h * float(i + 1);
              float s0 = segd(z, z0, n0), s1 = segd(z, z1, n1), s2 = segd(z, z2, n2), s3 = segd(z, z3, n3);
              if (s0 < d0){ d0 = s0; a0 = age; }
              if (s1 < d1){ d1 = s1; a1 = age; }
              if (s2 < d2){ d2 = s2; a2 = age; }
              if (s3 < d3){ d3 = s3; a3 = age; }
              z0 = n0; z1 = n1; z2 = n2; z3 = n3;
            }
            float tl = dip ? 6.0 : 4.0;
            col += ramp(0.05 + uVarA * 0.2) * glow(d0 * sc, 50000.0) * exp(-a0 / tl) * fadeIn;
            col += ramp(0.3 + uVarA * 0.2) * glow(d1 * sc, 50000.0) * exp(-a1 / tl) * fadeIn;
            col += ramp(0.55 + uVarA * 0.2) * glow(d2 * sc, 50000.0) * exp(-a2 / tl) * fadeIn;
            col += ramp(0.8 + uVarA * 0.2) * glow(d3 * sc, 50000.0) * exp(-a3 / tl) * fadeIn;
            // the cores now, and the stream function they make
            float psi = -(g.x * log(length(z - z0) + 1e-3) + g.y * log(length(z - z1) + 1e-3)
                       + g.z * log(length(z - z2) + 1e-3) + g.w * log(length(z - z3) + 1e-3)) / (2.0 * PI);
            float lv = 0.05;
            float dl = abs(fract(psi / lv + 0.5) - 0.5);
            col += cB * smoothstep(0.08, 0.0, dl) * 0.05 * smoothstep(2.0, 0.5, length(z));
            for (int k = 0; k < 4; k++){
              vec2 c = k == 0 ? z0 : (k == 1 ? z1 : (k == 2 ? z2 : z3));
              col += vec3(1.0) * glow(length(z - c) * sc, 6000.0) * (0.9 + 0.6 * uBeat) * fadeIn;
            }
          }
        } else {
          // THE DRAIN
          float r = length(p);
          float th = atan2s(p.y, p.x);
          if (uShape < 1.5){
            bool cup = uShape > 0.5;
            float P = cup ? 18.0 : 14.0;
            float tau = mod(T, P);
            float fadeIn = smoothstep(0.0, 1.0, tau) * smoothstep(P, P - 1.0, tau);
            float G = 1.4 * (1.0 + 0.2 * uEnergy);
            float al = cup ? 0.0 : 0.16;
            float nu = 0.0015;
            // carry the pixel back along its path to where it was when the dye was laid
            // (and a neighbour a pixel further out, to know how tightly the dye is wound here)
            float ex = 0.003;
            float rr = r, ang = th, rr2 = r + ex, ang2 = th;
            float dt = tau / 16.0;
            for (int i = 0; i < 16; i++){
              float ts = tau - (float(i) + 0.5) * dt;
              float rc = cup ? sqrt(0.0016 + 4.0 * nu * ts) : 0.06;
              ang -= omegaAt(rr * exp(al * 0.25 * dt), G, rc) * dt;
              ang2 -= omegaAt(rr2 * exp(al * 0.25 * dt), G, rc) * dt;
              rr = rr * exp(al * 0.5 * dt);
              rr2 = rr2 * exp(al * 0.5 * dt);
            }
            float wind = abs(ang2 - ang) / ex * 3.0 / (2.0 * PI);   // spokes crossed per screen unit, radially
            float aa = smoothstep(200.0, 60.0, wind);
            // the dye: spokes and rings laid at the start, in two colours
            float spoke = smoothstep(0.3, 0.05, abs(fract(ang * 3.0 / (2.0 * PI) + 0.5) - 0.5));
            float ring = glow(abs(fract(rr * 2.5 + 0.5) - 0.5) / 2.5, 900.0);
            float inR = smoothstep(1.1, 0.9, rr);
            vec3 d1 = mix(cA, cC, fract(floor(ang * 3.0 / (2.0 * PI) + 0.5) / 3.0) * 1.5);
            col += d1 * mix(0.3, spoke, aa) * 0.5 * inR + cB * ring * 0.12 * inR * aa;
            // the core and the plughole
            float rc0 = cup ? sqrt(0.0016 + 4.0 * nu * tau) : 0.06;
            col += cB * glow(r - rc0, 20000.0) * 0.4;
            if (!cup) col *= smoothstep(0.02, 0.05, r);
            col *= fadeIn * 0.9 + 0.1;
            col += cB * glow(r - 1.0, 9000.0) * 0.3;
          } else {
            // THE DIMPLE: the Rankine vortex's free surface in section
            float G = 2.2 + 0.6 * uEnergy + 0.3 * uBass;
            float rc = 0.13;
            float k = G * G / (8.0 * PI * PI * 9.81) * 30.0;
            float x = abs(p.x);
            float hS = x < rc ? -k / (rc * rc) * (2.0 - x * x / (rc * rc)) : -k / (x * x);
            float y0 = 0.35;
            float yS = y0 + max(hS * 0.05, -1.4);
            float floorY = -0.8;
            float inW = step(p.y, yS) * step(floorY, p.y) * step(x, uAspect * 0.85);
            // tracers riding round: seen side-on, each a dot on an ellipse at its own speed
            col += cB * 0.06 * inW;
            // tracers riding round on circles, seen side-on: x = R cos(phase), the near half brighter
            for (int j = 0; j < 40; j++){
              float fj = float(j);
              float R = 0.05 + 0.8 * hash21(vec2(fj, 1.3));
              float hR = R < rc ? -k / (rc * rc) * (2.0 - R * R / (rc * rc)) : -k / (R * R);
              float ytop = y0 + max(hR * 0.05, -1.4);
              float yj = mix(floorY + 0.03, ytop - 0.03, hash21(vec2(fj, 7.1)));
              float vth = R < rc ? R / rc : rc / R;
              float ph = T * vth * 0.9 / R + hash21(vec2(fj, 3.3)) * 6.2832;
              vec2 pj = vec2(R * cos(ph) * uAspect * 0.95, yj);
              float near = 0.5 + 0.5 * sin(ph);
              col += mix(cA, cC, vth) * glow(length(p - pj), 6000.0) * (0.15 + 0.7 * near) * step(yj, ytop);
            }
            col += mix(cB, vec3(1.0), 0.4) * glow(p.y - yS, 90000.0) * step(x, uAspect * 0.85) * (0.7 + 0.4 * uBeat);
            col += cB * (glow(p.y - floorY, 300000.0) + glow(x - uAspect * 0.85, 300000.0) * step(floorY, p.y) * step(p.y, 0.6)) * 0.4;
            // the air core above the surface, a faint swirl
            col += cC * glow(x, 900.0) * step(yS, p.y) * step(p.y, y0) * 0.15;
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
