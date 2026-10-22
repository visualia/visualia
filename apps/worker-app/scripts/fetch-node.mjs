// Puts a pinned, checked Node.js next to the app as its sidecar
// (src-tauri/binaries/node-<target triple>): the official build from
// nodejs.org, its SHA-256 checked against the release's SHASUMS256.txt and
// against the hash pinned here. The worker script runs on it.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VERSION = 'v24.22.1';
const BUILDS = {
  // tarball name -> [Rust target triple, pinned SHA-256 of the tarball]
  'darwin-arm64': ['aarch64-apple-darwin', '89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7'],
};
const platform = `${process.platform}-${process.arch}`;
const [triple, pinned] = BUILDS[platform] ?? [];
if (!triple) { console.error(`no pinned Node build for ${platform}`); process.exit(1); }
const out = new URL(`../src-tauri/binaries/node-${triple}`, import.meta.url).pathname;
if (existsSync(out)) { console.log(`node sidecar already there: ${out}`); process.exit(0); }

const name = `node-${VERSION}-${platform}.tar.gz`;
const base = `https://nodejs.org/dist/${VERSION}`;
const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
const listed = sums.split('\n').find((l) => l.endsWith(`  ${name}`))?.split(' ')[0];
const tar = Buffer.from(await (await fetch(`${base}/${name}`)).arrayBuffer());
const hash = createHash('sha256').update(tar).digest('hex');
if (hash !== listed) { console.error(`hash ${hash} is not the one nodejs.org lists (${listed})`); process.exit(1); }
if (hash !== pinned) { console.error(`hash ${hash} is not the pinned ${pinned}`); process.exit(1); }
const dir = join(tmpdir(), `node-${VERSION}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, name), tar);
execFileSync('tar', ['-xzf', join(dir, name), '-C', dir, `node-${VERSION}-${platform}/bin/node`]);
mkdirSync(new URL('../src-tauri/binaries/', import.meta.url).pathname, { recursive: true });
writeFileSync(out, readFileSync(join(dir, `node-${VERSION}-${platform}`, 'bin', 'node')));
chmodSync(out, 0o755);
rmSync(dir, { recursive: true, force: true });
console.log(`node ${VERSION} (${hash}) -> ${out}`);
