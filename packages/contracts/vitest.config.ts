import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
