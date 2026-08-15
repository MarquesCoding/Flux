import { stampWebhookEnvelope } from './stampWebhookEnvelope';
import type { EventBus } from './EventBus';
import type { WebhookStore } from '@FluxServer/webhooks/WebhookStore';

type CreateWebhookEventBusOptions = {
  subscriptions: WebhookStore;
  enqueue: (subscriptionId: string, payload: string) => Promise<void>;
  onProblem?: (reason: string) => void;
};

/**
 * The bus that turns something happening into queued deliveries.
 */
const createWebhookEventBus = ({
  subscriptions,
  enqueue,
  onProblem,
}: CreateWebhookEventBusOptions): EventBus => ({
  publish: async (occurrence) => {
    try {
      const listeners = await subscriptions.listenersFor(occurrence.event);

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
