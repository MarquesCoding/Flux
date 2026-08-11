import type { RunningJob } from '@FluxServer/jobs/JobQueue';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { suggestTrustedOrigins } from '@FluxServer/setup/suggestTrustedOrigins';
import type { FluxAuth } from '@FluxServer/auth/Auth';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';
import { DEFAULT_LIMIT } from '@FluxServer/library/LibraryService';
import type { LibraryService } from '@FluxServer/library/LibraryService';
import type { SubtitleService } from '@FluxServer/subtitles/SubtitleService';
import type { SegmentService } from '@FluxServer/segments/SegmentService';
import type { WatchProgressService } from '@FluxServer/progress/WatchProgressService';
import type { FavouriteService } from '@FluxServer/favourites/FavouriteService';
import type { PlaybackService } from '@FluxServer/playback/PlaybackService';
import { createPresenceService } from '@FluxServer/presence/PresenceService';
import type { PresenceService } from '@FluxServer/presence/PresenceService';
import { healthRoute } from './routes/HealthRoute';
import {
  listLibrariesRoute,
  createLibraryRoute,
  updateLibraryRoute,
  listItemsRoute,
  getMediaRoute,
  listShowsRoute,
  getShowRoute,
  scanLibraryRoute,
  scanStateRoute,
  runningScansRoute,
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
import {
  listFavouritesRoute,
  keepFavouriteRoute,
  dropFavouriteRoute,
} from '@FluxServer/routes/FavouriteRoute';
import {
  adminOverviewRoute,
  adminSettingsRoute,
  adminSessionsRoute,
  adminStopSessionRoute,
  adminPauseSessionRoute,
  adminResumeSessionRoute,
  adminJobDefinitionsRoute,
  adminRunJobRoute,
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
  DETECT_SEGMENTS_JOB,
  CLEANUP_IMAGE_CACHE_JOB,
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

/**
 * The header a browser names the watching profile in.
 */
const PROFILE_HEADER = 'x-flux-profile';

/**
 * Reads a single byte range out of a request.
 *
 * Only the one form a media element actually sends. Anything else — multiple
 * ranges, a suffix length, a nonsense pair — is answered with the whole thing,
 * which is always a valid response to a range request.
 */
const readByteRange = (
  header: string | undefined,
  size: number,
): { from: number; to: number } | null => {
  const match = /^bytes=(?<from>\d+)-(?<to>\d*)$/.exec(header ?? '');

  if (match?.groups === undefined) {
    return null;
  }

  const from = Number(match.groups.from);
  const to = match.groups.to === '' ? size - 1 : Number(match.groups.to);

  return from >= size || from > to ? null : { from, to: Math.min(to, size - 1) };
};

/**
 * What signing in by face carries.
 */
const SignInBodySchema = z.object({ password: z.string().min(1) });

const SERVER_VERSION = '0.0.0';

/**
 * How long the admin page waits on the media service before drawing without it.
 */
const OVERVIEW_PATIENCE_MILLISECONDS = 5_000;

/**
 * An answer, or the given one if it takes too long.
 *
 * A page describing the server must not be held open by the part of the server
 * it is describing. A media service that has stopped answering is something to
 * report, not something to wait for.
 */
const within = async <Answer>(work: Promise<Answer>, fallback: Answer): Promise<Answer> =>
  Promise.race([
    work,
    new Promise<Answer>((resolve) => {
      setTimeout(() => {
        resolve(fallback);
      }, OVERVIEW_PATIENCE_MILLISECONDS).unref();
    }),
  ]);

type CreateAppOptions = {
  auth: FluxAuth;
  settings: SettingsStore;
  countUsers: () => Promise<number>;
  promoteToAdmin: (email: string) => Promise<void>;
  library: LibraryService;
  playback: PlaybackService;
  /**
   * Server-wide upkeep an admin can start on demand — cache cleanup, session
   * cleanup, catalogue connectivity.
   *
   * Optional for the same reason `presence` is: most tests exercise routes
   * that never touch it, and a memory implementation is made when none is
   * given.
   */
  maintenance?: MaintenanceService;
  /**
   * How often each job runs on its own.
   *
   * Optional for the same reason `maintenance` is.
   */
  schedules?: JobScheduleService;
  /**
   * Who has the app open right now.
   *
   * Optional because most tests exercise routes that never touch presence;
   * a fresh in-memory registry is made when none is given.
   */
  presence?: PresenceService;
  subtitles: SubtitleService;
  segments: SegmentService;
  progress: WatchProgressService;
  favourites: FavouriteService;
  /**
   * The people using each account.
   */
  profiles?: ProfileService;
  /**
   * Gives a profile an account of its own.
   *
   * Passed in rather than done here, because making an account is better-auth's
   * business and it owns how a password becomes a credential.
   */
  promoteProfile?: (request: {
    profileId: string;
    email: string;
    password: string;
  }) => Promise<
    { kind: 'promoted'; profile: ViewerProfile } | { kind: 'taken' } | { kind: 'missing' }
  >;
  /**
   * Everyone with an account, for the administration page.
   */
  listUsers?: () => Promise<
    { id: string; name: string; email: string; role: string | null; createdAt: string }[]
  >;
  capabilities?: () => Promise<{ ffmpegVersion: string; hardwareAccels: string[] }>;
  /**
   * What the media service is doing right now.
   */
  monitor?: () => Promise<JsonValue>;
  monitorStream?: () => Promise<ReadableStream<Uint8Array> | null>;
  /**
   * Reads artwork from Flux's own cache, fetching it once if needed.
   *
   * Optional because an instance with no metadata provider configured has no
   * artwork to serve.
   */
  readImage?: (url: string) => Promise<{ body: ArrayBuffer; contentType: string } | null>;
  isTranscoderReachable?: () => Promise<boolean>;
  /**
   * What the server is working on, so a page reloaded mid-scan can find it.
   */
  listRunningJobs?: () => RunningJob[];
};

/**
 * Builds the Flux HTTP application.
 *
 * Every Flux route is registered through its OpenAPI definition, so the
 * published specification cannot drift from the implementation. See ADR-0002.
 *
 * The `/api/auth/*` prefix is delegated wholesale to better-auth, which owns
 * its own routing and documents itself through its `openAPI` plugin. It is the
 * one part of the surface Flux does not define route by route.
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
  profiles,
  promoteProfile,
  listUsers,
  capabilities,
  monitor,
  monitorStream,
  readImage,
  isTranscoderReachable = () => Promise.resolve(false),
  listRunningJobs = () => [],
}: CreateAppOptions) => {
  const app = new OpenAPIHono();

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
    const created = await library.create(context.req.valid('json'));

    if (created === null) {
      return context.json({ error: 'That path is not a readable directory.' }, 400);
    }

    return context.json(created, 201);
  });

  app.openapi(updateLibraryRoute, async (context) => {
    const updated = await library.update(context.req.valid('param').id, context.req.valid('json'));

    if (updated === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(updated, 200);
  });

  app.openapi(listItemsRoute, async (context) => {
    const { id } = context.req.valid('param');
    const { search, kind, genre, ids, order, limit, offset } = context.req.valid('query');

    const page = await library.listItems(id, {
      ...(search === undefined ? {} : { search }),
      ...(kind === undefined ? {} : { kind }),
      ...(genre === undefined ? {} : { genre }),
      ...(ids === undefined ? {} : { ids: ids.split(',').filter((named) => named.trim() !== '') }),
      ...(order === undefined ? {} : { order }),
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
    const queued = await library.scan(
      context.req.valid('param').id,
      context.req.valid('query').force === 'true',
    );

    if (queued === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(queued, 202);
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
    const reset = await library.reset(context.req.valid('param').id);

    if (reset === null) {
      return context.json({ error: 'No such library.' }, 404);
    }

    return context.json(reset, 202);
  });

  app.openapi(regeneratePreviewsRoute, async (context) => {
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

    const headers: Record<string, string> = {
      'content-type': file.contentType,
      'accept-ranges': 'bytes',
    };

    if (file.contentRange !== null) {
      headers['content-range'] = file.contentRange;
    }

    return context.body(file.body, file.status === 206 ? 206 : 200, headers);
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
    const clip = await playback.readPreview(context.req.param('mediaId')).catch(() => null);

    if (clip === null) {
      return context.json({ error: 'No preview yet.' }, 404);
    }

    const range = readByteRange(context.req.header('range'), clip.body.byteLength);

    if (range === null) {
      return context.body(clip.body, 200, {
        'content-type': clip.contentType,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=86400',
      });
    }

    return context.body(clip.body.slice(range.from, range.to + 1), 206, {
      'content-type': clip.contentType,
      'accept-ranges': 'bytes',
      'content-range': `bytes ${range.from.toString()}-${range.to.toString()}/${clip.body.byteLength.toString()}`,
      'cache-control': 'public, max-age=86400',
    });
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
   *
   * Progress belongs to a person, so these are the first routes that need to
   * know who that is. better-auth owns the session, and asking it is cheaper
   * than Flux keeping a second idea of who is signed in.
   */
  /**
   * Which person on this account is watching.
   *
   * Named by a header the browser sets from whoever was picked. The identifier
   * is not a secret — it sits in local storage — so it is checked against the
   * account on every request rather than trusted. An unrecognised one falls
   * back to the account's default profile rather than failing: somebody whose
   * profile was removed on another device should carry on watching, not meet
   * an error.
   */
  const readProfileId = async (headers: Headers): Promise<string | null> => {
    const session = await auth.api.getSession({ headers }).catch(() => null);
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
   * Whether the viewer administers the server.
   *
   * Checked per request rather than trusted from the browser: an interface
   * that hides a section is a courtesy, not a permission.
   */
  const isAdministrator = async (headers: Headers): Promise<boolean> => {
    const session = await auth.api.getSession({ headers }).catch(() => null);

    return session?.user.role === 'admin';
  };

  /**
   * Who is signed in, for the routes that act on their own account.
   */
  const readAccount = async (headers: Headers) => {
    const session = await auth.api.getSession({ headers }).catch(() => null);

    return session?.user ?? null;
  };

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
    if (!(await isAdministrator(context.req.raw.headers))) {
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

  app.openapi(adminOverviewRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
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
          trustedOrigins: current.trustedOrigins,
          cookieSecure: current.cookieSecure,
        },
        transcoder: {
          isReachable,
          ffmpegVersion: transcoderCapabilities?.ffmpegVersion ?? null,
          hardwareAccels: transcoderCapabilities?.hardwareAccels ?? [],
        },
        library: {
          libraryCount: libraries.length,
          itemCount: libraries.reduce((total, entry) => total + entry.itemCount, 0),
        },
      },
      200,
    );
  });

  app.openapi(adminSettingsRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const patch = context.req.valid('json');

    const updated = await settings.write(
      patch.catalogueApiKey === undefined ? {} : { catalogueApiKey: patch.catalogueApiKey },
    );

    return context.json(
      {
        hasCatalogueKey: updated.catalogueApiKey !== '',
        trustedOrigins: updated.trustedOrigins,
        cookieSecure: updated.cookieSecure,
      },
      200,
    );
  });

  app.openapi(adminSessionsRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json(presence.list(), 200);
  });

  app.openapi(adminStopSessionRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
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
    if (!(await isAdministrator(context.req.raw.headers))) {
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
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    if (!presence.resume(context.req.valid('param').clientId)) {
      return context.json({ error: 'That tab is not open.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(adminJobDefinitionsRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json({ definitions: JOB_DEFINITIONS }, 200);
  });

  app.openapi(adminRunJobRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { kind } = context.req.valid('param');
    const { libraryId, force } = context.req.valid('json');

    const maintenanceRunners: Record<string, () => Promise<{ jobId: string; state: string }>> = {
      [CLEANUP_IMAGE_CACHE_JOB]: () => maintenance.cleanupImageCache(),
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

  app.openapi(adminJobSchedulesRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    return context.json({ schedules: await schedules.list() }, 200);
  });

  app.openapi(adminAddJobTriggerRoute, async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
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
    if (!(await isAdministrator(context.req.raw.headers))) {
      return context.json({ error: 'That is for administrators.' }, 403);
    }

    const { kind, triggerId } = context.req.valid('param');

    if (!(await schedules.remove(kind, triggerId))) {
      return context.json({ error: 'No such trigger.' }, 404);
    }

    return context.body(null, 204);
  });

  app.openapi(listDevicesRoute, async (context) => {
    const headers = context.req.raw.headers;
    const session = await auth.api.getSession({ headers }).catch(() => null);

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
    const session = await auth.api.getSession({ headers }).catch(() => null);

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
    const session = await auth.api.getSession({ headers }).catch(() => null);

    if (session === null) {
      return context.json({ error: 'Nobody is signed in.' }, 401);
    }

    await auth.api.revokeOtherSessions({ headers }).catch(() => undefined);

    return context.body(null, 204);
  });

  app.get('/api/admin/monitor', async (context) => {
    if (!(await isAdministrator(context.req.raw.headers))) {
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
    if (!(await isAdministrator(context.req.raw.headers))) {
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

    await progress.record(profileId, { mediaId, ...report });

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
