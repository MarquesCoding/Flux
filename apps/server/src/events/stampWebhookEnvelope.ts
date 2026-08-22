import { randomUUID } from 'node:crypto';
import { WEBHOOK_PAYLOAD_VERSION } from '@ValenceContracts/schemas/Webhook';
import type { WebhookOccurrence } from './EventBus';

/**
 * Wraps something that happened in the envelope a subscriber reads: a version, an identifier and the
 * moment, around the event itself. The version is first so that a subscriber can tell what shape the
 * rest is in before trying to read it.
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
