import { createRoute, z } from '@hono/zod-openapi';
import { WEBHOOK_EVENTS, WEBHOOK_PRESETS } from '@FluxContracts/schemas/Webhook';

const WebhookError = z.object({ error: z.string() }).openapi('WebhookError');

const WebhookEvent = z.enum(WEBHOOK_EVENTS);

const WebhookPreset = z.enum(WEBHOOK_PRESETS);

/**
 * A subscription as it can safely be shown again.
 *
 * The signing secret is absent by design, the same as an API key's key: it is
 * answered once when the subscription is made and never again, because a list
 * endpoint that returned every secret would be one stolen session away from
 * letting somebody forge deliveries.
 *
 * `lastAttemptAt`, `lastStatus` and `lastError` are the point of the listing
 * rather than decoration on it. A webhook that quietly stopped working looks
 * exactly like one that works until somebody reads these.
 */
const Webhook = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    url: z.string().url(),
    preset: WebhookPreset,
    events: z.array(WebhookEvent),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    lastAttemptAt: z.string().datetime().nullable(),
    lastStatus: z.number().int().nullable(),
    lastError: z.string().nullable(),
  })
  .openapi('Webhook');

/**
 * A subscription at the one moment its secret can be read.
 */
const CreatedWebhook = Webhook.extend({ secret: z.string() }).openapi('CreatedWebhook');

const CreateWebhookRequest = z
  .object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    preset: WebhookPreset.default('generic'),
    events: z.array(WebhookEvent).min(1),
  })
  .openapi('CreateWebhookRequest');

const UpdateWebhookRequest = z.object({ enabled: z.boolean() }).openapi('UpdateWebhookRequest');

/**
 * Lists what this server has been asked to tell people about.
 */
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

/**
 * Creates a subscription and answers with its secret once.
 *
 * The only response that carries the secret. Refuses an address Flux will not
 * send to — the link-local range and the metadata services inside it — rather
 * than accepting it and failing every delivery afterwards, because a
 * subscription that can never work should not be creatable.
 */
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
      description: 'Flux will not send deliveries to that address',
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

/**
 * Turns a subscription off, or back on, without destroying it.
 *
 * Where a receiver is being worked on, this is what stops the deliveries
 * without losing the secret that was agreed with it.
 */
const updateWebhookRoute = createRoute({
  method: 'patch',
  path: '/api/webhooks/{id}',
  tags: ['Webhooks'],
  summary: 'Enable or disable a webhook subscription',
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
    404: {
      description: 'No such subscription',
      content: { 'application/json': { schema: WebhookError } },
    },
  },
});

/**
 * Destroys a subscription.
 */
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

/**
 * Sends a test delivery, through the same path a real one takes.
 *
 * Deliberately a real event queued on the real queue rather than a request
 * made inline: a test that took a different path could pass while the path
 * that matters is broken, which is the one thing a test button must not do.
 *
 * It answers as soon as the delivery is queued, so a receiver that hangs
 * cannot hang the browser that asked. Whether it landed appears where every
 * other delivery's result appears — on the subscription itself.
 */
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

export {
  createWebhookRoute,
  deleteWebhookRoute,
  listWebhooksRoute,
  testWebhookRoute,
  updateWebhookRoute,
};
