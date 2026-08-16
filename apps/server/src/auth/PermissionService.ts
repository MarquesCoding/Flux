import type { Permission, PermissionGrant, Role } from '@FluxContracts/schemas/Permission';

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

  countAdministrators: () => Promise<number>;
};

export type { PermissionService };
