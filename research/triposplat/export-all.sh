#!/bin/sh
export PATH=/opt/homebrew/bin:$PATH DEV=mps
for p in "$@"; do
  echo "== $p $(date +%T)"
  uv run --python 3.11 --with torch==2.9.0 --with torchvision==0.24.0 --with numpy==2.2.6 --with safetensors==0.6.2 --with packaging==25.0 --with pillow==11.3.0 --with tqdm==4.67.1 --with onnx==1.19.1 python export.py $p 2>&1 | grep -v -i "warn\|^ \|torch.onnx\|deprecat\|^\s*$"
done
echo "== done $(date +%T)"
