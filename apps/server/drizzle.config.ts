import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/Schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://flux:flux@localhost:5432/flux',
  },
})
