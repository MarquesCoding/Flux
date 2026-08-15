import type { ApiKey, CreatedApiKey } from '@FluxContracts/schemas/ApiKey';
import type { Permission } from '@FluxContracts/schemas/Permission';

type ApiKeyService = {
  list: (headers: Headers) => Promise<ApiKey[]>;
  create: (
    accountId: string,
    input: {
      name: string;
      expiresInDays: number | null;
      permissions: readonly Permission[] | null;
      rateLimit: { max: number; everySeconds: number } | null;
    },
  ) => Promise<CreatedApiKey>;
  setEnabled: (headers: Headers, keyId: string, enabled: boolean) => Promise<ApiKey | null>;
  revoke: (headers: Headers, keyId: string) => Promise<boolean>;
  restrictionFor: (headers: Headers, keyId: string) => Promise<ReadonlySet<Permission> | null>;
};

export type { ApiKeyService };
