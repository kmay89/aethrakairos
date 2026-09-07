#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 4 — ARCADE, CONSTELLATIONS, EXCITABLE, VERSE.
   Single-triangle fragment shaders, one per room, nothing else.
   These four close the roster to twenty-six.

   The same laws that rule Shaders.metal (and Shaders2..5.metal) rule
   here, copied verbatim from wave 1:
   - The ground is the void (#05060e). A room ADDS light onto it; it
     never paints a theme over it.
   - Colours come ONLY from the track's chord (colA/colB/colC). No
     hardcoded rainbows — a rainbow must be earned upstream, in the
     palette, by the music's own entropy and energy. The one sanctioned
     exception is EXCITABLE's white-hot activation front, which the
     room's own spec names as white — and even that is tinted a hair
     toward the chord and held under the governor.
   - WCAG 2.3.1 is a law: govern_e() caps luminance at every exit using
     the INK white budget, so additive enthusiasm becomes saturation
     and never a white strobe. Every beat answer is a breath of
     geometry (a few percent of scale), never a luminance flash.
   - r32Float is not filterable on the living-room GPUs, so the
     spectrum/waveform strips are read by INTEGER TEXEL and lerped by
     hand. VERSE reads a third strip — a 256x64 r8Unorm TEXT MASK at
     texture(2) — the same way, by integer texel.
   - ghostStrength is the phantom hand: before shaping, a room leans its
     coordinate toward (ghostX, ghostY) inside a soft attraction well.
   - roll0..2 are the room's dice, re-dealt on entry — ARCADE deals its
     game, CONSTELLATIONS its sidereal time, EXCITABLE its regime, VERSE
     its lattice jitter, so a room never wears the same face twice.
   - Every accumulation loop is bounded by a compile-time literal
     (<= 96 iterations); no data-dependent trip counts.

   This is a SELF-CONTAINED translation unit. Every constant and helper
   wears an _e suffix so its symbol never collides with the identically
   shaped helpers in the other room units (a helper cannot cross a
   Metal translation unit, and file-scope names must not clash at link).
   ================================================================ */

constant float PI_E  = 3.14159265359;
constant float TAU_E = 6.28318530718;

// the void ground — #05060e in the linear-ish working space
constant float3 VOID_E = float3(0.019608, 0.023529, 0.054902);

// ---------------------------------------------------------------
// THE FINAL VizUniforms — verbatim, byte-for-byte identical across
// Shaders.metal, Shaders2..6.metal, Xforms.metal, Lens.metal and the
// mirror Swift struct. The layout is FIXED at 144 bytes; these rooms
// never read the lens, so the last three floats keep the neutral pad
// names here — what matters is three floats there, at the right bytes.
// ---------------------------------------------------------------
struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11  (was _pad0)
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140  -> stride 144
};

// ---------------------------------------------------------------
// helpers (all _e — this file's private ladder)
// ---------------------------------------------------------------

