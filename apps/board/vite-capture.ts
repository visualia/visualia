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
const MAX_H = 12_000; // tall pages are capped here
// the units worth cropping to — not every DOM node
const RECT_SEL =
  'img, video, picture, svg, canvas, section, figure, header, footer, nav, article, aside, ' +
  'h1, h2, h3, [class*="card"], [class*="hero"], [class*="banner"]';

interface FinalMeta {
  img: string;
  w: number;
  h: number;
  title: string;
  sourceUrl: string;
  rects: { id: string; tag: string; rect: [number, number, number, number]; text: string }[];
}

// in-flight screenshot jobs: id → the eventual final meta. Lets /capture's
// follow-up call and /capture-img wait for the same render instead of redoing it.
const jobs = new Map<string, Promise<FinalMeta>>();

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
  const sendJson = (data: unknown): void => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // already rendered → final meta straight from disk
  if (existsSync(file) && existsSync(metaFile)) return sendJson(JSON.parse(await readFile(metaFile, 'utf8')));
  // a render is already in flight (e.g. the client's follow-up call) → join it
  const running = jobs.get(id);
  if (running) {
    try {
      return sendJson(await running);
    } catch (err) {
      return fail(res, 502, `capture failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Stage 1: navigate just far enough to measure the page, respond with the
  // dimensions so the board can show a correctly-sized box immediately.
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage({ viewport: { width: VIEWPORT_W, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    const quick = await page.evaluate(
      (cap) => ({ h: Math.min(document.documentElement.scrollHeight, cap), title: document.title }),
      MAX_H,
    );
    sendJson({ id, img: `/capture-img/${id}.png`, w: VIEWPORT_W, h: quick.h, title: quick.title, sourceUrl: url.href, pending: true });
  } catch (err) {
    await page?.close().catch(() => {});
    return fail(res, 502, `capture failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Stage 2 (background, same page): settle, capture the full screenshot + the
  // final element rects, write both to disk. /capture-img and any follow-up
  // /capture await this job.
  const job = (async (): Promise<FinalMeta> => {
    try {
      await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT }).catch(() => {});
      await page.waitForTimeout(400); // fonts / lazy bits
      const dims = await page.evaluate(
        (cap) => ({ h: Math.min(document.documentElement.scrollHeight, cap), title: document.title }),
        MAX_H,
      );
      const rects = await page.evaluate(
        ([sel, cap]) => {
          const out: { id: string; tag: string; rect: [number, number, number, number]; text: string }[] = [];
          let n = 0;
          for (const el of Array.from(document.querySelectorAll(sel as string))) {
            const r = el.getBoundingClientRect();
            if (r.width < 24 || r.height < 24) continue;
            const x = Math.round(r.x + window.scrollX);
            const y = Math.round(r.y + window.scrollY);
            if (y > (cap as number)) continue;
            out.push({
              id: `e${n++}`,
              tag: el.tagName.toLowerCase(),
              rect: [x, y, Math.round(r.width), Math.round(r.height)],
              text: (el.getAttribute('alt') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            });
          }
          return out;
        },
        [RECT_SEL, MAX_H] as [string, number],
      );
      const png = await page.screenshot({ fullPage: true, type: 'png' });
      await mkdir(dir, { recursive: true });
      await writeFile(file, png);
      const meta: FinalMeta = { img: `/capture-img/${id}.png`, w: VIEWPORT_W, h: dims.h, title: dims.title, sourceUrl: url.href, rects };
      await writeFile(metaFile, JSON.stringify(meta));
      return meta;
    } finally {
      await page.close().catch(() => {});
    }
  })();
  jobs.set(id, job);
  void job.catch(() => {}).finally(() => jobs.delete(id));
}

async function serveImg(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const name = (req.url ?? '').replace(/^\//, '').replace(/\?.*$/, '');
  if (!/^[a-f0-9]{16}\.png$/.test(name)) return fail(res, 400, 'bad name');
  const file = path.join(dir, name);
  // hold the request until the in-flight screenshot finishes (the board's <img>
  // load resolves the moment the render is ready — no polling)
  if (!existsSync(file)) {
    const job = jobs.get(name.replace(/\.png$/, ''));
    if (job) await job.catch(() => {});
  }
  if (!existsSync(file)) return fail(res, 404, 'not found');
  res.setHeader('content-type', 'image/png');
  res.setHeader('cache-control', 'public, max-age=86400');
  res.end(await readFile(file));
}
