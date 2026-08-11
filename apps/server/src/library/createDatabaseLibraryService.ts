import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { library, mediaItem } from '@FluxServer/db/Schema';
import { LibraryKindSchema, MediaDetailSchema } from '@FluxContracts/schemas/Library';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import {
  createMediaStore,
  listOutstandingFor,
  markJobComplete,
  clearJobCompletions,
} from './createMediaStore';
import { scanLibrary } from './scanLibrary';
import { groupIntoShows, buildShowDetail } from './groupIntoShows';
import { resolveSeriesShape } from './MetadataProvider';
import { regeneratePreviews } from './regeneratePreviews';
import { generateTrickplay } from './generateTrickplay';
import {
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} from '@FluxServer/playback/PlaybackService';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { Library, MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';
import type { MediaFileSystem } from './scanLibrary';
import type { MetadataProvider, SeriesShape } from './MetadataProvider';
import type { ShowDetail } from '@FluxContracts/schemas/Show';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';
import type { LibraryService } from './LibraryService';
import {
  SCAN_LIBRARY_JOB,
  REGENERATE_PREVIEWS_JOB,
  REGENERATE_TRICKPLAY_JOB,
  DETECT_SEGMENTS_JOB,
} from '@FluxServer/jobs/JobQueue';
import type { JobQueue } from '@FluxServer/jobs/JobQueue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

const GenresSchema = z.array(z.string());
type CreateDatabaseLibraryServiceOptions = {
  db: FluxDatabase;
  files: MediaFileSystem;
  transcoder: Transcoder;
  jobs: JobQueue;
  /**
   * Asked in order for each file's metadata, first answer winning.
   *
   * Left out entirely means the filename reader alone, which is what an
   * instance with no catalogue configured runs on.
   */
  providers?: MetadataProvider[];
  onProblem?: (path: string, reason: string) => void;
};

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

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
/**
 * The genres a stored row carries.
 *
 * Read through a schema because the column is JSON: whatever a catalogue put
 * there years ago is not something to hand to a browser unchecked, and a row
 * that no longer parses is an item with no genres rather than a failed page.
 */
const readGenres = (stored: JsonValue): string[] | null => {
  const parsed = GenresSchema.safeParse(stored);

  return parsed.success ? parsed.data : null;
};

/**
 * The library as this file provides it: everything the application asks of a
 * library, and the work that only a real one can do.
 */
type DatabaseLibraryService = LibraryService & {
  runScan: (libraryId: string, force?: boolean, jobId?: string) => Promise<void>;
  runRegeneratePreviews: (
    libraryId: string,
    defaultAudioLanguage: string | null,
    jobId?: string,
  ) => Promise<void>;
  runRegenerateTrickplay: (libraryId: string, jobId?: string) => Promise<void>;
};

/**
 * How many episodes are read to build a series.
 *
 * A ceiling rather than a page: a show is only itself when all of it is there,
 * and no series anybody owns has this many episodes.
 */
const EVERY_EPISODE = 2000;

const createDatabaseLibraryService = ({
  db,
  files,
  transcoder,
  jobs,
  providers,
  onProblem,
}: CreateDatabaseLibraryServiceOptions): DatabaseLibraryService => {
  const store = createMediaStore(db);

  /**
   * What the catalogue says the series contains, or nothing when nobody can
   * say.
   *
   * Asked by the id a provider already gave one of the episodes, which is why
   * this needs no new column: every episode of a series was matched to the
   * same series in the catalogue, so any one of them can name it.
   *
   * Held for the life of the process. A series gains an episode a week at
   * most, and asking a catalogue again every time somebody opens a dialog is
   * a request per press for an answer that does not move.
   */
  const shapes = new Map<string, SeriesShape | null>();

  const shapeOf = async (detail: ShowDetail): Promise<SeriesShape | null> => {
    const [row] = await db
      .select({ externalId: mediaItem.externalId })
      .from(mediaItem)
      .where(eq(mediaItem.id, detail.coverMediaId))
      .limit(1);

    const externalId = row?.externalId ?? null;

    if (externalId === null || externalId === '') {
      return null;
    }

    const known = shapes.get(externalId);

    if (known !== undefined) {
      return known;
    }

    const found = await resolveSeriesShape(providers ?? [], externalId, (provider, reason) => {
      onProblem?.(provider, reason);
    });

    shapes.set(externalId, found);

    return found;
  };

  const findLibrary = async (id: string) => {
    const rows = await db.select().from(library).where(eq(library.id, id)).limit(1);

    return rows[0] ?? null;
  };

  const service: DatabaseLibraryService = {
    list: async () => {
      const rows = await db
        .select({
          id: library.id,
          name: library.name,
          kind: library.kind,
          path: library.path,
          lastScannedAt: library.lastScannedAt,
          defaultAudioLanguage: library.defaultAudioLanguage,
          itemCount: sql<number>`count(${mediaItem.id})::int`,
        })
        .from(library)
        .leftJoin(mediaItem, eq(mediaItem.libraryId, library.id))
        .groupBy(library.id)
        .orderBy(asc(library.name));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: LibraryKindSchema.parse(row.kind),
        path: row.path,
        itemCount: row.itemCount,
        lastScannedAt: toIso(row.lastScannedAt),
        defaultAudioLanguage: row.defaultAudioLanguage,
      })) satisfies Library[];
    },

    create: async (input) => {
      const details = await stat(input.path).catch(() => null);

      if (details === null || !details.isDirectory()) {
        return null;
      }

      const created = {
        id: randomUUID(),
        name: input.name,
        kind: input.kind,
        path: input.path,
      };

      await db.insert(library).values(created);

      return { ...created, itemCount: 0, lastScannedAt: null, defaultAudioLanguage: null };
    },

    update: async (libraryId, input) => {
      const before = await findLibrary(libraryId);

      if (before === null) {
        return null;
      }

      await db
        .update(library)
        .set({ defaultAudioLanguage: input.defaultAudioLanguage })
        .where(eq(library.id, libraryId));

      if (before.defaultAudioLanguage !== input.defaultAudioLanguage) {
        await clearJobCompletions(db, libraryId, REGENERATE_PREVIEWS_JOB);
      }

      const [row] = await db
        .select({
          id: library.id,
          name: library.name,
          kind: library.kind,
          path: library.path,
          lastScannedAt: library.lastScannedAt,
          defaultAudioLanguage: library.defaultAudioLanguage,
          itemCount: sql<number>`count(${mediaItem.id})::int`,
        })
        .from(library)
        .leftJoin(mediaItem, eq(mediaItem.libraryId, library.id))
        .where(eq(library.id, libraryId))
        .groupBy(library.id);

      if (row === undefined) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        kind: LibraryKindSchema.parse(row.kind),
        path: row.path,
        itemCount: row.itemCount,
        lastScannedAt: toIso(row.lastScannedAt),
        defaultAudioLanguage: row.defaultAudioLanguage,
      };
    },

    listItems: async (libraryId, options) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      const asked = [
        eq(mediaItem.libraryId, libraryId),
        ...(options.search === undefined || options.search.trim() === ''
          ? []
          : [ilike(mediaItem.title, `%${options.search}%`)]),
        ...(options.kind === undefined
          ? []
          : [
              options.kind === 'shows'
                ? isNotNull(mediaItem.seriesTitle)
                : isNull(mediaItem.seriesTitle),
            ]),
        ...(options.genre === undefined || options.genre === ''
          ? []
          : [sql`${mediaItem.genres} @> ${JSON.stringify([options.genre])}::jsonb`]),
        ...(options.ids === undefined
          ? []
          : options.ids.length === 0
            ? [sql`false`]
            : [inArray(mediaItem.id, options.ids)]),
      ];

      const filters = and(...asked);

      const [totals] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(mediaItem)
        .where(filters);

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
          seriesTitle: mediaItem.seriesTitle,
          seasonNumber: mediaItem.seasonNumber,
          episodeNumber: mediaItem.episodeNumber,
          rating: mediaItem.rating,
          genres: mediaItem.genres,
        })
        .from(mediaItem)
        .where(filters)
        .orderBy(options.order === 'newest' ? desc(mediaItem.addedAt) : asc(mediaItem.title))
        .limit(options.limit)
        .offset(options.offset);

      const items = rows.map(({ posterUrl, backdropUrl, genres, ...row }) => ({
        ...row,
        addedAt: row.addedAt.toISOString(),
        hasPoster: posterUrl !== null,
        hasBackdrop: backdropUrl !== null,
        genres: readGenres(JsonValueSchema.parse(genres ?? null)),
      })) satisfies MediaSummary[];

      return { items, total: totals?.total ?? 0 };
    },

    getMedia: async (id) => {
      const rows = await db.select().from(mediaItem).where(eq(mediaItem.id, id)).limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
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
          seriesTitle: row.seriesTitle,
          seasonNumber: row.seasonNumber,
          episodeNumber: row.episodeNumber,
        },
      });

      return detail;
    },

    readArtworkUrl: async (mediaId, kind) => {
      const rows = await db
        .select({ poster: mediaItem.posterUrl, backdrop: mediaItem.backdropUrl })
        .from(mediaItem)
        .where(eq(mediaItem.id, mediaId))
        .limit(1);

      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return (kind === 'poster' ? row.poster : row.backdrop) ?? null;
    },

    scan: async (libraryId, force = false) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      const jobId = await jobs.enqueue(SCAN_LIBRARY_JOB, { libraryId, force }, libraryId);

      return { jobId: jobId ?? `pending-${libraryId}`, state: 'queued' };
    },

    reset: async (libraryId) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      await store.clear(libraryId);

      const jobId = await jobs.enqueue(SCAN_LIBRARY_JOB, { libraryId, force: true }, libraryId);

      return { jobId: jobId ?? `pending-${libraryId}`, state: 'queued' };
    },

    regeneratePreviews: async (libraryId) => {
      const found = await findLibrary(libraryId);

      if (found === null) {
        return null;
      }

      const jobId = await jobs.enqueue(
        REGENERATE_PREVIEWS_JOB,
        { libraryId, defaultAudioLanguage: found.defaultAudioLanguage },
        libraryId,
      );

      return { jobId: jobId ?? `pending-${libraryId}`, state: 'queued' };
    },

    regenerateTrickplay: async (libraryId) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      const jobId = await jobs.enqueue(REGENERATE_TRICKPLAY_JOB, { libraryId }, libraryId);

      return { jobId: jobId ?? `pending-${libraryId}`, state: 'queued' };
    },

    detectSegments: async (libraryId) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      const jobId = await jobs.enqueue(DETECT_SEGMENTS_JOB, { libraryId }, libraryId);

      return { jobId: jobId ?? `pending-${libraryId}`, state: 'queued' };
    },

    readScanState: async (jobId) => {
      const state = await jobs.readState(jobId);
      const progress = jobs.readProgress(jobId);

      return {
        state,
        phase: progress?.phase ?? null,
        processed: progress?.processed ?? null,
        total: progress?.total ?? null,
      };
    },

    runScan: async (libraryId, force = false, jobId) => {
      const found = await findLibrary(libraryId);

      if (found === null) {
        return;
      }

      await scanLibrary({
        libraryId,
        root: found.path,
        files,
        store,
        transcoder,
        force,
        ...(providers === undefined ? {} : { providers }),
        ...(onProblem === undefined ? {} : { onProblem }),
        ...(jobId === undefined
          ? {}
          : {
              onProgress: (phase, processed, total) =>
                jobs.reportProgress(jobId, phase, processed, total),
            }),
      });
    },

    runRegeneratePreviews: async (libraryId, defaultAudioLanguage, jobId) => {
      await regeneratePreviews({
        libraryId,
        store: {
          listOutstanding: (id) => listOutstandingFor(db, id, REGENERATE_PREVIEWS_JOB),
          markComplete: (mediaItemId) => markJobComplete(db, mediaItemId, REGENERATE_PREVIEWS_JOB),
        },
        transcoder,
        defaultAudioLanguage,
        ...(onProblem === undefined ? {} : { onProblem }),
        ...(jobId === undefined
          ? {}
          : {
              onProgress: (processed, total) =>
                jobs.reportProgress(jobId, 'previews', processed, total),
            }),
      });
    },

    runRegenerateTrickplay: async (libraryId, jobId) => {
      await generateTrickplay({
        libraryId,
        store: {
          listOutstanding: (id) => listOutstandingFor(db, id, REGENERATE_TRICKPLAY_JOB),
          markComplete: (mediaItemId) => markJobComplete(db, mediaItemId, REGENERATE_TRICKPLAY_JOB),
        },
        transcoder,
        trickplay: {
          intervalSeconds: TRICKPLAY_INTERVAL_SECONDS,
          tileWidth: TRICKPLAY_TILE_WIDTH,
          columns: TRICKPLAY_COLUMNS,
          rows: TRICKPLAY_ROWS,
        },
        ...(onProblem === undefined ? {} : { onProblem }),
        ...(jobId === undefined
          ? {}
          : {
              onProgress: (processed, total) =>
                jobs.reportProgress(jobId, 'trickplay', processed, total),
            }),
      });
    },

    listShows: async (libraryId) => {
      const page = await service.listItems(libraryId, {
        kind: 'shows',
        limit: EVERY_EPISODE,
        offset: 0,
      });

      return page === null ? null : groupIntoShows(page.items);
    },

    getShow: async (libraryId, showId) => {
      const page = await service.listItems(libraryId, {
        kind: 'shows',
        limit: EVERY_EPISODE,
        offset: 0,
      });

      const detail = page === null ? null : buildShowDetail(page.items, showId);

      if (detail === null) {
        return null;
      }

      const shape = await shapeOf(detail);

      return shape === null ? detail : { ...detail, shape: shape.seasons };
    },
  };

  return service;
};

export { createDatabaseLibraryService };
