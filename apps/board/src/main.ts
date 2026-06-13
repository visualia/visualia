import '@visualia/engine/styles.css';
import './ui/styles.css';
import '@visualia/shadcn/styles.css';
import { connectAgentBridge } from '@visualia/mcp/bridge';
import { App } from './app';
import { collectImageFiles } from './import';
import { showFallbackBanner } from './ui/banner';

const root = document.getElementById('board-root')!;
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const domLayer = document.getElementById('dom-layer')!;
const domLayerInner = document.getElementById('dom-layer-inner')!;

const forceFallback = new URLSearchParams(location.search).has('fallback');

const app = new App(root, canvas, domLayer, domLayerInner, forceFallback);
app.loadOrSeed();

if (app.mode === 'dom' && !forceFallback) showFallbackBanner();

console.info(`board: content mode = ${app.mode}`);

if (import.meta.env.DEV) {
  connectAgentBridge({
    snapshot: () => app.agentSnapshot(),
    insert: (type, props) => app.agentInsert(type, props),
    patch: (id, props) => app.agentPatch(id, props),
    delete: (ids) => app.agentDelete(ids),
    zoomTo: (ids) => app.agentZoomTo(ids),
    capture: (url) => app.agentCapture(url),
    crop: (nodeId, target) => app.agentCrop(nodeId, target as string | { rect: [number, number, number, number] }),
    import: (params) => app.agentImport((params ?? {}) as { path?: string; urls?: string[] }),
    layout: (strategy, ids, params) => app.agentLayout(strategy, ids, params),
    view: (params) => app.agentView(params as Parameters<typeof app.agentView>[0]),
  });
}

// drop images or a whole folder onto the board → gridded image nodes
root.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types.includes('Files')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});
root.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  e.preventDefault();
  const screen = { x: e.clientX, y: e.clientY };
  // collect synchronously — the DataTransfer is invalid after this tick
  void collectImageFiles(e.dataTransfer)
    .then((files) => (files.length ? app.importFiles(files, screen) : []))
    .catch((err) => console.warn('import failed:', err));
});

// paste a bare URL onto the board → captured website screenshot node
window.addEventListener('paste', (e) => {
  if (app.edit.activeId) return; // let text edits keep their paste
  const text = e.clipboardData?.getData('text/plain')?.trim() ?? '';
  if (!/^https?:\/\/\S+$/.test(text)) return;
  e.preventDefault();
  void app.agentCapture(text).catch((err) => console.warn('website capture failed:', err));
});

// expose for poking around in devtools
(window as unknown as { board: App }).board = app;
