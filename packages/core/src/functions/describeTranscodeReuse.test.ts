import { describe, expect, it } from 'vitest';
import { describeTranscodeReuse } from './describeTranscodeReuse';
import { TRANSCODE_REUSES } from '@ValenceContracts/schemas/TranscodeReuse';

describe('describeTranscodeReuse', () => {
  it('says a finished transcode was reused whole', () => {
    expect(describeTranscodeReuse('whole')).toBe('Yes — the whole transcode was already made');
  });

  it('names the case where one encoder is serving two viewers', () => {
    expect(describeTranscodeReuse('shared')).toBe(
      'Shared — another viewer’s transcode of exactly this',
    );
  });

  it('says a part-finished directory was resumed rather than started again', () => {
    expect(describeTranscodeReuse('partial')).toBe(
      'Partly — resumed where an earlier session stopped',
    );
  });

  it('says plainly that a fresh transcode is being made now', () => {
    expect(describeTranscodeReuse('none')).toBe('No — this transcode is being made now');
  });

  it('says the question does not apply where nothing is transcoded', () => {
    expect(describeTranscodeReuse(null)).toBe('n/a — nothing is being transcoded');
  });

  it('answers for every state the contract allows', () => {
    for (const reuse of TRANSCODE_REUSES) {
      expect(describeTranscodeReuse(reuse).length).toBeGreaterThan(0);
    }
  });
});
