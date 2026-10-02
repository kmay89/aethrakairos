#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: NAVE — builder owns everything between these fences ==== */
/* ================================================================
   NAVE — a slow flight down the inside of a pseudo-Kleinian limit set.

   Round portal arches and pierced shells stand along an endless aisle and
   recede into the void, lit by a lantern the camera carries. The space is
   the limit set of an unscaled box reflection and a conditional sphere
   inversion, iterated seven times:

       p <- 2 clamp(p, -C, C) - p          (reflect into the box of half-size C)
       k  = max(1 / |p|^2, 1);  p <- k p    (invert inside the unit sphere)

   closed with Knighty's distance max(|p.xy| - 0.9, |p.xy| |p.z| / |p|) / dr for
   the pierced shells, or (|p.xy| - 0.06) / dr after five folds for the hanging
   filigree (dr = the product of the inversions' magnifications).

   The field is exactly periodic (every step is odd or even per axis, so it is
   mirror-symmetric about every plane x = n C.x, and in y and z, and repeats
   every 2C). The aisle runs where the mirror planes y = C.y and z = C.z meet;
   the transepts cross it at the corner (C.x, C.y, C.z), the same point in
   every cell, so the camera is placed RELATIVE to the crossing it last passed
   and never travels further than one bay from the origin: the flight is as
   precise in the tenth hour as in the first minute.

   The flight is closed-form in musical time — one bay every NV_TW seconds. On
   THE AISLE every crossing is passed straight through; on THE CROSSINGS the
   heading of bay k is floor(0.618k) - floor(0.236k) (mod 4), a two-rate
   Kronecker sequence that never repeats, and each turn is a quarter-circle
   fillet through the crossing. The box half-size C drifts a few hundredths on
   three slow incommensurate clocks, so no bay is ever seen twice.

   The light: a lantern held out up and to the left of the eye, its colour
   walking from its own chord voice to the next down the nave; a high
   clerestory light in the next voice on what faces up; rims in the third
   voice from a WIDE normal, so they trace the arches and never the bubbles;
   one normal-offset occlusion tap. Light is gone well before the march ends,
   and a ray that slips through a crack between two tangent shells is shaded
   where it came closest.

   The music: the BEAT (onsetEnv) is the lantern flaring, never the geometry;
   BASS lets the lantern reach further; ENERGY sets how deep the light goes;
   TREBLE lights the rims; MID rolls the high light along the chord.

   Faces, dealt exactly as the web's roll() deals them: roll0 the distance
   (PIERCED SHELLS / HANGING FILIGREE), roll1 the path (THE AISLE / THE
   CROSSINGS), roll2 the lantern (which chord voice it carries: I / II / III).

   PROVENANCE: the pseudo-Kleinian limit set, after Knighty ("pseudo-Kleinian"
   thread, fractalforums.com, 2011), who built it from Theli-at's "scale-1 Julia
   box plus something": an unscaled box fold followed by a conditional sphere
   inversion, with Knighty's closing distance. Written from that published
   maths and our own derivation (the 2C periodicity, the crossing lattice, the
   Kronecker flight); clean-room prototype research/fractal-study/shaders/
   kleinian.frag. No code copied.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildNave() carry the same
   lines. Laws as ever: void ground, chord-only colour, govern() at the exit,
   roll0..2 the dice, every loop bounded by a compile-time literal (the march
   is capped at 96 steps here, 110 on the web). All helpers live in namespace
   rm_nv: a self-contained translation unit. Heavy.
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

namespace rm_nv {

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

constant float NV_TW   = 24.0;          // seconds of musical time per bay (crossing to crossing)
constant float NV_R    = 0.42;          // the radius of a turn through a crossing
constant float NV_TMAX = 6.5;           // the march gives up here; the light is gone well before
constant float NV_PX   = 1.0 / 1080.0;  // one pixel of a 1080-line frame: the level of detail
                                        // is fixed, so every screen resolves the same stone

/* a chord voice as LIGHT: the same hue, brought to full strength, so an olive
   or a deep blue chord lights the nave as well as a pink one does */
vec3 nvTone(vec3 c){ return c / max(max(c.r, c.g), max(c.b, 0.04)); }

