# Records real inputs for checking the ONNX export (export.py): one TripoSplat run
# on the chair at 4 steps, on MPS, keeping what each part receives. Run beside
# VAST's TripoSplat checkout and its ckpts/ (bench.py has the setup).
#   python refs.py chair.png  ->  refs.pt
import sys
import torch
import sdpa_pieces  # noqa: F401, before the model
from triposplat import TripoSplatPipeline, _DINOV3_NORMALIZE
from torchvision import transforms
from model import OctreeProbabilityFixedlenDecoder

dev = "mps"
torch.set_grad_enabled(False)
pipe = TripoSplatPipeline(
    ckpt_path="ckpts/diffusion_models/triposplat_fp16.safetensors",
    decoder_path="ckpts/vae/triposplat_vae_decoder_fp16.safetensors",
    dinov3_path="ckpts/clip_vision/dino_v3_vit_h.safetensors",
    flux2_vae_encoder_path="ckpts/vae/flux2-vae.safetensors",
    rmbg_path="ckpts/background_removal/birefnet.safetensors", device=dev)
gen = torch.Generator(device=dev).manual_seed(42)
prepared = pipe.preprocess_image(sys.argv[1])
img = transforms.ToTensor()(prepared).unsqueeze(0)  # [1,3,1024,1024], 0..1
cond = pipe.encode_image(prepared, generator=gen)
flow = pipe.flow_model
x0 = {"latent": torch.randn(1, flow.q_token_length, flow.in_channels, device=dev, generator=gen),
      "camera": torch.randn(1, 1, flow.cam_channels, device=dev, generator=gen)}
out = pipe.sample_latent(cond, steps=4, guidance_scale=3.0, shift=3.0, generator=gen)
latent = out["latent"]
points = OctreeProbabilityFixedlenDecoder.sample(pipe.decoder.octree, latent, num_points=8192, level=8)["points"]
cpu = lambda d: {k: v.detach().float().cpu() for k, v in d.items()}
torch.save({
    "image": img, "dino_in": _DINOV3_NORMALIZE(img), "vae_in": img * 2 - 1,
    "feature1": cond["feature1"].float().cpu(), "feature2": cond["feature2"].float().cpu(),
    "x0": cpu(x0), "latent": latent.float().cpu(), "points": points.float().cpu(),
}, "refs.pt")
print("refs.pt", {k: tuple(v.shape) for k, v in cond.items()}, tuple(latent.shape), tuple(points.shape))
