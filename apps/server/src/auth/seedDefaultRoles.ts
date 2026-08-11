import { DEFAULT_ROLES, DEFAULT_ROLE_NAME } from '@FluxCore/functions/defaultRoles';
import type { SettingsStore } from '@FluxServer/settings/ServerSettings';
import type { PermissionService } from './PermissionService';

/**
 * An account as this needs to see it: who it is, and whether the old single
 * `role` column called it an administrator.
 */
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

/**
 * The name of the role that stands in for the old `role: 'admin'` column.
 */
const ADMINISTRATOR_ROLE_NAME = 'Administrator';

/**
 * Gives an instance its default roles, and gives every existing account one.
 *
 * Two jobs, and the second is the one that matters. Before this, authorisation
 * was a single `user.role` column reading `'admin'` or nothing. An instance
 * upgrading into the role model has accounts and no rows in any of the new
 * tables, so without a carry-over **every administrator would lose access on
 * deploy** and nobody could grant it back. So the old column is read once and
 * turned into an Administrator assignment.
 *
 * Runs on every boot and does nothing on most of them:
 *
 * - A default role is created once by name, and never recreated. Which ones
 *   have been seeded is recorded in settings, so an operator who deletes
 *   `Restricted` because they do not want it does not find it back tomorrow —
 *   while a role added in a later version still arrives.
 * - An account is only ever given a role when it has **none at all**. Anything
 *   else would undo an operator's decision on the next restart, which is worse
 *   than not seeding.
 *
 * That last rule has a consequence worth stating rather than discovering:
 * stripping somebody to zero roles does not stick, because zero roles is
 * indistinguishable from never having been seeded. `Restricted` is what "this
 * account may do nothing" looks like — it exists precisely so that the
 * intention is recorded rather than implied by an absence, and an account
 * holding it is left alone here.
 *
 * Note what deliberately does not happen: the old `user.role` column is read,
 * not written and not cleared. better-auth's admin plugin still owns it, and
 * leaving it be means this can be run, inspected, and reverted without having
 * destroyed the thing it was derived from.
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

export { seedDefaultRoles, ADMINISTRATOR_ROLE_NAME };
export type { SeedableAccount, SeedOutcome };
