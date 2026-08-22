import { describe, expect, it } from 'vitest';
import { asJsonLog } from './asJsonLog';
import { LogRecordSchema } from '@ValenceContracts/schemas/Log';
import type { LogRecord } from '@ValenceContracts/schemas/Log';

const record: LogRecord = {
  id: 'one',
  atMs: 1000,
  level: 'error',
  source: 'scanner',
  message: 'could not read the file',
  detail: 'at read()',
  count: 3,
  context: {
    jobId: 'job-1',
    jobKind: 'scan',
    libraryId: 'library-1',
    mediaId: null,
    sessionId: null,
    requestId: null,
  },
};

describe('asJsonLog', () => {
  it('sends the record whole', () => {
    expect(asJsonLog(record)).toStrictEqual({
      id: 'one',
      atMs: 1000,
      level: 'error',
      source: 'scanner',
      message: 'could not read the file',
      detail: 'at read()',
      count: 3,
      context: {
        jobId: 'job-1',
        jobKind: 'scan',
        libraryId: 'library-1',
        mediaId: null,
        sessionId: null,
        requestId: null,
      },
    });
  });

  it('sends something the other end can read back as a record', () => {
    expect(LogRecordSchema.safeParse(asJsonLog(record)).success).toBe(true);
  });

  it('keeps how many times it happened, so a flood reads as one line with a count', () => {
    expect(asJsonLog({ ...record, count: 4000 })).toMatchObject({ count: 4000 });
  });
});
