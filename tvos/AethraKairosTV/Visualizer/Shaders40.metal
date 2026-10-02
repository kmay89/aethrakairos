#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: NAVE — builder owns everything between these fences ==== */
/* ================================================================
   NAVE — a slow flight down the inside of a pseudo-Kleinian limit set.

   Round portal arches and pierced shells stand along an endless aisle and
   recede into the void. The space is the limit set of an unscaled box
   reflection and a conditional sphere inversion:

       p <- 2 clamp(p, -C, C) - p          (reflect into the box of half-size C)
       k  = max(1 / |p|^2, 1);  p <- k p    (invert inside the unit sphere)

   closed with Knighty's distance max(|p.xy| - 0.9, |p.xy| |p.z| / |p|) / dr
   after seven folds for the pierced shells, or (|p.xy| - 0.08) / dr after
   five for the hanging filigree (dr = the product of the inversions'
   magnifications).

   The field is exactly periodic (every step is odd or even per axis, so it is
   mirror-symmetric about every plane x = n C.x, and in y and z, and repeats
   every 2C). The aisle runs where the mirror planes y = C.y and z = C.z meet;
   the transepts cross it at the corner (C.x, C.y, C.z), the same point in
   every cell, and a well rises through every crossing along z. The camera is
   placed RELATIVE to the crossing it last passed and never travels further
   than one bay from the origin: the flight is as precise in the tenth hour as
   in the first minute.

   The box is NOT a cube: C.y sits well below C.x, so the aisles along x are
   tall and narrow and the transepts along y are round — a turn arrives in a
   different nave — and all three half-sizes drift by +-0.05 on clocks of
   about two minutes, so the arches visibly change shape within a visit.

   The flight is closed-form in musical time — one bay every NV_TW seconds of
   a bay clock that itself breathes between 0.7x and 1.3x over a hundred
   seconds, so the piers never pass on a metronome. On THE AISLE the gaze
   stays down the nave through every crossing; on THE CROSSINGS the heading of
   bay k is floor(0.618k) - floor(0.236k) (mod 4), a two-rate Kronecker
   sequence that never repeats, each turn a banked quarter-circle fillet
   through the crossing — and where the path goes straight over, the gaze is
   drawn up the well. Height sways +-0.25 with the pitch, so vault and floor
   both come into frame.

   The light — three rigs, the third die:
     LANTERN IN HAND  a lantern held up and to the left of the eye: a pool of
                      light that models the near piers, its colour walking
                      from its own chord voice to the next with distance;
     LANTERN AHEAD    the lantern carried by someone walking eleven seconds
                      ahead on the same path, seen as a glowing point: the
                      near piers stand dark against it, rimmed in its light;
     VOTIVE LIGHTS    only a faint lantern at the eye, and every hollow of
                      the stone burning with its own light — low in the
                      chord's first voice, high in its second.
   A high fill in the next voice on what faces up; rims in the third voice
   from a WIDE normal, so they trace the arches and never the bubbles, and
   only beyond arm's length; a two-tap occlusion. Every voice is walked from
   the three chord swatches in OKLCH, the same arithmetic on both stages.
   Light is gone well before the march ends; a ray that slips past a crack is
   shaded where it came closest, weighted by how close it came, so
   silhouettes are feathered and the piers never tear.

   The music: the BEAT (onsetEnv) is the light flaring, never the geometry;
   BASS lets it reach further; ENERGY sets how deep the light goes; TREBLE
   lights the rims; MID rolls the high fill along the chord.

   Faces, dealt exactly as the web's roll() deals them: roll0 the distance
   (PIERCED SHELLS / HANGING FILIGREE), roll1 the path (THE AISLE / THE
   CROSSINGS), roll2 the rig (LANTERN IN HAND / LANTERN AHEAD / VOTIVE LIGHTS).

   PROVENANCE: the pseudo-Kleinian limit set, after Knighty ("pseudo-Kleinian"
   thread, fractalforums.com, 2011), who built it from Theli-at's "scale-1 Julia
   box plus something": an unscaled box fold followed by a conditional sphere
   inversion, with Knighty's closing distance. OKLab after Bjorn Ottosson ("A
   perceptual color space for image processing", 2020, published matrices).
   Written from that published maths and our own derivation (the 2C
   periodicity, the crossing lattice, the Kronecker flight); clean-room
   prototype research/fractal-study/shaders/kleinian.frag. No code copied.

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

// the house dialect: GLSL's words for Metal's types
#define vec2 float2
#define vec3 float3
#define vec4 float4
#define mod(a, b) ((a) - (b) * floor((a) / (b)))
#define INOUT(T, n) thread T& n
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// GLSL's two-argument atan; never asked for the angle of a zero vector
float nvAtan(float y, float x){ return atan2(y, abs(x) < 1e-7 ? 1e-7 : x); }

constant float NV_TW   = 24.0;          // seconds of the bay clock per bay (crossing to crossing)
constant float NV_R    = 0.42;          // the radius of a turn through a crossing
constant float NV_TMAX = 6.5;           // the light is gone by 0.96 of this; the march stops there
constant float NV_PX   = 1.0 / 1080.0;  // one pixel of a 1080-line frame: the level of detail
                                        // is fixed, so every screen resolves the same stone
constant float NV_LEAD = 11.0;         // LANTERN AHEAD: how far ahead the bearer walks, in seconds

/* a chord voice as LIGHT: the same hue, brought to full strength, so an olive
   or a deep blue chord lights the nave as well as a pink one does */
