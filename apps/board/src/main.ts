import '@visualia/engine/styles.css';
import './ui/styles.css';
import '@visualia/shadcn/styles.css';
import { connectAgentBridge } from '@visualia/mcp/bridge';
import { App } from './app';
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
  });
}

// expose for poking around in devtools
(window as unknown as { board: App }).board = app;
