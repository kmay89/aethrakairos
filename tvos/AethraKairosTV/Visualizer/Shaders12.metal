#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 9 — THE INFINITE WING: LINDENMAYER, HILBERT, KOCH,
   DRAGON, CANTOR. Prusinkiewicz & Lindenmayer's algorithmic
   garden: infinite lengths living in finite spaces, retold in
   Metal under the closed-form licence.

   The web's LINDENMAYER walks a real grammar on the CPU; the
   television grows the same plant per pixel with the branching
   fold — twelve generations of mirror-and-rotate, the wind and
   the bass in the deepest levels. The web's DRAGON keeps a
   point buffer; here the curve is EVALUATED at dyadic parameters
   through its own defining recursion (seven bits of t, two
   affine maps), so the unfolding is an angle, not a rebuild.
   HILBERT, KOCH and CANTOR are straight ports — the xy2d walk,
   the fixed [-1,1] fold, the digit walks — pixel maths that was
   always closed-form.

   Laws as ever: void ground, chord-only colour, govern_p() at
   every exit, ghostStrength as the hand, roll0..2 the dice,
   every loop bounded by a compile-time literal (≤ 128 here).
   All symbols wear _p — a self-contained translation unit.
   ================================================================ */

constant float PI_P  = 3.14159265359;
constant float TAU_P = 6.28318530718;
constant float3 VOID_P = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

