import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('clearing and expiring', () => {
  it('takes one off the bell for good', async () => {
    const store = createMemoryNotificationStore({ listAccountIds: () => Promise.resolve(['a']) });
    const [written] = await store.notify(['a'], {
      event: 'media.added',
      title: 'A film',
      body: 'arrived',
      link: null,
    });

    await store.clear('a', written?.id);

    expect(await store.list('a', 10)).toEqual([]);
  });

  it('takes all of them off when asked for none in particular', async () => {
    const store = createMemoryNotificationStore({ listAccountIds: () => Promise.resolve(['a']) });

    await store.notify(['a'], { event: 'media.added', title: 'One', body: '', link: null });
    await store.notify(['a'], { event: 'media.added', title: 'Two', body: '', link: null });

    await store.clear('a');

    expect(await store.list('a', 10)).toEqual([]);
  });

  it('leaves what belongs to somebody else alone', async () => {
    const store = createMemoryNotificationStore({
      listAccountIds: () => Promise.resolve(['a', 'b']),
    });

    await store.notify(['a', 'b'], { event: 'media.added', title: 'One', body: '', link: null });

    await store.clear('a');

    expect(await store.list('b', 10)).toHaveLength(1);
  });

  it('takes down a notice that has had its time, without being asked', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const store = createMemoryNotificationStore({ listAccountIds: () => Promise.resolve(['a']) });

    await store.notify(['a'], { event: 'media.added', title: 'One', body: '', link: null });

    vi.setSystemTime(new Date('2026-08-21T12:06:00.000Z'));

    expect(await store.list('a', 10)).toEqual([]);
    expect(await store.countUnread('a')).toBe(0);

    vi.useRealTimers();
  });

  it('keeps one that is still news', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const store = createMemoryNotificationStore({ listAccountIds: () => Promise.resolve(['a']) });

    await store.notify(['a'], { event: 'media.added', title: 'One', body: '', link: null });

    vi.setSystemTime(new Date('2026-08-21T12:04:00.000Z'));

    expect(await store.list('a', 10)).toHaveLength(1);

    vi.useRealTimers();
  });
});
