import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Same-origin media proxy (plans/image-proxy.md): `GET <path>?url=…` fetches
 * server-side and streams back, so image/video nodes from arbitrary hosts
 * texture in GL mode (WebGL refuses cross-origin pixels unless the host sends
 * CORS headers; same-origin is never tainted). Pair with `proxyResolver()`
 * from `@visualia/engine` on the media kinds — the doc keeps canonical URLs,
 * only render-time loads are rewritten.
 *
 * Redirects are followed manually so every hop passes the private-host check,
 * keeping the middleware safe to lift into a hosted variant.
 */
export function mediaProxy(path = '/proxy'): Plugin {
  return {
    name: 'visualia-media-proxy',
    configureServer(server) {
      server.middlewares.use(path, (req, res) => void proxy(req, res));
    },
  };
}

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function blockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local') ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) || /^169\.254\./.test(h) ||
    /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h)
  );
}

function deny(res: ServerResponse, code: number, msg: string): void {
  res.statusCode = code;
  res.end(msg);
}

async function proxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const target = new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? '';
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return deny(res, 400, 'invalid url');
  }

  try {
    let upstream: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!/^https?:$/.test(url.protocol) || blockedHost(url.hostname)) {
        return deny(res, 400, 'blocked host');
      }
      upstream = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (visualia media proxy)' },
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        const loc = upstream.headers.get('location');
        if (!loc) return deny(res, 502, 'redirect without location');
        url = new URL(loc, url);
        continue;
      }
      break;
    }
    if (!upstream || !upstream.ok || !upstream.body) {
      return deny(res, upstream?.status || 502, `upstream ${upstream?.status ?? 'error'}`);
    }
    if (Number(upstream.headers.get('content-length') ?? 0) > MAX_BYTES) {
      return deny(res, 413, 'too large');
    }

    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/octet-stream');
    res.setHeader('cache-control', 'public, max-age=86400');
    const reader = upstream.body.getReader();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        res.destroy();
        void reader.cancel();
        return;
      }
      res.write(value);
    }
    res.end();
  } catch {
    if (!res.headersSent) deny(res, 502, 'fetch failed');
    else res.destroy();
  }
}
