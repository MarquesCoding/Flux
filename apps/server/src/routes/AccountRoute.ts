import { createRoute, z } from '@hono/zod-openapi';

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
    roles: z.array(z.string()),
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

const inviteAccountRoute = createRoute({
  method: 'post',
  path: '/api/admin/accounts',
  tags: ['Accounts'],
  summary: 'Add an account, with a password to hand over',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100),
            email: z.string().email(),
            password: z.string().min(8).max(200),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'The account was created and given the default role',
      content: { 'application/json': { schema: Account } },
    },
    400: {
      description: 'The account could not be created',
      content: { 'application/json': { schema: AccountError } },
    },
    403: {
      description: 'Not permitted',
      content: { 'application/json': { schema: AccountError } },
    },
  },
});

const editAccountRoute = createRoute({
  method: 'patch',
  path: '/api/admin/accounts/{userId}',
  tags: ['Accounts'],
  summary: 'Change an account’s name or address',
  request: {
    params: z.object({ userId: z.string().min(1) }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100).optional(),
            email: z.string().email().optional(),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: 'The account was changed' },
    400: {
      description: 'The change was refused',
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

export {
  listAccountsRoute,
  banAccountRoute,
  unbanAccountRoute,
  removeAccountRoute,
  inviteAccountRoute,
  editAccountRoute,
};
