import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  server: { proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } } },
});
