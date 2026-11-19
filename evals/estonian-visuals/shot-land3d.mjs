import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const shots = [
  ['bog', 0, ''], ['bog', 20, ''], ['bog', -20, ''], ['nipernaadi-lake', 0, ''], ['nipernaadi-lake', 20, ''],
  ['klint', 20, ''], ['average', 20, ''], ['bog', 20, '&look=1'], ['bog', 0, '&dolly=0.12'],
];
for (const [s, y, extra] of shots) {
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:8123/drift-room/land3d.html?test&still&scene=${s}&yaw=${y}${extra}`);
  await p.waitForFunction(() => document.getElementById('label').textContent.length > 0, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  const name = `land3d-${s}-${y}${extra.replace(/[&=]/g, '-')}.png`;
  await p.screenshot({ path: `${out}/${name}` }); console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
// a running transition: fog midway
await p.goto('http://127.0.0.1:8123/drift-room/land3d.html?test&scene=bog');
await p.waitForFunction(() => document.getElementById('label').textContent.length > 0, null, { timeout: 60000 });
await p.waitForTimeout(17800); await p.screenshot({ path: `${out}/land3d-fog.png` });
const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t < 2000 ? requestAnimationFrame(f) : r(n / 2); }; requestAnimationFrame(f); }));
console.log('fps', fps, 'errors', errs); await b.close();
