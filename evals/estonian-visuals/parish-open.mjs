// Does a plain "Estonian ... national costume" come out as Muhu? (asked 2026-11-17: "if I ask Estonian national
// costume, I get Muhu most of the times. Is this the case?") The era set's pictures (out/era/<era>/{woman,man}.png,
// prompt "An Estonian woman/man in national costume, full figure, standing.", nine models 2022–2026) and DALL·E mini's
// extra seeds, each asked an OPEN question (no list of parishes, which would name Muhu for it). Gemini 3.8 Flash
// through the live gateway, as era.mjs. Writes out/era/parish-open.jsonl (resumable).
//   node parish-open.mjs          judge what is missing, then print the table
import { readFileSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const MODEL = 'google/gemini-3.8-flash';
const OUT = new URL('./out/era/', import.meta.url).pathname;
const CACHE = `${OUT}parish-open.jsonl`;
const key = Object.fromEntries(readFileSync(new URL('../../.keys.local', import.meta.url), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))[process.env.KEY_PERSON ?? 'eka-teacher'];
const ASK = `Look only at the clothing of the person in this picture (if there are several, the adult).
If it is meant as an Estonian folk costume: which parish (kihelkond) or region of Estonia does it come from? Name the
single closest one in your own words. If it does not look Estonian, say so and name the country it looks like.
JSON only: {"estonian": true|false, "parish": "<parish name or null>", "region": "<region of Estonia or null>",
"country": "<if not Estonian, the country it looks like, else null>", "confidence": 0.0-1.0, "details": "short: the visible details"}`;

const rows = existsSync(CACHE) ? readFileSync(CACHE, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const done = new Set(rows.map((r) => r.file));
// DALL·E mini's woman is seed 8 on the figurine pages (seed 1 was a headless smear; asked 2026-11-17)
const files = [...readdirSync(OUT).filter((d) => /^20\d\d-/.test(d)).flatMap((d) => ['woman', 'man'].map((w) => `${d}/${w}.png`)), '2022-dalle-mini/seeds/woman-s8.png']
  .filter((f) => existsSync(OUT + f));
for (const f of files.filter((f) => !done.has(f))) {
  const jpg = await sharp(OUT + f).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer();
  const res = await fetch(`${GATEWAY}/v1/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: [{ type: 'text', text: ASK }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpg.toString('base64')}` } }] }] }) });
  const data = await res.json().catch(() => ({}));
  const text = data.choices?.[0]?.message?.content ?? '';
  const answer = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
  const row = { file: f, judge: MODEL, status: res.status, answer };
  appendFileSync(CACHE, JSON.stringify(row) + '\n'); rows.push(row);
  console.log(f.padEnd(36), answer ? `${answer.estonian ? 'EE' : 'not EE'} ${answer.parish ?? ''} / ${answer.region ?? ''} ${answer.country ?? ''} ${answer.confidence}` : `FAILED ${res.status} ${text.slice(0, 100)}`);
}
console.log('\n| Picture | Estonian? | Parish | Region | Or country | Confidence |\n| --- | --- | --- | --- | --- | ---: |');
for (const r of rows.sort((a, b) => a.file.localeCompare(b.file))) { const a = r.answer ?? {}; console.log(`| ${r.file} | ${a.estonian ? 'yes' : 'no'} | ${a.parish ?? ''} | ${a.region ?? ''} | ${a.country ?? ''} | ${a.confidence ?? ''} |`); }
const ee = rows.filter((r) => r.answer?.estonian);
console.log(`\nJudged Estonian: ${ee.length}/${rows.length}; named Muhu: ${ee.filter((r) => /muhu/i.test(r.answer.parish ?? '')).length}/${ee.length}`);
