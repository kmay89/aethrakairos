#version 300 es
// PLOTTER -- pen-plotter line art on a fractal surface. No surface shading: only thin anti-aliased pen lines on void.
// PROVENANCE: line vocabulary after Michael Fogleman's "ln" (github.com/fogleman/ln, MIT): vector texturing by
// planar slices, outlines and hidden-line removal -- the idea only, no code. Fractal: a kaleidoscopic IFS after
// Knighty ("Kaleidoscopic (escape time) IFS", fractalforums.com, 2010) -- rotate, fold into the fundamental domain of
// the tetrahedral reflection group, scale about a vertex -- in which every level contributes a sphere (the recursive
// "sphereflake" idea of Eric Haines, 1987), the levels joined by Inigo Quilez's polynomial smooth-min
// (iquilezles.org, "smooth minimum"). Sphere tracing after John C. Hart (1996). Line anti-aliasing from ray
// differentials (Homan Igehy, 1999) on the tangent plane at the hit. All code here is my own derivation.
//
// Lines: (1) oblique planar section slices f = dot(p,n)/s, n slowly turning and never axis-aligned; every 4th slice
// is an index line; the slice index picks one of three pens (chord colours A, B, C). (2) silhouette + occlusion
// contours from the march's local minima of d/t. (3) light-gated hatch (scratchboard logic: white-on-black lines
// appear where light falls). Hidden-line removal is free: every field is evaluated at the first hit only.
// Music: bass -> slices sweep along their normal; treble -> hatch revealed; energy -> pen pressure (ink + outline
// weight); mids -> the spiral winds tighter; beat -> ~1% breath of the IFS scale.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);

const float RAD = 0.5;     // sphere radius at level 0 (each level is 1/scale of its parent)
const float SMK = 0.06;    // smooth-union radius, scaled per level
const float S1 = 0.025;    // slice spacing (world); index line every 4
const float S2 = 0.045;    // hatch spacing (world)
const float CAMR = 2.3;
const float FOV = 0.85;

mat3 gRot; float gScale;

mat3 rotAxis(vec3 a, float ang){ a = normalize(a); float s = sin(ang), c = cos(ang), oc = 1.0 - c;
  return mat3(oc*a.x*a.x + c,     oc*a.x*a.y + a.z*s, oc*a.z*a.x - a.y*s,
              oc*a.x*a.y - a.z*s, oc*a.y*a.y + c,     oc*a.y*a.z + a.x*s,
              oc*a.z*a.x + a.y*s, oc*a.y*a.z - a.x*s, oc*a.z*a.z + c); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }

// tetrahedral sphere-flake KIFS: 5 levels, 4 children per sphere, a rotation before every fold makes it a spiral shell
float DE(vec3 p){
  vec3 z = p; float dr = 1.0; float d = 1e9;
  const vec3 OFF = vec3(0.57735027);
  for (int i = 0; i < 5; i++){
    d = smin(d, (length(z) - RAD)/dr, SMK/dr);
    z = gRot*z;
    if (z.x + z.y < 0.0) z.xy = -z.yx;
    if (z.x + z.z < 0.0) z.xz = -z.zx;
    if (z.y + z.z < 0.0) z.zy = -z.yz;
    z = z*gScale - OFF*(gScale - 1.0);
    dr *= gScale;
  }
  return d;
}
vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }

// three-pen plotter: pen k cycles A, B, C (pure chord colours, never a grey midpoint)
vec3 pen(float k){ float m = k - 3.0*floor(k/3.0); return m < 0.5 ? uColA : (m < 1.5 ? uColB : uColC); }

