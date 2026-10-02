#include <metal_stdlib>
using namespace metal;

/* ==== ROOM REGION: SPECTRAL — builder owns everything between these fences ==== */
/* ================================================================
   SPECTRAL — rings threaded on rings, one band of the music per scale.

   A jewel built the way Knighty builds a distance-estimated IFS from
   primitives: fold space by a symmetry group (here the cyclic group of
   order n), step into a child frame scaled down by SC about a point on the
   ring, and take the union of the same primitive at every scale, each
   distance divided by the scale it was found at. The primitive is a ring
   (a torus), so every ring carries n smaller rings threaded on it — each
   child's plane holds the parent's radius and normal, so the parent's tube
   runs through the child's hole — seven scales deep, every scale rolling
   slowly in its own plane.

   THE SPECTRUM IS SCULPTED ACROSS SCALES: scale i reads the mean of the
   64 log bands [S_i, S_i+1) with S = 0, 9, 18, 27, 37, 46, 55, 64 (30 Hz to
   14 kHz), so the sub-bass thickens the great ring and the air above 6 kHz
   the finest ones. The band strip is already eased (punch up 30 ms, grace
   down 150 ms) and nine bands are averaged per scale, so no thickness
   jitters on one bin. The web reads the same slices from uAudio's bytes.

   FACES (roll0..2, the same three dice the web's roll() deals): the fold
   THREEFOLD / FOURFOLD / FIVEFOLD; the primitive TORUS / BEADS; the framing
   THE MANDALA (near the axis) / THE CROWN (a low orbit) / THE PENDANT
   (hung in three-quarter view, swinging slowly on its vertical axis 37..71
   degrees from face-on: never face-on, never edge-on). The whole jewel
   drifts slowly off the centre line and back.

   Level of detail is pixel-footprint against a FIXED 1080-line reference
   (this room renders at 1080 lines on the TV, heavy), so both stages
   resolve the same scales and colour their haze the same; unresolvable
   scales retract into a line-integrated haze. Tubes keep a one-pixel floor
   with brightness scaled by true width over drawn width, near misses are
   painted as analytic rim coverage (closest approach where two empty
   spheres meet), a tube thinner than a pixel is a front layer the march
   goes on through (coverage, not a wall), AO is two DE taps along the
   normal, and shading walks the chord ramp to the rim tone instead of
   blending two chord tones. The beat is a lamp falling down the scales from
   the great ring into the dust before the next beat, positioned by the
   grid's beat phase (the clock both stages share; the onset envelope when
   there is no grid), plus a small key swell. Misses and spent marches go to
   the void.

   PROVENANCE: the distance-estimated IFS built from primitives ("mdifs"),
   Knighty, fractalforums.com, 2012 — fold by a symmetry group, scale toward
   a vertex, union a primitive at every scale with its distance divided by
   the accumulated scale. The ring (torus) distance after Inigo Quilez,
   "distance functions" (iquilezles.org). The closest-approach estimate for
   the near-miss coverage after Sebastian Aaltonen's improved soft-shadow
   trick (GDC 2018). The threaded child frame, the cyclic fold, the
   pixel-footprint LOD and the one band per scale are our own. Clean-room
   prototype: research/fractal-study/shaders/spectral.frag.

   Written once, in the house dialect — GLSL's words, mapped onto Metal's by
   the macros below — so this file and the web's buildSpectral() carry the
   same lines. Laws as ever: void ground, chord-only colour, govern() at the
   exit, roll0..2 the dice, every loop bounded by a compile-time literal. All
   helpers live in namespace rm_sp: a self-contained translation unit.
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

namespace rm_sp {

constant float3 VOID = float3(0.019608, 0.023529, 0.054902);
constant float TH = 0.36;            // tan of the half vertical field of view
constant float REFH = 1080.0;        // the level of detail is measured against 1080 lines

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
#define INOUT(T, n) thread T& n

inline float spHash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }

struct SpCtx {
    vec2 u1; vec2 u2; vec2 u3; vec2 u4;   // the cyclic group's sector axes (k = 1..4; k = 0 is +x)
    vec2 b0; vec2 b1; vec2 b2; vec2 b3;   // bead directions in the half sector
    vec2 w0; vec2 wd;                     // level-0 roll, and the roll added per level
    vec4 thA; vec4 thB;                   // per-scale tube (or bead) radius, in that scale's units
    vec4 bnA; vec4 bnB;                   // per-scale shaped band 0..1
    float sc; float lsc; float prim; float bmax; float lod; float rb;
    float pr; float pa;                   // world size of one reference / one real pixel, per unit distance
    float lv; float cov; float hz; float hzW; float hzL;   // outputs of the last DE
};

float spPick(vec4 a, vec4 b, int i){
    if (i == 0) return a.x;
    if (i == 1) return a.y;
    if (i == 2) return a.z;
    if (i == 3) return a.w;
    if (i == 4) return b.x;
    if (i == 5) return b.y;
    return b.z;
}
vec2 spCmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
float spPh(float t, float P){ return 6.2831853 * fract(t / P); }
/* the slice's level (0..1) shaped into a band: each finer slice is expected
   quieter, the way music's spectrum falls, so the SHAPE is what shows */
