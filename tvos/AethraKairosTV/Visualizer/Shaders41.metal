#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: PLOTTER — builder owns everything between these fences ==== */
/* ================================================================
   PLOTTER — a fractal drawn the way a pen plotter would draw it.

   No surface is shaded. Every mark is a thin anti-aliased pen line in one
   of the chord's three colours, on the void, and hidden lines are removed
   for free: each line is a level set evaluated at the raymarch's first hit,
   so whatever is behind the nearest bead was never drawn. The vocabulary is
   the plotter's — oblique section planes four to an index line, a
   silhouette pen from the march's closest approach and an occlusion pen
   from the local minima of d/t, a hatch only the light can find — and every
   pen width, crowding threshold and level of detail is measured in pixels
   of a 1080-line reference, so this stage and the web draw the same strokes.

   FACES. roll0 is the vocabulary: SECTIONS, ENGRAVING (index sections and a
   light-swollen hatch, cross-hatched in the highlights), ISOLINES (every
   bead ringed about its children's sockets — an orbit trap — the same count
   at every scale, each level in its own pen) and INK (heavy silhouettes,
   inner rims, the creases where beads meet, echoes ringing into the void).
   roll1 is the flake: WHORL (twisted about its three-fold axis, stood on a
   vertex), FLAKE (all but untwisted: the Sierpinski pyramid of spheres) and
   CORAL (turned about a two-fold axis at a wider scale). roll2 sets where
   the camera's orbit starts. The web's roll() deals the same three numbers.

   MUSIC, closed-form from the uniforms. Bass sweeps the section planes
   along their normal (and pushes the isolines out of their sockets); mids
   wind the fold's turn tighter; treble opens the hatch into the half-light
   and lays the cross-hatch; energy is pen pressure — wider pens and a lower
   crowding threshold, so loud is denser, heavier engraving; the onset swells
   the outline pen, and the beat's phase sends a band of heavier ink from the
   nearest bead to the back (INK: the echoes step outward one spacing a beat).
   The web reads the same beat phase from its dance clock.

   PROVENANCE. The line vocabulary is after Michael Fogleman's "ln"
   (github.com/fogleman/ln, MIT): vector texturing by planar slices,
   outlines and hidden-line removal — the idea only, no ln code is used.
   The fractal is a kaleidoscopic IFS after Knighty ("Kaleidoscopic
   (escape time) IFS", fractalforums.com, 2010): turn, fold into the
   chamber of the tetrahedral reflection group, scale about a vertex; every
   level carries a sphere (the recursive sphereflake of Eric Haines, 1987),
   joined by Inigo Quilez's polynomial smooth minimum (iquilezles.org).
   Sphere tracing after John C. Hart (1996); the strokes are anti-aliased
   from ray differentials (Homan Igehy, 1999) on the tangent plane at the
   hit. Clean-room prototype: research/fractal-study/shaders/plotter.frag.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildPlotter() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal
   (the march 96, the flake 7), nothing at program scope ever written. All
   helpers live in namespace rm_pt: a self-contained translation unit.
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

namespace rm_pt {

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

constant float TAU = 6.2831853;
constant float SMK = 0.05;        // the smooth union of a sphere with its parent, in its own level's units
constant float EXT = 1.0125;      // a subtree never leaves this radius of its own origin (the attractor's 1, plus the fillets' k/4)
constant float BR = 1.10;         // the bounding sphere of the whole flake
constant float FOV = 0.80;        // ray spread per unit of screen height
constant float REF = 1080.0;      // the line count every pen width, density and level of detail is tuned at
constant vec3 OFF = vec3(0.57735027, 0.57735027, 0.57735027);

// a sine whose argument never leaves one turn, so a long show keeps its accuracy
float wave(float T, float P, float o){ return sin(TAU * fract(T / P + o)); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// Rodrigues: z turned about the unit axis k by the angle whose (cos, sin) is cs
vec3 turn(vec3 z, vec3 k, vec2 cs){ return z * cs.x + cross(k, z) * cs.y + k * (dot(k, z) * (1.0 - cs.x)); }
// the three mirrors of the tetrahedral chamber
vec3 tetraFold(vec3 z){
  if (z.x + z.y < 0.0) z.xy = -z.yx;
  if (z.x + z.z < 0.0) z.xz = -z.zx;
  if (z.y + z.z < 0.0) z.zy = -z.yz;
  return z;
}
/* THE FLAKE. Seven levels; at each a sphere, then turn, fold into the chamber
   and scale about its vertex, so every sphere carries four children. A bead
   under three reference pixels is not drawn (it shrinks away between three
   and six), and once the nearest thing found is nearer than everything a
   subtree could hold, the descent stops. */
