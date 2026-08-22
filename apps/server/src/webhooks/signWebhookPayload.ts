import { createHmac } from 'node:crypto';

const WEBHOOK_SIGNATURE_PREFIX = 'sha256=';

const WEBHOOK_SIGNATURE_HEADER = 'x-valence-signature';

/**
 * Signs a delivery with the subscription's own secret, so a receiver can tell that what arrived came
 * from this server and was not altered on the way. Signed over the exact bytes sent, which is why a
 * redelivery replays the stored body rather than writing it again.
 *
 * @param secret The subscription's signing secret.
 * @param body The exact body being sent.
 */
const signWebhookPayload = (secret: string, body: string): string =>
  `${WEBHOOK_SIGNATURE_PREFIX}${createHmac('sha256', secret).update(body).digest('hex')}`;

export { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_SIGNATURE_PREFIX };
