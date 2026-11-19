// The era ladder: five years of "an Estonian woman (man) in national costume", one model per year.
// For each era the model draws the woman, the man and an empty village; BiRefNet-lite cuts the figures
// out; the figures are put into the same era's village (soft edge, colour pulled toward the village's
// tones, blur matched, a soft shadow); Gemini Flash guesses the country of each composite.
// Usage:
//   node era.mjs draw [era ...]       cloud eras through the gateway (GATEWAY, KEY_PERSON as run.mjs)
//   node era.mjs dalle                DALL·E mini in a Chrome tab (as run.mjs drives it), on this computer
//   node era.mjs import <era> <dir>   woman.png, man.png, background.png made elsewhere (sd.cpp, the pool)
//   node era.mjs paint [era ...]      the era's model repaints the background around each figure (gateway, references)
//   node era.mjs masks <era> <dir>    inpainting masks from the cut-outs, for era-local.sh paint (M1)
//   node era.mjs cut | compose | judge | sheet | all
// Env RMBG: the folder holding rmbg.mjs with its node_modules and rmbg/birefnet_lite.onnx
// (research/triposr/rmbg.mjs; its packages are not in this repo).
// Output out/era/<era>/: woman.png man.png background.png (as drawn), woman-cut.png man-cut.png,
// woman.jpg man.jpg pair.jpg (composites), era.json; out/era/ladder.jpg. Research only, not published.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/era/');
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const PROMPTS = {
  woman: 'An Estonian woman in national costume, full figure, standing.',
  man: 'An Estonian man in national costume, full figure, standing.',
  background: 'An Estonian village landscape, eye level, no people.',
};
// `main`: the era's row on the slides. `how`: gateway (cloud), dalle (a tab here), local (sd.cpp or the pool, imported).
export const ERAS = [
  { id: '2022-dalle-mini', year: 2022, label: 'DALL·E mini', by: 'Boris Dayma, 2022', how: 'dalle', main: true },
  { id: '2022-sd-1.4', year: 2022, label: 'Stable Diffusion 1.4', by: 'CompVis, 2022', how: 'local' },
  { id: '2023-chilloutmix', year: 2023, label: 'ChilloutMix', by: 'SD 1.5 fine-tune, 2023', how: 'local', main: true },
  { id: '2023-sdxl', year: 2023, label: 'SDXL 1.0', by: 'Stability AI, 2023', how: 'gateway', model: 'sdxl' },
  { id: '2024-flux-1-schnell', year: 2024, label: 'FLUX.1 schnell', by: 'Black Forest Labs, 2024', how: 'gateway', model: 'flux-1-schnell', main: true },
  { id: '2025-flux-2-dev', year: 2025, label: 'FLUX.2 dev', by: 'Black Forest Labs, 2025', how: 'gateway', model: 'flux-2-dev', main: true, paint: 'flux-2-pro-preview' },
  { id: '2025-flux-2-klein-4b', year: 2025, label: 'FLUX.2 klein 4B', by: 'Black Forest Labs, 2025', how: 'gateway', model: 'flux-2-klein-4b' },
  { id: '2026-nano-banana-pro', year: 2026, label: 'Nano Banana Pro', by: 'Google, 2025-26', how: 'gateway', model: 'nano-banana-pro', main: true, paint: 'nano-banana-pro' },
  { id: '2026-gpt-image-2', year: 2026, label: 'GPT Image 2', by: 'OpenAI, 2026', how: 'gateway', model: 'gpt-image-2', paint: 'gpt-image-2' },
];
// "Painted": the era's model repaints everything but the person (an edit with the drawn figure as reference).
// FLUX.2 on Workers AI takes no references through the gateway, so 2025 paints with FLUX.2 pro (preview).
// No edit route for FLUX.1 schnell or SDXL there; 2023 paints locally (SD 1.5 inpainting, sd.cpp, imported).
const PAINT = 'Keep the person exactly as they are: the same face, pose, clothes and size in the frame. Replace everything around them with an Estonian village landscape, eye level, no other people. Make the light on the person match the new surroundings.';
const SIZES = { woman: '768x1024', man: '768x1024', background: '1024x768' };
const NEURON_USD = 0.011 / 1000;
const JUDGE = 'google/gemini-3.8-flash';
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>"}`;

