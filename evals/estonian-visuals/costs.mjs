// What the value drift work cost, in money and energy, for the cost slide (out/drift-room/cost.html).
// Usage: node costs.mjs        reads the gateway's usage table (D1, remote) and costs-manual.json, writes out/costs.json
// Rerun after every run that spends. Money: the gateway's own prices, estimates for the models it records no price
// for, and the calls made outside the gateway (costs-manual.json). The AI Gateway dashboard's balance is the only
// full truth: fill in costs-manual.json "credits" from it.
// Energy: the cloud reports none, so it is estimated per call from two published figures, and music per second
// from our own measurement of a small model (below).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = new URL('.', import.meta.url).pathname;
const manual = JSON.parse(readFileSync(`${here}costs-manual.json`, 'utf8'));

// Wh per call. Picture: Luccioni, Jernite, Strubell 2024, "Power Hungry Processing", image generation averaged
// 2.907 kWh per 1,000 inferences (models of 2023; large spread between models). Text: Google 2025, "Measuring the
// environmental impact of delivering AI at Google Scale", median Gemini Apps text prompt 0.24 Wh; our judge calls
// carry a picture and thinking, so this is a floor.
const WH = { image: 2.907, text: 0.24, musicSecond: 0.0465 };
// Music: no published figure. Our own measurement is the floor: MusicGen small (300M) on this Mac took 0.93 Wh at the
// chip for 20 s of audio (research/music-drift/README.md, era ladder), 0.0465 Wh a second. The cloud music models are
// far larger, so the real figure is higher. Seconds: every generated clip in research/music-drift/out (ffprobe),
// leaving out the downloaded originals, the real recordings (control/) and the local era clips.
const SOURCES = [
  { label: 'Picture: 2.9 Wh, Luccioni et al. 2024', url: 'https://arxiv.org/abs/2311.16863' },
  { label: 'Text: 0.24 Wh, Google 2025', url: 'https://arxiv.org/abs/2508.15734' },
  { label: 'Music: 0.05 Wh a second, our measurement of a small model (a floor)', url: '../sounds-research/era/musicgen-small/ernesaks.json' },
];
const MUSIC = `${here}../../research/music-drift/out`;
const clips = execFileSync('find', [MUSIC, '-name', '*.mp3', '!', '-path', '*/original/*', '!', '-path', `${MUSIC}/era/*`, '!', '-path', '*/control/*'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const musicSeconds = clips.reduce((t, f) => t + Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' })), 0);

const sql = `SELECT substr(ts,1,10) d, model, count(*) n, sum(ok) ok, sum(cost_usd) usd,
  sum(cost_usd IS NULL AND ok = 1) unpriced, sum(tokens_in IS NOT NULL) texty
  FROM usage WHERE ts >= '${manual.since}' AND person_id = '${manual.person}' GROUP BY d, model`;
const raw = execFileSync('npx', ['wrangler', 'd1', 'execute', 'visualia', '--remote', '--json', '--command', sql],
  { cwd: `${here}../../apps/gateway`, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const rows = JSON.parse(raw.slice(raw.indexOf('[')))[0].results;

const models = {};
for (const r of rows) {
  const kind = r.texty > 0 ? 'text' : 'image';
  const m = (models[r.model] ??= { model: r.model, kind, calls: 0, ok: 0, usd: 0, estimated_usd: 0 });
  m.calls += r.n; m.ok += r.ok; m.usd += r.usd || 0;
  if (r.unpriced) {
    const each = manual.unpriced_usd[r.model];
    if (each == null) console.warn(`no estimate for ${r.model} (${r.unpriced} unpriced calls)`);
    m.estimated_usd += (each ?? 0) * r.unpriced;
  }
}
const list = Object.values(models).map((m) => ({ ...m, wh: m.ok * WH[m.kind] })).sort((a, b) => b.usd + b.estimated_usd - a.usd - a.estimated_usd);
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const pictures = sum(list.filter((m) => m.kind === 'image'), (m) => m.ok);
const answers = sum(list.filter((m) => m.kind === 'text'), (m) => m.ok);
const gateway = sum(list, (m) => m.usd), estimated = sum(list, (m) => m.estimated_usd);
const outside = sum(manual.outside, (o) => o.usd);
const musicWh = musicSeconds * WH.musicSecond;
const wh = sum(list, (m) => m.wh) + musicWh;
const days = [...new Set(rows.map((r) => r.d))].sort();

const out = {
  made: new Date().toISOString(), since: manual.since, days,
  pictures, answers, music_and_other_outside: manual.outside.length,
  usd: { gateway: +gateway.toFixed(2), estimated: +estimated.toFixed(2), outside: +outside.toFixed(2), total: +(gateway + estimated + outside).toFixed(2) },
  energy: { kwh: +(wh / 1000).toFixed(2), kettles: Math.round(wh / 1000 / 0.1), per_picture_wh: WH.image, per_answer_wh: WH.text,
    music: { clips: clips.length, seconds: Math.round(musicSeconds), wh: Math.round(musicWh), per_second_wh: WH.musicSecond },
    note: 'estimated: pictures and text from published figures, music from our own measurement of a small model (a floor)' },
  credits: manual.credits, sources: SOURCES,
  models: list.map((m) => ({ ...m, usd: +m.usd.toFixed(3), estimated_usd: +m.estimated_usd.toFixed(3), wh: Math.round(m.wh) })),
  outside: manual.outside,
};
writeFileSync(`${here}out/costs.json`, JSON.stringify(out, null, 2));
console.log(`${pictures} pictures, ${answers} answers, ${days[0]} to ${days.at(-1)}`);
console.log(`$${out.usd.total}: gateway $${out.usd.gateway}, estimated $${out.usd.estimated}, outside the gateway $${out.usd.outside}`);
console.log(`about ${out.energy.kwh} kWh (${out.energy.kettles} kettles of 1 L)`);
