# One-time export of ChilloutMix (a Stable Diffusion 1.5 fine-tune) to three
# fp16 ONNX files for ONNX Runtime Web: text encoder, UNet, VAE decoder.
# The only step that needs PyTorch; the page runs them on WebGPU.
#
# Run on the M1 (CPU only), from a folder holding this file:
#
#   nice -n 20 uv run --python 3.11 --with torch==2.5.1 --with diffusers==0.31.0 \
#     --with transformers==4.46.3 --with accelerate==1.1.1 --with safetensors==0.4.5 \
#     --with huggingface_hub==0.26.2 --with onnx==1.17.0 --with onnxruntime==1.20.1 \
#     --with numpy==1.26.4 export.py ~/visualia-build/sd-models/chilloutmix_NiPrunedFp16Fix.safetensors [part]
#
# part is text, unet, vae, tokenizer or all (default). One part per run keeps
# memory down: the fp32 UNet alone is 3.4 GB.
#
# Writes models/text_encoder.onnx, unet.onnx, vae_decoder.onnx, vocab.json,
# merges.txt and tokenizer_tests.json. Shapes are fixed (batch 2 for the
# prompt and the negative prompt, 512 x 512) so WebGPU needs no guessing.
# Inputs and outputs stay float32; the weights and the maths inside are
# float16, like Microsoft's sd-turbo-ort-web. The text encoder and VAE are
# exported in fp32 (checked against PyTorch) and converted; the UNet is
# traced in fp16 directly (see export()).
#
# The UNet takes the 320-wide sinusoidal time embedding as an input (`temb`)
# instead of the timestep: the page computes it in float64. Inside an fp16
# graph, sin(999 * f) would lose its phase (fp16 steps are 0.5 at 999).
import gc
import json
import os
import sys

import numpy as np
import onnx
import torch
from onnxruntime.transformers.float16 import convert_float_to_float16

SRC = os.path.expanduser(sys.argv[1])
PART = sys.argv[2] if len(sys.argv) > 2 else "all"
OUT = "models"
TMP = os.path.join(OUT, "fp32")
os.makedirs(TMP, exist_ok=True)
torch.set_grad_enabled(False)


def load():
    from diffusers import StableDiffusionPipeline
    from diffusers.models.attention_processor import AttnProcessor2_0

    pipe = StableDiffusionPipeline.from_single_file(
        SRC, torch_dtype=torch.float32, safety_checker=None, requires_safety_checker=False,
        config="stable-diffusion-v1-5/stable-diffusion-v1-5",
    )
    # SDPA exports as MatMul, Softmax, MatMul. The older AttnProcessor uses
    # baddbmm on an empty tensor, which the exporter folds into a constant of
    # the full attention size (536 MB per layer at 4096 tokens in fp16).
    pipe.unet.set_attn_processor(AttnProcessor2_0())
    pipe.vae.set_attn_processor(AttnProcessor2_0())
    return pipe


