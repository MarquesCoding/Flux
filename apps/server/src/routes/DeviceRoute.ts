import { createRoute, z } from '@hono/zod-openapi';

const DeviceError = z.object({ error: z.string() }).openapi('DeviceError');

const DeviceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable(),
    signedInAt: z.string(),
    expiresAt: z.string(),
    isCurrent: z.boolean(),
  })
  .openapi('Device');

const DeviceListSchema = z.object({ devices: z.array(DeviceSchema) }).openapi('DeviceList');

/**
 * Everywhere this account is signed in.
 *
 * A self-hosted server is shared with a household, and a household loses
 * track of what is signed in where. This is the answer, and the way to do
 * something about it.
 */
const listDevicesRoute = createRoute({
  method: 'get',
  path: '/api/account/devices',
  tags: ['Account'],
  summary: 'List everywhere this account is signed in',
  responses: {
    200: {
      description: 'The sessions this account holds',
      content: { 'application/json': { schema: DeviceListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DeviceError } },
    },
  },
});

/**
 * Ends one of them.
 */
const endDeviceRoute = createRoute({
  method: 'delete',
  path: '/api/account/devices/{id}',
  tags: ['Account'],
  summary: 'Sign a device out',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Signed out' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DeviceError } },
    },
  },
});

/**
 * Ends all of them but this one.
 *
 * The thing somebody wants after losing a laptop, and the reason it does not
 * end the session asking: being signed out of the page you are using to sign
 * everything else out is its own small disaster.
 */
const endOtherDevicesRoute = createRoute({
  method: 'post',
  path: '/api/account/devices/end-others',
  tags: ['Account'],
  summary: 'Sign out everywhere else',
  responses: {
    204: { description: 'Signed out everywhere else' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DeviceError } },
    },
  },
});

export { listDevicesRoute, endDeviceRoute, endOtherDevicesRoute };
