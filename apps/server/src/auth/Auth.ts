import { betterAuth } from 'better-auth'
import type { DBAdapter, DBAdapterInstance } from 'better-auth'
import {
  admin,
  bearer,
  deviceAuthorization,
  genericOAuth,
  jwt,
  openAPI,
  twoFactor,
} from 'better-auth/plugins'
import { apiKey } from '@better-auth/api-key'
import { passkey } from '@better-auth/passkey'
import type { Env } from '@FluxServer/env/Env'

type AuthDatabase = DBAdapter | DBAdapterInstance

type CreateAuthOptions = {
  env: Env
  database: AuthDatabase
}

const FLUX_APP_NAME = 'Flux'

/**
 * Builds the Flux authentication layer.
 *
 * Cookie and origin settings are taken from the parsed environment rather than
 * hard-coded, because a self-hosted instance is reached over plain HTTP on a
 * LAN address as often as over TLS on a domain. Getting this wrong is the
 * single largest source of support load for software of this kind, so it is
 * configuration, never a build-time constant.
 *
 * `bearer` and `jwt` are enabled alongside cookie sessions from the first
 * release. Any capability reachable only by cookie is a capability native
 * clients do not have. See ADR-0004.
 */
const createAuth = ({ env, database }: CreateAuthOptions) => {
  return betterAuth({
    appName: FLUX_APP_NAME,
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
    },
    advanced: {
      useSecureCookies: env.COOKIE_SECURE,
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: env.COOKIE_SECURE,
        httpOnly: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
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
      apiKey(),
      admin(),
      genericOAuth({ config: [] }),
      openAPI({ disableDefaultReference: true }),
    ],
  })
}

type FluxAuth = ReturnType<typeof createAuth>

export type { CreateAuthOptions, FluxAuth, AuthDatabase }

export default { createAuth, FLUX_APP_NAME }
