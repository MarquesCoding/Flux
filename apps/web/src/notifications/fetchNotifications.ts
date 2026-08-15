import { z } from 'zod';
import {
  NotificationPreferenceSchema,
  NotificationSchema,
} from '@FluxContracts/schemas/Notification';
import type { Notification, NotificationPreference } from '@FluxContracts/schemas/Notification';

const InboxSchema = z.object({
  notifications: z.array(NotificationSchema),
  unread: z.number().int().nonnegative(),
});

const PreferencesSchema = z.object({
  preferences: z.array(NotificationPreferenceSchema),
  pushPublicKey: z.string(),
});

/**
 * What somebody has been told, and how much of it is new.
 */
type Inbox = z.infer<typeof InboxSchema>;

type NotificationSettings = z.infer<typeof PreferencesSchema>;

/**
 * What is on the bell.
 *
 * Answers an empty inbox rather than failing when the server cannot be
 * reached. A bell is furniture on every page, and a page that will not draw
 * because a count could not be fetched is a worse outcome than a bell that
 * reads zero.
 */
const fetchNotifications = async (): Promise<Inbox> => {
  const response = await fetch('/api/notifications', { credentials: 'same-origin' }).catch(
    () => null,
  );

  if (response === null || !response.ok) {
    return { notifications: [], unread: 0 };
  }

  return InboxSchema.parse(await response.json());
};

/**
 * Marks one as read, or everything when given nothing.
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

  return z.object({ unread: z.number() }).parse(await response.json()).unread;
};

const fetchNotificationSettings = async (): Promise<NotificationSettings> => {
  const response = await fetch('/api/notifications/preferences', {
    credentials: 'same-origin',
  }).catch(() => null);

  if (response === null || !response.ok) {
    return { preferences: [], pushPublicKey: '' };
  }

  return PreferencesSchema.parse(await response.json());
};

const writeNotificationPreference = async (preference: NotificationPreference): Promise<void> => {
  await fetch('/api/notifications/preferences', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preference),
  }).catch(() => null);
};

export {
  fetchNotificationSettings,
  fetchNotifications,
  markNotificationsRead,
  writeNotificationPreference,
};

export type { Inbox, Notification, NotificationSettings };
