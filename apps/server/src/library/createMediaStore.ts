import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { mediaItem, mediaItemJob, mediaOverride, library, series } from '@FluxServer/db/Schema';
import { AudioStreamSchema } from '@FluxContracts/schemas/MediaItem';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { AudioStream } from '@FluxContracts/schemas/MediaItem';
import { resolveSeriesKey } from './resolveSeriesKey';
import type { MediaStore } from './scanLibrary';

/**
 * The library tables, for the scanner.
 */
const createMediaStore = (
  db: FluxDatabase,
): MediaStore & {
  clear: (libraryId: string) => Promise<number>;
  saveOverride: (row: {
    libraryId: string;
    path: string;
    externalId: string;
    externalKind: 'tv' | 'movie';
    updatedBy: string | null;
  }) => Promise<void>;
  removeOverrides: (libraryId: string, paths: string[]) => Promise<number>;
} => ({
  listStored: async (libraryId) => {
    const rows = await db
      .select({
        path: mediaItem.path,
        sizeBytes: mediaItem.sizeBytes,
        modifiedAtMs: mediaItem.modifiedAtMs,
        externalId: mediaItem.externalId,
        videoBitDepth: mediaItem.videoBitDepth,
        canCopySegments: mediaItem.canCopySegments,
      })
      .from(mediaItem)
      .where(eq(mediaItem.libraryId, libraryId));

    return rows;
  },

  upsert: async (row) => {
    const video = row.probe.video;

    if (video === null) {
      return;
    }

    const seriesTitle = row.metadata.seriesTitle ?? row.episode.seriesTitle;

    const seriesKey = resolveSeriesKey({
      externalId: row.metadata.externalId ?? null,
      seriesFolder: row.episode.seriesFolder,
      seriesTitle,
    });

    const seriesId =
      seriesKey === null || seriesTitle === null
        ? null
        : ((
            await db
              .insert(series)
              .values({
                id: randomUUID(),
                libraryId: row.libraryId,
                key: seriesKey,
                title: seriesTitle,
                externalId: row.metadata.externalId ?? null,
              })
              .onConflictDoUpdate({
                target: [series.libraryId, series.key],
                set: {
                  title: seriesTitle,
                  externalId: row.metadata.externalId ?? null,
                  updatedAt: new Date(),
                },
              })
              .returning({ id: series.id })
          )[0]?.id ?? null);

    const changeable = {
      libraryId: row.libraryId,
      path: row.path,
      title: row.title,
      year: row.year,
      sizeBytes: row.sizeBytes,
      modifiedAtMs: row.modifiedAtMs,
      container: row.probe.container,
      durationSeconds: row.probe.durationSeconds,
      bitrateKbps: row.probe.bitrateKbps,
      videoCodec: video.codec,
      videoRange: video.range,
      videoBitDepth: video.bitDepth ?? null,
      canCopySegments: row.probe.canCopySegments ?? null,
      width: video.width,
      height: video.height,
      audioStreams: row.probe.audioStreams,
      subtitleStreams: row.probe.subtitleStreams,
      chapters: row.probe.chapters,
      seriesId,
      seriesTitle,
      seasonNumber: row.episode.seasonNumber,
      episodeNumber: row.episode.episodeNumber,
      overview: row.metadata.overview ?? null,
      tagline: row.metadata.tagline ?? null,
      genres: row.metadata.genres ?? null,
      castMembers: row.metadata.cast ?? null,
      rating: row.metadata.rating ?? null,
      posterUrl: row.metadata.posterUrl ?? null,
      backdropUrl: row.metadata.backdropUrl ?? null,
      externalId: row.metadata.externalId ?? null,
      updatedAt: new Date(),
    };

    const [saved] = await db
      .insert(mediaItem)
      .values({ id: randomUUID(), ...changeable })
      .onConflictDoUpdate({
        target: [mediaItem.libraryId, mediaItem.path],
        set: changeable,
      })
      .returning({ id: mediaItem.id });

    if (saved !== undefined) {
      await db.delete(mediaItemJob).where(eq(mediaItemJob.mediaItemId, saved.id));
    }
  },

  removeByPaths: async (libraryId, paths) => {
    if (paths.length === 0) {
      return 0;
    }

    const removed = await db
      .delete(mediaItem)
      .where(and(eq(mediaItem.libraryId, libraryId), inArray(mediaItem.path, paths)))
      .returning({ id: mediaItem.id });

    return removed.length;
  },

  markScanned: async (libraryId) => {
    await db.update(library).set({ lastScannedAt: new Date() }).where(eq(library.id, libraryId));
  },

  listOverrides: async (libraryId) => {
    const rows = await db
      .select({
        path: mediaOverride.path,
        externalId: mediaOverride.externalId,
        externalKind: mediaOverride.externalKind,
      })
      .from(mediaOverride)
      .where(eq(mediaOverride.libraryId, libraryId));

    return rows.map((row) => ({
      path: row.path,
      externalId: row.externalId,
      externalKind: row.externalKind === 'movie' ? ('movie' as const) : ('tv' as const),
    }));
  },

  saveOverride: async (row) => {
    const changeable = {
      libraryId: row.libraryId,
      path: row.path,
      externalId: row.externalId,
      externalKind: row.externalKind,
      updatedAt: new Date(),
      updatedBy: row.updatedBy,
    };

    await db
      .insert(mediaOverride)
      .values({ id: randomUUID(), ...changeable })
      .onConflictDoUpdate({
        target: [mediaOverride.libraryId, mediaOverride.path],
        set: changeable,
      });
  },

  removeOverrides: async (libraryId, paths) => {
    if (paths.length === 0) {
      return 0;
    }

    const removed = await db
      .delete(mediaOverride)
      .where(and(eq(mediaOverride.libraryId, libraryId), inArray(mediaOverride.path, paths)))
      .returning({ id: mediaOverride.id });

    return removed.length;
  },

  clear: async (libraryId) => {
    const removed = await db
      .delete(mediaItem)
      .where(eq(mediaItem.libraryId, libraryId))
      .returning({ id: mediaItem.id });

    return removed.length;
  },
});

