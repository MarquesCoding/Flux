import { DEFAULT_ROLES, DEFAULT_ROLE_NAME } from '@FluxCore/functions/defaultRoles';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';
import type { PermissionService } from './PermissionService';

type SeedableAccount = {
  id: string;
  role: string | null;
};

type SeedDefaultRolesOptions = {
  permissions: PermissionService;
  settings: SettingsStore;
  accounts: () => Promise<SeedableAccount[]>;
};

type SeedOutcome = {
  rolesCreated: string[];
  administratorsCarried: number;
  membersAssigned: number;
};

const ADMINISTRATOR_ROLE_NAME = 'Administrator';

/**
 * Gives an instance its default roles the first time it starts, and gives every account that already
 * exists the one it should have. Recorded in settings once done, so an operator who deletes a role
 * does not find it back on the next restart.
 *
 * @param options - The permission service, the settings recording what has been seeded, and the
 *   accounts to give roles to.
 * @returns Which roles were created and how many accounts were given one.
 */
const seedDefaultRoles = async ({
  permissions,
  settings,
  accounts,
}: SeedDefaultRolesOptions): Promise<SeedOutcome> => {
  const { seededRoleNames } = await settings.read();
  const existing = await permissions.listRoles();
  const existingNames = new Set(existing.map((role) => role.name));
  const rolesCreated: string[] = [];

  for (const seed of DEFAULT_ROLES) {
    if (seededRoleNames.includes(seed.name) || existingNames.has(seed.name)) {
      continue;
    }

    await permissions.createRole({
      name: seed.name,
      position: seed.position,
      permissions: [...seed.permissions],
    });

    rolesCreated.push(seed.name);
  }

  const unrecorded = DEFAULT_ROLES.map((seed) => seed.name).filter(
    (name) => !seededRoleNames.includes(name),
  );

  if (unrecorded.length > 0) {
    await settings.write({ seededRoleNames: [...seededRoleNames, ...unrecorded] });
  }

  const roles = await permissions.listRoles();
  const administrator = roles.find((role) => role.name === ADMINISTRATOR_ROLE_NAME);
  const member = roles.find((role) => role.name === DEFAULT_ROLE_NAME);

  let administratorsCarried = 0;
  let membersAssigned = 0;

  for (const account of await accounts()) {
    if ((await permissions.rolesFor(account.id)).length > 0) {
      continue;
    }

    if (account.role === 'admin' && administrator !== undefined) {
      await permissions.assignRole(account.id, administrator.id);
      administratorsCarried += 1;

      continue;
    }

    if (account.role !== 'admin' && member !== undefined) {
      await permissions.assignRole(account.id, member.id);
      membersAssigned += 1;
    }
  }

  return { rolesCreated, administratorsCarried, membersAssigned };
};

export { seedDefaultRoles };
export type { SeedableAccount };
