import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'json-summary'],
      exclude: [...coverageConfigDefaults.exclude, 'src/base/**', 'src/hooks/**'],
      thresholds: { lines: 90, functions: 90, branches: 83, statements: 90 },
    },
  },
});
