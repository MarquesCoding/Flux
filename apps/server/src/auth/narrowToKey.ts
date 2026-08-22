import type { Permission } from '@ValenceContracts/schemas/Permission';

/**
 * Works out what an API key may actually do, which is never more than the account that issued it —
 * a key restricted to a set of permissions holds the overlap between that set and whatever its
 * account still holds, so removing a permission from an account removes it from every key too.
 *
 * @param held - What the key's account may do now.
 * @param allowed - What the key was restricted to, or null where it was not restricted.
 * @returns What the key may do.
 */
const narrowToKey = (
  held: ReadonlySet<Permission>,
  allowed: ReadonlySet<Permission> | null,
): ReadonlySet<Permission> =>
  allowed === null ? held : new Set([...allowed].filter((permission) => held.has(permission)));

export { narrowToKey };
