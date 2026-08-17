import { describe, expect, it } from 'vitest';
import { whereTheRoomIs, STOPPED_REPORTING_AFTER_MS } from './whereTheRoomIs';

const reading = (over?: Partial<Parameters<typeof whereTheRoomIs>[0]>) => ({
  positionSeconds: 100,
  reportedAtMs: 10_000,
  isWatching: true,
  ...over,
});

describe('whereTheRoomIs', () => {
  it('takes a fresh reading as it stands', () => {
    expect(whereTheRoomIs(reading(), 10_000)).toBe(100);
  });

  it('adds the time that has passed since the reading was taken', () => {
    expect(whereTheRoomIs(reading(), 11_500)).toBe(101.5);
  });

  it('leaves a paused room where it is, since a paused picture makes no progress', () => {
    expect(whereTheRoomIs(reading({ isWatching: false }), 15_000)).toBe(100);
  });

  it('stops extrapolating a room that has stopped reporting, rather than guessing without limit', () => {
    const hours = 10_000 + 60 * 60 * 1000;

    expect(whereTheRoomIs(reading(), hours)).toBe(100 + STOPPED_REPORTING_AFTER_MS / 1000);
  });

  it('does not run backwards for a reading stamped ahead of this clock', () => {
    expect(whereTheRoomIs(reading(), 9000)).toBe(100);
  });
});
