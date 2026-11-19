// The history set's other half: Estonian historical events and Estonian films, as image
// models draw them. Pictures: `node run.mjs --set history generate ...`; this script does
// the rest. Research only: everything stays in out/history/ (not in git), nothing is published.
// Usage:
//   node history.mjs commons      a few archival photos from Wikimedia Commons (control), 512 px
//   node history.mjs judge        every picture: "what event or film is this?" (no hints), then the
//                                 yes/no facts, then for named films "is it recognisably that film?"
//   node history.mjs deport       the text-only probe on the 1941 and 1949 deportations (no pictures)
//   node history.mjs report       tables for the README
//   node history.mjs sheet        out/history/sheet-<subject>.jpg: variants by model, real photos last
// Env: GATEWAY (default https://gw.visualia.space), KEY_PERSON (default eka-teacher).
// No pictures of deportations, executions or other atrocities: see the README's care note.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/history/');
const REAL = `${OUT}real/`;
const tasks = JSON.parse(readFileSync(here('./tasks-history.json'), 'utf8'));
const MODELS = ['flux-3-image-klein', 'flux-2-pro-preview', 'nano-banana-2-lite'];
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const JUDGE = 'google/gemini-3.8-flash';
const PRICE = { in: 0.75, out: 3.75 }; // $ per M tokens (apps/gateway/src/prices.js)
const UA = 'visualia-research (kristjan.jansen@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [cmd, ...rest] = process.argv.slice(2);

// The films, for the "is it that film?" question.
const FILMS = {
  kevade: 'Kevade (1969, directed by Arvo Kruusement)',
  suvi: 'Suvi (1976, directed by Arvo Kruusement)',
  viimne_reliikvia: 'Viimne reliikvia (1969, directed by Grigori Kromanov)',
  hukkunud_alpinisti: 'Hukkunud Alpinisti hotell (1979, directed by Grigori Kromanov)',
  nukitsamees: 'Nukitsamees (1981, directed by Helle Karis)',
  siin_me_oleme: 'Siin me oleme! (1979, directed by Sulev Nõmmik)',
  tode_ja_oigus: 'Tõde ja õigus (2019, directed by Tanel Toom)',
  november: 'November (2017, directed by Rainer Sarnet)',
  suur_toll: 'Suur Tõll (1980, animated, directed by Rein Raamat)',
  nipernaadi: 'Nipernaadi (1983, directed by Kaljo Kiisk)',
  // There is no such film: the prompt's attribution is wrong on purpose (a 2015 student short exists).
  kalevipoeg: 'Kalevipoeg (an animated film of the 1980s by Priit Pärn)',
};

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key in .keys.local');
  return k;
}

function readJsonl(file) {
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

// ---- commons: archival photos of four of the events ----

const PHOTOS = [
  ['baltic_way', 'File:Balti kett 66.jpg'],
  ['baltic_way', 'File:Balti kett 19.jpg'],
  ['baltic_way', 'File:Balti kett 28.jpg'],
  ['tartu_peace', 'File:Joffe signing the Treaty of Tartu.jpg'],
  ['tartu_peace', 'File:Poska signing the Treaty of Tartu.jpg'],
  ['manifesto_1918', 'File:Declaration of Estonian independence in Pärnu.jpg'],
];
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function commons() {
  mkdirSync(REAL, { recursive: true });
  const meta = `${REAL}photos.json`;
  const have = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : [];
  for (const [subject, title] of PHOTOS) {
    if (have.some((h) => h.title === title)) continue;
    await sleep(1000);
    const q = new URLSearchParams({ format: 'json', formatversion: '2', action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '512' });
    const p = (await (await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: { 'user-agent': UA } })).json()).query?.pages?.[0];
    const ii = p?.imageinfo?.[0];
    if (!ii) { console.log(`${title}: not found`); continue; }
    let k = 1;
    while (have.some((h) => h.id === `${subject}-${k}`)) k++;
    const id = `${subject}-${k}`;
    await sleep(1000);
    const res = await fetch(ii.thumburl, { headers: { 'user-agent': UA } });
    if (!res.ok) { console.log(`${id}: thumbnail ${res.status}`); continue; }
    const raw = `${REAL}${id}.raw`;
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    // Without metadata and without the file name: the judge sees pixels only.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-map_metadata', '-1', '-q:v', '3', `${REAL}${id}.jpg`]);
    rmSync(raw);
    const m = ii.extmetadata ?? {};
    have.push({ id, subject, title, author: strip(m.Artist?.value), licence: m.LicenseShortName?.value ?? null,
      date: strip(m.DateTimeOriginal?.value), description: strip(m.ImageDescription?.value).slice(0, 300), url: ii.descriptionurl });
    writeFileSync(meta, JSON.stringify(have, null, 2));
    console.log(`${id.padEnd(16)} ${title}  ${m.LicenseShortName?.value}`);
  }
}

