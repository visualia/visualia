// The whole of rahvaroivad.ee (MTÜ Rahvarõivas) for research: every costume
// entry (parish × wearer, the expert text per garment with museum numbers) and
// every photo's 768 px copy, with the parish, wearer and garment terms. Not in
// git (out/ is ignored); for research only, deleted afterwards. Licence still
// to confirm with the site (plans/estonian-visuals.md).
//
// Gentle on the source: one request at a time, PAUSE ms between them (default
// 1500), an honest user agent, a long wait and a retry on 429 or 5xx, and a
// rerun skips what is already on disk, so it can be stopped any time.
//   node fetch-rahvaroivad.mjs            # entries, then photos
//   PAUSE=3000 node fetch-rahvaroivad.mjs
// Writes out/rahvaroivad/: terms.json, entries.json (text as HTML and plain),
// media.json, photos/<id>.jpg.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const API = 'https://cms.rahvaroivad.ee/wp-json/wp/v2';
const HEADERS = { 'user-agent': 'visualia-research (non-commercial; kristjan.jansen@gmail.com)' };
const PAUSE = Number(process.env.PAUSE ?? 1500);
const dir = new URL('out/rahvaroivad/', import.meta.url);
const photos = new URL('photos/', dir);
mkdirSync(photos, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const file = (name) => new URL(name, dir);

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    await sleep(PAUSE);
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && i < tries) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 60_000 * i;
      console.log(`${res.status} on ${url}, waiting ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${url}: ${res.status}`);
  }
}

// Every page of a collection. Entries carry long texts: 100 a page timed out
// on the site (504, 2026-11-16), so they come 10 at a time.
async function all(path, fields, per = 100) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await get(`${API}/${path}${path.includes('?') ? '&' : '?'}per_page=${per}&page=${page}&_fields=${fields}`);
    out.push(...(await res.json()));
    if (page >= Number(res.headers.get('x-wp-totalpages') ?? 1)) return out;
  }
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8211;/g, '–')
  .replace(/&#8222;|&#8220;|&#8221;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// 1. Terms: parishes (with their region as parent), wearers, garment types.
let terms;
if (existsSync(file('terms.json'))) terms = JSON.parse(readFileSync(file('terms.json')));
else {
  terms = {
    kihelkond: await all('kihelkond', 'id,name,slug,parent,count'),
    kandja: await all('kandja', 'id,name,slug,count'),
    eseme_tyyp: await all('eseme_tyyp', 'id,name,slug,parent,count'),
  };
  writeFileSync(file('terms.json'), JSON.stringify(terms, null, 2));
}
console.log(`terms: ${terms.kihelkond.length} parishes and regions, ${terms.kandja.length} wearers, ${terms.eseme_tyyp.length} garment types`);

// 2. Entries: the costume book itself.
let entries;
if (existsSync(file('entries.json'))) entries = JSON.parse(readFileSync(file('entries.json'))).entries;
else {
  const raw = await all('rahvaroivad', 'id,slug,link,modified,title,content,kihelkond,kandja,eseme_tyyp,tags,featured_media', 10);
  entries = raw.map((e) => ({
    id: e.id, slug: e.slug, link: e.link, modified: e.modified, title: text(e.title.rendered),
    kihelkond: e.kihelkond, kandja: e.kandja, eseme_tyyp: e.eseme_tyyp, tags: e.tags,
    featured_media: e.featured_media, html: e.content.rendered, text: text(e.content.rendered),
  }));
  writeFileSync(file('entries.json'), JSON.stringify({ fetched: new Date().toISOString(), source: 'https://rahvaroivad.ee',
    note: 'research only, not to be published; delete afterwards', entries }, null, 2));
}
console.log(`entries: ${entries.length}`);

// 3. Photo records, then the 768 px copies one by one.
let media;
if (existsSync(file('media.json'))) media = JSON.parse(readFileSync(file('media.json'))).media;
else {
  const raw = await all('media?media_type=image', 'id,post,link,title,caption,alt_text,kihelkond,kandja,eseme_tyyp,media_details,source_url', 50);
  media = raw.map((m) => {
    const md = m.media_details ?? {};
    const sizes = md.sizes ?? {};
    const pick = sizes.medium_large ?? sizes.large ?? (md.width <= 1200 ? sizes.full : null);
    return { id: m.id, post: m.post, link: m.link, title: text(m.title?.rendered ?? ''), caption: text(m.caption?.rendered ?? ''),
      alt: m.alt_text, kihelkond: m.kihelkond, kandja: m.kandja, eseme_tyyp: m.eseme_tyyp,
      photographer: md.image_meta?.copyright || md.image_meta?.credit || null,
      width: pick?.width ?? null, height: pick?.height ?? null, src: pick?.source_url ?? null, full: m.source_url };
  });
  writeFileSync(file('media.json'), JSON.stringify({ fetched: new Date().toISOString(), media }, null, 2));
}
console.log(`photos: ${media.length}, ${media.filter((m) => !m.src).length} without a small copy (skipped)`);

// ONLY=muhu,kihnu,… fetches just those parishes' photos (by parish slug; a photo
// without its own parish takes its entry's), for a small download first.
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const slugOf = Object.fromEntries(terms.kihelkond.map((k) => [k.id, k.slug]));
const entryParish = Object.fromEntries(entries.map((e) => [e.id, e.kihelkond]));
const wanted = (m) => !only || (m.kihelkond?.length ? m.kihelkond : entryParish[m.post] ?? []).some((k) => only.has(slugOf[k]));

// Most photos (3,240 of 4,170) have no small copy, only the full file (about
// 0.65 to 3 MB). FULL=1 takes those too; MAX=<n> stops at n new photos per
// parish (with ONLY), for a small first download (on 4G, 2026-11-16).
const full = process.env.FULL === '1';
const max = Number(process.env.MAX ?? Infinity);
const perParish = {};
const parishOf = (m) => (m.kihelkond?.length ? m.kihelkond : entryParish[m.post] ?? []).map((k) => slugOf[k]).find((s) => !only || only.has(s));

let got = 0;
for (const [i, m] of media.entries()) {
  const out = new URL(`${m.id}.jpg`, photos);
  const src = m.src ?? (full ? m.full : null);
  if (!src || existsSync(out) || !wanted(m)) continue;
  const p = parishOf(m);
  if ((perParish[p] ?? 0) >= max) continue;
  perParish[p] = (perParish[p] ?? 0) + 1;
  writeFileSync(out, new Uint8Array(await (await get(src)).arrayBuffer()));
  if (++got % 50 === 0) console.log(`${i + 1}/${media.length}`);
}
console.log(`done: ${got} new photos`);
