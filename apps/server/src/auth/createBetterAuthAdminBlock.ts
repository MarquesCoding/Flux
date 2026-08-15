import { createMiddleware } from 'hono/factory';

/**
 * Closes better-auth's own administration endpoints.
 */
const createBetterAuthAdminBlock = () =>
  createMiddleware((context) =>
    Promise.resolve(
      context.json({ error: 'Account administration is at /api/admin/accounts.' }, 404),
    ),
  );

export { createBetterAuthAdminBlock };
