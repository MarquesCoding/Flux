import type { Permission, PermissionGrant, Role } from '@FluxContracts/schemas/Permission';

/**
 * What an account may do, and the roles that decide it.
 *
 * A port rather than the database directly, so the routes can be exercised
 * without one — and so the guard has something to resolve against before the
 * roles UI exists.
 *
 * `resolve` is the hot path: it runs for every guarded request, so its
 * caller resolves once and asks as often as it likes rather than going back
 * to the database per permission checked.
 */
type PermissionService = {
  resolve: (userId: string) => Promise<ReadonlySet<Permission>>;

  listRoles: () => Promise<Role[]>;
  createRole: (role: Omit<Role, 'id'>) => Promise<Role>;
  updateRole: (id: string, role: Partial<Omit<Role, 'id'>>) => Promise<Role | null>;
  deleteRole: (id: string) => Promise<boolean>;

  rolesFor: (userId: string) => Promise<Role[]>;
  assignRole: (userId: string, roleId: string) => Promise<void>;
  removeRole: (userId: string, roleId: string) => Promise<void>;

  overridesFor: (userId: string) => Promise<PermissionGrant[]>;
  setOverride: (userId: string, grant: PermissionGrant) => Promise<void>;
  clearOverride: (userId: string, permission: Permission) => Promise<void>;

  /**
   * How many accounts still hold `administrator`, counting roles and
   * overrides together.
   *
   * The one question that has to be asked before taking it away: an instance
   * whose last administrator has been demoted, denied or deleted cannot be
   * administered again without going into the database by hand.
   */
  countAdministrators: () => Promise<number>;
};

export type { PermissionService };
