import { describe, expect, it } from 'vitest';
import { lockFor } from './lockFor';
import {
  DETECT_SEGMENTS_JOB,
  READ_AGAIN_JOB,
  REGENERATE_PREVIEWS_JOB,
  SCAN_LIBRARY_JOB,
} from './JobQueue';

describe('the key a piece of library work is serialised under', () => {
  it('is one key for reading and re-reading, which both decide what a library holds', () => {
    expect(lockFor(READ_AGAIN_JOB, 'one')).toBe(lockFor(SCAN_LIBRARY_JOB, 'one'));
  });

  it('is a key of its own for work that only makes artefacts for what is already there', () => {
    expect(lockFor(REGENERATE_PREVIEWS_JOB, 'one')).not.toBe(lockFor(SCAN_LIBRARY_JOB, 'one'));
    expect(lockFor(DETECT_SEGMENTS_JOB, 'one')).not.toBe(lockFor(REGENERATE_PREVIEWS_JOB, 'one'));
  });

  it('never has two libraries share a key, whatever the work is', () => {
    expect(lockFor(SCAN_LIBRARY_JOB, 'one')).not.toBe(lockFor(SCAN_LIBRARY_JOB, 'two'));
    expect(lockFor(DETECT_SEGMENTS_JOB, 'one')).not.toBe(lockFor(DETECT_SEGMENTS_JOB, 'two'));
  });
});
