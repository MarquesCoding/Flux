import type { WebhookPayload } from '@FluxContracts/schemas/Webhook';

/**
 * An event as the thing that noticed it describes it.
 *
 * The envelope — the version, the id, the moment — is the bus's to stamp, not
 * the caller's. A scan that has just failed knows which job failed and why;
 * asking it to also mint a uuid and format a timestamp is asking every call
 * site to get the same three lines right.
 *
 * Written as a distributive conditional rather than a plain `Omit` because
 * `Omit` over a union collapses it into one object with the union of every
 * field, which would let a `job.failed` be raised carrying the data of a
 * `transcoder.unreachable`.
 */
type WebhookOccurrence<TPayload = WebhookPayload> = TPayload extends WebhookPayload
  ? Omit<TPayload, 'version' | 'id' | 'occurredAt'>
  : never;

/**
 * Where things that happen are announced.
 *
 * One bus, and subscriptions decide what reaches them, rather than each
 * feature knowing who wants to hear from it. The alternative — a scan holding
 * a list of webhook URLs — puts delivery in the path of the work, and a slow
 * receiver would then stall a library scan.
 *
 * Publishing never throws and never waits for a delivery. What it does is
 * decide who wants this and queue the work; the queue owns the retries, the
 * timeouts and the record of how it went.
 */
type EventBus = {
  publish: (occurrence: WebhookOccurrence) => Promise<void>;
};

export type { EventBus, WebhookOccurrence };
