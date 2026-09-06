#include <metal_stdlib>
using namespace metal;

/* ================================================================
   THE XFORM POOL + THE GRADE — the composite tail of the pipeline.
   Architecture (unchanged from wave 1): the departing room is frozen
   into a texture; a composite blends it against the live room into an
   intermediate; grade_pass then writes that intermediate to the
   drawable. The renderer picks one composite per segue, NEVER the
   same form twice in a row, and ALWAYS mode 0 (luma) under Reduce
   Motion. Min durations enforce the law that "a light which crosses
   a room in half a second is a flash": luma 0.55, scatter 0.9,
   defocus 0.8, prism 0.7, ember 1.4 s.

   Both offscreen targets here are rgba16Float — filterable on the
   living-room GPUs — so these composites sample with a normalized
   linear sampler (the room shaders, which read r32Float, cannot).

   Every composite obeys the eased handover m = smoothstep(0.30,0.70,t)
   so the frame commits to one side. At t = 1 every one collapses to
   the live image exactly, so the pipeline can run a composite at rest
   (transition pinned at 1) with no seam.

   grade_pass is the INK GRADE, applied LAST on the way to the
   drawable: a hue-preserving soft-knee rolloff (knee 0.68) that turns
   additive overdrive into saturation instead of a white clip, gated
   by the white budget; plus a gentle vignette and a starfield floor
   that only fills the void a room left dark.

   Program-scope names here carry the _x / _X suffix so this
   translation unit never collides with Shaders.metal's canonical
   originals (or Shaders2's _a / Shaders3's _b) at metallib link.
   ================================================================ */

constant float PI_X = 3.14159265359;

// ---- THE FINAL VizUniforms (wave 2) — VERBATIM across every .metal.
// First 96 bytes byte-for-byte from wave 1; slot 11 renamed
// _pad0 -> xformMode; twelve floats appended to a 144-byte stride.
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
// helpers (this translation unit owns its own — a Metal helper
// cannot cross a translation unit, so nothing here is shared with
// Shaders.metal by name)
// ---------------------------------------------------------------

inline float lumaOf_x(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

inline float hash_x(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

inline float2 hash2_x(float2 p) {
    float n = dot(p, float2(127.1, 311.7));
    return fract(sin(float2(n, n + 74.7)) * float2(43758.5453, 24634.6345));
}

// 3x3 gaussian-weighted tap; `rad` is a pixel radius, converted to
// normalized offsets by the caller's texel size.
inline float3 blur9_x(texture2d<float> t, sampler s, float2 uv, float2 texel, float rad) {
    float3 acc = float3(0.0);
    float wsum = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            float w = (i == 0 && j == 0) ? 4.0 : ((i == 0 || j == 0) ? 2.0 : 1.0);
            float2 o = float2(float(i), float(j)) * rad * texel;
            acc += t.sample(s, uv + o).rgb * w;
            wsum += w;
        }
    }
    return acc / max(wsum, 1e-4);
}

// The INK grade: hue-preserving soft-knee rolloff. The peak channel is
// compressed along a C1 knee that asymptotes to 1; the whole triple is
// rescaled by the same factor, so chromaticity (hue AND saturation)
// survives at any drive and overdrive reads as colour, never a wash to
// white. The white budget sets the overdrive factor at which the pixel
// is finally allowed to bleach: ~18x at the floor (specular cores
// only), ~2.2x at the ceiling (a drop may blow out).
inline float3 inkGrade_x(float3 c, float white) {
    const float knee = 0.68;
    float m = max(max(c.r, c.g), c.b);
    float scale = 1.0;
    if (m > knee) {
        float x = m - knee;
        float span = 1.0 - knee;
        float comp = knee + span * (x / (x + span));    // -> asymptotes to 1
        scale = comp / m;
    }
    float3 graded = c * scale;
    float wp = mix(18.0, 2.2, clamp(white, 0.0, 1.0));   // overdrive that reaches white
    float bleach = clamp((m - 1.0) / max(wp - 1.0, 1e-3), 0.0, 1.0);
    return mix(graded, float3(1.0), bleach * bleach);
}

