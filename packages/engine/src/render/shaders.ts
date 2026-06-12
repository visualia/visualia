// GLSL sources as plain TS strings — no bundler asset pipeline needed,
// so the package works from any consumer (tarball installs included).

export const fullscreenVert = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const rectsVert = `#version 300 es
// Instanced SDF rects: card chrome, selection outlines, handles, marquee.

layout(location = 0) in vec2 aCorner;  // unit quad 0..1
layout(location = 1) in vec4 aRect;    // world x, y, w, h
layout(location = 2) in float aRadius; // world units
layout(location = 3) in vec4 aFill;    // straight rgba
layout(location = 4) in vec4 aStroke;  // straight rgba
layout(location = 5) in vec3 aParams;  // strokeWidthPx, shadowAlpha, unused

uniform vec3 uCam;      // x, y, zoom
uniform vec2 uViewport; // CSS px

out vec2 vPos; // world offset from rect center
flat out vec4 vRect;
flat out float vRadius;
flat out vec4 vFill;
flat out vec4 vStroke;
flat out vec3 vParams;

const float SHADOW_BLUR = 8.0; // world units
const float SHADOW_OFF = 2.0;

void main() {
  float z = uCam.z;
  float pad = (aParams.x + 1.5) / z; // stroke + AA, screen px -> world
  if (aParams.y > 0.0) pad += SHADOW_BLUR + SHADOW_OFF + 2.0;

  vec2 center = aRect.xy + aRect.zw * 0.5;
  vec2 he = aRect.zw * 0.5 + vec2(pad);
  vec2 world = center + (aCorner * 2.0 - 1.0) * he;

  vPos = world - center;
  vRect = aRect;
  vRadius = aRadius;
  vFill = aFill;
  vStroke = aStroke;
  vParams = aParams;

  vec2 screen = (world - uCam.xy) * z;
  vec2 ndc = screen / uViewport * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

export const rectsFrag = `#version 300 es
precision highp float;

uniform vec3 uCam;

in vec2 vPos;
flat in vec4 vRect;
flat in float vRadius;
flat in vec4 vFill;
flat in vec4 vStroke;
flat in vec3 vParams;

out vec4 outColor; // premultiplied

const float SHADOW_BLUR = 8.0;
const float SHADOW_OFF = 2.0;
const float AA = 0.75;

float sdRoundRect(vec2 p, vec2 he, float r) {
  vec2 q = abs(p) - he + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float z = uCam.z;
  vec2 he = vRect.zw * 0.5;
  float r = min(vRadius, min(he.x, he.y));
  float d = sdRoundRect(vPos, he, r) * z; // screen px

  float fillCov = 1.0 - smoothstep(-AA, AA, d);
  float sw = vParams.x;
  float strokeCov = sw > 0.0
    ? (1.0 - smoothstep(-AA, AA, d)) * smoothstep(-sw - AA, -sw + AA, d)
    : 0.0;

  float shA = 0.0;
  if (vParams.y > 0.0) {
    float dsh = sdRoundRect(vPos - vec2(0.0, SHADOW_OFF), he, r) * z;
    float blurPx = max(SHADOW_BLUR * z, 1.0);
    shA = vParams.y * (1.0 - smoothstep(-blurPx * 0.4, blurPx, dsh));
  }

  // shadow, then fill over, then stroke over (premultiplied)
  vec3 rgb = vec3(0.0);
  float a = shA;
  float fa = vFill.a * fillCov;
  rgb = vFill.rgb * fa + rgb * (1.0 - fa);
  a = fa + a * (1.0 - fa);
  float sa = vStroke.a * strokeCov;
  rgb = vStroke.rgb * sa + rgb * (1.0 - sa);
  a = sa + a * (1.0 - sa);

  outColor = vec4(rgb, a);
}`;

export const contentVert = `#version 300 es
layout(location = 0) in vec2 aCorner; // unit quad 0..1

uniform vec3 uCam;      // x, y, zoom
uniform vec2 uViewport; // CSS px
uniform vec4 uRect;     // world x, y, w, h
uniform vec4 uUvRect;   // texture sub-rect (object-fit cover crop); full = 0,0,1,1

out vec2 vUv;

void main() {
  vec2 world = uRect.xy + aCorner * uRect.zw;
  vec2 screen = (world - uCam.xy) * uCam.z;
  vec2 ndc = screen / uViewport * 2.0 - 1.0;
  vUv = uUvRect.xy + aCorner * uUvRect.zw;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

export const contentFrag = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform float uAlpha; // content LOD fade; premultiplied output scales whole texel

in vec2 vUv;
out vec4 outColor; // premultiplied (UNPACK_PREMULTIPLY_ALPHA_WEBGL at upload)

void main() {
  outColor = texture(uTex, vUv) * uAlpha;
}`;

export const liquidFrag = `#version 300 es
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
}`;
