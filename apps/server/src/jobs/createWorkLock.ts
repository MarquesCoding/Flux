/**
 * Runs work one piece at a time per key.
 *
 * pg-boss's singleton keys only stop a queue colliding with itself, and the
 * jobs that touch a library are spread across several queues: a scan runs
 * previews, thumbnails and intro detection as its own later stages, while
 * each of those is also a job in its own right on its own schedule. Nothing
 * stopped the 04:30 detection run starting over a library the 03:00 scan was
 * still working through — both would then see the same items outstanding and
 * fingerprint them twice.
 *
 * Queued rather than dropped. A detection run that arrives mid-scan should
 * wait and then find nothing left to do, which costs a query; refusing it
 * would mean a scheduled run silently not happening.
 */
type WorkLock = {
  run: <T>(key: string, work: () => Promise<T>) => Promise<T>;
};

/**
 * Calls the work, turning a synchronous throw into a rejection.
 *
 * Work reaching the front of the queue is handed straight to `then`, which
 * does this itself. Work that finds the queue empty is called directly, and
 * a callback that throws before its first await would otherwise take the
 * caller down rather than rejecting like every other failure here.
 */
const start = <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return work();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
};

const createWorkLock = (): WorkLock => {
  const tails = new Map<string, Promise<void>>();

  return {
    run: (key, work) => {
      const previous = tails.get(key);
      const next = previous === undefined ? start(work) : previous.then(work, work);
      const settled = next.then(
        () => {},
        () => {},
      );

      tails.set(key, settled);

      void settled.then(() => {
        if (tails.get(key) === settled) {
          tails.delete(key);
        }
      });

      return next;
    },
  };
};

export type { WorkLock };

export { createWorkLock };
