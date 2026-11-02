// Publishes the built app as the newest version (plans/worker-app.md step 4):
// uploads the update and its signature to the R2 bucket the pool serves at
// https://pool.visualia.space/app/, then latest.json last, so an app never sees
// a manifest whose file is missing. Apps install it only when someone clicks Update.
//
//   node publish-update.mjs [--debug] [--local] [--notes "what changed"]
//
// --local writes to `wrangler dev`'s R2 instead (apps/pool, port 8787), for tests;
// VERSION=x.y.z names a build made with `--config '{"version":"x.y.z"}'`.
//
// Build first with the update key in the environment (never in the repo):
//   TAURI_SIGNING_PRIVATE_KEY=~/.config/visualia/pool-updater.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npm run build
// macOS on Apple Silicon only for now; Windows adds its platform here later.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const debug = process.argv.includes('--debug');
const local = process.argv.includes('--local');
const notesAt = process.argv.indexOf('--notes');
const notes = notesAt > 0 ? process.argv[notesAt + 1] : '';
const BUCKET = 'visualia-pool-app';
const BASE = local ? 'http://127.0.0.1:8787/app/files' : 'https://pool.visualia.space/app/files';

const version = process.env.VERSION ?? JSON.parse(readFileSync(join(here, 'src-tauri/tauri.conf.json'), 'utf8')).version;
const platform = `darwin-${process.arch === 'arm64' ? 'aarch64' : process.arch}`;
const bundle = join(here, `target/${debug ? 'debug' : 'release'}/bundle/macos/Visualia Pool.app.tar.gz`);
const signature = readFileSync(`${bundle}.sig`, 'utf8').trim();
const name = `visualia-pool-${version}-${platform}.app.tar.gz`;

// wrangler runs from apps/pool, whose wrangler.jsonc names the bucket.
const put = (key, file, type) => execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', type, local ? '--local' : '--remote'],
  { cwd: join(here, '../pool'), stdio: ['ignore', 'ignore', 'inherit'] });

put(`files/${name}`, bundle, 'application/octet-stream');
const manifest = { version, notes, pub_date: new Date().toISOString(), platforms: { [platform]: { url: `${BASE}/${name}`, signature } } };
const file = join(mkdtempSync(join(tmpdir(), 'pool-app-')), 'latest.json');
writeFileSync(file, JSON.stringify(manifest, null, 2));
put('latest.json', file, 'application/json');
console.log(`published ${version} for ${platform}${debug ? ' (debug build)' : ''}${local ? ' to wrangler dev' : ''}: ${BASE}/${name}`);
