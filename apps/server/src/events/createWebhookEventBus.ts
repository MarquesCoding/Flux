import { randomUUID } from 'node:crypto';
import { WEBHOOK_PAYLOAD_VERSION } from '@FluxContracts/schemas/Webhook';
import type { EventBus } from './EventBus';
import type { WebhookStore } from '@FluxServer/webhooks/WebhookStore';

type CreateWebhookEventBusOptions = {
  subscriptions: WebhookStore;
  /**
   * Queues one delivery, answering nothing useful.
   *
   * Narrower than the whole `JobQueue` on purpose: the bus enqueues and does
   * not read state, cancel, or schedule, and a port that says so cannot grow
   * a dependency on the rest of the queue by accident.
   */
  enqueue: (subscriptionId: string, payload: string) => Promise<void>;
  onProblem?: (reason: string) => void;
};

/**
 * The bus that turns something happening into queued deliveries.
 *
 * Two properties matter more than anything else here, and both are about what
 * this must never do to the work that raised the event.
 *
 * It never throws. A scan that finished is a scan that finished, whether or
 * not anybody could be told about it, and an exception escaping here would
 * fail the job that succeeded. Problems are reported and swallowed.
 *
 * It never delivers. It resolves who is listening and queues one job each,
 * which is work measured in a query rather than in however long somebody
 * else's endpoint takes to answer.
 *
 * The payload is carried as the exact JSON string that will be signed. Left
 * as an object it would be re-encoded by the queue on the way in and again on
 * the way out, and while both encodings mean the same thing, only one of them
 * is the one the signature was computed over.
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

      const payload = JSON.stringify({
        version: WEBHOOK_PAYLOAD_VERSION,
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        ...occurrence,
      });

      for (const subscriptionId of listeners) {
        await enqueue(subscriptionId, payload);
      }
    } catch (error) {
      onProblem?.(error instanceof Error ? error.message : 'An event could not be published.');
    }
  },
});

export { createWebhookEventBus };