const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const dir = (e) => `${OUT}${e.id}/`;
const meta = (e) => readJson(`${dir(e)}era.json`, { era: e.id, year: e.year, model: e.model ?? e.id.replace(/^\d+-/, ''), label: e.label, by: e.by, how: e.how, prompts: PROMPTS, items: {} });
const save = (e, m) => { m.main = !!e.main; mkdirSync(dir(e), { recursive: true }); writeFileSync(`${dir(e)}era.json`, JSON.stringify(m, null, 1)); };

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}
async function post(path, body) {
  const res = await fetch(GATEWAY + path, { method: 'POST', headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.detail ?? data.error ?? data)}`.slice(0, 400));
  return data;
}

// ---- draw ----

async function draw(ids) {
  const eras = ERAS.filter((e) => e.how === 'gateway' && (!ids.length || ids.includes(e.id)));
  await Promise.all(eras.map(async (e) => {
    const m = meta(e);
    for (const what of ['woman', 'man', 'background']) {
      const file = `${dir(e)}${what}.png`;
      if (existsSync(file)) continue;
      let err;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const t0 = Date.now();
        try {
          const data = await post('/v1/images', { prompt: PROMPTS[what], size: SIZES[what], model: e.model });
          mkdirSync(dir(e), { recursive: true });
          await sharp(Buffer.from(data.data[0].b64_json, 'base64')).png().toFile(file);
          const u = data.usage ?? {};
          m.items[what] = { prompt: PROMPTS[what], asked: SIZES[what], size: data.size, seconds: (Date.now() - t0) / 1000, usage: u,
            cost_usd: u.cost_usd ?? (u.neurons != null ? +(u.neurons * NEURON_USD).toFixed(5) : null), attempt };
          save(e, m);
          console.log(`${e.id.padEnd(22)} ${what.padEnd(10)} ${m.items[what].seconds.toFixed(1)} s`);
          err = null; break;
        } catch (x) { err = x; }
      }
      if (err) { m.items[what] = { prompt: PROMPTS[what], error: err.message }; save(e, m); console.log(`${e.id} ${what} failed: ${err.message}`); }
    }
  }));
}

// DALL·E mini in a Chrome tab, seed 1, 256 x 256 (as run.mjs dalleMini).
async function dalle() {
  const e = ERAS.find((x) => x.how === 'dalle'), m = meta(e);
  const todo = ['woman', 'man', 'background'].filter((w) => !existsSync(`${dir(e)}${w}.png`));
  if (!todo.length) return;
  const app = here('../../apps/pool-app/dalle-mini/');
  const port = await new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: app, stdio: 'ignore' });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
  try {
    const page = await browser.newPage();
    for (let i = 0; i < 20; i++) { try { await page.goto(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 300)); } }
    for (const what of todo) {
      const t0 = Date.now();
      await page.fill('#prompt', PROMPTS[what]);
      await page.fill('#seed', '1');
      await page.click('#go');
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Drawing'), null, { timeout: 180000 });
      await page.waitForFunction(() => /^(Done|Stopped)/.test(document.getElementById('status').textContent), null, { timeout: 300000 });
      const status = await page.textContent('#status');
      if (status.startsWith('Stopped')) { console.log(`dalle-mini ${what} ${status}`); continue; }
      const png = await page.evaluate(() => document.getElementById('out').toDataURL('image/png'));
      mkdirSync(dir(e), { recursive: true });
      writeFileSync(`${dir(e)}${what}.png`, Buffer.from(png.split(',')[1], 'base64'));
      m.items[what] = { prompt: PROMPTS[what], size: '256x256', seconds: (Date.now() - t0) / 1000, seed: 1, cost_usd: 0, where: 'Chrome tab, WebGPU, work Mac' };
      save(e, m);
      console.log(`dalle-mini ${what} ${m.items[what].seconds.toFixed(1)} s`);
    }
  } finally { await browser.close(); server.kill(); }
}

// Pictures made elsewhere: <dir>/{woman,man,background}.png and optional <what>.json ({ seconds, where, ... }).
async function importEra(id, from) {
  const e = ERAS.find((x) => x.id === id), m = meta(e);
  mkdirSync(dir(e), { recursive: true });
  for (const what of ['woman', 'man', 'background', 'woman-painted', 'man-painted']) {
    const f = `${from}/${what}.png`;
    if (!existsSync(f)) continue;
    await sharp(f).png().toFile(`${dir(e)}${what}.png`);
    const info = await sharp(f).metadata();
    m.items[what] = { prompt: PROMPTS[what] ?? PAINT, size: `${info.width}x${info.height}`, cost_usd: 0, ...readJson(`${from}/${what}.json`, {}) };
  }
  save(e, m);
}

// ---- paint: the era's own model repaints the background around the figure ----

async function paint(ids) {
  const eras = ERAS.filter((e) => e.paint && (!ids.length || ids.includes(e.id)));
  await Promise.all(eras.map(async (e) => {
    const m = meta(e);
    for (const what of ['woman', 'man']) {
      const src = `${dir(e)}${what}.png`, file = `${dir(e)}${what}-painted.png`, k = `${what}-painted`;
      if (!existsSync(src) || existsSync(file)) continue;
      let err;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const t0 = Date.now();
        try {
          const ref = (await sharp(src).resize(1024, 1024, { fit: 'inside' }).png().toBuffer()).toString('base64');
          const data = await post('/v1/images', { prompt: PAINT, size: SIZES[what], model: e.paint, references: [ref] });
          await sharp(Buffer.from(data.data[0].b64_json, 'base64')).png().toFile(file);
          const u = data.usage ?? {};
          m.items[k] = { prompt: PAINT, model: e.paint, reference: `${what}.png`, size: data.size, seconds: (Date.now() - t0) / 1000, usage: u, cost_usd: u.cost_usd ?? null, attempt };
          save(e, m);
          console.log(`${e.id.padEnd(22)} ${k.padEnd(14)} ${m.items[k].seconds.toFixed(1)} s`);
          err = null; break;
        } catch (x) { err = x; }
      }
      if (err) { m.items[k] = { prompt: PAINT, model: e.paint, error: err.message }; save(e, m); console.log(`${e.id} ${k} failed: ${err.message}`); }
    }
  }));
}

// ---- cut ----

async function cut() {
  const R = process.env.RMBG;
  if (!R) throw new Error('set RMBG to the folder with rmbg.mjs, its node_modules and rmbg/birefnet_lite.onnx');
  const { readImage, writePNG, createRemover } = await import(`${R}/rmbg.mjs`);
  let rm = null;
  for (const e of ERAS) for (const what of ['woman', 'man']) {
    const src = `${dir(e)}${what}.png`, dst = `${dir(e)}${what}-cut.png`;
    if (!existsSync(src) || existsSync(dst)) continue;
    rm ??= await createRemover({ model: `${R}/rmbg/birefnet_lite.onnx` });
    const t0 = performance.now();
    const r = await rm.remove(readImage(src), { soft: true });
    writePNG(dst, r.W, r.H, r.data);
    const m = meta(e);
    m.items[what] = { ...m.items[what], cut: { model: 'BiRefNet-lite (MIT), soft mask', seconds: +((performance.now() - t0) / 1000).toFixed(2), foregroundShare: r.foregroundShare } };
    save(e, m);
    console.log(`${e.id.padEnd(22)} ${what.padEnd(6)} cut ${m.items[what].cut.seconds} s, foreground ${r.foregroundShare}`);
  }
  rm?.release();
}

// Inpainting masks for a local era (white = repaint): the cut-out's alpha, the figure grown by 1 % of the
// height so its edge is kept, written with the figure into <dir> for era-local.sh paint.
async function masks(id, to) {
  const e = ERAS.find((x) => x.id === id);
  mkdirSync(to, { recursive: true });
  for (const what of ['woman', 'man']) {
    const cutFile = `${dir(e)}${what}-cut.png`;
    if (!existsSync(cutFile)) continue;
    const { data, info } = await sharp(cutFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    let a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3] > 100 ? 1 : 0;
    a = await gaussian(a, w, h, Math.max(2, h / 100));
    const m = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) m[i] = a[i] > 0.08 ? 0 : 255;
    await sharp(m, { raw: { width: w, height: h, channels: 1 } }).png().toFile(`${to}/${what}-mask.png`);
    await sharp(`${dir(e)}${what}.png`).png().toFile(`${to}/${what}.png`);
  }
}

// ---- compose ----

const W = 1024, H = 768;
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// Mean absolute Laplacian of luminance over the pixels where `mask` (0..1) is high: how sharp it looks.
function sharpness(rgb, w, h, ch, mask = null) {
  let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (mask && mask[i] < 0.98) continue;
    const L = (j) => lum(rgb[j * ch], rgb[j * ch + 1], rgb[j * ch + 2]);
    s += Math.abs(4 * L(i) - L(i - 1) - L(i + 1) - L(i - w) - L(i + w)); n++;
  }
  return n ? s / n : 0;
}
async function gaussian(plane, w, h, sigma) { // one float plane 0..1, blurred
  if (sigma < 0.3) return plane;
  const buf = Buffer.from(plane.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)));
  const out = await sharp(buf, { raw: { width: w, height: h, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
  return Float32Array.from(out, (v) => v / 255);
}

// One figure, ready to place: cropped to its alpha, scaled to height `fh`, colour pulled toward the
// background's mean (gain per channel, a third of the way), blurred to the background's sharpness,
// alpha feathered. Returns { w, h, rgb (Float32, 0..255), a (0..1) }.
async function prepare(cutFile, fh, bgMean, bgSharp) {
  const { data, info } = await sharp(cutFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) throw new Error(`${cutFile}: nothing cut out`);
  // a figure cut off by the frame's bottom (no feet) is shown from the knees or waist up: smaller, running out of the picture
  const cropped = y1 >= info.height * 0.98;
  if (cropped) fh = Math.round(fh * 0.62);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = fh / bh;
  const w = Math.max(1, Math.round(bw * s)), h = fh;
  const px = await sharp(cutFile).ensureAlpha().extract({ left: x0, top: y0, width: bw, height: bh }).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  let a = new Float32Array(w * h), rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { a[i] = px[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) rgb[i * 3 + c] = px[i * 4 + c]; }
  // colour: alpha-weighted mean of the figure against the background's
  const fm = [0, 0, 0]; let fw = 0;
  for (let i = 0; i < w * h; i++) { for (let c = 0; c < 3; c++) fm[c] += rgb[i * 3 + c] * a[i]; fw += a[i]; }
  const gain = fm.map((v, c) => Math.max(0.75, Math.min(1.33, (bgMean[c] / Math.max(1, v / fw)) ** 0.33)));
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.min(255, rgb[i * 3 + c] * gain[c] * 0.92 + bgMean[c] * 0.08);
  // blur: the smallest sigma that brings the figure's inside to the background's sharpness
  let sigma = 0;
  for (const sg of [0, 0.5, 0.8, 1.2, 1.6, 2.2, 3]) {
    const b = sg ? await sharp(Buffer.from(rgb.map((v) => Math.round(v))), { raw: { width: w, height: h, channels: 3 } }).blur(sg).raw().toBuffer() : rgb;
    sigma = sg;
    if (sharpness(b, w, h, 3, a) <= bgSharp * 1.1) { rgb = Float32Array.from(b); break; }
    if (sg === 3) rgb = Float32Array.from(b);
  }
  // feather: blur the alpha a little more than the picture, then pull the edge in so no halo shows
  const fa = await gaussian(a, w, h, Math.max(1, sigma * 1.5, h / 500));
  a = fa.map((v) => Math.max(0, Math.min(1, (v - 0.12) / 0.8)));
  return { w, h, rgb, a, gain: gain.map((g) => +g.toFixed(3)), sigma, cropped };
}

// Put figures on a background. figs: [{ cut, cx (0..1), feet (0..1), height (0..1) }].
async function compose(bgFile, figs, outFile) {
  const bgRaw = await sharp(bgFile).resize(W, H, { fit: 'cover' }).removeAlpha().raw().toBuffer();
  const bg = Float32Array.from(bgRaw);
  const bgMean = [0, 0, 0];
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) bgMean[c] += bg[i * 3 + c] / (W * H);
  const bgSharp = sharpness(bg, W, H, 3);
  const placed = [];
  for (const f of figs) {
    const p = await prepare(f.cut, Math.round(f.height * H), bgMean, bgSharp);
    const left = Math.round(f.cx * W - p.w / 2), top = p.cropped ? H - p.h : Math.round(f.feet * H - p.h);
    placed.push({ ...p, left, top });
  }
  // shadow: each figure's alpha laid on the ground behind it (height h above the feet goes up 0.14 h and right 0.35 h), plus a contact blob
  let sh = new Float32Array(W * H);
  for (const p of placed.filter((q) => !q.cropped)) {
    const feet = p.top + p.h;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const a = p.a[y * p.w + x]; if (a < 0.3) continue;
      const hgt = p.h - y, sx = Math.round(p.left + x + hgt * 0.35), sy = Math.round(feet - hgt * 0.14);
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) sh[sy * W + sx] = Math.max(sh[sy * W + sx], 0.55 * (1 - hgt / p.h * 0.6));
    }
    const cx = p.left + p.w / 2, rx = p.w * 0.42, ry = Math.max(4, p.h * 0.025);
    for (let y = Math.max(0, Math.floor(feet - ry * 3)); y < Math.min(H, feet + ry * 3); y++) for (let x = Math.max(0, Math.floor(cx - rx * 2)); x < Math.min(W, cx + rx * 2); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - feet) / ry) ** 2;
      sh[y * W + x] = Math.max(sh[y * W + x], 0.7 * Math.exp(-d));
    }
  }
  sh = await gaussian(sh, W, H, 7);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) bg[i * 3 + c] *= 1 - 0.55 * sh[i];
  for (const p of placed) for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const X = p.left + x, Y = p.top + y; if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
    const a = p.a[y * p.w + x]; if (!a) continue;
    const j = Y * W + X, i = y * p.w + x;
    // light wrap: the soft edge takes a little of the background's colour
    const wrap = 0.35 * a * (1 - a) * 4 * 0.5;
    for (let c = 0; c < 3; c++) { const f = p.rgb[i * 3 + c] * (1 - wrap) + bg[j * 3 + c] * wrap; bg[j * 3 + c] = bg[j * 3 + c] * (1 - a) + f * a; }
  }
  await sharp(Buffer.from(bg.map((v) => Math.round(Math.max(0, Math.min(255, v))))), { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toFile(outFile);
  return { bgSharpness: +bgSharp.toFixed(2), bgMean: bgMean.map(Math.round), figures: placed.map((p) => ({ gain: p.gain, blurSigma: p.sigma, size: `${p.w}x${p.h}`, croppedByFrame: p.cropped })) };
}

async function composeAll() {
  for (const e of ERAS) {
    const d = dir(e);
    if (!existsSync(`${d}background.png`)) continue;
    const m = meta(e); m.compose = m.compose ?? {};
    for (const what of ['woman', 'man']) {
      if (!existsSync(`${d}${what}-cut.png`)) continue;
      m.compose[what] = await compose(`${d}background.png`, [{ cut: `${d}${what}-cut.png`, cx: 0.5, feet: 0.94, height: 0.8 }], `${d}${what}.jpg`);
    }
    if (existsSync(`${d}woman-cut.png`) && existsSync(`${d}man-cut.png`))
      m.compose.pair = await compose(`${d}background.png`, [{ cut: `${d}woman-cut.png`, cx: 0.37, feet: 0.93, height: 0.74 }, { cut: `${d}man-cut.png`, cx: 0.63, feet: 0.95, height: 0.78 }], `${d}pair.jpg`);
    save(e, m);
    console.log(`${e.id} composed`);
  }
}

// ---- judge: the composites, through the gateway ----

async function judge() {
  for (const e of ERAS) {
    const m = meta(e); m.judge = m.judge ?? {};
    for (const what of ['pair', 'woman', 'man', 'background', 'woman-painted', 'man-painted']) {
      const f = /background|painted/.test(what) ? `${dir(e)}${what}.png` : `${dir(e)}${what}.jpg`;
      if (!existsSync(f) || m.judge[what]?.country) continue;
      const jpg = await sharp(f).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      const t0 = Date.now();
      try {
        const data = await post('/v1/chat/completions', { model: JUDGE, max_tokens: 2000, messages: [{ role: 'user', content: [
          { type: 'text', text: QUESTION }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpg.toString('base64')}` } }] }] });
        const text = data.choices?.[0]?.message?.content ?? '';
        const a = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
        m.judge[what] = { judge: JUDGE, ...a, seconds: (Date.now() - t0) / 1000, usage: data.usage ?? null };
        appendFileSync(`${OUT}judge.jsonl`, JSON.stringify({ era: e.id, what, ...m.judge[what] }) + '\n');
        console.log(`${e.id.padEnd(22)} ${what.padEnd(10)} ${a?.country} ${a?.confidence} ${a?.region ?? ''}`);
      } catch (x) { m.judge[what] = { judge: JUDGE, error: x.message }; console.log(`${e.id} ${what} judge failed: ${x.message}`); }
      save(e, m);
    }
  }
}

