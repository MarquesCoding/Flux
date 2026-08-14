import { randomUUID } from 'node:crypto';
import type { WebhookSubscription } from '@FluxContracts/schemas/Webhook';
import type { WebhookStore } from './WebhookStore';

/**
 * Subscriptions held in memory, for tests and for a server started without a
 * database.
 *
 * The secret is derived from the id rather than drawn from a random source,
 * so a test can predict it and check what was signed. That is exactly what
 * makes it unfit for anything real, which is why it lives here and not in the
 * database store.
 */
const createMemoryWebhookStore = (): WebhookStore => {
  const subscriptions = new Map<string, { subscription: WebhookSubscription; secret: string }>();

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
  };
};

export { createMemoryWebhookStore };
