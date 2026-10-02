#version 300 es
// PROVENANCE — FILAMENTS (engine-upgrade study for the 'fractal' room; prototype, WebGL2 harness form).
//   Fold: octahedral Kaleidoscopic IFS, after Knighty ("Kaleidoscopic (escape time) IFS", fractalforums.com, 2010):
//         abs-fold, sort the axes (the octahedral reflection group), rotate, scale 2 about the vertex (1,0,0).
//   Light: orbit traps after Clifford Pickover (orbit-trap "biomorph"/epsilon-cross pictures, late 1980s) and
//         Inigo Quilez's public articles on orbit traps (iquilezles.org); emission accumulated along the sphere
//         trace (a demoscene staple); emission-absorption compositing (standard volume rendering).
//   Own derivation: after i folds the orbit point z_i = 2^i * (isometry of p), so |dist(z_i, ring)| / 2^i is an exact
//         world-space lower bound on the distance to the i-th generation of threads. It is used as the STEP BOUND,
//         so the march is dense exactly where the light threads are and sparse in the void: the Lorentzian line
//         profile is sampled at >= 1.6 samples per core width with no global step cap. No hard surface is drawn.
//   Written from the math above; no code copied from any source.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);

// Three folds of the KIFS fused with a ring orbit trap.
// Out: dT = world distance to the nearest thread (the step bound);
//      S.rgb = chord-coloured Lorentzian line emission density at p, S.a = the same density uncoloured (for absorption).
// Generations: uColA = parent rings, uColB = children, uColC = grandchildren.
void threads(vec3 p, out float dT, out vec4 S){
  S = vec4(0.0); dT = 1e9;
  float R = 0.5*(1.0 + 0.15*uBass + 0.03*uBeat);                // bass swells the rings; the beat breathes them 3%
  const float TF = 0.011; const float F2 = TF*TF;                // line core half-width (world): ~1 px at the subject
  const float SC = 2.6; vec3 z = p*(1.0/SC); float sc = SC;     // sc: world size of one orbit-space unit
  float an = 0.22 + 0.06*uMid + 0.04*sin(0.07*uTime);           // mid twists the fold
  float ca = cos(an), sa = sin(an);
  for (int i = 0; i < 3; i++){
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    if (z.x < z.z) z.xz = z.zx;
    if (z.y < z.z) z.yz = z.zy;
    float dq = length(vec2(length(z.xy) - R, z.z))*sc;          // ring about the smallest axis, in world units
    dT = min(dT, dq);
    float w = i == 0 ? 1.0 : (i == 1 ? 0.8 : 0.36 + 0.14*uEnergy); // energy lights the finest generation
    vec3 cc = i == 0 ? uColA : (i == 1 ? uColB : uColC);
    // treble: pulses running along every thread at a constant speed; treble sets only their contrast.
    // y/(x+y) is a cheap monotonic proxy for the ring angle inside the sorted wedge x>=y>=0 (continuous across folds).
    float bead = 1.0 - (0.15 + 0.5*uTreb)*(0.5 + 0.5*cos(14.0*z.y/(z.x + z.y + 1e-4) - 1.6*uTime + 2.1*float(i)));
    float g = w*bead*F2/(dq*dq + F2);
    S += vec4(cc*g, g);
    z.xy = vec2(ca*z.x - sa*z.y, sa*z.x + ca*z.y);
    z = 2.0*z - vec3(1.0, 0.0, 0.0);
    sc *= 0.5;
  }
}

vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }
float hash12(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float a = 0.15*uTime; vec3 ro = vec3(4.4*sin(a), 1.41, 4.4*cos(a));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + uv.x*rt*0.9 + uv.y*up*0.9);
  float tb = 0.35*sin(0.05*uTime) + 0.3; float ct = cos(tb), st = sin(tb);   // slow tumble: the axis never parks
  ro.yz = vec2(ct*ro.y - st*ro.z, st*ro.y + ct*ro.z); rd.yz = vec2(ct*rd.y - st*rd.z, st*rd.y + ct*rd.z);
  float b = dot(ro, rd), c = dot(ro, ro) - 9.0, h = b*b - c;     // bound sphere r = 3 holds all three generations
  vec3 col = VOID;
  if (h > 0.0){
    float t0 = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h), tc = length(ro);
    const float FL = 0.0066;                                       // step floor = 0.6 core widths
    float t = t0 + FL*hash12(gl_FragCoord.xy);                     // per-pixel jitter hides the sampling lattice
    vec3 em = vec3(0.0); float dT; vec4 S; float T = 1.0;          // T: transmittance (emission-absorption)
    float gain = 15.0 + 4.0*uEnergy;                               // energy: overall thread luminance
    for (int i = 0; i < 128; i++){
      vec3 p = ro + rd*t;
      threads(p, dT, S);
      float L = max(dT, FL);
      em += T*S.rgb*(L*gain*exp(-0.45*max(t - tc + 1.0, 0.0)));   // depth fades light toward the void
      T *= 1.0/(1.0 + 8.0*S.a*L);                                  // near threads veil the ones behind them
      t += L;
      if (t > t1) break;
    }
    col = VOID + em;
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