// The starfield FLOOR: two octaves of sparse, static, tiny points,
// brightness 0.10..0.25. Added by the grade only where the composited
// image is near-black, so a room that already drew a sky is not
// doubled — this is the floor for the six wave-1 rooms, which do not.
inline float3 starLayer_x(float2 uv, float2 res) {
    float3 acc = float3(0.0);
    float2 aspect = float2(res.x / max(res.y, 1.0), 1.0);
    for (int oct = 0; oct < 2; oct++) {
        float scale = (oct == 0) ? 90.0 : 150.0;
        float2 g = uv * aspect * scale;
        float2 cell = floor(g);
        float2 f = fract(g) - 0.5;
        float h = hash_x(cell + float2(float(oct) * 17.0, float(oct) * 31.0));
        float star = step(0.996 - float(oct) * 0.001, h);
        float glow = exp(-dot(f, f) * 40.0);
        float bright = mix(0.10, 0.25, hash_x(cell + 7.3));
        acc += float3(0.72, 0.80, 1.0) * star * glow * bright;
    }
    return acc;
}

// ---------------------------------------------------------------
// SCATTER — the outgoing image breaks into hashed cells that drift
// apart and fade as the incoming sharpens in. The cell offset grows
// with progress; each cell drifts on its own hashed direction, so
// the departing room dissolves into a receding swarm of tiles.
// ---------------------------------------------------------------
fragment float4 xform_scatter(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float> liveTex [[texture(0)]],
                              texture2d<float> ghostTex [[texture(1)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);
    float2 uv = pos.xy / max(res, float2(1.0));
    float m = smoothstep(0.30, 0.70, clamp(U.transition, 0.0, 1.0));

    float3 live = liveTex.sample(smp, uv).rgb;

    const float cells = 28.0;
    float2 cell = floor(uv * cells);
    float2 h = hash2_x(cell);
    float2 dir = normalize(h - 0.5 + 1e-4);
    float drift = m * 0.35 * (0.4 + 0.6 * h.x);
    float2 guv = uv - dir * drift;
    float3 ghost = ghostTex.sample(smp, guv).rgb;

    // each tile fades on its own clock, staggered by its hash
    float ghostAlpha = (1.0 - m) * (1.0 - smoothstep(0.0, 1.0, (m - 0.5) * 1.4 + (h.y - 0.5) * 0.5));
    ghostAlpha = clamp(ghostAlpha, 0.0, 1.0);

    float3 col = live * m + ghost * ghostAlpha;
    return float4(col, 1.0);
}

// ---------------------------------------------------------------
// DEFOCUS — the outgoing blurs out of focus while the incoming
// sharpens in. Two 9-tap passes: the ghost radius opens with
// progress, the live radius closes to a point. A rack focus, not a
// wipe.
// ---------------------------------------------------------------
fragment float4 xform_defocus(float4 pos [[position]],
                              constant VizUniforms& U [[buffer(0)]],
                              constant float2& res [[buffer(1)]],
                              texture2d<float> liveTex [[texture(0)]],
                              texture2d<float> ghostTex [[texture(1)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);
    float2 r = max(res, float2(1.0));
    float2 uv = pos.xy / r;
    float2 texel = 1.0 / r;
    float m = smoothstep(0.30, 0.70, clamp(U.transition, 0.0, 1.0));

    float3 ghost = blur9_x(ghostTex, smp, uv, texel, m * 8.0);          // opens as it leaves
    float3 live  = blur9_x(liveTex,  smp, uv, texel, (1.0 - m) * 8.0);  // resolves as it arrives

    return float4(mix(ghost, live, m), 1.0);
}

// ---------------------------------------------------------------
// PRISM — the RGB channels of the blend separate radially, peak at
// mid-handover, then converge. The seam passes through a lens, not
// an edge.
// ---------------------------------------------------------------
fragment float4 xform_prism(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float> liveTex [[texture(0)]],
                            texture2d<float> ghostTex [[texture(1)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);
    float2 uv = pos.xy / max(res, float2(1.0));
    float m = smoothstep(0.30, 0.70, clamp(U.transition, 0.0, 1.0));

    float2 c = uv - 0.5;
    float sep = sin(m * PI_X) * 0.03;               // 0 at the ends, max mid-seam
    float2 off = normalize(c + 1e-4) * sep;

    float3 rC = mix(ghostTex.sample(smp, uv + off).rgb, liveTex.sample(smp, uv + off).rgb, m);
    float3 gC = mix(ghostTex.sample(smp, uv).rgb,       liveTex.sample(smp, uv).rgb,       m);
    float3 bC = mix(ghostTex.sample(smp, uv - off).rgb, liveTex.sample(smp, uv - off).rgb, m);

    return float4(rC.r, gC.g, bC.b, 1.0);
}

// ---------------------------------------------------------------
// EMBER — a luma-threshold dissolve whose crossover front is a lit,
// warm rim: pixels cross from the departing to the arriving room
// through a 1500–2600 K blackbody-orange edge (the lit form). No
// travelling wipe — the rim rides the per-pixel threshold, so the
// whole frame glows warm at the moment it commits. The slowest form,
// by law (min 1.4 s): a light that crosses a room slowly is a fire.
// ---------------------------------------------------------------
fragment float4 xform_ember(float4 pos [[position]],
                            constant VizUniforms& U [[buffer(0)]],
                            constant float2& res [[buffer(1)]],
                            texture2d<float> liveTex [[texture(0)]],
                            texture2d<float> ghostTex [[texture(1)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);
    float2 uv = pos.xy / max(res, float2(1.0));
    float m = smoothstep(0.30, 0.70, clamp(U.transition, 0.0, 1.0));

    float3 live  = liveTex.sample(smp, uv).rgb;
    float3 ghost = ghostTex.sample(smp, uv).rgb;

    float key = clamp(lumaOf_x(ghost), 0.0, 1.0);
    float soft = 0.35;
    float w = clamp((m * (1.0 + soft) - key) / soft, 0.0, 1.0);

    // the lit front: peaks where a pixel is mid-crossover this frame
    float band = w * (1.0 - w) * 4.0;
    // 1500 K deep orange -> 2600 K amber, warming as the handover runs
    float3 k1500 = float3(1.00, 0.42, 0.08);
    float3 k2600 = float3(1.00, 0.63, 0.30);
    float3 ember = mix(k1500, k2600, m);

    float3 base = mix(ghost, live, w);
    return float4(base + ember * band * 0.6, 1.0);
}

// ---------------------------------------------------------------
// GRADE — the INK pass, last before the drawable. Star floor into the
// void, then the hue-preserving soft-knee rolloff (knee 0.68) under
// the white budget, then a gentle vignette. No colour is invented
// here; overdrive is only ever turned into saturation.
// ---------------------------------------------------------------
fragment float4 grade_pass(float4 pos [[position]],
                           constant VizUniforms& U [[buffer(0)]],
                           constant float2& res [[buffer(1)]],
                           texture2d<float> src [[texture(0)]])
{
    constexpr sampler smp(coord::normalized, address::clamp_to_edge, filter::linear);
    float2 r = max(res, float2(1.0));
    float2 uv = pos.xy / r;

    float3 c = src.sample(smp, uv).rgb;

    // starfield floor — only where the room left the void dark
    float L = lumaOf_x(c);
    float floorAmt = clamp(1.0 - L * 6.0, 0.0, 1.0);
    c += starLayer_x(uv, r) * floorAmt;

    // the hue-preserving grade, gated by the white budget
    c = inkGrade_x(max(c, float3(0.0)), U.white);

    // a gentle vignette — the frame settles into its corners
    float2 q = uv * 2.0 - 1.0;
    float vig = 1.0 - 0.06 * clamp(dot(q, q), 0.0, 1.0);
    c *= vig;

    return float4(max(c, float3(0.0)), 1.0);
}
