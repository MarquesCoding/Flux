import type { Cancel, Schedule } from './createCoalescer';

/**
 * The waiting the realtime pieces do, expressed as the one thing they need from a clock. Everything
 * that gathers or delays takes this rather than reaching for a timer directly, which is what lets
 * the registry, the coalescer and the handler be tested without waiting for real time to pass.
 *
 * @returns A scheduler backed by real timers.
 */
const createRealtimeClock = (): Schedule => (run, afterMs) => {
  const timer = setTimeout(run, afterMs);

  const cancel: Cancel = () => {
    clearTimeout(timer);
  };

  return cancel;
};

export { createRealtimeClock };
