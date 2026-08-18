import { describe, expect, it } from 'vitest';
import { decideWhatFollows } from './decideWhatFollows';
import { STILL_WATCHING_OFF } from '@FluxContracts/schemas/StillWatching';

const episode = { id: 'two', title: 'The Second One' };

describe('decideWhatFollows', () => {
  it('lets a series end rather than asking about nothing', () => {
    expect(decideWhatFollows({ following: null, carriedOn: 9, askAfter: 4 })).toStrictEqual({
      kind: 'nothing',
    });
  });

  it('plays the next episode while the allowance holds', () => {
    expect(decideWhatFollows({ following: episode, carriedOn: 1, askAfter: 4 })).toStrictEqual({
      kind: 'play',
      episode,
    });
  });

  it('asks once enough have carried on by themselves', () => {
    expect(decideWhatFollows({ following: episode, carriedOn: 4, askAfter: 4 })).toStrictEqual({
      kind: 'ask',
      episode,
    });
  });

  it('never asks a profile that turned it off', () => {
    expect(
      decideWhatFollows({ following: episode, carriedOn: 99, askAfter: STILL_WATCHING_OFF }),
    ).toStrictEqual({ kind: 'play', episode });
  });

  it('asks instead of playing, so nothing is started for an empty room', () => {
    const decided = decideWhatFollows({ following: episode, carriedOn: 4, askAfter: 4 });

    expect(decided.kind).not.toBe('play');
  });

  it('plays the first follow-on without asking, since somebody just chose the one before', () => {
    expect(decideWhatFollows({ following: episode, carriedOn: 0, askAfter: 1 })).toStrictEqual({
      kind: 'play',
      episode,
    });
  });
});
