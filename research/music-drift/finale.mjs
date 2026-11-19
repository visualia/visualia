// Finale candidates for the Arunädal demo: the specific dissolves into the probable, and comes back.
// Usage: CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/finale.mjs [id ...]
// Writes out/finale/<id>.mp3 and <id>.json. Skips ids that exist. The mixes with the tintinnabuli
// rule are made afterwards with ffmpeg (commands in the README).
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const ACCOUNT = "dc1ee8d72a1fb7da857c46479a8503b8";
const OUT = new URL("./out/finale/", import.meta.url);
const EL = "elevenlabs/music-v2"; // $0.0025 per output second

// Koidula 1867 and Jannsen 1869, public domain.
const KOIDULA_1 = "Mu isamaa on minu arm, / kel südant annud ma, / sull' laulan ma, mu ülem õnn, / mu õitsev Eestimaa!";
const ANTHEM_1 = "Mu isamaa, mu õnn ja rõõm, / kui kaunis oled sa!";
const CHOIR = ["large Estonian mixed choir", "a cappella", "sung in Estonian", "slow solemn hymn", "clear diction"];
// The probable: what a model gives when nobody asks for more.
const BED = ["generic ambient background music", "soft synth pad", "relaxing", "wordless", "no vocals"];
const NOT_CHOIR = ["choir", "lyrics", "words"];

const plan = (chunks) => ({ model: EL, input: { composition_plan: { chunks }, output_format: "mp3_44100_128", seed: 20261120 } });

const JOBS = {
  // A. Ernesaks: words, then they dissolve into a bed, then the last line comes back.
  "fin-ernesaks-arc": plan([
    { text: KOIDULA_1, duration_ms: 22000, positive_styles: CHOIR, negative_styles: ["drums", "synth", "English"] },
    { text: "The voices melt into a soft wordless pad; no words.", duration_ms: 18000, positive_styles: BED, negative_styles: NOT_CHOIR },
    { text: "mu isamaa, mu isamaa!", duration_ms: 20000, positive_styles: CHOIR, negative_styles: ["drums", "synth", "English"] },
  ]),
  // B. The anthem's first two lines, the same arc.
  "fin-anthem-arc": plan([
    { text: ANTHEM_1, duration_ms: 20000, positive_styles: [...CHOIR, "national anthem"], negative_styles: ["drums", "synth", "English", "Finnish"] },
    { text: "The voices melt into a soft wordless pad; no words.", duration_ms: 20000, positive_styles: BED, negative_styles: NOT_CHOIR },
    { text: ANTHEM_1, duration_ms: 20000, positive_styles: [...CHOIR, "national anthem"], negative_styles: ["drums", "synth", "English", "Finnish"] },
  ]),
  // C. The rule in words, then the bed, then the rule (no composer's name anywhere).
  "fin-rule-arc": plan([
    { text: "Two voices only, piano, A minor, slow: one voice moves step by step around A; the other plays only A, C or E, always the nearest one above. Silence between phrases.", duration_ms: 20000, positive_styles: ["two-voice piano", "bell-like", "sparse", "A minor", "slow"], negative_styles: ["drums", "pad", "strings", "chords"] },
    { text: "Generic calm ambient background music.", duration_ms: 20000, positive_styles: BED, negative_styles: ["silence", "sparse"] },
    { text: "Back to two voices only, piano, A minor: one stepwise voice, the other only A, C or E above it.", duration_ms: 20000, positive_styles: ["two-voice piano", "bell-like", "sparse", "A minor", "slow"], negative_styles: ["drums", "pad", "strings", "chords"] },
  ]),
  // E. Regilaul (our own test text from run.mjs, not a traditional song; no Seto leelo): a lead and a
  // group, call and response, then a "Nordic folk" bed, then the lead and the group come back.
  "fin-regilaul-arc": plan([
    { text: "Tule, tule, tütar noori, / tule, tule, tütar noori, / laula laulu, lõõritella, / laula laulu, lõõritella", duration_ms: 22000, positive_styles: ["Estonian regilaul", "a lead woman singer, a group of women repeats each line", "call and response", "unaccompanied", "sung in Estonian"], negative_styles: ["drums", "synth", "English"] },
    { text: "The voices melt into a generic folk-ambient bed; no words.", duration_ms: 18000, positive_styles: ["generic Nordic folk ambient", "soft synth pad", "drone", "wordless", "no vocals"], negative_styles: NOT_CHOIR },
    { text: "meri mängib, mõtted mõlgub, / meri mängib, mõtted mõlgub", duration_ms: 20000, positive_styles: ["Estonian regilaul", "a lead woman singer, a group of women repeats the line", "call and response", "unaccompanied", "sung in Estonian"], negative_styles: ["drums", "synth", "English"] },
  ]),
  // F. In A and B the third chunk came back near silent (-46 to -64 dB), so try one prompt instead of a plan.
  "fin-ernesaks-return": { model: EL, input: { prompt: `A large Estonian mixed choir sings, a cappella, in Estonian, slow and solemn: "${KOIDULA_1}" Then the voices dissolve into a soft generic ambient synth pad with no words for about fifteen seconds. Then the full choir returns, loud and clear, and sings "mu isamaa, mu isamaa!" to the end.`, music_length_ms: 60000, output_format: "mp3_44100_128" } },
  // G. No arc: just the specific, the anthem's first verse, as the plain last word.
  "fin-anthem-plain": { model: EL, input: { prompt: `A large Estonian mixed choir sings, a cappella, in Estonian, slow and solemn, with clear diction: "Mu isamaa, mu õnn ja rõõm, / kui kaunis oled sa! / Ei leia mina iial teal / see suure laia ilma peal, / mis mul nii armas oleks ka, / kui sa, mu isamaa!"`, music_length_ms: 45000, output_format: "mp3_44100_128" } },
  // D. The probable on its own, to mix under the tintinnabuli rule (A minor, 75 bpm like the generator).
  "fin-bed": { model: EL, input: { prompt: "Calm relaxing ambient background music, piano and soft strings, A minor, 75 BPM.", music_length_ms: 40000, force_instrumental: true, output_format: "mp3_44100_128" } },
};

async function run(id, job) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CF_TOKEN}`, "content-type": "application/json", "cf-aig-gateway-id": "visualia" },
    body: JSON.stringify(job),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
  await writeFile(new URL(`${id}.json`, OUT), JSON.stringify({ job, status: res.status, body }, null, 2));
  const url = body?.result?.result?.audio ?? body?.result?.audio;
  if (!url) return console.log(id, res.status, "no audio", text.slice(0, 400));
  const audio = await fetch(url);
  await writeFile(new URL(`${id}.mp3`, OUT), Buffer.from(await audio.arrayBuffer()));
  console.log(id, "ok");
}

await mkdir(OUT, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
await Promise.all(ids.filter((id) => !existsSync(new URL(`${id}.mp3`, OUT))).map((id) => run(id, JOBS[id]).catch((e) => console.log(id, "error", e.message))));
