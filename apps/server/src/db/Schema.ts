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
    index('media_item_cast_idx').using('gin', table.castMembers),
    index('media_item_series_idx').on(table.seriesTitle, table.seasonNumber),
    index('media_item_series_id_idx').on(table.seriesId, table.seasonNumber),
  ],
);

const serverSetting = pgTable('server_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

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
