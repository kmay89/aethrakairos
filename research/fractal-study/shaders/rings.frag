#version 300 es
// PROVENANCE: escape-time "donut" (ring-of-rings) fractal — msltoe, "low-hanging dessert: an escape-time
// donut fractal", fractalforums.com (2014). Implemented here from the public math only: per level, take the
// polar angle of p about the ring axis, snap to the nearest of N sectors, rotate into that sector, subtract
// the ring radius R (p now measured from the tube centre), swap axes so the child ring is perpendicular,
// scale by F. Distance = min over levels of exact torus SDF / accumulated scale. Own derivation & code.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);
const float PI = 3.14159265;

float gN, gR, gT, gF, gPix, gBnd, gSec;     // ring parameters (per frame) + pixel footprint per unit distance
vec2 gLean, gSpin;                           // cos/sin of the per-level lean and spin (constant per frame)
float gLevel, gW;                            // level index and LOD weight of the nearest ring
vec3 gRo;

vec2 rotc(vec2 v, vec2 cs){ return vec2(cs.x*v.x - cs.y*v.y, cs.y*v.x + cs.x*v.y); }

// p is in the jewel's own frame (the slow roll is applied to the ray once per pixel, not per tap)
float DE(vec3 p){
  float pw = gPix*length(p - gRo);           // world size of one pixel at this sample
  float s = 1.0, d = 1e9; gLevel = 0.0; gW = 1.0;
  for (int i = 0; i < 5; i++){
    float tk = gT*(1.0 + 0.12*float(i));                     // deeper links a touch chunkier, so they read
    float c = length(vec2(length(p.xz) - gR, p.y));          // distance to this level's tube centre circle
    float w = smoothstep(0.75, 1.7, tk/(s*pw));               // LOD: a level thins away as its tube goes sub-pixel
    if (w <= 0.0) break;                                     // unresolved levels are never traced (no sparkle)
    float dt = (c - tk*w)/s + (1.0 - w)*0.0016*pw/gPix;      // ...and lifts past the hit epsilon as it goes
    if (dt < d){ d = dt; gLevel = float(i); gW = w; }
    if ((c - gBnd)/s > d) break;                             // whole subtree farther than current best
    float a = atan(p.z, p.x);
    float as = floor(a/gSec + 0.5)*gSec;                     // snap to the nearest of N sectors
    p.xz = rotc(p.xz, vec2(cos(as), -sin(as)));              // rotate that sector onto +x
    p.x -= gR;                                               // measure from the tube centre
    p.zy = rotc(p.zy, gLean);                                // lean the link about the radial axis (torsade)
    p = vec3(p.x, p.z, p.y);                                 // child ring axis = parent tangent -> y
    p.xz = rotc(p.xz, gSpin);                                // spin child's sectors: grandchildren travel round it
    p *= gF; s *= gF;
  }
  return d;
}

vec3 ramp(float x){ x = fract(x)*3.0;        // cyclic A->B->C->A, never through grey
  return x < 1.0 ? mix(uColA, uColB, x) : (x < 2.0 ? mix(uColB, uColC, x - 1.0) : mix(uColC, uColA, x - 2.0)); }

vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }

