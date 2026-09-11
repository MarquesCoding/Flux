import { wait } from '@ValenceCore/functions/wait';

type CatalogueGate = {
  run: <Answer>(work: () => Promise<Answer>) => Promise<Answer>;
  holdFor: (milliseconds: number) => void;
};

/**
 * Rations what a scan asks of a catalogue, so that reading a library faster does not mean asking a
 * third party faster.
 *
 * Two things at once. A width, because probing several files at a time would otherwise open one
 * conversation per file and a catalogue reasonably objects. And a hold, because a service that has
 * said it is being asked too much has said it about the whole scan rather than about the one request
 * that happened to hear it — every other request in flight is about to be told the same thing, and
 * waiting once together is what stops a refusal turning into a storm of retries.
 *
 * @param width - How many requests may be in the air at once, at least one.
 * @returns Somewhere to run a request, and a way to say the catalogue has had enough.
 */
const createCatalogueGate = (width: number): CatalogueGate => {
  let free = Math.max(1, Math.floor(width));
  let openAt = 0;

  const waiting: (() => void)[] = [];

  const enter = async (): Promise<void> => {
    if (free > 0) {
      free -= 1;

      return;
    }

    await new Promise<void>((resolve) => {
      waiting.push(resolve);
    });
  };

  const leave = (): void => {
    const next = waiting.shift();

    if (next === undefined) {
      free += 1;

      return;
    }

    next();
  };

  return {
    run: async (work) => {
      await enter();

      try {
        const held = openAt - Date.now();

        if (held > 0) {
          await wait(held);
        }

        return await work();
      } finally {
        leave();
      }
    },

    holdFor: (milliseconds) => {
      openAt = Math.max(openAt, Date.now() + milliseconds);
    },
  };
};

export type { CatalogueGate };

export { createCatalogueGate };
