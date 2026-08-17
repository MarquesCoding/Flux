import { readCatalogueReference } from '@FluxCore/functions/readCatalogueReference';
import type { RunningJob } from '@FluxServer/jobs/JobQueue';
import type { CatalogueMatch } from '@FluxServer/library/MetadataProvider';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { suggestTrustedOrigins } from '@FluxServer/setup/suggestTrustedOrigins';
import type { FluxAuth } from '@FluxServer/auth/Auth';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';
import { DEFAULT_LIMIT } from '@FluxServer/library/LibraryService';
import { splitPersonCredits } from '@FluxServer/library/splitPersonCredits';
import type { LibraryService } from '@FluxServer/library/LibraryService';
import type { SubtitleService } from '@FluxServer/subtitles/SubtitleService';
import type { SegmentService } from '@FluxServer/segments/SegmentService';
import type { WatchProgressService } from '@FluxServer/progress/WatchProgressService';
import type { FavouriteService } from '@FluxServer/favourites/FavouriteService';
import type { RatingService } from '@FluxServer/ratings/RatingService';
import type { ShareService } from '@FluxServer/sharing/ShareService';
import type { ShareSessions } from '@FluxServer/sharing/createShareSessions';
import type { PlaybackService, PreviewRead } from '@FluxServer/playback/PlaybackService';
import { createPresenceService } from '@FluxServer/presence/PresenceService';
import type { PresenceService } from '@FluxServer/presence/PresenceService';
import { healthRoute } from './routes/HealthRoute';
import {
  listLibrariesRoute,
  createLibraryRoute,
  updateLibraryRoute,
  listItemsRoute,
  listFacetsRoute,
  getMediaRoute,
  listShowsRoute,
  getShowRoute,
  scanLibraryRoute,
  scanStateRoute,
  runningScansRoute,
  correctMatchRoute,
  forgetCorrectionRoute,
  rebuildArtefactsRoute,
  resetLibraryRoute,
  regeneratePreviewsRoute,
} from './routes/LibraryRoute';
import {
  explainRoute,
  startRoute,
  sessionFileRoute,
  directFileRoute,
  trickplayRoute,
  trickplayFileRoute,
  frameRoute,
  stopRoute,
  heartbeatRoute,
} from './routes/PlaybackRoute';
import {
  presenceHeartbeatRoute,
  presenceStopWatchingRoute,
} from '@FluxServer/routes/PresenceRoute';
import { mediaImageRoute } from '@FluxServer/routes/ImageRoute';
import { listSegmentsRoute } from '@FluxServer/routes/SegmentRoute';
import {
  listProgressRoute,
  recordProgressRoute,
  forgetProgressRoute,
} from '@FluxServer/routes/ProgressRoute';
import { readPersonRoute, readPersonCreditsRoute } from '@FluxServer/routes/PersonRoute';
import {
  createShareRoute,
  listSharesRoute,
  revokeShareRoute,
  openShareRoute,
} from '@FluxServer/routes/ShareRoute';
import { SHARE_COOKIE, createShareGate } from '@FluxServer/sharing/createShareGate';
import { isShareLive, whyShareEnded } from '@FluxContracts/schemas/Share';
import { getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';

const SHARE_JOINER = 'flux_share_joiner';
import {
  listFavouritesRoute,
  keepFavouriteRoute,
  dropFavouriteRoute,
} from '@FluxServer/routes/FavouriteRoute';
import {
  listRatingsRoute,
  rateMediaRoute,
  clearMediaRatingRoute,
  readMediaHouseholdRatingRoute,
  rateSeriesRoute,
  clearSeriesRatingRoute,
  readSeriesHouseholdRatingRoute,
} from '@FluxServer/routes/RatingRoute';
import {
  adminOverviewRoute,
  adminMeasureStorageRoute,
  searchCatalogueRoute,
  adminSettingsRoute,
  adminSessionsRoute,
  adminStopSessionRoute,
  adminPauseSessionRoute,
  adminResumeSessionRoute,
  adminJobDefinitionsRoute,
  adminRunJobRoute,
  adminCancelJobRoute,
  adminJobSchedulesRoute,
  adminAddJobTriggerRoute,
  adminRemoveJobTriggerRoute,
} from '@FluxServer/routes/AdminRoute';
import {
  listDevicesRoute,
  endDeviceRoute,
  endOtherDevicesRoute,
} from '@FluxServer/routes/DeviceRoute';
import { describeDevice } from '@FluxServer/account/describeDevice';
import {
  listProfilesRoute,
  createProfileRoute,
  updateProfileRoute,
  deleteProfileRoute,
  promoteProfileRoute,
} from '@FluxServer/routes/ProfileRoute';
import { listSubtitlesRoute, readSubtitleRoute } from '@FluxServer/routes/SubtitleRoute';
import { setupStatusRoute, setupCompleteRoute } from './routes/SetupRoute';
import { JOB_DEFINITIONS, RESET_LIBRARY_JOB } from '@FluxServer/jobs/jobDefinitions';
import {
  SCAN_LIBRARY_JOB,
  REGENERATE_PREVIEWS_JOB,
  REGENERATE_TRICKPLAY_JOB,
  FETCH_LOGOS_JOB,
  DETECT_SEGMENTS_JOB,
  CLEANUP_IMAGE_CACHE_JOB,
  CLEANUP_ARTEFACT_CACHE_JOB,
  CLEANUP_SESSIONS_JOB,
  CHECK_CATALOGUE_CONNECTIVITY_JOB,
} from '@FluxServer/jobs/JobQueue';
import { createMemoryMaintenanceService } from '@FluxServer/maintenance/createMemoryMaintenanceService';
import type { MaintenanceService } from '@FluxServer/maintenance/MaintenanceService';
import { createMemoryJobScheduleService } from '@FluxServer/jobs/createMemoryJobScheduleService';
import type { JobScheduleService } from '@FluxServer/jobs/JobScheduleService';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import { drawAvatar, isAvatarStyle } from '@FluxServer/profiles/drawAvatar';
import { shiftWebVtt } from '@FluxCore/functions/shiftWebVtt';
import type { ProfileService } from '@FluxServer/profiles/ProfileService';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';
import { createSessionGate } from '@FluxServer/auth/createSessionGate';
import { createBetterAuthAdminBlock } from '@FluxServer/auth/createBetterAuthAdminBlock';
import { checkRoleChange } from '@FluxServer/auth/checkRoleChange';
import { checkAccountAction } from '@FluxServer/auth/checkAccountAction';
import type { AccountActionRefusal } from '@FluxServer/auth/checkAccountAction';
import {
  listAccountsRoute,
  banAccountRoute,
  unbanAccountRoute,
  removeAccountRoute,
  inviteAccountRoute,
  editAccountRoute,
} from '@FluxServer/routes/AccountRoute';
import type { RoleChangeRefusal } from '@FluxServer/auth/checkRoleChange';
import { PERMISSIONS } from '@FluxContracts/schemas/Permission';
import {
  listPermissionsRoute,
  listRolesRoute,
  createRoleRoute,
  updateRoleRoute,
  deleteRoleRoute,
  listAccountRolesRoute,
  assignRoleRoute,
  removeRoleRoute,
  setOverrideRoute,
  clearOverrideRoute,
} from '@FluxServer/routes/RoleRoute';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createBetterAuthApiKeyService } from '@FluxServer/auth/createBetterAuthApiKeyService';
import {
  listApiKeysRoute,
  createApiKeyRoute,
  updateApiKeyRoute,
  revokeApiKeyRoute,
} from '@FluxServer/routes/ApiKeyRoute';
import {
  listWebhooksRoute,
  createWebhookRoute,
  updateWebhookRoute,
  deleteWebhookRoute,
  testWebhookRoute,
  listWebhookDeliveriesRoute,
  redeliverWebhookRoute,
  DELIVERY_PAGE,
} from '@FluxServer/routes/WebhookRoute';
import { createMemoryWebhookStore } from '@FluxServer/webhooks/createMemoryWebhookStore';
import { createMemoryNotificationStore } from '@FluxServer/notifications/createMemoryNotificationStore';
import {
  listNotificationsRoute,
  readNotificationsRoute,
  readNotificationPreferencesRoute,
  writeNotificationPreferenceRoute,
  subscribeToPushRoute,
  unsubscribeFromPushRoute,
  NOTIFICATION_PAGE,
} from '@FluxServer/routes/NotificationRoute';
import {
  DEFAULT_NOTIFICATION_PREFERENCE,
  NOTIFICATION_EVENTS,
} from '@FluxContracts/schemas/Notification';
import type { NotificationStore } from '@FluxServer/notifications/NotificationStore';
import { isSafeWebhookUrl } from '@FluxServer/webhooks/isSafeWebhookUrl';
import { queueWebhookTest } from '@FluxServer/webhooks/queueWebhookTest';
import { queueWebhookRedelivery } from '@FluxServer/webhooks/queueWebhookRedelivery';
import { narrowToKey } from '@FluxServer/auth/narrowToKey';
import { watchedBetween } from '@FluxServer/progress/accumulateWatchTime';
import { readSessionOnce } from '@FluxServer/auth/readSessionOnce';
import type { PermissionService } from '@FluxServer/auth/PermissionService';
import type { ApiKeyService } from '@FluxServer/auth/ApiKeyService';
import type { WebhookStore } from '@FluxServer/webhooks/WebhookStore';
import {
  listHistoryRoute,
  forgetViewingRoute,
  forgetHistoryRoute,
} from '@FluxServer/routes/HistoryRoute';
import type { HistoryService } from '@FluxServer/history/HistoryService';
import type { Permission } from '@FluxContracts/schemas/Permission';

