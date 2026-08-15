import type { LibraryFacets } from '@FluxContracts/schemas/Library';
import type { FilterOption } from './components/FilterChips/FilterChips.types';

const RATING_FLOORS = [6, 7, 8, 9];

/**
 * Everything the filter rows offer, from what the libraries actually hold.
 */
const buildFilterOptions = (
  facets: LibraryFacets,
): {
  genres: FilterOption[];
  decades: FilterOption[];
  ratings: FilterOption[];
} => ({
  genres: facets.genres.map((genre) => ({ value: genre, label: genre })),
  decades: facets.decades.map((decade) => ({
    value: decade.toString(),
    label: `${decade.toString()}s`,
  })),
  ratings: RATING_FLOORS.filter((floor) => facets.maxRating >= floor).map((floor) => ({
    value: floor.toString(),
    label: `${floor.toString()}+`,
  })),
});

export { buildFilterOptions };
