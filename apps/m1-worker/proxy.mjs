// visualia m1-1 proxy: the only way in from the tunnel. Checks the shared
// secret, allows only the OpenAI-compatible model endpoints, forwards to Ollama,
// and measures each request's energy with macmon (Apple Silicon power counters,
// no sudo). The energy rides back as one extra event before [DONE] (streams) or
// a `visualia` field (JSON):
//   energy_j      chip energy (CPU + GPU + Neural Engine + memory) during the request
//   energy_net_j  the same minus the chip's idle baseline: what the model used
//   sys_energy_j  whole-system energy (includes display, SSD, everything else)
import http from 'node:http';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const SECRET = Buffer.from(process.env.VISUALIA_SECRET ?? '');
const OLLAMA = { host: '127.0.0.1', port: 11434 };

// ---- power: a macmon sample every 250 ms ----------------------------------------
const active = new Set();
let idleChipW = null; // moving average of chip power while no request runs
let last = null;
const macmon = spawn('/opt/homebrew/bin/macmon', ['pipe', '-i', '250']);
let buf = '';
macmon.stdout.on('data', (d) => {
  buf += d;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
    let s; try { s = JSON.parse(line); } catch { continue; }
    const t = Date.parse(s.timestamp) || Date.now();
    const chip = (s.all_power ?? 0) + (s.ram_power ?? 0) + (s.gpu_ram_power ?? 0);
    const sys = s.sys_power ?? 0;
    if (last) {
      const dt = (t - last.t) / 1000;
      for (const m of active) { m.chipJ += chip * dt; m.sysJ += sys * dt; }
    }
    if (!active.size) idleChipW = idleChipW == null ? chip : idleChipW * 0.95 + chip * 0.05;
    last = { t };
  }
});
macmon.on('exit', (c) => console.error('macmon exited', c));

function startMeter() { const m = { t0: Date.now(), chipJ: 0, sysJ: 0 }; active.add(m); return m; }
function stopMeter(m) {
  active.delete(m);
  const secs = (Date.now() - m.t0) / 1000;
  return {
    energy_j: round(m.chipJ),
    energy_net_j: round(Math.max(0, m.chipJ - (idleChipW ?? 0) * secs)),
    sys_energy_j: round(m.sysJ),
    seconds: round(secs),
    source: 'macmon',
  };
}
const round = (x) => Math.round(x * 100) / 100;

// ---- requests -------------------------------------------------------------------
const ok = (h) => {
  const got = Buffer.from((h ?? '').replace(/^Bearer /, ''));
  return SECRET.length > 0 && got.length === SECRET.length && timingSafeEqual(got, SECRET);
};

http.createServer((req, res) => {
  if (!ok(req.headers.authorization)) { res.writeHead(401).end('no'); return; }
  if (!/^\/v1\/(chat\/completions|models)$/.test(req.url)) { res.writeHead(404).end(); return; }
  const meter = startMeter();
  const up = http.request({ ...OLLAMA, path: req.url, method: req.method, headers: { 'content-type': req.headers['content-type'] ?? 'application/json' } }, (r) => {
    const type = r.headers['content-type'] ?? 'application/json';
    res.writeHead(r.statusCode, { 'content-type': type });
    if (type.includes('event-stream')) {
      // pass the stream through; put the energy event just before [DONE]
      let tail = '';
      r.on('data', (chunk) => {
        const text = tail + chunk.toString();
        const i = text.indexOf('data: [DONE]');
        if (i >= 0) { tail = text.slice(i); res.write(text.slice(0, i)); }
        else { const keep = Math.max(0, text.length - 16); res.write(text.slice(0, keep)); tail = text.slice(keep); }
      });
      r.on('end', () => {
        res.write(`data: ${JSON.stringify({ visualia: stopMeter(meter) })}\n\n`);
        res.end(tail || 'data: [DONE]\n\n');
      });
    } else {
      let body = '';
      r.on('data', (c) => { body += c; });
      r.on('end', () => {
        const energy = stopMeter(meter);
        try { const j = JSON.parse(body); j.visualia = energy; res.end(JSON.stringify(j)); } catch { res.end(body); }
      });
    }
  });
  up.on('error', () => { stopMeter(meter); res.writeHead(502).end('ollama unreachable'); });
  req.pipe(up);
}).listen(11435, '127.0.0.1', () => console.log('m1-1 proxy on 127.0.0.1:11435, metering with macmon'));
