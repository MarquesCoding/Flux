import type {
  Notification,
  NotificationEvent,
  NotificationPreference,
} from '@FluxContracts/schemas/Notification';

/**
 * What is being said, before it is addressed to anybody.
 */
type NewNotification = {
  event: NotificationEvent;
  title: string;
  body: string;
  link: string | null;
};

/**
 * A browser that has agreed to be interrupted, as the push service names it.
 */
type PushEndpoint = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Where notifications, what people want, and the browsers they use are kept.
 *
 * One port rather than three, because the three are only ever used together:
 * telling somebody means knowing whether they wanted to be told and which of
 * their browsers to reach. Splitting them would mean every caller holding
 * three stores to answer one question.
 */
type NotificationStore = {
  /**
   * The accounts that asked to hear about this event on this transport.
   *
   * Answered from the accounts that exist rather than from rows that have
   * been written, so somebody who has never opened the settings still gets
   * what the defaults promise. A preference row is only written when
   * somebody changes something.
   */
  listWanting: (event: NotificationEvent, transport: 'inApp' | 'push') => Promise<string[]>;
  /**
   * Tells several accounts the same thing, answering what was written.
   *
   * One row each rather than one row shared, because read state is personal:
   * a household of four reading the same news marks it read four times.
   */
  notify: (userIds: string[], notification: NewNotification) => Promise<Notification[]>;
  list: (userId: string, limit: number) => Promise<Notification[]>;
  countUnread: (userId: string) => Promise<number>;
  /**
   * Marks one as read, or everything where no id is given.
   */
  markRead: (userId: string, notificationId?: string) => Promise<void>;
  readPreferences: (userId: string) => Promise<NotificationPreference[]>;
  writePreference: (userId: string, preference: NotificationPreference) => Promise<void>;
  addPushEndpoint: (userId: string, endpoint: PushEndpoint) => Promise<void>;
  listPushEndpoints: (userId: string) => Promise<PushEndpoint[]>;
  /**
   * Forgets a browser, by the address the push service knows it as.
   *
   * Called both when somebody turns push off and when the push service says
   * the endpoint is gone. Unlike a webhook there is nobody to tell: the
   * browser has been uninstalled or the permission revoked, and nothing about
   * it will start working again.
   */
  removePushEndpoint: (endpoint: string) => Promise<void>;
};

export type { NewNotification, NotificationStore, PushEndpoint };
