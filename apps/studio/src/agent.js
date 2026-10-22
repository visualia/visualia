// One StudioAgent per project (its name is the project id). It runs a student's
// requests one at a time through the gateway, streams the answer to everyone
// connected, and keeps every resulting page as a version in R2.
// See plans/studio-core.md.

import { Agent, getAgentByName } from 'agents';
import puppeteer from '@cloudflare/puppeteer';
import { Workspace } from '@cloudflare/computer';
import { createPiTools } from '@cloudflare/computer/tools/pi-ai';
import instructions from './instructions.md';
import { collector, field, follow, rel, editHarm, rootedLinks, typeOf, fileHeaders, withReporter, previewUrl } from './files.js';

const MAX_IMAGES = 3; // per version
const IMG = /<img\b[^>]*\bdata-generate\s*=\s*(["'])([\s\S]*?)\1[^>]*>/gi;
// The check's screenshot: a phone, as the instructions are phone first; 2x so text stays legible.
const SHOT = { width: 375, height: 812, deviceScaleFactor: 2 };
// What the checker can say is off. Clef answers with a choice, not prose, so
// each choice is a sentence "Fix it" can use later. Kept in the turn, not shown.
const OFF = {
  nothing: 'Nothing obvious is off.',
  blank: 'The page looks blank or nearly empty.',
  missing: 'Something the student asked for is missing.',
  text: 'Text is wrong, garbled, cut off or overlapping.',
  layout: 'The layout breaks on a phone: content overflows, is cut off or sits badly.',
  image: 'A picture is missing, broken or doesn\'t fit the request.',
  look: 'Colours or style don\'t match what was asked.',
};

const SYSTEM = [
  'You make and change one web page from a student\'s requests.',
  'Start your answer immediately with ```html and nothing before it: no greeting, no plan, no explanation.',
  'Answer with exactly one complete HTML document in that single code block, nothing else.',
  'When changing an existing page, keep what the student didn\'t ask to change.',
].join(' ') + '\n\n' + instructions.replace(/\n## Several files\n[\s\S]*?(?=\n## )/, ''); // multi-file only

// ---- multi-file projects (kind 'files'; plans/multi-file.md) --------------------
// The working copy is a Computer Workspace in this DO's SQLite, under ROOT;
// the model changes it with Computer's file tools in our own short loop
// through the gateway. Versions are manifests in R2 over content-addressed
// blobs, so an unchanged file costs nothing.
const ROOT = '/workspace';
const MAX_STEPS = 6;
const FALLBACK = '@cf/google/gemma-4-26b-a4b-it'; // when PAGE_MODEL answers 429
const WRITES = new Set(['write', 'edit', 'delete']);
const FILES_SYSTEM = [
  'You make and change a small website from a student\'s requests by calling tools. The site is a folder of files; index.html is the home page.',
  'Paths are relative to the folder: index.html, style.css, img/stone.jpg.',
  'Make all the files in one reply: call write once per file, all in the same answer.',
  'Change an existing file with edit: oldText copied exactly from the file, short but unique; newText keeps everything around the change that should stay. Rewrite a whole file only when most of it changes.',
  'Do not call ls or read for files you have just written or been shown. When the files are written, stop.',
  'The instructions below were first written for single pages: here you write files with tools instead of answering with a code block, and "Several files" applies.',
  'When changing the site, keep what the student didn\'t ask to change.',
].join(' ') + '\n\n' + instructions;

export class StudioAgent extends Agent {
  initialState = { turns: [], versions: 0, busy: false };

  // The Worker has checked the person may see the project (the owner, or the
  // class when it's shared) and passes who they are; each request they make
  // is credited to them.
  async onConnect(connection, ctx) {
    connection.setState({ person: ctx.request.headers.get('x-visualia-person') });
    connection.send(JSON.stringify({ type: 'hello', ...this.state, ...(this.state.kind === 'files' ? { files: await this.listFiles() } : {}) }));
  }

  async onMessage(connection, message) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }
    const ask = msg.type === 'ask' && typeof msg.text === 'string' && msg.text.trim();
    const restore = msg.type === 'restore' && Number.isInteger(msg.version) && msg.version > 0 && msg.version <= this.state.versions;
    if (!ask && !restore) return;
    if (this.state.busy) return connection.send(JSON.stringify({ type: 'busy' }));
    const person = connection.state?.person;
    if (!person) return;
    // Visibility can change while a socket is open: a private project takes requests from its owner only.
    const p = await this.env.DB.prepare('SELECT person_id, visibility, kind FROM projects WHERE id = ?').bind(this.name).first();
    if (p && p.visibility !== 'class' && p.person_id !== person) return connection.close(4003, 'private');
    if (p?.kind !== 'files') return ask ? this.run(msg.text.trim(), person) : undefined;
    return (ask ? this.runFiles(msg.text.trim(), person) : this.restore(msg.version, person)).catch((err) => {
      this.setState({ ...this.state, busy: false });
      this.send({ type: 'error', text: String(err?.message ?? err) });
    });
  }

  // The owner made the project private: tell everyone else and close their
  // sockets (the Worker refuses them from now on). Called by the Worker over
  // RPC. The message is there because a closing socket can take seconds to
  // report it.
  revoke(owner) {
    for (const c of this.getConnections()) {
      if (c.state?.person === owner) continue;
      c.send(JSON.stringify({ type: 'private' }));
      c.close(4003, 'private');
    }
  }

  // A remix starts here with version 1 already in R2 (copied by the Worker):
  // the page as it was in the source, credited to the remixer. Over RPC.
  // A files remix has its manifest copied: the working copy is written from it.
  async remixed({ person, from, version, kind = 'page' }) {
    if (kind === 'files') await this.load(1);
    this.setState({ ...this.state, kind, versions: 1, busy: false, turns: [{ role: 'page', version: 1, person, from, fromVersion: version, at: Date.now() }] });
  }

  // The owner makes this a multi-file project (the Worker checked, and sets
  // projects.kind after): the latest page becomes /workspace/index.html, with
  // the pictures it uses next to it. Versions so far stay single pages.
  async toFiles() {
    if (this.state.busy) return { error: 'Still working on the last request.' };
    if (this.state.versions) await this.load(this.state.versions);
    else await this.clear();
    this.setState({ ...this.state, kind: 'files' });
    this.send({ type: 'kind', kind: 'files' });
    return { ok: true };
  }

  // `person` is who asked: the owner or any member of the class. Their usage
  // row carries their name (x-visualia-person), the project stays the owner's.
  async run(text, person) {
    const found = await this.env.DB.prepare('SELECT id, person_id FROM projects WHERE id = ?').bind(this.name).first();
    if (!found) return this.send({ type: 'error', text: 'Project not found.' });
    const project = { id: found.id, owner: found.person_id, person_id: person };

    const turns = [...this.state.turns, { role: 'user', text, person, at: Date.now() }];
    this.setState({ ...this.state, turns, busy: true });
    this.send({ type: 'start', text, person });

    const messages = [{ role: 'system', content: SYSTEM }];
    const current = this.state.versions
      ? await (await this.env.PROJECTS.get(`projects/${this.name}/${this.state.versions}.html`))?.text()
      : null;
    const earlier = turns.filter((t) => t.role === 'user').slice(0, -1).map((t) => `- ${t.text}`);
    if (current) {
      if (earlier.length) messages.push({ role: 'user', content: `Earlier requests:\n${earlier.join('\n')}` });
      messages.push({ role: 'assistant', content: '```html\n' + current + '\n```' });
    }
    messages.push({ role: 'user', content: text });

    let answer = '';
    let error = null;
    this.codeAt = null;
    try {
      const res = await this.env.GATEWAY.fetch('https://gateway/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-visualia-person': project.person_id,
          'x-visualia-project': project.id,
        },
        body: JSON.stringify({ model: this.env.PAGE_MODEL, stream: true, max_tokens: 8000, messages }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `gateway ${res.status}`);
      answer = await this.relay(res);
    } catch (err) {
      error = String(err?.message ?? err);
    }

    let html = extractHtml(answer);
    if (error || !html) {
      this.setState({ ...this.state, busy: false });
      return this.send({ type: 'error', text: error ?? 'The answer had no page in it. Try again.' });
    }
    const version = this.state.versions + 1;
    html = await this.draw(project, version, html);
    await this.env.PROJECTS.put(`projects/${this.name}/${version}.html`, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    });
    await this.env.DB.prepare('UPDATE projects SET versions = ?, updated_at = ? WHERE id = ?').bind(version, new Date().toISOString(), this.name).run();
    this.setState({
      ...this.state,
      versions: version,
      busy: false,
      turns: [...this.state.turns, { role: 'page', version, person, model: this.env.PAGE_MODEL, at: Date.now() }],
    });
    this.send({ type: 'done', version, person, model: this.env.PAGE_MODEL });
    await this.wall(version, person);
    await this.check(project, version, html);
    await this.wall(version, person); // now with its screenshot
  }

  // ---- multi-file turns ------------------------------------------------------

  // Made on first use, so single-page projects never get the vfs tables.
  get workspace() { return (this._workspace ??= new Workspace({ storage: this.ctx.storage })); }

  // A request on a multi-file project: our own tool loop, at most MAX_STEPS
  // model calls, each one a gateway call and a usage row. A step that only
  // wrote ends the turn (no call just for a closing sentence). Then the
  // folder becomes version n+1, a manifest in R2.
  async runFiles(text, person) {
    const found = await this.env.DB.prepare('SELECT id, person_id, visibility FROM projects WHERE id = ?').bind(this.name).first();
    if (!found) return this.send({ type: 'error', text: 'Project not found.' });
    const project = { id: found.id, owner: found.person_id, person_id: person, visibility: found.visibility };
    const turns = [...this.state.turns, { role: 'user', text, person, at: Date.now() }];
    this.setState({ ...this.state, turns, busy: true });
    this.send({ type: 'start', text, person });
    const started = Date.now();

    // Turn context: the file list and index.html; the model reads the rest if it needs them.
    await this.workspace.fs.mkdir(ROOT, { recursive: true });
    const have = await this.listFiles();
    const index = have.some((f) => f.path === 'index.html') ? await this.readText('index.html') : null;
    const earlier = turns.filter((t) => t.role === 'user').slice(0, -1).map((t) => `- ${t.text}`);
    const context = [
      earlier.length ? `Earlier requests:\n${earlier.join('\n')}` : '',
      have.length ? `The site's files now:\n${have.map((f) => `- ${f.path} (${f.size} bytes)`).join('\n')}` : 'The site has no files yet.',
      index != null ? `index.html:\n\`\`\`html\n${index}\n\`\`\`` : '',
      `The request:\n${text}`,
    ].filter(Boolean).join('\n\n');
    const messages = [{ role: 'system', content: FILES_SYSTEM }, { role: 'user', content: context }];
    const { tools, execute } = createPiTools({ workspace: this.workspace, root: ROOT, exec: {} });
    const declared = tools.map(relative);

    let model = this.env.PAGE_MODEL, changed = false, error = null, steps = 0, calls = 0;
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        steps++;
        // Gemma writes all files in one reply, path first, only when a tool is required.
        let res = await this.complete(project, model, messages, declared, model === FALLBACK && step === 0 ? 'required' : 'auto');
        if (res.status === 429 && model !== FALLBACK) {
          model = FALLBACK;
          res = await this.complete(project, model, messages, declared, step === 0 ? 'required' : 'auto');
        }
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `gateway ${res.status}`);
        const out = await this.relayTools(res);
        if (out.text.trim()) this.send({ type: 'note', text: out.text.trim() });
        const todo = out.calls.map((c) => {
          let args = null;
          try { args = JSON.parse(c.args || '{}'); } catch {}
          return { id: c.id, name: c.name, args: args && typeof args === 'object' && !Array.isArray(args) ? args : null };
        });
        // Workers AI refuses a history with invalid arguments: a cut call goes back as {}.
        messages.push({ role: 'assistant', content: out.text || '', ...(todo.length ? { tool_calls: todo.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args ? JSON.stringify(c.args) : '{}' } })) } : {}) });
        if (!todo.length) break;
        let failed = false;
        for (const c of todo) {
          calls++;
          const path = rel(c.args?.path);
          let r;
          if (!c.args) {
            r = { isError: true, text: 'This call was cut off before its arguments were complete, so nothing was done. Make the file shorter, or write it in parts: write the first part, then add the rest with edit.' };
          } else {
            const before = c.name === 'edit' && model === FALLBACK && path ? await this.readText(path) : null;
            const done = await execute({ id: c.id, name: c.name, arguments: c.args });
            r = { isError: done.isError, text: done.content.map((x) => x.text ?? '').join('\n') };
            const harm = before != null && !r.isError && editHarm(path, before, (await this.readText(path)) ?? '', text);
            if (harm) {
              await this.workspace.fs.writeFile(`${ROOT}/${path}`, before);
              r = { isError: true, text: `The edit was undone: ${harm}. Edit again so that newText keeps what was around the change; only add or change what was asked.` };
            }
          }
          if (!r.isError && WRITES.has(c.name)) changed = true;
          if (r.isError) failed = true;
          this.send({ type: 'tool-done', id: c.id, name: c.name, path, error: r.isError ? r.text.slice(0, 300) : null });
          messages.push({ role: 'tool', tool_call_id: c.id, content: r.text || (r.isError ? 'failed' : 'done') });
        }
        if (!failed && todo.every((c) => WRITES.has(c.name))) break;
      }
    } catch (err) {
      error = String(err?.message ?? err);
    }

    if (!changed) {
      this.setState({ ...this.state, busy: false });
      return this.send({ type: 'error', text: error ?? 'Nothing was changed. Try saying it another way.' });
    }
    const version = this.state.versions + 1;
    await this.drawFiles(project, version);
    const manifest = await this.snapshot(version, { model, person });
    const texts = {};
    for (const p of Object.keys(manifest.files)) if (/\.(html?|css|m?js)$/i.test(p)) texts[p] = (await this.readText(p)) ?? '';
    await this.env.DB.prepare('UPDATE projects SET versions = ?, updated_at = ? WHERE id = ?').bind(version, new Date().toISOString(), this.name).run();
    const stats = { steps, calls, ms: Date.now() - started, ...(error ? { error } : {}) };
    this.setState({
      ...this.state, versions: version, busy: false,
      turns: [...this.state.turns, { role: 'page', version, person, model, at: Date.now(), files: Object.keys(manifest.files).length, ...stats }],
    });
    this.send({ type: 'done', version, person, model, files: listOf(manifest), problems: rootedLinks(texts), ...stats });
    await this.wall(version, person);
    if (manifest.files['index.html']) {
      await this.check(project, version, texts['index.html'], `${await previewUrl(this.env, this.name, version, project.visibility)}index.html`);
      await this.wall(version, person); // now with its screenshot
    }
  }

  // One streamed gateway call with the file tools; thinking off, as in step 0.
  complete(project, model, messages, tools, choice) {
    return this.env.GATEWAY.fetch('https://gateway/v1/chat/completions', {
      method: 'POST',
      headers: headers(project),
      body: JSON.stringify({
        model, stream: true, max_tokens: 16000, messages, tools, tool_choice: choice, parallel_tool_calls: true,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
  }

  // Read the stream, normalize it (files.js), and tell the browsers what is
  // happening: `tool` when a call starts and again when its path is known,
  // `file-delta` with a write's content as it arrives (held until the path is
  // known: Gemma sends keys in alphabetical order), a few times a second.
  async relayTools(res) {
    const out = collector();
    const live = new Map();
    const decoder = new TextDecoder();
    let buffer = '', last = 0;
    const flush = () => {
      for (const c of out.calls) {
        let l = live.get(c);
        if (!l) {
          if (!c.name) continue;
          live.set(c, (l = { path: null, sent: 0 }));
          this.send({ type: 'tool', id: c.id, name: c.name });
        }
        if (!l.path) {
          const p = field(c.args, 'path');
          if (p?.done && rel(p.value)) { l.path = rel(p.value); this.send({ type: 'tool', id: c.id, name: c.name, path: l.path }); }
        }
        if (c.name !== 'write') continue;
        follow(c);
        if (l.path && c.content?.length > l.sent) {
          this.send({ type: 'file-delta', id: c.id, path: l.path, text: c.content.slice(l.sent) });
          l.sent = c.content.length;
        }
      }
      last = Date.now();
    };
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
        let e; try { e = JSON.parse(line.slice(5)); } catch { continue; }
        out.push(e);
      }
      if (Date.now() - last > 150) flush();
    }
    flush();
    return out;
  }

  // Pictures in a multi-file project: as for single pages, saved next to the
  // HTML file that asks for them, at most MAX_IMAGES a version.
  async drawFiles(project, version) {
    let first = 1;
    for (const f of await this.listFiles()) {
      if (!/\.html?$/i.test(f.path) || first > MAX_IMAGES) continue;
      const html = await this.readText(f.path);
      const n = Math.min([...(html ?? '').matchAll(IMG)].length, MAX_IMAGES - first + 1);
      if (!n) continue;
      const dir = f.path.replace(/[^/]*$/, '');
      const out = await this.draw(project, version, html, { first, max: n, save: (name, bytes) => this.workspace.fs.writeFile(`${ROOT}/${dir}${name}`, bytes) });
      await this.workspace.fs.writeFile(`${ROOT}/${f.path}`, out);
      first += n;
    }
  }

  // The folder as version n: each distinct file once in blobs/<sha256>, and
  // projects/<id>/v/<n>.json listing them.
  async snapshot(version, meta) {
    const files = {};
    for (const f of await this.listFiles()) {
      const bytes = await this.readBytes(f.path);
      const hash = hex(await crypto.subtle.digest('SHA-256', bytes));
      const type = typeOf(f.path);
      if (!(await this.env.PROJECTS.head(`blobs/${hash}`))) await this.env.PROJECTS.put(`blobs/${hash}`, bytes, { httpMetadata: { contentType: type } });
      files[f.path] = { hash, size: bytes.length, type };
    }
    const manifest = { files, ...meta, at: new Date().toISOString() };
    await this.env.PROJECTS.put(`projects/${this.name}/v/${version}.json`, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });
    return manifest;
  }

  // Version n back into the working copy: a manifest's files, or (for a
  // version from before the project had files) its page and pictures.
  async load(n) {
    const man = await this.env.PROJECTS.get(`projects/${this.name}/v/${n}.json`);
    await this.clear();
    if (man) {
      for (const [p, f] of Object.entries((await man.json()).files)) {
        const obj = await this.env.PROJECTS.get(`blobs/${f.hash}`);
        if (obj) await this.put(p, new Uint8Array(await obj.arrayBuffer()));
      }
      return;
    }
    const html = await (await this.env.PROJECTS.get(`projects/${this.name}/${n}.html`))?.text();
    if (!html) return;
    await this.put('index.html', html);
    for (const name of new Set([...html.matchAll(/src="(\d+-\d+\.jpg)"/g)].map((m) => m[1]))) {
      const obj = await this.env.PROJECTS.get(`projects/${this.name}/${name}`);
      if (obj) await this.put(name, new Uint8Array(await obj.arrayBuffer()));
    }
  }

  // Restore version n: its files back into the working copy, as a new version
  // (the latest version is always the working copy). No model call.
  async restore(n, person) {
    this.setState({ ...this.state, busy: true });
    try {
      await this.load(n);
      const version = this.state.versions + 1;
      const manifest = await this.snapshot(version, { restored: n, person });
      const shot = await this.env.PROJECTS.get(`projects/${this.name}/${n}.png`);
      if (shot) await this.env.PROJECTS.put(`projects/${this.name}/${version}.png`, await shot.arrayBuffer(), { httpMetadata: { contentType: 'image/png' } });
      await this.env.DB.prepare('UPDATE projects SET versions = ?, updated_at = ? WHERE id = ?').bind(version, new Date().toISOString(), this.name).run();
      this.setState({ ...this.state, versions: version, busy: false, turns: [...this.state.turns, { role: 'page', version, person, restored: n, at: Date.now() }] });
      this.send({ type: 'done', version, person, restored: n, files: listOf(manifest), problems: [] });
      await this.wall(version, person);
    } catch (err) {
      this.setState({ ...this.state, busy: false });
      this.send({ type: 'error', text: String(err?.message ?? err) });
    }
  }

  // The preview (preview.<host>/<project>.<sig>/<path>) asks for a file of the
  // working copy; the Worker has checked the signature, and this is reachable
  // only from there. HTML gets the error reporter.
  async onRequest(request) {
    const path = rel(new URL(request.url).searchParams.get('path') ?? '');
    const bytes = path && (await this.readBytes(path).catch(() => null));
    const type = path ? typeOf(path) : 'text/plain; charset=utf-8';
    const headers = { ...fileHeaders(type, 'no-store'), 'referrer-policy': 'no-referrer' };
    if (!bytes) return new Response('not found', { status: 404, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
    if (/^text\/html/.test(type)) return new Response(withReporter(new TextDecoder().decode(bytes)), { headers });
    return new Response(bytes, { headers });
  }

  async listFiles(dir = ROOT) {
    let entries;
    try { entries = await this.workspace.fs.readdir(dir, { limit: 1000 }); } catch { return []; }
    const out = [];
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory) out.push(...(await this.listFiles(p)));
      else if (e.isFile) out.push({ path: p.slice(ROOT.length + 1), size: e.size });
    }
    return dir === ROOT ? out.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path)) : out;
  }

  async readText(path) { return path ? this.workspace.fs.readFile(`${ROOT}/${path}`, 'utf8').catch(() => null) : null; }
  async readBytes(path) { return new Uint8Array(await new Response(await this.workspace.fs.readFile(`${ROOT}/${path}`)).arrayBuffer()); }
  async put(path, content) {
    const dir = `${ROOT}/${path}`.replace(/\/[^/]*$/, '');
    await this.workspace.fs.mkdir(dir, { recursive: true });
    await this.workspace.fs.writeFile(`${ROOT}/${path}`, content);
  }
  async clear() {
    await this.workspace.fs.rm(ROOT, { recursive: true, force: true }).catch(() => {});
    await this.workspace.fs.mkdir(ROOT, { recursive: true });
  }

  // The page model marks pictures as <img data-generate="…">. Draw up to three
  // through the gateway, keep them next to the version (projects/<id>/<n>-<k>.jpg)
  // and point src at them. A relative name works on the published page as it
  // is, and in the studio's preview once inlined (project.html).
  async draw(project, version, html, { first = 1, max = MAX_IMAGES, save } = {}) {
    const tags = [...html.matchAll(IMG)].slice(0, max);
    if (!tags.length) return html;
    this.send({ type: 'images' });
    const names = await Promise.all(tags.map(async (m, i) => {
      try {
        const size = m[0].match(/\bdata-size\s*=\s*["']?(\d+x\d+)/i)?.[1] ?? '1024x1024';
        const res = await this.env.GATEWAY.fetch('https://gateway/v1/images', {
          method: 'POST', headers: headers(project), body: JSON.stringify({ prompt: m[2], size }),
        });
        const body = await res.json().catch(() => ({}));
        if (!body.data) throw new Error(body.detail ?? body.error ?? `images ${res.status}`);
        const name = `${version}-${first + i}.jpg`; // FLUX.2 klein answers in JPEG
        const bytes = Uint8Array.from(atob(body.data[0].b64_json), (c) => c.charCodeAt(0));
        if (save) await save(name, bytes);
        else await this.env.PROJECTS.put(`projects/${this.name}/${name}`, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
        return name;
      } catch (err) {
        console.error('image failed', String(err?.message ?? err));
        return null;
      }
    }));
    let k = 0;
    return html.replace(IMG, (tag) => {
      if (k >= max) return ''; // past the limit: no picture at all rather than a broken one
      const name = names[k++];
      tag = tag.replace(/\s*\bdata-(generate|size)\s*=\s*(["'])[\s\S]*?\2/gi, '').replace(/\s*\bsrc\s*=\s*(["'])[\s\S]*?\1/i, '');
      return name ? tag.replace(/^<img/i, `<img src="${name}"`) : tag;
    });
  }

  // Ask a decision model whether the page matches what was asked, looking at a
  // screenshot as well as the HTML (Clef-flash on Workers AI; it takes images).
  // A probability, not a verdict: shown, never enforced. The screenshot stays
  // in R2 (projects/<id>/<n>.png) for thumbnails later.
  async check(project, version, html, url = null) {
    const asked = this.state.turns.filter((t) => t.role === 'user' && !t.text.startsWith('Fix these errors')).map((t) => t.text);
    const started = Date.now();
    let shot = null, shotMs = null;
    try {
      shot = await this.screenshot(url ?? html);
      shotMs = Date.now() - started;
      await this.env.PROJECTS.put(`projects/${this.name}/${version}.png`, shot, { httpMetadata: { contentType: 'image/png' } });
    } catch (err) {
      console.error('screenshot failed', String(err?.message ?? err)); // judge the HTML alone
    }
    try {
      const res = await this.env.GATEWAY.fetch('https://gateway/v1/decide', {
        method: 'POST',
        headers: headers(project),
        body: JSON.stringify({
          state: `What the student asked, in order:\n${asked.map((a) => `- ${a}`).join('\n')}\n\n`
            + (shot ? `The image is a screenshot of the page on a phone, ${SHOT.width} px wide.\n\nThe page (HTML):\n${html.slice(0, 6000)}` : `The page (HTML):\n${html.slice(0, 12000)}`),
          ...(shot ? { images: [`data:image/png;base64,${base64(shot)}`] } : {}),
          questions: {
            fit: { type: 'noul', instructions: 'Does this page do what the student asked, including the latest request?' },
            off: { type: 'choice', instructions: 'What is most clearly off in the page, compared with what the student asked?', criteria: OFF },
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      const fit = body.answers?.fit?.noul;
      if (typeof fit !== 'number') throw new Error(`decide ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
      const off = OFF[body.answers?.off?.choice] ?? null;
      const ms = Date.now() - started;
      this.setState({ ...this.state, turns: this.state.turns.map((t) => (t.role === 'page' && t.version === version ? { ...t, fit, off, check: { ms, shotMs, model: body.model, seen: !!shot } } : t)) });
      this.send({ type: 'check', version, fit, ms, shotMs });
    } catch (err) {
      // Not shown to students; the browser ignores it, scripts and logs see why.
      console.error('check failed', String(err?.message ?? err));
      this.send({ type: 'check-failed', version, text: String(err?.message ?? err) });
    }
  }

  // Tell the class's wall (the Class DO, over RPC) about this version. Shared
  // projects only; the Class DO checks again, and takes a private one off.
  async wall(version, by) {
    try {
      const p = await this.env.DB.prepare('SELECT p.title, p.visibility, o.school_id FROM projects p JOIN people o ON o.id = p.person_id WHERE p.id = ?').bind(this.name).first();
      if (p?.visibility !== 'class') return;
      await (await getAgentByName(this.env.Class, p.school_id)).workChanged({ project: this.name, version, title: p.title, by });
    } catch (err) {
      console.error('wall failed', String(err?.message ?? err));
    }
  }

  // The version as a phone shows it: Browser Rendering, pictures inlined (the
  // browser has no studio cookie), 1.5 s for scripts and canvas to draw.
  // A multi-file version is opened at its preview URL instead.
  async screenshot(html) {
    const url = /^https:\/\//.test(html) ? html : null;
    if (!url) for (const name of new Set([...html.matchAll(/src="(\d+-\d+\.jpg)"/g)].map((m) => m[1]))) {
      const obj = await this.env.PROJECTS.get(`projects/${this.name}/${name}`);
      if (obj) html = html.replaceAll(`src="${name}"`, `src="data:image/jpeg;base64,${base64(new Uint8Array(await obj.arrayBuffer()))}"`);
    }
    const browser = await puppeteer.launch(this.env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.setViewport(SHOT);
      await (url ? page.goto(url, { waitUntil: 'load', timeout: 10000 }) : page.setContent(html, { waitUntil: 'load', timeout: 10000 })).catch(() => {}); // a slow library still gets its picture taken
      await new Promise((r) => setTimeout(r, 1500));
      return await page.screenshot({ type: 'png' });
    } finally {
      await browser.close();
    }
  }

  // Stream the model's answer to every connected browser, a few times a second.
  async relay(res) {
    const decoder = new TextDecoder();
    let buffer = '', answer = '', pending = '', last = 0;
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
        let e; try { e = JSON.parse(line.slice(5)); } catch { continue; }
        const piece = e.choices?.[0]?.delta?.content ?? e.response ?? '';
        answer += piece; pending += piece;
        if (!this.codeAt && answer.includes('<')) { this.codeAt = Date.now(); this.send({ type: 'code' }); }
      }
      if (pending && Date.now() - last > 150) { this.send({ type: 'delta', text: pending }); pending = ''; last = Date.now(); }
    }
    if (pending) this.send({ type: 'delta', text: pending });
    return answer;
  }

  send(msg) { this.broadcast(JSON.stringify(msg)); }
}

// The model sees paths relative to the site folder: Computer's tools describe
// absolute /workspace paths, which models then copy into links.
function relative(t) {
  const parameters = structuredClone(t.parameters);
  const p = parameters.properties?.path;
  if (p) { p.description = 'Path relative to the site folder, e.g. index.html or img/a.png'; if ('default' in p) p.default = '.'; }
  return { type: 'function', function: { name: t.name, description: t.description, parameters } };
}

const rank = (p) => (p === 'index.html' ? 0 : /\.html?$/i.test(p) ? 1 : /\.css$/i.test(p) ? 2 : /\.m?js$/i.test(p) ? 3 : 4);
const listOf = (manifest) => Object.entries(manifest.files).map(([path, f]) => ({ path, size: f.size }));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function headers(project) {
  return { 'content-type': 'application/json', 'x-visualia-person': project.person_id, 'x-visualia-project': project.id };
}

function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  return /<html[\s>]/i.test(body) && /<\/html>/i.test(body) ? body : null;
}
