// USD per million tokens. Leave a model out rather than guess: its usage rows
// then carry cost_usd = null, which reads as "unknown", not as "free".
export const PRICES = {
  // '@cf/qwen/qwen3.8-27b': { in: null, out: null }, // verify on the Workers AI pricing page
};

// Workers AI bills in neurons: $0.011 per 1,000 beyond the free 10,000 a day
// (pricing page, checked 2026-10-21). Recorded at the paid rate, so the free
// allowance shows up as a saving, not as zero cost.
export const USD_PER_NEURON = 0.011 / 1000;

export function costUsd(model, usage) {
  if (model.startsWith('m1-1/')) return 0; // a laptop on the LAN: no bill (energy is counted separately, later)
  if (usage.neurons != null) return usage.neurons * USD_PER_NEURON;
  const p = PRICES[model];
  if (!p || p.in == null || p.out == null) return null;
  return ((usage.tokens_in ?? 0) * p.in + (usage.tokens_out ?? 0) * p.out) / 1e6;
}
