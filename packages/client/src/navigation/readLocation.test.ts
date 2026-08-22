import { describe, expect, it } from 'vitest';
import { readLocation, writeLocation, placeIn, HOME } from './readLocation';

const at = (path: string) => readLocation(`http://valence.local${path}`);

describe('readLocation', () => {
  it('reads the root as home', () => {
    expect(at('/')).toEqual(HOME);
  });

  it('reads a section from the path', () => {
    expect(at('/films').section).toBe('films');
  });

  it('lands on home rather than failing on a section that does not exist', () => {
    expect(at('/nowhere').section).toBe('home');
  });

  it('reads what was searched for', () => {
    expect(at('/search?q=blade').search).toBe('blade');
  });

  it('reads an item opened over a section', () => {
    expect(at('/search?q=blade&item=abc').inspecting).toBe('abc');
  });

  it('reads an item addressed on its own', () => {
    expect(at('/media/abc').inspecting).toBe('abc');
  });

  it('reads what is being watched', () => {
    expect(at('/watch/abc').playing).toBe('abc');
  });

  it('says nothing about where to start, that being the server\u2019s to answer', () => {
    expect(at('/watch/abc?t=930')).toStrictEqual(at('/watch/abc'));
  });

  it('is not watching anything when the path names no item', () => {
    expect(at('/watch').playing).toBeNull();
  });

  it('lands on home rather than failing on an address that is not one', () => {
    expect(readLocation('not an address')).toEqual(HOME);
  });

  it('reads which admin panel was open', () => {
    expect(at('/?admin=work').admin).toBe('work');
  });

  it('has no admin panel when the address does not name one', () => {
    expect(at('/films').admin).toBeNull();
  });

  it('reads which job schedule page was open', () => {
    expect(at('/?admin=work&job=library.scan').adminJob).toBe('library.scan');
  });

  it('has no admin job when the address does not name one', () => {
    expect(at('/films').adminJob).toBeNull();
  });
});

describe('writeLocation', () => {
  it('writes home as the root, not as a named section', () => {
    expect(writeLocation(HOME)).toBe('/');
  });

  it('writes a section as a path', () => {
    expect(writeLocation({ ...HOME, section: 'account' })).toBe('/account');
  });

  it('writes what was searched for', () => {
    expect(writeLocation({ ...HOME, section: 'search', search: 'blade runner' })).toBe(
      '/search?q=blade+runner',
    );
  });

  it('writes an open series as a query, so an episode can open over it', () => {
    expect(writeLocation({ ...HOME, show: 'a-sign-of-affection' })).toBe(
      '/?show=a-sign-of-affection',
    );
  });

  it('reads a series back out of an address', () => {
    expect(readLocation('http://valence.local/?show=a-sign-of-affection').show).toBe(
      'a-sign-of-affection',
    );
  });

  it('writes an open item as a query, so closing it returns where it opened from', () => {
    expect(writeLocation({ ...HOME, section: 'search', inspecting: 'abc' })).toBe(
      '/search?item=abc',
    );
  });

  it('gives watching the path, since it is the thing worth sending somebody', () => {
    expect(writeLocation({ ...HOME, playing: 'abc' })).toBe('/watch/abc');
  });

  it('keeps no second beside what is playing, so there is one answer and not two', () => {
    expect(writeLocation({ ...HOME, playing: 'abc' })).toBe('/watch/abc');
  });

  it('names the library being browsed, so one can be linked to', () => {
    expect(writeLocation({ ...HOME, library: 'films-id' })).toBe('/?library=films-id');
  });

  it('reads a library back out of an address', () => {
    expect(readLocation('http://valence.local/?library=films-id').library).toBe('films-id');
  });

  it('leaves the library out when none has been chosen', () => {
    expect(writeLocation(HOME)).toBe('/');
  });

  it('writes what it can read back', () => {
    const place = {
      section: 'search',
      search: 'blade',
      inspecting: 'abc',
      show: null,
      person: null,
      shareToken: null,
      playing: null,
      party: null,
      genre: null,
      library: null,
      adminJob: null,
      account: null,
      admin: null,
    } as const;

    expect(readLocation(`http://valence.local${writeLocation(place)}`)).toEqual(place);
  });

  it('writes which admin panel is open', () => {
    expect(writeLocation({ ...HOME, section: 'films', admin: 'work' })).toBe('/films?admin=work');
  });

  it('opens over whichever section it was opened from', () => {
    expect(writeLocation({ ...HOME, section: 'home', admin: 'work' })).toBe('/?admin=work');
  });

  it('still answers the address it used to be a page at, so held links keep working', () => {
    const place = placeIn('/admin', {});

    expect(place.section).toBe('home');
    expect(place.admin).toBe('overview');
  });

  it('writes which job schedule page is open', () => {
    expect(writeLocation({ ...HOME, admin: 'jobs', adminJob: 'library.scan' })).toBe(
      '/?admin=jobs&job=library.scan',
    );
  });

  it('leaves the job out while the server dialog is shut, since it belongs to it', () => {
    expect(writeLocation({ ...HOME, adminJob: 'library.scan' })).toBe('/');
  });
});

