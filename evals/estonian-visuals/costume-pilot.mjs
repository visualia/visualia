// Folk costume reconstruction pilot (plans/folk-costumes.md): does the expert
// text pull a picture model back toward a parish's real costume? Research
// only; everything stays in the git-ignored out/rahvaroivad/pilot/.
//
//   KEY_PERSON=eka-teacher node costume-pilot.mjs generate
//   node costume-pilot.mjs judge
//   node costume-pilot.mjs report
//
// Variants per parish (women's costume):
//   plain  "<Parish> women's folk costume", through the live gateway
//   text   a prompt built from the extracted garments, through the gateway
//   refs   the text prompt plus reference photos, nano-banana-2-lite by REST
//          (data URLs; FLUX.3 klein's `images` takes only http(s) URLs)
// Real photos held out from the references go through the same judge as a
// control. The judge (STRONG in costume-extract.mjs) answers every criterion
// of both parishes (its own and the other one's) and, in a separate call that
// sees no criteria, names the parish.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chat, parseJson, ACCOUNT, cfToken, STRONG } from './costume-extract.mjs';

const here = (p) => new URL(p, import.meta.url).pathname;
const OUT = here('out/rahvaroivad/pilot/');
const EXTRACTED = here('out/rahvaroivad/extracted/');
const GATEWAY = process.env.GATEWAY ?? 'https://gw.visualia.space';
const MODELS = ['flux-3-image-klein', 'nano-banana-2-lite'];
const SAMPLES = Number(process.env.SAMPLES ?? 2);
const PARISHES = (process.env.PARISHES ?? 'muhu,kihnu').split(',');
const NAMES = { muhu: 'Muhu', kihnu: 'Kihnu' };
// Photos: references go to the model, held-out ones only to the judge.
const PHOTOS = JSON.parse(process.env.PHOTOS ?? 'null') ?? {
  // Muhu: one 2026 set (Reine Ülem-Truuts, photos Sandra Urvak): front, side, apron (nano-banana-2-lite takes at most 3); two
  // other full-length views held out. Kihnu: the three photos fetched on 2026-11-09 (front; back
  // and side held out); the site's other Kihnu photos had not arrived yet.
  muhu: { refs: [39071, 39055, 39057].map((id) => `rahvaroivad/photos/${id}.jpg`), held: [39050, 39049].map((id) => `rahvaroivad/photos/${id}.jpg`) },
  kihnu: { refs: ['costumes/kihnu-1.jpg'], held: ['costumes/kihnu-2.jpg', 'costumes/kihnu-3.jpg'] },
};
mkdirSync(OUT, { recursive: true });

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}

// A JPEG shrunk to `px` on its longest side, as base64.
function jpeg(path, px = 768) {
  const tmp = `${OUT}.tmp-${process.pid}.jpg`;
  execFileSync('sips', ['-Z', String(px), '-s', 'format', 'jpeg', path, '--out', tmp], { stdio: 'ignore' });
  return readFileSync(tmp).toString('base64');
}

const extracted = (slug) => JSON.parse(readFileSync(`${EXTRACTED}${slug}-naine.json`, 'utf8'));

function textPrompt(slug) {
  const x = extracted(slug);
  const parts = x.garments.map((g) => `${g.type_en} (${g.type}): ${g.description_en}`);
  let p = `A full-length documentary photograph of a woman standing, wearing the traditional women's folk costume of ${NAMES[slug]} parish, Estonia${x.period ? `, ${x.period}` : ''}. ${x.summary} The costume: `;
  for (const s of parts) if ((p + s).length < 1900) p += s + ' ';
  return p.trim();
}

async function viaGateway(model, prompt) {
  const res = await fetch(`${GATEWAY}/v1/images`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '768x1024' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.detail ?? data.error ?? ''}`);
  return { b64: data.data[0].b64_json, usage: data.usage };
}

async function withRefs(prompt, refs) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfToken()}`, 'cf-aig-gateway-id': 'visualia', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'google/nano-banana-2-lite', input: {
      prompt: `${prompt} The reference photos show real reproductions of this parish's costume: draw a new photograph of a different woman in the same costume, full length, keeping its garments, colours and patterns faithful to the references.`,
      image_input: refs.map((r) => `data:image/jpeg;base64,${jpeg(here(`out/${r}`), 768)}`), aspect_ratio: '3:4', resolution: '1K' } }),
  });
  const data = await res.json().catch(() => ({}));
  let img = data.result?.result?.image ?? data.result?.image;
  if (!img) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  if (/^https?:/.test(img)) img = Buffer.from(await (await fetch(img)).arrayBuffer()).toString('base64');
  return { b64: img.replace(/^data:image\/\w+;base64,/, ''), usage: data.result?.usage ?? null };
}

async function generate() {
  for (const slug of PARISHES) {
    const jobs = [];
    for (const model of MODELS) {
      jobs.push({ variant: 'plain', model, prompt: `${NAMES[slug]} women's folk costume` });
      jobs.push({ variant: 'text', model, prompt: textPrompt(slug) });
    }
    jobs.push({ variant: 'refs', model: 'nano-banana-2-lite', prompt: textPrompt(slug) });
    for (const job of jobs) for (let n = 1; n <= SAMPLES; n++) {
      const name = `${slug}-${job.variant}-${job.model}-${n}`;
      if (existsSync(`${OUT}${name}.jpg`)) continue;
      const t = Date.now();
      try {
        const r = job.variant === 'refs' ? await withRefs(job.prompt, PHOTOS[slug].refs) : await viaGateway(job.model, job.prompt);
        writeFileSync(`${OUT}${name}.jpg`, Buffer.from(r.b64, 'base64'));
        writeFileSync(`${OUT}${name}.json`, JSON.stringify({ ...job, parish: slug, n, refs: job.variant === 'refs' ? PHOTOS[slug].refs : [], usage: r.usage, ms: Date.now() - t }, null, 2));
        console.log(`${name} ${((Date.now() - t) / 1000).toFixed(0)} s`);
      } catch (err) { console.log(`${name} failed: ${err.message.slice(0, 200)}`); }
    }
  }
}

