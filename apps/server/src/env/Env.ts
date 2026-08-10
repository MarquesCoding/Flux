import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8420),
  DATABASE_URL: z.string().url().default('postgres://flux:flux@localhost:5432/flux'),
  BETTER_AUTH_SECRET: z.string().min(32).default('development-secret-change-me-in-production'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:8420'),
  TRUSTED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Either `unix:/path/to.sock` or an `http://` address. A socket is the
  // default because the media service has no authentication of its own and
  // should not be reachable from the network. See ADR-0006.
  TRANSCODER_URL: z.string().min(1).default('unix:/run/flux-transcoder.sock'),
  /**
   * A starting value for the metadata catalogue key.
   *
   * Settings win once an operator has saved one, so this is only the initial
   * value for a fresh install driven entirely by environment.
   */
  CATALOGUE_API_KEY: z.string().default(''),
  IMAGE_CACHE_DIR: z.string().default('/cache/images'),
  AUTH_RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
})

type Env = z.infer<typeof EnvSchema>

/**
 * Parses process environment into a validated configuration object.
 *
 * `TRUSTED_ORIGINS` and `COOKIE_SECURE` are read at runtime rather than baked
 * at build time, because a self-hosted instance is reached over plain HTTP on
 * a LAN address as often as over TLS on a domain. See ADR-0004.
 */
const readEnv = (source: NodeJS.ProcessEnv): Env => EnvSchema.parse(source)

export type { Env }

export default { readEnv, EnvSchema }
