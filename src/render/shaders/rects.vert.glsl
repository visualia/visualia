#version 300 es
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
}
