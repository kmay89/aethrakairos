#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 5 — ARABESQUE, MAELSTROM, VOLTAGE, SILICON.
   Single-triangle fragment shaders, one per room, nothing else.
   These four open the house to thirty, and they are the Apple TV
   embodiments of the web player's scenes 38–41 — same physics,
   told in Metal.

   The same laws that rule Shaders.metal (and Shaders2..6.metal)
   rule here, copied verbatim from wave 1:
   - The ground is the void (#05060e). A room ADDS light onto it; it
     never paints a theme over it.
   - Colours come ONLY from the track's chord (colA/colB/colC). No
     hardcoded rainbows. The sanctioned near-whites here are VOLTAGE's
     channel core (a lightning channel is ~30 000 K and the room's own
     spec names it white) and MAELSTROM's foam — both tinted a hair
     toward the chord and held under the governor.
   - WCAG 2.3.1 is a law: govern_g() caps luminance at every exit using
     the INK white budget. A strike's answer is geometry and a governed
     lift, never an ungoverned white strobe.
   - r32Float is not filterable on the living-room GPUs, so the
     spectrum strip is read by INTEGER TEXEL and lerped by hand.
   - ghostStrength is the phantom hand. Here it is also each room's
     TOUCH, ported from the web: it winds the ARABESQUE lattice, rings
     the MAELSTROM's water, is the electrode VOLTAGE's arc reaches for,
     and is the probe SILICON's current prefers.
   - roll0..2 are the room's dice, re-dealt on entry — ARABESQUE deals
     its projection, MAELSTROM its sea state, VOLTAGE its electrode
     geometry, SILICON its board — so a room never wears the same face
     twice.
   - Every accumulation loop is bounded by a compile-time literal
     (<= 44 iterations here); no data-dependent trip counts.

   This is a SELF-CONTAINED translation unit. Every constant and
   helper wears a _g suffix so its symbol never collides with the
   identically shaped helpers in the other room units.
   ================================================================ */

constant float PI_G  = 3.14159265359;
constant float TAU_G = 6.28318530718;

// the void ground — #05060e in the linear-ish working space
constant float3 VOID_G = float3(0.019608, 0.023529, 0.054902);

// ---------------------------------------------------------------
// THE FINAL VizUniforms — verbatim, byte-for-byte identical across
// Shaders.metal, Shaders2..7.metal, Xforms.metal, Lens.metal and the
// mirror Swift struct. The layout is FIXED at 144 bytes; these rooms
// never read the lens, so the last three floats keep the neutral pad
// names here — what matters is three floats there, at the right bytes.
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// helpers (all _g — this file's private ladder)
// ---------------------------------------------------------------

inline float lumaOf_g(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// the flash governor / INK budget — the wave-1 curve, exactly
inline float3 govern_g(float3 c, float white) {
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

inline float hash11_g(float x) {
    return fract(sin(x * 12.9898) * 43758.5453123);
}
inline float hash21_g(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

inline float vnoise_g(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21_g(i);
    float b = hash21_g(i + float2(1.0, 0.0));
    float c = hash21_g(i + float2(0.0, 1.0));
    float d = hash21_g(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
inline float fbm2_g(float2 p) {
    return vnoise_g(p) * 0.62 + vnoise_g(p * 2.13 + float2(9.1, 3.7)) * 0.38;
}

// spectrum: 256x1 r32Float, the FIRST 64 texels carry the bands —
// integer texel + hand lerp, per the filterability law
inline float band64_g(texture2d<float, access::read> t, float u) {
    float fx = clamp(u, 0.0, 1.0) * 63.0;
    uint i0 = (uint)fx;
    uint i1 = min(i0 + 1u, 63u);
    float f = fx - (float)i0;
    return mix(t.read(uint2(i0, 0)).r, t.read(uint2(i1, 0)).r, f);
}

// pixel -> centered, aspect-true, Y UP. The web shaders these rooms
// port were written y-up; flipping once here keeps every ported
// expression verbatim instead of sign-audited line by line.
inline float2 centeredUp_g(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 uv = pix / r;
    float2 p = uv * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}

// the phantom hand's position in that same y-up space
inline float2 ghostUp_g(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}


// ===============================================================
// ARABESQUE — the girih lattice, pulled through a horizon.
// An eight-pointed star is two squares, one turned 45°, as the UNION
// of two box distances; an infinite brick-packed plane of them is
// pushed through one of three projections dealt by roll0: a floor
// and a ceiling meeting at a horizon (1/|y| is the whole perspective
// divide), a CONFORMAL log-polar well (radial step N/2π — square
// cells at every depth), or a plain inversion. The far field is
// HAZED, not resolved. The ghost hand winds the whole tiling.
// ===============================================================

inline float star8_g(float2 f) {
    float s1 = max(abs(f.x), abs(f.y));
    float2 r = abs(float2(f.x + f.y, f.x - f.y)) * 0.7071;
    return min(s1, max(r.x, r.y));
}

fragment float4 room_weave(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_g(pos.xy, res, U.aspect);

    // THE HAND WINDS THE LATTICE — a rotation whose angle decays with
    // distance from the ghost, so near it the tiling turns and the far
    // field only leans
    float2 g = ghostUp_g(U);
    float2 hd = p - g;
    float ha = U.ghostStrength * 1.1 * exp(-length(hd) * 1.5);
    float hc = cos(ha), hs = sin(ha);
    p = g + float2(hd.x * hc - hd.y * hs, hd.x * hs + hd.y * hc);

    // the lens: barrel the edges, and the slow wind of the whole picture
    float fish = 0.15 + U.roll2 * 0.35;
    p *= 1.0 + fish * dot(p, p);
    float wa = U.time * (U.roll1 - 0.5) * 0.08;
    float wc = cos(wa), ws = sin(wa);
    p = float2(p.x * wc - p.y * ws, p.x * ws + p.y * wc);

    float scaleT = 3.2 + U.roll1 * 1.8;
    float ringN  = 6.0 + floor(U.roll2 * 3.0) * 2.0;       // 6 / 8 / 10
    float flowT  = U.time * (0.35 + U.roll1 * 0.4) + U.onsetEnv * 0.22;

    float2 w; float depth;
    if (U.roll0 < 0.45) {
        // TWO PLANES meeting at the horizon
        float h = abs(p.y) + 0.035;
        depth = 1.0 / h;
        w = float2(p.x * depth * scaleT * 0.55, depth * scaleT * 0.45 + flowT);
    } else if (U.roll0 < 0.75) {
        // THE WELL — conformal log-polar
        float r = max(length(p), 1e-4);
        depth = 0.9 / r;
        w = float2((atan2(p.y, p.x) / TAU_G + 0.5) * ringN, log(r) * ringN * 0.159155 - flowT);
    } else {
        // INVERSION — the lattice folded through the unit circle
        float2 q = p / max(dot(p, p), 1e-4);
        depth = length(q);
        w = q * scaleT * 0.4 + float2(flowT * 0.4, flowT * 0.3);
    }
    // brick-pack: every other row slides half a cell
    w.x += 0.5 * fmod(abs(floor(w.y)), 2.0);

    float2 cell = floor(w);
    float2 f = fract(w) - 0.5;
    float hz = hash21_g(cell + floor(U.roll1 * 61.0));
    float d = star8_g(f);
    float aa = 0.03 + depth * 0.012;
    float fade = 1.0 / (1.0 + depth * depth * 0.020);
    float pulse = 0.5 + 0.5 * sin(U.time * (0.9 + hz * 0.9) + hz * TAU_G);
    float R = 0.20 + 0.03 * pulse + U.bass * 0.04 + U.onsetEnv * 0.025;

    float star = smoothstep(R + aa, R - aa, d);
    // the nested star, turned 22.5° — the octagram's own symmetry group,
    // breathing in antiphase with its parent
    float ca8 = 0.92388, sa8 = 0.38268;
    float dIn = star8_g(float2(f.x * ca8 - f.y * sa8, f.x * sa8 + f.y * ca8));
    float inner = smoothstep(R * 0.52 + aa, R * 0.52 - aa, dIn);
    float core = smoothstep(R * 0.24 + aa, R * 0.24 - aa, d);
    // the glow HUGS the star; the space between stays black
    float halo = exp(-max(d - R, 0.0) * 13.0);
    float web = 1.0 - smoothstep(0.02 + aa, 0.05 + aa, abs(d - (R + 0.11)));

    float3 col = U.colB.rgb * halo * (0.50 + U.mid * 0.35) * (1.0 - star * 0.4);
    col += U.colC.rgb * web * 0.40;
    col += U.colA.rgb * star * (0.45 + 0.35 * pulse + U.onsetEnv * 0.35 * step(0.6, hz));
    col += U.colB.rgb * inner * star * (0.35 + 0.45 * (1.0 - pulse));
    col += mix(U.colA.rgb, float3(1.0), 0.55) * core
         * (0.45 + U.treble * 0.7 * step(0.86, hash21_g(cell + floor(U.time * 6.0))));
    col *= fade;
    if (U.roll0 < 0.45) col += U.colC.rgb * exp(-abs(p.y) * 22.0) * 0.5;   // the seam of infinity
    col *= 0.85 + U.energy * 0.30;

    col += (hash21_g(pos.xy) - 0.5) * 0.004;
    return float4(govern_g(VOID_G + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// MAELSTROM — the sea in weather, marched honestly. HEAVY.
// Five directional Stokes components: crests sharpen by an exponent
// the music drives (pow of a non-negative base — safe), and each
// octave leans forward over its own trough by a trochoidal domain
// warp. Whitecaps appear where the surface is high AND steep. The
// camera rides a boat on this same sea; a big onset in a loud
// passage lights the cloud deck from inside, under the governor.
// The trace is regula falsi between a bracketed crossing — seven
// refinements, a compile-time bound.
// ===============================================================

inline float waveH_g(float2 q, float amp0, float choppy, float seaT) {
    float h = 0.0, amp = amp0, freq = 0.24, sp = 1.0;
    float2 d = normalize(float2(0.78, 0.62));
    const float2x2 R = float2x2(float2(0.545, 0.838), float2(-0.838, 0.545));
    for (int i = 0; i < 4; i++) {
        float ph = dot(d, q) * freq + seaT * sp;
        float c = 0.5 + 0.5 * sin(ph);
        h += (pow(c, choppy) - 0.30) * amp;
        q += d * cos(ph) * amp * 0.55;          // the trochoidal lean
        d = R * d;
        freq *= 1.83; amp *= 0.46; sp *= 1.13;
    }
    return h;
}
inline float waveFine_g(float2 q, float amp0, float choppy, float seaT) {
    return waveH_g(q, amp0, choppy, seaT)
         + (vnoise_g(q * 2.8 + seaT * 0.7) - 0.5) * amp0 * 0.14
         + (vnoise_g(q * 6.1 - seaT * 0.4) - 0.5) * amp0 * 0.05;
}
inline float3 skyCol_g(float3 rd, constant VizUniforms& U, float gloom, float flash, float seaT) {
    float t = clamp(rd.y, 0.0, 1.0);
    float3 c = mix(float3(0.16, 0.18, 0.20), float3(0.045, 0.058, 0.095), pow(t, 0.55));
    c = mix(c, U.colC.rgb * 0.30, 0.25);
    float cl = vnoise_g(rd.xz / (abs(rd.y) + 0.18) * 1.3 + seaT * 0.06);
    c *= (0.70 + cl * 0.50) * (1.0 - gloom * 0.25);
    c += float3(0.85, 0.90, 1.05) * flash * (0.30 + 0.70 * pow(1.0 - t, 2.0)) * (0.5 + cl * 0.8);
    return c;
}

fragment float4 room_ocean(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float, access::read> spectrum [[texture(0)]],
                           texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_g(pos.xy, res, U.aspect);
    float t = U.time;

    // the sea state, dealt on entry: swell -> squall -> gale -> hurricane
    float gloom  = 0.40 + U.roll1 * 0.60;
    float amp    = (0.55 + U.roll1 * 0.65) * (0.75 + U.bass * 0.55);
    float choppy = (1.7 + U.roll1 * 2.3) * (0.85 + U.energy * 0.45);
    float speed  = (1.1 + U.roll1 * 1.4);
    float foamK  = 0.80 - U.roll1 * 0.40;
    float seaT   = t * 1.1;
    // sheet lightning: only a hard onset in a loud passage reaches the deck
    float flash  = U.onsetEnv * U.onsetEnv * smoothstep(0.45, 0.75, U.energy) * 0.8;

    // THE BOAT — roll, pitch, and a loosely held helm
    float roll = sin(t * 0.40) * 0.055 * gloom + sin(t * 0.23) * 0.03;
    float pitch = -0.13 + sin(t * 0.31) * 0.03 * gloom;
    float3 ro = float3(0.0, 3.3 + amp * 1.2 + sin(t * 0.5) * 0.25 * gloom, t * speed);
    float3 rd = normalize(float3(p.x, p.y * 0.75 + pitch, 1.35));
    float cr = cos(roll), sr = sin(roll);
    rd.xy = float2(rd.x * cr - rd.y * sr, rd.x * sr + rd.y * cr);
    float yaw = sin(t * 0.045) * 0.30 * gloom;
    float cy = cos(yaw), sy = sin(yaw);
    rd.xz = float2(rd.x * cy - rd.z * sy, rd.x * sy + rd.z * cy);

    float3 col;
    float hx = 1.0;
    if (rd.y < 0.05) {
        float3 far = ro + rd * 60.0;
        hx = far.y - waveH_g(far.xz, amp, choppy, seaT);
    }
    if (hx > 0.0) {
        col = skyCol_g(rd, U, gloom, flash, seaT);
    } else {
        // heightmap tracing by regula falsi
        float tm = 0.0, tx = 60.0;
        float hm = ro.y - waveH_g(ro.xz, amp, choppy, seaT);
        float3 pm = ro + rd * 8.0;
        float hp = pm.y - waveH_g(pm.xz, amp, choppy, seaT);
        if (hp < 0.0) { tx = 8.0; hx = hp; } else { tm = 8.0; hm = hp; }
        float3 hit = ro;
        for (int i = 0; i < 7; i++) {
            float tmid = mix(tm, tx, hm / (hm - hx));
            hit = ro + rd * tmid;
            float hmid = hit.y - waveH_g(hit.xz, amp, choppy, seaT);
            if (hmid < 0.0) { tx = tmid; hx = hmid; } else { tm = tmid; hm = hmid; }
        }
        float dist = mix(tm, tx, hm / (hm - hx));
        hit = ro + rd * dist;
        float eps = 0.06 + dist * 0.012;
        float hc0 = waveFine_g(hit.xz, amp, choppy, seaT);
        float3 n = normalize(float3(
            waveFine_g(hit.xz - float2(eps, 0.0), amp, choppy, seaT)
              - waveFine_g(hit.xz + float2(eps, 0.0), amp, choppy, seaT),
            2.0 * eps,
            waveFine_g(hit.xz - float2(0.0, eps), amp, choppy, seaT)
              - waveFine_g(hit.xz + float2(0.0, eps), amp, choppy, seaT)));
        float3 l = normalize(float3(0.25, 0.50, 0.65));
        float fres = pow(1.0 - max(0.0, dot(-rd, n)), 3.0) * 0.62 + 0.06;
        float3 deep = mix(float3(0.030, 0.105, 0.135), U.colB.rgb * 0.30, 0.45)
                    * (0.65 + U.energy * 0.35);
        float diff = max(0.0, dot(n, l));
        float3 water = deep * (0.40 + diff * 0.65) + skyCol_g(reflect(rd, n), U, gloom, flash, seaT) * fres;
        // light through the crest — the green heart a storm wave shows
        float crest = clamp(hc0 / max(amp * 1.5, 0.3), 0.0, 1.5);
        water += U.colA.rgb * crest * crest * 0.40 * (0.55 + U.energy * 0.5);
        float spec = pow(max(0.0, dot(reflect(-l, n), -rd)), 60.0) * (1.0 + flash * 7.0);
        water += float3(0.90, 0.95, 1.00) * spec;
        // WHITECAPS: high AND steep, streaked by wind-blown noise
        float steep = (1.0 - n.y) * 2.4;
        float f1 = vnoise_g(hit.xz * 1.4 + seaT * 0.5);
        float f2 = vnoise_g(hit.xz * 3.7 - seaT * 0.8);
        float foam = smoothstep(foamK, foamK + 0.35, crest + steep)
                   * smoothstep(0.30, 0.75, f1 * 0.6 + f2 * 0.5);
        water = mix(water, float3(0.72, 0.78, 0.82) * (0.45 + diff * 0.5 + flash * 0.7),
                    clamp(foam, 0.0, 1.0));
        // spray: the treble whips single sparks off the caps
        water += float3(1.0) * step(0.988, hash21_g(floor(hit.xz * 12.0) + floor(t * 9.0)))
               * foam * U.treble * 0.7;
        col = mix(water, skyCol_g(rd, U, gloom, flash, seaT), 1.0 - exp(-dist * 0.045));
    }

    // RAIN — screen space, sheared by the wind, caught all at once by the flash
    float2 rp = float2(p.x + p.y * (0.35 + gloom * 0.45), p.y);
    float2 rq = float2(rp.x * 42.0, rp.y * 2.4);
    float rc = floor(rq.x);
    float rh = hash21_g(float2(rc, 5.0));
    float ry = fract(rq.y * (0.7 + rh * 0.6) + t * (2.2 + rh * 2.0) + rh * 9.0);
    float rain = smoothstep(0.30, 0.02, abs(fract(rq.x) - 0.5))
               * smoothstep(0.30, 0.0, ry) * step(0.35, rh)
               * gloom * (0.45 + U.energy * 0.7);
    col += float3(0.55, 0.62, 0.70) * rain * 0.20 * (1.0 + flash * 2.2);

    // THE HAND IS WIND ON WATER — rings spreading from the ghost
    float hr2 = length(p - ghostUp_g(U));
    col += U.colB.rgb * U.ghostStrength * exp(-hr2 * 3.0)
         * (0.5 + 0.5 * sin(hr2 * 22.0 - t * 8.0)) * 0.30;
    col *= 0.85 + U.energy * 0.30;

    col += (hash21_g(pos.xy) - 0.5) * 0.004;
    // the sea paints the whole frame; the void is its floor, not its ground
    return float4(govern_g(max(col, VOID_G), U.white), 1.0);
}


// ===============================================================
// VOLTAGE — dielectric breakdown at glow width. A polyline channel
// whose perpendicular wander is layered noise pinned at both
// electrodes, re-seeded on a FLICKER CLOCK (the jitter of a real arc
// is the re-seeding, not the glow), lit by the onset envelope — every
// hit is a return stroke. Three electrode geometries by roll0:
// cloud-to-ground over a ridge in silhouette, a plasma globe, and a
// Jacob's ladder that climbs the gap and re-strikes at the bottom.
// The ghost hand is an electrode the arc reaches for.
// ===============================================================

inline float2 boltPoint_g(float2 a, float2 b, float s, float seed, float jolt, float wiggle) {
    float2 ab = b - a;
    float L = max(length(ab), 1e-4);
    float2 dir = ab / L;
    float2 nrm = float2(-dir.y, dir.x);
    float env = s * (1.0 - s) * 2.0 + 0.04;
    float off = (fbm2_g(float2(s * 5.0 + seed * 37.0, jolt)) - 0.5) * 1.05
              + (vnoise_g(float2(s * 21.0 + seed * 91.0, jolt * 1.7)) - 0.5) * 0.28;
    return a + dir * (s * L) + nrm * off * env * wiggle * L;
}
inline float boltDist_g(float2 p, float2 a, float2 b, float seed, float jolt, float wiggle) {
    float d = 1e3;
    float2 q0 = boltPoint_g(a, b, 0.0, seed, jolt, wiggle);
    for (int i = 1; i <= 10; i++) {
        float2 q1 = boltPoint_g(a, b, float(i) / 10.0, seed, jolt, wiggle);
        float2 e = q1 - q0, w = p - q0;
        float h = clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
        d = min(d, length(w - e * h));
        q0 = q1;
    }
    return d;
}
inline float3 boltGlow_g(float d, float amp, float3 tint) {
    return (float3(1.0) * exp(-d * 85.0) * 1.5 + tint * (0.013 / (d + 0.011))) * amp;
}

fragment float4 room_bolt(float4 pos [[position]],
                          constant VizUniforms& U [[buffer(0)]],
                          constant float2& res [[buffer(1)]],
                          texture2d<float, access::read> spectrum [[texture(0)]],
                          texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_g(pos.xy, res, U.aspect);
    float3 col = float3(0.0);
    float3 tint = mix(float3(0.45, 0.50, 1.00), U.colA.rgb, 0.55);
    float wiggle = 0.5 + U.roll2 * 0.5;

    // THE FLICKER CLOCK — the channel re-randomises in steps, never smoothly
    float jolt = hash11_g(floor(U.time * 16.0) * 0.731) * 100.0;
    // the path re-deals with each phrase of strikes; the strike itself is
    // the onset envelope — a return stroke with the hit's own decay
    float seed = hash11_g(floor(U.time * 0.45) * 1.37 + U.roll1 * 9.0);
    float strike = U.onsetEnv;
    float idle = 0.06 + U.energy * 0.12;
    float amp = strike + idle * (0.6 + 0.4 * sin(U.time * 17.0));
    float flashV = strike * 0.8;

    // the charged sky: cloud fbm lit from inside on the strike
    float cl = fbm2_g(p * float2(1.2, 2.1) + float2(U.time * 0.03, 0.0) + U.roll1 * 7.0);
    col += mix(float3(0.020, 0.020, 0.042), U.colC.rgb * 0.14, cl)
         * (0.75 + flashV * 2.0 * (0.4 + 0.6 * smoothstep(-0.4, 1.0, p.y)));

    float2 g = ghostUp_g(U);

    if (U.roll0 < 0.4) {
        // CLOUD TO GROUND — the ghost raised into the field is the better path
        float ax = (seed - 0.5) * 1.4;
        float2 a = float2(ax, 1.05);
        float2 b = float2(ax * 0.3 + (hash11_g(seed * 7.0) - 0.5) * 0.8, -0.9);
        if (U.ghostStrength > 0.05) b = mix(b, g, clamp(U.ghostStrength * 1.4, 0.0, 1.0));
        col += boltGlow_g(boltDist_g(p, a, b, seed, jolt, wiggle), amp, tint);
        float2 j1 = boltPoint_g(a, b, 0.35, seed, jolt, wiggle);
        float2 j2 = boltPoint_g(a, b, 0.62, seed, jolt, wiggle);
        col += boltGlow_g(boltDist_g(p, j1, j1 + float2( 0.45, -0.50) * (0.4 + hash11_g(jolt) * 0.5), seed + 3.0, jolt, wiggle), amp * 0.40, tint);
        col += boltGlow_g(boltDist_g(p, j2, j2 + float2(-0.50, -0.42) * (0.35 + hash11_g(jolt + 2.0) * 0.5), seed + 7.0, jolt, wiggle), amp * 0.34, tint);
        col += tint * exp(-length(p - b) * 3.0) * strike * 0.8;
        // the ridge in silhouette — a strike with no horizon has no scale
        float ridge = -0.62 + (fbm2_g(float2(p.x * 0.9 + U.roll1 * 19.0, 3.7)) - 0.5) * 0.35;
        float ground = smoothstep(ridge + 0.015, ridge - 0.015, p.y);
        col = mix(col, float3(0.004, 0.005, 0.010), ground * 0.92);
        col += tint * exp(-abs(p.y - ridge) * 26.0) * (strike * 0.5 + 0.03);
    } else if (U.roll0 < 0.7) {
        // PLASMA GLOBE — the same polyline, radial; the ghost's finger on
        // the glass captures the nearest streamer, exactly as the toy does
        float rg = 0.86;
        col += tint * exp(-abs(length(p) - rg) * 26.0) * 0.45;
        col += U.colB.rgb * exp(-length(p) * 2.4) * 0.35;
        for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float ang = seed * TAU_G + fk * 2.094 + sin(U.time * (0.23 + fk * 0.11) + fk) * 1.3;
            float2 b2 = float2(cos(ang), sin(ang)) * rg;
            if (U.ghostStrength > 0.05 && k == 0)
                b2 = (g + float2(1e-4)) * min(1.0, rg / max(length(g), 1e-3));
            col += boltGlow_g(boltDist_g(p, float2(0.0), b2, seed + fk * 11.0, jolt, wiggle),
                              (0.30 + strike * 0.8) * (0.6 + 0.4 * sin(U.time * 3.0 + fk * 2.0)), tint);
        }
        col += tint * exp(-length(float2(p.x * 1.6, p.y + 1.04)) * 5.0) * 0.10;
    } else {
        // JACOB'S LADDER — the arc climbs because hot air rises, and
        // re-strikes at the bottom when it gets too long to hold
        float climbT = U.time * (0.22 + U.energy * 0.4);
        float climb = fract(climbT);
        float y0 = -0.72 + climb * 1.45;
        float spread = 0.16 + climb * 0.52;
        float dRail = abs(abs(p.x) - (0.16 + (p.y + 0.72) * 0.36));
        float rails = smoothstep(-0.80, -0.72, p.y) * (1.0 - smoothstep(0.72, 0.80, p.y));
        col += float3(0.50, 0.55, 0.62) * exp(-dRail * 55.0) * rails * 0.45;
        float2 a = float2(-spread, y0), b = float2(spread, y0);
        if (U.ghostStrength > 0.05) b = mix(b, g, clamp(U.ghostStrength, 0.0, 0.8));
        col += boltGlow_g(boltDist_g(p, a, b, seed + floor(climbT) * 5.0, jolt, wiggle),
                          0.35 + strike * 0.9 + climb * 0.25, tint);
        col += tint * exp(-length(p - a) * 14.0) * 0.5 + tint * exp(-length(p - b) * 14.0) * 0.5;
    }

    // static: the treble crackles off every surface
    col += tint * step(0.9965, hash21_g(floor(p * 90.0) + floor(U.time * 24.0))) * U.treble * 0.45;

    col += (hash21_g(pos.xy) - 0.5) * 0.004;
    return float4(govern_g(VOID_G + max(col, float3(0.0)), U.white), 1.0);
}


// ===============================================================
// SILICON — a machine caught thinking. A Truchet circuit board:
// every cell holds one of a few PCB strokes (45° chamfers, straight
// runs, junctions, vias) dealt by hash, and the eye completes the
// netlist. SIGNAL FRONTS propagate out of the package ordered by
// Manhattan distance — the honest metric on a grid whose wires run
// straight and diagonal — brightened hard by the onsets; inside the
// package the die's gates flip against a threshold the treble sets,
// and its row buses read the LIVE SPECTRUM. roll0 deals the board:
// MOTHERBOARD / BACKPLANE / DIE SHOT. The ghost hand is a probe to
// ground — the copper lights around it, and says so.
// ===============================================================

fragment float4 room_circuit(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 P = centeredUp_g(pos.xy, res, U.aspect);
    float mode = U.roll0 < 0.45 ? 0.0 : (U.roll0 < 0.75 ? 1.0 : 2.0);
    float scaleT = (mode < 0.5) ? (5.5 + U.roll1 * 3.0)
                 : (mode < 1.5) ? (6.5 + U.roll1 * 3.5)
                                : (3.0 + U.roll1 * 1.5);
    float2 g0 = P * scaleT + float2(floor(U.roll2 * 37.0), floor(U.roll2 * 23.0));
    float2 cell = floor(g0);
    float2 f = fract(g0) - 0.5;
    float h = hash21_g(cell + floor(U.roll1 * 53.0));
    if (mode > 0.5 && mode < 1.5) h = h * 0.4 + 0.42;      // a backplane runs disciplined verticals

    // the stroke this cell holds
    float dtr;
    if      (h < 0.20) dtr = abs(f.x + f.y) * 0.7071;
    else if (h < 0.40) dtr = abs(f.x - f.y) * 0.7071;
    else if (h < 0.58) dtr = abs(f.y);
    else if (h < 0.80) dtr = abs(f.x);
    else if (h < 0.93) dtr = min(abs(f.x), abs(f.y));
    else               dtr = length(f);
    float trace = smoothstep(0.085, 0.050, dtr);
    float viaR = length(f);
    float via = (h >= 0.93)
      ? (smoothstep(0.30, 0.25, viaR) - smoothstep(0.13, 0.09, viaR)) : 0.0;

    // THE SIGNAL FRONT — Manhattan distance from the package (or along
    // the backplane), a per-net delay from the cell's own hash, the
    // front on the music's clock; the onsets step it hard
    float rad = (mode > 0.5 && mode < 1.5) ? abs(cell.x) : (abs(cell.x) + abs(cell.y));
    float clock = U.time * 0.14 + U.onsetEnv * 0.05;
    float ph = fract(rad * 0.045 - clock + h * 0.05);
    float pulse = exp(-ph * 8.0);

    float3 sub = U.colB.rgb * 0.045;
    sub *= 0.80 + 0.40 * hash21_g(cell * 1.7 + floor(U.roll2 * 11.0));   // the solder mask is never one green
    float3 copper = U.colB.rgb * 0.16 + float3(0.02);
    float3 sig = U.colA.rgb;
    float3 col = sub;
    col = mix(col, copper * (0.8 + U.energy * 0.4), trace);
    col += sig * trace * pulse * (0.45 + U.onsetEnv * 0.8);
    // THE EXPRESS — every few bars one whole net carries a burst end to
    // end; the cycle's own hash deals the row and the direction
    float exCycle = floor(U.time / 2.4);
    float exPh = fract(U.time / 2.4);
    float exRow = floor(U.roll2 * 23.0) + floor(hash11_g(exCycle * 3.3) * 13.0) - 6.0;
    float exDir = hash11_g(exCycle * 7.7) < 0.5 ? 1.0 : -1.0;
    float exHalf = U.aspect * scaleT + 2.0;
    float exX = floor(U.roll2 * 37.0) + exDir * (exPh * 2.0 - 1.0) * exHalf;
    col += sig * trace * (1.0 - min(1.0, abs(cell.y - exRow)))
         * exp(-abs(g0.x - exX) * 0.9) * (0.4 + U.energy * 0.8) * smoothstep(0.0, 0.12, exPh) * 1.4;
    col += float3(0.92, 0.78, 0.42) * via * (0.28 + U.mid * 0.25);

    // THE PACKAGE, and the die inside it thinking; on the DIE SHOT the
    // package is the whole field. The row buses read the live spectrum.
    float dChip = (mode < 0.5) ? max(abs(g0.x) - 3.2, abs(g0.y) - 2.3)
                : (mode < 1.5) ? 1.0 : -1.0;
    if (dChip < 0.0) {
        float2 dg = floor(g0 * 4.0);
        float block = hash21_g(floor(dg / 8.0) + floor(U.roll1 * 17.0));
        float gate = hash21_g(dg + floor(clock * (3.0 + U.treble * 6.0) + block * 7.0) * 0.31 + U.roll1);
        float busy = 0.05 + U.treble * 0.25 + U.energy * 0.15;
        float busBand = band64_g(spectrum, fract(dg.y * 0.061));
        float3 die = float3(0.018, 0.022, 0.030)
                   + sig * step(1.0 - busy, gate) * (0.55 + U.onsetEnv * 0.35)
                   + copper * step(0.93, fract(dg.y * 0.125)) * (0.5 + busBand * 0.9);
        col = die;
        if (mode < 0.5) col += sig * exp(dChip * 8.0) * 0.20;
    }
    if (mode < 0.5) col += sig * exp(-abs(dChip) * 5.0) * U.onsetEnv * 0.22;   // the clock pin flashes the rim

    // THE PROBE — copper prefers the ghost's hand, and says so in light
    float hd = length(P - ghostUp_g(U));
    col += sig * trace * exp(-hd * 3.5) * U.ghostStrength
         * (0.6 + 0.4 * sin(hd * 18.0 - U.time * 7.0));
    col += float3(1.0) * exp(-hd * 28.0) * U.ghostStrength * 0.22;
    col *= 0.85 + U.energy * 0.30;

    col += (hash21_g(pos.xy) - 0.5) * 0.004;
    return float4(govern_g(VOID_G + max(col, float3(0.0)), U.white), 1.0);
}
