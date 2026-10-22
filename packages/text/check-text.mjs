// Every key a page or its code uses is in text.json, and every key in
// text.json is used. Runs before each build.
//   node check-text.mjs <folder with text.json> <files that use the keys…>
// It finds data-text="key", data-html="key", t('key') and t(`prefix-${…}`)
// (every key starting with that prefix counts as used).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, ...files] = process.argv.slice(2);
if (!dir || !files.length) { console.error('usage: node check-text.mjs <dir> <files…>'); process.exit(2); }
const text = JSON.parse(readFileSync(join(dir, 'text.json'), 'utf8'));
const used = new Set(), prefixes = new Set();
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/data-(?:text|html)="([^"]+)"/g)) used.add(m[1]);
  for (const m of s.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
  for (const m of s.matchAll(/\bt\(`([^`$]*)\$\{/g)) prefixes.add(m[1]);
}
for (const k of Object.keys(text)) if ([...prefixes].some((p) => p && k.startsWith(p))) used.add(k);
const missing = [...used].filter((k) => !(k in text));
const unused = Object.keys(text).filter((k) => !used.has(k));
if (missing.length || unused.length) {
  if (missing.length) console.error(`${dir}/text.json is missing:`, missing.join(', '));
  if (unused.length) console.error(`${dir}/text.json has unused:`, unused.join(', '));
  process.exit(1);
}
console.log(`${dir}/text.json: ${used.size} keys, all used`);
