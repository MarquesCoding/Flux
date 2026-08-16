import type { LibraryFacets } from '@FluxContracts/schemas/Library';
import type { FilterOption } from './components/FilterChips/FilterChips.types';

const RATING_FLOORS = [6, 7, 8, 9];

/**
 * Builds everything the filter rows offer from what the libraries actually hold, so a chip whose only
 * possible outcome is an empty page is never drawn. Kept apart from the page that draws them, so the
 * wording of a chip — and the decision not to offer one — can be read and tested without rendering a
 * search page.
 *
 * @param facets - What the server says there is to filter by.
 * @returns The chips for each row.
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
