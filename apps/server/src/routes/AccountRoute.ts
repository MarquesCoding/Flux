import { createRoute, z } from '@hono/zod-openapi';

/**
 * An account as the administration page sees it.
 *
 * `position` is the highest rank among the roles it holds, or null when it
 * holds none — what decides whether somebody else may act on it.
 * `isAdministrator` is resolved from its permissions rather than read from
 * the old `user.role` column, so it answers what the account can actually do.
 */
const Account = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
    isBanned: z.boolean(),
    banReason: z.string().nullable(),
    position: z.number().nullable(),
    isAdministrator: z.boolean(),
  })
  .openapi('Account');

const AccountError = z.object({ error: z.string() }).openapi('AccountError');

const listAccountsRoute = createRoute({
  method: 'get',
  path: '/api/admin/accounts',
  tags: ['Accounts'],
  summary: 'List the accounts on this server',
  responses: {
    200: {
      description: 'Every account, with what it holds',
      content: { 'application/json': { schema: z.object({ accounts: z.array(Account) }) } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: AccountError } },
    },
  },
});

/**
 * Stops an account signing in, without destroying anything it owns.
 *
 * Reversible on purpose, which is what separates it from removal — a
 * household argument should not cost somebody their watch history.
 */
const banAccountRoute = createRoute({
  method: 'post',
  path: '/api/admin/accounts/{userId}/ban',
  tags: ['Accounts'],
  summary: 'Stop an account signing in',
  request: {
    params: z.object({ userId: z.string().min(1) }),
    body: {
      content: { 'application/json': { schema: z.object({ reason: z.string().max(200) }) } },
    },
  },
  responses: {
    204: { description: 'The account is banned and its sessions are ended' },
    400: {
      description: 'The ban was refused',
      content: { 'application/json': { schema: AccountError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: AccountError } },
    },
    404: {
      description: 'No such account',
      content: { 'application/json': { schema: AccountError } },
    },
  },
});

const unbanAccountRoute = createRoute({
  method: 'delete',
  path: '/api/admin/accounts/{userId}/ban',
  tags: ['Accounts'],
  summary: 'Let a banned account sign in again',
  request: { params: z.object({ userId: z.string().min(1) }) },
  responses: {
    204: { description: 'The account may sign in again' },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: AccountError } },
    },
    404: {
      description: 'No such account',
      content: { 'application/json': { schema: AccountError } },
    },
  },
});

/**
 * Deletes an account and everything hanging off it.
 *
 * Every cascade in the schema fires: profiles, progress, favourites, roles
 * and overrides all go. There is no undo, which is why banning exists.
 */
const removeAccountRoute = createRoute({
  method: 'delete',
  path: '/api/admin/accounts/{userId}',
  tags: ['Accounts'],
  summary: 'Delete an account and everything it owns',
  request: { params: z.object({ userId: z.string().min(1) }) },
  responses: {
    204: { description: 'The account is gone' },
    400: {
      description: 'The removal was refused',
      content: { 'application/json': { schema: AccountError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: AccountError } },
    },
    404: {
      description: 'No such account',
      content: { 'application/json': { schema: AccountError } },
    },
  },
});

export { listAccountsRoute, banAccountRoute, unbanAccountRoute, removeAccountRoute };
