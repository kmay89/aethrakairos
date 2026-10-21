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

   MUSIC, closed-form from the dance bus (VizUniforms' twelve floats, bytes
   144..191, read through the prelude embedded below), never from a raw
   band. THE BEAT IS THE STROKE: on every beat a pen of
   heavier, wider ink is struck at the nearest bead and travels along the
   ray's depth to the farthest the eye can see over one beat (danceLamp on
   the beat's own age: a strike inside a beat already struck, a roll's 8th
   or 16th, adds its weight and never restarts the stroke; the run fitted
   to each flake), on every pen it crosses — sections, hatches, rings,
   rims, the outline, the silhouette, INK's echoes — weighted by the count
   read at the beat line (the one heaviest), the passage (dMass) and
   stillness, heavier through a knee and never fused into a band. THE BAR
   BREATHES A FAMILY: the one's stroke draws the bar's family in behind it
   (the half-steps, the half-rings, INK's sections, as much as the bar
   deals, in the bar's own pen) and the four's strike lifts it again, so
   every one writes on a settled page. The section's loudness (calm,
   2.5 s) is the pen pressure and how fine the slices go, never on a hit.
   The section planes rise and fall with the phrase, a tide that never
   moves on a beat; the fold re-sculpts once a bar, in the four
   (danceHeld); the hats lay a hairline of light on the finest lines,
   never a width. The camera dances: its orbit strides (fastest on the
   count, a gentle walk that never runs backwards), it nods with the bar
   (dSway), lunges toward the eye on the count (dKick's spring and a struck
   decay, the one heaviest) and comes nearer with the phrase (dLift), draws
   back before the one (danceLean) and through the coil before a drop
   (dBrace); on the landing a swell re-inks the drawing near to far over
   the half-bar (danceLand), the loud section's families are dealt at once
   and the drop's first two bars hit harder. INK's echoes step outward one
   spacing a beat on the stride. Both stages read the prelude's bar clock (barPhase,
   phrasePhase) and the same twelve; in a rest every beat-locked figure is
   still (dStill).

   EDGES. Where a line meets an outline it is lifted, never cut: every
   family fades within a pen's width of its bead's rim and of the edge a
   nearer bead hides it behind, and the outline is carried onto the near
   side, so no edge is a raw step between pixels and a bead too small to
   carry lines is drawn in outline alone. A bead under three reference
   pixels (four and a half in INK) shrinks away and is pushed back from
   every ray, so no pen finds a bead that is gone. The closest approach is
   estimated between march samples (and, for INK's echoes, closed in on),
   so outlines and echoes are curves, not staircases; a ray that runs out
   of steps creeping along an edge is drawn as that edge.

   PROVENANCE. The line vocabulary is after Michael Fogleman's "ln"
   (github.com/fogleman/ln, MIT): vector texturing by planar slices,
   outlines and hidden-line removal — the idea only, no ln code is used.
   The fractal is a kaleidoscopic IFS after Knighty ("Kaleidoscopic
   (escape time) IFS", fractalforums.com, 2010): turn, fold into the
   chamber of the tetrahedral reflection group, scale about a vertex; every
   level carries a sphere (the recursive sphereflake of Eric Haines, 1987),
   joined by Inigo Quilez's polynomial smooth minimum (iquilezles.org).
   Sphere tracing after John C. Hart (1996); the closest approach between
   two march samples after Sebastian Aaltonen's improved soft-shadow
   estimate (GDC 2018, "GPU-based clay simulation and ray-tracing tech in
   Claybook"); the strokes are anti-aliased from ray differentials (Homan
   Igehy, 1999) on the tangent plane at the hit. Clean-room prototype:
   research/fractal-study/shaders/plotter.frag.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below, and the bus's by the sixteen at the top of
   room_plotter (the web's accessors and its uniform-free helper calls) —
   so this file and the web's buildPlotter() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal
   (the march 96, the flake 7, the close-in 4), nothing at program scope
   ever written. All helpers live in namespace rm_pt: a self-contained
   translation unit.
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

namespace rm_pt {

// THE DANCE PRELUDE — the shape helpers a dancing room reads the bus
// (U.dHit … U.dPeriod, bytes 144..191) through, emitted by
// tools/dance_prelude.mjs in namespace mode (plain names, private to this
// namespace); identical in meaning to the web's GLSL_DANCE and to the _a
// copy in Shaders2 (node tools/dance_prelude.mjs --check refuses drift).
// room_plotter reads them (stage 4): the stroke, the count, the bar, the coil and the camera below.
// @dance-prelude-begin(namespace)
// THE DANCE BUS - generated by tools/dance_prelude.mjs (node tools/dance_prelude.mjs --write); never edit by hand.
// Accessors: U.dHit ... U.dPeriod (VizUniforms bytes 144..191). Mode: namespace.
// 0 at the hit, 1 at the next count - the bar phase, four to the bar
inline float danceBeatPhase(constant VizUniforms& U){ return fract(U.barPhase * 4.0); }
// the count's weight: 1 on the one, 0.8 on the three, 0.6 on the two and the four; 0.8 without a bar (freewheel)
inline float danceBeatWeight(constant VizUniforms& U){ if (U.dPeriod <= 0.0) return 0.8; float i = floor(U.barPhase * 4.0); return i < 0.5 ? 1.0 : (abs(i - 2.0) < 0.5 ? 0.8 : 0.6); }
// the coil before the beat: loads over the last 40 % of the beat and unloads INTO the kick, not before it - 1 at ph -> 1 and at ph = 0 (continuous across the beat line), gone by 0.15 beat (75 ms at 120 BPM, inside the spring's 100 ms rise), 0 through the middle of the beat; gated by stillness, 0.4 when freewheeling. Rooms subtract ~20 % of the hit's gain x lean: the form draws back before it moves and lets go AS it moves, so the release is never its own step
inline float danceLean(constant VizUniforms& U, float ph){ return U.dStill * (0.6 + 0.4 * U.dStill) * max(smoothstep(0.60, 0.92, ph), 1.0 - smoothstep(0.0, 0.15, ph)) * (U.dPeriod > 0.0 ? 1.0 : 0.4); }
// the step: a C1 reshaping of the beat's progress - fastest on the count, dwelling at the half; slope 1 + A*cos >= 0.25 for A <= 0.75, so a walk on it never runs backwards (T += dPeriod * (danceStride(ph, A) - ph))
inline float danceStride(float ph, float A){ return ph + (A / 6.2831853) * sin(6.2831853 * ph); }
// a travelling head along x (0 near ... 1 far) that leaves at age 0 and arrives at age 1 - the beat as an event with a place
inline float danceFront(float x, float age, float w){ float d = (x - min(age, 1.0)) / w; return exp(-d * d); }
// struck on the hit (the 0.12-beat attack is the body arriving, not a snap), HELD through the fall, released in the last third of the beat; 0 once the beat is over
inline float danceLamp(float hit, float age){ return (0.5 + 0.5 * hit) * smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.62, 1.0, age)) * step(age, 1.0); }
// the heavy landing (age = dImpact, in beats): a struck mass with period two beats and zeta 0.32 - peak 1 at 0.42 beat, one rebound below rest (-35 %), within 5 % by a bar; 0 for age >= 8 (none)
inline float danceLand(float age){ return 1.60729 * exp(-1.00531 * age) * sin(2.97640 * age) * step(0.0, age) * (1.0 - step(8.0, age)); }
// articulation held per bar: a re-sculpt in the first fifth of the bar, then hold - a fold turns once per bar, never 0.04 rad on every snare
inline float danceHeld(float barIdx, float barPh, float seed){ float a = fract(sin((barIdx - 1.0) * 12.9898 + seed) * 43758.5453); float b = fract(sin(barIdx * 12.9898 + seed) * 43758.5453); return mix(a, b, smoothstep(0.0, 0.2, barPh)); }
// a struck damped oscillator's PERIODIC steady state from the phase alone (= sum e^{-a(ph+k)} sin(b(ph+k))): a sprung rebound at a fixed place in the beat with no CPU state. a = settle (2.5 ~ 92 % by the next count), b = 2*pi x rebounds
inline float danceRing(float ph, float a, float b){ float ea = exp(-a); return exp(-a * ph) * (sin(b * ph) - ea * sin(b * ph - b)) / (1.0 - 2.0 * ea * cos(b) + ea * ea); }
// the breathing law (Shaders.metal's pulse room): a swell with the beat clock, never a flash with it
inline float danceBreath(constant VizUniforms& U, float amt){ return 1.0 + amt * cos(danceBeatPhase(U) * 6.2831853); }
// @dance-prelude-end

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
constant float BR = 1.15;         // the bounding sphere of the whole flake, with room for the farthest echo
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
   under three reference pixels is not drawn: between six and three it shrinks
   and is pushed back from every ray, four reference pixels by the time it is
   gone, so no pen can find a bead that is no longer there. Once the nearest
   thing found is nearer than everything a subtree could hold, the descent
   stops. */
float de(vec3 p, vec3 k, vec2 cs, float S, float R, float foot){
  vec3 z = p; float dr = 1.0; float d = 1e9;
  for (int i = 0; i < 7; i++){
    float lz = length(z);
    if (lz - EXT - SMK > d * dr) break;
    float lod = smoothstep(3.0, 6.0, R / (dr * foot));
    if (lod <= 0.0) break;
    d = smin(d, (lz - R * lod) / dr + (1.0 - lod) * 4.0 * foot, SMK * max(lod, 0.02) / dr);
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
    float ds = (lz - R * lod) / dr + (1.0 - lod) * 4.0 * foot;
    d = smin(d, ds, SMK * max(lod, 0.02) / dr);
    vec3 w = tetraFold(turn(z, k, cs));
    if (ds < best){ second = best; best = ds; trap.x = float(i); trap.y = dot(w, OFF) / max(lz, 1e-6); }
    else if (ds < second) second = ds;
    z = w * S - OFF * (S - 1.0);
    dr *= S;
  }
  trap.z = min(second - best, 1.0);
  return d;
}
/* the march only sampled the closest approach INK's echoes ring out from (g at t, gt = (g, t)): close
   in on it, four times halving the step the march took there, so the echoes are smooth curves and
   not staircases */
vec2 closeIn(vec3 ro, vec3 rd, vec2 gt, vec3 k, vec2 cs, float S, float R, float pxR){
  float hs = 0.5 * gt.x * gt.y;
  for (int j = 0; j < 4; j++){
    float ta = gt.y - hs, tb = gt.y + hs;
    float ra = de(ro + rd * ta, k, cs, S, R, pxR * ta) / max(ta, 1e-4);
    float rb = de(ro + rd * tb, k, cs, S, R, pxR * tb) / max(tb, 1e-4);
    if (ra < gt.x) gt = vec2(ra, ta);
    if (rb < gt.x) gt = vec2(rb, tb);
    hs *= 0.5;
  }
  return gt;
}
// three pens, cycled: pure chord colours, never a grey midpoint between them
vec3 pen3(float k, vec3 A, vec3 B, vec3 C){ float m = k - 3.0 * floor(k / 3.0); return m < 0.5 ? A : (m < 1.5 ? B : C); }
// a pen stroke of half-width hw px whose centre lies dpx away, against a 1.5 px box filter;
// a stroke finer than the filter is drawn at the filter's width and fainter, never broken
float stroke(float dpx, float hw){
  float h = max(hw, 0.75);
  float a = clamp((min(dpx + 0.75, h) - max(dpx - 0.75, -h)) / 1.5, 0.0, 1.0);
  return a * exp2(0.45 * log2(clamp(hw / 0.75, 1e-4, 1.0)));
}
// the nearest level line of f (lines at the integers); fw = field units per pixel. A line is never
// wider than a quarter of its spacing, so a swollen family thins its pen rather than fill
float lines(float f, float fw, float hw){ return stroke(abs(fract(f + 0.5) - 0.5) / fw, min(hw, 0.25 / max(fw, 1e-6))); }
// a family thins out as its lines crowd: spacing in reference px (lo..hi), never under ~2 real ones
float crowd(float fw, float kR, float lo, float hi){ float sp = 1.0 / max(fw, 1e-6); return smoothstep(lo, hi, sp / kR) * smoothstep(1.6, 3.2, sp); }
/* a hatch: lines at the integers that drop every other line as they crowd, so it stays a hatch and
   never turns to fill; the guard is in real pixels as well as reference ones, a hatch needs room */
float hatchL(float f, float fw, float hw, float kR){
  float g1 = crowd(fw, kR, 3.5, 7.0) * smoothstep(2.5, 4.5, 1.0 / max(fw, 1e-6));
  float g2 = crowd(fw * 0.5, kR, 3.5, 7.0) * smoothstep(2.5, 4.5, 0.5 / max(fw, 1e-6));
  return lines(f, fw, hw) * g1 + lines(f * 0.5, fw * 0.5, hw) * (1.0 - g1) * g2;
}
// per-pixel change of a field with world gradient g, on the tangent plane at the hit (ray differentials)
float footprint(vec3 g, vec3 N, vec3 rd, vec3 dx, vec3 dy, float t){
  float nd = dot(rd, N); nd = (nd < 0.0 ? -1.0 : 1.0) * max(abs(nd), 0.06);
  vec3 px = t * (dx - rd * (dot(dx, N) / nd)), py = t * (dy - rd * (dot(dy, N) / nd));
  float a = dot(g, px), b = dot(g, py);
  return sqrt(a * a + b * b) + 1e-6;
}
/* INK's echoes: offset copies of the outer silhouette ringing out into the
   void, one spacing further each beat, in one pen. They fade with their
   distance from the drawing, never with the beat's phase, so a ring glides
   on across the beat line instead of jumping, stepping outward fastest on
   the count; the passage's weight lets them reach farther and lays them
   heavier, and the stroke rides them as it passes */
vec3 echoes(float dpx, float w, float kR, float mass, float phase, float gain, vec3 A){
  float sp = 12.0 * kR;
  float u = dpx / sp;
  float dl = abs(fract(u - phase + 0.5) - 0.5) * sp;
  float reach = 1.3 + 0.8 * mass;
  float fadeQ = (1.0 - smoothstep(reach - 1.0, reach, u)) * smoothstep(0.35, 0.9, u);
  return A * stroke(dl, w * 0.55) * fadeQ * (1.0 + 0.4 * mass + 0.6 * gain);
}
/* the prelude's per-bar hold made wrap-safe over the phrase's eight bars: bar 0 eases from bar 7's value, never
   from bar -1's (danceHeld(x, 0, s) is the hash of x - 1 and danceHeld(x, 1, s) the hash of x: the prelude's own
   hash, so a bar line is continuous everywhere, the phrase's included). ptHeld re-sculpts once a bar, over half a
   beat in the four (0.8..0.875 of the bar): the bar's articulation arrives ahead of its count and is held through
   it, never inside a kick's stroke */
float ptHeldA(float bar8, float seed){ return danceHeld(bar8 < 0.5 ? 8.0 : bar8, 0.0, seed); }
float ptHeldB(float bar8, float seed){ return danceHeld(bar8, 1.0, seed); }
float ptHeld(float bar8, float barPh, float seed){ return mix(ptHeldA(bar8, seed), ptHeldB(bar8, seed), smoothstep(0.8, 0.875, barPh)); }
// the stroke: a pen of Gaussian section about tf along the ray; bw is its variance, in world units squared
float ptBand(float tt, float tf, float bw){ return exp(-((tt - tf) * (tt - tf)) / bw); }
/* the struck lunge on the stroke's age: up in a tenth of a beat, then a decay spent by the next count (0 from age 1 on), so the
   camera's arrival is one frame's gesture and nothing is still travelling when the next count is read */
float ptStrike(float age){ return smoothstep(0.0, 0.1, age) * max(exp(-3.0 * age) - 0.05, 0.0) / 0.95; }
// the stroke's knee: a pen pressed harder is heavier, never a fused band - linear to 1.5 (the groove's one), easing toward 2.75 above
float ptKnee(float x){ return x < 1.5 ? x : 1.5 + (x - 1.5) / (1.0 + 0.8 * (x - 1.5)); }
// behind a head travelling along the ray (1: what it brings) or ahead of it (0), over a tenth of a unit of depth
float ptBehind(float tt, float head){ return 1.0 - smoothstep(-0.1, 0.1, tt - head); }
/* the count's weight, read at the BEAT LINE the stroke belongs to (uBarPhase - age / 4 on the stroke's age, nudged 0.15
   beat forward: the analyser's read-ahead renders a strike just before its grid line) - the one 1.6, the three 0.6, the
   two and the four 0.35, 0.8 freewheeling; constant through a stroke's life, so it never steps mid-beat, and a roll's
   last 16th before the one is weighed as the four it belongs to. ptLeanW is the count AHEAD (the
   bar phase + 0.1 bar rounds the lean's window, the last 40 % of a beat, onto the count it loads for). (A namespace
   helper has no U of its own: it takes the uniforms as the prelude's helpers do, and the fragment's ptBeatW() and
   ptLeanW() macros pass them) */
inline float ptBeatW(constant VizUniforms& U, float age){ if (U.dPeriod <= 0.0) return 0.8; float i = floor(fract(U.barPhase - 0.25 * age + 0.0375) * 4.0); return i < 0.5 ? 1.6 : (abs(i - 2.0) < 0.5 ? 0.6 : 0.35); }
inline float ptLeanW(constant VizUniforms& U){ if (U.dPeriod <= 0.0) return 0.8; float i = floor(fract(U.barPhase + 0.1) * 4.0); return i < 0.5 ? 1.6 : (abs(i - 2.0) < 0.5 ? 0.6 : 0.35); }

}  // namespace rm_pt

fragment float4 room_plotter(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_pt;
    // the dance bus in the house dialect: the web's twelve accessors and its uniform-free helper calls (a function-like
    // macro's own name is not re-expanded inside its replacement, so danceLean(ph) resolves to rm_pt's danceLean(U, ph))
#define dHit U.dHit
#define dAge U.dAge
#define dKick U.dKick
#define dMass U.dMass
#define dArtic U.dArtic
#define dSpark U.dSpark
#define dSway U.dSway
#define dLift U.dLift
#define dBrace U.dBrace
#define dImpact U.dImpact
#define dStill U.dStill
#define dPeriod U.dPeriod
#define danceBeatPhase() danceBeatPhase(U)
#define danceLean(ph) danceLean(U, (ph))
#define ptBeatW(a) ptBeatW(U, (a))
#define ptLeanW() ptLeanW(U)
    // calm: the TV's analyser counts it DOWN from 1 as the music gets loud (1 - energy over 2.5 s); the web's f.calm
    // counts UP. This room reads the web's sense on both stages
    float uCalm = 1.0 - U.calm, uBarPhase = U.barPhase, uPhrasePhase = U.phrasePhase;
    // the web's vUv, y up, aspect-true: uv.y runs -0.5..0.5 over the frame
    float uAspect = max(U.aspect, 1e-4);
    vec2 uv = (pos.xy / max(res, float2(1.0)) - 0.5) * float2(uAspect, -1.0);
    float resY = max(res.y, 1.0);
    float T = U.time, ph = fract(U.roll2);
    // the dice: roll0 the vocabulary, roll1 the flake, roll2 the orbit's start
    float voc = floor(clamp(U.roll0 * 4.0, 0.0, 3.0)), ifs = floor(clamp(U.roll1 * 3.0, 0.0, 2.0));
    vec3 cA = U.colA.rgb, cB = U.colB.rgb, cC = U.colC.rgb;

    // ---- the body: the count, the draw-back before it, the coil, the landing, the passage's weight, the bar in the phrase ----
    float bp = danceBeatPhase();                        // 0 at the count, 1 at the next (four to the bar; held in a rest)
    float sp = fract(bp - dAge + 0.15) - 0.15;          // the last strike's phase in its beat: -0.15..0.1 is the beat line itself (the read-ahead, a frame's detection)
    float ageS = dAge + (dPeriod > 0.0 ? max(sp, 0.0) * smoothstep(0.1, 0.2, sp) : 0.0);   // THE STROKE'S CLOCK: a strike on the beat line restarts it; one inside a beat (a roll's 8th or 16th) carries on the beat's run
    float lean = danceLean(bp);                         // the coil before the count, released INTO the kick (law 3)
    float coil = max(dBrace, 0.6 * (1.0 - smoothstep(0.0, 2.0, dImpact)));   // the held breath before a landing, released over the half-bar after it, never in a frame (law 9); 0.6 sits under the brace's last value, so the landing frame steps forward, with the lunge
    float land = max(danceLand(dImpact), 0.0);          // the landing's own body, clamped to light: 1 at 0.42 beat after it, gone by 1.06
    float heft = max(0.2 + 1.6 * dMass + 3.0 * max(dMass - 0.55, 0.0), 1.8 * (1.0 - smoothstep(0.5, 2.0, dImpact))) * (1.0 + 0.15 * (1.0 - smoothstep(4.0, 8.0, dImpact))) + 0.8 * land;   // the passage's weight, convex above the groove: a verse ~0.7, the groove ~1.0, the drop ~1.8; the landing's first half-bar holds the drop's weight before dMass has risen, and the drop's first two bars hit harder (x1.15, gone by its eighth beat; the build never)
    float barPh = uBarPhase, bar8 = mod(floor(uPhrasePhase * 8.0 - barPh + 0.5), 8.0);   // the phase in the bar, and the bar in the phrase (0..7) read against it, so the two clocks never disagree at a bar line
    float cnt = ptBeatW(ageS), cntL = ptLeanW();            // the count's weight at the stroke's beat line, and the count's ahead: the one heaviest, the three next, the two and the four light (law 7)
    float body = 0.5 * cnt * cnt + 0.32;                // the body's count, steeper than the light's: the one lunges (1.6), the three 0.5, the two and the four 0.38

    // ---- the flake (die 2): the fold's turn, the scale, how it is framed, and the depth the eye can see (the stroke's run, about tC) ----
    vec3 kAx = vec3(0.0, 1.0, 0.0); float ang = 0.10; float S = 2.0; float camR = 2.8; float el0 = 0.62; float stand = 0.0; float tNear = -0.5; float tFar = 0.1;
    if (ifs < 0.5){ kAx = vec3(1.0, 1.0, 1.0); ang = 0.55; S = 2.15; camR = 2.95; el0 = 1.0; stand = 1.0; tNear = -0.75; tFar = 0.25; }   // WHORL
    else if (ifs > 1.5){ kAx = vec3(1.0, -1.0, 0.0); ang = 0.70; S = 2.4; camR = 2.75; tNear = -0.9; tFar = 0.3; }                    // CORAL
    kAx = normalize(kAx);
    float R = (S - 1.0) / (S + 1.0) + 0.03;             // a sphere just kisses its children: every scale holds equal area
    ang += 0.12 * (0.5 * uCalm + 0.6 * (ptHeld(bar8, barPh, 2.0) - 0.5) * dStill);   // the section winds the spiral; the bar re-sculpts it once, in the four before the one (ptHeld) - never on a hit
    vec2 cs = vec2(cos(ang), sin(ang));

    // ---- the camera: the orbit's clock reshaped within each beat (the stride), a nod on the bar, one lunge on the count, drawn back by the coil and before the one ----
    float Tw = T + dPeriod * (danceStride(bp, 0.25 * (1.0 - 0.5 * coil)) - bp) * dStill;   // fastest on the count, dwelling at the half; a gentle walk (slope 1 +- 0.25 of the clock), so it never runs backwards while uTime runs at a quarter of the wall or more (the rubato's floor measured 0.27); zero at both ends of the beat, so seamless; the coil evens the walk
    float az = TAU * fract(ph + Tw / 120.0) + 0.45 * wave(Tw, 77.0, ph);
    float el = el0 + 0.20 * wave(T, 113.0, 0.37 + ph) + 0.02 * dSway;
    // the lunge: the spring (dKick, signed: one rebound) and the struck decay, by the passage and the body's count - toward the
    // viewer, the field of view never moves; the lean loads for the count ahead, squared (the breath is drawn before the one)
    float lunge = (0.4 * dKick + 0.6 * ptStrike(ageS) * dStill) * heft * body;
    float dist = camR * (1.0 + 0.07 * wave(T, 149.0, 0.71 + ph))
               * (1.0 - 0.03 * lunge - 0.04 * dLift + 0.05 * coil + 0.01 * lean * 0.625 * cntL * cntL);
    vec3 tgt = vec3(0.0, -0.01, 0.0);
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
    float lodF = pxR * (voc > 2.5 ? 1.5 : 1.0);         // INK's broad pen lets its beads go half as large again
    vec3 dx = rt * pxA, dy = up * pxA;

    float kP = kR * (1.0 - 0.4 * coil);                 // every pen's width reference, real px: the coil thins the pens toward hairlines
    float pressure = (0.95 + 0.3 * uCalm) * (1.0 - 0.3 * coil);   // the section's loudness is the pen pressure (2.5 s), never uEnergy (law 7); the coil dims it
    float wOut = (0.75 + 0.3 * dMass + 0.35 * uCalm) * kP * (voc > 2.5 ? 1.7 : 1.0);   // the outline pen, real px: the passage's weight, no beat in it
    float hair = 1.0 + 0.15 * dSpark;                    // the hats: a hairline of light on the finest structure, never a width (law 5)
    float tC = length(ro);
    /* THE BEAT IS THE STROKE. The pen's progress is t along the ray; the band is a pen of Gaussian section travelling
       from the nearest ink (tC + tNear) to the farthest the eye can see (tC + tFar) over one beat: struck on the hit,
       held through the beat, released in its last third (danceLamp), weighted by the count, the passage and
       stillness, its gain growing along the run against the depth fade so it reaches the back as heavy as it
       entered; a pen pressed harder is heavier through a knee (ptKnee) and never more than 2.6 times as wide, so it never
       fuses into a band. Its clock is the BEAT'S OWN AGE (ageS): a strike inside a beat already struck adds its weight
       (danceLamp's hit term) and never restarts the run, nor the lunge; a hat never resets dAge: it lights nothing of its
       own (its light is the hairline) */
    float tf = tC + tNear + (tFar - tNear) * min(ageS, 1.0);
    float bw = 0.045 * (tFar - tNear) * (tFar - tNear);   // a pen pressed, not a scratch: FWHM a third of the run, gentle per frame
    float lamp = danceLamp(dHit, ageS) * dStill * heft * cnt * (0.8 + 0.8 * min(ageS, 1.0));
    /* THE RELEASE: on the landing (dImpact = beats since it) the whole drawing is re-inked near to far over the half-bar
       under its own struck mass (rel, danceLand on the half-bar: 1 at 0.84 beat, gone by 2.1), a swell twice the pen's width
       crossing the stroke's parameter, heavier in ink, hardly wider; the drop behind it is heavier by heft and by the loud
       section's families, dealt with the landing */
    float tL = tC + tNear + (tFar - tNear) * min(0.5 * dImpact, 1.0);
    float bwL = 4.0 * bw;
    float rel = max(danceLand(0.5 * dImpact), 0.0);     // the release's own body: the landing's struck mass on the half-bar, clamped to light (1 at 0.84 beat, gone by 2.1)
    float headF = tC + tNear + 4.0 * (tFar - tNear) * barPh;   // THE BAR'S HEAD: near to far over the bar's first beat (the one's own run); what the bar deals is drawn in behind it
    float liftF = tC + tNear + 20.0 * (tFar - tNear) * (barPh - 0.75);   // ...and the head that lifts it again, near to far on the four's strike (0.75..0.8 of the bar), so the next one deals on a settled page
    float barOn = (1.0 - smoothstep(1.3, 1.6, ageS)) * dStill * (1.0 - dBrace);   // the bar's family is held while the beats are struck: lifted when they stop, still in a rest and through the brace

    vec3 col = vec3(0.0);
    float b = dot(ro, rd), c = dot(ro, ro) - BR * BR, h = b * b - c;
    if (h > 0.0){
      float sq = sqrt(h);
      float t = max(-b - sq, 0.0), t1 = -b + sq;
      bool hit = false; bool falling = false;
      float pr = 1e9, graze = 1e9, grazeT = 0.0, gmin = 1e9, gminT = 0.0, dl = 1e9, pd = 1e9, ps = 0.0;
      for (int i = 0; i < 96; i++){
        float d = de(ro + rd * t, kAx, cs, S, R, lodF * t);
        float r = d / max(t, 1e-4);
        dl = d;
        if (d < 0.3 * pxR * t){ hit = true; break; }
        if (falling && r > pr && pr < graze){ graze = pr; grazeT = t; }   // a local minimum of d/t: the ray grazed an edge
        falling = r < pr; pr = r;
        if (r < gmin){ gmin = r; gminT = t; }
        // between two samples, the nearest the surface can have come (Aaltonen's estimate): a smooth closest approach
        float y = (d * d - pd * pd + ps * ps) / (2.0 * max(ps, 1e-6));
        if (y > 0.0 && y < min(d, ps)){ float ra = sqrt(d * d - y * y) / max(t - y, 1e-4); if (ra < gmin){ gmin = ra; gminT = t - y; } }
        // never less than a third of a reference pixel a step, so a ray creeping along an edge gets past it
        float st = max(d, 0.35 * pxR * t);
        pd = d; ps = st;
        t += st;
        if (t > t1) break;
      }
      // a ray that ran out of steps creeping along a crease is a hit if it was all but there; else it was
      // creeping along an edge, and the outline is drawn there
      if (!hit && t < t1 && dl < 2.0 * pxR * t) hit = true;
      if (!hit){
        // the silhouette's closest approach has a depth: the stroke and the release cross it there
        float bandS = ptKnee(ptBand(gminT, tf, bw) * lamp), reS = ptBand(gminT, tL, bwL) * rel;
        float wS = wOut * min(1.0 + 0.8 * bandS + 0.2 * reS, 2.6), gS = 0.9 * pressure * (1.0 + 0.6 * bandS + 0.8 * reS);
        if (t < t1){
          col += cC * stroke(gmin / pxA, wS) * gS * exp(-1.2 * max(gminT - tC + 0.25, 0.0));
        } else {
          // (2) the silhouette pen, from the march's closest approach
          float farG = exp(-1.2 * max(gminT - tC + 0.25, 0.0));
          col += cC * stroke(gmin / pxA, wS) * gS * farG;
          if (voc > 2.5 && gmin < 32.0 * kR * pxA){
            vec2 g3 = closeIn(ro, rd, vec2(gmin, gminT), kAx, cs, S, R, lodF);
            col += echoes(g3.x / pxA, wOut, kR, dMass, danceStride(bp, 0.6 * dStill), bandS + reS, cA) * exp(-1.2 * max(g3.y - tC + 0.25, 0.0)) * pressure;
          }
        }
      } else {
        vec3 p = ro + rd * t;
        float fade = exp(-1.2 * max(t - tC + 0.25, 0.0));  // depth fades the ink toward the void
        float e = max(0.0005, 0.75 * pxR * t);            // the taps sit a reference pixel apart
        vec3 k0 = vec3(1.0, -1.0, -1.0), k1 = vec3(-1.0, -1.0, 1.0), k2 = vec3(-1.0, 1.0, -1.0), k3 = vec3(1.0, 1.0, 1.0);
        vec3 q0 = vec3(0.0), q1 = vec3(0.0), q2 = vec3(0.0), q3 = vec3(0.0), qc = vec3(0.0);
        float d0 = deTrap(p + k0 * e, kAx, cs, S, R, lodF * t, q0);
        float d1 = deTrap(p + k1 * e, kAx, cs, S, R, lodF * t, q1);
        float d2 = deTrap(p + k2 * e, kAx, cs, S, R, lodF * t, q2);
        float d3 = deTrap(p + k3 * e, kAx, cs, S, R, lodF * t, q3);
        deTrap(p, kAx, cs, S, R, lodF * t, qc);
        vec3 nn = k0 * d0 + k1 * d1 + k2 * d2 + k3 * d3;
        float nl = dot(nn, nn);
        vec3 N = nl > 1e-20 ? nn * inversesqrt(nl) : -rd;
        float lam = max(dot(N, L), 0.0);
        float ink = (0.5 + 0.5 * lam) * fade * pressure;
        /* where a line meets an outline it is lifted, never cut: every family fades out within a pen's
           width of this bead's own rim and of the edge a nearer bead hides it behind, and the outline
           is carried a little way onto this side of the edge, so no edge is a raw step between pixels */
        float Rs = (R / exp2(qc.x * log2(S))) / (t * pxA);   // this bead's radius on screen, px
        float nv0 = clamp(dot(N, -rd), 0.0, 1.0);
        float edgeP = Rs * (1.0 - sqrt(max(1.0 - nv0 * nv0, 0.0)));
        bool occl = grazeT > 0.0 && t - grazeT > max(0.03, 8.0 * pxR * t);
        float keep = smoothstep(0.3 * wOut, wOut + 1.2, min(edgeP, occl ? graze / pxA : 1e4));
        float ink0 = ink;
        ink *= keep;
        /* the stroke at this hit's own depth: every pen it crosses is wider and heavier (the release's swell the same
           way, twice as broad, more in its ink than in its width) */
        float band = ptKnee(ptBand(t, tf, bw) * lamp);
        float re = ptBand(t, tL, bwL) * rel;
        float swell = min(1.0 + 1.4 * band + 0.3 * re, 2.6);
        ink *= 1.0 + 1.4 * band + 1.6 * re;

        // (1) the section planes: near-level, slowly leaning; they rise and fall a little under half a spacing with the phrase (a
        // tide, never a beat: a line that moved on the kick would be the whole drawing flashing where the stroke should travel)
        vec3 n1 = turn(normalize(vec3(0.16 * wave(T, 131.0, ph), 1.0, 0.16 * wave(T, 97.0, 0.5 + ph))), pAx, pcs);
        float f1 = dot(p, n1) / 0.026 + 0.4 * sin(TAU * uPhrasePhase) * dStill + 12.0 * fract(T / 100.0);
        float w1 = footprint(n1 / 0.026, N, rd, dx, dy, t);
        /* WHAT IS DRAWN. The section's level (uCalm, 2.5 s) sets how fine the slices go: no family appears or vanishes in a
           frame. THE BAR BREATHES A FAMILY: the one's own head (the stroke's run) draws the bar's family in behind it - the
           half-steps, the half-rings, INK's sections; as much as the bar deals (the prelude's hold), in the bar's own pen - and
           the four's strike lifts it again near to far, so a family appears as a stroke travelling through the flake and every
           one writes on a settled page (the deal only ever adds ink on the one). Held while the beats are struck, lifted when
           they stop, still in a rest and through the brace; never on a hit */
        float famCalm = max(smoothstep(0.15, 0.85, uCalm), (1.0 - smoothstep(4.0, 8.0, dImpact)) * ptBehind(t, headF));   // the section's level; a landing deals the loud section's families at once, drawn in behind the bar's head (the drop's one)
        float dealt = (0.75 + 0.25 * ptHeldB(bar8, 5.0)) * ptBehind(t, headF) * (1.0 - smoothstep(0.73, 0.75, barPh) * ptBehind(t, liftF)) * barOn;   // THE BAR'S FAMILY: dealt on the one behind the bar's head (how much, once a bar), lifted in the four
        float fam = min(famCalm * (0.6 + 0.8 * dealt), 1.2);
        float lo = max(6.0 - 4.0 * fam, 1.8), hi = lo * 2.0;   // loud sections hold more slices; the count changes with the bar's head, never on a hit
        float hwMin = (0.42 + 0.15 * dMass + 0.1 * uCalm) * kP * swell, hwMaj = (0.7 + 0.35 * dMass + 0.2 * uCalm) * kP * swell;
        float fineL = lines(f1, w1, hwMin) * crowd(w1, kR, lo, hi);
        float indexL = lines(f1 * 0.25, w1 * 0.25, hwMaj) * crowd(w1 * 0.25, kR, 3.0, 6.0);
        vec3 pc = pen3(floor(f1 * 0.25 + 0.5), cA, cB, cC);           // the pens change at every index line

        if (voc < 0.5){
          // SECTIONS: the planes alone, four to an index line; the bar deals a half-step between, in its own pen, the hats a hairline on the fine lines
          float halfs = lines(f1 + 0.5, w1, hwMin) * crowd(w1 * 2.0, kR, lo, hi) * dealt * (0.6 + 0.4 * famCalm);
          col += (pc * (hair * fineL + 1.8 * indexL) + pen3(floor(f1 * 0.25 + 0.5) + 1.0 + mod(bar8, 2.0), cA, cB, cC) * (0.6 + 0.8 * famCalm) * halfs) * ink;
        } else if (voc < 1.5){
          // ENGRAVING: scratchboard logic, the light cuts the lines and swells them where it falls; a loud section
          // opens the hatch into the half-light and lays a cross-hatch over the highlights, the hats glint on it
          col += pc * indexL * ink * 0.9;
          float th1 = 0.42 - 0.30 * fam, th2 = 0.92 - 0.24 * fam;
          vec3 n2 = vec3(-0.6638, 0.3118, 0.6799);
          float w2 = footprint(n2 / 0.021, N, rd, dx, dy, t);
          float hw2 = (0.22 + 0.7 * smoothstep(th1, 1.0, lam)) * (0.8 + 0.3 * dMass) * kP * swell;
          float hatch = hatchL(dot(p, n2) / 0.021, w2, hw2, kR) * smoothstep(th1, th1 + 0.14, lam);
          col += cB * hatch * (0.7 + 0.4 * dSpark) * fade * pressure * (1.0 + 1.2 * band + 1.6 * re) * keep;
          vec3 n3 = vec3(0.6142, 0.4457, 0.6513);
          float w3 = footprint(n3 / 0.021, N, rd, dx, dy, t);
          float hw3 = (0.2 + 0.6 * smoothstep(th2, 1.0, lam)) * (0.8 + 0.3 * dMass) * kP * swell;
          float xh = hatchL(dot(p, n3) / 0.021, w3, hw3, kR) * smoothstep(th2, th2 + 0.1, lam);
          col += cC * xh * (0.55 + 0.4 * dSpark) * fade * pressure * (1.0 + 1.2 * band + 1.6 * re) * keep;
        } else if (voc < 2.5){
          // ISOLINES: every bead ringed about its children's sockets, the same count at every scale and
          // each level in its own pen; the rings ride the phrase's tide, the bar deals the half-rings in its own pen
          vec3 gLat = (k0 * q0.y + k1 * q1.y + k2 * q2.y + k3 * q3.y) * (5.0 / (4.0 * e));
          float same = (abs(q0.x - qc.x) + abs(q1.x - qc.x) + abs(q2.x - qc.x) + abs(q3.x - qc.x)) < 0.5 ? 1.0 : 0.0;
          float wl = footprint(gLat, N, rd, dx, dy, t);
          float fl = qc.y * 5.0 - 0.2 * sin(TAU * uPhrasePhase) * dStill - fract(T / 12.0);
          float hwR = (0.5 + 0.3 * dMass) * kP * swell;
          float ring = lines(fl, wl, hwR) * crowd(wl, kR, lo + 1.0, hi + 2.0);
          float ring2 = lines(fl + 0.5, wl, hwR * 0.7) * crowd(wl * 2.0, kR, lo + 1.0, hi + 2.0) * dealt * (0.6 + 0.4 * famCalm);
          col += (pen3(qc.x, cA, cB, cC) * 1.6 * ring + pen3(qc.x + 1.0 + mod(bar8, 2.0), cA, cB, cC) * (0.55 + 0.8 * famCalm) * ring2 * hair) * ink * same;
          col += pc * indexL * ink * 0.3;
        } else {
          // INK: the outline pen carries the drawing; an inner rim on every bead, the creases where
          // beads meet, the sections a whisper the bar deals
          col += pc * indexL * ink * (0.25 + 0.25 * dealt);
          float nv = max(nv0, 0.02);
          float fwv = sqrt(max(1.0 - nv * nv, 0.0)) / max(Rs * nv, 1e-3);
          float rim = stroke(abs(nv - 0.45) / max(fwv, 1e-5), (0.55 + 0.25 * dMass) * kP) * smoothstep(8.0, 16.0, Rs / kR);
          col += cB * rim * ink0 * (1.0 + 1.2 * band + 1.6 * re) * 1.3 * hair;
          vec3 gz = (k0 * q0.z + k1 * q1.z + k2 * q2.z + k3 * q3.z) / (4.0 * e);
          float wz = footprint(gz, N, rd, dx, dy, t);
          // a true crease has a gradient of order one; a jump (where the descent stopped short) has a huge one
          float gm = length(gz);
          float crease = stroke(qc.z / wz, wOut * 0.8) * smoothstep(0.25, 0.6, gm) * (1.0 - smoothstep(3.0, 6.0, gm)) * smoothstep(5.0, 10.0, Rs / kR);
          col += cA * crease * ink * 1.3;
        }
        // (2) the outline: this bead's own rim, drawn a little way in, and the occlusion contour where
        // the ray grazed a nearer edge before it struck
        col += cC * stroke(edgeP, 0.5 * wOut * min(1.0 + 0.8 * band + 0.2 * re, 2.6)) * 0.9 * pressure * fade * (1.0 + 0.6 * band + 0.8 * re);
        if (occl){
          float farG = exp(-1.2 * max(grazeT - tC + 0.25, 0.0));
          float bandG = ptKnee(ptBand(grazeT, tf, bw) * lamp), reG = ptBand(grazeT, tL, bwL) * rel;
          col += cC * stroke(graze / pxA, wOut * min(1.0 + 0.8 * bandG + 0.2 * reG, 2.6)) * 0.9 * pressure * farG * (1.0 + 0.6 * bandG + 0.8 * reG);
        }
      }
    }
#undef dHit
#undef dAge
#undef dKick
#undef dMass
#undef dArtic
#undef dSpark
#undef dSway
#undef dLift
#undef dBrace
#undef dImpact
#undef dStill
#undef dPeriod
#undef danceBeatPhase
#undef danceLean
#undef ptBeatW
#undef ptLeanW
    // the pens are the only light in the room, so they are laid on at full pressure; the rolloff keeps them chord-true
    col *= 1.7;
    col += (hash21(pos.xy) - 0.5) * 0.006;           // grain against banding
    return float4(govern(VOID + max(col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: PLOTTER ==== */
