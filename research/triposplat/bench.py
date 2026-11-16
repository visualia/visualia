# Times TripoSplat (VAST, MIT) natively on this Mac: MPS, the release precisions
# (bf16 DINOv3 + VAE, fp16 DiT + decoder). Usage: python bench.py <image> <steps>...
import sys, time, json, torch
import sdpa_pieces  # noqa: F401, before the model
from triposplat import TripoSplatPipeline
dev = "mps" if torch.backends.mps.is_available() else "cpu"
sync = (lambda: torch.mps.synchronize()) if dev == "mps" else (lambda: None)
t = time.time()
pipe = TripoSplatPipeline(
    ckpt_path="ckpts/diffusion_models/triposplat_fp16.safetensors",
    decoder_path="ckpts/vae/triposplat_vae_decoder_fp16.safetensors",
    dinov3_path="ckpts/clip_vision/dino_v3_vit_h.safetensors",
    flux2_vae_encoder_path="ckpts/vae/flux2-vae.safetensors",
    rmbg_path="ckpts/background_removal/birefnet.safetensors", device=dev)
sync(); print(json.dumps({"device": dev, "torch": torch.__version__, "load_s": round(time.time() - t, 1)}), flush=True)
img = sys.argv[1]
for steps in map(int, sys.argv[2:]):
    gen = torch.Generator(device=dev).manual_seed(42)
    r = {"image": img, "steps": steps}
    print("stage prep", flush=True)
    t = time.time(); prepared = pipe.preprocess_image(img); sync(); r["prep_s"] = round(time.time() - t, 1)
    print("stage encode", flush=True)
    t = time.time(); cond = pipe.encode_image(prepared, generator=gen); sync(); r["encode_s"] = round(time.time() - t, 1)
    print("stage sample", flush=True)
    t = time.time(); out = pipe.sample_latent(cond, steps=steps, guidance_scale=3.0, shift=3.0, generator=gen); sync(); r["sample_s"] = round(time.time() - t, 1)
    print("stage decode", flush=True)
    t = time.time(); g = pipe.decode_latent(out["latent"], num_gaussians=262144); sync(); r["decode_s"] = round(time.time() - t, 1)
    name = img.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    g.save_ply(f"out-{name}-{steps}.ply"); prepared.save(f"out-{name}-prepared.png")
    r["total_s"] = round(r["prep_s"] + r["encode_s"] + r["sample_s"] + r["decode_s"], 1)
    r["peak_gb"] = round(torch.mps.driver_allocated_memory() / 1e9, 1) if dev == "mps" else None
    print(json.dumps(r), flush=True)
