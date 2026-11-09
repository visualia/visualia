// Puts the upscalers' weights where the app and tabs download them: R2
// visualia-pool-app, files/<name>, served by the pool at /app/files/<name>.
// Run build-web.sh first (it writes weights/), and check the SHA-256s match
// apps/pool/src/models.js. --local writes to wrangler dev's local R2
// (with --persist-to <dir> if the pool's dev uses one).
//   node publish-weights.mjs [--local] [--persist-to <dir>]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MODELS } from '../../pool/src/models.js';

const args = process.argv.slice(2);
const local = args.includes('--local');
const persist = args.includes('--persist-to') ? ['--persist-to', args[args.indexOf('--persist-to') + 1]] : [];
const here = new URL('.', import.meta.url).pathname;
for (const m of MODELS.filter((m) => m.file)) {
  const path = `${here}weights/${m.file}`;
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (sha !== m.sha256) throw new Error(`${m.file}: ${sha}, but the list says ${m.sha256}`);
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `visualia-pool-app/files/${m.file}`, '--file', path,
    '--content-type', 'application/octet-stream', ...(local ? ['--local', ...persist] : ['--remote'])],
    { cwd: `${here}../../pool`, stdio: 'inherit' });
  console.log(`${m.file}: put${local ? ' (local)' : ''}`);
}