vec3 nvUnit(vec3 v){ return v / max(length(v), 1e-8); }

/* the chord, walked the way the web's ramp walks it. chordRamp blends two
   voices in RGB, which greys the middle of a complementary pair; the web's
   ramp is an OKLCH gradient and never does. This keeps the blend's hue and
   restores the chroma the endpoints carry, so the lantern's walk from one
   voice to the next stays a colour on the TV as well. */
vec3 nvVoice(constant VizUniforms& U, float t){
  float x = fract(t) * 3.0;
  vec3 vA = U.colA.rgb, vB = U.colB.rgb, vC = U.colC.rgb;   // into thread space before choosing
  vec3 a = x < 1.0 ? vA : (x < 2.0 ? vB : vC);
  vec3 b = x < 1.0 ? vB : (x < 2.0 ? vC : vA);
  float f = x - floor(x);
  vec3 c = mix(a, b, f);
  float ca = max(a.r, max(a.g, a.b)) - min(a.r, min(a.g, a.b));
  float cb = max(b.r, max(b.g, b.b)) - min(b.r, min(b.g, b.b));
  float cc = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = vec3(lum) + (c - vec3(lum)) * (mix(ca, cb, f) / max(cc, 1e-3));
  return clamp(c, vec3(0.0), vec3(1.0));
}

/* the box half-size, drifting a few hundredths on three slow clocks */
vec3 nvBox(float T){
  return vec3(0.92436 + 0.026 * sin(T * 0.0131),
              0.90756 + 0.022 * sin(T * 0.0097 + 1.3),
              0.92436 + 0.026 * sin(T * 0.0113 + 2.1));
}

/* the limit set's distance; dr = how much the inversions have magnified */
float nvDE(vec3 p, vec3 C, float face, INOUT(float, dr)){
  p = mod(p + C, 2.0 * C) - C;                   // the field repeats every 2C, exactly
  dr = 1.0;
  for (int i = 0; i < 7; i++){
    if (face > 0.5 && i >= 5) break;             // the filigree closes after five
    p = 2.0 * clamp(p, -C, C) - p;               // box reflection, scale 1
    float r2 = dot(p, p);
    float k = max(1.0 / max(r2, 1e-8), 1.0);     // sphere inversion inside the unit sphere
    p *= k; dr *= k;
  }
  float rxy = length(p.xy);
  if (face < 0.5) return 0.6 * max(rxy - 0.9, abs(rxy * p.z) / max(length(p), 1e-8)) / dr;
  return 0.6 * (rxy - 0.06) / dr;
}
float nvD(vec3 p, vec3 C, float face){ float q = 1.0; return nvDE(p, C, face, q); }

/* the heading of bay k: 0..3 = +x, +y, -x, -y */
float nvHead(float k, float turning){
  if (turning < 0.5) return 0.0;
  float h = floor(k * 0.6180340) - floor(k * 0.2360680);
  return h - 4.0 * floor(h / 4.0);
}
vec3 nvDir(float h){
  if (h < 0.5) return vec3(1.0, 0.0, 0.0);
  if (h < 1.5) return vec3(0.0, 1.0, 0.0);
  if (h < 2.5) return vec3(-1.0, 0.0, 0.0);
  return vec3(0.0, -1.0, 0.0);
}
float nvHalfBay(float h, vec3 C){ return (h < 0.5 || (h > 1.5 && h < 2.5)) ? C.x : C.y; }

/* the flight: where the lantern is and where it looks, at musical time T.
   Bay k runs from the middle of one aisle, through crossing k, to the
   middle of the next; the middle of an aisle is the same place seen from
   either end (one period apart), so consecutive bays join seamlessly. */
