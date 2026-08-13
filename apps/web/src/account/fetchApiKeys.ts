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
 *
 * Answers with nothing rather than throwing, like every other read the account
 * page makes: an account without permission to hold keys is answered with a
 * refusal, and a refusal is a reason to draw no section rather than to take
 * the page down.
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
 * Mints a key, which is the only moment it can be read.
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
 * Turns a key off, or back on.
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
