import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { library, mediaItem } from '@FluxServer/db/Schema';
import { LibraryKindSchema, MediaDetailSchema } from '@FluxContracts/schemas/Library';
import { AudioStreamSchema } from '@FluxContracts/schemas/MediaItem';
import { JsonValueSchema } from '@FluxContracts/schemas/JsonValue';
import {
  createMediaStore,
  listOutstandingFor,
  markJobComplete,
  clearJobCompletions,
} from './createMediaStore';
import { fetchLogos } from './fetchLogos';
import { scanLibrary } from './scanLibrary';
import { groupIntoShows, buildShowDetail } from './groupIntoShows';
import { resolveSeriesShape } from './MetadataProvider';
import { regeneratePreviews } from './regeneratePreviews';
import { generateTrickplay } from './generateTrickplay';
import { rebuildItemArtefacts } from './rebuildItemArtefacts';
import { toIso } from '@FluxCore/functions/toIso';
import {
  TRICKPLAY_INTERVAL_SECONDS,
  TRICKPLAY_TILE_WIDTH,
  TRICKPLAY_COLUMNS,
  TRICKPLAY_ROWS,
} from '@FluxServer/playback/PlaybackService';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type {
  Library,
  MediaDetail,
  MediaSummary,
  ScanResult,
} from '@FluxContracts/schemas/Library';
import type { MediaFileSystem, ScanPhase } from './scanLibrary';
import type { MetadataProvider, SeriesShape } from './MetadataProvider';
import type { ShowDetail } from '@FluxContracts/schemas/Show';
import type { Transcoder } from '@FluxServer/transcoder/TranscoderClient';
import type { LibraryService } from './LibraryService';
import {
  SCAN_LIBRARY_JOB,
  READ_AGAIN_JOB,
  REGENERATE_PREVIEWS_JOB,
  REGENERATE_TRICKPLAY_JOB,
  FETCH_LOGOS_JOB,
  DETECT_SEGMENTS_JOB,
} from '@FluxServer/jobs/JobQueue';
import type { JobQueue } from '@FluxServer/jobs/JobQueue';
import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

