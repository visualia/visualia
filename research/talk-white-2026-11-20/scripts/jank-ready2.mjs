import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { const u = m.location()?.url ?? ''; if (/slides|talk/.test(u) && m.type() !== 'log' && m.type() !== 'info') console.log('console', m.type(), u.split('/').pop().slice(0, 30), m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8123/drift-room/talk.html?keys=0&test=1');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
const mode = process.env.MODE ?? 'space';
const at = await page.evaluate(() => window.talk.STEPS.findIndex((s) => s.page === 'slides') - 1);
if (mode === 'space') { await page.evaluate((n) => window.talk.show(n - 1, { animate: false }), at); await page.waitForTimeout(8000); }
const t0 = Date.now();
if (mode === 'space') await page.keyboard.press('Space'); else await page.evaluate((n) => window.talk.show(n, { animate: false }), at);
for (let k = 0; k < 40; k++) {
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => { const f = document.querySelector('iframe.slides'), w = f.contentWindow; let o = {}; try { o = { rs: w.document.readyState, ready: w.deckStep?.ready, paused: w.deckPaused, url: w.location.search.slice(-20) }; } catch (e) { o.err = e.message; } return { ...o, step: window.talk.state().label }; });
  console.log(Date.now() - t0, JSON.stringify(s));
  if (s.ready) break;
}
await browser.close();
