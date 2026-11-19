// National and song-festival songs for the Song Festival Grounds room (2026-11-17).
// Usage: CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/national.mjs [id ...]
//        CF_TOKEN=... node research/music-drift/national.mjs transcribe [id ...]
// Writes out/national/<id>.mp3 and <id>.json, copies both to ~/visualia-local/music-drift/national/;
// `transcribe` writes out/national/transcripts.json (Whisper, forced Estonian, in ~22 s pieces).
// Skips ids that exist (clips and transcripts). Only words in the public domain are sent (every
// author died before 1956), verbatim; no melody is asked for and no composer is named: the style
// is described (choir, era, tempo, instruments). The "named" probes give the title only.
// Sources for the words and credits: README.md, "National songs".
import { writeFile, readFile, mkdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const ACCOUNT = "dc1ee8d72a1fb7da857c46479a8503b8";
const OUT = new URL("./out/national/", import.meta.url);
const KEEP = join(homedir(), "visualia-local/music-drift/national");
const EL = "elevenlabs/music-v2"; // $0.0025 per output second
const MM = "minimax/music-2.6"; // $0.15 per track

const el = (prompt, ms, extra = {}) => ({ model: EL, input: { prompt, music_length_ms: ms, output_format: "mp3_44100_128", ...extra } });

// The real words (public domain), as printed in the sources in README.md.
const WORDS = {
  // Lydia Koidula (1843–1886), 1867; first stanza.
  "sind-surmani": [
    "Sind surmani küll tahan", "ma kalliks pidada,", "mu õitsev Eesti rada,", "mu lehkav isamaa!",
    "Mu Eesti vainud, jõed", "ja minu emakeel,", "teid kõrgeks kiita tahan", "ma surmatunnil veel!",
  ],
  // Juhan Liiv (1864–1913), 1905; first and third stanzas.
  mesipuu: [
    "Ta lendab lillest lillesse", "ja lendab mesipuu poole;", "ja tõuseb kõuepilv ülesse,", "ta lendab mesipuu poole.",
    "Hing, oh hing, sa raskel a'al –", "kuis õhkad isamaa poole;", "kas kodu sa, kas võõral maal –", "kuis ihkad isamaa poole!",
  ],
  // Friedrich Kuhlbars (1841–1924), "Vanemuine", 1869; first stanza and refrain.
  kungla: [
    "Kui Kungla rahvas kuldsel a'al", "kord istus maha sööma,", "siis Vanemuine murumaal", "läks kandlelugu lööma.",
    "Läks aga metsa mängima,", "läks aga laande lauluga.", "Läks lauluga, läks lauluga,", "läks lauluga!",
  ],
  // Martin Körber (1817–1893); first three couplets.
  "isamaa-armas": [
    "Mu isamaa armas, kus sündinud ma,", "sind armastan ma järjest ja kiidan lauluga!",
    "Ei seedrid, ei palmid ei kasva me maal;", "kuid siiski kenad männid ja kuused, kased ka.",
    "Ei hõbedat, kulda ei leidu me maal;", "kuid viljakandvat mulda on küllalt igal pool.",
  ],
  // Ernst Enno (1875–1934), "Rändaja õhtulaul", 1910; first and last stanzas of the poem.
  randaja: [
    "Ma kõnnin hallil lõpmata teel", "kesk nurmi, täis valmivat vilja,", "ma kõnnin ja kõnnin otsata teel,", "ju lapsena teesid armastas meel,", "teed laulavad õhtu nii hilja.",
    "Ma kõnnin hallil lõpmata teel", "kesk nurmi, täis valmivat vilja,", "ma kõnnin ja kõnnin otsata teel", "kui teede laul, tee helisev meel,", "ja kõik on õhtu nii hilja.",
  ],
};

// An era and a line-up, never a composer.
const STYLE = {
  "sind-surmani": "An Estonian choral song from the first song festival, 1869: a large men's choir a cappella, solemn and warm, a slow hymn-like tempo, 19th-century romantic part-song harmony, sung outdoors.",
  mesipuu: "A modern Estonian song-festival anthem: a massed choir of thousands at an open-air song festival, mixed voices with a symphonic wind band, broad and slowly rising, moderate tempo, the last line held and swelling.",
  kungla: "An Estonian national-awakening choral song from the 1870s: a big mixed choir and the whole festival crowd singing together, bright and festive, a swinging folk-like dance lilt, the refrain repeated with joy.",
  "isamaa-armas": "A simple 19th-century Estonian patriotic song in an old German folk-song style: a mixed choir in unison then in parts, a small brass band, gentle and steady, each couplet sung twice.",
  randaja: "An intimate Estonian art song of the late 1970s: a woman's clear solo voice, an acoustic guitar and soft strings, slow and wistful, a wanderer walking a dusty country road at dusk.",
};
const DICTION = " Sung in Estonian with clear diction.";
const lyricsText = (k) => WORDS[k].join(" / ");
const song = (k) => el(`${STYLE[k]}${DICTION} Lyrics: "${lyricsText(k)}"`, 45000);
const named = (title) => el(`The Estonian song "${title}", sung in Estonian.`, 30000);
const mm = (k) => ({ model: MM, input: { prompt: STYLE[k] + DICTION, lyrics: WORDS[k].join("\n"), lyrics_optimizer: false, is_instrumental: false } });

const NUDGE = "A slow, melancholic Estonian ballad of the late 1970s, 60 BPM, D minor, strophic: verse after verse with no chorus, about 48 seconds for each five-line verse. A solo female alto voice, warm and full, with a wide theatrical vibrato, sung slowly and freely: each line is drawn out over about ten seconds with a short breath after it. Accordion holds soft sustained chords and bass notes, an acoustic guitar picks gentle arpeggios, a soft flute answers between lines, a faint chime marks the verse ends. A three-second intro, then straight into the singing. Quiet and even, mezzo-piano, warm analog room reverb, intimate and nostalgic. Sung in Estonian with clear diction.";
const NUDGE_STYLES = ["slow melancholic ballad", "60 BPM", "D minor", "late 1970s", "solo female alto with wide vibrato", "each line drawn out over ten seconds", "accordion sustained chords", "fingerpicked acoustic guitar", "soft flute answers", "warm analog room reverb", "sung in Estonian", "mezzo-piano"];
const NUDGE_NOT = ["drums", "synth", "choir", "male voice", "English", "fast"];

const JOBS = {
  "nat-sind-surmani": song("sind-surmani"),
  "nat-mesipuu": song("mesipuu"),
  "nat-kungla": song("kungla"),
  "nat-isamaa-armas": song("isamaa-armas"),
  "nat-randaja": song("randaja"),
  // The title only: refused, or what does the model invent?
  "named-randaja": named("Rändaja õhtulaul"),
  "named-mesipuu": named("Ta lendab mesipuu poole"),
  // MiniMax, same words and style, for the drift comparison.
  "mm-randaja": mm("randaja"),
  "mm-mesipuu": mm("mesipuu"),
  // "Rändaja õhtulaul" nudged toward the 1983 recording (asked 2026-11-17: "just want nudge music
  // towards original"), through text only: what `analyse` measured on the original and what
  // Gemini heard (out/national/original-gemini.json). Tempo, key, voice, instruments and the
  // form; never the melody, never the composer. Same words as nat-randaja.
  "nudge-randaja-prompt": el(`${NUDGE} Lyrics: "${lyricsText("randaja")}"`, 100000),
  "nudge-randaja-plan": { model: EL, input: { output_format: "mp3_44100_128", seed: 20261117, composition_plan: { chunks: [
    { text: WORDS.randaja.slice(0, 5).join(" / "), duration_ms: 50000, positive_styles: NUDGE_STYLES, negative_styles: NUDGE_NOT },
    { text: WORDS.randaja.slice(5).join(" / "), duration_ms: 50000, positive_styles: [...NUDGE_STYLES, "fading out gently at the end"], negative_styles: NUDGE_NOT },
  ] } } },
};

const api = (path, body) => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run${path}`, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.CF_TOKEN}`, "content-type": "application/json", "cf-aig-gateway-id": "visualia" },
  body: JSON.stringify(body),
});

