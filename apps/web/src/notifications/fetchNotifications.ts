import { z } from 'zod';
import {
  NotificationPreferenceSchema,
  NotificationSchema,
} from '@FluxContracts/schemas/Notification';
import type { Notification } from '@FluxContracts/schemas/Notification';

const InboxSchema = z.object({
  notifications: z.array(NotificationSchema),
  unread: z.number().int().nonnegative(),
});

const PreferencesSchema = z.object({
  preferences: z.array(NotificationPreferenceSchema),
  pushPublicKey: z.string(),
});

type Inbox = z.infer<typeof InboxSchema>;

type NotificationSettings = z.infer<typeof PreferencesSchema>;

/**
 * What is on the bell.
 */
const fetchNotifications = async (): Promise<Inbox> => {
  const empty = { notifications: [], unread: 0 };
  const response = await fetch('/api/notifications', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return empty;
  }

  const read = InboxSchema.safeParse(await response.json().catch(() => null));

  return read.success ? read.data : empty;
};

/**
 * Marks one notification as read, or all of them when given nothing, which is what the "mark all
 * read" control sends.
 *
 * @param notificationId - The one to mark, or nothing to mark them all.
 */
const markNotificationsRead = async (id?: string): Promise<number> => {
  const response = await fetch('/api/notifications/read', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(id === undefined ? {} : { id }),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return 0;
  }

  const read = z.object({ unread: z.number() }).safeParse(await response.json().catch(() => null));

  return read.success ? read.data.unread : 0;
};

const fetchNotificationSettings = async (): Promise<NotificationSettings> => {
  const unknownYet = { preferences: [], pushPublicKey: '' };
  const response = await fetch('/api/notifications/preferences', {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return unknownYet;
  }

  const read = PreferencesSchema.safeParse(await response.json().catch(() => null));

  return read.success ? read.data : unknownYet;
};

export { fetchNotificationSettings, fetchNotifications, markNotificationsRead };

export type { Inbox, Notification };
