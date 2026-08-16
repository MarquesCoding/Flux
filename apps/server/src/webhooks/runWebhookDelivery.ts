import { WebhookPayloadSchema } from '@FluxContracts/schemas/Webhook';
import { deliverWebhook } from './deliverWebhook';
import type { WebhookFetcher } from './deliverWebhook';
import type { WebhookStore } from './WebhookStore';

type RunWebhookDeliveryOptions = {
  subscriptions: WebhookStore;
  subscriptionId: string;
  payload: string;
  fetchImpl?: WebhookFetcher;
};

/**
 * Carries out one queued delivery, and reports whether it is worth retrying.
 *
 * @param subscriptions Where subscriptions are kept.
 * @param subscriptionId Who this delivery is for.
 * @param payload The envelope as it was queued.
 * @param fetchImpl How to make the request, so a test need not open a socket.
 */
const runWebhookDelivery = async ({
  subscriptions,
  subscriptionId,
  payload,
  fetchImpl,
}: RunWebhookDeliveryOptions): Promise<boolean> => {
  const target = await subscriptions.readTarget(subscriptionId);

  if (target === null) {
    return true;
  }

  const read = WebhookPayloadSchema.safeParse(JSON.parse(payload));

  if (!read.success) {
    await subscriptions.recordAttempt(subscriptionId, {
      ok: false,
      status: null,
      error: 'The queued event could not be read.',
    });

    return true;
  }

  const attempt = await deliverWebhook(target, read.data, fetchImpl);

  await subscriptions.recordAttempt(subscriptionId, attempt);
  await subscriptions.recordDelivery(
    { subscriptionId, eventId: read.data.id, event: read.data.event, body: payload },
    attempt,
  );

  return attempt.ok;
};

export { runWebhookDelivery };
