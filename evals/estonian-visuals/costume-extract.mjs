// One rahvaroivad.ee costume entry (parish × wearer, the expert text in
// Estonian) to structured garment records and 5 to 8 yes/no visual criteria,
// each quoting the sentence it came from. Research only: reads and writes the
// git-ignored out/rahvaroivad/ (plans/folk-costumes.md).
//
//   node costume-extract.mjs muhu kihnu        # women's entries of these parishes (slugs)
//   node costume-extract.mjs --pairs           # the 12 women's costumes of the confusable pairs
//   WEARER=mees node costume-extract.mjs muhu
//   MODEL=google/gemini-3.1-pro node costume-extract.mjs --pairs
//
// One strong catalog model through Cloudflare's REST API (AI Gateway
// `visualia`), the token from `wrangler auth token` in apps/gateway. An entry
// already extracted is skipped; delete its file to redo it. Every quoted
// sentence is checked against the text: `quote_ok` false means the model
// paraphrased, read it before trusting the criterion.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export const ACCOUNT = 'dc1ee8d72a1fb7da857c46479a8503b8';
export const STRONG = process.env.MODEL ?? 'anthropic/claude-sonnet-5.5';
export const PAIRS = ['muhu', 'kihnu', 'halliste', 'tarvastu', 'emmaste', 'kihelkonna', 'setomaa', 'rapina', 'vormsi', 'noarootsi', 'tostamaa', 'kadrina'];
const here = (p) => new URL(p, import.meta.url);
const dir = here('out/rahvaroivad/');
const outDir = new URL('extracted/', dir);

let token;
export function cfToken() {
  token ??= process.env.CF_TOKEN ?? execSync('npx wrangler auth token', { cwd: here('../../apps/gateway/').pathname, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim().split('\n').pop().trim();
  return token;
}

// Chat completions on a catalog model; returns { text, usage }.
export async function chat(messages, { model = STRONG, max_tokens = 4000, json = false } = {}) {
  for (let i = 1; ; i++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfToken()}`, 'cf-aig-gateway-id': 'visualia', 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.choices?.[0]) return { text: data.choices[0].message.content, usage: data.usage };
    if (i >= 3) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 5000 * i));
  }
}

// The first {...} block in a model's answer, parsed.
export function parseJson(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  return JSON.parse(text.slice(s, e + 1));
}

const norm = (s) => s.normalize('NFC').replace(/[„“”"«»]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

const SYSTEM = `You read Estonian folk costume descriptions written by experts (rahvaroivad.ee) and turn them into data.
The text may describe several periods or variants (older and newer, bride, summer and winter). Pick the one it treats as the main
festive costume of the latest fully described period, name it in "period", and keep the garments and criteria to that one.
Answer with one JSON object, nothing else:
{
  "variants": ["the other periods or variants the text describes, one short English line each"],
  "summary": "two English sentences: what makes this parish's costume recognisable",
  "period": "as the text gives it, or null",
  "garments": [
    { "type": "Estonian garment name as in the text (e.g. seelik, särk, põll, tanu, vöö)",
      "type_en": "English",
      "colours": ["english"], "materials": ["english"], "techniques": ["english, e.g. tablet weaving, cross-stitch"],
      "period": "or null",
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
Rules for criteria: 5 to 8 of them. Each one concrete and visible: a colour, a stripe direction, a shape, a headdress, a pattern placement.
Prefer what tells this parish apart from its neighbours over what every Estonian costume has (a white linen shirt alone is not distinctive).
Ask one thing per question. Say it plainly, without "not". No counting beyond two. Never name the parish in a question.
Never invent: every claim must come from the text. If the text gives choices (red or blue), the question allows both.`;

export async function extract(entry, terms) {
  const parish = terms.kihelkond.find((k) => entry.kihelkond.includes(k.id) && k.parent);
  const region = terms.kihelkond.find((k) => k.id === parish?.parent);
  const wearer = terms.kandja.find((k) => entry.kandja.includes(k.id));
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Parish: ${parish?.name}. Wearer: ${wearer?.name}. Title: ${entry.title}\n\n${entry.text}` },
  ];
  let { text, usage } = await chat(messages, { max_tokens: 6000 });
  let data;
  try { data = parseJson(text); } catch {
    // Usually a quotation mark inside a quoted Estonian sentence: ask once more for strict JSON.
    ({ text, usage } = await chat([...messages, { role: 'assistant', content: text },
      { role: 'user', content: 'That was not valid JSON. Send the same object again as strict JSON; escape every double quote inside strings.' }], { max_tokens: 6000 }));
    data = parseJson(text);
  }
  const body = norm(entry.text);
  const check = (x) => ({ ...x, quote_ok: !!x.source_sentence && body.includes(norm(x.source_sentence)) });
  return {
    entry: entry.id, link: entry.link, title: entry.title, modified: entry.modified,
    parish: parish?.name, parish_slug: parish?.slug, region: region?.name, wearer: wearer?.name,
    model: STRONG, usage, ...data,
    garments: (data.garments ?? []).map(check), criteria: (data.criteria ?? []).map(check),
  };
}

// The entries for a parish and wearer, longest text first.
export function entriesFor(entries, terms, slug, wearer = 'naine') {
  const p = terms.kihelkond.find((k) => k.slug === slug);
  const w = terms.kandja.find((k) => k.slug === wearer);
  if (!p) throw new Error(`no parish ${slug}`);
  return entries.filter((e) => e.kihelkond.includes(p.id) && e.kandja.includes(w.id)).sort((a, b) => b.text.length - a.text.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const slugs = args.includes('--pairs') ? PAIRS : args.filter((a) => !a.startsWith('--'));
  if (!slugs.length) { console.log('usage: node costume-extract.mjs <parish slug>... | --pairs'); process.exit(1); }
  const terms = JSON.parse(readFileSync(new URL('terms.json', dir)));
  const { entries } = JSON.parse(readFileSync(new URL('entries.json', dir)));
  mkdirSync(outDir, { recursive: true });
  const wearer = process.env.WEARER ?? 'naine';
  let tokens = { in: 0, out: 0 };
  for (const slug of slugs) {
    const found = entriesFor(entries, terms, slug, wearer);
    if (!found.length) { console.log(`${slug}: no ${wearer} entry`); continue; }
    const entry = found[0]; // the longest, when a parish has variants
    const file = new URL(`${slug}-${wearer}.json`, outDir);
    if (existsSync(file)) { console.log(`${slug}: done before`); continue; }
    const t = Date.now();
    let rec;
    try { rec = await extract(entry, terms); } catch (err) { console.log(`${slug}: failed, ${err.message.slice(0, 200)}`); continue; }
    rec.other_entries = found.slice(1).map((e) => ({ id: e.id, title: e.title, link: e.link }));
    writeFileSync(file, JSON.stringify(rec, null, 2));
    tokens.in += rec.usage?.prompt_tokens ?? 0;
    tokens.out += rec.usage?.completion_tokens ?? 0;
    const bad = rec.criteria.filter((c) => !c.quote_ok).length;
    console.log(`${slug}: "${entry.title}" ${entry.text.length} chars, ${rec.garments.length} garments, ${rec.criteria.length} criteria (${bad} quotes not found), ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
  console.log(`tokens: ${tokens.in} in, ${tokens.out} out`);
}
