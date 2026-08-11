import { randomUUID } from 'node:crypto'
import type { Library, MediaDetail } from '@FluxContracts/schemas/Library'
import type { LibraryService } from './LibraryService'

type MemoryState = {
  libraries: Library[]
  media: MediaDetail[]
}

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
    }

    state.libraries.push(created)

    return Promise.resolve(created)
  },

  listItems: (libraryId, options) => {
    if (!state.libraries.some((entry) => entry.id === libraryId)) {
      return Promise.resolve(null)
    }

    const search = options.search?.toLowerCase() ?? ''

    const matching = state.media
      .filter((item) => item.libraryId === libraryId)
      .filter((item) => search === '' || item.title.toLowerCase().includes(search))
      // A programme belongs to a series and a film does not, which is the only
      // difference a library can see.
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

    const items = matching.slice(options.offset, options.offset + options.limit).map((item) => ({
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
      seriesTitle: item.metadata.seriesTitle ?? null,
      seasonNumber: item.metadata.seasonNumber ?? null,
      episodeNumber: item.metadata.episodeNumber ?? null,
      genres: item.metadata.genres ?? null,
    }))

    return Promise.resolve({ items, total: matching.length })
  },

  getMedia: (id) => Promise.resolve(state.media.find((item) => item.id === id) ?? null),

  scan: (libraryId, force = false) =>
    Promise.resolve(
      state.libraries.some((entry) => entry.id === libraryId)
        ? { jobId: `job-${libraryId}${force ? '-force' : ''}`, state: 'queued' }
        : null,
    ),

  reset: (libraryId) => {
    if (!state.libraries.some((entry) => entry.id === libraryId)) {
      return Promise.resolve(null)
    }

    state.media = state.media.filter((item) => item.libraryId !== libraryId)

    return Promise.resolve({ jobId: `reset-${libraryId}`, state: 'queued' })
  },

  readScanState: () =>
    Promise.resolve({ state: 'completed', phase: null, processed: null, total: null }),

  readArtworkUrl: (mediaId, kind) =>
    Promise.resolve(
      state.media.some((item) => item.id === mediaId)
        ? `https://images.test/${kind}/${mediaId}.jpg`
        : null,
    ),
})

export type { MemoryState }

export default { createMemoryLibraryService }
