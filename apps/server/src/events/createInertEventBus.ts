import type { EventBus } from './EventBus';

/**
 * A bus that hears everything and tells nobody.
 *
 * What a suite exercising an unrelated route gets, and what a server started
 * without a database runs on. Publishing has to be safe to call from
 * anywhere — that is the whole point of the bus — so the version that does
 * nothing has to exist rather than every call site checking whether there is
 * a real one.
 */
const createInertEventBus = (): EventBus => ({
  publish: () => Promise.resolve(),
});

export { createInertEventBus };