float de(vec3 p, vec3 k, vec2 cs, float S, float R, float foot){
  vec3 z = p; float dr = 1.0; float d = 1e9;
  for (int i = 0; i < 7; i++){
    float lz = length(z);
    if (lz - EXT - SMK > d * dr) break;
    float lod = smoothstep(3.0, 6.0, R / (dr * foot));
    if (lod <= 0.0) break;
    d = smin(d, (lz - R * lod) / dr, SMK / dr);
    z = tetraFold(turn(z, k, cs)) * S - OFF * (S - 1.0);
    dr *= S;
  }
  return d;
}
/* the same descent, reporting the orbit trap: which level's sphere is nearest
   (x), the latitude of the point about that sphere's child socket (y), and how
   much farther the next-nearest sphere lies (z, zero along every crease) */
float deTrap(vec3 p, vec3 k, vec2 cs, float S, float R, float foot, INOUT(vec3, trap)){
  vec3 z = p; float dr = 1.0; float d = 1e9; float best = 1e9; float second = 1e9;
  trap = vec3(0.0);
  for (int i = 0; i < 7; i++){
    float lz = length(z);
    if (lz - EXT - SMK > d * dr) break;
    float lod = smoothstep(3.0, 6.0, R / (dr * foot));
    if (lod <= 0.0) break;
    float ds = (lz - R * lod) / dr;
    d = smin(d, ds, SMK / dr);
    vec3 w = tetraFold(turn(z, k, cs));
    if (ds < best){ second = best; best = ds; trap.x = float(i); trap.y = dot(w, OFF) / max(lz, 1e-6); }
    else if (ds < second) second = ds;
    z = w * S - OFF * (S - 1.0);
    dr *= S;
  }
  trap.z = min(second - best, 1.0);
  return d;
}
// three pens, cycled: pure chord colours, never a grey midpoint between them
vec3 pen3(float k, vec3 A, vec3 B, vec3 C){ float m = k - 3.0 * floor(k / 3.0); return m < 0.5 ? A : (m < 1.5 ? B : C); }
// a pen stroke of half-width hw px whose centre lies dpx away, against a 1.5 px box filter;
// a stroke finer than the filter is drawn at the filter's width and fainter, never broken
float stroke(float dpx, float hw){
  float h = max(hw, 0.75);
  float a = clamp((min(dpx + 0.75, h) - max(dpx - 0.75, -h)) / 1.5, 0.0, 1.0);
  return a * exp2(0.6 * log2(clamp(hw / 0.75, 1e-4, 1.0)));
}
// the nearest level line of f (lines at the integers); fw = field units per pixel
float lines(float f, float fw, float hw){ return stroke(abs(fract(f + 0.5) - 0.5) / fw, hw); }
// a family thins out as its lines crowd: spacing in reference px (lo..hi), never under ~2 real ones
float crowd(float fw, float kR, float lo, float hi){ float sp = 1.0 / max(fw, 1e-6); return smoothstep(lo, hi, sp / kR) * smoothstep(1.6, 3.2, sp); }
// per-pixel change of a field with world gradient g, on the tangent plane at the hit (ray differentials)
float footprint(vec3 g, vec3 N, vec3 rd, vec3 dx, vec3 dy, float t){
  float nd = dot(rd, N); nd = (nd < 0.0 ? -1.0 : 1.0) * max(abs(nd), 0.06);
  vec3 px = t * (dx - rd * (dot(dx, N) / nd)), py = t * (dy - rd * (dot(dy, N) / nd));
  float a = dot(g, px), b = dot(g, py);
  return sqrt(a * a + b * b) + 1e-6;
}
/* INK's echoes: offset copies of every silhouette ringing out into the void,
   one spacing further each beat, dying away with distance; loud music lets
   more of them reach */
