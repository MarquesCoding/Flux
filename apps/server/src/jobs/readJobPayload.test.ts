import { describe, expect, it } from 'vitest';
import { readJobPayload } from './readJobPayload';

describe('readJobPayload', () => {
  it('reads a job that carries something', () => {
    expect(readJobPayload({ libraryId: 'abc', force: true })).toEqual({
      libraryId: 'abc',
      force: true,
    });
  });

  it('reads a scheduled job, which carries nothing at all', () => {
    expect(readJobPayload(null)).toEqual({});
  });

  it('reads what a queue should never deliver rather than throwing on it', () => {
    expect(readJobPayload([1, 2])).toEqual({});
    expect(readJobPayload('scan')).toEqual({});
    expect(readJobPayload(7)).toEqual({});
    expect(readJobPayload(false)).toEqual({});
  });
});
