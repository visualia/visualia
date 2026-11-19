// Folk costumes, round two (plans/folk-costumes.md): the 12 women's costumes of
// the confusable pairs. Research only; everything stays in the git-ignored
// out/rahvaroivad/round2/.
//
//   KEY_PERSON=eka-teacher node costume-round2.mjs criteria v1 cal   # calibration photos, extracted criteria
//   node costume-round2.mjs criteria v1 held                         # held-out photos, "before"
//   node costume-round2.mjs criteria v2 held                         # held-out photos, calibrated criteria
//   node costume-round2.mjs identify                                 # judge test on held-out photos
//   node costume-round2.mjs generate                                 # plain, text, text+refs
//   node costume-round2.mjs criteria v2 gen && node costume-round2.mjs identify gen
//   node costume-round2.mjs report
//
// Photos are split by reproduction where a parish has more than one (Kihnu,
// Setomaa, Tõstamaa, Kadrina by shoot); elsewhere by view of the one set on
// disk, and then held-out photos and references show the same garments.
// Criteria: v1 = out/rahvaroivad/extracted/<slug>-naine.json, v2 =
// out/rahvaroivad/round2/criteria-v2/<slug>.json (calibrated by hand from the
// calibration answers, every criterion still carrying its source sentence).
// Judges through the live gateway (/v1/chat/completions), pictures through
// /v1/images; KEY_PERSON names the course key in .keys.local.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = (p) => new URL(p, import.meta.url).pathname;
const R = here('out/rahvaroivad/');
const OUT = `${R}round2/`;
const PILOT = `${R}pilot/`;
const GATEWAY = process.env.GATEWAY ?? 'https://gw.visualia.space';
const GEMINI = 'google/gemini-3.8-flash';
const SONNET = 'anthropic/claude-sonnet-5.5';
mkdirSync(`${OUT}gen/`, { recursive: true });
mkdirSync(`${OUT}.jpg/`, { recursive: true });

export const PAIRS = [['muhu', 'kihnu'], ['halliste', 'tarvastu'], ['emmaste', 'kihelkonna'], ['setomaa', 'rapina'], ['vormsi', 'noarootsi'], ['tostamaa', 'kadrina']];
const PARTNER = Object.fromEntries(PAIRS.flatMap(([a, b]) => [[a, b], [b, a]]));
export const NAMES = { muhu: 'Muhu', kihnu: 'Kihnu', halliste: 'Halliste', tarvastu: 'Tarvastu', emmaste: 'Emmaste', kihelkonna: 'Kihelkonna',
  setomaa: 'Setomaa', rapina: 'Räpina', vormsi: 'Vormsi', noarootsi: 'Noarootsi', tostamaa: 'Tõstamaa', kadrina: 'Kadrina' };
export const REGION = { muhu: 'Saared', kihnu: 'Saared', halliste: 'Lõuna', tarvastu: 'Lõuna', emmaste: 'Saared', kihelkonna: 'Saared',
  setomaa: 'Setomaa', rapina: 'Lõuna', vormsi: 'Saared', noarootsi: 'Lääne', tostamaa: 'Lääne', kadrina: 'Põhja' };

