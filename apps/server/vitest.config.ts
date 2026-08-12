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
      exclude: ['src/db/Schema.ts', 'src/jobs/createInertJobQueue.ts'],
      thresholds: { lines: 88, functions: 82, branches: 77, statements: 88 },
    },
  },
});
