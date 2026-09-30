#include <metal_stdlib>
using namespace metal;

/* ================================================================
   ROOMS, WAVE 22 — THE BALL PIT: BALLPIT.

   A ball pit is what happens when balls collide with the walls and
   never with each other — each one an honest projectile: a parabola
   under gravity, a fold off the side walls, a geometric ladder of
   ever-smaller bounces off the floor (restitution e: each rebound e
   times the last, so the whole descent to rest takes the finite
   time 2ue/g(1−e)), and a slide into the nearest hollow of the
   pile. The pile IS the floor: every ball that comes to rest raises
   the level the next one lands on, and the settled balls pack into
   the hex lattice a real pit settles into. At the brim it holds,
   the floor opens, the pile drops out, and the pouring begins
   again. THE HOPPER pours from a slit at the top; THE FOUNTAIN is a
   spring in the floor of the pit itself, its balls flung up through
   the pile and back down onto it, higher as it fills, until they
   ring off the ceiling; THE CANNON fires from the top corner,
   sweeping its aim, its balls ricocheting the whole box before they
   settle.

   Stateless, as every room is: the web integrates its pit; the TV
   retells it closed-form and exactly. Ball i is born at i/rate and
   is a projectile for D seconds — its ceiling met at most once, its
   floor the row of the pile it will join, its bounces the geometric
   ladder inverted with one logarithm, its x a fold of the roll the
   floor's friction shortens — then slides into cell i of the lattice,
   the rows filled bottom-up and from the centre out. The lattice is
   O(1) a pixel; the projectiles are the last forty poured. The pile
   jumps on the beat, the bass warms the glow. The ghost's hand is a
   cushion, drawn where it rests.

   Laws as ever: void ground, chord-only colour, govern_l() at every
   exit, roll0..2 the dice, every loop bounded by a compile-time
   literal (<= 48 here). All symbols wear _l — a self-contained
   translation unit.
   ================================================================ */

constant float PI_L  = 3.14159265359;
constant float3 VOID_L = float3(0.019608, 0.023529, 0.054902);

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

inline float3 govern_l(float3 c, float white) {
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
inline float sq_l(float x) { return x * x; }
inline float hash21_l(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123); }
inline float2 centeredUp_l(float2 pix, float2 res, float aspect) {
    float2 r = max(res, float2(1.0));
    float2 p = pix / r * 2.0 - 1.0;
    p.x *= max(aspect, 1e-4);
    p.y = -p.y;
    return p;
}
inline float2 ghostUp_l(constant VizUniforms& U) {
    return float2(U.ghostX * max(U.aspect, 1e-4), -U.ghostY);
}
inline float3 chordRamp_l(constant VizUniforms& U, float t) {
    float x = fract(t) * 3.0;
    if (x < 1.0) return mix(U.colA.rgb, U.colB.rgb, x);
    if (x < 2.0) return mix(U.colB.rgb, U.colC.rgb, x - 1.0);
    return mix(U.colC.rgb, U.colA.rgb, x - 2.0);
}
/* ball i's own colour: a point on the chord by the golden angle, some balls paler,
   some deeper — no two neighbours alike, and never a hue the chord does not hold */
