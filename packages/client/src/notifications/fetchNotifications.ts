import { serverUrl } from '@FluxClient/query/serverUrl';
import { readFromServer } from '@FluxClient/query/readFromServer';
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
 * What is on the bell: the notices this viewer has been sent, newest first, and how many they have
 * not read.
 */
const fetchNotifications = async (): Promise<Inbox> => {
  return readFromServer('/api/notifications', InboxSchema);
};

/**
 * Marks one notification as read, or all of them when given nothing, which is what the "mark all
 * read" control sends.
 *
 * @param id - The one to mark, or nothing to mark them all.
 */
const markNotificationsRead = async (id?: string): Promise<number> => {
  const response = await fetch(serverUrl('/api/notifications/read'), {
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

/**
 * Reads what this viewer has asked to be told about, and the key a browser needs before it can be
 * pushed to at all.
 *
 * @returns The preferences and the push key, or empty ones where the request failed.
 */
const fetchNotificationSettings = async (): Promise<NotificationSettings> => {
  return readFromServer('/api/notifications/preferences', PreferencesSchema);
};

export { fetchNotificationSettings, fetchNotifications, markNotificationsRead };

export type { Inbox, Notification };
