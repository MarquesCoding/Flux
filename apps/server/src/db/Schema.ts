import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  twoFactorEnabled: boolean('twoFactorEnabled').default(false),
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires'),
});

/**
 * What an account has done, as facts that outlive the rows they came from.
 *
 * Beside better-auth's `user` rather than inside it, for the same reason the
 * role tables are: better-auth owns that table and Flux writing to it makes
 * every upgrade a question about whose column is whose.
 *
 * `lastSignInAt` exists because the obvious source for it does not survive.
 * `session.createdAt` looks like the answer, but the nightly cleanup deletes
 * every expired session — correctly, since better-auth checks expiry at read
 * time and never reclaims the table itself. Deriving a statistic from rows
 * designed to be temporary means the statistic disappears on a schedule, so
 * the fact of a sign-in is recorded when it happens and kept separately.
 */
const accountActivity = pgTable('account_activity', {
  userId: text('userId')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  lastSignInAt: timestamp('lastSignInAt').notNull().defaultNow(),
  signInCount: integer('signInCount').notNull().default(0),
});

const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: text('impersonatedBy'),
});

const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull(),
});

const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

const twoFactor = pgTable('twoFactor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  verified: boolean('verified').default(false),
  failedVerificationCount: integer('failedVerificationCount').default(0),
  lockedUntil: timestamp('lockedUntil'),
});

const passkey = pgTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('publicKey').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credentialID').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('deviceType').notNull(),
  backedUp: boolean('backedUp').notNull(),
  transports: text('transports'),
  createdAt: timestamp('createdAt'),
  aaguid: text('aaguid'),
});

const deviceCode = pgTable('deviceCode', {
  id: text('id').primaryKey(),
  deviceCode: text('deviceCode').notNull(),
  userCode: text('userCode').notNull(),
  userId: text('userId'),
  expiresAt: timestamp('expiresAt').notNull(),
  status: text('status').notNull(),
  lastPolledAt: timestamp('lastPolledAt'),
  pollingInterval: integer('pollingInterval'),
  clientId: text('clientId'),
  scope: text('scope'),
});

const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('publicKey').notNull(),
  privateKey: text('privateKey').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  expiresAt: timestamp('expiresAt'),
});

const apikey = pgTable('apikey', {
  id: text('id').primaryKey(),
  configId: text('configId').notNull(),
  name: text('name'),
  start: text('start'),
  referenceId: text('referenceId').notNull(),
  prefix: text('prefix'),
  key: text('key').notNull(),
  refillInterval: integer('refillInterval'),
  refillAmount: integer('refillAmount'),
  lastRefillAt: timestamp('lastRefillAt'),
  enabled: boolean('enabled').default(true),
  rateLimitEnabled: boolean('rateLimitEnabled').default(true),
  rateLimitTimeWindow: integer('rateLimitTimeWindow'),
  rateLimitMax: integer('rateLimitMax'),
  requestCount: integer('requestCount').default(0),
  remaining: integer('remaining'),
  lastRequest: timestamp('lastRequest'),
  expiresAt: timestamp('expiresAt'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  permissions: text('permissions'),
  metadata: text('metadata'),
});

/**
 * A directory of media Flux watches, and how it should be read.
 *
 * `generation` counts how many times the library has been reset. It is folded
 * into the address of every preview and thumbnail sheet its items produce, which
 * is what makes a reset rebuild them: those artefacts are addressed by their
 * content, so a reset that only deleted rows left every address unchanged and
 * reused the lot — a rebuild that finished in a millisecond an item and redrew
 * nothing.
 *
 * Raising it renames rather than deletes, so old files are orphaned rather than
 * removed. Reclaiming them is a sweep of its own: deleting on the strength of a
 * computed list of live ids risks taking artefacts that are still wanted.
 */
const library = pgTable('library', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  path: text('path').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  lastScannedAt: timestamp('lastScannedAt'),
  lastScanAdded: integer('lastScanAdded'),
  lastScanUpdated: integer('lastScanUpdated'),
  lastScanRemoved: integer('lastScanRemoved'),
  lastScanFailed: integer('lastScanFailed'),
  defaultAudioLanguage: text('defaultAudioLanguage'),
  filesAtOnce: integer('filesAtOnce'),
  generation: integer('generation').notNull().default(0),
});

