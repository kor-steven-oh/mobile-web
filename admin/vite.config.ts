import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
  plugins: [react(), cloudflare({
    configPath: fileURLToPath(new URL('./wrangler.jsonc', import.meta.url)),
    persistState: { path: fileURLToPath(new URL('../.wrangler/state', import.meta.url)) },
    inspectorPort: false,
  })],
  server: { host: '127.0.0.1', port: 3003, strictPort: true },
});
