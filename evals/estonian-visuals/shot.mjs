// Screenshots of slides: node shot.mjs <dir> <slide n> [...] (server on 127.0.0.1:8123 serving out/).
import { chromium } from 'playwright';
const [dir, ...ns] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
for (const n of ns) {
  await p.goto(`http://127.0.0.1:8123/drift-room/slides.html?n=${n}#${n}`); await p.waitForTimeout(4500);
  await p.screenshot({ path: `${dir}/local-slide-${n}.png` });
}
console.log('errors', errs); await b.close();
