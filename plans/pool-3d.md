---
status: idea
---

# Pictures to 3D in the pool

Two new pool jobs, written 2026-11-14, nothing built:

- **Remove background** (kind `cutout`): a picture in, the same picture as a
  PNG with alpha out, and optionally the mask.
- **Picture to 3D** (kind `mesh`): a cut-out picture in, a GLB out, made by
  TripoSR on a computer in the pool.

Picture to 3D runs on a cut-out picture. A photo with a background goes
through Remove background first, as its own job.

What this rests on: the TripoSR script in Node (`research/triposr/triposr.mjs`,
measured in `research/triposr-node.md` and `research/triposr/results.md`), the
background removal script `research/triposr/rmbg.mjs` (being written beside
it, sharing its code), and the pool as it is today (`apps/pool/src/index.js`,
`apps/pool-app/pool-core`). File and line references are to the tree on
2026-11-14. A claim marked INFERRED was not measured or read from code.

## What the pool already does (read from the code)

| fact | where |
| --- | --- |
| One `Pool` Durable Object per school, worker sockets hibernate, `ping` answered as `pong` without waking it | `apps/pool/src/index.js:234-239` |
| The gateway reaches the pool only through the service binding `POOL`, entrypoint `ForGateway`; it picks the path from a fixed list (`/decide`, `/upscale`, `/image`, else `/job`) | `apps/pool/src/index.js:57-66`, `apps/gateway/wrangler.jsonc:21` |
| The frames, written down in one comment: `hello`, `welcome`, `job`, `delta`, `done`, `error`, `cancel`, and the `kind` jobs `decide`, `upscale`, `image` | `apps/pool/src/index.js:209-228` |
| A job kind is declared by a `kind` field on the `job` frame, one pool route per kind, one limit set per kind | `apps/pool/src/index.js:37-49`, `:291-340` |
| `hello {kind, models}`: a worker advertises what it can do only as a list of model names, at most 8, each `^[a-z0-9.\-]{1,40}$`; `kind` is `node` or `tab` | `apps/pool/src/index.js:392-401` |
| The Rust worker's hello is `{type: 'hello', kind: 'node', models}` | `apps/pool-app/pool-core/src/core.rs:79-81` |
| Picking a worker: idle, has the model, idle longest; a worker holds one job (`a.job`) | `apps/pool/src/index.js:259-268` |
| Picture results come back as base64 inside one JSON `done` frame; the pool checks length and the first 64 characters | `apps/pool/src/index.js:410-415`, `core.rs:91-96` |
| Size caps today: upscale 4,000,000 base64 characters in, 24,000,000 out; a drawn picture 6,000,000 out | `apps/pool/src/index.js:40-48` |
| Binary WebSocket frames are ignored by the pool | `apps/pool/src/index.js:387` |
| Frames other than `done` and `error` are ignored for one-reply jobs (no progress frame exists) | `apps/pool/src/index.js:407-409` |
| Energy in `done.usage` is kept only as `energy_j`, `energy_net_j`, `sys_energy_j`, `energy_source`; other fields are dropped | `apps/pool/src/index.js:529-536` |
| R2: the pool has one bucket, `APP` = `visualia-pool-app` (app updates and model files at `/app/files/`); the studio has `PROJECTS` = `visualia-projects`; the gateway has none | `apps/pool/wrangler.jsonc:17`, `apps/studio/wrangler.jsonc:20` |
| Model files from the list are downloaded from `/app/files/<file>` and checked by SHA-256 before they take their name | `apps/pool-app/pool-core/src/native.rs:326-369` |
| The precedent for running another program: `sd-cli`, a separate install, spawned with arguments (no shell), output thrown away, killed on cancel or after 170 s | `native.rs:482-521`, `core.rs:261`, `plans/worker-app.md:194-222` |
| The Rust worker starts each job as its own task; one job at a time comes from the pool, not from the worker | `native.rs:220-223` |
| The studio already knows the GLB type | `apps/studio/src/files.js:150` |
| Everything visible: each job shown as it runs (model, size, time, energy), the same rows on the usage page, never the prompt | `plans/pool.md:80-83` |
| A worker sees what it runs, and says so; jobs carry no identity of the asker | `plans/pool.md:89-90` |
| No cloud fallback for pool pictures: no computer online is a 503 | `plans/worker-app.md:198-199`, `apps/gateway/src/index.js:355`, `:434` |