// ---- sheet: one row per era ----

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function sheet() {
  const CELL = 220, PAD = 10, LABEL = 200;
  const cols = [['woman.png', 'woman, as drawn'], ['woman-cut.png', 'cut out'], ['man.png', 'man, as drawn'], ['man-cut.png', 'cut out'],
    ['background.png', 'village'], ['woman.jpg', 'woman, pasted'], ['man.jpg', 'man, pasted'], ['pair.jpg', 'both, pasted'], ['woman-painted.png', 'woman, painted'], ['man-painted.png', 'man, painted']];
  const rows = ERAS.filter((e) => existsSync(`${dir(e)}era.json`));
  const width = LABEL + cols.length * (CELL + PAD) + PAD, head = 84, height = head + rows.length * (CELL + PAD + 22) + PAD;
  const layers = [];
  const paper = { r: 230, g: 228, b: 223 };
  const checker = await sharp({ create: { width: CELL, height: CELL, channels: 3, background: { r: 200, g: 198, b: 194 } } }).png().toBuffer();
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Helvetica,Arial,sans-serif;fill:#4f4c47}</style>
<text x="${PAD}" y="34" font-size="24">Five years of Estonia: “an Estonian woman (man) in national costume, full figure, standing”</text>
<text x="${PAD}" y="58" font-size="14" fill="#75716b">Background by the same model: “${esc(PROMPTS.background)}” Cut out with BiRefNet-lite; country guess by ${JUDGE} on “both”.</text>`;
  for (const [ci, [, name]] of cols.entries()) svg += `<text x="${LABEL + PAD + ci * (CELL + PAD) + CELL / 2}" y="${head - 2}" font-size="12" text-anchor="middle" fill="#75716b">${name}</text>`;
  for (const [ri, e] of rows.entries()) {
    const m = meta(e), y = head + 6 + ri * (CELL + PAD + 22);
    const cost = Object.values(m.items).reduce((s, it) => s + (it.cost_usd ?? 0), 0), unknown = Object.values(m.items).some((it) => it.cost_usd == null && !it.error);
    const secs = Object.values(m.items).reduce((s, it) => s + (it.seconds ?? 0), 0);
    const j = m.judge?.pair;
    svg += `<text x="${PAD}" y="${y + 30}" font-size="30">${e.year}</text><text x="${PAD}" y="${y + 56}" font-size="16">${esc(e.label)}${e.main ? '' : ' (also)'}</text>
<text x="${PAD}" y="${y + 76}" font-size="12" fill="#75716b">${esc(e.by)}</text>
<text x="${PAD}" y="${y + 100}" font-size="12" fill="#75716b">${secs ? `${Math.round(secs)} s` : ''}${cost || !unknown ? `, $${cost.toFixed(3)}` : ''}${unknown ? ', price not published' : ''}</text>
<text x="${PAD}" y="${y + 130}" font-size="13">Judge: ${j?.country ? esc(j.country) : '–'}${j?.confidence != null ? ` (${j.confidence})` : ''}</text>
<text x="${PAD}" y="${y + 148}" font-size="11" fill="#75716b">${j?.region ? esc(j.region) : ''}</text>
${['woman-painted', 'man-painted'].filter((k) => m.judge?.[k]?.country).map((k, i) => `<text x="${PAD}" y="${y + 190 + i * 14}" font-size="11" fill="#75716b">${k.replace('-', ', ')}: ${esc(m.judge[k].country)} (${m.judge[k].confidence})</text>`).join('')}`;
    const missing = Object.entries(m.items).filter(([k, it]) => it.error && !existsSync(`${dir(e)}${k}.png`)).map(([k, it]) => `${k}${/2021|credits/.test(it.error) ? ' (no credits)' : ''}`);
    if (missing.length) svg += `<text x="${PAD}" y="${y + 170}" font-size="11" fill="#a33">not made: ${esc(missing.join(', '))}</text>`;
    for (const [ci, [f]] of cols.entries()) {
      const file = `${dir(e)}${f}`, x = LABEL + PAD + ci * (CELL + PAD);
      if (!existsSync(file)) continue;
      if (f.endsWith('-cut.png')) layers.push({ input: checker, left: x, top: y });
      layers.push({ input: await sharp(file).resize(CELL, CELL, { fit: 'contain', background: { ...paper, alpha: f.endsWith('-cut.png') ? 0 : 1 } }).png().toBuffer(), left: x, top: y });
    }
    if (j?.reason) svg += `<text x="${LABEL + PAD}" y="${y + CELL + 16}" font-size="11" fill="#75716b">${esc(j.reason).slice(0, 200)}</text>`;
  }
  svg += '</svg>';
  await sharp({ create: { width, height, channels: 3, background: paper } }).composite([...layers, { input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 88 }).toFile(`${OUT}ladder.jpg`);
  // the totals
  let usd = 0, unknown = [];
  for (const e of rows) { const m = meta(e); for (const [k, it] of Object.entries(m.items)) { if (it.cost_usd != null) usd += it.cost_usd; else if (!it.error) unknown.push(`${e.id}/${k}`); } }
  console.log(`ladder.jpg: ${rows.length} rows; priced pictures $${usd.toFixed(3)}; no price: ${unknown.join(', ') || 'none'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  mkdirSync(OUT, { recursive: true });
  if (cmd === 'draw') await draw(rest);
  else if (cmd === 'paint') await paint(rest);
  else if (cmd === 'dalle') await dalle();
  else if (cmd === 'import') await importEra(rest[0], rest[1]);
  else if (cmd === 'cut') await cut();
  else if (cmd === 'masks') await masks(rest[0], rest[1]);
  else if (cmd === 'compose') await composeAll();
  else if (cmd === 'judge') await judge();
  else if (cmd === 'sheet') await sheet();
  else if (cmd === 'all') { await draw([]); await paint([]); await cut(); await composeAll(); await judge(); await sheet(); }
  else console.log('node era.mjs draw [era ...] | dalle | import <era> <dir> | cut | compose | judge | sheet | all');
}
