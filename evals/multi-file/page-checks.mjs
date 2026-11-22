// The four first-pages checks (html is static, in tasks.mjs; clean, visible, fits
// here) for a folder of files, served over HTTP so module scripts and relative links
// load. check() and distinctColours() are evals/first-pages/run.mjs's, keep them in step.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.txt': 'text/plain' };

// seen[page] = { clean, visible, fits, colours, scrollW, errors, responses, text, h1 }
export async function checkPages(dirUrl, pages, shotPrefixUrl) {
  const { chromium } = await import('playwright');
  const root = fileURLToPath(dirUrl);
  const server = await serve(root);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const seen = {};
  try {
    for (const p of pages) seen[p] = await check(browser, new URL(p, base).href, new URL(`${shotPrefixUrl.href}-${p.replace(/\//g, '_')}.png`));
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  return seen;
}

async function check(browser, href, shotUrl) {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors = [];
  const responses = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  page.on('response', (r) => { if (!r.url().startsWith('http://127.0.0.1')) responses.push({ url: r.url(), status: r.status() }); });
  try {
    await page.goto(href, { waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    errors.push(`load: ${e.message}`);
  }
  await page.waitForTimeout(3000);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth).catch(() => 9999);
  const probe = await page.evaluate(readPage).catch(() => ({ text: '', h1: [] }));
  const shot = await page.screenshot({ type: 'png' });
  await writeFile(shotUrl, shot);
  const colours = await distinctColours(browser, shot);
  await page.close();
  return {
    clean: errors.length === 0,
    visible: colours >= 12,
    fits: scrollW <= 376,
    colours, scrollW,
    errors: errors.slice(0, 3).map((e) => e.slice(0, 140)),
    responses, ...probe,
  };
}

// In the page: its text without script or style (CSS text-transform does not apply),
// and each h1's computed colour as sRGB, read back through a canvas so any colour syntax works.
function readPage() {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const parts = [];
  const walk = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) if (!skip.has(n.parentElement?.tagName)) parts.push(n.data);
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const h1 = [...document.querySelectorAll('h1')].map((h) => {
    g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = getComputedStyle(h).color; g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  return { text: parts.join(' ').replace(/\s+/g, ' ').trim(), h1 };
}

// Decode the screenshot in the browser itself and count coarse colours.
async function distinctColours(browser, png) {
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

// A static server on a free port, only the project folder, no directory listings.
function serve(root) {
  const server = createServer(async (req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(path.endsWith(sep) ? join(path, 'index.html') : path);
      res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(path.endsWith(`${sep}favicon.ico`) ? 204 : 404).end(); // a missing favicon is not the page's error
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}
