import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

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
  user,
  session,
  account,
  verification,
  twoFactor,
  passkey,
  deviceCode,
  jwks,
  apikey,
  userProfile,
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

const fluxSchema = { userProfile }

export default {
  authSchema,
  fluxSchema,
  user,
  session,
  account,
  verification,
  twoFactor,
  passkey,
  deviceCode,
  jwks,
  apikey,
  userProfile,
}