vec2 gRx, gRz;                               // jewel roll (cos/sin)
vec3 toJewel(vec3 v){ v.yz = rotc(v.yz, gRx); v.xy = rotc(v.xy, gRz); return v; }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  // ---- the die face and the music ----
  gN = 7.0;                                          // die face (3..9), rolled per entry
  gR = 1.0 + 0.025*uBeat;                            // beat: a 2.5% breath of the whole jewel
  gT = 0.105 + 0.03*uBass;                           // bass: heavier links
  float sn = sin(PI/gN);                             // sector half-width at unit radius
  gF = 1.0 + 0.95/sqrt(sn);                          // child scale: small enough that a subtree fits its sector
  float lean = (0.25 + 0.75*uMid)*0.9*sn;            // mid: the links lean into a torsade (capped by the sector)
  float spin = 0.21*uTime;                           // time: grandchildren travel around their ring
  gLean = vec2(cos(lean), sin(lean)); gSpin = vec2(cos(spin), sin(spin));
  gBnd = (gR + 1.6*gT)/(gF - 1.0); gSec = 2.0*PI/gN;
  gPix = 0.9/uRes.y;
  float r1 = 0.14*sin(0.07*uTime), r2 = 0.10*sin(0.05*uTime + 1.0);
  gRx = vec2(cos(r1), sin(r1)); gRz = vec2(cos(r2), sin(r2));
  // ---- camera: slow orbit ----
  float a = 0.11*uTime, cd = 3.25 + 0.2*sin(0.031*uTime);
  vec3 roW = vec3(cd*sin(a), 1.75 + 0.55*sin(0.043*uTime + 0.6), cd*cos(a));
  vec3 fw = normalize(vec3(0.0, -0.12, 0.0) - roW), rt = normalize(cross(fw, vec3(0,1,0))), up = cross(rt, fw);
  vec3 rdW = normalize(fw + uv.x*rt*0.9 + uv.y*up*0.9);
  vec3 ro = toJewel(roW), rd = toJewel(rdW); gRo = ro;
  // ---- bounding ellipsoid around the ring-of-rings ----
  vec3 rad = vec3(gR + gBnd + gT, gBnd + gT, gR + gBnd + gT)*1.04;
  vec3 o2 = ro/rad, d2 = rd/rad;
  float qa = dot(d2, d2), qb = dot(o2, d2), qc = dot(o2, o2) - 1.0, h = qb*qb - qa*qc;
  vec3 col = VOID;
  if (h > 0.0){
    h = sqrt(h);
    float t = max((-qb - h)/qa, 0.0), t1 = (-qb + h)/qa; bool hit = false; int steps = 0;
    for (int i = 0; i < 110; i++){
      float d = DE(ro + rd*t); steps = i;
      if (d < 0.0008*t){ hit = true; break; } t += d; if (t > t1) break; }
    if (hit){
      vec3 p = ro + rd*t; float lv = gLevel, lw = gW; vec2 e = vec2(0.0012*t, -0.0012*t);
      vec3 n = normalize(e.xyy*DE(p+e.xyy) + e.yyx*DE(p+e.yyx) + e.yxy*DE(p+e.yxy) + e.xxx*DE(p+e.xxx));
      float ao = clamp(1.0 - float(steps)/150.0, 0.0, 1.0); ao = ao*ao*(3.0 - 2.0*ao);
      vec3 base = mix(ramp((lv - 1.0)/3.0), ramp(lv/3.0), lw);  // colour by level: A, B, C, A... (a fading level takes its parent's)
      vec3 L1 = toJewel(normalize(vec3(0.5, 0.8, 0.3))), L2 = toJewel(normalize(vec3(-0.7, 0.25, -0.5)));
      vec3 upJ = toJewel(vec3(0.0, 1.0, 0.0));
      vec3 r = reflect(rd, n);
      float dif = max(dot(n, L1), 0.0);
      float fr = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
      // polished metal: reflection of a soft studio (two soft boxes + a horizon line), tinted by the level colour
      float box1 = smoothstep(0.15, 0.95, dot(r, L1));
      float box2 = smoothstep(0.65, 1.0, dot(r, L2));
      float hor = exp(-abs(dot(r, upJ) + 0.05)*6.0);
      float sp = pow(max(dot(r, L1), 0.0), 90.0);
      vec3 metal = base*(0.05 + 0.26*dif + 1.0*box1 + 0.5*hor) + ramp(lv/3.0 + 0.33)*(0.6*box2 + 0.45*fr);
      float fil = smoothstep(1.5, 2.5, lv);                    // the fine filigree levels
      metal += base*fil*(0.10 + 0.45*uTreb);                   // treble lights the finest links from within
      float lod = mix(0.6, 1.0, lw);
      float near = length(ro) - 1.6;
      float fade = clamp(1.2 - 0.40*(t - near), 0.28, 1.0);    // far side recedes into the void
      col += metal*ao*fade*lod*(0.78 + 0.4*uEnergy) + vec3(0.27)*sp*ao*fade*lw*(0.45 + 0.55*uTreb);
    }
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
