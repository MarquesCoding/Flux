import { describe, expect, it } from 'vitest';
import { splitPersonCredits } from './splitPersonCredits';
import type { MediaSummary } from '@FluxContracts/schemas/Library';

const item = (over: Partial<MediaSummary> = {}): MediaSummary => ({
  id: 'one',
  libraryId: 'library-1',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
  hasLogo: false,
  seriesId: null,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  rating: null,
  genres: [],
  ...over,
});

const episodeOf = (show: string, number: number): MediaSummary =>
  item({
    id: `${show}-${number.toString()}`,
    title: `Episode ${number.toString()}`,
    seriesTitle: show,
    seasonNumber: 1,
    episodeNumber: number,
  });

describe('splitPersonCredits', () => {
  it('has nothing for somebody in nothing', () => {
    expect(splitPersonCredits([])).toEqual({ films: [], shows: [], episodes: [] });
  });

  it('counts a film as a film and not as a programme', () => {
    const found = splitPersonCredits([item()]);

    expect(found.films).toHaveLength(1);
    expect(found.shows).toHaveLength(0);
    expect(found.episodes).toHaveLength(0);
  });

  it('counts an episode as both an episode and the programme it belongs to', () => {
    const found = splitPersonCredits([episodeOf('The Bear', 1)]);

    expect(found.films).toHaveLength(0);
    expect(found.episodes).toHaveLength(1);
    expect(found.shows).toHaveLength(1);
    expect(found.shows[0]?.seriesTitle).toBe('The Bear');
  });

  it('names a programme once however many of its episodes they were in', () => {
    const found = splitPersonCredits([
      episodeOf('The Bear', 1),
      episodeOf('The Bear', 2),
      episodeOf('The Bear', 3),
    ]);

    expect(found.shows).toHaveLength(1);
    expect(found.episodes).toHaveLength(3);
  });

  it('stands a programme up as its earliest episode, so the card opens the programme', () => {
    const found = splitPersonCredits([
      episodeOf('The Bear', 3),
      episodeOf('The Bear', 1),
      episodeOf('The Bear', 2),
    ]);

    expect(found.shows[0]?.episodeNumber).toBe(1);
  });

  it('keeps two programmes apart', () => {
    const found = splitPersonCredits([episodeOf('The Bear', 1), episodeOf('Severance', 1)]);

    expect(found.shows.map((show) => show.seriesTitle).sort()).toEqual(['Severance', 'The Bear']);
  });

  it('sorts films and episodes into their own lists rather than mixing them', () => {
    const found = splitPersonCredits([item(), episodeOf('The Bear', 1)]);

    expect(found.films).toHaveLength(1);
    expect(found.episodes).toHaveLength(1);
    expect(found.films[0]?.title).toBe('Arrival');
  });
});
