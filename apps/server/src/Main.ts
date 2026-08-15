import { join } from 'node:path';
import { readdir, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { serve } from '@hono/node-server';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { and, count, eq, lt, sql } from 'drizzle-orm';
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
import { createArtworkUsage } from '@FluxServer/images/createArtworkUsage';
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
import type { FinishedJob } from '@FluxServer/jobs/createJobQueue';
import {
  SCAN_LIBRARY_JOB,
  READ_AGAIN_JOB,
  ReadAgainJobSchema,
  ScanLibraryJobSchema,
  REGENERATE_PREVIEWS_JOB,
  RegeneratePreviewsJobSchema,
  REGENERATE_TRICKPLAY_JOB,
  FETCH_LOGOS_JOB,
  RegenerateTrickplayJobSchema,
  FetchLogosJobSchema,
  DETECT_SEGMENTS_JOB,
  DetectSegmentsJobSchema,
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  PRUNE_HISTORY_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
  CHECK_TRANSCODER_JOB,
  DELIVER_WEBHOOK_JOB,
  PRUNE_WEBHOOK_DELIVERIES_JOB,
  DeliverWebhookJobSchema,
  scheduleTriggerKind,
} from '@FluxServer/jobs/JobQueue';
import { createDatabaseWebhookStore } from '@FluxServer/webhooks/createDatabaseWebhookStore';
import { runWebhookDelivery } from '@FluxServer/webhooks/runWebhookDelivery';
import { createWebhookEventBus } from '@FluxServer/events/createWebhookEventBus';
import { createReachabilityWatch } from '@FluxServer/events/createReachabilityWatch';
import { createDatabaseMaintenanceService } from '@FluxServer/maintenance/createDatabaseMaintenanceService';
import { cleanupImageCache } from '@FluxServer/maintenance/cleanupImageCache';
import { sweepArtefactCache } from '@FluxServer/maintenance/sweepArtefactCache';
import { AudioStreamSchema } from '@FluxContracts/schemas/MediaItem';
import {
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} from '@FluxServer/playback/PlaybackService';
import { cleanupSessions } from '@FluxServer/maintenance/cleanupSessions';
import { checkCatalogueConnectivity } from '@FluxServer/maintenance/checkCatalogueConnectivity';
import { RESET_LIBRARY_JOB, scheduleQueueNameFor } from '@FluxServer/jobs/jobDefinitions';
import { createJobScheduleService } from '@FluxServer/jobs/createJobScheduleService';
import { createDatabaseJobTriggerStore } from '@FluxServer/jobs/createDatabaseJobTriggerStore';
import { markJobComplete } from '@FluxServer/library/createMediaStore';
import { createWorkLock } from '@FluxServer/jobs/createWorkLock';
import { seedDefaultJobTriggers } from '@FluxServer/jobs/seedDefaultJobTriggers';
import { seedDefaultRoles } from '@FluxServer/auth/seedDefaultRoles';
import { DEFAULT_ROLE_NAME } from '@FluxCore/functions/defaultRoles';
import { createDatabaseHistoryService } from '@FluxServer/history/createDatabaseHistoryService';
import { createDatabaseSignInStore } from '@FluxServer/accounts/createDatabaseSignInStore';
import { recordSignIn } from '@FluxServer/accounts/recordSignIn';
import { createDatabasePermissionService } from '@FluxServer/auth/createDatabasePermissionService';
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
    hardwareAccel: '',
    seededJobTriggerKinds: [],
    seededRoleNames: [],
  },
});

/**
 * How long a viewing is worth remembering in detail.
 *
 * A year, because that is long enough for "have I seen this" and for a look
 * back over the year, and short enough that the table does not become the
 * largest thing in the database. Anything an operator wants beyond it is a
 * rolled-up figure rather than the events it came from.
 */
const HISTORY_KEPT_FOR_DAYS = 365;

/**
 * How long a webhook delivery is worth remembering.
 *
 * A week, and deliberately far shorter than viewing history. The history
 * answers whether a receiver has been working lately, and lately is the whole
 * of it: nobody goes back a month to read what was sent. Keeping it longer
 * would store a body per event per subscriber for no question anybody asks.
 */
const WEBHOOK_DELIVERIES_KEPT_FOR_DAYS = 7;

const signInStore = createDatabaseSignInStore(db);
const historyService = createDatabaseHistoryService(db);