void nvFlight(float T, vec3 C, float turning, INOUT(vec3, ro), INOUT(vec3, fw)){
  float k = floor(T / NV_TW);
  float u = T / NV_TW - k;
  float ha = nvHead(k, turning), hb = nvHead(k + 1.0, turning);
  vec3 da = nvDir(ha), db = nvDir(hb);
  float La = nvHalfBay(ha, C), Lb = nvHalfBay(hb, C);
  float R = NV_R * step(0.5, abs(ha - hb));     // a quarter turn whenever the heading changes
  float s1 = La - R, s2 = s1 + 1.5707963 * R;
  float s = u * (s2 + Lb - R);
  vec3 O = C;                                    // the crossing: three mirror planes meet here
  vec3 pos = O;
  if (s < s1) pos = O - (La - s) * da;
  else if (s < s2){
    float th = (s - s1) / max(R, 1e-4);
    pos = O + R * (db - da) + R * (da * sin(th) - db * cos(th));
  } else pos = O + (R + s - s2) * db;
  // the gaze turns a little before the feet and settles a little after
  vec3 head = nvUnit(mix(da, db, smoothstep(s1 - 0.3, s2 + 0.3, s)));
  vec3 side = vec3(-head.y, head.x, 0.0);
  float lat = 0.065 * sin(T * 0.107) + 0.035 * sin(T * 0.043 + 2.0);
  float alt = 0.10 * sin(T * 0.029 + 1.0) + 0.045 * sin(T * 0.081 + 0.4);
  ro = pos + side * lat + vec3(0.0, 0.0, alt);
  float yaw = 0.24 * sin(T * 0.047) + 0.07 * sin(T * 0.13 + 1.0);
  float pit = 0.12 * sin(T * 0.037 + 0.5) - 0.7 * alt;    // low in the aisle, it looks up into the vault
  float cy = cos(yaw), sy = sin(yaw);
  vec2 hf = vec2(head.x * cy - head.y * sy, head.x * sy + head.y * cy);
  fw = nvUnit(vec3(hf * cos(pit), sin(pit)));
}

}  // namespace rm_nv

