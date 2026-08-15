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
 * Answers an empty inbox rather than failing, whether the server could not be
 * reached, refused, or said something this version cannot read. A bell is
 * furniture on every page, and a page that will not draw because a count
 * could not be fetched is a worse outcome than a bell reading zero.
 *
 * That covers a real case rather than a theoretical one: a browser left open
 * across an upgrade talks to a server that has moved on, and every one of
 * these is a background read nothing was waiting for.
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
