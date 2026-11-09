# dalle-mini

DALL·E mini (2022, text to a 256 × 256 picture) without PyTorch: min-dalle's
ONNX export run by ONNX Runtime Web on WebGPU in a browser tab. Code only, not
run yet. Background: `research/early-imagegen.md` (section 4).

| Part | Source | Licence |
| --- | --- | --- |
| Models | [StuartGray/min-dalle-onnx](https://huggingface.co/StuartGray/min-dalle-onnx), commit `122d1fd` | Apache-2.0 |
| Reference code | [kuprel/min-dalle](https://github.com/kuprel/min-dalle) (`min_dalle.py`, `text_tokenizer.py`, `models/`) | MIT |
| Runtime | [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) 1.31.1 from cdn.jsdelivr.net | MIT |

## Run

```sh
cd apps/pool-app/dalle-mini
./fetch.sh                     # 1.06 GB into models/, checks SHA-256
python3 -m http.server 8000    # then open http://localhost:8000/
```

WebGPU needs `localhost` or https. Each Draw downloads the three models again
(no cache yet) and loads them one at a time, freeing each before the next.

## Files

| File | What it is |
| --- | --- |
| `tokenizer.js` | min-dalle's BPE tokenizer and the `[2, 64]` text input. Matches all 5 of the repo's `test_vectors.json` (checked with Node, 2026-11-09). |
| `run.js` | Encoder, 256-step decoder loop with the KV cache on the GPU, top-k sampling, detokenizer, PNG. |
| `index.html` | Text, seed, Draw, the picture and Save PNG. Spike page: words are inline, not in a `text.json`. |
| `fetch.sh` | Downloads into `models/` (gitignored) and copies `visualia.css` in. |

## The three models

Read from the files themselves (graph inputs and outputs from range requests
on the ONNX files, 2026-11-09); `manifest.json` in the repo says the same.
Opset 17, exported by PyTorch 2.14.1, weights inside each file.

| File | Size | Inputs | Outputs |
| --- | --- | --- | --- |
| `encoder_fp16.onnx` | 405 MB | `text_tokens` int64 [2, 64] | `encoder_state` float16 [2, 64, 1024] |
| `decoder_step_fp16.onnx` | 471 MB | `text_tokens` int64 [2, 64], `encoder_state` float16 [2, 64, 1024], `prev_tokens` int64 [1, 1], `token_index` int64 [1], `cache_0` … `cache_11` float16 [4, 256, 1024] | `logits` float32 [2, 16384], `new_cache_0` … `new_cache_11` float16 [4, 256, 1024] |
| `detokenizer_fp32.onnx` | 187 MB | `tokens` int64 [1, 256] | `image` float32 [1, 256, 256, 3], RGB 0..255 |

The mini model: 12 layers, 1024 wide, 16 heads, text vocabulary 50264, image
vocabulary 16384. Batch is 2 throughout: row 0 is the empty prompt, row 1 the
prompt.

## Tokenizer

`vocab.json` (50264 entries, `<s>` 0, `<pad>` 1, `</s>` 2, `<unk>` 3) and
`merges.txt` (header line `#version: 0.2`). min-dalle's algorithm:

1. Emoji become their names (`emoji.demojize`). **We drop them instead**, so
   a prompt with emoji tokenizes differently.
2. Lowercase, then drop every non-ASCII character (`café` becomes `caf`).
3. Split on single spaces only, skip empty words.
4. Each word starts as `Ġ` (U+0120, the space marker) followed by its
   characters. Repeat: of all neighbouring pairs, take the one with the lowest
   merge rank (the first one if it appears twice), join only that one; stop
   when no pair is in `merges.txt`. This is not standard BPE, which joins every
   copy of the pair at once.
5. Look each piece up in `vocab.json`, `<unk>` if missing (so `:)` gives 3, 3).
6. `[<s>, …, </s>]`, cut to 64 (a long prompt loses its `</s>`, as in min-dalle).
7. Merges load as `split("\n")[1:-1]`: header and last line dropped.

Encoder input: row 1 = the tokens padded with 1; row 0 = first and last token
(`<s>`, `</s>`) padded with 1, the unconditional prompt.

## The loop

Per step `i` from 0 to 255:

- `prev_tokens` = the token from step `i - 1` (16383, the start token, at step 0).
- `token_index` = `i` (position embedding and causal mask).
- `cache_l` = `new_cache_l` from the step before; all zeros at step 0. Each
  cache holds keys (rows 0, 1) and values (rows 2, 3) for 256 positions; the
  graph writes position `i` with `Where(positions == token_index)`.
- `text_tokens` and `encoder_state` are the same every step.

Sampling (min-dalle `sample_tokens`, defaults temperature 1, top-k 256,
supercondition factor 16):

```
mixed = logits[0] * (1 - f) + logits[1] * f
keep  = mixed >= k-th largest of mixed
p     = exp((mixed - max) / temperature) where kept, else 0
token = draw one from p
```

The draw uses mulberry32 seeded from the page, so a seed repeats a picture here
but never matches min-dalle's torch seeds. ONNX Runtime keeps the twelve
`new_cache_*` outputs on the GPU (`preferredOutputLocation: "gpu-buffer"`) and
they go straight back in, so only the 128 KB of logits cross to JavaScript
each step.

## Tokens to picture

The 256 tokens are a 16 × 16 grid in row order. The detokenizer (VQGAN
decoder) looks each up in a 16384 × 256 codebook, a 1 × 1 conv, then
upsampling conv blocks (4 nearest-neighbour Resizes, 16 to 256 pixels) with
GroupNorm (exported as InstanceNormalization + Reshape) and swish, clamps to
0..1 and multiplies by 255. Output is NHWC, so it goes into canvas pixels
without a transpose.

## Runtime: why a tab

| Option | Verdict |
| --- | --- |
| **ONNX Runtime Web, WebGPU** | Chosen. Runs inside Chrome, so no new program for ThreatLocker to stop. WebGPU has fp16 (`shader-f16`), the cache stays on the GPU, and pool tabs already run models this way. Wasm memory cap (4 GB) is not reached: the largest file is 471 MB and only one is loaded at a time. |
| onnxruntime-node 1.31.1 | Ships native prebuilt binaries (a `.node` addon and `libonnxruntime` dylib) plus an install script. Same risk as esbuild 0.28.2 and new workerd, which ThreatLocker kills here (exit 137). Not tried. |
| Burn (burn-onnx 0.22.0) | Later, for the pool app. Every op in the three files is on burn-onnx 0.22.0's supported list (below), but it needs a Rust build, which ThreatLocker blocks on this Mac. |

### Burn import notes

Ops in the files (counts from the graphs):

- Encoder (553 nodes): Add, Cast, Constant, Div, Equal, Erf, Gather,
  Identity, LayerNormalization, MatMul, Mul, Not, Reshape, Softmax,
  Transpose, Unsqueeze, Where.
- Decoder (1067): the encoder's plus Concat, ConstantOfShape, Expand,
  LessOrEqual, Slice, Tile.
- Detokenizer (582): Add, Cast, Constant, Conv, Div, Gather,
  InstanceNormalization, MatMul, Max, Min, Mul, Reshape, Resize (nearest,
  asymmetric, floor), Shape, Sigmoid, Softmax, Transpose.

All are ✅ in burn-onnx v0.22.0's
[SUPPORTED-ONNX-OPS.md](https://github.com/tracel-ai/burn-onnx/blob/v0.22.0/SUPPORTED-ONNX-OPS.md).
Multinomial is ❌ in 0.22.0 (✅ only on `main`), so sampling would be in Rust,
which it should be anyway. Untested risks:

- Mixed precision: fp16 weights and `Cast` to float16 and back inside
  one graph, on a backend with one float type.
- 471 MB of weights in one generated model; build time and `.bpk` size.
- Where-based cache update copies 12 × 2 MB per step (fine on a GPU, but
  every step allocates new caches unless Burn reuses buffers).

## Open questions

- Not run: speed on the M1/M2, and whether ORT Web's WebGPU kernels cover
  every fp16 op here (any it lacks fall back to the CPU, slowly).
- Caching the 1.06 GB in the browser (Cache API or OPFS) and a progressive
  preview every 32 steps, as min-dalle offers.