**The WebSocket message limit is 32 MiB, not 1 MiB.** Cloudflare's Durable
Objects limits page (fetched 2026-11-14, "last updated November 13, 2026")
says: "WebSocket message size: 32 MiB (only for received messages)", for both
SQLite and key-value Durable Objects. The Workers limits page lists no
WebSocket message size, and 128 MB of memory per isolate. A request body
through the service binding falls under the plan's 100 MB (Free and Pro).
The worker's side (tokio-tungstenite 0.26) accepts messages up to 64 MiB by
default (INFERRED from tungstenite's defaults, not read here).

## 1. The two jobs and their frames

Both follow the `upscale` and `image` shape, plus one new frame, `stage`.

```
Remove background
pool -> worker  { type: 'job', id, kind: 'cutout', model: '<mask model>', image }
worker -> pool  { type: 'done', id, image, mask?, width, height, usage }
                image: base64 PNG with alpha, the input's size
                mask:  base64 8-bit grey PNG, only when asked (want_mask: true on the job)

Picture to 3D
pool -> worker  { type: 'job', id, kind: 'mesh', model: 'triposr', image, grid }
                image: base64 PNG with alpha (a cut-out), grid: 128 or 256
worker -> pool  { type: 'stage', id, stage, seconds }       new, any number
                stage: 'loading' | 'picture' | 'grid' | 'surface' | 'colour' | 'file'
worker -> pool  { type: 'done', id, glb, triangles, usage }   glb: base64
both            { type: 'error', id, message }  and  { type: 'cancel', id }  as today
```

The stage names follow the script's own timings (`load`, `encoder`,
`decoder grid`, `MC`, `colour` in `research/triposr/results.md`).

**Sizes.** A phone photo is 2 to 5 MB as JPEG (INFERRED). TripoSR looks at a
512x512 picture anyway (`research/triposr-node.md` "What the export really
is"), so the studio makes the picture at most 1024 pixels on its long side
before sending, as the upscale page makes pictures smaller in the browser
(`plans/local-images.md:187`). Caps, in base64 characters:

| | in | out |
| --- | --- | --- |
| `cutout` | 4,000,000 (as `UPSCALE_IN`) | 6,000,000 for the picture, 2,000,000 for the mask |
| `mesh` | 6,000,000 | 8,000,000 (a 6 MB GLB; measured GLBs are 1.2 to 2.9 MB at grid 256, so 1.6 to 3.9 million characters) |

**Decision: base64 inside one JSON frame, as upscale and image do today.**

| | one JSON frame, base64 | chunked binary frames | R2 with a signed URL |
| --- | --- | --- | --- |
| fits the limit | yes: at most 8 million characters against 32 MiB received | yes | yes, no limit |
| pool change | a route and a check, as `/upscale` | the pool reads no binary frames today (`index.js:387`); reassembly and ordering are new code | a bucket for results, signing, deleting old files |
| addresses a worker talks to | still only `pool.visualia.space` | same | a signed R2 URL is on `<account>.r2.cloudflarestorage.com` (INFERRED), a second address for IT, against `plans/pool.md:20-21` |
| stored | nothing, passes through memory | nothing | the GLB sits in a bucket until deleted, against "nothing about a job is stored" (`index.js:12-13`) |
| cost | 33 % larger on the wire | none extra | an R2 write and read per job |
| memory in the Durable Object | one 8 MB string plus its parse, a few times over against 128 MB | smaller pieces | none |

Base64 wins because it is the shape that exists, it keeps one address and it
stores nothing. Chunked binary frames become worth it only if a result passes
about 20 MB, or several big jobs run at once in one school's Durable Object
and press on the 128 MB. Neither is near.

**What the asker gets.** `mesh` answers the gateway as an event stream, like
chat (`index.js:365-383`): one `stage` event per stage, then `done` with the
GLB, or `pool_error`. That is how the stages reach the asker's page. `cutout`
is short and answers with one JSON reply, like upscale. Gateway routes:
`POST /v1/cutout` and `POST /v1/mesh`, both `pool/<model>` names, both
recorded at $0 with energy and `served_by`. The studio saves the GLB into the
project's files (R2 `PROJECTS`), which already knows the type.

**Chaining.** The pool's `/mesh` takes only a PNG with alpha (colour type 6 in
the PNG header), so that a `mesh` worker never needs the mask model's
memory on top of TripoSR's. (`triposr.mjs` itself now cuts out any picture
with no transparent pixel first, `research/triposr/triposr.mjs:180-190`.) For any
other picture the gateway runs `cutout` first, on any worker that has the
mask model, a tab included, then `mesh` with its result. Two jobs, two usage
rows, possibly two computers. A worker that has both models could do both in
one job later, saving one round trip of the picture.

