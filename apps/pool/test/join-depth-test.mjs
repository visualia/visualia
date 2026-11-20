// node apps/pool/test/join-depth-test.mjs [--headed]
//
// The pool page (public/join.html) as a depth worker, in Chrome, with the pool
// itself played by this script: Playwright answers the page's requests (the
// page, /me, the model list, the model file) and its WebSocket to /connect.
// The page's own code runs: it loads ONNX Runtime from the CDN under the pool's
// Content Security Policy (read from src/index.js), checks the model file's
// SHA-256, says hello with the depth model, takes a job and sends a depth map
// back. The map is compared with the one transformers.js made for the talk.
// Needs the model file and the pictures (git-ignored research outputs) and the
// network (the CDN).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { MODELS } from '../src/models.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pub = `${root}apps/pool/public/`;
const MODEL = process.env.DEPTH_MODEL ?? `${root}evals/estonian-visuals/out/neighbours/models/onnx-community/depth-anything-v2-small/onnx/model_quantized.onnx`;
const PICTURE = `${root}evals/estonian-visuals/out/drift-room/land/nano-banana-2-lite/bog.png`;
const ORIGIN = 'https://pool.visualia.space';
if (!existsSync(MODEL) || !existsSync(PICTURE)) {
  console.log('join-depth-test: skipped (model or picture not here)');
  process.exit(0);
}
const entry = MODELS.find((m) => m.depth);
const src = readFileSync(`${root}apps/pool/src/index.js`, 'utf8');
const CSP = [...src.match(/const CSP = \[([\s\S]*?)\]\.join/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).join('; ');

// What the pool would serve: the page with its CSP, the files from public/, the
// copies the build makes (text.js, the style sheets), and the app routes.
const files = {
  '/join': [`${pub}join.html`, 'text/html'],
  '/text.js': [`${root}packages/text/text.js`, 'text/javascript'],
  '/visualia.css': [`${root}packages/style/visualia.css`, 'text/css'],
  '/pool.css': [`${root}packages/style/pool.css`, 'text/css'],
};
const type = (p) => (p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : p.endsWith('.css') ? 'text/css' : 'application/octet-stream');

const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.route(`${ORIGIN}/**`, (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/me') return route.fulfill({ json: { person: 'test-person', school: 'test' } });
  if (path === '/app/models') return route.fulfill({ json: { models: MODELS } });
  if (path === `/app/files/${entry.file}`) return route.fulfill({ body: readFileSync(MODEL), contentType: 'application/octet-stream' });
  const [file, ct] = files[path] ?? [`${pub}${path.slice(1)}`, type(path)];
  if (!existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
  const headers = path === '/join' ? { 'content-security-policy': CSP } : {};
  return route.fulfill({ body: readFileSync(file), contentType: ct, headers });
});

// The pool's side of the socket: welcome after hello, then one depth job.
const image = readFileSync(PICTURE).toString('base64');
let hello = null;
let answer, fail;
const done = new Promise((resolve, reject) => { answer = resolve; fail = reject; });
await page.routeWebSocket(/\/connect$/, (ws) => {
  ws.onMessage((data) => {
    if (data === 'ping') return ws.send('pong');
    const m = JSON.parse(data);
    if (m.type === 'hello') {
      hello = m;
      ws.send(JSON.stringify({ type: 'welcome', person: 'test-person', workers: 1 }));
      ws.send(JSON.stringify({ type: 'job', id: 'job-1', kind: 'depth', model: entry.name, image }));
    } else if (m.type === 'done' && m.id === 'job-1') answer(m);
    else if (m.type === 'error') fail(new Error(`worker error: ${m.message}`));
  });
});

await page.goto(`${ORIGIN}/join`);
await page.waitForSelector('#share:not([hidden])');
assert.equal(await page.isDisabled('#toggle'), false, 'the page can join (WebGPU there)');
await page.check('#m-none');
await page.uncheck('#upscale');
await page.check('#depth');
const t0 = Date.now();
await page.click('#toggle');
const m = await Promise.race([done, new Promise((_, no) => setTimeout(() => no(new Error(`no answer in 120 s; errors: ${errors.join(' | ')}`)), 120_000))]);
const seconds = (Date.now() - t0) / 1000;

assert.deepEqual(hello.models, [entry.name], 'hello offers the depth model only');
assert.equal(m.width, 1024);
assert.equal(m.height, 1024);
const ours = await sharp(Buffer.from(m.image, 'base64')).resize(384, 384, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
const ref = await sharp(PICTURE.replace(/\.png$/, '-depth.png')).greyscale().raw().toBuffer();
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const [ma, mb] = [mean(ours), mean(ref)];
let ab = 0, aa = 0, bb = 0;
for (let i = 0; i < ours.length; i++) { const x = ours[i] - ma, y = ref[i] - mb; ab += x * y; aa += x * x; bb += y * y; }
const r = ab / Math.sqrt(aa * bb);
const row = await page.textContent('#job-rows tr td:nth-child(3)');
console.log(`join-depth-test: joined and answered in ${seconds.toFixed(1)} s (model download from the stand-in included), ${Math.round(m.image.length / 1024)} KB base64, r = ${r.toFixed(4)}, row "${row}"`);
assert.ok(r > 0.99, `the tab's map follows the transformers.js map (r = ${r})`);
assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), [], 'no page errors');
await browser.close();
console.log('join-depth-test: pass');
