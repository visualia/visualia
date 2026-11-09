// A small class-internal reference set from rahvaroivad.ee (MTÜ Rahvarõivas):
// women's costumes from 12 parishes in confusable pairs, a few photos each,
// the site's 768 px copies (shrink larger ones afterwards: sips -Z 1024 out/costumes/*.jpg). One request at a time, half a second apart.
// Writes out/costumes/<parish>-<n>.jpg and out/costumes/index.json with
// title, photographer and link for attribution. Not in git: the licence is
// still to be confirmed with the site (plans/estonian-visuals.md).
//   node fetch-costumes.mjs [photos per parish, default 3]
import { mkdirSync, writeFileSync } from 'node:fs';

const PARISHES = ['muhu', 'kihnu', 'halliste', 'tarvastu', 'emmaste', 'kihelkonna',
  'setomaa', 'rapina', 'vormsi', 'noarootsi', 'tostamaa', 'kadrina'];
const PER = Number(process.argv[2] ?? 3);
const API = 'https://cms.rahvaroivad.ee/wp-json/wp/v2';
const HEADERS = { 'user-agent': 'visualia-class-scan (EKA course; kristjan.jansen@gmail.com)' };
const dir = new URL('out/costumes/', import.meta.url);
const pause = () => new Promise((r) => setTimeout(r, 500));

async function get(url) {
  await pause();
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res;
}

mkdirSync(dir, { recursive: true });
const wearers = await (await get(`${API}/kandja?per_page=100&_fields=id,name`)).json();
const woman = wearers.find((w) => /^naine$/i.test(w.name));
const index = [];
for (const slug of PARISHES) {
  const [term] = await (await get(`${API}/kihelkond?slug=${slug}&_fields=id,name,parent`)).json();
  if (!term) { console.log(`${slug}: no such parish`); continue; }
  const region = term.parent ? (await (await get(`${API}/kihelkond/${term.parent}?_fields=name`)).json()).name : null;
  const media = await (await get(`${API}/media?kihelkond=${term.id}${woman ? `&kandja=${woman.id}` : ''}&media_type=image&per_page=${PER}&_fields=id,title,link,media_details,source_url`)).json();
  if (!media.length) { console.log(`${term.name} (${region}): no photos of women's costumes`); continue; }
  for (const [i, m] of media.entries()) {
    // The 768 px copy; older uploads have only a "full" one, up to about 2560 px.
    const md = m.media_details ?? {};
    const src = md.sizes?.medium_large?.source_url ?? md.sizes?.large?.source_url
      ?? (md.width <= 2600 ? md.sizes?.full?.source_url ?? m.source_url : null);
    if (!src) continue;
    const file = `${slug}-${i + 1}.jpg`;
    writeFileSync(new URL(file, dir), new Uint8Array(await (await get(src)).arrayBuffer()));
    index.push({ file, parish: term.name, region, wearer: woman?.name ?? null, title: m.title?.rendered,
      photographer: m.media_details?.image_meta?.copyright || null, link: m.link, source: src });
  }
  console.log(`${term.name} (${region}): ${media.length}`);
}
writeFileSync(new URL('index.json', dir), JSON.stringify({ fetched: new Date().toISOString(), source: 'https://rahvaroivad.ee',
  licence: 'to be confirmed with MTÜ Rahvarõivas (terms page: CC BY-NC-ND 3.0 EE); class use only', images: index }, null, 2));
console.log(`${index.length} images`);
