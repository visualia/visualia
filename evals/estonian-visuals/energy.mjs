// Energy of one local job on this Mac, measured with macmon (Apple Silicon power counters, no sudo).
// Research use only. Written 2026-11-18 because the costume figurines were made without measuring energy,
// and the energy slide needs real numbers, not estimates.
//
//   node energy.mjs run [options] -- <command ...>
//       --step <name> --era <era> --model <model> --note <text>   what the entry is about
//       --idle <s>      idle baseline before the command (default 45 s; keep the Mac otherwise still)
//       --after <s>     a second baseline after it (default 30 s); idle W is the mean of both. If the two differ
//                       a lot, or the baseline swings (idle_sd_w), something else was running: `steady` false
//       --json <file>   append the entry here (default out/energy/energy.json)
//     Runs the command once, inheriting stdio, and writes one entry: seconds, Wh total, Wh above idle, idle W.
//     If the command prints a line "@energy start <label>" and later "@energy end <label>", that stretch is
//     also measured on its own (`marks`), e.g. drawing without launching the browser.
//
//   node energy.mjs tab <dalle-mini|sd-web> --prompt <text> [--seed 1] --out <file.png>
//     Draws one picture in a Chrome tab (Playwright, WebGPU) with apps/pool-app/<app>, as era.mjs `dalle` does,
//     and saves it. Prints the @energy marks around the click-to-picture stretch, for `run`.
//
// What is summed: chip = all_power (CPU + GPU + Neural Engine) + ram_power + gpu_ram_power, the same as
// apps/pool/meter.mjs and the m1-1 proxy. sys = sys_power, the whole Mac (display, SSD, everything; on battery
// it is what the battery delivers). Each macmon sample is the mean over the interval before it, so energy is
// power times that interval, clipped to the command's start and end. Idle is the mean over the baseline;
// above idle = total minus idle W times the job's seconds (chip and sys each against their own idle).
// Caveats (plans/pool.md, plans/first-pages.md): macmon's counters are the SoC's own estimates, not a meter at
// the wall; ram_power reads 0 on some chips; anything else running on the Mac lands in the numbers.
import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MACMON = process.env.MACMON ?? '/opt/homebrew/bin/macmon';
const INTERVAL = 250; // ms between macmon samples
const GLITCH_W = 150; // no sample above this is real on these Macs (M1, M2 Pro)
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const r = (x, d = 3) => (x == null ? null : +x.toFixed(d));

// ---- the meter: every sample kept, so any stretch can be integrated afterwards ----
function startMeter() {
  const samples = [], glitches = []; // samples: { t0, t1, chip, sys, cpu, gpu, ane, ram, gpuC }
  let buf = '', last = null;
  const proc = spawn(MACMON, ['pipe', '-i', String(INTERVAL)], { stdio: ['ignore', 'pipe', 'ignore'] });
  proc.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      let s; try { s = JSON.parse(line); } catch { continue; }
      const t = Date.parse(s.timestamp) || Date.now();
      const ram = (s.ram_power ?? 0) + (s.gpu_ram_power ?? 0);
      // macmon now and then reports one absurd sample (hundreds of W on a chip that peaks near 60 W): drop it,
      // count it, and let the neighbours' interval cover the gap (seen 2026-11-18, it moved a 60 s idle by 8 W)
      if ((s.all_power ?? 0) + ram > GLITCH_W || (s.sys_power ?? 0) > GLITCH_W) { glitches.push({ t, chip: (s.all_power ?? 0) + ram, sys: s.sys_power }); continue; }
      if (last != null) samples.push({ t0: last, t1: t, chip: (s.all_power ?? 0) + ram, sys: s.sys_power ?? 0,
        cpu: s.cpu_power ?? 0, gpu: s.gpu_power ?? 0, ane: s.ane_power ?? 0, ram, gpuC: s.temp?.gpu_temp_avg ?? null });
      last = t;
    }
  });
  return { samples, glitches, stop: () => proc.kill(), proc };
}

// Joules of each field between a and b (ms), each sample weighted by its overlap with [a, b].
function integrate(samples, a, b) {
  const j = { chip: 0, sys: 0, cpu: 0, gpu: 0, ane: 0, ram: 0 };
  let covered = 0;
  for (const s of samples) {
    const o = Math.min(b, s.t1) - Math.max(a, s.t0);
    if (o <= 0) continue;
    covered += o;
    for (const k in j) j[k] += s[k] * o / 1000;
  }
  return { j, covered: covered / 1000 };
}