// Women's full-length photos on disk (media ids), checked by eye 2026-11-16.
// cal: calibration (and the few-shot judge's examples); held: held out, only
// ever shown to the judge; refs: given to the picture model (never held-out ones).
export const SETS = {
  muhu: { cal: [39071, 39055, 39062, 39068], held: [39049, 39050, 39064, 39066], refs: [39071, 39055, 39057],
    split: 'view', note: 'one set (Reine Ülem-Truuts 2026, photos Sandra Urvak), with and without the large shawl' },
  kihnu: { cal: [24015, 24011, 24013], held: [23977, 23981], refs: [24015, 24011, 24013],
    split: 'reproduction', note: 'red kört set (cal, refs) against the half-red kört set (held); no photographer named' },
  halliste: { cal: [], held: [], refs: [], split: 'none', note: 'only a summer linen skirt on a stand (Kadri Zoova) on disk: no photo of a woman' },
  tarvastu: { cal: [18181], held: [], refs: [18181], split: 'none', note: 'one photo, from behind, on a stand' },
  emmaste: { cal: [38949, 38946], held: [38948, 38942, 38941], refs: [38949, 38946, 38947],
    split: 'view', note: 'one set (Liisa Johanna Lukk 2026, photos Sandra Urvak)' },
  kihelkonna: { cal: [6139, 6137], held: [6141, 6132, 6134], refs: [6139, 6137, 6128],
    split: 'view', note: 'one set, with and without the long coat; no photographer named' },
  setomaa: { cal: [5055], held: [5118], refs: [5102, 5100],
    split: 'reproduction', note: 'married woman in blue: one seated photo (cal) and one standing (held); references from the young woman\'s white costume, another reproduction (a girl stands with her)' },
  rapina: { cal: [3974, 3969], held: [3977, 3971], refs: [3974, 3969, 3964],
    split: 'view', note: 'one set, with a cardigan and with a long coat; untagged wearer, title says woman' },
  vormsi: { cal: [38171, 38173, 38185], held: [38176, 38179, 38183, 38186], refs: [38171, 38173, 38185],
    split: 'view', note: 'one set (Veronika Isberg 2025, photos Sandra Urvak), with and without the cardigan' },
  noarootsi: { cal: [19768], held: [19766, 19767], refs: [19768], split: 'view', note: 'one set, three photos' },
  tostamaa: { cal: [38262, 38264], held: [38263, 38266, 38267], refs: [38786, 38780, 38804],
    split: 'view', note: 'summer set (Jana Tamm 2025) split by view for cal and held; references from a winter set (Anu Randmaa 2026), another reproduction and another variant; photos Sandra Urvak. The winter sets (Anu Randmaa, Mariann Kolju) were tried for calibration first: the coat hides what the criteria ask' },
  kadrina: { cal: [39019, 39021], held: [39029, 39027, 39028], refs: [39019, 39021, 39025],
    split: 'shoot', note: 'Kertu Simson 2024 (cal, refs) against 2026 with the pottmüts cap (held): same wearer, likely shared garments' },
};
const photoPath = (id) => (existsSync(`${R}photos/${id}.jpg`) ? `${R}photos/${id}.jpg` : id === 5055 ? here('out/costumes/setomaa-2.jpg') : null);

const keyOf = () => {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
};
const KEY = keyOf();

// A JPEG shrunk to `px` on its longest side, as a data URL (cached on disk).
function dataUrl(path, px = 768) {
  const tmp = `${OUT}.jpg/${path.replace(/[^a-z0-9]/gi, '_')}-${px}.jpg`;
  if (!existsSync(tmp)) execFileSync('sips', ['-Z', String(px), '-s', 'format', 'jpeg', path, '--out', tmp], { stdio: 'ignore' });
  return `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`;
}

const PRICE = { [GEMINI]: [0.75, 3.75], [SONNET]: [2, 10] };
const spent = () => (existsSync(`${OUT}spend.jsonl`) ? readFileSync(`${OUT}spend.jsonl`, 'utf8').trim().split('\n').filter(Boolean).reduce((s, l) => s + JSON.parse(l).usd, 0) : 0);
const BUDGET = Number(process.env.BUDGET ?? 5);
function charge(what, usd) {
  appendFileSync(`${OUT}spend.jsonl`, JSON.stringify({ what, usd }) + '\n');
  if (spent() > BUDGET) throw new Error(`budget of $${BUDGET} reached`);
}

export function parseJson(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  return JSON.parse(text.slice(s, e + 1));
}

