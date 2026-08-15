import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryNotificationStore } from './createMemoryNotificationStore';
import { notifyHousehold } from './notifyHousehold';
import type { NotificationStore } from './NotificationStore';
import type { WebPushSender } from './sendWebPush';

const keys = { publicKey: 'public', privateKey: 'private' };

const news = {
  event: 'media.added' as const,
  title: 'Something new to watch',
  body: '12 episodes — The Office',
  link: '/?show=s1',
};

let store: NotificationStore;

beforeEach(() => {
  store = createMemoryNotificationStore({
    listAccountIds: () => Promise.resolve(['alice', 'bob']),
  });
});

const landing = () => vi.fn<WebPushSender>().mockResolvedValue({ statusCode: 201 });

describe('notifyHousehold', () => {
  it('tells everybody in-app, which is on by default', async () => {
    await notifyHousehold({ store, ...news, vapid: keys, send: landing() });

    expect(await store.countUnread('alice')).toBe(1);
    expect(await store.countUnread('bob')).toBe(1);
  });

  it('does not push at somebody who never asked to be interrupted', async () => {
    const send = landing();

    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    await notifyHousehold({ store, ...news, vapid: keys, send });

    expect(send).not.toHaveBeenCalled();
  });

  it('pushes to somebody who asked', async () => {
    const send = landing();

    await store.writePreference('alice', { event: 'media.added', inApp: true, push: true });
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    await notifyHousehold({ store, ...news, vapid: keys, send });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reaches every browser one person uses', async () => {
    const send = landing();

    await store.writePreference('alice', { event: 'media.added', inApp: true, push: true });
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });
    await store.addPushEndpoint('alice', { endpoint: 'https://push/2', p256dh: 'k', auth: 'a' });

    await notifyHousehold({ store, ...news, vapid: keys, send });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('still tells the bell on a server with no push keys', async () => {
    const send = landing();

    await notifyHousehold({ store, ...news, vapid: null, send });

    expect(await store.countUnread('alice')).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('forgets a browser the push service says is gone', async () => {
    const send = vi
      .fn<WebPushSender>()
      .mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    await store.writePreference('alice', { event: 'media.added', inApp: true, push: true });
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    await notifyHousehold({ store, ...news, vapid: keys, send });

    expect(await store.listPushEndpoints('alice')).toStrictEqual([]);
  });

  it('keeps a browser whose push service was merely having a bad day', async () => {
    const send = vi
      .fn<WebPushSender>()
      .mockRejectedValue(Object.assign(new Error('later'), { statusCode: 503 }));

    await store.writePreference('alice', { event: 'media.added', inApp: true, push: true });
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    await notifyHousehold({ store, ...news, vapid: keys, send });

    expect(await store.listPushEndpoints('alice')).toHaveLength(1);
  });

  it('does not fail the scan that found the media when the store is down', async () => {
    const broken: NotificationStore = {
      ...store,
      listWanting: () => Promise.reject(new Error('the database went away')),
    };
    const onProblem = vi.fn();

    await expect(
      notifyHousehold({ store: broken, ...news, vapid: keys, onProblem }),
    ).resolves.toBeUndefined();

    expect(onProblem).toHaveBeenCalledWith('the database went away');
  });

  it('leaves somebody who turned in-app off out of it', async () => {
    await store.writePreference('alice', { event: 'media.added', inApp: false, push: false });

    await notifyHousehold({ store, ...news, vapid: keys, send: landing() });

    expect(await store.countUnread('alice')).toBe(0);
    expect(await store.countUnread('bob')).toBe(1);
  });
});
