import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'production',
    },
    coverage: {
      thresholds: { lines: 85, functions: 79, branches: 75, statements: 85 },
    },
  },
});
