import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { and, eq, inArray, sql } from 'drizzle-orm'
import SchemaModule from '@FluxServer/db/Schema'
import MediaItemModule from '@FluxContracts/schemas/MediaItem'
import type { FluxDatabase } from '@FluxServer/db/Database'
import type { AudioStream } from '@FluxContracts/schemas/MediaItem'
import type { MediaStore } from './scanLibrary'

const { mediaItem, library } = SchemaModule
const { AudioStreamSchema } = MediaItemModule

/**
 * The library tables, for the scanner.
 *
 * Upserts on (library, path) so that re-scanning a changed file replaces its
 * row rather than duplicating it, and so a scan interrupted halfway can simply
 * be run again.
 */
const createMediaStore = (
  db: FluxDatabase,
): MediaStore & { clear: (libraryId: string) => Promise<number> } => ({
  listStored: async (libraryId) => {
    const rows = await db
      .select({
        path: mediaItem.path,
        sizeBytes: mediaItem.sizeBytes,
        modifiedAtMs: mediaItem.modifiedAtMs,
        externalId: mediaItem.externalId,
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
      width: video.width,
      height: video.height,
      audioStreams: row.probe.audioStreams,
      subtitleStreams: row.probe.subtitleStreams,
      chapters: row.probe.chapters,
      // What the catalogue calls the show wins over what the path suggested:
      // one is a name, the other is a folder somebody happened to choose.
      seriesTitle: row.metadata.seriesTitle ?? row.episode.seriesTitle,
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
    }

    await db
      .insert(mediaItem)
      .values({ id: randomUUID(), ...changeable })
      // Everything the scan just worked out, not a subset of it. This clause
      // was written when a row was only what a probe said, and it never
      // learned about metadata — so an item that already existed could never
      // gain a poster, a synopsis or a cast, and a catalogue key added after
      // the first scan appeared to do nothing at all.
      .onConflictDoUpdate({
        target: [mediaItem.libraryId, mediaItem.path],
        set: changeable,
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

  // Watch progress and segments cascade with the item they belong to, so a
  // clear leaves nothing behind for a rebuilt item to inherit by accident.
  clear: async (libraryId) => {
    const removed = await db
      .delete(mediaItem)
      .where(eq(mediaItem.libraryId, libraryId))
      .returning({ id: mediaItem.id })

    return removed.length
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

/**
 * Every stored item's path and audio streams, for regenerating previews.
 *
 * Deliberately narrow: previews are re-rendered from what a previous scan
 * already probed, so nothing here touches the filesystem, re-runs metadata
 * providers, or re-samples a colour — the whole point of a dedicated
 * regeneration job rather than a forced rescan.
 */
const listForPreviewRegeneration = async (
  db: FluxDatabase,
  libraryId: string,
): Promise<{ path: string; audioStreams: AudioStream[] }[]> => {
  const rows = await db
    .select({ path: mediaItem.path, audioStreams: mediaItem.audioStreams })
    .from(mediaItem)
    .where(eq(mediaItem.libraryId, libraryId))

  return rows.map((row) => ({
    path: row.path,
    audioStreams: z.array(AudioStreamSchema).parse(row.audioStreams),
  }))
}

export default { createMediaStore, countItems, listForPreviewRegeneration }
