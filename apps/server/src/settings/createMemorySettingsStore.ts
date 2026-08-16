import type { ServerSettings, SettingsStore } from './ServerSettings';

/**
 * The server's settings held in memory, so the routes can be exercised without Postgres.
 *
 * @param initial - Anything already configured.
 * @returns The settings store.
 */
const createMemorySettingsStore = (initial: ServerSettings): SettingsStore => {
  let current: ServerSettings = initial;

  return {
    read: () => Promise.resolve(current),
    write: (patch) => {
      current = { ...current, ...patch };

      return Promise.resolve(current);
    },
  };
};

export { createMemorySettingsStore };
