// Screenshots and frame times of the figures' particle change (out/drift-room/figures.html).
// node shot-figures-fx.mjs <outdir> [extra query] [headed]
import { chromium } from 'playwright';
const [out, extra = '', headed] = [process.argv[2], process.argv[3], process.argv[4] === 'headed'];
const b = await chromium.launch({ channel: 'chrome', headless: !headed, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text()));
const url = (q) => `http://127.0.0.1:8123/drift-room/figures.html?test&still&${q}${extra ? '&' + extra : ''}`;
for (const t of (process.env.TS ?? "0,0.3,0.6,1").split(",").map(Number)) {
  await p.goto(url(`t=${(1 + Math.min(t, 0.9999)).toFixed(4)}`));
  await p.waitForFunction(() => window.figures, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/fx-${Math.round(t * 100)}.png` });
  console.log('t', t, await p.evaluate(() => ({ mode: figures.mode, ms: figures.ms.toFixed(1) })));
}
// a live change, orbit on: frame times over the whole change
await p.goto(`http://127.0.0.1:8123/drift-room/figures.html?test&auto=0${extra ? '&' + extra : ''}`);
await p.waitForFunction(() => window.figures, null, { timeout: 90000 });
await p.waitForTimeout(3000);
await p.evaluate(() => { figures.frames.length = 0; figures.record = true; figures.next(); });
await p.waitForTimeout(2000); await p.screenshot({ path: `${out}/fx-live-2s.png` });
await p.waitForTimeout(5500);
const f = await p.evaluate(() => { figures.record = false; return figures.frames.slice(); });
f.sort((x, y) => x - y);
const mean = f.reduce((s, x) => s + x, 0) / f.length;
console.log('live change: frames', f.length, 'mean ms', mean.toFixed(2), 'p50', f[f.length >> 1].toFixed(2), 'p95', f[Math.floor(f.length * 0.95)].toFixed(2), 'max', f[f.length - 1].toFixed(2), 'fps', (1000 / mean).toFixed(1));
console.log('errors', errs.slice(0, 8)); await b.close();
