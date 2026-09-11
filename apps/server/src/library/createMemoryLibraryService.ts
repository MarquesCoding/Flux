import { randomUUID } from 'node:crypto';
import { groupIntoShows, buildShowDetail } from './groupIntoShows';
import type { Library, MediaDetail, MediaSummary } from '@ValenceContracts/schemas/Library';
import type { LibraryService, ListItemsOptions } from './LibraryService';
import type { Person } from '@ValenceContracts/schemas/Person';

/**
 * Cuts everything held about an item down to what a browser needs to draw it. Written once and used
 * by both the listing and the grouping into shows, so a programme cannot come to different
 * conclusions about an episode than a rail does.
 *
 * @param item - Everything known about the item.
 * @returns The summary a page is sent.
 */
const toSummary = (item: MediaDetail): MediaSummary => ({
  id: item.id,
  libraryId: item.libraryId,
  title: item.title,
  year: item.year ?? null,
  durationSeconds: item.durationSeconds,
  width: item.width,
  height: item.height,
  videoCodec: item.videoCodec,
  videoRange: item.videoRange,
  addedAt: item.addedAt,
  hasPoster: item.metadata.hasPoster,
  hasBackdrop: item.metadata.hasBackdrop,
  hasLogo: false,
  seriesId: null,
  parentId: item.parentId ?? null,
  extraKind: item.extraKind ?? null,
  versionLabel: item.versionLabel ?? null,
  rating: item.metadata.rating ?? null,
  seriesTitle: item.metadata.seriesTitle ?? null,
  seasonNumber: item.metadata.seasonNumber ?? null,
  episodeNumber: item.metadata.episodeNumber ?? null,
  genres: item.metadata.genres ?? null,
});

type MemoryState = {
  libraries: Library[];
  media: MediaDetail[];
  series?: { id: string; title: string }[];
  starsFor?: (mediaId: string) => number | null;
  people?: Record<number, Person>;
};

/**
 * Matches a typed search against an item, in step with what the database version searches: title,
 * series title, description, tagline and cast. A memory service that searched differently would let
 * every test of the HTTP surface pass while describing behaviour the real server does not have.
 *
 * @param item - The item being tested.
 * @param search - What was typed, lowered.
 * @returns Whether the item matches.
 */
const matchesSearch = (item: MediaDetail, search: string): boolean =>
  [
    item.title,
    item.metadata.seriesTitle ?? '',
    item.metadata.overview ?? '',
    item.metadata.tagline ?? '',
    ...(item.metadata.cast ?? []).map((member) => member.name),
  ].some((against) => against.toLowerCase().includes(search));

/**
 * Decides whether an item survives the narrowing filters, in step with the database version for the
 * same reason the search is. An item with no year or no rating fails a filter asking about one
 * rather than passing it: asking for at least seven is not asking to also be shown everything
 * nobody has scored.
 *
 * @param item - The item being tested.
 * @param options - The filters asked for.
 * @returns Whether the item survives them all.
 */
const matchesFilters = (item: MediaDetail, options: ListItemsOptions): boolean => {
  const year = item.year ?? null;
  const rating = item.metadata.rating ?? null;

  return (
    (options.yearFrom === undefined || (year !== null && year >= options.yearFrom)) &&
    (options.yearTo === undefined || (year !== null && year <= options.yearTo)) &&
    (options.minRating === undefined || (rating !== null && rating >= options.minRating))
  );
};

/**
 * A library held in memory, so the HTTP surface can be exercised without Postgres. Models the
 * behaviour the routes depend on — searching, filtering, paging, missing identifiers — in step with
 * the database version, since a test passing against different behaviour describes a server that
 * does not exist.
 *
 * @param state - Any libraries and items to start with.
 * @returns The library service, and the state behind it.
 */
