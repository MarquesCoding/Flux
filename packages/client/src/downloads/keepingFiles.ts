import { platformInUse } from '@ValenceClient/platform/installPlatform';
import type { Download } from '@ValenceContracts/schemas/Download';
import type { WhatToKeep } from '@ValenceContracts/schemas/HeldFile';

/**
 * What this device needs to know about a prepared download in order to keep a copy of it.
 *
 * Taken from the download rather than fetched again, because this is the one moment both halves are
 * certainly to hand: the server has just said what the thing is, and the device is about to hold it.
 * Afterwards there may be no server to ask.
 *
 * @param download - What the server prepared.
 * @param durationSeconds - How long it runs, where the screen asking knows.
 * @returns What to hand the host.
 */
const asSomethingToKeep = (
  download: Download,
  durationSeconds: number | null = null,
): WhatToKeep => ({
  downloadId: download.id,
  mediaId: download.mediaId,
  seriesId: download.seriesId,
  seriesTitle: download.seriesTitle,
  title: download.title,
  quality: download.quality,
  durationSeconds,
  ofBytes: download.sizeBytes,
});

/**
 * Asks this device to fetch a prepared file and keep it.
 *
 * @param download - What the server prepared.
 * @param durationSeconds - How long it runs.
 */
const keepAFile = async (
  download: Download,
  durationSeconds: number | null = null,
): Promise<void> => {
  await platformInUse().held.keep(asSomethingToKeep(download, durationSeconds));
};

/**
 * Lets go of a copy on this device.
 *
 * The server's copy is a separate question and is left alone. Somebody clearing space on a laptop
 * has not said anything about what the server should still be holding for their other machines.
 *
 * @param downloadId - The prepared download.
 */
const dropAFile = async (downloadId: string): Promise<void> => {
  await platformInUse().held.drop(downloadId);
};

/**
 * Stops a transfer for now, or picks it back up.
 *
 * @param downloadId - The prepared download.
 * @param isPaused - Whether it should stop.
 */
const pauseAFile = async (downloadId: string, isPaused: boolean): Promise<void> => {
  await platformInUse().held.pause(downloadId, isPaused);
};

/**
 * Where the player should look for a copy on this device.
 *
 * @param downloadId - The prepared download.
 * @returns An address on this client's own origin.
 */
const sourceForAFile = (downloadId: string): string => platformInUse().held.sourceFor(downloadId);

/**
 * Where the artwork for a copy on this device is.
 *
 * @param downloadId - The prepared download.
 * @returns An address on this client's own origin.
 */
const posterForAFile = (downloadId: string): string => platformInUse().held.posterFor(downloadId);

export { asSomethingToKeep, dropAFile, keepAFile, pauseAFile, posterForAFile, sourceForAFile };
