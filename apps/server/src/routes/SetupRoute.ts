import { createRoute } from '@hono/zod-openapi';
import {
  SetupStatusSchema,
  SetupRequestSchema,
  SetupResultSchema,
  SetupErrorSchema,
} from '@ValenceContracts/schemas/Setup';

const StatusResponse = SetupStatusSchema.openapi('SetupStatus');
const SetupRequest = SetupRequestSchema.openapi('SetupRequest');
const SetupResult = SetupResultSchema.openapi('SetupResult');
const SetupError = SetupErrorSchema.openapi('SetupError');

const setupStatusRoute = createRoute({
  method: 'get',
  path: '/api/setup/status',
  tags: ['Setup'],
  summary: 'Report first-run setup status',
  responses: {
    200: {
      description: 'Current setup status',
      content: { 'application/json': { schema: StatusResponse } },
    },
  },
});

const setupCompleteRoute = createRoute({
  method: 'post',
  path: '/api/setup',
  tags: ['Setup'],
  summary: 'Create the administrator and complete first-run setup',
  request: {
    body: { content: { 'application/json': { schema: SetupRequest } } },
  },
  responses: {
    200: {
      description: 'Setup completed',
      content: { 'application/json': { schema: SetupResult } },
    },
    409: {
      description: 'Setup has already been completed',
      content: { 'application/json': { schema: SetupError } },
    },
    400: {
      description: 'The administrator could not be created',
      content: { 'application/json': { schema: SetupError } },
    },
  },
});

export { setupStatusRoute, setupCompleteRoute };
