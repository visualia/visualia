// Folk costumes, drift measured (plans/folk-costumes.md): drift as the distance from the real
// costume, over every parish with enough women's photos. Research only; everything stays in the
// git-ignored out/rahvaroivad/drift/.
//
//   node costume-drift.mjs photos                 women's full-figure photos per parish, grouped by reproduction
//   node costume-drift.mjs extract                checks per parish, for the variant the photos show (Gemini 3.8 Flash)
//   node costume-drift.mjs calibrate              calibration photos on their own checks
//   node costume-drift.mjs refine                 checks that real photos fail rewritten or dropped (Gemini, then by rule)
//   node costume-drift.mjs validity               held-out photos on their own and the confusable parishes' checks
//   node costume-drift.mjs generate               plain prompt on the image models; expert text on two
//   node costume-drift.mjs judge                  every picture on its parish's checks
//   node costume-drift.mjs report                 tables, out/rahvaroivad/drift/drift.json
//
// Photo split: by reproduction (the maker's name in the file name, else the caption): one
// reproduction calibrates, the others are held out and only ever shown to the judge.
// Judges and pictures through the live gateway; KEY_PERSON names the course key in .keys.local.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = (p) => new URL(p, import.meta.url).pathname;
const R = here('out/rahvaroivad/');
const OUT = `${R}drift/`;
const JPG = process.env.JPG_CACHE ?? `${OUT}.jpg/`;
const GATEWAY = process.env.GATEWAY ?? 'https://gw.visualia.space';
const GEMINI = 'google/gemini-3.8-flash';
mkdirSync(`${OUT}gen/`, { recursive: true });
mkdirSync(JPG, { recursive: true });

const readJ = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const readL = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const terms = readJ(`${R}terms.json`);
const { media } = readJ(`${R}media.json`);
const { entries } = readJ(`${R}entries.json`);
const NAINE = terms.kandja.find((k) => k.slug === 'naine').id;
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---- photos ----
// A photo on disk that really is a picture (some downloads saved an HTML error page).
const isImage = (id) => {
  const f = `${R}photos/${id}.jpg`;
  if (!existsSync(f)) return false;
  const b = readFileSync(f).subarray(0, 12);
  return (b[0] === 0xff && b[1] === 0xd8) || b.toString('latin1', 1, 4) === 'PNG' || b.toString('latin1', 8, 12) === 'WEBP';
};
const STOP = new Set(['khk', 'kihelkonna', 'kihelkond', 'naine', 'naise', 'naised', 'naiste', 'saj', 'sajandi', 'pool', 'keskpaik', 'keskel', 'lopp', 'algus',
  'esimene', 'teine', 'scaled', 'jpg', 'jpeg', 'png', 'tagant', 'kyljelt', 'kuljelt', 'eest', 'triigitud', 'rahvaroivad', 'rahvariided', 'rahvaroivais',
  'rahvariietes', 'komplektis', 'pikk', 'kuue', 'kuub', 'kuues', 'kampsun', 'suvised', 'talvised', 'paastuaja', 'argiroivad', 'nooriku', 'noor', 'noore']);
function repTokens(m, parish) {
  const file = fold(decodeURIComponent((m.full || m.src || '').split('/').pop()));
  const ptoks = new Set(fold(parish.name).split(/[^a-z]+/));
  return file.replace(/\.[a-z]+$/g, '').split(/[^a-z]+/).filter((t) => t.length > 2 && !STOP.has(t) && !ptoks.has(t) && !/detail/.test(t) && !/ga$/.test(t)
    && !/^(ii|iii)$/.test(t) && !/^(ja|ning|ning)$/.test(t));
}
const isDetail = (m) => /detail/i.test(decodeURIComponent((m.full || m.src || '') + m.title));
const isBack = (m) => /tagant/i.test(decodeURIComponent((m.full || m.src || '') + m.title));
// The variant a photo's title (or file name) names: period and kind.
function variantOf(m) {
  const s = fold(`${m.title} ${decodeURIComponent((m.full || m.src || '').split('/').pop())}`).replace(/[_-]/g, ' ');
  const c = s.match(/(18|19|20)\.? ?saj/)?.[1] ?? '';
  let part = '';
  if (/\b(ii|teine) pool/.test(s)) part = 'II pool'; else if (/\b(i|esimene) pool/.test(s)) part = 'I pool';
  else if (/keskpaik|keskel/.test(s)) part = 'keskpaik'; else if (/lopp/.test(s) && /algus/.test(s)) part = 'lõpp-algus'; else if (/lopp/.test(s)) part = 'lõpp'; else if (/algus/.test(s)) part = 'algus';
  const kind = /suvis/.test(s) ? ' suvised' : /talvis/.test(s) ? ' talvised' : /paastuaja/.test(s) ? ' paastuaja' : /argi/.test(s) ? ' argi' : /nooriku/.test(s) ? ' nooriku' : '';
  return `${c ? `${c}. saj` : 'aeg?'}${part ? ` ${part}` : ''}${kind}`;
}

