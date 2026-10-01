#include <metal_stdlib>
using namespace metal;

/* ================================================================
   TIDES — the pull of the Moon.

   THE BULGE: the equilibrium tide h ∝ P2(cos(θ − θ_moon)) + 0.46 P2(cos(θ −
   θ_sun)), exaggerated, on an Earth turning beneath it (a day every few
   seconds, a month in about forty); THE LAG rotates the bulge ahead and
   draws the torque; THE FIELD is the tidal acceleration (2x, −y) GM/d³ and
   its field lines y√|x| = const. THE AMPHIDROMES: Taylor's gulf, two Kelvin
   waves (one reflected, |R| < 1) decaying from opposite shores as e^{−f y/c},
   η = Re[(e^{−a y} e^{ikx} + R e^{−a(W−y)} e^{−ikx}) e^{−iωt}]; colour is η,
   cotidal lines are arg Z every 30° (one lunar hour), co-range lines |Z|,
   and the amphidromes emerge where |Z| vanishes, the tide wheeling round
   them anticlockwise. THE SHORE: M2 + S2 + K1 + O1 with true periods
   (12.42, 12.00, 23.93, 25.82 h), a beach and a fifteen-day gauge record.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildTides() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_td: a self-contained translation unit.
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

namespace rm_td {

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

float P2(float c){ return 0.5 * (3.0 * c * c - 1.0); }
/* Taylor's gulf: the complex tide amplitude Z at (x, y) in a channel of width W */
vec2 gulfZ(vec2 q, float k, float a, float W, vec2 R){
  vec2 e1 = exp(-a * q.y) * vec2(cos(k * q.x), sin(k * q.x));
  vec2 e2 = exp(-a * (W - q.y)) * vec2(cos(-k * q.x), sin(-k * q.x));
  return e1 + cmul(R, e2);
}
/* the tide at hour t from four constituents (amplitudes m2, s2, k1, o1) */
float tideAt(float t, vec4 A){
  return A.x * cos(2.0 * PI * t / 12.42) + A.y * cos(2.0 * PI * t / 12.0 + 0.6)
       + A.z * cos(2.0 * PI * t / 23.93 + 1.1) + A.w * cos(2.0 * PI * t / 25.82 + 2.3);
}

}  // namespace rm_td

