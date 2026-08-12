import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

/**
 * Reads the same environment file the server is started with.
 *
 * Without this, drizzle-kit fell back to a database that is not there and
 * exited without saying so, which reads as "there was nothing to migrate"
 * rather than "it never reached your database".
 *
 * Resolved from this file rather than the working directory, since the
 * command is run both from the repository root and from here.
 */
const loadRootEnvironment = (): void => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');

  if (existsSync(root)) {
    process.loadEnvFile(root);
  }
};

loadRootEnvironment();

export default defineConfig({
  schema: './src/db/Schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://flux:flux@localhost:5432/flux',
  },
});
