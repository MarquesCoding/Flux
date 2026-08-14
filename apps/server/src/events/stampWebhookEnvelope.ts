import { randomUUID } from 'node:crypto';
import { WEBHOOK_PAYLOAD_VERSION } from '@FluxContracts/schemas/Webhook';
import type { WebhookOccurrence } from './EventBus';

/**
 * Wraps something that happened in the envelope a subscriber reads.
 *
 * Answers a string rather than an object, and that is the whole reason this
 * exists as a step of its own: the signature is computed over exact bytes, so
 * the encoding has to happen once, here, and be carried unchanged through the
 * queue. Encoding at the point of delivery instead would mean the bytes that
 * were signed and the bytes that were sent are only equal by luck.
 *
 * @param occurrence What happened, as the thing that noticed it describes it.
 */
const stampWebhookEnvelope = (occurrence: WebhookOccurrence): string =>
  JSON.stringify({
    version: WEBHOOK_PAYLOAD_VERSION,
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...occurrence,
  });

export { stampWebhookEnvelope };
