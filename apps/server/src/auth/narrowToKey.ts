import type { Permission } from '@FluxContracts/schemas/Permission';

/**
 * What a key may do, given what its account may do.
 *
 * The one rule this feature has: **a key can never do more than the account it
 * belongs to.** A key is a credential handed to a script, a dashboard or an
 * assistant, and one that could reach past its owner is a hole with a
 * convenient interface — the account's permissions are the ceiling, always,
 * and nothing on the key can raise it.
 *
 * What a key may do is therefore subtractive only. `allowed` names the
 * permissions the key is restricted to, and the answer is the intersection: a
 * permission has to be held by the account *and* named by the key. Naming one
 * the account does not hold grants nothing, which is the property worth
 * testing rather than assuming — a narrowing list read as a grant list is the
 * mistake that turns this from a restriction into an escalation.
 *
 * `null` means the key is unrestricted, which is not the same as naming
 * nothing: an unrestricted key is exactly its account, while a key restricted
 * to the empty set can do nothing at all. Both are legitimate and they must
 * not collapse into each other.
 *
 * `administrator` is not special here. It implies everything when an account
 * holds it, and a key restricted away from it simply does not have it — a
 * read-only key belonging to the operator is the whole point of the feature.
 */
const narrowToKey = (
  held: ReadonlySet<Permission>,
  allowed: ReadonlySet<Permission> | null,
): ReadonlySet<Permission> =>
  allowed === null ? held : new Set([...allowed].filter((permission) => held.has(permission)));

export { narrowToKey };