vec3 echoes(float dpx, float w, float kR, float energy, float pulse, float beat, vec3 A, vec3 B){
  float sp = 12.0 * kR;
  float q = dpx / sp - pulse;
  float dl = abs(fract(q + 0.5) - 0.5) * sp;
  float k = floor(q + 0.5);
  float reach = 1.3 + 2.0 * energy;
  float fadeQ = (1.0 - smoothstep(reach - 1.0, reach, q)) * smoothstep(0.35, 0.9, dpx / sp);
  vec3 pc = (k - 2.0 * floor(k * 0.5)) < 0.5 ? A : B;
  return pc * stroke(dl, w * 0.55) * fadeQ * (1.15 + 0.6 * beat);
}

}  // namespace rm_pt

fragment float4 room_plotter(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_pt;
    // the web's vUv, y up, aspect-true: uv.y runs -0.5..0.5 over the frame
    float uAspect = max(U.aspect, 1e-4);
    vec2 uv = (pos.xy / max(res, float2(1.0)) - 0.5) * float2(uAspect, -1.0);
    float resY = max(res.y, 1.0);
    float T = U.time, ph = fract(U.roll2);
    float bass = clamp(U.bass, 0.0, 1.0), mid = clamp(U.mid, 0.0, 1.0), treble = clamp(U.treble, 0.0, 1.0);
    float energy = clamp(U.energy, 0.0, 1.0), beat = clamp(U.onsetEnv, 0.0, 1.0);
    // the dice: roll0 the vocabulary, roll1 the flake, roll2 the orbit's start; the pulse rides the beat's phase
    float voc = floor(clamp(U.roll0 * 4.0, 0.0, 3.0)), ifs = floor(clamp(U.roll1 * 3.0, 0.0, 2.0)), pulse = fract(U.beatPhase);
    vec3 cA = U.colA.rgb, cB = U.colB.rgb, cC = U.colC.rgb;

    // ---- the flake (die 2): the fold's turn, the scale, and how it is framed ----
    vec3 kAx = vec3(0.0, 1.0, 0.0); float ang = 0.10; float S = 2.0; float camR = 2.8; float el0 = 0.62; float stand = 0.0;
    if (ifs < 0.5){ kAx = vec3(1.0, 1.0, 1.0); ang = 0.55; S = 2.15; camR = 2.95; el0 = 1.0; stand = 1.0; }   // WHORL
    else if (ifs > 1.5){ kAx = vec3(1.0, -1.0, 0.0); ang = 0.70; S = 2.4; camR = 2.75; }                    // CORAL
    kAx = normalize(kAx);
    float R = (S - 1.0) / (S + 1.0) + 0.03;             // a sphere just kisses its children: every scale holds equal area
    ang += 0.05 * mid;                                  // mids: the spiral winds a little tighter
    vec2 cs = vec2(cos(ang), sin(ang));

    // ---- the camera: a slow orbit above the section planes, a wandering elevation, a long dolly ----
    float az = TAU * fract(ph + T / 180.0) + 0.45 * wave(T, 77.0, ph);
    float el = el0 + 0.20 * wave(T, 113.0, 0.37 + ph);
    float dist = camR * (1.0 + 0.07 * wave(T, 149.0, 0.71 + ph));
    vec3 tgt = vec3(0.0, -0.04, 0.0);
    vec3 ro = tgt + dist * vec3(cos(el) * sin(az), sin(el), cos(el) * cos(az));
    vec3 fwd = normalize(tgt - ro);
    vec3 rt = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fwd);
    vec3 L = normalize(0.5 * rt + 0.7 * up - 0.5 * fwd);  // the lamp rides with the camera
    // WHORL stands on a vertex: the whole view is turned into the flake's own frame
    vec3 pAx = vec3(0.70710678, 0.0, -0.70710678);
    vec2 pcs = stand > 0.5 ? vec2(0.57735027, 0.81649658) : vec2(1.0, 0.0);
    ro = turn(ro, pAx, pcs); fwd = turn(fwd, pAx, pcs); rt = turn(rt, pAx, pcs); up = turn(up, pAx, pcs); L = turn(L, pAx, pcs);
    vec3 rd = normalize(fwd + (uv.x * rt + uv.y * up) * FOV);
    float pxA = FOV / resY;                             // ray-direction change per real pixel
    float pxR = FOV / REF;                              // ...per reference pixel: the level of detail
    float kR = resY / REF;                              // real pixels per reference pixel
    vec3 dx = rt * pxA, dy = up * pxA;

    float pressure = 0.85 + 0.45 * energy;              // energy: pen pressure
    float wOut = (0.75 + 0.7 * energy + 0.6 * beat) * kR * (voc > 2.5 ? 1.7 : 1.0);   // the outline pen, real px; the beat swells it
    float tC = length(ro);

    vec3 col = vec3(0.0);
    float b = dot(ro, rd), c = dot(ro, ro) - BR * BR, h = b * b - c;
    if (h > 0.0){
      float sq = sqrt(h);
      float t = max(-b - sq, 0.0), t1 = -b + sq;
      bool hit = false; bool falling = false;
      float pr = 1e9, graze = 1e9, grazeT = 0.0, gmin = 1e9, gminT = 0.0, dl = 1e9;
      for (int i = 0; i < 96; i++){
        float d = de(ro + rd * t, kAx, cs, S, R, pxR * t);
        float r = d / max(t, 1e-4);
        dl = d;
        if (d < 0.3 * pxR * t){ hit = true; break; }
        if (falling && r > pr && pr < graze){ graze = pr; grazeT = t; }   // a local minimum of d/t: the ray grazed an edge
        falling = r < pr; pr = r;
        if (r < gmin){ gmin = r; gminT = t; }
        t += d;
        if (t > t1) break;
      }
      // a ray that ran out of steps creeping along a crease is a hit if it was all but there; else it is void
      if (!hit && t < t1 && dl < 2.0 * pxR * t) hit = true;
      if (!hit){
        if (t >= t1){
          // (2) the silhouette pen, from the march's closest approach
          float farG = exp(-1.2 * max(gminT - tC + 0.25, 0.0));
          col += cC * stroke(gmin / pxA, wOut) * 0.9 * pressure * farG;
          if (voc > 2.5) col += echoes(gmin / pxA, wOut, kR, energy, pulse, beat, cA, cB) * farG * pressure;
        }
      } else {
        vec3 p = ro + rd * t;
        float fade = exp(-1.2 * max(t - tC + 0.25, 0.0));  // depth fades the ink toward the void
        float e = max(0.0005, 0.75 * pxR * t);            // the taps sit a reference pixel apart
        vec3 k0 = vec3(1.0, -1.0, -1.0), k1 = vec3(-1.0, -1.0, 1.0), k2 = vec3(-1.0, 1.0, -1.0), k3 = vec3(1.0, 1.0, 1.0);
        vec3 q0 = vec3(0.0), q1 = vec3(0.0), q2 = vec3(0.0), q3 = vec3(0.0), qc = vec3(0.0);
        float d0 = deTrap(p + k0 * e, kAx, cs, S, R, pxR * t, q0);
        float d1 = deTrap(p + k1 * e, kAx, cs, S, R, pxR * t, q1);
        float d2 = deTrap(p + k2 * e, kAx, cs, S, R, pxR * t, q2);
        float d3 = deTrap(p + k3 * e, kAx, cs, S, R, pxR * t, q3);
        deTrap(p, kAx, cs, S, R, pxR * t, qc);
        vec3 nn = k0 * d0 + k1 * d1 + k2 * d2 + k3 * d3;
        float nl = dot(nn, nn);
        vec3 N = nl > 1e-20 ? nn * inversesqrt(nl) : -rd;
        float lam = max(dot(N, L), 0.0);
        float ink = (0.5 + 0.5 * lam) * fade * pressure;
        // the travelling pulse: on every beat a band of wider, heavier ink runs from the nearest bead to the back
        float tf = tC - 0.95 + 1.35 * pulse;
        float band = exp(-((t - tf) * (t - tf)) / 0.008) * beat;
        float swell = 1.0 + 1.1 * band;
        ink *= 1.0 + 0.6 * band;

        // (1) the section planes: near-level, slowly leaning; bass sweeps them along their normal
        vec3 n1 = turn(normalize(vec3(0.16 * wave(T, 131.0, ph), 1.0, 0.16 * wave(T, 97.0, 0.5 + ph))), pAx, pcs);
        float f1 = dot(p, n1) / 0.026 + 0.9 * bass + 12.0 * fract(T / 100.0);
        float w1 = footprint(n1 / 0.026, N, rd, dx, dy, t);
        float lo = 5.0 - 2.5 * energy, hi = lo * 2.0;     // loud: the crowding threshold drops, more slices hold
        float hwMin = (0.42 + 0.25 * energy) * kR * swell, hwMaj = (0.7 + 0.55 * energy) * kR * swell;
        float fineL = lines(f1, w1, hwMin) * crowd(w1, kR, lo, hi);
        float indexL = lines(f1 * 0.25, w1 * 0.25, hwMaj) * crowd(w1 * 0.25, kR, 3.0, 6.0);
        vec3 pc = pen3(floor(f1 * 0.25 + 0.5), cA, cB, cC);           // the pens change at every index line

        if (voc < 0.5){
          // SECTIONS: the planes alone, four to an index line; loud music lays a half-step between
          float halfs = lines(f1 + 0.5, w1, hwMin) * crowd(w1 * 2.0, kR, lo, hi) * smoothstep(0.35, 0.9, energy);
          col += pc * ((1.0 + 0.4 * treble) * fineL + 0.9 * halfs + 1.8 * indexL) * ink;
        } else if (voc < 1.5){
          // ENGRAVING: scratchboard logic, the light cuts the lines and swells them where it falls;
          // treble opens the hatch into the half-light and lays a cross-hatch over the highlights
          col += pc * indexL * ink * 0.9;
          float th1 = 0.42 - 0.30 * treble, th2 = 0.92 - 0.24 * treble;
          vec3 n2 = vec3(-0.6638, 0.3118, 0.6799);
          float w2 = footprint(n2 / 0.021, N, rd, dx, dy, t);
          float hw2 = (0.22 + 0.7 * smoothstep(th1, 1.0, lam)) * (0.8 + 0.5 * energy) * kR * swell;
          float hatch = lines(dot(p, n2) / 0.021, w2, hw2) * crowd(w2, kR, 3.5, 7.0) * smoothstep(th1, th1 + 0.14, lam);
          col += cB * hatch * (0.7 + 0.6 * treble) * fade * pressure * (1.0 + 0.6 * band);
          vec3 n3 = vec3(0.6142, 0.4457, 0.6513);
          float w3 = footprint(n3 / 0.021, N, rd, dx, dy, t);
          float hw3 = (0.2 + 0.6 * smoothstep(th2, 1.0, lam)) * (0.8 + 0.5 * energy) * kR * swell;
          float xh = lines(dot(p, n3) / 0.021, w3, hw3) * crowd(w3, kR, 3.5, 7.0) * smoothstep(th2, th2 + 0.1, lam);
          col += cC * xh * (0.55 + 0.6 * treble) * fade * pressure * (1.0 + 0.6 * band);
        } else if (voc < 2.5){
          // ISOLINES: every bead ringed about its children's sockets, the same count at every scale and
          // each level in its own pen; bass pushes the rings out of the sockets, loud music halves them
          vec3 gLat = (k0 * q0.y + k1 * q1.y + k2 * q2.y + k3 * q3.y) * (5.0 / (4.0 * e));
          float same = (abs(q0.x - qc.x) + abs(q1.x - qc.x) + abs(q2.x - qc.x) + abs(q3.x - qc.x)) < 0.5 ? 1.0 : 0.0;
          float wl = footprint(gLat, N, rd, dx, dy, t);
          float fl = qc.y * 5.0 - 0.8 * bass - fract(T / 12.0);
          float hwR = (0.5 + 0.45 * energy) * kR * swell;
          float ring = lines(fl, wl, hwR) * crowd(wl, kR, lo + 1.0, hi + 2.0);
          float ring2 = lines(fl + 0.5, wl, hwR * 0.7) * crowd(wl * 2.0, kR, lo + 1.0, hi + 2.0) * smoothstep(0.4, 0.9, max(energy, treble));
          col += pen3(qc.x, cA, cB, cC) * (1.6 * ring + 0.9 * ring2) * ink * same;
          col += pc * indexL * ink * 0.3;
        } else {
          // INK: the outline pen carries the drawing; an inner rim on every bead, the creases where
          // beads meet, the sections a whisper
          col += pc * indexL * ink * 0.4;
          float Rs = (R / exp2(qc.x * log2(S))) / (t * pxA);   // this bead's radius on screen, px
          float nv = clamp(dot(N, -rd), 0.02, 1.0);
          float fwv = sqrt(max(1.0 - nv * nv, 0.0)) / max(Rs * nv, 1e-3);
          float rim = stroke(abs(nv - 0.45) / max(fwv, 1e-5), (0.55 + 0.4 * max(energy, treble)) * kR) * smoothstep(8.0, 16.0, Rs / kR);
          col += cB * rim * ink * 1.3;
          vec3 gz = (k0 * q0.z + k1 * q1.z + k2 * q2.z + k3 * q3.z) / (4.0 * e);
          float wz = footprint(gz, N, rd, dx, dy, t);
          // a true crease has a gradient of order one; a jump (where the descent stopped short) has a huge one
          float gm = length(gz);
          float crease = stroke(qc.z / wz, wOut * 0.8) * smoothstep(0.25, 0.6, gm) * (1.0 - smoothstep(3.0, 6.0, gm)) * smoothstep(5.0, 10.0, Rs / kR);
          col += cA * crease * ink * 1.3;
        }
        // (2) the occlusion contour: the ray grazed a nearer edge before it struck
        if (grazeT > 0.0 && t - grazeT > max(0.03, 8.0 * pxR * t)){
          float farG = exp(-1.2 * max(grazeT - tC + 0.25, 0.0));
          col += cC * stroke(graze / pxA, wOut) * 0.9 * pressure * farG;
          if (voc > 2.5) col += echoes(graze / pxA, wOut, kR, energy, pulse, beat, cA, cB) * farG * pressure;
        }
      }
    }
    // the pens are the only light in the room, so they are laid on at full pressure; the rolloff keeps them chord-true
    col *= 1.7;
    col += (hash21(pos.xy) - 0.5) * 0.006;           // grain against banding
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: PLOTTER ==== */
