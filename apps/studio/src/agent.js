// One StudioAgent per project (its name is the project id). It runs a student's
// requests one at a time through the gateway, streams the answer to everyone
// connected, and keeps every resulting page as a version in R2.
// See plans/studio-core.md.

import { Agent } from 'agents';
import puppeteer from '@cloudflare/puppeteer';
import instructions from './instructions.md';

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
].join(' ') + '\n\n' + instructions;

export class StudioAgent extends Agent {
  initialState = { turns: [], versions: 0, busy: false };

  // The Worker has checked the person may see the project (the owner, or the
  // class when it's shared) and passes who they are; each request they make
  // is credited to them.
  onConnect(connection, ctx) {
    connection.setState({ person: ctx.request.headers.get('x-visualia-person') });
    connection.send(JSON.stringify({ type: 'hello', ...this.state }));
  }

  async onMessage(connection, message) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }
    if (msg.type !== 'ask' || typeof msg.text !== 'string' || !msg.text.trim()) return;
    if (this.state.busy) return connection.send(JSON.stringify({ type: 'busy' }));
    const person = connection.state?.person;
    if (!person) return;
    // Visibility can change while a socket is open: a private project takes requests from its owner only.
    const p = await this.env.DB.prepare('SELECT person_id, visibility FROM projects WHERE id = ?').bind(this.name).first();
    if (p && p.visibility !== 'class' && p.person_id !== person) return connection.close(4003, 'private');
    await this.run(msg.text.trim(), person);
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
    await this.check(project, version, html);
  }

  // The page model marks pictures as <img data-generate="…">. Draw up to three
  // through the gateway, keep them next to the version (projects/<id>/<n>-<k>.jpg)
  // and point src at them. A relative name works on the published page as it
  // is, and in the studio's preview once inlined (project.html).
  async draw(project, version, html) {
    const tags = [...html.matchAll(IMG)].slice(0, MAX_IMAGES);
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
        const name = `${version}-${i + 1}.jpg`; // FLUX.2 klein answers in JPEG
        await this.env.PROJECTS.put(`projects/${this.name}/${name}`, Uint8Array.from(atob(body.data[0].b64_json), (c) => c.charCodeAt(0)), {
          httpMetadata: { contentType: 'image/jpeg' },
        });
        return name;
      } catch (err) {
        console.error('image failed', String(err?.message ?? err));
        return null;
      }
    }));
    let k = 0;
    return html.replace(IMG, (tag) => {
      if (k >= MAX_IMAGES) return ''; // past the limit: no picture at all rather than a broken one
      const name = names[k++];
      tag = tag.replace(/\s*\bdata-(generate|size)\s*=\s*(["'])[\s\S]*?\2/gi, '').replace(/\s*\bsrc\s*=\s*(["'])[\s\S]*?\1/i, '');
      return name ? tag.replace(/^<img/i, `<img src="${name}"`) : tag;
    });
  }

  // Ask a decision model whether the page matches what was asked, looking at a
  // screenshot as well as the HTML (Clef-flash on Workers AI; it takes images).
  // A probability, not a verdict: shown, never enforced. The screenshot stays
  // in R2 (projects/<id>/<n>.png) for thumbnails later.
  async check(project, version, html) {
    const asked = this.state.turns.filter((t) => t.role === 'user' && !t.text.startsWith('Fix these errors')).map((t) => t.text);
    const started = Date.now();
    let shot = null, shotMs = null;
    try {
      shot = await this.screenshot(html);
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

  // The version as a phone shows it: Browser Rendering, pictures inlined (the
  // browser has no studio cookie), 1.5 s for scripts and canvas to draw.
  async screenshot(html) {
    for (const name of new Set([...html.matchAll(/src="(\d+-\d+\.jpg)"/g)].map((m) => m[1]))) {
      const obj = await this.env.PROJECTS.get(`projects/${this.name}/${name}`);
      if (obj) html = html.replaceAll(`src="${name}"`, `src="data:image/jpeg;base64,${base64(new Uint8Array(await obj.arrayBuffer()))}"`);
    }
    const browser = await puppeteer.launch(this.env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.setViewport(SHOT);
      await page.setContent(html, { waitUntil: 'load', timeout: 10000 }).catch(() => {}); // a slow library still gets its picture taken
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
