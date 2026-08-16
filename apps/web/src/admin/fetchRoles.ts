import { readRefusal } from './readRefusal';
import type { Refusal } from './readRefusal';
import { z } from 'zod';
import { PermissionSchema } from '@FluxContracts/schemas/Permission';
import type { Permission, PermissionGrant, Role } from '@FluxContracts/schemas/Permission';

const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  permissions: z.array(PermissionSchema),
});

const GrantSchema = z.object({
  permission: PermissionSchema,
  effect: z.enum(['allow', 'deny']),
});

const AccountPermissionsSchema = z.object({
  roles: z.array(RoleSchema),
  overrides: z.array(GrantSchema),
  effective: z.array(PermissionSchema),
});

type AccountPermissions = z.infer<typeof AccountPermissionsSchema>;

/**
 * Reads every permission this server knows how to grant, which is what a role editor offers rather
 * than a list written down in the page.
 *
 * @returns The permissions, or none where the request failed.
 */
const fetchPermissionCatalogue = async (): Promise<Permission[]> => {
  const response = await fetch('/api/admin/permissions', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  return z.object({ permissions: z.array(PermissionSchema) }).parse(await response.json())
    .permissions;
};

/**
 * Reads the roles on this server and what each grants. Roles are how a household gives somebody a
 * set of permissions without choosing them one by one.
 *
 * @returns The roles, or none where the request failed.
 */
const fetchRoles = async (): Promise<Role[]> => {
  const response = await fetch('/api/admin/roles', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  return z.object({ roles: z.array(RoleSchema) }).parse(await response.json()).roles;
};

/**
 * Adds a role: what it is called and what it grants. Granting it to anybody is a separate step, so a
 * role can be got right before it applies to a single person.
 *
 * @param role - The role to add.
 * @returns Any refusal from the server.
 */
const createRole = async (role: Omit<Role, 'id'>): Promise<Refusal> => {
  const response = await fetch('/api/admin/roles', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(role),
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Changes a role. Takes only what changed rather than the whole role, so two administrators editing
 * different parts of one role do not overwrite each other.
 *
 * @param id - The role to change.
 * @param changes - What to change about it.
 * @returns Any refusal from the server.
 */
const updateRole = async (id: string, changes: Partial<Omit<Role, 'id'>>): Promise<Refusal> => {
  const response = await fetch(`/api/admin/roles/${id}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changes),
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Removes a role, and with it whatever it granted to everyone holding it. Anything set against a
 * person directly is untouched, so somebody may keep a permission the role also happened to give.
 *
 * @param id - The role to remove.
 * @returns Any refusal from the server.
 */
const deleteRole = async (id: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/roles/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Reads what one account may do: the roles it holds, the grants set against it directly, and what
 * the two come to together.
 *
 * @param userId - The account being asked about.
 * @returns What it may do, or null where the request failed.
 */
const fetchAccountPermissions = async (userId: string): Promise<AccountPermissions | null> => {
  const response = await fetch(`/api/admin/accounts/${userId}/roles`, {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return AccountPermissionsSchema.parse(await response.json());
};

/**
 * Gives an account a role, adding what it grants to whatever the account already had rather than
 * replacing it — an account may hold several.
 *
 * @param userId - The account.
 * @param roleId - The role to give it.
 * @returns Any refusal from the server.
 */
const assignRole = async (userId: string, roleId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/roles/${roleId}`, {
    method: 'PUT',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Takes a role away from an account, leaving any grants set against it directly.
 *
 * @param userId - The account.
 * @param roleId - The role to take away.
 * @returns Any refusal from the server.
 */
const removeRole = async (userId: string, roleId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Sets one permission against an account directly, allowing or denying it whatever its roles say.
 * This is how one person is given something without a role being made for them, or denied something
 * their role otherwise grants.
 *
 * @param userId - The account.
 * @param grant - The permission, and whether to allow or deny it.
 * @returns Any refusal from the server.
 */
const setOverride = async (userId: string, grant: PermissionGrant): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/overrides`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(grant),
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Clears a permission set against an account directly, putting it back to whatever its roles say.
 *
 * @param userId - The account.
 * @param permission - The permission to stop overriding.
 * @returns Any refusal from the server.
 */
const clearOverride = async (userId: string, permission: Permission): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/overrides/${permission}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

export {
  fetchPermissionCatalogue,
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchAccountPermissions,
  assignRole,
  removeRole,
  setOverride,
  clearOverride,
};

export type { AccountPermissions, Refusal };
