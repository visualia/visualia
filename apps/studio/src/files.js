// Multi-file projects (plans/multi-file.md): the pieces the agent and the Worker
// share, kept pure so node can test them against the step-0 captures.
// A project of kind 'files' is a folder; a one-page project is just index.html.

// ---- the model's stream ------------------------------------------------------

// Collects one streamed answer: text and tool calls, from OpenAI
// `delta.tool_calls` fragments or the native top-level `tool_calls`. A new id
// starts a new call even when the index repeats (Gemma 4 sends four calls of
// one reply all as index 2). push() returns the calls an event touched.
export function collector() {
  const calls = [], byIndex = new Map();
  const out = { calls, text: '', finish: null };
  out.push = (e) => {
    const touched = new Set();
    const c = e.choices?.[0];
    if (c?.delta?.content) out.text += c.delta.content;
    else if (typeof e.response === 'string') out.text += e.response;
    if (c?.finish_reason) out.finish = c.finish_reason;
    for (const t of c?.delta?.tool_calls ?? []) {
      const i = t.index ?? 0;
      let call = byIndex.get(i);
      if (!call || (t.id && call.id !== t.id)) {
        call = { id: t.id || `call_${calls.length}`, name: '', args: '' };
        calls.push(call); byIndex.set(i, call);
      }
      if (t.function?.name) call.name = t.function.name;
      const a = t.function?.arguments;
      if (a != null) call.args += typeof a === 'string' ? a : JSON.stringify(a);
      touched.add(call);
    }
    for (const t of e.tool_calls ?? []) { // native shape: whole, arguments maybe an object
      const a = t.arguments ?? t.function?.arguments ?? {};
      const call = { id: t.id || `call_${calls.length}`, name: t.name ?? t.function?.name ?? '', args: typeof a === 'string' ? a : JSON.stringify(a) };
      calls.push(call); touched.add(call);
    }
    return [...touched];
  };
  return out;
}

// A JSON string value read from partial text, starting just after its opening
// quote at `i`: as much as has arrived, stopping before a cut escape.
export function readString(s, i) {
  let value = '';
  while (i < s.length) {
    const q = s.indexOf('"', i), b = s.indexOf('\\', i);
    const stop = q < 0 ? b : b < 0 ? q : Math.min(q, b);
    if (stop < 0) { value += s.slice(i); i = s.length; break; }
    value += s.slice(i, stop); i = stop;
    if (s[i] === '"') return { value, end: i + 1, done: true };
    if (i + 1 >= s.length) break;
    const e = s[i + 1];
    if (e === 'u') {
      if (i + 6 > s.length) break;
      value += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 6;
    } else { value += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[e] ?? e; i += 2; }
  }
  return { value, end: i, done: false };
}

// A top-level string field of partial JSON arguments: { value, done }, or
// null before it starts. An unescaped `"key"` can't occur inside a string.
export function field(args, key) {
  const m = new RegExp(`"${key}"\\s*:\\s*"`).exec(args);
  return m ? readString(args, m.index + m[0].length) : null;
}

// Follows a `write` call's content as it streams: call.content grows, decoded
// once per character. Works whichever key comes first.
export function follow(call) {
  if (call.at == null) {
    const m = /"content"\s*:\s*"/.exec(call.args);
    if (!m) return;
    call.at = m.index + m[0].length; call.content = '';
  }
  if (call.contentDone) return;
  const r = readString(call.args, call.at);
  call.content += r.value; call.at = r.end; call.contentDone = r.done;
}

// A path as the model wrote it, relative to the project folder.
export function rel(path) {
  if (typeof path !== 'string') return null;
  const parts = [];
  for (const p of path.replace(/^\/workspace(\/|$)/, '').split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') return null;
    parts.push(p);
  }
  return parts.length ? parts.join('/') : null;
}

// ---- the edit guard (Gemma 4) -------------------------------------------------
// Gemma's edits match but treat oldText as "a place to put the new text",
// deleting unrelated CSS (plans/multi-file.md, Capture §4). Returns why an
// edit looks harmful, or null.

const solid = (s) => s.replace(/\s+/g, '').length;
const css = (path, s) => (/\.css$/i.test(path) ? s : /\.html?$/i.test(path) ? [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') : '');
const rules = (s) => [...s.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), decls: m[2].split(';').filter((d) => d.includes(':')).length }));
const REMOVING = /\b(remove|delete|without|drop|simpl|fewer|less|clean|eemalda|kustuta|ilma|vähem)/i;

