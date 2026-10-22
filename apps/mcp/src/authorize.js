// The sign-in and consent page an AI tool sends a person to (GET and POST
// /authorize). One form: what the tool will be able to read, where the access
// goes, the person's course key, Allow or Don't allow. The key is checked like
// the studio's sign-in (its SHA-256 hash in D1, not revoked, 10 tries a minute
// per address) and never stored; the token carries the person and their school.
// Every string that came from the tool is escaped (it chose its own name).
import { AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import TEXT from './text.json';

export const SCOPE = 'read';

const t = (key, vars = {}) => (TEXT[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function authorize(request, env) {
  const oauth = env.OAUTH_PROVIDER;
  try {
    // The form posts back to the same address, so the request can be read again on POST.
    const authRequest = await oauth.parseAuthRequest(request);
    const details = await oauth.describeConsent(authRequest);
    if (request.method !== 'POST') {
      const consent = await oauth.beginConsent(authRequest);
      return page(details, consent.handle, null, consent.headers);
    }

    const form = await request.formData();
    const handle = String(form.get('handle') ?? '');
    if (form.get('decision') !== 'allow') {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await env.KEY_LIMIT.limit({ key: ip })).success) return page(details, handle, t('too-many'));
    const member = await person(env, String(form.get('key') ?? ''));
    if (!member) return page(details, handle, t('wrong-key'));

    const approved = await oauth.approveConsent(request, handle, { scope: [SCOPE] });
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request, // from storage, not from the form
      userId: member.id,
      metadata: {},
      scope: [SCOPE],
      props: { person: member.id, school: member.school_id },
    });
    approved.headers.set('Location', redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError) {
      const expired = /handle|expired|used|consent/i.test(error.description);
      return message(expired ? t('expired') : t('bad-request', { reason: error.description }), 400);
    }
    if (error instanceof CimdFetchError) return message(t('not-verified'), 400);
    throw error;
  }
}

// The person whose course key this is, if it isn't revoked.
async function person(env, key) {
  const k = key.toUpperCase().replace(/[^A-Z]/g, ''); // case, dashes and spaces don't matter
  if (!k) return null;
  return await env.DB.prepare(
    'SELECT p.id, p.school_id FROM keys k JOIN people p ON p.id = k.person_id WHERE k.hash = ? AND k.revoked_at IS NULL',
  ).bind(await sha256(k)).first();
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function page(details, handle, problem, headers = new Headers()) {
  headers.set('content-type', 'text/html; charset=utf-8');
  const client = `<b>${escape(details.clientName)}</b>`;
  const origin = details.clientDomain ? t('verified', { domain: escape(details.clientDomain) }) : t('unverified');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(t('title'))}</title>
<link rel="stylesheet" href="/visualia.css">
<style>.buttons { display: flex; gap: var(--s); flex-wrap: wrap; }</style>
</head>
<body>
<main>
  <header>
    <h1>${escape(t('title'))}</h1>
    <p>${t('asks', { client })}</p>
  </header>
  <form method="post">
    <section>
      <p class="quiet">${origin} ${t('sends-to', { host: `<b>${escape(details.redirectHost)}</b>` })}</p>
      ${details.redirectIsLoopback ? `<p class="quiet">${escape(t('loopback'))}</p>` : ''}
      <input type="hidden" name="handle" value="${escape(handle)}">
      <label><span>${escape(t('key'))}</span><input name="key" type="password" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH"></label>
      ${problem ? `<p class="bold">${escape(problem)}</p>` : ''}
      <p class="buttons"><button name="decision" value="allow">${escape(t('allow'))}</button> <button name="decision" value="deny">${escape(t('deny'))}</button></p>
    </section>
  </form>
</main>
</body>
</html>`;
  return new Response(html, { status: problem ? 400 : 200, headers });
}

function message(text, status) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/visualia.css"><main><p>${escape(text)}</p></main></html>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
