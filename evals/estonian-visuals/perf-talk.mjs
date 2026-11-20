// Measures talk.html as it runs (asked 2026-11-19: "review talk.html webgl and overall loading approach to be more
// performant"): at every step of a Space walk, the live WebGL contexts in all frames, the main page's frame times and
// the JS heap. Contexts are counted by wrapping getContext in every frame (an init script) and dropping those whose
// canvas has left the document or whose context was lost.
//   node evals/estonian-visuals/perf-talk.mjs [steps]   (default: the whole talk; SETTLE=ms per step, default 5000)
// Needs the local server on 8123. Writes out/perf-talk/<run>.json. Research use only.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PAGE = `http://127.0.0.1:8123/drift-room/${process.env.PAGE ?? 'talk.html'}?keys=0&test=1`;
const SETTLE = Number(process.env.SETTLE ?? 5000), MAX = Number(process.argv[2]) || 400;
const OUT = fileURLToPath(new URL('./out/perf-talk/', import.meta.url)); mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  const all = (window.__glAll ??= []);
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = orig.call(this, type, ...a);
    if (c && /webgl/.test(type) && !all.some((x) => x.c === c)) all.push({ c, canvas: this, type, at: location.pathname.split('/').pop() });
    return c;
  };
  window.__glLive = () => all.filter((x) => x.canvas.isConnected && !x.c.isContextLost()).map((x) => x.at);
  if (window === top) {
    const d = (window.__frames = []); let last = 0;
    const f = (t) => { if (last) d.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  }
});
const page = await ctx.newPage();
const warns = [];
page.on('console', (m) => { if (/Too many active WebGL/.test(m.text())) warns.push(m.text()); });
const live = async () => {
  let n = 0; const by = {};
  for (const f of page.frames()) { try { const l = await f.evaluate(() => window.__glLive?.() ?? []); n += l.length; for (const p of l) by[p] = (by[p] ?? 0) + 1; } catch {} }
  return { n, by };
};
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };

await page.goto(PAGE);
await page.waitForFunction(() => document.body.classList.contains('ready') && (window.talk?.state || window.intro?.state), null, { timeout: 120000 });
await page.waitForTimeout(3000);
const steps = [];
for (let n = 0; n < MAX; n++) {
  await page.evaluate(() => { window.__frames.length = 0; });
  if (n) await page.keyboard.press('Space');
  await page.waitForTimeout(SETTLE);
  const s = await page.evaluate(() => (window.talk?.state ?? window.intro.state)());
  const fr = await page.evaluate(() => window.__frames.slice());
  const heap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null);
  const gl = await live();
  steps.push({ n, label: s?.label, part: s?.part ?? null, gl: gl.n, by: gl.by, p50: pct(fr, 0.5), p95: pct(fr, 0.95), heap });
  console.log(`${String(n).padStart(3)} gl ${String(gl.n).padStart(2)} p50 ${pct(fr, 0.5)} p95 ${pct(fr, 0.95)} heap ${heap}  ${s?.label} ${s?.part ?? ''}  ${JSON.stringify(gl.by)}`);
  if (n && steps.at(-2).label === s?.label && steps.at(-2).part === s?.part) break;   // did not move: the end
}
const all = steps.flatMap((s) => [s.p50]).filter(Boolean), p95s = steps.map((s) => s.p95).filter(Boolean);
const sum = { maxGL: Math.max(...steps.map((s) => s.gl)), p50: pct(all, 0.5), p95: pct(p95s, 0.5), worstP95: Math.max(...p95s), maxHeap: Math.max(...steps.map((s) => s.heap ?? 0)), warns: warns.length };
console.log('summary', JSON.stringify(sum));
writeFileSync(`${OUT}${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`, JSON.stringify({ sum, steps }, null, 1));
await browser.close();
