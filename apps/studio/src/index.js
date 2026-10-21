// visualia studio: describe a page, watch it build, change it, publish it.
// visualia.space            the studio (sign in with a course key)
// projects.visualia.space   published projects, served sandboxed
// See plans/studio-core.md.

import { routeAgentRequest } from 'agents';
export { StudioAgent } from './agent.js';

const COOKIE = '__Host-visualia';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.hostname === env.PROJECTS_HOST) return await published(url, env);

      // Writes only from the studio's own pages.
      if (request.method !== 'GET' && request.method !== 'HEAD' && !url.pathname.startsWith('/agents/')) {
        if (request.headers.get('origin') !== env.STUDIO_ORIGIN) return text('forbidden', 403);
      }
      if (url.pathname === '/login' && request.method === 'POST') return await login(request, env);
      if (url.pathname === '/logout' && request.method === 'POST') return logout();

      const person = await session(request, env);

      if (url.pathname.startsWith('/agents/')) {
        if (!person) return text('sign in first', 401);
        return (
          (await routeAgentRequest(request, env, {
            onBeforeConnect: async (_req, route) => {
              if (!(await owns(env, person, route.name))) return text('not your project', 403);
            },
            onBeforeRequest: async (_req, route) => {
              if (!(await owns(env, person, route.name))) return text('not your project', 403);
            },
          })) ?? text('not found', 404)
        );
      }

      if (url.pathname.startsWith('/api/')) {
        if (!person) return json({ error: 'sign in first' }, 401);
        return await api(request, url, env, person);
      }

      // Pages
      if (!person) return page(env, request, '/login.html');
      if (url.pathname === '/') return page(env, request, '/index.html');
      if (/^\/p\/[\w-]+\/?$/.test(url.pathname)) return page(env, request, '/project.html');
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

  if (parts.length === 2 && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, versions, published_version, created_at FROM projects WHERE person_id = ? ORDER BY created_at DESC',
    ).bind(person).all();
    return json({ person, projects: results });
  }

  if (parts.length === 2 && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? '').trim().slice(0, 80);
    if (!title) return json({ error: 'a title is needed' }, 400);
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
    let slug = slugify(title) || 'project';
    const taken = await env.DB.prepare('SELECT 1 FROM projects WHERE person_id = ? AND slug = ?').bind(person, slug).first();
    if (taken) slug = `${slug}-${id.slice(0, 4)}`;
    await env.DB.prepare('INSERT INTO projects (id, person_id, slug, title) VALUES (?, ?, ?, ?)')
      .bind(id, person, slug, title).run();
    return json({ id, slug, title });
  }

  const id = parts[2];
  const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ? AND person_id = ?').bind(id, person).first();
  if (!project) return json({ error: 'not found' }, 404);

  if (parts.length === 3 && request.method === 'GET') {
    return json({ ...project, url: project.published_version ? publicUrl(env, project) : null });
  }

  // GET /api/projects/:id/versions/:n  -> the page, as text (rendered by the studio in a sandbox)
  if (parts[3] === 'versions' && parts[4] && request.method === 'GET') {
    const obj = await env.PROJECTS.get(`projects/${id}/${Number(parts[4])}.html`);
    if (!obj) return json({ error: 'no such version' }, 404);
    return new Response(await obj.text(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // POST /api/projects/:id/publish  { version? }  -> publish a version (latest by default)
  if (parts[3] === 'publish' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const version = Number(body.version ?? project.versions);
    if (!version || version > project.versions) return json({ error: 'nothing to publish yet' }, 400);
    await env.DB.prepare('UPDATE projects SET published_version = ? WHERE id = ?').bind(version, id).run();
    return json({ url: publicUrl(env, { ...project, published_version: version }), version });
  }

  return json({ error: 'not found' }, 404);
}

// ---- published projects (projects.visualia.space/<person>/<slug>/) ------------

async function published(url, env) {
  const [person, slug] = url.pathname.split('/').filter(Boolean);
  if (!person || !slug) return text('Visualia projects', 200);
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

function publicUrl(env, project) {
  return `https://${env.PROJECTS_HOST}/${project.person_id}/${project.slug}/`;
}

// ---- sign in: course key -> signed cookie -------------------------------------

async function login(request, env) {
  const form = await request.formData();
  const key = String(form.get('key') ?? '').trim();
  const row = key
    ? await env.DB.prepare(
        'SELECT p.id FROM keys k JOIN people p ON p.id = k.person_id WHERE k.hash = ? AND k.revoked_at IS NULL',
      ).bind(await sha256(key)).first()
    : null;
  if (!row) return Response.redirect(`${env.STUDIO_ORIGIN}/?wrong`, 303);
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

async function owns(env, person, projectId) {
  return !!(await env.DB.prepare('SELECT 1 FROM projects WHERE id = ? AND person_id = ?').bind(projectId, person).first());
}

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
