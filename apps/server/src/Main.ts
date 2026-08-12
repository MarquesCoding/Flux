import { join } from 'node:path';
import { readdir, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { serve } from '@hono/node-server';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { and, count, eq, lt } from 'drizzle-orm';
import { createApp } from './App';
import { createAuth } from '@FluxServer/auth/Auth';
import { createDatabase } from '@FluxServer/db/Database';
import {
  user,
  library,
  mediaItem,
  mediaItemJob,
  userProfile,
  viewerProfile,
  session,
  deviceCode,
} from '@FluxServer/db/Schema';
import { readEnv } from '@FluxServer/env/Env';
import { createDatabaseSettingsStore } from '@FluxServer/settings/createDatabaseSettingsStore';
import { createDatabaseLibraryService } from '@FluxServer/library/createDatabaseLibraryService';
import { createCatalogueMetadataProvider } from '@FluxServer/library/createCatalogueMetadataProvider';
import { createFilenameMetadataProvider } from '@FluxServer/library/createFilenameMetadataProvider';
import { createMediaFileSystem } from '@FluxServer/library/createMediaFileSystem';
import { createTranscoderClient } from '@FluxServer/transcoder/TranscoderClient';
import { createImageCache } from '@FluxServer/images/createImageCache';
import { detectLibrarySegments } from '@FluxServer/segments/detectLibrarySegments';
import { createDatabaseWatchProgressService } from '@FluxServer/progress/createDatabaseWatchProgressService';
import { createDatabaseFavouriteService } from '@FluxServer/favourites/createDatabaseFavouriteService';
import { createDatabaseSegmentService } from '@FluxServer/segments/createDatabaseSegmentService';
import { createChapterSegmentProvider } from '@FluxServer/segments/createChapterSegmentProvider';
import { createFingerprintSegmentProvider } from '@FluxServer/segments/createFingerprintSegmentProvider';
import { createSidecarSubtitleService } from '@FluxServer/subtitles/createSidecarSubtitleService';
import { createDatabaseProfileService } from '@FluxServer/profiles/createDatabaseProfileService';
import { ViewerProfileSchema } from '@FluxContracts/schemas/ViewerProfile';
import { createEmbeddedSubtitleService } from '@FluxServer/subtitles/createEmbeddedSubtitleService';
import { createLayeredSubtitleService } from '@FluxServer/subtitles/createLayeredSubtitleService';
import { createPlaybackService } from '@FluxServer/playback/createPlaybackService';
import { createJobQueue } from '@FluxServer/jobs/createJobQueue';
import {
  SCAN_LIBRARY_JOB,
  READ_AGAIN_JOB,
  ReadAgainJobSchema,
  ScanLibraryJobSchema,
  REGENERATE_PREVIEWS_JOB,
  RegeneratePreviewsJobSchema,
  REGENERATE_TRICKPLAY_JOB,
  RegenerateTrickplayJobSchema,
  DETECT_SEGMENTS_JOB,
  DetectSegmentsJobSchema,
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
  scheduleTriggerKind,
} from '@FluxServer/jobs/JobQueue';
import { createDatabaseMaintenanceService } from '@FluxServer/maintenance/createDatabaseMaintenanceService';
import { cleanupImageCache } from '@FluxServer/maintenance/cleanupImageCache';
import { cleanupSessions } from '@FluxServer/maintenance/cleanupSessions';
import { checkCatalogueConnectivity } from '@FluxServer/maintenance/checkCatalogueConnectivity';
import { RESET_LIBRARY_JOB, scheduleQueueNameFor } from '@FluxServer/jobs/jobDefinitions';
import { createJobScheduleService } from '@FluxServer/jobs/createJobScheduleService';
import { createDatabaseJobTriggerStore } from '@FluxServer/jobs/createDatabaseJobTriggerStore';
import { markJobComplete } from '@FluxServer/library/createMediaStore';
import { createWorkLock } from '@FluxServer/jobs/createWorkLock';
import { seedDefaultJobTriggers } from '@FluxServer/jobs/seedDefaultJobTriggers';
/**
 * Chapters as they were stored, which may be from an older shape.
 */
const ChapterListSchema = z.array(
  z.object({
    title: z.string().nullable(),
    startSeconds: z.number(),
    endSeconds: z.number(),
  }),
);
const env = readEnv(process.env);
const { db, schema } = createDatabase(env.DATABASE_URL);

const settings = createDatabaseSettingsStore({
  db,
  defaults: {
    trustedOrigins: env.TRUSTED_ORIGINS,
    cookieSecure: env.COOKIE_SECURE,
    setupCompletedAt: null,
    catalogueApiKey: env.CATALOGUE_API_KEY,
    seededJobTriggerKinds: [],
  },
});

const persisted = await settings.read();

const auth = createAuth({
  env,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  settings,
  cookieSecure: persisted.cookieSecure,
  onUserCreated: async (userId) => {
    await db.insert(userProfile).values({ userId }).onConflictDoNothing();
  },
  onPasswordResetRequested: (email, url) => {
    process.stdout.write(`password reset for ${email}: ${url}\n`);

    return Promise.resolve();
  },
});

const countUsers = async (): Promise<number> => {
  const rows = await db.select({ total: count() }).from(user);

  return rows[0]?.total ?? 0;
};

const promoteToAdmin = async (email: string): Promise<void> => {
  await db.update(user).set({ role: 'admin' }).where(eq(user.email, email));
};

const profileService = createDatabaseProfileService(db, join(env.IMAGE_CACHE_DIR, 'profiles'));

const transcoder = createTranscoderClient({ baseUrl: env.TRANSCODER_URL });

/**
 * Finds intros, outros and other skippable segments across a library's
 * already-scanned media.
 *
 * Its own function rather than inline in a handler because it runs from two
 * places: after every scan (walking a directory takes seconds; listening to
 * a season takes minutes, and a library should be browsable long before its
 * intros are known), and on its own from the Work tab, for redoing detection
 * without a full rescan.
 */
const runDetectSegments = async (libraryId: string, jobId: string): Promise<void> => {
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
          completedAt: mediaItemJob.completedAt,
        })
        .from(mediaItem)
        .leftJoin(
          mediaItemJob,
          and(
            eq(mediaItemJob.mediaItemId, mediaItem.id),
            eq(mediaItemJob.kind, DETECT_SEGMENTS_JOB),
          ),
        )
        .where(eq(mediaItem.libraryId, id));

      return rows.map((row) => ({
        mediaId: row.mediaId,
        path: row.path,
        durationSeconds: row.durationSeconds,
        seriesTitle: row.seriesTitle,
        seasonNumber: row.seasonNumber,
        isComplete: row.completedAt !== null,
        probe: {
          container: row.container,
          durationSeconds: row.durationSeconds,
          bitrateKbps: row.bitrateKbps,
          video: null,
          audioStreams: [],
          subtitleStreams: [],
          chapters: ChapterListSchema.catch([]).parse(row.chapters),
        },
      }));
    },
    markComplete: (mediaId) => markJobComplete(db, mediaId, DETECT_SEGMENTS_JOB),
    onProblem: (provider, reason) => {
      process.stderr.write(`segments: ${provider}: ${reason}\n`);
    },
    onProgress: (processed, total) => {
      jobs.reportProgress(jobId, 'segments', processed, total);
    },
  });

  if (marked > 0) {
    process.stdout.write(`marked segments on ${marked.toString()} item(s)\n`);
  }
};