inline float3 govern_p(float3 c, float white) {
    /* INK, the web's law: the MAX CHANNEL rolls off on a soft knee and the
       whole triple is rescaled by that one factor, so hue and saturation
       survive any drive level. Light alone can no longer reach white —
       white must be SPENT, and `white` is the budget it is spent from. */
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
inline float hash21_p(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_p(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_p(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_p(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float2 rot_p(float2 v, float a) {
    float c = cos(a), s = sin(a);
    return float2(v.x * c - v.y * s, v.x * s + v.y * c);
}
// the chord as a cyclic 3-stop ramp — the gradient the web's uRamp carries
inline float3 chordRamp_p(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
// complex product — the dragon's two maps live in C
inline float2 cmul_p(float2 a, float2 b) {
    return float2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}


// ===============================================================
// LINDENMAYER — the branching fold. The web walks a grammar into
// nine thousand segments; the same plant grows here per pixel:
// twelve generations of translate-up, mirror, lean and shrink,
// the nearest limb at each level remembered. The species dice
// pick the branch angle and the ratio (the tree, the seaweed,
// the bush), the wind writes hardest in the twigs, the frontier
// burns at the deepest levels, and the hand leans the sun.
// ===============================================================
fragment float4 room_lsystem(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_p(pos.xy, res, U.aspect);
    // the species: angle and ratio from the book (25.7 / 22.5 / 20 degrees)
    int sp = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float ang   = sp == 0 ? 0.4486 : (sp == 1 ? 0.3927 : 0.3491);
    float ratio = sp == 0 ? 0.68   : (sp == 1 ? 0.73   : 0.64);
    float len   = sp == 1 ? 0.46   : 0.40;                 // seaweed climbs taller
    // the sun a hand holds — the whole plant leans toward it
    float lean = 0.0;
    if (U.ghostStrength > 0.05) lean = clamp(ghostUp_p(U).x, -1.0, 1.0) * U.ghostStrength * 0.35;

    float sc = 0.95;
    float2 q = (p - float2(0.0, -0.92)) * sc;
    float d = 1e9;
    float lvl = 0.0;
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float dd = segd_p(q, float2(0.0), float2(0.0, len)) / sc;
        if (dd < d) { d = dd; lvl = fi; }
        // climb into the branch frame: up the limb, mirrored, leaned by the
        // wind — which sways more the deeper the level (twigs write what a
        // trunk only whispers)
        q.y -= len;
        float wind = sin(U.time * 0.7 + fi * 1.7 + U.roll2 * TAU_P)
                   + 0.4 * sin(U.time * 1.7 + fi * 0.9);
        float bend = wind * (0.012 + U.bass * 0.10) * (0.25 + fi * 0.09) + lean * 0.35;
        q = rot_p(q, bend);
        q.x = abs(q.x);
        // the folded branch leans ang from vertical (angle 90° - ang), so
        // aligning it with +y is a rotation by +ang — CW only ever matches
        // the trunk and the plant renders as a stub
        q = rot_p(q, ang * (1.0 + U.roll1 * 0.12));
        q /= ratio; sc /= ratio;
    }
    float g = lvl / 11.0;
    // trunk wears the root of the chord, twigs walk out along it; the
    // frontier — the deepest levels — burns, brighter on the onset
    float3 ink = chordRamp_p(U, 0.10 + g * 0.34 + U.roll1 * 0.12);
    float tip = smoothstep(0.55, 1.0, g);
    ink = mix(ink, chordRamp_p(U, 0.78 + U.roll1 * 0.1), tip * 0.9);
    float wdt = 9000.0 * (1.0 + lvl * 1.1);                // limbs taper as they climb
    float3 col = ink * exp(-d * d * wdt) * (0.65 + tip * (1.1 + U.onsetEnv * 0.8) + U.energy * 0.2);
    col += ink * exp(-d * 26.0) * 0.05;
    col += (hash21_p(pos.xy) - 0.5) * 0.006;
    return float4(govern_p(VOID_P + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// HILBERT — the line that fills the plane, straight port: the
// classic xy2d walk eight bit-planes deep, corridors opened only
// toward neighbours ONE STEP away along the line, the music as
// bright packets riding the entire plane in order. Energy deepens
// the order on the beat; the hand bulges the lattice, the pipes
// flexing but never breaking.
// ===============================================================
static float hilbertT_p(float2 cell, float n) {
    float d = 0.0;
    float2 xy = cell;
    for (int i = 0; i < 8; i++) {
        float s = n / exp2(float(i + 1));
        if (s < 0.5) break;
        float rx = fmod(floor(xy.x / s), 2.0);
        float ry = fmod(floor(xy.y / s), 2.0);
        d += s * s * (ry + rx * (3.0 - 2.0 * ry));
        if (ry < 0.5) {
            if (rx > 0.5) { xy = (s * 2.0 - 1.0) - xy; }
            xy = xy.yx;
        }
    }
    return d / (n * n);
}

fragment float4 room_hilbert(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_p(pos.xy, res, U.aspect) * 0.5;
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_p(U) * 0.5;
        p -= dh * (U.ghostStrength * 0.22 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the order deepens when the music earns it
    float n = U.energy > 0.6 ? 64.0 : 32.0;
    float2 q = (p * 0.92 + 0.5) * n;
    float2 cell = floor(q);
    float2 fc = fract(q) - 0.5;
    float3 col = float3(0.0);
    if (cell.x >= 0.0 && cell.x < n && cell.y >= 0.0 && cell.y < n) {
        float t0 = hilbertT_p(cell, n);
        float tE = hilbertT_p(min(cell + float2(1.0, 0.0), float2(n - 1.0)), n);
        float tW = hilbertT_p(max(cell - float2(1.0, 0.0), float2(0.0)), n);
        float tN = hilbertT_p(min(cell + float2(0.0, 1.0), float2(n - 1.0)), n);
        float tS = hilbertT_p(max(cell - float2(0.0, 1.0), float2(0.0)), n);
        float step1 = 1.0 / (n * n);
        // the pipes: a corridor opens toward any neighbour one step away
        float w = 0.16;
        float pipe = 0.0;
        if (abs(tE - t0) < step1 * 1.5 && cell.x < n - 1.0) pipe = max(pipe, smoothstep(w, w * 0.5, abs(fc.y)) * step(0.0, fc.x));
        if (abs(tW - t0) < step1 * 1.5 && cell.x > 0.0)     pipe = max(pipe, smoothstep(w, w * 0.5, abs(fc.y)) * step(fc.x, 0.0));
        if (abs(tN - t0) < step1 * 1.5 && cell.y < n - 1.0) pipe = max(pipe, smoothstep(w, w * 0.5, abs(fc.x)) * step(0.0, fc.y));
        if (abs(tS - t0) < step1 * 1.5 && cell.y > 0.0)     pipe = max(pipe, smoothstep(w, w * 0.5, abs(fc.x)) * step(fc.y, 0.0));
        float hub = smoothstep(w * 1.5, w * 0.6, length(fc));
        pipe = max(pipe, hub);
        /* the traffic: packets entering at t=0 and riding the whole line —
           three of them, spaced, plus the onset's fresh dispatch */
        float flow = fract(U.time * (0.016 + U.energy * 0.05));
        float traffic = 0.0;
        for (int k = 0; k < 3; k++) {
            float ph = fract(t0 - flow - float(k) * 0.33);
            traffic += exp(-ph * ph * 900.0);
        }
        float ds = fract(t0 - fract(flow - U.beatPhase * 0.02));
        traffic += exp(-ds * ds * 2600.0) * U.onsetEnv * 1.4;
        float3 pipeInk = mode < 2
            ? chordRamp_p(U, 0.28 + U.roll1 * 0.2 + t0 * 0.12)
            : chordRamp_p(U, fract(t0 + U.roll1));           // THE THREAD: the whole chord laid along the line
        float base = mode == 0 ? 0.20 : (mode == 1 ? 0.045 : 0.22);  // NIGHT TRAIN keeps the pipes dark
        col = pipeInk * pipe * (base + U.mid * 0.10);
        col += chordRamp_p(U, 0.72 + U.roll1 * 0.15) * pipe * traffic * (0.8 + U.energy * 0.6);
    }
    col += (hash21_p(pos.xy) - 0.5) * 0.006;
    return float4(govern_p(VOID_P + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// KOCH — the coastline paradox: length without ceiling, area
// without escape. The fixed fold, verbatim from the web: the
// curve spans [-1,1] with its bumps toward -y, and every domain
// mapping honours that span. THE COAST tiles at period 2 and
// breathes through a x3 zoom; SNOWFLAKE and ANTIFLAKE run one
// full edge per sixty-degree sector, bumps out or bitten in.
// ===============================================================
static float kochLine_p(float2 p, float iters) {
    float scale = 1.0;
    p.x = abs(p.x);
    for (int i = 0; i < 7; i++) {
        if (float(i) >= iters) break;
        p *= 3.0; scale *= 3.0;
        p.x = 1.5 - abs(p.x - 1.5);
        float2 nrm = float2(0.8660254, -0.5);
        float2 q = p - float2(1.0, 0.0);
        float dd = dot(q, nrm);
        if (dd > 0.0) q -= 2.0 * dd * nrm;
        p = q + float2(1.0, 0.0);
    }
    float2 e = float2(clamp(p.x, 0.0, 1.0), 0.0);
    return length(p - e) / scale;
}

fragment float4 room_koch(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_p(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_p(U);
        p += dh * (U.ghostStrength * 0.30 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float iters = 4.0 + min(3.0, floor(U.treble * 2.0 + U.energy * 2.0));
    // the zoom breathes in and out — the tile has no seamless x3
    float zp = fract(U.time * 0.05);
    float zoom = 1.0 - abs(1.0 - 2.0 * zp);
    float zoomS = exp(zoom * 1.0986123);
    float d;
    float land = 0.0;
    if (mode == 0) {
        // THE COAST: the folded line as a shore — tile 2 wide, endpoints
        // meeting endpoints, the shore running on without a seam
        float2 q = p * zoomS;
        q.x = fmod(q.x + 21.0, 2.0) - 1.0;               // +21: fmod stays positive on this stage
        d = kochLine_p(float2(q.x, -0.05 - q.y), iters) / zoomS;
        land = smoothstep(0.05, -0.7, p.y);
    } else {
        // SNOWFLAKE / ANTIFLAKE: fold the plane six ways, one full edge per
        // sector — curve middle on the midline, ends meeting at the corners
        float ang = atan2(p.y, p.x);
        float r = length(p);
        float sector = PI_P / 3.0;
        ang = abs(fmod(ang + sector * 0.5 + TAU_P, sector) - sector * 0.5);
        float flip = mode == 1 ? 1.0 : -1.0;
        float2 q = float2(ang / (sector * 0.5), (0.62 - r) * 4.0 * flip);
        d = kochLine_p(q, iters) * 0.25;
    }
    // the shore: a bright line with surf, the landmass faintly filled
    float3 ink = chordRamp_p(U, 0.30 + U.roll1 * 0.2);
    float3 hot = chordRamp_p(U, 0.72 + U.roll1 * 0.15);
    float3 col = hot * exp(-d * (300.0 - U.bass * 80.0)) * (0.8 + U.onsetEnv * 0.6 + U.energy * 0.3);
    col += ink * exp(-d * 40.0) * 0.18;
    col += ink * exp(-d * 8.0) * 0.05;
    col += ink * land * 0.10;
    col += (hash21_p(pos.xy) - 0.5) * 0.006;
    return float4(govern_p(VOID_P + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// DRAGON — the paper that remembers every fold. The web keeps a
// point buffer and rebuilds on each crease; the television
// EVALUATES the curve at dyadic parameters through its defining
// recursion — seven bits of t, two affine maps whose shared
// angle is the unfolding itself. The phrase eases the angle from
// nearly flat toward the full quarter-turn crease, so the strip
// folds into the dragon and breathes back, live, with no state.
// Three bright charges run the whole strip; the twin turns half
// a revolution about the tail and tiles the plane.
// ===============================================================
fragment float4 room_dragon(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_p(pos.xy, res, U.aspect);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));    // 0 heighway, 1 twin, 2 slow
    // the crease: s=1 is the true dragon (both maps scale 1/sqrt(2), a
    // quarter-turn between them); s<1 relaxes every crease at once
    float breathe = mode == 2
        ? 0.5 + 0.5 * sin(U.time * 0.11 + U.roll2 * TAU_P)
        : 0.5 + 0.5 * sin(U.phrasePhase * TAU_P - PI_P * 0.5);
    float s = mix(0.45, 1.0, breathe * breathe * (3.0 - 2.0 * breathe));
    float2 M1 = float2(0.5, 0.5 * s);                    // f1: z -> M1 z
    float2 M2 = float2(-0.5, 0.5 * s);                   // f2: z -> 1 + M2 z (runs backwards)
    float flow = fract(U.time * (0.05 + U.energy * 0.10));

    float3 col = float3(0.0);
    float2 prev = float2(0.0);
    float2 prevT = float2(0.0);
    for (int i = 0; i <= 128; i++) {
        // the vertex at t = i/128, exactly the depth-7 dragon when s = 1:
        // walk t's seven bits from the top, composing z -> c + M z. The
        // second map traverses its half BACKWARDS — that reversal, carried
        // along the bits, is what separates the dragon from the Lévy curve.
        float2 c = float2(0.0), M = float2(1.0, 0.0);
        bool rev = false;
        for (int k = 6; k >= 0; k--) {
            bool b = ((i >> k) & 1) != 0;
            if (rev) b = !b;
            if (b) { c += M; M = cmul_p(M, M2); rev = !rev; }
            else   { M = cmul_p(M, M1); }
        }
        float2 z = c + (rev ? M : float2(0.0));          // T(1) when the tail runs reversed
        if (i == 128) z = float2(1.0, 0.0);              // t = 1, the strip's far end
        // refit: the dragon lives roughly in [-1/3,7/6] x [-1/3,2/3]
        float2 q = (z - float2(0.42, 0.18)) * 1.55;
        float2 qT = rot_p(q, PI_P);                      // the twin, turned half a revolution
        if (i > 0) {
            float vT = float(i) / 128.0;
            float pulse = 0.0;
            for (int k = 0; k < 3; k++) {
                float head = fract(vT - flow - float(k) * 0.33);
                pulse += exp(-head * head * 700.0);
            }
            float3 ink = chordRamp_p(U, 0.24 + U.roll1 * 0.2 + vT * 0.30);
            ink = mix(ink, chordRamp_p(U, 0.75 + U.roll1 * 0.15), min(pulse, 1.0) * 0.9);
            float drive = 0.5 + pulse * 1.3 + U.onsetEnv * 0.4 + U.energy * 0.3;
            float dd = segd_p(p, prev, q);
            col += ink * exp(-dd * dd * 22000.0) * drive;
            col += ink * exp(-dd * dd * 700.0) * 0.04;
            if (mode == 1) {
                float dt2 = segd_p(p, prevT, qT);
                col += ink * exp(-dt2 * dt2 * 22000.0) * drive * 0.85;
            }
        }
        prev = q; prevT = qT;
    }
    col += (hash21_p(pos.xy) - 0.5) * 0.006;
    return float4(govern_p(VOID_P + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CANTOR — remove the middle third, forever. Three faces,
// straight ports: THE BARS descending one depth per row with the
// freshest deletions burning; THE STAIRCASE — constant on every
// removed interval yet climbing 0 to 1, all the rise on the
// dust — with the bar phase as the walker; THE DUST, the product
// set, the survivors still glittering. All masked to their true
// [0,1] span so nothing smears off the margins.
// ===============================================================
static float2 cantorKeep_p(float x, float depth) {
    for (int d = 0; d < 9; d++) {
        if (float(d) >= depth) break;
        x *= 3.0;
        if (x > 1.0 && x < 2.0) return float2(float(d), 0.0);
        if (x >= 2.0) x -= 2.0;
    }
    return float2(depth, 1.0);
}
static float staircase_p(float x) {
    float y = 0.0, f = 0.5;
    for (int d = 0; d < 12; d++) {
        x *= 3.0;
        if (x >= 2.0) { y += f; x -= 2.0; }
        else if (x >= 1.0) { return y + f; }
        f *= 0.5;
    }
    return y;
}

fragment float4 room_cantor(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_p(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 dh = p - ghostUp_p(U);
        p += dh * (U.ghostStrength * 0.25 / (dot(dh, dh) + 0.30));
    }
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the deletion advances slowly and cycles — every stage of the
    // construction gets its turn under the light
    float depth = 1.0 + floor(fmod(U.time * 0.10 + U.roll2 * 6.0, 6.0));
    float3 col = float3(0.0);
    float aspect = max(U.aspect, 1e-4);
    float x01 = clamp(p.x / (aspect * 1.7) + 0.5, 0.0, 1.0);
    if (mode == 0) {
        /* THE BARS: rows of the construction descending, one depth per row */
        float rows = 7.0;
        float ry = (0.72 - p.y) / 1.30 * rows;
        float row = floor(ry);
        float fy = fract(ry);
        if (row >= 0.0 && row < rows && fy > 0.18 && fy < 0.82) {
            float alive = step(row, depth) * step(abs(p.x), aspect * 0.85);
            float2 kc = cantorKeep_p(x01, row + 1.0);
            float3 ink = chordRamp_p(U, 0.26 + U.roll1 * 0.2 + row * 0.05);
            // soft caps, and each surviving cell breathes on its own clock
            float band = smoothstep(0.18, 0.27, fy) * smoothstep(0.82, 0.73, fy);
            float cell = hash21_p(float2(floor(x01 * pow(3.0, row + 1.0)), row));
            float glim = 0.78 + 0.22 * sin(U.time * 2.2 + cell * TAU_P);
            col += ink * kc.y * alive * band * glim * (0.75 + U.bass * 0.35);
            col += chordRamp_p(U, 0.60 + U.roll1 * 0.15) * kc.y * alive * (1.0 - band) * 0.18;
            // the removed third burns as it goes
            float fresh = exp(-abs(kc.x - depth) * 1.6);
            col += chordRamp_p(U, 0.74 + U.roll1 * 0.15) * (1.0 - kc.y) * alive * band * fresh
                 * (U.onsetEnv * 0.9 + U.energy * 0.3);
        }
    } else if (mode == 1) {
        /* THE STAIRCASE: the function drawn whole, the song climbing it */
        float y01 = clamp(p.y / 1.5 + 0.5, 0.0, 1.0);
        float sv = staircase_p(x01);
        float d = abs(y01 - sv);
        float3 ink = chordRamp_p(U, 0.30 + U.roll1 * 0.2 + sv * 0.25);
        col += ink * exp(-d * d * 2600.0) * (0.8 + U.mid * 0.4);
        col += ink * exp(-d * 14.0) * 0.07;
        // the walker: the phrase itself, climbing only where the dust allows
        float walk = fract(U.time * 0.012 + U.roll2);
        float wd = length(float2(x01 - walk, (y01 - staircase_p(walk)) * 0.7));
        col += chordRamp_p(U, 0.78 + U.roll1 * 0.12) * exp(-wd * wd * 1800.0) * (1.0 + U.onsetEnv * 0.8);
    } else {
        /* THE DUST: the product set — remove forever in both directions and
           the survivors still glitter */
        float y01 = clamp(p.y / 1.5 + 0.5, 0.0, 1.0);
        float inr = step(abs(p.x), aspect * 0.84) * step(abs(p.y), 0.74);
        float2 kx = cantorKeep_p(x01, depth + 1.0);
        float2 ky = cantorKeep_p(y01, depth + 1.0);
        float kept = kx.y * ky.y * inr;
        float3 ink = chordRamp_p(U, 0.30 + U.roll1 * 0.25 + (x01 + y01) * 0.10);
        float glim = 0.65 + 0.35 * sin(U.time * 3.0 + hash21_p(floor(float2(x01, y01) * 243.0)) * TAU_P);
        col += ink * kept * glim * (0.8 + U.treble * 0.5 + U.onsetEnv * 0.25);
    }
    col += (hash21_p(pos.xy) - 0.5) * 0.006;
    return float4(govern_p(VOID_P + max(col, float3(0.0)), U.white), 1.0);
}
