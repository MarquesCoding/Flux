import { randomUUID } from 'node:crypto';
import { resolvePermissions } from '@ValenceCore/functions/resolvePermissions';
import { DEFAULT_ROLES } from '@ValenceCore/functions/defaultRoles';
import { ADMINISTRATOR } from '@ValenceContracts/schemas/Permission';
import type { PermissionGrant, Role } from '@ValenceContracts/schemas/Permission';
import type { PermissionService } from './PermissionService';

type MemoryState = {
  roles: Role[];
  assignments: Record<string, string[]>;
  overrides: Record<string, PermissionGrant[]>;
};

/**
 * Roles and grants held in memory, so the routes can be exercised without Postgres. Models the same
 * rank and denial rules the database version enforces, since a test passing against weaker rules
 * would describe a server that does not exist.
 *
 * @param state - Any roles and grants to start with.
 * @returns The permission service.
 */
const createMemoryPermissionService = (
  state: MemoryState = {
    roles: DEFAULT_ROLES.map((seed) => ({
      id: randomUUID(),
      name: seed.name,
      position: seed.position,
      permissions: [...seed.permissions],
    })),
    assignments: {},
    overrides: {},
  },
): PermissionService & { state: MemoryState } => {
  const rolesFor = (userId: string): Role[] => {
    const assigned = new Set(state.assignments[userId] ?? []);

    return state.roles.filter((role) => assigned.has(role.id));
  };

  return {
    state,

    resolve: (userId) =>
      Promise.resolve(
        resolvePermissions({
          roles: rolesFor(userId),
          overrides: state.overrides[userId] ?? [],
        }),
      ),

    listRoles: () => Promise.resolve([...state.roles].sort((a, b) => b.position - a.position)),

    createRole: (role) => {
      const created: Role = { ...role, id: randomUUID(), permissions: [...role.permissions] };

      state.roles.push(created);

      return Promise.resolve(created);
    },

    updateRole: (id, changes) => {
      const existing = state.roles.find((role) => role.id === id);

      if (existing === undefined) {
        return Promise.resolve(null);
      }

      const updated: Role = {
        ...existing,
        ...changes,
        permissions:
          changes.permissions === undefined ? existing.permissions : [...changes.permissions],
        id: existing.id,
      };

      state.roles = state.roles.map((role) => (role.id === id ? updated : role));

      return Promise.resolve(updated);
    },

    deleteRole: (id) => {
      const before = state.roles.length;

      state.roles = state.roles.filter((role) => role.id !== id);

      for (const [userId, assigned] of Object.entries(state.assignments)) {
        state.assignments[userId] = assigned.filter((roleId) => roleId !== id);
      }

      return Promise.resolve(state.roles.length !== before);
    },

    rolesFor: (userId) => Promise.resolve(rolesFor(userId)),

    assignRole: (userId, roleId) => {
      const assigned = state.assignments[userId] ?? [];

      if (!assigned.includes(roleId)) {
        state.assignments[userId] = [...assigned, roleId];
      }

      return Promise.resolve();
    },

    removeRole: (userId, roleId) => {
      state.assignments[userId] = (state.assignments[userId] ?? []).filter((id) => id !== roleId);

      return Promise.resolve();
    },

    overridesFor: (userId) => Promise.resolve(state.overrides[userId] ?? []),

    setOverride: (userId, grant) => {
      const kept = (state.overrides[userId] ?? []).filter(
        (existing) => existing.permission !== grant.permission,
      );

      state.overrides[userId] = [...kept, grant];

      return Promise.resolve();
    },

    clearOverride: (userId, permission) => {
      state.overrides[userId] = (state.overrides[userId] ?? []).filter(
        (grant) => grant.permission !== permission,
      );

      return Promise.resolve();
    },

    countAdministrators: () => {
      const holders = new Set([...Object.keys(state.assignments), ...Object.keys(state.overrides)]);

      let count = 0;

      for (const userId of holders) {
        const resolved = resolvePermissions({
          roles: rolesFor(userId),
          overrides: state.overrides[userId] ?? [],
        });

        if (resolved.has(ADMINISTRATOR)) {
          count += 1;
        }
      }

      return Promise.resolve(count);
    },
  };
};

export { createMemoryPermissionService };
export type { MemoryState as MemoryPermissionState };
