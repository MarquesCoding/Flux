import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const NOT_BUNDLED = [/^electron$/, /^conf$/, /^better-auth(\/.*)?$/, /^@better-auth\/.*/, /^zod$/];

export default defineConfig({
  main: {
    resolve: { tsconfigPaths: true },
    build: {
      outDir: 'dist-main',
      lib: { entry: 'src/main/Main.ts' },
      rollupOptions: { external: NOT_BUNDLED, output: { entryFileNames: 'main/Main.js' } },
    },
  },
  preload: {
    resolve: { tsconfigPaths: true },
    build: {
      outDir: 'dist-preload',
      lib: { entry: 'src/preload/Preload.ts' },
      rollupOptions: { external: NOT_BUNDLED, output: { entryFileNames: 'preload/Preload.js' } },
    },
  },
  renderer: {
    root: '.',
    resolve: { tsconfigPaths: true },
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist', target: 'chrome138', rollupOptions: { input: 'index.html' } },
  },
});