vec3 nvTone(vec3 c){ return c / max(max(c.r, c.g), max(c.b, 0.2)); }

vec3 nvUnit(vec3 v){ return v / max(length(v), 1e-8); }

/* THE CHORD, WALKED. The three swatches into OKLCH (Ottosson's OKLab, in
   polar form), so a voice can pass into the next along the shorter arc of
   hue with its lightness and chroma carried through, never through grey —
   the same walk the colour engine's own ramp takes, done from the swatches
   themselves so both stages walk the same chord exactly. */
vec3 nvLCH(vec3 c){
  vec3 l = mix(c / 12.92, pow(max((c + 0.055) / 1.055, vec3(1e-6)), vec3(2.4)), step(vec3(0.04045), c));
  vec3 m = vec3(0.4122214708 * l.r + 0.5363325363 * l.g + 0.0514459929 * l.b,
                0.2119034982 * l.r + 0.6806995451 * l.g + 0.1073969566 * l.b,
                0.0883024619 * l.r + 0.2817188376 * l.g + 0.6299787005 * l.b);
  m = pow(max(m, vec3(1e-9)), vec3(1.0 / 3.0));
  float L = 0.2104542553 * m.x + 0.7936177850 * m.y - 0.0040720468 * m.z;
  float a = 1.9779984951 * m.x - 2.4285922050 * m.y + 0.4505937099 * m.z;
  float b = 0.0259040371 * m.x + 0.7827717662 * m.y - 0.8086757660 * m.z;
  return vec3(L, length(vec2(a, b)), nvAtan(b, a));
}
vec3 nvRGB(vec3 q){
  float a = q.y * cos(q.z), b = q.y * sin(q.z);
  vec3 m = vec3(q.x + 0.3963377774 * a + 0.2158037573 * b,
                q.x - 0.1055613458 * a - 0.0638541728 * b,
                q.x - 0.0894841775 * a - 1.2914855480 * b);
  m = m * m * m;
  vec3 l = vec3( 4.0767416621 * m.x - 3.3077115913 * m.y + 0.2309699292 * m.z,
                -1.2684380046 * m.x + 2.6097574011 * m.y - 0.3413193965 * m.z,
                -0.0041960863 * m.x - 0.7034186147 * m.y + 1.7076147010 * m.z);
  l = clamp(l, vec3(0.0), vec3(1.0));
  return mix(12.92 * l, 1.055 * pow(max(l, vec3(1e-6)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), l));
}
/* how far a voice sits in the amber-to-olive band, where dim light reads as mud */
float nvWarm(vec3 q){
  float hd = q.z * 57.29578;
  return smoothstep(35.0, 55.0, hd) * (1.0 - smoothstep(115.0, 135.0, hd)) * smoothstep(0.03, 0.08, q.y);
}
/* x in voices: 0 = A, 1 = B, 2 = C, cyclic; between two voices, the shorter arc */
vec3 nvWalk(vec3 q0, vec3 q1, vec3 q2, float x){
  x = x - 3.0 * floor(x / 3.0);
  vec3 a = x < 1.0 ? q0 : (x < 2.0 ? q1 : q2);
  vec3 b = x < 1.0 ? q1 : (x < 2.0 ? q2 : q0);
  float f = x - floor(x);
  float dh = b.z - a.z;
  dh = dh - 6.2831853 * floor((dh + 3.1415927) / 6.2831853);
  return nvRGB(vec3(mix(a.x, b.x, f), mix(a.y, b.y, f), a.z + dh * f));
}

