// Theme songs for the Estonian films in the drift room (2026-11-16).
// Usage: CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/films.mjs [id ...]
//        CF_TOKEN=... node research/music-drift/films.mjs transcribe
// Writes out/films/<id>.mp3 and <id>.json; `transcribe` writes out/films/transcripts.json.
// Skips ids that exist. Never feeds real lyrics or asks for a real melody: the "named" probes
// only name the film, the "room" songs have lyrics written for this test and describe an era,
// not a composer.
import { writeFile, readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const ACCOUNT = "dc1ee8d72a1fb7da857c46479a8503b8";
const OUT = new URL("./out/films/", import.meta.url);
const EL = "elevenlabs/music-v2"; // $0.0025 per output second
const MM = "minimax/music-2.6"; // $0.15 per track

const el = (prompt, ms, extra = {}) => ({ model: EL, input: { prompt, music_length_ms: ms, output_format: "mp3_44100_128", ...extra } });
const named = (film) => el(`The theme song of the Estonian film ${film}, sung in Estonian.`, 30000);
const namedInstr = (film) => el(`The main title theme of the Estonian film ${film}.`, 30000, { force_instrumental: true });

// Written for this test (8-syllable trochaic lines). Not the films' songs.
const LYRICS = {
  nipernaadi: {
    v1: ["Mööda teed ma lähen jälle,", "päike paistab põllu peale,", "heinamaadel lõhnab suvi,", "järve ääres heinakuhjad."],
    r: ["Tule kaasa, tule kaasa,", "kuni õhtu kätte jõuab,", "tee on pikk ja süda kerge,", "tee on pikk ja süda kerge."],
    v2: ["Kaugel kukub metsas kägu,", "küla kohal suitsub korsten,", "homme olen juba kaugel,", "teisel teel ja teises külas."],
  },
  nukitsamees: {
    v1: ["Metsa veerel, kuuse juures", "elab väike metsavana,", "silmad säravad kui tähed,", "kõrvad pikad nagu lehed."],
    r: ["Tiri-tari, talu õues", "kukk ja kass ja kõik on segi,", "perenaine paneb lukku,", "metsavana on juba sees."],
    v2: ["Piima joob ja leiba sööb ta,", "magab ahju peal kui kiisu,", "hommikul on jälle metsas,", "kastes jäävad väikseid jälgi."],
  },
  kevade: {
    v1: ["Kevad tuli, jõgi jooksis,", "jää läks minema ja kadus,", "poisid koolist välja jooksid,", "kaldal kivid, kaldal pajud."],
    r: ["Lase lendu, lase lendu", "paberlaevad voolu peale,", "kõik on alles ees ja ootab,", "kõik on alles ees ja ootab."],
    v2: ["Kirikukell lööb mäe peal,", "tüdrukud seisavad sillal,", "keegi viskab kivi vette,", "ringid lähevad üle jõe."],
  },
  reliikvia: {
    v1: ["Üle välja, üle nõmme", "sõidame me tuule vastu,", "kabjad löövad, tolmu tõuseb,", "selja taga linnamüürid."],
    r: ["Vabaks, vabaks, ainult vabaks,", "keegi meid ei kinni püüa,", "tuul on meie ainus isand,", "lai on maa ja kõrge taevas."],
    v2: ["Öö on pikk ja mets on pime,", "tähed näitavad meile teed,", "hommikuks on meri näha,", "siis on kõik meil alles ees."],
  },
};
const inline = (l) => [...l.v1, ...l.r, ...l.v2, ...l.r].join(" / ");
const tagged = (l) => `[Verse]\n${l.v1.join("\n")}\n[Chorus]\n${l.r.join("\n")}\n[Verse]\n${l.v2.join("\n")}\n[Chorus]\n${l.r.join("\n")}`;

const STYLE = {
  nipernaadi: "A 1983 Estonian film song: a warm male solo voice, acoustic guitar and a soft accordion, an unhurried walking tempo, a summer road in the countryside. Sung in Estonian with clear diction.",
  nukitsamees: "A 1981 Estonian children's musical film song: playful, a woman and a man singing in turn, kannel (Estonian zither), fiddle and accordion, a bouncy folk-dance beat. Sung in Estonian with clear diction.",
  kevade: "A 1969 Estonian film song: a boys' choir in unison, then in two parts, light strings and a flute, tender and bright, spring by a river. Sung in Estonian with clear diction.",
  reliikvia: "A 1969 Estonian adventure film song: a strong male baritone solo, a galloping rhythm, strings and brass, a male choir joins on the refrain. Sung in Estonian with clear diction.",
};
const ALPINIST = "A 1979 Estonian science-fiction film score: cold analog synthesizers, a slow pulsing bass, wind and snow, a lonely mountain hotel at night, mysterious and calm. Instrumental.";
const mmNamed = (film) => ({ model: MM, input: { prompt: `The theme song of the Estonian film ${film}, sung in Estonian.`, lyrics_optimizer: true, is_instrumental: false } });
const mmRoom = (k) => ({ model: MM, input: { prompt: STYLE[k], lyrics: tagged(LYRICS[k]), lyrics_optimizer: false, is_instrumental: false } });
const room = (k) => el(`${STYLE[k]} Lyrics: "${inline(LYRICS[k])}"`, 45000);

const JOBS = {
  // (a) Named: only the film's name. What does the model invent?
  "named-reliikvia": named("Viimne reliikvia (1969)"),
  "named-reliikvia-instr": namedInstr("Viimne reliikvia (1969)"),
  "named-nipernaadi": named("Nipernaadi (1983)"),
  "named-nukitsamees": named("Nukitsamees (1981)"),
  "named-kevade": named("Kevade (1969)"),
  "named-alpinist": named("Hukkunud Alpinisti hotell (1979)"),
  "named-alpinist-instr": namedInstr("Hukkunud Alpinisti hotell (1979)"),
  // (b) Made for the room: our lyrics, an era, no composer.
  "room-nipernaadi": room("nipernaadi"),
  "room-nukitsamees": room("nukitsamees"),
  "room-kevade": room("kevade"),
  "room-reliikvia": room("reliikvia"),
  "room-alpinist": el(ALPINIST, 30000, { force_instrumental: true }),
  // One MiniMax comparison: the same Nipernaadi lyrics and style.
  // ElevenLabs refused three named probes (copyrighted_material_detected); ask MiniMax for one,
  // letting it write the lyrics itself.
  "mm-named-kevade": { model: MM, input: { prompt: "The theme song of the Estonian film Kevade (1969), sung in Estonian.", lyrics_optimizer: true, is_instrumental: false } },
  "mm-room-nipernaadi": { model: MM, input: { prompt: STYLE.nipernaadi, lyrics: tagged(LYRICS.nipernaadi), lyrics_optimizer: false, is_instrumental: false } },

  // Second round (2026-11-17, "single songs per movie? you should have more"): 4–5 clips per film.
  // (a) MiniMax named probes for the four films it was not asked about. It writes the words.
  "mm-named-reliikvia": mmNamed("Viimne reliikvia (1969)"),
  "mm-named-nipernaadi": mmNamed("Nipernaadi (1983)"),
  "mm-named-nukitsamees": mmNamed("Nukitsamees (1981)"),
  "mm-named-alpinist": mmNamed("Hukkunud Alpinisti hotell (1979)"),
  // (c) Style only: the room STYLE, no film name and no words given; the model writes its own.
  "style-reliikvia": el(STYLE.reliikvia, 40000),
  "style-nipernaadi": el(STYLE.nipernaadi, 40000),
  "style-nukitsamees": el(STYLE.nukitsamees, 40000),
  "style-kevade": el(STYLE.kevade, 40000),
  // (b) MiniMax with the room words and style, as mm-room-nipernaadi.
  "mm-room-reliikvia": mmRoom("reliikvia"),
  "mm-room-nukitsamees": mmRoom("nukitsamees"),
  "mm-room-kevade": mmRoom("kevade"),
  "mm-room-alpinist": { model: MM, input: { prompt: ALPINIST, is_instrumental: true } },
  // (d) One more way per film.
  "march-kevade": el("A 1969 Estonian school march for a spring celebration: a small brass band, snare drum, a bright flute, an upbeat 2/4 marching tempo, a schoolyard in May. Instrumental.", 40000, { force_instrumental: true }),
  "children-nukitsamees": el(`A children's song from an Estonian 1980s children's TV programme: a children's choir, piano, xylophone and a recorder, simple and cheerful, easy to sing along. Sung in Estonian with clear diction. Lyrics: "${inline(LYRICS.nukitsamees)}"`, 45000),
  "synth-alpinist": el("A late-1970s Estonian electronic film score: an arpeggiated analog synthesizer sequence, a slow string pad, a deep drone, distant metallic echoes, tense and hypnotic, a snowed-in hotel and a mystery. Instrumental.", 40000, { force_instrumental: true }),
  // Naming the composer (2026-11-18, asked: "generate hukkunud alpinisti music naming Sven Grünberg"). ElevenLabs
  // refused Pärt by name; does it refuse Grünberg? Film + composer, composer alone, and MiniMax for comparison.
  "composer-alpinist": el("Music by Sven Grünberg for the Estonian film Hukkunud Alpinisti hotell (1979). Instrumental.", 40000, { force_instrumental: true }),
  "composer-grunberg": el("A piece in the style of Sven Grünberg, the Estonian electronic music composer, late 1970s. Instrumental.", 40000, { force_instrumental: true }),
  "mm-composer-alpinist": { model: MM, input: { prompt: "Music by Sven Grünberg for the Estonian film Hukkunud Alpinisti hotell (1979). Instrumental.", is_instrumental: true } },
  // Nipernaadi without the voice (2026-11-18, asked: "nipernaadi instrumental song"): STYLE.nipernaadi minus the voice
  // and the diction (era.mjs's MusicGen text), made instrumental, not separated after (Demucs leaks the voice).
  "instr-nipernaadi": el("A 1983 Estonian film song: acoustic guitar and a soft accordion, an unhurried walking tempo, a summer road in the countryside. Instrumental.", 60000, { force_instrumental: true }),
  "mm-instr-nipernaadi": { model: MM, input: { prompt: "A 1983 Estonian film song: acoustic guitar and a soft accordion, an unhurried walking tempo, a summer road in the countryside. Instrumental.", is_instrumental: true } },
};

const api = (path, body) => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run${path}`, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.CF_TOKEN}`, "content-type": "application/json", "cf-aig-gateway-id": "visualia" },
  body: JSON.stringify(body),
});

