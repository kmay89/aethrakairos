#include <metal_stdlib>
using namespace metal;

/* ================================================================
   COCHLEA — the ear, listening.

   The basilar membrane, base (x = 0) to apex (x = 1), with Greenwood's
   place map f = 165.4 (10^(2.1(1−x)) − 0.88). A component at frequency f
   peaks at its place xc and rides in as a travelling wave: phase
   5π(√xc − √(xc − x))/√xc (two and a half cycles to the peak, slowing as it
   nears), envelope growing as exp((x − xc)/0.1) and cut off past the peak
   as exp(−((x − xc)/0.025)²), amplitude compressed (^0.6) as the outer hair
   cells compress. Sources: the live spectrum in 24 log bands, a glissando,
   or a chord with four harmonics a note. The click is each place ringing
   at its own (slowed) frequency after a group delay that grows toward the
   apex. The organ of Corti, the piano on Greenwood's map, and the
   critical bands on the ERB-number scale 21.4 log10(1 + 0.00437 f).

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildCochlea() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_co: a self-contained translation unit.
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

namespace rm_co {

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

/* Greenwood: the place (0 base .. 1 apex) of frequency f, and the frequency of place x */
float placeOf(float f){ return 1.0 - log(max(f / 165.4 + 0.88, 1e-3)) / (2.1 * 2.302585); }
float cfAt(float x){ return 165.4 * (exp(2.1 * 2.302585 * (1.0 - x)) - 0.88); }
/* the travelling wave of a component peaking at xc, seen at x: (envelope, phase) */
vec2 tw(float x, float xc){
  float d = x - xc;
  float env = d < 0.0 ? exp(d / 0.1) : exp(-sq(d / 0.025));
  float sx = sqrt(max(xc, 1e-3));
  float ph = 5.0 * PI * (sx - sqrt(max(xc - x, 0.0))) / sx + max(d, 0.0) * 140.0;
  return vec2(env, ph);
}
/* the slowed angular speed we show for frequency f */
float wvis(float f){ return 2.0 * PI * 0.3 * ppow(max(f, 1.0) / 100.0, 0.35); }
/* the chord's root, walking I - V - vi - IV, in semitones above A2 */
float chordRoot(float T){
  float i = mod(floor(T / 5.0), 4.0);
  return i < 0.5 ? 3.0 : (i < 1.5 ? 10.0 : (i < 2.5 ? 12.0 : 8.0));
}
/* the click's group delay to place x (slowed) and the place's own ringing speed */
float clickDelay(float x){ return 0.06 * (exp(3.2 * x) - 1.0); }
float clickW(float x){ return 2.0 * PI * 6.0 * exp(-2.2 * x); }

}  // namespace rm_co

