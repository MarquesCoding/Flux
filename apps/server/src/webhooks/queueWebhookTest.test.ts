import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookPayloadSchema } from '@FluxContracts/schemas/Webhook';
import { createMemoryWebhookStore } from './createMemoryWebhookStore';
import { queueWebhookTest } from './queueWebhookTest';
import type { WebhookStore } from './WebhookStore';
import type { Mock } from 'vitest';

type Enqueue = (subscriptionId: string, payload: string) => Promise<void>;

let subscriptions: WebhookStore;

beforeEach(() => {
  subscriptions = createMemoryWebhookStore();
});

const queueing = (): Mock<Enqueue> => vi.fn<Enqueue>().mockResolvedValue(undefined);

const aSubscription = async () =>
  subscriptions.create({
    name: 'Discord',
    url: 'https://example.com/hook',
    preset: 'generic',
    events: ['job.failed'],
  });

describe('queueWebhookTest', () => {
  it('queues a test for the subscription that was asked about', async () => {
    const { subscription } = await aSubscription();
    const enqueue = queueing();

    const queued = await queueWebhookTest({
      subscriptions,
      subscriptionId: subscription.id,
      enqueue,
    });

    expect(queued).toBe(true);
    expect(enqueue.mock.calls[0]?.[0]).toBe(subscription.id);
  });

  it('sends a test that reads as one', async () => {
    const { subscription } = await aSubscription();
    const enqueue = queueing();

    await queueWebhookTest({ subscriptions, subscriptionId: subscription.id, enqueue });

    const payload = WebhookPayloadSchema.parse(JSON.parse(enqueue.mock.calls[0]?.[1] ?? ''));

    expect(payload.event).toBe('webhook.test');
  });

  it('does not set off every other subscriber that listens for tests', async () => {
    const { subscription } = await aSubscription();
    await subscriptions.create({
      name: 'Somebody else',
      url: 'https://elsewhere.example.com/hook',
      preset: 'generic',
      events: ['webhook.test'],
    });
    const enqueue = queueing();

    await queueWebhookTest({ subscriptions, subscriptionId: subscription.id, enqueue });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[0]).toBe(subscription.id);
  });

  it('has nothing to test when the subscription is turned off', async () => {
    const { subscription } = await aSubscription();
    const enqueue = queueing();

    await subscriptions.update(subscription.id, { enabled: false });

    expect(
      await queueWebhookTest({ subscriptions, subscriptionId: subscription.id, enqueue }),
    ).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('has nothing to test when there is no such subscription', async () => {
    const enqueue = queueing();

    expect(await queueWebhookTest({ subscriptions, subscriptionId: 'missing', enqueue })).toBe(
      false,
    );
    expect(enqueue).not.toHaveBeenCalled();
  });
});
