// Every word on a page lives in text.json beside it (later et.json): change the
// words there, not in the page or the code. Places carry data-text="key"
// (plain text) or data-html="key" (our own markup only: <b>, <code>, a link);
// code calls t('key', { slot: value }) for lines with numbers or names in them.
// One file for every app, copied in at build (packages/text, plans/style.md).
let TEXT = {};
const t = (key, vars = {}) => (TEXT[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const textReady = fetch('text.json').then((r) => r.json()).then((d) => {
  TEXT = d;
  for (const el of document.querySelectorAll('[data-text]')) el.textContent = t(el.dataset.text);
  for (const el of document.querySelectorAll('[data-html]')) el.innerHTML = t(el.dataset.html);
});
