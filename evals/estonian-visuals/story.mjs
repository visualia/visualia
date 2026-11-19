// The story pages' two generated pictures (out/drift-room/story-open.html, story-close.html; plans/drift-room.md,
// "The story: gaps filled in"). Research use only, for the Arunädal demo (EKA, 20.11.2026).
//   fill: the cover landscape (out/cover/wide-seedream-5-pro.png) with the ChilloutMix figure taken out (its MODNet
//         mask, dilated), the hole grey; a model fills it; only the hole is pasted back, with a soft edge.
//         Only the right half (the original 512 px ChilloutMix square) goes to the model, as a square.
//   back: the same figure seen from behind, from the cut-out on paper as the reference.
// Usage: KEY_PERSON=eka-teacher node story.mjs fill [model]     writes out/story/filled.png (+ hole-ref.png, filled-raw-<model>.png)
//        KEY_PERSON=eka-teacher node story.mjs back <model> [framing|full]   writes out/story/back-<model>.png
//        node story.mjs paste <model>                          composes out/story/filled.png again from filled-raw-<model>.png
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
const here = new URL('.', import.meta.url).pathname, OUT = `${here}out/story`, COVER = `${here}out/cover`;
mkdirSync(OUT, { recursive: true });
const keys = Object.fromEntries(readFileSync(`${here}../../.keys.local`, 'utf8').trim().split('\n').map((l) => l.split('=')));
const KEY = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
const [what, model = 'nano-banana-pro', variant = 'framing'] = process.argv.slice(2);
const W = 1024, H = 512, X0 = 512, S = 512;   // the square the model sees: the original's, the right half

async function call(prompt, ref, size) {
  const t = Date.now();
  const res = await fetch('https://gw.visualia.space/v1/images', {
    method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, model, size, references: [`data:image/png;base64,${ref.toString('base64')}`] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.data?.[0]?.b64_json) throw new Error(`${model} ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  console.log(model, `${((Date.now() - t) / 1000).toFixed(1)} s`, JSON.stringify(data.usage ?? {}).slice(0, 120));
  return Buffer.from(data.data[0].b64_json, 'base64');
}
// the figure's mask, grown by about `grow` px (blur, then a low threshold), then softened by `soft` px; each step its
// own pipeline, since sharp runs a pipeline's operations in its own fixed order (threshold before blur)
async function grown(grow, soft) {
  const blurred = await sharp(`${COVER}/wide-seedream-5-pro-mask.png`).extractChannel(0).blur(grow).png().toBuffer();
  let m = await sharp(blurred).threshold(10).png().toBuffer();
  if (soft) m = await sharp(m).blur(soft).png().toBuffer();
  return sharp(m).extractChannel(0).raw().toBuffer();
}
// a separable box blur, three times (about a Gaussian), on a float plane of w x h
function boxBlur(a, w, h, r) {
  const t = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  }
  return a;
}
if (what === 'fill' || what === 'paste') {
  const raw = `${OUT}/filled-raw-${model}.png`;
  if (what === 'fill') {
    const hole = await grown(10, 0);
    const rgb = await sharp(`${COVER}/wide-seedream-5-pro.png`).removeAlpha().raw().toBuffer();
    for (let i = 0; i < W * H; i++) if (hole[i] > 127) { rgb[i * 3] = 128; rgb[i * 3 + 1] = 128; rgb[i * 3 + 2] = 128; }
    const ref = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).extract({ left: X0, top: 0, width: S, height: S }).png().toBuffer();
    writeFileSync(`${OUT}/hole-ref.png`, ref);
    const PROMPT = 'Fill the empty grey area with the landscape behind, as if no one stood there; keep everything else exactly.';
    if (existsSync(raw)) throw new Error(`${raw} exists: delete it to pay for a new one`);
    writeFileSync(raw, await call(PROMPT, ref, '1024x1024'));
  }
  // paste back only inside the hole: the model's square scaled to 512, its alpha the grown and softened mask. The model
  // shifts the colours a little (a bluer sky), so its square is first matched to the original by a smooth correction:
  // the difference of the two, blurred over the pixels outside the hole only (normalised), added to the model's
  const soft = await grown(16, 5);
  const sq = await sharp(raw).resize(S, S).removeAlpha().raw().toBuffer();
  const orig = await sharp(`${COVER}/wide-seedream-5-pro.png`).extract({ left: X0, top: 0, width: S, height: S }).removeAlpha().raw().toBuffer();
  const outside = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) outside[y * S + x] = soft[y * W + X0 + x] < 8 ? 1 : 0;
  const wsum = boxBlur(Float32Array.from(outside), S, S, 18);
  const fix = [0, 1, 2].map((c) => {
    const d = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) d[i] = outside[i] * (orig[i * 3 + c] - sq[i * 3 + c]);
    return boxBlur(d, S, S, 18).map((v, i) => (wsum[i] > 1e-3 ? v / wsum[i] : 0));
  });
  const px = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.max(0, Math.min(255, Math.round(sq[i * 3 + c] + fix[c][i])));
    px[i * 4 + 3] = soft[y * W + X0 + x];
  }
  const patch = await sharp(px, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer();
  await sharp(`${COVER}/wide-seedream-5-pro.png`).composite([{ input: patch, left: X0, top: 0 }]).png().toFile(`${OUT}/filled.png`);
  // the soft hole as its own mask (white = filled in), for the page's reveal
  await sharp(soft, { raw: { width: W, height: H, channels: 1 } }).png().toFile(`${OUT}/hole-mask.png`);
  console.log('wrote', `${OUT}/filled.png`);
}

if (what === 'back') {
  // the figure on paper (its mask spans x 664 to 1008), scaled to 1024 px high, about centred in a square
  const cut = await sharp(`${COVER}/wide-seedream-5-pro-cut.png`).extract({ left: 600, top: 0, width: 424, height: 512 }).resize(848, 1024).png().toBuffer();
  const ref = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#e6e4df' } })
    .composite([{ input: cut, left: 88, top: 0 }]).png().toBuffer();
  const refFile = `${OUT}/back-ref.png`;
  if (!existsSync(refFile)) writeFileSync(refFile, ref);
  const PROMPT = variant === 'full'
    ? 'The same woman in the same costume, seen from directly behind, full figure, same light, plain background.'
    : 'The same woman in the same costume, seen from directly behind, same framing as this picture (the bottom edge cuts the skirt), same size and place in the frame, same light, plain light grey background.';
  const file = `${OUT}/back-${model}-${variant}.png`;
  if (existsSync(file)) throw new Error(`${file} exists`);
  writeFileSync(file, await call(PROMPT, readFileSync(refFile), '1024x1024'));
  console.log('wrote', file);
}
