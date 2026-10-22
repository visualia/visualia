// First pages: Estonian briefs × models through the course gateway, each result
// checked in headless Chromium at phone width. See plans/first-pages.md.
// Usage: node run.mjs [--instructions | --instructions-file <path>] [--tag <name>] [model ...]
//   (keys from ../../.keys.local)
//   --instructions             add schools/eka/instructions.md to the system prompt
//   --instructions-file <path> add another instructions file instead (path from the cwd);
//                              results go to out/<file name without .md>/
//   --tag <name>               results go to out/<name>/ instead (e.g. a second run)
//   --local <ollama base url>  call Ollama's OpenAI endpoint directly (models are Ollama tags,
//                              e.g. gemma4:26b), thinking off, energy from macmon
//                              (apps/pool/meter.mjs); a minute's pause and the GPU under
//                              60 °C before each page, stops above 85 °C

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { meter } from '../../apps/pool/meter.mjs';

const GATEWAY = process.env.GATEWAY ?? 'https://gw.visualia.space';
const args = process.argv.slice(2);
const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const FILE = valueOf('--instructions-file');
const LOCAL = valueOf('--local')?.replace(/\/$/, '');
const power = LOCAL ? meter() : null;
const INSTRUCTIONS = FILE
  ? readFileSync(FILE, 'utf8')
  : args.includes('--instructions')
    ? readFileSync(new URL('../../schools/eka/instructions.md', import.meta.url), 'utf8')
    : null;
const picked = args.filter((a, i) => !a.startsWith('--') && !['--instructions-file', '--tag', '--local'].includes(args[i - 1]));
const MODELS = picked.length ? picked : [
  '@cf/qwen/qwen3.8-27b',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/openai/gpt-oss-120b',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
];
const SYSTEM = [
  'You make one web page from a brief written in Estonian.',
  'Answer with exactly one complete HTML document in a single ```html code block, nothing else.',
  'Everything inline in that one file. Load libraries only from https://cdnjs.cloudflare.com with an exact version.',
  'It must work on a 375 px wide phone screen without horizontal scrolling.',
  'Any visible text is in Estonian.',
].join(' ') + (INSTRUCTIONS ? '\n\n' + INSTRUCTIONS : '');
const TAG = valueOf('--tag') ?? (FILE ? FILE.split('/').pop().replace(/\.md$/, '') : INSTRUCTIONS ? 'instructions' : 'plain');

const keys = Object.fromEntries(
  readFileSync(new URL('../../.keys.local', import.meta.url), 'utf8')
    .trim().split('\n').map((l) => l.split('=')),
);
const briefs = JSON.parse(readFileSync(new URL('./briefs.json', import.meta.url), 'utf8'));
const OUT = new URL(`./out/${TAG}/`, import.meta.url);

// Locally, Chromium runs only between pages, never beside the model.
let browser = LOCAL ? null : await chromium.launch();
const rows = [];
for (const model of MODELS) {
  // folder per model: 'm1-1/qwen3.5:9b' -> 'm1-1_qwen3.5_9b' (a ':' would read as a URL scheme)
  const dir = new URL(`./${(LOCAL ? `local/${model}` : model).replace(/^@cf\/[^/]+\//, '').replace(/[/:]/g, '_')}/`, OUT);
  mkdirSync(dir, { recursive: true });
  if (LOCAL) { // load the model and cache the instructions, outside the measurement
    await fetch(`${LOCAL}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1, think: false, reasoning_effort: 'none', messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: 'Tere' }] }) });
  }
  for (const b of briefs) {
    const row = { prompt: TAG, model, brief: b.id, html: false, clean: false, visible: false, fits: false };
    if (power) await power.cool();
    const t0 = Date.now();
    const job = power?.start();
    const hot = new AbortController();
    const watch = power && setInterval(() => power.gpuC() > 85 && hot.abort(new Error('GPU over 85 °C')), 1000);
    const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: b.brief }];
    const res = await fetch(LOCAL ? `${LOCAL}/v1/chat/completions` : `${GATEWAY}/v1/chat/completions`, {
      method: 'POST',
      signal: hot.signal,
      headers: LOCAL ? { 'content-type': 'application/json' } : { authorization: `Bearer ${keys['eka-test-001']}`, 'content-type': 'application/json' },
      body: JSON.stringify(LOCAL
        ? { model, stream: true, stream_options: { include_usage: true }, max_tokens: 8000, think: false, reasoning_effort: 'none', messages }
        : { model, stream: true, max_tokens: 8000, chat_template_kwargs: { enable_thinking: false }, messages }),
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e.message) }) }));
    if (!res.ok) {
      clearInterval(watch);
      if (job) power.stop(job);
      const data = await res.json().catch(() => ({}));
      row.error = (data.detail ?? data.error ?? `HTTP ${res.status}`).slice(0, 120);
      row.seconds = (Date.now() - t0) / 1000;
      rows.push(row); log(row); continue;
    }
    const { text, usage, firstToken } = await readStream(res, t0).catch((e) => ({ text: '', error: e }));
    clearInterval(watch);
    if (job) {
      const e = power.stop(job);
      Object.assign(row, { energy_j: e?.energy_j, energy_net_j: e?.energy_net_j, sys_energy_j: e?.sys_energy_j, gpu_c: Math.round(power.gpuC()) });
      if (hot.signal.aborted) { console.error(`stopping: GPU at ${row.gpu_c} °C`); rows.push(row); log(row); break; }
    }
    row.seconds = (Date.now() - t0) / 1000;
    row.first_token_s = firstToken == null ? null : firstToken / 1000;
    row.tokens_in = usage?.prompt_tokens; row.tokens_out = usage?.completion_tokens;
    const html = extractHtml(text);
    writeFileSync(new URL(`${b.id}.txt`, dir), text);
    if (!html) { row.error = 'no html document in answer'; rows.push(row); log(row); continue; }
    row.html = true;
    const file = new URL(`${b.id}.html`, dir);
    writeFileSync(file, html);
    if (LOCAL) browser = await chromium.launch();
    Object.assign(row, await check(file, new URL(`${b.id}.png`, dir)));
    if (LOCAL) { await browser.close(); browser = null; }
    rows.push(row); log(row);
  }
  if (LOCAL) await fetch(`${LOCAL}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) }).catch(() => {});
}
await browser?.close();
power?.close();

