// The nature set's other half: real photos from Wikimedia Commons as a control, and a
// "where was this taken?" judge for generated and real pictures alike. The pictures are
// made with `node run.mjs --set nature generate ...`; this script does the rest.
// Usage:
//   node nature.mjs commons            ~20 geotagged photos into out/nature/real/ (kept: reruns skip them)
//   node nature.mjs judge [judge ...]  every picture asked "which country?", cached; judges: flash (default), sonnet
//   node nature.mjs report             generated vs real: share placed in Estonia, what else, by prompt and model
// Env: CF_TOKEN (else `npx wrangler auth token` in apps/gateway). Research use only: out/ is not in git.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/nature/');
const REAL = `${OUT}real/`;
const tasks = JSON.parse(readFileSync(here('./tasks-nature.json'), 'utf8'));
const MODELS = ['flux-2-klein-4b', 'flux-3-image-klein', 'p-image', 'nano-banana-2-lite', 'flux-2-dev'];
const ACCOUNT = 'dc1ee8d72a1fb7da857c46479a8503b8';
const JUDGES = {
  flash: { id: 'google/gemini-3.8-flash', in: 0.75, out: 3.75 }, // $ per M tokens, catalog 2026-11-16
  sonnet: { id: 'anthropic/claude-sonnet-5.5', in: 2, out: 10 },
  // The first run's question, which named Estonia (see QUESTION); its answers only, never asked again.
  primed: { id: 'google/gemini-3.8-flash#primed', in: 0.75, out: 3.75 },
};
const UA = 'visualia-research (kristjan.jansen@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [cmd, ...rest] = process.argv.slice(2);

function readJsonl(file) {
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

// ---- commons: real photos of the same kinds of places ----

// subject, search, how many. Searches in the words Commons files use (often Estonian).
const SEARCHES = [
  ['bog', ['Viru raba laudtee'], 2],
  ['alvar', ['alvar Saaremaa', 'loopealne Saaremaa', 'Juniper Saaremaa', 'kadastik Saaremaa'], 2],
  ['klint', ['Pakri pank'], 1],
  ['peipsi', ['Kolkja', 'Varnja', 'Kasepää', 'Peipsi sibul'], 1],
  ['ash_hills', ['Kohtla-Järve ash hill', 'tuhamägi', 'Ahtme ash', 'oil shale ash Estonia'], 1],
  ['lasnamae', ['Lasnamäe', 'Lasnamäe apartment buildings'], 2],
  ['setomaa', ['Obinitsa küla'], 1],
  ['lighthouse', ['Kõpu tuletorn'], 1],
  ['birch', ['birch forest Estonia', 'kaasik', 'Betula pendula Estonia'], 1],
  ['rye', ['rukkipõld', 'rye field Estonia', 'Secale cereale Estonia'], 1],
  ['matsalu', ['Matsalu', 'Matsalu laht', 'Matsalu rahvuspark'], 1],
  ['old_town', ['Tallinn vaade Toompealt', 'view from Toompea', 'Kohtuotsa vaateplatvorm'], 2],
  ['eyebright', ['Rhinanthus osiliensis', 'Saaremaa robirohi'], 1],
  ['juniper', ['Juniperus communis Estonia'], 1],
  ['cornflower', ['Centaurea cyanus Estonia'], 1],
];
// Good photos with no coordinates on Commons, the place named in the title: subject, title, county.
const MANUAL = [
  ['alvar', 'File:Atla loopealne Saaremaal.JPG', 'Saare County'],
  ['alvar', 'File:Lõo loopealne Saaremaal.JPG', 'Saare County'],
  ['eyebright', 'File:Saaremaa robirohu õis.jpg', 'Saare County'],
  ['matsalu', 'File:Matsalu roostik.JPG', 'Lääne County'],
  ['rye', 'File:Jaanipäeval õitseb rukis.jpg', null],
];
// Picked by search but the wrong thing (a wheat field, a forest): never take them.
const SKIP = new Set(['File:Nisupõld Tuuliku külas.jpg', 'File:Matsalu metsas.jpg']);
const inEstonia = (c) => c && c.lat > 57.5 && c.lat < 59.9 && c.lon > 21.5 && c.lon < 28.3;
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function commonsApi(params) {
  await sleep(1000); // gentle: one request at a time, 1 s apart
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`commons ${res.status}`);
  return res.json();
}