/**
 * One viewer within an account.
 *
 * A household shares an account and does not share a taste: what one person
 * half watched is noise on somebody else's home page. Progress is recorded
 * against a profile rather than against the account for that reason.
 *
 * Deliberately not a login. These are not security boundaries — anyone holding
 * the account can pick any of them — they are a way of keeping several
 * people's viewing apart, which is what a household actually needs.
 */
const viewerProfile = pgTable(
  'viewer_profile',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    colour: text('colour').notNull(),
    avatarStyle: text('avatarStyle'),
    avatarSeed: text('avatarSeed'),
    photoPath: text('photoPath'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [index('viewer_profile_user_idx').on(table.userId)],
);

/**
 * What somebody has watched, as events rather than as a position.
 *
 * Alongside `watch_progress` rather than replacing it. That table is the
 * resume pointer — one row per profile and item, overwritten every time, read
 * on every card and every detail page — and turning it into the latest row of
 * a log would make a hot path slower for nothing.
 *
 * This answers the questions it cannot: what was watched last month, whether
 * something has been seen before, and how long was actually spent on it.
 *
 * `secondsWatched` is on the row from the start deliberately. Usage figures
 * aggregate these events and cannot do it without a duration, and adding the
 * column later would make every event recorded in the meantime useless for it.
 * It is accumulated honestly rather than taken from wall-clock time — a pause
 * is not watching and a skipped intro is not watched.
 *
 * One log, not two. Statistics and history are the same facts asked different
 * questions, and a second parallel table would guarantee the two disagree.
 */
const watchHistory = pgTable(
  'watch_history',
  {
    id: text('id').primaryKey(),
    profileId: text('profileId')
      .notNull()
      .references(() => viewerProfile.id, { onDelete: 'cascade' }),
    mediaItemId: text('mediaItemId')
      .notNull()
      .references(() => mediaItem.id, { onDelete: 'cascade' }),
    startedAt: timestamp('startedAt').notNull().defaultNow(),
    lastWatchedAt: timestamp('lastWatchedAt').notNull().defaultNow(),
    secondsWatched: real('secondsWatched').notNull().default(0),
    isFinished: boolean('isFinished').notNull().default(false),
  },
  (table) => [
    index('watch_history_recent_idx').on(table.profileId, table.lastWatchedAt),
    index('watch_history_item_idx').on(table.mediaItemId),
  ],
);

const watchProgress = pgTable(
  'watch_progress',
  {
    id: text('id').primaryKey(),
    profileId: text('profileId')
      .notNull()
      .references(() => viewerProfile.id, { onDelete: 'cascade' }),
    mediaItemId: text('mediaItemId')
      .notNull()
      .references(() => mediaItem.id, { onDelete: 'cascade' }),
    positionSeconds: real('positionSeconds').notNull(),
    durationSeconds: real('durationSeconds').notNull(),
    isFinished: boolean('isFinished').notNull().default(false),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('watch_progress_profile_idx').on(table.profileId, table.mediaItemId),
    index('watch_progress_recent_idx').on(table.profileId, table.updatedAt),
  ],
);

const favourite = pgTable(
  'favourite',
  {
    id: text('id').primaryKey(),
    profileId: text('profileId')
      .notNull()
      .references(() => viewerProfile.id, { onDelete: 'cascade' }),
    mediaItemId: text('mediaItemId')
      .notNull()
      .references(() => mediaItem.id, { onDelete: 'cascade' }),
    keptAt: timestamp('keptAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('favourite_profile_idx').on(table.profileId, table.mediaItemId),
    index('favourite_recent_idx').on(table.profileId, table.keptAt),
  ],
);

const mediaSegment = pgTable(
  'media_segment',
  {
    id: text('id').primaryKey(),
    mediaItemId: text('mediaItemId')
      .notNull()
      .references(() => mediaItem.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    startSeconds: real('startSeconds').notNull(),
    endSeconds: real('endSeconds').notNull(),
    source: text('source').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('media_segment_kind_idx').on(table.mediaItemId, table.kind),
    index('media_segment_item_idx').on(table.mediaItemId),
  ],
);

/**
 * A correction somebody made to what a file is.
 *
 * Keyed by path rather than by media item, and deliberately: `reset` deletes
 * every row in `media_item` and scans the library again from nothing, and an
 * operator reaching for reset is usually doing so because the metadata is a
 * mess — which is exactly when they have the most corrections to lose. A
 * correction hanging off an item id would be destroyed by the one action most
 * likely to be taken by somebody who needs it.
 *
 * The cost of that choice is that renaming a file orphans its correction. That
 * is the better failure: a rename is deliberate and rare, a reset is a button.
 *
 * `externalKind` travels with `externalId` because the ids are only unique
 * within a kind — the same number addresses unrelated titles under films and
 * under series — so an id without its kind resolves to something absurd.
 * `updatedBy` is who last changed it, so "why does this say that" has an
 * answer.
 */
const mediaOverride = pgTable(
  'media_override',
  {
    id: text('id').primaryKey(),
    libraryId: text('libraryId')
      .notNull()
      .references(() => library.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    externalId: text('externalId').notNull(),
    externalKind: text('externalKind').notNull(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    updatedBy: text('updatedBy'),
  },
  (table) => [
    uniqueIndex('media_override_path_idx').on(table.libraryId, table.path),
    index('media_override_library_idx').on(table.libraryId),
  ],
);

/**
 * A programme, as a thing rather than as a string repeated across its episodes.
 *
 * Exists because a title is neither unique nor stable. Two programmes share one
 * — The Office, Shameless, Skins, and every remake — and anything keyed on the
 * title treats them as one; meanwhile the title itself is rewritten on every
 * scan from whatever the catalogue answered, so correcting a bad match detaches
 * everything that pointed at the old one.
 *
 * `key` is how a scan recognises the same programme again: the catalogue's id
 * where there is one, the folder otherwise. `title` is display text and may
 * change freely without anything losing hold of the row.
 */
const series = pgTable(
  'series',
  {
    id: text('id').primaryKey(),
    libraryId: text('libraryId')
      .notNull()
      .references(() => library.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    title: text('title').notNull(),
    externalId: text('externalId'),
    addedAt: timestamp('addedAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('series_key_idx').on(table.libraryId, table.key),
    index('series_library_idx').on(table.libraryId),
  ],
);

const mediaItem = pgTable(
  'media_item',
  {
    id: text('id').primaryKey(),
    libraryId: text('libraryId')
      .notNull()
      .references(() => library.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    sizeBytes: bigint('sizeBytes', { mode: 'number' }).notNull(),
    modifiedAtMs: bigint('modifiedAtMs', { mode: 'number' }).notNull(),
    container: text('container').notNull(),
    durationSeconds: real('durationSeconds').notNull(),
    bitrateKbps: integer('bitrateKbps'),
    videoCodec: text('videoCodec').notNull(),
    videoRange: text('videoRange').notNull(),
    videoBitDepth: integer('videoBitDepth'),
    canCopySegments: boolean('canCopySegments'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    audioStreams: jsonb('audioStreams').notNull(),
    subtitleStreams: jsonb('subtitleStreams').notNull(),
    chapters: jsonb('chapters'),
    seriesId: text('seriesId').references(() => series.id, { onDelete: 'set null' }),
    seriesTitle: text('seriesTitle'),
    seasonNumber: integer('seasonNumber'),
    episodeNumber: integer('episodeNumber'),
    overview: text('overview'),
    tagline: text('tagline'),
    genres: jsonb('genres'),
    castMembers: jsonb('castMembers'),
    rating: real('rating'),
    posterUrl: text('posterUrl'),
    backdropUrl: text('backdropUrl'),
    logoUrl: text('logoUrl'),
    externalId: text('externalId'),
    addedAt: timestamp('addedAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('media_item_path_idx').on(table.libraryId, table.path),
    index('media_item_library_idx').on(table.libraryId),
    index('media_item_title_idx').on(table.title),
    index('media_item_genres_idx').using('gin', table.genres),
    index('media_item_series_idx').on(table.seriesTitle, table.seasonNumber),
    index('media_item_series_id_idx').on(table.seriesId, table.seasonNumber),
  ],
);

const serverSetting = pgTable('server_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

/**
 * Which per-file work has already been done for an item.
 *
 * The scanner knows a file is unchanged from its size and modification time,
 * but that says nothing about whether its preview was ever drawn, its
 * thumbnail sheet rendered, or its intro found — work that can fail on its
 * own while the file sits there looking perfectly scanned. Without a record
 * of what finished, a job either redoes the whole library or never retries
 * anything, and Flux had both problems at once.
 *
 * A row per item per kind rather than a column per job, so a job added later
 * needs no migration. Rows are deleted whenever the file changes: a new cut
 * of the same episode invalidates every derived thing about it.
 */
const mediaItemJob = pgTable(
  'media_item_job',
  {
    mediaItemId: text('mediaItemId')
      .notNull()
      .references(() => mediaItem.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    completedAt: timestamp('completedAt').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.mediaItemId, table.kind] }),
    index('media_item_job_kind_idx').on(table.kind),
  ],
);

/**
 * What makes a background job run on its own.
 *
 * Flux's own record rather than pg-boss's schedule table: a job holds a list
 * of triggers, one of which — running at startup — is not a cron expression
 * at all and has nowhere to live in pg-boss. Holding every trigger here keeps
 * one source of truth, and lets the stored shape round-trip exactly instead
 * of being parsed back out of cron. The cron-shaped ones are pushed into
 * pg-boss from here — see `createJobScheduleService`.
 */
const jobTrigger = pgTable(
  'job_trigger',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    trigger: jsonb('trigger').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [index('job_trigger_kind_idx').on(table.kind)],
);

/**
 * A named set of capabilities the operator defined.
 *
 * Roles are made at runtime rather than fixed in code, which is why they live
 * here instead of in better-auth: its access control expects roles declared
 * statically, and an operator inventing "Housemate" on a Tuesday cannot be.
 * better-auth stays the authentication layer; Flux owns what a role means.
 *
 * `position` orders roles against each other, and the order is what makes
 * managing them safe. Without it, "may manage roles" quietly means "may make
 * myself an administrator".
 */
/**
 * Somewhere an operator has asked to be told about things.
 *
 * `secret` is stored in the clear, unlike an API key's hash, and the
 * difference is not an oversight: a key is verified, so a hash is enough,
 * while a signature has to be *produced* on every delivery and cannot be
 * computed from a digest of itself. It is read only by the delivery job and
 * never leaves the server — no route returns it after the one response that
 * creates it.
 *
 * The last attempt is kept on the row rather than as a log of every delivery.
 * The question an operator has is "is this still working", not "what happened
 * on the fourteenth", and a webhook that quietly stopped working is worse than
 * no webhook at all. A full delivery history is a different feature with a
 * different retention problem.
 */
const webhookSubscription = pgTable(
  'webhook_subscription',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    preset: text('preset').notNull().default('generic'),
    events: jsonb('events').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    lastAttemptAt: timestamp('lastAttemptAt'),
    lastStatus: integer('lastStatus'),
    lastError: text('lastError'),
  },
  (table) => [index('webhook_subscription_enabled_idx').on(table.enabled)],
);

/**
 * What was sent where, and how it went.
 *
 * The subscription already carries its last attempt, which answers "is this
 * still working". This answers the question after it: a receiver that fails
 * one delivery in five looks identical, on the subscription alone, to one
 * that has never failed, because the last attempt is only ever the most
 * recent thing that happened.
 *
 * A row per delivery rather than per attempt. The envelope's id names the
 * occurrence, not the try, so a retry finds its own row and increments
 * `attempts` — which keeps the stored body written once and makes "was down
 * briefly" legible as something other than repeated failure.
 *
 * `body` is the exact bytes that were signed, kept so a delivery can be sent
 * again unchanged. Re-encoding the event instead would produce a different
 * signature from the one the receiver first saw, and would defeat the
 * deduplication the envelope's id exists to allow.
 *
 * Rows are pruned on a schedule — see `PRUNE_WEBHOOK_DELIVERIES_JOB`. Without
 * that this is a table with a row per event per subscriber for as long as the
 * server has run, read approximately never.
 */
const webhookDelivery = pgTable(
  'webhook_delivery',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscriptionId')
      .notNull()
      .references(() => webhookSubscription.id, { onDelete: 'cascade' }),
    eventId: text('eventId').notNull(),
    event: text('event').notNull(),
    body: text('body').notNull(),
    attempts: integer('attempts').notNull().default(1),
    firstAttemptAt: timestamp('firstAttemptAt').notNull().defaultNow(),
    lastAttemptAt: timestamp('lastAttemptAt').notNull().defaultNow(),
    ok: boolean('ok').notNull().default(false),
    status: integer('status'),
    error: text('error'),
  },
  (table) => [
    uniqueIndex('webhook_delivery_occurrence_idx').on(table.subscriptionId, table.eventId),
    index('webhook_delivery_recent_idx').on(table.subscriptionId, table.lastAttemptAt),
    index('webhook_delivery_pruning_idx').on(table.lastAttemptAt),
  ],
);

/**
 * Something the household has been told.
 *
 * The sentence is stored rather than rebuilt on read. A digest knows things
 * the reader does not — how many episodes, of how many programmes — and
 * freezing it at the moment it was true means a notification read next week
 * still says what it said, instead of being re-rendered against a library
 * that has moved on.
 *
 * Per account rather than per viewer profile. Profiles are how a household
 * separates what it has watched; a notification is addressed to somebody who
 * signs in, and the devices push reaches belong to the account too.
 */
const notification = pgTable(
  'notification',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    readAt: timestamp('readAt'),
  },
  (table) => [
    index('notification_unread_idx').on(table.userId, table.readAt),
    index('notification_recent_idx').on(table.userId, table.createdAt),
  ],
);

/**
 * How one account wants to be told about one kind of event.
 *
 * A row only where somebody has chosen something. An absent row means the
 * default, which keeps a table of one row per account per event from existing
 * for a household that never opened the settings.
 */
const notificationPreference = pgTable(
  'notification_preference',
  {
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    inApp: boolean('inApp').notNull().default(true),
    push: boolean('push').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.event] })],
);

/**
 * One browser that has agreed to be interrupted.
 *
 * The endpoint is the push service's address for this browser and is what
 * identifies it — a person with a phone and a laptop has two rows, and
 * reinstalling the app makes a third rather than replacing one, because the
 * old endpoint stays valid until the push service says otherwise.
 *
 * A subscription that the push service rejects as gone is deleted rather than
 * retried. Unlike a webhook, there is no operator to tell: the browser has
 * been uninstalled or the permission revoked, and nothing about it will start
 * working again.
 */
const pushSubscription = pgTable(
  'push_subscription',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('push_subscription_endpoint_idx').on(table.endpoint),
    index('push_subscription_user_idx').on(table.userId),
  ],
);

const role = pgTable(
  'role',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('role_name_idx').on(table.name)],
);

const rolePermission = pgTable(
  'role_permission',
  {
    roleId: text('roleId')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permission] })],
);

