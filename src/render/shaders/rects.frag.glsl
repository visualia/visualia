#version 300 es
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
}
