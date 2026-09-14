import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth } from './Auth';
import type { ValenceAuth } from './Auth';
import { readEnv } from '@ValenceServer/env/Env';
import type { Env } from '@ValenceServer/env/Env';
import { createMemorySettingsStore } from '@ValenceServer/settings/createMemorySettingsStore';
import type { SettingsStore } from '@ValenceServer/settings/ServerSettings';

const TEST_SECRET = 'valence-test-secret-value-at-least-32-chars';

type MemoryUserRow = { id: string; role?: string };

type MemorySessionRow = { id: string; token: string; ipAddress?: string | null };

/**
 * Builds the empty tables the in-memory auth adapter works against, one per table the auth library
 * expects to find, so that a fresh store is a fresh store rather than one carrying the last test's
 * rows.
 *
 * @returns The tables, all empty.
 */
const emptyStore = (): {
  user: MemoryUserRow[];
  session: MemorySessionRow[];
  account: never[];
  verification: never[];
  twoFactor: never[];
  passkey: never[];
  deviceCode: never[];
  jwks: never[];
  apikey: never[];
} => ({
  user: [],
  session: [],
  account: [],
  verification: [],
  twoFactor: [],
  passkey: [],
  deviceCode: [],
  jwks: [],
  apikey: [],
});

/**
 * Builds an authentication layer and settings store held in memory, so the HTTP surface can be
 * tested without Postgres. Models the behaviour the routes depend on — signing up, signing in,
 * sessions, missing accounts — and nothing else.
 *
 * @param overrides - Anything to start with, such as accounts that already exist.
 * @returns The authentication layer, its settings store, and the state behind them.
 */
const createMemoryAuth = (
  overrides: Partial<NodeJS.ProcessEnv> = {},
): {
  auth: ValenceAuth;
  settings: SettingsStore;
  profiles: string[];
  resetLinks: { email: string; url: string }[];
  store: ReturnType<typeof emptyStore>;
} => {
  const profiles: string[] = [];
  const resetLinks: { email: string; url: string }[] = [];
  const store = emptyStore();

  const env: Env = readEnv({
    BETTER_AUTH_SECRET: TEST_SECRET,
    BETTER_AUTH_URL: 'http://localhost:8420',
    TRUSTED_ORIGINS: 'http://localhost:8420,http://localhost:5173',
    AUTH_RATE_LIMIT_ENABLED: 'false',
    ...overrides,
  });

  const settings = createMemorySettingsStore({
    trustedOrigins: env.TRUSTED_ORIGINS,
    cookieSecure: env.COOKIE_SECURE,
    setupCompletedAt: null,
    catalogueApiKey: '',
    hardwareAccel: '',
    previewQuality: 'high',
    showsProfilesBeforeSignIn: true,
    seededJobTriggerKinds: [],
    seededRoleNames: [],
    pushPublicKey: '',
    pushPrivateKey: '',
    mediaDigestReadTo: null,
    jobsTimezone: '',
  });

  const auth = createAuth({
    env,
    database: memoryAdapter(store),
    settings,
    cookieSecure: env.COOKIE_SECURE,
    onUserCreated: (userId) => {
      profiles.push(userId);

      return Promise.resolve();
    },
    onPasswordResetRequested: (email, url) => {
      resetLinks.push({ email, url });

      return Promise.resolve();
    },
  });

  return { auth, settings, profiles, resetLinks, store };
};

export { createMemoryAuth };
