// Every prompt the platform adds to a model call, in one list, so the studio's
// /prompts page can show them all and a teacher can change them for their
// school (plans/prompts.md). A school's own text is a row in D1 `prompts`; no
// row means the course default below. `fixed` ones are put together by code
// each time (or run on someone's computer) and are shown, not changed: their
// text here is an example made by the same function the code uses.

import instructions from './instructions.md';
import { KLEIN_UPSCALE } from '../../../packages/prompts/index.js';

// What the checker can say is off: one sentence per choice, "key: sentence" a line.
const OFF = {
  nothing: 'Nothing obvious is off.',
  blank: 'The page looks blank or nearly empty.',
  missing: 'Something the student asked for is missing.',
  text: 'Text is wrong, garbled, cut off or overlapping.',
  layout: 'The layout breaks on a phone: content overflows, is cut off or sits badly.',
  image: 'A picture is missing, broken or doesn\'t fit the request.',
  look: 'Colours or style don\'t match what was asked.',
};

// The page agent's turn: earlier requests, the files, index.html, the request.
export function turnContext({ earlier, files, index, request }) {
  return [
    earlier.length ? `Earlier requests:\n${earlier.map((t) => `- ${t}`).join('\n')}` : '',
    files.length ? `The site's files now:\n${files.map((f) => `- ${f.path} (${f.size} bytes)`).join('\n')}` : 'The site has no files yet.',
    index != null ? `index.html:\n\`\`\`html\n${index}\n\`\`\`` : '',
    `The request:\n${request}`,
  ].filter(Boolean).join('\n\n');
}

// What the checker is shown: the requests, then the screenshot's size and the HTML.
export function checkState({ asked, width, shot, html }) {
  return `What the student asked, in order:\n${asked.map((a) => `- ${a}`).join('\n')}\n\n`
    + (shot ? `The image is a screenshot of the page on a phone, ${width} px wide.\n\nThe page (HTML):\n${html.slice(0, 6000)}` : `The page (HTML):\n${html.slice(0, 12000)}`);
}

// The pool's default (visualia/pool, worker/src/models.js, chilloutmix image.negative): the app applies
// its own copy, so this is only what /prompts shows as the default. Keep it in step.
const CHILLOUTMIX_NEGATIVE = 'nsfw, nude, naked';

export const PROMPTS = [
  { id: 'page-system', max: 4000, text: [
    'You make and change a small website from a student\'s requests by calling tools. The site is a folder of files; index.html is the home page.',
    'Paths are relative to the folder: index.html, style.css, img/stone.jpg.',
    'Make all the files in one reply: call write once per file, all in the same answer.',
    'Change an existing file with edit: oldText copied exactly from the file, short but unique; newText keeps everything around the change that should stay. Rewrite a whole file only when most of it changes.',
    'Do not call ls or read for files you have just written or been shown. When the files are written, stop.',
    'The instructions below were first written for single pages: here you write files with tools instead of answering with a code block, and "Several files" applies.',
    'When changing the site, keep what the student didn\'t ask to change.',
  ].join(' ') },
  { id: 'page-instructions', max: 20000, text: instructions },
  { id: 'page-context', fixed: true, text: turnContext({
    earlier: ['{an earlier request}'], files: [{ path: 'index.html', size: '{n}' }], index: '{the home page}', request: '{your request}',
  }) },
  { id: 'page-path', max: 300, text: 'Path relative to the site folder, e.g. index.html or img/a.png' },
  { id: 'page-cut-off', max: 1000, text: 'This call was cut off before its arguments were complete, so nothing was done. Make the file shorter, or write it in parts: write the first part, then add the rest with edit.' },
  { id: 'page-undone', max: 1000, text: 'The edit was undone: {harm}. Edit again so that newText keeps what was around the change; only add or change what was asked.' },
  { id: 'check-state', fixed: true, text: checkState({ asked: ['{each request}'], width: 375, shot: true, html: '{the page}' }) },
  { id: 'check-fit', max: 1000, text: 'Does this page do what the student asked, including the latest request?' },
  { id: 'check-off', max: 1000, text: 'What is most clearly off in the page, compared with what the student asked?' },
  { id: 'check-choices', max: 3000, keys: Object.keys(OFF), text: Object.entries(OFF).map(([k, v]) => `${k}: ${v}`).join('\n') },
  { id: 'fix', max: 1000, text: 'Fix these errors in the page:' },
  { id: 'upscale-klein', max: 1000, text: KLEIN_UPSCALE },
  // At most 200 characters: the pool app refuses longer (pool-core check_list).
  { id: 'pool-negative-chilloutmix', max: 200, text: CHILLOUTMIX_NEGATIVE },
  // Added on the computer itself (apps/pool-app/pool-core/src/core.rs, json_prompt).
  { id: 'pool-json', fixed: true, text: 'Answer only with one JSON value, no other text, matching this JSON schema: {schema}.\n\n(Without a schema: Answer only with one JSON value, no other text.)' },
];
const BY_ID = Object.fromEntries(PROMPTS.map((p) => [p.id, p]));

// The school's prompts: its own text where a teacher changed one, else the default.
export async function promptsFor(env, school) {
  const { results } = await env.DB.prepare('SELECT id, text FROM prompts WHERE school_id = ?').bind(school ?? '').all();
  const own = Object.fromEntries(results.filter((r) => BY_ID[r.id] && !BY_ID[r.id].fixed).map((r) => [r.id, r.text]));
  return Object.fromEntries(PROMPTS.map((p) => [p.id, own[p.id] ?? p.text]));
}

// {slot} filled; an unknown slot stays as written.
export const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

// "key: sentence" lines -> { key: sentence }; a key left out keeps its default.
export function choices(text) {
  const own = Object.fromEntries(text.split('\n').map((l) => l.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  return Object.fromEntries(Object.entries(OFF).map(([k, v]) => [k, own[k] ?? v]));
}

// Why a teacher's text can't be saved, or null.
export function invalid(id, text) {
  const p = BY_ID[id];
  if (!p || p.fixed) return 'not-editable';
  if (text.length > p.max) return 'too-long';
  if (id === 'pool-negative-chilloutmix' && /[\u0000-\u001f\u007f]/.test(text)) return 'one-line';
  if (p.keys) {
    const own = text.split('\n').filter((l) => l.trim()).map((l) => l.match(/^\s*(\w+)\s*:\s*\S/)?.[1]);
    if (own.some((k) => !p.keys.includes(k)) || p.keys.some((k) => !own.includes(k))) return 'choices';
  }
  return null;
}

export const defaultOf = (id) => BY_ID[id]?.text;
