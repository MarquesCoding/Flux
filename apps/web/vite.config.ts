import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths({ root: '../../' })],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8420',
    },
  },
})
