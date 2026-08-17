import type { JsonValue } from '@FluxContracts/schemas/JsonValue';

type Cancel = () => void;

type Schedule = (run: () => void, afterMs: number) => Cancel;

type Coalesced = { payload: JsonValue; folded: number };

type CoalescerOptions = {
  windowMs: number;
  schedule: Schedule;
  flush: (key: string, coalesced: Coalesced) => void;
};

type Coalescer = {
  offer: (key: string, payload: JsonValue) => void;
  stop: () => void;
};

/**
 * Holds rapid events for a moment and sends one in their place. A scan changing four thousand items
 * publishes four thousand times, and a tab does not need four thousand frames to learn that the
 * library changed — it needs to know that it did, and roughly how much.
 *
 * The most recent payload wins and the count of everything folded into it travels with it, so a
 * receiver can tell a single change from a flood without being sent the flood.
 *
 * @param windowMs - How long to gather before sending.
 * @param schedule - How to wait, injected so this can be tested without a clock.
 * @param flush - Where a gathered event goes.
 * @returns The coalescer.
 */
const createCoalescer = ({ windowMs, schedule, flush }: CoalescerOptions): Coalescer => {
  const waiting = new Map<string, Coalesced>();
  const cancels = new Map<string, Cancel>();

  const send = (key: string) => {
    const held = waiting.get(key);

    cancels.delete(key);
    waiting.delete(key);

    if (held !== undefined) {
      flush(key, held);
    }
  };

  return {
    offer: (key, payload) => {
      const held = waiting.get(key);

      if (held === undefined) {
        waiting.set(key, { payload, folded: 0 });
        cancels.set(
          key,
          schedule(() => {
            send(key);
          }, windowMs),
        );

        return;
      }

      waiting.set(key, { payload, folded: held.folded + 1 });
    },

    stop: () => {
      for (const cancel of cancels.values()) {
        cancel();
      }

      cancels.clear();
      waiting.clear();
    },
  };
};

export type { Coalescer, Coalesced, Schedule, Cancel };

export { createCoalescer };
