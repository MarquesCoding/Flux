import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

/*
 * A certificate this machine trusts, if one has been made.
 *
 * Casting is offered by browsers over a secure connection and over localhost,
 * and a server has to be read at its address on the network for a television
 * to fetch anything from it — which is not localhost. So development over TLS
 * is not a nicety here; it is the only way the two conditions are met at once.
 *
 * Absent by default, and absent is fine: the server falls back to plain HTTP,
 * which is enough for everything except casting. `mkcert` writes the pair,
 * and the certificates are ignored by git — a key in a repository is a key
 * that has escaped.
 */
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
    /*
     * Answers on the network rather than only to this machine.
     *
     * A television being cast to fetches the stream itself, from whatever
     * address the page was read at — so a development server nobody else can
     * reach is a development server nothing can be cast from. The API is
     * proxied through here, which means the same address serves both.
     */
    host: true,
    ...(cert === null || key === null ? {} : { https: { cert, key } }),
    proxy: {
      '/api': 'http://localhost:8420',
    },
  },
});
