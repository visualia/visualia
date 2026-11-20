// A quick presenter: Space onto the klint 3D, then Space again after WAIT ms, before the slides have loaded
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const WAIT = Number(process.env.WAIT ?? 800), NAME = `fast-${WAIT}`;
const OUT = new URL(`./frames/${NAME}/`, import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript({ content: readFileSync(new URL('./instr.js', import.meta.url), 'utf8') });
const page = await ctx.newPage();
page.on('console', (m) => { const t = m.text(); if (/LOST|Too many|never became|error/i.test(t)) console.log('console', t.slice(0, 160)); });
await page.goto('http://127.0.0.1:8123/drift-room/talk.html?keys=0&test=1');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
const at = await page.evaluate(() => window.talk.STEPS.findIndex((s) => s.page === 'slides') - 2);
await page.evaluate((n) => window.talk.show(n, { animate: false }), at);
await page.waitForTimeout(10000);
const cdp = await ctx.newCDPSession(page); const frames = [];
cdp.on('Page.screencastFrame', async (f) => { frames.push({ data: f.data, ts: f.metadata.timestamp }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 480, maxHeight: 300 });
const t0 = Date.now() / 1000;
await page.keyboard.press('Space');            // onto the klint 3D: slides start loading (paused)
const tl = [];
const probe = async (label) => tl.push({ label, ms: Math.round(Date.now() - t0 * 1000), ...(await page.evaluate(() => { const f = document.querySelector('iframe.slides'); let r = null; try { r = f.contentWindow.deckStep?.ready; } catch {} return { src: f.getAttribute('src')?.slice(0, 40), in: f.classList.contains('in'), op: getComputedStyle(f).opacity, ready: r }; })) });
await probe('klint3d');
await page.waitForTimeout(WAIT);
await probe('before 2nd space');
await page.keyboard.press('Space');            // onto the first klint slide
for (let k = 0; k < 16; k++) { await page.waitForTimeout(400); await probe('after'); }
await cdp.send('Page.stopScreencast');
frames.forEach((f, k) => writeFileSync(`${OUT}${String(k).padStart(3, '0')}_${Math.round((f.ts - t0) * 1000)}.jpg`, Buffer.from(f.data, 'base64')));
console.table(tl);
await browser.close();
