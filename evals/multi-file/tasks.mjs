// The five local-coding eval tasks (plans/local-coding.md section 7): briefs and
// fixtures from tasks.json and fixtures/, and every check that needs no browser.
// capture.mjs --tasks runs them; tasks-test.mjs checks the checks.

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';

export const TASKS = JSON.parse(readFileSync(new URL('./tasks.json', import.meta.url), 'utf8'));

// Added to capture.mjs's SYSTEM for a task: the first-pages page rules, for several files.
export const TASK_SYSTEM = [
  'Any visible text is in Estonian.',
  'Every page must work on a 375 px wide phone screen without horizontal scrolling.',
  'Load libraries only from https://cdnjs.cloudflare.com or https://cdn.jsdelivr.net with an exact version.',
].join(' ');

export const PAGE_CHECKS = ['html', 'clean', 'visible', 'fits'];

export function loadFixture(name) {
  const root = new URL(`./fixtures/${name}/`, import.meta.url);
  const out = {};
  const walk = (rel) => {
    for (const f of readdirSync(new URL(rel || '.', root)).sort()) {
      const p = rel + f;
      if (statSync(new URL(p, root)).isDirectory()) walk(p + '/'); else out[p] = readFileSync(new URL(p, root), 'utf8');
    }
  };
  walk('');
  return out;
}

// The opening messages: a fixture is shown as read results after the brief, the
// same way capture.mjs's edit case feeds files back.
export function openingMessages(task, system, fs) {
  const user = { role: 'user', content: task.brief };
  const paths = Object.keys(fs);
  if (!paths.length) return [{ role: 'system', content: system }, user];
  const reads = paths.map((p, i) => ({ id: `call_read_${i}`, type: 'function', function: { name: 'read', arguments: JSON.stringify({ path: p }) } }));
  return [
    { role: 'system', content: system }, user,
    { role: 'assistant', content: '', tool_calls: reads },
    ...reads.map((c, i) => ({ role: 'tool', tool_call_id: c.id, content: fs[paths[i]] })),
  ];
}

// The project as it would be served: real folders, so relative links work over HTTP.
export function writeTree(fs, dirUrl) {
  const skipped = [];
  for (const [p, t] of Object.entries(fs)) {
    if (p.split('/').includes('..') || p.startsWith('/')) { skipped.push(p); continue; }
    const file = new URL(p, dirUrl);
    mkdirSync(new URL('.', file), { recursive: true });
    writeFileSync(file, t);
  }
  return skipped;
}

