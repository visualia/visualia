# Our own export of TripoSplat (VAST, MIT: github.com/VAST-AI-Research/TripoSplat)
# to fp16 ONNX for ONNX Runtime (Node or a tab, WebGPU). Written from VAST's
# model.py and triposplat.py, not from the unlicensed WebGPU port. Five graphs:
#
#   dinov3.onnx  pixels [1,3,1024,1024] (ImageNet-normalised) -> feature1 [1,4101,1280]
#   vae.onnx     pixels [1,3,1024,1024] (-1..1), noise [1,32,128,128] -> feature2 [1,4101,128]
#   dit.onnx     latent [1,8192,16], camera [1,1,5], t [1] (1000 * t), feature1, feature2
#                -> v_latent, v_camera (one call; CFG is two calls, the second with zero features)
#   octree.onnx  coords [1,8192,3] (padded), res [1], latent [1,8192,16], num [1] -> logits [1,8192,8]
#   gs.onnx      points [1,8192,3], latent -> PLY fields for 8192 x 32 Gaussians
#
# Run beside VAST's checkout and ckpts/, after refs.py, one part per run:
#   python export.py dinov3|vae|dit|octree|gs
# Traced in fp16, so VAST's own .float() casts (time and position embeddings,
# norms) stay fp32 in the graph. Inputs and outputs are fp32. Each part is
# checked against VAST's code in fp32 on the CPU; refs/<part>.npz keeps the
# inputs and the fp32 answer for the Node check.
import os
import sys

import numpy as np
import torch
import torch.nn.functional as F

import model as M
import triposplat as T

PART = sys.argv[1]
os.makedirs("onnx", exist_ok=True)
os.makedirs("refs", exist_ok=True)
torch.set_grad_enabled(False)
R = torch.load("refs.pt")
_sdpa = F.scaled_dot_product_attention


# ---- the two changes for ONNX, same maths ------------------------------------
# 1. RoPE without complex numbers: the angles out of RePo3D, rotation by cos/sin.
def repo_angles(self, hidden_states):
    h = self.norm(hidden_states)
    out = self.final_map(self.act(self.gate_map(h)) * self.content_map(h))
    B, L, _ = out.shape
    d = out.reshape(B, L, self.num_heads, 3)
    return torch.cat([M.clamp_mul(d[..., i].unsqueeze(-1), f) * torch.pi
                      for i, f in enumerate([self.freqs_0, self.freqs_1, self.freqs_2])], dim=-1).float()


def rotate(hidden_states, ang):
    x = hidden_states.float().reshape(*hidden_states.shape[:-1], -1, 2)
    a, b = x[..., 0], x[..., 1]
    c, s = torch.cos(ang), torch.sin(ang)
    return torch.stack([a * c - b * s, a * s + b * c], dim=-1).reshape(hidden_states.shape).type_as(hidden_states)


# 2. Attention in pieces of query rows: a browser's GPU buffer stops at 4 GB, and
#    the DiT's full score matrix (16 heads, 12,289 tokens) is 4.8 GB in fp16.
LIMIT = 2 ** 27  # score elements per piece, 256 MB in fp16


