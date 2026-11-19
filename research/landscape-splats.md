# Landscape splats: real 3D Gaussian splats from one generated landscape

2026-11-16. Desk research for the drift room (`plans/drift-room.md`). There, a landscape is a 2.5D sheet: one splat per
pixel, lifted along a depth map. It looks right from the front and falls apart when you turn. The question here: how do
we get a real 3DGS scene from ONE picture, one we can orbit a little? Nothing was downloaded or run. No credits were
spent.

**READ** means I opened the page, repo, model card or Hugging Face API and it says so. **INFERRED** means reasoned from
that. **UNVERIFIED** means a search snippet or third-party page said it and I did not check the source.

## Verdict

**Try Apple's SHARP first, on the 32 GB M2 Pro.** It is the only one-picture-to-scene model here that predicts on MPS.
It is one 2.8 GB checkpoint, one forward pass, and it writes a standard 3DGS `.ply` that Spark can load. It gives
"nearby views", which is what "orbit a bit" means. Its catch is the licence: research only, no commercial use.

**Fallback, open and local: the video route.** Picture → a short orbit video from a catalog video model → frames →
camera poses with COLMAP 4 (global mapper, Homebrew) → Brush trains the splats. All open (BSD, Apache-2.0), all on a Mac.
It costs a few cents to a dollar per landscape and maybe half an hour. Its risk: a generated video is not quite
3D-consistent, and SfM may fail on it.

**Paid fallback: World Labs Marble API.** About $1.26 per world from one picture, PLY export free. Best for wide
landscapes. Not local, and the world is theirs to draw.

The rest are CUDA-only (FlashWorld, Lyra 2, GEN3C), excluded in the EU (WorldMirror), not released (Wonderland), or for
objects (Tripo).

## One picture to a splat scene

