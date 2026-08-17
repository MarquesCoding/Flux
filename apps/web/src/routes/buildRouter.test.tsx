import { beforeEach, describe, expect, it } from 'vitest';
import { buildRouter } from './buildRouter';
import { readSearch } from '@FluxWeb/navigation/readSearch';
import type { PlaceSearch } from '@FluxWeb/navigation/readSearch';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

const at = (address: string): { routeId: string; search: PlaceSearch }[] => {
  window.history.replaceState(null, '', address);

  const router = buildRouter();
  const [, query = ''] = router.latestLocation.href.split('?');
  const search = readSearch(Object.fromEntries(new URLSearchParams(query)));

  return router
    .matchRoutes(router.latestLocation)
    .map((match) => ({ routeId: String(match.routeId), search }));
};

const matched = (address: string): string => at(address).at(-1)?.routeId ?? '';

const through = (address: string): string[] => at(address).map((match) => match.routeId);

describe('buildRouter', () => {
  it('gives every section a route of its own', () => {
    expect(matched('/')).toBe('/signed-in/shell/');
    expect(matched('/films')).toBe('/signed-in/shell/films');
    expect(matched('/shows')).toBe('/signed-in/shell/shows');
    expect(matched('/new')).toBe('/signed-in/shell/new');
    expect(matched('/favourites')).toBe('/signed-in/shell/favourites');
    expect(matched('/search')).toBe('/signed-in/shell/search');
    expect(matched('/account')).toBe('/signed-in/shell/account');
    expect(matched('/admin')).toBe('/signed-in/shell/admin');
  });

  it('draws the player and a share link outside the chrome the sections sit in', () => {
    expect(matched('/watch/arrival')).toBe('/signed-in/watch/$mediaId');
    expect(matched('/share/a-token')).toBe('/share/$token');
  });

  it('puts the sections behind the way in, and a share link in front of it', () => {
    expect(through('/films')).toContain('/signed-in');
    expect(through('/watch/arrival')).toContain('/signed-in');
    expect(through('/share/a-token')).not.toContain('/signed-in');
  });

  it('keeps the chrome around the sections and away from the player', () => {
    expect(through('/films')).toContain('/signed-in/shell');
    expect(through('/watch/arrival')).not.toContain('/signed-in/shell');
  });

  it('lands somewhere rather than nowhere for an address nobody meant', () => {
    expect(matched('/nonsense/and/more')).toBe('/signed-in/shell/$');
  });

  it('reads what an address carries through the one schema that decides what it means', () => {
    expect(at('/films?q=blade&person=7').at(-1)?.search).toMatchObject({ q: 'blade', person: 7 });
  });

  it('holds the history the browser already had, so the back button is the browsers', () => {
    expect(buildRouter().history.location.pathname).toBe('/');
  });
});
