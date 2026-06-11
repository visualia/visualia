import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // one React instance even if workspace hoisting changes
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5180 },
});
