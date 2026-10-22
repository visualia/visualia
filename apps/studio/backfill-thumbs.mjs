// One-off (2026-10-22): make the thumbnails of every class project's latest
// version, for projects whose screenshots predate /thumb. Each GET makes and
// stores the WebP once (thumbs.js); later ones read R2.
//   VISUALIA_COOKIE='__Host-visualia=…' node apps/studio/backfill-thumbs.mjs
const O = 'https://studio.visualia.space';
const headers = { cookie: process.env.VISUALIA_COOKIE };
const { projects } = await (await fetch(`${O}/api/projects`, { headers })).json();
for (const p of projects.filter((p) => p.versions)) {
  const got = [];
  for (const w of [16, 160, 320, 480, 640]) {
    const r = await fetch(`${O}/thumb/${p.id}/${p.versions}/${w}`, { headers });
    got.push(`${w}:${r.ok ? (await r.arrayBuffer()).byteLength : r.status}`);
  }
  console.log(p.id, `v${p.versions}`, p.title, got.join(' '));
}
