#include <metal_stdlib>
using namespace metal;

/* ================================================================
   THE SIX ROOMS — single-triangle fragment shaders, nothing else.
   Laws in force everywhere below:
   - The ground is the void (#05060e). A room ADDS light onto it;
     it never paints a theme over it.
   - Colours come ONLY from the track's chord (colA/colB/colC) —
     no hardcoded rainbows. A rainbow must be earned upstream, in
     the palette, by the music's own entropy and energy.
   - phi(x) = 2·atan(x) is the engine's signature: unbounded runs
     folded into bounded geometry. Spiral and tunnel wear it openly.
   - WCAG 2.3.1 is a law, not a preference: govern() caps luminance
     at every room's exit so no frame can strobe toward white, and
     every beat answer is a breath (a few percent of scale), never
     a luminance flash. The cap is opened by the INK white budget —
     a verse holds its cores in, a drop is allowed to bloom (the
     GRADE pass, grade_pass in Xforms.metal, catches the overdrive
     as saturation, never a white clip).
   - r32Float is not filterable on the living-room GPUs, so the
     spectrum/waveform lerp is done by hand from texel reads.
   - roll0..2 are re-dealt on every room entry: a room must never
     wear the same face twice. Each room spends its three dice on
     count / direction / proportion so re-entry is a new variation.
   - ghostWarp() is the phantom hand: after 22 s idle the renderer
     walks (ghostX, ghostY) along a choreography and ramps
     ghostStrength; every wave-1 room leans its coordinate toward it
     the way it would lean toward a real hand. Zero when idle.
   ================================================================ */

constant float PI  = 3.14159265359;
constant float TAU = 6.28318530718;

// the void ground — #05060e in linear-ish working space
constant float3 VOID_COL = float3(0.019608, 0.023529, 0.054902);

// ---- THE FINAL VizUniforms (wave 3) ----------------------------
// The byte layout is FIXED at 144 bytes and does NOT change across
// waves. Wave 2 renamed _pad0 -> xformMode (slot 11). Wave 3 gives
// two of the trailing pads meaning WITHOUT moving a byte: offset 128
// _pad1 -> lens (-1 none / 0 mirrors / 1 wave / 2 prism / 3 iris /
// 4 tile / 5 moire) and offset 132 _pad2 -> lensAmt (0..1). Offset
// 140 stays a reserved pad. Only the NAMES change here; the rooms in
// this unit never read lens, so the rename is cosmetic for them — the
// CPU uploads the same 144 bytes and Lens.metal reads these two at
// their fixed offsets. Mirrored by the private Swift struct in
// VisualizerView.swift; Shaders2/3/4/5 and Xforms may keep the pad
// names since layout, not naming, is the contract.
struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11  (was _pad0)
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float lens; float lensAmt; float _pad3;            // 128..140  -> stride 144
};

// ---------------------------------------------------------------
// helpers
// ---------------------------------------------------------------

// the signature fold — an infinite axis brought home to (-PI, PI)
inline float phiFold(float x) { return 2.0 * atan(x); }

