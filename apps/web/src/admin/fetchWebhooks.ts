import { z } from 'zod';
import { WebhookDeliverySchema, WebhookSubscriptionSchema } from '@FluxContracts/schemas/Webhook';
import type {
  WebhookDelivery,
  WebhookEvent,
  WebhookPreset,
  WebhookSubscription,
} from '@FluxContracts/schemas/Webhook';

/**
 * A subscription at the one moment its secret can be read.
 */
const CreatedWebhookSchema = WebhookSubscriptionSchema.extend({ secret: z.string() });

type CreatedWebhook = z.infer<typeof CreatedWebhookSchema>;

/**
 * What somebody filled in to make one.
 */
type NewWebhook = {
  name: string;
  url: string;
  preset: WebhookPreset;
  events: WebhookEvent[];
};

/**
 * Why the server refused, or null when it did not.
 *
 * Carried back rather than swallowed. The refusal that matters here is the
 * address guard: "Flux will not send deliveries to that address" is a
 * deliberate rule, and a UI reporting it as "something went wrong" makes a
 * careful decision look like a fault.
 */
type Refusal = { message: string } | null;

const readRefusal = async (response: Response): Promise<Refusal> => {
  if (response.ok) {
    return null;
  }

  const body = await response
    .json()
    .then((value) => z.object({ error: z.string() }).safeParse(value))
    .catch(() => null);

  return {
    message:
      body?.success === true ? body.data.error : 'That could not be done. Try again in a moment.',
  };
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
 *
 * The secret comes back exactly once. Whatever calls this is the last thing
 * that can show it to anybody, which is why it is answered rather than left
 * to be read back from the listing.
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
 *
 * Answers as soon as it is queued rather than when it lands, which is what
 * the route does. Whether it landed shows up on the subscription itself, the
 * same as every other delivery.
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
 *
 * Answers nothing rather than failing where the subscription has gone: a
 * history that cannot be read is not worth breaking the page over, and the
 * listing beside it already says whether the subscription is there.
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
 *
 * Answers as soon as it is queued. The result appears on the delivery it
 * belongs to, as another attempt at it, rather than as a new row.
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
