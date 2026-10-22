// visualia studio: describe a page, watch it build, change it, publish it.
// visualia.space            the studio (sign in with a course key)
// projects.visualia.space   published projects, served sandboxed
// See plans/studio-core.md.

import { getAgentByName, routeAgentRequest } from 'agents';
export { StudioAgent } from './agent.js';
export { Class } from './class.js';

const COOKIE = '__Host-visualia';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.hostname === env.PROJECTS_HOST) return await published(url, env);

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
            onBeforeRequest: allowed,
          })) ?? text('not found', 404)
        );
      }

      if (url.pathname === '/api/usage') {
        if (!person) return json({ error: 'sign in first' }, 401); // everyone in the class sees it
        return json(await usage(env, person));
      }
      if (url.pathname.startsWith('/api/')) {
        if (!person) return json({ error: 'sign in first' }, 401);
        return await api(request, url, env, person);
      }

      // Static files (the stylesheet, images) are public: serve them before the sign-in check.
      if (/\.(css|js|png|jpg|svg|ico|woff2?)$/.test(url.pathname)) return env.ASSETS.fetch(request);

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
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
    let slug = slugify(title) || 'project';
    const taken = await env.DB.prepare('SELECT 1 FROM projects WHERE person_id = ? AND slug = ?').bind(person, slug).first();
    if (taken) slug = `${slug}-${id.slice(0, 4)}`;
    await env.DB.prepare("INSERT INTO projects (id, person_id, slug, title, updated_at, visibility) VALUES (?, ?, ?, ?, ?, 'private')")
      .bind(id, person, slug, title, new Date().toISOString()).run();
    return json({ id, slug, title });
  }

  // Someone else's private project is "not found", the same as another school's.
  const id = parts[2];
  const project = await visible(env, school, person, id);
  if (!project) return json({ error: 'not found' }, 404);

  if (parts.length === 3 && request.method === 'GET') {
    return json({ ...project, me: person, url: project.published_version ? publicUrl(env, project) : null });
  }

  // GET /api/projects/:id/versions/:n  -> the page, as text (rendered by the studio in a sandbox)
  if (parts[3] === 'versions' && parts[4] && request.method === 'GET') {
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
    env.DB.prepare(`SELECT u.ts, u.person_id, u.model, u.tokens_in, u.tokens_out, u.cost_usd, u.latency_ms, u.ok, u.error,
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
  const [person, slug, file] = url.pathname.split('/').filter(Boolean);
  if (!person || !slug) return text('Visualia projects', 200);
  if (file) return await publishedFile(env, person, slug, file);
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}/${person}/${slug}/`, 301);
  const project = await env.DB.prepare(
    'SELECT id, published_version FROM projects WHERE person_id = ? AND slug = ? AND published_version IS NOT NULL',
  ).bind(person, slug).first();
  if (!project) return text('not found', 404);
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
