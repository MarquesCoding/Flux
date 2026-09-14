import { describe, expect, it } from 'vitest';
import { describePlaying } from './describePlaying';

describe('describePlaying', () => {
  it('names a film by its title and when it is from', () => {
    expect(describePlaying({ title: 'Arrival', year: 2016 })).toBe('Arrival (2016)');
  });

  it('names an episode by its programme, where in it this is, and what it is called', () => {
    expect(
      describePlaying({
        title: 'Breakage',
        seriesTitle: 'Breaking Bad',
        seasonNumber: 2,
        episodeNumber: 5,
        year: 2009,
      }),
    ).toBe('Breaking Bad · S2E5 · Breakage (2009)');
  });

  it('says the programme without a place in it where the numbering is unknown', () => {
    expect(describePlaying({ title: 'Breakage', seriesTitle: 'Breaking Bad', year: 2009 })).toBe(
      'Breaking Bad · Breakage (2009)',
    );
  });

  it('leaves the year out rather than drawing a gap where nothing was matched', () => {
    expect(describePlaying({ title: 'Arrival' })).toBe('Arrival');
    expect(describePlaying({ title: 'Arrival', year: null })).toBe('Arrival');
  });

  it('leaves the place out where only half the numbering is known', () => {
    expect(
      describePlaying({ title: 'Breakage', seriesTitle: 'Breaking Bad', seasonNumber: 2 }),
    ).toBe('Breaking Bad · Breakage');
  });

  it('counts a zeroth season as a place, since specials are numbered from nothing', () => {
    expect(
      describePlaying({
        title: 'Good Cop Bad Cop',
        seriesTitle: 'Breaking Bad',
        seasonNumber: 0,
        episodeNumber: 1,
      }),
    ).toBe('Breaking Bad · S0E1 · Good Cop Bad Cop');
  });
});