async function run(id, job) {
  const res = await api("", job);
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

// Whisper large-v3-turbo, forced Estonian and with detection; no VAD (it drops choir).
async function whisper(audio, language) {
  const res = await api("/@cf/openai/whisper-large-v3-turbo", { audio, ...(language && { language }), condition_on_previous_text: false });
  const body = await res.json();
  const r = body.result ?? body;
  return { text: r.text ?? JSON.stringify(body.errors), language: r.transcription_info?.language, probability: r.transcription_info?.language_probability };
}

async function transcribe() {
  const files = (await readdir(OUT)).filter((f) => f.endsWith(".mp3") && !/instr|alpinist/.test(f) || f === "named-alpinist.mp3");
  const out = {};
  await Promise.all(files.map(async (f) => {
    const audio = (await readFile(new URL(f, OUT))).toString("base64");
    const [et, auto] = await Promise.all([whisper(audio, "et"), whisper(audio)]);
    out[f] = { et, auto };
    console.log(`\n## ${f}\n[et] ${et.text}\n[auto: ${auto.language} ${auto.probability?.toFixed?.(2)}] ${auto.text}`);
  }));
  await writeFile(new URL("transcripts.json", OUT), JSON.stringify(out, null, 2));
}

await mkdir(OUT, { recursive: true });
const args = process.argv.slice(2);
if (args[0] === "transcribe") await transcribe();
else {
  const ids = args.length ? args : Object.keys(JOBS);
  await Promise.all(ids.filter((id) => !existsSync(new URL(`${id}.mp3`, OUT))).map((id) => run(id, JOBS[id]).catch((e) => console.log(id, "error", e.message))));
}