describe('a genre kept in the address', () => {
  it('writes the genre a search is narrowed to', () => {
    expect(writeLocation({ ...HOME, section: 'search', genre: 'Science fiction' })).toBe(
      '/search?genre=Science+fiction',
    );
  });

  it('reads it back', () => {
    expect(readLocation('http://valence.local/search?genre=Horror').genre).toBe('Horror');
  });

  it('has no genre when the address names none', () => {
    expect(readLocation('http://valence.local/search').genre).toBeNull();
  });
});

describe('a person in the address', () => {
  it('reads somebody named in the address', () => {
    expect(readLocation('https://valence.local/films?person=1245').person).toBe(1245);
  });

  it('names nobody when the address names nobody', () => {
    expect(readLocation('https://valence.local/films').person).toBeNull();
  });

  it('names nobody for an identifier that is not one', () => {
    expect(readLocation('https://valence.local/films?person=amy').person).toBeNull();
    expect(readLocation('https://valence.local/films?person=0').person).toBeNull();
    expect(readLocation('https://valence.local/films?person=-3').person).toBeNull();
    expect(readLocation('https://valence.local/films?person=1.5').person).toBeNull();
  });

  it('writes somebody back into the address, so a person can be linked to', () => {
    expect(writeLocation({ ...HOME, section: 'films', person: 1245 })).toBe('/films?person=1245');
  });

  it('leaves the address alone when nobody is open', () => {
    expect(writeLocation({ ...HOME, section: 'films' })).toBe('/films');
  });

  it('carries a person alongside the item they were opened from', () => {
    const written = writeLocation({
      ...HOME,
      section: 'films',
      inspecting: 'abc',
      person: 1245,
    });

    expect(written).toContain('item=abc');
    expect(written).toContain('person=1245');
  });
});

describe('a shared link in the address', () => {
  it('reads the token a link carries', () => {
    expect(readLocation('https://valence.local/share/abc123').shareToken).toBe('abc123');
  });

  it('reads a token that had to be escaped', () => {
    expect(readLocation('https://valence.local/share/a%2Fb').shareToken).toBe('a/b');
  });

  it('carries no token anywhere else', () => {
    expect(readLocation('https://valence.local/films').shareToken).toBeNull();
    expect(readLocation('https://valence.local/share').shareToken).toBeNull();
  });

  it('writes a link back, so it can be copied and sent', () => {
    expect(writeLocation({ ...HOME, shareToken: 'abc123' })).toBe('/share/abc123');
  });

  it('shows nothing else while a link is open, whatever else the place holds', () => {
    const written = writeLocation({
      ...HOME,
      section: 'films',
      inspecting: 'abc',
      shareToken: 'abc123',
    });

    expect(written).toBe('/share/abc123');
  });
});

describe('a watch party in the address', () => {
  it('reads the party out of a link somebody was sent', () => {
    expect(readLocation('http://valence.local/watch/a-film?party=party-1').party).toBe('party-1');
  });

  it('still reads what is being watched from that link', () => {
    expect(readLocation('http://valence.local/watch/a-film?party=party-1').playing).toBe('a-film');
  });

  it('is in no party for an ordinary watch address', () => {
    expect(readLocation('http://valence.local/watch/a-film').party).toBeNull();
  });

  it('writes an address worth sending somebody', () => {
    expect(writeLocation({ ...HOME, playing: 'a-film', party: 'party-1' })).toBe(
      '/watch/a-film?party=party-1',
    );
  });

  it('leaves the address alone when there is no party', () => {
    expect(writeLocation({ ...HOME, playing: 'a-film' })).toBe('/watch/a-film');
  });

  it('survives a round trip, so a link that was sent arrives where it was made', () => {
    const address = writeLocation({ ...HOME, playing: 'a-film', party: 'party-1' });
    const back = readLocation(`http://valence.local${address}`);

    expect(back.playing).toBe('a-film');
    expect(back.party).toBe('party-1');
  });
});

describe('the account, which is a dialog rather than a section', () => {
  it('opens over whichever section it was opened from', () => {
    expect(writeLocation({ ...HOME, section: 'films', account: 'security' })).toBe(
      '/films?account=security',
    );
  });

  it('is shut when nothing in the address says otherwise', () => {
    expect(placeIn('/films', {}).account).toBeNull();
  });

  it('still answers the address it used to be a page at, so held links keep working', () => {
    const place = placeIn('/account', {});

    expect(place.section).toBe('home');
    expect(place.account).toBe('profile');
  });

  it('lets that old address name a panel, rather than always landing on the first', () => {
    expect(placeIn('/account', { account: 'devices' }).account).toBe('devices');
  });
});
