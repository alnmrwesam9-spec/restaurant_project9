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
  server: { port: 3000 },
  preview: { port: 3000 },
});
