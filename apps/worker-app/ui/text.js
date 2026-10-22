// Every word on this page lives in text.json (and later et.json): change the
// words there, not here. Places in the page carry data-text="key"; code uses
// t('key', { slot: value }) for lines with numbers or names in them.
let TEXT = {};
const t = (key, vars = {}) => (TEXT[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const textReady = fetch('text.json').then((r) => r.json()).then((d) => {
  TEXT = d;
  for (const el of document.querySelectorAll('[data-text]')) el.textContent = t(el.dataset.text);
});
