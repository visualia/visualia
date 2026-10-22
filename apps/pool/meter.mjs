// Energy per job on Apple Silicon with macmon (power counters, no sudo), the
// same method as apps/m1-worker/proxy.mjs:
//   energy_j      chip energy (CPU + GPU + Neural Engine + memory) during the job
//   energy_net_j  the same minus the chip's idle baseline: what the model used
//   sys_energy_j  whole-system energy (includes display, SSD, everything else)
// The idle baseline is a moving average of chip power while no job runs.
//
//   import { meter } from './meter.mjs';
//   const m = meter();  const job = m.start();  …  const energy = m.stop(job);
//
// Run directly, it measures a model on a fixed prompt (Ollama on 127.0.0.1:11434):
//   node meter.mjs [model] [runs]      default qwen3.5:9b, 3 runs
import { spawn } from 'node:child_process';

const MACMON = process.env.MACMON ?? '/opt/homebrew/bin/macmon';

export function meter({ interval = 250 } = {}) {
  const active = new Set();
  let idleChipW = null, last = null, buf = '', samples = 0, gpuC = null;
  const proc = spawn(MACMON, ['pipe', '-i', String(interval)], { stdio: ['ignore', 'pipe', 'ignore'] });
  proc.on('error', () => {}); // no macmon: energy stays null
  proc.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      let s; try { s = JSON.parse(line); } catch { continue; }
      const t = Date.parse(s.timestamp) || Date.now();
      const chip = (s.all_power ?? 0) + (s.ram_power ?? 0) + (s.gpu_ram_power ?? 0);
      const sys = s.sys_power ?? 0;
      if (last) {
        const dt = (t - last) / 1000;
        for (const m of active) { m.chipJ += chip * dt; m.sysJ += sys * dt; }
      }
      if (!active.size) idleChipW = idleChipW == null ? chip : idleChipW * 0.95 + chip * 0.05;
      last = t;
      gpuC = s.temp?.gpu_temp_avg ?? gpuC;
      samples++;
    }
  });
  return {
    start() { const m = { t0: Date.now(), chipJ: 0, sysJ: 0 }; active.add(m); return m; },
    stop(m) {
      active.delete(m);
      if (!samples) return null;
      const secs = (Date.now() - m.t0) / 1000;
      return {
        energy_j: round(m.chipJ),
        energy_net_j: round(Math.max(0, m.chipJ - (idleChipW ?? 0) * secs)),
        sys_energy_j: round(m.sysJ),
        seconds: round(secs),
        source: 'macmon',
      };
    },
    idleW: () => idleChipW,
    gpuC: () => gpuC,
    // Wait until the graphics chip is below `below` °C (at least `pause` ms);
    // throws above `limit` °C, so a long run stops before the Mac overheats.
    async cool({ below = 60, limit = 85, pause = 60_000 } = {}) {
      const t0 = Date.now();
      for (;;) {
        if (gpuC > limit) throw new Error(`GPU at ${Math.round(gpuC)} °C, over ${limit}: stopping`);
        if (Date.now() - t0 >= pause && (gpuC == null || gpuC < below)) return;
        await new Promise((r) => setTimeout(r, 2000));
      }
    },
    close: () => proc.kill(),
  };
}

const round = (x) => Math.round(x * 100) / 100;

// ---- the benchmark ------------------------------------------------------------------

if (import.meta.main) {
  const { readFileSync } = await import('node:fs');
  const model = process.argv[2] ?? 'qwen3.5:9b';
  const runs = Number(process.argv[3] ?? 3);
  const OLLAMA = process.env.OLLAMA ?? 'http://127.0.0.1:11434';
  // Run 6's prompt: the stones brief with the course instructions, 1,000 tokens out.
  const system = readFileSync(new URL('../../schools/eka/instructions.md', import.meta.url), 'utf8');
  const brief = JSON.parse(readFileSync(new URL('../../evals/first-pages/briefs.json', import.meta.url), 'utf8'))
    .find((b) => b.id === 'kivid').brief;
  const m = meter();
  const ask = async (max_tokens) => {
    const t0 = Date.now();
    let first = null, usage = null;
    const res = await fetch(`${OLLAMA}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: true, stream_options: { include_usage: true }, think: false, reasoning_effort: 'none',
        max_tokens, temperature: 0.6, messages: [{ role: 'system', content: system }, { role: 'user', content: brief }] }),
    });
    const dec = new TextDecoder(); let b = '';
    for await (const c of res.body) {
      b += dec.decode(c, { stream: true });
      let i;
      while ((i = b.indexOf('\n')) >= 0) {
        const l = b.slice(0, i).trim(); b = b.slice(i + 1);
        if (!l.startsWith('data:') || l.includes('[DONE]')) continue;
        const e = JSON.parse(l.slice(5));
        if (e.choices?.[0]?.delta?.content && first == null) first = Date.now();
        if (e.usage) usage = e.usage;
      }
    }
    return { first_s: (first - t0) / 1000, decode_s: (Date.now() - first) / 1000, usage };
  };
  console.log(`warming ${model}…`);
  await ask(16); // load the model and cache the prompt
  const rows = [];
  for (let i = 0; i < runs; i++) {
    await m.cool(); // a minute's pause, GPU under 60 °C; also settles the idle baseline
    const startC = m.gpuC();
    const job = m.start();
    const r = await ask(1000);
    const e = m.stop(job);
    const out = r.usage.completion_tokens;
    rows.push({
      run: i + 1, tokens_in: r.usage.prompt_tokens, tokens_out: out, first_s: round(r.first_s),
      tok_s: round(out / r.decode_s), seconds: e.seconds, gpu_c: `${Math.round(startC)}→${Math.round(m.gpuC())}`, chip_w: round(e.energy_j / e.seconds),
      sys_w: round(e.sys_energy_j / e.seconds), idle_w: round(m.idleW()),
      j_tok: round(e.energy_j / out), net_j_tok: round(e.energy_net_j / out), sys_j_tok: round(e.sys_energy_j / out),
      ...e,
    });
    console.log(rows.at(-1));
  }
  console.table(rows.map(({ source, energy_j, energy_net_j, sys_energy_j, ...r }) => r));
  await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) }); // unload
  m.close();
}
