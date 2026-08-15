import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * What a key may do, given what its account may do.
 */
const narrowToKey = (
  held: ReadonlySet<Permission>,
  allowed: ReadonlySet<Permission> | null,
): ReadonlySet<Permission> =>
  allowed === null ? held : new Set([...allowed].filter((permission) => held.has(permission)));

export { narrowToKey };
