import { z } from 'zod';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

type PushMessage = {
  data: { json: () => JsonValue } | null;
  waitUntil: (work: Promise<void>) => void;
};

type NotificationClick = {
  notification: { close: () => void; data: { link?: string } };
  waitUntil: (work: Promise<void>) => void;
};

type OpenWindow = {
  focus: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
};

type DrawnNotification = {
  body: string;
  icon: string;
  badge: string;
  data: { link: string };
  tag: string;
  renotify: boolean;
};

declare const registration: {
  showNotification: (title: string, options: DrawnNotification) => Promise<void>;
};

declare const clients: {
  matchAll: (options: { type: string; includeUncontrolled: boolean }) => Promise<OpenWindow[]>;
  openWindow: (url: string) => Promise<void>;
};

declare function addEventListener(kind: 'push', listen: (event: PushMessage) => void): void;

declare function addEventListener(
  kind: 'notificationclick',
  listen: (event: NotificationClick) => void,
): void;

const PushContentSchema = z.object({
  title: z.string().default('Valence'),
  body: z.string().default('Something new to watch'),
  link: z.string().nullish(),
});

/**
 * Reads what a push message says, through a schema and with a fallback at every step. A worker that
 * throws on a malformed push shows nothing at all, so anything unreadable becomes a plain notice
 * rather than an error.
 *
 * @param event - The push as it arrived.
 * @returns What to show.
 */
const readContent = (event: PushMessage) => {
  if (event.data === null) {
    return PushContentSchema.parse({});
  }

  const read = PushContentSchema.safeParse(event.data.json());

  return read.success ? read.data : PushContentSchema.parse({});
};

addEventListener('push', (event) => {
  const { title, body, link } = readContent(event);

  const tag = 'flux-media-added';

  event.waitUntil(
    registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link: link ?? '/' },
      tag,
      renotify: true,
    }),
  );
});

addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data.link ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows[0];

      if (open === undefined) {
        await clients.openWindow(link);

        return;
      }

      await open.focus();
      await open.navigate(link).catch(() => undefined);
    }),
  );
});