float spShape(float L, float i){
    float lo = 0.50 - 0.045 * i;
    return smoothstep(lo, lo + 0.36, L);
}
/* the cyclic fold: the nearest of the n sector axes, rotated onto +x */
vec2 spFold(vec2 p, vec2 u1, vec2 u2, vec2 u3, vec2 u4){
    vec2 a = vec2(1.0, 0.0); float m = p.x;
    float d = dot(p, u1); if (d > m){ m = d; a = u1; }
    d = dot(p, u2); if (d > m){ m = d; a = u2; }
    d = dot(p, u3); if (d > m){ m = d; a = u3; }
    d = dot(p, u4); if (d > m){ m = d; a = u4; }
    return vec2(a.x * p.x + a.y * p.y, a.x * p.y - a.y * p.x);
}

/* THE JEWEL. prT/paT are the reference and real pixel footprints at this
   sample's distance. Writes the winning scale, its coverage and the haze. */
float spDE(vec3 p, float prT, float paT, INOUT(SpCtx, c)){
    vec3 z = p; float s = 1.0; float d = 1e9;
    c.lv = 0.0; c.cov = 1.0; c.hz = 1e9; c.hzW = 0.0; c.hzL = 0.0;
    vec2 w = c.w0;
    for (int i = 0; i < 7; i++){
        float fi = float(i);
        z.xy = spCmul(w, z.xy);                         // this scale rolls in its own plane
        z.xy = spFold(z.xy, c.u1, c.u2, c.u3, c.u4);    // into the sector of the child at +x
        float rpx = 1.0 / max(s * prT, 1e-9);           // this ring's radius in reference pixels
        float f = smoothstep(2.6 * c.lod, 6.5 * c.lod, rpx);   // 1 = resolved, 0 = retracted into haze
        float th = spPick(c.thA, c.thB, i);
        float fl = 0.55 * paT * s;                      // half a real pixel, in this scale's units
        float lq = length(vec2(length(z.xy) - 1.0, z.z));
        float dp, cv;
        if (c.prim < 0.5){
            float r = max(th, fl);
            cv = th / r;
            dp = lq - r;
        } else {
            // a necklace: beads between the children, a thread through them
            vec2 q = vec2(z.x, abs(z.y));
            vec2 bd = c.b0;
            if (dot(q, c.b1) > dot(q, bd)) bd = c.b1;
            if (dot(q, c.b2) > dot(q, bd)) bd = c.b2;
            if (dot(q, c.b3) > dot(q, bd)) bd = c.b3;
            float rb = max(th, fl);
            float rt = max(0.30 * th, fl);
            float db = length(vec3(q - bd, z.z)) - rb;
            float dt = lq - rt;
            float k = 0.35 * rb;
            float hk = clamp(0.5 + 0.5 * (dt - db) / k, 0.0, 1.0);
            float bead = mix(dt, db, hk) - k * hk * (1.0 - hk);
            // the necklace is the great ring and its children; finer scales are wire, and
            // beads below the reference pixel melt back into wire, so they never sparkle
            float g = smoothstep(2.0, 4.5, rb * rpx) * step(fi, 1.5);
            float wr = max(0.62 * th, fl);
            dp = mix(lq - wr, bead, g);
            cv = mix(0.62 * th / wr, th / rb, g);
        }
        dp = (dp + (1.0 - f) * (max(th, fl) + 2.0 * paT * s)) / s;
        if (dp < d){ d = dp; c.lv = fi; c.cov = cv; }
        if (f < 0.999){
            float hz = lq / s;
            if (hz < c.hz){ c.hz = hz; c.hzW = (1.0 - f) * (0.25 + 0.45 * spPick(c.bnA, c.bnB, i)); c.hzL = fi; }
        }
        if (f < 0.001) break;
        z = c.sc * vec3(z.x - 1.0, z.z, z.y);           // the child's frame: (radius, parent normal, parent tangent)
        s *= c.sc;
        // the child's whole subtree lies inside a ball of radius R + 0.3: when that ball is farther than
        // what we already have (and than any haze could reach) no finer scale can matter — exact, and cheap
        if ((length(z) - c.rb) / s > max(d, 12.0 * prT)) break;
        w = spCmul(w, c.wd);
    }
    return d;
}

}  // namespace rm_sp

