// CLIP's BPE tokenizer for Stable Diffusion 1.5, as transformers' CLIPTokenizer
// does it without ftfy: NFC, lowercase, squeeze spaces, split with CLIP's
// pattern, bytes to unicode, byte-pair merges with "</w>" on each word's end.
// Checked against tokenizer_tests.json from export.py (node test-tokenizer.mjs).

const BOS = 49406, EOS = 49407, LENGTH = 77;
const PATTERN = /<\|startoftext\|>|<\|endoftext\|>|'s|'t|'re|'ve|'m|'ll|'d|[\p{L}]+|[\p{N}]|[^\s\p{L}\p{N}]+/gu;

// GPT-2's byte-to-unicode table: printable bytes map to themselves, the rest
// to code points from 256 up.
function byteTable() {
  const keep = [];
  for (let b = 33; b <= 126; b++) keep.push(b);
  for (let b = 161; b <= 172; b++) keep.push(b);
  for (let b = 174; b <= 255; b++) keep.push(b);
  const table = new Array(256);
  let extra = 0;
  for (let b = 0; b < 256; b++) {
    table[b] = String.fromCharCode(keep.includes(b) ? b : 256 + extra++);
  }
  return table;
}

export function makeTokenizer(vocab, mergesText) {
  const rank = new Map();
  // First line is "#version: 0.2"; CLIP uses the first 49152 - 256 - 2 merges.
  mergesText.split("\n").slice(1, 49152 - 256 - 2 + 1).forEach((line, i) => rank.set(line, i));
  const bytes = byteTable();
  const encoder = new TextEncoder();
  const cache = new Map();

  function bpe(token) {
    if (cache.has(token)) return cache.get(token);
    let word = [...token.slice(0, -1), token.slice(-1) + "</w>"];
    while (word.length > 1) {
      let best = null, bestRank = Infinity;
      for (let i = 0; i < word.length - 1; i++) {
        const r = rank.get(word[i] + " " + word[i + 1]);
        if (r !== undefined && r < bestRank) { bestRank = r; best = [word[i], word[i + 1]]; }
      }
      if (!best) break;
      // Join every copy of the best pair, left to right.
      const next = [];
      for (let i = 0; i < word.length; i++) {
        if (i < word.length - 1 && word[i] === best[0] && word[i + 1] === best[1]) {
          next.push(best[0] + best[1]);
          i++;
        } else next.push(word[i]);
      }
      word = next;
    }
    cache.set(token, word);
    return word;
  }

  // Text to 77 ids: start, up to 75 pieces, end, then end again as padding.
  return function tokenize(text) {
    const clean = text.normalize("NFC")
      .replace(/[\u0000�]|[\p{Cc}--[\t\n\r]]/gv, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
    const ids = [];
    for (const piece of clean.match(PATTERN) ?? []) {
      const mapped = Array.from(encoder.encode(piece), (b) => bytes[b]).join("");
      for (const part of bpe(mapped)) ids.push(vocab[part]);
    }
    const out = [BOS, ...ids.slice(0, LENGTH - 2), EOS];
    while (out.length < LENGTH) out.push(EOS);
    return out;
  };
}
