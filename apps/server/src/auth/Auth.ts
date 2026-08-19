import { betterAuth } from 'better-auth';
import type { DBAdapter, DBAdapterInstance } from 'better-auth';
import {
  admin,
  bearer,
  deviceAuthorization,
  genericOAuth,
  jwt,
  openAPI,
  twoFactor,
} from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { passkey } from '@better-auth/passkey';
import { trustedOriginsFor } from '@FluxServer/auth/trustedOriginsFor';
import type { Env } from '@FluxServer/env/Env';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';

type AuthDatabase = DBAdapter | DBAdapterInstance;

type CreateAuthOptions = {
  env: Env;
  database: AuthDatabase;
  settings: SettingsStore;
  cookieSecure: boolean;
  onUserCreated?: (userId: string) => Promise<void>;
  onSignedIn?: (userId: string, at: Date) => Promise<void>;
  onPasswordResetRequested?: (email: string, url: string) => Promise<void>;
};

const FLUX_APP_NAME = 'Flux';

/**
 * Builds the authentication layer: accounts, sessions, cookies, password resets and API keys, wired
 * to Flux's own database and settings. Everything about who somebody is comes from here rather than
 * being reimplemented per route.
 *
 * @param options - The environment, the database, the settings store, whether cookies are secure,
 * and the hooks fired when an account is made, signs in, or asks for a reset.
 * @returns The authentication layer.
 */
const createAuth = ({
  env,
  database,
  settings,
  cookieSecure,
  onUserCreated,
  onSignedIn,
  onPasswordResetRequested,
}: CreateAuthOptions) => {
  return betterAuth({
    appName: FLUX_APP_NAME,
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: trustedOriginsFor({
      configured: env.TRUSTED_ORIGINS,
      port: env.PORT,
      settings,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => {
        await onPasswordResetRequested?.(user.email, url);
      },
    },
    advanced: {
      useSecureCookies: cookieSecure,
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: cookieSecure,
        httpOnly: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            await onUserCreated?.(created.id);
          },
        },
      },
      session: {
        create: {
          after: async (created) => {
            await onSignedIn?.(created.userId, new Date());
          },
        },
      },
    },
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT_ENABLED,
      window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: env.AUTH_RATE_LIMIT_MAX,
    },
    plugins: [
      twoFactor({ issuer: FLUX_APP_NAME }),
      passkey({ rpName: FLUX_APP_NAME }),
      deviceAuthorization({ expiresIn: '10m', interval: '5s' }),
      bearer(),
      jwt(),
      apiKey({ enableSessionForAPIKeys: true }),
      admin(),
      genericOAuth({ config: [] }),
      openAPI({ disableDefaultReference: true }),
    ],
  });
};

type FluxAuth = ReturnType<typeof createAuth>;

export type { FluxAuth };

export { createAuth };
