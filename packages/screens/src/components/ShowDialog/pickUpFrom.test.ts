import { describe, expect, it } from 'vitest';
import { pickUpFrom } from './pickUpFrom';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { ShowDetail } from '@ValenceContracts/schemas/Show';

const episode = (seasonNumber: number, episodeNumber: number): MediaSummary => ({
  id: `${seasonNumber.toString()}-${episodeNumber.toString()}`,
  libraryId: '11111111-1111-4111-8111-111111111111',
  title: `Episode ${episodeNumber.toString()}`,
  year: 2024,
  durationSeconds: 1400,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  hasLogo: false,
  seriesId: null,
  seriesTitle: 'A Sign of Affection',
  seasonNumber,
  episodeNumber,
});

const show = (seasons: { seasonNumber: number; episodes: number[] }[]): ShowDetail => ({
  id: 'a-sign-of-affection',
  libraryId: '11111111-1111-4111-8111-111111111111',
  title: 'A Sign of Affection',
  seasonCount: seasons.length,
  episodeCount: seasons.reduce((count, season) => count + season.episodes.length, 0),
  latestAddedAt: '2026-08-10T00:00:00.000Z',
  coverMediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  year: 2024,
  rating: 8.1,
  genres: [],
  seasons: seasons.map((season) => ({
    seasonNumber: season.seasonNumber,
    episodes: season.episodes.map((number) => episode(season.seasonNumber, number)),
  })),
});

describe('pickUpFrom', () => {
  it('offers the first episode to somebody who has watched none of it', () => {
    const carryingOn = pickUpFrom(show([{ seasonNumber: 1, episodes: [1, 2, 3] }]));

    expect(carryingOn?.episode.title).toBe('Episode 1');
    expect(carryingOn?.isResuming).toBe(false);
  });

  it('returns to the episode left half-watched', () => {
    const carryingOn = pickUpFrom(show([{ seasonNumber: 1, episodes: [1, 2, 3] }]), {
      resumeFor: (id) => (id === '1-2' ? 420 : null),
    });

    expect(carryingOn?.episode.title).toBe('Episode 2');
    expect(carryingOn?.startSeconds).toBe(420);
    expect(carryingOn?.isResuming).toBe(true);
  });

  it('prefers a half-watched episode over the next unwatched one', () => {
    const carryingOn = pickUpFrom(show([{ seasonNumber: 1, episodes: [1, 2, 3] }]), {
      resumeFor: (id) => (id === '1-3' ? 60 : null),
      isFinished: (id) => id === '1-1',
    });

    expect(carryingOn?.episode.title).toBe('Episode 3');
  });

  it('offers the next one after those already finished', () => {
    const carryingOn = pickUpFrom(show([{ seasonNumber: 1, episodes: [1, 2, 3] }]), {
      isFinished: (id) => id === '1-1' || id === '1-2',
    });

    expect(carryingOn?.episode.title).toBe('Episode 3');
    expect(carryingOn?.startSeconds).toBe(0);
  });

  it('offers the first again once the whole series is finished', () => {
    const carryingOn = pickUpFrom(show([{ seasonNumber: 1, episodes: [1, 2] }]), {
      isFinished: () => true,
    });

    expect(carryingOn?.episode.title).toBe('Episode 1');
    expect(carryingOn?.isResuming).toBe(false);
  });

  it('carries on across a season boundary', () => {
    const carryingOn = pickUpFrom(
      show([
        { seasonNumber: 1, episodes: [1] },
        { seasonNumber: 2, episodes: [1] },
      ]),
      { isFinished: (id) => id === '1-1' },
    );

    expect(carryingOn?.episode.seasonNumber).toBe(2);
  });

  it('has nothing to offer for a series with no episodes', () => {
    expect(pickUpFrom(show([]))).toBeNull();
  });

  it('starts a resume on a whole second, since the contract takes an integer', () => {
    const carryingOn = pickUpFrom(show([{ seasonNumber: 1, episodes: [1] }]), {
      resumeFor: () => 12.7,
    });

    expect(Number.isInteger(carryingOn?.startSeconds)).toBe(true);
  });
});
