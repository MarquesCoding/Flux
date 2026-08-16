import { randomUUID } from 'node:crypto';
import {
  DEFAULT_NOTIFICATION_PREFERENCE,
  NOTIFICATION_EVENTS,
} from '@FluxContracts/schemas/Notification';
import type { Notification } from '@FluxContracts/schemas/Notification';
import type { NotificationStore, PushEndpoint } from './NotificationStore';

type CreateMemoryNotificationStoreOptions = {
  listAccountIds?: () => Promise<string[]>;
};

/**
 * Notifications held in memory, so the routes can be exercised without Postgres.
 *
 * @param state - Anything already notified.
 * @returns The notification store.
 */
const createMemoryNotificationStore = ({
  listAccountIds = () => Promise.resolve([]),
}: CreateMemoryNotificationStoreOptions = {}): NotificationStore => {
  const notifications = new Map<string, { userId: string; notification: Notification }>();
  const preferences = new Map<string, { inApp: boolean; push: boolean }>();
  const endpoints = new Map<string, { userId: string; endpoint: PushEndpoint }>();

  const preferenceKey = (userId: string, event: string) => `${userId}:${event}`;

  return {
    listWanting: async (event, transport) => {
      const accounts = await listAccountIds();

      return accounts.filter((userId) => {
        const held =
          preferences.get(preferenceKey(userId, event)) ?? DEFAULT_NOTIFICATION_PREFERENCE;

        return held[transport];
      });
    },

    notify: (userIds, { event, title, body, link }) => {
      const written = userIds.map((userId) => {
        const notification: Notification = {
          id: randomUUID(),
          event,
          title,
          body,
          link,
          createdAt: new Date().toISOString(),
          readAt: null,
        };

        notifications.set(notification.id, { userId, notification });

        return notification;
      });

      return Promise.resolve(written);
    },

    list: (userId, limit) =>
      Promise.resolve(
        [...notifications.values()]
          .filter((held) => held.userId === userId)
          .map((held) => held.notification)
          .reverse()
          .slice(0, limit),
      ),

    countUnread: (userId) =>
      Promise.resolve(
        [...notifications.values()].filter(
          (held) => held.userId === userId && held.notification.readAt === null,
        ).length,
      ),

    markRead: (userId, notificationId) => {
      const at = new Date().toISOString();

      for (const [id, held] of notifications) {
        const mine = held.userId === userId;
        const chosen = notificationId === undefined || notificationId === id;

        if (mine && chosen && held.notification.readAt === null) {
          notifications.set(id, { ...held, notification: { ...held.notification, readAt: at } });
        }
      }

      return Promise.resolve();
    },

    readPreferences: (userId) =>
      Promise.resolve(
        NOTIFICATION_EVENTS.flatMap((event) => {
          const held = preferences.get(preferenceKey(userId, event));

          return held === undefined ? [] : [{ event, inApp: held.inApp, push: held.push }];
        }),
      ),

    writePreference: (userId, { event, inApp, push }) => {
      preferences.set(preferenceKey(userId, event), { inApp, push });

      return Promise.resolve();
    },

    addPushEndpoint: (userId, endpoint) => {
      endpoints.set(endpoint.endpoint, { userId, endpoint });

      return Promise.resolve();
    },

    listPushEndpoints: (userId) =>
      Promise.resolve(
        [...endpoints.values()]
          .filter((held) => held.userId === userId)
          .map((held) => held.endpoint),
      ),

    removePushEndpoint: (endpoint) => {
      endpoints.delete(endpoint);

      return Promise.resolve();
    },
  };
};

export { createMemoryNotificationStore };
