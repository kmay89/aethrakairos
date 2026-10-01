#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 23 — ARCHITECTURE AGAINST GRAVITY: MASONRY.

   Stone can only push. Every structure here is a way of turning
   weight into a path of compression that reaches the ground inside
   the stone — and every collapse is that path stepping outside it.

   THE ARCH: voussoirs laid on a timber centering from both
   springings to the keystone, the centering struck, and the line of
   thrust drawn — the funicular of the loads: the ring's own weight
   hangs as a catenary, a point load adds the triangle it would
   hang a chain into, and the thrust is whatever makes the sum pass
   through the crown. Unloaded it rides the crown's extrados and
   the haunches' intrados (the semicircle's known weakness); loaded,
   it steps out of the stone at the haunches, hinges form, and at
   the fourth the ring is a mechanism: the haunches tip outward
   about the springings, the crown pieces fold, the keystone drops
   as a wedge, and the stones fall. The dice deal the semicircle,
   the pointed two-centred arch and the catenary — the perfect
   arch, whose axis is its own thrust line.

   THE CORBEL: brick stacking by the harmonic law. The k-th brick
   from the top overhangs the one below by 1/(2k) of its length, so
   every sub-stack's centre of mass sits exactly on the edge that
   carries it and the reach is H_n/2 lengths. Two stacks meet, a
   capstone closes the corbelled arch of Mycenae, every plumb line
   is drawn; lift the capstone and the stacks tip about their
   joints.

   THE DOME: a spherical cap on a drum, buttressed, seen a little
   from above — the pixel's own point on the sphere, reconstructed.
   Membrane theory: N_φ = −qR/(1+cos φ) always pushes; the hoops
   N_θ = qR(1/(1+cos φ) − cos φ) change sign at 51.8° (cos φ = 1/φ,
   the golden ratio): compression above, tension below, which stone
   cannot carry, so it cracks along its meridians and the base wants
   a chain; a lantern load adds P/(2πR sin²φ) of tension everywhere.
   The hemisphere has no thrust (a chain), the bulb pulls inward at
   its base, the saucer thrusts outward and its thrust line is drawn
   down through the buttress piers. At the end the twelve segments
   burst outward about their bases, an orange peeled.

   Stateless, as every room is: each face is a function of one
   clock. The bass is the load, the beat a tremor, the treble the
   glint on a crack; the ghost's hand is a load where it presses.

   Laws as ever: void ground, chord-only colour, govern_f() at every
   exit, roll0..2 the dice, every loop bounded by a compile-time
   literal (<= 15 here). All symbols wear _f — a self-contained
   translation unit.
   ================================================================ */

