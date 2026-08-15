import type { WebhookStore } from './WebhookStore';

type QueueWebhookRedeliveryOptions = {
  subscriptions: WebhookStore;
  subscriptionId: string;
  deliveryId: string;
  enqueue: (subscriptionId: string, payload: string) => Promise<void>;
};

/**
 * Sends a delivery again, exactly as it was sent the first time.
 *
 * The stored bytes are re-queued rather than the event being encoded afresh,
 * and the difference matters twice over. The signature is computed over
 * exactly those bytes, so a re-encoding that differed by a space would arrive
 * with a signature the receiver could not match against what it saw before.
 * And the envelope's id names the occurrence rather than the attempt, so
 * sending the same bytes is what lets a receiver recognise this as the event
 * it already has instead of acting on it twice.
 *
 * That also means a redelivery lands on the same row in the history and
 * counts as another attempt at the same delivery — which is the truthful
 * reading of what it is.
 *
 * False means there is nothing to send again: no such delivery on that
 * subscription, or a subscription that has since been deleted or turned off.
 *
 * @param subscriptions Where subscriptions and their history are kept.
 * @param subscriptionId Who the delivery was for.
 * @param deliveryId Which delivery to send again.
 * @param enqueue How a delivery is queued.
 */
const queueWebhookRedelivery = async ({
  subscriptions,
  subscriptionId,
  deliveryId,
  enqueue,
}: QueueWebhookRedeliveryOptions): Promise<boolean> => {
  const target = await subscriptions.readTarget(subscriptionId);

  if (target === null) {
    return false;
  }

  const body = await subscriptions.readDeliveryBody(subscriptionId, deliveryId);

  if (body === null) {
    return false;
  }

  await enqueue(subscriptionId, body);

  return true;
};

export { queueWebhookRedelivery };
