import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import type { LogRecord } from '@ValenceContracts/schemas/Log';

/**
 * A log record as plain JSON, for sending down the socket that carries the live tail.
 *
 * Written out field by field rather than handed over whole, so that a field added to the record
 * later has to be considered here before it reaches anybody watching — which is the same reason the
 * redaction is not the last thing between a record and a reader.
 *
 * @param record - The record being sent.
 * @returns The record as JSON.
 */
const asJsonLog = (record: LogRecord): JsonValue => ({
  id: record.id,
  atMs: record.atMs,
  level: record.level,
  source: record.source,
  message: record.message,
  detail: record.detail,
  count: record.count,
  context: {
    jobId: record.context.jobId,
    jobKind: record.context.jobKind,
    libraryId: record.context.libraryId,
    mediaId: record.context.mediaId,
    sessionId: record.context.sessionId,
    requestId: record.context.requestId,
  },
});

export { asJsonLog };