async function keep(name) {
  await mkdir(KEEP, { recursive: true });
  await copyFile(new URL(name, OUT), join(KEEP, name));
}

async function run(id, job) {
  const res = await api("", job);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
  await writeFile(new URL(`${id}.json`, OUT), JSON.stringify({ job, status: res.status, body }, null, 2));
  await keep(`${id}.json`);
  const url = body?.result?.result?.audio ?? body?.result?.audio;
  if (!url) return console.log(id, res.status, "no audio", text.slice(0, 600));
  const audio = await fetch(url);
  await writeFile(new URL(`${id}.mp3`, OUT), Buffer.from(await audio.arrayBuffer()));
  await keep(`${id}.mp3`);
  console.log(id, "ok");
}

// Whisper large-v3-turbo; no VAD (it drops choir).
async function whisper(audio, language) {
  const res = await api("/@cf/openai/whisper-large-v3-turbo", { audio, ...(language && { language }), condition_on_previous_text: false });
  const body = await res.json();
  const r = body.result ?? body;
  return { text: r.text ?? JSON.stringify(body.errors), language: r.transcription_info?.language, probability: r.transcription_info?.language_probability };
}

const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());

// Forced Estonian in ~22 s pieces with 2 s overlap (Whisper drops lines on whole 45 s songs),
// plus one detection run on the whole clip.
async function transcribeOne(f) {
  const path = new URL(f, OUT).pathname;
  const len = seconds(path);
  const pieces = [];
  for (let start = 0; start < len - 3; start += 20) {
    const tmp = join(tmpdir(), `national-${f}-${start}.mp3`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(start), "-t", "22", "-i", path, tmp]);
    const r = await whisper((await readFile(tmp)).toString("base64"), "et");
    await rm(tmp);
    pieces.push({ start, text: r.text?.trim() });
  }
  const auto = await whisper((await readFile(path)).toString("base64"));
  return { seconds: Math.round(len), et: pieces, auto };
}

