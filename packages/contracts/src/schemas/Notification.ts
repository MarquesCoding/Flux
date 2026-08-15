import { z } from 'zod';

const NOTIFICATION_EVENTS = ['media.added'] as const;

const NotificationEventSchema = z.enum(NOTIFICATION_EVENTS);

type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  'media.added': 'Something new to watch',
};

const NotificationSchema = z.object({
  id: z.string().uuid(),
  event: NotificationEventSchema,
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});

type Notification = z.infer<typeof NotificationSchema>;

const NotificationPreferenceSchema = z.object({
  event: NotificationEventSchema,
  inApp: z.boolean(),
  push: z.boolean(),
});

type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

const DEFAULT_NOTIFICATION_PREFERENCE = { inApp: true, push: false } as const;

export {
  DEFAULT_NOTIFICATION_PREFERENCE,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_LABELS,
  NotificationEventSchema,
  NotificationPreferenceSchema,
  NotificationSchema,
};

export type { Notification, NotificationEvent, NotificationPreference };
