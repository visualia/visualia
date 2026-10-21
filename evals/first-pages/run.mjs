// First pages: Estonian briefs × models through the course gateway, each result
// checked in headless Chromium at phone width. See plans/first-pages.md.
// Usage: node run.mjs [model ...]   (keys from ../../.keys.local)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const GATEWAY = process.env.GATEWAY ?? 'https://visualia-gateway.kristjan-jansen.workers.dev';
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : [
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
].join(' ');

const keys = Object.fromEntries(
  readFileSync(new URL('../../.keys.local', import.meta.url), 'utf8')
    .trim().split('\n').map((l) => l.split('=')),
);
const briefs = JSON.parse(readFileSync(new URL('./briefs.json', import.meta.url), 'utf8'));
const OUT = new URL('./out/', import.meta.url);

const browser = await chromium.launch();
const rows = [];
for (const model of MODELS) {
  const dir = new URL(`${model.split('/').pop()}/`, OUT);
  mkdirSync(dir, { recursive: true });
  for (const b of briefs) {
    const row = { model, brief: b.id, html: false, clean: false, visible: false, fits: false };
    const t0 = Date.now();
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${keys['eka-test-001']}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 8000,
        chat_template_kwargs: { enable_thinking: false },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: b.brief }],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      row.error = (data.detail ?? data.error ?? `HTTP ${res.status}`).slice(0, 120);
      row.seconds = (Date.now() - t0) / 1000;
      rows.push(row); log(row); continue;
    }
    const { text, usage, firstToken } = await readStream(res, t0);
    row.seconds = (Date.now() - t0) / 1000;
    row.first_token_s = firstToken == null ? null : firstToken / 1000;
    row.tokens_in = usage?.prompt_tokens; row.tokens_out = usage?.completion_tokens;
    const html = extractHtml(text);
    writeFileSync(new URL(`${b.id}.txt`, dir), text);
    if (!html) { row.error = 'no html document in answer'; rows.push(row); log(row); continue; }
    row.html = true;
    const file = new URL(`${b.id}.html`, dir);
    writeFileSync(file, html);
    Object.assign(row, await check(file, new URL(`${b.id}.png`, dir)));
    rows.push(row); log(row);
  }
}
await browser.close();

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
  console.log(`${r.model.split('/').pop().padEnd(28)} ${r.brief.padEnd(12)} ${String(r.seconds).padStart(6)}s  first ${r.first_token_s ?? '-'}s  out ${r.tokens_out ?? '-'}  ${marks}${r.error ? '  ' + r.error : ''}${r.errors?.length ? '  ' + r.errors[0] : ''}`);
}

function summary(rows) {
  const by = {};
  for (const r of rows) (by[r.model] ??= []).push(r);
  const lines = ['| model | pass | html | clean | visible | fits | tokens out (avg) | s (avg) |', '|---|---|---|---|---|---|---|---|'];
  for (const [m, rs] of Object.entries(by)) {
    const c = (k) => rs.filter((r) => r[k]).length;
    const avg = (k) => Math.round(rs.reduce((a, r) => a + (r[k] ?? 0), 0) / rs.length);
    lines.push(`| ${m} | ${c('pass')}/${rs.length} | ${c('html')} | ${c('clean')} | ${c('visible')} | ${c('fits')} | ${avg('tokens_out')} | ${avg('seconds')} |`);
  }
  return lines.join('\n');
}
