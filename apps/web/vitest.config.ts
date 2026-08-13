import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      thresholds: { lines: 90, functions: 83, branches: 84, statements: 90 },
    },
  },
});
