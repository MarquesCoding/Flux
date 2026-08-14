import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryWebhookStore } from './createMemoryWebhookStore';
import { queueWebhookRedelivery } from './queueWebhookRedelivery';
import type { WebhookStore } from './WebhookStore';
import type { Mock } from 'vitest';

type Enqueue = (subscriptionId: string, payload: string) => Promise<void>;

const aBody = JSON.stringify({ id: 'event-1', event: 'job.failed' });

let subscriptions: WebhookStore;

beforeEach(() => {
  subscriptions = createMemoryWebhookStore();
});

const queueing = (): Mock<Enqueue> => vi.fn<Enqueue>().mockResolvedValue(undefined);

/**
 * A subscription with one delivery already in its history.
 */
const withADelivery = async () => {
  const { subscription } = await subscriptions.create({
    name: 'Discord',
    url: 'https://example.com/hook',
    preset: 'generic',
    events: ['job.failed'],
  });

  await subscriptions.recordDelivery(
    { subscriptionId: subscription.id, eventId: 'event-1', event: 'job.failed', body: aBody },
    { ok: false, status: 503, error: 'The receiver answered 503.' },
  );

  const [filed] = await subscriptions.listDeliveries(subscription.id, 10);

  return { subscriptionId: subscription.id, deliveryId: filed?.id ?? '' };
};

describe('queueWebhookRedelivery', () => {
  it('sends the same bytes rather than encoding the event again', async () => {
    const { subscriptionId, deliveryId } = await withADelivery();
    const enqueue = queueing();

    const sent = await queueWebhookRedelivery({
      subscriptions,
      subscriptionId,
      deliveryId,
      enqueue,
    });

    expect(sent).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(subscriptionId, aBody);
  });

  it('lands on the same delivery, as another attempt at it', async () => {
    const { subscriptionId, deliveryId } = await withADelivery();

    await queueWebhookRedelivery({
      subscriptions,
      subscriptionId,
      deliveryId,
      enqueue: async (id, payload) => {
        await subscriptions.recordDelivery(
          { subscriptionId: id, eventId: 'event-1', event: 'job.failed', body: payload },
          { ok: true, status: 200, error: null },
        );
      },
    });

    const filed = await subscriptions.listDeliveries(subscriptionId, 10);

    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({ attempts: 2, ok: true });
  });

  it('has nothing to send again for a delivery that was never made', async () => {
    const { subscriptionId } = await withADelivery();
    const enqueue = queueing();

    expect(
      await queueWebhookRedelivery({
        subscriptions,
        subscriptionId,
        deliveryId: 'missing',
        enqueue,
      }),
    ).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('will not replay one subscription delivery against another', async () => {
    const { subscriptionId, deliveryId } = await withADelivery();
    const other = await subscriptions.create({
      name: 'Somebody else',
      url: 'https://elsewhere.example.com/hook',
      preset: 'generic',
      events: ['job.failed'],
    });
    const enqueue = queueing();

    expect(
      await queueWebhookRedelivery({
        subscriptions,
        subscriptionId: other.subscription.id,
        deliveryId,
        enqueue,
      }),
    ).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
    expect(subscriptionId).not.toBe(other.subscription.id);
  });

  it('has nothing to send to a subscription that is turned off', async () => {
    const { subscriptionId, deliveryId } = await withADelivery();
    const enqueue = queueing();

    await subscriptions.update(subscriptionId, { enabled: false });

    expect(
      await queueWebhookRedelivery({ subscriptions, subscriptionId, deliveryId, enqueue }),
    ).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
