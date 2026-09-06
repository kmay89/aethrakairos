#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 2 (B) — HALO, TERRAIN, STARBURST, LAVA LAMP.
   Single-triangle fragment shaders, one per room, nothing else.

   The same laws that rule Shaders.metal and Shaders2.metal rule here:
   - The ground is the void (#05060e). A room ADDS light onto it; it
     never paints a theme over it. A faint static starfield lies under
     every room so the void reads as a sky, not a hole.
   - Colours come ONLY from the track's chord (colA/colB/colC). The
     licensed exceptions are physics, not palette: TERRAIN's aerial
     perspective borrows the chord's COOLEST stop for its sky, LAVA's
     Beer-Lambert wax absorbs against the chord's WARMEST stop — both
     are the chord read through a physical law, not a hardcoded hue.
   - WCAG 2.3.1 is a law: govern_b() caps luminance at every exit so
     additive enthusiasm becomes saturation, never a white strobe. And
     the cap is the INK budget: white in 0.05..0.92 sets how bright a
     core is permitted to burn, so a drop may blow out where a verse
     will not.
   - r32Float is not filterable on the living-room GPUs, so spectrum
     and waveform are read by INTEGER TEXEL and lerped by hand.
   - ghostStrength is the phantom hand: before shaping, each room lets
     its coordinate drift toward (ghostX, ghostY).
   - roll0..2 are the room's dice, re-dealt on entry — a room never
     shows the same face twice.
   - Every march / star / blob loop is bounded by a compile-time
     literal (<= 96 iterations) — no data-dependent trip counts.

   This is a SELF-CONTAINED translation unit. Every helper wears a _b
   suffix so its symbol never collides with the identically shaped
   helpers in Shaders.metal / Shaders2.metal.
   ================================================================ */

constant float PI_B  = 3.14159265359;
constant float TAU_B = 6.28318530718;

// the void ground — #05060e in the linear-ish working space
constant float3 VOID_B = float3(0.019608, 0.023529, 0.054902);

// ---------------------------------------------------------------
// THE FINAL VizUniforms — verbatim, byte-for-byte identical across
// Shaders.metal, Shaders2.metal, Shaders3.metal, Xforms.metal and the
// mirror Swift struct. The first 96 bytes are wave 1 unchanged; _pad0
// is renamed xformMode (same slot); twelve floats are appended after
// colC, padded to a clean 144-byte, 16-byte-aligned stride.
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
// helpers (all _b — this file's private ladder)
// ---------------------------------------------------------------

inline float lumaOf_b(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// The flash governor, doubling as the INK budget. white in 0.05..0.92
// maps to a luminance cap in ~0.16..0.86 — overdrive turns to colour,
// and the ceiling itself rises and falls with the story's openness.
inline float3 govern_b(float3 c, float white) {
    float L = lumaOf_b(c);
    float cap = 0.12 + 0.80 * clamp(white, 0.0, 1.0);
    return (L > cap) ? c * (cap / max(L, 1e-4)) : c;
}

// sin-dot hashes: 2->1 and 1->1
inline float hash21_b(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

// value-noise ladder: bilinear value noise from the 2->1 hash
inline float vnoise_b(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_b(i);
    float b = hash21_b(i + float2(1.0, 0.0));
    float c = hash21_b(i + float2(0.0, 1.0));
    float d = hash21_b(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ridged multifractal — 1-|noise| per octave, squared to sharpen, and
// each octave's amplitude fed by the last so ridges gate their own
// detail. Four octaves, literal-bounded. Output ~0..1.4.
inline float ridged_b(float2 p) {
    float sum = 0.0;
    float amp = 0.55;
    float prev = 1.0;
    for (int i = 0; i < 4; i++) {          // ridges sharpen with amplitude
        float n = vnoise_b(p);
        n = 1.0 - abs(2.0 * n - 1.0);      // fold to a ridge
        n = n * n;                         // sharpen the crest
        sum += n * amp * prev;             // last octave gates this one
        prev = clamp(n, 0.0, 1.0);
        p = p * 2.02 + float2(9.1, 3.7);
        amp *= 0.5;
    }
    return sum;
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands. Manual
// lerp — the filterability law forbids a linear sampler on r32Float.
inline float band64_b(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel position -> centered, aspect-true coordinates (y in -1..1)
inline float2 centered_b(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    return p;
}

// the starfield underlay — two octaves of tiny static hashed points,
// brightness ~0.10-0.25, returned as a scalar and tinted by the caller
// so even the sky obeys the colour law.
inline float starLayer_b(float2 uv) {
    float s = 0.0;
    float2 g = uv * 92.0;
    float2 c = floor(g);
    float2 f = fract(g) - 0.5;
    s += smoothstep(0.994, 1.0, hash21_b(c)) * exp(-dot(f, f) * 44.0) * 0.16;
    g = uv * 168.0 + 19.7;
    c = floor(g);
    f = fract(g) - 0.5;
    s += smoothstep(0.997, 1.0, hash21_b(c + 7.3)) * exp(-dot(f, f) * 58.0) * 0.10;
    return s;
}

// the phantom hand — before shaping, a coordinate drifts toward the
// ghost point inside a soft attraction well, scaled by ghostStrength.
inline float2 ghostWarp_b(float2 p, constant VizUniforms& U) {
    float2 g = float2(U.ghostX, U.ghostY);
    float2 d = g - p;
    float pull = U.ghostStrength * 0.32 * exp(-dot(d, d) * 0.8);
    return p + d * pull;
}

// the chord's coolest stop (max blue-minus-red) — TERRAIN's sky is lit
// from it, so aerial perspective stays in the track's key.
inline float3 coolestStop_b(float3 a, float3 b, float3 c) {
    float3 best = a; float bw = a.b - a.r;
    float wb = b.b - b.r; if (wb > bw) { best = b; bw = wb; }
    float wc = c.b - c.r; if (wc > bw) { best = c; }
    return best;
}

// the chord's warmest stop (max red-minus-blue) — LAVA's wax absorbs
// against it, so the goo glows in the track's warm end.
inline float3 warmestStop_b(float3 a, float3 b, float3 c) {
    float3 best = a; float bw = a.r - a.b;
    float wb = b.r - b.b; if (wb > bw) { best = b; bw = wb; }
    float wc = c.r - c.b; if (wc > bw) { best = c; }
    return best;
}

// ---------------------------------------------------------------
// the one triangle is declared in Shaders.metal (fullscreen_vertex);
// these rooms reuse that vertex stage — no vertex function here.
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// HALO — the equalizer bent into a circle. A torus glow ring: the
// analytic distance to a circle in view space, its tube bulging and
// brightening where its band sings. The band a slice reads is chosen
// by its angular distance from the gate at 12 o'clock, folded through
// a pow-1.6 curve so the lows crowd near the gate and the highs fan
// out to the sides. A beat SOLITON — a gaussian bulge exp(-d^2*34)
// weighted by onsetEnv — orbits the ring at 0.11 rev/s, a bright knot
// riding the hoop. Treble is hashed sparks that skitter on the tube.
// ---------------------------------------------------------------
fragment float4 room_halo(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = ghostWarp_b(centered_b(pos.xy, res, U.aspect), U);
    float r = length(p);
    float ang = atan2(p.y, p.x);

    // the equalizer runs out symmetrically from the gate at 12 o'clock;
    // angular distance folded through pow 1.6 clusters the lows at the top
    float gate = PI_B * 0.5;
    float da = abs(atan2(sin(ang - gate), cos(ang - gate)));   // 0..PI
    float bandU = pow(da / PI_B, 1.6);
    float amp = band64_b(spectrum, bandU);

    // the beat soliton, a knot orbiting the hoop at 0.11 rev/s
    float solAng = U.time * 0.11 * TAU_B;
    float dSol = atan2(sin(ang - solAng), cos(ang - solAng));
    float soliton = exp(-dSol * dSol * 34.0) * U.onsetEnv;

    // the tube: a circle in view space, bulging outward where it sings
    float R0 = 0.50;
    float tubeR = R0 + amp * 0.13 + soliton * 0.10;
    float d = r - tubeR;
    float thick = 0.020 + amp * 0.050 + soliton * 0.030;
    float tube = exp(-(d * d) / (thick * thick));

    // hashed treble sparks skittering along the tube, re-dealt ~8x/s
    float sa = fract(ang / TAU_B + 0.5);
    float si = floor(sa * 96.0);
    float sh = hash21_b(float2(si, floor(U.time * 8.0)));
    float spark = step(0.86, sh) * exp(-(d * d) / (0.013 * 0.013));
    spark *= U.treble * (0.5 + 0.5 * sin(U.time * 22.0 + sh * 40.0));

    float3 col = U.colA.rgb * tube * (0.28 + 0.95 * amp)
               + U.colC.rgb * tube * amp * 0.55
               + U.colB.rgb * soliton * tube * 1.25
               + U.colC.rgb * spark * 1.4;

    // a faint bass ground swell at the hub, so the ring has a centre
    col += U.colB.rgb * exp(-r * r * 24.0) * (0.06 + 0.22 * U.bass);

    col += starLayer_b(pos.xy / max(res, float2(1.0))) * mix(float3(0.7), U.colC.rgb, 0.5);
    col += (hash21_b(pos.xy) - 0.5) * 0.004;                   // grain vs banding
    return float4(govern_b(VOID_B + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// TERRAIN — a heightfield raymarch (64 steps) over a ridged
// multifractal, four octaves. roll0 deals the landform: ridges kept
// sharp, dunes softened, mesas terraced to floor(h*6)/6, or an
// archipelago flooded to a water line at 0.45. The ONLY depth cue is
// aerial perspective — an exponential extinction toward a blue-violet
// sky drawn from the chord's coolest stop, distant crests dissolving
// into it. When roll1 clears 0.38 the level-sets glow as contour
// lamps. Bass swells the whole range (uAmp = 0.9 + bass*0.25) and a
// slow sun orbits overhead.
// ---------------------------------------------------------------
fragment float4 room_terrain(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 uv = ghostWarp_b(centered_b(pos.xy, res, U.aspect), U);

    float uAmp = 0.9 + U.bass * 0.25;      // the low end swells the range
    float form = U.roll0;                  // the dealt landform
    float water = 0.45;                    // archipelago flood line (pre-amp)

    // the camera: above the field, drifting forward on the musical clock
    float3 ro = float3(0.0, 1.95, U.time * 0.40);
    float3 rd = normalize(float3(uv.x, uv.y * 0.75 - 0.32, 1.0));

    // the sky: the chord's coolest stop leaned toward blue-violet
    float3 sky = mix(coolestStop_b(U.colA.rgb, U.colB.rgb, U.colC.rgb),
                     float3(0.16, 0.11, 0.30), 0.40);
    float skyGrad = clamp(rd.y * 2.2 + 0.30, 0.0, 1.0);
    float3 skyCol = mix(sky * 0.35, sky, skyGrad);

    float3 col = skyCol;
    bool hitTerrain = false;

    // only descending rays can strike — the camera sits above every crest
    if (rd.y < 0.05) {
        float t = 0.20;
        float hitT = -1.0;
        for (int i = 0; i < 64; i++) {                 // literal-bounded march
            float3 pp = ro + rd * t;

            // landform height, dealt by roll0
            float base = ridged_b(pp.xz * 0.50) * 0.90; // ~0..1.1
            float h;
            if (form < 0.25) {
                h = base;                               // ridges: sharp
            } else if (form < 0.50) {
                h = smoothstep(0.0, 1.0, base);         // dunes: soft
            } else if (form < 0.75) {
                h = floor(base * 6.0) / 6.0;            // mesas: terraced
            } else {
                h = max(base, water);                   // archipelago: flooded
            }
            h *= uAmp;

            if (pp.y < h) { hitT = t; break; }
            t += max((pp.y - h) * 0.35, 0.03 + t * 0.012);
            if (t > 46.0) break;
        }

        if (hitT > 0.0) {
            hitTerrain = true;
            float3 pp = ro + rd * hitT;

            // re-evaluate the struck height (and take the normal from it)
            float e = 0.06 + hitT * 0.010;
            float2 xz = pp.xz;
            float hC, hX0, hX1, hZ0, hZ1;
            {
                float b0 = ridged_b(xz * 0.50) * 0.90;
                float bx0 = ridged_b((xz - float2(e, 0.0)) * 0.50) * 0.90;
                float bx1 = ridged_b((xz + float2(e, 0.0)) * 0.50) * 0.90;
                float bz0 = ridged_b((xz - float2(0.0, e)) * 0.50) * 0.90;
                float bz1 = ridged_b((xz + float2(0.0, e)) * 0.50) * 0.90;
                if (form < 0.25) {
                    hC = b0; hX0 = bx0; hX1 = bx1; hZ0 = bz0; hZ1 = bz1;
                } else if (form < 0.50) {
                    hC = smoothstep(0.0,1.0,b0); hX0 = smoothstep(0.0,1.0,bx0);
                    hX1 = smoothstep(0.0,1.0,bx1); hZ0 = smoothstep(0.0,1.0,bz0);
                    hZ1 = smoothstep(0.0,1.0,bz1);
                } else if (form < 0.75) {
                    hC = floor(b0*6.0)/6.0; hX0 = floor(bx0*6.0)/6.0;
                    hX1 = floor(bx1*6.0)/6.0; hZ0 = floor(bz0*6.0)/6.0;
                    hZ1 = floor(bz1*6.0)/6.0;
                } else {
                    hC = max(b0,water); hX0 = max(bx0,water); hX1 = max(bx1,water);
                    hZ0 = max(bz0,water); hZ1 = max(bz1,water);
                }
                hC *= uAmp; hX0 *= uAmp; hX1 *= uAmp; hZ0 *= uAmp; hZ1 *= uAmp;
            }
            float3 nrm = normalize(float3(hX0 - hX1, 2.0 * e, hZ0 - hZ1));

            // the sun, orbiting slowly overhead
            float3 sun = normalize(float3(cos(U.time * 0.05), 0.55, sin(U.time * 0.05)));
            float diff = clamp(dot(nrm, sun), 0.0, 1.0);

            // material from the chord, walked by normalized altitude
            float hn = clamp(hC / max(uAmp, 1e-3), 0.0, 1.2);
            float3 mat = mix(U.colA.rgb, U.colB.rgb, clamp(hn, 0.0, 1.0));

            // archipelago water: a flat, sky-mirrored sheet at the flood line
            bool isWater = (form >= 0.75) && (hC <= water * uAmp + 1e-3);
            if (isWater) {
                mat = mix(sky, U.colC.rgb * 0.5, 0.35);
                diff = 0.55 + 0.45 * diff;              // a calm, bright sheet
            }

            float3 land = mat * (0.22 + 0.85 * diff);

            // contour lamps at the level-sets when the dice allow
            if (U.roll1 > 0.38) {
                float cf = fract(hn * 8.0);
                float contour = (1.0 - smoothstep(0.0, 0.06, cf)) + smoothstep(0.94, 1.0, cf);
                land += U.colC.rgb * contour * 0.22;
            }

            // aerial perspective — the ONLY depth cue: distance extinguishes
            // the land toward the sky
            float fog = 1.0 - exp(-hitT * 0.085);
            col = mix(land, skyCol, clamp(fog, 0.0, 1.0));
        }
    }

    // the starfield lives in the sky, never behind the ground
    if (!hitTerrain) {
        col += starLayer_b(pos.xy / max(res, float2(1.0)))
             * mix(float3(0.7), U.colC.rgb, 0.5) * skyGrad;
    }

    col += (hash21_b(pos.xy) - 0.5) * 0.004;
    return float4(govern_b(VOID_B + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// STARBURST — the most percussive room. 128 analytic rays fan from the
// hub; each ray's angle picks a spectrum bin and its reach is drawn
// straight from that band: 2 + amp*20 + onsetEnv*6, scaled to the
// screen. No loop over the rays — the sector a pixel falls in is read
// from its angle, and its brightness from its distance along and
// across that sector. Every onset launches an expanding SHOCK RING;
// four hashed cue slots keep the most recent alive, radius growing
// with (14 + energy*20)*age and alpha decaying on a 0.4 s tail.
// ---------------------------------------------------------------
fragment float4 room_starburst(float4 pos [[position]],
                               constant VizUniforms& U [[buffer(0)]],
                               constant float2& res [[buffer(1)]],
                               texture2d<float, access::read> spectrum [[texture(0)]],
                               texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = ghostWarp_b(centered_b(pos.xy, res, U.aspect), U);
    float rr = length(p);
    float ang = atan2(p.y, p.x);
    float a01 = ang / TAU_B + 0.5;                     // 0..1 around the circle

    // which of the 128 rays this pixel belongs to, and its offset across it
    float sector = a01 * 128.0;
    float si = floor(sector);
    float sf = fract(sector) - 0.5;                    // -0.5..0.5

    // ray angle -> spectrum bin (two rays share a band, so the fan mirrors)
    float amp = band64_b(spectrum, si / 127.0);

    // reach in screen units — a quiet ray is a stub, a struck one spears out
    float reach = (2.0 + amp * 20.0 + U.onsetEnv * 6.0) * 0.045;

    // the analytic ray: thin across its sector, lit out to its reach
    float angW = exp(-sf * sf * 26.0);                 // occupies the sector centre
    float body = (1.0 - smoothstep(reach * 0.6, reach, rr)) // bright body, tip fades
               * smoothstep(0.02, 0.10, rr);           // the hub is drawn apart
    float ray = angW * body;

    float3 col = mix(U.colA.rgb, U.colC.rgb, amp) * ray * (0.30 + 0.95 * amp);

    // the hub — a bass-fed core the rays spring from
    col += U.colB.rgb * exp(-rr * rr * 46.0) * (0.18 + 0.55 * U.energy);

    // expanding shock rings — four hashed cue slots, newest at k=0
    float cueRate = 1.8;
    float baseCue = floor(U.time * cueRate);
    float ringSpeed = (14.0 + U.energy * 20.0) * 0.020;
    float rings = 0.0;
    for (int k = 0; k < 4; k++) {                      // literal-bounded slots
        float cueIdx = baseCue - float(k);
        float age = U.time - cueIdx / cueRate;
        float slot = hash21_b(float2(cueIdx * 1.7 + 3.0, cueIdx * 0.37 + float(k)));
        float rad = ringSpeed * age;
        float dr = rr - rad;
        float a = exp(-age / 0.4) * (0.35 + 0.65 * slot) * step(0.0, age);
        rings += exp(-dr * dr * 340.0) * a;
    }
    col += U.colC.rgb * rings * (0.55 + 0.85 * U.onsetEnv);

    col += starLayer_b(pos.xy / max(res, float2(1.0))) * mix(float3(0.7), U.colC.rgb, 0.5);
    col += (hash21_b(pos.xy) - 0.5) * 0.004;
    return float4(govern_b(VOID_B + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// LAVA LAMP — the calm room. Twelve gaussian "wax" blobs ride hash
// trajectories; the coil's heat is thermal (bass + act), so a hot lamp
// sends them rising fast while a cold blob sinks and idles nine times
// slower. Their field is a sum of gaussians; the surface is a
// smoothstep iso-set, and the goo merges and pinches for free wherever
// two fields overlap the threshold. The screen-space normal comes from
// a four-tap gradient of the field; the wax refracts the soft ground
// behind it in three wavelengths and absorbs it Beer-Lambert against
// the chord's warmest stop, so the blobs glow in the track's warm end.
// ---------------------------------------------------------------

// the soft ground the wax refracts — a vertical chord gradient with a
// gentle central pool of light. No time term: the lamp's calm is in
// the ground being still while the wax moves.
inline float3 bgLava_b(float2 q, float3 lo, float3 hi) {
    float g = clamp(q.y * 0.5 + 0.5, 0.0, 1.0);
    float3 c = mix(lo, hi, g);
    return c * (0.35 + 0.35 * exp(-dot(q, q) * 0.6));
}

// the metaball field — twelve gaussians on hash trajectories. thermal
// rises the coil; a fraction of the blobs run cold and idle 9x slower.
inline float lavaField_b(float2 p, float time, float thermal) {
    float f = 0.0;
    for (int i = 0; i < 12; i++) {                     // literal-bounded blobs
        float fi = float(i);
        float hx = hash21_b(float2(fi, 1.0));
        float hy = hash21_b(float2(fi, 7.0));
        float hr = hash21_b(float2(fi, 3.0));
        float hs = hash21_b(float2(fi, 5.0));
        // a cold blob sinks slow — its climb slows ninefold
        float cold = step(hs, 0.30);
        float spd = mix(thermal, thermal / 9.0, cold) * (0.25 + 0.55 * hy);
        float x = (hx * 1.6 - 0.8) + 0.12 * sin(time * (0.20 + 0.30 * hr) + fi * 2.1);
        float y = 0.85 * sin(time * spd + fi * 1.7);
        float rad = 0.14 + 0.07 * hr;
        float2 d = p - float2(x, y);
        f += exp(-dot(d, d) / (rad * rad));
    }
    return f;
}

fragment float4 room_lava(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = ghostWarp_b(centered_b(pos.xy, res, U.aspect), U);

    // the coil's heat — the low end and the act drive the rise
    float thermal = 0.35 + U.bass * 0.60 + U.act * 0.12;

    float f = lavaField_b(p, U.time, thermal);
    float ISO = 0.60;
    float surf = smoothstep(ISO - 0.22, ISO + 0.22, f);

    // screen-space normal from a four-tap gradient of the field
    float e = 0.006;
    float fx = lavaField_b(p + float2(e, 0.0), U.time, thermal)
             - lavaField_b(p - float2(e, 0.0), U.time, thermal);
    float fy = lavaField_b(p + float2(0.0, e), U.time, thermal)
             - lavaField_b(p - float2(0.0, e), U.time, thermal);
    float3 n = normalize(float3(-fx, -fy, 0.5));

    // the ground colours: a cool floor, a warm ceiling
    float3 warm = warmestStop_b(U.colA.rgb, U.colB.rgb, U.colC.rgb);
    float3 lo   = coolestStop_b(U.colA.rgb, U.colB.rgb, U.colC.rgb) * 0.6;

    // refraction: the surface bends the ground behind it, split into
    // three wavelengths so the wax edges fringe like real glass
    float2 base = p + n.xy * 0.14;
    float3 refr = float3(bgLava_b(base + n.xy * 0.012, lo, warm).r,
                         bgLava_b(base,                 lo, warm).g,
                         bgLava_b(base - n.xy * 0.012,  lo, warm).b);

    // Beer-Lambert: the wax absorbs everything but the warm stop, so
    // thicker goo reads warmer. thickness ~ the field magnitude.
    float thick = clamp(f, 0.0, 3.0);
    float3 absorb = float3(1.0) - warm;                // absorb the complement
    float3 trans = exp(-thick * absorb * 0.9);

    float fres = pow(clamp(1.0 - n.z, 0.0, 1.0), 3.0); // a thin glassy rim
    float3 wax = refr * trans * (0.55 + 0.80 * surf) + warm * fres * 0.35;

    // the world outside the wax: the void, a whisper of the ground, stars
    float2 suv = pos.xy / max(res, float2(1.0));
    float3 outside = VOID_B
                   + bgLava_b(p, lo, warm) * 0.22
                   + starLayer_b(suv) * mix(float3(0.7), U.colC.rgb, 0.5);

    float3 col = mix(outside, wax, surf);

    col += (hash21_b(pos.xy) - 0.5) * 0.004;
    return float4(govern_b(VOID_B + max(col, float3(0.0)), U.white), 1.0);
}
