import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/, // يشمل .js .jsx (وأيضًا ts/tsx لو وُجد)
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' }, // لأي تبعية JS تحتوي JSX
    },
  },
  server: {
    port: 3000,
    // Dev proxy: forward API/media/static to Django on 8000
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: { port: 3000 },
});
