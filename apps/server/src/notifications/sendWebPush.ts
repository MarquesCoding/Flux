import webPush from 'web-push';
import type { PushEndpoint } from './NotificationStore';

const { sendNotification, setVapidDetails } = webPush;

type PushPayload = {
  title: string;
  body: string;
  link: string | null;
};

type PushOutcome = 'delivered' | 'gone' | 'failed';

type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

const VAPID_CONTACT = 'mailto:flux@localhost';

const GONE_STATUSES = new Set([404, 410]);

type WebPushSender = (
  endpoint: PushEndpoint,
  payload: string,
  keys: VapidKeys,
) => Promise<{ statusCode: number }>;

/**
 * Wakes one browser, and says whether it is worth keeping.
 *
 * @param endpoint The browser, as the push service names it.
 * @param payload What the service worker will draw.
 * @param keys The identity the push service checks this server by.
 * @param send How to make the request, so a test need not reach a push service.
 */
const sendWebPush = async (
  endpoint: PushEndpoint,
  payload: PushPayload,
  keys: VapidKeys,
  send?: WebPushSender,
): Promise<PushOutcome> => {
  const call: WebPushSender =
    send ??
    (async (to, body, vapid) => {
      setVapidDetails(VAPID_CONTACT, vapid.publicKey, vapid.privateKey);

      return sendNotification(
        { endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth } },
        body,
      );
    });

  try {
    const { statusCode } = await call(endpoint, JSON.stringify(payload), keys);

    return statusCode >= 200 && statusCode < 300 ? 'delivered' : 'failed';
  } catch (error) {
    const statusCode =
      error !== null && typeof error === 'object' && 'statusCode' in error
        ? Number(error.statusCode)
        : 0;

    return GONE_STATUSES.has(statusCode) ? 'gone' : 'failed';
  }
};

export { sendWebPush };

export type { VapidKeys, WebPushSender };
