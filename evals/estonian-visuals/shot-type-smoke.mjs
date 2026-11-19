// Checks out/drift-room/type-smoke.html (plans/drift-room.md, "Type that smokes away") in installed Chrome:
// screenshots at drift 0, 0.5, 1 (env D, Q for a query such as ?theme=dark, TAG for a file suffix), selection, and
// the GPU cost of a frame (smoke.js bench: n draws, one read). Server on 127.0.0.1:8123 serving out/.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=metal', '--enable-features=CanvasDrawElement'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() !== 'log') errs.push(m.text()); });
const url = (h) => `http://127.0.0.1:8123/drift-room/type-smoke.html${process.env.Q || ''}#${h}`;
for (const d of (process.env.D || '0,0.5,1').split(',')) {
  await p.goto('about:blank'); await p.goto(url(`drift=${d}&paused=1`)); await p.waitForTimeout(1500);
  await p.evaluate(() => { for (const s of __smoke.smokes) s.time = 37; });
  await p.keyboard.press('h'); await p.waitForTimeout(300);
  await p.screenshot({ path: `out/drift-room/type-smoke-drift-${d}${process.env.TAG || ''}.png` });
}
console.log(await p.evaluate(() => ({ ok: __smoke.ok, chrome: navigator.userAgent.match(/Chrome\/[\d.]+/)[0],
  api: ['requestPaint', 'getElementImageDefaultSize', 'updateElementGeometry', 'captureElementImage'].filter((k) => k in HTMLCanvasElement.prototype)
    .concat('texElementSubImage2D' in WebGL2RenderingContext.prototype ? ['texElementSubImage2D'] : []),
  canvases: [...document.querySelectorAll('canvas.smoke')].map((c) => `${c.width}x${c.height}`) })));
await p.goto('about:blank'); await p.goto(url('drift=0.5')); await p.waitForTimeout(1200);
const box = await p.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('b1')); const b = r.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; });
await p.mouse.dblclick(box[0] + 40, box[1] + box[3] / 2);
console.log('double-click selects', JSON.stringify(await p.evaluate(() => String(getSelection()))));
await p.evaluate(() => __smoke.set({ paused: 1 }));
console.log('GPU ms a frame, per headline', await p.evaluate(() => __smoke.smokes.map((s) => +s.bench(120).toFixed(2))));
console.log('errors', errs); await b.close();
