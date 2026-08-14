import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_PAYLOAD_VERSION } from '@FluxContracts/schemas/Webhook';
import { createMemoryWebhookStore } from './createMemoryWebhookStore';
import { runWebhookDelivery } from './runWebhookDelivery';
import type { WebhookFetcher } from './deliverWebhook';
import type { WebhookStore } from './WebhookStore';
import type { Mock } from 'vitest';

const anEnvelope = JSON.stringify({
  version: WEBHOOK_PAYLOAD_VERSION,
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  occurredAt: '2026-08-14T20:00:00.000Z',
  event: 'job.failed',
  data: { kind: 'library.scan', jobId: 'job-1', subject: null, reason: 'no space left' },
});

const answering = (status: number): Mock<WebhookFetcher> =>
  vi.fn<WebhookFetcher>().mockResolvedValue({ ok: status >= 200 && status < 300, status });

let subscriptions: WebhookStore;

beforeEach(() => {
  subscriptions = createMemoryWebhookStore();
});

const aSubscription = async () =>
  subscriptions.create({
    name: 'Discord',
    url: 'https://example.com/hook',
    preset: 'generic',
    events: ['job.failed'],
  });

describe('runWebhookDelivery', () => {
  it('delivers, and is done with it', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('asks to be retried when the receiver answered badly', async () => {
    const { subscription } = await aSubscription();

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(503),
    });

    expect(done).toBe(false);
  });

  it('records how it went either way', async () => {
    const { subscription } = await aSubscription();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(503),
    });

    const [read] = await subscriptions.list();

    expect(read).toMatchObject({ lastStatus: 503 });
    expect(read?.lastError).toContain('503');
  });

  it('does not retry a subscription somebody turned off in the meantime', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    await subscriptions.update(subscription.id, { enabled: false });

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not retry a subscription that has been deleted', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    await subscriptions.remove(subscription.id);

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('files what it sent, so the history shows more than the last attempt', async () => {
    const { subscription } = await aSubscription();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(200),
    });

    const [filed] = await subscriptions.listDeliveries(subscription.id, 10);

    expect(filed).toMatchObject({ event: 'job.failed', attempts: 1, ok: true, status: 200 });
  });

  it('counts a retry against the delivery it belongs to', async () => {
    const { subscription } = await aSubscription();

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(503),
    });

    await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: anEnvelope,
      fetchImpl: answering(200),
    });

    const filed = await subscriptions.listDeliveries(subscription.id, 10);

    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({ attempts: 2, ok: true });
  });

  it('gives up on an envelope it cannot read rather than retrying it for ever', async () => {
    const { subscription } = await aSubscription();
    const fetchImpl = answering(200);

    const done = await runWebhookDelivery({
      subscriptions,
      subscriptionId: subscription.id,
      payload: JSON.stringify({ version: 99, event: 'nothing.happened' }),
      fetchImpl,
    });

    expect(done).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();

    const [read] = await subscriptions.list();

    expect(read?.lastError).toContain('could not be read');
  });
});
