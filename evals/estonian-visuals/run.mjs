// Estonian visuals: EKI's 10 image prompts × image models, each picture judged
// by Clef-flash one yes/no criterion at a time. See plans/estonian-visuals.md.
// Usage:
//   node run.mjs generate [model ...]   pictures into out/<model>/<task>.jpg (kept: reruns skip them)
//   node run.mjs judge                  every criterion for every picture, into out/results.jsonl
//   node run.mjs report                 model × task scores, per-criterion averages, agreement with labels.json
//   node run.mjs sheet <task> [...]     out/sheet-<task>.png, one row of all models (order printed)
// Env: GATEWAY (default the local gateway, http://127.0.0.1:8788), KEY_PERSON (a name in
// ../../.keys.local; default: the scratchpad key.txt for a local gateway, else eka-test-001).

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const GATEWAY = (process.env.GATEWAY ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const LOCAL_KEY = '/private/tmp/claude-501/-Users-s32863-personal-visualia/c64fd4b3-959f-4f86-ac2c-89ef81b310b8/scratchpad/key.txt';
const JUDGE = '@cf/cloudflare/clef-flash';
const CUT = 0.5; // default cut-off; a criterion can set its own `cut`
const MODELS = ['flux-2-klein-4b', 'flux-2-klein-9b', 'flux-2-dev', 'flux-1-schnell', 'phoenix-1.0',
  'lucid-origin', 'sdxl', 'sdxl-lightning', 'dreamshaper-8-lcm', 'dalle-mini'];
const NEURON_USD = 0.011 / 1000; // Workers AI
const CLEF_USD = 0.00003; // a call, measured 2026-11-09

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/');
const tasks = JSON.parse(readFileSync(here('./tasks.json'), 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);

function key() {
  const person = process.env.KEY_PERSON;
  if (!person && /127\.0\.0\.1|localhost/.test(GATEWAY)) return readFileSync(LOCAL_KEY, 'utf8').trim().split(': ').pop(); // "key (...): <key>"
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[person ?? 'eka-test-001'];
  if (!k) throw new Error(`no key for ${person} in .keys.local`);
  return k;
}

async function post(path, body) {
  const res = await fetch(GATEWAY + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.detail ?? data.error ?? ''}`.slice(0, 200));
  return data;
}

// Run fn over items, n at a time.
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// Any picture to a JPEG; side = longest side in px (null keeps the size).
function toJpeg(input, output, side = null) {
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', ...(side ? ['-Z', String(side)] : []), input, '--out', output], { stdio: 'ignore' });
}

// ---- generate ----

async function generate(models) {
  const cloud = models.filter((m) => m !== 'dalle-mini');
  const jobs = cloud.flatMap((model) => tasks.map((task) => ({ model, task })))
    .filter(({ model, task }) => !existsSync(`${OUT}${model}/${task.id}.jpg`));
  await pool(jobs, 4, async ({ model, task }) => {
    mkdirSync(`${OUT}${model}`, { recursive: true });
    let err;
    for (let attempt = 1; attempt <= 3; attempt++) { // klein 9B fails about 1 call in 3
      const t0 = Date.now();
      try {
        const data = await post('/v1/images', { prompt: task.prompt, size: '1024x1024', model });
        const raw = `${OUT}${model}/${task.id}.raw`;
        writeFileSync(raw, Buffer.from(data.data[0].b64_json, 'base64'));
        toJpeg(raw, `${OUT}${model}/${task.id}.jpg`);
        rmSync(raw);
        const seconds = (Date.now() - t0) / 1000;
        writeFileSync(`${OUT}${model}/${task.id}.json`, JSON.stringify({ model, task: task.id, size: data.size, seconds, usage: data.usage, attempt }));
        console.log(`${model.padEnd(18)} ${task.id.padEnd(14)} ${seconds.toFixed(1)}s`);
        return;
      } catch (e) { err = e; }
    }
    console.log(`${model.padEnd(18)} ${task.id.padEnd(14)} failed: ${err.message}`);
  });
  if (models.includes('dalle-mini')) await dalleMini();
}

// DALL·E mini in a Chrome tab (apps/pool-app/dalle-mini, models already fetched there).
async function dalleMini() {
  const todo = tasks.filter((t) => !existsSync(`${OUT}dalle-mini/${t.id}.jpg`));
  if (!todo.length) return;
  const dir = here('../../apps/pool-app/dalle-mini/');
  if (!existsSync(`${dir}models/manifest.json`)) throw new Error('run apps/pool-app/dalle-mini/fetch.sh first');
  mkdirSync(`${OUT}dalle-mini`, { recursive: true });
  const port = await freePort();
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
  try {
    const page = await browser.newPage();
    for (let i = 0; i < 20; i++) { // the server needs a moment
      try { await page.goto(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
    }
    for (const task of todo) {
      const t0 = Date.now();
      await page.fill('#prompt', task.prompt);
      await page.fill('#seed', '1');
      await page.click('#go');
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Drawing'), null, { timeout: 120000 });
      await page.waitForFunction(() => /^(Done|Stopped)/.test(document.getElementById('status').textContent), null, { timeout: 300000 });
      const status = await page.textContent('#status');
      if (status.startsWith('Stopped')) { console.log(`dalle-mini         ${task.id.padEnd(14)} ${status}`); continue; }
      const png = await page.evaluate(() => document.getElementById('out').toDataURL('image/png'));
      const raw = `${OUT}dalle-mini/${task.id}.png`;
      writeFileSync(raw, Buffer.from(png.split(',')[1], 'base64'));
      toJpeg(raw, `${OUT}dalle-mini/${task.id}.jpg`);
      rmSync(raw);
      const seconds = (Date.now() - t0) / 1000;
      writeFileSync(`${OUT}dalle-mini/${task.id}.json`, JSON.stringify({ model: 'dalle-mini', task: task.id, size: '256x256', seconds, seed: 1, usage: { cost_usd: 0 } }));
      console.log(`dalle-mini         ${task.id.padEnd(14)} ${seconds.toFixed(1)}s`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

function freePort() {
  return new Promise((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

// ---- judge ----

const CACHE = `${OUT}judge-cache.jsonl`;
const RESULTS = `${OUT}results.jsonl`;
const cacheKey = (hash, q) => `${JUDGE}|${hash}|${q}`;

function readJsonl(file) {
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

function pictures() {
  if (!existsSync(OUT)) return [];
  return readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'costumes' && !d.name.startsWith('.'))
    .flatMap((d) => tasks.filter((t) => existsSync(`${OUT}${d.name}/${t.id}.jpg`)).map((task) => ({ model: d.name, task, file: `${OUT}${d.name}/${task.id}.jpg` })));
}

async function judge() {
  const cache = new Map(readJsonl(CACHE).filter((r) => r.probability != null).map((r) => [r.key, r]));
  const small = `${OUT}.small/`;
  mkdirSync(small, { recursive: true });
  const jobs = [];
  for (const pic of pictures()) {
    const bytes = readFileSync(pic.file);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    // The judge sees one picture, at most 512 px, as a JPEG.
    const shrunk = `${small}${hash}.jpg`;
    if (!existsSync(shrunk)) toJpeg(pic.file, shrunk, 512);
    const url = `data:image/jpeg;base64,${readFileSync(shrunk).toString('base64')}`;
    for (const c of pic.task.criteria) jobs.push({ ...pic, hash, url, c });
  }
  let asked = 0;
  await pool(jobs.filter((j) => !cache.has(cacheKey(j.hash, j.c.q))), 6, async (j) => {
    const t0 = Date.now();
    const row = { key: cacheKey(j.hash, j.c.q), judge: JUDGE };
    try {
      const data = await post('/v1/decide', {
        model: JUDGE,
        state: j.task.state, // the subject only: never the prompt or the expected answer
        images: [j.url],
        questions: { q: { type: 'noul', instructions: j.c.q } },
      });
      row.probability = data.answers?.q?.noul;
      if (typeof row.probability !== 'number') throw new Error(`no probability: ${JSON.stringify(data).slice(0, 120)}`);
      row.tokens = data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? null;
      row.neurons = data.usage?.neurons ?? null;
    } catch (e) { row.probability = null; row.error = e.message; }
    row.latency = Date.now() - t0;
    appendFileSync(CACHE, JSON.stringify(row) + '\n');
    if (row.probability != null) cache.set(row.key, row);
    else console.log(`${j.model} ${j.task.id} ${j.c.id}: ${row.error}`);
    if (++asked % 50 === 0) console.log(`${asked} asked`);
  });
  const out = jobs.map((j) => {
    const r = cache.get(cacheKey(j.hash, j.c.q));
    return { task: j.task.id, model: j.model, criterion: j.c.id, probability: r?.probability ?? null,
      judge: JUDGE, latency: r?.latency ?? null, tokens: r?.tokens ?? null, picture: j.hash, ...(r ? {} : { error: 'not judged' }) };
  });
  writeFileSync(RESULTS, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${asked} asked, ${out.length} results in out/results.jsonl`);
}

// ---- report ----

function report() {
  const rows = readJsonl(RESULTS);
  const crit = Object.fromEntries(tasks.flatMap((t) => t.criteria.map((c) => [`${t.id}/${c.id}`, c])));
  const pass = (r) => r.probability != null && r.probability >= (crit[`${r.task}/${r.criterion}`]?.cut ?? CUT);
  const models = [...new Set(rows.map((r) => r.model))];
  const pct = (rs) => (rs.length ? Math.round((100 * rs.filter(pass).length) / rs.length) : null);

  const lines = [`| model | ${tasks.map((t) => t.id).join(' | ')} | all |`, `|---|${tasks.map(() => '---:').join('|')}|---:|`];
  const scored = models.map((m) => {
    const rs = rows.filter((r) => r.model === m);
    return { m, all: pct(rs), cells: tasks.map((t) => pct(rs.filter((r) => r.task === t.id)) ?? '-') };
  }).sort((a, b) => b.all - a.all);
  for (const s of scored) lines.push(`| ${s.m} | ${s.cells.join(' | ')} | ${s.all} |`);
  console.log(`Score: share of criteria passing (cut-off ${CUT} unless a criterion sets one), %\n\n${lines.join('\n')}\n`);

  const cl = ['| criterion | mean p | pass % |', '|---|---:|---:|'];
  for (const [id] of Object.entries(crit)) {
    const rs = rows.filter((r) => `${r.task}/${r.criterion}` === id && r.probability != null);
    if (!rs.length) continue;
    cl.push(`| ${id} | ${(rs.reduce((a, r) => a + r.probability, 0) / rs.length).toFixed(2)} | ${pct(rs)} |`);
  }
  console.log(`Per criterion, over all models\n\n${cl.join('\n')}\n`);

  // Cost: generation from the gateway's usage, judging at Clef's price.
  let usd = 0, unknown = 0;
  for (const p of pictures()) {
    const meta = existsSync(p.file.replace(/\.jpg$/, '.json')) ? JSON.parse(readFileSync(p.file.replace(/\.jpg$/, '.json'), 'utf8')) : {};
    const u = meta.usage ?? {};
    if (u.cost_usd != null) usd += u.cost_usd; else if (u.neurons != null) usd += u.neurons * NEURON_USD; else unknown++;
  }
  console.log(`Cost: pictures about $${usd.toFixed(2)} (${unknown} with no published price), judging about $${(rows.length * CLEF_USD).toFixed(3)} for ${rows.length} calls`);

  // Agreement with eye labels (labels.json: { model: { task: { criterion: true|false } } }).
  const labelsFile = here('./labels.json');
  if (!existsSync(labelsFile)) return;
  const labels = JSON.parse(readFileSync(labelsFile, 'utf8'));
  const agree = {};
  for (const r of rows) {
    const eye = labels[r.model]?.[r.task]?.[r.criterion];
    if (typeof eye !== 'boolean' || r.probability == null) continue;
    const a = (agree[r.task] ??= { n: 0, same: 0, misses: [] });
    a.n++;
    if (pass(r) === eye) a.same++; else a.misses.push(`${r.model}/${r.criterion} eye ${eye ? 'yes' : 'no'} p=${r.probability.toFixed(2)}`);
  }
  console.log('\nJudge against eye labels');
  for (const [t, a] of Object.entries(agree)) {
    console.log(`${t}: ${a.same}/${a.n} (${Math.round((100 * a.same) / a.n)}%)`);
    for (const m of a.misses) console.log(`  ${m}`);
  }
}

// ---- contact sheet ----

function sheet(ids) {
  const models = MODELS.filter((m) => existsSync(`${OUT}${m}`));
  for (const id of ids) {
    const files = models.map((m) => `${OUT}${m}/${id}.jpg`).filter(existsSync);
    const inputs = files.flatMap((f) => ['-i', f]);
    const scale = files.map((_, i) => `[${i}]scale=256:256[s${i}]`).join(';');
    const filter = `${scale};${files.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${files.length}`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, `${OUT}sheet-${id}.png`]);
    console.log(`out/sheet-${id}.png: ${files.map((f) => f.split('/').at(-2)).join(', ')}`);
  }
}

