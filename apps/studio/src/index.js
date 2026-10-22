// visualia studio: describe a page, watch it build, change it, publish it.
// visualia.space            the studio (sign in with a course key)
// projects.visualia.space   published projects, served sandboxed
// preview.visualia.space    a multi-file project's working copy and versions, signed paths
// See plans/studio-core.md, plans/multi-file.md.

import { WorkerEntrypoint } from 'cloudflare:workers';
import { getAgentByName, routeAgentRequest } from 'agents';
import { thumb, WIDTHS } from './thumbs.js';
import { fileHeaders, previewSig, previewUrl, rel, withReporter } from './files.js';
export { StudioAgent } from './agent.js';
export { Class } from './class.js';

const COOKIE = '__Host-visualia';

// The MCP server (apps/mcp, mcp.visualia.space) reads through here, over a
// service binding only, never the internet. It has already signed the person
// in (OAuth with their course key) and names them in x-visualia-person. GET
// only, through the same handlers and visibility rules as the pages, so what
// an AI tool sees is exactly what the person sees in the studio.
//   GET /api/projects                 everyone's work + the person's private projects
//   GET /api/projects/:id             one project (404 if they may not see it)
//   GET /api/projects/:id/versions/:n a version: the page, or a files manifest
//   GET /api/chat?limit=n             the class chat's latest messages
//   GET /api/usage                    what the usage page shows
export class ForMcp extends WorkerEntrypoint {
  async fetch(request) {
    const env = this.env;
    const person = request.headers.get('x-visualia-person');
    if (request.method !== 'GET' || !person) return json({ error: 'not found' }, 404);
    // Still a member: a revoked key stops an AI tool at its next call.
    const member = await env.DB.prepare(
      'SELECT p.school_id FROM people p WHERE p.id = ? AND EXISTS (SELECT 1 FROM keys k WHERE k.person_id = p.id AND k.revoked_at IS NULL)',
    ).bind(person).first();
    if (!member) return json({ error: 'not a member' }, 401);
    const url = new URL(request.url);
    if (url.pathname === '/api/usage') return json(await usage(env, person));
    if (url.pathname === '/api/chat') {
      const messages = await (await getAgentByName(env.Class, member.school_id)).recent(url.searchParams.get('limit'));
      return json({ messages });
    }
    if (url.pathname.startsWith('/api/projects')) return api(request, url, env, person);
    return json({ error: 'not found' }, 404);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.hostname === env.PROJECTS_HOST) return await published(url, env);
      if (url.hostname === env.PREVIEW_HOST) return await preview(url, env);

      // The studio answers on each of STUDIO_HOSTS (visualia.space, studio.visualia.space).
      if (!env.STUDIO_HOSTS.split(' ').includes(url.hostname)) return text('not found', 404);
      // Writes only from the studio's own pages, on the same host.
      if (request.method !== 'GET' && request.method !== 'HEAD' && !url.pathname.startsWith('/agents/')) {
        if (request.headers.get('origin') !== url.origin) return text('forbidden', 403);
      }
      if (url.pathname === '/login' && request.method === 'POST') return await login(request, env);
      if (url.pathname === '/logout' && request.method === 'POST') return logout();

      const person = await session(request, env);

      if (url.pathname.startsWith('/agents/')) {
        if (!person) return text('sign in first', 401);
        // The class is open to every member of the school; a project to its
        // owner, and to the class when shared (visibility 'class').
        // The agent learns who is asking from x-visualia-person, set here and
        // nowhere else (a client's own header is overwritten).
        const allowed = async (req, route) => {
          const school = await schoolOf(env, person);
          const ok = route.className === 'Class'
            ? route.name === school
            : await canSee(env, school, person, route.name);
          if (!ok) return text('not in your class', 403);
          const headers = new Headers(req.headers);
          headers.set('x-visualia-person', person);
          return new Request(req, { headers });
        };
        return (
          (await routeAgentRequest(request, env, {
            onBeforeConnect: async (req, route) => {
              // Sockets only from the studio's own pages (a published page or a preview has another origin).
              if (req.headers.get('origin') !== url.origin) return text('forbidden', 403);
              return allowed(req, route);
            },
            // Plain HTTP to a project's agent would serve its files on the studio's
            // origin: only the preview host reaches onRequest.
            onBeforeRequest: async (req, route) => {
              const r = await allowed(req, route);
              return r instanceof Request && route.className === 'StudioAgent' ? text('not found', 404) : r;
            },
          })) ?? text('not found', 404)
        );
      }