// Links between the files written: relative, and pointing at files that exist.
export function linkCheck(fs) {
  const refs = [];
  for (const [p, t] of Object.entries(fs)) {
    if (!/\.html?$/.test(p)) continue;
    for (const m of t.matchAll(/\b(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)) refs.push({ from: p, to: m[1] });
  }
  const own = refs.filter((r) => !/^(https?:|data:|mailto:|\/\/)/i.test(r.to));
  return {
    refs: own.map((r) => `${r.from}→${r.to}`),
    absolute: own.filter((r) => r.to.startsWith('/')).length,
    missing: own.filter((r) => !(r.to.replace(/^\.?\//, '') in fs)).map((r) => `${r.from}→${r.to}`),
  };
}

// The pages to load: a single-page task whose page has another name loads that one.
export function pagesOf(task, fs) {
  const html = Object.keys(fs).filter((p) => /\.html?$/.test(p));
  if (task.pages.length === 1 && !(task.pages[0] in fs) && html.length === 1) return html;
  return task.pages;
}

export function isDocument(text) { return typeof text === 'string' && /<html[\s>]/i.test(text) && /<\/html>/i.test(text); }

// Grade one task. `seen` is checkPages()'s result per page, or null without a browser:
// then the browser checks read null and pass is null unless a static check already failed.
export function judge(task, fs, seen = null) {
  const fixture = task.fixture ? loadFixture(task.fixture) : {};
  const pages = pagesOf(task, fs);
  const r = { pages, html: pages.every((p) => isDocument(fs[p])), clean: null, visible: null, fits: null, links: linkCheck(fs), failed: [] };
  if (seen) for (const k of ['clean', 'visible', 'fits']) r[k] = pages.every((p) => seen[p]?.[k] === true);
  const fail = (why) => r.failed.push(why);

  if (task.files) for (const f of task.files) if (!(f in fs)) fail(`missing ${f}`);
  if (task.files || task.linked) {
    if (r.links.absolute) fail(`${r.links.absolute} absolute links`);
    for (const m of r.links.missing) fail(`broken link ${m}`);
  }
  for (const [page, targets] of Object.entries(task.linked ?? {})) {
    for (const t of targets) if (!r.links.refs.includes(`${page}→${t}`) && !r.links.refs.includes(`${page}→./${t}`)) fail(`${page} does not link ${t}`);
  }
  for (const f of task.unchanged ?? []) if (norm(fs[f] ?? '') !== norm(fixture[f] ?? '') || !(f in fs)) fail(`${f} changed`);
  for (const [f, strings] of Object.entries(task.keep ?? {})) for (const s of strings) if (!(fs[f] ?? '').includes(s)) fail(`${f} lost ${s}`);
  if (task.headingColourOnly) {
    const f = task.headingColourOnly;
    r.css = cssOnlyHeadingColour(fixture[f] ?? '', fs[f] ?? '');
    if (!(f in fs)) fail(`missing ${f}`);
    for (const p of r.css.problems) fail(`${f}: ${p}`);
  }
  if (task.importMap) {
    r.importMap = importMapCheck(fs, pages, task.importMap);
    for (const p of r.importMap.problems) fail(p);
    if (seen) {
      r.importMap.resolves = !!r.importMap.url && pages.some((p) => (seen[p]?.responses ?? []).some((x) => x.url === r.importMap.url && x.status < 400));
      if (!r.importMap.resolves) fail(`import map URL did not load: ${r.importMap.url ?? 'none'}`);
    }
  }
  if (task.facts) {
    // In the rendered text when there is a browser (entities decoded, text-transform ignored), else in the source.
    const text = seen ? pages.map((p) => seen[p]?.text ?? '').join(' ') : pages.map((p) => fs[p] ?? '').join(' ');
    r.facts = factCheck(task.facts, text);
    r.facts.from = seen ? 'rendered text' : 'source';
    for (const f of r.facts.missing) fail(`fact missing: ${f}`);
  }
  if (task.textMatches && seen) {
    const text = pages.map((p) => seen[p]?.text ?? '').join(' ');
    for (const re of task.textMatches) if (!new RegExp(re, 'u').test(text)) fail(`page text lacks /${re}/`);
  }
  if (task.headingRed && seen) {
    r.headings = Object.fromEntries(pages.map((p) => [p, seen[p]?.h1 ?? []]));
    for (const p of pages) {
      const h = seen[p]?.h1 ?? [];
      if (!h.length) fail(`${p}: no h1`);
      else if (!h.every(isRed)) fail(`${p}: h1 is rgb(${h.find((c) => !isRed(c)).join(', ')}), not red`);
    }
  }
  const page = task.need.map((k) => r[k]);
  const pending = page.includes(null) || (!seen && !!(task.textMatches || task.headingRed || task.importMap));
  r.pass = r.failed.length || page.includes(false) ? false : pending ? null : true;
  return r;
}

export const isRed = ([r, g, b]) => r >= 150 && g <= 90 && b <= 90;

// case is free: a poster may set its facts in capitals; the words, digits and dashes are not
export function factCheck(facts, text) {
  const low = (x) => x.normalize('NFC').toLocaleLowerCase('et');
  const t = low(text).replace(/\s+/g, ' ');
  const missing = facts.filter((f) => !t.includes(low(f)));
  return { found: facts.length - missing.length, of: facts.length, missing };
}

export function importMapCheck(fs, pages, name) {
  const problems = [];
  let map = null, url = null;
  for (const p of pages) {
    const m = (fs[p] ?? '').match(/<script[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!m) continue;
    try { map = JSON.parse(m[1]); } catch (e) { problems.push(`${p}: import map is not JSON (${String(e.message).slice(0, 60)})`); }
    break;
  }
  if (!map && !problems.length) problems.push('no import map');
  if (map) {
    url = map.imports?.[name] ?? null;
    if (!url) problems.push(`import map has no "${name}"`);
    else if (!/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//.test(url)) problems.push(`${name} is not from cdnjs or jsdelivr: ${url}`);
    else if (!/\d+\.\d+\.\d+/.test(url)) problems.push(`${name} has no exact version: ${url}`);
  }
  // The bare name must be imported somewhere, or the map is decoration.
  const bare = new RegExp(`(from\\s*|import\\s*\\(\\s*|import\\s+)["']${name}["']`);
  if (!Object.entries(fs).some(([p, t]) => /\.(m?js|html?)$/.test(p) && bare.test(t))) problems.push(`nothing imports "${name}" by its bare name`);
  return { url, problems };
}

// ---- CSS: everything but the heading's colour stays as it was -----------------

function norm(s) { return s.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim(); }
function normCss(s) { return norm(s).replace(/\s*([{}:;,>+~()])\s*/g, '$1').replace(/;}/g, '}').replace(/;$/, ''); }

// Top-level blocks: { sel, body } for a rule or an @media block, { sel, body: null } for `@import ...;`.
export function cssBlocks(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < src.length) {
    const brace = src.indexOf('{', i), semi = src.indexOf(';', i);
    if (brace < 0 && semi < 0) break;
    if (semi >= 0 && (brace < 0 || semi < brace)) { const s = normCss(src.slice(i, semi)); if (s) out.push({ sel: s, body: null }); i = semi + 1; continue; }
    let depth = 1, j = brace + 1;
    for (; j < src.length && depth; j++) depth += src[j] === '{' ? 1 : src[j] === '}' ? -1 : 0;
    out.push({ sel: normCss(src.slice(i, brace)), body: normCss(src.slice(brace + 1, j - 1)) });
    i = j;
  }
  return out;
}

function decls(body) {
  const out = {};
  let depth = 0, cur = '';
  for (const ch of body + ';') {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && !depth) { const k = cur.indexOf(':'); if (k > 0) out[cur.slice(0, k).trim().toLowerCase()] = cur.slice(k + 1).trim(); cur = ''; } else cur += ch;
  }
  return out;
}

// A selector list whose every part ends in an h1 (h1, header>h1, h1.title).
export const isHeadingSelector = (sel) => !sel.startsWith('@') && sel.split(',').every((p) => /(^|[\s>+~])h1(?![\w-])[^\s>+~]*$/.test(p.trim()));

export function cssOnlyHeadingColour(before, after) {
  const A = cssBlocks(before), B = cssBlocks(after);
  const used = new Set(), problems = [];
  const withoutColour = (body) => { const d = decls(body); delete d.color; return JSON.stringify(Object.entries(d).sort()); };
  for (const a of A) {
    const k = B.findIndex((b, i) => !used.has(i) && b.sel === a.sel);
    if (k < 0) { problems.push(`removed ${a.sel}`); continue; }
    used.add(k);
    const b = B[k];
    if (a.body === b.body) continue;
    if (isHeadingSelector(a.sel) && a.body != null && b.body != null && withoutColour(a.body) === withoutColour(b.body)) continue;
    problems.push(`changed ${a.sel}`);
  }
  B.forEach((b, i) => {
    if (used.has(i)) return;
    if (isHeadingSelector(b.sel) && b.body != null && Object.keys(decls(b.body)).every((p) => p === 'color')) return;
    problems.push(`added ${b.sel}`);
  });
  return { ok: !problems.length, problems };
}
