#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 19 — THE TWISTED BOTTLE: STELLARATOR.

   A tokamak twists its field with a current in the plasma; a
   stellarator twists it with the shape of its coils alone, so
   nothing inside can ever quench. The price is that nothing is
   round: the cross-section carries the (2,1) and (3,1) helical
   harmonics, r_b(θ,φ) = a (1 − e2 cos(2θ − Nφ) + e3 cos(3θ − Nφ)),
   a bean at φ = 0 that turns into a triangle half a period on,
   N = 5 times round the ring, the way Wendelstein 7-X is shaped.
   THE SURFACE draws the last closed flux surface with its field
   lines — straight in magnetic coordinates, θ − ιφ = const, at a
   rotational transform ι = p/q the dice deal, so every line closes
   after q turns — and one line followed as a comet. THE SECTION is
   the Poincaré plot: a plane at toroidal angle φ, the nested
   surfaces the lines pierce, and at every rational ι = n/m the
   pendulum's islands, K = (s − s_r)² − w² cos(mθ − nφ), O-points
   and X-points and the chaotic sea past the last one; the tracer
   hops 2πι a beat, and on the island chain it hops island to
   island while librating about the O-point. Pressure pushes the
   inner surfaces outboard — the Shafranov shift, Δ ∝ β(1 − s²),
   the song's energy as β. THE HELIOTRON is the classical machine:
   two helical windings, l = 2, m = 10, one current the same way in
   both, and between them the plasma they hold, an ellipse pointed
   at the coils turning ten times round, p ∝ (1 − s²)² glowing from
   the axis out.

   Laws as ever: void ground, chord-only colour, govern_z() at every
   exit, ghostStrength as the hand, roll0..2 the dice, every loop
   bounded by a compile-time literal (<= 120 here). All symbols wear
   _z — a self-contained translation unit.
   ================================================================ */

constant float PI_Z  = 3.14159265359;
constant float TAU_Z = 6.28318530718;
constant float NFP_Z = 5.0;          // five field periods, as W7-X
constant float R0_Z  = 1.0;          // the major radius — every length in units of it
constant float3 VOID_Z = float3(0.019608, 0.023529, 0.054902);

struct VizUniforms {
    float time; float beatPhase; float barPhase; float energy;      // 0..3
    float bass; float mid; float treble; float calm;                // 4..7
    float onsetEnv; float aspect; float transition; float xformMode;// 8..11
    float4 colA; float4 colB; float4 colC;                          // 48 / 64 / 80
    float act; float phrasePhase; float white; float ghostX;        // 96..108
    float ghostY; float ghostStrength; float roll0; float roll1;    // 112..124
    float roll2; float _pad1; float _pad2; float _pad3;             // 128..140
    // _pad1/_pad2 (132/136) carry the LENS pass's live fields and _pad3
    // (140) the song's Camelot number — no pad here is free to claim
    float dHit; float dAge; float dKick; float dMass;               // 144..156  the dance bus (see tools/dance_prelude.mjs)
    float dArtic; float dSpark; float dSway; float dLift;           // 160..172
    float dBrace; float dImpact; float dStill; float dPeriod;       // 176..188  -> stride 192
};
static_assert(sizeof(VizUniforms) == 192, "VizUniforms drifted: the CPU mirror uploads 192 bytes");

