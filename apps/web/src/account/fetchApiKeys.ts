import { ApiKeySchema, CreatedApiKeySchema } from '@FluxContracts/schemas/ApiKey';
import { z } from 'zod';
import type { ApiKey, CreatedApiKey } from '@FluxContracts/schemas/ApiKey';
import type { Permission } from '@FluxContracts/schemas/Permission';

const ApiKeyListSchema = z.object({ keys: z.array(ApiKeySchema) });

const asJson = {
  credentials: 'same-origin',
  headers: { accept: 'application/json', 'content-type': 'application/json' },
} as const;

/**
 * The keys on this account.
 */
const fetchApiKeys = async (): Promise<ApiKey[] | null> => {
  try {
    const response = await fetch('/api/keys', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return ApiKeyListSchema.parse(await response.json()).keys;
  } catch {
    return null;
  }
};

/**
 * Creates an API key and answers with the key itself, which is the only moment it can be read — the
 * server stores a hash, so somebody who loses it makes another rather than looking it up.
 *
 * @param request - What the key is called and what it may do.
 * @returns The key, once.
 */
const createApiKey = async (input: {
  name: string;
  expiresInDays: number | null;
  permissions: readonly Permission[] | null;
  rateLimit: { max: number; everySeconds: number } | null;
}): Promise<CreatedApiKey | null> => {
  try {
    const response = await fetch('/api/keys', {
      ...asJson,
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        expiresInDays: input.expiresInDays,
        permissions: input.permissions === null ? null : [...input.permissions],
        rateLimit: input.rateLimit,
      }),
    });

    return response.ok ? CreatedApiKeySchema.parse(await response.json()) : null;
  } catch {
    return null;
  }
};

/**
 * Turns a key off without deleting it, or back on, so a key suspected of leaking can be stopped
 * while somebody works out what was using it.
 *
 * @param keyId - The key.
 * @param isEnabled - Whether it should work.
 */
const setApiKeyEnabled = async (id: string, enabled: boolean): Promise<boolean> => {
  try {
    const response = await fetch(`/api/keys/${id}`, {
      ...asJson,
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });

    return response.ok;
  } catch {
    return false;
  }
};

const revokeApiKey = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/keys/${id}`, {
      credentials: 'same-origin',
      method: 'DELETE',
    });

    return response.ok;
  } catch {
    return false;
  }
};

export { fetchApiKeys, createApiKey, setApiKeyEnabled, revokeApiKey };
