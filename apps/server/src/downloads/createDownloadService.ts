import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { compareToOriginal } from '@ValenceCore/functions/compareToOriginal';
import { describeQualityMeaning } from '@ValenceCore/functions/describeQualityMeaning';
import { estimateDownloadBytes } from '@ValenceCore/functions/estimateDownloadBytes';
import { listAvailableQualitySteps } from '@ValenceCore/functions/listAvailableQualitySteps';
import { negotiatePlayback } from '@ValenceCore/functions/negotiatePlayback';
import { planToSessionSpec } from '@ValenceCore/functions/planToSessionSpec';
import { resolveQualityStep } from '@ValenceCore/functions/resolveQualityStep';
import { QUALITY_STEPS } from '@ValenceContracts/schemas/QualityStep';
import { DownloadQualitySchema, DownloadStateSchema } from '@ValenceContracts/schemas/Download';
import { downloadHolding, preparedDownload } from '@ValenceServer/db/Schema';
import type { ValenceDatabase } from '@ValenceServer/db/Database';
import type { Transcoder } from '@ValenceServer/transcoder/TranscoderClient';
import type { Download, DownloadQuality, Holding } from '@ValenceContracts/schemas/Download';
import type { DownloadOffer, DownloadService } from './DownloadService';
import type { MediaForDownload } from './MediaForDownload';

const IMAGE_SUBTITLE_FORMATS = new Set(['pgs', 'vobsub', 'dvbsub']);

const SEGMENT_SECONDS = 4;

/**
 * Reads back what a column says the rung was.
 *
 * A column holds text, and text is not a promise. Anything the table cannot be read as falls back
 * to the original rather than throwing: a row written by a newer Valence, or edited by hand, should
 * leave somebody looking at a download they can still delete rather than at a page that will not
 * load.
 *
 * @param stored - What the column holds.
 * @returns The rung, or the original where it is not one.
 */
const qualityOf = (stored: string): DownloadQuality =>
  DownloadQualitySchema.safeParse(stored).data ?? 'original';

type CreateDownloadServiceOptions = {
  db: ValenceDatabase;
  media: MediaForDownload;
  transcoder: Transcoder;
  capabilities: () => Promise<Parameters<typeof planToSessionSpec>[0]['capabilities']>;
  forcedAccel?: () => Promise<string>;
};

/**
 * Reads a stored row back as the thing the API talks in.
 *
 * @param row - What the table holds.
 * @param title - What the item is called.
 * @returns The download.
 */
const asDownload = (
  row: typeof preparedDownload.$inferSelect,
  title: string,
  series: { id: string; title: string } | null,
): Download => ({
  id: row.id,
  mediaId: row.mediaItemId,
  seriesId: series?.id ?? null,
  seriesTitle: series?.title ?? null,
  title,
  quality: qualityOf(row.quality),
  audioLanguages: row.audioLanguages,
  state: DownloadStateSchema.safeParse(row.state).data ?? 'preparing',
  progress: row.progress / 100,
  bytesPerSecond: row.bytesPerSecond,
  sizeBytes: row.sizeBytes,
  failure: row.failure,
  askedAt: row.askedAt.toISOString(),
  readyAt: row.readyAt?.toISOString() ?? null,
});

/**
 * Everything about preparing whole files for people to keep.
 *
 * A prepared file belongs to the server rather than to the person who asked for it. Two devices
 * wanting the same rendition share one, which is why what identifies it is what it contains rather
 * than who asked — and why forgetting somebody's download does not delete the file if somebody else
 * is still pointing at it.
 *
 * @param options - The database, the library, the media service, and what this machine can encode.
 * @returns The service.
 */