/**
 * The items in a library that have not finished the given job.
 */
const listOutstandingFor = async (
  db: FluxDatabase,
  libraryId: string,
  kind: string,
): Promise<{ id: string; path: string; audioStreams: AudioStream[] }[]> => {
  const rows = await db
    .select({ id: mediaItem.id, path: mediaItem.path, audioStreams: mediaItem.audioStreams })
    .from(mediaItem)
    .leftJoin(
      mediaItemJob,
      and(eq(mediaItemJob.mediaItemId, mediaItem.id), eq(mediaItemJob.kind, kind)),
    )
    .where(and(eq(mediaItem.libraryId, libraryId), isNull(mediaItemJob.mediaItemId)));

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    audioStreams: z.array(AudioStreamSchema).parse(row.audioStreams),
  }));
};

/**
 * Records that a job has finished with one item.
 */
const markJobComplete = async (
  db: FluxDatabase,
  mediaItemId: string,
  kind: string,
): Promise<void> => {
  await db.insert(mediaItemJob).values({ mediaItemId, kind }).onConflictDoNothing();
};

/**
 * Forgets a job's completions across a whole library, putting every item back in front of it.
 */
const clearJobCompletions = async (
  db: FluxDatabase,
  libraryId: string,
  kind: string,
): Promise<void> => {
  const rows = await db
    .select({ id: mediaItem.id })
    .from(mediaItem)
    .where(eq(mediaItem.libraryId, libraryId));

  if (rows.length === 0) {
    return;
  }

  await db.delete(mediaItemJob).where(
    and(
      eq(mediaItemJob.kind, kind),
      inArray(
        mediaItemJob.mediaItemId,
        rows.map((row) => row.id),
      ),
    ),
  );
};

export { createMediaStore, listOutstandingFor, markJobComplete, clearJobCompletions };
