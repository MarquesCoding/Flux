import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
