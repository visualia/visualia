// Replays talk.html with Space from the start to past the nature slides, logging errors, context losses, GL counts.
// MODE=normal|fast  HEADLESS=0|1  PICKS=1 (the stage's dx-out)  UNTIL=<label regex to stop after>  GAP=ms between presses
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const MODE = process.env.MODE ?? 'normal';
const GAP = Number(process.env.GAP ?? (MODE === 'fast' ? 300 : 4500));
const HEADLESS = process.env.HEADLESS === '1';
const PICKS = process.env.PICKS !== '0';
const MAXSTEPS = Number(process.env.MAXSTEPS ?? 45);
const FLAGS = process.env.FLAGS !== '0';
const OUT = new URL(`./run-${process.env.TAG ?? ''}${MODE}-${HEADLESS ? 'hl' : 'hd'}-${PICKS ? 'picks' : 'all'}-${Date.now()}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const t0 = Date.now(), ts = () => ((Date.now() - t0) / 1000).toFixed(1);
const log = [];
const note = (s) => { const l = `${ts()} ${s}`; log.push(l); console.log(l); };

const args = ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'];
if (FLAGS) args.push('--enable-features=CanvasDrawElement');
const browser = await chromium.launch({ channel: 'chrome', headless: HEADLESS, args });
browser.on('disconnected', () => note('BROWSER DISCONNECTED'));
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (PICKS) {
  const out = readFileSync(new URL('./dx-out.json', import.meta.url), 'utf8');
  await ctx.addInitScript((v) => { try { if (location.port === '8123' && !localStorage.getItem('dx-out')) localStorage.setItem('dx-out', v); } catch {} }, out);
}
await ctx.addInitScript(() => {
  const at = () => location.pathname.split('/').pop() || location.href;
  const all = (window.__glAll ??= []);
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = orig.call(this, type, ...a);
    if (/webgl/.test(type)) {
      if (!c) console.error(`[GLNULL] ${at()} getContext(${type}) returned null`);
      else if (!all.some((x) => x.c === c)) {
        all.push({ c, canvas: this, type, at: at(), t: performance.now() });
        this.addEventListener('webglcontextlost', () => console.error(`[GLLOST] ${at()} ${type} ${this.id || this.className || 'canvas'} ${this.width}x${this.height}`));
        this.addEventListener('webglcontextrestored', () => console.error(`[GLRESTORED] ${at()} ${type}`));
      }
    }
    return c;
  };
  window.__glLive = () => all.filter((x) => x.canvas.isConnected && !x.c.isContextLost()).map((x) => x.at);
  window.__glLost = () => all.filter((x) => x.c.isContextLost()).map((x) => x.at);
  addEventListener('error', (e) => console.error(`[ERR] ${at()} ${e.message} @${e.filename?.split('/').pop()}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => console.error(`[REJ] ${at()} ${e.reason?.message ?? e.reason}`));
});
const page = await ctx.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || m.type() === 'warning' || /WebGL|GL_|context/i.test(t)) note(`console.${m.type()} [${m.location()?.url?.split('/').pop()?.slice(0, 40)}] ${t.slice(0, 300)}`);
});
page.on('pageerror', (e) => note(`PAGEERROR ${e.message.slice(0, 300)}`));
page.on('crash', () => note('RENDERER CRASH'));
page.on('requestfailed', (r) => note(`REQFAIL ${r.url().split('/').slice(-2).join('/')} ${r.failure()?.errorText}`));

const live = async () => {
  let n = 0; const by = {}; const lost = {};
  for (const f of page.frames()) {
    try {
      const [l, x] = await f.evaluate(() => [window.__glLive?.() ?? [], window.__glLost?.() ?? []]);
      n += l.length; for (const p of l) by[p] = (by[p] ?? 0) + 1; for (const p of x) lost[p] = (lost[p] ?? 0) + 1;
    } catch {}
  }
  return { n, by, lost };
};
// what covers the screen: the front iframe and its state
const scene = () => page.evaluate(() => {
  const ifr = [...document.querySelectorAll('#end iframe')].map((f) => {
    let st = null;
    try { const w = f.contentWindow, d = w.document; st = { ready: !!w.deckStep?.ready, paused: !!w.deckPaused, gap: !!d.getElementById('gap')?.classList.contains('on'), win: d.body?.classList.contains('window') }; } catch {}
    return { c: f.className, src: (f.getAttribute('src') ?? '').split('?')[0], op: getComputedStyle(f).opacity, ...st };
  }).filter((x) => x.src && x.src !== 'about:blank');
  const s = window.talk?.state?.();
  return { s, ifr, noscene: document.body.classList.contains('noscene'), heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
    smoke: 'requestPaint' in HTMLCanvasElement.prototype, cvs: getComputedStyle(document.getElementById('c')).opacity };
});

