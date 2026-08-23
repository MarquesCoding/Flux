import { z } from 'zod';
import { readFromServer } from '@ValenceClient/query/readFromServer';
import { askTheServer } from '@ValenceClient/session/askTheServer';
import {
  DownloadListSchema,
  DownloadQualitySchema,
  DownloadSchema,
  HoldingListSchema,
} from '@ValenceContracts/schemas/Download';
import type { Download, DownloadQuality, Holding } from '@ValenceContracts/schemas/Download';
import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';

const DownloadOptionSchema = z.object({
  quality: DownloadQualitySchema,
  label: z.string(),
  meaning: z.string(),
  bytes: z.number().int().nonnegative().nullable(),
  comparison: z.string().nullable(),
  wouldTranscode: z.boolean(),
});

const DownloadOfferSchema = z.object({
  mediaId: z.string(),
  title: z.string(),
  options: z.array(DownloadOptionSchema),
});

type DownloadOffer = z.infer<typeof DownloadOfferSchema>;
type DownloadOption = z.infer<typeof DownloadOptionSchema>;

/**
 * What could be downloaded for this item, and what each would cost.
 *
 * The device profile goes with the ask because part of the answer depends on it: whether this
 * device would have to have the file converted before it could play it is a fact about the pair,
 * not about the film.
 *
 * @param mediaId - The item.
 * @param deviceProfile - What this device says it can play.
 * @returns What is on offer, or nothing where the server would not say.
 */
const fetchDownloadOffer = async (
  mediaId: string,
  deviceProfile: DeviceProfile,
): Promise<DownloadOffer | null> => {
  const response = await askTheServer(`/api/media/${mediaId}/downloads/offer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceProfile }),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return DownloadOfferSchema.parse(await response.json());
};

/**
 * Asks for a file to be prepared, and says how far along it already is.
 *
 * Asking twice for the same thing is not an error and does not start it twice — the answer is
 * simply where the first ask has got to.
 *
 * @param mediaId - The item.
 * @param quality - Which rung, or the original.
 * @param audioLanguages - Which sound to carry, or nothing for the library's own default.
 * @returns The download, or nothing where the server would not start one.
 */
const askForDownload = async (
  mediaId: string,
  quality: DownloadQuality,
  audioLanguages: string[] = [],
): Promise<Download | null> => {
  const response = await askTheServer(`/api/media/${mediaId}/downloads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quality, audioLanguages }),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return DownloadSchema.parse(await response.json());
};

/**
 * Everything this viewer has asked for, with each one's progress brought up to date.
 */
const fetchDownloads = async (): Promise<Download[]> =>
  (await readFromServer('/api/downloads', DownloadListSchema)).downloads;

/**
 * Stops keeping a prepared file on the server.
 *
 * This is about the server's copy and never about the device's. Something already downloaded is
 * that person's until they delete it themselves; what this reclaims is the disk the server was
 * holding in case somebody asked again.
 *
 * @param id - The prepared download.
 * @returns Whether the server let it go.
 */
const forgetDownload = async (id: string): Promise<boolean> => {
  const response = await askTheServer(`/api/downloads/${id}`, { method: 'DELETE' }).catch(
    () => null,
  );

  return response !== null && response.ok;
};

/**
 * What this viewer's devices say they are holding.
 */
const fetchHoldings = async (): Promise<Holding[]> =>
  (await readFromServer('/api/downloads/holdings', HoldingListSchema)).holdings;

/**
 * Tells the server this device now holds a copy, or no longer does.
 *
 * @param mediaId - The item.
 * @param quality - Which rendition.
 * @param isHeld - Whether it is on this device now.
 * @returns Whether the server recorded it.
 */
const setHolding = async (
  mediaId: string,
  quality: DownloadQuality,
  isHeld: boolean,
): Promise<boolean> => {
  const response = await askTheServer(
    isHeld
      ? `/api/media/${mediaId}/holdings`
      : `/api/media/${mediaId}/holdings/${encodeURIComponent(quality)}`,
    isHeld
      ? {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ quality }),
        }
      : { method: 'DELETE' },
  ).catch(() => null);

  return response !== null && response.ok;
};

export type { DownloadOffer, DownloadOption };

export {
  askForDownload,
  fetchDownloadOffer,
  fetchDownloads,
  fetchHoldings,
  forgetDownload,
  setHolding,
};
