# Estonian nature sounds: can the catalog's sound models make them?

A side test for the Arunädal bias demo (`research/arunadal-demo.md`, 20.11.2026) and the drift
room (`plans/drift-room.md`), run 2026-11-16. The question: asked for an Estonian bog, meadow,
alvar or spruce forest, do the birds the model gives belong in Estonia? A model makes the final
sound file, so this is visualia, not positron.

Files (clips and results are git-ignored, in `out/nature/`):

- `nature.mjs`: the prompts and the call. `CF_TOKEN=$(cd apps/gateway && npx wrangler auth token) node research/music-drift/nature.mjs [id ...]`.
- `birdnet.mjs`: BirdNET without Python (below). `node research/music-drift/birdnet.mjs file.mp3 ...`.
- `out/nature/<id>.mp3`, `<id>.json` (request and response), `birdnet-0.1.json`,
  `birdnet-norm-0.1.json` (the same after loudness normalisation), `gemini.json` (the judge).
- `out/nature/control/XC*.mp3`: the five xeno-canto recordings, and their `birdnet-0.1.json`.

Nobody has listened yet.

## The model

The Cloudflare catalog has **no sound-effects model** (rechecked in the Cloudflare docs,
2026-11-16): speech (Aura, Grok TTS, MeloTTS), two music models, and video models that make an
audio track (Kling v3 with `sound: 'on'` at $0.168/s, Veo, Seedance, Grok Imagine Video). ElevenLabs'
own Sound Effects model is not in the catalog. So: **`elevenlabs/music-v2`**, `force_instrumental:
true`, 25 s, every prompt starting *"Field recording, no music, no instruments, no melody, only
natural ambient sound recorded with a stereo microphone:"*. Each Estonian scene has a twin without
the place.

| Clip | The rest of the prompt | Mean level |
| --- | --- | --- |
| `bog-ee` | spring dawn on an Estonian raised bog (Viru raba), cranes calling, black grouse lekking, a curlew, wind over the bog. | −51 dB |
| `bog-plain` | spring dawn on a raised bog, cranes calling, black grouse lekking, a curlew, wind over the bog. | −33 dB |
| `meadow-ee` | a June night in an Estonian meadow, a corncrake calling and a thrush nightingale singing. | −37 dB |
| `meadow-plain` | a June night in a meadow, a corncrake calling and a nightingale singing. | −54 dB |
| `alvar-ee` | an Estonian coastal alvar on Saaremaa in May, the Baltic Sea nearby, birds singing. | −60 dB |
| `alvar-plain` | a coastal limestone meadow by the sea in May, birds singing. | −50 dB |
| `spruce-ee` | an Estonian spruce forest at dusk, birds singing. | −54 dB |
| `spruce-plain` | a spruce forest at dusk, birds singing. | −59 dB |
| `estonia-open` | Estonian nature in spring. | −51 dB |

All nine came back (no refusals). Most are very quiet: −50 to −60 dB mean is close to silence,
so turn them up before judging by ear.

## How it was measured

**BirdNET v2.4** (K. Lisa Yang Center, Cornell Lab of Ornithology, and TU Chemnitz; 6,522
classes; model licence CC BY-NC-SA 4.0, research use). No Python: tphakala's ONNX build
(`BirdNET_v2.4_int8_arm_foldconv.onnx`, 31 MB, https://huggingface.co/tphakala/BirdNET-v2.4,
about 98 % top-1 agreement with the full model) run by `onnxruntime-web` 1.31.1's WebAssembly
build in Node, ffmpeg to decode. About 47 MB in `~/visualia-local/birdnet/`, outside git; nine
clips take 6 s. BirdNET-Go (the ready-made binary) was 117 MB, too much on 4G.

3 s windows with 1.5 s hop, sigmoid of the logits, **no location filter**, so non-Estonian
species can show. Below, ≥ 0.25 counts as a detection and 0.10–0.25 as a hint. Loudness
normalisation before BirdNET changed nothing that matters (`birdnet-norm-0.1.json`).
Estonia yes/no: Wikipedia's *List of birds of Estonia* (Clements 2022; (A) = accidental),
not yet checked against the EOÜ list itself.

**Control**: five Estonian xeno-canto recordings, all CC BY-NC-SA 4.0. The xeno-canto API v3
needs a key now (v2 is gone); the recordings were found through the public search page and
downloaded from `xeno-canto.org/<id>/download`.

| Recording | Species (recordist) | BirdNET top | Gemini (below) |
| --- | --- | --- | --- |
| XC656637 (20 s) | Corncrake, song (Uku Paal) | **Corncrake 1.00** | American Woodcock (high); first run: Tawny Owl (high) |
| XC1001082 (9 s) | Common Crane, flight call (Uku Paal) | **Common Crane 0.87** (Sandhill Crane 0.78) | Red-crowned Parakeet (high) |
| XC1058566 (4 min) | Black Grouse, song (Morten Bongers) | **Black Grouse 0.99** | Eurasian Hoopoe (high) |
| XC656570 (2 min) | Eurasian Curlew, alarm (Uku Paal) | **Eurasian Curlew 1.00**, Skylark 0.95 | European Robin, Song Thrush (high) |
| XC1148078 (4 min) | Thrush Nightingale, song (Tom Cooney) | **Thrush Nightingale 1.00** | Anna's Hummingbird (high) |

