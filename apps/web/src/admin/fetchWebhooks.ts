import { readRefusal } from './readRefusal';
import type { Refusal } from './readRefusal';
import { z } from 'zod';
import { WebhookDeliverySchema, WebhookSubscriptionSchema } from '@FluxContracts/schemas/Webhook';
import type {
  WebhookDelivery,
  WebhookEvent,
  WebhookPreset,
  WebhookSubscription,
} from '@FluxContracts/schemas/Webhook';

const CreatedWebhookSchema = WebhookSubscriptionSchema.extend({ secret: z.string() });

type CreatedWebhook = z.infer<typeof CreatedWebhookSchema>;

type NewWebhook = {
  name: string;
  url: string;
  preset: WebhookPreset;
  events: WebhookEvent[];
};

const fetchWebhooks = async (): Promise<WebhookSubscription[]> => {
  const response = await fetch('/api/webhooks', { credentials: 'same-origin' }).catch(() => null);

  if (response === null || !response.ok) {
    return [];
  }

  return z.object({ webhooks: z.array(WebhookSubscriptionSchema) }).parse(await response.json())
    .webhooks;
};

/**
 * Creates a subscription, answering it with its secret or saying why not.
 */
const createWebhook = async (
  webhook: NewWebhook,
): Promise<{ created: CreatedWebhook | null; refusal: Refusal }> => {
  const response = await fetch('/api/webhooks', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(webhook),
  }).catch(() => null);

  if (response === null) {
    return { created: null, refusal: { message: 'The server could not be reached.' } };
  }

  const refusal = await readRefusal(response);

  return refusal === null
    ? { created: CreatedWebhookSchema.parse(await response.json()), refusal: null }
    : { created: null, refusal };
};

const setWebhookEnabled = async (id: string, enabled: boolean): Promise<Refusal> => {
  const response = await fetch(`/api/webhooks/${id}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled }),
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

const deleteWebhook = async (id: string): Promise<Refusal> => {
  const response = await fetch(`/api/webhooks/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * Asks for a test delivery.
 */
const testWebhook = async (id: string): Promise<Refusal> => {
  const response = await fetch(`/api/webhooks/${id}/test`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

/**
 * What has been sent to one subscriber lately, newest first.
 */
const fetchWebhookDeliveries = async (id: string): Promise<WebhookDelivery[]> => {
  const response = await fetch(`/api/webhooks/${id}/deliveries`, {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return [];
  }

  return z.object({ deliveries: z.array(WebhookDeliverySchema) }).parse(await response.json())
    .deliveries;
};

/**
 * Asks for a delivery to be sent again.
 */
const redeliverWebhook = async (id: string, deliveryId: string): Promise<Refusal> => {
  const response = await fetch(`/api/webhooks/${id}/deliveries/${deliveryId}/redeliver`, {
    method: 'POST',
    credentials: 'same-origin',
  }).catch(() => null);

  return response === null
    ? { message: 'The server could not be reached.' }
    : readRefusal(response);
};

export {
  createWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  fetchWebhooks,
  redeliverWebhook,
  setWebhookEnabled,
  testWebhook,
};

export type { CreatedWebhook, NewWebhook, Refusal };
