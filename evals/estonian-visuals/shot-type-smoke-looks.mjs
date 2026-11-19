// Contact sheet of the named looks in out/drift-room/type-smoke.html: each look paused at the same moment, 4 × 2 tiles
// with the name, into out/drift-room/type-smoke-presets.png. Server on 127.0.0.1:8123 serving out/.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=metal', '--enable-features=CanvasDrawElement'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() !== 'log') errs.push(m.text()); });
const T = Number(process.env.T || 37);
await p.goto(`http://127.0.0.1:8123/drift-room/type-smoke.html${process.env.Q || ''}#paused=1`); await p.waitForTimeout(1500);
await p.keyboard.press('h');
const looks = await p.evaluate(() => Object.entries(__smoke.LOOKS).map(([id, l]) => [id, l.name]));
const shots = [];
for (const [id, name] of looks) {
  await p.evaluate(([id, T]) => { __smoke.choose(id, 0); for (const s of __smoke.smokes) s.time = T; }, [id, T]);
  await p.waitForTimeout(250);
  if (process.env.EACH) await p.screenshot({ path: `out/drift-room/type-smoke-look-${id}.png` });
  shots.push({ name, hash: await p.evaluate(() => location.hash), png: (await p.screenshot({ clip: { x: 60, y: 30, width: 900, height: 820 } })).toString('base64') });
}
const sheet = await p.evaluate(async (shots) => {
  const W = 900, H = 820, s = .5, cols = 4, lab = 34;
  const c = document.createElement('canvas'); c.width = cols * W * s; c.height = Math.ceil(shots.length / cols) * (H * s + lab);
  const x = c.getContext('2d'); x.fillStyle = getComputedStyle(document.body).backgroundColor; x.fillRect(0, 0, c.width, c.height);
  for (const [i, sh] of shots.entries()) {
    const img = new Image(); img.src = 'data:image/png;base64,' + sh.png; await img.decode();
    const cx = (i % cols) * W * s, cy = Math.floor(i / cols) * (H * s + lab);
    x.drawImage(img, cx, cy + lab, W * s, H * s);
    x.fillStyle = '#4f4c47'; x.font = '18px system-ui'; x.fillText(`${i + 1}  ${sh.name}`, cx + 16, cy + 24);
  }
  return c.toDataURL('image/png').split(',')[1];
}, shots);
writeFileSync('out/drift-room/type-smoke-presets.png', Buffer.from(sheet, 'base64'));
console.log(shots.map((s) => `${s.name}: ${s.hash}`).join('\n'));
console.log('errors', errs); await b.close();
