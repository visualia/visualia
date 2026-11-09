# One-time export of BigGAN-deep-256 to ONNX, the only step that needs PyTorch.
# The model then runs in Burn (build.rs), like the upscaler: no Python at run time.
#
#   uv run --python 3.11 --with torch==2.5.1 --with pytorch-pretrained-biggan==0.1.1 \
#     --with onnx==1.17.0 --with numpy==1.26.4 --with scipy==1.14.1 export.py
#
# Writes models/biggan_deep_256.onnx. Inputs: z (1x128 noise, already scaled by
# the truncation), class (1x1000 one-hot). Output: 1x3x256x256 in -1..1.
# The truncation is fixed at export (TRUNCATION): BigGAN-deep picks its batch-norm
# statistics from it, so a fixed value keeps the graph static.
import os
import torch
from pytorch_pretrained_biggan import BigGAN

TRUNCATION = 0.4


class Fixed(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, z, cls):
        return self.model(z, cls, TRUNCATION)


model = BigGAN.from_pretrained('biggan-deep-256').eval()
# Spectral norm re-computes each weight's scale on every pass (a vector product
# that burn-onnx can't type). Baking it into the weights draws the same picture.
for m in model.modules():
    if hasattr(m, 'weight_orig'):
        torch.nn.utils.remove_spectral_norm(m)
os.makedirs('models', exist_ok=True)
z = torch.zeros(1, 128)
cls = torch.zeros(1, 1000)
cls[0, 207] = 1.0  # golden retriever, only to trace
with torch.no_grad():
    torch.onnx.export(
        Fixed(model), (z, cls), 'models/biggan_deep_256.onnx',
        input_names=['z', 'class'], output_names=['image'], opset_version=17, do_constant_folding=True,
    )
print('models/biggan_deep_256.onnx', os.path.getsize('models/biggan_deep_256.onnx') // 1_000_000, 'MB')
