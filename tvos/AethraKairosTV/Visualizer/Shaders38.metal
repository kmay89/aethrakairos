#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ESCAPEMENT — the tick.

   Kinematic clockwork, every part from one clock: the pendulum's angle
   A sin(πt) with a beat each second; per beat the escape wheel advances half
   a tooth (smoothstep over the impulse), the anchor recoiling it back near
   the ends of the swing, the deadbeat not. Wheels are SDFs with pitch
   circles that roll: ω₂ = −ω₁N₁/N₂, phases set so teeth mesh at the line of
   centres. The skeleton's train 64:8 and 60:8 (escape 60 turns per centre
   turn), motion work 12:1. Planetary: sun 18, planets 12, ring 42 fixed,
   carrier at 18/60 of the sun. Geneva, four slots: β = atan2(r sin α,
   d − r cos α) while the pin is engaged, locked otherwise. The balance swings
   270° on a hairspring whose coils are found per pixel from the twist
   θ(1 − φ/Φ) — they breathe; the lever toggles through ±12° with the
   impulse jewel; the tourbillon cage turns once a minute.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildEscapement() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_es: a self-contained translation unit.
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

namespace rm_es {

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

/* a gear (pitch radius R, N teeth, tooth phase ph, turned by ang) as a signed distance;
   inner = 1 for a ring gear (teeth inward, the band outside); spokes = 0 for a solid pinion */
/* a trapezoid (half-widths r1 at y = -he, r2 at y = +he) as a signed distance */
float sdTrap(vec2 p, float r1, float r2, float he){
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, p.y < 0.0 ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float gearSDF(vec2 q, float R, float N, float ph, float ang, float spokes, float inner){
  float m = 2.0 * R / N;
  float r = length(q);
  float a = atan2s(q.y, q.x) - ang;
  float da = (fract(a * N / (2.0 * PI) + ph) - 0.5) * 2.0 * PI / N;      // from the nearest tooth's centre line
  vec2 tq = vec2(r * sin(da), r * cos(da));
  if (inner > 0.5){
    float tooth = sdTrap(vec2(tq.x, (R + 0.125 * m) - tq.y), 0.95 * m, 0.45 * m, 1.125 * m);
    float band = max((R + 1.25 * m) - r, r - (R + 1.25 * m + 0.035));
    return min(tooth, band);
  }
  float tooth = sdTrap(vec2(tq.x, tq.y - (R - 0.125 * m)), 0.95 * m, 0.45 * m, 1.125 * m);
  float d = min(tooth, r - (R - 1.25 * m));
  if (spokes < 0.5) return d;
  float ri = R - 1.25 * m - max(0.03, R * 0.12);
  float band = max(d, ri - r);
  float sa = 2.0 * PI / spokes;
  float ak = a - sa * floor(a / sa + 0.5);
  float sp = max(abs(r * sin(ak)) - max(0.008, R * 0.04), r - ri - 0.005);
  sp = max(sp, -r * cos(ak));
  float hub = r - max(0.025, R * 0.13);
  return min(min(band, sp), hub);
}
/* an anchor escape wheel's ratchet teeth (or club teeth, club = 1) */
float escSDF(vec2 q, float R, float N, float ang, float club){
  float r = length(q);
  float a = atan2s(q.y, q.x) - ang;
  float t = fract(a * N / (2.0 * PI));
  float h = R * 0.13;
  float prof = club > 0.5 ? (smoothstep(0.0, 0.55, t) * (1.0 - smoothstep(0.75, 0.82, t))) : (t / 0.86 * (1.0 - smoothstep(0.86, 0.93, t)));
  float rp = R - h + h * prof;
  float f = sqrt(1.0 + sq(h * N / (2.0 * PI * 0.86 * R)) * 2.0);
  float d = (r - rp) / f;
  float ri = R - h - R * 0.1;
  float band = max(d, ri - r);
  float sa = 2.0 * PI / 4.0;
  float ak = a - sa * floor(a / sa + 0.5);
  float sp = max(max(abs(r * sin(ak)) - R * 0.035, r - ri - 0.005), -r * cos(ak));
  return min(min(band, sp), r - R * 0.12);
}
/* metal drawn as a lit outline with a faint fill */
vec3 brassy(float d, vec3 hue, float k){
  return hue * (0.09 * smoothstep(0.002, -0.002, d) + glow(d, k) * 0.75);
}
/* the escape wheel's angle after beat-time u (beats), advancing half a tooth a beat, with recoil rc */
float escAngle(float u, float N, float rc){
  float k = floor(u - 0.5);
  float v = fract(u - 0.5);
  float s = smoothstep(0.35, 0.6, v);
  float rec = v > 0.6 ? (v - 0.6) / 0.4 : (v < 0.35 ? 1.0 - v / 0.35 : 0.0);
  return -(k + s - rc * rec) * PI / N;
}

}  // namespace rm_es

fragment float4 room_escapement(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_es;
    float uAspect = max(U.aspect, 1e-4);
    vec2 p = (pos.xy / max(res, float2(1.0)) * 2.0 - 1.0) * float2(uAspect, -1.0);
    float uTime = U.time, uBass = U.bass, uMid = U.mid, uTreble = U.treble;
    float uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = U.calm;
    float uMode = floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float uShape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float uVarA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    // stateless: the web stretches its clock with the music; the TV keeps a steady one
    float uSimT = U.time * 0.8 + 0.25;
    vec4 uHand = float4(U.ghostX * uAspect, -U.ghostY, clamp(U.ghostStrength, 0.0, 1.0), 0.0);
#define ramp(t) chordRamp(U, (t))
#define SPEC(f) spectrum.read(uint2(uint(clamp(64.0 * log(max((f), 30.0) / 30.0) / log(14000.0 / 30.0), 0.0, 63.0)), 0)).r
    vec3 col = vec3(0.0);
    {
        float T = uSimT;
        vec3 brass = ramp(0.12 + uVarA * 0.2), steel = ramp(0.5 + uVarA * 0.2), jewel = ramp(0.85 + uVarA * 0.2);
        float tick = uBeat;
        if (uMode < 0.5){
          if (uShape < 1.5){
            // THE ANCHOR / THE DEADBEAT: escape wheel, anchor, pendulum
            bool dead = uShape > 0.5;
            p = p / 1.2 + vec2(0.0, 0.08);
            float A = 0.07;
            float th = A * sin(PI * T);
            vec2 P0 = vec2(0.0, 0.6);
            vec2 W = vec2(0.0, 0.24);
            float N = 30.0;
            float ew = escAngle(T, N, dead ? 0.0 : 0.18);
            col += brassy(escSDF(p - W, 0.25, N, ew, 0.0), brass, 30000.0);
            // the anchor, rocking with the pendulum
            vec2 q = rot(p - P0, -th);
            float da = 1e9;
            for (int s = 0; s < 2; s++){
              float sx = s == 0 ? -1.0 : 1.0;
              vec2 e1 = vec2(0.13 * sx, -0.05), e2 = vec2(0.205 * sx, -0.12), tip = vec2(0.178 * sx, -0.19);
              da = min(da, segd(q, vec2(0.0), e1));
              da = min(da, segd(q, e1, e2));
              if (dead){
                // the deadbeat's pallets: arcs about the pivot, then an impulse face
                float rr = length(tip);
                float aa = atan2s(q.y, q.x), a0 = atan2s(tip.y, tip.x);
                float span = 0.07;
                float dd = abs(length(q) - rr);
                float inA = step(abs(aa - (a0 + sx * span * 0.5)), span * 0.5);
                da = min(da, dd + (1.0 - inA) * 1e3);
                da = min(da, segd(q, e2, rot(tip, sx * span)));
              } else {
                da = min(da, segd(q, e2, tip));
              }
            }
            float dsh = length(q) - 0.025;
            col += steel * glow(da, 25000.0) * 0.9 + steel * glow(dsh, 30000.0) * 0.6 + steel * 0.08 * smoothstep(0.012, 0.0, da);
            // the pendulum: suspension, rod, crutch, bob
            vec2 dirp = vec2(sin(th), -cos(th));
            vec2 bob = P0 + dirp * 1.2;
            col += steel * glow(segd(p, P0 + vec2(0.0, 0.2), P0), 120000.0) * 0.5;
            col += steel * glow(segd(p, P0 + dirp * 0.05, bob), 60000.0) * 0.55;
            float db = length(p - bob) - 0.13;
            col += brassy(db, brass, 20000.0) + brass * 0.1 * smoothstep(0.0, -0.13, db) * (0.6 + 0.4 * p.x / 0.13);
            // the tick: a ring from the pallet that just caught
            float v = fract(T - 0.5);
            float age = (v - 0.6) * 1.0;
            vec2 ct = W + 0.25 * vec2(sin(mod(floor(T - 0.5), 2.0) < 0.5 ? -0.785 : 0.785), cos(0.785));
            col += jewel * glow(length(p - ct) - age * 0.6, 20000.0) * exp(-age * 5.0) * step(0.0, age) * (0.5 + tick);
          } else {
            // THE LONG-CASE: the hood, the dial, the trunk and its pendulum
            float A = 0.09;
            float th = A * sin(PI * T);
            vec2 C = vec2(0.0, 0.42);
            float Rd = 0.4;
            // the case
            vec2 hb = abs(p - vec2(0.0, 0.42)) - vec2(0.5, 0.5);
            float dHood = length(max(hb, vec2(0.0))) + min(max(hb.x, hb.y), 0.0) - 0.02;
            vec2 tb = abs(p - vec2(0.0, -0.7)) - vec2(0.3, 0.75);
            float dTrunk = length(max(tb, vec2(0.0))) + min(max(tb.x, tb.y), 0.0) - 0.02;
            col += brass * glow(min(abs(dHood), abs(dTrunk)), 40000.0) * 0.35;
            // the dial: chapter ring, minute track, hands
            float r = length(p - C);
            float a = atan2s(p.x - C.x, p.y - C.y);                 // clockwise from twelve
            col += brass * (glow(r - Rd, 40000.0) + glow(r - Rd * 0.72, 60000.0)) * 0.5 + brass * 0.04 * step(r, Rd);
            float m60 = abs(fract(a / (2.0 * PI) * 60.0 + 0.5) - 0.5) / 60.0 * 2.0 * PI * r;
            col += brass * glow(m60, 400000.0) * step(Rd * 0.9, r) * step(r, Rd * 0.97) * 0.6;
            float h12 = abs(fract(a / (2.0 * PI) * 12.0 + 0.5) - 0.5) / 12.0 * 2.0 * PI * r;
            col += brass * smoothstep(0.012, 0.004, h12) * step(Rd * 0.76, r) * step(r, Rd * 0.88) * 0.7;
            // time: one beat a second, from ten past ten
            float secs = floor(T) + smoothstep(0.0, 0.08, fract(T)) - 0.04 * sin(min(fract(T) / 0.15, 1.0) * PI);
            float tMin = 9.0 + T / 60.0;
            float tHr = 10.0 + tMin / 60.0;
            vec2 q = p - C;
            vec2 hd = vec2(sin(tHr / 12.0 * 2.0 * PI), cos(tHr / 12.0 * 2.0 * PI));
            vec2 md = vec2(sin(tMin / 60.0 * 2.0 * PI), cos(tMin / 60.0 * 2.0 * PI));
            col += steel * glow(segd(q, -hd * 0.04, hd * Rd * 0.5), 30000.0) * 0.9;
            col += steel * glow(segd(q, -md * 0.05, md * Rd * 0.8), 50000.0) * 0.9;
            // the seconds subdial
            vec2 Cs = C + vec2(0.0, Rd * 0.38);
            float rs = length(p - Cs);
            col += brass * glow(rs - Rd * 0.2, 60000.0) * 0.4;
            vec2 sd = vec2(sin(secs / 60.0 * 2.0 * PI), cos(secs / 60.0 * 2.0 * PI));
            col += jewel * glow(segd(p - Cs, -sd * 0.02, sd * Rd * 0.18), 90000.0) * (0.8 + tick);
            col += steel * glow(length(q) - 0.012, 40000.0);
            // the pendulum through the trunk's window
            vec2 P0 = vec2(0.0, -0.02);
            vec2 dirp = vec2(sin(th), -cos(th));
            vec2 bob = P0 + dirp * 1.12;
            col += steel * glow(segd(p, P0, bob), 60000.0) * 0.5;
            float db = length(p - bob) - 0.11;
            col += brassy(db, brass, 20000.0) + brass * 0.1 * smoothstep(0.0, -0.11, db);
            vec2 wb = abs(p - vec2(0.0, -0.95)) - vec2(0.22, 0.22);
            col += brass * glow(length(max(wb, vec2(0.0))) + min(max(wb.x, wb.y), 0.0), 60000.0) * 0.3;
          }
        } else if (uMode < 1.5){
          if (uShape < 0.5){
            // THE SKELETON: centre wheel 64 -> third pinion 8, third wheel 60 -> escape pinion 8, escape wheel 30
            float sc = 2.9;
            vec2 q = p / sc + vec2(-0.1, -0.03);
            float wc = -2.0 * PI * T / 120.0;                     // the centre arbor: an hour in two minutes
            vec2 Cc = vec2(-0.2, -0.12);
            float Rc = 0.192, Rp = 0.024, R3 = 0.18;
            float g1 = 0.35, g2 = 1.2;
            vec2 Cb = Cc + (Rc + Rp) * vec2(cos(g1), sin(g1));
            vec2 Ca = Cb + (R3 + Rp) * vec2(cos(g2), sin(g2));
            float w3 = -wc * 64.0 / 8.0;
            float we = -w3 * 60.0 / 8.0;
            float pc = 0.5 - g1 * 64.0 / (2.0 * PI);
            float pb = -(g1 + PI) * 8.0 / (2.0 * PI);
            float pb2 = 0.5 - g2 * 60.0 / (2.0 * PI);
            float pa = -(g2 + PI) * 8.0 / (2.0 * PI);
            float d1 = gearSDF(q - Cc, Rc, 64.0, pc, wc, 5.0, 0.0);
            float d2 = gearSDF(q - Cb, Rp, 8.0, pb, w3, 0.0, 0.0);
            float d3 = gearSDF(q - Cb, R3, 60.0, pb2, w3, 4.0, 0.0);
            float d4 = gearSDF(q - Ca, Rp, 8.0, pa, we, 0.0, 0.0);
            float d5 = escSDF(q - Ca, 0.11, 30.0, we, 0.0);
            col += brassy(d1 * sc, brass, 30000.0) + brassy(d3 * sc, ramp(0.2 + uVarA * 0.2), 30000.0) + brassy(d5 * sc, ramp(0.3 + uVarA * 0.2), 30000.0);
            col += brassy(d2 * sc, steel, 40000.0) + brassy(d4 * sc, steel, 40000.0);
            // the hands on the centre arbor (and the hour hand by the 12:1 motion work)
            vec2 qc = q - Cc;
            vec2 md = vec2(sin(-wc), cos(-wc)), hd = vec2(sin(-wc / 12.0 + 1.0), cos(-wc / 12.0 + 1.0));
            col += steel * glow(segd(qc, vec2(0.0), md * 0.27) * sc, 40000.0) * 0.9;
            col += steel * glow(segd(qc, vec2(0.0), hd * 0.17) * sc, 25000.0) * 0.9;
            col += brass * glow((length(qc) - 0.3) * sc, 30000.0) * 0.3;
            // the escape wheel's pulse
            col += jewel * glow(length(q - Ca) * sc - 0.02, 20000.0) * tick * 0.8;
          } else if (uShape < 1.5){
            // THE PLANETARY: sun 18, three planets 12, fixed ring 42
            p = p / 1.9;
            float Rs = 0.18, Rp = 0.12, Rr = 0.42;
            float ws = T * 0.6 * (1.0 + 0.3 * uEnergy);
            float wcar = ws * 18.0 / 60.0;
            float wp = wcar - (ws - wcar) * 18.0 / 12.0;
            col += brassy(gearSDF(p, Rs, 18.0, 0.5, ws, 0.0, 0.0), jewel, 30000.0);
            col += brassy(gearSDF(p, Rr, 42.0, 0.5, 0.0, 0.0, 1.0), brass, 30000.0);
            for (int j = 0; j < 3; j++){
              float cj = wcar + float(j) * 2.0 * PI / 3.0;
              vec2 Pj = (Rs + Rp) * vec2(cos(cj), sin(cj));
              col += brassy(gearSDF(p - Pj, Rp, 12.0, 0.0, wp, 3.0, 0.0), ramp(0.3 + float(j) * 0.15 + uVarA * 0.2), 30000.0);
              // the carrier's arm
              col += steel * glow(segd(p, vec2(0.0), Pj), 200000.0) * 0.25;
            }
            col += steel * glow(length(p) - (Rs + Rp), 300000.0) * 0.12;
          } else {
            // THE GENEVA: four slots, a pin, a lock
            p = p / 1.35;
            float dd = 0.62;
            float rpin = dd * sin(PI / 4.0);
            vec2 D = vec2(-dd * 0.5, 0.0), G = vec2(dd * 0.5, 0.0);
            float al = T * 1.1;
            float n = floor((al + PI) / (2.0 * PI));
            float ar = al - 2.0 * PI * n;
            ar = ar > PI ? ar - 2.0 * PI : ar;
            float be = abs(ar) < PI / 4.0 ? -(n * PI / 2.0 + PI / 4.0 + atan2s(rpin * sin(ar), dd - rpin * cos(ar))) : (ar >= PI / 4.0 ? -(n + 1.0) * PI / 2.0 : -n * PI / 2.0);
            // the wheel
            vec2 qw = rot(p - G, -be);
            float rw = length(qw);
            float Rw = dd * cos(PI / 4.0);
            float dW = rw - Rw;
            float aw = atan2s(qw.y, qw.x);
            float sl = PI / 2.0;
            float as = aw - PI / 4.0 - sl * floor((aw - PI / 4.0) / sl + 0.5);
            float dSlot = max(abs(rw * sin(as)) - 0.032, (dd - rpin - 0.03) - rw * cos(as));
            float al2 = aw - sl * floor(aw / sl + 0.5);
            vec2 lc = dd * vec2(cos(aw - al2), sin(aw - al2));
            float dLock = 0.27 - length(qw - lc);
            float dGen = max(max(dW, -dSlot), dLock);
            col += brassy(dGen, brass, 30000.0) + brassy(length(qw) - 0.03, steel, 40000.0);
            // the driver: its locking disc (cut away where the pin works) and the pin
            vec2 qd = p - D;
            vec2 pin = rpin * vec2(cos(al), sin(al));
            float dDisc = length(qd) - 0.25;
            float dCut = 0.2 - length(qd - 0.35 * vec2(cos(al), sin(al)));
            float dDrv = max(dDisc, dCut);
            col += brassy(dDrv, steel, 30000.0);
            col += brassy(segd(qd, vec2(0.0), pin) - 0.018, steel, 30000.0);
            col += brassy(length(qd - pin) - 0.03, jewel, 30000.0) + jewel * glow(length(qd - pin), 2000.0) * 0.2 * (0.5 + tick);
          }
        } else {
          // THE BALANCE: a watch's heart
          float f = 0.55;
          float Ab = 4.7;
          float thb = Ab * sin(2.0 * PI * f * T);
          float cage = uShape > 1.5 ? -2.0 * PI * T / 30.0 : 0.0;
          vec2 C0 = vec2(0.0, 0.0);
          float sc = uShape < 0.5 ? 1.0 : (uShape < 1.5 ? 1.0 : 0.82);
          vec2 q = rot(p - C0, -cage) / sc;
          vec2 Bc = uShape < 0.5 ? vec2(0.0) : vec2(0.0, 0.36);
          float Rb = uShape < 0.5 ? 0.62 : 0.3;
          // the balance wheel: rim, three arms, timing screws
          vec2 qb = rot(q - Bc, -thb);
          float rb = length(qb);
          float dRim = abs(rb - Rb) - Rb * 0.04;
          float ab = atan2s(qb.y, qb.x);
          float sa = 2.0 * PI / 3.0;
          float ak = ab - sa * floor(ab / sa + 0.5);
          float dArm = max(max(abs(rb * sin(ak)) - Rb * 0.03, rb - Rb), -rb * cos(ak));
          float s16 = 2.0 * PI / 16.0;
          float as = ab - s16 * floor(ab / s16 + 0.5);
          vec2 sp = (Rb * 1.07) * vec2(cos(ab - as), sin(ab - as));
          float dScr = length(qb - sp) - Rb * 0.035;
          float dBal = min(min(dRim, dArm), dScr);
          col += brassy(dBal * sc, brass, 25000.0);
          // the hairspring: coils found from the twist; they breathe as it winds
          float r0 = Rb * 0.12, r1 = Rb * (uShape < 0.5 ? 0.82 : 0.6);
          float turns = uShape < 0.5 ? 11.0 : 8.0;
          float c = (r1 - r0) / (2.0 * PI * turns);
          float Phi = 2.0 * PI * turns;
          vec2 qs = q - Bc;
          float rq = length(qs);
          if (rq > r0 && rq < r1){
            float ph = (rq - r0) / c;
            float aq = atan2s(qs.y, qs.x);
            float tw = thb * (1.0 - ph / Phi);
            float dlt = aq - ph - tw;
            dlt -= 2.0 * PI * floor(dlt / (2.0 * PI) + 0.5);
            float gs = abs(1.0 - thb / Phi);
            float dsp = c * abs(dlt) / max(gs, 0.2);
            col += steel * glow(dsp * sc, 300000.0) * 0.8;
          }
          // the stud where the spring's outer end is pinned, the collet at its heart
          col += jewel * glow(length(qs - vec2(r1, 0.0)) * sc, 30000.0) * 0.8;
          col += steel * glow((length(qb) - r0) * sc, 60000.0) * 0.6;
          if (uShape > 0.5){
            // the Swiss lever: the impulse jewel on the roller, the fork, the pallets, the club-toothed wheel
            vec2 jw = Bc + rot(vec2(0.0, -0.07), thb);
            col += jewel * glow(length(q - jw) * sc, 20000.0) * (1.0 + tick);
            float lam = 0.21 * clamp(thb / 0.35, -1.0, 1.0);
            vec2 Lp = vec2(0.0, 0.0);
            vec2 ql = rot(q - Lp, lam);
            float dl = segd(ql, vec2(0.0, -0.08), vec2(0.0, 0.25));
            dl = min(dl, segd(ql, vec2(0.0, 0.25), vec2(-0.035, 0.3)));
            dl = min(dl, segd(ql, vec2(0.0, 0.25), vec2(0.035, 0.3)));
            dl = min(dl, segd(ql, vec2(0.0, -0.08), vec2(-0.13, -0.13)));
            dl = min(dl, segd(ql, vec2(0.0, -0.08), vec2(0.13, -0.13)));
            col += steel * glow(dl * sc, 30000.0) * 0.9;
            col += jewel * (glow(length(ql - vec2(-0.13, -0.15)) * sc, 25000.0) + glow(length(ql - vec2(0.13, -0.15)) * sc, 25000.0));
            // the banking pins
            col += steel * (glow(length(q - vec2(-0.08, 0.2)) * sc, 30000.0) + glow(length(q - vec2(0.08, 0.2)) * sc, 30000.0)) * 0.6;
            // the escape wheel: a half tooth per beat
            vec2 Ec = vec2(0.0, -0.36);
            float N = 20.0;
            float ew = escAngle(2.0 * f * T + 0.5, N, 0.0);
            col += brassy(escSDF(q - Ec, 0.2, N, ew, 1.0) * sc, brass, 25000.0);
            if (uShape > 1.5){
              // the tourbillon: the cage, and the fixed fourth wheel its pinion rolls round
              float rc = length(q);
              float ac = atan2s(q.y, q.x);
              float s3 = 2.0 * PI / 3.0;
              float k3 = ac - s3 * floor(ac / s3 + 0.5);
              float dCage = min(abs(rc - 0.82) - 0.012, max(max(abs(rc * sin(k3)) - 0.012, rc - 0.82), -rc * cos(k3)));
              col += brassy(dCage * sc, steel, 30000.0);
              col += brassy(gearSDF(p, 1.0, 80.0, 0.0, 0.0, 0.0, 1.0), brass, 30000.0);
            }
          }
        }
    }
#undef ramp
#undef SPEC
    col += (hash21(pos.xy) - 0.5) * 0.006;
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
