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
 * Addressed to a single subscription rather than published on the bus, which
 * is the difference between this and every other event. Publishing
 * `webhook.test` would deliver it to everybody subscribed to tests, so
 * pressing test on one receiver would set off somebody else's phone.
 *
 * Everything after the addressing is deliberately identical to a real
 * delivery: the same envelope, the same queue, the same signature, the same
 * retries, the same recorded result. A test that took a shortcut could pass
 * while the path that matters is broken, which is the one thing a test button
 * must not do.
 *
 * False means there is nothing to test — no such subscription, or one that is
 * turned off.
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
