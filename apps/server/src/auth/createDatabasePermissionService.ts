import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { resolvePermissions } from '@FluxCore/functions/resolvePermissions';
import { ADMINISTRATOR } from '@FluxContracts/schemas/Permission';
import type { Permission, PermissionGrant, Role } from '@FluxContracts/schemas/Permission';
import { role, rolePermission, userPermissionOverride, userRole } from '@FluxServer/db/Schema';
import type { FluxDatabase } from '@FluxServer/db/Database';
import { readPermission } from './readPermission';
import type { PermissionService } from './PermissionService';

/**
 * Reads permission rows into grants, dropping any naming a permission or an effect this version of
 * Flux does not recognise. Rows outlive the code that wrote them, and an unreadable grant is safer
 * discarded than guessed at.
 *
 * @param rows - The rows as stored.
 * @returns The grants that could be read.
 */
const readGrants = (rows: readonly { permission: string; effect: string }[]): PermissionGrant[] =>
  rows.flatMap((row) => {
    const permission = readPermission(row.permission);

    if (permission === null || (row.effect !== 'allow' && row.effect !== 'deny')) {
      return [];
    }

    return [{ permission, effect: row.effect }];
  });

/**
 * Roles, their permissions, and the grants and denials set on individual accounts, held in Postgres.
 * This is what every permission check in the server eventually reads.
 *
 * @param db - The database to read and write.
 * @returns The permission service.
 */
const createDatabasePermissionService = (db: FluxDatabase): PermissionService => {
  const permissionsByRole = async (
    roleIds: readonly string[],
  ): Promise<Map<string, Permission[]>> => {
    if (roleIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select()
      .from(rolePermission)
      .where(inArray(rolePermission.roleId, [...roleIds]));

    const byRole = new Map<string, Permission[]>();

    for (const row of rows) {
      const permission = readPermission(row.permission);

      if (permission === null) {
        continue;
      }

      byRole.set(row.roleId, [...(byRole.get(row.roleId) ?? []), permission]);
    }

    return byRole;
  };

  const rolesFor = async (userId: string): Promise<Role[]> => {
    const assigned = await db.select().from(userRole).where(eq(userRole.userId, userId));
    const roleIds = assigned.map((row) => row.roleId);

    if (roleIds.length === 0) {
      return [];
    }

    const rows = await db.select().from(role).where(inArray(role.id, roleIds));
    const byRole = await permissionsByRole(roleIds);

    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        position: row.position,
        permissions: byRole.get(row.id) ?? [],
      }))
      .sort((a, b) => b.position - a.position);
  };

  const overridesFor = async (userId: string): Promise<PermissionGrant[]> =>
    readGrants(
      await db
        .select()
        .from(userPermissionOverride)
        .where(eq(userPermissionOverride.userId, userId)),
    );

  const writePermissions = async (roleId: string, permissions: readonly Permission[]) => {
    await db.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

    if (permissions.length > 0) {
      await db
        .insert(rolePermission)
        .values(permissions.map((permission) => ({ roleId, permission })));
    }
  };

  return {
    resolve: async (userId) =>
      resolvePermissions({
        roles: await rolesFor(userId),
        overrides: await overridesFor(userId),
      }),

    listRoles: async () => {
      const rows = await db.select().from(role).orderBy(desc(role.position));
      const byRole = await permissionsByRole(rows.map((row) => row.id));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        position: row.position,
        permissions: byRole.get(row.id) ?? [],
      }));
    },

    createRole: async (next) => {
      const id = randomUUID();

      await db.insert(role).values({ id, name: next.name, position: next.position });
      await writePermissions(id, next.permissions);

      return { ...next, id, permissions: [...next.permissions] };
    },

    updateRole: async (id, changes) => {
      const [existing] = await db.select().from(role).where(eq(role.id, id)).limit(1);

      if (existing === undefined) {
        return null;
      }

      const name = changes.name ?? existing.name;
      const position = changes.position ?? existing.position;

      await db.update(role).set({ name, position }).where(eq(role.id, id));

      if (changes.permissions !== undefined) {
        await writePermissions(id, changes.permissions);
      }

      const byRole = await permissionsByRole([id]);

      return { id, name, position, permissions: byRole.get(id) ?? [] };
    },

    deleteRole: async (id) => {
      const deleted = await db.delete(role).where(eq(role.id, id)).returning({ id: role.id });

      return deleted.length > 0;
    },

    rolesFor,

    assignRole: async (userId, roleId) => {
      await db.insert(userRole).values({ userId, roleId }).onConflictDoNothing();
    },

    removeRole: async (userId, roleId) => {
      await db
        .delete(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.roleId, roleId)));
    },

    overridesFor,

    setOverride: async (userId, grant) => {
      await db
        .insert(userPermissionOverride)
        .values({ userId, permission: grant.permission, effect: grant.effect })
        .onConflictDoUpdate({
          target: [userPermissionOverride.userId, userPermissionOverride.permission],
          set: { effect: grant.effect },
        });
    },

    clearOverride: async (userId, permission) => {
      await db
        .delete(userPermissionOverride)
        .where(
          and(
            eq(userPermissionOverride.userId, userId),
            eq(userPermissionOverride.permission, permission),
          ),
        );
    },

    countAdministrators: async () => {
      const assignments = await db.select().from(userRole);
      const overrides = await db.select().from(userPermissionOverride);

      const candidates = new Set([
        ...assignments.map((row) => row.userId),
        ...overrides.map((row) => row.userId),
      ]);

      if (candidates.size === 0) {
        return 0;
      }

      const roles = await db.select().from(role);
      const byRole = await permissionsByRole(roles.map((row) => row.id));
      const rolesById = new Map(roles.map((row) => [row.id, byRole.get(row.id) ?? []]));

      const grantsByUser = new Map<string, PermissionGrant[]>();

      for (const row of overrides) {
        const [grant] = readGrants([row]);

        if (grant !== undefined) {
          grantsByUser.set(row.userId, [...(grantsByUser.get(row.userId) ?? []), grant]);
        }
      }

      let count = 0;

      for (const userId of candidates) {
        const held = assignments
          .filter((row) => row.userId === userId)
          .map((row) => ({ permissions: rolesById.get(row.roleId) ?? [] }));

        const resolved = resolvePermissions({
          roles: held,
          overrides: grantsByUser.get(userId) ?? [],
        });

        if (resolved.has(ADMINISTRATOR)) {
          count += 1;
        }
      }

      return count;
    },
  };
};

export { createDatabasePermissionService };