inline float lumaOf_e(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// The flash governor, doubling as the INK budget — the wave-1 curve
// copied exactly: the cap widens with the white budget, so a quiet
// verse stays well under 1.0 while a drop is allowed to overdrive and
// the downstream GRADE rolls the overdrive off into saturation.
inline float3 govern_e(float3 c, float white) {
    float L = lumaOf_e(c);
    float cap = 0.70 + 1.6 * clamp(white, 0.0, 1.0);   // 0.78 (verse) .. 2.17 (drop)
    return (L > cap && L > 1e-4) ? c * (cap / L) : c;
}

// sin-dot hashes: 1->1 and 2->1
inline float hash11_e(float x) {
    return fract(sin(x * 12.9898) * 43758.5453123);
}
inline float hash21_e(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

// value-noise ladder: bilinear value noise -> 4-octave fbm
inline float vnoise_e(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_e(i);
    float b = hash21_e(i + float2(1.0, 0.0));
    float c = hash21_e(i + float2(0.0, 1.0));
    float d = hash21_e(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
inline float fbm4_e(float2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * vnoise_e(p);
        p = p * 2.03 + float2(17.7, 9.2);
        a *= 0.5;
    }
    return v;
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands.
// Manual lerp — the filterability law forbids a linear sampler here.
inline float band64_e(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel position -> centered, aspect-true coordinates (y in -1..1,
// positive DOWN — the framebuffer's own sense).
inline float2 centered_e(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    return p;
}

// the phantom hand — the wave-1 attraction well, verbatim.
inline float2 ghostWarp_e(float2 p, float gx, float gy, float gs) {
    if (gs <= 0.0) return p;
    float2 g = float2(gx, gy);
    float2 d = p - g;
    float r = length(d) + 1e-3;
    float pull = gs * 0.22 / (r + 0.30);
    return p - d * pull;
}

// a triangle wave 0..1..0 with unit period
inline float tri_e(float x) { float f = x - floor(x); return abs(2.0 * f - 1.0); }

// a soft-edged filled box: 1 inside, a thin smooth rim, 0 outside
inline float box_e(float2 p, float2 c, float2 h) {
    float2 d = abs(p - c) - h;
    return 1.0 - smoothstep(0.0, 0.006, max(d.x, d.y));
}

// perpendicular distance from p to the segment a->b
inline float segDist_e(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

// ---------------------------------------------------------------
// the one triangle is declared in Shaders.metal (fullscreen_vertex);
// these rooms reuse that vertex stage — no vertex function here.
// ---------------------------------------------------------------


// ===============================================================
// ARCADE — a CRT attract mode: a low-res game field wrapped in a
// television. The game is dealt by roll0 (INVADERS / BRICKS / PONG /
// SNAKE), drawn purely closed-form — no game state, no history — with
// the ranks / bricks / walls LIT BY THE SPECTRUM and every move landing
// on the half-beat off barPhase. Then the field is put behind glass:
// barrel distortion, scanlines, a slot mask, halation (the CRT bloom),
// a bezel and a faint cabinet spill. The cheapest room in the house
// after the meter — one screen-in-a-screen, unmistakable.
// ===============================================================

// INVADERS — five ranks × eight columns, the bottom rank on the bass,
// the top rank on the treble; the formation sweeps and steps down, the
// cannon jumps to a half-beat slot, an onset fires the shot.
inline float3 arcadeInvaders_e(float2 s, constant VizUniforms& U,
                               texture2d<float, access::read> spec) {
    float3 c = float3(0.0);
    float stp   = floor(U.time * 3.0);                     // stepped clock — retro march
    float sweep = (tri_e(U.time * 0.08) - 0.5) * 0.13;     // side-to-side
    float drop  = 0.016 * floor(fract(U.time * 0.018) * 5.0);
    for (int r = 0; r < 5; r++) {
        float band = band64_e(spec, 1.0 - float(r) / 4.0); // r0 top = treble, r4 bottom = bass
        float y    = 0.12 + drop + float(r) * 0.056;
        float3 rc  = mix(U.colA.rgb, U.colC.rgb, float(r) / 4.0);
        for (int col = 0; col < 8; col++) {
            float x   = 0.15 + sweep + float(col) * 0.097;
            float wig = (fmod(stp + float(col), 2.0) < 1.0) ? 1.0 : -1.0;   // arms flap
            float m   = box_e(s, float2(x - 0.011, y + wig * 0.004), float2(0.010, 0.009))
                      + box_e(s, float2(x + 0.011, y - wig * 0.004), float2(0.010, 0.009))
                      + box_e(s, float2(x, y), float2(0.017, 0.008));
            m = clamp(m, 0.0, 1.0);
            c += rc * m * (0.22 + 0.95 * band);
        }
    }
    // the cannon — jumps to the half-beat slot (barPhase drives it)
    float cx = 0.12 + floor(U.barPhase * 8.0) / 7.0 * 0.76;
    c += U.colB.rgb * box_e(s, float2(cx, 0.90),  float2(0.030, 0.016)) * 0.9;
    c += U.colB.rgb * box_e(s, float2(cx, 0.876), float2(0.006, 0.012)) * 0.9;
    // the shot — born on the onset, climbing as the hit decays
    float shotY = 0.87 - U.onsetEnv * 0.66;
    c += U.colC.rgb * box_e(s, float2(cx, shotY), float2(0.004, 0.028)) * U.onsetEnv * 1.3;
    return c;
}

// BRICKS — the wall IS the live spectrum: each column reads its band,
// higher courses need a louder band to survive, so the wall crumbles
// to the shape of the music. A closed-form ball, the paddle on the beat.
inline float3 arcadeBricks_e(float2 s, constant VizUniforms& U,
                             texture2d<float, access::read> spec) {
    float3 c = float3(0.0);
    const int COLS = 10, ROWS = 6;
    float by = (s.y - 0.10) / 0.40;
    if (by >= 0.0 && by < 1.0) {
        float fxr = s.x * float(COLS);
        float fyr = by * float(ROWS);
        int ci = int(fxr), ri = int(fyr);
        float fx = fract(fxr), fy = fract(fyr);
        float mortar = smoothstep(0.0, 0.07, fx) * smoothstep(1.0, 0.93, fx)
                     * smoothstep(0.0, 0.12, fy) * smoothstep(1.0, 0.88, fy);
        float band    = band64_e(spec, float(ci) / float(COLS - 1));
        float thr     = float(ri) / float(ROWS) * 0.75;
        float present = smoothstep(thr, thr + 0.14, band);
        float3 bc     = mix(U.colA.rgb, U.colC.rgb, float(ri) / float(ROWS - 1));
        c += bc * mortar * present * (0.28 + 0.7 * band);
    }
    // the ball — a closed-form bounce
    float bx  = 0.5 + 0.42 * sin(U.time * 1.7);
    float byy = 0.60 + 0.30 * tri_e(U.time * 0.55);
    float2 db = s - float2(bx, byy);
    c += U.colB.rgb * exp(-dot(db, db) * 5500.0) * (0.9 + 0.7 * U.onsetEnv);
    // the paddle — on the half-beat
    float px = 0.12 + floor(U.barPhase * 8.0) / 7.0 * 0.76;
    c += U.colB.rgb * box_e(s, float2(px, 0.94), float2(0.05, 0.013)) * 0.9;
    return c;
}

// PONG — a dashed net, a ball on two triangle waves, and two paddles
// whose tracking error grows with energy so the point falls on the drop.
inline float3 arcadePong_e(float2 s, constant VizUniforms& U,
                           texture2d<float, access::read> spec) {
    float3 c = float3(0.0);
    float net = box_e(s, float2(0.5, s.y), float2(0.003, 1.0)) * step(0.5, fract(s.y * 20.0));
    c += U.colA.rgb * net * 0.12;
    float bx  = 0.08 + 0.84 * (0.5 + 0.5 * sin(U.time * 1.3));
    float byy = 0.12 + 0.76 * tri_e(U.time * 0.52);
    float2 db = s - float2(bx, byy);
    c += U.colC.rgb * exp(-dot(db, db) * 6500.0) * (0.9 + 0.6 * U.onsetEnv);
    float err = U.energy * 0.16 * sin(U.time * 2.3);       // the miss grows with loudness
    float lp  = clamp(byy + err,        0.12, 0.88);
    float rp  = clamp(byy - err * 0.7,  0.12, 0.88);
    c += U.colB.rgb * box_e(s, float2(0.06, lp), float2(0.012, 0.06)) * 0.9;
    c += U.colB.rgb * box_e(s, float2(0.94, rp), float2(0.012, 0.06)) * 0.9;
    return c;
}

// SNAKE — a serpentine path advanced on the half-beat, the body its
// last eleven cells resolved closed-form (head minus j), a food pellet
// re-homed each full traversal. No stored grid; the path IS the state.
inline float3 arcadeSnake_e(float2 s, constant VizUniforms& U,
                            texture2d<float, access::read> spec) {
    float3 c = float3(0.0);
    const int GW = 12, GH = 9, TOT = GW * GH;
    float2 cf = float2(s.x * float(GW), s.y * float(GH));
    int cx = int(cf.x), cy = int(cf.y);
    float2 fc = fract(cf) - 0.5;
    int head = int(floor(U.time * 4.0));
    float body = 0.0, headGlow = 0.0;
    for (int j = 0; j < 11; j++) {
        int tt  = ((head - j) % TOT + TOT) % TOT;          // wrap negatives home
        int row = tt / GW;
        int cc  = ((row & 1) == 0) ? (tt % GW) : (GW - 1 - (tt % GW));  // boustrophedon
        if (cc == cx && row == cy) {
            body = max(body, 1.0 - float(j) * 0.06);
            if (j == 0) headGlow = 1.0;
        }
    }
    float cell = 1.0 - smoothstep(0.32, 0.46, max(abs(fc.x), abs(fc.y)));
    c += mix(U.colA.rgb, U.colC.rgb, 0.5) * body * cell * 0.85;
    c += U.colB.rgb * headGlow * cell * (0.4 + 0.7 * U.onsetEnv);
    int fstep = head / TOT;
    int fcx = int(hash11_e(float(fstep) * 3.7) * float(GW));
    int fcy = int(hash11_e(float(fstep) * 7.1) * float(GH));
    if (fcx == cx && fcy == cy)
        c += U.colB.rgb * (1.0 - smoothstep(0.20, 0.36, length(fc))) * (0.7 + 0.4 * sin(U.time * 6.0));
    return c;
}

fragment float4 room_arcade(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));

    // the glass: to -1..1, the ghost leans the tube, then a barrel bulge
    float2 q = uv * 2.0 - 1.0;
    q = ghostWarp_e(q, U.ghostX, U.ghostY, U.ghostStrength);
    float r2 = dot(q, q);
    q *= 1.0 + 0.11 * r2;
    float2 s = q * 0.5 + 0.5;                              // screen uv

    // a rounded-rect tube: signed distance so bezel and vignette read clean
    float2 he = float2(0.94, 0.90);
    float rad = 0.08;
    float2 d2 = abs(q) - he + rad;
    float sdr = length(max(d2, float2(0.0))) + min(max(d2.x, d2.y), 0.0) - rad;
    float inScreen = 1.0 - smoothstep(0.0, 0.006, sdr);
    float bezel    = smoothstep(0.14, 0.0, sdr) * step(0.0, sdr);

    // the dealt game (roll0), all closed-form
    int game = int(floor(clamp(U.roll0, 0.0, 0.999) * 4.0));
    float3 ink;
    if      (game == 0) ink = arcadeInvaders_e(s, U, spectrum);
    else if (game == 1) ink = arcadeBricks_e(s, U, spectrum);
    else if (game == 2) ink = arcadePong_e(s, U, spectrum);
    else                ink = arcadeSnake_e(s, U, spectrum);

    // CRT dressing — scanlines, slot mask, halation (the cheap bloom)
    float scan = 0.82 + 0.18 * (0.5 + 0.5 * cos(s.y * 200.0 * PI_E));
    float mph = fract(pos.x / 3.0);                         // device-pixel triads
    float3 mask = float3(mph < 0.3333 ? 1.18 : 0.86,
                         (mph >= 0.3333 && mph < 0.6667) ? 1.18 : 0.86,
                         mph >= 0.6667 ? 1.18 : 0.86);
    float3 col = ink * scan * mask;
    col += ink * 0.35;                                      // halation glow
    col *= inScreen;
    col *= (1.0 - 0.35 * r2);                               // tube vignette

    // the set: a plastic bezel with a faint chord-lit cabinet spill
    col += float3(0.10, 0.10, 0.12) * bezel;
    col += U.colB.rgb * bezel * 0.06 * (0.6 + 0.4 * sin(U.time * 0.7));

    col += (hash21_e(pos.xy) - 0.5) * 0.004;
    return float4(govern_e(VOID_E + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// CONSTELLATIONS — a real night sky from a small embedded star table.
// Orion, the Plough and the W of Cassiopeia are hardcoded as bright
// stars with recognisable line figures; a scatter of first-magnitude
// stars (Sirius, Vega, Capella, Altair...) fills the rest of the dome.
// The stars twinkle; a gold pen (the chord's warm stop) traces the
// figures paced on the beat; the brightest star wears a six-point
// diffraction flare; the sky is tinted from the chord's cool stop.
// A rolled sidereal time pans the field per visit.
//
// NOTE on the table: each entry is the star's alt-azimuth position
// already PROJECTED onto the sky plane (x ~ azimuthal, y ~ altitudinal,
// both -1..1) with its apparent magnitude carried as a 0..1 brightness
// in z. Storing the projected position keeps the runtime free of a
// per-star trig projection (a handful of stars, drawn every frame) and
// keeps the asterisms recognisable; the connecting line figures carry
// the identity regardless. A rotation stands in for sidereal drift.
// ===============================================================

constant float3 STAR_E[27] = {
    // --- Orion --- (0 = Betelgeuse, the flare star)
    float3(-0.62,  0.18, 1.00),   // 0  Betelgeuse
    float3(-0.40,  0.24, 0.70),   // 1  Bellatrix
    float3(-0.60, -0.05, 0.75),   // 2  Alnitak (belt)
    float3(-0.52, -0.10, 0.85),   // 3  Alnilam (belt)
    float3(-0.44, -0.15, 0.70),   // 4  Mintaka (belt)
    float3(-0.66, -0.40, 0.65),   // 5  Saiph
    float3(-0.40, -0.46, 0.90),   // 6  Rigel
    // --- the Plough / Big Dipper ---
    float3( 0.30,  0.55, 0.80),   // 7  Dubhe
    float3( 0.30,  0.40, 0.68),   // 8  Merak
    float3( 0.46,  0.36, 0.62),   // 9  Phecda
    float3( 0.46,  0.52, 0.58),   // 10 Megrez
    float3( 0.60,  0.56, 0.70),   // 11 Alioth
    float3( 0.72,  0.60, 0.72),   // 12 Mizar
    float3( 0.86,  0.58, 0.80),   // 13 Alkaid
    // --- Cassiopeia (the W) ---
    float3(-0.30,  0.62, 0.68),   // 14
    float3(-0.20,  0.74, 0.58),   // 15
    float3(-0.10,  0.64, 0.72),   // 16
    float3( 0.00,  0.76, 0.58),   // 17
    float3( 0.10,  0.66, 0.66),   // 18
    // --- scattered bright stars (no figure) ---
    float3(-0.85, -0.62, 0.95),   // 19 Sirius
    float3( 0.55, -0.20, 0.85),   // 20 Vega
    float3( 0.10,  0.05, 0.66),   // 21 Capella
    float3(-0.20, -0.30, 0.68),   // 22 Aldebaran
    float3(-0.78, -0.22, 0.58),   // 23 Procyon
    float3( 0.22, -0.52, 0.54),   // 24 Pollux
    float3( 0.70, -0.55, 0.60),   // 25 Altair
    float3( 0.40,  0.10, 0.58)    // 26 Deneb
};

// the line figures, as index pairs into STAR_E (18 segments <= 32)
constant int2 SEG_E[18] = {
    int2(0,1), int2(0,2), int2(1,4), int2(2,3), int2(3,4), int2(2,5), int2(4,6),   // Orion
    int2(7,8), int2(8,9), int2(9,10), int2(10,7), int2(10,11), int2(11,12), int2(12,13), // Plough
    int2(14,15), int2(15,16), int2(16,17), int2(17,18)                              // Cassiopeia
};

fragment float4 room_sky(float4 pos [[position]],
                         constant VizUniforms& U [[buffer(0)]],
                         constant float2& res [[buffer(1)]],
                         texture2d<float, access::read> spectrum [[texture(0)]],
                         texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 pp = centered_e(pos.xy, res, U.aspect);
    pp = ghostWarp_e(pp, U.ghostX, U.ghostY, U.ghostStrength);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // sidereal pan: a rolled offset plus a very slow drift. Rotate the
    // sample point (cheaper than rotating every star) into star space,
    // flipping y so the table reads the usual maths-up sense.
    float ang = U.roll2 * TAU_E + U.time * 0.004;
    float ca = cos(ang), sa = sin(ang);
    float2 sp0 = float2(pp.x, -pp.y);
    float2 pr = float2(sp0.x * ca - sp0.y * sa, sp0.x * sa + sp0.y * ca);

    // the sky itself — void tinted from the chord's cool stop, faintly
    // brighter low on the dome
    float3 col = U.colC.rgb * (0.015 + 0.020 * clamp(0.5 + pr.y * 0.5, 0.0, 1.0));

    // a faint micro-starfield so the dome is never a hole between the
    // named stars
    {
        float2 g = pr * 68.0;
        float2 cc = floor(g);
        float2 f  = fract(g) - 0.5;
        float h   = hash21_e(cc + 4.2);
        col += mix(float3(0.8), U.colC.rgb, 0.4)
             * smoothstep(0.992, 1.0, h) * exp(-dot(f, f) * 42.0) * 0.10;
    }

    // --- the gold pen: trace the figures paced on the beat ---
    // The pen advances through the 18 segments over a phrase (with a slow
    // time drift so it keeps moving even without a beat grid); a segment
    // is drawn up to its own fraction, and a bright tip rides the head.
    float penCycle = fract(U.phrasePhase + U.time * 0.010);
    float penProg  = penCycle * 18.0;
    float gold = 0.0, tip = 0.0;
    for (int k = 0; k < 18; k++) {
        float drawn = clamp(penProg - float(k), 0.0, 1.0);
        if (drawn <= 0.0) continue;
        int2 e  = SEG_E[k];
        float2 A = STAR_E[e.x].xy;
        float2 B = mix(STAR_E[e.x].xy, STAR_E[e.y].xy, drawn);
        float d  = segDist_e(pr, A, B);
        gold += exp(-d * d / (0.006 * 0.006));
        if (drawn < 1.0) {
            float2 td = pr - B;
            tip += exp(-dot(td, td) / (0.020 * 0.020));
        }
    }
    float3 penCol = mix(U.colB.rgb, U.colC.rgb, 0.25);
    col += penCol * clamp(gold, 0.0, 1.5) * 0.45 * (0.6 + 0.6 * coreScale);
    col += mix(float3(1.0), U.colC.rgb, 0.3) * tip * (0.5 + 0.6 * U.onsetEnv) * coreScale;

    // --- the stars: twinkle, breathe on the onset ---
    for (int i = 0; i < 27; i++) {
        float2 sp = STAR_E[i].xy;
        float br  = STAR_E[i].z;
        float2 d  = pr - sp;
        float dd  = dot(d, d);
        float tw  = 0.55 + 0.45 * sin(U.time * (1.0 + 1.5 * hash11_e(float(i) * 1.3)) + float(i) * 2.0);
        float mag = br * (0.75 + 0.55 * tw) * (1.0 + 0.4 * U.onsetEnv);
        float core = exp(-dd * 1400.0);
        float halo = exp(-dd *  120.0) * 0.22;
        float3 starCol = mix(float3(0.90, 0.93, 1.0), U.colC.rgb, 0.35);
        col += starCol * (core + halo) * mag * (0.6 + 0.5 * coreScale);
    }

    // --- the diffraction flare on the brightest (star 0) ---
    {
        float2 fp = STAR_E[0].xy;
        float2 fd = pr - fp;
        float fr = length(fd);
        float fang = atan2(fd.y, fd.x);
        float spikes = pow(abs(cos(3.0 * fang)), 40.0);    // six lobes over 2*pi (base >= 0)
        float flare = spikes * exp(-fr * 7.0);
        float rz    = (fr - 0.05) / 0.02;                  // squared by hand — pow() NaNs on a signed base
        float ring  = exp(-rz * rz) * 0.4;
        col += mix(float3(1.0), U.colC.rgb, 0.30)
             * (flare * (0.8 + 0.7 * U.onsetEnv) + ring) * STAR_E[0].z * (0.5 + 0.6 * coreScale);
    }

    col += (hash21_e(pos.xy) - 0.5) * 0.004;
    return float4(govern_e(VOID_E + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// EXCITABLE — an excitable-medium look, synthesised analytically since
// the room pipeline is stateless (no feedback buffer). A small sum of
// rotating phase fields sin(k*r - omega*t + m*theta) makes spiral and
// target waves; a sharp threshold band is the white-hot activation
// FRONT (a smoothstep-narrow band where the wave crosses), the region
// just behind it is the ash coloured from the chord. An onset resets
// the phase (a fresh wavefront is born) and brightens the fronts;
// loudness runs the clock (omega rides energy, and U.time is already
// the energy-scaled musical clock). roll0 deals the regime.
// ===============================================================
fragment float4 room_barkley(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 pp = centered_e(pos.xy, res, U.aspect);
    pp = ghostWarp_e(pp, U.ghostX, U.ghostY, U.ghostStrength);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float omega = 1.2 + 3.0 * U.energy;                    // loudness runs the clock
    float k     = 6.0 + 3.0 * U.roll1;                     // radial wavenumber
    int regime  = int(floor(clamp(U.roll0, 0.0, 0.999) * 3.0)); // 0 spiral, 1 target, 2 storm
    float onKick = U.onsetEnv * 3.0;                       // the phase reset — a wave is born

    // the sources: a centred spiral/target plus two rolled off-centre
    // sources the storm regime lights as well.
    float2 ctr[3];
    ctr[0] = float2(0.0, 0.0);
    ctr[1] = float2(mix(-0.6, 0.6, hash11_e(U.roll2 * 3.1)),
                    mix(-0.5, 0.5, hash11_e(U.roll2 * 7.7)));
    ctr[2] = float2(mix(-0.6, 0.6, hash11_e(U.roll2 * 5.3 + 1.0)),
                    mix(-0.5, 0.5, hash11_e(U.roll2 * 9.1 + 2.0)));
    float m0   = (regime == 1) ? 0.0 : (regime == 2 ? 2.0 : 1.0); // target has no arm
    int   nUse = (regime == 2) ? 3 : 1;

    float exc = 0.0, frnt = 0.0;
    for (int i = 0; i < 3; i++) {
        if (i >= nUse) break;
        float2 d = pp - ctr[i];
        float r  = length(d) + 1e-4;
        float th = atan2(d.y, d.x);
        float mi = (i == 0) ? m0 : (1.0 + float(i));
        float phase = k * r - omega * U.time + mi * th + onKick + float(i) * 2.1;
        float sv = sin(phase);
        float e  = smoothstep(0.15, 0.55, sv);             // the excited ash region
        float fz = (sv - 0.72) / 0.09;                     // (squared by hand — pow() NaNs on a signed base)
        float f  = exp(-fz * fz);                          // the thin activation front
        exc  = max(exc, e);
        frnt = max(frnt, f);
    }

    // the resting medium is a dark cool wash; the ash carries the chord;
    // the front burns near-white (tinted a hair to the cool stop, held
    // under the governor — the room's one sanctioned white).
    float vign = 0.55 + 0.55 * exp(-dot(pp, pp) * 0.30);
    float3 col = U.colC.rgb * 0.06;
    col += mix(U.colA.rgb, U.colB.rgb, exc) * exc * (0.35 + 0.5 * U.energy) * vign;
    col += mix(float3(1.0), U.colC.rgb, 0.15) * frnt * (0.5 + 0.8 * U.onsetEnv) * (0.4 + 0.7 * coreScale);

    col += (hash21_e(pos.xy) - 0.5) * 0.004;
    return float4(govern_e(VOID_E + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// VERSE — dots assemble the current track's words. The renderer
// rasterises the title (fallback: the album line) into a 256x64 mask
// bound at texture(2); this room reads it by integer texel. A lattice
// of ~1856 dots (a 58x32 grid, one dot per cell) drifts as a nebula;
// on the phrase clock the dots whose home lands on a lit glyph pixel
// CONVERGE onto it and brighten while the rest fade, spelling the word
// out of the cloud; the word breathes on the beat, its edges ignite
// with treble, then it dissolves back to the drifting nebula. If the
// mask is empty (no word yet) the room stays a drifting nebula — never
// a blank room.
//
// The dots are rendered without a 2000-iteration loop: each screen cell
// owns one dot, and a pixel only gathers the 3x3 neighbourhood around
// it, so the field is ~1856 dots at nine reads a pixel.
// ===============================================================

// sample the text mask under a screen-uv point. The word occupies a
// centred band x in [0.08,0.92], y in [0.40,0.60]; outside it, 0.
inline float sampleWord_e(texture2d<float, access::read> wordTex, float2 uv) {
    float2 b = (uv - float2(0.08, 0.40)) / float2(0.84, 0.20);
    if (b.x < 0.0 || b.x > 1.0 || b.y < 0.0 || b.y > 1.0) return 0.0;
    uint tx = uint(clamp(b.x, 0.0, 1.0) * 255.0);
    uint ty = uint(clamp(b.y, 0.0, 1.0) *  63.0);
    return wordTex.read(uint2(tx, ty)).r;
}

// a four-tap edge measure on the mask — the glyph rim, where treble ignites
inline float glyphEdge_e(texture2d<float, access::read> wordTex, float2 uv) {
    float c = sampleWord_e(wordTex, uv);
    float e = 0.0;
    e += abs(c - sampleWord_e(wordTex, uv + float2(0.010, 0.0)));
    e += abs(c - sampleWord_e(wordTex, uv - float2(0.010, 0.0)));
    e += abs(c - sampleWord_e(wordTex, uv + float2(0.0, 0.018)));
    e += abs(c - sampleWord_e(wordTex, uv - float2(0.0, 0.018)));
    return clamp(e, 0.0, 1.0);
}

// coarse coverage probe — is there a word in the mask at all?
inline float wordCoverage_e(texture2d<float, access::read> wordTex) {
    float s = 0.0;
    for (int y = 0; y < 4; y++)
        for (int x = 0; x < 6; x++) {
            uint tx = uint(float(x) / 5.0 * 255.0);
            uint ty = uint(float(y) / 3.0 *  63.0);
            s += wordTex.read(uint2(tx, ty)).r;
        }
    return s / 24.0;
}

fragment float4 room_verse(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]],
                           texture2d<float, access::read> wordTex  [[texture(2)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 pp = ghostWarp_e(centered_e(pos.xy, res, U.aspect), U.ghostX, U.ghostY, U.ghostStrength);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // --- the drifting nebula floor (always present, so never blank) ---
    float2 qn = pp * 1.3;
    float tn = U.time * 0.04;
    float n1 = fbm4_e(qn + float2(tn, -tn * 0.7));
    float n2 = fbm4_e(qn * 1.9 + (n1 - 0.5) * 1.6 + float2(-tn * 0.5, tn * 0.4));
    float dens = smoothstep(0.45, 0.90, n2);
    float3 col = mix(U.colA.rgb, U.colC.rgb, clamp(n1 * 1.4 - 0.2, 0.0, 1.0))
               * dens * (0.10 + 0.18 * U.mid) * exp(-dot(pp, pp) * 0.30);

    // --- the assembly cycle: rise, hold (breathing), dissolve ---
    float coverage = wordCoverage_e(wordTex);
    float hasWord  = step(0.004, coverage);
    float cyc = fract(U.phrasePhase + U.time * 0.02);      // advances even without a grid
    float assemble = smoothstep(0.03, 0.30, cyc) * (1.0 - smoothstep(0.68, 0.98, cyc));
    assemble *= hasWord;
    float breath = 1.0 + 0.06 * sin(U.beatPhase * TAU_E);

    // --- the dot lattice: one dot per cell, gathered over the 3x3 hood ---
    const float GNx = 58.0, GNy = 32.0;
    float2 gcoord   = uv * float2(GNx, GNy);
    float2 baseCell = floor(gcoord);
    float sig = 0.32 / GNx;
    float3 dots = float3(0.0);
    for (int dj = -1; dj <= 1; dj++) {
        for (int di = -1; di <= 1; di++) {
            float2 cell = baseCell + float2(float(di), float(dj));
            if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= GNx || cell.y >= GNy) continue;
            float h1 = hash21_e(cell + 3.1);
            float h2 = hash21_e(cell + 9.7);
            float h3 = hash21_e(cell + 17.3);
            float2 home = (cell + float2(0.5) + (float2(h1, h2) - 0.5) * 0.5) / float2(GNx, GNy);

            float lit = sampleWord_e(wordTex, home);
            float converge = lit * assemble;

            // nebula wander, kept under half a cell so the 3x3 gather holds
            float wt = U.time * 0.15 + h3 * TAU_E;
            float2 wander = float2(cos(wt), sin(wt * 1.3)) * (0.45 / GNx) * (0.5 + 0.5 * h1);
            float2 dpos = home + wander * (1.0 - converge);
            dpos.y = 0.5 + (dpos.y - 0.5) * mix(1.0, breath, converge);   // the word breathes

            float2 dd = uv - dpos;
            dd.x *= U.aspect;                                  // round dots on a wide frame
            float g = exp(-dot(dd, dd) / (sig * sig));

            float nebBright  = (1.0 - assemble) * (0.25 + 0.4 * h2);
            float wordBright = lit * assemble * (0.7 + 0.6 * coreScale);
            float3 wcol = U.colB.rgb;
            if (lit > 0.01) {
                float edge = glyphEdge_e(wordTex, home);
                wordBright += lit * assemble * edge * U.treble * 1.2;      // treble lights the rim
                wcol = mix(U.colB.rgb, U.colC.rgb, edge);
            }
            float3 ncol = mix(U.colA.rgb, U.colC.rgb, h1);
            dots += g * (nebBright * ncol + wordBright * wcol);
        }
    }

    col += dots;
    col += (hash21_e(pos.xy) - 0.5) * 0.005;
    return float4(govern_e(VOID_E + max(col, float3(0.0)), U.white), 1.0);
}
