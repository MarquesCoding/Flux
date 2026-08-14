import { formatWebhookBody } from './formatWebhookBody';
import { isSafeWebhookUrl } from './isSafeWebhookUrl';
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from './signWebhookPayload';
import type { WebhookPayload, WebhookPreset } from '@FluxContracts/schemas/Webhook';

/**
 * How long a receiver has to answer before Flux gives up on this attempt.
 *
 * Short on purpose. A delivery holds a queue worker while it waits, and a
 * receiver that hangs for ever would hold one for ever — a single misbehaving
 * endpoint could stop every other job on the server. Ten seconds is long
 * enough for anything that is actually going to answer.
 */
const WEBHOOK_TIMEOUT_MILLISECONDS = 10_000;

type WebhookFetcher = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number }>;

/**
 * Enough of a subscription to deliver to one.
 *
 * The secret is here and nowhere a route can reach, which is what keeps it
 * from being answered back to a browser.
 */
type WebhookTarget = {
  url: string;
  preset: WebhookPreset;
  secret: string;
};

/**
 * How one attempt went.
 *
 * `status` is null where nothing answered — a refused connection, a name that
 * does not resolve, a timeout — which is a different thing from a receiver
 * that answered 500, and an operator reading this wants to be able to tell
 * them apart.
 */
type WebhookAttempt = {
  ok: boolean;
  status: number | null;
  error: string | null;
};

/**
 * Sends one event to one subscriber, and reports how it went.
 *
 * Deliberately does not throw and does not retry. Whether a failed attempt is
 * worth trying again is the queue's decision, made from what this returns —
 * keeping that here would mean a retry policy hidden inside a function whose
 * name says it delivers once.
 *
 * The address is checked again here rather than trusted from when the
 * subscription was created. A row can be edited, restored from a backup taken
 * before the check existed, or written by hand; the guard costs a URL parse
 * and removes any argument about which of those paths was covered.
 *
 * @param target Where to send it, and what to sign it with.
 * @param payload The event being delivered.
 * @param fetchImpl How to make the request, so a test need not open a socket.
 * @param timeoutMilliseconds How long to wait for an answer.
 */
const deliverWebhook = async (
  target: WebhookTarget,
  payload: WebhookPayload,
  fetchImpl?: WebhookFetcher,
  timeoutMilliseconds: number = WEBHOOK_TIMEOUT_MILLISECONDS,
): Promise<WebhookAttempt> => {
  if (!isSafeWebhookUrl(target.url)) {
    return { ok: false, status: null, error: 'Flux will not send deliveries to that address.' };
  }

  const call: WebhookFetcher =
    fetchImpl ??
    (async (url, init) => {
      const response = await fetch(url, init);

      return { ok: response.ok, status: response.status };
    });

  const { body, contentType } = formatWebhookBody(target.preset, payload);

  try {
    const response = await call(target.url, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        'user-agent': 'Flux',
        [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(target.secret, body),
      },
      body,
      signal: AbortSignal.timeout(timeoutMilliseconds),
    });

    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : `The receiver answered ${response.status.toString()}.`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : 'The delivery could not be made.',
    };
  }
};

export { deliverWebhook, WEBHOOK_TIMEOUT_MILLISECONDS };

export type { WebhookAttempt, WebhookFetcher, WebhookTarget };
