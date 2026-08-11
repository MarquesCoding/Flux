import { randomUUID } from 'node:crypto'
import type { JobTriggerStore, StoredTrigger } from './JobTriggerStore'

/**
 * Job triggers held in memory, for testing the schedule service and the
 * admin routes without Postgres.
 */
const createMemoryJobTriggerStore = (): JobTriggerStore => {
  const rows: StoredTrigger[] = []

  return {
    list: () => Promise.resolve([...rows]),

    add: (kind, trigger) => {
      const stored = { id: randomUUID(), kind, trigger }

      rows.push(stored)

      return Promise.resolve(stored)
    },

    remove: (kind, triggerId) => {
      const index = rows.findIndex((row) => row.id === triggerId && row.kind === kind)

      if (index === -1) {
        return Promise.resolve(false)
      }

      rows.splice(index, 1)

      return Promise.resolve(true)
    },
  }
}

export default { createMemoryJobTriggerStore }
