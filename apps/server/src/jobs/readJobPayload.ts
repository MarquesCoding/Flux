import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

/**
 * Reads what a job was enqueued with as something a handler can look fields up on. A scheduled job
 * carries no data at all and arrives as null, which is not a failure and not a payload either — it is
 * a job that was asked for on a clock rather than about anything, and it reads as an empty payload.
 *
 * @param data - Whatever the queue delivered, which is anything JSON can hold.
 * @returns The payload, empty where the job carried none.
 */
const readJobPayload = (data: JsonValue): { [key: string]: JsonValue } =>
  data === null || typeof data !== 'object' || Array.isArray(data) ? {} : data;

export { readJobPayload };
