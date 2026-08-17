import { describe, expect, it } from 'vitest';
import { whatToReport } from './whatToReport';
import type { Player } from './whatToReport';

const player = (over?: Partial<Player>): Player => ({
  isSessionPlaying: true,
  readyState: 4,
  currentSeconds: 600,
  lastGoodSeconds: 590,
  bufferedAheadSeconds: 10,
  isPaused: false,
  ...over,
});

describe('whatToReport', () => {
  it('reports where the picture actually is when the stream is up', () => {
    expect(whatToReport(player()).positionSeconds).toBe(600);
  });

  it('reports the last position known to be real while the stream is being rebuilt', () => {
    expect(
      whatToReport(player({ isSessionPlaying: false, currentSeconds: 0 })).positionSeconds,
    ).toBe(590);
  });

  it('does not believe an element that has not read the file yet', () => {
    expect(whatToReport(player({ readyState: 0, currentSeconds: 0 })).positionSeconds).toBe(590);
  });

  it('says it is not watching while its stream is being rebuilt, whatever the element thinks', () => {
    expect(whatToReport(player({ isSessionPlaying: false, isPaused: false })).isWatching).toBe(
      false,
    );
  });

  it('says it is not ready while its stream is being rebuilt', () => {
    expect(whatToReport(player({ isSessionPlaying: false })).isReady).toBe(false);
  });

  it('is ready when the browser says it could play now', () => {
    expect(whatToReport(player({ readyState: 3, bufferedAheadSeconds: 0.2 })).isReady).toBe(true);
  });

  it('is ready on a comfortable buffer even where the browser is shy about saying so', () => {
    expect(whatToReport(player({ readyState: 2, bufferedAheadSeconds: 10 })).isReady).toBe(true);
  });

  it('is not ready with neither, which is a player that would stall the moment it started', () => {
    expect(whatToReport(player({ readyState: 2, bufferedAheadSeconds: 0.2 })).isReady).toBe(false);
  });

  it('is watching only when it is actually running', () => {
    expect(whatToReport(player({ isPaused: true })).isWatching).toBe(false);
  });
});