inline float3 govern_z(float3 c, float white) {
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
// x², as a multiply: under fast math pow(x, 2.0) is NaN for x < 0, and one NaN voids the pixel
inline float sq_z(float x) { return x * x; }
inline float hash21_z(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_z(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_z(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_z(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}

/* THE SHAPE. The boundary's (2,1) and (3,1) harmonics: a bean at φ = 0, a
   triangle half a period on, and back — five times round the ring. */
inline float rbnd_z(float th, float ph, float a, float e2, float e3) {
    float h = NFP_Z * ph;
    return a * (1.0 - e2 * cos(2.0 * th - h) + e3 * cos(3.0 * th - h));
}
/* the flux label of a point in space — 0 on the magnetic axis (itself a helix,
   the (1,1) harmonic), 1 on the boundary — and its two angles */
inline float fluxLabel_z(float3 q, float a, float e2, float e3, float hx,
                         thread float& th, thread float& ph, thread float& rb) {
    float R = length(q.xz); ph = atan2(q.z, q.x);
    float ax = hx * a;
    float2 v = float2(R - R0_Z - ax * cos(NFP_Z * ph), q.y - ax * sin(NFP_Z * ph));
    th = atan2(v.y, v.x);
    rb = rbnd_z(th, ph, a, e2, e3);
    return length(v) / rb;
}
inline float3 surfPt_z(float th, float ph, float s, float a, float e2, float e3, float hx) {
    float ax = hx * a;
    float r = s * rbnd_z(th, ph, a, e2, e3);
    float Rr = R0_Z + ax * cos(NFP_Z * ph) + r * cos(th);
    float Zz = ax * sin(NFP_Z * ph) + r * sin(th);
    return float3(Rr * cos(ph), Zz, Rr * sin(ph));
}


// ===============================================================
// STELLARATOR — the surface, the section, the heliotron.
// ===============================================================
fragment float4 room_stellarator(float4 pos [[position]],
                                 constant VizUniforms& U [[buffer(0)]],
                                 constant float2& res [[buffer(1)]],
                                 texture2d<float, access::read> spectrum [[texture(0)]],
                                 texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_z(pos.xy, res, U.aspect);
    float2 hand = ghostUp_z(U);
    float hs = clamp(U.ghostStrength, 0.0, 1.0);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    // the dice deal the configuration, the transform and the comet's line; the web
    // re-deals on every entry, the TV holds one deal per visit — stateless, as ever
    int cfg = int(clamp(U.roll1 * 3.0, 0.0, 2.999));
    int io = int(clamp(U.roll2 * 6.0, 0.0, 5.999));
    float ip = io == 0 ? 5.0 : (io == 1 ? 5.0 : (io == 2 ? 5.0 : (io == 3 ? 2.0 : (io == 4 ? 3.0 : 5.0))));
    float iq = io == 0 ? 5.0 : (io == 1 ? 6.0 : (io == 2 ? 4.0 : (io == 3 ? 3.0 : (io == 4 ? 4.0 : 7.0))));
    float iota = ip / iq;
    float nl = iq * max(1.0, floor(10.0 / iq + 0.5));   // q·k lines, k landing near ten, so every line closes
    float varA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    float beat = U.onsetEnv;
    // the clocks the web accumulates with the music, here read off the one clock
    float cam = U.time * 0.11;
    float phiS = U.time * 0.07;
    float hop = U.time * (1.2 + U.energy * 0.8);
    float trace = U.time * 0.75;
    float3 col = float3(0.0);

    if (mode != 1) {
        /* THE SURFACE and THE HELIOTRON share one slow orbit round the ring */
        float ca = cam + hand.x * hs * 0.9;
        float ch = 1.20 + 0.22 * sin(cam * 0.7) + hand.y * hs * 0.9;
        float cd = mode == 0 ? 2.55 : 2.40;
        float3 ro = float3(cos(ca) * cd, ch, sin(ca) * cd);
        float3 fw = normalize(-ro);
        float3 rt = normalize(cross(fw, float3(0.0, 1.0, 0.0)));
        float3 up = cross(rt, fw);
        float3 rd = normalize(fw * 1.75 + rt * p.x + up * p.y);
        float Rb = mode == 0 ? R0_Z + 0.52 : R0_Z + 0.42;
        float b = dot(ro, rd), c = dot(ro, ro) - Rb * Rb;
        float disc = b * b - c;
        if (disc > 0.0) {
            float sq = sqrt(disc);
            float t0 = max(-b - sq, 0.0), t1 = -b + sq;
            if (mode == 0) {
                /* THE SURFACE — the last closed flux surface, and the lines that live on it */
                float a = 0.30, e2 = 0.22, e3 = 0.09, hx = 0.10;
                float t = t0, th = 0.0, ph = 0.0, rb = 1.0, hit = 0.0;
                for (int i = 0; i < 96; i++) {
                    float3 q = ro + rd * t;
                    float s = fluxLabel_z(q, a, e2, e3, hx, th, ph, rb);
                    // the poloidal-plane distance, scaled for the shape's slope — a safe step
                    float d = (s - 1.0) * rb * 0.55;
                    if (d < 0.0012) { hit = 1.0; break; }
                    t += d;
                    if (t > t1) break;
                }
                float tHit = hit > 0.5 ? t : 1e9;
                if (hit > 0.5) {
                    float3 q = ro + rd * t;
                    float e = 0.004, t_ = 0.0, p_ = 0.0, r_ = 0.0;
                    float gx0 = fluxLabel_z(q + float3(e, 0.0, 0.0), a, e2, e3, hx, t_, p_, r_);
                    float gx1 = fluxLabel_z(q - float3(e, 0.0, 0.0), a, e2, e3, hx, t_, p_, r_);
                    float gy0 = fluxLabel_z(q + float3(0.0, e, 0.0), a, e2, e3, hx, t_, p_, r_);
                    float gy1 = fluxLabel_z(q - float3(0.0, e, 0.0), a, e2, e3, hx, t_, p_, r_);
                    float gz0 = fluxLabel_z(q + float3(0.0, 0.0, e), a, e2, e3, hx, t_, p_, r_);
                    float gz1 = fluxLabel_z(q - float3(0.0, 0.0, e), a, e2, e3, hx, t_, p_, r_);
                    float3 nrm = normalize(float3(gx0 - gx1, gy0 - gy1, gz0 - gz1));
                    float ndv = max(0.0, -dot(nrm, rd));
                    float3 L = normalize(float3(0.6, 1.0, -0.4));
                    float dif = max(0.0, dot(nrm, L));
                    float rim = pow(1.0 - ndv, 3.0);
                    // the surface: dark glass over the plasma, its colour from the chord by poloidal angle
                    col += chordRamp_z(U, 0.55 + 0.10 * cos(th)) * (0.02 + 0.06 * dif) + chordRamp_z(U, 0.85) * rim * 0.34;
                    // the plasma seen through it — the pressure lives on the axis, so the glow is
                    // deepest where the eye looks through the most of it
                    col += chordRamp_z(U, 0.15) * (0.06 + U.bass * 0.10) * (1.0 - rim);
                    // the field lines: θ − ιφ = const, one colour per closed line, and a pulse
                    // of light running along B
                    float w = (th - iota * ph) * nl / TAU_Z;
                    float u = fract(w), j = floor(w);
                    float ln = exp(-sq_z(u - 0.5) * 420.0);
                    float run = 0.55 + 0.45 * cos(ph * 9.0 - U.time * (2.2 + U.mid * 3.0));
                    col += chordRamp_z(U, fract(j / nl + 0.07)) * ln * (0.75 + 0.55 * run + beat * 0.35) * (0.35 + 0.65 * ndv + rim * 0.5);
                }
                // the comet: one field line followed, a bead of light with its trail behind it
                float th0 = (floor(varA * nl) + 0.5) * TAU_Z / nl;
                for (int k = 0; k < 16; k++) {
                    float fk = float(k);
                    float phk = trace - fk * 0.028;
                    float3 P = surfPt_z(th0 + iota * phk, phk, 1.004, a, e2, e3, hx);
                    float tp = dot(P - ro, rd);
                    float3 dP = P - (ro + rd * tp);
                    float vis = tp < tHit + 0.02 ? 1.0 : 0.15;     // round the back it only smoulders
                    float g2 = exp(-dot(dP, dP) * (1100.0 + fk * 200.0)) * (1.0 - fk / 16.0);
                    col += chordRamp_z(U, 0.85) * g2 * vis * (1.4 + beat * 1.0) * (k == 0 ? 1.8 : 1.0);
                }
            } else {
                /* THE HELIOTRON — two helical windings, and the plasma between them */
                const float MC = 10.0;            // l = 2, m = 10: LHD's numbers
                float ac = 0.31, rc = 0.040, ap = 0.175, e2 = 0.34;
                float t = t0, hitc = 0.0, thc = 0.0;
                float3 q = ro, glow = float3(0.0);
                for (int i = 0; i < 120; i++) {
                    q = ro + rd * t;
                    float R = length(q.xz), ph = atan2(q.z, q.x);
                    float2 v = float2(R - R0_Z, q.y);
                    float r = length(v), th = atan2(v.y, v.x);
                    float thc0 = MC * 0.5 * ph;     // the pair: at θ = (m/l) φ, and π on
                    // the winding leans at its pitch angle — dθ/dφ = m/l — so the distance is
                    // taken to its tangent, not to where it crosses this poloidal plane
                    float2 C0 = ac * float2(cos(thc0), sin(thc0)), D0 = v - C0, D1 = v + C0;
                    float tl0 = sqrt(sq_z(R0_Z + C0.x) + 25.0 * ac * ac), tl1 = sqrt(sq_z(R0_Z - C0.x) + 25.0 * ac * ac);
                    float2 tp0 = 5.0 * ac * float2(-C0.y, C0.x) / (ac * tl0), tp1 = -tp0 * tl0 / tl1;
                    float d0 = sqrt(max(dot(D0, D0) - sq_z(dot(D0, tp0)), 0.0)) - rc;
                    float d1 = sqrt(max(dot(D1, D1) - sq_z(dot(D1, tp1)), 0.0)) - rc;
                    float dc = min(d0, d1) * 0.7;
                    if (dc < 0.0015) { hitc = 1.0; thc = d0 < d1 ? thc0 : thc0 + PI_Z; break; }
                    // the plasma the windings hold: elliptical, pointed at the coils, turning ten times round
                    float rb = ap * (1.0 + e2 * cos(2.0 * (th - thc0)));
                    float s = r / rb;
                    float stp = clamp(dc, 0.005, 0.035);
                    if (s < 1.0) {
                        float dens = 1.0 - s * s; dens *= dens;    // the pressure profile, p ∝ (1 − s²)²
                        glow += chordRamp_z(U, 0.12 + 0.30 * s) * dens * stp * (0.9 + U.energy * 2.4 + U.bass * 1.0);
                        // field lines on the edge, ι = 1 there: eight that close in a single turn
                        float shell = exp(-sq_z((s - 0.96) * 30.0));
                        float w = (th - ph) * 8.0 / TAU_Z;
                        float ln = exp(-sq_z(fract(w) - 0.5) * 700.0);
                        float run = 0.5 + 0.5 * cos(ph * 12.0 - U.time * (2.0 + U.mid * 3.0));
                        glow += chordRamp_z(U, fract(floor(w) / 8.0 + 0.07)) * ln * shell * stp * (30.0 + 18.0 * run + beat * 12.0);
                    }
                    t += stp;
                    if (t > t1) break;
                }
                col += glow;
                if (hitc > 0.5) {
                    // the winding, lit — and its current, one pulse running the same way along both
                    float ph = atan2(q.z, q.x);
                    float2 v = float2(length(q.xz) - R0_Z, q.y);
                    float2 C = ac * float2(cos(thc), sin(thc)), D = v - C;
                    float tl = sqrt(sq_z(R0_Z + C.x) + 25.0 * ac * ac);
                    float2 tp = 5.0 * float2(-C.y, C.x) / tl;
                    float along = dot(D, tp);
                    float2 np = D - along * tp;               // the perpendicular, in the plane…
                    float nt = -along * (R0_Z + C.x) / tl;    // …and its share along the ring
                    float3 nrm = normalize(float3(np.x * cos(ph) - nt * sin(ph), np.y, np.x * sin(ph) + nt * cos(ph)));
                    float3 L = normalize(float3(0.6, 1.0, -0.4));
                    float dif = max(0.0, dot(nrm, L));
                    float ndv = max(0.0, -dot(nrm, rd));
                    float spec = pow(max(0.0, dot(reflect(rd, nrm), L)), 24.0);
                    float cur = pow(0.5 + 0.5 * cos(ph * 20.0 - U.time * (3.0 + U.bass * 4.0)), 3.0);
                    col += chordRamp_z(U, 0.85) * (0.08 + 0.30 * dif) + chordRamp_z(U, 0.70) * cur * (0.35 + U.bass * 0.5 + beat * 0.3)
                         + chordRamp_z(U, 0.85) * pow(1.0 - ndv, 3.0) * 0.22 + spec * 0.35;
                }
            }
        }
    } else {
        /* THE SECTION — the Poincaré plot at toroidal angle φ */
        float a = 0.74, e2 = 0.22, e3 = 0.09;
        float ph = phiS;
        float2 c = float2(-0.02, 0.0);
        float2 v = p - c;
        if (hs > 0.02) {
            // a hand bends the surfaces — flows
            float2 dh = v - hand;
            v -= dh * hs * 0.10 / (dot(dh, dh) + 0.15);
        }
        float r = length(v), th = atan2(v.y, v.x);
        float rb = rbnd_z(th, ph, a, e2, e3);
        float s = r / rb;
        // the Shafranov shift: pressure pushes the inner surfaces outboard, Δ ∝ β(1 − s²)
        float shift = 0.16 * a * U.energy;
        for (int it = 0; it < 2; it++) {
            float sc = clamp(s, 0.0, 1.0);
            float2 v2 = v - float2(shift * (1.0 - sc * sc), 0.0);
            r = length(v2); th = atan2(v2.y, v2.x); rb = rbnd_z(th, ph, a, e2, e3); s = r / rb;
        }
        // the dealt configuration: ι(s) = i0 + i1·s, and where it crosses n/m, an island chain
        // (m, s_r, w) — every s_r on the 0.05 contour grid so the chains join seamlessly
        float i0, i1, m0, m1, m2, n0, n1, n2, sr0, sr1, sr2, w0, w1, w2;
        if (cfg == 0) {           // STANDARD: ι 0.85 → 1.0, the 5/5 islands at the edge — the divertor
            i0 = 0.85; i1 = 0.165;
            m0 = 11.0; n0 = 10.0; sr0 = 0.35; w0 = 0.018;
            m1 = 16.0; n1 = 15.0; sr1 = 0.55; w1 = 0.011;
            m2 = 5.0;  n2 = 5.0;  sr2 = 0.90; w2 = 0.060;
        } else if (cfg == 1) {    // HIGH ι: 1.0 → 1.25, four islands at the edge
            i0 = 1.02; i1 = 0.24;
            m0 = 9.0;  n0 = 10.0; sr0 = 0.40; w0 = 0.024;
            m1 = 13.0; n1 = 15.0; sr1 = 0.55; w1 = 0.011;
            m2 = 4.0;  n2 = 5.0;  sr2 = 0.95; w2 = 0.060;
        } else {                  // LOW ι: 0.70 → 0.85, six at the edge and seven near the axis
            i0 = 0.70; i1 = 0.15;
            m0 = 7.0;  n0 = 5.0;  sr0 = 0.10; w0 = 0.030;
            m1 = 13.0; n1 = 10.0; sr1 = 0.45; w1 = 0.011;
            m2 = 6.0;  n2 = 5.0;  sr2 = 0.90; w2 = 0.050;
        }
        // the nearest chain owns this pixel; between chains every K is just (s − s_r)²,
        // so the surfaces are the same surfaces whichever side draws them
        float d0 = abs(s - sr0), d1 = abs(s - sr1), d2 = abs(s - sr2);
        float sr = sr0, m = m0, w = w0, n = n0;
        if (d1 < d0 && d1 <= d2) { sr = sr1; m = m1; w = w1; n = n1; }
        else if (d2 < d0) { sr = sr2; m = m2; w = w2; n = n2; }
        // the pendulum: K = (s − s_r)² − w² cos(mθ − nφ); separatrix at K = w², O-points at −w²
        float alpha = m * th - n * ph;
        float K = (s - sr) * (s - sr) - w * w * cos(alpha);
        float Q = max(K + w * w, 1e-7), sQ = sqrt(Q);
        float se = sr + sign(s - sr) * sQ;
        // |∇se| in world units, so every line is drawn one width whatever its slope —
        // the level sets thicken at the X-points otherwise, where ∇Q vanishes
        float gQ = sqrt(sq_z(2.0 * (s - sr) / rb) + sq_z(w * w * m * sin(alpha) / max(r, 1e-3)));
        float gse = max(gQ / (2.0 * sQ), 0.05);
        float inside = 1.0 - smoothstep(1.0, 1.04, s);
        // the nested surfaces, one every 0.05 in flux — beaded the way a Poincaré plot is
        float ds = abs(fract(se / 0.05 + 0.5) - 0.5) * 0.05 / gse;
        float bead = 0.74 + 0.26 * cos(th * 41.0 + se * 251.0);
        float ln = exp(-ds * ds * 90000.0) * bead;
        col += chordRamp_z(U, 0.08 + 0.55 * clamp(se, 0.0, 1.0)) * ln * 0.70 * inside;
        // the separatrix of every chain, brighter: the eyes, and the X-points between them
        float dsep = abs(sQ - 1.41421 * w) / gse;
        col += chordRamp_z(U, 0.85) * exp(-dsep * dsep * 90000.0) * 0.6 * inside * smoothstep(0.3, 0.6, 1.0 - abs(s - sr) / (2.5 * w + 0.02));
        // past the last closed surface, the chaotic sea: islands overlap and the line wanders
        float sea = smoothstep(0.99, 1.02, s) * (1.0 - smoothstep(1.08, 1.30, s));
        if (sea > 0.0) {
            float2 cell = float2(th / TAU_Z * 160.0 + 80.0, s * 90.0);
            float2 ci = floor(cell), cf = cell - ci;
            float hsh = hash21_z(ci + 0.37);
            float2 jit = float2(hash21_z(ci + 7.1), hash21_z(ci + 3.7));
            float2 dd = (cf - jit) * float2(rb * TAU_Z / 160.0, rb / 90.0);
            float on = step(0.45 + (s - 1.0) * 1.6, hsh);
            float tw = 0.6 + 0.4 * sin(U.time * 3.0 + hsh * 40.0);
            col += chordRamp_z(U, 0.85) * exp(-dot(dd, dd) * 250000.0) * on * sea * (0.35 + U.treble * 0.6) * tw;
        }
        // THE TRACER: one field line, followed. Each hop is a toroidal transit — a beat —
        // and the puncture lands 2πι further round; on a surface it walks the curve…
        float kk = floor(hop);
        float st = 0.60, it = i0 + i1 * st;
        for (int k = 0; k < 24; k++) {
            float fk = float(k);
            float idx = kk - fk;
            float thk = varA * TAU_Z + TAU_Z * it * idx;
            float2 P = c + float2(shift * (1.0 - st * st), 0.0) + st * rbnd_z(thk, ph, a, e2, e3) * float2(cos(thk), sin(thk));
            float g2 = exp(-dot(p - P, p - P) * 14000.0) * (1.0 - fk / 24.0) * (k == 0 ? 1.8 + beat : 1.0);
            col += chordRamp_z(U, 0.30) * g2;
        }
        // …and on the edge chain it hops island to island, librating slowly about the O-point
        for (int k = 0; k < 24; k++) {
            float fk = float(k);
            float idx = kk - fk;
            float j = fmod(idx * n2, m2);
            float chi = idx * 0.23 + varA * 6.0;
            float al = 0.74 * cos(chi);
            float ss = sr2 + 0.52 * w2 * sin(chi);
            float thk = (al + n2 * ph + TAU_Z * j) / m2;
            float2 P = c + float2(shift * (1.0 - ss * ss), 0.0) + ss * rbnd_z(thk, ph, a, e2, e3) * float2(cos(thk), sin(thk));
            float g2 = exp(-dot(p - P, p - P) * 14000.0) * (1.0 - fk / 24.0) * (k == 0 ? 1.8 + beat : 1.0);
            col += chordRamp_z(U, 0.85) * g2;
        }
        col *= 1.0 + beat * 0.12;
    }
    col += (hash21_z(pos.xy) - 0.5) * 0.006;
    return float4(govern_z(VOID_Z + max(col, float3(0.0)), U.white), 1.0);
}
