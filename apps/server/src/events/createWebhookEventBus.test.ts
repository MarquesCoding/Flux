import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookPayloadSchema } from '@FluxContracts/schemas/Webhook';
import { createMemoryWebhookStore } from '@FluxServer/webhooks/createMemoryWebhookStore';
import { createWebhookEventBus } from './createWebhookEventBus';
import type { WebhookEvent } from '@FluxContracts/schemas/Webhook';
import type { WebhookStore } from '@FluxServer/webhooks/WebhookStore';
import type { Mock } from 'vitest';

type Enqueue = (subscriptionId: string, payload: string) => Promise<void>;

const aFailure = {
  event: 'job.failed',
  data: { kind: 'library.scan', jobId: 'job-1', subject: 'library-1', reason: 'no space left' },
} as const;

let subscriptions: WebhookStore;

beforeEach(() => {
  subscriptions = createMemoryWebhookStore();
});

const queueing = (): Mock<Enqueue> => vi.fn<Enqueue>().mockResolvedValue(undefined);

const listening = async (events: WebhookEvent[]) =>
  subscriptions.create({
    name: 'Discord',
    url: 'https://example.com/hook',
    preset: 'generic',
    events,
  });

const payloadQueuedBy = (enqueue: Mock<Enqueue>, index = 0): string => {
  const queued = enqueue.mock.calls[index]?.[1];

  if (queued === undefined) {
    throw new Error('Nothing was queued.');
  }

  return queued;
};

describe('createWebhookEventBus', () => {
  it('queues one delivery for each subscription that asked', async () => {
    const first = await listening(['job.failed']);
    const second = await listening(['job.failed']);
    const enqueue = queueing();

    await createWebhookEventBus({ subscriptions, enqueue }).publish(aFailure);

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls.map((call) => call[0])).toStrictEqual([
      first.subscription.id,
      second.subscription.id,
    ]);
  });

  it('queues nothing when nobody asked for this event', async () => {
    await listening(['job.completed']);
    const enqueue = queueing();

    await createWebhookEventBus({ subscriptions, enqueue }).publish(aFailure);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('stamps the envelope so a call site does not have to', async () => {
    await listening(['job.failed']);
    const enqueue = queueing();

    await createWebhookEventBus({ subscriptions, enqueue }).publish(aFailure);

    const payload = WebhookPayloadSchema.parse(JSON.parse(payloadQueuedBy(enqueue)));

    expect(payload.event).toBe('job.failed');
    expect(payload.version).toBe(1);
    expect(payload.id).not.toBe('');
  });

  it('sends every subscriber the same occurrence, not one each', async () => {
    await listening(['job.failed']);
    await listening(['job.failed']);
    const enqueue = queueing();

    await createWebhookEventBus({ subscriptions, enqueue }).publish(aFailure);

    expect(payloadQueuedBy(enqueue, 0)).toBe(payloadQueuedBy(enqueue, 1));
  });

  it('does not fail the work that raised the event when the store is down', async () => {
    const broken: WebhookStore = {
      ...subscriptions,
      listenersFor: () => Promise.reject(new Error('the database went away')),
    };
    const onProblem = vi.fn();

    await expect(
      createWebhookEventBus({ subscriptions: broken, enqueue: queueing(), onProblem }).publish(
        aFailure,
      ),
    ).resolves.toBeUndefined();

    expect(onProblem).toHaveBeenCalledWith('the database went away');
  });

  it('does not fail the work that raised the event when the queue is down', async () => {
    await listening(['job.failed']);
    const onProblem = vi.fn();

    await expect(
      createWebhookEventBus({
        subscriptions,
        enqueue: vi.fn<Enqueue>().mockRejectedValue(new Error('the queue went away')),
        onProblem,
      }).publish(aFailure),
    ).resolves.toBeUndefined();

    expect(onProblem).toHaveBeenCalledWith('the queue went away');
  });
});
