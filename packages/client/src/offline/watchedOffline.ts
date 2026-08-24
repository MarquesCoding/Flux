import { z } from 'zod';
import { platformInUse } from '@ValenceClient/platform/installPlatform';
import { fetchWatchProgress, reportWatchProgress } from '@ValenceClient/playback/watchProgress';

const STORAGE_KEY = 'valence.offline.watched';

const WRITE_EVERY_SECONDS = 5;

const WatchedOfflineSchema = z.object({
  mediaId: z.string(),
  positionSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  atMs: z.number().int().nonnegative(),
});

const WatchedOfflineListSchema = z.array(WatchedOfflineSchema).catch([]);

type WatchedOffline = z.infer<typeof WatchedOfflineSchema>;

/**
 * Everything watched on this device while there was no server to tell.
 *
 * @returns What is waiting to be reconciled, oldest first.
 */
const watchedOffline = (): WatchedOffline[] => {
  const said = platformInUse().store.read(STORAGE_KEY);

  if (said === null) {
    return [];
  }

  return WatchedOfflineListSchema.parse(JSON.parse(said));
};

/**
 * Writes down where somebody got to in something, to be told to the server later.
 *
 * Kept on the device because there is nowhere else to keep it. This is the half of offline nobody
 * asks for and everybody notices: watching two episodes on a plane and finding the shelf at home
 * still offering the first one is the moment the feature stops feeling finished.
 *
 * One entry per item, replaced rather than added to. Where somebody got to is the only thing worth
 * keeping; the route they took to get there is not, and keeping it would grow without bound on a
 * long flight.
 *
 * Written no more often than every few seconds. The player reports its position several times a
 * second, and writing each one would mean rewriting a file on the disk hundreds of times per film
 * for a figure nobody will read until the aeroplane lands.
 *
 * @param mediaId - What was being watched.
 * @param positionSeconds - Where they got to.
 * @param durationSeconds - How long it runs.
 * @param atMs - When, which decides whose answer wins when the server has one too.
 */
const rememberWatchedOffline = (
  mediaId: string,
  positionSeconds: number,
  durationSeconds: number,
  atMs: number = Date.now(),
): void => {
  if (durationSeconds <= 0) {
    return;
  }

  const held = watchedOffline();
  const already = held.find((entry) => entry.mediaId === mediaId);

  if (
    already !== undefined &&
    Math.abs(already.positionSeconds - positionSeconds) < WRITE_EVERY_SECONDS
  ) {
    return;
  }

  const kept = [
    ...held.filter((entry) => entry.mediaId !== mediaId),
    { mediaId, positionSeconds, durationSeconds, atMs },
  ];

  platformInUse().store.write(STORAGE_KEY, JSON.stringify(kept));
};

/**
 * Forgets what has been watched offline.
 */
const forgetWatchedOffline = (): void => {
  platformInUse().store.forget(STORAGE_KEY);
};

/**
 * Tells the server where somebody got to while it was not there.
 *
 * Watch progress is last written wins, which is not a merge — two devices that watched the same
 * thing while apart disagree, and the loser is silently whichever reconnected first. Offline is what
 * makes that common rather than theoretical, so what is sent is filtered rather than flung: an entry
 * is only sent where the server has nothing, or where what the server has is older than what
 * happened on this device.
 *
 * Deliberately not clever beyond that. Deciding that the furthest position always wins would be
 * wrong for somebody starting a film again, and picking between two honest answers is a question for
 * whoever watched them rather than for this.
 *
 * Everything is forgotten once it has been sent, including where the server already knew better.
 * Anything kept would be sent again on the next reconnection, and would overwrite something newer.
 *
 * @returns How many were told to the server.
 */
const sendWatchedOffline = async (): Promise<number> => {
  const held = watchedOffline();

  if (held.length === 0) {
    return 0;
  }

  const known = new Map(
    (await fetchWatchProgress().catch(() => [])).map((entry) => [
      entry.mediaId,
      Date.parse(entry.updatedAt),
    ]),
  );

  const worthSending = held.filter((entry) => {
    const theirs = known.get(entry.mediaId);

    return theirs === undefined || Number.isNaN(theirs) || entry.atMs > theirs;
  });

  await Promise.all(
    worthSending.map(async (entry) =>
      reportWatchProgress(entry.mediaId, {
        positionSeconds: entry.positionSeconds,
        durationSeconds: entry.durationSeconds,
      }),
    ),
  );

  forgetWatchedOffline();

  return worthSending.length;
};

export type { WatchedOffline };

export {
  STORAGE_KEY,
  WRITE_EVERY_SECONDS,
  forgetWatchedOffline,
  rememberWatchedOffline,
  sendWatchedOffline,
  watchedOffline,
};
