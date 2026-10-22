// Every key the page or app.js uses is in text.json, and every key in
// text.json is used. Runs before each build (npm run prepare-app).
import { readFileSync } from 'node:fs';
const ui = new URL('../ui/', import.meta.url);
const read = (f) => readFileSync(new URL(f, ui), 'utf8');
const text = JSON.parse(read('text.json'));
const used = new Set([
  ...[...read('index.html').matchAll(/data-text="([^"]+)"/g)].map((m) => m[1]),
  ...[...read('app.js').matchAll(/\bt\('([^']+)'/g)].map((m) => m[1]),
]);
// keys built from data: model-<pool name>
for (const k of Object.keys(text)) if (k.startsWith('model-') && /\d/.test(k)) used.add(k);
const missing = [...used].filter((k) => !(k in text));
const unused = Object.keys(text).filter((k) => !used.has(k));
if (missing.length || unused.length) {
  if (missing.length) console.error('missing in text.json:', missing.join(', '));
  if (unused.length) console.error('unused in text.json:', unused.join(', '));
  process.exit(1);
}
console.log(`text.json: ${used.size} keys, all used`);