const GenresSchema = z.array(z.string());
type CreateDatabaseLibraryServiceOptions = {
  /**
   * How many files to have the media service working on at once.
   */
  atOnce?: number;
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

/**
 * What a typed search matches against.
 *
 * Three places rather than one, because somebody typing into a search box is
 * naming whatever they can remember about a thing, and the title is only
 * sometimes it. "Denzel" is a perfectly ordinary way to look for a film, and
 * a title-only search answers it with nothing while the server holds the cast
 * list that would have found it.
 *
 * The series title is in here for the same reason: searching "Ted" should
 * find the programme's episodes, which are each titled something else
 * entirely.
 *
 * Cast is matched by reading the stored array rather than by containment,
 * because somebody types a surname and containment wants the whole name
 * exactly. That costs a scan of the column — there is no index that serves a
 * substring — which is affordable at the size a household library reaches and
 * is the thing to revisit if this is ever pointed at twenty thousand items.
 */
const matchesSearch = (search: string) => {
  const like = `%${search.trim()}%`;

  return or(
    ilike(mediaItem.title, like),
    ilike(mediaItem.seriesTitle, like),
    sql`exists (
      select 1
      from jsonb_array_elements(coalesce(${mediaItem.castMembers}, '[]'::jsonb)) as member
      where member->>'name' ilike ${like}
    )`,
  );
};

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
  /**
   * Scans, and reports what it changed.
   *
   * Null where there is no such library, which is a different answer from a
   * scan that ran and changed nothing.
   */
  runScan: (libraryId: string, force?: boolean, jobId?: string) => Promise<ScanResult | null>;
  /**
   * Reads a few named files again, having been told what they are.
   */
  runReadAgain: (libraryId: string, paths: string[], jobId?: string) => Promise<void>;
  runRegeneratePreviews: (
    libraryId: string,
    defaultAudioLanguage: string | null,
    jobId?: string,
  ) => Promise<void>;
  runRegenerateTrickplay: (libraryId: string, jobId?: string) => Promise<void>;
  runFetchLogos: (libraryId: string, jobId?: string) => Promise<void>;
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
  atOnce = 1,
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

  /**
   * Every file a correction should reach.
   *
   * A film is itself. An episode is its whole series within that library,
   * because the id being corrected names a programme rather than an episode,
   * and half a corrected series is a worse state than an uncorrected one.
   */
  const pathsOfTheSameThing = async (
    mediaId: string,
  ): Promise<{ libraryId: string; paths: string[] } | null> => {
    const [row] = await db
      .select({
        libraryId: mediaItem.libraryId,
        path: mediaItem.path,
        seriesTitle: mediaItem.seriesTitle,
      })
      .from(mediaItem)
      .where(eq(mediaItem.id, mediaId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    if (row.seriesTitle === null || row.seriesTitle === '') {
      return { libraryId: row.libraryId, paths: [row.path] };
    }

    const siblings = await db
      .select({ path: mediaItem.path })
      .from(mediaItem)
      .where(
        and(eq(mediaItem.libraryId, row.libraryId), eq(mediaItem.seriesTitle, row.seriesTitle)),
      );

    return { libraryId: row.libraryId, paths: siblings.map((one) => one.path) };
  };

  /**
   * Reads a handful of files again, now that something about them has changed.
   *
   * A scan of the whole library would answer too, and would take as long as the
   * library is large. The point of a correction is watching the page become
   * right, so only what was corrected is read again.
   */
  const readAgain = async (
    libraryId: string,
    paths: string[],
    onProgress?: (phase: ScanPhase, processed: number, total: number) => void,
  ): Promise<void> => {
    const rows = await db
      .select({
        path: mediaItem.path,
        sizeBytes: mediaItem.sizeBytes,
        modifiedAtMs: mediaItem.modifiedAtMs,
      })
      .from(mediaItem)
      .where(and(eq(mediaItem.libraryId, libraryId), inArray(mediaItem.path, paths)));

    await scanLibrary({
      libraryId,
      root: '',
      files: { listFiles: () => Promise.resolve(rows) },
      store,
      transcoder,
      providers: providers ?? [],
      force: true,
      isPartial: true,
      ...(onProblem === undefined ? {} : { onProblem }),
      ...(onProgress === undefined ? {} : { onProgress }),
    });
  };

  /**
   * Hands the re-read to the queue, so it is watchable rather than a request
   * that hangs for as long as a series takes to fetch.
   *
   * Runs it here and now when the queue will not take it, which is how a
   * server started without background jobs still applies a correction — the
   * caller waits, but the correction lands either way.
   */
  const queueReadAgain = async (libraryId: string, paths: string[]): Promise<string | null> => {
    const jobId = await jobs.enqueue(READ_AGAIN_JOB, { libraryId, paths }, libraryId);

    if (jobId === null) {
      await readAgain(libraryId, paths);

      return null;
    }

    return jobId;
  };

  const findLibrary = async (id: string) => {
    const rows = await db.select().from(library).where(eq(library.id, id)).limit(1);

    return rows[0] ?? null;
  };

  /**
   * How many of a library's files to render at the same time.
   *
   * The library's own answer wins over the server's. A library on a local disk
   * wants as many at once as there are cores to feed; a library on a network
   * share wants one, because the files come down one wire and asking for four
   * divides that wire four ways.
   */
  const filesAtOnceFor = async (libraryId: string): Promise<number> =>
    (await findLibrary(libraryId))?.filesAtOnce ?? atOnce;

  /**
   * What the last scan changed, or null where none has run since Flux began
   * recording it.
   *
   * All four columns are written together, so one being absent means the
   * library was last scanned by a version that did not keep count rather than
   * that the scan did nothing.
   */
  const readLastScan = (row: {
    lastScanAdded: number | null;
    lastScanUpdated: number | null;
    lastScanRemoved: number | null;
    lastScanFailed: number | null;
  }): { lastScan: ScanResult } | Record<string, never> =>
    row.lastScanAdded === null ||
    row.lastScanUpdated === null ||
    row.lastScanRemoved === null ||
    row.lastScanFailed === null
      ? {}
      : {
          lastScan: {
            added: row.lastScanAdded,
            updated: row.lastScanUpdated,
            removed: row.lastScanRemoved,
            failed: row.lastScanFailed,
          },
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
          lastScanAdded: library.lastScanAdded,
          lastScanUpdated: library.lastScanUpdated,
          lastScanRemoved: library.lastScanRemoved,
          lastScanFailed: library.lastScanFailed,
          defaultAudioLanguage: library.defaultAudioLanguage,
          filesAtOnce: library.filesAtOnce,
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
        ...readLastScan(row),
        defaultAudioLanguage: row.defaultAudioLanguage,
        filesAtOnce: row.filesAtOnce,
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

      return {
        ...created,
        itemCount: 0,
        lastScannedAt: null,
        defaultAudioLanguage: null,
        filesAtOnce: null,
      };
    },

    update: async (libraryId, input) => {
      const before = await findLibrary(libraryId);

      if (before === null) {
        return null;
      }

      await db
        .update(library)
        .set({
          defaultAudioLanguage: input.defaultAudioLanguage,
          ...(input.filesAtOnce === undefined ? {} : { filesAtOnce: input.filesAtOnce }),
        })
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
          filesAtOnce: library.filesAtOnce,
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
        filesAtOnce: row.filesAtOnce,
      };
    },

    listGenres: async () => {
      const rows = await db
        .select({ genre: sql<string>`genre` })
        .from(
          sql`${mediaItem}, jsonb_array_elements_text(coalesce(${mediaItem.genres}, '[]'::jsonb)) as genre`,
        )
        .groupBy(sql`genre`)
        .orderBy(sql`genre asc`);

      return rows.map((row) => row.genre);
    },

    listItems: async (libraryId, options) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      const asked = [
        eq(mediaItem.libraryId, libraryId),
        ...(options.search === undefined || options.search.trim() === ''
          ? []
          : [matchesSearch(options.search)]),
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
          logoUrl: mediaItem.logoUrl,
          seriesId: mediaItem.seriesId,
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

      const items = rows.map(({ posterUrl, backdropUrl, logoUrl, genres, ...row }) => ({
        ...row,
        addedAt: row.addedAt.toISOString(),
        hasPoster: posterUrl !== null,
        hasBackdrop: backdropUrl !== null,
        hasLogo: logoUrl !== null,
        genres: readGenres(JsonValueSchema.parse(genres ?? null)),
      })) satisfies MediaSummary[];

      return { items, total: totals?.total ?? 0 };
    },

    correctMatch: async (mediaId, reference, by) => {
      const paths = await pathsOfTheSameThing(mediaId);

      if (paths === null) {
        return null;
      }

      for (const path of paths.paths) {
        await store.saveOverride({
          libraryId: paths.libraryId,
          path,
          externalId: reference.externalId,
          externalKind: reference.externalKind,
          updatedBy: by,
        });
      }

      const jobId = await queueReadAgain(paths.libraryId, paths.paths);

      return { corrected: paths.paths.length, jobId };
    },

    forgetCorrection: async (mediaId) => {
      const paths = await pathsOfTheSameThing(mediaId);

      if (paths === null) {
        return null;
      }

      await store.removeOverrides(paths.libraryId, paths.paths);

      const jobId = await queueReadAgain(paths.libraryId, paths.paths);

      return { corrected: paths.paths.length, jobId };
    },

    rebuildArtefacts: async (mediaId) => {
      const rows = await db
        .select({
          path: mediaItem.path,
          audioStreams: mediaItem.audioStreams,
          generation: library.generation,
          defaultAudioLanguage: library.defaultAudioLanguage,
        })
        .from(mediaItem)
        .innerJoin(library, eq(library.id, mediaItem.libraryId))
        .where(eq(mediaItem.id, mediaId))
        .limit(1);

      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return rebuildItemArtefacts({
        item: {
          path: row.path,
          audioStreams: z.array(AudioStreamSchema).parse(row.audioStreams),
          generation: row.generation,
          defaultAudioLanguage: row.defaultAudioLanguage,
        },
        trickplay: {
          intervalSeconds: TRICKPLAY_INTERVAL_SECONDS,
          tileWidth: TRICKPLAY_TILE_WIDTH,
          columns: TRICKPLAY_COLUMNS,
          rows: TRICKPLAY_ROWS,
        },
        transcoder,
        ...(onProblem === undefined ? {} : { onProblem }),
      });
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
        videoBitDepth: row.videoBitDepth ?? 8,
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
          hasLogo: row.logoUrl !== null,
          seriesTitle: row.seriesTitle,
          seasonNumber: row.seasonNumber,
          episodeNumber: row.episodeNumber,
        },
      });

      return detail;
    },

    readArtworkUrl: async (mediaId, kind) => {
      const rows = await db
        .select({
          poster: mediaItem.posterUrl,
          backdrop: mediaItem.backdropUrl,
          logo: mediaItem.logoUrl,
        })
        .from(mediaItem)
        .where(eq(mediaItem.id, mediaId))
        .limit(1);

      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return (kind === 'poster' ? row.poster : kind === 'logo' ? row.logo : row.backdrop) ?? null;
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

      await db
        .update(library)
        .set({ generation: sql`${library.generation} + 1` })
        .where(eq(library.id, libraryId));

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

    fetchLogos: async (libraryId) => {
      if ((await findLibrary(libraryId)) === null) {
        return null;
      }

      const jobId = await jobs.enqueue(FETCH_LOGOS_JOB, { libraryId }, libraryId);

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

    runReadAgain: async (libraryId, paths, jobId) => {
      await readAgain(
        libraryId,
        paths,
        jobId === undefined
          ? undefined
          : (phase, processed, total) => jobs.reportProgress(jobId, phase, processed, total),
      );
    },

    runScan: async (libraryId, force = false, jobId) => {
      const found = await findLibrary(libraryId);

      if (found === null) {
        return null;
      }

      const result = await scanLibrary({
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
              isCancelled: () => jobs.isCancelled(jobId),
            }),
      });

      await db
        .update(library)
        .set({
          lastScanAdded: result.added,
          lastScanUpdated: result.updated,
          lastScanRemoved: result.removed,
          lastScanFailed: result.failed,
        })
        .where(eq(library.id, libraryId));

      return result;
    },

    runRegeneratePreviews: async (libraryId, defaultAudioLanguage, jobId) => {
      await regeneratePreviews({
        libraryId,
        generation: (await findLibrary(libraryId))?.generation ?? 0,
        atOnce: await filesAtOnceFor(libraryId),
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
              isCancelled: () => jobs.isCancelled(jobId),
            }),
      });
    },

    runFetchLogos: async (libraryId, jobId) => {
      /**
       * The first provider that can supply lettering.
       *
       * Providers are tried in order everywhere else too; a filename reader
       * has no artwork to give and simply does not offer this.
       */
      const readLogoUrl = (providers ?? []).find(
        (provider) => provider.readLogoUrl !== undefined,
      )?.readLogoUrl;

      await fetchLogos({
        libraryId,
        store: {
          listMissing: async (id) => {
            const rows = await db
              .select({
                id: mediaItem.id,
                externalId: mediaItem.externalId,
                seriesTitle: mediaItem.seriesTitle,
              })
              .from(mediaItem)
              .where(and(eq(mediaItem.libraryId, id), isNull(mediaItem.logoUrl)));

            return rows.flatMap((row) =>
              row.externalId === null
                ? []
                : [
                    {
                      id: row.id,
                      externalId: row.externalId,
                      isSeries: row.seriesTitle !== null,
                    },
                  ],
            );
          },
          save: async (mediaItemId, logoUrl) => {
            await db.update(mediaItem).set({ logoUrl }).where(eq(mediaItem.id, mediaItemId));
          },
        },
        ...(readLogoUrl === undefined ? {} : { readLogoUrl }),
        ...(onProblem === undefined ? {} : { onProblem }),
        ...(jobId === undefined
          ? {}
          : {
              onProgress: (done, total) => jobs.reportProgress(jobId, 'logos', done, total),
              isCancelled: () => jobs.isCancelled(jobId),
            }),
      });
    },

    runRegenerateTrickplay: async (libraryId, jobId) => {
      await generateTrickplay({
        libraryId,
        generation: (await findLibrary(libraryId))?.generation ?? 0,
        atOnce: await filesAtOnceFor(libraryId),
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
              isCancelled: () => jobs.isCancelled(jobId),
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