export function editHarm(path, before, after, request) {
  const a = solid(before), b = solid(after);
  if (a > 200 && b < a * 0.7) return `the file lost ${Math.round(100 - (b * 100) / a)}% of its content`;
  if (REMOVING.test(request)) return null;
  const was = rules(css(path, before)), now = rules(css(path, after));
  const sels = new Set(now.map((r) => r.sel));
  const asked = request.toLowerCase();
  const gone = was.filter((r) => !sels.has(r.sel) && !(r.sel.toLowerCase().match(/[a-z][\w-]*/g) ?? []).some((w) => w.length > 1 && asked.includes(w)));
  if (gone.length) return `it deleted the rules for ${gone.map((r) => r.sel).join(', ')}, which the request didn't mention`;
  const lost = was.reduce((n, r) => n + r.decls, 0) - now.reduce((n, r) => n + r.decls, 0);
  if (lost >= 2) return `it deleted ${lost} CSS declarations`;
  return null;
}

// ---- links that break once published --------------------------------------------
// A project is published under /<person>/<slug>/, so "/style.css" points
// outside it. One problem per file and link.
const ROOTED = [
  /\b(?:src|href|action|poster)\s*=\s*["']\/(?!\/)([^"']*)["']/gi,
  /\bfrom\s*["']\/(?!\/)([^"']*)["']/g,
  /\bimport\s*\(?\s*["']\/(?!\/)([^"']*)["']/g,
  /\burl\(\s*["']?\/(?!\/)([^"')]*)/g,
  /\bfetch\(\s*["']\/(?!\/)([^"']*)["']/g,
];
export function rootedLinks(files) {
  const out = [];
  for (const [path, text] of Object.entries(files)) {
    const seen = new Set();
    for (const re of ROOTED) for (const m of text.matchAll(re)) {
      const to = m[1] || 'index.html';
      if (seen.has(to)) continue;
      seen.add(to);
      out.push(`${path} links "/${m[1]}" from the site's root, which breaks once published; use a relative path ("${to}")`);
    }
  }
  return out;
}

// ---- serving ---------------------------------------------------------------------

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf',
};
export const typeOf = (path) => MIME[path.split('.').pop().toLowerCase()] ?? 'application/octet-stream';
export const isText = (type) => /^text\/|json|svg/.test(type);

// The same as published single pages, plus CORS: a sandboxed page has an
// opaque origin, so its modules, fetches and textures are cross-origin.
export function fileHeaders(type, cache) {
  return {
    'content-type': type,
    'content-security-policy': 'sandbox allow-scripts allow-popups allow-forms allow-pointer-lock',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
    'cache-control': cache,
  };
}

// Each preview page reports its own errors to the studio (as project.html does
// for single pages), so "Fix it" and auto-fix work on every page of a site.
export const REPORTER = `<script>(function(){var s=function(m){parent.postMessage({visualiaError:String(m).slice(0,240)},'*')};
addEventListener('error',function(e){var t=e.target;if(t&&t!==window&&(t.src||t.href)){s('Could not load '+(t.src||t.href))}else{s(e.message)}},true);
addEventListener('unhandledrejection',function(e){s((e.reason&&e.reason.message)||e.reason)});
var ce=console.error;console.error=function(){s(Array.prototype.join.call(arguments,' '));ce.apply(console,arguments)};})();</script>`;
export const withReporter = (html) => (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + REPORTER) : REPORTER + html);

// ---- the preview's signed path ----------------------------------------------------
// preview.<host>/<project>.<sig>/<path> is the working copy;
// /<project>.v<n>.<sig>/<path> is version n. The signature covers the
// visibility, so making a project private kills the links the class had.

export async function hmac(secret, value) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export const previewSig = async (env, id, n, visibility) => (await hmac(env.SESSION_SECRET, `preview:${id}:${n}:${visibility}`)).slice(0, 22);
export const previewUrl = async (env, id, n, visibility) =>
  `https://${env.PREVIEW_HOST}/${id}${n ? `.v${n}` : ''}.${await previewSig(env, id, n, visibility)}/`;
