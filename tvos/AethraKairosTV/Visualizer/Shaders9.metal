#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 6b — PENDULA, ATTRACTOR, FIREFLIES, THREE BODY,
   DENDRITE, MURMURATION. The second six of the chaos wing, the
   Apple TV embodiments of the web player's scenes 48–53, closing
   the house at forty-two.

   The web versions of these six are CPU ensembles — thousands of
   integrated particles. A Metal fragment owns nothing but its
   pixel, so the television retells each one the way the ARCADE
   retold its games: closed-form or re-integrated from the clock,
   no state, no history. The mathematics stays honest where it
   can be seen: PENDULA really integrates the full double-pendulum
   equations (a fresh experiment every few bars, drawn as it
   computes), the ATTRACTOR really integrates Lorenz, FIREFLIES
   really flash on phases that pull toward the beat, THREE BODY
   rides the figure-eight's own track.

   Laws as ever: void ground, chord-only colour, govern_j() at
   every exit, ghostStrength as the hand, roll0..2 the dice, every
   loop bounded by a compile-time literal (≤ 64 here).
   All symbols wear _j — a self-contained translation unit.
   ================================================================ */

constant float PI_J  = 3.14159265359;
constant float TAU_J = 6.28318530718;
constant float3 VOID_J = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

inline float lumaOf_j(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }
inline float3 govern_j(float3 c, float white) {
    float L = lumaOf_j(c);
    float cap = 0.70 + 1.6 * clamp(white, 0.0, 1.0);
    return (L > cap && L > 1e-4) ? c * (cap / L) : c;
}
inline float hash11_j(float x) { return fract(sin(x * 12.9898) * 43758.5453123); }
inline float hash21_j(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float vnoise_j(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_j(i), b = hash21_j(i + float2(1.0, 0.0));
    float c = hash21_j(i + float2(0.0, 1.0)), d = hash21_j(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
inline float fbm3_j(float2 p) {
    return vnoise_j(p) * 0.5 + vnoise_j(p * 2.1 + 7.3) * 0.3 + vnoise_j(p * 4.3 + 3.1) * 0.2;
}
inline float2 centeredUp_j(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_j(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_j(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}


// ===============================================================
// PENDULA — sensitive dependence, drawn as it computes. Every few
// bars a fresh experiment is dealt: three double pendulums a
// hair's width apart, and the room INTEGRATES the full equations
// live (fixed step, the trail lengthening as the clock allows),
// the three inks separating as e^{λt} does its work. A shimmer
// runs the curves while the plotter rests; the ghost sways the
// whole gantry. HEAVY.
// ===============================================================
inline float2 pendAccel_j(float4 s) {
    float d = s.x - s.z;
    float cd = cos(d), sd = sin(d);
    float den = 2.0 - cos(2.0 * d);
    float g = 9.0;
    float a1 = (-3.0 * g * sin(s.x) - g * sin(s.x - 2.0 * s.z)
                - 2.0 * sd * (s.w * s.w + s.y * s.y * cd)) / den;
    float a2 = (2.0 * sd * (2.0 * s.y * s.y + 2.0 * g * cos(s.x) + s.w * s.w * cd)) / den;
    return float2(a1, a2);
}
fragment float4 room_pendula(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_j(pos.xy, res, U.aspect);
    // the ghost sways the gantry
    float2 g2 = ghostUp_j(U);
    float2 pivot = float2(g2.x * 0.4 * U.ghostStrength, 0.42);
    const float L = 0.34, DT = 0.036, PERIOD = 7.0;
    float deal = floor(U.time / PERIOD);
    float tau = fract(U.time / PERIOD) * PERIOD;
    int steps = min(60, int(tau / DT));
    float3 col = float3(0.0);
    for (int pd = 0; pd < 3; pd++) {
        float fp = float(pd);
        // three fates, a hair apart — the hair being the whole point
        float4 s = float4(1.9 + hash11_j(deal * 3.1 + U.roll1 * 7.0) * 0.9,
                          0.0,
                          2.2 + hash11_j(deal * 5.7 + U.roll1 * 3.0) * 1.1 + fp * 0.004,
                          0.0);
        float2 prev = pivot + float2(sin(s.x), -cos(s.x)) * L
                    + float2(sin(s.z), -cos(s.z)) * L;
        float dmin = 1e3, dAt = 0.0;
        for (int i = 0; i < 60; i++) {
            if (i >= steps) break;
            // midpoint, exactly the web room's integrator
            float2 a1 = pendAccel_j(s);
            float4 sm = s + float4(s.y, a1.x, s.w, a1.y) * (DT * 0.5);
            float2 a2 = pendAccel_j(sm);
            s += float4(sm.y, a2.x, sm.w, a2.y) * DT;
            float2 tip = pivot + float2(sin(s.x), -cos(s.x)) * L
                       + float2(sin(s.z), -cos(s.z)) * L;
            float d = segd_j(p, prev, tip);
            if (d < dmin) { dmin = d; dAt = float(i) / 60.0; }
            prev = tip;
        }
        if (steps > 0) {
            float3 ink = mix(float3(1.0), (pd == 0 ? U.colA.rgb : (pd == 1 ? U.colB.rgb : U.colC.rgb)),
                             clamp(tau * 0.45, 0.0, 1.0));   // one white arm, fraying into inks
            float shimmer = 0.7 + 0.3 * sin(dAt * 40.0 - U.time * 6.0);
            col += ink * exp(-dmin * 220.0) * (0.55 + U.energy * 0.3) * shimmer;
            col += ink * (0.010 / (dmin + 0.010)) * 0.22;
            // the bob
            float db = length(p - prev);
            col += mix(ink, float3(1.0), 0.5) * exp(-db * db * 3800.0) * (0.8 + U.onsetEnv * 0.6);
        }
    }
    // the pivot's quiet star
    col += U.colC.rgb * exp(-length(p - pivot) * 60.0) * 0.3;
    col += (hash21_j(pos.xy) - 0.5) * 0.006;
    return float4(govern_j(VOID_J + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// ATTRACTOR — the butterfly as three neon ribbons: the room
// integrates Lorenz (or Rössler, by the roll) for real, three
// streamlines from hash-dealt seeds, projected through a slowly
// turning 3D frame, with bright pulses flowing along the ribbon
// at the music's pace. HEAVY.
// ===============================================================
fragment float4 room_lorenz(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_j(pos.xy, res, U.aspect);
    float rossler = U.roll0 < 0.6 ? 0.0 : 1.0;
    float deal = floor(U.time / 11.0);
    float ry = U.time * 0.12, ca = cos(ry), sa = sin(ry);
    float3 col = float3(0.0);
    for (int l = 0; l < 3; l++) {
        float fl = float(l);
        float3 s = float3(hash11_j(deal + fl * 3.3) * 8.0 - 4.0,
                          hash11_j(deal + fl * 7.1) * 8.0 - 4.0,
                          (rossler < 0.5 ? 24.0 : 4.0) + hash11_j(deal + fl * 1.7) * 4.0);
        // burn off the transient so the ribbon is ON the attractor
        for (int i = 0; i < 40; i++) {
            float3 d3 = (rossler < 0.5)
              ? float3(10.0 * (s.y - s.x), s.x * (28.0 - s.z) - s.y, s.x * s.y - 2.6667 * s.z)
              : float3(-s.y - s.z, s.x + 0.2 * s.y, 0.2 + s.z * (s.x - 5.7));
            s += d3 * (rossler < 0.5 ? 0.008 : 0.03);
        }
        float scale = rossler < 0.5 ? 0.030 : 0.062;
        float3 cen = rossler < 0.5 ? float3(0.0, 0.0, 25.0) : float3(0.0, 0.0, 6.0);
        float3 w0 = s - cen;
        float2 prev = float2(w0.x * ca + w0.y * sa, w0.z) * scale;
        float dmin = 1e3, dAt = 0.0;
        for (int i = 0; i < 56; i++) {
            float3 d3 = (rossler < 0.5)
              ? float3(10.0 * (s.y - s.x), s.x * (28.0 - s.z) - s.y, s.x * s.y - 2.6667 * s.z)
              : float3(-s.y - s.z, s.x + 0.2 * s.y, 0.2 + s.z * (s.x - 5.7));
            s += d3 * (rossler < 0.5 ? 0.012 : 0.045);
            float3 w = s - cen;
            float2 q = float2(w.x * ca + w.y * sa, w.z) * scale;
            float d = segd_j(p, prev, q);
            if (d < dmin) { dmin = d; dAt = float(i) / 56.0; }
            prev = q;
        }
        float3 ink = (l == 0 ? U.colA.rgb : (l == 1 ? U.colB.rgb : U.colC.rgb));
        // the travellers: bright pulses flowing down the ribbon on the beat
        float pulse = 0.55 + 0.45 * sin(dAt * 30.0 - U.time * (3.0 + U.energy * 4.0) - fl * 2.0);
        col += ink * exp(-dmin * 160.0) * (0.5 + U.energy * 0.35) * pulse;
        col += ink * (0.012 / (dmin + 0.012)) * 0.20;
    }
    // the ghost pours a comet of light where it stands
    if (U.ghostStrength > 0.05) {
        float dgh = length(p - ghostUp_j(U));
        col += U.colA.rgb * exp(-dgh * 8.0) * U.ghostStrength * 0.4;
    }
    col += (hash21_j(pos.xy) - 0.5) * 0.006;
    return float4(govern_j(VOID_J + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// FIREFLIES — synchrony, caught in the act. A meadow of hashed
// fireflies, each with its own drifting phase; as the music pulls
// itself together their phases pull toward the BEAT's, and the
// meadow locks — flashing on the song. The ghost is a queen the
// neighbourhood entrains to. Never a full-field strobe: the pull
// is capped, and the governor holds the ceiling regardless.
// ===============================================================
fragment float4 room_sync(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_j(pos.xy, res, U.aspect);
    float tree = U.roll0 < 0.55 ? 0.0 : 1.0;
    // how together the night is — the pull toward the beat's phase, capped
    float s = clamp(U.energy * 1.3 - 0.15, 0.0, 0.85) * (1.0 - U.calm * 0.4);
    float3 col = float3(0.0);
    float2 g2 = ghostUp_j(U);
    for (int layer = 0; layer < 2; layer++) {
        float fl = float(layer);
        float cs = 0.17 + fl * 0.09;
        float2 gc = floor(p / cs);
        for (int dx = -1; dx <= 1; dx++)
            for (int dy = -1; dy <= 1; dy++) {
                float2 cell = gc + float2(float(dx), float(dy));
                float hz = hash21_j(cell + fl * 37.0 + U.roll1 * 11.0);
                if (hz < 0.35) continue;                      // an empty patch of night
                float2 fp = (cell + float2(hash21_j(cell + 3.1), hash21_j(cell + 7.7))) * cs;
                fp.y += sin(U.time * 0.4 + hz * 31.0) * 0.012; // the hover
                if (tree > 0.5) {
                    // perch only where the tree is: a trunk and boughs of noise
                    float trunk = exp(-abs(fp.x + sin(fp.y * 2.0) * 0.15) * 5.0) * smoothstep(0.9, -0.9, fp.y);
                    float bough = fbm3_j(fp * 2.4 + U.roll2 * 9.0) * smoothstep(1.0, 0.1, length(fp - float2(0.0, 0.25)));
                    if (trunk + bough < 0.55) continue;
                }
                // the phase: its own drift, pulled toward the beat's as s rises;
                // the queen's neighbourhood is pulled outright
                float own = fract(U.time * (0.9 + (hz - 0.5) * 0.25) + hz * 7.0);
                float lock = U.beatPhase;
                float pull = s;
                if (U.ghostStrength > 0.1) pull = max(pull, U.ghostStrength * exp(-length(fp - g2) * 2.2));
                float ph = fract(mix(own, lock, pull) + hz * (1.0 - pull) * 0.15);
                float bri = exp(-ph * 3.2);
                float d = length(p - fp);
                float3 lone = U.colB.rgb, sync2 = U.colA.rgb;
                float3 c = mix(lone, sync2, pull) * (0.14 + bri * 2.0);
                c = mix(c, float3(1.0, 0.98, 0.9), bri * 0.35);
                col += c * exp(-d * d * (14000.0 - bri * 8000.0)) * (0.25 + bri);
            }
    }
    // the riverbank's dark water line, when the roll deals it
    if (U.roll0 > 0.85) col *= 1.0 - 0.35 * smoothstep(-0.45, -0.55, p.y);
    col += (hash21_j(pos.xy) - 0.5) * 0.006;
    return float4(govern_j(VOID_J + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// THREE BODY — the figure eight, and the disk. The choreography
// rides its own looping track (three equal masses equally spaced
// in time along one curve — the miracle's defining property),
// onsets shake it toward the chaos Poincaré promised; or the roll
// deals a PROTODISK: rings of grains around a young star, a
// shepherd body carving the gap as it laps.
// ===============================================================
fragment float4 room_nbody(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_j(pos.xy, res, U.aspect);
    float3 col = float3(0.0);
    float disk = U.roll0 < 0.6 ? 0.0 : 1.0;
    float2 g2 = ghostUp_j(U);
    if (disk < 0.5) {
        // THE FIGURE EIGHT: the lemniscate track, three bodies a third apart
        float wob = U.onsetEnv * 0.10;
        float tt = U.time * 0.5;
        float dmin = 1e3;
        float2 prev = float2(0.0);
        for (int i = 0; i <= 48; i++) {
            float th = float(i) / 48.0 * TAU_J;
            float2 q = float2(cos(th), sin(th) * cos(th) * 0.9) * 0.72;
            q += float2(vnoise_j(float2(th * 2.0, U.time * 0.7)) - 0.5,
                        vnoise_j(float2(th * 2.0, U.time * 0.7 + 9.0)) - 0.5) * wob;
            if (i > 0) dmin = min(dmin, segd_j(p, prev, q));
            prev = q;
        }
        col += U.colB.rgb * exp(-dmin * 130.0) * 0.30;        // the track, whispered
        for (int b = 0; b < 3; b++) {
            float th = tt + float(b) * TAU_J / 3.0;
            float2 q = float2(cos(th), sin(th) * cos(th) * 0.9) * 0.72;
            q += float2(vnoise_j(float2(th * 2.0, U.time * 0.7)) - 0.5,
                        vnoise_j(float2(th * 2.0, U.time * 0.7 + 9.0)) - 0.5) * wob;
            // the rogue mass: the ghost bends each body toward it, honestly enough
            if (U.ghostStrength > 0.1) q = mix(q, g2, U.ghostStrength * 0.12 / (1.0 + dot(q - g2, q - g2) * 4.0));
            float d = length(p - q);
            float3 ink = (b == 0 ? U.colA.rgb : (b == 1 ? U.colB.rgb : U.colC.rgb));
            col += mix(ink, float3(1.0, 0.98, 0.92), 0.4) * exp(-d * d * 2600.0) * (1.0 + U.bass * 0.5);
            // a short comet-tail along the track behind the body
            for (int k = 1; k <= 6; k++) {
                float thb = th - float(k) * 0.05;
                float2 qb = float2(cos(thb), sin(thb) * cos(thb) * 0.9) * 0.72;
                col += ink * exp(-dot(p - qb, p - qb) * 4000.0) * (0.5 - float(k) * 0.07);
            }
        }
    } else {
        // THE PROTODISK: grains on Keplerian rings, a shepherd, a gap
        float2 q = p;
        float r = length(q) + 1e-4;
        float th = atan2(q.y, q.x);
        // the star and its breath
        col += mix(U.colA.rgb, float3(1.0, 0.97, 0.9), 0.5) * exp(-r * r * 260.0) * (1.3 + U.bass * 0.7);
        // grains: fold into ring cells; each ring turns at its own Kepler rate
        float ring = floor(r * 26.0);
        float om = 1.4 / pow(max(ring * 0.038, 0.12), 1.5) * 0.14;
        float ang = th + U.time * om;
        float cellA = floor(ang / TAU_J * (18.0 + ring * 2.0));
        float hz = hash21_j(float2(ring, cellA) + U.roll1 * 7.0);
        float gap = smoothstep(0.02, 0.05, abs(r - 0.52));    // the shepherd's lane, swept clean
        float grain = step(0.55, hz) * gap * smoothstep(0.16, 0.2, r) * smoothstep(0.95, 0.9, r);
        float2 gcen = float2(cos((cellA + 0.5) / (18.0 + ring * 2.0) * TAU_J - U.time * om),
                             sin((cellA + 0.5) / (18.0 + ring * 2.0) * TAU_J - U.time * om)) * (ring + 0.5) / 26.0;
        float dg = length(q - gcen);
        col += mix(U.colB.rgb, U.colC.rgb, hz) * grain * exp(-dg * dg * 9000.0) * (0.8 + U.treble * 0.5);
        // the shepherd on its lane
        float2 sh = float2(cos(U.time * 0.42), sin(U.time * 0.42)) * 0.52;
        col += U.colA.rgb * exp(-dot(q - sh, q - sh) * 5200.0) * 1.2;
    }
    col += (hash21_j(pos.xy) - 0.5) * 0.006;
    return float4(govern_j(VOID_J + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// DENDRITE — frost, grown by the song. The crystal's radius rides
// the five-act arc, its branches are ridged noise crossing a
// growth front (tips flaring on the treble, rings coloured by
// their birth radius), and it grows toward the ghost's warm
// finger — the television's window, freezing over in real time.
// ===============================================================
fragment float4 room_dla(float4 pos [[position]],
                         constant VizUniforms& U [[buffer(0)]],
                         constant float2& res [[buffer(1)]],
                         texture2d<float, access::read> spectrum [[texture(0)]],
                         texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_j(pos.xy, res, U.aspect);
    float frost = U.roll0 < 0.55 ? 0.0 : 1.0;       // coral from the centre, or frost up the glass
    float2 g2 = ghostUp_j(U);
    // the crystal's clock: the song's own arc, floored by the room clock
    float grow = clamp(max(U.act / 4.0, U.time * 0.012), 0.0, 1.0);
    float R = 0.15 + grow * 0.95;
    // the field the front crosses: ridged branches, warmed toward the finger
    float r, warm = 0.0;
    float2 fld;
    if (frost < 0.5) { r = length(p); fld = float2(atan2(p.y, p.x) * 2.2, r * 3.2); }
    else { r = p.y + 1.0; fld = float2(p.x * 3.0, r * 2.6); }
    if (U.ghostStrength > 0.1) warm = U.ghostStrength * 0.35 * exp(-length(p - g2) * 1.6);
    float ridge = 1.0 - abs(2.0 * fbm3_j(fld + U.roll1 * 23.0) - 1.0);
    float branch = pow(ridge, 3.2);
    float front = R * (0.55 + branch * 0.75) + warm;
    float alive = smoothstep(front, front - 0.05, r);
    float birth = clamp(r / max(front, 1e-3), 0.0, 1.0);      // where in its life this ice froze
    float tip = smoothstep(0.12, 0.0, front - r) * alive;
    float3 ring = mix(U.colB.rgb, U.colA.rgb, birth);
    float grain = 0.6 + 0.4 * vnoise_j(p * 90.0);
    float3 col = ring * alive * branch * grain * (0.7 + U.energy * 0.3);
    col += mix(U.colA.rgb, float3(1.0, 0.98, 0.9), 0.5) * tip * branch * (0.5 + U.treble * 0.9);
    // the unfrozen air: the walkers as a whisper of snow
    float snow = step(0.994, hash21_j(floor(p * 90.0) + floor(U.time * 7.0))) * (1.0 - alive);
    col += float3(0.5, 0.55, 0.65) * snow * 0.25;
    col += (hash21_j(pos.xy) - 0.5) * 0.006;
    return float4(govern_j(VOID_J + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// MURMURATION — one animal made of many. The flock is a living
// density: a dozen cluster-hearts on their own slow orbits around
// a wandering centre, specks hashed inside the body, and the
// famous SHIMMER as a wave of light rolling through it. Onsets
// send the falcon — a hole torn through the density with the
// flock blooming away from it — and the ghost IS the falcon
// whenever it likes.
// ===============================================================
fragment float4 room_boids(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_j(pos.xy, res, U.aspect);
    float t = U.time;
    // the flock's centre wanders the evening
    float2 C = float2(sin(t * 0.11) * 0.5 + sin(t * 0.043) * 0.25,
                      cos(t * 0.09) * 0.3 + sin(t * 0.061) * 0.15);
    // the falcon: the ghost's, or the onset's own stoop across the sky
    float2 falcon = float2(1e3);
    float fstr = 0.0;
    if (U.ghostStrength > 0.1) { falcon = ghostUp_j(U); fstr = U.ghostStrength; }
    else if (U.onsetEnv > 0.35) {
        float sw = fract(t * 0.4);
        falcon = mix(float2(-1.6, 0.8), float2(1.6, -0.6), sw) + C * 0.3;
        fstr = U.onsetEnv;
    }
    // the body: cluster-hearts breathing with the music
    float dens = 0.0;
    float spread = 0.45 + U.energy * 0.25 + fstr * 0.30;     // the bloom away from the strike
    for (int k = 0; k < 12; k++) {
        float fk = float(k);
        float2 o = float2(sin(t * (0.23 + fk * 0.017) + fk * 2.4),
                          cos(t * (0.19 + fk * 0.013) + fk * 1.7))
                 * spread * (0.35 + hash11_j(fk + U.roll1 * 9.0) * 0.65);
        float2 h = C + o;
        // the hearts shy away from the falcon
        float2 away = h - falcon;
        float da = length(away);
        if (da < 0.9) h += away / max(da, 0.1) * (0.9 - da) * 0.8 * fstr;
        float2 d = p - h;
        dens += exp(-dot(d, d) * (11.0 - U.calm * 3.0));
    }
    dens *= 0.55;
    // the hole the falcon tears
    float dfal = length(p - falcon);
    dens *= 1.0 - fstr * exp(-dfal * dfal * 14.0);
    // the birds: hashed specks living where the density lives
    float2 cell = floor(p * 46.0);
    float hz = hash21_j(cell + U.roll2 * 13.0);
    float2 sp = (cell + float2(hash21_j(cell + 3.7), hash21_j(cell + 9.1))) / 46.0;
    float ds = length(p - sp);
    float bird = exp(-ds * ds * 30000.0) * step(1.0 - clamp(dens, 0.0, 0.92), hz);
    /* THE SHIMMER — the wave of decision as a wave of light, rolling through
       the body of the flock the way it does over a reedbed at dusk */
    float2 dir = normalize(float2(cos(t * 0.3), sin(t * 0.23)) + 0.2);
    float shimmer = pow(0.5 + 0.5 * sin(dot(p, dir) * 7.0 - t * (5.0 + U.energy * 5.0)), 3.0);
    float3 body = U.colB.rgb * 0.42;
    float3 flash = mix(U.colA.rgb, float3(1.0, 0.99, 0.95), 0.4);
    float3 col = mix(body, flash, shimmer * clamp(dens, 0.0, 1.0)) * bird * (0.8 + U.energy * 0.35);
    // the flock's own haze — the animal seen whole
    col += U.colB.rgb * dens * dens * 0.045;
    // the falcon itself: a dark speck with a bright wake
    if (fstr > 0.05) col += U.colC.rgb * exp(-dfal * dfal * 3000.0) * fstr * 0.9;
    col += (hash21_j(pos.xy) - 0.5) * 0.006;
    return float4(govern_j(VOID_J + max(col, float3(0.0)), U.white), 1.0);
}