BirdNET gets **5 of 5** at 0.87–1.00. The measuring tool works on real Estonian birds.

## What came back

BirdNET, maximum confidence per species over the clip (windows = how many 3 s windows):

| Clip | Asked for | ≥ 0.25 (Estonia?) | Hints 0.10–0.25 |
| --- | --- | --- | --- |
| `bog-ee` | crane, black grouse, curlew | Common Crane 0.34, 1 window (yes) | White-cheeked Barbet 0.25 (India), Pallid Swift (A), Jungle Owlet (India), Bell's Vireo (N America) |
| `bog-plain` | same | **Common Crane 0.97, 7 windows** (yes); Common Pheasant 0.62 (introduced game bird, yes); Spotless Starling 0.29 (Iberia, **no**); Black Redstart 0.26 (yes) | Varied Thrush, Olive Warbler, Townsend's Solitaire (N America); Red-whiskered Bulbul (Asia) |
| `meadow-ee` | corncrake, thrush nightingale | **Thrush Nightingale 0.49** (yes); Barred Warbler 0.28 (yes) | Apapane (Hawaii), Racket-tailed Drongo (Asia), "Siren" |
| `meadow-plain` | corncrake, nightingale | Golden Oriole 0.87 (yes, not asked); Red-breasted Toucan 0.26 (S America, **no**) | Magpie, Hooded Crow (yes) |
| `alvar-ee` | (birds) | nothing | Common Swift 0.16 (yes) |
| `alvar-plain` | (birds) | Grey-headed Canary-Flycatcher 0.57 (S Asia, **no**); American Dipper 0.48 (W N America, **no**) | |
| `spruce-ee` | (birds) | Western Capercaillie 0.35 (yes) | Hazel Grouse 0.22 (yes) |
| `spruce-plain` | (birds) | nothing | Black-throated Grey Warbler (N America), House Martin |
| `estonia-open` | (nothing named) | nothing | Black-throated Grey and Townsend's Warbler, Great Horned Owl, Mexican Chickadee (N/C America); Brambling (yes) |

Counted:

- **Asked-for species heard: 3 of 8 asks** (crane twice, thrush nightingale once). **Corncrake,
  black grouse and curlew: never**, in either version, though BirdNET finds all three at
  0.99–1.00 in the real recordings. Only one asked-for bird is clear: the cranes in `bog-plain`.
- Detections (≥ 0.25) that do not occur in Estonia: **4** (Spotless Starling, Red-breasted
  Toucan, Grey-headed Canary-Flycatcher, American Dipper), against 9 that do. The
  non-Estonian ones are in the clips **without** "Estonian"; the clips with the word got only
  Estonian species (crane, thrush nightingale, barred warbler, capercaillie). One take each,
  so this is a hint, not a result.
- The guessed stock-library birds (American robin, mourning dove, loons) **did not show**. North
  American warblers do show as weak hints, the same species (Black-throated Grey Warbler) in
  `estonia-open` and `spruce-plain`.
- Most of the sound is **bird-like but not a species**: four clips have nothing BirdNET will
  name above 0.25. The model makes "birdsong", the average of birds, more than any one bird.
  That is mechanism 2 in `research/drift-mechanisms.md` (the average replaces the specific)
  more than mechanism 1 (a neighbour's species).

## The audio judge: a weaker method, and a finding

`google/gemini-3.8-flash` through the gateway takes audio (`{type: 'input_audio', input_audio:
{data, format: 'mp3'}}`; about 25 audio tokens per second). Asked for species and region, it
got **0 of 5** real recordings right, every answer marked "high" confidence: the Corncrake became
a Tawny Owl, then on a second run an American Woodcock; the Thrush Nightingale became Anna's
Hummingbird ("Western North America"). On the generated clips it called every one "natural
field recording, no music" and gave European garden birds or Asian/Pacific species (`bog-ee`:
"Kagu, New Caledonia"). Not usable as a judge for birds. For the talk it is mechanism 10 (the
checker shares the bias) in its plainest form: a confident judge that cannot hear what it
judges. One run per clip; say "in our test".

## Cost

ElevenLabs: 9 × 25 s × $0.0025 = **$0.56**. Gemini: about 11 k tokens in, 4 k out, about
**$0.03**. Total about **$0.59**. Downloads about 70 MB (BirdNET and the runtime 47 MB, the
xeno-canto files 19 MB, of which the 4-minute black grouse is 14 MB).

## Which clip for the demo or the drift room

On paper, ears decide:

- **The demo**: the pair `meadow-ee` / the real corncrake (XC656637). Asked for a corncrake, the
  model gives a thrush nightingale-ish song and no corncrake; the real one is 20 s of the
  unmistakable "crex crex", and BirdNET is sure (1.00). Then the Gemini line: the judge called
  that real corncrake a Tawny Owl, then an American Woodcock. Play the xeno-canto clip only with
  attribution (Uku Paal, xeno-canto XC656637, CC BY-NC-SA 4.0) and not on a public page.
