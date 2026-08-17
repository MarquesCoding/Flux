import { LogPageSchema, LogRecordSchema } from '@FluxContracts/schemas/Log';
import { getRealtimeClient } from '@FluxWeb/realtime/getRealtimeClient';
import type { LogQuery, LogRecord } from '@FluxContracts/schemas/Log';
import type { RealtimeClient } from '@FluxWeb/realtime/createRealtimeClient';

type Subscribes = Pick<RealtimeClient, 'subscribe'>;

type LogPage = { records: LogRecord[]; total: number };

const NOTHING: LogPage = { records: [], total: 0 };

/**
 * Reads the log, filtered.
 *
 * Answers with nothing rather than throwing when the server refuses or cannot be reached, since a
 * panel that has lost the connection should say it is empty and carry on rather than take the page
 * down with it.
 *
 * @param query - What to look for.
 * @returns The records that matched, newest first.
 */
const fetchLogs = async (query: Partial<LogQuery>): Promise<LogPage> => {
  const response = await fetch('/api/admin/logs', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return NOTHING;
  }

  const read = LogPageSchema.safeParse(await response.json().catch(() => null));

  return read.success ? read.data : NOTHING;
};

/**
 * Follows the log as it is written, over the connection the rest of the app already has.
 *
 * @param onRecord - Told about each record as it is written.
 * @param client - The connection to watch over, which is the shared one unless a test says otherwise.
 * @returns The function that stops watching.
 */
const watchLogs = (
  onRecord: (record: LogRecord) => void,
  client: Subscribes = getRealtimeClient(),
): (() => void) =>
  client.subscribe('logs', (event) => {
    const read = LogRecordSchema.safeParse(event.payload);

    if (read.success) {
      onRecord(read.data);
    }
  });

export type { LogPage };

export { fetchLogs, watchLogs };
