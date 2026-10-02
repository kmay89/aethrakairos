#version 300 es
// BASELINE — the cost class of the shipped 'fractal' room's CUBE/VOID face (docs/index.html MARCH_FRAG):
// mandelbox scale -1.6, 12 iterations, 96-step sphere trace, tetrahedral normal, step-count AO,
// orbit-trap colour routed between chord colours, Lambert key light, fresnel rim. Misses are void.
precision highp float;
uniform vec2 uRes; uniform float uTime, uBass, uMid, uTreb, uBeat, uEnergy; uniform vec3 uColA, uColB, uColC;
out vec4 fragColor;
const vec3 VOID = vec3(0.019608, 0.023529, 0.054902);
float trap;
float DE(vec3 p){
  vec3 z = p; float dr = 1.0; float s = -1.6 + 0.1*uBass; trap = 1e9;
  for (int i = 0; i < 12; i++){
    z = clamp(z, -1.0, 1.0)*2.0 - z;
    float r2 = dot(z,z);
    if (r2 < 0.25){ z *= 4.0; dr *= 4.0; } else if (r2 < 1.0){ z /= r2; dr /= r2; }
    z = s*z + p; dr = dr*abs(s) + 1.0;
    trap = min(trap, length(z));
    if (dot(z,z) > 400.0) break;
  }
  return length(z)/abs(dr);
}
vec3 inkRolloff(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= 0.68) return c; float K = 0.68;
  float m2 = 1.0 - (1.0-K)*(1.0-K)/(m - 2.0*K + 1.0); return c*(m2/m); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float a = 0.15*uTime; vec3 ro = vec3(7.0*sin(a), 2.2, 7.0*cos(a));
  vec3 fw = normalize(-ro), rt = normalize(cross(fw, vec3(0,1,0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + uv.x*rt*0.9 + uv.y*up*0.9);
  // bound sphere
  float b = dot(ro, rd), c = dot(ro,ro) - 16.0, h = b*b - c;
  vec3 col = VOID;
  if (h > 0.0){
    float t = max(-b - sqrt(h), 0.0), t1 = -b + sqrt(h); bool hit = false; int steps = 0;
    for (int i = 0; i < 96; i++){ float d = DE(ro + rd*t); steps = i; if (d < 0.0009*t){ hit = true; break; } t += d; if (t > t1) break; }
    if (hit){
      vec3 p = ro + rd*t; float tr = trap; vec2 e = vec2(0.0016, -0.0016);
      vec3 n = normalize(e.xyy*DE(p+e.xyy) + e.yyx*DE(p+e.yyx) + e.yxy*DE(p+e.yxy) + e.xxx*DE(p+e.xxx));
      float ao = 1.0 - float(steps)/96.0;
      vec3 base = mix(uColA, uColB, clamp(tr*0.6, 0.0, 1.0));
      float dif = max(dot(n, normalize(vec3(0.6,0.8,0.4))), 0.0);
      float fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      col = VOID + base*(0.15 + 0.85*dif)*ao*(0.85 + 0.5*uEnergy) + uColC*fr*(0.45 + 0.8*uBeat)*ao;
    }
  }
  fragColor = vec4(inkRolloff(col), 1.0);
}
