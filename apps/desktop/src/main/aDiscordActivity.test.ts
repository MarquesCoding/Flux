import { describe, expect, it } from 'vitest';
import { aDiscordActivity } from './aDiscordActivity';
import type { WhatIsPlaying } from './aDiscordActivity';

const STARTED = 1_755_000_000_000;

const AN_EPISODE: WhatIsPlaying = {
  kind: 'watching',
  title: 'The One With The Thing',
  series: 'A Programme',
  season: 2,
  episode: 12,
  startedAt: STARTED,
  endsAt: STARTED + 1_400_000,
  tmdbId: '1399',
  isSeries: true,
  isPaused: false,
  artwork: null,
  party: null,
};

const A_FILM: WhatIsPlaying = {
  kind: 'watching',
  title: 'A Film',
  series: null,
  season: null,
  episode: null,
  startedAt: STARTED,
  endsAt: null,
  tmdbId: '550',
  isSeries: false,
  isPaused: false,
  artwork: null,
  party: null,
};

describe('aDiscordActivity', () => {
  it('puts the programme on the top line, which is the one Discord draws largest', () => {
    expect(aDiscordActivity(AN_EPISODE, '0.0.0')).toMatchObject({
      details: 'A Programme',
    });
  });

  it('puts the episode below it, the way somebody would say it', () => {
    expect(aDiscordActivity(AN_EPISODE, '0.0.0')).toMatchObject({
      state: 'Series 2, Episode 12',
    });
  });

  it('gives a film one line, since it belongs to no programme', () => {
    const activity = aDiscordActivity(A_FILM, '0.0.0');

    expect(activity).toMatchObject({ details: 'A Film' });
    expect(activity).not.toHaveProperty('state');
  });

  it('says it is watching rather than playing, which is a different word in Discord', () => {
    expect(aDiscordActivity(A_FILM, '0.0.0')).toMatchObject({ type: 3 });
  });

  it('sends the times in seconds, so Discord counts for itself rather than being told', () => {
    expect(aDiscordActivity(AN_EPISODE, '0.0.0')?.timestamps).toEqual({
      start: 1_755_000_000,
      end: 1_755_001_400,
    });
  });

  it('sends no end for something whose length is not known', () => {
    expect(aDiscordActivity(A_FILM, '0.0.0')?.timestamps).toEqual({
      start: 1_755_000_000,
    });
  });

  it('draws the Valence logo where the catalogue has no picture to draw', () => {
    expect(aDiscordActivity(A_FILM, '0.0.0')?.assets).toMatchObject({
      large_image: 'logo',
      large_text: 'Valence v0.0.0',
    });
  });

  it('badges what is happening, which is what somebody looking wants to know', () => {
    expect(aDiscordActivity(AN_EPISODE, '0.0.0')?.assets).toMatchObject({
      small_image: 'valenceplay',
      small_text: 'Playing',
    });
  });

  it('badges a pause, so a still status is not mistaken for a stuck one', () => {
    expect(aDiscordActivity({ ...AN_EPISODE, isPaused: true }, '0.0.0')?.assets).toMatchObject({
      small_image: 'valencepause',
      small_text: 'Paused',
    });
  });

  it('badges browsing, which is somebody between things rather than stopped', () => {
    expect(aDiscordActivity({ kind: 'browsing' }, '0.0.0')?.assets).toMatchObject({
      small_image: 'valencesearch',
      small_text: 'Browsing',
    });
  });

  it('offers a way to look a film up, pointed at the right kind of page', () => {
    expect(aDiscordActivity(A_FILM, '0.0.0')?.buttons).toEqual([
      { label: 'View on TMDB', url: 'https://www.themoviedb.org/movie/550' },
    ]);
  });

  it('points a programme at the programme page rather than the film one', () => {
    expect(aDiscordActivity(AN_EPISODE, '0.0.0')?.buttons?.[0]?.url).toBe(
      'https://www.themoviedb.org/tv/1399',
    );
  });

  it('offers no button for something the catalogue never matched', () => {
    expect(
      aDiscordActivity({ ...A_FILM, kind: 'watching', tmdbId: null }, '0.0.0'),
    ).not.toHaveProperty('buttons');
  });

  it('says nothing at all when nothing is playing, which is how presence clears', () => {
    expect(aDiscordActivity(null, '0.0.0')).toBeNull();
  });

  it('says somebody has Valence open when they are between things, rather than nothing at all', () => {
    expect(aDiscordActivity({ kind: 'browsing' }, '0.0.0')?.details).toBe('Browsing the library');
  });

  it('draws the logo while browsing, so the status looks like the one beside it', () => {
    expect(aDiscordActivity({ kind: 'browsing' }, '0.0.0')?.assets).toMatchObject({
      large_image: 'logo',
      large_text: 'Valence v0.0.0',
      small_image: 'valencesearch',
    });
  });

  it('counts towards nothing while browsing, since there is nothing to count towards', () => {
    expect(aDiscordActivity({ kind: 'browsing' }, '0.0.0')).not.toHaveProperty('timestamps');
  });

  it('offers no button while browsing, since there is nowhere in particular to send anybody', () => {
    expect(aDiscordActivity({ kind: 'browsing' }, '0.0.0')).not.toHaveProperty('buttons');
  });

  it('draws the catalogue picture where there is one, which is what somebody recognises', () => {
    const poster = 'https://image.tmdb.org/t/p/w500/abc.jpg';

    expect(aDiscordActivity({ ...AN_EPISODE, artwork: poster }, '0.0.0')?.assets).toMatchObject({
      large_image: poster,
    });
  });

  it('refuses a picture from anywhere else, which would publish where somebody keeps their server', () => {
    const mine = 'https://valence.mine.local/api/media/1/poster';

    expect(aDiscordActivity({ ...AN_EPISODE, artwork: mine }, '0.0.0')?.assets).toMatchObject({
      large_image: 'logo',
    });
  });

  it('refuses a picture sent without encryption, wherever it came from', () => {
    const plain = 'http://image.tmdb.org/t/p/w500/abc.jpg';

    expect(aDiscordActivity({ ...AN_EPISODE, artwork: plain }, '0.0.0')?.assets).toMatchObject({
      large_image: 'logo',
    });
  });

  it('says which Valence this is when somebody rests on the picture', () => {
    expect(aDiscordActivity(AN_EPISODE, '1.2.3')?.assets.large_text).toBe('Valence v1.2.3');
  });

  it('sends a watch party as a group, so it draws the figure and the count', () => {
    expect(
      aDiscordActivity({ ...AN_EPISODE, party: { id: 'a-party', size: 3 } }, '0.0.0')?.party,
    ).toEqual({ id: 'a-party', size: [3, 3] });
  });

  it('sends no group for somebody watching on their own', () => {
    expect(aDiscordActivity(AN_EPISODE, '0.0.0')).not.toHaveProperty('party');
  });

  it('marks a pause rather than taking the status down, since a pause is still watching', () => {
    expect(aDiscordActivity({ ...AN_EPISODE, isPaused: true }, '0.0.0')?.state).toBe(
      'Paused — Series 2, Episode 12',
    );
  });

  it('says so plainly for a film, which has no line of its own to add it to', () => {
    expect(aDiscordActivity({ ...A_FILM, isPaused: true }, '0.0.0')?.state).toBe('Paused');
  });

  it('takes the clock off while paused, which would otherwise count towards an end not coming', () => {
    expect(aDiscordActivity({ ...AN_EPISODE, isPaused: true }, '0.0.0')).not.toHaveProperty(
      'timestamps',
    );
  });

  it('keeps what is playing on the status while paused, so it is still recognisable', () => {
    expect(aDiscordActivity({ ...AN_EPISODE, isPaused: true }, '0.0.0')?.details).toBe(
      'A Programme',
    );
  });

  it('says who somebody is watching with, in the line they read rather than a field they will not see', () => {
    expect(
      aDiscordActivity({ ...AN_EPISODE, party: { id: 'a-party', size: 2 } }, '0.0.0')?.state,
    ).toBe('Series 2, Episode 12 · with 1 other');
  });

  it('counts the others rather than the party, since somebody knows they are in it', () => {
    expect(
      aDiscordActivity({ ...AN_EPISODE, party: { id: 'a-party', size: 4 } }, '0.0.0')?.state,
    ).toBe('Series 2, Episode 12 · with 3 others');
  });

  it('says the company for a film, which has no line of its own to add it to', () => {
    expect(aDiscordActivity({ ...A_FILM, party: { id: 'a-party', size: 3 } }, '0.0.0')?.state).toBe(
      'with 2 others',
    );
  });

  it('says nothing about company for a party of one, which is watching alone', () => {
    expect(
      aDiscordActivity({ ...AN_EPISODE, party: { id: 'a-party', size: 1 } }, '0.0.0')?.state,
    ).toBe('Series 2, Episode 12');
  });

  it('keeps both the pause and the company, which are true at the same time', () => {
    expect(
      aDiscordActivity(
        { ...AN_EPISODE, isPaused: true, party: { id: 'a-party', size: 2 } },
        '0.0.0',
      )?.state,
    ).toBe('Paused — Series 2, Episode 12 · with 1 other');
  });
});
