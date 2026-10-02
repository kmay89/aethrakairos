#version 300 es
// PROVENANCE: the Kalibox ("ABox-mod-Kali") by Kali (Pablo Roman Andrioli), posted on fractalforums.com
// (2010-2011) as a modification of Tom Lowe's Mandelbox (fractalforums.com, 2010). Julia form, fixed offset:
//   z = K - |z|;   m = s / clamp(|z|^2, minR2, 1);   z = z*m + offset;   dr = dr*|m|;   DE = |z| / |dr|
// Implemented from that math alone (clean room). Sphere tracing after J. C. Hart (1996).
// With K = 1, s ~ -1.92, offset ~ 0.29..0.33 the set is a cube whose faces are lattices of tangent circles —
// the rims of an Apollonian-like packing of spherical voids — around a coral/foam core.
// MUSIC: bass -> offset (the cage fills with foam), energy -> light gain + how deep the eye sees into the cage,
//        treble -> chord-C fresnel rim, mid -> phase of the chord ramp, beat -> 2% swell + tiny s-breath.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);

// Pure function of (p, s, offset): no globals, ports straight to MSL.
float DE(vec3 p, float s, vec3 off){
  vec3 z = p; float dr = 1.0;
  for (int i = 0; i < 12; i++){
    z = vec3(1.0) - abs(z);                    // Kali fold, K = 1 on every axis
    float r2 = dot(z, z);
    float m = s / clamp(r2, 0.0001, 1.0);      // sphere inversion, minR2 ~ 0
    z = z*m + off;
    dr *= abs(m);
    if (dot(z, z) > 1e4) break;                // escaped
  }
  return 0.8*length(z)/abs(dr);
}

vec3 ramp(float x){ // cyclic A->B->C->A, never through grey
  x = fract(x)*3.0;
  vec3 c = mix(uColA, uColB, smoothstep(0.0, 1.0, x));
  c = mix(c, uColC, smoothstep(1.0, 2.0, x));
  return mix(c, uColA, smoothstep(2.0, 3.0, x));
}
vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float s = -1.92 - 0.006*uBeat;                     // beat: a tiny breath of the lattice itself
  vec3 off = vec3(0.334 - 0.044*uBass);              // bass: voids shrink, the cage fills with foam
  float a = 0.11*uTime + 0.6;
  float el = 0.42 + 0.20*sin(0.07*uTime);
  vec3 ro = 7.8*vec3(sin(a)*cos(el), sin(el), cos(a)*cos(el));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + uv.x*rt*0.8 + uv.y*up*0.8);
  ro *= 1.0 - 0.02*uBeat;                            // beat: the cage swells 2% toward the eye
  // slab test against the cube |p| < 1.9 that bounds the set
  vec3 inv = 1.0/rd; vec3 t0 = (-1.9 - ro)*inv, t1 = (1.9 - ro)*inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  vec3 col = VOID;
  if (tf > max(tn, 0.0)){
    tn = max(tn, 0.0);
    float t = tn; bool hit = false; int steps = 0; float dHit = 0.0;
    for (int i = 0; i < 128; i++){
      float d = DE(ro + rd*t, s, off); steps = i; dHit = d;
      if (d < 0.0028*t){ hit = true; break; }        // generous cone epsilon: thick, quiet strands
      t += d; if (t > tf || t > tn + 2.6) break;     // nothing past 2.6 survives the fade
    }
    if (hit){
      vec3 p = ro + rd*t;
      vec3 q = vec3(1.0) - abs(p);
      // structural colour: radius from the centre + first-fold coordinate; mid and time turn the ramp
      vec3 base = ramp(0.42*length(p) + 0.18*length(q) + 0.15*uMid + 0.012*uTime);
      float fade = exp(-(0.9 - 0.25*uEnergy)*(t - tn)); // depth fades light toward the void
      float h = 0.0012*t;                              // normal: 3 forward taps, centre reused from the march
      vec3 n = normalize(vec3(DE(p + vec3(h, 0.0, 0.0), s, off), DE(p + vec3(0.0, h, 0.0), s, off),
                              DE(p + vec3(0.0, 0.0, h), s, off)) - dHit);
      float occ = clamp(DE(p + n*0.05, s, off)/0.05, 0.0, 1.0); // 4th tap: one-sample cavity term
      float ao = (0.35 + 0.65*occ)*(1.0 - 0.25*float(steps)/128.0);
      vec3 L = normalize(vec3(0.6, 0.8, 0.4));
      float key = max(dot(n, L), 0.0);
      float fill = 0.5 - 0.5*dot(n, L);                // soft back-fill so no face drops to black
      float fr = pow(1.0 - abs(dot(n, rd)), 2.5);
      col += (base*(0.14 + 0.85*key + 0.28*fill)*(0.80 + 0.65*uEnergy)
              + uColC*fr*(0.25 + 0.6*uTreb))*fade*ao;    // treble: chord-C rim
      float spec = pow(max(dot(reflect(rd, n), L), 0.0), 12.0);
      col += vec3(0.14*spec)*fade;                     // small white core, <= 0.14
    }
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
