import { describe, expect, it } from 'vitest';
import { readLocation, writeLocation, HOME } from './readLocation';

const at = (path: string) => readLocation(`http://flux.local${path}`);

describe('readLocation', () => {
  it('reads the root as home', () => {
    expect(at('/')).toEqual(HOME);
  });

  it('reads a section from the path', () => {
    expect(at('/admin').section).toBe('admin');
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
    expect(at('/admin?panel=work').adminPanel).toBe('work');
  });

  it('has no admin panel when the address does not name one', () => {
    expect(at('/admin').adminPanel).toBeNull();
  });

  it('reads which job schedule page was open', () => {
    expect(at('/admin?panel=work&job=library.scan').adminJob).toBe('library.scan');
  });

  it('has no admin job when the address does not name one', () => {
    expect(at('/admin').adminJob).toBeNull();
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
    expect(readLocation('http://flux.local/?show=a-sign-of-affection').show).toBe(
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
    expect(readLocation('http://flux.local/?library=films-id').library).toBe('films-id');
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
      playing: null,
      genre: null,
      library: null,
      adminPanel: null,
      adminJob: null,
    } as const;

    expect(readLocation(`http://flux.local${writeLocation(place)}`)).toEqual(place);
  });

  it('writes which admin panel is open', () => {
    expect(writeLocation({ ...HOME, section: 'admin', adminPanel: 'work' })).toBe(
      '/admin?panel=work',
    );
  });

  it('leaves the panel out of any other section, since only admin has one', () => {
    expect(writeLocation({ ...HOME, section: 'home', adminPanel: 'work' })).toBe('/');
  });

  it('writes which job schedule page is open', () => {
    expect(writeLocation({ ...HOME, section: 'admin', adminJob: 'library.scan' })).toBe(
      '/admin?job=library.scan',
    );
  });

  it('leaves the job out of any other section', () => {
    expect(writeLocation({ ...HOME, section: 'home', adminJob: 'library.scan' })).toBe('/');
  });
});

describe('a genre kept in the address', () => {
  it('writes the genre a search is narrowed to', () => {
    expect(writeLocation({ ...HOME, section: 'search', genre: 'Science fiction' })).toBe(
      '/search?genre=Science+fiction',
    );
  });

  it('reads it back', () => {
    expect(readLocation('http://flux.local/search?genre=Horror').genre).toBe('Horror');
  });

  it('has no genre when the address names none', () => {
    expect(readLocation('http://flux.local/search').genre).toBeNull();
  });
});
