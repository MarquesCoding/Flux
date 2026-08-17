import { describe, expect, it } from 'vitest';
import { covers, reachOf } from './shareReach';

const FILM = '9c858901-8a57-4791-81fe-4c455b099bc9';
const SESSION = '5d3e2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';

const asking = (path: string) => reachOf({ method: 'GET', path });

describe('what a guest may ask for', () => {
  it('lets them read the share they were given', () => {
    expect(asking('/api/share/some-token').kind).toBe('allowed');
  });

  it('lets them ask about an item, subject to a check', () => {
    expect(asking(`/api/media/${FILM}`)).toEqual({ kind: 'needsItem', mediaId: FILM });
  });

  it('lets them fetch artwork, subject to a check', () => {
    expect(asking(`/api/media/${FILM}/image/backdrop`)).toEqual({
      kind: 'needsItem',
      mediaId: FILM,
    });
  });

  it('lets them fetch subtitles and segments, subject to a check', () => {
    expect(asking(`/api/media/${FILM}/subtitles`).kind).toBe('needsItem');
    expect(asking(`/api/media/${FILM}/segments`).kind).toBe('needsItem');
  });

  it('lets them start playing, subject to a check', () => {
    expect(asking(`/api/playback/${FILM}/session`)).toEqual({ kind: 'needsItem', mediaId: FILM });
  });

  it('lets them fetch trickplay and a frame, subject to a check', () => {
    expect(asking(`/api/playback/${FILM}/trickplay`).kind).toBe('needsItem');
    expect(asking(`/api/playback/${FILM}/frame`).kind).toBe('needsItem');
  });

  it('lets them fetch a segment, subject to the session being one of theirs', () => {
    expect(asking(`/api/playback/session/${SESSION}/segment00001.ts`)).toEqual({
      kind: 'needsSession',
      sessionId: SESSION,
    });
  });

  it('lets them fetch the manifest, subject to the same check', () => {
    expect(asking(`/api/playback/session/${SESSION}/index.m3u8`)).toEqual({
      kind: 'needsSession',
      sessionId: SESSION,
    });
  });

  it('lets them keep a session alive and stop it, subject to the same check', () => {
    expect(asking(`/api/playback/session/${SESSION}/heartbeat`).kind).toBe('needsSession');
    expect(asking(`/api/playback/session/${SESSION}`).kind).toBe('needsSession');
  });
});

describe('what a guest may never ask for', () => {
  it('refuses the library', () => {
    expect(asking('/api/libraries').kind).toBe('refused');
    expect(asking('/api/libraries/2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f/items').kind).toBe(
      'refused',
    );
  });

  it('refuses search', () => {
    expect(asking('/api/libraries/2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f/items?search=x').kind).toBe(
      'refused',
    );
  });

  it('refuses the shows listing', () => {
    expect(asking('/api/libraries/2b6f0cc9-04f0-4f26-9f1a-1d5b2ea92d9f/shows').kind).toBe(
      'refused',
    );
  });

  it('refuses anything about an account or a profile', () => {
    expect(asking('/api/profiles').kind).toBe('refused');
    expect(asking('/api/shares').kind).toBe('refused');
    expect(asking('/api/keys').kind).toBe('refused');
  });

  it('refuses the admin area outright', () => {
    expect(asking('/api/admin/accounts').kind).toBe('refused');
    expect(asking('/api/admin/settings').kind).toBe('refused');
  });

  it('refuses favourites, ratings, progress and history', () => {
    expect(asking('/api/favourites').kind).toBe('refused');
    expect(asking('/api/ratings').kind).toBe('refused');
    expect(asking('/api/progress').kind).toBe('refused');
    expect(asking('/api/history').kind).toBe('refused');
  });

  it('refuses making another share', () => {
    expect(reachOf({ method: 'POST', path: '/api/shares' }).kind).toBe('refused');
  });

  it('refuses a route nobody has thought about yet', () => {
    expect(asking('/api/something/invented/later').kind).toBe('refused');
  });
});

describe('covers', () => {
  const film = { id: FILM, seriesId: null };
  const episode = { id: 'ep-1', seriesId: 'show-1' };

  it('covers the one item an item share names', () => {
    expect(covers({ kind: 'item', mediaId: FILM, seriesId: null }, film)).toBe(true);
  });

  it('covers nothing else from an item share', () => {
    expect(covers({ kind: 'item', mediaId: FILM, seriesId: null }, episode)).toBe(false);
  });

  it('covers every episode of the series a series share names', () => {
    expect(covers({ kind: 'series', mediaId: null, seriesId: 'show-1' }, episode)).toBe(true);
  });

  it('covers no other series', () => {
    expect(
      covers(
        { kind: 'series', mediaId: null, seriesId: 'show-1' },
        { id: 'x', seriesId: 'show-2' },
      ),
    ).toBe(false);
  });

  it('covers no film from a series share', () => {
    expect(covers({ kind: 'series', mediaId: null, seriesId: 'show-1' }, film)).toBe(false);
  });

  it('covers nothing when the share names nothing', () => {
    expect(covers({ kind: 'item', mediaId: null, seriesId: null }, film)).toBe(false);
    expect(covers({ kind: 'series', mediaId: null, seriesId: null }, episode)).toBe(false);
  });
});
