import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Folder-import sidecar (plans/import.md). The browser can't hand the agent a
 * filesystem path, but Node can read one: `GET /import?path=<dir>` copies the
 * images under that path into `.data/imports/<hash>.<ext>` and serves them
 * same-origin from `/import-img/…` (so they texture in GL, no proxy). The board
 * then inserts + grids them. Reads are confined to the user's home dir.
 */
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const MAX_FILES = 200;

export function importServer(): Plugin {
  return {
    name: 'board-folder-import',
    configureServer(server) {
      const dir = path.resolve(server.config.root, '.data/imports');
      server.middlewares.use('/import-img', (req, res) => void serveImg(dir, req, res));
      server.middlewares.use('/import', (req, res) => void doImport(dir, req, res));
    },
  };
}

const fail = (res: ServerResponse, code: number, msg: string): void => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: msg }));
};

async function doImport(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = new URL(req.url ?? '', 'http://x').searchParams.get('path') ?? '';
  const home = os.homedir();
  const abs = path.resolve(raw.replace(/^~(?=$|\/)/, home));
  // confine to the home directory — no traversal, no system paths
  if (!abs.startsWith(home + path.sep) && abs !== home) return fail(res, 400, 'path must be under your home directory');

  let st;
  try {
    st = await stat(abs);
  } catch {
    return fail(res, 404, 'path not found');
  }

  const files = st.isDirectory() ? await walkDir(abs) : IMG_EXT.test(abs) ? [abs] : [];
  if (!files.length) return fail(res, 404, 'no images found at that path');

  await mkdir(dir, { recursive: true });
  const images: { name: string; url: string }[] = [];
  for (const f of files.slice(0, MAX_FILES)) {
    try {
      const buf = await readFile(f);
      const ext = (path.extname(f).slice(1) || 'png').toLowerCase();
      const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
      const name = `${hash}.${ext}`;
      const out = path.join(dir, name);
      if (!existsSync(out)) await writeFile(out, buf);
      images.push({ name: path.basename(f), url: `/import-img/${name}` });
    } catch {
      /* skip unreadable file */
    }
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ images, count: images.length, truncated: files.length > MAX_FILES }));
}

/** Recursively list image files under a directory (depth-first, capped). */
async function walkDir(root: string, acc: string[] = []): Promise<string[]> {
  if (acc.length >= MAX_FILES) return acc;
  const ents = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const e of ents) {
    if (acc.length >= MAX_FILES) break;
    if (e.name.startsWith('.')) continue;
    const full = path.join(root, e.name);
    if (e.isDirectory()) await walkDir(full, acc);
    else if (IMG_EXT.test(e.name)) acc.push(full);
  }
  return acc;
}

async function serveImg(dir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const name = (req.url ?? '').replace(/^\//, '').replace(/\?.*$/, '');
  if (!/^[a-f0-9]{16}\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)) return fail(res, 400, 'bad name');
  const file = path.join(dir, name);
  if (!existsSync(file)) return fail(res, 404, 'not found');
  const ext = path.extname(name).slice(1).toLowerCase();
  const type = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  res.setHeader('content-type', type);
  res.setHeader('cache-control', 'public, max-age=86400');
  res.end(await readFile(file));
}
