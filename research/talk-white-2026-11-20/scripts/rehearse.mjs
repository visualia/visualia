// A rehearsal first (index jumps to the end pages), then R and Space to the klint: do contexts pile up?
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const OUT = new URL('./rehearse/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-features=CanvasDrawElement', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const out = readFileSync(new URL('./dx-out.json', import.meta.url), 'utf8');
await ctx.addInitScript((v) => { try { if (!localStorage.getItem('dx-out')) localStorage.setItem('dx-out', v); } catch {} }, out);
await ctx.addInitScript(() => { const all = (window.__glAll = []); const o = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = o.call(this, t, ...a); if (c && /webgl/.test(t) && !all.includes(c)) { all.push(c); this.addEventListener('webglcontextlost', () => console.error(`[GLLOST] ${location.pathname.split('/').pop()} ${t} ${this.id || this.className}`)); } return c; };
  window.__live = () => all.filter((c) => !c.isContextLost()).length; });
const page = await ctx.newPage(); page.on('requestfailed', (r) => console.log('REQFAIL', r.url().split('8123')[1], r.failure()?.errorText));
const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(1);
page.on('pageerror', (e) => console.log(ts(), 'PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(ts(), `console.${m.type()}`, m.text().slice(0, 160)); });
const count = async (tag) => { let n = 0, per = {}; for (const f of page.frames()) { const k = await f.evaluate(() => window.__live?.() ?? 0).catch(() => 0); n += k; if (k) per[f.url().split('/').pop().split('?')[0] || 'blank'] = k; } console.log(ts(), tag, 'live contexts', n, JSON.stringify(per)); };
await page.goto('http://127.0.0.1:8123/drift-room/talk.html');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
await page.mouse.click(700, 450);
const idx = await page.evaluate(() => Object.fromEntries(['films', 'cost', 'black'].map((e) => [e, window.talk.STEPS.findIndex((s) => window.talk.STOPS[s.stop].end === e)]).concat([['map', window.talk.STEPS.findIndex((s) => window.talk.STOPS[s.stop].end === 'map')], ['figs', window.talk.STEPS.findIndex((s) => s.page === 'figs')], ['laul', window.talk.STEPS.findIndex((s) => s.page === 'laul')]])));
console.log(JSON.stringify(idx));
for (const k of ['figs', 'laul', 'films', 'map', 'cost', 'black']) { await page.evaluate((i) => window.talk.show(i, { animate: false }), idx[k]); await page.waitForTimeout(k === 'black' ? 12000 : 6000); await count(`at ${k}`); }
await page.keyboard.press('KeyR'); await page.waitForTimeout(6000); await count('after R');
for (let n = 0; n < 8; n++) { await page.keyboard.press('Space'); await page.waitForTimeout(3500); }
await count(`after 8 Space ${JSON.stringify(await page.evaluate(() => window.talk.state().label))}`);
await page.screenshot({ path: OUT + 'klint.jpg', type: 'jpeg', quality: 50 });
await page.keyboard.press('Space'); await page.waitForTimeout(4000); await count('slide 0');
await page.screenshot({ path: OUT + 'slide0.jpg', type: 'jpeg', quality: 50 });
await browser.close();
