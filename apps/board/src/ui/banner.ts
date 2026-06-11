export function showFallbackBanner(): void {
  if (localStorage.getItem('board:bannerDismissed')) return;
  const el = document.createElement('div');
  el.id = 'fallback-banner';
  el.innerHTML =
    'Running in DOM fallback mode. For the GPU HTML-in-canvas path, use Chrome 148+ with ' +
    '<code>chrome://flags/#canvas-draw-element</code> enabled. <button>Dismiss</button>';
  el.querySelector('button')!.addEventListener('click', () => {
    localStorage.setItem('board:bannerDismissed', '1');
    el.remove();
  });
  document.body.appendChild(el);
}