// The county (maakond) at a point, from OpenStreetMap's Nominatim (1 request a second, its rule).
async function countyOf(lat, lon) {
  await sleep(1100);
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=8&lat=${lat}&lon=${lon}&accept-language=en`, { headers: { 'user-agent': UA } });
  const a = (await res.json().catch(() => ({}))).address ?? {};
  return a.county ?? a.state ?? null;
}

// One Commons file into real/<subject>-<n>.jpg and photos.json.
async function take(have, meta, subject, p, county) {
  const ii = p.imageinfo[0];
  const c = p.coordinates?.[0] ?? null;
  const m = ii.extmetadata ?? {};
  const cats = (p.categories ?? []).map((x) => x.title.replace(/^Category:/, ''));
  let k = 1;
  while (have.some((h) => h.id === `${subject}-${k}`)) k++;
  const id = `${subject}-${k}`;
  await sleep(1000);
  const res = await fetch(ii.thumburl, { headers: { 'user-agent': UA } });
  if (!res.ok) { console.log(`${id}: thumbnail ${res.status}`); return false; }
  const raw = `${REAL}${id}.raw.jpg`;
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  // Re-encode without metadata, so the judge sees pixels only, no EXIF or GPS.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-map_metadata', '-1', '-q:v', '3', `${REAL}${id}.jpg`]);
  rmSync(raw);
  const row = { id, subject, title: p.title, author: strip(m.Artist?.value), licence: m.LicenseShortName?.value ?? null,
    url: ii.descriptionurl, lat: c?.lat ?? null, lon: c?.lon ?? null, county, categories: cats.slice(0, 12) };
  have.push(row);
  writeFileSync(meta, JSON.stringify(have, null, 2));
  console.log(`${id.padEnd(14)} ${p.title}  ${row.licence}  ${county ?? '?'}`);
  return true;
}

async function commons() {
  mkdirSync(REAL, { recursive: true });
  const meta = `${REAL}photos.json`;
  const have = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : [];
  for (const [subject, searches, n] of SEARCHES) for (const search of searches) {
    const got = have.filter((p) => p.subject === subject).length;
    if (got >= n) break;
    const data = await commonsApi({
      action: 'query', generator: 'search', gsrsearch: `${search} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '20',
      prop: 'imageinfo|coordinates|categories', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1024', cllimit: 'max', clshow: '!hidden',
    });
    const pages = (data.query?.pages ?? []).sort((a, b) => a.index - b.index);
    let added = 0;
    for (const p of pages) {
      if (got + added >= n) break;
      const ii = p.imageinfo?.[0];
      const c = p.coordinates?.[0];
      if (!ii || ii.mime !== 'image/jpeg' || ii.width < 1000 || !inEstonia(c) || SKIP.has(p.title) || have.some((h) => h.title === p.title)) continue;
      if (await take(have, meta, subject, p, await countyOf(c.lat, c.lon))) added++;
    }
    if (got + added < n) console.log(`${subject}: only ${got + added} of ${n} for "${search}"`);
  }
  for (const [subject, title, county] of MANUAL) {
    if (have.some((h) => h.title === title)) continue;
    const data = await commonsApi({ action: 'query', titles: title, prop: 'imageinfo|categories', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1024', cllimit: 'max', clshow: '!hidden' });
    const p = data.query?.pages?.[0];
    if (p?.imageinfo) await take(have, meta, subject, p, county); else console.log(`${title}: not found`);
  }
  for (const h of have.filter((x) => !x.county && x.lat != null)) h.county = await countyOf(h.lat, h.lon);
  writeFileSync(meta, JSON.stringify(have, null, 2));
  console.log(`${have.length} photos in ${meta}`);
}

// ---- judge: which country? ----

// The question names no country: the first wording asked for "the county (maakond), if the
// country is Estonia", and that alone moved real photos from 11 to 19 of 20 in Estonia (kept as `primed`).
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>"}`;

function cfToken() {
  if (process.env.CF_TOKEN) return process.env.CF_TOKEN;
  return execFileSync('npx', ['wrangler', 'auth', 'token'], { cwd: here('../../apps/gateway/'), encoding: 'utf8' }).trim().split('\n').pop().trim();
}

function pictures() {
  const gen = MODELS.flatMap((m) => tasks.filter((t) => existsSync(`${OUT}${m}/${t.id}.jpg`))
    .map((t) => ({ kind: 'generated', model: m, task: t.id, subject: t.subject, variant: t.variant, file: `${OUT}${m}/${t.id}.jpg` })));
  const real = existsSync(`${REAL}photos.json`) ? JSON.parse(readFileSync(`${REAL}photos.json`, 'utf8')).map((p) =>
    ({ kind: 'real', model: 'real', task: p.id, subject: p.subject, variant: 'real', county: p.county, file: `${REAL}${p.id}.jpg` })) : [];
  return [...gen, ...real];
}

// The Sonnet sample: 10 pictures, the same every run (5 generated, 5 real, spread over subjects).
function sample(all) {
  const pick = (xs, n) => xs.sort((a, b) => a.hash.localeCompare(b.hash)).slice(0, n);
  return [...pick(all.filter((p) => p.kind === 'generated' && p.variant === 'named'), 5), ...pick(all.filter((p) => p.kind === 'real'), 5)];
}

async function judge(names) {
  const token = cfToken();
  const cache = `${OUT}geo-cache.jsonl`;
  const done = new Map(readJsonl(cache).filter((r) => r.country).map((r) => [`${r.judge}|${r.hash}`, r]));
  const small = `${OUT}.geo/`;
  mkdirSync(small, { recursive: true });
  const all = pictures().map((p) => ({ ...p, hash: createHash('sha256').update(readFileSync(p.file)).digest('hex').slice(0, 16) }));
  for (const name of names) {
    const J = JUDGES[name];
    const todo = (name === 'sonnet' ? sample(all) : all).filter((p) => !done.has(`${J.id}|${p.hash}`));
    let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (i < todo.length) {
        const p = todo[i++];
        const shrunk = `${small}${p.hash}.jpg`; // 1024 px longest side, no metadata
        if (!existsSync(shrunk)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', p.file, '-map_metadata', '-1', '-vf', "scale='min(1024,iw)':-2", '-q:v', '3', shrunk]);
        const url = `data:image/jpeg;base64,${readFileSync(shrunk).toString('base64')}`;
        const row = { judge: J.id, hash: p.hash, kind: p.kind, model: p.model, task: p.task };
        const t0 = Date.now();
        for (let attempt = 1; attempt <= 3 && !row.country; attempt++) {
          try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`, {
              method: 'POST',
              headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'cf-aig-gateway-id': 'visualia' },
              body: JSON.stringify({ model: J.id, max_tokens: 2000, messages: [{ role: 'user', content: [
                { type: 'text', text: QUESTION }, { type: 'image_url', image_url: { url } }] }] }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.errors ?? data.error ?? data).slice(0, 200)}`);
            const text = data.choices?.[0]?.message?.content ?? '';
            const answer = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
            if (!answer?.country) throw new Error(`no answer: ${String(text).slice(0, 120)}`);
            Object.assign(row, answer, { usage: data.usage ?? null, attempt });
            // Thinking tokens are billed as output; total - prompt counts them.
            const u = data.usage;
            row.usd = u ? ((u.prompt_tokens ?? 0) * J.in + ((u.total_tokens ?? 0) - (u.prompt_tokens ?? 0) || (u.completion_tokens ?? 0)) * J.out) / 1e6 : null;
            delete row.error;
          } catch (e) { row.error = e.message; }
        }
        row.latency = Date.now() - t0;
        appendFileSync(cache, JSON.stringify(row) + '\n');
        console.log(`${name.padEnd(6)} ${p.model.padEnd(18)} ${p.task.padEnd(20)} ${row.country ?? 'FAILED ' + row.error} ${row.confidence ?? ''} ${row.region ?? ''}`);
      }
    }));
  }
}