const PROFILE_HEADER = 'x-flux-profile';

/**
 * Picks the headers worth carrying from a media file the server is forwarding — the type, the
 * length, the range it answered with — and leaves the rest behind rather than passing an upstream
 * response's headers through wholesale.
 *
 * @param file - The response from the file or the media service.
 * @param extra - Anything to add on top.
 * @returns The headers to answer with.
 */
const forwardedFileHeaders = (
  file: { contentType: string; contentRange: string | null; contentLength: string | null },
  extra: Record<string, string> = {},
): Record<string, string> => {
  const headers: Record<string, string> = {
    'content-type': file.contentType,
    'accept-ranges': 'bytes',
    ...extra,
  };

  if (file.contentRange !== null) {
    headers['content-range'] = file.contentRange;
  }

  if (file.contentLength !== null) {
    headers['content-length'] = file.contentLength;
  }

  return headers;
};

const SignInBodySchema = z.object({ password: z.string().min(1) });

const SERVER_VERSION = '0.0.0';

const OVERVIEW_PATIENCE_MILLISECONDS = 5_000;

const within = async <Answer>(work: Promise<Answer>, fallback: Answer): Promise<Answer> =>
  Promise.race([
    work,
    new Promise<Answer>((resolve) => {
      setTimeout(() => {
        resolve(fallback);
      }, OVERVIEW_PATIENCE_MILLISECONDS).unref();
    }),
  ]);

/**
 * What to tell somebody whose action on an account was refused.
 */
const describeAccountRefusal = (refusal: AccountActionRefusal): string =>
  refusal === 'self'
    ? 'You cannot do that to your own account.'
    : 'That account is at or above your own rank.';

/**
 * What to tell somebody whose change to a role was refused.
 */
const describeRefusal = (refusal: RoleChangeRefusal): string =>
  refusal === 'outranked'
    ? 'That role is at or above your own.'
    : 'You cannot grant a permission you do not hold.';

type ArtefactCount = { count: number; bytes: number };

type StorageCount = {
  cache: {
    previews: ArtefactCount;
    trickplay: ArtefactCount;
    sessions: ArtefactCount;
    atMs: number;
  } | null;
  artwork: { count: number; bytes: number; atMs: number } | null;
  libraryBytes: number;
};

type CreateAppOptions = {
  auth: FluxAuth;
  settings: SettingsStore;
  countUsers: () => Promise<number>;
  promoteToAdmin: (email: string) => Promise<void>;
  library: LibraryService;
  playback: PlaybackService;
  permissions?: PermissionService;
  history?: HistoryService;
  apiKeys?: ApiKeyService;
  webhooks?: WebhookStore;
  notifications?: NotificationStore;
  readPushPublicKey?: () => Promise<string>;
  queueWebhookDelivery?: (subscriptionId: string, payload: string) => Promise<void>;
  banAccount?: (userId: string, reason: string) => Promise<boolean>;
  unbanAccount?: (userId: string) => Promise<boolean>;
  removeAccount?: (userId: string) => Promise<boolean>;
  isAccountBanned?: (userId: string) => Promise<boolean>;
  inviteAccount?: (request: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ id: string; name: string; email: string; createdAt: string } | null>;
  editAccount?: (
    userId: string,
    changes: { name?: string; email?: string },
  ) => Promise<'changed' | 'missing' | 'taken'>;
  readBanReason?: (userId: string) => Promise<string | null>;
  maintenance?: MaintenanceService;
  schedules?: JobScheduleService;
  presence?: PresenceService;
  subtitles: SubtitleService;
  segments: SegmentService;
  progress: WatchProgressService;
  favourites: FavouriteService;
  ratings: RatingService;
  shares?: ShareService;
  shareSessions?: ShareSessions;
  profiles?: ProfileService;
  promoteProfile?: (request: {
    profileId: string;
    email: string;
    password: string;
  }) => Promise<
    { kind: 'promoted'; profile: ViewerProfile } | { kind: 'taken' } | { kind: 'missing' }
  >;
  listUsers?: () => Promise<
    { id: string; name: string; email: string; role: string | null; createdAt: string }[]
  >;
  capabilities?: () => Promise<{
    ffmpegVersion: string;
    ffmpegSupported?: boolean;
    hardwareAccels: string[];
    rejected?: { encoder: string; reason: string }[];
  }>;
  monitor?: () => Promise<JsonValue>;
  artworkUsage?: () => { count: number; bytes: number; atMs: number } | null;
  libraryBytes?: () => Promise<number>;
  measureStorage?: () => Promise<StorageCount>;
  monitorStream?: () => Promise<ReadableStream<Uint8Array> | null>;
  readImage?: (url: string) => Promise<{ body: ArrayBuffer; contentType: string } | null>;
  isTranscoderReachable?: () => Promise<boolean>;
  transcoderAddress?: string;
  listRunningJobs?: () => RunningJob[];
  cancelJob?: (jobId: string) => Promise<boolean>;
  searchCatalogue?: (query: string, kind: 'tv' | 'movie') => Promise<CatalogueMatch[]>;
};

/**
 * Builds the Flux HTTP application.
 */
