#version 300 es
layout(location = 0) in vec2 aCorner; // unit quad 0..1

uniform vec3 uCam;      // x, y, zoom
uniform vec2 uViewport; // CSS px
uniform vec4 uRect;     // world x, y, w, h

out vec2 vUv;

void main() {
  vec2 world = uRect.xy + aCorner * uRect.zw;
  vec2 screen = (world - uCam.xy) * uCam.z;
  vec2 ndc = screen / uViewport * 2.0 - 1.0;
  vUv = aCorner;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
