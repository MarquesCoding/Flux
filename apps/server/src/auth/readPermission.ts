import { PermissionSchema } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * Reads a permission back out of a text column, through a schema rather than by casting. Rows outlive
 * the code that wrote them, so a permission this version has never heard of reads as nothing rather
 * than as itself.
 *
 * @param name Whatever the column held.
 */
const readPermission = (name: string): Permission | null => {
  const parsed = PermissionSchema.safeParse(name);

  return parsed.success ? parsed.data : null;
};

export { readPermission };