Watchdog: `mesh` 120 s for the whole job, and no gap over 60 s between
stages; `cutout` 60 s (both INFERRED, from a cold first run of 24 s on CPU,
`results.md` row 1).

## 2. What the worker runs

| | Rust spawns a Node sidecar running the script | `ort` in the Rust worker |
| --- | --- | --- |
| works today | yes, measured: 9.35 s at grid 256 on WebGPU | no: the script's marching cubes, colour lookup, picture resize and GLB writer are ported first |
| effort | about a day for a stdin/stdout loop around the measured code | 3 to 5 days (INFERRED), plus measuring it again |
| size of the app | unchanged, 4.2 MB (`plans/worker-app.md:128`) | grows by ONNX Runtime's library, tens of MB (INFERRED) |
| the engine on disk | Node 24 plus `onnxruntime-node` 1.31.1, 307,626,018 bytes unpacked for all platforms (`npm view`, 2026-11-14) | inside the app |
| WebGPU | measured with `onnxruntime-node` on the M1 | `ort` 2.0.0-rc.15 has a `webgpu` feature (its `Cargo.toml` on GitHub, 2026-11-14); whether its ready-made library includes it was not checked |
| CUDA | `onnxruntime-node` on Linux, not tried (`research/triposr-node.md:42`) | `cuda` feature, not tried |
| runtimes | two: Rust and Node | one |

**Decision for the first step: the Node sidecar, as a separate install like
`sd-cli`.** The numbers in `research/triposr` hold for that runtime only, and
the teacher's decision was that an engine is a separate download, not part of
our app (`plans/worker-app.md:269-272`). The app finds it at `TRIPOSR_DIR` or
`~/.visualia/pool3d/` (a folder with `pool3d.mjs`, its `node_modules`, and the
`node` to use), and offers the jobs only when it is there and runnable, as
`images_here` does for `sd-cli` (`native.rs:43-50`).

How they talk: one long-lived child process, JSON lines both ways, pictures
and GLBs as temporary files (as `sd-cli` does with `TempFile`,
`native.rs:524-530`), never on the command line:

```
worker -> sidecar  {"id":"…","kind":"mesh","in":"/tmp/visualia-3d-<id>.png","out":"/tmp/visualia-3d-<id>.glb","grid":256}
sidecar -> worker  {"id":"…","stage":"picture","seconds":2.9}
sidecar -> worker  {"id":"…","done":true,"triangles":83492,"backend":"webgpu"}
```

The sidecar's other output is thrown away. The Rust side reads the file,
removes it, sends it as base64. Cancel and timeout kill the child (`kill_on_drop`),
which frees its memory at once.

The `ort` port is the second step, once the job is used: one runtime and no
Node for IT to keep patched, which is the reason the worker became Rust in
the first place (`plans/worker-app.md:276-280`).

## 3. Model files

