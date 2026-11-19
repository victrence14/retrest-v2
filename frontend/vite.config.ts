import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { themeBootstrap } from '@retrest/design-tokens/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), themeBootstrap(), VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // The committed manifest is generated from shared theme tokens.
      includeAssets: ['manifest.json', 'favicon.svg', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json,woff2,ttf}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/auth(?:\/|$)/],
        cleanupOutdatedCaches: true,
        // No runtime caching: Supabase Auth and private API responses stay on the network.
      },
      devOptions: { enabled: false },
    })],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001', changeOrigin: true } } },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001', changeOrigin: true } } },
  };
});
