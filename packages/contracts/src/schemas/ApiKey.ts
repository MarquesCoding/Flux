import { z } from 'zod';
import { PermissionSchema } from './Permission';

/**
 * A key as it can safely be shown again.
 *
 * Everything here can be listed without giving anything away. The key itself
 * is not: it is hashed on the way in and cannot be read back, which is why
 * `start` exists — a few leading characters are enough for somebody to tell
 * which of their keys a row is, and are no use to anybody who steals the list.
 */
const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  /**
   * The first few characters of the key, for telling one row from another.
   */
  start: z.string().nullable(),
  enabled: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  /**
   * When this key was last used, and how many times it has been.
   *
   * What makes a forgotten key findable. A key last used four months ago is
   * one somebody can revoke without wondering what it will break.
   */
  lastRequestAt: z.string().datetime().nullable(),
  requestCount: z.number().int().nonnegative(),
  /**
   * What this key is restricted to, or null for the whole of its account.
   *
   * Restriction only: a key is its account's permissions narrowed, never
   * widened, so naming something the account does not hold grants nothing.
   * Null and the empty list are different — null is "everything the account
   * may do", and empty is "nothing at all".
   */
  permissions: z.array(PermissionSchema).nullable(),
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

const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
  /**
   * How many days until it expires, or null to never expire.
   *
   * Offered rather than imposed. A key for a script on the same machine has no
   * reason to stop working every ninety days, and a forced expiry on one is an
   * outage nobody scheduled.
   */
  expiresInDays: z.number().int().positive().max(3650).nullable().default(null),
  permissions: z.array(PermissionSchema).nullable().default(null),
});

const UpdateApiKeyRequestSchema = z.object({
  enabled: z.boolean(),
});

type ApiKey = z.infer<typeof ApiKeySchema>;
type CreatedApiKey = z.infer<typeof CreatedApiKeySchema>;
type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export type { ApiKey, CreatedApiKey, CreateApiKeyRequest };

export {
  ApiKeySchema,
  CreatedApiKeySchema,
  CreateApiKeyRequestSchema,
  UpdateApiKeyRequestSchema,
};