const persisted = await settings.read();

const auth = createAuth({
  env,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  settings,
  cookieSecure: persisted.cookieSecure,
  onUserCreated: async (userId) => {
    await db.insert(userProfile).values({ userId }).onConflictDoNothing();
  },
  onSignedIn: async (userId, at) => {
    await recordSignIn({
      store: signInStore,
      userId,
      at,
      lastSignInAt: await signInStore.lastSignInAt(userId),
    });
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

/**
 * How much disk the media itself takes, across every library.
 *
 * A sum over rows Flux already keeps rather than a walk of the disk, so it
 * costs a query rather than a directory traversal of a media array. Scanning
 * is what keeps `sizeBytes` honest; this only adds it up.
 */
const readLibraryBytes = async (): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${mediaItem.sizeBytes}), 0)::bigint` })
    .from(mediaItem);

  return Number(rows[0]?.total ?? 0);
};

const promoteToAdmin = async (email: string): Promise<void> => {
  await db.update(user).set({ role: 'admin' }).where(eq(user.email, email));
};

const permissions = createDatabasePermissionService(db);

/**
 * Gives a freshly made account the role a new one is meant to have.
 *
 * Seeding does this for accounts that already existed; somebody invited after
 * that has to be given it here, or they arrive able to do nothing at all.
 */
const giveDefaultRole = async (userId: string): Promise<void> => {
  const member = (await permissions.listRoles()).find((role) => role.name === DEFAULT_ROLE_NAME);

  if (member !== undefined) {
    await permissions.assignRole(userId, member.id);
  }
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
          seriesId: mediaItem.seriesId,
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
        seriesId: row.seriesId,
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
    isCancelled: () => jobs.isCancelled(jobId),
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

const webhookSubscriptions = createDatabaseWebhookStore(db);

const transcoderWatch = createReachabilityWatch({
  onLost: () => {
    process.stderr.write('transcoder: stopped answering\n');

    void events.publish({
      event: 'transcoder.unreachable',
      data: { reason: `${env.TRANSCODER_URL} did not answer a health check.` },
    });
  },
  onRegained: () => {
    process.stdout.write('transcoder: answering again\n');

    void events.publish({ event: 'transcoder.reachable', data: {} });
  },
});

/**
 * Whether the catalogue was answering last time anybody asked.
 *
 * Behind a watch for the same reason the transcoder is, and it changes what
 * this check announces. It used to say the catalogue was unreachable on every
 * failed run: once a day, which was tolerable only because the check is
 * daily. Paired with a recovery that rule breaks — a catalogue that came back
 * would be announced as recovered every morning for ever — so both directions
 * became transitions, and the two checks now follow one rule instead of two.
 */
const catalogueWatch = createReachabilityWatch({
  onLost: () => {
    void events.publish({ event: 'catalogue.unreachable', data: {} });
  },
  onRegained: () => {
    void events.publish({ event: 'catalogue.reachable', data: {} });
  },
});

/**
 * Announces a job that ended, except the one that does the announcing.
 *
 * A delivery that fails is itself a job that failed, and announcing it would
 * queue another delivery, which would fail, which would announce it. The
 * exclusion is what stops one unreachable receiver turning into a queue that
 * never empties.
 *
 * The publish is deliberately not awaited. Nothing about a job that has
 * already finished depends on whether anybody was told about it, and the bus
 * swallows its own failures.
 */
const announceFinishedJob = ({ kind, jobId, subject, reason }: FinishedJob): void => {
  if (kind === DELIVER_WEBHOOK_JOB) {
    return;
  }

  void events.publish(
    reason === null
      ? { event: 'job.completed', data: { kind, jobId, subject } }
      : { event: 'job.failed', data: { kind, jobId, subject, reason } },
  );
};

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

        for (const phase of [
          () => libraryService.runScan(libraryId, force, jobId),
          () => libraryService.runRegeneratePreviews(libraryId, language ?? null, jobId),
          () => libraryService.runRegenerateTrickplay(libraryId, jobId),
          () => runDetectSegments(libraryId, jobId),
        ]) {
          if (jobs.isCancelled(jobId)) {
            return;
          }

          await phase();
        }
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
    [FETCH_LOGOS_JOB]: async (jobId, payload) => {
      const parsed = FetchLogosJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write('job queue: a logo job carried data Flux could not read.\n');

        return;
      }

      await libraryWork.run(parsed.data.libraryId, () =>
        libraryService.runFetchLogos(parsed.data.libraryId, jobId),
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
    [CLEANUP_ARTEFACT_CACHE_JOB]: async () => {
      const swept = await sweepArtefactCache({
        listLiveItems: async () => {
          const rows = await db
            .select({
              path: mediaItem.path,
              audioStreams: mediaItem.audioStreams,
              generation: library.generation,
              defaultAudioLanguage: library.defaultAudioLanguage,
            })
            .from(mediaItem)
            .innerJoin(library, eq(library.id, mediaItem.libraryId));

          return rows.map((row) => ({
            path: row.path,
            audioStreams: z.array(AudioStreamSchema).parse(row.audioStreams),
            generation: row.generation,
            defaultAudioLanguage: row.defaultAudioLanguage,
          }));
        },
        trickplay: {
          intervalSeconds: TRICKPLAY_INTERVAL_SECONDS,
          tileWidth: TRICKPLAY_TILE_WIDTH,
          columns: TRICKPLAY_COLUMNS,
          rows: TRICKPLAY_ROWS,
        },
        transcoder,
        onProblem: (what, reason) => {
          process.stderr.write(`artefact cache: ${what}: ${reason}\n`);
        },
      });

      process.stdout.write(
        `artefact cache cleanup: removed ${swept.removed.toString()} directory(ies), freed ${swept.freedBytes.toString()} byte(s), kept ${swept.kept.toString()}, skipped ${swept.tooNew.toString()} as too new\n`,
      );
    },
    [PRUNE_HISTORY_JOB]: async () => {
      const forgotten = await historyService.prune(
        new Date(Date.now() - HISTORY_KEPT_FOR_DAYS * 86_400_000),
      );

      process.stdout.write(`history: forgot ${forgotten.toString()} old viewings\n`);
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

      catalogueWatch.record(reachable);
    },
    [CHECK_TRANSCODER_JOB]: async (jobId) => {
      jobs.reportProgress(jobId, 'checking', 0, 1);

      const reachable = await transcoder.isReachable();

      jobs.reportProgress(jobId, reachable ? 'reachable' : 'unreachable', 1, 1);

      transcoderWatch.record(reachable);
    },
    [PRUNE_WEBHOOK_DELIVERIES_JOB]: async () => {
      const forgotten = await webhookSubscriptions.pruneDeliveries(
        new Date(Date.now() - WEBHOOK_DELIVERIES_KEPT_FOR_DAYS * 86_400_000),
      );

      process.stdout.write(`webhooks: forgot ${forgotten.toString()} old deliveries\n`);
    },
    [DELIVER_WEBHOOK_JOB]: async (_jobId, payload) => {
      const parsed = DeliverWebhookJobSchema.safeParse(payload);

      if (!parsed.success) {
        process.stderr.write('job queue: a delivery job carried data Flux could not read.\n');

        return;
      }

      const delivered = await runWebhookDelivery({
        subscriptions: webhookSubscriptions,
        subscriptionId: parsed.data.subscriptionId,
        payload: parsed.data.payload,
      });

      if (!delivered) {
        throw new Error(`The delivery to ${parsed.data.subscriptionId} did not land.`);
      }
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
  onFinished: announceFinishedJob,
});

/**
 * Queues one delivery to one subscriber.
 *
 * Shared by the bus, which uses it for events the server raises, and by the
 * test button, which addresses a single subscription. Both put the same job
 * on the same queue; only who they are for differs.
 */
const queueWebhookDelivery = async (subscriptionId: string, payload: string): Promise<void> => {
  await jobs.enqueue(DELIVER_WEBHOOK_JOB, { subscriptionId, payload });
};

const events = createWebhookEventBus({
  subscriptions: webhookSubscriptions,
  enqueue: queueWebhookDelivery,
  onProblem: (reason) => {
    process.stderr.write(`events: ${reason}\n`);
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

const artworkUsage = createArtworkUsage({ directory: env.IMAGE_CACHE_DIR });

artworkUsage.watch();
void artworkUsage.refresh();

const playbackService = createPlaybackService({
  media: {
    findForPlayback: async (mediaId) => {
      const item = await libraryService.getMedia(mediaId);

      if (item === null) {
        return null;
      }

      const rows = await db
        .select({
          path: mediaItem.path,
          defaultAudioLanguage: library.defaultAudioLanguage,
          generation: library.generation,
        })
        .from(mediaItem)
        .innerJoin(library, eq(library.id, mediaItem.libraryId))
        .where(eq(mediaItem.id, mediaId))
        .limit(1);

      const row = rows[0];

      return row === undefined
        ? null
        : {
            item,
            path: row.path,
            defaultAudioLanguage: row.defaultAudioLanguage,
            generation: row.generation,
          };
    },
  },
  transcoder,
  sessionUrlPrefix: '/api/playback/session',
  directUrlPrefix: '/api/playback',
  trickplayUrlPrefix: '/api/playback/trickplay',
  forcedAccel: async () => (await settings.read()).hardwareAccel,
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
  history: historyService,
  webhooks: webhookSubscriptions,
  queueWebhookDelivery,
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
  permissions,
  banAccount: async (userId, reason) => {
    const [found] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);

    if (found === undefined) {
      return false;
    }

    await db.update(user).set({ banned: true, banReason: reason }).where(eq(user.id, userId));
    await db.delete(session).where(eq(session.userId, userId));

    return true;
  },
  unbanAccount: async (userId) => {
    const [found] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);

    if (found === undefined) {
      return false;
    }

    await db.update(user).set({ banned: false, banReason: null }).where(eq(user.id, userId));

    return true;
  },
  removeAccount: async (userId) => {
    const removed = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id });

    return removed.length > 0;
  },
  isAccountBanned: async (userId) => {
    const [found] = await db
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return found?.banned === true;
  },
  readBanReason: async (userId) => {
    const [found] = await db
      .select({ reason: user.banReason })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return found?.reason ?? null;
  },
  inviteAccount: async ({ name, email, password }) => {
    const created = await auth.api
      .signUpEmail({ body: { name, email, password }, asResponse: true })
      .catch(() => null);

    if (created === null || !created.ok) {
      return null;
    }

    const [found] = await db
      .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (found === undefined) {
      return null;
    }

    await giveDefaultRole(found.id);

    return { ...found, createdAt: found.createdAt.toISOString() };
  },
  editAccount: async (userId, changes) => {
    const [found] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);

    if (found === undefined) {
      return 'missing';
    }

    if (changes.email !== undefined) {
      const [taken] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, changes.email))
        .limit(1);

      if (taken !== undefined && taken.id !== userId) {
        return 'taken';
      }
    }

    await db.update(user).set(changes).where(eq(user.id, userId));

    return 'changed';
  },
  capabilities: () => transcoder.capabilities(),
  artworkUsage: () => artworkUsage.read(),
  libraryBytes: () => readLibraryBytes(),
  measureStorage: async () => {
    const [cache, artwork, bytes] = await Promise.all([
      transcoder.measureCache(),
      artworkUsage.refresh(),
      readLibraryBytes(),
    ]);

    return { cache, artwork, libraryBytes: bytes };
  },
  monitor: () => transcoder.readMonitor(),
  monitorStream: () => transcoder.openMonitorStream(),
  readImage: (url) => images.read(url),
  isTranscoderReachable: () => transcoder.isReachable(),
  transcoderAddress: env.TRANSCODER_URL,
  listRunningJobs: () => jobs.listRunning(),
  cancelJob: (jobId) => jobs.cancel(jobId),
  searchCatalogue: (query, kind) => catalogueProvider.search?.(query, kind) ?? Promise.resolve([]),
});

const seededRoles = await seedDefaultRoles({
  permissions,
  settings,
  accounts: async () =>
    (await db.select({ id: user.id, role: user.role }).from(user)).map((row) => ({
      id: row.id,
      role: row.role ?? null,
    })),
});

if (seededRoles.rolesCreated.length > 0) {
  process.stdout.write(`roles: created ${seededRoles.rolesCreated.join(', ')}\n`);
}

if (seededRoles.administratorsCarried > 0 || seededRoles.membersAssigned > 0) {
  process.stdout.write(
    `roles: carried ${seededRoles.administratorsCarried.toString()} administrator(s) and gave ${seededRoles.membersAssigned.toString()} account(s) the default role\n`,
  );
}

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
  process.stdout.write(`Media service dialled at ${env.TRANSCODER_URL}\n`);
});
