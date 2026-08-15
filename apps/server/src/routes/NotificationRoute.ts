import { createRoute, z } from '@hono/zod-openapi';
import { NOTIFICATION_EVENTS } from '@FluxContracts/schemas/Notification';

const NotificationError = z.object({ error: z.string() }).openapi('NotificationError');

const NotificationEvent = z.enum(NOTIFICATION_EVENTS);

/**
 * One thing somebody has been told.
 */
const Notification = z
  .object({
    id: z.string().uuid(),
    event: NotificationEvent,
    title: z.string(),
    body: z.string(),
    link: z.string().nullable(),
    createdAt: z.string().datetime(),
    readAt: z.string().datetime().nullable(),
  })
  .openapi('Notification');

const NotificationPreference = z
  .object({
    event: NotificationEvent,
    inApp: z.boolean(),
    push: z.boolean(),
  })
  .openapi('NotificationPreference');

/**
 * How many notifications a listing answers with.
 *
 * A bell is glanced at rather than read through. Somebody who wants more than
 * this wants a history, which is a different screen and a different question.
 */
const NOTIFICATION_PAGE = 30;

/**
 * What this account has been told, newest first.
 *
 * Always this account's own. A notification is addressed to somebody, and an
 * endpoint that would list anybody's is a different feature with a permission
 * of its own.
 */
const listNotificationsRoute = createRoute({
  method: 'get',
  path: '/api/notifications',
  tags: ['Notifications'],
  summary: 'List this account’s notifications',
  responses: {
    200: {
      description: 'The notifications, and how many are unread',
      content: {
        'application/json': {
          schema: z.object({
            notifications: z.array(Notification),
            unread: z.number().int().nonnegative(),
          }),
        },
      },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: NotificationError } },
    },
  },
});

/**
 * Marks one as read, or everything where no id is given.
 *
 * Both in one route rather than two, because they are the same act at
 * different scales and a bell needs "clear all" far more often than it needs
 * to clear one.
 */
const readNotificationsRoute = createRoute({
  method: 'post',
  path: '/api/notifications/read',
  tags: ['Notifications'],
  summary: 'Mark notifications as read',
  request: {
    body: {
      content: {
        'application/json': { schema: z.object({ id: z.string().uuid().optional() }) },
      },
    },
  },
  responses: {
    200: {
      description: 'How many are left unread',
      content: {
        'application/json': { schema: z.object({ unread: z.number().int().nonnegative() }) },
      },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: NotificationError } },
    },
  },
});

/**
 * What this account wants to be told about, and how.
 *
 * Answers a row per event whether or not one has been stored, so a caller
 * sees the defaults rather than an empty list it has to know how to fill in.
 *
 * `pushPublicKey` comes back with them because a browser about to subscribe
 * needs it and there is no other moment it would sensibly ask. Empty means
 * push is unavailable on this server.
 */
const readNotificationPreferencesRoute = createRoute({
  method: 'get',
  path: '/api/notifications/preferences',
  tags: ['Notifications'],
  summary: 'Read notification preferences',
  responses: {
    200: {
      description: 'The preferences',
      content: {
        'application/json': {
          schema: z.object({
            preferences: z.array(NotificationPreference),
            pushPublicKey: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: NotificationError } },
    },
  },
});

const writeNotificationPreferenceRoute = createRoute({
  method: 'put',
  path: '/api/notifications/preferences',
  tags: ['Notifications'],
  summary: 'Choose what to be told about',
  request: { body: { content: { 'application/json': { schema: NotificationPreference } } } },
  responses: {
    204: { description: 'Saved' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: NotificationError } },
    },
  },
});

/**
 * Records a browser that has agreed to be interrupted.
 *
 * The browser has already asked its user for permission by the time this is
 * called — the prompt belongs to the browser and cannot be moved to the
 * server. This only stores what the push service handed back.
 */
const subscribeToPushRoute = createRoute({
  method: 'post',
  path: '/api/notifications/push',
  tags: ['Notifications'],
  summary: 'Register this browser for push notifications',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            endpoint: z.string().url(),
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: 'This browser will be woken' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: NotificationError } },
    },
  },
});

/**
 * Forgets a browser.
 *
 * By endpoint rather than by id, because the browser knows its endpoint and
 * has no idea what Flux called the row.
 */
const unsubscribeFromPushRoute = createRoute({
  method: 'delete',
  path: '/api/notifications/push',
  tags: ['Notifications'],
  summary: 'Stop waking this browser',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ endpoint: z.string().url() }) } },
    },
  },
  responses: {
    204: { description: 'This browser will not be woken again' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: NotificationError } },
    },
  },
});

export {
  listNotificationsRoute,
  readNotificationsRoute,
  readNotificationPreferencesRoute,
  writeNotificationPreferenceRoute,
  subscribeToPushRoute,
  unsubscribeFromPushRoute,
  NOTIFICATION_PAGE,
};
