import { readFromServer } from '@ValenceClient/query/readFromServer';
import { MyPermissionsSchema } from '@ValenceContracts/schemas/Permission';
import type { MyPermissions } from '@ValenceContracts/schemas/Permission';

/**
 * What the account signed in may do, as the server resolves it.
 *
 * Asked of the server rather than read off the session, because the session carries the column
 * better-auth keeps and Valence decides authority from roles and overrides instead. The two agree
 * only until somebody is promoted, which is exactly when a screen needs the answer to be right.
 *
 * @returns The permissions held, and whether they amount to administering the server.
 */
const fetchMyPermissions = (): Promise<MyPermissions> =>
  readFromServer('/api/account/permissions', MyPermissionsSchema);

export { fetchMyPermissions };
