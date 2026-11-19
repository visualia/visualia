// Generate the music-drift clips through Cloudflare's catalog (AI Gateway "visualia").
// Usage: CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/run.mjs [id ...]
// Writes out/<id>.mp3 and out/<id>.json (request + response). Skips ids that already exist.
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const ACCOUNT = "dc1ee8d72a1fb7da857c46479a8503b8";
const TOKEN = process.env.CF_TOKEN;
const OUT = new URL("./out/", import.meta.url);

const ANTHEM = `Mu isamaa, mu õnn ja rõõm,
kui kaunis oled sa!
Ei leia mina iial teal
see suure laia ilma peal,
mis mul nii armas oleks ka,
kui sa, mu isamaa!`; // Jannsen 1869, public domain

const KOIDULA = `Mu isamaa on minu arm,
kel südant annud ma,
sull' laulan ma, mu ülem õnn,
mu õitsev Eestimaa!
Su valu südames mul keeb,
su õnn ja rõõm mind rõõmsaks teeb,
mu isamaa, mu isamaa!`; // Koidula 1867, public domain

// Written for this test, not a traditional text: 8 syllables, trochaic, alliterating.
const REGI = `Tule, tule, tütar noori,
laula laulu, lõõritella,
meri mängib, mõtted mõlgub,
kaske kasvab kalda alla.`;

// Traditional, Rõuge (EKM FO, Eisen's collection), folklore.ee/lepp/rouge/?sel_id=3; public domain.
const REGI_TOHI = `Tohi siin toresta laulda,
healta hästi kuulutada.
Siin om kulleja külana,
sõnavõttija võsana,
healeviija vitsikunna.
Kubjas kulleli külana,
kilter võtt sõna võsasta,
veli viis heale vitsikusta.`; // E 17169 (5), lines 1–8 of 15

const REGI_ANNEKE = `Üits ep Anneke külassa,
seegi istub kammerenna,
kirjutab kivitoana,
säeb ta sõrme sõrmussida,
kaeb ta kaela kaalussida,
rinda ristiruubelida.
Tuli kuu kossuella,
Teretella Anneksida.
"Tere, Anne, niidisukka,
niidisukka, ninnipõlle!
Tuled ka sina minule?"
Anne kuuli, kosti vasta:
"Kuda lää mina sinule,
ööse sina kasvad, päeva kaod."`; // E 17172 (9), whole

const REGI_VELLEKE = `Üits oli velleke minule,
kuldatutike tuvile,
hõbepärjake õele.
Seegi seppasse sugeni,
seegi aste ametisse.
Tei ta küla kirvesida,
mõnel mehel mõõgapäida,
noorikil nugade päida,
vallale valjaste päida.`; // E 17172/3 (10), whole

const EL = "elevenlabs/music-v2"; // $0.0025 per output second
const MM = "minimax/music-2.6"; // $0.15 per track, no length control

const el = (prompt, _take, extra = {}) => ({ model: EL, input: { prompt, music_length_ms: 25000, output_format: "mp3_44100_128", ...extra } });

