#version 300 es
// LACE — a lace ball: rings cut from a flowing Apollonian sphere packing by two slicing spheres,
// around a luminous Soddy core.
// PROVENANCE: the Apollonian (Soddy) sphere packing is classical (Descartes/Soddy: five mutually tangent
// spheres; the packing is the orbit of that configuration under inversion in the five "dual" spheres, each
// orthogonal to four of the five). Public write-ups of inversion-iterated Apollonian fractals: Paul Bourke
// (paulbourke.net, Apollonian gasket / sphere packing pages) and Inigo Quilez (iquilezles.org, Apollonian
// fractal / sphere inversion articles); sphere-inversion clusters: Tom Lowe "TGlad", fractalforums.org, 2020.
// Everything here is derived and written from scratch for this prototype: the tetrahedral Soddy configuration
// in the unit ball (big balls d = 1/(1+sqrt(2/3)) from the centre, radius 1-d; central dual radius^2 = d^2-r^2;
// outer duals centred at -3v with radius sqrt(8)), the fold-into-a-ball loop with min-over-frames sphere
// distance, the hyperbolic flow (inversion in a sphere orthogonal to the ball, then a mirror), and the ring
// tube distance that carries the slicing-sphere normals through every inversion (inversions keep angles).
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);
const float RHO0SQ = 0.1010205;   // central dual sphere radius^2
const float CI = 0.3178372;       // big ball centre = CI * V_i (unnormalised V)
const float RI = 0.4494897;       // big ball radius
const float S3 = 1.7320508, IS3 = 0.5773503;
const vec3 V1 = vec3( 1., 1., 1.), V2 = vec3( 1.,-1.,-1.), V3 = vec3(-1., 1.,-1.), V4 = vec3(-1.,-1., 1.);

vec3 gU, gFC, gCore; float gFR2, gTh, gR1, gR2, gLcut;   // per-frame constants
float gJ, gLayer;                                          // outputs of the last DE call

// distance to the line where two locally-planar surfaces cross (signed distances a,b; normal cosine c)
float xline(float a, float b, float c){ return sqrt(max(a*a + b*b - 2.0*c*a*b, 0.0)/max(1.0 - c*c, 0.03)); }

float DE(vec3 p0){
  // slicing spheres (render space): outer globe about the origin, inner globe about the core
  float l1 = max(length(p0), 1e-4); vec3 n1 = p0/l1; float s1 = l1 - gR1;
  vec3 w2 = p0 - gCore; float l2 = max(length(w2), 1e-4); vec3 n2 = w2/l2; float s2 = l2 - gR2;
  // flow: inversion in a sphere orthogonal to the unit ball, then a mirror -> hyperbolic translation
  vec3 w = p0 - gFC; float wl2 = dot(w,w); float J = gFR2/wl2; vec3 wh = w*inversesqrt(wl2);
  vec3 p = gFC + w*J;
  n1 -= 2.0*dot(n1,wh)*wh; n2 -= 2.0*dot(n2,wh)*wh;
  p -= 2.0*dot(p,gU)*gU; n1 -= 2.0*dot(n1,gU)*gU; n2 -= 2.0*dot(n2,gU)*gU;
  float best = 1e9; gJ = J; gLayer = 0.0;
  for (int i = 0; i < 12; i++){
    float r2 = dot(p,p), rr = sqrt(r2);
    vec4 dv = vec4(dot(p,V1), dot(p,V2), dot(p,V3), dot(p,V4))*IS3;
    float mx = max(max(dv.x, dv.y), max(dv.z, dv.w));
    vec3 wi = p - CI*((mx == dv.x) ? V1 : (mx == dv.y) ? V2 : (mx == dv.z) ? V3 : V4);
    float li = length(wi);
    // nearest sphere of this frame (bounding sphere or a big ball), in render units
    bool useB = abs(rr - 1.0) < abs(li - RI);
    vec3 nb = useB ? p/rr : wi/li;
    float sd = (useB ? rr - 1.0 : li - RI)/J;
    float rad = useB ? 1.0 : RI;
    float fd = 1.0 - smoothstep(0.8, gLcut, log2(J));
    float rs = rad/J;                                // ball radius in render units: bigger rings, bolder thread
    float th = min(gTh*(0.55 + 0.45*smoothstep(0.03, 0.3, rs)), 0.22*rs)*fd;
    float q1 = xline(sd, s1, dot(nb, n1)), q2 = xline(sd, s2, dot(nb, n2));
    float cand = min(q1, q2) - th;
    if (cand < best){ best = cand; gJ = J; gLayer = q1 < q2 ? 0.0 : 1.0; }
    if (r2 > 1.0 || li < RI || J > 14.0) break;     // landed in a ball, or deeper rings are too small
    vec3 c = vec3(0.0); float R2 = RHO0SQ;         // in a gap: fold through the dual sphere holding p
    if (r2 >= RHO0SQ){
      float m = min(min(dv.x, dv.y), min(dv.z, dv.w));
      c = -S3*((m == dv.x) ? V1 : (m == dv.y) ? V2 : (m == dv.z) ? V3 : V4); R2 = 8.0;
    }
    vec3 v = p - c; float vl2 = dot(v,v); float k = R2/vl2; vec3 vh = v*inversesqrt(vl2);
    n1 -= 2.0*dot(n1,vh)*vh; n2 -= 2.0*dot(n2,vh)*vh;
    p = c + v*k; J *= k;
  }
  return best;
}