| Model | Licence | Weights | Apple Silicon | Time per scene | Output | Wide landscapes | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [SHARP](https://github.com/apple/ml-sharp) (Apple) | Code BSD; weights Apple AMLR, research only, no commercial use | 2.81 GB, one `.pt` | **Yes**: predict runs on CPU, CUDA and MPS; `--render` video needs CUDA | "less than a second on a standard GPU"; M-series not measured | 3DGS `.ply`, OpenCV axes, metric scale | Nearby views only; it does not invent unseen parts | Free, local |
| [FlashWorld](https://github.com/imlixinyang/FlashWorld) | Code Apache-2.0; **weights CC BY-NC-SA 4.0** | 20.94 GB | No: CUDA; 9 GB VRAM with all offload flags, 51 GB without | 7 s on an A100, 4 s on an H100 | `.ply`, `.spz`, video | Made for scenes, image or text in | Free, needs an NVIDIA box |
| [Lyra 2.0](https://github.com/nv-tlabs/lyra) (NVIDIA) | Code Apache-2.0; weights "NVIDIA Internal Scientific Research and Development Model License" | 98 GB in the repo (14B on Wan-14B, a 13 GB recon model, an 11 GB text encoder) | No: H100, GB200 | Not stated | 3DGS `.ply` | Explorable worlds, the strongest here on paper | Data-centre GPUs |
| [GEN3C](https://github.com/nv-tlabs/GEN3C) (NVIDIA) | Code Apache-2.0; weights NVIDIA Open Model License | 28.95 GB | No: tested on H100, A100; about 43 GB with full offload | Not stated | **Video only**; Lyra turns it into 3DGS | Camera-controlled video | Data-centre GPUs |
| [HunyuanWorld-Mirror](https://github.com/Tencent-Hunyuan/HunyuanWorld-Mirror) (WorldMirror) | Tencent licence; **"Territory" excludes the EU, UK and South Korea** | 5.05 GB | CPU fallback, CUDA preferred; MPS not mentioned | Feed-forward, not stated | 3DGS, points, depth, normals, camera poses, COLMAP export | Takes several pictures or a video, not really one picture | Out for an Estonian school |
| [Wonderland](https://snap-research.github.io/wonderland/) (Snap) | No code or weights linked on the project page | — | — | — | 3DGS from video latents (CogVideoX-5B-I2V) | Paper only | — |
| [World Labs Marble API](https://docs.worldlabs.ai/api/pricing) | Paid service | — | Runs in their cloud | Not checked | PLY splats (export free), GLB mesh 3,500 credits | Made for whole worlds, 360° | 1,580 credits ($1.26) per picture; draft 230 ($0.18); $1 = 1,250 credits, $5 minimum |
| [Tripo image to splat](https://developers.tripo3d.ai/en/docs/generation-image-to-splat) / TripoSplat | API paid; TripoSplat MIT | 4.4 GB (we run it) | Yes, our ONNX port | About 4 min (API); 202 s on our M1 | `.splat` | **Objects**, not scenes | 30 credits per call; USD not stated |

Sources, all READ unless noted:

- SHARP: repo README (licence files, MPS line, `.ply` and OpenCV axes, `-c` flag), `LICENSE_MODEL` ("Research Purposes"
  only), Hugging Face API for `apple/Sharp` (2.81 GB). Its limits (no unseen parts; reflective and featureless surfaces)
  are from press coverage, UNVERIFIED.
- FlashWorld: repo README (VRAM, times, formats) and the Hugging Face API (`cc-by-nc-sa-4.0`, 20.94 GB). The README says
  Apache-2.0; that is the code.
- Lyra 2.0: repo README and the `nvidia/Lyra-2.0` model card (licence, 14B, Wan-14B, H100, `.ply`); size from the
  Hugging Face API.
- GEN3C: repo README; size from the Hugging Face API.
- WorldMirror: repo README; territory clause quoted from `License.txt`; size from the Hugging Face API.
- Wonderland: the project page links only the arXiv paper. Snap may have released code elsewhere; UNVERIFIED.
- Marble: `docs.worldlabs.ai/api/pricing`. Quality on landscapes: INFERRED from what it is built for.
- Tripo: the developers page. The scene line is INFERRED from TripoSplat being an object model.

## The video route: picture → orbit video → poses → Brush

### 1. Orbit video from the Cloudflare catalog

From Cloudflare's docs (READ, `developers.cloudflare.com/ai/models/...`). The gateway does not list these yet (no video
entries in `apps/gateway/src/prices.js`).

| Model id | Input | Price | Note |
| --- | --- | --- | --- |
| `alibaba/wan-2.7-i2v` | picture + prompt | $0.10/s at 720p, $0.15/s at 1080p | 2 to 15 s; example prompt is a camera push-in |
| `pruna/p-video` | text, picture, audio | $0.02/s at 720p; draft $0.005/s | up to 20 s, 24 or 48 fps; cheapest |
| `xai/grok-imagine-video-1.5-preview` | picture + prompt | $0.08/s at 480p, $0.14/s at 720p | |
| `alibaba/hh1-i2v` | picture + prompt | $0.28/s at 720p | 3 to 15 s |
| `klingai/kling-v4` | text, up to 10 keyframes | $0.157/s at 720p | keyframes could pin the start and end view |
| `bytedance/seedance-2.5` | text, up to 30 reference pictures | not shown | first and last frame |

None has a camera-path input that I saw. The orbit is asked for in the prompt ("slow orbit to the left around the
centre, camera height fixed, no people, nothing moves"). A 5 s clip is $0.10 (P-Video) to $0.50 (Wan 2.7). INFERRED:
the scene must stay still (no wind, no water, no clouds moving), or SfM and Brush see ghosts.

### 2. Camera poses on a Mac

| Tool | Licence | Weights | Apple Silicon | Note |
| --- | --- | --- | --- | --- |
| [COLMAP](https://colmap.github.io/changelog.html) 4.x, global mapper (was GLOMAP) | BSD | none | **Yes**: Homebrew bottle `colmap` 4.2.1 (READ, `brew info`); runs on CPU | Global mapper since 4.0.0 (2026-03-14): `colmap global_mapper` or `automatic_reconstructor --mapper GLOBAL`. [GLOMAP](https://github.com/colmap/glomap) itself is archived. Classical: needs texture and overlap; may fail on sky, water, fog |
| [VGGT](https://github.com/facebookresearch/vggt) (Meta) | Code allows commercial use (not military); `VGGT-1B` weights CC BY-NC 4.0; `VGGT-1B-Commercial` gated, manual approval | 5.03 GB | Official: CUDA; MPS not mentioned. A community port, [vggt-mps](https://github.com/jmanhype/vggt-mps), says M1 to M3, 8 GB+, fp32 (UNVERIFIED) | Learned poses in seconds, more forgiving on generated video (INFERRED); `demo_colmap.py` writes COLMAP files, with optional bundle adjustment |
| [MASt3R](https://github.com/naver/mast3r) / MASt3R-SfM (Naver) | **CC BY-NC-SA 4.0**, code too | 2.75 GB | Install asks for CUDA 12.1; MPS not mentioned | `demo_glomap.py` "not extensively tested" |

### 3. Brush trains the splats

[Brush](https://github.com/ArthurBrussee/brush), Apache-2.0, Rust, WebGPU. Latest release v0.3.0 (2025-09-14) ships a
macOS arm64 app (`brush-app-aarch64-apple-darwin.tar.xz`); it trains with MCMC splatting. It takes COLMAP or Nerfstudio
data and has no pose estimation of its own (all READ). Time on an M2 Pro: not measured; INFERRED 10 to 30 min for a few
thousand steps at 720p.

Note: `brew install brush` is a different thing (a shell). Take the GitHub release.

## Recommendation

### First: SHARP on the 32 GB M2 Pro

Why the M2 Pro: more memory, and the M1 is unreachable now (`plans/drift-room.md`). A 2.8 GB model should also fit on
the 16 GB M1 Pro; not measured.

1. `git clone https://github.com/apple/ml-sharp` (outside the repo, e.g. `~/personal/sharp`).
2. `conda create -n sharp python=3.13 && conda activate sharp && pip install -r requirements.txt` (README).
3. Download `sharp_2572gikvuh.pt` (2.81 GB) from Hugging Face `apple/Sharp`, or let the first run fetch it to
   `~/.cache/torch/hub/checkpoints/`.
4. Put two or three drift-room landscapes in a folder (the bog, the alvar, the template field from
   `evals/estonian-visuals/out/drift-room/`).
5. `sharp predict -i landscapes/ -o splats/ -c sharp_2572gikvuh.pt`. Do not pass `--render` (CUDA only). Check it picks
   MPS; how to force the device was not in the README.
6. Load each `.ply` in Spark 2.4 (`evals/estonian-visuals/out/drift-room/lib/`). Flip y (OpenCV is y down) and move the
   scene centre, about (0, 0, +z), to the origin (README).
7. Measure: time per picture, splat count, file size, and how far the camera turns before the far field tears. Compare
   with the 2.5D sheet of the same picture.

Licence check before any student sees it: AMLR allows "non-commercial scientific research and academic development".
INFERRED: an EKA course demo is arguable, not clearly covered. Ask before shipping it in the room.

### Fallback A: video route, all open, on the Mac

1. Wan 2.7 i2v (or P-Video draft for cheap tries) with the landscape and a slow-orbit prompt, 5 s, 720p, through our
   gateway once it has video. About $0.10 to $0.50.
2. `ffmpeg -i orbit.mp4 -vf fps=6 frames/%04d.png` (about 30 frames).
3. `brew install colmap` (4.2.1), then `colmap automatic_reconstructor --workspace_path ws --image_path frames
   --mapper GLOBAL`. If it fails on the generated frames, try VGGT through `vggt-mps` and `demo_colmap.py`
   (non-commercial weights unless the commercial ones are granted).
4. Download the Brush 0.3.0 macOS app from GitHub releases. Open the COLMAP folder and train. Export `.ply`.
5. Load in Spark as above.

### Fallback B: Marble API

One picture in, about $1.26, PLY out. Use it as the quality bar for the other two, once credits are allowed.

### Skip for now

FlashWorld (non-commercial weights, CUDA). Lyra 2 and GEN3C (H100 class). WorldMirror (EU excluded). Wonderland (no
code found). If the school GPU box (RTX 5090, `research/local-multimodal.md`) is ever bought, FlashWorld fits in its
32 GB, but its weights stay non-commercial.
