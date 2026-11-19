import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { themeBootstrap } from '@retrest/design-tokens/vite';

export default defineConfig({
  plugins: [react(), themeBootstrap()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
