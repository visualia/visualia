# Music drift: Estonian music through the catalog's music models

A side test for the Arunädal bias demo (`research/arunadal-demo.md`, EKA, 20.11.2026): do the
music models drift the way the image models do? Run 2026-11-16. A model makes the final sound
file, so this is visualia, not positron (see CLAUDE.md).

Files:

- `run.mjs`: every prompt, and the call that made each clip. `CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/run.mjs [id ...]`; skips clips that exist.
- `transcribe.mjs`: Whisper large-v3-turbo on the vocal clips, forced to Estonian and with detection.
- `tintinnabuli.mjs`: the rule as code, no dependencies, MIDI + WAV.
- `nature.mjs`, `birdnet.mjs`: Estonian nature sounds and BirdNET without Python; see `nature-sounds.md`.
- `finale.mjs`: the finale candidates (2026-11-16), writes `out/finale/`; the ffmpeg mixes are described in the last section.
- `films.mjs`: theme songs for the drift room's films (2026-11-16), writes `out/films/`; `films.mjs transcribe` runs Whisper. See "Film theme songs".
- `national.mjs`: national and song-festival songs with their real public-domain words, for the Song Festival Grounds room (2026-11-17), writes `out/national/`; `transcribe` runs Whisper, `analyse` measures tempo, key and loudness. See "National songs".
- `era.mjs`: the era ladder for music (2026-11-17): the same prompts through MusicGen small (2023) on this Mac, no cloud, writes `out/era/`; `era.mjs report` measures loudness. See "Era ladder".
- `out/` (git-ignored): the clips, the raw responses (`<id>.json`), `transcripts.json`.
  **Kept on purpose** (asked 2026-11-16: *"keep that music around, it's really good"*): a copy lives in
  `~/visualia-local/music-drift/` (33 files, 24 MB, outside git). Don't delete either copy when cleaning up.

Nobody has listened yet. Everything below is what can be checked without ears: length, what was
asked for, what came back, what Whisper hears.

## The models in the catalog

Searched the Cloudflare catalog (`developers.cloudflare.com/ai/models`) on 2026-11-16. Two music
models; **no Lyria, no Stable Audio**.

| Model | Id | Input | Length | Price |
| --- | --- | --- | --- | --- |
| ElevenLabs Music v2 | `elevenlabs/music-v2` | `prompt` or `composition_plan` (chunks with text, styles, 3–120 s each), `music_length_ms`, `force_instrumental`, `output_format`; `seed` only with a composition plan | 3 s – 600 s | $0.0025 per output second (25 s = $0.0625) |
| MiniMax Music 2.6 | `minimax/music-2.6` | `prompt` (≤ 2000 chars), `lyrics` (≤ 3500), `is_instrumental`, `lyrics_optimizer` (writes lyrics for you), `format` mp3/wav | no length control: we got 25 s to 142 s | $0.15 per track, $0.01 per lyrics generation |

Speech-to-text in the catalog: `@cf/openai/whisper-large-v3-turbo` ($0.000513 per audio minute,
takes `language`), `@cf/openai/whisper`, `openai/gpt-4o-transcribe` ($0.006/min, not used).

Both music models answer through `POST /accounts/<acct>/ai/run` with `{"model", "input"}`; the
audio URL is at `result.result.audio` and expires after 24 h, so `run.mjs` downloads it at once.
Neither returns any text: no lyrics, no description, only the audio.

**Spent: about $1.17** (9 ElevenLabs clips × 25 s = $0.56, 4 MiniMax tracks = $0.60, Whisper
about a cent). Two refused calls, below; presumably not billed.

## The anthem: a shared melody

Fact: Fredrik Pacius wrote the melody in 1848 for Finland's "Maamme"; Estonia's "Mu isamaa, mu
õnn ja rõõm" (words J. V. Jannsen, 1869; anthem 1920, again May 1990) uses the same melody. *"The
only differences between the two anthems are their key signature and the repetition of the last
four lines of each verse in the Finnish anthem."* It is also the Livonian anthem, "Min izāmō".
Source: https://en.wikipedia.org/wiki/Mu_isamaa,_mu_%C3%B5nn_ja_r%C3%B5%C3%B5m (fetched
2026-11-16). So **the Finnish tune is the right answer**; a model that gives Pacius's tune is not
substituting the neighbour. The drift to look for is the other way: a made-up anthem, or Finnish
words.

| Clip | Asked | Whisper heard (et) | Note |
| --- | --- | --- | --- |
| `el-anthem-1` (25 s) | "The Estonian national anthem, sung by a mixed choir in Estonian." No lyrics. | "Suurad voimat meid, üks laad, üks kodud." | Detection says **Finnish** (0.38) and hallucinates "Kiitos kun katsoit videon!" Not Jannsen's words. |
| `el-anthem-2` (25 s) | same, second take | "Isama, isama ei kesta ja sinu rabat." | Detected Estonian (0.83). Invented words around "isamaa"; not the anthem text. |
| `el-maamme-1` (25 s) | "The Finnish national anthem … in Finnish." (control) | fi: "Oi maa!" | Possibly the real first words, "Oi maamme". |
| `mm-anthem-lyrics` (142 s) | the real first verse as `lyrics` | "…mis mul nii armas oleks ka, kui sa, mu isamaa … mun ja rumkui kao nii solesa" | Sings the given text; **õ and õõ go**: "mu õnn ja rõõm, kui kaunis oled sa" → "mun ja rumkui kao nii solesa". Detection: English (0.71) and "I love you. Thank you." |

ElevenLabs did not refuse the anthem and did not know the words: asked for "the Estonian
anthem" it writes new pseudo-Estonian lyrics. Listen for the tune.

## Ernesaks, "Mu isamaa on minu arm"

Lydia Koidula's words (1867) and Ernesaks's melody (1944); the words were given in the prompt
(ElevenLabs) or as `lyrics` (MiniMax).

| Clip | Whisper heard (et) |
| --- | --- |
| `el-ernesaks-1` (25 s) | "Kui saama on minu arkel südantandud maa, sul laulan maamu." (detected et 0.97: the right text, run together: "Mu isamaa on minu arm, kel südant annud ma, sull' laulan ma, mu …") |
| `el-ernesaks-2` (25 s) | "Kõik!" (detected English 0.31, "Who is…"): little intelligible singing |
| `mm-ernesaks-lyrics` (40 s) | "Muisama, Muisama, Muisama, Muisama" (auto); forced Estonian loops on "õõõõ…" (a Whisper hallucination loop, not proof of an õ) |

## "In the style of Arvo Pärt"

- **ElevenLabs refuses the name**: both "Instrumental in the style of Arvo Pärt." calls came back
  400 *"Your prompt appears to have violated our Terms of Service."* (most likely a filter on named
  artists; it did accept "Gustav Ernesaks", who died in 1993). A possible demo line: the famous
  living composer is fenced off, the national one is not. One test each, so say "in our test".
- `el-part-desc` (25 s): "Slow Estonian sacred minimalism for piano and strings: a stepwise
  melody over bell-like tonic triads…". Quiet (mean −30 dB).
- `el-part-rule` (25 s): the tintinnabuli rule spelled out in words (A minor, one voice by step,
  the other always the nearest A/C/E above). Quiet (−30 dB). Listen: does the upper voice stay on
  A, C, E, or does it harmonise freely?
- `mm-part` (140 s): MiniMax took the name without complaint. Listen for the generic "slow piano
  and strings" sound vs the two-voice rule.

**The rule as code** (`tintinnabuli.mjs`): M-voice walks by step from A4 and back, one step
further each phrase, alternately down and up; T-voice is the nearest note of the A minor triad
above (first position, superior) or alternating above and below; an A2 drone. Writes
`out/tintinnabuli-1-superior.{mid,wav}` and `out/tintinnabuli-1-alternating.{mid,wav}` (55.8 s)
and prints both voices so the rule can be checked by eye. `--position 2` gives second position.

