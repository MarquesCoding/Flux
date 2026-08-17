import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readdir, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { and, count, eq, gt, lt, lte, sql } from 'drizzle-orm';
import { createApp } from './App';
import { createRealtimeRegistry } from '@FluxServer/realtime/createRealtimeRegistry';
import { createRealtimeHandler } from '@FluxServer/realtime/createRealtimeHandler';
import { createRealtimeClock } from '@FluxServer/realtime/createRealtimeClock';
import { createEntitlements } from '@FluxServer/realtime/createEntitlements';
import { watchPermissionChanges } from '@FluxServer/realtime/watchPermissionChanges';
import { relayMonitor } from '@FluxServer/realtime/relayMonitor';
import { createPartyRegistry } from '@FluxServer/parties/createPartyRegistry';
import { createLogger } from '@FluxServer/logging/createLogger';
import { createDatabaseLogStore } from '@FluxServer/logging/createDatabaseLogStore';
import { asJsonLog } from '@FluxServer/logging/asJsonLog';
import { createLogScope } from '@FluxServer/logging/createLogScope';
import { createTranscoderIntake } from '@FluxServer/logging/createTranscoderIntake';
import { traceJobs } from '@FluxServer/logging/traceJobs';
import { createPresenceService } from '@FluxServer/presence/PresenceService';
import { readSessionOnce } from '@FluxServer/auth/readSessionOnce';
import { createAuth } from '@FluxServer/auth/Auth';
import type { RealtimeSession } from '@FluxServer/realtime/createRealtimeHandler';
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
import { runScanPhases } from '@FluxServer/library/runScanPhases';
import { createCatalogueMetadataProvider } from '@FluxServer/library/createCatalogueMetadataProvider';
import { createFilenameMetadataProvider } from '@FluxServer/library/createFilenameMetadataProvider';
import { createMediaFileSystem } from '@FluxServer/library/createMediaFileSystem';
import { createTranscoderClient } from '@FluxServer/transcoder/TranscoderClient';
import { createImageCache } from '@FluxServer/images/createImageCache';
import { createArtworkUsage } from '@FluxServer/images/createArtworkUsage';
import { detectLibrarySegments } from '@FluxServer/segments/detectLibrarySegments';
import { createDatabaseWatchProgressService } from '@FluxServer/progress/createDatabaseWatchProgressService';
import { createDatabaseFavouriteService } from '@FluxServer/favourites/createDatabaseFavouriteService';
import { createDatabaseRatingService } from '@FluxServer/ratings/createDatabaseRatingService';
import { createDatabaseShareService } from '@FluxServer/sharing/createDatabaseShareService';
import { createShareSessions } from '@FluxServer/sharing/createShareSessions';
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
  CHECK_DISK_SPACE_JOB,
  SEND_MEDIA_DIGEST_JOB,
  DELIVER_WEBHOOK_JOB,
  PRUNE_WEBHOOK_DELIVERIES_JOB,
  PRUNE_LOGS_JOB,
  DeliverWebhookJobSchema,
  scheduleTriggerKind,
} from '@FluxServer/jobs/JobQueue';
import { createDatabaseWebhookStore } from '@FluxServer/webhooks/createDatabaseWebhookStore';
import { createDatabaseNotificationStore } from '@FluxServer/notifications/createDatabaseNotificationStore';
import { notifyHousehold } from '@FluxServer/notifications/notifyHousehold';
import { summariseNewMedia } from '@FluxServer/notifications/summariseNewMedia';
import { readDigestWindow } from '@FluxServer/notifications/readDigestWindow';
import webPush from 'web-push';
import type { VapidKeys } from '@FluxServer/notifications/sendWebPush';
import { runWebhookDelivery } from '@FluxServer/webhooks/runWebhookDelivery';
import { createWebhookEventBus } from '@FluxServer/events/createWebhookEventBus';
import { createReachabilityWatch } from '@FluxServer/events/createReachabilityWatch';
import { createDiskPressureWatch } from '@FluxServer/events/createDiskPressureWatch';
import { MonitorDisksSchema } from '@FluxServer/maintenance/DiskUse';
import {
  findDisksUnderPressure,
  findMountFor,
} from '@FluxServer/maintenance/findDisksUnderPressure';
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
    pushPublicKey: '',
    pushPrivateKey: '',
    mediaDigestReadTo: null,
  },
});

