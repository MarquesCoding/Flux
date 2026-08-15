import { createHmac } from 'node:crypto';

/**
 * How the signature says what it is.
 *
 * Named in the value rather than only in the header, so that changing the
 * digest later produces a signature a receiver can tell apart from the old
 * one instead of one that silently fails to verify.
 */
const WEBHOOK_SIGNATURE_PREFIX = 'sha256=';

/**
 * The header a delivery carries its signature in.
 */
const WEBHOOK_SIGNATURE_HEADER = 'x-flux-signature';

/**
 * Signs a delivery, so a receiver can tell it came from this server.
 *
 * Over the exact bytes that are sent rather than over the parsed object: a
 * receiver verifies what arrived, and two JSON encodings of the same object
 * differ in whitespace and key order while meaning the same thing. Signing
 * the string is the only version of this that a receiver can reproduce.
 *
 * This is what makes a webhook safe to act on. Without it, anybody who
 * learns the URL — from a proxy log, a screenshot, a shared config — can post
 * whatever they like to it, and a receiver that restarts a service on
 * `job.failed` will restart it for them.
 *
 * @param secret The subscription's signing secret.
 * @param body The exact body being sent.
 */
const signWebhookPayload = (secret: string, body: string): string =>
  `${WEBHOOK_SIGNATURE_PREFIX}${createHmac('sha256', secret).update(body).digest('hex')}`;

export { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_SIGNATURE_PREFIX };
