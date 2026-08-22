import { describe, expect, it } from 'vitest';
import { logsAsText } from './logsAsText';
import type { LogRecord } from '@ValenceContracts/schemas/Log';

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

describe('logsAsText', () => {
  it('writes the message', () => {
    expect(logsAsText([aRecord()])).toContain('could not read the file');
  });

  it('writes when it happened', () => {
    expect(logsAsText([aRecord()])).toContain('1970-01-01T00:00:01.000Z');
  });

  it('writes how serious it was and where it came from', () => {
    const text = logsAsText([aRecord()]);

    expect(text).toContain('ERROR');
    expect(text).toContain('scanner');
  });

  it('warns about the file paths it is about to hand over', () => {
    expect(logsAsText([aRecord()]).toLowerCase()).toContain('paths');
  });

  it('puts the warning before anything else, where it will be read', () => {
    const text = logsAsText([aRecord()]);

    expect(text.indexOf('#')).toBeLessThan(text.indexOf('could not read'));
  });

  it('reads oldest first, which is the order a story happens in', () => {
    const text = logsAsText([
      aRecord({ id: 'b', atMs: 2000, message: 'second' }),
      aRecord({ id: 'a', atMs: 1000, message: 'first' }),
    ]);

    expect(text.indexOf('first')).toBeLessThan(text.indexOf('second'));
  });

  it('says how many times a repeat happened rather than writing it out again', () => {
    const text = logsAsText([aRecord({ count: 4000 })]);

    expect(text).toContain('[x4000]');
    expect(text.split('could not read the file')).toHaveLength(2);
  });

  it('says nothing about a count of one, which is the ordinary case', () => {
    expect(logsAsText([aRecord()])).not.toContain('[x1]');
  });

  it('carries the context, which is what makes a pasted log answerable', () => {
    const text = logsAsText([aRecord({ context: { ...aRecord().context, jobId: 'job-1' } })]);

    expect(text).toContain('jobId=job-1');
  });

  it('leaves out context nothing was said about', () => {
    expect(logsAsText([aRecord()])).not.toContain('mediaId=');
  });

  it('carries a stack trace, indented under the line it belongs to', () => {
    const text = logsAsText([aRecord({ detail: 'at read()\nat scan()' })]);

    expect(text).toContain('    at read()');
    expect(text).toContain('    at scan()');
  });

  it('still writes the warning when there is nothing to export', () => {
    expect(logsAsText([])).toContain('#');
  });
});