inline float3 ballHue_l(constant VizUniforms& U, float i, float varA) {
    float hb = hash21_l(float2(i * 1.7 + 0.3, varA * 3.0 + 1.0));
    float hp = hash21_l(float2(varA * 9.0 + 2.0, i * 0.9 + 0.6));
    return mix(chordRamp_l(U, fract(i * 0.381966 + varA)), float3(1.0), 0.30 * hp * hp) * (0.75 + 0.5 * hb);
}
inline float segd_l(float2 p, float2 a, float2 b) {
    float2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
/* a ball bouncing between two elastic walls is a triangle wave of the distance
   it has rolled — exact; mod is the floor kind */
inline float fold_l(float x0, float s, float a, float b) {
    float L = max(b - a, 1e-4);
    float u = x0 + s - a;
    u = u - floor(u / (2.0 * L)) * (2.0 * L);
    return u < L ? a + u : b - (u - L);
}
/* the ball: a lit sphere and its halo — the bass warms it, an impact flashes it */
inline void disc_l(float2 p, float2 c, float r, float hit, float3 hue, float bass, float treble, thread float3& col) {
    float2 d = p - c;
    float len = length(d), q = len / r;
    if (q > 1.7) return;
    col += hue * exp(-sq_l(q - 1.0) * 14.0) * (0.10 + bass * 0.18 + hit * 0.9) * step(1.0, q);
    if (q < 1.02) {
        float3 n = float3(d / r, sqrt(max(1.0 - q * q, 0.0)));
        float3 L = normalize(float3(-0.45, 0.62, 0.64));
        float dif = max(0.0, dot(n, L));
        float spec = pow(max(0.0, dot(reflect(-L, n), float3(0.0, 0.0, 1.0))), 40.0);
        float edge = smoothstep(1.0, 0.94, q);
        float3 body = hue * (0.20 + 0.80 * dif) + spec * (0.45 + treble * 0.3) + hue * hit * 0.6;
        col = mix(col, body, edge);
    }
}
/* THE HOLLOWS FILL FROM THE CENTRE OUT — a ball landing near the middle rolls
   to the nearest empty hollow. rankOut says which turn a column takes; colOfRank
   is its inverse, the column a ball of that turn takes. */
inline float rankOut_l(float k, float cnt) {
    float d = k - (cnt - 1.0) * 0.5;
    float a = abs(d);
    if (fmod(cnt, 2.0) < 0.5) return 2.0 * (a - 0.5) + (d > 0.0 ? 1.0 : 0.0);
    return a < 0.5 ? 0.0 : 2.0 * a - (d < 0.0 ? 1.0 : 0.0);
}
inline float colOfRank_l(float rk, float cnt) {
    float c = (cnt - 1.0) * 0.5;
    if (fmod(cnt, 2.0) < 0.5) {
        float m = floor(rk * 0.5);
        float side = (rk - 2.0 * m) > 0.5 ? 1.0 : -1.0;
        return c + side * (m + 0.5);
    }
    if (rk < 0.5) return c;
    float m = ceil(rk * 0.5);
    return c + (fmod(rk, 2.0) > 0.5 ? -m : m);
}
/* ONE BALL'S FLIGHT, EXACT. Born at (x0, y0) with (vx0, vy0); the ceiling met
   at most once (restitution ew); the floor — its own row of the pile — met at
   tf with speed u, and then the geometric ladder: rebound k leaves the floor at
   u·ef^k, flies 2u·ef^k/g, so the k-th landing is at S_k = (2u/g)·ef(1−ef^k)/(1−ef)
   and the ladder is inverted with one logarithm. The roll along x is a fold of
   the distance rolled, each floor bounce shortening it by the friction fr.
   Returns (x, y, the impact flash). */
inline float3 flight_l(float tau, float x0, float y0, float vx0, float vy0, float floorC,
                       float W, float H, float r, float g, float ef, float ew, float fr) {
    float yc = H - r;
    float t0 = 0.0, y1 = y0, vy1 = vy0, hit = 0.0;
    if (vy0 > 0.0 && y0 + vy0 * vy0 / (2.0 * g) > yc) {
        float tc = (vy0 - sqrt(max(vy0 * vy0 - 2.0 * g * (yc - y0), 0.0))) / g;
        t0 = tc; y1 = yc; vy1 = -(vy0 - g * tc) * ew;
        hit = max(hit, exp(-sq_l(tau - tc) * 40.0) * step(tc, tau));
    }
    float u = sqrt(max(vy1 * vy1 + 2.0 * g * (y1 - floorC), 0.0));
    float tf = t0 + (vy1 + u) / g;
    float y, sx, moving = 1.0;
    if (tau < t0) { y = y0 + vy0 * tau - 0.5 * g * tau * tau; sx = vx0 * tau; }
    else if (tau < tf) { float tl = tau - t0; y = y1 + vy1 * tl - 0.5 * g * tl * tl; sx = vx0 * tau; }
    else {
        float s = tau - tf, A = 2.0 * u / g, q = fr * ef;
        float arg = 1.0 - s * (1.0 - ef) / max(A * ef, 1e-6);
        // at rest: the ladder climbed, the roll spent
        y = floorC; sx = vx0 * (tf + A * q / (1.0 - q)); moving = 0.0;
        if (arg > 0.0 && u * ef > 0.12) {
            float k = floor(log(arg) / log(ef));
            float Sk = A * ef * (1.0 - pow(ef, k)) / (1.0 - ef);
            float tl = s - Sk;
            float vk = u * pow(ef, k + 1.0);
            if (vk > 0.12) {
                y = floorC + vk * tl - 0.5 * g * tl * tl;
                sx = vx0 * (tf + A * q * (1.0 - pow(q, k)) / (1.0 - q) + pow(fr, k + 1.0) * tl);
                hit = max(hit, exp(-tl * tl * 40.0));
                moving = 1.0;
            }
        }
        hit = max(hit, exp(-s * s * 40.0));
    }
    float x = fold_l(x0, sx, -W + r, W - r);
    float wx = min(x - (-W + r), (W - r) - x);
    hit = max(hit, exp(-sq_l(wx) * 900.0) * moving * step(0.02, abs(vx0)));
    return float3(x, max(y, floorC), hit);
}


// ===============================================================
// BALLPIT — the hopper, the fountain, the cannon; filled to the brim.
// ===============================================================
fragment float4 room_ballpit(float4 pos [[position]],
                             constant VizUniforms& U [[buffer(0)]],
                             constant float2& res [[buffer(1)]],
                             texture2d<float, access::read> spectrum [[texture(0)]],
                             texture2d<float, access::read> waveform [[texture(1)]])
{
    float2 p = centeredUp_l(pos.xy, res, U.aspect);
    float2 hand = ghostUp_l(U);
    float hs = clamp(U.ghostStrength, 0.0, 1.0);
    int mode = int(clamp(U.roll0 * 3.0, 0.0, 2.999));
    int deal = int(clamp(U.roll1 * 3.0, 0.0, 2.999));
    float r = deal == 0 ? 0.034 : (deal == 1 ? 0.042 : 0.052);
    float varA = fract(U.roll2 * 7.31 + U.roll1 * 3.17);
    float beat = U.onsetEnv;
    float W = max(0.6, U.aspect - 0.08), H = 0.92;

    // THE LATTICE: pitch 2r, rows 2r·√3/2 apart, alternate rows a ball narrower
    float rowH = r * 1.7320508;
    float C = max(2.0, floor(W / r));
    float full = max(2.0, floor((2.0 * H - 3.2 * r) / rowH) + 1.0);
    float perPair = 2.0 * C - 1.0;
    float capN = floor(full * 0.5) * perPair + (fmod(full, 2.0) > 0.5 ? C : 0.0);

    // THE FACES: gravity, the floor's restitution, the ceiling's, the friction, the flight
    float g  = mode == 0 ? 2.4  : (mode == 1 ? 3.0  : 1.5);
    float ef = mode == 0 ? 0.50 : (mode == 1 ? 0.45 : 0.60);
    float ew = mode == 0 ? 0.72 : (mode == 1 ? 0.75 : 0.88);
    float fr = mode == 0 ? 0.85 : (mode == 1 ? 0.80 : 0.90);
    float D  = mode == 0 ? 1.8  : (mode == 1 ? 2.0  : 2.4);
    // the pour: small balls pour faster, a wide wall too; never more than forty in the air
    float rate = min(12.0 * sq_l(0.042 / r) * (W / 1.7), 40.0 / D);

    // THE CYCLE: pour, hold at the brim, open the floor — and pour again
    float T = U.time * 0.8;
    float Tfill = capN / rate + D, HOLD = 3.0, Tdrain = 3.2;
    float P = Tfill + HOLD + Tdrain;
    float ph = fmod(T + Tfill * 0.3, P);
    float nEmit = min(capN, floor(ph * rate));
    float nSet = clamp(floor((ph - D) * rate), 0.0, capN);
    bool drain = ph >= Tfill + HOLD;
    bool hold = !drain && nSet >= capN;
    float tD = ph - (Tfill + HOLD);
    // the row being filled: the row of the next cell — the floor the next ball lands on
    float pairN = floor(nSet / perPair), remN = nSet - pairN * perPair;
    float R = 2.0 * pairN + (remN >= C ? 1.0 : 0.0);
    float floorNow = -H + r + min(R, full) * rowH;

    float3 col = float3(0.0);
    // the box: the walls that give every bounce back
    float edge = abs(max(abs(p.x) - W, abs(p.y) - H));
    col += chordRamp_l(U, 0.55) * exp(-edge * edge * 30000.0) * 0.10;
    // the pit's surface, faint: the level the next ball comes to rest at
    float sf = p.y - (floorNow - r);
    col += chordRamp_l(U, 0.35) * exp(-sf * sf * 60000.0) * step(abs(p.x), W) * 0.05 * (drain ? 0.0 : (hold ? 0.5 : 1.0));

    // the nozzle: the slit of light the balls are born from
    float2 nz; float aimNow = 0.0;
    if (mode == 0) nz = float2(0.0, H - 0.06);
    else if (mode == 1) nz = float2(0.0, floorNow);
    else { nz = float2(-W + 0.10, H - 0.10); aimNow = -0.25 - 0.55 * (0.5 + 0.5 * sin(ph * 0.7)); }
    if (!hold && !drain) {
        float dn = mode == 2 ? segd_l(p, nz - float2(cos(aimNow), sin(aimNow)) * 0.10, nz + float2(cos(aimNow), sin(aimNow)) * 0.05)
                             : length(p - nz);
        col += chordRamp_l(U, 0.85) * exp(-dn * dn * 900.0) * (0.25 + beat * 0.35);
        col += chordRamp_l(U, 0.85) * exp(-dn * dn * 60.0) * 0.06;
    }

    // THE PILE — the hex lattice of the settled, O(1) a pixel: the nearest cell
    // of the three rows the pixel could belong to; the pile jumps on the beat
    float jump = beat * 0.012 * (hold ? 2.0 : 1.0);
    if (!drain) {
        int rc = int(floor((p.y + H - r) / rowH + 0.5));
        for (int dr = -1; dr <= 1; dr++) {
            float rw = float(rc + dr);
            if (rw < 0.0 || rw >= full) continue;
            float odd = fmod(rw, 2.0) > 0.5 ? 1.0 : 0.0;
            float cnt = odd > 0.5 ? C - 1.0 : C;
            float k = clamp(floor(p.x / (2.0 * r) + (cnt - 1.0) * 0.5 + 0.5), 0.0, cnt - 1.0);
            float idx = floor(rw * 0.5) * perPair + odd * C + rankOut_l(k, cnt);
            if (idx >= nSet) continue;
            float lift = jump * (0.4 + 0.6 * fract(rw * 0.37 + idx * 0.71));
            float2 c = float2((k - (cnt - 1.0) * 0.5) * 2.0 * r, -H + r + rw * rowH + lift);
            disc_l(p, c, r, 0.0, ballHue_l(U, idx, varA), U.bass, U.treble, col);
        }
    } else {
        // THE FLOOR OPENS: the pile drops out, the bottom rows first
        for (int rr = 0; rr < 48; rr++) {
            float rw = float(rr);
            if (rw >= full) break;
            float td = max(tD - rw * 0.05, 0.0);
            float cy = -H + r + rw * rowH - 1.5 * td * td;
            if (abs(p.y - cy) > r * 1.7) continue;
            float odd = fmod(rw, 2.0) > 0.5 ? 1.0 : 0.0;
            float cnt = odd > 0.5 ? C - 1.0 : C;
            float k = clamp(floor(p.x / (2.0 * r) + (cnt - 1.0) * 0.5 + 0.5), 0.0, cnt - 1.0);
            float idx = floor(rw * 0.5) * perPair + odd * C + rankOut_l(k, cnt);
            if (idx >= capN) continue;
            float2 c = float2((k - (cnt - 1.0) * 0.5) * 2.0 * r, cy);
            disc_l(p, c, r, 0.0, ballHue_l(U, idx, varA), U.bass, U.treble, col);
        }
    }

    // IN THE AIR — the last balls poured, each an exact projectile, each sliding
    // into its own hollow as its flight ends
    for (int j = 0; j < 40; j++) {
        float i = nEmit - 1.0 - float(j);
        if (i < nSet || i < 0.0) break;
        float tau = ph - i / rate;
        float h1 = hash21_l(float2(i * 3.7 + 1.3, varA * 11.0));
        float h2 = hash21_l(float2(i * 5.1 + 2.9, varA * 7.0 + 3.0));
        float h3 = hash21_l(float2(varA * 5.0 + 0.7, i * 2.3));
        // its own cell: the row it lands on, the hollow it slides into
        float pair = floor(i / perPair), rem = i - pair * perPair;
        float odd = rem >= C ? 1.0 : 0.0;
        float row = 2.0 * pair + odd;
        float cnt = odd > 0.5 ? C - 1.0 : C;
        float k = colOfRank_l(odd > 0.5 ? rem - C : rem, cnt);
        float floorC = -H + r + row * rowH;
        float2 slot = float2((k - (cnt - 1.0) * 0.5) * 2.0 * r, floorC);
        float x0, y0, vx0, vy0;
        if (mode == 0) {
            x0 = (h1 - 0.5) * 0.06; y0 = H - 0.06;
            vx0 = (h2 - 0.5) * 0.8; vy0 = -(0.2 + 0.5 * h3);
        } else if (mode == 1) {
            x0 = (h1 - 0.5) * 0.05; y0 = floorC + 0.5 * r;
            float a = PI_L * 0.5 + (h2 - 0.5) * 1.1, sp = 2.0 + 0.7 * h3;
            vx0 = cos(a) * sp; vy0 = sin(a) * sp;
        } else {
            x0 = -W + 0.10; y0 = H - 0.10;
            float ti = i / rate;
            float a = -0.25 - 0.55 * (0.5 + 0.5 * sin(ti * 0.7)) + (h2 - 0.5) * 0.06, sp = 2.3 + 0.4 * h3;
            vx0 = cos(a) * sp; vy0 = sin(a) * sp;
        }
        float3 fl = flight_l(tau, x0, y0, vx0, vy0, floorC, W, H, r, g, ef, ew, fr);
        float e = smoothstep(D - 0.35, D, tau);
        float2 c = mix(fl.xy, slot, e);
        if (length(p - c) > r * 1.7) continue;
        disc_l(p, c, r, fl.z * (1.0 - e) + (tau < 0.15 ? 0.5 : 0.0), ballHue_l(U, i, varA), U.bass, U.treble, col);
    }

    // the ghost's hand: a cushion, drawn where it rests
    if (hs > 0.05) {
        float dh = abs(length(p - hand) - 0.16);
        col += chordRamp_l(U, 0.85) * exp(-dh * dh * 3000.0) * hs * 0.5;
    }
    col += (hash21_l(pos.xy) - 0.5) * 0.006;
    return float4(govern_l(VOID_L + max(col, float3(0.0)), U.white), 1.0);
}
