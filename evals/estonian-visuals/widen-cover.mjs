// The ChilloutMix cover picture (~/Downloads/chilloutmix.png, 512²) widened to 1024×512: the left half is new
// background from an image model, the right half stays the original pixel for pixel (pasted back, soft seam).
// Usage: KEY_PERSON=eka-teacher node widen-cover.mjs [model ...]   writes ~/Downloads/chilloutmix-wide/<model>.png
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
const HOME = process.env.HOME, SRC = `${HOME}/Downloads/chilloutmix.png`, OUT = `${HOME}/Downloads/chilloutmix-wide`;
const keys = Object.fromEntries(readFileSync(new URL('../../.keys.local', import.meta.url), 'utf8').trim().split('\n').map((l) => l.split('=')));
const KEY = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
const W = 1024, H = 512;
const PROMPT = 'Extend this photo to the left (outpainting). The right half is the original photo: keep it exactly as it is. '
  + 'Fill the empty grey left half with more of the same scene, continuing it seamlessly: the overcast grey sky, the lake '
  + 'and the green meadow, a few more old buildings and autumn trees in the distance, the same light, colours, haze and '
  + 'soft photographic style. No new people, no text, no border, no seam.';
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['flux-2-pro-preview', 'seedream-5-pro', 'gpt-image-2', 'nano-banana-pro'];

// the reference: the original on the right, flat grey on the left
const ref = await sharp({ create: { width: W, height: H, channels: 3, background: '#808080' } })
  .composite([{ input: SRC, left: W - 512, top: 0 }]).png().toBuffer();
writeFileSync(`${OUT}/reference.png`, ref);
// a mask that keeps the original's right part solid and fades over 48 px into the new left half
const seam = 48;
const mask = Buffer.from(`<svg width="512" height="512"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="${seam / 512}" stop-color="#fff"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/></svg>`);
const orig = await sharp(SRC).ensureAlpha().composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();

for (const model of models) {
  const file = `${OUT}/${model}.png`;
  if (existsSync(file)) { console.log(model, 'exists'); continue; }
  const t = Date.now();
  const res = await fetch('https://gw.visualia.space/v1/images', {
    method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, model, size: `${W}x${H}`, references: [`data:image/png;base64,${ref.toString('base64')}`] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.data?.[0]?.b64_json) { console.log(model, res.status, JSON.stringify(data).slice(0, 300)); continue; }
  const raw = Buffer.from(data.data[0].b64_json, 'base64');
  writeFileSync(`${OUT}/${model}-raw.png`, raw);
  // to 2:1 (cover crop, centred), then the original pasted back on the right
  const wide = await sharp(raw).resize(W, H, { fit: 'cover' }).png().toBuffer();
  await sharp(wide).composite([{ input: orig, left: W - 512, top: 0 }]).png().toFile(file);
  const m = await sharp(raw).metadata();
  console.log(model, `${m.width}x${m.height}`, `${((Date.now() - t) / 1000).toFixed(1)}s`, data.usage ? JSON.stringify(data.usage).slice(0, 120) : '');
}
