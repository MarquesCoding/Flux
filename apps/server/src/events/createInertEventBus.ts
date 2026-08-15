import type { EventBus } from './EventBus';

/**
 * A bus that hears everything and tells nobody.
 */
const createInertEventBus = (): EventBus => ({
  publish: () => Promise.resolve(),
});

export { createInertEventBus };
