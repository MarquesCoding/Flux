import { serve } from '@hono/node-server'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { count, eq } from 'drizzle-orm'
import AppModule from './App'
import AuthModule from '@FluxServer/auth/Auth'
import DatabaseModule from '@FluxServer/db/Database'
import SchemaModule from '@FluxServer/db/Schema'
import EnvModule from '@FluxServer/env/Env'
import createDatabaseSettingsStoreModule from '@FluxServer/settings/createDatabaseSettingsStore'
import createDatabaseLibraryServiceModule from '@FluxServer/library/createDatabaseLibraryService'
import createMediaFileSystemModule from '@FluxServer/library/createMediaFileSystem'
import TranscoderClientModule from '@FluxServer/transcoder/TranscoderClient'

const { createApp } = AppModule
const { createAuth } = AuthModule
const { createDatabase } = DatabaseModule
const { user } = SchemaModule
const { readEnv } = EnvModule
const { createDatabaseSettingsStore } = createDatabaseSettingsStoreModule
const { createDatabaseLibraryService } = createDatabaseLibraryServiceModule
const { createMediaFileSystem } = createMediaFileSystemModule
const { createTranscoderClient } = TranscoderClientModule

const env = readEnv(process.env)
const { db, schema } = createDatabase(env.DATABASE_URL)

const settings = createDatabaseSettingsStore({
  db,
  defaults: {
    trustedOrigins: env.TRUSTED_ORIGINS,
    cookieSecure: env.COOKIE_SECURE,
    setupCompletedAt: null,
  },
})

const persisted = await settings.read()

const auth = createAuth({
  env,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  settings,
  cookieSecure: persisted.cookieSecure,
})

const countUsers = async (): Promise<number> => {
  const rows = await db.select({ total: count() }).from(user)

  return rows[0]?.total ?? 0
}

const promoteToAdmin = async (email: string): Promise<void> => {
  await db.update(user).set({ role: 'admin' }).where(eq(user.email, email))
}

const transcoder = createTranscoderClient({ baseUrl: env.TRANSCODER_URL })

const libraryService = createDatabaseLibraryService({
  db,
  files: createMediaFileSystem(),
  transcoder,
  onProblem: (path, reason) => {
    process.stderr.write(`skipped ${path}: ${reason}\n`)
  },
})

const app = createApp({
  auth,
  settings,
  countUsers,
  promoteToAdmin,
  library: libraryService,
})

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  const origin = `http://localhost:${info.port.toString()}`

  process.stdout.write(`Flux listening on ${origin}\n`)

  if (persisted.setupCompletedAt === null) {
    process.stdout.write(`First-run setup at ${origin}\n`)
  }

  process.stdout.write(`API reference at ${origin}/api/reference\n`)
})
