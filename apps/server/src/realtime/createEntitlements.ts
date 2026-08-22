import type { Permission } from '@ValenceContracts/schemas/Permission';

type EntitlementOptions = {
  resolve: (accountId: string) => Promise<ReadonlySet<Permission>>;
  now: () => number;
  ttlMs: number;
};

type Entitlements = {
  of: (accountId: string) => Promise<ReadonlySet<Permission>>;
  forget: (accountId: string) => void;
  forgetAll: () => void;
};

/**
 * Resolves what an account may do, remembered only briefly. A socket that checked permissions once
 * when it opened would go on delivering an admin feed to somebody whose role was taken away an hour
 * ago, so entitlement is re-read rather than remembered for the life of the connection.
 *
 * Re-reading on every message of a four-thousand-item scan would mean four thousand queries, hence
 * the short window. Immediacy where it matters comes from `forget`, called when a role actually
 * changes, rather than from making the window small enough to hide the problem.
 *
 * @param resolve - How permissions are read for an account.
 * @param now - The clock, injected so this can be tested without waiting.
 * @param ttlMs - How long a reading stays good.
 * @returns The entitlement reader.
 */
const createEntitlements = ({ resolve, now, ttlMs }: EntitlementOptions): Entitlements => {
  const held = new Map<string, { at: number; permissions: ReadonlySet<Permission> }>();

  return {
    of: async (accountId) => {
      const remembered = held.get(accountId);

      if (remembered !== undefined && now() - remembered.at < ttlMs) {
        return remembered.permissions;
      }

      const permissions = await resolve(accountId);

      held.set(accountId, { at: now(), permissions });

      return permissions;
    },

    forget: (accountId) => {
      held.delete(accountId);
    },

    forgetAll: () => {
      held.clear();
    },
  };
};

export type { Entitlements };

export { createEntitlements };
