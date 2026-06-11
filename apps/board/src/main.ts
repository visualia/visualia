import './ui/styles.css';
import './widgets/shadcn.css';
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

// expose for poking around in devtools
(window as unknown as { board: App }).board = app;