| file | bytes | SHA-256 (as Hugging Face's file list reports it) |
| --- | --- | --- |
| `triplane.onnx` | 937,887 | `70740d13d9c240df1f97e55c08d588fe3c930c5adbab64c2bea3d023fb07494f` |
| `triplane.onnx_data` | 3,349,149,696 | `3c9725a9279127ea7828a4aa025eb58fac9c841cd77f9d5241367613b3286cae` |
| `nerf.onnx` | 180,763 | `3800e60cff68c45d6a299154d5daa50831ca3204ee245407da500fc2a01fbe7b` |

From `https://huggingface.co/brodatech/triposr-onnx/resolve/b6bdcb9174e97beebf0a1c6bf116b51e08c04b69/<file>`,
revision `b6bdcb9174e97beebf0a1c6bf116b51e08c04b69` (the repository's head on
2026-11-14, last changed 2026-06-10). The hashes come from Hugging Face's API
(`?blobs=true`) and are checked against the downloaded files before they go
on the list. Licence MIT.

The mask model, chosen and measured in `research/triposr/results.md` (section "Ordinary photos"):

| file | bytes | SHA-256 |
| --- | --- | --- |
| BiRefNet-lite `onnx/model.onnx` (CPU) | 224,005,088 | `5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333` |
| the same, Split nodes rewritten by `research/triposr/patch-split.mjs` (WebGPU) | 224,367,448 | `cb277641c014abf753ced53e9a19fcf7e7f4614f26e5093729ef053c5b3817e3` |

From `https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/de15b22ba131738a16dff04aab8bdf8dc32e3ac1/onnx/model.onnx`.
Licence MIT (the model card's `license: mit`, upstream ZhengPeng7/BiRefNet). The
WebGPU file is made by us, so it is published from our bucket only. The
worker uses the CPU file: on the M1 WebGPU gave the same mask and no gain
(4.7 s warm either way, `results.md`).

**Where workers get them: from the pool, not from Hugging Face.** The files go
into the pool's bucket under `files/` and workers fetch `/app/files/<file>`
with the SHA-256 check that exists (`native.rs:326-369`), so a worker still
talks to one address. The 3.35 GB file is over wrangler's upload limit, so it
goes up through R2's S3 API with its hash put in by hand, as the ChilloutMix
weights did (`apps/pool-app/upscale/publish-weights.mjs:8-9`).

**On the list:** one entry `triposr` (label "Picture to 3D", `need_gb: 16`,
`gb: 3.35`) and one for the mask model. A list entry holds one `file`
(`apps/pool/src/models.js:13-15`) and TripoSR has three, so the entry gets a
`files` array, which `core::check_list` must learn (an app update).

**When:** never on the first job. Get in the app's model table, like the
upscalers and ChilloutMix: nothing downloads without a click, and Get is
refused without the size times 1.1 plus 10 GB free on disk
(`plans/worker-app.md:171-174`). Disk: 3.35 GB for TripoSR plus the mask
model, plus about 300 MB for the sidecar's `onnxruntime-node`.

## 4. One job at a time, memory, refusing

- The pool gives a worker one job at a time already (`index.js:259-268`).
  The sidecar runs one job at a time as well and says busy if asked twice.
- Measured footprint while a job runs: 5.8 GB on WebGPU (2.1 GB resident plus
  graphics buffers in unified memory), 3.2 GB on CPU (`results.md`).
- The mask model is the bigger one: 7.8 to 9.0 GB resident for one
  1024x1024 run on CPU, the same with the arena, memory patterns or graph
  optimisation off, and 10.2 GB over four warm runs (`results.md`, section
  "Ordinary photos"). So a `cutout` job refuses under 10 GB free, and a
  worker never holds both models at once: the sidecar releases one before
  loading the other, as `triposr.mjs` does (`research/triposr/triposr.mjs:184-187`).
- Before each `mesh` job the worker checks free memory with its meter
  (`mem_used_gb`, `mem_total_gb`, `native.rs:120-131`) and refuses under
  6 GB free (WebGPU) or 4 GB (CPU) with an `error` frame, "not enough free
  memory on this computer right now". The temperature rule holds too
  (`core.rs:8`, refuse above 85 °C).
- A refusal is an `error` before any stage, so the gateway answers 503 the way
  it does for "no computer online" (`apps/gateway/src/index.js:434`). No retry
  on another worker in the first step.
- A chat model loaded in Ollama and TripoSR together on a 16 GB Mac will not
  both fit (INFERRED from 5.8 GB plus 7.6 GB for Qwen 3.5 9B). The free
  memory check catches it.
- **Keeping it loaded.** Warm, a GLB takes about 7.5 s at grid 256, cold adds
  load (1.6 s) and the first WebGPU shader build (3.6 s)
  (`research/triposr-node.md:12-18`, `:36`). The teacher's rule is no
  warm-keeping (`plans/pool.md:320-321`), so the sidecar exits after
  2 minutes without a job, freeing all of it. An open question below.

## 5. Which computers qualify

| computer | `mesh` | `cutout` |
| --- | --- | --- |
| Apple Silicon, 16 GB or more, the app | yes, WebGPU on Metal, measured on the M1 | yes, on CPU, 4.7 s warm, measured on the M1 |
| Windows or Linux with a GeForce, 6 GB or more of graphics memory, the app | yes on Linux with CUDA, not tried; Windows not tried at all | yes |
| any 16 GB computer, CPU only, the app | yes, 17.1 s at grid 256, measured on the M1's CPU | yes, the same CPU run |
| a browser tab | no: 3.35 GB of fp32 weights in browser storage and graphics buffers is past what the tab models use (the largest is 6.4 GB but split in shards, INFERRED) | not yet. The model card shows Transformers.js use but claims nothing about a tab. On CPU (WebAssembly) one run needs 7.8 to 9.0 GB, past a tab's 4 GB WebAssembly memory (INFERRED from the native numbers). On WebGPU the unpatched file fails on a Split with 11 outputs (measured in Node: "Max is 10"); browsers often allow 8 storage buffers (INFERRED), so a tab would need the patched file, and its memory in a tab was not measured. A smaller model (u2netp, 320x320, Apache 2.0, INFERRED size 4.7 MB) is the tab candidate, not tried |

**How it is advertised: by the model name in `hello`, nothing new.** The
worker offers `triposr` only when the sidecar is there, the three files are
there and checked, and the computer has 16 GB or more. The pool needs nothing
else to route. Which backend ran (webgpu, cuda, cpu) goes into the app's own
job row and log, not to the pool, because the pool drops unknown usage fields
(`index.js:529-536`).

The hello limit is 8 names (`index.js:394`) and the app list's limit is 8
entries (`plans/worker-app.md:168`). The list has 6 today
(`apps/pool/src/models.js:26-38`), so these two fill it.

## 6. What the pages show

The everything-visible rule (`plans/pool.md:80-83`) asks that the asker and
the worker's owner both see the job as it runs.

- **The asker's page** (the studio): each stage as a line with its seconds,
  from the stream's `stage` events, and who is doing it (the worker's person
  id, as the usage page's "Served by"). Proposed words, for the studio's
  `text.json`:
  - "Removing the background on {person}'s computer."
  - "Making the 3D model on {person}'s computer: {stage}, {seconds} s."
  - "Done in {seconds} s. {triangles} triangles, {size}."
  - "No computer in the pool can make 3D models right now."
- **The worker's window** (the app): a row per job, as for chat and upscale
  (`native.rs:436-452`): kind `mesh` or `cutout`, model, seconds, energy, and
  the picture's size. Never the picture.
- **The usage page:** one row per job, `pool/triposr` and `pool/<mask model>`,
  $0, energy, served by.

## 7. Energy per job (INFERRED)

Not measured for TripoSR. The worker's meter will measure every job (macmon
in-process, `plans/worker-app.md:92-97`). Until then:

- Chip power under a long graphics job, from the detailed upscale on the M2:
  0.13 Wh in 22.4 s (`plans/local-images.md:195`) = 468 J / 22.4 s = about
  21 W. Take 20 W for the M1 Pro (INFERRED, a different chip).
- WebGPU, grid 256, warm: 7.5 s x 20 W = 150 J = 0.042 Wh.
- WebGPU, grid 256, first run: 9.35 s x 20 W = 187 J = 0.052 Wh.
- CPU, grid 256: 17.1 s x 20 W = 342 J = 0.095 Wh (CPU power on the M1 Pro
  under load is INFERRED to be similar).
- Idle on the M1 is 4.47 W (`plans/worker-app.md:97`), so the net share of a
  WebGPU job is about (20 - 4.5) x 9.35 = 145 J.

## 8. Privacy

- **The computer that makes the model sees the picture.** It is written to a
  temporary file and removed when the job ends, also when cancelled. Nothing
  stops its owner from copying it while it is there. The honest line, for the
  studio: "A computer in the pool sees your picture while it makes the model.
  The picture is not kept there or in the pool." It must be checked against
  the sidecar's code before it ships (writing skill: every claim is a claim
  about code).
