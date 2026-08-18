import { describe, expect, it } from 'vitest';
import { describePlaybackFailure, PlaybackEngineErrorSchema } from './describePlaybackFailure';

describe('describePlaybackFailure', () => {
  it('blames the browser only when the browser could not decode it', () => {
    expect(describePlaybackFailure(3)).toBe('This browser could not decode the stream.');
  });

  it('says the stream never arrived when the manifest could not be read', () => {
    expect(describePlaybackFailure(4)).toContain('did not arrive');
  });

  it('says the same when the network failed', () => {
    expect(describePlaybackFailure(1)).toContain('did not arrive');
  });

  it('says the same when streaming stopped', () => {
    expect(describePlaybackFailure(5)).toContain('did not arrive');
  });

  it('does not blame the browser for a failure it cannot place', () => {
    expect(describePlaybackFailure(null)).toBe('The stream could not be played.');
    expect(describePlaybackFailure(9)).toBe('The stream could not be played.');
  });
});

describe('PlaybackEngineErrorSchema', () => {
  it('reads the category off an engine failure', () => {
    const parsed = PlaybackEngineErrorSchema.safeParse({ category: 4, code: 1001 });

    expect(parsed.success && parsed.data.category).toBe(4);
  });

  it('refuses anything else a catch might hand it', () => {
    expect(PlaybackEngineErrorSchema.safeParse(new Error('boom')).success).toBe(false);
    expect(PlaybackEngineErrorSchema.safeParse('boom').success).toBe(false);
    expect(PlaybackEngineErrorSchema.safeParse(undefined).success).toBe(false);
  });
});
