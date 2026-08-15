import type { ServerSettings, SettingsStore } from './ServerSettings';

/**
 * Builds a settings store held in memory.
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