// ---- judge ----

const IDENTIFY = `What does this picture show? If it shows a particular historical event, or a scene from a particular film, name it. Look only at what is in the picture.
Answer with JSON only, no other text:
{"what": "<the event or film, or \\"nothing in particular\\">", "kind": "<event, film, or other>",
 "country": "<one country name in English, or \\"unknown\\">", "place": "<the town or place, or null>",
 "when": "<the year, or the decade>", "confidence": <0 to 1>,
 "reason": "<one short sentence: what in the picture points there>"}`;

const facts = (t) => `Look at the picture and answer each question yes or no, by what is visible.
${[...t.criteria, ...t.markers].map((c) => `- ${c.id}: ${c.q}`).join('\n')}
Answer with JSON only, no other text: {${[...t.criteria, ...t.markers].map((c) => `"${c.id}": true or false`).join(', ')}}`;

const film = (t) => `This picture is meant to be a still from the Estonian film ${FILMS[t.subject]}.
From what you know of that film (its setting, period, characters, whether it is in colour or black and white), is the picture recognisably a scene from it?
Answer with JSON only, no other text:
{"knows_film": <true if you know this film, false if not>, "what_you_know": "<one sentence about the film, or null>",
 "recognisable": "<yes, partly or no>", "mismatch": "<what does not fit, or null>"}`;

function pictures() {
  const gen = MODELS.flatMap((m) => tasks.filter((t) => existsSync(`${OUT}${m}/${t.id}.jpg`))
    .map((t) => ({ kind: 'generated', model: m, task: t, file: `${OUT}${m}/${t.id}.jpg` })));
  const real = existsSync(`${REAL}photos.json`) ? JSON.parse(readFileSync(`${REAL}photos.json`, 'utf8')).map((p) =>
    ({ kind: 'real', model: 'real', task: { ...tasks.find((t) => t.id === p.subject), photo: p.id }, file: `${REAL}${p.id}.jpg` })) : [];
  return [...gen, ...real].map((p) => ({ ...p, hash: createHash('sha256').update(readFileSync(p.file)).digest('hex').slice(0, 16) }));
}

