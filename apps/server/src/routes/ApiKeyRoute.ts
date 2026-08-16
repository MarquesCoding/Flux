import { createRoute, z } from '@hono/zod-openapi';
import { PERMISSIONS } from '@FluxContracts/schemas/Permission';

const ApiKeyError = z.object({ error: z.string() }).openapi('ApiKeyError');

const Permission = z.enum(PERMISSIONS);

const ApiKey = z
  .object({
    id: z.string(),
    name: z.string(),
    start: z.string().nullable(),
    enabled: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
    lastRequestAt: z.string().datetime().nullable(),
    requestCount: z.number().int().nonnegative(),
    permissions: z.array(Permission).nullable(),
    rateLimit: z
      .object({ max: z.number().int().positive(), everySeconds: z.number().int().positive() })
      .nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('ApiKey');

const CreatedApiKey = ApiKey.extend({ key: z.string() }).openapi('CreatedApiKey');

const CreateApiKeyRequest = z
  .object({
    name: z.string().min(1).max(100),
    expiresInDays: z.number().int().positive().max(3650).nullable().default(null),
    permissions: z.array(Permission).nullable().default(null),
    rateLimit: z
      .object({
        max: z.number().int().positive().max(100_000),
        everySeconds: z.number().int().positive().max(86_400),
      })
      .nullable()
      .default(null),
  })
  .openapi('CreateApiKeyRequest');

const UpdateApiKeyRequest = z.object({ enabled: z.boolean() }).openapi('UpdateApiKeyRequest');

const listApiKeysRoute = createRoute({
  method: 'get',
  path: '/api/keys',
  tags: ['Keys'],
  summary: 'List the API keys on this account',
  responses: {
    200: {
      description: 'The keys',
      content: { 'application/json': { schema: z.object({ keys: z.array(ApiKey) }) } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ApiKeyError } },
    },
    403: {
      description: 'Not allowed to hold keys',
      content: { 'application/json': { schema: ApiKeyError } },
    },
  },
});

const createApiKeyRoute = createRoute({
  method: 'post',
  path: '/api/keys',
  tags: ['Keys'],
  summary: 'Create an API key',
  request: { body: { content: { 'application/json': { schema: CreateApiKeyRequest } } } },
  responses: {
    201: {
      description: 'The key, shown this once',
      content: { 'application/json': { schema: CreatedApiKey } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ApiKeyError } },
    },
    403: {
      description: 'Not allowed to hold keys',
      content: { 'application/json': { schema: ApiKeyError } },
    },
  },
});

const updateApiKeyRoute = createRoute({
  method: 'patch',
  path: '/api/keys/{id}',
  tags: ['Keys'],
  summary: 'Enable or disable an API key',
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: { 'application/json': { schema: UpdateApiKeyRequest } } },
  },
  responses: {
    200: { description: 'The key', content: { 'application/json': { schema: ApiKey } } },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ApiKeyError } },
    },
    403: {
      description: 'Not allowed to hold keys',
      content: { 'application/json': { schema: ApiKeyError } },
    },
    404: {
      description: 'No such key on this account',
      content: { 'application/json': { schema: ApiKeyError } },
    },
  },
});

const revokeApiKeyRoute = createRoute({
  method: 'delete',
  path: '/api/keys/{id}',
  tags: ['Keys'],
  summary: 'Revoke an API key',
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    204: { description: 'The key is gone' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ApiKeyError } },
    },
    403: {
      description: 'Not allowed to hold keys',
      content: { 'application/json': { schema: ApiKeyError } },
    },
    404: {
      description: 'No such key on this account',
      content: { 'application/json': { schema: ApiKeyError } },
    },
  },
});

export { listApiKeysRoute, createApiKeyRoute, updateApiKeyRoute, revokeApiKeyRoute };
