// One StudioAgent per project (its name is the project id). It runs a student's
// requests one at a time through the gateway, streams the answer to everyone
// connected, and keeps every resulting page as a version in R2.
// See plans/studio-core.md.

import { Agent } from 'agents';
import instructions from './instructions.md';

const SYSTEM = [
  'You make and change one web page from a student\'s requests.',
  'Start your answer immediately with ```html and nothing before it: no greeting, no plan, no explanation.',
  'Answer with exactly one complete HTML document in that single code block, nothing else.',
  'When changing an existing page, keep what the student didn\'t ask to change.',
].join(' ') + '\n\n' + instructions;

export class StudioAgent extends Agent {
  initialState = { turns: [], versions: 0, busy: false };

  onConnect(connection) {
    connection.send(JSON.stringify({ type: 'hello', ...this.state }));
  }

  async onMessage(connection, message) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }
    if (msg.type !== 'ask' || typeof msg.text !== 'string' || !msg.text.trim()) return;
    if (this.state.busy) return connection.send(JSON.stringify({ type: 'busy' }));
    await this.run(msg.text.trim());
  }

  async run(text) {
    const project = await this.env.DB.prepare('SELECT id, person_id FROM projects WHERE id = ?').bind(this.name).first();
    if (!project) return this.send({ type: 'error', text: 'Project not found.' });

    const turns = [...this.state.turns, { role: 'user', text, at: Date.now() }];
    this.setState({ ...this.state, turns, busy: true });
    this.send({ type: 'start', text });

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
        body: JSON.stringify({ stream: true, max_tokens: 8000, messages }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `gateway ${res.status}`);
      answer = await this.relay(res);
    } catch (err) {
      error = String(err?.message ?? err);
    }

    const html = extractHtml(answer);
    if (error || !html) {
      this.setState({ ...this.state, busy: false });
      return this.send({ type: 'error', text: error ?? 'The answer had no page in it. Try again.' });
    }
    const version = this.state.versions + 1;
    await this.env.PROJECTS.put(`projects/${this.name}/${version}.html`, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    });
    await this.env.DB.prepare('UPDATE projects SET versions = ? WHERE id = ?').bind(version, this.name).run();
    this.setState({
      ...this.state,
      versions: version,
      busy: false,
      turns: [...this.state.turns, { role: 'page', version, at: Date.now() }],
    });
    this.send({ type: 'done', version });
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

export function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  return /<html[\s>]/i.test(body) && /<\/html>/i.test(body) ? body : null;
}