def export(module, args, names, outs, name, half=False):
    if half:
        # Traced in fp16 already: 1.7 GB, so one file under protobuf's 2 GiB
        # limit, no external data, and no 3.4 GB fp32 copy in memory.
        path16 = os.path.join(OUT, name)
        torch.onnx.export(module, args, path16, input_names=names, output_names=outs,
                          opset_version=17, do_constant_folding=True)
        print(path16, os.path.getsize(path16) // 1_000_000, "MB", flush=True)
        return path16
    path32 = os.path.join(TMP, name)
    torch.onnx.export(module, args, path32, input_names=names, output_names=outs,
                      opset_version=17, do_constant_folding=True)
    gc.collect()
    model = onnx.load(path32)  # loads external data too
    model16 = convert_float_to_float16(model, keep_io_types=True)
    del model
    gc.collect()
    path16 = os.path.join(OUT, name)
    onnx.save(model16, path16)
    print(path16, os.path.getsize(path16) // 1_000_000, "MB", flush=True)
    return path32


def check(path32, feeds, want):
    # The fp32 export against PyTorch on the CPU (the fp16 file is checked in the tab).
    import onnxruntime as ort
    so = ort.SessionOptions()
    so.intra_op_num_threads = 2
    got = ort.InferenceSession(path32, so, providers=["CPUExecutionProvider"]).run(None, feeds)[0]
    print("  max |onnx - torch| =", float(np.abs(got - want).max()), "of", float(np.abs(want).max()), flush=True)


class TextEncoder(torch.nn.Module):
    def __init__(self, te):
        super().__init__()
        self.te = te

    def forward(self, input_ids):
        return self.te(input_ids, return_dict=False)[0]


class Unet(torch.nn.Module):
    def __init__(self, unet):
        super().__init__()
        self.unet = unet
        # diffusers 0.31: forward() calls get_time_embed(sample, timestep), then
        # time_embedding (two Linear layers). Skip the sinusoid; temb is it.
        unet.get_time_embed = lambda sample, timestep: timestep

    def forward(self, sample, temb, encoder_hidden_states):
        # float32 in and out, float16 inside (the weights are cast before export).
        h = self.unet.dtype
        return self.unet(sample.to(h), temb.to(h), encoder_hidden_states.to(h), return_dict=False)[0].float()


class VaeDecoder(torch.nn.Module):
    def __init__(self, vae):
        super().__init__()
        self.vae = vae

    def forward(self, latent):
        # Latent as the sampler leaves it; picture as RGB 0..1.
        x = self.vae.decode(latent / 0.18215, return_dict=False)[0]
        return ((x + 1) / 2).clamp(0, 1)


def sinusoid(t):
    # Timesteps(320, flip_sin_to_cos=True, downscale_freq_shift=0)
    half = 160
    f = np.exp(-np.log(10000) * np.arange(half) / half)
    a = t * f
    return np.concatenate([np.cos(a), np.sin(a)]).astype(np.float32)


pipe = load()

if PART in ("tokenizer", "all"):
    pipe.tokenizer.save_pretrained(os.path.join(TMP, "tokenizer"))
    for f in ("vocab.json", "merges.txt"):
        os.replace(os.path.join(TMP, "tokenizer", f), os.path.join(OUT, f))
    tests = ["a photo of a cat", "", "Tallinn's old town at night, 8k, RAW photo!!",
             "nsfw, nude, naked", "a  lighthouse\non a rock — café 123 (best quality:1.2)",
             "a very long prompt " * 20]
    vectors = [{"text": t, "ids": pipe.tokenizer(t, padding="max_length", max_length=77,
                                                  truncation=True).input_ids} for t in tests]
    with open(os.path.join(OUT, "tokenizer_tests.json"), "w") as f:
        json.dump(vectors, f)
    print("tokenizer", flush=True)

if PART in ("text", "all"):
    ids = torch.tensor(pipe.tokenizer(["a photo of a cat", ""], padding="max_length", max_length=77).input_ids,
                       dtype=torch.int32)
    m = TextEncoder(pipe.text_encoder).eval()
    p = export(m, (ids,), ["input_ids"], ["last_hidden_state"], "text_encoder.onnx")
    check(p, {"input_ids": ids.numpy()}, m(ids).numpy())

if PART in ("unet", "all"):
    g = torch.Generator().manual_seed(0)
    sample = torch.randn(2, 4, 64, 64, generator=g)
    temb = torch.from_numpy(np.stack([sinusoid(999.0)] * 2))
    ehs = torch.randn(2, 77, 768, generator=g)
    if PART == "unet":
        del pipe.text_encoder, pipe.vae
        gc.collect()
    m = Unet(pipe.unet.half()).eval()
    want = m(sample, temb, ehs).numpy()
    print("  torch fp16 noise: mean", float(want.mean()), "std", float(want.std()), "nan", bool(np.isnan(want).any()), flush=True)
    p = export(m, (sample, temb, ehs), ["sample", "temb", "encoder_hidden_states"], ["noise"], "unet.onnx", half=True)

if PART in ("vae", "all"):
    latent = torch.randn(1, 4, 64, 64, generator=torch.Generator().manual_seed(0))
    m = VaeDecoder(pipe.vae).eval()
    p = export(m, (latent,), ["latent"], ["image"], "vae_decoder.onnx")
    check(p, {"latent": latent.numpy()}, m(latent).numpy())
