// The platform on this computer: the gateway, the studio and the pool (from the
// visualia-pool checkout beside this one), each its own `wrangler dev`, bound to
// each other through wrangler's dev registry, all on one local D1 and R2.
//   studio  http://127.0.0.1:8790   gateway  http://127.0.0.1:8791   pool  http://127.0.0.1:8788
// The workerd override supports compatibility dates up to 2026-07-08 (CLAUDE.md).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const wrangler = `${root}node_modules/.bin/wrangler`;
const state = `${root}.wrangler/state`;
const common = ['--compatibility-date', '2026-07-08', '--persist-to', state, '--ip', '127.0.0.1'];
const APPS = [
  { name: 'gateway', dir: 'apps/gateway', port: 8791 },
  { name: 'studio', dir: 'apps/studio', port: 8790, build: true },
  // wrangler dev rewrites Origin to the route's host, so its .dev.vars has ORIGIN=http://pool.visualia.space.
  { name: 'pool', dir: 'apps/pool', port: 8788, build: true },
];

if (!existsSync(`${root}apps/pool`)) {
  console.log('apps/pool is missing: run `npm run setup` first (it clones visualia-pool beside this checkout).');
  process.exit(1);
}
const run = (args, cwd) => execFileSync(args[0], args.slice(1), { cwd, stdio: 'inherit' });
run([wrangler, 'd1', 'migrations', 'apply', 'visualia', '--local', '--persist-to', state], `${root}apps/gateway`);
for (const a of APPS) if (a.build) run(['npm', 'run', 'build'], `${root}${a.dir}`);

const children = APPS.map((a) => {
  const child = spawn(wrangler, ['dev', '--port', String(a.port), '--inspector-port', String(a.port + 1000), ...common], { cwd: `${root}${a.dir}`, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = (chunk) => chunk.toString().split('\n').filter(Boolean).map((l) => `[${a.name}] ${l}`).join('\n') + '\n';
  child.stdout.on('data', (c) => process.stdout.write(tag(c)));
  child.stderr.on('data', (c) => process.stderr.write(tag(c)));
  child.on('exit', (code) => console.log(`[${a.name}] stopped (${code})`));
  return child;
});
const stop = () => { for (const c of children) c.kill(); };
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
process.on('exit', stop);
