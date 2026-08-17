import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEVELS,
  LOG_LEVELS,
  LogQuerySchema,
  LogRecordSchema,
  forgottenAfterMs,
  isAtLeast,
  keptForDays,
  sameEventKey,
} from './Log';
import type { LogContext } from './Log';

const noContext: LogContext = {
  jobId: null,
  jobKind: null,
  libraryId: null,
  mediaId: null,
  sessionId: null,
  requestId: null,
};

describe('isAtLeast', () => {
  it('lets a record through at exactly the floor', () => {
    expect(isAtLeast('warn', 'warn')).toBe(true);
  });

  it('lets a more serious record through', () => {
    expect(isAtLeast('error', 'warn')).toBe(true);
  });

  it('keeps a less serious record out', () => {
    expect(isAtLeast('info', 'warn')).toBe(false);
  });

  it('orders every level it knows', () => {
    for (const level of LOG_LEVELS) {
      expect(isAtLeast(level, 'debug')).toBe(true);
    }
  });
});

describe('keptForDays', () => {
  it('keeps an error longer than a warning', () => {
    expect(keptForDays('error')).toBeGreaterThan(keptForDays('warn'));
  });

  it('keeps a warning longer than the ordinary chatter', () => {
    expect(keptForDays('warn')).toBeGreaterThan(keptForDays('info'));
  });

  it('keeps debugging output the shortest time of all', () => {
    expect(keptForDays('debug')).toBeLessThan(keptForDays('info'));
  });

  it('keeps everything for at least a day, so a log is never gone by morning', () => {
    for (const level of LOG_LEVELS) {
      expect(keptForDays(level)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('forgottenAfterMs', () => {
  it('answers later than the moment it was written', () => {
    expect(forgottenAfterMs('info', 1000)).toBeGreaterThan(1000);
  });

  it('forgets an info record before an error written at the same moment', () => {
    expect(forgottenAfterMs('info', 1000)).toBeLessThan(forgottenAfterMs('error', 1000));
  });
});

describe('sameEventKey', () => {
  it('treats the same message from the same place as one event repeating', () => {
    const one = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      context: noContext,
    });
    const two = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      context: noContext,
    });

    expect(one).toBe(two);
  });

  it('treats the same message about two files as two events', () => {
    const one = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      context: { ...noContext, mediaId: 'one' },
    });
    const two = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      context: { ...noContext, mediaId: 'two' },
    });

    expect(one).not.toBe(two);
  });

  it('treats the same message at two levels as two events', () => {
    const one = sameEventKey({
      level: 'warn',
      source: 'scanner',
      message: 'slow',
      context: noContext,
    });
    const two = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'slow',
      context: noContext,
    });

    expect(one).not.toBe(two);
  });

  it('makes a key Postgres will accept, which refuses a null byte in text', () => {
    const key = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      context: { ...noContext, jobId: 'job-1' },
    });

    expect([...key].some((letter) => letter.codePointAt(0) === 0)).toBe(false);
  });

  it('separates the parts, so two different records cannot share one key', () => {
    const one = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'a',
      context: { ...noContext, jobId: 'b' },
    });
    const two = sameEventKey({
      level: 'error',
      source: 'scanner',
      message: 'ab',
      context: noContext,
    });

    expect(one).not.toBe(two);
  });

  it('keeps two runs of the same job apart', () => {
    const one = sameEventKey({
      level: 'error',
      source: 'jobs',
      message: 'failed',
      context: { ...noContext, jobId: 'first' },
    });
    const two = sameEventKey({
      level: 'error',
      source: 'jobs',
      message: 'failed',
      context: { ...noContext, jobId: 'second' },
    });

    expect(one).not.toBe(two);
  });
});

describe('LogQuerySchema', () => {
  it('shows warnings and errors when nothing is asked for', () => {
    expect(LogQuerySchema.parse({}).levels).toStrictEqual([...DEFAULT_LEVELS]);
  });

  it('does not show the ordinary chatter by default', () => {
    expect(LogQuerySchema.parse({}).levels).not.toContain('info');
  });

  it('refuses a limit big enough to be a denial of service', () => {
    expect(LogQuerySchema.safeParse({ limit: 100000 }).success).toBe(false);
  });

  it('refuses a level it does not know', () => {
    expect(LogQuerySchema.safeParse({ levels: ['catastrophe'] }).success).toBe(false);
  });

  it('takes a time range', () => {
    const read = LogQuerySchema.parse({ sinceMs: 1000, untilMs: 2000 });

    expect(read.sinceMs).toBe(1000);
    expect(read.untilMs).toBe(2000);
  });
});

describe('LogRecordSchema', () => {
  it('reads a whole record', () => {
    const read = LogRecordSchema.safeParse({
      id: 'one',
      atMs: 1,
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      detail: null,
      count: 1,
      context: noContext,
    });

    expect(read.success).toBe(true);
  });

  it('refuses a record standing for no occurrences at all', () => {
    const read = LogRecordSchema.safeParse({
      id: 'one',
      atMs: 1,
      level: 'error',
      source: 'scanner',
      message: 'unreadable',
      detail: null,
      count: 0,
      context: noContext,
    });

    expect(read.success).toBe(false);
  });
});