// ---- report ----

const norm = (c) => {
  const s = String(c ?? '').trim();
  if (/^estonia/i.test(s)) return 'Estonia';
  if (/^(unknown|n\/a|none)$/i.test(s) || !s) return 'unknown';
  return s.replace(/^the /i, '');
};

function report() {
  const rows = readJsonl(`${OUT}geo-cache.jsonl`).filter((r) => r.country);
  const all = pictures().map((p) => ({ ...p, hash: createHash('sha256').update(readFileSync(p.file)).digest('hex').slice(0, 16) }));
  const answer = (judge, p) => rows.findLast((r) => r.judge === judge && r.hash === p.hash);
  const flash = JUDGES.flash.id;
  const placed = all.map((p) => ({ ...p, a: answer(flash, p) })).filter((p) => p.a);
  const share = (xs) => xs.length ? `${Math.round((100 * xs.filter((x) => norm(x.a.country) === 'Estonia').length) / xs.length)} % (${xs.filter((x) => norm(x.a.country) === 'Estonia').length}/${xs.length})` : '-';
  const others = (xs) => {
    const n = {};
    for (const x of xs) { const c = norm(x.a.country); if (c !== 'Estonia') n[c] = (n[c] ?? 0) + 1; }
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(', ') || '-';
  };
  const group = (label, xs) => `| ${label} | ${share(xs)} | ${others(xs)} |`;
  const gen = placed.filter((p) => p.kind === 'generated');
  const real = placed.filter((p) => p.kind === 'real');
  const out = [];
  out.push(`Judge ${flash}: share placed in Estonia, and what else\n`);
  out.push('| pictures | Estonia | elsewhere |', '|---|---:|---|');
  out.push(group('real photos (Commons)', real), group('generated, prompt names Estonia', gen.filter((p) => p.variant === 'named')),
    group('generated, no country in prompt', gen.filter((p) => p.variant === 'neutral')));
  out.push('\nBy model (generated, prompt names Estonia | no country)\n', '| model | named | elsewhere | neutral | elsewhere |', '|---|---:|---|---:|---|');
  for (const m of MODELS) {
    const xs = gen.filter((p) => p.model === m);
    const nm = xs.filter((p) => p.variant === 'named'), nt = xs.filter((p) => p.variant === 'neutral');
    out.push(`| ${m} | ${share(nm)} | ${others(nm)} | ${share(nt)} | ${others(nt)} |`);
  }
  out.push('\nBy subject (generated named | generated neutral | real)\n', '| subject | named | elsewhere | neutral | elsewhere | real | real elsewhere |', '|---|---:|---|---:|---|---:|---|');
  for (const s of [...new Set(tasks.map((t) => t.subject))]) {
    const nm = gen.filter((p) => p.subject === s && p.variant === 'named'), nt = gen.filter((p) => p.subject === s && p.variant === 'neutral');
    const rl = real.filter((p) => p.subject === s);
    out.push(`| ${s} | ${share(nm)} | ${others(nm)} | ${share(nt)} | ${others(nt)} | ${share(rl)} | ${others(rl)} |`);
  }
  // Region: for pictures placed in Estonia, the county the judge named.
  out.push('\nRegions named (placed in Estonia)\n');
  for (const p of placed.filter((x) => norm(x.a.country) === 'Estonia')) {
    const t = tasks.find((x) => x.id === p.task);
    out.push(`- ${p.model}/${p.task}: ${p.a.region ?? '-'}${p.kind === 'real' ? ` (Commons: ${p.county ?? '?'})` : t?.county ? ` (expected ${t.county})` : ''}`);
  }
  // Confidence
  const mean = (xs) => xs.length ? (xs.reduce((a, x) => a + (Number(x.a.confidence) || 0), 0) / xs.length).toFixed(2) : '-';
  // The primed first run (the question named Estonia), for comparison.
  const pr = all.map((p) => ({ ...p, a: answer(JUDGES.primed.id, p) })).filter((p) => p.a);
  if (pr.length) {
    out.push('\nThe same, asked the primed way (the question mentioned Estonia)\n', '| pictures | Estonia | elsewhere |', '|---|---:|---|');
    out.push(group('real photos', pr.filter((p) => p.kind === 'real')), group('generated, named', pr.filter((p) => p.kind === 'generated' && p.variant === 'named')),
      group('generated, neutral', pr.filter((p) => p.kind === 'generated' && p.variant === 'neutral')));
  }
  out.push(`\nMean confidence: real ${mean(real)}, generated ${mean(gen)}`);
  // Sonnet against Flash on the sample
  const son = all.map((p) => ({ ...p, s: answer(JUDGES.sonnet.id, p), f: answer(flash, p) })).filter((p) => p.s && p.f);
  if (son.length) {
    out.push(`\nSonnet sample (${JUDGES.sonnet.id}), ${son.length} pictures; same country as Flash: ${son.filter((p) => norm(p.s.country) === norm(p.f.country)).length}`);
    for (const p of son) out.push(`- ${p.model}/${p.task}: Flash ${norm(p.f.country)} ${p.f.confidence}, Sonnet ${norm(p.s.country)} ${p.s.confidence} (${p.s.region ?? '-'}): ${p.s.reason}`);
  }
  const usd = rows.reduce((a, r) => a + (r.usd ?? 0), 0);
  out.push(`\nJudging: ${rows.length} answers, about $${usd.toFixed(3)}`);
  let gusd = 0;
  for (const p of gen) { const j = p.file.replace(/\.jpg$/, '.json'); if (existsSync(j)) { const u = JSON.parse(readFileSync(j, 'utf8')).usage ?? {}; gusd += u.cost_usd ?? (u.neurons ?? 0) * 0.011 / 1000; } }
  out.push(`Pictures with a gateway price: about $${gusd.toFixed(2)}`);
  console.log(out.join('\n'));
}

// Reasons, to read: every answer with the judge's sentence.
function reasons() {
  const rows = readJsonl(`${OUT}geo-cache.jsonl`).filter((r) => r.country && r.judge === JUDGES.flash.id);
  for (const r of rows) console.log(`${r.model}/${r.task}: ${r.country} ${r.confidence} ${r.region ?? ''} | ${r.reason}`);
}

if (cmd === 'commons') await commons();
else if (cmd === 'judge') await judge(rest.length ? rest : ['flash']);
else if (cmd === 'report') report();
else if (cmd === 'reasons') reasons();
else console.log('node nature.mjs commons | judge [flash|sonnet ...] | report | reasons');
