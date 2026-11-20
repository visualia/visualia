import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8123/drift-room/talk.html?keys=0&test=1');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
const at = await page.evaluate(() => window.talk.STEPS.findIndex((s) => s.page === 'slides') - 2);
await page.evaluate((n) => window.talk.show(n, { animate: false }), at);
await page.waitForTimeout(10000);
const t0 = Date.now(); await page.keyboard.press('Space');
let r = null;
for (let k = 0; k < 300; k++) { const ok = await page.evaluate(() => { try { return !!document.querySelector('iframe.slides').contentWindow.deckStep?.ready; } catch { return false; } }); if (ok) { r = Date.now() - t0; break; } await page.waitForTimeout(100); }
console.log('slides ready after Space onto the klint 3D:', r, 'ms');
await browser.close();