      if (url.pathname === '/api/usage') {
        if (!person) return json({ error: 'sign in first' }, 401); // everyone in the class sees it
        return json(await usage(env, person));
      }
      // GET /thumb/<id>/<n>/<w>: a version's screenshot, top 3:4, WebP (thumbs.js). Same rules as files.
      const t = url.pathname.match(/^\/thumb\/(\w+)\/(\d+)\/(\d+)$/);
      if (t) {
        if (!person) return text('sign in first', 401);
        const [, id, n, w] = t;
        if (!WIDTHS.includes(Number(w)) || !(await visible(env, await schoolOf(env, person), person, id))) return text('not found', 404);
        const bytes = await thumb(env, id, Number(n), Number(w));
        if (!bytes) return text('not found', 404);
        return new Response(bytes, { headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=31536000, immutable' } });
      }

      if (url.pathname.startsWith('/api/')) {
        if (!person) return json({ error: 'sign in first' }, 401);
        return await api(request, url, env, person);
      }

      // Static files (the stylesheet, images) are public: serve them before the sign-in check.
      if (/\.(css|js|json|png|jpg|svg|ico|woff2?)$/.test(url.pathname)) return env.ASSETS.fetch(request); // text.json: the words, before sign-in too

      // Pages
      if (!person) return page(env, request, '/login');
      if (url.pathname === '/') return page(env, request, '/');
      if (/^\/p\/[\w-]+\/?$/.test(url.pathname)) return page(env, request, '/project');
      if (url.pathname === '/usage') return page(env, request, '/usage');
      return env.ASSETS.fetch(request);
    } catch (err) {
      return json({ error: 'studio error', detail: String(err?.message ?? err) }, 500);
    }
  },
};

// ---- API -------------------------------------------------------------------

