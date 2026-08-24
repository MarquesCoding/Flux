import { stampWebhookEnvelope } from './stampWebhookEnvelope';
import type { EventBus } from './EventBus';
import type { WebhookStore } from '@ValenceServer/webhooks/WebhookStore';

type CreateWebhookEventBusOptions = {
  subscriptions: WebhookStore;
  enqueue: (subscriptionId: string, payload: string) => Promise<void>;
  onProblem?: (reason: string) => void;
};

/**
 * Turns something happening on the server into a delivery queued for every subscriber that asked
 * about it. The bus knows nothing about HTTP or retries — it decides who cares, and the queue does
 * the rest.
 *
 * @param options - Where subscriptions are stored, and how to queue a delivery.
 * @returns The event bus.
 */
const createWebhookEventBus = ({
  subscriptions,
  enqueue,
  onProblem,
}: CreateWebhookEventBusOptions): EventBus => ({
  publish: async (occurrence) => {
    try {
      const listeners = await subscriptions.listenersFor(occurrence);

      if (listeners.length === 0) {
        return;
      }

      const payload = stampWebhookEnvelope(occurrence);

      for (const subscriptionId of listeners) {
        await enqueue(subscriptionId, payload);
      }
    } catch (error) {
      onProblem?.(error instanceof Error ? error.message : 'An event could not be published.');
    }
  },
});

export { createWebhookEventBus };
