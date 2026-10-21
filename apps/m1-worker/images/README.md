# m1-worker/images

How fast and how costly image models are on the M1 (M1 Pro, 16 GB). Measuring
only: nothing here is wired to the gateway. Results and what they mean:
`plans/local-images.md`.

## On the M1

Everything lives in `~/visualia-worker/images/`, apart from the existing worker:

| Path | What |
|---|---|
| `.venv/` | Python 3.14 (Homebrew) venv made with `uv`: `mflux==0.23.0`, `mlx==0.32.4`, `pillow==12.3.0` (13.0.0 breaks mflux's import). Full pin list: `requirements.lock.txt` |
| `hf/` | Hugging Face cache (`HF_HOME`) with the pre-quantized `mflux-community/*` weights |
| `gen.py`, `bench.mjs`, `download.py` | copies of the files in this folder |
| `out/<model>/` | generated images (never in git) |
| `results/<model>.json` | per-model numbers |
| `logs/` | download and bench logs |

## Setup

```sh
scp gen.py bench.mjs download.py requirements.lock.txt mbp:visualia-worker/images/
ssh mbp 'cd ~/visualia-worker/images && uv venv --python /opt/homebrew/bin/python3.14 .venv \
  && uv pip install --python .venv/bin/python -r requirements.lock.txt \
  && .venv/bin/python download.py flux2-klein-4b-mflux-q8 z-image-turbo-mflux-q6 ernie-image-turbo-mflux-q4'
```

## Run

```sh
ssh mbp 'cd ~/visualia-worker/images && nohup /opt/homebrew/bin/node bench.mjs flux2-klein-4b-q8 > logs/bench.log 2>&1 &'
scp -r mbp:visualia-worker/images/out <somewhere outside git>
```

`bench.mjs` runs one model at a time. Before each it waits until `ollama ps`
is empty and the GPU has been idle for 15 s (that window is the idle baseline),
then starts `gen.py`, which loads the model once and makes seven images: one
cold 512² poster, then three prompts at 512² and three at 1024² (seed 42). The
Python process exits after the last image, which frees the memory.

Energy uses the same method as `../proxy.mjs`: macmon every 250 ms, chip power =
`all_power + ram_power + gpu_ram_power`, net = chip energy minus idle power ×
time. Memory: MLX's own peak per image, and macmon's whole-machine RAM and swap.
