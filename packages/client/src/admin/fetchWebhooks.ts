import { readFromServer } from '@FluxClient/query/readFromServer';
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

/**
 * Reads the webhook subscriptions on this server, with how each last fared.
 *
 * @returns The subscriptions, or none where the request failed.
 */
const fetchWebhooks = async (): Promise<WebhookSubscription[]> => {
  return (
    await readFromServer(
      '/api/webhooks',
      z.object({ webhooks: z.array(WebhookSubscriptionSchema) }),
    )
  ).webhooks;
};

/**
 * Creates a webhook subscription and answers with its signing secret, which is shown once — the
 * server keeps a hash, so an operator who loses it makes a new subscription.
 *
 * @param webhook - Where to deliver, which events, and what to call it.
 * @returns The subscription and its secret, or why it was refused.
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

/**
 * Turns a subscription's deliveries on or off, which is the reversible answer to an endpoint that
 * has started failing.
 *
 * @param id - The subscription.
 * @param enabled - Whether it should be delivering.
 * @returns Any refusal from the server.
 */
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

/**
 * Removes a subscription and the record of everything it was sent. Turning it off is the reversible
 * answer to an endpoint that has started failing; this is not.
 *
 * @param id - The subscription to remove.
 * @returns Any refusal from the server.
 */
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
 * Asks for a test delivery, so an operator can see whether the address they typed actually receives
 * anything before waiting for something real to happen.
 *
 * @param id - The subscription to test.
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
 * Reads what has lately been sent to one subscriber and what came back, newest first — the answer to
 * "is this working", which is otherwise invisible.
 *
 * @param id - The subscription.
 * @returns Its recent deliveries.
 */
const fetchWebhookDeliveries = async (id: string): Promise<WebhookDelivery[]> => {
  return (
    await readFromServer(
      `/api/webhooks/${id}/deliveries`,
      z.object({ deliveries: z.array(WebhookDeliverySchema) }),
    )
  ).deliveries;
};

/**
 * Asks for one delivery to be sent again, for a subscriber that was down when it first went out.
 *
 * @param id - The subscription it was sent to.
 * @param deliveryId - The delivery to send again.
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
