import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const HEADED = !!process.env.HEADED, DPR = Number(process.env.DPR ?? 2);
const PRESSES = Number(process.env.PRESSES ?? 14), GAP = Number(process.env.GAP ?? 5600);
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
await ctx.addInitScript({ content: readFileSync(new URL('./instr.js', import.meta.url), 'utf8') });
const page = await ctx.newPage();
page.on('console', (m) => { if (/LOST|Too many|error/i.test(m.text()) || m.type() === 'error') console.log('console', m.type(), m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8123/drift-room/talk.html?keys=0&test=1');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
const mapAt = await page.evaluate(() => window.talk.STEPS.findIndex((s) => window.talk.STOPS[s.stop].end === 'map'));
console.log('map step', mapAt);
await page.evaluate((n) => window.talk.show(n - 1, { animate: false }), mapAt);
await page.waitForTimeout(12000);
const census = async (label) => {
  const out = [];
  for (const f of page.frames()) { try { const r = await f.evaluate(async () => { const a = { gl: window.__draws.gl, raf: window.__draws.raf }; await new Promise((r) => setTimeout(r, 1000)); return { url: location.pathname.split('/').pop() + location.search.slice(0, 30), live: window.__live(), glPerS: window.__draws.gl - a.gl, rafPerS: window.__draws.raf - a.raf, paused: !!window.deckPaused }; }); out.push(r); } catch (e) {} }
  console.log(label); console.table(out); return out;
};
await census('on last film');
await page.evaluate(() => { window.__m.phase = 'tomap'; window.__phaseT = {}; });
await page.keyboard.press('Space');
await page.waitForTimeout(8000);
if (process.env.NODRAW) await page.evaluate((v) => { window.__noDraw = v === 'c' ? 'c' : true; }, process.env.NODRAW);
const onMap = await census('on map');
for (let i = 1; i <= PRESSES; i++) {
  await page.evaluate((i) => { window.__m.phase = `press${String(i).padStart(2, '0')}`; window.__phaseT[window.__m.phase] = performance.now(); }, i);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(GAP);
}
await census('after presses');
const M = await page.evaluate(() => ({ frames: window.__m.frames, long: window.__m.long }));
const lost = []; for (const f of page.frames()) { try { lost.push(...(await f.evaluate(() => window.__lost ?? []))); } catch {} }
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null; };
const by = {}; for (const f of M.frames) (by[f.phase] ??= []).push(f);
const rows = Object.entries(by).filter(([ph]) => ph !== 'init').map(([ph, fs]) => { const dt = fs.map((f) => f.dt).filter((x) => x > 0); const L = M.long.filter((l) => l.phase === ph);
  return { ph, n: dt.length, p50: pct(dt, .5), p95: pct(dt, .95), max: pct(dt, 1), over20: dt.filter((x) => x > 20).length, topJs95: pct(fs.map((f) => f.rafjs || 0), .95), topJsMax: pct(fs.map((f) => f.rafjs || 0), 1), longN: L.length, longMax: L.length ? Math.round(Math.max(...L.map((l) => l.d))) : 0 }; });
console.table(rows); console.log('lost', lost);
const PT = await page.evaluate(() => window.__phaseT);
const worst = M.frames.filter((f) => f.phase.startsWith('press')).sort((a, b) => b.dt - a.dt).slice(0, 16).map((f) => ({ phase: f.phase, dt: +f.dt.toFixed(1), at: Math.round(f.t - PT[f.phase]) }));
console.table(worst);
const mf = page.frames().find((f) => f.url().includes('ai-estonia'));
const IF = await mf.evaluate(() => window.__m.frames.filter((f) => f.dt > 60).map((f) => ({ dt: +f.dt.toFixed(1), js: +(f.rafjs||0).toFixed(1), stroke: +(f.stroke||0).toFixed(1), tex: +(f.tex||0).toFixed(1) })).slice(-20));
console.log('iframe long frames (js inside them)'); console.table(IF);
console.log('sync calls', await page.evaluate(() => window.__sync), await mf.evaluate(() => window.__sync));
writeFileSync(new URL(`./talkmap-${HEADED ? 'headed' : 'headless'}${process.env.NODRAW ? '-nodraw' : ''}.json`, import.meta.url), JSON.stringify({ rows, onMap, lost, long: M.long }, null, 1));
await browser.close();
