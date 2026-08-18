import type { LogQuery, LogRecord } from '@FluxContracts/schemas/Log';

/**
 * Whether a record belongs in what is on screen.
 *
 * The same question the server answers when the panel asks for a page, asked again in the browser
 * for a record that arrived on the live feed after that page was fetched. Without it, following the
 * log would quietly ignore the filters — an operator watching for errors would be shown everything,
 * which is the state the panel is meant to fix.
 *
 * @param record - The record that just arrived.
 * @param query - What the panel is showing.
 * @returns Whether it belongs.
 */
const matchesLogQuery = (record: LogRecord, query: Partial<LogQuery>): boolean => {
  const levels = query.levels ?? [];
  const sources = query.sources ?? [];
  const search = (query.search ?? '').trim().toLowerCase();

  if (levels.length > 0 && !levels.includes(record.level)) {
    return false;
  }

  if (sources.length > 0 && !sources.includes(record.source)) {
    return false;
  }

  if (typeof query.jobId === 'string' && record.context.jobId !== query.jobId) {
    return false;
  }

  if (typeof query.sinceMs === 'number' && record.atMs < query.sinceMs) {
    return false;
  }

  if (typeof query.untilMs === 'number' && record.atMs > query.untilMs) {
    return false;
  }

  return (
    search === '' ||
    record.message.toLowerCase().includes(search) ||
    (record.detail ?? '').toLowerCase().includes(search)
  );
};

export { matchesLogQuery };
