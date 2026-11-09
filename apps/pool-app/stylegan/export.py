# One-time export of NVIDIA's StyleGAN2-ADA AFHQ Wild generator (512 px:
# foxes, wolves, lions, tigers, leopards) to ONNX, the only step that needs
# PyTorch. The model then runs in Burn (build.rs): no Python at run time.
#
# Run from apps/pool-app/stylegan, on a Mac that can run PyTorch:
#
#   mkdir -p models
#   git clone https://github.com/NVlabs/stylegan2-ada-pytorch models/stylegan2-ada-pytorch
#   git -C models/stylegan2-ada-pytorch checkout d72cc7d041b42ec8e806021a205ed9349f87c6a4
#   curl -L -o models/afhqwild.pkl \
#     https://nvlabs-fi-cdn.nvidia.com/stylegan2-ada-pytorch/pretrained/afhqwild.pkl
#   uv run --python 3.11 --with torch==2.5.1 --with numpy==1.26.4 --with onnx==1.17.0 \
#     --with click==8.1.7 --with requests==2.32.3 export.py
#
# Packages: torch 2.5.1, numpy 1.26.4, onnx 1.17.0, and click 8.1.7 and
# requests 2.32.3 only because NVIDIA's legacy.py and dnnlib import them.
# Python 3.11, not newer: dnnlib imports distutils, gone in 3.12.
# The pickle is 364 MB (363,959,591 bytes: G, D and G_ema); only G_ema is kept.
# PKL=models/afhqcat.pkl or models/afhqdog.pkl works the same (same URL path).
#
# Writes models/stylegan2_afhqwild.onnx. Input: z (1x512 standard normal noise).
# Output: image, 1x3x512x512, roughly -1..1 (clamp it). The truncation is fixed
# at export (PSI); there is no class input (AFHQ models are unconditional).
#
# NVIDIA's CUDA ops (upfirdn2d, bias_act, fma) fall back to plain PyTorch on
# the CPU. On top of that we:
#   - force_fp32=True: the top 4 layers otherwise run in fp16;
#   - noise_mode='const': the per-layer noise is a fixed buffer, not random;
#   - fused_modconv=False: the convs keep constant weights (scaled input and
#     output instead), so no conv has a weight computed at run time;
#   - truncation done here as w_avg + (w - w_avg) * PSI (no lerp in the graph);
#   - upfirdn2d replaced by an equal version on 4-D tensors only: one grouped
#     ConvTranspose for upsampling, Pad + grouped Conv for filtering (NVIDIA's
#     reference reshapes to 6-D and pads there).
# The script checks both replacements against NVIDIA's code before exporting.
import os
import sys
import torch

PSI = 0.7
PKL = os.environ.get('PKL', 'models/afhqwild.pkl')
OUT = 'models/stylegan2_' + os.path.basename(PKL).removesuffix('.pkl') + '.onnx'
sys.path.insert(0, 'models/stylegan2-ada-pytorch')

import legacy  # noqa: E402  (NVIDIA's, needs the path above)
from torch_utils.ops import upfirdn2d, fma  # noqa: E402

original = upfirdn2d.upfirdn2d


def upfirdn2d_4d(x, f, up=1, down=1, padding=0, flip_filter=False, gain=1, impl='ref'):
    upx, upy = upfirdn2d._parse_scaling(up)
    downx, downy = upfirdn2d._parse_scaling(down)
    px0, px1, py0, py1 = upfirdn2d._parse_padding(padding)
    plain = f is not None and f.ndim == 2 and upx == upy and downx == downy == 1
    if not plain:
        return original(x, f, up=up, down=down, padding=padding, flip_filter=flip_filter, gain=gain, impl='ref')
    c = int(x.shape[1])
    k = int(f.shape[0])
    # Up by 2+: insert zeros, pad, filter = one transposed conv, cropped by
    # k-1-p0 before and k-up-p1 after. Only the symmetric case (the generator's).
    crop = [k - 1 - px0, k - upx - px1, k - 1 - py0, k - upy - py1]
    if upx > 1 and (len(set(crop)) != 1 or crop[0] < 0):
        return original(x, f, up=up, down=down, padding=padding, flip_filter=flip_filter, gain=gain, impl='ref')
    f = f * gain  # NVIDIA: gain ** (ndim / 2), ndim is 2
    if upx == 1:
        # Pad (or crop), then a grouped conv with the flipped filter.
        x = torch.nn.functional.pad(x, [max(px0, 0), max(px1, 0), max(py0, 0), max(py1, 0)])
        if min(px0, px1, py0, py1) < 0:  # never in the generator; keeps Shape ops out
            x = x[:, :, max(-py0, 0):x.shape[2] - max(-py1, 0), max(-px0, 0):x.shape[3] - max(-px1, 0)]
        w = f if flip_filter else f.flip([0, 1])
        return torch.nn.functional.conv2d(x, w[None, None].repeat([c, 1, 1, 1]), groups=c)
    w = f.flip([0, 1]) if flip_filter else f
    return torch.nn.functional.conv_transpose2d(x, w[None, None].repeat([c, 1, 1, 1]), stride=upx, padding=crop[0], groups=c)


def fma_plain(a, b, c):
    return a * b + c


class Fixed(torch.nn.Module):
    def __init__(self, G):
        super().__init__()
        self.G = G

    def forward(self, z):
        ws = self.G.mapping(z, None)  # psi 1: no truncation inside
        w_avg = self.G.mapping.w_avg
        ws = w_avg + (ws - w_avg) * PSI
        return self.G.synthesis(ws, noise_mode='const', force_fp32=True, fused_modconv=False)


with open(PKL, 'rb') as fh:
    G = legacy.load_network_pkl(fh)['G_ema'].eval().requires_grad_(False).float()
assert G.c_dim == 0, 'a class-conditional pickle: this script has no class input'
size = G.img_resolution

torch.manual_seed(1)
z = torch.randn(1, G.z_dim)
model = Fixed(G).eval()
with torch.no_grad():
    # Check the replacements against NVIDIA's reference code.
    filt = upfirdn2d.setup_filter([1, 3, 3, 1])
    t = torch.randn(1, 8, 16, 16)
    # upsample2d's call, conv2d_resample's after its transposed conv, and an uneven pad.
    for kw in [dict(up=2, padding=[2, 1, 2, 1], gain=4), dict(padding=1, gain=4), dict(padding=[2, 1, 2, 1])]:
        diff = (upfirdn2d_4d(t, filt, **kw) - original(t, filt, impl='ref', **kw)).abs().max().item()
        assert diff < 1e-5, (kw, diff)
    want = model(z)
    upfirdn2d.upfirdn2d = upfirdn2d_4d
    fma.fma = fma_plain
    got = model(z)
    print('replaced ops vs NVIDIA reference, max difference', (got - want).abs().max().item())

    os.makedirs('models', exist_ok=True)
    torch.onnx.export(
        model, (z,), OUT, input_names=['z'], output_names=['image'],
        opset_version=17, do_constant_folding=True, dynamo=False,
    )

import onnx  # noqa: E402

m = onnx.load(OUT)
onnx.checker.check_model(m)
ops = sorted({n.op_type for n in m.graph.node})
print(OUT, os.path.getsize(OUT) // 1_000_000, 'MB,', f'{size}x{size},', 'ops:', ' '.join(ops))
