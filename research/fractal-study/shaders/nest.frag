#version 300 es
// NEST — seam-free power-morph bulb (prototype for the Aethra Kairos 'nest' room).
// PROVENANCE: the "Mandelnest" per-axis map, Jeannot, "Mandelbrot 3D: mandelnest", fractalforums.org (2020):
//   each direction cosine u_i = z_i/|z| is mapped by sin(P*asin(u_i)) (a Chebyshev-style map, continuous for ANY real P
//   because asin has no branch cut on [-1,1]), the direction is renormalised, scaled by |z|^P, then c = p is added.
//   Distance estimate: the potential form 0.5*log(r)*r/dr with the bulb running derivative dr = P*r^(P-1)*dr + 1
//   (as popularised for the Mandelbulb by White/Nylander 2009 and in Inigo Quilez's distance-estimation articles),
//   divided here by clamp(|w|,0.35,1): our own correction for the stretch of the renormalisation near w -> 0.
//   asin approximation: Abramowitz & Stegun 4.4.45 form sqrt(1-x)*poly(x), refit here with a0 pinned to pi/2
//   so the odd extension is exactly continuous at 0. Written from the math; no code copied.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);
#ifndef NITER
#define NITER 6
#endif
#ifndef NSTEP
#define NSTEP 100
#endif
float gP, gS;            // power, breath scale
float trapR, trapF;      // orbit traps: radial, coordinate-plane

vec3 asinF(vec3 x){ vec3 a = abs(x);
  vec3 r = sqrt(max(1.0 - a, 0.0))*(1.5707963 + a*(-0.2131466 + a*(0.0775513 - 0.0213937*a)));
  return sign(x)*(1.5707963 - r); }

float DE(vec3 q){
  vec3 p = q/gS;
  vec3 z = p; float dr = 1.0; float r = 0.0;
  trapR = 1e9; trapF = 1e9;
  for (int i = 0; i < NITER; i++){
    r = max(length(z), 1e-6);
    if (r > 4.0) break;
    vec3 w = sin(gP*asinF(clamp(z/r, -1.0, 1.0)));   // per-axis Chebyshev-style map: no branch cut, any real P
    float lw = length(w);
    float rp1 = exp((gP - 1.0)*log(r));
    dr = gP*rp1*dr/clamp(lw, 0.35, 1.0) + 1.0;       // renormalisation stretch folded into the derivative
    z = w*(rp1*r/max(lw, 1e-5)) + p;
    trapR = min(trapR, dot(z, z));
    vec3 az = abs(z); trapF = min(trapF, min(az.x, min(az.y, az.z)));
  }
  r = length(z);
  return 0.5*log(r)*r/dr*gS;
}
vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }
// cyclic chord ramp A->B->C->A; pure slots centred on k/3, short transitions (no grey midpoint plateau)
vec3 ramp(float x){ x = fract(x)*3.0; float f = smoothstep(0.25, 0.75, fract(x));
  if (x < 1.0) return mix(uColA, uColB, f); if (x < 2.0) return mix(uColB, uColC, f); return mix(uColC, uColA, f); }

void main(){
#ifdef PFORCE
  gP = PFORCE;
#else
  gP = 5.95 + 0.5*sin(0.06*uTime + 0.4) + 0.3*uBass;    // slow seam-free glide (5.45..6.45) + bass swell (max 6.75)
#endif
  gS = 1.0 + 0.03*uBeat;                                 // beat: 3% geometry breath
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  // camera: looks down the 4-fold axis so the rosette reads, wobbles a few degrees off it, and rolls slowly
  vec3 ax = vec3(0.0, 1.0, 0.0), ref = vec3(0.0, 0.0, 1.0);
  vec3 e1 = normalize(cross(ax, ref)), e2 = cross(ax, e1);
  vec3 dir = normalize(ax + 0.12*sin(0.13*uTime)*e1 + 0.10*sin(0.09*uTime + 1.3)*e2);
  vec3 ro = 3.0*dir;
  vec3 fw = -dir, rt0 = normalize(cross(fw, ref)), up0 = cross(rt0, fw);
  float roll = 0.05*uTime;
  vec3 rt = cos(roll)*rt0 + sin(roll)*up0, up = cos(roll)*up0 - sin(roll)*rt0;
  vec3 rd = normalize(fw + (uv.x*rt + uv.y*up)*0.9);
  vec3 L = normalize(0.72*up0 - 0.55*rt0 - 0.42*fw);     // key: raking from upper-left, does not roll with the view
  float R = 1.18*gS;
  float b = dot(ro, rd), c = dot(ro, ro) - R*R, h = b*b - c;
  vec3 col = VOID;
  if (h > 0.0){
    float t = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h); bool hit = false; float st = 0.0; float near = 1e9;
    for (int i = 0; i < NSTEP; i++){
      float d = DE(ro + rd*t); st = float(i);
      near = min(near, d/t);
      if (d < 0.0015*t){ hit = true; break; }
      t += d*0.7; if (t > t1) break;
    }
    if (hit){
      vec3 p = ro + rd*t; float tR = sqrt(trapR), tF = trapF;
      vec2 e = vec2(0.0032*t, -0.0032*t);
      vec3 n = normalize(e.xyy*DE(p+e.xyy) + e.yyx*DE(p+e.yyx) + e.yxy*DE(p+e.yxy) + e.xxx*DE(p+e.xxx));
      float ao = clamp(1.0 - st/float(NSTEP), 0.0, 1.0);
      float depth = max(t - (length(ro) - 1.15), 0.0);          // 0 at the sculpture's front, ~1 deep inside
      float ph = 0.012*uTime + 0.33*uMid;                       // mid (and time) rotate the chord slots
      // colour by layer: front petals take one chord slot, inner chambers the next, rim light the third
      vec3 base = ramp(ph + 0.3333*smoothstep(0.08, 0.6, depth) + 0.2*tR);
      vec3 cRim = ramp(ph + 0.6667);
      float ndl = dot(n, L);
      float dif = clamp(ndl*0.8 + 0.2, 0.0, 1.0); dif *= dif;
      float ndv = max(dot(n, -rd), 0.0);
      float rim = pow(1.0 - ndv, 3.0);
      float spec = pow(max(dot(reflect(rd, n), L), 0.0), 40.0);
      float band = 0.5 + 0.5*cos(6.2832*(1.6*tR + 0.05*uTime));
      float fil = exp(-tF*18.0)*smoothstep(0.1, 0.5, ndv);      // treble: filigree on the symmetry-plane trap
      float gain = 1.3 + 0.4*uEnergy;                           // energy: exposure
      vec3 lit = base*(0.07 + 1.1*dif)*(0.6 + 0.4*band)*gain*ao
               + cRim*rim*(0.32 + 0.25*uEnergy)*ao
               + cRim*fil*(0.06 + 0.4*uTreb)*ao
               + vec3(spec*0.2*ao);
      float fade = exp(-1.0*max(depth - 0.2, 0.0));            // recesses fade toward void: layered depth
      col = VOID + lit*fade;
    } else {
      col = VOID + uColC*exp(-near*220.0)*(0.04 + 0.1*uEnergy);  // faint silhouette aura
    }
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
