import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  },
  server: {
    proxy: {
      '/login': 'http://localhost:3001',
      '/admin': 'http://localhost:3001',
      '/logout': 'http://localhost:3001',
    }
  }
});
