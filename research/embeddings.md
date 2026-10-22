# Embeddings for grouping works (measured 2026-10-22)

Can a local embedding model tell which class works belong together, with
Estonian and English mixed, and what does it cost? Measured on the M1 Pro
(16 GB, Ollama 0.40.5, macmon energy), compared with the same models on
Workers AI. Script and test set: `evals/embeddings/` (`bench.mjs`,
`briefs.json`, raw rows in `results-2026-10-22-m1.jsonl`).

**Test set**: 40 short briefs written like student requests, 8 themes × 5
(poster, p5 sketch, sound toy, portfolio, chart, game, typography, photo
gallery), 20 Estonian and 20 English, written separately, not translated.
Some themes overlap on purpose (poster and typography; gallery and portfolio).

**Scores**
- **NN**: the nearest other brief has the same theme.
- **Top 4**: share of the 4 nearest briefs with the same theme (4 is the most
  possible).
- **Cross-language**: the nearest brief *in the other language* has the same
  theme.

With 40 briefs, one brief is 2.5 points: read differences under ~8 points as
noise.

## Results

Speed is for batches of 64. Energy is chip energy per 100 texts (CPU, GPU and
memory, from macmon). Short means one-sentence briefs (~30 tokens); long
means ~500-character page descriptions (~140 tokens). Quality uses the best
prompt for each model (see the notes).

| Model | Ollama tag | Size | Dims | Cold load | One text | Texts/s short · long | J/100 short · long | NN | Top 4 | Cross-lang |
|---|---|---|---|---|---|---|---|---|---|---|
| **BGE-M3** | `bge-m3` | 1.2 GB | 1024 | 1.9 s | 31 ms | 43 · 22 | 42 · 83 | **85%** | **57%** | **88%** |
| Arctic Embed 2 | `snowflake-arctic-embed2` | 1.2 GB | 1024 | 1.9 s | 31 ms | 43 · 22 | 43 · 84 | 75% | 50% | 80% |
| Nomic Embed v2 MoE | `nomic-embed-text-v2-moe` | 957 MB | 768 | 1.7 s | 36 ms | 34 · 42 | 51 · 45 | 68% | 53% | 75% |
| Qwen3-Embedding 0.6B | `qwen3-embedding:0.6b` | 639 MB | 1024 | 2.5 s | 39 ms | 37 · 15 | 56 · 121 | 70% | 36% | 58% |
| EmbeddingGemma 300M | `embeddinggemma` | 621 MB | 768 | 1.2 s | 34 ms | 49 · 44 | 22 · 44 | 65% | 41% | 75% |
| Granite Embedding 278M | `granite-embedding:278m` | 562 MB | 768 | 1.8 s | 19 ms | 64 · 50 | 20 · 33 | 63% | 39% | 65% |

On Workers AI (quality only), the same models scored the same as on the M1:
`@cf/baai/bge-m3` 85 / 56 / 88, `@cf/google/embeddinggemma-300m` 63 / 46 / 78,
`@cf/qwen/qwen3-embedding-0.6b` 68 / 36 / 63.

**Notes**
- **Prompts matter, and not always in the documented direction.**
  - EmbeddingGemma's clustering prompt (`task: clustering | query: `) made it
    worse: 48 / 26 / 68, against 63 / 46 / 75 with no prompt. Its document
    prompt (`title: none | text: `) scored 65 / 41 / 75.
  - Nomic was better without its `search_document: ` prefix (68 / 53 / 75
    against 65 / 46 / 78).
  - Qwen3 was about the same with or without its instruction.
  - BGE-M3, Arctic and Granite take no prompt.
- **Batching gains little.** Ollama embeds the texts of a batch one after
  another here (`OLLAMA_NUM_PARALLEL=1`): 64 texts are 1.3–1.8× faster than
  one at a time, not 64×.
- **Cost at class scale is negligible.** 300 works with BGE-M3: ~14 s and
  ~250 J of chip energy (~0.07 Wh), once. After that, one new work is ~30 ms.
- **The same model in two places.** BGE-M3 and Arctic Embed 2 share an
  architecture (XLM-R large, 568M), so their speed and energy are identical.
- **EmbeddingGemma 2** (text and images in one space) is not in Ollama's
  library (`embeddinggemma2`: no manifest). Only its ONNX build exists
  (`browser-models.md`).
- **Not measured:**
  - Granite's 97M multilingual r2 and multilingual-e5-small: they aren't in
    the Ollama library under those names; they're the in-tab candidates in
    `browser-models.md`.
  - The M2.
  - Pictures.

## Recommendation for the board

- **Group works with BGE-M3**, on the pool (the M1 as `pool/bge-m3`, which
  needs an embeddings job kind like `decide`) with **Workers AI
  `@cf/baai/bge-m3` as the fallback**.
  - It is clearly the best at grouping, and the best across Estonian and
    English: 88% of Estonian briefs find their English counterpart's theme.
  - It is the same model in both places, so vectors from the M1 and from the
    cloud can be compared with each other. The fallback stays invisible, and
    a work never needs to be embedded twice. No other candidate gives that
    combination at this quality.
- **What to embed**: the work's title plus its brief history (the "What the
  student asked" list the check already builds), not the HTML.
- **Use the vectors to suggest, not to sort**:
  - "Put with…" proposes the nearest group.
  - "Similar works" shows the 3–4 nearest.
  - Top 4 at 57% means the second to fourth neighbours are often from a nearby
    theme, so people decide.
- **In the browser**: if grouping should work with no pool and no cloud,
  EmbeddingGemma or granite-97m in Transformers.js is the small option. It is
  clearly weaker, and its vectors don't mix with BGE-M3's.