function stretch(samples, a, b, idle) {
  const secs = (b - a) / 1000, { j, covered } = integrate(samples, a, b), wh = (x) => r(x / 3600, 4);
  const above = (k) => wh(j[k] - idle[k] * secs); // may be negative per field
  return {
    seconds: r(secs, 2),
    wh_total: wh(j.chip), wh_above_idle: wh(Math.max(0, j.chip - idle.chip * secs)),
    sys_wh_total: wh(j.sys), sys_wh_above_idle: wh(Math.max(0, j.sys - idle.sys * secs)),
    mean_chip_w: r(j.chip / secs, 2), mean_sys_w: r(j.sys / secs, 2),
    by_field_wh: { cpu: wh(j.cpu), gpu: wh(j.gpu), ane: wh(j.ane), ram: wh(j.ram) },
    by_field_wh_above_idle: { cpu: above('cpu'), gpu: above('gpu'), ane: above('ane'), ram: above('ram') },
    sampled_share: r(covered / secs, 3), // under 1: macmon missed part of the stretch
  };
}

function machine() {
  const q = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return null; } };
  const batt = q('pmset -g batt') ?? '';
  return {
    model: q('sysctl -n hw.model'), chip: q('sysctl -n machdep.cpu.brand_string'),
    memory_gb: Math.round(Number(q('sysctl -n hw.memsize')) / 2 ** 30), macos: q('sw_vers -productVersion'),
    power: /AC Power/.test(batt) ? 'mains' : /Battery Power/.test(batt) ? 'battery' : null,
    low_power_mode: /lowpowermode\s+1/.test(q('pmset -g') ?? ''), macmon: q(`${MACMON} --version`),
  };
}

// mean W of each field between a and b
function mean(samples, a, b) {
  const { j, covered } = integrate(samples, a, b);
  return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, v / covered]));
}

const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
function flags(args) {
  const o = {}; const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') { rest.push(...args.slice(i + 1)); break; }
    if (args[i].startsWith('--')) o[args[i].slice(2)] = args[++i]; else rest.push(args[i]);
  }
  return { o, rest };
}

