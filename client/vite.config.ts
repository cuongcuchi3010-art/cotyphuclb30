import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite (5173) chuyển /api và /ws sang wrangler dev (8787)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/healthz': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
