import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
const DIR = new URL('./frames/', import.meta.url).pathname, SUS = DIR + 'suspect/'; mkdirSync(SUS, { recursive: true });
const W = 96, H = 60;
const load = async (p) => new Float32Array(await sharp(p).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer());
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const white = (a) => { let n = 0; for (let i = 0; i < a.length; i += 3) if (a[i] > 215 && a[i + 1] > 210 && a[i + 2] > 200) n++; return n / (a.length / 3); };
const out = [];
for (const name of readdirSync(DIR).filter((d) => !/\./.test(d) && d !== 'suspect')) {
  const files = readdirSync(DIR + name).filter((f) => f.endsWith('.jpg')).sort();
  if (files.length < 2) continue;
  const imgs = await Promise.all(files.map((f) => load(DIR + name + '/' + f)));
  const A = imgs[0], B = imgs.at(-1);
  const rows = imgs.map((f, k) => {
    // best crossfade a: least squares of f - A = a (B - A)
    let num = 0, den = 0; for (let i = 0; i < f.length; i++) { const d = B[i] - A[i]; num += (f[i] - A[i]) * d; den += d * d; }
    const a = Math.max(0, Math.min(1, den ? num / den : 0));
    let r = 0; for (let i = 0; i < f.length; i++) r += Math.abs(f[i] - (A[i] + a * (B[i] - A[i]))); r /= f.length;
    return { k, file: files[k], ms: +files[k].split('_')[1].replace('.jpg', ''), lum: +mean(f).toFixed(1), white: +white(f).toFixed(3), a: +a.toFixed(2), resid: +r.toFixed(1) };
  });
  const wA = white(A), wB = white(B);
  const sus = rows.filter((r) => r.resid > 14 || r.white > Math.max(wA, wB) + 0.15);
  for (const s of sus) copyFileSync(DIR + name + '/' + s.file, `${SUS}${name}_${s.file}`);
  out.push({ name, n: files.length, lumA: +mean(A).toFixed(1), lumB: +mean(B).toFixed(1), whiteA: +wA.toFixed(3), whiteB: +wB.toFixed(3), maxResid: Math.max(...rows.map((r) => r.resid)), maxWhite: Math.max(...rows.map((r) => r.white)), suspects: sus.length, worst: sus.sort((a, b) => b.resid - a.resid).slice(0, 4).map((r) => `${r.ms}ms r${r.resid} w${r.white} lum${r.lum}`).join('; ') });
  writeFileSync(`${DIR}${name}.rows.json`, JSON.stringify(rows, null, 1));
}
console.table(out.map(({ worst, ...r }) => r)); for (const o of out) console.log(o.name, '|', o.worst);
