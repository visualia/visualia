import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Browser } from 'playwright';
import type { Plugin } from 'vite';

/**
 * Website capture sidecar (plans/website.md). `GET /capture?url=…` drives a
 * headless Chromium, takes a full-page screenshot, and returns the PNG (served
 * same-origin from `/capture-img/…`, so it textures in GL without the proxy)
 * plus the **element rect map** that powers click-to-crop. One browser is
 * launched lazily and reused. Captured to `.data/captures/` (disk cache).
 */
export function captureServer(): Plugin {
  return {
    name: 'board-website-capture',
    configureServer(server) {
      const dir = path.resolve(server.config.root, '.data/captures');
      // serve cached pngs — register the more specific prefix first
      server.middlewares.use('/capture-img', (req, res) => void serveImg(dir, req, res));
      server.middlewares.use('/capture', (req, res) => void capture(dir, req, res));
    },
  };
}

const VIEWPORT_W = 1280;
const NAV_TIMEOUT = 25_000;
// (tall pages are capped at 12000px — inlined as a literal inside page.evaluate)
// the units worth cropping to — not every DOM node
const RECT_SEL =
  'img, video, picture, svg, canvas, section, figure, header, footer, nav, article, aside, ' +
  'h1, h2, h3, [class*="card"], [class*="hero"], [class*="banner"]';

let browserP: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!browserP) {
    const { chromium } = await import('playwright');
    browserP = chromium.launch({ headless: true });
  }
  return browserP;
}

function blockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local') ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) || /^169\.254\./.test(h)
  );
}

const fail = (res: ServerResponse, code: number, msg: string): void => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: msg }));
};

async function capture(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const target = new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? '';
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return fail(res, 400, 'invalid url');
  }
  if (!/^https?:$/.test(url.protocol) || blockedHost(url.hostname)) return fail(res, 400, 'blocked host');

  const id = createHash('sha1').update(url.href).digest('hex').slice(0, 16);
  const file = path.join(dir, `${id}.png`);
  const metaFile = path.join(dir, `${id}.json`);

  // serve from cache if present
  if (existsSync(file) && existsSync(metaFile)) {
    res.setHeader('content-type', 'application/json');
    res.end(await readFile(metaFile, 'utf8'));
    return;
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage({ viewport: { width: VIEWPORT_W, height: 900 }, deviceScaleFactor: 1 });
    await page
      .goto(url.href, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT })
      .catch(() => page!.goto(url.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }));
    await page.waitForTimeout(400); // let fonts/lazy bits settle

    const dims = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: Math.min(document.documentElement.scrollHeight, 12_000),
      title: document.title,
    }));
    const rects = await page.evaluate((sel) => {
      const out: { id: string; tag: string; rect: [number, number, number, number]; text: string }[] = [];
      let n = 0;
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) continue;
        const x = Math.round(r.x + window.scrollX);
        const y = Math.round(r.y + window.scrollY);
        if (y > 12_000) continue;
        out.push({
          id: `e${n++}`,
          tag: el.tagName.toLowerCase(),
          rect: [x, y, Math.round(r.width), Math.round(r.height)],
          text: (el.getAttribute('alt') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        });
      }
      return out;
    }, RECT_SEL);

    const png = await page.screenshot({ fullPage: true, type: 'png', clip: undefined });
    await mkdir(dir, { recursive: true });
    await writeFile(file, png);
    const meta = { img: `/capture-img/${id}.png`, w: VIEWPORT_W, h: dims.h, title: dims.title, sourceUrl: url.href, rects };
    await writeFile(metaFile, JSON.stringify(meta));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(meta));
  } catch (err) {
    fail(res, 502, `capture failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await page?.close().catch(() => {});
  }
}

async function serveImg(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const name = (req.url ?? '').replace(/^\//, '').replace(/\?.*$/, '');
  if (!/^[a-f0-9]{16}\.png$/.test(name)) return fail(res, 400, 'bad name');
  const file = path.join(dir, name);
  if (!existsSync(file)) return fail(res, 404, 'not found');
  res.setHeader('content-type', 'image/png');
  res.setHeader('cache-control', 'public, max-age=86400');
  res.end(await readFile(file));
}