async function transcribe(ids) {
  const file = new URL("transcripts.json", OUT);
  const out = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const files = Object.keys(JOBS).filter((id) => (!ids.length || ids.includes(id)) && existsSync(new URL(`${id}.mp3`, OUT)) && !out[id]);
  for (const id of files) {
    out[id] = await transcribeOne(`${id}.mp3`);
    console.log(`\n## ${id} (${out[id].seconds} s)`);
    for (const p of out[id].et) console.log(`[et ${p.start}s] ${p.text}`);
    console.log(`[auto: ${out[id].auto.language} ${out[id].auto.probability?.toFixed?.(2)}] ${out[id].auto.text}`);
    await writeFile(file, JSON.stringify(out, null, 2));
  }
  await keep("transcripts.json");
}

// ---- analyse: tempo, key and loudness, measured locally (free, no dependencies) ----------
// Decodes with ffmpeg to mono 22050 Hz. Tempo: spectral-flux onset strength, autocorrelation
// over 50–200 BPM (the top three peaks are kept: half and double tempo are common errors).
// Key: a chroma vector (FFT bins 65–2000 Hz folded to pitch classes, whole clip) correlated
// with the Krumhansl–Kessler major and minor profiles. Loudness: RMS dBFS per 10 s.
const SR = 22050, N = 4096, HOP = 512;
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function decode(file) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

const corr = (a, b) => {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
};

