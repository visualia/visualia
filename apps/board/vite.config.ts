import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { mediaProxy } from '@visualia/engine/vite';
import { mcpRelay } from '@visualia/mcp/vite';

export default defineConfig({
  plugins: [tailwindcss(), mediaProxy(), mcpRelay()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // one React instance even if workspace hoisting changes
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5180 },
});
