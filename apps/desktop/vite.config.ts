import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 5174, strictPort: true },
  build: { target: 'safari15', emptyOutDir: true },
});