constant float PI_F  = 3.14159265359;
constant float GY_F  = -0.78;
constant float3 VOID_F = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_f(float3 c, float white) {
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
inline float hash21_f(float2 p) { p = fract(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
inline float2 centeredUp_f(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_f(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_f(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
inline float2 rot_f(float2 v, float a) { float c = cos(a), s = sin(a); return float2(c * v.x - s * v.y, s * v.x + c * v.y); }
inline float sdBox_f(float2 p, float2 b) { float2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
inline float easeOut_f(float u) { u = clamp(u, 0.0, 1.0); return 1.0 - (1.0 - u) * (1.0 - u); }
/* a stone: the masonry tint with its own hash, bevelled dark at the joint */
inline float3 stone_f(float3 base, float id, float edge, float varA) {
    float h = hash21_f(float2(id * 1.7 + 0.3, varA * 5.0 + 1.0));
    return base * (0.72 + 0.56 * h) * (0.25 + 0.75 * smoothstep(0.0, 0.014, edge));
}
/* ---------- THE ARCH: the ring's own frame ----------
   s along the ring, 0 at the left springing, 1 at the right; n outward from the centreline */
inline float3 ringUV_f(float2 p, float R, float shape) {
    if (shape < 0.5) {
        float r = length(p);
        float th = r < 1e-4 ? 0.0 : atan2(p.y, p.x);
        return float3(1.0 - th / PI_F, r - R, th >= 0.0 ? 1.0 : 0.0);
    } else if (shape < 1.5) {
        float c = 0.35 * R, Rp = R + c;
        float2 q = float2(abs(p.x) + c, p.y);
        float r = length(q);
        float th = r < 1e-4 ? 0.0 : atan2(q.y, q.x);
        float thA = atan2(sqrt(Rp * Rp - c * c), c);
        float u = th / thA;
        float s = p.x >= 0.0 ? 1.0 - 0.5 * u : 0.5 * u;
        return float3(s, r - Rp, (th >= 0.0 && u <= 1.0) ? 1.0 : 0.0);
    } else {
        float a = 0.51;
        float f = a * (cosh(R / a) - cosh(p.x / a));
        float fp = -sinh(p.x / a);
        float q = rsqrt(1.0 + fp * fp);
        float n = (p.y - f) * q;
        float x0 = p.x + n * fp * q;
        float s = 0.5 + 0.5 * sinh(x0 / a) / sinh(R / a);
        return float3(s, n, p.y >= -0.02 ? 1.0 : 0.0);
    }
}
inline float2 ringXY_f(float s, float n, float R, float shape) {
    if (shape < 0.5) { float th = PI_F * (1.0 - s); return (R + n) * float2(cos(th), sin(th)); }
    else if (shape < 1.5) {
        float c = 0.35 * R, Rp = R + c;
        float thA = atan2(sqrt(Rp * Rp - c * c), c);
        float u = s >= 0.5 ? (1.0 - s) * 2.0 : s * 2.0;
        float2 q = (Rp + n) * float2(cos(u * thA), sin(u * thA)) - float2(c, 0.0);
        return float2(s >= 0.5 ? q.x : -q.x, q.y);
    } else {
        float a = 0.51;
        float x0 = a * asinh((2.0 * s - 1.0) * sinh(R / a));
        float f = a * (cosh(R / a) - cosh(x0 / a));
        float fp = -sinh(x0 / a);
        return float2(x0, f) + n * float2(-fp, 1.0) * rsqrt(1.0 + fp * fp);
    }
}
inline float ringRise_f(float R, float shape) {
    if (shape < 0.5) return R;
    if (shape < 1.5) { float c = 0.35 * R; return sqrt((R + c) * (R + c) - c * c); }
    return 0.51 * (cosh(R / 0.51) - 1.0);
}
/* the mechanism: the left half's inverse motion. Piece A (springing → haunch) tips outward
   by phi about the springing extrados; piece B (haunch → keystone joint) folds by psi about
   the haunch intrados as it rides on A, the keystone joint hinged at the extrados — the
   joint under the load opens from below and the keystone drops as a wedge. The right half
   is the mirror. psi is whatever keeps the keystone's corner at its own x. */
inline float psiOf_f(float phi, float R, float t, float shape) {
    float2 SL = ringXY_f(0.0, 0.5 * t, R, shape), HL = ringXY_f(0.28, -0.5 * t, R, shape), C = ringXY_f(7.0 / 15.0, 0.5 * t, R, shape);
    float2 HLp = SL + rot_f(HL - SL, phi);
    float2 v = C - HL;
    float r = length(v), gam = atan2(v.y, v.x);
    return gam - acos(clamp((C.x - HLp.x) / r, -1.0, 1.0));
}
inline float keyDrop_f(float phi, float psi, float R, float t, float shape) {
    float2 SL = ringXY_f(0.0, 0.5 * t, R, shape), HL = ringXY_f(0.28, -0.5 * t, R, shape), C = ringXY_f(7.0 / 15.0, 0.5 * t, R, shape);
    float2 HLp = SL + rot_f(HL - SL, phi);
    float2 Cp = HLp + rot_f(C - HL, -psi);
    return C.y - Cp.y;
}
inline float2 mechInv_f(float2 p, float onB, float phi, float psi, float R, float t, float shape) {
    float2 SL = ringXY_f(0.0, 0.5 * t, R, shape);
    float2 HL = ringXY_f(0.28, -0.5 * t, R, shape);
    if (onB > 0.5) {
        float2 HLp = SL + rot_f(HL - SL, phi);
        p = HLp + rot_f(p - HLp, psi);
    }
    return SL + rot_f(p - SL, -phi);
}
inline float2 mechFwd_f(float2 q, float onB, float phi, float psi, float R, float t, float shape) {
    float2 SL = ringXY_f(0.0, 0.5 * t, R, shape);
    float2 HL = ringXY_f(0.28, -0.5 * t, R, shape);
    float2 qa = SL + rot_f(q - SL, phi);
    if (onB < 0.5) return qa;
    float2 HLp = SL + rot_f(HL - SL, phi);
    return HLp + rot_f(qa - HLp, -psi);
}
/* the harmonic numbers, exactly */
inline float harm_f(float m) { float h = 0.0; for (int i = 1; i <= 12; i++) { if (float(i) <= m + 0.5) h += 1.0 / float(i); } return h; }
/* a rotation about a unit axis, Rodrigues */
inline float3 rotAxis_f(float3 v, float3 a, float b) { return v * cos(b) + cross(a, v) * sin(b) + a * dot(a, v) * (1.0 - cos(b)); }


// ===============================================================
// MASONRY — the arch, the corbel, the dome.
// ===============================================================
fragment float4 room_masonry(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_f(pos.xy, res, U.aspect);
    float sc = clamp(U.aspect / 1.3, 0.55, 1.0);
    p /= sc;
    p.x += U.onsetEnv * 0.004 * sin(U.time * 37.0);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    float shape = floor(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float varA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    float T = U.time * 0.85;
    float2 hand = ghostUp_f(U) / sc;
    float hs = clamp(U.ghostStrength, 0.0, 1.0);
    float3 col = float3(0.0);
    float3 base = chordRamp_f(U, 0.45 + varA * 0.2);
    float3 hot = chordRamp_f(U, 0.85), cool = chordRamp_f(U, 0.15);
    float GY = GY_F;
    // the ground
    col += chordRamp_f(U, 0.55) * exp(-(p.y - GY) * (p.y - GY) * 30000.0) * 0.12;
    col += base * smoothstep(GY, GY - 0.25, p.y) * 0.03;

    if (mode == 0) {
        /* ===================== THE ARCH ===================== */
        float R = 0.9, t = 0.16, ys = -0.42;
        const float N = 15.0;
        float TS = 7.4, TF = 17.0, TM = 0.9, TD = 1.7, P = 20.3;
        float ph = fmod(T, P);
        float2 q = p - float2(0.0, ys);
        // the piers: the abutments that take the thrust to the ground
        for (int side = 0; side < 2; side++) {
            float sx = side == 0 ? -R : R;
            float d = sdBox_f(q - float2(sx, (GY - ys) * 0.5), float2(0.19, (0.0 - (GY - ys)) * 0.5));
            if (d < 0.0) {
                float course = floor((q.y - (GY - ys)) / 0.09);
                float ce = abs(fract((q.y - (GY - ys)) / 0.09) - 0.5) * 0.09;
                col = stone_f(base, course * 3.0 + float(side) * 7.0, min(-d, ce), varA) * 0.85;
            }
        }
        // the centering: the timber the ring is laid on, struck once the keystone is in
        if (ph < TS + 0.8) {
            float drop = ph > TS ? 1.4 * (ph - TS) * (ph - TS) : 0.0;
            float fade = 1.0 - smoothstep(TS, TS + 0.8, ph);
            float3 c = ringUV_f(q + float2(0.0, drop), R, shape);
            float3 wood = chordRamp_f(U, 0.35) * 0.5;
            if (c.z > 0.5 && c.x > 0.0 && c.x < 1.0 && c.y < -0.5 * t - 0.015 && c.y > -0.5 * t - 0.05) col = wood * fade;
            if (c.z > 0.5 && c.y < -0.5 * t - 0.05 && q.y + drop > GY - ys) {
                for (int j = 0; j < 5; j++) {
                    float xj = (float(j) - 2.0) * 0.3 * R / 0.9;
                    if (abs(q.x - xj) < 0.012) col = wood * 0.8 * fade;
                }
            }
        }
        float3 c0 = ringUV_f(q, R, shape);
        // THE RING: fifteen voussoirs, laid from the springings to the keystone
        float tau = ph - TF;
        if (ph < TF) {
            float3 c = c0;
            if (c.z > 0.5 && c.x > 0.0 && c.x < 1.0) {
                float k = floor(c.x * N);
                float key = (k == 7.0) ? 0.03 : 0.0;
                if (abs(c.y) < 0.5 * t + key) {
                    float o = min(k, N - 1.0 - k) * 2.0 + (k > 7.0 ? 1.0 : 0.0);
                    float tk = 0.3 + o * 0.45;
                    if (ph >= tk) {
                        float arc = 3.0 * R / N;
                        float e = min(min(fract(c.x * N), 1.0 - fract(c.x * N)) * arc, 0.5 * t + key - abs(c.y));
                        col = stone_f(base, k + 20.0, e, varA) * (1.0 + exp(-(ph - tk) * 5.0) * 0.8);
                        col += hot * exp(-(ph - tk) * 5.0) * 0.15;
                    }
                }
            }
        } else if (tau < TM + TD) {
            float phi = 0.55 * min(tau, TM) * min(tau, TM), psi = psiOf_f(phi, R, t, shape);
            float tau2 = max(tau - TM, 0.0);
            float dropK = keyDrop_f(phi, psi, R, t, shape);
            if (tau < TM) {
                // the mechanism: four pieces, five hinges, and the keystone sliding between
                for (int side = 0; side < 2; side++) {
                    float2 pm = side == 0 ? q : float2(-q.x, q.y);
                    for (int piece = 0; piece < 2; piece++) {
                        float2 qq = mechInv_f(pm, float(piece), phi, psi, R, t, shape);
                        float3 c = ringUV_f(qq, R, shape);
                        float lo = piece == 0 ? 0.0 : 0.28, hi = piece == 0 ? 0.28 : 7.0 / 15.0;
                        if (c.z > 0.5 && c.x >= lo && c.x < hi && abs(c.y) < 0.5 * t) {
                            float k = floor(c.x * N);
                            float arc = 3.0 * R / N;
                            float e = min(min(fract(c.x * N), 1.0 - fract(c.x * N)) * arc, 0.5 * t - abs(c.y));
                            col = stone_f(base, k + 20.0, e, varA);
                            float hg = exp(-abs(c.x - lo) * 40.0) + exp(-abs(c.x - hi) * 40.0);
                            col += hot * hg * 0.5;
                        }
                    }
                }
                float3 ck = ringUV_f(q + float2(0.0, dropK), R, shape);
                if (ck.z > 0.5 && floor(ck.x * N) == 7.0 && abs(ck.y) < 0.5 * t + 0.03) {
                    float arc = 3.0 * R / N;
                    float e = min(min(fract(ck.x * N), 1.0 - fract(ck.x * N)) * arc, 0.5 * t + 0.03 - abs(ck.y));
                    col = stone_f(base, 27.0, e, varA) + hot * 0.2;
                }
            } else {
                // the fall: every voussoir on its own, from where the mechanism left it
                float fade = 1.0 - smoothstep(TD - 0.4, TD, tau2);
                for (int k = 0; k < 15; k++) {
                    float fk = float(k);
                    float sk = (fk + 0.5) / N;
                    float onB = (sk > 0.28 && sk < 0.72) ? 1.0 : 0.0;
                    float right = sk > 0.5 ? 1.0 : 0.0;
                    float2 ck = ringXY_f(sk, 0.0, R, shape);
                    float2 ckm = right > 0.5 ? float2(-ck.x, ck.y) : ck;
                    float2 ckp = mechFwd_f(ckm, onB, phi, psi, R, t, shape);
                    float alpha = onB > 0.5 ? phi - psi : phi;
                    if (right > 0.5) { ckp.x = -ckp.x; alpha = -alpha; }
                    if (k == 7) { ckp = ck - float2(0.0, dropK); alpha = 0.0; }
                    float h1 = hash21_f(float2(fk * 3.1 + 0.7, varA * 9.0)), h2 = hash21_f(float2(varA * 4.0 + 1.0, fk * 1.9));
                    float dir = sk < 0.5 ? -1.0 : 1.0;
                    float2 off = float2(((h1 - 0.5) * 0.5 + dir * 0.15) * tau2, (h2 * 0.3 - 0.2) * tau2 - 1.4 * tau2 * tau2);
                    float spin = (h1 - 0.5) * 5.0 * tau2;
                    float2 qm = ckp + rot_f(q - ckp - off, -alpha - spin);
                    float2 qq = ck + (qm - ckp);
                    float3 c = ringUV_f(qq, R, shape);
                    if (c.z > 0.5 && floor(c.x * N) == fk && abs(c.y) < 0.5 * t + (k == 7 ? 0.03 : 0.0) && ckp.y + off.y > GY - ys - 0.15) {
                        float arc = 3.0 * R / N;
                        float e = min(min(fract(c.x * N), 1.0 - fract(c.x * N)) * arc, 0.5 * t - abs(c.y));
                        col = mix(col, stone_f(base, fk + 20.0, e, varA), fade);
                    }
                }
            }
        }
        // THE THRUST LINE: the funicular of the loads. The ring's own weight hangs as a
        // catenary (its own thrust a); a point load P at xh adds the triangle it would hang
        // a chain into; the thrust H is whatever makes the sum pass through the crown point.
        float progress = smoothstep(TS + 0.5, TF - 0.5, ph);
        float Pl = 0.05 + 0.75 * progress + U.bass * 0.25;
        float xh = 0.0;
        bool handOn = hs > 0.08 && abs(hand.x) < R + 0.3 && hand.y > ys;
        if (handOn) { Pl += hs * 0.7; xh = clamp(hand.x, -R * 0.85, R * 0.85); }
        float rise = ringRise_f(R, shape);
        float ac = shape < 0.5 ? 0.55 : (shape < 1.5 ? 0.465 : 0.51);
        float yc = rise + 0.5 * t - 0.012;
        float cat0 = ac * (cosh(R / ac) - 1.0);
        float tri0 = (R * R - xh * xh) / (2.0 * R);
        float H = (cat0 + Pl * tri0) / yc;
        float built = smoothstep(TS, TS + 0.6, ph) * (1.0 - step(TF, ph));
        if (built > 0.0) {
            float yl = (ac * (cosh(R / ac) - cosh(q.x / ac)) + Pl * ((R - xh) * (q.x + R) / (2.0 * R) - max(0.0, q.x - xh))) / H;
            float sl = (-sinh(q.x / ac) + Pl * ((R - xh) / (2.0 * R) - step(xh, q.x))) / H;
            float d = abs(q.y - yl) * rsqrt(1.0 + sl * sl);
            float edgeness = clamp(abs(c0.y) / (0.5 * t), 0.0, 1.0);
            float3 lc = mix(cool, hot, edgeness * edgeness);
            float inSpan = step(abs(q.x), R) * step(0.0, q.y);
            col += lc * (exp(-d * d * 25000.0) * 0.55 + exp(-d * d * 700.0) * 0.10) * inSpan * built;
            // and on down through the abutments, straight, at the springing's slope
            float ss = (-sinh(R / ac) + Pl * ((R - xh) / (2.0 * R) - 1.0)) / H;
            for (int side = 0; side < 2; side++) {
                float sg = side == 0 ? -1.0 : 1.0;
                float xl = R + q.y / ss;
                float dp = abs(q.x * sg - xl) * abs(ss) * rsqrt(1.0 + ss * ss);
                float xg = R + (GY - ys) / ss;
                float outside = clamp((xg - (R + 0.19)) / 0.04, 0.0, 1.0);
                float3 pc = mix(cool, hot, clamp((xg - (R + 0.10)) / 0.09, 0.0, 1.0));
                float inPier = step(q.y, 0.0) * step(GY - ys, q.y);
                col += pc * (exp(-dp * dp * 25000.0) * 0.5 + exp(-dp * dp * 700.0) * 0.08) * inPier * built;
                float2 toe = float2((R + 0.19) * sg, GY - ys);
                col += hot * exp(-dot(q - toe, q - toe) * 600.0) * outside * (0.8 + U.treble * 0.5) * built;
            }
            // the middle third, faint: where the thrust must stay for the stone to feel no tension
            if (c0.z > 0.5 && abs(c0.y) < t / 6.0 && c0.x > 0.0 && c0.x < 1.0) col += cool * 0.03 * built;
            // the hinges: where the line meets the edge of the stone
            for (int j = 0; j < 9; j++) {
                float xj = -0.72 * R + 1.44 * R * (float(j) + 0.5) / 9.0;
                float yj = (ac * (cosh(R / ac) - cosh(xj / ac)) + Pl * ((R - xh) * (xj + R) / (2.0 * R) - max(0.0, xj - xh))) / H;
                float3 cj = ringUV_f(float2(xj, yj), R, shape);
                float ex = abs(cj.y) - (0.5 * t - 0.012);
                if (ex > 0.0) {
                    float g = clamp(ex / 0.03, 0.0, 1.0);
                    float dd = length(q - float2(xj, yj));
                    col += hot * exp(-dd * dd * 900.0) * g * (0.9 + U.treble * 0.6) * built;
                }
            }
        }
        // the ghost's hand: a load where it presses
        if (handOn) {
            float dh = length(q - float2(xh, rise + 0.5 * t + 0.06));
            col += hot * exp(-dh * dh * 400.0) * hs * 0.6;
        }
    } else if (mode == 1) {
        /* ===================== THE CORBEL ===================== */
        float n = shape < 0.5 ? 7.0 : (shape < 1.5 ? 9.0 : 11.0);
        float hb = 0.085, Lb = 0.42, yb = -0.52;
        float Hn = harm_f(n);
        float g = 0.5 * Lb * Hn;
        float TB = 0.3 + 2.0 * n * 0.4 + 0.8, TF = TB + 7.0, P = TF + 4.4;
        float ph = fmod(T, P);
        // the cliffs
        for (int side = 0; side < 2; side++) {
            float sg = side == 0 ? -1.0 : 1.0;
            float2 pc = float2(p.x * sg, p.y);
            if (pc.x < -g && p.y > GY && p.y < yb) {
                float course = floor((p.y - GY) / 0.13);
                float ce = min(abs(fract((p.y - GY) / 0.13) - 0.5) * 0.13, min(-g - pc.x, yb - p.y));
                col = stone_f(base, course * 5.0 + float(side), ce, varA) * 0.7;
            }
        }
        float capT = 0.3 + 2.0 * n * 0.4 + 0.3;
        float tau = ph - TF;
        // the bricks
        float fallFade = 1.0 - smoothstep(3.2, 3.8, tau);
        for (int side = 0; side < 2; side++) {
            float sg = side == 0 ? -1.0 : 1.0;
            float delay = side == 0 ? 0.0 : 0.4;
            float tt = tau - 0.5 - delay;
            for (int j = 1; j <= 12; j++) {
                float fj = float(j);
                if (fj > n) break;
                float E = -g + 0.5 * Lb * (Hn - harm_f(n - fj));
                float2 bc = float2(E - 0.5 * Lb, yb + (fj - 0.5) * hb);
                float tk = 0.3 + (2.0 * (fj - 1.0) + float(side)) * 0.4;
                if (ph < tk) continue;
                float2 pp = float2(p.x * sg, p.y);
                float slide = 0.6 * (1.0 - easeOut_f((ph - tk) / 0.35));
                pp.x += slide;
                if (tau > 0.0 && fj >= 2.0) {
                    // the topple: the sub-stack from course 2 up tips inward about the joint's inner edge
                    float2 piv = float2(-g + 0.5 * Lb * (Hn - harm_f(n - 1.0)), yb + hb);
                    float th = -0.9 * clamp(tt, 0.0, 1.0) * clamp(tt, 0.0, 1.0);
                    float t2 = max(tt - 1.0, 0.0);
                    float2 bcp = piv + rot_f(bc - piv, th);
                    float h1 = hash21_f(float2(fj * 2.3 + float(side), varA * 7.0)), h2 = hash21_f(float2(varA * 3.0, fj * 1.3 + float(side) * 2.0));
                    float2 off = float2(((h1 - 0.5) * 0.4 + 0.25) * t2, (h2 * 0.3 - 0.1) * t2 - 1.4 * t2 * t2);
                    float spin = (h1 - 0.5) * 6.0 * t2;
                    if (tt > 0.0) pp = bc + rot_f(pp - bcp - off, -th - spin);
                    if (bcp.y + off.y < GY - 0.1) continue;
                }
                float d = sdBox_f(pp - bc, float2(0.5 * Lb, 0.5 * hb));
                if (d < 0.0) {
                    float3 s = stone_f(base, fj * 3.0 + float(side) * 11.0, -d, varA) * (1.0 + exp(-(ph - tk) * 5.0) * 0.6);
                    col = (tau > 0.0 && fj >= 2.0) ? mix(col, s, fallFade) : s;
                }
            }
        }
        // the plumb lines: every sub-stack's centre of mass, exactly on the edge that carries it
        if (ph > TB - 0.5 && ph < TF + 0.5) {
            for (int side = 0; side < 2; side++) {
                float sg = side == 0 ? -1.0 : 1.0;
                float px = p.x * sg;
                for (int j = 1; j <= 12; j++) {
                    float fj = float(j);
                    if (fj > n) break;
                    float E = -g + 0.5 * Lb * (Hn - harm_f(n - fj + 1.0));
                    float m = n - fj + 1.0;
                    float xc = E;
                    // a hand on the stack is a load: the centre of mass moves toward it
                    if (hs > 0.08 && hand.x * sg > -g - Lb && hand.y > yb + (fj - 1.0) * hb && hand.y < yb + n * hb + 0.1) {
                        float mh = hs * 2.0; xc = (m * E + mh * hand.x * sg) / (m + mh);
                    }
                    float y0 = yb + (fj - 1.0) * hb, y1 = yb + hb * ((fj - 1.0) + m * 0.5);
                    float over = clamp((xc - E) / 0.05, 0.0, 1.0);
                    float3 lc = mix(cool, hot, over);
                    float dx = px - xc;
                    if (p.y > y0 - 0.01 && p.y < y1) col += lc * exp(-dx * dx * 60000.0) * (fj == 1.0 ? 0.6 : 0.32) * (1.0 + over);
                    if (fj == 1.0) col += lc * exp(-dx * dx * 60000.0) * step(GY, p.y) * step(p.y, y0) * 0.15;
                }
            }
        }
        // the capstone: the corbel arch closed — and opened again
        if (ph > capT) {
            float lift = tau > 0.0 ? 0.35 * easeOut_f(tau / 0.5) : 0.0;
            float fade = 1.0 - smoothstep(0.2, 0.6, tau);
            float slide = 0.5 * (1.0 - easeOut_f((ph - capT) / 0.4));
            float2 pp = p - float2(0.0, yb + (n + 0.5) * hb + slide + lift);
            float d = sdBox_f(pp, float2(0.5 * Lb, 0.5 * hb));
            if (d < 0.0) col = mix(col, stone_f(base, 99.0, -d, varA) * 1.1, fade);
        }
        if (hs > 0.08) { float dh = length(p - hand); col += hot * exp(-dh * dh * 400.0) * hs * 0.4; }
    } else {
        /* ===================== THE DOME ===================== */
        float Rd = 0.6, ys = -0.12, tl = 0.30;
        float ct = cos(tl), st = sin(tl);
        float phiM = shape < 0.5 ? PI_F * 0.5 : (shape < 1.5 ? 1.955 : PI_F * 0.25);
        float R = Rd / sin(phiM);
        float yc = ys - R * cos(phiM);
        float TB = 7.0, TF = 16.5, TX = 2.4, P = 19.7;
        float ph = fmod(T, P);
        float tau = ph - TF;
        // the load: the lantern's weight, the bass, a hand on the crown
        float pl = 0.10 * smoothstep(TB + 0.5, TF - 0.5, ph) + U.bass * 0.04;
        bool handOn = hs > 0.08 && abs(hand.x) < Rd && hand.y > ys;
        if (handOn) pl += hs * 0.06;
        // membrane theory, self-weight q: N_phi = -qR/(1+cos), N_theta = qR(1/(1+cos) - cos) + P/(2 pi R sin^2)
        float Nphi = 1.0 / (1.0 + cos(phiM)) + pl / max(sin(phiM) * sin(phiM), 0.05);
        float Hth = Nphi * cos(phiM);
        // the drum
        float ytop = ys * ct;
        if (abs(p.x) < Rd && p.y > GY && p.y < ytop + Rd * st * sqrt(max(1.0 - p.x * p.x / (Rd * Rd), 0.0))) {
            float course = floor((p.y - GY) / 0.11);
            float pil = abs(fract(p.x / 0.15 + 0.5) - 0.5) * 0.15;
            float ce = min(abs(fract((p.y - GY) / 0.11) - 0.5) * 0.11, min(Rd - abs(p.x), pil + 0.01));
            col = stone_f(base, course * 4.0 + floor(p.x / 0.15), ce, varA) * 0.75;
            float top = ytop - Rd * st * sqrt(max(1.0 - p.x * p.x / (Rd * Rd), 0.0));
            if (p.y > top) col = base * 0.28;
        }
        // the buttresses: piers and their flyers, on either side
        for (int side = 0; side < 2; side++) {
            float sg = side == 0 ? -1.0 : 1.0;
            float2 pp = float2(p.x * sg, p.y);
            float toeX = Rd + 0.42, topY = (ys - 0.28) * ct;
            float lean = 0.0;
            if (tau > 0.0 && Hth > 0.02) lean = 0.7 * min(tau, 1.6) * min(tau, 1.6);
            float2 toe = float2(toeX, GY);
            float2 pq = toe + rot_f(pp - toe, lean);
            float d = sdBox_f(pq - float2(Rd + 0.29, (topY + GY) * 0.5), float2(0.13, (topY - GY) * 0.5));
            if (d < 0.0) {
                float course = floor((pq.y - GY) / 0.1);
                col = stone_f(base, course * 2.0 + 40.0 + float(side), min(-d, abs(fract((pq.y - GY) / 0.1) - 0.5) * 0.1), varA) * 0.8;
            }
            // the flyer: the half-arch that hands the thrust to the pier
            float2 a = float2(Rd + 0.02, ytop - 0.03), b = float2(Rd + 0.29, topY);
            float2 ab = b - a; float h = clamp(dot(pq - a, ab) / dot(ab, ab), 0.0, 1.0);
            float df = length(pq - a - ab * h) - 0.032 - 0.02 * (1.0 - h);
            if (df < 0.0 && tau < TX) col = stone_f(base, 60.0 + float(side), -df, varA) * 0.85;
            // THE THRUST LINE through the buttress: the flyer hands the pier the horizontal
            // thrust and a little of its own slope; the pier's weight is what steers the line
            // back inside — it must reach the ground within the pier's base
            if (Hth > 0.02 && ph > TB && tau < TX) {
                float dl = length(pq - a - ab * h);
                col += cool * exp(-dl * dl * 25000.0) * 0.4 * step(0.0, h) * step(h, 1.0);
                float depth = topY - pp.y;
                if (depth > 0.0 && pp.y > GY) {
                    float wb = 3.0, xb = Rd + 0.29, xa = Rd + 0.24;
                    float V0 = Hth * 1.0;
                    float xr = (V0 * xa + Hth * depth + wb * depth * xb) / (V0 + wb * depth);
                    float dx = pp.x - xr;
                    float outside = clamp((xr - toeX) / 0.03, 0.0, 1.0);
                    float3 lc = mix(cool, hot, clamp((xr - (Rd + 0.31)) / 0.11, 0.0, 1.0));
                    col += lc * (exp(-dx * dx * 25000.0) * 0.5 + exp(-dx * dx * 700.0) * 0.1);
                    col += hot * exp(-length(pp - toe) * length(pp - toe) * 600.0) * outside * (0.8 + U.treble * 0.5);
                }
            }
        }
        // THE DOME: a sphere seen a little from above; the pixel's own point on it
        float2 sxy = float2(p.x, p.y - yc * ct);
        float built = phiM - (phiM + 0.05) * clamp(ph / TB, 0.0, 1.0);
        float3 Ld = normalize(float3(-0.45, 0.62, -0.64));
        bool hit = false; float3 nrm = float3(0.0); float phi = 0.0, lam = 0.0; float segOpen = 0.0;
        if (tau < 0.0 || tau > TX) {
            float s2 = R * R - dot(sxy, sxy);
            if (s2 > 0.0) {
                float s = sqrt(s2);
                float3 Pp = float3(sxy.x, sxy.y * ct + s * st, sxy.y * st - s * ct);
                if (Pp.y >= R * cos(phiM)) {
                    hit = true; nrm = Pp / R;
                    phi = acos(clamp(Pp.y / R, -1.0, 1.0));
                    lam = (abs(Pp.x) + abs(Pp.z) < 1e-5) ? 0.0 : atan2(Pp.x, Pp.z);
                }
            }
        } else {
            // THE BURST: twelve segments, each hinged outward about its own base — the orange peel
            float3 o = float3(sxy.x, sxy.y * ct, sxy.y * st);
            float3 dv = float3(0.0, -st, ct);
            float best = 1e9;
            for (int i = 0; i < 12; i++) {
                float li = (float(i) + 0.5) * PI_F / 6.0;
                float3 ax = float3(cos(li), 0.0, -sin(li));
                float3 B = float3(R * sin(phiM) * sin(li), R * cos(phiM), R * sin(phiM) * cos(li));
                float h1 = hash21_f(float2(float(i) * 1.3, varA * 6.0));
                float tt = max(tau - h1 * 0.4, 0.0);
                float beta = 1.1 * tt * tt;
                float3 drop = float3(0.0, -1.2 * max(tt - 0.8, 0.0) * max(tt - 0.8, 0.0), 0.0);
                float3 oo = B + rotAxis_f(o - drop - B, ax, -beta);
                float3 dd = rotAxis_f(dv, ax, -beta);
                float bq = dot(oo, dd), cq = dot(oo, oo) - R * R;
                float disc = bq * bq - cq;
                if (disc < 0.0) continue;
                float w = -bq - sqrt(disc);
                float3 Pp = oo + dd * w;
                float lp = (abs(Pp.x) + abs(Pp.z) < 1e-5) ? 0.0 : atan2(Pp.x, Pp.z);
                float dl = lp - li; dl -= floor(dl / (2.0 * PI_F) + 0.5) * 2.0 * PI_F;
                if (abs(dl) > PI_F / 12.0 || Pp.y < R * cos(phiM)) continue;
                if (w < best) {
                    best = w; hit = true; phi = acos(clamp(Pp.y / R, -1.0, 1.0)); lam = lp;
                    nrm = rotAxis_f(Pp / R, ax, beta); segOpen = beta;
                }
            }
        }
        float fadeX = tau > 0.0 ? 1.0 - smoothstep(TX - 0.5, TX, tau) : 1.0;
        if (hit && phi >= built && tau < TX) {
            float cphi = cos(phi), sphi = max(sin(phi), 0.02);
            // the hoop force: compression above 51.8°, tension below — and the lantern's share
            float nth = 1.0 / (1.0 + cphi) - cphi + pl / (sphi * sphi);
            float dif = max(0.0, dot(nrm, Ld));
            float dphi = PI_F / 22.0;
            float seamP = abs(fract(phi / dphi) - 0.5) * dphi * R;
            float seamM = abs(fract(lam / (PI_F / 6.0) + 0.5) - 0.5) * (PI_F / 6.0) * R * sphi;
            float id = floor(phi / dphi) * 13.0 + floor(lam / (PI_F / 6.0) + 0.5);
            float3 sc3 = stone_f(base, id, min(seamP, seamM), varA) * (0.3 + 0.8 * dif);
            float ten = clamp(nth * 1.4, 0.0, 1.0), cmp = clamp(-nth * 1.2, 0.0, 1.0);
            float lit = smoothstep(TB, TB + 3.0, ph);
            sc3 = mix(sc3, sc3 * hot * 2.2, ten * 0.55 * lit);
            sc3 = mix(sc3, sc3 * cool * 2.0, cmp * 0.35 * lit);
            // the ring where the hoops change sign — 51.8° under self-weight alone
            sc3 += hot * exp(-nth * nth * 400.0) * 0.35 * lit;
            // the meridional cracks: the tension the stone cannot carry, opening with the load
            float cw = ten * 0.022 * smoothstep(TB + 2.0, TF - 1.0, ph);
            if (seamM < cw) { sc3 = float3(0.0); sc3 += hot * exp(-(cw - seamM) * 200.0) * (0.5 + U.treble * 0.5); }
            if (segOpen > 0.0) sc3 += hot * 0.25 * min(segOpen, 1.0);
            col = mix(col, sc3, fadeX);
        }
        // the base ring: the chain that holds the hoop tension (the hemisphere), or the
        // compression ring the bulb leans on
        {
            float2 e = float2(p.x / Rd, (p.y - ytop) / (Rd * st));
            float de = abs(length(e) - 1.0) * Rd * st;
            float nb = 1.0 / (1.0 + cos(phiM)) - cos(phiM) + pl / max(sin(phiM) * sin(phiM), 0.05);
            float3 lc = nb > 0.0 ? hot : cool;
            float front = step(p.y, ytop) * 0.7 + 0.3;
            float snap = (tau > 0.0 && tau < 0.5) ? exp(-tau * 6.0) * 2.0 : 0.0;
            col += lc * exp(-de * de * 40000.0) * (0.25 + abs(nb) * 0.3 + snap) * front * smoothstep(0.5, 1.5, ph) * (tau < TX ? 1.0 : 0.0);
        }
        // the lantern, last
        if (ph > TB + 0.2 && tau < 0.0) {
            float crown = (yc + R) * ct;
            float d1 = sdBox_f(p - float2(0.0, crown + 0.05), float2(0.06, 0.06));
            float d2 = length(p - float2(0.0, crown + 0.11)) - 0.06;
            float d = min(d1, d2);
            if (d < 0.0) col = stone_f(base, 77.0, -d, varA) * (1.0 + exp(-(ph - TB - 0.2) * 4.0));
        }
        if (handOn) { float dh = length(p - hand); col += hot * exp(-dh * dh * 400.0) * hs * 0.5; }
    }
    col += (hash21_f(pos.xy) - 0.5) * 0.006;
    return float4(govern_f(VOID_F + max(col, float3(0.0)), U.white), 1.0);
}
