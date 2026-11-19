// The chart for "Folk costumes, drift measured": out/rahvaroivad/drift/drift.json ->
// out/drift-room/costume-drift.png (models by year on x, share of the real costume's checks on y,
// the real-photo ceiling as a band). Rendered by Playwright with the system Chrome.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const here = (p) => new URL(p, import.meta.url).pathname;
const D = JSON.parse(readFileSync(here('out/rahvaroivad/drift/drift.json'), 'utf8'));
const W = 1400, H = 780, L = 90, R = 40, T = 140, B = 120;
const ms = D.models;
const x = (i) => L + ((i + 0.5) * (W - L - R)) / ms.length;
const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
const ink = '#2b2b2b', muted = '#6b6b6b', grid = '#e4e1d8', paper = '#fbfaf6', blue = '#0072CE', orange = '#C2410C';
let s = '';
for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${grid}"/><text x="${L - 12}" y="${y(v) + 5}" text-anchor="end" fill="${muted}" font-size="15">${v} %</text>`;
s += `<rect x="${L}" y="${y(D.ceiling_max)}" width="${W - L - R}" height="${y(D.ceiling_min) - y(D.ceiling_max)}" fill="${blue}" opacity="0.13"/>`;
s += `<line x1="${L}" x2="${W - R}" y1="${y(D.ceiling)}" y2="${y(D.ceiling)}" stroke="${blue}" stroke-width="2.5"/>`;
s += `<text x="${W - R - 6}" y="${y(D.ceiling_max) - 8}" text-anchor="end" fill="${blue}" font-size="16" font-weight="600">Real costumes, photos held out: ${D.ceiling} % (${D.ceiling_min}–${D.ceiling_max})</text>`;
const parishes = Object.keys(D.parishes);
ms.forEach((m, i) => {
  const cx = x(i);
  parishes.forEach((p, k) => {
    const v = D.parishes[p].plain[m.id]?.own;
    if (v == null) return;
    s += `<circle cx="${cx - 18 + (k * 36) / Math.max(1, parishes.length - 1)}" cy="${y(v)}" r="4" fill="${muted}" opacity="0.45"/>`;
  });
  const hollow = m.parishes < parishes.length;
  s += `<circle cx="${cx}" cy="${y(m.plain)}" r="10" fill="${hollow ? paper : ink}" stroke="${ink}" stroke-width="2.5"/>`;
  s += `<text x="${cx + 16}" y="${y(m.plain) + 5}" fill="${ink}" font-size="17" font-weight="600">${m.plain} %</text>`;
  if (m.text != null) {
    s += `<path d="M${cx} ${y(m.text) - 11} L${cx + 11} ${y(m.text)} L${cx} ${y(m.text) + 11} L${cx - 11} ${y(m.text)} Z" fill="${orange}" stroke="${paper}" stroke-width="2"/>`;
    s += `<text x="${cx + 16}" y="${y(m.text) + 5}" fill="${ink}" font-size="15">${m.text} % with the expert text</text>`;
  }
  const label = m.label.replace(' (local)', '');
  s += `<text x="${cx}" y="${H - B + 30}" text-anchor="middle" fill="${ink}" font-size="15">${label}</text>`;
  s += `<text x="${cx}" y="${H - B + 50}" text-anchor="middle" fill="${muted}" font-size="14">${m.year}${m.local ? ', local' : ''}${hollow ? `, ${m.parishes} parish` : ''}</text>`;
});
const legY = H - 34;
s += `<circle cx="${L + 8}" cy="${legY}" r="8" fill="${ink}"/><text x="${L + 24}" y="${legY + 5}" fill="${ink}" font-size="15">Plain prompt "&lt;Parish&gt; women's folk costume, full figure": mean of ${parishes.length} parishes (small dots: each parish)</text>`;
s += `<path d="M${L + 828} ${legY - 9} L${L + 837} ${legY} L${L + 828} ${legY + 9} L${L + 819} ${legY} Z" fill="${orange}"/><text x="${L + 846}" y="${legY + 5}" fill="${ink}" font-size="15">Prompt built from the expert text</text>`;
const html = `<html><body style="margin:0;background:${paper}"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Inter, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="${paper}"/>
<text x="${L}" y="48" fill="${ink}" font-size="28" font-weight="700">Asked plainly, models draw about a fifth of the real costume</text>
<text x="${L}" y="78" fill="${muted}" font-size="17">Share of a parish's checks (from the rahvaroivad.ee expert text, calibrated on real photos) that one picture passes.</text>
<text x="${L}" y="100" fill="${muted}" font-size="17">${parishes.length} parishes whose checks tell them apart from their neighbours. Judge: Gemini 3.8 Flash, 2026-11-16.</text>
${s}</svg></body></html>`;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
await p.setContent(html);
await p.screenshot({ path: here('out/drift-room/costume-drift.png') });
await b.close();
console.log('out/drift-room/costume-drift.png');
