// Screencast across talk.html transitions; frames saved, analysed in flash-an.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const HEADED = !!process.env.HEADED;
const OUT = new URL('./frames/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript({ content: readFileSync(new URL('./instr.js', import.meta.url), 'utf8') });
const page = await ctx.newPage();
const log = [];
page.on('console', (m) => { const t = m.text(); if (/LOST|Too many|never became|error/i.test(t) || m.type() === 'error') { log.push(t.slice(0, 200)); console.log('console', m.type(), t.slice(0, 160)); } });
page.on('pageerror', (e) => { log.push('pageerror ' + e.message); console.log('pageerror', e.message); });
await page.goto('http://127.0.0.1:8123/drift-room/talk.html?keys=0&test=1');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const steps = await page.evaluate(() => window.talk.STEPS.map((s, i) => ({ i, page: s.page, part: s.part, end: window.talk.STOPS[s.stop].end ?? null, label: s.label, subject: s.subject, seto: s.seto })));
writeFileSync(OUT + 'steps.json', JSON.stringify(steps, null, 1));
const find = (f) => steps.findIndex(f);
const lastOf = (f) => steps.findLastIndex(f);
const T = [
  ['klint3d-slides', find((s) => s.page === 'slides') - 1, 7000],
  ['slides-subject', lastOf((s) => s.subject === 'klint'), 6000],
  ['slides-laul', lastOf((s) => s.subject === 'eyebright'), 6000],
  ['laul-slides', lastOf((s) => s.page === 'laul'), 6000],
  ['seto-lake', find((s) => s.seto), 13000],
  ['lake-figs', find((s) => s.end === 'lake'), 6000],
  ['figs-films', lastOf((s) => s.page === 'figs'), 6000],
  ['films-map', lastOf((s) => s.page === 'films'), 6000],
  ['map-cost', find((s) => s.end === 'map'), 5000],
  ['cost-black', lastOf((s) => s.end === 'cost'), 6000],
].filter(([, n]) => n >= 0);
console.log(T.map(([k, n]) => `${k}@${n} ${steps[n].label} -> ${steps[n + 1]?.label}`).join('\n'));
const cdp = await ctx.newCDPSession(page);
let frames = [], rec = false;
cdp.on('Page.screencastFrame', async (f) => { if (rec) frames.push({ data: f.data, ts: f.metadata.timestamp }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
const results = [];
for (const [name, n, dur] of T) {
  await page.evaluate((n) => window.talk.show(n, { animate: false }), n);
  await page.waitForTimeout(12000);
  const before = await page.evaluate(() => window.talk.state());
  frames = []; rec = true;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 480, maxHeight: 300, everyNthFrame: 1 });
  await page.waitForTimeout(600);
  const t0 = Date.now() / 1000;
  await page.keyboard.press('Space');
  await page.waitForTimeout(dur);
  await cdp.send('Page.stopScreencast'); rec = false;
  const after = await page.evaluate(() => window.talk.state());
  mkdirSync(`${OUT}${name}`, { recursive: true });
  frames.forEach((f, k) => writeFileSync(`${OUT}${name}/${String(k).padStart(3, '0')}_${Math.round((f.ts - t0) * 1000)}.jpg`, Buffer.from(f.data, 'base64')));
  results.push({ name, n, from: before, to: after, frames: frames.length });
  console.log(name, frames.length, 'frames', before.label, '->', after.label, after.pageOk);
}
writeFileSync(OUT + 'runs.json', JSON.stringify({ results, log }, null, 1));
await browser.close();
