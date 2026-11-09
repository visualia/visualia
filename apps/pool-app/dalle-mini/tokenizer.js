// min-dalle's text tokenizer (min_dalle/text_tokenizer.py), line for line.
// Not the standard BPE: each round merges only the first, lowest-ranked pair.

export function makeTokenizer(vocab, mergesText) {
  // Python: f.read().split("\n")[1:-1] drops the header and the last line.
  const lines = mergesText.split("\n").slice(1, -1);
  const rank = new Map();
  lines.forEach((line, i) => {
    const pair = line.split(/\s+/).filter(Boolean).join(" ");
    if (!rank.has(pair)) rank.set(pair, i);
  });
  const cls = vocab["<s>"], sep = vocab["</s>"], unk = vocab["<unk>"];

  function bpe(word) {
    // A leading "Ġ" (chr(32 + 256)) marks the space before each word.
    let parts = [String.fromCharCode(32 + 256), ...word];
    while (parts.length > 1) {
      let best = -1, bestRank = Infinity;
      for (let i = 0; i < parts.length - 1; i++) {
        const r = rank.get(parts[i] + " " + parts[i + 1]);
        if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
      }
      if (best < 0) break;
      parts = [...parts.slice(0, best), parts[best] + parts[best + 1], ...parts.slice(best + 2)];
    }
    return parts;
  }

  return function tokenize(text) {
    // min-dalle turns emoji into names first (emoji.demojize); we drop them.
    // Lowercase, then keep ASCII only, as .encode("ascii", errors="ignore").
    const clean = text.toLowerCase().replace(/[^\x00-\x7f]/g, "");
    const ids = [];
    for (const word of clean.split(" ")) {
      if (!word) continue;
      for (const sub of bpe(word)) ids.push(vocab[sub] ?? unk);
    }
    return [cls, ...ids, sep];
  };
}

// The encoder's [2, 64] input: row 0 is the empty prompt, row 1 the prompt.
// Padding is 1. Long prompts are cut to 64 (the end token is lost, as in min-dalle).
export function textTokens(ids, length = 64, pad = 1) {
  const t = ids.slice(0, length);
  const out = new BigInt64Array(2 * length).fill(BigInt(pad));
  out[0] = BigInt(t[0]);
  out[1] = BigInt(t[t.length - 1]);
  t.forEach((id, i) => { out[length + i] = BigInt(id); });
  return out;
}