vec3 ramp(float x){ x = fract(x)*3.0;
  return x < 1.0 ? mix(uColA, uColB, smoothstep(0.0,1.0,x)) : x < 2.0 ? mix(uColB, uColC, smoothstep(0.0,1.0,x-1.0)) : mix(uColC, uColA, smoothstep(0.0,1.0,x-2.0)); }

vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float a = 0.11*uTime; vec3 ro = vec3(2.9*sin(a), 0.8 + 0.25*sin(0.07*uTime), 2.9*cos(a));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0,1,0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + uv.x*rt*0.9 + uv.y*up*0.9);
  // musical answers
  float ph = 0.23*uTime;
  gU = normalize(vec3(sin(ph), 0.5*sin(0.7*ph + 1.0), cos(ph)));
  float eps = 0.07 + 0.20*uBass;               // bass -> hyperbolic flow: the packing swells toward gU
  float L = 1.0/eps; gFC = gU*L; gFR2 = L*L - 1.0;
  gCore = gU*eps;                              // where the Soddy core sits after the flow
  gTh = 0.0085*(1.0 + 0.05*uBeat);            // beat -> thread breath
  gR1 = 0.90 + 0.05*uMid;                      // mid  -> outer slicing sphere re-tiles the lace
  gR2 = 0.36;
  gLcut = 3.0 + 1.0*uTreb;                     // treble -> finer rings revealed
  vec3 col = VOID;
  float b = dot(ro, rd), c = dot(ro,ro) - 1.0, h = b*b - c;
  float tHit = 1e9;
  if (h > 0.0){
    float t = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h); bool hit = false;
    float hmin = 1e9, hJ = 1.0, hL = 0.0, ht = t;
    for (int i = 0; i < 128; i++){
      float d = DE(ro + rd*t);
      if (d < 0.0008*t){ hit = true; break; }
      if (d/t < hmin){ hmin = d/t; hJ = gJ; hL = gLayer; ht = t; }
      t += d*0.75; if (t > t1) break;
    }
    // soft glow hugging the threads (angular distance, so it stays a few pixels wide at any depth)
    float hg = exp(-hmin*420.0)*(1.0 - smoothstep(0.8, gLcut, log2(hJ)))*clamp(1.3 - 0.45*(ht + b), 0.35, 1.0);
    col += ramp(0.14*log2(hJ) + 0.45*hL + 0.25*uMid)*hg*(0.2 + 0.14*uEnergy);
    if (hit){
      tHit = t;
      vec3 p = ro + rd*t; float J = gJ, lay = gLayer;
      vec2 e = vec2(0.0008*t, -0.0008*t);
      vec3 n = normalize(e.xyy*DE(p+e.xyy) + e.yyx*DE(p+e.yyx) + e.yxy*DE(p+e.yxy) + e.xxx*DE(p+e.xxx));
      float dep = log2(J);
      vec3 base = ramp(0.14*dep + 0.45*lay + 0.25*uMid);
      vec3 Lk = normalize(vec3(0.5, 0.8, 0.3));
      float dif = max(dot(n, Lk), 0.0);
      float fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      float sp = pow(max(dot(reflect(rd, n), Lk), 0.0), 24.0);
      vec3 lc = gCore - p; float dc2 = dot(lc,lc); lc *= inversesqrt(dc2);
      float cl = max(dot(n, lc), 0.0)/(1.0 + 6.0*dc2);          // light thrown by the core
      float fade = 1.0 - smoothstep(0.8, gLcut, dep);
      float back = clamp(1.3 - 0.45*(t + b), 0.35, 1.0);
      vec3 lit = base*(0.46 + 0.6*dif) + uColC*fr*0.35 + mix(uColA, uColC, 0.3)*cl*(0.9 + 1.2*uEnergy);
      col = VOID + lit*fade*back*(0.85 + 0.3*uEnergy) + vec3(0.22)*sp*fade*back;
    }
    // luminous core: analytic glow around the Soddy centre, seen through the holes of the lace
    vec3 oc = gCore - ro; float tc = dot(oc, rd); float dd = length(oc - rd*tc);
    float g = (0.12*exp(-dd*dd*18.0) + 0.6*exp(-dd*dd*350.0))*(0.75 + 0.8*uEnergy)*(1.0 + 0.06*uBeat);
    float occl = tHit < tc ? 0.0 : 1.0;
    col += mix(uColA, uColC, 0.35)*g*occl*smoothstep(1.0, 0.6, dd);
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
