import { createRoute, z } from '@hono/zod-openapi';
import { PERMISSIONS } from '@FluxContracts/schemas/Permission';

const PermissionName = z.enum(PERMISSIONS);

const Role = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(60),
    position: z.number().int().nonnegative(),
    permissions: z.array(PermissionName),
  })
  .openapi('Role');

const RoleError = z.object({ error: z.string() }).openapi('RoleError');

const RoleBody = z
  .object({
    name: z.string().min(1).max(60),
    position: z.number().int().nonnegative(),
    permissions: z.array(PermissionName),
  })
  .openapi('RoleBody');

const RolePatch = RoleBody.partial().openapi('RolePatch');

const OverrideBody = z
  .object({ permission: PermissionName, effect: z.enum(['allow', 'deny']) })
  .openapi('OverrideBody');

const listPermissionsRoute = createRoute({
  method: 'get',
  path: '/api/admin/permissions',
  tags: ['Roles'],
  summary: 'List every permission that exists',
  responses: {
    200: {
      description: 'Every permission, in catalogue order',
      content: {
        'application/json': { schema: z.object({ permissions: z.array(PermissionName) }) },
      },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const listRolesRoute = createRoute({
  method: 'get',
  path: '/api/admin/roles',
  tags: ['Roles'],
  summary: 'List the roles on this server',
  responses: {
    200: {
      description: 'Every role, highest first',
      content: { 'application/json': { schema: z.object({ roles: z.array(Role) }) } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const createRoleRoute = createRoute({
  method: 'post',
  path: '/api/admin/roles',
  tags: ['Roles'],
  summary: 'Create a role',
  request: { body: { content: { 'application/json': { schema: RoleBody } } } },
  responses: {
    201: { description: 'The role was created', content: { 'application/json': { schema: Role } } },
    400: {
      description: 'The role could not be created as asked',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const updateRoleRoute = createRoute({
  method: 'patch',
  path: '/api/admin/roles/{id}',
  tags: ['Roles'],
  summary: 'Change what a role is and grants',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: RolePatch } } },
  },
  responses: {
    200: { description: 'The role was changed', content: { 'application/json': { schema: Role } } },
    400: {
      description: 'The change was refused',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
    404: {
      description: 'No such role',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const deleteRoleRoute = createRoute({
  method: 'delete',
  path: '/api/admin/roles/{id}',
  tags: ['Roles'],
  summary: 'Delete a role',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'The role was deleted' },
    400: {
      description: 'The role cannot be deleted',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
    404: {
      description: 'No such role',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const listAccountRolesRoute = createRoute({
  method: 'get',
  path: '/api/admin/accounts/{userId}/roles',
  tags: ['Roles'],
  summary: 'List what one account holds, and what it resolves to',
  request: { params: z.object({ userId: z.string().min(1) }) },
  responses: {
    200: {
      description: 'The roles, the overrides, and the effective permissions',
      content: {
        'application/json': {
          schema: z.object({
            roles: z.array(Role),
            overrides: z.array(OverrideBody),
            effective: z.array(PermissionName),
          }),
        },
      },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const assignRoleRoute = createRoute({
  method: 'put',
  path: '/api/admin/accounts/{userId}/roles/{roleId}',
  tags: ['Roles'],
  summary: 'Give an account a role',
  request: { params: z.object({ userId: z.string().min(1), roleId: z.string().uuid() }) },
  responses: {
    204: { description: 'The account holds the role' },
    400: {
      description: 'The assignment was refused',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
    404: {
      description: 'No such role',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const removeRoleRoute = createRoute({
  method: 'delete',
  path: '/api/admin/accounts/{userId}/roles/{roleId}',
  tags: ['Roles'],
  summary: 'Take a role away from an account',
  request: { params: z.object({ userId: z.string().min(1), roleId: z.string().uuid() }) },
  responses: {
    204: { description: 'The account no longer holds the role' },
    400: {
      description: 'The removal was refused',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const setOverrideRoute = createRoute({
  method: 'put',
  path: '/api/admin/accounts/{userId}/overrides',
  tags: ['Roles'],
  summary: 'Allow or deny one permission for one account',
  request: {
    params: z.object({ userId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: OverrideBody } } },
  },
  responses: {
    204: { description: 'The override was recorded' },
    400: {
      description: 'The override was refused',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

const clearOverrideRoute = createRoute({
  method: 'delete',
  path: '/api/admin/accounts/{userId}/overrides/{permission}',
  tags: ['Roles'],
  summary: 'Forget an override, leaving the roles to decide',
  request: { params: z.object({ userId: z.string().min(1), permission: PermissionName }) },
  responses: {
    204: { description: 'The override was forgotten' },
    400: {
      description: 'The change was refused',
      content: { 'application/json': { schema: RoleError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: RoleError } },
    },
  },
});

export {
  listPermissionsRoute,
  listRolesRoute,
  createRoleRoute,
  updateRoleRoute,
  deleteRoleRoute,
  listAccountRolesRoute,
  assignRoleRoute,
  removeRoleRoute,
  setOverrideRoute,
  clearOverrideRoute,
};
