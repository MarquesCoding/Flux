import { queryOptions } from '@tanstack/react-query';
import {
  fetchNotifications,
  fetchNotificationSettings,
} from '@FluxWeb/notifications/fetchNotifications';

const NOTIFICATIONS = ['notifications'] as const;

/**
 * What is waiting to be read.
 *
 * The socket says when something arrives, so this is invalidated rather than polled — being told is
 * a better mechanism than a timer that guesses.
 *
 * @returns The query.
 */
const inbox = () =>
  queryOptions({
    queryKey: [...NOTIFICATIONS, 'inbox'],
    queryFn: () => fetchNotifications(),
  });

/**
 * What this account has asked to be told about, and by what means.
 *
 * @returns The query.
 */
const settings = () =>
  queryOptions({
    queryKey: [...NOTIFICATIONS, 'settings'],
    queryFn: () => fetchNotificationSettings(),
  });

const notificationQueries = { inbox, settings, key: NOTIFICATIONS };

export { notificationQueries };
