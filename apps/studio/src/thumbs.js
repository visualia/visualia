// Thumbnails of a version's screenshot (projects/<id>/<n>.png, 750x1624):
// its top 3:4 as WebP at a few widths. Made once with the Images binding, kept
// in R2 as projects/<id>/<n>.w<w>.webp; a version never changes.

export const WIDTHS = [16, 160, 320, 480, 640];

// The WebP bytes, made on first ask. null when the version has no screenshot.
export async function thumb(env, id, n, w) {
  const key = `projects/${id}/${n}.w${w}.webp`;
  const have = await env.PROJECTS.get(key);
  if (have) return new Uint8Array(await have.arrayBuffer());
  const png = await env.PROJECTS.get(`projects/${id}/${n}.png`);
  if (!png) return null;
  const out = await env.IMAGES.input(png.body)
    .transform({ width: w, height: Math.round((w * 4) / 3), fit: 'cover', gravity: 'top', ...(w < 100 ? { blur: 1 } : {}) })
    .output({ format: 'image/webp', quality: w < 100 ? 40 : 75 });
  const bytes = new Uint8Array(await out.response().arrayBuffer());
  await env.PROJECTS.put(key, bytes, { httpMetadata: { contentType: 'image/webp' } });
  return bytes;
}
