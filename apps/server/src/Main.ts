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
import createCatalogueMetadataProviderModule from '@FluxServer/library/createCatalogueMetadataProvider'
import createFilenameMetadataProviderModule from '@FluxServer/library/createFilenameMetadataProvider'
import createMediaFileSystemModule from '@FluxServer/library/createMediaFileSystem'
import TranscoderClientModule from '@FluxServer/transcoder/TranscoderClient'
import createImageCacheModule from '@FluxServer/images/createImageCache'
import createSidecarSubtitleServiceModule from '@FluxServer/subtitles/createSidecarSubtitleService'
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
const { createCatalogueMetadataProvider } = createCatalogueMetadataProviderModule
const { createFilenameMetadataProvider } = createFilenameMetadataProviderModule
const { createTranscoderClient } = TranscoderClientModule
const { createPlaybackService } = createPlaybackServiceModule
const { createSidecarSubtitleService } = createSidecarSubtitleServiceModule
const { createImageCache } = createImageCacheModule
const { createJobQueue } = createJobQueueModule

const env = readEnv(process.env)
const { db, schema } = createDatabase(env.DATABASE_URL)

const settings = createDatabaseSettingsStore({
  db,
  defaults: {
    trustedOrigins: env.TRUSTED_ORIGINS,
    cookieSecure: env.COOKIE_SECURE,
    setupCompletedAt: null,
    catalogueApiKey: env.CATALOGUE_API_KEY,
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
  onScan: async (libraryId, force) => {
    await libraryService.runScan(libraryId, force)
  },
  onProblem: (message) => {
    process.stderr.write(`job queue: ${message}\n`)
  },
})

const catalogueProvider = createCatalogueMetadataProvider({
  readApiKey: async () => (await settings.read()).catalogueApiKey,
  onProblem: (reason) => {
    process.stderr.write(`catalogue: ${reason}\n`)
  },
})

const libraryService = createDatabaseLibraryService({
  db,
  files: createMediaFileSystem(),
  transcoder,
  jobs,
  // The catalogue first, the filename reader behind it. A catalogue that is
  // unconfigured, down or simply ignorant of a file falls through to the name
  // on disk rather than leaving the item blank.
  providers: [catalogueProvider, createFilenameMetadataProvider()],
  onProblem: (path, reason) => {
    process.stderr.write(`skipped ${path}: ${reason}\n`)
  },
})

const findMediaPath = async (mediaId: string): Promise<string | null> => {
  const rows = await db
    .select({ path: mediaItem.path })
    .from(mediaItem)
    .where(eq(mediaItem.id, mediaId))
    .limit(1)

  return rows[0]?.path ?? null
}

const subtitleService = createSidecarSubtitleService({
  media: { findPath: findMediaPath },
  onProblem: (path, reason) => {
    process.stderr.write(`subtitles: ${path}: ${reason}\n`)
  },
})

const images = createImageCache({
  directory: env.IMAGE_CACHE_DIR,
  onProblem: (url, reason) => {
    process.stderr.write(`artwork ${url}: ${reason}\n`)
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
  subtitles: subtitleService,
  readImage: (url) => images.read(url),
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
