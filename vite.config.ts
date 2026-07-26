/// <reference types="vite/client" />
/// <reference types="vite/client" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Drop the CSP <meta> while running the dev server.
 *
 * @vitejs/plugin-react injects its React Refresh preamble as an *inline*
 * <script>, which `script-src 'self'` forbids. It survives today only because
 * a meta CSP governs nothing parsed before it and the preamble is injected at
 * the top of <head> - ordering luck, not a guarantee. Stripping the tag in
 * dev makes that explicit. The built output, which is what actually ships and
 * what emits no inline script, keeps the policy.
 */
const stripCspInDev = (): Plugin => ({
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(
      /\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/i,
      ''
    ),
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), stripCspInDev()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    // Source maps in a development build only. Shipping them publicly would
    // publish the full source alongside the bundle; `npm run build:validate`
    // checks both directions of this.
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', '@heroicons/react'],
          utils: ['axios', 'js-yaml', '@apidevtools/swagger-parser'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    strictPort: false,
  },
}));
