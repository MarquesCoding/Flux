import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { and, count, eq, gt, isNull, lt, lte, sql } from 'drizzle-orm';
import { createApp } from './App';
import { createRealtimeRegistry } from '@ValenceServer/realtime/createRealtimeRegistry';
import { createRealtimeHandler } from '@ValenceServer/realtime/createRealtimeHandler';
import { createRealtimeClock } from '@ValenceServer/realtime/createRealtimeClock';
import { createEntitlements } from '@ValenceServer/realtime/createEntitlements';
import { watchPermissionChanges } from '@ValenceServer/realtime/watchPermissionChanges';
import { relayMonitor } from '@ValenceServer/realtime/relayMonitor';
import { createPartyRegistry } from '@ValenceServer/parties/createPartyRegistry';
import { createLogger } from '@ValenceServer/logging/createLogger';
import { createDatabaseLogStore } from '@ValenceServer/logging/createDatabaseLogStore';
import { asJsonLog } from '@ValenceServer/logging/asJsonLog';
import { createLogScope } from '@ValenceServer/logging/createLogScope';
import { createTranscoderIntake } from '@ValenceServer/logging/createTranscoderIntake';
import { withApiMemory } from '@ValenceServer/monitor/withApiMemory';
import { createJobHealthWatch } from '@ValenceServer/jobs/createJobHealthWatch';
import { labelForQueue } from '@ValenceServer/jobs/labelForQueue';
import { announcesCompletion } from '@ValenceServer/jobs/announcesCompletion';
import { traceJobs } from '@ValenceServer/logging/traceJobs';
import { createPresenceService } from '@ValenceServer/presence/PresenceService';
import { readSessionOnce } from '@ValenceServer/auth/readSessionOnce';
import { createAuth } from '@ValenceServer/auth/Auth';
import { trustedOriginsFor } from '@ValenceServer/auth/trustedOriginsFor';
import type { RealtimeSession } from '@ValenceServer/realtime/createRealtimeHandler';
import { createDatabase } from '@ValenceServer/db/Database';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { findPendingMigrations } from '@ValenceServer/db/findPendingMigrations';
import { migrateToLatest } from '@ValenceServer/db/migrateToLatest';
import {
  user,
  library,
  mediaItem,
  mediaItemJob,
  userProfile,
  viewerProfile,
  session,
  deviceCode,
} from '@ValenceServer/db/Schema';
import { readEnv } from '@ValenceServer/env/Env';
import { createDatabaseSettingsStore } from '@ValenceServer/settings/createDatabaseSettingsStore';
import { createDatabaseLibraryService } from '@ValenceServer/library/createDatabaseLibraryService';
import { mediaKindOf } from '@ValenceServer/library/mediaKindOf';
import { describeQuality } from '@ValenceServer/library/describeQuality';
import { describeSignInAttempt } from '@ValenceServer/auth/describeSignInAttempt';
import { ARRIVED_TITLES_KEPT } from '@ValenceContracts/schemas/Webhook';
import type { ScannedItem } from '@ValenceServer/library/scanLibrary';
import type { PresenceViewing } from '@ValenceServer/presence/PresenceService';
import type { WebhookPayload } from '@ValenceContracts/schemas/Webhook';

