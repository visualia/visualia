#!/bin/sh
# Older Stable Diffusion models on a Mac with stable-diffusion.cpp (C++, Metal,
# no Python): every prompt of both sets, 512x512, seed 1. Run on the M1:
#   sh local-sd.sh <model id> <weights file> [sd-cli options...]
# Writes pictures/<set>/<model>/<task>.png and <task>.seconds; prompts.tsv
# (set, task, prompt) comes from `node run.mjs prompts`.
set -eu
model=$1; weights=$2; shift 2
SD=${SD:-$HOME/visualia-build/stable-diffusion.cpp/build/bin/sd-cli}
W=${W:-512}; H=${H:-512}
while IFS="$(printf '\t')" read -r set task prompt; do
  out="pictures/$set/$model"; mkdir -p "$out"
  [ -s "$out/$task.png" ] && continue
  t0=$(date +%s)
  "$SD" -m "$weights" -p "$prompt" -W "$W" -H "$H" -s 1 -o "$out/$task.png" "$@" >/dev/null 2>&1
  echo $(( $(date +%s) - t0 )) > "$out/$task.seconds"
  echo "$model $set $task $(cat "$out/$task.seconds") s"
done < prompts.tsv