- What is recorded: model, time, energy, served by. Never the picture or the
  GLB (the pool passes both through memory).
- **Only my computers.** A person may want a photo of themselves to go only to
  their own computer. That needs the pool to know the asker, which it does not
  today (`plans/pool.md:90`). Proposed: the job may carry `only: 'mine'`; then
  the gateway sends the asker's person id in a header for that job only, and
  `take()` picks only workers with the same `person`. Not stored. With no own
  computer online, a 503. Open question below.

## 9. When no computer can

**First step: none.** A 503 with "No computer in the pool can make 3D models
right now", as for upscaling and pictures (`plans/worker-app.md:198-199`).

Paid candidates for later, picture in, GLB out:

| service | model | price |
| --- | --- | --- |
| fal.ai | Trellis | $0.02 per generation (fal.ai/models/fal-ai/trellis, fetched 2026-11-14) |
| fal.ai | TripoSR | not checked (the page fetched 404) |
| Replicate | community TripoSR | not checked (the page fetched 404), billed by GPU seconds (INFERRED) |
| Meshy | its own API | not checked, credits per job (INFERRED) |
| Tripo | Tripo API | not checked (INFERRED) |

For Remove background only, Cloudflare Images may cut out a foreground in the
same account (INFERRED, not checked), which keeps it with Cloudflare.