const createApp = ({
  auth,
  settings,
  countUsers,
  promoteToAdmin,
  library,
  playback,
  maintenance = createMemoryMaintenanceService(),
  schedules = createMemoryJobScheduleService(),
  presence = createPresenceService(),
  subtitles,
  segments,
  progress,
  favourites,
  ratings,
  shares,
  shareSessions,
  profiles,
  promoteProfile,
  listUsers,
  capabilities,
  artworkUsage,
  libraryBytes,
  measureStorage,
  monitor,
  monitorStream,
  readImage,
  isTranscoderReachable = () => Promise.resolve(false),
  transcoderAddress = '',
  listRunningJobs = () => [],
  cancelJob = () => Promise.resolve(false),
  searchCatalogue = () => Promise.resolve([]),
  permissions = createMemoryPermissionService(),
  history,
  apiKeys = createBetterAuthApiKeyService(auth),
  webhooks = createMemoryWebhookStore(),
  notifications = createMemoryNotificationStore(),
  readPushPublicKey = () => Promise.resolve(''),
  queueWebhookDelivery = () => Promise.resolve(),

  banAccount,
  unbanAccount,
  removeAccount,
  isAccountBanned,
  readBanReason,
  inviteAccount,
  editAccount,
}: CreateAppOptions) => {
  const app = new OpenAPIHono();

  app.use(
    '/api/*',
    createSessionGate(
      auth,
      shares === undefined || shareSessions === undefined
        ? undefined
        : createShareGate({
            shares,
            sessions: shareSessions,
            itemOf: async (mediaId) => {
              const item = await library.getMedia(mediaId);

              return item === null
                ? null
                : { id: item.id, seriesId: await library.seriesOf(mediaId) };
            },
          }),
    ),
  );

  /**
   * Whether whoever is asking holds a particular permission.
   */
  const requires = async (headers: Headers, permission: Permission): Promise<boolean> => {
    const session = await readSessionOnce(auth, headers);

    if (session === null) {
      return false;
    }

    const held = await permissions.resolve(session.user.id);

    if (headers.get('x-api-key') === null) {
      return held.has(permission);
    }

    const allowed = await apiKeys.restrictionFor(headers, session.session.id);

    return narrowToKey(held, allowed).has(permission);
  };

  app.all('/api/auth/admin/*', createBetterAuthAdminBlock());

  app.on(['GET', 'POST'], '/api/auth/*', (context) => auth.handler(context.req.raw));

  app.openapi(setupStatusRoute, async (context) => {
    const detectedOrigin = new URL(context.req.url).origin;

    return context.json(
      {
        isComplete: (await countUsers()) > 0,
        detectedOrigin,
        isSecureContext: detectedOrigin.startsWith('https://'),
        suggestedTrustedOrigins: suggestTrustedOrigins(detectedOrigin),
      },
      200,
    );
  });

  app.openapi(setupCompleteRoute, async (context) => {
    if ((await countUsers()) > 0) {
      return context.json({ error: 'Setup has already been completed.' }, 409);
    }

    const { admin, trustedOrigins, cookieSecure } = context.req.valid('json');

    const created = await auth.api.signUpEmail({
      body: { name: admin.name, email: admin.email, password: admin.password },
      asResponse: true,
    });

    if (!created.ok) {
      return context.json({ error: 'The administrator account could not be created.' }, 400);
    }

    await promoteToAdmin(admin.email);

    const previous = await settings.read();

    await settings.write({
      trustedOrigins,
      cookieSecure,
      setupCompletedAt: new Date().toISOString(),
    });

    return context.json(
      { isComplete: true, restartRequired: previous.cookieSecure !== cookieSecure },
      200,
    );
  });

  app.openapi(listLibrariesRoute, async (context) => context.json(await library.list(), 200));

  app.openapi(createLibraryRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'library.create'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const created = await library.create(context.req.valid('json'));

    if (created === null) {
      return context.json({ error: 'That path is not a readable directory.' }, 400);
    }

    return context.json(created, 201);
  });

  app.openapi(updateLibraryRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'library.edit'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { defaultAudioLanguage, filesAtOnce } = context.req.valid('json');

    const updated = await library.update(context.req.valid('param').id, {
      defaultAudioLanguage,
      ...(filesAtOnce === undefined ? {} : { filesAtOnce }),
    });

    if (updated === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(updated, 200);
  });

  app.openapi(listFacetsRoute, async (context) => {
    if ((await readAccount(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json(await library.listFacets(), 200);
  });

  app.openapi(listItemsRoute, async (context) => {
    const { id } = context.req.valid('param');
    const { search, kind, genre, yearFrom, yearTo, minRating, ids, order, limit, offset } =
      context.req.valid('query');

    const { minYourStars } = context.req.valid('query');
    const askedBy = await readProfileId(context.req.raw.headers);

    const page = await library.listItems(id, {
      ...(search === undefined ? {} : { search }),
      ...(kind === undefined ? {} : { kind }),
      ...(genre === undefined ? {} : { genre }),
      ...(yearFrom === undefined ? {} : { yearFrom }),
      ...(yearTo === undefined ? {} : { yearTo }),
      ...(minRating === undefined ? {} : { minRating }),
      ...(ids === undefined ? {} : { ids: ids.split(',').filter((named) => named.trim() !== '') }),
      ...(order === undefined ? {} : { order }),
      ...(askedBy === null ? {} : { profileId: askedBy }),
      ...(minYourStars === undefined ? {} : { minYourStars }),
      limit: limit ?? DEFAULT_LIMIT,
      offset: offset ?? 0,
    });

    if (page === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(page, 200);
  });

  app.openapi(listShowsRoute, async (context) => {
    const shows = await library.listShows(context.req.valid('param').id);

    if (shows === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json({ shows }, 200);
  });

  app.openapi(getShowRoute, async (context) => {
    const { id, showId } = context.req.valid('param');
    const show = await library.getShow(id, showId);

    if (show === null) {
      return context.json({ error: 'No such series.' }, 404);
    }

    return context.json(show, 200);
  });

  app.openapi(getMediaRoute, async (context) => {
    const item = await library.getMedia(context.req.valid('param').id);

    if (item === null) {
      return context.json({ error: 'No such item.' }, 404);
    }

    return context.json(item, 200);
  });

  app.openapi(scanLibraryRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.run'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const queued = await library.scan(
      context.req.valid('param').id,
      context.req.valid('query').force === 'true',
    );

    if (queued === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(queued, 202);
  });

  app.openapi(searchCatalogueRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'media.override'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { query, kind } = context.req.valid('query');

    return context.json({ matches: await searchCatalogue(query, kind) }, 200);
  });

  app.openapi(correctMatchRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'media.override'))) {
      return context.json({ error: 'That is for administrators.' }, 404);
    }

    const { reference, kind } = context.req.valid('json');
    const read = readCatalogueReference(reference);

    if (read === null) {
      return context.json({ error: 'That does not look like a catalogue address or id.' }, 400);
    }

    const externalKind = read.kind ?? kind ?? null;

    if (externalKind === null) {
      return context.json(
        { error: 'Say whether that id is a series or a film — the same number is both.' },
        400,
      );
    }

    const corrected = await library.correctMatch(
      context.req.valid('param').id,
      { externalId: read.id, externalKind },
      (await readAccount(context.req.raw.headers))?.id ?? null,
    );

    return corrected === null
      ? context.json({ error: 'No such item.' }, 404)
      : context.json(corrected, 200);
  });

  app.openapi(forgetCorrectionRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'media.override'))) {
      return context.json({ error: 'That is for administrators.' }, 404);
    }

    const forgotten = await library.forgetCorrection(context.req.valid('param').id);

    return forgotten === null
      ? context.json({ error: 'No such item.' }, 404)
      : context.json(forgotten, 200);
  });

  app.openapi(rebuildArtefactsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'media.override'))) {
      return context.json({ error: 'That is for administrators.' }, 404);
    }

    const rebuilt = await library.rebuildArtefacts(context.req.valid('param').id);

    return rebuilt === null
      ? context.json({ error: 'No such item.' }, 404)
      : context.json(rebuilt, 200);
  });

  app.openapi(runningScansRoute, (context) =>
    context.json(
      {
        scans: listRunningJobs().map((job) => ({
          jobId: job.jobId,
          kind: job.kind,
          libraryId: job.subject,
          phase: job.progress?.phase ?? null,
          processed: job.progress?.processed ?? null,
          total: job.progress?.total ?? null,
        })),
      },
      200,
    ),
  );

  app.openapi(scanStateRoute, async (context) => {
    const { jobId } = context.req.valid('param');
    const { state, phase, processed, total } = await library.readScanState(jobId);

    return context.json({ jobId, state, phase, processed, total }, 200);
  });

  app.openapi(resetLibraryRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.runDestructive'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const reset = await library.reset(context.req.valid('param').id);

    if (reset === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(reset, 202);
  });

  app.openapi(regeneratePreviewsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.run'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const queued = await library.regeneratePreviews(context.req.valid('param').id);

    if (queued === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(queued, 202);
  });

  app.openapi(healthRoute, async (context) => {
    const transcoderReachable = await isTranscoderReachable();

    return context.json(
      {
        status: transcoderReachable ? ('ok' as const) : ('degraded' as const),
        version: SERVER_VERSION,
        transcoderReachable,
      },
      200,
    );
  });

  app.openapi(explainRoute, async (context) => {
    const { mediaId } = context.req.valid('param');
    const { deviceProfile, requestedQuality } = context.req.valid('json');

    const explanation = await playback.explain(mediaId, deviceProfile, requestedQuality);

    if (explanation === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    return context.json(explanation, 200);
  });

  app.openapi(startRoute, async (context) => {
    const { mediaId } = context.req.valid('param');
    const { deviceProfile, clientId, startSeconds, audioStreamIndex, requestedQuality } =
      context.req.valid('json');

    const outcome = await playback.start(
      mediaId,
      deviceProfile,
      startSeconds ?? 0,
      audioStreamIndex,
      requestedQuality,
      clientId,
    );

    if (outcome.kind === 'notFound') {
      return context.json({ error: 'No such media item.' }, 404);
    }

    if (outcome.kind === 'unsupported') {
      return context.json({ error: outcome.reason }, 422);
    }

    if (outcome.kind === 'failed') {
      return context.json({ error: outcome.reason }, 500);
    }

    const openedBy = getCookie(context, SHARE_COOKIE);

    if (openedBy !== undefined && shares !== undefined && shareSessions !== undefined) {
      const held = await shares.resolve(openedBy);

      if (held !== null) {
        shareSessions.claim(outcome.session.sessionId, held.id);
      }
    }

    if (clientId !== undefined) {
      const item = await library.getMedia(mediaId);

      if (item !== null) {
        presence.startPlayback(clientId, {
          mediaId,
          mediaTitle: item.title,
          hasPoster: item.metadata.hasPoster,
          hasBackdrop: item.metadata.hasBackdrop,
          mode: outcome.session.delivery.kind === 'direct' ? 'direct' : 'transcode',
          transcoderSessionId:
            outcome.session.delivery.kind === 'hls' ? outcome.session.sessionId : null,
          plan: outcome.session.plan,
        });
      }
    }

    return context.json(outcome.session, 200);
  });

  app.openapi(sessionFileRoute, async (context) => {
    const { sessionId, name } = context.req.valid('param');

    const file = await playback.readSessionFile(sessionId, name);

    if (file === null) {
      return context.json({ error: 'No such session or segment.' }, 404);
    }

    return context.body(file.body, 200, { 'content-type': file.contentType });
  });

  app.openapi(directFileRoute, async (context) => {
    const { mediaId } = context.req.valid('param');
    const range = context.req.header('range') ?? null;

    const file = await playback.readDirectFile(mediaId, range);

    if (file === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    return context.body(file.body, file.status === 206 ? 206 : 200, forwardedFileHeaders(file));
  });

  app.openapi(trickplayRoute, async (context) => {
    const { mediaId } = context.req.valid('param');

    try {
      const thumbnails = await playback.trickplay(mediaId);

      if (thumbnails === null) {
        return context.json({ error: 'No such media item.' }, 404);
      }

      return context.json(thumbnails, 200);
    } catch {
      return context.json({ error: 'The thumbnails could not be rendered.' }, 500);
    }
  });

  app.openapi(frameRoute, async (context) => {
    const { mediaId } = context.req.valid('param');
    const { seconds, width } = context.req.valid('query');

    const frame = await playback.readFrame(mediaId, seconds, width);

    if (frame === null) {
      return context.json({ error: 'No frame there.' }, 404);
    }

    return context.body(frame, 200, {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    });
  });

  app.get('/api/media/:mediaId/preview', async (context) => {
    const read = await playback
      .readPreview(context.req.param('mediaId'), context.req.header('range') ?? null)
      .catch((): PreviewRead => ({ kind: 'absent' }));

    if (read.kind === 'pending') {
      return context.json({ status: 'generating' }, 202, { 'cache-control': 'no-store' });
    }

    if (read.kind === 'absent') {
      return context.json({ error: 'No preview yet.' }, 404);
    }

    return context.body(
      read.file.body,
      read.file.status === 206 ? 206 : 200,
      forwardedFileHeaders(read.file, { 'cache-control': 'public, max-age=86400' }),
    );
  });

  app.openapi(trickplayFileRoute, async (context) => {
    const { trickplayId, name } = context.req.valid('param');

    const file = await playback.readTrickplayFile(trickplayId, name);

    if (file === null) {
      return context.json({ error: 'No such thumbnails.' }, 404);
    }

    return context.body(file.body, 200, { 'content-type': file.contentType });
  });

  /**
   * Who is asking.
   */
  /**
   * Which person on this account is watching.
   */
  const readProfileId = async (headers: Headers): Promise<string | null> => {
    const session = await readSessionOnce(auth, headers);
    const viewer = session?.user;

    if (viewer === undefined || profiles === undefined) {
      return null;
    }

    const named = headers.get(PROFILE_HEADER);

    if (named !== null && (await profiles.belongsTo(viewer.id, named))) {
      return named;
    }

    return (await profiles.ensureDefault(viewer.id, viewer.name)).id;
  };

  /**
   * Who is signed in, for the routes that act on their own account.
   */
  const readAccount = async (headers: Headers) =>
    (await readSessionOnce(auth, headers))?.user ?? null;

  /**
   * Whoever is asking, if they may hold keys at all.
   */
  const readKeyHolder = async (headers: Headers) => {
    const account = await readAccount(headers);

    if (account === null) {
      return { account: null, refusal: 'anonymous' } as const;
    }

    return (await requires(headers, 'account.keys'))
      ? ({ account, refusal: null } as const)
      : ({ account: null, refusal: 'forbidden' } as const);
  };

  app.openapi(listApiKeysRoute, async (context) => {
    const holder = await readKeyHolder(context.req.raw.headers);

    if (holder.refusal !== null) {
      return holder.refusal === 'anonymous'
        ? context.json({ error: 'Nobody is signed in.' }, 401)
        : context.json({ error: 'This account may not hold API keys.' }, 403);
    }

    return context.json({ keys: await apiKeys.list(context.req.raw.headers) }, 200);
  });

  app.openapi(createApiKeyRoute, async (context) => {
    const holder = await readKeyHolder(context.req.raw.headers);

    if (holder.refusal !== null) {
      return holder.refusal === 'anonymous'
        ? context.json({ error: 'Nobody is signed in.' }, 401)
        : context.json({ error: 'This account may not hold API keys.' }, 403);
    }

    const account = holder.account;

    const { name, expiresInDays, permissions: asked, rateLimit } = context.req.valid('json');

    const held = await permissions.resolve(account.id);
    const restricted = asked === null ? null : asked.filter((one) => held.has(one));

    const made = await apiKeys.create(account.id, {
      name,
      expiresInDays,
      permissions: restricted,
      rateLimit,
    });

    return context.json(made, 201);
  });

  app.openapi(updateApiKeyRoute, async (context) => {
    const holder = await readKeyHolder(context.req.raw.headers);

    if (holder.refusal !== null) {
      return holder.refusal === 'anonymous'
        ? context.json({ error: 'Nobody is signed in.' }, 401)
        : context.json({ error: 'This account may not hold API keys.' }, 403);
    }

    const changed = await apiKeys.setEnabled(
      context.req.raw.headers,
      context.req.valid('param').id,
      context.req.valid('json').enabled,
    );

    if (changed === null) {
      return context.json({ error: 'No such key on this account.' }, 404);
    }

    return context.json(changed, 200);
  });

  app.openapi(revokeApiKeyRoute, async (context) => {
    const holder = await readKeyHolder(context.req.raw.headers);

    if (holder.refusal !== null) {
      return holder.refusal === 'anonymous'
        ? context.json({ error: 'Nobody is signed in.' }, 401)
        : context.json({ error: 'This account may not hold API keys.' }, 403);
    }

    if (!(await apiKeys.revoke(context.req.raw.headers, context.req.valid('param').id))) {
      return context.json({ error: 'No such key on this account.' }, 404);
    }

    return context.body(null, 204);
  });

  /**
   * Whether this request may manage subscriptions, and why not if it may not.
   */
  const readWebhookKeeper = async (
    headers: Headers,
  ): Promise<'anonymous' | 'forbidden' | 'allowed'> => {
    const account = await readAccount(headers);

    if (account === null) {
      return 'anonymous';
    }

    return (await requires(headers, 'server.webhooks')) ? 'allowed' : 'forbidden';
  };

  const refuseWebhookKeeper = (keeper: 'anonymous' | 'forbidden') =>
    keeper === 'anonymous'
      ? ({ error: 'Nobody is signed in.', status: 401 } as const)
      : ({ error: 'This account may not manage webhooks.', status: 403 } as const);

  app.openapi(listWebhooksRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    return context.json({ webhooks: await webhooks.list() }, 200);
  });

  app.openapi(createWebhookRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    const asked = context.req.valid('json');

    if (!isSafeWebhookUrl(asked.url)) {
      return context.json({ error: 'Flux will not send deliveries to that address.' }, 400);
    }

    const made = await webhooks.create(asked);

    return context.json({ ...made.subscription, secret: made.secret }, 201);
  });

  app.openapi(updateWebhookRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    const changed = await webhooks.update(context.req.valid('param').id, context.req.valid('json'));

    return changed === null
      ? context.json({ error: 'No such subscription.' }, 404)
      : context.json(changed, 200);
  });

  app.openapi(deleteWebhookRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    if (!(await webhooks.remove(context.req.valid('param').id))) {
      return context.json({ error: 'No such subscription.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(testWebhookRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    const queued = await queueWebhookTest({
      subscriptions: webhooks,
      subscriptionId: context.req.valid('param').id,
      enqueue: queueWebhookDelivery,
    });

    return queued
      ? context.json({ queued }, 202)
      : context.json({ error: 'No such subscription, or it is turned off.' }, 404);
  });

  app.openapi(listWebhookDeliveriesRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    const { id } = context.req.valid('param');

    const exists = (await webhooks.list()).some((webhook) => webhook.id === id);

    if (!exists) {
      return context.json({ error: 'No such subscription.' }, 404);
    }

    return context.json({ deliveries: await webhooks.listDeliveries(id, DELIVERY_PAGE) }, 200);
  });

  app.openapi(redeliverWebhookRoute, async (context) => {
    const keeper = await readWebhookKeeper(context.req.raw.headers);

    if (keeper !== 'allowed') {
      const refusal = refuseWebhookKeeper(keeper);

      return context.json({ error: refusal.error }, refusal.status);
    }

    const { id, deliveryId } = context.req.valid('param');

    const queued = await queueWebhookRedelivery({
      subscriptions: webhooks,
      subscriptionId: id,
      deliveryId,
      enqueue: queueWebhookDelivery,
    });

    return queued
      ? context.json({ queued }, 202)
      : context.json(
          { error: 'No such delivery, or the subscription is gone or turned off.' },
          404,
        );
  });

  app.openapi(listNotificationsRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json(
      {
        notifications: await notifications.list(account.id, NOTIFICATION_PAGE),
        unread: await notifications.countUnread(account.id),
      },
      200,
    );
  });

  app.openapi(readNotificationsRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { id } = context.req.valid('json');

    await notifications.markRead(account.id, id);

    return context.json({ unread: await notifications.countUnread(account.id) }, 200);
  });

  app.openapi(readNotificationPreferencesRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const stored = await notifications.readPreferences(account.id);

    const chosen = new Map(stored.map((one) => [one.event, one]));

    const preferences = NOTIFICATION_EVENTS.map(
      (event) => chosen.get(event) ?? { event, ...DEFAULT_NOTIFICATION_PREFERENCE },
    );

    return context.json({ preferences, pushPublicKey: await readPushPublicKey() }, 200);
  });

  app.openapi(writeNotificationPreferenceRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await notifications.writePreference(account.id, context.req.valid('json'));

    return context.body(null, 204);
  });

  app.openapi(subscribeToPushRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await notifications.addPushEndpoint(account.id, context.req.valid('json'));

    return context.body(null, 204);
  });

  app.openapi(unsubscribeFromPushRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await notifications.removePushEndpoint(context.req.valid('json').endpoint);

    return context.body(null, 204);
  });

  app.openapi(listProfilesRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || profiles === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await profiles.ensureDefault(account.id, account.name);

    return context.json({ profiles: await profiles.list(account.id) }, 200);
  });

  app.openapi(createProfileRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || profiles === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { name, colour, avatar } = context.req.valid('json');

    try {
      const created = await profiles.create(account.id, {
        name,
        colour,
        ...(avatar === undefined ? {} : { avatar }),
      });

      return context.json(created, 201);
    } catch (error) {
      return context.json(
        { error: error instanceof Error ? error.message : 'That profile could not be added.' },
        409,
      );
    }
  });

  app.openapi(updateProfileRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || profiles === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { name, colour, avatar } = context.req.valid('json');

    const changed = await profiles.rename(account.id, context.req.valid('param').profileId, {
      name,
      colour,
      ...(avatar === undefined ? {} : { avatar }),
    });

    return changed
      ? context.body(null, 204)
      : context.json({ error: 'No such profile on this account.' }, 404);
  });

  app.openapi(deleteProfileRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || profiles === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const removed = await profiles.remove(account.id, context.req.valid('param').profileId);

    return removed
      ? context.body(null, 204)
      : context.json({ error: 'No such profile, or it is the only one left.' }, 404);
  });

  app.openapi(promoteProfileRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.manage'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    if (profiles === undefined || promoteProfile === undefined) {
      return context.json({ error: 'No such profile.' }, 404);
    }

    const { profileId } = context.req.valid('param');
    const { email, password } = context.req.valid('json');

    const outcome = await promoteProfile({ profileId, email, password });

    if (outcome.kind === 'taken') {
      return context.json({ error: 'That address already has an account.' }, 409);
    }

    if (outcome.kind === 'missing') {
      return context.json({ error: 'No such profile.' }, 404);
    }

    return context.json(outcome.profile, 200);
  });

  app.get('/api/profiles/:profileId/avatar', async (context) => {
    const picture = await profiles?.readAvatar(context.req.param('profileId'));

    if (picture === undefined || picture === null) {
      return context.json({ error: 'That profile has no picture.' }, 404);
    }

    const isVersioned = context.req.query('v') !== undefined;

    return context.body(picture.body.slice().buffer, 200, {
      'content-type': picture.contentType,
      'cache-control': isVersioned ? 'private, max-age=31536000, immutable' : 'private, max-age=60',
    });
  });

  app.get('/api/profiles/everyone', async (context) => {
    const everyone = await profiles?.listEveryone();

    return context.json({ profiles: everyone ?? [] }, 200);
  });

  app.post('/api/profiles/:profileId/sign-in', async (context) => {
    if (profiles === undefined) {
      return context.json({ error: 'No such profile.' }, 404);
    }

    const body = await context.req.text().catch(() => '');
    const parsed = SignInBodySchema.safeParse(JsonValueSchema.parse(JSON.parse(body || 'null')));

    if (!parsed.success) {
      return context.json({ error: 'A password is required.' }, 400);
    }

    const email = await profiles.findSignInEmail(context.req.param('profileId'));

    if (email === null) {
      return context.json({ error: 'No such profile.' }, 404);
    }

    return auth.api.signInEmail({
      body: { email, password: parsed.data.password },
      asResponse: true,
      headers: context.req.raw.headers,
    });
  });

  app.get('/api/profiles/avatars/:style', (context) => {
    const style = context.req.param('style');
    const seed = context.req.query('seed') ?? 'flux';

    if (!isAvatarStyle(style)) {
      return context.json({ error: 'No such style.' }, 404);
    }

    return context.body(drawAvatar(style, seed), 200, {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=86400',
    });
  });

  app.put('/api/profiles/:profileId/photo', async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || profiles === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const saved = await profiles.savePhoto(account.id, context.req.param('profileId'), {
      body: new Uint8Array(await context.req.arrayBuffer()),
      contentType: context.req.header('content-type') ?? '',
    });

    return saved
      ? context.body(null, 204)
      : context.json({ error: 'That picture could not be used.' }, 400);
  });

  app.openapi(adminMeasureStorageRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'server.monitor'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const measured = await measureStorage?.();

    return context.json(
      {
        cache: measured?.cache ?? null,
        artwork: measured?.artwork ?? null,
        libraryBytes: measured?.libraryBytes ?? 0,
      },
      200,
    );
  });

  app.openapi(adminOverviewRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'server.monitor'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const [users, current, libraries, transcoderCapabilities, isReachable] = await Promise.all([
      listUsers?.() ?? Promise.resolve([]),
      settings.read(),
      library.list(),
      within(capabilities?.().catch(() => null) ?? Promise.resolve(null), null),
      within(isTranscoderReachable(), false),
    ]);

    return context.json(
      {
        users,
        settings: {
          hasCatalogueKey: current.catalogueApiKey !== '',
          hardwareAccel: current.hardwareAccel,
          trustedOrigins: current.trustedOrigins,
          cookieSecure: current.cookieSecure,
        },
        transcoder: {
          isReachable,
          address: transcoderAddress,
          ffmpegVersion: transcoderCapabilities?.ffmpegVersion ?? null,
          ffmpegSupported: transcoderCapabilities?.ffmpegSupported ?? true,
          hardwareAccels: transcoderCapabilities?.hardwareAccels ?? [],
          rejectedEncoders: transcoderCapabilities?.rejected ?? [],
        },
        library: {
          libraryCount: libraries.length,
          itemCount: libraries.reduce((total, entry) => total + entry.itemCount, 0),
          bytes: await (libraryBytes?.() ?? Promise.resolve(0)),
        },
        artwork: artworkUsage?.() ?? null,
      },
      200,
    );
  });

  app.openapi(adminSettingsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'server.settings'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const patch = context.req.valid('json');

    const updated = await settings.write({
      ...(patch.catalogueApiKey === undefined ? {} : { catalogueApiKey: patch.catalogueApiKey }),
      ...(patch.hardwareAccel === undefined ? {} : { hardwareAccel: patch.hardwareAccel }),
    });

    return context.json(
      {
        hasCatalogueKey: updated.catalogueApiKey !== '',
        trustedOrigins: updated.trustedOrigins,
        cookieSecure: updated.cookieSecure,
        hardwareAccel: updated.hardwareAccel,
      },
      200,
    );
  });

  app.openapi(adminSessionsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'streaming.view'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json(presence.list(), 200);
  });

  app.get('/api/admin/sessions/stream', async (context) => {
    if (!(await requires(context.req.raw.headers, 'streaming.view'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const push = () => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(presence.list())}\n\n`));
        };

        push();

        const stopWatching = presence.watch(push);

        context.req.raw.signal.addEventListener('abort', () => {
          stopWatching();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  });

  app.openapi(adminStopSessionRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'streaming.stop'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { clientId } = context.req.valid('param');
    const transcoderSessionId = presence.list().find((entry) => entry.clientId === clientId)
      ?.playback?.transcoderSessionId;

    if (transcoderSessionId !== null && transcoderSessionId !== undefined) {
      await playback.stop(transcoderSessionId);
    }

    if (!presence.stop(clientId, 'This stream was stopped by an admin.')) {
      return context.json({ error: 'That tab is not open.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(adminPauseSessionRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'streaming.pause'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { clientId } = context.req.valid('param');
    const entry = presence.list().find((candidate) => candidate.clientId === clientId);

    if (entry === undefined) {
      return context.json({ error: 'That tab is not open.' }, 404);
    }

    if (!presence.pause(clientId, 'This stream was paused by an admin.')) {
      return context.json({ error: 'That tab is not watching anything.' }, 409);
    }

    return context.body(null, 204);
  });

  app.openapi(adminResumeSessionRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'streaming.pause'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    if (!presence.resume(context.req.valid('param').clientId)) {
      return context.json({ error: 'That tab is not open.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(adminJobDefinitionsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.run'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json({ definitions: JOB_DEFINITIONS }, 200);
  });

  app.openapi(adminRunJobRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.run'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { kind } = context.req.valid('param');
    const { libraryId, force } = context.req.valid('json');

    const maintenanceRunners: Record<string, () => Promise<{ jobId: string; state: string }>> = {
      [CLEANUP_IMAGE_CACHE_JOB]: () => maintenance.cleanupImageCache(),
      [CLEANUP_ARTEFACT_CACHE_JOB]: () => maintenance.cleanupArtefactCache(),
      [CLEANUP_SESSIONS_JOB]: () => maintenance.cleanupSessions(),
      [CHECK_CATALOGUE_CONNECTIVITY_JOB]: () => maintenance.checkCatalogueConnectivity(),
    };

    const maintenanceRunner = maintenanceRunners[kind];

    if (maintenanceRunner !== undefined) {
      return context.json(await maintenanceRunner(), 202);
    }

    if (libraryId === undefined) {
      return context.json({ error: 'That job needs a library.' }, 404);
    }

    const libraryRunners: Record<string, () => Promise<{ jobId: string; state: string } | null>> = {
      [SCAN_LIBRARY_JOB]: () => library.scan(libraryId, force ?? false),
      [REGENERATE_PREVIEWS_JOB]: () => library.regeneratePreviews(libraryId),
      [REGENERATE_TRICKPLAY_JOB]: () => library.regenerateTrickplay(libraryId),
      [FETCH_LOGOS_JOB]: () => library.fetchLogos(libraryId),
      [DETECT_SEGMENTS_JOB]: () => library.detectSegments(libraryId),
      [RESET_LIBRARY_JOB]: () => library.reset(libraryId),
    };

    const runner = libraryRunners[kind];

    if (runner === undefined) {
      return context.json({ error: 'No such job kind.' }, 404);
    }

    const queued = await runner();

    if (queued === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(queued, 202);
  });

  app.openapi(adminCancelJobRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.run'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { jobId } = context.req.valid('param');

    return (await cancelJob(jobId))
      ? context.json({ jobId }, 202)
      : context.json({ error: 'Nothing is running under that id.' }, 404);
  });

  app.openapi(adminJobSchedulesRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.schedule'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json({ schedules: await schedules.list() }, 200);
  });

  app.openapi(adminAddJobTriggerRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.schedule'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { kind } = context.req.valid('param');
    const { trigger } = context.req.valid('json');
    const added = await schedules.add(kind, trigger);

    if (added === null) {
      return context.json({ error: 'No such job kind.' }, 404);
    }

    return context.json(added, 201);
  });

  app.openapi(adminRemoveJobTriggerRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'jobs.schedule'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { kind, triggerId } = context.req.valid('param');

    if (!(await schedules.remove(kind, triggerId))) {
      return context.json({ error: 'No such trigger.' }, 404);
    }

    return context.body(null, 204);
  });

  /**
   * Who is asking, and what they may do — resolved once for the role routes, which need both their
   * permissions and their rank.
   */
  const readActor = async (headers: Headers) => {
    const session = await readSessionOnce(auth, headers);

    if (session === null) {
      return null;
    }

    const held = await permissions.rolesFor(session.user.id);

    return {
      id: session.user.id,
      permissions: await permissions.resolve(session.user.id),
      highestPosition: held.length === 0 ? null : Math.max(...held.map((role) => role.position)),
    };
  };

  /**
   * Whether taking something away would leave the server with nobody able to administer it.
   */
  const wouldStrandTheServer = async (apply: () => Promise<void>, undo: () => Promise<void>) => {
    const before = await permissions.countAdministrators();

    await apply();

    if (before === 0 || (await permissions.countAdministrators()) > 0) {
      return false;
    }

    await undo();

    return true;
  };

  app.openapi(listPermissionsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.roles'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json({ permissions: [...PERMISSIONS] }, 200);
  });

  app.openapi(listRolesRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.roles'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json({ roles: await permissions.listRoles() }, 200);
  });

  app.openapi(createRoleRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const body = context.req.valid('json');
    const refusal = checkRoleChange({
      actorHighestPosition: actor.highestPosition,
      actorPermissions: actor.permissions,
      targetPosition: body.position,
      granting: body.permissions,
    });

    if (refusal !== null) {
      return context.json({ error: describeRefusal(refusal) }, 403);
    }

    return context.json(await permissions.createRole(body), 201);
  });

  app.openapi(updateRoleRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { id } = context.req.valid('param');
    const body = context.req.valid('json');
    const existing = (await permissions.listRoles()).find((role) => role.id === id);

    if (existing === undefined) {
      return context.json({ error: 'No such role.' }, 404);
    }

    const refusal = checkRoleChange({
      actorHighestPosition: actor.highestPosition,
      actorPermissions: actor.permissions,
      targetPosition: Math.max(existing.position, body.position ?? existing.position),
      granting: body.permissions ?? [],
    });

    if (refusal !== null) {
      return context.json({ error: describeRefusal(refusal) }, 403);
    }

    const before = existing.permissions;
    const patch = {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.position === undefined ? {} : { position: body.position }),
      ...(body.permissions === undefined ? {} : { permissions: body.permissions }),
    };
    const updated = await permissions.updateRole(id, patch);

    if (updated === null) {
      return context.json({ error: 'No such role.' }, 404);
    }

    const stranded = await wouldStrandTheServer(
      () => Promise.resolve(),
      async () => {
        await permissions.updateRole(id, { permissions: before });
      },
    );

    if (stranded) {
      return context.json(
        { error: 'That would leave nobody able to administer this server.' },
        400,
      );
    }

    return context.json(updated, 200);
  });

  app.openapi(deleteRoleRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { id } = context.req.valid('param');
    const existing = (await permissions.listRoles()).find((role) => role.id === id);

    if (existing === undefined) {
      return context.json({ error: 'No such role.' }, 404);
    }

    const refusal = checkRoleChange({
      actorHighestPosition: actor.highestPosition,
      actorPermissions: actor.permissions,
      targetPosition: existing.position,
    });

    if (refusal !== null) {
      return context.json({ error: describeRefusal(refusal) }, 403);
    }

    if (existing.permissions.includes('administrator')) {
      return context.json(
        {
          error:
            'A role granting administrator cannot be deleted. Change what it grants, or move its holders first.',
        },
        400,
      );
    }

    await permissions.deleteRole(id);

    return context.body(null, 204);
  });

  app.openapi(listAccountRolesRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.roles'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId } = context.req.valid('param');

    return context.json(
      {
        roles: await permissions.rolesFor(userId),
        overrides: await permissions.overridesFor(userId),
        effective: [...(await permissions.resolve(userId))],
      },
      200,
    );
  });

  app.openapi(assignRoleRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId, roleId } = context.req.valid('param');
    const role = (await permissions.listRoles()).find((candidate) => candidate.id === roleId);

    if (role === undefined) {
      return context.json({ error: 'No such role.' }, 404);
    }

    const refusal = checkRoleChange({
      actorHighestPosition: actor.highestPosition,
      actorPermissions: actor.permissions,
      targetPosition: role.position,
      granting: role.permissions,
    });

    if (refusal !== null) {
      return context.json({ error: describeRefusal(refusal) }, 403);
    }

    await permissions.assignRole(userId, roleId);

    return context.body(null, 204);
  });

  app.openapi(removeRoleRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId, roleId } = context.req.valid('param');
    const role = (await permissions.listRoles()).find((candidate) => candidate.id === roleId);

    if (role !== undefined) {
      const refusal = checkRoleChange({
        actorHighestPosition: actor.highestPosition,
        actorPermissions: actor.permissions,
        targetPosition: role.position,
      });

      if (refusal !== null) {
        return context.json({ error: describeRefusal(refusal) }, 403);
      }
    }

    const stranded = await wouldStrandTheServer(
      async () => {
        await permissions.removeRole(userId, roleId);
      },
      async () => {
        await permissions.assignRole(userId, roleId);
      },
    );

    if (stranded) {
      return context.json(
        { error: 'That would leave nobody able to administer this server.' },
        400,
      );
    }

    return context.body(null, 204);
  });

  app.openapi(setOverrideRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId } = context.req.valid('param');
    const grant = context.req.valid('json');

    if (grant.effect === 'allow' && !actor.permissions.has(grant.permission)) {
      return context.json({ error: describeRefusal('escalation') }, 403);
    }

    const previous = (await permissions.overridesFor(userId)).find(
      (existing) => existing.permission === grant.permission,
    );

    const stranded = await wouldStrandTheServer(
      async () => {
        await permissions.setOverride(userId, grant);
      },
      async () => {
        if (previous === undefined) {
          await permissions.clearOverride(userId, grant.permission);

          return;
        }

        await permissions.setOverride(userId, previous);
      },
    );

    if (stranded) {
      return context.json(
        { error: 'That would leave nobody able to administer this server.' },
        400,
      );
    }

    return context.body(null, 204);
  });

  app.openapi(clearOverrideRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.roles')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId, permission } = context.req.valid('param');
    const previous = (await permissions.overridesFor(userId)).find(
      (existing) => existing.permission === permission,
    );

    const stranded = await wouldStrandTheServer(
      async () => {
        await permissions.clearOverride(userId, permission);
      },
      async () => {
        if (previous !== undefined) {
          await permissions.setOverride(userId, previous);
        }
      },
    );

    if (stranded) {
      return context.json(
        { error: 'That would leave nobody able to administer this server.' },
        400,
      );
    }

    return context.body(null, 204);
  });

  app.openapi(listAccountsRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.manage'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const listed = (await listUsers?.()) ?? [];

    const accounts = await Promise.all(
      listed.map(async (account) => {
        const held = await permissions.rolesFor(account.id);
        const resolved = await permissions.resolve(account.id);

        return {
          id: account.id,
          name: account.name,
          email: account.email,
          createdAt: account.createdAt,
          isBanned: (await isAccountBanned?.(account.id)) ?? false,
          banReason: (await readBanReason?.(account.id)) ?? null,
          position: held.length === 0 ? null : Math.max(...held.map((role) => role.position)),
          isAdministrator: resolved.has('administrator'),
          roles: held.map((role) => role.name),
        };
      }),
    );

    return context.json({ accounts }, 200);
  });

  app.openapi(banAccountRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.ban')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId } = context.req.valid('param');
    const { reason } = context.req.valid('json');
    const target = await permissions.rolesFor(userId);

    const refusal = checkAccountAction({
      actorId: actor.id,
      actorPermissions: actor.permissions,
      actorHighestPosition: actor.highestPosition,
      targetId: userId,
      targetHighestPosition:
        target.length === 0 ? null : Math.max(...target.map((role) => role.position)),
    });

    if (refusal !== null) {
      return context.json({ error: describeAccountRefusal(refusal) }, 403);
    }

    if ((await permissions.resolve(userId)).has('administrator')) {
      const administrators = await permissions.countAdministrators();

      if (administrators <= 1) {
        return context.json(
          { error: 'That would leave nobody able to administer this server.' },
          400,
        );
      }
    }

    if (!(await banAccount?.(userId, reason))) {
      return context.json({ error: 'No such account.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(unbanAccountRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.ban'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    if (!(await unbanAccount?.(context.req.valid('param').userId))) {
      return context.json({ error: 'No such account.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(removeAccountRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.manage')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId } = context.req.valid('param');
    const target = await permissions.rolesFor(userId);

    const refusal = checkAccountAction({
      actorId: actor.id,
      actorPermissions: actor.permissions,
      actorHighestPosition: actor.highestPosition,
      targetId: userId,
      targetHighestPosition:
        target.length === 0 ? null : Math.max(...target.map((role) => role.position)),
    });

    if (refusal !== null) {
      return context.json({ error: describeAccountRefusal(refusal) }, 403);
    }

    if ((await permissions.resolve(userId)).has('administrator')) {
      const administrators = await permissions.countAdministrators();

      if (administrators <= 1) {
        return context.json(
          { error: 'That would leave nobody able to administer this server.' },
          400,
        );
      }
    }

    if (!(await removeAccount?.(userId))) {
      return context.json({ error: 'No such account.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(inviteAccountRoute, async (context) => {
    if (!(await requires(context.req.raw.headers, 'account.invite'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const invited = await inviteAccount?.(context.req.valid('json'));

    if (invited === undefined || invited === null) {
      return context.json({ error: 'That address is already in use.' }, 400);
    }

    return context.json(
      {
        id: invited.id,
        name: invited.name,
        email: invited.email,
        createdAt: invited.createdAt,
        isBanned: false,
        banReason: null,
        position: null,
        isAdministrator: false,
        roles: [],
      },
      201,
    );
  });

  app.openapi(editAccountRoute, async (context) => {
    const actor = await readActor(context.req.raw.headers);

    if (actor === null || !actor.permissions.has('account.manage')) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { userId } = context.req.valid('param');

    if (actor.id !== userId) {
      const target = await permissions.rolesFor(userId);

      const refusal = checkAccountAction({
        actorId: actor.id,
        actorPermissions: actor.permissions,
        actorHighestPosition: actor.highestPosition,
        targetId: userId,
        targetHighestPosition:
          target.length === 0 ? null : Math.max(...target.map((role) => role.position)),
      });

      if (refusal !== null) {
        return context.json({ error: describeAccountRefusal(refusal) }, 403);
      }
    }

    const body = context.req.valid('json');
    const changed = await editAccount?.(userId, {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.email === undefined ? {} : { email: body.email }),
    });

    if (changed === undefined || changed === 'missing') {
      return context.json({ error: 'No such account.' }, 404);
    }

    if (changed === 'taken') {
      return context.json({ error: 'That address is already in use.' }, 400);
    }

    return context.body(null, 204);
  });

  app.openapi(listDevicesRoute, async (context) => {
    const headers = context.req.raw.headers;
    const session = await readSessionOnce(auth, headers);

    if (session === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const held = await auth.api.listSessions({ headers }).catch(() => []);

    return context.json(
      {
        devices: held.map((one) => ({
          id: one.id,
          name: describeDevice(one.userAgent),
          address: one.ipAddress ?? null,
          signedInAt: one.createdAt.toISOString(),
          expiresAt: one.expiresAt.toISOString(),
          isCurrent: one.token === session.session.token,
        })),
      },
      200,
    );
  });

  app.openapi(endDeviceRoute, async (context) => {
    const headers = context.req.raw.headers;
    const session = await readSessionOnce(auth, headers);

    if (session === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const held = await auth.api.listSessions({ headers }).catch(() => []);
    const asked = held.find((one) => one.id === context.req.valid('param').id);

    if (asked !== undefined) {
      await auth.api
        .revokeSession({ headers, body: { token: asked.token } })
        .catch(() => undefined);
    }

    return context.body(null, 204);
  });

  app.openapi(endOtherDevicesRoute, async (context) => {
    const headers = context.req.raw.headers;
    const session = await readSessionOnce(auth, headers);

    if (session === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await auth.api.revokeOtherSessions({ headers }).catch(() => undefined);

    return context.body(null, 204);
  });

  app.get('/api/admin/monitor', async (context) => {
    if (!(await requires(context.req.raw.headers, 'server.monitor'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const reading = await monitor?.().catch(() => null);

    if (reading === null || reading === undefined) {
      return context.json({ error: 'The media service did not answer.' }, 503);
    }

    return new Response(JSON.stringify(reading), {
      headers: { 'content-type': 'application/json' },
    });
  });

  app.get('/api/admin/monitor/stream', async (context) => {
    if (!(await requires(context.req.raw.headers, 'server.monitor'))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const stream = await monitorStream?.().catch(() => null);

    if (stream === null || stream === undefined) {
      return context.json({ error: 'The media service did not answer.' }, 503);
    }

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  });

  app.openapi(listProgressRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json({ progress: await progress.list(profileId) }, 200);
  });

  app.openapi(recordProgressRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { mediaId } = context.req.valid('param');

    if ((await library.getMedia(mediaId)) === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    const report = context.req.valid('json');

    const before = await progress.read(profileId, mediaId);
    const at = new Date();

    const secondsWatched =
      before === null
        ? 0
        : watchedBetween(
            {
              positionSeconds: before.positionSeconds,
              atMs: Date.parse(before.updatedAt),
              isPlaying: true,
            },
            { positionSeconds: report.positionSeconds, atMs: at.getTime(), isPlaying: true },
          );

    await progress.record(profileId, { mediaId, ...report });

    if (history !== undefined) {
      await history.record(profileId, mediaId, {
        at,
        secondsWatched,
        isFinished: report.isFinished,
      });
    }

    return context.body(null, 204);
  });

  app.openapi(forgetProgressRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await progress.forget(profileId, context.req.valid('param').mediaId);

    return context.body(null, 204);
  });

  app.openapi(listHistoryRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null || history === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { limit, offset } = context.req.valid('query');

    return context.json(
      {
        viewings: await history.list(profileId, {
          ...(limit === undefined ? {} : { limit }),
          ...(offset === undefined ? {} : { offset }),
        }),
      },
      200,
    );
  });

  app.openapi(forgetViewingRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null || history === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    if (!(await history.forget(profileId, context.req.valid('param').id))) {
      return context.json({ error: 'No such viewing for this profile.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(forgetHistoryRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null || history === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json({ forgotten: await history.forgetAll(profileId) }, 200);
  });

  app.openapi(readPersonRoute, async (context) => {
    if ((await readProfileId(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const found = await library.readPerson(context.req.valid('param').personId);

    if (found === null) {
      return context.json({ error: 'The catalogue knows nobody by that identifier.' }, 404);
    }

    return context.json(found, 200);
  });

  app.openapi(readPersonCreditsRoute, async (context) => {
    if ((await readProfileId(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const held = await library.findByPerson(context.req.valid('param').personId);

    return context.json(splitPersonCredits(held), 200);
  });

  app.openapi(listFavouritesRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json({ favourites: await favourites.list(profileId) }, 200);
  });

  app.openapi(keepFavouriteRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { mediaId } = context.req.valid('param');

    if ((await library.getMedia(mediaId)) === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    await favourites.keep(profileId, mediaId);

    return context.body(null, 204);
  });

  app.openapi(dropFavouriteRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await favourites.drop(profileId, context.req.valid('param').mediaId);

    return context.body(null, 204);
  });

  app.openapi(createShareRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || shares === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    if (!(await requires(context.req.raw.headers, 'sharing.link'))) {
      return context.json({ error: 'This account may not share.' }, 403);
    }

    const made = await shares.create(account.id, context.req.valid('json'));

    if (made === null) {
      return context.json({ error: 'There is nothing here to share.' }, 404);
    }

    return context.json(made, 201);
  });

  app.openapi(listSharesRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || shares === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json({ shares: await shares.list(account.id) }, 200);
  });

  app.openapi(revokeShareRoute, async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null || shares === undefined) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const withdrawn = await shares.revoke(account.id, context.req.valid('param').shareId);

    if (!withdrawn) {
      return context.json({ error: 'No such link.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(openShareRoute, async (context) => {
    if (shares === undefined) {
      return context.json({ error: 'This link does not work.' }, 404);
    }

    const { token } = context.req.valid('param');
    const found = await shares.resolve(token);

    if (found === null) {
      return context.json({ error: 'This link does not work.' }, 404);
    }

    const standing = {
      expiresAt: found.expiresAt,
      viewCap: found.viewCap,
      views: found.views,
      revokedAt: found.revokedAt,
    };

    const joiner = getCookie(context, SHARE_JOINER) ?? randomUUID();

    if (!isShareLive(standing, new Date())) {
      return context.json(
        { error: whyShareEnded(standing, new Date()) ?? 'This link no longer works.' },
        410,
      );
    }

    await shares.join(found.id, joiner);

    setCookie(context, SHARE_JOINER, joiner, { path: '/', httpOnly: true, sameSite: 'Lax' });
    setCookie(context, SHARE_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'Lax' });

    const items = await library.itemsForShare(found);

    return context.json({ kind: found.kind, title: found.title, items }, 200);
  });

  app.openapi(listRatingsRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    return context.json({ ratings: await ratings.list(profileId) }, 200);
  });

  app.openapi(rateMediaRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { mediaId } = context.req.valid('param');

    if ((await library.getMedia(mediaId)) === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    await ratings.set(profileId, { mediaId }, context.req.valid('json').stars);

    return context.body(null, 204);
  });

  app.openapi(clearMediaRatingRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await ratings.clear(profileId, { mediaId: context.req.valid('param').mediaId });

    return context.body(null, 204);
  });

  app.openapi(readMediaHouseholdRatingRoute, async (context) => {
    if ((await readProfileId(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { mediaId } = context.req.valid('param');

    if ((await library.getMedia(mediaId)) === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    return context.json(await ratings.household({ mediaId }), 200);
  });

  app.openapi(rateSeriesRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { seriesId } = context.req.valid('param');

    if ((await library.getSeries(seriesId)) === null) {
      return context.json({ error: 'No such programme.' }, 404);
    }

    await ratings.set(profileId, { seriesId }, context.req.valid('json').stars);

    return context.body(null, 204);
  });

  app.openapi(clearSeriesRatingRoute, async (context) => {
    const profileId = await readProfileId(context.req.raw.headers);

    if (profileId === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await ratings.clear(profileId, { seriesId: context.req.valid('param').seriesId });

    return context.body(null, 204);
  });

  app.openapi(readSeriesHouseholdRatingRoute, async (context) => {
    if ((await readProfileId(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { seriesId } = context.req.valid('param');

    if ((await library.getSeries(seriesId)) === null) {
      return context.json({ error: 'No such programme.' }, 404);
    }

    return context.json(await ratings.household({ seriesId }), 200);
  });

  app.openapi(listSegmentsRoute, async (context) => {
    const { mediaId } = context.req.valid('param');

    if ((await library.getMedia(mediaId)) === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    return context.json({ segments: await segments.list(mediaId) }, 200);
  });

  app.openapi(mediaImageRoute, async (context) => {
    const { mediaId, kind } = context.req.valid('param');

    const url = await library.readArtworkUrl(mediaId, kind);

    if (url === null || readImage === undefined) {
      return context.json({ error: 'No artwork for that item.' }, 404);
    }

    const image = await readImage(url);

    if (image === null) {
      return context.json({ error: 'That artwork could not be read.' }, 404);
    }

    return context.body(image.body, 200, {
      'content-type': image.contentType,
      'cache-control': 'public, max-age=604800, immutable',
    });
  });

  app.openapi(listSubtitlesRoute, async (context) => {
    const tracks = await subtitles.list(context.req.valid('param').mediaId);

    if (tracks === null) {
      return context.json({ error: 'No such media item.' }, 404);
    }

    return context.json({ tracks }, 200);
  });

  app.openapi(readSubtitleRoute, async (context) => {
    const { mediaId, trackId } = context.req.valid('param');
    const { from } = context.req.valid('query');

    const track = await subtitles.read(mediaId, trackId);

    if (track === null) {
      return context.json({ error: 'No such track.' }, 404);
    }

    return context.body(shiftWebVtt(track, from), 200, {
      'content-type': 'text/vtt; charset=utf-8',
    });
  });

  app.openapi(stopRoute, async (context) => {
    const { sessionId } = context.req.valid('param');

    const stopped = await playback.stop(sessionId);

    if (!stopped) {
      return context.json({ error: 'No such session.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(heartbeatRoute, async (context) => {
    const { sessionId } = context.req.valid('param');
    const { isPlaying } = context.req.valid('json');

    const known = await playback.heartbeat(sessionId, isPlaying);

    if (!known) {
      return context.json({ error: 'No such session.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(presenceHeartbeatRoute, async (context) => {
    if ((await readAccount(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const { clientId } = context.req.valid('param');
    const { isPlaying, health } = context.req.valid('json');

    presence.heartbeatPlayback(clientId, isPlaying, health);

    return context.body(null, 204);
  });

  app.openapi(presenceStopWatchingRoute, async (context) => {
    if ((await readAccount(context.req.raw.headers)) === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    presence.stopPlayback(context.req.valid('param').clientId);

    return context.body(null, 204);
  });

  app.get('/api/presence/stream', async (context) => {
    const account = await readAccount(context.req.raw.headers);

    if (account === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    const clientId = context.req.query('clientId');
    const deviceLabel = context.req.query('deviceLabel') ?? 'Unknown device';

    if (clientId === undefined) {
      return context.json({ error: 'A clientId is required.' }, 400);
    }

    const profileId = await readProfileId(context.req.raw.headers);
    const ownProfiles = profileId === null ? [] : await (profiles?.list(account.id) ?? []);
    const profileName = ownProfiles.find((profile) => profile.id === profileId)?.name ?? null;

    let close = () => {};

    let isClosed = false;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const ping = setInterval(() => {
          controller.enqueue(encoder.encode(': ping\n\n'));
        }, 20000);

        presence.connect(clientId, profileId, profileName, deviceLabel, (event) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        });

        close = () => {
          if (isClosed) {
            return;
          }

          isClosed = true;
          clearInterval(ping);
          presence.disconnect(clientId);
          controller.close();
        };
      },
      cancel() {
        close();
      },
    });

    context.req.raw.signal.addEventListener('abort', () => {
      close();
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  });

  app.doc('/api/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Flux API',
      version: SERVER_VERSION,
      description: 'Self-hosted streaming platform API.',
    },
  });

  app.get(
    '/api/reference',
    apiReference({ spec: { url: '/api/openapi.json' }, pageTitle: 'Flux API' }),
  );

  return app;
};

export type { CreateAppOptions };

export { createApp, SERVER_VERSION };
