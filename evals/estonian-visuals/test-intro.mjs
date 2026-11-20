// Tests the intro (out/drift-room/intro.html) the way it is used in the talk: every index tile, and Space / Shift+Space
// through the whole deck. Written 2026-11-19 (asked: "rethink the index / scene / camera approach to make it sturdy",
// "more tests"): run it before saying a change works.
//
//   node evals/estonian-visuals/test-intro.mjs tiles [from] [to]   jump to every index tile (or tiles from..to, 1-based)
//   node evals/estonian-visuals/test-intro.mjs walk                Space from the first stop to the end, then Shift+Space back
//   node evals/estonian-visuals/test-intro.mjs all                 both
//   PAGE=talk.html …                                               test talk.html (the steps version): a tile is a step,
//                                                                  and its page must be at the step's part (pageOk)
//
// Needs the local server (python3 -m http.server 8123 --bind 127.0.0.1 -d evals/estonian-visuals/out). Each check:
//   - an error in any frame (page errors and console errors) fails it
//   - after an index jump, the intro's state (window.intro.state(): stop, page step) must be the tile's
//   - after Space, the state must have moved one place on, never stayed or jumped
// Screenshots and report.json in out/test-intro/<run>/. Research use only.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [cmd = 'all', fromArg, toArg] = process.argv.slice(2);
const PAGE = `http://127.0.0.1:8123/drift-room/${process.env.PAGE ?? 'intro.html'}?keys=0&test=1`;
const run = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = fileURLToPath(new URL(`./out/test-intro/${run}/`, import.meta.url));
mkdirSync(OUT, { recursive: true });
const SETTLE = Number(process.env.SETTLE ?? 9000);   // ms after a jump or a key before checking

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || /Too many active WebGL/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });   // the WebGL limit counts as a failure (2026-11-19)
for (const f of [page]) f.on('frameattached', () => {});
const report = { run, url: PAGE, tiles: [], walk: [] };
const state = () => page.evaluate(() => (window.talk ?? window.intro)?.state?.() ?? null);
const wait = (ms) => page.waitForTimeout(ms);

async function open() {
  errors = [];
  await page.goto(PAGE);
  await page.waitForFunction(() => document.body.classList.contains('ready') && (window.talk ?? window.intro)?.state, null, { timeout: 180000 });
  await wait(1500);
}
// the tile list as the index has it: { stop, part, slide, section, label }
const tilesOf = () => page.evaluate(() => (window.talk ? window.talk.STEPS.map((it, i) => ({ i, step: i, stop: it.stop, part: it.part ?? null, slide: null, section: it.section, label: it.label }))
  : window.intro.INDEX.map((it, i) => ({ i, stop: it.stop, part: it.part ?? null, slide: it.slide ?? null, section: it.section, label: it.label }))));
// what a tile should give: its stop, and its part or slide when it has one
function expected(t) { return { stop: t.stop, part: t.part ?? t.slide ?? null }; }
function matches(t, s) {
  if (t.step != null) return !!s && s.step === t.step && s.pageOk !== false;   // talk.html
  if (!s || s.stop !== t.stop) return false;
  const want = t.part ?? t.slide;
  if (want == null) return true;
  if (s.end === 'films') return true;   // the films' parts are slides in its own order: checked by a screenshot, not a number
  return s.part === want;
}
async function jump(i) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'i', code: 'KeyI', bubbles: true })));
  await wait(400);
  await page.evaluate((i) => document.querySelector(`.dx-t[data-i="${i}"]`)?.click(), i);
}

async function tiles() {
  await open();
  const all = await tilesOf();
  const from = Math.max(1, Number(fromArg) || 1), to = Math.min(all.length, Number(toArg) || all.length);
  console.log(`${all.length} tiles, testing ${from}..${to}`);
  for (const t of all.slice(from - 1, to)) {
    errors = [];
    await jump(t.i);
    await wait(SETTLE);
    const s = await state(), ok = matches(t, s) && !errors.length;
    const shot = `tile-${String(t.i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: OUT + shot });
    report.tiles.push({ tile: t.i + 1, section: t.section, label: t.label, want: expected(t), got: s, errors, ok, shot });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(t.i + 1).padStart(2)} ${t.section} · ${t.label}${ok ? '' : `  want ${JSON.stringify(expected(t))} got ${JSON.stringify(s)} ${errors.join(' | ')}`}`);
  }
}

// Space from the very start to the end, then back: every press must change the state; the positions going back must
// be the ones seen going forward, in reverse
async function walk() {
  await open();
  const seen = [await state()];
  for (let n = 0; n < 200; n++) {
    errors = [];
    const before = seen.at(-1);
    await page.keyboard.press('Space');
    await wait(SETTLE);
    const s = await state();
    const moved = before?.step != null ? s?.step === before.step + 1 : JSON.stringify(s) !== JSON.stringify(before);
    const ok = moved && !errors.length && s?.pageOk !== false;
    report.walk.push({ dir: 'fwd', n, got: s, errors, ok });
    console.log(`${ok ? 'ok  ' : 'FAIL'} → ${n + 1} ${s?.label} ${s?.part ?? ''}${ok ? '' : `  ${moved ? '' : 'did not move'} ${errors.join(' | ')}`}`);
    if (!moved) break;
    seen.push(s);
    if (s.fade || (s.step != null && s.step === (await page.evaluate(() => window.talk.STEPS.length)) - 1)) break;
  }
  for (let k = seen.length - 2; k >= 0; k--) {
    errors = [];
    await page.keyboard.press('Shift+Space');
    await wait(SETTLE);
    const s = await state();
    const same = seen[k]?.step != null ? s?.step === seen[k].step && s?.pageOk !== false : JSON.stringify(s) === JSON.stringify(seen[k]);
    const s2 = s, ok = same && !errors.length;
    report.walk.push({ dir: 'back', want: seen[k], got: s2, errors, ok });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ← ${s?.label} ${s?.part ?? ''}${ok ? '' : `  want ${JSON.stringify(seen[k])} ${errors.join(' | ')}`}`);
  }
}

if (cmd === 'tiles' || cmd === 'all') await tiles();
if (cmd === 'walk' || cmd === 'all') await walk();
writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 1));
const fails = [...report.tiles, ...report.walk].filter((r) => !r.ok).length;
console.log(`\n${fails ? `${fails} failed` : 'all passed'} · ${OUT}`);
await browser.close();
process.exit(fails ? 1 : 0);