/**
 * Wraps a per-library job so a schedule can fire it against every current
 * library, decided at the moment it runs rather than whatever existed when
 * the schedule was set — see `scheduleTriggerKind`.
 */
const scheduleAcrossLibraries =
  (run: (libraryId: string) => Promise<{ jobId: string; state: string } | null>) =>
  async (): Promise<void> => {
    const libraries = await libraryService.list();

    await Promise.all(libraries.map((library) => run(library.id)));
  };

const libraryWork = createWorkLock();

const jobs = await createJobQueue({
  connectionString: env.DATABASE_URL,
  handlers: {
    [SCAN_LIBRARY_JOB]: async (jobId, payload) => {
      const parsed = ScanLibraryJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write('job queue: a scan job carried data Flux could not read.\n');

        return;
      }

      const { libraryId, force } = parsed.data;

      await libraryWork.run(libraryId, async () => {
        const libraries = await libraryService.list();
        const language = libraries.find((entry) => entry.id === libraryId)?.defaultAudioLanguage;

        await libraryService.runScan(libraryId, force, jobId);
        await libraryService.runRegeneratePreviews(libraryId, language ?? null, jobId);
        await libraryService.runRegenerateTrickplay(libraryId, jobId);
        await runDetectSegments(libraryId, jobId);
      });
    },
    [READ_AGAIN_JOB]: async (jobId, payload) => {
      const parsed = ReadAgainJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write('job queue: a re-read job carried data Flux could not read.\n');

        return;
      }

      const { libraryId, paths } = parsed.data;

      await libraryWork.run(libraryId, async () => {
        await libraryService.runReadAgain(libraryId, paths, jobId);
      });
    },
    [REGENERATE_PREVIEWS_JOB]: async (jobId, payload) => {
      const parsed = RegeneratePreviewsJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write(
          'job queue: a preview regeneration job carried data Flux could not read.\n',
        );

        return;
      }

      await libraryWork.run(parsed.data.libraryId, () =>
        libraryService.runRegeneratePreviews(
          parsed.data.libraryId,
          parsed.data.defaultAudioLanguage,
          jobId,
        ),
      );
    },
    [REGENERATE_TRICKPLAY_JOB]: async (jobId, payload) => {
      const parsed = RegenerateTrickplayJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write('job queue: a trickplay job carried data Flux could not read.\n');

        return;
      }

      await libraryWork.run(parsed.data.libraryId, () =>
        libraryService.runRegenerateTrickplay(parsed.data.libraryId, jobId),
      );
    },
    [DETECT_SEGMENTS_JOB]: async (jobId, payload) => {
      const parsed = DetectSegmentsJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write(
          'job queue: a segment detection job carried data Flux could not read.\n',
        );

        return;
      }

      await libraryWork.run(parsed.data.libraryId, () =>
        runDetectSegments(parsed.data.libraryId, jobId),
      );
    },
    [CLEANUP_IMAGE_CACHE_JOB]: async (jobId) => {
      const removed = await cleanupImageCache({
        imageCacheDir: env.IMAGE_CACHE_DIR,
        profilesDir: join(env.IMAGE_CACHE_DIR, 'profiles'),
        files: {
          list: async (directory) => {
            const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

            return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
          },
          remove: (path) => unlink(path),
        },
        nameFor: images.nameFor,
        listMediaImageUrls: () =>
          db
            .select({ posterUrl: mediaItem.posterUrl, backdropUrl: mediaItem.backdropUrl })
            .from(mediaItem),
        listProfilePhotoPaths: async () => {
          const rows = await db.select({ photoPath: viewerProfile.photoPath }).from(viewerProfile);

          return rows.map((row) => row.photoPath);
        },
        onProblem: (path, reason) => {
          process.stderr.write(`image cache: ${path}: ${reason}\n`);
        },
        onProgress: (phase, processed, total) => {
          jobs.reportProgress(jobId, phase, processed, total);
        },
      });

      process.stdout.write(`image cache cleanup: removed ${removed.toString()} file(s)\n`);
    },
    [CLEANUP_SESSIONS_JOB]: async (jobId) => {
      const removed = await cleanupSessions({
        deleteExpiredSessions: async () => {
          const rows = await db
            .delete(session)
            .where(lt(session.expiresAt, new Date()))
            .returning({ id: session.id });

          return rows.length;
        },
        deleteExpiredDeviceCodes: async () => {
          const rows = await db
            .delete(deviceCode)
            .where(lt(deviceCode.expiresAt, new Date()))
            .returning({ id: deviceCode.id });

          return rows.length;
        },
        onProgress: (phase, processed, total) => {
          jobs.reportProgress(jobId, phase, processed, total);
        },
      });

      process.stdout.write(`session cleanup: removed ${removed.toString()} row(s)\n`);
    },
    [CHECK_CATALOGUE_CONNECTIVITY_JOB]: async (jobId) => {
      jobs.reportProgress(jobId, 'checking', 0, 1);

      const reachable = await checkCatalogueConnectivity({
        readApiKey: async () => (await settings.read()).catalogueApiKey,
      });

      jobs.reportProgress(jobId, reachable ? 'reachable' : 'unreachable', 1, 1);
      process.stdout.write(`catalogue connectivity: ${reachable ? 'reachable' : 'unreachable'}\n`);
    },
    [scheduleTriggerKind(SCAN_LIBRARY_JOB)]: scheduleAcrossLibraries((id) =>
      libraryService.scan(id, false),
    ),
    [scheduleTriggerKind(REGENERATE_PREVIEWS_JOB)]: scheduleAcrossLibraries((id) =>
      libraryService.regeneratePreviews(id),
    ),
    [scheduleTriggerKind(REGENERATE_TRICKPLAY_JOB)]: scheduleAcrossLibraries((id) =>
      libraryService.regenerateTrickplay(id),
    ),
    [scheduleTriggerKind(DETECT_SEGMENTS_JOB)]: scheduleAcrossLibraries((id) =>
      libraryService.detectSegments(id),
    ),
    [scheduleTriggerKind(RESET_LIBRARY_JOB)]: scheduleAcrossLibraries((id) =>
      libraryService.reset(id),
    ),
  },
  onProblem: (message) => {
    process.stderr.write(`job queue: ${message}\n`);
  },
});

