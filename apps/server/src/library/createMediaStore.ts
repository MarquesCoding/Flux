import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { mediaItem, mediaItemJob, mediaOverride, library, series } from '@ValenceServer/db/Schema';
import { AudioStreamSchema } from '@ValenceContracts/schemas/MediaItem';
import { describeQuality } from './describeQuality';
import type { ValenceDatabase } from '@ValenceServer/db/Database';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';
import { resolveSeriesKey } from './resolveSeriesKey';
import type { MediaStore } from './scanLibrary';

/**
 * The library's tables as the scanner uses them: what is stored now, what to write, what to remove,
 * and the corrections an operator has made. Everything the scanner needs of the database and nothing
 * else, so the scan itself can be tested against a store held in memory.
 *
 * @param db - The database to read and write.
 * @returns The store, plus the operations only a real library performs.
 */
const createMediaStore = (
  db: ValenceDatabase,
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
        videoRangeBase: mediaItem.videoRangeBase,
        canCopySegments: mediaItem.canCopySegments,
        probeVersion: mediaItem.probeVersion,
        videoLevel: mediaItem.videoLevel,
        videoFrameRate: mediaItem.videoFrameRate,
        videoIsInterlaced: mediaItem.videoIsInterlaced,
        videoRefFrames: mediaItem.videoRefFrames,
        videoPixelAspect: mediaItem.videoPixelAspect,
        videoRotationDegrees: mediaItem.videoRotationDegrees,
      })
      .from(mediaItem)
      .where(eq(mediaItem.libraryId, libraryId));

    return rows;
  },

  upsert: async (row) => {
    const video = row.probe.video;

    if (video === null) {
      return null;
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
      videoRangeBase: video.rangeBase,
      videoBitDepth: video.bitDepth ?? null,
      canCopySegments: row.probe.canCopySegments ?? null,
      probeVersion: row.probeVersion,
      videoLevel: video.level,
      videoFrameRate: video.frameRate,
      videoIsInterlaced: video.isInterlaced,
      videoRefFrames: video.refFrames,
      videoPixelAspect: video.pixelAspect,
      videoRotationDegrees: video.rotationDegrees,
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

    if (saved === undefined) {
      return null;
    }

    await db.delete(mediaItemJob).where(eq(mediaItemJob.mediaItemId, saved.id));

    return saved.id;
  },

  removeByPaths: async (libraryId, paths) => {
    if (paths.length === 0) {
      return [];
    }

    const removed = await db
      .delete(mediaItem)
      .where(and(eq(mediaItem.libraryId, libraryId), inArray(mediaItem.path, paths)))
      .returning({
        itemId: mediaItem.id,
        title: mediaItem.title,
        seriesTitle: mediaItem.seriesTitle,
        seasonNumber: mediaItem.seasonNumber,
        episodeNumber: mediaItem.episodeNumber,
        year: mediaItem.year,
        posterUrl: mediaItem.posterUrl,
        overview: mediaItem.overview,
        durationSeconds: mediaItem.durationSeconds,
        rating: mediaItem.rating,
        width: mediaItem.width,
        height: mediaItem.height,
        videoRange: mediaItem.videoRange,
      });

    return removed.map(({ width, height, videoRange, ...one }) => ({
      ...one,
      genres: [],
      quality: describeQuality(width, height, videoRange),
    }));
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
 * Finds the items in a library that a given job has not yet finished with, which is what lets
 * previews, thumbnails and segment detection resume after a restart rather than beginning again.
 *
 * @param db - The database to ask.
 * @param libraryId - The library being worked through.
 * @param kind - The job being asked about.
 * @returns The items still outstanding, with what each needs to be worked on.
 */
const listOutstandingFor = async (
  db: ValenceDatabase,
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
 * Records that a job has finished with one item, so a restart does not do it again.
 *
 * @param db - The database to write to.
 * @param mediaItemId - The item that was finished with.
 * @param kind - The job that finished.
 */
const markJobComplete = async (
  db: ValenceDatabase,
  mediaItemId: string,
  kind: string,
): Promise<void> => {
  await db.insert(mediaItemJob).values({ mediaItemId, kind }).onConflictDoNothing();
};

/**
 * Forgets a job's completions across a whole library, putting every item back in front of it. This
 * is what a recipe change means — new preview settings, a different thumbnail interval — where the
 * work was done correctly and is simply no longer what is wanted.
 *
 * @param db - The database to write to.
 * @param libraryId - The library to forget across.
 * @param kind - The job whose completions to forget.
 */
const clearJobCompletions = async (
  db: ValenceDatabase,
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