// coverage of the nearest level line of f; fw = field units per pixel; constant half-width in px; box-filtered edge
float lineAA(float f, float fw, float halfPx){
  float d = abs(fract(f + 0.5) - 0.5)/fw;
  return clamp(halfPx + 0.5 - d, 0.0, 1.0);
}
// per-pixel footprint of a linear field with world gradient g, on the tangent plane (N) at ray distance t:
// one pixel step dx/dy of the ray direction moves the hit by t*(dx - rd*(dx.N)/(rd.N)); |rd.N| clamped at 0.2
float footprint(vec3 g, vec3 N, vec3 rd, vec3 dx, vec3 dy, float t){
  float nd = dot(rd, N); nd = (nd < 0.0 ? -1.0 : 1.0)*max(abs(nd), 0.2);
  vec3 px = t*(dx - rd*dot(dx, N)/nd), py = t*(dy - rd*dot(dy, N)/nd);
  float a = dot(g, px), b = dot(g, py);
  return sqrt(a*a + b*b) + 1e-6;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  gScale = 2.15 + 0.025*uBeat;                                  // beat: a ~1% breath of the whole hierarchy
  gRot = rotAxis(vec3(0.3, 1.0, 0.2), 0.45 + 0.06*uMid);        // mids: the spiral winds a little tighter

  float a = 0.11*uTime + 0.6;
  vec3 ro = vec3(CAMR*sin(a), CAMR*(0.42 + 0.22*sin(0.083*uTime + 1.3)), CAMR*cos(a));
  vec3 fwd = normalize(-ro), rt = normalize(cross(fwd, vec3(0,1,0))), up = cross(rt, fwd);
  float pxA = FOV/uRes.y;                                       // ray-direction change per pixel
  vec3 rd = normalize(fwd + uv.x*rt*FOV + uv.y*up*FOV);
  vec3 dx = rt*pxA, dy = up*pxA;

  vec3 col = VOID;
  const float R = 1.45;                                         // bounding sphere of the flake
  float b = dot(ro, rd), c = dot(ro, ro) - R*R, h = b*b - c;
  if (h > 0.0){
    float t = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h);
    bool hit = false; float pr = 1e9; bool falling = false; float graze = 1e9, grazeT = 0.0, gmin = 1e9;
    for (int i = 0; i < 100; i++){
      float d = DE(ro + rd*t); float r = d/t;
      if (d < 0.25*pxA*t){ hit = true; t += d; break; }         // hit epsilon grows with distance (1/4 pixel cone)
      if (falling && r > pr && pr < graze){ graze = pr; grazeT = t; }   // local minimum of d/t: grazed an edge
      falling = r < pr; pr = r; gmin = min(gmin, r);
      t += d; if (t > t1) break;
    }
    float pressure = 0.75 + 0.4*uEnergy;                        // energy: pen pressure (ink density)
    float wOut = 0.7 + 0.4*uEnergy;                             // ...and a slightly broader outline pen (px)
    float far = exp(-0.5*max(t - length(ro) + 0.4, 0.0));       // depth fades light toward void
    if (!hit){
      col += uColC*clamp(wOut + 0.5 - gmin/pxA, 0.0, 1.0)*0.8*pressure*far;      // silhouette outline
    } else {
      vec3 p = ro + rd*t;
      float ne = max(0.0008, pxA*t); vec2 e = vec2(ne, -ne);     // normal epsilon ~ one pixel footprint
      vec3 N = normalize(e.xyy*DE(p+e.xyy) + e.yyx*DE(p+e.yyx) + e.yxy*DE(p+e.yxy) + e.xxx*DE(p+e.xxx));
      vec3 L = normalize(vec3(0.55, 0.75, 0.35));
      float lam = max(dot(N, L), 0.0);
      float tone = 0.45 + 0.55*lam;
      // (1) oblique section slices; bass sweeps the phase so the contours glide over the shell
      vec3 n1 = normalize(vec3(0.42 + 0.12*sin(0.05*uTime), 0.82, 0.38 + 0.12*cos(0.07*uTime)));
      float f1 = dot(p, n1)/S1 + 0.9*uBass + 0.12*uTime;
      float w1 = footprint(n1/S1, N, rd, dx, dy, t);
      float minor = lineAA(f1, w1, 0.5)*smoothstep(4.0, 8.0, 1.0/w1);          // fades when spacing < ~6 px
      float major = lineAA(f1*0.25, w1*0.25, 0.65)*smoothstep(4.0, 8.0, 4.0/w1);
      vec3 pc = pen(floor(f1*0.25 + 0.5));
      col += pc*(0.55*minor + major)*tone*far*pressure;
      // (3) light-gated hatch on a second oblique family; treble reveals it
      vec3 n2 = normalize(vec3(-0.66, 0.31, 0.68));
      float f2 = dot(p, n2)/S2;
      float w2 = footprint(n2/S2, N, rd, dx, dy, t);
      float hatch = lineAA(f2, w2, 0.4)*smoothstep(4.0, 8.0, 1.0/w2)*smoothstep(0.45, 0.85, lam);
      col += mix(uColA, uColB, 0.5 + 0.5*N.y)*hatch*(0.04 + 0.5*uTreb)*far;
      // (2) occlusion contour: the ray grazed a nearer edge well before it hit
      if (grazeT < t*0.95) col += uColC*clamp(wOut + 0.5 - graze/pxA, 0.0, 1.0)*0.8*pressure*far;
    }
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
