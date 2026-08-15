import { z } from 'zod';
import { PermissionSchema } from '@FluxContracts/schemas/Permission';
import type { ApiKeyService } from './ApiKeyService';
import type { FluxAuth } from './Auth';
import type { ApiKey } from '@FluxContracts/schemas/ApiKey';
import type { Permission } from '@FluxContracts/schemas/Permission';

const NAMESPACE = 'flux';

const A_DAY = 86_400_000;

const RowSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  start: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  enabled: z
    .boolean()
    .nullish()
    .transform((value) => value !== false),
  expiresAt: z.union([z.date(), z.string()]).nullish(),
  lastRequest: z.union([z.date(), z.string()]).nullish(),
  requestCount: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  rateLimitEnabled: z.boolean().nullish(),
  rateLimitMax: z.number().nullish(),
  rateLimitTimeWindow: z.number().nullish(),
  permissions: z.record(z.string(), z.array(z.string())).nullish(),
  createdAt: z.union([z.date(), z.string()]),
});

const asIsoString = (value: Date | string | null | undefined): string =>
  value instanceof Date ? value.toISOString() : (value ?? '');

/**
 * Reads the Flux permissions off a key.
 */
const readPermissions = (raw: Record<string, string[]> | null | undefined): Permission[] | null => {
  const named = raw?.[NAMESPACE];

  if (named === undefined) {
    return null;
  }

  return named.flatMap((one) => {
    const parsed = PermissionSchema.safeParse(one);

    return parsed.success ? [parsed.data] : [];
  });
};

/**
 * Keys, kept where better-auth already keeps them.
 */
const createBetterAuthApiKeyService = (auth: FluxAuth): ApiKeyService => {
  const describe = (candidate: z.input<typeof RowSchema>): ApiKey => {
    const row = RowSchema.parse(candidate);

    return {
      id: row.id,
      name: row.name,
      start: row.start,
      enabled: row.enabled,
      expiresAt: asIsoString(row.expiresAt) === '' ? null : asIsoString(row.expiresAt),
      lastRequestAt: asIsoString(row.lastRequest) === '' ? null : asIsoString(row.lastRequest),
      requestCount: row.requestCount,
      permissions: readPermissions(row.permissions),
      rateLimit:
        row.rateLimitEnabled === true &&
        typeof row.rateLimitMax === 'number' &&
        typeof row.rateLimitTimeWindow === 'number'
          ? { max: row.rateLimitMax, everySeconds: Math.round(row.rateLimitTimeWindow / 1000) }
          : null,
      createdAt: asIsoString(row.createdAt),
    };
  };

  return {
    list: async (headers) => {
      const page = await auth.api.listApiKeys({ headers }).catch(() => null);

      return (page?.apiKeys ?? []).map(describe);
    },

    create: async (accountId, input) => {
      const made = await auth.api.createApiKey({
        body: {
          name: input.name,
          userId: accountId,
          ...(input.expiresInDays === null
            ? {}
            : { expiresIn: Math.round((input.expiresInDays * A_DAY) / 1000) }),
          ...(input.permissions === null
            ? {}
            : { permissions: { [NAMESPACE]: [...input.permissions] } }),
          ...(input.rateLimit === null
            ? { rateLimitEnabled: false }
            : {
                rateLimitEnabled: true,
                rateLimitMax: input.rateLimit.max,
                rateLimitTimeWindow: input.rateLimit.everySeconds * 1000,
              }),
        },
      });

      return { ...describe(made), key: made.key };
    },

    setEnabled: async (headers, keyId, enabled) => {
      const changed = await auth.api
        .updateApiKey({ headers, body: { keyId, enabled } })
        .catch(() => null);

      return changed === null ? null : describe(changed);
    },

    revoke: async (headers, keyId) => {
      const gone = await auth.api.deleteApiKey({ headers, body: { keyId } }).catch(() => null);

      return gone !== null;
    },

    restrictionFor: async (headers, keyId) => {
      const found = await auth.api.getApiKey({ headers, query: { id: keyId } }).catch(() => null);

      if (found === null) {
        return new Set<Permission>();
      }

      const permissions = readPermissions(RowSchema.parse(found).permissions);

      return permissions === null ? null : new Set(permissions);
    },
  };
};

export { createBetterAuthApiKeyService, readPermissions, NAMESPACE };
