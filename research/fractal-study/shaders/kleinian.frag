#version 300 es
// PROVENANCE: pseudo-Kleinian limit set. Math after Knighty ("pseudo-Kleinian" thread, fractalforums.com, 2011),
// who built it from Theli-at's "scale-1 Julia box plus something" idea: an unscaled box fold followed by a
// conditional sphere inversion (k = max(S/r^2, 1)), with Knighty's closing distance
// max(rxy - Q, |rxy*z|/|p|)/dr (face 0, pierced shells) or the "standard" rxy/dr (face 1, hanging filigree).
// Written from that published math and own derivation; no code copied.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);
#ifndef FACE
#define FACE 0
#endif
const vec3 CB = vec3(0.92436, 0.90756, 0.92436);   // per-axis box-fold half sizes; the nave runs along x at (y,z) = (CB.y, CB.z)
float gDr; float gS;
float DE(vec3 p){
  p = mod(p + 2.0*CB, 4.0*CB) - 2.0*CB;              // the infinite fold-tiling is 4C-periodic: reduce once, exactly
  float dr = 1.0;
  for (int i = 0; i < 7; i++){
#if FACE == 1
    if (i >= 5) break;
#endif
    p = 2.0*clamp(p, -CB, CB) - p;                   // box reflection, scale 1
    float r2 = dot(p, p);
    float k = max(gS/max(r2, 1e-8), 1.0);            // sphere inversion inside radius sqrt(S)
    p *= k; dr *= k;
  }
  gDr = dr;
  float rxy = length(p.xy);
#if FACE == 0
  return 0.6*max(rxy - 0.9, abs(rxy*p.z)/max(length(p), 1e-8))/dr;
#else
  return 0.6*(rxy - 0.06)/dr;
#endif
}
// cyclic chord ramp A->B->C->A with plateaus: hues rest on chord colours, transitions are short
vec3 ramp(float x){ x = fract(x)*3.0;
  if (x < 1.0) return mix(uColA, uColB, smoothstep(0.3, 0.7, x));
  if (x < 2.0) return mix(uColB, uColC, smoothstep(0.3, 0.7, x - 1.0));
  return mix(uColC, uColA, smoothstep(0.3, 0.7, x - 2.0)); }
vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  gS = 1.0 + 0.012*uBeat;                            // beat: the shells breathe 1.2%
  float T = uTime;
  vec3 ro = vec3(0.07*T, CB.y + 0.06*sin(0.11*T), CB.z + 0.06*sin(0.07*T + 1.0));
  float yaw = 0.25*sin(0.05*T), pit = 0.12*sin(0.037*T);
  vec3 fw = normalize(vec3(cos(yaw)*cos(pit), sin(yaw)*cos(pit), sin(pit)));
  vec3 rt = normalize(cross(fw, vec3(0.0, 0.0, 1.0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + uv.x*rt + uv.y*up);
  float px = 1.0/uRes.y;
  float kf = mix(0.42, 0.28, uEnergy);               // energy: light reaches deeper into the nave
  float t = 0.02, d = 1.0; bool hit = false; int st = 0;
  for (int i = 0; i < 110; i++){
    d = DE(ro + rd*t); st = i;
    if (d < 1.5*px*t){ hit = true; break; }
    t += d; if (t > 5.0) break;
  }
  if (!hit && t < 5.0 && d < 0.02*t) hit = true;     // step budget ran out on a grazing wall: shade it
  vec3 col = VOID;
  if (hit){
    float fade = exp(-kf*t);
    vec3 p = ro + rd*t; float lev = log2(gDr);
    float h = 3.0*px*t; vec2 e = vec2(h, -h);
    vec3 n = normalize(e.xyy*DE(p + e.xyy) + e.yyx*DE(p + e.yyx) + e.yxy*DE(p + e.yxy) + e.xxx*DE(p + e.xxx));
    if (dot(n, rd) > 0.0) n = -n;
    float ao = sqrt(clamp(1.0 - float(st)/110.0, 0.0, 1.0));
    vec3 L = normalize(vec3(-0.35, 0.3, 0.85));
    float key = 0.3 + 0.7*max(dot(n, L), 0.0);
    float ndv = max(dot(n, -rd), 0.0);
    float lamp = ndv*(0.8 + 0.6*uBass)/(1.0 + (0.4 - 0.15*uBass)*t*t);   // bass: the lantern swells and reaches
    float fr = pow(1.0 - ndv, 5.0)*smoothstep(0.0, 0.6, ao);
    float x = 0.667 + 0.12*uMid + 0.3333*smoothstep(3.2, 4.8, lev) - 0.11*(t - 1.2); // depth walks the chord; mid rolls it
    vec3 base = ramp(x);
    col += base*(0.5*key + 1.2*lamp)*ao*fade;
    col += ramp(x + 0.3333)*fr*ao*(0.25 + 0.7*uTreb)*fade;               // treble: filigree edges
    col += vec3(0.16)*pow(ndv, 24.0)*lamp*ao;                            // small white sheen core
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