async function api(request, url, env, person) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'projects', id, ...]
  if (parts[1] !== 'projects') return json({ error: 'not found' }, 404);

  const school = await schoolOf(env, person);

  // Everyone's work: the projects shared with the class, latest change first;
  // and the person's own private ones, for them alone.
  if (parts.length === 2 && request.method === 'GET') {
    const cols = `p.id, p.slug, p.title, p.person_id, p.versions, p.published_version, p.created_at,
      coalesce(p.updated_at, p.created_at) AS updated_at`;
    const [shared, mine] = await env.DB.batch([
      env.DB.prepare(`SELECT ${cols} FROM projects p JOIN people o ON o.id = p.person_id
        WHERE o.school_id = ? AND p.visibility = 'class' ORDER BY coalesce(p.updated_at, p.created_at) DESC`).bind(school),
      env.DB.prepare(`SELECT ${cols} FROM projects p WHERE p.person_id = ? AND p.visibility = 'private'
        ORDER BY coalesce(p.updated_at, p.created_at) DESC`).bind(person),
    ]);
    return json({ person, school, projects: shared.results, private: mine.results });
  }

  if (parts.length === 2 && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? '').trim().slice(0, 80);
    if (!title) return json({ error: 'a title is needed' }, 400);
    return json(await newProject(env, person, title));
  }

  // Someone else's private project is "not found", the same as another school's.
  const id = parts[2];
  const project = await visible(env, school, person, id);
  if (!project) return json({ error: 'not found' }, 404);

  if (parts.length === 3 && request.method === 'GET') {
    // Credit both ways: where a remix came from (named and linked only if this
    // person may see the source), and how often this one was remixed into
    // projects shared with the class (a private remix stays its owner's secret).
    const [src, remixes] = await env.DB.batch([
      env.DB.prepare(`SELECT p.id, p.title, p.person_id, p.visibility, o.school_id FROM projects p JOIN people o ON o.id = p.person_id WHERE p.id = ?`).bind(project.from_project ?? ''),
      env.DB.prepare("SELECT count(*) AS n FROM projects WHERE from_project = ? AND visibility = 'class'").bind(id),
    ]);
    const s = src.results[0];
    const seen = s && s.school_id === school && (s.visibility === 'class' || s.person_id === person);
    const from = project.from_project ? { id: seen ? s.id : null, title: seen ? s.title : null, owner: s?.person_id ?? null, version: project.from_version } : null;
    return json({
      ...project, me: person, url: project.published_version ? publicUrl(env, project) : null, from, remixes: remixes.results[0].n,
      ...(project.kind === 'files' ? { preview: await previewUrl(env, id, 0, project.visibility) } : {}),
    });
  }

  // POST /api/projects/:id/kind  { kind: 'files' }  -> the owner makes it a
  // multi-file project: the agent imports the latest page as index.html.
  if (parts[3] === 'kind' && request.method === 'POST') {
    if (project.person_id !== person) return json({ error: 'Only the owner can change this.' }, 403);
    if (project.kind === 'files') return json({ kind: 'files' });
    const r = await (await getAgentByName(env.StudioAgent, id)).toFiles();
    if (r.error) return json({ error: r.error }, 409);
    await env.DB.prepare("UPDATE projects SET kind = 'files' WHERE id = ?").bind(id).run();
    return json({ kind: 'files' });
  }

  // POST /api/projects/:id/remix  -> a new private project of this person's,
  // starting from the source's current version: the page and the pictures it
  // uses copied to the new project's own keys (src rewritten), and the
  // screenshot. No model call, so no usage. A private project of someone else's
  // never gets here (404 above).
  if (parts[3] === 'remix' && request.method === 'POST') {
    const n = project.versions;
    // A multi-file version: the manifest is copied (its blobs are shared), and the agent writes the working copy from it.
    const manifest = n && project.kind === 'files' && (await env.PROJECTS.get(`projects/${id}/v/${n}.json`));
    if (manifest) {
      const made = await newProject(env, person, project.title, { from: id, version: n }, 'files');
      await env.PROJECTS.put(`projects/${made.id}/v/1.json`, await manifest.arrayBuffer(), { httpMetadata: { contentType: 'application/json' } });
      const shot = await env.PROJECTS.get(`projects/${id}/${n}.png`);
      if (shot) await env.PROJECTS.put(`projects/${made.id}/1.png`, await shot.arrayBuffer(), { httpMetadata: { contentType: 'image/png' } });
      await env.DB.prepare('UPDATE projects SET versions = 1 WHERE id = ?').bind(made.id).run();
      await (await getAgentByName(env.StudioAgent, made.id)).remixed({ person, from: id, version: n, kind: 'files' });
      return json(made);
    }
    const page = n && (await env.PROJECTS.get(`projects/${id}/${n}.html`));
    if (!page) return json({ error: 'Nothing to remix yet.' }, 400);
    let html = await page.text();
    const names = [...new Set([...html.matchAll(/src="(\d+-\d+\.jpg)"/g)].map((m) => m[1]))];
    const rename = Object.fromEntries(names.map((name, i) => [name, `1-${i + 1}.jpg`]));
    html = html.replace(/src="(\d+-\d+\.jpg)"/g, (m, name) => `src="${rename[name]}"`);
    const made = await newProject(env, person, project.title, { from: id, version: n }, project.kind);
    const copy = async (from, to, type) => {
      const obj = await env.PROJECTS.get(`projects/${id}/${from}`);
      if (obj) await env.PROJECTS.put(`projects/${made.id}/${to}`, await obj.arrayBuffer(), { httpMetadata: { contentType: type } });
    };
    await Promise.all([...names.map((name) => copy(name, rename[name], 'image/jpeg')), copy(`${n}.png`, '1.png', 'image/png')]);
    await env.PROJECTS.put(`projects/${made.id}/1.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
    await env.DB.prepare('UPDATE projects SET versions = 1 WHERE id = ?').bind(made.id).run();
    await (await getAgentByName(env.StudioAgent, made.id)).remixed({ person, from: id, version: n, kind: project.kind });
    return json(made);
  }

  // GET /api/projects/:id/versions/:n  -> the page, as text (rendered by the studio in a sandbox);
  // a multi-file version: its manifest and where the preview serves it.
  if (parts[3] === 'versions' && parts[4] && request.method === 'GET') {
    const n = Number(parts[4]);
    const man = n && (await env.PROJECTS.get(`projects/${id}/v/${n}.json`));
    if (man) return json({ ...(await man.json()), version: n, preview: await previewUrl(env, id, n, project.visibility) });
    const obj = await env.PROJECTS.get(`projects/${id}/${Number(parts[4])}.html`);
    if (!obj) return json({ error: 'no such version' }, 404);
    return new Response(await obj.text(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // GET /api/projects/:id/files/:name  -> a picture or a screenshot of this project
  if (parts[3] === 'files' && /^\d+(-\d+)?\.(png|jpg)$/.test(parts[4] ?? '') && request.method === 'GET') {
    const obj = await env.PROJECTS.get(`projects/${id}/${parts[4]}`);
    if (!obj) return json({ error: 'no such file' }, 404);
    return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' } });
  }

  // POST /api/projects/:id/visibility  { visibility: 'private' | 'class' }  -> the owner's choice.
  // Making it private closes everyone else's open sockets to its agent.
  if (parts[3] === 'visibility' && request.method === 'POST') {
    if (project.person_id !== person) return json({ error: 'Only the owner can change this.' }, 403);
    const { visibility } = await request.json().catch(() => ({}));
    if (visibility !== 'private' && visibility !== 'class') return json({ error: 'private or class' }, 400);
    await env.DB.prepare('UPDATE projects SET visibility = ? WHERE id = ?').bind(visibility, id).run();
    if (visibility === 'private') await (await getAgentByName(env.StudioAgent, id)).revoke(person);
    await (await getAgentByName(env.Class, school)).workChanged({ project: id }); // off the wall, or back on it
    return json({ visibility });
  }

  // POST /api/projects/:id/publish  { version? }  -> publish a version (latest by default)
  // Publishing stays with the owner, private or shared (plans/class-space.md).
  if (parts[3] === 'publish' && request.method === 'POST') {
    if (project.person_id !== person) return json({ error: 'Only the owner can publish.' }, 403);
    const body = await request.json().catch(() => ({}));
    const version = Number(body.version ?? project.versions);
    if (!version || version > project.versions) return json({ error: 'nothing to publish yet' }, 400);
    await env.DB.prepare('UPDATE projects SET published_version = ? WHERE id = ?').bind(version, id).run();
    return json({ url: publicUrl(env, { ...project, published_version: version }), version });
  }

  return json({ error: 'not found' }, 404);
}

// ---- usage: what the gateway recorded, visible to everyone signed in ----------
// Pseudonymous person ids only; no prompt text ever leaves the gateway.
// Someone else's private project shows as "a private project", never its title.

async function usage(env, person) {
  const sum = `count(*) AS calls, coalesce(sum(tokens_in),0) + coalesce(sum(tokens_cache_read),0) AS tokens_in,
    coalesce(sum(tokens_out),0) AS tokens_out, coalesce(sum(cost_usd),0) AS cost, sum(ok = 0) AS failed`;
  const [today, week, all, people, models, recent] = await env.DB.batch([
    env.DB.prepare(`SELECT ${sum} FROM usage WHERE ts >= date('now')`),
    env.DB.prepare(`SELECT ${sum} FROM usage WHERE ts >= date('now', '-6 days')`),
    env.DB.prepare(`SELECT ${sum} FROM usage`),
    env.DB.prepare(`SELECT person_id AS name, ${sum} FROM usage GROUP BY person_id ORDER BY cost DESC`),
    env.DB.prepare(`SELECT model AS name, ${sum}, avg(latency_ms) AS ms FROM usage GROUP BY model ORDER BY calls DESC`),
    env.DB.prepare(`SELECT u.ts, u.person_id, u.model, u.tokens_in, u.tokens_out, u.cost_usd, u.latency_ms, u.ok, u.error, u.served_by,
        CASE WHEN p.visibility = 'private' AND p.person_id != ? THEN 'a private project' ELSE p.title END AS title
      FROM usage u LEFT JOIN projects p ON p.id = u.project_id ORDER BY u.id DESC LIMIT 30`).bind(person),
  ]);
  return {
    today: today.results[0], week: week.results[0], all: all.results[0],
    people: people.results, models: models.results, recent: recent.results,
  };
}

// ---- published projects (projects.visualia.space/<person>/<slug>/) ------------

async function published(url, env) {
  const [person, slug, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!person || !slug) return text('Visualia projects', 200);
  if (!rest.length && !url.pathname.endsWith('/')) return Response.redirect(`${url.origin}/${person}/${slug}/`, 301);
  const project = await env.DB.prepare(
    'SELECT id, published_version, kind FROM projects WHERE person_id = ? AND slug = ? AND published_version IS NOT NULL',
  ).bind(person, slug).first();
  if (!project) return text('not found', 404);
  // A multi-file version: any of its files, from its manifest. An older single page falls through.
  if (project.kind === 'files') {
    const served = await fromManifest(env, project.id, project.published_version, url, `/${person}/${slug}`, 'public, max-age=60');
    if (served) return served;
  }
  const file = rest.join('/');
  if (file) return await publishedFile(env, person, slug, file);
  const obj = await env.PROJECTS.get(`projects/${project.id}/${project.published_version}.html`);
  if (!obj) return text('not found', 404);
  return new Response(obj.body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // An opaque origin: the page gets no cookies, no storage, and can't act as the studio.
      'content-security-policy': 'sandbox allow-scripts allow-popups allow-forms allow-pointer-lock',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=60',
    },
  });
}

// The pictures a published page uses sit next to it: <person>/<slug>/<n>-<k>.jpg.
// Only those the published version names: its own, or an earlier version's it
// kept (a change keeps src="1-1.jpg"); never the rest of the project's pictures.
async function publishedFile(env, person, slug, file) {
  if (!/^\d+-\d+\.jpg$/.test(file)) return text('not found', 404);
  const project = await env.DB.prepare(
    'SELECT id, published_version FROM projects WHERE person_id = ? AND slug = ? AND published_version IS NOT NULL',
  ).bind(person, slug).first();
  const page = project && (await env.PROJECTS.get(`projects/${project.id}/${project.published_version}.html`));
  const named = page && (await page.text()).includes(`src="${file}"`);
  const obj = named && (await env.PROJECTS.get(`projects/${project.id}/${file}`));
  if (!obj) return text('not found', 404);
  return new Response(obj.body, {
    headers: { 'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=3600' },
  });
}

// ---- a multi-file version, by manifest -----------------------------------------
// The path under the version's root (empty or a folder: its index.html) ->
// blobs/<hash>, with the published headers plus CORS. null when version n is
// a single page (no manifest).
async function fromManifest(env, id, n, url, base, cache, { headers: extra = {}, reporter = false } = {}) {
  const man = await env.PROJECTS.get(`projects/${id}/v/${n}.json`);
  if (!man) return null;
  const { files } = await man.json();
  let path = rel(decodeURIComponent(url.pathname.slice(base.length))) ?? '';
  if (!path || url.pathname.endsWith('/')) path = path ? `${path}/index.html` : 'index.html';
  else if (!files[path] && files[`${path}/index.html`]) return Response.redirect(`${url.origin}${url.pathname}/`, 301);
  const f = files[path];
  const obj = f && (await env.PROJECTS.get(`blobs/${f.hash}`));
  const headers = { ...fileHeaders(f?.type ?? 'text/plain; charset=utf-8', cache), ...extra };
  if (!obj) return new Response('not found', { status: 404, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
  if (reporter && /^text\/html/.test(f.type)) return new Response(withReporter(await obj.text()), { headers });
  return new Response(obj.body, { headers });
}

// ---- preview (preview.visualia.space/<project>[.v<n>].<sig>/<path>) ------------
// A multi-file project as the studio's iframe loads it: the working copy from
// the project's agent, or version n from R2. No cookie on this host: the
// signature is the key, and it covers the visibility, so a link the class had
// stops working when the project goes private.
async function preview(url, env) {
  const token = url.pathname.split('/')[1] ?? '';
  const m = token.match(/^(\w{1,32})(?:\.v(\d+))?\.([\w-]{22})$/);
  if (!m) return text('not found', 404);
  const [, id, v, sig] = m;
  const n = Number(v ?? 0);
  const p = await env.DB.prepare('SELECT visibility, kind, versions FROM projects WHERE id = ?').bind(id).first();
  if (!p || p.kind !== 'files' || n > p.versions || sig !== (await previewSig(env, id, n, p.visibility))) return text('not found', 404);
  if (url.pathname === `/${token}`) return Response.redirect(`${url.origin}/${token}/`, 301);
  if (n) return (await fromManifest(env, id, n, url, `/${token}`, 'private, max-age=300', { headers: { 'referrer-policy': 'no-referrer' }, reporter: true })) ?? text('not found', 404);
  const path = decodeURIComponent(url.pathname.slice(token.length + 2));
  return (await getAgentByName(env.StudioAgent, id)).fetch(new Request(`https://agent/preview?path=${encodeURIComponent(path.endsWith('/') || !path ? `${path}index.html` : path)}`));
}

function publicUrl(env, project) {
  return `https://${env.PROJECTS_HOST}/${project.person_id}/${project.slug}/`;
}

// ---- sign in: course key -> signed cookie -------------------------------------

async function login(request, env) {
  // 10 attempts a minute per address: guessing an 8-letter key is then hopeless.
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!(await env.LOGIN_LIMIT.limit({ key: ip })).success) return text('Too many attempts. Wait a minute.', 429);
  const form = await request.formData();
  const key = String(form.get('key') ?? '').trim();
  const row = key
    ? await env.DB.prepare(
        'SELECT p.id FROM keys k JOIN people p ON p.id = k.person_id WHERE k.hash = ? AND k.revoked_at IS NULL',
      ).bind(await sha256(key.toUpperCase().replace(/[^A-Z]/g, ''))).first() // case, dashes, spaces don't matter
    : null;
  if (!row) return new Response(null, { status: 303, headers: { location: '/?wrong' } });
  const value = `${row.id}.${await sign(env, row.id)}`;
  return new Response(null, {
    status: 303,
    headers: {
      location: '/',
      'set-cookie': `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 120}`,
    },
  });
}

