import { describe, expect, it } from 'vitest';
import { aDiscordActivity } from './aDiscordActivity';
import type { WhatIsPlaying } from './aDiscordActivity';

const STARTED = 1_755_000_000_000;

const AN_EPISODE: WhatIsPlaying = {
  title: 'The One With The Thing',
  series: 'A Programme',
  season: 2,
  episode: 12,
  startedAt: STARTED,
  endsAt: STARTED + 1_400_000,
  tmdbId: '1399',
  isSeries: true,
};

const A_FILM: WhatIsPlaying = {
  title: 'A Film',
  series: null,
  season: null,
  episode: null,
  startedAt: STARTED,
  endsAt: null,
  tmdbId: '550',
  isSeries: false,
};

describe('aDiscordActivity', () => {
  it('puts the programme on the top line, which is the one Discord draws largest', () => {
    expect(aDiscordActivity(AN_EPISODE, 'darwin')).toMatchObject({ details: 'A Programme' });
  });

  it('puts the episode below it, the way somebody would say it', () => {
    expect(aDiscordActivity(AN_EPISODE, 'darwin')).toMatchObject({
      state: 'Series 2, Episode 12',
    });
  });

  it('gives a film one line, since it belongs to no programme', () => {
    const activity = aDiscordActivity(A_FILM, 'darwin');

    expect(activity).toMatchObject({ details: 'A Film' });
    expect(activity).not.toHaveProperty('state');
  });

  it('says it is watching rather than playing, which is a different word in Discord', () => {
    expect(aDiscordActivity(A_FILM, 'darwin')).toMatchObject({ type: 3 });
  });

  it('sends the times in seconds, so Discord counts for itself rather than being told', () => {
    expect(aDiscordActivity(AN_EPISODE, 'darwin')?.timestamps).toEqual({
      start: 1_755_000_000,
      end: 1_755_001_400,
    });
  });

  it('sends no end for something whose length is not known', () => {
    expect(aDiscordActivity(A_FILM, 'darwin')?.timestamps).toEqual({ start: 1_755_000_000 });
  });

  it('draws the Flux logo, since a library poster is neither registered nor reachable', () => {
    expect(aDiscordActivity(A_FILM, 'darwin')?.assets).toMatchObject({
      large_image: 'logo',
      large_text: 'Flux',
    });
  });

  it('badges a Mac, which is the second asset registered', () => {
    expect(aDiscordActivity(A_FILM, 'darwin')?.assets).toMatchObject({ small_image: 'macOS' });
  });

  it('badges nothing where no asset is registered for the platform', () => {
    expect(aDiscordActivity(A_FILM, 'linux')?.assets).not.toHaveProperty('small_image');
  });

  it('offers a way to look a film up, pointed at the right kind of page', () => {
    expect(aDiscordActivity(A_FILM, 'darwin')?.buttons).toEqual([
      { label: 'View on TMDB', url: 'https://www.themoviedb.org/movie/550' },
    ]);
  });

  it('points a programme at the programme page rather than the film one', () => {
    expect(aDiscordActivity(AN_EPISODE, 'darwin')?.buttons?.[0]?.url).toBe(
      'https://www.themoviedb.org/tv/1399',
    );
  });

  it('offers no button for something the catalogue never matched', () => {
    expect(aDiscordActivity({ ...A_FILM, tmdbId: null }, 'darwin')).not.toHaveProperty('buttons');
  });

  it('says nothing at all when nothing is playing, which is how presence clears', () => {
    expect(aDiscordActivity(null, 'darwin')).toBeNull();
  });
});
