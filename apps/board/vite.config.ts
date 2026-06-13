import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { mediaProxy } from '@visualia/engine/vite';
import { mcpRelay } from '@visualia/mcp/vite';
import { captureServer } from './vite-capture';

export default defineConfig({
  plugins: [tailwindcss(), mediaProxy(), mcpRelay(), captureServer()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // one React instance even if workspace hoisting changes
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5180 },
});