const maintenance = createDatabaseMaintenanceService({ jobs });
const schedules = createJobScheduleService({ store: createDatabaseJobTriggerStore(db), jobs });

const catalogueProvider = createCatalogueMetadataProvider({
  readApiKey: async () => (await settings.read()).catalogueApiKey,
  onProblem: (reason) => {
    process.stderr.write(`catalogue: ${reason}\n`);
  },
});

const libraryService = createDatabaseLibraryService({
  db,
  files: createMediaFileSystem(),
  transcoder,
  jobs,
  providers: [catalogueProvider, createFilenameMetadataProvider()],
  atOnce: env.MEDIA_JOBS,
  onProblem: (path, reason) => {
    process.stderr.write(`skipped ${path}: ${reason}\n`);
  },
});

const findMediaPath = async (mediaId: string): Promise<string | null> => {
  const rows = await db
    .select({ path: mediaItem.path })
    .from(mediaItem)
    .where(eq(mediaItem.id, mediaId))
    .limit(1);

  return rows[0]?.path ?? null;
};

const reportSubtitleProblem = (path: string, reason: string): void => {
  process.stderr.write(`subtitles: ${path}: ${reason}\n`);
};

const subtitleService = createLayeredSubtitleService([
  createSidecarSubtitleService({
    media: { findPath: findMediaPath },
    onProblem: reportSubtitleProblem,
  }),
  createEmbeddedSubtitleService({
    media: {
      find: async (mediaId) => {
        const item = await libraryService.getMedia(mediaId);
        const path = await findMediaPath(mediaId);

        return item === null || path === null ? null : { path, streams: item.subtitleStreams };
      },
    },
    transcoder,
    onProblem: reportSubtitleProblem,
  }),
]);

