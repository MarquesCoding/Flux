import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { and, asc, eq, ilike, sql } from 'drizzle-orm'
import SchemaModule from '@FluxServer/db/Schema'
import LibraryContract from '@FluxContracts/schemas/Library'
import createMediaStoreModule from './createMediaStore'
import scanLibraryModule from './scanLibrary'
import PlaybackServiceModule from '@FluxServer/playback/PlaybackService'
import type { FluxDatabase } from '@FluxServer/db/Database'
import type { Library, MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library'
import type { MediaFileSystem } from './scanLibrary'
import type { MetadataProvider } from './MetadataProvider'
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient'
import type { LibraryService } from './LibraryService'
import type { JobQueue } from '@FluxServer/jobs/JobQueue'

const { library, mediaItem } = SchemaModule
const { createMediaStore } = createMediaStoreModule
const { scanLibrary } = scanLibraryModule
const { TRICKPLAY_INTERVAL_SECONDS, TRICKPLAY_TILE_WIDTH, TRICKPLAY_COLUMNS, TRICKPLAY_ROWS } =
  PlaybackServiceModule
const { MediaDetailSchema } = LibraryContract

type CreateDatabaseLibraryServiceOptions = {
  db: FluxDatabase
  files: MediaFileSystem
  transcoder: Transcoder
  jobs: JobQueue
  /**
   * Asked in order for each file's metadata, first answer winning.
   *
   * Left out entirely means the filename reader alone, which is what an
   * instance with no catalogue configured runs on.
   */
  providers?: MetadataProvider[]
  onProblem?: (path: string, reason: string) => void
}

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null

/**
 * The library backed by Postgres.
 *
 * Item detail is validated on the way out with the shared contract schema, so
 * a row written by an older version that no longer matches the contract fails
 * here rather than reaching a client as a half-populated object.
 */
/**
 * The library backed by Postgres, plus the worker body the queue calls.
 */
const createDatabaseLibraryService = ({
  db,
  files,
  transcoder,
  jobs,
  providers,
  onProblem,
}: CreateDatabaseLibraryServiceOptions): LibraryService & {
  runScan: (libraryId: string, force?: boolean) => Promise<void>
} => {
  const store = createMediaStore(db)

  const findLibrary = async (id: string) => {
    const rows = await db.select().from(library).where(eq(library.id, id)).limit(1)

    return rows[0] ?? null
  }

  return {
    list: async () => {
      const rows = await db
        .select({
          id: library.id,
          name: library.name,
          kind: library.kind,
          path: library.path,
          lastScannedAt: library.lastScannedAt,
          itemCount: sql<number>`count(${mediaItem.id})::int`,
        })
        .from(library)
        .leftJoin(mediaItem, eq(mediaItem.libraryId, library.id))
        .groupBy(library.id)
        .orderBy(asc(library.name))

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: LibraryContract.LibraryKindSchema.parse(row.kind),
        path: row.path,
        itemCount: row.itemCount,
        lastScannedAt: toIso(row.lastScannedAt),
      })) satisfies Library[]
    },

    create: async (input) => {
      const details = await stat(input.path).catch(() => null)

      if (details === null || !details.isDirectory()) {
        return null
      }

      const created = {
        id: randomUUID(),
        name: input.name,
        kind: input.kind,
        path: input.path,
      }

      await db.insert(library).values(created)

      return { ...created, itemCount: 0, lastScannedAt: null }
    },

    listItems: async (libraryId, options) => {
      if ((await findLibrary(libraryId)) === null) {
        return null
      }

      const filters =
        options.search === undefined || options.search.trim() === ''
          ? eq(mediaItem.libraryId, libraryId)
          : and(eq(mediaItem.libraryId, libraryId), ilike(mediaItem.title, `%${options.search}%`))

      const [totals] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(mediaItem)
        .where(filters)

      const rows = await db
        .select({
          id: mediaItem.id,
          libraryId: mediaItem.libraryId,
          title: mediaItem.title,
          year: mediaItem.year,
          durationSeconds: mediaItem.durationSeconds,
          width: mediaItem.width,
          height: mediaItem.height,
          videoCodec: mediaItem.videoCodec,
          videoRange: mediaItem.videoRange,
          addedAt: mediaItem.addedAt,
          posterUrl: mediaItem.posterUrl,
          backdropUrl: mediaItem.backdropUrl,
          accentColor: mediaItem.accentColor,
          seriesTitle: mediaItem.seriesTitle,
          seasonNumber: mediaItem.seasonNumber,
          episodeNumber: mediaItem.episodeNumber,
          rating: mediaItem.rating,
        })
        .from(mediaItem)
        .where(filters)
        .orderBy(asc(mediaItem.title))
        .limit(options.limit)
        .offset(options.offset)

      const items = rows.map(({ posterUrl, backdropUrl, ...row }) => ({
        ...row,
        addedAt: row.addedAt.toISOString(),
        hasPoster: posterUrl !== null,
        hasBackdrop: backdropUrl !== null,
      })) satisfies MediaSummary[]

      return { items, total: totals?.total ?? 0 }
    },

    getMedia: async (id) => {
      const rows = await db.select().from(mediaItem).where(eq(mediaItem.id, id)).limit(1)
      const row = rows[0]

      if (row === undefined) {
        return null
      }

      const detail: MediaDetail = MediaDetailSchema.parse({
        id: row.id,
        libraryId: row.libraryId,
        title: row.title,
        year: row.year,
        container: row.container,
        durationSeconds: row.durationSeconds,
        videoCodec: row.videoCodec,
        videoRange: row.videoRange,
        width: row.width,
        height: row.height,
        bitrateKbps: row.bitrateKbps ?? 1,
        audioStreams: row.audioStreams,
        subtitleStreams: row.subtitleStreams,
        addedAt: row.addedAt.toISOString(),
        metadata: {
          overview: row.overview,
          tagline: row.tagline,
          genres: row.genres,
          cast: row.castMembers,
          rating: row.rating,
          hasPoster: row.posterUrl !== null,
          hasBackdrop: row.backdropUrl !== null,
          accentColor: row.accentColor,
          seriesTitle: row.seriesTitle,
          seasonNumber: row.seasonNumber,
          episodeNumber: row.episodeNumber,
        },
      })

      return detail
    },

    readArtworkUrl: async (mediaId, kind) => {
      const rows = await db
        .select({ poster: mediaItem.posterUrl, backdrop: mediaItem.backdropUrl })
        .from(mediaItem)
        .where(eq(mediaItem.id, mediaId))
        .limit(1)

      const row = rows[0]

      if (row === undefined) {
        return null
      }

      return (kind === 'poster' ? row.poster : row.backdrop) ?? null
    },

    scan: async (libraryId, force = false) => {
      if ((await findLibrary(libraryId)) === null) {
        return null
      }

      const jobId = await jobs.enqueueScan(libraryId, force)

      // pg-boss returns null when a singleton job for this library is already
      // queued. Reporting that as a failure would be wrong: the scan the
      // caller asked for is going to happen.
      return { jobId: jobId ?? `pending-${libraryId}`, state: 'queued' }
    },

    readScanState: (jobId) => jobs.readState(jobId),

    runScan: async (libraryId, force = false) => {
      const found = await findLibrary(libraryId)

      if (found === null) {
        return
      }

      await scanLibrary({
        libraryId,
        root: found.path,
        files,
        store,
        transcoder,
        force,
        trickplay: {
          intervalSeconds: TRICKPLAY_INTERVAL_SECONDS,
          tileWidth: TRICKPLAY_TILE_WIDTH,
          columns: TRICKPLAY_COLUMNS,
          rows: TRICKPLAY_ROWS,
        },
        ...(providers === undefined ? {} : { providers }),
        ...(onProblem === undefined ? {} : { onProblem }),
      })
    },
  }
}

export default { createDatabaseLibraryService }