fragment float4 room_cochlea(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_co;
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
        float src = uMode < 0.5 ? (uShape < 0.5 ? 0.0 : (uShape < 1.5 ? 1.0 : 2.0)) : (uMode < 1.5 ? (uShape < 0.5 ? 1.0 : 0.0) : 0.0);
        float gl = 80.0 * exp(log(100.0) * (0.5 - 0.5 * cos(T * 0.12)));        // the glissando, 80 Hz to 8 kHz
        if (uMode > 0.5 && uMode < 1.5 && uShape < 0.5) gl = 125.0 * exp(log(64.0) * (0.5 - 0.5 * cos(T * 0.07)));
        float root = chordRoot(T);
        bool clickM = uMode > 0.5 && uMode < 1.5 && uShape > 1.5;
        // --- where this pixel sits on the membrane, per face ---
        float x = 0.0;           // place, 0 base .. 1 apex
        float uAcross = 0.0;     // across the duct (spiral) or the plot height (strip)
        float rs = 1.0;          // the spiral's local radius
        float span = 2.0 * uAspect * 0.86;
        float xs0 = (p.x / (uAspect * 0.86) + 1.0) * 0.5;
        float onSp = 0.0;
        if (uMode < 0.5){
          // a logarithmic spiral of two and a half turns, base outside, apex at the centre
          float b = 0.174, r0 = 0.05, thMax = 5.0 * PI;
          float rr = max(length(p), 1e-4);
          float ang = atan2s(p.y, p.x) - T * 0.02;
          ang = ang - 2.0 * PI * floor(ang / (2.0 * PI));
          float best = 1e9, th = 0.0;
          for (int n = 0; n < 3; n++){
            float t = ang + 2.0 * PI * float(n);
            float d = abs(log(rr / (r0 * exp(b * t))));
            if (d < best){ best = d; th = t; }
          }
          rs = r0 * exp(b * th);
          uAcross = log(rr / rs) / 0.22;                 // -1 .. 1 across the membrane
          x = 1.0 - th / thMax;
          onSp = step(abs(uAcross), 1.6) * step(0.0, x) * step(x, 1.0);
        } else {
          x = uMode < 1.5 ? xs0 : (uShape > 0.5 && uShape < 1.5 ? mix(0.3, 1.0, xs0) : (uShape < 0.5 ? (floor(xs0 * 30.0) + 0.5) / 30.0 : xs0));
        }
        // --- the membrane's motion: Y (displacement) and E (envelope) at x, and at x +- dx for the slope ---
        float dx = 0.0015;
        float Y0 = 0.0, Ym = 0.0, Yp = 0.0, E2 = 0.0;
        if (!clickM){
          for (int k = 0; k < 24; k++){
            float fk = 0.0, ak = 0.0;
            if (src < 0.5){
              fk = 50.0 * exp(log(240.0) * (float(k) + 0.5) / 24.0);
              ak = ppow(clamp(SPEC(fk) * 1.4, 0.0, 1.0), 0.6);
            } else if (src < 1.5){
              fk = gl; ak = k == 0 ? 0.9 : 0.0;
            } else {
              float note = floor(float(k) / 4.0);
              float hm = float(k) - note * 4.0 + 1.0;
              float semis = root + (note < 0.5 ? 0.0 : (note < 1.5 ? 4.0 : 7.0));
              fk = 220.0 * exp2(semis / 12.0) * hm;
              ak = k < 12 ? 0.85 / hm : 0.0;
            }
            if (ak < 0.01) continue;
            float xc = placeOf(fk);
            float w = wvis(fk) * T;
            vec2 a = tw(x, xc);
            Y0 += ak * a.x * cos(w - a.y);
            E2 += sq(ak * a.x);
            if (uMode > 0.5 && uMode < 1.5){
              vec2 am = tw(x - dx, xc), ap = tw(x + dx, xc);
              Ym += ak * am.x * cos(w - am.y);
              Yp += ak * ap.x * cos(w - ap.y);
            }
          }
        } else {
          // the click: each place rings at its own speed once the front has reached it
          float tau = mod(T, 2.6);
          for (int j = 0; j < 3; j++){
            float xx = x + (float(j) - 1.0) * dx;
            float tl = tau - clickDelay(xx);
            float wq = clickW(xx);
            float yv = tl > 0.0 ? sin(wq * tl) * exp(-tl * wq / 8.0) * (1.0 - exp(-tl * 30.0)) * 0.9 : 0.0;
            if (j == 0) Ym = yv; else if (j == 1) Y0 = yv; else Yp = yv;
          }
          float tl0 = tau - clickDelay(x);
          E2 = tl0 > 0.0 ? sq(exp(-tl0 * clickW(x) / 8.0) * 0.9) : 0.0;
        }
        float E = sqrt(E2);
        vec3 hue = ramp(x * 0.8 + uVarA * 0.2);
        if (uMode < 0.5){
          // THE SPIRAL
          float hw = rs * 0.22;                                  // half-width of the membrane, screen units
          float wall = min(abs(abs(uAcross) - 1.35) * hw, 1.0);
          col += ramp(0.5 + uVarA * 0.2) * glow(wall, 60000.0) * 0.22 * onSp;
          float band = smoothstep(1.05, 0.95, abs(uAcross)) * onSp;
          col += hue * band * (0.02 + E * 0.45) * (0.8 + 0.4 * uBeat);
          float yl = clamp(Y0, -1.2, 1.2) * 0.8;
          float dl = abs(uAcross - yl) * hw;
          col += mix(hue, vec3(1.0), 0.35) * glow(dl, 40000.0) * band * (0.25 + 1.2 * E);
          // the octaves along the outer wall: 125 Hz .. 16 kHz
          for (int o = 0; o < 8; o++){
            float xo = placeOf(125.0 * exp2(float(o)));
            float tho = (1.0 - xo) * 5.0 * PI;
            float ro = 0.05 * exp(0.174 * tho) * exp(0.22 * 1.35);
            vec2 po = ro * vec2(cos(tho + T * 0.02), sin(tho + T * 0.02));
            col += hue * glow(length(p - po), 20000.0) * 0.6;
          }
          // the oval window at the base: the stapes pushes the music in
          float thb = 5.0 * PI;
          vec2 pb = 0.05 * exp(0.174 * thb) * 1.08 * vec2(cos(thb + T * 0.02), sin(thb + T * 0.02));
          col += ramp(0.1 + uVarA * 0.2) * glow(length(p - pb), 900.0 / (1.0 + 2.0 * uEnergy)) * (0.3 + 0.5 * uEnergy);
          col += hue * glow(length(p), 3000.0) * 0.12;          // the helicotrema
        } else if (uMode < 1.5){
          // THE MEMBRANE, unrolled: base left, apex right
          float y0 = 0.08, amp = 0.34;
          float inS = step(0.0, xs0) * step(xs0, 1.0);
          float py = (p.y - y0) / amp;
          float slope = (Yp - Ym) / (2.0 * dx) / span * amp;       // dY/dx in screen units
          float dc = abs(py - Y0) * amp / min(sqrt(1.0 + slope * slope), 5.0);
          col += mix(hue, vec3(1.0), 0.3) * glow(dc, 50000.0) * (0.45 + 0.9 * E) * inS;
          // the envelope, filled faintly
          col += hue * step(abs(py), E) * 0.06 * inS + hue * glow((abs(py) - E) * amp, 90000.0) * 0.25 * inS;
          // Bekesy's snapshots of one tone: the wave at eight instants, under its envelope
          if (uShape < 0.5){
            float xc = placeOf(gl);
            vec2 a = tw(x, xc);
            for (int j = 0; j < 6; j++){
              float yj = 0.9 * a.x * cos(float(j) * PI / 3.0 - a.y);
              col += hue * glow((py - yj) * amp, 120000.0) * 0.12 * inS;
            }
          }
          // the rest line and the octave ruler
          col += ramp(0.5) * glow(py * amp, 400000.0) * 0.08 * inS;
          for (int o = 0; o < 8; o++){
            float xo = placeOf(125.0 * exp2(float(o)));
            vec2 po = vec2((xo * 2.0 - 1.0) * uAspect * 0.86, -0.62);
            col += ramp(xo * 0.8 + uVarA * 0.2) * glow(length(p - po), 15000.0) * 0.7;
          }
          col += ramp(0.5) * glow(p.y + 0.62, 300000.0) * 0.06 * inS;
        } else {
          // THE ORGAN OF CORTI
          if (uShape < 0.5){
            // the hair cells: one inner row, three outer; their bundles tip with the membrane and open one way
            float N = 30.0;
            float ci = floor(xs0 * N);
            float u = (fract(xs0 * N) - 0.5) * span / N;          // screen offset from the column's centre
            float xc0 = (ci + 0.5) / N;
            // the bundles share their column's motion
            float Yc = Y0;
            float inS = step(0.0, xs0) * step(xs0, 1.0);
            for (int rw = 0; rw < 4; rw++){
              float ry = rw == 0 ? -0.5 : -0.12 + 0.2 * float(rw - 1);
              float tilt = clamp(Yc, -1.2, 1.2) * 0.55;
              vec2 q = vec2(u, p.y - ry);
              float open = max(Yc, 0.0);                           // only the excitatory direction opens the channels
              vec3 cc = mix(hue, vec3(1.0), 0.2);
              // the cell body
              col += ramp(0.45 + uVarA * 0.2) * glow(length((q + vec2(0.0, 0.06)) * vec2(1.0, 0.7)), 1500.0) * (0.12 + 0.25 * open) * inS;
              // three stereocilia in a staircase (a V for the outer cells, a line for the inner)
              for (int s = 0; s < 3; s++){
                float fs = float(s) - 1.0;
                float hgt = 0.06 + 0.03 * (fs + 1.0);
                vec2 basep = rw == 0 ? vec2(fs * 0.02, 0.0) : vec2(fs * 0.02, -abs(fs) * 0.02);
                vec2 tip = basep + hgt * vec2(sin(tilt), cos(tilt));
                float dseg = segd(q, basep, tip);
                col += cc * glow(dseg, 150000.0) * 0.6 * inS;
                col += cc * glow(length(q - tip), 20000.0) * (0.25 + 2.5 * open) * inS;
              }
            }
            // the tectorial membrane above, sheared sideways by the motion
            float tm = 0.4 + 0.01 * Yc;
            col += hue * glow(p.y - tm, 2000.0) * (0.05 + 0.25 * E) * inS;
          } else if (uShape < 1.5){
            // the piano on Greenwood's map: A0 at the apex, C8 near the middle
            float f = cfAt(x);
            float m = 69.0 + 12.0 * log2(max(f, 1.0) / 440.0);
            float key = floor(m + 0.5);
            float pc = floor(mod(key + 0.5, 12.0));
            bool blk = abs(pc - 1.0) < 0.5 || abs(pc - 3.0) < 0.5 || abs(pc - 6.0) < 0.5 || abs(pc - 8.0) < 0.5 || abs(pc - 10.0) < 0.5;
            float fk = 440.0 * exp2((key - 69.0) / 12.0);
            float lit = ppow(clamp(SPEC(fk) * 1.3, 0.0, 1.0), 1.4);   // only the sounding keys light
            float inK = step(21.0, key) * step(key, 108.0) * step(0.0, xs0) * step(xs0, 1.0);
            float dm = 12.0 / log(2.0) * abs(cfAt(x + 0.001) - f) / max(f, 1.0) / 0.001 / span * 0.7;   // keys per screen unit
            float edge = (0.5 - abs(fract(m + 0.5) - 0.5)) / max(dm, 1e-3);   // screen distance to the nearest key boundary
            float top = 0.1, bot = -0.45, mid = -0.12;
            float inY = step(bot, p.y) * step(p.y, top);
            vec3 kc = ramp(mod(key, 12.0) / 12.0 + uVarA * 0.2);
            if (blk){
              float bl = step(mid, p.y);
              col += inY * inK * (bl * (ramp(0.5) * 0.01 + kc * 0.9 * lit) + (1.0 - bl) * (ramp(0.5) * 0.13 + kc * 0.8 * lit));
            } else {
              col += inY * inK * (ramp(0.5) * 0.13 + kc * 0.8 * lit);
            }
            col *= 1.0 - 0.9 * glow(edge, 90000.0) * inY;
            // the membrane's envelope above the keys
            col += hue * smoothstep(0.0, 0.02, E * 0.3 - (p.y - 0.18)) * step(0.18, p.y) * 0.1 * inK;
            col += hue * glow(p.y - 0.18 - E * 0.3, 60000.0) * 0.6 * inK;
          } else {
            // the critical bands: the ERB-number scale, near-equal lengths of membrane
            float f = cfAt(x);
            float n = 21.4 * log(0.00437 * f + 1.0) / 2.302585;
            float ti = floor(n);
            float fc = (exp((ti + 0.5) / 21.4 * 2.302585) - 1.0) / 0.00437;
            float lv = ppow(clamp(SPEC(fc) * 1.3, 0.0, 1.0), 0.7);
            float inS = step(0.0, xs0) * step(xs0, 1.0);
            float h = -0.55 + 1.1 * lv;
            float bar = step(-0.55, p.y) * step(p.y, h);
            float gap = smoothstep(0.0, 0.08, abs(fract(n) - 0.5) - 0.0) * step(abs(fract(n) - 0.5), 0.42);
            vec3 bc = ramp(x * 0.8 + uVarA * 0.2);
            col += bc * bar * gap * (0.12 + 0.6 * smoothstep(-0.55, h + 0.001, p.y)) * inS;
            col += bc * glow(p.y - h, 40000.0) * gap * 0.8 * inS;
            col += ramp(0.5) * glow(p.y + 0.55, 300000.0) * 0.1 * inS;
            // and the membrane's motion along the top: the same places, moving
            col += hue * glow((p.y - 0.72) - Y0 / (1.0 + 0.5 * abs(Y0)) * 0.1, 60000.0) * (0.3 + E) * inS;
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
