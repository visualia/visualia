// Measuring drift in music (2026-11-17): the two numbers the pictures have, for the clips.
// Usage:
//   node research/music-drift/measure.mjs judge     every clip (generated and real) asked "where is this music from?"
//                                                   by Gemini 3.8 Flash through the live gateway; cached in
//                                                   out/judge-music.jsonl, resumable; stops at $1.00 or on 402
//   node research/music-drift/measure.mjs judge 2   a second, independent answer per clip (round 2), to see how stable the judge is
//   node research/music-drift/measure.mjs words     word error rate and õ/ä/ö/ü kept, from the existing Whisper
//                                                   transcripts; Whisper is run (Cloudflare REST API through AI
//                                                   Gateway, as transcribe.mjs does) only for sung clips with
//                                                   words that lack a transcript (out/measure-transcripts.json)
//   node research/music-drift/measure.mjs report    out/measure.json and the tables for README.md
//   node research/music-drift/measure.mjs separate  the voice taken out (2026-11-17, "vocal removal ... to rm language
//                                                   bias"): Demucs htdemucs, two stems, on the CPU (MPS lacks an op), for
//                                                   every clip whose round-1 answer heard a language; the accompaniment to
//                                                   out/novocals/<id>.mp3, levels to out/novocals/levels.json. DEMUCS = the
//                                                   python with demucs 4.0.1 (default ~/visualia-local/demucs/.venv)
//   node research/music-drift/measure.mjs judge novocals   the same question, the same judge, on the accompaniment
//                                                   alone; cached in out/judge-novocals.jsonl. Clips with almost nothing
//                                                   left (a cappella: 20 dB or more quieter than the clip) are skipped
//   node research/music-drift/measure.mjs novocals  the table: where the judge put each clip with and without the voice
//   node research/music-drift/measure.mjs judge control   the judge's own test (2026-11-17, "does the judge have any
//                                                   credibility ... can it even distinguish big countries' music"): real
//                                                   instrumental recordings from 24 traditions, freely licensed
//                                                   (out/judge-control/manifest.json), the same question; cached in
//                                                   out/judge-control.jsonl
//   node research/music-drift/measure.mjs control   how many it placed right, per tradition
// KEY_PERSON (default eka-teacher) picks the key in .keys.local; `words` needs CF_TOKEN or a wrangler login.
// The question names no country, as the pictures' (evals/estonian-visuals/nature.mjs). The audio goes as
// mono mp3 with every tag stripped (a YouTube title in the tags would give the answer away), at most 180 s.
// The real recordings (out/films/original/, out/nature/control/) are research only: never shown or committed.
import { readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/');
const ROOT = here('../../');
const ACCOUNT = 'dc1ee8d72a1fb7da857c46479a8503b8';
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const JUDGE = { id: 'google/gemini-3.8-flash', in: 0.75, out: 3.75 }; // $ per M tokens (apps/gateway/src/prices.js)
const BUDGET = 1.0;
const MAX_SECONDS = 180;
const [cmd, arg] = process.argv.slice(2);
const NOVOX = arg === 'novocals', CONTROL = arg === 'control';
const CACHE = `${OUT}judge-music.jsonl`;
const JUDGED = NOVOX ? `${OUT}judge-novocals.jsonl` : CONTROL ? `${OUT}judge-control.jsonl` : CACHE;   // where judge() writes
const ROUND = NOVOX || CONTROL ? 1 : Number(arg) || 1;
const NV = `${OUT}novocals/`, LEVELS = `${NV}levels.json`;

const readJsonl = (f) => existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const readJson = (f) => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
const round = (x, n = 3) => x == null ? null : Math.round(x * 10 ** n) / 10 ** n;

// ---- the clips --------------------------------------------------------------------------------

// Enno's "Rändaja õhtulaul" (1910), the poem as printed on babelmatrix.org (fetched 2026-11-17).
// The songs sing it with small changes (laulud.ee: "õhtul hilja"), so the poem is the reference for the
// originals and part of their error is the song's own wording.
const ENNO = [
  ['Ma kõnnin hallil lõpmata teel', 'kesk nurmi, täis valmivat vilja,', 'ma kõnnin ja kõnnin otsata teel,', 'ju lapsena teesid armastas meel,', 'teed laulavad õhtu nii hilja.'],
  ['Need teed, kuis on nad kõvad, kui keed,', 'need otsata kutsuvad jooned,', 'ma kõnnin ja kõnnin, teed kõvad kui keed,', 'nii hallid ja tolmused kõik need teed,', 'need rändaja eluhooned.'],
  ['Ju lapsena teesid armastas meel,', 'ju lapsena kuulda tee juttu,', 'ju lapsena kõndida armastas meel,', 'oma laulu nii laulda hallil teel,', 'kui polekski ilmas ruttu.'],
  ['Tund hiline nüüd laulab lõpmata,', 'meel igatseb tolmuta randa,', 'tund hiline, tee kõva kui kee,', 'mind hoiab mõrsjaks enesele,', 'ei siiski saa pärale kanda.'],
  ['Ma kõnnin hallil lõpmata teel', 'kesk nurmi, täis valmivat vilja,', 'ma kõnnin ja kõnnin otsata teel', 'kui teede laul, tee helisev meel,', 'ja kõik on õhtu nii hilja.'],
];
// What each original sings (by Whisper's segment times): the film clip stanzas 1–3, the record all five.
const REAL = {
  'films/original/uORJCOIZ-yg-Nipernaadi_Anne_Maasiku_Randaja_ohtulaul': { label: 'Rändaja õhtulaul, 1983 film clip (2:36)', words: ENNO.slice(0, 3).flat() },
  'films/original/LW276X3qR5M-Anne_Maasik_Randaja_ohtulaul_Estonian_Folk_Music': { label: 'Rändaja õhtulaul, the record (5:05)', words: ENNO.flat() },
};
// Plans whose chunk texts are directions, not words to sing.
const WORDLESS = new Set(['finale/fin-rule-arc']);
const STAGE = /wordless|no words/i;

function list(dir, ext = /\.mp3$/) {
  const d = `${OUT}${dir}`;
  return existsSync(d) ? readdirSync(d).filter((f) => ext.test(f)).sort().map((f) => `${dir}${f}`) : [];
}

function clips() {
  const files = [
    ...list(''), ...list('', /^tintinnabuli.*\.wav$/), ...list('films/'), ...list('national/'), ...list('finale/'),
    ...list('nature/'), ...list('era/musicgen-small/'), ...list('films/original/'), ...list('nature/control/'),
  ];
  const out = [];
  for (const file of files) {
    const id = file.replace(/\.(mp3|wav)$/, '');
    const name = id.split('/').pop();
    const c = { id, file: `${OUT}${file}` };
    const job = readJson(`${OUT}${id}.json`);
    if (id.startsWith('films/original/')) Object.assign(c, { kind: 'real', model: 'real recording', what: 'music', label: REAL[id]?.label, words: REAL[id]?.words });
    else if (id.startsWith('nature/control/')) Object.assign(c, { kind: 'real', model: 'real recording', what: 'nature', label: `xeno-canto ${name}` });
    else if (name.startsWith('tintinnabuli')) Object.assign(c, { kind: 'rule', model: 'tintinnabuli.mjs (code)', what: 'music', prompt: null });
    else if (name.startsWith('fin-mix-')) Object.assign(c, { kind: 'edit', model: 'edit (ffmpeg)', what: 'music', prompt: null });
    else if (id.startsWith('era/')) {
      if (!job) continue; // ernesaks-long: a joined file with no record of its own
      Object.assign(c, { kind: 'generated', model: 'MusicGen small (2023)', what: 'music', prompt: job.prompt });
    } else if (job?.job) {
      const i = job.job.input;
      const chunks = i.composition_plan?.chunks ?? [];
      const prompt = [i.prompt, ...chunks.flatMap((k) => [k.text, ...(k.positive_styles ?? [])])].filter(Boolean).join(' | ');
      const model = job.job.model === 'minimax/music-2.6' ? 'MiniMax Music 2.6' : 'ElevenLabs Music v2';
      let words = null;
      if (i.lyrics) words = i.lyrics.split('\n').filter((l) => l.trim() && !/^\[.*\]$/.test(l.trim()));
      else if (chunks.length && !WORDLESS.has(id)) words = chunks.map((k) => k.text).filter((t) => !STAGE.test(t)).flatMap((t) => t.split(' / '));
      else if (/Lyrics:/.test(i.prompt ?? '')) words = i.prompt.split('Lyrics:')[1].trim().replace(/^"|"$/g, '').split(' / ');
      else if (/"[^"]* \/ [^"]*"/.test(i.prompt ?? '')) words = i.prompt.match(/"([^"]* \/ [^"]*)"/)[1].split(' / ');
      Object.assign(c, { kind: 'generated', model, what: id.startsWith('nature/') ? 'nature' : 'music', prompt, words, instrumental: !!(i.force_instrumental || i.is_instrumental) });
    } else continue;
    c.prompt_place = c.prompt == null ? null : /\b(eesti|eston)/i.test(c.prompt) ? 'Estonia' : /\b(finn|suomi)/i.test(c.prompt) ? 'Finland' : 'none';
    out.push(c);
  }
  return out;
}

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

// ---- judge: where is this music from? ----------------------------------------------------------

const QUESTION = `Which country or culture does this music most likely come from? Listen only to what is in the recording:
the language of any singing, the scale and harmony, the instruments, the singing or playing style, the sounds.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, people or tradition within that country, or null>",
 "language": "<the language heard in the singing, or null if none>",
 "reason": "<one or two short sentences: the musical reasons (language, scale, instruments, singing style)>"}`;

function gatewayKey() {
  const keys = Object.fromEntries(readFileSync(`${ROOT}.keys.local`, 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}

async function judge() {
  const key = gatewayKey();
  const rows = readJsonl(JUDGED);
  const done = new Set(rows.filter((r) => r.country && (r.round ?? 1) === ROUND).map((r) => r.hash));
  let spent = rows.reduce((a, r) => a + (r.usd ?? 0), 0);
  const todo = (NOVOX ? novoxClips() : CONTROL ? controlClips() : clips()).map((c) => ({ ...c, hash: hash(c.file) })).filter((c) => !done.has(c.hash));
  console.log(`${todo.length} clips to judge; spent so far $${spent.toFixed(3)}`);
  const small = join(tmpdir(), 'measure-music');
  mkdirSync(small, { recursive: true });
  let i = 0, stop = null;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length && !stop) {
      if (spent >= BUDGET) { stop = `budget $${BUDGET} reached`; break; }
      const c = todo[i++];
      const mp3 = join(small, `${c.hash}.mp3`); // mono, no tags, at most MAX_SECONDS
      if (!existsSync(mp3)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', c.file, '-map_metadata', '-1', '-t', String(MAX_SECONDS), '-ac', '1', '-ar', '32000', '-b:a', '64k', mp3]);
      const row = { judge: JUDGE.id, round: ROUND, hash: c.hash, id: c.id, kind: c.kind, model: c.model, seconds_sent: round(Math.min(seconds(c.file), MAX_SECONDS), 1) };
      const t0 = Date.now();
      for (let attempt = 1; attempt <= 3 && !row.country && !stop; attempt++) {
        try {
          const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
            body: JSON.stringify({ model: JUDGE.id, max_tokens: 3000, messages: [{ role: 'user', content: [
              { type: 'text', text: QUESTION }, { type: 'input_audio', input_audio: { data: readFileSync(mp3).toString('base64'), format: 'mp3' } }] }] }),
          });
          if (res.status === 402) { stop = '402 from the gateway (credits)'; break; }
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 200)}`);
          const u = data.usage;
          const usd = u ? ((u.prompt_tokens ?? 0) * JUDGE.in + ((u.total_tokens ?? 0) - (u.prompt_tokens ?? 0) || (u.completion_tokens ?? 0)) * JUDGE.out) / 1e6 : 0;
          spent += usd;
          row.usd = round(usd, 5);
          const text = data.choices?.[0]?.message?.content ?? '';
          const answer = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
          if (!answer?.country) throw new Error(`no answer: ${String(text).slice(0, 120)}`);
          Object.assign(row, answer, { usage: u ?? null, attempt });
          delete row.error;
        } catch (e) { row.error = e.message; }
      }
      row.latency = Date.now() - t0;
      appendFileSync(JUDGED, JSON.stringify(row) + '\n');
      console.log(`${c.id.padEnd(48)} ${row.country ?? 'FAILED ' + row.error} ${row.confidence ?? ''} ${row.region ?? ''} [${row.language ?? '-'}]`);
    }
  }));
  rmSync(small, { recursive: true, force: true });
  console.log(stop ? `stopped: ${stop}` : 'done', `spent $${spent.toFixed(3)}`);
}

// ---- words: WER and õ/ä/ö/ü kept ---------------------------------------------------------------

const DIA = ['õ', 'ä', 'ö', 'ü'];
const norm = (s) => s.normalize('NFC').toLowerCase().replace(/[-–—/]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d;
}

// Word alignment: substitution costs the words' character distance (0..1), so like words pair up;
// the counts (S, D, I) come from the standard Levenshtein, which is what WER means.
function align(ref, hyp) {
  const sub = (a, b) => a === b ? 0 : editDistance([...a], [...b])[a.length][b.length] / Math.max(a.length, b.length);
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]);
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub(ref[i - 1], hyp[j - 1]));
  const pairs = [];
  for (let i = ref.length, j = hyp.length; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && Math.abs(d[i][j] - (d[i - 1][j - 1] + sub(ref[i - 1], hyp[j - 1]))) < 1e-9) { pairs.push([ref[i - 1], hyp[j - 1]]); i--; j--; }
    else if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j] + 1)) < 1e-9) { pairs.push([ref[i - 1], null]); i--; }
    else { pairs.push([null, hyp[j - 1]]); j--; }
  }
  return pairs.reverse();
}

// Per diacritic letter in the given word: kept when the character alignment puts the same letter there.
function keptIn(r, h) {
  const a = [...r], b = [...h], d = editDistance(a, b), out = [];
  for (let i = a.length, j = b.length; i > 0;) {
    if (j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { if (DIA.includes(a[i - 1])) out.push([a[i - 1], a[i - 1] === b[j - 1]]); i--; j--; }
    else if (d[i][j] === d[i - 1][j] + 1) { if (DIA.includes(a[i - 1])) out.push([a[i - 1], false]); i--; }
    else j--;
  }
  return out;
}

function score(refText, hypText) {
  const ref = norm(refText), hyp = norm(hypText);
  const d = editDistance(ref, hyp)[ref.length][hyp.length];
  // Characters, spaces out: forgiving of words run together or split ("armastasmeed").
  const rc = [...ref.join('')], hc = [...hyp.join('')];
  const cer = editDistance(rc, hc)[rc.length][hc.length] / rc.length;
  // Words missed: given words not heard as such (S + D), extra words (Whisper's loops, repeats) left out.
  const pairs = align(ref, hyp);
  const missed = pairs.filter(([r, h]) => r && r !== h).length;
  const dia = Object.fromEntries(DIA.map((x) => [x, { given: 0, kept: 0 }]));
  for (const [r, h] of pairs) if (r && h) for (const [ch, ok] of keptIn(r, h)) { dia[ch].given++; if (ok) dia[ch].kept++; }
  const given = DIA.reduce((a, x) => a + dia[x].given, 0), kept = DIA.reduce((a, x) => a + dia[x].kept, 0);
  return { ref_words: ref.length, hyp_words: hyp.length, wer: round(d / ref.length), cer: round(cer), missed: round(missed / ref.length), dia_given: given, dia_kept: kept, dia_share: given ? round(kept / given) : null, dia };
}

// Join overlapping pieces (22 s with 2 s overlap): drop the next piece's opening words that repeat
// the end of the text so far (up to 8 words).
function joinPieces(texts) {
  let words = [];
  for (const t of texts) {
    const w = (t ?? '').split(/\s+/).filter(Boolean), n = norm(w.join(' '));
    let k = 0;
    const tail = norm(words.slice(-12).join(' '));
    for (let m = Math.min(8, n.length, tail.length); m > 0; m--) if (tail.slice(-m).join(' ') === n.slice(0, m).join(' ')) { k = m; break; }
    words = words.concat(w.slice(k));
  }
  return words.join(' ');
}

// Segments from 30 s windows with 28 s hop: where two overlap in time, keep the longer.
function joinSegments(segs) {
  const out = [];
  for (const s of [...segs].sort((a, b) => a.start - b.start)) {
    const p = out.at(-1);
    if (p && s.start < p.end - 1) { if (s.text.length > p.text.length) out[out.length - 1] = s; } else out.push(s);
  }
  return out.map((s) => s.text).join(' ');
}

function cfToken() {
  if (process.env.CF_TOKEN) return process.env.CF_TOKEN;
  return execFileSync('npx', ['wrangler', 'auth', 'token'], { cwd: `${ROOT}apps/gateway/`, encoding: 'utf8' }).trim().split('\n').pop().trim();
}

// Whisper large-v3-turbo forced to Estonian, ~22 s pieces, no VAD: as national.mjs does.
async function whisperPieces(file, token) {
  const len = seconds(file), pieces = [];
  for (let start = 0; start < len - 3; start += 20) {
    const tmp = join(tmpdir(), `measure-${hash(file)}-${start}.mp3`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(start), '-t', '22', '-i', file, tmp]);
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'cf-aig-gateway-id': 'visualia' },
      body: JSON.stringify({ audio: readFileSync(tmp).toString('base64'), language: 'et', condition_on_previous_text: false }),
    });
    rmSync(tmp);
    const body = await res.json();
    pieces.push({ start, text: (body.result ?? body).text?.trim() ?? '' });
  }
  return { seconds: Math.round(len), et: pieces, minutes: len / 60 };
}

// The transcript a clip has, and how it was made.
function transcript(c) {
  const name = c.id.split('/').pop();
  const top = readJson(`${OUT}transcripts.json`) ?? {}, films = readJson(`${OUT}films/transcripts.json`) ?? {};
  const nat = readJson(`${OUT}national/transcripts.json`) ?? {}, own = readJson(`${OUT}measure-transcripts.json`) ?? {};
  const an = readJson(`${OUT}national/analysis.json`) ?? {};
  if (c.id.startsWith('films/original/')) {
    const a = an[`original:${name.slice(0, 11)}`];
    return a?.whisper ? { text: joinSegments(a.whisper), how: 'Whisper et, 30 s windows (national/analysis.json)' } : null;
  }
  if (!c.id.includes('/') && top[`${name}.mp3`]) return { text: top[`${name}.mp3`].et.text, how: 'Whisper et, whole clip, VAD (transcripts.json)' };
  if (c.id.startsWith('films/') && films[`${name}.mp3`]) return { text: films[`${name}.mp3`].et.text, how: 'Whisper et, whole clip (films/transcripts.json)' };
  if (c.id.startsWith('national/') && nat[name]) return { text: joinPieces(nat[name].et.map((p) => p.text)), how: 'Whisper et, 22 s pieces (national/transcripts.json)' };
  if (own[c.id]) return { text: joinPieces(own[c.id].et.map((p) => p.text)), how: 'Whisper et, 22 s pieces (measure-transcripts.json)' };
  return null;
}

async function words() {
  const all = clips().filter((c) => c.words?.length);
  const ownFile = `${OUT}measure-transcripts.json`;
  const own = readJson(ownFile) ?? {};
  const missing = all.filter((c) => !transcript(c));
  if (missing.length) {
    const token = cfToken();
    for (const c of missing) {
      own[c.id] = await whisperPieces(c.file, token);
      writeFileSync(ownFile, JSON.stringify(own, null, 2));
      console.log(`whisper ${c.id}: ${own[c.id].et.map((p) => p.text).join(' | ')}`);
    }
  }
  const minutes = Object.values(own).reduce((a, t) => a + (t.minutes ?? 0), 0);
  console.log(`Whisper run here: ${Object.keys(own).length} clips, ${minutes.toFixed(1)} min of audio, about $${(minutes * 0.000513).toFixed(4)}`);
  for (const c of all) {
    const t = transcript(c);
    if (!t) { console.log(`${c.id}: no transcript`); continue; }
    const s = score(c.words.join(' '), t.text);
    console.log(`${c.id.padEnd(48)} WER ${s.wer} CER ${s.cer} missed ${s.missed} diacritics ${s.dia_kept}/${s.dia_given}`);
  }
}

// ---- report ------------------------------------------------------------------------------------

const place = (c) => {
  const s = String(c ?? '').trim();
  if (/^eston/i.test(s)) return 'Estonia';
  if (!s || /^(unknown|n\/a|none|null)$/i.test(s)) return 'unknown';
  return s.replace(/^the /i, '');
};
const pct = (k, n) => n ? `${Math.round((100 * k) / n)} % (${k}/${n})` : '–';

function report() {
  const rows = readJsonl(CACHE).filter((r) => r.country);
  const byHash = new Map(rows.filter((r) => (r.round ?? 1) === 1).map((r) => [r.hash, r]));
  const second = new Map(rows.filter((r) => r.round === 2).map((r) => [r.hash, r]));
  const out = [];
  for (const c of clips()) {
    const h = hash(c.file), a = byHash.get(h), b = second.get(h);
    const t = c.words?.length ? transcript(c) : null;
    const s = t ? score(c.words.join(' '), t.text) : null;
    out.push({
      id: c.id, model: c.model, kind: c.kind, what: c.what, prompt_place: c.prompt_place, label: c.label ?? null,
      country: a ? place(a.country) : null, confidence: a?.confidence ?? null, region: a?.region ?? null, language: a?.language ?? null, reason: a?.reason ?? null,
      second: b ? { country: place(b.country), confidence: b.confidence, region: b.region ?? null, language: b.language ?? null } : null,
      wer: s?.wer ?? null, cer: s?.cer ?? null, missed: s?.missed ?? null, diacritics_kept: s?.dia_share ?? null, diacritics: s ? { given: s.dia_given, kept: s.dia_kept, by_letter: s.dia } : null,
      transcript: t?.how ?? null,
    });
  }
  writeFileSync(`${OUT}measure.json`, JSON.stringify({ made: new Date().toISOString(), judge: JUDGE.id, question: QUESTION, clips: out }, null, 2));

  const judged = out.filter((x) => x.country);
  const others = (xs) => {
    const n = {};
    for (const x of xs) if (x.country !== 'Estonia') n[x.country] = (n[x.country] ?? 0) + 1;
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '–';
  };
  const meanConf = (xs) => xs.length ? (xs.reduce((a, x) => a + (Number(x.confidence) || 0), 0) / xs.length).toFixed(2) : '–';
  const row = (label, xs) => `| ${label} | ${pct(xs.filter((x) => x.country === 'Estonia').length, xs.length)} | ${meanConf(xs)} | ${others(xs)} |`;
  const L = [];
  L.push(`Judge ${JUDGE.id}: placed in Estonia, and where else (${judged.length} clips answered)\n`);
  L.push('| Clips | In Estonia | Mean confidence | Elsewhere |', '| --- | ---: | ---: | --- |');
  const gen = judged.filter((x) => x.kind === 'generated');
  L.push(row('Real music (Rändaja õhtulaul, 2 recordings)', judged.filter((x) => x.kind === 'real' && x.what === 'music')));
  L.push(row('Real nature recordings (xeno-canto, 5)', judged.filter((x) => x.kind === 'real' && x.what === 'nature')));
  L.push(row('Generated music, all', gen.filter((x) => x.what === 'music')));
  L.push(row('Generated music, prompt says "Estonian"', gen.filter((x) => x.what === 'music' && x.prompt_place === 'Estonia')));
  L.push(row('Generated music, no country in the prompt', gen.filter((x) => x.what === 'music' && x.prompt_place === 'none')));
  L.push(row('Generated music, prompt says "Finnish"', gen.filter((x) => x.what === 'music' && x.prompt_place === 'Finland')));
  L.push(row('Generated nature, prompt says "Estonian"', gen.filter((x) => x.what === 'nature' && x.prompt_place === 'Estonia')));
  L.push(row('Generated nature, no place', gen.filter((x) => x.what === 'nature' && x.prompt_place === 'none')));
  L.push(row('Edits of generated clips (finale mixes)', judged.filter((x) => x.kind === 'edit')));
  L.push(row('The tintinnabuli rule (code, no model)', judged.filter((x) => x.kind === 'rule')));
  L.push('\nBy model (generated music; "Estonian" in the prompt | not)\n', '| Model | All | "Estonian" | Elsewhere | No "Estonian" | Elsewhere |', '| --- | ---: | ---: | --- | ---: | --- |');
  for (const m of [...new Set(gen.map((x) => x.model))]) {
    const xs = gen.filter((x) => x.model === m && x.what === 'music');
    const ee = xs.filter((x) => x.prompt_place === 'Estonia'), ne = xs.filter((x) => x.prompt_place !== 'Estonia');
    const cnt = (ys) => pct(ys.filter((x) => x.country === 'Estonia').length, ys.length);
    if (xs.length) L.push(`| ${m} | ${cnt(xs)} | ${cnt(ee)} | ${others(ee)} | ${cnt(ne)} | ${others(ne)} |`);
  }
  L.push('\nWith words vs without (generated music)\n', '| | In Estonia | Elsewhere |', '| --- | ---: | --- |');
  const withWords = new Set(clips().filter((c) => c.words?.length).map((c) => c.id));
  const gm = gen.filter((x) => x.what === 'music');
  for (const [label, xs] of [['real Estonian words sent', gm.filter((x) => withWords.has(x.id))], ['no words sent (model writes, or instrumental)', gm.filter((x) => !withWords.has(x.id))]])
    L.push(`| ${label} | ${pct(xs.filter((x) => x.country === 'Estonia').length, xs.length)} | ${others(xs)} |`);
  // What decides it: the language the judge says it heard.
  L.push('\nBy the language the judge heard (all generated music, both rounds pooled)\n', '| Language heard | Answers | In Estonia | Elsewhere |', '| --- | ---: | ---: | --- |');
  const answers = gm.flatMap((x) => [x, ...(x.second ? [{ ...x, ...x.second }] : [])]);
  const lang = (x) => !x.language ? 'none (instrumental, or no words heard)' : /eston/i.test(x.language) ? 'Estonian' : 'another language';
  for (const g of ['Estonian', 'another language', 'none (instrumental, or no words heard)']) {
    const xs = answers.filter((x) => lang(x) === g);
    if (xs.length) L.push(`| ${g} | ${xs.length} | ${pct(xs.filter((x) => x.country === 'Estonia').length, xs.length)} | ${others(xs)} |`);
  }
  const twice = judged.filter((x) => x.second);
  if (twice.length) {
    const same = (xs) => `${xs.filter((x) => x.second.country === x.country).length}/${xs.length}`;
    L.push(`\nAsked twice: same country ${same(twice)}; real ${same(twice.filter((x) => x.kind === 'real'))}, generated ${same(twice.filter((x) => x.kind === 'generated'))}; `
      + `in Estonia both times ${twice.filter((x) => x.country === 'Estonia' && x.second.country === 'Estonia').length}, once ${twice.filter((x) => (x.country === 'Estonia') !== (x.second.country === 'Estonia')).length}`);
    for (const r of [['real', (x) => x.kind === 'real' && x.what === 'music'], ['generated music', (x) => x.kind === 'generated' && x.what === 'music']]) {
      const xs = twice.filter(r[1]);
      L.push(`- ${r[0]}, round 2: ${pct(xs.filter((x) => x.second.country === 'Estonia').length, xs.length)} in Estonia`);
    }
  }
  L.push('\nEvery answer\n', '| Clip | Model | Prompt place | Country | Conf. | Region | Language heard | Round 2 | Reason |', '| --- | --- | --- | --- | ---: | --- | --- | --- | --- |');
  for (const x of judged) L.push(`| ${x.id} | ${x.model} | ${x.prompt_place ?? '–'} | ${x.country} | ${x.confidence} | ${x.region ?? '–'} | ${x.language ?? '–'} | ${x.second ? `${x.second.country} ${x.second.confidence}` : '–'} | ${String(x.reason ?? '').replace(/\|/g, '/')} |`);

  // Words
  const scored = out.filter((x) => x.wer != null);
  const agg = (xs) => {
    const sum = (f) => xs.reduce((a, x) => a + f(x), 0);
    const per = DIA.map((ch) => {
      const g = sum((x) => x.diacritics.by_letter[ch].given), k = sum((x) => x.diacritics.by_letter[ch].kept);
      return `${ch} ${g ? Math.round((100 * k) / g) : '–'} %`;
    }).join(', ');
    const g = sum((x) => x.diacritics.given), k = sum((x) => x.diacritics.kept);
    const med = (f) => { const v = xs.map(f).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
    return { n: xs.length, wer: med((x) => x.wer), cer: med((x) => x.cer), missed: med((x) => x.missed), dia: g ? `${Math.round((100 * k) / g)} % (${k}/${g})` : '–', per };
  };
  L.push('\nWords: Whisper (forced Estonian) against the words given; medians per clip, letters pooled\n', '| Model | Clips | WER (median) | CER (median) | Words missed (median) | õ ä ö ü kept | By letter |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const m of ['real recording', 'ElevenLabs Music v2', 'MiniMax Music 2.6']) {
    const a = agg(scored.filter((x) => x.model === m));
    if (a.n) L.push(`| ${m === 'real recording' ? 'Real recordings (Whisper\'s floor)' : m} | ${a.n} | ${a.wer} | ${a.cer} | ${a.missed} | ${a.dia} | ${a.per} |`);
  }
  L.push('\nPer clip\n', '| Clip | Model | WER | CER | Missed | õ ä ö ü kept | Transcript |', '| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const x of scored) L.push(`| ${x.id} | ${x.model} | ${x.wer} | ${x.cer} | ${x.missed} | ${x.diacritics.kept}/${x.diacritics.given} | ${x.transcript} |`);
  const usd = readJsonl(CACHE).reduce((a, r) => a + (r.usd ?? 0), 0);
  L.push(`\nJudging: ${rows.length} answers, about $${usd.toFixed(3)}`);
  console.log(L.join('\n'));
}

// ---- the voice taken out: does the judge still find Estonia without the language? ----------------

// the clips whose first answer heard a language (round 1), as listed by clips()
function sung() {
  const heard = new Map(readJsonl(CACHE).filter((r) => r.country && (r.round ?? 1) === 1 && r.language).map((r) => [r.id, r]));
  return clips().filter((c) => heard.has(c.id)).map((c) => ({ ...c, with: heard.get(c.id) }));
}
// ffmpeg's volumedetect prints to stderr
const meanDb = (file) => Number(spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']).stderr.toString().match(/mean_volume: (-?[\d.]+)/)[1]);

function separate() {
  const py = process.env.DEMUCS ?? `${process.env.HOME}/visualia-local/demucs/.venv/bin/python`;
  const levels = readJson(LEVELS) ?? {};
  const tmp = join(tmpdir(), 'novocals');
  for (const c of sung()) {
    const dest = `${NV}${c.id}.mp3`;
    if (existsSync(dest) && levels[c.id]) continue;
    const t0 = Date.now();
    execFileSync(py, ['-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-d', 'cpu', '--mp3', '-o', tmp, '--filename', '{stem}.{ext}', c.file], { stdio: 'ignore' });
    mkdirSync(dest.replace(/\/[^/]+$/, ''), { recursive: true });
    execFileSync('cp', [join(tmp, 'htdemucs', 'no_vocals.mp3'), dest]);
    const clip = meanDb(c.file), rest = meanDb(dest);
    levels[c.id] = { clip, rest, drop: round(clip - rest, 1), empty: clip - rest >= 20 };
    writeFileSync(LEVELS, JSON.stringify(levels, null, 2));
    console.log(c.id.padEnd(60), `${((Date.now() - t0) / 1000).toFixed(0)} s`, `clip ${clip} dB, rest ${rest} dB${levels[c.id].empty ? '  (nothing left)' : ''}`);
  }
  rmSync(tmp, { recursive: true, force: true });
}

// the accompaniments worth judging: the same clip records, the file swapped
function novoxClips() {
  const levels = readJson(LEVELS) ?? {};
  return sung().filter((c) => levels[c.id] && !levels[c.id].empty && existsSync(`${NV}${c.id}.mp3`)).map((c) => ({ ...c, file: `${NV}${c.id}.mp3` }));
}

function novocals() {
  const levels = readJson(LEVELS) ?? {};
  const without = new Map(readJsonl(`${OUT}judge-novocals.jsonl`).filter((r) => r.country).map((r) => [r.id, r]));
  const xs = sung().map((c) => ({ id: c.id, kind: c.kind, model: c.model, lang: c.with.language, a: place(c.with.country), level: levels[c.id], b: without.get(c.id) }));
  const L = ['| Clip | Model | With the voice (language) | Without the voice | Confidence |', '| --- | --- | --- | --- | ---: |'];
  for (const x of xs) L.push(`| ${x.id} | ${x.model} | ${x.a} (${x.lang}) | ${x.level?.empty ? '*nothing left*' : x.b ? place(x.b.country) + (x.b.region ? `, ${x.b.region}` : '') : '—'} | ${x.b?.confidence ?? ''} |`);
  const both = xs.filter((x) => x.b);
  const ee = (f) => both.filter((x) => f(x) === 'Estonia').length;
  L.push('', `Judged both ways: ${both.length} clips (${xs.filter((x) => x.level?.empty).length} with nothing left, not judged).`,
    `In Estonia with the voice: ${ee((x) => x.a)}/${both.length}; without: ${ee((x) => place(x.b.country))}/${both.length}.`,
    `Judging without the voice: about $${readJsonl(`${OUT}judge-novocals.jsonl`).reduce((a, r) => a + (r.usd ?? 0), 0).toFixed(3)}`);
  console.log(L.join('\n'));
}

// ---- the judge's own test: real recordings whose country is known ----------------------------------

const CTRL = `${OUT}judge-control/`;
function controlClips() {
  const m = readJson(`${CTRL}manifest.json`) ?? [];
  return m.filter((x) => existsSync(`${CTRL}${x.file}`)).map((x) => ({ id: `judge-control/${x.file}`, file: `${CTRL}${x.file}`, kind: 'real', model: 'real recording', truth: x }));
}
// answers that count as right for a tradition that crosses a border or sits inside a bigger country
const ALSO = { Scotland: ['United Kingdom'], 'United Kingdom': ['Scotland'], Peru: ['Bolivia', 'Ecuador'], Bolivia: ['Peru', 'Ecuador'],
  Austria: ['Germany', 'Switzerland'], Germany: ['Austria', 'Switzerland'], Mali: ['Guinea', 'Senegal', 'Gambia', 'The Gambia'],
  'United States': ['USA', 'United States of America'] };
function control() {
  const ans = new Map(readJsonl(`${OUT}judge-control.jsonl`).filter((r) => r.country).map((r) => [r.id, r]));
  const xs = controlClips().map((c) => ({ c, a: ans.get(c.id) })).filter((x) => x.a);
  const ok = (t, g) => { const tc = t.country.split('/')[0].trim(); return [tc, ...(ALSO[tc] ?? [])].some((k) => place(g).toLowerCase() === k.toLowerCase()); };
  const L = ['| Tradition | Recording | Judge said | Confidence | Right? |', '| --- | --- | --- | ---: | --- |'];
  for (const { c, a } of xs) L.push(`| ${c.truth.country}, ${c.truth.instrument} | ${c.truth.title} | ${place(a.country)}${a.region ? `, ${a.region}` : ''} | ${a.confidence} | ${ok(c.truth, a.country) ? 'yes' : '**no**'} |`);
  const right = xs.filter(({ c, a }) => ok(c.truth, a.country)).length;
  const baltic = xs.filter(({ c }) => /Estonia|Latvia|Lithuania|Finland/.test(c.truth.country));
  L.push('', `Right: ${right}/${xs.length}. Estonia, Latvia, Lithuania, Finland: ${baltic.filter(({ c, a }) => ok(c.truth, a.country)).length}/${baltic.length}.`,
    `Judging: about $${readJsonl(`${OUT}judge-control.jsonl`).reduce((s, r) => s + (r.usd ?? 0), 0).toFixed(3)}`);
  console.log(L.join('\n'));
}

if (cmd === 'judge') await judge();
else if (cmd === 'separate') separate();
else if (cmd === 'novocals') novocals();
else if (cmd === 'control') control();
else if (cmd === 'words') await words();
else if (cmd === 'report') report();
else console.log('node research/music-drift/measure.mjs judge [2|novocals] | words | report | separate | novocals');