Source for the rule: Paul Hillier, *Arvo Pärt* (Oxford Studies of Composers, OUP 1997), the
tintinnabuli chapter; Wikipedia's "Tintinnabuli" cites pp. 99–100 and summarises it as one voice
arpeggiating the tonic triad and one moving "diatonically in mostly stepwise motion". The
position terms (first/second, superior/inferior/alternating) are Hillier's as reported by
secondary sources (https://en.wikipedia.org/wiki/Tintinnabuli,
https://www.researchgate.net/publication/391949767_Compound_tintinnabulation_in_the_music_of_Arvo_Part);
**the book itself was not checked**. Read it before putting a page number on a slide.

Pärt is living. The generator is the rule, not his music, and his name goes on none of the
audio. Any public use that names him: ask the Arvo Pärt Centre (https://www.arvopart.ee) first.

## Regilaul

The test text in `run.mjs` was written for this test (8 syllables, trochaic, alliterating), not a
traditional song. Seto leelo is a living UNESCO tradition: **research only, nothing published**,
and no leelo was prompted.

| Clip | Whisper heard (et) | Note |
| --- | --- | --- |
| `el-regilaul-1` (25 s, no lyrics) | "Mina tulen üle välja, meie tuleme üle välja, kas tees ära pommiku eel… Südames kannan vana laulu, südames kanname vana laulu, kuni põld ja mets meid kuuleb…" | ElevenLabs **wrote its own regilaul**: 8-syllable lines, the group answers with the line in the plural ("tulen" → "tuleme", "kannan" → "kanname"). Detected et 1.00. "pommiku" for "hommiku". |
| `el-regilaul-2` (25 s, our text) | "Tule, tule, tütar noori… laula, laulu lõridella… meri mängib, mõtted mõlgub… kaske kasab kalda alla", each line twice | Close to the text, õ kept. |
| `mm-regilaul-lyrics` (25 s, our text, each line doubled) | "Tuule, tuule, tuta nori… laulu laulu loritella… merimengi, mutemulgu… kaske kasvab kaldala" | **õ, ü, ä flattened**: tütar → tuta, lõõritella → loritella, mõtted mõlgub → mutemulgu, mängib → mengi. Detected English (0.32). |

Whether it sounds Celtic or Viking (drones, frame drums, a "Nordic folk" production) needs ears.

### Regilaul from Rõuge (2026-11-17)

Asked: *"more regilaul clips"*. Three real texts this time, not ours: Rõuge, Eisen's collection
(EKM FO, E), traditional and anonymous, verbatim with the dialect spelling from the Lõuna-Eesti
pärimuse portaal (https://www.folklore.ee/lepp/rouge/?sel_id=3). `run.mjs` `el-regi-*`, ElevenLabs
Music v2, 45 s each, same prompt (Rõuge, a lead woman and a group of village women repeating each
line, unaccompanied); no melody asked for. Also `fin-regilaul-arc` from `finale.mjs` (60 s), which
had not been run. Whisper large-v3-turbo forced to Estonian on the whole clip
(`out/transcripts-regi.json`). About $0.50. Nobody has listened yet.

| Clip | Text | Whisper heard (et) | Note |
| --- | --- | --- | --- |
| `el-regi-tohi` | E 17169 (5), lines 1–8: "Tohi siin toresta laulda, healta hästi kuulutada…" (a song about who hears the singing) | Lines 1–2 word for word; "kulleja" → "kule ja", "sõnavõttija" → "sõna võtti ja", "kubjas kulleli" → "kubias kul", the last line lost ("veli viis heale" → "Veid ise ole"). | No repeats heard: the group may not answer. |
| `el-regi-anneke` | E 17172 (9), whole: the moon woos Anne; "ööse sina kasvad, päeva kaod" | **All 14 lines**, the dialect kept (kammerenna, sõrmussida, ristiruubelida, kosti vasta); only word splits ("kossu ella", "Kudale mina"). | The cleanest. No repeats heard. |
| `el-regi-velleke` | E 17172/3 (10), whole: the brother who became a smith | Every line **sung two or three times**: the call and response came through. "hõbepärjake õele" → "öele", "seegi seppasse" → "see kise passe", "mõõgapäida" → "mõga päida". | The only one with the group answering. |
| `fin-regilaul-arc` | our test text, then a wordless bed, then a line back | "Tule, tule, tüttar noori… laula laulu lõridella…" then **"the voices melt into a generic folk ambient bed, no words"**, then "Meri mängib mõtted mõlgu". | **It seems to sing the stage direction**: Whisper hears the plan's English instruction for the middle chunk, word for word, as lyrics (ears to confirm). A line for the talk on its own. |

**Second takes** (`el-regi-tohi-2`, `el-regi-anneke-2`, the same prompt again; a prompt takes no seed,
`seed cannot be used with prompt`, so each call differs; `out/transcripts-regi-2.json`, about $0.23):
Tohi now **repeats every line**, Anneke again sings each line once. So the group answering is not
chance alone: **the text's length decides.** 8 or 9 lines (Tohi, Velleke) leave room in 45 s to sing
each twice, and the model does; Anneke's 14 lines only fit once, and the form is dropped to get all the
words in. The model keeps the words and gives up the form. Whether the repeat is a group or the same
voice needs ears.

## What to listen for

1. **Anthem** (`el-anthem-1`, `-2`): is it Pacius's tune at all? If yes, it is right, and the
   words are wrong (invented). If it is a generic hymn, that is the drift. Compare with
   `el-maamme-1`.
2. **Pronunciation** (`mm-anthem-lyrics` from 0:41, `mm-regilaul-lyrics`, `el-ernesaks-1`):
   õ (rõõm, mõtted), ä/ü (mängib, tütar), long vowels (rõõm, lõõritella). Whisper says MiniMax
   turns õ into u/o; check it is the singer and not Whisper.
3. **Pärt** (`mm-part`, `el-part-desc`, `el-part-rule`) against `out/tintinnabuli-1-superior.wav`:
   generic slow piano and strings, or a voice that keeps to the triad?
4. **Regilaul** (`el-regilaul-1`, `-2`, `mm-regilaul-lyrics`): instruments, the beat, a lead and
   a group, or a Celtic/Viking production.

## Which clip for the demo

On paper (ears decide):

- **`mm-regilaul-lyrics` next to `el-regilaul-2`**: the same four lines; one keeps "mõtted
  mõlgub", the other sings "mutemulgu". Short, both 25 s, the point lands in one line, like the
  "Esttise" sign. Play 10 s of each.
- Or **`mm-anthem-lyrics` at 0:49–0:53** (again at 1:18–1:25): "mu isamaa, mu õnn ja rõõm, kui
  kaunis oled sa", the most recognisable line in the country, which Whisper hears as
  "Mõesamaamun ja romku ikani soled sa". Singing starts about 0:41; what Whisper hears before
  that ("kõik on kõik") is probably the intro, not words.
- **The Pärt refusal** works as a spoken line without audio.
- Keep the regilaul clips in the room, not on a public page.

Whisper itself is a second judge with the same blind spot: it labelled most of these clips
English or Finnish and hallucinated "Kiitos kun katsoit videon!" and "I love you". That echoes the
demo's judge point.

## Other models, and the finale (2026-11-16)

The demo ends on music. Two questions: what else is there, and which clip closes the arc *the
specific dissolves into the probable, and the specific is brought back*.

### The catalog, rechecked

Cloudflare's catalog (`developers.cloudflare.com/ai/models/index.md`, fetched 2026-11-16) still
has **two** music models: `elevenlabs/music-v2` and `minimax/music-2.6`. Everything else with
sound is video with an audio track (Veo 3.1, Seedance, Kling, Grok Imagine Video…) or speech.
Ids tried on `/ai/run` and refused as "Model not found": `google/lyria-3`,
`google/lyria-3-clip-preview`, `google/lyria-3.5`, `google/lyria-2`,
`stability/stable-audio-2.5`.

**Provider-native routes in AI Gateway.** Unified Billing covers provider-native endpoints for
OpenAI, Anthropic, Google AI Studio, Vertex, xAI and Groq (`ai-gateway/features/unified-billing`),
so Lyria 3 through `…/visualia/google-ai-studio/v1beta/interactions` might be billable to our
Cloudflare credits. Tried: **401 Unauthorized** with the wrangler OAuth token in
`cf-aig-authorization` (both `interactions` and `models/lyria-3-clip-preview:generateContent`).
It needs an API token with AI Gateway Run permission (not made; that is an account change), or
a Gemini key. ElevenLabs and Stability native routes need their own keys; we have none.

### The models (November 2026)

Prices and specs from vendor pages or secondary sources as noted; **(unverified)** means only
secondary sources were read.

| Model | Access | Vocals, languages | Length | Price | Live | Local on the 32 GB M2, no Python |
| --- | --- | --- | --- | --- | --- | --- |
| ElevenLabs Music v2 | catalog ✓, tested | vocals; Estonian works (õ kept, below) | 3 s – 10 min, composition plan | $0.0025/s | no | no (API only) |
| MiniMax Music 2.6 | catalog ✓, tested | vocals; flattens õ, ü, ä | ~25–140 s, no control | $0.15/track | no | no |
| Google Lyria 3 Clip / Pro (`lyria-3-clip-preview`, `lyria-3-pro-preview`) | Gemini API `v1beta/interactions`; AI Gateway route 401 for us | vocals, lyrics returned as text; "lyrics in the language of your prompt"; blocks artist voices and copyrighted lyrics; SynthID | 30 s / ~3 min | $0.04 / $0.08 per song (Google pricing page via search) | no | no |
| Google Lyria 3.5 (`lyria-3.5`) | Gemini API (Google docs, fetched) | improved vocals | 1–3 min, set in prompt | not published | no | no |
| Google Lyria RealTime (`lyria-realtime-exp`) | Gemini API, WebSocket | **instrumental only** | endless stream, 2 s chunks, 48 kHz | experimental (price not checked) | **yes**: weighted prompts, BPM, scale, density, brightness | no |
| Magenta RealTime 2 (Google, open) | weights on HF, Apache-2.0 code (**weights licence unverified**) | instrumental; MIDI, audio and text steering | live | free | **yes**, ~200 ms | **yes**: C++ MLX engine; `mrt2_small` (230M) on any Apple Silicon, base 2.4B wants M3 Pro / M2 Max (unverified) |
| Stable Audio 2.5 (Stability) | Stability API, fal | instrumental + SFX, no vocals | ≤ 3 min | $0.20 per generation (unverified) | no | no |
| Stable Audio 3.0 (Stability, May 2026) | Small, Small SFX, Medium open; Large API only | **no vocals** | ≤ 6:20 | Community licence: free under $1 M revenue | no | via HOT-Step CPP / GGML (unverified) |
| Suno v5 / v5.5 | **no official public API** (resellers only, $0.01–0.11/song) | vocals, many languages | ~4–8 min | — | no | no |
| Udio | **no public API**; UMG-licensed walled platform rolling out | vocals | — | — | no | no |
| ACE-Step 1.5 (ACE Studio + StepFun, Jan 2026) | open, **MIT** | vocals, "50+ languages" (Estonian not checked) | up to ~10 min | free | no (seconds per song on a GPU) | **yes**: `acestep.cpp` (C++17/GGML, Metal, GGUF Q4–Q8), < 4 GB VRAM |
| MiniMax Music 3.0 (Aug 2026) | open weights; licence reports conflict (CC BY-NC 4.0 vs a community licence with attribution) | vocals; Mandarin, English shown | ~5 min | free | no | via HOT-Step CPP (unverified) |
| YuE (v1) / YuE2 (Sep 2026) | v1 Apache-2.0; YuE2 CC BY-NC (unverified) | vocals; EN, ZH, JA, KO (v1) | minutes | free | no | Python, 24 GB+ NVIDIA; YuE2 in HOT-Step CPP (unverified) |
| DiffRhythm 2 | open (CC BY-4.0 or Apache-2.0, sources disagree) | vocals, mainly ZH/EN | ≤ 210 s | free | no | Python only |
| LeVo 2 / SongGeneration 2 (Tencent) | open, CC BY-4.0 (v1 was research-only) | vocals, ZH/EN | full songs | free | no | Python only |
| SongBloom (NeurIPS 2025) | open (licence not checked) | vocals | full songs | free | no | Python only |
| MusicGen / AudioCraft (Meta) | open, weights CC BY-NC 4.0 | instrumental | 30 s native | free | no | Python only (old) |
| Stable Audio Open 1.0 | Stability community licence | instrumental, SFX | ~47 s | free | no | superseded by 3.0 |

Estonian lyrics: only ElevenLabs is shown to keep õ (here and in `el-regilaul-2`). Lyria writes
lyrics "in the language of the prompt" and ACE-Step claims 50+ languages; neither is tested in
Estonian. For a live, steerable bed under the drift room, **Magenta RealTime 2** is the one to
try on the Mac (no Python, MLX); Lyria RealTime is the hosted equivalent, both instrumental.

Sources: https://aistudio.google.com/docs/music-generation (Lyria 3 / 3.5 request shape),
https://ai.google.dev/gemini-api/docs/models/lyria-realtime-exp, https://ai.google.dev/gemini-api/docs/pricing,
https://github.com/magenta/magenta-realtime, https://the-decoder.com/stability-ai-launches-stable-audio-3-0-with-up-to-six-minute-tracks-and-open-weights/,
https://aireiter.com/blog/does-suno-have-an-api, https://aimusicapi.ai/en/udio-api,
https://github.com/audiohacking/acestep-cpp-ui, https://github.com/scragnog/HOT-Step-CPP,
https://mer.vin/news/minimax-music-3-is-open-weight-but-not-open-for-business/,
https://arxiv.org/abs/2510.22950 (DiffRhythm 2), https://arxiv.org/abs/2606.30642 (LeVo 2),
https://boppy.me/blog/best-open-source-ai-music-models.

### The finale candidates

`finale.mjs` makes the model clips (same call as `run.mjs`), writes `out/finale/` (git-ignored,
**keep**). All ElevenLabs Music v2. Whisper is `@cf/openai/whisper-large-v3-turbo`, forced
`et`, no VAD (with `vad_filter` it returned nothing on choir); its output varies run to run.

| Clip | Made how | Length | Cost | Whisper (et) | What happened |
| --- | --- | --- | --- | --- | --- |
| `fin-anthem-plain` | prompt: mixed choir, a cappella, the real first verse (Jannsen) in quotes | 45 s | $0.11 | "Mui saama mu end ja rõõm, kui kaunis oled saab. Eile pina ei oln peal, sest me vaja ilma peal, mis mult ei arvas oresta, kui sa muisamaad." Detected **Estonian** | The whole verse, in order, **rõõm kept**. Steady −17 dB, fades at 40 s. |
| `fin-mix-anthem-bed-anthem` | **an edit**: `fin-anthem-plain` 0–18 s → 6 s crossfade → `fin-bed` 0–24 s → 6 s crossfade → `fin-anthem-plain` 26–45 s (ffmpeg, loudnorm −18 LUFS) | 49 s | — | 0–16 s "Mu isama mu end ja rõõm, kui kaunis oleks saab"; 30–41 s "…kuissa muissa maa" | The arc by hand: the line, the generic bed, the line back. Key and tempo of bed and choir are not matched; listen to the joins. |
| `fin-anthem-arc` | composition plan: chunk 1 anthem lines (choir), chunk 2 "The voices melt into a soft wordless pad; no words." (ambient styles), chunk 3 the lines again; seed 20261120 | 60 s | $0.15 | one run: "Muissama muurmi arõn… **all voices held into a soft wordless land**. Kõik pärast…"; another: "Kõik saab, kõrmja rõm…" | Loud 0–25 s, then fades: −38 dB from 35 s, −51 dB at 55 s. **The specific never comes back.** One Whisper run heard the stage direction **sung in English** around 20–30 s; check by ear. |
| `fin-ernesaks-arc` | same plan with Koidula's first four lines | 60 s | $0.15 | "Muisma on iloa, esi nagelare natma, sulavad on armando vihene, noci semestima" (0–18 s) | The words are there, blurred. Then it fades to −46…−64 dB and **stays gone**: chunk 3 ("mu isamaa, mu isamaa!") is near silence. |
| `fin-rule-arc` | plan: the tintinnabuli rule in words → "generic calm ambient" → the rule again | 60 s | $0.15 | — | Quiet throughout (≈ −30 dB), no audible step between chunks by level. Listen: two voices or a pad? |
| `fin-bed` | prompt: "Calm relaxing ambient background music, piano and soft strings, A minor, 75 BPM." instrumental | 40 s | $0.10 | — | The probable, on purpose. |
| `fin-mix-rule-to-bed` | edit: `tintinnabuli-1-superior` 0–32 s → 10 s crossfade → `fin-bed` | 62 s | — | — | The rule dissolves into the bed. |
| `fin-mix-bed-to-rule` | edit: `fin-bed` 0–25 s → 10 s crossfade → the rule 0–45 s | 60 s | — | — | The reverse: the bed, then the rule surfaces. |
| `fin-mix-rule-bed-rule` | edit: rule 0–20 s → 8 s → bed 0–28 s → 8 s → rule 20–48 s, fade out | 60 s | — | — | The full arc, no words. |

**Refused:** `fin-ernesaks-return` (one prompt: the Koidula lines, then a pad, then the choir
returns) came back 400, reason **`copyrighted_material_detected`**, for a poem from 1867. The
refusal offers a rewritten prompt: *"…with original lyrics expressing love and pride for the
homeland… singing a heartfelt refrain celebrating Estonia's beauty and spirit."* The filter
swaps the specific text for the probable one, in words. The same lines were accepted inside a
composition plan (`fin-ernesaks-arc`) and inside a prompt that named Ernesaks (`el-ernesaks-1`).
One refusal: say "in our test". It is a line for the talk on its own.

**Not run:** `fin-regilaul-arc` (our test text from `run.mjs`, lead and group, a "Nordic folk"
bed, then back; no Seto leelo) is in `finale.mjs` but was not generated in this session (the
call was held back by a permission check). `node research/music-drift/finale.mjs
fin-regilaul-arc`, $0.15.

**Spent this round: about $0.67** (265 s of ElevenLabs output; the refusal presumably not
billed; Whisper about a cent). The day's total is about $1.85.

### Which one to end on

On paper, ears decide:

1. **`fin-mix-anthem-bed-anthem`**: the most recognisable line in the country, kept (rõõm),
   dissolving into the bed every model gives, then the line back. It is an edit, so say so: the
   machine made both halves, a person put the specific back. That is the demo's point
   (measuring and choosing is what brings it back).
2. **`fin-anthem-arc`** as the honest version: asked to bring the anthem back, the model fades
   out and does not. Plays as the problem rather than the close.
3. **`fin-mix-rule-bed-rule`** if the ending should be wordless.

Spoken over any of them: the refusal suggestion above.

## Film theme songs (2026-11-16)

Theme songs for the films in the drift room (`plans/drift-room.md`). `films.mjs` makes them,
`out/films/` holds them (git-ignored, **keep**), and a copy is in
`~/visualia-local/music-drift/films/` (26 files, 14 MB; 56 after the second round). Nobody has listened yet.

**The real songs are not ours to use.** Who wrote them, from Estonian Wikipedia (fetched 2026-11-16):

| Film | Music | Words |
| --- | --- | --- |
| Viimne reliikvia (1969) | Uno Naissoo and Tõnu Naissoo | Paul-Eerik Rummo; sung by Peeter Tooma (Georg Ots in the Russian version) |
| Nipernaadi (1983) | Raimo Kangro, Andres Valkonen; "Rändaja õhtulaul" music Anne Maasik (from the 1976 play "Veli Joonatan") | "Rändaja õhtulaul": Ernst Enno |
| Nukitsamees (1981) | Olav Ehala | Juhan Viiding ("Valulaul", "Kodulaul", "Päikeseratas", "Rahalaul") |
| Kevade (1969) | Veljo Tormis | not given |
| Hukkunud Alpinisti hotell (1979) | Sven Grünberg (en.wikipedia) | — |

Sources: https://et.wikipedia.org/wiki/Viimne_reliikvia, https://et.wikipedia.org/wiki/Nipernaadi_(film),
https://et.wikipedia.org/wiki/Nukitsamees_(film), https://et.wikipedia.org/wiki/Kevade_(film),
https://en.wikipedia.org/wiki/Dead_Mountaineer%27s_Hotel_(film). One source each; the Nipernaadi
credits (Maasik) are only from that page. No real lyrics were sent and no melody was asked for.

Two probes per film:

- **(a) named**: ElevenLabs, 30 s, *"The theme song of the Estonian film <name> (<year>), sung in
  Estonian."*; for Viimne reliikvia and the Alpinist also an instrumental *"The main title theme
  of …"*. MiniMax once, for Kevade, with `lyrics_optimizer` on (it writes the words).
- **(b) made for the room**: our own words (two verses and a refrain, 8-syllable trochaic lines,
  in `films.mjs`) in the prompt, an era and a line-up instead of a composer, 45 s. The Alpinist
  as an instrumental, 30 s. MiniMax once, the Nipernaadi words, for comparison.

### (a) Named: what the model does with the name

| Clip | Result | Whisper (et) |
| --- | --- | --- |
| `named-nipernaadi`, `named-nukitsamees`, `named-kevade` | **Refused**: 400, `copyrighted_material_detected`. The name of the film is enough. Each refusal offers a rewrite: *"A nostalgic and melodic folk-inspired song sung in Estonian, capturing the spirit and atmosphere of a classic Estonian film from the early 1980s"* (Nipernaadi); *"…evoking the magical and adventurous spirit of a beloved 1980s Estonian children's film"* (Nukitsamees); *"…inspired by Estonian folk music, featuring traditional instruments… evoking the spirit of a classic 1960s film"* (Kevade). The specific film becomes "a classic Estonian film", and "Estonian" becomes "folk". | — |
| `named-reliikvia` | **Not refused.** A new song in Estonian, detected et 0.99: "Mu kodu on tuulte ja kivide maa, kus vabadus ei vaiki… ja vabadus laulab meid koju" (Whisper: "tuute", "vahruus"). It found the film's theme, freedom, without the film's words. | as quoted |
| `named-reliikvia-instr` | Not refused, instrumental. Genre needs ears: medieval, Soviet adventure, or Hollywood epic? | — |
| `named-alpinist` | **Not refused.** Writes about the title: "Kõrgel mägedes seisab hotell, tuul käib mööda tühje treppe… aknas seisab kauge lumi, me ei kao, me jääme veel… mäe hotellis kuni hommikuni". Clean Estonian (et 0.99). | as quoted |
| `named-alpinist-instr` | Not refused. Quiet (mean −27 dB). Listen: synth (as Grünberg's score is) or orchestral thriller? | — |
| `mm-named-kevade` (MiniMax, 3 min 7 s) | **Not refused.** MiniMax wrote a school-and-spring love song: "Päike sätendab üle vee… Tindiplekid… õpetaja vaatab ja noomib… armastus tärkab kui noor hein, möödas on kurbus ja talveleen… algab me unistus ja algab nüüd" (Whisper's text cleaned up by reading; raw in `transcripts.json`). It knows Kevade is about school and spring. Detected et 0.79; õ/ä partly kept here. | see `transcripts.json` |

Why two named films pass and three fail is a guess: maybe Viimne reliikvia and the Alpinist are
filed as titles, not as known songs, or "Kevade" (spring) and the others match something in a
catalogue. One call each: say "in our test". **A line for the talk:** the model refuses the
Estonian children's film by name and offers "a beloved 1980s Estonian children's film", folk
instruments included.

### (b) Made for the room

| Clip | Style (no composer named) | Whisper (et) | Estonian? |
| --- | --- | --- | --- |
| `room-nipernaadi` (45 s) | 1983 film song, warm male solo, acoustic guitar, soft accordion, walking tempo | in two halves: "Mööda teed ma lähem jälle, päike paistab põllu peale, heinamaadel lõhnab suvi, järve ääres heinakuhjad. Tule kaasa… kuni õhtu kätte jõuab, tee on pikk ja süda kerge… Kaugel kukkub metsas kägu, küla kohal suitsub korsten. Homme olen juba kaugel, teisel teel ja teises külas." | **Almost word for word**, õ kept (õhtu, jõuab, põllu, lõhnab). All 16 lines sung. |
| `room-nukitsamees` (45 s) | 1981 children's musical, a woman and a man in turn, kannel, fiddle, accordion, folk-dance beat | "…ja kass ja kõik on segi, perenaine paneb lukku, metsavana on juba sees. Piima joob ja leiba sööb ta (Whisper: "Viima… leiva"), magab ahju peal kui kiisu… hommikul on jälle metsas, kastes jäävad väikseid jälgi, tiri-tari, talu õues…" | Right words; Whisper gets little of verse 1 (only "Metsa veerel"): listen whether it is sung. |
| `room-kevade` (45 s) | 1969 film song, boys' choir unison then two parts, light strings, flute | "Kevad tuli, jõgi jooksis (jõuksis), jää läks minema ja kadus… poisid koolist välja jooksid, kaldal kivid, kaldal pajud. Lase lendu… paberlaevad voolu peale, kõik on alles ees ja ootab… kirikukell lööb mäe peal, tüdrukud seisavad sillal, keegi viskab kivi vette, ringid lähevad üle jõe" | All lines, choir blur ("alles ees" → "alle sees"). et 0.99. |
| `room-reliikvia` (45 s) | 1969 adventure film song, male baritone, galloping rhythm, strings and brass, male choir on the refrain | "Üle välja, üle nõmme, sõidame me tuule vastu. Kabjad löövad, tolmu tõuseb, selja taga linnamüürid. Vabaks, vabaks, ainult vabaks, keegi meid ei kinni püüa. Tuul on meie ainus isand, lai on maa ja kõrge taevas. Öö on pikk ja mets on pime, tähed näitavad meile teed, hommikuks on meri näha…" | Near word for word, et 1.00. |
| `room-alpinist` (30 s) | 1979 science-fiction score, cold analog synths, pulsing bass, wind and snow, instrumental | — | — |
| `mm-room-nipernaadi` (MiniMax, 1 min 38 s, same words) | the Nipernaadi style | "Tuule kaasa, tuule kaasa! Kuni öhtu kätte jõuab, te on pikk ja süda kerge… kuula kohal suud su korsta. O me olen juba kaugel, teisel teel ja teises kuulas" | **Drifts as before**: tule → tuule, õhtu → öhtu, jõuab → jouab, küla → kuula, homme → o me; Whisper loops "Mõõõ…" over the intro. |

Whisper drops whole lines on 45 s songs (`room-nipernaadi` whole: 3 lines; in two halves of
22 s: all 16). The table quotes the halves for Nipernaadi and Nukitsamees; the halves were run by
hand (ffmpeg `-t 22` and `-ss 20`), `transcripts.json` has the whole-clip runs.

### Which clip for which room scene

| Room scene (`plans/drift-room.md`) | Clip | Why |
| --- | --- | --- |
| Nipernaadi's road and the haystacks by the lake | `room-nipernaadi` | the words are the scene (road, haystacks, lake, cuckoo); cleanest Estonian of the set |
| Nukitsamees' forest edge and farm | `room-nukitsamees` | forest edge, farmyard, the imp asleep on the stove |
| The boys by the river (Suvi) and Paunvere's church (Kevade) | `room-kevade` | river, paper boats, the church bell, the bridge; one song for both |
| Riders on an open plain (Viimne reliikvia; no room scene yet) | `room-reliikvia`, or `named-reliikvia` | gallop and refrain; the named one is the drift version |
| Hukkunud Alpinisti hotell (no room scene yet) | `room-alpinist`, `named-alpinist` | an instrumental bed; the named one sings about the hotel |
| Drift probe, spoken | the three refusals | the name refused, "a classic Estonian film" offered |
| Drift probe, played | `mm-room-nipernaadi` against `room-nipernaadi` | same words, "tuule kaasa" against "tule kaasa" |

**Spent: about $1.14.** ElevenLabs 330 s of output ($0.83: 4 named × 30 s, 4 × 45 s, one 30 s);
MiniMax 2 tracks ($0.30) plus one lyrics generation ($0.01); three refusals, presumably not
billed; Whisper about a cent. The day's total is about $3.

### Second round: 4–6 clips per film (2026-11-17)

Asked: *"single songs per movie? you should have more."* 15 more clips, same route (`films.mjs`, ids
added to `JOBS`; run with the ids, since a plain run would ask the three refused probes again). Three
new ways of asking, and MiniMax for every film:

- **style**: the room `STYLE` text alone (era, line-up, mood), no film name and no words, so the model
  writes its own (ElevenLabs, 40 s).
- **mm-named**: the named probe on MiniMax, which writes its own words (`lyrics_optimizer`).
- **mm-room**: the room words and style on MiniMax, as `mm-room-nipernaadi`; Alpinist instrumental.
- one more per film: `march-kevade` (an instrumental 1969 school march, brass band), `children-nukitsamees`
  (the room words as a 1980s children's TV song, children's choir), `synth-alpinist` (late-1970s
  electronic score, arpeggiated synth).

**No refusals.** MiniMax took all four film names, Nipernaadi and Nukitsamees included, which
ElevenLabs refused on 2026-11-16. Three MiniMax calls first ended in 504 (`Upstream service
unavailable`) and went through on a second try. MiniMax picks its own length: 57 s to 2 min 46 s.
The six 40 s ElevenLabs clips have the same file size (640,775 bytes, constant bitrate); their
checksums differ and none is silent (mean −14.7 to −20.2 dB).

Where the judge places them (Gemini 3.8 Flash, `measure.mjs judge`, round 1, one answer each; nobody
has listened yet):

| Clip | Model, length | Judge |
| --- | --- | --- |
| `style-reliikvia` | ElevenLabs, 40 s | Estonia 0.95, Estonian |
| `mm-room-reliikvia` | MiniMax, 57 s | Estonia 0.98, Estonian |
| `mm-named-reliikvia` | MiniMax, 2 min 10 s | Estonia 1.0, Estonian |
| `style-kevade` | ElevenLabs, 40 s | Estonia 0.98, Estonian |
| `mm-room-kevade` | MiniMax, 1 min 11 s | Estonia 0.98, Estonian |
| `march-kevade` | ElevenLabs, 40 s, instrumental | **Austria 0.95**: "Johann Strauss I's famous 'Radetzky March'". Asked for a school march, it heard the best-known march there is. Listen before saying it is one. |
| `synth-alpinist` | ElevenLabs, 40 s, instrumental | **Australia 0.98** (Arnhem Land): "the drone, circular breathing … of the didgeridoo". The drone of a synth score heard as a didgeridoo. |
| `mm-room-alpinist` | MiniMax, 1 min 39 s, instrumental asked | **Egypt 0.75**: "female vocals … Arabic maqam phrasing … over electronic downtempo beats". Vocals in an instrumental: listen. |
| `mm-named-alpinist` | MiniMax, 2 min 38 s | **Russia 0.95** (Karelia), language **Veps**: "Finnic numeral counting ('kaks' ja kol'm')". Estonian heard as a neighbouring Finnic language. |
| `children-nukitsamees` | ElevenLabs, 45 s | Estonia 0.99, Estonian |
| `style-nukitsamees` | ElevenLabs, 40 s | Estonia 0.98, Estonian |
| `mm-room-nukitsamees` | MiniMax, 1 min 3 s | Estonia 0.98, Estonian |
| `mm-named-nukitsamees` | MiniMax, 2 min 20 s | Estonia 1.0, Estonian |
| `style-nipernaadi` | ElevenLabs, 40 s | Estonia 0.95, Estonian |
| `mm-named-nipernaadi` | MiniMax, 2 min 46 s | Estonia 0.95, Estonian (made, not on the film page) |

Eleven went to Estonia, all of them sung. The four that left are the three instrumentals (the
Kevade march, both Alpinist scores) and one sung Alpinist clip heard as Veps: without words the judge
has only the sound, and a synth drone or a brass march points anywhere.

**On the film page** (`evals/estonian-visuals/out/drift-room/films.html`, `SONGS`): each film has a
list, the best first. The title slide starts it; a clip plays to its end and the next one fades in
over its last 1.5 s, wrapping; a slide change inside a film leaves the music alone; a new film starts
its own first clip. The music box shows the clip that is playing. Refused probes have no clip.

| Film | Clips, in order |
| --- | --- |
| Viimne reliikvia | `room`, `style`, `mm-room`, `named`, `mm-named`, `named-reliikvia-instr` (6) |
| Kevade | `room`, `style`, `mm-room`, `march`, `mm-named` (5) |
| Hukkunud Alpinisti hotell | `room`, `synth`, `named`, `mm-named`, `named-alpinist-instr`, `mm-room` (6) |
| Nukitsamees | `room`, `children`, `style`, `mm-room`, `mm-named` (5) |
| Nipernaadi | `national/nudge-randaja-prompt` (one "Rändaja õhtulaul" only, asked: *"single Rändaja version"*), `room`, `style`, `mm-room` (4) |

**Spent: about $1.99.** ElevenLabs 285 s of output ($0.71: six × 40 s, one × 45 s); MiniMax 8 tracks
($1.20) and four lyrics generations (about $0.04); the 504s presumably not billed; the judge $0.04
through the gateway. Copies in `~/visualia-local/music-drift/films/` (56 files, 45 MB).

## National songs (2026-11-17)

For the Song Festival Grounds room (`evals/estonian-visuals/out/drift-room/lauluvaljak.html`). Asked:
*"add more national songs-like. nipernaadi song?"*, then for "Rändaja õhtulaul": *"just want nudge
music towards original"*. `national.mjs` makes the clips, `out/national/` holds them (git-ignored,
**keep**), and a copy is in `~/visualia-local/music-drift/national/`. Nobody has listened yet.

**The rule:** only words whose author died before 1956 (public domain in Estonia, 70 years), sent
verbatim; no melody asked for, no composer named, the style described (choir, era, tempo,
instruments). The composer column below is for the record and was not used.

| Song | Words | Real music (not used) | Words sent |
| --- | --- | --- | --- |
| "Sind surmani" | Lydia Koidula (1843–1886), 1867 | Aleksander Kunileid (1845–1875), 1869; sung at the first song festival, 1869 | stanza 1 |
| "Ta lendab mesipuu poole" | Juhan Liiv (1864–1913), 1905 | the festival version: Peep Sarapik (1949–1994), protected; earlier settings Miina Härma, Juhan Simm, Riho Päts | stanzas 1 and 3 |
| "Kungla rahvas" ("Kui Kungla rahvas kuldsel a'al") | Friedrich Kuhlbars (1841–1924), poem "Vanemuine", 1869 | Karl August Hermann (1851–1909), 1877, on a German tune | stanza 1 and the refrain |
| "Mu isamaa armas" | Martin Körber (1817–1893) | a German folk tune (also Micronesia's anthem) | couplets 1–3 |
| "Rändaja õhtulaul" (Nipernaadi, 1983) | Ernst Enno (1875–1934), 1910 | Anne Maasik (b. 1951), protected; first in the 1976 play "Veli Joonatan" | stanzas 1 and 5 of the poem |

Sources (fetched 2026-11-17): https://et.wikipedia.org/wiki/Sind_surmani,
https://et.wikipedia.org/wiki/Aleksander_Kunileid, https://et.wikipedia.org/wiki/Ta_lendab_mesipuu_poole,
https://et.wikipedia.org/wiki/Peep_Sarapik, https://et.wikipedia.org/wiki/Kungla_rahvas,
https://et.wikipedia.org/wiki/Friedrich_Kuhlbars, https://www.laulud.ee/laul/mu_isamaa_armas-429 (Körber's
dates and the tune only from there), https://et.wikipedia.org/wiki/Nipernaadi_(film),
https://et.wikipedia.org/wiki/Ernst_Enno, https://et.wikipedia.org/wiki/Anne_Maasik. Words: the same
pages' quote boxes and laulud.ee. Enno's text: https://www.babelmatrix.org/works/et/Enno,_Ernst-1875/R%C3%A4ndaja_%C3%B5htulaul
(the poem); laulud.ee prints the song's version, which differs in small words ("õhtul hilja" for
"õhtu nii hilja", "otsata teed" for "teel"). We sent the poem.

### What came back

ElevenLabs Music v2, 45 s each with words; MiniMax Music 2.6 for two of them (it chose the length).
Whisper large-v3-turbo forced to Estonian in 22 s pieces (`transcripts.json`). "Kõik on kõik on
kõik" at the end of most clips is Whisper looping on the fade, not singing.

| Clip | Model | Refused? | Whisper (et) against the real words |
| --- | --- | --- | --- |
| `nat-sind-surmani` | ElevenLabs | no | All 8 lines, **õ kept** (õitsev, jõed). "vainud" → "painud", "lehkav isamaa" → "lehka viisama", "kiita tahan" → "kiitada". Detected et 1.00. |
| `nat-mesipuu` | ElevenLabs | no | 7 of 8 lines. "Hing, oh hing" → "Kõik saa" (lost), "mesipuu" → "meesi kuu", "kuis õhkad" → "kui sõtab", "võõral" → "põõramad", "poole" → "pole". et 0.98. |
| `nat-kungla` | ElevenLabs | no | Stanza and the first two refrain lines near word for word ("murumaal" → "purumaal"); the "läks lauluga" lines unclear ("Tõnubad, saunubad"). et 1.00. |
| `nat-isamaa-armas` | ElevenLabs | no | Couplet 1 sung twice, as asked, but **"armas, kus" → "armastus"** (beloved, where → love); "männid" → "mängid", "kuused, kased" → "kuuseb kaased". **Couplet 3 dropped** (the 45 s ran out). et 0.99. |
| `nat-randaja` | ElevenLabs | no | All 10 lines, õ kept: "hallil" → "halli", "armastas meel" → "armastasmeed", "tee helisev" → "laulde helised". The cleanest of the set. et 1.00. |
| `named-randaja` (30 s, title only) | ElevenLabs | **no** | New words on the title's theme: "Õhtu laskub aeglaselt üle tee ja minu sammud otsivad kodu… Ma olen rändaja õhtulaulul ja ma ei karda pimedust… siis tean, et hommik leiab mind." Not Enno's. Clean Estonian, et 1.00. |
| `named-mesipuu` (30 s, title only) | ElevenLabs | **no** | New words with Liiv's meaning: "Kodu kutsub üle aasa… Lenda … puu poole, seal on valgus, seal on hool. Kaugel helgib meie maa, seal meid ootab arm ja rahu taas." The longing for home, without the poem. et 0.99. |
| `mm-randaja` (48 s) | MiniMax | no | Stanza 1 not heard (Whisper: Latvian "Paldies!"); stanza 5: "lõpmata teel" → "lumadatil", "täis valmivat" → "teis volmivad", "otsata teel" → "utsadatil", "õhtu" → "urtu". **õ goes to u.** Detected English 0.38 ("THE END I'll see you next time"). |
| `mm-mesipuu` (31 s) | MiniMax | no | Stanza 1 only as "TALENDA VILES MILESE" (auto, English 0.78); stanza 3: "kuis õhkad isamaa poole" → "kui so kadissa maapule", "võõral maal" → "korala maa". **õ, õõ lost**, words fused. |

**No refusals this time.** Both titles went through, where the Nipernaadi *film* title was refused
yesterday (`named-nipernaadi`, `copyrighted_material_detected`) and Koidula's 1867 lines once were
(`fin-ernesaks-return`). One call each: say "in our test". What the named probes show instead is
the drift in words: asked for "Rändaja õhtulaul" or "Ta lendab mesipuu poole", ElevenLabs writes a
fluent new song about the title's theme. It knows what the song is about, not the song.

Pattern, same as the anthem and regilaul runs: ElevenLabs keeps the text and õ, slips on single
consonants and word boundaries; MiniMax flattens õ to u/o and fuses words, and Whisper hears it as
English.

### Rändaja õhtulaul, nudged toward the original

The two recordings are on disk for research only (`out/films/original/`, `SOURCES.txt`; never
shown or committed): the 1983 film clip (2:36) and the record (5:05). The music models take only
text, so the nudge is a description. Measured with `national.mjs analyse` (ffmpeg + plain Node:
onset autocorrelation for tempo, chroma against the Krumhansl–Kessler profiles for key, RMS per
10 s), Whisper segment times for where the lines fall, and one Gemini 3.8 Flash call with the
film clip as audio through the live gateway (it takes `input_audio`; 3,879 audio tokens, under a
cent; `out/national/original-gemini.json`).

The original, measured: **60 BPM** (film 60.1, record 58.7, both the strongest peak). Key: the
film clip D major/minor (0.84 / 0.74, a D centre), the record F♯ minor / A major (0.61 / 0.59);
Gemini says A minor. The two recordings disagree, so the key is not settled. Form: strophic, no
refrain, five-line stanzas of **~48 s each** (film: lines start at 0, 10, 18, 28, 40 s, the next
stanza at 49 s), about **10 s a line**, a 3 s intro, even loudness (−15 to −16 dB). Gemini: a solo
female alto with wide theatrical vibrato, accordion pads, fingerpicked guitar, flute answers,
chimes, 4/4, late-1970s analog. Voice, instruments and meter are Gemini's ears only; not measured.

Two more ElevenLabs clips with the same Enno lines as `nat-randaja`, 100 s each (two stanzas at
the original's pace):

- `nudge-randaja-prompt`: one prompt carrying that description (60 BPM, D minor, female alto,
  vibrato, accordion, guitar, flute, ~10 s a line, ~48 s a verse, no chorus).
- `nudge-randaja-plan`: a composition plan, one 50 s chunk per stanza, the same styles as tags,
  `negative_styles` drums, synth, choir, male voice, English, fast; seed 20261117.

| | Tempo (top peaks) | Key (top) | Length | Per stanza | Per line | Whisper |
| --- | --- | --- | --- | --- | --- | --- |
| Original (film) | **60.1**, 92, 172 | D major 0.84, D minor 0.74 | 155 s, 3 stanzas | ~48 s | ~10 s | the real words, õ kept |
| `nat-randaja` (plain guess) | 83.4, 161, 55 | G major 0.68 | 45 s | ~21 s | ~4 s | all 10 lines |
| `nudge-randaja-prompt` | 117.5, **60.1** (0.94) | **D major 0.89**, D minor 0.67 | 100 s | ~40 s (10–49, 52–92 s) | ~8 s | all 10 lines, õ kept; 10 s intro |
| `nudge-randaja-plan` | 117.5, **60.1** (1.00) | C minor 0.87 | 100 s | ~31 s (19–50, 56–86 s) | ~6 s | all 10 lines plus one invented, garbled line ("neosõlvad õhtame lõmlõl"); 19 s intro |
| `mm-randaja` (MiniMax, plain) | 69.8, 129 | F♯ minor 0.76 | 48 s | — | — | stanza 5 only, õ → u |

**How close the nudge got, measured:** the tempo moved from 83 to the original's 60 BPM in both
(the 117.5 peak is its double, a common autocorrelation reading of eighth notes). The prompt
version landed on the film clip's key pattern (D, major over minor, 0.89 / 0.67 against 0.84 /
0.74); the plan did not (C minor). The pace moved from 4 s a line to 8 s (prompt) and 6 s (plan),
against the original's 10 s. The prompt is the closer of the two on every measure; the plan kept
the tempo but rushed the lines and added a line. Whether the voice is an alto with that vibrato,
and whether it sounds like the record or like a generic Soviet-era ballad, needs ears. Neither was
asked for the melody, so a tune close to the original would itself be a finding.

### Which clip for which scene in the room

| Room scene | Clip | Why |
| --- | --- | --- |
| Real photos, and the best models (placed in Estonia) | `nat-mesipuu` or `nat-sind-surmani` | the real words, õ kept; the song the festival actually sings (mesipuu), or the oldest (1869) |
| The road and fields, an evening scene | `nudge-randaja-prompt` | Enno's words at the original's tempo and pace |
| Crowd and festival close | `nat-kungla` | the song the crowd sings together after the programme; festive |
| Without the place (the neutral prompt) | `named-mesipuu` | the meaning without the poem: a fluent made-up song "about home" |
| The worst models (placed elsewhere) | `mm-mesipuu` | "kuis õhkad isamaa poole" sung as "kui so kadissa maapule", heard as English |
| Drift probe, played | `nat-randaja` against `mm-randaja` | the same Enno lines, "õhtu" against "urtu" |

`nat-isamaa-armas` is the weak one of the ElevenLabs set (a line dropped, "armas, kus" → "armastus"),
and the tune behind it is German anyway; use it only to make that point.

**Spent: about $1.53.** ElevenLabs 485 s of output ($1.21: 5 × 45 s, 2 × 30 s, 2 × 100 s);
MiniMax 2 tracks ($0.30); Whisper about $0.02 (all clips, the originals, the segment runs); Gemini
under a cent (through the gateway, so in its usage table). No refusals.

## Era ladder (local, old models) (2026-11-17)

The music twin of the picture era ladder (`evals/estonian-visuals/out/era/`, 2022 DALL·E mini to
2026 GPT Image 2): the 2026 ElevenLabs prompts through a 2023 model, run on this Mac, so the talk
can play "2023 against 2026". `era.mjs`, clips in `out/era/musicgen-small/` (`.wav`, `.mp3`,
`.json` with time and energy), **copied to `~/visualia-local/music-drift/era/` (keep)**.

**MusicGen small** (Meta, 2023, 300M, weights CC BY-NC 4.0), `Xenova/musicgen-small` as ONNX
(text encoder and decoder q8, audio decoder fp32), run by transformers.js 4.3.2 from
`evals/estonian-visuals/neighbours/` (onnxruntime-web as WebAssembly on the CPU, 3 threads; no new
native binary, so ThreatLocker leaves it alone). Guidance 3, sampled, **no seed** (transformers.js
has none): a re-run makes a different clip. 20 s per clip, 32 kHz mono. It cannot sing, so the
prompts lose only the lyrics; "sung by a mixed choir" stays in, to see what it does with it.

**Disk:** 629 MB of weights in `~/visualia-local/hf-js/` (outside git), 3.5 MB of clips per copy.

**What ran: 2 of 7 clips.** The other five stopped at the 85 °C rule (the run stops when the last
2 s average above 85 °C; it also pauses decoding while the CPU is at 78 °C or more). During this
session the Mac was busy with other work (Chrome rendering the drift room, a Python batch job,
Microsoft Defender, a vitest run in another project): the chip drew 20–30 W before MusicGen
started and sat at 80–86 °C even while generation was paused. Run the rest when the Mac is quiet:
`node research/music-drift/era.mjs` (skips clips that exist; `anthem-2` is a second take).

| Clip | Prompt (from) | Made in | Energy, chip (net of idle) | Loudness | Brightness, noise | 2026 pair | Pair loudness, brightness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `anthem` | "The Estonian national anthem, sung by a mixed choir in Estonian." (`el-anthem-1`, same words) | 94 s for 20 s | not valid (see below) | −19 LUFS, flat: −18 to −20 dB from 0.2 s to the end | centroid 1806 Hz, flatness 0.08 | `el-anthem-1.mp3` | −12 LUFS; 1793 Hz, 0.03 |
| `ernesaks` | Ernesaks's "Mu isamaa on minu arm", choir, song festival, in Estonian; lyrics left out (`el-ernesaks-1`) | 97 s for 20 s | 3330 J = 0.93 Wh (net 1111 J = 0.31 Wh); mean 34 W, idle 23 W; peak 84 °C | −26 LUFS, LRA 21: one slow swell from −60 dB to −28 dB over the 20 s | centroid 528 Hz, flatness 0.04: dark and tonal | `el-ernesaks-1.mp3` | −13 LUFS, LRA 5; 1996 Hz, 0.04 |
| `regilaul`, `part-desc`, `nipernaadi`, `bog`, `bed`, `anthem-2` | `el-regilaul-1`, `el-part-desc`, `films.mjs` Nipernaadi style without the voice, `nature.mjs` `bog-ee`, `fin-bed` | **not made** (heat) | — | — | — | `el-regilaul-1`, `el-part-desc`, `films/room-nipernaadi`, `nature/bog-ee`, `finale/fin-bed` | — |

**Nobody has listened.** From the numbers only: `anthem` is a steady wall of sound at one level,
about as bright as the ElevenLabs choir but 7 dB quieter and with no shape; whether it is a choir,
an organ or a band is for ears. `ernesaks` is very quiet and dark (centroid a quarter of the
2026 clip's), a 20 s crescendo out of near silence: it may read as "solemn" or as nothing.
Neither can have words. Normalise both before playing them next to the 2026 clips (`ffmpeg -af
loudnorm=I=-16`), or the old model will sound worse for being quieter.

**Time and energy.** About 4.8 s of compute per second of music on 3 CPU threads (WASM; the
GPU is not used: onnxruntime-web's WebGPU is not there in Node). Loading takes 2–4 s once the
weights are cached (the first run: 104 s with the download). For the cost slide: **one 20 s
clip ≈ 0.9 Wh at the chip, ≈ 0.3 Wh above idle** (`ernesaks`; `sys_energy_j` says 1.7 Wh for
the whole computer). One clip measured cleanly, on a busy Mac, so treat it as an order of
magnitude. The first `anthem` run used an in-process meter that missed samples while generation
held Node's thread; its energy is wrong and marked so in its JSON (`energy_note`); the meter now
runs as its own process.

**Not run:**

- **The other five prompts and a second anthem take**: heat, above.
- **Riffusion** (2022, an SD 1.5 fine-tune that paints spectrograms): no ONNX export on Hugging
  Face (only diffusers/PyTorch, OpenVINO, Paddle), and transformers.js has no Stable Diffusion
  pipeline. It would need torch (~1 GB) plus ~2 GB of weights, over the 3 GB budget with ~5 GB
  free, and the spectrogram-to-audio step by hand. Skipped.
- **MusicGen melody** (melody conditioning): not in the small model. Medium and large (1.5B,
  3.3B) would not fit the disk rule.

## Measuring drift in music (2026-11-17)

The music gets the two numbers the pictures have: **where a judge places it** (the pictures' "which country
was this photo taken in?", `evals/estonian-visuals/nature.mjs`) and **how many of the given words come back**.
`measure.mjs` does both: `judge`, `words`, `report`; the result per clip is `out/measure.json` (model,
kind real/generated, country, confidence, region, language heard, WER, CER, õ/ä/ö/ü kept), the judge's
answers are cached in `out/judge-music.jsonl`.

**The judge.** `google/gemini-3.8-flash` through the live gateway (`gw.visualia.space/v1/chat/completions`,
key `eka-teacher`), the clip as `input_audio` (mono mp3, every tag stripped so a YouTube title cannot
leak, at most 180 s). The question names no country: *"Which country or culture does this music most
likely come from? Listen only to what is in the recording: the language of any singing, the scale and
harmony, the instruments, the singing or playing style, the sounds."* Answer: country, confidence 0–1,
region, the language heard, reason. Every clip was asked **twice** (round 1 and round 2, independent
calls) to see how steady the answers are. The tables use round 1; round 2 is noted.

**Clips.** 68: every generated clip on disk (`out/` anthem, Ernesaks, regilaul and Pärt tests, `films/`,
`national/`, `finale/` including the four ffmpeg edits, `nature/`, `era/musicgen-small/` except
`ernesaks-long`, which has no record of how it was made), the two tintinnabuli WAVs from the rule (code, no
model), and the **control of real recordings**: the two "Rändaja õhtulaul" originals in `out/films/original/`
(the 1983 film clip and the record; research only, never shown) and the five xeno-canto birds in
`out/nature/control/`. No other real Estonian music was found in the project or `~/visualia-local`; the
personal recordings in `~/Downloads` were left alone. Nothing was downloaded for this.

### Where the judge places the music

| Clips | Placed in Estonia | Mean confidence | Elsewhere |
| --- | ---: | ---: | --- |
| **Real music** (Rändaja õhtulaul, 2 recordings) | **100 % (2/2)** | 0.98 | – |
| **Generated music**, all | **59 % (27/46)** | 0.93 | China 4, United States 4, Finland 2, Russia 2, Japan, Italy, Mongolia, Iraq, Ireland, Norway, Australia 1 each |
| Generated, prompt says "Estonian" | 68 % (27/40) | 0.96 | China 4, United States 2, Russia 2, Japan, Iraq, Finland, Norway, Australia 1 each |
| Generated, no country in the prompt | 0 % (0/5) | 0.72 | United States 2, Italy, Mongolia, Ireland |
| Generated, the Finnish anthem (control) | 0 % (0/1) | 1.00 | Finland (right) |
| Generated nature, "Estonian" / no place | 0 % (0/5) / 0 % (0/4) | 0.87 / 0.90 | United States 4, Japan 2, Papua New Guinea, Romania, Canada |
| Real nature (xeno-canto, 5) | 0 % (0/5) | 0.78 | Japan, Norway, Papua New Guinea, Russia, unknown |
| Edits (finale mixes) | 0 % (0/4) | 0.75 | Japan, United States, United Kingdom, Ireland |
| The tintinnabuli rule (code) | 0 % (0/2) | 0.96 | China, Russia |

By model (generated music):

| Model | All | Prompt says "Estonian" | Elsewhere | No "Estonian" | Elsewhere |
| --- | ---: | ---: | --- | ---: | --- |
| ElevenLabs Music v2 | 66 % (21/32) | 75 % (21/28) | United States 2, Russia 2, Japan, Finland, China | 0 % (0/4) | Finland (the Maamme control), Italy, Ireland, United States |
| MiniMax Music 2.6 | 75 % (6/8) | 86 % (6/7) | Iraq | 0 % (0/1) | Mongolia (`mm-part`) |
| MusicGen small (2023) | 0 % (0/6) | 0 % (0/5) | China 3, Norway, Australia | 0 % (0/1) | United States |

**What decides it is the language the judge hears**, both rounds pooled (92 answers on generated music):

| Language the judge heard | Answers | In Estonia | Elsewhere |
| --- | ---: | ---: | --- |
| Estonian | 54 | **100 %** | – |
| another language | 13 | 0 % | United States 3, Russia 3, Finland 2, Georgia 2, Iraq, China, Australia |
| none (instrumental, or no words heard) | 25 | **0 %** | China 5, United States 3, Japan 2, Mongolia 2, Ireland 2, unknown 2, and nine more countries once |

So the music number is a words number. Sung in Estonian, real or generated, it lands in Estonia with
0.95–1.00 confidence, and the judge usually names the song (it named Enno for both originals and for
`nat-randaja`). With no words, **not one** clip lands in Estonia, whether the prompt said "Estonian" or not:
the instrumental "Estonian" clips go to Japan (shakuhachi), the United States ("Native American flute"),
China, Mongolia, Norway, Ireland. Real words sent: 83 % (19/23) in Estonia; no words sent: 35 % (8/23), and
those 8 are all clips where the model wrote Estonian words itself (`el-anthem-*`, `el-regilaul-1`, the `named-*` probes, MiniMax's `mm-named-kevade`).
The pictures have no such switch: there is nothing in a bog photo the judge can read.

**Surprising answers** (one judge, one or two answers each, so "in our test"):

- `fin-anthem-plain`, the anthem's first verse sung in Estonian, *rõõm* kept (Whisper hears "Mu isama mu end
  ja rõõm, kui kaunis oled saab…"): **"Chechen religious hymns (nazms) … the Basmala"** (Russia, 0.90), then
  **Georgian Orthodox chant** (0.98). The one case where the words are there and the judge did not hear them.
- `mm-regilaul-lyrics` (MiniMax, our regilaul lines, õ/ü/ä flattened): **"the traditional Assyrian nursery
  rhyme 'Tuleh Tuleh Toota Nori' sung in Assyrian Neo-Aramaic"** (Iraq, 0.90), then **Megrelian** (Georgia,
  0.95). The flattened "Tuule, tuule, tuta nori" became another people's song with a made-up title.
  ElevenLabs' version of the same lines: Estonia, regilaul, both times.
- `el-part-desc` ("Slow Estonian sacred minimalism"): Japan (shakuhachi and koto), then Armenia.
  `mm-part`: Mongolia (morin khuur), both times. The tintinnabuli rule itself: Chinese bronze bells, a Russian
  Orthodox choir, Java, England. Only the edit `fin-mix-rule-bed-rule` once got "Estonia, Tintinnabuli" (round 2).
- The judge names famous works that are not there: `named-alpinist-instr` is "the opening of Sibelius's Violin
  Concerto", `named-reliikvia-instr` "the Chinese band Omnipotent Youth Society … singing in Mandarin" (an
  instrumental), `fin-mix-anthem-bed-anthem` "Kenji Kawai's score for Ghost in the Shell", `mm-anthem-lyrics`
  "Carl Robert Jakobson's poem 'Mu isamaa'" (it is Jannsen's).
- `fin-rule-arc`: "spoken narration in American English describing musical instructions". The composition
  plan's directions were spoken into the clip (the earlier Whisper run heard the same in `fin-anthem-arc`).
- MusicGen small (2023), asked for the Estonian anthem and Ernesaks: Hardanger fiddle, Tibetan horns,
  didgeridoo, Peking opera percussion. The 2023 model has no idea of a choir.
- The five real birds were judged as **music**: the crane call became a shakuhachi, the black grouse a
  Hardanger fiddle, the curlew a Yakut jaw harp, the thrush nightingale Kaluli weeping songs. Only the
  corncrake was once called "animal vocalizations … rather than human musical performance" (round 1,
  "unknown", 0.1), then Brazil. The question asks about music, so this row shows the judge always finds a
  culture, not that the birds are wrong.

**Steadiness.** Same country in both rounds: 40 of 68. All 29 clips placed in Estonia in round 1 were
placed there again (one more joined in round 2). The instrumental and nature clips wander: 0 of 5 real
birds got the same country twice.

### How many of the words come back

Whisper large-v3-turbo forced to Estonian, the transcript against the words sent (normalised: lowercase,
punctuation out). **WER** = word edits / words given (extra words count, so Whisper's loops push it over 1);
**CER** the same over letters with spaces out (forgives "armastasmeed" for "armastas meel"); **missed** =
given words not heard as such (extra words not counted); **õ ä ö ü kept** = of those letters in the given
words, how many come back at the same place in the word Whisper aligned to it. Medians over clips; letters
pooled. Transcripts: the existing ones (`out/transcripts.json`, `films/transcripts.json`,
`national/transcripts.json`); Whisper was run only for the three finale clips with words and none
(`out/measure-transcripts.json`, 22 s pieces as `national.mjs`).

**Whisper's floor** is the two real recordings of "Rändaja õhtulaul" against Enno's poem (babelmatrix.org;
the film clip sings stanzas 1–3, the record all five; the song changes a few small words, so part of their
error is the song's own wording).

| | Clips | WER | CER | Words missed | **õ ä ö ü kept** | By letter |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Real recordings (Whisper's floor) | 2 | 0.58 | 0.20 | 0.48 | **95 % (37/39)** | õ 94 %, ä 100 %, ü 100 % |
| ElevenLabs Music v2 | 17 | 0.71 | 0.57 | 0.60 | **84 % (109/130)** | õ 90 %, ä 81 %, ö 83 %, ü 65 % |
| MiniMax Music 2.6 | 6 | 0.80 | 0.62 | 0.77 | **44 % (20/45)** | õ 38 %, ä 75 %, ü 38 % |

The clearest clips: `nudge-randaja-prompt` WER 0.22, CER 0.11, 13/13 kept; `nat-randaja` 0.32, 0.09, 12/13.
Both are better than Whisper on the real record, so at their best ElevenLabs' words are as clear as a real
singer's (for Whisper). MiniMax's `mm-regilaul-lyrics` keeps 0 of 8, `mm-anthem-lyrics` 0 of 3. Per clip:
`node research/music-drift/measure.mjs report`.

### Cautions

- **One judge**, Gemini 3.8 Flash, which already failed on birds (`nature-sounds.md`) and here hears Chechen
  in the Estonian anthem. Its answers move between runs (40 of 68 the same twice). Not checked against a
  second judge or against people.
- **Small n.** Two real music recordings, the same song, both sung; so "real 100 %" means "sung in Estonian,
  100 %", and there is no real *instrumental* Estonian control. Five generated clips without a country in the
  prompt. One take per prompt.
- **Whisper's own error** is large on singing: 0.58 WER on the real recordings. Whisper settings differ by
  folder (whole clip with VAD for the first tests, whole clip for the films, 22 s pieces for national and
  finale, 30 s windows for the originals), so compare models within a folder before across. The diacritic
  count only covers words Whisper aligned at all, and Whisper is forced to Estonian, which may help õ.
- The judge is placing **music**, and the question makes it name a culture even for birds.

**Cost:** Gemini 136 calls (2 × 68), about **$0.33**, through the gateway (in its usage table). Whisper on
2.8 minutes of audio, about $0.001, through Cloudflare's REST API (a row in
`evals/estonian-visuals/costs-manual.json`).

## The judge without the voice (2026-11-17)

Asked: *"Can we do vocal removal and judge music location to rm language bias?"* Demucs 4.0.1 (htdemucs, MIT, two
stems, on the CPU: MPS lacks an op; `~/visualia-local/demucs/.venv`) took the singing out of every clip whose
round-1 answer heard a language (53); the accompaniment went to the same judge with the same question
(`measure.mjs separate`, `judge novocals`, `novocals`; `out/novocals/`, `out/novocals/levels.json`,
`out/judge-novocals.jsonl`; about $0.13). Clips 20 dB or more quieter without the voice count as "nothing left"
(a cappella) and were not judged. One answer each: "in our test".

**Placed in Estonia: 35 of 45 with the voice, 1 of 45 without** (MiniMax's anthem, as "Estonia, Ingria"). Not
"unknown" either: confident answers all over the world, 0.85–0.98 mostly. The two real recordings of "Rändaja
õhtulaul" (Anne Maasik, 1983 film and record) went to South India (Carnatic, 0.98) and Ghana. The judge was hearing
the words. Caveat: choirs separate badly (anthem clips only 8 dB quieter), so some voice may be left in them:
listen before quoting a choir line.

| Clip | Model | With the voice (language) | Without the voice | Confidence |
| --- | --- | --- | --- | ---: |
| el-anthem-1 | ElevenLabs Music v2 | Estonia (Estonian) | Italy, Western classical tradition | 0.95 |
| el-anthem-2 | ElevenLabs Music v2 | Estonia (Estonian) | Austria, Vienna | 0.95 |
| el-ernesaks-1 | ElevenLabs Music v2 | Estonia (Estonian) | *nothing left* |  |
| el-ernesaks-2 | ElevenLabs Music v2 | Estonia (Estonian) | Peru, Altiplano (Andean highlands) | 0.85 |
| el-maamme-1 | ElevenLabs Music v2 | Finland (Finnish) | *nothing left* |  |
| el-regilaul-1 | ElevenLabs Music v2 | Estonia (Estonian) | *nothing left* |  |
| el-regilaul-2 | ElevenLabs Music v2 | Estonia (Estonian) | *nothing left* |  |
| mm-anthem-lyrics | MiniMax Music 2.6 | Estonia (Estonian) | Estonia, Ingria | 0.85 |
| mm-ernesaks-lyrics | MiniMax Music 2.6 | Estonia (Estonian) | Paraguay | 0.85 |
| mm-regilaul-lyrics | MiniMax Music 2.6 | Iraq (Assyrian Neo-Aramaic) | Russia, Sakha Republic (Yakutia) or Tuva, Siberia | 0.85 |
| tintinnabuli-1-superior | tintinnabuli.mjs (code) | Russia (Church Slavonic) | Indonesia, Central Java | 0.98 |
| films/children-nukitsamees | ElevenLabs Music v2 | Estonia (Estonian) | Nigeria | 0.75 |
| films/mm-named-alpinist | MiniMax Music 2.6 | Russia (Veps) | Algeria, Maghreb | 0.85 |
| films/mm-named-kevade | MiniMax Music 2.6 | Estonia (Estonian) | Germany | 0.65 |
| films/mm-named-nipernaadi | MiniMax Music 2.6 | Estonia (Estonian) | Russia, Russian folk tradition | 0.9 |
| films/mm-named-nukitsamees | MiniMax Music 2.6 | Estonia (Estonian) | China, Taiwanese and Chinese disco/dance-pop | 0.85 |
| films/mm-named-reliikvia | MiniMax Music 2.6 | Estonia (Estonian) | Mongolia | 0.9 |
| films/mm-room-kevade | MiniMax Music 2.6 | Estonia (Estonian) | Italy, Classical tradition | 0.95 |
| films/mm-room-nipernaadi | MiniMax Music 2.6 | Estonia (Estonian) | Brazil | 0.95 |
| films/mm-room-nukitsamees | MiniMax Music 2.6 | Estonia (Estonian) | China, Guangdong | 0.95 |
| films/mm-room-reliikvia | MiniMax Music 2.6 | Estonia (Estonian) | China, Beijing opera (Jingju) | 0.98 |
| films/named-alpinist | ElevenLabs Music v2 | Estonia (Estonian) | United States | 0.7 |
| films/named-reliikvia-instr | ElevenLabs Music v2 | China (Mandarin) | Bolivia, Andes | 0.85 |
| films/named-reliikvia | ElevenLabs Music v2 | Estonia (Estonian) | China | 0.9 |
| films/room-kevade | ElevenLabs Music v2 | Estonia (Estonian) | United Kingdom | 0.85 |
| films/room-nipernaadi | ElevenLabs Music v2 | Estonia (Estonian) | Canada, Quebec | 0.95 |
| films/room-nukitsamees | ElevenLabs Music v2 | Estonia (Estonian) | Italy, Campania / Naples | 0.98 |
| films/room-reliikvia | ElevenLabs Music v2 | Estonia (Estonian) | South Africa, Township pop / Bubblegum | 0.85 |
| films/style-kevade | ElevenLabs Music v2 | Estonia (Estonian) | Russia, Russian classical tradition | 0.98 |
| films/style-nipernaadi | ElevenLabs Music v2 | Estonia (Estonian) | Peru, Andes | 0.85 |
| films/style-nukitsamees | ElevenLabs Music v2 | Estonia (Estonian) | Thailand, Isan | 0.95 |
| films/style-reliikvia | ElevenLabs Music v2 | Estonia (Estonian) | Japan, Wadaiko / Matsuri-bayashi tradition | 0.95 |
| national/mm-mesipuu | MiniMax Music 2.6 | Estonia (Estonian) | China, Beijing opera (Jingju) | 0.95 |
| national/mm-randaja | MiniMax Music 2.6 | Estonia (Estonian) | Bolivia, Chiquitos or Moxos mission tradition | 0.85 |
| national/named-mesipuu | ElevenLabs Music v2 | Estonia (Estonian) | Peru, Andes | 0.85 |
| national/named-randaja | ElevenLabs Music v2 | Estonia (Estonian) | United States, North America | 0.95 |
| national/nat-isamaa-armas | ElevenLabs Music v2 | Estonia (Estonian) | United States, New Orleans | 0.8 |
| national/nat-kungla | ElevenLabs Music v2 | Estonia (Estonian) | Romania, Moldavia | 0.85 |
| national/nat-mesipuu | ElevenLabs Music v2 | Estonia (Estonian) | *nothing left* |  |
| national/nat-randaja | ElevenLabs Music v2 | Estonia (Estonian) | Russia | 0.95 |
| national/nat-sind-surmani | ElevenLabs Music v2 | Estonia (Estonian) | *nothing left* |  |
| national/nudge-randaja-plan | ElevenLabs Music v2 | Estonia (Estonian) | China | 0.95 |
| national/nudge-randaja-prompt | ElevenLabs Music v2 | Estonia (Estonian) | Turkey, Anatolia | 0.85 |
| finale/fin-anthem-arc | ElevenLabs Music v2 | United States (English) | *nothing left* |  |
| finale/fin-anthem-plain | ElevenLabs Music v2 | Russia (Chechen) | *nothing left* |  |
| finale/fin-ernesaks-arc | ElevenLabs Music v2 | Russia (Church Slavonic) | Indonesia, West Java | 0.95 |
| finale/fin-mix-anthem-bed-anthem | edit (ffmpeg) | Japan (Japanese) | Ireland, Celtic harp tradition | 0.75 |
| finale/fin-rule-arc | ElevenLabs Music v2 | United States (English) | China, Tibet | 0.85 |
| nature/juniper-ee | ElevenLabs Music v2 | Kazakhstan (Kazakh) | Russia, Tuva | 0.95 |
| nature/lasnamae-ee | ElevenLabs Music v2 | Spain (Spanish) | Spain, Andalusia | 0.95 |
| nature/rye-ee | ElevenLabs Music v2 | Japan (Japanese) | France | 0.85 |
| films/original/LW276X3qR5M-Anne_Maasik_Randaja_ohtulaul_Estonian_Folk_Music | real recording | Estonia (Estonian) | Ghana, Ashanti | 0.85 |
| films/original/uORJCOIZ-yg-Nipernaadi_Anne_Maasiku_Randaja_ohtulaul | real recording | Estonia (Estonian) | India, South India (Carnatic) | 0.98 |

Judged both ways: 45 clips (8 with nothing left, not judged).
In Estonia with the voice: 35/45; without: 1/45.
Judging without the voice: about $0.128

## Can the judge place any music? A control (2026-11-17)

Asked: *"does the judge have any credibility judging countries' music, most popular ones? ... if it can't even
distinguish big countries' music, then what's the point?"* 35 real instrumental recordings from 22 traditions,
freely licensed (Wikimedia Commons 30, Internet Archive 5; `out/judge-control/manifest.json` has source, licence and
artist for each; collected by an agent, not listened to), sent the same way as our clips (mono mp3, tags stripped,
the same question, Gemini 3.8 Flash): `measure.mjs judge control`, `measure.mjs control`; `out/judge-control.jsonl`,
about $0.16. Lenient: Scotland or the UK, Peru or Bolivia, Austria or Germany, Mali or its neighbours count as right.

**Right: 11 of 35 (31 %), at 0.85–1.0 confidence whether right or wrong.** It gets the clichés: Highland bagpipes,
a sitar raga with tabla, Zen shakuhachi, Hardanger fiddle, didgeridoo, a Bavarian Ländler band, one gamelan, one
erhu, one flamenco rumba, a Dalarna polska. It misses an Irish jig (Cape Breton), a koto (China), Andean panpipes (Iran,
Native American), Brazilian choro (Zimbabwe, Taiwan), Malian kora (Spain, twice), a 1917 Dixieland band (Galicia),
a balalaika orchestra (Java), a bandura (Siberia), a Viennese zither (China). The Estonian torupill went to Galicia and
the kannel to Beijing opera; the Finnish kantele to China (Latvia and Lithuania: no usable recording found).

Caveats: one look, one answer each; some recordings are old (1904–1929) or amateur, the kannel is a field recording,
and the agent flagged a few as possibly having voices. Even so, the judge is not a credible ear for where music comes
from: without words it recognises a few famous instruments and otherwise guesses, always sure of itself. Our music
"drift" numbers measure the judge as much as the generators; with words, they measure the language.

| Tradition | Recording | Judge said | Confidence | Right? |
| --- | --- | --- | ---: | --- |
| Ireland, fiddle, whistle, ensemble | Slainte - Kesh Jig Leitrim Fancy.ogg | Canada, Cape Breton, Nova Scotia | 0.9 | **no** |
| Scotland, Great Highland bagpipes, drums | Scotland the Brave - Pipe Band - United States Air Force Reserve Band.mp3 | United Kingdom, Scotland | 0.98 | yes |
| Scotland, Great Highland bagpipes | Skye Boat Song.ogg | United Kingdom, Scotland | 0.98 | yes |
| India, sitar, tabla | RanjitMakkuniRagaBagBhim.ogg | India, North India | 0.99 | yes |
| India, sitar | Sohini Qawwali.ogg | Thailand, Central Thailand | 0.95 | **no** |
| Japan, shakuhachi | Shikanotoone.ogg | Japan, Honkyoku (Zen shakuhachi tradition) | 0.98 | yes |
| Japan, koto | Koto performance.ogg | China, Traditional Chinese music | 0.95 | **no** |
| China, erhu | 二泉映月.ogg | Mongolia, Urtyn Duu (Long Song) tradition | 0.98 | **no** |
| China, erhu | 江河水.ogg | China, Beijing opera (Jingju) | 0.95 | yes |
| Spain, flamenco guitar | VerdialesSerak.ogg | Bulgaria, Thrace | 0.85 | **no** |
| Spain, flamenco guitar | Entre-dos-aguas-laucke-version-sample.flac | Spain, Andalusia | 0.95 | yes |
| Brazil, flute, saxophone, guitars | 1 x 0 Pixinguinha e Benedito.ogg | Zimbabwe, Shona | 0.95 | **no** |
| Brazil, flute, cavaquinho, guitar | MASSADA (Lulu Cavaquinho) - Choro Carioca 1911.ogg | Taiwan, Hokkien / Beiguan tradition | 0.85 | **no** |
| Peru/Bolivia, siku panpipes, bombo | Interpretación del tema "Mula Lunthata" - Maqueta ejecutada con pareja de sikus Malta y bombo.wav | Iran, Kurdish or Lor tradition | 0.85 | **no** |
| Peru/Bolivia, siku panpipes | Interpretación del tema "29 de setiembre" ejecución adornada con sikus Malta - Sonido conjunto de Ira y Arka.wav | United States, Native American | 0.9 | **no** |
| Norway, Hardanger fiddle (video file) | Hardanger Fiddle - St Cecilia's Hall.webm | Norway, Telemark | 1 | yes |
| Sweden, nyckelharpa | Lövstabrukspolskan - SMV - MMF7 0691 08.wav | Denmark, Danish traditional music | 0.95 | **no** |
| Sweden, nyckelharpa | Polska - SMV - MMF7 0660 01.wav | Sweden, Dalarna | 0.95 | yes |
| Finland, 5-string kantele | DIY kantele sample raw.ogg | China | 0.98 | **no** |
| Estonia, torupill | Torupill.L.ogg | Spain, Galicia | 0.95 | **no** |
| Indonesia, gamelan | Gamelan angka 1 Kraton Ngayogyakarta.ogg | Japan, Okinawa | 0.95 | **no** |
| Indonesia, gamelan | Gamelan angka 2 Kraton Ngayogyakarta.ogg | Indonesia, Bali | 0.98 | yes |
| Australia, didgeridoo | Didgeridoo sound.ogg | Australia, Aboriginal Australian (Arnhem Land) | 0.98 | yes |
| USA, cornet, clarinet, trombone, piano, drums | Original Dixieland Jass Band - Livery Stable Blues (1917) with hiss reduction.ogg | Spain, Galicia | 0.95 | **no** |
| Austria/Germany, zither | Zither solo from G'schichten aus dem Wienerwald Op.325.ogg | China, Traditional Chinese music | 0.98 | **no** |
| Austria/Germany, Ländler band | Solang der alte Peter - Volksweise - Tegernseer Ländler - Kapelle Moar Jr. (1929).ogg | Germany, Bavaria | 0.98 | yes |
| Greece, Cretan lyra | Cretan Lyra - Sample.mp3 | Norway, Telemark or Hardanger folk tradition | 0.95 | **no** |
| Turkey, oud, kemenche | Husseyni Saz Semayissi .ogg | Greece | 0.95 | **no** |
| Hungary, tárogató | A Rákóczi nóta 1908-ból.ogg | China, Northern China | 0.95 | **no** |
| Ukraine, bandura | Hnat Honcharenko - Kozachok Polianka.flac | Russia, Siberia | 0.85 | **no** |
| Russia, balalaika orchestra | Andreieff's Balalaika Orch. — Molodka / Sun in the sky, stop shining (HMV, 1911) | Indonesia, Java | 0.98 | **no** |
| Mali, kora | Mamadou Sidiki Diabate - Kelefaba | Spain, Aragon | 0.95 | **no** |
| Mali, kora | Mamadou Sidiki Diabate - Konufo | Spain, Andalusia | 0.98 | **no** |
| Australia, didgeridoo (video file) | Mark Atkins | Russia, Tuva | 0.95 | **no** |
| Estonia, kannel | Rohu, Tallinn - kannel, hair | China, Beijing opera (Jingju) | 0.98 | **no** |

Right: 11/35. Estonia, Latvia, Lithuania, Finland: 0/3.
Judging: about $0.156

## Naming Sven Grünberg, and cranes for Matsalu (2026-11-18)

Asked: *"generate hukkunud alpinisti music naming Sven Grünberg"*. `films.mjs` `composer-alpinist` ("Music by Sven
Grünberg for the Estonian film Hukkunud Alpinisti hotell (1979). Instrumental.") and `composer-grunberg` ("A piece in
the style of Sven Grünberg, the Estonian electronic music composer, late 1970s. Instrumental."): **both refused by
ElevenLabs**, `copyrighted_material_detected`, as Pärt was; it offers a rewrite without the name ("inspired by the
eerie and atmospheric mood of a 1970s Estonian mystery film"). MiniMax took the first prompt: `mm-composer-alpinist`,
3 min 15 s, mean −20.6 dB. Nobody has listened yet.

`nature.mjs` `matsalu-ee` ("an October evening at Matsalu bay … large flocks of common cranes calling …", for the
intro's Matsalu scene): made, 25 s, quiet (mean −48 dB, peak −23 dB). **BirdNET hears no common crane**: Limpkin 0.91
(a crane-like wader of the Americas), Herring Gull 0.29, Glaucous-winged Gull 0.27 (North Pacific). Asked for cranes
at Matsalu, got an American bird. About $0.21 for the three clips (outside the gateway, `costs-manual.json`).
