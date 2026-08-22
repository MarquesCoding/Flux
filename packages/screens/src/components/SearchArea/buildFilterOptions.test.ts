import { describe, expect, it } from 'vitest';
import { buildFilterOptions } from './buildFilterOptions';
import type { LibraryFacets } from '@ValenceContracts/schemas/Library';

const facets = (overrides: Partial<LibraryFacets> = {}): LibraryFacets => ({
  genres: [],
  decades: [],
  maxRating: 0,
  ...overrides,
});

describe('buildFilterOptions', () => {
  it('offers the genres as they are filed', () => {
    expect(buildFilterOptions(facets({ genres: ['Drama'] })).genres).toStrictEqual([
      { value: 'Drama', label: 'Drama' },
    ]);
  });

  it('writes a decade the way somebody says it', () => {
    expect(buildFilterOptions(facets({ decades: [1990] })).decades).toStrictEqual([
      { value: '1990', label: '1990s' },
    ]);
  });

  it('offers no rating floor at all where nothing has been rated', () => {
    expect(buildFilterOptions(facets()).ratings).toStrictEqual([]);
  });

  it('offers only the floors something can actually clear', () => {
    expect(
      buildFilterOptions(facets({ maxRating: 7.4 })).ratings.map((one) => one.label),
    ).toStrictEqual(['6+', '7+']);
  });
});
