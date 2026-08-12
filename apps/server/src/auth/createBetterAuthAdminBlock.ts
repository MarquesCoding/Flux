import { createMiddleware } from 'hono/factory';

/**
 * Closes better-auth's own administration endpoints.
 *
 * The `admin()` plugin serves list-users, set-role, ban-user, remove-user and
 * impersonation under `/api/auth/admin`, and authorises them against the
 * `user.role` column — which Flux's permission model replaced. Leaving them
 * reachable means two systems answering "may this account do that", and
 * disagreeing in both directions: denying somebody `administrator` would not
 * stop them banning accounts through here, and granting `account.manage`
 * would not let them.
 *
 * Refused rather than gated, because there is nothing useful to gate them
 * with — whatever answer better-auth gives is the wrong one. Flux serves
 * these operations itself under `/api/admin/accounts`, behind permissions
 * that mean something, and says so in the body rather than leaving somebody
 * to wonder where they went.
 *
 * Register it before the handler it shadows: Hono matches in the order routes
 * were added, so a block added afterwards would never be reached.
 *
 * The plugin itself stays registered, because `user.role` is still the column
 * seeding reads to carry an existing administrator into the role model.
 */
const createBetterAuthAdminBlock = () =>
  createMiddleware((context) =>
    Promise.resolve(
      context.json({ error: 'Account administration is at /api/admin/accounts.' }, 404),
    ),
  );

export { createBetterAuthAdminBlock };