const userRole = pgTable(
  'user_role',
  {
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: text('roleId')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('grantedAt').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index('user_role_role_idx').on(table.roleId),
  ],
);

/**
 * What was said about one account in particular.
 *
 * For the exception that does not justify a role of its own. `effect` is
 * `allow` or `deny`, and deny wins over every grant anywhere — see
 * `resolvePermissions`, which is where that rule is actually applied.
 */
const userPermissionOverride = pgTable(
  'user_permission_override',
  {
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    effect: text('effect').notNull(),
    grantedAt: timestamp('grantedAt').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.permission] })],
);

const userProfile = pgTable('user_profile', {
  userId: text('userId')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text('displayName'),
  preferredAudioLanguage: text('preferredAudioLanguage'),
  preferredSubtitleLanguage: text('preferredSubtitleLanguage'),
  requestQuotaPerWeek: integer('requestQuotaPerWeek').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

const authSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  passkey,
  deviceCode,
  jwks,
  apikey,
};

const fluxSchema = { userProfile, viewerProfile, serverSetting, library, mediaItem };

export {
  accountActivity,
  watchHistory,
  series,
  authSchema,
  fluxSchema,
  library,
  mediaOverride,
  mediaItem,
  mediaSegment,
  mediaItemJob,
  jobTrigger,
  webhookSubscription,
  webhookDelivery,
  notification,
  notificationPreference,
  pushSubscription,
  watchProgress,
  favourite,
  user,
  session,
  account,
  verification,
  twoFactor,
  passkey,
  deviceCode,
  jwks,
  serverSetting,
  apikey,
  userProfile,
  viewerProfile,
  role,
  rolePermission,
  userRole,
  userPermissionOverride,
};