const REALTIME_WINDOW_MS = 200;

const REALTIME_ENTITLEMENT_TTL_MS = 5000;

const REALTIME_HEARTBEAT_MS = 20000;

const MONITOR_RETRY_MS = 5000;

const LOG_WINDOW_MS = 250;

const LOG_BATCH_SIZE = 200;

const LOG_DEDUPE_WINDOW_MS = 60_000;

const HISTORY_KEPT_FOR_DAYS = 365;

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
    log.info('auth', `password reset for ${email}: ${url}`);

    return Promise.resolve();
  },
});

/**
 * Counts the accounts on this server, which is what first-run setup asks to decide whether the
 * server belongs to anybody yet.
 *
 * @returns How many accounts there are.
 */
const countUsers = async (): Promise<number> => {
  const rows = await db.select({ total: count() }).from(user);

  return rows[0]?.total ?? 0;
};

/**
 * How much disk the media itself takes, across every library. Reported beside what Flux has added to
 * it, since the useful question on the dashboard is which of the two is growing.
 */
const readLibraryBytes = async (): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${mediaItem.sizeBytes}), 0)::bigint` })
    .from(mediaItem);

  return Number(rows[0]?.total ?? 0);
};

/**
 * Makes an account an administrator, used by first-run setup for the account that claims a server
 * nobody owns yet.
 *
 * @param email - The account to promote.
 */
const promoteToAdmin = async (email: string): Promise<void> => {
  await db.update(user).set({ role: 'admin' }).where(eq(user.email, email));
};

const storedPermissions = createDatabasePermissionService(db);

const realtime = createRealtimeRegistry({
  entitlements: createEntitlements({
    resolve: (accountId) => storedPermissions.resolve(accountId),
    now: () => Date.now(),
    ttlMs: REALTIME_ENTITLEMENT_TTL_MS,
  }),
  now: () => Date.now(),
  schedule: createRealtimeClock(),
  windowMs: REALTIME_WINDOW_MS,
});

const logScope = createLogScope();

const logStore = createDatabaseLogStore(db);

const log = createLogger({
  store: logStore,
  now: () => Date.now(),
  newId: () => randomUUID(),
  schedule: createRealtimeClock(),
  writeLine: (line, level) => {
    if (level === 'error' || level === 'warn') {
      process.stderr.write(line);

      return;
    }

    process.stdout.write(line);
  },
  windowMs: LOG_WINDOW_MS,
  batchSize: LOG_BATCH_SIZE,
  dedupeWindowMs: LOG_DEDUPE_WINDOW_MS,
  ambient: () => logScope.current(),
  onRecord: (record) => {
    realtime.publish('logs', asJsonLog(record), { kind: 'everyone' });
  },
});

const presence = createPresenceService();

presence.watch(() => {
  realtime.publish('sessions', { changed: true }, { kind: 'everyone' });
});

const permissions = watchPermissionChanges(storedPermissions, {
  accountChanged: (userId) => {
    void realtime.recheck(userId);
  },
  everyoneChanged: () => {
    void realtime.recheckAll();
  },
});

/**
 * Gives a freshly created account the role new accounts are meant to have, so somebody who has just
 * signed up can do something rather than nothing until an administrator notices them.
 *
 * @param userId - The account that was just created.
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
 * Finds intros, outros and recaps across a library's already-scanned files by fingerprinting their
 * audio and looking for stretches every episode of a season shares. Runs against what has been
 * scanned rather than as part of a scan, since it compares episodes against each other and so needs
 * them all present.
 *
 * @param libraryId - The library to work through.
 * @param jobId - The job to report progress against.
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
      log.warn('scanner', `segments: ${provider}: ${reason}`);
    },
    onProgress: (processed, total) => {
      jobs.reportProgress(jobId, 'segments', processed, total);
    },
    isCancelled: () => jobs.isCancelled(jobId),
  });

  if (marked > 0) {
    log.info('scanner', `marked segments on ${marked.toString()} item(s)`);
  }
};

/**
 * Wraps a job that runs against one library so a single schedule can fire it against every library
 * there is. Which libraries those are is decided when it runs rather than when the schedule was set,
 * so a library added last week is included without anybody rescheduling anything.
 *
 * @param run - The work to do for one library.
 * @returns A handler that does it for all of them.
 */
const scheduleAcrossLibraries =
  (run: (libraryId: string) => Promise<{ jobId: string; state: string } | null>) =>
  async (): Promise<void> => {
    const libraries = await libraryService.list();

    await Promise.all(libraries.map((library) => run(library.id)));
  };

const libraryWork = createWorkLock();

const webhookSubscriptions = createDatabaseWebhookStore(db);
const notifications = createDatabaseNotificationStore(db);

/**
 * The identity push services check this server by, made on first need and then kept. Generated here
 * rather than configured, because the keys mean nothing outside this server and asking an operator
 * to make a key pair before they can be told about new films would be a poor trade.
 */
const readPushKeys = async (): Promise<VapidKeys> => {
  const held = await settings.read();

  if (held.pushPublicKey !== '' && held.pushPrivateKey !== '') {
    return { publicKey: held.pushPublicKey, privateKey: held.pushPrivateKey };
  }

  const made = webPush.generateVAPIDKeys();

  await settings.write({ pushPublicKey: made.publicKey, pushPrivateKey: made.privateKey });

  return { publicKey: made.publicKey, privateKey: made.privateKey };
};

const transcoderWatch = createReachabilityWatch({
  onLost: () => {
    log.warn('transcoder', 'transcoder: stopped answering');

    void events.publish({
      event: 'transcoder.unreachable',
      data: { reason: `${env.TRANSCODER_URL} did not answer a health check.` },
    });
  },
  onRegained: () => {
    log.info('transcoder', 'transcoder: answering again');

    void events.publish({ event: 'transcoder.reachable', data: {} });
  },
});

const diskWatch = createDiskPressureWatch({
  onLow: (disk) => {
    log.warn('server', `disk: ${disk.mountPoint} is running out of room`);

    void events.publish({ event: 'disk.low', data: disk });
  },
  onRecovered: (disk) => {
    log.info('server', `disk: ${disk.mountPoint} has room again`);

    void events.publish({ event: 'disk.recovered', data: disk });
  },
});

/**
 * Everywhere Flux writes: the library folders and the image cache. This is what the disk warnings are
 * measured against, since a filesystem filling up only matters where something is filling it.
 */
const pathsFluxWritesTo = async (): Promise<string[]> => [
  ...(await libraryService.list()).map((entry) => entry.path),
  env.IMAGE_CACHE_DIR,
];

const catalogueWatch = createReachabilityWatch({
  onLost: () => {
    void events.publish({ event: 'catalogue.unreachable', data: {} });
  },
  onRegained: () => {
    void events.publish({ event: 'catalogue.reachable', data: {} });
  },
});

/**
 * Announces a job that has ended, to whatever is subscribed — except the announcing job itself,
 * which would otherwise announce its own announcements for ever.
 *
 * @param outcome - Which job ended, what it was about, and whether it succeeded.
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
  handlers: traceJobs(
    {
      [SCAN_LIBRARY_JOB]: async (jobId, payload) => {
        const parsed = ScanLibraryJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a scan job carried data Flux could not read.');

          return;
        }

        const { libraryId, force } = parsed.data;

        await libraryWork.run(libraryId, async () => {
          const libraries = await libraryService.list();
          const scanned = libraries.find((entry) => entry.id === libraryId);
          const language = scanned?.defaultAudioLanguage;

          await runScanPhases({
            work: {
              scan: () => libraryService.runScan(libraryId, force, jobId),
              fetchLogos: () => libraryService.runFetchLogos(libraryId, jobId),
              regeneratePreviews: () =>
                libraryService.runRegeneratePreviews(libraryId, language ?? null, jobId),
              regenerateTrickplay: () => libraryService.runRegenerateTrickplay(libraryId, jobId),
              detectSegments: () => runDetectSegments(libraryId, jobId),
            },
            isCancelled: () => jobs.isCancelled(jobId),
            onScanned: async (result) => {
              jobs.reportProgress(
                jobId,
                `added ${result.added.toString()}, updated ${result.updated.toString()}, removed ${result.removed.toString()}`,
                1,
                1,
              );

              await events.publish({
                event: 'library.scanned',
                data: { libraryId, libraryName: scanned?.name ?? 'A library', ...result },
              });
            },
          });
        });
      },
      [READ_AGAIN_JOB]: async (jobId, payload) => {
        const parsed = ReadAgainJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a re-read job carried data Flux could not read.');

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
          log.error(
            'jobs',
            'job queue: a preview regeneration job carried data Flux could not read.',
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
          log.error('jobs', 'job queue: a trickplay job carried data Flux could not read.');

          return;
        }

        await libraryWork.run(parsed.data.libraryId, () =>
          libraryService.runRegenerateTrickplay(parsed.data.libraryId, jobId),
        );
      },
      [FETCH_LOGOS_JOB]: async (jobId, payload) => {
        const parsed = FetchLogosJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a logo job carried data Flux could not read.');

          return;
        }

        await libraryWork.run(parsed.data.libraryId, () =>
          libraryService.runFetchLogos(parsed.data.libraryId, jobId),
        );
      },
      [DETECT_SEGMENTS_JOB]: async (jobId, payload) => {
        const parsed = DetectSegmentsJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a segment detection job carried data Flux could not read.');

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
            const rows = await db
              .select({ photoPath: viewerProfile.photoPath })
              .from(viewerProfile);

            return rows.map((row) => row.photoPath);
          },
          onProblem: (path, reason) => {
            log.error('server', `image cache: ${path}: ${reason}`);
          },
          onProgress: (phase, processed, total) => {
            jobs.reportProgress(jobId, phase, processed, total);
          },
        });

        log.info('server', `image cache cleanup: removed ${removed.toString()} file(s)`);
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
            log.error('server', `artefact cache: ${what}: ${reason}`);
          },
        });

        log.info(
          'server',
          `artefact cache cleanup: removed ${swept.removed.toString()} directory(ies), freed ${swept.freedBytes.toString()} byte(s), kept ${swept.kept.toString()}, skipped ${swept.tooNew.toString()} as too new`,
        );
      },
      [PRUNE_HISTORY_JOB]: async () => {
        const forgotten = await historyService.prune(
          new Date(Date.now() - HISTORY_KEPT_FOR_DAYS * 86_400_000),
        );

        log.info('server', `history: forgot ${forgotten.toString()} old viewings`);
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

        log.info('server', `session cleanup: removed ${removed.toString()} row(s)`);
      },
      [CHECK_CATALOGUE_CONNECTIVITY_JOB]: async (jobId) => {
        jobs.reportProgress(jobId, 'checking', 0, 1);

        const reachable = await checkCatalogueConnectivity({
          readApiKey: async () => (await settings.read()).catalogueApiKey,
        });

        jobs.reportProgress(jobId, reachable ? 'reachable' : 'unreachable', 1, 1);
        log.info('catalogue', `catalogue connectivity: ${reachable ? 'reachable' : 'unreachable'}`);

        catalogueWatch.record(reachable);
      },
      [CHECK_TRANSCODER_JOB]: async (jobId) => {
        jobs.reportProgress(jobId, 'checking', 0, 1);

        const reachable = await transcoder.isReachable();

        jobs.reportProgress(jobId, reachable ? 'reachable' : 'unreachable', 1, 1);

        transcoderWatch.record(reachable);
      },
      [CHECK_DISK_SPACE_JOB]: async (jobId) => {
        jobs.reportProgress(jobId, 'reading', 0, 1);

        const reading = MonitorDisksSchema.safeParse(await transcoder.readMonitor());

        if (!reading.success) {
          log.warn('server', 'disk: the monitor did not say what the filesystems hold');

          return;
        }

        const { disks } = reading.data.resources;
        const paths = await pathsFluxWritesTo();
        const mounts = [...new Set(paths.flatMap((path) => findMountFor(path, disks) ?? []))];

        diskWatch.record(mounts, findDisksUnderPressure(paths, disks));

        jobs.reportProgress(jobId, `${mounts.length.toString()} checked`, 1, 1);
      },
      [SEND_MEDIA_DIGEST_JOB]: async (jobId) => {
        jobs.reportProgress(jobId, 'reading', 0, 1);

        const now = new Date();
        const { since, announce } = readDigestWindow(
          (await settings.read()).mediaDigestReadTo,
          now,
        );

        await settings.write({ mediaDigestReadTo: now.toISOString() });

        if (!announce) {
          log.info('server', 'digest: first run, noting where to read from next time');

          return;
        }

        const arrived = await db
          .select({
            id: mediaItem.id,
            title: mediaItem.title,
            seriesId: mediaItem.seriesId,
            seriesTitle: mediaItem.seriesTitle,
          })
          .from(mediaItem)
          .where(and(gt(mediaItem.addedAt, since), lte(mediaItem.addedAt, now)));

        const summary = summariseNewMedia(arrived);

        jobs.reportProgress(jobId, `${arrived.length.toString()} arrived`, 1, 1);

        if (summary === null) {
          return;
        }

        await notifyHousehold({
          store: notifications,
          event: 'media.added',
          title: summary.title,
          body: summary.body,
          link: summary.link,
          vapid: await readPushKeys(),
          onProblem: (reason) => {
            log.error('server', `digest: ${reason}`);
          },
          announce: (userIds) => {
            realtime.publish(
              'notifications',
              { event: 'media.added' },
              { kind: 'accounts', accountIds: [...userIds] },
            );
          },
        });

        realtime.publish('media', { added: arrived.length }, { kind: 'everyone' });
      },
      [PRUNE_WEBHOOK_DELIVERIES_JOB]: async () => {
        const forgotten = await webhookSubscriptions.pruneDeliveries(
          new Date(Date.now() - WEBHOOK_DELIVERIES_KEPT_FOR_DAYS * 86_400_000),
        );

        log.info('server', `webhooks: forgot ${forgotten.toString()} old deliveries`);
      },
      [PRUNE_LOGS_JOB]: async () => {
        await log.flush();

        const forgotten = await logStore.forgetExpired(Date.now());

        log.info('server', `logs: forgot ${forgotten.toString()} old records`);
      },
      [DELIVER_WEBHOOK_JOB]: async (_jobId, payload) => {
        const parsed = DeliverWebhookJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a delivery job carried data Flux could not read.');

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
    logScope,
  ),
  onProblem: (message) => {
    log.error('jobs', `job queue: ${message}`);
  },
  onFinished: announceFinishedJob,
});

/**
 * Queues one webhook delivery to one subscriber. Queued rather than sent inline so a slow or
 * unreachable subscriber delays nothing, and so a failed delivery can be retried on its own.
 *
 * @param subscriptionId - Who is being delivered to.
 * @param payload - The event to deliver.
 */
const queueWebhookDelivery = async (subscriptionId: string, payload: string): Promise<void> => {
  await jobs.enqueue(DELIVER_WEBHOOK_JOB, { subscriptionId, payload });
};

const events = createWebhookEventBus({
  subscriptions: webhookSubscriptions,
  enqueue: queueWebhookDelivery,
  onProblem: (reason) => {
    log.error('server', `events: ${reason}`);
  },
});

const maintenance = createDatabaseMaintenanceService({ jobs });
const schedules = createJobScheduleService({ store: createDatabaseJobTriggerStore(db), jobs });

const catalogueProvider = createCatalogueMetadataProvider({
  readApiKey: async () => (await settings.read()).catalogueApiKey,
  onProblem: (reason) => {
    log.error('catalogue', `catalogue: ${reason}`);
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
    log.warn('scanner', `skipped ${path}: ${reason}`);
  },
});

/**
 * Finds where an item's file is on disk, which is what the subtitle services need before they can
 * look beside it or inside it.
 *
 * @param mediaId - The item.
 * @returns Its path, or null where the catalogue has no such item.
 */
const findMediaPath = async (mediaId: string): Promise<string | null> => {
  const rows = await db
    .select({ path: mediaItem.path })
    .from(mediaItem)
    .where(eq(mediaItem.id, mediaId))
    .limit(1);

  return rows[0]?.path ?? null;
};

/**
 * Reports a subtitle that could not be read, without failing the request that found it. A file with
 * a broken subtitle track should still play; the operator is told, and the viewer is not.
 *
 * @param path - The file the problem was in.
 * @param reason - What went wrong.
 */
const reportSubtitleProblem = (path: string, reason: string): void => {
  log.warn('scanner', `subtitles: ${path}: ${reason}`);
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
      log.warn('scanner', `segments ${path}: ${reason}`);
    },
  }),
];

const images = createImageCache({
  directory: env.IMAGE_CACHE_DIR,
  onProblem: (url, reason) => {
    log.warn('scanner', `artwork ${url}: ${reason}`);
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
  realtime,
  logs: logStore,
  presence,
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
  notifications,
  readPushPublicKey: async () => (await readPushKeys()).publicKey,
  favourites: createDatabaseFavouriteService(db),
  ratings: createDatabaseRatingService(db),
  shares: createDatabaseShareService(db),
  shareSessions: createShareSessions(),
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
  log.info('server', `roles: created ${seededRoles.rolesCreated.join(', ')}`);
}

if (seededRoles.administratorsCarried > 0 || seededRoles.membersAssigned > 0) {
  log.info(
    'server',
    `roles: carried ${seededRoles.administratorsCarried.toString()} administrator(s) and gave ${seededRoles.membersAssigned.toString()} account(s) the default role`,
  );
}

const seededKinds = await seedDefaultJobTriggers({ schedules, settings });

if (seededKinds.length > 0) {
  log.info('server', `schedule: default triggers set for ${seededKinds.join(', ')}`);
}

for (const kind of await schedules.sync()) {
  await jobs.enqueue(scheduleQueueNameFor(kind), {});
  log.info('server', `schedule: running ${kind} on startup`);
}

const parties = createPartyRegistry(() => randomUUID());

const realtimeHandler = createRealtimeHandler({
  registry: realtime,
  newId: () => randomUUID(),
  now: () => Date.now(),
  party: {
    registry: parties,
    tell: (connectionIds, payload) => {
      realtime.publish('party', payload, {
        kind: 'connections',
        connectionIds: [...connectionIds],
      });
    },
    ask: ({ party, byName, profileId }) => {
      void askSomebodyToTheParty(party, byName, profileId);
    },
  },
  presence: {
    connect: (clientId, profileId, profileName, deviceLabel, send) => {
      presence.connect(clientId, profileId, profileName, deviceLabel, send);
    },
    disconnect: (clientId) => {
      presence.disconnect(clientId);
    },
    nameOf: async (accountId, profileId) => {
      const named =
        profileId === null
          ? null
          : ((await profileService.list(accountId)).find((profile) => profile.id === profileId)
              ?.name ?? null);

      if (named !== null) {
        return named;
      }

      const [account] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, accountId))
        .limit(1);

      return account?.name ?? null;
    },
  },
});

/**
 * Asks somebody to a watch party, in whatever way they asked to be told things.
 *
 * The notification carries the same address the party's own invitation does, which holds no
 * credential of its own: being asked is not being let in, and whoever opens it still has to be
 * allowed to watch the thing.
 *
 * @param party - The party they are being asked to.
 * @param byName - Who is asking.
 * @param profileId - Which face they picked, since that is what a viewer chooses between.
 */
const askSomebodyToTheParty = async (
  party: { id: string; mediaId: string },
  byName: string,
  profileId: string,
): Promise<void> => {
  const accountId = await profileService.accountOf(profileId);

  if (accountId === null) {
    return;
  }

  const [found] = await db
    .select({ title: mediaItem.title })
    .from(mediaItem)
    .where(eq(mediaItem.id, party.mediaId))
    .limit(1);

  await notifyHousehold({
    store: notifications,
    event: 'party.invited',
    title: `${byName} wants to watch with you`,
    body:
      found === undefined
        ? 'They have a watch party running.'
        : `They are watching ${found.title}.`,
    link: `/watch/${party.mediaId}?party=${party.id}`,
    vapid: await readPushKeys(),
    only: [accountId],
    onProblem: (reason) => {
      log.error('server', `party invite: ${reason}`);
    },
    announce: (userIds) => {
      realtime.publish(
        'notifications',
        { event: 'party.invited' },
        { kind: 'accounts', accountIds: [...userIds] },
      );
    },
  });
};

const transcoderIntake = createTranscoderIntake(log);

void relayMonitor({
  open: () => transcoder.openMonitorStream(),
  publish: (report) => {
    realtime.publish('monitor', report, { kind: 'everyone' });
    transcoderIntake.take(report);
  },
  wait: (afterMs) => new Promise((resolve) => setTimeout(resolve, afterMs)),
  retryMs: MONITOR_RETRY_MS,
  keepGoing: () => true,
});

const nodeWebSocket = createNodeWebSocket({ app });

app.get(
  '/api/realtime',
  nodeWebSocket.upgradeWebSocket(async (context) => {
    const account = (await readSessionOnce(auth, context.req.raw.headers))?.user ?? null;

    if (account === null) {
      return {};
    }

    const accountId = account.id;
    let session: RealtimeSession | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    return {
      onOpen: (_event, socket) => {
        session = realtimeHandler.open(
          { accountId, profileId: null },
          {
            send: (raw) => {
              socket.send(raw);
            },
          },
        );

        heartbeat = setInterval(() => {
          session?.ping();
        }, REALTIME_HEARTBEAT_MS);
      },

      onMessage: (event: { data: string | ArrayBuffer | Uint8Array }) => {
        if (typeof event.data === 'string') {
          void session?.receive(event.data);
        }
      },

      onClose: () => {
        if (heartbeat !== null) {
          clearInterval(heartbeat);
        }

        session?.close();
      },
    };
  }),
);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  const origin = `http://localhost:${info.port.toString()}`;

  log.info('server', `Flux listening on ${origin}`);

  if (persisted.setupCompletedAt === null) {
    log.info('server', `First-run setup at ${origin}`);
  }

  log.info('server', `API reference at ${origin}/api/reference`);
  log.info('server', `Media service dialled at ${env.TRANSCODER_URL}`);
});

nodeWebSocket.injectWebSocket(server);
