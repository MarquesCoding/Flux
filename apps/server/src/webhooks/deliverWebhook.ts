import { formatWebhookBody } from './formatWebhookBody';
import { isSafeWebhookUrl } from './isSafeWebhookUrl';
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from './signWebhookPayload';
import type { WebhookPayload, WebhookPreset } from '@FluxContracts/schemas/Webhook';

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

type WebhookTarget = {
  url: string;
  preset: WebhookPreset;
  secret: string;
};

type WebhookAttempt = {
  ok: boolean;
  status: number | null;
  error: string | null;
};

/**
 * Sends one event to one subscriber, and reports how it went.
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

export { deliverWebhook };

export type { WebhookAttempt, WebhookFetcher, WebhookTarget };
