import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth } from './Auth';
import type { FluxAuth } from './Auth';
import { readEnv } from '@FluxServer/env/Env';
import type { Env } from '@FluxServer/env/Env';
import { createMemorySettingsStore } from '@FluxServer/settings/createMemorySettingsStore';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';

const TEST_SECRET = 'flux-test-secret-value-at-least-32-chars';

/**
 * A signed-up user, as the memory adapter stores it.
 *
 * Typed with `role` rather than left to inference, so a test can promote a
 * user to admin (`store.user[0].role = 'admin'`) without a cast.
 */
type MemoryUserRow = { id: string; role?: string };

/**
 * An open session, as the memory adapter stores it.
 *
 * Typed for the same reason the user row is: a test about what the devices
 * list shows has to be able to say a session came from an address, and the
 * adapter only records one when a request carried it.
 */
type MemorySessionRow = { id: string; token: string; ipAddress?: string | null };

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
 * Builds an in-memory authentication layer and its settings store.
 *
 * Used by tests so that the suite never requires a running Postgres. The
 * configuration is otherwise identical to production, so cookie and origin
 * behaviour is exercised rather than stubbed.
 */
const createMemoryAuth = (
  overrides: Partial<NodeJS.ProcessEnv> = {},
): {
  auth: FluxAuth;
  settings: SettingsStore;
  profiles: string[];
  resetLinks: { email: string; url: string }[];
  /**
   * The raw in-memory rows behind `auth`.
   *
   * Exposed so a test can promote a signed-up user to admin directly
   * (`store.user[0].role = 'admin'`) without a real database to run
   * `promoteToAdmin` against.
   */
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
    seededJobTriggerKinds: [],
    seededRoleNames: [],
    pushPublicKey: '',
    pushPrivateKey: '',
    mediaDigestReadTo: null,
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

export { createMemoryAuth, TEST_SECRET };
