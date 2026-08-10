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
import createPlaybackServiceModule from '@FluxServer/playback/createPlaybackService'
import createJobQueueModule from '@FluxServer/jobs/createJobQueue'

const { createApp } = AppModule
const { createAuth } = AuthModule
const { createDatabase } = DatabaseModule
const { user, mediaItem, userProfile } = SchemaModule
const { readEnv } = EnvModule
const { createDatabaseSettingsStore } = createDatabaseSettingsStoreModule
const { createDatabaseLibraryService } = createDatabaseLibraryServiceModule
const { createMediaFileSystem } = createMediaFileSystemModule
const { createTranscoderClient } = TranscoderClientModule
const { createPlaybackService } = createPlaybackServiceModule
const { createJobQueue } = createJobQueueModule

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
  onUserCreated: async (userId) => {
    await db.insert(userProfile).values({ userId }).onConflictDoNothing()
  },
  onPasswordResetRequested: (email, url) => {
    // Written to the log rather than emailed. The operator of a homelab server
    // can read their own logs; they usually cannot send mail.
    process.stdout.write(`password reset for ${email}: ${url}\n`)

    return Promise.resolve()
  },
})

const countUsers = async (): Promise<number> => {
  const rows = await db.select({ total: count() }).from(user)

  return rows[0]?.total ?? 0
}

const promoteToAdmin = async (email: string): Promise<void> => {
  await db.update(user).set({ role: 'admin' }).where(eq(user.email, email))
}

const transcoder = createTranscoderClient({ baseUrl: env.TRANSCODER_URL })

// The queue and the library know about each other: the library enqueues
// scans, and the queue calls the library's worker body to run them.
const jobs = await createJobQueue({
  connectionString: env.DATABASE_URL,
  onScan: async (libraryId) => {
    await libraryService.runScan(libraryId)
  },
  onProblem: (message) => {
    process.stderr.write(`job queue: ${message}\n`)
  },
})

const libraryService = createDatabaseLibraryService({
  db,
  files: createMediaFileSystem(),
  transcoder,
  jobs,
  onProblem: (path, reason) => {
    process.stderr.write(`skipped ${path}: ${reason}\n`)
  },
})

const playbackService = createPlaybackService({
  media: {
    findForPlayback: async (mediaId) => {
      const item = await libraryService.getMedia(mediaId)

      if (item === null) {
        return null
      }

      const rows = await db
        .select({ path: mediaItem.path })
        .from(mediaItem)
        .where(eq(mediaItem.id, mediaId))
        .limit(1)

      const path = rows[0]?.path

      return path === undefined ? null : { item, path }
    },
  },
  transcoder,
  sessionUrlPrefix: '/api/playback/session',
  directUrlPrefix: '/api/playback',
  trickplayUrlPrefix: '/api/playback/trickplay',
})

const app = createApp({
  auth,
  settings,
  countUsers,
  promoteToAdmin,
  library: libraryService,
  playback: playbackService,
  isTranscoderReachable: () => transcoder.isReachable(),
})

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  const origin = `http://localhost:${info.port.toString()}`

  process.stdout.write(`Flux listening on ${origin}\n`)

  if (persisted.setupCompletedAt === null) {
    process.stdout.write(`First-run setup at ${origin}\n`)
  }

  process.stdout.write(`API reference at ${origin}/api/reference\n`)
})
