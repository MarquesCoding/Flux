import type { LibraryFacets } from '@FluxContracts/schemas/Library';
import type { FilterOption } from './components/FilterChips/FilterChips.types';

/**
 * The rating floors worth offering.
 *
 * Whole numbers out of ten, and only the top of the scale: nobody narrows a
 * library to "at least three".
 */
const RATING_FLOORS = [6, 7, 8, 9];

/**
 * Everything the filter rows offer, from what the libraries actually hold.
 *
 * Kept apart from the page that draws them so the wording of a chip — and the
 * decision not to offer one at all — is somewhere it can be read and tested
 * without rendering a search page.
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