fragment float4 room_spectral(float4 pos [[position]],
                       constant VizUniforms& U [[buffer(0)]],
                       constant float2& res [[buffer(1)]],
                       texture2d<float, access::read> spectrum [[texture(0)]],
                       texture2d<float, access::read> waveform [[texture(1)]])
{
    using namespace rm_sp;
#define ramp(t) chordRamp(U, (t))
    // calm: the TV's analyser counts it DOWN from 1 as the music gets loud (1 - energy over 2.5 s);
    // the web's f.calm counts UP (energy over 2.5 s). This room reads the web's sense on both stages.
    float uTime = U.time, uEnergy = U.energy, uBeat = U.onsetEnv, uCalm = 1.0 - U.calm;
    vec2 uRes = max(res, float2(1.0));

    // the faces: roll0 the fold, roll1 the primitive, roll2 the framing
    float nF = 3.0 + floor(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float prim = floor(clamp(U.roll1 * 2.0, 0.0, 1.999));
    float frame = floor(clamp(U.roll2 * 3.0, 0.0, 2.999));
    float seed = fract(U.roll2 * 7.31 + U.roll1 * 3.17 + U.roll0 * 1.93);

    // the spectrum: scale i is the mean of the 64 log bands [S_i, S_i+1)
    float lvl[7];
    for (int i = 0; i < 7; i++){
        int b0 = (i * 64 + 3) / 7;
        int b1 = ((i + 1) * 64 + 3) / 7;
        float sum = 0.0, cnt = 0.0;
        for (int k = 0; k < 10; k++){
            int b = b0 + k;
            if (b >= b1) break;
            sum += spectrum.read(uint2(uint(clamp(b, 0, 63)), 0u)).r;
            cnt += 1.0;
        }
        lvl[i] = sum / max(cnt, 1.0);
    }

    SpCtx c = {};
    float sa = 6.2831853 / nF;
    c.u1 = vec2(cos(sa), sin(sa));
    c.u2 = vec2(cos(2.0 * sa), sin(2.0 * sa));
    c.u3 = nF > 3.5 ? vec2(cos(3.0 * sa), sin(3.0 * sa)) : vec2(1.0, 0.0);
    c.u4 = nF > 4.5 ? vec2(cos(4.0 * sa), sin(4.0 * sa)) : vec2(1.0, 0.0);
    float qn = nF < 3.5 ? 4.0 : 3.0;                  // beads per half sector: 24, 24, 30 to a ring
    float bs = 3.14159265 / (nF * qn);
    c.b0 = vec2(cos(0.5 * bs), sin(0.5 * bs));
    c.b1 = vec2(cos(1.5 * bs), sin(1.5 * bs));
    c.b2 = vec2(cos(2.5 * bs), sin(2.5 * bs));
    c.b3 = qn > 3.5 ? vec2(cos(3.5 * bs), sin(3.5 * bs)) : c.b2;
    c.bmax = 0.68 * sin(0.5 * bs);                    // never touching: the thread shows between
    c.sc = nF < 3.5 ? 2.05 : (nF < 4.5 ? 2.2 : 2.45);
    c.lod = nF < 3.5 ? 0.85 : (nF < 4.5 ? 1.0 : 1.45);  // a denser fold retracts sooner, so it never clots
    c.prim = prim;
    c.rb = c.sc / (c.sc - 1.0) + 0.3;                 // a subtree's bounding radius, in its own scale
    c.lsc = log2(c.sc);

    float tc = uTime + seed * 977.0;
    // structural life: the great ring turns once in 283 s; each finer scale rolls a little faster,
    // and a sustained loud passage (calm, energy over seconds) winds the scales further round
    float A = spPh(tc, 283.0);
    float B = spPh(tc, 157.0) + 0.7 * uCalm;
    c.w0 = vec2(cos(A), sin(A));
    c.wd = vec2(cos(B), sin(B));

    // the spectrum, one slice per scale
    vec4 bA = vec4(spShape(lvl[0], 0.0), spShape(lvl[1], 1.0), spShape(lvl[2], 2.0), spShape(lvl[3], 3.0));
    vec4 bB = vec4(spShape(lvl[4], 4.0), spShape(lvl[5], 5.0), spShape(lvl[6], 6.0), 0.0);
    c.bnA = bA; c.bnB = bB;
    vec4 baseA = vec4(0.050, 0.060, 0.068, 0.076), baseB = vec4(0.082, 0.088, 0.094, 0.094);
    if (prim < 0.5){
        c.thA = baseA * (0.75 + bA); c.thB = baseB * (0.75 + bB);
    } else {
        c.thA = vec4(c.bmax) * (0.58 + 0.42 * bA); c.thB = vec4(c.bmax) * (0.58 + 0.42 * bB);
    }

    // the camera: closed form in musical time, three framings
    float R = c.sc / (c.sc - 1.0);                    // the jewel's outer radius (great ring = 1)
    float Hc = 1.0 / (c.sc - 1.0);                    // how far the children stand off its plane
    vec3 ro, upH, ta = vec3(0.0);
    if (frame < 0.5){
        // THE MANDALA: 7..27 degrees off the axis, wandering round it
        float th = 0.30 + 0.12 * sin(spPh(tc, 173.0)) + 0.05 * sin(spPh(tc, 61.0) + 1.0);
        float ph = spPh(tc, 397.0) + 0.4 * sin(spPh(tc, 89.0));
        float D = R / (0.82 * TH) * (1.0 + 0.05 * sin(spPh(tc, 131.0)));
        ro = D * vec3(sin(th) * cos(ph), sin(th) * sin(ph), cos(th));
        upH = vec3(0.0, 1.0, 0.0);
    } else if (frame < 1.5){
        // THE CROWN: a low orbit, 19..38 degrees above the great ring's plane
        float e = 0.50 + 0.12 * sin(spPh(tc, 149.0)) + 0.04 * sin(spPh(tc, 53.0));
        float ph = spPh(tc, 331.0);
        float D = (R * sin(e) + Hc * cos(e)) / (0.86 * TH) * (1.0 + 0.04 * sin(spPh(tc, 113.0)));
        ta = vec3(0.0, 0.0, -0.16 * R);                 // aim a little below the plane: perspective drops the near rings
        ro = ta + D * vec3(cos(e) * cos(ph), cos(e) * sin(ph), sin(e));
        upH = vec3(0.0, 0.0, 1.0);
    } else {
        // THE PENDANT: the jewel hangs in three-quarter view and swings slowly on its vertical axis,
        // 37..71 degrees from face-on (the seed picks the side): never face-on, never edge-on
        float sd = seed < 0.5 ? -1.0 : 1.0;
        float be = sd * (0.94 + 0.24 * sin(spPh(tc, 211.0)) + 0.06 * sin(spPh(tc, 83.0) + 0.7));
        float e = 0.16 * sin(spPh(tc, 167.0)) + 0.06 * sin(spPh(tc, 71.0));
        float D = R / (0.82 * TH) * (1.0 + 0.04 * sin(spPh(tc, 127.0)));
        ro = D * vec3(sin(be) * cos(e), sin(e), cos(be) * cos(e));
        upH = vec3(0.0, 1.0, 0.0);
    }
    float dist = length(ro);
    vec3 fw = normalize(ta - ro);
    vec3 rt = normalize(cross(fw, upH));
    vec3 up = cross(rt, fw);
    float aspect = uRes.x / uRes.y;
    // the jewel drifts slowly off the centre line and back (a lens shift: the picture slides,
    // the perspective holds), as far as the screen is wider than it is tall allows
    float drift = 0.11 * clamp(aspect - 1.0, 0.0, 1.0) * (frame > 0.5 && frame < 1.5 ? 0.6 : 1.0)
                * (0.8 * sin(spPh(tc, 193.0)) + 0.2 * sin(spPh(tc, 79.0) + 2.0));
    // Metal's pixel origin is top-left; the web's vUv runs bottom-up
    vec2 uv = (pos.xy / uRes - 0.5) * vec2(aspect, -1.0) - vec2(drift, 0.0);
    vec3 rd = normalize(fw + 2.0 * TH * (uv.x * rt + uv.y * up));
    // the level of detail is measured against 1080 lines; only a starved render (below 675 real
    // lines) coarsens it, so scales finer than its pixels go to haze, not grain
    c.pr = 2.0 * TH / min(REFH, 1.6 * uRes.y);
    c.pa = 2.0 * TH / uRes.y;

    vec3 ldK = normalize(-0.55 * fw + 0.65 * up - 0.35 * rt);     // key: upper left, in front
    vec3 ldF = normalize(-0.30 * fw - 0.35 * up + 0.80 * rt);     // chord fill: lower right
    // THE BEAT: a lamp struck on the great ring that falls down the scales into the dust before
    // the next beat. With a grid it rides the beat phase, the clock both stages share; without
    // one, the onset envelope. The hit lights it and a beating passage holds it up; silence never does.
    // (The analyser holds barPhase and beatPhase at exactly 0 while it has no beats: that is "no grid".)
    float bt = clamp(uBeat, 0.0, 1.0);
    float bph = (U.barPhase + U.beatPhase > 0.0) ? fract(U.barPhase * 4.0) : 1.0 - bt;
    float pulseAmp = (1.0 - bph) * mix(0.35 * smoothstep(0.12, 0.40, uEnergy), 1.0, bt);
    float pulsePos = bph * 8.5 - 0.5;
    float colPh = 0.06 * sin(spPh(tc, 241.0)) + 0.04 * uCalm;

    vec3 col = vec3(0.0);
    float RB = R + 0.25;
    float bb = dot(ro, rd), cc = dot(ro, ro) - RB * RB, h = bb * bb - cc;
    if (h > 0.0){
        float sh = sqrt(h);
        float t = max(-bb - sh, 0.0), t1 = -bb + sh;
        bool hit = false, out_ = false;
        float dPrev = 0.0, tPrev = -1.0;
        float rMin = 1e9, lvMin = 0.0, cvMin = 1.0, tMin = 0.0;
        float eA = 0.0, eL = 0.0, eC = 1.0, eT = 0.0;
        float fT = -1.0, fL = 0.0, fC = 1.0;            // the front thread: a sub-pixel tube the ray went through
        float hzA = 0.0, hzS = 0.0;                     // the haze's weight, and its weighted scale
        float gA = 0.0, gS = 0.0;                       // the lamp's glow, and its weighted scale
        for (int i = 0; i < 100; i++){
            float prT = c.pr * t, paT = max(c.pa * t, 1e-7);
            float d = spDE(ro + rd * t, prT, paT, c);
            if (d < 0.5 * paT){
                if (c.cov < 0.98 && fT < 0.0){
                    // a tube finer than a pixel is coverage, not a wall: keep it as the front layer
                    // and march on through it, so what lies behind still shows round it
                    fT = t; fL = c.lv; fC = c.cov;
                    t += 2.5 * paT;
                    tPrev = -1.0; rMin = 1e9;
                    if (t > t1){ out_ = true; break; }
                    continue;
                }
                hit = true; break;
            }
            // the closest approach since the last sample: where the two empty spheres
            // meet (after Aaltonen), as a fraction of a pixel
            float hs = t - tPrev;
            float x = (hs * hs + d * d - dPrev * dPrev) / (2.0 * max(hs, 1e-6));
            float dm = (tPrev >= 0.0 && x > 0.0 && x < hs) ? sqrt(max(d * d - x * x, 0.0)) : d;
            float r = dm / paT;
            if (r < rMin){ rMin = r; lvMin = c.lv; cvMin = c.cov; tMin = t; }
            else if (rMin < 1.0 && r > rMin + 1.5){
                // passed a thread without touching it: commit its coverage
                float a = 1.0 - rMin;
                if (a > eA){ eA = a; eL = lvMin; eC = cvMin; eT = tMin; }
                rMin = 1e9;
            }
            dPrev = d; tPrev = t;
            // the haze of the scales too fine to draw: a line integral of soft dust
            float hw = max(4.0 * prT, 1e-7);
            float stp = min(d, max(c.hz, hw));
            if (c.hzW > 0.0){
                float hl = c.hzL;
                float hp = pulseAmp * exp(-(hl - pulsePos) * (hl - pulsePos) * 0.45);
                float wv = c.hzW * (1.0 + 5.0 * hp) * exp(-c.hz / hw) * (stp / hw);
                hzA += wv; hzS += wv * hl;
            }
            // the lamp's glow: light scattered round the scale it is passing, where the void has the headroom
            float gx = c.lv - pulsePos;
            if (pulseAmp > 0.01 && abs(gx) < 3.0){
                float gw = max(0.10 * exp2(-c.lsc * c.lv), 2.0 * paT);
                float gv = pulseAmp * exp(-gx * gx * 0.45 - d / gw) * (stp / gw);
                gA += gv; gS += gv * c.lv;
            }
            t += stp * 0.92;
            if (t > t1){ out_ = true; break; }
        }
        if (out_ && rMin < 1.0){
            float a = 1.0 - rMin;
            if (a > eA){ eA = a; eL = lvMin; eC = cvMin; eT = tMin; }
        }
        // the dust takes its scale's chord tone, resolved once (no texture fetch inside the march)
        col += ramp(0.12 * hzS / max(hzA, 1e-6) + colPh + 0.04) * hzA * 0.026 * (0.6 + 0.7 * uEnergy);
        col += ramp(0.12 * gS / max(gA, 1e-6) + colPh + 0.33) * gA * 0.12;
        float pulseE = pulseAmp * exp(-(eL - pulsePos) * (eL - pulsePos) * 0.45);
        // a near miss is a silhouette: the thread's colour, at the coverage the thread earned
        vec3 eCol = ramp(0.12 * eL + colPh + 0.33) * (0.95 + 0.35 * uEnergy + 4.0 * pulseE) * mix(1.0, 0.92, eL / 6.0)
                  * eC * exp(-0.35 * max(eT - dist + 0.6 * R, 0.0));
        // the front thread is a line finer than a pixel, lit as a thread the way a near miss is,
        // laid over what lies behind it at the share of the pixel it covers
        float pulseF = pulseAmp * exp(-(fL - pulsePos) * (fL - pulsePos) * 0.45);
        vec3 fCol = ramp(0.12 * fL + colPh + 0.33) * (0.95 + 0.35 * uEnergy + 4.0 * pulseF) * mix(1.0, 0.92, fL / 6.0)
                  * exp(-0.35 * max(fT - dist + 0.6 * R, 0.0));
        if (hit){
            vec3 p = ro + rd * t;
            float prT = c.pr * t, paT = max(c.pa * t, 1e-7);
            float lv = c.lv, cvH = c.cov;
            float e = 0.7 * paT;
            vec2 k = vec2(1.0, -1.0);
            vec3 nn = k.xyy * spDE(p + k.xyy * e, prT, paT, c) + k.yyx * spDE(p + k.yyx * e, prT, paT, c)
                    + k.yxy * spDE(p + k.yxy * e, prT, paT, c) + k.xxx * spDE(p + k.xxx * e, prT, paT, c);
            vec3 n = nn / max(length(nn), 1e-12);
            // ambient occlusion from two DE taps along the normal, sized to the scale that was hit
            float sl = pow(c.sc, lv);
            float h1 = 0.30 / sl, h2 = 0.80 / sl;
            float o1 = spDE(p + n * h1, prT, paT, c), o2 = spDE(p + n * h2, prT, paT, c);
            float ao = clamp(1.0 - 0.55 * max(h1 - o1, 0.0) / h1 - 0.45 * max(h2 - o2, 0.0) / h2, 0.3, 1.0);
            float bl = spPick(bA, bB, int(lv + 0.5));
            float lt = lv / 6.0;
            float pulse = pulseAmp * exp(-(lv - pulsePos) * (lv - pulsePos) * 0.45);
            vec3 base = ramp(0.12 * lv + colPh);
            vec3 rim = ramp(0.12 * lv + colPh + 0.33);
            vec3 sky = ramp(0.12 * lv + colPh + 0.62);
            float dif = max(dot(n, ldK), 0.0);
            float dif2 = max(dot(n, ldF), 0.0);
            // fast math: clamp every pow base into (0,1] first
            float fr = pow(clamp(1.0 - dot(n, -rd), 1e-6, 1.0), 3.0);
            vec3 rf = reflect(rd, n);
            float rl = clamp(dot(rf, ldK), 1e-6, 1.0);
            float spc = pow(rl, 60.0), sheen = pow(rl, 10.0);
            // polished metal mirrors a chord sky: its third tone above, the void below
            float skyU = smoothstep(0.1, 0.9, 0.5 + 0.5 * dot(rf, up));
            float key = 1.0 + 0.25 * pulseAmp;
            // the shadow side walks the ramp toward the rim tone: never a grey blend of two chord tones
            float kd = 0.35 + 0.65 * dif;
            vec3 body = ramp(0.12 * lv + colPh + 0.33 * (1.0 - kd)) * mix(0.65, 1.0, kd);
            float gain = mix(1.0, 0.92, lt) * (1.0 + 0.35 * bl);
            vec3 lit = body * (0.58 + 0.80 * dif * key) * (1.25 + 0.15 * uEnergy)
                     + base * 0.6 * sheen + sky * 0.45 * skyU
                     + rim * (0.36 * dif2 + 0.90 * fr + 0.30 * lt)      // the finer the scale, the surer its lit edge
                     + (base * 0.5 + rim * (0.35 + 1.3 * fr)) * 3.2 * pulse;
            lit = lit * gain * ao + sky * spc * 0.6 * ao;
            float fade = exp(-0.35 * max(t - dist + 0.6 * R, 0.0));
            col += lit * fade * cvH;
        }
        // back to front: the hit, a near miss in front of it, the front thread, a near miss in front of that
        bool eFr = fT >= 0.0 && eT < fT;
        if (eA > 0.0 && !eFr && (!hit || eT < t)) col = hit ? mix(col, eCol, eA) : col + eCol * eA;
        if (fT >= 0.0) col = mix(col, fCol, fC);
        if (eA > 0.0 && eFr) col = mix(col, eCol, eA);
    }
#undef ramp
    // a static dither, as the web's: the pixel's own hash
    col += (spHash(pos.xy) - 0.5) * 0.006;
    return float4(govern(max(VOID + col, float3(0.0)), U.white), 1.0);
}
/* ==== END ROOM REGION: SPECTRAL ==== */
