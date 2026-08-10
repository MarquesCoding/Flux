import { randomUUID } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import SchemaModule from '@FluxServer/db/Schema'
import type { FluxDatabase } from '@FluxServer/db/Database'
import type { MediaStore } from './scanLibrary'

const { mediaItem, library } = SchemaModule

/**
 * The library tables, for the scanner.
 *
 * Upserts on (library, path) so that re-scanning a changed file replaces its
 * row rather than duplicating it, and so a scan interrupted halfway can simply
 * be run again.
 */
const createMediaStore = (db: FluxDatabase): MediaStore => ({
  listStored: async (libraryId) => {
    const rows = await db
      .select({
        path: mediaItem.path,
        sizeBytes: mediaItem.sizeBytes,
        modifiedAtMs: mediaItem.modifiedAtMs,
      })
      .from(mediaItem)
      .where(eq(mediaItem.libraryId, libraryId))

    return rows
  },

  upsert: async (row) => {
    const video = row.probe.video

    if (video === null) {
      return
    }

    const values = {
      id: randomUUID(),
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
      width: video.width,
      height: video.height,
      audioStreams: row.probe.audioStreams,
      subtitleStreams: row.probe.subtitleStreams,
      chapters: row.probe.chapters,
      seriesTitle: row.episode.seriesTitle,
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
      accentColor: row.accentColor,
      updatedAt: new Date(),
    }

    await db
      .insert(mediaItem)
      .values(values)
      .onConflictDoUpdate({
        target: [mediaItem.libraryId, mediaItem.path],
        set: {
          title: values.title,
          year: values.year,
          sizeBytes: values.sizeBytes,
          modifiedAtMs: values.modifiedAtMs,
          container: values.container,
          durationSeconds: values.durationSeconds,
          bitrateKbps: values.bitrateKbps,
          videoCodec: values.videoCodec,
          videoRange: values.videoRange,
          width: values.width,
          height: values.height,
          audioStreams: values.audioStreams,
          subtitleStreams: values.subtitleStreams,
          updatedAt: values.updatedAt,
        },
      })
  },

  removeByPaths: async (libraryId, paths) => {
    if (paths.length === 0) {
      return 0
    }

    const removed = await db
      .delete(mediaItem)
      .where(and(eq(mediaItem.libraryId, libraryId), inArray(mediaItem.path, paths)))
      .returning({ id: mediaItem.id })

    return removed.length
  },

  markScanned: async (libraryId) => {
    await db.update(library).set({ lastScannedAt: new Date() }).where(eq(library.id, libraryId))
  },
})

/**
 * Counts the items in a library.
 */
const countItems = async (db: FluxDatabase, libraryId: string): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(mediaItem)
    .where(eq(mediaItem.libraryId, libraryId))

  return rows[0]?.total ?? 0
}

export default { createMediaStore, countItems }
