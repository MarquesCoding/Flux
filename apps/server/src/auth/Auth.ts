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
import { ownOrigins } from '@FluxServer/env/ownOrigins'
import type { Env } from '@FluxServer/env/Env'
import type { SettingsStore } from '@FluxServer/settings/ServerSettings'

type AuthDatabase = DBAdapter | DBAdapterInstance

type CreateAuthOptions = {
  env: Env
  database: AuthDatabase
  settings: SettingsStore
  cookieSecure: boolean
  /// Called after a user is created, so Flux can give them a profile row.
  onUserCreated?: (userId: string) => Promise<void>
  /// Called when someone asks to reset a password.
  ///
  /// Given the reset URL rather than sending mail, because a self-hosted
  /// instance usually has no mail server. The administrator hands the link
  /// over, or reads it from the log.
  onPasswordResetRequested?: (email: string, url: string) => Promise<void>
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
const createAuth = ({
  env,
  database,
  settings,
  cookieSecure,
  onUserCreated,
  onPasswordResetRequested,
}: CreateAuthOptions) => {
  return betterAuth({
    appName: FLUX_APP_NAME,
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // What has been configured, and wherever this machine can be reached.
    // Asked on every request rather than read once, so an address handed out
    // by a router after the server started is trusted without a restart.
    trustedOrigins: async () => {
      const configured = (await settings.read()).trustedOrigins

      return [...configured, ...ownOrigins(configured, env.PORT)]
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      // A self-hosted server usually has no mail configured, so a reset link
      // would go nowhere. Recovery therefore runs through the administrator,
      // who is standing next to the machine. The alternative — no recovery at
      // all — means one forgotten password loses the account permanently.
      sendResetPassword: async ({ user, url }) => {
        await onPasswordResetRequested?.(user.email, url)
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
          // Every user gets a profile row the moment they exist, so nothing
          // downstream has to cope with a user who has none. Playback
          // preferences and request quotas both hang off it.
          after: async (created) => {
            await onUserCreated?.(created.id)
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
      apiKey(),
      admin(),
      genericOAuth({ config: [] }),
      openAPI({ disableDefaultReference: true }),
    ],
  })
}

type FluxAuth = ReturnType<typeof createAuth>

export type { CreateAuthOptions, FluxAuth, AuthDatabase }

export { createAuth, FLUX_APP_NAME }
