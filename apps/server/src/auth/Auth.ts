import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { z } from 'zod';
import type { DBAdapter, DBAdapterInstance } from 'better-auth';
import type { SignInAttempt } from '@ValenceServer/auth/describeSignInAttempt';
import {
  admin,
  deviceAuthorization,
  genericOAuth,
  jwt,
  openAPI,
  twoFactor,
} from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { passkey } from '@better-auth/passkey';
import { trustedOriginsFor } from '@ValenceServer/auth/trustedOriginsFor';
import type { Env } from '@ValenceServer/env/Env';
import type { SettingsStore } from '@ValenceServer/settings/ServerSettings';

type AuthDatabase = DBAdapter | DBAdapterInstance;

type CreateAuthOptions = {
  env: Env;
  database: AuthDatabase;
  settings: SettingsStore;
  cookieSecure: boolean;
  onUserCreated?: (userId: string) => Promise<void>;
  onSignedIn?: (userId: string, at: Date) => Promise<void>;
  onPasswordResetRequested?: (email: string, url: string) => Promise<void>;
  onSignInSettled?: (attempt: SignInAttempt) => void;
};

const IdentifierSchema = z
  .object({ email: z.string().optional(), username: z.string().optional() })
  .partial();

const RefusalSchema = z.instanceof(APIError);

const VALENCE_APP_NAME = 'Valence';

/**
 * Builds the authentication layer: accounts, sessions, cookies, password resets and API keys, wired
 * to Valence's own database and settings. Everything about who somebody is comes from here rather than
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
  onSignInSettled,
}: CreateAuthOptions) => {
  return betterAuth({
    appName: VALENCE_APP_NAME,
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
    hooks: {
      after: createAuthMiddleware(async (context) => {
        if (onSignInSettled === undefined) {
          return;
        }

        const refusal = RefusalSchema.safeParse(context.context.returned);
        const identifier = IdentifierSchema.safeParse(context.body);
        const session = context.context.newSession;

        onSignInSettled({
          path: context.path,
          statusCode: refusal.success ? refusal.data.statusCode : null,
          account: session === null ? null : { id: session.user.id, name: session.user.name },
          identifier: identifier.success
            ? (identifier.data.email ?? identifier.data.username ?? null)
            : null,
          userAgent: context.headers?.get('user-agent') ?? null,
          address: context.headers?.get('x-forwarded-for') ?? null,
        });

        await Promise.resolve();
      }),
    },
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT_ENABLED,
      window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: env.AUTH_RATE_LIMIT_MAX,
    },
    plugins: [
      twoFactor({ issuer: VALENCE_APP_NAME }),
      passkey({ rpName: VALENCE_APP_NAME }),
      deviceAuthorization({ expiresIn: '10m', interval: '5s' }),
      jwt(),
      apiKey({ enableSessionForAPIKeys: true }),
      admin(),
      genericOAuth({ config: [] }),
      openAPI({ disableDefaultReference: true }),
    ],
  });
};

type ValenceAuth = ReturnType<typeof createAuth>;

export type { ValenceAuth };

export { createAuth };
