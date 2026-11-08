/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Content Security Policy for the built site: the browser only runs scripts, styles, fonts and images
 * from Tomekeeper itself, so injected code (cross-site scripting) has nothing to load or send to.
 * Images and fonts may also be data: URLs, which Vite uses for very small files.
 * frame-ancestors can't be set in a <meta> tag; the server sends it as a header when the site is deployed.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

/**
 * Adds the policy to index.html in production builds only. The development server needs inline scripts
 * and styles for hot reloading, so it runs without it.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'tomekeeper-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), contentSecurityPolicy()],
  // The demo build (npm run build:demo, mode "demo") answers from recorded data instead of the API (src/demo).
  define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('true') } : {},
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
}));
