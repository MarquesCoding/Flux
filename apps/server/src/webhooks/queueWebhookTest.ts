import { stampWebhookEnvelope } from '@FluxServer/events/stampWebhookEnvelope';
import type { WebhookStore } from './WebhookStore';

type QueueWebhookTestOptions = {
  subscriptions: WebhookStore;
  subscriptionId: string;
  enqueue: (subscriptionId: string, payload: string) => Promise<void>;
};

/**
 * Queues a test delivery to one subscription, and says whether there was one.
 *
 * @param subscriptions Where subscriptions are kept.
 * @param subscriptionId Which one to test.
 * @param enqueue How a delivery is queued.
 */
const queueWebhookTest = async ({
  subscriptions,
  subscriptionId,
  enqueue,
}: QueueWebhookTestOptions): Promise<boolean> => {
  const target = await subscriptions.readTarget(subscriptionId);

  if (target === null) {
    return false;
  }

  await enqueue(subscriptionId, stampWebhookEnvelope({ event: 'webhook.test', data: {} }));

  return true;
};

export { queueWebhookTest };
