import { PermissionSchema } from '@FluxContracts/schemas/Permission';
import type { ApiKeyService } from './ApiKeyService';
import type { FluxAuth } from './Auth';
import type { ApiKey } from '@FluxContracts/schemas/ApiKey';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * The namespace Flux's own permissions are filed under on a key.
 *
 * better-auth stores a key's permissions as named lists so that an application
 * can keep more than one vocabulary on one key. Flux has one, and naming it
 * means a future second — a plugin's, say — cannot be mistaken for it.
 */
const NAMESPACE = 'flux';

const A_DAY = 86_400_000;

/**
 * Reads the Flux permissions off a key, discarding anything unrecognised.
 *
 * A permission that no longer exists is dropped rather than kept as a string
 * nothing will ever match: a key restricted to something Flux has since
 * removed should lose that restriction's subject, not carry a ghost.
 */
const readPermissions = (raw: unknown): Permission[] | null => {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return null;
  }

  const named: unknown = (raw as Record<string, unknown>)[NAMESPACE];

  if (!Array.isArray(named)) {
    return null;
  }

  return named.flatMap((one) => {
    const parsed = PermissionSchema.safeParse(one);

    return parsed.success ? [parsed.data] : [];
  });
};

const asIsoString = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : null;

/**
 * Keys, kept where better-auth already keeps them.
 *
 * Flux does not store these itself, deliberately. better-auth owns the
 * `apikey` table, hashes the key on the way in so it cannot be read back, and
 * — the part that matters most — resolves a request carrying one into a
 * session. A second store beside it would mean a key that authenticates but
 * cannot be listed, or one that is listed but does not work.
 *
 * What Flux owns is the policy: which account may hold a key at all, and what
 * a key is narrowed to. That lives above this.
 */
const createBetterAuthApiKeyService = (auth: FluxAuth): ApiKeyService => {
  const describe = (row: {
    id: string;
    name?: string | null;
    start?: string | null;
    enabled?: boolean | null;
    expiresAt?: unknown;
    lastRequest?: unknown;
    requestCount?: number | null;
    permissions?: unknown;
    createdAt?: unknown;
  }): ApiKey => ({
    id: row.id,
    name: row.name ?? '',
    start: row.start ?? null,
    enabled: row.enabled ?? true,
    expiresAt: asIsoString(row.expiresAt),
    lastRequestAt: asIsoString(row.lastRequest),
    requestCount: row.requestCount ?? 0,
    permissions: readPermissions(row.permissions),
    createdAt: asIsoString(row.createdAt) ?? new Date().toISOString(),
  });

  return {
    list: async (headers) => {
      const rows = await auth.api.listApiKeys({ headers }).catch(() => []);

      return (Array.isArray(rows) ? rows : []).map(describe);
    },

    create: async (headers, input) => {
      const made = await auth.api.createApiKey({
        headers,
        body: {
          name: input.name,
          ...(input.expiresInDays === null
            ? {}
            : { expiresIn: Math.round((input.expiresInDays * A_DAY) / 1000) }),
          ...(input.permissions === null
            ? {}
            : { permissions: { [NAMESPACE]: [...input.permissions] } }),
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
      const gone = await auth.api
        .deleteApiKey({ headers, body: { keyId } })
        .catch(() => null);

      return gone !== null;
    },

    restrictionFor: async (headers, keyId) => {
      const found = await auth.api.getApiKey({ headers, query: { id: keyId } }).catch(() => null);

      if (found === null) {
        return new Set<Permission>();
      }

      const permissions = readPermissions(found.permissions);

      return permissions === null ? null : new Set(permissions);
    },
  };
};

export { createBetterAuthApiKeyService, readPermissions, NAMESPACE };
