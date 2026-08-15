import { PermissionSchema } from '@FluxContracts/schemas/Permission';
import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * Reads a permission back out of a text column.
 *
 * @param name Whatever the column held.
 */
const readPermission = (name: string): Permission | null => {
  const parsed = PermissionSchema.safeParse(name);

  return parsed.success ? parsed.data : null;
};

export { readPermission };
