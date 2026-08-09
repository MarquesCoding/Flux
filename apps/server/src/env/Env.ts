import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8420),
  DATABASE_URL: z.string().url().default('postgres://flux:flux@localhost:5432/flux'),
  TRUSTED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
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
