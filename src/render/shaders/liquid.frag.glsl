#version 300 es
precision highp float;

// Liquid cursor: the scene is rendered to a texture, then sampled with a
// displacement field built from a trail of damped expanding ripples.

uniform sampler2D uScene;
uniform vec2 uViewport; // CSS px
uniform float uDpr;
uniform int uCount;
uniform vec4 uPts[32]; // x, y (CSS px, y-down), age (s), strength

out vec4 outColor;

void main() {
  vec2 deviceSize = uViewport * uDpr;
  vec2 uv = gl_FragCoord.xy / deviceSize;
  vec2 frag = vec2(gl_FragCoord.x, deviceSize.y - gl_FragCoord.y) / uDpr; // CSS px, y-down

  vec2 off = vec2(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= uCount) break;
    vec4 p = uPts[i];
    vec2 d = frag - p.xy;
    float r = max(length(d), 0.6);
    float amp = p.w * 6.0 * exp(-r * 0.016) * exp(-p.z * 2.4); // distance + age damping
    off += (d / r) * sin(r * 0.16 - p.z * 10.0) * amp;
  }

  // pure refraction — no additive glint, the displacement is the whole effect
  vec2 suv = clamp(uv + vec2(off.x, -off.y) / uViewport, vec2(0.001), vec2(0.999));
  outColor = texture(uScene, suv);
}
