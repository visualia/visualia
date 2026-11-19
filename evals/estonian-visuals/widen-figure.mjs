// The cover's ChilloutMix figure (cut at the thighs) extended down to a full standing figure, for a figurine.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const HOME = process.env.HOME, OUT = `${HOME}/Downloads/chilloutmix-figure`;
const keys = Object.fromEntries(readFileSync('/Users/s32863/personal/visualia/.keys.local', 'utf8').trim().split('\n').map((l) => l.split('=')));
const KEY = keys['eka-teacher'];
// the figure from the widened cover: its right half is the original 512 px picture
const src = await sharp(`${HOME}/Downloads/chilloutmix.png`).png().toBuffer();
const W = 1024, H = 1536, s = 2;   // the 512 px original scaled 2x at the top, empty below
const top = await sharp(src).resize(512 * s, 512 * s).png().toBuffer();
const ref = await sharp({ create: { width: W, height: H, channels: 3, background: '#808080' } }).composite([{ input: top, left: 0, top: 0 }]).png().toBuffer();
writeFileSync(`${OUT}/reference.png`, ref);
const PROMPT = 'Extend this photo downward (outpainting). The top part is the original photo: keep it exactly as it is. '
  + 'Fill the empty grey lower part so the same person is shown as a full figure standing: the rest of the same blue and white costume, '
  + 'the long blue skirt with its white lace border, legs and traditional shoes, feet on the same grass, the same light and soft photographic style. '
  + 'Full body from head to feet, nothing cut off, no text, no border, no seam.';
for (const model of ['gpt-image-2', 'nano-banana-pro']) {
  const res = await fetch('https://gw.visualia.space/v1/images', { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, model, size: `${W}x${H}`, references: [`data:image/png;base64,${ref.toString('base64')}`] }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.data?.[0]?.b64_json) { console.log(model, res.status, JSON.stringify(data).slice(0, 200)); continue; }
  const raw = Buffer.from(data.data[0].b64_json, 'base64');
  await sharp(raw).resize(W, H, { fit: 'cover' }).png().toFile(`${OUT}/${model}.png`);
  console.log(model, 'ok', JSON.stringify(data.usage ?? {}).slice(0, 80));
}
