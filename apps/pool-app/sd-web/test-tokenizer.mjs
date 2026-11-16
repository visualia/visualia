// Checks tokenizer.js against models/tokenizer_tests.json (written by export.py).
import { readFileSync } from "node:fs";
import { makeTokenizer } from "./tokenizer.js";

const vocab = JSON.parse(readFileSync("models/vocab.json", "utf8"));
const tokenize = makeTokenizer(vocab, readFileSync("models/merges.txt", "utf8"));
let bad = 0;
for (const { text, ids } of JSON.parse(readFileSync("models/tokenizer_tests.json", "utf8"))) {
  const got = tokenize(text);
  const same = got.length === ids.length && got.every((v, i) => v === ids[i]);
  if (!same) { bad++; console.log("differs:", JSON.stringify(text), "\n got ", got.join(","), "\n want", ids.join(",")); }
}
console.log(bad ? `${bad} differ` : "all match");
process.exit(bad ? 1 : 0);
