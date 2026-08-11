import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

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
    proxy: {
      '/api': 'http://localhost:8420',
    },
  },
})
