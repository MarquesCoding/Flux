import { z } from 'zod'
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
import detectLibrarySegmentsModule from '@FluxServer/segments/detectLibrarySegments'
import createDatabaseWatchProgressServiceModule from '@FluxServer/progress/createDatabaseWatchProgressService'
import createDatabaseSegmentServiceModule from '@FluxServer/segments/createDatabaseSegmentService'
import createChapterSegmentProviderModule from '@FluxServer/segments/createChapterSegmentProvider'
import createFingerprintSegmentProviderModule from '@FluxServer/segments/createFingerprintSegmentProvider'
import createSidecarSubtitleServiceModule from '@FluxServer/subtitles/createSidecarSubtitleService'
import createDatabaseProfileServiceModule from '@FluxServer/profiles/createDatabaseProfileService'
import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import createEmbeddedSubtitleServiceModule from '@FluxServer/subtitles/createEmbeddedSubtitleService'
import createLayeredSubtitleServiceModule from '@FluxServer/subtitles/createLayeredSubtitleService'
import createPlaybackServiceModule from '@FluxServer/playback/createPlaybackService'
import createJobQueueModule from '@FluxServer/jobs/createJobQueue'

const { createApp } = AppModule
const { createAuth } = AuthModule
const { createDatabase } = DatabaseModule
const { user, mediaItem, userProfile, viewerProfile } = SchemaModule
const { readEnv } = EnvModule
const { createDatabaseSettingsStore } = createDatabaseSettingsStoreModule
const { createDatabaseLibraryService } = createDatabaseLibraryServiceModule
const { createMediaFileSystem } = createMediaFileSystemModule
const { createCatalogueMetadataProvider } = createCatalogueMetadataProviderModule
const { createFilenameMetadataProvider } = createFilenameMetadataProviderModule
const { createTranscoderClient } = TranscoderClientModule
const { createPlaybackService } = createPlaybackServiceModule
const { createSidecarSubtitleService } = createSidecarSubtitleServiceModule
const { createDatabaseProfileService } = createDatabaseProfileServiceModule
const { ViewerProfileSchema } = ViewerProfileModule
const { createEmbeddedSubtitleService } = createEmbeddedSubtitleServiceModule
const { createLayeredSubtitleService } = createLayeredSubtitleServiceModule
const { createImageCache } = createImageCacheModule
const { createDatabaseSegmentService } = createDatabaseSegmentServiceModule
const { createDatabaseWatchProgressService } = createDatabaseWatchProgressServiceModule
const { detectLibrarySegments } = detectLibrarySegmentsModule

/**
 * Chapters as they were stored, which may be from an older shape.
 */
const ChapterListSchema = z.array(
  z.object({
    title: z.string().nullable(),
    startSeconds: z.number(),
    endSeconds: z.number(),
  }),
)
const { createChapterSegmentProvider } = createChapterSegmentProviderModule
const { createFingerprintSegmentProvider } = createFingerprintSegmentProviderModule
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

const profileService = createDatabaseProfileService(db)

const transcoder = createTranscoderClient({ baseUrl: env.TRANSCODER_URL })

// The queue and the library know about each other: the library enqueues
// scans, and the queue calls the library's worker body to run them.
const jobs = await createJobQueue({
  connectionString: env.DATABASE_URL,
  onScan: async (libraryId, force) => {
    await libraryService.runScan(libraryId, force)

    // Detection runs after the scan rather than inside it. Walking a directory
    // takes seconds; listening to a season takes minutes, and a library should
    // be browsable long before its intros are known.
    const marked = await detectLibrarySegments({
      libraryId,
      providers: segmentProviders,
      segments: segmentService,
      listCandidates: async (id) => {
        const rows = await db
          .select({
            mediaId: mediaItem.id,
            path: mediaItem.path,
            durationSeconds: mediaItem.durationSeconds,
            seriesTitle: mediaItem.seriesTitle,
            seasonNumber: mediaItem.seasonNumber,
            chapters: mediaItem.chapters,
            container: mediaItem.container,
            bitrateKbps: mediaItem.bitrateKbps,
          })
          .from(mediaItem)
          .where(eq(mediaItem.libraryId, id))

        return rows.map((row) => ({
          mediaId: row.mediaId,
          path: row.path,
          durationSeconds: row.durationSeconds,
          seriesTitle: row.seriesTitle,
          seasonNumber: row.seasonNumber,
          probe: {
            container: row.container,
            durationSeconds: row.durationSeconds,
            bitrateKbps: row.bitrateKbps,
            video: null,
            // Only the chapters matter here. Detection reads names a release
            // wrote; nothing else about the streams is consulted.
            audioStreams: [],
            subtitleStreams: [],
            chapters: ChapterListSchema.catch([]).parse(row.chapters),
          },
        }))
      },
      onProblem: (provider, reason) => {
        process.stderr.write(`segments: ${provider}: ${reason}\n`)
      },
    })

    if (marked > 0) {
      process.stdout.write(`marked segments on ${marked.toString()} item(s)\n`)
    }
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

const reportSubtitleProblem = (path: string, reason: string): void => {
  process.stderr.write(`subtitles: ${path}: ${reason}\n`)
}

// Sidecars first: a track someone put beside the file themselves is a
// deliberate choice, where an embedded one is whatever the release shipped.
const subtitleService = createLayeredSubtitleService([
  createSidecarSubtitleService({
    media: { findPath: findMediaPath },
    onProblem: reportSubtitleProblem,
  }),
  createEmbeddedSubtitleService({
    media: {
      find: async (mediaId) => {
        const item = await libraryService.getMedia(mediaId)
        const path = await findMediaPath(mediaId)

        return item === null || path === null ? null : { path, streams: item.subtitleStreams }
      },
    },
    transcoder,
    onProblem: reportSubtitleProblem,
  }),
])

const segmentService = createDatabaseSegmentService(db)

// Chapters first: where a release named its own intro there is nothing to
// detect, and listening to a whole season to rediscover it would be absurd.
const segmentProviders = [
  createChapterSegmentProvider(),
  createFingerprintSegmentProvider({
    transcoder,
    onProblem: (path, reason) => {
      process.stderr.write(`segments ${path}: ${reason}\n`)
    },
  }),
]

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
  segments: segmentService,
  progress: createDatabaseWatchProgressService(db),
  profiles: profileService,
  promoteProfile: async ({ profileId, email, password }) => {
    const rows = await db
      .select({
        id: viewerProfile.id,
        name: viewerProfile.name,
        colour: viewerProfile.colour,
        createdAt: viewerProfile.createdAt,
      })
      .from(viewerProfile)
      .where(eq(viewerProfile.id, profileId))
      .limit(1)

    const found = rows[0]

    if (found === undefined) {
      return { kind: 'missing' }
    }

    // better-auth owns how a password becomes a credential, so the account is
    // made through it rather than by writing rows. A duplicate address is the
    // ordinary failure here and reads as a conflict rather than as a fault.
    const created = await auth.api
      .signUpEmail({ body: { email, password, name: found.name } })
      .catch(() => null)

    if (created === null) {
      return { kind: 'taken' }
    }

    await profileService.moveTo(profileId, created.user.id)

    return {
      kind: 'promoted',
      profile: ViewerProfileSchema.parse({
        id: found.id,
        name: found.name,
        colour: found.colour,
        createdAt: found.createdAt.toISOString(),
      }),
    }
  },
  listUsers: async () => {
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)

    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
  },
  capabilities: () => transcoder.capabilities(),
  monitor: () => transcoder.readMonitor(),
  monitorStream: () => transcoder.openMonitorStream(),
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