function photos() {
  const parishes = terms.kihelkond.filter((k) => k.parent);
  const firsts = parishes.map((k) => fold(k.name).split(/[^a-z]+/)[0]).filter((f) => f.length >= 4);
  const otherParish = (m, own, ownFull) => firsts.some((f) => f !== own && !own.startsWith(f) && !f.startsWith(own) && new RegExp(`\\b${f}`).test(fold(m.title).replace(ownFull, '')));
  const out = {};
  for (const p of parishes) {
    const first = fold(p.name).split(/[^a-z]+/)[0];
    const ms = media.filter((m) => m.kihelkond.includes(p.id) && !m.eseme_tyyp.length && isImage(m.id)
      && fold(m.title + ' ' + (m.full || m.src)).includes(first.slice(0, 4))
      && (m.kandja.includes(NAINE) || /nai/i.test(m.title)) && !/neiu|tudruk|mehe|mees|poiss|perekond|laste|lapse/.test(fold(m.title + (m.full || ''))) && !isDetail(m) && !otherParish(m, first, fold(p.name)));
    // Reproductions: photos whose maker tokens overlap, joined (union-find); no tokens: by title and caption.
    const toks = ms.map((m) => new Set(repTokens(m, p)));
    const parent = ms.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < ms.length; i++) for (let j = 0; j < i; j++) {
      const a = toks[i], b = toks[j];
      const shared = [...a].filter((t) => b.has(t)).length;
      const same = a.size && b.size ? shared >= Math.min(2, a.size, b.size) : !a.size && !b.size && ms[i].title === ms[j].title && ms[i].caption === ms[j].caption;
      if (same) parent[find(i)] = find(j);
    }
    const groups = {};
    ms.forEach((m, i) => (groups[find(i)] ??= []).push(m));
    const reps = Object.values(groups).map((g) => ({
      key: [...new Set(g.flatMap((m) => repTokens(m, p)))].slice(0, 6).join(' ') || `(${g[0].title})`,
      variant: [...new Set(g.map(variantOf))].join(' | '),
      photographer: [...new Set(g.map((m) => m.photographer).filter(Boolean))].join(', ') || null,
      caption: g[0].caption || null,
      ids: g.map((m) => m.id), front: g.filter((m) => !isBack(m)).map((m) => m.id),
    })).sort((a, b) => b.ids.length - a.ids.length);
    const naineEntries = entries.filter((e) => e.kihelkond.includes(p.id) && e.kandja.includes(NAINE));
    out[p.slug] = { name: p.name, id: p.id, region: terms.kihelkond.find((k) => k.id === p.parent)?.name, entries: naineEntries.map((e) => ({ id: e.id, title: e.title, chars: e.text.length })), reps };
  }
  writeFileSync(`${OUT}photos.json`, JSON.stringify(out, null, 1));
  const rows = Object.entries(out).map(([s, x]) => [s, x.reps.reduce((n, r) => n + r.ids.length, 0), x.reps.length, x.entries.length, x]).sort((a, b) => b[1] - a[1]);
  for (const [s, n, k, e, x] of rows) {
    console.log(`${s}: ${n} photos, ${k} reproductions, ${e} entries`);
    if (process.env.V) for (const r of x.reps) console.log(`    ${r.ids.length} (${r.front.length} front) [${r.variant}] ${r.key} | ${r.caption?.slice(0, 50) ?? ''}`);
  }
}

