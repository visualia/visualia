// Clones the sibling repositories that are missing and links the moved folders back
// into this checkout (plans/repo-split.md), so `research/...`, `evals/<name>/...` and
// `apps/pool...` paths in plans and handoffs still open. The links are git-ignored.
import { existsSync, lstatSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const SIBLINGS = {
  'visualia-pool': 'https://github.com/visualia/pool.git',
  'visualia-research': 'https://github.com/visualia/research.git', // private: needs access
};
const LINKS = {
  'apps/pool': '../../visualia-pool/worker',
  'apps/pool-app': '../../visualia-pool/app',
  'apps/m1-worker': '../../visualia-research/m1-worker',
  'research': '../visualia-research/research',
  'evals/embeddings': '../../visualia-research/evals/embeddings',
  'evals/estonian-visuals': '../../visualia-research/evals/estonian-visuals',
  'evals/first-pages': '../../visualia-research/evals/first-pages',
  'evals/svg': '../../visualia-research/evals/svg',
};

for (const [dir, url] of Object.entries(SIBLINGS)) {
  const at = `${root}../${dir}`;
  if (existsSync(at)) continue;
  try {
    execFileSync('git', ['clone', url, at], { stdio: 'inherit' });
  } catch {
    console.log(`${dir}: could not clone ${url}, its links are skipped`);
  }
}
for (const [path, target] of Object.entries(LINKS)) {
  const at = `${root}${path}`;
  try { lstatSync(at); continue; } catch {} // already there, a link or a folder
  if (!existsSync(new URL(target, `file://${at}`).pathname)) continue;
  symlinkSync(target, at);
  console.log(`${path} -> ${target}`);
}