/* the box half-size: not a cube (the aisles along x tall and narrow, the
   transepts along y round), drifting +-0.05 on three clocks of about two minutes */
vec3 nvBox(float T){
  return vec3(0.920 + 0.050 * sin(T * 0.0459),
              0.855 + 0.045 * sin(T * 0.0361 + 1.3),
              0.920 + 0.050 * sin(T * 0.0571 + 2.1));
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
  return 0.6 * (rxy - 0.08) / dr;
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

/* the flight: where the eye is, where it looks and how it banks, at musical
   time T; k is the bay. Bay k runs from the middle of one aisle, through
   crossing k, to the middle of the next; the middle of an aisle is the same
   place seen from either end (one period apart), so consecutive bays join
   seamlessly. The bay clock breathes (0.7x..1.3x over ~100 s) and never runs
   backwards. */
void nvFlight(float T, vec3 C, float turning, INOUT(vec3, ro), INOUT(vec3, fw), INOUT(float, roll), INOUT(float, k)){
  float Tb = T + 4.7 * sin(T * 0.0628);
  k = floor(Tb / NV_TW);
  float u = Tb / NV_TW - k;
  float ha = nvHead(k, turning), hb = nvHead(k + 1.0, turning);
  vec3 da = nvDir(ha), db = nvDir(hb);
  float La = nvHalfBay(ha, C), Lb = nvHalfBay(hb, C);
  float turn = step(0.5, abs(ha - hb));
  float R = NV_R * turn;                         // a quarter turn whenever the heading changes
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
  float lat = 0.08 * sin(T * 0.107) + 0.045 * sin(T * 0.043 + 2.0);
  float alt = 0.17 * sin(T * 0.029 + 1.0) + 0.08 * sin(T * 0.081 + 0.4);
  ro = pos + side * lat + vec3(0.0, 0.0, alt);
  // straight over a crossing on THE CROSSINGS, the gaze is drawn up the well
  float wl = (s - La) / 0.42;
  float well = turning * (1.0 - turn) * exp(-wl * wl);
  float yaw = (0.24 * sin(T * 0.047) + 0.07 * sin(T * 0.13 + 1.0)) * (1.0 - 0.6 * well);
  float pit = 0.12 * sin(T * 0.037 + 0.5) - 0.7 * alt + 0.95 * well;   // low in the aisle, it looks up into the vault
  float cy = cos(yaw), sy = sin(yaw);
  vec2 hf = vec2(head.x * cy - head.y * sy, head.x * sy + head.y * cy);
  fw = nvUnit(vec3(hf * cos(pit), sin(pit)));
  // a turn is banked into, and out of
  roll = (da.x * db.y - da.y * db.x) * 0.16 * smoothstep(s1 - 0.45, s1 + 0.15, s) * (1.0 - smoothstep(s2 - 0.15, s2 + 0.45, s));
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
    vec3 uColA = U.colA.rgb, uColB = U.colB.rgb, uColC = U.colC.rgb;
    // the dice, dealt as the web's roll() deals them
    float uFace = U.roll0 < 0.5 ? 0.0 : 1.0;
    float uPath = U.roll1 < 0.5 ? 0.0 : 1.0;
    float uRoute = floor(clamp(U.roll2 * 3.0, 0.0, 2.999));
    // the web enters at a fresh bay on every roll; the TV takes its bay from the dice
    float uT0 = floor(fract(U.roll2 * 7.31 + U.roll1 * 3.17) * 40.0) * NV_TW;
    vec3 col = vec3(0.0);
    {
      float T = U.time + uT0;
      vec3 C = nvBox(T);
      vec3 ro = vec3(0.0), fw = vec3(1.0, 0.0, 0.0);
      float roll = 0.0, bay = 0.0;
      nvFlight(T, C, uPath, ro, fw, roll, bay);
      vec3 rt0 = nvUnit(cross(fw, vec3(0.0, 0.0, 1.0)));
      vec3 up0 = cross(rt0, fw);
      vec3 rt = rt0 * cos(roll) + up0 * sin(roll);
      vec3 up = up0 * cos(roll) - rt0 * sin(roll);
      vec3 rd = nvUnit(fw + uv.x * rt + uv.y * up);

      // THE MARCH. For the shells the hit radius is a pixel and a half of a
      // 1080-line frame at every depth (widening it with distance erodes the far
      // portholes into saw-teeth); the filigree, with no portholes at that scale,
      // lets its far thread thicken to six pixels so the lace does not sparkle.
      // Past 0.96 NV_TMAX the light is gone, so the march stops.
      float t = 0.0, d = 1.0, dr = 1.0, steps = 0.0;
      float best = 1e9, bestT = 0.0, bestDr = 1.0;  // the ray's closest approach, in radians
      bool hit = false, gone = false;
      for (int i = 0; i < 96; i++){
        d = nvDE(ro + rd * t, C, uFace, dr);
        steps = float(i);
        float r = d / max(t, 1e-3);
        if (r < (1.5 + 4.5 * uFace * smoothstep(0.3, 2.0, t)) * NV_PX){ hit = true; break; }
        if (r < best && t > 0.02){ best = r; bestT = t; bestDr = dr; }
        t += d;
        if (t > 0.96 * NV_TMAX){ gone = true; break; }
      }
      // a ray that slipped past a crack between two tangent shells, or along a
      // silhouette: shade it where it came closest, weighted by how close it
      // came, so the edges feather instead of fraying. A ray that spent its
      // budget creeping down the throat of a porthole is on stone: shade it there.
      float cov = 1.0;
      if (!hit && !gone){ hit = true; }
      else if (!hit && best < 6.0 * NV_PX){
        hit = true; t = bestT; dr = bestDr;
        cov = 1.0 - smoothstep(1.5 * NV_PX, 6.0 * NV_PX, best);
      }

      // the chord, as three voices in OKLCH; each rig carries its own voice
      vec3 q0 = nvLCH(uColA), q1 = nvLCH(uColB), q2 = nvLCH(uColC);
      // (the votives burn in the chord's two chromatic voices, A and B)
      float x0 = uRoute < 1.5 ? uRoute : 0.0;
      float warmA = nvWarm(x0 < 0.5 ? q0 : q1), warmB = nvWarm(x0 < 0.5 ? q1 : q2);
      vec3 lampA = nvTone(nvWalk(q0, q1, q2, x0)), lampB = nvTone(nvWalk(q0, q1, q2, x0 + 1.0));
      float swell = clamp(uBeat, 0.0, 1.2);         // the beat is the light flaring
      // dim amber and olive read as mud: where the light is a warm voice it goes sooner
      float kd0 = mix(0.44, 0.30, uEnergy);
      float kd = kd0 + 0.16 * warmA * (0.4 + 0.6 * uEnergy);
      // LANTERN AHEAD: the bearer walks NV_LEAD seconds further along the same
      // path (moved back into this bay's frame once past the next crossing)
      vec3 bearer = ro;
      if (uRoute > 0.5 && uRoute < 1.5){
        vec3 lf = vec3(1.0, 0.0, 0.0);
        float lr = 0.0, lk = 0.0;
        nvFlight(T + NV_LEAD, C, uPath, bearer, lf, lr, lk);
        float hn = nvHead(bay + 1.0, uPath);
        if (lk > bay + 0.5) bearer += 2.0 * nvHalfBay(hn, C) * nvDir(hn);
        bearer += vec3(0.0, 0.0, 0.06);
      }
      float tEnd = hit ? t : 0.96 * NV_TMAX;

      if (hit){
        vec3 p = ro + rd * t;
        float h = 5.0 * NV_PX * t;                  // the shading normal, at the pixel's own footprint
        vec2 e = vec2(1.0, -1.0) * h;
        vec3 n = nvUnit(e.xyy * nvD(p + e.xyy, C, uFace) + e.yyx * nvD(p + e.yyx, C, uFace)
                      + e.yxy * nvD(p + e.yxy, C, uFace) + e.xxx * nvD(p + e.xxx, C, uFace));
        if (dot(n, rd) > 0.0) n = -n;
        // the RIM normal, taken wide: it sees the shells and arches and not the
        // bubbles pitting them, so the rims trace the big forms and never stipple
        float hw = 0.05 + 8.0 * NV_PX * t;
        vec2 ew = vec2(1.0, -1.0) * hw;
        vec3 nw = nvUnit(ew.xyy * nvD(p + ew.xyy, C, uFace) + ew.yyx * nvD(p + ew.yyx, C, uFace)
                       + ew.yxy * nvD(p + ew.yxy, C, uFace) + ew.xxx * nvD(p + ew.xxx, C, uFace));
        if (dot(nw, rd) > 0.0) nw = -nw;
        // shade on the forms; the pits read through the occlusion. The filigree,
        // all thread, leans harder on the wide normal so its lace does not sparkle
        float agree = smoothstep(0.3, 0.8, dot(n, nw));   // a rim only where the fine form agrees with the wide one
        n = nvUnit(n + (3.0 + 5.0 * uFace) * nw);
        // two normal-offset taps of occlusion: open stone reads 1, the throat of a porthole less
        float occ = clamp(0.5 * nvD(p + n * 0.04, C, uFace) / 0.024 + 0.5 * nvD(p + n * 0.1, C, uFace) / 0.06, 0.0, 1.0);
        float ndvw = max(dot(nw, -rd), 0.0);

        // THE LIGHT: in hand, up and to the left of the eye, or ahead with the bearer
        vec3 lampP = uRoute > 0.5 && uRoute < 1.5 ? bearer : ro - 0.16 * rt + 0.12 * up;
        vec3 lv = lampP - p;
        float ld = max(length(lv), 1e-3);
        vec3 l = lv / ld;
        float reach = max(0.32 - 0.15 * uBass - 0.08 * swell, 0.06);
        // the filigree is thread, mostly in its own shadow: its light burns a little brighter
        float gain = (1.9 + 0.45 * uBass - 0.4 * uEnergy + 0.65 * swell) * (1.0 + 0.3 * uFace);
        float lampG = gain / (1.0 + reach * ld * ld);
        float ndl = max(dot(n, l), 0.0);
        float diff = (0.03 + 0.97 * ndl * ndl) * lampG;
        float spec = pow(max(dot(n, nvUnit(l - rd)), 1e-6), 24.0) * lampG * (1.0 - uFace);
        // ...or THE VOTIVES: only a faint lantern at the eye, and every hollow of
        // the stone burning with its own light, low in voice A and high in B
        float em = 0.0;
        if (uRoute > 1.5){
          em = (1.0 - smoothstep(0.15, 0.75, occ)) * (0.55 + 0.45 * max(dot(n, -rd), 0.0)) * gain;
          diff *= 0.12; spec *= 0.3;
        }
        float sky = 0.5 + 0.5 * nw.z;                // the high fill: what faces up catches it
        sky *= sky;
        float fr0 = pow(max(1.0 - ndvw, 1e-6), 3.0) * smoothstep(0.15, 0.6, occ) * agree;
        float fr = fr0 * (1.0 - 0.7 * smoothstep(1.2, 4.0, t)) * smoothstep(0.25, 0.8, t)
                 * (1.0 - 0.6 * uFace * (1.0 - smoothstep(0.5, 1.5, t)));
        // a lantern behind the stone rims its silhouette in the lantern's own light
        float rimB = fr0 * smoothstep(0.15, 0.5, t);
        float back = rimB * max(dot(l, rd), 0.0) * lampG;
        // depth: light gives out with distance, and is gone before the march stops
        float hz = smoothstep(-0.6, 0.6, p.z - C.z);
        float warm = mix(warmA, warmB, uRoute > 1.5 ? hz : smoothstep(0.7, 3.2, ld));
        float depth = exp(-(kd0 + 0.16 * warm * (0.4 + 0.6 * uEnergy)) * t)
                    * (1.0 - smoothstep(0.55 * NV_TMAX, 0.96 * NV_TMAX, t))
        // ...and where the step budget runs out in the far nave, the light has already gone
                    * (1.0 - smoothstep(0.6, 1.0, steps / 96.0) * smoothstep(1.5, 3.5, t));

        // the lamp's voice, walking to the next voice as its light travels
        vec3 lantern = nvTone(nvWalk(q0, q1, q2, x0 + smoothstep(0.7, 3.2, ld)));
        vec3 skyC = nvTone(nvWalk(q0, q1, q2, x0 + 1.0 + 0.18 * uMid));    // the high fill, a voice along
        vec3 rim = nvTone(nvWalk(q0, q1, q2, x0 + 2.0));                  // the rims, the third voice
        vec3 pale = nvTone(uColC);                                         // the gloss, the chord's pale voice
        col = lantern * diff * (0.25 + 0.75 * occ) * 1.15;
        col += lantern * back * 0.9;
        col += mix(lampA, lampB, hz) * em * 1.05;
        col += skyC * sky * occ * 0.3 * exp(-0.3 * t);
        col += rim * fr * (0.35 + 0.9 * uTreble + 0.3 * swell) * 1.1;
        col += mix(lantern, pale, 0.6) * spec * occ * 1.2;
        col *= depth * (1.0 + 0.2 * uEnergy) * cov;
        float mxc = max(col.r, max(col.g, col.b));
        col *= mxc / (mxc + 0.12 * warm * (0.4 + 0.6 * uEnergy) + 1e-4);   // a warm voice's dim tail drops to the void rather than to brown
      }

      // THE BEARER'S LANTERN ITSELF, wherever the eye sees it before any stone
      float gw = 0.9 + 0.6 * swell;
      if (uRoute > 0.5 && uRoute < 1.5){
        float ts = dot(bearer - ro, rd);
        if (ts > 0.05 && ts < tEnd){
          float gd = length(ro + rd * ts - bearer), rad = 0.012 + 2.0 * NV_PX * ts;
          float g = exp(-gd * gd / (rad * rad)) + 0.15 / (1.0 + gd * gd / (9.0 * rad * rad));
          col += lampA * g * gw * exp(-kd * ts) * (1.0 - smoothstep(0.55 * NV_TMAX, 0.96 * NV_TMAX, ts));
        }
      }
    }
    col += (hash21(pos.xy) - 0.5) * (1.5 / 255.0);          // dither the dim fade before the governor
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: NAVE ==== */