type ViewingData = Extract<WebhookPayload, { event: 'playback.started' }>['data'];
import { runScanPhases } from '@ValenceServer/library/runScanPhases';
import { createCatalogueMetadataProvider } from '@ValenceServer/library/createCatalogueMetadataProvider';
import { createFilenameMetadataProvider } from '@ValenceServer/library/createFilenameMetadataProvider';
import { createMediaFileSystem } from '@ValenceServer/library/createMediaFileSystem';
import { createTranscoderClient } from '@ValenceServer/transcoder/TranscoderClient';
import { createImageCache } from '@ValenceServer/images/createImageCache';
import { createArtworkUsage } from '@ValenceServer/images/createArtworkUsage';
import { detectLibrarySegments } from '@ValenceServer/segments/detectLibrarySegments';
import { createDatabaseWatchProgressService } from '@ValenceServer/progress/createDatabaseWatchProgressService';
import { createDatabaseFavouriteService } from '@ValenceServer/favourites/createDatabaseFavouriteService';
import { createDatabaseRatingService } from '@ValenceServer/ratings/createDatabaseRatingService';
import { createDatabaseShareService } from '@ValenceServer/sharing/createDatabaseShareService';
import { createShareSessions } from '@ValenceServer/sharing/createShareSessions';
import { createDatabaseSegmentService } from '@ValenceServer/segments/createDatabaseSegmentService';
import { createFingerprintSegmentProvider } from '@ValenceServer/segments/createFingerprintSegmentProvider';
import { createSidecarSubtitleService } from '@ValenceServer/subtitles/createSidecarSubtitleService';
import { createDatabaseProfileService } from '@ValenceServer/profiles/createDatabaseProfileService';
import { createDatabaseBookService } from '@ValenceServer/books/createDatabaseBookService';
import { ViewerProfileSchema } from '@ValenceContracts/schemas/ViewerProfile';
import { createEmbeddedSubtitleService } from '@ValenceServer/subtitles/createEmbeddedSubtitleService';
import { createLayeredSubtitleService } from '@ValenceServer/subtitles/createLayeredSubtitleService';
import { createPlaybackService } from '@ValenceServer/playback/createPlaybackService';
import { createJobQueue } from '@ValenceServer/jobs/createJobQueue';
import type { FinishedJob } from '@ValenceServer/jobs/createJobQueue';
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
} from '@ValenceServer/jobs/JobQueue';
import { createDatabaseWebhookStore } from '@ValenceServer/webhooks/createDatabaseWebhookStore';
import { createDatabaseNotificationStore } from '@ValenceServer/notifications/createDatabaseNotificationStore';
import { notifyHousehold } from '@ValenceServer/notifications/notifyHousehold';
import { summariseNewMedia } from '@ValenceServer/notifications/summariseNewMedia';
import { readDigestWindow } from '@ValenceServer/notifications/readDigestWindow';
import webPush from 'web-push';
import type { VapidKeys } from '@ValenceServer/notifications/sendWebPush';
import { runWebhookDelivery } from '@ValenceServer/webhooks/runWebhookDelivery';
import { createWebhookEventBus } from '@ValenceServer/events/createWebhookEventBus';
import { collectScanRuns } from '@ValenceServer/events/collectScanRuns';
import { createReachabilityWatch } from '@ValenceServer/events/createReachabilityWatch';
import { createDiskPressureWatch } from '@ValenceServer/events/createDiskPressureWatch';
import { MonitorDisksSchema } from '@ValenceServer/maintenance/DiskUse';
import {
  findDisksUnderPressure,
  findMountFor,
} from '@ValenceServer/maintenance/findDisksUnderPressure';
import { createDatabaseMaintenanceService } from '@ValenceServer/maintenance/createDatabaseMaintenanceService';
import { cleanupImageCache } from '@ValenceServer/maintenance/cleanupImageCache';
import { sweepArtefactCache } from '@ValenceServer/maintenance/sweepArtefactCache';
import { AudioStreamSchema } from '@ValenceContracts/schemas/MediaItem';
import {
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} from '@ValenceServer/playback/PlaybackService';
import { cleanupSessions } from '@ValenceServer/maintenance/cleanupSessions';
import { checkCatalogueConnectivity } from '@ValenceServer/maintenance/checkCatalogueConnectivity';
import { RESET_LIBRARY_JOB, scheduleQueueNameFor } from '@ValenceServer/jobs/jobDefinitions';
import { createJobScheduleService } from '@ValenceServer/jobs/createJobScheduleService';
import { resolveJobsTimezone } from '@ValenceServer/jobs/resolveJobsTimezone';
import { createDatabaseJobTriggerStore } from '@ValenceServer/jobs/createDatabaseJobTriggerStore';
import { markJobComplete } from '@ValenceServer/library/createMediaStore';
import { createWorkLock } from '@ValenceServer/jobs/createWorkLock';
import { seedDefaultJobTriggers } from '@ValenceServer/jobs/seedDefaultJobTriggers';
import { seedDefaultRoles } from '@ValenceServer/auth/seedDefaultRoles';
import { ADMINISTRATOR_ROLE_NAME, DEFAULT_ROLE_NAME } from '@ValenceCore/functions/defaultRoles';
import { createDatabaseHistoryService } from '@ValenceServer/history/createDatabaseHistoryService';
import { createDatabaseSignInStore } from '@ValenceServer/accounts/createDatabaseSignInStore';
import { recordSignIn } from '@ValenceServer/accounts/recordSignIn';
import { createDatabasePermissionService } from '@ValenceServer/auth/createDatabasePermissionService';
import { createDownloadService } from '@ValenceServer/downloads/createDownloadService';
import { keepingProfile } from '@ValenceServer/downloads/keepingProfile';
const ChapterListSchema = z.array(
  z.object({
    title: z.string().nullable(),
    startSeconds: z.number(),
    endSeconds: z.number(),
  }),
);
const env = readEnv(process.env);
const { db, schema } = createDatabase(env.DATABASE_URL);

