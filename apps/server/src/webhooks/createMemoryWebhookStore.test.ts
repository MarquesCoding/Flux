import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryWebhookStore } from './createMemoryWebhookStore';
import type { WebhookStore } from './WebhookStore';

const aSubscription = {
  name: 'Discord',
  url: 'https://discord.com/api/webhooks/1/abc',
  preset: 'discord',
  events: ['job.failed'],
} as const;

let store: WebhookStore;

beforeEach(() => {
  store = createMemoryWebhookStore();
});

describe('createMemoryWebhookStore', () => {
  it('answers the secret once, on creation', async () => {
    const created = await store.create({ ...aSubscription, events: ['job.failed'] });

    expect(created.secret).not.toBe('');
    expect(Object.keys(created.subscription)).not.toContain('secret');
  });

  it('starts a subscription enabled and never delivered to', async () => {
    const { subscription } = await store.create({ ...aSubscription, events: ['job.failed'] });

    expect(subscription.enabled).toBe(true);
    expect(subscription.lastAttemptAt).toBeNull();
  });

  it('tells the bus which subscriptions asked for an event', async () => {
    const wanted = await store.create({ ...aSubscription, events: ['job.failed'] });
    await store.create({ ...aSubscription, events: ['job.completed'] });

    expect(await store.listenersFor('job.failed')).toStrictEqual([wanted.subscription.id]);
  });

  it('leaves out a subscription that has been turned off', async () => {
    const { subscription } = await store.create({ ...aSubscription, events: ['job.failed'] });

    await store.update(subscription.id, { enabled: false });

    expect(await store.listenersFor('job.failed')).toStrictEqual([]);
    expect(await store.readTarget(subscription.id)).toBeNull();
  });

  it('gives the delivery job the secret and nothing else needs it', async () => {
    const created = await store.create({ ...aSubscription, events: ['job.failed'] });

    const target = await store.readTarget(created.subscription.id);

    expect(target).toStrictEqual({
      url: aSubscription.url,
      preset: 'discord',
      secret: created.secret,
    });
  });

  it('has nothing to deliver to once a subscription is deleted', async () => {
    const { subscription } = await store.create({ ...aSubscription, events: ['job.failed'] });

    expect(await store.remove(subscription.id)).toBe(true);
    expect(await store.readTarget(subscription.id)).toBeNull();
    expect(await store.list()).toStrictEqual([]);
  });

  it('remembers how the last attempt went', async () => {
    const { subscription } = await store.create({ ...aSubscription, events: ['job.failed'] });

    await store.recordAttempt(subscription.id, {
      ok: false,
      status: 500,
      error: 'The receiver answered 500.',
    });

    const [read] = await store.list();

    expect(read).toMatchObject({ lastStatus: 500, lastError: 'The receiver answered 500.' });
    expect(read?.lastAttemptAt).not.toBeNull();
  });

  it('answers nothing for a subscription that never existed', async () => {
    expect(await store.update('missing', { enabled: false })).toBeNull();
    expect(await store.remove('missing')).toBe(false);
    expect(await store.readTarget('missing')).toBeNull();
  });
});
