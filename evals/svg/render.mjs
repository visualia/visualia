// Check and render the SVGs from run.mjs / omnisvg.py in headless Chromium.
// Usage: node render.mjs <out dir>   (playwright from the repo root's node_modules)
// For each out/<model>/<id>.svg: well-formed XML (DOMParser), renders as a standalone
// <img> (no scripts, no outside files), PNG at 512 px, a second frame after 1.5 s for
// animated ones (and whether it moved), the brief's required words found in the <text>
// (ignoring case), and a contact sheet
// per model (sheet-<model>.png) to look at.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? new URL('./out/', import.meta.url).pathname;
const briefs = JSON.parse(readFileSync(new URL('./briefs.json', import.meta.url), 'utf8'));
const models = readdirSync(OUT).filter((d) => statSync(`${OUT}/${d}`).isDirectory());

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
const report = [];

for (const model of models) {
  const tiles = [];
  for (const b of briefs) {
    const file = `${OUT}/${model}/${b.id}.svg`;
    if (!existsSync(file)) { report.push({ model, id: b.id, svg: false }); tiles.push({ id: b.id, src: null }); continue; }
    const svg = readFileSync(file, 'utf8');
    const check = await page.evaluate((s) => {
      const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
      const err = doc.querySelector('parsererror');
      if (err) return { xml: false, error: err.textContent.slice(0, 200) };
      const root = doc.documentElement;
      return {
        xml: true,
        ns: root.namespaceURI === 'http://www.w3.org/2000/svg',
        viewBox: root.getAttribute('viewBox'),
        text: [...doc.querySelectorAll('text')].map((t) => t.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
        animated: !!doc.querySelector('animate, animateTransform, animateMotion, set') || /@keyframes/.test(s),
        script: !!doc.querySelector('script'),
        elements: doc.getElementsByTagName('*').length,
      };
    }, svg);
    const row = { model, id: b.id, svg: true, bytes: Buffer.byteLength(svg), ...check };
    if (b.text) row.words = Object.fromEntries(b.text.map((w) => [w, (check.text ?? '').toLowerCase().includes(w.toLowerCase())]));
    const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    await page.setContent(`<body style="margin:0;background:#fff"><img id=i src="${src}" style="width:512px;height:512px;object-fit:contain"></body>`);
    const ok = await page.evaluate(() => new Promise((r) => {
      const i = document.getElementById('i');
      if (i.complete) r(i.naturalWidth > 0); else { i.onload = () => r(true); i.onerror = () => r(false); }
    }));
    row.renders = ok;
    const png = `${OUT}/${model}/${b.id}.png`;
    await page.screenshot({ path: png });
    if (check.animated) { // does anything visibly move? compare a frame 1.5 s later
      await page.waitForTimeout(1500);
      const later = await page.screenshot({ path: `${OUT}/${model}/${b.id}-b.png` });
      row.moves = !later.equals(readFileSync(png));
    }
    report.push(row);
    tiles.push({ id: b.id, src: 'data:image/png;base64,' + readFileSync(png).toString('base64') });
  }
  // contact sheet: 4 × 2 tiles of 384 px with the brief id under each
  const sheet = await browser.newPage({ viewport: { width: 4 * 392, height: 2 * 420 } });
  await sheet.setContent(`<body style="margin:0;font:14px sans-serif;display:grid;grid-template-columns:repeat(4,392px);background:#ddd">${
    tiles.map((t) => `<div style="padding:4px"><div style="width:384px;height:384px;background:#fff;display:flex;align-items:center;justify-content:center">${t.src ? `<img src="${t.src}" style="width:384px;height:384px">` : 'no SVG'}</div><div>${model} · ${t.id}</div></div>`).join('')
  }</body>`);
  await sheet.screenshot({ path: `${OUT}/sheet-${model}.png` });
  await sheet.close();
}
await browser.close();
writeFileSync(`${OUT}/render.json`, JSON.stringify(report, null, 1));
for (const r of report) console.log(JSON.stringify(r));