const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', 'drizzle');

const MIGRATION_JOURNAL = join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

const AppliedMigrationSchema = z.object({ created_at: z.union([z.string(), z.number()]) });

/**
 * The stamps of the migrations this database has run, or none where it has never run any.
 *
 * A database nobody has migrated has no ledger table to read, which is not a fault — it is what
 * every first start looks like. Drizzle creates it as part of applying the first migration.
 *
 * @returns The stamps.
 */
const readAppliedStamps = async (): Promise<number[]> => {
  try {
    const applied = await db.execute(sql`select created_at from drizzle.__drizzle_migrations`);

    return applied.rows.map((row) => Number(AppliedMigrationSchema.parse(row).created_at));
  } catch {
    return [];
  }
};

await migrateToLatest({
  pending: () =>
    findPendingMigrations({
      readJournal: () => readFile(MIGRATION_JOURNAL, 'utf8'),
      readAppliedAt: readAppliedStamps,
    }),
  apply: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
  isAllowed: env.MIGRATE_ON_START,
  say: (_level, line) => {
    process.stdout.write(`${line}\n`);
  },
});

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
    jobsTimezone: '',
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

    const [made] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    void events.publish({
      event: 'account.created',
      data: { accountId: userId, name: made?.name ?? 'Somebody' },
    });
  },
  onSignInSettled: (attempt) => {
    const occurrence = describeSignInAttempt(attempt);

    if (occurrence !== null) {
      void events.publish(occurrence);
    }
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
 * How much disk the media itself takes, across every library. Reported beside what Valence has added to
 * it, since the useful question on the dashboard is which of the two is growing.
 */
const readLibraryBytes = async (): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${mediaItem.sizeBytes}), 0)::bigint` })
    .from(mediaItem);

  return Number(rows[0]?.total ?? 0);
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

/**
 * Fills out what a viewing was of, which presence does not hold.
 *
 * Presence knows who is connected and which item they asked for; the poster, the library it sits in
 * and what kind of thing it is all live in the catalogue. Reading them here keeps presence an
 * in-memory view of connections rather than a second, staler copy of the library.
 *
 * @param viewing - Who is watching what, as presence saw it.
 * @returns The viewing as a subscriber reads it, or nothing where the item has since gone.
 */
const describeViewing = async (viewing: PresenceViewing): Promise<ViewingData | null> => {
  const item = await libraryService.getMedia(viewing.mediaId);

  if (item === null) {
    return null;
  }

  const shelf = (await libraryService.list()).find((one) => one.id === item.libraryId);
  const named =
    viewing.accountId === null
      ? []
      : await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, viewing.accountId))
          .limit(1);

  return {
    accountId: viewing.accountId,
    accountName: named[0]?.name ?? null,
    profileId: viewing.profileId,
    profileName: viewing.profileName,
    item: {
      itemId: item.id,
      kind: mediaKindOf(
        { seriesTitle: item.metadata.seriesTitle ?? null },
        shelf?.kind ?? 'movies',
      ),
      title: item.title,
      seriesTitle: item.metadata.seriesTitle ?? null,
      seasonNumber: item.metadata.seasonNumber ?? null,
      episodeNumber: item.metadata.episodeNumber ?? null,
      year: item.year ?? null,
      posterUrl: await libraryService.readArtworkUrl(viewing.mediaId, 'poster'),
      libraryId: item.libraryId,
      libraryName: shelf?.name ?? 'A library',
      overview: item.metadata.overview ?? null,
      durationSeconds: item.durationSeconds,
      genres: item.metadata.genres ?? [],
      rating: item.metadata.rating ?? null,
      quality: describeQuality(item.width, item.height, item.videoRange),
    },
    deviceLabel: viewing.deviceLabel,
    mode: viewing.mode,
  };
};

const presence = createPresenceService({
  onPlaybackStarted: (viewing) => {
    void describeViewing(viewing).then((described) => {
      if (described !== null) {
        void events.publish({ event: 'playback.started', data: described });
      }
    });
  },
  onPlaybackStopped: (viewing) => {
    void describeViewing(viewing).then((described) => {
      if (described !== null) {
        void events.publish({
          event: 'playback.stopped',
          data: {
            ...described,
            positionSeconds: viewing.positionSeconds,
            durationSeconds: viewing.durationSeconds,
          },
        });
      }
    });
  },
});

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

/**
 * Makes an account an administrator, used by first-run setup for the account that claims a server
 * nobody owns yet.
 *
 * Both halves of it, because two different things are read. The mark on the account is what the
 * screens ask about; the role is what every permission check in this server resolves against. An
 * account given one and not the other is an administrator in the chrome and a stranger to the API,
 * and that is how first-run setup left the only account on a new instance.
 *
 * Found without regard to case. What somebody typed into the setup form is not what is stored —
 * better-auth folds an address before it keeps it — so an email with a capital in it matched nothing
 * here, silently, and setup finished by reporting success and promoting nobody.
 *
 * @param email - The account to promote.
 */
const promoteToAdmin = async (email: string): Promise<void> => {
  const promoted = await db
    .update(user)
    .set({ role: 'admin' })
    .where(sql`lower(${user.email}) = lower(${email})`)
    .returning({ id: user.id });

  if (promoted.length === 0) {
    log.warn('auth', `no account at ${email} to make an administrator`);

    return;
  }

  const administrator = (await permissions.listRoles()).find(
    (role) => role.name === ADMINISTRATOR_ROLE_NAME,
  );

  if (administrator === undefined) {
    log.warn('auth', 'there is no Administrator role to give');

    return;
  }

  for (const account of promoted) {
    await permissions.assignRole(account.id, administrator.id);
  }
};
const profileService = createDatabaseProfileService(db, join(env.IMAGE_CACHE_DIR, 'profiles'));

const bookService = createDatabaseBookService(db, env.IMAGE_CACHE_DIR);

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
    owner: jobId,
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

let openDeliveries: ((subscriptionId: string, payload: string) => Promise<void>) | null = null;

const events = createWebhookEventBus({
  subscriptions: webhookSubscriptions,
  enqueue: async (subscriptionId, payload) => {
    if (openDeliveries === null) {
      throw new Error('the delivery queue was not open yet');
    }

    await openDeliveries(subscriptionId, payload);
  },
  onProblem: (reason) => {
    log.error('server', `events: ${reason}`);
  },
});
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
 * Everywhere Valence writes: the library folders and the image cache. This is what the disk warnings are
 * measured against, since a filesystem filling up only matters where something is filling it.
 */
const pathsValenceWritesTo = async (): Promise<string[]> => [
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

const jobHealth = createJobHealthWatch({
  onStalled: ({ kind, failures, everSucceeded, reason }) => {
    const label = labelForQueue(kind);

    log.error(
      'jobs',
      everSucceeded
        ? `${label} has failed every time it has run since it last worked — ${failures.toString()} attempts, most recently: ${reason}`
        : `${label} has never once succeeded — ${failures.toString()} attempts, most recently: ${reason}`,
    );

    void events.publish({
      event: 'job.stalled',
      data: { kind, label, failures, everSucceeded, reason },
    });
  },
  onWorking: (kind) => {
    const label = labelForQueue(kind);

    log.info('jobs', `${label} has run without failing.`);

    void events.publish({ event: 'job.working', data: { kind, label } });
  },
});

const SCHEDULE_TRIGGER_SUFFIX = '.scheduled';

/**
 * Names the library a job was about, so that a delivery says "Movies" rather than the identifier the
 * queue happens to carry. A subject that is not a library, or one that has since been deleted, has
 * no name and is reported as none rather than as a bare identifier.
 *
 * @param subject - What the job was about, as the queue recorded it.
 * @returns The library's name, or nothing.
 */
const nameOfLibrary = async (subject: string | null): Promise<string | null> =>
  subject === null
    ? null
    : ((await libraryService.list()).find((one) => one.id === subject)?.name ?? null);

/**
 * Announces a job that has ended, to whatever is subscribed.
 *
 * Says nothing about the job that does the announcing, which would announce its own announcements
 * for ever, and nothing about a schedule's trigger, which exists only to enqueue the real work and
 * would otherwise report every scan twice. Nor about anything finishing that `announcesCompletion`
 * judges not worth saying — though anything failing is still announced, whatever it is.
 *
 * @param finished - Which job ended, what it was about, and whether it succeeded.
 */
const announceFinishedJob = (finished: FinishedJob): void => {
  const { kind, jobId, subject, reason } = finished;

  if (kind === DELIVER_WEBHOOK_JOB) {
    return;
  }

  jobHealth.record(finished);

  if (kind.endsWith(SCHEDULE_TRIGGER_SUFFIX)) {
    return;
  }

  if (reason === null && !announcesCompletion(kind)) {
    return;
  }

  void (async () => {
    const about = {
      kind,
      label: labelForQueue(kind),
      jobId,
      subject,
      subjectName: await nameOfLibrary(subject),
    };

    await events.publish(
      reason === null
        ? { event: 'job.completed', data: about }
        : { event: 'job.failed', data: { ...about, reason } },
    );
  })();
};

const jobs = await createJobQueue({
  connectionString: env.DATABASE_URL,
  handlers: traceJobs(
    {
      [SCAN_LIBRARY_JOB]: async (jobId, payload) => {
        const parsed = ScanLibraryJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a scan job carried data Valence could not read.');

          return;
        }

        const { libraryId, force, runId, runOf } = parsed.data;

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

              const libraryName = scanned?.name ?? 'A library';
              const libraryKind = scanned?.kind ?? 'movies';
              const arrived = arrivals.get(libraryId) ?? [];
              const departed = departures.get(libraryId) ?? [];

              arrivals.delete(libraryId);
              departures.delete(libraryId);

              const named = (item: ScannedItem) => ({
                ...item,
                kind: mediaKindOf(item, libraryKind),
                libraryId,
                libraryName,
              });

              scanRuns.record(runId ?? `${LONE_SCAN}:${jobId}`, runOf ?? 1, {
                libraryId,
                libraryName,
                ...result,
                arrived: arrived.slice(0, ARRIVED_TITLES_KEPT).map((item) => item.title),
                arrivedNotListed: Math.max(arrived.length - ARRIVED_TITLES_KEPT, 0),
              });

              for (const item of arrived) {
                await events.publish({ event: 'media.added', data: named(item) });
              }

              for (const item of departed) {
                await events.publish({ event: 'media.removed', data: named(item) });
              }
            },
          });
        });
      },
      [READ_AGAIN_JOB]: async (jobId, payload) => {
        const parsed = ReadAgainJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a re-read job carried data Valence could not read.');

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
            'job queue: a preview regeneration job carried data Valence could not read.',
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
          log.error('jobs', 'job queue: a trickplay job carried data Valence could not read.');

          return;
        }

        await libraryWork.run(parsed.data.libraryId, () =>
          libraryService.runRegenerateTrickplay(parsed.data.libraryId, jobId),
        );
      },
      [FETCH_LOGOS_JOB]: async (jobId, payload) => {
        const parsed = FetchLogosJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error('jobs', 'job queue: a logo job carried data Valence could not read.');

          return;
        }

        await libraryWork.run(parsed.data.libraryId, () =>
          libraryService.runFetchLogos(parsed.data.libraryId, jobId),
        );
      },
      [DETECT_SEGMENTS_JOB]: async (jobId, payload) => {
        const parsed = DetectSegmentsJobSchema.safeParse(payload);

        if (!parsed.success) {
          log.error(
            'jobs',
            'job queue: a segment detection job carried data Valence could not read.',
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
        const paths = await pathsValenceWritesTo();
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
          .where(
            and(
              gt(mediaItem.addedAt, since),
              lte(mediaItem.addedAt, now),
              isNull(mediaItem.extraKind),
            ),
          );

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
          log.error('jobs', 'job queue: a delivery job carried data Valence could not read.');

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

openDeliveries = queueWebhookDelivery;

const maintenance = createDatabaseMaintenanceService({ jobs });
const schedules = createJobScheduleService({
  store: createDatabaseJobTriggerStore(db),
  jobs,
  readTimezone: async () =>
    resolveJobsTimezone({
      configured: (await settings.read()).jobsTimezone,
      environment: process.env['TZ'],
      host: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
});

const catalogueProvider = createCatalogueMetadataProvider({
  readApiKey: async () => (await settings.read()).catalogueApiKey,
  onProblem: (reason) => {
    log.error('catalogue', `catalogue: ${reason}`);
  },
});

const arrivals = new Map<string, ScannedItem[]>();
const departures = new Map<string, ScannedItem[]>();

/**
 * Keeps what a scan changed until the scan ends, so that arrivals can be reported as a list as well
 * as one at a time. A library scans under a mutex, so one list per library is enough.
 *
 * @param held - Where to keep it.
 * @param libraryId - The library being scanned.
 * @param items - What changed.
 */
const remember = (held: Map<string, ScannedItem[]>, libraryId: string, items: ScannedItem[]) => {
  held.set(libraryId, [...(held.get(libraryId) ?? []), ...items]);
};

const SCAN_GIVES_UP_AFTER_MILLISECONDS = 600_000;

const LONE_SCAN = 'a scan on its own';

const scanRuns = collectScanRuns({
  givesUpAfterMilliseconds: SCAN_GIVES_UP_AFTER_MILLISECONDS,
  onFinished: (report) => {
    void events.publish({ event: 'library.scanned', data: report });
  },
});

const libraryService = createDatabaseLibraryService({
  db,
  files: createMediaFileSystem(),
  transcoder,
  jobs,
  providers: [catalogueProvider, createFilenameMetadataProvider()],
  books: bookService,
  atOnce: env.MEDIA_JOBS,
  onProblem: (path, reason) => {
    log.warn('scanner', `skipped ${path}: ${reason}`);
  },
  onArrived: (libraryId, item) => {
    remember(arrivals, libraryId, [item]);
  },
  onDeparted: (libraryId, items) => {
    remember(departures, libraryId, items);
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

const downloadService = createDownloadService({
  db,
  media: {
    findForPlayback: async (mediaId) => {
      const item = await libraryService.getMedia(mediaId);

      if (item === null) {
        return null;
      }

      const rows = await db
        .select({
          path: mediaItem.path,
          sizeBytes: mediaItem.sizeBytes,
          generation: library.generation,
        })
        .from(mediaItem)
        .innerJoin(library, eq(library.id, mediaItem.libraryId))
        .where(eq(mediaItem.id, mediaId))
        .limit(1);

      const row = rows[0];

      return row === undefined
        ? null
        : { item, path: row.path, sizeBytes: row.sizeBytes, generation: row.generation };
    },
    titleOf: async (mediaId) => (await libraryService.getMedia(mediaId))?.title ?? null,
    episodesOf: async (seriesId) =>
      (await libraryService.itemsForShare({ kind: 'series', mediaId: null, seriesId })).map(
        (item) => ({ id: item.id, title: item.title }),
      ),
    seriesOf: async (mediaId) => {
      const seriesId = await libraryService.seriesOf(mediaId);

      return seriesId === null ? null : await libraryService.getSeries(seriesId);
    },
    keepingProfile,
  },
  transcoder,
  capabilities: async () => transcoder.capabilities(),
  forcedAccel: async () => (await settings.read()).hardwareAccel,
});

const app = createApp({
  auth,
  settings,
  trustedOrigins: trustedOriginsFor({
    configured: env.TRUSTED_ORIGINS,
    port: env.PORT,
    settings,
  }),
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
  events,
  readPushPublicKey: async () => (await readPushKeys()).publicKey,
  downloads: downloadService,
  favourites: createDatabaseFavouriteService(db),
  ratings: createDatabaseRatingService(db),
  shares: createDatabaseShareService(db),
  shareSessions: createShareSessions(),
  sayALinkWasWithdrawn: async ({ accountId, title, byName }) => {
    await notifyHousehold({
      store: notifications,
      event: 'sharing.withdrawn',
      title: 'A link you handed out was withdrawn',
      body: `${byName} withdrew your link to ${title}. Anybody watching through it has stopped.`,
      link: null,
      vapid: await readPushKeys(),
      only: [accountId],
      onProblem: (reason) => {
        log.error('server', `withdrawn link: ${reason}`);
      },
      announce: (userIds) => {
        realtime.publish(
          'notifications',
          { event: 'sharing.withdrawn' },
          { kind: 'accounts', accountIds: [...userIds] },
        );
      },
    });
  },
  profiles: profileService,
  books: bookService,
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
    const [removed] = await db
      .delete(user)
      .where(eq(user.id, userId))
      .returning({ id: user.id, name: user.name });

    if (removed === undefined) {
      return false;
    }

    void events.publish({
      event: 'account.deleted',
      data: { accountId: removed.id, name: removed.name },
    });

    return true;
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
  monitor: async () => withApiMemory(await transcoder.readMonitor()),
  stalledJobs: () =>
    jobHealth.stalled().map((stall) => ({ ...stall, label: labelForQueue(stall.kind) })),
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

await jobs.startWorking();

for (const kind of await schedules.sync()) {
  const queueName = scheduleQueueNameFor(kind);

  await jobs.enqueue(queueName, {}, queueName);
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
    connect: (arrival) => {
      presence.connect(arrival);
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
    const reading = withApiMemory(report);

    realtime.publish('monitor', reading, { kind: 'everyone' });
    transcoderIntake.take(reading);
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

  log.info('server', `Valence listening on ${origin}`);

  if (persisted.setupCompletedAt === null) {
    log.info('server', `First-run setup at ${origin}`);
  }

  log.info('server', `API reference at ${origin}/api/reference`);
  log.info('server', `Media service dialled at ${env.TRANSCODER_URL}`);
});

nodeWebSocket.injectWebSocket(server);
