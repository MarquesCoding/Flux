import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const certificate = (name: string): Buffer | null => {
  const path = fileURLToPath(new URL(`./certificates/${name}`, import.meta.url));

  return existsSync(path) ? readFileSync(path) : null;
};

const cert = certificate('local.pem');
const key = certificate('local-key.pem');

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths({ root: '../../' })],
  server: {
    port: 5173,
    host: true,
    ...(cert === null || key === null ? {} : { https: { cert, key } }),
    proxy: {
      '/api': 'http://localhost:8420',
    },
  },
});
