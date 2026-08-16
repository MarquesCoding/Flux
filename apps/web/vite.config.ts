import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * Reads a development certificate where one has been put beside the config, so the dev server can be
 * served over HTTPS — several of the browser features Flux uses, passkeys and casting among them,
 * refuse to work over plain HTTP.
 *
 * @param name - The certificate file to read.
 * @returns Its contents, or null where it has not been made.
 */
const certificate = (name: string): Buffer | null => {
  const path = fileURLToPath(new URL(`./certificates/${name}`, import.meta.url));

  return existsSync(path) ? readFileSync(path) : null;
};

const WORKER_SOURCE = 'src/notifications/pushWorker.ts';

const WORKER_PATH = '/push-worker.js';

/**
 * Compiles the push service worker to its own file.
 *
 * Its own bundle rather than an entry of the app's, because Rollup names the
 * app's outputs with content hashes and a service worker registered at a
 * hashed path would be a different worker on every deploy — leaving the old
 * one installed and in charge.
 */
const pushWorker = (): Plugin => ({
  name: 'flux-push-worker',

  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      if (request.url !== WORKER_PATH) {
        next();

        return;
      }

      void build({
        configFile: false,
        logLevel: 'error',
        build: {
          write: false,
          lib: { entry: WORKER_SOURCE, formats: ['es'], fileName: 'push-worker' },
        },
      }).then((made) => {
        const output = Array.isArray(made) ? made[0]?.output : null;
        const chunk = output?.[0];

        response.setHeader('content-type', 'text/javascript');
        response.end(chunk !== undefined && 'code' in chunk ? chunk.code : '');
      });
    });
  },

  closeBundle: async () => {
    await build({
      configFile: false,
      logLevel: 'error',
      build: {
        emptyOutDir: false,
        outDir: 'dist',
        lib: { entry: WORKER_SOURCE, formats: ['es'], fileName: () => 'push-worker.js' },
      },
    });
  },
});

const cert = certificate('local.pem');
const key = certificate('local-key.pem');

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [react(), tailwindcss(), pushWorker()],
  server: {
    port: 5173,
    host: true,
    ...(cert === null || key === null ? {} : { https: { cert, key } }),
    proxy: {
      '/api': 'http://localhost:8420',
    },
  },
});
