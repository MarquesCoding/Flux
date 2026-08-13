import { z } from 'zod';
import { PermissionSchema } from './Permission';

/**
 * A key as it can safely be shown again.
 *
 * Everything here can be listed without giving anything away. The key itself
 * is not: it is hashed on the way in and cannot be read back, which is why
 * `start` exists — a few leading characters are enough for somebody to tell
 * which of their keys a row is, and are no use to anybody who steals the list.
 *
 * `lastRequestAt` and `requestCount` are what make a forgotten key findable: a
 * key last used four months ago is one somebody can revoke without wondering
 * what it will break.
 *
 * `permissions` is a restriction, never a grant — a key is its account's
 * permissions narrowed. Null and the empty list differ: null is everything the
 * account may do, and empty is nothing at all.
 *
 * `rateLimit` is null unless somebody asked for one. A household running its
 * own scripts against its own server does not want a limiter it did not ask
 * for; a key handed to something outside the house, or one that has leaked, is
 * where it earns its place — which is why it is per key rather than global.
 */
const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  start: z.string().nullable(),
  enabled: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  lastRequestAt: z.string().datetime().nullable(),
  requestCount: z.number().int().nonnegative(),
  permissions: z.array(PermissionSchema).nullable(),
  rateLimit: z
    .object({ max: z.number().int().positive(), everySeconds: z.number().int().positive() })
    .nullable(),
  createdAt: z.string().datetime(),
});

/**
 * A key at the one moment it can be read.
 *
 * The plaintext is returned by creation and never again, because it is stored
 * hashed. An interface showing this has one job: make it obvious that this is
 * the only time, and make it easy to copy.
 */
const CreatedApiKeySchema = ApiKeySchema.extend({ key: z.string() });

/**
 * Expiry is offered rather than imposed. A key for a script on the same
 * machine has no reason to stop working every ninety days, and a forced expiry
 * on one is an outage nobody scheduled.
 */
const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().max(3650).nullable().default(null),
  permissions: z.array(PermissionSchema).nullable().default(null),
  rateLimit: z
    .object({
      max: z.number().int().positive().max(100_000),
      everySeconds: z.number().int().positive().max(86_400),
    })
    .nullable()
    .default(null),
});

const UpdateApiKeyRequestSchema = z.object({
  enabled: z.boolean(),
});

type ApiKey = z.infer<typeof ApiKeySchema>;
type CreatedApiKey = z.infer<typeof CreatedApiKeySchema>;
type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export type { ApiKey, CreatedApiKey, CreateApiKeyRequest };

export { ApiKeySchema, CreatedApiKeySchema, CreateApiKeyRequestSchema, UpdateApiKeyRequestSchema };
