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

type Refusal = { message: string } | null;

const readRefusal = async (response: Response): Promise<Refusal> => {
  if (response.ok) {
    return null;
  }

  const body = await response
    .json()
    .then((value) => z.object({ error: z.string() }).safeParse(value))
    .catch(() => null);

  return {
    message:
      body?.success === true ? body.data.error : 'That could not be done. Try again in a moment.',
  };
};

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

const fetchRoles = async (): Promise<Role[]> => {
  const response = await fetch('/api/admin/roles', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return [];
  }

  return z.object({ roles: z.array(RoleSchema) }).parse(await response.json()).roles;
};

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

const deleteRole = async (id: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/roles/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

const fetchAccountPermissions = async (userId: string): Promise<AccountPermissions | null> => {
  const response = await fetch(`/api/admin/accounts/${userId}/roles`, {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return AccountPermissionsSchema.parse(await response.json());
};

const assignRole = async (userId: string, roleId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/roles/${roleId}`, {
    method: 'PUT',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

const removeRole = async (userId: string, roleId: string): Promise<Refusal> => {
  const response = await fetch(`/api/admin/accounts/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

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
