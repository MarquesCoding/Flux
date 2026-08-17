import { beforeEach, describe, expect, it } from 'vitest';
import { buildRouter } from './buildRouter';
import { readSearch } from '@FluxWeb/navigation/readSearch';
import type { PlaceSearch } from '@FluxWeb/navigation/readSearch';

const nothing = () => null;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

const at = (address: string): { routeId: string; search: PlaceSearch }[] => {
  window.history.replaceState(null, '', address);

  const router = buildRouter(nothing);
  const [, query = ''] = router.latestLocation.href.split('?');
  const search = readSearch(Object.fromEntries(new URLSearchParams(query)));

  return router
    .matchRoutes(router.latestLocation)
    .map((match) => ({ routeId: String(match.routeId), search }));
};

const matched = (address: string): string => at(address).at(-1)?.routeId ?? '';

describe('buildRouter', () => {
  it('serves the addresses Flux hands out', () => {
    expect(matched('/')).toBe('/');
    expect(matched('/watch/arrival')).toBe('/watch/$mediaId');
    expect(matched('/share/a-token')).toBe('/share/$token');
    expect(matched('/media/arrival')).toBe('/media/$mediaId');
  });

  it('serves a section, which is not a route of its own', () => {
    expect(matched('/films')).toBe('/$');
  });

  it('lands somewhere rather than nowhere for an address nobody meant', () => {
    expect(matched('/nonsense/and/more')).toBe('/$');
  });

  it('reads what an address carries through the one schema that decides what it means', () => {
    expect(at('/films?q=blade&person=7').at(-1)?.search).toMatchObject({ q: 'blade', person: 7 });
  });

  it("holds the history the browser already had, so the back button is the browser's", () => {
    expect(buildRouter(nothing).history.location.pathname).toBe('/');
  });
});
