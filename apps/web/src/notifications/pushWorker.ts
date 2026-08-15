import { z } from 'zod';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

/**
 * The service worker that draws a push when the app is not open.
 *
 * Compiled to `/push-worker.js` rather than committed as JavaScript — see the
 * `pushWorker` plugin in `vite.config.ts`. A service worker has to be served
 * as a script at a stable path, which is the one case the no-JavaScript rule
 * cannot accommodate directly; the generated file is a build artifact and is
 * not checked in.
 *
 * Deliberately tiny. This runs detached from the app, with no access to its
 * state and no ordinary way to be debugged, so anything it does beyond
 * drawing the notification is something that can go wrong where nobody is
 * looking.
 *
 * The globals are declared rather than pulled in from the `WebWorker` lib,
 * because that lib and `DOM` declare the same names differently and cannot
 * both be in one program — and the app is one program. Naming only what is
 * used also keeps the surface of a detached file visible in the file itself.
 */
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

/**
 * The parts of a notification this worker draws.
 */
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

/**
 * What the server sends, as the service worker reads it.
 *
 * Through a schema like any other untrusted input, and every field optional
 * so a payload from a newer server still draws something. A browser that is
 * woken and shows nothing is worse than a vague notification — and with
 * `userVisibleOnly` the browser draws its own generic message anyway, so
 * silence is not on offer.
 */
const PushContentSchema = z.object({
  title: z.string().default('Flux'),
  body: z.string().default('Something new to watch'),
  link: z.string().nullish(),
});

const readContent = (event: PushMessage) => {
  if (event.data === null) {
    return PushContentSchema.parse({});
  }

  const read = PushContentSchema.safeParse(event.data.json());

  return read.success ? read.data : PushContentSchema.parse({});
};

addEventListener('push', (event) => {
  const { title, body, link } = readContent(event);

  /**
   * One notification at a time from this server.
   *
   * A digest supersedes the one before it — "12 episodes" then "14 episodes"
   * is one piece of news twice, not two — and a phone stacking every hourly
   * digest is what gets the permission revoked.
   */
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