const createDownloadService = ({
  db,
  media,
  transcoder,
  capabilities,
  forcedAccel,
}: CreateDownloadServiceOptions): DownloadService => {
  /**
   * What the transcoder should be asked for, and what to call the result.
   *
   * @param mediaId - The item.
   * @param quality - Which rung, or the original.
   * @param audioLanguages - Which sound to carry.
   * @returns The request, or nothing where the item is gone.
   */
  const requestFor = async (
    mediaId: string,
    quality: DownloadQuality,
    audioLanguages: string[],
  ) => {
    const found = await media.findForPlayback(mediaId);

    if (found === null) {
      return null;
    }

    const clamp = resolveQualityStep(found.item, quality);
    const plan = negotiatePlayback(found.item, media.keepingProfile(), clamp, null);

    const spec = planToSessionSpec({
      plan,
      inputPath: found.path,
      sourceRange: found.item.videoRange,
      sourceSize: [found.item.width, found.item.height],
      sourceVideoCodec: found.item.videoCodec,
      imageSubtitleIndexes: found.item.subtitleStreams
        .filter((stream) => IMAGE_SUBTITLE_FORMATS.has(stream.format))
        .map((stream) => stream.index),
      subtitleIndexes: found.item.subtitleStreams.map((stream) => stream.index),
      capabilities: await capabilities(),
      ...(forcedAccel === undefined ? {} : { forcedAccel: await forcedAccel() }),
      startSeconds: 0,
      segmentSeconds: SEGMENT_SECONDS,
      container: 'fmp4',
    });

    if (spec.kind !== 'ok') {
      return null;
    }

    const wanted =
      audioLanguages.length === 0
        ? found.item.audioStreams.slice(0, 1)
        : found.item.audioStreams.filter((stream) =>
            audioLanguages.includes(stream.language ?? ''),
          );

    return {
      title: found.item.title,
      request: {
        spec: spec.spec,
        durationSeconds: found.item.durationSeconds,
        audioStreamIndexes: (wanted.length === 0
          ? found.item.audioStreams.slice(0, 1)
          : wanted
        ).map((stream) => stream.index),
        subtitleStreamIndexes: found.item.subtitleStreams
          .filter((stream) => !IMAGE_SUBTITLE_FORMATS.has(stream.format))
          .map((stream) => stream.index),
        generation: found.generation,
      },
    };
  };

  const service: DownloadService = {
    offer: async (mediaId, deviceProfile): Promise<DownloadOffer | null> => {
      const found = await media.findForPlayback(mediaId);

      if (found === null) {
        return null;
      }

      const { item } = found;
      const asIs = negotiatePlayback(item, deviceProfile, null, null);

      const original = {
        quality: 'original' as const,
        label: 'Original',
        meaning: describeQualityMeaning('original'),
        bytes: estimateDownloadBytes({
          quality: 'original',
          durationSeconds: item.durationSeconds,
          sizeBytes: found.sizeBytes,
        }),
        comparison: null,
        wouldTranscode: asIs.video.kind === 'transcode' || asIs.audio.kind === 'transcode',
      };

      const rungs = listAvailableQualitySteps(item).map((id) => {
        const bytes = estimateDownloadBytes({
          quality: id,
          durationSeconds: item.durationSeconds,
          sizeBytes: found.sizeBytes,
        });

        return {
          quality: id,
          label: QUALITY_STEPS.find((step) => step.id === id)?.label ?? id,
          meaning: describeQualityMeaning(id),
          bytes,
          comparison: bytes === null ? null : compareToOriginal(bytes, found.sizeBytes),
          wouldTranscode: true,
        };
      });

      return { mediaId, title: item.title, episodes: 1, options: [original, ...rungs] };
    },

    offerSeries: async (seriesId, deviceProfile): Promise<DownloadOffer | null> => {
      const episodes = await media.episodesOf(seriesId);
      const first = episodes[0];

      if (first === undefined) {
        return null;
      }

      const each = await Promise.all(
        episodes.map(async (episode) => service.offer(episode.id, deviceProfile)),
      );

      const found = each.filter((one) => one !== null);
      const sample = found[0];

      if (sample === undefined) {
        return null;
      }

      const series = await media.seriesOf(first.id);

      return {
        mediaId: first.id,
        title: series?.title ?? sample.title,
        episodes: found.length,
        options: sample.options.map((option) => {
          const bytes = found.reduce<number | null>((running, one) => {
            const its =
              one.options.find((other) => other.quality === option.quality)?.bytes ?? null;

            return running === null || its === null ? null : running + its;
          }, 0);

          return { ...option, bytes };
        }),
      };
    },

    ask: async (profileId, mediaId, quality, audioLanguages) => {
      const asked = await requestFor(mediaId, quality, audioLanguages);

      if (asked === null) {
        return null;
      }

      const file = await transcoder
        .requestDownload(asked.request)
        .catch((problem: Error) => problem.message);

      const refused = typeof file === 'string';

      const existing = await db
        .select()
        .from(preparedDownload)
        .where(
          and(
            eq(preparedDownload.profileId, profileId),
            eq(preparedDownload.mediaItemId, mediaId),
            eq(preparedDownload.quality, quality),
          ),
        )
        .limit(1);

      const held = existing[0];

      if (held !== undefined) {
        const [updated] = await db
          .update(preparedDownload)
          .set(
            refused
              ? { state: 'failed', failure: `The media service would not start it: ${file}` }
              : {
                  renditionId: file.id,
                  state: file.isReady ? 'ready' : 'preparing',
                  progress: file.progress,
                  bytesPerSecond: file.bytesPerSecond ?? null,
                  sizeBytes: file.sizeBytes ?? null,
                  failure: null,
                  readyAt: file.isReady ? new Date() : null,
                },
          )
          .where(eq(preparedDownload.id, held.id))
          .returning();

        return updated === undefined
          ? null
          : asDownload(updated, asked.title, await media.seriesOf(mediaId));
      }

      const [made] = await db
        .insert(preparedDownload)
        .values({
          id: randomUUID(),
          profileId,
          mediaItemId: mediaId,
          quality,
          audioLanguages,
          renditionId: refused ? '' : file.id,
          state: refused ? 'failed' : file.isReady ? 'ready' : 'preparing',
          progress: refused ? 0 : file.progress,
          sizeBytes: refused ? null : (file.sizeBytes ?? null),
          ...(refused ? { failure: `The media service would not start it: ${file}` } : {}),
          ...(!refused && file.isReady ? { readyAt: new Date() } : {}),
        })
        .returning();

      return made === undefined
        ? null
        : asDownload(made, asked.title, await media.seriesOf(mediaId));
    },

    askForSeries: async (profileId, seriesId, quality, audioLanguages) => {
      const episodes = await media.episodesOf(seriesId);
      const asked: Download[] = [];

      for (const episode of episodes) {
        const one = await service.ask(profileId, episode.id, quality, audioLanguages);

        if (one !== null) {
          asked.push(one);
        }
      }

      return asked;
    },

    pause: async (profileId, id) => {
      const rows = await db
        .select()
        .from(preparedDownload)
        .where(and(eq(preparedDownload.profileId, profileId), eq(preparedDownload.id, id)))
        .limit(1);

      const row = rows[0];

      if (row === undefined || row.state === 'ready') {
        return;
      }

      await transcoder.stopDownload(row.renditionId).catch(() => false);

      await db.update(preparedDownload).set({ state: 'paused' }).where(eq(preparedDownload.id, id));
    },

    resume: async (profileId, id) => {
      const rows = await db
        .select()
        .from(preparedDownload)
        .where(and(eq(preparedDownload.profileId, profileId), eq(preparedDownload.id, id)))
        .limit(1);

      const row = rows[0];

      if (row === undefined || row.state !== 'paused') {
        return;
      }

      await db
        .update(preparedDownload)
        .set({ state: 'queued', failure: null })
        .where(eq(preparedDownload.id, id));

      await service.ask(profileId, row.mediaItemId, qualityOf(row.quality), row.audioLanguages);
    },

    list: async (profileId) => {
      const rows = await db
        .select()
        .from(preparedDownload)
        .where(eq(preparedDownload.profileId, profileId))
        .orderBy(desc(preparedDownload.askedAt));

      return Promise.all(
        rows.map(async (row) =>
          asDownload(
            row,
            (await media.titleOf(row.mediaItemId)) ?? 'Something',
            await media.seriesOf(row.mediaItemId),
          ),
        ),
      );
    },

    refresh: async (profileId) => {
      const rows = await db
        .select()
        .from(preparedDownload)
        .where(
          and(
            eq(preparedDownload.profileId, profileId),
            inArray(preparedDownload.state, ['queued', 'preparing']),
          ),
        );

      for (const row of rows) {
        const asked = await requestFor(row.mediaItemId, qualityOf(row.quality), row.audioLanguages);

        if (asked === null) {
          continue;
        }

        const file = await transcoder.requestDownload(asked.request).catch(() => null);

        if (file === null) {
          await db
            .update(preparedDownload)
            .set({ state: 'failed', failure: 'The media service could not be reached.' })
            .where(eq(preparedDownload.id, row.id));

          continue;
        }

        await db
          .update(preparedDownload)
          .set({
            state: file.isReady ? 'ready' : 'preparing',
            progress: file.progress,
            bytesPerSecond: file.bytesPerSecond ?? null,
            sizeBytes: file.sizeBytes ?? null,
            ...(file.isReady ? { readyAt: new Date() } : {}),
          })
          .where(eq(preparedDownload.id, row.id));
      }

      const after = await db
        .select()
        .from(preparedDownload)
        .where(eq(preparedDownload.profileId, profileId))
        .orderBy(desc(preparedDownload.askedAt));

      return Promise.all(
        after.map(async (row: typeof preparedDownload.$inferSelect) =>
          asDownload(
            row,
            (await media.titleOf(row.mediaItemId)) ?? 'Something',
            await media.seriesOf(row.mediaItemId),
          ),
        ),
      );
    },

    forget: async (profileId, id) => {
      const rows = await db
        .select()
        .from(preparedDownload)
        .where(and(eq(preparedDownload.profileId, profileId), eq(preparedDownload.id, id)))
        .limit(1);

      const row = rows[0];

      if (row === undefined) {
        return;
      }

      await db.delete(preparedDownload).where(eq(preparedDownload.id, id));

      const others = await db
        .select({ id: preparedDownload.id })
        .from(preparedDownload)
        .where(eq(preparedDownload.renditionId, row.renditionId))
        .limit(1);

      if (others.length === 0) {
        await transcoder.forgetDownload(row.renditionId).catch(() => false);
      }
    },

    hold: async (profileId, clientId, mediaId, quality) => {
      await db
        .insert(downloadHolding)
        .values({ id: randomUUID(), profileId, clientId, mediaItemId: mediaId, quality })
        .onConflictDoNothing();
    },

    release: async (clientId, mediaId, quality) => {
      await db
        .delete(downloadHolding)
        .where(
          and(
            eq(downloadHolding.clientId, clientId),
            eq(downloadHolding.mediaItemId, mediaId),
            eq(downloadHolding.quality, quality),
          ),
        );
    },

    held: async (profileId): Promise<Holding[]> => {
      const rows = await db
        .select()
        .from(downloadHolding)
        .where(eq(downloadHolding.profileId, profileId))
        .orderBy(desc(downloadHolding.heldAt));

      return rows.map((row) => ({
        mediaId: row.mediaItemId,
        quality: qualityOf(row.quality),
        heldAt: row.heldAt.toISOString(),
      }));
    },
  };

  return service;
};

export type { CreateDownloadServiceOptions };

export { createDownloadService };
