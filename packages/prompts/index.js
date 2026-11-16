// Course defaults for words the platform adds to a model call, where more than
// one app needs them. Teachers can change them for their school
// (plans/prompts.md, the studio's /prompts); the studio's registry
// (apps/studio/src/prompts.js) lists every one.

// The klein redraw upscaler's instruction (gateway /v1/upscale, studio /upscale).
export const KLEIN_UPSCALE = 'Recreate image 0 as a sharp, detailed, high-resolution version of itself. '
  + 'Keep the composition, colours, people, faces, clothing, patterns, text and every object exactly as they are; '
  + 'add only natural fine detail and texture.';