// ---- page: every picture with the judge's answers, to read in a browser ----

function page() {
  const rows = readJsonl(RESULTS);
  const labels = existsSync(here('./labels.json')) ? JSON.parse(readFileSync(here('./labels.json'), 'utf8')) : {};
  const models = MODELS.filter((m) => existsSync(`${OUT}${m}`));
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const score = (m, t) => {
    const rs = rows.filter((r) => r.model === m && r.task === t.id);
    const ok = rs.filter((r) => r.probability >= (t.criteria.find((c) => c.id === r.criterion)?.cut ?? CUT));
    return rs.length ? Math.round((100 * ok.length) / rs.length) : null;
  };
  const sections = tasks.map((t) => {
    const cards = models.filter((m) => existsSync(`${OUT}${m}/${t.id}.jpg`)).map((m) => {
      const lines = t.criteria.map((c) => {
        const r = rows.find((x) => x.model === m && x.task === t.id && x.criterion === c.id);
        const p = r?.probability;
        const yes = p != null && p >= (c.cut ?? CUT);
        const eye = labels[m]?.[t.id]?.[c.id];
        const wrong = eye != null && p != null && eye !== yes;
        return `<li class="${yes ? 'yes' : 'no'}${wrong ? ' wrong' : ''}"><span class="p" style="--p:${Math.round((p ?? 0) * 100)}%">${p == null ? '–' : p.toFixed(2)}</span><span>${esc(c.q)}${wrong ? ` <b>Eye: ${eye ? 'yes' : 'no'}</b>` : ''}</span></li>`;
      }).join('');
      return `<figure><img src="${m}/${t.id}.jpg" loading="lazy" alt=""><figcaption><b>${esc(m)}</b> <span class="quiet">${score(m, t) ?? '–'}%</span></figcaption><ul>${lines}</ul></figure>`;
    }).join('');
    return `<section><h2>${esc(t.id)}</h2><p class="quiet">${esc(t.prompt)}</p><div class="grid">${cards}</div></section>`;
  }).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Estonian visuals, judged</title><link rel="stylesheet" href="../../../packages/style/visualia.css">
<style>
  main { max-width: 1400px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--m); }
  figure { margin: 0; display: grid; gap: var(--s); align-content: start; }
  img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; font-size: 0.85rem; }
  li { display: grid; grid-template-columns: 3rem 1fr; gap: var(--s); align-items: baseline; }
  li.no { opacity: var(--quiet); }
  li.wrong { opacity: 1; outline: 1px solid currentColor; outline-offset: 1px; }
  .p { font-variant-numeric: tabular-nums; background: linear-gradient(to right, color-mix(in srgb, currentColor 20%, transparent) var(--p), transparent 0); }
