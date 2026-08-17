import { forgottenAfterMs, sameEventKey } from '@FluxContracts/schemas/Log';
import { redactSecrets } from '@FluxCore/functions/redactSecrets';
import type { LogContext, LogLevel, LogRecord, LogSource } from '@FluxContracts/schemas/Log';
import type { Schedule } from '@FluxServer/realtime/createCoalescer';
import type { LogAside, LogStore, Logger, StoredLog } from './Logger';

type LoggerOptions = {
  store: LogStore;
  now: () => number;
  newId: () => string;
  schedule: Schedule;
  writeLine: (line: string, level: LogLevel) => void;
  windowMs: number;
  batchSize: number;
  dedupeWindowMs: number;
  ambient?: () => Partial<LogContext>;
  onRecord?: (record: LogRecord) => void;
};

const NOTHING: LogContext = {
  jobId: null,
  jobKind: null,
  libraryId: null,
  mediaId: null,
  sessionId: null,
  requestId: null,
};

const whatIsSaid = (context?: Partial<LogContext>): Partial<LogContext> =>
  Object.fromEntries(Object.entries(context ?? {}).filter((entry) => entry[1] !== null));

const asLine = (record: StoredLog): string => {
  const about = Object.entries(record.context)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([name, value]) => `${name}=${value}`)
    .join(' ');

  const stamp = new Date(record.atMs).toISOString();
  const tail = about === '' ? '' : ` (${about})`;

  return `${stamp} ${record.level} ${record.source}: ${record.message}${tail}\n`;
};

const asRecord = (stored: StoredLog): LogRecord => ({
  id: stored.id,
  atMs: stored.atMs,
  level: stored.level,
  source: stored.source,
  message: stored.message,
  detail: stored.detail,
  count: 1,
  context: stored.context,
});

/**
 * The one place the server writes a log.
 *
 * Three things it will not do. It will not let a logging failure become the failure of whatever was
 * being logged, so a database that has gone away costs the line rather than the scan. It will not
 * stop writing to stderr, because that is the only thing there is when the process dies during
 * startup, and because anyone running this under Docker expects `docker logs` to work. And it will
 * not write a secret: redaction happens here, when the record is made, since a redaction applied when
 * a record is shown is not a redaction at all — the record still exists and a download hands it over.
 *
 * Writes are gathered rather than sent one at a time, because a scan produces thousands and a
 * round-trip each would be a real cost on the thing being scanned. Repeats inside the window are
 * counted against one record instead of written again, so a job retrying in a loop cannot push out
 * everything that mattered.
 *
 * @param store - Where records are kept.
 * @param now - The clock.
 * @param newId - How a record identifier is minted.
 * @param schedule - How the gathering window is waited out.
 * @param writeLine - Where the immediate copy goes, which is stderr in production.
 * @param windowMs - How long writes gather before being saved.
 * @param batchSize - How many gather before being saved regardless.
 * @param dedupeWindowMs - How long a repeat still counts as the same event.
 * @param ambient - What the work now running is about, so a line deep inside a scan still says which.
 * @param onRecord - Told about each record, for anyone tailing.
 * @returns The logger.
 */
const createLogger = ({
  store,
  now,
  newId,
  schedule,
  writeLine,
  windowMs,
  batchSize,
  dedupeWindowMs,
  ambient,
  onRecord,
}: LoggerOptions): Logger => {
  let waiting: StoredLog[] = [];
  let repeated: string[] = [];
  let cancel: (() => void) | null = null;
  let sending: Promise<void> = Promise.resolve();

  const seen = new Map<string, { id: string; atMs: number }>();

  const send = () => {
    const records = waiting;
    const again = repeated;

    waiting = [];
    repeated = [];
    cancel?.();
    cancel = null;

    if (records.length === 0 && again.length === 0) {
      return;
    }

    sending = sending
      .then(async () => {
        if (records.length > 0) {
          await store.save(records);
        }

        if (again.length > 0) {
          await store.countAgain(again);
        }
      })
      .catch(() => {
        writeLine(
          `${new Date(now()).toISOString()} error server: a log could not be stored\n`,
          'error',
        );
      });
  };

  const hold = () => {
    if (waiting.length + repeated.length >= batchSize) {
      send();

      return;
    }

    cancel ??= schedule(send, windowMs);
  };

  const write = (
    level: LogLevel,
    source: LogSource,
    message: string,
    held: LogContext,
    aside?: LogAside,
  ) => {
    const atMs = now();
    const context = {
      ...NOTHING,
      ...ambient?.(),
      ...whatIsSaid(held),
      ...whatIsSaid(aside?.context),
    };

    const record: StoredLog = {
      id: newId(),
      atMs,
      level,
      source,
      message: redactSecrets(message),
      detail: aside?.detail === undefined ? null : redactSecrets(aside.detail),
      context,
      sameEventKey: sameEventKey({ level, source, message: redactSecrets(message), context }),
      forgetAfterMs: forgottenAfterMs(level, atMs),
    };

    writeLine(asLine(record), level);

    const before = seen.get(record.sameEventKey);

    if (before !== undefined && atMs - before.atMs < dedupeWindowMs) {
      seen.set(record.sameEventKey, { id: before.id, atMs });
      repeated.push(before.id);
      hold();

      return;
    }

    seen.set(record.sameEventKey, { id: record.id, atMs });
    waiting.push(record);
    onRecord?.(asRecord(record));
    hold();
  };

  const withContext = (held: LogContext): Logger => ({
    debug: (source, message, aside) => {
      write('debug', source, message, held, aside);
    },
    info: (source, message, aside) => {
      write('info', source, message, held, aside);
    },
    warn: (source, message, aside) => {
      write('warn', source, message, held, aside);
    },
    error: (source, message, aside) => {
      write('error', source, message, held, aside);
    },
    about: (context) => withContext({ ...held, ...context }),
    flush: async () => {
      send();

      await sending;
    },
  });

  return withContext(NOTHING);
};

export { createLogger };
