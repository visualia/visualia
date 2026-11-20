import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const HEADED = !!process.env.HEADED, DPR = Number(process.env.DPR ?? 2), URL_ = process.env.URL ?? 'http://127.0.0.1:8123/drift-room/ai-estonia.html?v=jank';
const PRESSES = Number(process.env.PRESSES ?? 16), GAP = Number(process.env.GAP ?? 5600);
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
await ctx.addInitScript({ content: readFileSync(new URL('./instr.js', import.meta.url), 'utf8') });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(URL_);
await page.waitForFunction(() => window.aiEstonia?.started?.(), null, { timeout: 60000 });
const info = await page.evaluate(() => ({ dpr: devicePixelRatio, w: document.getElementById('pics').width, h: document.getElementById('pics').height }));
console.log('canvas', info);
await page.evaluate(() => { window.__m.phase = 'intro'; });
await page.waitForTimeout(7000);
for (let i = 1; i <= PRESSES; i++) {
  await page.evaluate((i) => { window.__m.phase = `press${String(i).padStart(2, '0')}`; }, i);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(GAP);
}
await page.evaluate(() => { window.__m.phase = 'still'; });
await page.waitForTimeout(3000);
const M = await page.evaluate(() => ({ frames: window.__m.frames, long: window.__m.long, heap: performance.memory?.usedJSHeapSize }));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const by = {};
for (const f of M.frames) (by[f.phase] ??= []).push(f);
const rows = [];
for (const [ph, fs] of Object.entries(by)) {
  const dt = fs.map((f) => f.dt).filter((x) => x > 0);
  const L = M.long.filter((l) => l.phase === ph);
  rows.push({ ph, n: dt.length, p50: pct(dt, .5), p95: pct(dt, .95), max: pct(dt, 1), over33: dt.filter((x) => x > 33).length,
    js95: pct(fs.map((f) => f.rafjs || 0), .95), jsMax: pct(fs.map((f) => f.rafjs || 0), 1), stroke95: pct(fs.map((f) => f.stroke || 0), .95), strokeMax: pct(fs.map((f) => f.stroke || 0), 1), texMax: pct(fs.map((f) => f.tex || 0), 1), tex95: pct(fs.map((f) => f.tex || 0), .95),
    longN: L.length, longMax: L.length ? Math.round(Math.max(...L.map((l) => l.d))) : 0 });
}
console.table(rows);
// the worst frames, with their cost breakdown and offset into the phase
const worst = [...M.frames].sort((a, b) => b.dt - a.dt).slice(0, 12).map((f) => ({ phase: f.phase, dt: +f.dt.toFixed(1), js: +(f.rafjs || 0).toFixed(1), stroke: +(f.stroke || 0).toFixed(1), tex: +(f.tex || 0).toFixed(1) }));
console.table(worst);
writeFileSync(new URL(`./map-${HEADED ? 'headed' : 'headless'}-dpr${DPR}.json`, import.meta.url), JSON.stringify({ info, rows, worst, long: M.long }, null, 1));
await browser.close();
