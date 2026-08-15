import { sendNotification, setVapidDetails } from 'web-push';
import type { PushEndpoint } from './NotificationStore';

/**
 * What a browser is handed when it is woken.
 *
 * Deliberately small. A push payload travels through a service the operator
 * does not run — Google's, Apple's, Mozilla's — and while it is encrypted end
 * to end, the less it carries the less there is to think about. Enough for
 * the notification the service worker will draw, and nothing else.
 */
type PushPayload = {
  title: string;
  body: string;
  link: string | null;
};

/**
 * How one browser answered.
 *
 * `gone` is the case that matters: a push service answering 404 or 410 is
 * saying this subscription will never work again, which is a thing to act on
 * rather than retry. The browser has been uninstalled, or the permission
 * revoked, and unlike a webhook there is no operator to tell about it.
 */
type PushOutcome = 'delivered' | 'gone' | 'failed';

/**
 * The identity a push service checks Flux by.
 *
 * A keypair rather than a secret, and the public half is handed to every
 * browser that subscribes. Generated once and kept, because changing it
 * invalidates every subscription already taken out against it.
 */
type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

/**
 * Who a push service should complain to about this server.
 *
 * Required by the protocol and never contacted in practice. `mailto:` with a
 * value that says what it is beats inventing an address that does not exist.
 */
const VAPID_CONTACT = 'mailto:flux@localhost';

/**
 * The statuses that mean a subscription is finished rather than failing.
 */
const GONE_STATUSES = new Set([404, 410]);

type WebPushSender = (
  endpoint: PushEndpoint,
  payload: string,
  keys: VapidKeys,
) => Promise<{ statusCode: number }>;

/**
 * Wakes one browser, and says whether it is worth keeping.
 *
 * Never throws. A push that fails is one person's phone not lighting up, and
 * it must not take down the digest that was being delivered to everybody
 * else — the same reasoning that keeps the webhook bus from throwing.
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

export { sendWebPush, GONE_STATUSES, VAPID_CONTACT };

export type { PushOutcome, PushPayload, VapidKeys, WebPushSender };
