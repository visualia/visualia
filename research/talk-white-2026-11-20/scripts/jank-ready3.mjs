import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED, args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  const P = (window.__fetches = new Map()); let id = 0; const of = window.fetch;
  window.fetch = function (u, ...a) { const k = ++id, url = String(u?.url ?? u); P.set(k, { url, t: performance.now() }); return of.call(this, u, ...a).then((r) => { P.get(k).status = r.status; P.get(k).hdr = performance.now(); return r; }, (e) => { P.get(k).err = e.message; throw e; }); };
  // body reads too
  for (const m of ['json', 'text', 'arrayBuffer']) { const o = Response.prototype[m]; Response.prototype[m] = function () { const u = this.url, t = performance.now(); const pend = (window.__bodies ??= new Map()); const k = Symbol(); pend.set(k, { u, t }); return o.call(this).finally(() => pend.delete(k)); }; }
  window.__mark = [];
  addEventListener('error', (e) => window.__mark.push('error ' + e.message), true);
  addEventListener('unhandledrejection', (e) => window.__mark.push('rejection ' + (e.reason?.message ?? e.reason)));
});
const req = new Map(); const page = await ctx.newPage();
page.on('requestfailed', (r) => console.log('requestfailed', r.url().split('/').slice(-2).join('/'), r.failure()?.errorText));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8123/drift-room/talk.html?keys=0&test=1');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 120000 });
const at = await page.evaluate(() => window.talk.STEPS.findIndex((s) => s.page === 'slides') - 1);
await page.evaluate((n) => window.talk.show(n - 1, { animate: false }), at); await page.waitForTimeout(8000);
const t0 = Date.now(); await page.keyboard.press('Space');
let ok = false;
for (let k = 0; k < 20; k++) { await page.waitForTimeout(1000); ok = await page.evaluate(() => { try { return !!document.querySelector('iframe.slides').contentWindow.deckStep?.ready; } catch { return false; } }); if (ok) break; }
console.log('ready', ok, Date.now() - t0);
if (!ok) {
  const f = page.frames().find((f) => f.url().includes('slides.html'));
  console.log(await f.evaluate(() => ({ pending: [...window.__fetches.values()].filter((x) => x.status == null && !x.err).map((x) => x.url.split('/').slice(-2).join('/')), errs: [...window.__fetches.values()].filter((x) => x.err).map((x) => x.url + ' ' + x.err), bodies: [...(window.__bodies ?? new Map()).values()].map((b) => b.u.split('/').slice(-2).join('/')), marks: window.__mark, all: window.__fetches.size, s3: typeof window.__slides })));
}
await browser.close();