for (const r of rows) r.pass = r.html && r.clean && r.visible && r.fits;
writeFileSync(new URL('results.json', OUT), JSON.stringify(rows, null, 2));
console.log('\n' + summary(rows));

async function readStream(res, t0) {
  const decoder = new TextDecoder();
  let buffer = '', text = '', usage = null, firstToken = null;
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
      let e; try { e = JSON.parse(line.slice(5)); } catch { continue; }
      const piece = e.choices?.[0]?.delta?.content ?? e.response ?? '';
      if (piece && firstToken == null) firstToken = Date.now() - t0;
      text += piece;
      if (e.usage) usage = e.usage;
    }
  }
  return { text, usage, firstToken };
}

function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  return /<html[\s>]/i.test(body) && /<\/html>/i.test(body) ? body : null;
}

async function check(fileUrl, shotUrl) {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  try {
    await page.goto(fileUrl.href, { waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    errors.push(`load: ${e.message}`);
  }
  await page.waitForTimeout(3000);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth).catch(() => 9999);
  const shot = await page.screenshot({ type: 'png' });
  writeFileSync(shotUrl, shot);
  const colours = await distinctColours(shot);
  await page.close();
  return {
    clean: errors.length === 0,
    visible: colours >= 12,
    fits: scrollW <= 376,
    colours, scrollW,
    errors: errors.slice(0, 3).map((e) => e.slice(0, 140)),
  };
}

// Decode the screenshot in the browser itself and count coarse colours.
async function distinctColours(png) {
  const page = await browser.newPage();
  const n = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 16) seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return seen.size;
  }, png.toString('base64'));
  await page.close();
  return n;
}

function log(r) {
  const marks = ['html', 'clean', 'visible', 'fits'].map((k) => (r[k] ? k : `-${k}`)).join(' ');
  console.log(`${r.model.split('/').pop().padEnd(28)} ${r.brief.padEnd(12)} ${String(r.seconds).padStart(6)}s  first ${r.first_token_s ?? '-'}s  out ${r.tokens_out ?? '-'}  ${marks}${r.energy_j != null ? `  ${r.energy_j} J (net ${r.energy_net_j}, system ${r.sys_energy_j}) ${r.gpu_c} °C` : ''}${r.error ? '  ' + r.error : ''}${r.errors?.length ? '  ' + r.errors[0] : ''}`);
}

function summary(rows) {
  const by = {};
  for (const r of rows) (by[r.model] ??= []).push(r);
  const lines = ['| model | pass | html | clean | visible | fits | tokens out (avg) | s (avg) | Wh net / system (avg) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [m, rs] of Object.entries(by)) {
    const c = (k) => rs.filter((r) => r[k]).length;
    const avg = (k) => Math.round(rs.reduce((a, r) => a + (r[k] ?? 0), 0) / rs.length);
    const wh = (k) => (rs.reduce((a, r) => a + (r[k] ?? 0), 0) / rs.length / 3600).toFixed(2);
    const energy = rs.some((r) => r.energy_j != null) ? `${wh('energy_net_j')} / ${wh('sys_energy_j')}` : '';
    lines.push(`| ${m} | ${c('pass')}/${rs.length} | ${c('html')} | ${c('clean')} | ${c('visible')} | ${c('fits')} | ${avg('tokens_out')} | ${avg('seconds')} | ${energy} |`);
  }
  return lines.join('\n');
}
