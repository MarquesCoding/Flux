import type { ApiKey, CreatedApiKey } from '@FluxContracts/schemas/ApiKey';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * The keys an account holds, and what each may do.
 *
 * A port rather than better-auth directly, for the same reason the permission
 * service is one: the routes can be exercised without a database, and the
 * narrowing rule can be tested without minting real credentials.
 *
 * Every method takes the request's own headers rather than an account id, so
 * whose keys these are is decided by whoever is actually signed in rather than
 * by a caller saying so. A key belongs to an account, and listing or revoking
 * is always "mine", never "anybody's".
 */
type ApiKeyService = {
  list: (headers: Headers) => Promise<ApiKey[]>;
  /**
   * Mints a key and returns it in plaintext, once.
   */
  create: (
    headers: Headers,
    input: {
      name: string;
      expiresInDays: number | null;
      permissions: readonly Permission[] | null;
    },
  ) => Promise<CreatedApiKey>;
  /**
   * Turns a key off without destroying it, or back on.
   *
   * Worth having separately from revoking: a key suspected of having leaked
   * can be stopped while somebody works out what was using it, and turned back
   * on if the answer is nothing.
   */
  setEnabled: (headers: Headers, keyId: string, enabled: boolean) => Promise<ApiKey | null>;
  revoke: (headers: Headers, keyId: string) => Promise<boolean>;
  /**
   * What the key on a request is restricted to, if the request carries one.
   *
   * Three answers, and they are all different. `undefined` means the request
   * carries no key at all and is an ordinary session. `null` means it carries
   * one that is unrestricted, which is exactly its account. A set means it
   * carries one restricted to those permissions, and the account's own
   * permissions still bound it.
   *
   * A key that has been revoked, disabled or has expired answers as an empty
   * set rather than as unrestricted — the fail-safe direction, so that a
   * mistake here removes authority rather than granting it.
   */
  restrictionFor: (headers: Headers, keyId: string) => Promise<ReadonlySet<Permission> | null>;
};

export type { ApiKeyService };
