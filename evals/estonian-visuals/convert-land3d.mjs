// Turns SHARP PLYs in land3d/ply-tmp into Spark SPZ (land3d/<source path>.spz), deletes each PLY. Runs until the batch is done.
import { chromium } from 'playwright';
import fs from 'node:fs';
const ROOT = 'out/drift-room/land3d', TMP = `${ROOT}/ply-tmp`, LOG = process.env.HOME + '/visualia-local/sharp/batch.log';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8123/drift-room/land3d/convert.html'); await p.waitForFunction(() => window.ready);
for (;;) {
  const plys = fs.readdirSync(TMP).filter((f) => f.endsWith('.ply') && !f.endsWith('.part.ply'));
  for (const f of plys) {
    const name = f.slice(0, -4), out = `${ROOT}/${name.replaceAll('__', '/')}.spz`;
    const b64 = await p.evaluate((u) => window.toSpz(u), `ply-tmp/${f}`);
    fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
    fs.writeFileSync(out, Buffer.from(b64, 'base64')); fs.unlinkSync(`${TMP}/${f}`);
    console.log(out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
  }
  const log = fs.readFileSync(LOG, 'utf8');
  if (!plys.length && /all done|STOP|Traceback/.test(log)) break;
  await new Promise((r) => setTimeout(r, 3000));
}
await b.close();
