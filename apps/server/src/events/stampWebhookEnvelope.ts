import { randomUUID } from 'node:crypto';
import { WEBHOOK_PAYLOAD_VERSION } from '@FluxContracts/schemas/Webhook';
import type { WebhookOccurrence } from './EventBus';

/**
 * Wraps something that happened in the envelope a subscriber reads.
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
