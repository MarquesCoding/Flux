import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNotifications,
  fetchNotificationSettings,
  markNotificationsRead,
} from './fetchNotifications';

const fetchMock = vi.fn();

const said = (body: object, ok = true) => ({ ok, json: () => Promise.resolve(body) });

const A_NOTICE = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  event: 'media.added',
  title: 'Arrival',
  body: 'Added to Films',
  link: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  readAt: null,
};

const NOTHING_WAITING = { notifications: [], unread: 0 };
const NOTHING_CHOSEN = { preferences: [], pushPublicKey: '' };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNotifications', () => {
  it('reads what is on the bell', async () => {
    fetchMock.mockResolvedValue(said({ notifications: [A_NOTICE], unread: 1 }));

    await expect(fetchNotifications()).resolves.toEqual({
      notifications: [A_NOTICE],
      unread: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications', {
      credentials: 'same-origin',
    });
  });

  it('says nothing is waiting rather than failing, when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchNotifications()).resolves.toEqual(NOTHING_WAITING);
  });

  it('says nothing is waiting when the server refuses', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchNotifications()).resolves.toEqual(NOTHING_WAITING);
  });

  it('says nothing is waiting when the answer is not one', async () => {
    fetchMock.mockResolvedValue(said({ notifications: 'lots' }));

    await expect(fetchNotifications()).resolves.toEqual(NOTHING_WAITING);
  });
});

describe('markNotificationsRead', () => {
  it('marks one and says how many are left', async () => {
    fetchMock.mockResolvedValue(said({ unread: 2 }));

    await expect(markNotificationsRead(A_NOTICE.id)).resolves.toBe(2);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/read',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: A_NOTICE.id }) }),
    );
  });

  it('marks the lot when told about none in particular', async () => {
    fetchMock.mockResolvedValue(said({ unread: 0 }));

    await markNotificationsRead();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/read',
      expect.objectContaining({ body: '{}' }),
    );
  });

  it('says none are left rather than failing, when the server refuses or cannot be reached', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(markNotificationsRead()).resolves.toBe(0);

    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(markNotificationsRead()).resolves.toBe(0);
  });

  it('says none are left when the answer is not one', async () => {
    fetchMock.mockResolvedValue(said({ unread: 'two' }));

    await expect(markNotificationsRead()).resolves.toBe(0);
  });
});

describe('fetchNotificationSettings', () => {
  it('reads what somebody asked to be told about, and the key a browser needs', async () => {
    fetchMock.mockResolvedValue(said({ preferences: [], pushPublicKey: 'a-key' }));

    await expect(fetchNotificationSettings()).resolves.toEqual({
      preferences: [],
      pushPublicKey: 'a-key',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/preferences', {
      credentials: 'same-origin',
    });
  });

  it('says nothing has been chosen when the server refuses or cannot be reached', async () => {
    fetchMock.mockResolvedValue(said({}, false));

    await expect(fetchNotificationSettings()).resolves.toEqual(NOTHING_CHOSEN);

    fetchMock.mockRejectedValue(new Error('gone'));

    await expect(fetchNotificationSettings()).resolves.toEqual(NOTHING_CHOSEN);
  });

  it('says nothing has been chosen when the answer is not one', async () => {
    fetchMock.mockResolvedValue(said({ preferences: {} }));

    await expect(fetchNotificationSettings()).resolves.toEqual(NOTHING_CHOSEN);
  });
});
