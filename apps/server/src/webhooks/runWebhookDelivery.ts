import { WebhookPayloadSchema } from '@FluxContracts/schemas/Webhook';
import { deliverWebhook } from './deliverWebhook';
import type { WebhookFetcher } from './deliverWebhook';
import type { WebhookStore } from './WebhookStore';

type RunWebhookDeliveryOptions = {
  subscriptions: WebhookStore;
  subscriptionId: string;
  /**
   * The envelope as it was queued.
   */
  payload: string;
  fetchImpl?: WebhookFetcher;
};

/**
 * Carries out one queued delivery, and reports whether it is worth retrying.
 *
 * True means done with; false means the queue should try again. That
 * distinction is the whole reason this is separate from `deliverWebhook`,
 * because the two failures it can meet want opposite treatment:
 *
 * A subscription that has been deleted or turned off since the event was
 * raised is **not** a failure. There is nobody to deliver to any more, and
 * retrying would deliver to a subscription somebody switched off on purpose.
 * The same is true of a payload that no longer parses, which can only mean a
 * job queued by a version that spoke a different envelope — retrying it would
 * fail identically for as long as the queue kept it.
 *
 * A receiver that answered badly or did not answer at all **is** a failure,
 * and is worth another go with backoff.
 *
 * Either way the attempt is recorded first, so a subscription that is
 * silently failing shows it in the one place somebody would look.
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
