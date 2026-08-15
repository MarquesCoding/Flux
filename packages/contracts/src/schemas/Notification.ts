import { z } from 'zod';

/**
 * Every event the household can be told about.
 *
 * One, for now, and the shortness is the same rule the webhook catalogue
 * follows: nothing is listed that the server cannot already raise. A download
 * finishing and a watch party invitation are the other two the household
 * wants, and neither feature exists — listing them here would be indexing an
 * event that never arrives, which reads to somebody who subscribed exactly
 * like one that is broken.
 *
 * Kept apart from the webhook catalogue rather than shared with it, because
 * the two answer different questions. A webhook subscriber is a program that
 * wants to know a job failed; a household wants to know there is something
 * new to watch. Merging them would offer an operator's alarms to a viewer and
 * a viewer's tastes to a monitoring endpoint.
 */
const NOTIFICATION_EVENTS = ['media.added'] as const;

const NotificationEventSchema = z.enum(NOTIFICATION_EVENTS);

type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/**
 * What each event is called where somebody chooses to hear about it.
 *
 * A complete record, so an event added to the catalogue fails to compile here
 * until somebody says what it is called.
 */
const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  'media.added': 'Something new to watch',
};

/**
 * One thing somebody has been told, as they read it back.
 *
 * `body` is a whole sentence rather than a template with values to fill in.
 * The digest that writes it knows things the reader does not — how many
 * episodes, of how many programmes, across how many libraries — and freezing
 * the sentence at the moment it was true means a notification read next week
 * still says what it said, rather than being re-rendered against a library
 * that has moved on.
 *
 * `link` is where pressing it goes, when there is somewhere sensible. A
 * digest covering four programmes has nowhere single to point.
 */
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

/**
 * How somebody wants to be told, per event.
 *
 * Two transports, chosen separately, because they are not the same promise.
 * In-app costs nothing and waits to be looked at; push interrupts, needs the
 * browser's permission, and is the one somebody turns off first. Making them
 * one switch would mean granting the noisier to get the quieter.
 */
const NotificationPreferenceSchema = z.object({
  event: NotificationEventSchema,
  inApp: z.boolean(),
  push: z.boolean(),
});

type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

/**
 * What a fresh account is told about, before anybody chooses.
 *
 * In-app on, push off. In-app is a number on a bell that somebody looks at
 * when they are already here, which nobody needs to consent to; push arrives
 * on a phone at midnight and is somebody's decision to make rather than a
 * default to be discovered.
 */
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