const createMemoryLibraryService = (
  state: MemoryState = { libraries: [], media: [] },
): LibraryService & { state: MemoryState } => ({
  state,

  list: () =>
    Promise.resolve(
      state.libraries.map((entry) => ({
        ...entry,
        itemCount: state.media.filter((item) => item.libraryId === entry.id).length,
      })),
    ),

  create: (input) => {
    const created: Library = {
      id: randomUUID(),
      name: input.name,
      kind: input.kind,
      path: input.path,
      itemCount: 0,
      lastScannedAt: null,
      defaultAudioLanguage: null,
      filesAtOnce: null,
    };

    state.libraries.push(created);

    return Promise.resolve(created);
  },

  update: (libraryId, input) => {
    const found = state.libraries.find((entry) => entry.id === libraryId);

    if (found === undefined) {
      return Promise.resolve(null);
    }

    found.defaultAudioLanguage = input.defaultAudioLanguage;

    if (input.filesAtOnce !== undefined) {
      found.filesAtOnce = input.filesAtOnce;
    }

    return Promise.resolve(found);
  },

  listFacets: () =>
    Promise.resolve({
      genres: [...new Set(state.media.flatMap((item) => item.metadata.genres ?? []))].sort(
        (one, other) => one.localeCompare(other),
      ),
      decades: [
        ...new Set(
          state.media
            .map((item) => item.year ?? null)
            .filter((year) => year !== null)
            .map((year) => Math.floor(year / 10) * 10),
        ),
      ].sort((one, other) => other - one),
      maxRating: state.media.reduce((best, item) => Math.max(best, item.metadata.rating ?? 0), 0),
    }),

  listItems: (libraryId, options) => {
    if (!state.libraries.some((entry) => entry.id === libraryId)) {
      return Promise.resolve(null);
    }

    const search = options.search?.toLowerCase() ?? '';

    const matching = state.media
      .filter((item) => item.libraryId === libraryId)
      .filter((item) => search === '' || matchesSearch(item, search))
      .filter(
        (item) =>
          options.kind === undefined ||
          (options.kind === 'shows'
            ? (item.metadata.seriesTitle ?? null) !== null
            : (item.metadata.seriesTitle ?? null) === null),
      )
      .filter(
        (item) =>
          options.genre === undefined || (item.metadata.genres ?? []).includes(options.genre),
      )
      .filter((item) => matchesFilters(item, options))
      .filter((item) =>
        options.ids === undefined
          ? (item.extraKind ?? null) === null
          : options.ids.includes(item.id),
      )
      .filter(
        (item) =>
          options.minYourStars === undefined ||
          (state.starsFor?.(item.id) ?? 0) >= options.minYourStars,
      )
      .sort((left, right) => {
        if (options.order === 'yourRating') {
          const given = (state.starsFor?.(right.id) ?? 0) - (state.starsFor?.(left.id) ?? 0);

          return given === 0 ? left.title.localeCompare(right.title) : given;
        }

        return options.order === 'newest'
          ? right.addedAt.localeCompare(left.addedAt)
          : left.title.localeCompare(right.title);
      });

    const items = matching.slice(options.offset, options.offset + options.limit).map(toSummary);

    return Promise.resolve({ items, total: matching.length });
  },

  getMedia: (id) => {
    const found = state.media.find((item) => item.id === id) ?? null;

    return Promise.resolve(
      found === null
        ? null
        : {
            ...found,
            extras: state.media
              .filter((item) => item.parentId === id && (item.extraKind ?? null) !== null)
              .map(toSummary),
            versions: state.media
              .filter((item) => item.parentId === id && (item.extraKind ?? null) === null)
              .map(toSummary),
          },
    );
  },

  getSeries: (seriesId) =>
    Promise.resolve((state.series ?? []).find((entry) => entry.id === seriesId) ?? null),

  seriesOf: (mediaId) => {
    const item = state.media.find((one) => one.id === mediaId);

    return Promise.resolve(item === undefined ? null : toSummary(item).seriesId);
  },

  itemsForShare: (scope) =>
    Promise.resolve(
      state.media
        .filter((item) =>
          scope.kind === 'item'
            ? scope.mediaId !== null && item.id === scope.mediaId
            : scope.seriesId !== null && toSummary(item).seriesId === scope.seriesId,
        )
        .map(toSummary),
    ),

  findByPerson: (personId) =>
    Promise.resolve(
      state.media
        .filter((item) => (item.metadata.cast ?? []).some((member) => member.personId === personId))
        .map(toSummary)
        .sort((left, right) => left.title.localeCompare(right.title)),
    ),

  readPerson: (personId) => Promise.resolve(state.people?.[personId] ?? null),

  listShows: (libraryId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? groupIntoShows(state.media.filter((item) => item.libraryId === libraryId).map(toSummary))
        : null,
    ),

  getShow: (libraryId, showId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? buildShowDetail(
            state.media.filter((item) => item.libraryId === libraryId).map(toSummary),
            showId,
          )
        : null,
    ),

  scan: (libraryId, force = false) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `job-${libraryId}${force ? '-force' : ''}`, state: 'queued' }
        : null,
    ),

  correctMatch: (mediaId) => {
    const item = state.media.find((one) => one.id === mediaId);

    if (item === undefined) {
      return Promise.resolve(null);
    }

    const family =
      item.metadata.seriesTitle === null || item.metadata.seriesTitle === undefined
        ? [item]
        : state.media.filter(
            (one) =>
              one.libraryId === item.libraryId &&
              one.metadata.seriesTitle === item.metadata.seriesTitle,
          );

    return Promise.resolve({ corrected: family.length, jobId: null });
  },

  forgetCorrection: (mediaId) =>
    Promise.resolve(
      state.media.some((one) => one.id === mediaId) ? { corrected: 1, jobId: null } : null,
    ),

  rebuildArtefacts: (mediaId) =>
    Promise.resolve(
      state.media.some((one) => one.id === mediaId) ? { preview: true, trickplay: true } : null,
    ),

  reset: (libraryId) => {
    if (!state.libraries.some((entry) => entry.id === libraryId)) {
      return Promise.resolve(null);
    }

    state.media = state.media.filter((item) => item.libraryId !== libraryId);

    return Promise.resolve({ jobId: `reset-${libraryId}`, state: 'queued' });
  },

  regeneratePreviews: (libraryId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `regenerate-previews-${libraryId}`, state: 'queued' }
        : null,
    ),

  remakePreviews: (libraryId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `regenerate-previews-${libraryId}`, state: 'queued' }
        : null,
    ),

  fetchLogos: (libraryId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `fetch-logos-${libraryId}`, state: 'queued' }
        : null,
    ),

  regenerateTrickplay: (libraryId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `regenerate-trickplay-${libraryId}`, state: 'queued' }
        : null,
    ),

  detectSegments: (libraryId) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `detect-segments-${libraryId}`, state: 'queued' }
        : null,
    ),

  readScanState: () =>
    Promise.resolve({ state: 'completed', phase: null, processed: null, total: null }),

  readArtworkUrl: (mediaId, kind) =>
    Promise.resolve(
      state.media.some((item) => item.id === mediaId)
        ? `https://images.test/${kind}/${mediaId}.jpg`
        : null,
    ),
});

export type { MemoryState };

export { createMemoryLibraryService };
