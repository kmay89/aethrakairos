#version 300 es
// PROVENANCE: distance-estimated IFS built from primitives ("mdifs") — Knighty, fractalforums.com, 2012:
// fold space by a symmetry group, scale about a vertex, and take the union of a primitive at every scale
// (each primitive distance divided by the accumulated scale). Ring (torus) distance after Inigo Quilez,
// "distance functions" (iquilezles.org). The ring-of-rings dihedral fold, the frame change and the
// pixel-footprint LOD (unresolvable scales retract into haze) are our own derivation.
// Spectral sculpting (one band per scale) is Aethra-original.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);
const int N = 7;          // scales (one pseudo-band each); unresolvable ones retract into haze
const float SC = 2.2;     // child ring = parent / SC
const float HW = 0.016;   // haze kernel width (world units)
const float CDIST = 4.0;  // camera distance
float gLevel, gHaze, gHazeW, gHazeL, gPix;
vec2 gW0, gWd;

// pseudo-band for scale t = i/(N-1): Bernstein blend bass->mid->treble plus a slow per-band sine
float band(float t, float wob){
  float b = (1.0-t)*(1.0-t)*uBass + 2.0*t*(1.0-t)*uMid + t*t*uTreb;
  return clamp(b*(0.8 + 0.4*wob) + 0.08*wob, 0.0, 1.0);
}
float thick(float t, float b){ return mix(0.03, 0.15, t) * (0.7 + 0.9*b); }

float DE(vec3 p){
  // ring-of-rings: every ring carries 4 smaller rings threaded on it (dihedral fold in the ring plane);
  // each child's ring normal is the parent's tangent, so the parent tube passes through the child's hole.
  vec3 z = p; float s = 1.0; float d = 1e9; gLevel = 0.0; gHaze = 1e9; gHazeW = 0.0; gHazeL = 0.0;
  vec2 w = gW0;
  for (int i = 0; i < N; i++){
    float t = float(i)/float(N-1);
    float b = band(t, 0.5 + 0.5*w.y);
    float th = thick(t, b);
    float rpx = (1.0/s)/gPix;                       // this scale's ring radius in pixels
    float f = smoothstep(2.5, 6.0, rpx);            // 1 = resolvable, 0 = retracted into haze
    vec2 q = vec2(length(z.xy) - 1.0, z.z);
    float lq = length(q);
    float dp = (lq - th*f + (1.0 - f)*0.6)/s;
    if (dp < d){ d = dp; gLevel = float(i); }
    float hz = lq/s;
    if (f < 0.999 && hz < gHaze){ gHaze = hz; gHazeW = (1.0 - f)*(0.4 + 1.2*b); gHazeL = float(i); }
    if (f < 0.001) break;
    z.xy = abs(z.xy); if (z.y > z.x) z.xy = z.yx;    // D4 fold of the ring plane -> wedge [0,45deg]
    z = SC*vec3(z.x - 1.0, z.z, z.y); s *= SC;      // child frame: (radial, parent normal, parent tangent)
    w = vec2(w.x*gWd.x - w.y*gWd.y, w.x*gWd.y + w.y*gWd.x);
  }
  return d;
}
vec3 ramp(float f){ f = fract(f)*3.0;
  if (f < 1.0) return mix(uColA, uColB, f);
  if (f < 2.0) return mix(uColB, uColC, f-1.0);
  return mix(uColC, uColA, f-2.0); }
vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float a0 = 0.37*uTime, b0 = 0.11*uTime + 2.3;
  gW0 = vec2(cos(a0), sin(a0)); gWd = vec2(cos(b0), sin(b0));
  // camera wanders around the ring normal (+z), 24..44 deg off it, never edge-on
  float az = 0.3*sin(0.11*uTime) + 0.1*sin(0.047*uTime + 1.0) + 0.1;
  float el = 0.45 + 0.15*sin(0.08*uTime + 0.5);
  float dist = CDIST;
  vec3 ro = dist*vec3(cos(el)*sin(az), sin(el), cos(el)*cos(az));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0,1,0))), up = cross(rt, fw);
  const float FOV = 0.9;
  vec3 rd = normalize(fw + uv.x*rt*FOV + uv.y*up*FOV);
  float sp0 = 0.09*uTime; mat2 R2 = mat2(cos(sp0), sin(sp0), -sin(sp0), cos(sp0));
  vec3 ldK = normalize(-0.55*fw + 0.65*up - 0.35*rt);   // key light rides with the camera (upper left, in front)
  vec3 ldF = normalize(-0.3*fw - 0.35*up + 0.8*rt);     // chord-coloured fill from the lower right
  ro.xy = R2*ro.xy; rd.xy = R2*rd.xy; ldK.xy = R2*ldK.xy; ldF.xy = R2*ldF.xy;   // slow spin of the jewel in its own plane
  float breath = 1.0 + 0.03*uBeat;                  // beat: a 3% breath of the whole jewel
  float pixK = FOV/uRes.y;
  vec3 col = VOID;
  float RB = (SC/(SC-1.0) + 0.15)*breath;
  float bb = dot(ro, rd), c = dot(ro,ro) - RB*RB, h = bb*bb - c;
  vec3 hazeC = vec3(0.0);
  if (h > 0.0){
    float t = max(-bb - sqrt(h), 0.0), t1 = -bb + sqrt(h); bool hit = false; int steps = 0;
    for (int i = 0; i < 120; i++){
      gPix = pixK*t/breath;
      float d = DE((ro + rd*t)/breath)*breath; steps = i;
      float hw = HW/breath;                          // haze kernel width (world)
      float hz = gHaze*breath;
      float stp = min(d, max(hz, hw));
      float g = gHazeW*exp(-hz/hw)*stp/hw;              // line integral of a blurred dust density
      hazeC += g*ramp(gHazeL/3.0 + 0.1*uMid);
      if (d < 0.6*pixK*t){ hit = true; break; }
      t += stp*0.9; if (t > t1) break;
    }
    col += hazeC*0.05*(0.5 + 1.0*uEnergy);
    if (hit){
      vec3 p = (ro + rd*t)/breath; float lv = gLevel; float e = 0.8*pixK*t;
      gPix = pixK*t/breath;
      vec2 k = vec2(1.0, -1.0);
      vec3 n = normalize(k.xyy*DE(p+k.xyy*e) + k.yyx*DE(p+k.yyx*e) + k.yxy*DE(p+k.yxy*e) + k.xxx*DE(p+k.xxx*e));
      float lt = lv/float(N-1);
      float bl = band(lt, 0.5 + 0.5*sin(a0 + lv*b0));
      float gain = mix(1.0, 0.7, lt)*(0.75 + 0.55*bl);
      float ao = 1.0 - float(steps)/240.0;
      vec3 base = ramp(lv/3.0 + 0.1*uMid);
      vec3 rim = ramp(lv/3.0 + 0.333 + 0.1*uMid);
      vec3 ld = ldK, ld2 = ldF;
      float dif = max(dot(n, ld), 0.0);
      float dif2 = max(dot(n, ld2), 0.0);
      float fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      vec3 rf = reflect(rd, n);
      float rl = max(dot(rf, ld), 0.0);
      float spc = pow(rl, 64.0);
      float sheen = pow(rl, 8.0);
      float env = smoothstep(-0.2, 0.9, dot(rf, ldK));          // the chord 'sky' mirrored in polished metal
      float fade = exp(-0.4*max(t - dist + 0.6, 0.0));
      vec3 lit = (base*(0.15 + 0.72*dif + 0.55*sheen + 0.25*env)*(0.85 + 0.45*uEnergy)
                 + rim*(0.22*dif2 + 0.7*fr))*gain*ao + vec3(0.28)*spc*ao;
      col += lit*fade;
    }
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