fragment float4 room_nave(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_nv;
    float uAspect = max(U.aspect, 1e-4);
    // the same rays the web builds from vUv: y up, half a unit either side
    vec2 uv = (pos.xy / max(res, float2(1.0)) - 0.5) * float2(uAspect, -1.0);
    float uBass = U.bass, uMid = U.mid, uTreble = U.treble, uEnergy = U.energy;
    float uBeat = U.onsetEnv;
    // the dice, dealt as the web's roll() deals them
    float uFace = U.roll0 < 0.5 ? 0.0 : 1.0;
    float uPath = U.roll1 < 0.5 ? 0.0 : 1.0;
    float uRoute = floor(clamp(U.roll2 * 3.0, 0.0, 2.999));
    // the web enters at a fresh bay on every roll; the TV takes its bay from the dice
    float uT0 = floor(fract(U.roll2 * 7.31 + U.roll1 * 3.17) * 40.0) * NV_TW;
#define ramp(t) nvVoice(U, (t))
    vec3 col = vec3(0.0);
    {
      float T = U.time + uT0;
      vec3 C = nvBox(T);
      vec3 ro = vec3(0.0), fw = vec3(1.0, 0.0, 0.0);
      nvFlight(T, C, uPath, ro, fw);
      vec3 rt = nvUnit(cross(fw, vec3(0.0, 0.0, 1.0)));
      vec3 up = cross(rt, fw);
      vec3 rd = nvUnit(fw + uv.x * rt + uv.y * up);

      // THE MARCH. The hit radius is a pixel and a half of a 1080-line frame at
      // every depth (widening it with distance erodes the far portholes into
      // saw-teeth); where the far rays run out of steps the light has gone.
      float t = 0.0, d = 1.0, dr = 1.0, steps = 0.0;
      float best = 1e9, bestT = 0.0, bestDr = 1.0;  // the ray's closest approach, in radians
      bool hit = false;
      for (int i = 0; i < 96; i++){
        d = nvDE(ro + rd * t, C, uFace, dr);
        steps = float(i);
        float r = d / max(t, 1e-3);
        if (r < 1.5 * NV_PX){ hit = true; break; }
        if (r < best && t > 0.02){ best = r; bestT = t; bestDr = dr; }
        t += d;
        if (t > NV_TMAX) break;
      }
      // a ray that crept along a crease and ran out of steps, or slipped through
      // a crack between two tangent shells: shade it where it came closest
      if (!hit && best < 4.0 * NV_PX){ hit = true; t = bestT; dr = bestDr; }

      if (hit){
        vec3 p = ro + rd * t;
        float h = 5.0 * NV_PX * t;                  // the shading normal, at the pixel's own footprint
        vec2 e = vec2(1.0, -1.0) * h;
        vec3 n = nvUnit(e.xyy * nvD(p + e.xyy, C, uFace) + e.yyx * nvD(p + e.yyx, C, uFace)
                      + e.yxy * nvD(p + e.yxy, C, uFace) + e.xxx * nvD(p + e.xxx, C, uFace));
        if (dot(n, rd) > 0.0) n = -n;
        // the RIM normal, taken wide: it sees the shells and arches and not the
        // bubbles pitting them, so the rims trace the big forms and never stipple
        float hw = 0.018 + 6.0 * NV_PX * t;
        vec2 ew = vec2(1.0, -1.0) * hw;
        vec3 nw = nvUnit(ew.xyy * nvD(p + ew.xyy, C, uFace) + ew.yyx * nvD(p + ew.yyx, C, uFace)
                       + ew.yxy * nvD(p + ew.yxy, C, uFace) + ew.xxx * nvD(p + ew.xxx, C, uFace));
        if (dot(nw, rd) > 0.0) nw = -nw;
        // one normal-offset tap of occlusion: open stone reads 1, the throat of a porthole less
        float occ = clamp(nvD(p + n * 0.07, C, uFace) / 0.042, 0.0, 1.0);
        n = nvUnit(n + 3.0 * nw);                   // shade on the forms; the pits read through the occlusion
        float ndvw = max(dot(nw, -rd), 0.0);

        // THE LANTERN, held out up and to the left of the eye, so the near piers
        // are modelled rather than flat-lit
        vec3 lv = ro - 0.16 * rt + 0.12 * up - p;
        float ld = max(length(lv), 1e-3);
        vec3 l = lv / ld;
        float swell = clamp(uBeat, 0.0, 1.2);       // the beat is the lantern flaring
        float reach = max(0.50 - 0.22 * uBass - 0.10 * swell, 0.12);
        // the filigree is thread, mostly in its own shadow: its lantern burns a little brighter
        float lampG = (1.3 + 0.45 * uBass + 0.55 * swell) * (1.0 + 0.3 * uFace) / (1.0 + reach * ld * ld);
        float ndl = max(dot(n, l), 0.0);
        float diff = (0.06 + 0.94 * ndl) * lampG;
        float spec = pow(max(dot(n, nvUnit(l - rd)), 1e-6), 24.0) * lampG;
        float sky = 0.5 + 0.5 * nw.z;                // the clerestory: what faces up catches the high light
        sky *= sky;
        float fr = pow(max(1.0 - ndvw, 1e-6), 3.0) * smoothstep(0.15, 0.6, occ) * (1.0 - 0.7 * smoothstep(1.2, 4.0, t));
        // depth: light gives out with distance, and is gone before the march stops
        float depth = exp(-mix(0.52, 0.32, uEnergy) * t)
                    * (1.0 - smoothstep(0.55 * NV_TMAX, 0.96 * NV_TMAX, t))
        // ...and where the step budget runs out in the far nave, the light has already gone
                    * (1.0 - smoothstep(0.6, 1.0, steps / 96.0) * smoothstep(1.5, 3.5, t));

        float x0 = uRoute / 3.0;
        // the lantern's voice of the chord, walking to the next voice down the nave
        vec3 lantern = nvTone(ramp(x0 + 0.3333 * smoothstep(0.7, 3.2, ld)));
        vec3 skyC = nvTone(ramp(x0 + 0.3333 + 0.06 * uMid));                   // the high light, a voice along
        vec3 rim = nvTone(ramp(x0 + 0.6667));                                  // the rims, the third voice
        col = lantern * diff * (0.25 + 0.75 * occ) * 2.1;
        col += skyC * sky * occ * 0.3 * exp(-0.3 * t);
        col += rim * fr * (0.35 + 0.9 * uTreble + 0.3 * swell) * 1.1;
        col += mix(lantern, nvTone(ramp(0.6667)), 0.6) * spec * occ * 1.2;      // the gloss, in the chord's pale voice
        col *= depth * (0.9 + 0.3 * uEnergy);
      }
    }
#undef ramp
    col += (hash21(pos.xy) - 0.5) * (1.5 / 255.0);          // dither the dim fade before the governor
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: NAVE ==== */
