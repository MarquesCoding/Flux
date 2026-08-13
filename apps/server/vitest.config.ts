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
      reporter: ['text', 'json-summary'],
      exclude: ['src/db/Schema.ts', 'src/jobs/createInertJobQueue.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
