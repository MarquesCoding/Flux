import { createRoute, z } from '@hono/zod-openapi';
import { NOTIFICATION_EVENTS } from '@FluxContracts/schemas/Notification';

const NotificationError = z.object({ error: z.string() }).openapi('NotificationError');

const NotificationEvent = z.enum(NOTIFICATION_EVENTS);

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

const NOTIFICATION_PAGE = 30;

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

const clearNotificationsRoute = createRoute({
  method: 'post',
  path: '/api/notifications/clear',
  tags: ['Notifications'],
  summary: 'Take notifications off the bell for good',
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
  clearNotificationsRoute,
  readNotificationPreferencesRoute,
  writeNotificationPreferenceRoute,
  subscribeToPushRoute,
  unsubscribeFromPushRoute,
  NOTIFICATION_PAGE,
};