async function ask(text, url = null) {
  const content = [{ type: 'text', text }, ...(url ? [{ type: 'image_url', image_url: { url } }] : [])];
  const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: JUDGE, max_tokens: 3000, reasoning_effort: 'low', messages: [{ role: 'user', content }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.error ?? data).slice(0, 200)}`);
  const u = data.usage ?? {};
  const usd = ((u.prompt_tokens ?? 0) * PRICE.in + ((u.total_tokens ?? 0) - (u.prompt_tokens ?? 0)) * PRICE.out) / 1e6;
  return { text: data.choices?.[0]?.message?.content ?? '', usd };
}

async function judge() {
  const cache = `${OUT}judge.jsonl`;
  const done = new Set(readJsonl(cache).filter((r) => r.answer).map((r) => `${r.q}|${r.hash}`));
  const small = `${OUT}.judge/`;
  mkdirSync(small, { recursive: true });
  const jobs = [];
  for (const p of pictures()) {
    jobs.push({ p, q: 'identify', text: IDENTIFY });
    if (p.kind === 'generated') jobs.push({ p, q: 'facts', text: facts(p.task) });
    if (p.task.kind === 'film' && p.task.variant !== 'neutral') jobs.push({ p, q: 'film', text: film(p.task) });
  }
  const todo = jobs.filter((j) => !done.has(`${j.q}|${j.p.hash}`));
  let i = 0, usd = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length) {
      const { p, q, text } = todo[i++];
      const shrunk = `${small}${p.hash}.jpg`; // 512 px longest side, no metadata
      if (!existsSync(shrunk)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', p.file, '-map_metadata', '-1', '-vf', "scale='min(512,iw)':-2", '-q:v', '3', shrunk]);
      const url = `data:image/jpeg;base64,${readFileSync(shrunk).toString('base64')}`;
      const row = { q, hash: p.hash, kind: p.kind, model: p.model, task: p.task.id, photo: p.task.photo ?? null };
      for (let attempt = 1; attempt <= 3 && !row.answer; attempt++) {
        try {
          const r = await ask(text, url);
          usd += r.usd;
          row.answer = JSON.parse(String(r.text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
          if (!row.answer) throw new Error(`no JSON: ${r.text.slice(0, 120)}`);
          row.usd = r.usd;
          delete row.error;
        } catch (e) { row.error = e.message; }
      }
      appendFileSync(cache, JSON.stringify(row) + '\n');
      const a = row.answer ?? {};
      console.log(`${q.padEnd(8)} ${p.model.padEnd(18)} ${(p.task.photo ?? p.task.id).padEnd(26)} ${row.error ? 'FAILED ' + row.error : q === 'identify' ? `${a.what} | ${a.country} | ${a.when}` : q === 'film' ? `${a.knows_film} ${a.recognisable}` : 'ok'}`);
    }
  }));
  console.log(`${todo.length} asked, about $${usd.toFixed(3)}`);
}

// ---- deportations: a text-only probe ----

const DEPORT = [
  'What happened in Estonia in June 1941 and in March 1949? Give the dates, roughly how many people, who they were, where they were taken, and what happened to them. Answer in about 150 words.',
  'Mis juhtus Eestis 1941. aasta juunis ja 1949. aasta märtsis? Kuupäevad, umbes mitu inimest, kes nad olid, kuhu nad viidi ja mis neist sai. Vasta umbes 150 sõnaga.',
];

async function deport() {
  const out = [];
  for (const q of DEPORT) {
    const r = await ask(q);
    out.push({ judge: JUDGE, question: q, answer: r.text, usd: r.usd });
    console.log(`\n## ${q}\n\n${r.text}\n($${r.usd.toFixed(4)})`);
  }
  writeFileSync(`${OUT}deportations.json`, JSON.stringify(out, null, 2));
}

// ---- report ----

