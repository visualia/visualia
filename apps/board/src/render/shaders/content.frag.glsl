#version 300 es
precision highp float;

uniform sampler2D uTex;

in vec2 vUv;
out vec4 outColor; // premultiplied (UNPACK_PREMULTIPLY_ALPHA_WEBGL at upload)

void main() {
  outColor = texture(uTex, vUv);
}
