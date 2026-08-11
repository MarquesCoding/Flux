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
} from 'drizzle-orm/pg-core'

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
})

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
})

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
})

const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

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
})

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
})

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
})

const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('publicKey').notNull(),
  privateKey: text('privateKey').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  expiresAt: timestamp('expiresAt'),
})

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
})

const library = pgTable('library', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  path: text('path').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  lastScannedAt: timestamp('lastScannedAt'),
  defaultAudioLanguage: text('defaultAudioLanguage'),
})

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
    /**
     * The colour this profile is drawn in, as a hex string.
     */
    colour: text('colour').notNull(),
    /**
     * Which drawn avatar this profile wears, if it wears one.
     *
     * The style and the seed rather than the picture: a few bytes that
     * regenerate the same face every time, where a stored image would be
     * kilobytes of something reproducible.
     */
    avatarStyle: text('avatarStyle'),
    avatarSeed: text('avatarSeed'),
    /**
     * Where an uploaded photograph was put, when somebody used their own.
     */
    photoPath: text('photoPath'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [index('viewer_profile_user_idx').on(table.userId)],
)

const watchProgress = pgTable(
  'watch_progress',
  {
    id: text('id').primaryKey(),
    /**
     * Which person this belongs to, rather than which account.
     *
     * Keyed on the profile so that promoting one to an account of its own is a
     * change of owner and nothing else: the viewing follows the person, which
     * is the whole point of being able to move them out.
     */
    profileId: text('profileId')
      .notNull()
      .references(() => viewerProfile.id, { onDelete: 'cascade' }),
    mediaItemId: text('mediaItemId')
      .notNull()
      .references(() => mediaItem.id, { onDelete: 'cascade' }),
    positionSeconds: real('positionSeconds').notNull(),
    durationSeconds: real('durationSeconds').notNull(),
    /**
     * Whether this was watched to the end.
     *
     * Recorded rather than inferred from the position, because someone who
     * stops two minutes from the end has finished it and someone who skips to
     * the last frame has not.
     */
    isFinished: boolean('isFinished').notNull().default(false),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('watch_progress_profile_idx').on(table.profileId, table.mediaItemId),
    index('watch_progress_recent_idx').on(table.profileId, table.updatedAt),
  ],
)

const favourite = pgTable(
  'favourite',
  {
    id: text('id').primaryKey(),
    /**
     * Which person kept it, rather than which account. A household sharing one
     * login does not share a taste in films.
     */
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
)

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
)

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
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    audioStreams: jsonb('audioStreams').notNull(),
    subtitleStreams: jsonb('subtitleStreams').notNull(),
    chapters: jsonb('chapters'),
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
    externalId: text('externalId'),
    addedAt: timestamp('addedAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('media_item_path_idx').on(table.libraryId, table.path),
    index('media_item_library_idx').on(table.libraryId),
    index('media_item_title_idx').on(table.title),
    index('media_item_series_idx').on(table.seriesTitle, table.seasonNumber),
  ],
)

const serverSetting = pgTable('server_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

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
)

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
)

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
})

export {
  library,
  mediaItem,
  mediaSegment,
  mediaItemJob,
  jobTrigger,
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
}

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
}

const fluxSchema = { userProfile, viewerProfile, serverSetting, library, mediaItem }

export default {
  authSchema,
  fluxSchema,
  library,
  mediaItem,
  mediaSegment,
  mediaItemJob,
  jobTrigger,
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
}
