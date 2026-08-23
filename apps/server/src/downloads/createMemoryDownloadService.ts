import { randomUUID } from 'node:crypto';
import type { Download, DownloadQuality, Holding } from '@ValenceContracts/schemas/Download';
import type { DownloadOffer, DownloadService } from './DownloadService';

type MemoryState = {
  downloads: Record<string, Download[]>;
  holdings: Record<string, Holding[]>;
  offers: Record<string, DownloadOffer>;
};

/**
 * Downloads held in memory, so the routes can be exercised without Postgres or a media service.
 *
 * @param state - Anything already asked for.
 * @returns The download service.
 */
const createMemoryDownloadService = (
  state: MemoryState = { downloads: {}, holdings: {}, offers: {} },
): DownloadService & { state: MemoryState } => ({
  state,

  offer: (mediaId) => Promise.resolve(state.offers[mediaId] ?? null),

  ask: (profileId, mediaId, quality, audioLanguages) => {
    const asked = state.downloads[profileId] ?? [];
    const already = asked.find((one) => one.mediaId === mediaId && one.quality === quality);

    if (already !== undefined) {
      return Promise.resolve(already);
    }

    const made: Download = {
      id: randomUUID(),
      mediaId,
      title: mediaId,
      quality,
      audioLanguages,
      state: 'preparing',
      progress: 0,
      sizeBytes: null,
      failure: null,
      askedAt: new Date(0).toISOString(),
      readyAt: null,
    };

    state.downloads[profileId] = [made, ...asked];

    return Promise.resolve(made);
  },

  list: (profileId) => Promise.resolve(state.downloads[profileId] ?? []),

  refresh: (profileId) => Promise.resolve(state.downloads[profileId] ?? []),

  forget: (profileId, id) => {
    state.downloads[profileId] = (state.downloads[profileId] ?? []).filter((one) => one.id !== id);

    return Promise.resolve();
  },

  hold: (profileId, _clientId, mediaId, quality) => {
    const held = state.holdings[profileId] ?? [];

    if (!held.some((one) => one.mediaId === mediaId && one.quality === quality)) {
      state.holdings[profileId] = [
        { mediaId, quality, heldAt: new Date(0).toISOString() },
        ...held,
      ];
    }

    return Promise.resolve();
  },

  release: (_clientId: string, mediaId: string, quality: DownloadQuality) => {
    for (const [profileId, held] of Object.entries(state.holdings)) {
      state.holdings[profileId] = held.filter(
        (one) => !(one.mediaId === mediaId && one.quality === quality),
      );
    }

    return Promise.resolve();
  },

  held: (profileId) => Promise.resolve(state.holdings[profileId] ?? []),
});

export type { MemoryState };

export { createMemoryDownloadService };
