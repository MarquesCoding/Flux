import type {
  Notification,
  NotificationEvent,
  NotificationPreference,
} from '@ValenceContracts/schemas/Notification';

type NewNotification = {
  event: NotificationEvent;
  title: string;
  body: string;
  link: string | null;
};

type PushEndpoint = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotificationStore = {
  listWanting: (event: NotificationEvent, transport: 'inApp' | 'push') => Promise<string[]>;
  notify: (userIds: string[], notification: NewNotification) => Promise<Notification[]>;
  list: (userId: string, limit: number) => Promise<Notification[]>;
  countUnread: (userId: string) => Promise<number>;
  markRead: (userId: string, notificationId?: string) => Promise<void>;
  clear: (userId: string, notificationId?: string) => Promise<void>;
  readPreferences: (userId: string) => Promise<NotificationPreference[]>;
  writePreference: (userId: string, preference: NotificationPreference) => Promise<void>;
  addPushEndpoint: (userId: string, endpoint: PushEndpoint) => Promise<void>;
  listPushEndpoints: (userId: string) => Promise<PushEndpoint[]>;
  removePushEndpoint: (userId: string, endpoint: string) => Promise<void>;
};

export type { NotificationStore, PushEndpoint };
