import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryNotificationStore } from './createMemoryNotificationStore';
import type { NotificationStore } from './NotificationStore';

const someNews = {
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

describe('createMemoryNotificationStore', () => {
  it('tells everybody in-app before anybody has chosen anything', async () => {
    expect(await store.listWanting('media.added', 'inApp')).toStrictEqual(['alice', 'bob']);
  });

  it('does not push at anybody who has not asked for it', async () => {
    expect(await store.listWanting('media.added', 'push')).toStrictEqual([]);
  });

  it('honours somebody turning in-app off', async () => {
    await store.writePreference('alice', { event: 'media.added', inApp: false, push: false });

    expect(await store.listWanting('media.added', 'inApp')).toStrictEqual(['bob']);
  });

  it('honours somebody turning push on', async () => {
    await store.writePreference('alice', { event: 'media.added', inApp: true, push: true });

    expect(await store.listWanting('media.added', 'push')).toStrictEqual(['alice']);
  });

  it('gives each account its own copy, because read state is personal', async () => {
    await store.notify(['alice', 'bob'], someNews);

    await store.markRead('alice');

    expect(await store.countUnread('alice')).toBe(0);
    expect(await store.countUnread('bob')).toBe(1);
  });

  it('lists what somebody has been told, newest first', async () => {
    await store.notify(['alice'], someNews);
    await store.notify(['alice'], { ...someNews, body: 'later' });

    const listed = await store.list('alice', 10);

    expect(listed).toHaveLength(2);
    expect(listed[0]?.body).toBe('later');
  });

  it('shows nobody else what they were told', async () => {
    await store.notify(['alice'], someNews);

    expect(await store.list('bob', 10)).toStrictEqual([]);
  });

  it('marks one without marking the rest', async () => {
    await store.notify(['alice'], someNews);
    await store.notify(['alice'], { ...someNews, body: 'second' });

    const [newest] = await store.list('alice', 10);

    await store.markRead('alice', newest?.id ?? '');

    expect(await store.countUnread('alice')).toBe(1);
  });

  it('keeps a browser against the account that agreed', async () => {
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    expect(await store.listPushEndpoints('alice')).toHaveLength(1);
    expect(await store.listPushEndpoints('bob')).toStrictEqual([]);
  });

  it('forgets a browser the push service says is gone', async () => {
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    await store.removePushEndpoint('https://push/1');

    expect(await store.listPushEndpoints('alice')).toStrictEqual([]);
  });

  it('counts one browser once however often it is offered', async () => {
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });
    await store.addPushEndpoint('alice', { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' });

    expect(await store.listPushEndpoints('alice')).toHaveLength(1);
  });
});
