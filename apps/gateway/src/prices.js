// USD per million tokens. Leave a model out rather than guess: its ledger rows
// then carry cost_usd = null, which reads as "unknown", not as "free".
export const PRICES = {
  // '@cf/qwen/qwen3.8-27b': { in: null, out: null }, // verify on the Workers AI pricing page
};

export function costUsd(model, usage) {
  const p = PRICES[model];
  if (!p || p.in == null || p.out == null) return null;
  return ((usage.tokens_in ?? 0) * p.in + (usage.tokens_out ?? 0) * p.out) / 1e6;
}
