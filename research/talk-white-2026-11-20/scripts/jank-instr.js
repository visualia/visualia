// init script: per-frame rAF deltas, long tasks, and time in key calls
(() => {
  const M = (window.__m = { frames: [], long: [], marks: [], cost: {} , cur: null});
  const add = (k, ms) => { const c = M.cur; if (c) c[k] = (c[k] || 0) + ms; };
  const wrap = (proto, name, key) => { const o = proto[name]; if (!o) return; proto[name] = function (...a) { const t = performance.now(); try { return o.apply(this, a); } finally { add(key, performance.now() - t); } }; };
  wrap(CanvasRenderingContext2D.prototype, 'stroke', 'stroke');
  wrap(WebGLRenderingContext.prototype, 'texImage2D', 'tex');
  wrap(WebGLRenderingContext.prototype, 'drawArrays', 'draw');
  // time every rAF callback
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); try { cb(t); } finally { add('rafjs', performance.now() - s); } });
  if (window === top || location.pathname.endsWith('ai-estonia.html')) {
    let last = 0;
    const f = (t) => { if (M.cur) { M.cur.dt = last ? t - last : 0; M.frames.push(M.cur); } M.cur = { t, phase: M.phase ?? 'init' }; last = t; raf(f); };
    raf(f);
  }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) M.long.push({ t: e.startTime, d: e.duration, phase: M.phase }); }).observe({ entryTypes: ['longtask'] }); } catch {}
})();
// draw counters per document (any frame): how many GL draws and rAF callbacks happen, for "who still renders"
(() => {
  const D = (window.__draws = { gl: 0, raf: 0, ctx: [] });
  for (const P of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean))
    for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { const o = P[n]; if (!o) continue; P[n] = function (...a) { D.gl++; return o.apply(this, a); }; }
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = orig.call(this, t, ...a); if (c && /webgl/.test(t) && !D.ctx.some((x) => x.c === c)) { D.ctx.push({ c, canvas: this }); this.addEventListener('webglcontextlost', () => { (window.__lost ??= []).push({ at: performance.now(), page: location.pathname.split('/').pop(), id: this.id }); console.warn('CONTEXT LOST', location.pathname, this.id); }); } return c; };
  window.__live = () => D.ctx.filter((x) => x.canvas.isConnected && !x.c.isContextLost()).length;
  const raf = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { return raf.call(window, (t) => { D.raf++; cb(t); }); };
})();
// sync GPU readbacks and an optional kill-switch for this document's GL draws (experiments only)
(() => {
  const M = window.__m;
  for (const P of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    for (const n of ['readPixels', 'getError', 'clientWaitSync', 'getBufferSubData', 'finish']) { const o = P[n]; if (!o) continue; P[n] = function (...a) { const t = performance.now(); try { return o.apply(this, a); } finally { const d = performance.now() - t; if (M.cur) { M.cur[n] = (M.cur[n] || 0) + d; } (window.__sync ??= {})[n] = ((window.__sync ??= {})[n] || 0) + 1; } }; }
    for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) { const o = P[n]; P[n] = function (...a) { if (window.__noDraw && (window.__noDraw === true || this.canvas?.id === window.__noDraw)) return; return o.apply(this, a); }; }
  }
})();
