import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API is served under the same origin in dev, so the session cookie just works.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
