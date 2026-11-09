#!/bin/sh
# Downloads min-dalle's ONNX export (1.06 GB) and tokenizer into models/ (not in git),
# and copies the shared style sheet beside index.html.
set -eu
cd "$(dirname "$0")"
REV=122d1fdea146d143c71fc3e5e6ca99ec5c5ac8b0  # repo commit, 2026-11-09
BASE="https://huggingface.co/StuartGray/min-dalle-onnx/resolve/$REV"
mkdir -p models
for f in manifest.json vocab.json merges.txt test_vectors.json \
         encoder_fp16.onnx decoder_step_fp16.onnx detokenizer_fp32.onnx; do
  [ -s "models/$f" ] && continue
  echo "$f"
  curl -fL --retry 3 -C - -o "models/$f.part" "$BASE/$f"
  mv "models/$f.part" "models/$f"
done
cp ../../../packages/style/visualia.css visualia.css
# SHA-256 from the Hugging Face API (LFS oids), 2026-11-09.
cd models && shasum -a 256 -c <<'SUMS'
4daf688aeef3a15b288f45738d35d32367cdf9b8ab0d96792927b706dfc88ee5  encoder_fp16.onnx
9662a0efdc0af86bd4fdce8c721143b56a162ea23153685427dc4b23ef622ea8  decoder_step_fp16.onnx
3be1c11acd112180ce81804ac2b701d70a52cabcace9b8e570a9ad24330ed8a3  detokenizer_fp32.onnx
SUMS
