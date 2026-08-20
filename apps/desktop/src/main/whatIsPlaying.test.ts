import { describe, expect, it } from 'vitest';
import { whatIsPlaying } from './whatIsPlaying';

const SAID = {
  kind: 'watching',
  title: 'A Film',
  series: null,
  season: null,
  episode: null,
  startedAt: 1_755_000_000_000,
  endsAt: null,
  tmdbId: '550',
  isSeries: false,
  isPaused: false,
  artwork: null,
  party: null,
};

describe('whatIsPlaying', () => {
  it('reads what a page said is playing', () => {
    expect(whatIsPlaying(SAID)).toEqual(SAID);
  });

  it('reads nothing as nothing, which is how a status clears', () => {
    expect(whatIsPlaying(null)).toBeNull();
  });

  it('refuses a title longer than a title, which would be published under somebody name', () => {
    expect(whatIsPlaying({ ...SAID, title: 'x'.repeat(500) })).toBeNull();
  });

  it('refuses an id that is not one, since it is put straight into a link', () => {
    expect(whatIsPlaying({ ...SAID, tmdbId: 'javascript:alert(1)' })).toBeNull();
  });

  it('refuses a shape it does not recognise rather than passing it on', () => {
    expect(whatIsPlaying({ title: 'A Film' })).toBeNull();
    expect(whatIsPlaying('a string')).toBeNull();
  });

  it('reads an episode, which carries the series and the numbers', () => {
    const episode = { ...SAID, series: 'A Programme', season: 2, episode: 12, isSeries: true };

    expect(whatIsPlaying(episode)).toMatchObject({ series: 'A Programme', season: 2 });
  });

  it('reads somebody browsing, which is a state of its own and not an absence', () => {
    expect(whatIsPlaying({ kind: 'browsing' })).toEqual({ kind: 'browsing' });
  });

  it('refuses a state it does not know, rather than publishing it', () => {
    expect(whatIsPlaying({ kind: 'something-else' })).toBeNull();
  });

  it('keeps what is playing when the picture is one it cannot use, rather than saying nothing', () => {
    const read = whatIsPlaying({ ...SAID, artwork: 'not-a-url' });

    expect(read).not.toBeNull();
    expect(read?.kind === 'watching' ? read.artwork : 'x').toBeNull();
  });

  it('reads a watch party, which is what draws the group beside the time', () => {
    const read = whatIsPlaying({ ...SAID, party: { id: 'a-party', size: 3 } });

    expect(read?.kind === 'watching' ? read.party : null).toEqual({ id: 'a-party', size: 3 });
  });
});
