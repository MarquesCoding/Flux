import { describe, expect, it } from 'vitest';
import { matchesLogQuery } from './matchesLogQuery';
import type { LogRecord } from '@FluxContracts/schemas/Log';

const aRecord = (over?: Partial<LogRecord>): LogRecord => ({
  id: 'one',
  atMs: 1000,
  level: 'error',
  source: 'scanner',
  message: 'could not read the file',
  detail: null,
  count: 1,
  context: {
    jobId: null,
    jobKind: null,
    libraryId: null,
    mediaId: null,
    sessionId: null,
    requestId: null,
  },
  ...over,
});

describe('matchesLogQuery', () => {
  it('takes anything when nothing was asked for', () => {
    expect(matchesLogQuery(aRecord(), {})).toBe(true);
  });

  it('keeps a record at a level being watched', () => {
    expect(matchesLogQuery(aRecord({ level: 'error' }), { levels: ['warn', 'error'] })).toBe(true);
  });

  it('turns away a record at a level nobody asked for', () => {
    expect(matchesLogQuery(aRecord({ level: 'info' }), { levels: ['warn', 'error'] })).toBe(false);
  });

  it('keeps a record from a source being watched', () => {
    expect(matchesLogQuery(aRecord({ source: 'scanner' }), { sources: ['scanner'] })).toBe(true);
  });

  it('turns away a record from another source', () => {
    expect(matchesLogQuery(aRecord({ source: 'jobs' }), { sources: ['scanner'] })).toBe(false);
  });

  it('keeps a record whose message contains what was searched for', () => {
    expect(matchesLogQuery(aRecord(), { search: 'could not' })).toBe(true);
  });

  it('does not care about capitals when searching', () => {
    expect(matchesLogQuery(aRecord(), { search: 'COULD NOT' })).toBe(true);
  });

  it('searches the detail as well, which is where a stack trace lives', () => {
    expect(matchesLogQuery(aRecord({ detail: 'at readFile()' }), { search: 'readfile' })).toBe(
      true,
    );
  });

  it('turns away a record that does not contain the search at all', () => {
    expect(matchesLogQuery(aRecord(), { search: 'something else' })).toBe(false);
  });

  it('ignores a search of nothing but spaces', () => {
    expect(matchesLogQuery(aRecord(), { search: '   ' })).toBe(true);
  });

  it('keeps a record inside the time range', () => {
    expect(matchesLogQuery(aRecord({ atMs: 1500 }), { sinceMs: 1000, untilMs: 2000 })).toBe(true);
  });

  it('turns away a record from before the range', () => {
    expect(matchesLogQuery(aRecord({ atMs: 500 }), { sinceMs: 1000 })).toBe(false);
  });

  it('turns away a record from after the range', () => {
    expect(matchesLogQuery(aRecord({ atMs: 5000 }), { untilMs: 2000 })).toBe(false);
  });

  it('keeps a record belonging to the job being read', () => {
    const record = aRecord({ context: { ...aRecord().context, jobId: 'job-1' } });

    expect(matchesLogQuery(record, { jobId: 'job-1' })).toBe(true);
  });

  it('turns away a record belonging to another job', () => {
    const record = aRecord({ context: { ...aRecord().context, jobId: 'job-2' } });

    expect(matchesLogQuery(record, { jobId: 'job-1' })).toBe(false);
  });

  it('turns away a record belonging to no job when one was asked for', () => {
    expect(matchesLogQuery(aRecord(), { jobId: 'job-1' })).toBe(false);
  });

  it('needs every part of the query to hold, not just one', () => {
    const record = aRecord({ level: 'error', source: 'jobs' });

    expect(matchesLogQuery(record, { levels: ['error'], sources: ['scanner'] })).toBe(false);
  });
});
