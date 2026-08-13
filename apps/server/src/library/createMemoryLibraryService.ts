import { randomUUID } from 'node:crypto';
import { groupIntoShows, buildShowDetail } from './groupIntoShows';
import type { Library, MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';
import type { LibraryService } from './LibraryService';

/**
 * What a browser is told about an item, from everything held about it.
 *
 * Written once and used by both the listing and the grouping into shows, so a
 * show cannot come to different conclusions about an episode than a rail does.
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
  rating: item.metadata.rating ?? null,
  seriesTitle: item.metadata.seriesTitle ?? null,
  seasonNumber: item.metadata.seasonNumber ?? null,
  episodeNumber: item.metadata.episodeNumber ?? null,
  genres: item.metadata.genres ?? null,
});

type MemoryState = {
  libraries: Library[];
  media: MediaDetail[];
};

/**
 * A library held in memory.
 *
 * Lets the HTTP surface be tested without Postgres, in the same way the memory
 * auth adapter does. The behaviour it models — searching, paging, missing
 * identifiers — is the behaviour the routes depend on.
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

  listItems: (libraryId, options) => {
    if (!state.libraries.some((entry) => entry.id === libraryId)) {
      return Promise.resolve(null);
    }

    const search = options.search?.toLowerCase() ?? '';

    const matching = state.media
      .filter((item) => item.libraryId === libraryId)
      .filter((item) => search === '' || item.title.toLowerCase().includes(search))
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
      .filter((item) => options.ids === undefined || options.ids.includes(item.id))
      .sort((left, right) =>
        options.order === 'newest'
          ? right.addedAt.localeCompare(left.addedAt)
          : left.title.localeCompare(right.title),
      );

    const items = matching.slice(options.offset, options.offset + options.limit).map(toSummary);

    return Promise.resolve({ items, total: matching.length });
  },

  getMedia: (id) => Promise.resolve(state.media.find((item) => item.id === id) ?? null),

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