function report() {
  const rows = readJsonl(`${OUT}judge.jsonl`).filter((r) => r.answer);
  const last = (q, hash) => rows.findLast((r) => r.q === q && r.hash === hash)?.answer;
  const all = pictures();
  const out = [];
  out.push('| task | variant | model | judge says | country | when | conf | facts | markers | film? |', '|---|---|---|---|---|---|---:|---:|---|---|');
  for (const t of tasks) {
    for (const m of [...MODELS, 'real']) {
      const ps = all.filter((p) => p.model === m && (m === 'real' ? p.task.id === t.id : p.task.id === t.id));
      if (!ps.length && m !== 'real') {
        const f = `${OUT}${m}/${t.id}.failed.json`;
        if (existsSync(f)) out.push(`| ${t.id} | ${t.variant} | ${m} | **refused**: ${JSON.parse(readFileSync(f, 'utf8')).error} | | | | | | |`);
        continue;
      }
      for (const p of ps) {
        const a = last('identify', p.hash) ?? {};
        const f = last('facts', p.hash);
        const crit = f ? `${t.criteria.filter((c) => f[c.id] === true).length}/${t.criteria.length}` : '';
        const marks = f ? t.markers.filter((c) => f[c.id] === true).map((c) => c.id).join(', ') : '';
        const fm = last('film', p.hash);
        out.push(`| ${t.id} | ${t.variant} | ${m === 'real' ? `real ${p.task.photo}` : m} | ${a.what ?? ''} | ${a.country ?? ''} | ${a.when ?? ''} | ${a.confidence ?? ''} | ${crit} | ${marks} | ${fm ? `${fm.recognisable}${fm.knows_film ? '' : ' (judge: unknown film)'}` : ''} |`);
      }
    }
  }
  // Facts that failed, per criterion, for the generated pictures.
  out.push('\nFacts: share true over the pictures that have them\n', '| task | fact | true |', '|---|---|---|');
  for (const t of tasks) for (const c of [...t.criteria, ...t.markers]) {
    const fs = all.filter((p) => p.kind === 'generated' && p.task.id === t.id).map((p) => last('facts', p.hash)).filter(Boolean);
    if (fs.length) out.push(`| ${t.id} | ${c.id} | ${fs.filter((f) => f[c.id] === true).length}/${fs.length} |`);
  }
  out.push(`\nJudging: ${rows.length} answers, about $${rows.reduce((a, r) => a + (r.usd ?? 0), 0).toFixed(3)}`);
  console.log(out.join('\n'));
}

// ---- sheets: one per subject, a row per variant (named, english, neutral, real), a column per model ----
// Dark grey: the model refused. Light grey: not drawn (to save credits). Real photos in the last row.

function sheets() {
  const tile = 256;
  for (const subject of [...new Set(tasks.map((t) => t.subject))]) {
    const rows = [];
    for (const t of tasks.filter((x) => x.subject === subject)) {
      rows.push(MODELS.map((m) => {
        const f = `${OUT}${m}/${t.id}.jpg`;
        return existsSync(f) ? f : existsSync(`${OUT}${m}/${t.id}.failed.json`) ? 'color=c=0x333333' : 'color=c=0xdddddd';
      }));
    }
    const real = existsSync(`${REAL}photos.json`) ? JSON.parse(readFileSync(`${REAL}photos.json`, 'utf8')).filter((p) => p.subject === subject) : [];
    if (real.length) rows.push(MODELS.map((_, i) => (real[i] ? `${REAL}${real[i].id}.jpg` : 'color=c=0xffffff')));
    const inputs = rows.flat().flatMap((s) => (s.startsWith('color=') ? ['-f', 'lavfi', '-i', `${s}:s=${tile}x${tile}:d=1`] : ['-i', s]));
    const n = rows.flat().length;
    const scale = Array.from({ length: n }, (_, i) => `[${i}]scale=${tile}:${tile}:force_original_aspect_ratio=decrease,pad=${tile}:${tile}:(ow-iw)/2:(oh-ih)/2:white,setsar=1[s${i}]`).join(';');
    const layout = rows.flatMap((r, y) => r.map((_, x) => `${x * tile}_${y * tile}`)).join('|');
    const filter = `${scale};${Array.from({ length: n }, (_, i) => `[s${i}]`).join('')}xstack=inputs=${n}:layout=${layout}:fill=white`;
    const out = `${OUT}sheet-${subject}.jpg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-frames:v', '1', '-q:v', '3', out]);
    console.log(`${out}: rows ${tasks.filter((x) => x.subject === subject).map((t) => t.variant).join(', ')}${real.length ? ', real' : ''}; columns ${MODELS.join(', ')}`);
  }
}

if (cmd === 'commons') await commons();
else if (cmd === 'sheet') sheets();
else if (cmd === 'judge') await judge();
else if (cmd === 'deport') await deport();
else if (cmd === 'report') report();
else console.log('node history.mjs commons | judge | deport | report');
