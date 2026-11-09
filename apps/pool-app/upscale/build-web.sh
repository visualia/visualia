#!/bin/sh
# The upscaler for a browser tab: WebAssembly + its JS glue into
# apps/pool/public/upscale/ (served by the pool, not in git), and the weights
# (.bpk) this build made into weights/ for publish-weights.mjs.
# Needs: rustup target add wasm32-unknown-unknown;
#        cargo install wasm-bindgen-cli --version 0.2.129 --locked
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown --no-default-features --features web
wasm-bindgen --target web --no-typescript --out-dir ../../pool/public/upscale \
  ../target/wasm32-unknown-unknown/release/upscale.wasm
mkdir -p weights
cp "$(ls -dt ../target/wasm32-unknown-unknown/release/build/upscale-*/out/model | head -1)"/*.bpk weights/
ls -l ../../pool/public/upscale weights