</style></head><body><main>
<header><h1>Estonian visuals, judged</h1><p>Every picture and Clef-flash's answer to each question: the probability of yes, full ink when it passes (cut-off ${CUT}), quiet when not. A box marks where the judge and the eye labels disagree.</p></header>
${sections}</main></body></html>`;
  writeFileSync(`${OUT}index.html`, html);
  console.log(`${OUT}index.html`);
}

// ---- publish: small pictures and the results for the studio page /estonia ----

const ABOUT = {
  'flux-2-dev': ['FLUX.2 dev', 'Black Forest Labs', 'Cloudflare'],
  'flux-2-klein-9b': ['FLUX.2 klein 9B', 'Black Forest Labs', 'Cloudflare'],
  'flux-2-klein-4b': ['FLUX.2 klein 4B', 'Black Forest Labs', 'Cloudflare'],
  'flux-1-schnell': ['FLUX.1 schnell', 'Black Forest Labs', 'Cloudflare'],
  'lucid-origin': ['Lucid Origin', 'Leonardo', 'Cloudflare'],
  'phoenix-1.0': ['Phoenix 1.0', 'Leonardo', 'Cloudflare'],
  'sdxl': ['SDXL 1.0', 'Stability AI', 'Cloudflare'],
  'sdxl-lightning': ['SDXL Lightning', 'ByteDance', 'Cloudflare'],
  'dalle-mini': ['DALL·E mini', 'Boris Dayma, 2022', 'a browser tab'],
  'dreamshaper-8-lcm': ['Dreamshaper 8 LCM', 'Lykon', 'Cloudflare'],
};

function publish() {
  const dest = here('../../apps/studio/public/estonia/');
  const rows = readJsonl(RESULTS);
  const cutOf = (t, c) => t.criteria.find((x) => x.id === c)?.cut ?? CUT;
  const models = MODELS.filter((m) => existsSync(`${OUT}${m}`)).map((id) => {
    const pictures = tasks.map((t) => {
      const file = `${OUT}${id}/${t.id}.jpg`;
      if (!existsSync(file)) return null;
      mkdirSync(`${dest}${id}`, { recursive: true });
      toJpeg(file, `${dest}${id}/${t.id}.jpg`, 256);
      const answers = t.criteria.map((c) => rows.find((r) => r.model === id && r.task === t.id && r.criterion === c.id)?.probability ?? null);
      const passed = answers.filter((p, i) => p != null && p >= cutOf(t, t.criteria[i].id)).length;
      return { answers, score: Math.round((100 * passed) / t.criteria.length) };
    });
    const all = rows.filter((r) => r.model === id);
    const pass = all.filter((r) => r.probability >= cutOf(tasks.find((t) => t.id === r.task), r.criterion)).length;
    const [name, maker, runs] = ABOUT[id] ?? [id, '', ''];
    return { id, name, maker, runs, score: all.length ? Math.round((100 * pass) / all.length) : null, pictures };
  }).sort((a, b) => b.score - a.score);
  const data = {
    date: new Date().toISOString().slice(0, 10), judge: JUDGE, cut: CUT,
    tasks: tasks.map((t) => ({ id: t.id, name: t.name ?? t.id, prompt: t.prompt, questions: t.criteria.map((c) => c.q) })),
    models,
  };
  writeFileSync(`${dest}data.json`, JSON.stringify(data));
  console.log(`${dest}: ${models.length} models, data.json`);
}

if (cmd === 'generate') await generate(rest.length ? rest : MODELS);
else if (cmd === 'judge') await judge();
else if (cmd === 'report') report();
else if (cmd === 'sheet') sheet(rest.length ? rest : tasks.map((t) => t.id));
else if (cmd === 'page') page();
else if (cmd === 'publish') publish();
else console.log('node run.mjs generate [model ...] | judge | report | sheet [task ...] | page | publish');