- **The drift room**: `bog-plain` as a bed (the loudest, −33 dB, real-sounding cranes for 10 s
  of the 25). `alvar-plain` is the clearest drift on paper (an Asian flycatcher and an American
  dipper on a Baltic shore), but its prompt had no place in it, so it shows "the default bird",
  not "Estonia replaced".
- The rest are too quiet to use as they are.

Before quoting: one take per prompt, BirdNET int8 build without a location filter, and the
Estonia list taken from Wikipedia, not EOÜ. The ElevenLabs Sound Effects model (not in the
catalog) or Kling's audio might do better; not tested.

## Nature sounds on the slides (2026-11-17)

Asked: sounds on the nature slides (`evals/estonian-visuals/out/drift-room/slides.html`, 15 subjects). Each subject's
picture slides now play a generated clip (looped, soft, 0.6 s fade on a change, going on across the subject's slides
without restarting), with its prompt box under the picture's (amber dot) and the music judge's place as an amber heat
and label on the map. Sound starts on the first key press; M turns it off and on. Clips are brought to one level by
their own RMS in the page (they range from −31 to −60 dB mean). Backup: `slides.before-sounds.html`;
`room-side.js` now exports `musicBox` (backup `room-side.before-sounds.js`).

**New clips** (`nature.mjs`, ElevenLabs Music v2, 25 s, the same field-recording opening, the place named, no plain
twin): `klint-ee` (Pakri: waves on the cliff, drift ice, wind, gulls), `peipsi-ee` (Old Believer onion village: waves,
a boat at the jetty, cockerel, swallows), `setomaa-ee` (no singing and no voices: lime trees, hens, cowbell, swallows),
`lighthouse-ee` (Kõpu: wind, sea, gulls), `oldtown-ee` (church bells, footsteps on cobbles), `juniper-ee` (insects,
wind), `rye-ee` (rye field with cornflowers, skylark; used for rye and cornflower), `eyebright-ee` (Saaremaa fen
meadow, insects, a curlew), `ashhills-ee` (Kiviõli: wind, the plant's hum, a train), `lasnamae-ee` (traffic, children,
wind between the blocks), `birch-ee` (chaffinch, song thrush, cuckoo). The first `peipsi-ee` came back silent (−90 dB),
kept in `out/nature/silent/peipsi-ee-1.*` and made again. Reused: bog → `bog-ee`, alvar → `alvar-ee`, matsalu →
`meadow-ee`. Nobody has listened yet.

**Where the music judge put them** (`measure.mjs judge`, round 1, Gemini 3.8 Flash; `out/measure.json`): none in
Estonia. Every clip was heard as music with an instrument or tradition, though the prompt says "no music":
klint Spain ("Recuerdos de la Alhambra" on guitar), peipsi Fiji (male choir), setomaa United States (Native
American flute), lighthouse France (Breton accordion), old town Russia (Orthodox bell ringing), juniper Kazakhstan
(dombra and singing), rye Japan (shakuhachi, "spoken Japanese"), eyebright Japan (shakuhachi), ash hills Peru (Andean
harp), Lasnamäe Spain (castanets, children "in Spanish"), birch Italy (Neapolitan mandolin), all at 0.65–0.98
confidence. The old ones on the slides: bog Papua New Guinea, alvar and meadow United States. The judge also called the
five real birds music, so this says as much about the judge as about the clips; whether the clips hold music needs ears.

**BirdNET** (`out/nature/birdnet-slides-0.1.json`, and `-norm-` after loudness normalisation, same result). Asked-for
birds heard: **gulls** at the klint (Herring Gull 0.71) and the lighthouse (Herring Gull 0.60), both Estonian.
**Not heard**: skylark (rye), curlew (eyebright), chaffinch, song thrush and cuckoo (birch), cockerel and swallows
(peipsi: only "Fireworks" 0.44 and "Engine"). Not asked for: Setomaa got Varied Thrush 0.47 (North America, **no**),
Common Waxbill 0.43 (Africa, **no**) and Common Pheasant 0.40; Lasnamäe got gulls (Yellow-legged 0.43, Kelp Gull 0.30,
southern hemisphere, **no**); eyebright a European Robin 0.28. Juniper, rye and ash hills: nothing at ≥ 0.10.

**Title slides** (a real photo, full bleed) play a real xeno-canto recording, quieter, credited after the photo
("Heli: …"): bog the black grouse (XC1058566, Morten Bongers), matsalu the curlew (XC656570, Uku Paal, recorded at
Haeska by Matsalu bay), eyebright the corncrake (XC656637, Uku Paal), birch the thrush nightingale (XC1148078, Tom
Cooney). All CC BY-NC-SA 4.0 (checked on each recording's page); research use, not a public page. The other titles
are silent.

**Cost**: 12 × 25 s × $0.0025 = **$0.75** (ElevenLabs, outside the gateway, in `costs-manual.json`); the judge
about **$0.02** through the gateway. Study total after this run: $37.39 (`costs.mjs`).