// Every picture to judge: generated ones and the held-out real photos.
function pictures() {
  const list = [];
  for (const slug of PARISHES) {
    for (const p of PHOTOS[slug].held) list.push({ id: `${slug}-real-${p.split('/').pop().replace('.jpg', '')}`, parish: slug, variant: 'real', model: 'photo', path: here(`out/${p}`) });
    for (const model of MODELS) for (const variant of ['plain', 'text', 'refs']) for (let n = 1; n <= SAMPLES; n++) {
      const id = `${slug}-${variant}-${model}-${n}`;
      if (existsSync(`${OUT}${id}.jpg`)) list.push({ id, parish: slug, variant, model, path: `${OUT}${id}.jpg` });
    }
  }
  return list;
}

// A judge call, asked again (up to 3 times) when the answer is not JSON.
async function ask(messages, max_tokens) {
  let last;
  for (let i = 0; i < 3; i++) {
    const r = await chat(messages, { max_tokens });
    try { return { data: parseJson(r.text ?? ''), usage: r.usage }; } catch { last = r.text; }
  }
  throw new Error(`no JSON: ${String(last).slice(0, 200)}`);
}

const JUDGE_SYSTEM = 'You look at one photograph of a person in clothing and answer questions about what is visible. Answer with one JSON object only.';

async function judge() {
  const cache = `${OUT}judge.jsonl`;
  const done = new Set(existsSync(cache) ? readFileSync(cache, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.id}|${r.kind}|${r.criteria_of ?? ''}`; }) : []);
  const crit = Object.fromEntries(PARISHES.map((s) => [s, extracted(s).criteria]));
  for (const pic of pictures()) {
    const img = { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg(pic.path, 768)}` } };
    for (const of of PARISHES) {
      if (done.has(`${pic.id}|criteria|${of}`)) continue;
      const qs = crit[of].map((c, i) => `${i + 1}. ${c.question}`).join('\n');
      const { data: ans, usage } = await ask([{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: [img, { type: 'text', text:
        `A photograph of a woman in clothing. Answer each question by looking only at the picture. If the thing asked about is not visible, answer no.\n${qs}\n\nJSON: {"answers": [{"n": 1, "yes": true|false, "why": "a few words"}]}` }] }], 2000);
      const a = ans.answers;
      appendFileSync(cache, JSON.stringify({ ...pic, path: undefined, kind: 'criteria', criteria_of: of, answers: a, usage }) + '\n');
      console.log(`${pic.id} vs ${of}: ${a.filter((x) => x.yes).length}/${a.length}`);
    }
    if (!done.has(`${pic.id}|parish|`)) {
      const { data: a, usage } = await ask([{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: [img, { type: 'text', text:
        'Is this an Estonian folk costume? If so, which parish (kihelkond) is it from? Give your best guess and two alternatives, and the visible details you based it on.\nJSON: {"estonian": true|false, "parish": "name", "alternatives": ["", ""], "confidence": 0.0-1.0, "details": "short"}' }] }], 1500);
      appendFileSync(cache, JSON.stringify({ ...pic, path: undefined, kind: 'parish', answer: a, usage }) + '\n');
      console.log(`${pic.id}: parish ${a.parish} (${a.alternatives?.join(', ')}) ${a.confidence}`);
    }
  }
}

function report() {
  const rows = readFileSync(`${OUT}judge.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const groups = {};
  for (const r of rows) {
    const g = (groups[`${r.parish}|${r.variant}|${r.model}`] ??= { parish: r.parish, variant: r.variant, model: r.model, own: [0, 0], other: [0, 0], hits: 0, n: 0, guesses: [] });
    if (r.kind === 'criteria') {
      const k = r.criteria_of === r.parish ? 'own' : 'other';
      g[k][0] += r.answers.filter((a) => a.yes).length;
      g[k][1] += r.answers.length;
    } else {
      g.n++;
      const p = String(r.answer.parish ?? '').toLowerCase();
      if (p.includes(r.parish)) g.hits++;
      g.guesses.push(r.answer.parish);
    }
  }
  const pct = ([a, b]) => (b ? Math.round((100 * a) / b) : '–');
  console.log('| parish | variant | model | own criteria % | other parish\'s criteria % | parish named | judge\'s guesses |');
  console.log('|---|---|---|---:|---:|---:|---|');
  for (const g of Object.values(groups)) console.log(`| ${NAMES[g.parish]} | ${g.variant} | ${g.model} | ${pct(g.own)} | ${pct(g.other)} | ${g.hits}/${g.n} | ${g.guesses.join(', ')} |`);
  const tok = rows.reduce((s, r) => [s[0] + (r.usage?.prompt_tokens ?? 0), s[1] + (r.usage?.completion_tokens ?? 0)], [0, 0]);
  console.log(`\njudge (${STRONG}): ${rows.length} calls, ${tok[0]} tokens in, ${tok[1]} out`);
}

const cmd = process.argv[2];
if (cmd === 'generate') await generate();
else if (cmd === 'judge') await judge();
else if (cmd === 'report') report();
else console.log('usage: node costume-pilot.mjs generate | judge | report');
