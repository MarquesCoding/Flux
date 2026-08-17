import { describe, expect, it } from 'vitest';
import {
  STILL_WATCHING_DEFAULT,
  STILL_WATCHING_MAX,
  STILL_WATCHING_OFF,
  StillWatchingSchema,
  neverAsks,
  shouldAskStillWatching,
} from './StillWatching';

describe('shouldAskStillWatching', () => {
  it('says nothing while somebody is on the episode they chose', () => {
    expect(shouldAskStillWatching(0, 4)).toBe(false);
  });

  it('says nothing before the allowance is used up', () => {
    expect(shouldAskStillWatching(3, 4)).toBe(false);
  });

  it('asks once enough episodes have carried on by themselves', () => {
    expect(shouldAskStillWatching(4, 4)).toBe(true);
  });

  it('keeps asking rather than giving up after the first time', () => {
    expect(shouldAskStillWatching(9, 4)).toBe(true);
  });

  it('never asks a profile that turned it off', () => {
    expect(shouldAskStillWatching(100, STILL_WATCHING_OFF)).toBe(false);
  });

  it('asks after a single episode where somebody set it that low', () => {
    expect(shouldAskStillWatching(1, 1)).toBe(true);
    expect(shouldAskStillWatching(0, 1)).toBe(false);
  });
});

describe('neverAsks', () => {
  it('is true only where the question is turned off', () => {
    expect(neverAsks(STILL_WATCHING_OFF)).toBe(true);
    expect(neverAsks(1)).toBe(false);
    expect(neverAsks(STILL_WATCHING_DEFAULT)).toBe(false);
  });
});

describe('StillWatchingSchema', () => {
  it('is more relaxed than a service charging per stream, since nobody here is', () => {
    expect(STILL_WATCHING_DEFAULT).toBeGreaterThan(3);
  });

  it('takes the default when a profile has said nothing', () => {
    expect(StillWatchingSchema.parse(undefined)).toBe(STILL_WATCHING_DEFAULT);
  });

  it('takes being turned off', () => {
    expect(StillWatchingSchema.safeParse(STILL_WATCHING_OFF).success).toBe(true);
  });

  it('refuses a negative allowance, which would mean nothing', () => {
    expect(StillWatchingSchema.safeParse(-1).success).toBe(false);
  });

  it('refuses a fractional allowance, since episodes come whole', () => {
    expect(StillWatchingSchema.safeParse(2.5).success).toBe(false);
  });

  it('refuses an allowance so high it would never fire', () => {
    expect(StillWatchingSchema.safeParse(STILL_WATCHING_MAX + 1).success).toBe(false);
  });
});
