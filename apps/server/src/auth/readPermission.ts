import { PermissionSchema } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * Reads a permission back out of a text column.
 *
 * Permissions are stored as text rather than a database enum, so that adding
 * a capability is a code change rather than a migration. The cost is that a
 * row can name something the catalogue no longer has — after a permission is
 * renamed, or dropped, or a database is edited by hand.
 *
 * Such a row grants nothing rather than being trusted. Note the direction
 * this fails in: an unknown *allow* grants nothing, which is safe, and an
 * unknown *deny* denies nothing, which is not obviously safe but is the only
 * coherent answer — a deny naming a permission that does not exist cannot
 * take anything away, because nothing has it.
 *
 * @param name Whatever the column held.
 */
const readPermission = (name: string): Permission | null => {
  const parsed = PermissionSchema.safeParse(name);

  return parsed.success ? parsed.data : null;
};

export { readPermission };