## 10. Steps

| # | step | hours |
| --- | --- | --- |
| 1 | `pool3d.mjs`: `triposr.mjs` and `rmbg.mjs` as one long-lived process, JSON lines, models loaded once, stages printed, exits after 2 minutes idle | 3 |
| 2 | Put the files in R2 (S3 API), check the hashes, add `triposr` and the mask model to `models.js` with a `files` array, teach `core::check_list` and Get about `files` | 4 |
| 3 | Pool: `/cutout` and `/mesh` routes, the `stage` frame, the event stream for `mesh`, size caps, PNG-with-alpha check, add both paths to `ForGateway`'s list | 4 |
| 4 | Rust worker: `cutout` and `mesh` in `Job` and `parse_frame` (`core.rs:54-75`), spawn and keep the sidecar, temporary files, the free memory check, offer only when everything is there | 5 |
| 5 | Gateway: `/v1/cutout`, `/v1/mesh`, chaining, usage rows | 3 |
| 6 | Studio: pick a picture, make it smaller, stages and seconds, a 3D preview, save the GLB to the project | 5 |
| 7 | Remove background in a tab, if the research says it runs there | 4 |
| 8 | Test on the M1 through `wrangler dev` and live: a chair photo end to end, then failures on purpose (a file with one byte changed refused, an oversize GLB cut off, the sidecar killed mid-job, too little free memory refused) | 4 |
| | first step in all | **32** |
| later | the `ort` port, one runtime, measured again | 24 to 40 (INFERRED) |

## Open questions

1. **Warm or cold.** The teacher's no warm-keeping rule against 5 s saved per
   job. Two minutes idle is a guess.
2. **The 8-model list is full** with these two. Raise the limit in the app,
   or drop an entry?
3. **`files` array or one archive** for TripoSR's three files?
4. **Node as a separate install.** Is a folder with Node and 300 MB of
   `onnxruntime-node` acceptable to school IT, as `sd-cli` and Ollama are?
5. **Only my computers** means the asker's id reaches the pool for those jobs.
   Worth breaking "jobs carry no identity of the asker" for this?
6. **The mask model's memory.** BiRefNet-lite (MIT) cuts out cleanly but needs
   about 9 GB for one run, which keeps it off 8 GB computers and out of a
   tab. Try a smaller model for tabs (u2netp or isnet from rembg's list, both
   Apache 2.0, INFERRED), or BiRefNet at a lower input size if an export
   allows it?
7. **GLBs for the headset**: under about 1 MB needs fewer triangles, and the
   picture's side faces -Z, so a 180 degree turn
   (`research/triposr-node.md:39-41`). In the sidecar or in the studio?
8. **JPEG in** is solved: `rmbg.mjs` reads JPEG with `jpeg-js` (pure JS) and
   `triposr.mjs` uses the same reader. One open point: should a worker that
   has both models do the whole chain as one job (about 12 s warm on the M1,
   INFERRED from 4.7 s plus 7.5 s), saving a round trip of the picture?
9. **CUDA and Windows** were never tried. The VR lab's GeForce PCs are the
   strongest computers the pool could have for this.
10. **A paid fallback**, or keep the 503?