def sdpa_pieces(q, k, v, *a, **kw):
    B, H, L, S = q.shape[0], q.shape[1], q.shape[2], k.shape[2]
    if a or kw or B * H * L * S <= LIMIT:
        return _sdpa(q, k, v, *a, **kw)
    rows = max(1, LIMIT // (B * H * S))
    return torch.cat([_sdpa(q[:, :, r:r + rows], k, v) for r in range(0, L, rows)], dim=2)


def for_onnx():
    M.RePo3DRotaryEmbedding.forward = repo_angles
    M.apply_rotary_emb = rotate
    F.scaled_dot_product_attention = sdpa_pieces


# ---- the parts ---------------------------------------------------------------
CK = "ckpts/"


class Dino(torch.nn.Module):
    def __init__(self, m):
        super().__init__(); self.m = m

    def forward(self, pixels):
        f = self.m(pixels.to(self.m.cls_token.dtype))
        return F.layer_norm(f.float(), (1280,))  # as triposplat.encode_image (hidden size 1280)


class Vae(torch.nn.Module):
    # Flux2VAEEncoder.encode with the noise as an input, plus the 5 zero tokens.
    def __init__(self, m):
        super().__init__(); self.m = m

    def forward(self, pixels, noise):
        m = self.m
        d = m.quant_conv.weight.dtype
        mean, logvar = m.quant_conv(m.encoder(pixels.to(d))).chunk(2, dim=1)
        x = mean + torch.exp(0.5 * logvar) * noise.to(d)
        B, C, H, W = x.shape
        x = x.view(B, C, H // 2, 2, W // 2, 2).permute(0, 1, 3, 5, 2, 4).reshape(B, C * 4, H // 2, W // 2)
        mu = m.bn.running_mean.view(1, -1, 1, 1).to(d)
        sd = torch.sqrt(m.bn.running_var.view(1, -1, 1, 1) + m.bn.eps).to(d)
        x = ((x - mu) / sd).float().flatten(2).transpose(1, 2)
        return torch.cat([torch.zeros(B, 5, x.shape[2], device=x.device), x], dim=1)


class Dit(torch.nn.Module):
    def __init__(self, m):
        super().__init__(); self.m = m

    def forward(self, latent, camera, t, feature1, feature2):
        out = self.m({"latent": latent, "camera": camera}, t, {"feature1": feature1, "feature2": feature2})
        return out["latent"].float(), out["camera"].float()


class Octree(torch.nn.Module):
    def __init__(self, m):
        super().__init__(); self.m = m

    def forward(self, coords, res, latent, num):
        return self.m(coords, res, latent, num)["logits"].float()


class Gs(torch.nn.Module):
    # The Gaussian decoder and VAST's _build_gaussians + Gaussian._get_ply_data,
    # up to the default transform (y up becomes z up), which the caller applies.
    def __init__(self, m):
        super().__init__(); self.m = m
        c = m.rep_config
        self.opacity_bias = float(np.log(c["opacity_bias"] / (1 - c["opacity_bias"])))
        sb = torch.tensor(c["scaling_bias"])
        self.scale_bias = float(sb + torch.log(-torch.expm1(-sb)))  # inverse softplus
        self.kernel = c["filter_kernel_size_3d"]

    def forward(self, points, latent):
        m, L = self.m, self.m.layout
        h = m(x={"points": points}, cond=latent)["features"]
        offset = m._get_offset(h).float()
        h = h.float()
        part = lambda k: h[0][:, L[k]["range"][0]:L[k]["range"][1]].reshape(-1, *L[k]["shape"]).flatten(0, 1)
        lr = m.rep_config["lr"]
        xyz = (offset[0] + points[0, :, None, :]).flatten(0, 1) - 0.5  # aabb [-0.5, 1]
        f_dc = part("_features_dc") * lr["_features_dc"]
        opacity = part("_opacity") * lr["_opacity"] + self.opacity_bias
        s = F.softplus(part("_scaling") * lr["_scaling"] + self.scale_bias)
        scale = 0.5 * torch.log(s * s + self.kernel ** 2)
        rot = part("_rotation") * lr["_rotation"] + torch.tensor([1.0, 0, 0, 0], device=h.device)
        return xyz, f_dc.reshape(-1, 3), opacity, scale, rot


def load(dtype):
    if PART == "dinov3":
        return Dino(T.load_dinov3(CK + "clip_vision/dino_v3_vit_h.safetensors", device="cpu", dtype=dtype))
    if PART == "vae":
        return Vae(T.load_vae_encoder(CK + "vae/flux2-vae.safetensors", device="cpu", dtype=dtype))
    if PART == "dit":
        return Dit(T.load_flow_model(CK + "diffusion_models/triposplat_fp16.safetensors", device="cpu", dtype=dtype))
    dec = T.load_decoder(CK + "vae/triposplat_vae_decoder_fp16.safetensors", device="cpu", dtype=dtype)
    return Octree(dec.octree) if PART == "octree" else Gs(dec.gs)


g = torch.Generator().manual_seed(7)
if PART == "dinov3":
    feeds = {"pixels": R["dino_in"]}; outs = ["feature1"]
elif PART == "vae":
    feeds = {"pixels": R["vae_in"], "noise": torch.randn(1, 32, 128, 128, generator=g)}; outs = ["feature2"]
elif PART == "dit":
    feeds = {"latent": R["x0"]["latent"], "camera": R["x0"]["camera"], "t": torch.tensor([1000.0]),
             "feature1": R["feature1"], "feature2": R["feature2"]}; outs = ["v_latent", "v_camera"]
elif PART == "octree":
    # Level 3 of the walk: 64 parent cells, padded to 8192 rows as the runner pads them.
    c = torch.zeros(1, 8192, 3); c[0, :64] = (torch.stack(torch.meshgrid(*[torch.arange(4)] * 3, indexing="ij"), -1).reshape(-1, 3).float() + 0.5) / 4
    feeds = {"coords": c, "res": torch.tensor([8]), "latent": R["latent"], "num": torch.tensor([8192])}; outs = ["logits"]
else:
    feeds = {"points": R["points"], "latent": R["latent"]}; outs = ["xyz", "f_dc", "opacity", "scale", "rotation"]

# The answer from VAST's code as it is, fp32 on the CPU.
ref = load(torch.float32)
want = ref(*feeds.values())
want = want if isinstance(want, tuple) else (want,)
del ref
np.savez(f"refs/{PART}.npz", **{k: v.numpy() for k, v in feeds.items()}, **{f"want_{o}": w.numpy() for o, w in zip(outs, want)})

for_onnx()
# Traced on DEV (cpu, or mps: much faster in fp16). CHECK=1 first compares our
# fp16 torch (same maths, our two changes) with the fp32 answer.
dev = os.environ.get("DEV", "cpu")
m16 = load(torch.float16).to(dev)
args = tuple(v.to(dev) for v in feeds.values())
if os.environ.get("CHECK"):
    got = m16(*args)
    got = got if isinstance(got, tuple) else (got,)
    for o, a, b in zip(outs, got, want):
        err = (a.float().cpu() - b).abs()
        print(f"{PART} torch fp16 vs fp32 {o}: max {err.max():.4g} mean {err.mean():.4g} of max {b.abs().max():.4g}, nan {bool(a.isnan().any())}", flush=True)
path = f"onnx/{PART}.onnx"
torch.onnx.export(m16, args, path, input_names=list(feeds), output_names=outs,
                  opset_version=17, do_constant_folding=True, dynamo=False)
print(path, os.path.getsize(path) // 1_000_000, "MB", flush=True)