// ---- gateway ----
const KEY = (() => {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
})();
const spent = () => readL(`${OUT}spend.jsonl`).reduce((s, x) => s + x.usd, 0);
const BUDGET = Number(process.env.BUDGET ?? 5);
function charge(what, usd) {
  appendFileSync(`${OUT}spend.jsonl`, JSON.stringify({ what, usd }) + '\n');
  if (spent() > BUDGET) throw new Error(`budget of $${BUDGET} reached`);
}
function diskGuard() {
  const free = Number(execFileSync('df', ['-g', process.env.HOME]).toString().trim().split('\n').pop().split(/\s+/)[3]);
  if (free < 8) throw new Error(`disk guard: ${free} GB free`);
  return free;
}
export function parseJson(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  return JSON.parse(text.slice(s, e + 1));
}
async function chat(content, { max_tokens = 4000, effort = 'low', what = GEMINI } = {}) {
  for (let i = 1; ; i++) {
    let res, data;
    try {
      res = await fetch(`${GATEWAY}/v1/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: GEMINI, max_tokens, reasoning_effort: effort, messages: [{ role: 'user', content }] }),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) { data = { error: err.message }; res = { ok: false, status: 0 }; }
    const text = data.choices?.[0]?.message?.content;
    if (res.ok && text) {
      const u = data.usage ?? {};
      charge(what, ((u.prompt_tokens ?? 0) * 0.75 + ((u.completion_tokens ?? 0) + (u.completion_tokens_details?.reasoning_tokens ?? 0)) * 3.75) / 1e6);
      try { return parseJson(text); } catch { if (i >= 3) throw new Error(`no JSON: ${text.slice(0, 200)}`); continue; }
    }
    if (i >= 3) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 4000 * i));
  }
}
// A JPEG shrunk to `px` on its longest side, as a data URL (cached).
function dataUrl(path, px = 768) {
  const tmp = `${JPG}${path.replace(/[^a-z0-9]/gi, '_')}-${px}.jpg`;
  if (!existsSync(tmp)) execFileSync('sips', ['-Z', String(px), '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', path, '--out', tmp], { stdio: 'ignore' });
  return `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`;
}
const photoPath = (id) => `${R}photos/${id}.jpg`;
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; await fn(x); } }));
}

// ---- extraction ----
const SYSTEM = `You read Estonian folk costume descriptions written by experts (rahvaroivad.ee) and turn them into data.
The text may describe several periods or variants (older and newer, bride, summer and winter). You are also given the variants
that the site's photos of modern reproductions show, with how many separate reproductions (different makers) each has.
Pick the festive married woman's costume that (1) the text describes fully and (2) has the most reproductions in the photos,
preferring at least two reproductions. Name it in "period", list in "photo_variants" the photo variant labels (exactly as given)
that show this same costume, and keep the garments and criteria to that one.
Answer with one JSON object, nothing else:
{
  "variants": ["the other periods or variants the text describes, one short English line each"],
  "summary": "two English sentences: what makes this parish's costume recognisable",
  "period": "as the text gives it, or null",
  "photo_variants": ["labels from the list"],
  "garments": [
    { "type": "Estonian garment name as in the text", "type_en": "English",
      "colours": ["english"], "materials": ["english"], "techniques": ["english"],
      "museum_refs": ["exactly as written, e.g. ERM A 291:158"],
      "description_en": "one or two sentences",
      "source_sentence": "the Estonian sentence this garment's colours and look come from, copied verbatim" }
  ],
  "criteria": [
    { "question": "an English yes/no question a person can answer by looking at a full-length photo of a woman wearing the costume",
      "garment": "type, Estonian",
      "source_sentence": "the Estonian sentence it comes from, copied verbatim, character for character" }
  ]
}
Rules for criteria: 6 to 8 of them. Each one concrete and visible at full length: a colour, a stripe direction, a shape, a headdress, a pattern placement.
Prefer what tells this parish apart from its neighbours over what every Estonian costume has (a white linen shirt alone is not distinctive).
Ask one thing per question. Say it plainly, without "not". No counting beyond two. Never name the parish in a question.
Skip outer garments worn only in winter or for church (long coats, fur coats, large shawls) and anything usually hidden under other garments.
Never invent: every claim must come from the text. If the text gives choices (red or blue), the question allows both.`;
const norm = (s) => s.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

function variantCounts(x) {
  const c = {};
  for (const r of x.reps) for (const v of r.variant.split(' | ')) { c[v] ??= { reps: 0, photos: 0 }; c[v].reps++; c[v].photos += r.front.length; }
  return c;
}
// Candidates: a women's entry, at least 2 reproductions and 4 front photos.
function candidates() {
  const P = readJ(`${OUT}photos.json`);
  const ok = [], skip = [];
  for (const [slug, x] of Object.entries(P)) {
    const front = x.reps.reduce((n, r) => n + r.front.length, 0);
    if (!x.entries.length) skip.push([slug, 'no women\'s entry']);
    else if (front < 4) skip.push([slug, `${front} photos`]);
    else if (x.reps.length < 2) skip.push([slug, 'one reproduction']);
    else {
      // The best variant: most reproductions; "aeg?" and a bare century count for any variant of that century.
      const vs = Object.keys(variantCounts(x));
      const fits = (r, v) => r.variant.split(' | ').some((w) => w === v || w === 'aeg?' || (/^\d+\. saj$/.test(w) && v.startsWith(w)));
      const best = Math.max(...vs.map((v) => x.reps.filter((r) => fits(r, v)).length));
      const bestFront = Math.max(...vs.map((v) => x.reps.filter((r) => fits(r, v)).reduce((n, r) => n + r.front.length, 0)));
      if (best < 2) skip.push([slug, 'one reproduction per variant']); else if (bestFront < 4) skip.push([slug, `${bestFront} photos of one variant`]); else ok.push(slug);
    }
  }
  return { P, ok, skip };
}

async function extract() {
  const { P, ok } = candidates();
  mkdirSync(`${OUT}extracted/`, { recursive: true });
  const todo = (args.length ? args : ok).filter((s) => !existsSync(`${OUT}extracted/${s}.json`));
  await pool(todo, 4, async (slug) => {
    const x = P[slug];
    const entry = entries.find((e) => e.id === [...x.entries].sort((a, b) => b.chars - a.chars)[0].id);
    const vc = variantCounts(x);
    const list = Object.entries(vc).map(([v, c]) => `- "${v}": ${c.reps} reproduction(s), ${c.photos} photos`).join('\n');
    const msg = `${SYSTEM}\n\nParish: ${x.name}. Wearer: woman. Title: ${entry.title}\nPhoto variants (labels: period from the photo titles; "aeg?" = no period given):\n${list}\n\nTEXT:\n${entry.text}`;
    let d;
    try { d = await chat([{ type: 'text', text: msg }], { max_tokens: 9000, effort: 'low', what: 'extract' }); } catch (err) { console.log(`${slug}: ${err.message.slice(0, 200)}`); return; }
    const body = norm(entry.text);
    const check = (c) => ({ ...c, quote_ok: !!c.source_sentence && body.includes(norm(c.source_sentence)) });
    const rec = { slug, parish: x.name, region: x.region, entry: entry.id, link: entry.link, title: entry.title, model: GEMINI, ...d,
      garments: (d.garments ?? []).map(check), criteria: (d.criteria ?? []).map(check) };
    writeFileSync(`${OUT}extracted/${slug}.json`, JSON.stringify(rec, null, 1));
    console.log(`${slug}: ${rec.period} [${rec.photo_variants?.join(', ')}] ${rec.criteria.length} checks, ${rec.criteria.filter((c) => !c.quote_ok).length} quotes not found`);
  });
  console.log(`spent $${spent().toFixed(3)}`);
}

// ---- split: one reproduction calibrates, the others are held out ----
function split() {
  const P = readJ(`${OUT}photos.json`);
  const manual = readJ(`${OUT}split-manual.json`, {}); // by eye: { slug: { merge: [[repIndexA, repIndexB]], drop: [mediaId], skip: "why" } }
  const out = {}, skipped = [];
  for (const f of readdirSync(`${OUT}extracted/`)) {
    const slug = f.replace('.json', '');
    const x = readJ(`${OUT}extracted/${f}`);
    const m = manual[slug] ?? {};
    if (m.skip) { skipped.push([slug, m.skip]); continue; }
    const want = new Set(x.photo_variants ?? []);
    let reps = P[slug].reps.map((r, i) => ({ ...r, i, front: r.front.filter((id) => !(m.drop ?? []).includes(id)) }));
    reps = reps.filter((r) => r.front.length && r.variant.split(' | ').some((v) => want.has(v)));
    reps.sort((a, b) => b.front.length - a.front.length);
    if (m.calHas) reps.sort((a, b) => b.front.includes(m.calHas) - a.front.includes(m.calHas));
    if (reps.length < 2) { skipped.push([slug, 'one reproduction of the variant']); continue; }
    // Spread over the set: evenly spaced picks, so not three takes of one pose.
    const spread = (ids, n) => (ids.length <= n ? ids : Array.from({ length: n }, (_, k) => ids[Math.round((k * (ids.length - 1)) / (n - 1 || 1))]));
    const cal = spread(reps[0].front, 3);
    const held = reps.slice(1).flatMap((r) => spread(r.front, 2).map((id) => ({ id, rep: r.key }))).slice(0, 6);
    if (cal.length + held.length < 4) { skipped.push([slug, `${cal.length + held.length} photos`]); continue; }
    out[slug] = { name: x.parish, region: x.region, period: x.period, cal, calRep: reps[0].key, held: held.map((h) => h.id), heldReps: [...new Set(held.map((h) => h.rep))] };
  }
  writeFileSync(`${OUT}split.json`, JSON.stringify({ sets: out, skipped }, null, 1));
  console.log(`${Object.keys(out).length} parishes; skipped: ${skipped.map((s) => s.join(': ')).join('; ')}`);
  for (const [s, v] of Object.entries(out)) console.log(`${s}: cal ${v.cal.length} (${v.calRep}), held ${v.held.length} (${v.heldReps.join(' / ')})`);
}

// Contact sheets to check the split by eye: calibration row, then held-out row (one page each, by Playwright).
async function sheets() {
  const { chromium } = await import('playwright');
  const { sets } = readJ(`${OUT}split.json`);
  mkdirSync(`${OUT}sheets/`, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 520 } });
  for (const [slug, v] of Object.entries(sets)) {
    if (args.length && !args.includes(slug)) continue;
    const img = (id) => `<figure><img src="${dataUrl(photoPath(id), 400)}"><figcaption>${id}</figcaption></figure>`;
    await page.setContent(`<style>body{margin:4px;font:12px sans-serif}div{display:flex;gap:4px;margin-bottom:6px}img{height:220px}figure{margin:0}</style>
      <b>${slug} cal</b><div>${v.cal.map(img).join('')}</div><b>held</b><div>${v.held.map(img).join('')}</div>`);
    await page.screenshot({ path: `${OUT}sheets/${slug}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
  }
  // Overview pages: ten parishes each, calibration | held-out on one row.
  const all = Object.entries(sets);
  for (let k = 0; k < all.length; k += 10) {
    const rows = all.slice(k, k + 10).map(([slug, v]) => `<div><b>${slug}</b>${v.cal.map((id) => `<img src="${dataUrl(photoPath(id), 400)}">`).join('')}<i></i>${v.held.map((id) => `<img src="${dataUrl(photoPath(id), 400)}">`).join('')}</div>`).join('');
    await page.setContent(`<style>body{margin:4px;font:11px sans-serif}div{display:flex;gap:3px;margin-bottom:4px;align-items:center}b{width:80px}img{height:120px}i{width:14px;height:120px;background:#c00}</style>${rows}`);
    await page.screenshot({ path: `${OUT}sheets/overview-${k / 10 + 1}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
  }
  await browser.close();
}

// ---- judging: yes / no / hidden per check ----
const JUDGE = `A photograph or picture of a person in clothing (if there are several people, look only at the adult woman). Answer each question by looking only at the picture:
"yes" if it is visibly so, "no" if that part is visible and is different, "hidden" if that part cannot be seen (covered, out of frame, or turned away).`;
// Seeded shuffle, so the order of questions does not favour a parish.
function shuffle(list, seed) {
  const a = list.slice();
  let h = [...String(seed)].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (let i = a.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// One picture, several parishes' checks in one call; returns { slug: ['yes'|'no'|'hidden', ...] }.
async function ask(path, bySlug, seed, what) {
  const qs = shuffle(Object.entries(bySlug).flatMap(([slug, cs]) => cs.map((c, i) => ({ slug, i, q: c.question }))), seed);
  const text = `${JUDGE}\n${qs.map((x, n) => `${n + 1}. ${x.q}`).join('\n')}\n\nJSON: {"answers": [{"n": 1, "a": "yes"|"no"|"hidden"}]}`;
  const ans = (await chat([{ type: 'image_url', image_url: { url: dataUrl(path) } }, { type: 'text', text }], { max_tokens: 3000, what })).answers ?? [];
  const by = Object.fromEntries(ans.map((a) => [a.n, String(a.a).toLowerCase()]));
  const out = Object.fromEntries(Object.entries(bySlug).map(([slug, cs]) => [slug, cs.map(() => 'hidden')]));
  qs.forEach((x, n) => { const a = by[n + 1]; out[x.slug][x.i] = a === 'yes' || a === 'no' ? a : 'hidden'; });
  return out;
}
const yesRate = (answerLists) => { let y = 0, v = 0; for (const l of answerLists) for (const a of l) { if (a === 'yes') y++; if (a !== 'hidden') v++; } return { y, v, pct: v ? (100 * y) / v : null }; };

const sets = () => readJ(`${OUT}split.json`).sets;
const checks = (slug, v) => (v === 'v1' ? readJ(`${OUT}extracted/${slug}.json`).criteria
  : v === 'v2r' ? readJ(`${OUT}checks/${slug}.json`)?.checks.filter((c) => c.status === 'rewritten')
  : readJ(`${OUT}checks/${slug}.json`)?.checks.filter((c) => c.status !== 'dropped'));

// Calibration photos on their own checks (v1, or v2 after refine).
async function calibrate(v = 'v1') {
  const f = `${OUT}calib-${v}.jsonl`;
  const done = new Set(readL(f).map((r) => `${r.slug}|${r.id}`));
  const jobs = Object.entries(sets()).filter(([s]) => !args.slice(1).length || args.includes(s)).flatMap(([slug, x]) => x.cal.map((id) => ({ slug, id }))).filter((j) => !done.has(`${j.slug}|${j.id}`));
  console.log(`${jobs.length} calls, disk ${diskGuard()} GB free`);
  await pool(jobs, 6, async ({ slug, id }) => {
    const cs = checks(slug, v);
    if (!cs?.length) return;
    try {
      const a = await ask(photoPath(id), { [slug]: cs }, `${slug}${id}`, `calibrate-${v}`);
      appendFileSync(f, JSON.stringify({ slug, id, answers: a[slug] }) + '\n');
      console.log(`${slug} ${id}: ${a[slug].map((x) => x[0]).join('')}`);
    } catch (err) { console.log(`${slug} ${id}: ${err.message.slice(0, 150)}`); if (/budget/.test(err.message)) process.exit(1); }
  });
  console.log(`spent $${spent().toFixed(3)}`);
}

const fails = (col) => { const r = yesRate([col]); return r.v === 0 ? 'hidden' : r.pct < 50 ? 'fail' : 'ok'; };
// Checks the real calibration photos fail: rewritten to the variant the text also names, loosened, or dropped (Gemini sees the photos and the text).
async function refine() {
  mkdirSync(`${OUT}checks/`, { recursive: true });
  const rows = readL(`${OUT}calib-v1.jsonl`);
  const todo = Object.keys(sets()).filter((s) => !existsSync(`${OUT}checks/${s}.json`) && (!args.length || args.includes(s)));
  await pool(todo, 4, async (slug) => {
    const x = readJ(`${OUT}extracted/${slug}.json`);
    const rs = rows.filter((r) => r.slug === slug);
    const cs = x.criteria.map((c, i) => ({ ...c, cal: rs.map((r) => r.answers[i]).join(' '), state: fails(rs.map((r) => r.answers[i])) }));
    const bad = cs.map((c, i) => ({ ...c, n: i + 1 })).filter((c) => c.state === 'fail');
    let fixes = {};
    if (bad.length) {
      const entry = entries.find((e) => e.id === x.entry);
      const text = `You check yes/no questions about an Estonian folk costume against photos of a real modern reproduction of it (the photos below, all one woman's costume).
The questions came from the expert text (below). These questions failed on the photos (the judge answered "no" on most photos where the part was visible):
${bad.map((c) => `${c.n}. ${c.question}  [source: "${c.source_sentence}"] [answers on the photos: ${c.cal}]`).join('\n')}

For each one decide:
- "rewrite" when the text also names what the photos show (another colour, cut or variant the text allows): make the question allow both, and quote the second sentence verbatim from the text in "source_sentence_2". Or when the question is too exact for a full-length photo: loosen it, keeping what the text says.
- "drop" when the photos show something the text does not describe, the part is too small to judge at full length, or it is an outer layer.
Never invent: a rewritten question must be fully supported by the text. One thing per question, no "not", never name the parish.
JSON: {"fixes": [{"n": 1, "action": "rewrite"|"drop", "question": "the new question, or null", "source_sentence_2": "verbatim, or null", "why": "short"}]}

TEXT:
${entry.text}`;
      const content = [...sets()[slug].cal.map((id) => ({ type: 'image_url', image_url: { url: dataUrl(photoPath(id)) } })), { type: 'text', text }];
      try { fixes = Object.fromEntries(((await chat(content, { max_tokens: 6000, what: 'refine' })).fixes ?? []).map((f) => [f.n, f])); } catch (err) { console.log(`${slug}: ${err.message.slice(0, 150)}`); return; }
    }
    const body = norm(entries.find((e) => e.id === x.entry).text);
    const out = cs.map((c, i) => {
      const base = { question: c.question, garment: c.garment, source_sentence: c.source_sentence, quote_ok: c.quote_ok, cal_v1: c.cal };
      if (c.state === 'hidden') return { ...base, status: 'dropped', why: 'hidden on every calibration photo' };
      if (c.state === 'ok') return { ...base, status: 'kept' };
      const f = fixes[i + 1];
      if (f?.action === 'rewrite' && f.question) return { ...base, was: c.question, question: f.question, source_sentence_2: f.source_sentence_2 ?? null,
        quote2_ok: f.source_sentence_2 ? body.includes(norm(f.source_sentence_2)) : null, status: 'rewritten', why: f.why };
      return { ...base, status: 'dropped', why: f?.why ?? 'failed on the calibration photos' };
    });
    writeFileSync(`${OUT}checks/${slug}.json`, JSON.stringify({ slug, parish: x.parish, region: x.region, period: x.period, checks: out }, null, 1));
    console.log(`${slug}: ${out.filter((c) => c.status === 'kept').length} kept, ${out.filter((c) => c.status === 'rewritten').length} rewritten, ${out.filter((c) => c.status === 'dropped').length} dropped`);
  });
  console.log(`spent $${spent().toFixed(3)}`);
}

// Rewritten checks put to the calibration photos again; those that still fail are dropped.
function settle() {
  const rows = readL(`${OUT}calib-v2r.jsonl`);
  for (const slug of Object.keys(sets())) {
    const f = `${OUT}checks/${slug}.json`;
    const d = readJ(f);
    if (!d) continue;
    const live = d.checks.filter((c) => c.status === 'rewritten');
    const rs = rows.filter((r) => r.slug === slug);
    if (!rs.length) continue;
    live.forEach((c, i) => {
      const col = rs.map((r) => r.answers[i]);
      c.cal_v2 = col.join(' ');
      if (c.status === 'rewritten' && fails(col) !== 'ok') { c.status = 'dropped'; c.why = `${c.why}; the rewrite still failed (${c.cal_v2})`; }
    });
    writeFileSync(f, JSON.stringify(d, null, 1));
    console.log(`${slug}: ${d.checks.filter((c) => c.status !== 'dropped').length} checks`);
  }
}

// ---- ruler validity ----
const MIN_CHECKS = 4;
const VALIDITY = process.env.VALIDITY ?? '-v3'; // '' = before pruning (v2 checks at the time), '-v3' = after
const STOPW = new Set('the a an of is are and or with on in at to by from does do this that woman wearing worn wear her its it any as be has have there visible skirt'.split(' '));
const words = (slug) => new Set(checks(slug, 'v2').flatMap((c) => fold(c.question).split(/[^a-z]+/)).filter((w) => w.length > 2 && !STOPW.has(w)));
function rulers() {
  const S = sets();
  return Object.keys(S).filter((s) => (checks(s, 'v2')?.length ?? 0) >= MIN_CHECKS);
}
// The 3 parishes of the same region whose checks share the most words: the hardest neighbours to tell apart.
function confusables(slug) {
  const fixed = readJ(`${OUT}confusables.json`);
  if (fixed?.[slug]) return fixed[slug];
  const S = sets(), all = rulers(), w = words(slug);
  const jac = (o) => { const b = words(o); return [...w].filter((x) => b.has(x)).length / new Set([...w, ...b]).size; };
  return all.filter((o) => o !== slug && S[o].region === S[slug].region).map((o) => [o, jac(o)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o]) => o);
}
// Neighbours, symmetric: Q is P's neighbour when either lists the other among its confusables.
const neighbours = (slug) => { const c = readJ(`${OUT}confusables.json`); return Object.keys(c).filter((q) => q !== slug && (c[slug].includes(q) || c[q].includes(slug))); };
// Discriminating: each parish's checks put to its neighbours' CALIBRATION photos (never their held-out ones).
async function discriminate() {
  if (!existsSync(`${OUT}confusables.json`)) writeFileSync(`${OUT}confusables.json`, JSON.stringify(Object.fromEntries(rulers().map((s) => [s, confusables(s)])), null, 1));
  const C = readJ(`${OUT}confusables.json`);
  const f = `${OUT}discriminate.jsonl`;
  const done = new Set(readL(f).map((r) => `${r.photoOf}|${r.id}`));
  const S = sets();
  const jobs = Object.keys(C).flatMap((q) => S[q].cal.map((id) => ({ q, id }))).filter((j) => !done.has(`${j.q}|${j.id}`));
  console.log(`${jobs.length} calls, disk ${diskGuard()} GB free`);
  await pool(jobs, 6, async ({ q, id }) => {
    const ps = neighbours(q);
    const by = Object.fromEntries(ps.map((p) => [p, checks(p, 'v2')]));
    try {
      const a = await ask(photoPath(id), by, `d${q}${id}`, 'discriminate');
      appendFileSync(f, JSON.stringify({ photoOf: q, id, answers: a }) + '\n');
      console.log(`${q} ${id}: ${ps.length} neighbours asked`);
    } catch (err) { console.log(`${q} ${id}: ${err.message.slice(0, 150)}`); if (/budget/.test(err.message)) process.exit(1); }
  });
  console.log(`spent $${spent().toFixed(3)}`);
}
// Checks that pass the neighbours' calibration photos (50 % or more of the visible answers) are dropped, the most shared first, keeping at least MIN_CHECKS.
function prune() {
  const rows = readL(`${OUT}discriminate.jsonl`);
  for (const slug of Object.keys(readJ(`${OUT}confusables.json`))) {
    const file = `${OUT}checks/${slug}.json`;
    const d = readJ(file);
    const live = d.checks.filter((c) => c.status !== 'dropped');
    const rs = rows.filter((r) => r.answers[slug]);
    const shared = live.map((c, i) => ({ c, r: yesRate([rs.map((r) => r.answers[slug][i])]) }));
    shared.forEach(({ c, r }) => { c.neighbours_yes = r.v ? `${r.y}/${r.v}` : '0/0'; });
    const drop = shared.filter((x) => x.r.pct != null && x.r.pct >= 50).sort((a, b) => b.r.pct - a.r.pct);
    const room = Math.max(0, live.length - MIN_CHECKS);
    for (const { c, r } of drop.slice(0, room)) { c.status = 'dropped'; c.why = `passes the neighbours' calibration photos (${r.y}/${r.v} yes)`; c.pruned = true; }
    writeFileSync(file, JSON.stringify(d, null, 1));
    console.log(`${slug}: ${live.length} -> ${d.checks.filter((c) => c.status !== 'dropped').length} checks (${drop.length} shared)`);
  }
}
async function validity() {
  const f = `${OUT}validity${VALIDITY}.jsonl`;
  const done = new Set(readL(f).map((r) => `${r.slug}|${r.id}`));
  const S = sets();
  const jobs = rulers().flatMap((slug) => S[slug].held.map((id) => ({ slug, id }))).filter((j) => !done.has(`${j.slug}|${j.id}`));
  console.log(`${jobs.length} calls, disk ${diskGuard()} GB free`);
  await pool(jobs, 6, async ({ slug, id }) => {
    const others = confusables(slug);
    const by = Object.fromEntries([slug, ...others].map((s) => [s, checks(s, 'v2')]));
    try {
      const a = await ask(photoPath(id), by, `v${slug}${id}`, 'validity');
      appendFileSync(f, JSON.stringify({ slug, id, others, answers: a }) + '\n');
      console.log(`${slug} ${id}: own ${a[slug].map((x) => x[0]).join('')} | ${others.map((o) => `${o} ${a[o].map((x) => x[0]).join('')}`).join(' | ')}`);
    } catch (err) { console.log(`${slug} ${id}: ${err.message.slice(0, 150)}`); if (/budget/.test(err.message)) process.exit(1); }
  });
  console.log(`spent $${spent().toFixed(3)}`);
}
function validityTable(v = VALIDITY) {
  const rows = readL(`${OUT}validity${v}.jsonl`);
  const out = {};
  for (const slug of rulers()) {
    const rs = rows.filter((r) => r.slug === slug);
    if (!rs.length) continue;
    const own = yesRate(rs.map((r) => r.answers[slug]));
    const others = rs[0].others;
    const oth = yesRate(rs.flatMap((r) => others.map((o) => r.answers[o])));
    const perOther = Object.fromEntries(others.map((o) => [o, Math.round(yesRate(rs.map((r) => r.answers[o])).pct ?? 0)]));
    const good = own.pct != null && own.pct >= 70 && oth.pct != null && oth.pct <= 45;
    out[slug] = { own: own.pct, ownN: `${own.y}/${own.v}`, others: oth.pct, othersN: `${oth.y}/${oth.v}`, perOther, photos: rs.length, checks: checks(slug, 'v2').length, good };
  }
  return out;
}

// ---- generation ----
// Ordered by year (era.mjs's dates): the x axis of the chart.
const MODELS = [
  { id: 'sd-turbo-local', label: 'SD-Turbo (local)', year: 2023, local: 'sd-turbo-local' },
  { id: 'chilloutmix-local', label: 'ChilloutMix (local)', year: 2023, local: 'chilloutmix-local' },
  { id: 'sd-1.5-local', label: 'SD 1.5 (local)', year: 2022, local: 'sd-1.5-local' },
  { id: 'flux-1-schnell', label: 'FLUX.1 schnell', year: 2024, usd: 0.0007 },
  { id: 'flux-2-klein-4b', label: 'FLUX.2 klein 4B', year: 2025, usd: 0.0012 },
  { id: 'flux-2-dev', label: 'FLUX.2 dev', year: 2025, usd: 0.033 },
  { id: 'p-image', label: 'P-Image', year: 2025, usd: 0.005 },
  { id: 'nano-banana-pro', label: 'Nano Banana Pro', year: 2026, usd: 0.134 },
  { id: 'nano-banana-2-lite', label: 'Nano Banana 2 Lite', year: 2026, usd: 0.039 },
  { id: 'gpt-image-2', label: 'GPT Image 2', year: 2026, usd: 0.05 },
].sort((a, b) => a.year - b.year);
const TEXT_MODELS = ['nano-banana-2-lite', 'flux-2-dev'];
const NAME = (slug) => readJ(`${OUT}extracted/${slug}.json`).parish;
const plainPrompt = (slug) => `${NAME(slug)} women's folk costume, full figure`;
function textPrompt(slug, budget = 1900) {
  const x = readJ(`${OUT}extracted/${slug}.json`);
  let p = `A full-length documentary photograph of a woman standing, wearing the traditional women's folk costume of ${x.parish} parish, Estonia${x.period ? `, ${x.period}` : ''}. ${x.summary} The costume: `;
  for (const g of x.garments) { const s = `${g.type_en} (${g.type}): ${g.description_en}`; if ((p + s).length < budget) p += s + ' '; }
  return p.trim();
}
const good = () => Object.entries(validityTable()).filter(([, r]) => r.good).map(([s]) => s);
function genJobs() {
  const list = [];
  for (const slug of good()) {
    for (const m of MODELS) {
      if (m.local) list.push({ slug, variant: 'plain', model: m.id, local: `${here('out/local-m1/')}${m.local}/costume-${slug}-plain.png` });
      else list.push({ slug, variant: 'plain', model: m.id, prompt: plainPrompt(slug) });
    }
    for (const id of TEXT_MODELS) list.push({ slug, variant: 'text', model: id, prompt: textPrompt(slug) });
  }
  return list.map((j) => ({ ...j, name: `${j.slug}-${j.variant}-${j.model}`, path: j.local ?? `${OUT}gen/${j.slug}-${j.variant}-${j.model}.jpg` }));
}
async function generate() {
  const todo = genJobs().filter((j) => !j.local && !existsSync(j.path));
  console.log(`${todo.length} pictures, about $${todo.reduce((s, j) => s + MODELS.find((m) => m.id === j.model).usd, 0).toFixed(2)}, disk ${diskGuard()} GB free, spent $${spent().toFixed(3)}`);
  await pool(todo, 4, async (j) => {
    const usd = MODELS.find((m) => m.id === j.model).usd;
    if (spent() + usd > BUDGET) { console.log(`${j.name}: budget`); return; }
    const t = Date.now();
    let res, data;
    try {
      res = await fetch(`${GATEWAY}/v1/images`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: j.model, prompt: j.prompt, size: '768x1024' }) });
      data = await res.json().catch(() => ({}));
    } catch (err) { console.log(`${j.name} failed: ${err.message}`); return; }
    if (!res.ok || !data.data?.[0]?.b64_json) { console.log(`${j.name} failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`); return; }
    charge(j.model, data.usage?.cost_usd ?? usd);
    const raw = `${JPG}${j.name}.raw`;
    writeFileSync(raw, Buffer.from(data.data[0].b64_json, 'base64'));
    execFileSync('sips', ['-Z', '1024', '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', raw, '--out', j.path], { stdio: 'ignore' });
    execFileSync('rm', [raw]);
    writeFileSync(j.path.replace(/\.jpg$/, '.json'), JSON.stringify({ ...j, usage: data.usage, ms: Date.now() - t }, null, 1));
    console.log(`${j.name} ${((Date.now() - t) / 1000).toFixed(0)} s`);
  });
  console.log(`spent $${spent().toFixed(3)}`);
}
// Every picture on its parish's checks and its confusables' (the same call as the held-out photos).
async function judge() {
  const f = `${OUT}judge.jsonl`;
  const done = new Set(readL(f).map((r) => r.name));
  const todo = genJobs().filter((j) => existsSync(j.path) && !done.has(j.name));
  console.log(`${todo.length} calls`);
  await pool(todo, 6, async (j) => {
    const others = confusables(j.slug);
    const by = Object.fromEntries([j.slug, ...others].map((s) => [s, checks(s, 'v2')]));
    try {
      const a = await ask(j.path, by, `g${j.name}`, 'judge');
      appendFileSync(f, JSON.stringify({ name: j.name, slug: j.slug, variant: j.variant, model: j.model, others, answers: a }) + '\n');
      console.log(`${j.name}: ${a[j.slug].map((x) => x[0]).join('')}`);
    } catch (err) { console.log(`${j.name}: ${err.message.slice(0, 150)}`); if (/budget/.test(err.message)) process.exit(1); }
  });
  console.log(`spent $${spent().toFixed(3)}`);
}

// ---- report ----
const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const r0 = (x) => (x == null ? null : Math.round(x));
function report() {
  const V2 = validityTable('');
  const V3 = validityTable();
  const G = good();
  const J = readL(`${OUT}judge.jsonl`);
  const S = sets();
  const { skipped } = readJ(`${OUT}split.json`);
  const cand = candidates();
  // A picture's score: yes among visible own checks (as for the photos); nothing visible counts 0.
  const score = (r, of = r.slug) => { const x = yesRate([r.answers[of]]); return x.v ? x.pct : 0; };
  const perParish = {};
  for (const slug of G) {
    const pics = J.filter((r) => r.slug === slug);
    perParish[slug] = {
      parish: NAME(slug), region: S[slug].region, period: readJ(`${OUT}extracted/${slug}.json`).period,
      checks: checks(slug, 'v2').map((c) => ({ question: c.question, source_sentence: c.source_sentence, source_sentence_2: c.source_sentence_2 ?? undefined, status: c.status })),
      calibration_photos: S[slug].cal, held_out_photos: S[slug].held, held_out_reproductions: S[slug].heldReps, confusables: confusables(slug),
      ceiling: r0(V3[slug].own), ceiling_n: V3[slug].ownN, confusables_on_real: r0(V3[slug].others),
      plain: Object.fromEntries(pics.filter((r) => r.variant === 'plain').map((r) => [r.model, { own: r0(score(r)), confusables: r0(mean(r.others.map((o) => score(r, o)))), answers: r.answers[slug].join(' ') }])),
      text: Object.fromEntries(pics.filter((r) => r.variant === 'text').map((r) => [r.model, { own: r0(score(r)), confusables: r0(mean(r.others.map((o) => score(r, o)))), answers: r.answers[slug].join(' ') }])),
    };
  }
  const ceiling = mean(G.map((s) => V3[s].own));
  const models = MODELS.map((m) => {
    const xs = G.map((s) => perParish[s].plain[m.id]?.own).filter((x) => x != null);
    const ts = G.map((s) => perParish[s].text[m.id]?.own).filter((x) => x != null);
    return { id: m.id, label: m.label, year: m.year, local: !!m.local, parishes: xs.length, plain: r0(mean(xs)), plain_min: xs.length ? Math.min(...xs) : null, plain_max: xs.length ? Math.max(...xs) : null,
      text: ts.length ? r0(mean(ts)) : null, text_parishes: ts.length };
  }).filter((m) => m.parishes);
  const out = {
    date: '2026-11-16', judge: GEMINI, measure: 'share of the parish\'s calibrated checks a picture passes (yes among visible)',
    ceiling: r0(ceiling), ceiling_min: r0(Math.min(...G.map((s) => V3[s].own))), ceiling_max: r0(Math.max(...G.map((s) => V3[s].own))),
    confusables_on_real: r0(mean(G.map((s) => V3[s].others))),
    models, parishes: perParish,
    rulers: Object.fromEntries(Object.entries(V3).map(([s, r]) => [s, { own: r0(r.own), own_n: r.ownN, others: r0(r.others), others_n: r.othersN, per_other: r.perOther, photos: r.photos, checks: r.checks, good: r.good,
      before_pruning: V2[s] ? { own: r0(V2[s].own), others: r0(V2[s].others), good: V2[s].good } : null }])),
    skipped: [...cand.skip.map(([s, why]) => ({ slug: s, why })), ...skipped.map(([s, why]) => ({ slug: s, why })),
      ...Object.keys(S).filter((s) => (checks(s, 'v2')?.length ?? 0) < MIN_CHECKS).map((s) => ({ slug: s, why: `${checks(s, 'v2')?.length ?? 0} checks survived calibration` }))],
    spent_usd: Math.round(spent() * 100) / 100,
  };
  writeFileSync(`${OUT}drift.json`, JSON.stringify(out, null, 1));
  console.log(`ceiling ${out.ceiling} (${out.ceiling_min}-${out.ceiling_max}), real photos on confusables ${out.confusables_on_real}, ${G.length} parishes: ${G.join(' ')}`);
  console.log('| model | year | parishes | plain | min-max | expert text |');
  for (const m of models) console.log(`| ${m.label} | ${m.year} | ${m.parishes} | ${m.plain} | ${m.plain_min}-${m.plain_max} | ${m.text ?? ''} |`);
  console.log('\nper parish (plain own %):');
  console.log(`| parish | ceiling | ${models.map((m) => m.id).join(' | ')} | text nano | text dev |`);
  for (const s of G) { const p = perParish[s]; console.log(`| ${p.parish} | ${p.ceiling} | ${models.map((m) => p.plain[m.id]?.own ?? '').join(' | ')} | ${p.text['nano-banana-2-lite']?.own} | ${p.text['flux-2-dev']?.own} |`); }
  console.log('\nmean confusables % on plain pictures:', models.map((m) => `${m.id} ${r0(mean(G.map((s) => perParish[s].plain[m.id]?.confusables)))}`).join(', '));
  console.log(`spent $${spent().toFixed(3)}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'photos') photos();
else if (cmd === 'candidates') { const { ok, skip } = candidates(); console.log(ok.length, ok.join(' ')); console.log('skip:', skip.map((s) => s.join(': ')).join('; ')); }
else if (cmd === 'extract') await extract();
else if (cmd === 'split') split();
else if (cmd === 'calibrate') await calibrate(args[0] ?? 'v1');
else if (cmd === 'refine') await refine();
else if (cmd === 'settle') settle();
else if (cmd === 'validity') await validity();
else if (cmd === 'discriminate') await discriminate();
else if (cmd === 'prune') prune();
else if (cmd === 'generate') await generate();
else if (cmd === 'judge') await judge();
else if (cmd === 'report') report();
else if (cmd === 'jobs') for (const j of genJobs()) console.log(j.name, existsSync(j.path) ? 'on disk' : '', j.prompt?.length ?? '');
else if (cmd === 'rulers') { const t = validityTable(); for (const [s, r] of Object.entries(t)) console.log(`${r.good ? 'OK  ' : 'weak'} ${s}: own ${Math.round(r.own)}% (${r.ownN}), others ${Math.round(r.others)}% (${r.othersN}) ${JSON.stringify(r.perOther)} ${r.photos} photos ${r.checks} checks`); console.log(Object.values(t).filter((r) => r.good).length, 'good'); }
else if (cmd === 'sheets') await sheets();
else console.log('usage: see the header');
