import { chromium } from 'playwright';
const [out, query, tag] = [process.argv[2], process.argv[3] ?? 'seq=room', process.argv[4] ?? 'walk'];
const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text()));
await p.goto(`http://127.0.0.1:8123/drift-room/room-splat.html?test&autostart&${query}`);
await p.waitForFunction(() => window.room?.splats, null, { timeout: 60000 });
const info = async () => p.evaluate(() => ({ scene: room.scene, splats: room.splats, cam: room.pose.cam, fps: Math.round(room.fps), song: room.song, nature: room.nature }));
for (const [i, wait] of [[1, 6000], [2, 5000]]) {
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}/${tag}-${i}.png` }); console.log(i, JSON.stringify(await info()));
}
await p.evaluate(() => room.next()); await p.waitForTimeout(1800);
await p.screenshot({ path: `${out}/${tag}-dissolve.png` }); console.log('dissolve', JSON.stringify(await info()));
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/${tag}-3.png` }); console.log(3, JSON.stringify(await info()));
console.log('errors', errs.slice(0, 8)); await b.close();