function logout() {
  return new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0` },
  });
}

async function session(request, env) {
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const i = m[1].lastIndexOf('.');
  const person = m[1].slice(0, i);
  return person && m[1].slice(i + 1) === (await sign(env, person)) ? person : null;
}

async function sign(env, value) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function schoolOf(env, person) {
  return (await env.DB.prepare('SELECT school_id FROM people WHERE id = ?').bind(person).first())?.school_id ?? null;
}

// The project, if this person may see it: their own, or shared with their
// class (peers: any member may then open and change it). Otherwise null.
async function visible(env, school, person, projectId) {
  if (!school) return null;
  return await env.DB.prepare(
    `SELECT p.* FROM projects p JOIN people o ON o.id = p.person_id
     WHERE p.id = ? AND o.school_id = ? AND (p.visibility = 'class' OR p.person_id = ?)`,
  ).bind(projectId, school, person).first();
}
const canSee = async (env, school, person, projectId) => !!(await visible(env, school, person, projectId));

// ---- helpers ------------------------------------------------------------------

// A new private project of this person's; `from` = { from, version } for a remix.
async function newProject(env, person, title, from = null, kind = 'page') {
  const id = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  let slug = slugify(title) || 'project';
  const taken = await env.DB.prepare('SELECT 1 FROM projects WHERE person_id = ? AND slug = ?').bind(person, slug).first();
  if (taken) slug = `${slug}-${id.slice(0, 4)}`;
  await env.DB.prepare("INSERT INTO projects (id, person_id, slug, title, updated_at, visibility, from_project, from_version, kind) VALUES (?, ?, ?, ?, ?, 'private', ?, ?, ?)")
    .bind(id, person, slug, title, new Date().toISOString(), from?.from ?? null, from?.version ?? null, kind ?? 'page').run();
  return { id, slug, title };
}

function page(env, request, path) {
  return env.ASSETS.fetch(new Request(new URL(path, request.url), request));
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function text(t, status = 200) {
  return new Response(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