inline float lumaOf(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// The flash governor: luminance is capped at the exit of every room.
// The cap is the INK white budget widened to a headroom — a quiet
// verse (white near the floor) caps well under 1.0 and never blooms;
// a drop (white near the ceiling) is allowed to overdrive past 1.0,
// and the GRADE pass rolls that overdrive off into saturation, hue
// intact, never a hard white clip. Additive enthusiasm becomes
// colour, not a strobe.
inline float3 govern(float3 c, float white) {
    float L = lumaOf(c);
    float cap = 0.70 + 1.6 * clamp(white, 0.0, 1.0);   // 0.78 (verse) .. 2.17 (drop)
    return (L > cap && L > 1e-4) ? c * (cap / L) : c;
}

// value-noise ladder: sin-dot hash -> bilinear value noise -> 4-octave fbm
inline float hash21(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

inline float vnoise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + float2(1.0, 0.0));
    float c = hash21(i + float2(0.0, 1.0));
    float d = hash21(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

inline float fbm4(float2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = p * 2.03 + float2(17.7, 9.2);
        a *= 0.5;
    }
    return v;
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands.
// Manual lerp — see the filterability law above.
inline float band64(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// waveform: all 256 texels, -1..1 mono samples
inline float wave256(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 255.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 255u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel position -> centered, aspect-true coordinates (y in -1..1).
// res and aspect are both guarded — division by zero is refused here
// even though the renderer refuses it first.
inline float2 centered(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    return p;
}

// The phantom hand. A gentle attraction of the coordinate toward the
// ghost point, falloff with distance, magnitude ridden by
// ghostStrength (0 at rest). Matter leans toward the ghost the way it
// would lean toward a real hand — edge-free and bounded. Only the
// wave-1 rooms in THIS translation unit call it; W2/W3 inline their
// own, by contract (a helper cannot cross a Metal translation unit).
inline float2 ghostWarp(float2 p, float gx, float gy, float gs) {
    if (gs <= 0.0) return p;
    float2 g = float2(gx, gy);
    float2 d = p - g;
    float r = length(d) + 1e-3;
    float pull = gs * 0.22 / (r + 0.30);
    return p - d * pull;
}

// ---------------------------------------------------------------
// the one triangle
// ---------------------------------------------------------------

vertex float4 fullscreen_vertex(uint vid [[vertex_id]]) {
    // one triangle big enough to be a screen — no quad, no seam
    float2 v = float2(vid == 1 ? 3.0 : -1.0, vid == 2 ? 3.0 : -1.0);
    return float4(v, 0.0, 1.0);
}

// ---------------------------------------------------------------
// MÖBIUS SPIRAL — the signature room.
// Three-to-six log-spiral arms in polar space (roll0 deals the arm
// count, roll1 the spin direction, roll2 the counter-thread weight),
// radius folded through phi. Each angular slice wears its own
// spectrum band; the arm swells where its slice sings. The onset is
// a heartbeat at the hub, and the whole form leans into it by 3% —
// a breath, never a strobe. The hub core is a specular term, so the
// white budget governs how far it is allowed to bloom.
// ---------------------------------------------------------------
fragment float4 room_spiral(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centered(pos.xy, res, U.aspect);
    p = ghostWarp(p, U.ghostX, U.ghostY, U.ghostStrength);

    float r = length(p) + 1e-5;
    float ang = atan2(p.y, p.x);

    // the breath: the beat scales the form, it never scales the light
    r /= (1.0 + 0.03 * U.onsetEnv);

    // the signature: radius folded via phi(x)=2·atan(x) — the spiral
    // winds forever but the geometry stays bounded
    float folded = phiFold(r * 1.9);                    // 0..PI

    // the dice: arm count 3..6, spin direction, counter-thread weight
    float armN = 3.0 + floor(clamp(U.roll0, 0.0, 0.999) * 4.0);
    float dir  = mix(-1.0, 1.0, step(0.5, U.roll1));
    float ctW  = 0.12 + 0.14 * U.roll2;
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float t = U.time * 0.5 * dir;                       // musical time upstream
    float armAmp = band64(spectrum, fract(ang / TAU + 0.5));

    float s = ang * armN + folded * 2.8 - t;            // log-spiral phase
    float lobe = 0.5 + 0.5 * cos(s);
    // a quiet slice keeps its arm thin; a singing slice lets it swell
    float arms = pow(lobe, 2.5 + 5.0 * (1.0 - armAmp));

    float fade = exp(-r * (1.5 - 0.5 * U.calm));        // edges sleep in the void
    float core = exp(-r * 7.0) * (0.35 + 0.9 * U.onsetEnv) * coreScale;
    float rim  = arms * fade;

    float3 col = U.colA.rgb * rim * (0.30 + 0.90 * armAmp)
               + U.colB.rgb * core
               + U.colC.rgb * rim * rim * (0.25 + 0.55 * U.treble);

    // the faint counter-thread — the möbius half-twist reading of the form
    float s2 = -ang * armN + folded * 2.2 + t * 0.7;
    col += U.colB.rgb * pow(0.5 + 0.5 * cos(s2), 8.0) * fade * ctW;

    col += (hash21(pos.xy) - 0.5) * 0.004;              // grain against banding
    return float4(govern(VOID_COL + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// PULSE — the visual meter, and the reduced-motion opener.
// 64 spectrum bands as ring segments around a hub; the bar-tick
// ring shows the next hit coming. The beat answers as a 2–3%
// breath of the whole meter — geometry moves, luminance holds. The
// dice nudge the ring radius (roll0) and the hub swell (roll1); the
// runner, the meter's brightest mark, is a specular term the white
// budget governs.
// ---------------------------------------------------------------
fragment float4 room_pulse(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centered(pos.xy, res, U.aspect);
    p = ghostWarp(p, U.ghostX, U.ghostY, U.ghostStrength);

    // breathing with the beat clock, never flashing with it
    float breath = 1.0 + 0.02 * cos(U.beatPhase * TAU) + 0.015 * U.onsetEnv;
    p /= breath;

    float r = length(p);
    float ang = atan2(p.y, p.x);
    float a01 = fract(ang / TAU + 0.75);                // 0 at 12 o'clock

    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // --- the 64 band segments ---
    float fseg = a01 * 64.0;
    uint seg = min((uint)fseg, 63u);
    float segf = fract(fseg);
    float amp = spectrum.read(uint2(seg, 0)).r;

    float r0 = 0.34;
    float len = 0.05 + amp * 0.34;
    float radial = (r - r0) / max(len, 1e-4);
    float inSeg = smoothstep(0.0, 0.03, radial) * (1.0 - smoothstep(0.90, 1.0, radial));
    inSeg *= step(radial, 1.0) * step(0.0, radial);
    // a dark seam between neighbours — bands read as bands, not a wash
    float seam = smoothstep(0.0, 0.12, segf) * smoothstep(1.0, 0.88, segf);

    float3 segCol = mix(U.colA.rgb, U.colC.rgb, clamp(radial, 0.0, 1.0));
    float3 col = segCol * inSeg * seam * (0.30 + 0.45 * amp);

    // --- the hub: bass as a slow ground swell (roll1 sets its weight) ---
    col += U.colB.rgb * exp(-r * r * 26.0) * (0.13 + 0.06 * U.roll1 + 0.30 * U.bass);

    // --- the bar-tick ring: four posts, one runner (roll0 sets radius) ---
    float ringR = 0.82 + 0.08 * U.roll0;
    float ringD = r - ringR;
    float ringGlow = exp(-ringD * ringD * 9000.0);
    float q4 = fract(a01 * 4.0);
    float dq = min(q4, 1.0 - q4);
    float post = exp(-dq * dq * 2600.0);
    float runD = fract(a01 - U.barPhase);
    runD = min(runD, 1.0 - runD);
    float runner = exp(-runD * runD * 5200.0);

    col += U.colB.rgb * ringGlow * 0.05;                     // the ring itself, faint
    col += U.colA.rgb * ringGlow * post * 0.35;              // the four beats of the bar
    col += U.colC.rgb * ringGlow * runner * 0.80 * coreScale;// where the bar stands now

    col += (hash21(pos.xy) - 0.5) * 0.004;
    return float4(govern(VOID_COL + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// NEBULA — fbm clouds, domain-warped, drifting in musical time.
// Bass thickens the medium (the cloud has a body); the chord lights
// it from within. Sparse stars breathe with the treble behind it.
// The dice re-seed the warp (roll0/roll1) and flip the drift
// direction (roll2) so no two visits marble the same way.
// ---------------------------------------------------------------
fragment float4 room_nebula(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centered(pos.xy, res, U.aspect);
    p = ghostWarp(p, U.ghostX, U.ghostY, U.ghostStrength);

    // U.time is the renderer's musical clock — it already slows when the
    // music calms, so the drift rate stays continuous; calm adds warp
    // depth here (a bounded term), never a rate jump.
    float dir = mix(-1.0, 1.0, step(0.5, U.roll2));
    float t = U.time * 0.045 * dir;
    float2 seed = float2(U.roll0 * 31.0, U.roll1 * 17.0);
    float2 q = p * (1.55 + 0.10 * U.calm) + seed;

    float2 w1 = q + float2(t * 0.9, -t * 0.6);
    float n1 = fbm4(w1);
    float2 w2 = q * 1.9 + float2(-t * 0.5, t * 0.4) + (n1 - 0.5) * (1.4 + 1.2 * U.calm);
    float n2 = fbm4(w2);

    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // bass thickens the film — all the colours walk when the low end moves
    float thresh = 0.46 - 0.16 * U.bass;
    float dens = smoothstep(thresh, thresh + 0.42, n2);
    float glowD = smoothstep(thresh + 0.18, thresh + 0.55, n2);

    float3 body = mix(U.colA.rgb, U.colB.rgb, clamp(n1 * 1.6 - 0.25, 0.0, 1.0));
    body = mix(body, U.colC.rgb, glowD * 0.65 * (0.6 + 0.4 * coreScale));

    float vign = exp(-dot(p, p) * 0.5);
    float3 col = body * dens * (0.30 + 0.35 * U.mid + 0.25 * U.energy) * vign;

    // sparse stars behind the cloud, twinkling with the treble
    float2 cell = floor(q * 70.0);
    float sc = hash21(cell);
    float star = smoothstep(0.9985, 1.0, sc);
    float2 cf = fract(q * 70.0) - 0.5;
    star *= exp(-dot(cf, cf) * 18.0);
    float twinkle = 0.5 + 0.5 * sin(U.time * 3.0 + sc * 61.0);
    col += U.colC.rgb * star * twinkle * (0.10 + 0.25 * U.treble) * (1.0 - dens);

    col += (hash21(pos.xy + fract(U.time)) - 0.5) * 0.006;   // grain against banding
    return float4(govern(VOID_COL + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// TUNNEL — concentric rings flying past, depth folded through phi
// so the infinite highway fits a finite reel. Base speed rides the
// musical clock; energy adds a bounded surge (never an integrated
// speed term — that would teleport the rings when the mix moves).
// Each ring is welded to one spectrum band by a golden-step walk.
// The dice deal ring density (roll0), spoke count (roll1) and the
// wander of the eye (roll2).
// ---------------------------------------------------------------
fragment float4 room_tunnel(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float, access::read> spectrum [[texture(0)]],
                            texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centered(pos.xy, res, U.aspect);
    p = ghostWarp(p, U.ghostX, U.ghostY, U.ghostStrength);

    // a drifting eye keeps the highway alive
    float eye = 0.04 + 0.04 * U.roll2;
    p += eye * float2(sin(U.time * 0.31), cos(U.time * 0.23));

    float r = length(p);
    float ang = atan2(p.y, p.x);

    // the signature fold: 1/r runs to infinity at the vanishing point;
    // phi brings it home to (0, PI)
    float z = phiFold(0.35 / max(r, 0.002));

    float ringDens = 3.0 + floor(clamp(U.roll0, 0.0, 0.999) * 4.0);  // 3..6
    float spokeN   = 5.0 + floor(clamp(U.roll1, 0.0, 0.999) * 4.0);  // 5..8
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float travel = U.time * 1.2 + U.energy * 1.6 + U.onsetEnv * 0.12;
    float coord = z * ringDens + travel;
    float fi = floor(coord);
    float ff = fract(coord);

    float ring = pow(0.5 + 0.5 * cos(ff * TAU), 3.0);

    // ring index -> band, golden-stepped so neighbours never match
    float amp = band64(spectrum, fract(fi * 0.618034));
    // angular grain from the spectrum sampled by angle
    float ampA = band64(spectrum, fract(ang / TAU + 0.5));

    float spokes = 0.75 + 0.25 * cos(ang * spokeN + fi * 1.7);
    float haze = smoothstep(0.015, 0.28, r);            // the far end sleeps in the void
    float vign = exp(-r * r * 0.55);

    float bright = ring * (0.18 + 0.85 * amp) * spokes * haze * vign;

    float3 col = mix(U.colA.rgb, U.colB.rgb, clamp(ff + 0.15 * sin(fi), 0.0, 1.0)) * bright
               + U.colC.rgb * bright * ampA * 0.6
               + U.colC.rgb * U.onsetEnv * exp(-r * 5.0) * 0.25 * coreScale;

    col += (hash21(pos.xy) - 0.5) * 0.004;
    return float4(govern(VOID_COL + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// OP-ART — two stripe gratings a few degrees apart; the checker
// where they disagree is the subject. Spatial frequency climbs in
// quantized steps as the bar progresses — geometry rearranges on
// the beat, mean luminance holds still. Treble is a fine shimmer,
// felt more than seen. The dice deal the base frequency (roll0),
// the tilt (roll1) and the rotation direction (roll2).
// ---------------------------------------------------------------
fragment float4 room_opart(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centered(pos.xy, res, U.aspect);
    p = ghostWarp(p, U.ghostX, U.ghostY, U.ghostStrength);

    // the whole field turns slowly — the picture moves, the light does not
    float rotDir = mix(-1.0, 1.0, step(0.5, U.roll2));
    float rot = U.time * 0.02 * rotDir;
    float cs = cos(rot);
    float sn = sin(rot);
    p = float2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);

    // frequency stepped by the bar: one rung per beat, base rolled
    float freqBase = 9.0 + floor(clamp(U.roll0, 0.0, 0.999) * 6.0);   // 9..14
    float stepIdx = floor(U.barPhase * 4.0);
    float freq = (freqBase + 3.0 * stepIdx) * (1.0 + 0.12 * U.energy);

    // two gratings, tilted apart — interference does the drawing
    float tilt = (0.10 + 0.08 * U.roll1) + 0.05 * sin(U.time * 0.07);
    float2 d1 = float2(cos(tilt), sin(tilt));
    float2 d2 = float2(cos(-tilt), sin(-tilt));
    float g1 = smoothstep(-0.35, 0.35, cos(dot(p, d1) * freq * PI));
    float g2 = smoothstep(-0.35, 0.35, cos(dot(p, d2) * (freq + 1.0) * PI));
    float weave = g1 + g2 - 2.0 * g1 * g2;              // XOR — the checker of disagreement

    // treble shimmer: a third, much finer grating at one tenth strength
    float shim = 0.5 + 0.5 * cos((p.x + p.y) * freq * 5.0 * PI + U.time * 2.0);
    weave = clamp(weave + shim * 0.10 * U.treble, 0.0, 1.0);

    // corners stay in the void
    float env = exp(-dot(p, p) * 0.35);
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    float3 lo = U.colA.rgb * 0.22;
    float3 hi = mix(U.colB.rgb, U.colC.rgb, 0.5 + 0.5 * cos(U.time * 0.05)) * (0.55 + 0.45 * coreScale);
    float3 col = mix(lo, hi * 0.75, weave) * env;

    col += (hash21(pos.xy) - 0.5) * 0.004;
    return float4(govern(VOID_COL + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// SCOPE — the waveform as a phosphor trace. The tube rules apply:
// segment brightness is inverse to beam speed (steep transients
// spread their light thin), the graticule is 10x8 with brighter
// centre axes, the glass is slightly barrelled, and the trigger
// lamp blinks on the onset. The phosphor is the chord's second
// colour — the tube glows in the track's key, not in P31 green.
// The dice deal the vertical gain (roll0) and graticule brightness
// (roll1); the beam is the specular term the white budget governs.
// ---------------------------------------------------------------
fragment float4 room_scope(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 r2v = max(res, float2(1.0));
    float2 uvRaw = pos.xy / r2v;

    // the glass: slight barrel — and the ghost leans the tube gently
    float2 q = uvRaw * 2.0 - 1.0;
    q = ghostWarp(q, U.ghostX, U.ghostY, U.ghostStrength);
    float r2 = dot(q, q);
    q *= 1.0 + 0.055 * r2;
    float2 uv = q * 0.5 + 0.5;
    float inGlass = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? 1.0 : 0.0;
    float2 suv = clamp(uv, 0.0, 1.0);

    float yscale = 0.24 + 0.12 * U.roll0;
    float gratBright = 0.08 + 0.05 * U.roll1;
    float coreScale = 0.35 + 0.75 * clamp(U.white, 0.0, 1.0);

    // --- graticule: 10x8 divisions, centre axes brighter ---
    float fx = fract(suv.x * 10.0);
    float fy = fract(suv.y * 8.0);
    float gx = 1.0 - smoothstep(0.01, 0.05, min(fx, 1.0 - fx));
    float gy = 1.0 - smoothstep(0.01, 0.05, min(fy, 1.0 - fy));
    float axisX = 1.0 - smoothstep(0.002, 0.006, abs(suv.x - 0.5));
    float axisY = 1.0 - smoothstep(0.002, 0.006, abs(suv.y - 0.5));
    float grat = max(max(gx, gy) * 0.5, max(axisX, axisY));

    // --- the trace ---
    float w0 = wave256(waveform, suv.x);
    float w1 = wave256(waveform, min(suv.x + 1.0 / 256.0, 1.0));
    float y = 0.5 - 0.5 * (w0 + w1) * yscale;
    // dwell law: perpendicular distance to the sloped segment, and a
    // dimming term for beam speed — slow curves burn, retraces vanish
    float slope = (w1 - w0) * yscale * 256.0;
    float dPerp = abs(suv.y - y) * rsqrt(1.0 + slope * slope);
    float dwell = 1.0 / (1.0 + 0.06 * abs(slope));
    float beam = exp(-dPerp * dPerp * 45000.0) + 0.30 * exp(-dPerp * dPerp * 2500.0);

    // --- the trigger lamp, blinking on the onset ---
    float2 lampP = suv - float2(0.93, 0.08);
    float lamp = exp(-dot(lampP, lampP) * 4000.0) * U.onsetEnv;

    // --- tube dressing ---
    float scan = 0.90 + 0.10 * cos(suv.y * 240.0 * PI);      // scanlines
    float vig = max(1.0 - 0.5 * r2, 0.0);                     // glass vignette

    float3 col = (U.colA.rgb * grat * gratBright
                + U.colB.rgb * beam * dwell * (0.75 + 0.35 * U.mid) * coreScale
                + U.colC.rgb * lamp)
               * scan * vig * inGlass;

    col += (hash21(pos.xy) - 0.5) * 0.004;
    return float4(govern(VOID_COL + max(col, float3(0.0)), U.white), 1.0);
}

// ---------------------------------------------------------------
// XFORM (luma) — the handover, edge-free. The departing room
// (ghost) and the live room blend by a luma-threshold dissolve:
// dark corners of the departing frame yield first, its brightest
// forms hold on longest. No wipe line, no travelling edge. The
// eased handover m = smoothstep(0.30, 0.70, t) makes the frame
// commit to one side instead of sitting in a mushy half-blend.
// This is mode 0 — the ONLY composite used under Reduce Motion, and
// the luma choreography is itself motionless, so it is safe there.
// The scatter / defocus / prism / ember composites live in
// Xforms.metal; the renderer selects one per segue by xformMode.
// ---------------------------------------------------------------
fragment float4 xform_luma(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float> liveTex [[texture(0)]],
                           texture2d<float> ghostTex [[texture(1)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);
    float2 uv = pos.xy / max(res, float2(1.0));

    float3 live  = liveTex.sample(smp, uv).rgb;
    float3 ghost = ghostTex.sample(smp, uv).rgb;

    float t = clamp(U.transition, 0.0, 1.0);
    float m = smoothstep(0.30, 0.70, t);        // commit to one side

    float key = clamp(lumaOf(ghost), 0.0, 1.0);
    float soft = 0.35;
    float w = clamp((m * (1.0 + soft) - key) / soft, 0.0, 1.0);

    return float4(mix(ghost, live, w), 1.0);
}
