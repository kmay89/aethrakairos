#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 7 — THE COUNTING WING: FOURIER, INTERFERENCE,
   JULIA, POINCARÉ, QUASICRYSTAL, PHYLLOTAXIS, SANDPILE. The
   Apple TV embodiments of the web player's scenes 54–60, raising
   the house to forty-nine.

   Where the web rooms keep CPU state (a growing flower, a pile of
   sand), the television retells them under the ARCADE's
   closed-form licence: everything a pixel needs is derivable from
   the clock, the uniforms and the spectrum. The mathematics stays
   honest where it can be seen — JULIA really iterates z²+c,
   POINCARÉ really folds the hyperbolic tiling, QUASICRYSTAL
   really sums its plane waves, PHYLLOTAXIS really inverts the
   Vogel spiral to find the florets nearest this pixel.

   Laws as ever: void ground, chord-only colour, govern_k() at
   every exit, ghostStrength as the hand, roll0..2 the dice, every
   loop bounded by a compile-time literal (≤ 96 here, JULIA's).
   All symbols wear _k — a self-contained translation unit.
   ================================================================ */

constant float PI_K  = 3.14159265359;
constant float TAU_K = 6.28318530718;
constant float3 VOID_K = float3(0.019608, 0.023529, 0.054902);
constant float GOLD_K = 2.39996322973;          // π(3−√5), the golden angle

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

inline float lumaOf_k(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }
inline float3 govern_k(float3 c, float white) {
    /* INK, the web's law: the MAX CHANNEL rolls off on a soft knee and the
       whole triple is rescaled by that one factor, so hue and saturation
       survive any drive level. Light alone can no longer reach white —
       white must be SPENT, and `white` is the budget it is spent from
       (an 18x core at the floor, 2.2x at an earned apex). */
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
inline float hash11_k(float x) { return fract(sin(x * 12.9898) * 43758.5453123); }
inline float hash21_k(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float vnoise_k(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_k(i), b = hash21_k(i + float2(1.0, 0.0));
    float c = hash21_k(i + float2(0.0, 1.0)), d = hash21_k(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
inline float fbm3_k(float2 p) {
    return vnoise_k(p) * 0.5 + vnoise_k(p * 2.1 + 7.3) * 0.3 + vnoise_k(p * 4.3 + 3.1) * 0.2;
}
inline float2 centeredUp_k(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_k(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float segd_k(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
inline float band_k(texture2d<float, access::read> spectrum, int i) {
    return spectrum.read(uint2(uint(clamp(i, 0, 63)), 0)).r;
}


// ===============================================================
// FOURIER — the theorem, live. A chain of turning arms, arm k
// spinning at (k+1) times the base rate, each arm's LENGTH one of
// the live spectrum bands — Fourier synthesis performed by
// machine in front of you, the pen writing the sum. Silence draws
// the textbook: a square wave's harmonics, 1/(k+1). The roll
// deals a three-wheel SPIROGRAPH or the full chain; the ghost
// carries the hub.
// ===============================================================
fragment float4 room_fourier(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect);
    int arms = U.roll0 < 0.35 ? 3 : (U.roll0 < 0.7 ? 8 : 5);
    float gain = arms == 3 ? 0.95 : (arms == 8 ? 0.55 : 0.75);
    // the hub leans to the finger
    float2 hub = ghostUp_k(U) * U.ghostStrength * 0.6;
    float base = U.time * 0.55;
    // walk the chain once: rims, radius arms, and remember the geometry
    float2 x = hub;
    float R[8]; float TH[8]; float2 HUBS[8];
    float3 col = float3(0.0);
    for (int k = 0; k < 8; k++) {
        if (k >= arms) { R[k] = 0.0; TH[k] = 0.0; HUBS[k] = x; continue; }
        float fk = float(k);
        float bnd = band_k(spectrum, k * (64 / max(arms, 1)) + 2);
        float len = (0.05 + max(bnd, 0.28 / (fk + 1.0)) * 0.85) * gain / (1.0 + fk * 0.35);
        float th = base * (fk + 1.0) + hash11_k(fk * 7.1 + U.roll1 * 13.0) * TAU_K;
        HUBS[k] = x; R[k] = len; TH[k] = th;
        // the rim — a thin turning wheel
        float dr = abs(length(p - x) - len);
        float dim = (k == 0 ? 1.0 : 0.7);
        col += U.colB.rgb * exp(-dr * dr * 5200.0) * (0.16 + U.treble * 0.16) * dim;
        float2 nx = x + float2(cos(th), sin(th)) * len;
        // the radius arm
        float da = segd_k(p, x, nx);
        col += U.colB.rgb * exp(-da * da * 9000.0) * 0.28 * dim;
        x = nx;
    }
    // the pen and its trail: resample the whole machine back through time
    float2 pen = x;
    float dpen = length(p - pen);
    col += mix(U.colA.rgb, float3(1.0), 0.5 + U.onsetEnv * 0.3)
         * exp(-dpen * dpen * 5200.0) * (0.9 + U.onsetEnv * 1.2);
    float span = arms == 5 ? 4.2 : 2.4;                 // INK remembers longer
    float2 prev = pen;
    float dmin = 1e3, dAt = 0.0;
    // 30 samples, not 44: the trail's inner loop multiplies by the arm
    // count, and this room's whole per-pixel budget lives right here
    for (int i = 1; i <= 30; i++) {
        float tb = base - float(i) / 30.0 * span * 0.55;
        float2 q = hub;
        for (int k = 0; k < 8; k++) {
            if (k >= arms) break;
            float fk = float(k);
            float th = tb * (fk + 1.0) + hash11_k(fk * 7.1 + U.roll1 * 13.0) * TAU_K;
            q += float2(cos(th), sin(th)) * R[k];
        }
        float d = segd_k(p, prev, q);
        if (d < dmin) { dmin = d; dAt = float(i) / 30.0; }
        prev = q;
    }
    float fade = 1.0 - dAt * 0.75;
    col += U.colA.rgb * exp(-dmin * 240.0) * (0.85 + U.energy * 0.7) * fade;
    col += U.colA.rgb * (0.010 / (dmin + 0.010)) * 0.22 * fade;
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// INTERFERENCE — consonance, as geometry. Wave sources make
// fringes; detune them and the fringes CRAWL at exactly the beat
// frequency — acoustic beating and moiré are one equation, and
// this room runs it. Every onset drops a stone in the pond; the
// ghost is a source of your own, arguing with the music's.
// ===============================================================
fragment float4 room_fringe(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect);
    float t = U.time;
    float moire = U.roll0 > 0.72 ? 1.0 : 0.0;
    float det = 0.4 + U.treble * 2.2;                    // the detuning, from the colour
    float psi = 0.0;
    if (moire > 0.5) {
        // MOIRÉ: three plane gratings, a hair rotated — beating in space
        for (int j = 0; j < 3; j++) {
            float fj = float(j);
            float a = fj * (0.05 + det * 0.02) + t * 0.02 * (fj - 1.0);
            float2 dir = float2(cos(a), sin(a));
            psi += cos(dot(p, dir) * (26.0 + fj * det) + t * 0.4);
        }
        psi /= 3.0;
    } else {
        int nsrc = U.roll0 < 0.4 ? 2 : 4;                // TWO SOURCES or THE POND
        for (int j = 0; j < 4; j++) {
            if (j >= nsrc) break;
            float fj = float(j);
            float2 s = float2(sin(t * (0.11 + fj * 0.021) + fj * 2.6),
                              cos(t * (0.09 + fj * 0.017) + fj * 1.3))
                     * (0.35 + 0.2 * hash11_k(fj + U.roll1 * 9.0));
            float amp = 0.5 + band_k(spectrum, 4 + j * 14) * 0.9;
            float d = length(p - s);
            float k = 22.0 + fj * det;
            psi += amp * cos(d * k - t * k * 0.14) / (1.0 + 0.9 * d);
        }
        psi /= float(nsrc) * 0.55;
    }
    // the ghost's own source
    if (U.ghostStrength > 0.08) {
        float d = length(p - ghostUp_k(U));
        psi += U.ghostStrength * cos(d * 30.0 - t * 4.5) / (1.0 + 0.9 * d);
    }
    // the stone the onset dropped: a transient packet riding out —
    // its radius recovered from the envelope's own decay clock
    if (U.onsetEnv > 0.02) {
        float age = -log(max(U.onsetEnv, 1e-3)) * 0.25;
        float rr = age * 2.4;
        float d = length(p) - rr;
        psi += U.onsetEnv * cos(d * 26.0) * exp(-d * d * 30.0) * 0.9;
    }
    float u = clamp(psi * 0.5 + 0.5, 0.0, 1.0);
    // the standing pattern: crests in one ink, troughs sinking to void
    float3 col = mix(U.colB.rgb * 0.06, U.colA.rgb * (0.55 + U.energy * 0.4), pow(u, 2.4));
    col += U.colC.rgb * pow(u, 8.0) * (0.5 + U.onsetEnv * 0.7);
    // the nodal lines — where the argument cancels, the quiet made visible
    col += U.colC.rgb * (1.0 - smoothstep(0.0, 0.08, abs(psi))) * 0.10;
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// JULIA — the boundary between counting that settles and counting
// that flees. z²+c iterated for real, c riding a slow orbit just
// off the Mandelbrot boundary (the dance, the seahorse valley,
// the dendrite's tip — dealt by the roll), the escape count drawn
// so deep space stays dark and the boundary itself glows. The
// interior wears the orbit trap's filigree. The ghost steers c.
// HEAVY.
// ===============================================================
fragment float4 room_julia(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect) * (1.35 - U.bass * 0.06);
    // the anchor and the orbit around it
    float2 anchor; float rad; float speed;
    if (U.roll0 < 0.4)      { anchor = float2(-0.16, 0.78);  rad = 0.16;  speed = 0.05; }
    else if (U.roll0 < 0.7) { anchor = float2(-0.745, 0.113); rad = 0.012; speed = 0.03; }
    else                    { anchor = float2(-0.10, 1.003);  rad = 0.02;  speed = 0.04; }
    float th = U.time * speed * TAU_K + U.roll1 * TAU_K;
    float2 c = anchor + float2(cos(th), sin(th)) * rad * (1.0 + U.energy * 0.3);
    if (U.ghostStrength > 0.08) c += ghostUp_k(U) * U.ghostStrength * 0.05;
    float2 z = p;
    float nu = -1.0, trap = 1e3;
    for (int i = 0; i < 96; i++) {
        z = float2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        float m2 = dot(z, z);
        trap = min(trap, abs(m2 - 0.24));
        if (m2 > 40.0) { nu = float(i) - log2(log2(m2)) + 4.0; break; }
    }
    float3 col;
    if (nu >= 0.0) {
        // slow escape = near the boundary = bright; deep space = dark
        float w = clamp(nu / 96.0, 0.0, 1.0);
        float3 ink = mix(U.colA.rgb, U.colB.rgb, fract(nu * 0.032 + U.roll2));
        col = ink * (0.05 + pow(w, 1.3) * 1.9) * (0.75 + U.energy * 0.45);
        col += U.colC.rgb * pow(w, 4.5) * (1.0 + U.onsetEnv * 0.9);
    } else {
        /* the interior: near-void — the keyed accent is bright now, and a
           broad exp(-trap*5) under it reads as a flat slab when c dips
           inside the Mandelbrot set. Only the orbit trap's own filigree
           gets to glow: a tight line where the orbit kisses the trap
           circle, and faint contour bands rippling away from it. */
        float fil = exp(-trap * 26.0);
        float bands = exp(-abs(fract(trap * 9.0) - 0.5) * 6.0) * exp(-trap * 3.0);
        col = U.colC.rgb * fil * (0.30 + U.bass * 0.30)
            + U.colB.rgb * bands * 0.10;
    }
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// POINCARÉ — all of infinity, indoors. The hyperbolic plane in
// its disc: a (p,q,2) triangle-group tiling folded out by wedge
// reflection and circle inversion, infinitely many cells crowding
// the rim that none of them reach. A Möbius pan glides the whole
// world without ever leaving the disc; the ghost gives the pan to
// the hand. Escher's Circle Limit, alive.
// ===============================================================
inline float2 mobius_k(float2 z, float2 a) {
    // (z - a) / (1 - conj(a) z), the disc's own translation
    float2 num = z - a;
    float2 den = float2(1.0 - (a.x * z.x + a.y * z.y), a.x * z.y - a.y * z.x);
    float d2 = max(dot(den, den), 1e-6);
    return float2(num.x * den.x + num.y * den.y, num.y * den.x - num.x * den.y) / d2;
}
fragment float4 room_escher(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect) * 1.12;
    float pp, qq;
    if (U.roll0 < 0.45)      { pp = 7.0; qq = 3.0; }
    else if (U.roll0 < 0.75) { pp = 5.0; qq = 4.0; }
    else                     { pp = 8.0; qq = 3.0; }
    float r0 = length(p);
    float3 col = float3(0.0);
    if (r0 < 1.0) {
        // the pan: a slow Möbius drift, leaning to the finger
        float2 drift = float2(cos(U.time * 0.05), sin(U.time * 0.041)) * (0.13 + U.onsetEnv * 0.05);
        if (U.ghostStrength > 0.08) drift += ghostUp_k(U) * U.ghostStrength * 0.25;
        float dl = length(drift);
        float2 z = mobius_k(p, drift * (min(dl, 0.9) / max(dl, 1e-4)));
        // the fold: wedge reflection + inversion in the tile's edge circle
        float A = PI_K / pp, B = PI_K / qq;
        float den = max(cos(A) * cos(A) - sin(B) * sin(B), 1e-4);
        float icd = cos(B) / sqrt(den);        // the edge circle's centre distance
        float icr = sin(A) / sqrt(den);        // and radius
        float folds = 0.0;
        for (int i = 0; i < 42; i++) {
            float ang = atan2(z.y, z.x);
            ang = abs(fmod(ang + A + TAU_K, 2.0 * A) - A);
            z = float2(cos(ang), sin(ang)) * length(z);
            float2 e = z - float2(icd, 0.0);
            float d2 = dot(e, e);
            if (d2 < icr * icr) {
                z = float2(icd, 0.0) + e * (icr * icr / max(d2, 1e-6));
                folds += 1.0;
            } else break;
        }
        // the fundamental cell: edge distance in the folded frame
        float edgeArc = abs(length(z - float2(icd, 0.0)) - icr);
        float edgeSp = abs(z.y);
        float edge = min(edgeArc, edgeSp);
        float checker = fmod(folds, 2.0);
        float3 tile = mix(U.colA.rgb * 0.16, U.colB.rgb * 0.30, checker);
        col = tile * (0.8 + U.energy * 0.4);
        // the lattice's bones, glowing on the beat
        col += U.colC.rgb * (1.0 - smoothstep(0.0, 0.02, edge)) * (0.55 + U.onsetEnv * 0.7);
        // depth: cells crowd and dim toward the rim, as the metric says
        col *= 1.0 - r0 * r0 * 0.35;
    }
    // the rim itself: the circle at infinity, breathing with the bass
    float rimGlow = exp(-abs(r0 - 1.0) * 40.0);
    col += mix(U.colA.rgb, U.colC.rgb, 0.5) * rimGlow * (0.25 + U.bass * 0.35);
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// QUASICRYSTAL — order without repetition. N plane waves at equal
// angles (five for Penrose, six for the periodic counter-example,
// seven for the strange one), each wave's amplitude one register
// of the live spectrum, RMS-normalized so the constructive peaks
// bloom as rosettes on near-void ground. Onsets kick one wave a
// quarter turn and the tiling re-decides itself.
// ===============================================================
fragment float4 room_penrose(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect);
    if (U.ghostStrength > 0.05) {
        float2 d = p - ghostUp_k(U);
        p += d * (U.ghostStrength * 0.35 / (dot(d, d) + 0.35));
    }
    float rot = U.time * 0.02;
    float ca = cos(rot), sa = sin(rot);
    p = float2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    float W = U.roll0 < 0.4 ? 5.0 : (U.roll0 < 0.7 ? 6.0 : 7.0);
    float K = 40.0 + sin(U.time * 0.05) * 5.0 - U.bass * 4.0;
    float psi = 0.0, asum = 0.0;
    for (int j = 0; j < 7; j++) {
        float fj = float(j);
        if (fj >= W) break;
        float ang = fj * (TAU_K / W);
        float amp = 0.55 + band_k(spectrum, 4 + j * 8) * 0.9;
        float ph = U.time * (0.10 + fj * 0.037) * (1.0 + U.energy * 1.2)
                 + hash11_k(fj + U.roll1 * 17.0) * TAU_K
                 + U.onsetEnv * step(fract(U.roll2 * 7.0 + fj * 0.618), 1.0 / W) * (PI_K * 0.5);
        psi += amp * cos(dot(p, float2(cos(ang), sin(ang))) * K + ph);
        asum += amp;
    }
    // RMS-normalized: peaks saturate, the ground goes dark
    float v = psi / max(asum * 0.8 / sqrt(2.0 * W), 0.3);
    float u = clamp(v * 0.27 + 0.5, 0.0, 1.0);
    float lv = v * 2.5;
    float ring = 1.0 - smoothstep(0.05, 0.14, abs(fract(lv + 0.5) - 0.5) * 0.4);
    float3 cA = mix(U.colA.rgb, U.colB.rgb, u * 0.6);
    float3 col = cA * (0.012 + pow(u, 4.2) * (0.9 + U.energy * 0.5));
    col += U.colC.rgb * pow(u, 9.0) * (0.6 + U.onsetEnv * 0.7);
    col += U.colC.rgb * ring * u * u * (0.12 + U.treble * 0.2);
    col += U.colC.rgb * smoothstep(2.1, 2.9, abs(v)) * (0.5 + U.onsetEnv * 0.6);
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// PHYLLOTAXIS — the flower that does number theory. Florets on
// the Vogel spiral, each 137.507° from the last — the most
// irrational turn there is — found per pixel by INVERTING the
// spiral (this pixel's radius names the floret index; a small
// window around it is searched). The flower breathes with the
// bass, the Fibonacci families light up one by one as the bars
// turn, and the ghost detunes the golden angle — the packing
// degenerates into spokes, then heals. CALM.
// ===============================================================
fragment float4 room_sunflower(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect);
    float cone = U.roll0 > 0.7 ? 1.0 : 0.0;
    float wrong = (U.roll0 > 0.35 && cone < 0.5) ? 1.0 : 0.0;
    if (cone > 0.5) { p.y = (p.y + length(p) * 0.16) / 0.82; }
    // the divergence angle: golden by right, swept by the wrong face,
    // bent by the finger — either way the spokes appear at once
    float ang = GOLD_K;
    if (wrong > 0.5) ang += sin(U.time * 0.11) * 0.0035;
    if (U.ghostStrength > 0.08) ang += ghostUp_k(U).x * 0.02 * U.ghostStrength;
    // the flower's population breathes upward with the song
    float total = 900.0 + 400.0 * clamp(U.act / 4.0 + U.energy * 0.3, 0.0, 1.0);
    float breathe = 1.0 + U.bass * 0.05 + U.onsetEnv * 0.02;
    float cg = 0.026 * breathe;
    float r = length(p);
    // invert Vogel: r = cg·√n  →  n ≈ (r/cg)²; search a window around it
    float n0 = clamp((r / cg) * (r / cg), 0.0, total);
    // the counting light walks the Fibonacci families, one per couple of bars
    float fams[4] = { 8.0, 13.0, 21.0, 34.0 };
    float famI = fmod(floor(U.time / 2.2), 4.0);
    float F = fams[int(famI)];
    float walk = fmod(floor(U.time / 2.2) * 5.0, F);
    float3 col = float3(0.0);
    for (int i = 0; i < 48; i++) {
        float n = floor(n0) + float(i) - 24.0;
        if (n < 1.0 || n > total) continue;
        float th = n * ang;
        float2 q = float2(cos(th), sin(th)) * cg * sqrt(n);
        float2 d = p - q;
        float aN = n / total;                       // old at the rim
        float sz = 0.0085 * (0.62 + aN * 0.95);
        float g = exp(-dot(d, d) / max(sz * sz, 1e-8));
        float fam = step(abs(fmod(n, F) - walk), 0.5);
        float3 c = mix(U.colA.rgb, U.colB.rgb, aN);
        c = mix(c, U.colC.rgb, exp(-(total - n) * 0.02) * 0.9);   // the newborn flare
        c = mix(c, float3(1.0, 0.98, 0.92), fam * 0.75);          // the counting light
        col += c * g * (0.62 + U.energy * 0.55 + fam * 0.8);
    }
    // the heart: where the next floret will be born
    col += U.colC.rgb * exp(-r * r * 900.0) * (0.4 + U.onsetEnv * 0.5);
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// SANDPILE — the avalanche that can't be predicted, retold under
// the closed-form licence. The pile's body is a diamond of
// quantized heights wearing the four-ink chord; its famous lace
// is the Sierpinski shadow the real identity element casts; and
// every onset sends an avalanche front — a Manhattan ring of
// embers — running down the slope. The ghost is a second spout,
// raising the ground where it pours.
// ===============================================================
fragment float4 room_sandpile(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float, access::read> spectrum [[texture(0)]],
                              texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_k(pos.xy, res, U.aspect);
    float twin = U.roll0 > 0.72 ? 1.0 : 0.0;
    float rain = (U.roll0 > 0.4 && twin < 0.5) ? 1.0 : 0.0;
    // the pile's footprint: L1 diamonds, one or two spouts
    float m;
    if (twin > 0.5) {
        float2 a = p - float2(-0.42, 0.05), b = p - float2(0.42, -0.02);
        m = min(abs(a.x) + abs(a.y), abs(b.x) + abs(b.y));
    } else {
        m = abs(p.x) + abs(p.y);
    }
    if (U.ghostStrength > 0.08) {
        float2 g = p - ghostUp_k(U);
        m = min(m, (abs(g.x) + abs(g.y)) / max(U.ghostStrength, 0.3) * 0.5);
    }
    float grow = clamp(max(U.act / 4.0, 0.35) + U.energy * 0.12, 0.0, 1.0);
    float Rpile = (rain > 0.5 ? 1.6 : 0.72 + grow * 0.35);
    float inside = smoothstep(Rpile, Rpile - 0.04, m);
    // the heights: counting to four, cell by cell — layered noise quantized,
    // laced by the Sierpinski shadow (the identity's own self-similarity)
    float G = 90.0;
    float2 cell = floor(p * G);
    int ix = int(cell.x + 512.0), iy = int(cell.y + 512.0);
    float sier = float((ix & iy) & 5);                    // the lace mask
    float hfld = fbm3_k(cell * 0.11 + U.roll1 * 31.0) * 3.2
               + fbm3_k(cell * 0.031 + U.roll2 * 17.0) * 1.6
               - m * 1.4 + sier * 0.35;
    float hv = clamp(floor(fmod(hfld, 4.0)), 0.0, 3.0) * inside;
    if (rain > 0.5) {
        // RAIN: sparse patches on open void, no single mountain
        float patch = step(0.42, fbm3_k(cell * 0.06 + U.roll1 * 7.0));
        hv *= patch;
    }
    float3 c1 = U.colA.rgb, c2 = U.colB.rgb, c3 = U.colC.rgb;
    float3 col = float3(0.0);
    col = mix(col, c1 * 0.16, smoothstep(0.15, 0.85, hv));
    col = mix(col, c2 * 0.55, smoothstep(1.15, 1.85, hv));
    col = mix(col, c3 * 1.15, smoothstep(2.15, 2.85, hv));
    col *= 0.75 + U.energy * 0.35;
    // the avalanche: an ember front on the L1 metric, running out on the
    // onset — its radius recovered from the envelope's own decay clock
    if (U.onsetEnv > 0.02) {
        float age = -log(max(U.onsetEnv, 1e-3)) * 0.25;
        float rr = age * 1.7;
        float front = exp(-(m - rr) * (m - rr) * 260.0);
        col += mix(c3, float3(1.0, 0.97, 0.9), 0.5) * front * inside * U.onsetEnv * (1.2 + U.bass * 0.8);
    }
    // the standing shimmer of grains still settling
    col += c3 * step(0.985, hash21_k(cell + floor(U.time * 6.0))) * inside * 0.35;
    col += (hash21_k(pos.xy) - 0.5) * 0.006;
    return float4(govern_k(VOID_K + max(col, float3(0.0)), U.white), 1.0);
}
