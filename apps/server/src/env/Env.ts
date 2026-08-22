import { cpus } from 'node:os';
import { z } from 'zod';

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
  TRANSCODER_URL: z.string().min(1).default('unix:/run/valence-transcoder.sock'),
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
 * Reads the process environment into a checked configuration, so a server that is misconfigured
 * fails at startup with a message naming the variable rather than at midnight with a type error.
 *
 * @param source - The process environment.
 * @returns The configuration, validated.
 */
const readEnv = (source: NodeJS.ProcessEnv): Env => EnvSchema.parse(source);

export type { Env };

export { readEnv };
