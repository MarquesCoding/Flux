type WorkLock = {
  run: <T>(key: string, work: () => Promise<T>) => Promise<T>;
};

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