note(`open talk.html mode=${MODE} gap=${GAP} headless=${HEADLESS} picks=${PICKS}`);
await page.goto('http://127.0.0.1:8123/drift-room/talk.html');
await page.waitForFunction(() => document.body.classList.contains('ready') && window.talk?.state, null, { timeout: 180000 });
note('ready');
await page.waitForTimeout(1500);
// the played steps (with picks)
const plan = await page.evaluate(() => window.talk.STEPS.map((s, i) => `${i}:${s.label}${s.part != null ? `#${s.part}` : ''}`));
writeFileSync(OUT + 'steps.txt', plan.join('\n'));
await page.mouse.click(700, 450);   // a click: sound starts, as a presenter would
const rows = [];
let lastStep = -1, stuck = 0;
const SEQ = (process.env.SEQ ?? '').split(',').filter(Boolean).map((x) => { const [k, ms] = x.split(':'); return { k, ms: Number(ms) }; });
for (let n = 0; n < (SEQ.length || MAXSTEPS); n++) {
  const q = SEQ[n] ?? { k: 'S', ms: GAP };
  if (q.k === 'S') await page.keyboard.press('Space'); else if (q.k === 'B') await page.keyboard.press('Shift+Space'); else if (q.k === 'R') await page.keyboard.down('ArrowRight'); else if (q.k === 'r') await page.keyboard.up('ArrowRight'); else if (q.k === 'L') await page.keyboard.down('ArrowLeft'); else if (q.k === 'l') await page.keyboard.up('ArrowLeft'); else if (q.k === 'P') await page.keyboard.press('PageDown');
  await page.waitForTimeout(q.ms);
  if (q.ms < 1000) continue;   // measure only after a longer wait
  const sc = await scene().catch((e) => ({ err: e.message }));
  const gl = await live();
  const shot = `s${String(n).padStart(3, '0')}.jpg`;
  await page.screenshot({ path: OUT + shot, type: 'jpeg', quality: 50 }).catch((e) => note(`shot failed ${e.message}`));
  const r = { n, step: sc.s?.step, label: sc.s?.label, part: sc.s?.part, pageOk: sc.s?.pageOk, gl: gl.n, by: gl.by, lost: gl.lost, heap: sc.heap, ifr: sc.ifr, smoke: sc.smoke };
  rows.push(r);
  note(`#${n} step ${r.step} ${r.label}${r.part != null ? ` #${r.part}` : ''} ok=${r.pageOk} gl=${r.gl} ${JSON.stringify(r.by)} lost=${JSON.stringify(r.lost)} heap=${r.heap} ifr=${JSON.stringify(sc.ifr?.map((f) => `${f.c}:${f.op}${f.ready ? '' : ':NOTREADY'}${f.paused ? ':P' : ''}${f.gap ? ':GAP' : ''}`))}`);
  if (/Laulupeo|laul/i.test(sc.s?.label ?? '') || (r.step ?? 0) >= Number(process.env.STOPSTEP ?? 999)) { if (++stuck > 2) break; }
  if (r.step === lastStep && MODE !== 'fast') note('  (did not move)');
  lastStep = r.step;
}
if (MODE === 'fast') { await page.waitForTimeout(6000); const sc = await scene(); const gl = await live(); note(`settled: ${JSON.stringify(sc.s)} gl=${gl.n} ${JSON.stringify(gl.by)} lost=${JSON.stringify(gl.lost)} ifr=${JSON.stringify(sc.ifr)}`); await page.screenshot({ path: OUT + 'settled.jpg', type: 'jpeg', quality: 50 }); }
writeFileSync(OUT + 'rows.json', JSON.stringify(rows, null, 1));
writeFileSync(OUT + 'log.txt', log.join('\n'));
note(`done ${OUT}`);
await browser.close();
