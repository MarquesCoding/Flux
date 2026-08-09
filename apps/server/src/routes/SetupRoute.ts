import { createRoute } from '@hono/zod-openapi'
import SetupModule from '@FluxContracts/schemas/Setup'

const { SetupStatusSchema, SetupRequestSchema, SetupResultSchema, SetupErrorSchema } = SetupModule

const StatusResponse = SetupStatusSchema.openapi('SetupStatus')
const SetupRequest = SetupRequestSchema.openapi('SetupRequest')
const SetupResult = SetupResultSchema.openapi('SetupResult')
const SetupError = SetupErrorSchema.openapi('SetupError')

/**
 * Reports whether this instance still needs first-run setup, and what the
 * server believes its own access URL to be.
 */
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
})

/**
 * Completes first-run setup: creates the administrator and stores the access
 * configuration.
 *
 * Refuses with 409 once any user exists. This is the only thing standing
 * between a fresh instance and anyone on the network claiming the admin
 * account, so the guard is on user count in the database rather than on a
 * settings flag that a wiped or hand-edited row could reset.
 */
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
})

export default { setupStatusRoute, setupCompleteRoute }
