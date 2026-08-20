import type { Platform } from '@FluxClient/platform/Platform.types';

/**
 * A platform that keeps things in memory and answers the same way every time, for tests about what
 * the application does rather than about where a browser puts things.
 *
 * @param overrides - Anything a particular test wants to answer differently.
 * @returns Something to install.
 */
const aFakePlatform = (overrides: Partial<Platform> = {}): Platform => {
  const kept = new Map<string, string>();

  return {
    store: {
      read: (key) => kept.get(key) ?? null,
      write: (key, value) => {
        kept.set(key, value);
      },
      forget: (key) => {
        kept.delete(key);
      },
    },
    describeThisClient: () => 'A test',
    openSocket: () => ({ send: () => {}, close: () => {} }),
    thisClientId: () => 'client-1',
    ...overrides,
  };
};

export { aFakePlatform };
