import type { ServerSettings, SettingsStore } from './ServerSettings'

/**
 * Builds a settings store held in memory.
 *
 * Used by tests, and by the server before a database is reachable.
 */
const createMemorySettingsStore = (initial: ServerSettings): SettingsStore => {
  let current: ServerSettings = initial

  return {
    read: () => Promise.resolve(current),
    write: (patch) => {
      current = { ...current, ...patch }

      return Promise.resolve(current)
    },
  }
}

export default { createMemorySettingsStore }