async function chat(model, content, max_tokens = 3000) {
  for (let i = 1; ; i++) {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens, ...(model === GEMINI ? { reasoning_effort: 'low' } : {}), messages: [{ role: 'user', content }] }),
    });
    const data = await res.json().catch(() => ({}));
    const text = data.choices?.[0]?.message?.content;
    if (res.ok && text) {
      const u = data.usage ?? {};
      const [pin, pout] = PRICE[model];
      charge(model, ((u.prompt_tokens ?? 0) * pin + ((u.completion_tokens ?? 0) + (u.completion_tokens_details?.reasoning_tokens ?? 0)) * pout) / 1e6);
      try { return parseJson(text); } catch { if (i >= 3) throw new Error(`no JSON: ${text.slice(0, 200)}`); continue; }
    }
    if (i >= 3) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 4000 * i));
  }
}

const criteriaOf = (slug, version) => {
  if (version === 'v1') return JSON.parse(readFileSync(`${R}extracted/${slug}-naine.json`, 'utf8')).criteria;
  const f = `${OUT}criteria-v2/${slug}.json`;
  return JSON.parse(readFileSync(f, 'utf8')).criteria.filter((c) => c.status !== 'dropped');
};

// Every picture of a kind: real calibration or held-out photos, or generated ones.
function pictures(kind) {
  const list = [];
  for (const [slug, s] of Object.entries(SETS)) {
    if (kind === 'cal' || kind === 'held') for (const id of s[kind]) list.push({ id: `${slug}-${kind}-${id}`, parish: slug, variant: kind === 'held' ? 'real' : 'cal', model: 'photo', path: photoPath(id) });
    if (kind === 'gen') for (const g of generated()) if (g.parish === slug) list.push(g);
  }
  return list;
}

const JUDGE = `A photograph of a person in clothing (if there are several people, look only at the adult woman). Answer each question by looking only at the picture:
"yes" if it is visibly so, "no" if that part is visible and is different, "hidden" if that part cannot be seen (covered, out of frame, or turned away).`;

