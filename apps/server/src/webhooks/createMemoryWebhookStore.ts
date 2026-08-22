import { randomUUID } from 'node:crypto';
import type { WebhookDelivery, WebhookSubscription } from '@ValenceContracts/schemas/Webhook';
import type { WebhookStore } from './WebhookStore';

/**
 * Subscriptions held in memory, for tests and for a server started without a database.
 */
const createMemoryWebhookStore = (): WebhookStore => {
  const subscriptions = new Map<string, { subscription: WebhookSubscription; secret: string }>();
  const deliveries = new Map<
    string,
    { delivery: WebhookDelivery; body: string; eventId: string }
  >();

  /**
   * Finds the delivery already filed for one event and one subscriber, so a retry updates the attempt
   * that exists rather than filing a second record of the same thing.
   *
   * @param state - The deliveries held.
   * @param subscriptionId - Who is being delivered to.
   * @param eventId - Which event.
   * @returns The delivery already filed, or undefined where this is the first attempt.
   */
  const findOccurrence = (subscriptionId: string, eventId: string) =>
    [...deliveries.values()].find(
      (held) => held.delivery.subscriptionId === subscriptionId && held.eventId === eventId,
    );

  return {
    list: () => Promise.resolve([...subscriptions.values()].map((held) => held.subscription)),

    create: ({ name, url, preset, events }) => {
      const id = randomUUID();
      const held = {
        secret: `whsec_memory_${id}`,
        subscription: {
          id,
          name,
          url,
          preset,
          events,
          enabled: true,
          createdAt: new Date().toISOString(),
          lastAttemptAt: null,
          lastStatus: null,
          lastError: null,
        },
      };

      subscriptions.set(id, held);

      return Promise.resolve(held);
    },

    update: (id, change) => {
      const held = subscriptions.get(id);

      if (held === undefined) {
        return Promise.resolve(null);
      }

      const changed = { ...held.subscription, enabled: change.enabled };

      subscriptions.set(id, { ...held, subscription: changed });

      return Promise.resolve(changed);
    },

    remove: (id) => Promise.resolve(subscriptions.delete(id)),

    listenersFor: (event) =>
      Promise.resolve(
        [...subscriptions.values()]
          .filter((held) => held.subscription.enabled && held.subscription.events.includes(event))
          .map((held) => held.subscription.id),
      ),

    readTarget: (id) => {
      const held = subscriptions.get(id);

      if (held === undefined || !held.subscription.enabled) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        url: held.subscription.url,
        preset: held.subscription.preset,
        secret: held.secret,
      });
    },

    recordAttempt: (id, attempt) => {
      const held = subscriptions.get(id);

      if (held !== undefined) {
        subscriptions.set(id, {
          ...held,
          subscription: {
            ...held.subscription,
            lastAttemptAt: new Date().toISOString(),
            lastStatus: attempt.status,
            lastError: attempt.error,
          },
        });
      }

      return Promise.resolve();
    },

    recordDelivery: ({ subscriptionId, eventId, event, body }, attempt) => {
      const at = new Date().toISOString();
      const existing = findOccurrence(subscriptionId, eventId);

      if (existing === undefined) {
        const id = randomUUID();

        deliveries.set(id, {
          eventId,
          body,
          delivery: {
            id,
            subscriptionId,
            event,
            attempts: 1,
            firstAttemptAt: at,
            lastAttemptAt: at,
            ok: attempt.ok,
            status: attempt.status,
            error: attempt.error,
          },
        });

        return Promise.resolve();
      }

      deliveries.set(existing.delivery.id, {
        ...existing,
        delivery: {
          ...existing.delivery,
          attempts: existing.delivery.attempts + 1,
          lastAttemptAt: at,
          ok: attempt.ok,
          status: attempt.status,
          error: attempt.error,
        },
      });

      return Promise.resolve();
    },

    listDeliveries: (subscriptionId, limit) =>
      Promise.resolve(
        [...deliveries.values()]
          .map((held) => held.delivery)
          .filter((delivery) => delivery.subscriptionId === subscriptionId)
          .sort((one, other) => other.lastAttemptAt.localeCompare(one.lastAttemptAt))
          .slice(0, limit),
      ),

    readDeliveryBody: (subscriptionId, deliveryId) => {
      const held = deliveries.get(deliveryId);

      return Promise.resolve(
        held === undefined || held.delivery.subscriptionId !== subscriptionId ? null : held.body,
      );
    },

    pruneDeliveries: (before) => {
      const doomed = [...deliveries.values()].filter(
        (held) => new Date(held.delivery.lastAttemptAt) < before,
      );

      for (const held of doomed) {
        deliveries.delete(held.delivery.id);
      }

      return Promise.resolve(doomed.length);
    },
  };
};

export { createMemoryWebhookStore };
