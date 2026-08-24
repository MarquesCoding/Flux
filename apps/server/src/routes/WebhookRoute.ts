import { createRoute, z } from '@hono/zod-openapi';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_PRESETS,
  WEBHOOK_SUBSCRIBABLE_EVENTS,
  WebhookFiltersSchema,
} from '@ValenceContracts/schemas/Webhook';

const WebhookError = z.object({ error: z.string() }).openapi('WebhookError');

const WebhookEvent = z.enum(WEBHOOK_EVENTS);

const SubscribableEvent = z.enum(WEBHOOK_SUBSCRIBABLE_EVENTS);

const WebhookPreset = z.enum(WEBHOOK_PRESETS);

const WebhookFilters = WebhookFiltersSchema.openapi('WebhookFilters');

const Webhook = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    url: z.string().url(),
    preset: WebhookPreset,
    events: z.array(WebhookEvent),
    filters: WebhookFilters,
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    lastAttemptAt: z.string().datetime().nullable(),
    lastStatus: z.number().int().nullable(),
    lastError: z.string().nullable(),
  })
  .openapi('Webhook');

const CreatedWebhook = Webhook.extend({ secret: z.string() }).openapi('CreatedWebhook');

const CreateWebhookRequest = z
  .object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    preset: WebhookPreset.default('generic'),
    events: z.array(SubscribableEvent).min(1),
    filters: WebhookFiltersSchema.prefault({}),
  })
  .openapi('CreateWebhookRequest');

const UpdateWebhookRequest = z
  .object({
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    preset: WebhookPreset.optional(),
    events: z.array(SubscribableEvent).min(1).optional(),
    filters: WebhookFiltersSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('UpdateWebhookRequest');

const listWebhooksRoute = createRoute({
  method: 'get',
  path: '/api/webhooks',
  tags: ['Webhooks'],
  summary: 'List the webhook subscriptions',
  responses: {
    200: {
      description: 'The subscriptions',
      content: { 'application/json': { schema: z.object({ webhooks: z.array(Webhook) }) } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

const createWebhookRoute = createRoute({
  method: 'post',
  path: '/api/webhooks',
  tags: ['Webhooks'],
  summary: 'Create a webhook subscription',
  request: { body: { content: { 'application/json': { schema: CreateWebhookRequest } } } },
  responses: {
    201: {
      description: 'The subscription, with its secret shown this once',
      content: { 'application/json': { schema: CreatedWebhook } },
    },
    400: {
      description: 'Valence will not send deliveries to that address',
      content: { 'application/json': { schema: WebhookError } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

const updateWebhookRoute = createRoute({
  method: 'patch',
  path: '/api/webhooks/{id}',
  tags: ['Webhooks'],
  summary: 'Change a webhook subscription',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateWebhookRequest } } },
  },
  responses: {
    200: { description: 'The subscription', content: { 'application/json': { schema: Webhook } } },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
    400: {
      description: 'Valence will not send deliveries to that address',
      content: { 'application/json': { schema: WebhookError } },
    },
    404: {
      description: 'No such subscription',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

const deleteWebhookRoute = createRoute({
  method: 'delete',
  path: '/api/webhooks/{id}',
  tags: ['Webhooks'],
  summary: 'Delete a webhook subscription',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'The subscription is gone' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
    404: {
      description: 'No such subscription',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

const testWebhookRoute = createRoute({
  method: 'post',
  path: '/api/webhooks/{id}/test',
  tags: ['Webhooks'],
  summary: 'Send a test delivery',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    202: {
      description: 'The test delivery is queued',
      content: { 'application/json': { schema: z.object({ queued: z.boolean() }) } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
    404: {
      description: 'No such subscription, or it is turned off',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

const WebhookDelivery = z
  .object({
    id: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    event: WebhookEvent,
    attempts: z.number().int().positive(),
    firstAttemptAt: z.string().datetime(),
    lastAttemptAt: z.string().datetime(),
    ok: z.boolean(),
    status: z.number().int().nullable(),
    error: z.string().nullable(),
  })
  .openapi('WebhookDelivery');

const DELIVERY_PAGE = 25;

const listWebhookDeliveriesRoute = createRoute({
  method: 'get',
  path: '/api/webhooks/{id}/deliveries',
  tags: ['Webhooks'],
  summary: 'List recent deliveries to a webhook subscription',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'The deliveries',
      content: {
        'application/json': { schema: z.object({ deliveries: z.array(WebhookDelivery) }) },
      },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
    404: {
      description: 'No such subscription',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

const redeliverWebhookRoute = createRoute({
  method: 'post',
  path: '/api/webhooks/{id}/deliveries/{deliveryId}/redeliver',
  tags: ['Webhooks'],
  summary: 'Send a delivery again',
  request: {
    params: z.object({ id: z.string().uuid(), deliveryId: z.string().uuid() }),
  },
  responses: {
    202: {
      description: 'The delivery is queued again',
      content: { 'application/json': { schema: z.object({ queued: z.boolean() }) } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: WebhookError } },
    },
    403: {
      description: 'Not allowed to manage webhooks',
      content: { 'application/json': { schema: WebhookError } },
    },
    404: {
      description: 'No such delivery, or the subscription is gone or turned off',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

export {
  createWebhookRoute,
  deleteWebhookRoute,
  listWebhookDeliveriesRoute,
  listWebhooksRoute,
  redeliverWebhookRoute,
  testWebhookRoute,
  updateWebhookRoute,
  DELIVERY_PAGE,
};