// Both parishes' criteria of a pair in one call, as one numbered list.
async function criteria(version, kind, judge = GEMINI) {
  const cache = `${OUT}criteria-${version}.jsonl`;
  const rows = existsSync(cache) ? readFileSync(cache, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(rows.map((r) => `${r.id}|${r.judge}`));
  for (const pic of pictures(kind)) {
    if (done.has(`${pic.id}|${judge}`)) continue;
    const of = [pic.parish, PARTNER[pic.parish]];
    const qs = of.flatMap((slug) => criteriaOf(slug, version).map((c, i) => ({ slug, i, q: c.question })));
    const text = `${JUDGE}\n${qs.map((x, n) => `${n + 1}. ${x.q}`).join('\n')}\n\nJSON: {"answers": [{"n": 1, "a": "yes"|"no"|"hidden"}]}`;
    let ans;
    try { ans = (await chat(judge, [{ type: 'image_url', image_url: { url: dataUrl(pic.path) } }, { type: 'text', text }])).answers; } catch (err) { console.log(`${pic.id}: ${err.message}`); if (/budget/.test(err.message)) return; continue; }
    const by = Object.fromEntries(ans.map((a) => [a.n, String(a.a).toLowerCase()]));
    const answers = Object.fromEntries(of.map((slug) => [slug, qs.map((x, n) => ({ ...x, a: by[n + 1] ?? 'hidden' })).filter((x) => x.slug === slug).map((x) => x.a)]));
    appendFileSync(cache, JSON.stringify({ ...pic, path: undefined, kind, judge, answers }) + '\n');
    console.log(`${pic.id} ${judge.split('/')[1]}: own ${answers[pic.parish].join(' ')}`);
  }
}

const PARISH_LIST = ['Emmaste', 'Halliste', 'Kadrina', 'Kihelkonna', 'Kihnu', 'Muhu', 'Noarootsi', 'Räpina', 'Setomaa', 'Tarvastu', 'Tõstamaa', 'Vormsi'];
const ASK = `Which Estonian folk costume is this? Look only at the clothing (if there are several people, the adult woman).
(a) Region, one of: Põhja (North Estonia), Lääne (West Estonia), Lõuna (South Estonia), Saared (the islands), Setomaa.
(b) Parish (kihelkond), one of: ${PARISH_LIST.join(', ')}; or "other" if it is none of these.
JSON: {"region": "...", "parish": "...", "confidence": 0.0-1.0, "details": "the visible details you based it on, short"}`;

const slugOfName = (n) => Object.entries(NAMES).find(([, v]) => v.toLowerCase() === String(n ?? '').trim().toLowerCase())?.[0] ?? 'other';

// Region and parish, no hints; and with 2 labelled calibration photos of each parish of the pair (few-shot).
async function identify(kind = 'held', judges = [GEMINI, SONNET], modes = ['alone', 'fewshot']) {
  const cache = `${OUT}identify.jsonl`;
  const rows = existsSync(cache) ? readFileSync(cache, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(rows.map((r) => `${r.id}|${r.judge}|${r.mode}`));
  for (const pic of pictures(kind)) for (const judge of judges) for (const mode of modes) {
    if (done.has(`${pic.id}|${judge}|${mode}`)) continue;
    const content = [];
    if (mode === 'fewshot') {
      const pair = [pic.parish, PARTNER[pic.parish]].sort((a, b) => (pic.id.length % 2 ? a.localeCompare(b) : b.localeCompare(a)));
      content.push({ type: 'text', text: 'Labelled reference photos of two parishes\' women\'s costumes (modern reproductions):' });
      for (const slug of pair) for (const id of SETS[slug].cal.slice(0, 2)) content.push({ type: 'text', text: `Reference: ${NAMES[slug]}` }, { type: 'image_url', image_url: { url: dataUrl(photoPath(id), 512) } });
      content.push({ type: 'text', text: 'The photo to identify (it may or may not be one of the two):' });
    }
    content.push({ type: 'image_url', image_url: { url: dataUrl(pic.path) } }, { type: 'text', text: ASK });
    let a;
    try { a = await chat(judge, content, 3000); } catch (err) { console.log(`${pic.id}: ${err.message}`); if (/budget/.test(err.message)) return; continue; }
    const row = { ...pic, path: undefined, judge, mode, answer: a, region_ok: String(a.region ?? '').toLowerCase().startsWith(REGION[pic.parish].toLowerCase().slice(0, 4)), parish_guess: slugOfName(a.parish) };
    row.parish_ok = row.parish_guess === pic.parish;
    appendFileSync(cache, JSON.stringify(row) + '\n');
    console.log(`${pic.id} ${judge.split('/')[1]} ${mode}: ${a.region} / ${a.parish} ${a.confidence} ${row.parish_ok ? 'OK' : ''}`);
  }
}

// ---- generation ----
function textPrompt(slug, budget = 1900) {
  const x = JSON.parse(readFileSync(`${R}extracted/${slug}-naine.json`, 'utf8'));
  let p = `A full-length documentary photograph of a woman standing, wearing the traditional women's folk costume of ${NAMES[slug]} parish, Estonia${x.period ? `, ${x.period}` : ''}. ${x.summary} The costume: `;
  for (const g of x.garments) { const s = `${g.type_en} (${g.type}): ${g.description_en}`; if ((p + s).length < budget) p += s + ' '; }
  return p.trim();
}
const REFS_NOTE = 'The reference photos show a real reproduction of this costume. Draw a new photograph: a different woman, in a different place and pose, wearing the same costume, full length, its garments, colours and patterns faithful to the references. ';
const MODELS = (process.env.MODELS ?? 'flux-3-image-klein,nano-banana-2-lite').split(',');
const REF_MODELS = (process.env.REF_MODELS ?? 'nano-banana-2-lite').split(',');
const SAMPLES = Number(process.env.SAMPLES ?? 2);
const IMAGE_USD = { 'flux-3-image-klein': 0.009, 'nano-banana-2-lite': 0.039, 'gpt-image-2': 0.05, 'nano-banana-pro': 0.134 };

function jobs() {
  const list = [];
  for (const slug of Object.keys(SETS)) {
    for (const model of MODELS) {
      list.push({ parish: slug, variant: 'plain', model, prompt: `${NAMES[slug]} women's folk costume` });
      list.push({ parish: slug, variant: 'text', model, prompt: textPrompt(slug) });
    }
    if (SETS[slug].refs.length) for (const model of REF_MODELS) list.push({ parish: slug, variant: 'refs', model, prompt: REFS_NOTE + textPrompt(slug, 2000 - REFS_NOTE.length - 10), refs: SETS[slug].refs });
  }
  return list.flatMap((j) => Array.from({ length: SAMPLES }, (_, k) => ({ ...j, n: k + 1, name: `${j.parish}-${j.variant}-${j.model}-${k + 1}` })));
}

// The pilot's Muhu and Kihnu plain and text pictures are the same prompts on the same models: reused.
const pilotCopy = (j) => (j.variant !== 'refs' && ['muhu', 'kihnu'].includes(j.parish) && existsSync(`${PILOT}${j.name}.jpg`) ? `${PILOT}${j.name}.jpg` : null);

function generated() {
  return jobs().map((j) => ({ id: j.name, parish: j.parish, variant: j.variant, model: j.model, path: pilotCopy(j) ?? `${OUT}gen/${j.name}.jpg` })).filter((g) => existsSync(g.path));
}

async function generate() {
  for (const j of jobs()) {
    if (pilotCopy(j) || existsSync(`${OUT}gen/${j.name}.jpg`)) continue;
    if (spent() + (IMAGE_USD[j.model] ?? 0.05) > BUDGET) { console.log('budget reached'); return; }
    const t = Date.now();
    const body = { model: j.model, prompt: j.prompt, size: '768x1024' };
    if (j.refs) body.references = j.refs.map((id) => dataUrl(photoPath(id), 768));
    let res;
    try { res = await fetch(`${GATEWAY}/v1/images`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch (err) { console.log(`${j.name} failed: ${err.message}`); continue; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.data?.[0]?.b64_json) { console.log(`${j.name} failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`); continue; }
    charge(j.model, data.usage?.cost_usd ?? IMAGE_USD[j.model] ?? 0.05);
    writeFileSync(`${OUT}gen/${j.name}.jpg`, Buffer.from(data.data[0].b64_json, 'base64'));
    writeFileSync(`${OUT}gen/${j.name}.json`, JSON.stringify({ ...j, usage: data.usage, ms: Date.now() - t }, null, 2));
    console.log(`${j.name} ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
}

// ---- report ----
const read = (f) => (existsSync(`${OUT}${f}`) ? readFileSync(`${OUT}${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}` : '–');
// Share of criteria answered yes, among those the judge could see (yes or no).
function rate(rows, slug, of, filter = () => true) {
  let y = 0, v = 0;
  for (const r of rows.filter((r) => r.parish === slug && filter(r))) for (const a of r.answers[of] ?? []) { if (a === 'yes') y++; if (a !== 'hidden') v++; }
  return [y, v];
}

function report() {
  const v1 = read('criteria-v1.jsonl').filter((r) => r.judge === GEMINI);
  const v2 = read('criteria-v2.jsonl').filter((r) => r.judge === GEMINI);
  console.log('## Criteria per criterion on calibration photos (v1, Gemini; Sonnet in brackets)');
  const v1s = read('criteria-v1.jsonl').filter((r) => r.judge === SONNET);
  for (const slug of Object.keys(SETS)) {
    const cs = criteriaOf(slug, 'v1');
    const cal = v1.filter((r) => r.parish === slug && r.kind === 'cal');
    const cals = v1s.filter((r) => r.parish === slug && r.kind === 'cal');
    console.log(`\n${NAMES[slug]} (${cal.length} photos)`);
    cs.forEach((c, i) => console.log(`  ${i + 1}. ${cal.map((r) => r.answers[slug][i][0]).join('')} [${cals.map((r) => r.answers[slug][i][0]).join('')}] ${c.question}`));
  }
  console.log('\n## Held-out ceiling, before (v1) and after (v2); cross = this parish\'s photos on the partner\'s criteria');
  console.log('| parish | held-out photos | v1 own | v1 cross | v2 own | v2 cross |');
  for (const slug of Object.keys(SETS)) {
    const h = (rows, of) => { const [y, v] = rate(rows.filter((r) => r.kind === 'held'), slug, of); return `${pct(y, v)} (${y}/${v})`; };
    console.log(`| ${NAMES[slug]} | ${SETS[slug].held.length} | ${h(v1, slug)} | ${h(v1, PARTNER[slug])} | ${h(v2, slug)} | ${h(v2, PARTNER[slug])} |`);
  }
  const id = read('identify.jsonl');
  console.log('\n## Judge test, held-out photos');
  for (const judge of [GEMINI, SONNET]) for (const mode of ['alone', 'fewshot']) {
    const rs = id.filter((r) => r.judge === judge && r.mode === mode && r.variant === 'real');
    console.log(`${judge} ${mode}: region ${rs.filter((r) => r.region_ok).length}/${rs.length}, parish ${rs.filter((r) => r.parish_ok).length}/${rs.length}, pair-partner named ${rs.filter((r) => r.parish_guess === PARTNER[r.parish]).length}`);
    for (const r of rs) console.log(`   ${r.id}: ${r.answer.region} / ${r.answer.parish} (${r.answer.confidence})`);
  }
  console.log('\n## Generated, v2 criteria (own %, partner %), parish named by Gemini alone');
  for (const [a, b] of PAIRS) {
    console.log(`\n${NAMES[a]} / ${NAMES[b]}`);
    console.log('| parish | variant | model | own % | partner % | parish named | guesses |');
    for (const slug of [a, b]) {
      const [y, v] = rate(v2.filter((r) => r.kind === 'held'), slug, slug);
      console.log(`| ${NAMES[slug]} | real held-out | photo | ${pct(y, v)} | ${pct(...rate(v2.filter((r) => r.kind === 'held'), slug, PARTNER[slug]))} | ${id.filter((r) => r.parish === slug && r.variant === 'real' && r.judge === GEMINI && r.mode === 'alone' && r.parish_ok).length}/${id.filter((r) => r.parish === slug && r.variant === 'real' && r.judge === GEMINI && r.mode === 'alone').length} | |`);
      const groups = {};
      for (const g of generated().filter((g) => g.parish === slug)) (groups[`${g.variant}|${g.model}`] ??= []).push(g.id);
      for (const [k, ids] of Object.entries(groups)) {
        const [variant, model] = k.split('|');
        const f = (r) => ids.includes(r.id);
        const own = rate(v2.filter((r) => r.kind === 'gen'), slug, slug, f);
        const oth = rate(v2.filter((r) => r.kind === 'gen'), slug, PARTNER[slug], f);
        const g = id.filter((r) => ids.includes(r.id) && r.judge === GEMINI && r.mode === 'alone');
        console.log(`| ${NAMES[slug]} | ${variant} | ${model} | ${pct(...own)} | ${pct(...oth)} | ${g.filter((r) => r.parish_ok).length}/${g.length} | ${g.map((r) => r.answer.parish).join(', ')} |`);
      }
    }
  }
  console.log(`\nspent (own count): $${spent().toFixed(2)}`);
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
if (cmd === 'criteria') await criteria(a1, a2, a3 === 'sonnet' ? SONNET : GEMINI);
else if (cmd === 'identify') await identify(a1 ?? 'held', a1 === 'gen' ? [GEMINI] : [GEMINI, SONNET], a1 === 'gen' ? ['alone'] : ['alone', 'fewshot']);
else if (cmd === 'generate') await generate();
else if (cmd === 'report') report();
else if (cmd === 'jobs') for (const j of jobs()) console.log(j.name, pilotCopy(j) ? '(pilot)' : '', j.prompt.length);
else console.log('usage: node costume-round2.mjs criteria v1|v2 cal|held|gen [sonnet] | identify [gen] | generate | report');
