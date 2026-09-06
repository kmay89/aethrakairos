#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 2 (A) — FRACTAL FIELD, FIREWORKS, OIL FILM, MANDALA.
   Single-triangle fragment shaders, one per room, nothing else.

   The same laws that rule Shaders.metal rule here:
   - The ground is the void (#05060e). A room ADDS light onto it; it
     never paints a theme over it. A faint static starfield lies
     under every room so the void is a sky, not a hole.
   - Colours come ONLY from the track's chord (colA/colB/colC). The
     one licensed exception is FIREWORKS, whose stars are real flame
     chemistry — and even those are pulled 25% back toward the chord.
   - phi(x) = 2·atan(x) is the engine's signature fold: an unbounded
     axis brought home to a finite arc. MANDALA and the fractal camera
     wear it.
   - WCAG 2.3.1 is a law: govern_a() caps luminance at every exit so
     additive enthusiasm becomes saturation, never a white strobe;
     the beat is answered as a breath of geometry, not a flash.
   - r32Float is not filterable on the living-room GPUs, so spectrum
     and waveform are read by INTEGER TEXEL and lerped by hand.
   - white is the INK budget: a room's brightest cores scale by it,
     so a drop may blow out where a verse politely will not.
   - ghostStrength is the phantom hand: before shaping, each room
     lets its coordinate drift toward (ghostX, ghostY).
   - roll0..2 are the room's dice, re-dealt on entry — a room never
     shows the same face twice.

   This file is a SELF-CONTAINED translation unit. Every helper wears
   an _a suffix so its symbol never collides with the identically
   shaped helpers in Shaders.metal / Shaders3.metal.
   ================================================================ */

constant float PI_A  = 3.14159265359;
constant float TAU_A = 6.28318530718;

// the void ground — #05060e in the linear-ish working space
constant float3 VOID_A = float3(0.019608, 0.023529, 0.054902);

// ---------------------------------------------------------------
// THE FINAL VizUniforms — verbatim, byte-for-byte identical across
// Shaders.metal, Shaders2.metal, Shaders3.metal, Xforms.metal and
// the mirror Swift struct. The first 96 bytes are wave 1 unchanged;
// _pad0 is renamed xformMode (same slot); twelve floats are appended
// after colC, padded to a clean 144-byte, 16-byte-aligned stride.
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
// helpers (all _a — this file's private ladder)
// ---------------------------------------------------------------

// the signature fold — an infinite axis brought home to (-PI, PI)
inline float phiFold_a(float x) { return 2.0 * atan(x); }

inline float lumaOf_a(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// the flash governor — luminance capped so overdrive saturates, never strobes
inline float3 govern_a(float3 c) {
    float L = lumaOf_a(c);
    float cap = 0.85;
    return (L > cap) ? c * (cap / L) : c;
}

// sin-dot hashes: scalar, 2->1, 2->2
inline float hash11_a(float x) {
    return fract(sin(x * 12.9898) * 43758.5453123);
}
inline float hash21_a(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}
inline float2 hash22_a(float2 p) {
    float n = sin(dot(p, float2(41.3, 289.1)));
    return fract(float2(262144.0, 32768.0) * n);
}

// value noise -> 4-octave fbm
inline float vnoise_a(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_a(i);
    float b = hash21_a(i + float2(1.0, 0.0));
    float c = hash21_a(i + float2(0.0, 1.0));
    float d = hash21_a(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

inline float fbm4_a(float2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {          // literal-bounded, always four octaves
        v += a * vnoise_a(p);
        p = p * 2.03 + float2(17.7, 9.2);
        a *= 0.5;
    }
    return v;
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands. Manual lerp.
inline float band64_a(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel position -> centered, aspect-true coordinates (y in -1..1)
inline float2 centered_a(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    return p;
}

// the starfield underlay — two octaves of tiny static hashed points,
// brightness ~0.10-0.25. Returned as a scalar; each room tints it with
// the chord so even the sky obeys the colour law.
inline float starLayer_a(float2 uv) {
    float s = 0.0;
    float2 g = uv * 90.0;
    float2 c = floor(g);
    float h = hash21_a(c);
    float2 f = fract(g) - 0.5;
    s += smoothstep(0.994, 1.0, h) * exp(-dot(f, f) * 42.0) * 0.16;
    g = uv * 165.0 + 23.1;
    c = floor(g);
    h = hash21_a(c + 7.7);
    f = fract(g) - 0.5;
    s += smoothstep(0.997, 1.0, h) * exp(-dot(f, f) * 55.0) * 0.10;
    return s;
}

// the phantom hand — before shaping, a coordinate drifts toward the
// ghost point inside a soft attraction well, scaled by ghostStrength.
inline float2 ghostWarp_a(float2 p, constant VizUniforms& U) {
    float2 g = float2(U.ghostX, U.ghostY);
    float2 d = g - p;
    float pull = U.ghostStrength * 0.35 * exp(-dot(d, d) * 0.8);
    return p + d * pull;
}

// pick one of the three chord stops from a hash — the only colours a
// firework star is allowed to lean into.
inline float3 pickChord_a(constant VizUniforms& U, float h) {
    return (h < 0.34) ? U.colA.rgb : (h < 0.67 ? U.colB.rgb : U.colC.rgb);
}

// ---------------------------------------------------------------
// the one triangle is declared in Shaders.metal (fullscreen_vertex);
// these rooms reuse that vertex stage — no vertex function here.
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// The distance estimator, three fractals in one switch. Returns
// float2(distance, orbitTrap): the trap is the closest the orbit
// came to the origin, and it is what tints the surface. All three
// loops are bounded by compile-time literals.
//   mode 0: mandelbulb   (power walked by the phrase)
//   mode 1: mandelbox    (scale sign dealt by roll1)
//   mode 2: tetra fold    (kaleidoscopic Sierpinski)
// ---------------------------------------------------------------
inline float2 fractalDE_a(float3 pos, int mode, float power, float boxScale) {
    if (mode == 0) {
        // MANDELBULB — the classic triplex power map.
        float3 z = pos;
        float dr = 1.0;
        float r = 0.0;
        float trap = 1e10;
        for (int i = 0; i < 8; i++) {
            r = length(z);
            if (r > 2.0) break;
            trap = min(trap, r);
            float theta = acos(clamp(z.z / max(r, 1e-6), -1.0, 1.0));
            float phi = atan2(z.y, z.x);
            float rp = pow(max(r, 1e-6), power - 1.0);
            dr = rp * power * dr + 1.0;
            float zr = rp * r;                       // r^power
            float st = sin(theta * power);
            z = zr * float3(st * cos(phi * power),
                            st * sin(phi * power),
                            cos(theta * power));
            z += pos;
        }
        float d = 0.5 * log(max(r, 1e-6)) * r / max(dr, 1e-6);
        return float2(d, trap);
    } else if (mode == 1) {
        // MANDELBOX — box fold, sphere fold, affine. The scale sign is
        // the room's roll: a positive scale unfolds, a negative one
        // turns the lattice inside out.
        float3 z = pos;
        float dr = 1.0;
        float trap = 1e10;
        for (int i = 0; i < 10; i++) {
            z = clamp(z, -1.0, 1.0) * 2.0 - z;       // box fold
            float r2 = dot(z, z);
            if (r2 < 0.25) { float t = 4.0;      z *= t; dr *= t; }   // sphere fold (inner)
            else if (r2 < 1.0) { float t = 1.0 / r2; z *= t; dr *= t; }
            z = z * boxScale + pos;
            dr = dr * abs(boxScale) + 1.0;
            trap = min(trap, length(z));
        }
        return float2(length(z) / max(abs(dr), 1e-6), trap);
    } else {
        // TETRA FOLD — kaleidoscopic Sierpinski, three mirror planes
        // per iteration then a scale-2 pull toward one corner.
        float3 z = pos;
        float trap = 1e10;
        const float scale = 2.0;
        for (int i = 0; i < 12; i++) {
            if (z.x + z.y < 0.0) { float t = -z.y; z.y = -z.x; z.x = t; }
            if (z.x + z.z < 0.0) { float t = -z.z; z.z = -z.x; z.x = t; }
            if (z.y + z.z < 0.0) { float t = -z.z; z.z = -z.y; z.y = t; }
            z = z * scale - float3(1.0) * (scale - 1.0);
            trap = min(trap, length(z));
        }
        return float2(length(z) * pow(scale, -12.0), trap);
    }
}

// ---------------------------------------------------------------
// FRACTAL FIELD — a raymarched fractal, the heaviest room. An 80-step
// march down a slow orbit camera; the distance estimator is dealt by
// roll0 (<0.4 mandelbulb, <0.7 mandelbox, else tetra fold). The
// mandelbulb's power walks 3→9, holding eight beats on an integer rung
// and morphing across the last two, driven by phrasePhase. Orbit-trap
// tints route through colA/colB; ambient occlusion reads the step
// count; the fresnel rim answers the onset; the whole picture breathes
// out with energy. The dolly breathes with the bar.
// ---------------------------------------------------------------
fragment float4 room_fractal(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = centered_a(pos.xy, res, U.aspect);
    p = ghostWarp_a(p, U);                          // the phantom leans the camera

    // --- deal the estimator + its parameter ---
    int mode;
    float power = 6.0;
    float boxScale = 2.3;
    if (U.roll0 < 0.4) {
        mode = 0;
        // the power walk: six rungs across a phrase, hold 80% / morph 20%
        float seg = U.phrasePhase * 6.0;
        float rung = floor(seg);
        float fr = seg - rung;
        float morph = smoothstep(0.8, 1.0, fr);
        float p0 = 3.0 + fmod(rung, 7.0);           // 3..9
        float p1 = 3.0 + fmod(rung + 1.0, 7.0);
        power = mix(p0, p1, morph);
    } else if (U.roll0 < 0.7) {
        mode = 1;
        boxScale = (U.roll1 < 0.5) ? -2.3 : 2.3;    // roll1 picks the scale sign
    } else {
        mode = 2;
    }

    // --- the slow orbit camera; the dolly breathes with the bar ---
    float camA = U.time * 0.05;
    float dolly = 3.1 + 0.30 * sin(U.barPhase * TAU_A);
    float3 ro = float3(sin(camA) * dolly, 0.30 * sin(U.time * 0.05), cos(camA) * dolly);
    float3 fwd = normalize(-ro);
    float3 right = normalize(cross(float3(0.0, 1.0, 0.0), fwd));
    float3 up = cross(fwd, right);
    float3 rd = normalize(fwd * 1.6 + right * p.x + up * p.y);

    // --- the march ---
    float tHit = 0.0;
    float d = 0.0;
    float trapHit = 1e10;
    float closest = 1e9;                            // for the miss-halo
    int steps = 0;
    bool hit = false;
    for (int i = 0; i < 80; i++) {                  // literal bound — the heavy room
        float3 sp = ro + rd * tHit;
        float2 de = fractalDE_a(sp, mode, power, boxScale);
        d = de.x;
        trapHit = de.y;
        closest = min(closest, d);
        steps = i;
        if (d < 0.0008) { hit = true; break; }
        tHit += d * 0.7;                            // understep for DE overshoot safety
        if (tHit > 12.0) break;
    }

    float3 col;
    if (hit) {
        float3 hitP = ro + rd * tHit;

        // tetrahedral normal — four more DE evals (still literal-bounded)
        float h = 0.0009;
        float2 kk = float2(1.0, -1.0);
        float3 n = normalize(
            kk.xyy * fractalDE_a(hitP + kk.xyy * h, mode, power, boxScale).x +
            kk.yyx * fractalDE_a(hitP + kk.yyx * h, mode, power, boxScale).x +
            kk.yxy * fractalDE_a(hitP + kk.yxy * h, mode, power, boxScale).x +
            kk.xxx * fractalDE_a(hitP + kk.xxx * h, mode, power, boxScale).x);

        float3 lightDir = normalize(float3(0.6, 0.8, -0.35));
        float diff = max(dot(n, lightDir), 0.0);
        float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * (0.45 + U.onsetEnv * 0.8);
        float ao = clamp(1.0 - float(steps) / 80.0, 0.0, 1.0);   // step count -> occlusion

        // orbit-trap tint routed through the colA/colB pair
        float tt = clamp(trapHit * 1.3, 0.0, 1.0);
        float3 tint = mix(U.colA.rgb, U.colB.rgb, tt);

        col = tint * (0.12 + 0.70 * diff) * ao;
        // the fresnel rim is the bright core — the INK budget rides it
        col += mix(U.colB.rgb, U.colC.rgb, 0.5) * fres * ao * (0.40 + 0.90 * U.white);
        col *= (0.85 + U.energy * 0.5);             // the whole picture breathes with energy
    } else {
        // miss: the void sky, its starfield, a faint chord gradient, and a
        // soft halo where the ray grazed the form.
        col = starLayer_a(uv) * mix(float3(0.75), U.colC.rgb, 0.55);
        col += mix(U.colA.rgb, U.colB.rgb, uv.y) * 0.03;
        float halo = exp(-closest * 7.0);
        col += mix(U.colB.rgb, U.colC.rgb, 0.5) * halo * (0.10 + 0.30 * U.onsetEnv) * (0.4 + 0.9 * U.white);
    }

    col += (hash21_a(pos.xy) - 0.5) * 0.004;         // grain against banding
    return float4(govern_a(VOID_A + max(col, float3(0.0))), 1.0);
}

// ---------------------------------------------------------------
// FIREWORKS — stateless closed-form ballistics. Up to eight shells are
// alive at once, each identified by hash(launchBar, slot); nothing is
// remembered between frames, so every shell is reconstructed from the
// clock alone.
//
// THE TRICK: lift time is exactly one bar. A shell launches on a
// downbeat and BURSTS on the next downbeat, so the break lands on the
// bar. The integer bar index only sets identity (a nominal cadence);
// the sub-bar timing is the true barPhase, so the landing is exact
// even if the identity clock drifts.
//
// Fire density follows the act: the overture fires singles, the apex
// fires salvos. Star colours are flame chemistry — commented with the
// emitting species — pulled 25% back toward the chord. Willow shells
// carry high drag and long trail smear; the stars are integrated in
// closed form (linear drag + gravity) from the shell's age.
// ---------------------------------------------------------------
fragment float4 room_pyro(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = centered_a(pos.xy, res, U.aspect);
    p = ghostWarp_a(p, U);

    float3 col = starLayer_a(uv) * mix(float3(0.7), U.colC.rgb, 0.5);

    // the bar clock: integer part for identity (nominal), fractional part
    // locked to the real downbeat via barPhase so breaks land on the bar.
    float barLen = 1.9;                              // nominal seconds/bar (identity only)
    float barNo = floor(U.time / barLen);
    float bc = barNo + U.barPhase;                   // continuous bar coordinate

    // flame chemistry — fixed emission colours by species
    const float3 SP_STRONTIUM = float3(0.95, 0.10, 0.12); // strontium  red    ~650 nm
    const float3 SP_SODIUM    = float3(1.00, 0.78, 0.20); // sodium     yellow ~589 nm
    const float3 SP_BARIUM    = float3(0.35, 0.95, 0.40); // barium     green  ~515 nm
    const float3 SP_COPPER    = float3(0.25, 0.45, 0.98); // copper     blue   ~452 nm
    const float3 SP_CHARCOAL  = float3(1.00, 0.55, 0.15); // charcoal   gold   ~1750 K

    for (int b = 0; b < 4; b++) {                    // the four most recent bars of launches
        float launchBar = barNo - float(b);
        for (int s = 0; s < 2; s++) {                // up to two shells (slots) per bar
            float2 hh = hash22_a(float2(launchBar * 3.7 + 11.0, float(s) * 5.1 + 2.0));
            // density by act: slot 0 nearly always fires; slot 1 only as the
            // act rises (overture singles -> apex salvos, act in 0..4).
            float actGate = (s == 0) ? 0.15 : (0.62 - 0.12 * U.act);
            if (hh.x < actGate) continue;

            float age = bc - launchBar;              // bars since launch
            if (age < 0.0 || age > 2.4) continue;    // outside its living window

            // launch + apex geometry from the shell's hash
            float lx = (hh.y - 0.5) * 1.7;
            float apexX = lx + (hash21_a(float2(launchBar, float(s) + 7.0)) - 0.5) * 0.4;
            float apexY = 0.15 + hash21_a(float2(launchBar * 1.3, float(s) * 2.1 + 3.0)) * 0.55;
            float2 launchP = float2(lx, -0.95);
            float2 apex = float2(apexX, apexY);

            if (age < 1.0) {
                // RISING — a decelerating comet climbs launch -> apex, a
                // bright head trailing a thin tail below it.
                float e = 1.0 - (1.0 - age) * (1.0 - age);   // ease toward the apex
                float2 cpos = mix(launchP, apex, e);
                float2 dd = p - cpos;
                float head = exp(-dot(dd, dd) * 900.0);
                float2 tv = normalize(apex - launchP + float2(1e-4));
                float along = dot(dd, tv);
                float2 perp = dd - tv * along;
                float trail = exp(-dot(perp, perp) * 1600.0) * exp(min(along, 0.0) * 7.0) * step(along, 0.0);
                float3 sc = mix(SP_CHARCOAL, pickChord_a(U, hh.x), 0.25);   // gold rising spark
                col += sc * (head * 0.9 + trail * 0.35) * (0.6 + 0.4 * U.white);
            } else {
                // BURST — closed-form ballistic stars from the apex.
                float ageS = (age - 1.0) * barLen;   // seconds since the break
                float shellFade = exp(-ageS * 1.1);
                if (shellFade < 0.02) continue;

                float willow = hash21_a(float2(launchBar + 2.0, float(s) + 4.0));
                float k = mix(0.9, 3.2, willow);     // linear drag; willow shells drag hard
                float g = 1.6;                       // gravity
                float speed = 0.55 + 0.35 * hash21_a(float2(launchBar + 5.0, float(s)));
                int starCount = 24 + int(hash21_a(float2(launchBar, float(s) + 9.0)) * 40.0); // 24..64

                float sp = hash21_a(float2(launchBar + 8.0, float(s) + 1.0));
                float3 species;
                if      (sp < 0.20) species = SP_STRONTIUM;
                else if (sp < 0.40) species = SP_SODIUM;
                else if (sp < 0.60) species = SP_BARIUM;
                else if (sp < 0.80) species = SP_COPPER;
                else                species = SP_CHARCOAL;
                float3 starCol = mix(species, pickChord_a(U, sp), 0.25);   // 25% toward the chord

                float2 vinf = float2(0.0, -g) / k;   // terminal velocity under drag + gravity
                float ed = (1.0 - exp(-k * ageS)) / k;   // shared drag integral

                for (int j = 0; j < 64; j++) {       // literal bound; only starCount draw
                    if (j >= starCount) break;
                    float fj = float(j);
                    float ang = (fj + 0.5) / float(starCount) * TAU_A
                              + hash21_a(float2(launchBar * 7.0 + fj, float(s))) * 0.15;
                    float spj = speed * (0.8 + 0.4 * hash21_a(float2(fj, launchBar + float(s))));
                    float2 v0 = float2(cos(ang), sin(ang)) * spj;
                    // x(t) = vinf*t + (v0 - vinf)*(1 - e^{-kt})/k
                    float2 spos = apex + vinf * ageS + (v0 - vinf) * ed;
                    float2 dd = p - spos;
                    float d2 = dot(dd, dd);
                    float2 vel = vinf + (v0 - vinf) * exp(-k * ageS);
                    float2 vd = normalize(vel + float2(1e-4));
                    float par = dot(dd, vd);
                    float2 pe = dd - vd * par;
                    float peL = dot(pe, pe);
                    float body = exp(-d2 * 5000.0);
                    float smear = exp(-peL * 6000.0)
                                * ((par < 0.0) ? exp(par * 24.0) : exp(-par * par * 9000.0));
                    float bright = (body + 0.5 * smear * (0.5 + willow)) * shellFade;
                    col += starCol * bright * (0.5 + 0.7 * U.white);   // the burst is the core
                }
            }
        }
    }

    col += (hash21_a(pos.xy) - 0.5) * 0.004;
    return float4(govern_a(VOID_A + max(col, float3(0.0))), 1.0);
}

// ---------------------------------------------------------------
// OIL FILM — thin-film interference on a drifting slick. The thickness
// field is fbm warped by fbm (two nested domain warps, four octaves);
// the low end THICKENS the film, so every colour walks when the bass
// moves. Interference is sin² fringes evaluated at three wavelengths
// (610/545/465 nm scale factors) mapped to RGB, then leaned 40% toward
// the chord. Every onset drops one expanding ripple ring from a
// roll-picked point, distorting the film as it passes; the treble
// catches the fringe crests as sparkle.
// ---------------------------------------------------------------
fragment float4 room_oilfilm(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = centered_a(pos.xy, res, U.aspect);
    p = ghostWarp_a(p, U);

    float t = U.time * 0.05;
    float2 q = p * (1.6 + 0.2 * U.roll0);

    // two nested domain warps — fbm displacing fbm
    float2 w1 = q + float2(fbm4_a(q + float2(t, -t)),
                           fbm4_a(q + float2(5.2, 1.3) - t));
    float2 w2 = w1 * 1.7 + float2(fbm4_a(w1 * 1.4 + float2(t * 0.6, 2.1)),
                                  fbm4_a(w1 * 1.4 + float2(-3.3, t * 0.4)));
    float thick = fbm4_a(w2 * 1.2);

    // the low end thickens the film — the whole slick walks with the bass
    thick = thick * (1.0 + 0.9 * U.bass) + 0.25 * U.bass;

    // the onset ripple ring: one ring per onset, expanding as the envelope
    // decays and fading as it grows, dropped from a roll-picked point.
    float2 rc = float2(U.roll1 * 2.0 - 1.0, U.roll2 * 2.0 - 1.0) * 0.6;
    float rdist = length(p - rc);
    float ringR = (1.0 - U.onsetEnv) * 1.6;
    float ring = exp(-(rdist - ringR) * (rdist - ringR) * 40.0) * U.onsetEnv;
    thick += ring * 0.5 * sin((rdist - ringR) * 26.0);   // the ripple bends the fringes

    // interference: sin² fringes at three wavelengths -> RGB
    float freq = 16.0 + 8.0 * U.bass;
    float ph = thick * freq;
    float kr = 545.0 / 610.0;      // red — the slow fringe
    float kg = 1.0;                // green — the reference (545 nm)
    float kb = 545.0 / 465.0;      // blue — the fast fringe
    float sr = sin(ph * kr);
    float sg = sin(ph * kg);
    float sb = sin(ph * kb);
    float3 fr = float3(sr * sr, sg * sg, sb * sb);

    // leaned 40% toward the chord (thickness chooses the chord stop)
    float3 chord = mix(U.colA.rgb, U.colC.rgb, clamp(thick, 0.0, 1.0));
    chord = mix(chord, U.colB.rgb, 0.35 * U.mid);
    float3 film = mix(fr, chord * (0.35 + 0.75 * (fr.r + fr.g + fr.b) / 3.0), 0.40);

    float vign = exp(-dot(p, p) * 0.35);
    float3 col = film * (0.35 + 0.40 * U.energy) * vign;

    // the ripple's own bright crest — a core, so the INK budget rides it
    col += U.colC.rgb * ring * 0.40 * (0.5 + 0.7 * U.white);

    // treble sparkle catching the fringe crests
    float crest = smoothstep(0.75, 1.0, sr * sr);
    float2 scell = floor(p * 120.0);
    float spk = smoothstep(0.985, 1.0, hash21_a(scell + floor(U.time * 6.0)));
    col += U.colC.rgb * spk * crest * U.treble * (0.4 + 0.9 * U.white);

    // the void sky bleeds through the thin regions of the slick
    col += starLayer_a(uv) * mix(float3(0.7), U.colC.rgb, 0.5) * (1.0 - clamp(thick, 0.0, 1.0) * 0.7);

    col += (hash21_a(pos.xy) - 0.5) * 0.004;
    return float4(govern_a(VOID_A + max(col, float3(0.0))), 1.0);
}

// ---------------------------------------------------------------
// MANDALA — a kaleidoscope. The angle folds into k mirrored sectors
// (k = 6 + floor(roll0*6)*2, even, 6..16); petal rings sit at phi-folded
// radii so the infinite radial axis fits a finite bloom. The palette is
// five hard-quantized colours — the chord plus two darkened variants —
// separated by dark seams (the cell5 look), never a wash. Tip lamps at
// the petal ends answer the onset. The whole figure turns slowly
// (time*0.03) with a bar-locked micro-turn.
// ---------------------------------------------------------------
fragment float4 room_mandala(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = pos.xy / max(res, float2(1.0));
    float2 p = centered_a(pos.xy, res, U.aspect);
    p = ghostWarp_a(p, U);

    // slow spin + a bar micro-turn
    float rot = U.time * 0.03 + U.barPhase * 0.15;
    float cs = cos(rot), sn = sin(rot);
    p = float2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);

    float r = length(p);
    float ang = atan2(p.y, p.x);

    // k-sector kaleidoscope fold
    float k = 6.0 + floor(U.roll0 * 6.0) * 2.0;      // even, 6..16
    float sector = TAU_A / k;
    float a = fmod(ang + TAU_A, sector);             // 0..sector
    a = abs(a - sector * 0.5);                        // mirror -> kaleidoscope
    float an = a / (sector * 0.5);                    // 0..1 across the mirrored wedge

    // phi-folded petal rings — the infinite radius brought home
    float rr = phiFold_a(r * 2.4);
    float ringPhase = rr * 3.0 - r * 2.5;
    float ringField = 0.5 + 0.5 * cos(ringPhase);
    float petalA = 0.5 + 0.5 * cos(an * PI_A);
    float petal = pow(ringField * petalA, 1.4);

    // five-colour hard-quantized palette: chord + darkened variants
    float3 pal0 = U.colA.rgb;
    float3 pal1 = U.colB.rgb;
    float3 pal2 = U.colC.rgb;
    float3 pal3 = U.colA.rgb * 0.35;                  // darkened root
    float3 pal4 = U.colC.rgb * 0.50;                  // darkened highlight

    float ringIdx = floor(ringPhase + 8.0);           // integer ring id
    float sel = fract(ringIdx * 0.31718 + floor(an * 2.0) * 0.5);
    int idx = clamp(int(floor(sel * 5.0)), 0, 4);
    float3 cellCol;
    if      (idx == 0) cellCol = pal0;
    else if (idx == 1) cellCol = pal1;
    else if (idx == 2) cellCol = pal2;
    else if (idx == 3) cellCol = pal3;
    else               cellCol = pal4;

    // the sector wears its spectrum band
    float amp = band64_a(spectrum, fract(ang / TAU_A + 0.5));
    cellCol *= (0.6 + 0.7 * amp);

    // dark seams: between rings and along the mirror fold — bands read as bands
    float ringF = fract(ringPhase);
    float rseam = smoothstep(0.0, 0.09, ringF) * smoothstep(1.0, 0.91, ringF);
    float mseam = smoothstep(0.0, 0.06, an);
    float body = petal * rseam * mseam;

    float3 col = cellCol * body * (0.40 + 0.45 * U.mid);

    // tip lamps at the petal ends answer the onset (a bright core -> INK budget)
    float tipR = 0.62;
    float tip = exp(-(r - tipR) * (r - tipR) * 60.0) * pow(petalA, 3.0);
    col += U.colC.rgb * tip * (0.15 + 0.90 * U.onsetEnv) * (0.4 + 0.9 * U.white);

    // faint hub swell on the bass
    col += U.colB.rgb * exp(-r * r * 22.0) * (0.12 + 0.30 * U.bass);

    // the void sky under the dark seams
    col += starLayer_a(uv) * mix(float3(0.7), U.colC.rgb, 0.5) * (1.0 - smoothstep(0.0, 0.9, petal));

    col += (hash21_a(pos.xy) - 0.5) * 0.004;
    return float4(govern_a(VOID_A + max(col, float3(0.0))), 1.0);
}
