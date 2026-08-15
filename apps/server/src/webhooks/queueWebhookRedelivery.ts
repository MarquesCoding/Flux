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
