/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the front-end and the API look like one site: /api goes to `dotnet run` on port 5080.
    // That keeps sign-in cookies simple (same site, no CORS).
    proxy: {
      '/api': {
        target: 'http://localhost:5080',
        // Keep the browser's address (localhost:5173) in the Host header, so links the API builds, such as
        // the address Google sends readers back to, point at the site and not at the API's own port.
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
