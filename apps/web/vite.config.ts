import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

const certificate = (name: string): Buffer | null => {
  const path = fileURLToPath(new URL(`./certificates/${name}`, import.meta.url));

  return existsSync(path) ? readFileSync(path) : null;
};

/**
 * Where the push service worker is served from, and what it is written in.
 *
 * A service worker has to be a script at a stable path — it may only control
 * pages at or below its own — and it cannot be bundled with the app, because
 * it runs when the app is not open. That is the one case the no-JavaScript
 * rule cannot accommodate directly, so the source is TypeScript and the
 * served file is a build artifact: compiled on demand in development, emitted
 * once at build, and never committed.
 */
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