function analyse(file) {
  const x = decode(file);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames = Math.floor((x.length - N) / HOP);
  const chroma = new Array(12).fill(0), flux = new Float32Array(frames);
  const binPc = Array.from({ length: N / 2 }, (_, k) => {
    const f = (k * SR) / N;
    return f < 65 || f > 2000 ? -1 : ((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12;
  });
  let prev = new Float32Array(N / 2);
  for (let t = 0; t < frames; t++) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[t * HOP + i] * win[i];
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let fl = 0;
    for (let k = 1; k < N / 2; k++) {
      mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      if (binPc[k] >= 0) chroma[binPc[k]] += Math.hypot(re[k], im[k]);
      if (k < 600) fl += Math.max(0, mag[k] - prev[k]);
    }
    flux[t] = fl;
    prev = mag;
  }
  // Onset envelope: flux minus its local mean, half-wave rectified.
  const env = flux.map((v, t) => {
    let s = 0, c = 0;
    for (let j = Math.max(0, t - 20); j < Math.min(frames, t + 20); j++) { s += flux[j]; c++; }
    return Math.max(0, v - s / c);
  });
  const fps = SR / HOP, peaks = [];
  const ac = (lag) => { let s = 0; for (let t = lag; t < env.length; t++) s += env[t] * env[t - lag]; return s / (env.length - lag); };
  const lo = Math.floor((fps * 60) / 200), hi = Math.ceil((fps * 60) / 50);
  const acs = [];
  for (let lag = lo; lag <= hi; lag++) acs.push([lag, ac(lag)]);
  for (let i = 1; i < acs.length - 1; i++) if (acs[i][1] > acs[i - 1][1] && acs[i][1] >= acs[i + 1][1]) peaks.push(acs[i]);
  const max = Math.max(...peaks.map((p) => p[1]));
  const bpm = peaks.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([lag, v]) => ({ bpm: Math.round((600 * fps) / lag) / 10, strength: Math.round((100 * v) / max) / 100 }));
  const keys = [];
  for (let r = 0; r < 12; r++) {
    const rot = (p) => p.map((_, i) => p[(i - r + 12) % 12]);
    keys.push([`${NOTES[r]} major`, corr(chroma, rot(MAJOR))], [`${NOTES[r]} minor`, corr(chroma, rot(MINOR))]);
  }
  keys.sort((a, b) => b[1] - a[1]);
  const rms = [];
  for (let s = 0; s < x.length; s += SR * 10) {
    let e = 0;
    const end = Math.min(x.length, s + SR * 10);
    for (let i = s; i < end; i++) e += x[i] * x[i];
    rms.push(Math.round(10 * Math.log10(e / (end - s) + 1e-12)));
  }
  return { seconds: Math.round(x.length / SR), bpm, key: keys.slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(2)}`), rmsDb10s: rms };
}

// Whisper with its segment times: where the lines fall (the original's against ours).
async function segments(file) {
  const out = [];
  const len = seconds(file);
  for (let start = 0; start < len - 3; start += 28) {
    const tmp = join(tmpdir(), `national-seg-${start}.mp3`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(start), "-t", "30", "-i", file, tmp]);
    const res = await api("/@cf/openai/whisper-large-v3-turbo", { audio: (await readFile(tmp)).toString("base64"), language: "et", condition_on_previous_text: false });
    await rm(tmp);
    const r = (await res.json()).result ?? {};
    for (const s of r.segments ?? []) out.push({ start: Math.round(start + s.start), end: Math.round(start + s.end), text: s.text.trim() });
  }
  return out;
}

const ORIGINALS = new URL("./out/films/original/", import.meta.url);

await mkdir(OUT, { recursive: true });
const args = process.argv.slice(2);
if (args[0] === "transcribe") await transcribe(args.slice(1));
else if (args[0] === "analyse") {
  // Writes out/national/analysis.json: the originals (research only, never shown) and our clips.
  const file = new URL("analysis.json", OUT);
  const out = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const targets = [
    ...(existsSync(ORIGINALS) ? execFileSync("ls", [ORIGINALS.pathname]).toString().split("\n").filter((f) => f.endsWith(".mp3")).map((f) => [`original:${f.slice(0, 11)}`, new URL(f, ORIGINALS).pathname]) : []),
    ...Object.keys(JOBS).filter((id) => id.includes("randaja") && existsSync(new URL(`${id}.mp3`, OUT))).map((id) => [id, new URL(`${id}.mp3`, OUT).pathname]),
  ];
  for (const [id, path] of targets) {
    if (out[id]?.whisper) continue;
    out[id] ??= analyse(path);
    if (process.env.CF_TOKEN) out[id].whisper = await segments(path);
    console.log(id, JSON.stringify({ ...out[id], whisper: undefined }));
    await writeFile(file, JSON.stringify(out, null, 2));
  }
  await keep("analysis.json");
}
else {
  const ids = args.length ? args : Object.keys(JOBS);
  await Promise.all(ids.filter((id) => !existsSync(new URL(`${id}.mp3`, OUT)) && !existsSync(new URL(`${id}.json`, OUT))).map((id) => run(id, JOBS[id]).catch((e) => console.log(id, "error", e.message))));
}