fragment float4 room_tides(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_td;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.75 + 4;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 cW = ramp(0.55 + uVarA * 0.2), cH = ramp(0.85 + uVarA * 0.2), cL = ramp(0.2 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE BULGE: the Sun off to the left, the Moon wheeling round once a "month"
          float Re = 0.3;
          float month = 40.0;
          float thm = 2.0 * PI * T / month + 0.4;
          float ths = PI;
          float lag = uShape > 0.5 && uShape < 1.5 ? 0.35 : 0.0;
          vec2 mp = 0.82 * vec2(cos(thm), sin(thm));
          if (uShape > 1.5) mp = vec2(0.95, 0.0);
          float th = atan2s(p.y, p.x);
          float r = length(p);
          float thm2 = uShape > 1.5 ? 0.0 : thm;
          float h = P2(cos(th - thm2 - lag)) + (uShape > 1.5 ? 0.0 : 0.46 * P2(cos(th - ths)));
          float amp = 0.11 * (1.0 + 0.3 * uBass);
          float ro = Re * (1.07 + amp * h);
          float light = 0.25 + 0.75 * smoothstep(-0.2, 0.6, -p.x / max(r, 1e-3));
          // the solid Earth, turning beneath the water (continents from noise)
          if (r < Re){
            float spin = T * 0.9;
            vec2 q = rot(p, -spin) / Re;
            float z = sqrt(max(1.0 - dot(q, q), 0.0));
            float land = smoothstep(0.52, 0.56, fbm4(q * 2.2 / (0.4 + z) + 3.0));
            col += mix(cL * 0.12, cL * 0.4, land) * light;
          } else if (r < ro){
            // the ocean bulge
            float depth = (ro - r) / (ro - Re + 1e-4);
            col += mix(cW, cH, clamp(h * 0.4 + 0.3, 0.0, 1.0)) * (0.3 + 0.35 * depth) * (0.4 + 0.6 * light);
          }
          col += mix(cW, vec3(1.0), 0.4) * glow(r - ro, 60000.0) * 0.9 * (0.4 + 0.6 * light);
          col += cW * glow(r - Re, 200000.0) * 0.12;
          // the Moon, and the Sun's light
          col += vec3(0.85) * smoothstep(0.035, 0.03, length(p - mp)) * 0.7 + cH * glow(length(p - mp), 400.0) * 0.1;
          col += cH * 0.06 * smoothstep(0.2, -1.6, p.x);
          if (uShape < 0.5){
            // the phase: spring at the syzygies, neap at the quarters
            float sp = abs(cos(thm - ths));
            col += cH * glow(length(p - mp), 900.0) * 0.2 * sp;
            vec2 g = p - vec2(uAspect - 0.25, -0.75);
            float bar = step(abs(g.y), 0.012) * step(0.0, g.x + 0.15) * step(g.x + 0.15, 0.3 * sp);
            col += cH * bar * 0.6 + cW * glow(abs(g.y), 90000.0) * step(abs(g.x), 0.15) * 0.1;
          } else if (uShape < 1.5){
            // the lag: the bulge's axis runs ahead of the Moon, the Moon pulls it back (the torque)
            vec2 ax = vec2(cos(thm + lag), sin(thm + lag));
            float da = abs(p.x * ax.y - p.y * ax.x);
            col += cH * glow(da, 200000.0) * step(r, ro + 0.1) * step(Re * 0.3, r) * 0.4;
            vec2 ml = vec2(cos(thm), sin(thm));
            float dm = abs(p.x * ml.y - p.y * ml.x);
            float dash = step(0.5, fract(dot(p, ml) * 20.0));
            col += cW * glow(dm, 200000.0) * dash * step(0.0, dot(p, ml)) * step(r, 0.8) * 0.3;
            // the Moon's slow spiral outwards
            float ang = th - thm;
            ang = ang - 2.0 * PI * floor((ang + PI) / (2.0 * PI));
            col += cW * glow(r - 0.82 - 0.004 * ang, 90000.0) * 0.15;
          } else {
            // the tidal field (2x, -y) and its field lines y sqrt|x| = const
            vec2 F = vec2(2.0 * p.x, -p.y);
            float psi = p.y * sqrt(abs(p.x));
            float gpsi = length(vec2(0.5 * p.y / max(sqrt(abs(p.x)), 1e-3), sqrt(abs(p.x))));
            float fl = abs(fract(psi / 0.05 + 0.5) - 0.5) * 0.05 / max(gpsi, 1e-3);
            float ph = fract(T * 0.4 - log(max(length(F), 1e-3)) * 0.6);
            float outer = step(Re * 1.15, r) * smoothstep(1.5, 0.6, r);
            col += cW * glow(fl, 90000.0) * outer * (0.35 + 0.5 * glow(ph - 0.5, 30.0));
            // and the arrows on a ring: outward along the Moon's line, inward across it
            for (int j = 0; j < 16; j++){
              float a = float(j) * PI / 8.0;
              vec2 b = 0.46 * vec2(cos(a), sin(a));
              vec2 f = vec2(2.0 * b.x, -b.y) * 0.22 * (1.0 + 0.4 * uBeat);
              col += cH * glow(segd(p, b, b + f), 120000.0) * 0.8;
              col += cH * glow(length(p - b - f), 30000.0) * 0.6;
            }
          }
        } else if (uMode < 1.5){
          // THE AMPHIDROMES
          float W = uShape > 0.5 && uShape < 1.5 ? 1.5 : 1.3;
          float Lx = uShape > 0.5 && uShape < 1.5 ? 1.5 : uAspect * 1.8;
          vec2 q = vec2(p.x + Lx * 0.5, p.y + W * 0.5);
          bool inB = q.x > 0.0 && q.x < Lx && q.y > 0.0 && q.y < W;
          float k = uShape > 0.5 && uShape < 1.5 ? 2.1 : 3.6;
          float a = 1.5;
          vec2 R = 0.6 * vec2(cos(0.5), sin(0.5));
          float om = T * 0.55;
          if (inB){
            vec2 Z = gulfZ(q, k, a, W, R);
            float A = length(Z);
            float ph = atan2s(Z.y, Z.x);
            float eta = A * cos(ph - om);
            float e = 0.004;
            vec2 Zx = gulfZ(q + vec2(e, 0.0), k, a, W, R), Zy = gulfZ(q + vec2(0.0, e), k, a, W, R);
            float px = atan2s(Zx.y, Zx.x) - ph, py = atan2s(Zy.y, Zy.x) - ph;
            px -= 2.0 * PI * floor(px / (2.0 * PI) + 0.5);
            py -= 2.0 * PI * floor(py / (2.0 * PI) + 0.5);
            float gph = length(vec2(px, py)) / e;
            float gA = length(vec2(length(Zx) - A, length(Zy) - A)) / e;
            vec3 wc = eta > 0.0 ? cH : cL;
            col += wc * abs(eta) * 0.32 * (0.8 + 0.3 * uBass) + cW * 0.03;
            if (uShape < 1.5){
              // the cotidal lines, every lunar hour; the hour of high water brightest
              float st = PI / 6.0;
              float dc = abs(fract(ph / st + 0.5) - 0.5) * st / max(gph, 1e-3);
              col += cW * glow(dc, 90000.0) * 0.4 * smoothstep(0.02, 0.15, A);
              float dh = ph - om;
              dh -= 2.0 * PI * floor(dh / (2.0 * PI) + 0.5);
              col += mix(cH, vec3(1.0), 0.4) * glow(abs(dh) / max(gph, 1e-3), 20000.0) * smoothstep(0.02, 0.12, A) * (0.9 + 0.5 * uBeat);
            }
            // the co-range lines
            float cr = abs(fract(A / 0.25 + 0.5) - 0.5) * 0.25 / max(gA, 1e-3);
            col += cL * glow(cr, 90000.0) * (uShape > 1.5 ? 0.6 : 0.18);
            if (uShape > 1.5){
              // the high water, sweeping round: a bright band where eta peaks
              col += cH * smoothstep(0.75, 1.0, eta / max(A, 1e-3)) * A * 0.5;
            }
            // the amphidromes themselves: where the tide vanishes
            col += vec3(1.0) * glow(A, 900.0) * 0.6;
          } else {
            // the land
            vec2 dq = max(max(-q, q - vec2(Lx, W)), vec2(0.0));
            float dl = length(dq);
            col += cL * 0.04 * fbm4(p * 6.0) + cW * glow(dl, 30000.0) * 0.5;
          }
        } else {
          // THE SHORE: a beach in profile, and its tide gauge above
          vec4 Am = uShape < 0.5 ? vec4(1.0, 0.46, 0.1, 0.07) : (uShape < 1.5 ? vec4(0.6, 0.25, 0.45, 0.35) : vec4(0.1, 0.05, 0.75, 0.6));
          float hrs = T * 4.0;                                     // four hours a second
          float hNow = tideAt(hrs, Am) / (Am.x + Am.y + Am.z + Am.w);
          float yW = -0.38 + 0.2 * hNow;
          float x = p.x;
          // the sand: a gentle slope rising to the right, rocks along it
          float yS = -0.8 + 0.85 * smoothstep(-1.0, 1.1, x / uAspect) + 0.02 * sin(x * 7.0) + 0.012 * fbm4(vec2(x * 9.0, 1.0));
          float rock = smoothstep(0.55, 0.62, fbm4(vec2(x * 3.0, 4.0))) * 0.06;
          yS += rock;
          // the swell: the music's chop, a breaker on the beat
          float sw = (0.012 + 0.012 * uEnergy) * sin(x * 14.0 - T * 2.4) + 0.006 * sin(x * 31.0 + T * 3.1) + 0.012 * uBeat * sin(x * 6.0 - T * 4.0);
          float yWs = yW + sw;
          // wet sand: below the highest water of the last few hours
          float hiR = -1e9;
          for (int j = 0; j < 8; j++){
            float hh = tideAt(hrs - float(j) * 0.8, Am) / (Am.x + Am.y + Am.z + Am.w);
            hiR = max(hiR, -0.38 + 0.2 * hh);
          }
          if (p.y < yS){
            float wet = smoothstep(yS - 0.03, yS + 0.03, hiR);
            col += mix(cH * 0.14, cH * 0.07, wet) * (0.6 + 0.4 * fbm4(p * 30.0)) + cH * glow(p.y - yS, 90000.0) * 0.2;
          } else if (p.y < yWs){
            float d = yWs - p.y;
            col += mix(cW * 0.35, cW * 0.08, smoothstep(0.0, 0.3, d));
          }
          col += mix(cW, vec3(1.0), 0.5) * glow(p.y - yWs, 40000.0) * 0.6 * step(yS - 0.005, p.y) * step(yS, yWs + 0.01);
          // the foam where water meets sand
          col += vec3(0.9) * glow(p.y - yWs, 60000.0) * glow(yWs - yS, 3000.0) * 0.5;
          // the gauge: fifteen days of record, the pen at the right
          float gx0 = -uAspect * 0.9, gx1 = uAspect * 0.9;
          float u = (p.x - gx0) / (gx1 - gx0);
          float gy = 0.5;
          if (u > 0.0 && u < 1.0){
            float tg = hrs - (1.0 - u) * 360.0;
            float hg = tideAt(tg, Am) / (Am.x + Am.y + Am.z + Am.w);
            float hg2 = tideAt(tg + 0.5, Am) / (Am.x + Am.y + Am.z + Am.w);
            float slope = (hg2 - hg) / 0.5 * 0.2 * 360.0 / (gx1 - gx0);
            float dg = abs(p.y - gy - hg * 0.2) / sqrt(1.0 + slope * slope);
            col += mix(cL, cH, 0.5 + 0.5 * hg) * glow(dg, 200000.0) * 0.8;
            col += cW * glow(p.y - gy, 600000.0) * 0.1;
            // the day ticks
            float day = fract(tg / 24.0);
            col += cW * glow(min(day, 1.0 - day) * 24.0 * (gx1 - gx0) / 360.0, 600000.0) * step(abs(p.y - gy), 0.24) * 0.06;
          }
          col += vec3(1.0) * glow(length(p - vec2(gx1, gy + hNow * 0.2)), 12000.0) * (0.8 + uBeat * 0.5);
          // the Moon's phase, high on the right
          vec2 mq = p - vec2(uAspect * 0.78, 0.86);
          float mph = 2.0 * PI * hrs / 708.7;
          float md = length(mq);
          if (md < 0.05){
            vec3 n = vec3(mq / 0.05, sqrt(max(1.0 - dot(mq, mq) / 0.0025, 0.0)));
            float lit = step(0.0, dot(n, vec3(sin(mph), 0.0, -cos(mph))));
            col += vec3(0.8) * (0.1 + 0.75 * lit);
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