const JOBS = {
  // 1. The anthem: Pacius's melody, shared with Finland's Maamme.
  "el-anthem-1": el("The Estonian national anthem, sung by a mixed choir in Estonian.", 1),
  "el-anthem-2": el("The Estonian national anthem, sung by a mixed choir in Estonian.", 2),
  "el-maamme-1": el("The Finnish national anthem, sung by a mixed choir in Finnish.", 1),
  "mm-anthem-lyrics": { model: MM, input: { prompt: "The Estonian national anthem 'Mu isamaa, mu õnn ja rõõm', solemn, sung by a mixed choir in Estonian, a cappella.", lyrics: ANTHEM, lyrics_optimizer: false, is_instrumental: false } },
  // 2. Ernesaks, Koidula's words: listen for õ, ä, ü and long vowels.
  "el-ernesaks-1": el(`Gustav Ernesaks's "Mu isamaa on minu arm", sung by a large Estonian mixed choir at the song festival, in Estonian. Lyrics: ${KOIDULA.replace(/\n/g, " / ")}`, 1),
  "el-ernesaks-2": el(`Gustav Ernesaks's "Mu isamaa on minu arm", sung by a large Estonian mixed choir at the song festival, in Estonian. Lyrics: ${KOIDULA.replace(/\n/g, " / ")}`, 2),
  "mm-ernesaks-lyrics": { model: MM, input: { prompt: "Gustav Ernesaks's 'Mu isamaa on minu arm': a slow, solemn hymn sung by a huge Estonian mixed choir at the Tallinn song festival, in Estonian, a cappella.", lyrics: KOIDULA, lyrics_optimizer: false, is_instrumental: false } },
  // 3. "In the style of Arvo Pärt".
  "el-part-1": el("Instrumental in the style of Arvo Pärt.", 1, { force_instrumental: true }),
  "el-part-2": el("Instrumental in the style of Arvo Pärt.", 2, { force_instrumental: true }),
  // ElevenLabs refuses the name ("violated our Terms of Service"), so describe it instead.
  "el-part-desc": el("Slow Estonian sacred minimalism for piano and strings: a stepwise melody over bell-like tonic triads, silence between phrases.", 1, { force_instrumental: true }),
  "el-part-rule": el("Two voices only, in A minor, slow: one voice moves step by step around A; the second voice only ever plays a note of the A minor triad (A, C, E), always the nearest one above the first voice. Bell-like, piano, no other harmony.", 1, { force_instrumental: true }),
  "mm-part": { model: MM, input: { prompt: "Instrumental in the style of Arvo Pärt.", lyrics_optimizer: false, is_instrumental: true } },
  // 5. Real regilaul texts (asked 2026-11-17, "more regilaul"): Rõuge, Eisen's collection (EKM FO, E), traditional
  // and anonymous, verbatim with the dialect spelling from https://www.folklore.ee/lepp/rouge/?sel_id=3. No melody
  // asked for: the lead sings each line, the group repeats it.
  "el-regi-tohi": el(`Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, unaccompanied, in Estonian. Lyrics: ${REGI_TOHI.replace(/\n/g, " / ")}`, 1, { music_length_ms: 45000 }),
  "el-regi-anneke": el(`Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, unaccompanied, in Estonian. Lyrics: ${REGI_ANNEKE.replace(/\n/g, " / ")}`, 1, { music_length_ms: 45000 }),
  "el-regi-velleke": el(`Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, unaccompanied, in Estonian. Lyrics: ${REGI_VELLEKE.replace(/\n/g, " / ")}`, 1, { music_length_ms: 45000 }),
  // second takes (asked 2026-11-17, "new seed"; a prompt takes no seed, each call differs): does the group answer unforced?
  "el-regi-tohi-2": el(`Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, unaccompanied, in Estonian. Lyrics: ${REGI_TOHI.replace(/\n/g, " / ")}`, 2, { music_length_ms: 45000 }),
  "el-regi-anneke-2": el(`Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, unaccompanied, in Estonian. Lyrics: ${REGI_ANNEKE.replace(/\n/g, " / ")}`, 2, { music_length_ms: 45000 }),
  // 4. Regilaul: call and response, 8-syllable lines.
  "el-regilaul-1": el("Estonian regilaul (runosong): a lead woman singer sings each line and a group of women repeats it, call and response, in Estonian.", 1),
  "el-regilaul-2": el(`Estonian regilaul (runosong): a lead woman singer sings each line and a group of women repeats it, call and response, in Estonian. Lyrics: ${REGI.replace(/\n/g, " / ")}`, 2),
  // More MiniMax runo songs (asked 2026-11-19: "gen more", after listening to mm-regilaul-lyrics): the same prompt, a
  // second take of its four lines, and the three Rõuge texts, each line written twice (lead, then the group)
  "mm-regilaul-lyrics-2": { model: MM, input: { prompt: "Estonian regilaul (runosong): a lead woman singer sings each line and a group of women repeats it, call and response, in Estonian, unaccompanied.", lyrics: REGI.split("\n").flatMap((l) => [l, l]).join("\n"), lyrics_optimizer: false, is_instrumental: false } },
  "mm-regi-tohi": { model: MM, input: { prompt: "Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, in Estonian, unaccompanied.", lyrics: REGI_TOHI.split("\n").flatMap((l) => [l, l]).join("\n"), lyrics_optimizer: false, is_instrumental: false } },
  "mm-regi-anneke": { model: MM, input: { prompt: "Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, in Estonian, unaccompanied.", lyrics: REGI_ANNEKE.split("\n").flatMap((l) => [l, l]).join("\n"), lyrics_optimizer: false, is_instrumental: false } },
  "mm-regi-velleke": { model: MM, input: { prompt: "Estonian regilaul (runosong) from Rõuge, Võrumaa: a lead woman singer sings each line and a group of village women repeats it, call and response, in Estonian, unaccompanied.", lyrics: REGI_VELLEKE.split("\n").flatMap((l) => [l, l]).join("\n"), lyrics_optimizer: false, is_instrumental: false } },
  "mm-regilaul-lyrics": { model: MM, input: { prompt: "Estonian regilaul (runosong): a lead woman singer sings each line and a group of women repeats it, call and response, in Estonian, unaccompanied.", lyrics: REGI.split("\n").flatMap((l) => [l, l]).join("\n"), lyrics_optimizer: false, is_instrumental: false } },
};

async function run(id, job) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "cf-aig-gateway-id": "visualia" },
    body: JSON.stringify(job),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
  await writeFile(new URL(`${id}.json`, OUT), JSON.stringify({ job, status: res.status, body }, null, 2));
  const url = body?.result?.result?.audio ?? body?.result?.audio;
  if (!url) return console.log(id, res.status, "no audio", text.slice(0, 300));
  const audio = await fetch(url);
  await writeFile(new URL(`${id}.mp3`, OUT), Buffer.from(await audio.arrayBuffer()));
  console.log(id, "ok");
}

await mkdir(OUT, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
await Promise.all(ids.filter((id) => !existsSync(new URL(`${id}.mp3`, OUT))).map((id) => run(id, JOBS[id]).catch((e) => console.log(id, "error", e.message))));
