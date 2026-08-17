import { describe, expect, it } from 'vitest';
import { countCarriedOn } from './countCarriedOn';

describe('countCarriedOn', () => {
  it('carries the run on when the player started the episode itself', () => {
    expect(countCarriedOn({ nowPlaying: 'two', carriedOnTo: 'two', carriedOn: 3 })).toBe(3);
  });

  it('ends the run when somebody chose something else', () => {
    expect(countCarriedOn({ nowPlaying: 'elsewhere', carriedOnTo: 'two', carriedOn: 3 })).toBe(0);
  });

  it('ends the run when playback stops', () => {
    expect(countCarriedOn({ nowPlaying: null, carriedOnTo: 'two', carriedOn: 3 })).toBe(0);
  });

  it('ends the run when somebody chose the very episode that was up next', () => {
    expect(countCarriedOn({ nowPlaying: 'two', carriedOnTo: null, carriedOn: 3 })).toBe(0);
  });

  it('starts at nothing for the episode somebody picked to begin with', () => {
    expect(countCarriedOn({ nowPlaying: 'one', carriedOnTo: null, carriedOn: 0 })).toBe(0);
  });

  it('does not treat a repeat of the same episode as a fresh run', () => {
    expect(countCarriedOn({ nowPlaying: 'two', carriedOnTo: 'two', carriedOn: 0 })).toBe(0);
  });
});
