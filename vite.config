import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@litert-lm/core'] },
  server: { host: '0.0.0.0', allowedHosts: true }, // Replit needs this
  preview: { host: '0.0.0.0', allowedHosts: true },
});