const segmentService = createDatabaseSegmentService(db);

const segmentProviders = [
  createChapterSegmentProvider(),
  createFingerprintSegmentProvider({
    transcoder,
    atOnce: env.MEDIA_JOBS,
    onProblem: (path, reason) => {
      process.stderr.write(`segments ${path}: ${reason}\n`);
    },
  }),
];

const images = createImageCache({
  directory: env.IMAGE_CACHE_DIR,
  onProblem: (url, reason) => {
    process.stderr.write(`artwork ${url}: ${reason}\n`);
  },
});

const playbackService = createPlaybackService({
  media: {
    findForPlayback: async (mediaId) => {
      const item = await libraryService.getMedia(mediaId);

      if (item === null) {
        return null;
      }

      const rows = await db
        .select({ path: mediaItem.path, defaultAudioLanguage: library.defaultAudioLanguage })
        .from(mediaItem)
        .innerJoin(library, eq(library.id, mediaItem.libraryId))
        .where(eq(mediaItem.id, mediaId))
        .limit(1);

      const row = rows[0];

      return row === undefined
        ? null
        : { item, path: row.path, defaultAudioLanguage: row.defaultAudioLanguage };
    },
  },
  transcoder,
  sessionUrlPrefix: '/api/playback/session',
  directUrlPrefix: '/api/playback',
  trickplayUrlPrefix: '/api/playback/trickplay',
});

const app = createApp({
  auth,
  settings,
  countUsers,
  promoteToAdmin,
  library: libraryService,
  playback: playbackService,
  maintenance,
  schedules,
  subtitles: subtitleService,
  segments: segmentService,
  progress: createDatabaseWatchProgressService(db),
  favourites: createDatabaseFavouriteService(db),
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
      .limit(1);

    const found = rows[0];

    if (found === undefined) {
      return { kind: 'missing' };
    }

    const created = await auth.api
      .signUpEmail({ body: { email, password, name: found.name } })
      .catch(() => null);

    if (created === null) {
      return { kind: 'taken' };
    }

    await profileService.moveTo(profileId, created.user.id);

    return {
      kind: 'promoted',
      profile: ViewerProfileSchema.parse({
        id: found.id,
        name: found.name,
        colour: found.colour,
        createdAt: found.createdAt.toISOString(),
      }),
    };
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
      .from(user);

    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  },
  capabilities: () => transcoder.capabilities(),
  monitor: () => transcoder.readMonitor(),
  monitorStream: () => transcoder.openMonitorStream(),
  readImage: (url) => images.read(url),
  isTranscoderReachable: () => transcoder.isReachable(),
  listRunningJobs: () => jobs.listRunning(),
  searchCatalogue: (query, kind) => catalogueProvider.search?.(query, kind) ?? Promise.resolve([]),
});

const seededKinds = await seedDefaultJobTriggers({ schedules, settings });

if (seededKinds.length > 0) {
  process.stdout.write(`schedule: default triggers set for ${seededKinds.join(', ')}\n`);
}

for (const kind of await schedules.sync()) {
  await jobs.enqueue(scheduleQueueNameFor(kind), {});
  process.stdout.write(`schedule: running ${kind} on startup\n`);
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  const origin = `http://localhost:${info.port.toString()}`;

  process.stdout.write(`Flux listening on ${origin}\n`);

  if (persisted.setupCompletedAt === null) {
    process.stdout.write(`First-run setup at ${origin}\n`);
  }

  process.stdout.write(`API reference at ${origin}/api/reference\n`);
});
