import { ADMINISTRATOR, PERMISSIONS } from '@FluxContracts/schemas/Permission';
import type { Permission, PermissionGrant } from '@FluxContracts/schemas/Permission';

type ResolvePermissionsOptions = {
  /**
   * Every role the account holds. Order does not matter here — roles are
   * unioned, and `position` governs who may manage whom rather than which
   * grant wins.
   */
  roles: readonly { permissions: readonly Permission[] }[];
  /**
   * What was said about this account in particular, for the exception that
   * does not justify a role of its own.
   */
  overrides?: readonly PermissionGrant[];
};

/**
 * What an account may actually do, once its roles and its own exceptions
 * have been read together.
 *
 * Three rules, applied in this order:
 *
 * 1. **Roles are unioned.** Holding two roles grants what either grants;
 *    there is no precedence between them and no need to invent one.
 * 2. **`administrator` implies everything.** So a permission added to the
 *    catalogue later is one the people running the server already have.
 * 3. **Deny wins.** Over a role, over an explicit allow, and over
 *    `administrator` itself. This is the rule that must never acquire an
 *    exception: somebody who denies a permission deliberately is relying on
 *    it having happened, and a deny that silently loses to a grant elsewhere
 *    is worse than no deny at all.
 *
 * Note what rule 3 costs: an administrator can be denied a single permission
 * and stop being able to do it. That is intended. The protection worth having
 * is not "an administrator can do anything" but "the last administrator
 * cannot be locked out", which is a separate check against the account, not
 * a special case in here.
 *
 * Answering with the resolved set rather than a predicate, so that a caller
 * resolves once per request and asks as often as it likes — and so that an
 * interface can show somebody what they have without guessing at it.
 */
const resolvePermissions = ({
  roles,
  overrides = [],
}: ResolvePermissionsOptions): ReadonlySet<Permission> => {
  const denied = new Set(
    overrides.filter((grant) => grant.effect === 'deny').map((grant) => grant.permission),
  );

  const granted = new Set<Permission>();

  for (const role of roles) {
    for (const permission of role.permissions) {
      granted.add(permission);
    }
  }

  for (const grant of overrides) {
    if (grant.effect === 'allow') {
      granted.add(grant.permission);
    }
  }

  if (granted.has(ADMINISTRATOR) && !denied.has(ADMINISTRATOR)) {
    for (const permission of PERMISSIONS) {
      granted.add(permission);
    }
  }

  for (const permission of denied) {
    granted.delete(permission);
  }

  return granted;
};

export { resolvePermissions };
export type { ResolvePermissionsOptions };
