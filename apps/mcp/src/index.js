// visualia MCP server: mcp.visualia.space (plans/mcp.md). A person connects
// their own AI tool (Claude, ChatGPT, Cursor…) and it can read Visualia for
// them, exactly what they see in the studio. Step 1: read only.
//
// GET/POST /authorize   sign in with the course key and allow the tool (authorize.js)
// /mcp                  the MCP endpoint (Streamable HTTP), OAuth token required
// /token, /register     OAuth, answered by the provider library
//
// Every tool reads through the studio's ForMcp entrypoint (service binding
// STUDIO): the same handlers and visibility rules as the pages, GET only.
import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server';
import { z } from 'zod';
import { authorize, SCOPE } from './authorize.js';

const HOST = 'mcp.visualia.space';
const STUDIO = 'https://studio.visualia.space';
const FILE_CAP = 60_000; // characters of a file a tool returns

function createServer(env) {
  const server = new McpServer({ name: 'visualia', version: '1.0.0' });

  // What the studio answers for this person; the person comes from the token.
  const read = async (path) => {
    const person = getMcpAuthContext()?.props?.person;
    if (!person) throw new Error('not signed in');
    const res = await env.STUDIO.fetch(`https://studio${path}`, { headers: { 'x-visualia-person': String(person) } });
    const type = res.headers.get('content-type') ?? '';
    const body = type.includes('json') ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, body, type };
  };
  const out = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }] });
  const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
  const work = (p) => ({
    id: p.id, title: p.title, owner: p.person_id, versions: p.versions, updated: p.updated_at,
    link: `${STUDIO}/p/${p.id}`,
    ...(p.published_version ? { published: `https://projects.visualia.space/${p.person_id}/${p.slug}/` } : {}),
  });

  server.registerTool('list_work', {
    title: 'List the work',
    description: 'Lists the work everyone in your class has shared, newest change first, and your own private projects. Each one has an id to use with get_project.',
    inputSchema: z.object({}),
  }, async () => {
    const r = await read('/api/projects');
    if (!r.ok) return fail(`Could not list the work (${r.status}).`);
    return out({ you: r.body.person, shared: r.body.projects.map(work), your_private_projects: r.body.private.map(work) });
  });

  server.registerTool('get_project', {
    title: 'Read a project',
    description: 'Reads one project: its title, owner and versions. Give a version number to also get that version\'s list of files and a preview link, and a file path as well to get that file\'s text. Projects you may not see answer "not found".',
    inputSchema: z.object({
      id: z.string().regex(/^\w{1,40}$/).describe('The project id, from list_work'),
      version: z.number().int().positive().optional().describe('A version number, 1 to the latest'),
      file: z.string().max(200).optional().describe('With a version: a file path from its list, e.g. index.html or style.css'),
    }),
  }, async ({ id, version, file }) => {
    const p = await read(`/api/projects/${id}`);
    if (!p.ok) return fail(p.status === 404 ? 'Not found.' : `Could not read the project (${p.status}).`);
    const b = p.body;
    const project = {
      id: b.id, title: b.title, owner: b.person_id, versions: b.versions,
      shared: b.visibility === 'class', link: `${STUDIO}/p/${b.id}`,
      ...(b.url ? { published: b.url } : {}), ...(b.from ? { remixed_from: b.from } : {}), remixes: b.remixes,
    };
    if (!version) return out(project);
    const v = await read(`/api/projects/${id}/versions/${version}`);
    if (!v.ok) return fail(v.status === 404 ? `There is no version ${version}.` : `Could not read version ${version} (${v.status}).`);
    const files = Object.entries(v.body.files ?? {}).map(([path, f]) => ({ path, size: f.size }));
    if (!file) return out({ ...project, version, files, preview: v.body.preview });
    const f = await read(`/api/projects/${id}/versions/${version}/files/${file.split('/').map(encodeURIComponent).join('/')}`);
    if (!f.ok) return fail(f.status === 404 ? `Version ${version} has no file ${file}.` : `Could not read ${file} (${f.status}).`);
    if (!f.type.startsWith('text/')) return out({ ...project, version, file, size: files.find((x) => x.path === file)?.size, text: null, note: 'Not a text file (a picture, sound or other binary file).' });
    const text = f.body.length > FILE_CAP ? `${f.body.slice(0, FILE_CAP)}\n[cut: the file has ${f.body.length} characters]` : f.body;
    return out({ ...project, version, file, text });
  });

  server.registerTool('read_chat', {
    title: 'Read the class chat',
    description: 'Reads the latest messages in your class chat, oldest first: who wrote, when, the text, and the project a message links to.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional().describe('How many messages, 50 if not given') }),
  }, async ({ limit }) => {
    const r = await read(`/api/chat?limit=${limit ?? 50}`);
    if (!r.ok) return fail(`Could not read the chat (${r.status}).`);
    return out(r.body.messages.map((m) => ({
      at: new Date(m.at).toISOString(), person: m.person, text: m.text,
      ...(m.project ? { project: { id: m.project.id, title: m.project.title } } : {}),
    })));
  });

  server.registerTool('usage_summary', {
    title: 'Read the usage page',
    description: 'What the usage page shows: AI calls, tokens and cost today, this week and in total, by person and by model, and the latest calls. Never the text of a prompt or an answer.',
    inputSchema: z.object({}),
  }, async () => {
    const r = await read('/api/usage');
    if (!r.ok) return fail(`Could not read the usage page (${r.status}).`);
    return out(r.body);
  });

  return server;
}

// The MCP endpoint behind the token check: ctx.props is what /authorize stored.
const mcp = {
  fetch(request, env, ctx) {
    return createMcpHandler(() => createServer(env), {
      route: '/mcp',
      allowedHostnames: [HOST],
      authContext: { props: ctx.props ?? {} },
    })(request, env, ctx);
  },
};

const pages = {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/authorize') return authorize(request, env);
    if (url.pathname === '/') return Response.redirect('https://studio.visualia.space/', 302);
    return new Response('not found', { status: 404 });
  },
};

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: mcp,
  defaultHandler: pages,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
  scopesSupported: [SCOPE],
  requiredScopes: [SCOPE],
  resourceMetadata: { resource: `https://${HOST}/mcp`, authorization_servers: [`https://${HOST}`] },
  clientIdMetadataDocumentEnabled: true,
});
