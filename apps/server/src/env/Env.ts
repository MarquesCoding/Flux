import { cpus } from 'node:os';
import { z } from 'zod';

/**
 * How many files the media service is asked about at once.
 *
 * Each one is an ffmpeg process willing to take every core it is given, so the
 * useful number is well below the core count: half of them, and never more
 * than four, leaves the machine responsive while a library is being worked
 * through. One at a time — which is what this used to be, by omission — leaves
 * most of a machine idle for hours.
 *
 * The media service enforces its own limit as well. This is how many are
 * offered; that is how many are accepted.
 */
const DEFAULT_MEDIA_JOBS = Math.max(1, Math.min(4, Math.floor(cpus().length / 2)));

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
  TRANSCODER_URL: z.string().min(1).default('unix:/run/flux-transcoder.sock'),
  MEDIA_JOBS: z.coerce.number().int().positive().default(DEFAULT_MEDIA_JOBS),
  CATALOGUE_API_KEY: z.string().default(''),
  IMAGE_CACHE_DIR: z.string().default('/cache/images'),
  AUTH_RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
});

type Env = z.infer<typeof EnvSchema>;

/**
 * Parses process environment into a validated configuration object.
 *
 * `TRUSTED_ORIGINS` and `COOKIE_SECURE` are read at runtime rather than baked
 * at build time, because a self-hosted instance is reached over plain HTTP on
 * a LAN address as often as over TLS on a domain. See ADR-0004.
 */
const readEnv = (source: NodeJS.ProcessEnv): Env => EnvSchema.parse(source);

export type { Env };

export { readEnv, EnvSchema };