async function run(args) {
  const { o, rest } = flags(args);
  if (!rest.length) throw new Error('node energy.mjs run [--step s --era e --model m --idle 45] -- <command ...>');
  const idleS = Number(o.idle ?? 45);
  const file = o.json ?? here('./out/energy/energy.json');
  const m = startMeter();
  await wait(1500); // macmon's first samples settle
  const i0 = Date.now();
  console.error(`[energy] idle baseline ${idleS} s …`);
  await wait(idleS * 1000);
  const i1 = Date.now();
  const before = mean(m.samples, i0, i1);
  console.error(`[energy] idle chip ${before.chip.toFixed(2)} W, sys ${before.sys.toFixed(2)} W; running: ${rest.join(' ')}`);

  const marks = {}, open = {};
  const t0 = Date.now();
  const child = spawn(rest[0], rest.slice(1), { stdio: ['inherit', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => {
    process.stdout.write(d); out += d;
    let nl;
    while ((nl = out.indexOf('\n')) >= 0) {
      const line = out.slice(0, nl); out = out.slice(nl + 1);
      const k = /^@energy (start|end) (\S+)/.exec(line);
      if (k?.[1] === 'start') open[k[2]] = Date.now();
      if (k?.[1] === 'end' && open[k[2]]) marks[k[2]] = [open[k[2]], Date.now()];
    }
  });
  const code = await new Promise((ok) => child.on('close', ok));
  const t1 = Date.now();
  const afterS = Number(o.after ?? 30);
  console.error(`[energy] idle baseline after, ${afterS} s …`);
  await wait(INTERVAL * 2); // the sample covering the end belongs to the run
  const a0 = Date.now();
  await wait(afterS * 1000);
  const a1 = Date.now();
  await wait(INTERVAL * 2);
  m.stop();
  const after = afterS > 0 ? mean(m.samples, a0, a1) : before;
  const idle = Object.fromEntries(Object.keys(before).map((k) => [k, (before[k] + after[k]) / 2]));
  const base = m.samples.filter((s) => (s.t0 >= i0 && s.t1 <= i1) || (s.t0 >= a0 && s.t1 <= a1)).map((s) => s.chip);
  const sd = Math.sqrt(base.reduce((x, v) => x + (v - idle.chip) ** 2, 0) / Math.max(1, base.length));
  const isec = (i1 - i0) / 1000;

  const entry = {
    step: o.step ?? null, era: o.era ?? null, model: o.model ?? null, note: o.note ?? null,
    date: new Date(t0).toISOString(), command: rest.join(' '), exit_code: code,
    machine: machine(),
    ...stretch(m.samples, t0, t1, idle),
    idle_w: r(idle.chip, 2), idle_sys_w: r(idle.sys, 2), idle_seconds: r(isec, 1), after_seconds: afterS,
    idle_before_w: r(before.chip, 2), idle_after_w: r(after.chip, 2), idle_sd_w: r(sd, 2),
    // a rough flag: the baseline wandered by more than 2 W, or the job used less than twice the swing
    steady: Math.abs(before.chip - after.chip) < 2 && sd < 2,
    marks: Object.fromEntries(Object.entries(marks).map(([k, [a, b]]) => [k, stretch(m.samples, a, b, idle)])),
    glitches_dropped: m.glitches.length,
    samples_file: null,
    peak_gpu_c: r(Math.max(...m.samples.filter((s) => s.t0 >= t0).map((s) => s.gpuC ?? -Infinity)), 1),
    fields: 'chip = all_power (cpu + gpu + ane) + ram_power + gpu_ram_power; sys = sys_power (whole Mac)',
    how: `macmon pipe -i ${INTERVAL}, idle baseline ${idleS} s just before (mean), the command run once, ` +
      'power x sample interval clipped to the run; above idle = total - idle W x seconds (energy.mjs)',
  };
  mkdirSync(dirname(file), { recursive: true });
  // every sample of this run beside the JSON, so the numbers can be checked or recomputed
  const sf = `${dirname(file)}/samples/${entry.date.replace(/[:.]/g, '-')}-${entry.step ?? 'run'}.jsonl`;
  mkdirSync(dirname(sf), { recursive: true });
  writeFileSync(sf, [JSON.stringify({ idle: [i0, i1], run: [t0, t1], after: [a0, a1], marks, glitches: m.glitches }),
    ...m.samples.map((s) => JSON.stringify([s.t0, s.t1, r(s.chip, 2), r(s.sys, 2), r(s.cpu, 2), r(s.gpu, 2), r(s.ane, 2), r(s.ram, 2)]))].join('\n') + '\n');
  entry.samples_file = sf.slice(dirname(file).length + 1);
  const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  all.push(entry);
  writeFileSync(file, JSON.stringify(all, null, 1) + '\n');
  console.error(`[energy] ${entry.step ?? ''} ${entry.seconds} s  chip ${entry.wh_total} Wh (${entry.wh_above_idle} above idle ${entry.idle_w} W)` +
    `  sys ${entry.sys_wh_total} Wh (${entry.sys_wh_above_idle} above idle)  exit ${code}`);
  for (const [k, v] of Object.entries(entry.marks)) console.error(`[energy]   ${k}: ${v.seconds} s  chip ${v.wh_total} Wh (${v.wh_above_idle} above idle)`);
  process.exitCode = code ?? 1;
}

// ---- one picture in a Chrome tab, as era.mjs `dalle` drives it ----
async function tab(args) {
  const { o, rest } = flags(args);
  const app = rest[0];
  if (!['dalle-mini', 'sd-web'].includes(app) || !o.prompt || !o.out) throw new Error('node energy.mjs tab <dalle-mini|sd-web> --prompt <text> [--seed 1] --out <file.png>');
  const { createServer } = await import('node:net');
  const port = await new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: here(`../../apps/pool-app/${app}/`), stdio: 'ignore' });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
  try {
    const page = await browser.newPage();
    for (let i = 0; i < 20; i++) { try { await page.goto(`http://localhost:${port}/`); break; } catch { await wait(300); } }
    const t0 = Date.now();
    console.log('@energy start draw');
    await page.fill('#prompt', o.prompt);
    await page.fill('#seed', String(o.seed ?? 1));
    await page.click('#go');
    await page.waitForFunction(() => /^(Done|Stopped)/.test(document.getElementById('status').textContent), null, { timeout: 900000 });
    console.log('@energy end draw');
    const status = await page.textContent('#status');
    if (status.startsWith('Stopped')) throw new Error(status);
    const png = await page.evaluate(() => document.getElementById('out').toDataURL('image/png'));
    mkdirSync(dirname(o.out), { recursive: true });
    writeFileSync(o.out, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`${app}: ${((Date.now() - t0) / 1000).toFixed(1)} s click to picture. ${status}`);
  } finally { await browser.close(); server.kill(); }
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'run') await run(args);
else if (cmd === 'tab') await tab(args);
else console.log('node energy.mjs run [--step s --era e --model m --idle 45] -- <command ...>\nnode energy.mjs tab <dalle-mini|sd-web> --prompt <text> [--seed 1] --out <file.png>');
