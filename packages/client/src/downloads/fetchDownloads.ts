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
import { JsonValueSchema } from '@ValenceContracts/schemas/JsonValue';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

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
  episodes: z.number().int().positive(),
  options: z.array(DownloadOptionSchema),
});

type DownloadOffer = z.infer<typeof DownloadOfferSchema>;
type DownloadOption = z.infer<typeof DownloadOptionSchema>;

/**
 * Reads an offer the server sent, and treats one it cannot read as no offer at all.
 *
 * Refused rather than thrown, because of where this is called from. These answers are read inside a
 * click — somebody pressing a button to see what a film would cost — and an exception there escapes
 * as an unhandled rejection: the spinner stops, nothing is drawn, nobody is told, and the only trace
 * is in a console the person pressing the button will never open. Nothing is a shape the screen
 * already knows how to say something about.
 *
 * @param said - What the server sent.
 * @returns The offer, or nothing where it was not one.
 */
const anOffer = (said: JsonValue): DownloadOffer | null => {
  const read = DownloadOfferSchema.safeParse(said);

  return read.success ? read.data : null;
};

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

  return anOffer(JsonValueSchema.parse(await response.json()));
};

/**
 * What a whole programme would cost, added up across the episodes it holds.
 *
 * Added up rather than one episode multiplied, because episodes are not the same length and the
 * one that differs most is usually the finale. The server knows every episode, so it is the thing
 * that should be doing the arithmetic.
 *
 * @param seriesId - The programme.
 * @param deviceProfile - What this device says it can play.
 * @returns What is on offer, or nothing where the server would not say.
 */
const fetchSeriesDownloadOffer = async (
  seriesId: string,
  deviceProfile: DeviceProfile,
): Promise<DownloadOffer | null> => {
  const response = await askTheServer(
    `/api/series/${encodeURIComponent(seriesId)}/downloads/offer`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceProfile }),
    },
  ).catch(() => null);

  if (response === null || !response.ok) {
    return null;
  }

  return anOffer(JsonValueSchema.parse(await response.json()));
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

  const read = DownloadSchema.safeParse(await response.json());

  return read.success ? read.data : null;
};

/**
 * Asks for every episode of a programme to be prepared.
 *
 * Nobody downloads one episode of a series. What comes back is the queue, in the order it will be
 * worked through — the server prepares them a few at a time rather than all at once, so asking for
 * a whole season does not starve everybody else off the machine.
 *
 * @param seriesId - The programme.
 * @param quality - Which rung, or the original.
 * @param audioLanguages - Which sound to carry.
 * @returns What was queued.
 */
const askForSeries = async (
  seriesId: string,
  quality: DownloadQuality,
  audioLanguages: string[] = [],
): Promise<Download[]> => {
  const response = await askTheServer(`/api/series/${encodeURIComponent(seriesId)}/downloads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quality, audioLanguages }),
  }).catch(() => null);

  if (response === null || !response.ok) {
    return [];
  }

  const read = DownloadListSchema.safeParse(await response.json());

  return read.success ? read.data.downloads : [];
};

/**
 * Stops preparing something for now, or carries on from where it stopped.
 *
 * Pausing keeps what has been done. The work is the server's rather than this device's, so it
 * survives the application being closed and picks up where it left off rather than starting the
 * film again.
 *
 * @param id - The prepared download.
 * @param isPaused - Whether it should be stopped.
 * @returns Whether the server did it.
 */
const setDownloadPaused = async (id: string, isPaused: boolean): Promise<boolean> => {
  const response = await askTheServer(`/api/downloads/${id}/${isPaused ? 'pause' : 'resume'}`, {
    method: 'POST',
  }).catch(() => null);

  return response !== null && response.ok;
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
  askForSeries,
  setDownloadPaused,
  fetchDownloadOffer,
  fetchDownloads,
  fetchSeriesDownloadOffer,
  fetchHoldings,
  forgetDownload,
  setHolding,
};
